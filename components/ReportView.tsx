/**
 * THE SUMMARY REPORT IN THE DRAWER — lifted out of `app/compliance/page.tsx`, HR Step 3a
 * (`docs/HR-PLAN.md` decision 1), so the workspace and HR show the very same report.
 *
 * Workspace Task 5, board 6. In this order: the as-of line, your situation, what applies grouped by
 * authority, still to confirm, asked and not answered, the facts line, and the sources as one
 * numbered list. An item's sources are "[n] title" links to the list's own entries; an item with none
 * says so in grey. Download prints all of it (`printDrawer`).
 *
 * THE SUMMARY AS AN ACCORDION — Workspace Stage 2, the canvas feature boards, board 6b, with the
 * owner's one change: Still to confirm comes AFTER the agencies. The order is the one Task 5 built.
 *   · Open on first view: the as-of line, Your situation, Still to confirm (NEVER folded), Asked and
 *     not answered, the facts line.
 *   · Folded on first view: each authority under What applies (one row: chevron, the authority,
 *     "N things to do"), and Sources (one row: "Sources" and the count).
 *   · "Open all" / "Close all" beside "What applies · N things to do".
 *   · Rows are real buttons with aria-expanded and aria-controls. Nothing is remembered: the drawer
 *     mounts this with the topic as its key, so every open starts folded.
 *   · PRINT IS ALWAYS OPEN: a folded panel carries `fold-closed`, hidden on screen and shown by the
 *     print CSS in `app/globals.css`. The screen state is not changed to print.
 *
 * *** THE ONE CHANGE IN THE MOVE: THE SOURCE SHAPE IS A PARAMETER. *** The markup is the workspace's,
 * character for character; only how ONE source is drawn — on an item's line, and in the Sources list —
 * comes from `sourceShape`. `WEB_SOURCE` draws a web page exactly as the workspace always has. HR will
 * pass its own shape later, so a source can be a handbook passage; nothing for HR is built here.
 *
 * *** THE WORDS COME FROM `lib/summaryWords.ts`, NEVER `lib/summaryReport.ts`. *** That file imports
 * the model client and must not reach a browser bundle; `tests/unit/clientImports.test.ts` holds it.
 */
'use client'

import type React from 'react'
import { useId, useState, useEffect } from 'react'
import type { ReportItem, ReportSource, ReportDate } from '@/lib/summaryReport'
import { authHeaders } from '@/lib/supabase'
import { formatDay, type HowOften } from '@/lib/calendarDate'
import { NO_SOURCE, NO_SITUATION, AS_OF_LINE } from '@/lib/summaryWords'
import { thingsToDo } from '@/lib/checklistView'
import { displaySource } from '@/lib/sourceTitle'
import { FoldRow } from '@/components/FoldRow'
import { OneLineLink } from '@/components/OneLineLink'

/** How one source is drawn. `n` is the number the report gave it. */
export interface SourceShape<S extends { n: number }> {
  /** On an item's line: one source, one line. */
  link: (src: S) => React.ReactNode
  /** In the Sources list, after its number. */
  entry: (src: S) => React.ReactNode
}

/** A report whose sources have the shape `S`. The workspace's is `SummaryReport` (`S` = `ReportSource`). */
export interface ReportLike<S extends { n: number }> {
  as_of: string
  situation: string
  applies: Array<{ authority: string; items: ReportItem[] }>
  to_confirm: ReportItem[]
  unanswered: string[]
  sources: S[]
  /** Deadlines the conversation gave, each checked against it (Calendar C2, board 10). */
  dates?: ReportDate[]
  dates_dropped?: Array<{ title: string; reason: string }>
}

/** A web page, drawn exactly as the workspace always has: a one-line link, and title + host in the list. */
export const WEB_SOURCE: SourceShape<ReportSource> = {
  link: (src) => <OneLineLink key={src.n} n={src.n} title={src.title} url={src.url} />,
  entry: (src) => {
    const shown = displaySource(src.title, src.url)
    return (
      <span>
        <a href={src.url} target="_blank" rel="noopener noreferrer"
           className="text-emerald-800 underline underline-offset-2">{shown.title}</a>
        {' '}<span className="text-gray-400">{shown.host}</span>
      </span>
    )
  },
}

/**
 * HR Step 7, ADDITIVE: the three phrases that differ in HR's summary. Not passed (the workspace), each is the
 * workspace's own, so its drawer is unchanged.
 */
export interface ReportWords {
  /** Over the authorities: "What applies · 3 things to do" (workspace) / "What to change · 3 things" (HR). */
  heading?: (total: number) => string
  /** Each authority's count: "3 things to do" / "3 things to change". */
  perGroup?: (n: number) => string
  /** The as-of line. */
  asOf?: (asOf: string) => string
}

