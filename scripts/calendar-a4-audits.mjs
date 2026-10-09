/**
 * A4's PROOF: Audits' "Add to calendar" adds the date in place, with its finding and its document.
 *
 * *** STAGING HOLDS NO AUDIT RUNS *** (`select count(*) from audit_runs` -> 0), so this seeds one —
 * a run, a section and three date findings, written with the service role as a finished audit would
 * be — presses the button's own route as the signed-in person, checks what landed, and (unless
 * KEEP=1) deletes the run again. No model is called: the rows are written directly, and the calendar
 * route calls nothing.
 *
 * The three findings are the three cases the row has to tell apart:
 *   1. a dated finding on a document              -> adds, confirmed, with finding and document
 *   2. a SECOND dated finding, same document, SAME DAY
 *                                                 -> adds too, and the first comes back as a sibling
 *                                                    (the owner's answer of 9 October: no soft match)
 *   3. a recurring finding with NO day            -> the row offers no button, so nothing to press
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/calendar-a4-audits.mjs
 *   KEEP=1 … leaves the run in place, for a screenshot.
 */
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.BASE ?? 'http://localhost:3998'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const pub = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1 }

const { data: s, error: signInErr } = await pub.auth.signInWithPassword({
  email: 'testcascade@example.com', password: process.env.CHECK_LIVE_PASSWORD,
})
if (signInErr) { console.error('sign-in failed:', signInErr.message); process.exit(1) }
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session.access_token}` }
const { data: prof } = await pub.from('profiles').select('company_id').eq('id', s.user.id).maybeSingle()
const companyId = prof.company_id

const { data: doc } = await admin.from('documents')
  .select('id, name').eq('company_id', companyId).eq('name', '11-fire-extinguisher-certificate.pdf').maybeSingle()
const { data: scan } = await admin.from('document_scans')
  .select('id').eq('document_id', doc.id).eq('is_current', true).maybeSingle()

const { data: run } = await admin.from('audit_runs').insert({
  company_id: companyId, kind: 'agency', agency_label: 'Oregon DEQ',
  status: 'done', section_count: 1, done_count: 1, created_by: s.user.id,
  finished_at: new Date().toISOString(),
}).select('id').single()
const { data: section } = await admin.from('audit_sections').insert({
  run_id: run.id, company_id: companyId, ordinal: 0, title: 'Air quality', status: 'done',
  documents_read: [doc.id],
}).select('id').single()

const FINDINGS = [
  { ordinal: 0, title: 'Annual report to DEQ for 2026', due_on: '2027-02-15', recurs: true,
    quote: 'The annual report is due by 15 February each year.' },
  { ordinal: 1, title: 'Permit fee for 2027', due_on: '2027-02-15', recurs: true,
    quote: 'The annual permit fee is payable with the report.' },
  { ordinal: 2, title: 'Scrubber inspection', due_on: null, recurs: true,
    quote: 'Inspect the scrubber on the cycle set by the manufacturer.' },
]
const { data: findings, error: fErr } = await admin.from('audit_findings').insert(FINDINGS.map((f) => ({
  run_id: run.id, section_id: section.id, company_id: companyId, kind: 'date',
  basis: 'read', document_id: doc.id, scan_id: scan?.id ?? null, source: 'reading', ...f,
}))).select('id, ordinal, title, due_on, recurs').order('ordinal')
if (fErr) { console.error('seeding the findings failed:', fErr.message); process.exit(1) }

console.log(`\n  seeded audit run ${run.id.slice(0, 8)} with ${findings.length} date findings on ${doc.name}`)
console.log(`  the report opens at ${BASE}/audits?run=${run.id}`)

const calendarRows = async (when) => {
  const { data } = await admin.from('calendar_events')
    .select('title, due_date, state, source, audit_finding_id, document_id, counts_as_due')
    .eq('company_id', companyId).eq('source', 'audit').order('title')
  console.log(`\n  -- audit dates on the calendar ${when} -- ${data.length}`)
  for (const r of data) {
    console.log(`     ${String(r.state).padEnd(11)}${String(r.due_date).padEnd(12)}`
      + `finding=${r.audit_finding_id ? 'yes' : 'NO '} doc=${r.document_id ? 'yes' : 'NO '} ${r.title.slice(0, 40)}`)
  }
  return data
}
await calendarRows('before')

const press = async (f, quote) => {
  const res = await fetch(`${BASE}/api/calendar/dates`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      source: 'audit', title: f.title, day: f.due_on, line: quote ?? null,
      audit_finding_id: f.id, document_id: doc.id, repeats: f.recurs === true,
    }),
  })
  const j = await res.json().catch(() => ({}))
  console.log(`  press "${f.title.slice(0, 34)}" -> ${res.status} created=${j.created} `
    + `already=${j.already ?? '-'} siblings=${j.siblings?.length ?? 0}`)
  return { res, j }
}

const one = await press(findings[0], FINDINGS[0].quote)
const two = await press(findings[1], FINDINGS[1].quote)
const again = await press(findings[0], FINDINGS[0].quote)
const after = await calendarRows('after')

console.log('')
if (one.res.status !== 200 || one.j.created !== true) fail(`the first press did not add the date (${one.res.status})`)
else pass("the date is added IN PLACE, through the calendar's own route")
const row = after.find((r) => r.title === findings[0].title)
if (!row?.audit_finding_id || !row?.document_id) fail(`the saved date lost its source: ${JSON.stringify(row)}`)
else pass("it carries the audit finding AND the finding's document (B7 closed)")
if (row?.state !== 'confirmed') fail(`an audit date arrived as ${row?.state}; a person pressed, so it is confirmed`)
else pass('it arrives CONFIRMED, because a person pressed (decision 3)')

if (two.j.created !== true) fail('the second obligation on the same day was refused')
else pass('a SECOND obligation on the same day is its own date — not merged')
if (!two.j.siblings?.length) fail('the other date on that day was not reported as a sibling')
else pass(`the other date on that day is SHOWN, not acted on: "${two.j.siblings[0].title.slice(0, 36)}"`)

if (again.j.created !== false || again.j.already !== 'already') fail(`a second press made ${JSON.stringify(again.j)}`)
else pass('pressing twice adds nothing the second time (B8 closed)')
if (after.length !== 2) fail(`expected 2 audit dates, got ${after.length}`)
else pass(`three presses of two findings left ${after.length} rows`)

if (process.env.KEEP === '1') {
  console.log(`\n  KEEP=1: the run and its dates are left in place for a screenshot.`)
  console.log(`  RUN=${run.id}`)
} else {
  await admin.from('calendar_events').delete().eq('company_id', companyId).eq('source', 'audit')
  await admin.from('audit_runs').delete().eq('id', run.id)
  const { count: left } = await admin.from('audit_runs').select('id', { count: 'exact', head: true }).eq('id', run.id)
  const { count: datesLeft } = await admin.from('calendar_events')
    .select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('source', 'audit')
  console.log(`\n  cleaned up: ${left ?? 0} run(s) and ${datesLeft ?? 0} audit date(s) left.`)
}
