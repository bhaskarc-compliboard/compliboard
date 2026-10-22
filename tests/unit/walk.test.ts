/**
 * THE WALK — board 7, My Account step 14, `ACCOUNT-PLAN.md` decision 10.
 *
 * Four things, and the third is the one the whole step turns on:
 *
 *   1. **The words are board 7's**, asserted against `docs/account-boards.html` itself rather than
 *      against my typing, exactly as step 12 did for board 6.
 *   2. **The screen a person is on** — reading → found or ask, forty seconds and no longer, and a
 *      skip from every one of the three.
 *   3. **"Yes, that's us" saves THE FIELDS, not the proposal**, in an order that can be read.
 *      `planSaves` takes what is in the boxes and returns the steps; a test can therefore prove
 *      that an edited sentence is what would be written and that `accept` comes last.
 *   4. **Nothing is written by the page itself**: every save goes through the route that owns its
 *      table, which is checked against the source.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  WALK_PATH, SKIP, FOUND_TITLE, foundLede, CONFIRM, ASK_TITLE, ASK_LEDE, ADDRESS_LABEL,
  ADDRESS_PLACEHOLDER, ADDRESS_HINT, CONTINUE, DONE_TITLE, DONE_LEDE, DONE_BUTTON,
  couldNotRead, readingLine, firstScreen, askNotice, stepsDone, planSaves, questionsDone,
  siteNameFor, WALK_QUESTIONS, POLL_UP_TO_MS, POLL_EVERY_MS, ADD_AS_SITE,
  type ConfirmFields,
} from '../../lib/walkView.ts'
import { QUESTIONS_PER_DAY, SKIP_WORD } from '../../lib/dashboardView.ts'

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const PAGE = readFileSync('app/walk/page.tsx', 'utf8')
const ACCEPT = readFileSync('app/api/website-read/accept/route.ts', 'utf8')
const BOARDS = readFileSync('docs/account-boards.html', 'utf8')
/** Board 7 alone — from `id="b7"` to the next board. */
const BOARD7 = BOARDS.slice(BOARDS.indexOf('id="b7"')).split('<!-- =====================')[0]

describe('the words are board 7’s, not this file’s', () => {
  test('board 7 sliced out, and it is the walk', () => {
    assert.ok(BOARD7.includes('7 · The onboarding walk, three screens'))
    assert.ok(!BOARD7.includes('id="b8"'), 'the slice ran on into board 8')
  })
  for (const [name, word] of [
    ['screen 1’s title', FOUND_TITLE],
    ['the confirm button', CONFIRM],
    ['the address screen’s title', ASK_TITLE],
    ['its lede', ASK_LEDE],
    ['its label', ADDRESS_LABEL],
    ['its placeholder', ADDRESS_PLACEHOLDER],
    ['its hint', ADDRESS_HINT],
    ['its button', CONTINUE],
    ['screen 3’s title', DONE_TITLE],
    ['screen 3’s lede', DONE_LEDE],
    ['screen 3’s button', DONE_BUTTON],
  ] as const) {
    test(`${name} is drawn on the board`, () => {
      assert.ok(BOARD7.includes(word), `board 7 does not say ${JSON.stringify(word)}`)
    })
  }
  test('the lede is the board’s sentence with the real host in it', () => {
    assert.equal(foundLede('willamettevinegar.com'),
      "From willamettevinegar.com. Fix anything that's wrong, then confirm.")
    assert.ok(BOARD7.includes(foundLede('willamettevinegar.com')))
  })
  test('screen 2 is the Dashboard’s card: its skip word, and three questions', () => {
    assert.ok(BOARD7.includes(SKIP_WORD), 'board 7 does not carry the Dashboard’s skip')
    assert.ok(BOARD7.includes('1 of 3'))
    assert.equal(WALK_QUESTIONS, QUESTIONS_PER_DAY)
    assert.equal(WALK_QUESTIONS, 3)
  })
  test('the page shows them all and keeps none of its own', () => {
    // `code(PAGE)`: the header paragraph quotes "Skip for now" to say what it is, and a comment
    // naming a word is not a second copy of it — the lesson from the step 12 tests.
    const src = code(PAGE)
    for (const word of [FOUND_TITLE, ASK_TITLE, DONE_TITLE, DONE_BUTTON, CONFIRM, SKIP]) {
      assert.ok(!src.includes(`"${word}"`) && !src.includes(`'${word}'`),
        `the page carries its own copy of ${JSON.stringify(word)}`)
    }
    assert.match(code(PAGE), /from '@\/lib\/walkView'/)
  })
})

