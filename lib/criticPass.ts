/**
 * STAGE 5 — THE CRITIC PASS
 *
 * Full specification: docs/CRITIC-PASS.md. Read it before changing anything here; every part
 * of this file is quality-affecting under CLAUDE.md §3.1.
 *
 * A FRESH CALL THAT SEES ONLY THE OUTPUT, asked to find what is wrong with it.
 *
 * THE ASYMMETRY IT RESTS ON. Critique is cheap and reliable; generation is expensive and
 * fragile. A model reviewing a written artifact is in its strongest mode — it has an anchor
 * (CLAUDE.md §3.3). A model producing an answer from a question has none. That is why this
 * runs on the STRONGEST tier (`task: 'critique'`, lib/ai.ts) and why routing had to exist
 * before this file could: the same tier for generation and critique gives up the advantage.
 *
 * *** IT NEVER REGENERATES AND NEVER LOOPS. *** CHEMICAL-OR-WA.md §5.2 says "material error →
 * one loop back to identification", and identification does not exist. But the decision holds
 * even after it does, and the reason is not cost: A SILENT FIX DESTROYS THE EVIDENCE.
 * TESTING.md (b) says the golden set grows by one entry per failure found — a self-healing
 * loop means no failures are ever found, the suite stops growing, and quality comes to depend
 * on a loop nobody measures. The critic reports; CODE decides what happens, from severity.
 * DECISIONS.md §39.
 *
 * WHAT IT MUST NEVER BE SHOWN: the prompt that produced the answer. A critic reading the
 * generating instructions is reviewing its own reasoning and will agree with it. CriticInput
 * HAS NO FIELD FOR IT — the wrong input is unrepresentable rather than discouraged, which is
 * DECISIONS.md §34's lesson applied a second time.
 */

import { askAIJson, type AIContent } from '@/lib/ai'
import type { KnownFact } from '@/lib/gateContext'

// ---------------------------------------------------------------------------
// OUTPUT
// ---------------------------------------------------------------------------

/**
 * What happens to a finding is decided in CODE from this, never by the critic choosing to
 * loop. docs/CRITIC-PASS.md §6.
 *
 *   blocking   — the item is WITHHELD and the reason shown. Not a regeneration: an empty
 *                checklist with a reason is more honest than a second guess.
 *   qualifying — shown beside the answer. What `conditional_on` and `note` are for.
 *   coverage   — surfaced as a gap, the same sentence the coverage strip will one day show.
 */
export type Severity = 'blocking' | 'qualifying' | 'coverage'

/** Which of the seven questions produced it. 5 is counted separately — see §6.2. */
export type CriticQuestion = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface Finding {
  severity: Severity
  question: CriticQuestion
  /** VERBATIM from the answer. A finding that cannot point at a sentence is an impression,
   *  and impressions are what this task produces when there is nothing wrong. */
  quote: string
  /** Which item, by name. Null for a whole-answer finding (questions 6 and 7). */
  item: string | null
  /** One sentence: what is wrong. */
  finding: string
  /** One sentence: why — the rule, the scope, the missing fact. */
  because: string
}

export interface CriticResult {
  findings: Finding[]
  /** False when the critic ran out of tokens mid-review. Exists because TRUNCATION AND
   *  CLEANLINESS ARE INDISTINGUISHABLE IN AN EMPTY ARRAY — CLAUDE.md §5 in its most literal
   *  form. A caller must never report an incomplete review as "nothing found". */
  complete: boolean
}

/** One findings array, not §5.2's four buckets. Four arrays is four things a model feels
 *  obliged to fill; severity and question carry the same information as fields, and an empty
 *  array is one thing to leave empty rather than four. */

// ---------------------------------------------------------------------------
// INPUT — and what is deliberately absent from it
// ---------------------------------------------------------------------------

export interface CriticInput {
  /** The user's words, verbatim. Without it "does this answer the question?" is unanswerable. */
  question: string
  /** The answer object exactly as produced. */
  answer: unknown
  /** Which question set to apply. The CALLER decides — a model choosing how hard to be on
   *  itself is the same class of thing as a model setting its own `verified` flag. */
  questionSet: 'requirements' | 'evidence'
  /** What was established before the answer was written, and how. gate.resolved.known */
  establishedFacts: KnownFact[]
  /** What was knowingly left open. gate.resolved.non_blocking_unknowns */
  declaredUnknowns: Array<{ fact: string; stated_conditionally_as?: string }>
  /** Agencies with jurisdiction over this company. The FULL list today — Stage 2 does not
   *  exist to narrow it, and a list that is too broad produces a false positive a human can
   *  dismiss while a missing list produces a silent gap nobody sees. docs/CRITIC-PASS.md §5. */
  agenciesInScope: Array<{ short_name: string; name: string }>
  /** A short extraction of what the answer used from an uploaded document — NOT the document.
   *  Passing the source lets the critic re-derive the answer and then confirm it, which is
   *  the failure this stage exists to avoid. If the extraction is wrong, that is a finding. */
  factsReliedOn?: string | null
}

