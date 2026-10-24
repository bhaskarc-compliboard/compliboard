/**
 * THE READ-ONLY STATE — My Account step 18, `ACCOUNT-PLAN.md` decision 11, `DECISIONS.md` §215.
 *
 * Four things are proved here, and the fourth is the one that needed a refactor to be provable:
 *   1. `splitByAccess` — the pure decision every sweep shares.
 *   2. `requireAccess` — the 402 at each of the nineteen doors, read through the CALLER's client.
 *   3. `logSkips` — one line per company per run, not one per work item.
 *   4. A REAL RUN OF ALL FOUR SWEEPS against a fake database, with a paying company and a
 *      read-only company in the same run: the paying one's work is claimed, the read-only one's
 *      rows come out byte-identical to how they went in, and one line is logged.
 *
 * (4) is why `sweep()` gained `admin: SupabaseClient = supabaseAdmin` in the three job routes.
 * Before that, three of the four sweeps reached a module-scope client and the only way to
 * exercise them was against a real database — so the skip would have been a claim nothing could
 * check (`CLAUDE.md` §9a: a thing is done when something real uses it).
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { splitByAccess, logSkips, loadBilling, sentenceFor, accessRefusal } from '../../lib/accessGate.ts'
import type { BillingColumns } from '../../lib/billing.ts'
import { makeDb } from './fakeSupabase.ts'

const NOW = new Date('2026-10-23T12:00:00Z')
const past = new Date('2026-10-01T00:00:00Z').toISOString()
const future = new Date('2026-11-30T00:00:00Z').toISOString()

/** A company still inside its trial. */
const TRIAL: BillingColumns = { trial_ends_at: future, subscription_status: null, payment_failed_at: null }
/** A company paying. */
const PAYING: BillingColumns = { trial_ends_at: past, subscription_status: 'active', payment_failed_at: null }
/** The ordinary end of a free trial — read-only. */
const LAPSED: BillingColumns = { trial_ends_at: past, subscription_status: null, payment_failed_at: null }
/** Cancelled — read-only. */
const CANCELLED: BillingColumns = { trial_ends_at: past, subscription_status: 'canceled', payment_failed_at: null }

describe('splitByAccess — the one decision the four sweeps share', () => {
  const items = [
    { id: 'i1', company_id: 'paying' },
    { id: 'i2', company_id: 'lapsed' },
    { id: 'i3', company_id: 'trial' },
    { id: 'i4', company_id: 'lapsed' },
    { id: 'i5', company_id: 'cancelled' },
    { id: 'i6', company_id: 'ghost' },
  ]
  const billing = new Map<string, BillingColumns>([
    ['paying', PAYING], ['lapsed', LAPSED], ['trial', TRIAL], ['cancelled', CANCELLED],
  ])

  test('the allowed are the paying and the still-trialling, in the order they arrived', () => {
    const { allowed } = splitByAccess(items, billing, NOW)
    assert.deepEqual(allowed.map((i) => i.id), ['i1', 'i3'])
  })

  test('*** THE §9a CONTROL: it can return a NON-EMPTY allowed list. ***', () => {
    // A splitter that skipped everything would satisfy most of the assertions in this file —
    // "the read-only company was not worked" is true of a sweep that works nobody. So this is
    // the check that the thing can see a presence before any check reports an absence.
    const { allowed, skipped } = splitByAccess(items, billing, NOW)
    assert.ok(allowed.length > 0, 'nothing was allowed — every other test here would still pass')
    assert.ok(skipped.length > 0, 'nothing was skipped — the gate is not gating')
    assert.equal(allowed.length + skipped.length, items.length, 'an item was lost')
  })

  test('each skip carries the reason, so the log and the 402 can say which', () => {
    const { skipped } = splitByAccess(items, billing, NOW)
    assert.deepEqual(skipped.map((s) => [s.item.id, s.reason]), [
      ['i2', 'trial_over_no_subscription'],
      ['i4', 'trial_over_no_subscription'],
      ['i5', 'not_paying'],
      ['i6', 'company_not_found'],
    ])
  })

  test('a company with no billing row is SKIPPED, never allowed', () => {
    // An orphan work item: there is nobody to bill, so there is nobody to spend for. Failing
    // open here would be a company that was deleted still costing money.
    const { allowed, skipped } = splitByAccess([{ company_id: 'ghost' }], new Map(), NOW)
    assert.equal(allowed.length, 0)
    assert.equal(skipped[0].reason, 'company_not_found')
  })

  test('empty input is empty output, and does not throw', () => {
    assert.deepEqual(splitByAccess([], billing, NOW), { allowed: [], skipped: [] })
  })

  test('order is preserved — scan-documents picks allowed[0] as the OLDEST', () => {
    const many = ['paying', 'trial', 'paying'].map((c, i) => ({ id: `x${i}`, company_id: c }))
    assert.deepEqual(splitByAccess(many, billing, NOW).allowed.map((i) => i.id), ['x0', 'x1', 'x2'])
  })

  test('the trial boundary is the clock passed in, not the wall clock', () => {
    const row = { company_id: 'c' }
    const b = new Map([['c', { trial_ends_at: '2026-10-23T12:00:00Z', subscription_status: null, payment_failed_at: null }]])
    assert.equal(splitByAccess([row], b, new Date('2026-10-23T11:59:59Z')).allowed.length, 1)
    assert.equal(splitByAccess([row], b, new Date('2026-10-23T12:00:01Z')).allowed.length, 0)
  })
})

