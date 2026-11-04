/**
 * THE ROWS OF AN AUDIT REPORT, IN ONE PLACE — `docs/GAPS-PLAN.md` Part C, decision 61.
 *
 * *** WHY THIS FILE EXISTS. *** The binder is the report page printed with the documents behind
 * it, and the one thing that must never differ between the two is the ROWS: the same lines, in the
 * same order, with the same word and the same document. Before this, the order was written three
 * times — `citationOrder` in `components/AuditReport.tsx`, the strip's own `flatMap` beside it, and
 * a hand-copy inside the zip route whose comment admitted it ("computed the same way
 * `citationOrder` does in the drawer"). Three copies of an ordering rule is three chances for the
 * binder's "Document 3" to point at a different document from the report's.
 *
 * *** IT IS PURE, AND THAT IS A RULE AND NOT A PREFERENCE. *** It imports nothing — no database,
 * no `next/server`, and above all nothing that reaches `lib/ai.ts`. `scripts/check-schema-contracts.js`
 * computes the transitive closure of every route's imports and makes any route that can reach a
 * model call `requireAccess` (`PAID_COUNT`, today 23). The binder calls no model and must not start
 * counting as one because of an import. `lib/auditView.ts` is the same shape for the same reason.
 *
 * Nothing here reads a database or renders anything: a caller passes the rows it already has.
 */

/**
 * THE FIVE WORDS, IN THE CUSTOMER'S OWN LANGUAGE — moved here from `components/AuditReport.tsx`
 * at Part C so the report, the binder and the print read one copy. `lib/documentStatus.ts` carries
 * the note about the FOUR copies of `KIND_WORD` that disagreed about one noun; this is that lesson
 * applied before it happens. `app/audits/page.tsx`, `lib/auditNotify.ts` and `lib/ask/auditsBrief.ts`
 * each still hold their own copy — they are a page, an email and a prompt, and
 * `tests/unit/auditWords.test.ts` fails any of them for carrying fewer than five.
 */
export const WORD_LABEL: Record<string, string> = {
  nothing_on_file: 'nothing on file',
  on_file_gaps: 'on file, gaps found',
  stale: 'out of date',
  on_file: 'on file',
  not_a_document_question: 'not a document question',
}

/**
 * The order findings are read in: what is missing, then what is there with something falling short,
 * then what is old, then what is there. The fifth word sits SECOND (the owner, 4 November).
 */
export const WORD_ORDER = ['nothing_on_file', 'on_file_gaps', 'stale', 'on_file', 'not_a_document_question']

/**
 * *** THE PALETTE — ONE NAMED SET OF TINTS, READ OFF BOARD 1 — E1a, 4 November 2026. ***
 *
 * A word is drawn THREE times on this page: in the strip, in the counts under it, and as the row's
 * own pill. Three copies of a colour is three copies that drift, and the one that drifts is always
 * the one nobody is looking at — `components/Drawer.tsx`'s own header says the same thing about
 * copying a drawer. So the tints are defined once, here, and all three read them.
 *
 * The values are `docs/audit-report-boards.html:149` — `.c-green`, `.c-amber`, `.c-red`, `.c-grey`
 * — copied out of the file rather than matched by eye. They are SOFT grounds with DARK text, which
 * is the change: the strip was five saturated blocks with white text, and the row's word was
 * coloured text that made "on file" and "not a document question" look like the same thing to
 * anybody skimming the left edge.
 *
 * *** AND NOTHING ON FILE IS A PINK, NOT A RED — the owner, 4 November. *** `#F8D7D3` behind
 * `#7A1F17`. It is the strongest of the five words and it is still not an alarm: a report somebody
 * has to act on is not improved by a stop sign.
 *
 * `print-tint` (`app/globals.css`) is not decoration either: a browser drops background colours on
 * paper by default, so without it the five words print as five identical white capsules.
 */
