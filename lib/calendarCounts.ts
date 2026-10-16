/**
 * THE CALENDAR'S OWN NUMBERS, READ IN ONE PLACE — Calendar step 7 (`docs/CALENDAR-PLAN.md` §2.4).
 *
 * Four numbers appear on the Calendar page, and one of them appears again in the sidebar:
 *
 *   · the Calendar tab's count          — live rows
 *   · the Dates-to-confirm tab's count  — live rows still `proposed`
 *   · the info bar under the ask box    — both of those, the conversations, and the next date
 *   · THE SIDEBAR BADGE                 — the Dates-to-confirm count, on every page
 *
 * *** THEY ARE THE SAME NUMBERS, SO THEY COME FROM THE SAME FILTER. *** `components/AppLayout.tsx`
 * carries the reason in full: on 29 September its badge read 12 while the page it sat beside showed
 * the queue empty, and both numbers were right for the moment each was fetched. The fix there was
 * one definition of what is counted, used at both ends. `liveDates()` below is that definition for
 * the Calendar: one function builds the filter, the page reads rows through it and the badge reads a
 * count through it, and neither can decide for itself what "live" means.
 *
 * *** LIVE MEANS `status in (proposed, confirmed)` AND `replaced_by is null`. *** The owner's words
 * for step 7. A dismissed row is a person's decision and is kept but not counted; a superseded row
 * is history; a WITHDRAWN row is not in `calendar_v` at all (decision 29, migration 075), so the
 * view has already dropped it before this file sees anything.
 *
 * *** BROWSER-SAFE: IT IMPORTS A TYPE AND `lib/listWords.ts`, WHICH IMPORTS NOTHING. ***
 * `tests/unit/clientImports.test.ts` covers every client file's imports. The client is the caller's
 * own, so RLS applies and `calendar_v` is `security_invoker` — it returns that company's rows and
 * no others, and this file never names a company.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { countWord } from './listWords.ts'

/** The two words a row must carry to be on the calendar at all. */
export const LIVE_STATUSES = ['proposed', 'confirmed'] as const

/** The columns the page and the info bar need. `has_passed` and `next_due` are computed by the view. */
export const CALENDAR_COUNT_COLUMNS = 'id, status, next_due, has_passed'

/** One row of `calendar_v`, as much of it as the counts read. */
export interface CountRow {
  id: string
  status: string
  next_due: string | null
  has_passed: boolean | null
}

/**
 * THE ONE FILTER. Every count on the Calendar and the sidebar badge is built on this, so there is
 * one answer to "what is on the calendar" and both ends of the product give it.
 */
export const liveDates = (db: SupabaseClient, columns: string, head = false) =>
  db.from('calendar_v')
    .select(columns, head ? { count: 'exact', head: true } : undefined)
    .in('status', LIVE_STATUSES as unknown as string[])
    .is('replaced_by', null)

/**
 * ONE COMPANY'S LIVE DATES, NAMED HERE — Calendar step 11.
 *
 * Every reader until now was a signed-in person, where RLS decides the company and nothing names
 * one. The monthly email has no session: it runs as the service role for every company in turn,
 * so it must say which. The filter is `liveDates`'s, unchanged, with one `eq` on top.
 *
 * *** IT IS A FUNCTION RATHER THAN A `.eq()` AT THE CALL SITE, and `npm run check:schema` is why.
 * *** `scripts/check-schema-contracts.js` attributes a chained `.eq('company_id', …)` to the
 * nearest `.from(…)` it can see; written at the call site, after `liveDates(...)` had returned,
 * it was attributed to whichever table that file read last — in the render script, `companies`,
 * which has no `company_id`, and the check refused the file. The checker was right to: it cannot
 * see through a function, and a column name in a string is exactly what it exists to catch. Here
 * the `.from('calendar_v')` is two lines up and it reads correctly.
 */