describe('logSkips — one line per COMPANY per run', () => {
  test('forty queued documents for one company is one line, not forty', () => {
    const skipped = Array.from({ length: 40 }, (_, i) => ({
      item: { id: `d${i}`, company_id: 'lapsed' }, companyId: 'lapsed', reason: 'trial_over_no_subscription' as const,
    }))
    const lines = logSkips('jobs/scan-documents', skipped, 'document')
    assert.equal(lines.length, 1)
    assert.match(lines[0], /^\[jobs\/scan-documents\] skipped company lapsed: read_only \(trial_over_no_subscription\) — 40 documents left queued$/)
  })

  test('two companies are two lines, and one item is singular', () => {
    const lines = logSkips('jobs/summarise', [
      { item: { company_id: 'a' }, companyId: 'a', reason: 'not_paying' as const },
      { item: { company_id: 'b' }, companyId: 'b', reason: 'trial_over_no_subscription' as const },
    ], 'topic')
    assert.equal(lines.length, 2)
    assert.match(lines[0], /company a: read_only \(not_paying\) — 1 topic left queued$/)
    assert.match(lines[1], /company b: .* 1 topic left queued$/)
  })

  test('nothing skipped writes nothing', () => {
    assert.deepEqual(logSkips('jobs/summarise', [], 'topic'), [])
  })
})

describe('sentenceFor — four refusals, each naming what still works and what to do', () => {
  const cases = [
    ['trial_over_no_subscription', /Your trial has ended\./, /add a card/],
    ['payment_failed_grace_over', /couldn't charge your card/, /update your card/],
    ['not_paying', /isn't active/, /add a card/],
    ['status_not_recognised', /don't recognise/, /add a card/],
  ] as const
  for (const [reason, opening, action] of cases) {
    test(`${reason}: says what still works, and what they can do`, () => {
      const s = sentenceFor(reason, 'canceled')
      assert.match(s, opening)
      assert.match(s, action)
      // §5.1, on every one of them: never imply the person did something wrong, and always say
      // what they still have. "Everything is still here to read and download" IS decision 11.
      assert.match(s, /still here to read and download/)
      assert.ok(!/you (failed|must|should have)/i.test(s), 'blames the person')
    })
  }

  test('the unrecognised one NAMES THE WORD, which is the whole reason it exists', () => {
    // Migration 087 keeps `subscription_status` as text so a word Stripe invents is RECORDABLE.
    // This is the half that makes it actionable: support can be told which word without a log.
    assert.match(sentenceFor('status_not_recognised', 'quantum_superposition'),
      /\(quantum_superposition\)/)
  })

  test('…and survives a null status without printing "(null)"', () => {
    const s = sentenceFor('status_not_recognised', null)
    assert.ok(!s.includes('('), s)
  })
})

describe('loadBilling', () => {
  const okDb = (rows: unknown[]) => ({
    from: () => ({ select: () => ({ in: async () => ({ data: rows, error: null }) }) }),
  })

  test('returns a map keyed by company id', async () => {
    const m = await loadBilling(okDb([{ id: 'a', ...PAYING }, { id: 'b', ...LAPSED }]), ['a', 'b'])
    assert.deepEqual([...m.keys()].sort(), ['a', 'b'])
  })

  test('de-duplicates the ids it asks for', async () => {
    let asked: string[] = []
    const db = { from: () => ({ select: () => ({ in: async (_c: string, ids: string[]) => { asked = ids; return { data: [], error: null } } }) }) }
    await loadBilling(db, ['a', 'a', 'b', 'a'])
    assert.deepEqual(asked, ['a', 'b'])
  })

  test('no ids means no query at all', async () => {
    let called = false
    const db = { from: () => { called = true; return { select: () => ({ in: async () => ({ data: [], error: null }) }) } } }
    assert.equal((await loadBilling(db, [])).size, 0)
    assert.equal(called, false)
  })

  test('*** A FAILED READ THROWS — it must never look like "nobody may spend". ***', async () => {
    // §9a: a check that cannot see anything looks exactly like a check that found nothing. An
    // empty map here would skip EVERY company and silently stop all work in every sweep, which
    // is indistinguishable from a correct run in which nobody owed anything.
    const bad = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'connection reset' } }) }) }) }
    await assert.rejects(() => loadBilling(bad, ['a']), /loadBilling failed: connection reset/)
  })
})

