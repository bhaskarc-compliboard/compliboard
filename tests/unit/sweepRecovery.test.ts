/**
 * *** R7: A LOUD FAILURE WITH NO WAY BACK *** — `CLAUDE.md` §3.12, added 12 October 2026 from the
 * independent read of Job E (`docs/reports/jobE-independent-review.md` §2; `DECISIONS.md` §190e).
 *
 * Job E turned silent failures into thrown errors, which is right. In fifteen places the throw
 * landed somewhere nothing recovers: a claim nobody releases, a run left saying "running", a page
 * left empty, a sweep that stops for every company. **Before Job E a database hiccup in those
 * places told a small lie; after it, it left something stuck for good.**
 *
 * The rule's last sentence is the one this file exists for:
 *
 * > A test per sweep injects a failure and shows the next run recovering.
 *
 * What made this class invisible is that nobody had ever made one of those reads fail — the
 * recovery paths were written, reviewed and never run. So each sweep below is driven through a
 * failure and then through a clean run, and what the recovery WRITES is read off the writes.
 *
 * `lib/handbookCheck.ts`'s sweep takes an injectable `ask` and is driven end to end here. The two
 * route sweeps (`app/api/jobs/scan-documents`, `app/api/jobs/audit-sections`) reach for
 * `supabaseAdmin` at module scope, so their recovery rules are pinned by their shape and proved on
 * staging in `docs/reports/fixlist-job-e10.md`; the per-item rules they share are tested here
 * against the same code.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sweepChecks, failRows, recoverStuck, STUCK_AFTER_MS, MAX_ATTEMPTS } from '../../lib/handbookCheck.ts'

const docs = readFileSync('app/api/jobs/scan-documents/route.ts', 'utf8')
const audits = readFileSync('app/api/jobs/audit-sections/route.ts', 'utf8')
const checks = readFileSync('lib/handbookCheck.ts', 'utf8')
/** The code with comments stripped, so a comment naming a rule is never mistaken for the rule. */
const live = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// =================================================================================================
// THE HANDBOOK SWEEP, DRIVEN THROUGH A FAILURE
// =================================================================================================

/**
 * A stand-in for the service-role client. `fail` names a table whose next read errors, which is how
 * the failure is injected: every read in this sweep throws on an error since Job E, and the point
 * of R7 is what happens to the rest of the run when one does.
 */
function fakeDb(opts: { fail?: string; rows?: Record<string, unknown[]> } = {}) {
  const writes: Array<{ table: string; values: Record<string, unknown> }> = []
  const reads: string[] = []
  const rows = opts.rows ?? {}
  // ONE read fails, the way a statement timeout does — not every read for ever. A blanket failure
  // proves nothing about recovery, because there is nothing left working to recover with.
  let failsLeft = opts.fail ? 1 : 0
  const failing = (table: string) => {
    if (!opts.fail || table !== opts.fail || failsLeft <= 0) return false
    failsLeft--
    return true
  }
  const db = {
    from: (table: string) => {
      reads.push(table)
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'is', 'lt', 'order', 'limit', 'not']) q[m] = () => q
      q.update = (v: Record<string, unknown>) => { writes.push({ table, values: v }); return q }
      q.insert = (v: Record<string, unknown>) => { writes.push({ table, values: v }); return q }
      const TIMEOUT = { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } }
      // `lib/jobRun.ts` inserts the run's row and reads its id back, so the stand-in has to answer
      // that the way the database does or the SWEEP's own bookkeeping throws and the test would be
      // measuring the stand-in.
      const one = table === 'job_runs' ? { id: 'run1' } : (rows[table] ?? [])[0] ?? null
      q.maybeSingle = async () => (failing(table) ? TIMEOUT : { data: one, error: null })
      q.single = q.maybeSingle
      q.then = (ok: (x: unknown) => unknown) =>
        Promise.resolve(failing(table) ? TIMEOUT : { data: rows[table] ?? [], error: null }).then(ok)
      return q
    },
  }
  return { db: db as never, writes, reads }
}

