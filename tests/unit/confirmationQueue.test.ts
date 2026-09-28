/**
 * THE QUESTION LINES — Task 0, commit 2.
 *
 * `questionLines` decides what a person is asked and in what order. It is pure, it is read by two
 * callers (the page draws the lines, the sidebar badge counts them), and the thing most likely to go
 * wrong with it is silent: a disagreement swallowed into a document group looks exactly like a
 * document group with one more fact in it.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { questionLines, rankOfKey, PRIORITY_KEYS,
         type QueueKeyLike } from '../../lib/confirmationQueue.ts'

const PERMIT = 'doc-permit'
const HANDBOOK = 'doc-handbook'

function key(over: Partial<QueueKeyLike> & { key: string }): QueueKeyLike {
  return {
    is_switch: false, agree: true, value: 'v',
    sources: [source({})],
    ...over,
  }
}
function source(over: Partial<QueueKeyLike['sources'][number]>) {
  return {
    proposal_id: `p-${Math.random().toString(36).slice(2, 8)}`,
    value: 'v', created_at: '2026-09-01T00:00:00Z',
    document_id: PERMIT, entity_id: null,
    from: { kind: 'document' as const, title: 'air permit' },
    ...over,
  }
}
const nothingSettled = () => null

describe('one document, one question', () => {
  const lines = questionLines([
    key({ key: 'generator_category', sources: [source({})] }),
    key({ key: 'permit_number', sources: [source({})] }),
    key({ key: 'stack_height', sources: [source({})] }),
  ], nothingSettled)

  test('three facts from one reading are ONE line', () => {
    assert.equal(lines.length, 1)
    assert.equal(lines[0].kind, 'document')
  })
  test('and the line carries all three, so Confirm all has something to confirm', () => {
    assert.equal(lines[0].kind === 'document' && lines[0].keys.length, 3)
  })
  test('the line is identified by its document, so answering one does not reshuffle the rest', () => {
    assert.equal(lines[0].id, `doc:${PERMIT}`)
  })
})

describe('a key two documents both propose cannot sit under either', () => {
  const lines = questionLines([
    key({ key: 'employee_count', value: '42', sources: [
      source({ document_id: PERMIT, value: '42' }),
      source({ document_id: HANDBOOK, value: '42', from: { kind: 'document', title: 'handbook' } }),
    ] }),
  ], nothingSettled)

  test('it gets its own line rather than being filed under whichever was read first', () => {
    assert.equal(lines.length, 1)
    assert.equal(lines[0].kind, 'single')
  })
})

describe('a disagreement is always lifted out of its document group', () => {
  const sourcesDiffer = key({
    key: 'employee_count', agree: false, value: null,
    sources: [source({ value: '42' }), source({ value: '38' })],
  })
  const agrees = key({ key: 'permit_number', sources: [source({})] })

  test("when the sources differ among themselves", () => {
    const lines = questionLines([sourcesDiffer, agrees], nothingSettled)
    assert.equal(lines.length, 2)
    assert.equal(lines[0].kind, 'disagreement')   // rank 0, so it is first
    assert.equal(lines[1].kind, 'document')
  })

  test('when the sources agree but contradict something already settled', () => {
    // THE CASE THAT WOULD OTHERWISE BE INVISIBLE. One document says 38, the record says 42, and the
    // document's other facts are all fine — so without this the question arrives as "the permit says
    // 6 things about you" and the contradiction is the sixth of them.
    const lines = questionLines(
      [key({ key: 'employee_count', value: '38', sources: [source({ value: '38' })] }), agrees],
      (k) => (k === 'employee_count' ? '42' : null))
    assert.equal(lines[0].kind, 'disagreement')
    assert.equal(lines[0].kind === 'disagreement' && lines[0].settled, '42')
  })

  test('but a settled value that only differs in case or spacing is NOT a disagreement', () => {
    // "42 employees" against "42 Employees" is not something to ask a person to arbitrate — the same
    // comparison /api/to-confirm makes between two sources.
    const lines = questionLines(
      [key({ key: 'shift_pattern', value: 'Two Shifts ', sources: [source({ value: 'Two Shifts ' })] })],
      () => 'two shifts')
    assert.equal(lines[0].kind, 'document')
  })

  test('a settled value that matches is not a question about a contradiction either', () => {
    const lines = questionLines(
      [key({ key: 'shift_pattern', value: 'two shifts', sources: [source({ value: 'two shifts' })] })],
      () => 'two shifts')
    assert.equal(lines[0].kind, 'document')
  })
})

describe('the order is what it unblocks, not what arrived', () => {
  test('the six priority keys come in their stated order', () => {
    const ranks = PRIORITY_KEYS.map((k) => rankOfKey(key({ key: k, is_switch: true })))
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b))
    assert.equal(new Set(ranks).size, PRIORITY_KEYS.length)
  })

  test('a priority switch outranks another switch, which outranks a plain fact', () => {
    assert.ok(rankOfKey(key({ key: 'has_employees', is_switch: true }))
            < rankOfKey(key({ key: 'forklifts_present', is_switch: true })))
    assert.ok(rankOfKey(key({ key: 'forklifts_present', is_switch: true }))
            < rankOfKey(key({ key: 'dress_code', is_switch: false })))
  })

  test('a document group takes the rank of its HIGHEST fact', () => {
    // A permit that states the generator category is worth opening before a handbook that states the
    // dress code, and the group must not sink to the level of its least useful question.
    const lines = questionLines([
      key({ key: 'dress_code', sources: [source({ document_id: HANDBOOK, from: { kind: 'document', title: 'handbook' } })] }),
      key({ key: 'has_employees', is_switch: true, sources: [source({ document_id: PERMIT })] }),
      key({ key: 'stack_height', sources: [source({ document_id: PERMIT })] }),
    ], nothingSettled)
    assert.equal(lines.length, 2)
    assert.equal(lines[0].kind === 'document' && lines[0].documentId, PERMIT)
  })

  test('among plain facts, the oldest proposal is asked first', () => {
    const lines = questionLines([
      key({ key: 'newer', sources: [source({ document_id: null, created_at: '2026-09-20T00:00:00Z', from: { kind: 'conversation', title: 'a conversation' } })] }),
      key({ key: 'older', sources: [source({ document_id: null, created_at: '2026-09-02T00:00:00Z', from: { kind: 'conversation', title: 'a conversation' } })] }),
    ], nothingSettled)
    assert.deepEqual(lines.map((l) => (l.kind === 'single' ? l.k.key : l.kind)), ['older', 'newer'])
  })
})

describe('the order is stable between loads', () => {
  test('two lines tying on everything else keep a fixed order', () => {
    // A queue that reshuffles under somebody mid-answer makes them lose their place; `id` is the
    // last tie-break for exactly that reason.
    const build = () => questionLines([
      key({ key: 'a_fact', sources: [source({ document_id: null, from: { kind: 'conversation', title: 'c' } })] }),
      key({ key: 'b_fact', sources: [source({ document_id: null, from: { kind: 'conversation', title: 'c' } })] }),
    ], nothingSettled)
    assert.deepEqual(
      build().map((l) => l.id),
      build().map((l) => l.id))
  })
})

describe('an empty queue is an empty list, not a line saying so', () => {
  test('no proposals, no lines', () => {
    assert.deepEqual(questionLines([], nothingSettled), [])
  })
})
