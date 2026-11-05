/**
 * THE AUDITS CHAT'S BRIEF — `docs/GAPS-PLAN.md` Part A step 6a (decisions 31–34, 41).
 *
 * What a question about audits is answered FROM, in the owner's order
 * (`docs/audits-chat-boards.html`, the notes band at the end):
 *
 *   1. the company context every chat sends (`companyBlock`, the three parts HR sends);
 *   2. EVERY AUDIT RUN — one line each: what it was of, its date, how many documents it read, and
 *      what it found, by word. Whole, never cut, for the reason the Documents index is whole;
 *   3. THE FINDINGS of the latest finished run per agency AND of the latest finished run against a
 *      checklist — one line each, with its word, the document it points at, and the fix;
 *   4. THE INDEX — one line for every document the company holds, through `indexLine`, the same
 *      line the Documents chat sends;
 *   5. THE REPORTS — the full reading of the documents the question names, then of the documents
 *      the findings point at, until the budget is spent;
 *   6. the question.
 *
 * *** IT IMPORTS DOCUMENTS' PACKERS RATHER THAN COPYING THEM. *** `indexLine`, `indexPlain`,
 * `reportBlock`, `namedBy`, `INDEX_COLUMNS` and the two left-out sentences are
 * `lib/ask/documentsBrief.ts`'s, imported unchanged. Two sections writing a document's line two
 * ways is two sets of rules about what a person is shown, free to drift — the reason
 * `lib/ask/readings.ts` was lifted out in the first place. **`lib/ask/documentsBrief.ts` is not
 * edited by this step.**
 *
 * *** THE READINGS, NEVER THE FILES. *** `extracted_text` is in no block here either, for
 * decision 14's reasons. A file the person attaches IS sent, whole, by the engine.
 *
 * *** THE LETTERS. *** `U` a run, `F` a finding, `I` a line in the list, `R` a reading,
 * and `A` is the engine's and is never taken by a brief (`lib/ask/passages.ts` `ATTACHED_PREFIX`;
 * `tests/unit/askEngine.test.ts` holds every brief in the repository to that). `F` is the letter
 * `lib/ask/calendarBrief.ts` already uses for an audit finding, deliberately: the same kind of
 * thing answers to the same letter in both sections.
 *
 * *** AND A RUN LINE AND AN INDEX LINE CARRY A PLAIN-TEXT COPY FOR THE QUOTE CHECK. ***
 * `lib/ask/passages.ts:79` `normalisedWithMap` skips everything between `<` and `>`, so a
 * self-closing tag normalises to the empty string and can never match a quote. Documents found
 * this the expensive way (step 4a-test: six of 36 runs told a person *"we could not find these
 * words in what we have on file"* about a title in their own list) and fixed it with `indexPlain`.
 * A `<audit …/>` line has exactly the same shape, so it gets the same treatment, `runPlain`. A
 * `<finding>` and a `<report>` block never had the problem: their bodies sit outside the tags.
 */
import { STATUS_WORD } from '../documentStatus.ts'
import { AUDITS_EXAMPLE_QUESTIONS } from '../../config/examples.ts'
import { AUDITS_SENTENCES } from '../../prompts/audits-answer.ts'
import {
  AUDITS_LEDE, AUDITS_EMPTY_CONVERSATIONS, AUDITS_ATTACH_LABEL, AUDITS_ATTACH_HREF,
} from '../auditsWords.ts'
import { companyBlock } from './engine.ts'
import { contextBudgetTokens } from './calendarBrief.ts'
import { packReadings } from './readings.ts'
import {
  INDEX_COLUMNS, DROP_ORDER, STATUS_ORDER, ATTENTION_ORDER,
  indexLine, indexPlain, reportBlock, namedBy, INDEX_LEFT_OUT, REPORTS_LEFT_OUT,
  type IndexRow, type ReportParts,
} from './documentsBrief.ts'
import { tokensOf, type Passage } from './passages.ts'
import type { Brief, ContextBlock, Db, PackedContext } from './brief.ts'

