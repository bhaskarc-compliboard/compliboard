/**
 * THE RESOLUTION ENGINE — layer 3.
 *
 * Spec: `TODO.md` 4.1. Safety properties: `CLAUDE.md` §3.2. Status vocabulary:
 * `DECISIONS.md` §21.3.
 *
 *   jurisdiction + switches + library version -> obligations, DETERMINISTICALLY.
 *
 * *** THIS FILE CONTAINS NO AI AND NEVER WILL. *** `CLAUDE.md` §1: layer 3 is "code, never
 * AI". The whole architecture rests on "what is missing" being a database query rather than
 * a guess, and that is only true if the thing that decides what applies is a pure function
 * of stated facts.
 *
 * WHAT IT RETURNS AND WHAT IT DOES NOT. It returns the obligations a company has RIGHT NOW.
 * It does not write them, does not close old ones, and does not know that older ones exist —
 * that is `close_and_replace_obligations` (§47), deliberately separate so that this half can
 * be tested without a database and that half can be tested without an expression.
 *
 * THE FOUR STATES, AND THE ONE DISTINCTION THAT MATTERS (§21.3):
 *
 *   applies         the requirement reaches this company
 *   does_not_apply  it definitively does NOT, and we can say what contradicts it
 *   unknown         WE LACK AN INPUT. A question we can put to the user; it clears itself
 *                   as documents arrive and facts get established
 *   undetermined    WE ASKED AND CANNOT RESOLVE IT. A dead end that needs a person
 *
 * `unknown` and `undetermined` sound alike and are operationally opposite: one populates the
 * question list, the other populates a human review queue. Collapsing them would either
 * flood the customer with questions that have no answer, or bury the ones that do.
 * **Neither ever becomes `does_not_apply`** — absence of evidence never produces a clear.
 */

import {
  evaluate,
  switchesIn,
  inventoriesIn,
  type Expression,
  type Facts,
  type InventoryClause,
  type Truth,
} from './appliesExpression.ts'
import {
  jurisdictionMatch,
  isSiteScopedLayer,
  type CompanyPlace,
  type JurisdictionLayer,
  type SitePlace,
} from './jurisdiction.ts'

export type ObligationStatus = 'applies' | 'does_not_apply' | 'undetermined' | 'unknown'

export interface Site extends SitePlace {
  id: string
  name: string
  isPrimary: boolean
}

export interface Company extends CompanyPlace {
  id: string
  name: string
  industry: string | null
}

export interface Requirement {
  id: string
  name: string
  layer: JurisdictionLayer
  state: string | null
  county: string | null
  city: string | null
  /** `organization | site | chemical | equipment | person | product` */
  entityType: string
  industries: string[]
  appliesExpression: Expression | null
}

export interface ResolveInput {
  company: Company
  sites: Site[]
  requirements: Requirement[]
  /** Company-scoped switch values. A key that is absent is NOT ESTABLISHED, never false. */
  companyFacts: Facts
  /** Site-scoped switch values, keyed by site id. */
  siteFacts: Record<string, Facts>
  /** `substance_inventory(entity_id, list)`. Absent means every inventory clause is unknown. */
  inventory?: (siteId: string, list: InventoryClause['inventory']) => Truth
}

/** The machine-readable half of the answer. `resolution_rationale` is the sentence. */
export interface DeterminedBy {
  jurisdiction: { layer: string; match: string; decided_by: string }
  /** Every switch the expression names, whether or not short-circuiting reached it. */
  switches: string[]
  /** Those of them this company has not established. THE ASK LIST. */
  switches_missing: string[]
  inventory: string[]
  inventory_missing: string[]
  /** Sites the expression was evaluated against, for an organization-level obligation. */
  sites_considered: string[]
  /**
   * Why a row could not be resolved AT ALL, as a code rather than as prose.
   *
   * `switches_missing` makes an `unknown` row aggregatable — it is the question queue. This
   * makes an `undetermined` row aggregatable too, which is the review queue. Without it the
   * only thing distinguishing one dead end from another is a sentence, and a sentence cannot
   * be grouped, counted or assigned. Absent on rows that resolved.
   */
  unresolvable_reason?: 'no_expression'
}

export interface ResolvedObligation {
  requirementTemplateId: string
  requirementName: string
  /** NULL for a company-level obligation; a site id for a per-site one. */
  entityId: string | null
  status: ObligationStatus
  /** `WORKSPACE.md` §187's vocabulary: how this was resolved, not who by. */
  resolvedBy: 'computed_by_code'
  resolutionRationale: string
  determinedBy: DeterminedBy
}

