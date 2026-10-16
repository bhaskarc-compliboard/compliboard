/**
 * THE SHARED CHAT ENGINE — Calendar step 10a (decision 28).
 *
 * One answer path for every section that has a chat. It is `app/api/hr/answer/route.ts`'s body
 * with the handbooks taken out of it: the prompt, the context, the stream, the check, the topic,
 * the ledger. What differs between sections is the Brief (`lib/ask/brief.ts`) and nothing else.
 *
 * *** HR IS NOT TOUCHED BY THIS FILE. *** `app/hr` and `app/api/hr` are byte-for-byte unchanged in
 * this step; HR goes on running its own route. Calendar is the engine's first and only customer
 * until after the Calendar's release, when HR, Audits and the Workspace move onto it — that is
 * decision 28, and it is recorded as owed in `HANDOFF-CODE.md` §7 so the copies do not become
 * permanent.
 *
 * WHAT IS LIFTED, AND WHAT IS DELIBERATELY LEFT BEHIND:
 *
 *   lifted   the topic rules (this company's, this section's, open), the question saved before the
 *            answer is known, history rebuilt from stored turns with each answer's sources put
 *            back, the streamed call through `lib/ai.ts` with web search as HR has it, the check
 *            at done, the turn saved with its record, the counter, the ledger row, and the
 *            stopped-turn rule in the `finally`.
 *   left     everything about handbooks: the three refusals, the wait for a reading, the
 *            selection call for a long handbook, the check record's handbook fields. They are
 *            HR's and they stay in HR's files. The engine's equivalent is the brief's
 *            `packContext`, which answers "what is this question answered from" for any section.
 *
 * *** THE CLAIM + after() PATTERN IS NOT HERE, AND THAT IS A CORRECTION TO THE BRIEF. ***
 * The step 10a brief asks for "the same claim + after() shape as HR" for the answer. HR's ANSWER
 * does not have it: `app/api/hr/answer/route.ts:28` opens a stream and writes the turn inside the
 * request (`maxDuration = 800`), because the person is watching the words arrive. The claim and
 * `after()` belong to the SUMMARY (`app/api/hr/topics/[id]/summarise/route.ts:46`, `lib/topicClaim.ts`),
 * where nobody is waiting and a second press would pay twice — and `summarise` below keeps exactly
 * that shape. Copying the claim onto the answer would mean a person could not ask a second
 * question while the first was still writing.
 */
import { askAIOpenStream, searchLimit, type OpenMessage, type Source, type CitedPassage } from '../ai.ts'
import { buildCompanyContext } from '../companyContext.ts'
import {
  nextPosition, saveUserTurn, saveAssistantTurn, markTurnStopped, loadTurns, setTitleIfFirst,
  titleFromQuestion, bumpCounter,
} from '../conversation.ts'
import { summariseTopic } from '../summaryReport.ts'
import { askPrompt } from '../../prompts/ask.ts'
import { checkBrief, type Brief, type ContextBlock, type Db } from './brief.ts'
import { finishAnswer, appendSources, tokensOf, type AskSource, type Passage } from './passages.ts'
import { parseOffers, offerLine, type Offer } from './offers.ts'

/** The workspace's own failed line, which HR copied and this copies from HR. */
export const FAILED_LINE = 'The answer stopped part-way through. Please try again.'

export interface AskContext {
  /** The CALLER'S own client: RLS applies, and no function here ever names a company (§3.6). */
  db: Db
  /** The service role, for the two named statements HR uses it for: the counter and a stopped turn. */
  admin: Db
  companyId: string
  question: string
  /** A conversation being continued, or nothing for a new one. */
  topicId?: string | null
  history?: Array<{ question?: string; answer?: string; sources?: AskSource[] }>
  signal?: AbortSignal
}

export type AskEvent =
  | { type: 'context'; blocks: Array<Omit<ContextBlock, 'text'>>; tokens: number }
  | { type: 'text'; text: string }
  | { type: 'reset' }
  | { type: 'searching'; query: string | null }
  | { type: 'done'; text: string; sources: AskSource[]; offers: Offer[]; topicId: string | null }
  | { type: 'error'; message: string }
  /** The engine refused before any model call: the route turns it into this status. */
  | { type: 'refused'; status: number; message: string }

/**
 * ONE ANSWER. An async generator, as `askAIOpenStream` is, so the route is a loop and nothing
 * about streaming lives in the section.
 */
