/**
 * THE HR ANSWER'S WORDS — HR Step 6a. Browser-safe (no server import), so the route and the page share one
 * copy. Every sentence here is the owner's (the Step 6a brief) unless its comment says otherwise.
 */

export const HR_REFUSALS = {
  none: 'Add a handbook first. Answers come from your handbooks.',
  reading: 'Your handbooks are still being read. Ask again in a minute.',
  unreadable: 'None of your handbooks could be read, so there is nothing to answer from. The Handbooks tab shows why.',
} as const

/** Temporary, until Step 6c reads a long handbook's right sections. Names the handbook (owner, 6a answers). */
export const overBudgetLine = (name: string) => `${name} is too long to read whole yet. Reading its right sections comes in the next step.`

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
    || /^.+ is too long to read whole yet\. Reading its right sections comes in the next step\.$/.test(l)
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

/**
 * WHILE STREAMING, A HANDBOOK MARKER IS HIDDEN: `[H12: "…"]` becomes a number only when the answer is done
 * and the quote is checked. A marker still being written (no closing bracket yet) is hidden too.
 */
export function hideHandbookMarkers(text: string): string {
  return text.replace(/\s?\[H\d+:\s*["“][^\]]*\]/g, '').replace(/\s?\[H[^\]]*$/, '')
}
