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
 * is already waiting for this conversation (`proposalsToInsert`).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { loadTurns } from '@/lib/conversation'
// THE SUMMARY IS ARCHIVED; THE TRANSCRIPT IS NOT. Each answer reaches the summariser with its
// sources, now numbered once for the whole conversation (`numberedTranscript`), so a marker always
// points at something (§127).
import { summariseTopic, renderPlainText } from '@/lib/summaryReport'

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

    // THE SUMMARY REPORT — Workspace Task 5. One call returns the report, the title and the facts;
    // `lib/summaryReport.ts` numbers the sources by code, checks what comes back, and writes the
    // report, its plain-text rendering, the title, the date and the source in one update.
    // `db` is the caller (the topic update, under RLS); `supabaseAdmin` only proposes the facts, which
    // `authenticated` may not insert (migration 034) — the named statement is in `summariseTopic`.
    const result = await summariseTopic(db, supabaseAdmin, {
      topicId: id, companyId, title: topic.title ?? null, turns, source: 'user',
    })
    if (!result.ok) {
      // §5.1: the product's failure, said plainly; nothing half-written is shown or stored.
      return NextResponse.json({ error: `${result.error} Nothing was changed. Please try again.` }, { status: 502 })
    }
    const summary = renderPlainText(result.report)

    return NextResponse.json({ summary, summary_report: result.report, title: result.report.title, summary_source: 'user',
      // What the check did to each item's citations: for the person reviewing the report, not shown on screen.
      checks: result.checks, proposed: result.proposed })
  } catch (e) {
    console.error('POST /api/topics/[id]/summarise failed:', e)
    return NextResponse.json(
      { error: 'That conversation could not be summarised just now. Please try again.' },
      { status: 500 },
    )
  }
}
