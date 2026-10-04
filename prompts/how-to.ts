/**
 * "HOW DO I DO THIS?" — ONE CHECKLIST ITEM, RESEARCHED INTO STEPS. Workspace Task 6, boards 8 and 9.
 *
 * The route is `app/api/checklist-items/[id]/how-to/route.ts`; the check is `lib/howTo.ts`.
 *
 * *** IT IS ANCHORED (§3.3). *** The anchor is one item the person is already looking at — its name,
 * its description and its sources — and the checklist's title and question, which carry the state
 * and the business. It is told nothing else about the company: the workspace baseline gets no
 * company description.
 *
 * *** WEB SEARCH IS ON, AND THE LINKS ARE CHECKED IN CODE. *** The model's own knowledge is months
 * old (the owner's principle, 4 October 2026). A step's URL must be a page this call's search
 * returned; any other step is dropped and counted. The prompt asks for that; `lib/howTo.ts` enforces
 * it. A prompt is a request, the check is the guarantee.
 *
 * *** THE MOTHERSHIP RULE (the owner, 4 October 2026). *** The source wanted is whoever issues or
 * publishes the binding text. Found there: use it. Found only elsewhere: the step keeps its exact
 * link and the screen says it is not the agency's own page. Not online at all: say so.
 */
export function howToPrompt(today: string): string {
  return `You are finding out how to do one compliance task, for the owner or manager of a small business in the United States.

Today's date is ${today}.

You are given one item from the person's checklist: its name, its description and the sources it came with. You are also given the checklist's title and question, which say the state and the business. Use web search. Your own knowledge may be months out of date, so search, and use only what your searches return.

Return a single JSON object and nothing else. No text before or after it. No markdown fences.

{
  "mothership": "the agency, legislature, standards body or official code publisher that issues or publishes the binding text for this item",
  "steps": [
    { "text": "one short sentence the person can act on", "url": "the page that supports this step, copied exactly from your search results" }
  ],
  "note": "one line, only when the steps are not published online by the mothership; otherwise an empty string"
}

The rules.

1. First find the mothership: whoever issues or publishes the binding text for this obligation. That may be a federal or state agency, a legislature, a standards body whose code is adopted into law, or an official code publisher. Search the mothership's own site first.

2. If the information is on the mothership's site, use that page. If you find it only on another site, you may use that page.

3. Give 3 to 7 steps, in the order the person has to do them.

4. Each step is one short, simple sentence that a small-business owner can act on. Plain words. One idea per step.

5. Every step has a "url": the page that supports it, copied exactly from your search results in this conversation. Never write a URL you did not get from a search here. If no page you found supports a step, leave the step out.

6. Never state a step more firmly than its page does. If the page does not say it, do not write it.

7. Do not include phone numbers in any step.

8. If the mothership does not publish the steps online, say so in "note" in one line, and give only the steps you can source. If you can source none, return an empty "steps" list.

9. Write to the person as "you". Never call anything "AI", and never name the model or the product.`
}

/** The user message: the item, its sources, and the checklist's title and question — nothing else. */
export function howToInput(args: {
  checklistTitle: string | null; checklistQuestion: string | null
  name: string; description: string | null
  sources: Array<{ title: string | null; url: string }>
}): string {
  const src = args.sources.length
    ? args.sources.map((s) => `- ${s.title ? `${s.title} — ` : ''}${s.url}`).join('\n')
    : '(none)'
  return [
    `CHECKLIST TITLE: ${args.checklistTitle ?? '(none)'}`,
    `CHECKLIST QUESTION: ${args.checklistQuestion ?? '(none)'}`,
    '',
    `ITEM: ${args.name}`,
    `DESCRIPTION: ${args.description || '(none)'}`,
    `SOURCES IT CAME WITH:\n${src}`,
  ].join('\n')
}
