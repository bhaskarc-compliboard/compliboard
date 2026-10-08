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
import { askAIOpenStream, askAIJson, searchLimit, type OpenMessage, type Source } from '@/lib/ai'
import { buildCompanyContext } from '@/lib/companyContext'
import { nextPosition, saveUserTurn, saveAssistantTurn, markTurnStopped, loadTurns, setTitleIfFirst,
         titleFromQuestion, bumpCounter } from '@/lib/conversation'
import { loadHandbooksForAnswer, handbookContext, finishAnswer, appendHandbookSources, noCheckYet, checkRecord, budgetTokens,
         tableOfContents, safetyNet, chooseSections, addSelected, type HrSource, type Selection } from '@/lib/hrAnswer'
import { quotesDroppedLine, linksDroppedLine, DAY1_LINE, longLine, longNetOnlyLine, longNothingLine,
         waitingWords, waitFailedWords, waitTooLongWords, WAIT_LIMIT_MS } from '@/lib/hrAnswerWords'
import { READ_REASONS } from '@/lib/handbooks'
import { hrAnswerPrompt, hrAnswerMessage } from '@/prompts/hr-answer'
import { HR_SELECT_PROMPT, hrSelectMessage } from '@/prompts/hr-select'

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
    const first = await loadHandbooksForAnswer(db, companyId)
    if (!first.ok) return NextResponse.json({ outcome: 'refused', message: first.refusal })

    const companyBlock = (await buildCompanyContext(db, companyId, { parts: ['company', 'declared', 'confirmed'] })).block

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

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'))
        let completed = false
        /** Ends the request without an answer: the words go to the page, and the turn is marked not answered. */
        const notAnswered = (words: string) => { console.log(`hr answer: not answered — ${words}`); send({ type: 'not_answered', message: words }) }
        try {
          // ---- THE HONEST WAIT (Step 6c): a handbook too long to send whole whose sections are not found yet ----
          let loaded: Awaited<ReturnType<typeof loadHandbooksForAnswer>> = first
          const waitStart = Date.now()
          while (loaded.ok && loaded.waiting.length) {
            if (request.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
            const { data: rows } = await db.from('handbooks')
              .select('id, status, status_reason, page_count, outline_parts_done, outline_parts_total')
              .in('id', loaded.waiting.map((w) => w.id))
            const list = (rows ?? []) as Array<{ id: string; status: string; status_reason: string | null; page_count: number | null
              outline_parts_done: number | null; outline_parts_total: number | null }>
            const failed = list.find((r) => r.status === 'could_not_read')
            if (failed) { notAnswered(waitFailedWords(failed.status_reason ?? READ_REASONS.ours)); return }
            const still = list.find((r) => r.status !== 'read')
            if (!still) { loaded = await loadHandbooksForAnswer(db, companyId); continue }   // found: split again
            send({ type: 'waiting', words: waitingWords(still.page_count, still.outline_parts_done, still.outline_parts_total) })
            if (Date.now() - waitStart > WAIT_LIMIT_MS) { notAnswered(waitTooLongWords); return }
            await new Promise((r) => setTimeout(r, 2000))
          }
          if (!loaded.ok) { notAnswered(loaded.refusal); return }
          const ready = loaded
          const waitedSeconds = Math.round((Date.now() - waitStart) / 1000)

          // THE FIRST STAGE IS TRUE: these handbooks are what the answer reads (a long one, its chosen sections).
          send({ type: 'reading', handbooks: [...ready.used, ...ready.long].map((u) => ({ name: u.name, pages: u.pages })) })

          // ---- SELECTION (Step 6c): one call for every long handbook, checked and netted in code ----
          let selections: Selection[] = []
          if (ready.long.length) {
            const toc = tableOfContents(ready.long)
            const earlier = history.map((h) => String(h?.question ?? '').trim()).filter(Boolean)
            let picks: string[] | null = null
            try {
              const reply = await askAIJson<{ sections?: unknown }>(HR_SELECT_PROMPT, hrSelectMessage(question, earlier, toc.text),
                { task: 'hr', maxTokens: 2000, ledger: { companyId, task: 'hr' } })
              const named = Array.isArray(reply?.sections) ? reply.sections.filter((x): x is string => typeof x === 'string') : []
              picks = named.some((id) => toc.ids.has(id)) ? named : null      // nothing usable counts as a failure
            } catch (e) { console.error('hr answer: the selection call failed:', e) }
            const net = safetyNet([question, ...earlier].join(' '), ready.long, toc.ids)
            selections = chooseSections(ready.long, toc.ids, picks, net, ready.budget - ready.spent)
            addSelected(ready, selections)
            console.log(`hr answer: selection ${picks ? 'named ' + picks.join(',') : 'FAILED'}; net ${net.join(',') || '—'}; sent `
              + selections.map((x) => `${x.name}: ${x.chosen.map((c) => `${c.title} [${c.by}]`).join('; ')}`).join(' | '))
          }
          const lv = ready
          const usedIds = lv.used.map((u) => u.id)
          const alone = lv.used.length + selections.filter((x) => !x.chosen.length).length === 1
          const nothing = selections.filter((x) => !x.chosen.length).map((x) => x.name)
          const longLines = [
            ...selections.filter((x) => x.chosen.length).map((x) => x.callOk
              ? longLine(x.name, x.chosen.map((c) => c.title), alone) : longNetOnlyLine(x.name, x.chosen.map((c) => c.title), alone)),
            // ONE line for every long handbook that matched nothing (owner, 6c).
            ...(nothing.length ? [longNothingLine(nothing)] : []),
          ]
          messages.push({ role: 'user', content: hrAnswerMessage(companyBlock, handbookContext(lv), question) })
          // AI_SEARCH_MAX_HR (Step 6b): unset means no limit, as before; set, it is the search's max_uses.
          const maxSearches = searchLimit('AI_SEARCH_MAX_HR', null) ?? undefined
          for await (const ev of askAIOpenStream(hrAnswerPrompt(), messages,
                       { task: 'hr', maxTokens: 16000, signal: request.signal, ledger: { companyId, task: 'hr' }, maxSearches })) {
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
              const done = finishAnswer(raw, ev.answer.sources, ev.searched, lv.blocks, lv.used, ev.cited)
              const lines = [
                done.droppedQuotes ? quotesDroppedLine(done.droppedQuotes) : '',
                done.droppedLinks ? linksDroppedLine(done.droppedLinks) : '',
                ...longLines,
                (await noCheckYet(db, usedIds)) ? DAY1_LINE : '',
              ].filter(Boolean)
              const text = [done.text.trim(), ...lines].join('\n\n')
              completed = true
              send({ type: 'done', research: text, sources: done.sources, topicId })
              console.log(`hr answer: ${done.sources.length} source(s), ${done.droppedQuotes} marker quote(s) dropped, ${done.notFoundQuotes} marked not found, ${done.uncheckedQuotes} marked unchecked, ${done.droppedLinks} link(s) dropped, ${ev.cited.length} cited passage(s)`)
              if (topicId) {
                await saveAssistantTurn(db, { topicId, companyId, text, sources: done.sources as HrSource[], position: answerPosition,
                  checkRecord: checkRecord({ used: lv.used, selections, budgetTokens: budgetTokens(),
                    searched: ev.searched, citedPassages: ev.cited.length, done, waitedSeconds }) })
              }
              // Decision 9: an HR answer counts as an answered question.
              try { await bumpCounter(supabaseAdmin, companyId, 'questions_answered') }
              catch (e) { console.error('hr answer: counter not incremented:', e) }
            } else if (ev.type === 'error') {
              // A Stop is the person's, not a failure (owner, 6b answers); a real error is logged as one.
              if (request.signal.aborted) { console.log('hr answer: stopped by the person'); continue }
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
          else console.log('hr answer: stopped by the person')
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
