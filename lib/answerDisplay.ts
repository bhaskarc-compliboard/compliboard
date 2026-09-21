/**
 * PREPARING A RESEARCH ANSWER FOR THE SCREEN. `DECISIONS.md` §106, §107.
 *
 * *** THIS CHANGES HOW THE ANSWER IS DISPLAYED AND NEVER WHAT IS STORED. ***
 *
 * With web search on, the answer arrives split across many text blocks — one per cited span —
 * and `lib/ai.ts`'s `reassemble` joins them with nothing, because a break invented at a block
 * boundary is what put a lone full stop on its own line (§106).
 *
 * The cost of joining with nothing is the other direction: **where the model itself omitted a
 * newline between two pieces, the pieces now run together.** The old `"\n"` join set those
 * cases right by accident while breaking sentences everywhere else.
 *
 * So the repair belongs here, at display time, on three shapes — all of them the same thing,
 * a missing break where two pieces of text meet:
 *
 *   "**Stormwater permit**Because you have…"        a bold heading with the text welded on
 *   "…triggers the requirement.## Stormwater Permit" a markdown heading mid-line, "##" showing
 *   ": Facilities may apply…"                        a line opening with punctuation
 *
 * NO IMPORTS, deliberately — Node's type stripping runs the test suite and cannot resolve a
 * `@/` alias (`DECISIONS.md` §67). A rule about display that cannot be tested is a rule nobody
 * can check.
 */

/**
 * Split the stored answer into the lines the page should render.
 *
 * Idempotent: running it on its own output changes nothing.
 */
export function displayLines(answer: string): string[] {
  const out: string[] = []

  for (const raw of (answer ?? '').split('\n')) {
    // 0. A SENTENCE BOUNDARY THAT LOST ITS SPACE.
    //    Found while verifying the other two: "…Environmental Quality.You need an NPDES 1200-Z…",
    //    and the same shape in 2 of 3 earlier captured runs ("…program.You need a stormwater…").
    //    A third instance of the one cause — the model ended a block and began the next with no
    //    separator, and joining with nothing welds them.
    //
    //    The preceding character must be a LOWERCASE LETTER OR DIGIT, so an abbreviation is left
    //    alone: "U.S.Code" has an uppercase S before the stop and does not match.
    //
    //    A SPACE, NOT A PARAGRAPH BREAK. A space is certainly right; a break would be a guess
    //    about structure the model did not express.
    let line = raw.replace(/([a-z0-9])([.!?])([A-Z])/g, '$1$2 $3')

    // 1. A BOLD RUN THAT OPENS A LINE, WELDED TO THE SENTENCE AFTER IT.
    //    Observed live: "**Stormwater permit**Because you have industrial activity…".
    const bold = /^\*\*([^*]+)\*\*(?=\S)(.+)$/.exec(line)
    if (bold) {
      out.push(`## ${bold[1].trim()}`)
      line = bold[2].trim()
    }

    // 2. A MARKDOWN HEADING THAT BEGINS MID-LINE, so the "##" renders as literal text.
    //    Reported: "…triggers the requirement.## Stormwater Permit".
    //    Split repeatedly: one line can carry a tail, a heading, and the next sentence.
    //    The prefix is LAZY and must end on a character that is neither space nor "#". A greedy
    //    `(.*\S)` swallows the first hash of "##" — it split "…requirement.#" / "# Stormwater",
    //    and worse, it tore a legitimate "## Heading" at the start of a line in half.
    const MID_HEADING = /^(.*?[^\s#])(#{1,3})\s+(.+)$/
    let guard = 0
    let mid = MID_HEADING.exec(line)
    while (mid && guard++ < 10) {
      out.push(mid[1].trim())
      line = `${mid[2]} ${mid[3].trim()}`
      mid = MID_HEADING.exec(line)
    }

    out.push(line)
  }

  // 3. PUNCTUATION NEVER STARTS A LINE. It belongs to the sentence above it — the same orphan
  //    §106 fixed at the block boundary, surfacing at a line boundary instead. Reported as a
  //    lone colon under a heading.
  //
  //    A BULLET IS NOT PUNCTUATION and must survive: "- " and "• " are excluded.
  const joined: string[] = []
  for (const line of out) {
    const orphan = /^\s*[:;,.!?)\]]/.test(line) && !/^\s*[-•]\s/.test(line)
    const prev = joined[joined.length - 1]
    if (orphan && prev !== undefined && prev.trim() !== '' && !prev.startsWith('#')) {
      joined[joined.length - 1] = `${prev.replace(/\s+$/, '')}${line.trimStart()}`
    } else {
      joined.push(line)
    }
  }

  // A heading must not be the thing a colon attaches to, and a blank line after a heading is
  // noise, but an empty line between paragraphs is the model's own and stays.
  return joined
}

/** One marker in the prose, and the source behind it. */
export interface InlinePart {
  kind: 'text' | 'marker'
  text: string
  n?: number
}

/**
 * Split one line into text runs and citation markers, so a marker can be rendered as something
 * a reader can hover or tap rather than as three characters.
 *
 * The markers are produced by `reassemble` (§106) and are always `[<digits>]`.
 */
export function inlineParts(line: string): InlinePart[] {
  const parts: InlinePart[] = []
  for (const chunk of line.split(/(\[\d+\])/g)) {
    if (chunk === '') continue
    const m = /^\[(\d+)\]$/.exec(chunk)
    if (m) parts.push({ kind: 'marker', text: chunk, n: Number(m[1]) })
    else parts.push({ kind: 'text', text: chunk })
  }
  return parts
}