// *** THERE IS NO `systemPrompt`, NO `mode`, AND NO `documentBlocks` FIELD ON CriticInput. ***
// Each is deliberate and each is explained in docs/CRITIC-PASS.md §1.3. If you are here to
// add one "for context", that is the thing this interface exists to prevent.

// ---------------------------------------------------------------------------
// THE PROMPT — one body, one variable question set
// ---------------------------------------------------------------------------

const CRITIC_BODY = `You are reviewing a compliance answer for errors, before it is shown to a small
business owner who will act on it. Be adversarial. Look for what is wrong.

You did not write this answer and you have not seen the instructions that produced
it. Do not reconstruct them. Review what is in front of you.

WHAT YOU ARE GIVEN
  The question the user asked, in their words.
  The answer produced.
  The facts that were established before the answer was written, and how each
    was established.
  The facts that were NOT established and were knowingly left open.
  The agencies with jurisdiction over this company.`

const SET_REQUIREMENTS = `FOR EACH ITEM IN THE ANSWER
  1. PHYSICAL OBJECT. What does this requirement attach to — the bottle, the case,
     the pallet, the vehicle, the site, the person, the record? Is that correct?
  2. REGIME. Transport, workplace, environmental, fire, tax? Is that the right
     regime for that object?
  3. SCOPE. Does the rule actually reach this object, or does it attach to
     something one level up or down? A rule about a package is not a rule about
     what is inside it.
  4. DETERMINATION. What fact does this depend on? Check it against the
     established facts you were given. If it is not there, the answer assumed it.
  5. SPECIFICS. Flag every date, fee, threshold, penalty figure and form number.
     Every one. This is not a judgement call.`

const SET_EVIDENCE = `FOR EACH LINE ITEM
  1. BASIS. What is the verdict built on? Which documents were actually read?
  2. COVERAGE OF EVIDENCE. How many documents were available and how many were
     used? A verdict from a subset is a verdict on a subset.
  3. EXPIRY. Does any document relied on carry a date that has passed?
  4. SPECIFICITY. Does the document cited actually address this requirement, or
     merely mention the same words?
  5. SPECIFICS. Flag every date, fee, threshold and form number.`

const CRITIC_TAIL = `THEN, ACROSS THE WHOLE ANSWER
  6. COVERAGE. For each agency with jurisdiction: was it addressed? What
     obligation of that agency is conspicuously absent?
  7. ASSUMPTIONS. Does any statement assume a fact the user did not provide and
     that is not in the established facts?

QUOTE WHAT YOU ARE TALKING ABOUT
  Every finding must carry the exact text from the answer that it is about. If you
  cannot point at a specific sentence, you do not have a finding — you have an
  impression, and impressions are what this task produces when there is nothing
  wrong.

FINDING NOTHING IS A VALID AND EXPECTED RESULT
  Most correct answers produce zero errors and one or two unverified specifics.
  Returning an empty findings array is a successful review, not a failed one. Do
  not manufacture a finding to have something to say.

SEVERITY
  blocking   — the item is wrong, or depends on a fact nobody established. It will
               be WITHHELD from what the user sees.
  qualifying — the item stands but carries something unverified or assumed.
  coverage   — an agency with jurisdiction was not addressed at all.

Return ONE JSON object and nothing else:
{
  "findings": [
    {
      "severity": "blocking" | "qualifying" | "coverage",
      "question": 1-7,
      "quote": "the exact text from the answer this is about",
      "item": "the item's name, or null for a whole-answer finding",
      "finding": "one sentence: what is wrong",
      "because": "one sentence: why"
    }
  ],
  "complete": true
}

Set "complete" to false ONLY if you could not review every item.`

export function buildCriticPrompt(questionSet: 'requirements' | 'evidence'): string {
  return [
    CRITIC_BODY,
    questionSet === 'evidence' ? SET_EVIDENCE : SET_REQUIREMENTS,
    CRITIC_TAIL,
  ].join('\n\n')
}

// ---------------------------------------------------------------------------
// THE CALL
// ---------------------------------------------------------------------------

const CRITIC_OPTIONS = {
  // 12000, NOT the 3000 the spec first proposed. The critique tier routes to a THINKING
  // model, and thinking blocks are drawn from the SAME max_tokens budget as the answer — a
  // 3000-token budget was consumed entirely by thinking and returned no text at all, with
  // `stop_reason: max_tokens` and a single empty `thinking` block. askAI's automatic retry
  // (doubling to a 32000 ceiling) would eventually have recovered it, at the cost of two
  // wasted calls on every review.
  //
  // A reviewer that reasons before answering is exactly what this tier was chosen for. The
  // budget has to pay for the reasoning as well as the findings.
  maxTokens: 12000,
  // Kept, and ignored where the model does not accept it — lib/ai.ts drops it for the
  // Claude 5 family, which rejects the parameter outright. The intent survives: those models
  // are deterministic by default.
  temperature: 0.1,
  // THE STRONGEST TIER. The one pass whose whole job is finding what is wrong.
  task: 'critique' as const,
  // Search is OFF for the same reason it is off in the gate: the critic judges an artifact
  // against itself and against what was established. A critic that researches is generating.
  enableWebSearch: false,
} as const

