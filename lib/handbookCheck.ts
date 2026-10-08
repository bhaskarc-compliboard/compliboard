/**
 * THE HANDBOOK CHECK — HR Step 8 (HR-PLAN decision 2), and since 8 October 2026 THE BASELINE (the owner: rev 1 is
 * Opus 5.5 at full power, unrestricted; improvements later as switches, off by default, each measured).
 *
 * Each current handbook is checked against the rules for its sites, and the result is rows in 066's tables (with
 * 071's and 072's columns). The ENGINE copies Audits' patterns — a claim per unit, a five-minute sweep, a
 * compare-and-set finish — and none of Audits' files (decision 2, map B4). It is unchanged by the baseline:
 *
 *   createCheck        a check row and one queued row per section. One open check per handbook is the
 *                      DATABASE's rule (071's idx_handbook_checks_one_open).
 *   packPieces         the whole handbook in one piece when it fits (the answer's size rule, `lib/hrAnswer.ts`
 *                      budgetTokens); otherwise consecutive sections up to that size.
 *   runPiece           *** THE SAME CALL AS AN HR ANSWER *** — the pure prompt, the company context, the piece's
 *                      sections, web search with no limit, one fixed question — then `finishAnswer` exactly as an
 *                      answer uses it, and the answer, its sources and its check record stored (072).
 *   failRows           a failed piece is put back ONCE, then failed with its reason (the owner).
 *   recoverStuck       a crashed claim is put back once, then failed (071's `attempts`).
 *   finishCheckIfDone  done_count as rows land; done, or failed when every section failed; checked_at and
 *                      next_check_at (+90 days) only on done.
 *   sweepChecks        the sweep: recover, then one company at a time, its pieces in order, within the time budget.
 *
 * WHAT LEFT THE RUN ON 8 OCTOBER, kept on the local branch `parked/hr-check-structured` for a later switch: the
 * structured check prompt and its schema, the separate "not covered" call, and the per-section word rules.
 * Checks stored before then keep their words and findings, readable as before.
 *
 * No Next.js here, so a script and the tests can drive it; the routes are thin wrappers.
 */
import { createHash } from 'node:crypto'
import { askAIOpenStream, modelForTask, type OpenMessage, type OpenStreamEvent } from './ai.ts'
import { buildCompanyContext } from './companyContext.ts'
import { finishAnswer, handbookContext, checkRecord, budgetTokens, TOKENS_PER_CHAR, type Block, type HandbookUsed } from './hrAnswer.ts'
import { quotesDroppedLine, linksDroppedLine } from './hrAnswerWords.ts'
import { lazyJobRun } from './jobRun.ts'
import { notifyCheck } from './handbookCheckNotify.ts'
import { hrAnswerPrompt, hrAnswerMessage } from '../prompts/hr-answer.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

/** THE SIZE RULE (owner, Baseline Step 1): a piece holds what an HR answer would send whole — the same budget. */
export const pieceChars = () => Math.floor(budgetTokens() / TOKENS_PER_CHAR)

/** The one question every piece is asked (the owner, Baseline Step 1). */
export const CHECK_QUESTION = "Check this handbook against the rules that apply to us. What needs to change, what's missing, and what's unclear?"

/** A piece is started at most twice: once, and one retry (the owner). */
export const MAX_ATTEMPTS = 2
/** The time budget and the stuck limit are the audit sweep's, unchanged (`app/api/jobs/audit-sections/route.ts`). */
export const BUDGET_MS = 640_000
export const RESERVE_MS = 130_000
export const STUCK_AFTER_MS = 900_000
/** A handbook is read again 90 days after a check finishes (HR-PLAN §2.1). */
export const NEXT_CHECK_DAYS = 90
/** As Audits' sections (`lib/auditRun.ts`): one piece's answer may be long. The owner, Step 8. */
export const PIECE_MAX_TOKENS = 16000

/** The words a person sees from the Check now route. The first is the owner's; the other two need his yes. */
export const ALREADY_CHECKING = 'This handbook is already being checked.'
export const NOT_READ_YET = "This handbook hasn't been read yet, so it can't be checked."
export const ONLY_NEWEST = 'Only the newest version of a handbook can be checked.'

/** Why a row stopped, stored on the row (071's failed_reason); technical, for us. */
export const REASONS = {
  replaced: 'A newer version of this handbook was added, so this version is no longer checked.',
  crashedTwice: 'The check of this part stopped without finishing twice.',
  leftOut: 'The answer left out this section.',
} as const

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

