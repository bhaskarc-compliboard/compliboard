/**
 * THE SUMMARY REPORT — five cards, a little colour, and the fold the right way up.
 * `docs/GAPS-PLAN.md` Part E step E2, decisions 62 and 63; `docs/summary-report-boards.html`.
 *
 * *** ONE FILE DRAWS IT IN SIX PLACES. *** The Compliance Workspace's own summary drawer, HR's,
 * and the shared `components/ConversationDrawer.tsx` — which the Calendar, Documents and Audits
 * all mount. Nothing section-specific is inside this file: a section passes its `sourceShape`, its
 * `words` and its `factsLine`, and that is the whole of the variation.
 *
 * *** WHAT E2 CHANGED, AND WHAT IT DID NOT. *** It did not change a word the model wrote: the
 * sentences, the items, the sources and the facts are exactly what the summariser stored. It
 * changed the order things open in, the words of one heading, and the partitions —
 *
 *   · **Five cards**, each with a coloured left edge and a tinted header (decision 62), from the
 *     audit report's palette read from one place (`lib/reportPalette.ts`).
 *   · **The fold is inverted.** What applies used to open with every authority FOLDED, so the
 *     thing the summary is for was a row of closed headings. It opens with the **first authority
 *     open** and the rest folded to their counts, Open all / Close all on the right.
 *   · **Still to confirm, Not answered here and Sources open FOLDED**, each with its count on its
 *     header line — and Still to confirm's count says what it means: *"3 things we could not
 *     settle from the documents"*.
 *   · **"Asked and not answered" is "Not answered here"**, and each question carries the line that
 *     says what happened and what to do (`lib/summaryWords.ts`).
 *
 * *** THE SPACING IS BOARD 2's, AND THESE ARE ITS OWN NUMBERS. *** `.sr .item` is
 * `padding: 8px 0 10px 18px` over a 1px rule, and `.sr .auth` is `padding: 10px 0 6px`. So item to
 * item is 10 + 1 + 8 = **19px**, and an authority row to its first item is 6 + 1 + 8 = **15px**.
 * They are written as `pt-2 pb-2.5` and `pt-2.5 pb-1.5` below rather than left to a `space-y`,
 * because the gap a reader sees is the sum of two paddings and a rule and nothing else should be
 * guessing at it.
 *
 * *** PRINT IS ALWAYS OPEN, AND KEEPS ITS COLOUR. *** A folded panel carries `fold-closed`, which
 * the print CSS shows (`app/globals.css`); a tinted header carries `print-tint`, which is the only
 * reason a browser prints a background at all (E1a).
 *
 * *** THE WORDS COME FROM `lib/summaryWords.ts`, NEVER `lib/summaryReport.ts`. *** That file
 * imports the model client and must not reach a browser bundle; `tests/unit/clientImports.test.ts`
 * holds it.
 */
'use client'

import type React from 'react'
import { useId, useState } from 'react'
import type { ReportItem, ReportSource } from '@/lib/summaryReport'
import {
  NO_SOURCE, NO_SITUATION, AS_OF_LINE, APPLIES_COUNT, GROUPS_COUNT, CONFIRM_COUNT,
  UNANSWERED_COUNT, UNANSWERED_LINE, CARD_SITUATION_TITLE, CARD_APPLIES_TITLE, CARD_CONFIRM_TITLE,
  CARD_UNANSWERED_TITLE, CARD_SOURCES_TITLE, CONFIRM_LINK, CONFIRM_ONE, confirmHref,
  CONFIRM_HREF as CONFIRM_HREF_ALL,
} from '@/lib/summaryWords'
import { CARD_SITUATION, CARD_APPLIES, CARD_CONFIRM, CARD_QUIET } from '@/lib/reportPalette'
import { thingsToDo } from '@/lib/checklistView'
import { displaySource, sourceTarget, type SourceTarget } from '@/lib/sourceTitle'
import { OneLineLink } from '@/components/OneLineLink'
import { useWaitingKeys } from '@/components/WaitingKeys'

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
 * *** ONE CARD — decision 62. ***
 * A coloured left edge and a tinted header, a count on the header line, and a body that folds.
 * `Your situation` passes no `onToggle` and is drawn without a chevron: it is two sentences and
 * there is nothing to fold.
 */
function Card({ tint, title, count, right, open, onToggle, controls, children }: {
  tint: string; title: string; count?: string; right?: React.ReactNode
  open: boolean; onToggle?: () => void; controls: string; children: React.ReactNode
}) {
  const head = (
    <>
      {onToggle && (
        <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`no-print shrink-0 opacity-60 transition-transform ${open ? 'rotate-90' : ''}`}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      )}
      {/* The title never breaks: photographed at E2b as "STILL TO / CONFIRM" once the header
          carried a long count and a link as well. The COUNT is prose and may wrap. */}
      <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.05em]">{title}</span>
      {count && <span className="min-w-0 text-[12px] font-normal opacity-80">{count}</span>}
      {right}
    </>
  )
  return (
    <section className="overflow-hidden rounded-[10px] border border-gray-200 bg-white">
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={controls}
          className={`print-tint flex w-full items-center gap-2.5 border-l-4 px-3.5 py-2.5 text-left ${tint}`}>
          {head}
        </button>
      ) : (
        <div className={`print-tint flex items-center gap-2.5 border-l-4 px-3.5 py-2.5 ${tint}`}>{head}</div>
      )}
      <div id={controls} className={`px-3.5 pb-2.5 pt-1 ${open ? '' : 'fold-closed'}`}>{children}</div>
    </section>
  )
}

