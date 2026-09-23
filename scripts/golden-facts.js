// THE GOLDEN FACTS — Fix Round 1 (G). `TESTING.md` (b), `DECISIONS.md` §128.
//
//   npm run golden:facts                       all five, current switches, effort from AI_EFFORT
//   npm run golden:facts -- seattle            one case, by id prefix
//   npm run golden:facts -- --effort medium    override the effort for this run
//   npm run golden:facts -- --runs 3           repeat each case N times (Fix Round 1 H)
//   npm run golden:facts -- --verbose          print each answer in full
//
// *** ON DEMAND. NEVER IN `npm run check`. *** Every case is a real web-searching answer on the
// prose model: it costs money and takes tens of seconds. A quality gate that spends money is a
// quality gate people stop running.
//
// ---------------------------------------------------------------------------
// WHAT THIS ANSWERS, AND WHAT IT CANNOT.
//
// It answers ONE question: does the answer still contain the facts a correct answer must
// contain? It is a presence check on plain text. It cannot tell you an answer is *good*, it
// cannot tell you a new answer is worse than the old one, and a passing run is not a verified
// answer — `TESTING.md` is explicit that a model checking a model produces agreement, and
// agreement is not verification. These are regression tripwires, nothing more.
//
// *** AND THE FIVE QUESTIONS ARE THE OWNER'S OWN, COPIED OUT OF `topics` ON STAGING. ***
// Not paraphrases. They are what he typed during the 22-23 September test pass, so a failure
// here is a failure on the exact input that produced the answer he read.
//
// *** AN EXPECTED FAILURE IS RECORDED, NOT DELETED. *** `ohio-hazmat` misses MCS-150 today.
// Dropping the check would make the suite green by removing the only thing that knows the
// answer is incomplete. It is marked `expectedFail`, it is run every time, and the summary
// counts it separately — so the day it starts passing is visible too.
// ---------------------------------------------------------------------------

import { askAIOpenStream } from '../lib/ai.ts'
import { buildSystemPrompt } from '../prompts/checklist.ts'
import { describePipelineConfig } from '../lib/pipelineConfig.ts'
import { EFFORT_LEVELS, modelForTask } from '../lib/ai.ts'
import { estimateCost } from '../lib/costLedger.ts'

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const flagValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const effortArg = flagValue('--effort', null)
// `--model` compares one model against another on the same questions. It does NOT change any
// default: the resolved model is printed at the top of every run, so the output says what was
// actually asked rather than what the environment happened to hold.
const modelArg = flagValue('--model', null)
// *** THREE RUNS PER QUESTION, NOT ONE — the owner's decision, 23 September. ***
// One run of a presence check on a model's prose is an anecdote. Measured on the same Seattle
// question with nothing changed between runs: 4/4, 3/4, 3/4 — and the misses were DIFFERENT
// facts. A single run would have reported any one of those three as the result.
const DEFAULT_RUNS = 3
const runs = Number(flagValue('--runs', String(DEFAULT_RUNS)))
// Every flag VALUE must be excluded here, or `--model claude-sonnet-5` is read as a case-id
// filter and the run silently matches no case.
const flagValues = new Set([effortArg, modelArg, String(runs)].filter(Boolean))
const only = args.find((a) => !a.startsWith('--') && !flagValues.has(a))

if (effortArg && !EFFORT_LEVELS.includes(effortArg)) {
  console.error(`\n  --effort must be one of ${EFFORT_LEVELS.join(', ')} — got ${JSON.stringify(effortArg)}\n`)
  process.exit(1)
}
if (!Number.isInteger(runs) || runs < 1) { console.error('\n  --runs must be a positive integer\n'); process.exit(1) }
if (!process.env.ANTHROPIC_API_KEY) { console.error('\n  ANTHROPIC_API_KEY is not set.\n'); process.exit(1) }

// ---------------------------------------------------------------------------
// The cases. Each fact is a predicate over the answer text and a sentence saying what it is
// looking for, so a FAIL names the missing fact rather than printing a regex.
// ---------------------------------------------------------------------------
const has = (...res) => (t) => res.some((re) => re.test(t))

