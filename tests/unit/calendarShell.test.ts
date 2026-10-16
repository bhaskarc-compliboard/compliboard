/**
 * THE CALENDAR PAGE SHELL — Calendar step 7 (`docs/CALENDAR-PLAN.md` §2.4, `docs/TESTING.md` C7).
 *
 * Two kinds of check, kept apart on purpose:
 *
 *   1. `lib/calendarCounts.ts` — the only logic this step adds: what "live" means, which date is
 *      next, and the info bar's rule for zero. Tested as functions, with no database.
 *   2. The page and the sidebar, read as SOURCE. The markup itself is held by measurement
 *      (`npm run measure`, `docs/TESTING.md`), not by assertions about class strings — but four
 *      things about it are facts a test can hold and a careless edit would silently undo: the
 *      owner's words, that the frame is IMPORTED and not copied, that nothing of the old page came
 *      across, and that the page writes nothing.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  liveDates, countsFrom, countDatesToConfirm, dayAndMonth, infoBarParts, stillAhead,
  LIVE_STATUSES, CALENDAR_COUNT_COLUMNS, type CountRow,
} from '../../lib/calendarCounts.ts'

const PAGE = readFileSync('app/calendar/page.tsx', 'utf8')
/**
 * THE CODE WITHOUT ITS COMMENTS — and this is not tidiness. Every check below that reports an
 * ABSENCE was written against the whole file first, and three of them failed on the page's own
 * header, which names `/api/extract-dates`, `completed` and `calendar_v` in order to say that the
 * page no longer touches them. A check that reads a comment as code is the `clientImports` trap
 * (`tests/unit/clientImports.test.ts`, its own `code()` helper) and `CLAUDE.md` §9a's: it looks
 * exactly like a check that found something.
 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CODE = code(PAGE)
const LAYOUT = readFileSync('components/AppLayout.tsx', 'utf8')
const HR = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')
const COUNTS = readFileSync('lib/calendarCounts.ts', 'utf8')

/** A stand-in for the client that records the query built on it. */
function fakeDb(rows: unknown[], count = 0) {
  const calls: Array<[string, ...unknown[]]> = []
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'in', 'is', 'eq']) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q }
  q.then = (res: (v: { data: unknown[]; count: number }) => unknown) => res({ data: rows, count })
  return { calls, db: { from: (t: string) => { calls.push(['from', t]); return q } } }
}
/* eslint-disable @typescript-eslint/no-explicit-any */

const row = (p: Partial<CountRow>): CountRow =>
  ({ id: 'r', status: 'proposed', next_due: null, has_passed: false, ...p })

describe('what is ON the calendar is one filter, used at both ends', () => {
  test('live means status in (proposed, confirmed) and replaced_by null — read from calendar_v', async () => {
    const { calls, db } = fakeDb([])
    await liveDates(db as any, CALENDAR_COUNT_COLUMNS).then((r: unknown) => r)
    assert.deepEqual(calls, [
      ['from', 'calendar_v'],
      ['select', CALENDAR_COUNT_COLUMNS, undefined],
      ['in', 'status', ['proposed', 'confirmed']],
      ['is', 'replaced_by', null],
    ])
    // A dismissed row is a person's decision and is kept; a withdrawn row is not in the view at all.
    assert.ok(!(LIVE_STATUSES as readonly string[]).includes('dismissed'))
    assert.ok(!(LIVE_STATUSES as readonly string[]).includes('withdrawn'))
  })

  test('THE SIDEBAR BADGE ADDS ONE WORD TO THAT FILTER AND COUNTS, it does not write its own query', async () => {
    const { calls, db } = fakeDb([], 7)
    assert.equal(await countDatesToConfirm(db as any), 7)
    assert.deepEqual(calls, [
      ['from', 'calendar_v'],
      ['select', 'id', { count: 'exact', head: true }],
      ['in', 'status', ['proposed', 'confirmed']],
      ['is', 'replaced_by', null],
      ['eq', 'status', 'proposed'],
    ])
  })

  test('a count that does not answer is 0 and not NaN', async () => {
    const { db } = fakeDb([], undefined as unknown as number)
    assert.equal(await countDatesToConfirm(db as any), 0)
  })

  test('the nav never builds the calendar query itself — it calls the shared one', () => {
    assert.match(LAYOUT, /countDatesToConfirm/)
    assert.ok(!/calendar_v/.test(LAYOUT), 'AppLayout must not name calendar_v: one definition of the number')
  })
})

