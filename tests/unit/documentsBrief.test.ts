/**
 * THE DOCUMENTS CHAT'S BRIEF — `docs/GAPS-PLAN.md` Part A step 4a (decisions 1, 5, 14).
 *
 * Tested at the DATABASE SEAM: a stand-in client answers the five reads `packDocumentsContext`
 * makes, so the whole packer runs — the index, the ordering, the naming rule, the budget and the
 * passages — with no database, no model and no network.
 *
 * The rule that matters most is the first one: **the index is whole**. A chat shown half a
 * company's documents would say "you do not hold that" about a document in the list, which is
 * `CLAUDE.md` §5.1's worked example happening again in a new place.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  documentsBrief, packDocumentsContext, indexLine, indexPlain, reportBlock, namedBy,
  STATUS_ORDER, ATTENTION_ORDER, DROP_ORDER, INDEX_COLUMNS, type IndexRow,
} from '../../lib/ask/documentsBrief.ts'
import { checkBrief } from '../../lib/ask/brief.ts'
import { checkQuote, finishAnswer, normalisedWithMap, NOT_IN_WHAT_WE_HAVE } from '../../lib/ask/passages.ts'
import { DOCUMENTS_SENTENCES } from '../../prompts/documents-answer.ts'
import { DOCUMENTS_EXAMPLE_QUESTIONS } from '../../config/examples.ts'

const doc = (p: Partial<IndexRow> & { document_id: string }): IndexRow => ({
  title: 'A document', file_name: 'a.pdf', kind: 'permit', agencies: [], subjects: [],
  site_name: null, doc_date: null, significant_date: null, significant_date_kind: null,
  scanned_at: '2026-10-01T00:00:00Z', display_status: 'current', open_gap_count: 0,
  summary: 'What we made of it.', issuer: null, could_not_read_reason: null,
  version_of: null, correction_count: 0, ...p,
})

/** A stand-in for the caller's client: it answers the five reads the packer makes, and logs them. */
function fakeDb(opts: {
  index?: IndexRow[]
  indexError?: string
  gaps?: unknown[]; deadlines?: unknown[]; conditions?: unknown[]; corrections?: unknown[]; labels?: unknown[]
}) {
  const reads: string[] = []
  const table = (name: string) => {
    reads.push(name)
    const rowsFor = () => {
      if (name === 'document_index_v') return opts.index ?? []
      if (name === 'document_gaps') return opts.gaps ?? []
      if (name === 'document_deadlines') return opts.deadlines ?? []
      if (name === 'document_conditions') return opts.conditions ?? []
      if (name === 'document_corrections') return opts.corrections ?? []
      if (name === 'company_labels') return opts.labels ?? []
      return []
    }
    /**
     * Enough of PostgREST's builder for the packer AND for `companyBlock`, which asks
     * `buildCompanyContext` for several tables of its own. Those return nothing here, which is
     * fine: the company block is not what these tests are about, and an empty one still proves
     * the packer put it first.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = {}
    const self = () => q
    for (const m of ['select', 'in', 'eq', 'neq', 'is', 'not', 'order', 'limit', 'filter', 'or', 'gte', 'lte']) q[m] = self
    const answer = () => ({
      data: rowsFor(),
      error: name === 'document_index_v' && opts.indexError ? { message: opts.indexError } : null,
    })
    q.maybeSingle = async () => ({ data: (rowsFor()[0] ?? null), error: null })
    q.single = async () => ({ data: (rowsFor()[0] ?? null), error: null })
    q.then = (res: (v: unknown) => unknown) => res(answer())
    return q
  }
  // `companyBlock` asks `buildCompanyContext`, which reads tables of its own; they return nothing
  // here, which is fine — the company block is not what these tests are about.
  return { db: { from: table } as never, reads }
}

const pack = (opts: Parameters<typeof fakeDb>[0], question = 'what do we hold?') => {
  const { db, reads } = fakeDb(opts)
  return packDocumentsContext(db, 'co1', question).then((p) => ({ ...p, reads }))
}
const blockNamed = (p: { blocks: Array<{ name: string; text: string; leftOut: string | null }> }, name: string) =>
  p.blocks.find((b) => b.name === name)

describe('the brief is a brief', () => {
  test('five fields, and checkBrief accepts it', () => {
    assert.doesNotThrow(() => checkBrief(documentsBrief))
    assert.equal(documentsBrief.section, 'documents')
  })

  test('it offers nothing, on purpose', () => {
    assert.deepEqual(documentsBrief.offers, [])
  })

  /**
   * EIGHT AT 4a, ELEVEN AT 4a-TEST, THIRTEEN AT 4b. The three at 4a-test are the Calendar's
   * honesty sentences; the two at 4b were bought by measurement — a title marked as an unfindable
   * quote, and an offer with no button behind it. Of the eleven, the three added at 4a-test are each
   * written after a real run went wrong: an id written at a person, a rule number from memory
   * with `searches=0`, and the one sentence the person was owed withdrawn because it was written
   * before the first search. The failures are the ENGINE's, so the lessons are every section's.
   */
  test('its sentences are the drafted ones, and there are thirteen', () => {
    assert.deepEqual(documentsBrief.promptSentences, DOCUMENTS_SENTENCES)
    assert.equal(DOCUMENTS_SENTENCES.length, 13)
    for (const s of DOCUMENTS_SENTENCES) assert.ok(s.trim().length > 0)
  })

  test('its examples are the owner\'s file, not a copy', () => {
    assert.deepEqual(documentsBrief.words.examples, DOCUMENTS_EXAMPLE_QUESTIONS.map((e) => e.question))
    assert.equal(DOCUMENTS_EXAMPLE_QUESTIONS.length, 3)
  })
})

