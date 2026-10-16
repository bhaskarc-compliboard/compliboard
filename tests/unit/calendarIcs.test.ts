/**
 * THE CALENDAR AS AN .ics FILE — `lib/calendarIcs.ts`, Calendar step 8b part 3 (decision 20,
 * board 11; `DECISIONS.md` §193, `docs/TESTING.md` C8b-6).
 *
 * One generator feeds two readers — the subscription route and the sheet's download — so what is
 * held here is held for both. The fixed set of rows is the one STOP 1 named: a dated one-off, a
 * recurring date with an anchor, a recurring date with no day, and a date that has passed.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildIcs, planEvents, rrule, escapeText, fold, nextDay, stamp, describe as describeRow,
  ICS_COLUMNS, SKIPPED_LINE,
} from '../../lib/calendarIcs.ts'
import type { CalendarRow } from '../../lib/calendarView.ts'

const row = (p: Partial<CalendarRow>): CalendarRow => ({
  id: 'r1', title: 'A date', description: null, due_date: null, next_due: null, days_until: null,
  has_passed: false, status: 'confirmed', source: 'document', recurs: false, period: null,
  source_line: null, source_url: null, source_page: null, source_title: null,
  site_id: null, site_name: null, entity_id: null, document_id: null, handbook_id: null,
  audit_finding_id: null, deadline_id: null, added_by: null, confirmed_by: null, confirmed_at: null,
  dismissed_by: null, dismissed_at: null, dismissed_reason: null, replaced_by: null, created_at: null,
  ...p,
})

/** STOP 1's fixed set. */
const DATED = row({
  id: 'd1', title: 'Air permit expires', due_date: '2026-11-30', next_due: '2026-11-30',
  source_title: 'ACDP 26-2841', source_line: 'This permit expires on November 15, 2026.',
})
const RECURRING = row({
  id: 'd2', title: 'Tier II annual report', recurs: true, period: 'year',
  due_date: '2026-03-01', next_due: '2027-03-01',
})
const NO_DAY = row({ id: 'd3', title: 'Respirator fit testing', recurs: true, period: null })
const PASSED = row({
  id: 'd4', title: 'Forklift evaluations', due_date: '2026-10-03', next_due: '2026-10-03',
  has_passed: true, days_until: -12, status: 'proposed',
})
const ALL = [DATED, RECURRING, NO_DAY, PASSED]
const NOW = new Date('2026-10-16T12:00:00Z')
const build = (rows: CalendarRow[] = ALL) => buildIcs(rows, { name: 'CompliBoard — compliance dates', now: NOW })

describe('which rows become an event', () => {
  test('a dated one-off does; a recurring date with an anchor does', () => {
    const { events } = planEvents([DATED, RECURRING])
    assert.deepEqual(events.map((e) => [e.row.id, e.start, e.repeat]),
      [['d1', '2026-11-30', null], ['d2', '2026-03-01', 'FREQ=YEARLY']])
  })
  test('THE RECURRING EVENT STARTS AT ITS ANCHOR, not at its next occurrence', () => {
    // The RRULE counts from DTSTART, so starting at `next_due` would drop every occurrence
    // between the anchor and today and shift the whole series.
    assert.equal(planEvents([RECURRING]).events[0].start, '2026-03-01')
  })
  test('A DATE WE CANNOT PLACE IS LEFT OUT AND COUNTED, never guessed at', () => {
    const { events, skipped } = planEvents(ALL)
    assert.ok(!events.some((e) => e.row.id === 'd3'))
    assert.deepEqual(skipped.map((r) => r.id), ['d3'])
    // And so is a repeating date that HAS a day but no rule to count by.
    const noRule = row({ id: 'd5', recurs: true, period: null, due_date: '2026-08-20' })
    assert.deepEqual(planEvents([noRule]).skipped.map((r) => r.id), ['d5'])
  })
  test('A PASSED DATE IS STILL AN EVENT — a date has passed, it is not deleted', () => {
    const { events } = planEvents([PASSED])
    assert.equal(events.length, 1)
    assert.equal(events[0].start, '2026-10-03')
  })
  test('all five periods, as RFC 5545 says them', () => {
    assert.deepEqual(['month', 'quarter', '6 months', 'year', '2 years'].map(rrule), [
      'FREQ=MONTHLY', 'FREQ=MONTHLY;INTERVAL=3', 'FREQ=MONTHLY;INTERVAL=6',
      'FREQ=YEARLY', 'FREQ=YEARLY;INTERVAL=2',
    ])
    assert.equal(rrule(null), null)
    assert.equal(rrule('fortnightly'), null)
  })
})

