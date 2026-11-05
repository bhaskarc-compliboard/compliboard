/**
 * NIGHT WATCH — `docs/GAPS-PLAN.md` decision 75 (the owner, 4 November 2026).
 *
 * *** EVERY COUNTER GETS A ROW THAT SHOULD MATCH AND A ROW THAT SHOULD NOT. *** That is the
 * owner's instruction, and it is `scripts/audit-data-checks.js`'s rule applied to a unit test: a
 * counter with only a positive case is a counter nobody has watched refuse anything, and a
 * counter with only a negative case is `CLAUDE.md` §9a's check that cannot see a presence.
 *
 * *** AND THE FIXTURES ARE THIS WEEK'S OWN DEFECTS, NOT INVENTED SHAPES. *** Every id, model,
 * price and sentence below is copied out of `docs/GAPS-PLAN.md` §8 or read off staging while the
 * map was written — W2 (a paid reading whose row said the model was never called), W3 (a double
 * press that bought a second audit for $0.49) and W5 (six of ten audit lines writing a bare
 * handle at the person). If the job had existed on 3 November, these are the rows it would have
 * put in the owner's inbox on the 4th.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  answersNoSource, buildReport, cost, duplicateRuns, handlesAtAPerson, handlesIn,
  markersOn, pacificDayString, pacificMidnightUtc, pacificWindow, paidAndUnclaimed,
  pulse, readWithoutTheModel, refusedOn, refusedQuotes, runHref, documentHref, sectionHref,
  sectionsUnparsed, splitByCompany, stuckReading, summaryWithoutSources, templateReadItself,
  thingsToLookAt, wordAgainstAttachments,
  type AiCallRow, type DocumentRow, type FindingRow, type RunRow, type ScanRow,
  type SectionRow, type TopicRow, type TurnRow,
} from '../../lib/quality.ts'
import { COUNTERS, NIGHT_WATCH, deltaWord, subjectLine, windowLine } from '../../lib/qualityWords.ts'
import { NOT_IN_WHAT_WE_HAVE } from '../../lib/askWords.ts'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CASCADE = '95f7167d-1d3f-4004-bb44-dde80d0d4262'
const STEP20 = '61b26cc0-0d28-411b-b2e4-943189363b08'

const turn = (o: Partial<TurnRow> = {}): TurnRow => ({
  id: 't1', topic_id: 'p1', company_id: CASCADE, role: 'assistant',
  text: 'An answer.', sources: [{ n: 1 }], check_record: {}, created_at: '2026-11-04T20:00:00Z', ...o,
})
const topic = (o: Partial<TopicRow> = {}): TopicRow => ({
  id: 'p1', company_id: CASCADE, section: 'audits_chat', title: 'A conversation',
  summary: null, summary_report: null, summarised_at: null, ...o,
})
const finding = (o: Partial<FindingRow> = {}): FindingRow => ({
  id: 'f1', run_id: 'r1', company_id: STEP20, word: 'on_file', title: 'A line',
  basis: 'read', what_to_do: 'Do the thing.', locator: null, document_id: 'd1',
  quote: null, quote_verified: null, handle_error: null, ...o,
})
const section = (o: Partial<SectionRow> = {}): SectionRow => ({
  id: 's1', run_id: 'r1', company_id: STEP20, ordinal: 0, title: 'Section A',
  status: 'done', model: 'claude-haiku-4-5', could_not_complete_reason: null,
  raw_text: null, json_parsed: true, documents_read: [], ...o,
})
const runRow = (o: Partial<RunRow> = {}): RunRow => ({
  id: 'r1', company_id: STEP20, kind: 'template', scope: null, agency_label: null,
  template_document_id: null, created_at: '2026-11-04T18:51:21.728Z', ...o,
})
const scan = (o: Partial<ScanRow> = {}): ScanRow => ({
  id: 'sc1', document_id: 'd1', company_id: STEP20, status: 'done', model: 'claude-opus-5-5',
  could_not_read_reason: null, ai_call_id: 'c1', scanned_at: '2026-11-04T20:00:00Z', ...o,
})
const call = (o: Partial<AiCallRow> = {}): AiCallRow => ({
  id: 'c1', company_id: STEP20, task: 'document_scan', model: 'claude-opus-5-5',
  cost_usd: 0.114168, created_at: '2026-11-04T20:00:00Z', ...o,
})
const doc = (o: Partial<DocumentRow> = {}): DocumentRow => ({
  id: 'd1', company_id: CASCADE, name: 'a-permit.pdf', status: 'read', reading_since: null, ...o,
})
const sectionOf = (...ts: TopicRow[]) => new Map(ts.map((t) => [t.id, t]))

/* ══ THE PACIFIC WINDOW — S-8 ════════════════════════════════════════════════ */

describe('the day is the owner’s day, not the server’s — S-8', () => {
  test('midnight Pacific on a winter day is 08:00 UTC, and on a summer day 07:00', () => {
    // PST is UTC-8, PDT is UTC-7. Proved on staging while the map was written:
    // window_from_utc for 2026-11-04 came back 2026-11-04 08:00:00+00.
    assert.equal(pacificMidnightUtc('2026-11-04'), '2026-11-04T08:00:00.000Z')
    assert.equal(pacificMidnightUtc('2026-07-04'), '2026-07-04T07:00:00.000Z')
  })

  test('⚡ a job at 13:30 UTC reads the PREVIOUS PACIFIC day, not the previous UTC one', () => {
    // 2026-11-05T13:30Z is 05:30 Pacific on the 5th. Yesterday is the 4th, 08:00 to 08:00.
    const w = pacificWindow(new Date('2026-11-05T13:30:00Z'))
    assert.equal(w.day, '2026-11-04')
    assert.equal(w.from, '2026-11-04T08:00:00.000Z')
    assert.equal(w.to, '2026-11-05T08:00:00.000Z')
  })

  test('...and the row that would have been wrong: 02:00 UTC is still the day before in Pacific', () => {
    // 2026-11-05T02:00Z is 18:00 Pacific on the 4th. A UTC reading would call yesterday the 4th;
    // in Pacific terms yesterday is the 3rd, and the 4th is still happening.
    const w = pacificWindow(new Date('2026-11-05T02:00:00Z'))
    assert.equal(pacificDayString(new Date('2026-11-05T02:00:00Z')), '2026-11-04')
    assert.equal(w.day, '2026-11-03')
  })

  test('a spring-forward day still gets a 00:00 Pacific start', () => {
    // 8 March 2026 is the US spring change. The hour 02:00–03:00 does not exist locally; midnight
    // does, and the loop must find it rather than assuming an offset.
    assert.equal(pacificMidnightUtc('2026-03-08'), '2026-03-08T08:00:00.000Z')
    assert.equal(pacificMidnightUtc('2026-03-09'), '2026-03-09T07:00:00.000Z')
  })

  test('a day that is not a date is refused rather than guessed at', () => {
    assert.throws(() => pacificMidnightUtc('not-a-day'), /is not a date/)
  })
})

