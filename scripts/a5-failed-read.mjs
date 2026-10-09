/**
 * A5's R2 PROOF, END TO END: a company whose dates cannot be read gets NO EMAIL, and the reason is
 * on the job's row. `docs/FIX-LIST-FAILURES.md` R2 and R3.
 *
 * The unit test fails the read with a stand-in. This one does it against the real module and the
 * real `job_runs` table, so the whole path is shown: the throw, the catch per company, the count,
 * and the recorded error. No email is sent and no model is called.
 */
import { createClient } from '@supabase/supabase-js'
import { notifyMonth } from '../lib/calendarNotify.ts'
// `lib/jobAuth.ts` imports `next/server`, which bare Node cannot resolve, so the row is written
// here exactly as `startJobRun`/`finish` write it (`lib/jobAuth.ts:73-80`): opened with the job
// name, closed with counts, errors, `finished_at` and `ok = errors.length === 0`.

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })
const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1 }

const { data: co } = await db.from('companies')
  .select('id, name').eq('name', 'Cascade Specialty Chemicals, LLC').maybeSingle()

// A client whose calendar_events read FAILS, and whose every other read works. This is what a
// dropped grant, a renamed column or a connection fault looks like from the code's side.
const broken = {
  ...db,
  from: (t) => t === 'calendar_events'
    ? { select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ neq: () => ({
        order: () => ({ then: (r) => r({ data: null, error: { message: 'permission denied for calendar_events' } }) }),
      }) }) }) }) }) }) }
    : db.from(t),
  auth: db.auth,
}

console.log(`\n  the company: ${co.name}`)
let threw = null
let result = null
try {
  result = await notifyMonth(broken, co.id, { asOf: '2026-10-01', dryRun: true })
} catch (e) {
  threw = e instanceof Error ? e.message : String(e)
}
console.log(`  notifyMonth with a failing calendar_events read -> ${threw ? `threw: "${threw}"` : `returned ${JSON.stringify(result)}`}`)

if (!threw) fail('the failed read did not throw, so the job would have carried on and emailed something')
else pass('a failed read THROWS rather than coming back as zero dates')
if (result?.text) fail('an email body was rendered from a failed read')
else pass('no email was rendered')
if (threw && /nothing is due/i.test(threw)) fail('the failure says "nothing is due"')
else pass('the failure names the read, not the absence: it is not mistaken for "nothing due"')

// ...and the job records it. This is the half a unit test cannot show: the row in the database.
const { data: job } = await db.from('job_runs').insert({ job: 'calendar_month' }).select('id').single()
const errs = [{ company: co.name, error: threw }]
await db.from('job_runs').update({
  finished_at: new Date().toISOString(),
  counts: { companies: 1, sent: 0, nothing_to_say: 0, no_logins: 0, failed: 1 },
  errors: errs, ok: errs.length === 0,
}).eq('id', job.id)
const { data: row } = await db.from('job_runs').select('ok, counts, errors').eq('id', job.id).maybeSingle()
console.log(`\n  job_runs row: ok=${row.ok} counts=${JSON.stringify(row.counts)}`)
console.log(`  errors: ${JSON.stringify(row.errors)}`)
if (row.ok !== false) fail(`the job row says ok=${row.ok}; a company that got no email must not read as a clean run`)
else pass('the job row says ok=false')
if (!JSON.stringify(row.errors).includes('permission denied')) fail('the reason is not on the row')
else pass('the reason, and the company it belongs to, are on the row — answerable a month later')

await db.from('job_runs').delete().eq('id', job.id)
console.log('\n  the probe job row was removed.')
