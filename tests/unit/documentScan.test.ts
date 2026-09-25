/**
 * THE DOCUMENT SCAN'S OWN RULES — `lib/documentScan.ts`, Documents Run 1.
 *
 * These pin the two things the scan promises that nothing else enforces: a quote is checked
 * against the file it claims to come from, and a paid answer is never discarded.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { verifyQuote, normaliseScan } from '../../lib/documentScan.ts'

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
