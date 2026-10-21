/**
 * MY ACCOUNT'S WORDS AND ITS DISPLAY RULES — step 6 (boards 1 and 1b).
 *
 * Two kinds of check, kept apart the way `tests/unit/dashboardView.test.ts` keeps them:
 *
 *   1. `lib/accountView.ts` as functions, with no database and no clock.
 *   2. **The sentences checked against `docs/account-boards.html` ITSELF**, not against a copy
 *      typed in here. The board is the approved artifact; a test that quotes its own expectation
 *      cannot catch the page and the picture coming apart.
 *
 * The page's markup is held by measurement (`npm run measure`), not by assertions about classes.
 * What a test can hold is what the page must NOT do — send a column a person cannot write — and
 * that is the last section.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TITLE, LEDE, TABS, asTab,
  COMPANY_HEADING, COMPANY_LABEL, NAME_NOTE, WHAT_YOU_DO_LABEL, WEBSITE_LABEL,
  MAIN_SITE_LABEL, EDIT_ADDRESS, CHANGE, SAVE, CANCEL,
  QUESTIONS_HEADING, QUESTIONS_NOTE, NOT_ANSWERED, THREE_SWITCHES,
  SITES_HEADING, ADD_SITE, MAIN_PILL, EDIT, SITES_NOTE,
  SITE_NAME_LABEL, SITE_ADDRESS_LABEL, ON_THIS_SITE, REMOVE_SITE, REMOVE_SITE_CONFIRM,
  NOTHING_ON_SITE, PEOPLE_EMPTY,
  addressLine, countyLine, siteSubLine, sitePlaceLine, siteDrawerSub, addedLine,
  siteCountLines, siteIsEmpty, answerWord, type SiteRow, type SiteCounts,
} from '../../lib/accountView.ts'

/**
 * The source with its comments taken out. Every assertion below is about what the page DOES, and a
 * paragraph explaining what was removed necessarily names the thing it removed — two of these
 * checks failed on their own explanation before this was added.
 */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')

const BOARDS = readFileSync('docs/account-boards.html', 'utf8')
/** The board as text, so a sentence broken across tags still matches. */
const boardText = BOARDS.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&apos;|&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')

const onBoard = (s: string) => boardText.includes(s.replace(/\s+/g, ' '))

const site = (over: Partial<SiteRow> = {}): SiteRow => ({
  id: 's1', name: 'Vancouver warehouse', address: '5800 NE 88th St, Vancouver, WA 98665',
  postal_code: '98665', state: 'Washington', county: 'Clark', city: 'Vancouver',
  is_primary: false, created_at: '2026-10-21T10:00:00Z', ...over,
})