describe('accessRefusal — the decision at each of the nineteen doors', () => {
  // `requireAccess` is this function plus a `companies` read and `NextResponse.json`. The read
  // goes through `auth.db`, the CALLER's RLS-scoped client, which is asserted on the source
  // below because the client itself cannot be constructed here.

  test('a company inside its trial is let through — null, not a response', () => {
    assert.equal(accessRefusal(TRIAL, NOW), null)
  })

  test('a paying company is let through', () => {
    assert.equal(accessRefusal(PAYING, NOW), null)
  })

  test('*** INSIDE THE GRACE, ACCESS IS STILL FULL. ***', () => {
    // Decision 11 promises seven days. A gate that refused on day 1 of them would take back the
    // thing the banner is at that moment promising in writing.
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 86400_000).toISOString()
    assert.equal(accessRefusal({ trial_ends_at: past, subscription_status: 'past_due', payment_failed_at: threeDaysAgo }, NOW), null)
  })

  test('…and the day after the grace, it is 402', () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 86400_000).toISOString()
    const r = accessRefusal({ trial_ends_at: past, subscription_status: 'past_due', payment_failed_at: eightDaysAgo }, NOW)
    assert.equal(r?.status, 402)
    assert.equal(r?.body.reason, 'payment_failed_grace_over')
  })

  const refusals = [
    ['the trial ran out and no card was added', LAPSED, 'trial_over_no_subscription'],
    ['cancelled', CANCELLED, 'not_paying'],
    ['unpaid — Stripe has stopped trying', { trial_ends_at: past, subscription_status: 'unpaid', payment_failed_at: null }, 'not_paying'],
    ['paused', { trial_ends_at: past, subscription_status: 'paused', payment_failed_at: null }, 'not_paying'],
    ['incomplete', { trial_ends_at: past, subscription_status: 'incomplete', payment_failed_at: null }, 'not_paying'],
    ['incomplete_expired', { trial_ends_at: past, subscription_status: 'incomplete_expired', payment_failed_at: null }, 'not_paying'],
    ['a word Stripe has not invented yet', { trial_ends_at: past, subscription_status: 'vibing', payment_failed_at: null }, 'status_not_recognised'],
  ] as const

  for (const [name, row, reason] of refusals) {
    test(`402 for ${name}, with the reason and one plain sentence`, () => {
      const r = accessRefusal(row as BillingColumns, NOW)
      assert.equal(r?.status, 402, `${name} was let through`)
      assert.equal(r?.body.reason, reason)
      assert.equal(r?.body.access, 'read_only')
      assert.match(String(r?.body.error), /still here to read and download/)
    })
  }

  test('402 and not 403 — "Payment Required" is the one status that means this', () => {
    // And it is distinguishable in a log from the 401/404 `requireCompany` already returns.
    assert.equal(accessRefusal(LAPSED, NOW)?.status, 402)
  })

  test('a read that FAILED is 503, never 402 — we have not decided anything about them', () => {
    const r = accessRefusal(PAYING, NOW, true)
    assert.equal(r?.status, 503)
    assert.match(String(r?.body.error), /couldn't check your subscription/)
    assert.ok(!('reason' in (r?.body ?? {})), 'a 503 must not claim a billing reason')
  })

  test('no row at all is 503 as well, and says so as our problem', () => {
    const r = accessRefusal(null, NOW)
    assert.equal(r?.status, 503)
    assert.match(String(r?.body.error), /still here to read and download/)
  })

  test('the door reads through auth.db, the CALLER\'s client — never supabaseAdmin', () => {
    // The security property, asserted on the source because the client cannot be built here.
    // Migration 087 left `authenticated`'s SELECT on `companies` intact, so this needs no new
    // service-role use — and it fails CLOSED: a policy mistake returns no row, and no row refuses.
    const src = readFileSync('lib/requireAccess.ts', 'utf8')
    assert.match(src, /await auth\.db\s*\n\s*\.from\('companies'\)/)
    // Comments stripped first — the doc comment above the function NAMES `supabaseAdmin` in
    // order to forbid it, and a guard that cannot tell a prohibition from a use is no guard.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/supabaseAdmin/.test(code), 'requireAccess reached for the service-role client')
  })
})

