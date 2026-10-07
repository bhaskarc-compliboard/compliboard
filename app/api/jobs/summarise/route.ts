/**
 * THE NIGHTLY SUMMARISER — `DECISIONS.md` §108, §125. Run 2 Task 4; Workspace Stage 4.
 *
 * For every conversation that has been quiet for 24 hours and either was never summarised or was
 * spoken to after its summary: write the summary report and read candidate company facts out of it
 * as PROPOSALS — through `summariseTopic` (`lib/summaryReport.ts`), the writer the person's own
 * "Summarise this conversation" uses (Workspace Task 5).
 *
 * *** IT NO LONGER STAMPS `delete_after` — Workspace Task 2. *** Clearing is 12 months after the
 * last turn, computed from `last_turn_at` by `lib/retention.ts`, and the deleter reads that. What this
 * job still owes the deleter is the SUMMARY: the deleter will not clear a topic whose summary is
 * missing or older than its last turn.
 *
 * *** IT RUNS AT 03:00 UTC FROM THE CRON RELEASE (Workspace Stage 4 Part 3). *** Vercel's cron calls
 * with GET and `Authorization: Bearer <CRON_SECRET>`; until that release the route answered POST only and
 * every scheduled call was refused (`DECISIONS.md` §154). By hand: POST with `x-cron-secret`.
 *
 * ---------------------------------------------------------------------------
 * THE RULES THAT ARE EASY TO GET WRONG, STATED BEFORE THE CODE
 *
 * 1. **BOTH LISTS WAIT FOR 24 HOURS OF QUIET.** The second list (summarised, then spoken to) had no
 *    quiet rule, so a conversation spoken to five minutes ago was summarised mid-conversation.
 *    The choice is `nightlyCandidates` (`lib/topicClaim.ts`), tested in `tests/unit/topicClaim.test.ts`.
 *
 * 2. **A PERSON'S SUMMARY WITH NOTHING SAID SINCE IS LEFT ALONE, AND COUNTED.** `skipped_user_summary`
 *    counts exactly those. It used to be tested only on topics already chosen for having new turns,
 *    so it could never be anything but 0.
 *
 * 3. **IT CLAIMS EACH TOPIC, AS THE PERSON'S PRESS DOES** (`topics.summary_started_at`, migration 065).
 *    A claim held — somebody pressed Summarise and it is being written — is skipped with a reason.
 *    A summary that landed after this run read its list is skipped before any token is spent.
 *
 * 4. **ITS SAVE IS CONDITIONAL.** `summariseTopic` writes only while this run holds the claim and
 *    `summarised_at` is still what the run read; otherwise nothing is written and the reason goes in
 *    `job_runs.counts.skipped`. A skip is not an error: the conversation has a summary.
 *
 * 5. **ONE TOPIC FAILING MUST NOT STOP THE OTHERS.** Every topic is its own try/catch and its own error
 *    entry in `job_runs`. A run that processed 40 of 41 topics is a successful run with one recorded
 *    error — not a failed sweep, and not a silent one.
 *
 * *** AND IT NEVER WRITES `company_switches`. *** §108: facts inferred from free conversation are
 * proposed to the customer, not written. `fact_proposals` is the only destination.
 * ---------------------------------------------------------------------------
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { supabaseAdmin } from '@/lib/auth'
// THE SUMMARY REPORT — Workspace Task 5. The same writer, prompt and check the person's own
// "Summarise this conversation" uses; each answer reaches it with its sources numbered once (§127).
import { summariseTopic } from '@/lib/summaryReport'
import { claimTopic, releaseTopic, nightlyCandidates, type NightlyTopic } from '@/lib/topicClaim'

export const maxDuration = 800

type Row = NightlyTopic & { company_id: string; title: string | null }

/**
 * VERCEL CRON CALLS WITH GET — `Authorization: Bearer <CRON_SECRET>` (`lib/cronSecret.ts`). The same
 * job as POST, which stays for a person running it by hand with `x-cron-secret`. Workspace Stage 4 Part 3.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response

  const run = await startJobRun(supabaseAdmin, 'summarise')
  const errors: Array<{ topic: string; error: string }> = []
  const skipped: Array<{ topic: string; reason: string }> = []
  let considered = 0, summarised = 0, skippedUserSummary = 0, proposals = 0

  try {
    // Every topic that has been spoken in. Two queries (never summarised, summarised) as before; the
    // choice between them is one pure function, so the rules above are tested rather than described.
    const cols = 'id, company_id, title, summarised_at, summary_source, last_turn_at'
    // WORKSPACE CONVERSATIONS ONLY (HR-PLAN decision 14, HR Step 6a). An HR conversation's handbook sources
    // have no URL, and this writer keeps only sources with one (`lib/summaryReport.ts` gatherSources), so it
    // would drop them silently. HR conversations wait for HR's own writer (step 7).
    const { data: never, error: e1 } = await supabaseAdmin
      .from('topics').select(cols).eq('section', 'workspace').is('summarised_at', null).not('last_turn_at', 'is', null)
    if (e1) throw new Error(`could not list unsummarised topics: ${e1.message}`)
    const { data: already, error: e2 } = await supabaseAdmin
      .from('topics').select(cols).eq('section', 'workspace').not('summarised_at', 'is', null).not('last_turn_at', 'is', null)
    if (e2) throw new Error(`could not list summarised topics: ${e2.message}`)

    const { candidates, userCurrent } = nightlyCandidates(
      [...(never ?? []), ...(already ?? [])] as Row[], Date.now())
    considered = candidates.length
    skippedUserSummary = userCurrent.length   // RULE 2

    for (const topic of candidates) {
      // RULE 3 — the claim, before any work is done or any token is spent.
      let claimedAt: string | null = null
      try {
        const claim = await claimTopic(supabaseAdmin, topic.id, 'summary')
        if (!claim.ok) {
          skipped.push({ topic: topic.id, reason: 'a summary is being written for it right now (claim held)' })
          continue
        }
        claimedAt = claim.claimedAt
        if (claim.summarisedAt !== topic.summarised_at) {
          skipped.push({ topic: topic.id, reason: 'it was summarised after this run read its list' })
          continue
        }

        const { data: turns, error: tErr } = await supabaseAdmin
          .from('turns')
          .select('id, position, role, text, stopped, sources, document_id, document_name')
          .eq('topic_id', topic.id).order('position', { ascending: true })
        if (tErr) throw new Error(`turns: ${tErr.message}`)

        // A topic whose transcript is already gone has nothing to summarise. Stamping it would
        // claim a summary that does not exist; leaving it alone is correct.
        if (!turns || turns.length === 0) {
          errors.push({ topic: topic.id, error: 'no turns to summarise (already cleared?)' })
          continue
        }

        // THE SAME WRITER AS "SUMMARISE THIS CONVERSATION" — Workspace Task 5 (`lib/summaryReport.ts`).
        // Both clients are the service role here: this job has no user session (CLAUDE.md §3.6).
        const result = await summariseTopic(supabaseAdmin, supabaseAdmin, {
          topicId: topic.id, companyId: topic.company_id, title: topic.title ?? null, turns, source: 'nightly',
          extra: { idle_at: topic.last_turn_at, extracted_at: new Date().toISOString() },
          guard: { claimedAt, summarisedAt: topic.summarised_at },   // RULE 4
        })
        if (!result.ok && result.skipped) { skipped.push({ topic: topic.id, reason: result.error }); continue }
        if (!result.ok) throw new Error(result.error)
        proposals += result.proposed
        summarised++
      } catch (e) {
        // RULE 5. This topic failed; the next one still runs.
        errors.push({ topic: topic.id, error: e instanceof Error ? e.message : String(e) })
      } finally {
        // A written summary already cleared the claim; this clears it on every other path, ours only.
        if (claimedAt) await releaseTopic(supabaseAdmin, topic.id, 'summary', claimedAt)
      }
    }
  } catch (e) {
    errors.push({ topic: '(run)', error: e instanceof Error ? e.message : String(e) })
  }

  const counts = { considered, summarised, skipped_user_summary: skippedUserSummary, proposals,
    skipped_count: skipped.length, skipped }
  await run.finish(counts, errors)
  return NextResponse.json({ job: 'summarise', run: run.id, ...counts, errors })
}