/** The audits and their findings are small and come first; the reports take what is left. */
export const RUNS_SHARE = 0.05
export const FINDINGS_SHARE = 0.25
export const INDEX_SHARE = 0.25

/** How many runs are listed at most. Fifty is what `app/api/audit-runs/route.ts` reads. */
export const RUNS_MAX = 50

const attr = (s: string | null | undefined): string =>
  String(s ?? '').replace(/"/g, "'").replace(/\s+/g, ' ').trim()

const statusRank = (s: string): number => {
  const i = STATUS_ORDER.indexOf(s)
  return i === -1 ? STATUS_ORDER.length : i
}

const day = (iso: string | null | undefined): string => (iso ? String(iso).slice(0, 10) : '')

export interface RunRow {
  id: string
  kind: string
  scope: string | null
  agency_label: string | null
  status: string
  section_count: number
  done_count: number
  readings_as_of: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  summary: Record<string, unknown> | null
  previous_run_id: string | null
  template_document_id: string | null
}

export interface SectionRow {
  id: string
  run_id: string
  ordinal: number
  title: string
  status: string
  could_not_complete_reason: string | null
  documents_read: string[] | null
}

export interface FindingRow {
  id: string
  run_id: string
  section_id: string | null
  kind: string
  word: string | null
  title: string
  basis: string | null
  document_id: string | null
  locator: string | null
  quote: string | null
  what_to_do: string | null
  template_line: string | null
  status: string
}

/** The columns a run line is built from. */
export const RUN_COLUMNS =
  'id, kind, scope, agency_label, status, section_count, done_count, readings_as_of, created_at, '
  + 'started_at, finished_at, summary, previous_run_id, template_document_id'
export const SECTION_COLUMNS =
  'id, run_id, ordinal, title, status, could_not_complete_reason, documents_read'
export const FINDING_COLUMNS =
  'id, run_id, section_id, kind, word, title, basis, document_id, locator, quote, what_to_do, '
  + 'template_line, status'

/**
 * The audit's four words, in the product's own vocabulary — `app/audits/page.tsx:85`–`:90` and
 * `components/AuditReport.tsx`, read rather than invented. The chat must not grow a fifth way of
 * saying them (`prompts/audits-answer.ts` `AUDITS_FIVE_WORDS`).
 */
export const FINDING_WORD: Record<string, string> = {
  nothing_on_file: 'nothing on file',
  // The fifth word, decision 47. It reads second everywhere, before "out of date".
  on_file_gaps: 'on file, gaps found',
  stale: 'out of date',
  on_file: 'on file',
  not_a_document_question: 'not a document question',
}

/** What an audit was of, in the person's words: an agency, every agency, or a checklist. */
export function runName(r: RunRow, templateTitle: string | null): string {
  if (r.kind === 'template') return `the checklist ${templateTitle ?? r.scope ?? 'you attached'}`
  const labels = String(r.agency_label ?? '').split(' · ').map((x) => x.trim()).filter(Boolean)
  if (labels.length > 1) return 'every agency'
  return labels[0] ?? 'every agency'
}

const counts = (s: Record<string, unknown> | null): string => {
  if (!s) return ''
  const n = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : 0)
  const parts = [
    n('on_file') ? `${n('on_file')} on file` : '',
    n('on_file_gaps') ? `${n('on_file_gaps')} on file with gaps found` : '',
    n('stale') ? `${n('stale')} out of date` : '',
    n('nothing_on_file') ? `${n('nothing_on_file')} nothing on file` : '',
    n('not_a_document_question') ? `${n('not_a_document_question')} not a document question` : '',
    n('contradictions') ? `${n('contradictions')} disagreements between documents` : '',
    n('expected') ? `${n('expected')} things similar companies hold` : '',
  ].filter(Boolean)
  return parts.join(', ')
}

