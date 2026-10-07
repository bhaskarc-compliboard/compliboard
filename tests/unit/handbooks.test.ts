/**
 * HR'S HANDBOOKS — `lib/handbooks.ts` and `app/api/handbooks/route.ts`, HR Step 5a.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nameFromFile, isOwnHandbookPath, statusWords, olderVersions, handbookList, type HandbookRow } from '../../lib/handbooks.ts'

const CO = '97fef4fd-081a-4a60-bb84-aea1c017af87'
const row = (id: string, o: Partial<HandbookRow> = {}): HandbookRow => ({
  id, name: id, file_name: `${id}.pdf`, file_path: `${CO}/handbooks/1-${id}.pdf`, scope: 'company', entity_id: null,
  status: 'uploaded', status_reason: null, version_of: null, is_current: true, created_at: '2026-10-07', ...o })

describe('a handbook\'s name and path', () => {
  test('the name is the file name without its extension, nothing else changed', () => {
    assert.equal(nameFromFile('Employee Handbook 2026.pdf'), 'Employee Handbook 2026')
    assert.equal(nameFromFile('WA addendum v2.final.docx'), 'WA addendum v2.final')
    assert.equal(nameFromFile('README'), 'README')
    assert.equal(nameFromFile('.hidden'), '.hidden')
  })
  test('a row may only point at <company>/handbooks/<file>, two levels', () => {
    assert.equal(isOwnHandbookPath(`${CO}/handbooks/1-a.pdf`, CO), true)
    assert.equal(isOwnHandbookPath(`other/handbooks/1-a.pdf`, CO), false)
    assert.equal(isOwnHandbookPath(`${CO}/hr-handbooks/1-a.pdf`, CO), false)
    assert.equal(isOwnHandbookPath(`${CO}/handbooks/x/1-a.pdf`, CO), false)
    assert.equal(isOwnHandbookPath(`${CO}/handbooks/`, CO), false)
  })
})

describe('the row\'s words', () => {
  test('each status in the owner\'s words; 5b only sets the status', () => {
    assert.equal(statusWords('uploaded', null), 'Waiting to be read')
    assert.equal(statusWords('reading', null), 'Reading…')
    assert.equal(statusWords('read', null), 'Read')
    assert.equal(statusWords('could_not_read', 'The file is password-protected.'), 'Could not read — The file is password-protected.')
  })
  test('every older version is listed under its current one, newest older first, ', () => {
    const a = row('a', { is_current: false, created_at: '2026-10-01' }), b = row('b', { version_of: 'a', is_current: false, created_at: '2026-10-03' })
    const c = row('c', { version_of: 'b', created_at: '2026-10-05' })
    assert.deepEqual(olderVersions(c, [a, b, c]).map((h) => h.id), ['b', 'a'])
    assert.deepEqual(olderVersions(row('solo'), [row('solo')]), [])
  })
  test('if the older one could not be marked replaced, both are current and neither is listed as the other\'s older version', () => {
    const a = row('a'), b = row('b', { version_of: 'a' })
    assert.deepEqual(olderVersions(b, [a, b]), [])
  })
  test('grouped Every site, then each site by name, then Site removed', () => {
    const sites = [{ id: 'p', name: 'Portland' }, { id: 'h', name: 'Hillsboro' }]
    const g = handbookList([row('x', { scope: 'site', entity_id: 'p' }), row('y'), row('z', { scope: 'site', entity_id: null }),
      row('w', { scope: 'site', entity_id: 'h' })], sites)
    assert.deepEqual(g.map((x) => [x.label, x.rows.map((r) => r.id), x.removed]),
      [['Every site', ['y'], false], ['Hillsboro', ['w'], false], ['Portland', ['x'], false], ['Site removed', ['z'], true]])
  })
  test('each current handbook is followed by its older versions, newest older first', () => {
    const v1 = row('v1', { is_current: false, created_at: '2026-10-01' }), v2 = row('v2', { version_of: 'v1', is_current: false, created_at: '2026-10-02' })
    const v3 = row('v3', { version_of: 'v2', created_at: '2026-10-03' })
    assert.deepEqual(handbookList([v1, v2, v3], [])[0].rows.map((r) => r.id), ['v3', 'v2', 'v1'])
  })
  test('AN OLDER ROW NO CHAIN REACHES IS NEVER HIDDEN: it is listed in its own site group, after the chains', () => {
    const sites = [{ id: 'p', name: 'Portland' }]
    const v3 = row('v3', { created_at: '2026-10-03' })                                       // its chain was broken
    const lost = row('lost', { is_current: false, created_at: '2026-10-01' })                // nothing points to it
    const lostSite = row('lostP', { is_current: false, scope: 'site', entity_id: 'p', created_at: '2026-10-01' })
    const g = handbookList([v3, lost, lostSite], sites)
    assert.deepEqual(g.map((x) => [x.label, x.rows.map((r) => r.id)]), [['Every site', ['v3', 'lost']], ['Portland', ['lostP']]])
    const total = g.reduce((n, x) => n + x.rows.length, 0)
    assert.equal(total, 3, 'every row appears exactly once')
  })
})

describe('the route', () => {
  const src = readFileSync('app/api/handbooks/route.ts', 'utf8')
  for (const verb of ['POST', 'DELETE']) {
    test(`${verb} answers 404 without HR_PREVIEW, before it reads the session`, () => {
      const body = src.slice(src.indexOf(`export async function ${verb}(`))
      const gate = body.indexOf('if (!hrPreviewOn()) return notFound()')
      assert.ok(gate > 0 && gate < body.indexOf('requireCompany(request)'), 'the preview check comes first')
      assert.ok(body.indexOf('await connection()') < gate, 'read per request')
    })
  }
  test('the save is lib/handbookSave.ts (held by its own test)', () => {
    assert.match(src, /await saveHandbookRow\(db, companyId, userId, await request\.json\(\)\)/)
  })
  test('it lives under /api/handbooks, not old HR\'s /api/hr', () => {
    assert.ok(!/\/api\/hr['/]/.test(src))
  })
})
