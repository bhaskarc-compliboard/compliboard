/**
 * DELETING ONE HANDBOOK VERSION — `lib/handbookDelete.ts`, HR Step 5a, with a stand-in client.
 * The middle-version case: the chain is relinked BEFORE the row goes, so the oldest version stays reachable.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { deleteHandbookVersion } from '../../lib/handbookDelete.ts'

const CO = 'co1'

/** A stand-in client over an in-memory table, recording every call in order. */
function fakeDb(rows: Array<Record<string, unknown>>, opts: { failStorage?: boolean } = {}) {
  const calls: string[] = []
  const table = rows.map((r) => ({ ...r }))
  const where = (field: string, value: unknown) => (r: Record<string, unknown>) => r[field] === value
  return {
    calls, table,
    db: {
      storage: { from: () => ({ remove: async (paths: string[]) => { calls.push(`storage.remove ${paths[0]}`); return { error: opts.failStorage ? { message: 'refused' } : null } } }) },
      from: () => ({
        select: () => ({ eq: (f: string, v: unknown) => ({ maybeSingle: async () => ({ data: table.find(where(f, v)) ?? null }) }) }),
        update: (patch: Record<string, unknown>) => ({ eq: async (f: string, v: unknown) => {
          calls.push(`update ${JSON.stringify(patch)} where ${f}=${v}`)
          for (const r of table.filter(where(f, v))) Object.assign(r, patch)
          return { error: null } } }),
        delete: () => ({ eq: (f: string, v: unknown) => ({ eq: async () => {
          calls.push(`delete where ${f}=${v}`)
          const i = table.findIndex(where(f, v)); if (i >= 0) table.splice(i, 1)
          for (const r of table) if (r.version_of === v) r.version_of = null   // what ON DELETE SET NULL would do
          return { error: null } } }) }),
      }),
    },
  }
}
const chain = () => [
  { id: 'v1', company_id: CO, file_path: 'co1/handbooks/v1.pdf', version_of: null, is_current: false },
  { id: 'v2', company_id: CO, file_path: 'co1/handbooks/v2.pdf', version_of: 'v1', is_current: false },
  { id: 'v3', company_id: CO, file_path: 'co1/handbooks/v3.pdf', version_of: 'v2', is_current: true },
]

describe('deleting a handbook version', () => {
  test('THE MIDDLE ONE: the newer version is pointed at the older one BEFORE the row goes, so v1 stays reachable', async () => {
    const { db, calls, table } = fakeDb(chain())
    const r = await deleteHandbookVersion(db, 'bucket', CO, 'v2')
    assert.deepEqual(r, { status: 200, json: { deleted: true } })
    assert.deepEqual(calls, [
      'storage.remove co1/handbooks/v2.pdf',
      'update {"version_of":"v1"} where version_of=v2',
      'delete where id=v2',
    ])
    assert.deepEqual(table.map((x) => [x.id, x.version_of, x.is_current]), [['v1', null, false], ['v3', 'v1', true]])
  })
  test('the oldest one: the newer one simply stops pointing at it; nothing else changes', async () => {
    const { db, table } = fakeDb(chain())
    await deleteHandbookVersion(db, 'bucket', CO, 'v1')
    assert.deepEqual(table.map((x) => [x.id, x.version_of, x.is_current]), [['v2', null, false], ['v3', 'v2', true]])
  })
  test('the current one: the version it replaced is current again', async () => {
    const { db, table } = fakeDb(chain())
    await deleteHandbookVersion(db, 'bucket', CO, 'v3')
    assert.deepEqual(table.map((x) => [x.id, x.version_of, x.is_current]), [['v1', null, false], ['v2', 'v1', true]])
  })
  test('storage refuses: nothing in the database changes', async () => {
    const { db, calls, table } = fakeDb(chain(), { failStorage: true })
    await assert.rejects(deleteHandbookVersion(db, 'bucket', CO, 'v2'))
    assert.deepEqual(calls, ['storage.remove co1/handbooks/v2.pdf'])
    assert.equal(table.length, 3)
  })
  test('another company\'s id is a 404, and nothing is touched', async () => {
    const { db, calls } = fakeDb(chain())
    assert.equal((await deleteHandbookVersion(db, 'bucket', 'other', 'v2')).status, 404)
    assert.deepEqual(calls, [])
  })
})
