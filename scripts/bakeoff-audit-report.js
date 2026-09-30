#!/usr/bin/env node
// THE AUDIT BAKE-OFF REPORT — Audits Run 5b, the shape `scripts/bakeoff-report.js` uses.
//
//   node scripts/bakeoff-audit-report.js --model claude-opus-5-5 --label baseline
//
// *** NO MODEL IS CALLED AND NO DATABASE IS READ. *** Every number traces to a file on disk:
// the stored runs under `tests/golden/audits/runs/<case>/`, and the ledger and drawer text
// `scripts/bakeoff-audit-capture.mjs` wrote under `tests/golden/audits/bakeoff/<case>/<label>/`.
// That is the documents bake-off's rule (DECISIONS.md §139) and it is the only thing that makes a
// figure in a report checkable six weeks later.
//
// It writes, per case, `bakeoff/<case>/read-me.txt`: the failed checks at the top with the text
// that failed them, then the three runs side by side. No commentary — the reading goes in
// RESULTS.md, where it can be argued with.
//
// THE COMPARISON COLUMN IS THE LAST HAIKU BATCH OF THE SAME CASE, from the same stored runs. It is
// not a re-run and not a fresh measurement: it is what `claude-haiku-4-5` last said about this
// case, beside what the baseline says now.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'

const RUNS = 'tests/golden/audits/runs'
const CASES = 'tests/golden/audits/cases'
const OUT = 'tests/golden/audits/bakeoff'
const HAIKU = 'claude-haiku-4-5'

const args = process.argv.slice(2)
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const MODEL = flag('--model', 'claude-opus-5-5')
const LABEL = flag('--label', 'baseline')

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)

function batchFor(dir, model) {
  return readdirSync(`${RUNS}/${dir}`).filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, j: JSON.parse(readFileSync(`${RUNS}/${dir}/${f}`, 'utf8')) }))
    .filter((x) => x.j.model === model && x.j.mode === 'whole')
    .sort((a, b) => a.f.localeCompare(b.f))
    .slice(-3)
}

/** Titles present in EVERY run over titles present in ANY, on normalised titles. */
function overlap(lists) {
  const sets = lists.map((l) => new Set(l.map(norm).filter(Boolean)))
  const union = new Set(sets.flatMap((s) => [...s]))
  const all = [...union].filter((t) => sets.every((s) => s.has(t)))
  return { all: all.length, union: union.size,
           fraction: union.size ? all.length / union.size : null, shared: all }
}

/** "A1 = on_file" / "A1 = stale, the key accepts …" — the word is the first token after the =. */
const wordFromDetail = (d) => {
  const m = /=\s*([a-z_]+)/.exec(String(d ?? ''))
  return m ? m[1] : null
}

const pad = (s, n) => String(s ?? '').padEnd(n)

/**
 * *** TWO VERDICT COLUMNS, AND THE DIFFERENCE IS A MATCHER, NOT A MODEL — the shape §139 used. ***
 *
 * `scripts/run-golden-audit.js`'s `collections()` built its `not_document_questions` view by
 * comparing `norm(word)` — underscores intact — against the SPACED string
 * `'not a document question'`. The two can never be equal, so `count_at_least` over that collection
 * failed every run on the rows path while the answers held two, three and four such findings. The
 * harness is fixed; the fifteen stored runs were judged BEFORE the fix and their verdicts are left
 * exactly as they were written, because a re-judged verdict that overwrites the original leaves
 * nobody able to say which of the two a report was built on.
 *
 * So the verdict is recomputed here, from the stored answer, for the checks that defect can reach —
 * and only those. Anything else is reported as judged.
 */
