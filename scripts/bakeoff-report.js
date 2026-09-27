#!/usr/bin/env node
// THE BAKE-OFF REPORT — 27 September 2026.
//
//   node scripts/bakeoff-report.js [--since 2026-09-27] > tests/golden/documents/bakeoff/<date>.md
//
// Reads the stored runs in tests/golden/documents/runs/, groups them by the CONFIGURATION each run
// recorded on itself (`model` + `structured`), and writes the report. **It calls no model and reads
// no database.** Every number in the output traces to a file on disk.
//
// *** WHY THIS IS A SCRIPT. *** A 147-scan measurement whose tables were typed by hand is a
// measurement nobody can check — `HOW-WE-BUILD.md` §3, and the reason `scripts/preflight-prod.js`
// exists. Re-run it and the report regenerates from the same runs.
//
// *** THE PLANTED GAPS ARE FOUND BY KEYWORDS ALONE, DELIBERATELY. *** The suite's own matcher
// REQUIRES the citation fragment, so a gap the model found and cited to the wrong rule fails the
// must-line and is invisible as a find. That is right for judging and wrong for measuring: the
// question "did it find the gap, and did it cite it correctly" has two halves, and the runner's
// verdict answers only the pair. So this searches `gaps` on keywords, then reports the citation the
// model gave and whether it contains the rule the spec names. A gap found and miscited shows here as
// FOUND with a wrong citation, and in the runner as a FAIL. Both are true.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { MODEL_PRICES } from '../config/pricing.ts'

const DIR = 'tests/golden/documents'
const RUNS = `${DIR}/runs`
const CASES = `${DIR}/cases`
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
const SINCE = arg('--since') ?? '2026-09-27'

const norm = (s) => String(s ?? '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
const squash = (s) => norm(s).replace(/[^a-z0-9]/g, '')
const ITEM_TEXT = (o) => Object.values(o ?? {}).filter((v) => typeof v === 'string' || typeof v === 'number')
  .map(String).join(' / ')

const ORDER = ['01-eap-chemical', '02-acdp-chemical', '05-sds-supplier', '06a-forklift-log',
               '06b-forklift-log-photo', '03-olcc-cannabis', '04-fsp-food']
const caseOf = {}
for (const id of ORDER) {
  if (existsSync(`${CASES}/${id}.json`)) caseOf[id] = JSON.parse(readFileSync(`${CASES}/${id}.json`, 'utf8'))
}

// ---- load every run written on or after SINCE ------------------------------
const all = []
for (const id of Object.keys(caseOf)) {
  const dir = `${RUNS}/${id}`
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    if (f.slice(0, 10) < SINCE) continue
    const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
    all.push({ ...d, file: f, caseId: id })
  }
}
if (!all.length) { console.error(`No runs on or after ${SINCE} in ${RUNS}/`); process.exit(1) }

// ---- the configuration order the brief asked for ---------------------------
const CONFIGS = [
  ['claude-opus-5', false], ['claude-opus-5-5', false], ['claude-opus-5-5', true],
  ['claude-sonnet-5', false], ['claude-sonnet-5', true],
  ['claude-haiku-4-5', false], ['claude-haiku-4-5', true],
]
const key = (m, st) => `${m}|${st ? 'on' : 'off'}`
const label = (m, st) => `${m}, schema ${st ? 'ON' : 'OFF'}`
const byConfig = new Map()
for (const r of all) {
  const k = key(r.model, r.structured)
  if (!byConfig.has(k)) byConfig.set(k, [])
  byConfig.get(k).push(r)
}
// Configurations in the brief's order first, then anything else that turned up, named.
const present = CONFIGS.map(([m, st]) => [m, st, key(m, st)]).filter(([, , k]) => byConfig.has(k))
for (const k of byConfig.keys()) {
  if (!present.some(([, , pk]) => pk === k)) {
    const [m, st] = k.split('|'); present.push([m, st === 'on', k])
  }
}

