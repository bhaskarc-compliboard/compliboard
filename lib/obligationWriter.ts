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
import { mustRow, mustRows, mustCount } from './mustRead.ts'

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
  const [companyRes, sitesRes, reqRes, switchesRes, csRes] =
    await Promise.all([
      db.from('companies').select('id,name,state,county,city,industry').eq('id', companyId).maybeSingle(),
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

  // *** FIVE READS, AND A FAILURE IN ANY OF THEM USED TO CLOSE ROWS. *** Fix list W1, root R2,
  // Job E. Only `data` was destructured here, so every error was discarded and each failure had
  // its own way of being destructive, because the whole set goes to
  // `close_and_replace_obligations` and that function's contract is "this is everything":
  //
  //   requirement_templates failed → an EMPTY set → **every open obligation closed**,
  //     `obligations_computed_at` stamped, and /requirements saying "we found none that apply to
  //     you. That is a result, not a gap." — a sentence about a question nobody answered.
  //   company_switches failed  → every established fact gone → every decided row closed and
  //     reopened as `unknown`, so a company that had told us 95 facts is asked all of them again.
  //   switches failed          → no value types → `splitFacts` ignores every fact → the same.
  //   entities failed          → no sites → every site-scoped obligation leaves the set.
  //
  // And it runs on **every** answer to a company question (`/api/switches/answer`), so a database
  // hiccup during an ordinary afternoon of answering questions was enough.
  //
  // `maybeSingle` rather than `single`, deliberately: it keeps "this company does not exist" (a
  // real answer, below) apart from "we could not ask" (a `ReadFailed`, thrown here). `single`
  // reports both as an error, and the two want different sentences.
  const company = mustRow('your company', companyRes)
  const sites = mustRows('your sites', sitesRes)
  const reqRows = mustRows('the requirement library', reqRes)
  const switchRows = mustRows('the list of facts we track', switchesRes)
  const cs = mustRows('the facts you have told us', csRes)

  if (!company) throw new Error('Company not found')

  // *** AND AN EMPTY LIBRARY IS NOT "NOTHING APPLIES TO YOU". ***
  // `requirement_templates` is shared reference data — 188 live rows, the same for every company
  // in the vertical. Zero rows means the library is not there, not that this company is exempt
  // from everything. Checked separately from the error above because a read can succeed and still
  // come back empty: a filter that stops matching, a seed that did not run, a view replaced.
  if (reqRows.length === 0) {
    throw new Error(
      'We could not work out your requirements: the requirement library came back empty, ' +
      'which is never a real answer. Nothing has been changed.',
    )
  }

  const siteList: Site[] = sites.map((s) => ({
    id: s.id, name: s.name, isPrimary: s.is_primary,
    state: s.state, county: s.county, city: s.city, fireAuthority: s.fire_authority,
  }))
  const valueTypeOf = Object.fromEntries(switchRows.map((s) => [s.id, s.value_type as SwitchValueType]))
  const { companyFacts, siteFacts } = splitFacts(cs, valueTypeOf, siteList.map((s) => s.id))

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
    requirements: reqRows.map((r): Requirement => ({
      id: r.id, name: r.requirement_name, layer: r.jurisdiction_layer,
      state: r.jurisdiction_state, county: r.jurisdiction_county, city: r.jurisdiction_city,
      entityType: r.entity_type, industries: r.industries ?? [], appliesExpression: r.applies_expression,
    })),
    companyFacts, siteFacts,
    inventory: (siteId, list) => invCache.get(`${siteId}|${list}`) ?? 'unknown',
  })

  // *** THE LAST GUARD: AN EMPTY SET NEVER CLOSES OPEN ROWS. ***
  // The checks above catch a read that reported its failure. This one catches a read that did
  // not — a changed filter, a column that now holds something else, a resolve that returns
  // nothing for a reason nobody has thought of yet. `close_and_replace_obligations` is told
  // "this is the complete set", so handing it nothing closes everything, and the damage is
  // identical however the emptiness arose. A company with open requirements is therefore never
  // reconciled against nothing: we stop, keep the rows, and say so.
  //
  // It is not "refuse every empty set": a company whose obligations have genuinely never
  // computed to anything has no open rows to lose, so the write proceeds and the timestamp is
  // stamped. That is the state migration 022 exists to record.
  if (result.obligations.length === 0) {
    const open = mustCount('your current requirements', await db
      .from('obligations').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).is('applicable_to', null))
    if (open > 0) {
      throw new Error(
        `We could not work out your requirements: the result came back with none at all, while ${open} ` +
        'of yours are open. Closing them on that would be wrong, so nothing has been changed.',
      )
    }
  }

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
  // The error is checked (W1): the rows are already reconciled at this point, so a stamp that
  // silently failed leaves the company looking "never computed" and every later request
  // recomputing it — the lazy path's one job, undone without a word.
  const { error: stampErr } = await db.from('companies')
    .update({ obligations_computed_at: computedAt }).eq('id', companyId)
  if (stampErr) throw new Error(`Could not record when your requirements were worked out: ${stampErr.message}`)

  return { obligations: result.obligations, persisted: persisted ?? {}, computedAt }
}
