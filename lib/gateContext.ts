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
  /**
   * *** A DIFFERENT AXIS FROM THE OTHER FIVE. *** They say where a fact CAME FROM.
   * `hypothetical` says whether it is TRUE.
   *
   * "We have 12 employees" and "the Arizona facility would have 12" are BOTH stated in the
   * question and differ in modality, not provenance. Reusing `stated_in_question` collapses two
   * dimensions, and the collapse is invisible because every hypothetical does arrive stated in a
   * question. DECISIONS.md §82.
   *
   * A `hypothetical` fact NEVER reaches `company_switches` (§78) and never resolves an
   * obligation — both structural: `/api/switches/answer` is the only writer and takes no frame,
   * and `writeObligations` reads `company_switches` and nothing else.
   */
  | 'hypothetical'

export interface KnownFact {
  switch_id: string | null
  fact: string
  value: string
  source: FactSource
}

/**
 * The frame a turn was answered under. `WORKSPACE.md` v3 / DECISIONS.md §77 item 8.
 *
 * *** `tense` IS WHAT MARKS A FACT HYPOTHETICAL AT THE MOMENT IT IS CAPTURED. *** Without it the
 * next turn has to re-infer modality from a verb — "would have" versus "have" is one word, and
 * asking a model to catch it reliably every turn is the enumerate-from-nothing failure in
 * miniature.
 */
export interface Frame {
  jurisdiction: { state?: string | null; county?: string | null; city?: string | null }
  tense: 'present' | 'hypothetical'
  /** What the question is about. CONTEXT WITH NO AUTHORITY — it may not exclude anything. */
  subject: string | null
}

/** A fact asserted in the conversation, already labelled. The gate never re-derives these. */
export interface ConversationFact {
  switch_id: string | null
  fact: string
  value: string
  source: FactSource
}

/** One earlier turn, reduced to what it asserted. Claims, never prose. */
export interface PriorTurn {
  turn: number
  frame: Frame
  facts: ConversationFact[]
}

const frameKey = (f: Frame) =>
  `${f.jurisdiction.state ?? ''}|${f.jurisdiction.county ?? ''}|${f.jurisdiction.city ?? ''}|${f.tense}`

/**
 * *** COLLAPSE ONLY WHERE A LATER VALUE SUPERSEDES AN EARLIER ONE IN THE SAME FRAME. ***
 *
 * DECISIONS.md §83's standing discipline, and the boundary is the whole of it:
 *
 *   SAME frame, same switch, later turn   -> the later value WINS. A correction (§82.4).
 *   DIFFERENT frame, same switch          -> BOTH SURVIVE. `employee_count = 47 [user_set]` and
 *                                            `employee_count = 12 [hypothetical]` describe
 *                                            different things and are not in conflict at all.
 *
 * **No further trimming for size.** §83 measured the latency argument and withdrew it: the gate
 * ran 1.3s FASTER with 7.7x the context. There is no summary, no window and no turn cap here,
 * and adding one needs a reason that is not input size.
 */
export function collapseTurns(turns: PriorTurn[]): Array<ConversationFact & { turn: number; frame: Frame }> {
  const byKey = new Map<string, ConversationFact & { turn: number; frame: Frame }>()
  for (const t of [...turns].sort((a, b) => a.turn - b.turn)) {
    for (const f of t.facts) {
      byKey.set(`${f.switch_id ?? f.fact}|${frameKey(t.frame)}`, { ...f, turn: t.turn, frame: t.frame })
    }
  }
  return [...byKey.values()].sort((a, b) => a.turn - b.turn)
}

/** The conversation block. Empty string when there is no conversation — a first turn renders
 *  exactly what it rendered before this existed, which is what keeps the golden cases asserting
 *  across the change. */
export function renderConversation(turns: PriorTurn[]): string {
  if (turns.length === 0) return ''
  const facts = collapseTurns(turns)
  if (facts.length === 0) return ''
  const lines: string[] = ['FACTS STATED IN THIS CONVERSATION:']
  let lastTurn = -1
  for (const f of facts) {
    if (f.turn !== lastTurn) {
      const j = [f.frame.jurisdiction.city, f.frame.jurisdiction.county, f.frame.jurisdiction.state]
        .filter(Boolean).join(', ') || '(not stated)'
      lines.push(`  turn ${f.turn}  jurisdiction=${j}  tense=${f.frame.tense.toUpperCase()}` +
                 (f.frame.subject ? `  subject="${f.frame.subject}"` : ''))
      lastTurn = f.turn
    }
    lines.push(`    ${f.fact.padEnd(32)} = ${String(f.value).padEnd(14)} [${f.source}]`)
  }
  lines.push('')
  lines.push('  A [hypothetical] fact describes something that DOES NOT EXIST YET. It does not')
  lines.push('  contradict an established fact about the company, and it must not be treated as one.')
  return lines.join('\n')
}

export function buildGateContext(
  question: string,
  known: KnownFact[],
  vocabulary: Array<Record<string, unknown>>,
  priorTurns: PriorTurn[] = []
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
  // The conversation, between what is established and what is being asked — because it is
  // neither. An established fact is about the company; a conversation fact may be about
  // something that does not exist.
  const convo = renderConversation(priorTurns)
  if (convo) {
    contextLines.push('')
    contextLines.push(convo)
  }
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
