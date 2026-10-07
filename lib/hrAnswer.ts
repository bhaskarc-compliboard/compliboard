/**
 * THE HR ANSWER'S MACHINERY — HR Step 6a (`docs/HR-PLAN.md` decisions 3, 4, 10, 12, 20; the Step 6 design).
 * Called by `app/api/hr/answer/route.ts`; held by `tests/unit/hrAnswer.test.ts`. Server-side.
 *
 *   loadHandbooksForAnswer  the company's CURRENT handbooks that have text: read ones as their sections, ones
 *                           whose sections are not found yet as one block per page (text first, 6a); the
 *                           budget; the refusals; one line naming any handbook not used and why.
 *   finishAnswer            AT DONE, ON THE SERVER: every [H…: "…"] checked by the shared quote rule with a
 *                           6-word floor, every web citation checked against what this answer's search
 *                           returned; both numbered together by first appearance; the failures counted.
 *   appendHandbookSources   history for a follow-up: each source behind its marker, handbook quotes included.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Source, CitedPassage } from './ai.ts'
import { normaliseForQuote } from './documentScan.ts'
import { findReturned, labelFor } from './howTo.ts'
import { splitPages, plainText, PAGE_BREAK } from './handbookSections.ts'
import { HR_REFUSALS, overBudgetLine, QUOTE_REMOVED } from './hrAnswerWords.ts'

type Db = SupabaseClient<any, any, any>   // eslint-disable-line @typescript-eslint/no-explicit-any

/** Measured from the 7 real `hr_check` calls (Step 6 design, point 6): tokens ≈ 0.273 × characters. */
export const TOKENS_PER_CHAR = 0.273
export const QUOTE_MIN_WORDS = 6
export function budgetTokens(): number {
  const n = Number(process.env.HR_HANDBOOK_BUDGET_TOKENS)
  return Number.isFinite(n) && n > 0 ? n : 50_000
}

// ---------------------------------------------------------------------------------------------------------
// THE LOADER
// ---------------------------------------------------------------------------------------------------------

/** One block the model is given, and what the code needs to check a quote against it. */
export interface Block {
  id: string                 // "H12"
  handbookId: string
  handbookName: string
  applies: string            // "Every site" or the site's name
  sectionId: string | null   // null for a page block (sections not found yet)
  title: string              // the section's title, or "page N"
  pageFrom: number | null
  pageTo: number | null
  /** As stored: what a quote is checked against (and, for a PDF stored since 6a, holds the page breaks). */
  stored: string
}

export interface HandbookUsed { id: string; name: string; pages: number | null; text: string; isWord: boolean }

export type Loaded =
  | { ok: true; blocks: Block[]; used: HandbookUsed[]; notUsed: string[]; overBudget: string[] }
  | { ok: false; refusal: string; overBudget?: string[] }

interface HandbookRowForAnswer {
  id: string; name: string; scope: string; entity_id: string | null; status: string; status_reason: string | null
  extracted_text: string | null; page_count: number | null; created_at: string
}