/**
 * *** THE DATES A CONVERSATION GAVE — Calendar C3, board 10. ***
 *
 * Shared by the Compliance Workspace and HR, like everything else in this file. Each date shows the
 * words it stands on, so a person can see WHY the product thinks this is a deadline before putting
 * it on their calendar — and nothing arrives there by itself: the note under the list says so, and
 * it is true, because only this button writes.
 */
/** How often, in the words the calendar page uses, so the two screens say the same thing. */
const HOW_OFTEN_WORDS: Record<HowOften, string> = {
  monthly: 'every month', quarterly: 'every three months', yearly: 'every year',
}

function DatesSection({ dates, dropped, topicId, byN, sourceShape }: {
  dates: ReportDate[]
  dropped: Array<{ title: string; reason: string }> | undefined
  topicId: string | undefined
  byN: Map<number, { n: number }>
  sourceShape: SourceShape<{ n: number }>
}) {
  /** `idle` → `adding` → `on`. Keyed by the date's own key parts, which is what `addDate` keys on. */
  const [state, setState] = useState<Record<string, 'adding' | 'on' | string>>({})
  const keyOf = (d: ReportDate) => `${d.day ?? 'no-day'}|${d.line}`

  // WHICH OF THESE ARE ALREADY ON THE CALENDAR. One read when the drawer opens, not one per date.
  // A failed read leaves every button saying "Add to calendar" — pressing it again is harmless,
  // because `addDate` is keyed and a second press is the same date (decision 2). So the cautious
  // direction here is to show the button, and R2 is satisfied by never claiming the opposite.
  useEffect(() => {
    if (!topicId) return
    let live = true
    ;(async () => {
      try {
        const res = await fetch('/api/calendar/dates?view=all', { headers: await authHeaders() })
        if (!res.ok) return
        const j = await res.json()
        if (!live || !Array.isArray(j?.dates)) return
        const here: Record<string, 'on'> = {}
        for (const row of j.dates as Array<{ topic_id: string | null; due_date: string | null; description: string | null }>)
          if (row.topic_id === topicId) here[`${row.due_date ?? 'no-day'}|${row.description ?? ''}`] = 'on'
        setState((s) => ({ ...here, ...s }))
      } catch { /* the button stays "Add to calendar", which is safe to press twice */ }
    })()
    return () => { live = false }
  }, [topicId])

  const add = async (d: ReportDate) => {
    const k = keyOf(d)
    setState((s) => ({ ...s, [k]: 'adding' }))
    try {
      const res = await fetch('/api/calendar/dates', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          source: 'conversation', topic_id: topicId, title: d.title, day: d.day, line: d.line,
          // A DATE WITH NO DAY GOES ON AS A REPEAT WHOSE DAY THE PERSON PICKS (board 11, Audits'
          // pattern) — migration 073 requires a dateless date to repeat, and the calendar asks.
          repeats: d.how_often !== null || d.day === null,
          every: d.how_often,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setState((s) => ({ ...s, [k]: j?.error ?? 'We could not add that just now. That is our side, not yours.' }))
        return
      }
      setState((s) => ({ ...s, [k]: 'on' }))
    } catch {
      setState((s) => ({ ...s, [k]: 'We could not add that just now. That is our side, not yours.' }))
    }
  }

  return (
    <section>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Dates found · {dates.length}
      </h4>
      <ul className="divide-y divide-gray-100 border-y border-gray-100">
        {dates.map((d, i) => {
          const st = state[keyOf(d)]
          return (
            <li key={i} className="py-2.5">
              <p className="text-[15px] font-medium text-gray-900">{d.title}</p>
              <p className="mt-0.5 text-[13px] text-gray-600">
                {d.day ? formatDay(d.day) : <span className="text-gray-500">No day given</span>}
                {d.how_often ? ` · ${HOW_OFTEN_WORDS[d.how_often]}` : ''}
              </p>
              <p className="mt-1 text-[13px] italic leading-relaxed text-gray-600">“{d.line}”</p>
              <div className="mt-1 space-y-0.5">
                {d.from_person
                  ? <p className="text-[12.5px] text-gray-400">from what you said</p>
                  : d.sources.length
                    ? d.sources.map((n) => { const src = byN.get(n); return src ? sourceShape.link(src) : null })
                    : <p className="text-[12.5px] text-gray-400">{NO_SOURCE}</p>}
              </div>
              {topicId && (
                <div className="no-print mt-1.5">
                  {st === 'on'
                    ? <span className="text-[13px] text-[var(--green-ink)]">On your calendar</span>
                    : <button type="button" disabled={st === 'adding'} onClick={() => add(d)}
                        className="text-[13px] text-[var(--green-ink)] hover:underline disabled:text-gray-400">
                        {st === 'adding' ? 'Adding…' : 'Add to calendar'}
                      </button>}
                  {st && st !== 'on' && st !== 'adding' && (
                    <p className="mt-0.5 text-[12.5px] text-amber-900">{st}</p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {/* The product never puts a date on somebody's calendar off its own bat. Said, because the
          whole value of the calendar is that everything on it was agreed to (decision 3). */}
      <p className="mt-1.5 text-[12.5px] text-gray-500">
        Dates from a conversation go on your calendar only when you add them.
      </p>
      {/* What the check refused, in one grey line — said, never silently lost (C2). */}
      {dropped && dropped.length > 0 && (
        <p className="mt-1 text-[12.5px] text-gray-500">
          {dropped.length} date{dropped.length === 1 ? '' : 's'} left out: {dropped[0].reason}
          {dropped.length > 1 ? ', and others' : ''}.
        </p>
      )}
    </section>
  )
}

export function ReportView<S extends { n: number }>({ report, factsLine, sourceShape, words, topicId }: {
  report: ReportLike<S>; factsLine: React.ReactNode; sourceShape: SourceShape<S>; words?: ReportWords; topicId?: string }) {
  const byN = new Map(report.sources.map((src) => [src.n, src]))
  const heading = 'mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400'
  const uid = useId()
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const total = report.applies.reduce((n, g) => n + g.items.length, 0)
  const allOpen = report.applies.length > 0 && open.size === report.applies.length
  const toggle = (gi: number) => setOpen((o) => { const n = new Set(o); if (n.has(gi)) n.delete(gi); else n.add(gi); return n })
  const item = (it: ReportItem, key: string) => (
    <li key={key} className="py-2.5">
      <p className="text-[15px] font-medium text-gray-900">{it.name}</p>
      <p className="mt-0.5 text-[14px] leading-relaxed text-gray-600">{it.what_to_do}</p>
      <div className="mt-1 space-y-0.5">
        {it.sources.length ? it.sources.map((n) => {
          const src = byN.get(n)
          return src ? sourceShape.link(src) : null
        }) : <p className="text-[12.5px] text-gray-400">{NO_SOURCE}</p>}
      </div>
    </li>
  )
  return (
    <div className="space-y-6">
      <p className="text-[13px] text-gray-500">{(words?.asOf ?? AS_OF_LINE)(report.as_of)}</p>
      <section>
        <h4 className={heading}>Your situation</h4>
        {/* An empty situation (the person said nothing about their business): the fixed sentence, in the
            workspace's grey note style (the "messages cleared" note in app/compliance/page.tsx). */}
        {report.situation.trim()
          ? <p className="text-[15px] leading-relaxed text-gray-800">{report.situation}</p>
          : <p className="rounded-lg bg-gray-50 px-3 py-2 text-[12.5px] text-gray-500">{NO_SITUATION}</p>}
      </section>
      {report.applies.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{words?.heading ? words.heading(total) : <>What applies · {thingsToDo(total)}</>}</h4>
            <button type="button" className="no-print text-[12px] text-[var(--green-ink)] hover:underline"
              onClick={() => setOpen(allOpen ? new Set() : new Set(report.applies.map((_, gi) => gi)))}>
              {allOpen ? 'Close all' : 'Open all'}
            </button>
          </div>
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {report.applies.map((g, gi) => {
              const id = `${uid}-a${gi}`
              return (
                <div key={g.authority + gi}>
                  <FoldRow label={g.authority} right={(words?.perGroup ?? thingsToDo)(g.items.length)} expanded={open.has(gi)} controls={id} onClick={() => toggle(gi)} />
                  <ul id={id} className={`divide-y divide-gray-100 pb-2 pl-[22px] ${open.has(gi) ? '' : 'fold-closed'}`}>
                    {g.items.map((it, i) => item(it, `${gi}-${i}`))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      )}
      {report.to_confirm.length > 0 && (
        <section>
          <h4 className={heading}>Still to confirm</h4>
          <ul className="divide-y divide-gray-100">{report.to_confirm.map((it, i) => item(it, `c-${i}`))}</ul>
        </section>
      )}
      {report.dates && report.dates.length > 0 && (
        <DatesSection dates={report.dates} dropped={report.dates_dropped} topicId={topicId}
          byN={byN as Map<number, { n: number }>}
          sourceShape={sourceShape as unknown as SourceShape<{ n: number }>} />
      )}
      {report.unanswered.length > 0 && (
        <section>
          <h4 className={heading}>Asked and not answered</h4>
          <ul className="list-disc space-y-1 pl-5 text-[14px] text-gray-700">
            {report.unanswered.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </section>
      )}
      {factsLine}
      {report.sources.length > 0 && (
        <section className="border-y border-gray-200">
          <FoldRow label="Sources" right={String(report.sources.length)} expanded={sourcesOpen}
            controls={`${uid}-src`} onClick={() => setSourcesOpen((v) => !v)} />
          {/* The full titles, as before: the list is where a source is read in full. */}
          <ol id={`${uid}-src`} className={`space-y-1.5 pb-3 ${sourcesOpen ? '' : 'fold-closed'}`}>
            {report.sources.map((src) => (
              <li key={src.n} className="flex gap-2 text-[13px] leading-snug">
                <span className="shrink-0 text-gray-400">{src.n}.</span>
                {sourceShape.entry(src)}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
