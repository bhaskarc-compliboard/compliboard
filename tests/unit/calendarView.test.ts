/**
 * THE CALENDAR TAB'S TWO VIEWS AND ITS DRAWER — `lib/calendarView.ts`, Calendar step 8a
 * (`docs/CALENDAR-PLAN.md` step 8a, boards 4, 5, 6 and 8; `docs/TESTING.md` C8a).
 *
 * Everything here is a function with no database: what "live" means, how a month is laid out, which
 * group a date falls in, and every phrase either view says. The markup is held by measurement
 * (`npm run measure`), as the workspace's and HR's is.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  readCalendarRows, CALENDAR_VIEW_COLUMNS, dayOf, monthOf, monthTitle, longDay, longDayAndWeekday,
  dayAndShortMonth, repeatWords, whenWords, passedWords, siteWords, metaParts, listGroups,
  monthGrid, openingMonth, shiftMonth, hasNoDay, resolveLink, googleCalendarUrl, outlookCalendarUrl,
  PERIOD_LABEL, PERIOD_CHOICES, WEEKDAYS, PER_DAY, MORE_WORD, NOT_CONFIRMED, EVERY_SITE, SITE_REMOVED,
  UNDATED_GROUP, UNDATED_STRIP, NOT_ON_CALENDAR, PERIOD_NOT_READ, ALREADY_HANDLED, COULD_NOT_LOAD,
  splitSiblings, ASKS_BEFORE, siteKeyOf, siteChoices, filterBySite, addDateProblem,
  NEED_A_TITLE, NEED_A_DAY,
  type CalendarRow,
} from '../../lib/calendarView.ts'

const PAGE = readFileSync('app/calendar/page.tsx', 'utf8')
const DRAWER = readFileSync('components/CalendarDateDrawer.tsx', 'utf8')
/**
 * A FILE WITHOUT ITS COMMENTS, for every check that reports an ABSENCE — and this helper exists
 * because two checks below broke on a comment at step 9. The drawer's header was corrected to say
 * that the second tab is live and was once *"drawn disabled with 'Arrives with step 8b' under it"*,
 * and `assert.ok(!DRAWER.includes('Arrives with step 8b'))` failed on that sentence: the
 * placeholder was gone from the markup and present in the paragraph explaining that it is gone.
 * `CLAUDE.md` §9a — a check that reads a comment as code looks exactly like a check that found
 * something. The same helper was already written inline five times in this file.
 */
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const DRAWER_CODE = codeOf(DRAWER)
const VIEW = readFileSync('lib/calendarView.ts', 'utf8')
/* eslint-disable @typescript-eslint/no-explicit-any */

/** A row with only what a test cares about; everything else is the empty, honest value. */
const row = (p: Partial<CalendarRow>): CalendarRow => ({
  id: 'r1', title: 'A date', description: null, due_date: null, next_due: null, days_until: null,
  has_passed: false, status: 'proposed', source: 'document', recurs: false, period: null,
  source_line: null, source_url: null, source_page: null, source_title: null,
  site_id: null, site_name: null, entity_id: null, document_id: null, handbook_id: null,
  audit_finding_id: null, deadline_id: null, added_by: null, confirmed_by: null, confirmed_at: null,
  dismissed_by: null, dismissed_at: null, dismissed_reason: null, replaced_by: null, created_at: null,
  ...p,
})

describe('the rows the tab reads are the live ones, through the shared filter', () => {
  test('calendar_v, status in (proposed, confirmed), replaced_by null — the counts\' own filter', async () => {
    const calls: Array<[string, ...unknown[]]> = []
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'is']) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q }
    q.then = (res: (v: { data: unknown[] }) => unknown) => res({ data: [] })
    await readCalendarRows({ from: (t: string) => { calls.push(['from', t]); return q } } as any)
    assert.deepEqual(calls, [
      ['from', 'calendar_v'],
      ['select', CALENDAR_VIEW_COLUMNS, undefined],
      ['in', 'status', ['proposed', 'confirmed']],
      ['is', 'replaced_by', null],
    ])
  })
  test('a dismissed row is in neither view, and a withdrawn one never reaches the page', () => {
    // `dismissed` is excluded by the filter above; `withdrawn` by `calendar_v` itself (migration
    // 075), so the page cannot show one even by accident.
    assert.ok(!CALENDAR_VIEW_COLUMNS.includes('withdrawn_at'), 'the page has no use for the stamp')
    assert.match(VIEW, /liveDates/)
  })
})

