/**
 * AN EARLIER ANSWER, WITH THE SOURCES ITS MARKERS POINT AT — Fix Round 1 (C), §127.
 *
 * *** THE FALSE CLAIM THIS EXISTS TO STOP. ***
 *
 * On 23 September a third turn said:
 *
 *   "My previous two answers carried numbered citation markers, but I didn't actually retrieve
 *    and verify those sources in this conversation."
 *
 * **That was false.** Both answers came from real `web_search` calls and their sources were
 * stored on the turns. But history was replayed as plain text that still carried `[1]` and `[2]`
 * with **no list of what they referred to** — so the model, reading its own earlier turn, saw
 * numbered references to nothing and said so. It was being accurate about the context it had.
 *
 * **And then the nightly summariser wrote the claim into the summary**, where it outlives the
 * transcript that would have disproved it. A false statement that gets archived is worse than
 * one that scrolls away.
 *
 * The fix is not an instruction telling the model its sources were real — that would be asking
 * it to assert something it cannot see. It is to **put the sources back in front of it**, so the
 * markers have referents and the question does not arise.
 *
 * ---------------------------------------------------------------------------
 * *** AND THE HEADING DOES NOT CLAIM PROVENANCE — BECAUSE IT CLAIMS LESS, NOT BECAUSE IT
 * MEASURED BETTER. ***
 *
 * Three runs on 23 September, same three-turn sequence, same switches:
 *
 *   1. "Sources cited in this answer:"
 *        -> "I ran the searches **this time**. … Assume I made it up."
 *   2. "Sources retrieved by web search while writing this answer, numbered as cited above:"
 *        -> "**I did not run any searches before those two answers.**"
 *   3. "Sources cited in this answer:" again, through `check:live`
 *        -> "Direct answer: no. **I did not run a search before either of those answers.**"
 *
 * On runs 1 and 2 this comment claimed the assertive heading made the denial categorical.
 * **Run 3 refutes that** — the neutral heading denied just as flatly. One observation per
 * heading was never a comparison. **The heading is not the variable.**
 *
 * The reason is structural, and it bounds what this file can ever fix: history is replayed as
 * **plain assistant text**. The `server_tool_use` and `web_search_tool_result` blocks from the original
 * exchange are not stored and cannot be replayed, so a model reading the transcript sees no
 * evidence that any search happened. A provenance sentence sitting inside its own turn is then
 * a claim it can inspect and disown — and it does.
 *
 * So this appends the LIST and says nothing about where it came from. The list is what the
 * markers need. The remaining question — "were those searches real?" — cannot be answered from
 * inside the assistant turn, and the two ways to answer it properly (a line of system prompt,
 * which is a §3.1 change; or storing and replaying the tool-use blocks) are recorded for the
 * owner rather than taken unilaterally. `tests/unit/historySources.test.ts` pins the wording so
 * the stronger claim is not re-introduced by someone who has not read this.
 * ---------------------------------------------------------------------------
 */
import type { Source } from './ai.ts'

/**
 * Appends a numbered source list to an answer, in the same shape the answer's own markers use.
 *
 * Returns the answer unchanged when there are no sources — an empty "Sources:" heading would
 * assert that the answer had none, which is different from not knowing.
 */
export function appendSources(answer: string, sources?: Source[] | null): string {
  const list = (sources ?? []).filter((s) => s && s.url)
  if (!list.length) return answer
  const lines = list
    .map((s) => `[${s.n}] ${String(s.title ?? '').trim() || s.url} — ${s.url}`)
    .join('\n')
  return `${answer}\n\nSources cited in this answer:\n${lines}`
}