/* ══ 1 — ANSWERS WITH NO SOURCE ══════════════════════════════════════════════ */

describe('1 · answers with no source', () => {
  test('MATCHES: an assistant turn whose sources array is empty', () => {
    const hits = answersNoSource([turn({ sources: [] })], sectionOf(topic()))
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /audits_chat/)
    // There is no ?topic= anywhere in the product, so the link is the section's own page.
    assert.equal(hits[0].href, '/audits')
  })

  test('MATCHES: sources null, which is not the same JSON shape and must count the same', () => {
    assert.equal(answersNoSource([turn({ sources: null })], sectionOf(topic())).length, 1)
  })

  test('DOES NOT MATCH: an answer carrying one source', () => {
    assert.equal(answersNoSource([turn({ sources: [{ n: 1 }] })], sectionOf(topic())).length, 0)
  })

  test('DOES NOT MATCH: a person’s own turn, which has no sources by definition', () => {
    assert.equal(answersNoSource([turn({ role: 'user', sources: [] })], sectionOf(topic())).length, 0)
  })

  test('an HR answer counts, because HR stores its answers in `turns` like everything else', () => {
    // (m): `app/api/hr/answer/route.ts:66` opens the topic with section 'hr' and :242 saves the
    // turn. So this count needed NOTHING added for HR, and nothing in HR was changed.
    const hits = answersNoSource(
      [turn({ sources: [] })], sectionOf(topic({ section: 'hr' })))
    assert.equal(hits.length, 1)
    assert.equal(hits[0].href, '/hr')
  })
})

/* ══ 2 — QUOTES THAT MATCHED NOTHING ═════════════════════════════════════════ */

describe('2 · quotes that matched nothing', () => {
  test('MATCHES: the shared engine’s structured count', () => {
    const t = turn({ check_record: { quotes_found_in_nothing: 2 } })
    assert.equal(refusedOn(t), 2)
    assert.equal(refusedQuotes([t], sectionOf(topic())).length, 1)
  })

  test('MATCHES: HR’s own key, which is a different key — (m)', () => {
    // `lib/hrAnswer.ts:583` writes marked.not_found_quotes, not quotes_found_in_nothing. Reading
    // only the shared key would watch four sections and silently miss the fifth.
    const t = turn({ check_record: { marked: { not_found_quotes: 1 } } })
    assert.equal(refusedOn(t), 1)
    assert.equal(refusedQuotes([t], sectionOf(topic({ section: 'hr' }))).length, 1)
  })

  test('DOES NOT MATCH: an answer whose check found every quote', () => {
    const t = turn({ check_record: { quotes_found_in_nothing: 0 } })
    assert.equal(refusedOn(t), 0)
    assert.equal(refusedQuotes([t], sectionOf(topic())).length, 0)
  })

  test('⚡ the structured count and the marker in the text are BOTH read, and a disagreement shows', () => {
    // Measured on staging: the two agree on 191 of 192 answers and disagree on one — a 16 October
    // Calendar turn where the structured field says 1 and the marker is absent from the text. A
    // wording change silently zeroes a marker count; it cannot touch a number. So the number leads
    // and the disagreement is said out loud.
    const t = turn({ text: 'An answer with no marker.', check_record: { quotes_found_in_nothing: 1 } })
    assert.equal(markersOn(t), 0)
    const hits = refusedQuotes([t], sectionOf(topic()))
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /which disagrees/)
  })

  test('...and when they agree, nothing about a disagreement is said', () => {
    const t = turn({
      text: `He said "a thing" ${NOT_IN_WHAT_WE_HAVE}`,
      check_record: { quotes_found_in_nothing: 1 },
    })
    assert.equal(markersOn(t), 1)
    assert.doesNotMatch(refusedQuotes([t], sectionOf(topic()))[0].what, /disagrees/)
  })
})

/* ══ 3 — A HANDLE WRITTEN AT A PERSON (W5) ═══════════════════════════════════ */

