/**
 * D1 — WHAT A FAILED RE-READ DOES TO A DOCUMENT'S OPEN QUESTIONS.
 *
 * Fix list item 1, severity 1, root R1 (`docs/FIX-LIST-FAILURES.md`), Job E1. The shape of
 * `scripts/calendar-a3b-failed-reread.mjs`, which proved the same failure on the CALENDAR side —
 * this is the fact-proposal side, which A3 left open because `saveScan`'s only early exit for
 * `could_not_read` was the calendar step's.
 *
 * **Free: no model is called.** The good readings are stored real-model answers replayed through
 * `saveScan` (`linkLedger: false`, as `db:restore` step 9 does it), and a failed reading is
 * `failedScan`, which by construction calls nothing.
 *
 * TWO FAILURES, ONE PER PART:
 *
 *   PART A — a failed re-read withdrew every pending proposal of the document's earlier, good
 *            readings. The questions left Company information and the sidebar badge and were
 *            replaced by nothing, because a failed reading proposes no facts.
 *   PART B — the withdrawal ran BEFORE the insert, so a good reading whose fact insert then failed
 *            left the document with its earlier questions gone and no new ones.
 *
 * *** RUN IT TWICE. *** `--old` asserts nothing and just prints what happened, so the same script
 * can be run against the shipped code (`git stash push lib/documentScan.ts`) to make the failure
 * happen, and then against the fix. Without the flag it asserts and exits non-zero.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/fixlist-d1-proposals.mjs [--old]
 *
 * It works in a throwaway company, deleted at the end and on a crash, so the fixture companies' row
 * counts are untouched (the gate's part 2 compares them).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { saveScan, failedScan } from '../lib/documentScan.ts'

const OLD = process.argv.includes('--old')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

// The Emergency Action Plan — 6 facts, and the document whose two readings produced the
// two-paraphrases-of-one-sentence case the withdrawal was introduced for in the first place.
const DIR = 'tests/golden/documents/runs/real-model/01-eap-chemical'
const stored = JSON.parse(readFileSync(`${DIR}/${readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().pop()}`, 'utf8'))

const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.error(`  ✗ ${m}`); if (!OLD) process.exitCode = 1 }
const note = (m) => console.log(`  · ${m}`)

const { data: co } = await db.from('companies')
  .insert({ name: `D1 proposals ${new Date().toISOString().slice(0, 19)}` }).select('id').single()

async function cleanUp() {
  await db.from('calendar_events').delete().eq('company_id', co.id)
  await db.from('companies').delete().eq('id', co.id)
}
process.on('uncaughtException', async (e) => { console.error(e); await cleanUp(); process.exit(1) })
process.on('unhandledRejection', async (e) => { console.error(e); await cleanUp(); process.exit(1) })

const newDoc = async (name) => (await db.from('documents').insert({
  company_id: co.id, name, file_url: `${co.id}/${name}`, file_type: 'application/pdf',
}).select('id').single()).data

/** Every proposal of a document, by status — the queue's own view of it. */
async function proposals(documentId) {
  const { data, error } = await db.from('fact_proposals')
    .select('id, switch_key, proposed_value, status').eq('document_id', documentId).order('switch_key')
  if (error) throw new Error(`could not read fact_proposals: ${error.message}`)
  const by = {}
  for (const r of data) by[r.status] = (by[r.status] ?? 0) + 1
  return { rows: data, by, pending: data.filter((r) => r.status === 'proposed') }
}
const show = async (documentId, when) => {
  const p = await proposals(documentId)
  console.log(`     ${when.padEnd(34)} ${String(p.rows.length).padStart(2)} row(s): `
    + (Object.entries(p.by).map(([k, v]) => `${k}=${v}`).join(' ') || '(none)'))
  return p
}

console.log(`\n  ${'='.repeat(78)}`)
console.log(`  D1 — ${OLD ? 'THE SHIPPED CODE (no assertions: making the failure happen)' : 'THE FIX'}`)
console.log(`  ${'='.repeat(78)}`)

