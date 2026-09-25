#!/usr/bin/env node
// THE DOCUMENT SCAN, ON ONE FILE — Documents Run 1.
//
//   npm run scan -- <path-to-file>                  upload it to staging, then scan it
//   npm run scan -- <path> --times 3                scan it three times and compare
//   npm run scan -- --document <id> --times 2       re-scan a document already on staging
//   npm run scan -- <path> --quiet                  the tables only, not the whole JSON
//
// *** STAGING ONLY, BY CONSTRUCTION. *** It reads NEXT_PUBLIC_SUPABASE_URL, which on a developer
// machine is staging (`CLAUDE.md` §3.8), and it refuses to run if that URL is the production ref.
// There is no flag that points it at production and adding one would be the bug.
//
// It costs real money: one model call per scan, search on and uncapped as in production.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { runDocumentScan, saveScan, buildScanContext } from '../lib/documentScan.ts'
import { estimateCost } from '../lib/costLedger.ts'

const PROD_REF = 'dsfwmafnphdlfogetsus'
const args = process.argv.slice(2)
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const times = Number(flag('--times', '1'))
const docArg = flag('--document', null)
const quiet = has('--quiet')
const filePath = args.find((a) => !a.startsWith('--') && a !== String(times) && a !== docArg)

const die = (m) => { console.error(`\n  ${m}\n`); process.exit(1) }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) die('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (staging).')
if (url.includes(PROD_REF)) die('That URL is PRODUCTION. This script is staging-only and there is no flag to change that.')
if (!process.env.ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY is not set.')
if (!Number.isInteger(times) || times < 1) die('--times must be a positive integer.')
if (!filePath && !docArg) die('Give a file path, or --document <id> to re-scan one already on staging.')
if (filePath && !existsSync(filePath)) die(`No such file: ${filePath}`)

const db = createClient(url, key, { auth: { persistSession: false } })

// The staging test company. testgamma is the empty one — chemical manufacturing, Oregon.
const { data: prof } = await db.from('profiles').select('company_id, id').limit(1).maybeSingle()
const { data: gamma } = await db.from('companies').select('id, name, industry, city, state')
  .ilike('name', '%gamma%').maybeSingle()
const company = gamma ?? (await db.from('companies').select('id, name, industry, city, state').limit(1).maybeSingle()).data
if (!company) die('No company on staging to scan for.')
const { data: anyProfile } = await db.from('profiles').select('id').eq('company_id', company.id).limit(1).maybeSingle()
const userId = anyProfile?.id ?? prof?.id

console.log(`\n  Target   : ${url.replace(/https:\/\/([^.]+).*/, '$1')} (staging)`)
console.log(`  Company  : ${company.name}`)
console.log(`  Model    : ${process.env.AI_MODEL_DOCUMENT_SCAN || process.env.AI_MODEL_JUDGEMENT || process.env.AI_MODEL || '(judgement tier default)'}`)
console.log(`  Searches : ${process.env.DEV_MAX_SEARCHES ? `capped at ${process.env.DEV_MAX_SEARCHES} (DEV_MAX_SEARCHES)` : 'uncapped, as in production'}`)

// ---- the document row -----------------------------------------------------------------
let documentId = docArg
let fileBuf, fileName, fileType
if (docArg) {
  const { data: doc } = await db.from('documents').select('*').eq('id', docArg).maybeSingle()
  if (!doc) die(`No document ${docArg} on staging.`)
  if (doc.company_id !== company.id) die('That document belongs to another company.')
  const { data: blob, error } = await db.storage.from('company-documents').download(doc.file_url)
  if (error || !blob) die(`Could not download ${doc.file_url}: ${error?.message}`)
  fileBuf = await blob.arrayBuffer(); fileName = doc.name; fileType = doc.file_type
  console.log(`  Document : ${doc.id} — ${doc.name} (re-scan)`)
} else {
  const bytes = readFileSync(filePath)
  fileName = basename(filePath)
  const ext = extname(fileName).slice(1).toLowerCase()
  fileType = ext === 'pdf' ? 'application/pdf'
    : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : ext === 'csv' ? 'text/csv' : ext === 'txt' ? 'text/plain'
    : ['png','jpg','jpeg','gif','webp'].includes(ext) ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
    : 'application/octet-stream'
  const path = `${company.id}/scan-run1/${Date.now()}-${fileName.replace(/[^\w.\-]/g, '_')}`
  const { error: up } = await db.storage.from('company-documents').upload(path, bytes, { contentType: fileType })
  if (up) die(`Upload failed: ${up.message}`)
  const { data: row, error: ins } = await db.from('documents').insert({
    company_id: company.id, user_id: userId, name: fileName, file_url: path,
    file_type: fileType, file_size: bytes.length, source: 'upload', status: 'uploaded',
  }).select('id').single()
  if (ins) die(`documents insert failed: ${ins.message}`)
  documentId = row.id
  fileBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  console.log(`  Document : ${documentId} — ${fileName} (${bytes.length} bytes, uploaded)`)
}

// ---- the context the model is given ------------------------------------------------------
// *** BUILT INSIDE THE LOOP, ONCE PER RUN. *** It used to be built once, here, before the loop —
// so with `--times 3` run 2 was shown the label list as it stood BEFORE run 1 wrote to it, and
// the per-company label list could not do the one job it exists for. Measured on 25 September:
// run 1 of a batch wrote "Oregon DEQ" and run 2, never having been shown it, wrote
// "Oregon Department of Environmental Quality" — two groups on the customer's screen for one
// agency, which is exactly the trap the prompt's reuse sentence is there to prevent.
// `buildScanContext` also orders every query, so the same state gives the same prompt_sha256.

// ---- run ------------------------------------------------------------------------------
const runs = []
for (let i = 1; i <= times; i++) {
  const context = await buildScanContext(db, company, documentId)
  if (i === 1) {
    console.log(`  Context  : ${context.sites.length} site(s), ${context.agencyLabels.length} agency label(s), `
      + `${context.subjectLabels.length} subject label(s), ${context.existingDocuments.length} document(s) on file, `
      + `${context.dismissedGaps.length} dismissed gap(s), ${context.openGaps.length} open gap(s) it can name  — rebuilt before every run\n`)
  }
  const t0 = Date.now()
  const scan = await runDocumentScan({ buffer: fileBuf, fileName, fileType, companyId: company.id, context })
  const wall = Date.now() - t0
  const { scanId, aiCallId } = await saveScan(db, scan, { documentId, companyId: company.id })

  const { data: call } = aiCallId
    ? await db.from('ai_calls').select('*').eq('id', aiCallId).maybeSingle() : { data: null }

  console.log(`  ${'═'.repeat(86)}`)
  console.log(`  RUN ${i} of ${times}   ${(wall / 1000).toFixed(1)}s   scan ${scanId}`)
  console.log(`  ${'═'.repeat(86)}`)
  if (!quiet) console.log(JSON.stringify({
    identity: scan.identity, summary: scan.summary, status: scan.status,
    significant_date: scan.significant_date, significant_date_kind: scan.significant_date_kind,
    freshness_note: scan.freshness_note, gaps: scan.gaps, conditions: scan.conditions,
    deadlines: scan.deadlines, facts: scan.facts, version_of: scan.version_of,
    expected_missing: scan.expected_missing, confidence_notes: scan.confidence_notes,
    could_not_read: scan.could_not_read,
  }, null, 2))

  console.log(`\n  COST ROW`)
  if (!call) console.log(`    (no ai_calls row found — the model was not called)`)
  else console.log(`    model ${call.model}  in ${call.input_tokens}  out ${call.output_tokens}  ` +
    `searches ${call.searches}  ${(call.wall_ms / 1000).toFixed(1)}s  ` +
    `$${call.cost_usd === null ? 'UNPRICED' : Number(call.cost_usd).toFixed(5)}`)

  console.log(`  QUOTES`)
  console.log(`    ${scan.quotes_verified} of ${scan.quotes_checked} checked quotes found word-for-word in the extracted text` +
    `${scan.extracted_text ? '' : '  (no extractable text — a PDF goes to the model whole, so quotes are unverifiable here, not false)'}`)
  console.log(`  JSON parsed: ${scan.json_parsed}${scan.json_parsed ? '' : '  — raw text kept on the scan row'}\n`)

  runs.push({ i, scan, call, wall })
}

// ---- variance --------------------------------------------------------------------------
if (times > 1) {
  const f = (r) => ({
    kind: r.scan.identity.kind, title: r.scan.identity.title, issuer: r.scan.identity.issuer,
    agencies: r.scan.identity.agencies.join('|'), subjects: r.scan.identity.subjects.join('|'),
    site: r.scan.identity.site, jurisdiction: r.scan.identity.jurisdiction.join('|'),
    doc_date: r.scan.identity.doc_date, doc_date_kind: r.scan.identity.doc_date_kind,
    status: r.scan.status, significant_date: r.scan.significant_date,
    gaps: r.scan.gaps.length, conditions: r.scan.conditions.length,
    deadlines: r.scan.deadlines.length, facts: r.scan.facts.length,
    expected_missing: r.scan.expected_missing.length,
    version_of: r.scan.version_of.title, searches: r.call?.searches ?? null,
    cost: r.call?.cost_usd == null ? null : Number(r.call.cost_usd).toFixed(5),
  })
  const rows = runs.map(f)
  const keys = Object.keys(rows[0])
  console.log(`  ${'═'.repeat(86)}`)
  console.log(`  VARIANCE ACROSS ${times} RUNS — a field is listed only when the runs disagreed`)
  console.log(`  ${'═'.repeat(86)}`)
  let differed = 0
  for (const k of keys) {
    const vals = rows.map((r) => String(r[k]))
    if (new Set(vals).size === 1) continue
    differed++
    console.log(`  ~ ${k}`)
    vals.forEach((v, n) => console.log(`      run ${n + 1}: ${v.length > 96 ? v.slice(0, 96) + '…' : v}`))
  }
  const same = keys.filter((k) => new Set(rows.map((r) => String(r[k]))).size === 1)
  console.log(`\n  ${differed} field(s) differed, ${same.length} identical across all ${times} runs.`)
  console.log(`  identical: ${same.join(', ')}\n`)
}
