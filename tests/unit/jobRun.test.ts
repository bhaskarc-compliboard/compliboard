/**
 * A SWEEP WRITES A `job_runs` ROW ONLY WHEN IT HAD SOMETHING TO SAY — `lib/jobRun.ts`, the cron
 * release follow-up (`DECISIONS.md` §163). The live proof on staging is in that entry.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordDecision, lazyJobRun } from '../../lib/jobRun.ts'

/** A stand-in for the service-role client: records every insert and update to job_runs. */
function fakeDb() {
  const writes: Array<{ op: 'insert' | 'update'; row: Record<string, unknown>; id?: unknown }> = []
  const db = {
    writes,
    from(table: string) {
      assert.equal(table, 'job_runs')
      return {
        insert(row: Record<string, unknown>) {
          writes.push({ op: 'insert', row })
          const done = Promise.resolve({ error: null })
          return Object.assign(done, { select: () => ({ single: async () => ({ data: { id: 'run-1' }, error: null }) }) })
        },
        update(row: Record<string, unknown>) {
          return { eq: async (_c: string, id: unknown) => { writes.push({ op: 'update', row, id }); return { error: null } } }
        },
      }
    },
  }
  return db
}

describe('the rule', () => {
  test('no work and no error → nothing; an error alone → one whole row; opened → close it', () => {
    assert.equal(recordDecision(false, 0), 'none')
    assert.equal(recordDecision(false, 2), 'insert')
    assert.equal(recordDecision(true, 0), 'update')
    assert.equal(recordDecision(true, 3), 'update')
  })
})

describe('the recorder', () => {
  test('an empty sweep writes NO row', async () => {
    const db = fakeDb()
    const run = lazyJobRun(db, 'scan_documents')
    assert.equal(await run.finish({ companies: 0 }, []), 'none')
    assert.equal(db.writes.length, 0)
    assert.equal(run.id, null)
  })
  test('a sweep that finds work opens its row BEFORE the work, once, and closes it after', async () => {
    const db = fakeDb()
    const run = lazyJobRun(db, 'audit_sections')
    await run.open(); await run.open()   // found work twice: still one row
    assert.deepEqual(db.writes, [{ op: 'insert', row: { job: 'audit_sections' } }])
    assert.equal(run.id, 'run-1')
    assert.equal(await run.finish({ companies: 1, done: 2 }, []), 'update')
    assert.equal(db.writes.length, 2)
    assert.equal(db.writes[1].op, 'update')
    assert.equal(db.writes[1].id, 'run-1')
    assert.deepEqual(db.writes[1].row.counts, { companies: 1, done: 2 })
    assert.equal(db.writes[1].row.ok, true)
    assert.ok(db.writes[1].row.finished_at)
  })
  test('a sweep that found no work but hit an error writes one complete row', async () => {
    const db = fakeDb()
    const run = lazyJobRun(db, 'scan_documents')
    assert.equal(await run.finish({ companies: 0 }, [{ document: '(run)', error: 'listing failed' }]), 'insert')
    assert.equal(db.writes.length, 1)
    assert.equal(db.writes[0].op, 'insert')
    assert.equal(db.writes[0].row.job, 'scan_documents')
    assert.deepEqual(db.writes[0].row.errors, [{ document: '(run)', error: 'listing failed' }])
    assert.ok(db.writes[0].row.finished_at)
  })
})

describe('who uses it', () => {
  for (const [file, job] of [['scan-documents', 'scan_documents'], ['audit-sections', 'audit_sections']]) {
    test(`app/api/jobs/${file} opens lazily — when it recovers or claims — and never at the top`, () => {
      const src = readFileSync(`app/api/jobs/${file}/route.ts`, 'utf8')
      assert.match(src, new RegExp(`const run = lazyJobRun\\(supabaseAdmin, '${job}'\\)`))
      assert.ok(!/startJobRun/.test(src))
      assert.match(src, /if \(stuck\?\.length\) await run\.open\(\)/)
      assert.match(src, /if \(!queue\.length\) continue\n\s*await run\.open\(\)/)
    })
  }
  for (const file of ['summarise', 'delete']) {
    test(`app/api/jobs/${file} still writes its row every run — the evidence it ran`, () => {
      assert.match(readFileSync(`app/api/jobs/${file}/route.ts`, 'utf8'), /await startJobRun\(supabaseAdmin, '/)
    })
  }
})
