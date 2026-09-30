#!/usr/bin/env node
// WHAT THE BASELINE RUNS COST, AND WHAT THEIR DRAWERS SAY — Audits Run 5b.
//
//   node --env-file=.env.local scripts/bakeoff-audit-capture.mjs claude-opus-5-5 baseline
//
// Two things, both of which have to happen ONCE and be written down, because neither can be
// recovered from a run file afterwards:
//
//   1. THE LEDGER. `tests/golden/audits/runs/<case>/*.json` carries `cost_usd` only where the
//      runner could find the ai_calls row by id — and a TEMPLATE run cannot, because it is three
//      sections and the runner holds no call id for them. So the cost is read here the way the
//      product reads it: `costOfSections`, summing `ai_calls` between each section's own
//      started_at and finished_at. A cost typed from a run file would be null for two of five
//      cases.
//   2. THE DRAWER. The report is a client component behind a session; the only honest way to
//      quote it is to open it. `scripts/page-text.mjs` does the signing in.
//
// *** THE FOLDS ARE NOT A PROBLEM AND MUST NOT BE CLICKED. *** A folded section is rendered with
// `hidden print:block` (components/AuditReport.tsx `Section_`), so its text is IN THE DOM. The
// expression below clones the drawer, drops every `hidden` class from the clone, parks it in
// static flow — `position: fixed` has no layout box in a headless viewport, which is why
// `innerText` on the drawer itself returns nothing — and reads the clone. What lands in the file
// is the whole report in reading order, folded or not.
//
// *** AND IT WAITS FOR THE DRAWER, NOT FOR THE PAGE. *** `page-text.mjs`'s own ready-loop watches
// `document.body.innerText`, which is already long because the Audits page behind the drawer has
// loaded. The first capture came back as the word "Reading…" — a real screen, and not the one being
// measured. The expression polls until the drawer's own fetch has landed.
//
// It writes nothing to the database and calls no model.
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'

const RUNS = 'tests/golden/audits/runs'
const OUT = 'tests/golden/audits/bakeoff'
const PROD_REF = 'dsfwmafnphdlfogetsus'

const model = process.argv[2]
const label = process.argv[3] || 'baseline'
if (!model) { console.error('\n  usage: bakeoff-audit-capture.mjs <model id> [label]\n'); process.exit(1) }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set'); process.exit(1) }
if (url.includes(PROD_REF)) { console.error('That URL is PRODUCTION. Staging only.'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

const DRAWER = `(async () => {
  const grab = () => {
    const d = document.querySelector('.print-drawer'); if (!d) return null;
    const c = d.cloneNode(true);
    c.querySelectorAll('.hidden').forEach((n) => n.classList.remove('hidden'));
    c.className = ''; c.setAttribute('style', 'position:static;width:720px');
    document.body.appendChild(c); const t = c.innerText; c.remove(); return t;
  };
  for (let i = 0; i < 60; i++) {
    const t = grab();
    if (t && !/Reading…|Opening…/.test(t) && t.length > 400) return t;
    await new Promise((r) => setTimeout(r, 500));
  }
  return '*** THE DRAWER DID NOT FINISH LOADING ***\\n' + (grab() || 'no drawer');
})()`

// ---------------------------------------------------------------------------
// THE BASELINE RUNS, IN THE ORDER THEY HAPPENED, ACROSS EVERY CASE.
// The order matters because of how the ledger is attributed below.
// ---------------------------------------------------------------------------
const cases = []
for (const dir of readdirSync(RUNS).filter((d) => d.startsWith('cascade-')).sort()) {
  const files = readdirSync(`${RUNS}/${dir}`).filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, j: JSON.parse(readFileSync(`${RUNS}/${dir}/${f}`, 'utf8')) }))
    .filter((x) => x.j.model === model && x.j.mode === 'whole')
    .sort((a, b) => a.f.localeCompare(b.f))
  const batch = files.slice(-3)
  if (batch.length < 3) { console.log(`  ${dir.padEnd(22)} only ${batch.length} run(s) on ${model} — skipped`); continue }
  cases.push({ dir, batch })
}

// Each run's sections, read off the rows.
const all = []
for (const c of cases) {
  for (let i = 0; i < c.batch.length; i++) {
    const runId = c.batch[i].j.audit_run_id
    if (!runId) { console.error(`  ${c.dir} run ${i + 1}: no audit_run_id in ${c.batch[i].f}`); process.exit(1) }
    const { data: secs, error } = await db.from('audit_sections')
      .select('id, title, started_at, finished_at, model, status').eq('run_id', runId).order('ordinal')
    if (error) { console.error(`reading audit_sections for ${runId}: ${error.message}`); process.exit(1) }
    const windows = (secs ?? []).filter((s) => s.started_at && s.finished_at)
    if (!windows.length) { console.error(`  ${c.dir} run ${i + 1}: no section has both timestamps`); process.exit(1) }
    const from = windows.map((s) => s.started_at).sort()[0]
    const to = windows.map((s) => s.finished_at).sort().slice(-1)[0]
    all.push({ case: c.dir, run: i + 1, runId, file: c.batch[i].f,
               sections: (secs ?? []).length, model: secs?.[0]?.model ?? null, windows, from, to })
  }
}
all.sort((a, b) => a.from.localeCompare(b.from))

