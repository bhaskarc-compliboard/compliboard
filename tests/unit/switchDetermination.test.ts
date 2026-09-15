/**
 * THE ASK PATH AND THE PRECEDENCE LADDER.
 *
 * This is the first place the product asks a question and stores the answer as a fact.
 * `DECISIONS.md` §24.1 — a stated value outranks an inferred one — only means something if a
 * person's answer is still distinguishable from a document's later on, which is what these
 * tests pin.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  decideOutcome, fromUserAnswer, reconcileNumeric, removesAnObligation,
  type Determination, type StoredValue,
} from '../../lib/switchDetermination.ts'
import { renderBasis, type Basis } from '../../lib/basis.ts'

const doc = (over: Partial<Determination> = {}): Determination => ({
  switchId: 'air_permit_required', value: 'standard_acdp', evidenceClass: 'stated',
  confidence: 'high', source: 'ai_from_documents', documentId: 'doc-1',
  documentDate: '2025-01-01', issuerAuthority: 'regulator', quote: 'q', locator: 'p1', ...over,
})
const held = (over: Partial<StoredValue> = {}): StoredValue => ({
  value: 'general_acdp', evidenceClass: 'stated', userLocked: false,
  documentDate: '2019-01-01', issuerAuthority: 'regulator', ...over,
})

describe('a user answer is recorded as STATED, and locks', () => {
  const d = fromUserAnswer('confined_spaces_present', 'true',
    'Do employees enter tanks, vessels, pits, or other confined spaces?')

  /**
   * *** THIS TEST ASSERTED WHAT THE DATABASE REFUSES, FOR TWO DAYS. ***
   * It read `stated` as "a person states it". Migration 017's CHECK reads `stated` as "a
   * document states it" and requires a document AND a quote. Both were written 13 Sep, both
   * internally consistent, and nothing put them in one process until the route existed (§80).
   */
  test('evidence_class is DECLARED — a person is not a document (migration 026)', () => {
    assert.equal(d.evidenceClass, 'declared')
    assert.notEqual(d.evidenceClass, 'stated',
      '`stated` carries a CHECK requiring a document and a quote a person cannot supply')
    assert.equal(d.documentId, null)
    assert.equal(d.quote, null)
    assert.equal(d.confidence, 'high')
    assert.equal(d.source, 'user_set')
  })
  test('it carries no document and no quote, and that is legitimate', () => {
    // The migration's CHECK requires a document for `stated` FROM A DOCUMENT. A user answer
    // is the other route to `stated`, and the reasoning carries the question asked.
    assert.equal(d.documentId, null)
    assert.equal(d.quote, null)
    assert.match(d.reasoning!, /Answered by a person/)
    assert.match(d.reasoning!, /confined spaces/)
  })
  test('it is the only thing in this module that sets user_locked', () => {
    assert.equal(d.setsUserLocked, true)
  })
})

describe('what happens when a document later contradicts the person', () => {
  const locked = held({ value: 'false', userLocked: true, evidenceClass: 'stated' })

  test('the document does NOT overwrite it', () => {
    const o = decideOutcome(locked, doc({ value: 'true' }), false)
    assert.equal(o.action, 'record_only')
    assert.match(o.reason, /A person set this value/)
  })
  test('even a regulator-issued, newer, STATED document loses', () => {
    const o = decideOutcome(locked, doc({ value: 'true', documentDate: '2026-09-01' }), false)
    assert.notEqual(o.action, 'write', 'a person\'s decision must survive every automatic pass')
    assert.equal(o.action, 'record_only')
  })
  test('but it IS recorded, so the disagreement is visible rather than lost', () => {
    // record_only means: write a switch_determinations row, leave company_switches alone.
    const o = decideOutcome(locked, doc({ value: 'true' }), false)
    assert.match(o.reason, /recorded/)
  })
})

describe('a person changing their own answer always wins', () => {
  test('over their earlier answer', () => {
    const earlier = held({ value: 'false', userLocked: true })
    const o = decideOutcome(earlier, { ...fromUserAnswer('x', 'true', 'q?') }, false)
    assert.equal(o.action, 'write')
  })
  test('and over a value that would remove an obligation', () => {
    // The §5 propose rule governs AI determinations. A person is allowed to remove their own
    // obligations — that is what correcting a wrong fact means.
    const o = decideOutcome(held(), { ...fromUserAnswer('x', 'none', 'q?') }, true)
    assert.equal(o.action, 'write')
  })
})

describe('the §5 rule: a value that removes an obligation is never written automatically', () => {
  test('even at stated/high/regulator', () => {
    const o = decideOutcome(null, doc({ value: 'none' }), true)
    assert.equal(o.action, 'propose')
    assert.match(o.reason, /REMOVE/)
  })
  test('a value that only ADDS obligations may be written', () => {
    assert.equal(decideOutcome(null, doc(), false).action, 'write')
  })
})

describe('corroboration is not statement', () => {
  test('an inferred value is proposed, never written — however confident', () => {
    const o = decideOutcome(null, doc({ evidenceClass: 'inferred', confidence: 'high' }), false)
    assert.equal(o.action, 'propose')
    assert.match(o.reason, /still not a statement/)
  })
})

