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

const good = () => ({
  companies: COMPANY, entities: SITES, requirement_templates: LIBRARY,
  switches: SWITCHES, company_switches: COMPANY_SWITCHES,
  obligations: { count: 0, error: null },
})

describe('*** W1: a read that failed must not reach close_and_replace_obligations ***', () => {
  test('the good run still works — a check that cannot see a presence proves nothing', async () => {
    const { db, rpcCalls, updates } = fakeDb(good())
    const written = await writeObligations(db, 'c1')
    assert.equal(written.obligations.length, 1, 'the applying library row must produce an obligation')
    assert.deepEqual(rpcCalls, ['close_and_replace_obligations(1 obligations)'])
    assert.ok(updates.includes('companies: obligations_computed_at'), 'and the timestamp is stamped')
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

  test('*** zero obligations while rows are open: refused, with the number in the sentence ***', async () => {
    // The library read succeeded and every row serves another industry, so `resolve` returns
    // nothing. 221 of this company's requirements are open. Reconciling against nothing closes
    // all 221 — so it is refused even though no read reported a failure.
    const other = { data: [{ ...LIBRARY.data[0], industries: ['cannabis_extraction'] }] }
    const { db, rpcCalls, updates } = fakeDb({
      ...good(), requirement_templates: other, obligations: { count: 221, error: null },
    })
    await assert.rejects(() => writeObligations(db, 'c1'), /none at all, while 221 of yours are open/)
    assert.deepEqual(rpcCalls, [], 'nothing was closed')
    assert.deepEqual(updates, [])
  })

  test('zero obligations with NOTHING open is allowed — migration 022\'s "computed, and nothing applies"', async () => {
    const other = { data: [{ ...LIBRARY.data[0], industries: ['cannabis_extraction'] }] }
    const { db, rpcCalls, updates } = fakeDb({
      ...good(), requirement_templates: other, obligations: { count: 0, error: null },
    })
    const written = await writeObligations(db, 'c1')
    assert.equal(written.obligations.length, 0)
    assert.deepEqual(rpcCalls, ['close_and_replace_obligations(0 obligations)'],
      'the fix must not refuse every empty set, or a new company can never be computed')
    assert.ok(updates.includes('companies: obligations_computed_at'))
  })

  test('and if that open-row count itself cannot be taken, we stop rather than guess', async () => {
    const other = { data: [{ ...LIBRARY.data[0], industries: ['cannabis_extraction'] }] }
    const { db, rpcCalls } = fakeDb({
      ...good(), requirement_templates: other,
      obligations: { count: null, error: { message: 'permission denied for table obligations', code: '42501' } },
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