export const CASES = [
  {
    id: 'seattle-restaurant',
    question: "I'm opening a second restaurant in Seattle with about 25 staff. What do I need for food handler permits and paid sick leave?",
    facts: [
      { id: 'food-handler-14-days', says: 'a food handler card is due within 14 days of starting',
        test: has(/\b14 days\b/i, /\bfourteen days\b/i) },
      { id: 'accrual-1-per-40', says: 'paid sick time accrues at 1 hour per 40 hours worked',
        test: (t) => /\b1 hour\b/i.test(t) && /\b40 hours\b/i.test(t) },
      { id: 'tier-counted-across-locations', says: 'the Seattle sick-leave TIER is counted across BOTH locations, not per restaurant',
        test: has(/across (both|all) (your )?(locations|sites|restaurants)/i, /combined.{0,40}(locations|restaurants|sites)/i,
                  /(company|business)[- ]wide/i, /all employees.{0,30}(company|business|both|all locations)/i,
                  /count(ing|ed)? (all|both).{0,40}(locations|restaurants|sites)/i) },
      { id: 'plan-review-or-permit', says: 'the new premises needs plan review or a food establishment permit',
        test: has(/plan review/i, /establishment permit/i, /permit to operate/i, /food business permit/i) },
    ],
  },
  {
    id: 'california-hospice',
    question: "We're a hospice agency in California with 12 caregivers who drive to patients' homes. What are our obligations for mileage reimbursement and overtime?",
    facts: [
      { id: 'travel-between-patients-is-hours-worked',
        says: 'travel BETWEEN patients during the day is hours worked and must be paid',
        test: (t) => /(between|from one) (patient|client|visit|home)/i.test(t)
          && /(hours worked|compensable|must be paid|is paid time|counts as (paid )?(work|time))/i.test(t) },
    ],
  },
  {
    id: 'texas-roofing',
    question: "We're a 40-person roofing contractor in Texas. What fall protection and safety training do we need?",
    facts: [
      { id: 'six-feet', says: 'the construction fall-protection trigger height is 6 feet',
        test: has(/\b6 (feet|ft)\b/i, /\bsix feet\b/i) },
    ],
  },
  {
    id: 'oregon-butane',
    question: "We're opening a cannabis extraction lab in Oregon using butane. What licenses and safety requirements apply?",
    facts: [
      { id: 'moratorium-or-hb4121', says: 'the Oregon licence moratorium, or HB 4121, which imposed it',
        test: has(/moratorium/i, /\bHB ?4121\b/i, /House Bill 4121/i) },
    ],
  },
  {
    id: 'ohio-hazmat',
    // *** THE RECORDED MISS — AND IT PASSED ON 23 SEPTEMBER. *** 22 September: the answer
    // covered the hazmat registration, training and placarding and never mentioned updating the
    // MCS-150. On 23 Sep, on claude-opus-5 at effort high with RESEARCH_PREFER_GOV and
    // RESEARCH_SPECIALIST both ON, it named it — the runner reported 🆕 FIXED.
    //
    // **It stays on this list on ONE observation, deliberately.** These are presence checks on a
    // model's prose and they vary run to run: the same Seattle question passed all four facts in
    // one run and missed `accrual-1-per-40` in the next, same switches, same effort. Flipping the
    // expectation on a single pass would trade a quiet known gap for a suite that goes red at
    // random. Passing is never silent — it prints as FIXED every time — so neither state hides.
    // Flip it when it has passed across several runs, and say in the commit which runs.
    expectedFail: ['mcs-150'],
    question: "We're a small freight company in Ohio thinking about adding hazmat loads. What would we need before hauling our first hazmat shipment?",
    facts: [
      { id: 'mcs-150', says: 'the MCS-150 must be updated to add the hazmat classification',
        test: has(/\bMCS[- ]?150\b/i) },
      { id: 'hazmat-registration', says: 'the PHMSA/DOT hazardous materials registration',
        test: has(/registration/i) },
    ],
  },
]

