/**
 * THE HANDBOOK CHECK — HR Step 8, part 1 (HR-PLAN decision 2; the owner's answers to the Step 8 design).
 *
 * Each current handbook is checked section by section against the rules for its sites, and the result is rows in
 * 066's tables (with 071's columns). It COPIES Audits' patterns — a claim per unit, a five-minute sweep, a
 * compare-and-set finish — and none of Audits' files: `app/api/jobs/audit-sections/route.ts` and
 * `lib/auditRun.ts` are read and copied here, never edited (decision 2, map B4).
 *
 *   createCheck        a check row and one queued row per section, plus one "not covered" row. One open check
 *                      per handbook is the DATABASE's rule (071's idx_handbook_checks_one_open).
 *   packPieces         neighbouring sections of one check, up to PIECE_CHARS, become one call (the owner); the
 *                      "not covered" row is always a call of its own.
 *   runPiece           one model call, then code checks every quote (`checkQuote`, decision 20), every link
 *                      (`findReturned`, labelled by `labelFor`) and decides the final word itself.
 *   failRows           a failed piece is put back ONCE, then failed with its reason (the owner).
 *   recoverStuck       a crashed claim is put back once, then failed (071's `attempts`).
 *   finishCheckIfDone  done_count as rows land; done, or failed when every row failed; checked_at and
 *                      next_check_at (+90 days) only on done.
 *   sweepChecks        the sweep: recover, then one company at a time, its pieces in order, within the time budget.
 *
 * No Next.js here, so a script and the tests can drive it; the routes are thin wrappers.
 */
import { createHash } from 'node:crypto'
import { askAIWithSearchResults, extractJsonText, modelForTask, type SearchResult } from './ai.ts'
import { buildCompanyContext, siteWhere } from './companyContext.ts'
import { checkQuote, type Block, type HandbookUsed } from './hrAnswer.ts'
import { findReturned, labelFor, stripMarkers } from './howTo.ts'
import { lazyJobRun } from './jobRun.ts'
import { PAGE_BREAK } from './handbookSections.ts'
import { hrCheckPrompt, hrCheckMessage } from '../prompts/hr-check.ts'
import { hrNotCoveredPrompt, hrNotCoveredMessage } from '../prompts/hr-not-covered.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

/** Neighbouring sections up to this many characters go in one call (the owner, Step 8). */
export const PIECE_CHARS = 40_000
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

export type Word = 'needs_change' | 'no_gap' | 'to_confirm' | 'company_choice'
const WORDS: readonly Word[] = ['needs_change', 'no_gap', 'to_confirm', 'company_choice']

