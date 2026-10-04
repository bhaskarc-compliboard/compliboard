/**
 * CONVERSATION → CHECKLIST — `DECISIONS.md` §125, Run 2 Task 3; rewritten in Workspace Task 6.
 *
 * Two scopes, and the difference is what the model is allowed to bring:
 *
 *   discussed  "Just what we discussed". Only what this conversation said, held to the summary
 *              report's rules (`prompts/summary-report.ts`), adapted to a checklist. The sources are
 *              NUMBERED BY CODE (`lib/summaryReport.ts` `numberedTranscript`), and every item carries
 *              a "basis" — words copied from the answer — which `lib/checklistConvert.ts` checks with
 *              the summary's own `checkCitations`. A basis not found clears the item's sources.
 *
 *   complete   "Everything on this subject". The discussed items, plus whatever else the subject
 *              needs. The additions are marked `origin = 'added'` ("newly checked" on screen). Since
 *              Workspace Task 6 (the owner's decision at STOP 1) it SEARCHES THE WEB, and an added
 *              item may carry only a link this call's search returned (`checkAddedLinks`, which uses
 *              `lib/howTo.ts`'s link check and labels). A link that fails is removed: "No source found".
 *
 * Both scopes return THREE GROUPS (Workspace Task 6, board 8):
 *   must_do       legal obligations, in the order the person has to act;
 *   good_to_have  "Worth doing" on screen — advice, not a legal rule;
 *   to_confirm    open questions to check.
 *
 * *** THIS IS ANCHORED (§3.3). *** Both scopes are given the transcript and asked what is in it or
 * what it implies. Neither asks the model to enumerate a subject from nothing.
 */

/** Whether the discussed prompt asks for a `basis` on every item; the check enforces it when true. */
export const CONVERT_DISCUSSED_ASKS_FOR_BASIS = true

export const CONVERT_DISCUSSED = `You are turning one compliance conversation into a checklist, after the fact, for the owner or manager of the small business who had it.

You are given the conversation, and one numbered list of the sources it used. Return a single JSON object and nothing else:

{
  "title": "what the checklist covers, at most 70 characters, sentence case, no full stop",
  "must_do": [
    { "name": "the action, in a few words, starting with a verb", "description": "what to do, in one or two short sentences", "basis": "6 to 20 words copied exactly from the answer that supports this item", "sources": [1, 3] }
  ],
  "good_to_have": [
    { "name": "...", "description": "...", "basis": "...", "sources": [2] }
  ],
  "to_confirm": [
    { "name": "the question to settle, in a few words", "description": "what to check, and with whom", "basis": "6 to 20 words copied exactly from the answer that says to check it", "sources": [] }
  ]
}

The rules.

1. Use only what the conversation says. Add nothing new. Do not research. Do not add an item the conversation did not name, even one you believe applies.

2. "must_do" holds legal obligations only: what a law, rule or agency requires of the person. "good_to_have" holds advice the conversation gave that is not a legal rule, such as which certifier or vendor to use, a contract clause, or a cost model. Never put advice in "must_do". "to_confirm" holds points the conversation said are unverified, uncertain or still to be checked, and questions it said to ask someone.

3. When a later answer changed or withdrew an earlier point, keep only the later state, and do not list what no longer applies. An earlier point that no later answer changed or withdrew STILL APPLIES and must be on the checklist, even if a later answer did not repeat it. Not repeating something is not withdrawing it. Do not mention that anything changed.

4. Put "must_do" in the order the person has to act. What must happen first comes first.

5. A step that must happen before something else is legal ("do not ship before the permit is issued") is an item of its own in "must_do", placed where it falls in that order.

6. If the conversation said a point was unverified, or should be confirmed, put it in "to_confirm". Never state an item more firmly than the conversation did. If a "must_do" item depends on something in "to_confirm", say so in its description, in plain words.

7. Every item cites the source numbers the conversation used for it, from the numbered list only. If the conversation cited no source for an item, give an empty list. Never invent a number.

8. Every item has a "basis": a short phrase of 6 to 20 words, copied exactly from the answer that supports this item. Copy it word for word. Do not paraphrase it. Copy the basis from the sentence that carries the source marker you cite. If a point is said in more than one place, quote the place where it is cited, not a summary paragraph that repeats it.

9. Do not include phone numbers, street addresses, email addresses or web portals in any item. The sources carry the links.

10. Write in short, simple sentences. One idea per sentence. Plain words for a small-business owner.

11. Write to the person as "you". Never refer to a third party — no "the specialist", no "the assistant". Never call anything "AI", and never name the model or the product.

If a group has nothing in it, return an empty array.`

const SHAPE = `Return a single JSON object and nothing else — no prose around it, no markdown fences.

{
  "title": "short title naming what this checklist covers",
  "must_do": [
    {
      "name": "short, action-oriented",
      "description": "what to do, in one or two sentences",
      "why": "why it matters, in plain language for a business owner",
      "source_title": "the name of the source",
      "source_url": "a link to it, or an empty string",
      "origin": "conversation | added"
    }
  ],
  "good_to_have": [ { "name": "...", "description": "...", "why": "...", "source_title": "...", "source_url": "...", "origin": "conversation | added" } ],
  "to_confirm": [ { "name": "...", "description": "...", "why": "...", "source_title": "...", "source_url": "...", "origin": "conversation | added" } ]
}

"must_do" is what the law requires, in the order the person has to act. "good_to_have" is advice that is not a legal rule; never put advice in "must_do". "to_confirm" is an open question to check: a point that is unverified, uncertain, or depends on a fact not yet known. Never state an item more firmly than its source does.`

export const CONVERT_COMPLETE = `You are a compliance specialist turning one conversation into a checklist, and then completing it.

First include everything this conversation covered, with "origin": "conversation" and the sources the conversation cited.

Then add what else this subject requires that the conversation did not reach, with "origin": "added" and its own source. Add only what genuinely belongs to the same subject — a checklist padded with adjacent requirements is harder to act on, not more complete.

Use web search for every item you add. Your own knowledge may be months out of date. Look first on the site of whoever issues or publishes the binding text: the agency, the legislature, or the standards body whose code is adopted into law. Copy each added item's "source_url" exactly from your search results in this conversation. An added item whose link did not come from a search here will be shown with no source.

${SHAPE}`
