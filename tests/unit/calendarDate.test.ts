/**
 * THE DAY HELPER — `lib/calendarDate.ts`, Calendar decision 15, `DECISIONS.md` §185.
 *
 * *** EVERY CASE THE MAP PROVED IS HERE, AS A TEST. *** `docs/CALENDAR-MACHINERY.md` 2b ran the page's
 * own expressions under `TZ=America/Los_Angeles` and printed what a person sees: a date due today
 * reported "Overdue", the same date missing from the dashboard's next-30-days, a 1st-of-the-month date
 * listed under the previous month, and a 1 November date already overdue on the evening of 31 October.
 * Each of those is an assertion below, so the defect cannot come back without a red test.
 *
 * The suite PINS THE ZONE itself rather than trusting the runner's, because a test that only passes in
 * one zone is a test that will pass on a laptop and fail in a deploy.
 */
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  CALENDAR_TZ, isDayString, parseDay, toDayString, today, compareDays, daysBetween, daysUntil, formatDayShort,
  isPast, isWithin, monthOf, inMonth, monthRange, nextOccurrence, formatDay, formatMonth, dueWords,
} from '../../lib/calendarDate.ts'

const WAS = process.env.TZ
before(() => { process.env.TZ = 'America/Los_Angeles' })
after(() => { if (WAS === undefined) delete process.env.TZ; else process.env.TZ = WAS })

describe('a day string is a day, not a moment', () => {
  test('what is and is not a day string', () => {
    assert.equal(isDayString('2026-11-01'), true)
    for (const bad of ['2026-11-1', '01/11/2026', '2026-11-01T00:00:00', '', null, undefined, 20261101]) {
      assert.equal(isDayString(bad), false, String(bad))
    }
  })

  test('parseDay lands on LOCAL NOON, which is what stops the off-by-one', () => {
    const d = parseDay('2026-11-01')!
    assert.equal(d.getFullYear(), 2026)
    assert.equal(d.getMonth(), 10)          // November
    assert.equal(d.getDate(), 1)            // *** not 31 October, which `new Date('2026-11-01')` gives
    assert.equal(d.getHours(), 12)
  })

  test('the old expression really does give the day before in Oregon — the defect, pinned', () => {
    // Not a test of our code: a test of the claim the map made, so nobody "fixes" the helper back.
    assert.equal(new Date('2026-11-01').getDate(), 31)
    assert.equal(new Date('2026-11-01').getMonth(), 9)      // October
    assert.equal(parseDay('2026-11-01')!.getDate(), 1)
  })

  test('a day that does not exist is refused, not rolled forward', () => {
    // `new Date(2026, 1, 30)` silently becomes 2 March. A date nobody could write must not become a
    // different date we then act on.
    assert.equal(parseDay('2026-02-30'), null)
    assert.equal(parseDay('2026-13-01'), null)
    assert.equal(parseDay('2026-00-10'), null)
    assert.equal(parseDay('2027-02-29'), null)              // 2027 is not a leap year
    assert.ok(parseDay('2028-02-29'))                       // 2028 is
  })

  test('toDayString round-trips', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2026-12-31', '2028-02-29']) {
      assert.equal(toDayString(parseDay(iso)!), iso)
    }
  })

  test('today() is a day string in the calendar zone', () => {
    assert.equal(CALENDAR_TZ, 'America/Los_Angeles')
    assert.equal(isDayString(today()), true)
    // A moment that is two different days in the two zones: 03:00 UTC is still the previous day in
    // Oregon. Taken in UTC this would read 2026-11-02; the product must say 1 November.
    const at = new Date('2026-11-02T03:00:00Z')
    const inPacific = new Intl.DateTimeFormat('en-CA', {
      timeZone: CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(at)
    assert.equal(inPacific, '2026-11-01')
  })
})

