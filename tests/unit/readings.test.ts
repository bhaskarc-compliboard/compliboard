/**
 * THE SHARED READING PACKER — `docs/GAPS-PLAN.md` Part A step 4a (decision 14).
 *
 * `lib/ask/readings.ts` is `lib/ask/calendarBrief.ts:151`–`:191` lifted out so the Calendar and the
 * Documents chat cannot pack a person's documents two different ways. These test the three rules
 * it carries, each of which a real run paid for: what is left out is NAMED, every item shown gets
 * a passage even when there is nothing in it to quote, and the cap is asked BEFORE an item is
 * added rather than after.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { packReadings, leftOutSentence } from '../../lib/ask/readings.ts'
import { tokensOf } from '../../lib/ask/passages.ts'

/** An item whose block is a known length, so the cap arithmetic is checkable by hand. */
const item = (name: string, size: number) => ({ name, body: 'x'.repeat(size) })
const pack = (items: Array<{ name: string; body: string }>, cap: number) =>
  packReadings(items, {
    cap,
    idPrefix: 'D',
    blockFor: (it, id) => `<reading id="${id}">${it.body}</reading>`,
    passageFor: (it, id, block) => ({
      id, title: `${it.name} — what we read in it`, label: 'a reading of your document',
      text: block, href: `/documents?document=${it.name}`, shortName: it.name,
    }),
  })

describe('what fits, in the order it was given', () => {
  test('nothing in, nothing out — and no sentence about nothing', () => {
    const r = pack([], 1000)
    assert.deepEqual(r, { texts: [], passages: [], leftOut: 0, spent: 0 })
    assert.equal(leftOutSentence(0, (n) => `${n} left out`), '')
  })

  test('ids are the section\'s letter and run from 1', () => {
    const r = pack([item('a', 10), item('b', 10), item('c', 10)], 100_000)
    assert.deepEqual(r.passages.map((p) => p.id), ['D1', 'D2', 'D3'])
  })

  test('THE ORDER IS THE CALLER\'S and is never re-sorted', () => {
    // The Calendar puts the most-used document first; the Documents chat puts the one the
    // question names first. A packer that sorted would be deciding what matters.
    const r = pack([item('zebra', 10), item('apple', 10)], 100_000)
    assert.deepEqual(r.passages.map((p) => p.shortName), ['zebra', 'apple'])
  })
})

describe('the cap is asked BEFORE an item is added', () => {
  test('an item that would not fit is left out, and the budget is not exceeded', () => {
    const big = item('big', 400)
    const cap = tokensOf(`<reading id="D1">${big.body}</reading>`)      // room for exactly one
    const r = pack([big, item('second', 400)], cap)
    assert.equal(r.texts.length, 1, 'only the first fits')
    assert.equal(r.leftOut, 1)
    assert.ok(r.spent <= cap, `spent ${r.spent} must not exceed the cap ${cap}`)
  })

  test('a cap of zero takes nothing and counts everything', () => {
    const r = pack([item('a', 10), item('b', 10)], 0)
    assert.equal(r.texts.length, 0)
    assert.equal(r.leftOut, 2)
    assert.equal(r.spent, 0)
  })

  /**
   * *** ADDING FIRST AND TRIMMING LATER IS HOW A BUDGET IS EXCEEDED BY EXACTLY ONE LARGE ITEM. ***
   * A small item after a refused large one still fits — the packer does not stop at the first
   * refusal, it keeps going. That is deliberate: a 40-page permit must not shut out nine short
   * certificates behind it.
   */
  test('a small item after a refused large one still fits', () => {
    const small = item('small', 20)
    const cap = tokensOf(`<reading id="D1">${'x'.repeat(100)}</reading>`)
    const r = pack([item('huge', 10_000), small], cap)
    assert.equal(r.leftOut, 1, 'the huge one was refused')
    assert.equal(r.texts.length, 1, 'and the small one still got in')
    assert.match(r.texts[0], /small|x{20}/)
    // and its id is D2, not D1: the numbering follows the INPUT, so a card's id always points
    // at the item the caller ordered, whether or not its neighbour fitted.
    assert.equal(r.passages[0].id, 'D2')
  })
})

describe('every item SHOWN gets a passage — even one with nothing to quote', () => {
  test('one passage per block that fitted, and none for the ones that did not', () => {
    const cap = tokensOf(`<reading id="D1">${'x'.repeat(100)}</reading>`)
    const r = pack([item('a', 100), item('b', 10_000), item('c', 10_000)], cap)
    assert.equal(r.texts.length, r.passages.length, 'a block without a card is an id naming nothing')
    assert.equal(r.leftOut, 2)
  })

  test('an item with an EMPTY block still gets a named passage', () => {
    // `lib/ask/calendarBrief.ts:131`–`:141`: the first version made a passage only where there
    // was text, so ids and passages were two namespaces and an answer wrote "as dates C6 and C7"
    // with C6 naming nothing. Empty text can never match a quote, which is right; the NAME is
    // what `replacePassageIds` needs.
    const r = packReadings([{ name: 'a photograph of a page' }], {
      cap: 1000, idPrefix: 'D',
      blockFor: () => '',
      passageFor: (it, id) => ({ id, title: it.name, label: 'a reading of your document', text: '', shortName: it.name }),
    })
    assert.equal(r.passages.length, 1)
    assert.equal(r.passages[0].text, '')
    assert.equal(r.passages[0].shortName, 'a photograph of a page')
  })

  test('the card carries where to click, so a cited document opens', () => {
    const r = pack([item('doc-9', 10)], 1000)
    assert.equal(r.passages[0].href, '/documents?document=doc-9')
    assert.equal(r.passages[0].label, 'a reading of your document')
  })
})

describe('what is left out is said in the section\'s own words', () => {
  test('nothing left out says nothing at all', () => {
    assert.equal(leftOutSentence(0, (n) => `${n} further reading(s) are not included here.`), '')
  })

  test('and the sentence is the caller\'s, because sections show different things', () => {
    assert.equal(leftOutSentence(3, (n) => `${n} further document reading(s) are on file and are not included here.`),
      '3 further document reading(s) are on file and are not included here.')
  })
})

describe('the Calendar calls it, and still says what it always said', () => {
  const brief = readFileSync('lib/ask/calendarBrief.ts', 'utf8')

  test('it uses the shared packer rather than a loop of its own', () => {
    assert.match(brief, /from '\.\/readings\.ts'/)
    assert.match(brief, /packReadings\(shown, \{/)
    assert.match(brief, /idPrefix: 'D'/)
    assert.match(brief, /blockFor: \(\{ docId, d \}, id\) => readingBlock\(d, condsFor\(docId\), id\)/)
  })

  test('its own sentence for what did not fit is unchanged', () => {
    assert.match(brief, /further document reading\(s\) are on file and are not included here\./)
  })

  /**
   * *** THE DELETED DOCUMENTS ARE DROPPED BEFORE THE PACK, NOT INSIDE IT. ***
   * It was `if (!d) return` inside the loop, which skipped an item while the index kept counting —
   * so a deleted document left a hole in the numbering, D1 then D3. Filtering first keeps the ids
   * dense, and the behaviour the Calendar had is otherwise identical.
   */
  test('a document deleted since its date was filed leaves no hole in the ids', () => {
    assert.match(brief, /\.filter\(\(x\): x is \{ docId: string; d: DocRow \} => Boolean\(x\.d\)\)/)
    const loop = brief.slice(brief.indexOf('const shown ='), brief.indexOf('readingLines.push(...packed.texts)'))
    assert.ok(!/if \(!d\) return/.test(loop), 'the skip must not be inside the pack again')
  })
})