export async function loadHandbooksForAnswer(db: Db, companyId: string, budget = budgetTokens()): Promise<Loaded> {
  const { data: rows, error } = await db.from('handbooks')
    .select('id, name, scope, entity_id, status, status_reason, extracted_text, page_count, created_at')
    .eq('company_id', companyId).eq('is_current', true).order('created_at')
  if (error) throw new Error(`loading handbooks: ${error.message}`)
  const current = (rows ?? []) as HandbookRowForAnswer[]
  if (!current.length) return { ok: false, refusal: HR_REFUSALS.none }

  const { data: sites } = await db.from('entities').select('id, name').eq('company_id', companyId)
  const siteName = new Map(((sites ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]))
  const applies = (h: HandbookRowForAnswer) => h.scope === 'company' ? 'Every site'
    : (h.entity_id && siteName.get(h.entity_id)) || 'a site that was removed'

  const withText = current.filter((h) => h.extracted_text && (h.status === 'read' || h.status === 'reading'))
  const notUsed = current.filter((h) => !withText.includes(h)).map((h) =>
    h.status === 'could_not_read' ? `"${h.name}" (could not be read: ${h.status_reason ?? 'no reason recorded'})`
      : `"${h.name}" (still being read)`)
  if (!withText.length) {
    const waiting = current.some((h) => h.status === 'uploaded' || h.status === 'reading')
    return { ok: false, refusal: waiting ? HR_REFUSALS.reading : HR_REFUSALS.unreadable }
  }

  const blocks: Block[] = []
  const used: HandbookUsed[] = []
  const overBudget: string[] = []
  let spent = 0
  for (const h of withText) {
    const text = h.extracted_text as string
    const isWord = h.page_count == null
    const mine: Omit<Block, 'id'>[] = []
    if (h.status === 'read') {
      const { data: secs } = await db.from('handbook_sections').select('id, position, title, page_from, page_to, text')
        .eq('handbook_id', h.id).order('position')
      for (const s of (secs ?? []) as Array<{ id: string; title: string | null; page_from: number | null; page_to: number | null; text: string }>) {
        mine.push({ handbookId: h.id, handbookName: h.name, applies: applies(h), sectionId: s.id, title: s.title ?? h.name,
          pageFrom: s.page_from, pageTo: s.page_to, stored: s.text })
      }
    } else {
      // TEXT FIRST: the sections are not found yet. A PDF stored since 6a splits back into its pages.
      const pages = isWord ? null : splitPages(text)
      if (pages) pages.forEach((p, i) => mine.push({ handbookId: h.id, handbookName: h.name, applies: applies(h),
        sectionId: null, title: `page ${i + 1}`, pageFrom: i + 1, pageTo: i + 1, stored: p }))
      else mine.push({ handbookId: h.id, handbookName: h.name, applies: applies(h), sectionId: null, title: h.name,
        pageFrom: null, pageTo: null, stored: text })
    }
    const cost = Math.ceil(mine.reduce((n, b) => n + sendable(b.stored, isWord).length, 0) * TOKENS_PER_CHAR)
    if (spent + cost > budget) { overBudget.push(h.name); continue }
    spent += cost
    for (const b of mine) blocks.push({ ...b, id: `H${blocks.length + 1}` })
    used.push({ id: h.id, name: h.name, pages: h.page_count, text, isWord })
  }
  // Every handbook with text is over the budget: nothing to send, and the temporary line says why.
  if (!blocks.length) return { ok: false, refusal: overBudget.map(overBudgetLine).join(' '), overBudget }
  return { ok: true, blocks, used, notUsed, overBudget }
}

/** What the model is sent of a block: a Word file's HTML as plain text, a page break as a newline. */
const sendable = (stored: string, isWord: boolean) => (isWord ? plainText(stored) : stored.split(PAGE_BREAK).join('\n'))

const attr = (s: string) => s.replace(/"/g, "'")
export function handbookContext(loaded: Extract<Loaded, { ok: true }>): string {
  const isWord = new Map(loaded.used.map((u) => [u.id, u.isWord]))
  const out = loaded.blocks.map((b) => {
    const pages = b.pageFrom == null ? '' : b.pageTo && b.pageTo !== b.pageFrom ? ` pages="${b.pageFrom}-${b.pageTo}"` : ` pages="${b.pageFrom}"`
    return `<section id="${b.id}" handbook="${attr(b.handbookName)}" applies="${attr(b.applies)}" title="${attr(b.title)}"${pages}>\n`
      + `${sendable(b.stored, isWord.get(b.handbookId) ?? false)}\n</section>`
  })
  const notes = [
    loaded.notUsed.length ? `Not included, so not read for this answer: ${loaded.notUsed.join('; ')}.` : '',
    loaded.overBudget.length ? `Not included because it is too long to send whole: ${loaded.overBudget.map((n) => `"${n}"`).join(', ')}.` : '',
  ].filter(Boolean)
  return [...out, ...notes].join('\n\n')
}

// ---------------------------------------------------------------------------------------------------------
// THE QUOTE CHECK — the shared rule (`normaliseForQuote`, decisions 4 and 20) plus a 6-word floor
// ---------------------------------------------------------------------------------------------------------

/**
 * Where a normalised quote starts in the RAW text, so its page can be counted. Walks the text by the same
 * rule as `normaliseForQuote` (a tag out, letters and digits kept, lower case) and keeps each kept
 * character's raw position; `tests/unit/hrAnswer.test.ts` holds the two equal.
 */
export function normalisedWithMap(raw: string): { norm: string; at: number[] } {
  let norm = ''
  const at: number[] = []
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '<') { const close = raw.indexOf('>', i); if (close !== -1) { i = close; continue } }
    const l = c.toLowerCase()
    if (/[a-z0-9]/.test(l) && l.length === 1) { norm += l; at.push(i) }
  }
  return { norm, at }
}

export interface QuoteHit { block: Block | null; handbook: HandbookUsed; page: number | null }

/** The page a raw position falls on, from the page breaks stored since 6a; null for older or Word text. */
function pageIn(raw: string, rawAt: number, firstPage: number | null): number | null {
  if (firstPage == null || !raw.includes(PAGE_BREAK)) return null
  let n = 0
  for (let i = raw.indexOf(PAGE_BREAK); i !== -1 && i < rawAt; i = raw.indexOf(PAGE_BREAK, i + 1)) n++
  return firstPage + n
}

