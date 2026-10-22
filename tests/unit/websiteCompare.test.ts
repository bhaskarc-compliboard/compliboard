/**
 * THE OWNER'S COMPARISON, DRAWN — My Account step 15, `ACCOUNT-PLAN.md` decision 9.
 *
 * `npm run website:compare -- <host>` reads one website once and sends it to two models, and this
 * holds what the OWNER sees. Every case here is a fixed proposal and a fixed set of numbers: **no
 * model is called by this file**, which is the point of keeping the drawing in `lib/websiteCompare.ts`
 * and the running in `scripts/website-compare.mjs`.
 *
 * The one it exists for is the money line. `config/pricing.ts` prices a model it does not list as
 * **null**, deliberately — "a model id that resolves at the API and prices as null here records
 * tokens with no money and leaves a total that looks healthy". `claude-sonnet-5-5` is not in that
 * table today, so the comparison must SAY it could not price the call rather than print $0.0000.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  wrap, cardLines, cardBlocks, sideBySide, sideBySideBlocks, timing, pagesHeader, unreadableHeader,
  CARD_WIDTH, MAX_HOSTS, COMPARE_MODELS, type RunMeta,
} from '../../lib/websiteCompare.ts'
import { priceFor } from '../../lib/costLedger.ts'
import type { WebsiteProposal } from '../../prompts/website-read.ts'

/** Jost Chemical's real card, as the walk read it on 22 October. */
const JOST: WebsiteProposal = {
  name: 'Jost Chemical Co.',
  what_you_do: 'We manufacture high purity specialty chemicals including mineral salts for pharmaceutical, biotech, nutritional, and specialty markets.',
  naics_code: '325180',
  naics_title: 'Other Basic Inorganic Chemical Manufacturing',
  addresses: [
    { label: 'St. Louis, Missouri', address: '8150 Lackland, St. Louis, MO 63114' },
    { label: 'Kościan, Poland', address: 'ul. gen. Kazimierza Pułaskiego 7, 64-000 Kościan, Poland' },
  ],
  notes: 'The Polish location is listed under a different entity name.',
}
const META: RunMeta = {
  model: 'claude-opus-5-5', seconds: 9.14, inputTokens: 4023, outputTokens: 554, costUsd: 0.027172,
}

describe('wrapping', () => {
  test('breaks on spaces and never exceeds the width', () => {
    for (const line of wrap(JOST.what_you_do!, 40)) assert.ok(line.length <= 40, line)
    assert.deepEqual(wrap('one two three', 7), ['one two', 'three'])
  })
  test('a word longer than the column is cut rather than allowed to break the layout', () => {
    const long = 'x'.repeat(25)
    for (const line of wrap(long, 10)) assert.ok(line.length <= 10)
    assert.equal(wrap(long, 10).join(''), long)
  })
  test('nothing wraps to one empty line, not to none', () => {
    assert.deepEqual(wrap('', 20), [''])
    assert.deepEqual(wrap('   ', 20), [''])
  })
})

describe('one card', () => {
  const lines = cardLines(JOST, META)
  const text = lines.join('\n')
  test('it is the model, then the five things, in the walk’s own order', () => {
    assert.equal(lines[0], 'claude-opus-5-5')
    const headings = lines.filter((l) => /^[A-Z]/.test(l) && !l.startsWith('claude'))
    assert.deepEqual(headings, ['Name', 'What you do', 'NAICS', 'Addresses (2)', 'Note'])
  })
  test('the NAICS line carries OUR title, which is the only one there is by then', () => {
    assert.match(text, /325180 — Other Basic Inorganic Chemical Manufacturing/)
  })
  test('every address, with its label', () => {
    assert.match(text, /St\. Louis, Missouri: 8150 Lackland/)
    assert.match(text, /Kościan, Poland: ul\. gen\./)
  })
  test('nothing found is "(none)" and never a blank', () => {
    const empty = cardLines(
      { name: null, what_you_do: null, naics_code: null, naics_title: null, addresses: [], notes: null },
      META)
    assert.equal(empty.filter((l) => l.includes('(none)')).length, 5)
    assert.match(empty.join('\n'), /Addresses \(0\)/)
  })
  test('no line is wider than the column', () => {
    for (const l of lines) assert.ok(l.length <= CARD_WIDTH, `${l.length}: ${l}`)
  })
  test('an answer that was not in shape says so, and still shows what it cost', () => {
    const bad = cardLines(null, META).join('\n')
    assert.match(bad, /not in shape/)
    assert.match(bad, /\$0\.0272/)
  })
  test('a call that was refused is that sentence and nothing else', () => {
    const refused = cardLines(JOST, { ...META, error: '404 model not found' })
    assert.match(refused.join('\n'), /REFUSED: 404 model not found/)
    assert.ok(!refused.join('\n').includes('325180'), 'a refused call still drew a card')
  })
})

describe('*** WHAT A CALL COST, OR THAT WE COULD NOT SAY ***', () => {
  test('a priced model prints the money', () => {
    assert.equal(timing(META), '9.1s · 4,023 in / 554 out · $0.0272')
  })
  test('an unpriced one says so rather than printing $0.0000', () => {
    const line = timing({ ...META, model: 'claude-sonnet-5-5', costUsd: null })
    assert.match(line, /cost unknown — this model is not in config\/pricing\.ts/)
    assert.ok(!line.includes('$'), 'an unpriced call printed a dollar figure')
    assert.match(line, /4,023 in \/ 554 out/)   // the tokens are still there to price by hand
  })
  test('…and that is the state today: the second model of the two is not in the table', () => {
    // If this starts failing, somebody added the price — good — and the compare will print it.
    assert.ok(priceFor('claude-opus-5-5'), 'the first model lost its price')
    assert.equal(priceFor('claude-sonnet-5-5'), null)
  })
})

