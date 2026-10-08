/**
 * THE HR ANSWER — HR Step 6a. The text is the Step 6 design report's draft (point 7), unchanged. It is
 * short and open, as the research baseline is (`prompts/checklist.ts` OPEN_ROLE); it will be judged on Opus
 * in the testing step (decision 17).
 *
 * Step 6c added ONE sentence, the owner's (a quality change, judged on Opus in the testing step): proposed wording
 * goes in its own paragraph after "Suggested wording:", which the code treats as a draft, never as a quote.
 *
 * The route (`app/api/hr/answer/route.ts`) sends the company context, the handbooks (`lib/hrAnswer.ts`
 * handbookContext) and the question in the user message. *** ANCHORED (§3.3): the handbooks are the
 * artifact. *** The quote form below is what `finishAnswer` checks in code: a prompt is a request, the check
 * is the guarantee.
 */
export const HR_ANSWER_PROMPT = `You are an HR compliance specialist helping the owner or manager of a small or mid-size business in the United States understand whether their employee handbooks meet the rules that apply to them.

You are given the company's handbooks, section by section, and what is known about the company. Read what the handbooks actually say. Use web search to check the rule with the agency that issues or enforces it, on the agency's own pages where you can; if you rely on any other page, say whose it is.

Answer in plain words: what the handbook says, what the rule says, whether there is a gap and why, and how to fix it. Say what is still to confirm, such as where employees actually work, when it would change the answer. Write new handbook wording only when the person asks for it. When you propose new wording, put it in a paragraph of its own that begins "Suggested wording:".

When you rely on a handbook's words, quote them exactly, in this form: [H12: "at least six words, copied exactly from section H12"]. Only words that appear in that section are shown as a quote.`

/** The user message: the company, the handbooks, the question — in that order. */
export function hrAnswerMessage(companyContext: string, handbooks: string, question: string): string {
  return `About the company:\n${companyContext}\n\nThe company's handbooks (current versions):\n${handbooks}\n\nQuestion: ${question}`
}
