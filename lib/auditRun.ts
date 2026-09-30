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
import { auditAgencyPrompt, type PreviousFinding } from '../prompts/audit-agency.ts'

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
}): Promise<{ runId: string; sectionIds: string[]; agencies: string[]; status: string }> {
  const kind = args.kind ?? 'agency'
  if (kind !== 'agency') throw new Error(`createRun: only the agency kind is built; got "${kind}"`)

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

function emptySummary(note: string): RunSummary {
  return { total: 0, needs_person: 0, nothing_on_file: 0, stale: 0, on_file: 0, not_a_document_question: 0,
           contradictions: 0, dates_passed: 0, expected: 0, sections: 0, sections_done: 0,
           could_not_complete: 0, carried: 0, closed: 0, attention: [], agencies: [], note }
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
  Promise<{ status: 'done' | 'could_not_complete'; findings: number; reason?: string }> {
  const startedAt = new Date().toISOString()

  const { data: sec, error: sErr } = await db.from('audit_sections')
    .select('id, run_id, company_id, ordinal, title').eq('id', sectionId).maybeSingle()
  if (sErr) throw new Error(`runSection: reading the section: ${sErr.message}`)
  if (!sec) throw new Error(`runSection: no section ${sectionId}`)

  const fail = async (reason: string) => {
    await db.from('audit_sections').update({
      status: 'could_not_complete', could_not_complete_reason: reason.slice(0, 2000),
      started_at: startedAt, finished_at: new Date().toISOString(),
    }).eq('id', sectionId)
    await db.from('audit_runs').update({ status: 'running', started_at: startedAt })
      .eq('id', sec.run_id).eq('status', 'queued')
    return { status: 'could_not_complete' as const, findings: 0, reason }
  }

  try {
    await db.from('audit_sections').update({ status: 'running', started_at: startedAt }).eq('id', sectionId)
    await db.from('audit_runs').update({ status: 'running', started_at: startedAt })
      .eq('id', sec.run_id).eq('status', 'queued')

    const built = await buildAuditInput(db, sec.company_id, sec.title, { today: opts.today })

    // The previous run's open findings, if this run is a re-audit. Shown as F1, F2 — the same
    // reason documents are shown as D1, D2: the model must be able to point at one without
    // copying an identifier it can get wrong (§144).
    const { data: run } = await db.from('audit_runs')
      .select('previous_run_id').eq('id', sec.run_id).maybeSingle()
    const previous = run?.previous_run_id
      ? await previousOpenFindings(db, sec.company_id, run.previous_run_id, sec.title)
      : []

    const system = auditAgencyPrompt(previous.length ? { previous: previous.map((p) => p.shown) } : undefined)
    const promptSha = createHash('sha256').update(system).digest('hex')
    const model = modelForTask('audit')

    const answer = await askAIWithCitations(system, built.block, {
      maxTokens: 8000, enableWebSearch: true,
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

    const { rows, handleErrors, readIds, unreadIds } = shapeFindings(obj, built.input, {
      runId: sec.run_id, sectionId, companyId: sec.company_id,
    })

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

    if (previous.length) await matchAgainstPrevious(db, sec, previous, obj)

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
    return { status: 'done', findings: rows.length }
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
) {
  const handles = input.handles
  const scanByDoc = new Map<string, string | null>()
  for (const d of input.documents) scanByDoc.set(d.document_id, d.scan_id ?? null)

  const handleErrors: string[] = []
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
      // finding, which carries no such requirement.
      let useKind: string = kind
      if (kind === 'date' && !str(item.due_on)) useKind = 'finding'
      if (kind === 'contradiction' && !(b.id && str(item.value_a) && str(item.value_b))) useKind = 'finding'

      const word = useKind === 'expected' ? 'nothing_on_file'
        : (str(item.word) && ['on_file', 'stale', 'nothing_on_file', 'not_a_document_question']
            .includes(String(item.word)) ? String(item.word) : null)

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
        due_on: useKind === 'date' ? str(item.due_on) : null,
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
  return { rows, handleErrors, readIds, unreadIds }
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

  const summary = await summariseRun(db, runId)

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
    done_count: done.length, readings_as_of: readingsAsOf, summary,
  }).eq('id', runId).neq('status', 'done').select('id')
  if (cErr) throw new Error(`finishRunIfDone: claiming done: ${cErr.message}`)
  if (!claimed?.length) return { finished: false, summary: null }

  return { finished: true, summary }
}

async function sectionDocumentIds(db: Db, runId: string): Promise<string[]> {
  const { data } = await db.from('audit_sections').select('documents_read').eq('run_id', runId)
  const rows = (data ?? []) as Array<{ documents_read: string[] | null }>
  return [...new Set(rows.flatMap((s) => s.documents_read ?? []))]
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
    db.from('audit_runs').select('previous_run_id').eq('id', runId).maybeSingle(),
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
    note: null,
  }
}

/** One sentence, for the banner and the email subject. The same rule as `summaryLine`. */
export function runSummaryLine(s: RunSummary): string {
  if (s.note) return s.note
  const who = s.agencies.length === 1 ? `${s.agencies[0]} audit`
    : `compliance audit across ${s.agencies.length} agencies`
  const bits: string[] = []
  if (s.nothing_on_file) bits.push(`${s.nothing_on_file} with nothing on file`)
  if (s.stale) bits.push(`${s.stale} out of date`)
  if (s.contradictions) bits.push(`${s.contradictions} disagreement${s.contradictions === 1 ? '' : 's'} between documents`)
  if (s.not_a_document_question) bits.push(`${s.not_a_document_question} no document can answer`)
  const head = s.needs_person
    ? `Your ${who} found ${s.needs_person} thing${s.needs_person === 1 ? '' : 's'} that need${s.needs_person === 1 ? 's' : ''} you`
    : `Your ${who} found nothing that needs you`
  const tail = bits.length ? `: ${bits.join(', ')}.` : '.'
  const failed = s.could_not_complete
    ? ` ${s.could_not_complete} of ${s.sections} section${s.sections === 1 ? '' : 's'} could not be finished.`
    : ''
  return head + tail + failed
}