export async function* answer(brief: Brief, ctx: AskContext): AsyncGenerator<AskEvent> {
  checkBrief(brief)
  const { db, admin, companyId, question } = ctx

  // ---- A CONVERSATION BEING CONTINUED MUST BE THIS COMPANY'S, THIS SECTION'S, AND OPEN ----
  // 404 for anything else, so ids cannot be probed (§3.6). HR's three lines, with the section
  // from the brief instead of the literal 'hr'.
  if (ctx.topicId) {
    const { data: t } = await db.from('topics').select('id, status, section')
      .eq('id', ctx.topicId).eq('company_id', companyId).maybeSingle()
    if (!t || t.section !== brief.section) {
      yield { type: 'refused', status: 404, message: 'Conversation not found' }
      return
    }
    if (t.status !== 'open') {
      yield { type: 'refused', status: 409, message: 'This topic is closed. Ask your question again and we’ll open a new one.' }
      return
    }
  }

  // ---- WHAT THE QUESTION IS ANSWERED FROM ----
  const packed = await brief.packContext(db, companyId, question)
  const contextText = packed.blocks.map((b) => b.text).filter(Boolean).join('\n\n')
  const totalTokens = packed.blocks.reduce((n, b) => n + b.tokens, 0)
  yield {
    type: 'context',
    blocks: packed.blocks.map(({ name, chars, tokens, leftOut }) => ({ name, chars, tokens, leftOut })),
    tokens: totalTokens,
  }

  // ---- THE TOPIC AND THE QUESTION, saved before the answer is known ----
  let topicId: string | null = ctx.topicId || null
  let userTurnId: string | null = null
  let answerPosition = 0
  try {
    if (!topicId) {
      const { data: created, error } = await db.from('topics')
        .insert({ company_id: companyId, title: titleFromQuestion(question), section: brief.section })
        .select('id').single()
      if (error) throw new Error(error.message)
      topicId = created.id as string
    }
    const pos = await nextPosition(db, topicId)
    userTurnId = await saveUserTurn(db, { topicId, companyId, text: question, position: pos })
    answerPosition = pos + 1
    await setTitleIfFirst(db, topicId, question)
  } catch (e) {
    // HR's rule: the answer still runs. A conversation that could not be stored is worth less than
    // an answer that was never given.
    console.error(`ask(${brief.section}): conversation not persisted (the answer still runs):`, e)
    topicId = null
  }

  // ---- HISTORY: the caller's, or the stored turns, each answer carrying its sources ----
  let history = ctx.history ?? []
  if (!history.length && ctx.topicId) {
    try {
      const stored = await loadTurns(db, ctx.topicId)
      const pairs: typeof history = []
      for (let i = 0; i < stored.length; i++) {
        const t = stored[i]
        if (t.role !== 'user' || t.stopped) continue
        const next = stored[i + 1]
        if (next && next.role === 'assistant' && next.position !== answerPosition) {
          pairs.push({ question: t.text, answer: next.text, sources: (next.sources ?? []) as unknown as AskSource[] })
        }
      }
      history = pairs
    } catch (e) { console.error(`ask(${brief.section}): could not load stored turns for history:`, e) }
  }
  const messages: OpenMessage[] = []
  for (const h of history) {
    const q = String(h?.question ?? '').trim()
    const a = appendSources(String(h?.answer ?? '').trim(), h?.sources ?? null)
    if (!q || !a) continue
    messages.push({ role: 'user', content: q }, { role: 'assistant', content: a })
  }
  messages.push({ role: 'user', content: `${contextText}\n\nQuestion: ${question}` })

  // ---- THE CALL ----
  const maxSearches = searchLimit('AI_SEARCH_MAX_HR', null) ?? undefined
  let completed = false
  try {
    for await (const ev of askAIOpenStream(askPrompt(brief.promptSentences), messages, {
      task: brief.section === 'calendar' ? 'calendar' : 'hr',
      maxTokens: 16000,
      signal: ctx.signal,
      ledger: { companyId, task: brief.section === 'calendar' ? 'calendar' : 'hr' },
      maxSearches,
    })) {
      if (ev.type === 'done') {
        /**
         * *** THE OFFERS COME OUT FIRST, AND THAT ORDER IS A CORRECTION A REAL RUN FORCED. ***
         *
         * It was the other way round — check the answer, then pull the offers out of the checked
         * text — and the second Haiku run of step 10a lost a perfectly good offer to it. The
         * quote check treats any quoted passage of six words or more as a quote to verify, and an
         * offer block is JSON: its `source_line` is a quoted sentence. The check did exactly what
         * it is for, appended "(we could not find these words in what we have on file)" INSIDE
         * the JSON string, and `JSON.parse` then failed — counted as `notJson`, which is a true
         * count of a self-inflicted wound.
         *
         * So the blocks are removed before the prose is checked. The offer is not left unchecked
         * by this: `parseOffers` runs the SAME `findReturned` on its `source_url` that the link
         * check runs on a citation (`lib/ask/offers.ts`).
         */
        const parsed = parseOffers(ev.answer.text, brief.offers, ev.searched)
        const checked = finishAnswer(parsed.text, ev.answer.sources as Source[], ev.searched,
          packed.passages, ev.cited as CitedPassage[])
        let text = checked.text
        if (brief.extraStep) {
          // HR's agency check, when HR moves over. Calendar passes none.
          try {
            const extra = await brief.extraStep({ text, companyId })
            if (extra) text = `${text}\n\n${extra}`
          } catch (e) { console.error(`ask(${brief.section}): the extra step failed (the answer stands):`, e) }
        }
        completed = true
        console.log(`ask(${brief.section}): ${checked.sources.length} source(s), ${checked.droppedQuotes} quote(s) dropped, `
          + `${checked.notFound} quote(s) found in nothing, ${checked.droppedLinks} link(s) dropped, ${offerLine(parsed)}`)
        yield { type: 'done', text, sources: checked.sources, offers: parsed.offers, topicId }
        if (topicId) {
          try {
            await saveAssistantTurn(db, {
              topicId, companyId, text, position: answerPosition,
              sources: checked.sources as unknown as Array<Source & Record<string, unknown>>,
              // WHAT THE ANSWER WAS GIVEN AND WHAT THE CHECK DID, stored beside the answer — HR's
              // `check_record` (migration 069), with the blocks in place of the handbooks.
              checkRecord: {
                section: brief.section,
                context: packed.blocks.map((b) => ({ name: b.name, chars: b.chars, tokens: b.tokens, left_out: b.leftOut })),
                context_tokens: totalTokens,
                passages: packed.passages.length,
                searched: ev.searched.map((s) => s.url),
                dropped_quotes: checked.droppedQuotes,
                quotes_found_in_nothing: checked.notFound,
                dropped_links: checked.droppedLinks,
                offers: parsed.offers.length,
                offers_dropped: parsed.dropped,
              },
            })
          } catch (e) { console.error(`ask(${brief.section}): the answer was not stored:`, e) }
        }
        try { await bumpCounter(admin, companyId, 'questions_answered') }
        catch (e) { console.error(`ask(${brief.section}): counter not incremented:`, e) }
      } else if (ev.type === 'error') {
        if (ctx.signal?.aborted) { console.log(`ask(${brief.section}): stopped by the person`); continue }
        console.error(`ask(${brief.section}): stream error:`, ev.message)
        yield { type: 'error', message: FAILED_LINE }
      } else if (ev.type === 'text' || ev.type === 'reset' || ev.type === 'searching') {
        yield ev
      }
    }
  } catch (err) {
    const aborted = ctx.signal?.aborted || (err as { name?: string })?.name === 'AbortError'
    if (!aborted) { console.error(`ask(${brief.section}): stream failed:`, err); yield { type: 'error', message: FAILED_LINE } }
    else console.log(`ask(${brief.section}): stopped by the person`)
  } finally {
    if (!completed && userTurnId) {
      try { await markTurnStopped(admin, userTurnId) }
      catch (e) { console.error(`ask(${brief.section}): could not mark the turn stopped:`, e) }
    }
  }
}

