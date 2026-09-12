/**
 * applies_expression — THE FORMAT, AND THE RENDERER THAT MAKES IT REVIEWABLE.
 *
 * Spec: `TODO.md` 6.3. Decision: `DECISIONS.md` §43.
 *
 * WHAT THIS IS. The machine-evaluable form of a requirement's `trigger_condition` prose.
 * Nested JSON in `requirement_templates.applies_expression`, referencing switch ids only.
 *
 * WHY JSON AND NOT A SMALL DSL, WHICH READS BETTER. A DSL needs a parser, a grammar, error
 * messages and a test suite — for 188 expressions that never exceed two levels of nesting.
 * And a malformed DSL string is only detectable at evaluation time, whereas malformed JSON
 * fails on insert. `CLAUDE.md` §3.2 requires resolution to be deterministic, and a
 * hand-written parser is the most likely place for that to quietly stop being true.
 * Postgres can also query inside jsonb — "which requirements reference exposure_lead" is a
 * containment query rather than a string search, which is what the determination gate's
 * eventual swap needs.
 *
 * *** SO THE FORMAT IS JSON AND THE REVIEW ARTIFACT IS ENGLISH. *** `render()` below turns
 * an expression into one readable line. It exists because the owner is the verification
 * step, and a format that has to be parsed by a human before it can be checked makes that
 * step theatre. Store the structure; review the sentence.
 *
 * THE ONE PROPERTY THAT MATTERS MOST IS NOT THE FORMAT. `evaluate()` returns
 * `true | false | unknown`, and an unset switch produces `unknown`, never `false`.
 * `CLAUDE.md` §3.2: absence of evidence never produces a clear. This is three-valued logic
 * and it is deliberate — `unknown AND false` is `false` (one branch already fails), but
 * `unknown AND true` is `unknown` (we cannot say). Getting that table wrong is the single
 * most dangerous thing in this file.
 */

// ---------------------------------------------------------------------------
// THE FORMAT
// ---------------------------------------------------------------------------

export type Operator = 'is' | 'not' | '>=' | '>' | '<=' | '<' | '=' | '!=' | 'in' | 'known'

/** One switch tested against one value. `known` takes no value: it asks only whether the
 *  fact has been established at all, which some requirements genuinely turn on. */
export interface Clause {
  switch: string
  op: Operator
  value?: string | number | boolean | Array<string | number>
  /** Optional human gloss, shown by the renderer where the switch id alone reads poorly. */
  as?: string
}

/** `substance_inventory(list)` — the per-substance calculation no switch can express.
 *  Migration 013. Kept as its own node type rather than a magic switch id so the renderer
 *  and the evaluator both have to handle it deliberately. */
export interface InventoryClause {
  inventory: 'ehs' | 'tri' | 'psm' | 'rmp' | 'cercla' | 'dea_list_i'
  as?: string
}

/**
 * The SITE's jurisdiction — state, county, city.
 *
 * NOT A SWITCH, and its own node type for that reason. `DECISIONS.md` §38.3 dropped
 * `entity_county` precisely so jurisdiction would not become a fifth free-text place to
 * disagree with itself; it lives on `entities` (migration 009) and the gate reads it from
 * there (§35.2). An expression that needs it must not reach for a switch that should not
 * exist.
 *
 * FOUND BY RENDERING TWENTY EXPRESSIONS. The Oregon sick-time rule turns on "6+ with a
 * Portland location", and the first draft invented a `worksite_city` switch to say so —
 * caught because `switchesIn()` reported a reference the seeded vocabulary did not contain.
 */
export interface JurisdictionClause {
  jurisdiction: 'state' | 'county' | 'city'
  op: 'is' | 'not' | 'in'
  value: string | string[]
  as?: string
}

export interface AllNode { all: Expression[] }
export interface AnyNode { any: Expression[] }
export interface NotNode { not: Expression }

