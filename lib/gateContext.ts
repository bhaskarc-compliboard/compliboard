/**
 * THE GATE'S USER-SIDE CONTEXT — in its own file, with NO IMPORTS, on purpose.
 *
 * `scripts/run-golden.js` is a plain Node script and must call this exact function rather
 * than reimplement it. It cannot import `lib/determinationGate.ts`, because that module
 * imports `@/lib/ai` — a TypeScript path alias only `tsconfig` understands, which Node
 * cannot resolve. This file has no imports at all, so Node's native type stripping loads it
 * directly and the runner and the routes are provably building the same string.
 *
 * WHY THAT MATTERS ENOUGH TO WARRANT A FILE. The runner already rebuilds the PROMPT from
 * source rather than holding a copy, because a copy drifts and the drift is silent — the
 * tests keep passing against the stale copy. It then hand-rolled the CONTEXT, and that copy
 * drifted exactly as predicted: it emitted `id: label` per switch where this function emits
 * the `ask as:` wording and the `only if` dependency. Ninety bare id-and-label lines pushed
 * the model toward bare questions naming no artifact, so the runner was measuring a gate the
 * routes do not use — and reporting PASS on it. AUDIT-CHECKS.md check 14.
 *
 * Anything that changes what the gate is told goes HERE, once.
 */

/** Mirrors company_switches.source, plus one value that is never persisted. */
export type FactSource =
  | 'user_set'
  | 'ai_from_documents'
  | 'ai_from_profile'
  | 'computed'
  | 'stated_in_question'

export interface KnownFact {
  switch_id: string | null
  fact: string
  value: string
  source: FactSource
}

export function buildGateContext(
  question: string,
  known: KnownFact[],
  vocabulary: Array<Record<string, unknown>>
): string {
  const contextLines: string[] = []
  contextLines.push('ESTABLISHED FACTS ABOUT THIS COMPANY:')
  contextLines.push(known.length === 0
    ? '  (none established — this is not the same as "none apply")'
    : known.map((k) => `  ${k.fact} = ${k.value}   [${k.source}]`).join('\n'))
  contextLines.push('')
  contextLines.push('VOCABULARY OF FACTS THIS PRODUCT CAN ASK ABOUT:')
  contextLines.push(vocabulary.length === 0
    ? '  (empty — the switch library is not seeded yet. Reason from the question and the\n' +
      '   document alone, and return switch_id: null for anything you ask about.)'
    : vocabulary.map((v) => {
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

  return contextLines.join('\n')
}

/**
 * THE FACTS THE GATE ESTABLISHED, WRITTEN FOR THE GENERATING CALL.
 *
 * Added 12 September 2026, after a model benchmark made a pipeline bug visible.
 *
 * THE BUG: the gate ran, established that the worksite was Hillsboro, Washington County,
 * Oregon — and `g.resolved` went into the HTTP response and NOWHERE ELSE. The generating
 * call received `buildSystemPrompt(mode, scanResult)` and the raw question, and nothing
 * about what had just been determined. **The product was asking the model to answer
 * questions it had already answered for itself.**
 *
 * It showed up as an anomaly in a model comparison rather than as a bug report: asked what
 * minimum wage applies "at our Hillsboro plant", one model produced an OHIO minimum-wage
 * branch — Hillsboro, Ohio is a real place — for a company whose site the gate knew was in
 * Oregon. The other refused to name a rate until the state was confirmed. Both were
 * reasonable answers to a question nobody had told them was already settled.
 *
 * Lives here, beside buildGateContext, because "how an established fact is written into a
 * prompt" should have ONE answer. The gate and the generator now phrase it identically, so
 * a fact does not change shape as it moves between stages.
 */
export function establishedFactsBlock(known: KnownFact[]): string {
  if (known.length === 0) return ''
  return [
    'WHAT IS ALREADY ESTABLISHED ABOUT THIS COMPANY:',
    known.map((k) => `  ${k.fact} = ${k.value}   [established by: ${k.source}]`).join('\n'),
    '',
    'Treat these as settled. Do not ask the user to confirm them, do not branch on them, and',
    'do not answer for a jurisdiction other than the one named here.',
  ].join('\n')
}
