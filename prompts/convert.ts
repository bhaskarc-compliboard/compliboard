/**
 * CONVERSATION → CHECKLIST — `DECISIONS.md` §125, Run 2 Task 3.
 *
 * Two scopes, and the difference is what the model is allowed to bring:
 *
 *   discussed  only what this conversation actually covered. **Every source must be one the
 *              conversation already cited** — and that is enforced in code after the call, not
 *              trusted to the prompt. A prompt is a request; the filter is the guarantee.
 *
 *   complete   the discussed items, plus whatever else is needed to cover the subject. The
 *              additions are marked `origin = 'added'` so the screen can say which is which.
 *
 * *** THIS IS ANCHORED (§3.3). *** Both scopes are given the transcript and asked what is in it
 * or what it implies. Neither asks the model to enumerate a subject from nothing.
 */
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
  "good_to_have": [ { "name": "...", "description": "...", "why": "...", "source_title": "...", "source_url": "...", "origin": "conversation | added" } ]
}

"must_do" is what is required. "good_to_have" is what is advisable but not required.`

export const CONVERT_DISCUSSED = `You are a compliance specialist turning one conversation into a checklist.

Include ONLY what this conversation actually covered. Do not add requirements it did not discuss, however obviously related they seem — the person asked for what was discussed, and an item they never saw discussed reads as something they missed.

Every item must set "origin": "conversation".

Every item's source must be one that appears in the conversation. Do not introduce a source that was not cited there; if an item has no source in the conversation, leave source_url empty rather than finding one.

${SHAPE}`

export const CONVERT_COMPLETE = `You are a compliance specialist turning one conversation into a checklist, and then completing it.

First include everything this conversation covered, with "origin": "conversation" and the sources the conversation cited.

Then add what else this subject requires that the conversation did not reach, with "origin": "added" and its own source. Add only what genuinely belongs to the same subject — a checklist padded with adjacent requirements is harder to act on, not more complete.

${SHAPE}`
