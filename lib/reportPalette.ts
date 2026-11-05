/**
 * THE REPORTS' ONE PALETTE — E1a (board 1 of `docs/audit-report-boards.html`), moved here at E2.
 *
 * *** WHY IT IS A FILE OF ITS OWN. *** It began inside `components/AuditReport.tsx`, moved to
 * `lib/auditRows.ts` when the binder needed it (Part C), and moves again now because the SUMMARY
 * report's five cards are coloured from it too (decision 62). Three readers in three sections is
 * the moment a palette stops being one report's business.
 *
 * *** IT IMPORTS NOTHING, AND MUST NOT. *** `lib/auditRows.ts` re-exports it and is itself kept
 * free of anything that reaches `lib/ai.ts`, so the binder can never start counting as a paid
 * route (`scripts/check-schema-contracts.js`, `PAID_COUNT`). A colour file with a dependency is
 * how that rule would break.
 */

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
/**
 * A line nobody answered is not a sixth word: it is the absence of one, so it is an outline and
 * not a tint — a hole in the row rather than a verdict. The strip has drawn it this way since E1.
 */
export const TINT_NO_ANSWER = 'border border-dashed border-[var(--amber)] bg-white text-[var(--amber)]'

/**
 * *** THE SUMMARY REPORT'S FIVE CARDS — decision 62, 4 November 2026. ***
 *
 * Each card has a coloured left edge and a tinted header: *Your situation* grey · *What applies*
 * green · *Still to confirm* **blue** · *Not answered here* and *Sources* a pale grey that says
 * "this is here if you want it" rather than "look at this".
 *
 * *** STILL TO CONFIRM IS BLUE, AND E2 HAD IT AMBER FOR A DAY — corrected at E2a by the owner,
 * 4 November 2026. *** E2 read decision 62's "amber" and said so out loud, because board 2 drew
 * it blue and the rule is that the brief wins. The owner corrected the DECISION instead: **amber
 * means a document falls short** — it is the audit report's word for *on file, gaps found* and
 * *out of date* — and a thing the conversation could not settle is not that. It is a question,
 * and a question is blue. `#3B6FA6` on `#E6EFF9`, which is board 2's own `.s-con`.
 *
 * So this is the one card whose edge is NOT `border-l-current`: the board's header text there is
 * the ordinary dark grey, not the blue, and `currentColor` would have made the heading blue too.
 *
 * *** THE EDGE IS `border-l-current`, WHICH IS WHY THERE IS NOT ONE NEW VALUE HERE. *** The header
 * already sets its text to the tint's ink, and `currentColor` is that ink — so the left edge is
 * the same colour by construction and cannot be changed in one place and not the other. Writing
 * `border-l-[#1F5A3A]` would have been the second copy of a hex the file exists to hold once. The
 * pale pair is the one addition, and it is Tailwind's `gray-50`/`gray-500` rather than a sixth
 * hex, because a card that is deliberately quiet should not need a colour of its own.
 */
export const CARD_SITUATION = `${TINT_GREY} border-l-current`
export const CARD_APPLIES = `${TINT_GREEN} border-l-current`
export const CARD_CONFIRM = 'bg-[#E6EFF9] text-gray-800 border-l-[#3B6FA6]'
export const CARD_QUIET = 'bg-gray-50 text-gray-500 border-l-gray-300'
