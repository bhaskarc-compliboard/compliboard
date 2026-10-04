/**
 * "SUMMARISE THIS" — the user asking for it now, rather than waiting for the night.
 *
 * POST /api/topics/<id>/summarise
 *
 * ---------------------------------------------------------------------------
 * WHY `summary_source = 'user'` WHEN A MODEL WROTE THE WORDS
 *
 * The column records **who asked for it**, not who typed it — and that is what the nightly job
 * needs to know. `/api/jobs/summarise` skips a topic whose `summary_source` is `'user'` unless
 * turns are newer than the summary (`DECISIONS.md` §125), so marking this `'user'` is what stops
 * tonight's run replacing a summary the person deliberately asked for.
 *
 * Marking it `'nightly'` would be more literal about authorship and would let the job overwrite
 * it hours later, which is the behaviour the rule exists to prevent.
 * ---------------------------------------------------------------------------
 *
 * IT SETS NO CLEARING DATE, AND NEITHER DOES ANYTHING ELSE NOW. Clearing is 12 months after the
 * last turn, computed by `lib/retention.ts` (Workspace Task 2); a summary made here counts exactly
 * as a nightly one does, so it no longer stops the transcript ever being cleared (machinery N2).
 *
 * *** IT NOW PROPOSES FACTS TOO — Workspace Task 5. *** One call writes the report, the title and the
 * candidate facts, and the facts go to `fact_proposals` (source 'conversation', this topic) exactly
 * as the nightly job's do. They are proposals, not facts (§108): they wait in Company information's
 * queue and never interrupt the chat (`DECISIONS.md` §154). A second summary proposes nothing that
 * is already waiting for this conversation (`proposalsToInsert`, and migration 065's unique index).
 *
 * ---------------------------------------------------------------------------
 * *** ONE PRESS, ONE CALL, AND NOT TIED TO THE TAB — Workspace Stage 4. ***
 *
 * Part 1 measured two failures on staging: a second press (same tab or another) paid for a second
 * summary that overwrote the first, and nothing was recorded while it ran. And `DECISIONS.md` §138
 * records work lost on production when the person left before the request finished.
 *
 *   1. THE CLAIM (`lib/topicClaim.ts`). `topics.summary_started_at` is set by compare-and-set before
 *      any model call. Held and younger than ten minutes → 409 "already being written", no call.
 *   2. THE REPLY COMES AT ONCE — 202 `{ status: 'started' }` — and the work runs in `after()` from
 *      `next/server`. Next 16: "`after` will run for the platform's default or configured max duration
 *      of your route" (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md);
 *      on Vercel it is built on `waitUntil`, which extends the invocation until the work settles, up
 *      to `maxDuration`. Closing the tab no longer has a request to cancel.
 *   3. THE RESULT IS SAVED EXACTLY AS BEFORE, by `summariseTopic`, now guarded: it writes only while
 *      this run still holds its claim and the summary is still the one it read, and clears the claim
 *      in the same update. Failure or the 9-minute timeout clears it too; a result arriving after the
 *      timeout is discarded, not written. The page polls `topic_list_v.summary_in_progress`.
 * ---------------------------------------------------------------------------
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { loadTurns } from '@/lib/conversation'
// THE SUMMARY IS ARCHIVED; THE TRANSCRIPT IS NOT. Each answer reaches the summariser with its
// sources, now numbered once for the whole conversation (`numberedTranscript`), so a marker always
// points at something (§127).
import { summariseTopic } from '@/lib/summaryReport'
import { claimTopic, releaseTopic, withinClaimTime, CLAIM_WORDS } from '@/lib/topicClaim'

export const maxDuration = 800

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { db, companyId } = authed.auth

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'No conversation id given.' }, { status: 400 })

  try {
    const { data: topic, error } = await db
      .from('topics').select('id, title').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!topic) return NextResponse.json({ error: 'That conversation was not found.' }, { status: 404 })

    const turns = await loadTurns(db, id)
    if (turns.length === 0) {
      // §5.1: say what is true, never imply the person did something wrong, and offer the way on.
      return NextResponse.json({
        error: 'There are no messages in this conversation to summarise yet. Ask a question first.',
      }, { status: 409 })
    }

    // ---- THE CLAIM, before any model call. Held → the person waits for the run already going.
    const claim = await claimTopic(db, id, 'summary')
    if (!claim.ok) {
      return NextResponse.json({ status: 'writing', message: `${CLAIM_WORDS.summary} It is already being written.` },
        { status: 409 })
    }

    // ---- THE WORK, AFTER THE REPLY. `db` is the caller (the topic update, under RLS); `supabaseAdmin`
    // only proposes the facts, which `authenticated` may not insert (migration 034) — the named
    // statement is in `summariseTopic`. The client is built per request and is only closed over here.
    after(async () => {
      try {
        const result = await withinClaimTime(summariseTopic(db, supabaseAdmin, {
          topicId: id, companyId, title: topic.title ?? null, turns, source: 'user',
          guard: { claimedAt: claim.claimedAt, summarisedAt: claim.summarisedAt },
        }), 'summary')
        if (!result.ok) console.error(`summarise ${id}: ${result.error}`)
      } catch (e) {
        console.error(`summarise ${id} failed:`, e)
      } finally {
        // A success already cleared the claim in its own update; this clears it after a failure or
        // the timeout, and only if it is still ours.
        await releaseTopic(db, id, 'summary', claim.claimedAt)
      }
    })

    return NextResponse.json({ status: 'started' }, { status: 202 })
  } catch (e) {
    console.error('POST /api/topics/[id]/summarise failed:', e)
    return NextResponse.json(
      { error: 'That conversation could not be summarised just now. Please try again.' },
      { status: 500 },
    )
  }
}