describe('3 · a handle written at a person — W5', () => {
  test('the regex finds a handle at a word boundary and not inside a word', () => {
    assert.deepEqual(handlesIn('D6 is on file.'), ['D6'])
    assert.deepEqual(handlesIn('see AF2 and D10'), ['AF2', 'D10'])
    assert.deepEqual(handlesIn('the DEQ permit 03-0217-ST-01'), [])
    assert.deepEqual(handlesIn('ADD1 is not a handle'), [])
    assert.deepEqual(handlesIn(null), [])
  })

  test('⚡ AN EPA WASTE CODE IS NOT A HANDLE — found by the first real walk of the page', () => {
    // The page showed "an audit finding says D002" on a Cascade row reading "D002 corrosive waste
    // is a common waste stream at chemical plants". D002 is EPA's code for corrosivity. A handle
    // comes from nextHandle(), which counts from 1 and never pads; EPA's D-codes are always three
    // digits and always padded, so a leading zero separates them completely.
    // Measured over every finding on staging: 57 hits became 56, and the one that dropped is this.
    assert.deepEqual(handlesIn('D002 corrosive waste is a common waste stream at chemical plants'), [])
    assert.deepEqual(handlesIn('wastes D001, D002 and D043'), [])
    // ...and a real handle with the same number of digits still counts.
    assert.deepEqual(handlesIn('D100 is on file'), ['D100'])
    assert.deepEqual(handlesIn('D2 and D002'), ['D2'])
  })

  test('MATCHES: W5’s own sentence, word for word, in a finding’s what_to_do', () => {
    // `docs/GAPS-PLAN.md` §8, W5: "D9 and D10 are blank checklist templates".
    const hits = handlesAtAPerson([], [finding({
      what_to_do: 'D9 and D10 are blank checklist templates: they list these records as expected '
        + 'but contain no records themselves.',
    })], [], sectionOf())
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /D9, D10/)
    assert.equal(hits[0].href, '/audits?run=r1')
  })

  test('MATCHES: an answer in the chat, which is where the audit’s text is inherited', () => {
    const hits = handlesAtAPerson(
      [turn({ text: 'D6 is on file. It is an Oregon DEQ permit.' })], [], [], sectionOf(topic()))
    assert.equal(hits.length, 1)
    assert.equal(hits[0].href, '/audits')
  })

  test('MATCHES: a stored summary', () => {
    const hits = handlesAtAPerson([], [], [topic({ summary: 'Keep AF1 to hand.' })], sectionOf())
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /AF1/)
  })

  test('⚡ DOES NOT MATCH: a handle inside a QUOTE, and that is deliberate', () => {
    // `lib/auditRun.ts:801`-:802 puts title, locator and what_to_do through nameDocumentHandles
    // and leaves `quote` alone, because a quote is word for word or it is nothing. Counting a
    // handle in a quote would ask the fix to break the rule it protects.
    assert.equal(handlesAtAPerson([], [finding({
      what_to_do: 'Nothing to do.', quote: 'the operator shall log D4 daily',
    })], [], sectionOf()).length, 0)
  })

  test('DOES NOT MATCH: a finding whose prose names the document instead, which is the fix', () => {
    assert.equal(handlesAtAPerson([], [finding({
      what_to_do: 'The Oregon DEQ Simple Air Contaminant Discharge Permit is on file.',
    })], [], sectionOf()).length, 0)
  })
})

/* ══ 4 — SECTIONS LOST TO BROKEN JSON ════════════════════════════════════════ */

describe('4 · audit sections lost to broken JSON', () => {
  test('MATCHES: json_parsed false, and the first 200 characters of the raw text come with it', () => {
    // Not a repeating string: `'x '.repeat(n)` would make the tail test pass for the wrong reason,
    // because the characters after 200 also appear before it. Every 20 characters is distinct here.
    const raw = Array.from({ length: 30 }, (_, i) => `chunk${String(i).padStart(2, '0')}-padding `).join('')
    const hits = sectionsUnparsed([section({ json_parsed: false, raw_text: raw })])
    assert.equal(hits.length, 1)
    assert.ok(hits[0].what.includes('chunk00'), 'the head of the raw text goes in')
    assert.ok(hits[0].what.includes('chunk09'), '...and the rest of the first 200 characters')
    assert.ok(!hits[0].what.includes('chunk20'), 'only the first 200 characters go in')
  })

  test('DOES NOT MATCH: a section that parsed', () => {
    assert.equal(sectionsUnparsed([section({ json_parsed: true })]).length, 0)
  })

  test('DOES NOT MATCH: a section with no verdict yet — null is not false', () => {
    assert.equal(sectionsUnparsed([section({ json_parsed: null })]).length, 0)
  })
})

/* ══ 5 — THE WORD AGAINST THE ATTACHMENTS (the owner's answer to S-2) ════════ */

describe('5 · a finding whose word and attachments disagree — S-2', () => {
  test('MATCHES: on_file with no document attached', () => {
    const hits = wordAgainstAttachments([finding({ word: 'on_file', document_id: null })])
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /no document is attached/)
  })

  test('MATCHES: on_file_gaps and stale, which make the same claim', () => {
    assert.equal(wordAgainstAttachments([
      finding({ id: 'f2', word: 'on_file_gaps', document_id: null }),
      finding({ id: 'f3', word: 'stale', document_id: null }),
    ]).length, 2)
  })

  test('MATCHES: a quote on such a finding that failed its own check', () => {
    const hits = wordAgainstAttachments([finding({ quote: 'a quote', quote_verified: false })])
    assert.match(hits[0].what, /quote failed the check/)
  })

  test('MATCHES: handle_error, which the run sets when a handle resolves to nothing', () => {
    assert.match(wordAgainstAttachments([finding({ handle_error: true })])[0].what,
      /handle that resolves to nothing/)
  })

  test('⚡ DOES NOT MATCH: nothing_on_file WITH a document attached — 116 such rows on staging, all correct', () => {
    // The related log IS on file; the specific record asked for is what is absent. Sampled three
    // on staging, all three read correctly, so this is deliberately not one of the arms.
    assert.equal(wordAgainstAttachments([finding({
      word: 'nothing_on_file', document_id: 'e66bdc1d-eddb-47b7-8755-d6faa9702f32',
      what_to_do: 'Produce monthly inspection records on unit tags showing pressure gauge position.',
    })]).length, 0)
  })

  test('⚡ DOES NOT MATCH: the prose the brief’s own regex would have flagged, 16 times in 17', () => {
    // This is a real staging row. `word = on_file` and the sentence says "missing" — about days
    // missing from a log that is genuinely on file. The dropped count (e) matched 17 of these.
    assert.equal(wordAgainstAttachments([finding({
      word: 'on_file',
      title: 'Scrubber pressure-drop log covering the last 12 months',
      what_to_do: 'The log covers August 17–21 with daily readings missing for all five days. '
        + 'September 14 is missing the weekly C-1 check.',
    })]).length, 0)
  })

  test('DOES NOT MATCH: a sound finding', () => {
    assert.equal(wordAgainstAttachments([finding()]).length, 0)
  })
})

/* ══ 6 — READ WITHOUT THE MODEL (W2's row) ═══════════════════════════════════ */

