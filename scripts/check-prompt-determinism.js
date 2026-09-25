#!/usr/bin/env node
// DOES THE SAME STATE GIVE THE SAME PROMPT? — Documents Run 2b, step 4.
//
//   npm run check:determinism
//
// Builds the scan context for one company twice in a row, with nothing changed in between, and
// hashes the prompt each time. They must be the same string. Before `buildScanContext` ordered
// its queries they were not reliably: PostgREST returns rows in the order Postgres yields them
// when no ORDER BY is given, an UPDATE moves a row in the heap, and the label list and the
// "already holds" list are rendered into the prompt as lines. Reads only; no model call.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { buildScanContext } from '../lib/documentScan.ts'
import { scanPrompt } from '../prompts/document-scan.ts'

const PROD_REF = 'dsfwmafnphdlfogetsus'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const die = (m) => { console.error(`\n  ${m}\n`); process.exit(1) }
if (!url || !key) die('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (staging).')
if (url.includes(PROD_REF)) die('That URL is PRODUCTION. This command is staging-only.')

const db = createClient(url, key, { auth: { persistSession: false } })
const name = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'Cascade Specialty Chemicals, LLC'
const { data: co } = await db.from('companies').select('id, name, industry, city, state').eq('name', name).maybeSingle()
if (!co) die(`No company named "${name}" on staging.`)

const sha = (s) => createHash('sha256').update(s).digest('hex')
const a = await buildScanContext(db, co, null)
const b = await buildScanContext(db, co, null)
const ha = sha(scanPrompt(a)), hb = sha(scanPrompt(b))

console.log(`\n  company      : ${co.name}`)
console.log(`  context      : ${a.sites.length} site(s), ${a.agencyLabels.length} agency label(s), `
  + `${a.subjectLabels.length} subject label(s), ${a.existingDocuments.length} document(s) on file`)
console.log(`  agency labels: ${JSON.stringify(a.agencyLabels)}`)
console.log(`\n  build 1 prompt_sha256 : ${ha}`)
console.log(`  build 2 prompt_sha256 : ${hb}`)
console.log(`\n  ${ha === hb ? 'IDENTICAL — the same state gives the same prompt string.' : 'THEY DIFFER — the context is still not deterministic.'}\n`)
process.exit(ha === hb ? 0 : 1)