describe('every paid route applies it, at the same place', () => {
  // The exhaustive list lives in `scripts/check-schema-contracts.js` check 3, which computes the
  // transitive closure and fails the BUILD when a twentieth paid route appears without a gate.
  // That is the test that matters; these two are what a reader of this file needs to see.
  const GATED = [
    'app/api/chat/route.ts', 'app/api/calendar/answer/route.ts', 'app/api/hr/answer/route.ts',
    'app/api/document-scan/route.ts', 'app/api/audit-runs/route.ts', 'app/api/website-read/route.ts',
    'app/api/handbooks/route.ts', 'app/api/document-rescan/route.ts', 'app/api/document-batches/route.ts',
    'app/api/audit-runs/[id]/sections/[sid]/retry/route.ts',
  ]
  for (const f of GATED) {
    test(`${f} calls requireAccess and returns what it gives back`, () => {
      const src = readFileSync(f, 'utf8')
      assert.match(src, /const paused = await requireAccess\(authed\.auth\)/)
      assert.match(src, /if \(paused\) return paused/)
    })
  }

  test('the GETs are NOT gated — reading is free, which is the whole of decision 11', () => {
    for (const f of ['app/api/audit-runs/route.ts', 'app/api/website-read/route.ts']) {
      const src = readFileSync(f, 'utf8')
      const get = src.slice(src.indexOf('export async function GET'))
      assert.ok(!/requireAccess/.test(get), `${f}'s GET is gated — a read-only company cannot read`)
    }
  })

  test('document-batches gates START only — dismiss and finish write no model call', () => {
    const src = readFileSync('app/api/document-batches/route.ts', 'utf8')
    const patch = src.slice(src.indexOf('export async function PATCH'))
    // The gate must come AFTER the action is known, or closing a banner would be refused.
    assert.ok(patch.indexOf("if (action === 'dismiss')") < patch.indexOf('requireAccess'),
      'the gate is above the dismiss branch, so dismissing is refused for a read-only company')
    assert.ok(patch.indexOf("action === 'start'") < patch.indexOf('requireAccess'))
  })
})

/* =================================================================================================
 * A REAL RUN OF ALL FOUR SWEEPS, TWO COMPANIES AT A TIME.
 *
 * One paying, one read-only, in the SAME run. Three things are asserted every time:
 *   · the paying company's work item was claimed — the run began working it;
 *   · the read-only company's row is DEEP-EQUAL to how it went in. Not "no call was made" — the
 *     row itself, because decision 11 says nothing is failed, marked or deleted, and the only way
 *     to prove that is to compare the state;
 *   · exactly one log line, naming the company and the reason.
 *
 * These run offline because `sweep()` now takes its database (step 18) and because
 * `tests/unit/resolveNextServer.mjs` lets Node import a route file at all.
 * ============================================================================================== */

const IDLE = new Date(Date.now() - 48 * 3600_000).toISOString()

function twoCompanies() {
  return [
    { id: 'paying', trial_ends_at: IDLE, subscription_status: 'active', payment_failed_at: null, stripe_customer_id: 'cus_1' },
    { id: 'lapsed', trial_ends_at: IDLE, subscription_status: null, payment_failed_at: null, stripe_customer_id: null },
  ]
}

/** Capture `console.log` so the one-line-per-company rule is checked on the real output. */
async function capturingLogs<T>(fn: () => Promise<T>): Promise<{ value: T; lines: string[] }> {
  const lines: string[] = []
  const real = console.log
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')) }
  try { return { value: await fn(), lines } } finally { console.log = real }
}