/**
 * ONE AUDIT, IN ONE LINE. What it was of, when it ran, what it read, and what it found.
 *
 * `read="<n> documents"` comes from the SECTIONS' `documents_read` arrays and not from a count on
 * the run, because there is no such count on the run and summing the sections is what the drawer
 * does (`app/api/audit-runs/[id]/route.ts`'s own comment: *"every document the run touched, not
 * only the ones a finding cites"*).
 */
export function runLine(
  r: RunRow, id: string,
  opts: { templateTitle: string | null; documentsRead: number; didNotFinish: number },
): string {
  const parts = [
    `id="${id}"`,
    `audit="${attr(runName(r, opts.templateTitle))}"`,
    r.kind === 'template' ? 'kind="checklist"' : 'kind="agency"',
    `ran="${day(r.finished_at ?? r.created_at)}"`,
    r.readings_as_of ? `readings_as_of="${day(r.readings_as_of)}"` : '',
    r.status === 'done' ? 'state="finished"' : `state="still running, ${r.done_count} of ${r.section_count} parts done"`,
    opts.documentsRead ? `read="${opts.documentsRead} documents"` : '',
    counts(r.summary) ? `found="${attr(counts(r.summary))}"` : '',
    opts.didNotFinish ? `did_not_finish="${opts.didNotFinish} part(s) of this audit did not finish"` : '',
    r.scope ? `the_person_asked_for="${attr(r.scope)}"` : '',
  ].filter(Boolean)
  return `<audit ${parts.join(' ')}/>`
}

/**
 * *** THE SAME LINE IN PLAIN WORDS, FOR THE QUOTE CHECK ONLY — `indexPlain`'s reason exactly. ***
 * `normalisedWithMap` skips everything between `<` and `>`, and this line is one self-closing
 * tag, so without this the passage is unquotable and a person could be told we cannot find words
 * that are in front of us. Same facts, same order.
 */
export function runPlain(r: RunRow, opts: { templateTitle: string | null; documentsRead: number }): string {
  return [
    runName(r, opts.templateTitle),
    r.kind === 'template' ? 'checklist' : 'agency',
    day(r.finished_at ?? r.created_at),
    opts.documentsRead ? `${opts.documentsRead} documents` : '',
    counts(r.summary),
  ].filter(Boolean).join(' · ')
}

/**
 * *** AN `expected` ROW IS NOT A FINDING, AND SAYING SO IS NOT OPTIONAL. ***
 *
 * `audit_findings` holds three kinds in one table: a `finding` about a document, a
 * `contradiction` between two, and an `expected` — *what a company like this usually holds and we
 * do not see*. `prompts/audit-agency.ts` is explicit about the last one: *"WHAT A COMPANY LIKE
 * THIS USUALLY HOLDS IS A SUGGESTION, NOT A FINDING… it is labelled every time it appears"*, and
 * `app/audits/page.tsx:521` counts it separately for the same reason — its `byWord.nothing_on_file`
 * is `f.word === 'nothing_on_file' && f.kind === 'finding'`.
 *
 * Nine of Cascade's 34 open rows are `expected`, and they carry the word `nothing_on_file`. Packed
 * without their kind they read as nine more things the company has failed to file, which is
 * exactly the upgrade `prompts/audits-answer.ts` `AUDITS_FIVE_WORDS` forbids the model from making
 * — and it would be the packer making it first. Found by reading the packed block back.
 */
export const KIND_WORD: Record<string, string> = {
  expected: 'something companies like this usually hold, which we have not been shown — a suggestion, not a finding',
  contradiction: 'two documents that disagree with each other',
}

/**
 * ONE FINDING, WITH ITS BODY OUTSIDE THE TAGS SO A QUOTE CAN MATCH IT.
 * `lib/ask/calendarBrief.ts` `findingBlock` is the same shape; this one carries four things that
 * section has no use for — the word, the kind, the document it points at, and the checklist line.
 */
