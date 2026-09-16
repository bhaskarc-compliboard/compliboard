/**
 * STAGE 1 — THE DETERMINATION GATE
 *
 * Full specification: docs/DETERMINATION-GATE.md. Read it before changing anything here;
 * every part of this file is quality-affecting under CLAUDE.md §3.1.
 *
 * Before anything is enumerated: decide what facts the answer depends on, whether we have
 * them, and whether a missing one changes the answer materially. If one does, ASK — and
 * produce nothing else.
 *
 * WHY IT EXISTS. DECISIONS.md §4: a live test asked for the labelling requirement on 2.5L
 * bottles and a case. The model enumerated past the packing group — the determination the
 * entire answer depends on — and built six sub-steps and $650-1,800 of cost estimates on a
 * requirement that does not exist as stated. Packing group determines UN number, hazard
 * class, limited-quantity eligibility, packaging spec and label: five of the six things that
 * went wrong. "Upload the SDS" resolves all of it.
 *
 * WHY A SLOT FOR QUESTIONS WAS NOT ENOUGH. DECISIONS.md §34: the checklist schema already
 * had `follow_up_questions[]`, and substeps had `clarifying_questions[]`. Both are ADDITIVE —
 * positioned after the answer, meaning "produce the checklist, then suggest refinements". A
 * model filling an additive slot has already written the checklist by the time it reaches the
 * question, and the second half of a sentence cannot undo the first half. So the gate's
 * output is an ALTERNATIVE to the answer, expressed as a discriminated union, and both
 * additive slots are removed rather than left beside it.
 *
 * THIS IS THE ONLY PLACE THE GATE'S AI CALL LIVES. Routes call gate() and never learn how it
 * decided. That is what makes the eventual swap — deriving blocking facts from
 * applies_expression by query rather than by reasoning — a swap and not a rewrite
 * (DETERMINATION-GATE.md §9).
 */

import { askAIJson, type AIContent } from './ai.ts'
import type { SupabaseClient } from '@supabase/supabase-js'
// The context builder lives in its own import-free file so the golden runner — a plain Node
// script that cannot resolve the `@/` alias — calls the same function the routes do.
// lib/gateContext.ts explains why that is worth a file.
import { buildGateContext, collapseTurns, type FactSource, type KnownFact,
         type PriorTurn, type Frame, type ConversationFact } from './gateContext.ts'

export { buildGateContext }
export type { FactSource, KnownFact }

// ---------------------------------------------------------------------------
// THE OUTPUT UNION
// ---------------------------------------------------------------------------

/** How a fact came to be known. Mirrors company_switches.source (migration 008), plus one
 *  value that is deliberately NOT a company_switches source: a fact stated in this question
 *  belongs to this question, and is never persisted. */
export interface UnknownFact {
  switch_id: string | null
  fact: string
  /** Why it does not block: what the answer will say conditionally instead. */
  stated_conditionally_as: string
}

export interface GateAsk {
  /** One sentence. The single blocking question. */
  question: string
  /** The artifact that would resolve it, e.g. "the SDS for this product". Null if none. */
  artifact: string | null
  /** What answering unlocks. Never empty — a question with a thin payoff is hard to
   *  justify when the schema demands its own reward be listed. */
  unlocks: string[]
  /** switches.id if the fact is in the vocabulary. Null until 6.2 seeds `switches`, and
   *  null FOREVER for scoped product facts like packing group, which belong to a shipment
   *  rather than to a company. */
  switch_id: string | null
  why_blocking: string
  /** What the product WOULD have assumed. If this reads as reasonable, the fact was not
   *  blocking. Never rendered to the user — showing somebody the guess invites them to
   *  accept it, which defeats the gate. It is for golden files and for a reviewer. */
  assumed_if_unanswered: string
  /** What we already have, so the user is not asked for it and can see we know it. */
  known: KnownFact[]
}

export interface GateResolved {
  known: KnownFact[]
  non_blocking_unknowns: UnknownFact[]
}