describe('A FAILED READ IS NOT AN EMPTY CALENDAR — §5.1', () => {
  test('readCalendarRows throws rather than returning [] when the query errors', async () => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'is']) q[m] = () => q
    q.then = (res: (v: { data: null; error: { message: string } }) => unknown) =>
      res({ data: null, error: { message: 'column calendar_v.nope does not exist' } })
    await assert.rejects(
      () => readCalendarRows({ from: () => q } as any),
      /calendar_v: column calendar_v\.nope does not exist/,
    )
  })
  test('the page says so, and does not say "No dates yet"', () => {
    assert.equal(COULD_NOT_LOAD,
      'We could not load your dates just now. Nothing has changed — please try again.')
    assert.match(PAGE, /setLoadFailed\(true\)/)
    // The order matters: the failure is tested BEFORE the empty state, or the claim wins.
    const body = PAGE.slice(PAGE.indexOf("{tab === 'calendar' && ("))
    assert.ok(body.indexOf('loadFailed ?') < body.indexOf('No dates yet'),
      'the failure must be checked before the empty state')
  })
})

describe('a DATE column is read as a day, in UTC', () => {
  test('both shapes PostgREST can return mean the same day', () => {
    assert.equal(dayOf('2026-11-30'), '2026-11-30')
    assert.equal(dayOf('2026-11-30T00:00:00Z'), '2026-11-30')
    assert.equal(dayOf(null), '')
    assert.equal(dayOf('rubbish'), '')
  })
  test('the month, the heading, the long day and the short anchor', () => {
    assert.equal(monthOf('2026-11-30'), '2026-11')
    assert.equal(monthTitle('2026-11'), 'November 2026')
    assert.equal(longDay('2026-11-30'), '30 November 2026')
    assert.equal(longDayAndWeekday('2026-11-15'), '15 November 2026 (Sunday)')
    assert.equal(dayAndShortMonth('2026-08-20'), '20 Aug')
  })
  test('a day never slips: the first of a month is the first, read anywhere', () => {
    assert.equal(longDay('2026-01-01'), '1 January 2026')
    assert.equal(monthOf('2026-01-01'), '2026-01')
  })
})

describe('how often it repeats, and from when', () => {
  test('"every year from 20 Aug" — the rule and its anchor', () => {
    assert.equal(repeatWords(row({ recurs: true, period: 'year', due_date: '2026-08-20' })), 'every year from 20 Aug')
    assert.equal(repeatWords(row({ recurs: true, period: 'quarter', due_date: null })), 'every 3 months')
  })
  test('a date that happens once says nothing about repeating', () => {
    assert.equal(repeatWords(row({ recurs: false, period: 'year', due_date: '2026-08-20' })), '')
  })
  test('REPEATING WITH NO PERIOD INVENTS NOTHING — decision 23', () => {
    assert.equal(repeatWords(row({ recurs: true, period: null, due_date: '2026-08-20' })), '')
    // What it says instead is a sentence of its own, and the drawer shows it.
    assert.match(PERIOD_NOT_READ, /repeats, but how often wasn't read/)
    assert.ok(DRAWER.includes('PERIOD_NOT_READ'))
  })
  test('the five periods, and the picker offers exactly those five', () => {
    assert.deepEqual(Object.keys(PERIOD_LABEL), ['month', 'quarter', '6 months', 'year', '2 years'])
    assert.deepEqual(PERIOD_CHOICES.map((c) => c.label),
      ['every month', 'every 3 months', 'every 6 months', 'every year', 'every 2 years'])
  })
})

describe('how far away it is — and a date HAS PASSED, it is never overdue', () => {
  test('ahead, behind, and the days either side of today', () => {
    assert.equal(whenWords({ days_until: 31, next_due: '2026-11-15' }), 'in 31 days')
    assert.equal(whenWords({ days_until: 0, next_due: '2026-10-15' }), 'today')
    assert.equal(whenWords({ days_until: 1, next_due: '2026-10-16' }), 'tomorrow')
    assert.equal(whenWords({ days_until: -1, next_due: '2026-10-14' }), 'yesterday')
    assert.equal(whenWords({ days_until: -12, next_due: '2026-10-03' }), '12 days ago')
  })
  test('no day yet, when the view could compute none', () => {
    assert.equal(whenWords({ days_until: null, next_due: null }), 'no day yet')
  })
  test('"passed 12 days ago", and only for a date the VIEW says has passed', () => {
    assert.equal(passedWords({ has_passed: true, days_until: -12 }), 'passed 12 days ago')
    assert.equal(passedWords({ has_passed: true, days_until: -1 }), 'passed yesterday')
    assert.equal(passedWords({ has_passed: false, days_until: -12 }), '',
      'a repeating date whose last occurrence is behind us has NOT passed — its next one is ahead')
  })
  test('the forbidden words are in neither the words nor the two screens', () => {
    const everything = [VIEW, PAGE, DRAWER].join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const bad of [/\boverdue\b/i, /\bcompliant\b/i, /\bAI\b/]) {
      assert.ok(!bad.test(everything), `nothing may say ${bad}`)
    }
  })
})

