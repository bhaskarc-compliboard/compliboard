/**
 * THE ANSWER SHAPES, AND THE ONE FIELD THAT IS DELIBERATELY MISSING FROM ONE OF THEM.
 *
 * Spec: docs/DETERMINATION-GATE.md §3. Decision: DECISIONS.md §34.
 *
 * The determination gate (Stage 1) tells the model an ANSWER may hedge and a CHECKLIST may
 * not. That instruction is only as strong as the schema behind it — a model under pressure
 * from a question it cannot fully answer will reinterpret "be stricter", and a prompt that
 * permits hedging with nowhere to put the hedge produces one buried in prose, where nothing
 * can count it, no critic can check it and no golden file can assert on it.
 *
 * So:
 *   ANSWER    carries `conditional_on`. The hedge is a first-class, inspectable thing.
 *   CHECKLIST carries NO conditional field at all. Hedging becomes UNREPRESENTABLE rather
 *             than discouraged, and the only honest move left is to ask.
 *
 * The absence is enforced at the bottom of this file by a compile-time assertion, not only
 * by the prompt. Adding `conditional_on` to ChecklistAnswer fails `npm run typecheck`.
 */

/** One fact the answer branches on, with each branch stated. Answer path only. */
export interface ConditionalBranch {
  value: string
  then: string
}

export interface ConditionalOn {
  /** The fact that was not established. Mirrors the gate's UnknownFact.fact. */
  fact: string
  /** switches.id when the fact is in the vocabulary; null for a scoped product fact. */
  switch_id: string | null
  branches: ConditionalBranch[]
}

/** The ANSWER path. May hedge, and says so in a field rather than in prose. */
export interface AnswerPayload {
  title: string
  body: string
  /** Non-empty means the answer is conditional on facts the gate let through as
   *  non-blocking. Stage 5's critic reads this to answer its own question 7 —
   *  "does any statement assume a fact the user did not provide?" — against a list
   *  rather than by re-deriving it. */
  conditional_on: ConditionalOn[]
}

export interface ChecklistItem {
  name: string
  description: string
  source_url: string
  why: string
  cost_note: string
  providers?: Array<{ name: string; type: string; coverage: string; note: string }>
}

/**
 * The CHECKLIST path.
 *
 * *** DO NOT ADD A CONDITIONAL FIELD HERE. *** Not `conditional_on`, not `depends_on`, not
 * an optional one, not an empty one. A checklist is a list of things a person will actually
 * do, with hours and dollars attached; it is the expensive place to be wrong. If the model
 * cannot say which branch applies, the gate should have asked — and if the gate did not,
 * the item is left out rather than hedged.
 *
 * The assertion at the foot of this file exists so that adding one is a build failure and
 * not a code review someone might wave through.
 */
export interface ChecklistAnswer {
  title: string
  safety_alert: string
  must_do: ChecklistItem[]
  good_to_have: Array<Omit<ChecklistItem, 'providers'>>
  // NO conditional_on. NO follow_up_questions — that was the additive question slot
  // removed on 11 Sep; questions come from lib/determinationGate.ts, before the answer.
}

// ---------------------------------------------------------------------------
// COMPILE-TIME ENFORCEMENT
//
// These two lines are the difference between a rule and a comment. `npm run check` runs
// `tsc --noEmit`, so adding a conditional or question field to ChecklistAnswer stops the
// build with the message below rather than shipping.
// ---------------------------------------------------------------------------

type Assert<T extends true> = T

type ChecklistHasNoHedge =
  'conditional_on' extends keyof ChecklistAnswer ? false :
  'depends_on' extends keyof ChecklistAnswer ? false :
  'follow_up_questions' extends keyof ChecklistAnswer ? false :
  'clarifying_questions' extends keyof ChecklistAnswer ? false : true

/** If this line errors, someone has added a hedge or a question slot to the checklist
 *  schema. That is DECISIONS.md §34 being undone. Read it before deleting this. */
export type _ChecklistMayNotHedge = Assert<ChecklistHasNoHedge>

type AnswerCanHedge = 'conditional_on' extends keyof AnswerPayload ? true : false

/** And the other direction: the answer path must KEEP its hedge field, or the gate's
 *  "prefer hedging to asking" instruction has nowhere to land and turns into prose. */
export type _AnswerMayHedge = Assert<AnswerCanHedge>
