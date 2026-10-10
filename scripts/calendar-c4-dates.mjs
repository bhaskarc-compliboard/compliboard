// C4 — DO THE DATES COME BACK RIGHT, FROM REAL CONVERSATIONS? Calendar Job C, on Haiku.
//
// It reads REAL turns off staging, builds the transcript `summariseTopic` builds, calls the model
// through `lib/ai.ts`, and runs `checkReport` — the product's own prompt and the product's own
// checks. Nothing is written: no topic is updated and no date is added.
//
// The fourth case is CONSTRUCTED and labelled as such, because staging holds no conversation in
// which a later answer withdrew a date, and that is the case most worth seeing.
import { createClient } from '@supabase/supabase-js'
import { askAIJson } from '../lib/ai.ts'
import { numberedTranscript, checkReport } from '../lib/summaryReport.ts'
import { summaryReportPrompt } from '../prompts/summary-report.ts'
import { hrSummaryPrompt } from '../prompts/hr-summary.ts'
import { hrTurns, HR_SOURCES } from '../lib/hrSummary.ts'
import { today, zoneForState } from '../lib/calendarDate.ts'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const CASCADE = (await db.from('companies').select('id')
  .eq('name', 'Cascade Specialty Chemicals, LLC').maybeSingle()).data?.id

async function turnsOf(topicId) {
  const { data, error } = await db.from('turns')
    .select('role, text, sources').eq('topic_id', topicId).order('created_at')
  if (error) throw new Error(`turns: ${error.message}`)
  return data.map((t) => ({ role: t.role, text: t.text, sources: t.sources ?? [] }))
}

async function run(label, { topicId, kind, turns: given, title }) {
  const isHr = kind === 'hr'
  const raw0 = given ?? await turnsOf(topicId)
  const turns = isHr ? hrTurns(raw0) : raw0
  if (!turns.length) { console.log(`\n### ${label}\n   (no turns — skipped)`); return }
  const { transcript } = numberedTranscript(turns, isHr ? HR_SOURCES : undefined)
  const asOf = today(zoneForState('OR'))
  const raw = await askAIJson(
    isHr ? hrSummaryPrompt(asOf) : summaryReportPrompt(asOf),
    `Conversation title: ${title ?? '(none)'}\n\n${transcript}`,
    // *** EVERY CALL GOES IN THE LEDGER. *** The first run of this script omitted `ledger`, so five
    // real Haiku calls were made and `npm run cost` still read 349 / $19.03 — the job would have
    // been reported as costing nothing. A call nobody can see in the ledger is a call nobody can
    // add up (`CLAUDE.md` §3.4: record token usage on every call).
    { maxTokens: 12000, task: 'summary', ledger: { companyId: CASCADE, task: 'summarise' } },
  )
  const checked = checkReport(raw, turns, asOf, { basisRequired: true, ...(isHr ? { sources: HR_SOURCES } : {}) })

  console.log(`\n### ${label}`)
  console.log(`   ${isHr ? 'HR' : 'Workspace'} · ${turns.length} turns · as of ${asOf}`)
  if (!checked.ok) { console.log(`   REFUSED: ${checked.error}`); return }
  const r = checked.report
  // WHAT THE MODEL PROPOSED vs WHAT SURVIVED THE CHECK — both, or the check is invisible.
  const proposed = Array.isArray(raw?.dates) ? raw.dates.length : 0
  console.log(`   model proposed ${proposed} date(s); ${r.dates?.length ?? 0} passed the checks`)
  for (const d of r.dates ?? []) {
    console.log(`     • ${d.title}`)
    console.log(`       day: ${d.day ?? 'none given'}   how often: ${d.how_often ?? '—'}   `
      + `sources: ${d.from_person ? 'from what you said' : (d.sources.join(', ') || 'none')}`)
    console.log(`       line: "${d.line}"`)
  }
  for (const d of r.dates_dropped ?? []) console.log(`     ✗ ${d.title} — ${d.reason}`)
  if (!(r.dates ?? []).length && !(r.dates_dropped ?? []).length) console.log('     (none — an empty list)')
}

// ── 0: THE PRESENCE, FIRST. ───────────────────────────────────────────────────────────────────
// *** A RUN THAT FINDS NOTHING EVERYWHERE LOOKS EXACTLY LIKE A RUN THAT CANNOT SEE *** (§9a). The
// first pass of this script returned an empty list for all four cases, including two that were
// chosen for having deadlines — which is either the right answer four times or a broken pipeline.
// So the first case now carries a deadline that is unmistakably there, and if THIS comes back empty
// nothing below it means anything.
await run('0. CONSTRUCTED — a date plainly stated (the PRESENCE; must NOT be empty)', {
  title: 'Air permit renewal date',
  turns: [
    { role: 'user', text: 'When is our Oregon air permit renewal due?' },
    { role: 'assistant', sources: [{ n: 1, title: 'Oregon DEQ', url: 'https://deq.example/acdp' }],
      text: 'Your Air Contaminant Discharge Permit must be renewed by 15 March 2027. [1]\n\n'
        + 'You also report emissions every year, by 1 February. [1]' },
  ],
})

// ── 1 and 2: real conversations with stated deadlines ────────────────────────────────────────
await run('1. WORKSPACE — federal hazmat registration (a real annual deadline)',
  { topicId: 'fdcd0466-755d-4758-87da-a45369e9ef56' })
await run('2. HR — Oregon paid sick time and daily overtime',
  { topicId: 'f5c08ccb-b9e5-4aa2-a550-57bc92830ffb', kind: 'hr' })

// ── 3: a conversation with no deadlines at all — must return an empty list ────────────────────
await run('3. WORKSPACE — a question with no deadline in it (must be EMPTY)',
  { topicId: 'f3d68b11-3861-4ed9-9733-b593502cc8e5' })

// ── 4: a later answer withdrew the date. CONSTRUCTED, and labelled. ──────────────────────────
await run('4. CONSTRUCTED — a later answer WITHDREW the date (it must not appear)', {
  title: 'Air permit renewal date',
  turns: [
    { role: 'user', text: 'When is our Oregon air permit renewal due?' },
    { role: 'assistant', sources: [{ n: 1, title: 'Oregon DEQ', url: 'https://deq.example/acdp' }],
      text: 'Your Air Contaminant Discharge Permit must be renewed by 15 March 2027. [1]' },
    { role: 'user', text: 'Our permit is a Simple ACDP, not a Standard one. Does that change it?' },
    { role: 'assistant', sources: [{ n: 1, title: 'Oregon DEQ', url: 'https://deq.example/acdp' }],
      text: 'Yes — I was wrong about the 15 March 2027 date; that applies to Standard ACDPs. '
        + 'A Simple ACDP does not expire on a fixed date and has no renewal deadline. [1] '
        + 'Disregard the March date.' },
  ],
})
