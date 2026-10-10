// FIX LIST 8 (B3): does "Files reviewed" still count a document whose LATEST reading failed?
//
// *** ON TODAY'S STAGING DATA THE OLD RULE AND THE NEW ONE AGREE (12 and 12). *** That is exactly
// why this script exists: a fix that changes no number today is a fix nobody has seen work, and
// "the counts match" would be reported as proof when it is the absence of a test. So the state is
// BUILT — one document, a good reading, then a failed re-read on top — and the view is asked.
//
// Throwaway company, deleted at the end and on any crash (A3's replay left two behind once).
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

let companyId = null
const clean = async () => { if (companyId) { await db.from('companies').delete().eq('id', companyId); companyId = null } }
process.on('uncaughtException', async (e) => { await clean(); console.error(e); process.exit(1) })
process.on('unhandledRejection', async (e) => { await clean(); console.error(e); process.exit(1) })

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const co = must(await db.from('companies').insert({ name: 'B3 readable-count probe' }).select('id').single(), 'company')
companyId = co.id
const doc = must(await db.from('documents').insert({
  company_id: companyId, name: 'air-permit.pdf', file_type: 'application/pdf',
  file_url: `${companyId}/air-permit.pdf`, source: 'upload', status: 'read',
}).select('id').single(), 'document')

// THE ORDER THE PRODUCT USES: clear the old current reading first, then insert the new one
// (`lib/documentScan.ts:777`). Copied rather than invented — a stand-in that marks two readings
// current at once is a stand-in testing a shape the product never makes, and this run produced
// exactly that until the line was read.
const scan = async (status, when) => (
  await db.from('document_scans').update({ is_current: false }).eq('document_id', doc.id),
  must(await db.from('document_scans').insert({
  company_id: companyId, document_id: doc.id, status,
  title: status === 'could_not_read' ? null : 'Air Contaminant Discharge Permit',
  kind: status === 'could_not_read' ? null : 'permit',
  scanned_at: when,
}).select('id, status, scanned_at, is_current').single(), `scan ${status}`))

const look = async (tag) => {
  const r = must(await db.from('document_index_v')
    .select('display_status, readable_scan_id, scan_id, title')
    .eq('company_id', companyId).single(), 'view')
  const oldRule = r.display_status !== 'could_not_read'
  const newRule = r.readable_scan_id !== null
  console.log(`\n${tag}`)
  console.log(`   display_status    : ${r.display_status}`)
  console.log(`   title             : ${r.title ?? '(none)'}`)
  console.log(`   readable_scan_id  : ${r.readable_scan_id ? 'set' : 'NULL'}`)
  console.log(`   OLD rule counts it: ${oldRule ? 'yes' : 'NO'}   <- display_status !== 'could_not_read'`)
  console.log(`   NEW rule counts it: ${newRule ? 'yes' : 'NO'}   <- readable_scan_id is not null`)
  return { oldRule, newRule }
}

// `is_current` is left to the database: whatever marks the newest reading current in production
// must mark it current here, or the probe tests a shape the product never makes.
const first = await scan('recorded', '2026-10-01T10:00:00Z')
console.log(`   (first reading is_current=${first.is_current})`)
const a = await look('1. READ ONCE, SUCCESSFULLY — both rules must say yes, or the probe is blind (R2)')

const second = await scan('could_not_read', '2026-10-08T10:00:00Z')
console.log(`   (second reading is_current=${second.is_current})`)
const b = await look('2. RE-READ FAILS (a rate limit, a locked PDF) — the document is unchanged on disk')

console.log('\n' + '='.repeat(78))
if (a.oldRule && a.newRule && !b.oldRule && b.newRule) {
  console.log('FIX LIST 8 CLOSED. The old rule dropped a well-read document out of "Files reviewed"')
  console.log('the moment one re-read failed; the new rule keeps it, because we HAVE read it.')
} else {
  console.log(`UNEXPECTED: ${JSON.stringify({ a, b })}`)
  await clean(); process.exit(1)
}
await clean()
console.log('Probe company deleted.')