describe('every sentence is the board\'s own', () => {
  test('the page: its title, its lede and its five tabs', () => {
    assert.ok(onBoard(TITLE))
    assert.ok(onBoard(LEDE), 'the lede must be the board\'s')
    assert.deepEqual(TABS.map((t) => t.label), ['Company', 'People', 'Sign-in', 'Billing', 'Cancel'])
    for (const t of TABS) assert.ok(onBoard(t.label), `${t.label} is not on the board`)
  })

  test('the Company tab: every heading, label and grey line', () => {
    for (const s of [COMPANY_HEADING, COMPANY_LABEL, NAME_NOTE, WHAT_YOU_DO_LABEL, WEBSITE_LABEL,
                     MAIN_SITE_LABEL, EDIT_ADDRESS, QUESTIONS_HEADING, QUESTIONS_NOTE,
                     SITES_HEADING, ADD_SITE, MAIN_PILL, EDIT, SITES_NOTE, CHANGE, SAVE, CANCEL]) {
      assert.ok(onBoard(s), `not on board 1: ${JSON.stringify(s)}`)
    }
  })

  test('the site drawer: its labels and its three controls', () => {
    for (const s of [SITE_NAME_LABEL, SITE_ADDRESS_LABEL, ON_THIS_SITE, REMOVE_SITE]) {
      assert.ok(onBoard(s), `not on board 1b: ${JSON.stringify(s)}`)
    }
  })

  test('...and the two sentences that are NOT on the board say why in the file', () => {
    // The board draws no empty state for a site and no second confirmation, so these two are ours.
    // They are asserted as ours on purpose: the next session must not go looking for them on a
    // picture that does not have them.
    assert.ok(!onBoard(NOTHING_ON_SITE))
    // Widened to `string` deliberately: as literal types these two can never overlap, and tsc
    // refuses the comparison outright (TS2367). The check is about the VALUES staying different if
    // somebody edits one of them, which is exactly what a type-level "they differ" cannot hold.
    assert.notEqual(REMOVE_SITE_CONFIRM as string, REMOVE_SITE as string,
      'the confirming button must not repeat the button that opened it')
    const src = readFileSync('lib/accountView.ts', 'utf8')
    assert.match(src, /Board 1b has no empty state/)
    assert.match(src, /two identical buttons and no way to tell which one commits/)
  })

  test('the three questions are named by id, in the board\'s order', () => {
    assert.deepEqual([...THREE_SWITCHES], ['has_employees', 'employee_count', 'business_type'])
    // And their WORDS are not here: they are `switches.question_plain` (migration 081). A question
    // written into this file would be the product inventing regulatory wording (§3.3).
    const src = readFileSync('lib/accountView.ts', 'utf8')
    assert.ok(!src.includes('Do you have employees other than the owner?'))
  })

  test('People\'s empty state is a sentence about what will be there, not a claim about now', () => {
    assert.equal(PEOPLE_EMPTY, 'Who can sign in will appear here')
  })
})

