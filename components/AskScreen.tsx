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
import { AttachControl } from '@/components/AttachControl'
import { PRIMARY } from '@/components/buttonStyles'
import { readAnswerStream, ndjsonLines } from '@/lib/answerStream'
import { printWithFrame } from '@/lib/printFrame'
import { askAgainLine, type Banner } from '@/lib/billing'
import PausedNote from '@/components/PausedNote'
import type { TopicRow, TopicSection } from '@/lib/topicList'
import type { ExampleQuestion } from '@/config/examples'
import type { Offer } from '@/lib/ask/offers'

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
export const ACTION_SUMMARISE = 'Summarise this conversation'
export const ACTION_SUMMARISING = 'Writing the summary…'
export const ACTION_DOWNLOAD = 'Download'
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
}

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

export function AskScreen({
  section, endpoints, words, examples, companyName, paused,
  topicId, initial, onTopicId, onChanged, onSummarise, summaryBusy,
  attach, thinkingLine, afterAnswer, canMakeChecklist = false,
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
  /** The attach slot. `href` only in this step; the upload is Part A step 3. */
  attach: { label: string; href: string }
  /** What the grey line says while nothing has arrived — a claim about what is being read, so the
   *  section writes it ("Reading your calendar…"). Never written here. */
  thinkingLine: (x: Exchange) => string
  /** The one part of an answer that is not prose: a section's own offers, under the answer. */
  afterAnswer?: (x: Exchange, patch: (p: Partial<Exchange>) => void) => React.ReactNode
  /**
   * DECISION 8's FIRST ACTION, OFF UNTIL PART A STEP 5 WIRES IT. The button is written here, in
   * its place in the row, so the order is settled once; nothing renders it yet because nothing
   * can act on it, and a control that does nothing is a promise the product is not keeping
   * (`CLAUDE.md` §5.1). Calendar passes nothing, so it is false.
   */
  canMakeChecklist?: boolean
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>(initial)
  const [box, setBox] = useState('')
  const [busy, setBusy] = useState(false)
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

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) { composerRef.current?.focus(); return }
    setBox('')
    const id = `x${++seq.current}`
    setExchanges((prev) => [...prev, { id, question: q, text: '', sources: [], offers: [], phase: 'sending', searches: 0 }])
    setBusy(true)
    const controller = new AbortController()
    inFlight.current = controller
    try {
      const res = await fetch(endpoints.answer, {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }), signal: controller.signal,
        body: JSON.stringify({
          question: q, topicId,
          history: exchanges.filter((x) => x.phase === 'done' && x.text)
            .map((x) => ({ question: x.question, answer: x.text, sources: x.sources })),
        }),
      })
      if (!(res.headers.get('content-type') ?? '').includes('x-ndjson')) {
        const json = await res.json().catch(() => null)
        patch(id, { phase: 'failed', failedStatus: res.status, error: json?.error ?? FAILED_ASK })
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
      {/* HR's one line under the box: the attach slot left, the actions right. */}
      <div className="mt-[10px] flex flex-wrap items-center justify-between gap-4">
        <p className="min-w-0 text-[12px] text-gray-500">
          <AttachControl label={attach.label} href={attach.href} />
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-5">
          {docked && topicId && answered && (<>
            {/* THE THREE ACTIONS, IN THE OWNER'S ORDER (decision 8). The first waits for step 5. */}
            {canMakeChecklist && (
              <button disabled={busy || Boolean(paused)}
                className="text-[14px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
                {ACTION_CHECKLIST}
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
      {docked && <p className="mt-2 text-[12px] text-gray-500">{words.oneTopicLine}</p>}
    </div>
  )

  return (
    <div className={started ? 'pt-1' : ''} data-ask-section={section}>
      {exchanges.map((x) => (
        <div key={x.id} className="mb-8">
          <div className="mb-5 flex justify-end">
            <div className="max-w-[85%] rounded-2xl bg-gray-200 px-4 py-3 text-[16px] leading-relaxed text-gray-900">
              <p>{x.question}</p>
            </div>
          </div>
          {!x.text && (x.phase === 'sending' || x.phase === 'searching' || x.phase === 'writing') && (
            <p className="text-[14px] text-gray-400">{thinkingLine(x)}</p>
          )}
          {x.text && (<>
            <AnswerBody text={x.text} sources={x.sources} />
            {afterAnswer?.(x, (p) => patch(x.id, p))}
            <div className="sources-print"><SourceList sources={x.sources} /></div>
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
   * THE POLL, every 5 seconds while a summary is being written here or anywhere. When this tab's
   * own claim clears, the summary opens in the drawer; if it cleared with nothing new, the
   * failure is said plainly rather than left as a spinner that stops (§5.1).
   */
  const summaryWatching = !!summaryWait || topics.some((t) => t.summaryInProgress)
  useEffect(() => {
    if (!summaryWatching) return
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
    }, 5000)
    return () => clearInterval(t)
  }, [summaryWatching, reloadTopics])

  /**
   * A CONVERSATION REOPENED ON THE ASK TAB, the workspace's way: `/api/topics/[id]`, which is
   * section-agnostic and scoped by RLS, so nothing new was needed for any section.
   */
  const openConversation = useCallback(async (t: TopicRow) => {
    setNotice(null)
    const res = await fetch(`/api/topics/${t.id}`, { headers: await authHeaders() })
    const j = await res.json().catch(() => null)
    if (!res.ok) { setNotice(j?.error ?? OPEN_FAILED); return false }
    const turns = (j.turns ?? []) as Array<{ role: string; text: string; sources: AnswerSource[] | null }>
    const rebuilt: Exchange[] = []
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].role !== 'user') continue
      const a = turns[i + 1]?.role === 'assistant' ? turns[i + 1] : null
      rebuilt.push({ id: `r${i}`, question: turns[i].text, text: a?.text ?? '', sources: a?.sources ?? [],
        offers: [], phase: a ? 'done' : 'failed', searches: 0,
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
  }, [])

  return {
    askTopicId, setAskTopicId, askInitial, askKey,
    convDrawer, setConvDrawer,
    notice, setNotice,
    summaryRunning, summarise, openConversation, startNewConversation,
  }
}