describe('6 · readings that failed before the model was called — W2', () => {
  test('MATCHES: W2’s own row, word for word', () => {
    // `docs/GAPS-PLAN.md` §8: scan c11c6f56, status could_not_read, model '(not called)',
    // reason "Something went wrong at our end while reading this one."
    const hits = readWithoutTheModel([scan({
      id: 'c11c6f56-b37c-45a3-9db0-842c73ae337e', status: 'could_not_read', model: '(not called)',
      could_not_read_reason: 'Something went wrong at our end while reading this one.',
      document_id: 'ad55343c-4152-4d1d-b1b2-956a813a6b93', ai_call_id: null,
    })], new Map([['ad55343c-4152-4d1d-b1b2-956a813a6b93', 'Respirator_Fit_Test_Records_June_2026.pdf']]))
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /Respirator_Fit_Test_Records_June_2026\.pdf/)
    assert.equal(hits[0].href, '/documents?document=ad55343c-4152-4d1d-b1b2-956a813a6b93')
  })

  test('DOES NOT MATCH: a reading that failed AFTER the model was called', () => {
    assert.equal(readWithoutTheModel([scan({
      status: 'could_not_read', model: 'claude-opus-5-5',
    })], new Map()).length, 0)
  })

  test('DOES NOT MATCH: a reading that worked', () => {
    assert.equal(readWithoutTheModel([scan()], new Map()).length, 0)
  })
})

/* ══ 7 — PAID AND UNCLAIMED (the owner's answer to S-3, and W2's money) ══════ */

describe('7 · paid readings no reading claims — S-3', () => {
  test('MATCHES: W2’s own call, with its price, and cost_usd rides on the hit', () => {
    // ai_calls 5cb96667, 19:31:05 UTC, claude-opus-5-5, $0.114168 — two seconds before the scan
    // row landed saying the model was never called.
    const hits = paidAndUnclaimed([call({ id: '5cb96667-8f63-4cf4-a269-2b5bceee59e2' })], new Set())
    assert.equal(hits.length, 1)
    assert.equal(hits[0].cost_usd, 0.114168)
    assert.match(hits[0].what, /\$0\.1142/)
    // A ledger row opens nowhere in the product, and saying so beats a dead link.
    assert.equal(hits[0].href, null)
  })

  test('DOES NOT MATCH: a call a stored reading claims', () => {
    assert.equal(paidAndUnclaimed([call({ id: 'c9' })], new Set(['c9'])).length, 0)
  })

  test('DOES NOT MATCH: a call for a different task', () => {
    assert.equal(paidAndUnclaimed([call({ task: 'audit' })], new Set()).length, 0)
  })

  test('⚡ the FALSE POSITIVE the brief’s own shape produced cannot arise here', () => {
    // The brief asked for "an ai_calls row within 5s of a failed scan with no scan id". That
    // matched B2's deliberately corrupt half-sent-photo.heic — refused before any model call —
    // because the sweep was reading ANOTHER document for the same company in the same five
    // seconds. There is no clock and no company in this anchor, so a refusal that cost nothing
    // can never pair with somebody else's paid call.
    const refusal = scan({
      id: 'heic', status: 'could_not_read', ai_call_id: null,
      could_not_read_reason: 'This photo could not be opened. Share it as JPEG and add it again.',
    })
    const anotherDocumentsCall = call({ id: 'c-other' })
    assert.equal(readWithoutTheModel([refusal], new Map()).length, 0,
      'the HEIC refusal names a real reason, so it is not a (not called) row')
    assert.equal(paidAndUnclaimed([anotherDocumentsCall], new Set(['c-other'])).length, 0,
      'and the paid call beside it IS claimed, so nothing is reported')
  })

  test('a call with no price is carried as null and never as zero', () => {
    const hits = paidAndUnclaimed([call({ cost_usd: null })], new Set())
    assert.equal(hits[0].cost_usd, null)
    assert.match(hits[0].what, /not priced/)
  })
})

/* ══ 8 — A SUMMARY WITH NO SOURCES ═══════════════════════════════════════════ */

describe('8 · summaries with no sources on a conversation that had them — E2f’s regression detector', () => {
  const had = new Map([['p1', [turn({ sources: [{ n: 1 }] })]]])

  test('MATCHES: the staging row from 5 November, 16:33 UTC — under two hours before E2f landed', () => {
    const hits = summaryWithoutSources(
      [topic({ id: 'p1', section: 'calendar', summary_report: { sources: [] } })], had)
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /1 turn carried sources and the summary lists none/)
    assert.equal(hits[0].href, '/calendar')
  })

  test('DOES NOT MATCH: E2f’s own shape — `sources: all`, so the list is never empty', () => {
    assert.equal(summaryWithoutSources(
      [topic({ id: 'p1', summary_report: { sources: [{ n: 1, title: 'a permit' }] } })], had).length, 0)
  })

  test('DOES NOT MATCH: a conversation that never had a source — nothing is missing', () => {
    assert.equal(summaryWithoutSources(
      [topic({ id: 'p1', summary_report: { sources: [] } })],
      new Map([['p1', [turn({ sources: [] })]]])).length, 0)
  })

  test('DOES NOT MATCH: a conversation with no summary at all', () => {
    assert.equal(summaryWithoutSources([topic({ id: 'p1', summary_report: null })], had).length, 0)
  })
})

/* ══ 9 — A TEMPLATE AUDIT THAT READ ITS OWN TEMPLATE (W6) ════════════════════ */

describe('9 · a template audit that read its own template — W6, closed by decision 49', () => {
  test('MATCHES: E0’s own BEFORE tree, with its scope string, which is how it is read as deliberate', () => {
    const hits = templateReadItself(
      [runRow({ id: '19815fc9-fbd1-4c4f-90a5-b4c84a2a5ee8', template_document_id: '511e8bcd',
        scope: 'E0 BEFORE: Audit us against the attached template.' })],
      [section({ run_id: '19815fc9-fbd1-4c4f-90a5-b4c84a2a5ee8', documents_read: ['c09c05f4', '511e8bcd'] })])
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /E0 BEFORE/)
  })

  test('DOES NOT MATCH: decision 49’s shape — the template is out of documents_read', () => {
    assert.equal(templateReadItself(
      [runRow({ template_document_id: '511e8bcd' })],
      [section({ documents_read: ['c09c05f4', '8217466d'] })]).length, 0)
  })

  test('DOES NOT MATCH: an agency run, which has no template to read', () => {
    assert.equal(templateReadItself(
      [runRow({ kind: 'agency', template_document_id: null, agency_label: 'Oregon DEQ' })],
      [section({ documents_read: ['c09c05f4'] })]).length, 0)
  })

  test('DOES NOT MATCH: documents_read null, which is not an empty array', () => {
    assert.equal(templateReadItself(
      [runRow({ template_document_id: '511e8bcd' })],
      [section({ documents_read: null })]).length, 0)
  })
})

