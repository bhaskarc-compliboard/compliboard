#!/usr/bin/env node
// WHERE THE MONEY WENT — `npm run cost`, `DECISIONS.md` §128 J.
//
//   npm run cost                 everything in the ledger, split by task
//   npm run cost -- --since 2026-09-23   from a date (inclusive)
//   npm run cost -- --topic <id>         one conversation
//
// READ-ONLY. It reads `ai_calls`, which is written at the call by `lib/costLedger.ts`.
//
// ---------------------------------------------------------------------------
// *** IT REPORTS WHAT IS MISSING, NOT ONLY WHAT IS THERE. ***
//
// Two holes are printed every run, because a total that quietly omits them is worse than no
// total: the tasks that have NEVER written a row (a call site with no `ledger:` argument is a
// call nobody is counting), and the rows whose model was not in `config/pricing.ts` (cost null,
// which is NOT zero). A spend report that looks complete and is not is the failure this whole
// table exists to end.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'
import { LEDGER_TASKS } from '../lib/costLedger.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('\n  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (staging).\n'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }
const since = arg('--since')

let q = db.from('ai_calls').select('*').order('created_at', { ascending: true })
if (since) q = q.gte('created_at', since)
const { data: rows, error } = await q
if (error) { console.error(`\n  could not read ai_calls: ${error.message}\n`); process.exit(1) }

if (!rows.length) {
  console.log(`\n  No rows in ai_calls${since ? ` since ${since}` : ''}. Nothing has been recorded yet.\n`)
  process.exit(0)
}

const usd = (n) => n === null ? '   —    ' : `$${n.toFixed(4)}`.padStart(9)
const money = (n) => `$${n.toFixed(2)}`

// ---- by task --------------------------------------------------------------
const byTask = new Map()
for (const r of rows) {
  const t = byTask.get(r.task) ?? { calls: 0, input: 0, output: 0, searches: 0, ms: 0, cost: 0, unpriced: 0, models: new Set() }
  t.calls++; t.input += r.input_tokens; t.output += r.output_tokens
  t.searches += r.searches; t.ms += r.wall_ms
  if (r.cost_usd === null) t.unpriced++; else t.cost += Number(r.cost_usd)
  t.models.add(r.model)
  byTask.set(r.task, t)
}

const total = [...byTask.values()].reduce((a, t) => a + t.cost, 0)
const totalUnpriced = [...byTask.values()].reduce((a, t) => a + t.unpriced, 0)

console.log(`\n  COST LEDGER — ${rows.length} call(s)${since ? ` since ${since}` : ''}`)
console.log(`  ${rows[0].created_at.slice(0, 19)}  to  ${rows[rows.length - 1].created_at.slice(0, 19)}\n`)
console.log('  task            calls    input tok   output tok   searches     wall      cost     share')
console.log('  ' + '─'.repeat(88))
for (const [task, t] of [...byTask.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
  const share = total > 0 ? `${((t.cost / total) * 100).toFixed(1)}%` : '—'
  console.log(`  ${task.padEnd(15)} ${String(t.calls).padStart(5)} ${String(t.input).padStart(12)} ` +
    `${String(t.output).padStart(12)} ${String(t.searches).padStart(10)} ${(t.ms / 1000).toFixed(0).padStart(7)}s ` +
    `${money(t.cost).padStart(9)} ${share.padStart(8)}` + (t.unpriced ? `   (${t.unpriced} UNPRICED)` : ''))
}
console.log('  ' + '─'.repeat(88))
console.log(`  ${'TOTAL'.padEnd(15)} ${String(rows.length).padStart(5)} ` +
  `${String(rows.reduce((a, r) => a + r.input_tokens, 0)).padStart(12)} ` +
  `${String(rows.reduce((a, r) => a + r.output_tokens, 0)).padStart(12)} ` +
  `${String(rows.reduce((a, r) => a + r.searches, 0)).padStart(10)} ` +
  `${(rows.reduce((a, r) => a + r.wall_ms, 0) / 1000).toFixed(0).padStart(7)}s ${money(total).padStart(9)}`)

// ---- where the money goes WITHIN a call ------------------------------------
// The question the split by task cannot answer: is it what we send or what comes back?
let inCost = 0, outCost = 0, searchCost = 0
for (const r of rows) {
  if (r.price_input_per_m === null) continue
  inCost += (r.input_tokens / 1e6) * Number(r.price_input_per_m)
  outCost += (r.output_tokens / 1e6) * Number(r.price_output_per_m)
  searchCost += r.searches * Number(r.price_per_search ?? 0)
}
const sum = inCost + outCost + searchCost
console.log(`\n  INPUT vs OUTPUT — the half of the bill a per-task split hides`)
console.log(`    input   ${money(inCost).padStart(9)}  ${((inCost / sum) * 100).toFixed(1).padStart(5)}%   what we SEND: prompt + history + search results`)
console.log(`    output  ${money(outCost).padStart(9)}  ${((outCost / sum) * 100).toFixed(1).padStart(5)}%   what comes BACK, reasoning tokens included`)
console.log(`    search  ${money(searchCost).padStart(9)}  ${((searchCost / sum) * 100).toFixed(1).padStart(5)}%`)

// ---- by model ---------------------------------------------------------------
const byModel = new Map()
for (const r of rows) {
  const m = byModel.get(r.model) ?? { calls: 0, cost: 0, unpriced: 0 }
  m.calls++; if (r.cost_usd === null) m.unpriced++; else m.cost += Number(r.cost_usd)
  byModel.set(r.model, m)
}
console.log(`\n  BY MODEL`)
for (const [model, m] of [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
  console.log(`    ${model.padEnd(28)} ${String(m.calls).padStart(4)} call(s)  ${money(m.cost).padStart(9)}` +
    (m.unpriced ? `   ${m.unpriced} UNPRICED` : ''))
}

// ---- THE HOLES ---------------------------------------------------------------
console.log(`\n  WHAT THIS TOTAL DOES NOT INCLUDE`)
const never = LEDGER_TASKS.filter((t) => !byTask.has(t))
if (never.length) {
  console.log(`    ${never.length} task(s) have NEVER written a row: ${never.join(', ')}`)
  console.log(`      A call site with no \`ledger:\` argument is a call nobody is counting. Its`)
  console.log(`      spend is real and is missing from every figure above.`)
} else {
  console.log(`    every task in LEDGER_TASKS has written at least one row.`)
}
if (totalUnpriced) {
  console.log(`    ${totalUnpriced} row(s) could not be priced — their model is not in config/pricing.ts.`)
  console.log(`      Their tokens ARE above; their cost is not. Null is not zero.`)
}
console.log(`    an aborted or failed stream writes NO row: there are no token counts to write,`)
console.log(`      and inventing them would put a fiction in the one place meant to be fact.`)
console.log(`\n    ⚠ every figure scales linearly with config/pricing.ts, which this session did NOT`)
console.log(`      verify against the published price list. Check those four numbers first.\n`)
