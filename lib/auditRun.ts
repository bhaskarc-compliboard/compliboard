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

import { askAIWithCitations, extractJsonText, modelForTask } from './ai.ts'
import { buildAuditInput, auditAgenciesFor, type AuditInput } from './audit.ts'
import { auditAgencyPrompt, auditTemplatePrompt, type PreviousFinding } from '../prompts/audit-agency.ts'
import { countLines, type TemplateSection, type ExtractedTemplate } from './auditTemplate.ts'

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
  closed: number
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
    const { data: runRow } = await db.from('audit_runs')
      .select('kind, template_lines, previous_run_id, template_document_id').eq('id', sec.run_id).maybeSingle()
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
    let obj: Record<string, unknown> | null = null
    try { obj = JSON.parse(extractJsonText(raw)) as Record<string, unknown> } catch { obj = null }

    // The ledger row, found by time and polled, because `recordAICall` is deliberately not awaited
    // (`lib/documentScan.ts` says the same in more words). A missing link loses the receipt, never
    // the answer.
    let aiCallId: string | null = null
    for (let i = 0; i < 5 && !aiCallId; i++) {
      if (i) await new Promise((r) => setTimeout(r, 250))
      const { data: call } = await db.from('ai_calls')
        .select('id').eq('company_id', sec.company_id).eq('task', 'audit')
        .gte('created_at', startedAt).order('created_at', { ascending: false }).limit(1).maybeSingle()
      aiCallId = call?.id ?? null
    }

    if (!obj) {
      await db.from('audit_sections').update({
        model, prompt_sha256: promptSha, input_sha256: built.sha256, ai_call_id: aiCallId,
        raw_text: raw.slice(0, 20000), json_parsed: false, handles: built.input.handles,
      }).eq('id', sectionId)
      return await fail('The audit came back in a shape we could not read. Nothing was recorded '
        + 'for this agency; the answer itself is kept so it can be looked at.')
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
    if (reshaped.length || droppedUndated.length || droppedWordless.length) {
      const { data: cur } = await db.from('audit_runs').select('summary').eq('id', sec.run_id).maybeSingle()
      const prevSummary = (cur?.summary ?? {}) as Record<string, unknown>
      const was = (k: string) => (Array.isArray(prevSummary[k]) ? prevSummary[k] as unknown[] : [])
      await db.from('audit_runs').update({
        summary: { ...prevSummary,
          reshaped_to_dates: [...was('reshaped_to_dates'), ...reshaped],
          dropped_undated: [...was('dropped_undated'), ...droppedUndated],
          dropped_wordless: [...was('dropped_wordless'), ...droppedWordless],
        },
      }).eq('id', sec.run_id)
    }
    if (droppedUndated.length || droppedWordless.length) {
      // Said out loud as well as stored, the same as a mapped word: these are items the model
      // produced and the product refused, and refusing quietly is how the wordless-finding leak
      // survived five runs of the golden set.
      console.warn(`audit section ${sectionId}: dropped ${droppedUndated.length} date(s) with no day `
        + `and no claim to recur, ${droppedWordless.length} item(s) that would have landed with no word`)
    }

    if (previous.length) await matchAgainstPrevious(db, sec, previous, obj)
    // Per section, as its findings land: the handles only mean anything to the call shown them.
    const collapsedHere = raisedInRun.length
      ? await collapseAgainstEarlier(db, sec, raisedInRun, obj)
      : 0
    if (collapsedHere) {
      const { data: cur } = await db.from('audit_runs').select('summary').eq('id', sec.run_id).maybeSingle()
      const prev = (cur?.summary ?? {}) as Record<string, unknown>
      await db.from('audit_runs').update({
        summary: { ...prev,
          collapsed_duplicates: (Number(prev.collapsed_duplicates) || 0) + collapsedHere },
      }).eq('id', sec.run_id)
    }

    await db.from('audit_sections').update({
      status: 'done', could_not_complete_reason: null,
      finished_at: new Date().toISOString(),
      model, prompt_sha256: promptSha, input_sha256: built.sha256, ai_call_id: aiCallId,
      raw_text: raw.slice(0, 20000), json_parsed: true,
      handles: built.input.handles,
      documents_read: readIds, documents_held_unread: unreadIds,
    }).eq('id', sectionId)

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
  const { data: secs } = await db.from('audit_sections')
    .select('id, title').eq('company_id', companyId).eq('run_id', previousRunId)
  const mine = new Set((secs ?? []).filter((s: { title: string }) => s.title === agency)
    .map((s: { id: string }) => s.id))

  return (data ?? []).filter((f: { section_id: string }) => mine.has(f.section_id))
    .map((f: { id: string; title: string; word: string | null; kind: string }, i: number) => ({
      id: f.id,
      shown: { handle: `F${i + 1}`, title: f.title, word: f.word, kind: f.kind },
    }))
}

/**
 * CARRIED FORWARD, OR CLOSED.
 *
 * *** MATCHED BY HANDLE, NEVER BY STRING EQUALITY. *** Two runs of the same model write the same
 * finding in different words — that is the whole reason Run 1c's keys had to stop naming one
 * model's phrasing. So the model is shown the previous findings as F1, F2 and asked which of its
 * own findings is the same one; code does the rest.
 *
 * A previous finding no new finding claimed is CLOSED with the run that closed it and a reason in
 * words. It is not deleted: "we were subject to this from March to January" is the history the
 * product exists to keep (§3.2, obligations are marked, never deleted), and the same applies to a
 * finding that was fixed.
 */
