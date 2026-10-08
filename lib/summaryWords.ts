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
