/**
 * A7 part 2 — ROW COUNTS PER SECTION, TWICE: as the signed-in caller (RLS applies) and as the service
 * role (RLS does not). `docs/HOW-WE-BUILD.md` §3: a read that is too narrow returns FEWER rows with a
 * 200, so the only thing that catches a silent narrowing is the pair of numbers side by side.
 *
 * Read-only. No model is called. Staging only — it reads the keys in `.env.local`, which §3.8 requires
 * to be staging's.
 *
 *   node --env-file=.env.local scripts/calendar-rowcounts.mjs [--json <file>]
 *
 * `document_index_v` is a view and `topics` is split by `section`, because a count that mixes the
 * workspace's conversations with HR's cannot show which section moved.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.CHECK_LIVE_PASSWORD
if (!url || !anon || !service) { console.error('REFUSED: staging url, anon key and service key must all be set.'); process.exit(1) }
if (!password) { console.error('REFUSED: CHECK_LIVE_PASSWORD is not set; this script signs in as the fixtures.'); process.exit(1) }

const PEOPLE = ['testalpha@example.com', 'testgamma@example.com', 'testcascade@example.com']

/** Each row: the label printed, the table or view, and an extra filter where one section shares a table. */
const TABLES = [
  ['topics (workspace)', 'topics', (q) => q.eq('section', 'workspace')],
  ['topics (hr)', 'topics', (q) => q.eq('section', 'hr')],
  ['turns', 'turns'],
  ['documents', 'documents'],
  ['document_scans', 'document_scans'],
  ['document_deadlines', 'document_deadlines'],
  ['document_index_v', 'document_index_v'],
  ['fact_proposals', 'fact_proposals'],
  ['company_facts', 'company_facts'],
  ['audit_runs', 'audit_runs'],
  ['audit_sections', 'audit_sections'],
  ['audit_findings', 'audit_findings'],
  ['handbooks', 'handbooks'],
  ['handbook_checks', 'handbook_checks'],
  ['calendar_events', 'calendar_events'],
]

const admin = createClient(url, service, { auth: { persistSession: false } })

/**
 * Counts one table for one company. `head: true` with `count: 'exact'` sends no rows back, so this is
 * cheap and the number is the server's own.
 *
 * *** AN ERROR IS NOT A ZERO. *** A query naming a column that does not exist comes back as an ERROR,
 * and a script that reads it as an empty result files the opposite of the truth (`CLAUDE.md` §9a, the
 * map's own 28 September lesson). So a failure is printed as `ERR:<code>` and never as 0.
 */
async function count(db, table, companyId, extra) {
  let q = db.from(table).select('*', { count: 'exact', head: true })
  // Every table in the list carries company_id; document_index_v exposes it too.
  q = q.eq('company_id', companyId)
  if (extra) q = extra(q)
  const { count: n, error } = await q
  if (error) return `ERR:${error.code ?? error.message.slice(0, 20)}`
  return n ?? 0
}

const out = {}
for (const email of PEOPLE) {
  const pub = createClient(url, anon, { auth: { persistSession: false } })
  const { data: s, error: e } = await pub.auth.signInWithPassword({ email, password })
  if (e) { console.error(`  could not sign in as ${email}: ${e.message}`); process.exit(1) }
  const token = s.session.access_token
  const asUser = createClient(url, anon, {
    auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: prof } = await asUser.from('profiles').select('company_id').eq('id', s.user.id).maybeSingle()
  const companyId = prof?.company_id
  if (!companyId) { console.error(`  ${email} has no company_id`); process.exit(1) }

  out[email] = { companyId, caller: {}, service: {} }
  for (const [label, table, extra] of TABLES) {
    out[email].caller[label] = await count(asUser, table, companyId, extra)
    out[email].service[label] = await count(admin, table, companyId, extra)
  }
}

const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)
for (const role of ['caller', 'service']) {
  console.log(`\n  ${role === 'caller' ? 'AS THE SIGNED-IN CALLER (RLS applies)' : 'AS THE SERVICE ROLE (RLS does not)'}`)
  console.log(`  ${pad('table', 22)}${PEOPLE.map((p) => lpad(p.replace('@example.com', ''), 14)).join('')}`)
  console.log(`  ${'-'.repeat(22 + 14 * PEOPLE.length)}`)
  for (const [label] of TABLES) {
    console.log(`  ${pad(label, 22)}${PEOPLE.map((p) => lpad(out[p][role][label], 14)).join('')}`)
  }
}

// Any cell where the caller sees fewer than the service role is the silent narrowing §3 is about.
const gaps = []
for (const p of PEOPLE) for (const [label] of TABLES) {
  const a = out[p].caller[label], b = out[p].service[label]
  if (a !== b) gaps.push(`${p.replace('@example.com', '')} · ${label}: caller ${a}, service ${b}`)
}
console.log(`\n  CALLER vs SERVICE ROLE: ${gaps.length === 0 ? 'identical on every table for every person.' : gaps.length + ' difference(s):'}`)
for (const g of gaps) console.log(`    ${g}`)

const jsonAt = process.argv.indexOf('--json')
if (jsonAt > -1 && process.argv[jsonAt + 1]) {
  writeFileSync(process.argv[jsonAt + 1], JSON.stringify(out, null, 2))
  console.log(`\n  written to ${process.argv[jsonAt + 1]}`)
}
