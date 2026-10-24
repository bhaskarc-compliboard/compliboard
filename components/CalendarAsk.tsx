'use client'
/**
 * ASK A QUESTION, AND THE ANSWER — boards 1 and 2 (Calendar step 10b).
 *
 * *** HR'S OWN SHAPE, WITH HR'S OWN COMPONENTS. *** The thread, the bubble, the docked composer,
 * the Stop button, the action row and the hint under it are `app/hr/HrWorkspace.tsx`'s, and the
 * answer is drawn by the shared `AnswerBody` and `SourceList` — imported, not copied. One prop was
 * added to `AnswerSource` for this section (`href`, so a date's card opens the date) and it is
 * optional: HR passes none and its cards are unchanged.
 *
 * *** THE STREAM IS THE WORKSPACE'S. *** `readAnswerStream` + `ndjsonLines` (`lib/answerStream.ts`)
 * read the same NDJSON HR reads, and tell apart the four endings that matter — done, stopped by
 * the person, stopped early, failed. `app/api/calendar/answer/route.ts` is a loop over the shared
 * engine; nothing about a calendar answer is decided here.
 *
 * *** WHAT THIS FILE DECIDES, AND IT IS ONLY THIS: *** how an offer looks, what happens when it is
 * pressed, and what the line says afterwards. One click writes a date into the customer's
 * calendar, so the words and the states are here where they can be read and tested, not spread
 * through the markup.
 */
import { useEffect, useRef, useState } from 'react'
import { authHeaders } from '@/lib/supabase'
import { AnswerBody, SourceList, type AnswerSource } from '@/components/AnswerBody'
import { AttachControl } from '@/components/AttachControl'
import { PRIMARY } from '@/components/buttonStyles'
import { readAnswerStream, ndjsonLines } from '@/lib/answerStream'
import { printWithFrame } from '@/lib/printFrame'
import { CALENDAR_EXAMPLE_QUESTIONS } from '@/config/examples'
import {
  offerWords, matchOffer, unconfirmedCited, unconfirmedNote,
  ON_YOUR_CALENDAR, ALREADY_ON_YOUR_CALENDAR, COULD_NOT_ADD, type CalendarRow,
} from '@/lib/calendarView'
import type { Offer } from '@/lib/ask/offers'

import type { Banner } from '@/lib/billing'
import PausedNote from '@/components/PausedNote'
/** The composer's hint, board 2. */
export const COMPOSER_HINT = 'Ask about a date, or what is due…'
/** The line under the action row, HR's, word for word — one topic per conversation. */
export const ONE_TOPIC_LINE =
  'One topic per conversation. When you are done, summarise it. Start a new conversation for the next topic.'
export const FAILED_ASK = 'That answer could not be completed.'
export const STOPPED_EARLY_TITLE = 'This answer stopped early.'

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
  /** Per offer: the row it became (or already was), or the sentence that says it did not. */
  added?: Record<number, { id: string | null; already: boolean; failed?: boolean }>
}

