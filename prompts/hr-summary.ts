/**
 * HR'S SUMMARY — HR Step 7. The Step 7 design's draft, VERBATIM (the owner's decision); a quality change, to be
 * judged on Opus in the testing step (decision 17). The same JSON shape as the workspace's
 * (`prompts/summary-report.ts`), so `checkReport` serves both; the writer is `lib/summaryReport.ts`
 * summariseTopic with kind 'hr', and its sources are numbered by code (`lib/hrSummary.ts`).
 *
 * *** ANCHORED (§3.3): it reads one conversation and reports what is in it. ***
 *
 * The last two paragraphs are copied WORD FOR WORD from `prompts/summary-report.ts` (the owner, Step 7): how
 * "situation" is written (its rule 7, without the number) and what counts as a fact. Staging, 7 October: HR's
 * draft let a situation open with "You asked whether…" and proposed facts from the question's own words.
 */
export function hrSummaryPrompt(today: string): string {
  return `You are writing the record of one conversation about a company's employee handbooks, after the fact, for the owner or manager who had it.

Today's date is ${today}.

You are given the conversation and one numbered list of its sources. Some are passages of the company's own handbooks, with their exact words; the rest are web pages. Return one JSON object and nothing else:

{"title": "what the conversation is about, at most 70 characters, sentence case, no full stop",
 "as_of": "${today}",
 "situation": "one short paragraph: what the person said about their business and their staff, in its final form",
 "applies": [{"authority": "the agency or law the change answers to", "items": [{"name": "what to change, in a few words", "what_to_do": "what the handbook says now, what the rule needs, and what to change, in one or two short sentences", "basis": "6 to 20 words copied exactly from the answer that supports this item", "sources": [1, 3]}]}],
 "to_confirm": [{"name": "what is still to confirm", "what_to_do": "what to check, and with whom", "basis": "6 to 20 words copied exactly from the answer", "sources": [2]}],
 "unanswered": ["a question the answer asked the person that they did not answer"],
 "facts": [{"key": "snake_case name", "value": "the value", "quote": "the person's own words, copied exactly"}]}

Use only what the conversation says, and only its last state. Cite only numbers from the list; cite a handbook passage when the item rests on what the handbook says, and the rule's page when it rests on the rule. Copy each basis word for word from the sentence that carries the source you cite. Keep anything the conversation called unconfirmed under to_confirm, and never state it more firmly. Leave out suggested wording; the conversation keeps it. Write to the person as "you", in short plain sentences. Facts are only what the person said about their own business, quoted from their own messages; if they said none, return an empty list.

"situation" holds only facts the person stated about their business. No sentence about what they want to know. Not what the answer concluded. If the person stated nothing about their business, "situation" is an empty string; put missing details that would change the answer under to_confirm, as plain questions that say why they matter.

About the facts: include only things the PERSON stated about their own business — their state, their headcount, what they store, what they make, what equipment they run, what they already hold a permit for. Every fact's "quote" must be copied exactly from one of the PERSON's own messages — never from an answer. Do NOT include anything the answer asserted or inferred, anything hypothetical or asked as a "what if", or general facts about regulations. If the person stated nothing about their own business, return an empty facts array. An empty array is a correct answer and is better than a guess.`
}
