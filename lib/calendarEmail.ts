/**
 * THE MONTHLY EMAIL — Calendar step 11, board 10 (decisions 18, 24 and 25).
 *
 * *** IT IS A PURE FUNCTION FROM ROWS TO THE TEMPLATE'S SHAPE. *** No database, no clock, no
 * Resend: the job reads `calendar_v` and hands the rows over, and everything about WHAT THE EMAIL
 * SAYS is decided here where a test can read it. The three existing emails each build their body
 * inside the thing that sends it, which is why "what does the email say" has only ever been
 * answerable by sending one.
 *
 * *** NO CONFIRMED OR NOT-CONFIRMED MARKS, ANYWHERE — decision 18. *** Every date here is on the
 * calendar and is said plainly. A mark would turn the email into a second queue, and the queue is
 * a screen in the product; the footer says what to do with a date that is wrong. `calendar_v`
 * has already dropped withdrawn rows (migration 075) and the caller passes only live ones, so a
 * date in this email is a date the product currently stands behind.
 *
 * THE SECTIONS, in board 10's order, each left out when it is empty:
 *
 *   Due in <Month>      every dated row whose next occurrence falls in the month
 *   Early next month    the first 7 days of the next month (open question 3, decided yes: a
 *                       2 November date must not be first seen on 1 November)
 *   Passed last month   one-offs whose day fell in the previous month and is behind us
 *   one line            the repeating dates with no day yet, and where to set them
 *
 * An empty month still sends, short — "Nothing is due in November." The reassurance IS the
 * service: an email that only arrives when something is wrong teaches people to dread it, and
 * silence is indistinguishable from a product that has stopped working.
 */
import { longDay, dayAndShortMonth, dayOf, monthOf, monthTitle, siteWords, EVERY_SITE, type CalendarRow } from './calendarView.ts'
import { FOOTER_NOT_LEGAL_ADVICE, footerBecauseMember, type EmailRow, type EmailSection, type EmailShape } from './email.ts'

/** How many days of the next month are shown with this one. */
export const EARLY_DAYS = 7

/** "2026-11" → "2026-12"; and the other way for the month before. */
export const nextMonthKey = (key: string): string => {
  const [y, m] = key.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}
