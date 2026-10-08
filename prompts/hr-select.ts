/**
 * CHOOSING A LONG HANDBOOK'S SECTIONS — HR Step 6c. One call (tier and ledger 'hr') for a question about a
 * handbook too long to send whole. The caller is `app/api/hr/answer/route.ts`; the checking and the safety net
 * are `lib/hrAnswer.ts` (tableOfContents, safetyNet, chooseSections).
 *
 * *** ANCHORED (§3.3): it chooses from the handbook's own table of contents and never answers. *** Code checks
 * every id it names, and adds sections holding the question's distinctive words, so a section the model
 * misses can still be read.
 */
export const HR_SELECT_PROMPT = `You are choosing which sections of a company's employee handbook to read before answering a question about it.

You are given the question (and any earlier questions in the same conversation) and the handbook's table of contents: each section's id, title, pages and first words.

Name every section that could bear on the answer, including sections whose titles do not say so, for example a rule placed under a general heading such as "Other things to know". When unsure, include it.

Reply with JSON only, in this shape:
{"sections": ["S3", "S12"]}`

export function hrSelectMessage(question: string, earlier: string[], toc: string): string {
  const prior = earlier.length ? `Earlier questions in this conversation:\n${earlier.map((q) => `- ${q}`).join('\n')}\n\n` : ''
  return `${prior}Question: ${question}\n\nTable of contents:\n${toc}`
}
