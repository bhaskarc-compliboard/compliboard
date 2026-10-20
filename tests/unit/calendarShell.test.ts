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
import { readFileSync, existsSync } from 'node:fs'
import { labelFor, hostOf, OTHER_SOURCE_LINE } from '../../lib/howTo.ts'
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
/**
 * THE QUEUE'S OWN TWO FILES — Calendar step 9. The Dates-to-confirm tab's words left the page when
 * the queue was built, which is where a words test goes wrong: it keeps asserting against the page
 * and quietly stops covering the sentence it was written for. So the owner's words are looked for
 * across the files that draw them, and the test says which file each came from.
 */
const QUEUE = readFileSync('lib/calendarQueue.ts', 'utf8')
const QUEUE_UI = readFileSync('components/DateQueue.tsx', 'utf8')
/** Step 10b moved the ask box, its examples and its attach line here, with the answer. */
const ASK_UI = readFileSync('components/CalendarAsk.tsx', 'utf8')
const SURFACES = `${PAGE}\n${QUEUE}\n${QUEUE_UI}\n${ASK_UI}`

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
    // The frame is the page's; the ask box, its examples and its attach line are the ask view's
    // since step 10b. Both files are searched, because WHICH of the two holds a shared piece is
    // this section's business and THAT it is imported is the rule.
    for (const spec of ['@/components/AppLayout', '@/components/Tabs', '@/components/Empty',
      '@/components/AttachControl', '@/components/buttonStyles', '@/config/examples',
      '@/lib/topicList', '@/lib/calendarCounts',
      // Step 10b: the answer, the list and the summary are HR's own pieces, imported.
      '@/components/AnswerBody', '@/components/ConversationList', '@/components/ReportView',
      '@/components/Drawer', '@/lib/answerStream']) {
      assert.match(`${PAGE}\n${ASK_UI}`, new RegExp(`from '${spec.replace(/[/]/g, '\\/')}'`), `${spec} must be imported`)
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
    for (const [t, words] of [['conversations', 'No conversations yet'], ['calendar', 'No dates yet']] as const) {
      const body = bodyOf(t)
      assert.ok(body.includes(words), `"${words}" must be in the ${t} tab`)
      assert.ok(body.includes('!loaded ? waiting'), `"${words}" must be guarded by !loaded`)
      // And the guard comes FIRST: an empty state after it would be drawn whatever `loaded` says.
      assert.ok(body.indexOf('!loaded ? waiting') < body.indexOf(words), `the guard must precede "${words}"`)
    }
    /**
     * *** THE DATES TAB DRAWS ITS EMPTY STATE FROM INSIDE THE QUEUE SINCE STEP 9, so the rule is
     * held in two halves. *** The page must not mount the queue before the read answers, and must
     * not mount it when the read FAILED — the second half is a defect this step fixed: the tab
     * tested `counts.toConfirm === 0`, which a failed read leaves 0, so a company with nine dates
     * waiting was told "Nothing waiting" (§5.1's worked example, exactly as it bit the Calendar tab
     * at step 8a). The queue's own half is that `Nothing waiting` is behind `waiting.length === 0`,
     * which is a count of rows that have been read, never of rows nobody has asked for yet.
     */
    const dates = bodyOf('dates')
    assert.ok(dates.includes('!loaded ? waiting'), 'the dates tab must wait for the read')
    assert.ok(dates.indexOf('!loaded ? waiting') < dates.indexOf('<DateQueue'),
      'the guard must precede the queue')
    assert.ok(dates.indexOf('loadFailed') < dates.indexOf('<DateQueue'),
      'a failed read must be answered before the queue is drawn')
    assert.match(dates, /COULD_NOT_LOAD/, 'and it says so in the words the Calendar tab uses')
    assert.ok(!dates.includes('counts.toConfirm'),
      'the queue must not be drawn off a count: a failed read leaves it 0 and that reads as "none"')
    const ui = code(QUEUE_UI)
    // *** AND SINCE STEP 14b IT TAKES BOTH SECTIONS. *** "Nothing waiting" over a tab holding
    // seven dates that need a day would be the same §5.1 defect in a new place, so the empty
    // state is behind "the queue is empty AND nothing needs a day", and both are counts of rows
    // that have been read.
    assert.match(ui, /if \(waiting\.length === 0 && needsWhen\.length === 0\) \{/)
    // FROM THE GUARD ONWARDS, never from the top of the file: written as an `indexOf` comparison
    // over the whole source, this passed nothing and failed on the IMPORT of `QUEUE_EMPTY_TITLE`,
    // which is above everything. The same trap as the page's own header comment (see `code()`).
    const guarded = ui.slice(ui.indexOf('if (waiting.length === 0 && needsWhen.length === 0)'))
    assert.match(guarded.slice(0, 200), /QUEUE_EMPTY_TITLE/,
      'the empty state is behind the count of rows actually read')
    // The info bar is held to the same rule: no numbers before the read answers.
    assert.match(CODE, /\{loaded && bar\.length > 0 && \(/)
  })
})

