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
 "dates": [{"title": "what is due, in a few words", "day": "YYYY-MM-DD, or null if the conversation gives no day", "how_often": "every month, every three months, every year, or null", "line": "6 to 25 words copied exactly from the conversation that give this date", "sources": [1]}],
 "facts": [{"key": "snake_case name", "value": "the value", "quote": "the person's own words, copied exactly"}]}

Use only what the conversation says, and only its last state. Cite only numbers from the list; cite a handbook passage when the item rests on what the handbook says, and the rule's page when it rests on the rule. Copy each basis word for word from the sentence that carries the source you cite. Keep anything the conversation called unconfirmed under to_confirm, and never state it more firmly. Leave out suggested wording; the conversation keeps it. Write to the person as "you", in short plain sentences. Facts are only what the person said about their own business, quoted from their own messages; if they said none, return an empty list.

"situation" holds only facts the person stated about their business. No sentence about what they want to know. Not what the answer concluded. If the person stated nothing about their business, "situation" is an empty string; put missing details that would change the answer under to_confirm, as plain questions that say why they matter.

About the dates: list each deadline the conversation gave the person for something they must do — file, renew, report, inspect, pay, post, train. Give the day the conversation states. If it states a day and a month but no year, give the next time that day comes, on or after today. If it states no day at all — "within 30 days of hiring", "every quarter" — give null; never work one out. Give how_often only when the conversation says the date comes round again, and only as often as it says. Every date has a "line": 6 to 25 words copied exactly, word for word, from the conversation — from an answer, or from the person's own message — that give this date. Cite the sources the answer used for it; for a date the person said, give an empty list. Leave out dates that are only history, such as when a rule took effect, examples, and anything a later answer withdrew. If the conversation gave no deadlines, return an empty dates array. An empty array is a correct answer and is better than a guess.

About the facts: include only things the PERSON stated about their own business — their state, their headcount, what they store, what they make, what equipment they run, what they already hold a permit for. Every fact's "quote" must be copied exactly from one of the PERSON's own messages — never from an answer. Do NOT include anything the answer asserted or inferred, anything hypothetical or asked as a "what if", or general facts about regulations. If the person stated nothing about their own business, return an empty facts array. An empty array is a correct answer and is better than a guess.`
}