describe('which face screen 1 shows', () => {
  test('a proposal is a card; nothing else is', () => {
    assert.equal(firstScreen('ready', 0), 'found')
    assert.equal(firstScreen('failed', 0), 'ask')
    assert.equal(firstScreen('none', 0), 'ask')
  })
  test('a read in flight waits, for forty seconds and not a second more', () => {
    assert.equal(firstScreen('reading', 0), 'waiting')
    assert.equal(firstScreen('reading', POLL_EVERY_MS), 'waiting')
    assert.equal(firstScreen('reading', POLL_UP_TO_MS - 1), 'waiting')
    // *** AND THEN IT IS THE ADDRESS SCREEN. *** A row still `reading` after forty seconds means
    // something the route could not record went wrong; a person is not made to care about that.
    assert.equal(firstScreen('reading', POLL_UP_TO_MS), 'ask')
    assert.equal(firstScreen('reading', 10 * POLL_UP_TO_MS), 'ask')
  })
  test('the sentence names the host when we tried, and says nothing when we did not', () => {
    assert.equal(askNotice('failed', 'willamettevinegar.com', 0),
      "We couldn't read willamettevinegar.com — tell us your main address instead.")
    assert.equal(askNotice('reading', 'a.com', POLL_UP_TO_MS), couldNotRead('a.com'))
    // No website was ever given: there is nothing to apologise for.
    assert.equal(askNotice('none', null, 0), null)
    assert.equal(askNotice('none', 'a.com', 0), null)
    // And nothing is said while it is still being read, or on the card.
    assert.equal(askNotice('reading', 'a.com', 0), null)
    assert.equal(askNotice('ready', 'a.com', 0), null)
  })
  test('the three dots fill as the person moves', () => {
    assert.deepEqual(stepsDone(1), [true, false, false])
    assert.deepEqual(stepsDone(2), [true, true, false])
    assert.deepEqual(stepsDone(3), [true, true, true])
  })
})

