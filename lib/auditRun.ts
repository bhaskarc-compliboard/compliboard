// THE AUDIT AS ROWS — Audits Run 2a, item 5.
//
// Runs 1, 1b and 1c proved the answer against a written key with the whole thing in a JSON file.
// This is the same call, writing rows, because the question the product exists to answer — "what
// changed since last time, and what did we fix" — is a query or it is nothing (migration 058's
// header). Three functions, and a fourth that matches one run against the last:
//
//   createRun        the run and one section per agency the company's readings actually name
//   runSection       one agency, one call, one set of rows. NEVER throws out of the sweep.
//   finishRunIfDone  the counts, the freshness date, the summary the email and the banner share
//   matchAgainstPrevious  carried forward or closed, by handle, never by string equality
//
// *** THE SHAPE IS DOCUMENTS' SHAPE, DELIBERATELY. *** `lib/documentBatch.ts` already has a sweep,
// an email, a banner and a summary written against batches-of-files; a second shape for
// runs-of-sections would mean a second sweep and two places for the same bug. So a section claims
// like a document (`claimed_at` against `documents.reading_since`), a run finishes like a batch
// (`.neq('status','done')` before any email), and the summary carries counts with the titles behind
// them because "a number is never shown without what it is made of" (that file, `BatchSummary`).

import { createHash } from 'node:crypto'
import { readableScanIds } from './readableScan.ts'

import { askAIWithCitations, extractJsonText, modelForTask } from './ai.ts'
import { buildAuditInput, auditAgenciesFor, type AuditInput } from './audit.ts'
import { auditAgencyPrompt, auditTemplatePrompt, type PreviousFinding } from '../prompts/audit-agency.ts'
import { countLines, type TemplateSection, type ExtractedTemplate } from './auditTemplate.ts'
import { patchRunSummary } from './auditSummary.ts'
import { mustRow, mustRows, mustCount } from './mustRead.ts'
import { answerWith } from './answerShape.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

/** The four collections the model returns, and the `kind` each becomes in one table. */
const KINDS = [
  { field: 'findings', kind: 'finding' },
  { field: 'dates', kind: 'date' },
  { field: 'contradictions', kind: 'contradiction' },
  { field: 'expected_not_seen', kind: 'expected' },
] as const