/* ══ 10 — STUCK READING, AND THE PULSE (S-4) ═════════════════════════════════ */

describe('10 · documents stuck reading, and the jobs’ pulse — S-4', () => {
  const now = new Date('2026-11-05T20:00:00Z')

  test('MATCHES: claimed over an hour ago', () => {
    const hits = stuckReading([doc({
      status: 'reading', reading_since: '2026-11-05T18:00:00Z',
    })], now)
    assert.equal(hits.length, 1)
    assert.match(hits[0].what, /claimed 120 minutes ago/)
    assert.equal(hits[0].href, '/documents?document=d1')
  })

  test('DOES NOT MATCH: claimed fourteen minutes ago — inside the sweep’s own recovery window', () => {
    // STUCK_AFTER_MS is 900_000 and the sweep runs every five minutes, so anything under an hour
    // is the sweep working. Any number above zero here means the sweep has stopped.
    assert.equal(stuckReading([doc({ reading_since: '2026-11-05T19:46:00Z' })], now).length, 0)
  })

  test('DOES NOT MATCH: a document that is not claimed at all', () => {
    assert.equal(stuckReading([doc({ reading_since: null })], now).length, 0)
  })

  test('the pulse takes the NEWEST row per job and counts the open ones', () => {
    const p = pulse([
      { id: 'j1', job: 'scan_documents', started_at: '2026-11-05T19:55:00Z', finished_at: '2026-11-05T19:56:00Z' },
      { id: 'j2', job: 'scan_documents', started_at: '2026-11-05T19:50:00Z', finished_at: '2026-11-05T19:51:00Z' },
      { id: 'j3', job: 'summarise', started_at: '2026-11-05T10:00:00Z', finished_at: null },
    ], now)
    assert.deepEqual(p.map((x) => x.job), ['scan_documents', 'summarise'])
    assert.equal(p[0].minutes_ago, 5)
    assert.equal(p[0].open_rows, 0)
    assert.equal(p[1].open_rows, 1, 'a row with no finished_at is a job that crashed half way')
  })

  test('a job that has never run says so rather than reading as nought minutes ago', () => {
    assert.deepEqual(pulse([], now), [])
  })

  test('⚡ THE RUN\u2019S OWN ROW IS EXCLUDED FROM BOTH JOB_RUNS READS — the first real run mailed it', () => {
    // `startJobRun` opens a row before any work, so at read time the newest `quality` row is this
    // run and its finished_at is null. The first staging run mailed "quality · last started -1 min
    // ago · 1 row left open" — a permanent false alarm in the one block that exists to say when
    // something is hanging. Excluding it from the OPEN list alone was not enough.
    const JOB = read('app/api/jobs/quality/route.ts')
    const block = code(JOB).slice(code(JOB).indexOf('const jobRuns'))
    assert.equal((block.match(/\.neq\('id', run\.id\)/g) ?? []).length, 2,
      'both the newest-per-job read and the open-rows read must exclude this run\u2019s own row')
    // ...and the pulse itself must never print a negative age, which was the symptom.
    const p = pulse([{ id: 'j', job: 'quality', started_at: '2026-11-05T19:00:00Z', finished_at: null }], now)
    assert.equal(p[0].minutes_ago, 60)
  })
})

/* ══ 11 — DUPLICATE RUNS (W3) ════════════════════════════════════════════════ */

describe('11 · audit runs started twice within a minute — W3', () => {
  test('MATCHES: W3’s own pair, six seconds apart, same template', () => {
    // 8707eea9 at 19:38:23.010 and 45724268 at 19:38:29.020 — same template_document_id, same
    // scope, identical summaries. The second run's three sections cost $0.4924.
    const hits = duplicateRuns([
      runRow({ id: '8707eea9-6c58-4c98-ab9d-4ec5825642cd', template_document_id: '511e8bcd',
        created_at: '2026-11-03T19:38:23.010Z' }),
      runRow({ id: '45724268-c3e2-45c4-a2d0-75be0dcded04', template_document_id: '511e8bcd',
        created_at: '2026-11-03T19:38:29.020Z' }),
    ])
    assert.equal(hits.length, 1)
    assert.equal(hits[0].id, '45724268-c3e2-45c4-a2d0-75be0dcded04')
    assert.match(hits[0].what, /6s after 8707eea9/)
  })

  test('DOES NOT MATCH: two minutes apart', () => {
    assert.equal(duplicateRuns([
      runRow({ id: 'a', template_document_id: 't', created_at: '2026-11-03T19:38:00Z' }),
      runRow({ id: 'b', template_document_id: 't', created_at: '2026-11-03T19:40:00Z' }),
    ]).length, 0)
  })

  test('DOES NOT MATCH: two different agencies in the same minute — that is one person, two audits', () => {
    assert.equal(duplicateRuns([
      runRow({ id: 'a', kind: 'agency', agency_label: 'Oregon DEQ', created_at: '2026-11-03T19:38:00Z' }),
      runRow({ id: 'b', kind: 'agency', agency_label: 'Oregon OSHA', created_at: '2026-11-03T19:38:20Z' }),
    ]).length, 0)
  })

  test('DOES NOT MATCH: two companies that happened to press at once', () => {
    assert.equal(duplicateRuns([
      runRow({ id: 'a', company_id: CASCADE, agency_label: 'Oregon DEQ', created_at: '2026-11-03T19:38:00Z' }),
      runRow({ id: 'b', company_id: STEP20, agency_label: 'Oregon DEQ', created_at: '2026-11-03T19:38:05Z' }),
    ]).length, 0)
  })
})

