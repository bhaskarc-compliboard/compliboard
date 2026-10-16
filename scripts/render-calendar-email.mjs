// THE MONTHLY EMAIL, RENDERED FROM REAL ROWS AND SENT NOWHERE — Calendar step 11, STOP 1.
//
//   node --env-file=.env.local scripts/render-calendar-email.mjs --company "Test Gamma Solvents" \
//     --month 2026-11 --out shots/calendar-11-email
//
// It writes `<out>.html` and `<out>.txt` and prints the subject and the counts. **It sends
// nothing and writes nothing to the database** — no claim, no mailing row, no Resend. It exists so
// "what does the email say" is answerable without putting mail in anybody's inbox, which is the
// same reason `dryRun` exists on the three sending paths.
//
// It calls no model, so it needs no guard; it reads as the service role because there is no
// session, exactly as the job does.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { calendarEmail } from '../lib/calendarEmail.ts'
import { renderEmail } from '../lib/email.ts'
import { liveDatesFor } from '../lib/calendarCounts.ts'
import { CALENDAR_VIEW_COLUMNS } from '../lib/calendarView.ts'

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : process.argv[i + 1]
}
const companyName = arg('--company', 'Test Gamma Solvents')
const month = arg('--month', new Date().toISOString().slice(0, 7))
const out = arg('--out', 'shots/calendar-11-email')
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.compliboard.com').replace(/\/+$/, '')

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const { data: co } = await admin.from('companies').select('id, name').eq('name', companyName).maybeSingle()
if (!co) { console.error(`no company named ${companyName}`); process.exit(1) }

const { data: rowData, error } = await liveDatesFor(admin, co.id, CALENDAR_VIEW_COLUMNS)
if (error) { console.error(`calendar_v: ${error.message}`); process.exit(1) }
const { count: siteCount } = await admin.from('entities')
  .select('id', { count: 'exact', head: true }).eq('company_id', co.id)
const { data: people } = await admin.from('profiles').select('id, full_name').eq('company_id', co.id)
const names = Object.fromEntries((people ?? []).filter((p) => p.full_name).map((p) => [p.id, p.full_name]))

// Who it WOULD go to, by the same rule the job uses: the login's address in auth.users.
const addresses = []
for (const p of people ?? []) {
  const { data: user } = await admin.auth.admin.getUserById(p.id)
  if (user?.user?.email) addresses.push(user.user.email)
}

const mail = calendarEmail({ company: co.name, month, rows: rowData ?? [], siteCount: siteCount ?? 0, appUrl, names })
const { html, text } = renderEmail(mail.shape)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(`${out}.html`, html)
writeFileSync(`${out}.txt`, text)

console.log(`\n  ${co.name} · ${month} · ${siteCount} site(s) · ${(rowData ?? []).length} live date(s)`)
console.log(`  subject: ${mail.subject}`)
console.log(`  due ${mail.counts.due.length} · early ${mail.counts.early.length} · passed ${mail.counts.passed.length} · no day yet ${mail.counts.undated.length}`)
console.log(`  would go to: ${addresses.join(', ') || '(nobody — no login on any profile)'}`)
console.log(`  written: ${out}.html and ${out}.txt\n`)
console.log(text)
