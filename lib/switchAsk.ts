/**
 * THE ASK PATH — which question to put to a company next, and what one answer unlocks.
 *
 * Decisions: `DECISIONS.md` §53 (§51 constrains the source, not the switch) and §54 (one answer
 * unlocks one level, then stops). Contract: `docs/SWITCH-DETERMINATION.md` §10.2.
 *
 * *** ORDERING COMES FROM THE DEPENDENCY GRAPH, NOT FROM PREFERENCE. *** 21 switches carry
 * `hazardous_chemicals_present` as `depends_on_switch`. Asking `psm_rmp_threshold` before it
 * asks a question whose answer cannot be used — the graph says so, no UI opinion is involved,
 * and that is why this file decides it rather than leaving it to whoever builds a screen.
 *
 * WHY THE CANDIDATE SET IS NOT `determination_source = 'user_answer'`. That column answers
 * *which kind of source is AUTHORITATIVE for this fact*. It does not say *the user may not be
 * asked*. Filtering on it would drop `hazardous_chemicals_present` — seeded `documents`, and the
 * second-highest-leverage switch in the vocabulary — from the ask path entirely. `user_answer`
 * switches are ranked FIRST because nothing else will ever establish them, not because the rest
 * are off-limits. §53.
 *
 * Pure. No database, no model, no request. Everything here is a function of rows passed in.
 */

import { isEstablished, type SwitchValueType } from './resolve.ts'

export interface SwitchRow {
  id: string
  scope: 'company' | 'site'
  value_type: 'boolean' | 'number' | 'enum' | 'text'
  allowed_values: string[] | null
  question_plain: string | null
  determination_source: 'documents' | 'user_answer' | 'profile' | 'computed_by_requirement'
  depends_on_switch: string | null
  depends_on_value: string | null
}

/** What this company has already established. Keyed by switch id; site-scoped keys carry the site. */
export type Established = Record<string, string | null | undefined>

export interface Askable {
  switch_id: string
  question: string
  scope: 'company' | 'site'
  value_type: SwitchRow['value_type']
  allowed_values: string[]
  /** Switch ids that must be answered BEFORE this one. Empty means askable now. */
  blocked_by: string[]
  /** Transitive requirements this unblocks — the number that makes a user willing to answer. */
  affects: number
  /** True when nothing but a person will ever establish it. Ranked first. */
  only_a_person: boolean
}

const key = (id: string, entityId: string | null) => (entityId ? `${id}@${entityId}` : id)

/**
 * Build `Established` from raw `company_switches` rows.
 *
 * *** ONE COPY OF THIS RULE, AND §43 IS WHY. *** "Established" is not "a row exists" and it is
 * not "state = known" either — it is **state = known AND the text coerces to a real value for
 * that switch's TYPE**. `company_switches.value` is text for every switch, so a `number` switch
 * holding `"abc"` has a row, has `state = 'known'`, and is NOT established. A check that stops
 * at `value !== ''` accepts it.
 *
 * That divergence is silent in exactly the way §43 describes: each copy reads correctly on its
 * own, the resolver ignores the fact while the ask path believes it answered, and nothing
 * compares them. This function and `splitFacts` now share `isEstablished()` rather than each
 * carrying their own approximation of it.
 */
export function establishedFrom(
  rows: Array<{ switch_id: string; entity_id: string | null; value: string | null; state: string }>,
  valueTypeOf: Record<string, SwitchValueType>,
): Established {
  const est: Established = {}
  for (const r of rows) {
    const vt = valueTypeOf[r.switch_id]
    if (!vt || !isEstablished(r.state, r.value, vt)) continue
    est[key(r.switch_id, r.entity_id)] = r.value as string
  }
  return est
}

/** Established means a non-empty value is present. Absent, null and '' are all NOT established. */
export function isEstablishedFor(est: Established, id: string, entityId: string | null): boolean {
  const v = est[key(id, entityId)] ?? est[id]
  return v !== undefined && v !== null && String(v).trim() !== ''
}

/**
 * A switch is blocked when its parent is unestablished, OR established at a value that does not
 * match `depends_on_value`.
 *
 * *** THE SECOND CASE IS NOT A BLOCK — IT IS AN EXCLUSION, AND THEY MUST NOT BE CONFLATED. ***
 * If `hazardous_chemicals_present` is FALSE, `exposure_lead` is not "waiting for something"; it
 * does not apply to this site at all and must never be asked. Returning it as blocked would put
 * it back in the queue the moment anything else changed.
 */
