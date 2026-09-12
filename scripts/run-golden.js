// THE GOLDEN-FILE RUNNER. TODO 2.8.
//
//   npm run golden                      run every case against STAGING
//   npm run golden -- 001               run one case, by id prefix
//   npm run golden -- --verbose         print each gate response in full
//   npm run golden -- --record          write the run back into the case file
//
// WHAT THIS ANSWERS, AND WHAT IT DOES NOT.
//
// It answers: for this one input, does the output still contain the facts a correct answer
// must contain? It CANNOT tell you a new answer is worse — that is a human reading the diff.
// TESTING.md (b). Run it after every prompt change, model upgrade, temperature change, or
// change to requirements matching — everything in CLAUDE.md §3.1, i.e. exactly the changes
// whose effects are invisible in a git diff.
//
// WHY IT EXISTS AS A COMMAND. The acceptance test for 2.2 was first run from a scratch file
// that was deleted afterwards. A harness reconstructed for each run is not a regression
// suite: it drifts from the code it tests, and nobody re-runs what they have to rebuild.
//
// WHY IT REBUILDS THE PROMPT FROM SOURCE. It reads lib/determinationGate.ts and reassembles
// the prompt the same way buildGatePrompt() does, then hashes it. A copy of the prompt in
// this file would be a copy that drifts — and the drift would be silent, because the tests
// would keep passing against the stale copy. The sha256 recorded in each case file is the
// tripwire: when it stops matching, the prompt changed and every stored result is suspect.
//
// PRODUCTION IS NEVER A TARGET. There is no --production flag and no way to add one by
// argument: these cases send real questions to a model and the answers are not written
// anywhere, but the company and site rows they read are staging's by construction.

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const CASE_DIR = 'tests/golden'
const GATE_SRC = 'lib/determinationGate.js'.replace('.js', '.ts')

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const record = args.includes('--record')
const only = args.find((a) => !a.startsWith('--'))

function die(msg) { console.error(`\n  ${msg}\n`); process.exit(1) }

const ref = process.env.SUPABASE_PROJECT_REF
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!ref || !url || !key) die('SUPABASE_PROJECT_REF / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (staging).')
if (!process.env.ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY is not set.')

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ---------------------------------------------------------------------------
// Rebuild the gate prompt from source. Never a copy.
// ---------------------------------------------------------------------------
const src = readFileSync(GATE_SRC, 'utf8')
function block(name) {
  const m = src.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`', 'm'))
  if (!m) die(`Could not find \`${name}\` in ${GATE_SRC}. The runner rebuilds the prompt from source and will not guess.`)
  return m[1]
}
function buildGatePrompt(outputType) {
  return [
    block('GATE_BODY'),
    outputType === 'checklist' ? block('THRESHOLD_CHECKLIST') : block('THRESHOLD_ANSWER'),
    block('OUTPUT_INSTRUCTION'),
  ].join('\n\n')
}
const sha = (s) => createHash('sha256').update(s).digest('hex')

// ---------------------------------------------------------------------------
// Assertions. Each case names its own; these are the checkers they resolve to.
//
// An assertion whose checker is not implemented reports SKIP, never PASS. A runner that
// silently passed what it could not check would be the worst possible version of this file:
// AUDIT-CHECKS.md's standard says a sweep that has only ever said "clean" is untested, and
// a green result nobody earned is worse than a red one.
// ---------------------------------------------------------------------------
const CHECKS = {
  'gate-asks':                 (r) => [r.outcome === 'ask', `outcome = ${r.outcome}`],
  'gate-proceeds':             (r) => [r.outcome === 'proceed', `outcome = ${r.outcome}`],
  'no-question-about-location':(r) => [r.outcome !== 'ask', `outcome = ${r.outcome}`],
  'gate-asks-for-packing-group': (r) => {
    if (r.outcome !== 'ask') return [false, 'did not ask at all']
    const blob = JSON.stringify(r.ask).toLowerCase()
    return [blob.includes('packing group'), blob.includes('packing group') ? 'named' : 'packing group never mentioned']
  },
  'gate-asks-once': (r) => {
    if (r.outcome !== 'ask') return [false, 'did not ask at all']
    return [typeof r.ask === 'object' && !Array.isArray(r.ask), Array.isArray(r.ask) ? 'ask is an ARRAY — the cap is broken' : 'one object']
  },
  'gate-pairs-with-unlocks': (r) => {
    if (r.outcome !== 'ask') return [false, 'did not ask at all']
    const n = Array.isArray(r.ask.unlocks) ? r.ask.unlocks.length : 0
    return [n > 0, `${n} unlocks listed`]
  },
  'jurisdiction-counts-as-known': (r) => {
    if (r.outcome !== 'proceed') return [false, 'did not proceed']
    const known = JSON.stringify(r.resolved?.known ?? []).toLowerCase()
    const hit = /worksite|oregon|hillsboro|washington/.test(known) && known.includes('ai_from_profile')
    return [hit, hit ? 'jurisdiction present, sourced from the profile' : 'jurisdiction NOT reported as known — the gate cannot see entities']
  },
  'employee-count-is-non-blocking': (r) => {
    if (r.outcome === 'ask') {
      const blob = JSON.stringify(r.ask).toLowerCase()
      if (/employee|headcount|how many people/.test(blob)) return [false, 'BLOCKED on employee count — every company would block, all 10 have it NULL']
      return [false, 'asked about something else when it should have proceeded']
    }
    return [true, 'not blocking']
  },
  // Structural, checked against the source rather than against a model response.
  //
  // COMMENTS ARE STRIPPED FIRST, and that is not a detail. The first version of this
  // checker read the raw file and reported ChecklistAnswer as having `conditional_on` —
  // because the interface carries a COMMENT saying "NO conditional_on". A checker that
  // cannot tell a field from a comment about the absence of that field would have sent
  // somebody looking for a bug that was not there. Found on its first run.
  'answer-may-hedge-here': () => {
    const raw = readFileSync('lib/answerSchema.ts', 'utf8')
    const schema = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const body = (name) => {
      const m = schema.match(new RegExp('interface ' + name + '\\s*\\{([\\s\\S]*?)\\n\\}'))
      return m ? m[1] : ''
    }
    const answerHas = /\bconditional_on\b/.test(body('AnswerPayload'))
    const checklistHas = /\b(conditional_on|depends_on|follow_up_questions|clarifying_questions)\b/.test(body('ChecklistAnswer'))
    return [answerHas && !checklistHas,
      `AnswerPayload.conditional_on ${answerHas ? 'present' : 'MISSING'}; ChecklistAnswer hedge/question field ${checklistHas ? 'PRESENT — must not be' : 'absent'}`]
  },
}

