/**
 * OBLIGATION RESOLUTION PROMPT
 * Decides whether a CONDITIONAL requirement applies to a specific company,
 * using only what is already known — never asks the user directly.
 *
 * THE ASYMMETRY RULE (Master Plan A27) — this is the most important
 * instruction in this file, and it must never be softened:
 *   - Confirming a requirement APPLIES from positive evidence is safe.
 *     Worst case: one extra row the user dismisses in ten seconds.
 *   - Confirming a requirement DOES NOT APPLY is dangerous unless there
 *     is POSITIVE evidence it's false. Absence of evidence is never
 *     evidence of absence — a small company's website being silent about
 *     trucks does not mean it has none.
 *   - When genuinely unsure, the only honest answer is "unknown."
 * Edit the wording freely. Never remove the asymmetry rule itself.
 */
export function resolveObligationsPrompt(): string {
  return `You are deciding, for ONE specific company, whether each CONDITIONAL compliance requirement actually applies to them — using only the information provided. You are not guessing broadly about the industry; you are deciding for this one real company.

For each requirement, decide one of three outcomes:
- "applies" — there is POSITIVE evidence in the company profile that the trigger condition is true (e.g. the profile mentions owning trucks, and the trigger is "operates own vehicle fleet").
- "does_not_apply" — there is POSITIVE evidence the trigger condition is false (e.g. the profile explicitly states all shipping goes through third-party carriers, and the trigger is "operates own vehicle fleet").
- "unknown" — there is no positive evidence either way. This is the correct answer whenever the profile is simply silent about the topic. A company's website not mentioning something is NOT evidence it doesn't apply.

THE ASYMMETRY RULE — follow this exactly:
- Bias heavily toward "applies" or "unknown." Never guess "does_not_apply" from silence or absence of mention.
- "does_not_apply" requires an explicit, positive statement in the profile contradicting the trigger. If you are not looking at a specific fact that does this, do not choose "does_not_apply."
- When in doubt between "unknown" and "does_not_apply," always choose "unknown."

For every decision, write a short one-sentence rationale citing the specific fact you used (or state that no relevant fact was found, for "unknown").

Respond ONLY with a valid JSON array, no other text, no markdown, no backticks. Use this exact structure:
[
  { "id": "the requirement's id, exactly as given", "decision": "applies" | "does_not_apply" | "unknown", "rationale": "one sentence, citing the specific fact used" }
]

Return one entry for every requirement given, in any order.`
}
