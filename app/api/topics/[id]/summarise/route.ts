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
 * IT DOES NOT STAMP `delete_after`. Asking for a summary is not asking for the transcript to be
 * cleared in seven days — the person is still working in that conversation. The nightly job sets
 * the clock when it summarises an IDLE topic, which is the state the seven days were reasoned
 * about. Nor does it extract fact proposals: that is the overnight reader's job (§108), and doing
 * it here would put an inference in front of somebody who asked for a summary.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { askAIJson } from '@/lib/ai'
import { loadTurns } from '@/lib/conversation'
import { SUMMARISE_PROMPT } from '@/prompts/summarise'
// THE SUMMARY IS ARCHIVED; THE TRANSCRIPT IS NOT. A turn that says its own citations were
// never retrieved (§127) would be summarised as fact and outlive the evidence that refutes it,
// so each answer reaches the summariser with the sources its `[n]` markers point at.
import { appendSources } from '@/lib/historySources'

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

    const transcript = turns
      .map((t) => appendSources(
        `${t.role === 'user' ? 'USER' : 'ANSWER'}${t.stopped ? ' (stopped)' : ''}` +
        // An attachment is part of what the conversation was about, and the summary
        // is what outlives the transcript. §129.
        `${t.document_name ? ` [attached the file: ${t.document_name}]` : ''}: ${t.text}`,
        t.sources,
      ))
      .join('\n\n')

    // The SAME prompt the nightly reader uses. One definition — a second "summarise on demand"
    // prompt would drift from it, and the two summaries would then read differently for no
    // reason a customer could see.
    const result = await askAIJson<{ summary?: string }>(
      SUMMARISE_PROMPT,
      `Conversation title: ${topic.title ?? '(none)'}\n\n${transcript}`,
      { maxTokens: 4000, task: 'summary', ledger: { companyId, task: 'summarise' } },
    )
    const summary = String(result?.summary ?? '').trim()
    if (!summary) throw new Error('the model returned no summary')

    // `authenticated` holds UPDATE on `topics`, so this is the caller's own write under RLS —
    // no service role needed.
    const { error: uErr } = await db.from('topics').update({
      summary,
      summarised_at: new Date().toISOString(),
      summary_source: 'user',
    }).eq('id', id)
    if (uErr) throw new Error(uErr.message)

    return NextResponse.json({ summary, summary_source: 'user' })
  } catch (e) {
    console.error('POST /api/topics/[id]/summarise failed:', e)
    return NextResponse.json(
      { error: 'That conversation could not be summarised just now. Please try again.' },
      { status: 500 },
    )
  }
}
