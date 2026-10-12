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
import { mustRow, mustRows } from './mustRead.ts'
import { HOLD_RULE, type Hold } from './obligationHold.ts'

/** The only `closed_reason` this release writes (migration 081). Plain, and shown on the page. */
export const CLOSED_BY_A_PERSON = 'a person said these no longer apply'

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
  /**
   * When the stored list was last worked out. NULL only alongside `held`, and only for a company
   * that has never computed: a held recompute does not move the stamp (D2).
   */
  computedAt: string | null
  /**
   * *** SET WHEN NOTHING WAS WRITTEN BECAUSE THE DROP WAS TOO BIG — D2. *** The recompute is held,
   * the open rows are untouched, and the hold is recorded on the company so the Requirements page
   * can ask the question (migration 083). `computedAt` is then the PREVIOUS stamp, or null if the
   * company has never computed: a held recompute is not a computation.
   */
  held?: Hold
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
export async function writeObligations(
  db: SupabaseClient, companyId: string,
  /**
   * *** D2: `confirmedBy` IS A PERSON SAYING "YES, THEY NO LONGER APPLY". *** Without it, a
   * recompute that would close all of the open list or more than half of it is HELD and nothing is
   * written. With it, the reconcile proceeds and every row it closes is stamped with that login and
   * the plain reason (migration 081), because a close a person asked for is a different fact from a
   * close the resolver made on the evidence.
   */
  opts: { confirmedBy?: string } = {},
): Promise<WriteResult> {
  const [companyRes, sitesRes, reqRes, switchesRes, csRes] =
    await Promise.all([
      db.from('companies').select('id,name,state,county,city,industry,obligations_computed_at').eq('id', companyId).maybeSingle(),
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
      // *** NOT "Nothing has been changed" — D2.3. *** `/api/switches/answer` saves the answer
      // BEFORE it calls this, so that sentence told a person their answer was lost when it was
      // recorded, and a person told that answers the question again. What is true is narrower and
      // is what this now says: the LIST was not changed.
      'We could not work out your requirements: the requirement library came back empty, ' +
      'which is never a real answer. Your requirements have not been changed.',
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

  /**
   * *** THE LAST GUARD: A BIG DROP NEVER CLOSES OPEN ROWS ON ITS OWN. ***
   *
   * The checks above catch a read that reported its failure. This one catches a read that did
   * not — a changed filter, a column that now holds something else, a resolve that returns
   * nothing for a reason nobody has thought of yet. `close_and_replace_obligations` is told
   * "this is the complete set", so handing it a short set closes the difference, and the damage is
   * identical however the shortfall arose.
   *
   * *** WIDENED AND UNSTUCK BY D2 (E10, N7). *** Job E's version threw whenever the result was
   * EMPTY and rows were open. That stopped the lie and created a dead end: a company that
   * legitimately stops being a chemical manufacturer got 500 from the Requirements page for ever,
   * with 200 obligations open and no button anywhere that could move them on (measured, E9 item 5).
   *
   * Now the test is **all of the open list, or more than half of it** (`lib/obligationHold.ts`,
   * where the threshold lives with the tests that pin its edges — D2.2, and it is never shown), and
   * the answer is not a throw. Nothing is written, the hold is recorded on the company, and the
   * page asks the person. `confirmedBy` is them answering.
   *
   * It is not "refuse every short set": a company whose obligations have genuinely never computed
   * to anything has no open rows to lose, so the write proceeds and the timestamp is stamped. That
   * is the state migration 022 exists to record.
   */
  const openRows = mustRows<{ id: string; requirement_template_id: string; entity_id: string | null }>(
    'your current requirements',
    await db.from('obligations').select('id, requirement_template_id, entity_id')
      .eq('company_id', companyId).is('applicable_to', null))
  const key = (t: string, e: string | null) => `${t}\u0000${e ?? ''}`
  const inNewSet = new Set(result.obligations.map((o) => key(o.requirementTemplateId, o.entityId)))
  // Only the rows that LEAVE the set. A row whose status changed is closed and re-opened by the
  // same statement (§47's second case) and is not a requirement the company loses.
  const leaving = openRows.filter((r) => !inNewSet.has(key(r.requirement_template_id, r.entity_id)))

  if (!opts.confirmedBy && HOLD_RULE.holds(openRows.length, leaving.length)) {
    const hold: Hold = {
      held_at: new Date().toISOString(),
      open_total: openRows.length,
      would_close: leaving.length,
      industry: (company as { industry: string | null }).industry ?? null,
      // Does the library carry ANY live requirement for that industry? Read from the rows already
      // in hand, so this costs nothing and cannot disagree with what the resolve just used.
      industry_has_library: reqRows.some((r) =>
        ((r.industries ?? []) as string[]).includes(String((company as { industry: string | null }).industry ?? ''))),
      // Did anything of THEIRS change since the last recompute? If not, the note says so — the
      // sentence that tells a person this may not be their doing at all (D2.1).
      answer_changed: newestAnswerIsNewer(cs as Array<{ updated_at?: string | null }>,
        (company as { obligations_computed_at: string | null }).obligations_computed_at),
    }
    const { error: holdErr } = await db.from('companies')
      .update({ obligations_hold: hold }).eq('id', companyId)
    // Said, not swallowed: without the record the page cannot ask the question, and the person
    // would be sent to a page that shows the old list and explains nothing.
    if (holdErr) throw new Error(`Could not record that your requirements need your confirmation: ${holdErr.message}`)
    return {
      obligations: result.obligations,
      persisted: {},
      // A held recompute is not a computation, so the stamp does not move.
      computedAt: (company as { obligations_computed_at: string | null }).obligations_computed_at,
      held: hold,
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

  /**
   * *** A CLOSE A PERSON ASKED FOR SAYS SO — D2.3, migration 081. ***
   *
   * `close_and_replace_obligations` returns counts, not ids, so the rows are named from the diff
   * computed above — taken BEFORE the reconcile, which is the only moment they are still open. The
   * stamp is a second statement on purpose: the reconcile's contract is untouched (it is the one
   * function that may close an obligation), and a stamp that fails leaves the rows correctly closed
   * with the reason missing, which is said rather than swallowed.
   */
  if (opts.confirmedBy && leaving.length) {
    const { error: stampedErr } = await db.from('obligations')
      .update({ closed_by: opts.confirmedBy, closed_reason: CLOSED_BY_A_PERSON })
      .in('id', leaving.map((r) => r.id)).eq('company_id', companyId)
    if (stampedErr) {
      console.error(`writeObligations: ${leaving.length} requirement(s) were closed on `
        + `${opts.confirmedBy}'s confirmation but the record of who asked did not save: ${stampedErr.message}`)
    }
  }

  const computedAt = new Date().toISOString()
  // *** THE TIMESTAMP IS THE POINT OF LAZY. *** Without it, "never computed" and "computed and
  // nothing applies" are the same zero, and M6 cannot tell a customer which is true (§5.1).
  // The error is checked (W1): the rows are already reconciled at this point, so a stamp that
  // silently failed leaves the company looking "never computed" and every later request
  // recomputing it — the lazy path's one job, undone without a word.
  // *** AND THE HOLD IS CLEARED BY THE RECOMPUTE THAT PROCEEDED *** (D2, migration 083). One
  // statement with the stamp: a company must never be left looking computed with a question still
  // on its page, or answered with the old numbers still on the note.
  const { error: stampErr } = await db.from('companies')
    .update({ obligations_computed_at: computedAt, obligations_hold: null }).eq('id', companyId)
  if (stampErr) throw new Error(`Could not record when your requirements were worked out: ${stampErr.message}`)

  return { obligations: result.obligations, persisted: persisted ?? {}, computedAt }
}

/**
 * Is any answer of theirs newer than the last successful recompute? — D2.1's last sentence.
 *
 * Never computed (NULL) counts as "yes, something changed": the first computation of a company that
 * already holds answers is not a moment to tell them nothing of theirs changed.
 */
export function newestAnswerIsNewer(
  answers: Array<{ updated_at?: string | null }>, computedAt: string | null,
): boolean {
  if (!computedAt) return true
  const at = Date.parse(computedAt)
  if (Number.isNaN(at)) return true
  return answers.some((a) => {
    const t = a.updated_at ? Date.parse(a.updated_at) : NaN
    return !Number.isNaN(t) && t > at
  })
}

/**
 * The industry the open requirements were WRITTEN FOR, read from the library rows behind them.
 *
 * A company may have been through more than one industry, so this is the commonest industry among
 * those rows that is not the one they are in now — and null when there is no clear answer, so the
 * note names no old industry rather than naming the wrong one (`lib/obligationHold.ts`).
 */
export function previousIndustryOf(
  openTemplateIds: string[],
  library: Array<{ id: string; industries: string[] | null }>,
  currentIndustry: string | null,
): string | null {
  const open = new Set(openTemplateIds)
  const tally = new Map<string, number>()
  for (const r of library) {
    if (!open.has(r.id)) continue
    for (const ind of r.industries ?? []) {
      if (!ind || ind === currentIndustry) continue
      tally.set(ind, (tally.get(ind) ?? 0) + 1)
    }
  }
  if (!tally.size) return null
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  // A tie between two industries is not an answer; naming one of them would be a guess.
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null
  return ranked[0][0]
}
