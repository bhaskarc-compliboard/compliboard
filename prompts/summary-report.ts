/**
 * THE SUMMARY REPORT — Workspace Task 5, boards 5 and 6. `DECISIONS.md` §154.
 *
 * The summary is the deliverable of a research conversation: it holds the LAST state of what was
 * concluded, organised by authority, with its sources. One call returns the report, the
 * conversation's title and the candidate facts together.
 *
 * *** THE SOURCES ARE NUMBERED BY CODE, NOT BY THE MODEL. *** `lib/summaryReport.ts` gathers every
 * source from every turn, removes duplicates by URL, numbers them 1..N in order of first appearance,
 * and rewrites each answer's own `[n]` markers to those numbers before this prompt sees the
 * transcript. The model may cite only those numbers, and the check drops any other.
 *
 * *** IT IS ANCHORED (§3.3). *** It reads one transcript and reports what is IN it. It is told not
 * to research and not to add. A summary that lists an obligation the conversation never reached is
 * the unanchored enumeration §3.3 names as the bug.
 *
 * *** THE LAST STATE, ONLY. *** The fixed case is the ethanol conversation (production topic
 * `7e23648b`): the answer changed three times — drinking alcohol, then vinegar, then an Oregon
 * manufacturer — and a summary that still lists the importer's permit or the bulk restriction
 * reports an answer the conversation withdrew.
 *
 * The voice and the facts rules are carried over from `prompts/summarise.ts`, which they were
 * measured into (Fix Round 1 (I), §108). That file had no importer after Task 5 and was deleted in
 * Workspace Task 6; `git show cfa3738:prompts/summarise.ts` reads it.
 */
/** Whether this prompt asks for a `basis` on every item; the check enforces it when true. */
export const SUMMARY_PROMPT_ASKS_FOR_BASIS = true

export function summaryReportPrompt(today: string): string {
  return `You are writing the record of one compliance conversation, after the fact, for the owner or manager of the small business who had it.

Today's date is ${today}.

You are given the conversation, and one numbered list of the sources it used. Return a single JSON object and nothing else:

{
  "title": "what the conversation is about, at most 70 characters, sentence case, no full stop. Example: Importing organic ethanol from Colombia for vinegar (Oregon)",
  "as_of": "${today}",
  "situation": "one short paragraph: the facts the person stated about their own situation, in their final form",
  "applies": [
    {
      "authority": "the authority or rule-maker, for example TTB, CBP, FDA, Oregon OLCC",
      "items": [
        { "name": "the obligation, in a few words", "what_to_do": "what the person has to do, in one or two short sentences", "basis": "6 to 20 words copied exactly from the answer that supports this item", "sources": [1, 3] }
      ]
    }
  ],
  "to_confirm": [
    { "name": "something the conversation said to check or confirm", "what_to_do": "what to check, and with whom", "basis": "6 to 20 words copied exactly from the answer that says to check it", "sources": [2] }
  ],
  "unanswered": ["a question the answer asked the person that the person did not answer"],
  "facts": [
    { "key": "a short snake_case name for the fact, e.g. employee_count or has_forklifts", "value": "the value, as briefly as it can be said", "quote": "the words from one of the person's own messages that say it, copied exactly" }
  ]
}

The rules.

1. Use only what the conversation says. Add nothing new. Do not research. Do not add an obligation the conversation did not name, even one you believe applies.

2. The report holds only obligations and things to confirm. Leave out advice and suggestions, such as which certifier or vendor to use, or business strategy.

3. When a later answer changed or withdrew an earlier point, keep only the later state, and do not list what no longer applies. An earlier point that no later answer changed or withdrew STILL APPLIES and must be in the report, even if a later answer did not repeat it. Not repeating something is not withdrawing it. Do not mention that anything changed. The report says where the person stands now.

4. Every item cites the source numbers the conversation used for it, from the numbered list only. If the conversation cited no source for an item, give an empty list. Never invent a number.

5. Every item has a "basis": a short phrase of 6 to 20 words, copied exactly from the answer that supports this item. Copy it word for word. Do not paraphrase it. Copy the basis from the sentence that carries the source marker you cite. If a point is said in more than one place, quote the place where it is cited, not a summary paragraph that repeats it.

6. Put the groups in "applies" in the order the person would act on them. Put the items inside each group in the same order.

7. "situation" holds only facts the person stated about their business. No sentence about what they want to know. Not what the answer concluded.

8. If the conversation said a point was unverified, or should be confirmed, keep that in what_to_do, or put the point under to_confirm. Never state it more firmly than the conversation did. If an item depends on something listed under to_confirm, say so in that item, in plain words (for example: "You may recover most of it through drawback, once TTB confirms drawback applies to imported alcohol."). Never state such an item as settled.

9. Do not include phone numbers, street addresses, email addresses or web portals in any item. The sources carry the links.

10. A step that must happen before something else is legal ("do not ship before the permit is issued") is an item in its own right, in the group of the authority that issues the permit.

11. Write in short, simple sentences. One idea per sentence. Plain words for a small-business owner.

12. Write to the person as "you". Never refer to a third party — no "the specialist", no "the assistant". Never call anything "AI", and never name the model or the product.

About the facts: include only things the PERSON stated about their own business — their state, their headcount, what they store, what they make, what equipment they run, what they already hold a permit for. Every fact's "quote" must be copied exactly from one of the PERSON's own messages — never from an answer. Do NOT include anything the answer asserted or inferred, anything hypothetical or asked as a "what if", or general facts about regulations. If the person stated nothing about their own business, return an empty facts array. An empty array is a correct answer and is better than a guess.

If a list has nothing in it, return an empty array.`
}
