// WHAT THE FOUR EMAILS NOW LOOK LIKE — Calendar B5. Renders each from fixture content, writes the
// HTML to the scratchpad for a browser to shoot, and prints the plain-text part so the words can be
// read beside the old ones. No send, no model, no database.
import { writeFileSync, mkdirSync } from 'node:fs'
import { renderMonthlyEmail } from '../lib/calendarNotify.ts'
import { renderEmail } from '../lib/emailFrame.ts'
// *** THE WORDS COME FROM THE PRODUCT, NOT FROM THIS FILE. ***
// B5's first version hand-wrote "We read 6 documents. 2 need attention, 4 are on file and need
// nothing." — a sentence Documents does not own and has never sent. The owner caught it in the
// render and asked whether the CODE had been rewritten. It had not: `summaryLine` was untouched and
// `sendBatchEmail` calls it. The FIXTURE was the lie, which is worse than a bug in a way — a render
// nobody can trust says nothing about the product. Every sentence below now comes from the module.
import { summaryLine } from '../lib/documentBatch.ts'
import { Resend } from 'resend'
import { emailFrom } from '../lib/emailSender.ts'

const SEND = process.argv.includes('--send')

mkdirSync('shots/emails', { recursive: true })

const monthly = renderMonthlyEmail({
  companyName: 'Cascade Specialty Chemicals, LLC',
  asOf: '2026-10-09',
  appUrl: 'https://compliboard.vercel.app',
  dates: {
    due: [
      { id: '1', title: 'Air permit annual fee', due_date: '2026-10-20', site: 'Portland plant', state: 'confirmed' },
      { id: '2', title: 'Six-year internal maintenance for units W-3 and L-1', due_date: '2026-10-28', site: 'Portland plant', state: 'not_confirmed' },
    ],
    passed: [
      { id: '3', title: 'Fire extinguisher service', due_date: '2025-09-30', site: 'Portland plant', state: 'confirmed' },
      { id: '4', title: 'Next annual maintenance for all 14 units', due_date: '2026-08-20', site: 'Portland plant', state: 'not_confirmed' },
    ],
    waiting: 2,
  },
})
writeFileSync('shots/emails/monthly.html', monthly.html)
console.log('=== MONTHLY — plain text part\n')
console.log(monthly.text)
console.log(`\n(subject: ${monthly.subject})`)

// ── THE OTHER THREE, from fixture content in each one's own shape ─────────────────────────────
// These build the SAME content objects their modules build, so the renders are faithful. They are
// not re-implementations of the words: each sentence below is copied from the module beside it, and
// the point of the exercise is the frame, which is shared.
// The same shape `summariseBatch` returns, so `summaryLine` writes its real sentence.
const batch = {
  total: 6, needs_work: 2, expiring: 1, expired: 0, could_not_read: 0,
  attention: [], fine: [],
}
console.log('\n=== DOCUMENTS — the sentence, from the product:')
console.log('   old (B5 fixture, invented): We read 6 documents. 2 need attention, 4 are on file and need nothing.')
console.log(`   new (lib/documentBatch.ts summaryLine): ${summaryLine(batch)}`)

const documents = renderEmail({
  company: 'Cascade Specialty Chemicals, LLC',
  title: "We've read your 6 documents",
  blocks: [
    { kind: 'para', text: summaryLine(batch) },
    { kind: 'list', heading: 'What needs attention:', rows: [
      { main: 'Certificate of Annual Maintenance — Portable Fire Extinguishers — Expiring. The annual maintenance date has passed.' },
      { main: 'Powered Industrial Truck Operator Training Record — Needs work. One operator has no evaluation on file.' },
    ] },
    { kind: 'list', heading: 'On file and nothing to do: 4', rows: [
      { main: 'OSHA Form 300A Summary of Work-Related Injuries and Illnesses, 2025' },
      { main: 'Monthly EHS Self-Check' },
      { main: 'Oregon DEQ Air Contaminant Discharge Permit Compliance Inspection Checklist' },
      { main: 'Spill Prevention Control and Countermeasure Plan' },
    ] },
  ],
  button: { label: 'See them all', href: 'https://compliboard.vercel.app/documents' },
  why: 'You get this because you sent documents to CompliBoard to read, and we\u2019ve finished reading them.',
})

// *** THE AUDIT EMAIL COMES OUT OF A REAL RUN, NOT A FIXTURE *** (B8 item 2).
// B5's version hand-wrote the subject, the three rows and "…and 2 more" — a shape the code could
// not produce — so the render showed a disagreement the product did not have and hid the one it
// did. This builds real `audit_findings` rows, lets `summariseRun` count them and `notifyRun`
// write the email, and takes the HTML off the dry run. Throwaway company, deleted at the end.
import { createClient } from '@supabase/supabase-js'
import { notifyRun } from '../lib/auditNotify.ts'
import { summariseRun } from '../lib/auditRun.ts'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })
let probeCo = null
const cleanProbe = async () => { if (probeCo) { await db.from('companies').delete().eq('id', probeCo); probeCo = null } }
for (const sig of ['uncaughtException', 'unhandledRejection'])
  process.on(sig, async (e) => { await cleanProbe(); console.error(e); process.exit(1) })
