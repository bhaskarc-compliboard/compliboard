/**
 * A3's PROOF, FREE: a real model reading replayed twice through the same `saveScan` a live scan uses.
 *
 * *** NO MODEL IS CALLED. *** The readings are the stored real-model answers under
 * `tests/golden/documents/runs/real-model/`, replayed with `linkLedger: false` exactly as
 * `scripts/run-golden-docs.js --restore-from` (and so `db:restore` step 9) does it. `npm run cost`
 * does not move.
 *
 * WHAT IT PROVES, which a single replay could not:
 *   1. a reading's dates reach the calendar by themselves, not confirmed (decision 3);
 *   2. a date whose source line is NOT in the document is held off the month (decision 5);
 *   3. two obligations on the SAME DAY in one document stay two dates (the fire-extinguisher case);
 *   4. a RE-READ does not duplicate a date whose line is unchanged, even when the model renamed it;
 *   5. a re-read WITHDRAWS the not-confirmed dates whose line it no longer says (decision 4);
 *   6. ...and leaves a CONFIRMED date exactly where it is, because a person said it was right.
 *
 * *** WHERE READING 2 COMES FROM, SAID PLAINLY. *** No fixture holds two stored readings — each
 * folder under `real-model/` has one file. So reading 2 is reading 1 with drift applied, and the drift
 * is not invented: it is the shape staging actually recorded when `13-company-self-check.docx` was read
 * twice (`docs/CALENDAR-MACHINERY.md` C3) — a deadline renamed completely while its source line stayed
 * byte-identical — plus the two other ways a reading can differ: a line reworded, and a deadline the
 * second reading does not mention at all. Each change is printed before it is applied.
 *
 * It works in a THROWAWAY company, deleted at the end, so the fixture companies' row counts are
 * untouched (A7 part 2 compares them).
 *
 *   node --env-file=.env.local scripts/calendar-a3-replay.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { saveScan } from '../lib/documentScan.ts'
import { confirmDate } from '../lib/calendarDates.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) { console.error('REFUSED: staging url and service key must be set.'); process.exit(1) }
const db = createClient(url, service, { auth: { persistSession: false } })

const CASE = '11-fire-extinguisher-certificate'
const DIR = `tests/golden/documents/runs/real-model/${CASE}`
const file = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().pop()
const stored = JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8'))
const base = stored.scan

console.log(`\n  A3 — replaying a STORED real-model reading. No model call.`)
console.log(`  case ${CASE}, file ${file}, model ${stored.model}`)
console.log(`  extracted_text ${String(base.extracted_text ?? '').length} characters, ${base.deadlines.length} deadlines\n`)

// ---------------------------------------------------------------------------
// A throwaway company and one document.
// ---------------------------------------------------------------------------
const { data: co } = await db.from('companies')
  .insert({ name: `A3 replay ${new Date().toISOString().slice(0, 19)}` }).select('id').single()
const { data: site } = await db.from('entities')
  .insert({ company_id: co.id, entity_type: 'site', name: 'Portland Facility' }).select('id').single()
const { data: doc } = await db.from('documents').insert({
  company_id: co.id, name: 'fire-extinguisher-certificate.pdf',
  file_url: `${co.id}/fire-extinguisher-certificate.pdf`, file_type: 'application/pdf',
  entity_id: site.id,
}).select('id').single()
console.log(`  company ${co.id.slice(0, 8)}  site ${site.id.slice(0, 8)}  document ${doc.id.slice(0, 8)}`)

// ---------------------------------------------------------------------------
// Printing the calendar, every time, from the database.
// ---------------------------------------------------------------------------
async function showCalendar(when) {
  const { data } = await db.from('calendar_events')
    .select('title, due_date, state, counts_as_due, line_verified, is_recurring, repeats_every, document_deadline_id, date_key')
    .eq('company_id', co.id).order('date_key')
  console.log(`\n  ── calendar_events ${when} — ${data.length} row(s)`)
  console.log(`     ${'state'.padEnd(14)}${'due'.padEnd(12)}${'due?'.padEnd(6)}${'line'.padEnd(6)}title`)
  for (const r of data) {
    console.log(`     ${String(r.state).padEnd(14)}${String(r.due_date ?? '—').padEnd(12)}`
      + `${String(r.counts_as_due).padEnd(6)}${String(r.line_verified ?? '—').padEnd(6)}${r.title.slice(0, 58)}`)
  }
  return data
}

async function showDeadlines(when) {
  const { data } = await db.from('document_dates_current_v')
    .select('title, due_on, recurs, quote_verified').eq('document_id', doc.id).order('title')
  console.log(`\n  ── document_dates_current_v ${when} — ${data.length} row(s)`)
  for (const r of data) {
    console.log(`     ${String(r.due_on ?? '—').padEnd(12)}line_found=${String(r.quote_verified).padEnd(6)}${r.title.slice(0, 60)}`)
  }
  return data
}

const fail = (msg) => { console.error(`\n  ✗ ${msg}`); process.exitCode = 1 }
const pass = (msg) => console.log(`  ✓ ${msg}`)

// ---------------------------------------------------------------------------
// READING 1 — the stored answer, unchanged, plus ONE deliberate addition: a deadline whose line is
// NOT in the document, so decision 5's guardrail has something to catch. It is added rather than
// waited for because every line in this stored reading was found (printed above), and a guardrail that
// has never refused anything is a comment (§3.7).
// ---------------------------------------------------------------------------
const UNFOUND_LINE = 'The hydrostatic test certificate must be renewed before 1 June 2027.'
const reading1 = {
  ...base,
  deadlines: [
    ...base.deadlines,
    { title: 'Hydrostatic test certificate renewal', due_on: '2027-06-01', source_line: UNFOUND_LINE, recurs: false },
  ],
}
console.log(`\n  READING 1 = the stored answer + 1 deadline whose line is NOT in the document:`)
console.log(`    "${UNFOUND_LINE}"  (in extracted_text: ${String(base.extracted_text).includes(UNFOUND_LINE)})`)

const r1 = await saveScan(db, reading1, { documentId: doc.id, companyId: co.id, entityId: site.id, linkLedger: false })
console.log(`\n  saveScan #1 -> scan ${String(r1.scanId).slice(0, 8)}, ai_call_id ${r1.aiCallId}`)
console.log(`  calendar step: ${JSON.stringify(r1.calendar)}`)
await showDeadlines('after reading 1')
const after1 = await showCalendar('after reading 1')

if (after1.length !== 5) fail(`expected 5 dates after reading 1, got ${after1.length}`)
else pass('5 dates reached the calendar from the reading itself — nobody pressed anything (decision 3)')
if (after1.some((r) => r.state !== 'not_confirmed')) fail('a date arrived already confirmed')
else pass('every one arrived NOT CONFIRMED')

const unfound = after1.find((r) => r.title.startsWith('Hydrostatic'))
if (!unfound || unfound.line_verified !== false || unfound.counts_as_due !== false) {
  fail(`the unfound line was not held off the month: ${JSON.stringify(unfound)}`)
} else pass('the date whose line is NOT in the document is off the month (line_verified false, counts_as_due false)')

const sameDay = after1.filter((r) => r.due_date === '2026-10-31')
if (sameDay.length !== 2) fail(`the two obligations on 2026-10-31 did not stay two: got ${sameDay.length}`)
else pass('two different obligations on 2026-10-31 stayed TWO dates — the key is the line, not the day')

// A PERSON CONFIRMS ONE. This is the row decision 4 must not touch on the re-read.
const confirmMe = after1.find((r) => r.title.startsWith('6-year internal maintenance'))
const { data: confirmRow } = await db.from('calendar_events').select('id').eq('date_key', confirmMe.date_key).single()
await confirmDate(db, { companyId: co.id, id: confirmRow.id, every: 'yearly' })
console.log(`\n  a person confirms "${confirmMe.title.slice(0, 50)}" and says it repeats yearly`)

// ---------------------------------------------------------------------------
// READING 2 — the same document read again, with the three ways a reading really differs.
// ---------------------------------------------------------------------------
const d = base.deadlines
const renamed = { ...d[0], title: 'Annual maintenance of all 14 extinguishers' }       // same LINE, new TITLE
const reworded = { ...d[2], source_line: 'Monthly visual inspections are recorded on each unit tag, per NFPA 10 7.2.' }
const reading2 = {
  ...base,
  deadlines: [
    renamed,        // 1. renamed, line identical  -> must NOT duplicate
    d[1],           // 2. unchanged (the confirmed one) -> must stay confirmed
    reworded,       // 3. same obligation, new wording -> old one withdrawn, new one added
    // 4. d[3] ("Possible CO2 hydrostatic test") is DROPPED: this reading does not mention it.
    // 5. the unfound-line date is dropped too.
  ],
}
console.log(`\n  READING 2 — the same document, read again. The three real kinds of drift:`)
console.log(`    renamed, line identical : "${d[0].title.slice(0, 44)}"`)
console.log(`                           -> "${renamed.title}"`)
console.log(`    line reworded          : "${d[2].source_line.slice(0, 54)}…"`)
console.log(`                           -> "${reworded.source_line.slice(0, 54)}…"`)
console.log(`    not mentioned at all   : "${d[3].title.slice(0, 44)}" and the hydrostatic one`)

const r2 = await saveScan(db, reading2, { documentId: doc.id, companyId: co.id, entityId: site.id, linkLedger: false })
console.log(`\n  saveScan #2 -> scan ${String(r2.scanId).slice(0, 8)}, ai_call_id ${r2.aiCallId}`)
console.log(`  calendar step: ${JSON.stringify(r2.calendar)}`)
await showDeadlines('after reading 2')
const after2 = await showCalendar('after reading 2')

// 4. the renamed one did not duplicate
const renamedRows = after2.filter((r) => r.date_key.includes(':2026-08-20:'))
if (renamedRows.length !== 1) fail(`the renamed deadline made ${renamedRows.length} rows, not 1`)
else if (renamedRows[0].state !== 'not_confirmed') fail(`the renamed deadline's row changed state to ${renamedRows[0].state}`)
else pass('the RENAMED deadline did not duplicate — one row, still not confirmed (its line never changed)')

// 5. the reworded one: the old row withdrawn, a new one added
const oldWording = after2.find((r) => r.date_key.endsWith(require_norm(d[2].source_line)))
const newWording = after2.find((r) => r.date_key.endsWith(require_norm(reworded.source_line)))
if (!oldWording || oldWording.state !== 'withdrawn') fail(`the reworded deadline's old row is ${oldWording?.state ?? 'missing'}, not withdrawn`)
else pass('the REWORDED deadline\'s old date is WITHDRAWN, not deleted (decision 4)')
if (!newWording || newWording.state !== 'not_confirmed') fail(`the reworded deadline's new row is ${newWording?.state ?? 'missing'}`)
else pass('...and the new wording is a new not-confirmed date')

// 6. the confirmed one is untouched
const kept = after2.find((r) => r.date_key === confirmMe.date_key)
if (!kept || kept.state !== 'confirmed') fail(`the CONFIRMED date is ${kept?.state ?? 'missing'} — it must be left alone`)
else if (kept.repeats_every !== 'yearly') fail(`the confirmed date lost its "how often": ${kept.repeats_every}`)
else pass('the CONFIRMED date is untouched, with the "how often" the person gave it')

// 7. the dropped ones are withdrawn, not deleted
const dropped = after2.filter((r) => r.state === 'withdrawn')
if (dropped.length !== 3) fail(`expected 3 withdrawn (one reworded + two no longer mentioned), got ${dropped.length}`)
else pass('the two deadlines this reading does not mention are WITHDRAWN — marked, never deleted')

// 8. nothing was lost
if (after2.length !== after1.length + 1) fail(`row count went ${after1.length} -> ${after2.length}; nothing may be deleted`)
else pass(`no row was deleted: ${after1.length} -> ${after2.length} (the one new wording)`)

// 9. the month shows only what it should
const onTheMonth = after2.filter((r) => r.counts_as_due)
console.log(`\n  on the month now: ${onTheMonth.length} — ${onTheMonth.map((r) => r.title.slice(0, 28)).join(' | ')}`)

// ---------------------------------------------------------------------------
// Clean up: the whole throwaway company, so the fixture counts are untouched.
// ---------------------------------------------------------------------------
await db.from('calendar_events').delete().eq('company_id', co.id)
await db.from('companies').delete().eq('id', co.id)
const { count: left } = await db.from('calendar_events').select('id', { count: 'exact', head: true }).eq('company_id', co.id)
console.log(`\n  cleaned up: ${left ?? 0} row(s) left in the throwaway company.`)

/** The key's own normalisation, so this script can find a row by the line it was built from. */
function require_norm(line) {
  return line.replace(/<[^>]*>/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 200)
}
