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
import {
  askAIOpenStream, searchLimit,
  type AITask, type SectionSearchCap, type OpenMessage, type Source, type CitedPassage,
} from '../ai.ts'
import type { LedgerTask } from '../costLedger.ts'
import type { TopicSection } from '../topicList.ts'
import { buildCompanyContext } from '../companyContext.ts'
import {
  nextPosition, saveUserTurn, saveAssistantTurn, markTurnStopped, loadTurns, setTitleIfFirst,
  titleFromQuestion, bumpCounter,
} from '../conversation.ts'
import { summariseTopic } from '../summaryReport.ts'
import { PLAIN_AS_OF } from '../summaryWords.ts'
import { loadAttachedDocument, describeAttachments, loadTopicAttachments, MAX_CARRIED_DOCUMENTS } from '../attachedDocument.ts'
import { askPrompt } from '../../prompts/ask.ts'
import { checkBrief, type Brief, type ContextBlock, type Db } from './brief.ts'
import { finishAnswer, appendSources, passagesNamed, tokensOf, ATTACHED_PREFIX, type AskSource, type Passage } from './passages.ts'
import { parseOffers, offerLine, type Offer } from './offers.ts'

/** The workspace's own failed line, which HR copied and this copies from HR. */
export const FAILED_LINE = 'The answer stopped part-way through. Please try again.'

/**
 * *** WHICH TIER, WHICH LEDGER WORD, AND WHICH SEARCH CAP A SECTION RUNS ON. ***
 * `docs/GAPS-PLAN.md` Part A step 1, decision 11.
 *
 * This replaced three lines that read `brief.section === 'calendar' ? 'calendar' : 'hr'` twice and
 * `AI_SEARCH_MAX_HR` once. Every one of them was wrong for any section but those two: a third
 * section's answers would have been billed to HR, run on HR's tier, and capped by HR's variable —
 * and none of that would have shown up as an error, only as a wrong line in `npm run cost` and a
 * model nobody chose.
 *
 * *** THE TASK IS BOTH A TIER AND A LEDGER WORD, AND THE TYPE SAYS SO. *** `AITask & LedgerTask` is
 * the words that are in both unions, so a section whose word exists in only one of them does not
 * compile. That is the pairing `lib/ai.ts:122`'s note is about — the most expensive call in the
 * product once ran on a tier no variable could steer because the two lists had drifted apart.
 *
 * *** A SECTION WITH NO CHAT IS ABSENT, NOT DEFAULTED. *** `workspace` is a `TopicSection` and has
 * no row here: it runs `/api/chat`, which is the owner's open baseline and is not moved
 * (`docs/GAPS-PLAN.md` decision 2). Giving it a row would be inventing a tier for a section that
 * does not use this engine. `sectionRuns` therefore THROWS rather than falling back, for the reason
 * `checkBrief` throws: the engine would otherwise run and quietly bill somebody else's section.
 */
export interface SectionRun {
  task: AITask & LedgerTask
  cap: SectionSearchCap
}

const SECTION_RUNS: Partial<Record<TopicSection, SectionRun>> = {
  hr:          { task: 'hr',          cap: 'AI_SEARCH_MAX_HR' },
  calendar:    { task: 'calendar',    cap: 'AI_SEARCH_MAX_CALENDAR' },
  documents:   { task: 'documents',   cap: 'AI_SEARCH_MAX_DOCUMENTS' },
  audits_chat: { task: 'audits_chat', cap: 'AI_SEARCH_MAX_AUDITS_CHAT' },
}

export function sectionRuns(section: TopicSection): SectionRun {
  const run = SECTION_RUNS[section]
  if (!run) {
    throw new Error(`ask: the section '${section}' has no model tier, ledger task or search cap. `
      + 'Add one to SECTION_RUNS in lib/ask/engine.ts, with its word in AITask and in LedgerTask, '
      + 'or that section must not use this engine (docs/GAPS-PLAN.md decision 11).')
  }
  return run
}

/**
 * WHAT A CONVERSATION IS CARRYING, once `lib/attachedDocument.ts` has been asked. Pure data, so
 * the two functions below can be tested without a database and without a model — which is the only
 * way to test them at all, since the runner cannot mock modules (`scripts/test-guard.js:254`).
 */
/**
 * One carried file, as the engine needs it: the blocks go to the model, the text does not.
 * `text` is `lib/attachedDocument.ts`'s field and is `''` for an image or a photographed page.
 */
