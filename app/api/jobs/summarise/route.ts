/**
 * THE NIGHTLY SUMMARISER — `DECISIONS.md` §108, §125. Run 2 Task 4.
 *
 * For every conversation that has gone quiet: write the summary report and read candidate company
 * facts out of it as PROPOSALS — through `summariseTopic` (`lib/summaryReport.ts`), the writer the
 * person's own "Summarise this conversation" uses (Workspace Task 5).
 *
 * *** IT NO LONGER STAMPS `delete_after` — Workspace Task 2. *** Clearing is 12 months after the
 * last turn, computed from `last_turn_at` by `lib/retention.ts`, and the deleter reads that. The
 * 7-day clock this job used to start is gone. What this job still owes the deleter is the SUMMARY:
 * the deleter will not clear a topic whose summary is missing or older than its last turn, and this
 * job's candidate rule (never summarised, or spoken to since) is exactly the set it skips.
 *
 * ---------------------------------------------------------------------------
 * THE TWO RULES THAT ARE EASY TO GET WRONG, STATED BEFORE THE CODE
 *
 * 1. **A USER'S SUMMARY IS NEVER OVERWRITTEN WITHOUT NEW TURNS.** If a person wrote their own
 *    summary and nothing has been said since, this skips the topic entirely. Their words are
 *    worth more than the model's, and quietly replacing them is the kind of loss nobody reports
 *    because nobody sees it happen.
 *
 * 2. **ONE TOPIC FAILING MUST NOT STOP THE OTHERS.** Every topic is its own try/catch and its
 *    own error entry in `job_runs`. A run that processed 40 of 41 topics is a successful run
 *    with one recorded error — not a failed sweep, and not a silent one.
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

export const maxDuration = 800

/** A conversation is idle once nothing has been said for a day. */
const IDLE_HOURS = 24


export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response

  const run = await startJobRun(supabaseAdmin, 'summarise')
  const errors: Array<{ topic: string; error: string }> = []
  let considered = 0, summarised = 0, skippedUserSummary = 0, proposals = 0

  try {
    const idleBefore = new Date(Date.now() - IDLE_HOURS * 3600_000).toISOString()

    // Candidates: idle and never summarised, OR summarised and spoken to since.
    // Two queries rather than one `or(...)`: the second needs a column-to-column comparison
    // (last_turn_at > summarised_at) that PostgREST cannot express, so it is filtered here.
    const { data: never, error: e1 } = await supabaseAdmin
      .from('topics')
      .select('id, company_id, title, summary, summarised_at, summary_source, last_turn_at')
      .is('summarised_at', null)
      .not('last_turn_at', 'is', null)
      .lt('last_turn_at', idleBefore)
    if (e1) throw new Error(`could not list unsummarised topics: ${e1.message}`)

    const { data: already, error: e2 } = await supabaseAdmin
      .from('topics')
      .select('id, company_id, title, summary, summarised_at, summary_source, last_turn_at')
      .not('summarised_at', 'is', null)
      .not('last_turn_at', 'is', null)
    if (e2) throw new Error(`could not list summarised topics: ${e2.message}`)

    const stale = (already ?? []).filter(
      (t) => new Date(t.last_turn_at as string) > new Date(t.summarised_at as string))

    const candidates = [...(never ?? []), ...stale]
    considered = candidates.length

    for (const topic of candidates) {
      try {
        // RULE 1, applied before any work is done or any token is spent.
        const hasNewTurns = topic.summarised_at
          && new Date(topic.last_turn_at as string) > new Date(topic.summarised_at as string)
        if (topic.summary_source === 'user' && !hasNewTurns) {
          skippedUserSummary++
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
          errors.push({ topic: topic.id as string, error: 'no turns to summarise (already cleared?)' })
          continue
        }

        // THE SAME WRITER AS "SUMMARISE THIS CONVERSATION" — Workspace Task 5 (`lib/summaryReport.ts`).
        // One call, the 12,000-token limit set there, the same check, the report, its plain text and
        // the title in one update, then the facts proposed with the duplicate guard. Both clients are
        // the service role here: this job has no user session (CLAUDE.md §3.6).
        const result = await summariseTopic(supabaseAdmin, supabaseAdmin, {
          topicId: topic.id as string, companyId: topic.company_id as string,
          title: (topic.title as string | null) ?? null, turns, source: 'nightly',
          extra: { idle_at: topic.last_turn_at, extracted_at: new Date().toISOString() },
        })
        if (!result.ok) throw new Error(result.error)
        proposals += result.proposed

        summarised++
      } catch (e) {
        // RULE 2. This topic failed; the next one still runs.
        errors.push({ topic: String(topic.id), error: e instanceof Error ? e.message : String(e) })
      }
    }
  } catch (e) {
    errors.push({ topic: '(run)', error: e instanceof Error ? e.message : String(e) })
  }

  const counts = { considered, summarised, skipped_user_summary: skippedUserSummary, proposals }
  await run.finish(counts, errors)
  return NextResponse.json({ job: 'summarise', run: run.id, ...counts, errors })
}
