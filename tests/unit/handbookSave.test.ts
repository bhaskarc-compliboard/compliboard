/**
 * SAVING A HANDBOOK'S ROW — `lib/handbookSave.ts`, HR Step 5a, with a stand-in client. The second write
 * (marking the older version replaced) happens on the server, so its failure is proved here.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { saveHandbookRow } from '../../lib/handbookSave.ts'

const CO = '97fef4fd-081a-4a60-bb84-aea1c017af87'
const PATH = `${CO}/handbooks/1-new.docx`

/** A stand-in for the caller's client: records every write, and can be told to refuse the update. */
function fakeDb(opts: { older?: Record<string, unknown> | null; failUpdate?: boolean; site?: boolean } = {}) {
  const writes: Array<[string, unknown]> = []
  const chain = (result: unknown) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq']) q[m] = () => q
    q.maybeSingle = async () => result
    q.single = async () => result
    return q
  }
  return {
    writes,
    db: {
      from: (t: string) => ({
        select: () => chain(t === 'entities' ? { data: opts.site ? { id: 's1' } : null } : { data: opts.older ?? null }),
        insert: (row: unknown) => { writes.push(['insert', row]); return chain({ data: { id: 'new1' }, error: null }) },
        update: (patch: unknown) => {
          writes.push(['update', patch])
          return { eq: async () => ({ error: opts.failUpdate ? { message: 'refused' } : null }) }
        },
      }),
    },
  }
}

describe('a new handbook', () => {
  test('saved company-wide, named from its file, status uploaded, current', async () => {
    const { db, writes } = fakeDb()
    const r = await saveHandbookRow(db, CO, 'u1', { file_path: PATH, file_name: 'Employee Handbook 2026.docx' })
    assert.deepEqual(r, { status: 200, json: { id: 'new1' } })
    const row = writes[0][1] as Record<string, unknown>
    assert.equal(row.name, 'Employee Handbook 2026'); assert.equal(row.scope, 'company'); assert.equal(row.entity_id, null)
    assert.equal(row.status, 'uploaded'); assert.equal(row.is_current, true); assert.equal(row.uploaded_by, 'u1')
  })
  test('a path outside <company>/handbooks/ is refused before anything is written', async () => {
    const { db, writes } = fakeDb()
    assert.equal((await saveHandbookRow(db, CO, 'u1', { file_path: `other/handbooks/x.pdf`, file_name: 'x.pdf' })).status, 403)
    assert.equal(writes.length, 0)
  })
  test('a site handbook needs a site of this company', async () => {
    assert.equal((await saveHandbookRow(fakeDb({ site: false }).db, CO, 'u1', { file_path: PATH, file_name: 'x.pdf', scope: 'site', entity_id: 's9' })).status, 404)
    const ok = fakeDb({ site: true })
    assert.equal((await saveHandbookRow(ok.db, CO, 'u1', { file_path: PATH, file_name: 'x.pdf', scope: 'site', entity_id: 's1' })).status, 200)
    assert.equal((ok.writes[0][1] as Record<string, unknown>).entity_id, 's1')
  })
})

describe('a newer version', () => {
  const older = { id: 'old1', name: 'Employee Handbook', scope: 'site', entity_id: 's1' }
  test('keeps the handbook\'s NAME, scope and site, read from the older row; only the file is new', async () => {
    const { db, writes } = fakeDb({ older })
    const r = await saveHandbookRow(db, CO, 'u1', { file_path: PATH, file_name: 'Handbook-2027.docx', version_of: 'old1', scope: 'company' })
    assert.deepEqual(r.json, { id: 'new1' })
    const row = writes[0][1] as Record<string, unknown>
    assert.equal(row.name, 'Employee Handbook')
    assert.equal(row.scope, 'site'); assert.equal(row.entity_id, 's1')
    assert.equal(row.file_name, 'Handbook-2027.docx'); assert.equal(row.version_of, 'old1')
  })
  test('the older one is marked replaced only AFTER the newer one is saved', async () => {
    const { db, writes } = fakeDb({ older })
    await saveHandbookRow(db, CO, 'u1', { file_path: PATH, file_name: 'x.docx', version_of: 'old1' })
    assert.deepEqual(writes.map((w) => w[0]), ['insert', 'update'])
    assert.deepEqual(writes[1][1], { is_current: false })
  })
  test('THE SECOND WRITE FAILS: the newer one is kept, and the person is told both are shown', async () => {
    const { db, writes } = fakeDb({ older, failUpdate: true })
    const r = await saveHandbookRow(db, CO, 'u1', { file_path: PATH, file_name: 'x.docx', version_of: 'old1' })
    assert.deepEqual(r, { status: 200, json: { id: 'new1', older_not_replaced: true } })
    assert.equal(writes[0][0], 'insert', 'the newer row was saved and is not undone')
  })
  test('an older version that is not this company\'s is a 404, and nothing is written', async () => {
    const { db, writes } = fakeDb({ older: null })
    assert.equal((await saveHandbookRow(db, CO, 'u1', { file_path: PATH, file_name: 'x.docx', version_of: 'nope' })).status, 404)
    assert.equal(writes.length, 0)
  })
})