/**
 * What kind of thing this turn is, relative to the conversation so far.
 *
 * *** `first` IS A FOURTH VALUE ON PURPOSE. *** Without it `kind` would have to lie on turn 1 —
 * calling the opening question a "new_question" makes the first turn indistinguishable from a
 * subject change on turn 9, and §77's rule that a first turn behaves exactly as it did before
 * `priorTurns` existed would be untestable. `WORKSPACE.md` §4.1, `docs/GATE-HISTORY.md` §8.
 */
export type FollowUpKind = 'first' | 'elaboration' | 'refinement' | 'new_question'

export interface FollowUp {
  kind: FollowUpKind
  /** Which earlier turn this follows up ON. Null for `first` and `new_question`. The caller
   *  needs it to know WHICH answer an elaboration is elaborating. */
  refersToTurn: number | null
  /** One sentence. For the record, and for a person reading why the pipeline did what it did.
   *  NEVER rendered to the user as written. */
  because: string
}

export type GateResult =
  | { outcome: 'proceed'; resolved: GateResolved; frame: Frame; followUp: FollowUp }
  | { outcome: 'ask'; ask: GateAsk; frame: Frame; followUp: FollowUp }

/** A user answering a previous ask, carried back by the client with the ORIGINAL question.
 *  DETERMINATION-GATE.md §5.2. */
export interface GateAnswering {
  switch_id: string | null
  fact: string
  value: string
}

export interface GateInput {
  question: string
  /** Parsed blocks from lib/documentContent.ts. Empty when no file was uploaded. */
  documentBlocks: AIContent
  companyId: string
  /** The CALLER declares this. The model never decides how strict to be about itself —
   *  that is the same class of thing as a model setting its own `verified` flag. */
  outputType: 'answer' | 'checklist'
  /** The caller's token-scoped client, so RLS applies. Never hoisted, never cached. */
  db: SupabaseClient<any, any, any>

  /**
   * *** `answering` SURVIVES, AND IT FOLDS INTO THE SAME COLLAPSED SET. ***
   *
   * The question was whether keeping both produces two places carrying one fact. It does not,
   * and the reason is that they are different turns rather than two records of one:
   * `priorTurns` is turns 1..N-1; `answering` is the fact supplied in THIS turn, in reply to
   * the ask this call is re-entering.
   *
   * What WOULD have produced two places is the old handling — `answering` pushed straight into
   * `known` while conversation facts went somewhere else. So the field stays and the HANDLING
   * folds: it becomes the last turn of the conversation and goes through `collapseTurns` with
   * everything else. **One code path produces facts; one place collapses them.** If a client
   * ever sends the same fact in both, collapse resolves it — `answering` is the later turn and
   * wins, which is §82.4's correction rule, not a special case. DECISIONS.md §84.
   */
  answering?: GateAnswering | null

  /** The conversation so far, as CLAIMS. Never prose. Absent on a first turn, and the gate must
   *  then behave exactly as it did before this existed — which is what keeps the three golden
   *  cases asserting across the change. `docs/GATE-HISTORY.md`. */
  priorTurns?: PriorTurn[]
}

// ---------------------------------------------------------------------------
// THE PROMPT
//
// ONE prompt with ONE variable block, selected by outputType. Not two prompts: two prompts
// drift apart and the drift is invisible.
// ---------------------------------------------------------------------------

