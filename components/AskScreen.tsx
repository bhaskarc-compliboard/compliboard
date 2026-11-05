'use client'
/**
 * THE SHARED CHAT SCREEN — `docs/GAPS-PLAN.md` Part A step 2 (decisions 4, 8, 9).
 *
 * *** THIS IS `components/CalendarAsk.tsx` WITH THE DATES TAKEN OUT OF IT. *** The thread, the
 * bubble, the composer in both states, the examples overlay, the streamed answer, the four endings
 * that matter, the action row and the conversation machinery were all general already; only the
 * offers were ever about the Calendar. The engine was lifted out of HR the same way at Calendar
 * step 10a, and this is the other half of that job: one screen, so a person meets the same chat in
 * every section and no section can drift.
 *
 * *** WHAT A SECTION DECIDES, AND IT IS ONLY THIS: *** its two endpoints, the few sentences that
 * are its own (`words`, `examples`, `thinkingLine`, `attach`), and what an answer may offer
 * (`afterAnswer`). Everything else is here.
 *
 * *** WHICH SENTENCES LIVE HERE, AND WHY THEY ARE NOT ALL IN `words`. *** The step's brief asks for
 * no sentence inside this file except through `words`. Four sentences are a section's own and come
 * that way. The rest — "This answer stopped early.", "Stopped… Ask again, or change the question.",
 * "Try again" — are what the product says in EVERY chat, word for word, today: `app/hr/HrWorkspace.tsx`
 * and `components/CalendarAsk.tsx` carried identical copies before this file existed. Making each
 * section pass them in would be three copies of one sentence, free to drift, which is the thing
 * this lift exists to end. So they are exported constants here: one edit changes every chat, and a
 * test can read them. Said out loud in the step 2 report rather than decided quietly.
 *
 * IMPORTS ONLY TYPES FROM `lib/ask/*`. `lib/ask/engine.ts` imports `lib/ai.ts`, which imports the
 * model SDK, and `tests/unit/clientImports.test.ts` fails the build if any component reaches it.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import type React from 'react'
import { authHeaders } from '@/lib/supabase'
import { AnswerBody, SourceList, type AnswerSource } from '@/components/AnswerBody'
import type { SourceTarget } from '@/lib/sourceTitle'
import { AttachControl } from '@/components/AttachControl'
import { PRIMARY } from '@/components/buttonStyles'
import { readAnswerStream, ndjsonLines } from '@/lib/answerStream'
import { printWithFrame } from '@/lib/printFrame'
import { askAgainLine, type Banner } from '@/lib/billing'
import { checklistHref } from '@/lib/checklistView'
import { CLAIM_WORDS } from '@/lib/topicClaim'
import PausedNote from '@/components/PausedNote'
import type { TopicRow, TopicSection } from '@/lib/topicList'
import type { ExampleQuestion } from '@/config/examples'
import type { Offer } from '@/lib/ask/offers'
import { ACCEPTED_FILE_TYPES } from '@/lib/acceptedFiles'
import { uploadToChat } from '@/lib/chatUpload'

/**
 * THE SENTENCES EVERY CHAT SAYS THE SAME WAY. Moved here character for character from
 * `components/CalendarAsk.tsx:42`–`:43` and the two blocks at `:304`–`:315`, which were already
 * identical to `app/hr/HrWorkspace.tsx:681`–`:704`.
 */
export const FAILED_ASK = 'That answer could not be completed.'
export const STOPPED_EARLY_TITLE = 'This answer stopped early.'
export const STOPPED_EARLY_BODY =
  'The answer stopped before it was finished, so what is above is incomplete. Nothing was saved for it.'
export const TRY_AGAIN = 'Try again'
export const STOPPED_LINE = (hasText: boolean) =>
  `Stopped. ${hasText ? 'What arrived is above — ' : ''}Ask again, or change the question.`
/** The three actions, in the owner's order (decision 8). */
export const ACTION_CHECKLIST = 'Turn this into a checklist'
export const ACTION_CHECKLISTING = CLAIM_WORDS.checklist
export const ACTION_SUMMARISE = 'Summarise this conversation'
export const ACTION_SUMMARISING = 'Writing the summary…'
export const ACTION_DOWNLOAD = 'Download'
/**
 * *** WHAT THE PERSON IS TOLD WHEN THE CHECKLIST LANDS — Part A step 5, decision 8. ***
 *
 * A checklist made from any section's conversation lives in the Compliance Workspace's Checklists
 * tab, and the sentence says so rather than leaving the person to go and look. "open it in the
 * Compliance Workspace" is the link, and it opens THAT checklist, not the tab
 * (`lib/checklistView.ts` `checklistHref`, read by `app/compliance/page.tsx`).
 */