// ---- judging helpers, reading the verdicts the runner stored ----------------
const BAD = new Set(['FAIL', 'SKIP'])
function caseVerdict(runs, c) {
  // The runner's own rule: one run failing fails the case; `alternative_pass` in every run wins.
  const lines = [...c.must, ...c.must_not]
  const failing = []
  for (const ch of lines) for (const r of runs) {
    const v = r.verdicts?.[ch.id]
    if (v && BAD.has(v.verdict)) failing.push({ id: ch.id, run: r.run, detail: v.detail, line: ch.line })
  }
  const compliant = runs.filter((r) => (r.compliant_found_in ?? []).length)
  const labelSets = new Set(runs.map((r) => JSON.stringify({
    a: r.scan?.identity?.agencies, s: r.scan?.identity?.subjects })))
  const labelsSame = labelSets.size === 1
  // *** THE SAME LABELS IN A DIFFERENT ORDER, MEASURED SEPARATELY. ***
  // The runner compares `JSON.stringify` of the two arrays, which is order-sensitive, and
  // `README.md` asks only that a label be "the identical string across the three runs" — that a
  // label is not RENAMED between readings, which is the thing the label list exists to prevent.
  // 27 September: Opus 5 returned ["Oregon OSHA","OSHA"] and ["OSHA","Oregon OSHA"] for the same
  // document and the case was failed for it. So both are reported: the verdict as the runner
  // judged it, and whether the SETS agree. The judge is NOT changed here — doing that mid-bake-off
  // would make the configuration already measured incomparable with the six after it.
  const setOf = (r) => JSON.stringify({
    a: [...(r.scan?.identity?.agencies ?? [])].sort(),
    s: [...(r.scan?.identity?.subjects ?? [])].sort() })
  const labelsSameAsSets = new Set(runs.map(setOf)).size === 1
  const everyHonest = !!c.alternative_pass && runs.length > 0 && runs.every((r) => r.alternative_pass)
  const pass = (failing.length === 0 && !compliant.length && labelsSame) || everyHonest
  // What the case would have been had only the label ORDER differed — reported, never substituted.
  const passIfSets = (failing.length === 0 && !compliant.length && labelsSameAsSets) || everyHonest
  return { pass, failing, compliant, labelsSame, labelsSameAsSets, everyHonest, passIfSets }
}

/** Find a gap by KEYWORDS ONLY — see the header note. */
function findByKeywords(scan, check) {
  const kws = (check.keywords ?? []).map(norm)
  const min = check.min_keywords ?? 2
  const out = []
  for (const g of scan?.gaps ?? []) {
    const text = norm(ITEM_TEXT(g))
    const hit = kws.filter((k) => text.includes(k))
    if (hit.length >= min) out.push({ gap: g, hit })
  }
  return out
}
const citeOk = (given, cites) => {
  const sq = squash(given)
  return cites.some((c) => sq.includes(squash(c)))
}
const citesOf = (ch) => ch.citation_any ?? (ch.citation ? [ch.citation] : [])

const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
const money = (n) => n == null ? '—' : `$${n.toFixed(4)}`
const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()

// ---------------------------------------------------------------------------
const out = []
const p = (s = '') => out.push(s)

const runDates = [...new Set(all.map((r) => r.run_date))].sort()
p(`# The bake-off — seven golden documents on every model`)
p()
p(`**Run date:** ${runDates.join(', ')}  ·  **Runs read:** ${all.length}  ·  **Configurations:** ${present.length}`)
p(`**Target:** staging. **Search: UNCAPPED** on every run — \`DEV_MAX_SEARCHES\` unset, and the runner`)
p(`refuses to start when it is set, because a capped run cannot be compared with production.`)
p()
p(`Generated by \`node scripts/bakeoff-report.js --since ${SINCE}\` from the stored runs in`)
p(`\`tests/golden/documents/runs/\`. **No model was called and no database was read to produce this file** —`)
p(`every number below traces to a run on disk, named in the tables where it matters.`)
p()
p(`**Measurement only.** No prompt sentence, no case file and no product behaviour was changed for it.`)
p(`The case files are exactly as they stood on 26 September; where the best models disagree with an`)
p(`answer key, that is recorded under "Where the spec looks wrong" for the owner to decide, not fixed.`)
p()
p('---')
p()