const GATE_BODY = `You are the determination gate for CompliBoard. You run BEFORE any answer is produced.

Your only job is to decide whether the answer depends on a fact we do not have.
You do NOT answer the question. You do NOT list requirements. You do NOT research.
If you find yourself writing what the user should do, you have left your job.

WHAT YOU ARE GIVEN
  The user's question.
  The document they uploaded, if any.
  Facts already established about this company, with how each was established.
  The vocabulary of facts this product knows how to ask about.

  Any of the last three may be empty. Empty means "not established" — it never
  means "false", "none" or "not applicable".

WHAT TO DO
  1. Name the facts that DETERMINE the answer to this question. Not facts that
     would be nice to have — facts the answer is a function of.
  2. For each, mark it known or unknown. A fact is known only if it appears in
     the established facts, is stated in the question, or is legible in the
     uploaded document. A fact you can infer confidently is NOT known.
  3. For each unknown, decide whether it is BLOCKING. See the threshold below.
  4. If nothing is blocking, return outcome "proceed" and list what you resolved
     and what remains unknown but non-blocking.
  5. If something is blocking, return outcome "ask" with EXACTLY ONE question —
     the one that unlocks the most.

THE ONE QUESTION
  You may ask one. Not two, not "one, and also". If two facts are blocking, ask
  for the artifact that resolves both, or ask the one that determines the other.

  Pair it with what it unlocks. "Upload the SDS and I can give you the exact
  packing group, UN number, and whether limited quantity applies" is a trade
  someone can evaluate. "What is the packing group?" is an obstacle.

  Prefer an ARTIFACT over an interrogation. A document the user already has beats
  a question they have to research. If an artifact would resolve it, name the
  artifact.

  State what you would assume if they do not answer. If that assumption is
  reasonable, the fact was not blocking — return "proceed" instead.

WHAT IS NOT BLOCKING
  A fact that changes the wording but not the substance.
  A fact you would state conditionally in an answer (see the threshold below).
  A fact already established, even if established by inference, as long as it is
  recorded with its source.
  Anything you want in order to be more helpful rather than more correct.

  Asking is expensive. A question the user abandons is worse than an answer that
  hedges honestly.`

const THRESHOLD_ANSWER = `THRESHOLD FOR THIS REQUEST — ANSWER

  Ask only if the answer BRANCHES MATERIALLY on the missing fact.

  An answer may hedge. "If packing group II, then X; if III, then Y" is a complete
  and honest answer, and you should prefer it to a question whenever the branches
  are few and each is genuinely usable.

  Blocking means: the branches are so different that stating them all would be
  useless or misleading, OR the fact determines five or more downstream facts, OR
  one branch says "this does not apply to you at all" and another says "this is a
  critical obligation".

  When you proceed with an unknown, you MUST list it in non_blocking_unknowns and
  the answer will state its conditionality. An unknown that is neither asked about
  nor declared is the failure this gate exists to prevent.`

const THRESHOLD_CHECKLIST = `THRESHOLD FOR THIS REQUEST — CHECKLIST

  Ask if the CONTENT OF ANY STEP would change.

  This is stricter than for an answer, and the reason is not stylistic. A checklist
  is a list of things a person will actually do, with hours and dollars attached.
  It is the expensive place to be wrong.

  A checklist MAY NOT HEDGE. There is no field in the checklist schema for a
  conditional step, and that absence is deliberate. You cannot write "if PG II,
  order these labels; if PG III, order those". If you cannot say which, the only
  honest move available to you is to ask.

  A checklist request may ask a question before producing anything. That is correct
  behaviour, not friction.

  Blocking means: any step's action, cost, deadline, form number, or applicability
  would differ depending on the missing fact.`