describe('the file itself', () => {
  const { text, included, skipped } = build()
  const lines = text.split('\r\n')

  test('three events from four rows, and the fourth counted', () => {
    assert.equal(included, 3)
    assert.deepEqual(skipped.map((r) => r.id), ['d3'])
    assert.equal(SKIPPED_LINE(1), '1 date is not in this file: it repeats and we do not know when it next falls.')
    assert.match(SKIPPED_LINE(2), /^2 dates are not in this file/)
  })
  test('the wrapper RFC 5545 asks for, and CRLF throughout', () => {
    assert.equal(lines[0], 'BEGIN:VCALENDAR')
    for (const l of ['VERSION:2.0', 'PRODID:-//CompliBoard//Compliance Calendar//EN',
      'CALSCALE:GREGORIAN', 'X-WR-CALNAME:CompliBoard — compliance dates']) {
      assert.ok(lines.includes(l), `missing ${l}`)
    }
    assert.ok(text.endsWith('END:VCALENDAR\r\n'))
    assert.ok(!/[^\r]\n/.test(text), 'every line ends CRLF')
  })
  test('an all-day event ENDS THE NEXT DAY, because DTEND is exclusive', () => {
    assert.ok(text.includes('DTSTART;VALUE=DATE:20261130'))
    assert.ok(text.includes('DTEND;VALUE=DATE:20261201'))
    assert.equal(nextDay('2026-12-31'), '20270101')
    assert.equal(nextDay('2028-02-28'), '20280229')
  })
  test('THE UID IS THE ROW ID, so a re-fetch updates and never duplicates', () => {
    for (const id of ['d1', 'd2', 'd4']) assert.ok(text.includes(`UID:${id}@compliboard.com`))
    assert.equal((text.match(/UID:/g) ?? []).length, 3)
  })
  test('the same rows twice are identical but for DTSTAMP', () => {
    const a = build().text
    const b = buildIcs(ALL, { name: 'CompliBoard — compliance dates', now: new Date('2027-01-01T00:00:00Z') }).text
    const strip = (s: string) => s.replace(/DTSTAMP:[0-9TZ]+/g, 'DTSTAMP:X')
    assert.equal(strip(a), strip(b))
    assert.notEqual(a, b)
    assert.equal(stamp(NOW), '20261016T120000Z')
  })
  test('the recurring event carries its rule; the one-offs carry none', () => {
    assert.ok(text.includes('RRULE:FREQ=YEARLY'))
    assert.equal((text.match(/RRULE:/g) ?? []).length, 1)
  })
})

describe('what each event says, and what it never says', () => {
  test('where it came from, the line it was read from, and whether it is confirmed', () => {
    assert.equal(describeRow(DATED),
      'From: ACDP 26-2841\n"This permit expires on November 15, 2026."')
    assert.match(describeRow(PASSED), /Not confirmed yet/)
    assert.equal(describeRow(row({})), '', 'nothing to say is said as nothing')
  })
  test('*** THE PERSON\'S OWN NOTE IS NEVER IN IT *** — the owner, 16 October 2026', () => {
    const note = 'Key is in the safe; ask Priya. Account 4471-X.'
    const withNote = row({ ...DATED, description: note })
    assert.ok(!describeRow(withNote).includes('Priya'))
    assert.ok(!buildIcs([withNote], { name: 'x', now: NOW }).text.includes('Priya'))
    // And the column is not even read, so it cannot arrive by accident through a widened select.
    assert.ok(!ICS_COLUMNS.includes('description'), 'the generator never asks for the note')
    assert.match(readFileSync('components/SendCalendarSheet.tsx', 'utf8'),
      /Your own notes on a date are never in the link or the file/)
  })
  test('never "AI", never a cost (§2.1)', () => {
    const { text } = build()
    assert.ok(!/\bAI\b/.test(text))
    assert.ok(!/\$|cost|token/i.test(text))
  })
})

