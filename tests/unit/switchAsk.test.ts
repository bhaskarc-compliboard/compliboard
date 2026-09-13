/**
 * THE ASK PATH — ordering from the graph, and one level of unlock.
 *
 * `DECISIONS.md` §53 (the source is constrained, not the switch) and §54 (one level, then stop).
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  askableSwitches, newlyUnblocked, blockedBy, isExcluded, transitiveAffects, isEstablishedFor,
  type SwitchRow, type Established,
} from '../../lib/switchAsk.ts'

const sw = (id: string, o: Partial<SwitchRow> = {}): SwitchRow => ({
  id, scope: 'site', value_type: 'boolean', allowed_values: null,
  question_plain: `Q: ${id}?`, determination_source: 'documents',
  depends_on_switch: null, depends_on_value: null, ...o,
})

/** A slice of the real vocabulary: a parent, three children, and an unrelated switch. */
const SWITCHES: SwitchRow[] = [
  sw('hazardous_chemicals_present'),
  sw('exposure_lead', { depends_on_switch: 'hazardous_chemicals_present', depends_on_value: 'true' }),
  sw('onsite_laboratory', { depends_on_switch: 'hazardous_chemicals_present', depends_on_value: 'true' }),
  sw('psm_rmp_threshold', { depends_on_switch: 'hazardous_chemicals_present', depends_on_value: 'true' }),
  sw('owns_fleet', { scope: 'company', determination_source: 'user_answer' }),
  sw('hazwaste_generator_category', { determination_source: 'computed_by_requirement' }),
  sw('never_referenced'),
  sw('no_question', { question_plain: null }),
]
const REQS = [
  { requirementId: 'r1', switchIds: ['hazardous_chemicals_present'] },
  { requirementId: 'r2', switchIds: ['exposure_lead'] },
  { requirementId: 'r3', switchIds: ['onsite_laboratory'] },
  { requirementId: 'r4', switchIds: ['psm_rmp_threshold'] },
  { requirementId: 'r5', switchIds: ['owns_fleet'] },
  { requirementId: 'r6', switchIds: ['hazwaste_generator_category'] },
  { requirementId: 'r7', switchIds: ['no_question'] },
]
const ids = (a: ReturnType<typeof askableSwitches>) => a.map((x) => x.switch_id)

describe('the candidate set — §53', () => {
  test('a switch whose source is `documents` is STILL askable', () => {
    // Filtering on determination_source would drop hazardous_chemicals_present — seeded
    // `documents` and the second-highest-leverage switch in the vocabulary — from the ask
    // path entirely. That column says which source is AUTHORITATIVE, not who may be asked.
    assert.ok(ids(askableSwitches(SWITCHES, {}, REQS)).includes('hazardous_chemicals_present'))
  })
  test('a computed switch is NOT askable — it is not a fact anyone holds', () => {
    assert.ok(!ids(askableSwitches(SWITCHES, {}, REQS)).includes('hazwaste_generator_category'))
  })
  test('a switch no requirement references is not asked — it would change nothing', () => {
    assert.ok(!ids(askableSwitches(SWITCHES, {}, REQS)).includes('never_referenced'))
  })
  test('a switch with no question text is not asked', () => {
    assert.ok(!ids(askableSwitches(SWITCHES, {}, REQS)).includes('no_question'))
  })
  test('an established switch is not re-asked', () => {
    const est: Established = { hazardous_chemicals_present: 'true' }
    assert.ok(!ids(askableSwitches(SWITCHES, est, REQS)).includes('hazardous_chemicals_present'))
  })
  test('empty string is not established', () => {
    assert.equal(isEstablishedFor({ x: '' }, 'x', null), false)
    assert.equal(isEstablishedFor({ x: null }, 'x', null), false)
    assert.equal(isEstablishedFor({ x: 'false' }, 'x', null), true)
  })
})

describe('ordering comes from the graph', () => {
  test('unblocked questions come before blocked ones', () => {
    const got = askableSwitches(SWITCHES, {}, REQS)
    const firstBlocked = got.findIndex((a) => a.blocked_by.length > 0)
    const lastFree = got.map((a) => a.blocked_by.length).lastIndexOf(0)
    assert.ok(lastFree < firstBlocked, 'a blocked question sorted above a free one')
  })
  test('the parent is asked before its children', () => {
    const got = ids(askableSwitches(SWITCHES, {}, REQS))
    for (const child of ['exposure_lead', 'onsite_laboratory', 'psm_rmp_threshold']) {
      assert.ok(got.indexOf('hazardous_chemicals_present') < got.indexOf(child),
        `${child} was ordered before the parent whose answer it needs`)
    }
  })
  test('a switch nothing else can establish is ranked above one a document could', () => {
    const got = ids(askableSwitches(SWITCHES, {}, REQS))
    assert.ok(got.indexOf('owns_fleet') < got.indexOf('hazardous_chemicals_present'))
  })
  test('the order is deterministic across 50 runs', () => {
    const first = JSON.stringify(askableSwitches(SWITCHES, {}, REQS))
    for (let i = 0; i < 50; i++) assert.equal(JSON.stringify(askableSwitches(SWITCHES, {}, REQS)), first)
  })
})

