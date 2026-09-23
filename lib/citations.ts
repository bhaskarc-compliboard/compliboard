/**
 * A CITATION MARKER IS INLINE, NOT A PLACE TO CUT THE DOCUMENT — Fix Round 1 (D), §127.
 *
 * *** THE DEFECT THIS EXISTS TO STOP. ***
 *
 * `components/AnswerBody.tsx` used to split the whole answer on `[n]` and hand each piece to the
 * markdown renderer separately. That is fine in a paragraph and wrong in a table: a table is a
 * BLOCK, and half a block is not a table. The real 23 September roofing answer, rendered through
 * the old path, came out as
 *
 *     <table> count: 1        <tr> count: 3        literal pipes in the prose: 5
 *
 * for a table of a header and three rows — cut at `alone[1]`, with the remaining cells spilled
 * into the page as `|` characters. Two wastewater answers from the same test pass carried the
 * same shape, one with markers `[11]` and `[12]` inside cells and one with none.
 *
 * > ### THE MARKDOWN MUST BE PARSED WHOLE. THE MARKER HAS TO SURVIVE AS PART OF IT.
 *
 * So instead of cutting the text, this rewrites each marker into an ordinary markdown link with
 * a private href — `[1]` becomes `[1](#cb-cite-1)`. A link is inline markdown: it is legal in a
 * table cell, a heading, a list item and a sentence, and the block structure around it is
 * untouched. `AnswerBody` then renders one markdown tree and turns links with that href into the
 * source card.
 *
 * WHAT IS DELIBERATELY NOT REWRITTEN, because each was a way the old splitter misfired:
 *   - anything inside a fenced code block, where `[1]` is code
 *   - anything inside an inline code span, for the same reason
 *   - `[1](…)`, `[1][…]` and `[1]:` — already link syntax; rewriting would corrupt it
 */

/** The href no real source will ever have. `AnswerBody` keys on it. */
export const CITE_HREF_PREFIX = '#cb-cite-'

/** One or two digits in brackets, not already the label of a link or a reference definition. */
const MARKER = /\[(\d{1,2})\](?![([:])/g

/** Rewrites markers outside of inline code spans on one line. */
function markOutsideCode(line: string): string {
  // Split so that code spans survive as their own pieces: `…` keeps whatever is inside it.
  return line
    .split(/(`+[^`]*?`+)/g)
    .map((part) => (part.startsWith('`') ? part : part.replace(MARKER, `[$1](${CITE_HREF_PREFIX}$1)`)))
    .join('')
}

/**
 * Turns every citation marker into an inline markdown link, leaving block structure alone.
 *
 * Returns the text unchanged when it holds no markers, so an answer that cited nothing is
 * byte-identical to what the model wrote.
 */
export function markCitations(text: string): string {
  const lines = text.split('\n')
  let fence: string | null = null

  const out = lines.map((line) => {
    const opener = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      // A fence closes on a run of the same character at least as long as the one that opened it.
      if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length) fence = null
      return line
    }
    if (opener) { fence = opener[1]; return line }
    return markOutsideCode(line)
  })

  return out.join('\n')
}

/** The number behind a citation link, or null for an ordinary link. */
export function citationNumber(href: string | undefined): number | null {
  if (!href || !href.startsWith(CITE_HREF_PREFIX)) return null
  const n = Number(href.slice(CITE_HREF_PREFIX.length))
  return Number.isInteger(n) && n > 0 ? n : null
}
