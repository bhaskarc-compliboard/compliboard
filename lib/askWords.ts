/**
 * THE WORDS THE ANSWER'S CHECK PUTS ON THE SCREEN — E3, 5 November 2026.
 *
 * One string lives here, and it is here for the reason `lib/summaryWords.ts` exists (HR Step 3a):
 * **a browser component needs it and may not reach the module that writes it.**
 * `lib/ask/passages.ts` appends it to a quote it could not find, and
 * `components/AnswerBody.tsx` now lifts it out of the running text and draws it as a note
 * (decision 68) — so the check and the screen both need the same characters, and
 * `lib/ask/passages.ts` imports `lib/documentScan.ts`, which a client file must not reach.
 *
 * *** THIS FILE IMPORTS NOTHING, AND MUST NOT. *** `tests/unit/clientImports.test.ts` holds it.
 * `lib/ask/passages.ts` re-exports the constant, so every existing caller is unchanged.
 */

/** The words a quote found in nothing carries. The product's own voice, never a code. */
export const NOT_IN_WHAT_WE_HAVE = '(we could not find these words in what we have on file)'

/**
 * *** AN HONESTY LINE IS A NOTE, NOT A SENTENCE IN THE ANSWER — decision 68, 5 November 2026. ***
 *
 * `finishAnswer` appends the product's own words to a quote it could not find — *"(we could not
 * find these words in what we have on file)"* — and until E3 they sat in the middle of the
 * running text, in the reading face, as though the model had written them. They are the
 * PRODUCT's words about the ANSWER, so they are drawn where the product speaks: a quiet grey
 * note with a mark, after the body.
 *
 * **Not a word of the model's text is changed, and nothing is hidden.** The marker is lifted out
 * and counted; the note says how many quotes it happened to. The quotes themselves stay exactly
 * where the model put them, which is the point — a reader sees the quote, and sees below that
 * one of the quotes on this answer could not be matched.
 *
 * *** AND THE OTHER THREE LINES decision 68 NAMES CANNOT MOVE, WHICH IS SAID RATHER THAN FAKED. ***
 *   · *"not audited yet"* is `prompts/audits-answer.ts` `AUDITS_NOT_AUDITED_YET` — an
 *     INSTRUCTION, so the sentence on the screen is the model's own words in its own place.
 *     Lifting it would need a prompt change (§3.1), which E3 is not.
 *   · *"readings as of …"* is the same: a rule in the answer prompts, written by the model.
 *   · the **Queued** sentence (`lib/topicClaim.ts` `CLAIM_WORDS`) is already drawn by the screen
 *     outside the answer, as its own line. There is nothing to move.
 */
export function splitHonesty(text: string): { body: string; refused: number } {
  const parts = text.split(NOT_IN_WHAT_WE_HAVE)
  if (parts.length === 1) return { body: text, refused: 0 }
  // The space the marker was separated by goes with it; nothing else is touched.
  return { body: parts.join('').replace(/[ \t]{2,}/g, ' ').replace(/ ([.,;:)])/g, '$1'), refused: parts.length - 1 }
}

/** The note's own words — the product's, counted. */
export const REFUSED_NOTE = (n: number) =>
  `${n === 1 ? 'One quote' : `${n} quotes`} in this answer could not be matched, word for word, to the file `
  + `${n === 1 ? 'it' : 'they'} came from. ${n === 1 ? 'It is' : 'They are'} shown as the answer wrote `
  + `${n === 1 ? 'it' : 'them'}, and ${n === 1 ? 'it has' : 'they have'} no source card.`