// ---------------------------------------------------------------------------
// One run of one case: the SAME open call the research route makes.
// ---------------------------------------------------------------------------
async function runOnce(c) {
  const system = buildSystemPrompt('research', null, { open: true })
  const started = Date.now()
  let answer = null, stopReason = null, outputTokens = null, inputTokens = null, error = null, searches = 0
  for await (const ev of askAIOpenStream(system, [{ role: 'user', content: c.question }],
                                         { maxTokens: 16000,
                                           ...(effortArg ? { effort: effortArg } : {}),
                                           ...(modelArg ? { model: modelArg } : {}),
                                           // *** THESE RUNS GO IN THE LEDGER TOO (§128 J.1). ***
                                           // They were not, and the price correction on 23 Sep
                                           // then had to be applied to a model comparison by
                                           // reconstructing its input tokens from its printed
                                           // cost. `companyId: null` is correct and allowed by
                                           // migration 038: a script has no tenant, and a call
                                           // with no tenant still cost money.
                                           ledger: { companyId: null, task: 'research' } })) {
    if (ev.type === 'searching') searches++
    else if (ev.type === 'done') {
      answer = ev.answer; stopReason = ev.stopReason
      outputTokens = ev.outputTokens; inputTokens = ev.inputTokens
      searches = ev.searches ?? searches
    }
    else if (ev.type === 'error') error = ev.message
  }
  const ms = Date.now() - started
  // Priced here rather than read back from the ledger, so the report stands on its own even
  // against a database that has not applied migration 038.
  const cost = estimateCost({ model: modelArg || modelForTask('prose'),
    inputTokens: inputTokens ?? 0, outputTokens: outputTokens ?? 0, searches })
  // `AIAnswer` is `{ text, sources }`. The name `research` belongs to the ROUTE's NDJSON event,
  // not to the library — reading it here returned undefined and reported every fact as missing
  // on a perfectly good answer. Caught on the first run of this file.
  const text = answer?.text ?? ''
  const results = c.facts.map((f) => {
    const found = !!text && f.test(text)
    const expected = (c.expectedFail ?? []).includes(f.id)
    // FOUR verdicts, and the two on the right are the reason this file is worth having:
    // an expected miss that is still missing is not a regression, and an expected miss that
    // has started passing is news.
    const verdict = found ? (expected ? 'FIXED' : 'PASS') : (expected ? 'KNOWN' : 'FAIL')
    return { ...f, found, expected, verdict }
  })
  return { c, text, ms, stopReason, outputTokens, inputTokens, searches, error, results, cost }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const cases = CASES.filter((c) => !only || c.id.startsWith(only))
if (!cases.length) { console.error(`\n  No case id starts with "${only}". Known: ${CASES.map((c) => c.id).join(', ')}\n`); process.exit(1) }

console.log(`\n  Model   : ${modelArg || modelForTask('prose')}${modelArg ? '   (--model override; no default changed)' : ''}`)
console.log(`  Effort  : ${effortArg ?? `${process.env.AI_EFFORT || '(unset — API default high)'} (from the environment)`}`)
console.log(`  Cases   : ${cases.length}${runs > 1 ? ` × ${runs} runs` : ''}`)
console.log(`  ${describePipelineConfig()}\n`)

const line = '  ' + '─'.repeat(90)
let pass = 0, fail = 0, known = 0, fixed = 0
const timings = []
/** One row per fact per run, so the summary can report a hit rate rather than a mean. */
const factRuns = []

for (const c of cases) {
  for (let i = 1; i <= runs; i++) {
    const r = await runOnce(c)
    console.log(line)
    console.log(`  ${c.id}${runs > 1 ? `  run ${i}/${runs}` : ''}   ${(r.ms / 1000).toFixed(1)}s   ` +
      `in=${r.inputTokens ?? '?'} out=${r.outputTokens ?? '?'}   ${r.searches} search(es)   ` +
      `${r.cost.costUsd === null ? 'UNPRICED' : `$${r.cost.costUsd.toFixed(4)}`}   stop=${r.stopReason ?? '?'}`)
    if (r.error) { console.log(`    ERROR: ${r.error}`) }
    for (const f of r.results) factRuns.push({ caseId: c.id, factId: f.id, found: f.found })
    timings.push({ id: c.id, run: i, ms: r.ms, outputTokens: r.outputTokens,
      inputTokens: r.inputTokens, costUsd: r.cost.costUsd,
      passed: r.results.filter((x) => x.verdict === 'PASS' || x.verdict === 'FIXED').length,
      total: r.results.length })
    for (const f of r.results) {
      const mark = { PASS: '✅', FAIL: '❌', KNOWN: '➖', FIXED: '🆕' }[f.verdict]
      console.log(`    ${mark} ${f.verdict.padEnd(5)} ${f.id.padEnd(34)} ${f.says}`)
      if (f.verdict === 'PASS') pass++
      else if (f.verdict === 'FAIL') fail++
      else if (f.verdict === 'KNOWN') known++
      else fixed++
    }
    if (verbose) console.log('\n' + r.text.split('\n').map((l) => '      ' + l).join('\n') + '\n')
  }
}

console.log(line)
console.log(`  ${pass} passed · ${fail} FAILED · ${known} known-missing (expected) · ${fixed} newly passing`)

// ---------------------------------------------------------------------------
// THE SPREAD, WHICH IS THE POINT OF RUNNING MORE THAN ONCE.
//
// A fact that passes 3 of 3 and a fact that passes 2 of 3 are different findings and a mean
// hides the difference. This prints every fact's hit rate and names the ones that are not
// stable — those are where the answer is a coin toss, which nobody can tell from one run.
// ---------------------------------------------------------------------------
if (runs > 1) {
  console.log(line)
  console.log(`  FACT STABILITY over ${runs} run(s) — anything not ${runs}/${runs} is not settled`)
  for (const c of cases) {
    for (const f of c.facts) {
      const hits = factRuns.filter((r) => r.caseId === c.id && r.factId === f.id)
      const got = hits.filter((r) => r.found).length
      const expected = (c.expectedFail ?? []).includes(f.id)
      const mark = got === hits.length ? '  ' : got === 0 ? '✗ ' : '~ '
      console.log(`  ${mark}${String(got)}/${hits.length}  ${c.id.padEnd(20)} ${f.id}` +
        (expected ? '   (expectedFail)' : ''))
    }
  }
}
if (runs > 1) {
  console.log(line)
  console.log('  per run: wall clock · output tokens · facts')
  for (const t of timings) {
    console.log(`    ${t.id.padEnd(22)} run ${t.run}   ${(t.ms / 1000).toFixed(1)}s`.padEnd(48) +
      `${String(t.outputTokens ?? '?').padStart(6)} out   ${t.passed}/${t.total} facts   ` +
      `${t.costUsd === null ? 'UNPRICED' : `$${t.costUsd.toFixed(4)}`}`)
  }
  const byCase = [...new Set(timings.map((t) => t.id))]
  for (const id of byCase) {
    const rows = timings.filter((t) => t.id === id)
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
    const costs = rows.map((r) => r.costUsd).filter((c) => c !== null)
    console.log(`    ${id.padEnd(22)} MEAN    ${(avg(rows.map((r) => r.ms)) / 1000).toFixed(1)}s`.padEnd(48) +
      `${String(Math.round(avg(rows.map((r) => r.outputTokens ?? 0)))).padStart(6)} out   ` +
      `${avg(rows.map((r) => r.passed)).toFixed(1)}/${rows[0].total} facts   ` +
      `${costs.length ? `$${avg(costs).toFixed(4)}` : 'UNPRICED'}`)
  }
}
console.log(line + '\n')
if (fixed) console.log(`  ${fixed} fact(s) marked expectedFail are now PASSING. Update the expectedFail list.\n`)

// A known miss is not a failing run: it is a recorded gap. Only an unexpected FAIL is red.
process.exit(fail > 0 ? 1 : 0)
