/**
 * HOW THE DOCUMENTS LIST GROUPS AND COUNTS — decision 70, 5 November 2026 (the owner).
 *
 * Pure, and in its own file for the reason `lib/summaryWords.ts` is: the page that draws it is a
 * client component, and the two rules below are arithmetic that has to be TESTED rather than
 * looked at. Nothing here reads a database or a clock it was not handed.
 *
 * *** THE DEFAULT GROUP IS THE DAY A FILE ARRIVED, NEWEST FIRST. *** It was Status, and Status
 * answers "what needs work"; the list is also where somebody goes a minute after dropping a
 * folder in, to watch it being read. Grouped by day, a batch lands together under one heading
 * and its progress has somewhere to sit. Status is still one choice away.
 */

/** Today, then each day of the last week by name, then by month. The key sorts newest first. */
export interface DayGroup { key: string; label: string }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/** The local day as `YYYY-MM-DD`, from an ISO timestamp. */
export function dayOf(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '0000-00-00'
  void now
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Which group a row belongs in, and what that group is called.
 *
 * **Today and yesterday are named**, because that is how a person refers to a folder they just
 * added. **The rest of this month is the day**, "2 November" — the year is left off a date
 * inside the current year, as every other date on this page is. **Older than this month is the
 * month**, "October", or "October 2025" once the year is not this one.
 */
export function dayGroup(iso: string, now = new Date()): DayGroup {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { key: '0000', label: 'Date unknown' }
  const day = dayOf(iso)
  const today = dayOf(now.toISOString())
  const yest = dayOf(new Date(now.getTime() - 86_400_000).toISOString())
  if (day === today) return { key: day, label: 'Today' }
  if (day === yest) return { key: day, label: 'Yesterday' }
  const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  if (sameMonth) return { key: day, label: `${d.getDate()} ${MONTHS[d.getMonth()]}` }
  const sameYear = d.getFullYear() === now.getFullYear()
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    label: sameYear ? MONTHS[d.getMonth()] : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  }
}

/** "8 files" — on a day group's header, where the number alone would read as a status count. */
export const filesWord = (n: number) => `${n} file${n === 1 ? '' : 's'}`

/**
 * *** HOW LONG IS LEFT, AND WHERE THE NUMBER COMES FROM — decision 70, and the honest answer is
 * "the batch's own elapsed average". ***
 *
 * W1: a folder of nine files showed nothing for eleven minutes and the owner pressed "Read it
 * again" on a file that was simply waiting its turn. The sweep reads **one document at a time**
 * and took 10 minutes 24 seconds for those nine.
 *
 * **The sweep records no per-document timing, and that was checked rather than assumed.**
 * `document_scans` has `scanned_at` (when a reading finished) and no start; `documents.reading_since`
 * is cleared when the reading lands — read on staging, **0 rows of 47 still carry it**. The run
 * records `wall_ms` for the whole sweep, which covers other companies' documents too. So the
 * estimate is decision 70's own fallback: **the elapsed time of this batch divided by what it
 * has finished**, which needs nothing but the batch row the page already has.
 *
 * It says nothing until one document is done, because an average of none is not an estimate —
 * and nothing it says is ever precise: "about 3 minutes left", to the minute, never seconds.
 */
export function readingProgress(
  batch: { file_count: number; done_count: number; created_at: string },
  now = new Date(),
): { done: number; total: number; fraction: number; line: string } | null {
  const total = Math.max(0, Number(batch.file_count) || 0)
  const done = Math.min(total, Math.max(0, Number(batch.done_count) || 0))
  if (!total || done >= total) return null
  const started = new Date(batch.created_at).getTime()
  const elapsed = Number.isNaN(started) ? 0 : Math.max(0, now.getTime() - started)
  const per = done > 0 ? elapsed / done : 0
  const leftMs = per * (total - done)
  return {
    done, total, fraction: total ? done / total : 0,
    line: `${READING_IN_BACKGROUND} · ${done} of ${total} done${per ? ` · ${aboutLeft(leftMs)}` : ''}`,
  }
}

/** "about 3 minutes left" · "about a minute left" · "under a minute left". Never seconds. */
export function aboutLeft(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins <= 0) return 'under a minute left'
  if (mins === 1) return 'about a minute left'
  return `about ${mins} minutes left`
}

/** The words on a day group's progress line. */
export const READING_IN_BACKGROUND = 'Reading in the background'