export const INK_GREEN = 'text-[#1F5A3A]'
export const INK_AMBER = 'text-[#7A4F0F]'
export const INK_PINK = 'text-[#7A1F17]'
export const INK_GREY = 'text-[#4B5563]'
export const TINT_GREEN = `bg-[#DCEFE3] ${INK_GREEN}`
export const TINT_AMBER = `bg-[#FCEBC6] ${INK_AMBER}`
export const TINT_PINK = `bg-[#F8D7D3] ${INK_PINK}`
export const TINT_GREY = `bg-[#E9EBEF] ${INK_GREY}`
/** The ground and the ink together: the strip's cells and the row's pill. */
export const WORD_TINT: Record<string, string> = {
  on_file: TINT_GREEN,
  on_file_gaps: TINT_AMBER,
  stale: TINT_AMBER,
  nothing_on_file: TINT_PINK,
  not_a_document_question: TINT_GREY,
}
/**
 * *** THE INK ALONE, FOR THE COUNTS — and this is where the brief and board 1 differ. ***
 * Board 1 draws the counts in plain dark text: `.counts b { color: var(--ink) }`. The brief says
 * the palette is used by "the strip, the counts and the row pills", and the brief wins where the
 * two disagree. So the COUNT takes the word's ink and the words after it stay muted, which is how
 * board 3 draws the same five numbers on a checklist card. The filled pill is kept for the one
 * that is SELECTED, so a filter that is on still looks different from four that are off.
 */
export const WORD_INK: Record<string, string> = {
  on_file: INK_GREEN,
  on_file_gaps: INK_AMBER,
  stale: INK_AMBER,
  nothing_on_file: INK_PINK,
  not_a_document_question: INK_GREY,
}
/**
 * A line nobody answered is not a sixth word: it is the absence of one, so it is an outline and
 * not a tint — a hole in the row rather than a verdict. The strip has drawn it this way since E1.
 */
export const TINT_NO_ANSWER = 'border border-dashed border-[var(--amber)] bg-white text-[var(--amber)]'

/** As much of an `audit_findings` row as ordering and citing it needs. */
export interface RowFinding {
  id: string
  section_id: string
  ordinal: number
  kind: string
  document_id: string | null
  document_b_id: string | null
  locator: string | null
}

/** As much of an `audit_sections` row as the auditor's order needs. */
export interface RowSection { id: string; ordinal: number }

/**
 * CITATION ORDER, AND IT IS THE ORDER THE FINDINGS ARE IN — moved from
 * `components/AuditReport.tsx` unchanged.
 *
 * The print's last page and the binder's tabs number the documents the same way, so a printed
 * report and the binder behind it can be read side by side. Documents a finding cites come first,
 * in the order they are first cited; documents the run read and never cited come after, so the
 * list is still complete.
 */
export function citationOrder(findings: Array<Pick<RowFinding, 'document_id' | 'document_b_id'>>,
                              read: string[]): string[] {
  const seen: string[] = []
  for (const f of findings) {
    for (const id of [f.document_id, f.document_b_id]) {
      if (id && !seen.includes(id)) seen.push(id)
    }
  }
  for (const id of read) if (!seen.includes(id)) seen.push(id)
  return seen
}

/**
 * *** THE BINDER'S TABS ARE THE CITED DOCUMENTS ONLY — decision 57, and the owner's words. ***
 *
 * `citationOrder` appends every document the run READ, which is right for the report's last page
 * ("Documents this audit read") and wrong for the binder: eleven documents nothing cites would be
 * eleven tabs an inspector leafs past. One tab per document, however many rows cite it, in order of
 * first citation. The rest keep their place on that last page, titles only.
 */
export function citedDocumentIds(findings: Array<Pick<RowFinding, 'document_id' | 'document_b_id'>>): string[] {
  return citationOrder(findings, [])
}

/** document id → its number in the binder, 1-based, by first citation. */
export function documentNumbers(findings: Array<Pick<RowFinding, 'document_id' | 'document_b_id'>>):
  Map<string, number> {
  const m = new Map<string, number>()
  citedDocumentIds(findings).forEach((id, i) => m.set(id, i + 1))
  return m
}

