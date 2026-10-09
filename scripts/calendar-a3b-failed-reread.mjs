/**
 * A3b — DOES A READING THAT COULD NOT READ THE DOCUMENT TAKE ITS DATES OFF THE CALENDAR?
 *
 * The chat's hypothesis, settled against staging. Free: no model is called — the first reading is a
 * stored real-model answer replayed through `saveScan` (`linkLedger: false`), and the second is
 * `failedScan`, which by construction never calls anything.
 *
 * WHY IT MATTERS. A refusal by the reading service is the most ordinary failure this product has: a
 * rate limit, a dropped connection, a format the API would not take. If such a reading withdraws a
 * company's dates, then a bad minute at Anthropic silently takes a real permit expiry off the calendar
 * and out of the monthly email — and the only trace is a `withdrawn` state nobody is looking at. That
 * is precisely the "looks like it worked" failure `docs/HOW-WE-BUILD.md` §3 is about.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/calendar-a3b-failed-reread.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { saveScan, failedScan } from '../lib/documentScan.ts'
import { confirmDate } from '../lib/calendarDates.ts'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const DIR = 'tests/golden/documents/runs/real-model/11-fire-extinguisher-certificate'
const stored = JSON.parse(readFileSync(`${DIR}/${readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().pop()}`, 'utf8'))

const { data: co } = await db.from('companies')
  .insert({ name: `A3b failed re-read ${new Date().toISOString().slice(0, 19)}` }).select('id').single()
const { data: doc } = await db.from('documents').insert({
  company_id: co.id, name: 'fire-extinguisher-certificate.pdf',
  file_url: `${co.id}/f.pdf`, file_type: 'application/pdf',
}).select('id').single()

const show = async (when) => {
  const { data } = await db.from('calendar_events')
    .select('title, due_date, state, counts_as_due').eq('company_id', co.id).order('due_date')
  console.log(`\n  ── ${when} — ${data.length} row(s)`)
  for (const r of data) {
    console.log(`     ${String(r.state).padEnd(14)}${String(r.due_date ?? '—').padEnd(12)}due?=${String(r.counts_as_due).padEnd(6)}${r.title.slice(0, 50)}`)
  }
  return data
}
const scansNow = async () => {
  const { data } = await db.from('document_scans')
    .select('status, is_current, scanned_at').eq('document_id', doc.id).order('scanned_at')
  return data
}

// ---------------------------------------------------------------------------
// Reading 1: the real stored answer. Four dated deadlines reach the calendar.
// ---------------------------------------------------------------------------
const r1 = await saveScan(db, stored.scan, { documentId: doc.id, companyId: co.id, linkLedger: false })
console.log(`\n  reading 1 (a real stored answer): ${JSON.stringify(r1.calendar)}`)
const after1 = await show('after a GOOD reading')

// A person confirms one of them, so the test covers both halves of decision 4.
const { data: one } = await db.from('calendar_events').select('id, title')
  .eq('company_id', co.id).eq('state', 'not_confirmed').limit(1).single()
await confirmDate(db, { companyId: co.id, id: one.id })
console.log(`\n  a person confirms "${one.title.slice(0, 46)}"`)

// ---------------------------------------------------------------------------
// Reading 2: THE READING SERVICE REFUSES. This is `failedScan`, exactly what
// `app/api/document-scan/route.ts:95` and the sweep's `:215` save when a read fails.
// ---------------------------------------------------------------------------
const failed = failedScan(
  'The reading service refused our request to read this document, so nothing was read. That is our end of it, not a problem with the file you sent.',
  'Read it again once we have fixed it — nothing about your file needs changing.')
console.log(`\n  reading 2: a FAILED reading — status "${failed.status}", ${failed.deadlines.length} deadlines`)
const r2 = await saveScan(db, failed, { documentId: doc.id, companyId: co.id, linkLedger: false })
console.log(`  reading 2's calendar step: ${JSON.stringify(r2.calendar)}`)

console.log(`\n  document_scans now:`)
for (const s of await scansNow()) console.log(`     ${String(s.status).padEnd(16)}is_current=${s.is_current}`)

const after2 = await show('after the FAILED reading')

// ---------------------------------------------------------------------------
// The verdict, stated as the product's behaviour and not as a number.
// ---------------------------------------------------------------------------
const withdrawn = after2.filter((r) => r.state === 'withdrawn').length
const stillDue = after2.filter((r) => r.counts_as_due).length
const confirmedKept = after2.find((r) => r.title === one.title)?.state

console.log(`\n  ${'='.repeat(78)}`)
console.log(`  BEFORE the failed reading: ${after1.length} dates, ${after1.filter((r) => r.counts_as_due).length} on the month`)
console.log(`  AFTER  the failed reading: ${after2.length} dates, ${stillDue} on the month, ${withdrawn} withdrawn`)
console.log(`  the date the person CONFIRMED is now: ${confirmedKept}`)
if (withdrawn > 0) {
  console.log(`\n  *** A reading that could not read the document WITHDREW ${withdrawn} real date(s). ***`)
  console.log(`  A rate-limit refusal takes a permit expiry off the calendar and out of the monthly email.`)
} else {
  console.log(`\n  A failed reading withdrew nothing. Every date is where it was.`)
}
console.log(`  ${'='.repeat(78)}`)

// *** IT ASSERTS, so a regression fails loudly instead of printing a paragraph nobody re-reads. ***
// This script was written to SETTLE a hypothesis and it stays as the replay case for the guard it
// produced: `lib/documentScan.ts`'s calendar step skips withdrawal when the reading is
// `could_not_read`. The unit test is `tests/unit/documentScanCalendar.test.ts`; this is the same
// claim against the real database.
const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1 }
console.log('')
if (withdrawn !== 0) fail(`a failed reading withdrew ${withdrawn} date(s); it must withdraw none`)
else pass('a failed re-read leaves every date where it was')
if (stillDue !== after1.filter((r) => r.counts_as_due).length) {
  fail(`the month went from ${after1.filter((r) => r.counts_as_due).length} to ${stillDue} dates`)
} else pass(`the month is unchanged: ${stillDue} date(s) before and after`)
if (confirmedKept !== 'confirmed') fail(`the confirmed date is now ${confirmedKept}`)
else pass('the date a person confirmed is untouched')
if (after2.length !== after1.length) fail(`row count changed ${after1.length} -> ${after2.length}`)
else pass(`no row added or deleted: ${after1.length} -> ${after2.length}`)
if (String(r2.calendar.skipped ?? '').length === 0) fail('the step did not say it had skipped, so a silent skip is indistinguishable from a step that never ran')
else pass(`the step says why it did nothing: "${r2.calendar.skipped}"`)
// ...and the failed reading IS still the current one: this fix must not hide the failure.
const cur = (await scansNow()).filter((x) => x.is_current)
if (cur.length !== 1 || cur[0].status !== 'could_not_read') {
  fail(`the current reading is ${JSON.stringify(cur)}; the failure must still be the document's state`)
} else pass('the failed reading is still the CURRENT reading — the page says "Could not read"')

await db.from('calendar_events').delete().eq('company_id', co.id)
await db.from('companies').delete().eq('id', co.id)
console.log(`\n  cleaned up.`)
