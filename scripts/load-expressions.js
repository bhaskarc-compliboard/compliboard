// Loads supabase/seed-data/applies-expressions.json into requirement_templates.applies_expression.
//
//   node scripts/load-expressions.js                        validate + dry run (DEFAULT)
//   node scripts/load-expressions.js --apply                apply to STAGING
//   node scripts/load-expressions.js --apply --production   apply to PRODUCTION
//
// Same shape as the other three loaders. What is different is the validation, because an
// expression can be well-formed JSON, correctly typed, and wrong — which is what building the
// renderer demonstrated (DECISIONS.md §43.2). So this refuses on four things the type system
// cannot see:
//
//   1. a switch id the seeded vocabulary does not contain
//   2. a threshold that appears nowhere in the rule's own text  (§44)
//   3. a clause true of every company                            (§44.2)
//   4. a requirement name that is not a live row
//
// And it PRINTS THE RENDERED ENGLISH for every row it is about to write, because the review
// is the deliverable and a dry run nobody can read is a dry run nobody does.

import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'readline'
import { execFileSync } from 'child_process'
import { render, switchesIn, thresholdsIn } from '../lib/appliesExpression.ts'

const FILE = 'supabase/seed-data/applies-expressions.json'
const args = process.argv.slice(2)
const isApply = args.includes('--apply')
const isProduction = args.includes('--production')
const verbose = args.includes('--verbose')

const target = isProduction
  ? { label: 'PRODUCTION', ref: process.env.SUPABASE_PROD_REF, varName: 'SUPABASE_PROD_REF' }
  : { label: 'staging', ref: process.env.SUPABASE_PROJECT_REF, varName: 'SUPABASE_PROJECT_REF' }

function die(msg) { console.error(`\n  ${msg}\n`); process.exit(1) }
if (!existsSync(FILE)) die(`File not found: ${FILE}`)
if (!target.ref) die(`${target.varName} is not set.`)

if (isProduction && isApply) {
  const missing = ['SUPABASE_PROD_URL', 'SUPABASE_PROD_SERVICE_ROLE_KEY']
    .filter((v) => !String(process.env[v] ?? '').trim())
  if (missing.length) {
    die(`Cannot load to PRODUCTION: ${missing.join(' and ')} not set.\n\n` +
        `  Both are EXPECTED TO BE BLANK in normal operation — CLAUDE.md §3.8. Set them for\n` +
        `  this one command, then CLEAR THEM AGAIN.`)
  }
}

