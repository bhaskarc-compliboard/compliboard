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


/* ==========================================================================================
 * WHAT THE ANSWER CALL RECEIVES — three blocks, split by the FRAME. M1.9, DECISIONS.md §103.
 *
 * *** WHY THIS REPLACES establishedFactsBlock() AND WHY IT IS THREE FUNCTIONS. ***
 *
 * The old block put every fact the gate returned under one heading — "WHAT IS ALREADY
 * ESTABLISHED ABOUT THIS COMPANY" — and told the model to treat them as settled. Measured on
 * 21 Sep, that included facts about a facility that DOES NOT EXIST: a hypothetical Arizona site's
 * confined spaces arrived as settled fact about an Oregon business. §78 made that impossible for
 * `company_switches`; nothing made it impossible for the prompt.
 *
 * *** ROUTING IS BY THE FRAME, NOT BY THE `source` LABEL. ***
 * The label is not reliable enough to route on, and the measurement is the proof: in ONE
 * conversation about an Arizona facility, `entity_state = Arizona` came back as
 * `stated_in_question` on turn 1 and `hypothetical` on turn 2. Same fact, same scenario, two
 * labels. The FRAME said `tense: hypothetical` both times.
 *
 *   A turn whose frame is hypothetical describes the SCENARIO. Every fact stated in that turn
 *   belongs to the scenario, whatever each one happens to be tagged.
 *
 * The label stays on the line as information for the reader. It no longer decides anything.
 * ========================================================================================== */

/** `switches.scope`. A fact about one site, or about the whole business. */
export type SwitchScope = 'company' | 'site'

/**
 * Per-site numbers and their enterprise-wide counterparts.
 *
 * `CLAUDE.md` §1: *"`employee_count` exists twice for that reason — once enterprise-wide and once
 * per site — since Oregon's sick-time rule reads '10+ Oregon employees or 6+ with a Portland
 * location' in a single sentence."*
 *
 * **ONE MEMBER TODAY, and it is here rather than inferred** because the pairing is what makes the
 * expansion case answerable: a 47-person business opening a 12-person site is 59 people and
 * crosses FMLA at 50. Nothing derives that from `scope` alone — `scope` says which thing a number
 * describes, not that two numbers are the same quantity at two levels.
 */
const SITE_TO_ENTERPRISE: Record<string, string> = { site_employee_count: 'employee_count' }

export interface AnswerContext {
  /** Facts about the business as it exists. */
  business: KnownFact[]
  /** Facts about a facility that does not exist yet. Empty unless a frame was hypothetical. */
  scenario: Array<KnownFact & { scope: SwitchScope | null }>
  /** The frame the ANSWER must be written for. */
  frame: Frame
}

/**
 * Split what the gate returned into "the business" and "the scenario".
 *
 * @param known       the gate's `resolved.known`
 * @param priorTurns  the conversation, each turn carrying its own frame
 * @param frame       THIS turn's frame
 * @param scopeOf     switch_id -> scope, from the `switches` table
 */
export function splitForAnswer(
  known: KnownFact[],
  priorTurns: PriorTurn[],
  frame: Frame,
  scopeOf: Record<string, SwitchScope>,
): AnswerContext {
  // Every fact stated in a hypothetical-framed turn, by identity. The CURRENT turn counts when
  // its own frame is hypothetical — that is the turn-1 case, where there are no prior turns yet.
  const scenarioKeys = new Set<string>()
  for (const t of priorTurns) {
    if (t.frame.tense !== 'hypothetical') continue
    for (const f of t.facts) scenarioKeys.add(f.switch_id ?? f.fact)
  }
  const statedNow = (k: KnownFact) => k.source === 'stated_in_question' || k.source === 'hypothetical'

  const business: KnownFact[] = []
  const scenario: Array<KnownFact & { scope: SwitchScope | null }> = []
  for (const k of known) {
    const key = k.switch_id ?? k.fact
    // *** `statedNow` IS REQUIRED, NOT A REFINEMENT. *** Routing on the key alone pulled the
    // BUSINESS'S OWN fact into the scenario whenever the scenario mentioned the same switch: the
    // real `Permit-required confined spaces = false [user_set]` was moved out of the business
    // block and listed beside the scenario's `= true`, so the business silently lost a fact and
    // the scenario contradicted itself. Caught by RUNNING the renderer — a hand-written example
    // did not have it (DECISIONS.md §104).
    //
    // A fact the business ESTABLISHED is never a scenario fact. Only something stated in a
    // hypothetical-framed turn is.
    const belongsToScenario =
      statedNow(k) && (scenarioKeys.has(key) || frame.tense === 'hypothetical')
    if (belongsToScenario) scenario.push({ ...k, scope: k.switch_id ? (scopeOf[k.switch_id] ?? null) : null })
    else business.push(k)
  }
  return { business, scenario, frame }
}

/** The subject is a noun phrase from the model, so it arrives lowercase. It opens a line here. */
const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t)

/** `source` as English. The enum is a database value and has no business in a prompt. */
function provenance(s: FactSource): string {
  switch (s) {
    case 'user_set': return '[they told us]'
    case 'stated_in_question': return '[they told us, in this conversation]'
    case 'ai_from_documents': return '[from a document you uploaded]'
    case 'ai_from_profile': return '[from their profile]'
    case 'computed': return '[worked out from your other answers]'
    case 'hypothetical': return '[said about the scenario]'
  }
}

