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
import { buildAuditInput, renderAuditInput } from '../lib/audit.ts'
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

/**
 * The throwaway company goes WHATEVER HAPPENS. Two were left on staging by runs of this script that
 * threw before the cleanup at the bottom — one on a seeded gap with a null `basis`, one on a file an
 * edit had scrambled — and they then turned up as companies in A5's first dry run of the monthly
 * email. A7 part 2 compares row counts per company, so a leftover is not harmless.
 */
async function cleanUp() {
  await db.from('calendar_events').delete().eq('company_id', co.id)
  await db.from('companies').delete().eq('id', co.id)
}
process.on('uncaughtException', async (e) => { console.error(e); await cleanUp(); process.exit(1) })
process.on('unhandledRejection', async (e) => { console.error(e); await cleanUp(); process.exit(1) })

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

// ===========================================================================
// A3d — WHAT ELSE A FAILED READING TAKES WITH IT.
//
// `document_index_v` takes the document's identity from the CURRENT scan (075:155,
// `left join document_scans s ... and s.is_current`): title, kind, agencies, subjects, issuer and
// summary all come from `s`. A failed reading has none of them. So the question is what a person,
// and an AUDIT, then see.
//
//   lib/audit.ts:135-153   reads document_index_v's `agencies` and keeps a document only when
//                          `list.includes(agencyLabel)`. An empty list means the document is not in
//                          that agency's evidence at all - it is listed at the end as a title.
//   app/api/audits/index/route.ts:65, :69   the same filter, and documents with no agencies are
//                          counted as "unplaced".
// ===========================================================================
console.log(`\n  ${'='.repeat(78)}`)
console.log(`  A3d - WHAT ELSE A FAILED READING TAKES WITH IT`)

const { data: doc3 } = await db.from('documents').insert({
  company_id: co.id, name: 'acdp-permit-2.pdf', file_url: `${co.id}/acdp2.pdf`, file_type: 'application/pdf',
}).select('id').single()
const deqReading = {
  ...stored.scan,
  identity: {
    ...stored.scan.identity,
    kind: 'permit',
    title: 'Standard Air Contaminant Discharge Permit No. 26-2841-ST-01',
    agencies: ['Oregon DEQ'],
    subjects: ['Air quality'],
    doc_date: '2021-07-18', doc_date_kind: 'issued',
  },
  status: 'current',
  deadlines: [{ title: 'Permit expires', due_on: '2026-11-15', recurs: false,
                source_line: 'This permit expires 15 November 2026.' }],
  gaps: [{ title: 'No record of the annual emissions report', description: 'The permit requires one.',
           fix: 'File the 2026 report.', citation: 'OAR 340-216-0066', citation_url: null,
           locator: 'Condition 4.2', draftable: false, quote: null, quote_verified: null,
           basis: 'read', same_as_gap_id: null }],
  extracted_text: 'This permit expires 15 November 2026.',
}
await saveScan(db, deqReading, { documentId: doc3.id, companyId: co.id, linkLedger: false })
// A WEEK EARLIER, so the grey line's date can be seen to be the readable reading's and not the failed
// one's. Two dates that are the same prove nothing about which one a line is showing.
await db.from('document_scans')
  .update({ scanned_at: new Date(Date.now() - 7 * 86400000).toISOString() })
  .eq('document_id', doc3.id)

const identity = async (when) => {
  const { data } = await db.from('document_index_v')
    .select('title, kind, agencies, subjects, significant_date, display_status, summary')
    .eq('document_id', doc3.id).maybeSingle()
  const ag = Array.isArray(data.agencies) ? data.agencies : []
  console.log(`     ${when.padEnd(24)} kind=${String(data.kind ?? 'NULL').padEnd(8)}`
    + `agencies=${JSON.stringify(ag).padEnd(14)}significant=${String(data.significant_date ?? 'NULL').padEnd(12)}`
    + `status=${data.display_status}`)
  console.log(`     ${' '.repeat(24)} title="${String(data.title).slice(0, 62)}"`)
  return { ...data, ag }
}
console.log(`\n  a DEQ air permit, read well, then read again by a service that refused:`)
const d1 = await identity('after a GOOD reading')
await saveScan(db, failedScan('refused', 'try again'), { documentId: doc3.id, companyId: co.id, linkLedger: false })
const d2 = await identity('after a FAILED re-read')

