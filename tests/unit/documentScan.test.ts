/**
 * THE DOCUMENT SCAN'S OWN RULES — `lib/documentScan.ts`, Documents Run 1.
 *
 * These pin the two things the scan promises that nothing else enforces: a quote is checked
 * against the file it claims to come from, and a paid answer is never discarded.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { verifyQuote, normaliseScan, failedScan, refusedScan, apiFailureStatus } from '../../lib/documentScan.ts'
 import { extractJsonText } from '../../lib/ai.ts'

describe('a quote is checked against the document', () => {
  const text = 'The rota for next month is on the noticeboard by the walk-in.'

  test('a quote that is in the text verifies', () => {
    assert.equal(verifyQuote('on the noticeboard by the walk-in', text), true)
  })

  test('a quote that is NOT in the text fails, and is not quietly excused', () => {
    assert.equal(verifyQuote('staff must wear steel toe caps at all times', text), false)
  })

  test('punctuation, case and spacing do not make a quote invented', () => {
    // The model reflows whitespace, straightens quotation marks and turns hyphens into dashes.
    assert.equal(verifyQuote('THE ROTA — for next month, is  on the noticeboard', text), true)
  })

  test('HTML TAGS ARE STRIPPED FIRST — the .docx false negative', () => {
    // parseDocumentToBlocks returns Word as HTML, so a sentence split across two paragraphs
    // arrives with a tag in the middle. Before this was handled, a quote that IS in the file
    // came back unverified — measured on the kitchen-rota fixture.
    const html = '<p>If you want to swap a shift,</p><p>write it on the sheet and tell Dana.</p>'
    assert.equal(verifyQuote('If you want to swap a shift, write it on the sheet and tell Dana.', html), true)
  })

  test('no text to check against is NULL, which is not the same as false', () => {
    // A PDF goes to the model whole and yields no extractable text here. "We could not check"
    // must not be recorded as "we checked and it failed".
    assert.equal(verifyQuote('anything at all', ''), null)
    assert.equal(verifyQuote(null, 'some text'), null)
  })

  test('a fragment too short to be evidence is not scored', () => {
    assert.equal(verifyQuote('the', 'the rota'), null)
  })
})

describe('what comes back is never trusted as given', () => {
  test('an unrecognised status becomes not_judged, not something valid-looking', () => {
    assert.equal(normaliseScan({ status: 'compliant' }, '').status, 'not_judged')
    assert.equal(normaliseScan({ status: 'all good' }, '').status, 'not_judged')
  })

  test('an unrecognised kind becomes null rather than being forced into the list', () => {
    assert.equal(normaliseScan({ identity: { kind: 'sds' } }, '').identity.kind, null)
    assert.equal(normaliseScan({ identity: { kind: 'permit' } }, '').identity.kind, 'permit')
  })

  test('a date that is not a date is dropped, not passed to the database', () => {
    assert.equal(normaliseScan({ identity: { doc_date: 'sometime in 2024' } }, '').identity.doc_date, null)
    assert.equal(normaliseScan({ identity: { doc_date: '2024-03-01' } }, '').identity.doc_date, '2024-03-01')
  })

  test('the string "null" is null — models write it', () => {
    assert.equal(normaliseScan({ summary: 'null' }, '').summary, null)
  })

  test('missing arrays are empty arrays, and an empty array is a real answer', () => {
    const s = normaliseScan({}, '')
    assert.deepEqual(s.gaps, []); assert.deepEqual(s.facts, [])
    assert.deepEqual(s.conditions, []); assert.deepEqual(s.deadlines, [])
    assert.deepEqual(s.identity.agencies, [])
  })

  test('a gap keeps its quote and its verdict — a failed check does not drop the gap', () => {
    const s = normaliseScan({ gaps: [{ title: 'g', quote: 'not in the document at all here' }] }, 'entirely different words')
    assert.equal(s.gaps.length, 1)
    assert.equal(s.gaps[0].quote, 'not in the document at all here')
    assert.equal(s.gaps[0].quote_verified, false)
  })
})

describe('extractJsonText survives prose AFTER the JSON', () => {
  // The model answers in JSON and then adds a paragraph. Before 25 September the extractor only
  // trimmed narration BEFORE the object, so a response that opened with the JSON kept whatever
  // followed it and JSON.parse failed. Three 500s came from this one character.
  test('a fenced object with a trailing paragraph parses', () => {
    const raw = '```json\n{"a": 1}\n```\n\nAnd one more thing you should know about this document.'
    assert.deepEqual(JSON.parse(extractJsonText(raw)), { a: 1 })
  })

  test('narration before AND after still parses', () => {
    const raw = 'Let me read this.\n{"a": 1}\nHope that helps.'
    assert.deepEqual(JSON.parse(extractJsonText(raw)), { a: 1 })
  })

  test('a clean response is returned unchanged — the fix is a no-op where it always worked', () => {
    const raw = '{"a": 1, "b": [2, 3]}'
    assert.equal(extractJsonText(raw), raw)
  })

  test('an array answer still works', () => {
    assert.deepEqual(JSON.parse(extractJsonText('```json\n[1,2]\n```\ntrailing words')), [1, 2])
  })
})

describe('same_as_gap_id — the one id the model is asked for, Run 6', () => {
  // Run 5 carried a checklist across a re-scan by matching gap TITLES, and Run 5 also measured
  // that the model renames every finding between two readings of the same file. So the scan is
  // now shown the open gaps with their ids and names its own predecessor. That id reaches a
  // database UPDATE, which is why it is read back through `normaliseScan` rather than trusted.

  const scanWith = (sameAs: unknown) => normaliseScan({
    identity: { kind: 'program' },
    gaps: [{ title: 'No reporting procedure', same_as_gap_id: sameAs }],
  }, '')

  test('an id the model gave is carried onto the shape', () => {
    assert.equal(scanWith('7a5e0a10-1111-4222-8333-444444444444').gaps[0].same_as_gap_id,
      '7a5e0a10-1111-4222-8333-444444444444')
  })

  test('THE EMPTY ANSWER IS NULL, not the empty string', () => {
    // The JSON schema cannot express a nullable string here (the API caps union types), so the
    // model answers "" for "this is a new finding". Anything that reaches `saveScan` as "" and
    // is then compared against a list of ids would be a silent no-match rather than a stated one.
    assert.equal(scanWith('').gaps[0].same_as_gap_id, null)
    assert.equal(scanWith(undefined).gaps[0].same_as_gap_id, null)
    assert.equal(scanWith('null').gaps[0].same_as_gap_id, null)
  })

  test('a gap with no same_as at all is a new finding, not an error', () => {
    const scan = normaliseScan({ identity: { kind: 'program' }, gaps: [{ title: 'Something else' }] }, '')
    assert.equal(scan.gaps[0].same_as_gap_id, null)
    assert.equal(scan.gaps[0].title, 'Something else')
  })
})

describe('a refused MODEL CALL is not a file we could not open — 26 September 2026', () => {
  // The first production scan on claude-opus-5 was refused by the API for its schema's size, and
  // the message the owner saw told them to re-export a PDF that read perfectly two minutes later.
  // These pin the two halves of the fix: the failure is identified structurally, and the sentence
  // makes no claim about the customer's file.

  const refusal = Object.assign(new Error(
    'The compiled grammar is too large, which would cause performance issues. '
    + 'Simplify your tool schemas or reduce the number of strict tools.'), { status: 400 })

  test('an API error is identified by its numeric status, never by its words', () => {
    assert.equal(apiFailureStatus(refusal), 400)
    assert.equal(apiFailureStatus(Object.assign(new Error('overloaded'), { status: 529 })), 529)
  })

  test('a plain Error is NOT an API failure — it is rethrown, not described', () => {
    // A bug of our own reported to a customer as a refusal by Anthropic is a different lie from
    // the one being removed, so the test that matters here is the negative.
    assert.equal(apiFailureStatus(new Error('Cannot read properties of undefined')), null)
    assert.equal(apiFailureStatus(new TypeError('x is not a function')), null)
    assert.equal(apiFailureStatus('a string'), null)
    assert.equal(apiFailureStatus(null), null)
    assert.equal(apiFailureStatus(Object.assign(new Error('weird'), { status: '400' })), null)
  })

  const scan = refusedScan({
    error: refusal, model: 'claude-opus-5', status: 400,
    extractedText: 'EMERGENCY ACTION PLAN', startedAt: '2026-09-26T17:49:00.000Z',
    structured: true, promptSha: 'abc123',
  })

  test('the reason blames the reading service and says nothing about the file', () => {
    assert.match(scan.could_not_read.reason ?? '', /reading service refused our request/)
    assert.match(scan.could_not_read.reason ?? '', /not a problem with the file you sent/)
    // The wording this replaces, and the advice that came with it.
    assert.doesNotMatch(scan.could_not_read.reason ?? '', /did not arrive/)
    assert.doesNotMatch(scan.could_not_read.way_forward ?? '', /photo|export/i)
  })

  test('the way forward is to ask again, once WE have fixed it', () => {
    assert.match(scan.could_not_read.way_forward ?? '', /Read it again/)
  })

  test("the API's own message is kept on the scan, for us", () => {
    assert.match(scan.raw_text, /^API 400: /)
    assert.match(scan.raw_text, /compiled grammar is too large/)
  })

  test('nothing is asserted about the document: no gaps, no facts, no status but could_not_read', () => {
    assert.equal(scan.status, 'could_not_read')
    assert.equal(scan.json_parsed, false)
    assert.deepEqual(scan.gaps, [])
    assert.deepEqual(scan.facts, [])
    assert.deepEqual(scan.deadlines, [])
    assert.equal(scan.summary, null)
    assert.equal(scan.identity.kind, null)
    assert.equal(scan.quotes_checked, 0)
  })

  test('the model that was called is recorded — failedScan cannot say one was', () => {
    // The distinction is the point: this call HAPPENED and was refused, so the ledger and the row
    // agree on which model refused. A file that never reached a model says "(not called)".
    assert.equal(scan.model, 'claude-opus-5')
    assert.equal(failedScan('no file', 'upload it again').model, '(not called)')
    assert.equal(failedScan('no file', 'upload it again').raw_text, '')
  })
})

describe('version_of and could_not_read are FLAT now, and the nested form still reads — 26 Sep 2026', () => {
  // Opus 5 refused the whole schema for its compiled grammar's size; these two two-field objects
  // were the two shapes it was over by, and the database was flat all along. The fallback is what
  // keeps nine stored scans and every recorded golden run readable, so it is tested, not assumed.

  test('the flat keys the schema now asks for are read', () => {
    const scan = normaliseScan({
      identity: { kind: 'permit' },
      version_of_title: 'ACDP 12-3456 (2024)',
      version_of_confidence: 'high',
      could_not_read_reason: 'the last two pages are a photograph of a photograph',
      could_not_read_way_forward: 'a straight-on scan of pages 3 and 4',
    }, '')
    assert.equal(scan.version_of.title, 'ACDP 12-3456 (2024)')
    assert.equal(scan.version_of.confidence, 'high')
    assert.equal(scan.could_not_read.reason, 'the last two pages are a photograph of a photograph')
    assert.equal(scan.could_not_read.way_forward, 'a straight-on scan of pages 3 and 4')
  })

  test('THE OLD NESTED FORM STILL READS — every answer already stored depends on it', () => {
    const scan = normaliseScan({
      identity: { kind: 'permit' },
      version_of: { title: 'ACDP 12-3456 (2024)', confidence: 'medium' },
      could_not_read: { reason: 'it is a scan of a fax', way_forward: 'the original PDF' },
    }, '')
    assert.equal(scan.version_of.title, 'ACDP 12-3456 (2024)')
    assert.equal(scan.version_of.confidence, 'medium')
    assert.equal(scan.could_not_read.reason, 'it is a scan of a fax')
    assert.equal(scan.could_not_read.way_forward, 'the original PDF')
  })

  test('flat WINS over nested when a model answers both', () => {
    // The prompt asks for flat, so flat is the model following instructions and nested is habit.
    const scan = normaliseScan({
      identity: { kind: 'permit' },
      version_of_title: 'the flat answer',
      version_of: { title: 'the nested answer', confidence: 'low' },
      could_not_read_reason: 'the flat reason',
      could_not_read: { reason: 'the nested reason', way_forward: 'nested way' },
    }, '')
    assert.equal(scan.version_of.title, 'the flat answer')
    assert.equal(scan.could_not_read.reason, 'the flat reason')
    // …and a field answered only in the nested object is still picked up rather than dropped.
    assert.equal(scan.version_of.confidence, 'low')
    assert.equal(scan.could_not_read.way_forward, 'nested way')
  })

  test('neither form present is null, not the empty string', () => {
    const scan = normaliseScan({ identity: { kind: 'permit' } }, '')
    assert.equal(scan.version_of.title, null)
    assert.equal(scan.could_not_read.reason, null)
  })
})
