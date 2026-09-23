/**
 * THE NIGHTLY SUMMARISER — `DECISIONS.md` §108, §125. Run 2 Task 4.
 *
 * For every conversation that has gone quiet: write a summary, read candidate company facts out
 * of it as PROPOSALS, and stamp the date the transcript may be cleared.
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
import { askAIJson } from '@/lib/ai'
import { SUMMARISE_PROMPT } from '@/prompts/summarise'
// THE SUMMARY IS ARCHIVED; THE TRANSCRIPT IS NOT. A turn that says its own citations were
// never retrieved (§127) would be summarised as fact and outlive the evidence that refutes it,
// so each answer reaches the summariser with the sources its `[n]` markers point at.
import { appendSources } from '@/lib/historySources'
import type { Source } from '@/lib/ai'

export const maxDuration = 800

/** Seven days after summarising (§125, superseding §110's fifteen). */
const RETAIN_DAYS = 7
/** A conversation is idle once nothing has been said for a day. */
const IDLE_HOURS = 24

interface ProposedFact { key?: string; value?: string; quote?: string }
interface Summarised { summary?: string; facts?: ProposedFact[] }

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

        const transcript = turns
          .map((t) => appendSources(
            `${t.role === 'user' ? 'USER' : 'ANSWER'}${t.stopped ? ' (stopped)' : ''}` +
            // An attachment is part of what the conversation was about, and the summary
            // is what outlives the transcript. §129.
            `${t.document_name ? ` [attached the file: ${t.document_name}]` : ''}: ${t.text}`,
            t.sources as Source[] | null,
          ))
          .join('\n\n')

        const result = await askAIJson<Summarised>(
          SUMMARISE_PROMPT,
          `Conversation title: ${topic.title ?? '(none)'}\n\n${transcript}`,
          { maxTokens: 4000, task: 'summary',
            ledger: { companyId: topic.company_id as string, task: 'summarise' } },
        )

        const summary = String(result?.summary ?? '').trim()
        if (!summary) throw new Error('the model returned no summary')

        const now = new Date()
        const deleteAfter = new Date(now.getTime() + RETAIN_DAYS * 86400_000)

        const { error: uErr } = await supabaseAdmin.from('topics').update({
          summary,
          summarised_at: now.toISOString(),
          summary_source: 'nightly',
          idle_at: topic.last_turn_at,
          extracted_at: now.toISOString(),
          // THE CLOCK STARTS AT SUMMARISING, NOT AT THE CONVERSATION. The summary is what makes
          // the transcript disposable, so the seven days run from here.
          delete_after: deleteAfter.toISOString(),
        }).eq('id', topic.id)
        if (uErr) throw new Error(`stamping the topic: ${uErr.message}`)

        // PROPOSALS, NEVER FACTS (§108).
        const facts = Array.isArray(result?.facts) ? result.facts : []
        const rows = facts
          .filter((f) => String(f?.key ?? '').trim() && String(f?.value ?? '').trim())
          .map((f) => {
            // The quote is matched back to the turn it came from, so a proposal can be traced.
            // If it matches nothing, the proposal is still written with a null turn — losing a
            // proposal because its provenance is imperfect is the worse trade.
            const q = String(f.quote ?? '').trim()
            const from = q ? turns.find((t) => t.text.includes(q.slice(0, 60))) : undefined
            return {
              company_id: topic.company_id,
              topic_id: topic.id,
              switch_key: String(f.key).trim().slice(0, 120),
              proposed_value: String(f.value).trim().slice(0, 500),
              from_turn_id: from?.id ?? null,
              quote: q ? q.slice(0, 2000) : null,
            }
          })

        if (rows.length) {
          const { error: pErr } = await supabaseAdmin.from('fact_proposals').insert(rows)
          if (pErr) throw new Error(`writing proposals: ${pErr.message}`)
          proposals += rows.length
        }

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
