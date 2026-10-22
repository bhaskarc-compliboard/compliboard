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
import { readFileSync, existsSync } from 'node:fs'
import {
  WALK_PATH, SKIP, FOUND_TITLE, foundLede, CONFIRM, ASK_TITLE, ASK_LEDE, ADDRESS_LABEL,
  ADDRESS_PLACEHOLDER, ADDRESS_HINT, CONTINUE, DONE_TITLE, DONE_LEDE, DONE_BUTTON,
  couldNotRead, readingLine, firstScreen, askNotice, stepsDone, planSaves,
  walkQuestions, walkCounter, walkDone, sentenceRows,
  WHAT_YOU_DO_LINE, INDUSTRY_LINE, CHANGE, DONE, WRITE_HINT, WRITE_IT, lineAction,
  SENTENCE_MIN_ROWS, SENTENCE_MAX_ROWS, SENTENCE_COLS,
  siteNameFor, WALK_QUESTIONS, POLL_UP_TO_MS, POLL_EVERY_MS, ADD_AS_SITE,
  type ConfirmFields,
} from '../../lib/walkView.ts'
import { QUESTIONS_PER_DAY, SKIP_WORD } from '../../lib/dashboardView.ts'
import {
  INDUSTRIES, INDUSTRY_ROLES, industryLine, parseProposal, WEBSITE_JSON_SCHEMA,
} from '../../prompts/website-read.ts'

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
  test('the sentence\u2019s box is a textarea that grows, and it is the only one', () => {
    const walk = code(PAGE)
    assert.match(walk, /rows=\{sentenceRows\(value\)\}/)
    // One textarea in the whole card: the sentence. The industry and the address are one line each.
    assert.equal((walk.match(/<textarea/g) ?? []).length, 1)
  })
})

describe('*** THREE LINES, EACH WITH ITS OWN change — docs/account-walk-card.html ***', () => {
  const board = readFileSync('docs/account-walk-card.html', 'utf8')
  const src = code(PAGE)

  test('the board is where the words come from', () => {
    for (const word of [WHAT_YOU_DO_LINE, INDUSTRY_LINE, CHANGE, DONE, WRITE_IT]) {
      assert.ok(board.includes(word), `the board does not say ${JSON.stringify(word)}`)
    }
    // "Write it in your own words." is the hint under an open box.
    assert.ok(board.includes(WRITE_HINT))
  })

  test('closed, a line offers `change`; empty, it offers `write it`', () => {
    assert.equal(lineAction('Chemical manufacturing and distribution'), CHANGE)
    assert.equal(lineAction(''), WRITE_IT)
    assert.equal(lineAction('   '), WRITE_IT)
  })

  test('only one line is ever open', () => {
    // One piece of state, not three booleans: the board draws one box at a time and says why.
    assert.match(src, /const \[open, setOpen\] = useState<OpenLine>\(null\)/)
    assert.equal((src.match(/open=\{open\} onOpen=\{setOpen\}/g) ?? []).length, 3)
  })

  test('the three lines are the three the board draws, in its order', () => {
    const labels = [...src.matchAll(/label=\{(\w+)\}\s+name="(\w+)"/g)].map((m) => m[2])
    assert.deepEqual(labels, ['about', 'industry', 'address'])
  })

  test('the sentence is the only one that grows', () => {
    const lines = [...src.matchAll(/<Line[\s\S]{0,260}?\/>/g)].map((m) => m[0])
    assert.equal(lines.filter((l) => l.includes('multiline')).length, 1)
    assert.ok(lines[0].includes('multiline'), 'the growing box is not the sentence')
  })

  test('no suggestions anywhere — the control and its list are gone from both doors', () => {
    assert.ok(!/NaicsField|suggestNaics|naicsTitles/.test(src), 'the walk still offers suggestions')
    const account = code(readFileSync('app/account/page.tsx', 'utf8'))
    assert.ok(!/NaicsField|suggestNaics/.test(account), 'the Company tab still offers suggestions')
    assert.ok(!existsSync('components/NaicsField.tsx'), 'the control file survives with no caller')
  })

  test('`Done` closes the box and commits nothing — the card saves on its own button', () => {
    const line = src.slice(src.indexOf('function Line('))
    assert.match(line, /onClick=\{\(\) => onOpen\(null\)\}/)
    assert.ok(!/fetch\(|supabase/.test(line.slice(0, line.indexOf('function '))), 'Done writes something')
  })
})

describe('*** THE INDUSTRY LINE, FROM TWO CLOSED LISTS ***', () => {
  test('the five and the three, and the composed line', () => {
    assert.deepEqual([...INDUSTRIES],
      ['chemical', 'food and beverage', 'cannabis', 'pharmaceutical', 'cosmetics and personal care'])
    assert.deepEqual([...INDUSTRY_ROLES], ['manufacturing', 'distribution', 'manufacturing and distribution'])
    assert.equal(industryLine('chemical', 'manufacturing and distribution'), 'Chemical manufacturing and distribution')
    assert.equal(industryLine('food and beverage', 'distribution'), 'Food and beverage distribution')
  })
  test('an industry outside the five is NOTHING, never the nearest of five', () => {
    for (const bad of ['chemicals', 'chemical manufacturing', 'law', '', '  ', null, undefined, 42]) {
      assert.equal(industryLine(bad as unknown, 'manufacturing'), null, String(bad))
    }
  })
  test('…and the list is closed at the schema, with case tolerated as a second lock', () => {
    // The enum means only the lowercase words can arrive; matching case-insensitively here costs
    // nothing and means a value from somewhere else later cannot fail silently on a capital.
    assert.equal(industryLine('Chemical', 'Manufacturing'), 'Chemical manufacturing')
  })
  test('an industry with no role is the industry alone', () => {
    assert.equal(industryLine('chemical', ''), 'Chemical')
    assert.equal(industryLine('cannabis', 'growing'), 'Cannabis')
  })
  test('the schema closes both, so a half-match cannot arrive', () => {
    const props = (WEBSITE_JSON_SCHEMA as { properties: Record<string, { enum?: string[] }> }).properties
    assert.deepEqual(props.industry.enum, ['', ...INDUSTRIES])
    assert.deepEqual(props.industry_role.enum, ['', ...INDUSTRY_ROLES])
  })
  test('and the parser puts the line on the proposal', () => {
    const p = parseProposal({
      name: '', what_you_do: 'We make soap.', industry: 'chemical', industry_role: 'manufacturing',
      naics_code: '', naics_title: '', addresses: [], notes: '',
    })
    assert.equal(p?.industry, 'Chemical manufacturing')
    const none = parseProposal({
      name: '', what_you_do: 'We give legal advice.', industry: '', industry_role: '',
      naics_code: '', naics_title: '', addresses: [], notes: '',
    })
    assert.equal(none?.industry, null)
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
    assert.deepEqual(keys, ['about', 'what_you_do'])
  })
  test('the company NAME is drawn and never sent', () => {
    assert.ok(!/name: *proposal\.name|name: *\w*[Nn]ame[,}]/.test(src.replace(/step\.name/g, '')),
      'the walk sends a company name somewhere')
    assert.match(PAGE, /COMPANY_NAME_NOTE/)
  })
  test('it reuses the shared control rather than drawing its own', () => {
    assert.match(src, /from '@\/components\/SwitchAnswerControl'/)
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