// ===========================================================================
// PART A — a failed re-read must withdraw nothing
// ===========================================================================
console.log(`\n  PART A — one document, read well, then read again by a service that refused`)
const docA = await newDoc('emergency-action-plan.pdf')
const a1 = await saveScan(db, stored.scan, { documentId: docA.id, companyId: co.id, linkLedger: false })
note(`reading 1 (a real stored answer): ${stored.scan.facts.length} fact(s) proposed`
  + (a1.facts ? `, step says ${JSON.stringify(a1.facts)}` : ', the step reports nothing (old code)'))
const before = await show(docA.id, 'after a GOOD reading')
for (const r of before.pending.slice(0, 3)) {
  console.log(`        · ${String(r.switch_key).padEnd(28)} "${String(r.proposed_value).slice(0, 40)}"`)
}

const failed = failedScan(
  'The reading service refused our request to read this document, so nothing was read. That is our end of it, not a problem with the file you sent.',
  'Read it again once we have fixed it.')
const a2 = await saveScan(db, failed, { documentId: docA.id, companyId: co.id, linkLedger: false })
note(`reading 2: a FAILED reading — status "${failed.status}", ${failed.facts.length} facts`
  + (a2.facts ? `; step says ${JSON.stringify(a2.facts)}` : '; the step reports nothing (old code)'))
const after = await show(docA.id, 'after the FAILED reading')

console.log('')
if (before.pending.length === 0) {
  fail('the good reading left no pending proposal, so this part proves nothing — check the fixture')
} else note(`the document had ${before.pending.length} open question(s) before the failure`)
if (after.pending.length !== before.pending.length) {
  fail(`a failed reading withdrew ${before.pending.length - after.pending.length} of `
    + `${before.pending.length} open question(s) — Company information and the sidebar badge go empty`)
} else pass(`a failed re-read leaves all ${after.pending.length} open question(s) where they were`)
if ((after.by.withdrawn ?? 0) !== 0) {
  fail(`${after.by.withdrawn} proposal(s) are marked withdrawn by a reading that read nothing`)
} else pass('nothing is marked withdrawn by a reading that read nothing')
if (!OLD) {
  if (!String(a2.facts?.skipped ?? '')) {
    fail('the step did not say it had skipped, so a silent skip looks like a step that never ran')
  } else pass(`the step says why it did nothing: "${a2.facts.skipped}"`)
}

// ---- AND THE SHIPPED STATEMENT, VERBATIM, ON A DOCUMENT OF ITS OWN ----
// So that the comparison does not depend on remembering what the old code did. This is the one
// statement `saveScan` used to run unconditionally, copied character for character out of the
// commit before this fix.
console.log(`\n  the one statement the old code ran unconditionally, on a document of its own:`)
console.log(`     db.from('fact_proposals').update({ status: 'withdrawn' })`)
console.log(`       .eq('document_id', documentId).eq('status', 'proposed')`)
const docB = await newDoc('emergency-action-plan-2.pdf')
await saveScan(db, stored.scan, { documentId: docB.id, companyId: co.id, linkLedger: false })
const b1 = await show(docB.id, 'after a GOOD reading')
await db.from('fact_proposals').update({ status: 'withdrawn' })
  .eq('document_id', docB.id).eq('status', 'proposed')
const b2 = await show(docB.id, 'after that one statement')
if (b1.pending.length > 0 && b2.pending.length === 0) {
  pass(`that is the failure: ${b1.pending.length} open question(s) → 0, and a failed reading `
    + `proposes nothing to replace them with`)
} else fail('the statement did not empty the queue, so the comparison above proves nothing')

// ===========================================================================
// PART B — the withdrawal must not happen before the insert
//
// A GOOD second reading whose fact insert fails. `saveScan` throws either way; the question is what
// the document is left holding. The insert is made to fail by wrapping the real client so that one
// statement — `fact_proposals.insert` — returns an error and everything else behaves normally. The
// code under test is `saveScan` itself, unmodified.
// ===========================================================================
console.log(`\n  PART B — a GOOD re-read whose fact insert fails`)
const docC = await newDoc('emergency-action-plan-3.pdf')
await saveScan(db, stored.scan, { documentId: docC.id, companyId: co.id, linkLedger: false })
const c1 = await show(docC.id, 'after a GOOD reading')

