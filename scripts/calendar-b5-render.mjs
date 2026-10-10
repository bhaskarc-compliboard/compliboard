// WHAT THE FOUR EMAILS NOW LOOK LIKE — Calendar B5. Renders each from fixture content, writes the
// HTML to the scratchpad for a browser to shoot, and prints the plain-text part so the words can be
// read beside the old ones. No send, no model, no database.
import { writeFileSync, mkdirSync } from 'node:fs'
import { renderMonthlyEmail } from '../lib/calendarNotify.ts'
import { renderEmail } from '../lib/emailFrame.ts'
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
const documents = renderEmail({
  company: 'Cascade Specialty Chemicals, LLC',
  title: "We've read your 6 documents",
  blocks: [
    { kind: 'para', text: 'We read 6 documents. 2 need attention, 4 are on file and need nothing.' },
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

const audit = renderEmail({
  company: 'Cascade Specialty Chemicals, LLC',
  title: 'Your OSHA audit: 3 things that need you',
  blocks: [
    { kind: 'para', text: 'Your OSHA audit found 3 things that need you, out of 15 checked.' },
    { kind: 'note', text: 'Read against your documents as they stood on 2026-10-08.' },
    { kind: 'list', heading: 'What needs you:', rows: [
      { main: 'Emergency Response Procedures — nothing on file' },
      { main: 'Annual Hazmat Training Records — nothing on file' },
      { main: 'Spill Response Plan — out of date (Spill_Response_Plan_2022.pdf)' },
    ], more: '…and 2 more.' },
    { kind: 'para', text: 'It also found 12 things on file and 2 things we would expect a company like yours to hold and did not see — a suggestion, not a checked requirement.' },
  ],
  button: { label: 'See it all', href: 'https://compliboard.vercel.app/audits?run=demo' },
  why: 'You get this because you asked CompliBoard to audit a folder of your documents, and we\u2019ve finished.',
})

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
  ['audit',     'Your OSHA audit: 3 things that need you',           audit],
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