const OUTPUT_INSTRUCTION = `Return ONE JSON object and nothing else. It has exactly one of two shapes,
chosen by "outcome". Never both. Never an answer with a question attached —
that is the failure mode this gate was built to remove.

EVERY response, of either shape, also carries "frame" and "follow_up":

  "follow_up": {
    "kind": "elaboration" | "refinement" | "new_question",
    "refers_to_turn": 3 or null,
    "because": "one sentence"
  }

Only when FACTS STATED IN THIS CONVERSATION is present. On a first turn, omit it.

  elaboration    Asks for MORE about something already answered, and asserts no new fact.
                 "Explain step 3." "Where do I buy UN-spec boxes?" "What does that cost?"
  refinement     A fact changed, so the previous answer was built on something no longer
                 true. "What if it is PG III?" "Actually we use a carrier." "Closer to 40
                 people." The answer must be RECOMPUTED, not appended to.
  new_question   Not a follow-up to the previous answer. A different subject.

  refers_to_turn  Which turn is being followed up ON. Null for new_question.
  because         Why you chose that kind, in one sentence. Name what you compared.

A NEW QUESTION IS NOT A NEW TOPIC. Someone asking about shipping and then about storage has
asked two questions in one conversation. "new_question" means run the full pipeline rather
than an expansion. It does not mean the conversation ended, and you must not treat earlier
facts as stale because the subject changed — they are still true, and their frame says what
they are about.

EVERY response, of either shape, also carries "frame":

  "frame": {
    "jurisdiction": { "state": "Arizona", "county": null, "city": "Phoenix" },
    "tense": "present" | "hypothetical",
    "subject": "a solvent blending facility" or null
  }

The frame describes THE QUESTION, not the company. They are often different.

  jurisdiction  Where the question is about. An Oregon company can ask about Arizona.
                Null fields where the question does not say.
  tense         "hypothetical" when the question is about something that DOES NOT EXIST
                YET — a facility they are considering, a product they might make, a
                transaction they might do. "present" when it is about the operation as it
                is today. "We are thinking about opening" is hypothetical. "We operate"
                is present.
  subject       What the question is about, in a few words. It is context and nothing
                more: it must never be used to decide that something does not apply.

TENSE MATTERS MORE THAN IT LOOKS. A fact stated about a hypothetical facility is NOT a
fact about this company. "The Arizona site would have 12 employees" does not contradict
"we have 47 employees" — they describe different things. If you are unsure, say
"hypothetical": treating a real fact as hypothetical costs a question, and treating a
hypothetical as real produces an answer about a facility that does not exist.

If nothing is blocking:
{
  "outcome": "proceed",
  "frame": { ... },
  "resolved": {
    "known": [{ "switch_id": null, "fact": "...", "value": "...", "source": "stated_in_question" }],
    "non_blocking_unknowns": [{ "switch_id": null, "fact": "...", "stated_conditionally_as": "..." }]
  }
}

If something is blocking:
{
  "outcome": "ask",
  "frame": { ... },
  "ask": {
    "question": "one sentence",
    "artifact": "the SDS for this product" or null,
    "unlocks": ["...", "..."],
    "switch_id": null,
    "why_blocking": "one sentence",
    "assumed_if_unanswered": "what you would have assumed",
    "known": [{ "switch_id": null, "fact": "...", "value": "...", "source": "..." }]
  }
}

"source" is one of: user_set, ai_from_documents, ai_from_profile, computed, stated_in_question,
hypothetical. Use "hypothetical" for any fact stated about something that does not exist yet —
it is a statement about MODALITY, not about where the fact came from.

DO NOT ASK FOR ANYTHING ALREADY IN "FACTS STATED IN THIS CONVERSATION". It was established in
an earlier turn and asking again is the loop this gate exists to prevent. If an earlier turn
and a later one disagree within the same frame, the LATER one is a correction and wins.
Use a switch_id ONLY if the vocabulary below lists it. Otherwise null.`

export function buildGatePrompt(outputType: 'answer' | 'checklist'): string {
  const threshold = outputType === 'checklist' ? THRESHOLD_CHECKLIST : THRESHOLD_ANSWER
  return [GATE_BODY, threshold, OUTPUT_INSTRUCTION].join('\n\n')
}

// ---------------------------------------------------------------------------
// THE GATE
// ---------------------------------------------------------------------------

/** The strongest tier goes to the gate and the critic — DECISIONS.md §5. Model routing is
 *  otherwise private to lib/ai.ts; this override is named here because §5 allocates it. */
const GATE_OPTIONS = {
  maxTokens: 1500,
  temperature: 0.1,
  // A decision, not prose — DECISIONS.md §5 allocates the judgement tier to this stage.
  task: 'judgement' as const,
  // WEB SEARCH IS OFF, DELIBERATELY. The gate decides what facts are MISSING; it does not
  // look anything up. A gate with search will research its way around a blocking fact and
  // return "proceed" on a guess — the exact failure it exists to prevent, arriving with
  // citations attached.
  enableWebSearch: false,
} as const

