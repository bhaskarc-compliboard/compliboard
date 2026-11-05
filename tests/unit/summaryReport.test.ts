/**
 * THE SUMMARY REPORT'S RULES — `lib/summaryReport.ts`, Workspace Task 5.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  gatherSources, numberedTranscript, checkReport, cleanSourceNumbers, trimTitle, renderPlainText,
  normaliseForMatch, proposalsToInsert, checkCitations, AS_OF_LINE, TITLE_MAX,
} from '../../lib/summaryReport.ts'
import { PASSAGE_SOURCES } from '../../lib/sourceTitle.ts'
import { AS_OF_LINE as WORDS_AS_OF_LINE } from '../../lib/summaryWords.ts'

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
    assert.deepEqual(c.report.applies[0].items[0].sources, [3])          // the conversation's own numbering (E2f)
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
    // E2f: the item keeps its place and says nothing about sources — not in the text either.
    assert.ok(!renderPlainText(c.report).toLowerCase().includes('no source'))
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
    assert.deepEqual(c.report.applies[0].items[0].sources, [3, 2])
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

/* ── E2c ITEM 2: AN ITEM THAT CITES NOTHING INHERITS WHERE ITS SENTENCE CAME FROM ─────────────── */

/**
 * *** THE MEASURED PROBLEM. *** E2b's Haiku re-summary of the Calendar permit conversation cited
 * nothing on any of its six items, so every item read "No source cited in the conversation" about
 * a conversation whose every answer carried two or three citations. The item's `basis` is copied
 * out of one paragraph of one answer, the check has already FOUND that paragraph, and the
 * paragraph's own `[n]` markers are the sources the sentence rests on. Nothing is invented: a
 * number is inherited only from the paragraph the item's words came out of.
 */