describe('comparing days', () => {
  test('compareDays is text comparison and needs no Date', () => {
    assert.equal(compareDays('2026-10-09', '2026-10-10'), -1)
    assert.equal(compareDays('2026-10-10', '2026-10-09'), 1)
    assert.equal(compareDays('2026-10-09', '2026-10-09'), 0)
  })

  test('daysBetween is whole days, across a daylight-saving boundary', () => {
    assert.equal(daysBetween('2026-10-09', '2026-10-09'), 0)
    assert.equal(daysBetween('2026-10-09', '2026-11-01'), 23)
    assert.equal(daysBetween('2026-11-01', '2026-10-09'), -23)
    // US clocks go back on 1 November 2026. A midnight-based subtraction gives 1.04 days here and
    // rounds the wrong way; noon-based gives exactly 1.
    assert.equal(daysBetween('2026-10-31', '2026-11-01'), 1)
    assert.equal(daysBetween('2026-11-01', '2026-11-02'), 1)
    // ...and forward again on 8 March 2026.
    assert.equal(daysBetween('2026-03-07', '2026-03-08'), 1)
    assert.equal(daysBetween('2026-03-08', '2026-03-09'), 1)
    assert.equal(daysBetween('2026-03-01', '2026-03-31'), 30)
  })

  test('daysBetween refuses what is not a day', () => {
    assert.equal(daysBetween('2026-10-09', 'soon'), null)
    assert.equal(daysBetween('', '2026-10-09'), null)
  })
})

describe('THE MAP\'S 2b CASES — a date due today, and the 1st of next month', () => {
  // The map fixed "now" at these two moments; so does this.
  const MORNING = '2026-10-09'          // a date due today
  const EVE_OF_THE_1ST = '2026-10-31'   // the evening before 1 November

  test('a date due TODAY is not past, and is not overdue', () => {
    assert.equal(isPast('2026-10-09', MORNING), false)
    assert.equal(dueWords('2026-10-09', MORNING), 'Due today')
    assert.equal(daysUntil('2026-10-09', MORNING), 0)
  })

  test('a date due TODAY is inside the next 30 days — the dashboard went silent on it', () => {
    assert.equal(isWithin('2026-10-09', 30, MORNING), true)
  })

  test('yesterday is past; tomorrow is not', () => {
    assert.equal(isPast('2026-10-08', MORNING), true)
    assert.equal(isPast('2026-10-10', MORNING), false)
    assert.equal(dueWords('2026-10-08', MORNING), 'Passed yesterday')
    assert.equal(dueWords('2026-10-10', MORNING), 'Due tomorrow')
  })

  test('the 1st of next month belongs to NEXT month, not this one', () => {
    assert.deepEqual(monthOf('2026-11-01'), { year: 2026, month: 11 })
    assert.equal(inMonth('2026-11-01', 2026, 11), true)
    assert.equal(inMonth('2026-11-01', 2026, 10), false)   // *** the defect: it was listed in October
  })

  test('on the evening of 31 October, 1 November is NOT overdue', () => {
    assert.equal(isPast('2026-11-01', EVE_OF_THE_1ST), false)
    assert.equal(dueWords('2026-11-01', EVE_OF_THE_1ST), 'Due tomorrow')
    assert.equal(daysUntil('2026-11-01', EVE_OF_THE_1ST), 1)
  })

  test('the 30-day window includes today and day 30, and excludes day 31', () => {
    assert.equal(isWithin('2026-11-08', 30, MORNING), true)    // day 30
    assert.equal(isWithin('2026-11-09', 30, MORNING), false)   // day 31
    assert.equal(isWithin('2026-10-08', 30, MORNING), false)   // yesterday is not "upcoming"
  })
})

describe('months', () => {
  test('monthRange gives the first and last day, February included', () => {
    assert.deepEqual(monthRange(2026, 11), { first: '2026-11-01', last: '2026-11-30' })
    assert.deepEqual(monthRange(2026, 2), { first: '2026-02-01', last: '2026-02-28' })
    assert.deepEqual(monthRange(2028, 2), { first: '2028-02-01', last: '2028-02-29' })
    assert.deepEqual(monthRange(2026, 12), { first: '2026-12-01', last: '2026-12-31' })
  })
})