export function ReportView<S extends { n: number }>({ report, factsLine, sourceShape, words, onOpenSource }: {
  report: ReportLike<S>; factsLine: React.ReactNode; sourceShape: SourceShape<S>; words?: ReportWords
  /**
   * *** DECISION 63, AND THE SMALLEST SHAPE IT COULD HAVE. ***
   *
   * One optional callback. When a section passes it, a source that points INSIDE the product — a
   * document's reading or an audit's report — is drawn as a button and handed to the host, which
   * swaps what it is showing and offers a way back. When a section does not pass it, every source
   * is drawn exactly as it was before, by its own `sourceShape`. So the Workspace and HR, which
   * have no document drawer to swap to, are unchanged by this file rather than by an exception
   * inside it.
   *
   * The caller gets `SourceTarget` and not a URL, so the parsing — the two address shapes the
   * briefs write — happens once, in `lib/sourceTitle.ts`, where it is tested without a browser.
   */
  onOpenSource?: (target: SourceTarget) => void
}) {
  const byN = new Map(report.sources.map((src) => [src.n, src]))
  const uid = useId()
  /** What Company information is waiting for, from the read the layout already makes (E2b item 1). */
  const waiting = useWaitingKeys()
  /** The first authority open, the rest folded — the inversion decision 62 asks for. */
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]))
  const [cards, setCards] = useState({ applies: true, confirm: false, unanswered: false, sources: false })
  const flip = (k: keyof typeof cards) => setCards((c) => ({ ...c, [k]: !c[k] }))
  const total = report.applies.reduce((n, g) => n + g.items.length, 0)
  const allOpen = report.applies.length > 0 && open.size === report.applies.length
  const toggle = (gi: number) => setOpen((o) => { const n = new Set(o); if (n.has(gi)) n.delete(gi); else n.add(gi); return n })

  /**
   * One source on an item's line. A source of ours goes to the host when there is one; everything
   * else — and everything, when there is no host — is the section's own shape, unchanged.
   */
  const sourceLine = (src: S) => {
    const t = sourceTarget(src as unknown as { url?: string; href?: string })
    if (!onOpenSource || t.kind === 'web') return sourceShape.link(src)
    const title = String((src as unknown as { title?: string }).title ?? '')
    const label = t.kind === 'document' ? 'your document'
      : t.kind === 'audit' ? 'the audit'
      : 'your calendar'
    return (
      <button key={src.n} type="button" onClick={() => onOpenSource(t)}
        className="block max-w-full truncate text-left text-[12px] text-[var(--green-ink)] underline underline-offset-2 hover:text-[var(--green)]">
        {title} · {label}
      </button>
    )
  }

  /* An item: the name, what to do, and its sources. The paddings are board 2's — see the header. */
  const item = (it: ReportItem, key: string, confirm = false) => (
    <li key={key} className="border-t border-gray-100 pb-2.5 pl-[18px] pt-2 first:border-t-0">
      <p className="text-[14px] font-medium text-gray-900">{it.name}</p>
      <p className="mt-0.5 text-[13.5px] leading-[20px] text-gray-600">{it.what_to_do}</p>
      <div className="mt-0.5 space-y-0.5">
        {it.sources.length ? it.sources.map((n) => {
          const src = byN.get(n)
          return src ? sourceLine(src) : null
        }) : <p className="text-[12px] text-gray-400">{NO_SOURCE}</p>}
      </div>
      {/* *** A WAY TO SETTLE THIS ONE — E2a item 3, narrowed at E2b item 1. ***
          It was on every item, said the same words as the card's own header link three or four
          times down one card, and every copy went to the same page. It is drawn now only when the
          item names a key AND that key is still waiting — the one case where it says something
          the header does not: THIS question, not the page. */}
      {confirm && it.key && waiting.has(it.key) && (
        <a href={confirmHref(it.key)} className="no-print mt-1 inline-block text-[12px] text-[var(--green-ink)] underline underline-offset-2 hover:text-[var(--green)]">
          {CONFIRM_ONE}
        </a>
      )}
    </li>
  )

  return (
    <div className="space-y-3.5">
      <p className="text-[12px] text-gray-400">{(words?.asOf ?? AS_OF_LINE)(report.as_of)}</p>

      {/* ── YOUR SITUATION — grey, never folded: it is two sentences. ──────── */}
      <Card tint={CARD_SITUATION} title={CARD_SITUATION_TITLE} open controls={`${uid}-sit`}>
        {report.situation.trim()
          ? <p className="py-1.5 text-[14.5px] leading-[22px] text-gray-900">{report.situation}</p>
          : <p className="py-1.5 text-[12.5px] text-gray-500">{NO_SITUATION}</p>}
      </Card>

      {/* ── WHAT APPLIES — green, open, the first authority open. ──────────── */}
      {report.applies.length > 0 && (
        <Card tint={CARD_APPLIES} title={words?.heading ? words.heading(total) : CARD_APPLIES_TITLE}
          count={words?.heading ? GROUPS_COUNT(report.applies.length)
                                : APPLIES_COUNT(total, report.applies.length)}
          open={cards.applies} onToggle={() => flip('applies')} controls={`${uid}-app`}
          right={
            <span className="no-print ml-auto text-[12px] text-[var(--green-ink)] hover:underline"
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); e.stopPropagation()
                setOpen(allOpen ? new Set() : new Set(report.applies.map((_, gi) => gi)))
              } }}
              onClick={(e) => {
                // The header is itself a button; without this the card folds as well.
                e.stopPropagation()
                setOpen(allOpen ? new Set() : new Set(report.applies.map((_, gi) => gi)))
              }}>
              {allOpen ? 'Close all' : 'Open all'}
            </span>
          }>
          {report.applies.map((g, gi) => {
            const id = `${uid}-a${gi}`
            return (
              <div key={g.authority + gi} className="border-t border-gray-100 first:border-t-0">
                <button type="button" onClick={() => toggle(gi)} aria-expanded={open.has(gi)} aria-controls={id}
                  className="flex w-full items-center gap-2 pb-1.5 pt-2.5 text-left hover:bg-gray-50">
                  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`no-print shrink-0 text-gray-400 transition-transform ${open.has(gi) ? 'rotate-90' : ''}`}>
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                  <span className="min-w-0 flex-1 text-[14px] font-medium text-gray-900">{g.authority}</span>
                  {/* Decision 59: a fixed, right-hand column, so every count lands on one edge. */}
                  <span className="w-[110px] shrink-0 text-right text-[12px] text-gray-500">
                    {(words?.perGroup ?? thingsToDo)(g.items.length)}
                  </span>
                </button>
                <ul id={id} className={open.has(gi) ? '' : 'fold-closed'}>
                  {g.items.map((it, i) => item(it, `${gi}-${i}`))}
                </ul>
              </div>
            )
          })}
        </Card>
      )}

      {/* ── STILL TO CONFIRM — amber, folded, its count says what it means. ── */}
      {report.to_confirm.length > 0 && (
        <Card tint={CARD_CONFIRM} title={CARD_CONFIRM_TITLE} count={CONFIRM_COUNT(report.to_confirm.length)}
          open={cards.confirm} onToggle={() => flip('confirm')} controls={`${uid}-con`}
          right={
            /* The card's own way out, on the header line. A `span` inside the header button, as
               "Open all" is, so one control does not sit inside another. */
            <span className="no-print ml-auto whitespace-nowrap text-[12px] underline underline-offset-2"
              role="link" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); window.location.href = CONFIRM_HREF_ALL } }}
              onClick={(e) => { e.stopPropagation(); window.location.href = CONFIRM_HREF_ALL }}>
              {CONFIRM_LINK}
            </span>
          }>
          <ul>{report.to_confirm.map((it, i) => item(it, `c-${i}`, true))}</ul>
        </Card>
      )}

      {/* ── NOT ANSWERED HERE — pale, folded, and polite. ──────────────────── */}
      {report.unanswered.length > 0 && (
        <Card tint={CARD_QUIET} title={CARD_UNANSWERED_TITLE} count={UNANSWERED_COUNT(report.unanswered.length)}
          open={cards.unanswered} onToggle={() => flip('unanswered')} controls={`${uid}-una`}>
          <ul className="list-disc space-y-1.5 py-1 pl-[26px] text-[13.5px] leading-[20px] text-gray-700">
            {report.unanswered.map((q, i) => (
              <li key={i}>{q} — <span className="text-gray-500">{UNANSWERED_LINE}</span></li>
            ))}
          </ul>
        </Card>
      )}

      {factsLine}

      {/* ── SOURCES — pale, folded, the full titles. ───────────────────────── */}
      {report.sources.length > 0 && (
        <Card tint={CARD_QUIET} title={CARD_SOURCES_TITLE} count={String(report.sources.length)}
          open={cards.sources} onToggle={() => flip('sources')} controls={`${uid}-src`}>
          <ol className="space-y-1.5 py-1">
            {report.sources.map((src) => (
              <li key={src.n} className="flex gap-2 text-[12.5px] leading-[18px]">
                <span className="shrink-0 text-gray-400">{src.n}.</span>
                {sourceShape.entry(src)}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}
