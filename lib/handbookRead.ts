/**
 * READING ONE HANDBOOK — HR Step 5b (`docs/HR-PLAN.md` decisions 12, 18, 28). Started by
 * `app/api/handbooks/route.ts` right after a handbook's row is saved, in `after()`, so it survives the tab
 * closing (CLAUDE.md §3.11). Held by `tests/unit/handbookRead.test.ts` with stand-ins.
 *
 * THE CLAIM IS THE ROW ITSELF (no new column — migration 066's `status` and `updated_at`):
 *   claim   status → 'reading' only where it is 'uploaded' or 'could_not_read', or 'reading' for longer than
 *           CLAIM_LOCK_MS (a run that died). The `updated_at` the trigger stamps is the claim.
 *   save    only where status is still 'reading' AND updated_at is still that claim. Anything else means the
 *           handbook was deleted or another run took over, and this run's sections are taken back out.
 *
 * IN ORDER, everything in memory first, written once at the end:
 *   a. the text, through the same parsers `lib/documentContent.ts` uses (it is not changed): a Word file is
 *      its `parseDocumentToBlocks` HTML; a PDF is officeparser with the same `fileType: 'pdf'` hint, keeping
 *      each page's text, which `documentContent.ts` joins and throws the pages away;
 *   b. no text to speak of → 'could_not_read' (a scan);
 *   c. sections: Word by its headings, in code; a PDF by ONE outline call per part ('hr_check'), cut in code;
 *   d. the coverage proof; a failure is 'could_not_read' with the our-fault words, details in the log;
 *   e. the sections (with the server key — people may only read them, migration 066), then the row.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import officeParser from 'officeparser'
import { parseDocumentToBlocks, extensionOf } from './documentContent.ts'
import { CLAIM_LOCK_MS } from './topicClaim.ts'
import { READ_REASONS } from './handbooks.ts'
import { askAIJson } from './ai.ts'
import { hrOutlinePrompt } from '../prompts/hr-outline.ts'
import {
  cutAtAnchors, wordSections, proveCoverage, pageStarts, joinPages, sectionPages, looksLikeScan,
  outlineParts, sha256, type Anchor, type Section,
} from './handbookSections.ts'

type Db = SupabaseClient<any, any, any>   // eslint-disable-line @typescript-eslint/no-explicit-any

/** One outline call: the part's text in, the sections' titles and first words out. */
export type Outline = (text: string, part: { index: number; count: number; pageFrom: number; pageTo: number }) => Promise<Anchor[]>

/**
 * THE OUTLINE CALL: task 'hr_check', ledger 'hr_check' (the brief), the part's TEXT only. Its reply is
 * checked here — anything that is not a list of {title, anchor} strings is dropped, never trusted.
 */
export function modelOutline(companyId: string): Outline {
  return async (text, part) => {
    // TEST PATH ONLY (never on production): the second part fails, so a reading fails mid-way (Step 6c proof).
    if (process.env.NODE_ENV !== 'production' && process.env.HR_TEST_OUTLINE_FAIL === '1' && part.index === 2) {
      throw new Error('test path: the outline of part 2 failed')
    }
    const reply = await askAIJson<{ sections?: unknown }>(hrOutlinePrompt(part), text,
      { task: 'hr_check', ledger: { companyId, task: 'hr_check' }, maxTokens: 8000 })
    const list = Array.isArray(reply?.sections) ? reply.sections : []
    return list.filter((x): x is Anchor => !!x && typeof (x as Anchor).title === 'string' && typeof (x as Anchor).anchor === 'string')
  }
}

// ---------------------------------------------------------------------------------------------------------
// THE CLAIM
// ---------------------------------------------------------------------------------------------------------

export function readClaimFilter(now: number): string {
  const stale = new Date(now - CLAIM_LOCK_MS).toISOString()
  return `status.in.(uploaded,could_not_read),and(status.eq.reading,updated_at.lt."${stale}")`
}

/** Returns the claim (the row's new updated_at), or null if a reading already holds it. */
export async function claimReading(db: Db, id: string, now = Date.now()): Promise<string | null> {
  const { data, error } = await db.from('handbooks')
    .update({ status: 'reading', status_reason: null, outline_parts_total: null, outline_parts_done: null })
    .eq('id', id).or(readClaimFilter(now))
    .select('updated_at')
  if (error) throw new Error(`claiming the reading: ${error.message}`)
  return data?.length ? (data[0] as { updated_at: string }).updated_at : null
}