function corrected(check, j) {
  if (check.type === 'count_at_least' && check.collection === 'not_document_questions') {
    const n = (j.answer?.findings ?? []).filter((f) => f.word === 'not_a_document_question').length
    return { verdict: n >= (check.n ?? 1) ? 'PASS' : 'FAIL',
             detail: `${n} finding(s) worded not_a_document_question, needs ${check.n ?? 1}`
                     + ' (recomputed: the stored verdict came from a matcher that could not match)' }
  }
  return null
}
const verdictOf = (check, j) => corrected(check, j) ?? j.verdicts?.[check.id] ?? { verdict: 'FAIL', detail: 'no verdict stored' }
const tables = []
const summary = []

for (const dir of readdirSync(RUNS).filter((d) => d.startsWith('cascade-')).sort()) {
  const c = JSON.parse(readFileSync(`${CASES}/${dir}.json`, 'utf8'))
  const base = batchFor(dir, MODEL)
  const hai = batchFor(dir, HAIKU)
  if (base.length < 3) { console.log(`  ${dir}: only ${base.length} run(s) on ${MODEL} — skipped`); continue }

  const ledgerPath = `${OUT}/${dir}/${LABEL}/ledger.json`
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : []
  const led = (n) => ledger.find((l) => l.run === n) ?? null

  const checks = [...c.must.map((k) => ({ ...k, kind: 'must' })),
                  ...c.must_not.map((k) => ({ ...k, kind: 'must-not' })),
                  ...(c.acceptable ?? []).map((k) => ({ ...k, kind: 'ok' }))]

  const L = []
  const P = (s = '') => L.push(s)

  // ---- the failures first, with the text that failed them -------------------
  const failed = []
  const fixes = []
  for (const k of checks) {
    const per = base.map((b) => verdictOf(k, b.j))
    const stored = base.map((b) => b.j.verdicts?.[k.id] ?? { verdict: 'FAIL', detail: 'no verdict stored' })
    if (base.some((b, i) => corrected(k, b.j) && corrected(k, b.j).verdict !== stored[i].verdict)) {
      fixes.push({ k, stored, per })
    }
    const bad = per.map((v, i) => ({ v, n: i + 1 })).filter((x) => x.v.verdict !== 'PASS')
    if (bad.length) failed.push({ k, bad, per })
  }
  for (const f of fixes) {
    P(`MATCHER  ${f.k.kind} ${f.k.id}  as judged ${f.stored.map((v) => v.verdict).join('/')}`
      + `  ->  corrected ${f.per.map((v) => v.verdict).join('/')}  ${f.k.line}`)
    for (let i = 0; i < f.per.length; i++) P(`        run ${i + 1}: ${f.per[i].detail}`)
  }
  for (const f of failed) {
    P(`FAILED  ${f.k.kind} ${f.k.id}  (${f.bad.length} of ${base.length} runs)  ${f.k.line}`)
    for (const b of f.bad) P(`        run ${b.n}: ${String(b.v.detail ?? '').replace(/\s+/g, ' ').slice(0, 300)}`)
  }
  if (!failed.length) P('FAILED  nothing')
  P()
  P('='.repeat(100))
  P(`${dir} — ${c.title}`)
  P(`model ${MODEL} · whole mode · ${base.length} runs · run date ${base[0].j.run_date}`)
  P(`input sha ${String(base[0].j.input_sha256).slice(0, 16)}  (runs 2 and 3: `
    + base.slice(1).map((b) => String(b.j.input_sha256).slice(0, 16)).join(', ') + ')')
  for (let i = 0; i < base.length; i++) {
    P(`run ${i + 1}  ${base[i].f}  audit_run_id ${base[i].j.audit_run_id}`)
  }
  P(`comparison: ${HAIKU}, ${hai.length} stored run(s)` + (hai.length ? ` — ${hai.map((h) => h.f).join(', ')}` : ''))
  P('='.repeat(100))
  P()

  // ---- the three runs side by side -----------------------------------------
  P(`CHECK                         kind      run1  run2  run3   n/3   ${HAIKU} n/3`)
  P('(a check listed under MATCHER above is shown corrected here; every other verdict is as stored)')
  for (const k of checks) {
    const per = base.map((b) => verdictOf(k, b.j).verdict === 'PASS')
    const hp = hai.map((b) => b.j.verdicts?.[k.id]?.verdict === 'PASS')
    P(`${pad(k.id, 29)} ${pad(k.kind, 9)} ${per.map((p) => pad(p ? 'PASS' : 'FAIL', 6)).join('')}`
      + ` ${pad(`${per.filter(Boolean).length}/3`, 5)} `
      + (hai.length === 3 ? `${hp.filter(Boolean).length}/3` : 'no batch'))
  }
  P()

  const row = (name, f, fh = f) => {
    const b = base.map((x) => f(x.j))
    const h = hai.length === 3 ? hai.map((x) => fh(x.j)) : null
    P(`${pad(name, 29)} ${b.map((v) => pad(v, 6)).join('')}        ${h ? h.join(' / ') : '(no batch)'}`)
  }
  P(`COUNT                         run1  run2  run3         ${HAIKU} runs`)
  row('must passed', (j) => `${c.must.filter((k) => verdictOf(k, j).verdict === 'PASS').length}/${c.must.length}`)
  row('must-not held', (j) => `${c.must_not.filter((k) => verdictOf(k, j).verdict === 'PASS').length}/${c.must_not.length}`)
  row('findings', (j) => (j.answer?.findings ?? []).length)
  row('dates', (j) => (j.answer?.dates ?? []).length)
  row('contradictions', (j) => (j.answer?.contradictions ?? []).length)
  row('expected and not seen', (j) => (j.answer?.expected_not_seen ?? []).length)
  row('reshaped to dates', (j) => (j.reshaped_to_dates ?? []).length)
  // THE FOUR WORDS, COUNTED, AND THE FIFTH STATE NOBODY CHOSE.
  // A finding row with a NULL word is not one of the four and is not a refusal: it is a line on a
  // customer's screen with a title, a document and no status. `lib/auditRun.ts:450` makes them —
  // a `date` item with no `due_on` is demoted to `finding`, and a date item carries no `word`, so
  // the row lands wordless. Counted here because no forbidden-word check can see it: null is not
  // a word to forbid.
  for (const w of ['on_file', 'stale', 'nothing_on_file', 'not_a_document_question']) {
    row(`  word ${w}`, (j) => (j.answer?.findings ?? []).filter((f) => f.word === w).length)
  }
  row('  findings with NO word', (j) => (j.answer?.findings ?? []).filter((f) => !f.word).length)
  row('handle errors', (j) => (j.handle_errors ?? []).length)
  row('rows written', (j) => j.rows_written ?? '—')
  row('section status', (j) => j.section_status ?? '—')
  row('json parsed', (j) => (j.calls ?? []).every((x) => x.json_parsed) ? 'yes' : 'NO')
  row('searches', (j) => (j.calls ?? []).reduce((s, x) => s + (x.searches ?? 0), 0))
  row('output tokens', (j) => (j.calls ?? []).reduce((s, x) => s + (x.output_tokens ?? 0), 0))
  P()

  const FORBIDDEN = ['no-satisfied', 'no-ai-word', 'no-score']
  const fw = FORBIDDEN.filter((id) => checks.some((k) => k.id === id))
  P(`FORBIDDEN WORDS               run1  run2  run3`)
  for (const id of fw) {
    P(`${pad(id, 29)} ${base.map((b) => pad(b.j.verdicts?.[id]?.verdict === 'PASS' ? 'none' : 'FOUND', 6)).join('')}`)
    for (let i = 0; i < base.length; i++) {
      const v = base[i].j.verdicts?.[id]
      if (v && v.verdict !== 'PASS') P(`        run ${i + 1}: ${String(v.detail).replace(/\s+/g, ' ').slice(0, 300)}`)
    }
  }
  P()

  P(`LEDGER                        run1      run2      run3      ${HAIKU} (run files)`)
  // *** A $0 IN A COST COLUMN IS EITHER A FREE AUDIT OR AN UNREAD ONE, AND THEY LOOK THE SAME. ***
  // The runner stores `cost_usd` from the ai_calls row it can find by id, and a TEMPLATE run has no
  // such id, so every stored template run reads 0.0000. It is printed as "(not recorded)".
  const money = (v) => (Number(v) > 0 ? `$${Number(v).toFixed(4)}` : '(not recorded)')
  const hcost = hai.length === 3 ? hai.map((h) => Number(h.j.cost_usd ?? 0)) : null
  P(`${pad('cost, the whole run', 29)} ${base.map((b, i) => pad(led(i + 1) ? `$${led(i + 1).cost_run_usd.toFixed(4)}` : '(unread)', 10)).join('')}`
    + (hcost ? hcost.map(money).join(' / ') : '(no batch)'))
  P(`${pad('cost in the section windows', 29)} ${base.map((b, i) => pad(led(i + 1) ? `$${led(i + 1).cost_sections_usd.toFixed(4)}` : '(unread)', 10)).join('')}`
    + '(what Past audits shows)')
  P(`${pad('ai_calls, run / sections', 29)} ${base.map((b, i) => pad(led(i + 1) ? `${led(i + 1).run_ai_calls}/${led(i + 1).section_ai_calls}` : '(unread)', 10)).join('')}`)
  P(`${pad('wall per audit', 29)} ${base.map((b, i) => pad(led(i + 1) ? `${(led(i + 1).wall_ms / 1000).toFixed(1)}s` : `${((b.j.wall_ms ?? 0) / 1000).toFixed(1)}s*`, 10)).join('')}`
    + (hai.length === 3 ? hai.map((h) => `${((h.j.wall_ms ?? 0) / 1000).toFixed(1)}s`).join(' / ') : '(no batch)'))
  P()

  // ---- stability of the answer itself, not of the checks -------------------
  const ov = overlap(base.map((b) => (b.j.answer?.findings ?? []).map((f) => f.title)))
  const ovH = hai.length === 3 ? overlap(hai.map((b) => (b.j.answer?.findings ?? []).map((f) => f.title))) : null
  const ex = overlap(base.map((b) => (b.j.answer?.expected_not_seen ?? []).map((f) => f.title)))
  const exH = hai.length === 3 ? overlap(hai.map((b) => (b.j.answer?.expected_not_seen ?? []).map((f) => f.title))) : null
  P('OVERLAP ACROSS THE THREE RUNS — titles in all three over titles in any, normalised')
  P(`${pad('finding titles', 29)} ${ov.all}/${ov.union} = ${ov.fraction === null ? '—' : ov.fraction.toFixed(2)}`
    + `        ${ovH ? `${ovH.all}/${ovH.union} = ${ovH.fraction === null ? '—' : ovH.fraction.toFixed(2)}` : '(no batch)'}`)
  P(`${pad('expected-not-seen titles', 29)} ${ex.all}/${ex.union} = ${ex.fraction === null ? '—' : ex.fraction.toFixed(2)}`
    + `        ${exH ? `${exH.all}/${exH.union} = ${exH.fraction === null ? '—' : exH.fraction.toFixed(2)}` : '(no batch)'}`)
  P()
  P('in all three runs:')
  for (const t of ov.shared) P(`  = ${t}`)
  P('in some but not all:')
  for (const b of base) {
    for (const f of b.j.answer?.findings ?? []) {
      if (!ov.shared.includes(norm(f.title))) P(`  ~ run ${b.j.run}: ${String(f.title).replace(/\s+/g, ' ').slice(0, 90)} [${f.word}]`)
    }
  }
  P()

  // ---- the template cases: one row per checklist line ----------------------
  const lineChecks = checks.filter((k) => k.type === 'line_word')
  if (lineChecks.length) {
    P(`PER LINE                      run1                  run2                  run3                  ${HAIKU} (last run)   the key accepts`)
    for (const k of lineChecks) {
      const w = base.map((b) => wordFromDetail(b.j.verdicts?.[k.id]?.detail) ?? '—')
      const hw = hai.length ? wordFromDetail(hai[hai.length - 1].j.verdicts?.[k.id]?.detail) ?? '—' : '(no run)'
      P(`${pad(k.ref ?? k.id, 29)} ${w.map((x) => pad(x, 22)).join('')}${pad(hw, 22)}${(k.accept ?? []).join(' / ')}`)
    }
    P()
  }

  P('WHAT THE DRAWER SAYS — the captured text is beside this file:')
  for (let i = 1; i <= base.length; i++) {
    const p = `${OUT}/${dir}/${LABEL}/run-${i}.txt`
    P(`  ${p}  ${existsSync(p) ? `${readFileSync(p, 'utf8').split('\n').length} line(s)` : 'NOT CAPTURED'}`)
  }
  P()

  mkdirSync(`${OUT}/${dir}`, { recursive: true })
  writeFileSync(`${OUT}/${dir}/read-me.txt`, L.join('\n') + '\n')
  console.log(`  ${pad(dir, 22)} ${failed.length} check(s) failed in at least one run  ->  ${OUT}/${dir}/read-me.txt`)

  summary.push({ dir, title: c.title, base, hai, ledger, checks, failed, ov, ovH, ex, exH, lineChecks, c })
}