export interface CheckSource { url: string; title: string; official: boolean }
export interface ShapedFinding {
  kind: 'change' | 'to_confirm' | 'not_covered'
  title: string
  why: string | null
  what_to_change: string | null
  handbook_quote: string | null
  quote_verified: boolean | null
  page: number | null
  sources: CheckSource[]
  /** Set when code moved it: what the model said, and why it is not that. Logged and reported, never shown. */
  moved?: string
}
export interface ShapedDate { title: string; due_date: string | null; recurs: boolean; quote: string; page: number | null }
export interface ShapedSection {
  id: string                // "S3"
  modelWord: string | null
  word: Word
  findings: ShapedFinding[]
  dates: ShapedDate[]
  droppedDates: number
  droppedLinks: number
  failedQuotes: number
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

// ---------------------------------------------------------------------------------------------------------
// PACKING
// ---------------------------------------------------------------------------------------------------------

export interface PackRow { id: string; checkId: string; kind: 'section' | 'not_covered'; position: number; chars: number }

/**
 * NEIGHBOURS, UP TO A SIZE. Rows of one check, in position order, go together while the total stays within `cap`
 * and the positions are consecutive (a section retried alone is not glued to a stranger). A section longer than
 * the cap is a piece of its own. The "not covered" row is always alone, after the check's sections. Checks keep
 * the order they are given in.
 */
export function packPieces(rows: PackRow[], cap = PIECE_CHARS): PackRow[][] {
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
// WHAT CODE DOES WITH A PIECE'S ANSWER
// ---------------------------------------------------------------------------------------------------------

/** The link: kept only when THIS call's search returned it, labelled official or other (`lib/howTo.ts`). */
function checkedLink(url: string, searched: SearchResult[]): CheckSource | null {
  const hit = url ? findReturned(url, searched) : undefined
  return hit ? { url: hit.url, title: hit.title || hit.url, official: labelFor(hit.url) === 'official' } : null
}

/**
 * THE FINAL WORD IS CODE'S (the owner). "needs_change" only with at least one change that has a checked link; a
 * change without one becomes a question, and a section the model called needs_change with none left becomes
 * to_confirm — never no_gap, because unknown never resolves to clear (§3.2). A section with open questions is
 * to_confirm whatever the model called it. An unknown word is to_confirm.
 */
export function decideWord(modelWord: string | null, findings: ShapedFinding[]): { word: Word; findings: ShapedFinding[] } {
  const out = findings.map((f) => (f.kind === 'change' && f.sources.length === 0
    ? { ...f, kind: 'to_confirm' as const, moved: 'change → to_confirm: no checked link' }
    : f))
  if (out.some((f) => f.kind === 'change')) return { word: 'needs_change', findings: out }
  if (out.length) return { word: 'to_confirm', findings: out }
  if (modelWord === 'no_gap' || modelWord === 'company_choice') return { word: modelWord, findings: out }
  return { word: 'to_confirm', findings: out }
}

/**
 * One piece's answer, checked. `blocks` are the piece's sections (ids "S<n>"); a quote is found only in them
 * (`checkQuote`, decision 20: six words or more, letters and digits only). A failed quote is stored flagged and
 * never shown (decision 4). A date is kept only when its quote checks (the owner).
 */
export function shapePiece(raw: unknown, blocks: Block[], used: HandbookUsed[], searched: SearchResult[]):
  { ok: true; sections: ShapedSection[]; missing: string[] } | { ok: false; error: string } {
  if (!isObj(raw) || !Array.isArray(raw.sections)) return { ok: false, error: 'the answer has no "sections" list' }
  const byId = new Map<string, Record<string, unknown>>()
  for (const s of raw.sections as unknown[]) if (isObj(s) && str(s.id)) byId.set(str(s.id).toUpperCase(), s)
  const sections: ShapedSection[] = []
  const missing: string[] = []
  for (const b of blocks) {
    const s = byId.get(b.id.toUpperCase())
    if (!s) { missing.push(b.id); continue }
    let droppedLinks = 0, failedQuotes = 0, droppedDates = 0
    const findings: ShapedFinding[] = []
    for (const f of (Array.isArray(s.findings) ? s.findings : []) as unknown[]) {
      if (!isObj(f) || !str(f.title)) continue
      const quote = str(f.quote)
      const hit = quote ? checkQuote(quote, b.id, [b], used) : null
      if (quote && !hit) failedQuotes++
      const link = checkedLink(str(f.url), searched)
      if (str(f.url) && !link) droppedLinks++
      findings.push({
        kind: str(f.kind) === 'change' ? 'change' : 'to_confirm',
        title: str(f.title), why: str(f.why) || null, what_to_change: str(f.what_to_change) || null,
        handbook_quote: quote || null, quote_verified: quote ? !!hit : null, page: hit?.page ?? null,
        sources: link ? [link] : [],
      })
    }
    const dates: ShapedDate[] = []
    for (const d of (Array.isArray(s.dates) ? s.dates : []) as unknown[]) {
      if (!isObj(d) || !str(d.title)) continue
      const quote = str(d.quote)
      const hit = quote ? checkQuote(quote, b.id, [b], used) : null
      if (!hit) { droppedDates++; continue }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(d.date)) && !Number.isNaN(Date.parse(str(d.date))) ? str(d.date) : null
      dates.push({ title: str(d.title), due_date: date, recurs: d.repeats === true, quote, page: hit.page })
    }
    const modelWord = str(s.word) || null
    const decided = decideWord(WORDS.includes(modelWord as Word) ? modelWord : null, findings)
    sections.push({ id: b.id, modelWord, word: decided.word, findings: decided.findings, dates, droppedDates, droppedLinks, failedQuotes })
  }
  return { ok: true, sections, missing }
}

/**
 * THE "NOT COVERED" ANSWER, CHECKED. An item counts as not covered only with an OFFICIAL link this call's search
 * returned; anything else goes to "Still to confirm", with why (the owner). Questions keep a link only when
 * the search returned it.
 */
export function shapeNotCovered(raw: unknown, searched: SearchResult[]):
  { ok: true; findings: ShapedFinding[] } | { ok: false; error: string } {
  if (!isObj(raw) || (!Array.isArray(raw.not_covered) && !Array.isArray(raw.to_confirm))) {
    return { ok: false, error: 'the answer has neither a "not_covered" nor a "to_confirm" list' }
  }
  const findings: ShapedFinding[] = []
  for (const n of (Array.isArray(raw.not_covered) ? raw.not_covered : []) as unknown[]) {
    if (!isObj(n) || !str(n.title)) continue
    const link = checkedLink(str(n.url), searched)
    const base = { title: str(n.title), why: str(n.why) || null, what_to_change: str(n.what_to_add) || null,
      handbook_quote: null, quote_verified: null, page: null, sources: link ? [link] : [] }
    if (link?.official) findings.push({ kind: 'not_covered', ...base })
    else findings.push({ kind: 'to_confirm', ...base,
      moved: `not_covered → to_confirm: ${!str(n.url) ? 'no link given' : link ? 'its link is not an official page' : "its link did not come from this call's search"}` })
  }
  for (const q of (Array.isArray(raw.to_confirm) ? raw.to_confirm : []) as unknown[]) {
    if (!isObj(q) || !str(q.title)) continue
    const link = checkedLink(str(q.url), searched)
    findings.push({ kind: 'to_confirm', title: str(q.title), why: str(q.why) || null,
      what_to_change: str(q.what_would_settle_it) || null, handbook_quote: null, quote_verified: null, page: null,
      sources: link ? [link] : [] })
  }
  return { ok: true, findings }
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
  const rows = [
    ...secs.map((s: { id: string }) => ({ check_id: check.id, company_id: args.companyId, kind: 'section', section_id: s.id })),
    { check_id: check.id, company_id: args.companyId, kind: 'not_covered', section_id: null },
  ]
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

export type Ask = typeof askAIWithSearchResults

export interface PieceResult {
  status: 'done' | 'failed' | 'retry' | 'skipped' | 'cancelled' | 'gone'
  rows: number
  findings?: number
  dates?: number
  moved?: string[]
  aiCallId?: string | null
  reason?: string
}

interface SectionRow { id: string; position: number; title: string | null; page_from: number | null; page_to: number | null; text: string }

const pagesOf = (a: number | null, b: number | null) => (a == null ? '' : a === b || b == null ? ` (page ${a})` : ` (pages ${a}–${b})`)

/** What a handbook covers, in words for the model: every site, or one site, each with where it is. */
async function coversWords(admin: Db, companyId: string, hb: { scope: string; entity_id: string | null }): Promise<string> {
  const { data: sites } = await admin.from('entities').select('id, name, address, city, county, state').eq('company_id', companyId)
  const line = (s: { name: string; address: string | null; city: string | null; county: string | null; state: string | null }) =>
    `${s.name}${siteWhere(s) ? ` (${siteWhere(s)})` : ''}`
  const all = (sites ?? []) as Array<{ id: string; name: string; address: string | null; city: string | null; county: string | null; state: string | null }>
  if (hb.scope === 'site') {
    const one = all.find((s) => s.id === hb.entity_id)
    return one ? `one site: ${line(one)}` : 'one site that is no longer on file'
  }
  return all.length ? `every site: ${all.map(line).join('; ')}` : 'every site'
}

/**
 * ONE PIECE: re-read before the call (a deleted handbook stops here, a replaced one cancels its check), mark the
 * rows started, one model call with web search, then code checks the answer and writes the rows. `ask` is the
 * real call unless a script passes another (the forced-failure proof).
 */
export async function runPiece(admin: Db, rowIds: string[], opts: { ask?: Ask; today?: string } = {}): Promise<PieceResult> {
  const ask = opts.ask ?? askAIWithSearchResults
  const { data: rowsRaw } = await admin.from('handbook_check_sections')
    .select('id, check_id, company_id, kind, section_id, status, attempts').in('id', rowIds)
  const rows = ((rowsRaw ?? []) as Array<{ id: string; check_id: string; company_id: string; kind: string; section_id: string | null; status: string; attempts: number }>)
    .filter((r) => r.status === 'queued')
  if (!rows.length) return { status: rowsRaw?.length ? 'skipped' : 'gone', rows: 0 }
  const checkId = rows[0].check_id
  const companyId = rows[0].company_id

  const live = async () => {
    const { data: check } = await admin.from('handbook_checks').select('id, handbook_id, status').eq('id', checkId).maybeSingle()
    if (!check) return { gone: true as const }
    const { data: hb } = await admin.from('handbooks')
      .select('id, name, scope, entity_id, is_current, mime_type').eq('id', check.handbook_id).maybeSingle()
    if (!hb) return { gone: true as const }
    return { gone: false as const, check, hb }
  }
  const before = await live()
  if (before.gone) return { status: 'gone', rows: 0 }
  if (!['queued', 'checking'].includes(before.check.status)) return { status: 'skipped', rows: 0 }
  if (!before.hb.is_current) { await cancelCheck(admin, checkId, REASONS.replaced); return { status: 'cancelled', rows: rows.length } }
  const hb = before.hb

  // ---- the input ----
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const company = (await buildCompanyContext(admin, companyId, { parts: ['company', 'declared', 'confirmed'] })).block
  const isNotCovered = rows[0].kind === 'not_covered'
  let system: string, message: string
  let blocks: Block[] = []
  let used: HandbookUsed[] = []
  const tocOf = (secs: SectionRow[]) => secs.map((s) => `[S${s.position + 1}] ${s.title || '(untitled)'}${pagesOf(s.page_from, s.page_to)}`).join('\n')
  if (isNotCovered) {
    // Every current, read handbook covering the same sites: the company-wide ones, and for a site handbook its site's.
    const { data: books } = await admin.from('handbooks').select('id, name, scope, entity_id')
      .eq('company_id', companyId).eq('is_current', true).eq('status', 'read').order('created_at')
    const same = ((books ?? []) as Array<{ id: string; name: string; scope: string; entity_id: string | null }>)
      .filter((b) => hb.scope !== 'site' || b.scope === 'company' || b.entity_id === hb.entity_id)
    const parts: string[] = []
    for (const b of same) {
      const { data: secs } = await admin.from('handbook_sections').select('id, position, title, page_from, page_to, text')
        .eq('handbook_id', b.id).order('position')
      parts.push(`Handbook "${b.name}" (covering ${await coversWords(admin, companyId, b)}):\n${tocOf((secs ?? []) as SectionRow[])}`)
    }
    system = hrNotCoveredPrompt(today)
    message = hrNotCoveredMessage({ company, handbooks: parts.join('\n\n') })
  } else {
    const { data: secsRaw } = await admin.from('handbook_sections').select('id, position, title, page_from, page_to, text')
      .eq('handbook_id', hb.id).order('position')
    const secs = (secsRaw ?? []) as SectionRow[]
    const mine = secs.filter((s) => rows.some((r) => r.section_id === s.id))
    const applies = await coversWords(admin, companyId, hb)
    const isWord = /wordprocessingml|msword/.test(hb.mime_type ?? '')
    blocks = mine.map((s) => ({ id: `S${s.position + 1}`, handbookId: hb.id, handbookName: hb.name, applies, sectionId: s.id,
      title: s.title ?? '', pageFrom: s.page_from, pageTo: s.page_to, stored: s.text }))
    // `text` is empty on purpose: a quote is found only in this piece's sections, never anywhere in the handbook.
    used = [{ id: hb.id, name: hb.name, pages: null, text: '', isWord }]
    system = hrCheckPrompt(today)
    message = hrCheckMessage({
      company, handbook: hb.name, covers: applies, contents: tocOf(secs),
      sections: mine.map((s) => `[S${s.position + 1}] ${s.title || '(untitled)'}${pagesOf(s.page_from, s.page_to)}\n${s.text.split(PAGE_BREAK).join('\n')}`).join('\n\n'),
    })
  }

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
  let text = ''
  let searched: SearchResult[] = []
  try {
    const res = await ask(system, message, { maxTokens: PIECE_MAX_TOKENS, task: 'hr_check', enableWebSearch: true, ledger: { companyId, task: 'hr_check' } })
    text = res.answer.text ?? ''
    searched = res.searched
  } catch (e) {
    const reason = `The call failed: ${e instanceof Error ? e.message : String(e)}`
    const f = await failRows(admin, rows, reason)
    return { status: f.failed ? 'failed' : 'retry', rows: rows.length, reason }
  }

  // The ledger row, found by time and polled, as `lib/auditRun.ts` does: recordAICall is not awaited.
  let aiCallId: string | null = null
  for (let i = 0; i < 5 && !aiCallId; i++) {
    if (i) await new Promise((r) => setTimeout(r, 250))
    const { data: call } = await admin.from('ai_calls').select('id').eq('company_id', companyId).eq('task', 'hr_check')
      .gte('created_at', startedAt).order('created_at', { ascending: false }).limit(1).maybeSingle()
    aiCallId = call?.id ?? null
  }
  const receipt = { model, prompt_sha256: sha(system), input_sha256: sha(message), ai_call_id: aiCallId }

  let parsed: unknown = null
  try { parsed = JSON.parse(extractJsonText(stripMarkers(text))) } catch { parsed = null }
  const bad = async (why: string) => {
    const reason = `${why}. The answer began: ${text.slice(0, 1500)}`
    // Logged on every failure, not only the last: a row put back for a retry may not carry a reason (071), and a
    // bad answer must be diagnosable from what it said (CLAUDE.md §5).
    console.error(`handbook check ${checkId}: ${why}; the answer began: ${text.slice(0, 3000)}`)
    await admin.from('handbook_check_sections').update(receipt).in('id', rows.map((r) => r.id))
    const f = await failRows(admin, rows, reason)
    return { status: f.failed ? 'failed' as const : 'retry' as const, rows: rows.length, aiCallId, reason: why }
  }
  if (parsed === null) return bad('The answer did not parse')

  const finishedAt = () => new Date().toISOString()
  try {
    if (isNotCovered) {
      const shaped = shapeNotCovered(parsed, searched)
      if (!shaped.ok) return bad(shaped.error)
      const row = rows[0]
      if (shaped.findings.length) {
        const { error } = await admin.from('handbook_findings').insert(shaped.findings.map((f) => ({
          check_id: checkId, check_section_id: row.id, company_id: companyId, kind: f.kind, title: f.title, why: f.why,
          what_to_change: f.what_to_change, handbook_quote: null, quote_verified: null, page: null, sources: f.sources,
        })))
        if (error) throw new Error(error.message)
      }
      await admin.from('handbook_check_sections').update({ ...receipt, status: 'done', claimed_at: null, finished_at: finishedAt() }).eq('id', row.id)
      for (const f of shaped.findings) if (f.moved) console.log(`handbook check ${checkId} not covered "${f.title}": ${f.moved}`)
      return { status: 'done', rows: 1, findings: shaped.findings.length, dates: 0, aiCallId,
        moved: shaped.findings.filter((f) => f.moved).map((f) => `"${f.title}": ${f.moved}`) }
    }

    const shaped = shapePiece(parsed, blocks, used, searched)
    if (!shaped.ok) return bad(shaped.error)
    const rowOf = (id: string) => rows.find((r) => blocks.find((b) => b.id === id)?.sectionId === r.section_id)!
    let findings = 0, dates = 0
    const moved: string[] = []
    for (const s of shaped.sections) {
      const row = rowOf(s.id)
      if (s.findings.length) {
        const { error } = await admin.from('handbook_findings').insert(s.findings.map((f) => ({
          check_id: checkId, check_section_id: row.id, company_id: companyId, kind: f.kind, title: f.title, why: f.why,
          what_to_change: f.what_to_change, handbook_quote: f.handbook_quote, quote_verified: f.quote_verified, page: f.page,
          sources: f.sources,
        })))
        if (error) throw new Error(error.message)
      }
      if (s.dates.length) {
        const { error } = await admin.from('handbook_dates').insert(s.dates.map((d) => ({
          handbook_id: hb.id, company_id: companyId, check_id: checkId, title: d.title, due_date: d.due_date, recurs: d.recurs,
          quote: d.quote, quote_verified: true, source: 'handbook', source_url: null,
        })))
        if (error) throw new Error(error.message)
      }
      await admin.from('handbook_check_sections').update({ ...receipt, status: 'done', word: s.word, claimed_at: null, finished_at: finishedAt() }).eq('id', row.id)
      findings += s.findings.length; dates += s.dates.length
      if (s.modelWord !== s.word) moved.push(`${s.id}: the model said ${s.modelWord ?? '(nothing)'}, code says ${s.word}`)
      for (const f of s.findings) if (f.moved) moved.push(`${s.id} "${f.title}": ${f.moved}`)
    }
    // A section the answer left out is a failure of that row alone: retried once, then failed.
    const left = shaped.missing.map(rowOf)
    if (left.length) {
      await admin.from('handbook_check_sections').update(receipt).in('id', left.map((r) => r.id))
      await failRows(admin, left, REASONS.leftOut)
    }
    if (moved.length) console.log(`handbook check ${checkId}: ${moved.join(' · ')}`)
    return { status: 'done', rows: rows.length, findings, dates, aiCallId, moved }
  } catch (e) {
    // A write refused (a handbook deleted during the call cascades its rows away): the rows that are left fail.
    return bad(`The answer could not be saved: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ---------------------------------------------------------------------------------------------------------
// THE SWEEP
// ---------------------------------------------------------------------------------------------------------

export interface SweepCounts {
  companies: number; pieces: number; rows_done: number; retried: number; failed: number; cancelled: number; gone: number
  recovered: { putBack: number; failed: number; released: number }; checks_finished: number
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
    recovered: { putBack: 0, failed: 0, released: 0 }, checks_finished: 0, stopped_for_time: false, wall_ms: 0 }
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
            console.log(`handbook sweep: piece of ${ids.length} row(s) [${piece.map((p) => p.kind === 'section' ? `S${p.position + 1}` : 'not covered').join(' ')}] → ${r.status}`
              + `${r.findings != null ? `, ${r.findings} finding(s), ${r.dates} date(s)` : ''}${r.reason ? ` (${r.reason})` : ''}`)
          } catch (e) {
            c.failed += piece.length
            errors.push({ piece: ids.join(','), error: e instanceof Error ? e.message : String(e) })
          }
          const fin = await finishCheckIfDone(admin, piece[0].checkId)
          if (fin.finished) c.checks_finished++
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
