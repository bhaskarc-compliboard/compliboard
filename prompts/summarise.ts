/**
 * THE NIGHTLY READER — `DECISIONS.md` §108 and §125.
 *
 * Read overnight, when the whole conversation exists, rather than fact by fact as it happens.
 * §108's reason is judgment and not load: real time forces the decision turn by turn, and that
 * has already produced the same fact with two different labels in one conversation (§104).
 *
 * *** IT PROPOSES. IT NEVER WRITES A FACT. *** Everything this returns lands in
 * `fact_proposals` for a person to accept or reject. There is deliberately no path from here to
 * `company_switches`.
 *
 * *** IT IS ANCHORED (§3.3). *** The model is given the transcript and asked what is IN it. It
 * is never asked to produce a list of things a company like this might be true of — that is the
 * unanchored enumeration §3.3 names as the bug.
 *
 * ---------------------------------------------------------------------------
 * *** AND IT SPEAKS TO THE OWNER, NOT ABOUT A THIRD PARTY — Fix Round 1 (I). ***
 *
 * A 23 September summary read *"the specialist laid out…"*. The person reading that summary is
 * the person who had the conversation; telling them what a third party said turns their own
 * record into a report about someone else, and invents a character the product does not have.
 *
 * It came from TWO places, and fixing only the prompt would have left it half-done:
 *
 *   1. this prompt opened "a conversation between a compliance specialist and the owner",
 *      which names the character; and
 *   2. **the transcript itself labels every answer `SPECIALIST:`** — built in
 *      `app/api/jobs/summarise/route.ts` and `app/api/topics/[id]/summarise/route.ts`. That
 *      label is the strongest signal in the input, and no amount of instruction outweighs the
 *      data. Both now read `ANSWER:`.
 * ---------------------------------------------------------------------------
 */
export const SUMMARISE_PROMPT = `You are writing the record of one compliance conversation, after the fact, for the owner or manager of the small or mid-size business who had it.

Return a single JSON object and nothing else:

{
  "summary": "what this conversation was about and what was concluded, in 2-5 sentences, addressed directly to the person who had it",
  "facts": [
    {
      "key": "a short snake_case name for the fact, e.g. employee_count or has_forklifts",
      "value": "the value, as briefly as it can be said",
      "quote": "the sentence from the conversation this came from, copied exactly"
    }
  ]
}

About the summary: describe what was asked and what the answer established. Do not add advice that was not given, and do not restate the whole conversation.

About the voice: write to the person who had the conversation, as "you". State what the answer established as a fact about their situation, not as something somebody told them. Never refer to a third party — no "the specialist", no "the assistant", no "the AI", and no naming of the product. Write "You asked whether your Seattle location crosses the 500-employee tier; it does not, counted across both sites." Not "the specialist laid out the tier rules".

About the facts: include only things the USER stated about their own business — their state, their headcount, what they store, what equipment they run, what they already hold a permit for. Every fact must have a quote from the conversation that says it.

Do NOT include:
- anything the answer asserted, or inferred, rather than the user telling you
- anything hypothetical, conditional, or asked as a "what if"
- general facts about regulations, which are not facts about this business

If the user stated nothing about their own business, return an empty facts array. An empty array is a correct answer and is better than a guess.`
