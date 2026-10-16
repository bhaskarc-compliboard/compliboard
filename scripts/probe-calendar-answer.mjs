// ONE REAL CALENDAR ANSWER, END TO END, WITH EVERYTHING IT DID PRINTED — Calendar step 10a, STOP 1.
//
//   npm run haiku -- node --env-file=.env.local scripts/probe-calendar-answer.mjs \
//     --as testgamma@example.com --ask "When is our fire extinguisher maintenance due?"
//
// *** IT CALLS A MODEL, SO IT GOES THROUGH THE GUARD. *** `npm run haiku -- …` sets every model
// variable and refuses unless all thirteen tiers resolve to Haiku (`CLAUDE.md` §3.4a). Without it
// this script spends Opus money.
//
// WHAT IT PRINTS, because a report that says "the answer was good" is a claim and this is the
// evidence (§9a): every context block with its size, the exact message sent, the raw streamed text
// before any check, what the check kept and dropped, the offers parsed, the topic and turn rows
// written, and the ledger row with its cost.
//
// It signs in as a real person and runs as that person, so RLS decides what the answer can see —
// the same client the route will build in 10b. Nothing here uses the service role.
import { createClient } from '@supabase/supabase-js'
import { answer } from '../lib/ask/engine.ts'
import { calendarBrief, packCalendarContext } from '../lib/ask/calendarBrief.ts'
import { askPrompt } from '../prompts/ask.ts'

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : process.argv[i + 1]
}
const email = arg('--as', 'testgamma@example.com')
const question = arg('--ask', 'When is our fire extinguisher maintenance due, and is it on the calendar?')
const showPrompt = process.argv.includes('--prompt')

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
/**
 * The service role, for the two named statements the engine uses it for (the counter and a
 * stopped turn) — `requireCompany` + `supabaseAdmin` in a route. The first run of this script
 * passed the person's own client as `admin` and the log said `permission denied for table
 * usage_counters`: the engine was right and the probe was wrong, which is worth more than a
 * probe that passes by accident.
 */
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: profile } = await db.from('profiles').select('company_id').eq('id', signedIn.user.id).maybeSingle()
const companyId = profile?.company_id
const { data: company } = await db.from('companies').select('name').eq('id', companyId).maybeSingle()

const rule = (t) => console.log(`\n${'─'.repeat(78)}\n${t}\n${'─'.repeat(78)}`)
rule(`THE QUESTION — ${company?.name ?? companyId} (${email})`)
console.log(question)

// ---- 1. WHAT IT IS GIVEN ----
const packed = await packCalendarContext(db, companyId)
rule('THE CONTEXT, BLOCK BY BLOCK')
let totalTokens = 0
for (const b of packed.blocks) {
  totalTokens += b.tokens
  console.log(`  ${b.name.padEnd(14)} ${String(b.chars).padStart(7)} chars  ${String(b.tokens).padStart(6)} tokens`
    + (b.leftOut ? `   LEFT OUT: ${b.leftOut}` : ''))
}
console.log(`  ${'TOTAL'.padEnd(14)} ${String(packed.blocks.reduce((n, b) => n + b.chars, 0)).padStart(7)} chars  ${String(totalTokens).padStart(6)} tokens`)
console.log(`  passages a quote may be checked against: ${packed.passages.length}`
  + ` (${[...new Set(packed.passages.map((p) => p.id[0]))].join(', ')})`)

// `--pack-only` prints what the question would be answered FROM and stops: no model call, no
// money, no rows written. It is how the budget's behaviour is measured on a big company.
if (process.argv.includes('--pack-only')) {
  const dates = (packed.blocks.find((b) => b.name === 'the calendar')?.text.match(/<date /g) ?? []).length
  const readings = (packed.blocks.find((b) => b.name === 'the readings')?.text.match(/<reading /g) ?? []).length
  const findings = (packed.blocks.find((b) => b.name === 'the findings')?.text.match(/<finding /g) ?? []).length
  console.log(`\n  ${dates} date(s) sent, ${readings} reading(s), ${findings} finding(s)`)
  if (dates) console.log(`  a date costs about ${Math.round((packed.blocks.find((b) => b.name === 'the calendar')?.tokens ?? 0) / dates)} tokens`)
  if (readings) console.log(`  a reading costs about ${Math.round((packed.blocks.find((b) => b.name === 'the readings')?.tokens ?? 0) / readings)} tokens`)
  process.exit(0)
}

