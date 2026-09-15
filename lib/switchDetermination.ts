/**
 * SWITCH DETERMINATION — what happens to a value between being found and being believed.
 *
 * Spec: `docs/SWITCH-DETERMINATION.md`. Decisions: §24.1 (a stated value outranks an inferred
 * one), §47 (keep every claim, point at the winner), §48 (validate structure before writing).
 *
 * *** THIS MODULE DECIDES NOTHING ABOUT THE WORLD. *** It decides what happens to a claim:
 * whether it is written, proposed, or recorded and set aside. Every function here is pure, so
 * the rule that governs a customer's facts can be tested without a database and without a model.
 *
 * THE ONE THING TO UNDERSTAND. `user_locked` means A PERSON DECIDED, and it is the only flag
 * with that meaning. A newer document beating an older one is a different claim, and it is
 * recorded in `switch_determinations` rather than by setting that flag — because the day
 * somebody asks "why won't this value update", the answer has to distinguish "a person said so"
 * from "a 2025 permit outranked a 2019 handbook". Reusing one flag for both loses exactly the
 * distinction the question is about.
 */

import type { ObligationStatus } from './resolve.ts'
import { userAnswerBasis, type Basis } from './basis.ts'

export type EvidenceClass = 'declared' | 'stated' | 'implied' | 'inferred' | 'absent'
export type Confidence = 'high' | 'medium' | 'low'
export type ValueSource = 'ai_from_documents' | 'ai_from_profile' | 'user_set' | 'computed'

/** One claim about one fact. Mirrors a `switch_determinations` row. */
export interface Determination {
  switchId: string
  value: string | null
  evidenceClass: EvidenceClass
  confidence: Confidence | null
  source: ValueSource
  documentId?: string | null
  /** `issue_date` of the document, for the recency tie-break. Never compared across classes. */
  documentDate?: string | null
  /** A regulator-issued document outranks a self-authored one at equal class and date. */
  issuerAuthority?: 'regulator' | 'self' | null
  quote?: string | null
  locator?: string | null
  reasoning?: string | null
}

/** What `company_switches` currently holds. */
export interface StoredValue {
  value: string | null
  evidenceClass: EvidenceClass | null
  userLocked: boolean
  determinedFrom?: string | null
  documentDate?: string | null
  issuerAuthority?: 'regulator' | 'self' | null
}

export type Outcome =
  /** Write it to company_switches and point determined_from at it. */
  | { action: 'write'; reason: string }
  /** Record it, show it to the user, do NOT change the stored value. */
  | { action: 'propose'; reason: string }
  /** Record it. The stored value stands because a person set it. */
  | { action: 'record_only'; reason: string }
  /** Record it and move the switch to needs_user. Nothing here can settle it. */
  | { action: 'needs_user'; reason: string }

/**
 * THE PRECEDENCE LADDER, AS A NUMBER.
 *
 *   BEFORE (13 Sep - 15 Sep):  stated 3 · implied 2 · inferred 1
 *   AFTER  (migration 026):    declared 4 · stated 3 · implied 2 · inferred 1
 *
 * *** `declared` IS NEW AND IT SITS AT THE TOP. *** The other four classes all describe how a
 * DOCUMENT supports a claim — they are one scale. A person telling us directly is not on that
 * scale, and it is the strongest source in the product: `DECISIONS.md` §24.1 says a stated value
 * outranks an inferred one, and a person outranks both.
 *
 * **That rule was unexpressible in this vocabulary until now**, which is exactly why
 * `fromUserAnswer()` borrowed `stated` — a word that in migration 017 means "this document says
 * it" and carries a CHECK requiring a document and a quote. The borrow was invisible for two
 * days because nothing had ever called this module from a route (§80).
 */
const RANK: Record<Exclude<EvidenceClass, 'absent'>, number> =
  { declared: 4, stated: 3, implied: 2, inferred: 1 }

/**
 * Does writing this value REMOVE an obligation the company would otherwise see?
 *
 * `docs/SWITCH-DETERMINATION.md` §5: an AI determination may WRITE only when a wrong value
 * would ADD an obligation, and must PROPOSE when a wrong value could REMOVE one. The caller
 * computes this by resolving twice — once with the candidate value, once with the switch
 * unknown — and diffing. It lives in the caller rather than here because it needs the library,
 * and it is passed in rather than inferred because a hand-kept list of "dangerous switches"
 * would drift from the expressions the moment either changed.
 */
export function removesAnObligation(
  withValue: ObligationStatus[],
  withUnknown: ObligationStatus[],
): boolean {
  if (withValue.length !== withUnknown.length) return true // shape changed: treat as removal
  return withValue.some(
    (after, i) => after === 'does_not_apply' && withUnknown[i] !== 'does_not_apply',
  )
}

/**
 * The precedence ladder. `docs/SWITCH-DETERMINATION.md` §7.
 *
 * @param removes whether writing this would remove an obligation (see above). When true the
 *        determination can never write on its own, whatever the ladder says.
 */