// ---------------------------------------------------------------------------------------------------------
// READING, IN MEMORY
// ---------------------------------------------------------------------------------------------------------

export type ReadOutcome =
  | { ok: true; text: string; pageCount: number | null; sections: Array<Section & { page_from: number | null; page_to: number | null }>; dropped: number; parts: number }
  | { ok: false; reason: string; log: string }

interface PdfPage { type: string; text?: string }

/** A PDF's pages, through officeparser with the hint `lib/documentContent.ts` explains (`pdfText`). */
async function pdfPages(buffer: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ast = await (officeParser as any).parseOffice(buffer, { fileType: 'pdf' })
  return ((ast?.content ?? []) as PdfPage[]).filter((n) => n.type === 'page').map((n) => n.text ?? '')
}

/**
 * TEXT FIRST (HR Step 6a): called the moment the text is drawn and is not a scan, BEFORE any section is
 * found, so an answer can use the handbook while its sections are still being found.
 */
export type OnText = (text: string, pageCount: number | null) => Promise<void>
/** HOW FAR THE OUTLINE HAS GOT (Step 6c, migration 070): before the first part, and after each one. */
export type OnProgress = (done: number, total: number) => Promise<void>

export async function readContent(buffer: ArrayBuffer, fileName: string, mimeType: string | null, outline: Outline,
  parsePdf: (b: Buffer) => Promise<string[]> = pdfPages, onText?: OnText, onProgress?: OnProgress): Promise<ReadOutcome> {
  const ext = extensionOf(fileName)
  // .doc is the old binary Word format, which the Word reader cannot open.
  if (ext === 'doc') return { ok: false, reason: READ_REASONS.kind, log: '.doc' }
  const parsed = await parseDocumentToBlocks(buffer, fileName, mimeType)
  if (!parsed.ok || (parsed.kind !== 'pdf' && parsed.kind !== 'word')) {
    return { ok: false, reason: READ_REASONS.kind, log: parsed.ok ? parsed.kind : parsed.failure.reason }
  }

  if (parsed.kind === 'word') {
    const html = parsed.text
    if (!html.replace(/<[^>]*>/g, '').trim()) return { ok: false, reason: READ_REASONS.noPages, log: 'word: no text' }
    await onText?.(html, null)
    const sections = wordSections(html).map((s) => ({ ...s, page_from: null, page_to: null }))
    return { ok: true, text: html, pageCount: null, sections, dropped: 0, parts: 0 }
  }

  const pages = await parsePdf(Buffer.from(buffer))
  if (!pages.length) return { ok: false, reason: READ_REASONS.noPages, log: 'pdf: 0 pages' }
  const text = joinPages(pages)
  if (looksLikeScan(text, pages.length)) return { ok: false, reason: READ_REASONS.scan, log: `pdf: ${pages.length} pages, ${text.trim().length} characters` }
  await onText?.(text, pages.length)

  const parts = outlineParts(pages)
  const anchors: Anchor[] = []
  await onProgress?.(0, parts.length)
  for (let i = 0; i < parts.length; i++) {
    anchors.push(...await outline(parts[i].text, { index: i + 1, count: parts.length, pageFrom: parts[i].from, pageTo: parts[i].to }))
    await onProgress?.(i + 1, parts.length)
  }
  const { sections, dropped } = cutAtAnchors(text, anchors)
  const starts = pageStarts(pages)
  return {
    ok: true, text, pageCount: pages.length, dropped: dropped.length, parts: parts.length,
    sections: sections.map((s) => ({ ...s, ...sectionPages(text, starts, s) })),
  }
}

// ---------------------------------------------------------------------------------------------------------
// THE WHOLE READING, AND THE ONE WRITE
// ---------------------------------------------------------------------------------------------------------

export interface ReadDeps {
  /** The person's own client: the row and the stored file, under RLS. */
  db: Db
  /** The server key, for ONE statement kind only: handbook_sections, which people may only read (066). */
  admin: Db
  bucket: string
  outline: Outline
  parsePdf?: (b: Buffer) => Promise<string[]>
}