describe('the site shows only when there is a choice to make — decision 24', () => {
  const atSite = row({ site_id: 's1', entity_id: 's1', site_name: 'Portland plant' })
  test('one site: nothing about sites, anywhere', () => {
    assert.equal(siteWords(atSite, 1), '')
    assert.equal(siteWords(row({}), 1), '')
    assert.ok(!metaParts(atSite, 1).includes('Portland plant'))
  })
  test('two or more: the site, "Every site" for a company-wide date, and a removed one says so', () => {
    assert.equal(siteWords(atSite, 2), 'Portland plant')
    assert.equal(siteWords(row({}), 2), EVERY_SITE)
    // The row names a site the view could not join: the site was deleted in Documents or HR.
    assert.equal(siteWords(row({ entity_id: 'gone', site_id: 'gone', site_name: null }), 2), SITE_REMOVED)
  })
  test('the rule is the one HR and Documents already use', () => {
    assert.match(readFileSync('app/hr/HrWorkspace.tsx', 'utf8'), /sites\.length >= 2/)
    assert.match(readFileSync('app/documents/page.tsx', 'utf8'), /sites\.length > 1/)
  })
})

describe('the list row\'s meta line, in board 5\'s order', () => {
  const base = { next_due: '2026-11-15', days_until: 31, source_title: '1200-Z stormwater permit' }
  test('day · site · where it was read from · not confirmed', () => {
    assert.deepEqual(metaParts(row({ ...base, site_name: 'Portland plant', site_id: 's1' }), 2),
      ['15 November 2026', 'Portland plant', '1200-Z stormwater permit', NOT_CONFIRMED])
  })
  test('a confirmed date says nothing about being confirmed — the line is for what needs doing', () => {
    assert.deepEqual(metaParts(row({ ...base, status: 'confirmed' }), 1),
      ['15 November 2026', '1200-Z stormwater permit'])
  })
  test('a repeating date with a day shows both, in that order', () => {
    assert.deepEqual(metaParts(row({ ...base, recurs: true, period: 'year', due_date: '2026-03-01' }), 1),
      ['15 November 2026', 'every year from 1 Mar', '1200-Z stormwater permit', NOT_CONFIRMED])
  })
  test('a repeating date with NO day leads with how often, and says so when that is unread too', () => {
    assert.deepEqual(metaParts(row({ recurs: true, period: 'month', source_title: 'X' }), 1),
      ['every month', 'X', NOT_CONFIRMED])
    assert.deepEqual(metaParts(row({ recurs: true, period: null, source_title: 'X' }), 1),
      ["how often wasn't read", 'X', NOT_CONFIRMED])
  })
  test('a typed date names the person where a document names itself (board 5)', () => {
    const typed = row({ next_due: '2026-11-30', days_until: 46, source: 'person', status: 'confirmed', added_by: 'u1' })
    assert.deepEqual(metaParts(typed, 1, 'Priya Nair'), ['30 November 2026', 'Added by Priya Nair'])
    // No name to show — a profile with no `full_name` — still says where it came from.
    assert.deepEqual(metaParts(typed, 1, null), ['30 November 2026', 'Added by hand'])
  })
  test('a passed date says it has passed INSTEAD of "not confirmed" — one thing at a time', () => {
    const parts = metaParts(row({ ...base, next_due: '2026-10-03', days_until: -12, has_passed: true }), 1)
    assert.ok(parts.includes('passed 12 days ago'))
    assert.ok(!parts.includes(NOT_CONFIRMED))
  })
})