export function blockedBy(sw: SwitchRow, est: Established, entityId: string | null): string[] {
  if (!sw.depends_on_switch) return []
  const parent = sw.depends_on_switch
  if (!isEstablishedFor(est, parent, entityId)) return [parent]
  return []
}

export function isExcluded(sw: SwitchRow, est: Established, entityId: string | null): boolean {
  if (!sw.depends_on_switch || sw.depends_on_value === null) return false
  const parent = sw.depends_on_switch
  if (!isEstablishedFor(est, parent, entityId)) return false
  const v = est[key(parent, entityId)] ?? est[parent]
  return String(v) !== String(sw.depends_on_value)
}

/**
 * Transitive reach: requirements naming this switch, plus requirements naming any switch that
 * depends on it. `CHEMICAL-OR-WA.md` §6.4 — "the number that makes a user willing to correct a
 * switch". Direct counting understates the switches that matter most fourfold.
 */
export function transitiveAffects(
  id: string,
  switches: SwitchRow[],
  requirementSwitches: Array<{ requirementId: string; switchIds: string[] }>,
): number {
  const family = new Set([id, ...switches.filter((s) => s.depends_on_switch === id).map((s) => s.id)])
  const hit = new Set<string>()
  for (const r of requirementSwitches) {
    if (r.switchIds.some((s) => family.has(s))) hit.add(r.requirementId)
  }
  return hit.size
}

/**
 * Every switch this company could usefully be asked, ordered.
 *
 * Excluded: already established · excluded by a parent's value · computed rather than asked ·
 * carrying no question text · referenced by no requirement (asking changes nothing).
 */
export function askableSwitches(
  switches: SwitchRow[],
  est: Established,
  requirementSwitches: Array<{ requirementId: string; switchIds: string[] }>,
  entityId: string | null = null,
): Askable[] {
  const referenced = new Set(requirementSwitches.flatMap((r) => r.switchIds))

  const out: Askable[] = []
  for (const sw of switches) {
    if (sw.determination_source === 'computed_by_requirement') continue // not a fact anyone holds
    if (!sw.question_plain) continue
    if (!referenced.has(sw.id)) continue                                 // asking changes nothing
    if (isEstablishedFor(est, sw.id, entityId)) continue
    if (isExcluded(sw, est, entityId)) continue

    out.push({
      switch_id: sw.id,
      question: sw.question_plain,
      scope: sw.scope,
      value_type: sw.value_type,
      allowed_values: sw.allowed_values ?? [],
      blocked_by: blockedBy(sw, est, entityId),
      affects: transitiveAffects(sw.id, switches, requirementSwitches),
      only_a_person: sw.determination_source === 'user_answer',
    })
  }

  // Unblocked first — a blocked question cannot be answered usefully. Then the ones nothing else
  // will ever establish. Then by reach. Then by id, so the order is deterministic (§3.2).
  return out.sort(
    (a, b) =>
      Number(a.blocked_by.length > 0) - Number(b.blocked_by.length > 0) ||
      Number(b.only_a_person) - Number(a.only_a_person) ||
      b.affects - a.affects ||
      a.switch_id.localeCompare(b.switch_id),
  )
}

/**
 * What one answer unlocked — ONE LEVEL, then stop. `DECISIONS.md` §54.
 *
 * *** "NEWLY UNBLOCKED" MEANS blocked BEFORE AND NOT BLOCKED AFTER. *** Not "everything askable
 * now": that would return the whole remaining queue on every call and the one-level bound would
 * be decoration. And the recompute is not optional — without it, answering `has_employees`
 * returns nothing, because its seven children only become askable once it is known, and the very
 * first thing a user does in this product would produce no visible change.
 *
 * The cascade is refused deliberately: `DETERMINATION-GATE.md` already says "you may ask one.
 * Not two, not 'one, and also'", and a chain three deep from one click is that failure arriving
 * by a different door.
 */
export function newlyUnblocked(
  switches: SwitchRow[],
  before: Established,
  after: Established,
  requirementSwitches: Array<{ requirementId: string; switchIds: string[] }>,
  entityId: string | null = null,
): Askable[] {
  const wasBlocked = new Set(
    askableSwitches(switches, before, requirementSwitches, entityId)
      .filter((a) => a.blocked_by.length > 0)
      .map((a) => a.switch_id),
  )
  return askableSwitches(switches, after, requirementSwitches, entityId).filter(
    (a) => a.blocked_by.length === 0 && wasBlocked.has(a.switch_id),
  )
}
