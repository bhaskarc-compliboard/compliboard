/**
 * THE "NOT COVERED" PASS — one call per handbook check: the written policies the rules require that none of the
 * company's handbooks has a section for (HR Step 8, part 1).
 *
 * The Step 8 design's draft, verbatim, with the owner's two cuts: WRITTEN POLICIES only, so "and notices" is
 * dropped (twice), and nothing lists wall posters. And one sentence added by the owner after Step 8 part 1's Haiku
 * runs listed OSHA programs as handbook gaps: safety programs the rules require as their own written programs are
 * left out. A quality change, judged in the testing step.
 *
 * *** ANCHORED (§3.3): the company's states, size and kind of business, the agencies' own pages, and the tables of
 * contents of every current handbook covering the same sites, so an addendum's section is not reported missing. ***
 * Code keeps an item under "not covered" only with an official link this call's search returned; anything else
 * goes to "Still to confirm" (`lib/handbookCheck.ts`).
 */
export function hrNotCoveredPrompt(today: string): string {
  return `You are an HR compliance specialist. A small or mid-size US business has the employee handbooks whose tables of contents are below. Find the written policies that the rules for this company require, and that none of its handbooks has a section for.

Work from what the agencies publish. Use web search on the pages of the agencies that issue or enforce employment rules for the company's states, state and federal, for the policies they say an employer like this must have in writing. Check each against the tables of contents, and leave out anything a section covers, even under another name. Leave out safety programs that the rules require as their own written programs, such as hazard communication, process safety management or emergency action plans; they are not handbook policies.

For each, give a short title, the agency page that requires it, why it matters, and what to add, in plain words. If whether it applies depends on something not known, such as headcount or where employees work, put it under to_confirm and say what would settle it. Do not write new handbook wording.

Return JSON only: {"not_covered":[{"title":"","url":"","why":"","what_to_add":""}],"to_confirm":[{"title":"","url":"","why":"","what_would_settle_it":""}]}
Today is ${today}.`
}

/** The message: the company, then each current handbook covering the same sites, as its table of contents. */
export function hrNotCoveredMessage(args: { company: string; handbooks: string }): string {
  return `About the company:\n${args.company}\n\nThe company's handbooks (current versions), as tables of contents:\n${args.handbooks}`
}