describe('blocked is not the same as excluded', () => {
  test('parent unestablished → blocked, and still in the list', () => {
    assert.deepEqual(blockedBy(SWITCHES[1], {}, null), ['hazardous_chemicals_present'])
    assert.ok(ids(askableSwitches(SWITCHES, {}, REQS)).includes('exposure_lead'))
  })
  test('parent FALSE → excluded, and must never be asked', () => {
    const est: Established = { hazardous_chemicals_present: 'false' }
    assert.equal(isExcluded(SWITCHES[1], est, null), true)
    const got = ids(askableSwitches(SWITCHES, est, REQS))
    for (const child of ['exposure_lead', 'onsite_laboratory', 'psm_rmp_threshold']) {
      assert.ok(!got.includes(child), `${child} was asked at a site with no hazardous chemicals`)
    }
  })
  test('parent TRUE → not excluded, not blocked', () => {
    const est: Established = { hazardous_chemicals_present: 'true' }
    assert.equal(isExcluded(SWITCHES[1], est, null), false)
    assert.deepEqual(blockedBy(SWITCHES[1], est, null), [])
  })
})

describe('affects — transitive, not direct', () => {
  test('a parent counts its children\'s requirements too', () => {
    // direct: r1. transitive: r1 + r2 + r3 + r4 through the three dependants.
    assert.equal(transitiveAffects('hazardous_chemicals_present', SWITCHES, REQS), 4)
  })
  test('a leaf counts only its own', () => {
    assert.equal(transitiveAffects('exposure_lead', SWITCHES, REQS), 1)
  })
  test('the ask carries it', () => {
    const a = askableSwitches(SWITCHES, {}, REQS).find((x) => x.switch_id === 'hazardous_chemicals_present')!
    assert.equal(a.affects, 4)
  })
})

describe('one answer unlocks ONE level, then stops — §54', () => {
  test('answering the parent returns its children', () => {
    const got = newlyUnblocked(SWITCHES, {}, { hazardous_chemicals_present: 'true' }, REQS)
    assert.deepEqual(ids(got).sort(), ['exposure_lead', 'onsite_laboratory', 'psm_rmp_threshold'])
  })
  test('it returns ONLY the newly unblocked, not the whole remaining queue', () => {
    const got = ids(newlyUnblocked(SWITCHES, {}, { hazardous_chemicals_present: 'true' }, REQS))
    assert.ok(!got.includes('owns_fleet'),
      'owns_fleet was askable before the answer — returning it makes the one-level bound decoration')
  })
  test('answering something with no children returns an empty list, not an error', () => {
    assert.deepEqual(newlyUnblocked(SWITCHES, {}, { owns_fleet: 'true' }, REQS), [])
  })
  test('THE FIRST INTERACTION IS NOT EMPTY — the reason the recompute exists', () => {
    // Without recomputing, answering the highest-leverage question returns nothing, because
    // the children only become askable once the parent is known.
    assert.ok(newlyUnblocked(SWITCHES, {}, { hazardous_chemicals_present: 'true' }, REQS).length > 0)
  })
  test('answering FALSE unlocks nothing — the children are excluded, not waiting', () => {
    assert.deepEqual(newlyUnblocked(SWITCHES, {}, { hazardous_chemicals_present: 'false' }, REQS), [])
  })
  test('no cascade: a grandchild is not returned by the grandparent\'s answer', () => {
    const deep: SwitchRow[] = [...SWITCHES,
      sw('grandchild', { depends_on_switch: 'exposure_lead', depends_on_value: 'true' })]
    const reqs = [...REQS, { requirementId: 'r8', switchIds: ['grandchild'] }]
    const got = ids(newlyUnblocked(deep, {}, { hazardous_chemicals_present: 'true' }, reqs))
    assert.ok(!got.includes('grandchild'),
      'a chain three deep from one click is the cascade DETERMINATION-GATE.md refuses')
  })
})