describe('every word on the page is the owner\'s', () => {
  const WORDS = [
    'Every date your documents set, in one place. Ask when something is due, and we say ',
    'where the date came from.',
    'Add a document',
    'No conversations yet',
    'Ask a question and the answer is kept here, with the dates and documents it drew on.',
    'No dates yet',
    'Add your permits, certificates and reports in Company Documents. The dates they set show up here, with the line they came from.',
    'Nothing waiting',
    'When a reading finds a date, it lands here for you to confirm or set right.',
    'New conversation',
    'Add a date',
  ]
  for (const w of WORDS) {
    test(`“${w.slice(0, 48)}”`, () => assert.ok(SURFACES.includes(w),
      'missing from the page, the queue and the queue\'s words'))
  }

  /**
   * *** AND THE PLACEHOLDER IS GONE, WHICH IS A CHECK AND NOT A FORMALITY — step 9. ***
   * "This view arrives with step 9." was in the WORDS list above, which means this file would have
   * gone on asserting the presence of a sentence about unbuilt work after the work was built. A
   * staging placeholder that outlives its step is how a product tells a customer it cannot do
   * something it can; `docs/HANDOFF-CODE.md` §7 lists them so they are removed on purpose.
   */
  test('the step 9 placeholder is gone, and so is the name it was called by', () => {
    assert.ok(!PAGE.includes('This view arrives with step 9.'), 'the sentence must be gone')
    assert.ok(!PAGE.includes('DATES_ARRIVES'), 'and the constant with it')
    assert.ok(!readFileSync('docs/HANDOFF-CODE.md', 'utf8').includes('This view arrives with step 9'),
      '§7 must no longer carry it either')
  })

  /** And step 10b's, the last of the three: the Ask tab answers now. */
  test('the step 10 placeholders are gone — the sentence, the constant and the disabled button', () => {
    assert.ok(!PAGE.includes('Asking a question arrives with step 10.'))
    assert.ok(!PAGE.includes('ASK_ARRIVES'))
    assert.ok(!PAGE.includes('This view arrives with step 10'))
    assert.ok(!PAGE.includes('CONVERSATIONS_ARRIVE'))
    // The Ask button was `disabled` with nothing behind it; now it is disabled only while a
    // question is in flight or the box is empty.
    assert.ok(!/<button className=\{PRIMARY\} disabled>Ask<\/button>/.test(PAGE))
    assert.match(ASK_UI, /disabled=\{busy \|\| !box\.trim\(\)\}/)
    const handoff = readFileSync('docs/HANDOFF-CODE.md', 'utf8')
    assert.ok(!handoff.includes('Asking a question arrives with step 10'), '§7 must no longer carry it')
  })
  test('the three examples are the owner\'s, and they live in config where he can edit them', () => {
    const examples = readFileSync('config/examples.ts', 'utf8')
    const mine = examples.slice(examples.indexOf('export const CALENDAR_EXAMPLE_QUESTIONS'))
    assert.ok(mine.length > 0, 'CALENDAR_EXAMPLE_QUESTIONS must exist')
    for (const q of [
      'When is our Tier II report due, and does it cover both sites?',
      'What expires in the next 90 days?',
      'Is the fire inspection for the Vancouver warehouse on the calendar?',
    ]) assert.ok(mine.includes(q), `missing example: ${q}`)
    // The ask view renders them and holds no copy of its own — `config/examples.ts` is the
    // owner's file. (It was the page's until step 10b moved the box.)
    assert.match(ASK_UI, /CALENDAR_EXAMPLE_QUESTIONS\.map/)
    for (const q of ['Tier II report', 'next 90 days', 'Vancouver warehouse']) {
      assert.ok(!`${PAGE}\n${ASK_UI}`.includes(q), `no second copy of: ${q}`)
    }
  })
  /**
   * *** CHANGED BY STEP 8a, AND THE OLD VERSION IS WHY THIS TEST EXISTS. *** In step 7 both
   * parameters were read only so the page could say, in one line, that opening a single date was
   * not built yet. Step 8a built it: they now open the drawer, and the line is kept for the case
   * the link cannot be honoured — removed, withdrawn, or another company's. The rule the test
   * holds is unchanged: a link that lands here is never met with silence.
   */
  test('A LINK TO ONE DATE IS ANSWERED, NOT SWALLOWED — decision 30', () => {
    assert.match(PAGE, /params\.get\('date'\)/)
    assert.match(PAGE, /params\.get\('finding'\)/)
    assert.match(PAGE, /resolveLink\(rows, linkedDate, linkedFinding\)/)
    assert.ok(PAGE.includes('NOT_ON_CALENDAR'), 'and when it resolves to nothing, it says so')
    assert.ok(!PAGE.includes('arrives with step 8;'), "step 7's placeholder is gone")
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
  /**
   * *** WIDENED BY STEP 8a. *** In step 7 the page made no query at all. It now reads four more
   * relations for the drawer — `entities` (counted, for decision 24), `profiles` (the names behind
   * "confirmed by…"), `document_index_v` and `audit_findings`. What has not changed, and is the
   * thing worth holding, is that the page READS and never writes: every change to a date goes
   * through `PATCH /api/calendar` from the drawer, over `lib/calendarDates.ts`, the one writer.
   */
  /**
   * *** WIDENED AGAIN BY STEP 8b. *** The page now mounts `DocumentReport`, which hands filing back
   * up as `onMove` — so the page makes exactly ONE kind of write, and it is Documents' own route
   * moving a document between folders, the same call `app/audits/page.tsx:823` makes for the same
   * reason. What has not changed, and is what this test is for: **the page never writes a calendar
   * row.** Every change to a date goes through `PATCH /api/calendar` from the drawer or
   * `POST /api/calendar` from the Add sheet, both over `lib/calendarDates.ts`, the one writer.
   */
  test('the page never writes a CALENDAR row; its only write is Documents\' own filing', () => {
    // *** NOT A SEARCH FOR `.delete(`, AND THAT IS A FINDING OF ITS OWN. *** Written that way
    // first, this test failed on `p.delete(k)` — `URLSearchParams`, which is how the tab leaves the
    // address when it is the default one. A substring is not a call site (`CLAUDE.md` §9a).
    for (const w of ['.insert(', '.upsert(', '.update(']) {
      assert.ok(!CODE.includes(w), `${w} must not be on a page that only reads`)
    }
    const urls = [...CODE.matchAll(/fetch\('([^']+)'/g)].map((m) => m[1])
    assert.deepEqual([...new Set(urls)], ['/api/documents'],
      'the only route the page itself calls is the document move')
    assert.ok(!CODE.includes("'/api/calendar'"), 'a calendar write is the drawer\'s or the sheet\'s')
  })
  test('every relation the page reads is named here, so a fifth is a deliberate act', () => {
    const named = [...CODE.matchAll(/supabase\s*\.from\('([a-z_]+)'\)/g)].map((m) => m[1]).sort()
    // `topics` joined the list at step 10b, and this test is why it is a sentence rather than a
    // slip: the conversation drawer reads `summary_report` for the ONE conversation that is
    // open. `topic_list_v` carries whether a report exists and not the report itself, and a list
    // of twenty conversations must not carry twenty reports to show one — HR reads it the same
    // way (`app/hr/HrWorkspace.tsx:447`).
    assert.deepEqual([...new Set(named)].sort(),
      ['audit_findings', 'companies', 'company_folders', 'document_index_v', 'entities', 'profiles', 'topics'])
  })
  test('it reads calendar_v through the shared filter, not with a query of its own', () => {
    assert.ok(!CODE.includes('calendar_v'), 'the page must not name the view: lib/calendarCounts.ts does')
    assert.ok(!CODE.includes('calendar_events'), 'nor the table')
    assert.match(PAGE, /readCalendarCounts\(supabase\)/)
    assert.match(PAGE, /readCalendarRows\(supabase\)/)
    assert.match(PAGE, /readTopicList\(supabase, 'calendar'\)/)
  })
})

describe('the sidebar badge is the same component as Company information\'s', () => {
  /**
   * *** THE POSITION MOVED AT DASHBOARD STEP 5b, THE BADGE DID NOT. *** This test asserted that
   * Company information came BEFORE Calendar in `NAV_ITEMS`, and said "the nav order is
   * unchanged". Board 4 reorders the whole list and puts Company information under a hairline with
   * My Account, so that clause is spent and the check is now the one that still matters: the two
   * badges are the same thing, drawn the same way, and Calendar still has one.
   */
  test('Calendar carries a badge, where Company information carries its own', () => {
    assert.match(LAYOUT, /\{ label: 'Calendar', href: '\/calendar', badge: 'calendarDates' as const \},/)
    assert.match(LAYOUT, /label: 'Company information'[^\n]*badge: 'toConfirm' as const/)
  })
  test('both badges draw the SAME span, so neither can be restyled alone', () => {
    // The grey pill went with the green box at step 5b (board 4): a filled shape beside a word
    // reads as a control, and this is a number. One span, two uses, still.
    const spans = LAYOUT.match(/<span className="shrink-0 text-xs tabular-nums text-gray-400">\{(toConfirm|calendarDates)\}<\/span>/g)
    assert.equal(spans?.length, 2)
    assert.ok(!/bg-gray-100 px-1\.5 py-0\.5/.test(LAYOUT), 'the pill is back')
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
// =================================================================================================
// STEP 12 — WHAT WAS RETIRED, WHAT THE DASHBOARD READS, AND THE MOVES A PERSON MAY MAKE
// =================================================================================================

describe('the old date importer is gone', () => {
  test('neither the route nor its prompt is on disk, and nothing imports them', () => {
    assert.equal(existsSync('app/api/extract-dates/route.ts'), false)
    assert.equal(existsSync('prompts/extract-dates.ts'), false)
    // Prose about it is allowed — `CLAUDE.md` §5.1's worked example is history and stays. A
    // CALL is not: the check is for an import or a fetch, in code, with comments stripped.
    for (const f of ['app/calendar/page.tsx', 'app/dashboard/page.tsx', 'lib/documentContent.ts', 'lib/ai.ts']) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      assert.ok(!/extract-dates/.test(code), `${f} still calls it`)
    }
  })

  test('POST no longer accepts the old page\'s recurrence words', () => {
    const route = readFileSync('app/api/calendar/route.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const gone of ['OLD_PERIOD_WORDS', 'is_recurring', 'recurrence_period']) {
      assert.ok(!route.includes(gone), `${gone} must be gone from the route`)
    }
    assert.match(route, /const recurs = body\?\.recurs === true/)
  })

  /**
   * GET returned the BASE table — every row except withdrawn, so dismissed and superseded ones
   * too — and its last caller was the Dashboard. A second shape of the same question, answered
   * differently from every other reader, is the thing this step exists to remove.
   */
  test('GET is gone, and nothing asks for one', () => {
    const route = readFileSync('app/api/calendar/route.ts', 'utf8')
    assert.ok(!/export async function GET/.test(route))
    assert.match(route, /export async function POST/)
    assert.match(route, /export async function PATCH/)
  })
})

describe('the Dashboard reads what the Calendar reads', () => {
  const DASH = readFileSync('app/dashboard/page.tsx', 'utf8')
  const code = DASH.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('through the one shared filter, not a query of its own and not the route', () => {
    assert.match(code, /liveDates\(supabase, `\$\{CALENDAR_COUNT_COLUMNS\}, title, days_until`\)/)
    // `days_until` is in that list because the filter below reads it, and it was missing once:
    // `undefined >= 0` is false, so every row was dropped and the page said there were none.
    const filter = code.slice(code.indexOf('const upcoming'))
    assert.match(filter, /e\.days_until/)
    assert.ok(!code.includes("fetch('/api/calendar'"), 'the route is gone')
    assert.ok(!/\.from\('calendar_events'\)/.test(code), 'never the base table')
  })

  /**
   * Measured on staging before this change: Test Gamma showed 7 rows where 5 are live — two were
   * dates a person had REMOVED — and Cascade showed 4 where 1 is due, the three extras being
   * repeating dates whose period was never read, whose day the Calendar refuses to compute and
   * the Dashboard announced as "in 15 days".
   */
  test('a date with no computable day is not a deadline, and a passed one is not upcoming', () => {
    assert.match(code, /e\.next_due && !e\.has_passed/)
    assert.match(code, /e\.days_until !== null && e\.days_until >= 0 && e\.days_until <= 30/)
    assert.ok(!/new Date\(e\.due_date\)/.test(code), 'no browser clock decides what is due')
    assert.ok(!code.includes('function daysUntil'), 'the view counts the days')
  })

  test('an unconfirmed date is marked, in the page\'s own words, and every row opens the date', () => {
    assert.match(code, /e\.status === 'proposed'/)
    assert.match(code, /\{NOT_CONFIRMED\}/)
    assert.match(code, /href=\{`\/calendar\?tab=calendar&date=\$\{e\.id\}`\}/)
  })

  test('a read that failed is not an empty calendar (§5.1)', () => {
    assert.match(code, /setEvents\(null\)/)
    assert.match(DASH, /We could not load your dates just now/)
    // And the empty state is only reached when the read answered.
    assert.ok(code.indexOf('events === null') < code.indexOf('upcoming.length === 0'))
  })
})

describe('a person may only make the moves the product offers (migration 078)', () => {
  const sql = readFileSync('supabase/migrations/078_a_person_may_only_make_the_moves_the_product_offers.sql', 'utf8')
  const lib = readFileSync('lib/calendarDates.ts', 'utf8')

  test('the rule is a function, so the migration can prove it without a login', () => {
    assert.match(sql, /create or replace function public\.calendar_person_move_refusal/)
    assert.match(sql, /language sql\s+immutable/)
    assert.match(sql, /create trigger calendar_events_person_update\s+before update on public\.calendar_events/)
    assert.match(sql, /if current_user <> 'authenticated' then return new; end if;/)
  })

  /**
   * *** THE TWO HALVES MUST AGREE, AND THIS IS THE TEST THAT THEY DO. *** Every status the
   * library writes must be one the database will accept from a person, or a route that works
   * today starts failing in production with a check violation.
   */
  test('every status the library writes to is one the rule allows', () => {
    const written = [...lib.matchAll(/status: '([a-z]+)'/g)].map((m) => m[1])
    assert.ok(written.length > 0, 'the library must write a status somewhere')
    for (const s of new Set(written)) {
      if (s === 'withdrawn' || s === 'proposed') continue   // the service role's, and the insert's
      assert.ok(['confirmed', 'dismissed'].includes(s), `the library writes status '${s}', which a person may not set`)
    }
  })

  test('and the two writes that clear the stamp also set a status the rule allows with it', () => {
    // `confirmDate` and `dismissDate` both clear `withdrawn_at` — the rule permits that only
    // alongside 'confirmed' or 'dismissed', which is exactly what they set.
    for (const fn of ['confirmDate', 'dismissDate']) {
      const at = lib.indexOf(`export async function ${fn}`)
      const body = lib.slice(at, lib.indexOf('\nexport ', at + 10))
      if (!body.includes('withdrawn_at: null')) continue
      assert.match(body, /status: '(confirmed|dismissed)'/, `${fn} clears the stamp without setting a status`)
    }
  })

  test('the grant names what a person may write, and the evidence columns are not in it', () => {
    assert.match(sql, /revoke update on table public\.calendar_events from authenticated/)
    const granted = /grant update \(([\s\S]*?)\) on table public\.calendar_events to authenticated/.exec(sql)![1]
    for (const col of ['status', 'confirmed_by', 'dismissed_reason', 'period', 'withdrawn_at', 'replaced_by']) {
      assert.ok(granted.includes(col), `a route writes ${col}`)
    }
    for (const col of ['title', 'source_line', 'source_url', 'document_id', 'company_id', 'added_by']) {
      assert.ok(!granted.includes(col), `${col} must not be writable by a person`)
    }
  })
})

/**
 * *** A REPEATING DATE WITH A DAY IS A DATE (migration 079, decision 32, Calendar step 14b). ***
 *
 * Two rules live in the database and nowhere else, so these read them out of the file: the view's
 * arithmetic, which is what decides whether a row is on the grid at all, and the day rule, which
 * is what stops a person rewriting a day a document set. The test above
 * ("the newest migration defining calendar_v filters withdrawn rows out", in
 * `tests/unit/calendarDates.test.ts`) already holds that re-emitting the view did not drop step
 * 6b's filter — 079 is a re-emission, which is exactly the regression that test exists for.
 */
describe('a repeating date with a day is a date (migration 079)', () => {
  const sql = readFileSync('supabase/migrations/079_a_repeating_date_with_a_day_is_a_date.sql', 'utf8')
  const bare = sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

  test('the view gives it `next_due` = its day, and a dayless row still gets none', () => {
    const at = bare.search(/create\s+or\s+replace\s+view\s+public\.calendar_v\b/i)
    const statement = bare.slice(at, bare.indexOf(';', at) + 1)
    assert.match(statement, /when e\.due_date is null then null/)
    assert.match(statement, /when st\.step_months is null then e\.due_date/)
    // The branch order is the rule: no day beats no period, or a dayless row would get `null`
    // from the wrong arm and the two cases would be one.
    assert.ok(statement.indexOf('when e.due_date is null then null')
      < statement.indexOf('when st.step_months is null then e.due_date'))
    // And the old expression, which threw a known day away with an unknown period, is gone.
    assert.ok(!statement.includes('when e.due_date is null or st.step_months is null then null'))
  })

  test('HAS PASSED IS SAID ONCE, off the day the product shows', () => {
    const at = bare.search(/create\s+or\s+replace\s+view\s+public\.calendar_v\b/i)
    const statement = bare.slice(at, bare.indexOf(';', at) + 1)
    assert.match(statement, /\(nd\.next_due is not null and nd\.next_due < current_date\) as has_passed/)
    assert.ok(!statement.includes('(not e.recurs and e.due_date is not null and e.due_date < current_date) as has_passed'),
      'the old expression would answer "no" for a repeating date whose one day is behind us')
  })

  test('the day rule is a function, proved without a login, and the trigger asks both rules', () => {
    assert.match(sql, /create or replace function public\.calendar_person_day_refusal/)
    assert.match(sql, /language sql\s+immutable/)
    // The gate is 078's and is unchanged.
    assert.match(sql, /if current_user <> 'authenticated' then return new; end if;/)
    const guard = sql.slice(sql.indexOf('create or replace function public.calendar_events_guard_person_update'))
    assert.ok(guard.indexOf('calendar_person_move_refusal') < guard.indexOf('calendar_person_day_refusal'),
      'the status rule is asked first: it is the bigger claim')
  })

  test('`due_date` is the twelfth column a person may write, and the thirteen are still shut', () => {
    assert.match(sql, /grant update \(due_date\) on table public\.calendar_events to authenticated/)
    // 078's list is not restated here — one list, read back from the catalog by 079's own §5 —
    // so what this holds is that nothing else was quietly opened with it.
    const grants = [...sql.matchAll(/grant update \(([^)]*)\) on table public\.calendar_events/g)]
    assert.equal(grants.length, 1, '079 grants exactly one column')
    for (const col of ['title', 'source_line', 'recurs', 'company_id', 'added_by']) {
      assert.ok(!grants[0][1].includes(col), `${col} must not be writable by a person`)
    }
  })
})

describe('a date from a rule says where it came from, with the shared sentence', () => {
  const drawer = readFileSync('components/CalendarDateDrawer.tsx', 'utf8')
  test('the helper is imported, and no second list of hosts is written', () => {
    assert.match(drawer, /import \{ labelFor, hostOf, OTHER_SOURCE_LINE \} from '@\/lib\/howTo'/)
    assert.match(drawer, /labelFor\(row\.source_url\) === 'other'/)
    assert.match(drawer, /OTHER_SOURCE_LINE\(hostOf\(row\.source_url\)\)/)
    assert.ok(!/\.gov|OFFICIAL_HOSTS|official\b.*\[/.test(drawer.replace(/\/\*[\s\S]*?\*\//g, '')),
      'the drawer must not decide for itself what is official')
  })
  test('an official source gets no such line', () => {
    assert.equal(labelFor('https://www.oregon.gov/deq/thing'), 'official')
    assert.equal(labelFor('https://encamp.com/tier-ii'), 'other')
    assert.match(OTHER_SOURCE_LINE(hostOf('https://encamp.com/x')), /^This comes from encamp\.com, not the agency itself/)
  })
})

describe('the account export and delete carry the whole calendar', () => {
  const exportRoute = readFileSync('app/api/account/export/route.ts', 'utf8')
  const deleteRoute = readFileSync('app/api/account/route.ts', 'utf8')
  test('every column comes with the row, so a new one needs no change here', () => {
    assert.match(exportRoute, /\.from\(table\)\.select\('\*'\)/)
    for (const t of ['calendar_events', 'calendar_mailings']) {
      assert.ok(exportRoute.includes(`byCompany('${t}')`), `${t} must be exported`)
    }
  })
  test('the credential is deliberately NOT exported, and the reason is in the file', () => {
    assert.ok(!exportRoute.includes("byCompany('calendar_feed_tokens')"))
    assert.match(exportRoute, /calendar_feed_tokens` IS DELIBERATELY NOT HERE/)
  })
  test('and all three tables are deleted with the company', () => {
    for (const t of ['calendar_events', 'calendar_mailings', 'calendar_feed_tokens']) {
      assert.ok(deleteRoute.includes(`'${t}',`), `${t} must be in the delete list`)
    }
  })
})
