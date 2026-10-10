/**
 * DATES ARE DAYS, NOT TIMES — `docs/CALENDAR-PLAN.md` decision 15, `DECISIONS.md` §185.
 *
 * *** THE BUG THIS FILE EXISTS TO END (`docs/CALENDAR-MACHINERY.md` B2). ***
 * `new Date('2026-11-01')` is read by JavaScript as **midnight UTC**, which in Oregon is 5pm on
 * 31 October. Four expressions in the product do exactly that, and the map proved what a person sees:
 *
 *   · a date due TODAY shows as "Overdue" in the calendar's red banner (`app/calendar/page.tsx:277–280`)
 *     while its own row says "Due today" (`:513–516`) — the page contradicting itself;
 *   · the same date is MISSING from the dashboard's "Upcoming — next 30 days"
 *     (`app/dashboard/page.tsx:113`), so the dashboard is silent on the day it matters;
 *   · a date on the 1st is listed under the PREVIOUS month (`app/calendar/page.tsx:261–264`);
 *   · the evening before the 1st, a 1 November date is already "Overdue".
 *
 * So every day in this product goes through here. A `YYYY-MM-DD` string is a CALENDAR DAY: it has no
 * time, no zone, and comparing it to a moment is a category error. The two safe operations are
 * therefore (a) compare day strings to day strings, which is plain text comparison and always right,
 * and (b) build a local noon `Date` when something must be formatted or shifted. Noon, not midnight,
 * because noon is the only hour no daylight-saving shift can move across a date boundary.
 *
 * *** "TODAY" IS PACIFIC IN REV 1 *** (decision 15), because every customer is in Oregon or
 * Washington. A company's own time zone is a later item, and `today()` is the one place that would
 * change. It is read from the system through `Intl`, never computed from an offset, so the switch
 * between PST and PDT is the platform's problem and not ours.
 */

/** The zone "today" is taken in. Decision 15: rev 1 is Oregon and Washington. */
export const CALENDAR_TZ = 'America/Los_Angeles'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

/** A `YYYY-MM-DD` day string and nothing else. `'2026-13-01'` is refused by `parseDay`, not here. */
export function isDayString(v: unknown): v is string {
  return typeof v === 'string' && DAY_RE.test(v)
}

/**
 * A day string as a `Date` at LOCAL NOON, or null when it is not a day or not a real one.
 *
 * Noon is deliberate. At local midnight a daylight-saving shift can land the `Date` on the day before;
 * at noon nothing can. The returned `Date` is only ever used for formatting and for month arithmetic —
 * never for comparing two days, which `compareDays` does on the strings.
 *
 * It also refuses a day that does not exist (`2026-02-30`), which `new Date` silently rolls forward to
 * 2 March. A date nobody could write down must not become a different date we then act on.
 */
