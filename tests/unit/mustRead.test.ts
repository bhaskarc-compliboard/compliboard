/**
 * THE R2 HELPER — `lib/mustRead.ts`, Job E.
 *
 * The whole point is that a failed read cannot be mistaken for an empty one, so these tests are
 * mostly about the failure path. The success path matters too: a helper that threw on a genuinely
 * empty table would be useless, and callers would go back to `data ?? []`.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { mustRows, mustRow, mustCount, tryRows, ReadFailed } from '../../lib/mustRead.ts'

const failed = { data: null, error: { message: 'permission denied for table documents', code: '42501' } }

describe('a failed read throws, and says what could not be read', () => {
  test('mustRows', () => {
    assert.throws(() => mustRows('your documents', failed), (e: unknown) => {
      assert.ok(e instanceof ReadFailed)
      assert.equal(e.what, 'your documents')
      assert.equal(e.code, '42501')
      // The message names the thing a PERSON would call it, not the table.
      assert.match(e.message, /^your documents could not be read: permission denied/)
      return true
    })
  })
  test('mustRow and mustCount throw the same way', () => {
    assert.throws(() => mustRow('the company', failed), ReadFailed)
    assert.throws(() => mustCount('your files', { count: null, ...failed }), ReadFailed)
  })
})

describe('an empty answer is an answer, and must NOT throw', () => {
  test('no rows is [], not a failure', () => {
    assert.deepEqual(mustRows('your documents', { data: [], error: null }), [])
    assert.deepEqual(mustRows('your documents', { data: null, error: null }), [],
      'PostgREST can answer with null data and no error; that is still "none"')
  })
  test('a row that is genuinely absent is null', () => {
    assert.equal(mustRow('the company', { data: null, error: null }), null)
  })
  test('a real zero count is 0', () => {
    assert.equal(mustCount('your files', { count: 0, error: null }), 0)
  })
})

describe('*** A NULL COUNT IS NOT ZERO ***', () => {
  test('it throws, because PostgREST returns null with NO error for a table that does not exist', () => {
    // This is not theoretical: scripts/calendar-b6-rowcounts.mjs printed a confident 0 for a
    // Workspace table this product has never had, from Calendar B6 until Job C looked at it.
    assert.throws(() => mustCount('your files', { count: null, error: null }), (e: unknown) => {
      assert.ok(e instanceof ReadFailed)
      assert.match(e.message, /the count came back empty, which is not a count/)
      return true
    })
  })
})

describe('tryRows — for a caller that must not throw', () => {
  test('a failure is handed back, not hidden', () => {
    const r = tryRows('your documents', failed)
    assert.equal(r.ok, false)
    assert.ok(!r.ok && r.error instanceof ReadFailed)
  })
  test('and success is rows', () => {
    const r = tryRows('your documents', { data: [{ id: 'a' }], error: null })
    assert.ok(r.ok && r.rows.length === 1)
  })
  test('THERE IS NO SHAPE THAT LETS A FAILURE LOOK LIKE AN EMPTY LIST', () => {
    // The point of the union: `r.rows` does not exist until `r.ok` has been checked, so a caller
    // cannot write `tryRows(...).rows ?? []` and reintroduce R2.
    const r = tryRows('x', failed)
    assert.ok(!('rows' in r), 'a failed result must not carry a rows field at all')
  })
})
