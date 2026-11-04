/**
 * THE SAME RUN, TWO TREES — `docs/GAPS-PLAN.md` Part E step E0's measurement.
 *
 *   npm run haiku -- node --env-file=.env.local scripts/measure-audit-words.mjs --label BEFORE --out /tmp/before.json
 *
 * *** WHY A SCRIPT AND NOT A SERVER. *** E0 changed a vocabulary, a prompt and one CASE arm. The
 * only honest way to see what that did is to run the owner's own checklist against his own
 * documents twice — once on the commit before the change, once on this tree — with the same model,
 * the same company, the same checklist and the same stored readings, and compare the ten lines word
 * by word. Nothing in that comparison is rendered, so neither side needs a server; the walk gets
 * one afterwards, on this tree.
 *
 * *** AND IT IS THE PRODUCT'S OWN PATH, NOT A COPY OF IT. *** `createRun` → `runSection` →
 * `finishRunIfDone` → `summariseRun` is exactly what `POST /api/audit-runs` does, and
 * `scripts/run-golden-audit.js` runs the same four for the same reason (its own note: a golden run
 * that measured a different cost shape from the product's would be measuring the script). A
 * reimplementation here would measure the reimplementation.
 *
 * *** HOW THE BEFORE SIDE IS SET UP. *** `git worktree add <scratch>/before <commit>`, then
 * `cp .env.local`, then `cp -cR node_modules`, then THIS FILE copied in. The harness is identical
 * on both sides on purpose — what is being measured is `lib/`, `prompts/` and the migrations, not
 * the harness — and the imports below are relative, so each tree runs its own code.
 *
 * STAGING ONLY, and it refuses the production ref by name. It WRITES: one audit run, its sections
 * and its findings, on the fixture company. That is the point — the rows are the answer — and every
 * run is kept, as every audit is.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

import { createRun, runSection, finishRunIfDone, summariseRun, runSummaryLine } from '../lib/auditRun.ts'
import { extractTemplate } from '../lib/auditTemplate.ts'
import { modelForTask } from '../lib/ai.ts'

const PROD_REF = 'dsfwmafnphdlfogetsus'
/** Step 20 Card Walk — the company the owner's walk of 3 November ran against. */
const COMPANY = '61b26cc0-0d28-411b-b2e4-943189363b08'
/** His auditor's checklist: NW_Supplier_Assurance_Pre-Inspection_Checklist_2026-03.docx. */
const TEMPLATE = '511e8bcd-0f50-4f68-b23d-f5e54525bdc2'

