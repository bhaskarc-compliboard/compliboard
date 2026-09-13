/**
 * `basis` — WHAT A SWITCH VALUE RESTS ON.
 *
 * Decision: `DECISIONS.md` §50. Spec: `docs/SWITCH-DETERMINATION.md` §10.3.
 *
 * *** STRUCTURED, WITH THE SENTENCE RENDERED FROM IT — NEVER THE OTHER WAY ROUND. ***
 *
 * This is the same call as `applies_expression` (§43) and `obligations.determined_by`, for the
 * same two reasons, and migration 007's header states them better than this comment can: free
 * text "cannot answer either question that matters operationally". For a switch those two
 * questions are *which values rest on this document* and *what did we actually read*.
 *
 * A string answers neither. "Show me every switch standing on the permit we just superseded" is
 * a containment query against this shape and a `LIKE` against prose. And a `quote` stored as a
 * field can be checked character by character against the document it names — which is the
 * strongest verification available in Phase 7.2 and is forfeited entirely by a paraphrase.
 */

export type BasisKind = 'user_answer' | 'document' | 'computed'

export interface Basis {
  /** Schema version. Present so a later shape change is detectable rather than assumed. */
  v: 1
  kind: BasisKind
  /** ISO date. The day the value was established, not the day it was rendered. */
  at: string

  // ---- user_answer
  /** The question AS ASKED. Without it the answer cannot be read in context later. */
  question?: string
  /** ONLY on a change (§49). A correction and an unexplained change look identical afterwards. */
  previous_value?: string

  // ---- document
  document_id?: string
  /** "Permit cover page", "§4 Eligibility" — as printed, so a person can find it. */
  locator?: string
  /** VERBATIM. Checked as a substring of the extracted document text before it is written. */
  quote?: string
  /** Required for `implied` and `inferred`; the one step from the quote to the value. */
  reasoning?: string

  // ---- computed
  computed_from?: string[]
}

/** A person answered a question. `evidence_class` is `stated` — §53: a statement is not an inference. */
export function userAnswerBasis(
  question: string,
  value: string,
  previous: string | null | undefined,
  at: string,
): Basis {
  const changed = previous !== null && previous !== undefined && previous !== '' && previous !== value
  return {
    v: 1,
    kind: 'user_answer',
    at,
    question,
    ...(changed ? { previous_value: previous } : {}),
  }
}

export function documentBasis(
  documentId: string,
  locator: string | null,
  quote: string,
  at: string,
  reasoning?: string | null,
): Basis {
  return {
    v: 1, kind: 'document', at, document_id: documentId,
    ...(locator ? { locator } : {}),
    quote,
    ...(reasoning ? { reasoning } : {}),
  }
}

export function computedBasis(from: string[], at: string): Basis {
  return { v: 1, kind: 'computed', at, computed_from: [...from].sort() }
}

/**
 * The sentence a person reads. NEVER STORED — always produced from the structure, so the two
 * cannot drift and there is only one place to change the wording.
 */
export function renderBasis(b: Basis, value?: string | null): string {
  switch (b.kind) {
    case 'user_answer': {
      const v = value === null || value === undefined ? 'an answer' : `"${value}"`
      const changed = b.previous_value !== undefined
        ? `, previously "${b.previous_value}"`
        : ''
      const q = b.question ? ` Question: "${b.question}"` : ''
      return `User stated ${v} on ${b.at}${changed}.${q}`
    }
    case 'document': {
      const where = b.locator ? `, ${b.locator}` : ''
      const why = b.reasoning ? ` — ${b.reasoning}` : ''
      return `Document ${b.document_id}${where}: "${b.quote}"${why}`
    }
    case 'computed':
      return `Computed on ${b.at} from ${(b.computed_from ?? []).join(', ') || 'no named inputs'}.`
    default: {
      const unreachable: never = b.kind
      throw new Error(`renderBasis: unhandled basis kind ${String(unreachable)}`)
    }
  }
}

/**
 * *** THE ONE CHECK THAT NEEDS NO MODEL. ***
 *
 * A determination whose quote is not found in the document it names is discarded, whether or not
 * the value was right. `docs/SWITCH-DETERMINATION.md` §3.1 rule 7 — a fabricated basis is the
 * most dangerous output this phase can produce, because it reads exactly like a real one.
 *
 * Whitespace is normalised because extraction collapses line breaks differently between parsers;
 * nothing else is. A "close enough" match here would defeat the purpose of the check.
 */
export function quoteIsInDocument(quote: string, documentText: string): boolean {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim()
  const q = norm(quote)
  return q.length > 0 && norm(documentText).includes(q)
}