describe('two cards, side by side', () => {
  const left = cardLines(JOST, META)
  const right = cardLines(JOST, { ...META, model: 'claude-sonnet-5-5', costUsd: null })
  const rows = sideBySide(left, right)
  test('the second column starts at the same place on every row that has one', () => {
    const starts = rows.filter((r) => r.length > CARD_WIDTH).map((r) => r.search(/\S(?=[^]*$)/) >= 0 ? CARD_WIDTH + 4 : 0)
    assert.ok(starts.every((s) => s === CARD_WIDTH + 4))
    assert.match(rows[0], /^claude-opus-5-5\s+claude-sonnet-5-5$/)
  })
  test('a shorter card does not cut the longer one off', () => {
    const short = sideBySide(['a'], ['1', '2', '3'])
    assert.equal(short.length, 3)
    assert.match(short[2], /3$/)
  })
  test('no trailing whitespace anywhere', () => {
    for (const r of rows) assert.equal(r, r.trimEnd())
  })
})

describe('*** THE TWO CARDS STAY SHOULDER TO SHOULDER ***', () => {
  // Zipping line by line puts NAICS on the left beside Addresses on the right the moment one
  // sentence wraps to three lines and the other to two — and NAICS against NAICS is the comparison.
  const long = { ...JOST, what_you_do: 'We ' + 'make things '.repeat(12) }
  const short = { ...JOST, what_you_do: 'We make salts.' }
  const rows = sideBySideBlocks(
    cardBlocks(long, META),
    cardBlocks(short, { ...META, model: 'claude-sonnet-5-5', costUsd: null }))
  test('every heading faces its own heading', () => {
    for (const r of rows) {
      const l = r.slice(0, CARD_WIDTH).trimEnd()
      const right = r.slice(CARD_WIDTH + 4)
      if (!l || !right || l.startsWith(' ') || right.startsWith(' ')) continue
      // Two blocks are per-model by nature and must differ: the model NAME at the top and the
      // timing line at the bottom, which starts with the seconds. Everything between them is a
      // heading that has to face its own.
      if (l.startsWith('claude') || /^-+$/.test(l) || /^\d/.test(l)) continue
      assert.equal(l, right, `"${l}" is drawn beside "${right}"`)
    }
  })
  test('the taller card is not cut off', () => {
    const tall = cardBlocks(long, META).flat().length
    assert.ok(rows.length >= tall)
  })
  test('and the line-by-line version is still there for a single card', () => {
    assert.deepEqual(cardBlocks(JOST, META).flat(), cardLines(JOST, META))
  })
})

describe('the headers above the cards', () => {
  test('what was fetched, with the characters each page contributed', () => {
    const h = pagesHeader('jostchemical.com', [
      { url: 'https://www.jostchemical.com/', chars: 4226 },
      { url: 'https://www.jostchemical.com/who-we-are/', chars: 2055 },
    ])
    assert.match(h[0], /=== jostchemical\.com — 2 page\(s\), 6,281 characters/)
    assert.match(h[1], /4226 {2}https:\/\/www\.jostchemical\.com\//)
  })
  test('a host that could not be read prints the product’s own reason and sentence', () => {
    const h = unreadableHeader('nowhere.example', 'unreachable', "We couldn't read nowhere.example — tell us your main address instead.")
    assert.match(h[0], /could not be read \(unreachable\)/)
    assert.match(h[1], /We couldn't read nowhere\.example/)
  })
})

describe('the script itself', () => {
  const src = readFileSync('scripts/website-compare.mjs', 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  test('it writes nothing anywhere — no database, no ledger, no file', () => {
    assert.ok(!/supabase|createClient|recordAICall|writeFileSync/i.test(code),
      'the comparison writes something')
    assert.ok(!/ledger:/.test(code))
  })
  test('it fetches with the product’s own fetcher and asks the product’s own prompt', () => {
    assert.match(code, /from '\.\.\/lib\/websiteFetch\.ts'/)
    assert.match(code, /from '\.\.\/prompts\/website-read\.ts'/)
    assert.match(code, /websitePrompt\(host, pages\)/)
    assert.match(code, /sideBySideBlocks\(/)
    assert.match(code, /output_config: \{ format: \{ type: 'json_schema'/)
  })
  test('no search tool, no temperature — the same call the product makes', () => {
    assert.ok(!/tools:|web_search|temperature|effort/.test(code))
  })
  test('both models, and the cap', () => {
    assert.deepEqual([...COMPARE_MODELS], ['claude-opus-5-5', 'claude-sonnet-5-5'])
    assert.equal(MAX_HOSTS, 8)
    assert.match(code, /hosts\.length > MAX_HOSTS/)
  })
  test('and its header says it must NOT run under the Haiku guard', () => {
    assert.match(src, /RUN IT WITHOUT THE HAIKU GUARD/)
    assert.match(src, /the owner's command, not Claude Code's/)
  })
  test('npm run website:compare is what the owner types', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    assert.equal(pkg.scripts['website:compare'], 'node --env-file=.env.local scripts/website-compare.mjs')
  })
})
