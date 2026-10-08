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
import { HR_REFUSALS, NOT_IN_HANDBOOK, draftParagraphs } from './hrAnswerWords.ts'

type Db = SupabaseClient<any, any, any>   // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * TOKENS PER CHARACTER, FOR THE PRODUCTION MODEL (HR Baseline Step 1, 8 October 2026).
 * Anthropic's models overview: on the current tokenizer (introduced with Claude Opus 4.7, used by claude-opus-5-5)
 * "1M tokens is roughly … 2.5M Unicode characters" — 0.4 tokens a character; the pricing page: the newer tokenizer
 * "produces approximately 30% more tokens for the same text". The old figure, 0.273, was measured on Haiku 4.5's
 * older tokenizer (Step 6 design, point 6) and would under-count Opus by about a third. On Haiku 0.4 over-counts,
 * which only errs toward sending less.
 * https://platform.claude.com/docs/en/about-claude/models/overview · https://platform.claude.com/docs/en/about-claude/pricing
 */
export const TOKENS_PER_CHAR = 0.4
export const QUOTE_MIN_WORDS = 6

/**
 * WHOLE HANDBOOKS WHEN THEY FIT (the owner, Baseline Step 1). The default is what fits in ONE call on
 * claude-opus-5-5 with room left for everything else in that call:
 *
 *   context window, claude-opus-5-5 (models overview: "Context window 1M tokens";
 *     pricing: the full 1M "at standard pricing")                                   1,000,000
 *   − the answer: 16,000 (the routes' maxTokens), twice, for one doubling retry      −   32,000
 *   − the instructions, the web-search tool's own prompt (286 tokens), the company
 *     context and the question                                                       −   10,000
 *   − the conversation so far (an answer's earlier turns, sources appended)          −   50,000
 *   − the search rounds: 10 searches × 25,000 tokens each. Production's ledger on
 *     8 October: Opus research calls averaged 2.6 searches, at most 4, at 12,500–
 *     24,000 input tokens a search; there is no search limit, so 10 is room, not a cap −  250,000
 *                                                                                    ───────────
 *   left for the handbooks                                                             658,000 → 650,000
 *
 * At TOKENS_PER_CHAR 0.4 that is about 1.6 million characters of handbook text. Selection (6c) runs only for a
 * handbook above it. HR_HANDBOOK_BUDGET_TOKENS still overrides it, for testing — and MUST be set lower for a run on
 * Haiku 4.5, whose context window is 200K tokens (its overview page), when a handbook is large.
 */