export interface ResolveResult {
  obligations: ResolvedObligation[]
  /** Library rows excluded before resolution because they serve another industry. */
  skippedOtherIndustry: number
}

// ---------------------------------------------------------------------------
// READING A FACT OUT OF THE DATABASE
// ---------------------------------------------------------------------------

/** The `switch_value_type` enum: how `company_switches.value` should be read. */
export type SwitchValueType = 'boolean' | 'number' | 'enum' | 'text'

/**
 * `company_switches.value` is TEXT for every switch, whatever the switch's value_type —
 * one column has to hold `'true'`, `'7'` and `'title_v'`. Turning that text back into a
 * typed value is not a formatting step; it is a safety property.
 *
 * *** WHY: `'true' === true` IS FALSE IN JAVASCRIPT. *** The evaluator compares a clause's
 * value with `===`, so an uncoerced `'true'` read against `{op:'is', value:true}` produces
 * **false** — not unknown, FALSE. A company that answered "yes, we have employees" would
 * have every requirement gated on that answer marked `does_not_apply`. The requirement would
 * leave their list, and the cause would be a string.
 *
 * Numbers happen to survive uncoerced because `evaluate()` wraps comparisons in `Number()`.
 * That is luck, not design, and it is exactly the kind of luck that makes a bug look like it
 * only affects booleans until someone adds an operator.
 *
 * *** AND UNPARSEABLE IS NULL, NEVER FALSE. *** `'yes'` in a boolean column, `'many'` in a
 * numeric one — these are values nobody can read, and a value nobody can read is a fact that
 * is NOT ESTABLISHED. `CLAUDE.md` §3.2. The tempting shorthand `value === 'true'` gets this
 * exactly backwards: it turns every unparseable answer into a confident no.
 */
export function coerceFact(
  raw: string | null | undefined,
  valueType: SwitchValueType,
): string | number | boolean | null {
  if (raw === null || raw === undefined) return null
  const t = raw.trim()
  if (t === '') return null

  switch (valueType) {
    case 'boolean': {
      const lower = t.toLowerCase()
      if (lower === 'true') return true
      if (lower === 'false') return false
      return null // NOT false. An unreadable answer is an unanswered question.
    }
    case 'number': {
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    }
    case 'enum':
    case 'text':
      return t
    default: {
      const unreachable: never = valueType
      throw new Error(`coerceFact: unhandled switch_value_type ${String(unreachable)}`)
    }
  }
}

/**
 * Is this row a fact at all?
 *
 * `company_switches` carries BOTH `value` and `state`, and they can disagree: a switch can
 * hold a stale value while `state` has been moved to `needs_user` because something made it
 * doubtful. Reading `value` alone would resurrect the stale answer as though nobody had
 * flagged it. Only `state = 'known'` with a readable value is a fact.
 */
export function isEstablished(state: string, raw: string | null | undefined, valueType: SwitchValueType): boolean {
  return state === 'known' && coerceFact(raw, valueType) !== null
}

// ---------------------------------------------------------------------------

const MATCH_WORD: Record<string, string> = { true: 'in_scope', false: 'out_of_scope', unknown: 'unknown' }

/**
 * OR across sites, three-valued — the same table as `any_of`, applied to the question
 * "does ANY of this company's sites satisfy the condition?".
 *
 * *** THIS IS WHY A SITE-SCOPED FACT CAN PRODUCE A COMPANY-LEVEL OBLIGATION. *** Oregon
 * sick time reads "10+ Oregon employees OR 6+ with a Portland location": one obligation,
 * triggered by a fact about one site among several.
 *
 * And the three-valued part is load-bearing: one site saying `false` while another says
 * `unknown` is UNKNOWN. A company that has told us about one plant and not the other
 * cannot be cleared on the strength of the plant it described.
 */
function anySite(values: Truth[]): Truth {
  if (values.some((v) => v === true)) return true
  if (values.some((v) => v === 'unknown')) return 'unknown'
  return false
}

/**
 * Site facts layered over company facts.
 *
 * `employee_count` exists twice on purpose — once enterprise-wide, once per site — so the
 * two never collide by name. Site values win on a collision anyway, because the more
 * specific fact is the one the clause meant.
 */
function factsFor(companyFacts: Facts, siteFacts: Facts | undefined): Facts {
  return { ...companyFacts, ...(siteFacts ?? {}) }
}

function missingOf(names: string[], facts: Facts): string[] {
  return [...new Set(names)].filter((n) => facts[n] === undefined || facts[n] === null).sort()
}

// ---------------------------------------------------------------------------

