/**
 * WHAT THE CALENDAR TAB SHOWS, WORKED OUT ONCE — Calendar step 8a (`docs/CALENDAR-PLAN.md` step 8a,
 * boards 4, 5 and 6 in `docs/calendar-boards.html`).
 *
 * The month grid, the list's groups, and every phrase either of them says. It is a separate file
 * from the page for the reason `lib/listWords.ts` is separate from the workspace: a rule inside
 * markup is a rule nothing tests, and every sentence here is one the owner wrote.
 *
 * *** NO DATE ARITHMETIC ABOUT *WHEN A DATE FALLS* HAPPENS HERE. *** `next_due`, `days_until` and
 * `has_passed` are computed by `calendar_v` against the server's `current_date` (migration 075's
 * definition; migration 049's rule that nothing derived is stored). A one-off IS its own day; a
 * repeating date with a period is its next occurrence; a repeating date with no day or no period
 * has no honest next date at all and `next_due` is null (decisions 12 and 23). This file arranges
 * what the view returns and never second-guesses it — a page working "today" out for itself
 * disagrees with the view by a day for everybody west of UTC, which is everybody this product
 * sells to. The ONE calendar computed here is the shape of a month's grid, which is a property of
 * the Gregorian calendar and not of any row.
 *
 * *** BROWSER-SAFE: IT IMPORTS A TYPE AND `lib/calendarCounts.ts`, WHICH IMPORTS `lib/listWords.ts`,
 * WHICH IMPORTS NOTHING. *** `tests/unit/clientImports.test.ts` covers every client file's imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { liveDates } from './calendarCounts.ts'

/**
 * The columns the Calendar tab and its drawer read. One list, because the drawer opens on a row the
 * grid already has and must never need a second shape of the same thing.
 */
export const CALENDAR_VIEW_COLUMNS =
  'id, title, description, due_date, next_due, days_until, has_passed, status, source, recurs, period, '
  + 'source_line, source_url, source_page, source_title, site_id, site_name, entity_id, '
  + 'document_id, handbook_id, audit_finding_id, deadline_id, '
  + 'added_by, confirmed_by, confirmed_at, dismissed_by, dismissed_at, dismissed_reason, replaced_by, created_at'

/** One `calendar_v` row, as this section reads it. */
export interface CalendarRow {
  id: string
  title: string
  description: string | null
  due_date: string | null
  next_due: string | null
  days_until: number | null
  has_passed: boolean | null
  status: string
  source: string
  recurs: boolean
  period: string | null
  source_line: string | null
  source_url: string | null
  source_page: string | null
  source_title: string | null
  site_id: string | null
  site_name: string | null
  entity_id: string | null
  document_id: string | null
  handbook_id: string | null
  audit_finding_id: string | null
  deadline_id: string | null
  added_by: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  dismissed_by: string | null
  dismissed_at: string | null
  dismissed_reason: string | null
  replaced_by: string | null
  created_at: string | null
}

/**
 * Every live date for the signed-in person's company, through the one filter the counts use.
 *
 * *** IT THROWS RATHER THAN RETURNING AN EMPTY LIST, AND THAT IS THE WHOLE POINT. ***
 * This was written as `const { data } = await …; return data ?? []`, which is how every other read
 * on this page is written — and during step 8a's screenshots the Calendar tab drew **"No dates yet"
 * over a company with ten dates**, beside tabs that read "Calendar (10)" from the counts query
 * alongside it. One run in about six; the rows came back fine on every other.
 *
 * Whatever made that one read fail, swallowing its error turned it into a SENTENCE: "no dates" is
 * a claim about the customer's compliance, and it was false. That is `CLAUDE.md` §5.1's worked
 * example — "no dates found" and "we could not read it" returned an identical empty array, so the
 * caller could not tell them apart — and §9a's: a check that cannot see anything looks exactly
 * like a check that found nothing. So the error leaves this function, and the page says it.
 */
export async function readCalendarRows(db: SupabaseClient): Promise<CalendarRow[]> {
  const { data, error } = await liveDates(db, CALENDAR_VIEW_COLUMNS)
  if (error) throw new Error(`calendar_v: ${error.message}`)
  return (data ?? []) as unknown as CalendarRow[]
}

/** What the page says when that read did not answer. Never "no dates". */
export const COULD_NOT_LOAD =
  'We could not load your dates just now. Nothing has changed — please try again.'

// ---------------------------------------------------------------------------------------------
// DATES AS THE DATABASE HANDS THEM OVER
// ---------------------------------------------------------------------------------------------

