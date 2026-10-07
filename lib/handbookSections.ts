/**
 * A HANDBOOK, CUT INTO SECTIONS — HR Step 5b (`docs/HR-PLAN.md` decisions 12, 18, 28). Pure: no database,
 * no model, so `tests/unit/handbookSections.test.ts` can hold every rule. `lib/handbookRead.ts` uses it.
 *
 * THE ONE PROMISE THIS FILE KEEPS: NOTHING IS LEFT OUT. Every way of cutting here produces sections that
 * start where the one before ended, begin at the first character and end at the last, and `proveCoverage`
 * checks that independently of how the cuts were made: the sections, joined, must BE the whole text, with
 * no gap and no overlap. A handbook that fails it is not saved as read.
 *
 * Text that comes before the first heading (a cover page, a contents page) belongs to the first section,
 * so it is never dropped.
 */
import { createHash } from 'node:crypto'

export interface Cut { start: number; title: string | null }
export interface Section { position: number; title: string | null; start: number; end: number; text: string }

/** Turn cut points (in order) into sections that cover [0, text.length). The first always starts at 0. */
export function sectionsFromCuts(text: string, cuts: Cut[]): Section[] {
  if (!text.length) return []
  const starts = cuts.length ? cuts : [{ start: 0, title: null }]
  return starts.map((c, i) => {
    const start = i === 0 ? 0 : c.start
    const end = i + 1 < starts.length ? starts[i + 1].start : text.length
    return { position: i, title: c.title, start, end, text: text.slice(start, end) }
  })
}

/**
 * THE COVERAGE PROOF. Not trusting the cutter: checks the sections against the text they claim to cover.
 * Returns the first problem found, in words for the server log, or null.
 */
export function proveCoverage(text: string, sections: Section[]): string | null {
  if (!sections.length) return text.length ? 'no sections for a non-empty text' : null
  if (sections[0].start !== 0) return `the first section starts at ${sections[0].start}, not 0`
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    if (s.end <= s.start) return `section ${i} is empty or reversed (${s.start}–${s.end})`
    if (s.text !== text.slice(s.start, s.end)) return `section ${i}'s text is not the text at ${s.start}–${s.end}`
    if (i + 1 < sections.length && sections[i + 1].start !== s.end) {
      const next = sections[i + 1].start
      return next > s.end ? `a gap between sections ${i} and ${i + 1} (${s.end}–${next})` : `sections ${i} and ${i + 1} overlap (${next}–${s.end})`
    }
  }
  const last = sections[sections.length - 1]
  if (last.end !== text.length) return `the last section ends at ${last.end}, not ${text.length}`
  if (sections.map((s) => s.text).join('') !== text) return 'the sections joined are not the whole text'
  return null
}

// ---------------------------------------------------------------------------------------------------------
// PDF: cut where the model's anchors are found. The model never cuts; code does.
// ---------------------------------------------------------------------------------------------------------

export interface Anchor { title: string; anchor: string }

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Where an anchor's words occur in `text`, at or after `from`. Exact words in exact order; only the
 * whitespace between them may differ, because a PDF's text breaks lines where the page did.
 */
export function findAnchor(text: string, anchor: string, from: number): number {
  const words = anchor.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return -1
  const re = new RegExp(words.map(escape).join('\\s+'), 'g')
  re.lastIndex = from
  const m = re.exec(text)
  return m ? m.index : -1
}

/**
 * CUT AT THE ANCHORS, IN ORDER. Each anchor is looked for after the previous cut. One not found, or found
 * no further on than the previous cut, is DROPPED, and the text it would have started stays in the section
 * before. If none is found, the whole handbook is one section.
 */
export function cutAtAnchors(text: string, anchors: Anchor[]): { sections: Section[]; dropped: Anchor[] } {
  const cuts: Cut[] = []
  const dropped: Anchor[] = []
  let cursor = 0
  for (const a of anchors) {
    const at = findAnchor(text, a.anchor, cursor)
    const previous = cuts.length ? cuts[cuts.length - 1].start : -1
    if (at < 0 || at <= previous) { dropped.push(a); continue }
    cuts.push({ start: at, title: a.title.trim() || null })
    cursor = at + 1
  }
  return { sections: sectionsFromCuts(text, cuts), dropped }
}

// ---------------------------------------------------------------------------------------------------------
// WORD: the document's own headings, in code, with no model call. `lib/documentContent.ts` returns a Word
// file as HTML (mammoth), so a heading is an <h1>…<h6> element, and a section starts at its opening tag.
// ---------------------------------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
export function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e]).replace(/\s+/g, ' ').trim()
}

export function wordSections(html: string): Section[] {
  const cuts: Cut[] = []
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const title = plainText(m[2])
    if (title) cuts.push({ start: m.index, title })
  }
  return sectionsFromCuts(html, cuts)
}

// ---------------------------------------------------------------------------------------------------------
// PAGES
// ---------------------------------------------------------------------------------------------------------

/**
 * Where each page starts in the whole text. The PDF parser builds its text as every page's text joined by
 * one newline (`node_modules/officeparser/dist/parsers/PdfParser.js:820`), and `joinPages` does the same.
 */
export function pageStarts(pages: string[]): number[] {
  const out: number[] = []
  let at = 0
  for (const p of pages) { out.push(at); at += p.length + 1 }
  return out
}
export const joinPages = (pages: string[]) => pages.join('\n')

/** The page (1-based) holding offset `i`. */
export function pageAt(starts: number[], i: number): number {
  let lo = 0, hi = starts.length - 1
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= i) lo = mid; else hi = mid - 1 }
  return lo + 1
}

/** A section's pages: from its first non-space character to its last, so a newline between pages does not count. */
export function sectionPages(text: string, starts: number[], s: Section): { page_from: number; page_to: number } {
  let a = s.start, b = s.end - 1
  while (a < b && /\s/.test(text[a])) a++
  while (b > a && /\s/.test(text[b])) b--
  return { page_from: pageAt(starts, a), page_to: pageAt(starts, b) }
}

// ---------------------------------------------------------------------------------------------------------
// A SCAN, AND A HANDBOOK TOO LONG FOR ONE CALL
// ---------------------------------------------------------------------------------------------------------

/** Fewer letters than this per page, on average, is "no text to speak of": a scan, or a picture of a page. */
export const SCAN_LETTERS_PER_PAGE = 20

export function looksLikeScan(text: string, pageCount: number): boolean {
  const letters = (text.match(/\p{L}/gu) ?? []).length
  return letters < SCAN_LETTERS_PER_PAGE * Math.max(1, pageCount)
}

/** About 20,000 words: what one outline call is given at most. Pages are never split across parts. */
export const OUTLINE_PART_CHARS = 120_000

/** Group pages into parts of at most `maxChars` (a single longer page is a part on its own). */
export function outlineParts(pages: string[], maxChars = OUTLINE_PART_CHARS): Array<{ from: number; to: number; text: string }> {
  const parts: Array<{ from: number; to: number; text: string }> = []
  let first = 0
  let size = 0
  for (let i = 0; i < pages.length; i++) {
    const add = pages[i].length + (i > first ? 1 : 0)
    if (i > first && size + add > maxChars) {
      parts.push({ from: first + 1, to: i, text: joinPages(pages.slice(first, i)) })
      first = i; size = pages[i].length
    } else size += add
  }
  if (pages.length) parts.push({ from: first + 1, to: pages.length, text: joinPages(pages.slice(first)) })
  return parts
}

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
