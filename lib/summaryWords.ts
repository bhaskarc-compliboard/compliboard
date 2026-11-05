/**
 * THE SUMMARY'S DISPLAY WORDS — HR Step 3a (`docs/HR-PLAN.md` decision 1).
 *
 * Moved out of `lib/summaryReport.ts` with not a character changed, because the summary drawer now
 * lives in a shared component (`components/ReportView.tsx`) and `lib/summaryReport.ts` cannot reach
 * the browser: it imports `lib/ai.ts`, which imports the model SDK. Until this file existed the page
 * and `lib/checklistView.ts` each kept a pinned copy instead.
 *
 * *** THIS FILE IMPORTS NOTHING, AND MUST NOT. *** It is read by browser components.
 * `tests/unit/clientImports.test.ts` fails if it ever imports anything, and fails if any client
 * file imports `lib/ai.ts`, `lib/summaryReport.ts`, `lib/auth.ts` or the SDK.
 *
 * `lib/summaryReport.ts` imports these and re-exports them, so its callers — the summarise route,
 * the nightly job, `renderPlainText` — are unchanged.
 */

export const NO_SOURCE = 'No source cited in the conversation'

/** Under "Your situation" when the person said nothing about their business (the owner, 7 October): a polite
 *  fixed sentence, never the model saying what the person did not share. */
export const NO_SITUATION = 'No details about your business came up in this conversation.'

/** "1 October 2026" — the as-of date, written out. */
export function longDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export const AS_OF_LINE = (asOf: string) =>
  `What applies to you as of ${longDate(asOf)}, from this conversation. Rules and tariffs change. Check before you act.`

// ---- HR Step 7 — HR's summary words, beside the workspace's (the owner's, from the Step 7 design) ----

/** HR's as-of line. The workspace's mentions tariffs; HR's is about the handbooks. */
export const HR_AS_OF_LINE = (asOf: string) =>
  `What to change in your handbooks as of ${longDate(asOf)}, from this conversation. Rules change. Check before you act.`

/** "1 thing to change", "3 things to change" — per authority (canvas board 10). */
export const thingsToChange = (n: number) => `${n} thing${n === 1 ? '' : 's'} to change`

/** "What to change · 3 things" — the heading over the authorities. */
export const whatToChangeHeading = (n: number) => `What to change · ${n} thing${n === 1 ? '' : 's'}`

// ---- E2 — the five cards' words (`docs/GAPS-PLAN.md` Part E step E2, decision 62) ----

/**
 * *** THE CARD TITLES, AND THE ONE THAT WAS RENAMED. ***
 *
 * "Asked and not answered" became **"Not answered here"** (the owner, 4 November): the old words
 * read as a reproach — the board's note records his own phrase for it, *"either goes away or gets
 * extra polite"* — and what actually happened is that a question came up in a conversation about
 * something else. The section stays, because a question this product saw and did not answer is
 * exactly the thing it must not quietly drop (§6).
 */
export const CARD_SITUATION_TITLE = 'Your situation'
export const CARD_APPLIES_TITLE = 'What applies'
export const CARD_CONFIRM_TITLE = 'Still to confirm'
export const CARD_UNANSWERED_TITLE = 'Not answered here'
export const CARD_SOURCES_TITLE = 'Sources'

/** On the Still to confirm header, in place of a bare number: what the count MEANS. */
export const CONFIRM_COUNT = (n: number) =>
  `${n} thing${n === 1 ? '' : 's'} we could not settle from the documents`

/** On the Not answered here header. */
export const UNANSWERED_COUNT = (n: number) => `${n} question${n === 1 ? '' : 's'}`

/**
 * Under every question in Not answered here — the owner's words, 4 November. It says what is true
 * (this came up in a conversation about something else) and what to do about it, and it promises
 * an answer to a question asked on its own, which is a promise the product keeps.
 */
export const UNANSWERED_LINE =
  'this came up and the conversation did not settle it. Ask it on its own and we will answer.'

/** On the What applies header, beside the heading: "6 things to do · 3 authorities". */
export const APPLIES_COUNT = (total: number, groups: number) =>
  `${total} thing${total === 1 ? '' : 's'} to do · ${groups} authorit${groups === 1 ? 'y' : 'ies'}`

/** Beside HR's own heading, which already carries its count. */
export const GROUPS_COUNT = (groups: number) =>
  `${groups} authorit${groups === 1 ? 'y' : 'ies'}`
