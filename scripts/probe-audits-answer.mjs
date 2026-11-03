// ONE REAL AUDITS ANSWER, END TO END, WITH EVERYTHING IT DID PRINTED — Part A step 6a.
//
// `scripts/probe-documents-answer.mjs`, pointed at the Audits brief, with three things this step
// needs on top of it: the OFFER is counted off the raw answer before anything strips it, the
// `--without` variant is the DOCUMENTS brief rather than an empty one, and `ASK_DUMP_DIR` is
// documented here because this is the first probe that uses it.
//
//   node --env-file=.env.local scripts/probe-audits-answer.mjs \
//     --as testcascade@example.com --ask "What is our status on everything DEQ?"
//
// *** IT CALLS A MODEL, SO THE MODEL IS CHOSEN IN THE COMMAND'S OWN ENVIRONMENT (CLAUDE.md §3.4a). ***
// `npm run haiku -- …` cannot be used here, because the guard sets EVERY model variable to Haiku
// and this step is authorised on claude-sonnet-5-5 for the Audits tier. So the command sets every
// other AI_MODEL_* to the Haiku id itself and AI_MODEL_AUDITS_CHAT to Sonnet, and this script
// PRINTS what every tier resolved to before it spends anything — the guard's own job, done where
// the guard cannot be used. Never by editing .env.local.
//
// *** THE `--without` VARIANT IS THE DOCUMENTS BRIEF, NOT AN EMPTY ONE, AND THAT IS THE POINT OF
// THE STEP. *** 4a-test measured the Documents brief against the Compliance Workspace's open
// answer, because the question there was "does a brief earn its tokens". The question HERE is
// narrower and harder: **does an Audits chat earn its existence over the Documents chat that
// already ships?** So variant B is `lib/ask/documentsBrief.ts`, whole — the same engine, the same
// model, the same person, the same question, with the audits and their findings taken away and
// everything else left exactly as it is.
//
// WHAT IT PRINTS, because a report that says "the answer was good" is a claim and this is the
// evidence (§9a): every context block with its size, the raw streamed text before any check, the
// offer block the model wrote and whether the code would accept it, what the check kept and
// dropped, the rows written, and the ledger row with its cost.
import { createClient } from '@supabase/supabase-js'
import { answer } from '../lib/ask/engine.ts'
import { auditsBrief, packAuditsContext, checkRunAuditOffer } from '../lib/ask/auditsBrief.ts'
import { documentsBrief, packDocumentsContext } from '../lib/ask/documentsBrief.ts'
import { runAuditCardWords } from '../lib/auditsWords.ts'
import { askPrompt } from '../prompts/ask.ts'
import { modelForTask } from '../lib/ai.ts'
import { writeFileSync, mkdirSync } from 'node:fs'

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : process.argv[i + 1]
}
const email = arg('--as', 'testcascade@example.com')
const question = arg('--ask', 'What is our status on everything DEQ?')
const documentId = arg('--document', null)
const without = process.argv.includes('--without')
const jsonOut = arg('--json', null)
const showPrompt = process.argv.includes('--prompt')

/**
 * *** VARIANT B RUNS THE DOCUMENTS BRIEF UNDER THE AUDITS SECTION, AND BOTH HALVES OF THAT ARE
 * DELIBERATE. ***
 *
 * The brief is Documents' own — its packer, its fourteen sentences, its empty `offers`. The
 * SECTION is `audits_chat`, so both variants resolve to the same model tier, the same ledger word
 * and the same search cap (`lib/ask/engine.ts` `sectionRuns`) and write their conversations into
 * the same section. Without that, variant B would be measuring a different model as well as a
 * different brief, and the comparison would say nothing.
 */