describe('the three questions end, one way or another', () => {
  test('after three', () => {
    assert.equal(questionsDone(0, true), false)
    assert.equal(questionsDone(2, true), false)
    assert.equal(questionsDone(3, true), true)
  })
  test('…or when there is nothing left to ask, however few were answered', () => {
    assert.equal(questionsDone(0, false), true)
    assert.equal(questionsDone(1, false), true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────

const FIELDS: ConfirmFields = {
  whatYouDo: 'We manufacture high purity specialty chemicals.',
  naicsCode: '325180',
  mainAddress: '8150 Lackland, St. Louis, MO 63114',
  mainSite: { id: 'site-1', name: 'Jost Chemical Co.' },
  others: [{ place: { label: 'Kościan, Poland', address: 'ul. Pułaskiego 7, Kościan' }, add: true }],
}

describe('*** "YES, THAT’S US" SAVES THE FIELDS, NOT THE PROPOSAL ***', () => {
  test('the order: the company, the main site, the others, and accept last', () => {
    assert.deepEqual(planSaves(FIELDS).map((s) => s.kind),
      ['company', 'main-site', 'new-site', 'accept'])
  })
  test('an EDITED sentence is what would be written', () => {
    const edited = { ...FIELDS, whatYouDo: 'We manufacture high purity mineral salts.' }
    const step = planSaves(edited)[0]
    assert.equal(step.kind, 'company')
    assert.equal(step.kind === 'company' && step.what_you_do, 'We manufacture high purity mineral salts.')
  })
  test('an unticked location is not saved', () => {
    const unticked = { ...FIELDS, others: [{ ...FIELDS.others[0], add: false }] }
    assert.deepEqual(planSaves(unticked).map((s) => s.kind), ['company', 'main-site', 'accept'])
  })
  test('the main site is PATCHED by id, with the name it already has', () => {
    const step = planSaves(FIELDS)[1]
    assert.equal(step.kind, 'main-site')
    if (step.kind === 'main-site') {
      assert.equal(step.id, 'site-1')
      assert.equal(step.name, 'Jost Chemical Co.')
      assert.equal(step.address, '8150 Lackland, St. Louis, MO 63114')
    }
  })
  test('nothing to say means no company write at all', () => {
    const empty = { ...FIELDS, whatYouDo: '   ', naicsCode: null }
    assert.deepEqual(planSaves(empty).map((s) => s.kind), ['main-site', 'new-site', 'accept'])
  })
  test('a code with no words is still a code worth keeping', () => {
    const codeOnly = { ...FIELDS, whatYouDo: '' }
    const step = planSaves(codeOnly)[0]
    assert.equal(step.kind === 'company' && step.what_you_do, null)
    assert.equal(step.kind === 'company' && step.naics_code, '325180')
  })
  test('no main site, or no address, and there is nothing to patch', () => {
    assert.deepEqual(planSaves({ ...FIELDS, mainSite: null }).map((s) => s.kind),
      ['company', 'new-site', 'accept'])
    assert.deepEqual(planSaves({ ...FIELDS, mainAddress: '  ' }).map((s) => s.kind),
      ['company', 'new-site', 'accept'])
  })
  test('accept is ALWAYS last and always there — a confirmation is a fact about the person', () => {
    for (const f of [FIELDS, { ...FIELDS, whatYouDo: '', naicsCode: null, mainAddress: '', others: [] }]) {
      const steps = planSaves(f)
      assert.equal(steps[steps.length - 1].kind, 'accept')
    }
  })
  test('a second location needs a name, and gets one that is the customer’s own words', () => {
    assert.equal(siteNameFor({ label: 'Portland plant', address: '1 Main St, Portland' }), 'Portland plant')
    // `/api/sites` refuses a site with no name, so the first part of the address is the fallback.
    assert.equal(siteNameFor({ label: null, address: '1 Main St, Portland, OR' }), '1 Main St')
    assert.equal(siteNameFor({ label: '  ', address: 'Somewhere' }), 'Somewhere')
  })
})

describe('the walk writes nothing of its own', () => {
  const src = code(PAGE)
  test('every address goes through /api/sites, and `entities` is only read', () => {
    assert.ok(!/from\('entities'\)[\s\S]{0,120}\.(insert|update|delete)\(/.test(src),
      'the walk writes entities itself instead of through the route that geocodes')
    assert.match(src, /fetch\('\/api\/sites'/)
  })
  test('every answer goes through /api/switches/answer, by way of postSwitchAnswer', () => {
    assert.match(src, /postSwitchAnswer\(\{ switch_id: current\.switch_id/)
    assert.ok(!/from\('company_switches'\)/.test(src))
    assert.ok(!/from\('switch_determinations'\)/.test(src))
  })
  test('the company write is the Company tab’s two columns and no more', () => {
    const update = src.match(/from\('companies'\)\s*\n?\s*\.update\(\{([^}]*)\}\)/)
    assert.ok(update, 'the walk does not update companies at all')
    const keys = update[1].split(',').map((k) => k.split(':')[0].trim()).filter(Boolean).sort()
    assert.deepEqual(keys, ['naics_code', 'what_you_do'])
  })
  test('the company NAME is drawn and never sent', () => {
    assert.ok(!/name: *proposal\.name|name: *\w*[Nn]ame[,}]/.test(src.replace(/step\.name/g, '')),
      'the walk sends a company name somewhere')
    assert.match(PAGE, /COMPANY_NAME_NOTE/)
  })
  test('it reuses the shared control rather than drawing its own', () => {
    assert.match(src, /from '@\/components\/SwitchAnswerControl'/)
    assert.match(src, /from '@\/components\/NaicsField'/)
    assert.ok(!/allowed_value_labels/.test(src), 'the walk re-implements the option buttons')
  })
  test('and there is a way out of every screen', () => {
    // Three: the waiting/card screen, the address screen, and the questions.
    assert.ok((src.match(/\{SKIP\}/g) ?? []).length >= 3, 'a screen has no "Skip for now"')
    assert.match(src, /onClick=\{\(\) => setScreen\(2\)\}/)
  })
})

describe('accept stamps one row, and cannot be pointed at another', () => {
  const src = code(ACCEPT)
  test('it takes no id: the row is found from the verified token’s company', () => {
    assert.ok(!/request\.json\(\)/.test(src), 'the accept route reads a body')
    assert.match(src, /requireCompany\(request\)/)
    assert.match(src, /\.eq\('company_id', companyId\)/)
  })
  test('only a `ready` row, and only one that has not been stamped', () => {
    assert.match(src, /read\.status !== 'ready'/)
    assert.match(src, /\.eq\('status', 'ready'\)/)
    assert.match(src, /\.is\('accepted_at', null\)/)
  })
  test('a second press is not an error — the first moment stands', () => {
    assert.match(src, /if \(read\.accepted_at\) return/)
  })
  test('it writes accepted_at and nothing else', () => {
    const updates = [...src.matchAll(/\.update\(\{([^}]*)\}\)/g)].map((m) => m[1].trim())
    assert.deepEqual(updates, ['accepted_at: at'])
  })
})

describe('the shared control was widened, not changed', () => {
  const field = readFileSync('components/NaicsField.tsx', 'utf8')
  const account = code(readFileSync('app/account/page.tsx', 'utf8'))
  test('the Company tab now uses it, and draws exactly what it drew before', () => {
    assert.match(account, /<NaicsField/)
    // `showCode` is the walk's line and the tab does not pass it.
    assert.ok(!/showCode/.test(account), 'the Company tab gained a line it never had')
    assert.match(field, /showCode = false/)
  })
  test('the rule a copy would have got wrong is in one place now', () => {
    // Typing clears a PICKED code — decision 3. The Company tab takes the default and keeps it.
    assert.match(field, /if \(clearOnType\) onPick\(null\)/)
    assert.match(field, /clearOnType = true/)
    assert.ok(!/clearOnType/.test(account), 'the Company tab now passes the flag, so it changed')
    assert.ok(!/suggestNaics\(/.test(account), 'the Company tab still has its own copy')
  })

  /**
   * …and the walk turns it off, because its code came from the website read rather than from a
   * suggestion the person picked: changing one word of the sentence must not silently drop a
   * classification they were shown and agreed with. It is only off where the code is DRAWN, with
   * a `clear` beside it, so nothing is kept that cannot be seen and removed.
   */
  test('the walk keeps the proposed code, and shows it', () => {
    const walk = code(PAGE)
    assert.match(walk, /showCode clearOnType=\{false\}/)
    assert.match(field, /showCode && picked/)
  })
})

describe('signup lands on the walk', () => {
  const page = code(readFileSync('app/signup/page.tsx', 'utf8'))
  test('WALK_PATH, imported rather than typed', () => {
    assert.equal(WALK_PATH, '/walk')
    assert.match(page, /import \{ WALK_PATH \} from '@\/lib\/walkView'/)
    assert.match(page, /router\.push\(WALK_PATH\)/)
  })
  test('the Dashboard is still where the walk ENDS', () => {
    assert.match(code(PAGE), /router\.push\(DASHBOARD_PATH\)/)
  })
  test('and welcomed_at is still the Dashboard’s to stamp', () => {
    assert.ok(!/welcomed_at/.test(code(PAGE)), 'the walk stamps the welcome')
    assert.match(readFileSync('app/dashboard/page.tsx', 'utf8'), /welcomed_at: new Date/)
  })
})