describe('the counts, and which date is next', () => {
  test('dates are every live row; waiting is the ones still proposed', () => {
    const c = countsFrom([
      row({ id: 'a', status: 'proposed' }), row({ id: 'b', status: 'confirmed' }),
      row({ id: 'c', status: 'proposed' }),
    ])
    assert.equal(c.dates, 3)
    assert.equal(c.toConfirm, 2)
  })

  test('the next date is the SOONEST ahead, not the first row read', () => {
    const c = countsFrom([
      row({ next_due: '2027-03-01' }), row({ next_due: '2026-11-30' }), row({ next_due: '2026-12-15' }),
    ])
    assert.equal(c.nextDate, '2026-11-30')
  })

  test('"ahead" is the view\'s own answer: has_passed, and a date it could not compute', () => {
    // A one-off behind us: the view says has_passed, so it is not the next date.
    assert.equal(stillAhead(row({ next_due: '2020-01-01', has_passed: true })), false)
    // A repeating date with no day or no period has no honest next date (decisions 12 and 23).
    assert.equal(stillAhead(row({ next_due: null })), false)
    assert.equal(stillAhead(row({ next_due: '2026-11-30' })), true)
    assert.equal(countsFrom([row({ next_due: '2020-01-01', has_passed: true }), row({ next_due: null })]).nextDate, null)
    // And the counts still count both: a date that has passed is on the calendar (decision 11).
    assert.equal(countsFrom([row({ next_due: '2020-01-01', has_passed: true })]).dates, 1)
  })

  test('NO CLOCK IN THE BROWSER DECIDES WHAT IS AHEAD', () => {
    // `next_due` and `has_passed` are computed by `calendar_v` against the server's current_date.
    // A page that worked "ahead" out for itself would disagree with the view by a day for anybody
    // west of UTC — which is everybody this product sells to.
    const body = COUNTS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/new Date\(\)|Date\.now/.test(body), 'the counts must not read the browser clock')
  })

  test('nothing at all is nothing, not zeros', () => {
    assert.deepEqual(countsFrom([]), { dates: 0, toConfirm: 0, nextDate: null })
  })
})

describe('"next date 30 November" — the day and the month, in UTC', () => {
  test('a DATE column is read in UTC, so the day does not slip', () => {
    assert.equal(dayAndMonth('2026-11-30'), '30 November')
    assert.equal(dayAndMonth('2026-01-01'), '1 January')
    // What the view returns through PostgREST for a date, timestamp shape and all.
    assert.equal(dayAndMonth('2026-11-30T00:00:00Z'), '30 November')
  })
  test('no year, because the owner\'s line has none', () => {
    assert.ok(!/202\d/.test(dayAndMonth('2026-11-30')))
  })
  test('nothing to say is said as nothing', () => {
    assert.equal(dayAndMonth(null), '')
    assert.equal(dayAndMonth(''), '')
    assert.equal(dayAndMonth('not a date'), '')
  })
})

