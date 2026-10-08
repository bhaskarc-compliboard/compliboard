/**
 * THE HR ANSWER'S WORDS — HR Step 6a. Browser-safe (no server import), so the route and the page share one
 * copy. Every sentence here is the owner's (the Step 6a brief) unless its comment says otherwise.
 */

export const HR_REFUSALS = {
  none: 'Add a handbook first. Answers come from your handbooks.',
  reading: 'Your handbooks are still being read. Ask again in a minute.',
  unreadable: 'None of your handbooks could be read, so there is nothing to answer from. The Handbooks tab shows why.',
} as const

/** "a, b and c" — titles and names in a line. */
export const joinAnd = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/**
 * A LONG HANDBOOK (Step 6c; the owner's line). It REPLACES 6a's temporary over-budget line, which is no
 * longer written. `alone` — the only handbook the answer was given — reads "This handbook is long, …".
 */
export const longLine = (name: string, titles: string[], alone: boolean) =>
  `${alone ? 'This handbook' : name} is long, so this answer read the sections that matched your question: ${joinAnd(titles)}.`
/** The selection call failed or named nothing usable, and the safety net chose (accepted by the owner, 6c). */
export const longNetOnlyLine = (name: string, titles: string[], alone: boolean) =>
  `${alone ? 'This handbook' : name} is long, and choosing its sections did not work this time, so this answer read the sections that contain your question's words: ${joinAnd(titles)}.`
/** ONE line for every long handbook that matched nothing (owner, 6c answers). */
export const longNothingLine = (names: string[]) => names.length === 1
  ? `${names[0]} is long, and none of its sections could be matched to your question, so this answer did not read it.`
  : `${joinAnd(names)} are long, and none of their sections matched your question, so this answer did not read them.`

/** THE HONEST WAIT (Step 6c; the owner's words). `total` null: the reader has not counted its parts yet. */
export const waitingWords = (pages: number | null, done: number | null, total: number | null) =>
  `Your handbook is ${pages ?? 'very'}${pages ? ' pages' : ''} long. We're finding its sections so we can read the right ones`
  + (total ? ` — ${done ?? 0} of ${total} parts done` : '') + `. Your answer starts as soon as that's finished.`
/** Reading failed during the wait (the owner's words); the reason is the handbook's own. */
export const waitFailedWords = (reason: string) =>
  `We couldn't read your handbook: ${reason.trim().replace(/\.$/, '')}. Your question was not answered yet.`
/** The wait passed WAIT_LIMIT_MS (accepted by the owner, 6c, with "than usual"). The reading carries on; the question is not answered. */
export const waitTooLongWords = 'Your handbook is taking longer to read than usual. Your question was not answered yet. Ask it again in a few minutes; the reading carries on.'
export const WAIT_LIMIT_MS = 3 * 60_000

/** While no check has finished for any handbook the answer used (the day-1 line, HR-PLAN "Day 1"). */
export const DAY1_LINE = "Your handbook's full check has not run yet. This answer reads the handbook and the rule just now."

/** The DROPPED_LINE pattern (`lib/howTo.ts`), for a handbook quote the code could not find. */
export const quotesDroppedLine = (n: number) => n === 1
  ? '1 quote could not be found in your handbook, so it is not shown as a source.'
  : `${n} quotes could not be found in your handbook, so they are not shown as sources.`

/** A web citation this answer's search did not return (owner, 6a answers). */
export const linksDroppedLine = (n: number) => n === 1
  ? '1 web source could not be checked, so it is not shown.'
  : `${n} web sources could not be checked, so they are not shown.`

/** A plain quote found in no handbook AND in no passage behind this answer's citations (owner, 6a answers). */
export const uncheckedQuotesLine = (n: number) => n === 1
  ? '1 quote could not be checked against its source, so it is not shown.'
  : `${n} quotes could not be checked against their sources, so they are not shown.`

/** What a quoted passage found nowhere becomes, so the sentence still reads (owner: accepted). */
export const QUOTE_REMOVED = '(quote removed)'

/** A question whose answer never finished, on a reopened conversation (Step 6b brief). */
export const NOT_ANSWERED = 'Not answered.'
export const ASK_IT_AGAIN = 'Ask it again'
/** The same question was asked again later in this conversation (owner, 6b answers): no button then. */
export const ASKED_AGAIN_BELOW = 'Not answered. Asked again below.'

/** HR's conversation drawer, not summarised (owner, 6b answers). No "overnight" until step 7 makes it true;
 *  step 7 restores the workspace's sentence. */
export const NOT_SUMMARISED_HR = "This one hasn't been summarised yet. The full conversation is here."