// ---------------------------------------------------------------------------------------------------------
// PACKING
// ---------------------------------------------------------------------------------------------------------

export interface PackRow { id: string; checkId: string; kind: 'section' | 'not_covered'; position: number; chars: number }

/**
 * NEIGHBOURS, UP TO A SIZE — THE WHOLE HANDBOOK WHEN IT FITS. Rows of one check, in position order, go together while the total stays within `cap`
 * and the positions are consecutive (a section retried alone is not glued to a stranger). A section longer than
 * the cap is a piece of its own. The "not covered" row is always alone, after the check's sections. Checks keep
 * the order they are given in.
 */
export function packPieces(rows: PackRow[], cap = pieceChars()): PackRow[][] {
  const pieces: PackRow[][] = []
  const checks = [...new Set(rows.map((r) => r.checkId))]
  for (const checkId of checks) {
    const mine = rows.filter((r) => r.checkId === checkId)
    const sections = mine.filter((r) => r.kind === 'section').sort((a, b) => a.position - b.position)
    let cur: PackRow[] = []
    let size = 0
    for (const r of sections) {
      const last = cur[cur.length - 1]
      if (cur.length && (size + r.chars > cap || r.position !== last.position + 1)) { pieces.push(cur); cur = []; size = 0 }
      cur.push(r); size += r.chars
    }
    if (cur.length) pieces.push(cur)
    for (const r of mine.filter((x) => x.kind === 'not_covered')) pieces.push([r])
  }
  return pieces
}

// ---------------------------------------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------------------------------------

export type CreateResult =
  | { ok: true; checkId: string; rows: number }
  | { ok: false; reason: 'not_found' | 'not_read' | 'not_current' | 'already' }

/**
 * A check and its rows, written by the server (the caller passes the service-role client; 066 grants a person
 * SELECT only). A second open check of the same handbook is refused by 071's unique index — read here as
 * Postgres's unique_violation, 23505 — never by a lookup that two presses could both pass.
 */
export async function createCheck(admin: Db, args: {
  companyId: string; handbookId: string; reason: 'new_handbook' | 'new_version' | 'scheduled' | 'on_demand'
  requestedBy: string | null
}): Promise<CreateResult> {
  const { data: hb, error: hErr } = await admin.from('handbooks')
    .select('id, company_id, status, is_current').eq('id', args.handbookId).eq('company_id', args.companyId).maybeSingle()
  if (hErr) throw new Error(`createCheck: ${hErr.message}`)
  if (!hb) return { ok: false, reason: 'not_found' }
  if (!hb.is_current) return { ok: false, reason: 'not_current' }
  if (hb.status !== 'read') return { ok: false, reason: 'not_read' }
  const { data: secs, error: sErr } = await admin.from('handbook_sections')
    .select('id, position').eq('handbook_id', args.handbookId).eq('company_id', args.companyId).order('position')
  if (sErr) throw new Error(`createCheck: ${sErr.message}`)
  if (!secs?.length) return { ok: false, reason: 'not_read' }

  const ctx = await buildCompanyContext(admin, args.companyId, { parts: ['company', 'declared', 'confirmed'] })
  const { data: check, error: cErr } = await admin.from('handbook_checks').insert({
    handbook_id: args.handbookId, company_id: args.companyId, reason: args.reason,
    requested_by: args.requestedBy, section_count: secs.length, context_sha256: ctx.sha256,
  }).select('id').single()
  if (cErr) {
    if (cErr.code === '23505') return { ok: false, reason: 'already' }
    throw new Error(`createCheck: ${cErr.message}`)
  }
  // One row per section. Since the baseline there is no separate "not covered" row: the one question asks what is
  // missing too.
  const rows = secs.map((s: { id: string }) => ({ check_id: check.id, company_id: args.companyId, kind: 'section', section_id: s.id }))
  const { error: rErr } = await admin.from('handbook_check_sections').insert(rows)
  if (rErr) {
    // A check with no rows would hold the handbook's one open slot forever: take it back out.
    await admin.from('handbook_checks').delete().eq('id', check.id)
    throw new Error(`createCheck: writing its rows: ${rErr.message}`)
  }
  return { ok: true, checkId: check.id, rows: rows.length }
}