export async function matchAgainstPrevious(
  db: Db,
  sec: { id: string; run_id: string; company_id: string },
  previous: Array<{ id: string; shown: PreviousFinding }>,
  obj: Record<string, unknown>,
): Promise<{ carried: number; closed: number }> {
  const byHandle = new Map(previous.map((p) => [p.shown.handle.toUpperCase(), p.id]))

  // The new rows, in the order they were written, so the model's nth finding is this section's nth.
  const { data: fresh } = await db.from('audit_findings')
    .select('id, ordinal').eq('section_id', sec.id).order('ordinal')
  const freshRows: Array<{ id: string; ordinal: number }> = fresh ?? []

  const claimed = new Set<string>()
  let carried = 0
  let i = 0
  for (const { field } of KINDS) {
    const list = Array.isArray(obj[field]) ? (obj[field] as unknown[]) : []
    for (const raw of list) {
      const item = (typeof raw === 'string' ? { title: raw } : raw) as Record<string, unknown>
      const title = typeof item?.title === 'string' ? item.title : (item?.what as string)
      if (!title) continue
      const row = freshRows[i++]
      const h = typeof item?.same_as === 'string' ? item.same_as.trim().toUpperCase() : ''
      const prevId = h ? byHandle.get(h) : undefined
      if (row && prevId) {
        await db.from('audit_findings').update({ same_as: prevId }).eq('id', row.id)
        claimed.add(prevId)
        carried++
      }
    }
  }

  const unmatched = previous.filter((p) => !claimed.has(p.id)).map((p) => p.id)
  if (unmatched.length) {
    const { error } = await db.from('audit_findings').update({
      status: 'closed', closed_by_run_id: sec.run_id,
      closed_reason: 'not raised by the newer audit',
    }).in('id', unmatched).eq('status', 'open')
    if (error) throw new Error(`matchAgainstPrevious: closing: ${error.message}`)
  }
  return { carried, closed: unmatched.length }
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
  const { data: runNow } = await db.from('audit_runs').select('summary').eq('id', runId).maybeSingle()
  const collapsed = Number(((runNow?.summary ?? {}) as Record<string, unknown>)
    .collapsed_duplicates) || 0

  // How fresh the evidence was: the newest reading any section was shown. Read from the scans of
  // the documents the sections recorded, not from the run's own clock — the run's date says when we
  // looked, and this says how old what we looked at was.
  const readIds = await sectionDocumentIds(db, runId)
  let readingsAsOf: string | null = null
  if (readIds.length) {
    const { data: newest } = await db.from('document_scans')
      .select('scanned_at').in('document_id', readIds).eq('is_current', true)
      .order('scanned_at', { ascending: false }).limit(1).maybeSingle()
    readingsAsOf = newest?.scanned_at ?? null
  }

  const { data: claimed, error: cErr } = await db.from('audit_runs').update({
    status: 'done', finished_at: new Date().toISOString(),
    done_count: done.length, readings_as_of: readingsAsOf,
    // The collapse count travels on the summary, beside the other things a rule did quietly.
    summary: { ...summary, collapsed_duplicates: collapsed },
  }).eq('id', runId).neq('status', 'done').select('id')
  if (cErr) throw new Error(`finishRunIfDone: claiming done: ${cErr.message}`)
  if (!claimed?.length) return { finished: false, summary: null }

  return { finished: true, summary: { ...summary, collapsed_duplicates: collapsed } }
}

/** Every document any section of this run recorded as read, deduplicated. */
async function sectionDocumentIds(db: Db, runId: string): Promise<string[]> {
  const { data } = await db.from('audit_sections').select('documents_read').eq('run_id', runId)
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
  const [{ data: rows }, { data: secs }, { data: run }] = await Promise.all([
    db.from('audit_findings').select('title, kind, word, status, passed, document_id, same_as')
      .eq('run_id', runId).order('ordinal'),
    db.from('audit_sections').select('title, status').eq('run_id', runId).order('ordinal'),
    db.from('audit_runs').select('previous_run_id, summary').eq('id', runId).maybeSingle(),
  ])
  const f = rows ?? []
  const sections = secs ?? []

  const titleById = new Map<string, string>()
  const docIds = [...new Set(f.map((r: { document_id: string | null }) => r.document_id).filter(Boolean))]
  if (docIds.length) {
    const { data: docs } = await db.from('document_index_v')
      .select('document_id, title, file_name').in('document_id', docIds)
    for (const d of docs ?? []) titleById.set(d.document_id, d.title || d.file_name)
  }

  const count = (p: (r: Record<string, unknown>) => boolean) => f.filter(p).length
  let closed = 0
  if (run?.previous_run_id) {
    const { count: n } = await db.from('audit_findings')
      .select('id', { count: 'exact', head: true }).eq('closed_by_run_id', runId)
    closed = n ?? 0
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
  }
}

/** One sentence, for the banner and the email subject. The same rule as `summaryLine`. */
export function runSummaryLine(s: RunSummary): string {
  if (s.note) return s.note
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
  return head + tail + failed
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
