/**
 * THE CALENDAR AS AN .ics FILE — Calendar step 8b part 3 (decision 20, board 11;
 * `DECISIONS.md` §193). **One generator, two readers**: the subscription feed
 * (`GET /api/calendar/feed`) and the one-time download in the sheet. A second copy of this would
 * be a second answer to "what is on this customer's calendar", and the two would drift the first
 * time a rule changed.
 *
 * *** BROWSER-SAFE AND PURE: IT IMPORTS A TYPE AND NOTHING ELSE. *** The download is made in the
 * page from rows it already has, so this file cannot reach for `node:crypto` or a database client.
 * `now` is a parameter rather than a call to the clock, which is what makes the output testable:
 * the same rows twice produce byte-identical text but for `DTSTAMP`.
 *
 * *** WHAT GOES IN, AND WHAT DELIBERATELY DOES NOT. ***
 * In: the title, the day (or the repeat rule), and a description carrying the source title and the
 * exact line the date was read from. Out, on the owner's instruction (16 October 2026): **the
 * person's own note** (`calendar_events.description`, board 9's "A note, if you want one"). The
 * link is a secret address with no sign-in behind it, and a note is the one field somebody writes
 * "key in the safe, ask Priya" into. Also never in: what anything cost, and the word "AI"
 * (`docs/CALENDAR-PLAN.md` §2.1).
 *
 * *** AND A DATE WE CANNOT PLACE IS LEFT OUT AND COUNTED, NEVER GUESSED AT. *** A repeating date
 * with no day has no honest occurrence to write (decision 12), and an invented one would be a
 * deadline nobody set. `skipped` carries them back so the sheet can say so.
 *
 * *** A REPEATING DATE WITH A DAY AND NO PERIOD GOES IN AS ONE EVENT — step 14b, decision 32. ***
 * It was skipped with the dayless ones, because without a period there is no RRULE. But migration
 * 079 puts that row on the grid on its own day, and a subscription that silently leaves out a date
 * the calendar shows is the worst of the three answers: the person sees a deadline in CompliBoard
 * and not in the diary they actually live by. So it is written as a single, non-repeating event on
 * that day — which claims no more than the document said — and the repeat appears the moment
 * somebody answers "how often" in the drawer.
 */
import type { CalendarRow } from './calendarView.ts'

/** The columns an event needs. Named so a reader can see the note is not among them. */
export const ICS_COLUMNS =
  'id, title, due_date, next_due, recurs, period, status, source_title, source_line'

/** How often it repeats, as RFC 5545 says it. Null for "we cannot say". */
export function rrule(period: string | null): string | null {
  switch (period) {
    case 'month': return 'FREQ=MONTHLY'
    case 'quarter': return 'FREQ=MONTHLY;INTERVAL=3'
    case '6 months': return 'FREQ=MONTHLY;INTERVAL=6'
    case 'year': return 'FREQ=YEARLY'
    case '2 years': return 'FREQ=YEARLY;INTERVAL=2'
    default: return null
  }
}

/**
 * RFC 5545 §3.3.11. Backslash FIRST, or every escape added after it is escaped again. A title with
 * a comma in it is ordinary — "Annual maintenance, all units" — and an unescaped one ends the
 * property value early and breaks the file in every calendar app at once.
 */
export const escapeText = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/**
 * RFC 5545 §3.1: no line over 75 OCTETS, continued with CRLF and one space. Octets, not characters
 * — a line of accented text is longer than it looks — and never split through a multi-byte
 * character, which would produce mojibake in the middle of a title.
 */
export function fold(line: string): string {
  const bytes = (s: string) => new TextEncoder().encode(s).length
  if (bytes(line) <= 75) return line
  const out: string[] = []
  let cur = ''
  let limit = 75
  for (const ch of line) {
    if (bytes(cur) + bytes(ch) > limit) { out.push(cur); cur = ''; limit = 74 }
    cur += ch
  }
  if (cur) out.push(cur)
  return out.join('\r\n ')
}

/** "2026-11-30" → "20261130". */
const compact = (iso: string): string => iso.slice(0, 10).replace(/-/g, '')

/** The day AFTER a date: an all-day VEVENT's DTEND is exclusive, so a one-day event needs it. */
export function nextDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return compact(d.toISOString())
}