export interface CarriedFile {
  id?: string
  name?: string
  blocks: Array<Record<string, unknown>>
  text?: string
}

export interface CarriedFiles {
  /** The file attached on THIS turn, or null. The shape `loadAttachedDocument` returns. */
  attached: (CarriedFile & { id: string; name: string }) | null
  /** The files attached on EARLIER turns, newest first, already capped. */
  documents: CarriedFile[]
  /** How many earlier files the cap left out. */
  omitted: number
  /** One line per earlier file — `describeAttachments`. '' when there are none. */
  priorAttachments: string
  /** An id was given and the file could not be loaded. */
  askedForButMissing: boolean
}

export const NO_CARRIED_FILES: CarriedFiles = {
  attached: null, documents: [], omitted: 0, priorAttachments: '', askedForButMissing: false,
}

/** Every carried file, this turn's first — the order `lastUserMessage` puts their blocks in. */
export const carriedList = (c: CarriedFiles): CarriedFile[] =>
  [...(c.attached ? [c.attached] : []), ...c.documents]

/**
 * *** A QUOTE FROM AN ATTACHED FILE CAN BE CHECKED — the owner, 2 November 2026
 * (`docs/GAPS-PLAN.md` decision 22a). ***
 *
 * Found at step 3 and photographed at `shots/step3-bubble.png`: the check compares a quote against
 * the passages a section's brief packed, an attached file contributed none, so a quote the model
 * took straight out of the PDF was marked *"we could not find these words in what we have on
 * file"* — the product telling a person it cannot find words that are demonstrably there. Honest
 * about what the check could see, and read as a failure.
 *
 * So the file's own extracted text becomes a passage. **It is never sent to the model** — the
 * whole file is already in the message as a `document` block — so this costs nothing.
 *
 * *** EVERY CARRIED FILE GETS ONE, EVEN WITH NOTHING IN IT TO QUOTE. *** `lib/ask/readings.ts`'s
 * second rule, paid for by a real run: a block with no card is a handle naming nothing, and an
 * answer that writes "AF2" at a person then gets the id instead of the file's name. `checkQuote`
 * skips a passage whose text is empty, so an empty one can never match a quote — which is the
 * right answer for a photograph of a page, not a failure (`PENDING.md` D3).
 *
 * The letter is `AF` for every section, and `lib/ask/passages.ts` `ATTACHED_PREFIX` says why it
 * is two letters and not the `A` it was until 3 November 2026 (decision 44).
 */
export function attachedPassages(c: CarriedFiles): Passage[] {
  return carriedList(c).map((f, i) => ({
    id: `${ATTACHED_PREFIX}${i + 1}`,
    title: `${f.name ?? 'The attached file'} — the file you attached`,
    label: 'the file you attached',
    text: (f.text ?? '').trim(),
    href: f.id ? `/documents?document=${f.id}` : null,
    shortName: f.name ?? 'the file you attached',
  }))
}

/**
 * *** AND THE ONES WITH NO TEXT ARE SAID OUT LOUD. *** A scanned PDF is a photograph of a page:
 * the model reads it perfectly well and nothing downstream can check a quote against it, because
 * there is no text to check against (`lib/documentContent.ts:52`–`:68`, `PENDING.md` D3). Rather
 * than let the check mark a true quote as not found, the model is told which files those are.
 * `prompts/documents-answer.ts` `DOCUMENTS_NO_TEXT` is the standing instruction; this is the
 * per-turn fact it needs to apply it.
 *
 * `''` when every carried file has text, and `''` when there are none at all — so a section that
 * never attaches sends byte-for-byte what it sent before (the step 2 and 4a proofs).
 */
export function noTextNote(c: CarriedFiles): string {
  const without = carriedList(c).filter((f) => !(f.text ?? '').trim())
  if (!without.length) return ''
  const named = without.map((f) => f.name).filter(Boolean)
  return `${without.length} attached file(s) carry no text we can read back`
    + (named.length ? ` (${named.join(', ')})` : '')
    + ': they are pictures of pages. Say what they show in your own words and do not quote from them.'
}

/**
 * *** THE ATTACHED FILE IS NAMED IN THE CONTEXT EVENT AND IS NOT PRICED. ***
 *
 * Every other block is measured by `tokensOf` — characters times `TOKENS_PER_CHAR`. A document
 * block is base64 of the file itself: its character count means nothing, and what it really costs
 * is set by the page count and the provider's own document tokenizer, which this codebase cannot
 * compute. So it is reported at 0 and 0, with this comment, rather than given a wrong number.
 *
 * It is reported AT ALL because `check_record` is the record of what an answer was given. A
 * document the model read that the record does not mention is an incomplete record, which is the
 * one thing that record exists to prevent.
 */