const args = process.argv.slice(2)
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const LABEL = flag('--label', 'RUN')
const OUT = flag('--out')
const die = (m) => { console.error(m); process.exit(1) }
if (!OUT) die('usage: --label BEFORE --out <file.json>')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) die('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (staging).')
if (url.includes(PROD_REF)) die('That URL is PRODUCTION. This script is staging-only and has no flag to change that.')
if (!process.env.ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY is not set.')

const db = createClient(url, key, { auth: { persistSession: false } })

// The guard has already refused the run if any tier is off Haiku. This records what it resolved to,
// in the output, so the comparison can prove both sides ran on one model rather than assert it.
const model = modelForTask('judgement')
console.log(`${LABEL}: judgement tier -> ${model}`)

const { data: doc, error: docErr } = await db.from('documents')
  .select('id, name, file_url, file_type').eq('id', TEMPLATE).maybeSingle()
if (docErr) die(`reading the checklist row: ${docErr.message}`)
if (!doc) die(`the checklist ${TEMPLATE} is not on file for this company`)
const { data: blob, error: dlErr } = await db.storage.from('company-documents').download(doc.file_url)
if (dlErr || !blob) die(`downloading ${doc.name}: ${dlErr?.message ?? 'no file'}`)
const buffer = await blob.arrayBuffer()

const t0 = Date.now()
const { runId, sectionIds } = await createRun(db, {
  companyId: COMPANY, kind: 'template',
  scope: `E0 ${LABEL}: Audit us against the attached template.`,
  templateDocumentId: doc.id,
  // The extraction happens INSIDE createRun so the run's window covers it, as a customer's does.
  templateExtract: () => extractTemplate({
    buffer, fileName: doc.name, fileType: doc.file_type, companyId: COMPANY, db,
  }),
})
console.log(`${LABEL}: run ${runId}, ${sectionIds.length} section(s)`)
const mapped = []
for (const sid of sectionIds) {
  const r = await runSection(db, sid, {})
  for (const m of r.mappedWords ?? []) mapped.push(m)
  console.log(`${LABEL}:   section ${sid.slice(0, 8)} -> ${r.status}, ${r.findings ?? 0} finding(s)`)
}
await finishRunIfDone(db, runId)
const summary = await summariseRun(db, runId)
const wall = Date.now() - t0

const { data: secs } = await db.from('audit_sections')
  .select('id, title, ordinal, documents_read').eq('run_id', runId).order('ordinal')
const { data: rows } = await db.from('audit_findings')
  .select('template_line, template_text, title, word, basis, kind, document_id, locator, quote, '
        + 'what_to_do, handle_error, ordinal')
  .eq('run_id', runId).order('ordinal')
// The ledger between this run's own timestamps, the way `costOfSections` does it.
const { data: calls } = await db.from('ai_calls')
  .select('task, model, cost_usd, input_tokens, output_tokens')
  .eq('company_id', COMPANY).gte('created_at', new Date(t0 - 2000).toISOString())

const docIds = [...new Set((rows ?? []).map((r) => r.document_id).filter(Boolean))]
const { data: titles } = docIds.length
  ? await db.from('document_index_v').select('document_id, title').in('document_id', docIds)
  : { data: [] }
const titleById = Object.fromEntries((titles ?? []).map((d) => [d.document_id, d.title]))

/** Every `D<n>` left in a field a person reads. The whole of W5, in one number per line. */
const handles = (s) => [...new Set(String(s ?? '').match(/\bD\d{1,3}\b/g) ?? [])]

const out = {
  label: LABEL, run_id: runId, model, wall_ms: wall, when: new Date().toISOString(),
  documents_read: (secs ?? []).map((s) => (s.documents_read ?? []).length),
  template_in_documents_read: (secs ?? []).some((s) => (s.documents_read ?? []).includes(TEMPLATE)),
  mapped_words: mapped,
  summary_line: runSummaryLine(summary),
  summary: {
    total: summary.total, needs_person: summary.needs_person,
    nothing_on_file: summary.nothing_on_file, on_file_gaps: summary.on_file_gaps ?? null,
    stale: summary.stale, on_file: summary.on_file,
    not_a_document_question: summary.not_a_document_question,
  },
  calls: (calls ?? []).length,
  cost_usd: Number((calls ?? []).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0).toFixed(4)),
  lines: (rows ?? []).map((r) => ({
    ref: r.template_line, word: r.word, basis: r.basis, kind: r.kind,
    document: r.document_id ? (titleById[r.document_id] ?? r.document_id) : null,
    handle_error: r.handle_error,
    handles: {
      title: handles(r.title), locator: handles(r.locator),
      what_to_do: handles(r.what_to_do), quote: handles(r.quote),
    },
    locator: r.locator, quote: r.quote, what_to_do: r.what_to_do,
  })),
}
out.handles_total = out.lines.reduce((n, l) =>
  n + l.handles.title.length + l.handles.locator.length + l.handles.what_to_do.length, 0)
out.lines_leaking = out.lines.filter((l) =>
  l.handles.title.length || l.handles.locator.length || l.handles.what_to_do.length).length

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
console.log(`${LABEL}: ${out.lines.length} line(s) · $${out.cost_usd.toFixed(4)} over ${out.calls} call(s)`
  + ` · ${(wall / 1000).toFixed(1)}s`)
console.log(`${LABEL}: documents_read ${JSON.stringify(out.documents_read)}`
  + ` · the template itself is in it: ${out.template_in_documents_read}`)
console.log(`${LABEL}: handles at the person: ${out.handles_total} in ${out.lines_leaking} of ${out.lines.length} lines`)
console.log(`${LABEL}: ${out.summary_line}`)
console.log(`${LABEL}: written to ${OUT}`)