/* ══ WHAT YESTERDAY COST ═════════════════════════════════════════════════════ */

describe('what yesterday cost — `scripts/cost-report.js`’s shape, with its two holes', () => {
  test('⚡ the real 4 November numbers: audit at 5.7× its seven-day average', () => {
    // Read off staging while the map was written: audit 47 calls $1.3426 against avg7 $0.2350.
    const day = Array.from({ length: 47 }, (_, i) =>
      call({ id: `a${i}`, task: 'audit', cost_usd: 1.3426 / 47 }))
    const prior = Array.from({ length: 7 }, (_, i) =>
      call({ id: `p${i}`, task: 'audit', cost_usd: 0.2350 }))
    const c = cost(day, prior)
    assert.equal(c.calls, 47)
    assert.equal(c.by_task[0].task, 'audit')
    assert.equal(c.by_task[0].usd, 1.3426)
    assert.equal(c.by_task[0].avg7, 0.235)
    assert.equal(c.by_task[0].over_2x, true)
  })

  test('DOES NOT FLAG: a task at its usual level', () => {
    const c = cost([call({ task: 'documents', cost_usd: 0.03 })],
      Array.from({ length: 7 }, (_, i) => call({ id: `p${i}`, task: 'documents', cost_usd: 0.25 })))
    assert.equal(c.by_task[0].over_2x, false)
  })

  test('⚡ DOES NOT FLAG a task with no history, because 2 × 0 is 0 and everything beats it', () => {
    const c = cost([call({ task: 'website', cost_usd: 0.01 })], [])
    assert.equal(c.by_task[0].avg7, 0)
    assert.equal(c.by_task[0].over_2x, false)
  })

  test('an unpriced call is counted as unpriced and NEVER as zero — cost-report.js’s own rule', () => {
    const c = cost([call({ cost_usd: null }), call({ id: 'c2', cost_usd: 0.5 })], [])
    assert.equal(c.unpriced, 1)
    assert.equal(c.usd, 0.5, 'the total is honest about being low rather than inventing a number')
  })

  test('the top companies are the top five by spend, not by call count', () => {
    const c = cost([
      call({ id: '1', company_id: 'a', cost_usd: 0.01 }),
      call({ id: '2', company_id: 'a', cost_usd: 0.01 }),
      call({ id: '3', company_id: 'b', cost_usd: 1.0 }),
    ], [])
    assert.deepEqual(c.top_companies.map((t) => t.company_id), ['b', 'a'])
  })
})

/* ══ THE REPORT, THE SPLIT AND THE SUBJECT ═══════════════════════════════════ */

describe('the report as a whole', () => {
  const now = new Date('2026-11-05T13:30:00Z')
  const base = {
    now, turns: [] as TurnRow[], turnsOfSummarised: [] as TurnRow[],
    topicsById: new Map<string, TopicRow>(), summarisedTopics: [] as TopicRow[],
    runs: [] as RunRow[], sections: [] as SectionRow[], findings: [] as FindingRow[],
    scans: [] as ScanRow[], documentNames: new Map<string, string>(),
    callsDay: [] as AiCallRow[], callsPrior7: [] as AiCallRow[],
    claimedCallIds: new Set<string>(), stuckDocuments: [] as DocumentRow[],
    jobRuns: [] as never[],
  }

  test('a quiet night is eleven zeroes, and the subject says nothing to look at', () => {
    const r = buildReport(base)
    for (const c of COUNTERS) assert.equal((r.hits[c.key] ?? []).length, 0, c.key)
    assert.equal(thingsToLookAt(r.hits), 0)
    assert.equal(subjectLine('2026-11-04', 0), 'Night Watch · 2026-11-04 · nothing to look at')
  })

  test('⚡ the cost and the pulse NEVER count toward "things to look at"', () => {
    // A number that is always there is not a thing to look at, and a subject line that says "2"
    // on a quiet day teaches a person to ignore the subject line.
    // The task is `audit` and not `document_scan`: an unclaimed document_scan call is counter 7
    // firing correctly, which is what the first draft of this test accidentally proved.
    const r = buildReport({ ...base, callsDay: [call({ task: 'audit', cost_usd: 99 })] })
    assert.ok(r.cost.usd > 0)
    assert.equal(thingsToLookAt(r.hits), 0)

    // ...and the proof that the distinction is real: the same call as a document_scan DOES count.
    const scanCall = buildReport({ ...base, callsDay: [call({ task: 'document_scan', cost_usd: 99 })] })
    assert.equal(thingsToLookAt(scanCall.hits), 1)
  })

  test('each counter that fires adds exactly one to the subject’s n', () => {
    const r = buildReport({
      ...base,
      turns: [turn({ sources: [] })],
      topicsById: sectionOf(topic()),
      findings: [finding({ word: 'on_file', document_id: null })],
    })
    assert.equal(thingsToLookAt(r.hits), 2)
    assert.equal(subjectLine('2026-11-04', 2), 'Night Watch · 2026-11-04 · 2 things to look at')
    assert.equal(subjectLine('2026-11-04', 1), 'Night Watch · 2026-11-04 · 1 thing to look at')
  })

  test('⚡ THE TOTALS ROW CARRIES NO ROW IDS, which migration 095 also refuses in the database', () => {
    const r = buildReport({
      ...base, turns: [turn({ sources: [] })], topicsById: sectionOf(topic()),
    })
    const rows = splitByCompany('2026-11-04', r)
    const totals = rows.find((x) => x.company_id === null)
    assert.ok(totals, 'there is always a totals row')
    assert.deepEqual(totals.rows, {}, 'the row that spans companies must not point at anybody')
    assert.equal(totals.counts.answers_no_source, 1)
  })

  test('a company’s own row carries its ids, and only its own', () => {
    const r = buildReport({
      ...base,
      turns: [turn({ id: 'mine', sources: [] }),
        turn({ id: 'theirs', topic_id: 'p2', company_id: STEP20, sources: [] })],
      topicsById: sectionOf(topic(), topic({ id: 'p2', company_id: STEP20 })),
    })
    const rows = splitByCompany('2026-11-04', r)
    const mine = rows.find((x) => x.company_id === CASCADE)
    assert.equal(mine?.counts.answers_no_source, 1)
    assert.deepEqual(mine?.rows.answers_no_source?.map((h) => h.id), ['mine'])
    assert.equal(rows.length, 3, 'two companies and one totals row')
  })

  test('a count of zero writes no ids at all, so a quiet company’s row stays small', () => {
    const r = buildReport({ ...base, turns: [turn({ sources: [] })], topicsById: sectionOf(topic()) })
    const mine = splitByCompany('2026-11-04', r).find((x) => x.company_id === CASCADE)
    assert.equal(mine?.counts.refused_quotes, 0)
    assert.equal(mine?.rows.refused_quotes, undefined)
  })

  test('the deltas read against the previous day, and say so when there is no previous day', () => {
    assert.equal(deltaWord(3, 1), '+2 on the day before')
    assert.equal(deltaWord(1, 3), '−2 on the day before')
    assert.equal(deltaWord(2, 2), 'same as the day before')
    assert.equal(deltaWord(2, null), 'no row yesterday')
  })

  test('the email’s first line states the window it read, in Pacific, with the date', () => {
    const w = pacificWindow(new Date('2026-11-05T13:30:00Z'))
    const line = windowLine(w.day, w.from, w.to)
    assert.match(line, /2026-11-04, Pacific time/)
    assert.match(line, /midnight to midnight/)
    assert.ok(line.includes(w.from) && line.includes(w.to))
  })
})