describe('jobs/summarise — the topic is left a candidate', () => {
  test('the paying topic is claimed; the read-only topic is untouched, and one line is logged', async () => {
    const { sweep } = await import('../../app/api/jobs/summarise/route.ts')
    const topics = [
      { id: 't-pay', company_id: 'paying', title: 'A', section: 'workspace', summarised_at: null, summary_source: null, last_turn_at: IDLE },
      { id: 't-lap', company_id: 'lapsed', title: 'B', section: 'workspace', summarised_at: null, summary_source: null, last_turn_at: IDLE },
    ]
    const before = JSON.parse(JSON.stringify(topics[1]))
    const db = makeDb({ companies: twoCompanies(), topics, turns: [], job_runs: [] })

    const { value: res, lines } = await capturingLogs(() => sweep(db as never))
    const body = await (res as Response).json()

    // The paying company's topic WAS worked: it was claimed (and the claim released after), which
    // is the step the gate decides. It then stops for want of turns — deliberately, so that a
    // unit test never reaches a model. `considered` counts both; `skipped_read_only` counts one.
    assert.equal(body.considered, 2)
    assert.equal(body.skipped_read_only, 1)
    assert.ok('summary_started_at' in db.tables.topics[0], 'the paying topic was never claimed')

    // *** AND THE READ-ONLY ONE IS THE ROW THAT WENT IN. *** Not a field added, not a status
    // moved, not a claim taken and handed back — `summarised_at` is still null and
    // `last_turn_at` is still set, so it is a candidate again on the very next run.
    assert.deepEqual(db.tables.topics[1], before)

    assert.equal(lines.filter((l) => l.includes('skipped company')).length, 1)
    assert.match(lines.find((l) => l.includes('skipped company'))!,
      /\[jobs\/summarise\] skipped company lapsed: read_only \(trial_over_no_subscription\) — 1 topic left queued/)
  })
})

describe('jobs/scan-documents — the documents stay Queued', () => {
  test('the paying document is claimed; the read-only one is untouched, and the sweep TERMINATES', async () => {
    const { sweep } = await import('../../app/api/jobs/scan-documents/route.ts')
    const docs = [
      { id: 'd-lap', company_id: 'lapsed', name: 'B.pdf', file_url: 'b', file_type: 'application/pdf', entity_id: null, batch_id: null, uploaded_at: '2026-10-01T00:00:00Z', status: 'uploaded', reading_since: null },
      { id: 'd-pay', company_id: 'paying', name: 'A.pdf', file_url: 'a', file_type: 'application/pdf', entity_id: null, batch_id: null, uploaded_at: '2026-10-02T00:00:00Z', status: 'uploaded', reading_since: null },
    ]
    const before = JSON.parse(JSON.stringify(docs[0]))
    const db = makeDb({ companies: twoCompanies(), documents: docs, job_runs: [], document_scans: [], document_batches: [] })

    // *** THE READ-ONLY COMPANY'S DOCUMENT IS THE OLDEST, ON PURPOSE. ***
    // `limit(1)` plus a `continue` would pick it, skip it, leave it `uploaded` and unclaimed, and
    // pick it again — spinning until BUDGET_MS while the paying company starved. If this test
    // ever hangs, that regression is back.
    const { value: res, lines } = await capturingLogs(() => sweep(db as never))
    const body = await (res as Response).json()

    const lap = db.tables.documents.find((d) => d.id === 'd-lap')!
    const pay = db.tables.documents.find((d) => d.id === 'd-pay')!
    assert.deepEqual(lap, before, 'the read-only company\'s document was touched')
    assert.equal(lap.status, 'uploaded', 'it must still read as Queued on the page')
    assert.equal(lap.reading_since, null, 'it was claimed — rule 3 would later "recover" it')
    assert.ok(pay.reading_since !== null || pay.status !== 'uploaded', 'the paying document was never claimed')
    assert.equal(body.companies, 1, 'exactly one company was worked')

    assert.equal(lines.filter((l) => l.includes('skipped company')).length, 1)
    assert.match(lines.find((l) => l.includes('skipped company'))!,
      /\[jobs\/scan-documents\] skipped company lapsed: read_only \(trial_over_no_subscription\) — 1 document left queued/)
  })
})

