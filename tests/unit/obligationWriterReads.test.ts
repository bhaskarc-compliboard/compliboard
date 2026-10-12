/**
 * W1 — A FAILED READ MUST NOT CLOSE A COMPANY'S REQUIREMENTS (root R2, Job E).
 *
 * `writeObligations` took five reads and destructured only `data`. The whole set then goes to
 * `close_and_replace_obligations`, whose contract is *"this is everything; reconcile it"* — so an
 * empty set closes every open obligation, stamps `obligations_computed_at`, and /requirements
 * tells the company *"we found none that apply to you. That is a result, not a gap."*
 *
 * *** MADE TO FAIL ON THE OLD CODE FIRST. *** The first group runs the **real** `writeObligations`
 * against a database that errors on `requirement_templates`, and asserts what the fix does. Before
 * the fix, the same test failed with the RPC being called carrying zero obligations — which is the
 * production failure, reproduced: `rpcCalls` held
 * `close_and_replace_obligations(0 obligations)` and the open rows were gone.
 *
 * The fake database is deliberately thin: `writeObligations` only ever chains
 * `.select().eq().is().maybeSingle()` and `.update().eq()`, so a builder that returns itself and
 * resolves to a planned result is enough to drive the real function end to end. Nothing here is
 * copied logic — the code under test is the code that ships.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { writeObligations } from '../../lib/obligationWriter.ts'
import { ReadFailed } from '../../lib/mustRead.ts'

const FAIL = { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } }

interface Planned { data?: unknown; error?: unknown; count?: number | null }

/** One table's planned answer, plus a log of every write and RPC the real code attempted. */
function fakeDb(plan: Record<string, Planned>) {
  const rpcCalls: string[] = []
  const updates: string[] = []

  const builder = (table: string) => {
    const answer = { data: [], error: null, count: null, ...(plan[table] ?? {}) }
    const b = {
      select: () => b,
      eq: () => b,
      is: () => b,
      // `.in()` arrived with D2's stamp of the rows a person confirmed (migration 081).
      in: () => b,
      update: (patch: Record<string, unknown>) => { updates.push(`${table}: ${Object.keys(patch).join(',')}`); return b },
      single: () => b,
      maybeSingle: () => b,
      then: (ok: (v: unknown) => unknown, no?: (e: unknown) => unknown) => Promise.resolve(answer).then(ok, no),
    }
    return b
  }

  const db = {
    from: (table: string) => builder(table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'substance_inventory') return { data: null, error: null }
      rpcCalls.push(`${fn}(${(args.p_obligations as unknown[] | undefined)?.length ?? '?'} obligations)`)
      return { data: { closed: 0, opened: 0 }, error: null }
    },
  } as unknown as SupabaseClient

  return { db, rpcCalls, updates }
}

const COMPANY = { data: { id: 'c1', name: 'Acme Chemical', state: 'OR', county: 'Multnomah', city: 'Portland', industry: 'chemical_manufacturing' } }
const SITES = { data: [{ id: 's1', name: 'Plant 1', state: 'OR', county: 'Multnomah', city: 'Portland', fire_authority: 'Portland Fire', is_primary: true }] }
/** One live library row that DOES apply to this company, so a good run produces something. */
const LIBRARY = {
  data: [{
    id: 'r1', requirement_name: 'Hazard communication programme', jurisdiction_layer: 'federal',
    jurisdiction_state: null, jurisdiction_county: null, jurisdiction_city: null,
    entity_type: 'organization', industries: ['chemical_manufacturing'], applies_expression: null,
  }],
}
const SWITCHES = { data: [{ id: 'has_employees', value_type: 'boolean' }] }
const COMPANY_SWITCHES = { data: [{ switch_id: 'has_employees', scope: 'company', entity_id: null, value: 'true', state: 'known' }] }

