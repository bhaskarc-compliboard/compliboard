/**
 * ONE SUMMARY AND ONE CHECKLIST AT A TIME — `lib/topicClaim.ts`, Workspace Stage 4, migration 065.
 *
 * The claim, the conditional save and the nightly job's choice, each run here without a database. The
 * live proof (a double press, a killed browser, a held claim the job skips) is on staging, in the
 * Stage 4 report; these keep the rules from drifting.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CLAIM_LOCK_MS, CLAIM_WORK_MS, CLAIM_COLUMN, CLAIM_WORDS, isClaimHeld, claimFilter, guardSummaryWrite,
  withinClaimTime, ClaimTimeout, nightlyCandidates, IDLE_HOURS,
} from '../../lib/topicClaim.ts'
import { HOWTO_LOCK_MS } from '../../lib/checklistView.ts'

const NOW = Date.parse('2026-10-04T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const MIN = 60_000, HOUR = 3600_000

describe('the claim', () => {
  test('held while younger than ten minutes, and not after', () => {
    assert.equal(isClaimHeld(ago(0), NOW), true)
    assert.equal(isClaimHeld(ago(9 * MIN), NOW), true)
    assert.equal(isClaimHeld(ago(CLAIM_LOCK_MS - 1), NOW), true)
    assert.equal(isClaimHeld(ago(CLAIM_LOCK_MS), NOW), false)
    assert.equal(isClaimHeld(ago(11 * MIN), NOW), false)   // A6 d: an 11-minute claim is a dead run
    assert.equal(isClaimHeld(null, NOW), false)
    assert.equal(isClaimHeld('not a date', NOW), false)
  })

  test('the compare-and-set takes an empty claim or one older than the lock, nothing else', () => {
    assert.equal(claimFilter('summary', NOW),
      `summary_started_at.is.null,summary_started_at.lt."${ago(CLAIM_LOCK_MS)}"`)
    assert.equal(claimFilter('checklist', NOW),
      `checklist_started_at.is.null,checklist_started_at.lt."${ago(CLAIM_LOCK_MS)}"`)
  })

  test('the route gives up before its own lock could be taken as stale', () => {
    assert.ok(CLAIM_WORK_MS < CLAIM_LOCK_MS)
  })

  test('one lock window everywhere: the claim, "How do I do this?" and the view in migration 065', () => {
    assert.equal(CLAIM_LOCK_MS, HOWTO_LOCK_MS)
    const sql = readFileSync('supabase/migrations/065_one_summary_one_checklist_at_a_time.sql', 'utf8')
    assert.equal((sql.match(/> now\(\) - interval '10 minutes'/g) ?? []).length, 2)
    assert.equal(CLAIM_COLUMN.summary, 'summary_started_at')
    assert.equal(CLAIM_COLUMN.checklist, 'checklist_started_at')
  })

  test('the words the row, the drawer and a 409 use', () => {
    assert.equal(CLAIM_WORDS.summary, 'Summary being written…')
    assert.equal(CLAIM_WORDS.checklist, 'Checklist being built…')
  })

  test('a run that passes its time is given up, and one that finishes is not', async () => {
    await assert.rejects(withinClaimTime(new Promise(() => {}), 'summary', 20), ClaimTimeout)
    assert.equal(await withinClaimTime(Promise.resolve('done'), 'summary', 1000), 'done')
  })
})

describe('the conditional save', () => {
  // A stand-in for the PostgREST filter chain: it records the filters the guard adds.
  const chain = () => {
    const calls: Array<[string, string, unknown]> = []
    const q = {
      calls,
      eq(col: string, v: unknown) { calls.push(['eq', col, v]); return q },
      is(col: string, v: null) { calls.push(['is', col, v]); return q },
    }
    return q
  }

  test('writes only while this run holds the claim AND the summary is the one it read', () => {
    const q = guardSummaryWrite(chain(), { claimedAt: '2026-10-04T11:59:00.000Z', summarisedAt: '2026-10-01T09:00:00+00:00' })
    assert.deepEqual(q.calls, [
      ['eq', 'summary_started_at', '2026-10-04T11:59:00.000Z'],
      ['eq', 'summarised_at', '2026-10-01T09:00:00+00:00'],
    ])
  })

  test('a conversation never summarised is matched with IS NULL, not = NULL (which matches nothing)', () => {
    const q = guardSummaryWrite(chain(), { claimedAt: '2026-10-04T11:59:00.000Z', summarisedAt: null })
    assert.deepEqual(q.calls, [
      ['eq', 'summary_started_at', '2026-10-04T11:59:00.000Z'],
      ['is', 'summarised_at', null],
    ])
  })

  test('the writer uses the guard, clears the claim in the same update, and reports a skip', () => {
    const src = readFileSync('lib/summaryReport.ts', 'utf8')
    assert.match(src, /guardSummaryWrite\(db\.from\('topics'\)\.update\(\{/)
    assert.match(src, /\[CLAIM_COLUMN\.summary\]: null,/)
    assert.match(src, /if \(!written\?\.length\) \{\s*return \{ ok: false, skipped: true,/)
    // a duplicate pending proposal (migration 065's index) is not an error
    assert.match(src, /iErr\.code !== '23505'/)
  })
})

describe('the routes claim before any model call, and work after the reply', () => {
  const cases: Array<[string, RegExp]> = [
    ['app/api/topics/[id]/summarise/route.ts', /summariseTopic\(/],
    ['app/api/checklists/from-topic/route.ts', /buildChecklist\(\{/],
  ]
  for (const [file, work] of cases) {
    test(file, () => {
      const src = readFileSync(file, 'utf8')
      const post = src.slice(src.indexOf('export async function POST'))
      const claim = post.indexOf('await claimTopic(')
      assert.ok(claim > 0, 'no claim')
      assert.ok(post.indexOf('after(async') > claim, 'the work is not after the claim')
      assert.ok(post.search(work) > post.indexOf('after(async'), 'the work is not inside after()')
      assert.match(post, /\{ status: 'started' \}, \{ status: 202 \}/)
      assert.match(post, /\{ status: 409 \}/)
      assert.match(post, /releaseTopic\(/)
    })
  }
  test('"How do I do this?" researches after the reply too', () => {
    const src = readFileSync('app/api/checklist-items/[id]/how-to/route.ts', 'utf8')
    assert.ok(src.indexOf('after(async') > src.indexOf("howto_started_at: new Date().toISOString()"))
    assert.match(src, /\{ status: 'researching' \}, \{ status: 202 \}/)
  })
})

describe('the nightly job\'s choice', () => {
  // `covers` is W2's (migration 078): how far the summary READ. Its default is whichever is earlier
  // of the last turn and the moment the summary was written — which is what every real row looks
  // like, and which `ago(Math.max(...))` expresses, since a bigger "ago" is an older time.
  const t = (id: string, o: { summarised?: number | null; source?: string | null; last?: number | null
                              covers?: number | null }) => ({
    id,
    summarised_at: o.summarised == null ? null : ago(o.summarised),
    summary_covers_through: o.covers !== undefined ? (o.covers === null ? null : ago(o.covers))
      : o.summarised == null || o.last == null ? null : ago(Math.max(o.summarised, o.last)),
    summary_source: o.source ?? null,
    last_turn_at: o.last == null ? null : ago(o.last),
  })
  const rows = [
    t('never-quiet',      { last: 25 * HOUR }),                                     // candidate
    t('never-recent',     { last: 2 * HOUR }),                                      // not yet: not quiet
    t('spoken-recent',    { summarised: 3 * 24 * HOUR, source: 'nightly', last: 2 * HOUR }),   // the old bug: no quiet rule
    t('spoken-quiet',     { summarised: 3 * 24 * HOUR, source: 'nightly', last: 30 * HOUR }),  // candidate
    t('user-current',     { summarised: 1 * HOUR, source: 'user', last: 2 * HOUR }),           // left alone, counted
    t('user-new-turns',   { summarised: 3 * 24 * HOUR, source: 'user', last: 30 * HOUR }),     // candidate: spoken since
    t('nightly-current',  { summarised: 1 * HOUR, source: 'nightly', last: 30 * HOUR }),       // left alone, not counted
    t('never-spoken',     { last: null }),                                          // nothing to summarise
  ]
  const { candidates, userCurrent } = nightlyCandidates(rows, NOW)

  test('both lists wait for the quiet rule: 6 hours since HR Step 10 (decision 13; was 24)', () => {
    assert.equal(IDLE_HOURS, 6)
    assert.deepEqual(candidates.map((c) => c.id), ['never-quiet', 'spoken-quiet', 'user-new-turns'])
  })
  test('skipped_user_summary counts a person\'s summary with nothing said since — and only that', () => {
    assert.deepEqual(userCurrent.map((c) => c.id), ['user-current'])
  })
  test('the job reads its choice from this function and records skips with a reason', () => {
    const src = readFileSync('app/api/jobs/summarise/route.ts', 'utf8')
    assert.match(src, /nightlyCandidates\(/)
    assert.match(src, /skipped_user_summary: skippedUserSummary/)
    assert.match(src, /reason: 'a summary is being written for it right now \(claim held\)'/)
    assert.match(src, /guard: \{ claimedAt, summarisedAt: topic\.summarised_at \}/)
  })
})

// =================================================================================================
// W2 (fix list, severity 1, migration 078) — "SPOKEN SINCE" IS MEASURED AGAINST HOW FAR THE SUMMARY
// READ, NOT AGAINST WHEN IT WAS WRITTEN.
//
// A message sent while a summary was being written is newer than the turns the model saw and OLDER
// than `summarised_at`. The old test called that "covered", so this job left the conversation alone
// FOR GOOD — and the 12-month deleter then had a summary that passed its own test and did not
// contain those turns (`lib/retention.ts`, and `tests/unit/retention.test.ts` has the deletion half).
// =================================================================================================
describe('*** W2: a turn sent while the summary was being written ***', () => {
  const t = (o: { summarised: number; covers: number; last: number }) => ({
    id: 'raced', summarised_at: ago(o.summarised), summary_covers_through: ago(o.covers),
    summary_source: 'user', last_turn_at: ago(o.last),
  })
  /** `lib/topicClaim.ts` as it shipped: measured against `summarised_at`. */
  const oldSpokenSince = (row: { summarised_at: string | null; last_turn_at: string }) =>
    row.summarised_at !== null && Date.parse(row.last_turn_at) > Date.parse(row.summarised_at)

  // Quiet for 30 hours. The turns were loaded, the person spoke 3 minutes later, the summary landed
  // 2 minutes after that — so `summarised_at` is NEWER than the last turn and the coverage is older.
  const raced = t({ summarised: 30 * HOUR, covers: 30 * HOUR + 5 * 60_000, last: 30 * HOUR + 3 * 60_000 })

  test('the OLD rule called it covered, so this job never summarised it again', () => {
    assert.equal(oldSpokenSince(raced), false, 'this is the shipped behaviour')
  })

  test('*** the new rule sees the gap and summarises it tonight ***', () => {
    assert.deepEqual(nightlyCandidates([raced], NOW).candidates.map((c) => c.id), ['raced'])
  })

  test('a coverage we do not have counts as spoken-since, so it is summarised and becomes known', () => {
    const unknown = { ...raced, summary_covers_through: null }
    assert.deepEqual(nightlyCandidates([unknown], NOW).candidates.map((c) => c.id), ['raced'])
  })

  test('and a summary that DID cover the last turn is still left alone — or this is a cost regression', () => {
    const clean = t({ summarised: 30 * HOUR, covers: 30 * HOUR + 3 * 60_000, last: 30 * HOUR + 3 * 60_000 })
    const r = nightlyCandidates([clean], NOW)
    assert.deepEqual(r.candidates.map((c) => c.id), [])
    assert.deepEqual(r.userCurrent.map((c) => c.id), ['raced'], 'counted as a person\'s current summary')
  })
})

