/**
 * A2 — A FAILED READ OF THE RUN'S SUMMARY ERASED THE RUN (root R2, Job E).
 *
 * *** MADE TO FAIL ON THE OLD CODE FIRST. *** `oldPatch` below is the shipped read-modify-write,
 * copied line for line out of `lib/auditRun.ts`, and the first group shows it writing a summary that
 * holds only the keys the step was adding — the run's note, the extraction receipt and every earlier
 * section's counts gone, permanently, because nothing recomputes them.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSummary, patchIsEmpty, patchRunSummary } from '../../lib/auditSummary.ts'
import { ReadFailed } from '../../lib/mustRead.ts'
import { readFileSync } from 'node:fs'

/** A run partway through: a note put on it before it ran, a receipt, and one section's counts. */
const LIVE = {
  note: 'This checklist names Cascade Analytical, not you. We audited it as a form anyway.',
  extraction_ai_call_id: 'a1b2c3d4-0000-0000-0000-00000000beef',
  reshaped_to_dates: [{ title: 'Annual emissions report', due_on: '2027-03-01' }],
  collapsed_duplicates: 2,
  total: 31,
}
const FAILED = { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } }

describe('*** THE OLD CODE WROTE A SUMMARY BUILT ON A FAILED READ ***', () => {
  /** `lib/auditRun.ts` as it shipped: `error` never destructured, `{}` spread on a failure. */
  function oldPatch(res: { data: { summary: Record<string, unknown> } | null; error: unknown },
                    reshaped: unknown[]): Record<string, unknown> {
    const cur = res.data
    const prevSummary = (cur?.summary ?? {}) as Record<string, unknown>
    const was = (k: string) => (Array.isArray(prevSummary[k]) ? prevSummary[k] as unknown[] : [])
    return { ...prevSummary, reshaped_to_dates: [...was('reshaped_to_dates'), ...reshaped] }
  }
  const NEW = [{ title: 'Scrubber inspection', due_on: '2027-04-15' }]

  test('with the read working, it keeps everything and appends', () => {
    const out = oldPatch({ data: { summary: LIVE }, error: null }, NEW)
    assert.equal(out.note, LIVE.note)
    assert.equal((out.reshaped_to_dates as unknown[]).length, 2)
  })

  test('*** with the read FAILING: the summary becomes one key ***', () => {
    const out = oldPatch(FAILED, NEW)
    assert.deepEqual(Object.keys(out), ['reshaped_to_dates'],
      'this is the shipped behaviour, and it is why A2 is severity 1')
    assert.equal(out.note, undefined, "the run's note is gone, and nothing recomputes it")
    assert.equal(out.extraction_ai_call_id, undefined, 'so is the extraction receipt')
    assert.equal(out.collapsed_duplicates, undefined, "and so is an earlier section's count")
  })
})

describe('mergeSummary — what it does to each kind of key', () => {
  test('a key the patch does not name is carried through untouched', () => {
    const out = mergeSummary(LIVE, { append: { dropped_undated: [{ title: 'x', recurs: null }] } })
    assert.equal(out.note, LIVE.note)
    assert.equal(out.extraction_ai_call_id, LIVE.extraction_ai_call_id)
    assert.equal(out.total, 31)
  })

  test('an appended key is added to, not replaced', () => {
    const out = mergeSummary(LIVE, { append: { reshaped_to_dates: [{ title: 'b', due_on: '2027-01-01' }] } })
    assert.equal((out.reshaped_to_dates as unknown[]).length, 2)
  })

  test('a counted key is added to', () => {
    assert.equal(mergeSummary(LIVE, { add: { collapsed_duplicates: 3 } }).collapsed_duplicates, 5)
  })

  test('a counted key that was never there starts at 0, not NaN', () => {
    assert.equal(mergeSummary({}, { add: { collapsed_duplicates: 3 } }).collapsed_duplicates, 3)
  })

  test('a key held in the wrong shape is replaced, never added to', () => {
    // An older version of the code wrote a number here. `[...7]` would throw; `7 + [..]` is a string.
    const out = mergeSummary({ reshaped_to_dates: 7 }, { append: { reshaped_to_dates: ['a'] } })
    assert.deepEqual(out.reshaped_to_dates, ['a'])
  })

  test('an empty patch is recognised, so neither the read nor the write happens', () => {
    assert.equal(patchIsEmpty({ append: { a: [], b: [] }, add: { c: 0 } }), true)
    assert.equal(patchIsEmpty({ add: { c: 1 } }), false)
    assert.equal(patchIsEmpty({ append: { a: ['x'] } }), false)
  })
})