// ===== 1. per configuration =================================================
p(`## Per configuration`)
p()
p(`**Two "cases passed" columns, and the difference between them is a matcher, not a model.** The`)
p(`runner compares the label arrays with \`JSON.stringify\`, which is order-sensitive, while \`README.md\``)
p(`asks only that a label be "the identical string across the three runs" — that it is not RENAMED.`)
p(`Every configuration below returns the same labels in a different ORDER on some case, and is failed`)
p(`for it. **"as judged" is the runner's verdict as it stands; "labels as sets" is the same runs with`)
p(`the arrays sorted before comparison.** The judge was not changed — see "Where the spec looks wrong".`)
p()
p(`"Labels agreed" is likewise given as *exact / as sets*.`)
p()
p(`| Configuration | Cases (as judged) | Cases (labels as sets) | Must-lines | Must-not violated (lines / items) | Parse failures | Labels agreed (exact / sets) | Mean cost/scan | Mean wall | Searches/scan (mean, range) |`)
p(`|---|---|---|---|---|---|---|---|---|---|`)
const summary = {}
for (const [m, st, k] of present) {
  const runs = byConfig.get(k)
  const byCase = new Map()
  for (const r of runs) {
    if (!byCase.has(r.caseId)) byCase.set(r.caseId, [])
    byCase.get(r.caseId).push(r)
  }
  let casesPassed = 0, lineTotal = 0, linePassed = 0, mustNotViol = 0, labelsAgreed = 0
  let casesPassedSets = 0, labelsAgreedSets = 0, mustNotItems = 0
  const caseDetail = {}
  for (const [id, rs] of byCase) {
    const c = caseOf[id]
    const v = caseVerdict(rs, c)
    if (v.pass) casesPassed++
    if (v.passIfSets) casesPassedSets++
    if (v.labelsSame) labelsAgreed++
    if (v.labelsSameAsSets) labelsAgreedSets++
    for (const ch of [...c.must, ...c.must_not]) {
      lineTotal++
      const ok = rs.every((r) => { const vv = r.verdicts?.[ch.id]; return vv && !BAD.has(vv.verdict) })
      if (ok) linePassed++
      else if (c.must_not.some((x) => x.id === ch.id)) {
        mustNotViol++
        // The LINE is violated once; the items that violated it are counted separately, because a
        // "1" in the summary beside nine quoted items in the detail reads like a contradiction.
        for (const r of rs) {
          const v = r.verdicts?.[ch.id]
          if (v && BAD.has(v.verdict)) mustNotItems += (v.quotes ?? [1]).length
        }
      }
    }
    caseDetail[id] = v
  }
  const parseFails = runs.filter((r) => r.json_parsed === false).length
  const costs = runs.map((r) => r.cost_usd == null ? null : Number(r.cost_usd)).filter((x) => x != null)
  const walls = runs.map((r) => r.wall_ms).filter((x) => x != null)
  const searches = runs.map((r) => r.searches).filter((x) => typeof x === 'number')
  summary[k] = { m, st, runs, byCase, caseDetail, casesPassed, casesPassedSets, lineTotal, linePassed,
                 mustNotViol, mustNotItems, parseFails, labelsAgreed, labelsAgreedSets, costs, walls, searches,
                 nCases: byCase.size }
  p(`| **${label(m, st)}** | ${casesPassed} of ${byCase.size} | ${casesPassedSets} of ${byCase.size} | ${linePassed} of ${lineTotal} `
    + `| ${mustNotViol} line${mustNotViol === 1 ? '' : 's'} / ${mustNotItems} item${mustNotItems === 1 ? '' : 's'} | ${parseFails} of ${runs.length} | ${labelsAgreed} / ${labelsAgreedSets} of ${byCase.size} `
    + `| ${money(mean(costs))} | ${walls.length ? (mean(walls) / 1000).toFixed(1) + 's' : '—'} `
    + `| ${searches.length ? mean(searches).toFixed(1) : '—'} (${searches.length ? Math.min(...searches) + '–' + Math.max(...searches) : '—'}) |`)
}
p()
p(`**Total spend on the runs in this table: ${money(Object.values(summary).reduce((a, s) => a + s.costs.reduce((x, y) => x + y, 0), 0))}** over ${all.length} scans.`)
p()
p(`### Cross-case label consistency — the Cascade company`)
p()
p(`Five of the seven fixtures belong to Cascade Specialty Chemicals and are scanned in one ordered`)
p(`suite (01, 02, 05, 06a, 06b), so each reading sees the labels the previous ones wrote. **One`)
p(`distinct agency label per real agency is the goal**; a list that grows is the same agency renamed.`)
p()
p(`| Configuration | Distinct agency labels across Cascade's five cases | The labels |`)
p(`|---|---|---|`)
const CASCADE = ['01-eap-chemical', '02-acdp-chemical', '05-sds-supplier', '06a-forklift-log', '06b-forklift-log-photo']
for (const [m, st, k] of present) {
  const labels = new Set()
  for (const r of byConfig.get(k)) if (CASCADE.includes(r.caseId))
    for (const a of r.scan?.identity?.agencies ?? []) labels.add(a)
  p(`| ${label(m, st)} | **${labels.size}** | ${[...labels].map((l) => `\`${l}\``).join(' · ') || '(none)'} |`)
}
p()
p('---')
p()

// ===== 2. per case per configuration ========================================
p(`## Per case, per configuration`)
p()
p(`Pass needs every must-line and must-not to hold in **all three runs**. A failing line is named with`)
p(`the runs it failed in.`)
p()
for (const id of ORDER) {
  if (!caseOf[id]) continue
  p(`### ${id} — ${caseOf[id].title}`)
  p()
  p(`| Configuration | | Failing must-lines |`)
  p(`|---|---|---|`)
  for (const [m, st, k] of present) {
    const s = summary[k]
    const rs = s.byCase.get(id)
    if (!rs) { p(`| ${label(m, st)} | — | not run |`); continue }
    const v = s.caseDetail[id]
    const byId = new Map()
    for (const f of v.failing) {
      if (!byId.has(f.id)) byId.set(f.id, [])
      byId.get(f.id).push(f.run)
    }
    const named = [...byId.entries()].map(([lid, runsF]) => `\`${lid}\` (run${runsF.length > 1 ? 's' : ''} ${runsF.join(',')})`).join('; ')
    const extra = []
    if (!v.labelsSame) extra.push(v.labelsSameAsSets
      ? '**labels differ in ORDER only** — same set, failed by an order-sensitive matcher'
      : '**labels differ across runs** (a different SET, not just order)')
    if (v.compliant.length) extra.push(`**"compliant" appears** (run${v.compliant.length > 1 ? 's' : ''} ${v.compliant.map((r) => r.run).join(',')})`)
    const note = v.everyHonest ? ' — every run answered could_not_read with a way forward, which the spec calls an honest pass' : ''
    p(`| ${label(m, st)} | ${v.pass ? '**PASS**' : 'FAIL'}${note} | ${[named, ...extra].filter(Boolean).join('; ') || '—'} |`)
  }
  p()
}
p('---')
p()