/** Claimed block first, then every block given, then each whole handbook (a quote across a page break). */
export function checkQuote(quote: string, claimedId: string, blocks: Block[], used: HandbookUsed[]): QuoteHit | null {
  if (quote.trim().split(/\s+/).filter(Boolean).length < QUOTE_MIN_WORDS) return null
  const q = normaliseForQuote(quote)
  if (q.length < 8) return null
  const claimed = blocks.find((b) => b.id === claimedId)
  for (const b of [...(claimed ? [claimed] : []), ...blocks.filter((x) => x !== claimed)]) {
    const m = normalisedWithMap(b.stored)
    const k = m.norm.indexOf(q)
    if (k === -1) continue
    const handbook = used.find((u) => u.id === b.handbookId)!
    return { block: b, handbook, page: pageIn(b.stored, m.at[k], b.pageFrom) ?? (b.pageFrom === b.pageTo ? b.pageFrom : null) }
  }
  for (const u of used) {
    const m = normalisedWithMap(u.text)
    const k = m.norm.indexOf(q)
    if (k !== -1) return { block: null, handbook: u, page: pageIn(u.text, m.at[k], u.isWord ? null : 1) }
  }
  return null
}

// ---------------------------------------------------------------------------------------------------------
// AT DONE: check, number, count
// ---------------------------------------------------------------------------------------------------------

export interface HrWebSource { n: number; kind: 'web'; title: string; url: string; label: 'official' | 'other' }
export interface HrHandbookSource {
  n: number; kind: 'handbook'; title: string; url: ''; label: 'your handbook'
  handbook_id: string; section_id: string | null; handbook_name: string; section_title: string | null
  page_from: number | null; page_to: number | null; quote: string
}
export type HrSource = HrWebSource | HrHandbookSource

/** "Employee Handbook 2024 — 7.2 Sick leave, page 14"; a page block or Word file says only what it has. */
export function handbookCardTitle(hit: QuoteHit): { title: string; section_title: string | null; page_from: number | null; page_to: number | null } {
  const b = hit.block
  const section = b && b.sectionId ? b.title : null
  const pf = hit.page ?? b?.pageFrom ?? null
  const pt = hit.page ?? b?.pageTo ?? null
  const pages = pf == null ? '' : pt != null && pt !== pf ? `pages ${pf}–${pt}` : `page ${pf}`
  const tail = [section, pages].filter(Boolean).join(', ')
  return { title: tail ? `${hit.handbook.name} — ${tail}` : hit.handbook.name, section_title: section, page_from: pf, page_to: pt }
}