describe('E2c item 2 — an item with no citation inherits its paragraph\'s', () => {
  const basisOnly = (name: string, basis: string, sources: number[] = []) =>
    ({ title: 'A conversation', situation: 'You make vinegar in Oregon.',
      applies: [{ authority: 'FDA', items: [item(name, sources, basis)] }],
      to_confirm: [] as unknown[], unanswered: [] as unknown[], facts: [] as unknown[] })

  test('it inherits, the item is no longer marked, and the check says what was inherited', () => {
    // The FDA paragraph carries [1] → global 3. The item cites nothing.
    const c = checkReport(basisOnly('Prior notice', 'You must file Prior Notice before each shipment'),
      turns, '2026-11-05', ON)
    assert.ok(c.ok)
    assert.equal(c.checks[0].found, true)
    assert.deepEqual(c.checks[0].inherited, [3])
    assert.deepEqual(c.report.applies[0].items[0].sources, [3])        // the conversation's own numbering
    assert.ok(!c.report.applies[0].items[0].no_source)
    // E2f: the list is every source the CONVERSATION rested on, not only the cited ones.
    assert.deepEqual(c.report.sources.map((x) => x.title), ['TTB', 'CBP', 'FDA'])
  })

  test('a paragraph with two markers gives both', () => {
    const c = checkReport(basisOnly('Excise', 'CBP collects the excise tax at entry'), turns, '2026-11-05', ON)
    assert.ok(c.ok)
    assert.deepEqual(c.checks[0].inherited, [1, 2])                    // TTB and CBP, that paragraph
    assert.deepEqual(c.report.applies[0].items[0].sources, [1, 2])
  })

  test('a number the item cited WRONGLY is still reported dropped, and the right ones inherited', () => {
    // Cites 3 (FDA, another answer); its basis is in the TTB/CBP paragraph, which carries 1 and 2.
    const c = checkReport(basisOnly('Excise', 'CBP collects the excise tax at entry', [3]), turns, '2026-11-05', ON)
    assert.ok(c.ok)
    assert.deepEqual(c.checks[0].dropped, [3])
    assert.deepEqual(c.checks[0].inherited, [1, 2])
  })

  test('an item that cited RIGHT inherits nothing — what the model said stands', () => {
    const c = checkReport(basisOnly('Prior notice', 'You must file Prior Notice before each shipment', [3]),
      turns, '2026-11-05', ON)
    assert.ok(c.ok)
    assert.equal(c.checks[0].inherited, undefined)
    assert.deepEqual(c.checks[0].kept, [3])
  })

  test('NOTHING IS INVENTED: no basis, a basis in no answer, and a paragraph with no marker', () => {
    const { perTurn } = gatherSources(turns, PASSAGE_SOURCES)
    const inherit = { inherit: true }
    // No basis at all.
    assert.deepEqual(checkCitations({ basis: null, sources: [] }, turns, perTurn, true, inherit),
      { found: false, kept: [], dropped: [] })
    // A basis that is in no answer — the words are not in the conversation.
    assert.deepEqual(checkCitations({ basis: 'a sentence nobody wrote here', sources: [2] }, turns, perTurn, true, inherit),
      { found: false, kept: [], dropped: [2] })
    // A paragraph that is found and carries no marker: found, and still nothing to inherit.
    const quiet = [{ role: 'assistant', text: 'You should talk to your own broker about the tariff.' }]
    const { perTurn: qp } = gatherSources(quiet, PASSAGE_SOURCES)
    assert.deepEqual(checkCitations({ basis: 'talk to your own broker about the tariff', sources: [] }, quiet, qp, true, inherit),
      { found: true, kept: [], dropped: [] })
  })

  /**
   * *** THE REAL CASE, READ OFF STAGING (Calendar conversation `aa50ee49`). ***
   * The basis is in the answer THREE times: a markdown table of what the permit says, which cites
   * nothing, and two sentences that do. The original rule took the first occurrence — the table —
   * so the item was held to a paragraph with no citation at all, and a number it cited CORRECTLY
   * would have been dropped. The paragraph that cited the sentence is the one that decides.
   */
  test('the words are in the answer three times: the CITED paragraph decides, the last one', () => {
    const quoted = [
      { role: 'user', text: 'What dates are in my permit?' },
      { role: 'assistant', text: '| Date | What the permit says |\n|---|---|\n| July 2 | "Renewal Application Due 60 days prior to expiration" |'
        + '\n\nThe permit says: "Renewal Application Due 60 days prior to expiration" [1]'
        + '\n\nAnd again, later: "Renewal Application Due 60 days prior to expiration" [2]',
        sources: [{ n: 1, title: 'The permit', url: '', kind: 'passage', label: 'the file you attached', href: '/documents?document=660283d2-15ce-4997-b246-4a9920fab489' },
                  { n: 2, title: 'The calendar line', url: '', kind: 'passage', label: 'your calendar', href: '/calendar?date=b58c179e-d318-4525-b78c-b0f1b12b2850' }] },
    ]
    const { perTurn } = gatherSources(quoted, PASSAGE_SOURCES)
    const basis = 'Renewal Application Due 60 days prior to expiration'
    // The summary's rule: the last paragraph that cites it — source 2.
    assert.deepEqual(checkCitations({ basis, sources: [] }, quoted, perTurn, true, { inherit: true }),
      { found: true, kept: [2], dropped: [], inherited: [2], inheritedFrom: 'paragraph' })
    // A number the model cited that IS in that paragraph stands on its own, with nothing inherited.
    assert.deepEqual(checkCitations({ basis, sources: [2] }, quoted, perTurn, true, { inherit: true }),
      { found: true, kept: [2], dropped: [] })
    // Without the option the TABLE still decides, and everything is dropped — the old behaviour,
    // which is what `lib/checklistConvert.ts` keeps.
    assert.deepEqual(checkCitations({ basis, sources: [1, 2] }, quoted, perTurn, true),
      { found: true, kept: [], dropped: [1, 2] })
  })

  /**
   * *** E2d, THE OWNER'S CALL MADE: WHEN NO PARAGRAPH THE SENTENCE IS IN CITES ANYTHING. ***
   * E2c measured this widening and left it open. The claim is weaker — the answer's sources, not
   * the paragraph's — so the check records WHICH of the two it was, and the paragraph still wins
   * whenever there is one.
   */
  test('the answer\'s own sources, and `inheritedFrom` says which', () => {
    const paraphrased = [
      { role: 'user', text: 'Are we ready for an inspection?' },
      { role: 'assistant', text: 'Your safety data sheet uses the old eight-section layout.'
        + '\n\nIt is dated August 2019 and has six gaps [1].',
        sources: [{ n: 1, title: 'The sheet', url: '', kind: 'passage', label: 'your document', href: '/documents?document=4b4a603b-c973-4c8c-a8f9-04f49f7721d8' }] },
    ]
    const { perTurn } = gatherSources(paraphrased, PASSAGE_SOURCES)
    // The basis is in the FIRST paragraph, which cites nothing; the answer cites 1.
    const basis = 'Your safety data sheet uses the old eight-section layout'
    assert.deepEqual(checkCitations({ basis, sources: [] }, paraphrased, perTurn, true, { inherit: true }),
      { found: true, kept: [1], dropped: [], inherited: [1], inheritedFrom: 'answer' })
    // The paragraph still wins when it has one of its own.
    assert.deepEqual(checkCitations({ basis: 'It is dated August 2019 and has six gaps', sources: [] },
      paraphrased, perTurn, true, { inherit: true }),
      { found: true, kept: [1], dropped: [], inherited: [1], inheritedFrom: 'paragraph' })
    // An answer that cites nothing at all still gives nothing — there is nothing to inherit.
    const silent = [{ role: 'assistant', text: 'Your safety data sheet uses the old eight-section layout.' }]
    const { perTurn: sp } = gatherSources(silent, PASSAGE_SOURCES)
    assert.deepEqual(checkCitations({ basis, sources: [] }, silent, sp, true, { inherit: true }),
      { found: true, kept: [], dropped: [] })
  })

  test('the report says so too, and the item is no longer marked', () => {
    const paraphrased = [
      { role: 'user', text: 'Are we ready?' },
      { role: 'assistant', text: 'Your safety data sheet uses the old eight-section layout.'
        + '\n\nIt has six gaps [1].',
        sources: [{ n: 1, title: 'The sheet', url: '', kind: 'passage', label: 'your document', href: '/documents?document=4b4a603b-c973-4c8c-a8f9-04f49f7721d8' }] },
    ]
    const c = checkReport({ title: 'A sheet', situation: 'You blend acid.',
      applies: [{ authority: 'OSHA', items: [item('Replace the sheet', [],
        'Your safety data sheet uses the old eight-section layout')] }],
      to_confirm: [], unanswered: [], facts: [] }, paraphrased as never, '2026-11-05',
      // The option every section but HR passes, or a document source is dropped on the way in.
      { basisRequired: true, sources: PASSAGE_SOURCES })
    assert.ok(c.ok)
    assert.equal(c.checks[0].inheritedFrom, 'answer')
    assert.deepEqual(c.report.applies[0].items[0].sources, [1])
    assert.ok(!c.report.applies[0].items[0].no_source)
    assert.equal(c.report.sources[0].title, 'The sheet')
    // Stored and unused: no item draws a source line since E2f (`components/ReportView.tsx`).
  })

  test('WITHOUT the flag nothing is inherited — which is the checklist, deliberately', () => {
    const { perTurn } = gatherSources(turns, PASSAGE_SOURCES)
    const r = checkCitations({ basis: 'You must file Prior Notice before each shipment', sources: [] },
      turns, perTurn, true)
    assert.deepEqual(r, { found: true, kept: [], dropped: [] })
    // `lib/checklistConvert.ts` calls it with no options on purpose: its items write
    // `checklist_items.sources`, rows a person ticks and a later run reads.
    const cc = readFileSync('lib/checklistConvert.ts', 'utf8')
    assert.match(cc, /checkCitations\(\{ basis, sources: numbers \}, turns, perTurn, opts\.basisRequired\)/)
    // …and the summary asks for it by name.
    assert.match(readFileSync('lib/summaryReport.ts', 'utf8'),
      /checkCitations\(c, turns, perTurn, opts\.basisRequired, \{ inherit: true \}\)/)
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

/**
 * *** B4 WAS "ONLY THE SOURCES IT CITES, RENUMBERED 1..k", AND E2f REPLACED IT. ***
 * That was right while every item drew its own source line: the list was the key to the lines.
 * E2f takes the lines away — a summary proves itself with ONE list — and a list built from what
 * the items happened to cite is then the wrong list. The Calendar permit conversation rested on
 * four documents and dates, its items cited none, and its summary would have shown no sources at
 * all about a conversation with four.
 */
describe('B4, as E2f rewrote it — the list is everything the conversation rested on', () => {
  test('every source of every turn, in order of first appearance, cited or not', () => {
    const r = good()
    r.applies = [
      { authority: 'CBP', items: [item('Broker', [2], 'The tariff question is for your broker')] },
      { authority: 'FDA', items: [item('Prior notice', [3], 'You must file Prior Notice before each shipment')] },
    ]
    r.to_confirm = [item('Tariff again', [2], 'The tariff question is for your broker')]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok)
    // TTB is in the list although no item cites it: the conversation rested on it.
    assert.deepEqual(c.report.sources.map((s) => `${s.n} ${s.title}`), ['1 TTB', '2 CBP', '3 FDA'])
    // And an item's own numbers point at that same numbering — stored, and drawn nowhere.
    assert.deepEqual(c.report.applies.map((g) => g.items[0].sources), [[2], [3]])
    assert.deepEqual(c.report.to_confirm[0].sources, [2])
  })

  test('a conversation whose items cite nothing still shows what it rested on', () => {
    const r = good()
    r.applies = [{ authority: 'FDA', items: [item('Prior notice', [], 'a sentence nobody wrote here')] }]
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok)
    assert.equal(c.report.applies[0].items[0].no_source, true)
    assert.equal(c.report.sources.length, 3)
  })
})

describe('B5, as E2f rewrote it — the plain text is the cards, in the cards\' order', () => {
  test('four sections, no source line under an item, and Sources after What applies', () => {
    const r = good()
    r.to_confirm = [item('Tariff', [2], 'The tariff question is for your broker')]
    r.unanswered = ['How many litres?']
    const c = checkReport(r, turns, '2026-10-03', ON)
    assert.ok(c.ok)
    const t = renderPlainText(c.report)
    for (const s of ['What applies to you as of 3 October 2026', 'Your situation', 'What applies', 'FDA',
      '- Prior notice: Do it.', 'Sources', '1. TTB — https://ttb.gov/a', 'Still to confirm', '- Tariff: Do it.']) {
      assert.ok(t.includes(s), s)
    }
    // By LINE, because the as-of line begins "What applies to you as of…" before any heading.
    const lines = t.split('\n')
    const at = (x: string) => lines.indexOf(x)
    assert.deepEqual(['Your situation', 'What applies', 'Sources', 'Still to confirm'].map(at)
      .every((n, i, a) => n >= 0 && (i === 0 || a[i - 1] < n)), true, 'the order is the cards\' order')
    // Nothing about sources under an item, and decision 65's section is gone with its card.
    assert.ok(!/\(sources? \d/.test(t), 'no per-item source numbers')
    assert.ok(!t.toLowerCase().includes('no source'))
    assert.ok(!t.includes('Asked and not answered') && !t.includes('How many litres?'))
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
  test('⚡ "No source cited in the conversation" IS NOWHERE IN THE PRODUCT — E2f', () => {
    // The words are not exported, not drawn, and not left behind in a comment that would read as
    // current. `tests/unit/summaryCards.test.ts` sweeps the whole of app/, lib/ and components/.
    assert.ok(!readFileSync('lib/summaryWords.ts', 'utf8').includes("= 'No source cited"))
    assert.ok(!readFileSync('lib/summaryReport.ts', 'utf8').includes('NO_SOURCE'))
  })
  test('the as-of line is the same sentence', () => {
    assert.equal(AS_OF_LINE('2026-10-04'),
      'What applies to you as of 4 October 2026, from this conversation. Rules and tariffs change. Check before you act.')
    assert.equal(AS_OF_LINE, WORDS_AS_OF_LINE)
  })
  test('the summary drawer takes its words from lib/summaryWords.ts, never this lib', () => {
    const view = readFileSync('components/ReportView.tsx', 'utf8')
    // E2's five cards take their titles and counts from the same file (decision 62), so the
    // import is a block now; what this test is about — WHERE the words come from — is unchanged.
    assert.match(view, /from '@\/lib\/summaryWords'/)
    for (const w of ['NO_SITUATION', 'AS_OF_LINE', 'CARD_SOURCES_TITLE', 'CONFIRM_COUNT']) {
      assert.ok(view.includes(w), `ReportView does not read ${w} from lib/summaryWords.ts`)
    }
    assert.ok(!/^import \{[^}]*\} from '@\/lib\/summaryReport'/m.test(view), 'only `import type` from lib/summaryReport')
  })
})