export type Expression = Clause | InventoryClause | JurisdictionClause | AllNode | AnyNode | NotNode

const isAll = (e: Expression): e is AllNode => 'all' in e
const isAny = (e: Expression): e is AnyNode => 'any' in e
const isNot = (e: Expression): e is NotNode => 'not' in e
const isInv = (e: Expression): e is InventoryClause => 'inventory' in e
const isJur = (e: Expression): e is JurisdictionClause => 'jurisdiction' in e

// ---------------------------------------------------------------------------
// THREE-VALUED EVALUATION
// ---------------------------------------------------------------------------

export type Truth = true | false | 'unknown'

/** The facts a company has established. Missing key = not established = unknown. */
export type Facts = Record<string, string | number | boolean | null | undefined>

/** The site's jurisdiction, read from `entities` rather than from a switch. */
export type Jurisdiction = { state?: string | null; county?: string | null; city?: string | null }

/**
 * AND over three-valued logic. `false` wins over `unknown` — if one branch is definitely
 * false the whole conjunction is false whatever else is unknown. `unknown` wins over `true`.
 */
function and3(vals: Truth[]): Truth {
  if (vals.some((v) => v === false)) return false
  if (vals.some((v) => v === 'unknown')) return 'unknown'
  return true
}

/** OR. `true` wins over `unknown` — one definite branch is enough. */
function or3(vals: Truth[]): Truth {
  if (vals.some((v) => v === true)) return true
  if (vals.some((v) => v === 'unknown')) return 'unknown'
  return false
}

function not3(v: Truth): Truth {
  return v === 'unknown' ? 'unknown' : !v
}

