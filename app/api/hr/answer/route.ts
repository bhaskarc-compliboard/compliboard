// THE HR ANSWER — HR Step 6a (`docs/HR-PLAN.md` decisions 3, 4, 9, 10, 12, 20, 32; the Step 6 design).
//
// A question about the company's handbooks: the handbooks' own text (`lib/hrAnswer.ts`), the company context
// (decision 10), web search for the rule at the agency, streamed as the workspace streams
// (`app/api/chat/route.ts`, the open research path), saved as a topic with section 'hr'. AT DONE, ON THE
// SERVER, every handbook quote and every web link is checked in code before anything is shown or stored.
//
// *** BEHIND THE PREVIEW SWITCH. *** 404 unless HR_PREVIEW=1 (decision 32), before the session is read.
// The old app/api/hr/route.ts is left alone until the polish step.
import { NextRequest, NextResponse, connection } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { hrPreviewOn } from '@/lib/hrPreview'
import { askAIOpenStream, type OpenMessage, type Source } from '@/lib/ai'
import { buildCompanyContext } from '@/lib/companyContext'
import { nextPosition, saveUserTurn, saveAssistantTurn, markTurnStopped, loadTurns, setTitleIfFirst,
         titleFromQuestion, bumpCounter } from '@/lib/conversation'
import { loadHandbooksForAnswer, handbookContext, finishAnswer, appendHandbookSources, noCheckYet,
         type HrSource } from '@/lib/hrAnswer'
import { quotesDroppedLine, uncheckedQuotesLine, linksDroppedLine, overBudgetLine, DAY1_LINE } from '@/lib/hrAnswerWords'
import { HR_ANSWER_PROMPT, hrAnswerMessage } from '@/prompts/hr-answer'

export const maxDuration = 800

/** The workspace's own failed line, copied exactly (`app/api/chat/route.ts`, the open research stream). */
const FAILED_LINE = 'The answer stopped part-way through. Please try again.'