// ---------------------------------------------------------------------------------------------------------
// FAIL, RECOVER, CANCEL, FINISH
// ---------------------------------------------------------------------------------------------------------

/** A failed piece: each row back in the queue if it has been started fewer than MAX_ATTEMPTS times, else failed. */
export async function failRows(admin: Db, rows: Array<{ id: string; attempts: number }>, reason: string): Promise<{ retried: number; failed: number }> {
  let retried = 0, failed = 0
  for (const r of rows) {
    if (r.attempts < MAX_ATTEMPTS) {
      await admin.from('handbook_check_sections').update({ status: 'queued', claimed_at: null, started_at: null, failed_reason: null })
        .eq('id', r.id).eq('status', 'checking')
      retried++
    } else {
      await admin.from('handbook_check_sections').update({
        status: 'failed', failed_reason: reason.slice(0, 2000), claimed_at: null, finished_at: new Date().toISOString(),
      }).eq('id', r.id).eq('status', 'checking')
      failed++
    }
  }
  return { retried, failed }
}

/**
 * A CLAIM OLDER THAN 15 MINUTES (the audit sweep's limit). A row still 'checking' was being checked by a sweep that
 * died: put back once, then failed. A row still 'queued' with a claim was never started: the claim is cleared and
 * no attempt counted. Each update is guarded on the claim still being old, so a sweep that picked the row up in
 * between is not robbed of it.
 */
export async function recoverStuck(admin: Db, now = Date.now()): Promise<{ putBack: number; failed: number; released: number }> {
  const before = new Date(now - STUCK_AFTER_MS).toISOString()
  let putBack = 0, failed = 0, released = 0
  const { data: stuck } = await admin.from('handbook_check_sections')
    .select('id, attempts').eq('status', 'checking').lt('claimed_at', before)
  for (const r of (stuck ?? []) as Array<{ id: string; attempts: number }>) {
    const { data } = r.attempts < MAX_ATTEMPTS
      ? await admin.from('handbook_check_sections').update({ status: 'queued', claimed_at: null, started_at: null })
          .eq('id', r.id).eq('status', 'checking').lt('claimed_at', before).select('id')
      : await admin.from('handbook_check_sections').update({
          status: 'failed', failed_reason: REASONS.crashedTwice, claimed_at: null, finished_at: new Date(now).toISOString(),
        }).eq('id', r.id).eq('status', 'checking').lt('claimed_at', before).select('id')
    if (data?.length) { if (r.attempts < MAX_ATTEMPTS) putBack++; else failed++ }
  }
  const { data: idle } = await admin.from('handbook_check_sections').update({ claimed_at: null })
    .eq('status', 'queued').lt('claimed_at', before).select('id')
  released = idle?.length ?? 0
  return { putBack, failed, released }
}

/** The owner's rule for a newer version: the old version's QUEUED rows are cancelled, and so is its check. */
export async function cancelCheck(admin: Db, checkId: string, reason: string): Promise<number> {
  const { data } = await admin.from('handbook_check_sections').update({
    status: 'cancelled', failed_reason: reason, claimed_at: null, finished_at: new Date().toISOString(),
  }).eq('check_id', checkId).eq('status', 'queued').select('id')
  await admin.from('handbook_checks').update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', checkId).in('status', ['queued', 'checking'])
  return data?.length ?? 0
}

/**
 * Progress after every piece, and the finish once every row has settled. Claimed with `.in('status', open)` so
 * only one caller finishes a check. Done: the handbook's checked_at and next_check_at (+90 days).
 * *** EVERY SECTION FAILED: the check is 'failed', with no checked_at and no next_check_at, EVEN IF the "not
 * covered" pass worked (the owner, after Step 8 part 1's proof d): a handbook none of whose sections was read
 * must never be shown as checked. *** Some sections failed: done, and the row says how many were not checked.
 */