export interface RunSummary {
  /** Every row the run wrote, however it is counted below. */
  total: number
  /**
   * *** THE ONLY NUMBER THAT LEADS — ruled 30 September, Run 3 item 1. ***
   * Nothing on file, plus stale, plus disagreements between documents, plus questions no
   * document can settle. `total` counts every row the audit wrote, and most of them are things
   * that are FINE — a permit on file, a date in the future, an expected item that is a
   * suggestion. A subject line reading "115 things to look at" when 19 need a person is the
   * omniscient status tracker pointing the other way: alarming rather than reassuring, and
   * wrong either way. On-file and expected rows are listed after, in their own words.
   */
  needs_person: number
  nothing_on_file: number
  stale: number
  on_file: number
  not_a_document_question: number
  contradictions: number
  dates_passed: number
  expected: number
  sections: number
  sections_done: number
  could_not_complete: number
  /** Carried and closed, when this run had a previous one to match against. */
  carried: number
  /**
   * How many of a PREVIOUS run's findings this run closed. E10, N3: it used to include this run's
   * own duplicate merges, which `collapseAgainstEarlier` also stamps with `closed_by_run_id`.
   * Since the owner's decision D1, the only close an audit makes on its own is "Now on file".
   */
  closed: number
  /**
   * Previous findings this run did not raise — the owner's decision D1.3, migration 082. They are
   * still OPEN and a person closes them, so this is counted apart from `closed` and the two are
   * never added together.
   */
  not_raised?: number
  /** Links the model made to a previous item of another kind, ignored and counted (D1.1). */
  wrong_kind_links?: number
  /** Findings the code turned into dates because they were not due yet (Run 4a, item 2). */
  reshaped_to_dates?: Array<{ title: string; due_on: string }>
  /** Dropped by the shaper, counted so a silent rule is visible. Audits Run 6a, item 1. */
  dropped_undated?: Array<{ title: string; recurs: boolean | null }>
  dropped_wordless?: Array<{ title: string; kind: string }>
  /** The ledger row the checklist extraction wrote, on a template run. Run 6a, item 3. */
  extraction_ai_call_id?: string | null
  /** How many findings two sections both raised and were collapsed into one. Run 7b, item 5. */
  collapsed_duplicates?: number
  /** The titles behind the counts, so a number is never shown without what it is made of. */
  attention: Array<{ title: string; word: string | null; document: string | null }>
  agencies: string[]
  note: string | null
  /**
   * How many parts of this run have been RE-RUN after failing — fix list **A9**, Job E3.
   * Carried on the summary (there is no column for it), and read by the email so a second one about
   * the same audit says why a second one came.
   */
  retried_parts?: number
  /**
   * Whether an email for this run had actually gone before a retry cleared `notified_at` — E10, §4.
   * The second email may only say "This replaces the email we sent before" when this is true.
   */
  emailed_before?: boolean
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * A run, and one section per agency.
 *
 * *** A SECTION IS AN AGENCY, AND THE AGENCIES COME FROM THE COMPANY'S OWN READINGS. ***
 * Not from a canonical list, because there is not one: the label is whatever the readings wrote
 * into `company_labels`, and §144 records what happens when a cheap model writes the wrong one.
 *
 * *** A COMPANY WITH NO LABELS GETS A FINISHED RUN THAT SAYS SO. *** Not an error, and not an
 * empty queued run that the sweep would carry for ever: a company that has uploaded nothing has
 * nothing to audit, and the honest answer is a done run whose summary is one sentence. §5.1 — an
 * empty state is a message, and "nothing found" is a claim that has to be true.
 */
export async function createRun(db: Db, args: {
  companyId: string
  kind?: 'agency' | 'template'
  /** One label, or 'all' for every label the company holds. */
  agency?: string
  scope?: string | null
  entityId?: string | null
  createdBy?: string | null
  previousRunId?: string | null
  /** A template run: the document the checklist is, and the lines read off it. */
  templateDocumentId?: string | null
  templateSections?: TemplateSection[]
  /**
   * *** READ THE CHECKLIST HERE, AFTER THE RUN ROW EXISTS — Audits Run 6a, item 3. ***
   *
   * Pass this instead of `templateSections` and the run is inserted FIRST, with `started_at` set,
   * and only then is the checklist read. That ordering is the whole point: the extraction is a model
   * call billed to task `audit`, and until now every caller made it before there was a run to hang
   * it on, so the run's own window began after the money was spent. `costOfSections` reported
   * $0.5405 for an audit that cost $0.5634 — short by exactly this call, on every template audit
   * ever run.
   *
   * `templateSections` still works and is what a caller with the lines already in hand should use;
   * nothing that passes it changes behaviour.
   */
  templateExtract?: () => Promise<ExtractedTemplate>
  /** What to say when the file held no lines. `extractTemplate` writes this sentence. */
  templateNote?: string | null
  /** A company the checklist names, when it names one that is not this company. */
  templateCompanyName?: string | null
  /** This company's own name, to compare against. */
  companyName?: string | null
}): Promise<{ runId: string; sectionIds: string[]; agencies: string[]; status: string
              /** A template run only: the checklist as read, and anything to say about the file. */
              templateSections?: TemplateSection[]; note?: string | null }> {
  const kind = args.kind ?? 'agency'

  // ---------------------------------------------------------------------------
  // A TEMPLATE RUN: ONE SECTION PER CHECKLIST SECTION — Audits Run 4b, item 7.
  //
  // The sections come from the checklist, not from the company's agencies: a checklist may span
  // regulators (case 13's own form covers the air permit, forklifts and extinguishers), which is
  // exactly why a template audit is shown EVERY document the company holds rather than one agency's.
  // ---------------------------------------------------------------------------
  if (kind === 'template') {
    if (!args.templateDocumentId) throw new Error('createRun: a template run needs a document')

    /**
     * THE RUN ROW GOES IN BEFORE THE CHECKLIST IS READ, when the caller hands us the reading rather
     * than its result. `started_at` is stamped here, so the run's window opens before the extraction
     * call rather than after it.
     *
     * It is safe to leave a run sitting with zero sections for the length of one model call: the
     * sweep only picks up a run that HAS a queued section — `app/api/jobs/audit-sections/route.ts`
     * selects queued runs, then asks each for a queued section and skips it if there is none — so a
     * sectionless run is invisible to the cron and cannot be marked finished behind our back.
     */
    let extracted: ExtractedTemplate | null = null
    let shellRunId: string | null = null
    let startedAt: string | null = null
    if (args.templateExtract) {
      startedAt = new Date().toISOString()
      const { data: shell, error: shErr } = await db.from('audit_runs').insert({
        company_id: args.companyId,
        entity_id: args.entityId ?? null,
        kind: 'template', scope: args.scope ?? null,
        template_document_id: args.templateDocumentId,
        template_lines: [],
        previous_run_id: args.previousRunId ?? null,
        section_count: 0,
        created_by: args.createdBy ?? null,
        status: 'queued',
        started_at: startedAt,
      }).select('id').single()
      if (shErr) throw new Error(`createRun (template): ${shErr.message}`)
      shellRunId = shell.id
      extracted = await args.templateExtract()
    }

    const sections = extracted ? extracted.sections : (args.templateSections ?? [])
    /**
     * *** A CHECKLIST NAMING SOMEBODY ELSE IS NOTED, AND AUDITED ANYWAY — Run 5a, item 6. ***
     * An auditor's field form and a trade body's template both name somebody who is not you, and
     * auditing yourself against one is a normal thing to want. The model's instinct was to refuse;
     * the product's job is to say what it noticed and get on with it.
     * Compared loosely — case and punctuation only — because "Cascade Specialty Chemicals, LLC" and
     * "CASCADE SPECIALTY CHEMICALS LLC" are the same company and a strict compare would announce a
     * mismatch that is not one.
     */
    const loose = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const named = (extracted?.companyName ?? args.templateCompanyName ?? '').trim()
    const mine = (args.companyName ?? '').trim()
    const elsewhere = named && mine && loose(named) !== loose(mine) ? named : null
    const noteLines = [
      elsewhere ? `This checklist names ${elsewhere}; treated as a template for you.` : null,
      sections.length ? null : (extracted?.note ?? args.templateNote
        ?? 'We could not find any checklist lines in that file, so there was nothing to audit '
           + 'against. The file is on file.'),
    ].filter(Boolean) as string[]

    /**
     * THE SUMMARY CARRIES THE EXTRACTION'S RECEIPT. `extraction_ai_call_id` is the ledger row the
     * checklist reading wrote, so a reader does not have to infer the cost from a time window: it
     * can add that row by id. `costOfSections` uses both — the id when it is there, the window when
     * the poll came back empty — and deduplicates, so neither is counted twice.
     */
    const summaryBase = {
      ...emptySummary(noteLines.length ? noteLines.join(' ') : null),
      ...(extracted?.ai_call_id ? { extraction_ai_call_id: extracted.ai_call_id } : {}),
    }
    const hasSummary = noteLines.length > 0 || !!extracted?.ai_call_id

    const fields = {
      company_id: args.companyId,
      entity_id: args.entityId ?? null,
      kind: 'template', scope: args.scope ?? null,
      template_document_id: args.templateDocumentId,
      template_lines: sections,
      previous_run_id: args.previousRunId ?? null,
      section_count: sections.length,
      created_by: args.createdBy ?? null,
      status: sections.length ? 'queued' : 'done',
      // The note goes on the run whether it finishes now or is about to run: a sentence about the
      // form is true before any line is answered.
      ...(sections.length
        ? (hasSummary ? { summary: summaryBase } : {})
        : {
            // `startedAt` when the run row went in before the reading; otherwise now, which is what
            // every caller that hands us finished sections still gets.
            started_at: startedAt ?? new Date().toISOString(),
            finished_at: new Date().toISOString(),
            summary: { ...summaryBase, note: noteLines.join(' ') },
          }),
    }

    // The shell row is UPDATED rather than a second row inserted: the run a caller is told about
    // must be the run whose window opened before the checklist was read.
    let runId: string
    if (shellRunId) {
      const { error } = await db.from('audit_runs').update(fields).eq('id', shellRunId)
      if (error) throw new Error(`createRun (template): ${error.message}`)
      runId = shellRunId
    } else {
      const { data: run, error } = await db.from('audit_runs').insert(fields).select('id').single()
      if (error) throw new Error(`createRun (template): ${error.message}`)
      runId = run.id
    }
    const run = { id: runId }
    const extractNote = extracted ? extracted.note : (args.templateNote ?? null)
    if (!sections.length) {
      return { runId: run.id, sectionIds: [], agencies: [], status: 'done',
               templateSections: sections, note: extractNote }
    }

    const rows = sections.map((sec, i) => ({
      run_id: run.id, company_id: args.companyId, ordinal: i, title: sec.title,
    }))
    const { data: secs, error: sErr } = await db.from('audit_sections').insert(rows).select('id, ordinal')
    if (sErr) throw new Error(`createRun (template): writing sections: ${sErr.message}`)
    return {
      runId: run.id,
      sectionIds: (secs ?? []).sort((a: { ordinal: number }, b: { ordinal: number }) => a.ordinal - b.ordinal)
        .map((x: { id: string }) => x.id),
      agencies: sections.map((x) => x.title), status: 'queued',
      templateSections: sections, note: extractNote,
    }
  }

  if (kind !== 'agency') throw new Error(`createRun: only agency and template are built; got "${kind}"`)

  const held = await auditAgenciesFor(db, args.companyId)
  const agencies = !args.agency || args.agency === 'all'
    ? held
    : held.filter((l) => l === args.agency)

  if (args.agency && args.agency !== 'all' && !agencies.length) {
    throw new Error(`createRun: "${args.agency}" is not one of this company's agency labels. `
      + `It holds: ${held.join(' · ') || '(none)'}`)
  }

  // A run must name what it audited (058's `audit_runs_kind_has_its_subject`), and an 'all' run
  // over several agencies names them together — the sections carry them one at a time.
  const label = agencies.length === 1 ? agencies[0] : (agencies.join(' · ') || 'no agency on file')

  const { data: run, error } = await db.from('audit_runs').insert({
    company_id: args.companyId,
    entity_id: args.entityId ?? null,
    kind, scope: args.scope ?? null,
    agency_label: label,
    previous_run_id: args.previousRunId ?? null,
    section_count: agencies.length,
    created_by: args.createdBy ?? null,
    status: agencies.length ? 'queued' : 'done',
    ...(agencies.length ? {} : {
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      summary: emptySummary('No document on file names an agency yet, so there is nothing to audit. '
        + 'Upload a permit, a plan or a record and the audit will have something to read.'),
    }),
  }).select('id').single()
  if (error) throw new Error(`createRun: ${error.message}`)

  if (!agencies.length) return { runId: run.id, sectionIds: [], agencies: [], status: 'done' }

  const rows = agencies.map((a, i) => ({
    run_id: run.id, company_id: args.companyId, ordinal: i, title: a,
  }))
  const { data: secs, error: sErr } = await db.from('audit_sections').insert(rows).select('id, ordinal')
  if (sErr) throw new Error(`createRun: writing sections: ${sErr.message}`)

  return {
    runId: run.id,
    sectionIds: (secs ?? []).sort((a: { ordinal: number }, b: { ordinal: number }) => a.ordinal - b.ordinal)
      .map((s: { id: string }) => s.id),
    agencies, status: 'queued',
  }
}

function emptySummary(note: string | null): RunSummary {
  return { total: 0, needs_person: 0, nothing_on_file: 0, stale: 0, on_file: 0, not_a_document_question: 0,
           contradictions: 0, dates_passed: 0, expected: 0, sections: 0, sections_done: 0,
           could_not_complete: 0, carried: 0, closed: 0, reshaped_to_dates: [],
           dropped_undated: [], dropped_wordless: [],
           attention: [], agencies: [], note }
}

// ---------------------------------------------------------------------------
// RUN ONE SECTION
// ---------------------------------------------------------------------------

/**
 * One agency, one call, one set of rows.
 *
 * *** IT NEVER THROWS. *** The sweep runs several sections for several companies in one request;
 * a section that dies must cost its own section and nothing else. So every failure lands as
 * `could_not_complete` with a reason a person can read, and the reason is stored on the row rather
 * than only logged — §5.1, a failure the customer can see is a failure somebody can act on.
 */
export async function runSection(db: Db, sectionId: string, opts: { today?: string } = {}):
  Promise<{ status: 'done' | 'could_not_complete'; findings: number; reason?: string
            reshaped?: Array<{ title: string; due_on: string }>
            droppedUndated?: Array<{ title: string; recurs: boolean | null }>
            droppedWordless?: Array<{ title: string; kind: string }>
            mappedWords?: Array<{ ref: string; from: string; to: string }> }> {
  const startedAt = new Date().toISOString()

  const { data: sec, error: sErr } = await db.from('audit_sections')
    .select('id, run_id, company_id, ordinal, title').eq('id', sectionId).maybeSingle()
  if (sErr) throw new Error(`runSection: reading the section: ${sErr.message}`)
  if (!sec) throw new Error(`runSection: no section ${sectionId}`)

  /**
   * *** THE RUN'S START IS NOT MOVED ONCE IT IS SET, AND THAT IS NOT A DETAIL. ***
   *
   * This used to be one statement — `update({ status: 'running', started_at: startedAt })` where
   * `status = 'queued'` — written when a run's `started_at` was always null until its first section
   * began. A template run's is NOT null: `createRun` stamps it before reading the checklist, so the
   * run's window opens before the extraction call (Run 6a, item 3). Setting it again here moved the
   * window forward past that call and put the cost back outside it — the same defect, one layer down,
   * and `check:live` caught it as "$0.0073 reported against $0.0060 in the ledger".
   *
   * Two statements: the status always, the start only when there is not one. `.is('started_at', null)`
   * is the whole guard, and it is safe because the sweep runs one company's sections one after another.
   */
  const begin = async () => {
    await db.from('audit_runs').update({ status: 'running' })
      .eq('id', sec.run_id).eq('status', 'queued')
    await db.from('audit_runs').update({ started_at: startedAt })
      .eq('id', sec.run_id).is('started_at', null)
  }

  const fail = async (reason: string) => {
    await db.from('audit_sections').update({
      status: 'could_not_complete', could_not_complete_reason: reason.slice(0, 2000),
      started_at: startedAt, finished_at: new Date().toISOString(),
    }).eq('id', sectionId)
    await begin()
    return { status: 'could_not_complete' as const, findings: 0, reason }
  }

  try {
    await db.from('audit_sections').update({ status: 'running', started_at: startedAt }).eq('id', sectionId)
    await begin()

    // *** A TEMPLATE SECTION IS A DIFFERENT QUESTION OVER THE SAME EVIDENCE. ***
    // The run's kind decides. A template section is shown EVERY document the company holds, because
    // a checklist spans regulators; the sentinel `'*'` is what `buildAuditInput` takes to mean that.
    // *** A6: IF THE RUN ROW CANNOT BE READ, THE SECTION IS NOT AN AUDIT *** (root R2, Job E4).
    // Unchecked, `runRow` was null and everything downstream took its default: `isTemplate` false,
    // so a CHECKLIST section was audited as an agency named after a checklist line; no document
    // carries that name, so the model was shown "(none…)"; the section was saved DONE; and the link
    // to the previous run was lost, so nothing carried or closed. Four wrong answers from one
    // unread row. `fail(...)` when the row is not there OR could not be read — the two are
    // different and both mean this section cannot be audited.
    const runRead = await db.from('audit_runs')
      .select('kind, template_lines, previous_run_id, template_document_id').eq('id', sec.run_id).maybeSingle()
    if (runRead.error) return await fail(`This audit's own row could not be read: ${runRead.error.message}`)
    const runRow = runRead.data
    if (!runRow) return await fail('This audit\'s own row is no longer there, so the part could not be run.')
    const isTemplate = runRow?.kind === 'template'

    const built = await buildAuditInput(db, sec.company_id, isTemplate ? '*' : sec.title,
      { today: opts.today })

    // The previous run's open findings, if this run is a re-audit. Shown as F1, F2 — the same
    // reason documents are shown as D1, D2: the model must be able to point at one without
    // copying an identifier it can get wrong (§144).
    const previous = runRow?.previous_run_id
      ? await previousOpenFindings(db, sec.company_id, runRow.previous_run_id, sec.title)
      : []

    // The section's own lines, off the run, so a re-audit asks the same questions in the same order
    // rather than paying to extract them again (migration 059's header).
    const templateSection = isTemplate
      ? ((runRow?.template_lines ?? []) as TemplateSection[])[sec.ordinal] ?? null
      : null
    if (isTemplate && !templateSection) {
      return await fail('We could not find this part of the checklist on the run any more. '
        + 'Nothing was recorded for it.')
    }

    /**
     * *** WHAT THE EARLIER SECTIONS OF THIS RUN ALREADY RAISED — Audits Run 8a, item 4. ***
     *
     * Only for an agency section, and only when there is an earlier one: the sweep claims a
     * company's queued sections together and runs them one after another
     * (`app/api/jobs/audit-sections/route.ts`), so by the time section 2 runs, section 1's findings
     * are rows. A template run asks one question per checklist line and cannot duplicate across its
     * sections, so it is not shown this.
     */
    const raisedInRun = isTemplate ? [] : await raisedEarlierInRun(db, sec.run_id, sectionId)

    const system = isTemplate
      ? auditTemplatePrompt(templateSection!)
      : auditAgencyPrompt({
          ...(previous.length ? { previous: previous.map((p) => p.shown) } : {}),
          ...(raisedInRun.length ? { raisedInRun: raisedInRun.map((p) => p.shown) } : {}),
        })
    const promptSha = createHash('sha256').update(system).digest('hex')
    const model = modelForTask('audit')

    const answer = await askAIWithCitations(system, built.block, {
      /**
       * *** 16,000 FROM THE FIRST ATTEMPT, ON EVERY MODEL — Audits Run 6a, item 2. ***
       *
       * It was 8,000, and the rev 1 baseline measured what that costs: five of fifteen runs came
       * back `stop_reason=max_tokens` and were retried at 16,000 by `lib/ai.ts`, which accumulates
       * the ledger ACROSS retries — so the truncated attempt is bought and thrown away. On
       * cascade-deq the same audit cost $0.4508 with the retry and $0.2158 without it, and the
       * retry was the whole difference.
       *
       * An agency audit is one call over a whole filing cabinet: twelve documents, their conditions,
       * their gaps, and one row per answer. 8,000 was the default nobody had measured against that
       * shape. The retry in `askAI` STAYS — it is the backstop for the run that needs 20,000, and it
       * climbs to the hard ceiling from here rather than from half-way down.
       *
       * This raises no price on its own: output tokens are billed as used, not as reserved. What it
       * removes is the attempt that is paid for and discarded.
       */
      maxTokens: 16000, enableWebSearch: true,
      task: 'audit', ledger: { companyId: sec.company_id, task: 'audit' },
    })
    const raw = answer.text ?? ''
    // *** PARSED, AND THEN CHECKED THAT IT FITS *** — fix list S1 and A7, root R4, Job E.
    //
    // `if (!obj)` below used to catch only an EXCEPTION. Valid JSON of the wrong shape sailed past
    // it: `[1]` (a citation marker `extractJsonText` mistook for the answer — S1), a wrapped object,
    // a renamed key, a bare `[]` (A7). `shapeFindings` then found no fields, wrote no rows, and the
    // section was saved **done with zero findings** and emailed as "found nothing that needs you".
    // A whole agency audit, paid for, recorded as a clean bill of health.
    //
    // The fields are the ones this run's shaper actually reads, so the check and the shaping cannot
    // drift: `KINDS` for an agency section, `lines` for a checklist one.
    const FIELDS = isTemplate ? (['lines'] as const) : KINDS.map((k) => k.field)
    let obj: Record<string, unknown> | null = null
    let shapeWhy = 'the audit came back as something we could not read at all'
    try {
      const fits = answerWith(JSON.parse(extractJsonText(raw)), FIELDS)
      if (fits.ok) obj = fits.obj
      else shapeWhy = fits.why
    } catch { obj = null }

    // The ledger row, found by time and polled, because `recordAICall` is deliberately not awaited
    // (`lib/documentScan.ts` says the same in more words). A missing link loses the receipt, never
    // the answer.
    let aiCallId: string | null = null
    for (let i = 0; i < 5 && !aiCallId; i++) {
      if (i) await new Promise((r) => setTimeout(r, 250))
      // The LEDGER POLL is deliberately tolerant — "a missing link loses the receipt, never the
      // answer" — but a failed read is now SAID, so a receipt lost to a broken query is not
      // indistinguishable from one the write had not landed yet (E4).
      const { data: call, error: callErr } = await db.from('ai_calls')
        .select('id').eq('company_id', sec.company_id).eq('task', 'audit')
        .gte('created_at', startedAt).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (callErr) console.warn(`audit section ${sectionId}: the ledger row could not be looked up: ${callErr.message}`)
      aiCallId = call?.id ?? null
    }

    if (!obj) {
      await db.from('audit_sections').update({
        model, prompt_sha256: promptSha, input_sha256: built.sha256, ai_call_id: aiCallId,
        raw_text: raw.slice(0, 20000), json_parsed: false, handles: built.input.handles,
      }).eq('id', sectionId)
      // The reason names WHAT came back (S1/A7): "it carried \"result\"" is diagnosable and
      // "a shape we could not read" is not. The raw text is kept either way, above.
      return await fail('The audit came back in a shape we could not read. Nothing was recorded '
        + `for this agency; the answer itself is kept so it can be looked at. (${shapeWhy}.)`)
    }

    const shaped = isTemplate
      ? shapeTemplateFindings(obj, built.input, templateSection!, {
          runId: sec.run_id, sectionId, companyId: sec.company_id,
        }, { today: opts.today })
      : shapeFindings(obj, built.input, {
          runId: sec.run_id, sectionId, companyId: sec.company_id,
        }, { today: opts.today })
    const { rows, handleErrors, readIds, unreadIds, reshaped } = shaped
    // Only the agency shaper drops anything: a template line is always answered, even when the
    // answer is "we did not get one".
    const droppedUndated = 'droppedUndated' in shaped
      ? (shaped.droppedUndated as Array<{ title: string; recurs: boolean | null }>) : []
    const droppedWordless = 'droppedWordless' in shaped
      ? (shaped.droppedWordless as Array<{ title: string; kind: string }>) : []
    // Only the template shaper produces these; the agency one has no line refs to name.
    const mappedWords: Array<{ ref: string; from: string; to: string }> =
      'mappedWords' in shaped ? (shaped.mappedWords as Array<{ ref: string; from: string; to: string }>) : []
    if (mappedWords.length) {
      // Counted out loud: a normalisation nobody can see is a normalisation nobody can argue with.
      console.warn(`audit section ${sectionId}: ${mappedWords.length} word(s) were another `
        + `section's vocabulary for the same claim: `
        + mappedWords.map((m) => `${m.ref} ${m.from}→${m.to}`).join(', '))
    }

    if (rows.length) {
      const { error } = await db.from('audit_findings').insert(rows)
      if (error) {
        await db.from('audit_sections').update({
          model, prompt_sha256: promptSha, input_sha256: built.sha256, ai_call_id: aiCallId,
          raw_text: raw.slice(0, 20000), json_parsed: true, handles: built.input.handles,
        }).eq('id', sectionId)
        return await fail(`The audit was read but its rows would not save: ${error.message}`)
      }
    }

    // *** THE RESHAPED COUNT, ON THE RUN, SO IT SURVIVES THE REQUEST. ***
    // A rule enforced in code and reported nowhere is a rule nobody can tell is firing. There is no
    // column for it on a section, so it accumulates on the run's `summary` jsonb — read-modify-write,
    // which is safe because the sweep claims one company at a time and runs its sections one after
    // another (`app/api/jobs/audit-sections/route.ts`). `summariseRun` carries it forward.
    // A2, Job E: through `patchRunSummary`, which keeps every key it is not adding. The old shape
    // read `summary` without checking the error and spread `{}` on a failure — writing a summary
    // holding only these three keys and erasing the run's note, the extraction receipt and every
    // earlier section's counts. `lib/auditSummary.ts` says why it returns the failure instead of
    // throwing.
    {
      const r = await patchRunSummary(db, sec.run_id, { append: {
        reshaped_to_dates: reshaped, dropped_undated: droppedUndated, dropped_wordless: droppedWordless,
      } })
      if (!r.ok) {
        console.warn(`audit section ${sectionId}: the run's summary was left as it was — ${r.error.message}`)
      }
    }
    if (droppedUndated.length || droppedWordless.length) {
      // Said out loud as well as stored, the same as a mapped word: these are items the model
      // produced and the product refused, and refusing quietly is how the wordless-finding leak
      // survived five runs of the golden set.
      console.warn(`audit section ${sectionId}: dropped ${droppedUndated.length} date(s) with no day `
        + `and no claim to recur, ${droppedWordless.length} item(s) that would have landed with no word`)
    }

    // *** THE MATCHER CARRIES FORWARD NOW AND CLOSES LAST *** (A1 faults 3 and 4). A TEMPLATE run
    // is skipped entirely: a checklist answer has none of the matcher's four arrays, so every
    // previous finding would be unmatched by construction and a checklist re-run closed the lot.
    let unmatchedPrevious: string[] = []
    let onFilePrevious: Array<{ id: string; document: string | null }> = []
    if (previous.length && !isTemplate) {
      const m = await matchAgainstPrevious(db, sec, previous, obj)
      unmatchedPrevious = m.unmatched
      onFilePrevious = m.onFile
      // *** A WRONG-KIND LINK IS COUNTED IN THE RUN'S RECORD — D1.1. *** It is the model pointing
      // at a previous item of another kind, which is now ignored; before E10 it closed the real
      // match. Counted so the next Audits round can see whether the prompt change in D1.5 is
      // needed, rather than guessing.
      if (m.wrongKindLinks) {
        const r = await patchRunSummary(db, sec.run_id, { add: { wrong_kind_links: m.wrongKindLinks } })
        if (!r.ok) {
          console.warn(`audit section ${sectionId}: ${m.wrongKindLinks} wrong-kind link(s) were not `
            + `counted on the run — ${r.error.message}`)
        }
      }
    }
    // Per section, as its findings land: the handles only mean anything to the call shown them.
    const collapsedHere = raisedInRun.length
      ? await collapseAgainstEarlier(db, sec, raisedInRun, obj)
      : 0
    if (collapsedHere) {
      const r = await patchRunSummary(db, sec.run_id, { add: { collapsed_duplicates: collapsedHere } })
      if (!r.ok) {
        console.warn(`audit section ${sectionId}: ${collapsedHere} collapsed duplicate(s) were not `
          + `counted on the run — ${r.error.message}`)
      }
    }

    // *** O3 (fix list §4, Job E4): THE "DONE" WRITE IS CHECKED. ***
    // It was unchecked. A failure left the section saying **running** with its findings already
    // inserted and shown — so the stuck-row recovery picked it up fifteen minutes later, re-ran it,
    // and INSERTED A SECOND SET of the same findings. The report then showed every finding twice,
    // and the duplicate pass (`collapseAgainstEarlier`) cannot help: it collapses across sections,
    // not across two runs of one section. `fail(...)` instead, which marks the section
    // `could_not_complete` with a reason a person can read and offers Run again.
    const { error: doneErr } = await db.from('audit_sections').update({
      status: 'done', could_not_complete_reason: null,
      finished_at: new Date().toISOString(),
      model, prompt_sha256: promptSha, input_sha256: built.sha256, ai_call_id: aiCallId,
      raw_text: raw.slice(0, 20000), json_parsed: true,
      handles: built.input.handles,
      documents_read: readIds, documents_held_unread: unreadIds,
    }).eq('id', sectionId)
    if (doneErr) {
      return await fail(`The audit finished but its own row would not save: ${doneErr.message}`)
    }

    // *** AND ONLY NOW ARE THE PREVIOUS RUN'S UNCLAIMED FINDINGS CLOSED *** (A1 fault 4). Every
    // step that could throw has succeeded and the section is done, so nothing is closed by a
    // section that then failed. A failure here is reported and does not fail the section: the
    // findings stay open, which shows a person work that may already be done rather than closing
    // work that may not be, and the next run closes them.
    // D1.2 — the one close an audit may make: the newer audit raised it, said it is on file, and
    // cited the document. Named from the titles the input already carried, so no extra read.
    if (onFilePrevious.length) {
      const titleOf = (id: string) =>
        built.input.documents.find((d) => d.document_id === id)?.title ?? null
      const done = await closeOnEvidence(db, sec, onFilePrevious, titleOf)
      if (done.error) {
        console.warn(`audit section ${sectionId}: ${onFilePrevious.length} finding(s) now on file `
          + `are still open — ${done.error}`)
      }
    }
    // D1.3 — and the rest are MARKED, not closed. The finding stays open and the newer run's report
    // gathers it under "Not raised in this audit" with a Close it button.
    if (unmatchedPrevious.length) {
      const closed = await closeUnmatchedPrevious(db, sec, unmatchedPrevious)
      if (closed.error) {
        console.warn(`audit section ${sectionId}: ${unmatchedPrevious.length} finding(s) of the `
          + `previous run are not marked as unraised — ${closed.error}`)
      }
    }

    if (handleErrors.length) {
      console.warn(`audit section ${sectionId}: ${handleErrors.length} handle(s) the block did not `
        + `carry: ${handleErrors.slice(0, 5).join(', ')}`)
    }
    return { status: 'done', findings: rows.length, reshaped, droppedUndated, droppedWordless, mappedWords }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return await fail(`We could not finish this agency: ${message}`)
  }
}

/**
 * THE MODEL'S ANSWER, AS ROWS. Handles resolved here and nowhere else.
 *
 * A handle the block did not carry does NOT drop the finding: the row is written with a null
 * document and `handle_error` true. What the model named is evidence, and a silently discarded
 * finding is one nobody can count — which is exactly how a wrong id went unnoticed until Run 1c.
 */
export function shapeFindings(
  obj: Record<string, unknown>,
  input: AuditInput,
  ids: { runId: string; sectionId: string; companyId: string },
  opts: { today?: string } = {},
) {
  // *** TODAY, FROM THE INPUT THE MODEL WAS GIVEN. *** `input.today` is the date the block told it
  // to judge against, so the reshaping below uses the same one rather than the server's clock —
  // otherwise a run judged at 23:59 and shaped at 00:01 would apply two different todays.
  const today = opts.today ?? input.today ?? new Date().toISOString().slice(0, 10)
  const handles = input.handles
  const scanByDoc = new Map<string, string | null>()
  for (const d of input.documents) scanByDoc.set(d.document_id, d.scan_id ?? null)

  const handleErrors: string[] = []
  /** Findings turned into dates because they were not due yet. Reported and stored. */
  const reshaped: Array<{ title: string; due_on: string }> = []
  /**
   * *** WHAT WAS THROWN AWAY, AND WHY — Audits Run 6a, item 1. ***
   *
   * Counted and reported beside `reshaped_to_dates` for the same reason: a rule that fires silently
   * is a rule nobody can tell is firing. `dropped_undated` is a date item with no day that did not
   * claim to recur — "the permit expires", no date — which migration 060 still refuses and which
   * cannot honestly be given a day. `dropped_wordless` is anything else that would have landed as a
   * finding with no word at all, which is the leak the rev 1 baseline found: 23 rows in fifteen runs
   * that rendered as a title, a document and nothing else.
   */
  const droppedUndated: Array<{ title: string; recurs: boolean | null }> = []
  const droppedWordless: Array<{ title: string; kind: string }> = []
  const resolve = (h: unknown): { id: string | null; bad: boolean } => {
    if (h == null || h === '') return { id: null, bad: false }
    const id = handles[String(h).trim().toUpperCase()]
    if (id) return { id, bad: false }
    handleErrors.push(String(h).slice(0, 40))
    return { id: null, bad: true }
  }

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const rows: Array<Record<string, unknown>> = []
  let ordinal = 0

  for (const { field, kind } of KINDS) {
    const list = Array.isArray(obj[field]) ? (obj[field] as unknown[]) : []
    for (const raw of list) {
      // `not_document_questions` used to be a bare-string list; nothing returns one now, but a
      // string here is still shaped rather than dropped.
      const item = (typeof raw === 'string' ? { title: raw } : raw) as Record<string, unknown>
      if (!item || typeof item !== 'object') continue
      const title = str(item.title) ?? str(item.what)
      if (!title) continue

      const a = resolve(item.document ?? item.document_a)
      const b = resolve(item.document_b)

      // The CHECKs in 058 refuse a half-built row of any kind. Rather than let the insert fail and
      // lose the whole section, each kind is given what its shape requires or demoted to a plain
      // finding — but a demotion must not produce a row that says nothing, which is what it used to
      // do (see `droppedWordless` above and migration 060's WHY).
      let useKind: string = kind
      /**
       * *** A RECURRING OBLIGATION WITH NO DAY STAYS A DATE — Audits Run 6a, item 1. ***
       *
       * `{"title": "Annual permit fee (Condition 6.2)", "due_on": null, "recurs": true}` is what the
       * permit says: annual, and the day is on an invoice we have not been given. Migration 060
       * widened the CHECK by exactly this case, so the row goes in as a date with a null day and the
       * drawer says "recurs, no date in the reading". It used to be demoted to a finding, and a
       * `dates` item carries no `word`, so it landed wordless.
       *
       * A date with no day that does NOT claim to recur is a reading that did not finish. It is
       * dropped and counted — never given an invented day, and never turned into a finding that
       * asserts something is missing when all that is missing is the date.
       */
      if (kind === 'date' && !str(item.due_on)) {
        if (item.recurs === true) useKind = 'date'
        else { droppedUndated.push({ title: title.slice(0, 120),
                                     recurs: typeof item.recurs === 'boolean' ? item.recurs : null }); continue }
      }
      if (kind === 'contradiction' && !(b.id && str(item.value_a) && str(item.value_b))) useKind = 'finding'

      const nw = normaliseWord(item.word)
      let word = useKind === 'expected' ? 'nothing_on_file' : nw.word

      // *** A SUBMISSION NOT YET DUE IS A DATE, ENFORCED — Audits Run 4a, item 2. ***
      //
      // The prompt says it (`prompts/audit-agency.ts`) and the prompt is not enough: the first DEQ
      // runs wrote "Annual report for reporting year 2026 — nothing on file" against a report due
      // 15 February 2027, five months out. Nobody has failed to do something they still have five
      // months to do, and a page full of those buries the renewal that really is late.
      //
      // So a `nothing_on_file` finding carrying a due date in the future is written as a DATE. Not
      // dropped — the model saw something real and the date is the useful half of it. Counted, and
      // the count is reported, because a rule enforced in code silently is a rule nobody can tell
      // is firing.
      const due = str(item.due_on)
      if (useKind === 'finding' && word === 'nothing_on_file' && due && due > today) {
        useKind = 'date'
        word = null
        reshaped.push({ title: title.slice(0, 120), due_on: due })
      }

      /**
       * *** AND THE BACKSTOP: A FINDING IS NEVER WRITTEN WITHOUT A WORD. ***
       *
       * The two demotions above are the paths that were known to reach here wordless, and both are
       * handled. This catches the third one nobody has thought of yet — a `findings` item whose word
       * is a string `normaliseWord` does not recognise, a half-built contradiction, a future path.
       * The four words are the whole vocabulary of this screen; a row with none of them is not a
       * fifth state, it is a line a person cannot act on. Dropped and counted, never shown.
       *
       * It does NOT apply to a template line with no answer: `shapeTemplateFindings` writes that row
       * wordless on purpose, with "We did not get an answer for this line" in `what_to_do`, because
       * a checklist that silently loses a line is worse (§5.1). Wordless and saying so is a different
       * thing from wordless and saying nothing.
       */
      if (useKind === 'finding' && !word) {
        droppedWordless.push({ title: title.slice(0, 120), kind })
        continue
      }

      rows.push({
        run_id: ids.runId, section_id: ids.sectionId, company_id: ids.companyId,
        ordinal: ordinal++, kind: useKind, title: title.slice(0, 2000),
        word,
        basis: useKind === 'expected' ? 'expected'
          : (['read', 'inferred', 'expected'].includes(String(item.basis)) ? String(item.basis) : 'read'),
        document_id: a.id,
        scan_id: a.id ? (scanByDoc.get(a.id) ?? null) : null,
        locator: str(item.locator),
        quote: str(item.quote),
        what_to_do: str(item.what_to_do) ?? str(item.why),
        due_on: useKind === 'date' ? due : null,
        recurs: typeof item.recurs === 'boolean' ? item.recurs : null,
        passed: typeof item.passed === 'boolean' ? item.passed : null,
        document_b_id: useKind === 'contradiction' ? b.id : null,
        value_a: useKind === 'contradiction' ? str(item.value_a) : null,
        value_b: useKind === 'contradiction' ? str(item.value_b) : null,
        source: 'reading',
        same_as: null,
        handle_error: a.bad || b.bad,
        // `same_as` arrives as a handle and is resolved by the matcher, after the rows have ids.
        ...(str(item.same_as) ? { closed_reason: null } : {}),
      })
    }
  }

  // What the section actually read, as ids, off the block it was given — not off what the model
  // claimed, because `covers.documents_read` is the model's account of itself.
  const readIds = input.documents.map((d) => d.document_id)
  const unreadIds = input.other_documents.map((d) => d.document_id)
  return { rows, handleErrors, readIds, unreadIds, reshaped, droppedUndated, droppedWordless }
}

/**
 * *** A NEAR-MISS WORD IS NORMALISED, NARROWLY, AND COUNTED — Audits Run 4b. ***
 *
 * The first template run answered checklist line A1 with `"word": "expiring"` — Documents' status
 * vocabulary, not the audit's four — and the shaper correctly wrote null, so the report honestly
 * said "we did not get an answer for this line" about a line the model HAD answered: on file, with
 * the document, the locator and a quote. The honest report and the lost answer were both real.
 *
 * `expiring` and `expired` mean exactly what `stale` means here — the prompt's own definition is
 * "on file, and old enough or superseded enough that an inspector will ask" — so those two map, and
 * NOTHING ELSE DOES. A wider mapping would be this function deciding what the model meant; these
 * two are the same claim in another section's words. The prompt now says so as well, and every
 * mapping is counted so the report can say how often it happened.
 */
const NEAR_MISS: Record<string, string> = { expiring: 'stale', expired: 'stale' }
const WORDS = ['on_file', 'stale', 'nothing_on_file', 'not_a_document_question']

export function normaliseWord(raw: unknown): { word: string | null; mapped: string | null } {
  const w = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!w) return { word: null, mapped: null }
  if (WORDS.includes(w)) return { word: w, mapped: null }
  if (NEAR_MISS[w]) return { word: NEAR_MISS[w], mapped: w }
  return { word: null, mapped: null }
}