describe('the list: by month, soonest first, the undated last', () => {
  const rows = [
    row({ id: 'c', next_due: '2026-12-12', days_until: 58 }),
    row({ id: 'a', next_due: '2026-10-03', days_until: -12, has_passed: true }),
    row({ id: 'u1', title: 'Respirator fit testing', recurs: true, period: 'year' }),
    row({ id: 'b2', next_due: '2026-11-30', days_until: 46 }),
    row({ id: 'b1', next_due: '2026-11-15', days_until: 31 }),
  ]
  test('months ascend, and a PASSED date sits in its own month rather than being hidden', () => {
    const { months } = listGroups(rows)
    assert.deepEqual(months.map((m) => m.key), ['2026-10', '2026-11', '2026-12'])
    assert.deepEqual(months[0].title, 'October 2026')
    assert.deepEqual(months[0].rows.map((r) => r.id), ['a'])
  })
  test('inside a month, soonest first', () => {
    const { months } = listGroups(rows)
    assert.deepEqual(months[1].rows.map((r) => r.id), ['b1', 'b2'])
  })
  test('a date with no day is in neither month — it is the group at the foot', () => {
    const { months, undated } = listGroups(rows)
    assert.deepEqual(undated.map((r) => r.id), ['u1'])
    assert.ok(!months.some((m) => m.rows.some((r) => r.id === 'u1')))
    assert.equal(UNDATED_GROUP, "Repeats — how often or when wasn't read yet")
    assert.ok(hasNoDay(rows[2]) && !hasNoDay(rows[0]))
  })
  test('nothing at all groups to nothing, not to an empty month', () => {
    assert.deepEqual(listGroups([]), { months: [], undated: [] })
  })
})

describe('the month grid', () => {
  test('six whole weeks, Monday first, always — so the page never changes height', () => {
    for (const key of ['2026-02', '2026-11', '2027-05']) {
      const cells = monthGrid(key, [])
      assert.equal(cells.length, 42, key)
      assert.equal(new Date(`${cells[0].day}T00:00:00Z`).getUTCDay(), 1, `${key} starts on a Monday`)
    }
    assert.deepEqual([...WEEKDAYS], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })
  test('November 2026 starts on a Sunday, so the grid opens with six days of October', () => {
    const cells = monthGrid('2026-11', [])
    assert.equal(cells[0].day, '2026-10-26')
    assert.equal(cells[0].inMonth, false)
    assert.equal(cells[6].day, '2026-11-01')
    assert.equal(cells[6].inMonth, true)
  })
  test('a date lands on the day the VIEW computed, and days either side of the month still hold theirs', () => {
    const cells = monthGrid('2026-11', [
      row({ id: 'x', next_due: '2026-11-15' }),
      row({ id: 'y', next_due: '2026-11-15' }),
      row({ id: 'z', next_due: '2026-10-28' }),
    ])
    assert.deepEqual(cells.find((c) => c.day === '2026-11-15')?.rows.map((r) => r.id), ['x', 'y'])
    const spill = cells.find((c) => c.day === '2026-10-28')
    assert.equal(spill?.inMonth, false)
    assert.deepEqual(spill?.rows.map((r) => r.id), ['z'])
  })
  test('a date with no day is on no box at all', () => {
    const cells = monthGrid('2026-11', [row({ id: 'u', recurs: true })])
    assert.equal(cells.reduce((n, c) => n + c.rows.length, 0), 0)
  })
  test('a busy day overflows rather than stretching: "+2 more"', () => {
    assert.equal(PER_DAY, 2)
    assert.equal(MORE_WORD(2), '+2 more')
    assert.match(PAGE, /h-\[92px\]/, 'every box is the same fixed height')
  })
  test('THE CONFIRMED MARK IS A SHAPE, NOT A CHARACTER — so the row\'s name is its title', () => {
    // ● and ○ are font-dependent glyphs (different on a Mac and on Windows, which is why
    // `components/AppLayout.tsx` banned emoji from the nav) AND they land in the element's text,
    // which made a row's accessible name "○Six-year internal maintenance…".
    const code = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const glyph of ['●', '○']) assert.ok(!code.includes(glyph), `the grid must not print ${glyph}`)
    assert.match(code, /<circle cx="4" cy="4" r="3" fill=\{confirmed \? 'currentColor' : 'none'\}/)
  })
  test('the strip above the grid counts what cannot sit on it', () => {
    assert.equal(UNDATED_STRIP(4), 'Repeating, day not read yet (4)')
  })
  test('a month either side, across a year boundary', () => {
    assert.equal(shiftMonth('2026-12', 1), '2027-01')
    assert.equal(shiftMonth('2026-01', -1), '2025-12')
  })
  test('it opens on the month holding the soonest date still ahead, else on this one', () => {
    assert.equal(openingMonth([
      row({ next_due: '2026-10-03', days_until: -12, has_passed: true }),
      row({ next_due: '2026-11-30' }),
    ], '2026-10-15'), '2026-11')
    assert.equal(openingMonth([], '2026-10-15'), '2026-10')
    assert.equal(openingMonth([row({ recurs: true })], '2026-10-15'), '2026-10')
  })
})