export function CalendarAsk({ rows, companyName, topicId, initial, onTopicId, onChanged, onSummarise, summaryBusy, paused }: {
  /** The live dates, so an offer already on the calendar says so instead of offering again. */
  rows: CalendarRow[]
  companyName: string | null
  topicId: string | null
  /** A conversation reopened from the Conversations tab, rebuilt from its stored turns. */
  initial: Exchange[]
  onTopicId: (id: string | null) => void
  /** Re-read the page's counts and rows: an answer writes a topic, an offer writes a date. */
  onChanged: () => Promise<void> | void
  onSummarise: (topicId: string) => void
  summaryBusy: boolean
  /** Step 18, decision 11. A PROP, not a read of its own — the page already has the verdict. */
  paused: Banner | null
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
      const res = await fetch('/api/calendar/answer', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }), signal: controller.signal,
        body: JSON.stringify({
          question: q, topicId,
          history: exchanges.filter((x) => x.phase === 'done' && x.text)
            .map((x) => ({ question: x.question, answer: x.text, sources: x.sources })),
        }),
      })
      if (!(res.headers.get('content-type') ?? '').includes('x-ndjson')) {
        const json = await res.json().catch(() => null)
        patch(id, { phase: 'failed', error: json?.error ?? FAILED_ASK })
        return
      }
      // The two events this section adds ride on the same lines the shared reader consumes —
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

  /**
   * *** ONE CLICK PUTS THE DATE ON THE CALENDAR, CONFIRMED, WITH THIS PERSON'S NAME ON IT ***
   * (decision 17). It goes through `POST /api/calendar` with `source: 'rule'` — `proposeDate` is
   * the one writer, and it is what decides that a rule date a person pressed is confirmed.
   *
   * A failure says so and the line stays an offer: the date is not there, so the line must not
   * say it is (§5.1).
   */
  async function accept(x: Exchange, i: number, offer: Offer) {
    const mark = (v: { id: string | null; already: boolean; failed?: boolean }) =>
      patch(x.id, { added: { ...(x.added ?? {}), [i]: v } })
    mark({ id: null, already: false })
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          source: 'rule', title: offer.title, due_date: offer.due_on, recurs: offer.recurs,
          period: offer.period, entity_id: offer.site, source_url: offer.source_url, source_line: offer.source_line,
        }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.data?.id) { mark({ id: null, already: false, failed: true }); return }
      mark({ id: String(j.data.id), already: j.outcome === 'existing' })
      await onChanged()
    } catch { mark({ id: null, already: false, failed: true }) }
  }

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
            placeholder={docked ? COMPOSER_HINT : undefined}
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
            {CALENDAR_EXAMPLE_QUESTIONS.map((e) => (
              <p key={e.label} className="truncate text-[14px] text-gray-400">e.g. {e.question}</p>
            ))}
          </div>
        )}
      </div>
      {/* HR's one line under the box: the attach slot left, the action right. The Calendar has no
          uploader of its own and will not invent a second one — the slot is a LINK to Company
          Documents, which comes back here when the upload is done. */}
      <div className="mt-[10px] flex flex-wrap items-center justify-between gap-4">
        <p className="min-w-0 text-[12px] text-gray-500">
          {/* `return=` only: `add=` is Documents' hint line for what to upload, and the Calendar's chat
              does not know what the person is about to add. Photographed with both, it read "Add: 1". */}
          <AttachControl label="Add a document" href="/documents?return=%2Fcalendar%3Ftab%3Dask" />
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-5">
          {docked && topicId && answered && (<>
            <button onClick={() => onSummarise(topicId)} disabled={busy || summaryBusy || Boolean(paused)}
              className="text-[14px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
              {summaryBusy ? 'Writing the summary…' : 'Summarise this conversation'}
            </button>
            <button onClick={() => printWithFrame({ company: companyName ?? '', type: 'Conversation' })}
              disabled={busy} className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300">
              Download
            </button>
          </>)}
          {!docked && (
            <button className={PRIMARY} onClick={() => ask(box)} disabled={busy || Boolean(paused) || !box.trim()}>
              {busy ? 'Asking…' : 'Ask'}
            </button>
          )}
        </div>
      </div>
      <PausedNote banner={paused} />
      {docked && <p className="mt-2 text-[12px] text-gray-500">{ONE_TOPIC_LINE}</p>}
    </div>
  )

  return (
    <div className={started ? 'pt-1' : ''}>
      {exchanges.map((x) => {
        const unconfirmed = x.phase === 'done' ? unconfirmedCited(x.sources, rows) : []
        return (
          <div key={x.id} className="mb-8">
            <div className="mb-5 flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-gray-200 px-4 py-3 text-[16px] leading-relaxed text-gray-900">
                <p>{x.question}</p>
              </div>
            </div>
            {!x.text && (x.phase === 'sending' || x.phase === 'searching' || x.phase === 'writing') && (
              <p className="text-[14px] text-gray-400">
                {x.phase === 'searching' ? `Looking it up${x.searches > 1 ? ` (${x.searches} searches)` : ''}…` : 'Reading your calendar…'}
              </p>
            )}
            {x.text && (<>
              <AnswerBody text={x.text} sources={x.sources} />
              {/* THE OFFER, board 2: one underlined line, and what it says after it is pressed. */}
              {x.phase === 'done' && x.offers.map((o, i) => {
                const state = x.added?.[i]
                const already = matchOffer(rows, o)
                const landed = state?.id ?? already?.id ?? null
                if (landed) {
                  return (
                    <p key={i} className="mt-3 text-[15px]">
                      <a href={`/calendar?tab=calendar&date=${landed}`}
                        className="text-[var(--green-ink)] underline underline-offset-2">
                        {state && !state.already ? ON_YOUR_CALENDAR : ALREADY_ON_YOUR_CALENDAR}
                      </a>
                      <span className="text-gray-500"> — {o.title}</span>
                    </p>
                  )
                }
                return (
                  <p key={i} className="mt-3 text-[15px]">
                    <button onClick={() => accept(x, i, o)} disabled={busy}
                      className="text-left text-[var(--green-ink)] underline underline-offset-2 hover:no-underline disabled:text-gray-300">
                      {offerWords(o)}
                    </button>
                    {state?.failed && <span className="mt-1 block text-[13px] text-amber-800">{COULD_NOT_ADD}</span>}
                  </p>
                )
              })}
              {/* Board 2's grey line, computed from the dates the answer cited — never written by
                  the model, so it cannot be wrong about which dates are confirmed. */}
              {unconfirmed.length > 0 && (
                <p className="mt-3 text-[13px] text-gray-400">{unconfirmedNote(unconfirmed)}</p>
              )}
              <div className="sources-print"><SourceList sources={x.sources} /></div>
            </>)}
            {x.phase === 'refused' && <p className="text-[14px] text-gray-600">{x.refusal}</p>}
            {x.phase === 'stopped_early' && (
              <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
                <b className="font-semibold">{STOPPED_EARLY_TITLE}</b>{' '}
                The answer stopped before it was finished, so what is above is incomplete. Nothing was saved for it.
                <button onClick={() => ask(x.question)} className="ml-2 font-medium underline hover:no-underline">Try again</button>
              </div>
            )}
            {x.phase === 'stopped' && (
              <p className="mt-2 text-[14px] text-gray-500">
                Stopped. {x.text ? 'What arrived is above — ' : ''}Ask again, or change the question.
              </p>
            )}
            {x.phase === 'failed' && (
              <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
                {x.error} You can ask again, or rephrase the question.
                <button onClick={() => ask(x.question)} className="ml-2 font-medium underline hover:no-underline">Try again</button>
              </div>
            )}
          </div>
        )
      })}
      <div ref={bottomRef} />
      {composer(started)}
    </div>
  )
}