/**
 * ONE FINDING PER CHECKLIST LINE, IN THE CHECKLIST'S ORDER — Audits Run 4b, item 7.
 *
 * *** THE ORDER AND THE COUNT COME FROM THE CHECKLIST, NOT FROM THE ANSWER. ***
 * The lines are walked, and each one is matched to whatever the model returned for it. A line the
 * model skipped still gets a row — `could_not_answer`, said in words — because a checklist with
 * fourteen lines and thirteen answers is a report that silently lost a question, and the one it lost
 * is the one nobody will notice. A `ref` the model invented is dropped and counted.
 *
 * Everything else is `shapeFindings`' behaviour on purpose: the same four words, the same handle
 * resolution, the same not-yet-due reshaping. A template finding is a finding; what it adds is the
 * line it answers.
 */
export function shapeTemplateFindings(
  obj: Record<string, unknown>,
  input: AuditInput,
  section: TemplateSection,
  ids: { runId: string; sectionId: string; companyId: string },
  opts: { today?: string } = {},
) {
  const today = opts.today ?? input.today ?? new Date().toISOString().slice(0, 10)
  const handles = input.handles
  const scanByDoc = new Map<string, string | null>()
  for (const d of input.documents) scanByDoc.set(d.document_id, d.scan_id ?? null)

  const handleErrors: string[] = []
  const reshaped: Array<{ title: string; due_on: string }> = []
  /** Words that were another section's vocabulary for the same claim. Counted, never silent. */
  const mappedWords: Array<{ ref: string; from: string; to: string }> = []
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  /**
   * *** A REF THE MODEL WROTE AS THE WHOLE LINE IS STILL THAT LINE — Audits Run 4b. ***
   *
   * Case 13's run answered every line with `"ref": "1. Air permit posted in the front office and
   * not expired"` — the reference AND the text. An exact match found nothing, so all eight lines
   * were written as "we did not get an answer" while the model had answered all eight. The report
   * was honest and the answer was lost, which is the same shape of failure as the `expiring` word.
   *
   * So three attempts, narrowest first, and each is unambiguous:
   *   1. the ref exactly;
   *   2. the ref followed by a separator — "1." or "A2 " — which is the ref with the line stuck to it;
   *   3. the line's own text, when the model sent that instead.
   * Anything else is unmatched and counted. No fuzzy matching: a ref that merely CONTAINS "1"
   * would match line 11.
   */
  const rawLines = Array.isArray(obj.lines) ? (obj.lines as unknown[]) : []
  const given: Array<{ ref: string; item: Record<string, unknown> }> = []
  for (const a of rawLines) {
    if (!a || typeof a !== 'object') continue
    const ref = str((a as Record<string, unknown>).ref)
    if (ref) given.push({ ref, item: a as Record<string, unknown> })
  }

  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const answers = new Map<string, Record<string, unknown>>()
  const used = new Set<number>()
  for (const line of section.lines) {
    const want = line.ref.toUpperCase()
    let hit = given.findIndex((g, i) => !used.has(i) && g.ref.toUpperCase() === want)
    if (hit < 0) {
      hit = given.findIndex((g, i) => {
        if (used.has(i)) return false
        const up = g.ref.toUpperCase()
        return up.startsWith(want) && /[^A-Z0-9]/.test(up.slice(want.length, want.length + 1))
      })
    }
    if (hit < 0) hit = given.findIndex((g, i) => !used.has(i) && norm(g.ref) === norm(line.text))
    if (hit >= 0) { used.add(hit); answers.set(want, given[hit].item) }
  }
  // Refs the model returned that no line claimed. Counted with the handle errors, because both are
  // the model naming something it was not given.
  given.forEach((g, i) => { if (!used.has(i)) handleErrors.push(`line "${g.ref.slice(0, 40)}"`) })

  const rows: Array<Record<string, unknown>> = []
  let ordinal = 0

  for (const line of section.lines) {
    const a = answers.get(line.ref.toUpperCase())
    const base = {
      run_id: ids.runId, section_id: ids.sectionId, company_id: ids.companyId,
      ordinal: ordinal++, kind: 'finding',
      template_line: line.ref, template_text: line.text.slice(0, 1000),
      source: 'reading', same_as: null,
    }

    if (!a) {
      // *** A LINE WITH NO ANSWER IS A ROW SAYING SO. *** §5.1: when the failure is ours, say so
      // plainly. The alternative is a report that looks complete and is not.
      rows.push({
        ...base,
        title: line.text.slice(0, 2000),
        word: null, basis: 'read', document_id: null, scan_id: null,
        locator: null, quote: null,
        what_to_do: 'We did not get an answer for this line. Run this part of the audit again.',
        due_on: null, recurs: null, passed: null,
        document_b_id: null, value_a: null, value_b: null, handle_error: false,
      })
      continue
    }

    const h = a.document
    let docId: string | null = null
    let bad = false
    if (h != null && h !== '') {
      const id = handles[String(h).trim().toUpperCase()]
      if (id) docId = id
      else { bad = true; handleErrors.push(String(h).slice(0, 40)) }
    }

    const norm = normaliseWord(a.word)
    let word = norm.word
    if (norm.mapped) mappedWords.push({ ref: line.ref, from: norm.mapped, to: norm.word! })
    const due = str(a.due_on)
    let kind = 'finding'
    // The same rule as an agency audit: not yet due is a date, not a failure (Run 4a, item 2).
    if (word === 'nothing_on_file' && due && due > today) {
      kind = 'date'; word = null
      reshaped.push({ title: line.text.slice(0, 120), due_on: due })
    }

    rows.push({
      ...base, kind,
      title: line.text.slice(0, 2000),
      word,
      basis: ['read', 'inferred', 'expected'].includes(String(a.basis)) ? String(a.basis) : 'read',
      document_id: docId,
      scan_id: docId ? (scanByDoc.get(docId) ?? null) : null,
      locator: str(a.locator), quote: str(a.quote),
      what_to_do: str(a.what_to_do),
      due_on: kind === 'date' ? due : null,
      recurs: typeof a.recurs === 'boolean' ? a.recurs : null,
      passed: typeof a.passed === 'boolean' ? a.passed : null,
      document_b_id: null, value_a: null, value_b: null,
      handle_error: bad,
    })
  }

  return {
    rows, handleErrors, reshaped, mappedWords,
    readIds: input.documents.map((d) => d.document_id),
    unreadIds: input.other_documents.map((d) => d.document_id),
  }
}