export async function finishCheckIfDone(admin: Db, checkId: string): Promise<{ finished: boolean; status?: string; done: number; total: number }> {
  const { data: rows, error } = await admin.from('handbook_check_sections').select('kind, status').eq('check_id', checkId)
  if (error) throw new Error(`finishCheckIfDone: ${error.message}`)
  const all = (rows ?? []) as Array<{ kind: string; status: string }>
  const settled = (s: string) => s === 'done' || s === 'failed' || s === 'cancelled'
  const sections = all.filter((r) => r.kind === 'section')
  const done = sections.filter((r) => settled(r.status)).length
  await admin.from('handbook_checks').update({ done_count: done }).eq('id', checkId)
  if (!all.length || all.some((r) => !settled(r.status))) return { finished: false, done, total: sections.length }

  const status = sections.every((r) => r.status === 'failed') ? 'failed' : 'done'
  const finishedAt = new Date()
  const { data: claimed } = await admin.from('handbook_checks').update({ status, finished_at: finishedAt.toISOString() })
    .eq('id', checkId).in('status', ['queued', 'checking']).select('handbook_id')
  if (!claimed?.length) return { finished: false, done, total: sections.length }
  if (status === 'done') {
    const next = new Date(finishedAt.getTime() + NEXT_CHECK_DAYS * 86_400_000)
    await admin.from('handbooks').update({ checked_at: finishedAt.toISOString(), next_check_at: next.toISOString() })
      .eq('id', claimed[0].handbook_id)
  }
  return { finished: true, status, done, total: sections.length }
}

// ---------------------------------------------------------------------------------------------------------
// RUN ONE PIECE
// ---------------------------------------------------------------------------------------------------------

export type Ask = typeof askAIOpenStream

export interface PieceResult {
  status: 'done' | 'failed' | 'retry' | 'skipped' | 'cancelled' | 'gone'
  rows: number
  /** The answer's handbook cards and web sources; the quotes it marked "not found"; whether it was the whole handbook. */
  cards?: number
  web?: number
  marked?: number
  whole?: boolean
  aiCallId?: string | null
  reason?: string
}

interface SectionRow { id: string; position: number; title: string | null; page_from: number | null; page_to: number | null; text: string }

const pagesOf = (a: number | null, b: number | null) => (a == null ? '' : a === b || b == null ? ` (page ${a})` : ` (pages ${a}–${b})`)

/**
 * ONE PIECE — THE SAME CALL AS AN HR ANSWER (owner, Baseline Step 1). Re-read before the call (a deleted handbook
 * stops here, a replaced one cancels its check), mark the rows started, then the answer route's own call:
 * hrAnswerPrompt() (the workspace's open research prompt as it runs, plus HR's sentence), `hrAnswerMessage` with the company context and the piece's sections in `handbookContext`'s form,
 * web search with no limit, task and ledger 'hr_check'. At done, `finishAnswer` exactly as the answer route uses it,
 * with the same closing lines; the answer, its sources and its check record are stored on the piece's first row.
 * `ask` is the real call unless a script passes another (the forced-failure proof).
 */