/** The claim was taken over while this run read: stop before spending anything more. */
class ClaimLost extends Error {}

export async function readHandbook(deps: ReadDeps, companyId: string, id: string, claimedAtStart: string): Promise<string> {
  const { db, admin } = deps
  // The claim is the row's updated_at, and saving the text moves it (the trigger): the save returns the new one.
  let claimedAt = claimedAtStart
  const giveUp = async (reason: string, log: string) => {
    console.error(`handbooks: could not read ${id}: ${log}`)
    await db.from('handbooks').update({ status: 'could_not_read', status_reason: reason })
      .eq('id', id).eq('status', 'reading').eq('updated_at', claimedAt)
    return `could_not_read: ${log}`
  }
  try {
    const { data: row } = await db.from('handbooks').select('file_path, file_name, mime_type')
      .eq('id', id).eq('company_id', companyId).maybeSingle()
    if (!row) return 'gone'
    const { data: blob, error: dlErr } = await db.storage.from(deps.bucket).download(row.file_path)
    if (dlErr || !blob) return giveUp(READ_REASONS.ours, `download: ${dlErr?.message ?? 'no file'}`)

    // TEXT FIRST: saved while the row stays 'reading', so an answer may use it before the sections exist.
    const saveText: OnText = async (text, pageCount) => {
      const { data, error } = await db.from('handbooks').update({ extracted_text: text, page_count: pageCount })
        .eq('id', id).eq('status', 'reading').eq('updated_at', claimedAt).select('updated_at')
      if (error) throw new Error(`saving the text: ${error.message}`)
      if (!data?.length) throw new ClaimLost()
      claimedAt = (data[0] as { updated_at: string }).updated_at
    }
    // PROGRESS (Step 6c): written under the claim, like the text; each write moves the claim on.
    const saveProgress: OnProgress = async (done, total) => {
      const { data, error } = await db.from('handbooks').update({ outline_parts_done: done, outline_parts_total: total })
        .eq('id', id).eq('status', 'reading').eq('updated_at', claimedAt).select('updated_at')
      if (error) throw new Error(`saving the progress: ${error.message}`)
      if (!data?.length) throw new ClaimLost()
      claimedAt = (data[0] as { updated_at: string }).updated_at
    }
    const out = await readContent(await blob.arrayBuffer(), row.file_name, row.mime_type, deps.outline, deps.parsePdf, saveText, saveProgress)
    if (!out.ok) return giveUp(out.reason, out.log)

    const problem = proveCoverage(out.text, out.sections)
    if (problem) return giveUp(READ_REASONS.ours, `coverage: ${problem}`)

    // The server key, for this table only, scoped to the session's company (CLAUDE.md §3.6): people may read
    // a handbook's sections and never write them (migration 066's grants). A previous reading's go first.
    await admin.from('handbook_sections').delete().eq('handbook_id', id).eq('company_id', companyId)
    const { data: written, error: insErr } = await admin.from('handbook_sections').insert(out.sections.map((s) => ({
      handbook_id: id, company_id: companyId, position: s.position, title: s.title,
      page_from: s.page_from, page_to: s.page_to, text: s.text, text_sha256: sha256(s.text),
    }))).select('id')
    if (insErr) return giveUp(READ_REASONS.ours, `sections: ${insErr.message}`)

    const { data: saved, error: upErr } = await db.from('handbooks').update({
      status: 'read', status_reason: null, extracted_text: out.text, page_count: out.pageCount,
      read_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'reading').eq('updated_at', claimedAt).select('id')
    if (upErr || !saved?.length) {
      // Deleted, or another run took over: this run's sections are not the handbook's.
      await admin.from('handbook_sections').delete().in('id', (written ?? []).map((w: { id: string }) => w.id)).eq('company_id', companyId)
      return upErr ? giveUp(READ_REASONS.ours, `save: ${upErr.message}`) : 'claim lost'
    }
    return `read: ${out.pageCount ?? '—'} pages, ${out.sections.length} sections, ${out.dropped} anchor(s) dropped, ${out.parts} part(s)`
  } catch (e) {
    if (e instanceof ClaimLost) return 'claim lost'
    return giveUp(READ_REASONS.ours, e instanceof Error ? e.message : String(e))
  }
}