// ---------------------------------------------------------------------------
// THE MATCHER
// ---------------------------------------------------------------------------

/** The previous run's still-open findings for this agency, as F1, F2 … */
async function previousOpenFindings(db: Db, companyId: string, previousRunId: string, agency: string):
  Promise<Array<{ id: string; shown: PreviousFinding }>> {
  const { data, error } = await db.from('audit_findings')
    .select('id, title, word, kind, ordinal, section_id')
    .eq('company_id', companyId).eq('run_id', previousRunId).eq('status', 'open')
    .order('ordinal')
  if (error) throw new Error(`previousOpenFindings: ${error.message}`)

  // Only the sections of the previous run that were about THIS agency: a DEQ section must not be
  // asked to match an OSHA finding.
  // Checked (E4): an empty list here means NONE of the previous run's findings belongs to this
  // agency, so the matcher is given nothing to carry — and A1's closing then has nothing to claim.
  // The read above already throws; this one decided which of its rows counted.
  const secs = mustRows<{ id: string; title: string }>("the previous audit's parts",
    await db.from('audit_sections')
      .select('id, title').eq('company_id', companyId).eq('run_id', previousRunId))
  const mine = new Set(secs.filter((s) => s.title === agency).map((s) => s.id))

  return (data ?? []).filter((f: { section_id: string }) => mine.has(f.section_id))
    .map((f: { id: string; title: string; word: string | null; kind: string }, i: number) => ({
      id: f.id,
      shown: { handle: `F${i + 1}`, title: f.title, word: f.word, kind: f.kind },
    }))
}