export const prevMonthKey = (key: string): string => {
  const [y, m] = key.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** The day of the month as a number, from a `YYYY-MM-DD`. 0 when there is no day. */
const dayNumber = (iso: string | null | undefined): number => Number(dayOf(iso).slice(8, 10) || 0)

export interface EmailParts {
  due: CalendarRow[]
  early: CalendarRow[]
  passed: CalendarRow[]
  /** Repeating dates with no day the view could compute (decisions 12 and 23). */
  undated: CalendarRow[]
}

/**
 * WHICH ROW BELONGS WHERE. The only arithmetic in this file, and it is all on the view's own
 * `next_due` — the date the product shows, not the anchor it was counted from.
 */
export function splitForMonth(rows: CalendarRow[], month: string): EmailParts {
  const next = nextMonthKey(month)
  const prev = prevMonthKey(month)
  const due: CalendarRow[] = []
  const early: CalendarRow[] = []
  const passed: CalendarRow[] = []
  const undated: CalendarRow[] = []
  for (const r of rows) {
    const day = dayOf(r.next_due)
    if (!day) { if (r.recurs) undated.push(r); continue }
    const m = monthOf(r.next_due)
    if (m === month) due.push(r)
    else if (m === next && dayNumber(r.next_due) <= EARLY_DAYS) early.push(r)
    // A repeating date's next occurrence is always ahead, so only a one-off can be here —
    // `has_passed` is the view's own answer and this file does not second-guess it.
    else if (m === prev && r.has_passed) passed.push(r)
  }
  const bySoonest = (a: CalendarRow, b: CalendarRow) =>
    dayOf(a.next_due).localeCompare(dayOf(b.next_due)) || a.title.localeCompare(b.title)
  return {
    due: due.sort(bySoonest),
    early: early.sort(bySoonest),
    passed: passed.sort(bySoonest),
    undated: undated.sort((a, b) => a.title.localeCompare(b.title)),
  }
}

/** Where a date came from, in the email's words. Never a mark of whether it is confirmed. */
export function sourceWords(row: CalendarRow, addedByName?: string | null): string {
  if (row.source_title) return row.source_title
  if (row.source === 'person') return addedByName ? `Added by ${addedByName}` : 'Added by hand'
  if (row.source === 'rule') return 'Found in a rule and added in CompliBoard'
  return 'On your calendar'
}

/** One row: the day and the title, then where it came from. */
export function emailRow(
  row: CalendarRow, appUrl: string, siteCount: number, addedByName?: string | null,
): EmailRow {
  const when = dayAndShortMonth(row.next_due)
  const site = siteWords(row, siteCount)
  // The site is in the secondary line only when it is NOT already the group's heading — a row
  // under "Portland plant" that also says "Portland plant" is noise (decision 24 either way:
  // with one site, `siteWords` returns ''.)
  return {
    primary: when ? `${when} — ${row.title}` : row.title,
    secondary: [site && siteCount > 1 ? null : site, sourceWords(row, addedByName)].filter(Boolean).join(' · '),
    href: `${appUrl}/calendar?date=${row.id}`,
  }
}

/**
 * GROUPED BY SITE ONLY WHEN THERE IS MORE THAN ONE — decision 24, the rule the whole section
 * follows. With one site the rows are one list with no heading at all.
 */
export function bySite(
  rows: CalendarRow[], appUrl: string, siteCount: number, names: Record<string, string>,
): EmailSection[] {
  const row = (r: CalendarRow) => emailRow(r, appUrl, siteCount, r.added_by ? names[r.added_by] : null)
  if (siteCount < 2) return rows.length ? [{ rows: rows.map(row) }] : []
  const groups = new Map<string, CalendarRow[]>()
  for (const r of rows) {
    const key = siteWords(r, siteCount) || EVERY_SITE
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  // "Every site" last: a company-wide date belongs after the places it also applies to.
  return [...groups.entries()]
    .sort((a, b) => (a[0] === EVERY_SITE ? 1 : b[0] === EVERY_SITE ? -1 : a[0].localeCompare(b[0])))
    .map(([heading, list]) => ({ heading, rows: list.map(row) }))
}

export const DUE_HEADING = (month: string) => `Due in ${monthTitle(month).split(' ')[0]}`
export const EARLY_HEADING = (month: string) =>
  `Early in ${monthTitle(nextMonthKey(month)).split(' ')[0]}`
export const PASSED_HEADING = (month: string) =>
  `Still on your calendar from ${monthTitle(prevMonthKey(month)).split(' ')[0]}, passed`
export const UNDATED_LINE = (n: number) =>
  `${n} repeating date${n === 1 ? '' : 's'} ${n === 1 ? 'has' : 'have'} no day set yet — set ${n === 1 ? 'it' : 'them'} in CompliBoard`
export const NOTHING_DUE = (month: string) => `Nothing is due in ${monthTitle(month).split(' ')[0]}.`
/** Decision 18's line, and the one thing the email asks of anybody. */
export const NOT_RIGHT_LINE =
  'If a date here is not right, open it in CompliBoard and remove it; it will not come back from the same document.'

export interface CalendarEmailInput {
  company: string
  /** "2026-11" — the month the email is ABOUT. */
  month: string
  rows: CalendarRow[]
  siteCount: number
  /** The app's own base URL, without a trailing slash. Every link in an email is absolute. */
  appUrl: string
  /** Full names by profile id, for a date somebody typed. */
  names?: Record<string, string>
}

export interface CalendarEmail { subject: string; shape: EmailShape; counts: EmailParts }

/** The whole email, as data. `renderEmail` turns it into the two bodies. */
export function calendarEmail(input: CalendarEmailInput): CalendarEmail {
  const { company, month, rows, siteCount, appUrl } = input
  const names = input.names ?? {}
  const parts = splitForMonth(rows, month)
  const monthName = monthTitle(month).split(' ')[0]
  const sections: EmailSection[] = []

  /**
   * *** ONE HEADING OR SEVERAL, AND THE BOARD SETTLES IT. *** The brief names this section
   * "Due in ‹Month›"; board 10 draws no such heading, because the title already says "Due this
   * month at ‹Company›" and the lede says "November 2026 · 4 dates" — what it draws instead is
   * one heading per SITE. Both are right for the company they were written for, so: with one
   * site the rows carry the brief's heading, and with several they carry the board's site
   * headings and the month stays in the title where it is already said once.
   */
  for (const g of bySite(parts.due, appUrl, siteCount, names)) {
    sections.push(g.heading ? g : { ...g, heading: DUE_HEADING(month) })
  }
  if (parts.early.length) {
    sections.push({ heading: EARLY_HEADING(month),
      rows: parts.early.map((r) => emailRow(r, appUrl, siteCount, r.added_by ? names[r.added_by] : null)) })
  }
  if (parts.passed.length) {
    sections.push({ heading: PASSED_HEADING(month),
      rows: parts.passed.map((r) => emailRow(r, appUrl, siteCount, r.added_by ? names[r.added_by] : null)) })
  }
  if (parts.undated.length) {
    sections.push({ rows: [{ primary: UNDATED_LINE(parts.undated.length), href: `${appUrl}/calendar?tab=calendar` }] })
  }

  const count = parts.due.length
  return {
    subject: count
      ? `${company}: what is due in ${monthName}`
      : `${company}: nothing is due in ${monthName}`,
    counts: parts,
    shape: {
      title: count ? `Due this month at ${company}` : NOTHING_DUE(month),
      lede: count
        ? `${monthTitle(month)} · ${count} date${count === 1 ? '' : 's'}`
        : `${monthTitle(month)} · nothing on your calendar falls in this month`,
      sections: sections.filter((s) => s.rows.length || s.heading),
      button: { label: 'Open your calendar', href: `${appUrl}/calendar` },
      footer: [
        `${footerBecauseMember(company)} It arrives on the first of each month.`,
        NOT_RIGHT_LINE,
        FOOTER_NOT_LEGAL_ADVICE,
      ],
    },
  }
}