export function evaluate(
  e: Expression,
  facts: Facts,
  inventory?: (list: InventoryClause['inventory']) => Truth,
  jurisdiction?: Jurisdiction
): Truth {
  if (isAll(e)) return and3(e.all.map((c) => evaluate(c, facts, inventory, jurisdiction)))
  if (isAny(e)) return or3(e.any.map((c) => evaluate(c, facts, inventory, jurisdiction)))
  if (isNot(e)) return not3(evaluate(e.not, facts, inventory, jurisdiction))
  if (isInv(e)) return inventory ? inventory(e.inventory) : 'unknown'
  if (isJur(e)) {
    const v = jurisdiction?.[e.jurisdiction]
    if (v === undefined || v === null || v === '') return 'unknown'
    if (e.op === 'in') return Array.isArray(e.value) && e.value.includes(v)
    const match = v === e.value
    return e.op === 'not' ? !match : match
  }

  const v = facts[e.switch]
  // NOT ESTABLISHED IS UNKNOWN. Not false. This line is the safety property.
  if (v === undefined || v === null) return e.op === 'known' ? false : 'unknown'
  if (e.op === 'known') return true

  switch (e.op) {
    case 'is':  return v === e.value
    case 'not': return v !== e.value
    case '=':   return v === e.value
    case '!=':  return v !== e.value
    case '>=':  return Number(v) >= Number(e.value)
    case '>':   return Number(v) >  Number(e.value)
    case '<=':  return Number(v) <= Number(e.value)
    case '<':   return Number(v) <  Number(e.value)
    case 'in':  return Array.isArray(e.value) && (e.value as Array<string | number>).includes(v as string | number)
    default:    return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// THE RENDERER — the review artifact
// ---------------------------------------------------------------------------

const HUMAN_OP: Record<Operator, string> = {
  is: 'is', not: 'is not', '>=': 'is at least', '>': 'is more than',
  '<=': 'is at most', '<': 'is under', '=': 'is', '!=': 'is not',
  in: 'is one of', known: 'has been established',
}

const INVENTORY_PHRASE: Record<InventoryClause['inventory'], string> = {
  ehs: 'this site holds any extremely hazardous substance at or above its own threshold planning quantity',
  tri: 'this site holds any TRI-listed chemical at or above its own activity threshold',
  psm: 'this site holds any PSM-listed substance at or above its own threshold quantity',
  rmp: 'this site holds any RMP-listed substance at or above its own threshold quantity',
  cercla: 'this site holds any substance at or above its CERCLA reportable quantity',
  dea_list_i: 'this site holds any DEA List I chemical',
}

function renderClause(c: Clause): string {
  // An `as` gloss REPLACES THE WHOLE CLAUSE, it does not just rename the subject.
  // Rendering twenty produced "flammable liquids at or above the fire-code maximum is
  // at_or_above_maq" — the gloss and the raw enum value both, which reads worse than the
  // bare switch id it was meant to improve. For an enum the whole sentence has to be
  // written by hand or not at all.
  if (c.as && (typeof c.value === 'string' && !/^(true|false)$/.test(c.value))) return c.as
  const subject = c.as ?? c.switch
  if (c.op === 'known') return `${subject} has been established`
  if (typeof c.value === 'boolean') return c.value ? subject : `not ${subject}`
  const val = Array.isArray(c.value) ? c.value.join(' or ') : String(c.value)
  return `${subject} ${HUMAN_OP[c.op]} ${val}`
}

function renderJurisdiction(j: JurisdictionClause): string {
  if (j.as) return j.as
  const val = Array.isArray(j.value) ? j.value.join(' or ') : j.value
  const verb = j.op === 'not' ? 'is not' : 'is'
  return `the site ${j.jurisdiction} ${verb} ${val}`
}

/**
 * One expression, one readable line.
 *
 * Brackets only where precedence needs them — a flat `all` of three clauses reads as
 * "A and B and C" rather than "((A and B) and C)", because the point is legibility and
 * unnecessary brackets are the thing that made the raw JSON unreadable in the first place.
 */
export function render(e: Expression, depth = 0): string {
  if (isInv(e)) return e.as ?? INVENTORY_PHRASE[e.inventory]
  if (isJur(e)) return renderJurisdiction(e)
  if (isNot(e)) return `not (${render(e.not, depth + 1)})`
  if (isAll(e)) {
    const parts = e.all.map((c) => render(c, depth + 1))
    const joined = parts.join(' AND ')
    return depth > 0 && parts.length > 1 ? `(${joined})` : joined
  }
  if (isAny(e)) {
    const parts = e.any.map((c) => render(c, depth + 1))
    const joined = parts.join(' OR ')
    return depth > 0 && parts.length > 1 ? `(${joined})` : joined
  }
  return renderClause(e)
}

/** Every switch id an expression references. Used to validate against the seeded
 *  vocabulary before an expression is stored, and to answer "what would break if this
 *  switch changed". */
export function switchesIn(e: Expression): string[] {
  if (isAll(e)) return e.all.flatMap(switchesIn)
  if (isAny(e)) return e.any.flatMap(switchesIn)
  if (isNot(e)) return switchesIn(e.not)
  if (isInv(e) || isJur(e)) return []
  return [e.switch]
}

/**
 * Every number an expression asserts.
 *
 * *** THE RULE THIS EXISTS FOR: a threshold in an expression must appear in the rule's own
 * text, in that unit. *** Otherwise the expression asserts a number nobody wrote down.
 * `DECISIONS.md` §44. The classic way to get this wrong is a unit conversion — turning a
 * threshold written in pounds into gallons by assuming a density, which is a property of one
 * product rather than of the rule. `npm run check` can compare this list against the row's
 * `trigger_condition` and `citation`, and flag any number that appears in neither.
 */
export function thresholdsIn(e: Expression): number[] {
  if (isAll(e)) return e.all.flatMap(thresholdsIn)
  if (isAny(e)) return e.any.flatMap(thresholdsIn)
  if (isNot(e)) return thresholdsIn(e.not)
  if (isInv(e) || isJur(e)) return []
  const vals = Array.isArray(e.value) ? e.value : [e.value]
  return vals.filter((v): v is number => typeof v === 'number')
}