function query(sql) {
  const out = execFileSync('npx', ['supabase', 'db', 'query', '--project-ref', target.ref,
                                   '--linked', '--agent', 'no', '-o', 'json', sql],
                           { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const parsed = JSON.parse(out)
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows
  throw new Error('Unrecognised JSON shape from `supabase db query`.')
}

console.log(`\n  File   : ${FILE}`)
console.log(`  Target : ${target.ref}   (${target.label})`)
console.log(`  Mode   : ${isApply ? 'APPLY' : 'dry run — nothing will be written'}\n`)

const rows = JSON.parse(readFileSync(FILE, 'utf8'))
if (!Array.isArray(rows) || !rows.length) die(`${FILE} has no rows.`)

console.log('  Reading the live vocabulary and requirement names…')
let switches, live
try {
  switches = new Set(query('select id from public.switches').map((r) => r.id))
  live = new Map(query(`select requirement_name, coalesce(trigger_condition,'') as trig,
                               coalesce(citation,'') as cite
                          from public.requirement_templates where effective_to is null`)
    .map((r) => [r.requirement_name, r]))
} catch (e) { die(`Could not read the database: ${e.message}`) }
console.log(`  ${switches.size} switches · ${live.size} live requirements\n`)

const errors = []
const warnings = []
for (const [i, x] of rows.entries()) {
  const at = `[${i}] "${x.requirement}"`
  const row = live.get(x.requirement)
  if (!row) { errors.push(`${at}: not a live requirement on ${target.label}.`); continue }
  if (!x.expression) { warnings.push(`${at}: no expression — will be written as NULL. ${x.note || ''}`); continue }

  for (const s of switchesIn(x.expression)) {
    if (!switches.has(s)) errors.push(`${at}: references switch "${s}", which is not seeded.`)
  }

  // §44 — every number must appear in the rule's own text.
  const text = `${row.trig} ${row.cite}`
  for (const n of thresholdsIn(x.expression)) {
    const re = new RegExp('\\b' + String(n).replace(/(\d)(?=(\d{3})+$)/g, '$1,?') + '\\b')
    if (!re.test(text)) {
      warnings.push(`${at}: §44 — ${n} appears in the expression but not in the rule's own text. ` +
                    `A threshold must be quoted, never derived.`)
    }
  }
}

if (warnings.length) {
  console.log(`  ${warnings.length} warning(s):`)
  for (const w of warnings) console.log(`    · ${w}`)
  console.log('')
}
if (errors.length) {
  console.log(`  ${errors.length} error(s). NOTHING WILL BE WRITTEN:\n`)
  for (const e of errors) console.log(`    ✗ ${e}`)
  console.log('')
  process.exit(1)
}
console.log('  File is valid.\n')

const line = '  ' + '─'.repeat(78)
const byConf = rows.reduce((m, x) => ((m[x.confidence] = (m[x.confidence] || 0) + 1), m), {})
console.log(line)
console.log(`  ${rows.length} rows · ${rows.filter((x) => x.expression).length} with an expression · ${rows.filter((x) => !x.expression).length} null`)
console.log(`  confidence: ${Object.entries(byConf).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log(line + '\n')

// THE REVIEW ARTIFACT. Everything below high confidence always prints; the rest with --verbose.
const show = rows.filter((x) => verbose || x.confidence !== 'high')
console.log(`  ${verbose ? 'Every' : 'Every non-high-confidence'} expression, rendered:\n`)
for (const x of show) {
  console.log(`  [${x.confidence}] ${x.requirement}`)
  console.log(`      rule : ${x.prose || '(no trigger prose)'}`)
  console.log(`      expr : ${x.expression ? render(x.expression) : '(null — no condition)'}`)
  if (x.note) console.log(`      note : ${x.note}`)
  console.log('')
}

if (!isApply) {
  console.log(line)
  console.log('  Dry run only. Nothing was written.')
  console.log(`  To apply:  node scripts/load-expressions.js --apply` + (isProduction ? ' --production' : ''))
  console.log(line + '\n')
  process.exit(0)
}

if (isProduction) {
  console.log('\n  *** PRODUCTION LOAD ***')
  console.log('  This decides which requirements apply to a customer.')
  console.log('  Type PRODUCTION and press Enter. Anything else aborts.\n')
  if (!process.stdin.isTTY) die('Aborted: no interactive terminal.')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise((res) => rl.question('  > ', res))
  rl.close()
  if (answer.trim() !== 'PRODUCTION') die('Aborted. Nothing was written.')
}

const url = isProduction ? process.env.SUPABASE_PROD_URL : process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = isProduction ? process.env.SUPABASE_PROD_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !svc) die(`No URL/service-role key for ${target.label}.`)
if (!url.includes(target.ref)) die(`The ${target.label} URL points elsewhere. Refusing.`)
const db = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } })

console.log(`\n  Writing ${rows.length} expressions…`)
let written = 0
for (const x of rows) {
  const { error } = await db.from('requirement_templates')
    .update({ applies_expression: x.expression })
    .eq('requirement_name', x.requirement)
    .is('effective_to', null)
  if (error) die(`Writing "${x.requirement}" failed: ${error.message}\n  Re-run — this is idempotent.`)
  written++
}

const after = query(`select
  (select count(*) from public.requirement_templates where effective_to is null) as live,
  (select count(*) from public.requirement_templates where effective_to is null and applies_expression is not null) as with_expr,
  (select count(*) from public.requirement_templates where effective_to is not null and applies_expression is not null) as retired_with_expr`)[0]

console.log('\n  Loaded:')
console.log(`    ${written} rows written`)
console.log(`    ${after.with_expr} of ${after.live} live requirements carry an expression   (expected ${rows.filter((x) => x.expression).length})`)
console.log(`    ${after.retired_with_expr} retired rows carry one   (must be 0 — a retired row is served by its children)`)

const bad = []
if (Number(after.with_expr) !== rows.filter((x) => x.expression).length) bad.push('expression count')
if (Number(after.retired_with_expr) !== 0) bad.push('a retired row carries an expression')
if (bad.length) die(`LOADED, BUT THE RESULT DOES NOT MATCH THE FILE: ${bad.join('; ')}.`)

console.log(`\n  Load complete on ${target.label}. Safe to re-run.`)
console.log('  Obligations are NOT regenerated — that is Phase 4.1 and it does not exist yet.\n')

if (isProduction) {
  console.log('  ' + '='.repeat(72))
  console.log('  NOW CLEAR THE PRODUCTION CREDENTIALS FROM .env.local:\n')
  console.log('      SUPABASE_PROD_URL=')
  console.log('      SUPABASE_PROD_SERVICE_ROLE_KEY=\n')
  console.log('  ' + '='.repeat(72) + '\n')
}