describe('THE INDEX IS WHOLE', () => {
  test('every document the company holds gets a line, and the count is the real one', async () => {
    const index = Array.from({ length: 40 }, (_, i) =>
      doc({ document_id: `d${i}`, title: `Doc ${i}`, display_status: i % 2 ? 'current' : 'on_file' }))
    const p = await pack({ index })
    const b = blockNamed(p, 'your documents')!
    assert.match(b.text, /Every document this company holds \(40 in all\):/)
    assert.equal((b.text.match(/<document /g) ?? []).length, 40)
    assert.equal(b.leftOut, null, 'nothing was cut, so nothing is claimed to have been')
  })

  test('a company with none is told so, and it is not an error', async () => {
    const p = await pack({ index: [] })
    assert.match(blockNamed(p, 'your documents')!.text, /This company holds no documents yet\./)
  })

  /**
   * §5.1's worked example, in a new place: a read that FAILED must never look like a company with
   * no documents. The chat would otherwise answer "you hold nothing" to a company with forty.
   */
  test('a read that failed throws rather than looking like an empty company', async () => {
    await assert.rejects(() => pack({ index: [], indexError: 'boom' }), /document_index_v: boom/)
  })

  test('it is sorted the way the person\'s own page sorts it', async () => {
    const index = [
      doc({ document_id: 'c', display_status: 'current', title: 'C' }),
      doc({ document_id: 'a', display_status: 'needs_work', title: 'A' }),
      doc({ document_id: 'b', display_status: 'expiring', title: 'B' }),
    ]
    const b = blockNamed(await pack({ index }), 'your documents')!
    assert.ok(b.text.indexOf('"A"') < b.text.indexOf('"B"'), 'needs_work before expiring')
    assert.ok(b.text.indexOf('"B"') < b.text.indexOf('"C"'), 'expiring before current')
    // and it is the page's own order, copied.
    assert.deepEqual([...STATUS_ORDER], readFileSync('app/documents/page.tsx', 'utf8')
      .slice(readFileSync('app/documents/page.tsx', 'utf8').indexOf('const STATUS_ORDER'))
      .match(/'([a-z_]+)'/g)!.slice(0, 8).map((s) => s.replace(/'/g, '')))
  })

  test('when even the index will not fit, the LEAST important status goes and it is SAID', async () => {
    const index = Array.from({ length: 300 }, (_, i) =>
      doc({ document_id: `d${i}`, title: `A very long document title number ${i}`,
        display_status: i < 100 ? 'on_file' : i < 200 ? 'recorded' : 'needs_work' }))
    const old = process.env.ASK_CONTEXT_BUDGET_TOKENS
    process.env.ASK_CONTEXT_BUDGET_TOKENS = '2000'      // a tiny budget, so the drop has to happen
    try {
      const b = blockNamed(await pack({ index }), 'your documents')!
      assert.ok(b.leftOut, 'something was cut and the block must say so')
      assert.match(b.leftOut!, /further document\(s\) are on file and are not listed here/)
      assert.match(b.leftOut!, /say so rather than treating this list as all of them/)
      assert.match(b.text, /300 in all/, 'the TRUE total is still stated')
      // `on_file` goes before `recorded`; `needs_work` is never dropped.
      assert.ok(!b.text.includes('state="On file"'), 'the least important went first')
      assert.match(b.text, /state="Needs work"/, 'what needs attention is never dropped')
    } finally {
      if (old === undefined) delete process.env.ASK_CONTEXT_BUDGET_TOKENS
      else process.env.ASK_CONTEXT_BUDGET_TOKENS = old
    }
  })

  test('the drop order is least-important-first', () => {
    assert.deepEqual([...DROP_ORDER], ['on_file', 'recorded', 'current'])
    for (const s of DROP_ORDER) assert.ok(!ATTENTION_ORDER.includes(s), `${s} must never be dropped and wanted`)
  })
})

describe('the reports: the ones the question names, then the ones that need attention', () => {
  const index = [
    doc({ document_id: 'eap', title: 'Emergency Action Plan', kind: 'program', display_status: 'needs_work', open_gap_count: 3 }),
    doc({ document_id: 'air', title: 'Air permit 26-2841', agencies: ['Oregon DEQ'], display_status: 'expired' }),
    doc({ document_id: 'sds', title: 'Acetone SDS', kind: 'supplier_document', display_status: 'on_file' }),
  ]

  test('a named document is packed FIRST, before anything that needs attention', async () => {
    const p = await pack({ index }, 'what does the acetone sds say?')
    const b = blockNamed(p, 'the readings')!
    assert.ok(b.text.indexOf('Acetone SDS') < b.text.indexOf('Emergency Action Plan'),
      'the document the person asked about comes first')
  })

  test('with nothing named, needs_work then expired then expiring', async () => {
    const b = blockNamed(await pack({ index }, 'how are we doing?'), 'the readings')!
    assert.ok(b.text.indexOf('Emergency Action Plan') < b.text.indexOf('Air permit'))
    assert.deepEqual([...ATTENTION_ORDER], ['needs_work', 'expired', 'expiring'])
  })

  test('a document is never reported twice when it is both named and in trouble', async () => {
    const b = blockNamed(await pack({ index }, 'what is wrong with the emergency action plan?'), 'the readings')!
    assert.equal((b.text.match(/document="Emergency Action Plan"/g) ?? []).length, 1)
  })

  test('the report says what the report drawer says', async () => {
    const p = await pack({
      index: [index[0]],
      gaps: [{ document_id: 'eap', title: 'No headcount step', description: 'Nobody counts people after an evacuation.',
        fix: 'Add a headcount step, section 4.', citation: '1910.38(c)(4)', locator: 'section 4', status: 'open' }],
      deadlines: [{ document_id: 'eap', title: 'Yearly review', due_on: '2027-02-01', recurs: true, source_line: 'Review each year.' }],
      conditions: [{ document_id: 'eap', condition_ref: 'C-1', title: 'Keep the drill log', evidence_expected: 'a signed log' }],
      corrections: [{ document_id: 'eap', field: 'title', new_value: 'Emergency Action Plan', reason: 'the file name was wrong' }],
    }, 'the emergency action plan')
    const t = blockNamed(p, 'the readings')!.text
    for (const expected of [
      'What we made of it.', 'What is missing:', 'No headcount step', 'Fix: Add a headcount step',
      'Rule: 1910.38(c)(4)', 'Dates this document sets:', 'Yearly review — 2027-02-01', '"Review each year."',
      'What this document asks the company to keep:', 'C-1 — Keep the drill log — a signed log',
      'What a person corrected about this document', 'title is now Emergency Action Plan',
    ]) assert.ok(t.includes(expected), `the report is missing: ${expected}`)
  })

  test('a gap that is not open is not reported as missing', async () => {
    const p = await pack({
      index: [index[0]],
      gaps: [{ document_id: 'eap', title: 'Settled already', description: null, fix: null,
        citation: null, locator: null, status: 'dismissed' }],
    }, 'the emergency action plan')
    assert.ok(!blockNamed(p, 'the readings')!.text.includes('Settled already'))
  })

  test('what did not fit is said, in one sentence', async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      doc({ document_id: `d${i}`, title: `Doc ${i}`, display_status: 'needs_work',
        summary: 'A long summary. '.repeat(200) }))
    // A stated budget rather than a pile of fixtures big enough to break the real one: the rule
    // under test is "say what did not fit", not "how much fits".
    const old = process.env.ASK_CONTEXT_BUDGET_TOKENS
    process.env.ASK_CONTEXT_BUDGET_TOKENS = '20000'
    let b
    try { b = blockNamed(await pack({ index: many }), 'the readings')! }
    finally {
      if (old === undefined) delete process.env.ASK_CONTEXT_BUDGET_TOKENS
      else process.env.ASK_CONTEXT_BUDGET_TOKENS = old
    }
    assert.ok(b.leftOut, 'the cap bit and must say so')
    assert.match(b.leftOut!, /further document reading\(s\) are on file and are not included here/)
    assert.match(b.leftOut!, /Ask about one by name to see it/)
  })
})

describe('*** extracted_text is NEVER in any block ***', () => {
  test('it is not read, and it is not written', async () => {
    const p = await pack({ index: [doc({ document_id: 'a' })] }, 'anything')
    for (const b of p.blocks) {
      assert.ok(!/extracted_text/.test(b.text), `${b.name} names extracted_text`)
    }
    assert.ok(!INDEX_COLUMNS.includes('extracted_text'), 'the index must not even ask for it')
    const src = readFileSync('lib/ask/documentsBrief.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/extracted_text/.test(src), 'no code line may read it')
  })
})

describe('every shown document gets a passage that opens it', () => {
  test('one per index line and one per report, each with its href', async () => {
    const index = [doc({ document_id: 'abc', title: 'Air permit' })]
    const p = await pack({ index }, 'the air permit')
    const ids = p.passages.map((x) => x.id)
    assert.ok(ids.includes('I1'), 'the index line is quotable')
    assert.ok(ids.includes('R1'), 'and so is the report')
    for (const x of p.passages) {
      assert.equal(x.href, '/documents?document=abc')
      assert.equal(x.label, 'your document')
      assert.ok(x.text.length > 0, 'a passage with no text can never match a quote')
    }
  })
})

describe('"the documents the question names" is decided in code', () => {
  const d = doc({ document_id: 'x', title: 'Air permit 26-2841', file_name: 'ACDP-2841.pdf',
    kind: 'permit', agencies: ['Oregon DEQ'], subjects: ['air'] })

  test('it matches the title, the file name, the kind word, the agency and the subject', () => {
    for (const q of ['tell me about the air permit', 'what is in ACDP-2841.pdf',
      'which permit expires first', 'anything from Oregon DEQ', 'what covers air?']) {
      assert.ok(namedBy(q, d), `should have matched: ${q}`)
    }
  })

  test('and nothing else — a question about something else matches nothing', () => {
    for (const q of ['when is the fire inspection', 'show me training records', '']) {
      assert.ok(!namedBy(q, d), `should NOT have matched: ${q}`)
    }
  })

  /**
   * THE FLOOR IS THREE LETTERS AND A STOP LIST, not four letters. Four reads as the safe choice
   * until you notice it throws away "air", "SDS", "EPA" and "gas" — words that are the whole
   * subject of a document. This test is why the rule changed.
   */
  test('joining words are ignored, but three-letter subjects are not', () => {
    assert.ok(!namedBy('is the on a?', d), '"the" must not name every document')
    assert.ok(!namedBy('what are all our documents?', d), 'and nor must "what", "all" or "our"')
    assert.ok(namedBy('what covers air?', d), 'but "air" is a real subject')
    const sds = doc({ document_id: 'y', title: 'Acetone SDS', subjects: ['sds'] })
    assert.ok(namedBy('find the SDS', sds), 'and "SDS" is a real thing people type')
  })

  test('it is case-insensitive, because a person types how they talk', () => {
    assert.ok(namedBy('OREGON deq', d))
  })

  /**
   * *** IT DOES NOT MATCH LABELS, AND THAT IS READ FROM THE SCHEMA. *** `company_labels` is
   * `(company_id, kind, label)` — the COMPANY's vocabulary. No document carries one, so there is
   * nothing per-document to match. The step's brief asked for labels; the table is what settled it.
   */
  test('there is no per-document label to match against', () => {
    const types = readFileSync('lib/database.types.ts', 'utf8')
    const block = types.slice(types.indexOf('      company_labels: {'), types.indexOf('      company_labels: {') + 400)
    assert.ok(!/document_id/.test(block), 'company_labels has no document_id — so labels are the company\'s')
  })
})

describe('the words a person reads', () => {
  test('they are short, plain, and say what this chat answers from', () => {
    assert.equal(documentsBrief.words.attachLabel, 'Add a document')
    assert.match(documentsBrief.words.lede, /^Everything you hold, read\./)
    assert.match(documentsBrief.words.emptyConversations, /the documents it drew on/)
    for (const w of [documentsBrief.words.lede, documentsBrief.words.emptyConversations]) {
      assert.ok(!/\bAI\b/.test(w), 'the product never says AI')
      assert.ok(!/complian(t|ce)\b/i.test(w) || /CompliBoard/.test(w), 'and never calls anybody compliant')
    }
  })

  test('the prompt says the five things it must, and offers nothing', () => {
    const all = DOCUMENTS_SENTENCES.join(' ')
    assert.match(all, /You are not given the files themselves/)        // the readings, never the files
    assert.match(all, /Name the document each thing you say comes from/)
    assert.match(all, /say plainly that it is not on file/)
    assert.match(all, /based on the older reading/)
    assert.match(all, /do not quote from it/)                          // decision 3b
    // *** NOT `!/offer/i` ANY MORE, AND THAT IS THE SAME MISTAKE AS THE `AI` ONE BELOW. ***
    // The prompt now BANS offering (DOCUMENTS_NO_OFFERS), so of course it contains the word. What
    // matters is that no sentence INVITES an offer and that the ban is there.
    assert.match(all, /Do not offer to do things for the person/)
    assert.ok(!/you may offer|offer to add|the fenced block/i.test(all), 'no sentence invites an offer')
    // The prompt BANS the word, so of course it contains it. What matters is that the ban is
    // there — asserting the word's absence failed on the sentence that forbids it.
    assert.match(all, /Never say "AI"/)
    assert.match(all, /never call this company or anything it holds compliant or non-compliant/)
  })

  /**
   * THE THREE THE CALENDAR PAID FOR. Each is `prompts/calendar-answer.ts`'s sentence with this
   * section's handles in it, and each exists because of a measured failure rather than a style
   * preference — which is why the test names all three rather than counting them.
   */
  test('and the two sentences step 4b measured into existence', () => {
    const all = DOCUMENTS_SENTENCES.join(' ')
    // A name is not a quote — six of 36 runs put a title in quotation marks and it was marked.
    assert.match(all, /Write a document's name in plain words, never inside quotation marks/)
    assert.match(all, /Quotation marks are only for words you read inside a document/)
    // A quote is the only thing the check can verify, and the only thing that becomes a card.
    assert.match(all, /quote the line you read something from when the exact words matter/)
    // And no promise the product cannot keep — it offered in prose in 18 of 36 runs.
    assert.match(all, /Say what they could do next/)
  })

  test('and the three honesty sentences the Calendar\'s real runs bought', () => {
    const all = DOCUMENTS_SENTENCES.join(' ')
    // The ids rule: the handles of THIS section, and the instruction to name the document.
    assert.match(all, /\(I3, R1, A1\) are handles for citing a passage/)
    assert.match(all, /Never write one in a sentence/)
    // A rule number is a claim.
    assert.match(all, /Do not give a rule number from memory/)
    // Search first, or lib/ai.ts withdraws the sentence the person was owed.
    assert.match(all, /search before you begin the answer/)
    assert.match(all, /treated as thinking aloud/)
    // A is the engine's letter for an attached file, and the prompt names it as one.
    assert.match(all, /\bA1\b/)
  })
})

/**
 * *** AN INDEX LINE CAN BE QUOTED — step 4b, the owner's yes, bought by 36 measured runs. ***
 *
 * The model is asked to NAME a document (`DOCUMENTS_WHICH_ONE`) and in 6 of 36 runs it did so in
 * quotation marks. The plain-quote check then treated the title as a quote, found it in nothing,
 * and the product said *"we could not find these words in what we have on file"* about the title
 * of a document in the person's own list. The cause is in the normaliser, not in the data, and
 * these tests say so by running it.
 */
describe('an index line can be quoted, and the block the model gets did not change', () => {
  const eap = doc({
    document_id: 'd-eap', title: 'Emergency Action Plan — Portland Facility', file_name: '01-eap.pdf',
    kind: 'program', agencies: ['Oregon OSHA'], site_name: 'Portland',
    display_status: 'needs_work', significant_date: '2021-02-01', significant_date_kind: 'revised',
    open_gap_count: 6,
  })

  /**
   * THE CAUSE, PROVED RATHER THAN ASSERTED (`CLAUDE.md` §9a: show the input). `normalisedWithMap`
   * skips everything between `<` and `>`; an index line is one self-closing tag; so the whole
   * line normalises away. A `<report>` block's body is outside its tags and was always fine.
   */
  test('THE DEFECT: the tag-shaped line normalises to nothing', () => {
    const line = indexLine(eap, 'I1')
    assert.match(line, /^<document /)
    assert.equal(normalisedWithMap(line).norm, '', 'a self-closing tag leaves no text to match')
    // and the fix: the same facts, with no tags.
    assert.ok(normalisedWithMap(indexPlain(eap)).norm.length > 20)
  })

  test('the plain copy carries title, kind, agency, site, state and date, in that order', () => {
    assert.equal(indexPlain(eap),
      'Emergency Action Plan — Portland Facility · Program · Oregon OSHA · Portland · Needs work · revised 2021-02-01')
  })

  test('a quoted TITLE now matches its own I passage', async () => {
    const p = await pack({ index: [eap] })
    const hit = checkQuote('Emergency Action Plan — Portland Facility', 'I1', p.passages)
    assert.equal(hit?.id, 'I1')
    assert.equal(hit?.label, 'your document')
    assert.equal(hit?.href, '/documents?document=d-eap', 'and the card opens that document')
  })

  /** End to end, through the check an answer really goes through: a card, not a warning. */
  test('AND THE WARNING IS GONE — it becomes a numbered source instead', async () => {
    const p = await pack({ index: [eap] })
    const checked = finishAnswer(
      'The “Emergency Action Plan — Portland Facility” is missing six things.', [], [], p.passages, [])
    assert.ok(!checked.text.includes(NOT_IN_WHAT_WE_HAVE), checked.text)
    assert.equal(checked.notFound, 0)
    assert.equal(checked.sources.length, 1)
    assert.equal((checked.sources[0] as { passage_id: string }).passage_id, 'I1')
  })

  /**
   * *** THE BLOCK THE MODEL IS SENT IS UNCHANGED, and this is the half that could break quietly. ***
   * The passage's text and the block's text are now different strings. If `indexPlain` ever leaked
   * into the message, every section's token measurement and the step 4a sample would be wrong.
   */
  test('the index block sent to the model is still the tagged line, byte for byte', async () => {
    const p = await pack({ index: [eap] })
    const block = blockNamed(p, 'your documents')!
    assert.ok(block.text.includes(indexLine(eap, 'I1')), 'the model still gets the tagged line')
    assert.ok(!block.text.includes(indexPlain(eap)), 'the plain copy must never reach the message')
    assert.equal(block.text,
      `Every document this company holds (1 in all):\n${indexLine(eap, 'I1')}`)
  })

  test('a document with almost nothing on it still gets a plain copy with its name in it', async () => {
    const bare = doc({ document_id: 'd2', title: null, file_name: 'scan.pdf', kind: null,
      agencies: [], subjects: [], display_status: 'on_file', significant_date: null })
    assert.equal(indexPlain(bare), 'scan.pdf · On file')
    const p = await pack({ index: [bare] })
    assert.equal(p.passages[0].text, 'scan.pdf · On file')
  })
})