export async function gate(input: GateInput): Promise<GateResult> {
  const { question, documentBlocks, companyId, outputType, db, answering, priorTurns } = input

  // --- what is already established, and the vocabulary of what can be asked ---
  //
  // Both tables are EMPTY until 6.2 seeds them, and the empty path is not a temporary
  // fallback: the 2.5L blocker (packing group) is a fact about a PRODUCT IN A SHIPMENT, not
  // about a company, so it will never be in `switches` however well seeded. The gate must
  // always be able to reason about a blocking fact it has no vocabulary entry for.
  // DETERMINATION-GATE.md §8.
  const known: KnownFact[] = []

  // --- JURISDICTION, WHICH IS ALWAYS ESTABLISHED AND IS NOT A SWITCH ---
  //
  // Found while writing golden case 003, and the spec as first written did not have it:
  // the gate read company_switches and switches only, so it could not see where the
  // worksite IS. It would then ask "where is your site?" — a fact migration 010 guarantees
  // every company already has, and DECISIONS.md §25 says comes from GEOCODING rather than
  // from asking. That is the persistence failure in DETERMINATION-GATE.md §7 arriving on
  // day one, for the single most frequently determining fact in the product.
  //
  // Jurisdiction lives on entities (migration 009), not in company_switches, because it is
  // a property of a SITE rather than a company (DECISIONS.md §20). Read it directly.
  const { data: site } = await db
    .from('entities')
    .select('name, state, county, city')
    .eq('company_id', companyId)
    .eq('is_primary', true)
    .maybeSingle()

  if (site) {
    const s = site as unknown as { name: string; state: string | null; county: string | null; city: string | null }
    // source is ai_from_profile: these came from the address the company gave at signup,
    // resolved by geocoding. Not user_set — the user gave an address, not a county.
    if (s.state) known.push({ switch_id: null, fact: 'worksite state', value: s.state, source: 'ai_from_profile' })
    if (s.county) known.push({ switch_id: null, fact: 'worksite county', value: s.county, source: 'ai_from_profile' })
    if (s.city) known.push({ switch_id: null, fact: 'worksite city', value: s.city, source: 'ai_from_profile' })
  }

  const { data: established } = await db
    .from('company_switches')
    .select('switch_id, value, source, switches(label)')
    .eq('company_id', companyId)

  for (const row of established ?? []) {
    const r = row as unknown as {
      switch_id: string; value: string; source: FactSource
      switches: { label: string } | null
    }
    known.push({
      switch_id: r.switch_id,
      fact: r.switches?.label ?? r.switch_id,
      value: r.value,
      source: r.source,
    })
  }

  // *** THE CONVERSATION, INCLUDING `answering` AS ITS LAST TURN. ***
  //
  // `answering` used to be pushed straight into `known` — which put a conversation fact in the
  // same list as facts read from `company_switches`, and would have been a second place carrying
  // a fact once `priorTurns` existed. It now enters the conversation instead, as the turn after
  // the last one, and `collapseTurns` handles it with everything else. §84.
  //
  // It keeps the property its old comment claimed: a fact supplied in reply to an ask is present
  // when the gate runs again, so the gate does not block twice on the same fact.
  const turns: PriorTurn[] = [...(priorTurns ?? [])]
  if (answering) {
    const lastTurn = turns.reduce((m, t) => Math.max(m, t.turn), 0)
    const lastFrame: Frame = turns.length > 0
      ? turns[turns.length - 1].frame
      : { jurisdiction: {}, tense: 'present', subject: null }
    turns.push({
      turn: lastTurn + 1,
      frame: lastFrame,
      facts: [{
        switch_id: answering.switch_id,
        fact: answering.fact,
        value: answering.value,
        // `user_set` unless the frame it was given under is hypothetical — a fact supplied
        // about a facility that does not exist is not a fact about the company (§78).
        source: lastFrame.tense === 'hypothetical' ? 'hypothetical' : 'user_set',
      }],
    })
  }

  // The vocabulary. `question_plain` is the agreed wording for a fact, so the same question
  // is not phrased three different ways across three sessions; `depends_on_switch` is the
  // order, so the gate does not ask about a PSM threshold before establishing that any
  // listed substance is handled at all.
  const { data: vocabulary } = await db
    .from('switches')
    .select('id, label, question_plain, depends_on_switch, depends_on_value, domain')
    .order('id')

  // requirement_templates is NOT read here. Retrieving library rows to decide what to ask
  // is Stage 3's work at Stage 1, and it inverts the pipeline. The cost of being wrong is
  // asymmetric and that is what settles it: including the rows makes the gate a second
  // identification pass whose every question is defensible in isolation — invisible when
  // wrong — while excluding them risks missing a blocking fact only a library row knew
  // about, which the critic pass catches at Stage 5. DETERMINATION-GATE.md §6.

  const contextLines = buildGateContext(question, known, vocabulary ?? [], turns)

  const content: AIContent = Array.isArray(documentBlocks) && documentBlocks.length > 0
    ? ([...documentBlocks, { type: 'text', text: contextLines }] as AIContent)
    : contextLines

  const raw = await askAIJson<GateResult>(buildGatePrompt(outputType), content, GATE_OPTIONS)

  return normalise(raw, known, answering ?? null, turns.length > 0)
}


