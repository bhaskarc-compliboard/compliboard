// DOES THE AUDIT EMAIL'S COUNT AGREE WITH ITS LIST? — Calendar B8 item 2.
//
// *** THE FIRST VERSION OF THIS QUESTION WAS ANSWERED BY A FIXTURE, AND THE FIXTURE WAS WRONG. ***
// B5's render hand-wrote "3 things that need you", three rows and "…and 2 more" — a shape the code
// cannot produce, since the old "…and N more" only appeared past 25 rows. So the screenshot showed
// a disagreement the product did not have, and hid the one it did.
//
// This builds REAL `audit_findings` rows, runs the product's own `summariseRun`, and renders the
// product's own email. Throwaway company, deleted on exit and on a crash.
import { createClient } from '@supabase/supabase-js'
import { summariseRun } from '../lib/auditRun.ts'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

let companyId = null
const clean = async () => { if (companyId) { await db.from('companies').delete().eq('id', companyId); companyId = null } }
for (const sig of ['uncaughtException', 'unhandledRejection'])
  process.on(sig, async (e) => { await clean(); console.error(e); process.exit(1) })
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const co = must(await db.from('companies').insert({ name: 'B8 audit-count probe' }).select('id').single(), 'company')
companyId = co.id
const run = must(await db.from('audit_runs').insert({
  company_id: companyId, status: 'done', kind: 'agency', agency_label: 'Oregon OSHA', readings_as_of: '2026-10-08',
}).select('id').single(), 'run')
const sec = must(await db.from('audit_sections').insert({
  run_id: run.id, company_id: companyId, title: 'Oregon OSHA', status: 'done', ordinal: 1,
}).select('id').single(), 'section')

// A contradiction row needs two documents and both values (audit_findings_contradiction_has_two_sides),
// read off the live constraint rather than guessed. Every column name in this script came from
// lib/database.types.ts or pg_constraint after four refusals taught the lesson again.
const doc = async (name) => must(await db.from('documents').insert({
  company_id: companyId, name, file_type: 'application/pdf',
  file_url: `${companyId}/${name}`, source: 'upload', status: 'read',
}).select('id').single(), `document ${name}`)
const docA = await doc('sds-binder.pdf')
const docB = await doc('hazcom-plan.pdf')

// THE SHAPE THAT BREAKS IT: three rows the list shows, plus two the subject counts and it does not.
const f = (ordinal, title, kind, word) => ({
  run_id: run.id, section_id: sec.id, company_id: companyId, ordinal, title, kind, word, status: 'open',
})
must(await db.from('audit_findings').insert([
  f(1, 'Emergency Response Procedures', 'finding', 'nothing_on_file'),
  f(2, 'Annual Hazmat Training Records', 'finding', 'nothing_on_file'),
  f(3, 'Spill Response Plan', 'finding', 'stale'),
  { ...f(4, 'Your SDS binder and your HazCom plan name different chemicals', 'contradiction', null),
    document_id: docA.id, document_b_id: docB.id,
    value_a: 'hydrofluoric acid, sulfuric acid, nitric acid',
    value_b: 'hydrofluoric acid, sulfuric acid' },
  f(5, 'How many employees work past 7pm?', 'finding', 'not_a_document_question'),
]).select('id'), 'findings')

const summary = await summariseRun(db, run.id)
console.log('\nFROM THE PRODUCT\'S OWN summariseRun:')
console.log(`   needs_person (the subject's number) : ${summary.needs_person}`)
console.log(`   nothing_on_file + stale             : ${summary.nothing_on_file + summary.stale}`)
console.log(`   contradictions                      : ${summary.contradictions}`)
console.log(`   not_a_document_question             : ${summary.not_a_document_question}`)
console.log(`   attention (rows the list shows)     : ${summary.attention.length}`)

const oldMore = summary.nothing_on_file + summary.stale > summary.attention.length
  ? summary.nothing_on_file + summary.stale - summary.attention.length : 0
const newMore = summary.needs_person > summary.attention.length
  ? summary.needs_person - summary.attention.length : 0
console.log('\n   OLD "…and N more" :', oldMore === 0 ? 'not shown at all' : `…and ${oldMore} more.`,
            `   -> listed ${summary.attention.length} + ${oldMore} = ${summary.attention.length + oldMore}`,
            `(subject says ${summary.needs_person})`)
console.log('   NEW "…and N more" :', newMore === 0 ? 'not shown' : `…and ${newMore} more.`,
            `         -> listed ${summary.attention.length} + ${newMore} = ${summary.attention.length + newMore}`,
            `(subject says ${summary.needs_person})`)

const agreesNow = summary.attention.length + newMore === summary.needs_person
const agreedBefore = summary.attention.length + oldMore === summary.needs_person
console.log('\n' + '='.repeat(78))
console.log(agreedBefore ? 'The old line already agreed — this probe proves nothing.' : 'OLD: the email said more in its subject than it ever showed.')
console.log(agreesNow ? 'NEW: the count and the list agree.' : 'NEW: THEY STILL DO NOT AGREE.')
await clean()
console.log('Probe company deleted.')
if (!agreesNow || agreedBefore) process.exit(1)
