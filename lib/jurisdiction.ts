/**
 * THE MATCH KEY — the six-case jurisdiction rule, as a pure predicate.
 *
 * Spec: `CHEMICAL-OR-WA.md` §3.2. Decision: `DECISIONS.md` §24.
 *
 * WHY THIS IS A FUNCTION AND NOT A `WHERE` CLAUSE. §24.2 is explicit: load candidates with
 * a deliberately broad query and narrow in tested code. A too-narrow SQL filter fails by
 * returning FEWER ROWS WITH A PERFECTLY GOOD 200, which is exactly how the original defect
 * survived for months — `app/api/sync-obligations` read the state from an AI website scan,
 * `scan_result` was null for 7 of 10 production companies, and all 94 Oregon requirements
 * were silently dropped for them. Nobody could see it happening.
 *
 * THREE-VALUED, LIKE EVERYTHING ELSE HERE. A jurisdiction fact we do not hold produces
 * `unknown`, never `false`. `CLAUDE.md` §3.2 — serving one state's requirements to another
 * state's company is a silent, dangerous failure, and so is quietly deciding a requirement
 * does not apply because nobody typed a county.
 *
 * WHERE THE FACTS COME FROM, and the ordering is a rule rather than a preference (§24.1):
 * a value a PERSON STATED outranks a value a MODEL INFERRED. Jurisdiction is read from
 * `companies.state/county/city` and `entities.state/county/city/fire_authority`.
 * `companies.scan_result` is never read for it, by anything.
 */

export type JurisdictionLayer = 'federal' | 'state' | 'county' | 'city' | 'local' | null

/** Same three-valued vocabulary the expression evaluator uses. */
export type Match = true | false | 'unknown'

/** What a library row says about where it applies. */
export interface RequirementPlace {
  layer: JurisdictionLayer
  state: string | null
  county: string | null
  city: string | null
}

/** The company's stated address. State and county are decided here (§3.2). */
export interface CompanyPlace {
  state: string | null
  county: string | null
  city: string | null
}

/** One site's stated address. City and local authority are decided here, per SITE. */
export interface SitePlace {
  state: string | null
  county: string | null
  city: string | null
  fireAuthority: string | null
}

/**
 * Empty string is not a value. Signup hardcodes `county: ''` and never asks (§24.2's
 * "still missing" note), so treating `''` as a county would compare a real requirement
 * against a placeholder and answer `false` — a silent wrong clear on a field nobody filled.
 */
function place(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null
  const t = v.trim()
  return t === '' ? null : t
}

/** Case- and whitespace-insensitive. "oregon" and "Oregon " are the same state. */
function same(a: string | null, b: string | null): Match {
  const x = place(a)
  const y = place(b)
  if (x === null || y === null) return 'unknown'
  return x.toLowerCase() === y.toLowerCase()
}

/**
 * Does this requirement reach this site?
 *
 * Returns `true` (in scope), `false` (definitively out of scope — the customer's own
 * stated address contradicts it, which is the "positive contradicting evidence" §3.2
 * requires before anything may be marked not-applicable), or `unknown` (we do not hold
 * the fact that would decide it).
 */
export function jurisdictionMatch(
  requirement: RequirementPlace,
  company: CompanyPlace,
  site: SitePlace,
): Match {
  switch (requirement.layer) {
    // 1. FEDERAL — serves every state. No comparison to make and none to get wrong.
    case 'federal':
      return true

    // 2. STATE — against the COMPANY's state, not the site's. A multi-state company is a
    //    known gap rather than an oversight: `entity_state` exists as a switch and nothing
    //    references it yet (TODO 6.4d). Until that is decided, one company has one state.
    case 'state':
      return same(requirement.state, company.state)

    // 3. COUNTY — against the company's county. Zero live rows use this layer today; it is
    //    implemented because the enum permits it and 6.6 will add rows, and because a layer
    //    with no rule is how two of six cases went unhandled the first time.
    case 'county':
      return same(requirement.county, company.county)

    // 4. CITY — against the SITE's city, never the company's. Two plants of one company sit
    //    in different cities, so a company-level answer is wrong at every site but one.
    case 'city':
      return same(requirement.city, site.city)

    // 5. LOCAL — "the authority having jurisdiction", which may be neither a city nor a
    //    county: an Oregon rural fire protection district is its own body. Two conditions,
    //    and both must hold.
    case 'local': {
      // (a) the row is state-scoped in practice — all three live `local` rows carry
      //     `jurisdiction_state = 'Oregon'` and no county or city — so the site must be in
      //     that state. Checked against the SITE, because this layer is decided per site.
      const inState = requirement.state === null ? 'unknown' : same(requirement.state, site.state)
      if (inState !== true) return inState

      // (b) an authority must be identifiable at all. fire_authority first, because it is
      //     the definition; county then city are a best effort, not a synonym.
      const authority =
        place(site.fireAuthority) ?? place(site.county) ?? place(site.city)
      // `DECISIONS.md` §25: when the authority is unknown the local requirements show as
      // undetermined. They are NOT dropped — a site that exists has a fire authority
      // whether or not we have recorded which one.
      return authority === null ? 'unknown' : true
    }

    // 6. NULL — not a jurisdiction case at all, and the match key must pass it through
    //    UNTOUCHED. These rows are contractual — ISO 9001, ISO 14001, NACD Responsible
    //    Distribution — imposed by a registrar rather than a government, and they are not
    //    territorial. They are gated by a SWITCH (`holds_iso_certification`), and deciding
    //    them here would be wrong in both directions: drop them and a certified company is
    //    never told about the surveillance audit it will fail; apply them by default and
    //    every company is told to maintain a certificate it has never held.
    case null:
      return true

    default: {
      // An enum value nobody wrote a case for. Refuse rather than guess — the alternative
      // is a new layer silently behaving like `federal` and reaching every company.
      const unreachable: never = requirement.layer
      throw new Error(`jurisdictionMatch: unhandled jurisdiction_layer ${String(unreachable)}`)
    }
  }
}

/**
 * Is this layer decided per SITE rather than per company? `city` and `local` are, which is
 * why a company with three sites can owe a fire-code permit at one of them and not the
 * others. Exported because the resolver needs it to choose the obligation's granularity.
 */
export function isSiteScopedLayer(layer: JurisdictionLayer): boolean {
  return layer === 'city' || layer === 'local'
}