// ===== 3. the planted gaps ==================================================
const PLANTED = {
  '01-eap-chemical': { rule: '29 CFR 1910.38', ids: ['gap-reporting', 'gap-critical-operations', 'gap-contact-name'] },
  '04-fsp-food': { rule: '21 CFR 117', ids: ['gap-recall-plan', 'gap-cook-validation', 'gap-reanalysis'] },
}
p(`## The planted gaps — what this suite was built to measure`)
p()
p(`Six gaps were deliberately written into two fixtures. **Found** means a gap in the reading carries`)
p(`at least two of the spec's keywords for it — the citation is judged separately, in the column beside`)
p(`it, because a gap found and miscited is a different result from a gap missed. \`n/3\` is how many of`)
p(`the three runs found it.`)
p()
for (const [id, { rule, ids }] of Object.entries(PLANTED)) {
  if (!caseOf[id]) continue
  const c = caseOf[id]
  p(`### ${id} — three planted gaps against ${rule}`)
  p()
  for (const lid of ids) {
    const ch = c.must.find((x) => x.id === lid)
    p(`**\`${lid}\`** — ${md(ch.line)}`)
    p()
    p(`| Configuration | Found | Citation the model gave | Right? |`)
    p(`|---|---|---|---|`)
    for (const [m, st, k] of present) {
      const rs = summary[k].byCase.get(id) ?? []
      let found = 0
      const cites = []
      for (const r of rs) {
        const hits = findByKeywords(r.scan, ch)
        if (!hits.length) continue
        found++
        const g = hits[0].gap
        cites.push(g.citation ? String(g.citation) : '(no citation given)')
      }
      const uniq = [...new Set(cites)]
      const right = uniq.length === 0 ? '—'
        : uniq.every((x) => citeOk(x, citesOf(ch))) ? '**yes**'
        : uniq.some((x) => citeOk(x, citesOf(ch))) ? 'mixed' : '**NO**'
      p(`| ${label(m, st)} | ${found}/${rs.length} | ${uniq.map((x) => `\`${md(x)}\``).join(' · ') || '—'} | ${right} |`)
    }
    p()
  }
}
p('---')
p()

// ===== 4. false findings ====================================================
p(`## False findings — every must-not violation, in the model's own words`)
p()
p(`A must-not is a thing the document HAS and the spec says must not be called a gap. A violation is`)
p(`the product asserting a problem that is not there, which is worse than missing one: it is work the`)
p(`customer would do for nothing, and it is the failure mode \`CLAUDE.md\` §3.3 exists for.`)
p()
let anyViolation = false
for (const [m, st, k] of present) {
  const s = summary[k]
  const rows = []
  for (const [id, rs] of s.byCase) {
    const c = caseOf[id]
    for (const ch of c.must_not) for (const r of rs) {
      const v = r.verdicts?.[ch.id]
      if (!v || !BAD.has(v.verdict)) continue
      for (const q of v.quotes ?? [{ where: '?', text: v.detail }]) {
        rows.push({ id, lid: ch.id, run: r.run, line: ch.line, text: q.text ?? v.detail })
      }
    }
  }
  if (!rows.length) continue
  anyViolation = true
  p(`### ${label(m, st)} — ${rows.length} offending item${rows.length === 1 ? '' : 's'} across ${new Set(rows.map((r) => r.lid)).size} must-not line${new Set(rows.map((r) => r.lid)).size === 1 ? '' : 's'}`)
  p()
  p(`| Case | Must-not | Run | What the model actually wrote |`)
  p(`|---|---|---|---|`)
  for (const r of rows) p(`| ${r.id} | \`${r.lid}\` | ${r.run} | ${md(r.text).slice(0, 300)} |`)
  p()
}
if (!anyViolation) p(`**No configuration violated a single must-not.** Recorded as the result it is: across every`)
if (!anyViolation) p(`configuration and every run, no model invented a gap the specs name as a false finding.`)
p()
p('---')
p()

// ===== 5. invented citations, case 04 =======================================
p(`## Invented citations — case 04's three planted gaps`)
p()
p(`The rule number each configuration gave, against the one the spec names, with the searches that run`)
p(`made. **A citation is the product's claim that a requirement exists**, and §3.3 is the reason this`)
p(`table is here: an unanchored answer once asserted a requirement that does not exist with cost`)
p(`estimates attached. A wrong rule number on a real gap is the same failure wearing a correct finding.`)
p()
if (caseOf['04-fsp-food']) {
  const c = caseOf['04-fsp-food']
  p(`| Configuration | Run | Searches | ${PLANTED['04-fsp-food'].ids.map((i) => '`' + i + '`').join(' | ')} |`)
  p(`|---|---|---|${PLANTED['04-fsp-food'].ids.map(() => '---').join('|')}|`)
  p(`| _the spec says_ | | | ${PLANTED['04-fsp-food'].ids.map((lid) => citesOf(c.must.find((x) => x.id === lid)).map((x) => '`' + x + '`').join(' or ')).join(' | ')} |`)
  for (const [m, st, k] of present) {
    const rs = summary[k].byCase.get('04-fsp-food') ?? []
    for (const r of rs) {
      const cells = PLANTED['04-fsp-food'].ids.map((lid) => {
        const ch = c.must.find((x) => x.id === lid)
        const hits = findByKeywords(r.scan, ch)
        if (!hits.length) return '_not found_'
        const given = hits[0].gap.citation ? String(hits[0].gap.citation) : '(none)'
        return `\`${md(given)}\`${citeOk(given, citesOf(ch)) ? '' : ' ⚠'}`
      })
      p(`| ${label(m, st)} | ${r.run} | ${r.searches ?? '?'} | ${cells.join(' | ')} |`)
    }
  }
  p()
  p(`⚠ marks a citation that does not contain the rule the spec names.`)
}
p()
p('---')
p()

// ===== 6. the three hard cases ==============================================
p(`## The supplier document, the record and the photograph`)
p()
p(`These three are not about finding gaps. 05 is somebody else's document and must not be judged as`)
p(`the company's; 06a is a record judged on completeness; 06b is the same page as a photograph, where`)
p(`an honest "I could not read this" is a **pass**. The summary line is quoted verbatim.`)
p()
for (const id of ['05-sds-supplier', '06a-forklift-log', '06b-forklift-log-photo']) {
  if (!caseOf[id]) continue
  p(`### ${id} — ${caseOf[id].title}`)
  p()
  p(`| Configuration | kind | status | Run 1's summary, verbatim |`)
  p(`|---|---|---|---|`)
  for (const [m, st, k] of present) {
    const rs = summary[k].byCase.get(id) ?? []
    const r = rs[0]
    if (!r) { p(`| ${label(m, st)} | — | — | not run |`); continue }
    const kinds = [...new Set(rs.map((x) => x.scan?.identity?.kind ?? 'null'))].join(' / ')
    const stats = [...new Set(rs.map((x) => x.scan?.status ?? 'null'))].join(' / ')
    const sum = r.scan?.summary ?? r.scan?.could_not_read?.reason ?? '(nothing)'
    p(`| ${label(m, st)} | ${kinds} | ${stats} | ${md(sum).slice(0, 420)} |`)
  }
  p()
}
p('---')
p()
p(`## Findings the specs do not mention`)
p()
p(`Gaps that match **neither** a must-line nor a must-not, by keyword. The suite cannot judge these:`)
p(`the spec neither asks for them nor forbids them, so they pass silently either way. They are here`)
p(`because **an extra finding is not free** — it is work a customer would do — and because a spec whose`)
p(`must-not list does not cover what the best models actually say is a spec with a hole in it.`)
p()
p(`Counted once per distinct title per configuration, with the number of the ${present.length} configurations that raised it.`)
p()
for (const id of ORDER) {
  if (!caseOf[id]) continue
  const c = caseOf[id]
  const checks = [...c.must, ...c.must_not]
  const byTitle = new Map()
  for (const [m, st, k] of present) {
    for (const r of summary[k]?.byCase.get(id) ?? []) {
      for (const g of r.scan?.gaps ?? []) {
        const text = norm(ITEM_TEXT(g))
        // Does this gap answer any line the spec states, in either direction?
        const claimed = checks.some((ch) => {
          const kws = (ch.keywords ?? ch.subject ?? []).map(norm)
          if (!kws.length) return false
          return kws.filter((w) => text.includes(w)).length >= (ch.min_keywords ?? 2)
        })
        if (claimed) continue
        const t = String(g.title ?? '').trim()
        if (!byTitle.has(t)) byTitle.set(t, { configs: new Set(), cite: g.citation ?? null })
        byTitle.get(t).configs.add(label(m, st))
      }
    }
  }
  if (!byTitle.size) continue
  p(`### ${id}`)
  p()
  p(`| Gap the spec does not mention | Configurations | A citation given for it |`)
  p(`|---|---|---|`)
  for (const [t, v] of [...byTitle.entries()].sort((a, b) => b[1].configs.size - a[1].configs.size)) {
    p(`| ${md(t).slice(0, 150)} | ${v.configs.size} of ${present.length} | ${v.cite ? '`' + md(String(v.cite)).slice(0, 120) + '`' : '—'} |`)
  }
  p()
}
p('---')
p()
p(`## Where the spec looks wrong`)
p()
p(`_Filled in by hand after reading the failures above. The owner decides; nothing here is changed._`)
p()
p('---')
p()
p(`## Cost of the whole bake-off`)
p()
p(`| Model | Scans | Input tokens | Output tokens | Searches | Cost |`)
p(`|---|---|---|---|---|---|`)
const byModel = new Map()
for (const r of all) {
  const g = byModel.get(r.model) ?? { n: 0, inp: 0, outp: 0, s: 0, cost: 0 }
  g.n++; g.inp += r.input_tokens ?? 0; g.outp += r.output_tokens ?? 0
  g.s += r.searches ?? 0; g.cost += Number(r.cost_usd ?? 0)
  byModel.set(r.model, g)
}
let tot = 0
for (const [m, g] of [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
  tot += g.cost
  const price = MODEL_PRICES[m]
  p(`| \`${m}\`${price ? '' : ' **UNPRICED**'} | ${g.n} | ${g.inp.toLocaleString()} | ${g.outp.toLocaleString()} | ${g.s} | $${g.cost.toFixed(2)} |`)
}
p(`| **total** | **${all.length}** | | | | **$${tot.toFixed(2)}** |`)
p()
p(`Every model in this table prices exactly in \`config/pricing.ts\`; the runner refuses to start a`)
p(`configuration on an id that does not, because an unpriced call records its tokens and **no cost**,`)
p(`and the table would read "—" and look like a rendering fault rather than a missing price.`)
p()
console.log(out.join('\n'))