/**
 * Resolve one company's obligations.
 *
 * DETERMINISTIC (§3.2): the output is sorted, carries no timestamps, and reads nothing
 * outside its arguments. Two calls with equal input produce equal output, forever.
 */
export function resolve(input: ResolveInput): ResolveResult {
  const { company, sites, requirements, companyFacts, siteFacts, inventory } = input
  const obligations: ResolvedObligation[] = []
  let skippedOtherIndustry = 0

  // A deterministic site order. Primary first, then by id — never by insertion order,
  // which depends on how the rows came back from the database.
  const orderedSites = [...sites].sort((a, b) =>
    a.isPrimary === b.isPrimary ? a.id.localeCompare(b.id) : a.isPrimary ? -1 : 1,
  )

  for (const r of requirements) {
    // ---- INDUSTRY. Not a jurisdiction case and not an obligation state: a row serving
    // only cannabis is not a chemical manufacturer's requirement that happens not to
    // apply, it is not their requirement at all. Skipped rather than marked.
    if (company.industry !== null && !r.industries.includes(company.industry)) {
      skippedOtherIndustry++
      continue
    }

    const named = r.appliesExpression ? [...new Set(switchesIn(r.appliesExpression))].sort() : []
    const namedInv = r.appliesExpression
      ? [...new Set(inventoriesIn(r.appliesExpression))].sort()
      : []

    // ---- GRANULARITY. Two independent reasons to be per-site, and either is sufficient:
    // the requirement is about a site, or the jurisdiction layer is decided per site.
    const perSite = r.entityType === 'site' || isSiteScopedLayer(r.layer)
    const targets: Array<Site | null> = perSite ? orderedSites : [null]

    for (const target of targets) {
      // For an organization-level obligation the layer is federal/state/county/NULL — all
      // site-independent — so the primary site is a safe representative. For a per-site
      // obligation it is that site.
      const place = target ?? orderedSites[0] ?? null
      const sitePlace: SitePlace = place
        ? { state: place.state, county: place.county, city: place.city, fireAuthority: place.fireAuthority }
        : { state: null, county: null, city: null, fireAuthority: null }

      const match = jurisdictionMatch(
        { layer: r.layer, state: r.state, county: r.county, city: r.city },
        { state: company.state, county: company.county, city: company.city },
        sitePlace,
      )

      const determinedBy: DeterminedBy = {
        jurisdiction: {
          layer: r.layer ?? 'null',
          match: MATCH_WORD[String(match)],
          decided_by:
            r.layer === 'federal' ? 'nothing — federal serves every state'
            : r.layer === null ? 'nothing — not territorial, gated by a switch'
            : r.layer === 'city' || r.layer === 'local' ? `site ${place?.name ?? '(none)'}`
            : 'company address',
        },
        switches: named,
        switches_missing: [],
        inventory: namedInv,
        inventory_missing: [],
        sites_considered: perSite
          ? place ? [place.name] : []
          : orderedSites.map((s) => s.name),
      }

      const push = (status: ObligationStatus, rationale: string) =>
        obligations.push({
          requirementTemplateId: r.id,
          requirementName: r.name,
          entityId: target ? target.id : null,
          status,
          resolvedBy: 'computed_by_code',
          resolutionRationale: rationale,
          determinedBy,
        })

      // ---- 1. JURISDICTION, before anything else. §3.2 — jurisdiction is always part of
      // the match key, and a too-narrow filter fails by returning fewer rows and a 200.
      if (match === false) {
        push(
          'does_not_apply',
          `Out of jurisdiction. This requirement is scoped ${r.layer}` +
            `${r.state ? ` to ${r.state}` : ''}${r.city ? ` to ${r.city}` : ''}` +
            `${r.county ? ` to ${r.county}` : ''}, and the stated address does not match. ` +
            `This is a definite no with evidence behind it: the address the customer gave.`,
        )
        continue
      }
      if (match === 'unknown') {
        push(
          'unknown',
          `Cannot place this company. The requirement is scoped ${r.layer}, and the address ` +
            `field that decides it has not been supplied. Asking for it settles this row.`,
        )
        continue
      }

      // ---- 2. NO EXPRESSION. The requirement exists, it may well apply, and nobody can
      // compute whether it does. Skipping it would be the false green: the customer could
      // not tell it from a requirement that does not apply to them, and no query anywhere
      // would reveal the difference. `undetermined` — a dead end needing a person, not a
      // question we could ask.
      if (!r.appliesExpression) {
        determinedBy.unresolvable_reason = 'no_expression'
        push(
          'undetermined',
          `This requirement carries no machine-evaluable condition, so nothing can compute ` +
            `whether it applies. It is in scope and unresolved — not cleared. A person must decide.`,
        )
        continue
      }

      // ---- 3. EVALUATE. Company-level rows are evaluated once per site and combined with
      // `anySite`, which is the existential the regulation actually states. Evaluating the
      // WHOLE expression per site rather than each clause separately is deliberate:
      // `all[site_a, site_b]` must mean "some ONE site satisfies both", not "some site
      // satisfies a and some possibly different site satisfies b".
      const against = perSite ? [target as Site] : orderedSites
      const results: Truth[] = []
      const missingSwitches = new Set<string>()
      const missingInventory = new Set<string>()

      if (against.length === 0) {
        // A company with no sites. Migration 010 guarantees one, so this is defence rather
        // than a path — evaluate on company facts alone and let the site clauses be unknown.
        results.push(evaluate(r.appliesExpression, companyFacts, undefined, {}))
        missingOf(named, companyFacts).forEach((m) => missingSwitches.add(m))
        namedInv.forEach((i) => missingInventory.add(i))
      } else {
        for (const s of against) {
          const facts = factsFor(companyFacts, siteFacts[s.id])
          const inv = inventory ? (list: InventoryClause['inventory']) => inventory(s.id, list) : undefined
          results.push(evaluate(r.appliesExpression, facts, inv, {
            state: s.state, county: s.county, city: s.city,
          }))
          missingOf(named, facts).forEach((m) => missingSwitches.add(m))
          for (const list of namedInv) {
            if (!inventory || inventory(s.id, list) === 'unknown') missingInventory.add(list)
          }
        }
      }

      determinedBy.switches_missing = [...missingSwitches].sort()
      determinedBy.inventory_missing = [...missingInventory].sort()

      const verdict = anySite(results)

      if (verdict === true) {
        push('applies', `The condition is satisfied: ${describe(determinedBy)}`)
      } else if (verdict === false) {
        // *** NAME THE FACT THAT RULED IT OUT. *** "This does not apply to you" is half an
        // answer; the half a compliance customer needs is WHY, because that is the half they
        // can check, challenge, and show to an auditor. A generic sentence here would make
        // the 108 not-applicable rows the residue of the answer rather than part of it.
        const known = determinedBy.switches.filter((sw) => !missingSwitches.has(sw))
        const values = known
          .map((sw) => {
            const v = against.length
              ? factsFor(companyFacts, siteFacts[against[0].id])[sw]
              : companyFacts[sw]
            return `${sw} = ${v === undefined || v === null ? 'unset' : String(v)}`
          })
          .join(', ')
        const stillMissing = determinedBy.switches_missing.length
          ? ` (${determinedBy.switches_missing.join(', ')} not established, but the answer is ` +
            `already settled without them — a definite false outranks a missing fact)`
          : ''
        push(
          'does_not_apply',
          (values
            ? `Ruled out by: ${values}.${stillMissing} `
            : `Ruled out by the jurisdiction or inventory test. `) +
            `This is a definite no with the evidence behind it, not an absence of evidence.`,
        )
      } else {
        // UNKNOWN, not undetermined. We lack an input, and we can name it — which is what
        // makes this a question the product can put to the customer rather than a dead end.
        const parts: string[] = []
        if (determinedBy.switches_missing.length) {
          parts.push(`${determinedBy.switches_missing.length} fact(s) not established: ` +
            determinedBy.switches_missing.join(', '))
        }
        if (determinedBy.inventory_missing.length) {
          parts.push(`chemical inventory cannot answer: ${determinedBy.inventory_missing.join(', ')}`)
        }
        push(
          'unknown',
          parts.length
            ? `Cannot decide yet. ${parts.join('; ')}. Establishing these settles this row.`
            : `Cannot decide yet: one of the facts this requirement depends on is not established.`,
        )
      }
    }
  }

  // DETERMINISM: a stable total order that does not depend on how rows were fetched.
  obligations.sort(
    (a, b) =>
      a.requirementName.localeCompare(b.requirementName) ||
      a.requirementTemplateId.localeCompare(b.requirementTemplateId) ||
      (a.entityId ?? '').localeCompare(b.entityId ?? ''),
  )
  return { obligations, skippedOtherIndustry }
}

function describe(d: DeterminedBy): string {
  const bits: string[] = []
  if (d.switches.length) bits.push(`facts ${d.switches.join(', ')}`)
  if (d.inventory.length) bits.push(`inventory ${d.inventory.join(', ')}`)
  bits.push(`jurisdiction ${d.jurisdiction.layer} (${d.jurisdiction.decided_by})`)
  return bits.join('; ')
}
