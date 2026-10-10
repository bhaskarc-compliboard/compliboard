/**
 * HR'S HANDBOOKS — `lib/handbooks.ts` and `app/api/handbooks/route.ts`, HR Step 5a.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nameFromFile, isOwnHandbookPath, statusWords, olderVersions, handbookList, inUseNote, IN_USE_WHILE_READING, IN_USE_NEW_UNREADABLE, type HandbookRow } from '../../lib/handbooks.ts'

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
  for (const verb of ['POST', 'PATCH', 'DELETE']) {
    test(`${verb} reads the person's session first, with no preview switch (live since the go-live)`, () => {
      const body = src.slice(src.indexOf(`export async function ${verb}(`))
      const fn = body.slice(0, body.indexOf('\nexport async function', 1) > 0 ? body.indexOf('\nexport async function', 1) : undefined)
      assert.ok(!/hrPreview|HR_PREVIEW/.test(fn))
      assert.ok(fn.indexOf('requireCompany(request)') > 0 && fn.indexOf('requireCompany(request)') < fn.indexOf('authed.auth'))
    })
  }
  test('the save is lib/handbookSave.ts (held by its own test)', () => {
    assert.match(src, /await saveHandbookRow\(db, companyId, userId, await request\.json\(\)\)/)
  })
  test('it lives under /api/handbooks, not old HR\'s /api/hr', () => {
    assert.ok(!/\/api\/hr['/]/.test(src))
  })
})

// ===============================================================================================
// H4 (fix list, root R5, Job E) — TWO CURRENT VERSIONS, AND WHICH ONE ANSWERS A QUESTION.
//
// The older version is no longer switched off at upload (`lib/handbookSave.ts`): it is retired when
// the new file has been read (`lib/handbookRead.ts`). So between those two moments both are current,
// and the list has to say which is in use — otherwise they look like two handbooks of one name.
// ===============================================================================================
describe('H4 — a version still in use while its replacement is read', () => {
  const row = (o: Partial<HandbookRow>): HandbookRow => ({
    id: 'x', name: 'Employee Handbook', file_name: 'h.pdf', file_path: 'co/handbooks/h.pdf',
    scope: 'company', entity_id: null, status: 'read', status_reason: null,
    version_of: null, is_current: true, created_at: '2026-10-01T00:00:00Z', ...o,
  })
  const v1 = row({ id: 'v1', status: 'read', is_current: true })

  test('while the new version is being read, the old one says it is the one in use', () => {
    const v2 = row({ id: 'v2', version_of: 'v1', status: 'uploaded', is_current: true })
    assert.equal(inUseNote(v1, [v1, v2]), IN_USE_WHILE_READING)
    assert.equal(inUseNote(v2, [v1, v2]), null, 'the new one says its own status, not this')
  })

  test('*** when the new version could NOT be read, it says so — this is H4 in one line ***', () => {
    const v2 = row({ id: 'v2', version_of: 'v1', status: 'could_not_read', is_current: true })
    assert.equal(inUseNote(v1, [v1, v2]), IN_USE_NEW_UNREADABLE)
  })

  test('once the new version is read and the old one retired, neither says it', () => {
    const was = row({ id: 'v1', status: 'read', is_current: false })
    const v2 = row({ id: 'v2', version_of: 'v1', status: 'read', is_current: true })
    assert.equal(inUseNote(was, [was, v2]), null)
    assert.equal(inUseNote(v2, [was, v2]), null)
  })

  test('an ordinary single handbook says nothing', () => {
    assert.equal(inUseNote(v1, [v1]), null)
  })

  test('and the two list cleanly: neither is shown twice, because olderVersions skips a current row', () => {
    const v2 = row({ id: 'v2', version_of: 'v1', status: 'uploaded', is_current: true })
    const rows = handbookList([v1, v2], []).flatMap((g) => g.rows).map((h) => h.id)
    assert.deepEqual([...rows].sort(), ['v1', 'v2'])
    assert.equal(rows.length, 2, 'v1 must not appear both as a current row and as v2\'s older version')
  })
})