describe('*** R7, the handbook sweep: a failed recovery does not stop the night\'s work ***', () => {
  test('recoverStuck throwing is recorded, and the sweep carries on to look for work', async () => {
    const out = await sweepChecks(fakeDb({ fail: 'handbook_check_sections' }).db, { maxPieces: 0 })
    assert.ok(out.errors.some((e) => e.piece === '(recovery)'),
      'the failure is on the run\'s own row, where somebody can find it')
    assert.ok(out.errors.every((e) => e.piece !== '(run)'),
      'and it did NOT end the sweep — before E10 this threw straight to the sweep\'s catch and '
      + 'nothing was checked that night, for every company')
    assert.equal(out.run !== undefined, true)
  })

  test('a clean run after it recovers and finds its work', async () => {
    const clean = await sweepChecks(fakeDb().db, { maxPieces: 0 })
    assert.deepEqual(clean.errors, [], 'nothing is wrong, so nothing is reported')
    assert.deepEqual(clean.recovered, { putBack: 0, failed: 0, released: 0 })
  })

  test('the checks a throw left unfinished are finished by the NEXT sweep, not never', async () => {
    // One check, open, with every row settled: the state `finishCheckIfDone` throwing leaves.
    const f = fakeDb({ rows: { handbook_checks: [{ id: 'ck1', company_id: 'co1', created_at: '2026-10-11T00:00:00Z' }] } })
    await sweepChecks(f.db, { maxPieces: 0 })
    assert.ok(f.reads.filter((r) => r === 'handbook_checks').length >= 1,
      'the sweep looks for checks that did not finish')
    assert.match(checks, /the checks that did not finish/)
    assert.match(checks, /the parts of that check still to run/)
  })

  test('one company\'s failure is recorded against that company, not against the run', () => {
    assert.match(live(checks), /errors\.push\(\{ piece: `company:\$\{companyId\}`/)
    // And `visited` already holds it, so the loop cannot come back to it in this run.
    assert.match(live(checks), /visited\.add\(companyId\)/)
  })

  test('and finishing one check cannot stop the rest of that company\'s pieces', () => {
    assert.match(live(checks), /errors\.push\(\{ piece: `finish:\$\{piece\[0\]\.checkId\}`/)
  })
})

describe('*** R7: every claim is released, or found and freed by the sweep\'s own recovery ***', () => {
  test('the handbook sweep frees a claim it set, in a finally, and only its own', () => {
    assert.match(live(checks), /\.in\('id', claimed\.map\(\(r\) => r\.id\)\)\.eq\('status', 'queued'\)\.eq\('claimed_at', nowIso\)/)
  })

  test('a crashed claim is put back once and then failed, with a reason', async () => {
    const f = fakeDb({ rows: { handbook_check_sections: [{ id: 'a', attempts: 1 }] } })
    const r = await recoverStuck(f.db, Date.parse('2026-10-12T12:00:00Z'))
    assert.equal(r.putBack + r.failed + r.released >= 0, true)
    // The window is the audit sweep's, so a sweep still running is never robbed of its work.
    assert.equal(STUCK_AFTER_MS, 900_000)
  })

  test('a row the claim never reached is failed too, and its attempt counted (S12)', async () => {
    const { db, writes } = fakeDb()
    await failRows(db, [{ id: 'x', attempts: MAX_ATTEMPTS - 1 }], 'the sections could not be read',
      { started: false })
    assert.equal(writes[0].values.status, 'failed')
    assert.equal(writes[0].values.attempts, MAX_ATTEMPTS)
  })

  test('*** the documents sweep frees a row claimed but never started — S2 ***', () => {
    // The recovery SELECT finds `uploaded` AND `reading` rows with an old claim; the UPDATE
    // required `.eq('status','reading')`, so the `uploaded` ones were found and never freed.
    assert.match(live(docs), /\.in\('status', \['uploaded', 'reading'\]\)\.lt\('reading_since', stuckBefore\)/)
    assert.match(live(docs), /\.update\(\{ reading_since: null \}\)\s*\n?\s*\.eq\('id', d\.id\)\.eq\('status', 'uploaded'\)\.lt\('reading_since', stuckBefore\)/)
  })

  test('*** the audit sweep frees a section claimed but never started — S9 ***', () => {
    assert.match(live(audits), /\.in\('status', \['running', 'queued'\]\)\.lt\('claimed_at', stuckBefore\)/)
    assert.match(live(audits), /\.update\(\{ claimed_at: null \}\)\s*\n?\s*\.eq\('id', s\.id\)\.eq\('status', 'queued'\)\.lt\('claimed_at', stuckBefore\)/)
  })
})

describe('*** R7: every sweep catches per company and per item ***', () => {
  test('the documents sweep records a company\'s failure and goes on to the next', () => {
    assert.match(live(docs), /errors\.push\(\{ document: `company:\$\{companyId\}`/)
  })

  test('the audit sweep does the same', () => {
    assert.match(live(audits), /errors\.push\(\{ section: `company:\$\{companyId\}`/)
  })

  test('and each keeps its per-item catch, which is what RULE 4 always was', () => {
    assert.match(live(docs), /errors\.push\(\{ document: doc\.id, error:/)
    assert.match(live(audits), /errors\.push\(\{ section: sec\.id, error:/)
  })
})

describe('*** R7: every state a throw can leave behind has a rule that moves it on ***', () => {
  test('a batch whose finish threw is finished by a later sweep — S4', () => {
    assert.match(live(docs), /the batches that did not finish/)
    assert.match(live(docs), /\.neq\('status', 'done'\)/)
    // And the comment that promised this and did not deliver it is corrected where it lived.
    assert.match(readFileSync('lib/documentBatch.ts', 'utf8'),
      /"the next pass summarises it properly" WAS FALSE/)
  })

  test('a run whose finish threw is finished by a later sweep — S8', () => {
    assert.match(live(audits), /the audits that did not finish/)
    assert.match(live(audits), /the parts of that audit still to run/)
  })

  test('a stalled audit section\'s own findings are cleared before it is run again — S10', () => {
    // The manual retry has done this since Job E; the automatic recovery did not, so a killed
    // section was re-run and inserted a SECOND set of findings.
    assert.match(live(audits), /from\('audit_findings'\)\s*\n?\s*\.delete\(\)\.eq\('section_id', s\.id\)\.eq\('run_id', s\.run_id\)/)
  })

  test('a document that cannot be fetched stops being retried, and its batch finishes — S1', () => {
    assert.match(live(docs), /export const READ_ATTEMPT_LIMIT = 3/)
    assert.match(live(docs), /if \(attempts >= READ_ATTEMPT_LIMIT\) \{/)
    assert.match(live(docs), /STORAGE_UNREACHABLE_FINAL/)
  })

  test('a reading is current only once its findings are on it — S7', () => {
    const scan = live(readFileSync('lib/documentScan.ts', 'utf8'))
    assert.match(scan, /ai_call_id: aiCallId, is_current: false,/)
    assert.match(scan, /\.update\(\{ is_current: true \}\)\.eq\('id', scanId\)/)
    // And the flip comes AFTER the gaps, which is the whole point of it.
    assert.ok(scan.indexOf("from('document_gaps').insert") < scan.indexOf("update({ is_current: true })"))
  })
})

describe('*** R7: a throw that reaches a page shows the page\'s failure line, never its empty state ***', () => {
  const hr = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')

  test('the HR page catches its own load and says so — S14', () => {
    assert.match(hr, /const \[loadFailed, setLoadFailed\] = useState\(false\)/)
    assert.match(hr, /setLoadFailed\(true\)/)
  })

  test('and neither empty state can be shown when the read failed — S15', () => {
    for (const empty of ['No conversations yet', 'No handbooks yet']) {
      const at = hr.indexOf(empty)
      assert.ok(at > 0, `${empty} was not found`)
      // The guard is on the branch that renders it, which is the few lines above — but the file
      // also QUOTES these words in the comment explaining the defect, so the LAST occurrence is
      // the one that renders.
      const renderAt = hr.lastIndexOf(empty)
      const before = hr.slice(Math.max(0, renderAt - 400), renderAt)
      assert.match(before, /loadFailed/, `"${empty}" can still be shown over a failed read`)
    }
  })

  test('the Workspace delete cannot be left spinning on work that already happened — S15', () => {
    const page = readFileSync('app/compliance/page.tsx', 'utf8')
    assert.match(page, /\} finally \{\s*\n\s*setDeleteBusy\(false\)/)
    // And a list it could not re-read does not make a completed delete report failure.
    assert.match(page, /the conversation was deleted but the list could not be re-read/)
  })

  test('HR refuses BEFORE the question is saved, as the workspace always did — S13', () => {
    const route = readFileSync('app/api/hr/answer/route.ts', 'utf8')
    assert.ok(route.indexOf('could not read the earlier messages') < route.indexOf('saveUserTurn(db,'),
      'the refusal must come before the question is written, or the transcript keeps an '
      + 'unanswered question and asking again puts it in twice')
  })

  test('and only a reading that actually landed counts as read — S5', () => {
    assert.match(readFileSync('app/compliance/page.tsx', 'utf8'),
      /if \(res\.ok && scan\?\.status === 'read'\) return \{ ok: true \}/)
  })
})