/** BLOCK B — the business. Premises to reason from, never a checklist to work through. */
export function businessFactsBlock(business: KnownFact[]): string {
  if (business.length === 0) return ''
  const width = Math.max(...business.map((k) => `${k.fact} = ${k.value}`.length)) + 2
  return [
    'WHAT WE ALREADY KNOW ABOUT THIS BUSINESS — these are premises. Reason from them.',
    '',
    ...business.map((k) => `  ${`${k.fact} = ${k.value}`.padEnd(width)}${provenance(k.source)}`),
    '',
    'Start from these. Work out what they mean for this question and say it.',
    '',
    'Use the ones that bear on this question. Ignore the rest and do not mention them.',
    '',
    'They are settled. Do not ask the user to confirm them, and do not write out the alternatives',
    'they rule out.',
    '',
    'If the answer still turns on something not listed here, say so — that is a real gap, not a',
    'reason to hedge.',
  ].join('\n')
}

/**
 * BLOCK C — the scenario. Rendered only when a frame was hypothetical.
 *
 * *** SITE FACTS REPLACE. COMPANY FACTS ADD. *** A new facility is not a different business:
 * a site-scoped fact describes the new site and governs a question about it, while a
 * company-scoped fact changes the enterprise. Telling the model "this wins, do not reconcile"
 * was wrong for the company case — it suppresses the most useful thing an expansion answer can
 * say, which is that 47 people plus 12 is 59 and 50 is where FMLA starts.
 */
export function scenarioBlock(
  scenario: Array<KnownFact & { scope: SwitchScope | null }>,
  frame: Frame,
  business: KnownFact[],
): string {
  if (scenario.length === 0) return ''
  const where = [frame.jurisdiction.city, frame.jurisdiction.county, frame.jurisdiction.state]
    .filter(Boolean).join(', ')
  const site = scenario.filter((k) => k.scope === 'site')
  const company = scenario.filter((k) => k.scope === 'company')
  const unscoped = scenario.filter((k) => k.scope === null)

  const lines: string[] = [
    'THE SCENARIO THIS QUESTION IS ABOUT — IT DOES NOT EXIST YET, AND IT IS NOT THIS BUSINESS.',
    '',
    `  ${cap(frame.subject ?? 'A new facility')}${where ? `, in ${where}` : ''}.`,
    '',
  ]
  const render = (rows: typeof scenario) => rows.map((k) => `    ${k.fact} = ${k.value}`)
  if (site.length) {
    lines.push('  ABOUT THE NEW SITE — for a question about this facility, these govern. The',
               '  business\'s other sites keep their own values; nothing here changes them.',
               ...render(site), '')
  }
  if (company.length) {
    // "ADD" alone is wrong for an enum or a boolean — a blending facility does not add
    // blending to a business that blends. The wording has to cover both shapes.
    lines.push('  ABOUT THE BUSINESS AS A WHOLE — a new facility is part of the same business, so',
               '  these describe the business once it exists. They add to what is true of it rather',
               '  than replacing anything, and where the fact is a number, the totals change.',
               ...render(company), '')
  }
  if (unscoped.length) {
    lines.push('  ALSO STATED, and we cannot tell whether it describes the site or the business:',
               ...render(unscoped), '')
  }

  // The cross-level arithmetic, and it only appears when both halves are actually present.
  const byId = Object.fromEntries(business.filter((b) => b.switch_id).map((b) => [b.switch_id!, b]))
  for (const k of site) {
    const enterpriseId = k.switch_id ? SITE_TO_ENTERPRISE[k.switch_id] : undefined
    const existing = enterpriseId ? byId[enterpriseId] : undefined
    if (existing) {
      lines.push(
        `  AND THE COMBINED FIGURE MATTERS: the business already has ${existing.fact} = ${existing.value}.`,
        `  Adding this facility takes the enterprise-wide total to ${Number(existing.value) + Number(k.value)}.`,
        '  Say what that combined number means — a threshold the business is under today and would',
        '  cross, or one it already crosses, is the most useful thing this answer can tell them.',
        '')
    }
  }
  lines.push(
    `Answer for this scenario${where ? ` and for ${where}` : ''}, not for where the business operates today.`,
    '',
    'None of this is a fact about the business. None of it is stored.')
  return lines.join('\n')
}

/** BLOCK D — one line, from the frame. The answer is written for the QUESTION's jurisdiction. */
export function jurisdictionLine(frame: Frame, businessState: string | null): string {
  const j = frame.jurisdiction
  const where = [j.city, j.county, j.state].filter(Boolean).join(', ')
  if (!where) {
    return 'This question does not name a place. If the answer depends on which state, county or\n' +
           'city, say so rather than picking one.'
  }
  if (frame.tense === 'hypothetical' && businessState && j.state && j.state !== businessState) {
    return `Answer for ${where}. That is where the scenario above is, and it is not where this\n` +
           `business operates — do not answer for ${businessState}.`
  }
  return `Answer for ${where}. That is the jurisdiction this question is about.`
}