const baselineBrief = { ...documentsBrief, section: 'audits_chat' }
const brief = without ? baselineBrief : auditsBrief

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const pub = createClient(url, anon, { auth: { persistSession: false } })
const { data: signedIn, error: signInError } = await pub.auth.signInWithPassword({
  email, password: process.env.CHECK_LIVE_PASSWORD,
})
if (signInError) { console.error(`could not sign in as ${email}: ${signInError.message}`); process.exit(1) }
const token = signedIn.session.access_token
/** The caller's own client: RLS applies, exactly as `requireCompany` builds it in a route. */
const db = createClient(url, anon, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
})
/** The service role, for the two named statements the engine uses it for (the counter, a stopped turn). */
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: profile } = await db.from('profiles').select('company_id').eq('id', signedIn.user.id).maybeSingle()
const companyId = profile?.company_id
const { data: company } = await db.from('companies').select('name').eq('id', companyId).maybeSingle()

const rule = (t) => console.log(`\n${'─'.repeat(78)}\n${t}\n${'─'.repeat(78)}`)

/**
 * *** EVERY TIER, PRINTED BEFORE ANYTHING IS SPENT. *** `npm run haiku -- <cmd>` is the guard and
 * it cannot be used for this step (it forces every tier to Haiku). So the thing the guard does —
 * ask `lib/ai.ts` itself what each tier resolves to, rather than reading the variables — is done
 * here, and a tier that is neither the authorised Sonnet nor Haiku is a loud stop.
 */
const TIERS = ['audits_chat', 'documents', 'prose', 'judgement', 'summary', 'calendar', 'hr', 'document_scan', 'audit', 'howto', 'website']
rule('WHICH MODEL EACH TIER RESOLVED TO (lib/ai.ts asked, not the variables read)')
let stray = []
for (const t of TIERS) {
  const m = modelForTask(t)
  if (t !== 'audits_chat' && !/haiku/.test(m)) stray.push(`${t}=${m}`)
  console.log(`  ${t.padEnd(14)} ${m}${t === 'audits_chat' ? '   <- this run' : ''}`)
}
if (stray.length) {
  console.error(`\n  STOP: a tier this run does not pay for is not on Haiku: ${stray.join(', ')}`)
  console.error('  Set every AI_MODEL_* to the Haiku id in the command\'s own environment (CLAUDE.md §3.4a).')
  process.exit(1)
}

rule(`THE QUESTION — ${company?.name ?? companyId} (${email})   variant ${without ? 'B (THE DOCUMENTS BRIEF)' : 'A (THE AUDITS BRIEF)'}`)
console.log(question)
if (documentId) console.log(`attached document: ${documentId}`)

// ---- 1. WHAT IT IS GIVEN ----
const packed = without
  ? await packDocumentsContext(db, companyId, question)
  : await packAuditsContext(db, companyId, question)
rule('THE CONTEXT, BLOCK BY BLOCK')
let totalTokens = 0
for (const b of packed.blocks) {
  totalTokens += b.tokens
  console.log(`  ${b.name.padEnd(16)} ${String(b.chars).padStart(7)} chars  ${String(b.tokens).padStart(6)} tokens`
    + (b.leftOut ? `   LEFT OUT: ${b.leftOut}` : ''))
}
console.log(`  ${'TOTAL'.padEnd(16)} ${String(packed.blocks.reduce((n, b) => n + b.chars, 0)).padStart(7)} chars  ${String(totalTokens).padStart(6)} tokens`)
console.log(`  passages a quote may be checked against: ${packed.passages.length}`
  + (packed.passages.length ? ` (${[...new Set(packed.passages.map((p) => p.id[0]))].join(', ')})` : ''))

// `--pack-only` prints what the question would be answered FROM and stops: no model call, no
// money, no rows written. It is how the keys were written before any run (docs/TESTING.md).
if (process.argv.includes('--pack-only')) {
  const counts = {
    audits: (packed.blocks.find((b) => b.name === 'your audits')?.text.match(/<audit /g) ?? []).length,
    findings: (packed.blocks.find((b) => b.name === 'the findings')?.text.match(/<finding /g) ?? []).length,
    documents: (packed.blocks.find((b) => b.name === 'your documents')?.text.match(/<document /g) ?? []).length,
    readings: (packed.blocks.find((b) => b.name === 'the readings')?.text.match(/<report /g) ?? []).length,
  }
  console.log(`\n  ${counts.audits} audit(s), ${counts.findings} open finding(s), `
    + `${counts.documents} document(s) in the index, ${counts.readings} full reading(s)`)
  if (process.argv.includes('--show')) {
    for (const b of packed.blocks) { rule(b.name.toUpperCase()); console.log(b.text) }
  }
  process.exit(0)
}

