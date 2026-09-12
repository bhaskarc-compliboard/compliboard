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

import { askAIJson, type AIContent } from '@/lib/ai'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// THE OUTPUT UNION
// ---------------------------------------------------------------------------

/** How a fact came to be known. Mirrors company_switches.source (migration 008), plus one
 *  value that is deliberately NOT a company_switches source: a fact stated in this question
 *  belongs to this question, and is never persisted. */
export type FactSource =
  | 'user_set'
  | 'ai_from_documents'
  | 'ai_from_profile'
  | 'computed'
  | 'stated_in_question'

export interface KnownFact {
  /** switches.id when the fact is in the vocabulary; null for a scoped product fact. */
  switch_id: string | null
  fact: string
  value: string
  source: FactSource
}

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

export type GateResult =
  | { outcome: 'proceed'; resolved: GateResolved }
  | { outcome: 'ask'; ask: GateAsk }

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
  answering?: GateAnswering | null
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

If nothing is blocking:
{
  "outcome": "proceed",
  "resolved": {
    "known": [{ "switch_id": null, "fact": "...", "value": "...", "source": "stated_in_question" }],
    "non_blocking_unknowns": [{ "switch_id": null, "fact": "...", "stated_conditionally_as": "..." }]
  }
}

If something is blocking:
{
  "outcome": "ask",
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

"source" is one of: user_set, ai_from_documents, ai_from_profile, computed, stated_in_question.
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
  // WEB SEARCH IS OFF, DELIBERATELY. The gate decides what facts are MISSING; it does not
  // look anything up. A gate with search will research its way around a blocking fact and
  // return "proceed" on a guess — the exact failure it exists to prevent, arriving with
  // citations attached.
  enableWebSearch: false,
} as const

export async function gate(input: GateInput): Promise<GateResult> {
  const { question, documentBlocks, companyId, outputType, db, answering } = input

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

  // The fact the user just supplied in answer to a previous ask. It enters as known with
  // source user_set, which is what stops the gate blocking twice on the same fact.
  if (answering) {
    known.push({
      switch_id: answering.switch_id,
      fact: answering.fact,
      value: answering.value,
      source: 'user_set',
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

  const contextLines: string[] = []
  contextLines.push('ESTABLISHED FACTS ABOUT THIS COMPANY:')
  contextLines.push(known.length === 0
    ? '  (none established — this is not the same as "none apply")'
    : known.map((k) => `  ${k.fact} = ${k.value}   [${k.source}]`).join('\n'))
  contextLines.push('')
  contextLines.push('VOCABULARY OF FACTS THIS PRODUCT CAN ASK ABOUT:')
  contextLines.push((vocabulary ?? []).length === 0
    ? '  (empty — the switch library is not seeded yet. Reason from the question and the\n' +
      '   document alone, and return switch_id: null for anything you ask about.)'
    : (vocabulary ?? []).map((v) => {
        const s = v as unknown as {
          id: string; label: string; question_plain: string | null
          depends_on_switch: string | null; depends_on_value: string | null
        }
        const dep = s.depends_on_switch ? `  (only if ${s.depends_on_switch} = ${s.depends_on_value})` : ''
        return `  ${s.id}: ${s.label}${dep}${s.question_plain ? `\n     ask as: ${s.question_plain}` : ''}`
      }).join('\n'))
  contextLines.push('')
  contextLines.push(`THE USER'S QUESTION:`)
  contextLines.push(question)

  const content: AIContent = Array.isArray(documentBlocks) && documentBlocks.length > 0
    ? ([...documentBlocks, { type: 'text', text: contextLines.join('\n') }] as AIContent)
    : contextLines.join('\n')

  const raw = await askAIJson<GateResult>(buildGatePrompt(outputType), content, GATE_OPTIONS)

  return normalise(raw, known, answering ?? null)
}

/**
 * Make the model's output safe to act on, and enforce the rules the schema cannot.
 *
 * THE SUPPRESSION RULE IS THE IMPORTANT ONE. If the gate asks for the very fact the user
 * has just supplied, that is a bug — and the user experiences it as an infinite loop, which
 * is the one failure worse than a wrong answer. When it happens, proceed instead of asking
 * again, carrying the fact as known. DETERMINATION-GATE.md §5.2 rule 2.
 */
export function normalise(
  raw: GateResult,
  known: KnownFact[],
  answering: GateAnswering | null
): GateResult {
  if (!raw || typeof raw !== 'object' || !('outcome' in raw)) {
    // A gate that cannot be parsed must not block the answer. Proceeding is the safe
    // direction here: the critic pass still sees the output, and a broken gate that
    // silently swallowed every question would be undetectable.
    return { outcome: 'proceed', resolved: { known, non_blocking_unknowns: [] } }
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
    }
  }

  return {
    outcome: 'proceed',
    resolved: {
      known: raw.resolved?.known?.length ? raw.resolved.known : known,
      non_blocking_unknowns: raw.resolved?.non_blocking_unknowns ?? [],
    },
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