describe('jobs/audit-sections — the sections stay queued', () => {
  test('the paying run is claimed; the read-only one is untouched, and one line is logged', async () => {
    const { sweep } = await import('../../app/api/jobs/audit-sections/route.ts')
    const runs = [
      { id: 'r-lap', company_id: 'lapsed', created_at: '2026-10-01T00:00:00Z', status: 'queued', scope: null },
      { id: 'r-pay', company_id: 'paying', created_at: '2026-10-02T00:00:00Z', status: 'queued', scope: null },
    ]
    const sections = [
      { id: 's-lap', run_id: 'r-lap', company_id: 'lapsed', ordinal: 0, status: 'queued', claimed_at: null, title: 'B', agency: 'B' },
      { id: 's-pay', run_id: 'r-pay', company_id: 'paying', ordinal: 0, status: 'queued', claimed_at: null, title: 'A', agency: 'A' },
    ]
    const beforeRun = JSON.parse(JSON.stringify(runs[0]))
    const beforeSec = JSON.parse(JSON.stringify(sections[0]))
    const db = makeDb({ companies: twoCompanies(), audit_runs: runs, audit_sections: sections, job_runs: [] })

    const { lines } = await capturingLogs(() => sweep(db as never))

    assert.deepEqual(db.tables.audit_runs.find((r) => r.id === 'r-lap'), beforeRun)
    assert.deepEqual(db.tables.audit_sections.find((s) => s.id === 's-lap'), beforeSec,
      'the read-only company\'s section was touched — decision 11 leaves it queued')
    assert.ok(db.tables.audit_sections.find((s) => s.id === 's-pay')!.claimed_at !== null,
      'the paying company\'s section was never claimed')

    assert.equal(lines.filter((l) => l.includes('skipped company')).length, 1)
    assert.match(lines.find((l) => l.includes('skipped company'))!,
      /\[jobs\/audit-sections\] skipped company lapsed: read_only \(trial_over_no_subscription\) — 1 audit left queued/)
  })
})

describe('jobs/handbook-checks — sweepChecks, which could always take its database', () => {
  test('the paying check is claimed; the read-only one is untouched, and one line is logged', async () => {
    const { sweepChecks } = await import('../../lib/handbookCheck.ts')
    const checks = [
      { id: 'c-lap', company_id: 'lapsed', created_at: '2026-10-01T00:00:00Z', status: 'queued' },
      { id: 'c-pay', company_id: 'paying', created_at: '2026-10-02T00:00:00Z', status: 'queued' },
    ]
    const secs = [
      { id: 'hs-lap', check_id: 'c-lap', company_id: 'lapsed', status: 'queued', claimed_at: null, kind: 'section', section_id: null, attempts: 0 },
      { id: 'hs-pay', check_id: 'c-pay', company_id: 'paying', status: 'queued', claimed_at: null, kind: 'section', section_id: null, attempts: 0 },
    ]
    const beforeCheck = JSON.parse(JSON.stringify(checks[0]))
    const beforeSec = JSON.parse(JSON.stringify(secs[0]))
    const db = makeDb({ companies: twoCompanies(), handbook_checks: checks, handbook_check_sections: secs, job_runs: [] })

    // `ask` is injected — this sweep has always been able to take its model function, which is
    // why it was the one cron with an offline test before step 18.
    const { value: counts, lines } = await capturingLogs(() => sweepChecks(db as never, {
      maxPieces: 1,
      ask: (async () => { throw new Error('no model in a unit test') }) as never,
    }))

    // ONE company was worked, and ONE piece — not two. That is the gate, measured on the run's
    // own counts. (`claimed_at` is deliberately NOT asserted here: this sweep finishes a piece by
    // RELEASING its claim, so the paying row correctly ends on null, same as it started. The
    // evidence that it was worked is the count and the parent row's `done_count`, not the claim.)
    assert.equal(counts.companies, 1)
    assert.equal(counts.pieces, 1)
    assert.ok('done_count' in db.tables.handbook_checks.find((c) => c.id === 'c-pay')!,
      'the paying company\'s check was never worked')

    assert.deepEqual(db.tables.handbook_checks.find((c) => c.id === 'c-lap'), beforeCheck,
      'the read-only company\'s check row was touched')
    assert.deepEqual(db.tables.handbook_check_sections.find((s) => s.id === 'hs-lap'), beforeSec,
      'the read-only company\'s handbook section was touched — decision 11 leaves it queued')

    assert.equal(lines.filter((l) => l.includes('skipped company')).length, 1)
    assert.match(lines.find((l) => l.includes('skipped company'))!,
      /\[jobs\/handbook-checks\] skipped company lapsed: read_only \(trial_over_no_subscription\) — 1 handbook check left queued/)
  })
})
