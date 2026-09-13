/**
 * THE OBLIGATION WRITER — Phase 4.3, the last link.
 *
 * 4.1 computes obligations, 4.2 stores them, and until now nothing called either. This is what
 * calls both. `DECISIONS.md` §55 (the recompute cost), §62 (lazy, and why), §47 (close, never
 * delete).
 *
 * *** LAZY, ON FIRST REQUEST — NOT AT SIGNUP. *** And the reason is not cost. Writing at signup
 * decides what a company sees before they have told us anything: ~200 rows, almost all
 * `unknown`, on day one. That is M7's decision to make. **Lazy leaves M7 free to trigger a
 * write at signup later if that turns out to be right; eager takes the choice away.**
 *
 * *** SYNCHRONOUS. *** Measured on staging, 221 obligations for a two-site company:
 *
 *     resolve() pure compute   1.1 ms   (mean of 20 runs)
 *     data fetch, 4 queries  243 ms
 *
 * **The cost is round trips, not logic.** Making this a background job would settle the
 * worker's contract — retry, ordering, staleness — before Phase 5 is specced, which is the
 * failure the dependency checks exist to catch. See `THRESHOLD` below for what would change
 * the answer.
 */

import { resolve, coerceFact, isEstablished, type ResolvedObligation,
         type Site, type Company, type Requirement, type SwitchValueType } from './resolve.ts'
import type { Facts, InventoryClause, Truth } from './appliesExpression.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * *** WHEN SYNCHRONOUS STOPS BEING THE RIGHT ANSWER. ***
 *
 * Recorded so it is re-argued from a number rather than rediscovered from a slow page.
 * Today: ~250 ms end to end, dominated by four queries, of which the library read (200 rows) is
 * the same for every company in a vertical and is the first thing to cache.
 *
 * Two things would change the answer, and neither is "more customers":
 *
 *   1. THE LIBRARY GROWING SEVERAL FOLD. 200 rows is one vertical. 6.5 and 6.6 add federal and
 *      Oregon layers; 6b adds a second vertical. At ~1,000 rows the fetch dominates harder and
 *      the resolve cost rises with rows x sites.
 *   2. A COMPANY WITH MANY SITES. Obligations are rows x sites, and §55 measured the write
 *      amplification as linear in sites: 221 rows at two sites, ~1,105 at ten.
 *
 * **Concurrency does not change it** — this is per-company work on a per-company request.
 */
export const THRESHOLD = {
  measured_ms: { fetch: 243, compute: 1.1, obligations: 221, sites: 2, libraryRows: 200 },
  revisit_when: 'the library exceeds ~1,000 live rows, or a single company exceeds ~10 sites',
} as const

export interface WriteResult {
  obligations: ResolvedObligation[]
  /** From close_and_replace_obligations: { closed, unchanged, opened, open_total, received } */
  persisted: Record<string, number>
  computedAt: string
}

/**
 * Load a company's established facts, split company-scoped from site-scoped.
 *
 * *** THIS WAS HAND-ROLLED INSIDE A SCRIPT AND IS LIFTED HERE DELIBERATELY. *** Two callers now
 * need it — this writer and 7.2a's answer route — and a fact loader duplicated between them is
 * two places for `isEstablished` to drift. The rule it carries is not obvious enough to
 * re-derive: a value counts only when `state = 'known'` AND it survives `coerceFact`, because
 * `company_switches.value` is text for every switch and `'true' === true` is false.
 */
export function splitFacts(
  rows: Array<{ switch_id: string; scope: string; entity_id: string | null; value: string | null; state: string }>,
  valueTypeOf: Record<string, SwitchValueType>,
  siteIds: string[],
): { companyFacts: Facts; siteFacts: Record<string, Facts>; ignored: number } {
  const companyFacts: Facts = {}
  const siteFacts: Record<string, Facts> = Object.fromEntries(siteIds.map((id) => [id, {}]))
  let ignored = 0

  for (const row of rows) {
    const vt = valueTypeOf[row.switch_id]
    if (!vt || !isEstablished(row.state, row.value, vt)) { ignored++; continue }
    const target = row.scope === 'site' && row.entity_id ? siteFacts[row.entity_id] : companyFacts
    if (target) target[row.switch_id] = coerceFact(row.value, vt)
    else ignored++
  }
  return { companyFacts, siteFacts, ignored }
}

/**
 * Resolve one company and persist the result. Returns what was computed AND what changed.
 *
 * *** THE WHOLE SET GOES TO close_and_replace_obligations, ALWAYS. *** Never a per-site or
 * per-agency subset. Its contract is "here is the complete set; reconcile it", and that is what
 * makes §47's fourth case — an obligation that has LEFT the set — detectable at all. A narrowed
 * payload cannot distinguish *this no longer applies* from *this was not in what you sent*, and
 * the difference is an obligation silently staying open forever.
 */