export function findingBlock(
  f: FindingRow, id: string, opts: { audit: string; documentTitle: string | null },
): string {
  const head = [
    `id="${id}"`,
    `audit="${attr(opts.audit)}"`,
    f.word ? `word="${attr(FINDING_WORD[f.word] ?? f.word)}"` : '',
    KIND_WORD[f.kind] ? `this_is="${attr(KIND_WORD[f.kind])}"` : '',
    opts.documentTitle ? `document="${attr(opts.documentTitle)}"` : '',
    f.template_line ? `checklist_line="${attr(f.template_line)}"` : '',
    f.locator ? `where="${attr(f.locator)}"` : '',
  ].filter(Boolean).join(' ')
  const body = [
    f.title.trim(),
    f.quote ? `"${f.quote.trim()}"` : '',
    f.basis && f.basis.trim() !== 'read' && f.basis.trim() !== 'inferred' ? f.basis.trim() : '',
    f.what_to_do ? `What to do: ${f.what_to_do.trim()}` : '',
  ].filter(Boolean).join('\n')
  return `<finding ${head}>\n${body}\n</finding>`
}

/**
 * *** THE ONE OFFER'S CHECK LIVES IN `lib/auditsOffer.ts` AND IS RE-EXPORTED HERE. ***
 * It was written in this file at step 6a. Step 6b gave the press to `app/audits/page.tsx`, which
 * is a client file and may not reach `lib/ai.ts` through this brief
 * (`tests/unit/clientImports.test.ts`), so the check moved to a file with no imports. Everything
 * that read it from here still can.
 */
export { checkRunAuditOffer, type CheckedRunAudit } from '../auditsOffer.ts'

/** How the three blocks say what they could not carry. */
export const RUNS_LEFT_OUT = (n: number) =>
  `${n} older audit(s) are on file and are not listed here; say so rather than treating this list `
  + 'as every audit this company has run.'
export const FINDINGS_LEFT_OUT = (n: number) =>
  `${n} further open finding(s) from these audits are not included here. Ask about one agency to see more.`

