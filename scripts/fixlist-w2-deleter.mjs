/**
 * W2, END TO END — THE 12-MONTH DELETER, THROUGH THE REAL CRON ROUTE, AGAINST REAL STAGING.
 *
 * Fix list item 52, severity 1 (`docs/FIX-LIST-FAILURES.md`), migration 078, Job E1. The unit tests
 * (`tests/unit/retention.test.ts`) carry the shipped rule copied line for line and show it clearing a
 * conversation whose summary stops before its last turn. This is the same thing through the job a
 * cron actually calls, on the database it actually runs against.
 *
 * **Free: no model is called.** The deleter calls none.
 *
 * TWO CONVERSATIONS, BOTH THIRTEEN MONTHS OLD, BOTH SUMMARISED:
 *
 *   covered — the summary read as far as the last turn. Its turns MUST be cleared: that is the
 *             product's own promise, and a fix that stopped clearing anything would be no fix.
 *   raced   — the turns were loaded at 10:00, the person spoke again at 10:03, the summary landed at
 *             10:05. `summarised_at` is NEWER than the last turn, so the shipped rule said "covered"
 *             and **deleted a turn no summary contains**. Its turns MUST survive, and the job must
 *             say which conversation it left and why.
 *
 * Both live in a throwaway company, deleted at the end and on a crash.
 *
 * *** IT CHECKS FIRST THAT NO REAL STAGING CONVERSATION IS DUE. *** One topic on staging is past the
 * line and holds **0 turns**, so the job has nothing of anybody's to take. If that ever changes this
 * script stops rather than running a destructive job over real fixtures to make a point.
 *
 *   BASE=http://localhost:3998 node --experimental-strip-types --env-file=.env.local \
 *     scripts/fixlist-w2-deleter.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { clearingDecision, clearsAt } from '../lib/retention.ts'

const BASE = process.env.BASE ?? 'http://localhost:3998'
const SECRET = process.env.CRON_SECRET
if (!SECRET) { console.error('CRON_SECRET is not set; the job would refuse.'); process.exit(1) }

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1 }
const note = (m) => console.log(`  · ${m}`)

// ---- FIRST: is anything of anybody's actually at risk? ----
const { data: real, error: realErr } = await db.from('topics')
  .select('id, last_turn_at, summarised_at, summary_covers_through, summary')
  .not('last_turn_at', 'is', null)
  .lt('last_turn_at', new Date(Date.now() - 370 * 86400000).toISOString())
if (realErr) { console.error(`could not read the topics: ${realErr.message}`); process.exit(1) }

let atRisk = 0
for (const t of real) {
  const { count } = await db.from('turns').select('*', { count: 'exact', head: true }).eq('topic_id', t.id)
  if ((count ?? 0) > 0) atRisk++
}
console.log(`\n  ${real.length} staging conversation(s) past the 12-month line; ${atRisk} of them still hold turns.`)
if (atRisk > 0) {
  console.error('  STOPPING: a real staging conversation would lose its turns to this run. A gate '
    + 'must not have that side effect. Build the fixtures on a copy instead.')
  process.exit(1)
}
pass('nothing of anybody\'s is at risk, so the job can be run for real')

// ---- THE TWO FIXTURES ----
const { data: co } = await db.from('companies')
  .insert({ name: `W2 deleter ${new Date().toISOString().slice(0, 19)}` }).select('id').single()
async function cleanUp() { await db.from('companies').delete().eq('id', co.id) }
process.on('uncaughtException', async (e) => { console.error(e); await cleanUp(); process.exit(1) })
process.on('unhandledRejection', async (e) => { console.error(e); await cleanUp(); process.exit(1) })

/** Thirteen months ago, to the minute. */
const back = (minutes) => {
  const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 13); d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return d.toISOString()
}
const LOADED = back(0)     // the turns the summariser read
const SPOKE = back(3)      // the message sent while it was writing
const WROTE = back(5)      // when the summary landed

async function makeTopic(title, { lastTurn, summarisedAt, covers }) {
  const { data: t, error } = await db.from('topics').insert({
    company_id: co.id, title, summary: 'A summary of this conversation.',
    summarised_at: summarisedAt, summary_covers_through: covers,
    summary_source: 'user', last_turn_at: lastTurn, section: 'workspace',
  }).select('id').single()
  if (error) throw new Error(`topics: ${error.message}`)
  const { error: tErr } = await db.from('turns').insert([
    { topic_id: t.id, company_id: co.id, position: 1, role: 'user', text: 'What do we need for the permit?', created_at: LOADED },
    { topic_id: t.id, company_id: co.id, position: 2, role: 'assistant', text: 'Three things.', created_at: LOADED },
    { topic_id: t.id, company_id: co.id, position: 3, role: 'user', text: 'And the second plant?', created_at: lastTurn },
  ])
  if (tErr) throw new Error(`turns: ${tErr.message}`)
  return t.id
}

const covered = await makeTopic('W2 covered', { lastTurn: SPOKE, summarisedAt: WROTE, covers: SPOKE })
const raced = await makeTopic('W2 raced', { lastTurn: SPOKE, summarisedAt: WROTE, covers: LOADED })

