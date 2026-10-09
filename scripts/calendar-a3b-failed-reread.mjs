/**
 * A3b/A3c — WHAT A READING THAT COULD NOT READ THE DOCUMENT DOES TO ITS DATES.
 *
 * Two hypotheses from the chat, both settled here against staging. Free: no model is called — the
 * good readings are stored real-model answers replayed through `saveScan` (`linkLedger: false`, as
 * `db:restore` step 9 does it), and a failed reading is `failedScan`, which by construction calls
 * nothing.
 *
 *   A3b — THE CALENDAR SIDE. Does a failed re-read withdraw a company's dates?
 *         It did: 3 of 4, proved here before the guard existed. A rate-limit refusal took a permit's
 *         expiry off the calendar and out of the monthly email. Fixed in `lib/documentScan.ts`'s
 *         calendar step, which now returns early on a `could_not_read` reading.
 *
 *   A3c — THE DOCUMENTS SIDE. Does the report's date list go empty, and does the row lose its
 *         significant date? The first was true and was migration 074's doing; migration 075 fixes it.
 *         The second was ALSO true but was NOT 074's — see the correction near the end, which an
 *         earlier version of this script got wrong.
 *
 * It asserts and exits non-zero, so a regression fails loudly rather than printing a paragraph nobody
 * re-reads. It works in a throwaway company, deleted at the end, so the fixture companies' row counts
 * are untouched (A7 part 2 compares them).
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

const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1 }

const { data: co } = await db.from('companies')
  .insert({ name: `A3b failed re-read ${new Date().toISOString().slice(0, 19)}` }).select('id').single()
const { data: doc } = await db.from('documents').insert({
  company_id: co.id, name: 'fire-extinguisher-certificate.pdf',
  file_url: `${co.id}/f.pdf`, file_type: 'application/pdf',
}).select('id').single()

const show = async (when) => {
  const { data } = await db.from('calendar_events')
    .select('title, due_date, state, counts_as_due').eq('company_id', co.id).order('due_date')
  console.log(`\n  -- ${when} -- ${data.length} row(s)`)
  for (const r of data) {
    console.log(`     ${String(r.state).padEnd(14)}${String(r.due_date ?? '-').padEnd(12)}`
      + `due?=${String(r.counts_as_due).padEnd(6)}${r.title.slice(0, 50)}`)
  }
  return data
}
const scansNow = async () => {
  const { data } = await db.from('document_scans')
    .select('status, is_current, scanned_at').eq('document_id', doc.id).order('scanned_at')
  return data
}

// ===========================================================================
// A3b — THE CALENDAR SIDE
// ===========================================================================
const r1 = await saveScan(db, stored.scan, { documentId: doc.id, companyId: co.id, linkLedger: false })
console.log(`\n  reading 1 (a real stored answer): ${JSON.stringify(r1.calendar)}`)
const after1 = await show('after a GOOD reading')

const { data: one } = await db.from('calendar_events').select('id, title')
  .eq('company_id', co.id).eq('state', 'not_confirmed').limit(1).single()
await confirmDate(db, { companyId: co.id, id: one.id })
console.log(`\n  a person confirms "${one.title.slice(0, 46)}"`)

const failed = failedScan(
  'The reading service refused our request to read this document, so nothing was read. That is our end of it, not a problem with the file you sent.',
  'Read it again once we have fixed it.')
console.log(`\n  reading 2: a FAILED reading - status "${failed.status}", ${failed.deadlines.length} deadlines`)
const r2 = await saveScan(db, failed, { documentId: doc.id, companyId: co.id, linkLedger: false })
console.log(`  reading 2's calendar step: ${JSON.stringify(r2.calendar)}`)

console.log(`\n  document_scans now:`)
for (const s of await scansNow()) console.log(`     ${String(s.status).padEnd(16)}is_current=${s.is_current}`)

const after2 = await show('after the FAILED reading')
const withdrawn = after2.filter((r) => r.state === 'withdrawn').length
const dueBefore = after1.filter((r) => r.counts_as_due).length
const dueAfter = after2.filter((r) => r.counts_as_due).length
const confirmedKept = after2.find((r) => r.title === one.title)?.state

console.log(`\n  ${'='.repeat(78)}`)
console.log(`  A3b - THE CALENDAR SIDE`)
console.log(`  before the failed reading: ${after1.length} dates, ${dueBefore} on the month`)
console.log(`  after  the failed reading: ${after2.length} dates, ${dueAfter} on the month, ${withdrawn} withdrawn`)
console.log('')
if (withdrawn !== 0) fail(`a failed reading withdrew ${withdrawn} date(s); it must withdraw none`)
else pass('a failed re-read leaves every date where it was')
if (dueAfter !== dueBefore) fail(`the month went from ${dueBefore} to ${dueAfter} dates`)
else pass(`the month is unchanged: ${dueAfter} date(s) before and after`)
if (confirmedKept !== 'confirmed') fail(`the confirmed date is now ${confirmedKept}`)
else pass('the date a person confirmed is untouched')
if (after2.length !== after1.length) fail(`row count changed ${after1.length} -> ${after2.length}`)
else pass(`no row added or deleted: ${after1.length} -> ${after2.length}`)
if (!String(r2.calendar.skipped ?? '')) fail('the step did not say it had skipped, so a silent skip looks like a step that never ran')
else pass(`the step says why it did nothing: "${r2.calendar.skipped}"`)
const cur = (await scansNow()).filter((x) => x.is_current)
if (cur.length !== 1 || cur[0].status !== 'could_not_read') {
  fail(`the current reading is ${JSON.stringify(cur)}; the failure must still be the document's state`)
} else pass('the failed reading is still the CURRENT reading - the page says "Could not read"')

// ===========================================================================
// A3c — THE DOCUMENTS SIDE
//
// Migration 074 moved the report's date list and `document_index_v`'s significant date onto
// `document_dates_current_v`. The fire-extinguisher fixture cannot show the significant-date half:
// every one of its deadlines RECURS, and 049's rule reads the expiry from a NON-RECURRING dated
// deadline. So a second document with a real expiry is what tells the two apart.
// ===========================================================================
console.log(`\n  ${'='.repeat(78)}`)
console.log(`  A3c - THE DOCUMENTS SIDE`)

const { data: allRows } = await db.from('document_deadlines').select('id').eq('document_id', doc.id)
const { data: viewRows } = await db.from('document_dates_current_v').select('deadline_id').eq('document_id', doc.id)
console.log(`  the first document holds ${allRows.length} deadline row(s); the current-dates view returns ${viewRows.length}`)
if (viewRows.length !== allRows.length) {
  fail(`the view returns ${viewRows.length} of ${allRows.length} dates after a failed reading - the report's list is short`)
} else pass(`the view keeps all ${viewRows.length} dates through the failed reading (the report's list is not empty)`)

const { data: doc2 } = await db.from('documents').insert({
  company_id: co.id, name: 'acdp-permit.pdf', file_url: `${co.id}/acdp.pdf`, file_type: 'application/pdf',
}).select('id').single()
const permitReading = {
  ...stored.scan,
  identity: { ...stored.scan.identity, kind: 'permit', doc_date: '2021-07-18', doc_date_kind: 'issued' },
  status: 'current',
  deadlines: [{ title: 'Permit expires', due_on: '2026-11-15', recurs: false,
                source_line: 'This permit expires 15 November 2026.' }],
  extracted_text: 'This permit expires 15 November 2026.',
}
await saveScan(db, permitReading, { documentId: doc2.id, companyId: co.id, linkLedger: false })

const read2 = async (when) => {
  const { data } = await db.from('document_index_v')
    .select('significant_date, significant_date_kind, display_status, kind').eq('document_id', doc2.id).maybeSingle()
  const { data: v } = await db.from('document_dates_current_v')
    .select('deadline_id, due_on, from_an_earlier_reading').eq('document_id', doc2.id)
  console.log(`     ${when.padEnd(24)} significant_date = ${String(data.significant_date ?? 'NULL').padEnd(12)}`
    + `kind = ${String(data.kind ?? 'NULL').padEnd(12)}status = ${String(data.display_status).padEnd(16)}`
    + `view = ${v.length}${v[0]?.from_an_earlier_reading ? ' (earlier reading)' : ''}`)
  return { idx: data, view: v }
}
console.log(`\n  a second document, with a NON-RECURRING expiry - the case 049's rule actually reads:`)
const p1 = await read2('after a GOOD reading')
await saveScan(db, failedScan('refused', 'try again'), { documentId: doc2.id, companyId: co.id, linkLedger: false })
const p2 = await read2('after a FAILED re-read')

console.log('')
if (p2.view.length !== 1) fail(`the permit's expiry is not in the current dates after the failed reading (${p2.view.length} rows)`)
else pass("075: the permit's expiry survives the failed reading in the current-dates view")
if (p2.view[0]?.from_an_earlier_reading !== true) fail('the dates do not say they are from an earlier reading')
else pass('...and they SAY they are from an earlier reading, so the report can tell the person')

// *** A CORRECTION, KEPT RATHER THAN QUIETLY FIXED. ***
// An earlier version of this script printed "CONFIRMED, AND IT IS 074's DOING" for the significant
// date. That was wrong, in exactly the way `CLAUDE.md` §9.1 names: a cause asserted from a result
// without running the comparison. Checked afterwards, on the database:
//
//     select (case null::text when 'permit' then '2026-11-15'::date else null::date end)  ->  NULL
//
// 049's lateral takes the KIND from `coalesce(c_kind.new_value, s.kind)`, where `s` is the CURRENT
// scan (049:98, unchanged by 074 and 075) - and a failed reading has no kind. A null kind takes the
// CASE's ELSE branch, `s.doc_date`, which is also null on a failed reading. So the significant date
// was null after a failed re-read BEFORE 074 as well: the expiry lateral found the date and the kind
// threw it away. 074 broke the REPORT'S LIST; it did not break this.
if (p2.idx.significant_date === null && p2.idx.kind === null) {
  console.log(`\n  ! A SEPARATE, PRE-EXISTING LIMIT - NOT 074's, AND NOT FIXED HERE:`)
  console.log(`    significant_date is still NULL, because \`kind\` is NULL. The index takes the kind from`)
  console.log(`    the CURRENT scan (049:98, :212), a failed reading has no kind, and a null kind takes`)
  console.log(`    the CASE's ELSE branch. Pre-074 behaved identically - checked, not assumed.`)
  console.log(`    Fixing it means taking the kind - and then the title, agencies, subjects and summary -`)
  console.log(`    from the latest READABLE reading, which changes what the Documents page shows for`)
  console.log(`    every failed document. That is a Documents decision, not a dates one, and it is the`)
  console.log(`    owner's. Recorded in docs/HANDOFF-CODE.md section 7.`)
} else if (p2.idx.significant_date !== null) {
  console.log(`\n  the significant date also survives: ${p1.idx.significant_date} -> ${p2.idx.significant_date}`)
}
console.log(`  ${'='.repeat(78)}`)

await db.from('calendar_events').delete().eq('company_id', co.id)
await db.from('companies').delete().eq('id', co.id)
console.log(`\n  cleaned up.`)