/**
 * *** "page 1" OUT OF A LOCATOR THAT SAYS SO, AND NOTHING OUT OF ONE THAT DOES NOT. ***
 *
 * Written against the real column rather than a guess: a sample of staging's own locators reads
 * "page 1, header table" · "Page 1, September table and supervisor review section" ·
 * "Pages 1–2, August and September 2026 tables" · "Section 1, page 2" ·
 * "next six-year maintenance due dates shown on page 1" · "page 1, operator table; page 2".
 *
 * So the number may be anywhere in the sentence, the word may be capitalised or plural, and a range
 * may use a hyphen or an en dash. The FIRST page named wins — "page 1; page 2" is a finding that
 * starts on page 1. A locator with no page at all returns null and the row cites the document
 * alone, which is the honest answer: inventing "page 1" would send an inspector to the wrong sheet.
 */
export function pageFromLocator(locator: string | null | undefined): string | null {
  if (!locator) return null
  const m = /\bpages?\s+(\d+)(?:\s*[–—-]\s*(\d+))?/i.exec(locator)
  if (!m) return null
  return m[2] ? `pages ${m[1]}–${m[2]}` : `page ${m[1]}`
}

/**
 * What a row says about where its evidence is: "Document 3, page 1", or "Document 3" when the
 * locator names no page, or null when nothing is cited at all (a line with nothing on file).
 */
export function citeLabel(n: number | undefined, locator: string | null | undefined): string | null {
  if (!n) return null
  const page = pageFromLocator(locator)
  return page ? `Document ${n}, ${page}` : `Document ${n}`
}

/**
 * *** THE AUDITOR'S OWN ORDER — decision 50. ***
 *
 * Section by section in the checklist's order, each section's lines in their own ordinal order.
 * Never regrouped by word, agency or document. The report's strip, the report's rows and the
 * binder all read this, so a cell, a row and a tab cannot fall into three different orders.
 *
 * `kind: 'expected'` rows are suggestions, not lines of the checklist (decision 60), and are left
 * out here as they are left out of the strip and the counts.
 */
export function orderedRows<T extends RowFinding>(sections: RowSection[], findings: T[]): T[] {
  const bySection = [...sections].sort((a, b) => a.ordinal - b.ordinal)
  return bySection.flatMap((s) => findings
    .filter((f) => f.section_id === s.id && f.kind !== 'expected')
    .sort((a, b) => a.ordinal - b.ordinal))
}

/**
 * *** THE STORED TEXT OF A WORD DOCUMENT IS HTML, AND THE BINDER PRINTED THE TAGS. ***
 *
 * Found by the walk, 4 November 2026: the Emergency Action Plan's page came out reading
 * *"…employment plus three years.&lt;/p&gt;&lt;h1&gt;7. Non-routine tasks and contractors&lt;/h1&gt;&lt;p&gt;Before a
 * non-routine task…"*. The cause is one line upstream — `lib/documentContent.ts:421` reads a
 * `.docx` with `mammoth.convertToHtml`, and that HTML is what `document_scans.extracted_text`
 * holds, confirmed on staging: the EAP's text begins `<p>Emergency Action Plan and Hazardous
 * Waste Contingency Plan</p>`.
 *
 * **It is converted here and not fixed upstream on purpose.** What the reader extracts is what
 * the MODEL is shown, and changing that is a §3.1 decision with a golden set behind it, not a
 * display fix. Recorded in `docs/GAPS-PLAN.md` §8.
 *
 * **And it is converted rather than rendered.** `dangerouslySetInnerHTML` would put markup from a
 * customer's own uploaded file into the page, which is the same class of mistake as trusting a
 * body parameter. Block tags become line breaks, every other tag goes, and the five XML entities
 * are decoded — so what prints is the document's words and nothing else.
 */
export function plainTextOf(stored: string): string {
  return stored
    .replace(/<\/(p|h[1-6]|li|tr|div|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    // Last, or it would un-escape the escapes above into tags again.
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