if (showPrompt) { rule('THE SYSTEM PROMPT, AS ASSEMBLED'); console.log(askPrompt(brief.promptSentences)) }

// ---- 2. THE ANSWER ----
const before = new Date().toISOString()
const started = Date.now()
let raw = ''
/** What `lib/ai.ts`'s narration rule withdrew, kept so the report is not guessing. */
let withdrawn = ''
let done = null
const searches = []
rule('THE RUN')
for await (const ev of answer(brief, { db, admin, companyId, question, documentId })) {
  if (ev.type === 'text') raw += ev.text
  else if (ev.type === 'reset') { console.log(`  [narration withdrawn: ${raw.length} chars]`); withdrawn += raw; raw = '' }
  else if (ev.type === 'searching') { searches.push(ev.query); console.log(`  searching: ${ev.query}`) }
  else if (ev.type === 'context') console.log(`  context: ${ev.tokens} tokens in ${ev.blocks.length} blocks`)
  else if (ev.type === 'done') done = ev
  else console.log(`  ${ev.type}: ${ev.message ?? ''}`)
}
const seconds = (Date.now() - started) / 1000
if (withdrawn) {
  rule('WHAT THE NARRATION RULE WITHDREW (lib/ai.ts), before the first search')
  console.log(withdrawn.trim())
}
rule('THE RAW ANSWER, BEFORE ANY CHECK')
console.log(raw.trim() || '(nothing)')
if (!done) { console.error('\nNO ANSWER — see the events above.'); process.exit(1) }

/**
 * *** THE OFFER IS COUNTED OFF THE RAW TEXT, AND THAT IS NOT A SHORTCUT — it is the only place it
 * CAN be counted today. ***
 *
 * `auditsBrief.offers` is `[]` (step 6a's stop: `run_audit` needs three lines in the shared
 * `lib/ask/offers.ts`, which this step may not edit), so `parseOffers` drops every block the model
 * writes as a kind this section does not offer, and `done.offers` is always empty. What the step
 * was asked to measure is whether the MODEL produces the offer in the right places, which is a
 * fact about the raw answer. So the fenced block is read here, and `checkRunAuditOffer` — the real
 * function, the one 6b will call — says whether the code would have accepted it.
 */