/** "20261016T120000Z" — DTSTAMP's shape. */
export const stamp = (now: Date): string => now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

export interface IcsEvent { row: CalendarRow; start: string; repeat: string | null }

/**
 * WHICH ROWS CAN BE WRITTEN AS AN EVENT, AND WHICH CANNOT.
 *   · a one-off with a day              → one event on that day
 *   · repeating, with a day AND a period → one event on the anchor, with an RRULE
 *   · repeating, with a day and NO period → one event on that day and no RRULE (step 14b)
 *   · repeating with no day at all      → skipped, and counted
 * A PASSED date is written like any other: a date has passed, it is not deleted (decision 11), and
 * a calendar app showing last month is showing the truth.
 */
export function planEvents(rows: CalendarRow[]): { events: IcsEvent[]; skipped: CalendarRow[] } {
  const events: IcsEvent[] = []
  const skipped: CalendarRow[] = []
  for (const row of rows) {
    if (row.recurs) {
      // `repeat` is null when nobody read how often: the event is then a single day, not a series.
      const repeat = rrule(row.period)
      const anchor = (row.due_date ?? '').slice(0, 10)
      // NO ANCHOR IS THE ONLY THING THAT CANNOT BE WRITTEN: there is no day to put it on.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) { skipped.push(row); continue }
      events.push({ row, start: anchor, repeat })
    } else {
      const day = (row.next_due ?? row.due_date ?? '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { skipped.push(row); continue }
      events.push({ row, start: day, repeat: null })
    }
  }
  return { events, skipped }
}

/**
 * WHAT EACH EVENT SAYS ABOUT WHERE IT CAME FROM — the source title and the line it was read from,
 * and a plain word for a date nobody has confirmed, so somebody reading it in Google knows which
 * dates still want a look. Never the person's note; never a cost; never "AI".
 */
export function describe(row: CalendarRow): string {
  const parts: string[] = []
  if (row.source_title) parts.push(`From: ${row.source_title}`)
  if (row.source_line) parts.push(`"${row.source_line}"`)
  if (row.status === 'proposed') parts.push('Not confirmed yet — open it in CompliBoard to confirm.')
  return parts.join('\n')
}

export interface IcsOptions {
  /** The name a calendar app shows for the subscription. */
  name: string
  /** Passed in, never read from the clock, so the same rows twice differ only here. */
  now: Date
  /** Where a row can be opened. Omitted from the file when not given. */
  baseUrl?: string
}

/**
 * THE FILE. `UID` is the row's own id, which is the whole point of a subscription: a re-fetch
 * UPDATES the event the customer already has rather than adding a second one, and a row that has
 * gone stops being sent and the app drops it.
 */
export function buildIcs(
  rows: CalendarRow[], opts: IcsOptions,
): { text: string; included: number; skipped: CalendarRow[] } {
  const { events, skipped } = planEvents(rows)
  const dtstamp = stamp(opts.now)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CompliBoard//Compliance Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    'X-WR-TIMEZONE:UTC',
  ]
  for (const e of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.row.id}@compliboard.com`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART;VALUE=DATE:${compact(e.start)}`)
    lines.push(`DTEND;VALUE=DATE:${nextDay(e.start)}`)
    if (e.repeat) lines.push(`RRULE:${e.repeat}`)
    lines.push(`SUMMARY:${escapeText(e.row.title)}`)
    const body = describe(e.row)
    if (body) lines.push(`DESCRIPTION:${escapeText(body)}`)
    if (opts.baseUrl) lines.push(`URL:${opts.baseUrl}/calendar?date=${e.row.id}`)
    lines.push('TRANSP:TRANSPARENT')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  // CRLF throughout, and a trailing one: RFC 5545 §3.1, and some readers drop the last line without it.
  return { text: lines.map(fold).join('\r\n') + '\r\n', included: events.length, skipped }
}

/** The sheet's line when some dates could not be written. Never silent (decision 30). */
export const SKIPPED_LINE = (n: number) =>
  n === 1
    ? '1 date is not in this file: it repeats and we do not know when it next falls.'
    : `${n} dates are not in this file: they repeat and we do not know when they next fall.`
