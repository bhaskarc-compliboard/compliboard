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
import { LEDGER_TASKS, estimateCost } from '../lib/costLedger.ts'
import { MODEL_PRICES, PRICES_VERIFIED_ON, PRICE_CORRECTIONS } from '../config/pricing.ts'

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
  const t = byTask.get(r.task) ?? { calls: 0, input: 0, output: 0, searches: 0, ms: 0, cost: 0, today: 0, unpriced: 0, models: new Set() }
  t.calls++; t.input += r.input_tokens; t.output += r.output_tokens
  t.searches += r.searches; t.ms += r.wall_ms
  if (r.cost_usd === null) t.unpriced++; else t.cost += Number(r.cost_usd)
  // The same call priced at the CURRENT table, for the column below. Never written back.
  t.today += estimateCost({ model: r.model, inputTokens: r.input_tokens,
    outputTokens: r.output_tokens, searches: r.searches }).costUsd ?? 0
  t.models.add(r.model)
  byTask.set(r.task, t)
}

const total = [...byTask.values()].reduce((a, t) => a + t.cost, 0)
const totalUnpriced = [...byTask.values()].reduce((a, t) => a + t.unpriced, 0)

console.log(`\n  COST LEDGER — ${rows.length} call(s)${since ? ` since ${since}` : ''}`)
console.log(`  prices in config/pricing.ts verified ${PRICES_VERIFIED_ON}`)
console.log(`  ${rows[0].created_at.slice(0, 19)}  to  ${rows[rows.length - 1].created_at.slice(0, 19)}\n`)
const totalToday = [...byTask.values()].reduce((a, t) => a + t.today, 0)
const drifted = Math.abs(totalToday - total) > 0.005

console.log('  task            calls    input tok   output tok   searches     wall     stored' +
  (drifted ? '   at current' : '') + '    share')
console.log('  ' + '─'.repeat(drifted ? 100 : 88))
for (const [task, t] of [...byTask.entries()].sort((a, b) => b[1].today - a[1].today)) {
  // Share is computed on the CURRENT prices when they differ, because the share is what the
  // reader uses to decide where to spend attention, and it must reflect real money.
  const basis = drifted ? totalToday : total
  const share = basis > 0 ? `${(((drifted ? t.today : t.cost) / basis) * 100).toFixed(1)}%` : '—'
  console.log(`  ${task.padEnd(15)} ${String(t.calls).padStart(5)} ${String(t.input).padStart(12)} ` +
    `${String(t.output).padStart(12)} ${String(t.searches).padStart(10)} ${(t.ms / 1000).toFixed(0).padStart(7)}s ` +
    `${money(t.cost).padStart(9)}` + (drifted ? `${money(t.today).padStart(12)}` : '') +
    ` ${share.padStart(8)}` + (t.unpriced ? `   (${t.unpriced} UNPRICED)` : ''))
}
console.log('  ' + '─'.repeat(drifted ? 100 : 88))
console.log(`  ${'TOTAL'.padEnd(15)} ${String(rows.length).padStart(5)} ` +
  `${String(rows.reduce((a, r) => a + r.input_tokens, 0)).padStart(12)} ` +
  `${String(rows.reduce((a, r) => a + r.output_tokens, 0)).padStart(12)} ` +
  `${String(rows.reduce((a, r) => a + r.searches, 0)).padStart(10)} ` +
  `${(rows.reduce((a, r) => a + r.wall_ms, 0) / 1000).toFixed(0).padStart(7)}s ${money(total).padStart(9)}` +
  (drifted ? `${money(totalToday).padStart(12)}` : ''))
if (drifted) console.log(`  ${' '.repeat(69)}stored   at current prices`)

