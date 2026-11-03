/**
 * THE AUDITS CHAT'S BRIEF — `docs/GAPS-PLAN.md` Part A step 6a (decisions 31–34, 41).
 *
 * Tested at the DATABASE SEAM, exactly as `tests/unit/documentsBrief.test.ts` is: a stand-in
 * client answers the reads `packAuditsContext` makes, so the whole packer runs — the runs, the
 * latest-per-agency rule, the suggestion labelling, the index, the budget and the passages — with
 * no database, no model and no network.
 *
 * The three rules that matter most, and each is here because getting it wrong is a thing the
 * product would SAY to a person:
 *
 *   1. **an `expected` row is a suggestion, not a finding** — nine of Cascade's 34 open rows are
 *      suggestions carrying the word `nothing_on_file`, and packed bare they read as nine more
 *      failures;
 *   2. **a run line is quotable** — a self-closing tag normalises to the empty string, which is
 *      the bug Documents paid for at step 4a-test;
 *   3. **an offer is checked against the company's own labels in code**, never trusted from the
 *      model.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  auditsBrief, packAuditsContext, runLine, runPlain, findingBlock, runName,
  checkRunAuditOffer, FINDING_WORD, KIND_WORD, RUN_COLUMNS, FINDING_COLUMNS, SECTION_COLUMNS,
  RUNS_SHARE, FINDINGS_SHARE, INDEX_SHARE, RUNS_MAX,
  type RunRow, type FindingRow, type SectionRow,
} from '../../lib/ask/auditsBrief.ts'
import { checkBrief } from '../../lib/ask/brief.ts'
import { checkQuote, normalisedWithMap, type Passage } from '../../lib/ask/passages.ts'
import { AUDITS_SENTENCES } from '../../prompts/audits-answer.ts'
import { AUDITS_EXAMPLE_QUESTIONS } from '../../config/examples.ts'
import {
  AUDITS_LEDE, AUDITS_ATTACH_LABEL, AUDITS_EMPTY_CONVERSATIONS, runAuditCardWords,
  auditsCommandAgencyLine, auditsCommandTemplateLine,
} from '../../lib/auditsWords.ts'
import type { IndexRow } from '../../lib/ask/documentsBrief.ts'

const run = (p: Partial<RunRow> & { id: string }): RunRow => ({
  kind: 'agency', scope: null, agency_label: 'Oregon DEQ', status: 'done',
  section_count: 1, done_count: 1, readings_as_of: '2026-10-14T18:05:58Z',
  created_at: '2026-11-03T17:00:00Z', started_at: '2026-11-03T17:02:17Z',
  finished_at: '2026-11-03T17:02:56Z', summary: null, previous_run_id: null,
  template_document_id: null, ...p,
})
const section = (p: Partial<SectionRow> & { id: string; run_id: string }): SectionRow => ({
  ordinal: 0, title: 'Oregon DEQ', status: 'done', could_not_complete_reason: null,
  documents_read: ['d1', 'd2'], ...p,
})
const finding = (p: Partial<FindingRow> & { id: string; run_id: string }): FindingRow => ({
  section_id: 's1', kind: 'finding', word: 'nothing_on_file', title: 'A thing',
  basis: 'read', document_id: null, locator: null, quote: null, what_to_do: null,
  template_line: null, status: 'open', ...p,
})
const doc = (p: Partial<IndexRow> & { document_id: string }): IndexRow => ({
  title: 'A document', file_name: 'a.pdf', kind: 'permit', agencies: [], subjects: [],
  site_name: null, doc_date: null, significant_date: null, significant_date_kind: null,
  scanned_at: '2026-10-14T00:00:00Z', display_status: 'current', open_gap_count: 0,
  summary: 'What we made of it.', issuer: null, could_not_read_reason: null,
  version_of: null, correction_count: 0, ...p,
})

/** A stand-in for the caller's client: it answers every read the packer makes, and logs them. */
function fakeDb(opts: {
  runs?: RunRow[]; runsError?: string
  sections?: SectionRow[]
  findings?: FindingRow[]
  index?: IndexRow[]; indexError?: string
}) {
  const reads: string[] = []
  const table = (name: string) => {
    reads.push(name)
    const rowsFor = () => {
      if (name === 'audit_runs') return opts.runs ?? []
      if (name === 'audit_sections') return opts.sections ?? []
      if (name === 'audit_findings') return opts.findings ?? []
      if (name === 'document_index_v') return opts.index ?? []
      return []
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = {}
    const self = () => q
    for (const m of ['select', 'in', 'eq', 'neq', 'is', 'not', 'order', 'limit', 'filter', 'or', 'gte', 'lte']) q[m] = self
    const answer = () => ({
      data: rowsFor(),
      error: (name === 'audit_runs' && opts.runsError) ? { message: opts.runsError }
        : (name === 'document_index_v' && opts.indexError) ? { message: opts.indexError } : null,
    })
    q.maybeSingle = async () => ({ data: (rowsFor()[0] ?? null), error: null })
    q.single = async () => ({ data: (rowsFor()[0] ?? null), error: null })
    q.then = (res: (v: unknown) => unknown) => res(answer())
    return q
  }
  return { db: { from: table } as never, reads }
}

const pack = (opts: Parameters<typeof fakeDb>[0], question = 'how do we stand?') => {
  const { db, reads } = fakeDb(opts)
  return packAuditsContext(db, 'co1', question).then((p) => ({ ...p, reads }))
}
const blockNamed = (p: { blocks: Array<{ name: string; text: string; leftOut: string | null }> }, name: string) =>
  p.blocks.find((b) => b.name === name)

describe('the brief is a brief', () => {
  test('five fields, and checkBrief accepts it', () => {
    assert.doesNotThrow(() => checkBrief(auditsBrief))
    assert.equal(auditsBrief.section, 'audits_chat')
  })

  test('its words are the one copy in lib/auditsWords.ts, not a second set', () => {
    assert.equal(auditsBrief.words.lede, AUDITS_LEDE)
    assert.equal(auditsBrief.words.attachLabel, AUDITS_ATTACH_LABEL)
    assert.equal(auditsBrief.words.emptyConversations, AUDITS_EMPTY_CONVERSATIONS)
    assert.deepEqual(auditsBrief.words.examples, AUDITS_EXAMPLE_QUESTIONS.map((e) => e.question))
  })

  test('nineteen prompt sentences, and no extra step', () => {
    assert.equal(AUDITS_SENTENCES.length, 19)
    assert.equal(auditsBrief.promptSentences, AUDITS_SENTENCES)
    assert.equal(auditsBrief.extraStep, undefined)
  })

  /**
   * `offers` is EMPTY and that is step 6a's stop, not a decision: `run_audit` needs three lines in
   * the shared `lib/ask/offers.ts`, which this step may not edit. The day it is added, this test
   * is the one that has to change, and it says why.
   */
  test('offers is empty until lib/ask/offers.ts learns run_audit (step 6b)', () => {
    assert.deepEqual(auditsBrief.offers, [])
    const offers = readFileSync('lib/ask/offers.ts', 'utf8')
    assert.ok(!offers.includes('run_audit'),
      'lib/ask/offers.ts now knows run_audit — set auditsBrief.offers and change this test together')
  })

  test('it does not take the engine\'s letter', () => {
    const src = readFileSync('lib/ask/auditsBrief.ts', 'utf8')
    assert.ok(!/idPrefix: 'A'/.test(src))
    assert.ok(!/`A\$\{/.test(src))
  })
})

describe('a run line, and the quote check that nearly could not see it', () => {
  const r = run({ id: 'r1', summary: { on_file: 8, stale: 1, nothing_on_file: 5, expected: 0 } })

  test('it carries what it was of, when it ran, what it read and what it found', () => {
    const line = runLine(r, 'U1', { templateTitle: null, documentsRead: 5, didNotFinish: 0 })
    assert.match(line, /id="U1"/)
    assert.match(line, /audit="Oregon DEQ"/)
    assert.match(line, /kind="agency"/)
    assert.match(line, /ran="2026-11-03"/)
    assert.match(line, /readings_as_of="2026-10-14"/)
    assert.match(line, /read="5 documents"/)
    assert.match(line, /found="8 on file, 1 out of date, 5 nothing on file"/)
  })

  test('a template run is named by its checklist, never by an id', () => {
    const t = run({ id: 'r2', kind: 'template', agency_label: null, template_document_id: 'd9' })
    assert.equal(runName(t, 'auditor-list.docx'), 'the checklist auditor-list.docx')
    // No title yet (the reading has not landed): the person's own words, then a plain fallback.
    assert.equal(runName({ ...t, scope: 'the fire form' }, null), 'the checklist the fire form')
    assert.equal(runName(t, null), 'the checklist you attached')
    assert.ok(!runLine(t, 'U1', { templateTitle: null, documentsRead: 1, didNotFinish: 0 }).includes('d9'))
  })

  test('an "all agencies" run says so rather than printing four labels joined', () => {
    assert.equal(runName(run({ id: 'r3', agency_label: 'Oregon DEQ · Oregon OSHA' }), null), 'every agency')
  })

  test('a run still going says how far it got, and a part that failed is named', () => {
    const going = run({ id: 'r4', status: 'running', done_count: 1, section_count: 4, finished_at: null })
    assert.match(runLine(going, 'U1', { templateTitle: null, documentsRead: 2, didNotFinish: 0 }),
      /state="still running, 1 of 4 parts done"/)
    assert.match(runLine(r, 'U1', { templateTitle: null, documentsRead: 5, didNotFinish: 2 }),
      /did_not_finish="2 part\(s\) of this audit did not finish"/)
  })

  /**
   * *** THE WHOLE REASON `runPlain` EXISTS. *** `normalisedWithMap` skips everything between `<`
   * and `>`, so a one-tag line normalises to "" and no quote can ever match it. Documents found
   * this at step 4a-test, six of 36 runs telling a person we could not find words in their own
   * list. The same shape, so the same fix, proved by running the normaliser.
   */
  test('the LINE normalises to nothing, and the PASSAGE does not', () => {
    const line = runLine(r, 'U1', { templateTitle: null, documentsRead: 5, didNotFinish: 0 })
    assert.equal(normalisedWithMap(line).norm, '', 'a self-closing tag is skipped whole')
    const plain = runPlain(r, { templateTitle: null, documentsRead: 5 })
    assert.ok(normalisedWithMap(plain).norm.length > 20, 'the passage must carry real text')
    const passage: Passage = { id: 'U1', title: 't', label: 'your audit', text: plain }
    assert.ok(checkQuote('Oregon DEQ agency 2026-11-03 5 documents', 'U1', [passage]),
      'a quote of the run line must match the passage')
  })
})

describe('a finding, and the suggestion that must not read as a failure', () => {
  test('the four words are the audit\'s own, not a fifth vocabulary', () => {
    assert.deepEqual(Object.keys(FINDING_WORD).sort(),
      ['not_a_document_question', 'nothing_on_file', 'on_file', 'stale'])
    assert.equal(FINDING_WORD.stale, 'out of date')
    assert.equal(FINDING_WORD.nothing_on_file, 'nothing on file')
    // The page's own map, read rather than remembered.
    const page = readFileSync('app/audits/page.tsx', 'utf8')
    for (const [k, v] of Object.entries(FINDING_WORD)) {
      assert.ok(page.includes(`${k}: '${v}'`), `the page says something else for ${k}`)
    }
  })

  test('an expected row is labelled a suggestion, every time', () => {
    const f = finding({ id: 'f1', run_id: 'r1', kind: 'expected', title: 'A Tier II report' })
    const block = findingBlock(f, 'F1', { audit: 'Oregon DEQ, 2026-11-03', documentTitle: null })
    assert.match(block, /this_is="something companies like this usually hold/)
    assert.ok(KIND_WORD.expected.includes('a suggestion, not a finding'))
  })

  test('a plain finding carries no suggestion label', () => {
    const block = findingBlock(finding({ id: 'f2', run_id: 'r1' }), 'F2',
      { audit: 'Oregon DEQ, 2026-11-03', documentTitle: 'The permit' })
    assert.ok(!block.includes('this_is='))
    assert.match(block, /word="nothing on file"/)
    assert.match(block, /document="The permit"/)
  })

  test('a checklist line travels with the finding it answers', () => {
    const block = findingBlock(finding({ id: 'f3', run_id: 'r2', word: 'stale', template_line: 'A1' }),
      'F3', { audit: 'the checklist x.docx, 2026-11-03', documentTitle: 'The permit' })
    assert.match(block, /checklist_line="A1"/)
  })

  test('its body is outside the tags, so a quote matches', () => {
    const f = finding({ id: 'f4', run_id: 'r1', quote: 'Expires: November 15, 2026', what_to_do: 'File the renewal.' })
    const block = findingBlock(f, 'F1', { audit: 'Oregon DEQ, 2026-11-03', documentTitle: 'The permit' })
    assert.ok(normalisedWithMap(block).norm.includes('expiresnovember152026'))
  })

  test('"read" and "inferred" are not pasted into the body as if they were reasoning', () => {
    const block = findingBlock(finding({ id: 'f5', run_id: 'r1', basis: 'read' }), 'F1',
      { audit: 'a', documentTitle: null })
    assert.ok(!/\bread\b/.test(block.split('\n')[1] ?? ''))
  })
})

describe('what the question is answered from, in order', () => {
  const twoRuns = [
    run({ id: 'r1', agency_label: 'Oregon DEQ' }),
    run({ id: 'r2', kind: 'template', agency_label: null, template_document_id: 'd1',
      created_at: '2026-11-02T00:00:00Z', finished_at: '2026-11-02T00:10:00Z' }),
  ]
  const secs = [section({ id: 's1', run_id: 'r1' }), section({ id: 's2', run_id: 'r2', title: 'SECTION A' })]
  const base = {
    runs: twoRuns, sections: secs,
    findings: [
      // f1 points at a document, so the packer has a report to pack — which is the rule being
      // tested below: a document a FINDING names gets its full reading even when the question
      // never mentions it.
      finding({ id: 'f1', run_id: 'r1', document_id: 'd2' }),
      finding({ id: 'f2', run_id: 'r2', section_id: 's2', template_line: 'A1' }),
    ],
    index: [doc({ document_id: 'd1', title: 'auditor-list.docx' }), doc({ document_id: 'd2', title: 'The permit' })],
  }

  test('the blocks are in the owner\'s order', async () => {
    const p = await pack(base)
    assert.deepEqual(p.blocks.map((b) => b.name),
      ['the company', 'your audits', 'the findings', 'your documents', 'the readings'])
  })

  test('every table it reads, by name — the standing instruction\'s own list', async () => {
    const p = await pack(base)
    for (const t of ['audit_runs', 'document_index_v', 'audit_sections', 'audit_findings',
      'document_gaps', 'document_deadlines', 'document_conditions', 'document_corrections', 'company_labels']) {
      assert.ok(p.reads.includes(t), `it no longer reads ${t}`)
    }
  })

  /**
   * The file SAYS `extracted_text` is never sent, so searching it for the string finds its own
   * rule — the trap this programme has fallen into five times now. What is asserted is the column
   * lists, which are the only place it could actually be asked for, and that the rule is written
   * down.
   */
  test('it never asks for extracted_text, and says so', () => {
    for (const cols of [RUN_COLUMNS, FINDING_COLUMNS, SECTION_COLUMNS]) {
      assert.ok(!cols.includes('extracted_text'), 'a column list asks for the raw text of a file')
      assert.ok(!cols.includes('raw_text'), 'a column list asks for a section\'s raw model output')
    }
    const src = readFileSync('lib/ask/auditsBrief.ts', 'utf8')
    assert.match(src, /THE READINGS, NEVER THE FILES/)
    assert.ok(!/select\([^)]*extracted_text/.test(src), 'a select asks for extracted_text')
  })

  test('the passages are U, F, I and R — and never A', async () => {
    const p = await pack(base)
    const letters = [...new Set(p.passages.map((x) => x.id.replace(/\d+$/, '')))].sort()
    assert.deepEqual(letters, ['F', 'I', 'R', 'U'])
  })

  test('a run card opens the audit; a document card opens the document', async () => {
    const p = await pack(base)
    assert.equal(p.passages.find((x) => x.id === 'U1')?.href, '/audits?run=r1')
    assert.equal(p.passages.find((x) => x.id === 'F1')?.href, '/audits?run=r1')
    assert.equal(p.passages.find((x) => x.id === 'I1')?.href, '/documents?document=d1')
  })

  /**
   * §5.1: a read that failed must not look like a company that has never been audited. The chat
   * would otherwise tell a person "you have not audited DEQ" about an audit they ran this morning.
   */
  test('a failed read throws rather than answering "no audits"', async () => {
    await assert.rejects(pack({ ...base, runsError: 'permission denied' }), /audit_runs: permission denied/)
    await assert.rejects(pack({ ...base, indexError: 'boom' }), /document_index_v: boom/)
  })

  test('a company with no audits says so, and still gets its documents', async () => {
    const p = await pack({ index: base.index })
    assert.equal(blockNamed(p, 'your audits')?.text, 'This company has not run an audit yet.')
    assert.match(blockNamed(p, 'your documents')?.text ?? '', /Every document this company holds \(2 in all\)/)
  })

  /**
   * The latest FINISHED run per agency is read off the SECTIONS, not off `agency_label` — an
   * "all agencies" run carries every label in one string (`app/api/audits/index/route.ts:88`).
   */
  test('an unfinished run contributes no findings', async () => {
    const p = await pack({
      ...base,
      runs: [run({ id: 'r1', status: 'running', finished_at: null }), twoRuns[1]],
      findings: [finding({ id: 'f2', run_id: 'r2', section_id: 's2' })],
    })
    const findings = blockNamed(p, 'the findings')?.text ?? ''
    assert.equal((findings.match(/<finding /g) ?? []).length, 1)
  })

  test('the suggestions come last, so the budget protects the real findings', async () => {
    const p = await pack({
      ...base,
      findings: [
        finding({ id: 'f1', run_id: 'r1', kind: 'expected', title: 'A suggestion' }),
        finding({ id: 'f2', run_id: 'r1', kind: 'finding', title: 'A real finding' }),
      ],
    })
    const text = blockNamed(p, 'the findings')?.text ?? ''
    assert.ok(text.indexOf('A real finding') < text.indexOf('A suggestion'))
  })

  test('a date finding is not shown here — it is a calendar row', async () => {
    const p = await pack({
      ...base,
      findings: [finding({ id: 'f1', run_id: 'r1', kind: 'date', word: null, title: 'Permit expires' })],
    })
    assert.equal(blockNamed(p, 'the findings'), undefined)
  })

  test('a document a finding points at gets its full reading, even unnamed by the question', async () => {
    const p = await pack({
      ...base,
      findings: [finding({ id: 'f1', run_id: 'r1', document_id: 'd2' })],
    }, 'how do we stand?')
    assert.match(blockNamed(p, 'the readings')?.text ?? '', /The permit/)
  })

  test('the shares leave the reports the most room', () => {
    assert.ok(RUNS_SHARE + FINDINGS_SHARE + INDEX_SHARE < 0.6)
    assert.equal(RUNS_MAX, 50)
  })
})

describe('the one offer is checked in code, never trusted from the model', () => {
  const known = { agencies: ['Oregon DEQ', 'Oregon OSHA'], attachedDocumentId: 'doc-7' }

  test('an agency the company holds is accepted, in the company\'s own spelling', () => {
    assert.deepEqual(checkRunAuditOffer({ kind: 'run_audit', agency: 'oregon deq' }, known),
      { kind: 'run_audit', agency: 'Oregon DEQ', document_id: null })
  })

  test('"all" is accepted — the box has always taken it', () => {
    assert.deepEqual(checkRunAuditOffer({ kind: 'run_audit', agency: 'all' }, known),
      { kind: 'run_audit', agency: 'all', document_id: null })
  })

  test('an agency the company does NOT hold is dropped', () => {
    assert.equal(checkRunAuditOffer({ kind: 'run_audit', agency: 'Texas TCEQ' }, known), null)
    assert.equal(checkRunAuditOffer({ kind: 'run_audit', agency: '' }, known), null)
  })

  test('a checklist offer may only name the file attached on THIS turn', () => {
    assert.deepEqual(checkRunAuditOffer({ kind: 'run_audit', document_id: 'doc-7' }, known),
      { kind: 'run_audit', agency: null, document_id: 'doc-7' })
    assert.equal(checkRunAuditOffer({ kind: 'run_audit', document_id: 'doc-9' }, known), null)
    assert.equal(checkRunAuditOffer({ kind: 'run_audit', document_id: 'doc-7' },
      { ...known, attachedDocumentId: null }), null)
  })

  test('another kind of offer is not this one', () => {
    assert.equal(checkRunAuditOffer({ kind: 'add_date', agency: 'Oregon DEQ' }, known), null)
    assert.equal(checkRunAuditOffer(null, known), null)
  })

  test('the card says what will happen, in the person\'s words', () => {
    assert.equal(runAuditCardWords({ agency: 'Oregon DEQ', fileName: null }),
      'Do you want me to run the Oregon DEQ audit?')
    assert.equal(runAuditCardWords({ agency: 'all', fileName: null }),
      'Do you want me to audit against every agency?')
    assert.equal(runAuditCardWords({ agency: null, fileName: 'list.docx' }),
      'Do you want me to audit against list.docx?')
  })
})

describe('the words a command writes, and the sentences the owner reads', () => {
  test('decision 39, and no email promise in either line', () => {
    assert.equal(auditsCommandAgencyLine('Oregon DEQ'),
      'Starting the Oregon DEQ audit. It is on the Audits tab.')
    assert.equal(auditsCommandTemplateLine('list.docx', 16, 3),
      'Auditing against list.docx — 16 lines in 3 sections. It is on the Audits tab.')
    assert.equal(auditsCommandTemplateLine('one.pdf', 1, 1),
      'Auditing against one.pdf — 1 line in 1 section. It is on the Audits tab.')
    for (const line of [auditsCommandAgencyLine('Oregon DEQ'), auditsCommandTemplateLine('a', 1, 1)]) {
      assert.ok(!/email/i.test(line), 'the owner struck the email promise')
    }
  })

  test('the three example lines are the owner\'s, word for word', () => {
    assert.deepEqual(AUDITS_EXAMPLE_QUESTIONS.map((e) => e.question), [
      'Audit us against the attached template',
      'Audit us against an agency, like Oregon DEQ',
      'Ask anything about whether you are audit ready',
    ])
  })

  /**
   * The prompt bans the word "compliant" and bans claiming to have run an audit, so a test that
   * searched the sentences for those strings would fail on the sentences that forbid them — the
   * trap this programme has now fallen into five times. Assert the BAN exists.
   */
  test('the sentences carry the bans rather than avoiding the words', () => {
    const all = AUDITS_SENTENCES.join(' ')
    assert.match(all, /Never say "AI"/)
    assert.match(all, /never call this company or anything it holds compliant/)
    assert.match(all, /Never say you have run, are running, or will run an audit/)
    assert.match(all, /Never say the company is ready, in good shape, or in trouble/)
    assert.match(all, /Nothing on file means we have not been shown it/)
    assert.match(all, /Out of date does not mean expired/)
  })

  test('it asks for the offer block but not for a source_url, which this offer has none of', () => {
    const all = AUDITS_SENTENCES.join(' ')
    assert.match(all, /kind "run_audit"/)
    assert.ok(!all.includes('source_url'),
      'the Calendar\'s shared offer sentence demands a link; this offer carries none')
    // The file NAMES the shared sentence in its comment, to say why it is not used. What must not
    // happen is an import of it.
    const file = readFileSync('prompts/audits-answer.ts', 'utf8')
    assert.ok(!/^import .*OFFER_FORMAT_SENTENCE/m.test(file),
      'it must not import the Calendar\'s format sentence')
    assert.ok(!/from '\.\/ask\.ts'/.test(file), 'it must not reach into the shared prompt file at all')
  })

  test('eleven of Documents\' fourteen are imported, not copied', () => {
    const file = readFileSync('prompts/audits-answer.ts', 'utf8')
    // The import statement itself, not the file — the comment above it names three more by way
    // of saying which ones were rewritten.
    const at = file.indexOf("} from './documents-answer.ts'")
    assert.ok(at > 0, 'it no longer imports Documents\' sentences')
    const imported: string[] = file.slice(file.lastIndexOf('import {', at), at).match(/DOCUMENTS_[A-Z_]+/g) ?? []
    assert.equal(new Set(imported).size, 11)
    assert.ok(!imported.includes('DOCUMENTS_NO_OFFERS'), 'the no-offers sentence is replaced, not kept')
    assert.ok(!imported.includes('DOCUMENTS_GIVEN'), 'what it is given is rewritten here')
    assert.ok(!imported.includes('DOCUMENTS_IDS'), 'the ids sentence is rewritten here')
  })
})
