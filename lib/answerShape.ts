/**
 * *** AN ANSWER THAT PARSED IS NOT AN ANSWER THAT FITS *** — root R4, fix list **S1** and **A7**,
 * Job E.
 *
 * `JSON.parse` succeeding tells you the model produced well-formed JSON. It does not tell you the
 * JSON is the thing you asked for, and the gap between those two is where a whole paid audit was
 * recorded as "nothing needs you":
 *
 *   · **S1** — with web search on, the model's narrated sentence carries a citation marker, so
 *     `extractJsonText` returned `[1]` and `JSON.parse('[1]')` succeeded. `lib/auditRun.ts` guarded
 *     only against an exception, found none of its fields in the array, and saved the section
 *     **done with zero findings**. `lib/ai.ts` no longer starts a value at a marker — and this file
 *     is the other half, because the same empty result arrives by other routes.
 *   · **A7** — valid JSON of the wrong SHAPE: a wrapped object (`{"result": {"findings": […]}}`), a
 *     renamed key (`"issues"` for `"findings"`), or a bare `[]`. Each shaped to zero rows, a done
 *     section, and an email saying "found nothing that needs you". The checklist path handled this
 *     honestly; the agency path did not.
 *
 * **The rule: name the fields you asked for, and refuse anything that carries none of them.** Not
 * "all of them" — a real audit answer legitimately omits `contradictions` when it found none, and
 * demanding every key would fail good answers. Carrying NONE of several is not an omission; it is a
 * different document.
 *
 * *** WHAT IT DELIBERATELY DOES NOT DO: UNWRAP, RENAME OR REPAIR. *** A guess at what the model
 * meant is a quiet rewrite of a regulatory answer, and `CRITIC-PASS.md`'s rule applies — a silent
 * fix destroys the evidence. The raw text is kept and the section fails with words a person can
 * read, which is what `lib/auditRun.ts` already does for a parse failure and what this extends to
 * the failures that never threw.
 */

/** What the answer turned out to be, for a message a person can act on. */
function describe(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'a list'
  if (typeof v === 'object') return 'an object'
  return `a ${typeof v}`
}

export type AnswerShape =
  | { ok: true; obj: Record<string, unknown> }
  | { ok: false; why: string }

/**
 * `parsed` as a plain object carrying at least one of `fields`.
 *
 * `why` is written for the `could_not_complete_reason` a person reads, and names **what the answer
 * did carry** — `{"result": …}` is diagnosable from that one word and unguessable without it.
 */
export function answerWith(parsed: unknown, fields: readonly string[]): AnswerShape {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, why: `the answer came back as ${describe(parsed)}, not as an object` }
  }
  const obj = parsed as Record<string, unknown>
  const keys = Object.keys(obj)
  if (fields.some((f) => f in obj)) return { ok: true, obj }
  const carried = keys.length
    ? `it carried ${keys.slice(0, 6).map((k) => `"${k}"`).join(', ')}${keys.length > 6 ? ` and ${keys.length - 6} more` : ''}`
    : 'it carried nothing at all'
  return {
    ok: false,
    why: `the answer carried none of the fields asked for (${fields.map((f) => `"${f}"`).join(', ')}); ${carried}`,
  }
}

/* ===========================================================================
 * DID THE ANSWER FINISH? — fix list **S2**, root R4, Job E.
 *
 * The stream's `done` event has carried `stopReason` since it was written, and **no caller acted on
 * it**. Three did not:
 *
 *   · `app/api/chat/route.ts` sent it to the screen, saved the turn and counted the question
 *     answered. Nothing on the screen read it (checked: `stopReason` appears nowhere outside that
 *     one line), so an answer cut off at 16,000 tokens was saved into the conversation as an answer,
 *     went into the summary, and was counted. `askAI` retries on `max_tokens`; the STREAM does not.
 *   · `app/api/hr/answer/route.ts` the same, with its check record attached to a half-answer.
 *   · `lib/handbookCheck.ts` stored a piece cut off at `PIECE_MAX_TOKENS` as **done**, so later
 *     sections of that handbook showed no findings and the check said it had looked.
 *
 * `end_turn` is the only reason that means "the model finished saying what it had to say".
 * `stop_sequence` is a configured stop and nothing here configures one, so it is treated as clean
 * too. Everything else — and **no reason at all** — is incomplete: we were not told it finished, and
 * `CLAUDE.md` §3.2's first rule applies to an answer exactly as it applies to a document.
 * =========================================================================== */

export type Finish = { complete: true } | { complete: false; why: string }

/** The reasons the Messages API gives, in words a person can read. */
const STOP_WORDS: Record<string, string> = {
  max_tokens: 'the answer ran out of room before it was finished',
  refusal: 'the model declined to answer',
  pause_turn: 'the answer was paused part-way through',
  tool_use: 'the answer stopped to use a tool, and nothing ran it',
}

export function finishedCleanly(stopReason: string | null | undefined): Finish {
  if (stopReason === 'end_turn' || stopReason === 'stop_sequence') return { complete: true }
  if (!stopReason) return { complete: false, why: 'we were not told whether the answer finished' }
  return { complete: false, why: STOP_WORDS[stopReason] ?? `the answer stopped for an unknown reason (${stopReason})` }
}
