/**
 * "TODAY" FOLLOWS THE COMPANY — the owner, Calendar B10 (`DECISIONS.md` §187g).
 *
 * A DUE DATE IS STILL A PLAIN DAY. "The permit expires on 30 November" is true in every zone, and
 * nothing here changes how a date is stored. What the zone decides is **which day is today**, and
 * therefore what has passed, what "due in N days" means, which dates are this month, what a printed
 * sheet says it was printed on, and which month the email is about.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { today, zoneForState, CALENDAR_TZ, isPast, dueWords, inMonth } from '../../lib/calendarDate.ts'

describe('the zone comes from the company\'s state', () => {
  test('one zone per state, and Pacific when we do not know', () => {
    assert.equal(zoneForState('OR'), 'America/Los_Angeles')
    assert.equal(zoneForState('WA'), 'America/Los_Angeles')
    assert.equal(zoneForState('NY'), 'America/New_York')
    assert.equal(zoneForState('HI'), 'Pacific/Honolulu')
    assert.equal(zoneForState('AZ'), 'America/Phoenix', 'Arizona keeps no daylight saving')
    // Case and whitespace are what a signup form actually produces.
    assert.equal(zoneForState('or'), 'America/Los_Angeles')
    assert.equal(zoneForState(' NY '), 'America/New_York')
    // The fallback, for a state nobody filled in, a territory, or a typo.
    for (const unknown of [null, undefined, '', 'Oregon', 'XX', 'PR'])
      assert.equal(zoneForState(unknown), CALENDAR_TZ, `${unknown} should fall back to Pacific`)
  })
})

describe('at one instant near midnight, three companies are on three days', () => {
  /** `today()` reads the clock, so the instant is fixed by replacing Date for the duration. */
  function at<T>(iso: string, fn: () => T): T {
    const Real = globalThis.Date
    class Frozen extends Real {
      constructor(...a: ConstructorParameters<typeof Real>) {
        // @ts-expect-error — the zero-argument case is the one being frozen
        super(...(a.length ? a : [iso]))
      }
      static now() { return new Real(iso).getTime() }
    }
    globalThis.Date = Frozen as unknown as DateConstructor
    try { return fn() } finally { globalThis.Date = Real }
  }

  test('*** THE SAME INSTANT, THREE DIFFERENT TODAYS ***', () => {
    // 21 Oct 2026, 04:30 UTC. New York is 00:30 on the 21st; Oregon is 21:30 on the 20th;
    // Hawaii is 18:30 on the 20th. A fixed Pacific would have told the New York company it was
    // still the 20th — and called a date due on the 20th "due today" when it had passed.
    at('2026-10-21T04:30:00Z', () => {
      assert.equal(today(zoneForState('NY')), '2026-10-21', 'New York has turned over')
      assert.equal(today(zoneForState('OR')), '2026-10-20', 'Oregon has not')
      assert.equal(today(zoneForState('HI')), '2026-10-20', 'nor has Hawaii')
    })
  })

  test('and the other way, where Hawaii is the one left behind', () => {
    // 1 Nov 2026, 07:30 UTC. New York 03:30 on the 1st, Oregon 00:30 on the 1st, Hawaii 21:30 on
    // 31 October — a different MONTH, which is the monthly email's whole subject line.
    at('2026-11-01T07:30:00Z', () => {
      assert.equal(today(zoneForState('NY')), '2026-11-01')
      assert.equal(today(zoneForState('OR')), '2026-11-01')
      assert.equal(today(zoneForState('HI')), '2026-10-31', 'still October in Hawaii')
      assert.ok(inMonth('2026-10-20', 2026, 10))
      // The email the cron would write at that instant is about a different month for each.
      assert.equal(today(zoneForState('HI')).slice(0, 7), '2026-10')
      assert.equal(today(zoneForState('OR')).slice(0, 7), '2026-11')
    })
  })

  test('what it changes: passed, and "due in N days"', () => {
    at('2026-10-21T04:30:00Z', () => {
      const due = '2026-10-20'
      // In New York that day has gone. In Oregon it is today.
      assert.equal(isPast(due, today(zoneForState('NY'))), true)
      assert.equal(isPast(due, today(zoneForState('OR'))), false)
      assert.equal(dueWords(due, today(zoneForState('OR'))), 'Due today')
      assert.match(dueWords(due, today(zoneForState('NY'))), /^Passed/)
    })
  })

  test('OREGON IS UNCHANGED — the only customers rev 1 has', () => {
    // The point of a change like this is that it moves nothing for the people already using it.
    for (const instant of ['2026-10-21T04:30:00Z', '2026-06-15T12:00:00Z', '2026-01-01T00:30:00Z'])
      at(instant, () => {
        assert.equal(today(zoneForState('OR')), today(), 'Oregon still gets the old default')
        assert.equal(today(zoneForState('WA')), today())
      })
  })
})

describe('every surface takes the zone from the server', () => {
  test('the route sends it, and the two pages read it', () => {
    const route = readFileSync('app/api/calendar/dates/route.ts', 'utf8')
    assert.match(route, /zoneForState\(co\?\.state\)/)
    assert.match(route, /to_confirm_count: toConfirm, timezone/)
    for (const f of ['app/calendar/page.tsx', 'app/dashboard/page.tsx']) {
      const src = readFileSync(f, 'utf8')
      assert.match(src, /today\(tz\)/, `${f} still reads a fixed today()`)
      assert.match(src, /json\.timezone|cJson\.timezone/, `${f} never reads the server's zone`)
    }
  })

  test('THE SWEEP PASSES NO asOf, so each company answers for itself', () => {
    // The trap: one `asOf` computed in the job and handed to every company would give them all the
    // SERVER's day and quietly undo the whole change.
    const job = readFileSync('app/api/jobs/calendar-month/route.ts', 'utf8')
    assert.match(job, /run\(undefined, false\)/, 'the nightly GET must not compute a day')
    assert.match(job, /\.\.\.\(asOf \? \{ asOf \} : \{\}\)/, 'and must not pass one down')
    assert.ok(!/import \{ today \}/.test(job), 'the job has no business knowing the server\'s day')
    const notify = readFileSync('lib/calendarNotify.ts', 'utf8')
    assert.match(notify, /today\(zoneForState\(company\.state/)
  })
})