describe('a link from another section', () => {
  const rows = [
    row({ id: 'd1' }),
    row({ id: 'd2', audit_finding_id: 'f9' }),
  ]
  test('?date= opens that row; ?finding= finds the live row that names the finding', () => {
    assert.equal(resolveLink(rows, 'd1', null)?.id, 'd1')
    assert.equal(resolveLink(rows, null, 'f9')?.id, 'd2')
  })
  test('NOT FOUND IS THE SAME ANSWER for removed, withdrawn, and another company\'s — §3.6', () => {
    for (const [d, f] of [['gone', null], [null, 'nope'], ['someone-elses', null]] as const) {
      assert.equal(resolveLink(rows, d, f), null)
    }
    assert.equal(NOT_ON_CALENDAR,
      "That date isn't on the calendar any more. If it should be, add it with + Add a date.")
    assert.ok(PAGE.includes('NOT_ON_CALENDAR'))
  })
  test('a link to one date lands on the Calendar tab, whichever tab the link names', () => {
    assert.match(PAGE, /asTab\(params\.get\('tab'\) \?\? \(\(linkedDate \|\| linkedFinding\) \? 'calendar' : null\)\)/)
  })
  test('neither parameter opens nothing, and says nothing', () => {
    assert.equal(resolveLink(rows, null, null), null)
    assert.match(PAGE, /const linkMissed = loaded && !!\(linkedDate \|\| linkedFinding\) && !open/)
  })
  test('WHICH DRAWER IS OPEN IS THE ADDRESS, not a second copy of it', () => {
    assert.match(PAGE, /const open = resolveLink\(rows, linkedDate, linkedFinding\)/)
    assert.ok(!/setOpenId/.test(PAGE), 'the open date must not also be stored in state')
  })
})

