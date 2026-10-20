/**
 * ONE SHAPE FOR "A PERSON ANSWERED A SWITCH" — Dashboard step 7.
 *
 * `/api/switches/answer` is the only writer of `company_switches`, and two screens now reach it:
 * the Company information page, through its own route's `declared` action
 * (`app/api/company-information/route.ts:190` builds exactly this body and proxies it), and the
 * Dashboard's question card, which posts here directly because it has no other action to perform.
 *
 * The body is three fields and it would be easy to type twice. It is typed once, because the
 * `entity_id` field is the kind of thing a second copy quietly omits: the route refuses a
 * site-scoped switch without one (`app/api/switches/answer/route.ts:60`), and a caller that
 * forgot the field would look like a caller that meant null.
 *
 * *** IT CALLS NO MODEL, AND THAT IS CHECKED, NOT ASSUMED. *** The route writes
 * `switch_determinations`, then `company_switches`, then recomputes obligations through
 * `lib/obligationWriter.ts`. Neither it nor anything in its import closure —
 * `switchDetermination`, `switchAsk`, `appliesExpression`, `resolve`, `jurisdiction`, `basis` —
 * imports `lib/ai.ts`. Resolution is code and never AI (`CLAUDE.md` §1, layer 3).
 */
import { authHeaders } from './supabase.ts'

export interface SwitchAnswer {
  switch_id: string
  /** Text, always. `company_switches.value` is text for every switch and coerces at read time. */
  value: string
  /** Null for a company-scoped switch. Never defaulted to a site — `DECISIONS.md` §20. */
  entity_id: string | null
}

export const ANSWER_ENDPOINT = '/api/switches/answer'

/**
 * Post one answer. Returns `{ ok: true }` or the route's own sentence, never a thrown error: the
 * card has one failure line to show and a network blip and a refused value are the same thing to
 * the person in front of it.
 */
export async function postSwitchAnswer(
  answer: SwitchAnswer,
): Promise<{ ok: true } | { ok: false; error: string | null }> {
  try {
    const res = await fetch(ANSWER_ENDPOINT, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(answer),
    })
    if (res.ok) return { ok: true }
    const j = await res.json().catch(() => null)
    return { ok: false, error: typeof j?.error === 'string' ? j.error : null }
  } catch {
    return { ok: false, error: null }
  }
}
