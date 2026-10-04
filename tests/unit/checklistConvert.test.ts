/**
 * "JUST WHAT WE DISCUSSED" — THE CITATION CHECK. `lib/checklistConvert.ts`, Workspace Task 6.
 * The rule is the summary report's own `checkCitations`, imported; these tests hold the checklist to it.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkConversion, itemColumns, checkAddedLinks, NO_SOURCE_FOUND } from '../../lib/checklistConvert.ts'
import { CONVERT_DISCUSSED, CONVERT_COMPLETE, CONVERT_DISCUSSED_ASKS_FOR_BASIS } from '../../prompts/convert.ts'
import { NO_SOURCE } from '../../lib/summaryReport.ts'

// Conversation-wide numbering: 1 TTB, 2 CBP, 3 FDA. The second answer has two paragraphs.
const turns = [
  { role: 'user', text: 'We import ethanol from Colombia.' },
  { role: 'assistant', text: 'You must register with TTB before you use the alcohol [1]. CBP collects the excise tax at entry [2].', sources: [
    { n: 1, title: 'TTB', url: 'https://ttb.gov/a' }, { n: 2, title: 'CBP', url: 'https://cbp.gov/b' }] },
  { role: 'user', text: 'It is for vinegar.' },
  { role: 'assistant', text: 'You must file Prior Notice before each shipment [1].\n\nAsk your broker whether the tariff applies [2].', sources: [
    { n: 1, title: 'FDA', url: 'https://fda.gov/c' }, { n: 2, title: 'CBP again', url: 'https://cbp.gov/b' }] },
]
const it = (name: string, sources: number[], basis?: string) => ({ name, description: 'Do it.', sources, ...(basis ? { basis } : {}) })

describe('the three groups', () => {
  test('items keep their group, in the order must_do, good_to_have, to_confirm', () => {
    const r = checkConversion({ title: 'T', to_confirm: [it('Ask the broker', [2], 'Ask your broker whether the tariff applies')],
      must_do: [it('Register with TTB', [1], 'You must register with TTB before you use the alcohol')],
      good_to_have: [it('Model landed cost', [])] }, turns)
    assert.ok(r.ok)
    assert.deepEqual(r.items.map((i) => i.category), ['must_do', 'good_to_have', 'to_confirm'])
  })
  test('a group that is not a list refuses the whole result; an item with no name is skipped', () => {
    assert.equal(checkConversion({ must_do: 'x' }, turns).ok, false)
    assert.equal(checkConversion('x', turns).ok, false)
    const r = checkConversion({ must_do: [{ name: '' }, it('Register with TTB', [])] }, turns)
    assert.ok(r.ok)
    assert.equal(r.items.length, 1)
  })
})

describe('every citation is proven by its basis — the summary\'s rule', () => {
  test('a basis found keeps only the markers in that paragraph', () => {
    // Paragraph 1 of answer 2 carries only [1] → FDA (3). The model also claimed CBP (2).
    const r = checkConversion({ must_do: [it('Prior notice', [3, 2], 'You must file Prior Notice before each shipment')] }, turns)
    assert.ok(r.ok)
    assert.deepEqual(r.items[0].sources.map((s) => s.title), ['FDA'])
    assert.deepEqual(r.checks[0], { category: 'must_do', name: 'Prior notice',
      basis: 'You must file Prior Notice before each shipment', found: true, kept: [3], dropped: [2] })
  })
  test('a basis not found clears every source, and the item stays — shown as "no source"', () => {
    const r = checkConversion({ must_do: [it('Register with TTB', [1], 'Register with the Alcohol and Tobacco Tax and Trade Bureau first')] }, turns)
    assert.ok(r.ok)
    assert.equal(r.items.length, 1)
    assert.deepEqual(r.items[0].sources, [])
    assert.equal(r.checks[0].found, false)
    assert.equal(itemColumns(r.items[0]).source_url, null)
    assert.deepEqual(itemColumns(r.items[0]).sources, [])
  })
  test('no basis at all, with the basis asked for: sources cleared', () => {
    const r = checkConversion({ must_do: [it('Register with TTB', [1])] }, turns, { basisRequired: true })
    assert.ok(r.ok)
    assert.deepEqual(r.items[0].sources, [])
  })
  test('a number outside the conversation\'s list cannot survive', () => {
    const r = checkConversion({ must_do: [it('Register', [1, 9], 'You must register with TTB before you use the alcohol')] }, turns)
    assert.ok(r.ok)
    assert.deepEqual(r.items[0].sources.map((s) => s.url), ['https://ttb.gov/a'])
  })
  test('the columns: every surviving source, the first in source_url, the basis kept, origin conversation', () => {
    const r = checkConversion({ must_do: [it('Register', [1, 2], 'You must register with TTB before you use the alcohol')] }, turns)
    assert.ok(r.ok)
    const c = itemColumns(r.items[0])
    assert.deepEqual(c.sources, [{ title: 'TTB', url: 'https://ttb.gov/a' }, { title: 'CBP', url: 'https://cbp.gov/b' }])
    assert.equal(c.source_url, 'https://ttb.gov/a')
    assert.equal(c.origin, 'conversation')
    assert.equal(c.basis, 'You must register with TTB before you use the alcohol')
  })
})

describe('the prompts say the rules the brief names', () => {
  test('discussed: basis asked for, and each rule present', () => {
    assert.equal(CONVERT_DISCUSSED_ASKS_FOR_BASIS, true)
    for (const s of ['Use only what the conversation says', 'Not repeating something is not withdrawing it',
      'is an item of its own in "must_do"', 'put it in "to_confirm"', 'Never put advice in "must_do"',
      'in the order the person has to act', 'Do not include phone numbers', 'short, simple sentences',
      'Copy the basis from the sentence that carries the source marker']) {
      assert.ok(CONVERT_DISCUSSED.includes(s), s)
    }
  })
  test('complete: keeps its two steps, and gains the third group', () => {
    assert.ok(CONVERT_COMPLETE.includes('"origin": "added"'))
    assert.ok(CONVERT_COMPLETE.includes('"to_confirm"'))
  })
  test('the route imports the summary\'s check rather than a copy of it', () => {
    const lib = readFileSync('lib/checklistConvert.ts', 'utf8')
    assert.match(lib, /import \{[^}]*checkCitations[^}]*\} *\n? *from '\.\/summaryReport\.ts'/)
    assert.ok(!/function checkCitations/.test(lib))
    assert.equal(NO_SOURCE, 'No source cited in the conversation')
  })
})

describe('"Everything on this subject" — an added item keeps only a link this call\'s search returned', () => {
  const returned = [{ url: 'https://www.ttb.gov/nonbeverage', title: 'TTB nonbeverage' },
    { url: 'https://example-consultant.com/guide', title: 'Guide' }]
  const base = { name: 'x', category: 'must_do' }
  test('a returned link stands, with its official/other label from lib/howTo.ts', () => {
    const r = checkAddedLinks([
      { ...base, origin: 'added' as const, source_url: 'http://ttb.gov/nonbeverage/', source_title: 'TTB' },
      { ...base, origin: 'added' as const, source_url: returned[1].url, source_title: null },
    ], returned)
    assert.equal(r.removed, 0)
    assert.deepEqual(r.items[0].sources, [{ title: 'TTB', url: 'https://www.ttb.gov/nonbeverage', label: 'official' }])
    assert.equal(r.items[1].sources[0].label, 'other')
  })
  test('a link the search did not return is removed; the item keeps its place with no source', () => {
    const r = checkAddedLinks([{ ...base, origin: 'added' as const, source_url: 'https://www.ttb.gov/forms/memory', source_title: 'TTB form' }], returned)
    assert.equal(r.removed, 1)
    assert.equal(r.items.length, 1)
    assert.deepEqual([r.items[0].source_url, r.items[0].source_title, r.items[0].sources], [null, null, []])
    assert.equal(NO_SOURCE_FOUND, 'No source found')
  })
  test('an item from the conversation is not touched by the search check', () => {
    const r = checkAddedLinks([{ ...base, origin: 'conversation' as const, source_url: 'https://fda.gov/c', source_title: 'FDA' }], returned)
    assert.equal(r.removed, 0)
    assert.equal(r.items[0].source_url, 'https://fda.gov/c')
  })
  test('the check is imported from lib/howTo.ts, not copied', () => {
    const lib = readFileSync('lib/checklistConvert.ts', 'utf8')
    assert.match(lib, /import \{[^}]*findReturned[^}]*labelFor[^}]*\} from '\.\/howTo\.ts'/)
    assert.ok(!/function urlKey|function labelFor/.test(lib))
  })
})