const MARKER = /\[(\d{1,2})\]|\s?\[H(\d+)(?::\s*["“]([^"”\]]*)["”])?\]/g
const HMARKER = /\[H\d+(?::\s*["“][^"”\]]*["”])?\]/g
/** A passage in quotation marks, straight or curly, on one line. */
const PLAIN_QUOTE = /["“]([^"”\n]{1,800}?)["”]/g
/**
 * PLAIN QUOTES ARE JUDGED BY WHERE THEIR WORDS ARE FOUND (owner, 6a answers). Every passage in quotation marks
 * of six or more words, outside a [H…] marker:
 *   · in a handbook block this answer was given → turned into a marker, so the marker pass below numbers it,
 *     shows it inline and gives it a card, exactly as a marked quote;
 *   · in the passage behind one of this answer's own web citations (`cited`, `lib/ai.ts` citedPassages) → the
 *     web page's words: kept, and tied to that citation (its [n] put straight after it if it is not already);
 *   · in neither → never shown as anybody's words: replaced by QUOTE_REMOVED and counted.
 * Where the citation sits in the sentence decides nothing: "Your handbook says '…', but the law says ….[2]"
 * must not let a false handbook quote through. Shorter passages are left alone (a phrase is not a quotation).
 *
 * The count is split as the owner set it: with no web passage to check against, a failed plain quote failed
 * only the handbook check and joins the handbook line; with passages, it failed both and is "unchecked".
 */
export function checkPlainQuotes(text: string, blocks: Block[], used: HandbookUsed[], cited: Source[] = [], passages: CitedPassage[] = []):
    { text: string; handbookFailed: number; unchecked: number } {
  const kept: string[] = []
  const masked = text.replace(HMARKER, (m) => { kept.push(m); return `\u0000${kept.length - 1}\u0000` })
  let handbookFailed = 0
  let unchecked = 0
  const nOf = (url: string) => cited.find((s) => s.url === url)?.n
  const out = masked.replace(PLAIN_QUOTE, (whole: string, inner: string, at: number, all: string) => {
    if (inner.trim().split(/\s+/).filter(Boolean).length < 6) return whole
    const hit = checkQuote(inner, '', blocks, used)
    if (hit) return `[${hit.block?.id ?? 'H0'}: "${inner.trim()}"]`
    const q = normaliseForQuote(inner)
    const web = passages.find((p) => normaliseForQuote(p.citedText).includes(q))
    const n = web ? nOf(web.url) : undefined
    if (n) {
      const after = all.slice(at + whole.length)
      return new RegExp(`^[.,;:!?)]*\\s*\\[${n}\\]`).test(after) ? whole : `${whole}[${n}]`
    }
    if (passages.length) unchecked++
    else handbookFailed++
    return QUOTE_REMOVED
  })
  return { text: out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]), handbookFailed, unchecked }
}

export function finishAnswer(text: string, cited: Source[], searched: Array<{ url: string; title: string }>,
  blocks: Block[], used: HandbookUsed[], passages: CitedPassage[] = []):
    { text: string; sources: HrSource[]; droppedQuotes: number; droppedLinks: number; uncheckedQuotes: number } {
  const plain = checkPlainQuotes(text, blocks, used, cited, passages)
  text = plain.text
  const sources: HrSource[] = []
  const webNew = new Map<number, number | null>()        // old web n → new n (null: dropped)
  const quoteNew = new Map<string, number>()              // handbook quote key → new n
  let droppedQuotes = 0
  let droppedLinks = 0
  const byOld = new Map(cited.map((s) => [s.n, s]))

  const out = text.replace(MARKER, (whole, webN: string | undefined, hId: string | undefined, quote: string | undefined) => {
    if (webN) {
      const old = Number(webN)
      if (!webNew.has(old)) {
        const s = byOld.get(old)
        const hit = s ? findReturned(s.url, searched) : undefined
        if (!s || !hit) { webNew.set(old, null); droppedLinks++ }
        else { const n = sources.length + 1; webNew.set(old, n); sources.push({ n, kind: 'web', title: s.title, url: s.url, label: labelFor(s.url) }) }
      }
      const n = webNew.get(old)
      return n == null ? '' : `[${n}]`
    }
    const hit = quote ? checkQuote(quote, `H${hId}`, blocks, used) : null
    if (!hit) { droppedQuotes++; return '' }
    const key = `${hit.handbook.id}|${normaliseForQuote(quote!)}`
    let n = quoteNew.get(key)
    if (!n) {
      n = sources.length + 1
      quoteNew.set(key, n)
      const t = handbookCardTitle(hit)
      sources.push({ n, kind: 'handbook', title: t.title, url: '', label: 'your handbook', handbook_id: hit.handbook.id,
        section_id: hit.block?.sectionId ?? null, handbook_name: hit.handbook.name, section_title: t.section_title,
        page_from: t.page_from, page_to: t.page_to, quote: quote!.trim() })
    }
    // A CHECKED QUOTE IS SHOWN WHERE THE MODEL PUT IT, then its number (staging, 7 October: the model writes the
    // marker in the quote's place — "What your handbook says: [H3: "…"]" — so the number alone read as "[1]").
    // Only a quote the code found in the handbook is ever shown; a failed one is removed above.
    return `${whole.startsWith(' ') ? ' ' : ''}“${quote!.trim()}”[${n}]`
  })
  return { text: out, sources, droppedQuotes: droppedQuotes + plain.handbookFailed, droppedLinks, uncheckedQuotes: plain.unchecked }
}

/**
 * HISTORY FOR A FOLLOW-UP: the answer, then every source behind its markers — a web page by its link, a
 * handbook passage by its card and its exact quote. `lib/historySources.ts` `appendSources` keeps only
 * sources with a URL, which would leave handbook markers pointing at nothing (the 23 September defect).
 */
export function appendHandbookSources(answer: string, sources?: Array<Partial<HrSource> & Source> | null): string {
  const list = (sources ?? []).filter((s) => s && (s.url || (s as HrHandbookSource).kind === 'handbook'))
  if (!list.length) return answer
  const lines = list.map((s) => (s as HrHandbookSource).kind === 'handbook'
    ? `[${s.n}] ${s.title} (your handbook): "${(s as HrHandbookSource).quote}"`
    : `[${s.n}] ${String(s.title ?? '').trim() || s.url} — ${s.url}`)
  return `${answer}\n\nSources cited in this answer:\n${lines.join('\n')}`
}

/** True while no check has finished for any handbook used — the day-1 line shows. */
export async function noCheckYet(db: Db, handbookIds: string[]): Promise<boolean> {
  if (!handbookIds.length) return true
  const { data, error } = await db.from('handbook_checks').select('id').in('handbook_id', handbookIds).eq('status', 'done').limit(1)
  if (error) throw new Error(`reading handbook checks: ${error.message}`)
  return !data?.length
}
