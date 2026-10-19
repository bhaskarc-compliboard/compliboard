'use client'
/**
 * DATES TO CONFIRM — board 7, the work queue (Calendar step 9).
 *
 * Every row here is already on the Calendar tab: this tab only shortens the work of saying "yes,
 * that is right" to a reading that proposed seven dates at once. Grouped by where the dates came
 * from, newest deadline first, with Confirm and Not right on every row and one button per group.
 *
 * *** THE SHAPE AND THE WORDS COME FROM `lib/calendarQueue.ts`; THE SPACING, TYPE AND COLOUR COME
 * FROM THE SHARED COMPONENTS. *** The same division as every step since 7: the boards say what is
 * said, the components say how it looks, and nothing is taken from the boards' own CSS.
 *
 * *** IT WRITES THROUGH `PATCH /api/calendar` AND NOWHERE ELSE *** — `confirm`, `confirm_many` and
 * `dismiss` over `lib/calendarDates.ts`, the one writer (decision 6). It builds no row, names no
 * status, and does no date arithmetic.
 *
 * *** A FAILED WRITE IS SAID BESIDE THE ROW IT FAILED ON, AND THE ROW STAYS. *** The owner's rule
 * for this step, and §5.1's: the queue never removes a row on the strength of a request it has not
 * seen succeed. Confirming re-reads everything through the page's own `load()`, so the list, both
 * tab counts, the info bar and the sidebar badge move together or not at all.
 */
import { useState } from 'react'
import { authHeaders } from '@/lib/supabase'
import { Empty } from '@/components/Empty'
import { RemoveDateSheet } from '@/components/RemoveDateSheet'
import { PERIOD_CHOICES, type CalendarRow } from '@/lib/calendarView'
import {
  queueGroups, queueWhen, queueMeta, needsPeriod, idsShown, groupCount, confirmAllLabel,
  waitingRows, needsWhenRows, needsWhenGroups, QUEUE_BAR, QUEUE_EMPTY_TITLE, QUEUE_EMPTY_NOTE,
  NEEDS_WHEN_HEADING, NEEDS_WHEN_NOTE, NEEDS_WHEN_ID,
  CONFIRM, NOT_RIGHT, DONT_KNOW_YET, HOW_OFTEN, ROW_FAILED, GROUP_FAILED, type DocumentHead,
} from '@/lib/calendarQueue'

const OUTLINE = 'rounded-md border border-[var(--green)] px-3 py-1 text-[13px] font-medium '
  + 'text-[var(--green)] hover:bg-green-50 disabled:opacity-50'
const TEXT_ACTION = 'text-[13px] text-gray-500 hover:text-gray-900 hover:underline disabled:text-gray-300'

