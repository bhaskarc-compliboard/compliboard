/**
 * THE DASHBOARD'S SHELL, WELCOME AND FOUR NUMBERS — Dashboard step 5
 * (`docs/DASHBOARD-PLAN.md` decisions 1, 2, 4, 5, 11; `docs/dashboard-boards.html` boards 1 and 3).
 *
 * Two kinds of check, kept apart the way `tests/unit/calendarShell.test.ts` keeps them:
 *
 *   1. `lib/dashboardView.ts` — the two display rules, as functions, with no database and no
 *      clock: which greeting and lede a person gets, and what a counter of nothing looks like.
 *   2. The page, the login page and the signup page read as SOURCE. The markup is held by
 *      measurement (`npm run measure`), not by assertions about class strings — but the things
 *      this step REMOVED, and the one place the four numbers may come from, are facts a test can
 *      hold and a careless edit would silently undo.
 *
 * The lede sentences are checked against `docs/dashboard-boards.html` itself rather than against a
 * copy typed here, because the board is the approved artifact and a test that quotes its own
 * expectation cannot catch the two drifting apart.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  welcomeFor, countWord, isNoCount, NO_COUNT, COUNTER_TILES, COUNTER_COLUMNS,
  LEDE_FIRST_VISIT, LEDE_RETURNING,
  splitUpcoming, moreLine, inNext30Days, RECENT_AUDITS_MAX,
  UPCOMING_EMPTY, UPCOMING_EMPTY_LINK, AUDITS_EMPTY, AUDITS_EMPTY_LINK,
  answerKind, askableHere, skippedForType, nextQuestion, cardNumber, questionState,
  localMidnightIso, skipKey, readSkips, writeSkip,
  QUESTIONS_HEADING, QUESTIONS_NOTE, QUESTIONS_DONE, QUESTIONS_DONE_SUB,
  ANSWER_FAILED, SKIP_WORD, optionButtons, type CardQuestion,
} from '../../lib/dashboardView.ts'
import { runName, ALL_AGENCIES } from '../../lib/auditView.ts'

const PAGE = readFileSync('app/dashboard/page.tsx', 'utf8')
/**
 * THE CODE WITHOUT ITS COMMENTS. Every check below that reports an ABSENCE needs this: the page's
 * own header names `document_index_v`, `research_answer` and "Recently read" in order to say that
 * it no longer reads them, and a check that reads a comment as code looks exactly like a check
 * that found something (`CLAUDE.md` §9a).
 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CODE = code(PAGE)
const BOARDS = readFileSync('docs/dashboard-boards.html', 'utf8')
const CALENDAR = readFileSync('app/calendar/page.tsx', 'utf8')
const LOGIN = code(readFileSync('app/login/page.tsx', 'utf8'))
const SIGNUP = code(readFileSync('app/signup/page.tsx', 'utf8'))
const DOCSTATUS = readFileSync('lib/documentStatus.ts', 'utf8')

describe('the welcome — decision 5, all four cases', () => {
  test('a name and no first visit on record: "Welcome, Maria" and the day-one lede', () => {
    const w = welcomeFor('Maria Alvarez', null)
    assert.equal(w.title, 'Welcome, Maria')
    assert.equal(w.lede, LEDE_FIRST_VISIT)
    assert.equal(w.firstVisit, true)
  })

  test('a name and a first visit already recorded: "Welcome back, Maria"', () => {
    const w = welcomeFor('Maria Alvarez', '2026-10-19T08:12:00.000Z')
    assert.equal(w.title, 'Welcome back, Maria')
    assert.equal(w.lede, LEDE_RETURNING)
    assert.equal(w.firstVisit, false)
  })

  test('no name, first visit: plain "Welcome" — not "Welcome, " with nothing after the comma', () => {
    const w = welcomeFor(null, null)
    assert.equal(w.title, 'Welcome')
    assert.equal(w.lede, LEDE_FIRST_VISIT)
    assert.equal(w.firstVisit, true)
  })

  test('no name, been here before: plain "Welcome back"', () => {
    const w = welcomeFor(null, '2026-10-19T08:12:00.000Z')
    assert.equal(w.title, 'Welcome back')
    assert.equal(w.lede, LEDE_RETURNING)
    assert.equal(w.firstVisit, false)
  })

  test('the first name is the first word, and only the first word', () => {
    assert.equal(welcomeFor('Maria de la Cruz Alvarez', 'x').title, 'Welcome back, Maria')
    assert.equal(welcomeFor('Maria', 'x').title, 'Welcome back, Maria')
  })

  /**
   * The three shapes a `full_name` column actually comes back as when nobody filled it in. An
   * empty string and a space are not "no name" to `split`, which is how a title with a trailing
   * comma gets shipped.
   */
  test('an empty, blank or undefined name is no name', () => {
    for (const n of ['', '   ', undefined, null]) {
      assert.equal(welcomeFor(n, 'x').title, 'Welcome back', `for ${JSON.stringify(n)}`)
    }
  })

  test('an empty-string welcomed_at counts as never welcomed, not as welcomed', () => {
    // Nothing writes '' into a timestamptz, but `!value` is the test and this records which way
    // a falsy value falls: towards the kinder sentence, and towards writing the row.
    assert.equal(welcomeFor('Maria', '').firstVisit, true)
  })

  test('both ledes are the boards\' own sentences, character for character', () => {
    assert.ok(BOARDS.includes(LEDE_FIRST_VISIT), 'board 3 no longer carries the first-visit lede')
    assert.ok(BOARDS.includes(LEDE_RETURNING), 'board 1 no longer carries the returning lede')
  })

  test('the page draws the function\'s words and does not compose its own greeting', () => {
    assert.ok(CODE.includes('welcomeFor('), 'the page must call welcomeFor')
    assert.ok(CODE.includes('{welcome.title}') && CODE.includes('{welcome.lede}'))
    assert.ok(!CODE.includes("'Welcome"), 'a greeting string literal has come back into the page')
    assert.ok(!CODE.includes('"Welcome'), 'a greeting string literal has come back into the page')
  })
})

describe('a count of nothing is a dash — decision 4', () => {
  test('zero, no row and no column all draw an em dash', () => {
    assert.equal(countWord(0), NO_COUNT)
    assert.equal(countWord(null), NO_COUNT)
    assert.equal(countWord(undefined), NO_COUNT)
    assert.equal(NO_COUNT, '—', 'an em dash, not a hyphen')
  })

  test('a real count is the number', () => {
    assert.equal(countWord(1), '1')
    assert.equal(countWord(31), '31')
    assert.equal(countWord(10), '10')
  })

  test('nothing that is not a counted event gets drawn as one', () => {
    // A counter has a `check (>= 0)` on it (migration 032), so a negative is impossible in the
    // database — but a dash is the honest answer to a value this page cannot believe, and a
    // bare `-3` on the Dashboard would be worse than "nothing yet".
    assert.equal(countWord(-3), NO_COUNT)
    assert.equal(countWord(Number.NaN), NO_COUNT)
  })

  test('isNoCount agrees with countWord, so the grey and the dash cannot disagree', () => {
    for (const v of [0, null, undefined, -1, Number.NaN]) assert.equal(isNoCount(v), true, `${v}`)
    for (const v of [1, 5, 31]) assert.equal(isNoCount(v), false, `${v}`)
  })
})

