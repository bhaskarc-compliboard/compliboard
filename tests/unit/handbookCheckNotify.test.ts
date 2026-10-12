/**
 * THE HANDBOOK CHECK EMAIL — HR Step 8, finished. Copied from Audits' email (`lib/auditNotify.ts`): only a check
 * someone pressed, once, from the sweep alone; the link from one constant; the NEXT_PUBLIC_APP_URL refusal. No send.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { notifyCheck, handbookLink, HR_PAGE_PATH, EMAIL } from '../../lib/handbookCheckNotify.ts'

/** A stand-in database answering each table from a fixed row, and an admin API returning one login. */
function fakeDb(check: Record<string, unknown>, rows: unknown[] = []) {
  const tables: Record<string, unknown> = {
    handbook_checks: check,
    handbooks: { id: 'h1', name: 'Harbor Handbook' },
    handbook_check_sections: rows,
    handbook_sections: [{ id: 's1', position: 0 }, { id: 's2', position: 1 }, { id: 's3', position: 2 }],
  }
  const updates: string[] = []
  const from = (t: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) q[m] = () => q
    q.update = () => { updates.push(t); return q }
    q.maybeSingle = () => Promise.resolve({ data: tables[t], error: null })
    q.then = (res: (v: unknown) => void) => res({ data: tables[t], error: null })
    return q
  }
  return { db: { from, auth: { admin: { getUserById: async () => ({ data: { user: { email: 'person@example.com' } } }) } } }, updates }
}
const env = (vars: Record<string, string | undefined>, f: () => Promise<void>) => async () => {
  const old = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  try { await f() } finally { for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
}
const done = { id: 'c1', handbook_id: 'h1', status: 'done', requested_by: 'u1', notified_at: null, finished_at: '2026-10-08T17:53:00Z' }
const row = (id: string, sec: string, status: string, answer: string | null) => ({ id, section_id: sec, kind: 'section', status, word: null, answer_text: answer, answer_sources: [] })

describe('the email (words proposed in the brief)', () => {
  test('done: subject, the checked line with its date, the link — and nothing else (Audits\' email has no sign-off)',
    env({ NEXT_PUBLIC_APP_URL: 'https://app.compliboard.com/', NOTIFY_TEST_TO: undefined }, async () => {
      const r = await notifyCheck(fakeDb(done, [row('r1', 's1', 'done', 'A.')]).db, 'c1', { dryRun: true })
      assert.equal(r.subject, 'Your handbook check is done: Harbor Handbook')
      assert.equal(r.to, 'person@example.com')
      // Calendar B5: the shared frame (`lib/emailFrame.ts`) added the "why you got this" line that
      // this email never had, and the link is now the frame's one green button — which in the text
      // part prints as "Read the check: <link>", the sentence `EMAIL.readLine` always produced.
      // HR's own words are untouched.
      assert.equal(r.text, 'CompliBoard \u2014 Your company\nYour handbook check is done: Harbor Handbook\n\nHarbor Handbook was checked against the rules that apply to you on 8 October 2026.\n\nRead the check: https://app.compliboard.com/hr?handbook=h1\n\nYou get this because you asked CompliBoard to check your handbook, and we\u2019ve finished.')
    }))
  test('done with a failed part: the count line, from the stored rows as the page counts them',
    env({ NEXT_PUBLIC_APP_URL: 'https://app.compliboard.com', NOTIFY_TEST_TO: undefined }, async () => {
      const r = await notifyCheck(fakeDb(done, [row('r1', 's1', 'done', 'A.'), row('r2', 's2', 'failed', null), row('r3', 's3', 'done', 'B.')]).db, 'c1', { dryRun: true })
      assert.ok(r.text!.includes('\n\n1 part could not be checked. Press Check now to try again.\n\n'))
      assert.equal(EMAIL.partsLine(2), '2 parts could not be checked. Press Check now to try again.')
    }))
  test('failed: its subject and its one line with the link; NOTIFY_TEST_TO says where it would have gone',
    env({ NEXT_PUBLIC_APP_URL: 'https://app.compliboard.com', NOTIFY_TEST_TO: 'test@compliboard.com' }, async () => {
      const r = await notifyCheck(fakeDb({ ...done, status: 'failed' }).db, 'c1', { dryRun: true })
      assert.equal(r.subject, 'Your handbook check could not finish: Harbor Handbook')
      assert.equal(r.to, 'test@compliboard.com')
      // Calendar B5: the link moved out of the sentence and into the button ("Try again"), because
      // in HTML a bare URL beside a green button going to the same place reads as a mistake.
      // *** AND THE "why" LINE SAYS NOTHING ABOUT FINISHING HERE. *** The first version used one
      // sentence for both cases and put "and we've finished" under "We could not finish checking".
      assert.equal(r.text, "[staging: this would have gone to person@example.com]\n\nCompliBoard \u2014 Your company\nYour handbook check could not finish: Harbor Handbook\n\nWe could not finish checking Harbor Handbook. That's on our side, not yours. Press Check now to try again.\n\nTry again: https://app.compliboard.com/hr?handbook=h1\n\nYou get this because you asked CompliBoard to check your handbook.")
    }))
})

describe('who, when, and once', () => {
  test('a check nobody pressed (the nightly one) sends nothing; nor one not yet finished; nor one already notified', async () => {
    assert.match((await notifyCheck(fakeDb({ ...done, requested_by: null }).db, 'c1')).error!, /nobody pressed/)
    assert.match((await notifyCheck(fakeDb({ ...done, status: 'checking' }).db, 'c1')).error!, /not finished/)
    assert.equal((await notifyCheck(fakeDb({ ...done, notified_at: '2026-10-08T18:00:00Z' }).db, 'c1')).error, 'already notified')
  })
  test('no NEXT_PUBLIC_APP_URL: refused, and nothing stamped (Audits\' refusal)', env({ NEXT_PUBLIC_APP_URL: '' }, async () => {
    const f = fakeDb(done, [row('r1', 's1', 'done', 'A.')])
    const r = await notifyCheck(f.db, 'c1')
    assert.equal(r.error, 'NEXT_PUBLIC_APP_URL is not set'); assert.equal(r.notified, false)
    assert.ok(!f.updates.includes('handbook_checks'), 'notified_at is stamped only after a successful send')
  }))
  /**
   * *** THE SWEEP, AND ONLY THE SWEEP — and since E10 it sends from TWO points in it, both right
   * after a check finished. *** R7 item S11 added the second: `finishCheckIfDone` can throw, and
   * when it does every row of that check is already settled, so no later sweep's queue contains
   * them — the check said "Checking…" for ever and the email never went. Each sweep therefore
   * begins by finishing the checks that have nothing left to do, and that finish emails like the
   * other one. The rule this test protects is unchanged: nothing outside the sweep emails, and
   * nothing emails except straight after a finish.
   */
  test('sent only by the sweep, and only right after a check is reported finished', () => {
    const engine = readFileSync('lib/handbookCheck.ts', 'utf8')
    const calls = engine.match(/notifyCheck\(/g)?.length ?? 0
    assert.equal(calls, 2, 'the per-piece finish, and the recovery that finishes what a throw left')
    // Every send sits just after a `finished` branch — read as the distance back to it, because
    // that is what "right after" means and a regex over JSX-free TypeScript cannot say it better.
    for (const at of [...engine.matchAll(/notifyCheck\(/g)].map((m) => m.index ?? 0)) {
      const before = engine.slice(0, at)
      const finishedAt = Math.max(before.lastIndexOf('fin.finished'), before.lastIndexOf('fin = await'))
      assert.ok(finishedAt > 0 && at - finishedAt < 600,
        `a send ${at - finishedAt} characters after the nearest finish is not "right after" one`)
    }
    assert.ok(!readFileSync('app/api/hr/handbooks/[id]/check/route.ts', 'utf8').includes('notifyCheck'))
  })
})

describe('the link', () => {
  test('built from ONE constant (/hr since the go-live); the page opens that handbook\'s drawer', () => {
    assert.equal(HR_PAGE_PATH, '/hr')
    assert.equal(handbookLink('https://x', 'h 1'), 'https://x/hr?handbook=h%201')
    const page = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')
    assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\('handbook'\)/)
    assert.match(page, /if \(h\) \{ setTab\('handbooks'\); setDrawer\(h\) \}/)
  })
})