describe('the tab in the address', () => {
  test('an unknown, absent or empty tab is Company', () => {
    for (const v of [null, undefined, '', 'nonsense', 'COMPANY']) assert.equal(asTab(v), 'company')
  })
  test('each real one survives a round trip', () => {
    for (const t of TABS) assert.equal(asTab(t.key), t.key)
  })
  test('*** THE DEFAULT TAB IS A VALUE, NOT AN ABSENCE ***', () => {
    // The 20 October hotfix: `router.replace` will not navigate to a path with no query, so a page
    // that drops its only parameter stops matching its own address (`DECISIONS.md` §206). `asTab`
    // never returns null, so `?tab=company` is always written and the empty case cannot arise.
    const page = readFileSync('app/account/page.tsx', 'utf8')
    assert.ok(page.includes("p.set('tab', k)"))
    assert.ok(!page.includes("p.delete('tab')"), 'the tab parameter must never be deleted')
    assert.ok(!/router\.replace\(`\/account\$\{/.test(page), 'no conditional-query template here')
  })
})

describe('a site, as a line', () => {
  test('the address and the county, each only when it is there', () => {
    assert.equal(siteSubLine(site()), '5800 NE 88th St, Vancouver, WA 98665 · Clark County')
    assert.equal(siteSubLine(site({ county: null })), '5800 NE 88th St, Vancouver, WA 98665')
    assert.equal(siteSubLine(site({ address: null })), 'Clark County')
    assert.equal(siteSubLine(site({ address: null, county: null })), '')
  })

  test('*** A PART THAT DID NOT RESOLVE IS ABSENT, NEVER A PLACEHOLDER ***', () => {
    // §5.1: an empty state is a message. "Address, , —" would be the page asserting three facts
    // and filling two of them with punctuation.
    const nothing = site({ address: null, state: null, county: null, city: null, postal_code: null })
    assert.equal(addressLine(nothing), '')
    assert.equal(countyLine(nothing), null)
    assert.ok(!siteSubLine(nothing).includes('·'))
    assert.ok(!siteSubLine(nothing).includes('—'))
  })

  test('the county is read with "County" and stored without it', () => {
    // The column holds the bare name, because that is what jurisdiction matching compares
    // (`lib/agencyScope.ts`: `a.jurisdiction_county === s.county`). The word is for reading only.
    assert.equal(countyLine(site({ county: 'Multnomah' })), 'Multnomah County')
    assert.equal(countyLine(site({ county: '  ' })), null)
  })

  test('the drawer\'s grey line names what the address gave, or says it gave nothing', () => {
    assert.equal(sitePlaceLine(site()),
      'The state and county are read from the address: Washington, Clark County. ' +
      'Dates, audits and site questions for this site attach to it.')
    const unresolved = sitePlaceLine(site({ state: null, county: null }))
    assert.ok(unresolved.includes('We have not been able to read them from this one yet'))
    // It must not print the sentence over two blanks — that would claim a resolution never made.
    assert.ok(!unresolved.includes('address: .'))
    assert.ok(!unresolved.includes(': ,'))
  })

  test('the drawer\'s subtitle, and the list\'s "added" line', () => {
    assert.equal(siteDrawerSub(site()), 'Added 21 October 2026 · Clark County, Washington')
    assert.equal(siteDrawerSub(site({ state: null, county: null })), 'Added 21 October 2026')
    assert.equal(siteDrawerSub(site({ created_at: null, state: null, county: null })), '')
    assert.equal(addedLine(site()), 'added 21 October 2026')
    assert.equal(addedLine(site({ created_at: null })), null)
  })
})

describe('what is on a site', () => {
  const counts = (over: Partial<SiteCounts> = {}): SiteCounts =>
    ({ dates: 4, audits: 1, lastAudit: { name: 'Washington L&I', on: '2026-09-26' }, answered: 3, open: 9, ...over })

  test('board 1b\'s three lines, in its words', () => {
    assert.deepEqual(siteCountLines(counts()), [
      '4 dates on the calendar',
      '1 audit · Washington L&I, 26 September 2026',
      '3 site questions answered · 9 open',
    ])
  })

  test('one of a thing is singular', () => {
    const l = siteCountLines(counts({ dates: 1, answered: 1, lastAudit: null }))
    assert.equal(l[0], '1 date on the calendar')
    assert.equal(l[1], '1 audit')
    assert.ok(l[2].startsWith('1 site question answered'))
  })

  test('*** A READ THAT FAILED LEAVES ITS LINE OUT. IT DOES NOT PRINT ZERO ***', () => {
    // §9a: a check that cannot see anything looks exactly like a check that found nothing, and
    // "0 dates on the calendar" for a site whose read failed is a claim nobody made.
    assert.deepEqual(siteCountLines({ dates: null, audits: null, lastAudit: null, answered: null, open: null }), [])
    assert.deepEqual(siteCountLines(counts({ dates: null })).length, 2)
    // The answered/open line needs BOTH halves; one without the other is not that sentence.
    assert.equal(siteCountLines(counts({ open: null })).length, 2)
  })

  test('empty means nothing attached AND nothing to ask', () => {
    const none = { dates: 0, audits: 0, lastAudit: null, answered: 0, open: 0 }
    assert.equal(siteIsEmpty(none), true)
    // Nine questions we could ask is not "nothing" — board 1b's third line is exactly that line.
    assert.equal(siteIsEmpty({ ...none, open: 9 }), false)
    assert.equal(siteIsEmpty({ ...none, dates: 1 }), false)
    // ...and a read that never came back can never make it true.
    assert.equal(siteIsEmpty({ ...none, dates: null }), false)
  })
})

describe('an answer as a person reads it', () => {
  test('booleans become Yes and No; an option shows its label', () => {
    assert.equal(answerWord('true', 'boolean'), 'Yes')
    assert.equal(answerWord('false', 'boolean'), 'No')
    assert.equal(answerWord('38', 'number'), '38')
    assert.equal(answerWord('toll_processor', 'enum', { toll_processor: 'Toll processor' }), 'Toll processor')
  })
  test('a value with no label is shown AS STORED, never guessed at', () => {
    assert.equal(answerWord('toll_processor', 'enum', {}), 'toll_processor')
    assert.equal(answerWord('toll_processor', 'enum', null), 'toll_processor')
    assert.equal(NOT_ANSWERED, 'Not answered yet')
  })
})

describe('*** WHAT THE PAGE MUST NEVER SEND — migration 082 ***', () => {
  const page = readFileSync('app/account/page.tsx', 'utf8')
  const ci = readFileSync('app/company-information/page.tsx', 'utf8')
  const ciRoute = readFileSync('app/api/company-information/route.ts', 'utf8')
  const accountRoute = readFileSync('app/api/account/route.ts', 'utf8')

  test('My Account writes only the three columns the grant allows', () => {
    // `grant update (industry, state, county, city, what_you_do, naics_code, website_url,
    // obligations_computed_at) on companies to authenticated` — of those, this page owns three.
    const patch = /writeCompany\(patch: Partial<Pick<CompanyRow, ([^>]*)>>\)/.exec(page)
    assert.ok(patch, 'the one write must be typed to the columns it may touch')
    assert.equal(patch[1].replace(/\s|'/g, ''), 'what_you_do|naics_code|website_url')
  })

  test('neither door sends the company name any more', () => {
    // My Account writes `companies` in exactly one place, and that place is typed to three columns
    // (asserted above). What is checked here is that the name is never in a BODY: `companyName` does
    // still appear on this page, as the prop the Cancel tab READS to compare a typed confirmation
    // against — reading the name was never the problem.
    const pageCode = code(page)
    assert.equal((pageCode.match(/from\('companies'\)\.update\(/g) ?? []).length, 1,
      'there is one write to companies on this page')
    assert.ok(!/companies'\)\.update\([^)]*name/.test(pageCode), 'and it does not name the name')
    assert.ok(!/body: JSON\.stringify\(\{[^}]*companyName/.test(pageCode))
    assert.ok(!/name:\s*rec\.company\.name/.test(ci), 'the draft must not carry the name')
    assert.ok(!/'name',\s*'industry'/.test(ciRoute), 'the patch list must not name it')
    // Narrowed again at step 6b: migration 083 makes companies.state/county/city a mirror of the
    // main site, so those leave the field list too and `industry` is all that is left.
    assert.match(ciRoute, /for \(const field of \['industry'\] as const\)/)
    assert.ok(!/'city'|'state'/.test(ciRoute.slice(ciRoute.indexOf("action === 'company'"),
                                                   ciRoute.indexOf("action === 'company'") + 1800)),
      'the company action must not write a place column any more')
  })

  test('the dead PUT is gone, and GET and DELETE are not', () => {
    assert.ok(!/export async function PUT/.test(accountRoute))
    assert.match(accountRoute, /export async function GET/)
    assert.match(accountRoute, /export async function DELETE/)
    // ...and the reason is written down where the handler used to be.
    assert.match(accountRoute, /THERE IS NO PUT ANY MORE, AND MIGRATION 082 IS WHY/)
  })

  test('the page holds no service role and no state or county of its own', () => {
    assert.ok(!/SERVICE_ROLE/i.test(page))
    assert.ok(!/supabaseAdmin/.test(page))
    // Decision 4: state and county come from the address. Nothing here types one.
    assert.ok(!/US_STATES/.test(page), 'the state dropdown went with the old form')
    // Decision 5 retires employee_count as a thing anyone reads. It survives in this file only in
    // the paragraph that says why the old form went, which `code()` strips.
    assert.ok(!/employee_count|employeeCount/.test(code(page)), 'employee_count is retired (decision 5)')
  })

  test('a site is written through the route that geocodes, never straight to the table', () => {
    assert.ok(!/from\('entities'\)\s*\.\s*(insert|update)/.test(page))
    const drawer = readFileSync('components/SiteDrawer.tsx', 'utf8')
    assert.ok(!/from\('entities'\)\s*\.\s*(insert|update)/.test(drawer))
    assert.match(drawer, /fetch\('\/api\/sites'/)
    // The delete IS direct, as the person — the trigger is what decides (migration 082).
    assert.match(drawer, /from\('entities'\)\.delete\(\)/)
    assert.match(drawer, /rpc\('site_removal_refusal'/)
  })
})