/**
 * CARRIED FORWARD — and NOTHING IS CLOSED HERE. `closeUnmatchedPrevious` does that, afterwards.
 *
 * *** MATCHED BY HANDLE, NEVER BY STRING EQUALITY. *** Two runs of the same model write the same
 * finding in different words — that is the whole reason Run 1c's keys had to stop naming one
 * model's phrasing. So the model is shown the previous findings as F1, F2 and asked which of its
 * own findings is the same one; code does the rest.
 *
 * *** REWRITTEN IN JOB E — fix list A1, severity 1, root R5. ***
 *
 * A previous finding nothing claimed is closed, and closing is a write a person cannot undo. Four
 * non-answers used to cause it, and the list found all four:
 *
 *   1. THE READ OF THE NEW ROWS WAS UNCHECKED. `const { data: fresh } = …` — a failed read gave an
 *      empty list, nothing could be matched, and **every open finding of the previous run was
 *      closed** as "not raised by the newer audit". Now `mustRows`, which throws, and the section
 *      fails instead.
 *   2. ROWS WERE MATCHED BY POSITION. `freshRows[i++]` walked the model's four lists against the
 *      rows in ordinal order — but `shapeFindings` DROPS items (an undated non-recurring date,
 *      anything that would land with no word), so one dropped item shifted every later answer onto
 *      the wrong row. `same_as` then said finding 7 was the same as a previous finding that
 *      belonged to finding 8, and the real one was closed. Matched by (kind, title) now, exactly as
 *      `collapseAgainstEarlier` already did it and for the same reason, which is written out there.
 *   3. A CHECKLIST RE-RUN CLOSED EVERYTHING. A template answer has none of these four arrays, so
 *      every previous finding was unmatched by construction. The caller now skips a template run,
 *      and this function closes nothing when the answer carried no list at all.
 *   4. CLOSING HAPPENED BEFORE THE REST OF THE SECTION. `collapseAgainstEarlier` and the section's
 *      own `done` write come after; a throw in either left findings closed by a section that then
 *      failed. The closing is now the last thing the section does.
 *
 * Closed findings are not deleted: "we were subject to this from March to January" is the history
 * the product exists to keep (§3.2, obligations are marked, never deleted), and the same applies to
 * a finding that was fixed.
 */