export const CHECKLIST_READY_BEFORE = 'Your checklist is ready — '
export const CHECKLIST_READY_LINK = 'open it in the Compliance Workspace'
export const CHECKLIST_READY = `${CHECKLIST_READY_BEFORE}${CHECKLIST_READY_LINK}`
/** §5.1: a failure says so, says nothing was changed, and says what to do. */
export const CHECKLIST_FAILED =
  'That conversation could not be turned into a checklist. Nothing was changed. Please try again.'
/** What the page says when a conversation could not be opened or summarised. */
export const OPEN_FAILED = 'That conversation could not be opened. Please try again.'
export const SUMMARY_FAILED = 'That conversation could not be summarised just now. Nothing was changed. Please try again.'

/** One question and its answer, in whatever state it has reached. */
export interface Exchange {
  id: string
  question: string
  text: string
  sources: AnswerSource[]
  offers: Offer[]
  phase: 'sending' | 'searching' | 'writing' | 'done' | 'stopped' | 'stopped_early' | 'failed' | 'refused'
  searches: number
  error?: string
  refusal?: string
  /** The HTTP status a failed ask came back with, when it came from a response at all. 402 is
   *  the one that must not be offered "ask again, or rephrase" — `askAgainLine` (§220). */
  failedStatus?: number
  /** Per offer: the row it became (or already was), or the sentence that says it did not. */
  added?: Record<number, { id: string | null; already: boolean; failed?: boolean }>
  /** The file this question was sent with, so the bubble can show it (board 3). */
  file?: { id: string; name: string }
  /** Shown above a 402: the file is saved even though the question was refused. */
  savedNote?: string
}

/**
 * *** WHAT A QUESTION SAYS WHEN THERE ARE NO WORDS, ONLY A FILE. *** The Compliance Workspace's own
 * sentence, `app/api/chat/route.ts:191`, word for word — the same thing a person means when they
 * attach a document and press Send with an empty box, so it should not be a second wording.
 */
export const DEFAULT_FILE_QUESTION =
  'Summarize what this document is, what it covers, and flag anything that looks off, expired, or missing.'

/**
 * *** THE READ-ONLY CASE, AND IT IS TWO DIFFERENT ANSWERS IN ONE MOMENT. *** The file IS saved —
 * uploading calls no model, and no non-model write is gated (`POST /api/documents` has no
 * `requireAccess`; the storage call has no route at all). What is refused is the READING
 * (`/api/document-scan:53`) and the QUESTION. So the screen must not let the 402 read as "your
 * file was lost": it says what did happen before it says what did not.
 *
 * The owner's sentence, pending his yes.
 */
export const PAUSED_FILE_SAVED =
  'Your file is saved in Documents. It will be read, and you can ask about it, once you add a card.'

/** The sentences that are a section's own. Nothing else a person reads comes from the section. */
export interface AskScreenWords {
  /** The docked composer's placeholder. */
  composerHint: string
  /** The button under the empty box on a first visit — HR says "Research this", the Calendar "Ask". */
  firstVisitButton: string
  /** The Conversations tab's empty state, which the page draws. */
  emptyConversations: string
  /** The quiet line under the action row. */
  oneTopicLine: string
}

/** The paperclip, at 11px, the same path `components/AttachControl.tsx` draws at 13. */
const Clip = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" className="shrink-0" aria-hidden="true">
    <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" />
  </svg>
)