/**
 * Make the model's output safe to act on, and enforce the rules the schema cannot.
 *
 * THE SUPPRESSION RULE IS THE IMPORTANT ONE. If the gate asks for the very fact the user
 * has just supplied, that is a bug — and the user experiences it as an infinite loop, which
 * is the one failure worse than a wrong answer. When it happens, proceed instead of asking
 * again, carrying the fact as known. DETERMINATION-GATE.md §5.2 rule 2.
 */
/**
 * *** TURN-ONE TENSE IS ONE PASS, ONE DIRECTION, AND IT DID NOT RESIST. ***
 *
 * The apparent circularity — the gate returns the frame AND labels facts by it — is that both
 * outputs come from the same call, not that either depends on the other. The model reads the
 * question, decides jurisdiction/tense/subject, and labels the facts it found IN that question.
 * Nothing needs the frame before the frame exists. DECISIONS.md §84.
 *
 * The frame falls back to `present` with no jurisdiction when the model does not return one.
 * **`present` is the safe default in the wrong direction only if a hypothetical is read as real**
 * — so the prompt must make tense explicit, and a missing frame on a hypothetical question is a
 * prompt defect rather than something to paper over here.
 */
/**
 * *** CLASSIFICATION IS TWO FIELDS, NOT A THIRD AI CALL. ***
 *
 * `WORKSPACE.md` §4.1 said "one cheap classification call decides". That is SUPERSEDED (§85):
 * §77 settled the research path at two calls — gate, then answer — three days after §4.1 was
 * written, and the gate already holds the question, the prior turns and the frame, which is
 * everything classification needs. §77 items 6-8 folded web search and frame detection in for the
 * same reason.
 *
 * TURN 1 IS ALWAYS `first`, DECIDED HERE AND NOT BY THE MODEL. With no prior turns there is
 * nothing to follow up on, and letting the model choose invites it to call an opening question a
 * "new_question" — which is true in English and wrong as a signal.
 */
function normaliseFollowUp(raw: unknown, hasPriorTurns: boolean): FollowUp {
  if (!hasPriorTurns) {
    return { kind: 'first', refersToTurn: null, because: 'No earlier turns in this conversation.' }
  }
  // *** THE WIRE IS snake_case; THIS TYPE IS camelCase. *** The prompt asks for
  // `refers_to_turn` and the first version of this function read `refersToTurn` — so it was
  // always undefined and every follow-up came back with `refersToTurn: null`, on all four kinds,
  // while the classification itself was correct. **A field that is always null looks like a
  // field that is legitimately empty.** Caught by running all four kinds and noticing that the
  // one which must point somewhere pointed nowhere. DECISIONS.md §86.
  const f = (raw ?? {}) as Partial<FollowUp> & { refers_to_turn?: unknown }
  const rawRefers = f.refers_to_turn ?? f.refersToTurn
  const kind: FollowUpKind =
    f.kind === 'elaboration' || f.kind === 'refinement' || f.kind === 'new_question'
      ? f.kind
      // An unreadable kind becomes `new_question`, which runs the FULL pipeline. The safe
      // direction: an elaboration wrongly re-answered costs time, while a refinement wrongly
      // treated as an elaboration leaves a stale answer on screen above a correction — the exact
      // failure §4.1's "refinement recomputes; it does not append" exists to prevent.
      : 'new_question'
  const refers = typeof rawRefers === 'number' && rawRefers > 0 ? rawRefers : null
  return {
    kind,
    // `new_question` refers to nothing by definition, whatever the model returned.
    refersToTurn: kind === 'new_question' ? null : refers,
    because: typeof f.because === 'string' && f.because.trim() ? f.because.trim() : '(not stated)',
  }
}