/* ══ THE SHAPE OF WHAT SHIPS ═════════════════════════════════════════════════ */

describe('the shape of what ships', () => {
  const JOB = read('app/api/jobs/quality/route.ts')
  const API = read('app/api/quality/route.ts')
  const PAGE = read('app/quality/page.tsx')
  const AUTH = read('lib/auth.ts')
  const JOB_CODE = code(JOB)
  const API_CODE = code(API)

  test('⚡ NO FILE IN THIS FEATURE IMPORTS ANYTHING THAT CAN REACH `lib/ai.ts`', () => {
    // Decision 75: it never calls a model. The real proof is check 3 in
    // scripts/check-schema-contracts.js, which computes the transitive closure and keeps
    // PAID_COUNT at 23. This is the cheap one that fails in the suite rather than at build.
    // The CODE, not the comments: each file EXPLAINS that it does not call requireAccess, and a
    // test that read the prose would fail on the explanation of the very thing it is checking.
    for (const [name, src] of [['job', JOB_CODE], ['api', API_CODE], ['page', code(PAGE)],
      ['lib/quality.ts', code(read('lib/quality.ts'))],
      ['lib/qualityWords.ts', code(read('lib/qualityWords.ts'))]] as const) {
      assert.doesNotMatch(src, /from '@?\.?\.?\/?lib\/ai'/, `${name} must not import lib/ai`)
      assert.doesNotMatch(src, /@anthropic-ai|api\.anthropic\.com/, `${name} must not reach the SDK`)
      assert.doesNotMatch(src, /requireAccess/, `${name} spends nothing, so it needs no paid gate`)
    }
  })

  test('the words file imports nothing, which is what makes the page able to use it', () => {
    const words = read('lib/qualityWords.ts')
    assert.doesNotMatch(code(words), /^\s*import /m,
      'lib/qualityWords.ts must import nothing — tests/unit/clientImports.test.ts holds the same rule')
  })

  test('the job writes only its own two tables', () => {
    const writes = [...JOB_CODE.matchAll(/\.from\('([a-z_]+)'\)\s*\n?\s*\.(insert|update|upsert|delete)/g)]
      .map((m) => m[1])
    for (const t of writes) {
      assert.ok(['quality_reports', 'job_runs'].includes(t),
        `the job must not write ${t} — it is read-only on everything a customer can see`)
    }
    assert.match(JOB_CODE, /from\('quality_reports'\)\s*\n?\s*\.upsert/, 'it does write its own report')
  })

  test('the job is behind the cron secret, on both doors', () => {
    assert.match(JOB_CODE, /requireCronSecret\(request\)/)
    assert.match(JOB_CODE, /export async function GET/)
    assert.match(JOB_CODE, /export async function POST/)
  })

  test('the owner’s route is behind `requireOwner` and nothing else reads the table', () => {
    assert.match(API_CODE, /requireOwner\(request\)/)
    assert.match(API_CODE, /supabaseAdmin\s*\n?\s*\.from\('quality_reports'\)/)
    assert.doesNotMatch(API_CODE, /\.(insert|update|upsert|delete)\(/,
      'the page’s route reads; the job is the only writer')
  })

  test('⚡ `requireOwner` refuses everyone when QUALITY_EMAIL is unset, and answers 404 always', () => {
    // cronVerdict's rule: `if (want && given !== want)` would open the page to every signed-in
    // customer on a deploy where the variable was never set, and would look like a page that works.
    // From `OwnerAuth`, because `OWNER_NOT_FOUND` — the thing that carries the status — is
    // declared between the type and the function.
    const fn = code(AUTH.slice(AUTH.indexOf('export type OwnerAuth')))
    assert.match(fn, /if \(!want\)/, 'an unset variable is a refusal, not a pass')
    assert.doesNotMatch(fn, /status: 40[13]/, 'every refusal is 404 — §3.6, 404-not-403')
    const codes = [...fn.matchAll(/status: (\d+)/g)].map((m) => m[1])
    assert.ok(codes.length > 0 && codes.every((c) => c === '404'), `only 404s, got ${codes.join(',')}`)
    assert.match(fn, /toLowerCase\(\)/, 'addresses compare case-insensitively')
  })

  test('`requireCompany` and `AuthedCompany` are untouched, so their ten callers keep their shape', () => {
    assert.match(AUTH, /return \{ ok: true, auth: \{ userId: user\.id, companyId: profile\.company_id, db \} \}/)
    assert.match(AUTH, /export type AuthedCompany = \{\n\s*\/\*\* The authenticated user's id/)
    const shape = AUTH.slice(AUTH.indexOf('export type AuthedCompany'), AUTH.indexOf('export async function requireCompany'))
    assert.doesNotMatch(shape, /email/, 'no email was added to the shared type')
  })

  test('the email sends from `SANDBOX_FROM` and not a literal, and says why it skips the guard', () => {
    assert.match(JOB_CODE, /from: SANDBOX_FROM/)
    assert.doesNotMatch(JOB_CODE, /onboarding@resend\.dev/,
      'four of the six senders hold the address as a literal; this one must not be the fifth')
    assert.doesNotMatch(JOB_CODE, /sandboxSenderRefusal/)
    assert.match(JOB, /THE ONE EMAIL THAT SENDS FROM THE SANDBOX ADDRESS ON PRODUCTION, DELIBERATELY/,
      'a guard that is deliberately not called needs its reason at the line')
  })

  test('staging’s recipient is NOTIFY_TEST_TO, as every other sender does', () => {
    assert.match(JOB_CODE, /NOTIFY_TEST_TO/)
    assert.match(JOB_CODE, /override \|\| \(process\.env\.QUALITY_EMAIL/)
  })

  test('every read pages, so a thousand-row day cannot be silently truncated', () => {
    const reads = [...JOB_CODE.matchAll(/all<[^>]+>\('/g)].length
    assert.ok(reads >= 9, `expected every windowed read to go through all(), found ${reads}`)
    assert.match(JOB_CODE, /rows\.length < PAGE/, 'it pages until a short page comes back')
    assert.match(JOB_CODE, /if \(error\) throw new Error/, 'an error is not an empty result')
  })

  test('the cron entry is in vercel.json at 13:30 UTC, which is 05:30 Pacific in winter', () => {
    const v = JSON.parse(read('vercel.json')) as { crons: Array<{ path: string; schedule: string }> }
    const mine = v.crons.find((c) => c.path === '/api/jobs/quality')
    assert.ok(mine, 'the job has no cron entry')
    assert.equal(mine.schedule, '30 13 * * *')
    // After the summariser (10:00) and the deleter (10:30), so nothing it reads is still moving.
    assert.ok(v.crons.some((c) => c.path === '/api/jobs/summarise' && c.schedule === '0 10 * * *'))
  })

  test('`quality_reports` is in /api/account DELETE’s list, so a company deletion clears it', () => {
    const acct = read('app/api/account/route.ts')
    const list = acct.slice(acct.indexOf('const COMPANY_SCOPED_TABLES'), acct.indexOf('const DELETED_BY_CASCADE_OR_PARENT'))
    assert.match(list, /'quality_reports'/)
  })

  test('migration 095 restates all eight job words and revokes from both roles', () => {
    const m = read('supabase/migrations/095_night_watch_the_nightly_read_only_finder.sql')
    for (const w of ['summarise', 'delete', 'account_delete', 'scan_documents',
      'audit_sections', 'handbook_checks', 'calendar_month', 'quality']) {
      assert.match(m, new RegExp(`'${w}'`), `job_runs_job_check must still name ${w}`)
    }
    assert.match(m, /revoke all on table public\.quality_reports from anon/)
    assert.match(m, /revoke all on table public\.quality_reports from authenticated/)
    assert.doesNotMatch(m, /grant [a-z, ]+ on table public\.quality_reports to (anon|authenticated)/,
      'nobody is granted anything on this table')
    assert.match(m, /unique nulls not distinct/)
    assert.match(m, /has_table_privilege/)
  })

  test('the page is linked from nowhere, which is recorded rather than accidental', () => {
    assert.match(PAGE, /IT IS LINKED FROM NOWHERE, ON PURPOSE/)
    // And nothing in the app links to it, which is the claim that comment makes.
    for (const f of ['components/AppLayout.tsx', 'app/dashboard/page.tsx']) {
      assert.doesNotMatch(read(f), /href="\/quality"/, `${f} must not link Night Watch`)
    }
  })

  test('the name people see is Night Watch, and the machine word stays `quality`', () => {
    assert.equal(NIGHT_WATCH, 'Night Watch')
    assert.match(subjectLine('2026-11-04', 1), /^Night Watch/)
    assert.match(JOB_CODE, /startJobRun\(admin, 'quality'\)/)
    assert.match(read('vercel.json'), /\/api\/jobs\/quality/)
  })

  test('the eleven counters each have a title, a why, a provenance and a scope', () => {
    assert.equal(COUNTERS.length, 11, 'twelve were asked for; (e) was dropped after it was measured')
    for (const c of COUNTERS) {
      assert.ok(c.title.length > 3, c.key)
      assert.ok(c.why.length > 20, `${c.key} needs a sentence saying what a non-zero number MEANS`)
      assert.ok(c.found.length > 5, `${c.key} needs to say where the shape was first found`)
      assert.ok(['day', 'now'].includes(c.scope), c.key)
    }
    assert.deepEqual(COUNTERS.filter((c) => c.scope === 'now').map((c) => c.key), ['stuck_reading'])
  })

  test('every counter key the words name is one the report actually produces', () => {
    const r = buildReport({
      now: new Date('2026-11-05T13:30:00Z'),
      turns: [], turnsOfSummarised: [], topicsById: new Map(), summarisedTopics: [],
      runs: [], sections: [], findings: [], scans: [], documentNames: new Map(),
      callsDay: [], callsPrior7: [], claimedCallIds: new Set(), stuckDocuments: [], jobRuns: [],
    })
    assert.deepEqual(Object.keys(r.hits).sort(), COUNTERS.map((c) => c.key).sort(),
      'a words row with no counter behind it is a count nobody computes')
  })

  test('the hrefs are only the parameters the product actually reads', () => {
    assert.equal(runHref('r'), '/audits?run=r')
    assert.equal(documentHref('d'), '/documents?document=d')
    assert.equal(sectionHref('audits_chat'), '/audits')
    assert.equal(sectionHref('hr'), '/hr')
    // There is no ?topic= on any page, so an unknown section links nowhere rather than to a guess.
    assert.equal(sectionHref('something_new'), null)
    // The CODE, not the comments — the comment above `SECTION_PATHS` names `?topic=` to say it
    // does not exist, and a test that read the comment would fail on the explanation.
    assert.doesNotMatch(code(read('lib/quality.ts')), /\?topic=/)
  })
})
