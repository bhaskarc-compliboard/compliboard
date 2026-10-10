/**
 * D3 — A FOLDER MUST NOT BE DELETED ON A COUNT NOBODY GOT (root R2, Job E).
 *
 * **Made to fail on the old code first.** `oldGuard` below is the shipped logic, copied exactly, and
 * the first test shows it DELETING a folder that holds four files, because the count failed and
 * `null && …` is falsy. That is the failure; the rest is the fix.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { folderBlockers } from '../../lib/folderDelete.ts'
import { ReadFailed } from '../../lib/mustRead.ts'
import { readFileSync } from 'node:fs'

const FAILED = { count: null, error: { message: 'permission denied for table documents', code: '42501' } }

describe('*** THE OLD CODE DELETED A FOLDER FULL OF FILES ***', () => {
  /** `app/api/folders/route.ts` as it shipped, copied line for line. */
  function oldGuard(res: { count: number | null; error: unknown }): 'refuse' | 'DELETE IT' {
    const { count } = res                       // `error` never destructured — that is the bug
    if (count && count > 0) return 'refuse'
    return 'DELETE IT'
  }

  test('a real count of 4 refused, as it should', () => {
    assert.equal(oldGuard({ count: 4, error: null }), 'refuse')
  })

  test('*** the same folder, with the count FAILING: deleted ***', () => {
    // The folder still holds four files. Nobody could ask how many. The old code deleted it.
    assert.equal(oldGuard(FAILED), 'DELETE IT',
      'this is the shipped behaviour, and it is why D3 is severity 1')
  })
})

describe('the fix: a count we could not take refuses the delete', () => {
  const ok = (n: number) => ({ count: n, error: null })

  test('a failed FILES count throws, naming what could not be read', () => {
    assert.throws(() => folderBlockers({ files: FAILED, subfolders: ok(0) }), (e: unknown) => {
      assert.ok(e instanceof ReadFailed)
      assert.equal(e.what, "the folder's files")
      return true
    })
  })

  test('a failed SUB-FOLDER count throws too — the second read is not forgotten', () => {
    assert.throws(() => folderBlockers({ files: ok(0), subfolders: FAILED }), (e: unknown) => {
      assert.ok(e instanceof ReadFailed)
      assert.equal(e.what, "the folder's sub-folders")
      return true
    })
  })

  test('and an EMPTY folder is still deletable — the fix must not refuse everything', () => {
    assert.deepEqual(folderBlockers({ files: ok(0), subfolders: ok(0) }), { files: 0, subfolders: 0 })
  })

  test('a folder that holds files reports them, so the route can say so', () => {
    assert.equal(folderBlockers({ files: ok(4), subfolders: ok(0) }).files, 4)
  })
})

describe('the route turns that into a refusal a person can act on', () => {
  test('503 and plain words, never the PostgREST message', () => {
    const raw = readFileSync('app/api/folders/route.ts', 'utf8')
    // Comments out first: the paragraph explaining this fix QUOTES the old `count && count > 0`,
    // so a test reading the raw file finds the bug it just removed. Third time this exact trap has
    // bitten (the dashboard's test, the email frame's, now this) — it is worth the two lines.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.match(src, /if \(error instanceof ReadFailed\)/)
    assert.match(src, /We couldn.u2019t check whether this folder still holds files/)
    assert.match(src, /status: 503/)
    // The old falsy-null guard is gone from the file entirely.
    assert.ok(!/count && count > 0/.test(src))
    assert.ok(!/subCount && subCount > 0/.test(src))
  })
})