describe('THE QUIET RULE AT ITS EDGES (HR Step 10, decision 13; decision 23)', () => {
  const NOW = Date.parse('2026-10-09T10:00:00Z')
  const at = (ms: number) => new Date(NOW - ms).toISOString()
  const topic = (id: string, last: number, summarised: number | null = null) =>
    ({ id, last_turn_at: at(last), summarised_at: summarised == null ? null : at(summarised),
       summary_covers_through: summarised == null ? null : at(Math.max(summarised, last)),
       summary_source: summarised == null ? null : 'nightly' })
  test('5 hours 59 minutes quiet: not yet. Exactly 6 hours: yes', () => {
    const r = nightlyCandidates([topic('a', 5 * 3600_000 + 59 * 60_000), topic('b', 6 * 3600_000)], NOW)
    assert.deepEqual(r.candidates.map((c) => c.id), ['b'])
  })
  test('DECISION 23: a conversation picked up again after its summary is summarised again that night, once quiet for 6 hours', () => {
    const r = nightlyCandidates([topic('resumed', 7 * 3600_000, 30 * 3600_000), topic('resumed-recent', 2 * 3600_000, 30 * 3600_000)], NOW)
    assert.deepEqual(r.candidates.map((c) => c.id), ['resumed'])
  })
})