describe('the info bar, and the owner\'s rule for zero', () => {
  test('all four fragments, in his order and his words', () => {
    assert.deepEqual(
      infoBarParts({ dates: 10, toConfirm: 4, nextDate: '2026-11-30' }, 3),
      ['10 dates on your calendar', '4 waiting for your confirmation', '3 conversations', 'next date 30 November'],
    )
  })
  test('a fragment whose number is 0 is left out, and so is a next date that is not there', () => {
    assert.deepEqual(infoBarParts({ dates: 2, toConfirm: 0, nextDate: null }, 0), ['2 dates on your calendar'])
    assert.deepEqual(infoBarParts({ dates: 0, toConfirm: 0, nextDate: null }, 1), ['1 conversation'])
  })
  test('all of them zero is NO BAR, not a line saying 0 dates', () => {
    assert.deepEqual(infoBarParts({ dates: 0, toConfirm: 0, nextDate: null }, 0), [])
  })
  test('one is one', () => {
    assert.deepEqual(infoBarParts({ dates: 1, toConfirm: 1, nextDate: null }, 0),
      ['1 date on your calendar', '1 waiting for your confirmation'])
  })
  test('THE DATES ARE NOT CAPPED AND THE CONVERSATIONS ARE — so only one of them says "60+"', () => {
    // `readTopicList` reads at most LIST_CAP rows, so a full read means there may be more and "60+"
    // is the honest count. The dates are read with no limit, so "60+ dates" would be a number we
    // have, reported as one we do not.
    const bar = infoBarParts({ dates: 61, toConfirm: 61, nextDate: null }, 60)
    assert.deepEqual(bar, ['61 dates on your calendar', '61 waiting for your confirmation', '60+ conversations'])
  })
})

describe('the page is the HR frame, imported and not copied', () => {
  test('the shared pieces come from the files HR renders', () => {
    for (const spec of ['@/components/AppLayout', '@/components/Tabs', '@/components/Empty',
      '@/components/AttachControl', '@/components/buttonStyles', '@/config/examples',
      '@/lib/topicList', '@/lib/calendarCounts']) {
      assert.match(PAGE, new RegExp(`from '${spec.replace(/[/]/g, '\\/')}'`), `${spec} must be imported`)
    }
  })

  test('the column and the title are HR\'s own strings, character for character', () => {
    const column = /<div className="(print-page mx-auto[^"]*)">/
    const title = /<h1 className="(font-serif[^"]*)">/
    assert.equal(PAGE.match(column)?.[1], HR.match(column)?.[1], 'the page column must equal HR\'s')
    assert.equal(PAGE.match(title)?.[1], HR.match(title)?.[1], 'the page title must equal HR\'s')
  })

  test('the attach slot was MOVED, so HR draws the same piece', () => {
    const shared = readFileSync('components/AttachControl.tsx', 'utf8')
    assert.match(HR, /import \{ AttachControl \} from '@\/components\/AttachControl'/)
    assert.ok(!/^function AttachControl/m.test(HR), 'HR must no longer define its own')
    // HR's markup, as it stood in `app/hr/HrWorkspace.tsx:110–120`.
    assert.match(shared, /className="inline-flex cursor-pointer items-center gap-1\.5 text-left hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300"/)
    assert.match(shared, /M21\.4 11\.05 12\.25 20\.2a5\.5 5\.5 0 0 1-7\.78-7\.78l9\.19-9\.19a3\.67 3\.67 0 0 1 5\.18 5\.18l-9\.2 9\.2a1\.83 1\.83 0 0 1-2\.59-2\.6l8\.49-8\.48/)
    // HR's three call sites still pass a handler, so what HR draws is unchanged.
    assert.equal((HR.match(/<AttachControl label="Add a handbook" onClick=/g) ?? []).length, 3)
  })

  test('four tabs, in the owner\'s order, each count hidden at zero AND before the read answers', () => {
    assert.match(PAGE, /\{ key: 'ask', label: 'Ask a question' \}/)
    assert.match(PAGE, /\{ key: 'conversations', label: 'Conversations' \}/)
    assert.match(PAGE, /key: 'calendar', label: `Calendar\$\{loaded && counts\.dates > 0 \? ` \(\$\{counts\.dates\}\)` : ''\}`/)
    assert.match(PAGE, /key: 'dates', label: `Dates to confirm\$\{loaded && counts\.toConfirm > 0 \? ` \(\$\{counts\.toConfirm\}\)` : ''\}`/)
    assert.deepEqual(PAGE.match(/key: '(ask|conversations|calendar|dates)'/g),
      ["key: 'ask'", "key: 'conversations'", "key: 'calendar'", "key: 'dates'"])
  })

  test('the tab is in the address, so a link can open one', () => {
    assert.match(PAGE, /params\.get\('tab'\)/)
    assert.match(PAGE, /router\.replace\(`\/calendar\$\{p\.toString\(\) \? `\?\$\{p\}` : ''\}`, \{ scroll: false \}\)/)
    // Arrival is HR's tab, and the side link only changes the address.
    assert.match(PAGE, /: 'ask'/)
    assert.match(PAGE, /p\.set\('new', '1'\)/)
    assert.match(PAGE, /<a href=\{newHref\}/)
  })

  test('an empty state is never drawn over a read that has not answered', () => {
    // Each tab's body, taken from its own `{tab === '…' && (` to the end of the block.
    const bodyOf = (t: string) => {
      const at = CODE.indexOf(`{tab === '${t}' && (`)
      assert.ok(at > 0, `the ${t} tab must be drawn`)
      const next = CODE.indexOf('{tab === ', at + 1)
      return CODE.slice(at, next === -1 ? CODE.length : next)
    }
    for (const [t, words] of [['conversations', 'No conversations yet'], ['calendar', 'No dates yet'],
      ['dates', 'Nothing waiting']] as const) {
      const body = bodyOf(t)
      assert.ok(body.includes(words), `"${words}" must be in the ${t} tab`)
      assert.ok(body.includes('!loaded ? waiting'), `"${words}" must be guarded by !loaded`)
      // And the guard comes FIRST: an empty state after it would be drawn whatever `loaded` says.
      assert.ok(body.indexOf('!loaded ? waiting') < body.indexOf(words), `the guard must precede "${words}"`)
    }
    // The info bar is held to the same rule: no numbers before the read answers.
    assert.match(CODE, /\{loaded && bar\.length > 0 && \(/)
  })
})

