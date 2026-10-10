/**
 * D2 — A LABEL A PERSON RENAMED, DELETED BY THE NEXT TIDY-UP.
 *
 * Fix list item 55, severity 1, root R6 (`docs/FIX-LIST-FAILURES.md`), Job E1, and one fix with L1.
 *
 * **The failure.** `app/api/company-labels/route.ts` writes a rename into `document_corrections` and
 * `company_labels` and **never into a scan** — on purpose: a reading is what the reading said, and a
 * person's correction is a separate, newer fact (`document_corrections`' own note: *"the scan row is
 * never edited, so what the model said stays readable and a re-scan cannot undo a person"*).
 * `pruneOrphanLabels` read raw `document_scans`, which carry no corrections. So after a rename the
 * old name was gone from `company_labels` and the new name appeared in no scan — and the next delete
 * of **any** document, which is when pruning runs, deleted the renamed label. The company lost that
 * agency from "audit everything" immediately after telling us what to call it.
 *
 * **Free: no model is called.** A stored real-model reading replayed through `saveScan`
 * (`linkLedger: false`), and the rename is the two writes the route makes, named below.
 *
 * *** RUN IT TWICE. *** `--old` asserts nothing and just prints, so the same script runs against the
 * shipped `lib/companyLabels.ts` to make the failure happen, and then against the fix.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/fixlist-d2-rename.mjs [--old]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { saveScan, failedScan } from '../lib/documentScan.ts'
import { pruneOrphanLabels } from '../lib/companyLabels.ts'

const OLD = process.argv.includes('--old')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const DIR = 'tests/golden/documents/runs/real-model/02-acdp-chemical'
const stored = JSON.parse(readFileSync(`${DIR}/${readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().pop()}`, 'utf8'))

const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.error(`  ✗ ${m}`); if (!OLD) process.exitCode = 1 }
const note = (m) => console.log(`  · ${m}`)

const { data: co } = await db.from('companies')
  .insert({ name: `D2 rename ${new Date().toISOString().slice(0, 19)}` }).select('id').single()
async function cleanUp() {
  await db.from('calendar_events').delete().eq('company_id', co.id)
  await db.from('companies').delete().eq('id', co.id)
}
process.on('uncaughtException', async (e) => { console.error(e); await cleanUp(); process.exit(1) })
process.on('unhandledRejection', async (e) => { console.error(e); await cleanUp(); process.exit(1) })

const newDoc = async (name) => (await db.from('documents').insert({
  company_id: co.id, name, file_url: `${co.id}/${name}`, file_type: 'application/pdf',
}).select('id').single()).data

const labelsNow = async () => (await db.from('company_labels')
  .select('kind, label').eq('company_id', co.id).order('label')).data.map((l) => `${l.kind}:${l.label}`)

/** What an audit of everything would audit — `lib/audit.ts`'s own source for that list. */
const { auditAgenciesFor } = await import('../lib/audit.ts')

/**
 * THE RENAME, as `app/api/company-labels/route.ts` PATCH does it (`:108` and `:130`–`:136`): a
 * correction row per carrying document, the old vocabulary row deleted, the new one inserted. No
 * scan is touched, which is the point of the whole item.
 */
async function renameAsTheRouteDoes(kind, from, to) {
  const { data: carrying } = await db.from('document_index_v')
    .select('document_id, agencies, subjects').eq('company_id', co.id)
  const field = kind === 'agency' ? 'agencies' : 'subjects'
  let written = 0
  for (const d of carrying.filter((d) => (d[field] ?? []).includes(from))) {
    const before = d[field]
    const after = [...new Set(before.map((x) => (x === from ? to : x)))]
    await db.from('document_corrections').insert({
      document_id: d.document_id, company_id: co.id, field,
      old_value: before, new_value: after, reason: 'renamed by a person', created_by: null,
    })
    written++
  }
  await db.from('company_labels').delete().eq('company_id', co.id).eq('kind', kind).eq('label', from)
  await db.from('company_labels').upsert({ company_id: co.id, kind, label: to },
    { onConflict: 'company_id,kind,label' })
  return written
}

console.log(`\n  ${'='.repeat(78)}`)
console.log(`  D2 — ${OLD ? 'THE SHIPPED CODE (no assertions: making the failure happen)' : 'THE FIX'}`)
console.log(`  ${'='.repeat(78)}`)

// An air permit, read well. Its reading names the agency the way the model wrote it.
const doc = await newDoc('acdp-permit.pdf')
const reading = {
  ...stored.scan,
  identity: { ...stored.scan.identity, agencies: ['Oregon DEQ'], subjects: ['Air quality'] },
  status: 'current',
}
await saveScan(db, reading, { documentId: doc.id, companyId: co.id, linkLedger: false })
note(`the reading names: agencies=${JSON.stringify(reading.identity.agencies)} `
  + `subjects=${JSON.stringify(reading.identity.subjects)}`)
