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
  couldNotRead, readingLine, firstScreen, askNotice, stepsDone, planSaves,
  walkQuestions, walkCounter, walkDone, categoryLine, categoryAction, sentenceRows,
  CATEGORY_LABEL, CATEGORY_NONE, CATEGORY_CHANGE, CATEGORY_PICK,
  SENTENCE_MIN_ROWS, SENTENCE_MAX_ROWS, SENTENCE_COLS,
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

describe('*** EXACTLY THREE QUESTIONS, WHATEVER THE ANSWERS ARE — the owner\u2019s second finding ***', () => {
  /**
   * The walk used to end when three had been ANSWERED, which is the Dashboard's rule: a skip is
   * not an answer there, because the card goes quiet for the day and the question returns
   * tomorrow. In a walk it meant "I don't know yet" cost nothing and handed over the next of the
   * twenty-odd company-scope switches, for ever — the owner reached a SIXTH question still
   * labelled "3 of 3". The list is now taken once and the counter is the position in it.
   */
  const twenty = Array.from({ length: 20 }, (_, i) => ({ switch_id: `s${i}` }))

  test('three are taken from however many are askable', () => {
    assert.equal(walkQuestions(twenty).length, 3)
    assert.deepEqual(walkQuestions(twenty).map((q) => q.switch_id), ['s0', 's1', 's2'])
    assert.equal(WALK_QUESTIONS, 3)
  })
  test('fewer than three asks what there is, and says so', () => {
    assert.equal(walkQuestions(twenty.slice(0, 2)).length, 2)
    assert.equal(walkCounter(0, 2), '1 of 2')
    assert.equal(walkQuestions([]).length, 0)
    assert.equal(walkDone(0, 0), true, 'nothing to ask must end the screen, not hang it')
  })
  test('the counter is the POSITION, so it reads the same whether a question was answered or skipped', () => {
    assert.equal(walkCounter(0, 3), '1 of 3')
    assert.equal(walkCounter(1, 3), '2 of 3')
    assert.equal(walkCounter(2, 3), '3 of 3')
    // …and it cannot run past the end, which is the shape the owner saw on the sixth question.
    assert.equal(walkCounter(5, 3), '3 of 3')
  })
  test('three uses end the screen, by any mixture of answers and skips', () => {
    for (let used = 0; used < 3; used++) assert.equal(walkDone(used, 3), false, `${used} used`)
    assert.equal(walkDone(3, 3), true)
    assert.equal(walkDone(4, 3), true)
  })
  test('the Dashboard\u2019s own rules are NOT what the walk uses any more', () => {
    const walk = code(PAGE)
    assert.ok(!/questionsDone|nextQuestion|cardNumber/.test(walk),
      'the walk still borrows a Dashboard rule that counts answers rather than questions')
    assert.match(walk, /walkQuestions\(askableHere\(/)
    assert.match(walk, /walkCounter\(at, total\)/)
    // One fetch, when the screen opens, and never again: a re-fetch is what made the list move.
    const questions = walk.slice(walk.indexOf('function Questions'))
    assert.equal((questions.match(/fetch\('\/api\/switches\/ask'/g) ?? []).length, 1)
  })
  test('a skip writes nothing and still uses one of the three', () => {
    const walk = code(PAGE)
    const skip = walk.slice(walk.indexOf('{SKIP_WORD}') - 400, walk.indexOf('{SKIP_WORD}'))
    assert.match(skip, /setAt\(\(i\) => i \+ 1\)/)
    assert.ok(!/postSwitchAnswer/.test(skip), 'the skip writes an answer')
  })
})

describe('*** THE SENTENCE IS SHOWN WHOLE — the owner\u2019s first finding ***', () => {
  test('the box grows from two lines to four', () => {
    assert.equal(sentenceRows(''), SENTENCE_MIN_ROWS)
    assert.equal(sentenceRows('We make soap.'), 2)
    // The real one: 134 characters, which ran off a single-line box.
    const real = 'We manufacture high purity specialty chemicals including mineral salts for pharmaceutical, biotech, nutritional, and specialty markets.'
    assert.ok(real.length > SENTENCE_COLS * 2)
    assert.equal(sentenceRows(real), 3)
    assert.equal(sentenceRows('x'.repeat(1000)), SENTENCE_MAX_ROWS)
  })
  test('every row of the real sentence fits in the box', () => {
    const real = 'We manufacture high purity specialty chemicals including mineral salts for pharmaceutical, biotech, nutritional, and specialty markets.'
    assert.ok(sentenceRows(real) * SENTENCE_COLS >= real.length,
      'the box is smaller than the sentence it is meant to show')
  })
  test('it is a textarea now, not an input', () => {
    const walk = code(PAGE)
    assert.match(walk, /<textarea id="walk-what"/)
    assert.match(walk, /rows=\{sentenceRows\(whatDraft\)\}/)
    assert.ok(!/<input id="walk-what"/.test(walk))
  })
})

describe('*** THE CATEGORY IN WORDS, NOT A CODE ***', () => {
  test('with a suggestion: the title, then the code in brackets', () => {
    assert.equal(categoryLine('325180', 'Other Basic Inorganic Chemical Manufacturing'),
      'Closest standard category: Other Basic Inorganic Chemical Manufacturing (325180)')
    assert.equal(categoryAction('325180'), CATEGORY_CHANGE)
  })
  test('with none: "none yet", and the word beside it starts rather than changes', () => {
    assert.equal(categoryLine(null, null), `${CATEGORY_LABEL}: ${CATEGORY_NONE}`)
    assert.equal(categoryLine(null, 'ignored'), `${CATEGORY_LABEL}: ${CATEGORY_NONE}`)
    assert.equal(categoryAction(null), CATEGORY_PICK)
  })
  test('a code we hold no title for still says something true', () => {
    assert.equal(categoryLine('999999', null), `${CATEGORY_LABEL}: ${CATEGORY_NONE} (999999)`)
    assert.equal(categoryLine('999999', '  '), `${CATEGORY_LABEL}: ${CATEGORY_NONE} (999999)`)
  })
  test('the title drawn is OURS, looked up from the code', () => {
    const walk = code(PAGE)
    assert.match(walk, /NAICS_TITLES\.find\(\(t\) => t\.code === pickedCode\)/)
    assert.match(walk, /categoryLine\(pickedCode, categoryTitle\)/)
  })
  test('the picker is the shared control, over its OWN box, and never touches the sentence', () => {
    const walk = code(PAGE)
    assert.match(walk, /value=\{categoryDraft\} onValue=\{setCategoryDraft\}/)
    // The sentence is `whatDraft`; the picker must not be wired to it.
    const picker = walk.slice(walk.indexOf('{picking ?'), walk.indexOf('categoryLine('))
    assert.ok(!/whatDraft/.test(picker.replace(/setCategoryDraft\(whatDraft[^)]*\)/g, '')),
      'the picker writes into the sentence')
  })
  test('picking one closes the picker; what is saved is still naics_code', () => {
    const walk = code(PAGE)
    assert.match(walk, /if \(code\) setPicking\(false\)/)
    assert.match(walk, /naicsCode: pickedCode/)
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

describe('*** A GEOCODER MISS IS NOT A REFUSAL — found on the step 15 walk ***', () => {
  /**
   * Jost Chemical's second site is in Poland and the Census Bureau's geocoder is American, so it
   * answered "no match" — and the walk, which treated any sentence as a reason not to move on,
   * left the person on screen 1 with "We could not find that address" and no way forward but to
   * untick a site that had in fact been saved. The MAIN site still pauses (it is the address 083
   * mirrors and `lib/jurisdiction.ts` resolves against); any other site does not.
   */
  const src = code(PAGE)
  test('the two outcomes are told apart at the route\u2019s own answer', () => {
    assert.match(src, /Promise<\{ failed\?: string; missed\?: string \}>/)
    assert.match(src, /if \(!res\.ok\) return \{ failed:/)
    assert.match(src, /matched === false \? \{ missed:/)
  })
  test('the main site pauses on a miss; a second site does not', () => {
    // `lastIndexOf` for the new-site branch: the line that builds the retry key mentions it first.
    const main = src.slice(src.indexOf("step.kind === 'main-site'"), src.lastIndexOf("step.kind === 'new-site'"))
    const extra = src.slice(src.lastIndexOf("step.kind === 'new-site'"))
    assert.match(main, /if \(r\.missed\) \{ stop\.push\(r\.missed\); continue \}/)
    assert.ok(!/r\.missed/.test(extra.slice(0, extra.indexOf('saved.current.add'))),
      'a second site that could not be placed still holds the walk up')
    // Both still stop on a real refusal.
    assert.equal((src.match(/if \(r\.failed\) \{ stop\.push\(r\.failed\); continue \}/g) ?? []).length, 2)
  })
  test('and the address screen keeps the pause, because that IS the main site', () => {
    assert.match(src, /const s = r\.failed \?\? r\.missed/)
  })
  test('a second press does not write anything twice', () => {
    assert.match(src, /saved\.current\.has\(key\)/)
    assert.match(src, /saved\.current\.add\(key\)/)
    // Keyed by address for a new site: two different second sites are two different writes.
    assert.match(src, /`new:\$\{step\.address\}`/)
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
    // The control has one shape again: a box, its suggestions, and "Keep what you typed". Nothing
    // in it is conditional on which screen is drawing it, which is where step 14 had drifted.
    assert.ok(!/showCode|clearOnType/.test(code(field)), 'the control still branches by screen')
    assert.match(field, /suggestions\.length > 0/)
  })
  test('the rule a copy would have got wrong is in one place now', () => {
    // Typing clears a PICKED code — decision 3. The Company tab takes the default and keeps it.
    assert.match(field, /onPick\(null\) {2,}\/\/ the words are theirs again/)
    assert.ok(!/suggestNaics\(/.test(account), 'the Company tab still has its own copy')
  })

  /**
   * *** AND AT STEP 15 THE THREE PROPS STEP 14 ADDED WENT. *** The walk's sentence is a textarea
   * and its category is a line of words with its own `change` link, so the control is opened over
   * a SEARCH box of the walk's own. Editing the sentence cannot touch the code, because they are
   * no longer the same field — which is what `clearOnType` existed to work around — and nothing
   * reads `picked` any more. A prop nothing passes is a claim nothing checks.
   */
  test('and the props step 14 added are gone, because nothing passes them', () => {
    const walk = code(PAGE)
    const fieldCode = code(field)
    for (const prop of ['showCode', 'clearOnType', 'picked']) {
      assert.ok(!fieldCode.includes(prop), `${prop} survives in the shared control`)
      assert.ok(!walk.includes(`${prop}=`), `the walk still passes ${prop}`)
      assert.ok(!account.includes(`${prop}=`), `the Company tab now passes ${prop}`)
    }
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