describe('every word on the page is the owner\'s', () => {
  const WORDS = [
    'Every date your documents set, in one place. Ask when something is due, and we say ',
    'where the date came from.',
    'Add a document',
    'Asking a question arrives with step 10.',
    'No conversations yet',
    'Ask a question and the answer is kept here, with the dates and documents it drew on.',
    'No dates yet',
    'Add your permits, certificates and reports in Company Documents. The dates they set show up here, with the line they came from.',
    'Nothing waiting',
    'When a reading finds a date, it lands here for you to confirm or set right.',
    'The month and list views arrive with step 8.',
    'This view arrives with step 9.',
    'New conversation',
    'Add a date',
  ]
  for (const w of WORDS) {
    test(`“${w.slice(0, 48)}”`, () => assert.ok(PAGE.includes(w), 'missing from the page'))
  }
  test('the three examples are the owner\'s, and they live in config where he can edit them', () => {
    const examples = readFileSync('config/examples.ts', 'utf8')
    const mine = examples.slice(examples.indexOf('export const CALENDAR_EXAMPLE_QUESTIONS'))
    assert.ok(mine.length > 0, 'CALENDAR_EXAMPLE_QUESTIONS must exist')
    for (const q of [
      'When is our Tier II report due, and does it cover both sites?',
      'What expires in the next 90 days?',
      'Is the fire inspection for the Vancouver warehouse on the calendar?',
    ]) assert.ok(mine.includes(q), `missing example: ${q}`)
    // The page renders them and holds no copy of its own — `config/examples.ts` is the owner's file.
    assert.match(PAGE, /CALENDAR_EXAMPLE_QUESTIONS\.map/)
    for (const q of ['Tier II report', 'next 90 days', 'Vancouver warehouse']) {
      assert.ok(!PAGE.includes(q), `the page must not hold a second copy of: ${q}`)
    }
  })
  test('A LINK TO ONE DATE IS ANSWERED, NOT SWALLOWED — decision 30', () => {
    assert.match(PAGE, /params\.get\('date'\) \|\| params\.get\('finding'\)/)
    assert.match(PAGE, /Opening a single date arrives with step 8/)
  })
  test('the forbidden words are absent', () => {
    // The product never says these (`docs/CALENDAR-PLAN.md` §2.1): never "AI", never "compliant",
    // never "done" or "overdue" of a date, and no cost on a customer screen.
    for (const bad of [/\boverdue\b/i, /\bcompliant\b/i, /\bAI\b/]) {
      assert.ok(!bad.test(CODE), `the page must not say ${bad}`)
    }
  })
})