describe('escaping and folding, or the file breaks in every app at once', () => {
  test('RFC 5545 §3.3.11, and the BACKSLASH FIRST', () => {
    assert.equal(escapeText('Annual maintenance, all units'), 'Annual maintenance\\, all units')
    assert.equal(escapeText('a;b'), 'a\;b')
    assert.equal(escapeText('one\ntwo'), 'one\\ntwo')
    // Escaping the backslash after the others would double-escape what they inserted.
    assert.equal(escapeText('a\\b,c'), 'a\\\\b\\,c')
  })
  test('a title with a comma survives into the file as one property', () => {
    const { text } = buildIcs([row({ id: 'x', title: 'Maintenance, all units', due_date: '2026-11-30', next_due: '2026-11-30' })],
      { name: 'n', now: NOW })
    assert.ok(text.includes('SUMMARY:Maintenance\\, all units'))
  })
  test('no line is over 75 octets, and a long one folds with CRLF + space', () => {
    const long = 'x'.repeat(300)
    const { text } = buildIcs([row({ id: 'y', title: long, due_date: '2026-11-30', next_due: '2026-11-30' })],
      { name: 'n', now: NOW })
    for (const l of text.split('\r\n')) {
      assert.ok(new TextEncoder().encode(l).length <= 75, `too long: ${l.slice(0, 20)}…`)
    }
    assert.ok(text.includes('\r\n '), 'folded lines continue with one space')
  })
  test('folding counts OCTETS and never splits a character', () => {
    const folded = fold('É'.repeat(60))
    for (const l of folded.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 76)
    assert.equal(folded.replace(/\r\n /g, ''), 'É'.repeat(60), 'nothing is lost or mangled')
  })
})

