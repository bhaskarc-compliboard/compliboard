/**
 * WHAT A DOCUMENT IS CALLED, IN ONE PLACE — decision 71, 5 November 2026 (the owner).
 *
 * The reading writes a document a full title, and it is a good title for a report: it carries the
 * number, the site, the period, sometimes the company the page is addressed to. In a LIST it is
 * too long to scan, and the six surfaces that name a document were each cutting it differently —
 * or not at all. So there is one function, and a document is called the same thing everywhere:
 *
 *   1. the Documents list's rows          `app/documents/page.tsx`
 *   2. the document drawer's title        `components/DocumentReport.tsx`
 *   3. a summary's Sources                `components/ReportView.tsx`
 *   4. an answer's source cards           `components/AnswerBody.tsx`
 *   5. the audit report's document column `lib/auditRows.ts`
 *   6. the binder's tab sheets            `components/AuditBinder.tsx`
 *
 * *** THE RULE: THE FIRST CLAUSE, AND NEVER LESS THAN FIVE WORDS. ***
 *
 * Cut at the first `" ("` or `", "` that falls AFTER the fifth word. The five-word floor is what
 * makes it safe: without it "Material Safety Data Sheet (old MSDS format) – Sulfuric Acid, 93%"
 * becomes "Material" — the shape of every SDS title, and the one that would have broken first.
 * With it, the same title keeps its subject and loses the parenthesis.
 *
 * *** AND A PARENTHESIS IN THE MIDDLE OF A NAME IS PART OF THE NAME. *** The first cut of this
 * rule took every `" ("`, and measuring it against staging caught what that costs: **two
 * different permits both became "Oregon DEQ Simple Air Contaminant Discharge Permit"** —
 * `(ACDP) No. 03-0217-ST-01` and `(ACDP) No. ACDP 26-0192-ST`, one Clackamas's and one
 * Cascade's, indistinguishable in a list. The number is the thing a person looks for.
 *
 * So a `" ("` is a cut only when its bracket **runs to the end of the title** — a trailing clause
 * like *"(Clackamas Blending & Supply LLC)"*. A bracket that closes and is followed by more title
 * is an abbreviation inside the name — *(ACDP)*, *(Forklift)*, *(S-1 and S-2)*, *(old MSDS
 * format)* — and the cut falls at the next `", "` instead. `lib/documentBatch.ts` records the same
 * failure from the other end: two documents with one title made the batch email contradict itself.
 *
 * **Measured against every title on staging before it was wired to anything** — 40 distinct
 * titles, **24 shortened**, the longest 185 characters to 34, the two permits now 75 and 73
 * characters and different from each other. Nothing can be cut below five words: the floor is
 * on the head, not the result. The ten longest are in `docs/GAPS-PLAN.md` §8, before and after.
 *
 * *** AND THE SECOND HALF OF THE DECISION — "never the address or the company name the reader
 * appended" — IS THE SAME CUT. *** Both arrive as a trailing clause: *"…No. ACDP 26-0192-ST,
 * Cascade Specialty Chemicals"*, *"…Inspection Log, 4820 NW Yeon Avenue"*. Cutting the first
 * clause removes them without a list of company names or a guess at what an address looks like.
 */

/** Words, for the floor. Punctuation on its own is not a word. */
const words = (s: string) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w))

/** Is this position inside an unclosed `(`? */
function inBracket(t: string, at: number): boolean {
  let open = 0
  for (let i = 0; i < at; i++) { if (t[i] === '(') open++; else if (t[i] === ')') open-- }
  return open > 0
}

/** The five words the cut must come after. Below this a title is already short enough to read. */
export const NAME_MIN_WORDS = 5

export function documentName(title: string | null | undefined): string {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  // Every place a clause could start, earliest first — and a bracket that closes before the end
  // of the title is part of the name, not the start of a clause.
  for (const m of t.matchAll(/ \(|, /g)) {
    const at = m.index as number
    if (m[0] === ' (') {
      const close = t.indexOf(')', at)
      if (close !== -1 && t.slice(close + 1).trim()) continue
    } else if (inBracket(t, at)) {
      // A comma INSIDE a bracket is not the end of the first clause, and cutting there leaves an
      // unclosed "(" on the screen. Measured: "…distribution facilities (Northwest Supplier
      // Assurance Program" was the first thing this rule produced.
      continue
    }
    const head = t.slice(0, at)
    if (words(head).length >= NAME_MIN_WORDS) return head.replace(/[\s,;:–—-]+$/, '')
  }
  return t
}

/**
 * The same cut applied to a SOURCE CARD's title, which carries the brief's own suffix —
 * *"<the document> — what we read in it"*, *"— its line in your list"*, *"— the audit's own
 * words"*. The suffix says what the card IS and stays; only the document's name is shortened,
 * and a title with no suffix is simply the name.
 */
export const SOURCE_SUFFIX = ' — '

export function sourceCardName(title: string | null | undefined): string {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim()
  const at = t.indexOf(SOURCE_SUFFIX)
  if (at === -1) return documentName(t)
  return documentName(t.slice(0, at)) + t.slice(at)
}
