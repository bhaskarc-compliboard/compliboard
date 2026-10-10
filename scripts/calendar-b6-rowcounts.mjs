// GATE PART 2 — ROW COUNTS PER SECTION, as the signed-in CALLER and as the SERVICE ROLE.
//
// Why both: a grant, a policy and a route guard are all invisible to `service_role`, so a count
// taken only that way would miss a change that broke reading for every real customer
// (`CLAUDE.md` §9a). And a count taken only as the caller cannot tell "the policy hides it" from
// "the row is gone". The two together say which.
//
// A difference this job's own writes do not explain is a STOP.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const user = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: signIn, error: signErr } = await user.auth.signInWithPassword({
  email: 'testcascade@example.com', password: process.env.CHECK_LIVE_PASSWORD,
})
if (signErr) { console.error(`could not sign in: ${signErr.message}`); process.exit(1) }
const caller = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
})

const SECTIONS = {
  'Calendar':            ['calendar_events', 'document_deadlines'],
  'Documents':           ['documents', 'document_scans', 'document_gaps', 'document_batches'],
  'Audits':              ['audit_runs', 'audit_findings', 'audit_run_sections'],
  'HR':                  ['handbooks', 'handbook_sections', 'handbook_checks', 'handbook_check_sections'],
  // `turns` is the Workspace's messages table. The name `topic_messages` was wrong from B6 and
  // nothing said so, because a missing table counted as zero.
  'Workspace':           ['topics', 'turns', 'checklists', 'checklist_items'],
  'Company information': ['companies', 'entities', 'profiles'],
  'Jobs and cost':       ['job_runs', 'ai_calls'],
}

const rows = []
for (const [section, tables] of Object.entries(SECTIONS)) {
  for (const t of tables) {
    const one = async (db) => {
      const { count, error } = await db.from(t).select('*', { count: 'exact', head: true })
      // *** AN ERROR IS NOT A ZERO *** (R2). A count that could not be taken is printed as ERR, so
      // a permission that broke can never be read as "the table emptied".
      if (error) return `ERR ${error.code ?? ''}`.trim()
      // *** AND NEITHER IS A NULL COUNT. *** A table that does not exist comes back `count: null`
      // with NO error from PostgREST, so this printed a confident `0` for `topic_messages` — a
      // table this product has never had — from B6 until Calendar C5 looked at it. The gate's own
      // script had the failure the gate exists to catch.
      if (count === null) return 'NO TABLE'
      return String(count)
    }
    rows.push([section, t, await one(caller), await one(svc)])
  }
}

const w = (i) => Math.max(...rows.map((r) => r[i].length), ['section', 'table', 'caller', 'service role'][i].length)
const line = (r) => `| ${r[0].padEnd(w(0))} | ${r[1].padEnd(w(1))} | ${r[2].padStart(w(2))} | ${r[3].padStart(w(3))} |`
console.log(line(['section', 'table', 'caller', 'service role']))
console.log(`|${'-'.repeat(w(0) + 2)}|${'-'.repeat(w(1) + 2)}|${'-'.repeat(w(2) + 2)}|${'-'.repeat(w(3) + 2)}|`)
for (const r of rows) console.log(line(r))

const blind = rows.filter((r) => r[2].startsWith('ERR'))
console.log(`\ncaller could not read: ${blind.length ? blind.map((r) => r[1]).join(', ') : 'nothing — every table readable'}`)