export function parseDay(iso: string | null | undefined): Date | null {
  if (!isDayString(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const at = new Date(y, m - 1, d, 12, 0, 0, 0)
  // The round trip is the check: a rolled-forward date comes back as a different day.
  if (at.getFullYear() !== y || at.getMonth() !== m - 1 || at.getDate() !== d) return null
  return at
}

/** A `Date` back to a day string, in its own local fields. */
export function toDayString(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`
}

/**
 * Today, as a day string, in `CALENDAR_TZ`.
 *
 * `en-CA` because its short date format IS `YYYY-MM-DD`; the alternative is assembling the parts by
 * hand from `formatToParts`, which is the same answer with more code. Both are the platform's own
 * conversion, so PST and PDT are handled for us.
 */
export function today(tz: string = CALENDAR_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** -1, 0 or 1. Day strings compare as text, which is exactly right and needs no `Date` at all. */
export function compareDays(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Whole days from `from` to `to`, positive when `to` is later. Null if either is not a day.
 *
 * Both sides are local noon, so the difference is a whole number of days even across a daylight-saving
 * boundary — the case that makes a midnight-based subtraction return 23.0 or 25.0 hours and round the
 * wrong way.
 */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = parseDay(fromIso), b = parseDay(toIso)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

/** Days from today until `iso`: 0 today, 1 tomorrow, negative once it has passed. */
export function daysUntil(iso: string, asOf: string = today()): number | null {
  return daysBetween(asOf, iso)
}

/** Strictly before today. A date due TODAY is NOT past — the half of B2 the banner got wrong. */
export function isPast(iso: string | null | undefined, asOf: string = today()): boolean {
  return isDayString(iso) && compareDays(iso, asOf) < 0
}

/** Today or later, and no more than `days` away. `isWithin(x, 30)` includes today and day 30. */
export function isWithin(iso: string | null | undefined, days: number, asOf: string = today()): boolean {
  if (!isDayString(iso)) return false
  const n = daysBetween(asOf, iso)
  return n !== null && n >= 0 && n <= days
}

/** The calendar month a day falls in. `month` is 1–12, not JavaScript's 0–11. */
export function monthOf(iso: string): { year: number; month: number } | null {
  const at = parseDay(iso)
  if (!at) return null
  return { year: at.getFullYear(), month: at.getMonth() + 1 }
}

/** Whether a day is in a given calendar month. The month view and the email both ask this. */
export function inMonth(iso: string | null | undefined, year: number, month: number): boolean {
  if (!isDayString(iso)) return false
  const m = monthOf(iso)
  return !!m && m.year === year && m.month === month
}

/** The first and last day of a month, as day strings — the email's range. */
export function monthRange(year: number, month: number): { first: string; last: string } {
  const p = (n: number) => String(n).padStart(2, '0')
  const last = new Date(year, month, 0).getDate()      // day 0 of the next month is this month's last
  return { first: `${year}-${p(month)}-01`, last: `${year}-${p(month)}-${p(last)}` }
}

export type HowOften = 'monthly' | 'quarterly' | 'yearly'

const MONTHS_PER: Record<HowOften, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/**
 * The next occurrence of a repeating day.
 *
 * *** IT CLAMPS TO THE END OF THE MONTH RATHER THAN OVERFLOWING. *** `setMonth` rolls 31 January + 1
 * month forward to 3 March, because February has no 31st. For a compliance deadline that is the wrong
 * direction twice over: it invents a date the rule never set, and it moves it LATER, past the day the
 * obligation was actually due. So the 31st of a month becomes the last day of the target month:
 *
 *   31 January + monthly   -> 28 February  (29 February in a leap year)
 *   29 February + yearly   -> 28 February  (the next year is not a leap year)
 *   31 March    + quarterly-> 30 June
 *
 * Earlier is the safe direction for a deadline, and it is also what a person means by "the last of the
 * month".
 */
export function nextOccurrence(iso: string, every: HowOften): string | null {
  const at = parseDay(iso)
  if (!at || !(every in MONTHS_PER)) return null
  const day = at.getDate()
  const target = new Date(at.getFullYear(), at.getMonth() + MONTHS_PER[every], 1, 12, 0, 0, 0)
  const lastOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastOfTarget))
  return toDayString(target)
}

/** `1 January 2027`. One wording for every day this product prints. */
export function formatDay(iso: string | null | undefined): string {
  const at = parseDay(iso)
  return at ? at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

/** `January 2027` — the month view's heading and the email's subject. */
export function formatMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1, 12).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/**
 * `5 November` for a day in the current year, `20 August 2025` for one that is not.
 *
 * *** THE YEAR IS DROPPED ONLY WHEN IT CANNOT BE MISREAD *** (the owner, A5b follow-on). A list
 * headed "October 2026" does not need the year on every line — but **a date that has passed can sit
 * unticked for a year**, and "20 August" under that heading points at the wrong August. The year is
 * the one piece that makes a stale date obvious, so it is kept wherever it is not this year's.
 *
 * `asOf` is the day the reader is reading on, so the email's own month decides, not the server's.
 */
export function formatDayShort(iso: string | null | undefined, asOf: string = today()): string {
  const at = parseDay(iso)
  if (!at) return ''
  const sameYear = isDayString(asOf) && asOf.slice(0, 4) === String(at.getFullYear())
  return at.toLocaleDateString('en-GB',
    sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * How a date reads next to its day: `Due today`, `Due in 3 days`, `Passed 2 days ago`.
 *
 * *** WE NEVER SAY "OVERDUE" OR "NOT DONE" ABOUT A DATE — the owner, 9 October 2026 ***
 * (`DECISIONS.md` §185). This returned `2 days overdue` until A5b. People often do the work and
 * record it in their own calendar rather than ours, so **all we actually know is that the day has
 * gone by.** "Overdue" is a claim about whether they did it, made from the absence of a tick — which
 * is `CLAUDE.md` §3.2's first rule in the place a customer reads every month.
 *
 * Plain words, no colour, no emoji — the caller decides what is amber (`docs/DESIGN.md`).
 */
export function dueWords(iso: string | null | undefined, asOf: string = today()): string {
  if (!isDayString(iso)) return 'No day yet'
  const n = daysBetween(asOf, iso)
  if (n === null) return 'No day yet'
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  if (n > 1) return `Due in ${n} days`
  if (n === -1) return 'Passed yesterday'
  return `Passed ${Math.abs(n)} days ago`
}
