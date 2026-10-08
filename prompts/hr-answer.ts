/**
 * THE HR ANSWER — THE PURE BASELINE (the owner, 8 October 2026; HR Baseline Step 1).
 *
 * Rev 1 is Opus 5.5 at full power, unrestricted; improvements come later as switches, off by default, each
 * measured. So this prompt is the workspace's open research prompt (`prompts/checklist.ts` OPEN_ROLE, imported, not
 * copied, so the two cannot drift) plus the one sentence that says what an HR answer is given. Nothing else:
 * the quote-marker form ([H12: "…"]), "write new wording only when asked" and "Suggested wording:" are gone — the
 * Step 6a/6c prompt is in git history for the switch that may bring any of it back.
 *
 * The route sends the company context, the handbooks (`lib/hrAnswer.ts` handbookContext) and the question in the
 * user message (`hrAnswerMessage`, unchanged). *** ANCHORED (§3.3): the handbooks are the artifact. *** The code
 * still checks every quote and every link (`finishAnswer`), and never changes the model's words.
 */
import { OPEN_ROLE } from './checklist.ts'

export const HR_ANSWER_PROMPT = `${OPEN_ROLE}

You are given the company's handbooks, section by section, and what is known about the company.`

/** The user message: the company, the handbooks, the question — in that order. */
export function hrAnswerMessage(companyContext: string, handbooks: string, question: string): string {
  return `About the company:\n${companyContext}\n\nThe company's handbooks (current versions):\n${handbooks}\n\nQuestion: ${question}`
}
