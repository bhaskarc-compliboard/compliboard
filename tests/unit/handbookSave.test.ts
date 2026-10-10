/**
 * SAVING A HANDBOOK'S ROW — `lib/handbookSave.ts`, HR Step 5a, with a stand-in client.
 *
 * *** THERE IS NO SECOND WRITE ANY MORE — fix list H4, root R5, Job E. *** The older version used to be
 * marked not-current in this request, before the new file had been read, and a read that then failed left a
 * company with one handbook being told "None of your handbooks could be read". The retirement moved to
 * `lib/handbookRead.ts`, on the write that sets `status: 'read'`, and is proved in
 * `tests/unit/handbookRead.test.ts`. The tests below hold the upload's half of that: it must write exactly
 * ONE row and touch nothing else.
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
    assert.deepEqual(r, { status: 200, json: { id: 'new1', replaces: null } })
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
    assert.deepEqual(r.json, { id: 'new1', replaces: 'old1' })
    const row = writes[0][1] as Record<string, unknown>
    assert.equal(row.name, 'Employee Handbook')
    assert.equal(row.scope, 'site'); assert.equal(row.entity_id, 's1')
    assert.equal(row.file_name, 'Handbook-2027.docx'); assert.equal(row.version_of, 'old1')
  })
  test('*** H4: THE OLDER ONE IS NOT SWITCHED OFF AT UPLOAD *** — nothing is read yet', async () => {
    // This is the whole of H4's upload half, and it fails on the shipped code, which wrote
    // `{ is_current: false }` here. Switching the readable version off before the new file has been
    // read left a company with a handbook it held, could read, and could not reach: answers use
    // current versions only (`lib/hrAnswer.ts:119`), the older version's open check was cancelled as
    // replaced (`lib/handbookCheck.ts:290`), and the nightly job wants current AND read (`:550`).
    const { db, writes } = fakeDb({ older })
    await saveHandbookRow(db, CO, 'u1', { file_path: PATH, file_name: 'x.docx', version_of: 'old1' })
    assert.deepEqual(writes.map((w) => w[0]), ['insert'],
      'one write: the new row. The older one is retired by lib/handbookRead.ts once this file is read')
    assert.ok(!writes.some(([, patch]) => (patch as Record<string, unknown>).is_current === false),
      'no row may be marked not-current on the strength of a file nobody has read')
  })
  test('H4: and the new row still arrives current, so the page shows it and the reader claims it', async () => {
    const { db, writes } = fakeDb({ older })
    await saveHandbookRow(db, CO, 'u1', { file_path: PATH, file_name: 'x.docx', version_of: 'old1' })
    const row = writes[0][1] as Record<string, unknown>
    assert.equal(row.is_current, true)
    assert.equal(row.status, 'uploaded')
    assert.equal(row.version_of, 'old1', 'and it records which version it replaces, for the retirement')
  })
  test('an older version that is not this company\'s is a 404, and nothing is written', async () => {
    const { db, writes } = fakeDb({ older: null })
    assert.equal((await saveHandbookRow(db, CO, 'u1', { file_path: PATH, file_name: 'x.docx', version_of: 'nope' })).status, 404)
    assert.equal(writes.length, 0)
  })
})