export async function matchAgainstPrevious(
  db: Db,
  sec: { id: string; run_id: string; company_id: string },
  previous: Array<{ id: string; shown: PreviousFinding }>,
  obj: Record<string, unknown>,
): Promise<{ carried: number; unmatched: string[]; wrongKindLinks: number
             onFile: Array<{ id: string; document: string | null }> }> {
  // The new rows. `mustRows`, not `data ?? []` (A1 fault 1): an empty list here means "no finding
  // claimed any of them", which used to close the lot.
  const freshRows = mustRows<{ id: string; ordinal: number; kind: string; title: string
                               word: string | null; document_id: string | null }>(
    "this audit's own findings",
    await db.from('audit_findings').select('id, ordinal, kind, title, word, document_id')
      .eq('section_id', sec.id).order('ordinal'))

  /**
   * *** THE KEY IS THE SAVED KIND AND THE PLAIN TITLE — D1.1 (E10). ***
   *
   * It was `${kind}\u0000${title}` where `kind` came from THE LIST THE ITEM WAS IN, and the title
   * was matched character for character. Both were wrong, and E9 item 3 measured what they cost:
   *
   *   · `shapeFindings` SAVES a row under a kind the list does not always predict — a
   *     `nothing_on_file` finding with a future due date is saved as a **date**, and a
   *     contradiction missing its second document is saved as a **finding**. So the lookup by the
   *     list's kind missed the row it had just written, the previous finding went unclaimed, and it
   *     was closed in a run that had raised it.
   *   · nothing checked that a `same_as` handle pointed at a row of the SAME kind, so a new
   *     `finding` could claim a previous `date` or `expected` — and then the real match for that
   *     previous finding was closed.
   *
   * Now: `normalise` ignores case, punctuation and spacing, because "Monthly visual inspections"
   * and "Monthly visual inspections." are the same item; and every lookup is by the kind the row
   * was SAVED as.
   */
  const byKindTitle = new Map<string, string>()
  const kindOfRow = new Map<string, string>()
  for (const r of freshRows) {
    kindOfRow.set(r.id, r.kind)
    const k = matchKey(r.kind, r.title)
    if (!byKindTitle.has(k)) byKindTitle.set(k, r.id)
  }
  const rowById = new Map(freshRows.map((r) => [r.id, r]))

  const claimed = new Set<string>()
  const linkedBy = new Map<string, string>()   // previous id -> the new row that claimed it
  let carried = 0
  let wrongKindLinks = 0
  /** Did the answer carry ANY of the four lists? (A1 fault 3.) */
  let sawAList = false

  const link = async (prevId: string, rowId: string) => {
    if (claimed.has(prevId) || linkedBy.has(prevId)) return
    await db.from('audit_findings').update({ same_as: prevId }).eq('id', rowId)
    claimed.add(prevId)
    linkedBy.set(prevId, rowId)
    carried++
  }

  /**
   * *** 1. THE PLAIN FACTS FIRST, WITHOUT ASKING THE MODEL — D1.1. ***
   *
   * The same saved kind and the same title is the same item, whatever the model said about it. This
   * is what makes a `[date]` and an `[expected]` carry at all: only the `findings` list has a
   * `same_as` field (`prompts/audit-agency.ts`), so before this every re-audit closed those two
   * kinds and raised them again — four open rows for two obligations, measured in E9 item 3b.
   */
  for (const p of previous) {
    const rowId = byKindTitle.get(matchKey(p.shown.kind, p.shown.title))
    if (rowId) await link(p.id, rowId)
  }

  /** 2. THEN THE MODEL'S OWN LINKS, HONOURED ONLY WHERE THE SAVED KINDS AGREE — D1.1. */
  const byHandle = new Map(previous.map((p) => [p.shown.handle.toUpperCase(), p]))
  for (const { field } of KINDS) {
    if (!Array.isArray(obj[field])) continue
    sawAList = true
    for (const raw of obj[field] as unknown[]) {
      const item = (typeof raw === 'string' ? { title: raw } : raw) as Record<string, unknown>
      const title = typeof item?.title === 'string' ? item.title : (item?.what as string)
      if (!title) continue
      const h = typeof item?.same_as === 'string' ? item.same_as.trim().toUpperCase() : ''
      const prev = h ? byHandle.get(h) : undefined
      if (!prev) continue
      // Already carried on the plain facts: the model's link agrees with it and there is nothing
      // to count. Checked first, so a redundant link is never reported as a wrong-kind one.
      if (claimed.has(prev.id)) continue
      /**
       * The row this item became, found by its title among the rows that were actually SAVED —
       * whatever kind they were saved as, because `shapeFindings` may have moved it.
       *
       * When two rows share a title (a `[finding]` and a `[date]` can both be "Permit expires"),
       * the one of the PREVIOUS row's kind is the match. Taking the first row by title instead
       * reported a perfectly good link as a wrong-kind one — found by `auditMatcher.test.ts`'s
       * existing case, which is why that test is kept.
       */
      const byTitle = freshRows.filter((r) => normalise(r.title) === normalise(title))
      const rowId = (byTitle.find((r) => r.kind === prev.shown.kind) ?? byTitle[0])?.id
      if (!rowId) continue
      const savedKind = kindOfRow.get(rowId)
      if (savedKind !== prev.shown.kind) {
        // *** A WRONG-KIND LINK IS IGNORED, AND COUNTED (D1.1). *** This is the one that closed a
        // finding the newer audit raised: run 2's `[finding]` claimed run 1's `[expected]` of a
        // similar name, and run 1's real `[finding]` was closed as "not raised".
        wrongKindLinks++
        continue
      }
      await link(prev.id, rowId)
    }
  }

  /**
   * *** 3. ONLY EVIDENCE CLOSES — D1.2. ***
   *
   * A carried item whose new row says it IS on file, citing a document, is the one case where the
   * newer audit has actually established something about the old finding. That closes it, with the
   * document named: "Now on file: <title>". Everything else stays open.
   */
  const onFile: Array<{ id: string; document: string | null }> = []
  for (const [prevId, rowId] of linkedBy) {
    const r = rowById.get(rowId)
    if (r?.word === 'on_file' && r.document_id) onFile.push({ id: prevId, document: r.document_id })
  }

  // *** AN ANSWER THAT CARRIED NO LIST AT ALL SAYS NOTHING ABOUT ANY OF THEM. *** (A1 fault 3.)
  // "The model said nothing about these" is not "none of these is still true" — it is an answer we
  // did not get, and §3.2's first rule applies: absence of evidence is not evidence of absence.
  // A plain-fact match above can carry an item even then, which is why `claimed` is subtracted.
  const unmatched = sawAList ? previous.filter((p) => !claimed.has(p.id)).map((p) => p.id) : []
  return { carried, unmatched, wrongKindLinks, onFile }
}

/**
 * Case, punctuation and spacing ignored — D1.1. "Monthly visual inspections." and
 * "Monthly  Visual Inspections" are the same item, and a re-audit that re-words its own punctuation
 * must not raise a second row for it.
 */
export function normalise(title: string): string {
  return String(title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 2000)
}

/** The match key: the kind a row was SAVED as, and its plain title. Never the list it came from. */
export function matchKey(kind: string, title: string): string {
  return `${kind}\u0000${normalise(title)}`
}

/**
 * THE CLOSING, ON ITS OWN, SO IT CAN BE LAST (A1 fault 4).
 *
 * Every fallible step of the section has succeeded by the time this runs. A failure here is
 * reported and does NOT fail the section: the previous findings simply stay open, which shows a
 * person work that may already be done rather than closing work that may not be, and the next run
 * closes them.
 */
export async function closeUnmatchedPrevious(
  db: Db, sec: { run_id: string }, unmatched: string[],
): Promise<{ closed: number; error: string | null }> {
  if (!unmatched.length) return { closed: 0, error: null }
  /**
   * *** THIS NO LONGER CLOSES ANYTHING — the owner's decision D1.3, 12 October 2026. ***
   *
   * It used to write `status: 'closed', closed_reason: 'not raised by the newer audit'`. E9 item 3
   * measured what that cost on two real runs of one agency: 3 previous findings closed, **none of
   * them because the title was worded differently**, and one of them closed in a run that had
   * raised that exact title. A close is a claim to a customer — "we checked, and this is no longer
   * raised" — it goes in the email, and a person cannot undo it.
   *
   * **Silence never closes.** The finding STAYS OPEN and is pointed at the run that went quiet
   * about it (migration 082), which is what gathers it under "Not raised in this audit" on that
   * run's report with a "Close it" button. The name is kept so every caller and every test reads
   * as before; what it does is marked, not closed.
   */
  const { data, error } = await db.from('audit_findings').update({
    not_raised_by_run_id: sec.run_id,
  }).in('id', unmatched).eq('status', 'open').select('id')
  if (error) return { closed: 0, error: error.message }
  return { closed: (data ?? []).length, error: null }
}

/** The one close an audit may still make, and the words on it (D1.2). */
export const nowOnFile = (title: string | null) => `Now on file: ${title ?? 'a document you have given us'}`

/**
 * *** ONLY EVIDENCE CLOSES — the owner's decision D1.2. ***
 *
 * The newer audit raised the same item, said it is on file, and cited the document. That is the one
 * thing an audit can establish about an old finding on its own, so that is the one close it makes,
 * with the document named. Like the marking above, a failure here is reported and does not fail the
 * section: the finding stays open, which shows a person work that may already be done rather than
 * closing work that may not be.
 */
export async function closeOnEvidence(
  db: Db, sec: { run_id: string }, onFile: Array<{ id: string; document: string | null }>,
  titleOf: (documentId: string) => string | null,
): Promise<{ closed: number; error: string | null }> {
  if (!onFile.length) return { closed: 0, error: null }
  let closed = 0
  for (const item of onFile) {
    const { data, error } = await db.from('audit_findings').update({
      status: 'closed', closed_by_run_id: sec.run_id, closed_at: new Date().toISOString(),
      closed_reason: nowOnFile(item.document ? titleOf(item.document) : null),
    }).eq('id', item.id).eq('status', 'open').select('id')
    if (error) return { closed, error: error.message }
    closed += (data ?? []).length
  }
  return { closed, error: null }
}

// ---------------------------------------------------------------------------
// FINISH
// ---------------------------------------------------------------------------

/**
 * *** THE CLAIM COMES BEFORE THE EMAIL. *** `.neq('status','done')` on the update is what makes
 * "finished" a compare-and-set, exactly as `finishBatchIfDone` does it: two sections landing in the
 * same second both see done_count === section_count, and without this both would send an email.
 * The row that loses the race gets 0 rows back and returns null.
 */