/** Assertions that need a person to read the answer text. Reported, never guessed at. */
const HUMAN = new Set([
  'no-oregon-agency',
  'states-not-covered-is-stated',
  'combination-packaging',
  'no-invented-fleet',
  'no-fabricated-specifics',
  'no-fabricated-rate',
  'oregon-agency-is-correct-here',
])

// ---------------------------------------------------------------------------
// Run one case.
// ---------------------------------------------------------------------------
async function runCase(file) {
  const path = `${CASE_DIR}/${file}`
  const c = JSON.parse(readFileSync(path, 'utf8'))
  if (!c.gate) return { file, skipped: 'no `gate` block — this case does not exercise the determination gate' }

  const outputType = c.input.outputType === 'checklist' ? 'checklist' : 'answer'
  const prompt = buildGatePrompt(outputType)
  const promptSha = sha(prompt)

  // THE TRIPWIRE. A changed prompt invalidates every stored expectation, and the whole
  // point of recording the hash is that the invalidation is loud.
  const promptChanged = c.gate.system_prompt_sha256 && c.gate.system_prompt_sha256 !== promptSha

  const { data: co } = await db.from('companies').select('id, name, industry')
    .eq('name', c.input.company?.name ?? '').maybeSingle()
  if (!co) return { file, skipped: `no company named "${c.input.company?.name}" on staging (${ref})` }

  const { data: site } = await db.from('entities').select('state, county, city')
    .eq('company_id', co.id).eq('is_primary', true).maybeSingle()
  const { data: est } = await db.from('company_switches').select('switch_id, value, source').eq('company_id', co.id)
  const { data: vocab } = await db.from('switches').select('id, label, question_plain')

  const known = []
  if (site?.state) known.push(`  worksite state = ${site.state}   [ai_from_profile]`)
  if (site?.county) known.push(`  worksite county = ${site.county}   [ai_from_profile]`)
  if (site?.city) known.push(`  worksite city = ${site.city}   [ai_from_profile]`)
  for (const e of est ?? []) known.push(`  ${e.switch_id} = ${e.value}   [${e.source}]`)

  const ctx = [
    'ESTABLISHED FACTS ABOUT THIS COMPANY:',
    known.length ? known.join('\n') : '  (none established — this is not the same as "none apply")',
    '',
    'VOCABULARY OF FACTS THIS PRODUCT CAN ASK ABOUT:',
    (vocab ?? []).length === 0
      ? '  (empty — the switch library is not seeded yet. Reason from the question and the\n   document alone, and return switch_id: null for anything you ask about.)'
      : (vocab ?? []).map((v) => `  ${v.id}: ${v.label}`).join('\n'),
    '',
    "THE USER'S QUESTION:",
    c.input.question,
  ].join('\n')

  const started = Date.now()
  const msg = await anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-5',
    max_tokens: c.gate.max_tokens ?? 1500,
    temperature: c.gate.temperature ?? 0.1,
    system: prompt,
    messages: [{ role: 'user', content: ctx }],
  })
  const latency = Date.now() - started
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  let parsed
  try { parsed = JSON.parse(text.slice(s, e + 1)) }
  catch (err) { return { file, error: `Gate response was not JSON: ${err.message}`, raw: text } }

  const results = []
  for (const exp of c.expected ?? []) {
    if (HUMAN.has(exp.id)) { results.push({ id: exp.id, verdict: 'HUMAN', detail: 'needs a person to read the answer text' }); continue }
    const check = CHECKS[exp.id]
    if (!check) { results.push({ id: exp.id, verdict: 'SKIP', detail: 'no checker implemented — NOT a pass' }); continue }
    const [ok, detail] = check(parsed)
    results.push({ id: exp.id, verdict: ok ? 'PASS' : 'FAIL', detail })
  }

  if (record) {
    c.run = {
      run_at: new Date().toISOString().slice(0, 10),
      model: process.env.AI_MODEL || 'claude-sonnet-4-5',
      temperature: c.gate.temperature ?? 0.1,
      max_tokens: c.gate.max_tokens ?? 1500,
      web_search: false,
      system_prompt_sha256: promptSha,
      system_prompt_chars: prompt.length,
      latency_ms: latency,
      target: ref,
      response: parsed,
    }
    c.matched = results.filter((r) => r.verdict === 'PASS').map((r) => r.id)
    c.missed = results.filter((r) => r.verdict === 'FAIL').map((r) => r.id)
    c.extra = []
    c.status = c.missed.length ? 'failing' : (results.some((r) => r.verdict !== 'PASS') ? 'scored' : 'passing')
    writeFileSync(path, JSON.stringify(c, null, 2) + '\n')
  }

  return { file, id: c.id, title: c.title, outputType, promptSha, promptChanged, recordedSha: c.gate.system_prompt_sha256, response: parsed, results, latency }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const files = readdirSync(CASE_DIR).filter((f) => f.endsWith('.json')).filter((f) => !only || f.startsWith(only)).sort()
