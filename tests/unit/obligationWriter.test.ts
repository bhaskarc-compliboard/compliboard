/**
 * THE OBLIGATION WRITER — the fact loader, and the threshold that decides synchronous.
 *
 * `writeObligations` itself needs a database and is exercised by running the route. What is
 * testable purely is `splitFacts`, which carries the rule that has already bitten once:
 * `company_switches.value` is TEXT for every switch, and `'true' === true` is false.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { splitFacts, THRESHOLD } from '../../lib/obligationWriter.ts'

const VT = { has_employees: 'boolean', employee_count: 'number',
             air_permit_required: 'enum', site_note: 'text' } as const
const SITES = ['site-a', 'site-b']
const row = (o: Partial<{ switch_id: string; scope: string; entity_id: string | null; value: string | null; state: string }>) =>
  ({ switch_id: 'has_employees', scope: 'company', entity_id: null, value: 'true', state: 'known', ...o })

describe('splitFacts — company and site kept apart', () => {
  test('a company-scoped fact lands in companyFacts, typed', () => {
    const { companyFacts } = splitFacts([row({})], VT, SITES)
    assert.equal(companyFacts.has_employees, true, "'true' must become true, not stay a string")
  })
  test('a site-scoped fact lands under its own site only', () => {
    const { siteFacts } = splitFacts(
      [row({ switch_id: 'air_permit_required', scope: 'site', entity_id: 'site-b', value: 'title_v' })], VT, SITES)
    assert.equal(siteFacts['site-b'].air_permit_required, 'title_v')
    assert.equal(siteFacts['site-a'].air_permit_required, undefined,
      'a fact about one site must not leak to another — DECISIONS §20')
  })
  test('every site gets an object, even with no facts', () => {
    const { siteFacts } = splitFacts([], VT, SITES)
    assert.deepEqual(Object.keys(siteFacts).sort(), ['site-a', 'site-b'])
  })
})

describe('splitFacts — what does NOT count as established', () => {
  test('state other than known is ignored, even with a value present', () => {
    for (const state of ['unknown', 'needs_user']) {
      const { companyFacts, ignored } = splitFacts([row({ state })], VT, SITES)
      assert.equal(companyFacts.has_employees, undefined,
        'a stale value behind needs_user must not resurrect as a fact')
      assert.equal(ignored, 1)
    }
  })
  test('an UNREADABLE value is ignored, not read as false', () => {
    const { companyFacts, ignored } = splitFacts([row({ value: 'yes' })], VT, SITES)
    assert.equal(companyFacts.has_employees, undefined)
    assert.equal(ignored, 1, "'yes' in a boolean column is an unanswered question, not a no")
  })
  test('a switch with no known value_type is ignored rather than guessed', () => {
    const { ignored } = splitFacts([row({ switch_id: 'invented_switch' })], VT, SITES)
    assert.equal(ignored, 1)
  })
  test('a site fact naming a site this company does not have is ignored', () => {
    const { ignored, siteFacts } = splitFacts(
      [row({ scope: 'site', entity_id: 'site-gone', switch_id: 'air_permit_required', value: 'none' })], VT, SITES)
    assert.equal(ignored, 1)
    assert.deepEqual(Object.values(siteFacts).map((f) => Object.keys(f).length), [0, 0])
  })
  test('a real false IS established — absence and negation are different', () => {
    const { companyFacts, ignored } = splitFacts([row({ value: 'false' })], VT, SITES)
    assert.equal(companyFacts.has_employees, false)
    assert.equal(ignored, 0)
  })
})

describe('the synchronous threshold is recorded, not left to be rediscovered', () => {
  test('it names the measurement it rests on', () => {
    assert.equal(THRESHOLD.measured_ms.obligations, 221)
    assert.ok(THRESHOLD.measured_ms.compute < 10,
      'the case for synchronous is that compute is trivial; if it stops being trivial, re-argue it')
    assert.ok(THRESHOLD.measured_ms.fetch > THRESHOLD.measured_ms.compute * 50,
      'the cost is round trips, not logic — which is what makes caching the library the first fix')
  })
  test('it names what would change the answer', () => {
    assert.match(THRESHOLD.revisit_when, /library/)
    assert.match(THRESHOLD.revisit_when, /sites/)
  })
})
