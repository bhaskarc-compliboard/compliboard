/**
 * A3's LIVE HALF: ONE "Read it again" through the real route, to prove the live path reaches the
 * calendar step. One reading, on Haiku, through `npm run haiku -- …`'s server on 3998.
 *
 * The replay (`scripts/calendar-a3-replay.mjs`) already proved the BEHAVIOUR against real wording
 * drift, for free. This proves only the WIRING: that `POST /api/document-scan` — not just `saveScan`
 * called directly — ends with dates on the calendar. The background sweep shares the same function,
 * and that is asserted from the code rather than paid for twice.
 *
 *   node --env-file=.env.local scripts/calendar-a3-live.mjs
 */
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.A3_BASE ?? 'http://localhost:3998'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const pub = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: s, error } = await pub.auth.signInWithPassword({
  email: 'testcascade@example.com', password: process.env.CHECK_LIVE_PASSWORD,
})
if (error) { console.error('sign-in failed:', error.message); process.exit(1) }
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session.access_token}` }
const { data: prof } = await pub.from('profiles').select('company_id').eq('id', s.user.id).maybeSingle()
const companyId = prof.company_id
console.log(`\n  signed in as testcascade, company ${companyId.slice(0, 8)}, server ${BASE}`)

// The fixture with DATED deadlines and the two-on-one-day pair.
const NAME = '11-fire-extinguisher-certificate.pdf'
const { data: doc } = await admin.from('documents')
  .select('id, name').eq('company_id', companyId).eq('name', NAME).maybeSingle()
if (!doc) { console.error(`  ${NAME} is not on staging for this company`); process.exit(1) }
console.log(`  document ${doc.id.slice(0, 8)} — ${doc.name}`)

const show = async (when) => {
  const { data } = await admin.from('calendar_events')
    .select('title, due_date, state, counts_as_due, line_verified, document_deadline_id')
    .eq('company_id', companyId).eq('document_id', doc.id).order('due_date')
  console.log(`\n  ── this document's calendar rows ${when} — ${data.length}`)
  for (const r of data) {
    console.log(`     ${String(r.state).padEnd(14)}${String(r.due_date ?? '—').padEnd(12)}`
      + `due?=${String(r.counts_as_due).padEnd(6)}line=${String(r.line_verified ?? '—').padEnd(6)}${r.title.slice(0, 52)}`)
  }
  return data
}

const before = await show('BEFORE the live read')

console.log(`\n  POST ${BASE}/api/document-scan  { document_id }  — ONE model call, on Haiku`)
const t0 = Date.now()
const res = await fetch(`${BASE}/api/document-scan`, {
  method: 'POST', headers: auth, body: JSON.stringify({ document_id: doc.id }),
})
const json = await res.json().catch(() => ({}))
console.log(`  -> ${res.status} in ${Math.round((Date.now() - t0) / 1000)}s   status ${json.status ?? json.error ?? '?'}`)
console.log(`     scan ${String(json.scan_id ?? '').slice(0, 8)}  deadlines in the answer: ${json.deadlines?.length ?? '(not returned)'}`)

const after = await show('AFTER the live read')

// What the ledger says this cost, read from the database rather than guessed.
const { data: calls } = await admin.from('ai_calls')
  .select('task, model, cost_usd, searches, created_at').eq('company_id', companyId)
  .gte('created_at', new Date(t0 - 5000).toISOString()).order('created_at')
console.log(`\n  ai_calls written by this run: ${calls?.length ?? 0}`)
for (const c of calls ?? []) console.log(`     ${c.task} · ${c.model} · $${Number(c.cost_usd).toFixed(6)} · ${c.searches} search(es)`)

const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1 }
console.log('')
if (res.status !== 200) fail(`the route answered ${res.status}`)
else pass('the live route answered 200')
if (!after.length) fail('the live path reached no calendar row — the calendar step did not run')
else pass(`the LIVE path put ${after.length} date(s) on the calendar (it was ${before.length} before)`)
if (after.some((r) => r.document_deadline_id === null)) fail('a date has no deadline link, so it could never be withdrawn')
else pass('every date carries its document_deadline_id (decision 4 can find them)')
const dupes = after.filter((r, i) => after.findIndex((o) => o.due_date === r.due_date && o.title === r.title) !== i)
if (dupes.length) fail(`${dupes.length} duplicate row(s)`)
else pass('no duplicates')