describe('the precedence ladder', () => {
  test('stronger evidence class wins', () => {
    const o = decideOutcome(held({ evidenceClass: 'implied' }), doc({ evidenceClass: 'stated' }), false)
    assert.equal(o.action, 'write')
  })
  test('weaker evidence class loses, and is still recorded', () => {
    const o = decideOutcome(held({ evidenceClass: 'stated' }), doc({ evidenceClass: 'implied' }), false)
    assert.equal(o.action, 'record_only')
  })
  test('RECENCY ONLY WITHIN A CLASS — a 2019 stated beats a 2025 implied', () => {
    const o = decideOutcome(
      held({ evidenceClass: 'stated', documentDate: '2019-01-01' }),
      doc({ evidenceClass: 'implied', documentDate: '2025-06-01' }), false)
    assert.equal(o.action, 'record_only', 'recency is not authority')
  })
  test('newer wins at the same class', () => {
    const o = decideOutcome(held({ documentDate: '2019-01-01' }), doc({ documentDate: '2025-01-01' }), false)
    assert.equal(o.action, 'write')
  })
  test('regulator beats self-authored at equal class and date', () => {
    const o = decideOutcome(
      held({ documentDate: '2025-01-01', issuerAuthority: 'self' }),
      doc({ documentDate: '2025-01-01', issuerAuthority: 'regulator' }), false)
    assert.equal(o.action, 'write')
  })
  test('two equal sources disagreeing goes to the user, never to a guess', () => {
    const o = decideOutcome(
      held({ documentDate: '2025-01-01', issuerAuthority: 'regulator' }),
      doc({ documentDate: '2025-01-01', issuerAuthority: 'regulator' }), false)
    assert.equal(o.action, 'needs_user')
    assert.match(o.reason, /nothing in the precedence ladder separates them/)
  })
  test('agreement is not a disagreement', () => {
    const o = decideOutcome(held({ value: 'standard_acdp' }), doc({ value: 'standard_acdp' }), false)
    assert.equal(o.action, 'write')
    assert.match(o.reason, /re-confirmed/)
  })
})

describe('absent is a finding, never a fact', () => {
  test('it is recorded and never written', () => {
    const o = decideOutcome(null, doc({ evidenceClass: 'absent', value: null }), false)
    assert.equal(o.action, 'record_only')
  })
})

describe('numeric disagreement never averages', () => {
  test('42 and 60 do not make 51', () => {
    assert.equal(reconcileNumeric('42', '60'), '60')
    assert.equal(reconcileNumeric('60', '42'), '60')
  })
  test('the HIGHER value wins, because higher adds obligations', () => {
    assert.equal(reconcileNumeric('9', '10'), '10')
  })
  test('an unreadable number does not win by default', () => {
    assert.equal(reconcileNumeric('many', '42'), '42')
    assert.equal(reconcileNumeric(null, null), null)
  })
})

describe('removesAnObligation', () => {
  test('applies -> does_not_apply is a removal', () => {
    assert.equal(removesAnObligation(['does_not_apply'], ['applies']), true)
  })
  test('unknown -> does_not_apply is a removal — a silent one', () => {
    assert.equal(removesAnObligation(['does_not_apply'], ['unknown']), true)
  })
  test('unknown -> applies is not', () => {
    assert.equal(removesAnObligation(['applies'], ['unknown']), false)
  })
  test('a changed shape counts as a removal rather than being ignored', () => {
    assert.equal(removesAnObligation(['applies'], ['applies', 'unknown']), true)
  })
})

describe('an overwrite carries what it overwrote — DECISIONS §49', () => {
  const Q = 'Are hazardous chemicals present at this site?'
  const say = (d: { basis: Basis }, v: string) => renderBasis(d.basis, v)

  test('a first answer states value and date, with no "previously"', () => {
    const d = fromUserAnswer('hazardous_chemicals_present', 'true', Q, null)
    assert.equal(d.basis.kind, 'user_answer')
    assert.equal('previous_value' in d.basis, false)
    assert.match(say(d, 'true'), /^User stated "true" on \d{4}-\d{2}-\d{2}\. Question: /)
  })

  test('CHANGING an answer records what it replaced — in the STRUCTURE, not the prose', () => {
    const d = fromUserAnswer('hazardous_chemicals_present', 'false', Q, { value: 'true', at: '2026-09-13' })
    assert.equal(d.basis.previous_value, 'true',
      'the previous value must be a field, so "which switches changed" is a query')
    assert.match(say(d, 'false'), /User stated "false" on 2026-09-13, previously "true"/)
  })

  test('re-answering with the SAME value is not a change', () => {
    const d = fromUserAnswer('x', 'true', Q, { value: 'true', at: '2026-09-13' })
    assert.equal('previous_value' in d.basis, false)
    assert.doesNotMatch(say(d, 'true'), /previously/)
  })

  test('a previous NULL is not a change either', () => {
    const d = fromUserAnswer('x', 'true', Q, { value: null, at: '2026-09-13' })
    assert.equal('previous_value' in d.basis, false)
  })

  test('the question is a FIELD, so an answer can be read in context without parsing', () => {
    for (const prev of [null, { value: 'false', at: '2026-09-13' }]) {
      assert.equal(fromUserAnswer('x', 'true', Q, prev).basis.question, Q)
    }
  })
})
