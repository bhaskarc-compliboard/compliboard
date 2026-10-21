/**
 * THE NAICS LIST AND ITS SUGGESTIONS — My Account step 6 (`ACCOUNT-PLAN.md` decision 3).
 *
 * The count and the levels are asserted here rather than claimed in a comment, because the one
 * thing a shipped standard list must not do is drift from the standard. 1,012 is the number of
 * six-digit US national industries in the Census Bureau's 2022 NAICS file; if a later edit drops
 * or doubles rows, this fails.
 *
 * The suggestion rules are the product's, not the standard's: at most five, word-prefix only, and
 * **nothing at all when nothing matches** — because a suggestion the typing did not earn is the
 * product putting words in a customer's mouth (`CLAUDE.md` §3.3's shape, applied to a list rather
 * than a model).
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  NAICS_TITLES, suggestNaics, matchWords, keepTypedLabel, SUGGESTION_MAX,
} from '../../lib/naicsTitles.ts'

describe('the list is the standard', () => {
  test('1,012 six-digit US national industries, every one parsed', () => {
    assert.equal(NAICS_TITLES.length, 1012)
    for (const row of NAICS_TITLES) {
      assert.match(row.code, /^\d{6}$/, `bad code ${row.code}`)
      assert.ok(row.title.length > 0, `empty title for ${row.code}`)
      // Whitespace was collapsed when the file was generated; a trailing space would mean a row
      // went in by hand.
      assert.equal(row.title, row.title.trim())
      assert.ok(!/\s{2}/.test(row.title), `double space in ${row.code}`)
    }
  })

  test('no duplicate codes, and the order is the standard\'s own', () => {
    const codes = NAICS_TITLES.map((r) => r.code)
    assert.equal(new Set(codes).size, codes.length)
    assert.deepEqual(codes, [...codes].sort(), 'the file is in code order')
  })

  test('the known rows are the Census Bureau\'s words, letter for letter', () => {
    const find = (code: string) => NAICS_TITLES.find((r) => r.code === code)?.title
    assert.equal(find('111110'), 'Soybean Farming')
    assert.equal(find('325180'), 'Other Basic Inorganic Chemical Manufacturing')
    assert.equal(find('325998'), 'All Other Miscellaneous Chemical Product and Preparation Manufacturing')
    assert.equal(find('928120'), 'International Affairs')
  })

  test('the file names its source and its hash, so the next session can re-derive it', () => {
    const src = readFileSync(new URL('../../lib/naicsTitles.ts', import.meta.url), 'utf8')
    assert.ok(src.includes('census.gov/naics/2022NAICS'), 'the source URL is in the file')
    assert.ok(/sha256 [0-9a-f]{64}/.test(src), 'the downloaded file\'s hash is in the file')
  })
})

describe('suggestions for what a person typed', () => {
  test('at most five, and the best first', () => {
    const r = suggestNaics('paint')
    assert.ok(r.length > 0 && r.length <= SUGGESTION_MAX)
    assert.ok(r.some((x) => x.code === '325510'), 'Paint and Coating Manufacturing is offered')
  })

  test('two typed words beat one — a title matching both ranks above a title matching either', () => {
    const r = suggestNaics('industrial gas')
    assert.equal(r[0].code, '325120')
    assert.equal(r[0].title, 'Industrial Gas Manufacturing')
  })

  test('*** NOTHING MATCHED MEANS NOTHING SHOWN *** — never a sector, never a fallback', () => {
    assert.deepEqual(suggestNaics('xyzzy'), [])
    assert.deepEqual(suggestNaics(''), [])
    assert.deepEqual(suggestNaics('   '), [])
    // Under three letters is not yet a word worth matching: "so" would otherwise hit hundreds.
    assert.deepEqual(suggestNaics('so'), [])
    // And a sentence of nothing but stop words earns nothing.
    assert.deepEqual(suggestNaics('we are the and of'), [])
  })

  test('a word PREFIX matches anywhere in the title, and a bare substring never does', () => {
    // A typed word is found wherever a title's own word begins with it — "soybean" reaches
    // "Soybean Farming" at the front and "Oilseed (except Soybean) Farming" in the middle.
    const soy = suggestNaics('soybean')
    assert.ok(soy.some((r) => r.code === '111110'))
    assert.ok(soy.some((r) => r.code === '111120'), 'a match inside the title counts')
    // And NOT from inside a word: "meth" must not reach "Methanol" or "Methyl" through the middle
    // of one, because a machine guessing from inside a word reads as a machine guessing.
    assert.deepEqual(suggestNaics('meth'), [])
  })

  test('the earliest match wins a tie, so "farm" offers the Farm trades before Soybean Farming', () => {
    // Recorded rather than wished for: every one of these matches exactly one typed word, so the
    // tie breaks on where the match starts. This is the rule, and if it is ever changed this test
    // is what says so out loud.
    assert.deepEqual(suggestNaics('farm').map((r) => r.code),
      ['115116', '424910', '493130', '115115', '333111'])
    // ...and the plural form reaches the Farming titles, which is what a person would type.
    assert.ok(suggestNaics('farming').every((r) => /Farming$/.test(r.title)))
  })

  test('matchWords drops stop words and short words, and keeps the rest', () => {
    assert.deepEqual(matchWords('We blend and repackage INDUSTRIAL solvents'),
      ['blend', 'repackage', 'industrial', 'solvents'])
    assert.deepEqual(matchWords('of the and a'), [])
  })

  test('max is honoured, including zero', () => {
    assert.equal(suggestNaics('manufacturing', 3).length, 3)
    assert.equal(suggestNaics('manufacturing', 0).length, 0)
  })

  test('board 1\'s last line keeps the person\'s own words, in quotes', () => {
    assert.equal(keepTypedLabel('  Vinegar and specialty ferment  '),
      'Keep "Vinegar and specialty ferment"')
  })
})

describe('what the list is NOT', () => {
  test('it holds no sector or subsector rows, so "Manufacturing" cannot be a suggestion', () => {
    // `companies.naics_code` holds one code and a two-digit sector is not an answer to "what does
    // your business do". Every row is six digits — asserted above — so this is the consequence:
    // the bare word has no row of its own.
    assert.ok(!NAICS_TITLES.some((r) => r.title === 'Manufacturing'))
    assert.ok(!NAICS_TITLES.some((r) => r.code.length !== 6))
  })

  test('the stop list knows nothing about chemicals', () => {
    // A stop list that knew the vertical would be `CLAUDE.md` §7's `if (industry === …)` in
    // disguise. These are the words the first customer will type, and they must all match.
    for (const w of ['chemical', 'solvent', 'blending', 'repackaging', 'manufacturing', 'wholesale']) {
      assert.deepEqual(matchWords(w), [w], `${w} must survive as a match word`)
    }
  })
})