export async function finishRunIfDone(db: Db, runId: string):
  Promise<{ finished: boolean; summary: RunSummary | null }> {
  const { data: secs, error } = await db.from('audit_sections')
    .select('id, status, title, finished_at').eq('run_id', runId)
  if (error) throw new Error(`finishRunIfDone: ${error.message}`)
  const sections = secs ?? []
  const settled = sections.filter((s: { status: string }) => s.status === 'done' || s.status === 'could_not_complete')
  const done = sections.filter((s: { status: string }) => s.status === 'done')

  await db.from('audit_runs').update({ done_count: done.length }).eq('id', runId)
  if (!sections.length || settled.length < sections.length) return { finished: false, summary: null }

  /**
   * *** THE COLLAPSE NO LONGER HAPPENS HERE — Audits Run 8a, item 4. ***
   * Run 7b collapsed at the end of the run by comparing titles in code, and on Cascade's
   * four-agency re-run that caught nothing. It is the model's own `same_as_in_run` answer now,
   * resolved by `collapseAgainstEarlier` as each section lands — so by the time a run finishes the
   * duplicates are already closed and already out of the summary's counts. What is left here is to
   * read the running total each section added.
   */
  const summary = await summariseRun(db, runId)
  // A2, Job E: checked. This write REPLACES the summary with `summariseRun`'s result plus this
  // count, so a failed read here would not merely under-report the collapse — it would store a run
  // whose collapse count says 0 when sections closed duplicates, for good, because nothing
  // recomputes it. `mustRow` throws, the run stays unfinished, and the recovery re-runs it.
  const runNow = mustRow<{ summary: Record<string, unknown> | null }>("the audit run's summary",
    await db.from('audit_runs').select('summary').eq('id', runId).maybeSingle())
  const collapsed = Number((runNow?.summary ?? {}).collapsed_duplicates) || 0
  // Carried forward for the same reason, and added by the same `patchRunSummary` call: a link the
  // model made to a previous item of ANOTHER KIND, ignored and counted (D1.1). Nothing recomputes
  // it, so a key this write leaves out is a key that disappears when the run finishes.
  const wrongKind = Number((runNow?.summary ?? {}).wrong_kind_links) || 0

  // How fresh the evidence was: the newest reading any section was shown. Read from the scans of
  // the documents the sections recorded, not from the run's own clock — the run's date says when we
  // looked, and this says how old what we looked at was.
  const readIds = await sectionDocumentIds(db, runId)
  let readingsAsOf: string | null = null
  if (readIds.length) {
    // THE READING THAT COULD READ IT (§185a, A3e). `is_current` would date this audit to a reading
    // that read nothing — "your documents as they stood on <today>" when today's attempt failed is a
    // sentence that is simply untrue, and it is printed at the top of the report and in the email.
    // Checked (E4): with no company the readable readings are not looked up at all, so
    // `readings_as_of` lands null and the report and the email drop "your documents as they stood
    // on <date>" — a missing sentence on a record somebody files.
    const runCo = mustRow<{ company_id: string }>('this audit', await db.from('audit_runs')
      .select('company_id').eq('id', runId).maybeSingle())
    const readableIds = runCo?.company_id
      ? await readableScanIds(db, runCo.company_id as string, readIds) : []
    const { data: newest } = readableIds.length
      ? await db.from('document_scans')
          .select('scanned_at').in('id', readableIds)
          .order('scanned_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null }
    readingsAsOf = newest?.scanned_at ?? null
  }

  const { data: claimed, error: cErr } = await db.from('audit_runs').update({
    status: 'done', finished_at: new Date().toISOString(),
    done_count: done.length, readings_as_of: readingsAsOf,
    // The collapse count travels on the summary, beside the other things a rule did quietly.
    summary: { ...summary, collapsed_duplicates: collapsed, wrong_kind_links: wrongKind },
  }).eq('id', runId).neq('status', 'done').select('id')
  if (cErr) throw new Error(`finishRunIfDone: claiming done: ${cErr.message}`)
  if (!claimed?.length) return { finished: false, summary: null }

  return { finished: true, summary: { ...summary, collapsed_duplicates: collapsed, wrong_kind_links: wrongKind } }
}

/** Every document any section of this run recorded as read, deduplicated. */
async function sectionDocumentIds(db: Db, runId: string): Promise<string[]> {
  // Checked (E4): this feeds `readings_as_of`, which the report and the email print as "your
  // documents as they stood on <date>". A failed read made that date null, which the frame then
  // leaves out — a missing sentence rather than a wrong one, but the run is marked done either way
  // and nothing would ever put it back.
  const { data, error } = await db.from('audit_sections').select('documents_read').eq('run_id', runId)
  if (error) throw new Error(`sectionDocumentIds: ${error.message}`)
  const rows = (data ?? []) as Array<{ documents_read: string[] | null }>
  return [...new Set(rows.flatMap((s) => s.documents_read ?? []))]
}

/**
 * WHAT THE EARLIER SECTIONS OF THIS RUN ALREADY RAISED, BY HANDLE — Audits Run 8a, item 4.
 *
 * The same shape as `previousOpenFindings`, over sections of the SAME run with a lower ordinal.
 * Only open plain findings: a date is matched by its date, a contradiction by its two sides, and an
 * expected item is a suggestion rather than a claim — none of the three has been asked for.
 */
async function raisedEarlierInRun(db: Db, runId: string, sectionId: string):
  Promise<Array<{ id: string; sectionId: string; shown: PreviousFinding }>> {
  const { data: secs, error: sErr } = await db.from('audit_sections')
    .select('id, ordinal, title').eq('run_id', runId).order('ordinal')
  if (sErr) throw new Error(`raisedEarlierInRun: ${sErr.message}`)
  const all = (secs ?? []) as Array<{ id: string; ordinal: number; title: string }>
  const here = all.find((x) => x.id === sectionId)
  if (!here) return []
  const earlier = all.filter((x) => x.ordinal < here.ordinal).map((x) => x.id)
  if (!earlier.length) return []

  const { data, error } = await db.from('audit_findings')
    .select('id, title, word, kind, ordinal, section_id')
    .eq('run_id', runId).eq('kind', 'finding').eq('status', 'open')
    .in('section_id', earlier).order('ordinal')
  if (error) throw new Error(`raisedEarlierInRun: ${error.message}`)

  return ((data ?? []) as Array<{ id: string; title: string; word: string | null; kind: string;
                                 section_id: string }>)
    .map((f, i) => ({
      id: f.id, sectionId: f.section_id,
      shown: { handle: `R${i + 1}`, title: f.title, word: f.word, kind: f.kind },
    }))
}

/**
 * THE SAME FINDING FROM TWO AGENCIES, COLLAPSED BY THE MODEL'S OWN ANSWER — Audits Run 8a, item 4.
 *
 * *** WHAT THIS REPLACES, AND WHY. *** Run 7b collapsed in code: same document, same locator, and
 * titles sharing half their significant words. On Cascade's four-agency re-run that collapsed
 * **nothing** — of 39 findings carrying a document there was exactly one cross-section pair sharing
 * a document and locator, and its titles shared **0 of 3** significant words:
 *
 *     [U.S. OSHA]    "No proof of electronic submission of 2025 300A"
 *     [Oregon OSHA]  "OSHA 300A summary may not have been electronic"
 *
 * A person reads those as one thing. No word-overlap threshold reaches them without also collapsing
 * findings that are genuinely different, and the row a collapse closes is the row nobody reads
 * again — so a wrong collapse costs more than a missed one. The judgement goes to the thing that can
 * read: the model is shown the earlier sections' findings as R1, R2 and answers `same_as_in_run`.
 * That is the lesson Run 1c's keys already learned about matching one model's phrasing, applied to
 * the last place still doing it.
 *
 * WHAT IT DOES WITH THE ANSWER is exactly what Run 7b did, unchanged: the earlier finding **keeps**
 * the row and gains this section in `also_in_sections`; this section's duplicate is closed with a
 * reason naming the row it duplicates and is **never deleted**. The drawer then shows it once under
 * each agency with "also under <agency>".
 *
 * A handle the model invents is ignored and counted out loud, the same way an invented document
 * handle is: `R9` against a list of three is checkable, which is the whole reason handles are used.
 */
async function collapseAgainstEarlier(
  db: Db,
  sec: { id: string; run_id: string; company_id: string },
  raised: Array<{ id: string; sectionId: string; shown: PreviousFinding }>,
  answer: Record<string, unknown>,
): Promise<number> {
  const items = Array.isArray(answer.findings) ? (answer.findings as unknown[]) : []
  if (!items.length) return 0

  const byHandle = new Map(raised.map((r) => [r.shown.handle.toUpperCase(), r]))
  const { data: rows, error } = await db.from('audit_findings')
    .select('id, ordinal, title').eq('section_id', sec.id).eq('kind', 'finding').order('ordinal')
  if (error) throw new Error(`collapseAgainstEarlier: ${error.message}`)
  const mine = (rows ?? []) as Array<{ id: string; ordinal: number; title: string }>

  /**
   * *** THE MODEL'S LIST AND THE ROWS ARE NOT THE SAME LENGTH, AND THAT IS NOT A BUG. ***
   * `shapeFindings` drops an undated non-recurring date and anything that would land without a word
   * (Run 6a, item 1), so indexing one list by the other's position would attach an answer to the
   * wrong row. The rows are matched back by TITLE, which `shapeFindings` copies through unchanged
   * apart from a 2000-character cap.
   */
  const rowByTitle = new Map<string, string>()
  for (const r of mine) rowByTitle.set(String(r.title).slice(0, 2000), r.id)

  const closures: Array<{ id: string; keeper: string }> = []
  const badHandles: string[] = []
  for (const raw of items) {
    const item = raw as Record<string, unknown>
    const h = typeof item?.same_as_in_run === 'string' ? item.same_as_in_run.trim().toUpperCase() : ''
    if (!h) continue
    const hit = byHandle.get(h)
    if (!hit) { badHandles.push(h.slice(0, 20)); continue }
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 2000) : ''
    const rowId = rowByTitle.get(title)
    if (!rowId) continue
    // A section cannot collapse into itself.
    if (hit.sectionId === sec.id) continue
    closures.push({ id: rowId, keeper: hit.id })
  }
  if (badHandles.length) {
    console.warn(`audit section ${sec.id}: ${badHandles.length} same_as_in_run handle(s) the block `
      + `did not carry: ${[...new Set(badHandles)].slice(0, 5).join(', ')}`)
  }
  if (!closures.length) return 0

  // The keeper gains this section. Read-modify-write is safe because the sweep runs one company's
  // sections strictly one after another.
  for (const keeperId of [...new Set(closures.map((c) => c.keeper))]) {
    const { data: cur, error: rErr } = await db.from('audit_findings')
      .select('also_in_sections').eq('id', keeperId).maybeSingle()
    if (rErr) throw new Error(`collapseAgainstEarlier: reading the keeper: ${rErr.message}`)
    const have = new Set((cur?.also_in_sections ?? []) as string[])
    have.add(sec.id)
    const { error: uErr } = await db.from('audit_findings')
      .update({ also_in_sections: [...have] }).eq('id', keeperId)
    if (uErr) throw new Error(`collapseAgainstEarlier: carrying the section: ${uErr.message}`)
  }
  for (const c of closures) {
    const { error: cErr } = await db.from('audit_findings').update({
      status: 'closed',
      closed_reason: `same as ${c.keeper} from another section`,
      closed_by_run_id: sec.run_id,
    }).eq('id', c.id)
    if (cErr) throw new Error(`collapseAgainstEarlier: closing a duplicate: ${cErr.message}`)
  }
  console.warn(`audit section ${sec.id}: collapsed ${closures.length} finding(s) the model said an `
    + `earlier agency of this run had already raised`)
  return closures.length
}
/**
 * THE SUMMARY, AND IT HAS NOTHING OF ITS OWN. Every number is a count of `audit_findings` rows and
 * every line in `attention` is one of them — the same rule `summariseBatch` follows, and the reason
 * the banner and the email cannot disagree.
 */