/**
 * A DATE COLUMN, CUT TO ITS DAY. PostgREST returns a `date` as "2026-11-30", and the same column
 * read through some other path can arrive as "2026-11-30T00:00:00Z". Both mean the same day, and
 * the day is all a calendar cares about; anything else returns ''.
 */
export const dayOf = (iso: string | null | undefined): string => {
  const s = String(iso ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

/** The month a day belongs to, "2026-11". */
export const monthOf = (iso: string | null | undefined): string => dayOf(iso).slice(0, 7)

/** "November 2026" — a month heading, in UTC so it does not move with the viewer's clock. */
export function monthTitle(key: string): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return ''
  return new Date(`${key}-01T00:00:00Z`)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "15 November 2026" — a date written out. */
export function longDay(iso: string | null | undefined): string {
  const d = dayOf(iso)
  return d ? new Date(`${d}T00:00:00Z`)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
}

/** "15 November 2026 (Sunday)" — the drawer's When line, because the weekday is what people plan around. */
export function longDayAndWeekday(iso: string | null | undefined): string {
  const d = dayOf(iso)
  if (!d) return ''
  const weekday = new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
  return `${longDay(d)} (${weekday})`
}

/** "20 Aug" — the anchor a repeating date counts from. */
export function dayAndShortMonth(iso: string | null | undefined): string {
  const d = dayOf(iso)
  return d ? new Date(`${d}T00:00:00Z`)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''
}

// ---------------------------------------------------------------------------------------------
// THE WORDS
// ---------------------------------------------------------------------------------------------

/** The five periods, in the words a person reads. `null` is "how often was not read" (decision 23). */
export const PERIOD_LABEL: Record<string, string> = {
  month: 'every month',
  quarter: 'every 3 months',
  '6 months': 'every 6 months',
  year: 'every year',
  '2 years': 'every 2 years',
}
/** The same five, as a picker lists them (the owner's words on board 9). */
export const PERIOD_CHOICES: Array<{ value: string; label: string }> =
  Object.entries(PERIOD_LABEL).map(([value, label]) => ({ value, label }))

/**
 * HOW OFTEN IT REPEATS, AND FROM WHEN. "every year", or "every year from 20 Aug" when there is an
 * anchor to count from. A repeating date whose period was never read says so in its own sentence
 * (`PERIOD_NOT_READ`), not here — this returns '' rather than inventing a frequency.
 */
export function repeatWords(row: Pick<CalendarRow, 'recurs' | 'period' | 'due_date'>): string {
  if (!row.recurs) return ''
  const how = row.period ? PERIOD_LABEL[row.period] : ''
  if (!how) return ''
  const from = dayAndShortMonth(row.due_date)
  return from ? `${how} from ${from}` : how
}

/**
 * HOW FAR AWAY IT IS — the list's right-hand column. A date HAS PASSED; it is never "overdue" and
 * never "done" (decision 11). `days_until` is the view's, so "today" is the server's today.
 */
export function whenWords(row: Pick<CalendarRow, 'days_until' | 'next_due'>): string {
  if (row.days_until === null || row.days_until === undefined || !dayOf(row.next_due)) return 'no day yet'
  const n = row.days_until
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

/** "passed 12 days ago" — the amber note on a one-off whose day is behind us. */
export function passedWords(row: Pick<CalendarRow, 'has_passed' | 'days_until'>): string {
  if (!row.has_passed) return ''
  const n = row.days_until === null || row.days_until === undefined ? 0 : -row.days_until
  if (n <= 0) return 'passed today'
  return n === 1 ? 'passed yesterday' : `passed ${n} days ago`
}

/** Lower case, as board 6 shows it: the normal condition of a date read yesterday, not an alarm. */
export const NOT_CONFIRMED = 'not confirmed'

/** Decision 23 and decision 30: it repeats, and nobody read how often. */
export const PERIOD_NOT_READ =
  "This date repeats, but how often wasn't read. Pick how often, and we'll work out the next one."
/** Decision 27, the line the first tab ends on. */
export const ALREADY_HANDLED =
  'If you have already handled this, add the proof in Company Documents and it will show here.'
/** Decision 14: the document moved on, the date stays. */
export const NEWER_VERSION =
  'This document has a newer version. The date below was read from this one; the newer version may say something else.'
export const DOCUMENT_GONE =
  'The document this date was read from has been deleted. The date stays until you remove it.'
/** Decision 24, through the view: the site the document sat on is not there any more. */
export const SITE_REMOVED = 'Site removed — choose where it applies'
/** The same state as one line in a list of choices: HR's own group label (`lib/handbooks.ts`). */
export const SITE_REMOVED_SHORT = 'Site removed'
/** A company-wide date. `entity_id` null is a real value, not a gap. */
export const EVERY_SITE = 'Every site'
/** The list's last group — the owner's words, step 8a. */
export const UNDATED_GROUP = "Repeats — how often or when wasn't read yet"
/** The strip above the month grid, which cannot hold a date with no day. */
export const UNDATED_STRIP = (n: number) => `Repeating, day not read yet (${n})`
/** A link that points at a date the calendar no longer carries. */
export const NOT_ON_CALENDAR =
  "That date isn't on the calendar any more. If it should be, add it with + Add a date."

/**
 * WHICH SITE A ROW SAYS IT IS FOR, or '' for "say nothing".
 *
 * *** WITH ONE SITE, NOTHING ABOUT SITES SHOWS *** — decision 24, and the rule HR already follows
 * (`app/hr/HrWorkspace.tsx:521` asks where a handbook applies only at `sites.length >= 2`;
 * `app/documents/page.tsx:793` shows its site filter only at `sites.length > 1`). A company with
 * one plant does not need to be told which plant, on every row, forever.
 */
export function siteWords(row: Pick<CalendarRow, 'site_id' | 'entity_id' | 'site_name'>, siteCount: number): string {
  if (siteCount < 2) return ''
  if (row.site_name) return row.site_name
  // The row names a site the company no longer has: the view joined and found nothing.
  if (row.site_id || row.entity_id) return SITE_REMOVED
  return EVERY_SITE
}

/**
 * THE LIST ROW'S META LINE, in board 5's order: the day (or how often, for an undated repeating
 * date), how often it repeats when it also has a day, the site, where it was read from, and its
 * state. Each part is left out when there is nothing true to put there.
 */
export function metaParts(row: CalendarRow, siteCount: number, addedByName?: string | null): string[] {
  const out: string[] = []
  const day = longDay(row.next_due)
  const repeat = repeatWords(row)
  if (day) {
    out.push(day)
    if (repeat) out.push(repeat)
  } else {
    // No day: how often is all there is, and when that was not read either, say THAT.
    out.push(repeat || "how often wasn't read")
  }
  const site = siteWords(row, siteCount)
  if (site) out.push(site)
  // Where it came from. A typed date has no `source_title` — the board puts the person there
  // instead, because "somebody here decided this" is exactly as much provenance as a document is.
  if (row.source_title) out.push(row.source_title)
  else if (row.source === 'person') out.push(addedByName ? `Added by ${addedByName}` : 'Added by hand')
  const passed = passedWords(row)
  if (passed) out.push(passed)
  else if (row.status === 'proposed') out.push(NOT_CONFIRMED)
  return out
}

// ---------------------------------------------------------------------------------------------
// THE TWO VIEWS
// ---------------------------------------------------------------------------------------------

/** A date with no day cannot sit on a calendar: it belongs to the strip and to the last group. */
export const hasNoDay = (r: CalendarRow): boolean => !dayOf(r.next_due)

export interface MonthGroup { key: string; title: string; rows: CalendarRow[] }

/**
 * THE LIST, GROUPED BY MONTH, SOONEST FIRST — and the dates with no day in their own group at the
 * foot. A passed date sits in ITS OWN month, which is in the past and therefore first: that is
 * where somebody looking for it would go, and hiding it would be the product deciding a date it
 * read no longer counts.
 */
export function listGroups(rows: CalendarRow[]): { months: MonthGroup[]; undated: CalendarRow[] } {
  const byMonth = new Map<string, CalendarRow[]>()
  const undated: CalendarRow[] = []
  for (const r of rows) {
    if (hasNoDay(r)) { undated.push(r); continue }
    const k = monthOf(r.next_due)
    if (!byMonth.has(k)) byMonth.set(k, [])
    byMonth.get(k)!.push(r)
  }
  const months = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({
      key,
      title: monthTitle(key),
      rows: list.slice().sort((a, b) =>
        dayOf(a.next_due).localeCompare(dayOf(b.next_due)) || a.title.localeCompare(b.title)),
    }))
  return { months, undated: undated.slice().sort((a, b) => a.title.localeCompare(b.title)) }
}

export interface DayCell {
  /** The day this cell is, "2026-11-15". Every cell has one, including the ones from other months. */
  day: string
  /** The number shown in the corner. */
  n: number
  /** False for the days either side of the month, which are drawn faint. */
  inMonth: boolean
  rows: CalendarRow[]
}

/**
 * THE MONTH'S GRID — whole weeks, Monday first, as board 4 draws it. Always SIX weeks, so the grid
 * is the same height in February as in a month that spills over five rows: a view that changes
 * height when you press "next month" makes the page jump under the pointer.
 *
 * This is the one piece of date arithmetic in the file, and it is about the Gregorian calendar
 * rather than about any row: which days are in the box. Every date a row is placed on is the
 * view's `next_due`, untouched.
 */
export function monthGrid(key: string, rows: CalendarRow[]): DayCell[] {
  if (!/^\d{4}-\d{2}$/.test(key)) return []
  const first = new Date(`${key}-01T00:00:00Z`)
  // getUTCDay: Sunday is 0. Monday-first means Sunday sits at the end of a week.
  const lead = (first.getUTCDay() + 6) % 7
  const start = new Date(first)
  start.setUTCDate(start.getUTCDate() - lead)
  const onDay = new Map<string, CalendarRow[]>()
  for (const r of rows) {
    const d = dayOf(r.next_due)
    if (!d) continue
    if (!onDay.has(d)) onDay.set(d, [])
    onDay.get(d)!.push(r)
  }
  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    const day = d.toISOString().slice(0, 10)
    cells.push({
      day,
      n: d.getUTCDate(),
      inMonth: day.slice(0, 7) === key,
      rows: (onDay.get(day) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title)),
    })
  }
  return cells
}