export function attachedContextBlock(c: CarriedFiles): Omit<ContextBlock, 'text'> | null {
  if (!c.attached && !c.documents.length) return null
  return {
    name: 'the attached file',
    chars: 0,
    tokens: 0,
    leftOut: c.omitted
      ? `${c.omitted} earlier attachment(s) are not carried: only the ${MAX_CARRIED_DOCUMENTS} most recent are.`
      : null,
  }
}

/**
 * THE LAST MESSAGE, IN THE WORKSPACE'S ORDER (`app/api/chat/route.ts:257`–`:268`): the file just
 * attached, then the files attached earlier in this conversation, then the words.
 *
 * The blocks go IN FRONT of the words because a model reads what it is given in the order it is
 * given it, and the document is the thing the question is about.
 *
 * *** WITH NO ATTACHMENT THIS IS THE SINGLE STRING IT HAS ALWAYS BEEN. *** A section that never
 * attaches sends byte-for-byte what it sent before this step, which is what the step 2 proof
 * compared and what the step 3 proof has to keep true.
 */
export function lastUserMessage(c: CarriedFiles, contextText: string, question: string): OpenMessage {
  const blocks = [...(c.attached?.blocks ?? []), ...c.documents.flatMap((d) => d.blocks)]
  /**
   * *** A NAMED FILE THAT COULD NOT BE RE-READ IS SAID OUT LOUD, NEVER DROPPED. *** §5.1 forbids
   * asserting anything about a document nobody read, and silence here would let the model answer
   * as though no file had been attached — the exact defect §129 closed, arriving one turn later.
   */
  const missing = c.askedForButMissing
    ? 'The user attached a file to this conversation, but it could not be read back just now. '
      + 'Say so rather than answering as though nothing was attached.\n\n'
    : ''
  const omittedNote = c.omitted
    ? `\n\n${c.omitted} earlier attachment(s) are not included in this message because `
      + `only the ${MAX_CARRIED_DOCUMENTS} most recent are carried. Say so if the question depends on them.`
    : ''
  const noText = noTextNote(c)
  const words = missing
    + (c.attached ? `The user has just attached this file: ${c.attached.name}\n\n` : '')
    + (c.priorAttachments ? `${c.priorAttachments}${omittedNote}\n\n` : '')
    + (noText ? `${noText}\n\n` : '')
    + `${contextText}\n\nQuestion: ${question}`
  return blocks.length
    ? { role: 'user', content: [...blocks, { type: 'text', text: words }] }
    : { role: 'user', content: words }
}

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
  /**
   * A FILE THE PERSON JUST ATTACHED, by id — `docs/GAPS-PLAN.md` decision 12.
   *
   * *** IT IS HANDED IN WITH THE REQUEST AND IS NOT A FIELD OF THE BRIEF. *** A brief says what a
   * section KNOWS and what it can OFFER, and those are constants. An attachment is neither: it
   * comes off the body, it changes every turn, and it belongs to the conversation. Putting it on
   * the brief would be `checkBrief`'s sixth kind of difference AND a lie about what a brief is.
   *
   * The id, never the bytes: the screen does not hold the File after a reload, and "reopen a
   * conversation and carry on" has to keep working (`lib/attachedDocument.ts`, §129).
   */
  documentId?: string | null
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

  // ---- THE FILE THIS TURN ATTACHED, AND THE ONES EARLIER TURNS DID ----
  //
  // `app/api/chat/route.ts:205`–`:290` does exactly this for the Compliance Workspace, and this
  // calls the SAME functions rather than a second version of them (`lib/attachedDocument.ts`).
  // The Workspace is not touched: it keeps its own copy of the plumbing around them.
  //
  // *** WHY THE DOCUMENT TRAVELS ON EVERY TURN AND NOT JUST THE FIRST. *** Measured, and written up
  // in `lib/attachedDocument.ts:33`–`:50`: with only the review summary on later turns, a second
  // question made the model RETRACT a true finding, because it read the injected list as the
  // definitive one. A conversation that contradicts its own correct earlier answer is worse than
  // an expensive one. The cost is real and bounded by `MAX_CARRIED_DOCUMENTS`, not hidden.
  const attached = ctx.documentId ? await loadAttachedDocument(db, companyId, ctx.documentId) : null
  if (attached) console.log(`ask(${brief.section}): carrying attached document ${attached.name} as ${attached.kind} blocks`)
  const earlier = ctx.topicId
    ? await loadTopicAttachments(db, companyId, ctx.topicId, attached?.id)
    : { documents: [], omitted: 0 }
  if (earlier.documents.length) {
    console.log(`ask(${brief.section}): carrying ${earlier.documents.length} earlier attachment(s) from topic ${ctx.topicId}`
      + (earlier.omitted ? ` (${earlier.omitted} omitted by the cap)` : ''))
  }
  const files: CarriedFiles = {
    attached: attached
      ? { id: attached.id, name: attached.name, blocks: attached.blocks, text: attached.text }
      : null,
    // The whole shape `loadTopicAttachments` returns, name and text included: the name so the
    // no-text sentence can say WHICH file, the text so a quote from an earlier turn's file is
    // still checkable on this turn. The blocks are the only part the model is sent.
    documents: earlier.documents,
    omitted: earlier.omitted,
    // One line per earlier file: its name and what the reading made of it. Background, never the
    // list of what is wrong — that wording is `lib/attachedDocument.ts`'s and its reason is there.
    priorAttachments: ctx.topicId ? await describeAttachments(db, ctx.topicId) : '',
    askedForButMissing: Boolean(ctx.documentId && !attached),
  }

  // ---- WHAT THE QUESTION IS ANSWERED FROM ----
  const packed = await brief.packContext(db, companyId, question)
  const contextText = packed.blocks.map((b) => b.text).filter(Boolean).join('\n\n')
  const totalTokens = packed.blocks.reduce((n, b) => n + b.tokens, 0)
  /**
   * *** ONE LIST, BUILT ONCE, FOR BOTH THE EVENT AND THE RECORD. ***
   *
   * It was built twice for one run on 2 November and they disagreed: the event named the attached
   * file and `check_record` did not, because the record mapped `packed.blocks` and the attachment
   * is not one of those. Caught by reading the stored row rather than the code — the answer had
   * read a document that its own record did not mention, which is the one thing that record
   * exists to prevent.
   */
  const attachedBlock = attachedContextBlock(files)
  /**
   * *** ONE PASSAGE LIST: THE BRIEF'S, PLUS THE FILES THIS CONVERSATION CARRIES. ***
   * The brief packs what the SECTION knows; the engine adds what the CONVERSATION carries, for
   * every section (decision 22a). Built once here so the check, the dump and `check_record` cannot
   * disagree about what a quote could have been checked against — the same mistake `eventBlocks`
   * above exists to prevent.
   */
  const filePassages = attachedPassages(files)
  const passages = [...packed.passages, ...filePassages]
  const eventBlocks = [
    ...packed.blocks.map(({ name, chars, tokens, leftOut }) => ({ name, chars, tokens, leftOut })),
    ...(attachedBlock ? [attachedBlock] : []),
  ]
  yield { type: 'context', blocks: eventBlocks, tokens: totalTokens }

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
    // THE LINK, PERSISTED (§129). `document_name` is a COPY, so the transcript still reads
    // correctly after the document is deleted — migration 039's whole reason, and the FK is
    // ON DELETE SET NULL for it.
    userTurnId = await saveUserTurn(db, {
      topicId, companyId, text: question, position: pos,
      documentId: attached?.id ?? null, documentName: attached?.name ?? null,
    })
    // The attach usually happens BEFORE the first question, so the `documents` row was written
    // with no topic. Backfill it now that the topic exists, so Documents can say which
    // conversation a file came from. Only where it is null: a file's first conversation keeps it.
    if (attached) {
      await db.from('documents').update({ from_topic_id: topicId })
        .eq('id', attached.id).is('from_topic_id', null)
    }
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
  messages.push(lastUserMessage(files, contextText, question))

  /**
   * *** THE DUMP: HOW A CHAT PROVES ITS INPUT DID NOT MOVE. *** `docs/HOW-WE-BUILD.md` §3c.
   *
   * Off unless `ASK_DUMP_DIR` is set, and never on production. With it set, every call writes the
   * system prompt and the assembled messages to a file, so the same question asked before and
   * after a change can be diffed byte for byte.
   *
   * It was written for Part A step 2 — lifting the chat screen out of the Calendar — and removed
   * at the end of it. Step 3 wanted it again, and step 4a wants it again, which is three times in
   * three steps: it is a tool, not scaffolding, so it stays. The import is dynamic, so nothing is
   * pulled in when the variable is unset.
   */
  if (process.env.ASK_DUMP_DIR && process.env.NODE_ENV !== 'production') {
    try {
      const { writeFileSync, mkdirSync } = await import('node:fs')
      const dir = process.env.ASK_DUMP_DIR
      mkdirSync(dir, { recursive: true })
      const name = `${brief.section}-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`
      writeFileSync(`${dir}/${name}`, JSON.stringify({
        section: brief.section,
        system: askPrompt(brief.promptSentences),
        messages,
        topicId,
        historyTurns: history.length,
        passages: passages.map((p) => ({ id: p.id, label: p.label, chars: p.text.length })),
      }, null, 2))
      console.log(`ask(${brief.section}): dumped the model's input to ${dir}/${name}`)
    } catch (e) { console.error('ask: the dump failed (the answer still runs):', e) }
  }

  // ---- THE CALL ----
  // The section's own tier, its own ledger word and its own search cap — one lookup, used three
  // times, so the three can never disagree. Unset cap means no cap, which is what every chat does
  // today (`lib/ai.ts` `searchLimit`).
  const runs = sectionRuns(brief.section)
  const maxSearches = searchLimit(runs.cap, null) ?? undefined
  let completed = false
  try {
    for await (const ev of askAIOpenStream(askPrompt(brief.promptSentences), messages, {
      task: runs.task,
      maxTokens: 16000,
      signal: ctx.signal,
      ledger: { companyId, task: runs.task },
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
          passages, ev.cited as CitedPassage[])
        /**
         * *** AN ATTACHED FILE IS A SOURCE BECAUSE IT WAS ATTACHED — E2b item 5, decision 62. ***
         *
         * Until now a file became a source only if the answer QUOTED it and the quote checked out.
         * The E2b-check read the cost of that: a person attached an air permit, the answer was
         * about nothing else, and the answer's only source was a web page — because the model
         * wrote *"due 60 days before expiration"* where the permit says *"prior to"*, and
         * `checkQuote` refused the paraphrase. Correctly: the check stays strict (E2b, item 5).
         * What was wrong was the conclusion drawn from it — that the file was not a source at all.
         *
         * So every file this turn CARRIES is recorded as a source whether or not a quote survived:
         * no marker points at it, it carries no quote, and it is drawn as a card that says what it
         * is (`components/AnswerBody.tsx`, the `isOurs` branch).
         *
         * *** CARRIED, NOT "ATTACHED ON THIS TURN", AND THE WALK IS WHY. *** The first build read
         * `files.attached`, which is only the file attached on the turn being answered. In the
         * conversation this was all measured on, the permit was attached on turn 1 and the
         * question that needed it was turn 3 — so the answer that used the permit recorded
         * nothing, which is the defect over again one turn later. `carriedList` is attached plus
         * the files the conversation carries, capped by `MAX_CARRIED_DOCUMENTS`, and every one of
         * them is a file this person put in this conversation.
         *
         * Appended AFTER the cited sources, so every number the model wrote still points where it
         * pointed, and skipped when the answer did cite the file, so it is never listed twice.
         */
        for (const f of carriedList(files)) {
          if (!f.id) continue
          const href = `/documents?document=${f.id}`
          if (checked.sources.some((s) => (s as { href?: string | null }).href === href)) continue
          checked.sources.push({
            n: checked.sources.length + 1, kind: 'passage', url: '',
            title: f.name ?? 'The attached file', label: 'the file you attached', href,
          } as unknown as (typeof checked.sources)[number])
        }
        /**
         * *** AND A DOCUMENT THE ANSWER USED IS A SOURCE TOO — E2d, 5 November 2026. ***
         *
         * E2b closed this for a file the person ATTACHED. It stayed open for the cabinet: read
         * off staging, the Audits conversation "OSHA inspection readiness…" is about one safety
         * data sheet — it names it, says its format is wrong and lists six gaps read out of it —
         * and it stored **no source at all**, because it paraphrased everywhere and quoted
         * nowhere. A summary cannot be better sourced than the conversation under it, so every
         * item of it read "No source cited in the conversation".
         *
         * So a packed document or audit finding the answer NAMES — the product's own name for
         * it, whole, or its file name (`passagesNamed`) — is recorded with no quote and no
         * marker, exactly as the attached file is. `checkQuote` is untouched and still strict:
         * this adds a source, it never turns a refused quote into an accepted one, and the
         * card it draws carries no quote because there is none to show.
         *
         * Appended after the cited sources and after the attached files, and skipped when that
         * address is already a source, so a document the answer DID quote is never listed twice
         * and every number the model wrote still points where it pointed.
         */
        for (const p of passagesNamed(checked.text, passages)) {
          const href = String(p.href)
          if (checked.sources.some((s) => (s as { href?: string | null }).href === href)) continue
          checked.sources.push({
            n: checked.sources.length + 1, kind: 'passage', url: '',
            title: p.title, label: p.label, href, passage_id: p.id, quote: '',
          })
        }
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
                // The SAME list the context event carried, attached file and all.
                context: eventBlocks.map((b) => ({ name: b.name, chars: b.chars, tokens: b.tokens, left_out: b.leftOut })),
                context_tokens: totalTokens,
                passages: passages.length,
                // What an attached file contributed, and how many of those had nothing to quote.
                attached_passages: filePassages.length,
                attached_without_text: filePassages.filter((p) => !p.text).length,
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

/**
 * *** THE SECTIONS WHOSE SUMMARY IS SHOWN THE COMPANY — E2b item 6, §3.1, approved. ***
 *
 * The Workspace is left exactly as it was: its conversations are research about a business the
 * person describes IN them, its as-of line mentions tariffs, and its summary has been measured in
 * that shape (`tests/golden`). HR has its own prompt and its own words. The other three ask about
 * documents, audits and dates the product already holds — and their summaries were saying *"No
 * details about your business came up in this conversation"* about a company whose cabinet the
 * product has read.
 */
const SHOWN_THE_COMPANY: ReadonlyArray<Brief['section']> = ['documents', 'audits_chat', 'calendar']

export async function summarise(db: Db, admin: Db, args: {
  section: Brief['section']
  topicId: string; companyId: string; title: string | null
  turns: Parameters<typeof summariseTopic>[2]['turns']
  source: 'user' | 'nightly'
  guard: { claimedAt: string; summarisedAt: string | null }
}) {
  const shown = SHOWN_THE_COMPANY.includes(args.section)
  /**
   * The SAME block the section's brief sends to the answer — one function, so a summary and the
   * answers it summarises cannot describe the business differently. Each read is wrapped: a
   * summary must not fail because one of these could not be read.
   */
  let about: string | null = null
  let waiting: Array<{ key: string; question: string }> = []
  if (shown) {
    try { about = (await companyBlock(db, args.companyId)).text } catch (e) {
      console.error(`summarise(${args.section}): the company block could not be read (the summary stands):`, e)
    }
    try { waiting = await waitingQuestions(db, args.companyId) } catch (e) {
      console.error(`summarise(${args.section}): the waiting questions could not be read (the summary stands):`, e)
    }
  }
  return summariseTopic(db, admin, {
    topicId: args.topicId, companyId: args.companyId, title: args.title, turns: args.turns,
    source: args.source, guard: args.guard, kind: summaryKindFor(args.section),
    about, waiting, ...(shown ? { asOfLine: PLAIN_AS_OF } : {}),
  })
}

/**
 * *** WHAT COMPANY INFORMATION IS WAITING FOR, AS KEYS — E2b item 2. ***
 *
 * Read the same way `/api/to-confirm` reads it: the pending proposals, one entry per KEY, which is
 * what that page keys a question by and what `POST /api/to-confirm` settles. The words are the
 * key's own, spaced — `app/company-information/page.tsx`'s `keyWords` — because the model needs to
 * recognise the question, not to render it.
 */
async function waitingQuestions(db: Db, companyId: string): Promise<Array<{ key: string; question: string }>> {
  const { data, error } = await db.from('fact_proposals')
    .select('switch_key, proposed_value')
    .eq('company_id', companyId).eq('status', 'proposed').limit(200)
  if (error) throw new Error(error.message)
  const seen = new Set<string>()
  const out: Array<{ key: string; question: string }> = []
  for (const r of (data ?? []) as Array<{ switch_key: string; proposed_value: string | null }>) {
    const key = String(r.switch_key ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ key, question: `${key.replace(/_/g, ' ')} — proposed: ${String(r.proposed_value ?? '').slice(0, 80)}` })
  }
  return out
}

/** The company block every section's chat sends, in the three parts HR sends. */
export async function companyBlock(db: Db, companyId: string): Promise<ContextBlock> {
  const text = (await buildCompanyContext(db, companyId, { parts: ['company', 'declared', 'confirmed'] })).block
  const body = `About the company:\n${text}`
  return { name: 'the company', text: body, chars: body.length, tokens: tokensOf(body), leftOut: null }
}

export type { Passage }