console.log('')
if (d2.kind === null && d1.kind === 'permit') fail('(a) the document lost its KIND, so it is no longer a permit')
else pass('(a) the document keeps its kind through a failed reading')
if (!d2.ag.includes('Oregon DEQ') && d1.ag.includes('Oregon DEQ')) {
  fail('(b) the document lost its AGENCIES - it is no longer in Oregon DEQ\'s audit')
} else pass('(b) the document keeps its agencies through a failed reading')
if (d2.significant_date === null && d1.significant_date !== null) {
  fail('(a) the document lost its significant date (the expiry beside "Could not read")')
} else pass('(a) the document keeps its significant date')
if (String(d2.title) !== String(d1.title)) {
  fail(`(a) the title fell back to the file name: "${String(d2.title).slice(0, 40)}"`)
} else pass('(a) the document keeps its title')

// AND WHAT AN AUDIT WOULD SEE, by the exact filter lib/audit.ts uses.
const { data: idxAll } = await db.from('document_index_v')
  .select('document_id, title, agencies').eq('company_id', co.id)
const carries = (row, label) => Array.isArray(row.agencies) && row.agencies.includes(label)
const inDeq = (idxAll ?? []).filter((r) => carries(r, 'Oregon DEQ'))
const unplaced = (idxAll ?? []).filter((r) => !Array.isArray(r.agencies) || r.agencies.length === 0)
console.log(`\n  by lib/audit.ts:148-153's own filter, an "Oregon DEQ" audit would read ${inDeq.length} document(s);`)
console.log(`  ${unplaced.length} of this company's documents are UNPLACED (no agency at all).`)
if (!inDeq.some((r) => r.document_id === doc3.id)) {
  fail('the permit is NOT in its own agency\'s audit after a failed re-read')
} else pass('the permit is still in Oregon DEQ\'s audit after a failed re-read')

// ===========================================================================
// A3e — 076 PUT THE PERMIT BACK IN THE AUDIT. DOES THE AUDIT READ ITS WORDS?
//
// `lib/audit.ts:157` takes `scanIds` from `document_index_v.scan_id` — the CURRENT scan — and then
// reads the document's gaps (:167), conditions (:172), deadlines (:177) and expected_missing (:180)
// `.in('scan_id', scanIds)`. After a failed re-read that scan is the failed one and holds nothing.
//
// If so, 076 turned "nothing on file" into something worse: the permit is LISTED and says nothing,
// which reads as a permit that is silent on the obligation rather than one we could not read.
// ===========================================================================
console.log(`\n  ${'='.repeat(78)}`)
console.log(`  A3e - WHAT THE AUDIT WOULD BE HANDED FOR THAT PERMIT`)

const built = await buildAuditInput(db, co.id, 'Oregon DEQ')
const rendered = renderAuditInput(built.input)
const mine = built.input.documents ?? []
const permit = mine.find((m) => String(m.title).includes('26-2841'))
console.log(`\n  the audit's input names ${mine.length} document(s) for Oregon DEQ`)
if (permit) {
  console.log(`  the permit: conditions=${permit.conditions?.length ?? 0} dates=${permit.deadlines?.length ?? 0}`
    + ` gaps=${permit.open_gaps?.length ?? 0} summary=${permit.summary ? 'yes' : 'NO'}`)
} else {
  console.log(`  the permit is not among them`)
}
// The block as the model would see it, for that document only.
const block = rendered.split('\n').filter((l) => /26-2841|expires|condition|gap/i.test(l)).slice(0, 10)
console.log(`\n  what the model would be handed about it:`)
for (const l of block) console.log(`     ${l.slice(0, 96)}`)
if (!block.length) console.log(`     (nothing: the document is named and no line of its content follows)`)

console.log('')
if (!permit) fail('the permit is not in the Oregon DEQ audit at all')
else if ((permit.deadlines?.length ?? 0) === 0 && (permit.conditions?.length ?? 0) === 0
         && (permit.open_gaps?.length ?? 0) === 0) {
  fail('the audit reads NOTHING of the permit: it is listed, and says nothing about its own expiry')
} else pass(`the audit reads the permit's words: ${permit.deadlines?.length ?? 0} date(s), `
  + `${permit.conditions?.length ?? 0} condition(s), ${permit.open_gaps?.length ?? 0} gap(s)`)