/**
 * *** TWO COST COLUMNS, AND THE DIFFERENCE IS THE CHECKLIST EXTRACTION. ***
 *
 * `costOfSections` — what Past audits shows a customer — sums `ai_calls` between each SECTION's own
 * started_at and finished_at. A template audit's first call is not in any of those windows: the
 * checklist is extracted BEFORE the run row exists (`runTemplateAsRows` calls `extractTemplate`
 * and then `createRun`), so the product's own figure is short by one call on every template run.
 * Measured here: $0.0229 of a $0.56 run.
 *
 * So both are read. `cost_sections_usd` is the product's number. `cost_run_usd` is every audit-task
 * ledger row between the previous baseline run's end and this one's, which picks the extraction up.
 * That attribution is sound ONLY because these fifteen runs were one sequential process with nothing
 * else billing `audit` against this company — which is why the rows themselves are written into
 * ledger.json rather than just their sum.
 *
 * The first run in the batch has no predecessor to bound it, so it gets the section window and
 * nothing more. It is an AGENCY case, which makes no extraction call, so nothing is lost; a template
 * case first in the batch would have to be bounded by hand.
 */
let prevEnd = null
for (const r of all) {
  let sectionCost = 0, sectionCalls = 0, inTok = 0, outTok = 0, searches = 0
  for (const s of r.windows) {
    const { data: rows, error } = await db.from('ai_calls')
      .select('cost_usd, input_tokens, output_tokens, searches')
      .eq('task', 'audit').gte('created_at', s.started_at).lte('created_at', s.finished_at)
    if (error) { console.error(`reading ai_calls for section ${s.id}: ${error.message}`); process.exit(1) }
    for (const x of rows ?? []) {
      sectionCost += Number(x.cost_usd ?? 0); sectionCalls++
      inTok += x.input_tokens ?? 0; outTok += x.output_tokens ?? 0; searches += x.searches ?? 0
    }
  }
  // *** PROVE IT CAN SEE A PRESENCE. *** Zero rows in every window is not a free audit, it is a
  // window that contains nothing, and the two are identical in a cost column.
  if (!sectionCalls) console.log(`  ⚠ ${r.case} run ${r.run}: the section windows contain NO ai_calls rows `
    + `— the cost is not $0, it is unread`)

  let runCost = sectionCost, runCalls = sectionCalls, runRows = null
  if (prevEnd) {
    const { data: rows, error } = await db.from('ai_calls')
      .select('created_at, cost_usd, input_tokens, output_tokens, searches, model')
      .eq('task', 'audit').gt('created_at', prevEnd).lte('created_at', r.to).order('created_at')
    if (error) { console.error(`reading the ledger for run ${r.runId}: ${error.message}`); process.exit(1) }
    runRows = (rows ?? []).map((x) => ({ at: x.created_at, model: x.model,
      cost_usd: Number(x.cost_usd ?? 0), in: x.input_tokens, out: x.output_tokens, searches: x.searches }))
    runCost = runRows.reduce((s, x) => s + x.cost_usd, 0)
    runCalls = runRows.length
  }
  prevEnd = r.to

  const wall = r.windows.reduce((s, x) => s + (new Date(x.finished_at) - new Date(x.started_at)), 0)
  r.ledger = { run: r.run, run_file: r.file, audit_run_id: r.runId, model: r.model,
               sections: r.sections, window_from: r.from, window_to: r.to,
               section_ai_calls: sectionCalls, cost_sections_usd: Number(sectionCost.toFixed(6)),
               run_ai_calls: runCalls, cost_run_usd: Number(runCost.toFixed(6)),
               wall_ms: wall, input_tokens: inTok, output_tokens: outTok, searches,
               ledger_rows: runRows }

  const txt = execFileSync('node', ['--env-file=.env.local', 'scripts/page-text.mjs',
    `/audits?run=${r.runId}`, DRAWER], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  mkdirSync(`${OUT}/${r.case}/${label}`, { recursive: true })
  writeFileSync(`${OUT}/${r.case}/${label}/run-${r.run}.txt`, txt)
  console.log(`  ${r.case.padEnd(22)} run ${r.run}  ${sectionCalls} section call(s) $${sectionCost.toFixed(4)}`
    + `  ${runCalls} run call(s) $${runCost.toFixed(4)}  ${(wall / 1000).toFixed(1)}s`
    + `  drawer ${txt.split('\n').length} line(s)`)
}

for (const c of cases) {
  const rows = all.filter((r) => r.case === c.dir).sort((a, b) => a.run - b.run).map((r) => r.ledger)
  writeFileSync(`${OUT}/${c.dir}/${label}/ledger.json`, JSON.stringify(rows, null, 2) + '\n')
}
console.log(`\n  total from the ledger: $${all.reduce((s, r) => s + r.ledger.cost_run_usd, 0).toFixed(4)}`
  + ` over ${all.length} run(s)`)
console.log(`  drawer text and ledger: ${OUT}/<case>/${label}/\n`)
