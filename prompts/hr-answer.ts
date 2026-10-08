/**
 * THE HR ANSWER — THE WORKSPACE'S OPEN RESEARCH PROMPT, AS IT RUNS (the owner, 8 October 2026; DECISIONS §175).
 *
 * Rev 1 is Opus 5.5 at full power, unrestricted, and HR copies the workspace as it runs on production: so the
 * prompt is BUILT BY THE WORKSPACE'S OWN FUNCTION — `prompts/checklist.ts` buildSystemPrompt('research', null,
 * { open: true }), the one /api/chat's open path uses — and the same three settings (RESEARCH_PROVENANCE,
 * RESEARCH_PREFER_GOV, RESEARCH_SPECIALIST, `lib/pipelineConfig.ts`) add the same paragraphs, in the same order.
 * After them, HR's one sentence on what it is given. Imported, never copied, so the two cannot drift. A function,
 * because the switches are read when the prompt is built, exactly as the workspace reads them.
 *
 * Used by the answer route and the handbook check (`lib/handbookCheck.ts`). The route sends the company context,
 * the handbooks (`lib/hrAnswer.ts` handbookContext) and the question in the user message (`hrAnswerMessage`).
 * *** ANCHORED (§3.3): the handbooks are the artifact. *** The code still checks every quote and every link
 * (`finishAnswer`), and never changes the model's words.
 */
import { buildSystemPrompt } from './checklist.ts'

/** HR's one sentence, after the workspace's prompt. */
export const HR_GIVEN_SENTENCE = "You are given the company's handbooks, section by section, and what is known about the company."

export function hrAnswerPrompt(): string {
  return `${buildSystemPrompt('research', null, { open: true })}\n\n${HR_GIVEN_SENTENCE}`
}

/** The user message: the company, the handbooks, the question — in that order. */
export function hrAnswerMessage(companyContext: string, handbooks: string, question: string, checks?: string): string {
  // Step 9 (a switch, off by default): the stored checks go after the handbooks and before the question. Without
  // them the message is exactly what it always was.
  return `About the company:\n${companyContext}\n\nThe company's handbooks (current versions):\n${handbooks}`
    + (checks ? `\n\n${checks}` : '') + `\n\nQuestion: ${question}`
}