export async function criticise(input: CriticInput): Promise<CriticResult> {
  const lines: string[] = []
  lines.push('THE QUESTION THE USER ASKED:')
  lines.push(input.question)
  lines.push('')
  lines.push('ESTABLISHED FACTS, AND HOW EACH WAS ESTABLISHED:')
  lines.push(input.establishedFacts.length === 0
    ? '  (none — nothing about this company was established before the answer was written)'
    : input.establishedFacts.map((f) => `  ${f.fact} = ${f.value}   [${f.source}]`).join('\n'))
  lines.push('')
  lines.push('FACTS KNOWINGLY LEFT OPEN:')
  lines.push(input.declaredUnknowns.length === 0
    ? '  (none declared)'
    : input.declaredUnknowns.map((u) => `  ${u.fact}${u.stated_conditionally_as ? ` — stated as: ${u.stated_conditionally_as}` : ''}`).join('\n'))
  lines.push('')
  lines.push('AGENCIES WITH JURISDICTION OVER THIS COMPANY:')
  lines.push(input.agenciesInScope.length === 0
    ? '  (none known — do not treat this as "no agency applies")'
    : input.agenciesInScope.map((a) => `  ${a.short_name}: ${a.name}`).join('\n'))
  if (input.factsReliedOn) {
    lines.push('')
    lines.push('WHAT THE ANSWER TOOK FROM AN UPLOADED DOCUMENT:')
    lines.push(input.factsReliedOn)
  }
  lines.push('')
  lines.push('THE ANSWER TO REVIEW:')
  lines.push(JSON.stringify(input.answer, null, 2))

  const content: AIContent = lines.join('\n')
  const raw = await askAIJson<CriticResult>(buildCriticPrompt(input.questionSet), content, CRITIC_OPTIONS)
  return normaliseCritique(raw)
}

/**
 * Make the critic's output safe to act on.
 *
 * A CRITIC THAT FAILS MUST NOT LOOK LIKE A CLEAN REVIEW. Every failure path below returns
 * `complete: false` with no findings, so a caller checking `complete` can tell "reviewed and
 * found nothing" from "did not review" — which an empty array alone cannot express.
 */
export function normaliseCritique(raw: unknown): CriticResult {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as CriticResult).findings)) {
    return { findings: [], complete: false }
  }
  const r = raw as CriticResult
  const findings = r.findings
    // A finding with no quote is an impression. Dropped rather than shown: the prompt asks
    // for a quote precisely so an invented finding is hard to write, and honouring that here
    // is what makes the instruction structural rather than advisory.
    .filter((f) => f && typeof f.quote === 'string' && f.quote.trim().length > 0)
    .map((f) => ({
      severity: (['blocking', 'qualifying', 'coverage'] as const).includes(f.severity) ? f.severity : 'qualifying',
      question: (typeof f.question === 'number' && f.question >= 1 && f.question <= 7 ? f.question : 7) as CriticQuestion,
      quote: f.quote.trim(),
      item: f.item ?? null,
      finding: String(f.finding ?? '').trim(),
      because: String(f.because ?? '').trim(),
    }))
  return { findings, complete: r.complete !== false }
}

// ---------------------------------------------------------------------------
// WHAT THE CALLER DOES WITH IT
// ---------------------------------------------------------------------------

/**
 * Split the findings the three ways §6.1 specifies. The CALLER decides the threshold; the
 * critic only says what it found and how severe.
 *
 * Question 5 is separated out because "flag every specific" is pattern-matching rather than
 * adversarial judgement and fires on nearly every answer. FOLDING IT INTO A FINDINGS COUNT
 * MAKES THE COUNT MEANINGLESS — and the count is the only way to detect a critic that has
 * started inventing (docs/CRITIC-PASS.md §7.1).
 */
export function applyCritique(result: CriticResult) {
  const blocking = result.findings.filter((f) => f.severity === 'blocking')
  const coverage = result.findings.filter((f) => f.severity === 'coverage')
  const qualifying = result.findings.filter((f) => f.severity === 'qualifying' && f.question !== 5)
  const specifics = result.findings.filter((f) => f.question === 5)
  return {
    /** Item names to withhold from the answer, each with the reason to show in its place. */
    withheld: blocking.map((f) => ({ item: f.item, finding: f.finding, because: f.because, quote: f.quote })),
    /** Shown beside the answer. */
    qualifications: qualifying,
    /** Agencies with jurisdiction that the answer never addressed. */
    gaps: coverage,
    /** Dates, fees, thresholds and form numbers. Counted on their own line. */
    unverifiedSpecifics: specifics,
    complete: result.complete,
  }
}