describe('nextOccurrence — it CLAMPS, it never overflows into the next month', () => {
  test('the brief\'s two cases', () => {
    // 31 January + 1 month. `setMonth` would give 3 March: a date the rule never set, and LATER than
    // the obligation was due.
    assert.equal(nextOccurrence('2026-01-31', 'monthly'), '2026-02-28')
    // 29 February + 1 year, into a year that has no 29 February.
    assert.equal(nextOccurrence('2028-02-29', 'yearly'), '2029-02-28')
  })

  test('the ordinary cases', () => {
    assert.equal(nextOccurrence('2026-11-01', 'monthly'), '2026-12-01')
    assert.equal(nextOccurrence('2026-11-01', 'quarterly'), '2027-02-01')
    assert.equal(nextOccurrence('2026-11-01', 'yearly'), '2027-11-01')
    assert.equal(nextOccurrence('2026-12-15', 'monthly'), '2027-01-15')   // over the year's end
  })

  test('every clamping case, in all three periods', () => {
    assert.equal(nextOccurrence('2026-01-31', 'quarterly'), '2026-04-30')
    assert.equal(nextOccurrence('2026-03-31', 'quarterly'), '2026-06-30')
    assert.equal(nextOccurrence('2026-01-30', 'monthly'), '2026-02-28')
    assert.equal(nextOccurrence('2028-01-31', 'monthly'), '2028-02-29')   // a leap February
    assert.equal(nextOccurrence('2026-08-31', 'monthly'), '2026-09-30')
  })

  test('a leap day rolls to the leap day four years on, not to 1 March', () => {
    assert.equal(nextOccurrence('2024-02-29', 'yearly'), '2025-02-28')
    assert.equal(nextOccurrence('2028-02-29', 'quarterly'), '2028-05-29')
  })

  test('what it refuses', () => {
    assert.equal(nextOccurrence('2026-11-01', 'weekly' as never), null)
    assert.equal(nextOccurrence('not a day', 'monthly'), null)
  })

  test('rolling forward twelve times from the 31st never leaves the month it should be in', () => {
    // The defect this guards: a clamp that is applied to the CLAMPED value drifts — 31 Jan becomes
    // 28 Feb becomes 28 Mar — so the month is asserted, not the day.
    let at = '2026-01-31'
    const months: number[] = []
    for (let i = 0; i < 12; i++) { at = nextOccurrence(at, 'monthly')!; months.push(monthOf(at)!.month) }
    assert.deepEqual(months, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1])
  })
})

describe('a day that is not this year shows its year', () => {
  test('this year: no year. Another year: the year', () => {
    // A passed date can sit unticked for a year, so "20 August" under a heading that says
    // October 2026 points at the wrong August (the owner, A5b follow-on).
    assert.equal(formatDayShort('2026-10-20', '2026-10-01'), '20 October')
    assert.equal(formatDayShort('2025-08-20', '2026-10-01'), '20 August 2025')
    assert.equal(formatDayShort('2027-01-05', '2026-10-01'), '5 January 2027')
    // the year's edges, both ways
    assert.equal(formatDayShort('2026-01-01', '2026-12-31'), '1 January')
    assert.equal(formatDayShort('2025-12-31', '2026-01-01'), '31 December 2025')
    assert.equal(formatDayShort(null, '2026-10-01'), '')
  })
})

describe('the words a person reads', () => {
  test('formatDay and formatMonth', () => {
    assert.equal(formatDay('2027-01-01'), '1 January 2027')
    assert.equal(formatDay('2026-11-30'), '30 November 2026')
    assert.equal(formatDay(null), '')
    assert.equal(formatDay('nonsense'), '')
    assert.equal(formatMonth(2026, 11), 'November 2026')
  })

  test('dueWords never shows a number nobody can read', () => {
    assert.equal(dueWords(null), 'No day yet')
    assert.equal(dueWords('2026-10-12', '2026-10-09'), 'Due in 3 days')
    assert.equal(dueWords('2026-10-07', '2026-10-09'), 'Passed 2 days ago')
    // No "in -22 days", which is what the dashboard printed for a passed date
    // (`docs/CALENDAR-MACHINERY.md` 2b, dashboard:116–119).
    assert.ok(!dueWords('2026-09-17', '2026-10-09').includes('-'))
    // *** AND NEVER "OVERDUE" — the owner's rule, `DECISIONS.md` §185c. ***
    // All we know is the day has gone by: a tick missing from CompliBoard is not evidence the work
    // was not done, because people record what they did in their own calendar.
    for (const d of ['2026-10-08', '2026-09-17', '2026-01-01']) {
      assert.ok(!/overdue|not done/i.test(dueWords(d, '2026-10-09')), d)
    }
    assert.equal(dueWords('2026-09-17', '2026-10-09'), 'Passed 22 days ago')
  })
})
