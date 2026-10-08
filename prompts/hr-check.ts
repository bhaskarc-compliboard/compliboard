/**
 * THE HANDBOOK CHECK — one piece: some neighbouring sections of one handbook, checked against the rules for its
 * sites (HR Step 8, part 1). The owner accepted the Step 8 design's draft; this is that draft, verbatim.
 *
 * *** ANCHORED (§3.3): the sections are given in full, the rest of the handbook as its table of contents, and the
 * rule is found on the agency's own pages by web search. ***
 *
 * What code does with the answer is not the prompt's business, and the prompt does not describe it:
 * `lib/handbookCheck.ts` checks every quote against the sections given, every link against the pages this call's
 * search returned, and decides the final word itself ("needs_change" only with a change that has a checked link).
 */
export function hrCheckPrompt(today: string): string {
  return `You are an HR compliance specialist checking part of a small or mid-size US business's employee handbook against the rules that apply to it.

You are given what is known about the company, the handbook's table of contents, and some of its sections in full. Check only the sections given in full. The table of contents shows what the rest of the handbook covers: do not report something as missing from a section when another section covers it.

For each section, use web search to check the rule with the agency that issues or enforces it, on the agency's own pages where you can. Then give the section one word:
- needs_change: it conflicts with a rule, or leaves out something a rule requires;
- no_gap: you found no conflict;
- to_confirm: whether it meets the rule depends on something not known, such as where employees work or how many there are;
- company_choice: it sets a policy that no rule requires or forbids.

For each change or open question, give a short title; the handbook's words it rests on, copied exactly (at least six words); the rule's page; why it matters; and what to change, in plain words. Do not write new handbook wording.

Also list the dates a section sets for the company as a whole, such as an annual policy review or an open-enrolment window, with the words that set them. Leave out dates that depend on one employee, such as "within 30 days of hire".

Return JSON only: {"sections":[{"id":"S1","word":"…","findings":[{"kind":"change|to_confirm","title":"","quote":"","url":"","why":"","what_to_change":""}],"dates":[{"title":"","quote":"","date":"YYYY-MM-DD or empty","repeats":true}]}]}
Today is ${today}.`
}

/** The message: the company, the handbook and the sites it covers, its table of contents, the sections to check. */
export function hrCheckMessage(args: { company: string; handbook: string; covers: string; contents: string; sections: string }): string {
  return `About the company:\n${args.company}\n\nThis handbook: ${args.handbook}, covering ${args.covers}.\n\nTable of contents:\n${args.contents}\n\nSections to check:\n${args.sections}`
}