export function AskScreen({
  section, endpoints, words, examples, companyName, paused,
  topicId, initial, onTopicId, onChanged, onSummarise, summaryBusy,
  attach, thinkingLine, afterAnswer, onOpenSource,
  canMakeChecklist = false, onMakeChecklist, checklistBusy = false, checklistReadyId = null, beforeAsk,
}: {
  section: TopicSection
  endpoints: { answer: string }
  words: AskScreenWords
  examples: ExampleQuestion[]
  companyName: string | null
  /** Step 18, decision 11. A PROP, not a read of its own — the page already has the verdict. */
  paused: Banner | null
  topicId: string | null
  /** A conversation reopened from the Conversations tab, rebuilt from its stored turns. */
  initial: Exchange[]
  onTopicId: (id: string | null) => void
  /** Re-read the page's own counts: an answer writes a topic, and a section's offer may write a row. */
  onChanged: () => Promise<void> | void
  onSummarise: (topicId: string) => void
  summaryBusy: boolean
  /**
   * THE ATTACH SLOT. A section gives `onPick` to accept files, or `href` to send the person
   * somewhere else. **`onPick` wins when both are given**, because a control that both uploads and
   * navigates is a control whose behaviour depends on which handler fires first
   * (`components/AttachControl.tsx` refuses to draw both for the same reason).
   *
   * `onPick` is called once the file has LANDED in Documents, with its id — so a section can
   * refresh whatever list it keeps. The screen does the upload itself, through `lib/chatUpload.ts`,
   * so every section's files arrive the same way.
   */
  attach: { label: string; href?: string; onPick?: (doc: { id: string; name: string }) => void }
  /** What the grey line says while nothing has arrived — a claim about what is being read, so the
   *  section writes it ("Reading your calendar…"). Never written here. */
  thinkingLine: (x: Exchange) => string
  /** The one part of an answer that is not prose: a section's own offers, under the answer. */
  afterAnswer?: (x: Exchange, patch: (p: Partial<Exchange>) => void) => React.ReactNode
  /**
   * *** A SOURCE CARD'S TITLE OPENS IN PLACE — decision 67, forwarded and nothing more. ***
   * Handed straight to `SourceList`, for the reason `components/ConversationDrawer.tsx` forwards
   * the same thing: the swap belongs to the PAGE, which already holds the reading drawer and the
   * folder list for its own documents. A section that passes nothing keeps today's links.
   */
  onOpenSource?: (target: SourceTarget) => void
  /**
   * *** DECISION 8's FIRST ACTION, WIRED AT PART A STEP 5. ***
   *
   * It stays a prop rather than becoming unconditional, for the reason it was a prop before: a
   * control that does nothing is a promise the product is not keeping (`CLAUDE.md` §5.1). A
   * section turns it on only when it has somewhere for the result to go — which, by decision 8,
   * is the Compliance Workspace's Checklists tab, for every section. Calendar and Documents pass
   * `true`; the default stays `false` so a section added later opts in deliberately.
   */
  canMakeChecklist?: boolean
  /** `useAskConversations().makeChecklist`, which owns the claim, the 202/409 rule and the poll. */
  onMakeChecklist?: (topicId: string) => void
  /** A build going on this conversation — this tab's claim or anyone's. */
  checklistBusy?: boolean
  /** The checklist that just landed for this conversation, so the ready line can link to it. */
  checklistReadyId?: string | null
  /**
   * *** ONE LOOK AT THE SENTENCE BEFORE IT IS SENT — the owner, 3 November 2026
   * (`docs/GAPS-PLAN.md` decision 37). ***
   *
   * The Audits box takes audit COMMANDS as well as questions, and which it is must be decided in
   * CODE and never by a model (decision 32): *"what's missing is a database query and never an AI
   * guess"* is the product's first rule, and a box that asked a model which agency a sentence
   * meant would be guessing at something the database knows. There was nowhere to do it — `ask()`
   * is called from four places inside this file and nothing could get between the press and the
   * fetch — so this is that place.
   *
   * It is handed the question and the file picked on this turn, because the recogniser needs
   * both and `picked` is this component's own state. `'handled'` means the section did something
   * with it: the box and the chip are cleared and nothing is sent. `'ask'`, or no prop at all,
   * behaves exactly as this screen always has.
   *
   * **Three of the four sections pass nothing**, and `tests/unit/askScreen.test.ts` holds that.
   */
  beforeAsk?: (question: string, file: { id: string; name: string } | null) => Promise<'handled' | 'ask'>
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>(initial)
  const [box, setBox] = useState('')
  const [busy, setBusy] = useState(false)
  /** A file picked and not yet sent: the chip above the composer. */
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inFlight = useRef<AbortController | null>(null)
  const seq = useRef(0)
  const started = exchanges.length > 0
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [exchanges.length])
  const patch = (id: string, p: Partial<Exchange>) =>
    setExchanges((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)))

  /** The composer grows with its text, exactly as HR's does. */
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [box])

  /**
   * ONE FILE, UPLOADED THE MOMENT IT IS PICKED — not held until Send.
   *
   * It goes in through Documents' own path (`lib/chatUpload.ts`), so it is safe as soon as it is a
   * row, whatever happens to the question afterwards. That is the same promise the Documents page
   * makes: *"the files are safe the moment they are rows."*
   */
  async function onFilePicked(f: File | null) {
    if (!f) return
    setUploadError(null)
    setUploading(true)
    try {
      const res = await uploadToChat(f, topicId)
      if (!res.ok) { setUploadError(res.message); return }
      setPicked({ id: res.documentId, name: res.name })
      attach.onPick?.({ id: res.documentId, name: res.name })
    } finally {
      setUploading(false)
    }
  }

  async function ask(question: string) {
    // A FILE WITH NO WORDS IS STILL A QUESTION — the Workspace's own sentence for it.
    const q = question.trim() || (picked ? DEFAULT_FILE_QUESTION : '')
    if (!q || busy) { composerRef.current?.focus(); return }
    /**
     * THE SECTION'S OWN LOOK, FIRST AND IN CODE (decision 37). It runs before the box is cleared
     * so a section that refuses can leave the words where the person typed them, and before any
     * row is written so a handled command creates no conversation. A section that passes nothing
     * never reaches this line.
     */
    if (beforeAsk) {
      /**
       * *** AND THE SCREEN IS BUSY WHILE IT LOOKS — 3 November 2026 (`docs/GAPS-PLAN.md` Part B
       * step B0, decision 46; the owner's walk, W3). ***
       *
       * `setBusy(true)` used to be ten lines below, reached only on an `'ask'` verdict, so a
       * section's own look happened with the screen in its resting state: the words stayed in
       * the box, the button still read `firstVisitButton`, and the guard four lines above —
       * `if (!q || busy)` — could not refuse a second press, because `busy` was false. The
       * owner typed an audit command, pressed Enter, saw nothing for the six seconds
       * `POST /api/audit-runs` spent extracting the checklist's lines, pressed Ask, and got
       * **two identical audits**. The second cost $0.4924 on Opus 5.5.
       *
       * On `'ask'` the flag is deliberately LEFT SET: `setBusy(true)` below is then a no-op, so
       * the button never flickers back between the look and the request.
       */
      setBusy(true)
      let verdict: 'handled' | 'ask'
      try {
        verdict = await beforeAsk(q, picked)
      } catch (e) {
        // A section whose own work threw must not leave the screen frozen with the words in it.
        // The throw still escapes, exactly as it did before; only the flag is released.
        setBusy(false)
        throw e
      }
      if (verdict === 'handled') { setBusy(false); setBox(''); setPicked(null); return }
    }
    setBox('')
    const sent = picked
    setPicked(null)
    const id = `x${++seq.current}`
    setExchanges((prev) => [...prev, { id, question: q, text: '', sources: [], offers: [], phase: 'sending', searches: 0,
      ...(sent ? { file: sent } : {}) }])
    setBusy(true)
    const controller = new AbortController()
    inFlight.current = controller
    try {
      const res = await fetch(endpoints.answer, {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }), signal: controller.signal,
        body: JSON.stringify({
          question: q, topicId,
          ...(sent ? { documentId: sent.id } : {}),
          history: exchanges.filter((x) => x.phase === 'done' && x.text)
            .map((x) => ({ question: x.question, answer: x.text, sources: x.sources })),
        }),
      })
      if (!(res.headers.get('content-type') ?? '').includes('x-ndjson')) {
        const json = await res.json().catch(() => null)
        patch(id, {
          phase: 'failed', failedStatus: res.status, error: json?.error ?? FAILED_ASK,
          // A read-only company's file IS saved; only the reading and the question are refused.
          // Saying so first stops the 402 reading as "your file was lost".
          ...(res.status === 402 && sent ? { savedNote: PAUSED_FILE_SAVED } : {}),
        })
        return
      }
      // The two events a section may add ride on the same lines the shared reader consumes —
      // HR taps `reading` and `waiting` the same way.
      let offers: Offer[] = []
      let refusal: string | null = null
      async function* tap(lines: AsyncIterable<string>) {
        for await (const line of lines) {
          try {
            const ev = JSON.parse(line)
            if (ev?.type === 'done' && Array.isArray(ev.offers)) offers = ev.offers as Offer[]
            if (ev?.type === 'refused') refusal = String(ev.message ?? '')
          } catch { /* a half line: the reader skips it too */ }
          yield line
        }
      }
      const outcome = await readAnswerStream(tap(ndjsonLines(res.body!.getReader())),
        (p) => patch(id, { text: p.text, searches: p.searches, phase: p.phase }),
        () => controller.signal.aborted)
      if (refusal) patch(id, { phase: 'refused', refusal })
      else if (outcome.kind === 'done') {
        patch(id, { text: outcome.text, sources: outcome.sources as AnswerSource[], offers, phase: 'done' })
        if (outcome.topicId) onTopicId(outcome.topicId)
      } else if (outcome.kind === 'stopped_by_user') patch(id, { text: outcome.text, phase: 'stopped' })
      else if (outcome.kind === 'stopped_early') patch(id, { text: outcome.text, phase: 'stopped_early' })
      else patch(id, { text: outcome.text, phase: 'failed', error: outcome.message })
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') patch(id, { phase: 'stopped' })
      else patch(id, { phase: 'failed', error: FAILED_ASK })
    } finally {
      inFlight.current = null
      setBusy(false)
      await onChanged()
    }
  }
  const stop = () => { inFlight.current?.abort(); inFlight.current = null }

  const answered = exchanges.some((x) => x.phase === 'done')

  const composer = (docked: boolean) => (
    <div className={docked ? 'no-print mt-8' : 'no-print'}>
      <div className="relative rounded-xl border border-gray-200 bg-white focus-within:border-[var(--green)]">
        <div className="flex items-end gap-2 p-3.5">
          <textarea
            ref={composerRef}
            value={box}
            onChange={(e) => setBox(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(box) } }}
            rows={1}
            placeholder={docked ? words.composerHint : undefined}
            className="max-h-36 min-h-[92px] flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[16px] text-gray-900 outline-none placeholder:text-[16px] placeholder:text-gray-400"
          />
          {docked && (busy ? (
            <button onClick={stop} title="Stop" aria-label="Stop"
              className="rounded-lg bg-gray-900 p-2 text-white hover:bg-gray-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
            </button>
          ) : (
            <button onClick={() => ask(box)} title="Send" aria-label="Send" disabled={!box.trim() || Boolean(paused)}
              className="rounded-lg bg-[var(--green)] p-2 text-white hover:bg-[var(--green-ink)] disabled:opacity-40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          ))}
        </div>
        {/* The examples, as HR and the workspace show them: an overlay, gone the moment anything
            is typed; not clickable, not a prompt, nothing reaches a model. */}
        {!docked && !box && (
          <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-5">
            {examples.map((e) => (
              <p key={e.label} className="truncate text-[14px] text-gray-400">e.g. {e.question}</p>
            ))}
          </div>
        )}
      </div>
      {/* THE PICKED FILE, board 3: a chip above the composer with a × to take it off before
          sending. It sits above because that is where the board puts it, and because a person
          needs to see what is going with the question while they are still typing it. */}
      {picked && (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-700">
            <Clip />
            <span className="truncate">{picked.name}</span>
            <button onClick={() => setPicked(null)} aria-label={`Remove ${picked.name}`}
              className="ml-0.5 shrink-0 text-gray-400 hover:text-gray-700">×</button>
          </span>
        </div>
      )}
      {uploadError && <p className="mt-2 text-[13px] text-amber-900">{uploadError}</p>}

      {/* HR's one line under the box: the attach slot left, the actions right. */}
      <div className="mt-[10px] flex flex-wrap items-center justify-between gap-4">
        <p className="min-w-0 text-[12px] text-gray-500">
          {/* ONE FILE, NEVER A FOLDER (decision 6): no `webkitdirectory` here. A folder takes
              minutes to read and a chat cannot honestly say "wait here"; folders are the
              Documents tab's. The upload is NOT disabled while this company is read-only —
              storing a file calls no model, and the note after the refusal says what happened. */}
          {attach.onPick ? (
            <>
              <input ref={fileInput} type="file" className="hidden" accept={ACCEPTED_FILE_TYPES}
                onChange={(e) => { const f = e.target.files?.[0] ?? null; void onFilePicked(f); e.target.value = '' }} />
              <AttachControl label={uploading ? 'Adding…' : attach.label}
                onClick={() => fileInput.current?.click()} disabled={uploading} />
            </>
          ) : (
            <AttachControl label={attach.label} href={attach.href} />
          )}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-5">
          {docked && topicId && answered && (<>
            {/* THE THREE ACTIONS, IN THE OWNER'S ORDER (decision 8). The first waits for step 5. */}
            {canMakeChecklist && (
              /* `!answered` is already true wherever this row renders (the row itself is gated on
                 it), and the condition is written anyway: the rule — a conversation with no answer
                 has nothing to turn into anything — belongs where it is read, not three lines up
                 in a different condition. */
              <button onClick={() => { if (topicId) onMakeChecklist?.(topicId) }}
                disabled={busy || checklistBusy || !answered || Boolean(paused)}
                className="text-[14px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
                {checklistBusy ? ACTION_CHECKLISTING : ACTION_CHECKLIST}
              </button>
            )}
            <button onClick={() => onSummarise(topicId)} disabled={busy || summaryBusy || Boolean(paused)}
              className="text-[14px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
              {summaryBusy ? ACTION_SUMMARISING : ACTION_SUMMARISE}
            </button>
            <button onClick={() => printWithFrame({ company: companyName ?? '', type: 'Conversation' })}
              disabled={busy} className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300">
              {ACTION_DOWNLOAD}
            </button>
          </>)}
          {!docked && (
            <button className={PRIMARY} onClick={() => ask(box)} disabled={busy || Boolean(paused) || !box.trim()}>
              {busy ? 'Asking…' : words.firstVisitButton}
            </button>
          )}
        </div>
      </div>
      <PausedNote banner={paused} />
      {/*
        *** THE CHECKLIST LANDED, AND IT SAYS WHERE IT WENT. ***
        A checklist made from any section's conversation lives in the Compliance Workspace
        (decision 8), so a person who pressed the button here would otherwise have no idea where
        the result is. The link opens THAT checklist, not the tab — `lib/checklistView.ts`
        `checklistHref`, read by `app/compliance/page.tsx`.
      */}
      {checklistReadyId && (
        <p className="no-print mt-2 text-[13px] text-gray-700">
          {CHECKLIST_READY_BEFORE}
          <a href={checklistHref(checklistReadyId)}
            className="font-medium text-[var(--green-ink)] underline underline-offset-2">
            {CHECKLIST_READY_LINK}
          </a>
        </p>
      )}
      {docked && <p className="mt-2 text-[12px] text-gray-500">{words.oneTopicLine}</p>}
    </div>
  )

  return (
    <div className={started ? 'pt-1' : ''} data-ask-section={section}>
      {exchanges.map((x) => (
        <div key={x.id} className="mb-8">
          <div className="mb-5 flex justify-end">
            <div className="max-w-[85%] rounded-2xl bg-gray-200 px-4 py-3 text-[16px] leading-relaxed text-gray-900">
              {/* The file stays with the question it was asked about — board 3. */}
              {x.file && (
                <p className="mb-1 flex items-center gap-1.5 text-[12px] text-gray-600">
                  <Clip /><span className="truncate">{x.file.name}</span>
                </p>
              )}
              <p>{x.question}</p>
            </div>
          </div>
          {!x.text && (x.phase === 'sending' || x.phase === 'searching' || x.phase === 'writing') && (
            <p className="text-[14px] text-gray-400">{thinkingLine(x)}</p>
          )}
          {x.text && (<>
            <AnswerBody text={x.text} sources={x.sources} />
            {afterAnswer?.(x, (p) => patch(x.id, p))}
            <div className="sources-print"><SourceList sources={x.sources} onOpenSource={onOpenSource} /></div>
          </>)}
          {x.phase === 'refused' && <p className="text-[14px] text-gray-600">{x.refusal}</p>}
          {x.phase === 'stopped_early' && (
            <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
              <b className="font-semibold">{STOPPED_EARLY_TITLE}</b>{' '}
              {STOPPED_EARLY_BODY}
              <button onClick={() => ask(x.question)} className="ml-2 font-medium underline hover:no-underline">{TRY_AGAIN}</button>
            </div>
          )}
          {x.phase === 'stopped' && (
            <p className="mt-2 text-[14px] text-gray-500">{STOPPED_LINE(Boolean(x.text))}</p>
          )}
          {x.phase === 'failed' && (
            <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
              {/* WHAT DID HAPPEN, BEFORE WHAT DID NOT. The file is saved even when the question
                  is refused, and a refusal on its own would read as though it were lost. */}
              {x.savedNote && <p className="mb-1">{x.savedNote}</p>}
              {x.error} {askAgainLine(x.failedStatus)}
              {/* The button goes with the line, for the same reason: "Try again" against a 402
                  offers the one thing that cannot work until a card is added (§220). */}
              {x.failedStatus !== 402 && (
                <button onClick={() => ask(x.question)} className="ml-2 font-medium underline hover:no-underline">{TRY_AGAIN}</button>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
      {composer(started)}
    </div>
  )
}

/**
 * THE CONVERSATION MACHINERY, as a hook — `app/calendar/page.tsx:360`–`:484`, moved whole.
 *
 * *** IT LIVES IN THIS FILE AND NOT IN `lib/`, AND THAT IS THE STEP'S OWN RULE. *** The step may
 * add exactly two files, both components, so a third in `lib/` would be a file nobody agreed to.
 *
 * *** AND IT TAKES THE PAGE'S `topics`, RATHER THAN READING THEM. *** The page reads them once,
 * inside the single `load()` that also fills its counts and its info bar, so a second reader here
 * would be two answers to one question. What the hook needs is a way to re-read them while a
 * summary is being written, which is `reloadTopics`.
 *
 * The one read that DID move is the open conversation's `summary_report`, and it moved into
 * `components/ConversationDrawer.tsx`, which is the only thing that shows it. That is why
 * `tests/unit/calendarShell.test.ts` now names six relations on the page and not seven.
 */
export function useAskConversations({ topics, reloadTopics, summarisePath }: {
  topics: TopicRow[]
  reloadTopics: () => Promise<TopicRow[]>
  /** The section's own summarise route, by topic id. */
  summarisePath: (topicId: string) => string
}) {
  /**
   * `askTopicId` is the open conversation; `askInitial` is what a reopened one's stored turns
   * rebuild into. The screen is keyed on `askKey`, so opening another conversation — or starting a
   * new one — gives it fresh state with nothing to reset.
   */
  const [askTopicId, setAskTopicId] = useState<string | null>(null)
  const [askInitial, setAskInitial] = useState<Exchange[]>([])
  const [askKey, setAskKey] = useState(0)
  const [convDrawer, setConvDrawer] = useState<TopicRow | null>(null)
  const [summaryWait, setSummaryWait] = useState<{ topicId: string; before: string | null } | null>(null)
  /**
   * *** "TURN THIS INTO A CHECKLIST" — Part A step 5, decision 8. ***
   *
   * The same two pieces `summarise` has, and deliberately so: `checklistWait` is this tab's own
   * claim while the build runs, and `checklistReady` is the id once it lands, so the screen can
   * show one line with a link to it. `before` is the checklist this conversation ALREADY had, so a
   * second checklist is told apart from the first — `app/compliance/page.tsx:743` does the same
   * (`row.checklistId !== w.before`).
   */
  const [checklistWait, setChecklistWait] = useState<{ topicId: string; before: string | null } | null>(null)
  const [checklistReady, setChecklistReady] = useState<{ topicId: string; id: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /**
   * "SUMMARISE THIS CONVERSATION" — the workspace's shape, which HR copied and the Calendar copied
   * from HR: a 202 and then a poll, because the writer runs in `after()` and nobody is watching it.
   * A claim already held (409 `writing`) is not a failure — somebody else pressed it first.
   */
  const summaryRunning = useCallback((id: string | null) =>
    !!id && (summaryWait?.topicId === id || !!topics.find((t) => t.id === id)?.summaryInProgress),
  [summaryWait, topics])

  const summarise = useCallback(async (id: string) => {
    if (summaryRunning(id)) return
    setNotice(null)
    const before = topics.find((t) => t.id === id)?.summarised_at ?? null
    setSummaryWait({ topicId: id, before })
    let res: Response | null = null
    try {
      res = await fetch(summarisePath(id), { method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }) })
    } catch { res = null }
    const j = res ? await res.json().catch(() => null) : null
    if (res && (res.status === 202 || (res.status === 409 && j?.status === 'writing'))) {
      await reloadTopics()
      return
    }
    setNotice(j?.error ?? SUMMARY_FAILED)
    setSummaryWait(null)
  }, [summaryRunning, topics, summarisePath, reloadTopics])

  /**
   * *** ONE PRESS, ONE CALL, AND THE CLAIM DECIDES — the Workspace's rule, read and copied, not
   * written again. *** `app/compliance/page.tsx:672`'s shape:
   *
   *   · **202** — the claim is ours and the build has started.
   *   · **409 with `status: 'building'`** — another tab or another device is already building this
   *     one. That is not a failure; wait for the same result.
   *   · **anything else** — a refusal with its own sentence, shown as it came.
   *
   * *** THE ROUTE IS SECTION-BLIND, WHICH IS WHY THIS WORKS AT ALL. ***
   * `app/api/checklists/from-topic/route.ts` never reads `topics.section`; it was written for the
   * Workspace and has always been able to take any conversation. Decision 8 is therefore a screen
   * change and not a route change, and no section gets a checklist route of its own.
   *
   * `scope: 'discussed'` and not `'complete'`: `complete` searches the web and researches past the
   * conversation, which is the Workspace's own second button and a different promise. A chat's
   * "turn THIS into a checklist" means this conversation.
   */
  const checklistRunning = useCallback((id: string | null) =>
    !!id && (checklistWait?.topicId === id || !!topics.find((t) => t.id === id)?.checklistInProgress),
  [checklistWait, topics])

  const makeChecklist = useCallback(async (id: string) => {
    if (checklistRunning(id)) return
    setNotice(null)
    setChecklistReady(null)
    const before = topics.find((t) => t.id === id)?.checklistId ?? null
    setChecklistWait({ topicId: id, before })
    let res: Response | null = null
    try {
      res = await fetch('/api/checklists/from-topic', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ topicId: id, scope: 'discussed' }),
      })
    } catch { res = null }
    const j = res ? await res.json().catch(() => null) : null
    if (res && (res.status === 202 || (res.status === 409 && j?.status === 'building'))) {
      await reloadTopics()
      return
    }
    setNotice(j?.error ?? CHECKLIST_FAILED)
    setChecklistWait(null)
  }, [checklistRunning, topics, reloadTopics])

  /**
   * THE POLL, every 5 seconds while a summary is being written here or anywhere. When this tab's
   * own claim clears, the summary opens in the drawer; if it cleared with nothing new, the
   * failure is said plainly rather than left as a spinner that stops (§5.1).
   */
  const summaryWatching = !!summaryWait || topics.some((t) => t.summaryInProgress)
  /** The checklist is watched by the SAME poll — one interval, not two (Part A step 5). */
  const checklistWatching = !!checklistWait || topics.some((t) => t.checklistInProgress)
  useEffect(() => {
    if (!summaryWatching && !checklistWatching) return
    const t = setInterval(async () => {
      const list = await reloadTopics()
      setConvDrawer((d) => (d ? list.find((r) => r.id === d.id) ?? d : d))
      setSummaryWait((w) => {
        if (!w) return w
        const row = list.find((r) => r.id === w.topicId)
        if (!row || row.summaryInProgress) return w
        if (row.summarised_at && row.summarised_at !== w.before) setConvDrawer(row)
        else setNotice(SUMMARY_FAILED)
        return null
      })
      /**
       * The checklist half. When this tab's claim clears WITH a new id, the ready line shows and
       * links to it; when it clears with nothing new, the failure is said plainly rather than left
       * as a claim word that quietly stops (§5.1 — never silent).
       */
      setChecklistWait((w) => {
        if (!w) return w
        const row = list.find((r) => r.id === w.topicId)
        if (!row || row.checklistInProgress) return w
        if (row.checklistId && row.checklistId !== w.before) setChecklistReady({ topicId: w.topicId, id: row.checklistId })
        else setNotice(CHECKLIST_FAILED)
        return null
      })
    }, 5000)
    return () => clearInterval(t)
  }, [summaryWatching, checklistWatching, reloadTopics])

  /**
   * A CONVERSATION REOPENED ON THE ASK TAB, the workspace's way: `/api/topics/[id]`, which is
   * section-agnostic and scoped by RLS, so nothing new was needed for any section.
   */
  const openConversation = useCallback(async (t: TopicRow) => {
    setNotice(null)
    const res = await fetch(`/api/topics/${t.id}`, { headers: await authHeaders() })
    const j = await res.json().catch(() => null)
    if (!res.ok) { setNotice(j?.error ?? OPEN_FAILED); return false }
    const turns = (j.turns ?? []) as Array<{
      role: string; text: string; sources: AnswerSource[] | null
      document_id: string | null; document_name: string | null
    }>
    const rebuilt: Exchange[] = []
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].role !== 'user') continue
      const a = turns[i + 1]?.role === 'assistant' ? turns[i + 1] : null
      rebuilt.push({ id: `r${i}`, question: turns[i].text, text: a?.text ?? '', sources: a?.sources ?? [],
        offers: [], phase: a ? 'done' : 'failed', searches: 0,
        /**
         * *** THE PAPERCLIP COMES BACK WITH THE QUESTION. *** `turns.document_name` is a COPY
         * kept for exactly this (migration 039), so a reopened conversation shows which question
         * had a file on it — and goes on showing it after the document is deleted, when
         * `document_id` is null and the name is all that is left. A bubble that loses its
         * paperclip on reload would be the transcript quietly rewriting itself.
         */
        ...(turns[i].document_name
          ? { file: { id: turns[i].document_id ?? '', name: turns[i].document_name as string } }
          : {}),
        ...(a ? {} : { error: 'That question was not answered.' }) })
    }
    setAskInitial(rebuilt)
    setAskTopicId(t.id)
    setAskKey((n) => n + 1)
    setConvDrawer(null)
    return true
  }, [])

  /**
   * *** "+ NEW CONVERSATION" CLEARS THE CONVERSATION, WHICH IS A STATE CHANGE AND NOT AN ADDRESS. ***
   * Written as an effect watching a parameter, React's own rule refuses it ("Avoid calling
   * setState() directly within an effect"), rightly: the reset belongs to the press.
   */
  const startNewConversation = useCallback(() => {
    setAskTopicId(null)
    setAskInitial([])
    setAskKey((n) => n + 1)
    setNotice(null)
    setConvDrawer(null)
    setChecklistReady(null)
  }, [])

  return {
    askTopicId, setAskTopicId, askInitial, askKey,
    convDrawer, setConvDrawer,
    notice, setNotice,
    summaryRunning, summarise, openConversation, startNewConversation,
    checklistRunning, makeChecklist, checklistReady,
  }
}