/** EVERYTHING THE AUDITS CHAT IS GIVEN. Read as the caller — RLS decides what comes back. */
export async function packAuditsContext(db: Db, companyId: string, question: string): Promise<PackedContext> {
  const budget = contextBudgetTokens()
  const blocks: ContextBlock[] = [await companyBlock(db, companyId)]
  const passages: Passage[] = []

  // ---- 2. EVERY AUDIT RUN ----
  const { data: runData, error: runError } = await db.from('audit_runs')
    .select(RUN_COLUMNS).order('created_at', { ascending: false }).limit(RUNS_MAX)
  // §5.1: a read that failed must not look like a company that has never been audited. The chat
  // would otherwise tell a person "you have not audited DEQ" about an audit they ran this morning.
  if (runError) throw new Error(`audit_runs: ${runError.message}`)
  const runs = (runData ?? []) as unknown as RunRow[]

  // The index is read next because a template run is NAMED by its document's title.
  const { data: indexData, error: indexError } = await db.from('document_index_v').select(INDEX_COLUMNS)
  if (indexError) throw new Error(`document_index_v: ${indexError.message}`)
  const all = ((indexData ?? []) as unknown as IndexRow[]).slice().sort((a, b) =>
    statusRank(a.display_status) - statusRank(b.display_status)
    || String(a.title ?? a.file_name ?? '').localeCompare(String(b.title ?? b.file_name ?? '')))
  const titleOf = new Map(all.map((d) => [d.document_id, d.title ?? d.file_name ?? null]))

  // The sections, for how many documents each run read and for the parts that did not finish.
  let sections: SectionRow[] = []
  if (runs.length) {
    const { data, error } = await db.from('audit_sections')
      .select(SECTION_COLUMNS).in('run_id', runs.map((r) => r.id)).order('ordinal')
    if (error) throw new Error(`audit_sections: ${error.message}`)
    sections = (data ?? []) as unknown as SectionRow[]
  }
  const readOf = (runId: string) => new Set(sections.filter((s) => s.run_id === runId)
    .flatMap((s) => s.documents_read ?? [])).size
  const failedOf = (runId: string) =>
    sections.filter((s) => s.run_id === runId && s.status === 'could_not_complete').length

  const runsCap = Math.max(0, Math.floor(budget * RUNS_SHARE))
  const packedRuns = packReadings(runs, {
    cap: runsCap,
    idPrefix: 'U',
    blockFor: (r, id) => runLine(r, id, {
      templateTitle: r.template_document_id ? titleOf.get(r.template_document_id) ?? null : null,
      documentsRead: readOf(r.id), didNotFinish: failedOf(r.id),
    }),
    passageFor: (r, id) => ({
      id,
      title: `${runName(r, r.template_document_id ? titleOf.get(r.template_document_id) ?? null : null)}, ${day(r.finished_at ?? r.created_at)} — what the audit found`,
      label: 'your audit',
      // `runPlain`, NOT the line: the line is one self-closing tag and the normaliser skips it
      // whole, so a quote could never match it (`indexPlain`'s reason, and the same bug).
      text: runPlain(r, {
        templateTitle: r.template_document_id ? titleOf.get(r.template_document_id) ?? null : null,
        documentsRead: readOf(r.id),
      }),
      // The card opens the audit report drawer, which `/audits` already reads (`?run=`).
      href: `/audits?run=${r.id}`,
      shortName: `the ${runName(r, r.template_document_id ? titleOf.get(r.template_document_id) ?? null : null)} audit of ${day(r.finished_at ?? r.created_at)}`,
    }),
  })
  passages.push(...packedRuns.passages)
  const runsNote = packedRuns.leftOut ? RUNS_LEFT_OUT(packedRuns.leftOut) : ''
  const runsText = runs.length
    ? `Every audit this company has run (${runs.length} in all, newest first):\n`
      + packedRuns.texts.join('\n') + (runsNote ? `\n${runsNote}` : '')
    : 'This company has not run an audit yet.'
  blocks.push({ name: 'your audits', text: runsText, chars: runsText.length,
    tokens: tokensOf(runsText), leftOut: runsNote || null })

  // ---- 3. THE FINDINGS of the latest finished run per agency, and of the latest checklist run ----
  //
  // "Latest per agency" is read off the SECTIONS and not off `agency_label`, for the reason
  // `app/api/audits/index/route.ts:88`–`:91` gives: an "all agencies" run carries every label in
  // one string, and its SECTIONS are what belong to one agency.
  const done = runs.filter((r) => r.status === 'done')
  const wantedRuns = new Map<string, RunRow>()
  for (const r of done) {
    if (r.kind === 'template') { if (!wantedRuns.has('template')) wantedRuns.set('template', r); continue }
    for (const s of sections.filter((x) => x.run_id === r.id)) {
      if (!wantedRuns.has(s.title)) wantedRuns.set(s.title, r)
    }
  }
  const latestIds = [...new Set([...wantedRuns.values()].map((r) => r.id))]

  let findings: FindingRow[] = []
  if (latestIds.length) {
    const { data, error } = await db.from('audit_findings')
      .select(FINDING_COLUMNS).in('run_id', latestIds).eq('status', 'open').order('ordinal')
    if (error) throw new Error(`audit_findings: ${error.message}`)
    findings = (data ?? []) as unknown as FindingRow[]
  }
  // A date finding is a calendar row, not something a person reads here, and it carries no word.
  // And the suggestions go LAST: `packReadings` never reorders (that is the section's job), so
  // this is where it is decided that a real finding about a real document outranks "companies
  // like you usually hold this" when the budget runs out.
  const shown = [
    ...findings.filter((f) => f.kind === 'finding' || f.kind === 'contradiction'),
    ...findings.filter((f) => f.kind === 'expected'),
  ]
  const runById = new Map(runs.map((r) => [r.id, r]))
  const auditNameOf = (f: FindingRow): string => {
    const r = runById.get(f.run_id)
    if (!r) return 'an audit'
    const sec = sections.find((s) => s.id === f.section_id)
    const name = r.kind === 'template'
      ? runName(r, r.template_document_id ? titleOf.get(r.template_document_id) ?? null : null)
      : sec?.title ?? runName(r, null)
    return `${name}, ${day(r.finished_at ?? r.created_at)}`
  }

  const packedFindings = packReadings(shown, {
    cap: Math.max(0, Math.floor(budget * FINDINGS_SHARE)),
    idPrefix: 'F',
    blockFor: (f, id) => findingBlock(f, id, {
      audit: auditNameOf(f),
      documentTitle: f.document_id ? titleOf.get(f.document_id) ?? null : null,
    }),
    passageFor: (f, id, block) => ({
      id, title: `${f.title} — the audit's own words`, label: 'an audit finding', text: block,
      // The card opens the audit it came from, which is where its line lives.
      href: `/audits?run=${f.run_id}`, shortName: f.title,
    }),
  })
  passages.push(...packedFindings.passages)
  if (packedFindings.texts.length || packedFindings.leftOut) {
    const note = packedFindings.leftOut ? FINDINGS_LEFT_OUT(packedFindings.leftOut) : ''
    const text = 'What the latest audit of each agency, and the latest audit against a checklist, '
      + `found and nobody has closed yet:\n${packedFindings.texts.join('\n\n')}`
      + (note ? `\n\n${note}` : '')
    blocks.push({ name: 'the findings', text, chars: text.length, tokens: tokensOf(text), leftOut: note || null })
  }

  // ---- 4. THE INDEX: every document, whole — Documents' rule and Documents' packer ----
  const indexCap = Math.floor(budget * INDEX_SHARE)
  let listed = all
  const droppedStatuses: string[] = []
  const indexCost = (xs: IndexRow[]) => tokensOf(xs.map((d, i) => indexLine(d, `I${i + 1}`)).join('\n'))
  for (const status of DROP_ORDER) {
    if (indexCost(listed) <= indexCap) break
    const before = listed.length
    listed = listed.filter((d) => d.display_status !== status)
    if (listed.length !== before) droppedStatuses.push(STATUS_WORD[status] ?? status)
  }
  const indexLeftOut = all.length - listed.length
  const indexLines = listed.map((d, i) => {
    const id = `I${i + 1}`
    const line = indexLine(d, id)
    passages.push({
      id, title: `${d.title ?? d.file_name ?? 'A document'} — its line in your list`,
      label: 'your document', text: indexPlain(d),
      href: `/documents?document=${d.document_id}`, shortName: d.title ?? d.file_name ?? 'that document',
      // E2d: the other name an answer may write for it.
      fileName: d.file_name ?? null,
    })
    return line
  })
  const indexNote = indexLeftOut ? INDEX_LEFT_OUT(indexLeftOut, droppedStatuses) : ''
  const indexText = `Every document this company holds (${all.length} in all`
    + `${indexLeftOut ? `, ${listed.length} listed` : ''}):\n`
    + (indexLines.join('\n') || 'This company holds no documents yet.')
    + (indexNote ? `\n${indexNote}` : '')
  blocks.push({ name: 'your documents', text: indexText, chars: indexText.length,
    tokens: tokensOf(indexText), leftOut: indexNote || null })

  // ---- 5. THE REPORTS: the ones the question names, then the ones the findings point at ----
  const named = listed.filter((d) => namedBy(question, d))
  const takenIds = new Set(named.map((d) => d.document_id))
  // The order the findings were shown in, so a report follows the finding that asked for it.
  const pointedAt: IndexRow[] = []
  for (const f of shown) {
    if (!f.document_id || takenIds.has(f.document_id)) continue
    const d = listed.find((x) => x.document_id === f.document_id)
    if (d) { pointedAt.push(d); takenIds.add(d.document_id) }
  }
  const attention = ATTENTION_ORDER.flatMap((s) =>
    listed.filter((d) => d.display_status === s && !takenIds.has(d.document_id)))
  const wanted = [...named, ...pointedAt, ...attention]

  if (wanted.length) {
    const ids = wanted.map((d) => d.document_id)
    const [gaps, deadlines, conditions, corrections, labels] = await Promise.all([
      db.from('document_gaps').select('document_id, title, description, fix, citation, locator, status')
        .in('document_id', ids).order('ordinal'),
      db.from('document_deadlines').select('document_id, title, due_on, recurs, source_line')
        .in('document_id', ids).order('due_on', { nullsFirst: false }),
      db.from('document_conditions').select('document_id, condition_ref, title, evidence_expected')
        .in('document_id', ids).order('ordinal'),
      db.from('document_corrections').select('document_id, field, new_value, reason')
        .in('document_id', ids).order('created_at', { ascending: false }),
      db.from('company_labels').select('kind, label').order('kind').order('label'),
    ])
    const parts: ReportParts = {
      gaps: (gaps.data ?? []) as ReportParts['gaps'],
      deadlines: (deadlines.data ?? []) as ReportParts['deadlines'],
      conditions: (conditions.data ?? []) as ReportParts['conditions'],
      corrections: (corrections.data ?? []) as ReportParts['corrections'],
      labels: (labels.data ?? []) as ReportParts['labels'],
    }
    const spentSoFar = blocks.reduce((n, b) => n + b.tokens, 0)
    const packed = packReadings(wanted, {
      cap: Math.max(0, budget - spentSoFar),
      idPrefix: 'R',
      blockFor: (d, id) => reportBlock(d, parts, id),
      passageFor: (d, id, block) => ({
        id, title: `${d.title ?? d.file_name ?? 'A document'} — what we read in it`,
        label: 'your document', text: block,
        href: `/documents?document=${d.document_id}`, shortName: d.title ?? d.file_name ?? 'that document',
        fileName: d.file_name ?? null,
      }),
    })
    passages.push(...packed.passages)
    if (packed.texts.length || packed.leftOut) {
      const note = packed.leftOut ? REPORTS_LEFT_OUT(packed.leftOut) : ''
      const text = `What we read in these documents:\n${packed.texts.join('\n\n')}`
        + (note ? `\n\n${note}` : '')
      blocks.push({ name: 'the readings', text, chars: text.length, tokens: tokensOf(text), leftOut: note || null })
    }
  }

  return { blocks, passages }
}