describe('NOTHING OF THE OLD PAGE CAME ACROSS, and the new one writes nothing', () => {
  test('the add form, the import form, the month grid, the tick and the × are gone', () => {
    for (const gone of ['extract-dates', 'completed', 'getDaysInMonth', 'recurrence_period',
      'CATEGORIES', "params.get('add')", 'calendar.google.com', 'outlook.live.com']) {
      assert.ok(!CODE.includes(gone), `${gone} must not survive into the new page`)
    }
  })
  test('it calls no route and makes no write', () => {
    assert.ok(!/\bfetch\(/.test(CODE), 'the shell calls no route')
    // *** NOT A SEARCH FOR `.delete(`, AND THAT IS A FINDING OF ITS OWN. *** Written that way
    // first, this test failed on `p.delete(k)` — `URLSearchParams`, which is how the tab leaves the
    // address when it is the default one. A substring is not a call site (`CLAUDE.md` §9a), so the
    // check is made against what a write would actually need: a query builder, or a method on a
    // request. The page has neither; both reads go through the two shared functions.
    assert.ok(!/supabase\s*\n?\s*\.from\(|\bsupabase\.from\(/.test(CODE), 'the page builds no query of its own')
    for (const w of ["method: 'POST'", "method: 'PATCH'", "method: 'DELETE'", "method: 'PUT'", 'authHeaders']) {
      assert.ok(!CODE.includes(w), `${w} must not be on a page that only reads`)
    }
  })
  test('it reads calendar_v through the shared filter, not with a query of its own', () => {
    assert.ok(!CODE.includes('calendar_v'), 'the page must not name the view: lib/calendarCounts.ts does')
    assert.match(PAGE, /readCalendarCounts\(supabase\)/)
    assert.match(PAGE, /readTopicList\(supabase, 'calendar'\)/)
  })
})

describe('the sidebar badge is the same component and the same position', () => {
  test('Calendar carries a badge, where Company information carries its own', () => {
    assert.match(LAYOUT, /\{ label: 'Calendar', href: '\/calendar', badge: 'calendarDates' as const \},/)
    const items = LAYOUT.slice(LAYOUT.indexOf('const NAV_ITEMS'), LAYOUT.indexOf('export default'))
    assert.ok(items.indexOf("label: 'Company information'") < items.indexOf("label: 'Calendar'"),
      'the nav order is unchanged')
  })
  test('both badges draw the SAME span, so neither can be restyled alone', () => {
    const spans = LAYOUT.match(/<span className="rounded-md bg-gray-100 px-1\.5 py-0\.5 text-xs text-gray-600">\{(toConfirm|calendarDates)\}<\/span>/g)
    assert.equal(spans?.length, 2)
  })
  test('nothing is shown at zero, for either number', () => {
    assert.match(LAYOUT, /item\.badge === 'toConfirm' && !!toConfirm &&/)
    assert.match(LAYOUT, /item\.badge === 'calendarDates' && !!calendarDates &&/)
  })
  test('one read, on a pathname change — still not polling', () => {
    assert.ok(!/setInterval/.test(LAYOUT), 'the badge must not poll')
    assert.match(LAYOUT, /useEffect\(\(\) => \{ loadCount\(\) \}, \[pathname, loadCount\]\)/)
  })
})
