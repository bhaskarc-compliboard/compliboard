/**
 * THE SUMMARY REPORT'S RULES — `lib/summaryReport.ts`, Workspace Task 5.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  gatherSources, numberedTranscript, checkReport, cleanSourceNumbers, trimTitle, renderPlainText,
  normaliseForMatch, proposalsToInsert, AS_OF_LINE, NO_SOURCE, TITLE_MAX,
} from '../../lib/summaryReport.ts'
import { NO_SOURCE as WORDS_NO_SOURCE, AS_OF_LINE as WORDS_AS_OF_LINE } from '../../lib/summaryWords.ts'

/*
 * Conversation-wide numbering of these turns: 1 TTB, 2 CBP, 3 FDA (CBP's second URL is the same page).
 * The second answer has two paragraphs: FDA cited in the first, CBP in the second.
 */
const turns = [
  { role: 'user', text: 'We import ethanol from Colombia.' },
  { role: 'assistant', text: 'TTB applies [1]. CBP collects the **excise tax** at entry [2].', sources: [
    { n: 1, title: 'TTB', url: 'https://ttb.gov/a' }, { n: 2, title: 'CBP', url: 'https://cbp.gov/b/' }] },
  { role: 'user', text: 'It is the raw material for vinegar. We are the manufacturer located in Oregon.' },
  { role: 'assistant', text: 'You must file Prior Notice before each shipment [1].\n\nThe tariff question is for your broker [2].', sources: [
    { n: 1, title: 'FDA', url: 'https://fda.gov/c' }, { n: 2, title: 'CBP again', url: 'https://cbp.gov/b#top' }] },
]
const item = (name: string, sources: number[], basis?: string) =>
  ({ name, what_to_do: 'Do it.', sources, ...(basis === undefined ? {} : { basis }) })
const good = () => ({
  title: 'Importing organic ethanol from Colombia for vinegar (Oregon)',
  situation: 'You make vinegar in Oregon.',
  applies: [{ authority: 'FDA', items: [item('Prior notice', [3], 'You must file Prior Notice before each shipment')] }],
  to_confirm: [] as unknown[], unanswered: [] as unknown[], facts: [] as unknown[],
})
const ON = { basisRequired: true }

describe('the sources are numbered by code', () => {
  test('deduplicated by URL (a trailing slash and a fragment are the same page), in order of first appearance', () => {
    const { sources } = gatherSources(turns)
    assert.deepEqual(sources.map((s) => s.n + ' ' + s.title), ['1 TTB', '2 CBP', '3 FDA'])
  })
  test("each answer's own markers are rewritten into the global numbers", () => {
    const { transcript } = numberedTranscript(turns)
    assert.match(transcript, /ANSWER: TTB applies \[1\]\. CBP collects/)
    assert.match(transcript, /Prior Notice before each shipment \[3\]\./)
    assert.match(transcript, /3\. FDA — https:\/\/fda\.gov\/c/)
  })
})

describe('the shape check', () => {
  test('a source number not in the conversation is dropped', () => {
    assert.deepEqual(cleanSourceNumbers([3, 9, 0, 3, '2', 1.5], 3), [3, 2])
  })
  test('the title is trimmed to 70 characters, at a word, with no full stop', () => {
    const t = trimTitle('Importing organic ethanol from Colombia for vinegar production at our Oregon plant.')
    assert.ok(t.length <= TITLE_MAX, t)
    assert.ok(!t.endsWith('.'))
    assert.equal(trimTitle('Short title.'), 'Short title')
  })
  test('a wrong shape refuses the whole report, plainly', () => {
    for (const bad of [null, 'text', { ...good(), title: '' }, { ...good(), applies: 'x' },
      { ...good(), applies: [{ authority: 'FDA', items: [{ what_to_do: 'no name' }] }] },
      { ...good(), unanswered: 'not a list' },
      { ...good(), applies: [{ authority: 'FDA', items: [{ ...item('x', []), basis: 7 }] }] }]) {
      const c = checkReport(bad, turns, '2026-10-03', ON)
      assert.equal(c.ok, false)
      if (!c.ok) assert.match(c.error, /^The summary came back in a shape we could not use/)
    }
  })
  test('as_of is the date the code passes, not the one the model wrote', () => {
    const c = checkReport({ ...good(), as_of: '1999-01-01' }, turns, '2026-10-03', ON)
    assert.ok(c.ok); assert.equal(c.report.as_of, '2026-10-03')
  })
})