export async function POST(request: NextRequest) {
  await connection()
  if (!hrPreviewOn()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const body = await request.json().catch(() => ({}))
    const question = String(body?.question ?? '').trim()
    const topicIdIn = typeof body?.topicId === 'string' ? body.topicId : ''
    let history: Array<{ question?: string; answer?: string; sources?: Source[] }> = Array.isArray(body?.history) ? body.history : []
    if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 })

    // A conversation being continued must be this company's, an HR one, and open. 404 for anything else,
    // so ids cannot be probed (CLAUDE.md §3.6).
    if (topicIdIn) {
      const { data: t } = await db.from('topics').select('id, status, section').eq('id', topicIdIn).eq('company_id', companyId).maybeSingle()
      if (!t || t.section !== 'hr') return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      if (t.status !== 'open') return NextResponse.json({ error: 'This topic is closed. Ask your question again and we’ll open a new one.' }, { status: 409 })
    }

    // ---- THE HANDBOOKS, and the three refusals: no model call, nothing saved ----
    const loaded = await loadHandbooksForAnswer(db, companyId)
    if (!loaded.ok) return NextResponse.json({ outcome: 'refused', message: loaded.refusal })

    const companyBlock = (await buildCompanyContext(db, companyId, { parts: ['company', 'declared', 'confirmed'] })).block
    const message = hrAnswerMessage(companyBlock, handbookContext(loaded), question)

    // ---- THE TOPIC (section 'hr') AND THE QUESTION, saved before the answer is known ----
    let topicId: string | null = topicIdIn || null
    let userTurnId: string | null = null
    let answerPosition = 0
    try {
      if (!topicId) {
        const { data: created, error } = await db.from('topics')
          .insert({ company_id: companyId, title: titleFromQuestion(question), section: 'hr' }).select('id').single()
        if (error) throw new Error(error.message)
        topicId = created.id as string
      }
      const pos = await nextPosition(db, topicId)
      userTurnId = await saveUserTurn(db, { topicId, companyId, text: question, position: pos })
      answerPosition = pos + 1
      await setTitleIfFirst(db, topicId, question)
    } catch (e) {
      console.error('hr answer: conversation not persisted (the answer still runs):', e)
      topicId = null
    }

    // ---- HISTORY: the client's, or the stored turns; every earlier answer carries its sources ----
    if (!history.length && topicIdIn) {
      try {
        const stored = await loadTurns(db, topicIdIn)
        const pairs: typeof history = []
        for (let i = 0; i < stored.length; i++) {
          const t = stored[i]
          if (t.role !== 'user' || t.stopped) continue
          const next = stored[i + 1]
          if (next && next.role === 'assistant' && next.position !== answerPosition) {
            pairs.push({ question: t.text, answer: next.text, sources: next.sources ?? [] })
          }
        }
        history = pairs
      } catch (e) { console.error('hr answer: could not load stored turns for history:', e) }
    }
    const messages: OpenMessage[] = []
    for (const h of history) {
      const q = String(h?.question ?? '').trim()
      const a = appendHandbookSources(String(h?.answer ?? '').trim(), h?.sources as never)
      if (!q || !a) continue
      messages.push({ role: 'user', content: q }, { role: 'assistant', content: a })
    }
    messages.push({ role: 'user', content: message })

    const usedIds = loaded.used.map((u) => u.id)
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'))
        let completed = false
        try {
          // THE FIRST STAGE IS TRUE: these handbooks were loaded and are what the model is given.
          send({ type: 'reading', handbooks: loaded.used.map((u) => ({ name: u.name, pages: u.pages })) })
          for await (const ev of askAIOpenStream(HR_ANSWER_PROMPT, messages,
                       { task: 'hr', maxTokens: 16000, signal: request.signal, ledger: { companyId, task: 'hr' } })) {
            if (ev.type === 'done') {
              let raw = ev.answer.text
              // TEST PATH ONLY (never on production): one quote that is in no handbook, to prove it is dropped.
              if (process.env.NODE_ENV !== 'production' && process.env.HR_TEST_BAD_QUOTE === '1') {
                raw += ` [H1: "these exact words appear nowhere in any of the handbooks"]`
              }
              // TEST PATH ONLY (never on production): the first marked quote made PLAIN, and one plain false quote.
              if (process.env.NODE_ENV !== 'production' && process.env.HR_TEST_PLAIN_QUOTES === '1') {
                raw = raw.replace(/\[H\d+:\s*["“]([^"”\]]*)["”]\]/, '"$1"')
                raw += `\n\nThe handbook also says "every employee receives unlimited paid vacation days each and every year".`
              }
              const done = finishAnswer(raw, ev.answer.sources, ev.searched, loaded.blocks, loaded.used, ev.cited)
              const lines = [
                done.droppedQuotes ? quotesDroppedLine(done.droppedQuotes) : '',
                done.uncheckedQuotes ? uncheckedQuotesLine(done.uncheckedQuotes) : '',
                done.droppedLinks ? linksDroppedLine(done.droppedLinks) : '',
                ...loaded.overBudget.map(overBudgetLine),
                (await noCheckYet(db, usedIds)) ? DAY1_LINE : '',
              ].filter(Boolean)
              const text = [done.text.trim(), ...lines].join('\n\n')
              completed = true
              send({ type: 'done', research: text, sources: done.sources, topicId })
              console.log(`hr answer: ${done.sources.length} source(s), ${done.droppedQuotes} quote(s) dropped, ${done.uncheckedQuotes} unchecked, ${done.droppedLinks} link(s) dropped, ${ev.cited.length} cited passage(s)`)
              if (topicId) {
                await saveAssistantTurn(db, { topicId, companyId, text, sources: done.sources as HrSource[], position: answerPosition })
              }
              // Decision 9: an HR answer counts as an answered question.
              try { await bumpCounter(supabaseAdmin, companyId, 'questions_answered') }
              catch (e) { console.error('hr answer: counter not incremented:', e) }
            } else if (ev.type === 'error') {
              // Never the provider's own words: the workspace's line, the details in the log.
              console.error('hr answer: stream error:', ev.message)
              send({ type: 'error', message: FAILED_LINE })
            } else {
              send(ev)
            }
          }
        } catch (err) {
          const aborted = request.signal.aborted || (err as { name?: string })?.name === 'AbortError'
          if (!aborted) { console.error('hr answer: stream failed:', err); send({ type: 'error', message: FAILED_LINE }) }
        } finally {
          if (!completed && userTurnId) {
            try { await markTurnStopped(supabaseAdmin, userTurnId) } catch (e) { console.error('hr answer: could not mark the turn stopped:', e) }
          }
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
    })
  } catch (error) {
    console.error('hr answer failed:', error)
    return NextResponse.json({ error: FAILED_LINE }, { status: 500 })
  }
}