const turnsOf = async (id) =>
  (await db.from('turns').select('*', { count: 'exact', head: true }).eq('topic_id', id)).count ?? 0

console.log(`\n  two conversations, both thirteen months old, both summarised:`)
console.log(`     covered  last turn ${SPOKE.slice(0, 16)}  summary ${WROTE.slice(0, 16)}  covers ${SPOKE.slice(0, 16)}  ${await turnsOf(covered)} turns`)
console.log(`     raced    last turn ${SPOKE.slice(0, 16)}  summary ${WROTE.slice(0, 16)}  covers ${LOADED.slice(0, 16)}  ${await turnsOf(raced)} turns`)
console.log(`     the line for both fell on ${clearsAt(SPOKE).toISOString().slice(0, 10)}`)

// ---- THE TWO RULES, BOTH COMPUTED FROM THE SAME REAL ROWS ----
// The decision is a pure function, so the shipped rule and the fixed one can be read side by side
// off the database without reverting the code — the same method `scripts/calendar-a3b-failed-reread.mjs`
// used for the audit block. `oldDecision` is `lib/retention.ts` as it shipped.
function oldDecision(t, now = new Date()) {
  const due = clearsAt(t.last_turn_at)
  if (!due || due.getTime() > now.getTime()) return 'keep'
  const hasSummary = Boolean(String(t.summary ?? '').trim()) && Boolean(t.summarised_at)
  if (!hasSummary) return 'skip_no_summary'
  if (new Date(t.summarised_at).getTime() < new Date(t.last_turn_at).getTime()) return 'skip_no_summary'
  return 'clear'
}
const { data: both } = await db.from('topics')
  .select('id, title, last_turn_at, summarised_at, summary_covers_through, summary')
  .eq('company_id', co.id).order('title')
console.log(`\n  the deleter's decision, read off those rows, under both rules:`)
for (const t of both) {
  console.log(`     ${t.title.padEnd(12)} old: ${oldDecision(t).padEnd(18)} now: ${clearingDecision(t)}`)
}
const racedRow = both.find((t) => t.title === 'W2 raced')
if (oldDecision(racedRow) !== 'clear') {
  fail('the old rule did not clear the raced conversation, so this comparison proves nothing')
} else pass('the OLD rule cleared the raced conversation — its three turns, one of them never summarised')

// ---- THE JOB, FOR REAL, THROUGH THE ROUTE A CRON CALLS ----
const res = await fetch(`${BASE}/api/jobs/delete`, {
  method: 'POST', headers: { 'x-cron-secret': SECRET },
})
const json = await res.json().catch(() => null)
console.log(`\n  POST ${BASE}/api/jobs/delete → ${res.status}`)
// The route spreads its counts at the top level (`{ job, run, ...counts, errors }`), so that is
// where they are read from — the first version of this script looked under `json.counts` and found
// nothing, which is how a check that cannot see a presence looks exactly like a check that found
// nothing (§9a). It printed the whole answer, which is how it was caught.
console.log(`  ${JSON.stringify(json)}`)

const left = { covered: await turnsOf(covered), raced: await turnsOf(raced) }
console.log(`\n  turns left: covered=${left.covered}  raced=${left.raced}`)

console.log('')
if (res.status !== 200) fail(`the job answered ${res.status}`)
else pass('the job ran and answered 200')
if (left.covered !== 0) {
  fail(`the covered conversation kept ${left.covered} turn(s) — the product's own promise is that a `
    + 'conversation whose summary covers it IS cleared; a fix that cleared nothing would be no fix')
} else pass('the COVERED conversation was cleared, as it should be')
if (left.raced !== 3) {
  fail(`the raced conversation lost ${3 - left.raced} turn(s) — turns no summary contains`)
} else pass('the RACED conversation kept all 3 turns: the summary stops before the last one')
const skippedNotCovered = json?.skipped_not_covered ?? []
if (!skippedNotCovered.includes(raced)) {
  fail(`the job did not record why it left it (skipped_not_covered = ${JSON.stringify(skippedNotCovered)})`)
} else pass('and the job SAYS which conversation it left, under skipped_not_covered')
const byTopic = (json?.by_topic ?? []).map((r) => r.topic)
if (!byTopic.includes(covered)) fail('the cleared conversation is not in by_topic')
else pass('the cleared one is named in by_topic with its count')

// ---- AND THE job_runs ROW, READ FROM THE DATABASE RATHER THAN THE RESPONSE ----
const { data: runRow } = await db.from('job_runs')
  .select('job, finished_at, counts').eq('job', 'delete').order('started_at', { ascending: false }).limit(1).maybeSingle()
console.log(`\n  job_runs' newest delete row: finished_at=${runRow?.finished_at ? 'set' : 'NOT SET'} `
  + `turns_deleted=${runRow?.counts?.turns_deleted} skipped_not_covered=${JSON.stringify(runRow?.counts?.skipped_not_covered ?? [])}`)
if (!runRow?.finished_at) fail('the job wrote no finished_at — gate part 5 wants the row')
else pass('the job wrote its job_runs row, with the same counts')

await cleanUp()
console.log(`\n  cleaned up.`)