/** Deleting a conversation (canvas board 11, the Step 6b brief). */
export const DELETE_CONVERSATION = {
  title: 'Delete this conversation?',
  lede: 'This deletes the conversation and its summary for good. You cannot undo it.',
  note: 'Download the summary first if you may need it. Your handbooks and their checks stay.',
} as const

/** The composer's hint once a question has been asked (owner: the canvas's words). */
export const HR_COMPOSER_HINT = 'Ask about your handbook, or a situation at work…'

/** The board's stages, from real events. */
export const readingWords = (books: Array<{ name: string; pages: number | null }>) => {
  const each = books.map((b) => (b.pages ? `${b.name} (${b.pages} ${b.pages === 1 ? 'page' : 'pages'})` : b.name))
  const joined = each.length <= 1 ? (each[0] ?? '') : `${each.slice(0, -1).join(', ')} and ${each[each.length - 1]}`
  return `Reading ${joined}`
}
// The checking stage's words live in `components/stageWords.ts` ('hr_check'), one copy.

/** Every line the server appends to a stored answer (option C), so the page can draw them grey. */
export function isAppendedLine(line: string): boolean {
  const l = line.trim()
  return l === DAY1_LINE
    // 6a's temporary over-budget line: no longer written, still drawn grey when an older answer is reopened.
    || /^.+ is too long to read whole yet\. Reading its right sections comes in the next step\.$/.test(l)
    || /^.+ is long, so this answer read the sections that matched your question: .+\.$/.test(l)
    || /^.+ is long, and choosing its sections did not work this time, so this answer read the sections that contain your question's words: .+\.$/.test(l)
    || /^.+ is long, and none of its sections could be matched to your question, so this answer did not read it\.$/.test(l)
    || /^.+ are long, and none of their sections matched your question, so this answer did not read them\.$/.test(l)
    || /^\d+ quotes? could not be found in your handbook, so (it is|they are) not shown as (a )?sources?\.$/.test(l)
    || /^\d+ web sources? could not be checked, so (it is|they are) not shown\.$/.test(l)
    || /^\d+ quotes? could not be checked against (its|their) sources?, so (it is|they are) not shown\.$/.test(l)
}

/** The answer's own text, and the appended lines after it, for drawing. */
export function splitAppended(text: string): { body: string; lines: string[] } {
  const parts = text.split('\n\n')
  const lines: string[] = []
  while (parts.length > 1 && isAppendedLine(parts[parts.length - 1])) lines.unshift(parts.pop()!.trim())
  return { body: parts.join('\n\n'), lines }
}

/** A paragraph of proposed wording (owner, 6c): a draft, never a quote and never a source. */
export const SUGGESTED_WORDING = /^\s*(\*\*)?Suggested wording:?(\*\*)?:?/i
export const isSuggestedWording = (paragraph: string) => SUGGESTED_WORDING.test(paragraph)

/**
 * Which paragraphs are draft: from a "Suggested wording:" paragraph up to the next heading or rule (a paragraph
 * starting with "#" or "---"), or the end. Staging 6c: the model put the label in a paragraph of its own and the
 * wording in the paragraphs after it, so the label's paragraph alone was not the draft.
 */
export function draftParagraphs(paragraphs: string[]): boolean[] {
  let inDraft = false
  return paragraphs.map((p) => {
    if (isSuggestedWording(p)) inDraft = true
    else if (/^\s*(#|---)/.test(p)) inDraft = false
    return inDraft
  })
}

/** The answer split into ordinary text and suggested wording, in order, for drawing (the label taken off). */
export function splitSuggested(body: string): Array<{ draft: boolean; text: string }> {
  const out: Array<{ draft: boolean; text: string }> = []
  const paras = body.split('\n\n')
  const marks = draftParagraphs(paras)
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]
    const draft = marks[i]
    const text = draft ? p.replace(SUGGESTED_WORDING, '').trim() : p
    if (draft && !text) { if (!out.length || !out[out.length - 1].draft) out.push({ draft: true, text: '' }); continue }
    const last = out[out.length - 1]
    if (last && last.draft === draft) last.text = last.text ? `${last.text}\n\n${text}` : text
    else out.push({ draft, text })
  }
  return out
}

/**
 * WHILE STREAMING, A HANDBOOK MARKER IS HIDDEN: `[H12: "…"]` becomes a number only when the answer is done
 * and the quote is checked. A marker still being written (no closing bracket yet) is hidden too.
 */
export function hideHandbookMarkers(text: string): string {
  return text.replace(/\s?\[H\d+:\s*["“][^\]]*\]/g, '').replace(/\s?\[H[^\]]*$/, '')
}