describe('B1 — the basis must be in an answer, or the item has no source', () => {
  test('matching ignores whitespace, [n] markers, markdown emphasis and letter case, and nothing else', () => {
    assert.equal(normaliseForMatch('CBP collects the **excise   tax** at entry [2].'), 'cbp collects the excise tax at entry .')
  })
  test('a case-only difference passes', () => {
    const r = good(); r.applies[0].items = [item('Prior notice', [3], 'YOU MUST FILE PRIOR NOTICE before each shipment')]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok); assert.equal(c.checks[0].found, true); assert.deepEqual(c.checks[0].kept, [3])
  })
  test('a trailing full stop passes', () => {
    const r = good(); r.applies[0].items = [item('Tariff', [2], 'The tariff question is for your broker.')]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok); assert.equal(c.checks[0].found, true)
  })
  test('a reworded phrase still fails', () => {
    const r = good(); r.applies[0].items = [item('Prior notice', [3], 'You have to file a Prior Notice before every shipment')]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok); assert.equal(c.checks[0].found, false); assert.equal(c.report.applies[0].items[0].no_source, true)
  })
  test('found: the item keeps its source', () => {
    const c = checkReport(good(), turns, '2026-10-03', ON)
    assert.ok(c.ok)
    assert.equal(c.checks[0].found, true)
    assert.deepEqual(c.report.applies[0].items[0].sources, [1])          // renumbered: 3 → 1 (B4)
    assert.ok(!c.report.applies[0].items[0].no_source)
  })
  test('found through markdown: a basis copied without the asterisks still matches', () => {
    const r = good(); r.applies[0].items = [item('Excise', [2], 'CBP collects the excise tax at entry')]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok); assert.equal(c.checks[0].found, true)
  })
  test('not found: every source is cleared, the item keeps its place, marked', () => {
    const r = good(); r.applies[0].items = [item('Invented', [1, 3], 'a sentence nobody wrote in this conversation'), ...r.applies[0].items]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok)
    assert.equal(c.checks[0].found, false); assert.deepEqual(c.checks[0].dropped, [1, 3])
    assert.equal(c.report.applies[0].items[0].name, 'Invented')
    assert.equal(c.report.applies[0].items[0].no_source, true)
    assert.match(renderPlainText(c.report), new RegExp(NO_SOURCE.toLowerCase()))
  })
  test('a missing basis, when the prompt asks for one, counts as not found', () => {
    const r = good(); r.applies[0].items = [item('No basis', [3])]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok); assert.equal(c.checks[0].found, false); assert.equal(c.report.applies[0].items[0].no_source, true)
  })
  test('under the original prompt (no basis asked for), numbers are range-checked only, and the check says so', () => {
    const r = good(); r.applies[0].items = [item('Prior notice', [3, 2])]
    const c = checkReport(r, turns, '2026-10-03', { basisRequired: false })
    assert.ok(c.ok); assert.equal(c.checks[0].found, null)
    assert.deepEqual(c.report.applies[0].items[0].sources, [1, 2])
  })
})

describe('B2 — only the markers in the same paragraph of the same answer survive', () => {
  test('a number cited elsewhere in the answer, or in another answer, is dropped', () => {
    // The basis is in the FDA paragraph, which carries only [1] → global 3. 2 (CBP, next paragraph) and 1 (TTB, other answer) go.
    const r = good(); r.applies[0].items = [item('Prior notice', [3, 2, 1], 'You must file Prior Notice before each shipment')]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok)
    assert.deepEqual(c.checks[0].kept, [3]); assert.deepEqual(c.checks[0].dropped, [2, 1])
  })
})

describe("B3 — a fact stands only on the person's own words", () => {
  test('a quote from a USER turn is kept; one from an answer, or invented, is dropped and said', () => {
    const r = good(); r.facts = [
      { key: 'state', value: 'Oregon', quote: 'We are the manufacturer located in Oregon.' },
      { key: 'origin', value: 'Colombia', quote: 'TTB applies' },                  // an answer's words
      { key: 'volume', value: '500 gallons', quote: 'we buy 500 gallons a year' },  // nobody said it
      { key: 'use', value: 'vinegar' },                                             // no quote
    ]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok)
    assert.deepEqual(c.report.facts.map((f) => f.key), ['state'])
    assert.deepEqual(c.report.facts_dropped?.map((f) => `${f.key}: ${f.reason}`), [
      'origin: its quote is not in any of your messages',
      'volume: its quote is not in any of your messages',
      'use: it has no quote',
    ])
  })
})

