/**
 * WHERE HR KEEPS A HANDBOOK'S FILE — `lib/storage.ts` `handbookPath`, HR Step 3b.
 *
 * The depth is the point: account delete walks `<company>/` and one folder down
 * (`app/api/account/route.ts` `listCompanyObjects`), so a handbook stored any deeper would survive
 * the deletion of the company that owns it.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { handbookPath, HANDBOOKS_PREFIX, DOCUMENTS_BUCKET } from '../../lib/storage.ts'

const CO = '97fef4fd-081a-4a60-bb84-aea1c017af87'

describe('a handbook is stored at <company>/handbooks/<file>, two levels', () => {
  test('the path is exactly company / handbooks / file', () => {
    const p = handbookPath(CO, 'Employee Handbook 2026.pdf', 1759600000000)
    assert.equal(p, `${CO}/handbooks/1759600000000-Employee Handbook 2026.pdf`)
    assert.equal(p.split('/').length, 3)
  })
  test('a slash in the file name cannot make it deeper', () => {
    for (const name of ['policies/2026/handbook.pdf', 'a\\b\\c.docx', '../../etc.pdf']) {
      const parts = handbookPath(CO, name, 1).split('/')
      assert.equal(parts.length, 3, name)
      assert.deepEqual(parts.slice(0, 2), [CO, 'handbooks'])
    }
  })
  test('the first folder is the company, so migration 002\'s storage policies apply', () => {
    assert.equal(handbookPath(CO, 'x.pdf', 1).split('/')[0], CO)
    assert.throws(() => handbookPath('', 'x.pdf'))
    assert.throws(() => handbookPath(`${CO}/evil`, 'x.pdf'))
  })
  test('the prefix is "handbooks", not old HR\'s "hr-handbooks"', () => {
    assert.equal(HANDBOOKS_PREFIX, 'handbooks')
    assert.equal(DOCUMENTS_BUCKET, 'company-documents')
  })
  test('account delete still walks exactly two levels, which is what makes this depth safe', () => {
    const route = readFileSync('app/api/account/route.ts', 'utf8')
    const walk = route.slice(route.indexOf('async function listCompanyObjects('), route.indexOf('return paths'))
    assert.match(walk, /\.list\(companyId, \{ limit: 1000 \}\)/)
    assert.match(walk, /\.list\(`\$\{companyId\}\/\$\{entry\.name\}`, \{ limit: 1000 \}\)/)
    assert.equal((walk.match(/\.list\(/g) ?? []).length, 2, 'two levels: the company folder, then each folder in it')
  })
})