describe('one generator, two readers', () => {
  test('the route and the sheet both call buildIcs — there is no second set of rules', () => {
    assert.match(readFileSync('app/api/calendar/feed/route.ts', 'utf8'), /buildIcs\(/)
    assert.match(readFileSync('components/SendCalendarSheet.tsx', 'utf8'), /buildIcs\(/)
  })
  test('it is browser-safe: it imports a type and nothing else', () => {
    const src = readFileSync('lib/calendarIcs.ts', 'utf8')
    const imports = [...src.matchAll(/^\s*import\s+(type\s+)?.*from\s+'([^']+)'/gm)]
    assert.deepEqual(imports.map((m) => [m[1] ? 'type' : 'runtime', m[2]]), [['type', './calendarView.ts']])
  })
  test('IT NEVER READS THE CLOCK — `now` is a parameter, which is what makes it testable', () => {
    const body = readFileSync('lib/calendarIcs.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/new Date\(\)|Date\.now/.test(body))
  })
})


describe('the feed route — the one with no session', () => {
  const ROUTE = readFileSync('app/api/calendar/feed/route.ts', 'utf8')
  const code = ROUTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('THE COMPANY COMES FROM THE TOKEN ROW, never from the query string', () => {
    // §3.6's rule with the token standing in for the session. The only parameter read is `t`.
    assert.match(code, /searchParams\.get\('t'\)/)
    assert.equal((code.match(/searchParams\.get\(/g) ?? []).length, 1, 'it reads one parameter')
    assert.match(code, /\.eq\('company_id', companyId\)/)
    assert.match(code, /const companyId = \(row as \{ company_id\?: string \} \| null\)\?\.company_id/)
  })
  test('a revoked token is not a token', () => {
    assert.match(code, /\.is\('revoked_at', null\)/)
  })
  test('EVERY REFUSAL IS THE SAME REFUSAL — 404, no body, including a server fault', () => {
    assert.match(code, /const NOT_FOUND = \(\) => new NextResponse\(null, \{ status: 404 \}\)/)
    assert.ok(!/status: 40[13]/.test(code), 'never 401 or 403 — those tell a prober it exists')
    // The catch returns 404 too: a 500 would say the token was good and something else broke.
    assert.match(code, /catch \(err\) \{[\s\S]*?return NOT_FOUND\(\)/)
  })
  test('the token is never logged', () => {
    for (const m of code.matchAll(/console\.(log|warn|error)\(([^\n]*)\)/g)) {
      assert.ok(!/\btoken\b/.test(m[2]) || /token lookup failed|unknown or revoked/.test(m[2]),
        `a log line may not carry the token: ${m[0]}`)
    }
  })
  test('GET only, and nothing a shared cache may keep', () => {
    assert.match(code, /export async function GET/)
    for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      assert.ok(!code.includes(`export async function ${m}`), `${m} must not exist`)
    }
    assert.match(code, /'Cache-Control': 'private, no-store, max-age=0, must-revalidate'/)
    assert.match(code, /'Content-Type': 'text\/calendar; charset=utf-8'/)
    assert.match(code, /export const dynamic = 'force-dynamic'/)
  })
  test('it reads the same "live" the rest of the section reads, and never writes', () => {
    assert.match(code, /LIVE_STATUSES/)
    assert.match(code, /\.is\('replaced_by', null\)/)
    for (const w of ['.insert(', '.update(', '.delete(', '.upsert(']) {
      assert.ok(!code.includes(w), `${w} has no business in a feed`)
    }
  })
  test('the token is 256 bits from the CSPRNG, and only a session may ask for one', () => {
    const issuer = readFileSync('app/api/calendar/feed-token/route.ts', 'utf8')
    assert.match(issuer, /randomBytes\(32\)\.toString\('base64url'\)/)
    assert.match(issuer, /requireCompany\(request\)/)
    // Comments stripped first: the route's own comment SAYS "not Math.random(), and not a UUID",
    // and the first version of this line matched that sentence rather than the code under it —
    // a check reading a comment as code (`CLAUDE.md` §9a), which is how it passes while lying.
    const issuerCode = issuer.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/Math\.random|randomUUID/.test(issuerCode), 'not Math.random, not a UUID')
  })
  test('ONE LIVE TOKEN PER COMPANY: a second insert is converged away, not left', () => {
    /**
     * Opening the sheet once left TWO live tokens on staging: React Strict Mode double-invokes an
     * effect in development, both POSTs read nothing, and both inserted. Not a development-only
     * fault — two tabs race the same way — and a live credential nobody knows about is the worst
     * kind of secret. Found by reading `calendar_feed_tokens` after the walk, not by a test.
     */
    const issuer = readFileSync('app/api/calendar/feed-token/route.ts', 'utf8')
    assert.match(issuer, /\.order\('created_at', \{ ascending: true \}\)/, 'the OLDEST wins')
    assert.match(issuer, /\.update\(\{ revoked_at: new Date\(\)\.toISOString\(\) \}\)/)
    assert.match(issuer, /\.neq\('token', keep\)/)
    assert.match(issuer, /partial unique index/, 'and the durable fix is named')
  })
  test('and it is still kept out of the account export, and still deleted with the company', () => {
    assert.match(readFileSync('app/api/account/export/route.ts', 'utf8'),
      /calendar_feed_tokens` IS DELIBERATELY NOT HERE/)
    assert.match(readFileSync('app/api/account/route.ts', 'utf8'), /'calendar_feed_tokens',/)
  })
})