const contextText = packed.blocks.map((b) => b.text).join('\n\n')
rule('THE EXACT MESSAGE SENT')
console.log(`${contextText}\n\nQuestion: ${question}`)
if (showPrompt) { rule('THE SYSTEM PROMPT, AS ASSEMBLED'); console.log(askPrompt(calendarBrief.promptSentences)) }

// ---- 2. THE ANSWER ----
const before = new Date().toISOString()
let raw = ''
/**
 * WHAT THE NARRATION RULE WITHDREW. `lib/ai.ts` treats everything written before the FIRST web
 * search as narration and withdraws it (`{type:'reset'}`), on the evidence of five recorded
 * sequences where the model said what it was about to do. A model that searches LATE — after
 * writing most of the answer — loses that text instead, and the probe has to keep it or the
 * report would be guessing about what happened.
 */
let withdrawn = ''
let done = null
const searches = []
rule('THE RUN')
for await (const ev of answer(calendarBrief, { db, admin, companyId, question })) {
  if (ev.type === 'text') raw += ev.text
  else if (ev.type === 'reset') { console.log(`  [narration withdrawn: ${raw.length} chars]`); withdrawn += raw; raw = '' }
  else if (ev.type === 'searching') { searches.push(ev.query); console.log(`  searching: ${ev.query}`) }
  else if (ev.type === 'context') console.log(`  context: ${ev.tokens} tokens in ${ev.blocks.length} blocks`)
  else if (ev.type === 'done') done = ev
  else console.log(`  ${ev.type}: ${ev.message ?? ''}`)
}
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
console.log(`  offers: ${done.offers.length}`)
for (const o of done.offers) console.log(`    ${JSON.stringify(o)}`)
rule('THE ANSWER AS IT WOULD BE SHOWN AND STORED')
console.log(done.text)

// ---- 3. WHAT WAS WRITTEN ----
rule('THE ROWS WRITTEN')
const { data: topic } = await db.from('topics').select('id, title, section, status, created_at').eq('id', done.topicId).maybeSingle()
console.log(`  topic   ${topic?.id}  section=${topic?.section}  status=${topic?.status}  "${topic?.title}"`)
// `length(text)` is SQL, not PostgREST: the first version asked for it and the whole select
// returned nothing, so the turns printed as absent on a run that had written them.
const { data: turns, error: turnsError } = await db.from('turns').select('position, role, text, check_record')
  .eq('topic_id', done.topicId).order('position')
if (turnsError) console.log(`  turns could not be read: ${turnsError.message}`)
for (const t of turns ?? []) {
  console.log(`  turn ${t.position}  ${String(t.role).padEnd(9)} ${String(t.text ?? '').length} chars`)
  if (t.check_record) console.log(`    check_record: ${JSON.stringify(t.check_record)}`)
}
const { data: calls } = await db.from('ai_calls')
  .select('id, task, model, input_tokens, output_tokens, cost_usd, wall_ms, created_at')
  .eq('company_id', companyId).gte('created_at', before).order('created_at')
rule('THE LEDGER')
let spent = 0
for (const c of calls ?? []) {
  spent += Number(c.cost_usd ?? 0)
  console.log(`  ${c.task}  ${c.model}  in=${c.input_tokens} out=${c.output_tokens}  $${Number(c.cost_usd ?? 0).toFixed(4)}  ${c.wall_ms}ms`)
}
console.log(`  this run: ${(calls ?? []).length} call(s), $${spent.toFixed(4)}`)