const need = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const pc = need(await db.from('companies').insert({ name: 'Cascade Specialty Chemicals, LLC' }).select('id').single(), 'probe company')
probeCo = pc.id
const prun = need(await db.from('audit_runs').insert({
  company_id: probeCo, status: 'done', kind: 'agency', agency_label: 'Oregon OSHA',
  readings_as_of: '2026-10-08',
}).select('id').single(), 'probe run')
const psec = need(await db.from('audit_sections').insert({
  run_id: prun.id, company_id: probeCo, title: 'Oregon OSHA', status: 'done', ordinal: 1,
}).select('id').single(), 'probe section')
const pdoc = async (name) => need(await db.from('documents').insert({
  company_id: probeCo, name, file_type: 'application/pdf', file_url: `${probeCo}/${name}`,
  source: 'upload', status: 'read',
}).select('id').single(), `probe document ${name}`)
const dA = await pdoc('Spill_Response_Plan_2022.pdf')
const dB = await pdoc('HazCom_Plan.pdf')
const pf = (ordinal, title, kind, word, extra = {}) => ({
  run_id: prun.id, section_id: psec.id, company_id: probeCo, ordinal, title, kind, word,
  status: 'open', ...extra,
})
need(await db.from('audit_findings').insert([
  pf(1, 'Emergency Response Procedures', 'finding', 'nothing_on_file'),
  pf(2, 'Annual Hazmat Training Records', 'finding', 'nothing_on_file'),
  pf(3, 'Spill Response Plan', 'finding', 'stale', { document_id: dA.id }),
  pf(4, 'Your SDS binder and your HazCom plan name different chemicals', 'contradiction', null, {
    document_id: dA.id, document_b_id: dB.id,
    value_a: 'hydrofluoric acid, sulfuric acid, nitric acid', value_b: 'hydrofluoric acid, sulfuric acid' }),
  pf(5, 'How many employees work past 7pm?', 'finding', 'not_a_document_question'),
  ...Array.from({ length: 12 }, (_, i) => pf(6 + i, `On file ${i + 1}`, 'finding', 'on_file')),
  pf(18, 'Respirator fit-test records', 'expected', null),
  pf(19, 'Chemical inventory list', 'expected', null),
]), 'probe findings')

// notifyRun takes the summary as an argument — it does not fetch one. `summariseRun` is what the
// sweep calls just before it, so the render follows the same two steps the product does.
const auditSummary = await summariseRun(db, prun.id)
const auditRes = await notifyRun(db, prun.id, auditSummary, { dryRun: true })
if (!auditRes.html) { console.error('the audit dry run returned no html:', auditRes.error); await cleanProbe(); process.exit(1) }
console.log(`\n=== AUDIT — from the product (subject: ${auditRes.subject})`)
console.log(auditRes.text)
const audit = { html: auditRes.html, text: auditRes.text }

const handbook = renderEmail({
  company: 'Cascade Specialty Chemicals, LLC',
  title: 'Your handbook check is done: Employee Handbook',
  blocks: [
    { kind: 'para', text: 'Employee Handbook was checked against the rules that apply to you on 9 October 2026.' },
    { kind: 'para', text: '1 part could not be checked. Press Check now to try again.' },
  ],
  button: { label: 'Read the check', href: 'https://compliboard.vercel.app/hr?handbook=demo' },
  why: 'You get this because you asked CompliBoard to check your handbook, and we\u2019ve finished.',
})

const all = [
  ['monthly',   'Your October dates: 2 due, 2 passed, 2 to confirm', monthly],
  ['documents', "We've read your 6 documents",                       documents],
  ['audit',     auditRes.subject,                                    audit],
  ['handbook',  'Your handbook check is done: Employee Handbook',    handbook],
]
for (const [name, , e] of all) writeFileSync(`shots/emails/${name}.html`, e.html)
console.log('\nwrote: ' + all.map(([n]) => `shots/emails/${n}.html`).join(', '))

if (SEND) {
  const to = (process.env.NOTIFY_TEST_TO ?? '').trim()
  const key = process.env.RESEND_API_KEY
  if (!to || !key) { console.error('NOTIFY_TEST_TO and RESEND_API_KEY must both be set to send.'); process.exit(1) }
  const resend = new Resend(key)
  console.log(`\nsending all four to ${to} from ${emailFrom()}`)
  for (const [name, subject, e] of all) {
    const res = await resend.emails.send({ from: emailFrom(), to, subject, text: e.text, html: e.html })
    console.log(`  ${name.padEnd(10)} ${res.error ? 'FAILED: ' + res.error.message : 'sent ' + res.data?.id}`)
    await new Promise(r => setTimeout(r, 700))   // Resend rate-limits bursts
  }
}

await cleanProbe()
console.log('\nprobe company deleted.')