export function decideOutcome(
  current: StoredValue | null,
  incoming: Determination,
  removes: boolean,
): Outcome {
  // `absent` is a finding, never a fact. It is recorded so the UI can say "we looked and did
  // not find it", which is what turns a blank field into a specific request.
  if (incoming.evidenceClass === 'absent') {
    return { action: 'record_only', reason: 'Absence is recorded, never written. CLAUDE.md §3.2.' }
  }

  // ---- 1. A PERSON DECIDED. Nothing automatic overrides that.
  if (current?.userLocked && incoming.source !== 'user_set') {
    return {
      action: 'record_only',
      reason:
        `A person set this value. The determination is recorded against the switch so the ` +
        `disagreement is visible, and the stored value does not change. DECISIONS.md §24.1.`,
    }
  }

  // A person changing their own answer always wins, including over their earlier one.
  if (incoming.source === 'user_set') {
    return { action: 'write', reason: 'Declared by a person, which outranks every inferred value.' }
  }

  // ---- The §5 rule, applied before the ladder: a value that could remove an obligation is
  // never written automatically, however strong the evidence for it looks.
  if (removes) {
    return {
      action: 'propose',
      reason:
        `Writing this would REMOVE at least one obligation. A wrong value that adds a ` +
        `requirement is visible and arguable; one that removes a requirement is silent.`,
    }
  }

  // Corroboration is not statement: an inferred value is always proposed (§2).
  if (incoming.evidenceClass === 'inferred') {
    return {
      action: 'propose',
      reason: 'Inferred rather than stated. Two consistent signals are still not a statement.',
    }
  }

  // ---- Nothing stored yet: the ladder has nothing to compare against.
  if (!current || current.value === null || current.evidenceClass === null) {
    return { action: 'write', reason: 'No value held for this fact yet.' }
  }

  // ---- Agreement is not a disagreement. Re-confirming costs nothing and changes nothing.
  if (current.value === incoming.value) {
    return { action: 'write', reason: 'Agrees with the stored value; re-confirmed.' }
  }

  // ---- 2. EVIDENCE CLASS. stated > implied > inferred.
  const a = RANK[current.evidenceClass as Exclude<EvidenceClass, 'absent'>] ?? 0
  const b = RANK[incoming.evidenceClass]
  if (b > a) return { action: 'write', reason: `Stronger evidence (${incoming.evidenceClass} beats ${current.evidenceClass}).` }
  if (b < a) return { action: 'record_only', reason: `Weaker evidence than the stored value (${incoming.evidenceClass} loses to ${current.evidenceClass}).` }

  // ---- 3. RECENCY, and ONLY within the same class. A 2019 `stated` beats a 2025 `inferred`,
  //         because recency is not authority — which is why this sits below the class test.
  if (incoming.documentDate && current.documentDate && incoming.documentDate !== current.documentDate) {
    return incoming.documentDate > current.documentDate
      ? { action: 'write', reason: `Newer document at the same evidence class (${incoming.documentDate} > ${current.documentDate}).` }
      : { action: 'record_only', reason: `Older document at the same evidence class.` }
  }

  // ---- 4. ISSUER AUTHORITY. A regulator-issued document beats a self-authored one.
  if (incoming.issuerAuthority === 'regulator' && current.issuerAuthority === 'self') {
    return { action: 'write', reason: 'Regulator-issued outranks self-authored at equal class and date.' }
  }
  if (incoming.issuerAuthority === 'self' && current.issuerAuthority === 'regulator') {
    return { action: 'record_only', reason: 'Self-authored loses to regulator-issued.' }
  }

  // ---- 5. Nothing here settles it. Two documents of equal standing disagree, and guessing
  //         between them is the one thing this module must not do.
  return {
    action: 'needs_user',
    reason:
      `Two sources of equal standing disagree (${current.value} vs ${incoming.value}) and ` +
      `nothing in the precedence ladder separates them. Both are recorded; a person decides.`,
  }
}

/**
 * Numeric disagreement is never averaged.
 *
 * 42 and 60 do not make 51. For a threshold switch the HIGHER value is the one that adds
 * obligations, which is the safe direction under §5 — so the higher is proposed and both bases
 * are kept. Averaging would invent a number that appears in no document, which is §44.1 with a
 * decimal point on it.
 */
export function reconcileNumeric(a: string | null, b: string | null): string | null {
  const x = Number(a)
  const y = Number(b)
  if (!Number.isFinite(x)) return Number.isFinite(y) ? b : null
  if (!Number.isFinite(y)) return a
  return x >= y ? a : b
}

/**
 * What an answer from a person becomes.
 *
 * `evidence_class = 'stated'` because the person stated it — that is what the class means, and
 * it is the only route to `stated` that does not involve a document. `user_locked` is set here
 * and nowhere else in this module.
 *
 * *** AN OVERWRITE CARRIES WHAT IT OVERWROTE. *** A person answering the same question twice is
 * correct behaviour — a newer stated value outranks an older one (§24.1) — but it is also a
 * MATERIAL EVENT, and for a switch like `hazardous_chemicals_present`, whose family gates 35
 * requirements, it is the event that explains why somebody's list changed overnight. Writing
 * the previous value into `basis` costs nothing and is the difference between a corrected fact
 * and a fact with no history. `DECISIONS.md` §49.
 *
 * The full chain lives in `switch_determinations` either way; this puts the immediately
 * previous value where a person reading one row will actually see it.
 */
export function fromUserAnswer(
  switchId: string,
  value: string,
  question: string,
  previous?: { value: string | null; at?: string | null } | null,
): Determination & { setsUserLocked: true; basis: Basis } {
  const at = (previous?.at ?? new Date().toISOString()).slice(0, 10)
  return {
    switchId,
    value,
    // `declared`, not `stated`. A person is not a document (migration 026), and `stated`
    // carries a CHECK requiring a document and a quote that a person's answer cannot satisfy.
    evidenceClass: 'declared',
    confidence: 'high',
    source: 'user_set',
    documentId: null,
    quote: null,
    locator: null,
    reasoning: `Answered by a person: "${question}"`,
    // STRUCTURED, not a sentence — migration 018 made `basis` jsonb. The sentence a person
    // reads comes from renderBasis(), so there is one place to change the wording and the
    // two cannot drift. `previous_value` appears only on a real change (§49).
    basis: userAnswerBasis(question, value, previous?.value ?? null, at),
    setsUserLocked: true,
  }
}
