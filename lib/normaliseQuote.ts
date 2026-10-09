/**
 * THE ONE NORMALISATION RULE FOR A QUOTED LINE — the owner's decision of 7 October 2026
 * (`docs/HR-PLAN.md` decisions 4 and 20): tags out, lower case, letters and digits only.
 *
 * It lived in `lib/documentScan.ts`, where `verifyQuote` uses it, and HR imported it from there. The
 * Calendar's date key needs it too (`lib/calendarDates.ts`: a date's identity is its source line,
 * normalised) — and `lib/documentScan.ts` now imports the calendar's writer, so leaving the rule where
 * it was made a CYCLE between the two modules. ESM tolerates that cycle today only because nothing
 * reads the binding while the modules are still evaluating; one later edit that did would break both
 * at import time, in a way no test would obviously explain.
 *
 * So the rule lives on its own, with no imports of its own, and both sides depend on it rather than on
 * each other. `lib/documentScan.ts` re-exports it, so every existing caller is unchanged.
 *
 * *** THERE IS EXACTLY ONE RULE, ON PURPOSE. *** A date's identity, a gap's quote check, a fact's
 * quote check and HR's handbook quotes all ask the same question — "is this the same sentence?" — and
 * two answers to it would mean a date whose quote verified could still fail to match itself.
 */
export const normaliseForQuote = (s: string) =>
  s.replace(/<[^>]*>/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, '')