export async function runPiece(admin: Db, rowIds: string[], opts: { ask?: Ask } = {}): Promise<PieceResult> {
  const ask = opts.ask ?? askAIOpenStream
  const { data: rowsRaw } = await admin.from('handbook_check_sections')
    .select('id, check_id, company_id, kind, section_id, status, attempts').in('id', rowIds)
  const rows = ((rowsRaw ?? []) as Array<{ id: string; check_id: string; company_id: string; kind: string; section_id: string | null; status: string; attempts: number }>)
    .filter((r) => r.status === 'queued' && r.kind === 'section')
  if (!rows.length) return { status: rowsRaw?.length ? 'skipped' : 'gone', rows: 0 }
  const checkId = rows[0].check_id
  const companyId = rows[0].company_id

  const live = async () => {
    const { data: check } = await admin.from('handbook_checks').select('id, handbook_id, status').eq('id', checkId).maybeSingle()
    if (!check) return { gone: true as const }
    const { data: hb } = await admin.from('handbooks')
      .select('id, name, scope, entity_id, is_current, page_count, extracted_text, version_of, created_at').eq('id', check.handbook_id).maybeSingle()
    if (!hb) return { gone: true as const }
    return { gone: false as const, check, hb }
  }
  const before = await live()
  if (before.gone) return { status: 'gone', rows: 0 }
  if (!['queued', 'checking'].includes(before.check.status)) return { status: 'skipped', rows: 0 }
  if (!before.hb.is_current) { await cancelCheck(admin, checkId, REASONS.replaced); return { status: 'cancelled', rows: rows.length } }
  const hb = before.hb

  // ---- the input: the answer route's, with this piece's sections ----
  const company = (await buildCompanyContext(admin, companyId, { parts: ['company', 'declared', 'confirmed'] })).block
  const { data: secsRaw } = await admin.from('handbook_sections').select('id, position, title, page_from, page_to, text')
    .eq('handbook_id', hb.id).order('position')
  const secs = (secsRaw ?? []) as SectionRow[]
  const mine = secs.filter((s) => rows.some((r) => r.section_id === s.id))
  const whole = mine.length === secs.length
  let applies = 'Every site'
  if (hb.scope === 'site') {
    const { data: site } = hb.entity_id ? await admin.from('entities').select('name').eq('id', hb.entity_id).maybeSingle() : { data: null }
    applies = site?.name ?? 'a site that was removed'
  }
  // As the answer loader marks them (`lib/hrAnswer.ts` loadHandbooksForAnswer): a Word file has no page count.
  const isWord = hb.page_count == null
  const blocks: Block[] = mine.map((s) => ({ id: `H${s.position + 1}`, handbookId: hb.id, handbookName: hb.name, applies,
    sectionId: s.id, title: s.title ?? `Section ${s.position + 1}`, pageFrom: s.page_from, pageTo: s.page_to, stored: s.text }))
  const used: HandbookUsed[] = [{ id: hb.id, name: hb.name, pages: hb.page_count, text: hb.extracted_text ?? '', isWord,
    as: whole ? 'sections' : 'selected sections', versionOf: hb.version_of, addedAt: hb.created_at }]
  let handbooks = handbookContext({ ok: true, blocks, used, notUsed: [], long: [], waiting: [], spent: 0, budget: budgetTokens() })
  if (!whole) {
    // A PART of a handbook too long for one call: the whole table of contents goes with it (the owner).
    handbooks += `\n\nThis is one part of "${hb.name}"; only the sections above are included. The handbook's full table of contents:\n`
      + secs.map((s) => `- ${s.title ?? `Section ${s.position + 1}`}${pagesOf(s.page_from, s.page_to)}`).join('\n')
  }
  const messages: OpenMessage[] = [{ role: 'user', content: hrAnswerMessage(company, handbooks, CHECK_QUESTION) }]

  // ---- started: attempts counted, the claim refreshed so the stuck limit measures this piece ----
  const startedAt = new Date().toISOString()
  for (const r of rows) {
    await admin.from('handbook_check_sections').update({ status: 'checking', attempts: r.attempts + 1, started_at: startedAt, claimed_at: startedAt })
      .eq('id', r.id).eq('status', 'queued')
    r.attempts += 1
  }
  await admin.from('handbook_checks').update({ status: 'checking' }).eq('id', checkId).eq('status', 'queued')
  await admin.from('handbook_checks').update({ started_at: startedAt }).eq('id', checkId).is('started_at', null)

  // ---- the last look before money is spent (CLAUDE.md §4) ----
  const now = await live()
  if (now.gone) return { status: 'gone', rows: 0 }
  if (!now.hb.is_current) {
    await admin.from('handbook_check_sections').update({ status: 'queued', claimed_at: null, started_at: null }).in('id', rows.map((r) => r.id))
    await cancelCheck(admin, checkId, REASONS.replaced)
    return { status: 'cancelled', rows: rows.length }
  }

  const model = modelForTask('hr_check')
  const system = hrAnswerPrompt()
  const receipt = { model, prompt_sha256: sha(system), input_sha256: sha(String(messages[0].content)) }
  const fail = async (why: string) => {
    console.error(`handbook check ${checkId}: ${why}`)
    const f = await failRows(admin, rows, why)
    return { status: f.failed ? 'failed' as const : 'retry' as const, rows: rows.length, reason: why }
  }

  // THE ANSWER ROUTE'S CALL: no search limit (AI_SEARCH_MAX_HR is the answer route's; the check has none).
  let ev: Extract<OpenStreamEvent, { type: 'done' }> | null = null
  try {
    for await (const e of ask(system, messages, { task: 'hr_check', maxTokens: PIECE_MAX_TOKENS, ledger: { companyId, task: 'hr_check' } })) {
      if (e.type === 'done') ev = e
      else if (e.type === 'error') throw new Error(e.message)
    }
  } catch (e) {
    return fail(`The call failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!ev || !ev.answer.text.trim()) return fail('The answer came back empty')

  // The ledger row, found by time and polled, as `lib/auditRun.ts` does: recordAICall is not awaited.
  let aiCallId: string | null = null
  for (let i = 0; i < 5 && !aiCallId; i++) {
    if (i) await new Promise((r) => setTimeout(r, 250))
    const { data: call } = await admin.from('ai_calls').select('id').eq('company_id', companyId).eq('task', 'hr_check')
      .gte('created_at', startedAt).order('created_at', { ascending: false }).limit(1).maybeSingle()
    aiCallId = call?.id ?? null
  }

  // ---- AT DONE: exactly as the answer route ----
  const fin = finishAnswer(ev.answer.text, ev.answer.sources, ev.searched, blocks, used, ev.cited ?? [])
  const lines = [
    fin.droppedQuotes ? quotesDroppedLine(fin.droppedQuotes) : '',
    fin.droppedLinks ? linksDroppedLine(fin.droppedLinks) : '',
  ].filter(Boolean)
  const text = [fin.text.trim(), ...lines].join('\n\n')
  const record = checkRecord({ used, selections: [], budgetTokens: budgetTokens(), searched: ev.searched, citedPassages: (ev.cited ?? []).length, done: fin })

  try {
    // The answer on the piece's first row; the piece's other rows are done with it and carry none.
    const lead = [...rows].sort((a, b) => (secs.find((x) => x.id === a.section_id)?.position ?? 0) - (secs.find((x) => x.id === b.section_id)?.position ?? 0))[0]
    const finishedAt = new Date().toISOString()
    const { error } = await admin.from('handbook_check_sections').update({ ...receipt, ai_call_id: aiCallId, status: 'done', claimed_at: null,
      finished_at: finishedAt, answer_text: text, answer_sources: fin.sources, check_record: record }).eq('id', lead.id).eq('status', 'checking')
    if (error) throw new Error(error.message)
    const others = rows.filter((r) => r.id !== lead.id).map((r) => r.id)
    if (others.length) {
      const { error: oErr } = await admin.from('handbook_check_sections').update({ ...receipt, ai_call_id: aiCallId, status: 'done',
        claimed_at: null, finished_at: finishedAt }).in('id', others).eq('status', 'checking')
      if (oErr) throw new Error(oErr.message)
    }
  } catch (e) {
    return fail(`The answer could not be saved: ${e instanceof Error ? e.message : String(e)}`)
  }
  const cards = fin.sources.filter((x) => x.kind === 'handbook').length
  return { status: 'done', rows: rows.length, cards, web: fin.sources.length - cards, marked: fin.notFoundQuotes + fin.uncheckedQuotes,
    whole, aiCallId }
}

// ---------------------------------------------------------------------------------------------------------
// THE SWEEP
// ---------------------------------------------------------------------------------------------------------

export interface SweepCounts {
  companies: number; pieces: number; rows_done: number; retried: number; failed: number; cancelled: number; gone: number
  recovered: { putBack: number; failed: number; released: number }; checks_finished: number
  /** Emails sent for checks someone pressed, and what went out — Audits' `sent` list, for Resend's id weeks later. */
  notified: number; sent: Array<{ check: string; to: string; id: string | null; error?: string }>
  stopped_for_time: boolean; wall_ms: number
}

/**
 * THE AUDIT SWEEP'S SHAPE (`app/api/jobs/audit-sections/route.ts`), copied: recover first; the oldest open check
 * decides which company is next; that company's queued rows are claimed in one statement (claimed_at; the status
 * moves only when a row is really started); its pieces run in order within the time budget; this run's own
 * unstarted claims are released in a finally. ONE DIFFERENCE, on purpose: each company is visited once per sweep,
 * so a piece put back after a failure is retried by the NEXT sweep (the owner), not straight away.
 * `maxPieces` and `ask` are for scripts; the route passes neither.
 */
export async function sweepChecks(admin: Db, opts: { ask?: Ask; maxPieces?: number; now?: () => number } = {}):
  Promise<SweepCounts & { run: string | null; errors: Array<{ piece: string; error: string }> }> {
  const clock = opts.now ?? Date.now
  const startedAt = clock()
  const run = lazyJobRun(admin, 'handbook_checks')
  const errors: Array<{ piece: string; error: string }> = []
  const c: SweepCounts = { companies: 0, pieces: 0, rows_done: 0, retried: 0, failed: 0, cancelled: 0, gone: 0,
    recovered: { putBack: 0, failed: 0, released: 0 }, checks_finished: 0, notified: 0, sent: [], stopped_for_time: false, wall_ms: 0 }
  const visited = new Set<string>()
  try {
    c.recovered = await recoverStuck(admin, clock())
    if (c.recovered.putBack || c.recovered.failed || c.recovered.released) await run.open()

    for (;;) {
      if (clock() - startedAt > BUDGET_MS - RESERVE_MS) { c.stopped_for_time = true; break }
      if (opts.maxPieces != null && c.pieces >= opts.maxPieces) break
      const { data: open } = await admin.from('handbook_checks').select('id, company_id, created_at')
        .in('status', ['queued', 'checking']).order('created_at', { ascending: true }).limit(50)
      let companyId: string | null = null
      for (const ck of (open ?? []) as Array<{ id: string; company_id: string }>) {
        if (visited.has(ck.company_id)) continue
        const { data: q } = await admin.from('handbook_check_sections').select('id')
          .eq('check_id', ck.id).eq('status', 'queued').is('claimed_at', null).limit(1)
        if (q?.length) { companyId = ck.company_id; break }
      }
      if (!companyId) break
      visited.add(companyId)

      const nowIso = new Date(clock()).toISOString()
      const { data: claimedRaw } = await admin.from('handbook_check_sections').update({ claimed_at: nowIso })
        .eq('company_id', companyId).eq('status', 'queued').is('claimed_at', null)
        .select('id, check_id, kind, section_id')
      const claimed = (claimedRaw ?? []) as Array<{ id: string; check_id: string; kind: 'section' | 'not_covered'; section_id: string | null }>
      if (!claimed.length) continue
      await run.open()
      c.companies++
      try {
        // Order: the older check first; within a check, its sections by position, then the "not covered" row.
        const checkIds = [...new Set(claimed.map((r) => r.check_id))]
        const { data: checks } = await admin.from('handbook_checks').select('id, created_at').in('id', checkIds)
        const created = new Map(((checks ?? []) as Array<{ id: string; created_at: string }>).map((x) => [x.id, x.created_at]))
        const sectionIds = claimed.map((r) => r.section_id).filter(Boolean) as string[]
        const sizes = new Map<string, { position: number; chars: number }>()
        if (sectionIds.length) {
          const { data: secs } = await admin.from('handbook_sections').select('id, position, text').in('id', sectionIds)
          for (const s of (secs ?? []) as Array<{ id: string; position: number; text: string }>) sizes.set(s.id, { position: s.position, chars: s.text.length })
        }
        const ordered = [...checkIds].sort((a, b) => (created.get(a) ?? '').localeCompare(created.get(b) ?? ''))
        const pack: PackRow[] = []
        for (const ck of ordered) for (const r of claimed.filter((x) => x.check_id === ck)) {
          const size = r.section_id ? sizes.get(r.section_id) : null
          pack.push({ id: r.id, checkId: r.check_id, kind: r.kind, position: size?.position ?? Number.MAX_SAFE_INTEGER, chars: size?.chars ?? 0 })
        }
        for (const piece of packPieces(pack)) {
          const ids = piece.map((p) => p.id)
          const outOfTime = clock() - startedAt > BUDGET_MS - RESERVE_MS
          const atLimit = opts.maxPieces != null && c.pieces >= opts.maxPieces
          if (outOfTime || atLimit) {
            if (outOfTime) c.stopped_for_time = true
            await admin.from('handbook_check_sections').update({ claimed_at: null }).in('id', ids).eq('status', 'queued').eq('claimed_at', nowIso)
            continue
          }
          c.pieces++
          try {
            const r = await runPiece(admin, ids, { ask: opts.ask })
            if (r.status === 'done') c.rows_done += r.rows
            else if (r.status === 'retry') c.retried += r.rows
            else if (r.status === 'failed') { c.failed += r.rows; errors.push({ piece: ids.join(','), error: r.reason ?? 'failed' }) }
            else if (r.status === 'cancelled') c.cancelled += r.rows
            else if (r.status === 'gone') c.gone++
            if (r.reason && r.status === 'retry') errors.push({ piece: ids.join(','), error: `will retry: ${r.reason}` })
            console.log(`handbook sweep: piece of ${ids.length} row(s) [${piece.map((p) => `S${p.position + 1}`).join(' ')}]${r.whole ? ' — the whole handbook' : ''} → ${r.status}`
              + `${r.cards != null ? `, ${r.cards} handbook card(s), ${r.web} web source(s), ${r.marked} quote(s) marked` : ''}${r.reason ? ` (${r.reason})` : ''}`)
          } catch (e) {
            c.failed += piece.length
            errors.push({ piece: ids.join(','), error: e instanceof Error ? e.message : String(e) })
          }
          const fin = await finishCheckIfDone(admin, piece[0].checkId)
          if (fin.finished) {
            c.checks_finished++
            // THE EMAIL, where Audits' sweep sends its own: right after the finish, and only here. Only a check someone
            // pressed is emailed (`lib/handbookCheckNotify.ts`); a failure to send is recorded, never fatal.
            try {
              const r = await notifyCheck(admin as Parameters<typeof notifyCheck>[0], piece[0].checkId)
              if (r.notified) c.notified++
              if (r.id || (r.error && r.to)) c.sent.push({ check: piece[0].checkId, to: r.to ?? '', id: r.id ?? null, ...(r.error ? { error: r.error } : {}) })
            } catch (e) {
              errors.push({ piece: `notify:${piece[0].checkId}`, error: e instanceof Error ? e.message : String(e) })
            }
          }
        }
      } finally {
        // ONLY this run's own unstarted claims, as the audit sweep (Workspace Stage 4 Part 3).
        await admin.from('handbook_check_sections').update({ claimed_at: null })
          .in('id', claimed.map((r) => r.id)).eq('status', 'queued').eq('claimed_at', nowIso)
      }
    }
  } catch (e) {
    errors.push({ piece: '(run)', error: e instanceof Error ? e.message : String(e) })
  }
  c.wall_ms = clock() - startedAt
  await run.finish(c as unknown as Record<string, unknown>, errors)
  return { ...c, run: run.id, errors }
}

// ---------------------------------------------------------------------------------------------------------
// THE NIGHT QUEUE — HR Step 10 (decision 13). It only queues: the sweep does the checking.
// ---------------------------------------------------------------------------------------------------------

export type QueueReason = 'new_handbook' | 'new_version' | 'scheduled'

/**
 * Why a current, read handbook is due tonight, or null. Pure, so the rule is tested at its edges:
 *   never checked, and not a newer version  → 'new_handbook'
 *   never checked, and a newer version      → 'new_version'
 *   checked, and next_check_at has passed   → 'scheduled'
 * "Checked" means a check that finished DONE; one that failed has not checked it, so it is tried again.
 */
export function dueReason(h: { version_of: string | null; next_check_at: string | null }, everDone: boolean, now: number): QueueReason | null {
  if (!everDone) return h.version_of ? 'new_version' : 'new_handbook'
  return h.next_check_at && Date.parse(h.next_check_at) <= now ? 'scheduled' : null
}

/**
 * EVERY CURRENT, READ HANDBOOK THAT IS DUE, ACROSS COMPANIES (the server's client: this job has no user session).
 * Each gets a check with requested_by EMPTY, so no email is sent (`lib/handbookCheckNotify.ts`). A handbook already
 * being checked is skipped by the database's one-open-check rule (071), read here as createCheck's 'already'.
 */
export async function queueDueChecks(admin: Db, now = Date.now()): Promise<{
  queued: Array<{ handbook: string; reason: QueueReason; check: string }>; skippedOpen: string[]; notDue: number
}> {
  const { data: books, error } = await admin.from('handbooks')
    .select('id, company_id, version_of, next_check_at').eq('is_current', true).eq('status', 'read')
  if (error) throw new Error(`queueDueChecks: ${error.message}`)
  const list = (books ?? []) as Array<{ id: string; company_id: string; version_of: string | null; next_check_at: string | null }>
  const { data: done } = list.length
    ? await admin.from('handbook_checks').select('handbook_id').in('handbook_id', list.map((b) => b.id)).eq('status', 'done')
    : { data: [] }
  const checked = new Set(((done ?? []) as Array<{ handbook_id: string }>).map((d) => d.handbook_id))
  const out = { queued: [] as Array<{ handbook: string; reason: QueueReason; check: string }>, skippedOpen: [] as string[], notDue: 0 }
  for (const b of list) {
    const reason = dueReason(b, checked.has(b.id), now)
    if (!reason) { out.notDue++; continue }
    const made = await createCheck(admin, { companyId: b.company_id, handbookId: b.id, reason, requestedBy: null })
    if (made.ok) out.queued.push({ handbook: b.id, reason, check: made.checkId })
    else if (made.reason === 'already') out.skippedOpen.push(b.id)
  }
  return out
}