describe('B4 — the report lists only the sources it cites, renumbered 1..k', () => {
  test('in order of first appearance in the report, every item rewritten to match', () => {
    const r = good()
    r.applies = [
      { authority: 'CBP', items: [item('Broker', [2], 'The tariff question is for your broker')] },
      { authority: 'FDA', items: [item('Prior notice', [3], 'You must file Prior Notice before each shipment')] },
    ]
    r.to_confirm = [item('Tariff again', [2], 'The tariff question is for your broker')]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok)
    assert.deepEqual(c.report.sources.map((s) => `${s.n} ${s.title}`), ['1 CBP', '2 FDA'])   // TTB, never cited, is gone
    assert.deepEqual(c.report.applies.map((g) => g.items[0].sources), [[1], [2]])
    assert.deepEqual(c.report.to_confirm[0].sources, [1])
  })
})

describe('B5 — the plain text follows the same numbering', () => {
  test('every section, "(source n)" rather than [n], and the renumbered list', () => {
    const r = good()
    r.to_confirm = [item('Tariff', [2], 'The tariff question is for your broker')]
    r.unanswered = ['How many litres?']
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok)
    const t = renderPlainText(c.report)
    for (const s of ['What applies to you as of 3 October 2026', 'Your situation', 'What applies', 'FDA',
      '- Prior notice: Do it. (source 1)', 'Still to confirm', '- Tariff: Do it. (source 2)',
      'Asked and not answered', 'How many litres?', 'Sources', '1. FDA — https://fda.gov/c', '2. CBP — https://cbp.gov/b/']) {
      assert.ok(t.includes(s), s)
    }
    assert.ok(!/\[\d+\]/.test(t), 'no [n] markers in the text')
  })
})

describe('the facts become proposals once, never twice', () => {
  const ids = { topicId: 't1', companyId: 'c1' }
  const withIds = turns.map((t, i) => ({ ...t, id: `turn-${i + 1}` }))
  const facts = [
    { key: 'state', value: 'Oregon', quote: 'We are the manufacturer located in Oregon.' },
    { key: 'end_use', value: 'vinegar', quote: 'It is the raw material for vinegar.' },
  ]
  test('each new fact is proposed for this conversation, pointing at the turn its quote came from', () => {
    const rows = proposalsToInsert(facts, [], withIds, ids)
    assert.equal(rows.length, 2)
    assert.deepEqual(rows[0], { company_id: 'c1', topic_id: 't1', source: 'conversation', switch_key: 'state',
      proposed_value: 'Oregon', quote: 'We are the manufacturer located in Oregon.', from_turn_id: 'turn-3' })
  })
  test('a fact already pending for this conversation, same key and value, is not proposed again', () => {
    const rows = proposalsToInsert(facts, [{ switch_key: 'state', proposed_value: 'oregon ' }], withIds, ids)
    assert.deepEqual(rows.map((r) => r.switch_key), ['end_use'])
  })
  test('a pending proposal with a DIFFERENT value does not block the new one', () => {
    const rows = proposalsToInsert(facts, [{ switch_key: 'state', proposed_value: 'Washington' }], withIds, ids)
    assert.deepEqual(rows.map((r) => r.switch_key), ['state', 'end_use'])
  })
  test('the same fact twice in one report is proposed once', () => {
    const rows = proposalsToInsert([facts[0], facts[0]], [], withIds, ids)
    assert.equal(rows.length, 1)
  })
})

describe('the display words have one home, and the drawer reads them there (HR Step 3a)', () => {
  // Until HR Step 3a the page kept copies of these two strings, pinned here, because this lib is
  // server-only. They now live in `lib/summaryWords.ts`, which imports nothing; this lib re-exports
  // them, so its callers are unchanged. The "nothing server-only reaches a client file" guarantee
  // these tests used to give for the page alone is now `tests/unit/clientImports.test.ts`, for every
  // client file.
  test('NO_SOURCE is the same words, and the same export, from both files', () => {
    assert.equal(NO_SOURCE, 'No source cited in the conversation')
    assert.equal(NO_SOURCE, WORDS_NO_SOURCE)
  })
  test('the as-of line is the same sentence', () => {
    assert.equal(AS_OF_LINE('2026-10-04'),
      'What applies to you as of 4 October 2026, from this conversation. Rules and tariffs change. Check before you act.')
    assert.equal(AS_OF_LINE, WORDS_AS_OF_LINE)
  })
  test('the summary drawer takes its words from lib/summaryWords.ts, never this lib', () => {
    const view = readFileSync('components/ReportView.tsx', 'utf8')
    assert.match(view, /^import \{ NO_SOURCE, NO_SITUATION, AS_OF_LINE \} from '@\/lib\/summaryWords'/m)
    assert.ok(!/^import \{[^}]*\} from '@\/lib\/summaryReport'/m.test(view), 'only `import type` from lib/summaryReport')
  })
})