/**
 * *** THE OPEN-ROW READ IS NOW ROWS, NOT A COUNT — E10, D2. *** It was
 * `select('*', { count: 'exact', head: true })`, which answers "how many are open" and nothing
 * else. D2 needs to know WHICH open rows would leave the set — to decide whether the drop is a big
 * one, and to stamp the rows a person confirms with who asked and when (migration 081). So the
 * plans below carry `data`.
 */
const openRows = (n: number) => ({
  data: Array.from({ length: n }, (_, i) => ({ id: `o${i}`, requirement_template_id: 'r1', entity_id: null })),
  error: null,
})

const good = () => ({
  companies: COMPANY, entities: SITES, requirement_templates: LIBRARY,
  switches: SWITCHES, company_switches: COMPANY_SWITCHES,
  obligations: openRows(0),
})

describe('*** W1: a read that failed must not reach close_and_replace_obligations ***', () => {
  test('the good run still works — a check that cannot see a presence proves nothing', async () => {
    const { db, rpcCalls, updates } = fakeDb(good())
    const written = await writeObligations(db, 'c1')
    assert.equal(written.obligations.length, 1, 'the applying library row must produce an obligation')
    assert.deepEqual(rpcCalls, ['close_and_replace_obligations(1 obligations)'])
    // One statement for the stamp and the hold: a company must never be left looking computed with
    // a question still on its page (D2, migration 083).
    assert.ok(updates.includes('companies: obligations_computed_at,obligations_hold'),
      'and the timestamp is stamped, clearing any hold in the same statement')
  })

  for (const [table, what] of [
    ['requirement_templates', 'the requirement library'],
    ['company_switches', 'the facts you have told us'],
    ['switches', 'the list of facts we track'],
    ['entities', 'your sites'],
    ['companies', 'your company'],
  ] as const) {
    test(`a failed ${table} read throws and writes NOTHING`, async () => {
      const { db, rpcCalls, updates } = fakeDb({ ...good(), [table]: FAIL })
      await assert.rejects(() => writeObligations(db, 'c1'), (e: unknown) => {
        assert.ok(e instanceof ReadFailed, `expected ReadFailed, got ${String(e)}`)
        assert.equal(e.what, what)
        return true
      })
      assert.deepEqual(rpcCalls, [], 'no obligation was reconciled on a failed read')
      assert.deepEqual(updates, [], 'and obligations_computed_at was not stamped')
    })
  }
})