if (!files.length) die(`No case files matching "${only ?? ''}" in ${CASE_DIR}/`)

console.log(`\n  Target : ${ref}   (staging — there is no production target for this command)`)
console.log(`  Model  : ${process.env.AI_MODEL || 'claude-sonnet-4-5'}`)
console.log(`  Cases  : ${files.length}${record ? '   (--record: results written back into the case files)' : ''}\n`)

let pass = 0, fail = 0, human = 0, skip = 0
const line = '  ' + '─'.repeat(74)

for (const f of files) {
  const r = await runCase(f)
  console.log(line)
  if (r.skipped) { console.log(`  ${f}\n    SKIPPED: ${r.skipped}`); continue }
  if (r.error) { console.log(`  ${f}\n    ERROR: ${r.error}`); fail++; continue }
  console.log(`  ${r.id}   [${r.outputType}]   ${r.latency}ms`)
  console.log(`  ${r.title}`)
  if (r.promptChanged) {
    console.log(`\n    ⚠️  THE GATE PROMPT HAS CHANGED SINCE THIS CASE WAS WRITTEN.`)
    console.log(`        recorded ${r.recordedSha?.slice(0, 16)}…  now ${r.promptSha.slice(0, 16)}…`)
    console.log(`        Every expectation below was written against the old prompt. Read the`)
    console.log(`        result rather than trusting it, then update system_prompt_sha256.`)
  }
  console.log(`\n    gate outcome: ${r.response.outcome}`)
  if (r.response.outcome === 'ask') console.log(`    asked: "${r.response.ask.question}"`)
  console.log('')
  for (const a of r.results) {
    const mark = { PASS: '  ✅', FAIL: '  ❌', HUMAN: '  👤', SKIP: '  ⏭ ' }[a.verdict]
    console.log(`  ${mark} ${a.verdict.padEnd(5)} ${a.id.padEnd(32)} ${a.detail}`)
    if (a.verdict === 'PASS') pass++
    else if (a.verdict === 'FAIL') fail++
    else if (a.verdict === 'HUMAN') human++
    else skip++
  }
  if (verbose) console.log('\n' + JSON.stringify(r.response, null, 2).split('\n').map((l) => '      ' + l).join('\n'))
}

console.log(line)
console.log(`  ${pass} passed · ${fail} FAILED · ${human} need a human to read the answer · ${skip} have no checker`)
console.log(line + '\n')

if (skip > 0) {
  console.log(`  ${skip} assertion(s) have no checker and were reported as SKIP, never as PASS.`)
  console.log(`  A runner that silently passed what it could not check would be worse than none.\n`)
}
if (human > 0) {
  console.log(`  ${human} assertion(s) need somebody to read the answer text — "does it state that`)
  console.log(`  Nevada and Pennsylvania are not covered", and the like. Those are the ones a`)
  console.log(`  script cannot have an opinion about. TESTING.md (a).\n`)
}

process.exit(fail > 0 ? 1 : 0)
