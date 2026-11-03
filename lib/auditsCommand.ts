/**
 * THE LOOKER — what the Ask box's sentence asks for, decided in code.
 * `docs/GAPS-PLAN.md` Part A step 6b (decisions 32 and 38).
 *
 * *** IT IS ITS OWN FILE FOR TWO REASONS, AND THE SECOND IS THE ONE THAT MATTERS. ***
 * The small one: `node --test` cannot load a `.tsx`, so a pure function that lives in a page
 * cannot be tested without a browser. The real one: **this is the product's first rule in one
 * function** (`CLAUDE.md` §1 — *"what's missing is a database query and never an AI guess"*), and
 * a rule that decides whether the product spends money belongs where it can be read and held to
 * account, not three hundred lines inside a component.
 */
/* ── THE LOOKER ────────────────────────────────────────────────────────────
 *
 * *** THE ASK BOX TAKES COMMANDS AS WELL AS QUESTIONS, AND WHICH IT IS IS DECIDED HERE, IN
 * CODE, WITH NO MODEL CALL — the owner, 3 November 2026 (decisions 32 and 38). ***
 *
 * This is `submitAsk`'s matching, which lived in this file from the first build and has been
 * deleted from it: the agency labels the company's own readings produced, longest first so
 * "Oregon OSHA" wins over a shorter label contained in it; "everything" or "all"; a file;
 * and the agency names as one-click choices when nothing matched. The reason it is code and
 * not a model is `CLAUDE.md` §1: *"what's missing is a database query and never an AI guess"*,
 * and a box that asked a model which agency a sentence meant would be guessing at something
 * the database knows.
 *
 * *** THE AUDIT WORD COMES FIRST, AND IT IS THE WHOLE OF DECISION 38. ***
 * The old box only ever started audits, so a bare agency name was enough. This box answers
 * questions too, and the agency names are in the questions: *"Do we have all our permits?"*
 * contains "all", and *"Are we ready for a DEQ inspection?"* contains an agency label. Without
 * a word that says AUDIT, both would start a run instead of being answered. So nothing below
 * runs until the sentence contains "audit" as a word, in any of its forms.
 */
export const AUDIT_WORD = /\baudit(s|ed|ing)?\b/i

/**
 * *** AND A QUESTION IS NOT A COMMAND, EVEN WHEN IT SAYS "AUDIT" — found by walking step 6b. ***
 *
 * Decision 38 said the word "audit" must be present before anything matches, and that is
 * necessary. **It is not sufficient, and the walk proved it in one line:** *"What did the last
 * Oregon DEQ audit find about the scrubber log?"* has the word AND an agency label in it, and the
 * looker started a run. The harness caught it — `BLOCKED (1): paid route: POST /api/audit-runs` —
 * on a sentence that is plainly a question about an audit that has already happened.
 *
 * The failure is the same shape as the one decision 38 exists to prevent, pointing the other way:
 * a word in a question made the product spend money and write rows. So a second rule, and it is
 * the one a person would give: **a command is an imperative.** A sentence that ends in a question
 * mark, or opens with a question word, is a question.
 *
 * *** IT FAILS SAFE, AND THAT IS WHY THIS SHAPE AND NOT A LONGER LIST OF VERBS. *** The sentence
 * it gives away is *"Can you audit us for DEQ?"* — a real request to be audited that now reaches
 * the model instead of starting a run. That is not a loss: it is **exactly the case decision 41
 * built the offer card for**, so the person is asked *"Do you want me to run the Oregon DEQ
 * audit?"* and presses once. A looker that guesses wrong in this direction costs one click; one
 * that guesses wrong in the other costs a model call, an audit run and a row nobody asked for.
 */
export const QUESTION_OPENER =
  /^\s*(what|which|who|whom|whose|when|where|why|how|do|does|did|is|are|was|were|am|can|could|should|shall|would|will|have|has|had|may|might|must)\b/i
export const looksLikeAQuestion = (text: string): boolean =>
  /\?\s*$/.test(text.trim()) || QUESTION_OPENER.test(text)

/**
 * What the sentence asks for, or null for "this is a question". Pure, exported through the
 * page's own tests: no fetch, no state, no model.
 */
export type Command =
  | { kind: 'template' }
  | { kind: 'agency'; agency: string; scope: string | null }
  | { kind: 'choose' }
export function readCommand(text: string, agencies: string[], hasFile: boolean): Command | null {
  const q = text.trim()
  if (!AUDIT_WORD.test(q)) return null
  // The word is there; now it has to be an instruction and not a question about one.
  if (looksLikeAQuestion(q)) return null
  const lower = q.toLowerCase()
  // A file on this turn, or words that name one. "Audit us against the attached template" with
  // nothing attached cannot be answered without a file, so it asks for one rather than refusing.
  if (hasFile || /\b(checklist|template|attached|attach)\b/.test(lower)) return { kind: 'template' }
  if (/\b(everything|all|every agency|all agencies)\b/.test(lower)) {
    return { kind: 'agency', agency: 'all', scope: q }
  }
  const hit = [...agencies].sort((a, b) => b.length - a.length)
    .find((a) => lower.includes(a.toLowerCase()))
  if (hit) {
    // The rest of the sentence is kept as the scope, verbatim: "for the Portland plant only"
    // is the person's own words about what they meant, and it is shown back to them on the run.
    const rest = q.replace(new RegExp(hit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim()
    return { kind: 'agency', agency: hit, scope: rest || q }
  }
  return { kind: 'choose' }
}