describe('THE CRON SCHEDULE (HR Step 10): every entry pinned', () => {
  test('vercel.json holds exactly these seven', () => {
    // *** SIX UNTIL 9 OCTOBER 2026; SEVEN SINCE (Calendar A5, decision 11). ***
    // This list is deliberately exhaustive, so a job cannot be added to production without somebody
    // writing it down here — which is this test doing its job: adding the monthly email turned it
    // red, and raising it is the deliberate act the pin exists to force.
    //
    // `0 15 1 * *` is the 1st of each month at 15:00 UTC — 8am Pacific in summer, 7am in winter.
    // Vercel Cron is UTC only, so one of the two is accepted; the owner chose the morning.
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons
    assert.deepEqual(crons, [
      { path: '/api/jobs/summarise', schedule: '0 10 * * *' },
      { path: '/api/jobs/delete', schedule: '30 10 * * *' },
      { path: '/api/jobs/scan-documents', schedule: '*/5 * * * *' },
      { path: '/api/jobs/audit-sections', schedule: '*/5 * * * *' },
      { path: '/api/jobs/handbook-queue', schedule: '0 10 * * *' },
      { path: '/api/jobs/handbook-checks', schedule: '*/5 * * * *' },
      { path: '/api/jobs/calendar-month', schedule: '0 15 1 * *' },
    ])
  })

  test('the calendar job: the cron secret first, and a 404 without it', () => {
    // The same shape the two HR jobs are held to below: the guard before the service-role client, so
    // an anonymous caller never reaches a read, and every refusal is a 404 rather than a 401.
    const src = readFileSync('app/api/jobs/calendar-month/route.ts', 'utf8')
    for (const m of ['export async function GET', 'export async function POST']) {
      const fn = src.slice(src.indexOf(m))
      assert.ok(fn.indexOf('requireCronSecret(request)') > 0, m)
      assert.ok(fn.indexOf('requireCronSecret(request)') < fn.indexOf('run('), m)
    }
  })
  test('both HR jobs: the cron secret first (a 404 without it), no preview switch since the go-live', () => {
    for (const f of ['app/api/jobs/handbook-queue/route.ts', 'app/api/jobs/handbook-checks/route.ts']) {
      const src = readFileSync(f, 'utf8')
      assert.ok(!/hrPreview|HR_PREVIEW/.test(src), f)
      const post = src.slice(src.indexOf('export async function POST'))
      assert.ok(post.indexOf('requireCronSecret(request)') > 0 && post.indexOf('requireCronSecret(request)') < post.indexOf('supabaseAdmin'), f)
    }
  })
})