export async function writeObligations(db: SupabaseClient, companyId: string): Promise<WriteResult> {
  const [{ data: company }, { data: sites }, { data: reqRows }, { data: switches }, { data: cs }] =
    await Promise.all([
      db.from('companies').select('id,name,state,county,city,industry').eq('id', companyId).single(),
      db.from('entities').select('id,name,state,county,city,fire_authority,is_primary')
        .eq('company_id', companyId).eq('entity_type', 'site'),
      // One line, not a concatenation: Supabase infers the row type FROM THE STRING LITERAL,
      // and a `'a' + 'b'` expression defeats that inference silently — the rows come back
      // typed as an error object and every field access is a compile error with a confusing
      // message. This is the schema-contract class CLAUDE.md §3.6 describes, in the types.
      db.from('requirement_templates').select('id,requirement_name,jurisdiction_layer,jurisdiction_state,jurisdiction_county,jurisdiction_city,entity_type,industries,applies_expression').is('effective_to', null),
      db.from('switches').select('id,value_type'),
      db.from('company_switches').select('switch_id,scope,entity_id,value,state').eq('company_id', companyId),
    ])

  if (!company) throw new Error('Company not found')

  const siteList: Site[] = (sites ?? []).map((s) => ({
    id: s.id, name: s.name, isPrimary: s.is_primary,
    state: s.state, county: s.county, city: s.city, fireAuthority: s.fire_authority,
  }))
  const valueTypeOf = Object.fromEntries((switches ?? []).map((s) => [s.id, s.value_type as SwitchValueType]))
  const { companyFacts, siteFacts } = splitFacts(cs ?? [], valueTypeOf, siteList.map((s) => s.id))

  // substance_inventory() per (site, list). Cached because 15 conditions share six lists, and
  // with regulated_substances empty every answer is `unknown` anyway (TODO 6.4b).
  const LISTS: InventoryClause['inventory'][] = ['ehs', 'tri', 'psm', 'rmp', 'cercla', 'dea_list_i']
  const invCache = new Map<string, Truth>()
  await Promise.all(siteList.flatMap((s) => LISTS.map(async (list) => {
    // *** THE ERROR IS CHECKED, BECAUSE NULL AND FAILED LOOK IDENTICAL HERE. ***
    // `data === null` is this function's own honest "unknown". A REFUSED call also returns
    // null, and for the whole of 13 Sep it did: `authenticated` held no EXECUTE, so through
    // the route every list came back `42501 permission denied` and was silently recorded as
    // unknown. It happened to be the same answer only because `regulated_substances` is
    // empty; once 6.4 seeds it, a discarded error here means a site with a real, evaluable
    // inventory is reported as unevaluable and nobody is told. DECISIONS.md §63.
    const { data, error } = await db.rpc('substance_inventory', { p_entity_id: s.id, p_list: list })
    if (error) throw new Error(`Could not read the chemical inventory for ${s.name}: ${error.message}`)
    invCache.set(`${s.id}|${list}`, data === null ? 'unknown' : (data as boolean))
  })))

  const result = resolve({
    company: company as Company,
    sites: siteList,
    requirements: (reqRows ?? []).map((r): Requirement => ({
      id: r.id, name: r.requirement_name, layer: r.jurisdiction_layer,
      state: r.jurisdiction_state, county: r.jurisdiction_county, city: r.jurisdiction_city,
      entityType: r.entity_type, industries: r.industries ?? [], appliesExpression: r.applies_expression,
    })),
    companyFacts, siteFacts,
    inventory: (siteId, list) => invCache.get(`${siteId}|${list}`) ?? 'unknown',
  })

  const { data: persisted, error } = await db.rpc('close_and_replace_obligations', {
    p_company_id: companyId,
    p_obligations: result.obligations.map((o) => ({
      requirement_template_id: o.requirementTemplateId,
      entity_id: o.entityId,
      status: o.status,
      resolved_by: o.resolvedBy,
      resolution_rationale: o.resolutionRationale,
      determined_by: o.determinedBy,
    })),
  })
  if (error) throw new Error(`Could not store your requirements: ${error.message}`)

  const computedAt = new Date().toISOString()
  // *** THE TIMESTAMP IS THE POINT OF LAZY. *** Without it, "never computed" and "computed and
  // nothing applies" are the same zero, and M6 cannot tell a customer which is true (§5.1).
  await db.from('companies').update({ obligations_computed_at: computedAt }).eq('id', companyId)

  return { obligations: result.obligations, persisted: persisted ?? {}, computedAt }
}