console.log(`     the company's vocabulary: ${(await labelsNow()).join(' · ')}`)

// The person renames it — the ordinary case: the model's short form, written out properly.
const touched = await renameAsTheRouteDoes('agency', 'Oregon DEQ',
  'Oregon Department of Environmental Quality')
note(`a person renames "Oregon DEQ" → "Oregon Department of Environmental Quality" `
  + `(${touched} document corrected)`)
console.log(`     the company's vocabulary: ${(await labelsNow()).join(' · ')}`)

const { data: idx } = await db.from('document_index_v')
  .select('agencies').eq('document_id', doc.id).maybeSingle()
const { data: raw } = await db.from('document_scans')
  .select('agencies').eq('document_id', doc.id).eq('is_current', true).maybeSingle()
console.log(`\n  and this is the whole of it:`)
console.log(`     document_index_v.agencies  (corrections applied) = ${JSON.stringify(idx.agencies)}`)
console.log(`     document_scans.agencies    (the raw reading)     = ${JSON.stringify(raw.agencies)}`)

// THE EVENT THAT TRIGGERS PRUNING IN THE PRODUCT: any other document deleted
// (`app/api/documents/route.ts:302`).
const spare = await newDoc('spare.pdf')
await db.from('documents').delete().eq('id', spare.id)
const pruned = await pruneOrphanLabels(db, co.id)
note(`pruneOrphanLabels after a document delete: removed ${pruned.removed}`
  + `${pruned.labels.length ? ` — ${pruned.labels.join(' · ')}` : ''}`
  + `${pruned.error ? ` (error: ${pruned.error})` : ''}`)
const after = await labelsNow()
console.log(`     the company's vocabulary: ${after.join(' · ') || '(none)'}`)

const agencies = await auditAgenciesFor(db, co.id)
console.log(`     "audit everything" would audit: ${agencies.length ? agencies.join(' · ') : '(nothing)'}`)

console.log('')
if (!after.includes('agency:Oregon Department of Environmental Quality')) {
  fail('the renamed agency was pruned — the company lost it from "audit everything" right after '
    + 'telling us what to call it')
} else pass('the renamed agency survives a document delete')
if (!agencies.includes('Oregon Department of Environmental Quality')) {
  fail('"audit everything" no longer audits that agency')
} else pass('"audit everything" still audits it, under its new name')

// ---- AND THE PRUNE MUST STILL PRUNE. §9a: show it seeing a presence first. ----
// A label from a fixture nothing carries — the `Test Gamma Solvents` case in the header of
// `lib/companyLabels.ts`, which is why this function exists at all.
console.log(`\n  and a label NO document carries, which must still go:`)
await db.from('company_labels').upsert([
  { company_id: co.id, kind: 'agency', label: 'Washington State Department of Health' },
  { company_id: co.id, kind: 'subject', label: 'Food service' },
], { onConflict: 'company_id,kind,label' })
console.log(`     the company's vocabulary: ${(await labelsNow()).join(' · ')}`)
const p2 = await pruneOrphanLabels(db, co.id)
note(`pruneOrphanLabels: removed ${p2.removed}${p2.labels.length ? ` — ${p2.labels.join(' · ')}` : ''}`)
const after2 = await labelsNow()
console.log(`     the company's vocabulary: ${after2.join(' · ')}`)
if (p2.removed !== 2) {
  fail(`the prune removed ${p2.removed} of the 2 labels no document carries — a fix that pruned `
    + 'nothing would be no fix, and would have passed every check above')
} else pass('the two labels no document carries are still pruned')
if (!after2.includes('agency:Oregon Department of Environmental Quality')) {
  fail('...but it took the renamed one with them')
} else pass('...and the renamed one is still there')

// ---- L1, IN THE SAME READ: a failed re-read must not make a label an orphan ----
console.log(`\n  L1, through the same read — the permit is re-read and the service refuses:`)
await saveScan(db, failedScan('refused', 'try again'),
  { documentId: doc.id, companyId: co.id, linkLedger: false })
const spare2 = await newDoc('spare2.pdf')
await db.from('documents').delete().eq('id', spare2.id)
const p3 = await pruneOrphanLabels(db, co.id)
const after3 = await labelsNow()
note(`pruneOrphanLabels after the FAILED re-read: removed ${p3.removed}`
  + `${p3.labels.length ? ` — ${p3.labels.join(' · ')}` : ''}`)
console.log(`     the company's vocabulary: ${after3.join(' · ') || '(none)'}`)
if (!after3.includes('agency:Oregon Department of Environmental Quality')) {
  fail('a failed re-read made the renamed agency an orphan and it was deleted')
} else pass('a failed re-read leaves the vocabulary alone (L1, and the rename survives with it)')

console.log(`\n  ${'='.repeat(78)}`)
await cleanUp()
console.log(`  cleaned up.`)