/** The Audits chat's brief. Five things; `extraStep` is deliberately absent. */
export const auditsBrief: Brief = {
  section: 'audits_chat',
  /**
   * Every one of these comes from `lib/auditsWords.ts`, which the page reads too, so the brief
   * and the screen cannot say two different things. Nothing can read these fields — a brief
   * reaches `lib/ai.ts` and no client file may (`tests/unit/clientImports.test.ts`) — and they
   * are filled anyway, because `checkBrief` requires them and because this is where a reader
   * looks for a section's words.
   */
  words: {
    attachLabel: AUDITS_ATTACH_LABEL,
    /** Kept for a section that links; the Audits page passes `onPick` and uploads in place (6b). */
    attachHref: AUDITS_ATTACH_HREF,
    examples: AUDITS_EXAMPLE_QUESTIONS.map((e) => e.question),
    emptyConversations: AUDITS_EMPTY_CONVERSATIONS,
    lede: AUDITS_LEDE,
  },
  packContext: (db, companyId, question) => packAuditsContext(db, companyId, question),
  promptSentences: AUDITS_SENTENCES,
  /**
   * *** ONE OFFER — decision 41, wired in 6b after decision 43 let `lib/ask/offers.ts` learn it. ***
   *
   * The model proposes; `checkRunAuditOffer` above holds the payload against the company's own
   * agency labels; the press in `app/audits/page.tsx` starts the run through the same
   * `POST /api/audit-runs` the Audit button calls. The model never starts one.
   *
   * Measured before it was wired (step 6a, 18 runs on Sonnet): the model wrote the block in 18 of
   * 18, named an agency the company does not hold in 0, and the three the code refused all wrote
   * a passage handle where an id belonged — which is why the block now carries `attached: true`
   * and no id at all (decision 45).
   */
  offers: ['run_audit'],
}