/** The month to open on: the one holding the soonest date still ahead, else this month. */
export function openingMonth(rows: CalendarRow[], today: string): string {
  const ahead = rows.filter((r) => !hasNoDay(r) && !r.has_passed).map((r) => dayOf(r.next_due)).sort()
  return monthOf(ahead[0] ?? today) || monthOf(today)
}

/**
 * WHICH ROW A LINK FROM ANOTHER SECTION POINTS AT — `?date=<calendar_events.id>` from the Documents
 * drawer, `?finding=<audit finding id>` from an audit's (§187). Resolved against the rows the page
 * has already read, which is what makes the answer honest: a row that is not in `calendar_v` for
 * this caller is not here either, whether it was removed, withdrawn by the newest reading
 * (decision 29), or belongs to another company — RLS decided that, not this function.
 *
 * Null is an answer and the page says it in words (`NOT_ON_CALENDAR`). It is deliberately the SAME
 * answer for all three cases: distinguishing "removed" from "not yours" would tell a stranger that
 * an id exists, which is the probe `CLAUDE.md` §3.6 answers 404 rather than 403 to.
 */
export function resolveLink(
  rows: CalendarRow[], dateId: string | null, findingId: string | null,
): CalendarRow | null {
  if (dateId) return rows.find((r) => r.id === dateId) ?? null
  if (findingId) return rows.find((r) => r.audit_finding_id === findingId) ?? null
  return null
}

