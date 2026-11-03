/**
 * THE AUDITS CHAT'S ONE OFFER, CHECKED — `docs/GAPS-PLAN.md` Part A step 6b (decisions 41, 43, 45).
 *
 * *** IT IS ITS OWN FILE BECAUSE THE PAGE HAS TO CALL IT, AND THE PAGE IS A CLIENT FILE. ***
 * This was written inside `lib/ask/auditsBrief.ts` at step 6a, where nothing but the engine read
 * it. Step 6b gave the press to `app/audits/page.tsx`, which is `'use client'` — and a brief
 * imports `lib/ask/engine.ts`, which imports `lib/ai.ts`, which `tests/unit/clientImports.test.ts`
 * refuses to let any client file reach. So the check moved here, where it has no imports at all,
 * and the brief re-exports it so nothing that read it from there had to change.
 *
 * The words the card shows are `lib/auditsWords.ts` `runAuditCardWords`, beside every other
 * sentence this section puts on a screen.
 */
/**
 * *** THE MODEL PROPOSES; THE CODE CHECKS; THE PERSON PRESSES. ***
 *
 * An offer here starts a run over the company's own documents. It carries no `source_url` and
 * nothing to verify against the web, which is why `prompts/ask.ts`'s shared `OFFER_FORMAT_SENTENCE`
 * is NOT used (it demands one) and `prompts/audits-answer.ts` writes its own.
 *
 * What is checked, in code and never trusted from the model, is the only thing that can be wrong
 * in a way that matters: **the agency**. `lib/audit.ts` `auditAgenciesFor` is the company's own
 * vocabulary and `app/api/audit-runs/route.ts:122`–`:134` refuses anything else with the
 * company's labels said back. The same list is checked here, so a bad offer is dropped before it
 * is drawn rather than after it is pressed.
 */
/**
 * *** THE SHAPE MOVED TO `lib/ask/offers.ts` ON 3 NOVEMBER 2026 (decision 43); THE CHECK STAYED
 * HERE, AND THE SPLIT IS THE POINT. *** `parseOffers` reads the block and knows nothing about any
 * company, so it can only refuse a block that names neither an agency nor the attached file. This
 * function is given the company's own labels and refuses everything else.
 *
 * **What it starts, and what the press turns it into.** `agency` is a label the company's own
 * readings produced, or `'all'` — the two things `app/api/audit-runs/route.ts` takes for
 * `kind: 'agency'`. `attached` is a MARKER and not an id (decision 45): step 6a asked the model
 * for a `document_id` and got a passage handle in three of eighteen runs, because the model is
 * never shown the file's id. The press fills it in from what the page already holds.
 */
export interface CheckedRunAudit {
  /** An agency label the company holds, or 'all'. Null when it is about the attached file. */
  agency: string | null
  /** The file attached on this turn, resolved by the CODE and never read off the model. */
  documentId: string | null
}

/**
 * Check one offer against this company's own labels and this turn's attached file.
 * Returns null for anything that cannot be started, which is the drop.
 */
export function checkRunAuditOffer(
  raw: unknown,
  known: { agencies: string[]; attachedDocumentId: string | null },
): CheckedRunAudit | null {
  const o = (raw ?? {}) as Record<string, unknown>
  if (String(o.kind ?? '').trim() !== 'run_audit') return null
  const agency = typeof o.agency === 'string' ? o.agency.trim() : ''
  // THE ATTACHED FILE, BY MARKER. There is nothing to compare an id against and nothing to
  // believe: either a file came with this turn or the offer cannot be started.
  if (!agency && o.attached === true) {
    return known.attachedDocumentId ? { agency: null, documentId: known.attachedDocumentId } : null
  }
  if (!agency) return null
  if (agency === 'all') return { agency: 'all', documentId: null }
  // Case-insensitively, because the model is shown the label and may re-case it; the label that
  // goes out is the company's own spelling and never the model's.
  const hit = known.agencies.find((a) => a.toLowerCase() === agency.toLowerCase())
  return hit ? { agency: hit, documentId: null } : null
}