// ---- THE GREY LINE'S DATE (A3e item 3) ----
// The good reading was put a week before the failed one, so the two dates differ and the line can be
// seen to carry the right one.
const { data: idxRow } = await db.from('document_index_v')
  .select('scanned_at, identity_from_an_earlier_reading, readable_scan_id, scan_id')
  .eq('document_id', doc3.id).maybeSingle()
const { data: scanDates } = await db.from('document_scans')
  .select('id, status, scanned_at, is_current').eq('document_id', doc3.id).order('scanned_at')
console.log(`\n  the two readings:`)
for (const sc of scanDates) {
  console.log(`     ${String(sc.status).padEnd(16)}${String(sc.scanned_at).slice(0, 10)}  current=${sc.is_current}`)
}
const good = scanDates.find((x) => x.status !== 'could_not_read')
const bad = scanDates.find((x) => x.status === 'could_not_read')
console.log(`  the row's "read on" date: ${String(idxRow.scanned_at).slice(0, 10)}`)
console.log(`  Documents row:  "From the last reading that could read this document, on `
  + `${new Date(idxRow.scanned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}."`)
const { data: dates } = await db.from('document_dates_current_v')
  .select('scanned_at, from_an_earlier_reading').eq('document_id', doc3.id).limit(1)
console.log(`  Report drawer:  "These dates are from the last reading that could read this document, on `
  + `${dates[0] ? new Date(dates[0].scanned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '?'}."`)

if (String(idxRow.scanned_at).slice(0, 10) !== String(good.scanned_at).slice(0, 10)) {
  fail(`the row's date is ${String(idxRow.scanned_at).slice(0, 10)}, not the readable reading's ${String(good.scanned_at).slice(0, 10)}`)
} else pass(`the Documents row's line carries the GOOD reading's date, not the failed one's `
  + `(${String(good.scanned_at).slice(0, 10)} vs ${String(bad.scanned_at).slice(0, 10)})`)
if (!dates[0] || String(dates[0].scanned_at).slice(0, 10) !== String(good.scanned_at).slice(0, 10)) {
  fail(`the drawer's date is ${dates[0] ? String(dates[0].scanned_at).slice(0, 10) : 'missing'}`)
} else pass("the drawer's line carries the same date")

// ---- THE BLOCK THE MODEL IS HANDED, BEFORE THE FIX AND AFTER (the chat, A3e item 1) ----
//
// `lib/audit.ts:358–360` prints, per document, either the findings the reading made or the flat
// sentence `WHAT THE READING FOUND WRONG WITH IT: nothing`. That sentence is not an absence in the
// prompt — it is a STATEMENT, and under the old rule it was made about a document whose reading we
// never got. Both rules are computed here from the database, so the two can be read side by side
// without reverting the code.
const renderFor = (docTitle, gapCount, conds, dates) => {
  const out = []
  out.push(`   --- ${docTitle.slice(0, 58)}`)
  out.push(gapCount
    ? `      WHAT THE READING FOUND WRONG WITH IT (${gapCount}) — these are already findings; …`
    : '      WHAT THE READING FOUND WRONG WITH IT: nothing')
  out.push(`      CONDITIONS IT PUTS ON THE COMPANY: ${conds}`)
  out.push(`      DATES IT SETS: ${dates}`)
  return out
}
{
  const { data: idx } = await db.from('document_index_v')
    .select('title, scan_id, readable_scan_id').eq('document_id', doc3.id).maybeSingle()
  const countsFor = async (scanId) => {
    if (!scanId) return { g: 0, c: 0, d: 0 }
    const [g, c, dd] = await Promise.all([
      db.from('document_gaps').select('id', { count: 'exact', head: true }).eq('scan_id', scanId).eq('status', 'open'),
      db.from('document_conditions').select('id', { count: 'exact', head: true }).eq('scan_id', scanId),
      db.from('document_deadlines').select('id', { count: 'exact', head: true }).eq('scan_id', scanId),
    ])
    return { g: g.count ?? 0, c: c.count ?? 0, d: dd.count ?? 0 }
  }
  const before = await countsFor(idx.scan_id)            // the OLD rule: the current scan
  const after = await countsFor(idx.readable_scan_id)    // the rule now: the readable reading
  console.log(`\n  BEFORE (scan_id, the failed reading) — what lib/audit.ts would have printed:`)
  for (const l of renderFor(idx.title, before.g, before.c, before.d)) console.log(`  ${l}`)
  console.log(`\n  AFTER (readable_scan_id) — what it prints now:`)
  for (const l of renderFor(idx.title, after.g, after.c, after.d)) console.log(`  ${l}`)
  if (before.g !== 0 || before.c !== 0 || before.d !== 0) {
    fail('the old rule did not produce the empty block, so this comparison proves nothing')
  } else pass('the OLD rule stated "WHAT THE READING FOUND WRONG WITH IT: nothing" about an unread permit')
  if (after.c === 0 && after.d === 0 && after.g === 0) {
    fail('the permit still says nothing after the fix')
  } else pass(`the rule now carries its ${after.g} finding(s), ${after.c} condition(s) and ${after.d} date(s)`)
}