/**
 * WHAT THE SAME DOCUMENT ASKS BEFORE THIS DATE — board 6's third section, built at step 8b.
 *
 * *** IT IS THE DOCUMENT'S OTHER DATES, BECAUSE NOTHING ELSE IN THE DOCUMENT FAMILY HAS A DAY. ***
 * The board's example is a dated CONDITION — "Condition 19 asks for the renewal application by
 * 16 September 2026". `document_conditions` carries `title`, `condition_ref`, `evidence_expected`
 * and `ordinal`, and **no date**; `document_gaps` carries `locator`, `quote`, `fix` and **no date**
 * either (both read from `lib/database.types.ts`). The only dated thing a document produces is a
 * `document_deadlines` row, which IS a calendar row. So "before this date" can only honestly mean
 * the same document's other live dates that fall earlier — which is real, and is what a person
 * opening a permit's expiry wants to see: the things that must happen first.
 *
 * A date with no day cannot be "before" anything, and neither can anything when THIS date has no
 * day: both cases put every sibling in `others`, and the page omits the empty section.
 */
export function splitSiblings(
  open: Pick<CalendarRow, 'next_due'>, siblings: CalendarRow[],
): { before: CalendarRow[]; others: CalendarRow[] } {
  const mine = dayOf(open.next_due)
  if (!mine) return { before: [], others: siblings }
  const before: CalendarRow[] = []
  const others: CalendarRow[] = []
  for (const s of siblings) {
    const d = dayOf(s.next_due)
    ;(d && d < mine ? before : others).push(s)
  }
  const bySoonest = (a: CalendarRow, b: CalendarRow) => dayOf(a.next_due).localeCompare(dayOf(b.next_due))
  return { before: before.sort(bySoonest), others }
}

/**
 * WHAT IS WRONG WITH A TYPED DATE, OR NULL — board 9's two refusals, as a function so they are
 * tested rather than asserted about markup.
 *
 * The two rules are the database's own, asked here so a person reads a sentence instead of a
 * constraint error: a title, because a date with no name is a row nobody can act on; and a day,
 * but **only when the date happens once** — migration 060's rule, carried into 073's
 * `calendar_events_date_or_recurs`. A repeating date with no day is a real, honest state
 * (decision 23) and the calendar shows it in the strip above the grid.
 */
