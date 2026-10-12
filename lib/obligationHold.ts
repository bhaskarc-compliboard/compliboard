/**
 * *** A BIG DROP IN THE REQUIREMENTS WAITS FOR A PERSON *** — the owner's decision **D2**,
 * 12 October 2026 (`docs/reports/jobE-independent-review.md` §7), out of E9 item 5 and N7.
 *
 * Job E's W1 stopped a failed read from closing a company's requirements. That was right, and it is
 * the fix this product most needed: before it, a database hiccup during an ordinary afternoon of
 * answering questions closed 200 obligations and the page said "we found none that apply to you.
 * That is a result, not a gap."
 *
 * What it left behind, measured on staging in E9 item 5: a company that legitimately stops being a
 * chemical manufacturer — `industry: 'other'`, a real choice on the Company information page — gets
 * **500 from `/api/obligations` for ever**. The guard was doing its job; there was simply no way
 * out of the state it protected. And `/api/switches/answer` told the person "Nothing has been
 * changed" after it had already saved their answer, which was false.
 *
 * THE DECISION, IN THREE PARTS:
 *
 *   1. **The page always loads.** A recompute that would close all of the open list, or more than
 *      half of it, closes nothing. The list stays and a note sits on top asking the question.
 *   2. **The threshold is internal.** No percentage is ever shown — `HOLD_RULE` is here with the
 *      tests that pin its edges rather than in a column default, because a rule in the database is
 *      a rule nobody can test. A normal answer that drops a handful never triggers it.
 *   3. **The person decides.** "Yes, they no longer apply" closes them, recorded as closed by that
 *      person on that date (migration 081). "No, change my industry back" goes to Company
 *      information; "Keep them" when the industry did not change.
 *
 * Pure, with no database and no request, so every sentence a customer reads is testable
 * (`tests/unit/obligationHold.test.ts`).
 */

/**
 * *** HOW BIG IS "A BIG DROP". *** All of the open list, or more than half of it.
 *
 * `> half`, not `>= half`: a company with two requirements that genuinely loses one is an ordinary
 * answer, and stopping to ask about it would make the hold the common case rather than the alarming
 * one. At 200 open, 101 holds and 100 does not.
 *
 * And a company with NOTHING open can never hold: there is nothing to lose, the write proceeds, and
 * the timestamp is stamped. That is the state migration 022 exists to record, and it is how
 * "computed and nothing applies" stays different from "never computed".
 */
export const HOLD_RULE = {
  words: 'all of the open list, or more than half of it',
  holds: (openTotal: number, wouldClose: number): boolean =>
    openTotal > 0 && wouldClose > 0 && (wouldClose === openTotal || wouldClose * 2 > openTotal),
} as const

/** What the resolver saw at the moment it held, as migration 083 stores it. */
export interface Hold {
  held_at: string
  open_total: number
  would_close: number
  industry: string | null
  /** Does the library carry any live requirement for that industry at all? */
  industry_has_library: boolean
  /** Was any answer of theirs newer than the last successful recompute? */
  answer_changed: boolean
}

export interface HoldButton {
  /** What the button says. */
  label: string
  /** `confirm` closes them; `industry` goes to Company information; `keep` dismisses the note. */
  action: 'confirm' | 'industry' | 'keep'
}

export interface HoldNote {
  lines: string[]
  buttons: HoldButton[]
}

/** The industry's own words, when we have them; the stored slug is never shown raw. */
export type IndustryLabel = (slug: string | null) => string | null

/**
 * `chemical-manufacturing` → `Chemical manufacturing`.
 *
 * There is no table of industry display names — the dropdown is built from the library's own
 * `industries` arrays (`app/api/industries/route.ts`), so the slug IS the name — and a hyphenated
 * slug in the middle of a sentence to a customer reads as a bug. The same transformation
 * `lib/companyContext.ts` already makes for the prompt, with the sentence's capital.
 */
export const industryWords: IndustryLabel = (slug) => {
  const words = String(slug ?? '').replace(/[-_]+/g, ' ').trim()
  if (!words) return null
  return words[0].toUpperCase() + words.slice(1)
}

/**
 * *** THE NOTE, WORD FOR WORD AS THE OWNER WROTE IT (D2.1). ***
 *
 * Two openings, because the two situations are not the same thing and a person can act on only one
 * of them: an industry we have no library for is a gap on our side, and anything else is their own
 * answers adding up to a result they should look at.
 *
 * `previousIndustry` is the industry the open requirements were written for, read from the library
 * rows behind them. It can be unknown — a company may have been through two industries — and the
 * sentence then names no old industry rather than naming the wrong one.
 */
export function holdNote(hold: Hold, label: IndustryLabel, previousIndustry: string | null): HoldNote {
  const lines: string[] = []
  const buttons: HoldButton[] = []
  const now = label(hold.industry)
  const was = label(previousIndustry)

  if (!hold.industry_has_library) {
    // THE INDUSTRY CHANGED to one the library does not cover.
    lines.push(
      `Your industry is now ${now ?? 'not one we have a list for'}. We don't have a list of `
      + `requirements for that industry yet, so the ${hold.would_close} `
      + `requirement${hold.would_close === 1 ? '' : 's'} from ${was ?? 'your previous industry'} `
      + 'would drop off. Have they stopped applying to you?')
    buttons.push({ label: 'Yes, they no longer apply', action: 'confirm' })
    buttons.push({ label: 'No, change my industry back', action: 'industry' })
  } else {
    lines.push(
      `Your latest answers would remove ${hold.would_close} of your ${hold.open_total} `
      + 'requirements. Have they stopped applying to you?')
    buttons.push({ label: 'Yes, they no longer apply', action: 'confirm' })
    buttons.push({ label: 'Keep them', action: 'keep' })
  }

  // AND IF NOTHING OF THEIRS CHANGED, it is probably us. Said last, because it is the sentence that
  // tells them this may not be their doing at all — and never said when an answer of theirs is
  // newer than the last recompute, because then it did change and saying otherwise is a lie.
  if (!hold.answer_changed) {
    lines.push("If you didn't change anything, this is likely a problem on our side — please tell us.")
  }

  return { lines, buttons }
}

/**
 * *** WHAT THE QUESTION PAGE SAYS (D2.3). ***
 *
 * It said **"Nothing has been changed"**, and that was false: `/api/switches/answer` saves the
 * answer BEFORE `writeObligations` can hold or throw. The person's answer was recorded and they
 * were told it was not. This says what actually happened, and where the rest of it is waiting.
 */
export const ANSWER_HELD =
  'Your answer is saved. It would change your requirements a lot, so we\'ve held that for you to '
  + 'confirm on the Requirements page.'

/**
 * *** AN INDUSTRY THE LIBRARY DOES NOT COVER (D2.4). ***
 *
 * It replaces "we found none that apply to you. That is a result, not a gap." **for that case
 * only** — a company with no open requirements and an industry we have nothing for. For a company
 * whose industry IS covered and whose answers genuinely resolve to nothing, the old sentence is
 * still the true one and still shown.
 */
export const NO_LIBRARY_FOR_INDUSTRY =
  "We don't have requirements for this industry yet. That's a gap on our side — it doesn't mean "
  + 'none apply to you.'