function normaliseFrame(raw: unknown): Frame {
  const f = (raw ?? {}) as Partial<Frame> & { jurisdiction?: Frame['jurisdiction'] }
  return {
    jurisdiction: {
      state: f.jurisdiction?.state ?? null,
      county: f.jurisdiction?.county ?? null,
      city: f.jurisdiction?.city ?? null,
    },
    tense: f.tense === 'hypothetical' ? 'hypothetical' : 'present',
    subject: typeof f.subject === 'string' && f.subject.trim() ? f.subject.trim() : null,
  }
}

export function normalise(
  raw: GateResult & { frame?: unknown; follow_up?: unknown },
  known: KnownFact[],
  answering: GateAnswering | null,
  hasPriorTurns = false
): GateResult {
  const frame = normaliseFrame((raw as { frame?: unknown })?.frame)
  const followUp = normaliseFollowUp((raw as { follow_up?: unknown })?.follow_up, hasPriorTurns)
  if (!raw || typeof raw !== 'object' || !('outcome' in raw)) {
    // A gate that cannot be parsed must not block the answer. Proceeding is the safe
    // direction here: the critic pass still sees the output, and a broken gate that
    // silently swallowed every question would be undetectable.
    return { outcome: 'proceed', resolved: { known, non_blocking_unknowns: [] }, frame, followUp }
  }

  if (raw.outcome === 'ask') {
    const ask = raw.ask

    if (answering && asksForTheSameFact(ask, answering)) {
      return {
        outcome: 'proceed',
        resolved: {
          known,
          non_blocking_unknowns: [{
            switch_id: answering.switch_id,
            fact: answering.fact,
            // The assumption the gate itself wrote. Surfacing it is what keeps a
            // suppressed ask honest rather than silent.
            stated_conditionally_as: ask.assumed_if_unanswered ||
              `answered by the user as "${answering.value}"`,
          }],
        },
        frame,
        followUp,
      }
    }

    return {
      outcome: 'ask',
      ask: {
        question: ask.question,
        artifact: ask.artifact ?? null,
        // unlocks must not be empty — a question whose own payoff cannot be named is not
        // worth asking. If the model left it empty, say so rather than showing a bare
        // question with an empty bullet list.
        unlocks: Array.isArray(ask.unlocks) && ask.unlocks.length > 0
          ? ask.unlocks
          : ['a more accurate answer'],
        switch_id: ask.switch_id ?? null,
        why_blocking: ask.why_blocking ?? '',
        assumed_if_unanswered: ask.assumed_if_unanswered ?? '',
        known: ask.known?.length ? ask.known : known,
      },
      frame,
      followUp,
    }
  }

  return {
    outcome: 'proceed',
    resolved: {
      known: raw.resolved?.known?.length ? raw.resolved.known : known,
      non_blocking_unknowns: raw.resolved?.non_blocking_unknowns ?? [],
    },
    frame,
    followUp,
  }
}

/** Same switch id, or the same fact by name. Loose on purpose: a second ask for the fact
 *  just answered is always a bug, so a false positive here (proceeding) is much cheaper
 *  than a false negative (an infinite ask). */
function asksForTheSameFact(ask: GateAsk, answering: GateAnswering): boolean {
  if (ask.switch_id && answering.switch_id && ask.switch_id === answering.switch_id) return true
  const a = (ask.question ?? '').toLowerCase()
  const f = (answering.fact ?? '').toLowerCase().trim()
  return f.length > 3 && a.includes(f)
}