export async function summariseRun(db: Db, runId: string): Promise<RunSummary> {
  const [findingsRes, sectionsRes, runRes] = await Promise.all([
    db.from('audit_findings').select('title, kind, word, status, passed, document_id, same_as')
      .eq('run_id', runId).order('ordinal'),
    db.from('audit_sections').select('title, status').eq('run_id', runId).order('ordinal'),
    db.from('audit_runs').select('previous_run_id, summary').eq('id', runId).maybeSingle(),
  ])
  // *** A8: AN ALL-ZERO SUMMARY, STORED FOR GOOD, AND EMAILED AS "NOTHING NEEDS YOU." ***
  // (root R2, Job E4.) Both of these were `{ data: … }` with no error. A failed FINDINGS read gave
  // every count 0 and an empty `attention` list; `finishRunIfDone` then WROTE that over the run's
  // summary — nothing recomputes it — and `notifyRun` emailed the result. A failed SECTIONS read
  // gave `sections: 0, sections_done: 0, could_not_complete: 0`, which is A9's subject reading
  // "nothing needs you" from a different direction. `mustRows` throws, the run stays unfinished,
  // and the recovery re-runs it.
  const rows = mustRows<Record<string, unknown>>("this audit's findings", findingsRes)
  const secs = mustRows<{ title: string; status: string }>("this audit's parts", sectionsRes)
  // *** A2, Job E: THIS READ IS THE ONE THAT CARRIES THE RUN'S OWN WORDS FORWARD. ***
  // The note ("this checklist names somebody else"), the extraction's receipt, and the lists of
  // words a rule reshaped or refused exist nowhere else — see the four `run?.summary` reads at the
  // bottom of this function. The result of this call is then WRITTEN BACK over `summary` by
  // `finishRunIfDone`, so a failure here does not lose a read: it erases the run's note and receipt
  // permanently. `mustRow` throws, the run stays unfinished, and nothing is overwritten.
  //
  // `rows` and `secs` are fix-list item A8 and are checked in E4, with their own proof — a failed
  // findings read stores an all-zero summary and emails "nothing needs you", which is a different
  // failure needing a different sentence.
  const run = mustRow<{ previous_run_id: string | null; summary: Record<string, unknown> | null }>(
    "the audit run's summary", runRes)
  const f = rows ?? []
  const sections = secs ?? []

  const titleById = new Map<string, string>()
  const docIds = [...new Set(f.map((r) => r.document_id as string | null).filter(Boolean))]
  if (docIds.length) {
    // Checked (E4): a failed read here leaves `attention`'s rows with `document: null`, so the
    // email and the report name a finding with no document beside it — "we found this somewhere".
    const docs = mustRows<{ document_id: string; title: string | null; file_name: string | null }>(
      'the titles of your documents', await db.from('document_index_v')
        .select('document_id, title, file_name').in('document_id', docIds))
    for (const d of docs) titleById.set(d.document_id, (d.title || d.file_name) ?? '')
  }

  const count = (p: (r: Record<string, unknown>) => boolean) => f.filter(p).length
  /**
   * *** "CLOSED" IS A PREVIOUS RUN'S FINDINGS, NEVER THIS RUN'S OWN DUPLICATES — E10, N3. ***
   *
   * `.neq('run_id', runId)` is the whole fix. `collapseAgainstEarlier` marks an in-run duplicate
   * with `closed_by_run_id = this run` — two sections of one audit raised the same thing and one was
   * merged into the other — and that row was being counted as a previous finding this run had
   * closed. O1 now links every agency re-audit, so this number prints in the email, the drawer and
   * Past audits: "1 of 7 from 9 October closed" could be one of this run's own merges.
   *
   * And the count is CHECKED (`mustCount`, which also refuses a null count with no error): it is a
   * number shown to a customer about work they may think is finished.
   *
   * `not_raised` is the group D1.3 created: previous findings this run went quiet about. They are
   * still OPEN and a person closes them — so they are counted apart from `closed`, and the two are
   * never added together.
   */
  let closed = 0
  let notRaised = 0
  if (run?.previous_run_id) {
    closed = mustCount('how many of your earlier findings this audit closed', await db
      .from('audit_findings').select('id', { count: 'exact', head: true })
      .eq('closed_by_run_id', runId).neq('run_id', runId))
    notRaised = mustCount('how many of your earlier findings this audit did not raise', await db
      .from('audit_findings').select('id', { count: 'exact', head: true })
      .eq('not_raised_by_run_id', runId).eq('status', 'open'))
  }

  const nothingOnFile = count((r) => r.word === 'nothing_on_file' && r.kind !== 'expected')
  const stale = count((r) => r.word === 'stale')
  const contradictions = count((r) => r.kind === 'contradiction')
  const notADocument = count((r) => r.word === 'not_a_document_question')

  return {
    total: f.length,
    needs_person: nothingOnFile + stale + contradictions + notADocument,
    nothing_on_file: nothingOnFile,
    stale,
    on_file: count((r) => r.word === 'on_file'),
    not_a_document_question: notADocument,
    contradictions,
    dates_passed: count((r) => r.kind === 'date' && r.passed === true),
    expected: count((r) => r.kind === 'expected'),
    sections: sections.length,
    sections_done: sections.filter((s: { status: string }) => s.status === 'done').length,
    could_not_complete: sections.filter((s: { status: string }) => s.status === 'could_not_complete').length,
    // *** DISTINCT PREVIOUS FINDINGS, NOT LINKS — ruled 30 September, Run 3 item 1. ***
    // The matcher reported "carried 30" against a previous run holding 29 open findings, because
    // one previous finding was claimed by two new ones: the audit split it. Counting links made
    // the number exceed what it was counting out of, which is not a number anybody can read.
    // It counts the previous findings still being raised.
    carried: new Set(f.map((r: Record<string, unknown>) => r.same_as).filter(Boolean)).size,
    closed,
    not_raised: notRaised,
    // What an inspector would ask about first: nothing on file, and stale. Not the expected items,
    // which are a suggestion and say so.
    attention: f.filter((r: Record<string, unknown>) =>
        r.kind !== 'expected' && (r.word === 'nothing_on_file' || r.word === 'stale'))
      .slice(0, 25)
      .map((r: Record<string, unknown>) => ({
        title: String(r.title), word: (r.word as string) ?? null,
        document: r.document_id ? (titleById.get(r.document_id as string) ?? null) : null,
      })),
    agencies: sections.map((s: { title: string }) => s.title),
    // Carried forward from what the sections recorded, never recomputed: a reshaped row is a date
    // row by the time it is in the table and is indistinguishable from a date the model wrote.
    reshaped_to_dates: (((run?.summary ?? {}) as Record<string, unknown>).reshaped_to_dates
      ?? []) as Array<{ title: string; due_on: string }>,
    // Carried the same way, and for the same reason: once an item is dropped there is no row to
    // count it from, so the only record of it is the one the section wrote.
    dropped_undated: (((run?.summary ?? {}) as Record<string, unknown>).dropped_undated
      ?? []) as Array<{ title: string; recurs: boolean | null }>,
    dropped_wordless: (((run?.summary ?? {}) as Record<string, unknown>).dropped_wordless
      ?? []) as Array<{ title: string; kind: string }>,
    // A note put on the run before it ran — "this checklist names somebody else" — is carried
    // forward rather than overwritten when the run is summarised at the end.
    note: (((run?.summary ?? {}) as Record<string, unknown>).note as string | null) ?? null,
    // And the extraction's receipt, for the same reason: it is written before the first section
    // runs, and summarising at the end would drop it.
    extraction_ai_call_id: (((run?.summary ?? {}) as Record<string, unknown>)
      .extraction_ai_call_id as string | null) ?? null,
    // A9: and how many parts were re-run, for the same reason — this write replaces the summary, so
    // a key nobody carries forward is a key that disappears when the run finishes.
    retried_parts: Number(((run?.summary ?? {}) as Record<string, unknown>).retried_parts) || 0,
    // E10 §4: and whether an email had actually gone before the retry cleared `notified_at`, which
    // is what decides whether the second one may say it replaces the first.
    emailed_before: Boolean(((run?.summary ?? {}) as Record<string, unknown>).emailed_before),
  }
}

/** One sentence, for the banner and the email subject. The same rule as `summaryLine`. */
export function runSummaryLine(s: RunSummary): string {
  // *** A NOTE IS THE WHOLE ANSWER ONLY WHEN THERE WAS NOTHING TO AUDIT — E10, N4. *** It used to
  // return the note for any run carrying one, which swallowed the counts of every checklist audit
  // that named somebody else and finished normally. When there were sections, the note is extra
  // context and is said AFTER the result (below), not instead of it.
  if (s.note && s.sections === 0) return s.note
  const who = s.agencies.length === 1 ? `${s.agencies[0]} audit`
    : `compliance audit across ${s.agencies.length} agencies`
  /**
   * *** THE SAME SENTENCE SHAPES AS THE PAGE — Audits Run 7b, item 7. ***
   *
   * The Audits page says "found 4 things with nothing on file, 1 disagreement between documents,
   * and 2 things on file." The email said "4 with nothing on file, 1 disagreements between
   * documents" — the same numbers, shorter, and with the plural wrong at one. A person who reads
   * the email and then opens the page should recognise the second from the first, so the clauses are
   * written once in the same shape and joined the same way.
   *
   * **Every plural is per clause and right at one**, which is the whole reason these are expressions
   * and not one template string.
   */
  const bits: string[] = []
  if (s.nothing_on_file) bits.push(`${s.nothing_on_file} thing${s.nothing_on_file === 1 ? '' : 's'} with nothing on file`)
  if (s.stale) bits.push(`${s.stale} thing${s.stale === 1 ? '' : 's'} out of date`)
  if (s.contradictions) bits.push(`${s.contradictions} disagreement${s.contradictions === 1 ? '' : 's'} between documents`)
  if (s.not_a_document_question) bits.push(`${s.not_a_document_question} thing${s.not_a_document_question === 1 ? '' : 's'} no document can answer`)
  const head = s.needs_person
    ? `Your ${who} found ${s.needs_person} thing${s.needs_person === 1 ? '' : 's'} that need${s.needs_person === 1 ? 's' : ''} you`
    : `Your ${who} found nothing that needs you`
  /** "a, b, and c" — the same join the page uses, so the two read alike. */
  const joined = bits.length <= 1 ? bits.join('')
    : bits.length === 2 ? `${bits[0]} and ${bits[1]}`
    : `${bits.slice(0, -1).join(', ')}, and ${bits[bits.length - 1]}`
  const tail = bits.length ? `: ${joined}.` : '.'
  const failed = s.could_not_complete
    ? ` ${s.could_not_complete} of ${s.sections} section${s.sections === 1 ? '' : 's'} could not be finished.`
    : ''
  // The note last, as its own sentence: "This checklist names <X>; treated as a template for you."
  // is worth saying and is not a result (E10, N4).
  const note = s.note ? ` ${s.note}` : ''
  return head + tail + failed + note
}

/**
 * WHAT A SECTION COST, SUMMED FROM THE LEDGER OVER ITS OWN TIME WINDOW — Run 3b, item 4.
 *
 * *** `ai_call_id` IS THE FIRST CALL, NOT THE ONLY ONE. *** A section in sections mode makes four
 * model calls and records one id, so every cost the page showed for one was a quarter of the truth:
 * the golden sections run billed $0.1535 and Past audits read $0.0000 for it, because the run file
 * carried the cost and the row carried one call's id — and the page reads rows.
 *
 * So the number is summed rather than looked up: every `ai_calls` row for this company with task
 * `audit` between the section's `started_at` and `finished_at`. The id stays on the row as the
 * pointer to the first call, which is what makes one call's tokens and searches findable.
 *
 * *** THE WINDOWS MUST NOT OVERLAP, AND THEY DO NOT. *** The sweep claims one company at a time and
 * runs its sections one after another (`app/api/jobs/audit-sections/route.ts`), so two sections of
 * one company are never in flight together and no call is counted twice. If that ever changes, this
 * double-counts — which is why it is one function and not three copies.
 */
export async function costOfSections(
  db: Db, companyId: string,
  sections: Array<{ started_at: string | null; finished_at: string | null }>,
  /**
   * *** THE CHECKLIST READING IS PART OF WHAT A TEMPLATE AUDIT COST — Audits Run 6a, item 3. ***
   *
   * `run.started_at` is now stamped BEFORE the extraction call (see `createRun`), so passing it adds
   * one more window — from the run opening to its first section starting — which contains that call
   * and nothing else. `extractionCallId`, off `run.summary`, names the same row exactly; it is used
   * in preference, and the window is the fallback for a run whose ledger poll came back empty.
   *
   * Both are optional and an agency run passes neither, so its figure does not move.
   */
  run?: { started_at?: string | null; extractionCallId?: string | null } | null,
): Promise<number> {
  const windows = sections.filter((s) => s.started_at && s.finished_at)
    .map((s) => ({ from: s.started_at as string, to: s.finished_at as string }))
  const firstStart = windows.map((w) => w.from).sort()[0] ?? null
  // The run opened, then the checklist was read, then the first section started. Only added when
  // there IS a first section — without one there is no end to the window.
  if (run?.started_at && firstStart && run.started_at < firstStart) {
    windows.push({ from: run.started_at, to: firstStart })
  }
  if (!windows.length && !run?.extractionCallId) return 0

  const from = windows.map((w) => w.from).sort()[0]
  const to = windows.map((w) => w.to).sort().slice(-1)[0]

  let total = 0
  const counted = new Set<string>()

  // The named row first, by id, so the figure does not depend on a clock.
  if (run?.extractionCallId) {
    const { data, error } = await db.from('ai_calls')
      .select('id, cost_usd').eq('id', run.extractionCallId).eq('company_id', companyId).maybeSingle()
    if (error) throw new Error(`costOfSections (extraction): ${error.message}`)
    const row = data as { id: string; cost_usd: number | null } | null
    if (row) { total += Number(row.cost_usd ?? 0); counted.add(row.id) }
  }

  if (windows.length) {
    const { data, error } = await db.from('ai_calls')
      .select('id, cost_usd, created_at').eq('company_id', companyId).eq('task', 'audit')
      .gte('created_at', from).lte('created_at', to)
    if (error) throw new Error(`costOfSections: ${error.message}`)

    const rows = (data ?? []) as Array<{ id: string; cost_usd: number | null; created_at: string }>
    for (const r of rows) {
      // Inside ONE of the windows, not merely inside the outer span: a run whose sections were
      // separated by an hour must not pick up an unrelated audit that happened in the gap.
      // And never twice: the extraction row is inside the run's own window as well as named by id.
      if (counted.has(r.id)) continue
      if (windows.some((w) => r.created_at >= w.from && r.created_at <= w.to)) {
        total += Number(r.cost_usd ?? 0)
        counted.add(r.id)
      }
    }
  }
  return total
}