const FENCE = /```offer\s*\n([\s\S]*?)```/g
const { data: labelRows } = await db.from('company_labels').select('label').eq('kind', 'agency').order('label')
const agencies = (labelRows ?? []).map((l) => l.label)
const offerBlocks = [...raw.matchAll(FENCE)].map((m) => m[1])
const offers = []
for (const body of offerBlocks) {
  let parsed = null
  try { parsed = JSON.parse(body) } catch { offers.push({ raw: body.trim(), ok: false, why: 'not readable as JSON' }); continue }
  const checked = checkRunAuditOffer(parsed, { agencies, attachedDocumentId: documentId })
  offers.push({
    raw: JSON.stringify(parsed),
    ok: Boolean(checked),
    why: checked ? null : 'the agency is not one this company holds, or the file is not the one attached',
    card: checked ? runAuditCardWords({
      agency: checked.agency,
      fileName: checked.document_id ? 'the attached file' : null,
    }) : null,
  })
}
rule('THE OFFER (read off the raw answer; see the note in this file)')
if (!offers.length) console.log('  none')
for (const o of offers) {
  console.log(`  ${o.ok ? 'WOULD BE SHOWN' : 'WOULD BE DROPPED'}  ${o.raw}`)
  if (o.card) console.log(`    card: "${o.card}"`)
  if (o.why) console.log(`    why:  ${o.why}`)
}
/** A promise in the prose with no block behind it — the 18-of-36 failure Documents measured. */
const proseOffer = /\b(I can|I could|I'?ll|let me|shall I|would you like me to|do you want me to|want me to)\b/i.test(done.text)
const claimedToRun = /\b(I (?:have |'ve )?(?:ran|run|audited|completed the audit)|I am running|I'?m running|running the audit now)\b/i.test(done.text)
console.log(`  a promise in the prose: ${proseOffer ? 'YES' : 'no'}`)
console.log(`  claims to have run one:  ${claimedToRun ? 'YES — a defect' : 'no'}`)

rule('WHAT THE CHECK DID')
console.log(`  sources kept: ${done.sources.length}`)
for (const s of done.sources) {
  console.log(`    [${s.n}] ${s.kind.padEnd(7)} ${s.kind === 'web' ? `${s.label}  ${s.url}` : `${s.passage_id}  “${s.quote.slice(0, 70)}…”`}`)
}
rule('THE ANSWER AS IT WOULD BE SHOWN AND STORED')
console.log(done.text)

// ---- 3. WHAT WAS WRITTEN ----
rule('THE ROWS WRITTEN')
const { data: topic } = await db.from('topics').select('id, title, section, status').eq('id', done.topicId).maybeSingle()
console.log(`  topic   ${topic?.id}  section=${topic?.section}  status=${topic?.status}  "${topic?.title}"`)
const { data: turns } = await db.from('turns').select('position, role, text, check_record')
  .eq('topic_id', done.topicId).order('position')
let checkRecord = null
for (const t of turns ?? []) {
  console.log(`  turn ${t.position}  ${String(t.role).padEnd(9)} ${String(t.text ?? '').length} chars`)
  if (t.check_record) { checkRecord = t.check_record; console.log(`    check_record: ${JSON.stringify(t.check_record)}`) }
}
const { data: calls } = await db.from('ai_calls')
  .select('task, model, input_tokens, output_tokens, searches, cost_usd, wall_ms')
  .eq('company_id', companyId).gte('created_at', before).order('created_at')
rule('THE LEDGER')
let spent = 0
for (const c of calls ?? []) {
  spent += Number(c.cost_usd ?? 0)
  console.log(`  ${c.task}  ${c.model}  in=${c.input_tokens} out=${c.output_tokens} searches=${c.searches ?? 0}`
    + `  $${Number(c.cost_usd ?? 0).toFixed(4)}  ${c.wall_ms}ms`)
}
console.log(`  this run: ${(calls ?? []).length} call(s), $${spent.toFixed(4)}, ${seconds.toFixed(1)}s`)

/**
 * *** THE RAW ANSWER IS SAVED, NOT SUMMARISED. *** `docs/TESTING.md`: a golden run's value is that
 * a person can read what came back. Six questions in two variants, three times each, is 36 answers.
 */
if (jsonOut) {
  mkdirSync(jsonOut.slice(0, jsonOut.lastIndexOf('/')), { recursive: true })
  writeFileSync(jsonOut, JSON.stringify({
    question, variant: without ? 'B' : 'A', documentId, email, company: company?.name ?? null,
    model: modelForTask('audits_chat'),
    context: packed.blocks.map((b) => ({ name: b.name, chars: b.chars, tokens: b.tokens, left_out: b.leftOut })),
    context_tokens: totalTokens,
    passages: packed.passages.map((p) => p.id),
    searches,
    withdrawn: withdrawn.trim() || null,
    raw: raw.trim(),
    answer: done.text,
    offers,
    prose_offer: proseOffer,
    claimed_to_run: claimedToRun,
    sources: done.sources,
    check_record: checkRecord,
    ledger: (calls ?? []).map((c) => ({ task: c.task, model: c.model, input: c.input_tokens,
      output: c.output_tokens, searches: c.searches ?? 0, cost_usd: Number(c.cost_usd ?? 0) })),
    seconds: Number(seconds.toFixed(1)),
    topic_id: done.topicId,
  }, null, 2) + '\n')
  console.log(`\n  saved: ${jsonOut}`)
}