/**
 * "SUMMARISE THIS CONVERSATION" — the workspace's writer, which HR already shares
 * (`lib/summaryReport.ts` `summariseTopic`). The engine adds nothing to it: the claim, the 202 and
 * the `after()` stay in the route, exactly as `app/api/hr/topics/[id]/summarise/route.ts` has them,
 * because that is where `after()` can be called.
 *
 * *** HR'S `kind: 'hr'` IS NOT CALENDAR'S. *** That kind exists for handbook cards and HR's own
 * wording; a Calendar conversation has neither, so it takes the workspace's shape — which is what
 * `kind` absent means. Passing 'hr' would put "What to change" over a list of dates.
 */
export function summaryKindFor(section: Brief['section']): 'hr' | undefined {
  return section === 'hr' ? 'hr' : undefined
}

export async function summarise(db: Db, admin: Db, args: {
  section: Brief['section']
  topicId: string; companyId: string; title: string | null
  turns: Parameters<typeof summariseTopic>[2]['turns']
  source: 'user' | 'nightly'
  guard: { claimedAt: string; summarisedAt: string | null }
}) {
  return summariseTopic(db, admin, {
    topicId: args.topicId, companyId: args.companyId, title: args.title, turns: args.turns,
    source: args.source, guard: args.guard, kind: summaryKindFor(args.section),
  })
}

/** The company block every section's chat sends, in the three parts HR sends. */
export async function companyBlock(db: Db, companyId: string): Promise<ContextBlock> {
  const text = (await buildCompanyContext(db, companyId, { parts: ['company', 'declared', 'confirmed'] })).block
  const body = `About the company:\n${text}`
  return { name: 'the company', text: body, chars: body.length, tokens: tokensOf(body), leftOut: null }
}

export type { Passage }
