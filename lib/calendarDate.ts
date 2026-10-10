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
 * *** "TODAY" IS THE COMPANY'S *** (the owner, B10) — `zoneForState` below. It was a fixed Pacific
 * (decision 15), on the grounds that every rev 1 customer is in Oregon or Washington; `today()` was
 * written to take a zone from the start, so the change is who supplies it rather than how it works.
 * It is read through `Intl`, never computed from an offset, so daylight saving is the platform's
 * problem and not ours.
 */

/**
 * The zone "today" is taken in when nothing better is known. Pacific, because rev 1 is Oregon and
 * Washington — but **a company's own zone now overrides it** (B10 below).
 */
export const CALENDAR_TZ = 'America/Los_Angeles'

/**
 * *** "TODAY" FOLLOWS THE COMPANY, NOT THE SERVER AND NOT A FIXED PACIFIC *** — the owner, B10.
 *
 * A DUE DATE IS STILL A PLAIN DAY (decision 15): "the permit expires on 30 November" is true in
 * every zone, and storing an instant for it would be wrong. What the zone decides is **which day is
 * today**, and therefore what has passed, what "due in 11 days" means, which dates are "this month",
 * what a printed sheet says it was printed on, and which month the email is about.
 *
 * Near midnight those answers differ. A company in New York at 9pm on the 20th is on the 21st in UTC
 * and still on the 20th in Pacific; one in Hawaii is on the 19th while Oregon is on the 20th. Telling
 * a customer a date "has passed" on a day it has not is the kind of small wrongness that costs trust
 * out of all proportion — and §185c has already decided the product is careful about passed dates.
 *
 * **Until My Account carries a setting, the zone comes from `companies.state`** through the map
 * below. That is enough to be right for every state that sits in one zone, and `docs/HANDOFF-CODE.md`
 * §7 carries the item for the ones that do not (Florida, Texas, Idaho and the rest are split, and
 * the company's own answer is the only way to settle those).
 *
 * **No migration.** `companies.state` already exists and is already filled at signup.
 */
const STATE_TZ: Record<string, string> = {
  // Eastern
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York', GA: 'America/New_York',
  ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York', NH: 'America/New_York',
  NJ: 'America/New_York', NY: 'America/New_York', NC: 'America/New_York', OH: 'America/New_York',
  PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York', VT: 'America/New_York',
  VA: 'America/New_York', WV: 'America/New_York',
  // Central
  AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago', IA: 'America/Chicago',
  LA: 'America/Chicago', MN: 'America/Chicago', MS: 'America/Chicago', MO: 'America/Chicago',
  OK: 'America/Chicago', WI: 'America/Chicago',
  // Mountain
  AZ: 'America/Phoenix',          // no daylight saving, which is why it is its own zone and not Denver
  CO: 'America/Denver', MT: 'America/Denver', NM: 'America/Denver', UT: 'America/Denver',
  WY: 'America/Denver',
  // Pacific
  CA: 'America/Los_Angeles', NV: 'America/Los_Angeles', OR: 'America/Los_Angeles',
  WA: 'America/Los_Angeles',
  // Outside the lower 48
  AK: 'America/Anchorage', HI: 'Pacific/Honolulu',
  // *** SPLIT ACROSS TWO ZONES — the MAIN one, and a company may disagree. ***
  // Named here rather than left out, because falling back to Pacific for Texas would be worse than
  // being an hour out. My Account's setting (HANDOFF-CODE §7) is what makes these right.
  FL: 'America/New_York', IN: 'America/New_York', KY: 'America/New_York', MI: 'America/New_York',
  TN: 'America/Chicago', KS: 'America/Chicago', NE: 'America/Chicago', ND: 'America/Chicago',
  SD: 'America/Chicago', TX: 'America/Chicago', ID: 'America/Denver',
}

/**
 * The zone to read "today" in for a company, from its state.
 *
 * **An unknown or empty state gives Pacific** — rev 1's customers are in Oregon and Washington, so
 * that is the likeliest right answer and never a surprising one. It is a FALLBACK, not a claim: the
 * product never tells a customer which zone it assumed, because it would be guessing.
 */
export function zoneForState(state: string | null | undefined): string {
  const key = String(state ?? '').trim().toUpperCase()
  return STATE_TZ[key] ?? CALENDAR_TZ
}

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

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december']

/**
 * *** IS THIS DAY ACTUALLY IN THESE WORDS? *** — Calendar C2 check 2, board 10.
 *
 * A summary's date stands on a `line` copied from the conversation, and the prompt is explicit that
 * a day must never be WORKED OUT. So a `day` the copied words do not contain is a day the model
 * computed — "the permit is renewed annually" becoming `2027-03-15` — and that is the one failure
 * mode that reaches a customer as a deadline they plan around.
 *
 * **What it asks for:** the day number, and the month by name, short name or number; plus, if the
 * line carries a four-digit year at all, that it is the right one. It does NOT demand a particular
 * order or punctuation, because "March 15", "15 March", "15/03" and "2027-03-15" are all the same
 * date written by different people.
 *
 * **Why the year is conditional.** The prompt deliberately asks the model to resolve "15 March" to
 * the next 15 March on or after today, so the line usually has no year to check against — and
 * demanding one would throw away every correctly resolved date. When the line DOES carry a year, a
 * mismatch is a real disagreement and the date is refused.
 */
export function dayIsInLine(day: string, line: string): boolean {
  if (!isDayString(day)) return false
  const [y, m, d] = day.split('-').map(Number)
  const text = ` ${line.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `

  // The day number, on its own — not the "15" inside "2015" or "150".
  const hasDay = new RegExp(`(?<![0-9])${d}(?:st|nd|rd|th)?(?![0-9])`).test(text)
  if (!hasDay) return false

  const name = MONTH_NAMES[m - 1]
  const hasMonth = text.includes(` ${name} `) || text.includes(` ${name.slice(0, 3)} `)
    || new RegExp(`(?<![0-9])0?${m}(?![0-9])`).test(text)
  if (!hasMonth) return false

  // A year only has to match if the line states one.
  const years = [...text.matchAll(/(?<![0-9])(19|20)\d{2}(?![0-9])/g)].map((x) => Number(x[0]))
  return years.length === 0 || years.includes(y)
}