// ---- A LABEL IS ALIVE WHEN THE LATEST READABLE READING CARRIES IT (the chat, A3e item 2) ----
//
// `lib/companyLabels.ts` prunes a label no reading carries, and it DELETES. Under the old rule a
// failed re-read emptied the permit's `agencies`, so the next time any document was deleted — which
// is when pruning runs — "Oregon DEQ" went with it, and the agency dropped out of "audit everything".
{
  const { pruneOrphanLabels } = await import('../lib/companyLabels.ts')
  await db.from('company_labels')
    .upsert([{ company_id: co.id, kind: 'agency', label: 'Oregon DEQ' }],
            { onConflict: 'company_id,kind,label', ignoreDuplicates: true })
  // Another document, deleted — the event that triggers pruning in the product.
  const { data: spare } = await db.from('documents').insert({
    company_id: co.id, name: 'spare.pdf', file_url: `${co.id}/spare.pdf`, file_type: 'application/pdf',
  }).select('id').single()
  await db.from('documents').delete().eq('id', spare.id)
  const pruned = await pruneOrphanLabels(db, co.id)
  const { data: labelsNow } = await db.from('company_labels')
    .select('kind, label').eq('company_id', co.id).order('label')
  console.log(`\n  pruneOrphanLabels after a failed re-read and a document delete: `
    + `removed ${pruned.removed}${pruned.error ? ` (error: ${pruned.error})` : ''}`)
  console.log(`  labels left: ${labelsNow.map((l) => `${l.kind}:${l.label}`).join(', ') || '(none)'}`)
  if (!labelsNow.some((l) => l.label === 'Oregon DEQ')) {
    fail('"Oregon DEQ" was pruned because the permit\'s latest reading failed')
  } else pass('"Oregon DEQ" survives a failed re-read plus a document delete — the label is not an orphan')
}

// ---- THE REPORT'S GAPS, after a failed reading (the owner's yes, A3e item 2) ----
// The report split "now" from "from earlier readings" on the CURRENT scan, so a failed reading moved
// every finding to "earlier" and the drawer showed a document with no current findings at all.
const { data: idxForGaps } = await db.from('document_index_v')
  .select('scan_id, readable_scan_id').eq('document_id', doc3.id).maybeSingle()
const { data: allGaps } = await db.from('document_gaps')
  .select('id, title, citation, scan_id, status').eq('document_id', doc3.id)
const splitOn = idxForGaps.readable_scan_id ?? idxForGaps.scan_id
const nowGaps = (allGaps ?? []).filter((g) => g.scan_id === splitOn)
console.log(`\n  the report splits gaps on ${splitOn === idxForGaps.readable_scan_id ? 'readable_scan_id' : 'scan_id'}:`)
console.log(`     ${allGaps.length} gap(s) on this document; ${nowGaps.length} shown as current`)
for (const g of nowGaps.slice(0, 3)) {
  console.log(`     - ${String(g.title).slice(0, 52)}${g.citation ? `  [${String(g.citation).slice(0, 26)}]` : ''}`)
}
if (allGaps.length && nowGaps.length === 0) {
  fail('every finding moved to "from earlier readings" after a failed reading')
} else pass(`the findings show as the last readable reading's, with their line (${nowGaps.length} of ${allGaps.length})`)
console.log(`  ${'='.repeat(78)}`)

await cleanUp()
console.log(`\n  cleaned up.`)