export const liveDatesFor = (db: SupabaseClient, companyId: string, columns: string) =>
  liveDates(db, columns).eq('company_id', companyId)

export interface CalendarCounts {
  /** Live rows — the Calendar tab's count. */
  dates: number
  /** Live rows still waiting for a person — the Dates-to-confirm tab's count and the sidebar badge. */
  toConfirm: number
  /** The soonest date still ahead, as the view computed it, or null when nothing is ahead. */
  nextDate: string | null
}

/**
 * THE NEXT DATE IS THE DATABASE'S ANSWER, NOT THE BROWSER'S. `next_due` is computed by `calendar_v`
 * against the server's `current_date` — a one-off IS its own day, a repeating date is its next
 * occurrence — and `has_passed` is true for exactly one case: a one-off whose day is behind us. So
 * "still ahead" is `next_due is not null and not has_passed`, and no clock in the browser is
 * consulted. A page that worked out "ahead" for itself would disagree with the view by a day for
 * anybody sitting west of UTC, which is everybody this product sells to.
 */
export const stillAhead = (r: CountRow): boolean => !!r.next_due && !r.has_passed

/** Both counts and the next date, from one read of `calendar_v`. */
export async function readCalendarCounts(db: SupabaseClient): Promise<CalendarCounts> {
  const { data } = await liveDates(db, CALENDAR_COUNT_COLUMNS)
  return countsFrom((data ?? []) as unknown as CountRow[])
}

/** The counting itself, apart from the read, so it can be tested without a database. */
export function countsFrom(rows: CountRow[]): CalendarCounts {
  const ahead = rows.filter(stillAhead).map((r) => r.next_due as string).sort()
  return {
    dates: rows.length,
    toConfirm: rows.filter((r) => r.status === 'proposed').length,
    nextDate: ahead[0] ?? null,
  }
}

/**
 * THE SIDEBAR BADGE'S NUMBER ALONE, as a count rather than as rows — the badge is on every page in
 * the product and does not need the rows. Same filter, one word added, so it cannot drift from the
 * tab beside it.
 */
export async function countDatesToConfirm(db: SupabaseClient): Promise<number> {
  const { count } = await liveDates(db, 'id', true).eq('status', 'proposed')
  return count ?? 0
}

/**
 * "30 November" — the day and the month, no year, as the owner wrote the info bar. UTC, because
 * `due_date` and `next_due` are DATE columns: read in a timezone behind UTC, a bare `new Date(iso)`
 * would print the day before.
 */
export function dayAndMonth(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/**
 * THE INFO BAR'S FRAGMENTS, AND THE RULE FOR ZERO — the owner's words, and his rule: a fragment
 * whose number is 0 is left out, and "next date" is left out when nothing is ahead. It is a function
 * and not four ternaries in the markup because the rule for zero is the only logic in it, and a rule
 * in markup is a rule nothing tests.
 *
 * All four zero is an empty array, and the page draws no bar at all — a line reading "0 dates" is a
 * sentence about nothing.
 */
export function infoBarParts(counts: CalendarCounts, conversations: number): string[] {
  const out: string[] = []
  if (counts.dates > 0) out.push(`${counts.dates} ${counts.dates === 1 ? 'date' : 'dates'} on your calendar`)
  if (counts.toConfirm > 0) out.push(`${counts.toConfirm} waiting for your confirmation`)
  // THE CONVERSATIONS ARE THE ONE NUMBER THAT GOES THROUGH `countWord`, and that is not a slip.
  // `readTopicList` reads at most `LIST_CAP` rows, so a full read means there may be more and the
  // honest count is "60+" — which is exactly what `countWord` says. The dates are read with NO
  // limit, so "60+ dates" would be a number we do have, reported as one we do not.
  if (conversations > 0) out.push(countWord(conversations, 'conversation'))
  if (counts.nextDate) out.push(`next date ${dayAndMonth(counts.nextDate)}`)
  return out
}