describe('patchRunSummary — the failure comes back, and nothing is written', () => {
  function fakeDb(read: unknown, writeError: unknown = null) {
    const writes: Array<Record<string, unknown>> = []
    const b = {
      select: () => b, eq: () => b, maybeSingle: () => b,
      update: (patch: Record<string, unknown>) => { writes.push(patch); return b },
      then: (ok: (v: unknown) => unknown) => Promise.resolve(
        writes.length ? { data: null, error: writeError } : read).then(ok),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { db: { from: () => b } as any, writes }
  }

  test('the good case: the whole summary is kept and the patch applied', async () => {
    const { db, writes } = fakeDb({ data: { summary: LIVE }, error: null })
    const r = await patchRunSummary(db, 'run-1', { add: { collapsed_duplicates: 1 } })
    assert.equal(r.ok, true)
    assert.equal(writes.length, 1)
    const written = writes[0].summary as Record<string, unknown>
    assert.equal(written.note, LIVE.note)
    assert.equal(written.collapsed_duplicates, 3)
  })

  test('*** a failed read writes NOTHING and names what could not be read ***', async () => {
    const { db, writes } = fakeDb(FAILED)
    const r = await patchRunSummary(db, 'run-1', { append: { dropped_wordless: [{ title: 'x', kind: 'y' }] } })
    assert.equal(r.ok, false)
    assert.ok(!r.ok && r.error instanceof ReadFailed)
    assert.ok(!r.ok && r.error.message.includes("the audit run's summary"))
    assert.deepEqual(writes, [], 'a summary built on a failed read must never reach the table')
  })

  test('a failed WRITE comes back too, rather than looking like a save', async () => {
    const { db } = fakeDb({ data: { summary: LIVE }, error: null }, { message: 'permission denied' })
    const r = await patchRunSummary(db, 'run-1', { add: { collapsed_duplicates: 1 } })
    assert.equal(r.ok, false)
  })

  test('an empty patch neither reads nor writes', async () => {
    const { db, writes } = fakeDb(FAILED)
    const r = await patchRunSummary(db, 'run-1', { append: { reshaped_to_dates: [] } })
    assert.equal(r.ok, true)
    assert.equal(r.ok && r.changed, false)
    assert.deepEqual(writes, [])
  })
})

describe('and lib/auditRun.ts goes through it', () => {
  /** Comments quote the old shape, so they are stripped before asserting (third time in Job E). */
  const code = readFileSync('lib/auditRun.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('no read-modify-write of `summary` is left in the file', () => {
    assert.ok(!/const prevSummary = \(cur\?\.summary/.test(code))
    assert.ok(!/\(Number\(prev\.collapsed_duplicates\) \|\| 0\)/.test(code))
  })

  test('both call sites use patchRunSummary and warn when it fails', () => {
    const calls = code.match(/patchRunSummary\(db, sec\.run_id/g) ?? []
    assert.equal(calls.length, 2, 'the reshaped/dropped lists and the collapse count')
    assert.equal((code.match(/if \(!r\.ok\)/g) ?? []).length, 2, 'each one says so when it could not')
  })

  test("summariseRun's own read of the run is checked — it is what carries the note forward", () => {
    assert.match(code, /mustRow<\{ previous_run_id: string \| null; summary/)
  })
})