describe('sending one date to a personal calendar — the old page\'s two URLs, reused', () => {
  const r = row({ title: 'Tier II annual report', description: 'Portland', next_due: '2026-11-30' })
  test('Google takes a compact day, twice', () => {
    assert.equal(googleCalendarUrl(r),
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Tier%20II%20annual%20report'
      + '&dates=20261130/20261130&details=Portland')
  })
  test('Outlook takes the day as it is', () => {
    assert.equal(outlookCalendarUrl(r),
      'https://outlook.live.com/calendar/0/deeplink/compose?subject=Tier%20II%20annual%20report'
      + '&startdt=2026-11-30&enddt=2026-11-30&body=Portland')
  })
  test('a date with no day has nothing to send, so neither link is offered', () => {
    const u = row({ title: 'x', recurs: true })
    assert.equal(googleCalendarUrl(u), '')
    assert.equal(outlookCalendarUrl(u), '')
    assert.match(DRAWER, /googleCalendarUrl\(row\) && \(/)
  })
})

describe('the drawer says what it does not know, and what it cannot do yet', () => {
  test('the second tab opens the real report (step 8b replaced 8a\'s placeholder)', () => {
    assert.match(DRAWER, /The report/)
    assert.ok(!DRAWER_CODE.includes('Arrives with step 8b'))
    assert.match(DRAWER, /onClick=\{onOpenReport\}/)
  })
  test('decision 27\'s line ends the first tab', () => {
    assert.equal(ALREADY_HANDLED,
      'If you have already handled this, add the proof in Company Documents and it will show here.')
    assert.ok(DRAWER.includes('ALREADY_HANDLED'))
  })
  test('decision 14: a newer version, and a document that is gone', () => {
    assert.ok(DRAWER.includes('NEWER_VERSION') && DRAWER.includes('DOCUMENT_GONE'))
    assert.match(PAGE, /\.eq\('version_of', openDocFor\)/)
  })
  test('WHERE IT CAME FROM IS DECIDED BY `source`, not by which id is set', () => {
    /**
     * `lib/auditRun.ts` files an audit's date with the document the finding is about AS WELL AS
     * the finding, so an audit row carries `document_id` and `audit_finding_id` both. The first
     * version of the drawer branched on `doc ? … : finding ? …` and showed an audit date's source
     * as the DOCUMENT. Caught by opening one and reading it; held here.
     */
    const code = DRAWER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const at = code.indexOf('Where it came from')
    const branch = code.slice(at, at + 1600)
    assert.match(branch, /row\.source === 'audit' && finding \?/)
    assert.ok(branch.indexOf("row.source === 'audit'") < branch.indexOf("row.source === 'document'"),
      'the audit branch must be tested first')
    assert.ok(!/^\s*\{doc \? \(/m.test(code), 'nothing may branch on the document id alone')
  })
  test('the document kind is shown in words, from the one map, not a fourth copy', () => {
    assert.match(DRAWER, /KIND_WORD\[doc\.kind\]/)
    const status = readFileSync('lib/documentStatus.ts', 'utf8')
    assert.match(status, /export const KIND_WORD/)
    assert.equal(/supplier_document: 'Supplier document'/.test(status), true)
  })
  test('IT WRITES THROUGH THE ONE WRITER and builds no row of its own', () => {
    const code = DRAWER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.match(code, /method: 'PATCH'/)
    assert.ok(!/\.from\('calendar_events'\)/.test(code), 'the drawer never touches the table')
    assert.ok(!/status: '(confirmed|dismissed)'/.test(code), 'it names no status')
  })
  /**
   * *** THE SHEET MOVED OUT OF THE DRAWER AT STEP 9, so this test follows it. *** The queue's "Not
   * right" is the same action on the same row (`dismiss`), and board 8 says so in its own note —
   * "one sheet, two titles". A second copy would have been two places for the optional-reason rule
   * and the focus to drift, which is what this test is for.
   */
  test('Remove asks, and Cancel holds the focus so Enter never removes (board 8)', () => {
    const sheet = readFileSync('components/RemoveDateSheet.tsx', 'utf8')
    assert.match(sheet, /Remove this date\?/)
    assert.match(sheet, /Why\? Optional, one line\./)
    assert.match(sheet, /<button autoFocus onClick=\{onClose\}/)
    // Both titles, and the destructive button is the same one in both cases.
    assert.match(sheet, /NOT_RIGHT_TITLE = 'Not right\?'/)
    assert.match(sheet, /\{busy \? 'Removing…' : 'Remove'\}/)
    // And both surfaces render THIS file rather than their own markup.
    assert.match(DRAWER_CODE, /<RemoveDateSheet mode="remove"/)
    assert.match(codeOf(readFileSync('components/DateQueue.tsx', 'utf8')), /<RemoveDateSheet mode="not-right"/)
    for (const [where, src] of [['the drawer', DRAWER], ['the queue', readFileSync('components/DateQueue.tsx', 'utf8')]] as const) {
      assert.ok(!src.includes('Remove this date?'), `${where} must not hold a second copy of the title`)
    }
  })
})


// =================================================================================================
// STEP 8b — the report tab, Add a date, the site filter, printing
// =================================================================================================

const SHEET = readFileSync('components/AddDateSheet.tsx', 'utf8')

describe('what the same document asks BEFORE this date — board 6', () => {
  const mine = { next_due: '2026-11-15' }
  const rows = [
    row({ id: 'early', next_due: '2026-09-16' }),
    row({ id: 'later', next_due: '2027-03-01' }),
    row({ id: 'noday', recurs: true }),
    row({ id: 'same', next_due: '2026-11-15' }),
  ]
  test('earlier dates split out, soonest first; everything else stays', () => {
    const { before, others } = splitSiblings(mine, rows)
    assert.deepEqual(before.map((r) => r.id), ['early'])
    assert.deepEqual(others.map((r) => r.id), ['later', 'noday', 'same'])
    assert.equal(ASKS_BEFORE(1), 'What this document asks before then · 1')
  })
  test('a date with no day cannot be "before" anything, and nor can anything when THIS date has none', () => {
    assert.deepEqual(splitSiblings({ next_due: null }, rows).before, [])
    assert.deepEqual(splitSiblings({ next_due: null }, rows).others.map((r) => r.id),
      ['early', 'later', 'noday', 'same'])
  })
  test('the same day is not "before" it', () => {
    assert.deepEqual(splitSiblings(mine, [row({ id: 'same', next_due: '2026-11-15' })]).before, [])
  })
  test('IT IS THE DOCUMENT\'S OTHER DATES, because nothing else in the family has a day', () => {
    // `document_conditions` has title / condition_ref / evidence_expected / ordinal and no date;
    // `document_gaps` has locator / quote / fix and no date. Read from the generated types, so this
    // fails the day either gains one — which is the day the board's literal version becomes possible.
    const types = readFileSync('lib/database.types.ts', 'utf8')
    for (const t of ['document_conditions', 'document_gaps']) {
      const at = types.indexOf(`      ${t}: {`)
      assert.ok(at > 0, `${t} must exist`)
      const block = types.slice(at, types.indexOf('Insert:', at))
      assert.ok(!/\b(due_on|due_date|due_by)\b/.test(block), `${t} must still carry no date`)
    }
  })
})

describe('the drawer\'s second tab', () => {
  test('it is the PAGE that mounts the report, because the report brings its own drawer', () => {
    for (const f of ['components/DocumentReport.tsx', 'components/AuditReport.tsx']) {
      assert.match(readFileSync(f, 'utf8'), /<Drawer\b/, `${f} renders its own Drawer`)
    }
    assert.match(DRAWER, /onOpenReport: \(\(\) => void\) \| null/)
    assert.match(PAGE, /<DocumentReport documentId=\{report\.id\}/)
    assert.match(PAGE, /<AuditReport runId=\{report\.id\}/)
  })
  test('the date\'s drawer is hidden under it, as Audits hides the audit under a document', () => {
    assert.match(PAGE, /className=\{report \|\| openDocId \? 'hidden' : ''\}/)
    assert.match(readFileSync('app/audits/page.tsx', 'utf8'), /className=\{openDoc \? 'hidden' : ''\}/)
  })
  test('the tab row travels with the report, so "The date" is still one click', () => {
    assert.match(PAGE, /topLine=\{<ReportTabs onBack=\{\(\) => setReport\(null\)\} second=/)
    assert.match(PAGE, /function ReportTabs/)
  })
  test('a date with no report HIDES the tab rather than disabling it', () => {
    // There is nothing to arrive later for a typed date, and a greyed tab promises something.
    assert.match(DRAWER, /\{onOpenReport && \(/)
    assert.ok(!DRAWER_CODE.includes('Arrives with step 8b'), "8a's placeholder is gone")
    assert.match(PAGE, /: open\.document_id\s*\n\s*\? \(\) => setReport\(\{ kind: 'document'/)
  })
  test('AuditReport gained topLine additively, and Audits passes none', () => {
    const audit = readFileSync('components/AuditReport.tsx', 'utf8')
    assert.match(audit, /topLine\?: React\.ReactNode/)
    assert.equal((audit.match(/topLine=\{topLine\}/g) ?? []).length, 2,
      "both of the report's own drawers take it")
    // Scoped to the element itself: a looser search matched `topLine` further down the file,
    // on the DocumentReport that Audits DOES pass one to — a false positive of my own making.
    const audits = readFileSync('app/audits/page.tsx', 'utf8')
    const at = audits.indexOf('<AuditReport')
    assert.ok(at > 0, 'Audits must still mount it')
    assert.ok(!audits.slice(at, audits.indexOf('/>', at)).includes('topLine'),
      'Audits must still pass none, so what it draws is unchanged')
  })
})

describe('Add a date — board 9', () => {
  test('a date with no name is refused', () => {
    assert.equal(addDateProblem({ title: '', when: '2026-11-30', recurs: false }), NEED_A_TITLE)
    assert.equal(addDateProblem({ title: '   ', when: '2026-11-30', recurs: false }), NEED_A_TITLE)
  })
  test('a ONE-OFF with no day is refused, in the database\'s own words', () => {
    assert.equal(addDateProblem({ title: 'Tier II', when: '', recurs: false }), NEED_A_DAY)
    assert.equal(addDateProblem({ title: 'Tier II', when: 'not a date', recurs: false }), NEED_A_DAY)
    assert.match(NEED_A_DAY, /happens once needs a day/)
  })
  test('A REPEATING DATE WITH NO DAY SAVES — migration 060\'s rule, decision 23\'s state', () => {
    assert.equal(addDateProblem({ title: 'Respirator fit testing', when: '', recurs: true }), null)
    assert.equal(addDateProblem({ title: 'Tier II', when: '2026-11-30', recurs: false }), null)
  })
  test('the refusals are sentences in the sheet, never a browser alert', () => {
    const code = SHEET.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/\balert\(|confirm\(|prompt\(/.test(code), 'no browser dialog')
    assert.match(code, /setError\(problem\)/)
  })
  test('it posts to the one route and names no status — proposeDate decides that', () => {
    const code = SHEET.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.match(code, /fetch\('\/api\/calendar', \{\s*\n?\s*method: 'POST'/)
    assert.ok(!/status:|source:/.test(code), 'the sheet names neither status nor source')
    assert.ok(!/\.from\('calendar_events'\)/.test(code))
  })
  test('the site is offered only when there is more than one', () => {
    assert.match(SHEET, /\{sites\.length > 1 && \(/)
  })
})

describe('the site filter — decision 24', () => {
  const sites = [{ id: 's2', name: 'Vancouver warehouse' }, { id: 's1', name: 'Portland plant' }]
  const rows = [
    row({ id: 'a', site_id: 's1', entity_id: 's1', site_name: 'Portland plant' }),
    row({ id: 'b', site_id: 's2', entity_id: 's2', site_name: 'Vancouver warehouse' }),
    row({ id: 'c' }),
    row({ id: 'd', site_id: 'gone', entity_id: 'gone', site_name: null }),
  ]
  test('each row falls in exactly one bucket, and a removed site is its own', () => {
    assert.deepEqual(rows.map(siteKeyOf), ['s1', 's2', 'every', 'removed'])
  })
  test('the choices are HR\'s order, and only what is actually there', () => {
    assert.deepEqual(siteChoices(rows, sites).map((c) => c.label),
      ['Every site', 'Company-wide', 'Portland plant', 'Vancouver warehouse', 'Site removed'])
    // The filter says "Site removed"; the DRAWER says the full sentence, because there it is an
    // instruction and here it is a choice in a list.
    assert.equal(SITE_REMOVED, 'Site removed — choose where it applies')
    assert.deepEqual(siteChoices([rows[0]], sites).map((c) => c.key), ['all', 's1'])
  })
  test('filtering narrows the rows; "all" is the filter off', () => {
    assert.deepEqual(filterBySite(rows, 's1').map((r) => r.id), ['a'])
    assert.deepEqual(filterBySite(rows, 'every').map((r) => r.id), ['c'])
    assert.deepEqual(filterBySite(rows, 'removed').map((r) => r.id), ['d'])
    assert.equal(filterBySite(rows, 'all').length, 4)
  })
  test('THE TAB COUNTS AND THE SIDEBAR BADGE DO NOT FOLLOW IT', () => {
    // They are the section's totals, and the badge is read on every page where no filter exists.
    // A badge that followed a filter would disagree with the page the moment a site was picked.
    assert.match(PAGE, /const shownRows = filterBySite\(rows, siteFilter\)/)
    assert.match(PAGE, /label: `Calendar\$\{loaded && counts\.dates > 0/)
    assert.ok(!/counts\.dates = |setCounts\(.*shownRows/.test(PAGE))
  })
  test('the filter is never drawn for a company with one site', () => {
    assert.match(PAGE, /\{sites\.length > 1 && \(<>/)
  })
})

describe('printing — the month prints as the list', () => {
  test('the grid and its legend are no-print; the list is drawn under them for paper', () => {
    assert.match(PAGE, /className="no-print mt-3 grid grid-cols-7/)
    assert.match(PAGE, /<div className="hidden print:block">\{listBody\}<\/div>/)
  })
  test('it prints through the shared frame, as HR prints a conversation', () => {
    assert.match(PAGE, /printWithFrame\(\{ company: companyName \?\? '', type: 'Calendar' \}\)/)
    assert.match(readFileSync('app/hr/HrWorkspace.tsx', 'utf8'),
      /printWithFrame\(\{ company: companyName \?\? '', type: 'Conversation' \}\)/)
  })
})
