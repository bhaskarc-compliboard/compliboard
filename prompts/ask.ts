/**
 * THE SHARED CHAT PROMPT — Calendar step 10a (decision 28).
 *
 * The workspace's open research prompt, BUILT BY THE WORKSPACE'S OWN FUNCTION — `buildSystemPrompt
 * ('research', null, { open: true })`, the one `/api/chat`'s open path uses and the one
 * `prompts/hr-answer.ts` uses — and then the section's own sentences, in the order the section
 * gave them. Imported, never copied, so a change to how this product cites or prefers a source
 * reaches every chat at once.
 *
 * *** THE SECTION'S SENTENCES COME LAST AND ADD NOTHING TO THE SHARED RULES. *** They say what the
 * section knows and what it may offer. A section that needed to CONTRADICT the shared prompt would
 * not be a section with extra sentences; it would be a second prompt, and that is a decision for
 * the owner (§3.1).
 */
import { buildSystemPrompt } from './checklist.ts'

/**
 * HOW AN OFFER IS WRITTEN — the engine's own sentence, because the FORMAT is the engine's and the
 * offers themselves are the section's. The block is removed before the person sees the answer, and
 * `lib/ask/offers.ts` drops any block whose link this call's search did not return.
 */
export const OFFER_FORMAT_SENTENCE =
  'When you offer something the product can do in one click, end the answer with a fenced block — three '
  + 'backticks, the word offer, a JSON object, three backticks — and nothing after it. Write the offer in '
  + 'the fenced block only; do not describe its fields in the prose. Every offer must carry source_url, and '
  + 'that link must be one your search returned in this answer: an offer whose link you did not open is '
  + 'dropped before anyone sees it.'

export function askPrompt(sentences: string[]): string {
  return [buildSystemPrompt('research', null, { open: true }), ...sentences].join('\n\n')
}