// ---- where the money goes WITHIN a call ------------------------------------
// The question the split by task cannot answer: is it what we send or what comes back?
let inCost = 0, outCost = 0, searchCost = 0
for (const r of rows) {
  // Split at CURRENT prices when the stored ones are superseded: the question "is it what we
  // send or what comes back" is about today's decision, not about a historical invoice.
  const p = MODEL_PRICES[r.model]
  const pin = p ? p.inputPerM : r.price_input_per_m
  const pout = p ? p.outputPerM : r.price_output_per_m
  if (pin === null || pin === undefined) continue
  inCost += (r.input_tokens / 1e6) * Number(pin)
  outCost += (r.output_tokens / 1e6) * Number(pout)
  searchCost += r.searches * Number(r.price_per_search ?? 0)
}
const sum = inCost + outCost + searchCost
console.log(`\n  INPUT vs OUTPUT — the half of the bill a per-task split hides` +
  (drifted ? ` (at current prices)` : ''))
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

// ---- ROWS BILLED AT A PRICE THAT HAS SINCE CHANGED -----------------------------
//
// *** THE ROWS ARE NOT REWRITTEN, AND THIS IS THE NOTE INSTEAD. ***
//
// `ai_calls` copies the price onto each row at the call (migration 038), so correcting
// `config/pricing.ts` leaves history alone — deliberately, because what a call cost is a fact
// about the past. That is right and it creates one obligation: a total that silently adds rows
// costed at two different rates is a number nobody can interpret. So a run that spans a price
// change says so, and shows what the same calls would cost at today's prices ALONGSIDE what
// they were actually billed — never instead of it.
const superseded = []
for (const r of rows) {
  if (r.price_input_per_m === null) continue
  const now = MODEL_PRICES[r.model]
  if (!now) continue
  if (Number(r.price_input_per_m) !== now.inputPerM || Number(r.price_output_per_m) !== now.outputPerM) {
    superseded.push(r)
  }
}
if (superseded.length) {
  const asBilled = superseded.reduce((a, r) => a + Number(r.cost_usd ?? 0), 0)
  const atToday = superseded.reduce((a, r) => a + (estimateCost({
    model: r.model, inputTokens: r.input_tokens, outputTokens: r.output_tokens, searches: r.searches,
  }).costUsd ?? 0), 0)
  // Was the difference a vendor price change, or was this table simply wrong? A reader cannot
  // interpret the stored total without knowing which, so the answer is printed, not implied.
  const correction = PRICE_CORRECTIONS.find((c) => c.kind === 'correction'
    && superseded.some((r) => new Date(r.created_at) < new Date(c.on)))
  console.log(`\n  ⚠ ${superseded.length} of ${rows.length} row(s) carry prices that differ from the current table.`)
  console.log(`    They are NOT repriced — a row keeps the price it was costed at, by design.`)
  if (correction) {
    console.log(`\n    *** AND THIS WAS A CORRECTION, NOT A PRICE CHANGE. ***`)
    console.log(`    ${correction.note.replace(/(.{1,74})(\s|$)/g, '    $1\n').trim().replace(/^ {4}/, '')}`)
    console.log(`    So the "as billed" figure below was NEVER CHARGED by anyone. The token`)
    console.log(`    counts are measured and correct; the money on those rows is an estimate`)
    console.log(`    that was wrong. Read the corrected figure as the real one.`)
  }
  const models = [...new Set(superseded.map((r) => r.model))]
  for (const m of models) {
    const mine = superseded.filter((r) => r.model === m)
    const was = mine[0]
    console.log(`      ${m.padEnd(22)} ${String(mine.length).padStart(3)} row(s)  ` +
      `billed at $${Number(was.price_input_per_m)}/$${Number(was.price_output_per_m)} per M, ` +
      `now $${MODEL_PRICES[m].inputPerM}/$${MODEL_PRICES[m].outputPerM}`)
  }
  console.log(`\n    stored on the rows        ${money(asBilled).padStart(9)}`)
  console.log(`    at the corrected prices   ${money(atToday).padStart(9)}   ` +
    `(${(atToday / asBilled * 100).toFixed(0)}% of it)`)
  console.log(`    THE TOTALS ABOVE ARE THE STORED ONES. For these rows the corrected figure`)
  console.log(`    is the one to quote.`)
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
console.log(`\n    every figure scales linearly with config/pricing.ts, verified ${PRICES_VERIFIED_ON}.\n`)
