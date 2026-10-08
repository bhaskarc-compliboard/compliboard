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
  const t = (id: string, o: { summarised?: number | null; source?: string | null; last?: number | null }) => ({
    id,
    summarised_at: o.summarised == null ? null : ago(o.summarised),
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

describe('THE QUIET RULE AT ITS EDGES (HR Step 10, decision 13; decision 23)', () => {
  const NOW = Date.parse('2026-10-09T10:00:00Z')
  const at = (ms: number) => new Date(NOW - ms).toISOString()
  const topic = (id: string, last: number, summarised: number | null = null) =>
    ({ id, last_turn_at: at(last), summarised_at: summarised == null ? null : at(summarised), summary_source: summarised == null ? null : 'nightly' })
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
  test('vercel.json holds exactly these six', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons
    assert.deepEqual(crons, [
      { path: '/api/jobs/summarise', schedule: '0 10 * * *' },
      { path: '/api/jobs/delete', schedule: '30 10 * * *' },
      { path: '/api/jobs/scan-documents', schedule: '*/5 * * * *' },
      { path: '/api/jobs/audit-sections', schedule: '*/5 * * * *' },
      { path: '/api/jobs/handbook-queue', schedule: '0 10 * * *' },
      { path: '/api/jobs/handbook-checks', schedule: '*/5 * * * *' },
    ])
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
