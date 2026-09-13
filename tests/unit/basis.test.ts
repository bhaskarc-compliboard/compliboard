/**
 * `basis` — structured, with the sentence rendered from it. `DECISIONS.md` §50.
 *
 * The renderer is tested rather than the string because the string is never stored. If these
 * two ever disagree, the structure is right and the sentence is a bug.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  userAnswerBasis, documentBasis, computedBasis, renderBasis, quoteIsInDocument, type Basis,
} from '../../lib/basis.ts'

describe('user_answer', () => {
  const Q = 'Are hazardous chemicals present at this site?'

  test('a first answer carries the question and no previous_value', () => {
    const b = userAnswerBasis(Q, 'true', null, '2026-09-13')
    assert.equal(b.kind, 'user_answer')
    assert.equal(b.question, Q)
    assert.equal('previous_value' in b, false)
    assert.match(renderBasis(b, 'true'), /^User stated "true" on 2026-09-13\. Question: /)
  })

  test('a CHANGE carries what it replaced — §49', () => {
    const b = userAnswerBasis(Q, 'false', 'true', '2026-09-13')
    assert.equal(b.previous_value, 'true')
    assert.match(renderBasis(b, 'false'), /User stated "false" on 2026-09-13, previously "true"/)
  })

  test('re-confirming the same value is not a change', () => {
    const b = userAnswerBasis(Q, 'true', 'true', '2026-09-13')
    assert.equal('previous_value' in b, false)
    assert.doesNotMatch(renderBasis(b, 'true'), /previously/)
  })

  test('a previous NULL or empty is not a change — there was nothing to replace', () => {
    for (const prev of [null, undefined, '']) {
      assert.equal('previous_value' in userAnswerBasis(Q, 'true', prev, '2026-09-13'), false)
    }
  })
})

describe('document', () => {
  const b = documentBasis('doc-7f2a', 'Permit cover page',
    'Standard Air Contaminant Discharge Permit No. 26-2841', '2026-09-13')

  test('the quote and locator are fields, not prose', () => {
    assert.equal(b.quote, 'Standard Air Contaminant Discharge Permit No. 26-2841')
    assert.equal(b.locator, 'Permit cover page')
    assert.equal(b.document_id, 'doc-7f2a')
  })
  test('the sentence names all three', () => {
    const s = renderBasis(b)
    assert.match(s, /doc-7f2a/)
    assert.match(s, /Permit cover page/)
    assert.match(s, /"Standard Air Contaminant Discharge Permit No\. 26-2841"/)
  })
  test('reasoning appears only when present', () => {
    assert.doesNotMatch(renderBasis(b), / — /)
    const withWhy = documentBasis('d', null, 'q', '2026-09-13', 'the permit names its own tier')
    assert.match(renderBasis(withWhy), /— the permit names its own tier/)
  })
})

describe('computed', () => {
  test('the inputs are named and sorted, so the value is reproducible', () => {
    const b = computedBasis(['site_employee_count', 'has_employees'], '2026-09-13')
    assert.deepEqual(b.computed_from, ['has_employees', 'site_employee_count'])
    assert.match(renderBasis(b), /Computed on 2026-09-13 from has_employees, site_employee_count\./)
  })
})

describe('the structure is queryable — the reason it is not a string', () => {
  test('every switch resting on one document is a field comparison', () => {
    const rows: Basis[] = [
      documentBasis('doc-A', null, 'q1', '2026-09-13'),
      documentBasis('doc-B', null, 'q2', '2026-09-13'),
      userAnswerBasis('Q?', 'true', null, '2026-09-13'),
    ]
    assert.equal(rows.filter((b) => b.document_id === 'doc-A').length, 1)
  })
  test('every basis carries a schema version', () => {
    for (const b of [userAnswerBasis('q', 'v', null, 'd'), documentBasis('d', null, 'q', 'd'), computedBasis([], 'd')]) {
      assert.equal(b.v, 1)
    }
  })
  test('an unhandled kind throws rather than rendering something plausible', () => {
    assert.throws(() => renderBasis({ v: 1, kind: 'telepathy' as never, at: 'd' }), /unhandled basis kind/)
  })
})

describe('quoteIsInDocument — the one check that needs no model', () => {
  const doc = 'Section 3.  Composition\n\nSulfuric acid   93%   CAS-No. 7664-93-9\n'

  test('a verbatim quote is found', () => {
    assert.equal(quoteIsInDocument('Sulfuric acid   93%   CAS-No. 7664-93-9', doc), true)
  })
  test('whitespace differences are tolerated — parsers collapse them differently', () => {
    assert.equal(quoteIsInDocument('Sulfuric acid 93% CAS-No. 7664-93-9', doc), true)
  })
  test('A FABRICATED QUOTE IS REJECTED — the failure this exists for', () => {
    assert.equal(quoteIsInDocument('Sulfuric acid 98% CAS-No. 7664-93-9', doc), false,
      'a plausible quote that is not in the document must not pass')
  })
  test('a paraphrase is rejected, however fair', () => {
    assert.equal(quoteIsInDocument('The document states the acid is 93 percent', doc), false)
  })
  test('an empty quote is never a match', () => {
    assert.equal(quoteIsInDocument('', doc), false)
    assert.equal(quoteIsInDocument('   ', doc), false)
  })
})