export const OPUS_HANDBOOK_BUDGET_TOKENS = 650_000
export function budgetTokens(): number {
  const n = Number(process.env.HR_HANDBOOK_BUDGET_TOKENS)
  return Number.isFinite(n) && n > 0 ? n : OPUS_HANDBOOK_BUDGET_TOKENS
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

export interface HandbookUsed {
  id: string; name: string; pages: number | null; text: string; isWord: boolean
  /** For the check record (Step 6b): how it was given, which version it is, when it was added. */
  as?: 'sections' | 'pages' | 'whole' | 'selected sections'; versionOf?: string | null; addedAt?: string
}

/** A handbook too long to send whole whose sections are found: it goes through selection (Step 6c). */
export interface LongHandbook {
  id: string; name: string; pages: number | null; text: string; isWord: boolean; applies: string
  versionOf: string | null; addedAt: string
  sections: Array<{ id: string; title: string; page_from: number | null; page_to: number | null; text: string }>
}
/** A handbook too long to send whole whose sections are NOT found yet: the answer waits for it (Step 6c). */
export interface WaitingHandbook { id: string; name: string; pages: number | null }

export type Loaded =
  | { ok: true; blocks: Block[]; used: HandbookUsed[]; notUsed: string[]; long: LongHandbook[]; waiting: WaitingHandbook[]
      /** Tokens the whole handbooks took, and the budget: what is left is for the selected sections. */
      spent: number; budget: number }
  | { ok: false; refusal: string }

interface HandbookRowForAnswer {
  id: string; name: string; scope: string; entity_id: string | null; status: string; status_reason: string | null
  extracted_text: string | null; page_count: number | null; created_at: string; version_of: string | null
}

type SectionRow = { id: string; title: string | null; page_from: number | null; page_to: number | null; text: string }

/**
 * THE HANDBOOKS FOR ONE ANSWER (6a; Step 6c splits them three ways):
 *   · WHOLE — every handbook that fits the budget, in the order they were added, exactly as in 6a;
 *   · LONG — one that does not fit and whose sections are found: the right sections are chosen (selection);
 *   · WAITING — one that does not fit and whose sections are not found yet: the answer waits for them.
 */
export async function loadHandbooksForAnswer(db: Db, companyId: string, budget = budgetTokens()): Promise<Loaded> {
  const { data: rows, error } = await db.from('handbooks')
    .select('id, name, scope, entity_id, status, status_reason, extracted_text, page_count, created_at, version_of')
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
  const long: LongHandbook[] = []
  const waiting: WaitingHandbook[] = []
  let spent = 0
  for (const h of withText) {
    const text = h.extracted_text as string
    const isWord = h.page_count == null
    const mine: Omit<Block, 'id'>[] = []
    let secs: SectionRow[] = []
    if (h.status === 'read') {
      const { data } = await db.from('handbook_sections').select('id, position, title, page_from, page_to, text')
        .eq('handbook_id', h.id).order('position')
      secs = (data ?? []) as SectionRow[]
      for (const s of secs) {
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
    if (spent + cost > budget) {
      if (h.status === 'read') long.push({ id: h.id, name: h.name, pages: h.page_count, text, isWord, applies: applies(h),
        versionOf: h.version_of, addedAt: h.created_at,
        sections: secs.map((x) => ({ id: x.id, title: x.title ?? h.name, page_from: x.page_from, page_to: x.page_to, text: x.text })) })
      else waiting.push({ id: h.id, name: h.name, pages: h.page_count })
      continue
    }
    spent += cost
    for (const b of mine) blocks.push({ ...b, id: `H${blocks.length + 1}` })
    used.push({ id: h.id, name: h.name, pages: h.page_count, text, isWord,
      as: h.status === 'read' ? 'sections' : mine.length > 1 || mine[0]?.pageFrom != null ? 'pages' : 'whole',
      versionOf: h.version_of, addedAt: h.created_at })
  }
  return { ok: true, blocks, used, notUsed, long, waiting, spent, budget }
}

// ---------------------------------------------------------------------------------------------------------
// SELECTION — a long handbook's right sections (Step 6c). The model names them from a table of contents;
// code checks every id, adds a safety net, and sends what fits, in the handbook's own order.
// ---------------------------------------------------------------------------------------------------------

/** About the first 30 words of a section's text, for the table of contents. */
export function firstWords(text: string, n = 30): string {
  const words = plainText(text).split(/\s+/).filter(Boolean)
  return words.slice(0, n).join(' ') + (words.length > n ? ' …' : '')
}

/** The table of contents the selection call is given: S-ids unique across every long handbook. */
export function tableOfContents(longs: LongHandbook[]): { text: string; ids: Map<string, { h: number; s: number }> } {
  const ids = new Map<string, { h: number; s: number }>()
  const parts: string[] = []
  longs.forEach((h, hi) => {
    parts.push(`Handbook "${h.name}" (${h.pages ? `${h.pages} pages, ` : ''}applies to ${h.applies}):`)
    h.sections.forEach((s, si) => {
      const id = `S${ids.size + 1}`
      ids.set(id, { h: hi, s: si })
      const pages = s.page_from == null ? '' : s.page_to != null && s.page_to !== s.page_from ? ` (pages ${s.page_from}-${s.page_to})` : ` (page ${s.page_from})`
      parts.push(`${id} | ${s.title}${pages} | ${firstWords(s.text)}`)
    })
  })
  return { text: parts.join('\n'), ids }
}

/** Words too common in an HR question to pick a section by. */
const NET_STOPWORDS = new Set(('about above after again against also been before being below between both could does doing during each '
  + 'enough every from further have having here into just like more most much must need only other over same should since some such '
  + 'than that their them then there these they this those through under until very what when where which while will with would your '
  + 'ours yours handbook handbooks policy policies employee employees employer employers company companies staff worker workers work '
  + 'rule rules law laws legal state oregon washington seattle portland city federal right correct give gives given section sections '
  + 'many days hours week weeks year years time does question answer please tell know want make sure').split(' '))

/** The question's distinctive words: 4+ letters, not common, a trailing plural "s" taken off. */
export function distinctiveWords(question: string): string[] {
  const out = new Set<string>()
  for (const raw of question.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []) {
    const w = raw.replace(/'s$/, '')
    if (NET_STOPWORDS.has(w)) continue
    out.add(w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  }
  return [...out]
}

/** A word in more than this share of a handbook's sections cannot pick one out (staging, 6c: "cascade", "part"). */
export const NET_MAX_SHARE = 0.2
/** The net adds at most this many sections. */
export const NET_MAX_SECTIONS = 6

/**
 * THE SAFETY NET: sections whose text holds one of the question's distinctive words — words found in few
 * sections, so they pick some out — most such words first, at most NET_MAX_SECTIONS. Measured on staging: a
 * word in every section ("cascade", the company's name) put every section in the net and spent the budget.
 */
export function safetyNet(question: string, longs: LongHandbook[], ids: Map<string, { h: number; s: number }>): string[] {
  const candidates = distinctiveWords(question)
  if (!candidates.length) return []
  const texts = new Map([...ids].map(([id, at]) => [id,
    plainText(longs[at.h].sections[at.s].text).toLowerCase() + ' ' + longs[at.h].sections[at.s].title.toLowerCase()]))
  const words = candidates.filter((w) => [...texts.values()].filter((t) => t.includes(w)).length <= Math.max(1, Math.floor(ids.size * NET_MAX_SHARE)))
  const scored: Array<{ id: string; n: number }> = []
  for (const [id, text] of texts) {
    const n = words.filter((w) => text.includes(w)).length
    if (n) scored.push({ id, n })
  }
  return scored.sort((a, b) => b.n - a.n || Number(a.id.slice(1)) - Number(b.id.slice(1))).slice(0, NET_MAX_SECTIONS).map((x) => x.id)
}

export interface Selection {
  handbookId: string; name: string; callOk: boolean
  chosen: Array<{ sectionId: string; title: string; by: 'model' | 'net' }>
  /** Named by the model or the net but left out because the budget was spent. */
  leftForBudget: string[]
}

/**
 * CHOOSE WHAT IS SENT: the model's valid picks first, then the safety net's, until the budget is spent; each
 * handbook's chosen sections in its own order. An id the model named that does not exist is ignored.
 */
export function chooseSections(longs: LongHandbook[], ids: Map<string, { h: number; s: number }>, modelPicks: string[] | null,
  netPicks: string[], tokensLeft: number): Selection[] {
  const by = new Map<string, 'model' | 'net'>()
  for (const id of modelPicks ?? []) if (ids.has(id) && !by.has(id)) by.set(id, 'model')
  for (const id of netPicks) if (!by.has(id)) by.set(id, 'net')
  let left = tokensLeft
  const keep = new Set<string>()
  const leftOut: string[] = []
  for (const [id] of by) {
    const at = ids.get(id)!
    const s = longs[at.h].sections[at.s]
    const cost = Math.ceil(sendable(s.text, longs[at.h].isWord).length * TOKENS_PER_CHAR)
    if (cost <= left) { keep.add(id); left -= cost } else leftOut.push(id)
  }
  return longs.map((h, hi) => {
    const mine = [...ids].filter(([, at]) => at.h === hi).map(([id, at]) => ({ id, at }))
    return {
      handbookId: h.id, name: h.name, callOk: modelPicks !== null,
      chosen: mine.filter((x) => keep.has(x.id)).map((x) => ({ sectionId: h.sections[x.at.s].id, title: h.sections[x.at.s].title, by: by.get(x.id)! })),
      leftForBudget: mine.filter((x) => leftOut.includes(x.id)).map((x) => h.sections[x.at.s].title),
    }
  })
}

/** Add the chosen sections to what the answer is given, as ordinary section blocks. */
export function addSelected(loaded: Extract<Loaded, { ok: true }>, selections: Selection[]): void {
  for (const sel of selections) {
    const h = loaded.long.find((x) => x.id === sel.handbookId)!
    if (!sel.chosen.length) continue
    for (const c of sel.chosen) {
      const s = h.sections.find((x) => x.id === c.sectionId)!
      loaded.blocks.push({ id: `H${loaded.blocks.length + 1}`, handbookId: h.id, handbookName: h.name, applies: h.applies,
        sectionId: s.id, title: s.title, pageFrom: s.page_from, pageTo: s.page_to, stored: s.text })
    }
    loaded.used.push({ id: h.id, name: h.name, pages: h.pages, text: h.text, isWord: h.isWord, as: 'selected sections',
      versionOf: h.versionOf, addedAt: h.addedAt })
  }
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
    ...loaded.long.map((h) => {
      const sent = loaded.blocks.filter((b) => b.handbookId === h.id).length
      return sent ? `"${h.name}" is too long to send whole: only the sections above that were chosen for this question are included.`
        : `"${h.name}" is too long to send whole, and none of its sections was chosen for this question, so it is not included.`
    }),
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

// [H12: "…"] is the model's marker; [HP12: "…"] is a plain quote this code found in a handbook (Step 6b keeps
// which, for the check record). Both are numbered and shown the same way.
// A marker may carry the model's own words after the quote, before its "]" ("[H21: "…" ... (repeated 92 times)]",
// staging 6c): they are dropped, and the quote is checked as usual. Before this, such a marker was not recognised
// and its "[H21:" stayed in the stored text.
const MARKER = /\[(\d{1,2})\]|\s?\[H(P?)(\d+)(?::\s*["“]([^"”\]]*)["”][^\]\n]*)?\]/g
const HMARKER = /\[HP?\d+(?::\s*["“][^"”\]]*["”][^\]\n]*)?\]/g
/** A passage in quotation marks, straight or curly, on one line. */
const PLAIN_QUOTE = /["“]([^"”\n]{1,800}?)["”]/g
/**
 * PLAIN QUOTES ARE JUDGED BY WHERE THEIR WORDS ARE FOUND (owner, 6a answers). Every passage in quotation marks
 * of six or more words, outside a [H…] marker:
 *   · in a handbook block this answer was given → turned into a marker, so the marker pass below numbers it,
 *     shows it inline and gives it a card, exactly as a marked quote;
 *   · in the passage behind one of this answer's own web citations (`cited`, `lib/ai.ts` citedPassages) → the
 *     web page's words: kept, and tied to that citation (its [n] put straight after it if it is not already);
 *   · in neither → KEPT exactly as written, followed by NOT_IN_HANDBOOK, with no card, and counted (the owner,
 *     Baseline Step 1: the evidence checks never change Claude's words). Until 8 October it was removed.
 * Where the citation sits in the sentence decides nothing: "Your handbook says '…', but the law says ….[2]"
 * must not let a false handbook quote through. Shorter passages are left alone (a phrase is not a quotation).
 *
 * The count is split as the owner set it: with no web passage to check against, a failed plain quote failed
 * only the handbook check and joins the handbook line; with passages, it failed both and is "unchecked".
 */
export function checkPlainQuotes(text: string, blocks: Block[], used: HandbookUsed[], cited: Source[] = [], passages: CitedPassage[] = []):
    { text: string; handbookFailed: number; unchecked: number } {
  const kept: string[] = []
  // A SUGGESTED-WORDING PARAGRAPH (owner, 6c) is a draft: its quoted passages are not checked, and it never
  // gets a card. Masked like a marker, then put back as it was. Every other quoted passage keeps the strict rule.
  const paras = text.split('\n\n')
  const marks = draftParagraphs(paras)
  const drafts = paras.map((p, i) => (marks[i] ? (kept.push(p), `\u0000${kept.length - 1}\u0000`) : p)).join('\n\n')
  const masked = drafts.replace(HMARKER, (m) => { kept.push(m); return `\u0000${kept.length - 1}\u0000` })
  let handbookFailed = 0
  let unchecked = 0
  const nOf = (url: string) => cited.find((s) => s.url === url)?.n
  const out = masked.replace(PLAIN_QUOTE, (whole: string, inner: string, at: number, all: string) => {
    if (inner.trim().split(/\s+/).filter(Boolean).length < 6) return whole
    const hit = checkQuote(inner, '', blocks, used)
    if (hit) return `[HP${(hit.block?.id ?? 'H0').slice(1)}: "${inner.trim()}"]`
    const q = normaliseForQuote(inner)
    const web = passages.find((p) => normaliseForQuote(p.citedText).includes(q))
    const n = web ? nOf(web.url) : undefined
    if (n) {
      const after = all.slice(at + whole.length)
      return new RegExp(`^[.,;:!?)]*\\s*\\[${n}\\]`).test(after) ? whole : `${whole}[${n}]`
    }
    if (passages.length) unchecked++
    else handbookFailed++
    return `${whole} ${NOT_IN_HANDBOOK}`
  })
  // Restored twice: a marker can sit inside a restored paragraph's placeholder text only once, so two passes suffice.
  const back = (t: string) => t.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)])
  return { text: back(back(out)), handbookFailed, unchecked }
}

export function finishAnswer(text: string, cited: Source[], searched: Array<{ url: string; title: string }>,
  blocks: Block[], used: HandbookUsed[], passages: CitedPassage[] = []):
    { text: string; sources: HrSource[]; droppedQuotes: number; droppedLinks: number; uncheckedQuotes: number
      /** Plain quotes found in no handbook (no cited passage to check against): kept and marked. */
      notFoundQuotes: number
      /** Each handbook card's number and whether it came from a [H…] marker or a plain quote (Step 6b). */
      origins: Array<{ n: number; from: 'marker' | 'plain' }> } {
  const plain = checkPlainQuotes(text, blocks, used, cited, passages)
  text = plain.text
  const sources: HrSource[] = []
  const webNew = new Map<number, number | null>()        // old web n → new n (null: dropped)
  const quoteNew = new Map<string, number>()              // handbook quote key → new n
  let droppedQuotes = 0
  let droppedLinks = 0
  const byOld = new Map(cited.map((s) => [s.n, s]))

  const origins: Array<{ n: number; from: 'marker' | 'plain' }> = []
  const out = text.replace(MARKER, (whole, webN: string | undefined, plainFlag: string | undefined, hId: string | undefined, quote: string | undefined) => {
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
    // The whitespace the marker pattern took in front of it: a space goes with a dropped marker, a line break stays.
    const lead = /^\s/.test(whole) ? whole[0] : ''
    if (!hit) { droppedQuotes++; return lead === ' ' ? '' : lead }
    const key = `${hit.handbook.id}|${normaliseForQuote(quote!)}`
    let n = quoteNew.get(key)
    if (!n) {
      n = sources.length + 1
      quoteNew.set(key, n)
      origins.push({ n, from: plainFlag ? 'plain' : 'marker' })
      const t = handbookCardTitle(hit)
      sources.push({ n, kind: 'handbook', title: t.title, url: '', label: 'your handbook', handbook_id: hit.handbook.id,
        section_id: hit.block?.sectionId ?? null, handbook_name: hit.handbook.name, section_title: t.section_title,
        page_from: t.page_from, page_to: t.page_to, quote: quote!.trim() })
    }
    // A CHECKED QUOTE IS SHOWN WHERE THE MODEL PUT IT, then its number (staging, 7 October: the model writes the
    // marker in the quote's place — "What your handbook says: [H3: "…"]" — so the number alone read as "[1]").
    // Only a quote the code found in the handbook is ever shown; a failed one is removed above.
    return `${lead}“${quote!.trim()}”[${n}]`
  })
  // droppedQuotes counts only [H…] markers whose quote was not found (removed); plain quotes are kept and marked.
  return { text: replaceBlockIds(out, blocks), sources, droppedQuotes, droppedLinks, uncheckedQuotes: plain.unchecked,
    notFoundQuotes: plain.handbookFailed, origins }
}

/**
 * INTERNAL IDS NEVER REACH THE PERSON (owner, 6c). After the markers are numbered, any "H12" left in the text is
 * replaced by that block's title ("7.2 Sick leave", or "page 14" for a page block). One the answer was not given
 * is left as written (there is nothing true to put in its place).
 */
export function replaceBlockIds(text: string, blocks: Block[]): string {
  const byId = new Map(blocks.map((b) => [b.id, b.title]))
  return text.replace(/\b(section |sections )?(H\d+)\b/g, (whole, word: string | undefined, id: string) => {
    const title = byId.get(id)
    return title ? `${word && !/^page /.test(title) ? word : ''}${title}` : whole
  })
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

// ---------------------------------------------------------------------------------------------------------
// THE CHECK RECORD — HR Step 6b (migration 069; DECISIONS.md §169 follow-up 1). Stored with each new HR
// answer's turn, so the answer can be audited after the fact. The page does not show it in this step.
// ---------------------------------------------------------------------------------------------------------
export function checkRecord(args: {
  used: HandbookUsed[]; selections: Selection[]; budgetTokens: number
  searched: Array<{ url: string; title: string }>; citedPassages: number
  done: ReturnType<typeof finishAnswer>; waitedSeconds?: number
}): Record<string, unknown> {
  return {
    version: 2,
    handbooks: args.used.map((u) => ({ id: u.id, name: u.name, version_of: u.versionOf ?? null, added_at: u.addedAt ?? null, given_as: u.as ?? null, pages: u.pages })),
    selection: args.selections.map((x) => ({ handbook_id: x.handbookId, name: x.name, call_ok: x.callOk,
      chosen: x.chosen.map((c) => ({ section_id: c.sectionId, title: c.title, by: c.by })), left_for_budget: x.leftForBudget })),
    waited_seconds: args.waitedSeconds ?? 0,
    budget_tokens: args.budgetTokens,
    searched: args.searched.map((r) => ({ url: r.url, title: r.title })),
    cited_passages: args.citedPassages,
    handbook_cards: args.done.origins,
    dropped: { handbook_quotes: args.done.droppedQuotes, unchecked_quotes: args.done.uncheckedQuotes, web_links: args.done.droppedLinks },
    // Since the baseline (8 October): plain quotes kept and marked "(not found in your handbook)".
    marked: { not_found_quotes: args.done.notFoundQuotes, unchecked_quotes: args.done.uncheckedQuotes },
  }
}

// ---------------------------------------------------------------------------------------------------------
// STEP 9 — ANSWERS USE THE STORED CHECK, AS A SWITCH, OFF BY DEFAULT (the owner; HR-PLAN step 9, §175)
// ---------------------------------------------------------------------------------------------------------

/**
 * HR_ANSWER_USES_CHECK, READ AS THE WORKSPACE READS ITS SWITCHES (`lib/pipelineConfig.ts` readSwitch): on only for
 * the exact word `true`, any case, trimmed; unset or anything else is off. Read at the decision point, never cached.
 * Kept here rather than in PIPELINE_SWITCHES so no shared file changes; the rule is the same one line.
 * OFF MEANS THE CODE PATH IS NOT ENTERED: the route does not read a check, and the answer is byte for byte today's.
 */
export function answerUsesCheck(): boolean {
  return String(process.env.HR_ANSWER_USES_CHECK ?? '').trim().toLowerCase() === 'true'
}

/** One handbook's latest finished check, as stored: its answers (the parts that succeeded, in order) and their sources. */
export interface StoredCheck {
  handbookId: string; handbookName: string; checkId: string; finishedAt: string
  parts: Array<{ text: string; sources: Array<{ n: number; title: string; url: string; label?: string; kind?: string }> }>
}

/** For each handbook the answer is given: its latest check with status 'done', if it has stored answers. */
export async function storedChecks(db: Db, used: HandbookUsed[]): Promise<StoredCheck[]> {
  const out: StoredCheck[] = []
  for (const u of used) {
    const { data: check } = await db.from('handbook_checks').select('id, finished_at')
      .eq('handbook_id', u.id).eq('status', 'done').order('finished_at', { ascending: false }).limit(1).maybeSingle()
    if (!check) continue
    const [{ data: rows }, { data: secs }] = await Promise.all([
      db.from('handbook_check_sections').select('section_id, answer_text, answer_sources').eq('check_id', check.id).not('answer_text', 'is', null),
      db.from('handbook_sections').select('id, position').eq('handbook_id', u.id),
    ])
    const pos = new Map(((secs ?? []) as Array<{ id: string; position: number }>).map((s) => [s.id, s.position]))
    const parts = ((rows ?? []) as Array<{ section_id: string; answer_text: string; answer_sources: StoredCheck['parts'][number]['sources'] | null }>)
      .sort((a, b) => (pos.get(a.section_id) ?? 1e9) - (pos.get(b.section_id) ?? 1e9))
      .map((r) => ({ text: r.answer_text, sources: r.answer_sources ?? [] }))
    if (parts.length) out.push({ handbookId: u.id, handbookName: u.name, checkId: check.id, finishedAt: check.finished_at, parts })
  }
  return out
}

/** "1 October 2026", as the page and the email write a date. */
const dayOf = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * ONE PLAINLY LABELLED BLOCK PER HANDBOOK (the owner): "The last check of <handbook>, on <date>:", then each stored
 * answer's text and its numbered sources (title, link, label). Nothing else is added to the message.
 */
export function checkBlock(c: StoredCheck): string {
  const parts = c.parts.map((p) => {
    const lines = p.sources.map((s) => s.kind === 'handbook' || !s.url
      ? `[${s.n}] ${s.title} (your handbook)`
      : `[${s.n}] ${s.title} — ${s.url} (${s.label ?? 'other'})`)
    return lines.length ? `${p.text}\n\nSources:\n${lines.join('\n')}` : p.text
  })
  return `The last check of ${c.handbookName}, on ${dayOf(c.finishedAt)}:\n\n${parts.join('\n\n')}`
}

/**
 * THE CHECK'S TEXT COUNTS TOWARD THE HANDBOOK BUDGET (the owner). Blocks go in, in the handbooks' order, while what the
 * answer already sends plus the block fits; a block that would not fit is left out and noted.
 */
export function fitChecks(checks: StoredCheck[], sentChars: number, budget = budgetTokens()):
    { used: StoredCheck[]; leftOut: StoredCheck[]; blocks: string } {
  let spent = Math.ceil(sentChars * TOKENS_PER_CHAR)
  const used: StoredCheck[] = []; const leftOut: StoredCheck[] = []; const blocks: string[] = []
  for (const c of checks) {
    const b = checkBlock(c)
    const cost = Math.ceil(b.length * TOKENS_PER_CHAR)
    if (spent + cost > budget) { leftOut.push(c); continue }
    spent += cost; used.push(c); blocks.push(b)
  }
  return { used, leftOut, blocks: blocks.join('\n\n') }
}

/** A web link stored with a check counts as checked (it was checked against that check's search when it ran). */
export function checkSearched(checks: StoredCheck[]): Array<{ url: string; title: string; label: string }> {
  return checks.flatMap((c) => c.parts.flatMap((p) => p.sources.filter((s) => s.url && s.kind !== 'handbook')
    .map((s) => ({ url: s.url, title: s.title, label: s.label ?? labelFor(s.url) }))))
}

/** The closing line (the owner's words from the plan); with several handbooks, each named with its date. */
export function usesCheckLine(checks: StoredCheck[]): string {
  if (checks.length === 1) return `This answer uses your handbook check of ${dayOf(checks[0].finishedAt)}.`
  return `This answer uses your handbook checks: ${checks.map((c) => `${c.handbookName}, ${dayOf(c.finishedAt)}`).join('; ')}.`
}