export const NEED_A_TITLE = 'Please say what this date is.'
export const NEED_A_DAY = 'A date that happens once needs a day. Give one, or say that it repeats.'

export function addDateProblem(
  draft: { title: string; when: string; recurs: boolean },
): string | null {
  if (!draft.title.trim()) return NEED_A_TITLE
  if (!draft.recurs && !dayOf(draft.when)) return NEED_A_DAY
  return null
}

/** Board 6's heading for that section. */
export const ASKS_BEFORE = (n: number) => `What this document asks before then · ${n}`

/**
 * WHICH SITE A ROW BELONGS TO, for the info bar's filter — the site's id, or 'every' for a
 * company-wide date, or 'removed' when the row names a site the company no longer has. The same
 * three buckets HR's `handbookList` uses (`lib/handbooks.ts` `groupKey`), for the same reason: a
 * removed site is a real state and must not be filed under "Every site".
 */
export const siteKeyOf = (r: Pick<CalendarRow, 'site_id' | 'entity_id' | 'site_name'>): string => {
  if (r.site_name) return String(r.site_id ?? r.entity_id)
  return r.site_id || r.entity_id ? 'removed' : 'every'
}

/** The filter's choices, in HR's order: Every site, then each site by name, then Site removed. */
export function siteChoices(
  rows: CalendarRow[], sites: Array<{ id: string; name: string }>,
): Array<{ key: string; label: string }> {
  const present = new Set(rows.map(siteKeyOf))
  const out = [{ key: 'all', label: 'Every site' }]
  for (const s of [...sites].sort((a, b) => a.name.localeCompare(b.name))) {
    if (present.has(s.id)) out.push({ key: s.id, label: s.name })
  }
  // "Every site" as a VALUE (entity_id null) is a different thing from the filter's "all", and it
  // is only offered when some row actually is company-wide.
  if (present.has('every')) out.splice(1, 0, { key: 'every', label: 'Company-wide' })
  if (present.has('removed')) out.push({ key: 'removed', label: SITE_REMOVED_SHORT })
  return out
}

/** The rows one choice of that filter shows. 'all' is every row — the filter is off. */
export const filterBySite = (rows: CalendarRow[], key: string): CalendarRow[] =>
  key === 'all' ? rows : rows.filter((r) => siteKeyOf(r) === key)

/** "2026-11" a month either side. */
export function shiftMonth(key: string, by: number): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return key
  const d = new Date(`${key}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + by)
  return d.toISOString().slice(0, 7)
}

/** Mon…Sun, as board 4 heads its columns. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/**
 * HOW MANY DATES FIT IN A DAY BOX BEFORE IT SAYS "+2 more". Every box is the same height whatever
 * it holds (board 4): a grid that stretches for a busy day is a grid whose rows mean different
 * things in different weeks.
 */
export const PER_DAY = 2
export const MORE_WORD = (n: number) => `+${n} more`

// ---------------------------------------------------------------------------------------------
// SENDING ONE DATE TO A PERSONAL CALENDAR
// ---------------------------------------------------------------------------------------------

/**
 * GOOGLE'S AND OUTLOOK'S ADD-AN-EVENT PAGES — the two URL shapes the old `/calendar` page used,
 * recovered from `git show 48107ea:app/calendar/page.tsx` (:247–256) and reused rather than
 * rewritten. Both take a day and open a pre-filled "new event" form; neither is an API and neither
 * costs anything. A date with no day has nothing to send, so both return ''.
 *
 * The day sent is `next_due` — the occurrence a person would actually put in their diary — not the
 * anchor a repeating date counts from.
 */
export function googleCalendarUrl(row: Pick<CalendarRow, 'title' | 'description' | 'next_due'>): string {
  const d = dayOf(row.next_due)
  if (!d) return ''
  const compact = d.replace(/-/g, '')
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(row.title)}`
    + `&dates=${compact}/${compact}`
    + `&details=${encodeURIComponent(row.description || '')}`
}

export function outlookCalendarUrl(row: Pick<CalendarRow, 'title' | 'description' | 'next_due'>): string {
  const d = dayOf(row.next_due)
  if (!d) return ''
  return 'https://outlook.live.com/calendar/0/deeplink/compose'
    + `?subject=${encodeURIComponent(row.title)}`
    + `&startdt=${d}&enddt=${d}`
    + `&body=${encodeURIComponent(row.description || '')}`
}
