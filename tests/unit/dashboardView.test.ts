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
} from '../../lib/dashboardView.ts'

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

  test('the old row-counting is gone: no document_index_v, no research_answer, no issues', () => {
    for (const gone of ['document_index_v', 'research_answer', 'issuesIdentified', 'filesReviewed',
                        'open_gap_count', 'display_status']) {
      assert.ok(!CODE.includes(gone), `the page still names ${gone}`)
    }
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
    for (const gone of ['Recently read', 'No documents read yet', 'readings', 'KIND_WORD',
                        'statusWord', 'isAmber', 'documentStatus']) {
      assert.ok(!PAGE.includes(gone), `the page still carries ${gone}`)
    }
  })

  test('documentStatus no longer points at a line in the Dashboard that moved', () => {
    assert.ok(!DOCSTATUS.includes('app/dashboard/page.tsx:37'), 'the stale cross-reference is back')
    assert.ok(DOCSTATUS.includes('TWO OTHER COPIES'), 'the copy count was not re-counted')
  })

  test('Upcoming is still there and still reads the one live filter — step 6 rebuilds it', () => {
    assert.ok(CODE.includes('liveDates('))
    assert.ok(CODE.includes('CALENDAR_COUNT_COLUMNS'))
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

  test('both ways out of signup push /dashboard', () => {
    assert.equal((SIGNUP.match(/router\.push\('\/dashboard'\)/g) ?? []).length, 2)
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
