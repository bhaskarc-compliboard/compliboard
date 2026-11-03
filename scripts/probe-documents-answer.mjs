// ONE REAL DOCUMENTS ANSWER, END TO END, WITH EVERYTHING IT DID PRINTED — Part A step 4a-test.
//
// `scripts/probe-calendar-answer.mjs`'s shape, with three things added that THIS step needs: a
// `--without` variant, a `--document` id to attach, and a `--json` dump so three runs of the same
// question can be compared without re-reading the terminal.
//
//   node --env-file=.env.local scripts/probe-documents-answer.mjs \
//     --as testcascade@example.com --ask "Which of our permits expire in the next 12 months?"
//
// *** IT CALLS A MODEL, SO THE MODEL IS CHOSEN IN THE COMMAND'S OWN ENVIRONMENT (CLAUDE.md §3.4a). ***
// `npm run haiku -- …` cannot be used here, because the guard sets EVERY model variable to Haiku
// and this step is authorised on claude-sonnet-5-5 for the Documents tier. So the command sets
// every other AI_MODEL_* to the Haiku id itself and AI_MODEL_DOCUMENTS to Sonnet, and this script
// PRINTS what every tier resolved to before it spends anything — the guard's own job, done where
// the guard cannot be used. Never by editing .env.local.
//
// WHAT IT PRINTS, because a report that says "the answer was good" is a claim and this is the
// evidence (§9a): every context block with its size, the exact message sent, the raw streamed text
// before any check, what the check kept and dropped, the topic and turn rows written, and the
// ledger row with its cost.
//
// *** THE `--without` VARIANT IS THE OWNER'S BASELINE AND IS THE POINT OF THE SCRIPT. ***
// Same engine, same model, same question, same person — but `packContext` returns only the company
// block and `promptSentences` is empty. That is the Compliance Workspace's open answer
// (`docs/GAPS-PLAN.md` decision 2: the Workspace sends the model nothing but the question and the
// conversation), and it is what everything the Documents brief and prompt do has to beat.
import { createClient } from '@supabase/supabase-js'
import { answer } from '../lib/ask/engine.ts'
import { documentsBrief, packDocumentsContext } from '../lib/ask/documentsBrief.ts'
import { companyBlock } from '../lib/ask/engine.ts'
import { askPrompt } from '../prompts/ask.ts'
import { modelForTask } from '../lib/ai.ts'
import { writeFileSync, mkdirSync } from 'node:fs'

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : process.argv[i + 1]
}
const email = arg('--as', 'testcascade@example.com')
const question = arg('--ask', 'Which of our permits expire in the next 12 months?')
const documentId = arg('--document', null)
const without = process.argv.includes('--without')
const jsonOut = arg('--json', null)
const showPrompt = process.argv.includes('--prompt')

/**
 * *** THE BRIEF USED FOR THE `--without` RUN, AND WHY IT IS BUILT HERE AND NOT IN lib/. ***
 * It is a measuring instrument, not a product behaviour: nothing ships a Documents chat with no
 * context and no instructions. `checkBrief`'s five fields are kept so it is a real brief and runs
 * down exactly the same path — same tier, same ledger word, same search cap, same check.
 *
 * *** IT IS `['']` AND NOT `[]`, AND THAT IS `checkBrief` REFUSING, NOT A CHOICE. ***
 * The step's brief asked for `promptSentences` empty. `lib/ask/brief.ts:103` throws on an empty
 * list — *"the documents brief has no prompt sentences"* — deliberately, because a section with no
 * instructions at all is a mistake in a product and the engine will not run one. The nearest thing
 * is one empty string: `askPrompt([''])` is `askPrompt([])` plus a trailing blank line, and
 * `askPrompt([])` is byte-for-byte what the Compliance Workspace sends for an open answer
 * (`prompts/ask.ts` `askPrompt`, `app/api/chat/route.ts:371` — the same
 * `buildSystemPrompt('research', null, { open: true })`). So variant B really is the owner's
 * baseline, with two characters of whitespace on the end of its system prompt.
 */
const baselineBrief = {
  ...documentsBrief,
  packContext: async (db, companyId) => ({ blocks: [await companyBlock(db, companyId)], passages: [] }),
  promptSentences: [''],
}
const brief = without ? baselineBrief : documentsBrief

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
const TIERS = ['documents', 'prose', 'judgement', 'summary', 'calendar', 'hr', 'document_scan', 'audit', 'howto', 'website']
rule('WHICH MODEL EACH TIER RESOLVED TO (lib/ai.ts asked, not the variables read)')
let stray = []
for (const t of TIERS) {
  const m = modelForTask(t)
  if (t !== 'documents' && !/haiku/.test(m)) stray.push(`${t}=${m}`)
  console.log(`  ${t.padEnd(14)} ${m}${t === 'documents' ? '   <- this run' : ''}`)
}
if (stray.length) {
  console.error(`\n  STOP: a tier this run does not pay for is not on Haiku: ${stray.join(', ')}`)
  console.error('  Set every AI_MODEL_* to the Haiku id in the command\'s own environment (CLAUDE.md §3.4a).')
  process.exit(1)
}

rule(`THE QUESTION — ${company?.name ?? companyId} (${email})   variant ${without ? 'B (WITHOUT)' : 'A (WITH)'}`)
console.log(question)
if (documentId) console.log(`attached document: ${documentId}`)

// ---- 1. WHAT IT IS GIVEN ----
const packed = without
  ? await baselineBrief.packContext(db, companyId)
  : await packDocumentsContext(db, companyId, question)
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
  const index = packed.blocks.find((b) => b.name === 'your documents')
  const reports = packed.blocks.find((b) => b.name === 'the readings')
  console.log(`\n  ${(index?.text.match(/<document /g) ?? []).length} document(s) in the index, `
    + `${(reports?.text.match(/<report /g) ?? []).length} full reading(s)`)
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
/** What `lib/ai.ts`'s narration rule withdrew, kept so the report is not guessing (see the Calendar probe). */
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
 * a person can read what came back. Three runs of six questions in two variants is 36 answers, and
 * nobody judges 36 answers off a terminal scroll.
 */
if (jsonOut) {
  mkdirSync(jsonOut.slice(0, jsonOut.lastIndexOf('/')), { recursive: true })
  writeFileSync(jsonOut, JSON.stringify({
    question, variant: without ? 'B' : 'A', documentId, email, company: company?.name ?? null,
    model: modelForTask('documents'),
    context: packed.blocks.map((b) => ({ name: b.name, chars: b.chars, tokens: b.tokens, left_out: b.leftOut })),
    context_tokens: totalTokens,
    passages: packed.passages.map((p) => p.id),
    searches,
    withdrawn: withdrawn.trim() || null,
    answer: done.text,
    sources: done.sources,
    check_record: checkRecord,
    ledger: (calls ?? []).map((c) => ({ task: c.task, model: c.model, input: c.input_tokens,
      output: c.output_tokens, searches: c.searches ?? 0, cost_usd: Number(c.cost_usd ?? 0) })),
    seconds: Number(seconds.toFixed(1)),
    topic_id: done.topicId,
  }, null, 2) + '\n')
  console.log(`\n  saved: ${jsonOut}`)
}