export function DateQueue({ rows, heads, siteCount, onOpen, onChanged }: {
  /** Every live row the page read. The queue takes the `proposed` ones through `waitingRows`. */
  rows: CalendarRow[]
  /** `document_index_v` facts by document id, for the group headings' kind word and reading day. */
  heads: Record<string, DocumentHead>
  siteCount: number
  /** Clicking the row opens the same drawer the two views open, through `?date=`. */
  onOpen: (id: string) => void
  /** Re-read everything, so every number on the page moves in one render. */
  onChanged: () => Promise<void> | void
}) {
  /** Which row or group is in flight, and what failed where. Keyed by id, never a single flag. */
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<Record<string, string>>({})
  /** The picker's choice per row. '' is "I don't know yet", which is a real answer (decision 23). */
  const [period, setPeriod] = useState<Record<string, string>>({})
  /** Board 8's sheet, opened by one row's "Not right". */
  const [notRight, setNotRight] = useState<CalendarRow | null>(null)
  const [reason, setReason] = useState('')

  const waiting = waitingRows(rows)
  const groups = queueGroups(rows, heads)
  /**
   * THE SECOND SECTION'S ROWS AND GROUPS (step 14b). Every LIVE row with no day, proposed or
   * confirmed — a different question from the queue's, asked of a different set, and a proposed
   * row with no day is in both on purpose (`lib/calendarQueue.ts` says why).
   */
  const needsWhen = needsWhenRows(rows)
  const needsGroups = needsWhenGroups(rows, heads)

  /** One PATCH, and the page re-read only when the route said yes. */
  async function send(key: string, body: Record<string, unknown>, failure: string): Promise<boolean> {
    setBusy(key)
    // The previous failure for this row or group goes before the retry, so a stale sentence is
    // never left sitting under a row that is being written again.
    setFailed((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)))
    try {
      const res = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        // The route's own sentence, which is written for a person (§5.1) — never a status code.
        const j = await res.json().catch(() => null)
        setFailed((f) => ({ ...f, [key]: j?.error ?? failure }))
        return false
      }
      await onChanged()
      return true
    } catch {
      setFailed((f) => ({ ...f, [key]: failure }))
      return false
    } finally { setBusy(null) }
  }

  /**
   * *** "NOTHING WAITING" IS NOW ONLY TRUE WHEN BOTH SECTIONS ARE EMPTY. ***
   * Until step 14b this component returned the empty state the moment the QUEUE was empty, which
   * from this step on would have drawn "Nothing waiting" over a tab holding seven dates that need
   * a day — the §5.1 failure this very tab has already had once (the page's own comment records
   * the read-that-failed version of it). The empty state still belongs to the queue and keeps its
   * words; what changes is that it no longer ends the component.
   */
  if (waiting.length === 0 && needsWhen.length === 0) {
    return <Empty title={QUEUE_EMPTY_TITLE} note={QUEUE_EMPTY_NOTE} />
  }

  return (<>
    {/* Board 7's line under the tabs, in the info bar's own place and type. */}
    {waiting.length > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <p className="text-[13px] text-gray-500">{QUEUE_BAR}</p>
      </div>
    )}
    {waiting.length === 0 && <Empty title={QUEUE_EMPTY_TITLE} note={QUEUE_EMPTY_NOTE} />}

    {groups.map((g) => (
      <div key={g.key} className="mt-5">
        {/* THE GROUP HEADING: where these dates came from, how many, and one button for all of
            them. The button sends THE IDS DRAWN BELOW IT (`idsShown`) — a date that arrived since
            this page loaded is not confirmed by somebody who never saw it. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="min-w-0 text-[13px] font-medium text-gray-700">
            <span className="break-words">{g.heading}</span>
            <span className="text-gray-400"> · {groupCount(g.rows.length)}</span>
          </p>
          {/* `ml-auto` so the button stays at the right-hand end even when a long heading wraps it
              onto its own line — photographed at 1280 against a document whose title runs the
              width of the column, where it had landed on the left and read as a second line of
              the heading rather than as the action it is. */}
          <button disabled={busy !== null} className={`${TEXT_ACTION} ml-auto shrink-0`}
            onClick={async () => {
              await send(`group:${g.key}`, { action: 'confirm_many', ids: idsShown(g) }, GROUP_FAILED)
            }}>
            {busy === `group:${g.key}` ? 'Confirming…' : confirmAllLabel(g.kind)}
          </button>
        </div>
        {failed[`group:${g.key}`] && (
          <p className="mt-1 text-[12px] text-amber-800">{failed[`group:${g.key}`]}</p>
        )}

        <div className="mt-1.5 divide-y divide-gray-100 border-y border-gray-100">
          {g.rows.map((r) => (
            <div key={r.id} className="py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                {/* The row itself opens the drawer — the same `?date=` the month and the list use,
                    so there is one place a date is explained. */}
                <button onClick={() => onOpen(r.id)} className="group min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">
                    {r.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-gray-500">
                    <span className="text-gray-600">{queueWhen(r)}</span>
                    {queueMeta(r, siteCount).map((part) => (
                      <span key={part}><span aria-hidden="true"> · </span>{part}</span>
                    ))}
                  </span>
                  {/* The line it was read from, in quotes, exactly as board 7 draws it. */}
                  {r.source_line && (
                    <span className="mt-0.5 block truncate text-[12px] italic text-gray-500">
                      &ldquo;{r.source_line}&rdquo;
                    </span>
                  )}
                </button>

                <div className="flex shrink-0 items-center gap-3">
                  {/* A REPEATING DATE WITH NO PERIOD GETS THE PICKER BESIDE CONFIRM, and its
                      default is "I don't know yet" — so Confirm always works, and choosing nothing
                      confirms the date and leaves the period null, which keeps it in the strip
                      with its own sentence rather than inventing a frequency (decisions 23, 30). */}
                  {needsPeriod(r) && (
                    <select value={period[r.id] ?? ''} aria-label={HOW_OFTEN}
                      onChange={(e) => setPeriod((p) => ({ ...p, [r.id]: e.target.value }))}
                      className="cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 outline-none focus:border-[var(--green)]">
                      <option value="">{DONT_KNOW_YET}</option>
                      {PERIOD_CHOICES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  )}
                  <button disabled={busy !== null} className={OUTLINE}
                    onClick={async () => {
                      // Confirming WITH a period is one call, so the date is never confirmed with
                      // the frequency left behind (`lib/calendarDates.ts` `confirmDate`).
                      const chosen = needsPeriod(r) ? (period[r.id] || null) : undefined
                      await send(r.id, {
                        id: r.id, action: 'confirm',
                        ...(chosen === undefined ? {} : { period: chosen }),
                      }, ROW_FAILED)
                    }}>
                    {busy === r.id ? 'Confirming…' : CONFIRM}
                  </button>
                  <button disabled={busy !== null} className={TEXT_ACTION}
                    onClick={() => { setReason(''); setNotRight(r) }}>
                    {NOT_RIGHT}
                  </button>
                </div>
              </div>
              {failed[r.id] && <p className="mt-1 text-[12px] text-amber-800">{failed[r.id]}</p>}
            </div>
          ))}
        </div>
      </div>
    ))}

    {/*
      *** NEEDS A DAY OR HOW OFTEN — decision 32, Calendar step 14b. ***
      Below the queue, grouped the same way, with no Confirm and no picker on the row: the question
      here is WHEN, and it is answered in the drawer where the whole date is. The heading carries
      its own count; the tab's count above is still the queue's.
    */}
    {needsWhen.length > 0 && (
      <div id={NEEDS_WHEN_ID} className="mt-8 border-t border-gray-200 pt-5">
        <p className="text-[13px] font-medium text-gray-700">{NEEDS_WHEN_HEADING(needsWhen.length)}</p>
        <p className="mt-0.5 text-[13px] text-gray-500">{NEEDS_WHEN_NOTE}</p>
        {needsGroups.map((g) => (
          <div key={g.key} className="mt-4">
            <p className="min-w-0 text-[13px] font-medium text-gray-700">
              <span className="break-words">{g.heading}</span>
              <span className="text-gray-400"> · {groupCount(g.rows.length)}</span>
            </p>
            <div className="mt-1.5 divide-y divide-gray-100 border-y border-gray-100">
              {g.rows.map((r) => (
                <button key={r.id} onClick={() => onOpen(r.id)}
                  className="group block w-full py-2.5 text-left">
                  <span className="block truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">
                    {r.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-gray-500">
                    <span className="text-gray-600">{queueWhen(r)}</span>
                    {queueMeta(r, siteCount).map((part) => (
                      <span key={part}><span aria-hidden="true"> · </span>{part}</span>
                    ))}
                  </span>
                  {r.source_line && (
                    <span className="mt-0.5 block truncate text-[12px] italic text-gray-500">
                      &ldquo;{r.source_line}&rdquo;
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}

    {/* BOARD 8, the same sheet the drawer's Remove opens, with its other title. */}
    {notRight && (
      <RemoveDateSheet mode="not-right" reason={reason} onReason={setReason}
        busy={busy === notRight.id} error={failed[notRight.id] ?? null}
        onClose={() => setNotRight(null)}
        onRemove={async () => {
          const row = notRight
          if (await send(row.id, { id: row.id, action: 'dismiss', reason }, ROW_FAILED)) {
            setNotRight(null)
          }
        }} />
    )}
  </>)
}