describe('an empty answer is not a result', () => {
  test('an empty library throws — 188 shared rows cannot mean "nothing applies to you"', async () => {
    const { db, rpcCalls } = fakeDb({ ...good(), requirement_templates: { data: [], error: null } })
    await assert.rejects(() => writeObligations(db, 'c1'), /library came back empty/)
    assert.deepEqual(rpcCalls, [])
  })

  /**
   * *** THIS WAS A THROW, AND D2 MADE IT A HELD RECOMPUTE — E10, N7. ***
   *
   * Job E's guard refused the write and the route turned that into a 500. It stopped the lie and
   * created a dead end: measured in E9 item 5, a company that legitimately stops being a chemical
   * manufacturer got 500 from the Requirements page for ever, with 200 obligations open and no
   * button anywhere that could move them on. The owner's decision D2: the page always loads,
   * nothing closes, and the person is asked.
   *
   * **What has NOT changed, and is asserted here every bit as hard as before: no obligation is
   * reconciled, and the timestamp is not stamped.**
   */
  test('*** zero obligations while rows are open: HELD, nothing closed, nothing stamped ***', async () => {
    // The library read succeeded and every row serves another industry, so `resolve` returns
    // nothing. 221 of this company's requirements are open. Reconciling against nothing closes
    // all 221 — so it is held even though no read reported a failure.
    const other = { data: [{ ...LIBRARY.data[0], industries: ['cannabis_extraction'] }] }
    const { db, rpcCalls, updates } = fakeDb({
      ...good(), requirement_templates: other, obligations: openRows(221),
    })
    const written = await writeObligations(db, 'c1')
    assert.ok(written.held, 'the recompute must be held, not performed')
    assert.equal(written.held?.open_total, 221)
    assert.equal(written.held?.would_close, 221)
    assert.equal(written.held?.industry_has_library, false, 'the library serves another industry only')
    assert.deepEqual(rpcCalls, [], 'nothing was closed')
    assert.deepEqual(updates, ['companies: obligations_hold'],
      'the hold is recorded, and obligations_computed_at is NOT stamped — a held recompute is not a computation')
  })

  test('a person confirming it reconciles, and the rows record who asked', async () => {
    const other = { data: [{ ...LIBRARY.data[0], industries: ['cannabis_extraction'] }] }
    const { db, rpcCalls, updates } = fakeDb({
      ...good(), requirement_templates: other, obligations: openRows(221),
    })
    const written = await writeObligations(db, 'c1', { confirmedBy: 'u1' })
    assert.equal(written.held, undefined)
    assert.deepEqual(rpcCalls, ['close_and_replace_obligations(0 obligations)'])
    assert.ok(updates.includes('obligations: closed_by,closed_reason'),
      'every row the confirmation closed says who asked and why (migration 081)')
    assert.ok(updates.includes('companies: obligations_computed_at,obligations_hold'),
      'and the recompute that proceeded clears the hold in the same statement as the stamp')
  })

  test('HALF is not a big drop, and more than half is', async () => {
    // Two rows open, one leaves: an ordinary answer, and stopping to ask would make the hold the
    // common case. The threshold is internal (D2.2) and its edges are in
    // `tests/unit/obligationHold.test.ts`; this is the same rule reached through the real writer.
    const twoRows = {
      data: [{ id: 'o0', requirement_template_id: 'r1', entity_id: null },
             { id: 'o1', requirement_template_id: 'gone', entity_id: null }],
      error: null,
    }
    const { db, rpcCalls } = fakeDb({ ...good(), obligations: twoRows })
    const written = await writeObligations(db, 'c1')
    assert.equal(written.held, undefined, 'one of two is half, and half does not hold')
    assert.deepEqual(rpcCalls, ['close_and_replace_obligations(1 obligations)'])
  })

  test('zero obligations with NOTHING open is allowed — migration 022\'s "computed, and nothing applies"', async () => {
    const other = { data: [{ ...LIBRARY.data[0], industries: ['cannabis_extraction'] }] }
    const { db, rpcCalls, updates } = fakeDb({
      ...good(), requirement_templates: other, obligations: openRows(0),
    })
    const written = await writeObligations(db, 'c1')
    assert.equal(written.obligations.length, 0)
    assert.equal(written.held, undefined, 'there is nothing to lose, so there is nothing to ask about')
    assert.deepEqual(rpcCalls, ['close_and_replace_obligations(0 obligations)'],
      'the fix must not refuse every empty set, or a new company can never be computed')
    assert.ok(updates.some((u) => u.startsWith('companies: obligations_computed_at')))
  })

  test('and if that open-row read itself cannot be taken, we stop rather than guess', async () => {
    const other = { data: [{ ...LIBRARY.data[0], industries: ['cannabis_extraction'] }] }
    const { db, rpcCalls } = fakeDb({
      ...good(), requirement_templates: other,
      obligations: { data: null, error: { message: 'permission denied for table obligations', code: '42501' } },
    })
    await assert.rejects(() => writeObligations(db, 'c1'), (e: unknown) => e instanceof ReadFailed)
    assert.deepEqual(rpcCalls, [])
  })
})

describe('a company that genuinely is not there still says so', () => {
  test('no row and no error is "Company not found", not a read failure', async () => {
    const { db } = fakeDb({ ...good(), companies: { data: null, error: null } })
    await assert.rejects(() => writeObligations(db, 'c1'), (e: unknown) => {
      assert.ok(!(e instanceof ReadFailed), 'an absent company is an answer, not a failed read')
      assert.match((e as Error).message, /Company not found/)
      return true
    })
  })
})