const refusedInsert = {
  from: (table) => {
    const b = db.from(table)
    if (table !== 'fact_proposals') return b
    return new Proxy(b, {
      get(target, prop) {
        if (prop === 'insert') {
          return () => ({ then: (ok) => Promise.resolve(
            { data: null, error: { message: 'the write was refused (made to fail on purpose)' } }).then(ok) })
        }
        const v = target[prop]
        return typeof v === 'function' ? v.bind(target) : v
      },
    })
  },
}
let threw = null
try {
  // A second reading of the same document, proposing slightly different wording — the ordinary
  // "Read it again" case, not a failure of the reading.
  const second = { ...stored.scan, facts: stored.scan.facts.map((f) => ({ ...f, value: `${f.value} (re-read)` })) }
  await saveScan(refusedInsert, second, { documentId: docC.id, companyId: co.id, linkLedger: false })
} catch (e) { threw = e }
note(`the second reading's save ${threw ? `threw: ${threw.message}` : 'did NOT throw, which it should have'}`)
const c2 = await show(docC.id, 'after the refused insert')

console.log('')
if (!threw) fail('the insert was not actually refused, so this part proves nothing')
if (c2.pending.length !== c1.pending.length) {
  fail(`the document is left with ${c2.pending.length} open question(s) instead of ${c1.pending.length}: `
    + 'the earlier ones were withdrawn and the new ones never arrived')
} else pass(`the earlier ${c1.pending.length} open question(s) stand: nothing was withdrawn for rows `
  + 'that never got written')

// ===========================================================================
// PART C — AND AN ORDINARY GOOD RE-READ STILL REPLACES THEM.
//
// §9a: a check that reports an absence has to be shown seeing a presence first. The withdrawal
// exists because one document read twice proposed "Yes, kept in the front office" and "Yes — an AED
// kept in the front office" for one key, and `lib/confirmationQueue.ts` then asked a person to
// arbitrate between two paraphrases of one sentence. A fix that stopped withdrawing anything would
// bring that back.
// ===========================================================================
console.log(`\n  PART C — an ordinary GOOD re-read, which must still replace the earlier questions`)
const docD = await newDoc('emergency-action-plan-4.pdf')
await saveScan(db, stored.scan, { documentId: docD.id, companyId: co.id, linkLedger: false })
const d1 = await show(docD.id, 'after a GOOD reading')
const reworded = { ...stored.scan, facts: stored.scan.facts.map((f) => ({ ...f, value: `${f.value} (re-read)` })) }
const dr = await saveScan(db, reworded, { documentId: docD.id, companyId: co.id, linkLedger: false })
note(`the second GOOD reading's step: ${dr.facts ? JSON.stringify(dr.facts) : '(old code reports nothing)'}`)
const d2 = await show(docD.id, 'after a GOOD re-read')

console.log('')
if (d2.pending.length !== reworded.facts.length) {
  fail(`${d2.pending.length} open question(s) after a good re-read; it should be the `
    + `${reworded.facts.length} the new reading proposed`)
} else pass(`a good re-read leaves its own ${d2.pending.length} question(s) open and no others`)
if ((d2.by.withdrawn ?? 0) !== d1.pending.length) {
  fail(`${d2.by.withdrawn ?? 0} withdrawn; the ${d1.pending.length} from the earlier reading should be`)
} else pass(`the earlier reading's ${d2.by.withdrawn} question(s) are withdrawn, not deleted — the `
  + 'drawer still shows them')
if (d2.pending.some((r) => !String(r.proposed_value).includes('(re-read)'))) {
  fail('an open question is still from the earlier reading — the two paraphrases are both pending again')
} else pass('every open question is the new reading\'s own wording')

console.log(`\n  ${'='.repeat(78)}`)
await cleanUp()
console.log(`  cleaned up.`)