describe('the four numbers come from usage_counters and nowhere else — decision 2', () => {
  test('the labels are the boards\' labels, in the boards\' order', () => {
    assert.deepEqual(COUNTER_TILES.map(t => t.label),
      ['Files read', 'Questions answered', 'Audits done', 'Checklists created'])
    assert.deepEqual(COUNTER_TILES.map(t => t.key),
      ['files_read', 'questions_answered', 'audits_done', 'checklists_created'])
    for (const t of COUNTER_TILES) {
      assert.ok(BOARDS.includes(`<div class="k">${t.label}</div>`), `board 1 has no "${t.label}" tile`)
    }
  })

  test('the page selects exactly those four columns from that one table', () => {
    assert.equal(COUNTER_COLUMNS, 'files_read, questions_answered, audits_done, checklists_created')
    assert.ok(CODE.includes(".from('usage_counters')"))
    assert.ok(CODE.includes('COUNTER_COLUMNS'), 'the select must use the shared column list')
  })

  test('a company with no counter row is not an error', () => {
    // `single()` returns PGRST116 for zero rows, which would send board 3's ordinary day-one
    // company down the failure branch.
    assert.ok(CODE.includes('.maybeSingle()'), 'the counter read must use maybeSingle')
    assert.ok(!/usage_counters'\)[\s\S]{0,200}\.single\(\)/.test(CODE))
  })

  test('the old row-counting is gone: no research_answer, no issues, nothing counted from rows', () => {
    for (const gone of ['research_answer', 'issuesIdentified', 'filesReviewed',
                        'open_gap_count', 'display_status']) {
      assert.ok(!CODE.includes(gone), `the page still names ${gone}`)
    }
    // *** `document_index_v` IS BACK AT STEP 6, AND IT IS NOT COUNTING. *** It is read for the
    // TITLE of a template audit's checklist, for at most three rows, by id. What this check is
    // really about is that no number on the page is computed from rows, so that is what it says:
    // the view is selected for two columns and never filtered-and-counted.
    assert.match(CODE, /from\('document_index_v'\)\s*\n?\s*\.select\('document_id, title'\)/)
    assert.ok(!/document_index_v[\s\S]{0,400}\.length/.test(CODE), 'something is counting the view again')
    // "Issues identified" is dropped from this revision altogether — decision 2.
    assert.ok(!PAGE.includes('Issues identified'))
  })

  test('the page reads with the caller\'s own client and calls no route', () => {
    assert.ok(!CODE.includes('fetch('), 'the Dashboard fetches nothing')
    assert.ok(!CODE.includes('/api/'), 'the Dashboard calls no route')
    assert.ok(!CODE.includes('supabaseAdmin'), 'no admin client on a client page')
  })
})

describe('the shell — the shared column, and what left the page', () => {
  test('it takes the same 900 column the Calendar takes', () => {
    const column = 'mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6'
    assert.ok(PAGE.includes(column), 'the Dashboard is not on the shared column')
    assert.ok(CALENDAR.includes(column), 'the Calendar has moved; this check is now comparing to nothing')
    assert.ok(!PAGE.includes('max-w-5xl'), 'the Dashboard is still on its own width')
  })

  test('the frame is imported, not copied', () => {
    assert.ok(CODE.includes("from '@/components/AppLayout'"))
    assert.ok(!CODE.includes('<nav'), 'the page must not draw its own sidebar')
    assert.ok(!CODE.includes('topbar'), 'the page must not draw its own topbar')
  })

  /**
   * Against CODE, not PAGE: the wrapper's own comment names `print-page` in order to say why it
   * is not there, and the first version of this check failed on that comment. This is the trap
   * the header describes, caught by the check it was written for.
   */
  test('it stays out of the print frame — decision 11, the Dashboard prints nothing', () => {
    assert.ok(!CODE.includes('print-page'))
    assert.ok(!CODE.includes('no-print'))
  })

  test('the title is a serif 28, the same as every rebuilt page\'s', () => {
    assert.ok(PAGE.includes('font-serif text-[28px] font-normal text-gray-900'))
    assert.ok(CALENDAR.includes('font-serif text-[28px] font-normal text-gray-900'))
  })

  test('the company header with the raw industry slug is gone', () => {
    for (const gone of ['profile?.industry', 'profile?.state', 'profile?.city', 'CompanyProfile']) {
      assert.ok(!PAGE.includes(gone), `the page still draws ${gone}`)
    }
    assert.ok(!CODE.includes(".from('companies')"), 'the page still reads companies')
  })

  test('the Recently read panel and its reads are gone', () => {
    // Against CODE: step 6's header names "Recently read" in order to say what replaced it.
    for (const gone of ['Recently read', 'No documents read yet', 'readings', 'KIND_WORD',
                        'statusWord', 'isAmber', 'documentStatus']) {
      assert.ok(!CODE.includes(gone), `the page still carries ${gone}`)
    }
  })

  test('documentStatus no longer points at a line in the Dashboard that moved', () => {
    assert.ok(!DOCSTATUS.includes('app/dashboard/page.tsx:37'), 'the stale cross-reference is back')
    assert.ok(DOCSTATUS.includes('TWO OTHER COPIES'), 'the copy count was not re-counted')
  })

  /**
   * STEP 6 MOVED THIS UP A LEVEL. The page called `liveDates(supabase, CALENDAR_COUNT_COLUMNS …)`
   * and built its own row; it now calls `readCalendarRows`, which IS `liveDates` with the view's
   * full column list (`lib/calendarView.ts:84`) and is what the Calendar page itself calls. The
   * claim is unchanged — one filter, shared — so the check follows it rather than the old spelling.
   */
  test('Upcoming still reads the one live filter, through the Calendar\'s own call', () => {
    assert.ok(CODE.includes('readCalendarRows(supabase)'))
    assert.match(CALVIEW, /export async function readCalendarRows[\s\S]{0,200}liveDates\(db, CALENDAR_VIEW_COLUMNS\)/)
    assert.ok(!/\.from\('calendar_v'\)/.test(CODE), 'the page must not name the view itself')
    assert.ok(CODE.includes('/calendar?tab=calendar&date='), 'a row must still open the drawer')
    // §5.1: a read that failed must not be drawn as an empty calendar.
    assert.ok(PAGE.includes('We could not load your dates just now'))
  })

  test('the first visit is recorded through the column grant, once, and a refusal is swallowed', () => {
    assert.ok(CODE.includes('welcomed_at:'), 'the page must record the first visit')
    assert.ok(/if \(greeting\.firstVisit\)/.test(CODE), 'the write must be gated on the first visit')
    assert.ok(!/throw[\s\S]{0,80}welcomeError/.test(CODE), 'a refused welcome must not throw')
    // The only write the page does. Anything else writing here is a new decision.
    assert.equal((CODE.match(/\.update\(/g) ?? []).length, 1)
    assert.equal((CODE.match(/\.insert\(/g) ?? []).length, 0)
    assert.equal((CODE.match(/\.delete\(/g) ?? []).length, 0)
  })
})

describe('login lands on the Dashboard — decision 1', () => {
  test('the login page pushes /dashboard', () => {
    assert.ok(LOGIN.includes("router.push('/dashboard')"))
    assert.ok(!LOGIN.includes("router.push('/')"), 'login still lands on the marketing homepage')
  })

  /**
   * *** THERE IS ONE WAY OUT OF SIGNUP NOW, NOT TWO — My Account step 12. *** This counted two,
   * because the old page could finish either through the form or through the industry-questions
   * pop-up, and half of new accounts would have gone to the marketing page if they disagreed. Board
   * 6 has four fields and no pop-up, so there is one landing and it is still the Dashboard. Step 14
   * moves it to the walk.
   */
  test('the one way out of signup pushes /dashboard', () => {
    assert.equal((SIGNUP.match(/router\.push\('\/dashboard'\)/g) ?? []).length, 1)
    assert.ok(!SIGNUP.includes("router.push('/')"), 'a signup path still lands on the homepage')
  })

  /**
   * The one `push('/')` left for a person who had been signed in, and it is correct: it follows
   * `auth.signOut()` after the account has been deleted (`app/account/page.tsx`). They have no
   * company and no session, so `/dashboard` would bounce them straight to `/login`.
   */
  test('account deletion still lands on the homepage, because there is nothing else left', () => {
    const ACCOUNT = readFileSync('app/account/page.tsx', 'utf8')
    assert.ok(/signOut\(\)[\s\S]{0,200}router\.push\('\/'\)/.test(ACCOUNT))
  })
})

// =================================================================================================
// STEP 5b — THE SIDEBAR (`docs/DASHBOARD-PLAN.md` decision 12, `docs/dashboard-boards.html` board 4)
// =================================================================================================

const LAYOUT = readFileSync('components/AppLayout.tsx', 'utf8')
const TABS = readFileSync('components/Tabs.tsx', 'utf8')
/** `NAV_ITEMS` alone, so a word in a comment cannot stand in for a word in the list. */
const NAV = LAYOUT.slice(LAYOUT.indexOf('const NAV_ITEMS = ['), LAYOUT.indexOf('export default'))
  .replace(/^\s*\/\/.*$/gm, '')
/**
 * THE SIDEBAR'S OWN MARKUP, AND NOTHING ELSE OF THE FRAME. The first version of the two checks
 * below read the whole file and failed on `hover:text-green-700` in the header's Feedback button
 * and `bg-green-50` in the referral modal — both untouched by this step, both correct where they
 * are. A check scoped to a file when the rule is about a component finds the component's green in
 * three other people's buttons.
 */
const NAVBLOCK = LAYOUT.slice(LAYOUT.indexOf('const SidebarContent'), LAYOUT.indexOf('  return (\n    <div className="min-h-screen'))

describe('the sidebar — the owner\'s order, and the hrefs that did not move', () => {
  test('the eight items are in decision 12\'s order', () => {
    const labels = [...NAV.matchAll(/label: '([^']+)'/g)].map(m => m[1])
    assert.deepEqual(labels, [
      'Dashboard', 'Compliance Workspace', 'Audit Workspace', 'HR Workspace',
      'Calendar', 'Documents', 'Company information', 'My Account',
    ])
  })

  /**
   * Two words changed and no address did. This is the half of the rename that can break silently:
   * a label is read by a person, an href is read by every link, bookmark and test in the product.
   */
  test('"Audit Workspace" still goes to /audits and "Documents" still to /documents', () => {
    assert.match(NAV, /label: 'Audit Workspace', href: '\/audits'/)
    assert.match(NAV, /label: 'Documents', href: '\/documents'/)
    const hrefs = [...NAV.matchAll(/href: '([^']+)'/g)].map(m => m[1])
    assert.deepEqual([...hrefs].sort(), [
      '/account', '/audits', '/calendar', '/company-information',
      '/compliance', '/dashboard', '/documents', '/hr',
    ])
  })

  test('the old words are gone from the list', () => {
    assert.ok(!/label: 'Audits'/.test(NAV), '"Audits" is still a nav label')
    assert.ok(!/label: 'Company Documents'/.test(NAV), '"Company Documents" is still a nav label')
  })

  test('the hairline sits between Documents and Company information, and nowhere else', () => {
    assert.equal((NAV.match(/ruleBefore: true/g) ?? []).length, 1)
    assert.match(NAV, /label: 'Company information'[^\n]*ruleBefore: true/)
    // A line, not a gap: 1px of the shared line token, inset by the items' own padding.
    assert.match(LAYOUT, /item\.ruleBefore && <div className="mx-3 my-3\.5 h-px bg-\[var\(--line\)\]" \/>/)
  })
})

describe('the active page is marked as a workspace marks its active tab', () => {
  /**
   * The tokens are not chosen here, they are read off `components/Tabs.tsx`. If the tab row ever
   * moves to a different green, this test fails and the sidebar is told to follow — which is the
   * whole claim decision 12 makes: one mark, two places.
   */
  test('the same two tokens the tab row uses, read from Tabs.tsx', () => {
    assert.match(TABS, /border-\[var\(--green\)\] text-\[var\(--green-ink\)\]/)
    assert.match(TABS, /font-medium/)
    assert.match(LAYOUT, /isActive\s*\?\s*'text-\[var\(--green-ink\)\] font-medium'/)
    assert.match(LAYOUT, /underline decoration-\[var\(--green\)\] decoration-2 underline-offset-\[6px\]/)
  })

  test('no box, no fill, no green background in the nav', () => {
    assert.ok(!NAVBLOCK.includes('bg-green-50'), 'the green box is back')
    assert.ok(!NAVBLOCK.includes('text-green-800'), 'the old active text colour is back')
    assert.ok(!/bg-green/.test(NAVBLOCK), 'a green fill is back in the nav')
    assert.ok(NAVBLOCK.length > 500, 'the nav block was not found — this check is reading nothing')
  })

  test('the underline is on the word, not on the row', () => {
    // The row is a flex container and the label span is one of its children. An underline on the
    // button would run the full 176px of the row, under the count as well as the word.
    const span = LAYOUT.slice(LAYOUT.indexOf('<span className={`text-left'))
    assert.match(span.slice(0, 220), /isActive \? 'underline decoration/)
    assert.ok(!/className=\{`w-full flex[^`]*underline/.test(LAYOUT), 'the underline is on the button')
  })

  test('hover is a grey fill and never green', () => {
    assert.match(NAVBLOCK, /hover:bg-gray-50 hover:text-gray-900/)
    assert.ok(!/hover:(bg|text|border)-green/.test(NAVBLOCK), 'a green hover is back in the nav')
  })

  test('the 224px width and the item padding are unchanged, so no page\'s column moves', () => {
    assert.match(LAYOUT, /<aside className="no-print hidden lg:flex flex-col w-56/)
    assert.match(LAYOUT, /px-3 py-2\.5 rounded-md text-sm/)
    assert.match(LAYOUT, /<nav className="flex-1 px-3 py-4 space-y-1">/)
  })
})

// =================================================================================================
// STEP 6 — UPCOMING, RECENT AUDITS, AND THE BREADCRUMB THAT WENT
// =================================================================================================

const SECTION = readFileSync('components/DashboardSection.tsx', 'utf8')
const AUDITS = readFileSync('app/audits/page.tsx', 'utf8')
const CALVIEW = readFileSync('lib/calendarView.ts', 'utf8')

describe('six, and a line that says how many more — decision 6', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }))

  test('the boundaries, which are the whole of this function', () => {
    for (const [n, want, more] of [[0, 0, 0], [1, 1, 0], [6, 6, 0], [7, 6, 1], [20, 6, 14]] as const) {
      const s = splitUpcoming(rows(n))
      assert.equal(s.shown.length, want, `${n} dates should show ${want}`)
      assert.equal(s.more, more, `${n} dates should say ${more} more`)
    }
  })

  test('shown plus more is always everything — nothing is silently dropped', () => {
    for (const n of [0, 1, 5, 6, 7, 13, 20, 99]) {
      const s = splitUpcoming(rows(n))
      assert.equal(s.shown.length + s.more, n, `${n} dates`)
    }
  })

  test('it does not re-sort: the caller\'s order is the order shown', () => {
    const given = [{ id: 'c' }, { id: 'a' }, { id: 'b' }]
    assert.deepEqual(splitUpcoming(given).shown.map(r => r.id), ['c', 'a', 'b'])
  })

  test('the more line is singular at one', () => {
    assert.equal(moreLine(1), '1 more in the next 30 days.')
    assert.equal(moreLine(2), '2 more in the next 30 days.')
    assert.equal(moreLine(14), '14 more in the next 30 days.')
  })

  test('the window is the view\'s own numbers, and a date with no day is not a deadline', () => {
    const base = { next_due: '2026-11-01', days_until: 5, has_passed: false }
    assert.equal(inNext30Days(base), true)
    assert.equal(inNext30Days({ ...base, days_until: 0 }), true, 'today is in the window')
    assert.equal(inNext30Days({ ...base, days_until: 30 }), true, '30 is the edge and is in')
    assert.equal(inNext30Days({ ...base, days_until: 31 }), false)
    assert.equal(inNext30Days({ ...base, days_until: -1 }), false)
    // Decision 23: a repeating date whose period was never read has no computable next day.
    assert.equal(inNext30Days({ ...base, next_due: null }), false, 'no day is not a deadline')
    assert.equal(inNext30Days({ ...base, days_until: null }), false)
    assert.equal(inNext30Days({ ...base, has_passed: true }), false, 'passed belongs to the Calendar')
  })
})

describe('the rows are the Calendar\'s own, not a copy', () => {
  test('the page imports the Calendar\'s words and writes none of its own', () => {
    for (const fn of ['metaParts', 'whenWords', 'passedWords', 'longDay', 'siteWords', 'readCalendarRows']) {
      assert.ok(CODE.includes(fn), `the page must use ${fn}`)
    }
    // The page used to phrase these itself. "Today"/"Tomorrow" are `whenWords`' "today"/"tomorrow".
    assert.ok(!/'Today'/.test(CODE), 'the page is phrasing the when-word again')
    assert.ok(!/'Tomorrow'/.test(CODE), 'the page is phrasing the when-word again')
    assert.ok(!/in \$\{/.test(CODE), 'the page is building an "in N days" of its own')
    assert.ok(!CODE.includes('NOT_CONFIRMED'), 'not confirmed comes from metaParts, not from here')
  })

  test('and it still opens the Calendar\'s drawer', () => {
    assert.ok(CODE.includes('/calendar?tab=calendar&date='))
  })

  /**
   * The board draws a soon date in `--danger`. There is no such token: `app/globals.css` carries
   * `--amber` and no red. This test is the record of that substitution — if a danger token is ever
   * added, it fails and the page is told to use it.
   */
  test('the soon colour is amber, because no danger token exists', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    assert.ok(!/--danger:/.test(css), 'a --danger token now exists; the Upcoming row should use it')
    assert.match(CODE, /days_until \?\? 99\) <= 7 \? 'text-\[var\(--amber\)\]'/)
    // And the Calendar itself draws the when-word in plain grey, which is what this departs from.
    assert.match(CALVIEW, /export function whenWords/)
  })
})

describe('recent audits — decision 7, and open question 2', () => {
  /**
   * *** OPEN QUESTION 2, ANSWERED: HR's handbook audits are NOT `audit_runs` rows. ***
   * They are `handbook_checks` (`lib/handbookCheck.ts:131`), with their own sections and findings
   * tables, and `audit_runs.kind` is constrained to 'agency' or 'template' — there is no handbook
   * kind to be. So this section shows compliance audits only. This test holds the answer, so a
   * later change that starts writing handbook checks into `audit_runs` has to come past it.
   */
  test('a handbook check is its own table, so it is not a recent audit', () => {
    const hb = readFileSync('lib/handbookCheck.ts', 'utf8')
    assert.ok(hb.includes("from('handbook_checks')"), 'a handbook check is a handbook_checks row')
    assert.ok(!hb.includes('audit_runs'), 'HR has started writing into audit_runs')
    const schema = readFileSync('docs/SCHEMA.md', 'utf8')
    assert.match(schema, /audit_runs_kind_check.*'agency'.*'template'/)
  })

  test('the read is done runs, newest first, three of them — and says nothing about dismissed', () => {
    assert.match(CODE, /\.from\('audit_runs'\)\.select\(AUDIT_RUN_ROW_COLUMNS\)/)
    assert.match(CODE, /\.eq\('status', AUDIT_DONE\)/)
    assert.match(CODE, /\.order\('finished_at', \{ ascending: false, nullsFirst: false \}\)/)
    assert.match(CODE, /\.limit\(RECENT_AUDITS_MAX\)/)
    assert.equal(RECENT_AUDITS_MAX, 3)
    // Decision 7: dismissing clears a banner, it does not un-run the audit.
    assert.ok(!CODE.includes('dismissed_at'), 'the read is filtering dismissed runs out')
  })

  test('a row opens the report at an address the Audits page already understands', () => {
    assert.ok(CODE.includes('/audits?run='), 'the row must link to the report')
    // Not a claim about this page: the Audits page's own lines that make it true.
    //
    // *** THE SPELLING CHANGED ON 20 OCTOBER AND THE CLAIM DID NOT. *** This asserted
    // `const openRun = params.get('run')`. The hotfix made the drawer STATE seeded from that
    // parameter, because deriving it from the address every render meant a report opened from the
    // address could not be closed on a production build (`tests/unit/auditDrawer.test.ts` holds
    // the why). `/audits` still reads `?run=` and still opens that report, which is all this
    // check was ever about.
    assert.match(AUDITS, /const runParam = params\.get\('run'\)/)
    assert.match(AUDITS, /useState<string \| null>\(runParam\)/)
    assert.match(AUDITS, /<AuditReport runId=\{openRun\}/)
  })

  test('both pages name a run with the same function', () => {
    assert.match(AUDITS, /import \{ runName.*\} from '@\/lib\/auditView'/)
    assert.ok(CODE.includes('runName('), 'the Dashboard must use it too')
    // The words themselves, moved and not rewritten.
    assert.equal(runName({ kind: 'agency', scope: null, agency_label: 'Oregon OSHA', section_count: 1, template_document_id: null }), 'Oregon OSHA')
    assert.equal(runName({ kind: 'agency', scope: null, agency_label: 'Oregon OSHA', section_count: 4, template_document_id: null }), ALL_AGENCIES)
    assert.equal(runName({ kind: 'agency', scope: null, agency_label: null, section_count: 1, template_document_id: null }), ALL_AGENCIES)
    // A template run is named by its checklist, never "All agencies" and never an id.
    assert.equal(runName({ kind: 'template', scope: 'the fire form', section_count: 1, agency_label: null, template_document_id: 'd1' }, 'Fire marshal checklist'), 'Against Fire marshal checklist')
    assert.equal(runName({ kind: 'template', scope: 'the fire form', section_count: 1, agency_label: null, template_document_id: 'd1' }), 'Against the fire form')
    assert.equal(runName({ kind: 'template', scope: null, section_count: 1, agency_label: null, template_document_id: 'd1' }), 'Against your checklist')
  })
})

describe('the two sections, their headings and their day-one lines', () => {
  test('one shared heading, used by both', () => {
    assert.equal((CODE.match(/<DashboardSection /g) ?? []).length, 2)
    assert.ok(CODE.includes('heading="Upcoming in the next 30 days" action="Open the Calendar →" href="/calendar"'))
    assert.ok(CODE.includes('heading="Recent audits" action="All audits →" href="/audits"'))
    // Board 1's numbers: a serif 20 on the left, the action 13px in the dark green.
    assert.match(SECTION, /font-serif text-\[20px\] font-normal/)
    assert.match(SECTION, /text-\[13px\] text-\[var\(--green-ink\)\]/)
  })

  test('the day-one lines are board 3\'s, with somewhere to go', () => {
    assert.equal(UPCOMING_EMPTY, 'Deadlines from your documents will be displayed here.')
    assert.equal(AUDITS_EMPTY, 'Your recent audits will show here.')
    assert.equal(UPCOMING_EMPTY_LINK, 'Add a document')
    assert.equal(AUDITS_EMPTY_LINK, 'Run your first audit')
    assert.ok(BOARDS.includes(UPCOMING_EMPTY), 'board 3 no longer carries the Upcoming line')
    assert.ok(BOARDS.includes(AUDITS_EMPTY), 'board 3 no longer carries the audits line')
  })

  /**
   * §5.1, and it is an ORDER, not a pair of branches: "nothing is due" over dates nobody managed
   * to read is the exact failure `CLAUDE.md` §5.1 is written about.
   */
  test('a failed read is checked before the empty state, in both sections', () => {
    const upcoming = CODE.slice(CODE.indexOf('Upcoming in the next 30 days'))
    assert.ok(upcoming.indexOf('dates === null') < upcoming.indexOf('shown.length === 0'))
    const recent = CODE.slice(CODE.indexOf('heading="Recent audits"'))
    assert.ok(recent.indexOf('audits === null') < recent.indexOf('audits.length === 0'))
  })

  /* The placeholder this held is filled: see "the card sits between the numbers and Upcoming"
     below, which checks the same order against the component that now sits there. */
})

describe('the breadcrumb is gone — step 6F', () => {
  test('nothing draws "/ {title}" any more', () => {
    assert.ok(!/\{title\}<\/span>/.test(LAYOUT), 'the breadcrumb markup is back')
    assert.ok(!/\/ \{title\}/.test(LAYOUT.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')), 'the breadcrumb markup is back')
  })

  /**
   * The prop stays, and this records why: it is what names the browser tab. Removing it would
   * have turned "Dashboard — CompliBoard" into plain "CompliBoard" on the two pages that pass one.
   */
  test('the title prop survives for the browser tab, and for nothing else', () => {
    assert.match(LAYOUT, /if \(title\) document\.title = `\$\{title\} — CompliBoard`/)
    assert.match(LAYOUT, /else document\.title = 'CompliBoard'/)
    // Nothing RENDERS it. That is the check that matters: a prop that only ever reaches
    // `document.title` cannot put words back beside the logo.
    // `(?<!\$)` so the template literal on the document.title line is not mistaken for JSX —
    // `${title}` and `{title}` are one character apart and only one of them draws anything.
    assert.ok(!/(?<!\$)\{title\}/.test(LAYOUT.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')), 'title is rendered somewhere')
    assert.ok(!/\{title &&/.test(LAYOUT), 'a title branch is back in the markup')
  })

  test('the logo is untouched and still goes to the Dashboard', () => {
    assert.match(LAYOUT, /<a href="\/dashboard" className="hidden lg:flex items-center gap-2 pl-3">/)
  })
})

// =================================================================================================
// STEP 7 — THE THREE QUESTIONS (decisions 8, 9, 10; open question 1, settled at step 4)
// =================================================================================================

const CARD = readFileSync('components/DashboardQuestions.tsx', 'utf8')
const cardCode = code(CARD)
/**
 * *** THE ANSWER CONTROL MOVED OUT OF THE CARD AT MY ACCOUNT STEP 6. ***
 * The number box, the two words and the option buttons now live in
 * `components/SwitchAnswerControl.tsx`, because the Company tab asks these same three questions
 * (`ACCOUNT-PLAN.md` decision 5) and a second copy of "show the label, post the value" would
 * eventually write a label into `company_switches.value`. Every claim below is unchanged — the
 * control is read from the file that holds it now.
 */
const CONTROL = readFileSync('components/SwitchAnswerControl.tsx', 'utf8')
const controlCode = code(CONTROL)
const ANSWER_ROUTE = readFileSync('app/api/switches/answer/route.ts', 'utf8')
const SWITCH_ASK = readFileSync('lib/switchAsk.ts', 'utf8')

const q = (over: Partial<CardQuestion> = {}): CardQuestion => ({
  switch_id: 's1', question: 'Do you have employees other than the owner?',
  scope: 'company', value_type: 'boolean', allowed_values: [], ...over,
})

describe('what can be asked here — decision 8', () => {
  test('company scope only: a site question never reaches this card', () => {
    const list = [q({ switch_id: 'a' }), q({ switch_id: 'b', scope: 'site' }), q({ switch_id: 'c' })]
    assert.deepEqual(askableHere(list).map(x => x.switch_id), ['a', 'c'])
  })

  /**
   * Scope is `switches.scope`, the enum `switch_scope`, carried onto `Askable.scope`. The route
   * does not filter by it — `askableSwitches(..., entityId = null)` returns site-scoped rows too —
   * so the filter has to be here, and this records that it is not optional.
   */
  test('and the route does not do it for us', () => {
    assert.match(SWITCH_ASK, /scope: sw\.scope,/)
    assert.ok(!/scope === 'company'/.test(readFileSync('app/api/switches/ask/route.ts', 'utf8')),
      'the route now filters by scope; this page could stop')
    // The route would refuse one anyway, which is the second line of defence, not the first.
    assert.match(ANSWER_ROUTE, /if \(sw\.scope === 'site' && !entityId\)/)
  })

  test('a value type no control fits is skipped, not guessed at', () => {
    assert.equal(answerKind('boolean'), 'yes_no')
    assert.equal(answerKind('number'), 'number')
    assert.equal(answerKind('enum'), 'options')
    assert.equal(answerKind('text'), null)
    assert.equal(answerKind('something_new'), null)
    const list = [q({ switch_id: 'a' }), q({ switch_id: 't', value_type: 'text' })]
    assert.deepEqual(askableHere(list).map(x => x.switch_id), ['a'])
    assert.deepEqual(skippedForType(list).map(x => x.switch_id), ['t'])
  })
})

describe('which question, and which state — C', () => {
  const three = [q({ switch_id: 'a' }), q({ switch_id: 'b' }), q({ switch_id: 'c' })]

  test('the first one left, in the route\'s order, skipping today\'s skips', () => {
    assert.equal(nextQuestion(three, [])?.switch_id, 'a')
    assert.equal(nextQuestion(three, ['a'])?.switch_id, 'b')
    assert.equal(nextQuestion(three, ['a', 'b'])?.switch_id, 'c')
    assert.equal(nextQuestion(three, ['a', 'b', 'c']), null)
  })

  test('the number is answered-today plus one, and never passes three', () => {
    assert.equal(cardNumber(0), '1 of 3')
    assert.equal(cardNumber(1), '2 of 3')
    assert.equal(cardNumber(2), '3 of 3')
    assert.equal(cardNumber(3), '3 of 3', 'the quiet card shows instead, but the number cannot lie')
  })

  test('the three states, at 0, 2 and 3 answered', () => {
    assert.equal(questionState(three, 0, []), 'question')
    assert.equal(questionState(three, 2, []), 'question')
    assert.equal(questionState(three, 3, []), 'quiet')
    assert.equal(questionState(three, 4, []), 'quiet', 'a colleague answering too is not a bug')
  })

  test('all skipped today: quiet, not hidden — tomorrow they come back', () => {
    assert.equal(questionState(three, 0, ['a', 'b', 'c']), 'quiet')
    assert.equal(questionState(three, 1, ['a', 'b', 'c']), 'quiet')
  })

  test('nothing left to ask at all: hidden — no heading and no card', () => {
    assert.equal(questionState([], 0, []), 'hidden')
    assert.equal(questionState([q({ scope: 'site' })], 0, []), 'hidden', 'site questions do not count')
    assert.equal(questionState([q({ value_type: 'text' })], 0, []), 'hidden')
    // And hidden beats everything: a company with no question has nothing to be quiet about.
    assert.equal(questionState([], 3, ['a']), 'hidden')
  })
})

describe('today starts at the person\'s own midnight', () => {
  test('the instant is the browser\'s local midnight, not UTC\'s', () => {
    const noonLocal = new Date(2026, 9, 20, 12, 30, 0)   // 20 Oct 2026, 12:30 local
    const iso = localMidnightIso(noonLocal)
    const back = new Date(iso)
    assert.equal(back.getFullYear(), 2026)
    assert.equal(back.getMonth(), 9)
    assert.equal(back.getDate(), 20)
    assert.equal(back.getHours(), 0)
    assert.equal(back.getMinutes(), 0)
    assert.equal(back.getSeconds(), 0)
    assert.ok(iso.endsWith('Z'), 'it goes on the wire as an absolute instant')
  })

  test('a moment just after midnight is already the new day', () => {
    const justAfter = new Date(2026, 9, 21, 0, 1, 0)
    assert.equal(new Date(localMidnightIso(justAfter)).getDate(), 21)
  })

  test('the skip key is the LOCAL date, so it rolls at the same moment', () => {
    assert.equal(skipKey(new Date(2026, 9, 20, 23, 59)), 'compliboard:dashboard-skips:2026-10-20')
    assert.equal(skipKey(new Date(2026, 9, 21, 0, 1)), 'compliboard:dashboard-skips:2026-10-21')
    assert.equal(skipKey(new Date(2026, 0, 5, 9, 0)), 'compliboard:dashboard-skips:2026-01-05')
  })
})

describe('skips live in the browser, and the page works without one', () => {
  const mem = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
  }
  const throwing = {
    getItem() { throw new Error('SecurityError: localStorage is not available') },
    setItem() { throw new Error('SecurityError: localStorage is not available') },
  }

  test('a skip is remembered for the day', () => {
    const s = mem()
    assert.deepEqual(readSkips(s, 'k'), [])
    assert.deepEqual(writeSkip(s, 'k', 'a'), ['a'])
    assert.deepEqual(writeSkip(s, 'k', 'b'), ['a', 'b'])
    assert.deepEqual(writeSkip(s, 'k', 'a'), ['a', 'b'], 'and not twice')
    assert.deepEqual(readSkips(s, 'k'), ['a', 'b'])
  })

  /** A private window, or site data blocked. The cost is one repeated question, not a crash. */
  test('storage that THROWS costs one repeated question and nothing else', () => {
    assert.deepEqual(readSkips(throwing, 'k'), [])
    assert.deepEqual(writeSkip(throwing, 'k', 'a'), ['a'], 'the answer is still right for this view')
    assert.deepEqual(readSkips(null, 'k'), [])
    assert.deepEqual(readSkips(undefined, 'k'), [])
  })

  test('rubbish in storage is not trusted', () => {
    const s = mem(); s.setItem('k', 'not json at all')
    assert.deepEqual(readSkips(s, 'k'), [])
    s.setItem('k', '{"a":1}')
    assert.deepEqual(readSkips(s, 'k'), [], 'an object is not a list of ids')
    s.setItem('k', '["a", 3, null, "b"]')
    assert.deepEqual(readSkips(s, 'k'), ['a', 'b'], 'and only the strings survive')
  })

  test('a skip never reaches the database', () => {
    const skipFn = cardCode.slice(cardCode.indexOf('function skip()'), cardCode.indexOf('function skip()') + 400)
    assert.ok(!/fetch|postSwitchAnswer|\.from\(/.test(skipFn), 'the skip is posting something')
    assert.ok(skipFn.includes('writeSkip('))
  })
})

describe('the card: its words, its one write, and what it never says', () => {
  test('board 2\'s words, exactly', () => {
    assert.equal(QUESTIONS_DONE, "Thanks — that's all for today. We'll ask a few more another day.")
    assert.equal(QUESTIONS_DONE_SUB, 'Your answers are in Company information if you want to change one.')
    assert.equal(SKIP_WORD, "I don't know yet")
    assert.equal(QUESTIONS_HEADING, 'Three quick questions')
    assert.equal(QUESTIONS_NOTE, 'Your answers are kept in Company information')
    for (const w of [QUESTIONS_DONE, QUESTIONS_DONE_SUB, SKIP_WORD, QUESTIONS_HEADING, QUESTIONS_NOTE]) {
      assert.ok(BOARDS.includes(w), `board 2 no longer carries "${w}"`)
    }
  })

  test('the question words come from the switch and are never written here', () => {
    assert.match(SWITCH_ASK, /question: sw\.question_plain,/)
    assert.ok(cardCode.includes('{current.question}'))
    assert.ok(!/<p[^>]*>[A-Z][^<{]{15,}\?/.test(cardCode), 'a question is hard-coded in the card')
  })

  /**
   * *** THIS TEST HELD AN ABSENCE UNTIL STEP 7b, AND NOW HOLDS A PRESENCE. ***
   *
   * It used to assert that the card had NOT grown a help line, because there was no column to
   * draw one from and a sentence written in the component would be a page inventing regulatory
   * guidance. Migration 081 adds `switches.help_plain` and fills it for all 22 company-scope
   * questions, so the rule it protects is unchanged — the words come from the library, never from
   * here — and what it checks is now that the card draws them, and draws nothing when there are
   * none.
   */
  test('the help line is drawn when the switch carries one', () => {
    assert.ok(cardCode.includes('{current.help}'), 'the card must draw the library\'s sentence')
    assert.match(cardCode, /\{current\.help && \(/, 'and only when there is one')
    // Board 2's weight: grey, 13px, directly under the question.
    assert.match(cardCode, /current\.help && \(\s*\n\s*<p className="mt-1 text-\[13px\] leading-5 text-gray-500">/)
  })

  test('and it is never composed here — it comes from the column', () => {
    assert.match(SWITCH_ASK, /help: sw\.help_plain \?\? null,/)
    assert.match(readFileSync('app/api/switches/ask/route.ts', 'utf8'), /question_plain, help_plain,/)
    // AND NO SENTENCE IS WRITTEN IN THE COMPONENT. A help line is a sentence and ends in a full
    // stop; a class string and an import path do not. Board 2's own four fixed strings live in
    // `lib/dashboardView.ts`, so the card should hold no sentence-shaped literal at all.
    const sentences = (cardCode.match(/'[^'\n]{20,}'|"[^"\n]{20,}"/g) ?? [])
      .map((x) => x.slice(1, -1))
      .filter((x) => /[a-z]\.$/.test(x.trim()))
    assert.deepEqual(sentences, [], `the card has grown prose of its own: ${sentences.join(' | ')}`)
  })

  test('a switch with no help line draws nothing, which is every site switch today', () => {
    // The field is optional on `CardQuestion` for exactly this: null and absent behave alike.
    const withNone = q()
    assert.equal(withNone.help, undefined)
    assert.equal(nextQuestion([withNone], [])?.help ?? null, null)
    const withOne = q({ help: 'Anyone on payroll, full or part time.' })
    assert.equal(nextQuestion([withOne], [])?.help, 'Anyone on payroll, full or part time.')
  })

  test('Company information draws the same sentence from the same column', () => {
    const CI = readFileSync('app/company-information/page.tsx', 'utf8')
    assert.match(CI, /l\.edit\.d\.help && \(/)
    assert.match(CI, /text-\[13px\] leading-5 text-gray-500">\{l\.edit\.d\.help\}/)
    assert.match(readFileSync('app/api/company-information/route.ts', 'utf8'),
      /help: \(m\.help_plain as string\) \?\? null,/)
  })

  test('one writer, one body shape, and no second copy of it', () => {
    assert.match(readFileSync('lib/switchAnswer.ts', 'utf8'), /ANSWER_ENDPOINT = '\/api\/switches\/answer'/)
    assert.ok(cardCode.includes('postSwitchAnswer({ switch_id: current.switch_id, value, entity_id: null })'))
    assert.ok(!cardCode.includes('fetch(\'/api/switches/answer'), 'the card posts through the helper')
    // The same three fields Company information's route proxies with.
    assert.match(readFileSync('app/api/company-information/route.ts', 'utf8'),
      /JSON\.stringify\(\{ switch_id: switchId, value, entity_id: entityId \}\)/)
  })

  test('nothing says what the answer did — decision 8', () => {
    // The route returns both and the card reads neither.
    assert.match(ANSWER_ROUTE, /unblocked/)
    assert.ok(!cardCode.includes('unblocked'), 'the card is reporting what an answer unlocked')
    assert.ok(!/requirement/i.test(cardCode), 'the card is naming requirements')
  })

  test('a failure keeps the question, says one sentence, and moves no number', () => {
    assert.equal(ANSWER_FAILED, 'That answer could not be saved. Nothing was changed. Please try again.')
    assert.ok(cardCode.includes('setFailed(true)'))
    // The early return is what leaves `answeredToday` and `current` exactly where they were.
    const fn = cardCode.slice(cardCode.indexOf('async function answer('), cardCode.indexOf('function skip()'))
    assert.ok(fn.indexOf('setFailed(true)') < fn.indexOf('await Promise.all'), 'a failure must return first')
    assert.ok(/if \(!res\.ok\) \{[\s\S]{0,200}return\s*\n/.test(fn), 'a failed answer must return early')
  })

  test('a second click sends nothing', () => {
    assert.ok(cardCode.includes('if (!current || busy) return'))
    // `busy` is passed INTO the control now, so the disabled controls are counted across both
    // files: the skip stays on the card, the number box, its Save and every option button are in
    // the control. The claim is what it always was — nothing on this card can be pressed twice.
    const both = (cardCode.match(/disabled=\{busy/g) ?? []).length
                + (controlCode.match(/disabled=\{busy/g) ?? []).length
    assert.ok(both >= 3, `only ${both} controls are disabled while busy`)
    assert.ok(cardCode.includes('<SwitchAnswerControl'))
    assert.ok(cardCode.includes('busy={busy}'), 'the card must hand `busy` to the control')
  })

  test('"three today" is counted from what was written, not kept in a column', () => {
    assert.ok(cardCode.includes(".from('switch_determinations')"))
    assert.ok(cardCode.includes(".eq('source', 'user_set')"))
    assert.ok(cardCode.includes(".gte('determined_at', localMidnightIso())"))
    // `fromUserAnswer` is what writes that source, so the count cannot drift from the write.
    assert.match(readFileSync('lib/switchDetermination.ts', 'utf8'), /source: 'user_set',/)
  })

  test('the card asks no site question of the route either', () => {
    assert.ok(cardCode.includes("fetch('/api/switches/ask'"))
    assert.ok(!/switches\/ask\?entity_id/.test(cardCode), 'an entity_id would make it a site question')
  })
})

describe('the card sits between the numbers and Upcoming — board 1', () => {
  test('in the page, in that order', () => {
    const card = PAGE.indexOf('<DashboardQuestions')
    assert.ok(card > 0, 'the card is not on the page')
    assert.ok(card > PAGE.indexOf('COUNTER_TILES.map'), 'it belongs below the numbers')
    assert.ok(card < PAGE.indexOf('Upcoming in the next 30 days'), 'and above Upcoming')
  })

  test('it uses the same section heading the other two do', () => {
    assert.ok(cardCode.includes('<DashboardSection heading={QUESTIONS_HEADING} quiet={QUESTIONS_NOTE} />'))
  })
})

describe('the answer route calls no model — checked, not assumed', () => {
  /**
   * The whole import closure of `/api/switches/answer`, walked. Resolution is code and never AI
   * (`CLAUDE.md` §1 layer 3, §3.2 "Resolution is deterministic"), and this is the check that it
   * stayed that way — the recompute is the only thing on this page that writes anything.
   */
  test('nothing in its closure imports lib/ai.ts', () => {
    const closure = ['app/api/switches/answer/route.ts', 'lib/obligationWriter.ts', 'lib/resolve.ts',
      'lib/appliesExpression.ts', 'lib/switchDetermination.ts', 'lib/switchAsk.ts',
      'lib/jurisdiction.ts', 'lib/basis.ts']
    for (const f of closure) {
      const src = readFileSync(f, 'utf8')
      assert.ok(!/from '@?\.?\/?lib\/ai'|from '\.\/ai\.ts'|askAI/.test(src), `${f} reaches a model`)
    }
    // And the card itself, which is the new caller.
    assert.ok(!/askAI|lib\/ai/.test(CARD))
  })
})

describe('an option shows a word and posts a key — migration 081', () => {
  const iso = (): CardQuestion => ({
    switch_id: 'holds_iso_certification', question: 'Do you hold ISO 9001 or ISO 14001?',
    scope: 'company', value_type: 'enum',
    allowed_values: ['none', 'iso_9001', 'iso_14001', 'both'],
    allowed_value_labels: { none: 'Neither', iso_9001: 'ISO 9001', iso_14001: 'ISO 14001', both: 'Both' },
  })

  test('the label is drawn and the value is what goes on the wire', () => {
    assert.deepEqual(optionButtons(iso()), [
      { value: 'none', label: 'Neither' },
      { value: 'iso_9001', label: 'ISO 9001' },
      { value: 'iso_14001', label: 'ISO 14001' },
      { value: 'both', label: 'Both' },
    ])
  })

  test('the order is the switch\'s own, not the map\'s', () => {
    const shuffled = iso()
    shuffled.allowed_value_labels = { both: 'Both', none: 'Neither', iso_14001: 'ISO 14001', iso_9001: 'ISO 9001' }
    assert.deepEqual(optionButtons(shuffled).map(o => o.value), ['none', 'iso_9001', 'iso_14001', 'both'])
  })

  /**
   * A value with no label shows AS ITSELF. `toll_processor` on a button is visibly wrong and
   * somebody fixes it; a missing button is invisibly wrong and nobody does. 081's self-test 5h
   * refuses the migration if any option of the three enum switches lacks one, so this is the
   * behaviour for a switch somebody adds later and forgets.
   */
  test('a value with no label falls back to the value', () => {
    assert.deepEqual(optionButtons({ allowed_values: ['toll_processor'], allowed_value_labels: {} }),
      [{ value: 'toll_processor', label: 'toll_processor' }])
    assert.deepEqual(optionButtons({ allowed_values: ['a'], allowed_value_labels: null }),
      [{ value: 'a', label: 'a' }])
    assert.deepEqual(optionButtons({ allowed_values: [], allowed_value_labels: null }), [])
  })

  test('the control posts opt.value, never opt.label', () => {
    assert.ok(controlCode.includes('onClick={() => onAnswer(opt.value)}'))
    assert.ok(controlCode.includes('{opt.label}'))
    assert.ok(controlCode.includes('optionButtons(question)'))
    // The route refuses anything that is not an allowed value, which is what makes this matter.
    assert.match(ANSWER_ROUTE, /!\(sw\.allowed_values as string\[\]\)\.includes\(value\)/)
  })

  test('...and the card hands it the question rather than drawing the control itself', () => {
    // The extraction is only safe while there is exactly one copy. If the branches ever come back
    // into the card, this fails.
    assert.ok(cardCode.includes('<SwitchAnswerControl'))
    assert.ok(!cardCode.includes('optionButtons('), 'the card must not draw option buttons itself')
    assert.ok(!cardCode.includes('YES_NO'), 'nor the two words')
    assert.ok(!cardCode.includes("type=\"number\""), 'nor the number box')
    // And the control owns no words of its own beyond Save: the question, the help line and the
    // skip stay with the page that asks.
    assert.ok(!controlCode.includes('question_plain'))
    assert.ok(!controlCode.includes("I don't know yet"))
  })

  test('Company information does the same, through its own helper', () => {
    const CI = readFileSync('app/company-information/page.tsx', 'utf8')
    assert.match(CI, /function optionPairs\(d: Declared\): Array<\[string, string\]>/)
    assert.match(CI, /d\.allowedValueLabels\?\.\[v\] \?\? v/)
    assert.match(CI, /<option key=\{v\} value=\{v\}>\{word\}<\/option>/)
  })

  test('and the migration gives every option of the three a label', () => {
    const M = readFileSync('supabase/migrations/081_a_question_says_what_counts.sql', 'utf8')
    for (const pair of [["'toll_processor'", "'Toll processor'"], ["'iso_9001'", "'ISO 9001'"],
                        ["'neither'", "'Neither'"], ["'both'", "'Both'"]]) {
      assert.ok(M.includes(pair[0]) && M.includes(pair[1]), `${pair[0]} → ${pair[1]} is not in 081`)
    }
    // 5h is what makes it a rule rather than a list somebody kept up to date.
    assert.match(M, /081 5h: option value\(s\) with no label/)
    // And the values themselves are asserted unchanged, because they are keys.
    assert.match(M, /081 5f: business_type allowed_values changed/)
  })
})