// ---------------------------------------------------------------------------
// THE TABLES, AS MARKDOWN, FOR RESULTS.md TO QUOTE. Generated, so the prose around them cannot
// disagree with them.
// ---------------------------------------------------------------------------
const M = []
const m = (s = '') => M.push(s)
const passedStored = (j, ks) => ks.filter((k) => j.verdicts?.[k.id]?.verdict === 'PASS').length
const passed = (j, ks) => ks.filter((k) => verdictOf(k, j).verdict === 'PASS').length
const stableStored = (runs, ks) => ks.filter((k) => runs.every((b) => b.j.verdicts?.[k.id]?.verdict === 'PASS')).length
const stable = (runs, ks) => ks.filter((k) => runs.every((b) => verdictOf(k, b.j).verdict === 'PASS')).length
const meanCost = (l) => l.length ? l.reduce((s, x) => s + x.cost_run_usd, 0) / l.length : null
const meanWall = (l, runs) => l.length ? l.reduce((s, x) => s + x.wall_ms, 0) / l.length
  : runs.reduce((s, b) => s + (b.j.wall_ms ?? 0), 0) / runs.length

m(`| Case | Musts (run 1 / 2 / 3) | Musts in all three, as judged | Musts in all three, matcher corrected | Must-nots (all three) | ${HAIKU}: musts in all three, corrected |`)
m('|---|---|---|---|---|---|')
for (const s of summary) {
  const per = s.base.map((b) => passed(b.j, s.c.must)).join(' / ')
  const h = s.hai.length === 3 ? `${stable(s.hai, s.c.must)} of ${s.c.must.length}` : '(no batch)'
  const asJudged = stableStored(s.base, s.c.must)
  const fixed = stable(s.base, s.c.must)
  m(`| \`${s.dir}\` | ${per} of ${s.c.must.length} | ${asJudged} of ${s.c.must.length} | **${fixed} of ${s.c.must.length}**`
    + `${fixed === asJudged ? '' : ' ⚠'} | ${stable(s.base, s.c.must_not)} of ${s.c.must_not.length} | ${h} |`)
}
m()
m(`| Case | Findings (1/2/3) | Finding-title overlap | Findings with NO word (1/2/3) | Expected-not-seen (1/2/3) | Its overlap | Reshaped to dates | Handle errors | Forbidden words |`)
m('|---|---|---|---|---|---|---|---|---|')
for (const s of summary) {
  const f = s.base.map((b) => (b.j.answer?.findings ?? []).length).join('/')
  const e = s.base.map((b) => (b.j.answer?.expected_not_seen ?? []).length).join('/')
  const rs = s.base.reduce((x, b) => x + (b.j.reshaped_to_dates ?? []).length, 0)
  const he = s.base.reduce((x, b) => x + (b.j.handle_errors ?? []).length, 0)
  const fwFail = ['no-satisfied', 'no-ai-word', 'no-score']
    .filter((id) => s.base.some((b) => b.j.verdicts?.[id] && b.j.verdicts[id].verdict !== 'PASS'))
  const nw = s.base.map((b) => (b.j.answer?.findings ?? []).filter((x) => !x.word).length).join('/')
  m(`| \`${s.dir}\` | ${f} | **${s.ov.all}/${s.ov.union} = ${s.ov.fraction === null ? '—' : s.ov.fraction.toFixed(2)}** | ${nw} | ${e} | ${s.ex.fraction === null ? '—' : `${s.ex.all}/${s.ex.union} = ${s.ex.fraction.toFixed(2)}`} | ${rs} | ${he} | ${fwFail.length ? fwFail.join(', ') : '**none**'} |`)
}
m()
m(`| Case | Cost per audit (1/2/3) | Mean | Wall (mean) | ${HAIKU} cost (1/2/3) | Its mean | Its wall |`)
m('|---|---|---|---|---|---|---|')
for (const s of summary) {
  const cs = s.ledger.length ? s.ledger.map((l) => `$${l.cost_run_usd.toFixed(4)}`).join(' / ') : '(unread)'
  const mc = meanCost(s.ledger)
  const mny = (v) => (Number(v) > 0 ? `$${Number(v).toFixed(4)}` : '(not recorded)')
  const hc = s.hai.length === 3 ? s.hai.map((h) => mny(h.j.cost_usd)).join(' / ') : '(no batch)'
  const hm = s.hai.length === 3 && s.hai.every((h) => Number(h.j.cost_usd) > 0)
    ? s.hai.reduce((x, h) => x + Number(h.j.cost_usd ?? 0), 0) / 3 : null
  const hw = s.hai.length === 3 ? s.hai.reduce((x, h) => x + (h.j.wall_ms ?? 0), 0) / 3 : null
  m(`| \`${s.dir}\` | ${cs} | **${mc === null ? '(unread)' : `$${mc.toFixed(4)}`}** | ${(meanWall(s.ledger, s.base) / 1000).toFixed(1)}s | ${hc} | ${hm === null ? '(not recorded)' : `$${hm.toFixed(4)}`} | ${hw === null ? '—' : `${(hw / 1000).toFixed(1)}s`} |`)
}
m()
const totalCost = summary.reduce((s, x) => s + x.ledger.reduce((y, l) => y + l.cost_run_usd, 0), 0)
m(`**Total on the ${summary.reduce((s, x) => s + x.base.length, 0)} baseline runs, from the ledger: $${totalCost.toFixed(4)}.**`)
m()
for (const s of summary.filter((x) => x.lineChecks.length)) {
  m(`### \`${s.dir}\` — per checklist line`)
  m()
  m(`| Line | run 1 | run 2 | run 3 | ${HAIKU} (last run) | The key accepts |`)
  m('|---|---|---|---|---|---|')
  for (const k of s.lineChecks) {
    const w = s.base.map((b) => wordFromDetail(b.j.verdicts?.[k.id]?.detail) ?? '—')
    const hw = s.hai.length ? wordFromDetail(s.hai[s.hai.length - 1].j.verdicts?.[k.id]?.detail) ?? '—' : '(no run)'
    const ok = (x) => (k.accept ?? []).includes(x) ? `\`${x}\`` : `**\`${x}\`**`
    m(`| ${k.ref ?? k.id} | ${w.map(ok).join(' | ')} | \`${hw}\` | ${(k.accept ?? []).join(' or ')} |`)
  }
  m()
}
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/tables.md`, M.join('\n') + '\n')
console.log(`\n  the markdown tables: ${OUT}/tables.md\n`)
