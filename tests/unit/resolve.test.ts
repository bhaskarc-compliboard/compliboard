/**
 * THE RESOLUTION ENGINE — the safety properties, and the shape most likely to be silently
 * wrong at five of six facilities.
 *
 * The single-site case and the multi-site case give identical answers for every expression
 * in the current library EXCEPT where a site-scoped fact feeds a company-level obligation.
 * Both test companies have exactly one site, so a quantification bug is invisible in every
 * row of data that exists today. These fixtures are constructed for that reason.
 */

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolve, coerceFact, isEstablished, type Company, type Requirement, type Site } from '../../lib/resolve.ts'
import type { Expression } from '../../lib/appliesExpression.ts'

// ---------------------------------------------------------------------------
// FIXTURES — Test Alpha Chemical as it stands on staging, plus sites it does not have
// ---------------------------------------------------------------------------

const ALPHA: Company = {
  id: 'co-alpha', name: 'Test Alpha Chemical',
  state: 'Oregon', county: 'Washington', city: 'Hillsboro',
  industry: 'chemical-manufacturing',
}

const site = (id: string, city: string, over: Partial<Site> = {}): Site => ({
  id, name: `Alpha — ${city}`, isPrimary: id === 'site-hillsboro',
  state: 'Oregon', county: 'Washington', city,
  fireAuthority: 'Tualatin Valley Fire & Rescue', ...over,
})

const HILLSBORO = site('site-hillsboro', 'Hillsboro')
const PORTLAND = site('site-portland', 'Portland', { county: 'Multnomah', fireAuthority: null })
const BEND = site('site-bend', 'Bend', { county: 'Deschutes', fireAuthority: 'Bend Fire & Rescue' })

const req = (over: Partial<Requirement>): Requirement => ({
  id: 'r-1', name: 'A requirement', layer: 'federal',
  state: null, county: null, city: null,
  entityType: 'organization', industries: ['chemical-manufacturing'],
  appliesExpression: null, ...over,
})

/** The real Oregon sick-time expression, read from the library on 12 Sep 2026. */
const SICK_TIME: Expression = {
  all: [
    { switch: 'has_employees', op: 'is', value: true },
    {
      any: [
        { switch: 'employee_count', op: '>=', value: 10 },
        {
          all: [
            { switch: 'site_employee_count', op: '>=', value: 6 },
            { jurisdiction: 'city', op: 'is', value: 'Portland' },
          ],
        },
      ],
    },
  ],
}

const sickTimeRow = req({
  id: 'r-sick', name: 'Oregon sick time', layer: 'state', state: 'Oregon',
  appliesExpression: SICK_TIME,
})

const only = (r: ReturnType<typeof resolve>) => {
  assert.equal(r.obligations.length, 1, 'expected exactly one obligation')
  return r.obligations[0]
}

// ---------------------------------------------------------------------------
// ONE SITE vs SEVERAL — the whole point of this file
// ---------------------------------------------------------------------------

describe('Oregon sick time — one site', () => {
  test('12 employees: applies, on the company branch', () => {
    const o = only(resolve({
      company: ALPHA, sites: [HILLSBORO], requirements: [sickTimeRow],
      companyFacts: { has_employees: true, employee_count: 12 },
      siteFacts: { 'site-hillsboro': { site_employee_count: 12 } },
    }))
    assert.equal(o.status, 'applies')
    assert.equal(o.entityId, null, 'an organization-level row must produce ONE company obligation')
  })

  test('7 employees in Hillsboro: does not apply, and it is evidenced', () => {
    const o = only(resolve({
      company: ALPHA, sites: [HILLSBORO], requirements: [sickTimeRow],
      companyFacts: { has_employees: true, employee_count: 7 },
      siteFacts: { 'site-hillsboro': { site_employee_count: 7 } },
    }))
    assert.equal(o.status, 'does_not_apply')
  })
})

describe('Oregon sick time — SEVERAL sites, where a single-site test proves nothing', () => {
  test('7 employees company-wide, 6 of them at a Portland site: APPLIES', () => {
    // The company branch is false. The site branch is true at exactly one of three sites.
    // A resolver that evaluated only the primary site would answer does_not_apply — and
    // the customer would never be told about a statute they owe.
    const o = only(resolve({
      company: ALPHA, sites: [HILLSBORO, PORTLAND, BEND], requirements: [sickTimeRow],
      companyFacts: { has_employees: true, employee_count: 7 },
      siteFacts: {
        'site-hillsboro': { site_employee_count: 1 },
        'site-portland': { site_employee_count: 6 },
        'site-bend': { site_employee_count: 0 },
      },
    }))
    assert.equal(o.status, 'applies')
    assert.equal(o.entityId, null)
    assert.deepEqual(o.determinedBy.sites_considered.length, 3, 'all three sites must be considered')
  })

  test('the Portland site is under 6: does not apply', () => {
    const o = only(resolve({
      company: ALPHA, sites: [HILLSBORO, PORTLAND, BEND], requirements: [sickTimeRow],
      companyFacts: { has_employees: true, employee_count: 7 },
      siteFacts: {
        'site-hillsboro': { site_employee_count: 3 },
        'site-portland': { site_employee_count: 4 },
        'site-bend': { site_employee_count: 0 },
      },
    }))
    assert.equal(o.status, 'does_not_apply')
  })

  test('ONE SITE FALSE, ANOTHER UNKNOWN is UNKNOWN — never a clear', () => {
    // Hillsboro definitively fails. Portland has not told us its headcount. A company that
    // has described one plant and not the other cannot be cleared on the one it described.
    const o = only(resolve({
      company: ALPHA, sites: [HILLSBORO, PORTLAND], requirements: [sickTimeRow],
      companyFacts: { has_employees: true, employee_count: 7 },
      siteFacts: { 'site-hillsboro': { site_employee_count: 2 } },
    }))
    assert.notEqual(o.status, 'does_not_apply', 'FALSE GREEN: an undescribed site cleared a statute')
    assert.equal(o.status, 'unknown')
    assert.deepEqual(o.determinedBy.switches_missing, ['site_employee_count'])
  })

  test('adding a site can only ever ADD an obligation, never remove one', () => {
    const facts = { has_employees: true, employee_count: 7 }
    const sf = { 'site-hillsboro': { site_employee_count: 1 }, 'site-portland': { site_employee_count: 6 }, 'site-bend': { site_employee_count: 0 } }
    const one = only(resolve({ company: ALPHA, sites: [HILLSBORO], requirements: [sickTimeRow], companyFacts: facts, siteFacts: sf }))
    const three = only(resolve({ company: ALPHA, sites: [HILLSBORO, PORTLAND, BEND], requirements: [sickTimeRow], companyFacts: facts, siteFacts: sf }))
    assert.equal(one.status, 'does_not_apply')
    assert.equal(three.status, 'applies')
  })
})

describe('the quantifier binds the WHOLE expression per site, not each clause', () => {
  /**
   * `all[ site_a, site_b ]` must mean "some ONE site satisfies both". Quantifying each
   * clause separately would let a fact from Portland combine with a fact from Bend and
   * manufacture an obligation neither site triggers. The two readings differ only for a
   * multi-site company, which is why no current data would show the bug.
   */
  const bothAtOneSite: Expression = {
    all: [
      { switch: 'onsite_laboratory', op: 'is', value: true },
      { switch: 'high_piled_storage', op: 'is', value: true },
    ],
  }
  const row = req({ id: 'r-both', name: 'Both at one site', appliesExpression: bothAtOneSite })

  test('facts split across two sites must NOT combine', () => {
    const o = only(resolve({
      company: ALPHA, sites: [PORTLAND, BEND], requirements: [row],
      companyFacts: {},
      siteFacts: {
        'site-portland': { onsite_laboratory: true, high_piled_storage: false },
        'site-bend': { onsite_laboratory: false, high_piled_storage: true },
      },
    }))
    assert.notEqual(o.status, 'applies', 'facts from two different sites were combined')
    assert.equal(o.status, 'does_not_apply')
  })

  test('both at the same site does apply', () => {
    const o = only(resolve({
      company: ALPHA, sites: [PORTLAND, BEND], requirements: [row],
      companyFacts: {},
      siteFacts: {
        'site-portland': { onsite_laboratory: true, high_piled_storage: true },
        'site-bend': { onsite_laboratory: false, high_piled_storage: false },
      },
    }))
    assert.equal(o.status, 'applies')
  })
})

describe('granularity — per-site rows produce one obligation per site', () => {
  test('a site-typed requirement fans out', () => {
    const r = resolve({
      company: ALPHA, sites: [HILLSBORO, PORTLAND, BEND],
      requirements: [req({ id: 'r-site', name: 'Site thing', entityType: 'site',
        appliesExpression: { switch: 'onsite_laboratory', op: 'is', value: true } })],
      companyFacts: {},
      siteFacts: { 'site-portland': { onsite_laboratory: true } },
    })
    assert.equal(r.obligations.length, 3)
    assert.deepEqual(r.obligations.map((o) => o.entityId).sort(),
      ['site-bend', 'site-hillsboro', 'site-portland'])
    const portland = r.obligations.find((o) => o.entityId === 'site-portland')!
    assert.equal(portland.status, 'applies')
    // The other two are UNKNOWN, not does_not_apply — nobody said they have no lab.
    assert.equal(r.obligations.find((o) => o.entityId === 'site-bend')!.status, 'unknown')
  })

  test('a local-layer row fans out even when entityType is organization', () => {
    // `city` and `local` are decided per site, so the obligation has to be too — otherwise
    // one site's fire authority answers for all of them.
    const r = resolve({
      company: ALPHA, sites: [HILLSBORO, BEND],
      requirements: [req({ id: 'r-fire', name: 'Fire permits', layer: 'local', state: 'Oregon',
        appliesExpression: { switch: 'hazardous_chemicals_present', op: 'is', value: true } })],
      companyFacts: { hazardous_chemicals_present: true },
      siteFacts: {},
    })
    assert.equal(r.obligations.length, 2)
    assert.ok(r.obligations.every((o) => o.entityId !== null))
  })
})

// ---------------------------------------------------------------------------
// THE SAFETY PROPERTIES
// ---------------------------------------------------------------------------

describe('unknown never becomes does_not_apply', () => {
  test('nothing established at all', () => {
    const o = only(resolve({
      company: ALPHA, sites: [HILLSBORO], requirements: [sickTimeRow],
      companyFacts: {}, siteFacts: {},
    }))
    assert.notEqual(o.status, 'does_not_apply')
    assert.equal(o.status, 'unknown')
  })
  test('the rationale names what to ask for, which is what makes it a question', () => {
    const o = only(resolve({
      company: ALPHA, sites: [HILLSBORO], requirements: [sickTimeRow],
      companyFacts: {}, siteFacts: {},
    }))
    assert.match(o.resolutionRationale, /has_employees/)
    assert.deepEqual(o.determinedBy.switches_missing, ['employee_count', 'has_employees', 'site_employee_count'])
  })
})

describe('a NULL expression is undetermined — in scope and unresolved, never skipped', () => {
  const handbook = req({ id: 'r-handbook', name: 'Employee handbook', appliesExpression: null })
  test('it produces a row', () => {
    const o = only(resolve({ company: ALPHA, sites: [HILLSBORO], requirements: [handbook], companyFacts: {}, siteFacts: {} }))
    assert.equal(o.status, 'undetermined')
  })
  test('undetermined, not unknown — it is a dead end, not a question', () => {
    const o = only(resolve({ company: ALPHA, sites: [HILLSBORO], requirements: [handbook], companyFacts: {}, siteFacts: {} }))
    assert.notEqual(o.status, 'unknown', 'nothing the product can ask would settle this')
    assert.match(o.resolutionRationale, /no machine-evaluable condition/)
  })
})

describe('jurisdiction', () => {
  const oregonRow = req({ id: 'r-or', name: 'Oregon thing', layer: 'state', state: 'Oregon',
    appliesExpression: { switch: 'has_employees', op: 'is', value: true } })

  test('a Texas company does not receive Oregon rows', () => {
    const texas: Company = { ...ALPHA, state: 'Texas', county: 'Harris', city: 'Houston' }
    const o = only(resolve({ company: texas, sites: [{ ...HILLSBORO, state: 'Texas', city: 'Houston' }],
      requirements: [oregonRow], companyFacts: { has_employees: true }, siteFacts: {} }))
    assert.equal(o.status, 'does_not_apply')
    assert.match(o.resolutionRationale, /Out of jurisdiction/)
  })

  test('jurisdiction is decided BEFORE the expression — a true expression cannot override it', () => {
    const texas: Company = { ...ALPHA, state: 'Texas', county: 'Harris', city: 'Houston' }
    const o = only(resolve({ company: texas, sites: [{ ...HILLSBORO, state: 'Texas' }],
      requirements: [oregonRow], companyFacts: { has_employees: true }, siteFacts: {} }))
    assert.equal(o.status, 'does_not_apply')
  })

  test('an unplaceable company is unknown, not excluded', () => {
    const nowhere: Company = { ...ALPHA, state: null }
    const o = only(resolve({ company: nowhere, sites: [HILLSBORO], requirements: [oregonRow],
      companyFacts: { has_employees: true }, siteFacts: {} }))
    assert.equal(o.status, 'unknown')
  })

  test('a NULL-layer contractual row is gated by its SWITCH, not by geography', () => {
    const iso = req({ id: 'r-iso', name: 'ISO 9001 certificate maintained', layer: null,
      appliesExpression: { switch: 'holds_iso_certification', op: 'not', value: 'none' } })
    const texas: Company = { ...ALPHA, state: 'Texas' }
    const held = only(resolve({ company: texas, sites: [HILLSBORO], requirements: [iso],
      companyFacts: { holds_iso_certification: 'iso_9001' }, siteFacts: {} }))
    assert.equal(held.status, 'applies', 'a registrar contract does not stop at a state line')
    const notHeld = only(resolve({ company: ALPHA, sites: [HILLSBORO], requirements: [iso],
      companyFacts: { holds_iso_certification: 'none' }, siteFacts: {} }))
    assert.equal(notHeld.status, 'does_not_apply')
  })
})

describe('industry is a skip, not a status', () => {
  test('a cannabis-only row produces no obligation for a chemical manufacturer', () => {
    const r = resolve({
      company: ALPHA, sites: [HILLSBORO],
      requirements: [req({ id: 'r-cann', name: 'OLCC thing', industries: ['cannabis'] })],
      companyFacts: {}, siteFacts: {},
    })
    assert.equal(r.obligations.length, 0)
    assert.equal(r.skippedOtherIndustry, 1)
  })
})

describe('inventory clauses', () => {
  const tri = req({ id: 'r-tri', name: 'TRI report', appliesExpression: { inventory: 'tri' } })
  test('no inventory resolver at all is unknown, and says so', () => {
    const o = only(resolve({ company: ALPHA, sites: [HILLSBORO], requirements: [tri], companyFacts: {}, siteFacts: {} }))
    assert.equal(o.status, 'unknown')
    assert.deepEqual(o.determinedBy.inventory_missing, ['tri'])
    assert.match(o.resolutionRationale, /chemical inventory/)
  })
  test('a resolver returning unknown — migration 014 — does not clear the requirement', () => {
    const o = only(resolve({ company: ALPHA, sites: [HILLSBORO], requirements: [tri],
      companyFacts: {}, siteFacts: {}, inventory: () => 'unknown' }))
    assert.notEqual(o.status, 'does_not_apply')
    assert.equal(o.status, 'unknown')
  })
  test('a definite false is a definite does_not_apply', () => {
    const o = only(resolve({ company: ALPHA, sites: [HILLSBORO], requirements: [tri],
      companyFacts: {}, siteFacts: {}, inventory: () => false }))
    assert.equal(o.status, 'does_not_apply')
    assert.deepEqual(o.determinedBy.inventory_missing, [])
  })
  test('inventory is asked per SITE — one site over threshold is enough', () => {
    const o = only(resolve({ company: ALPHA, sites: [HILLSBORO, BEND], requirements: [tri],
      companyFacts: {}, siteFacts: {},
      inventory: (siteId) => (siteId === 'site-bend' ? true : false) }))
    assert.equal(o.status, 'applies')
  })
})

describe('determinism — CLAUDE.md §3.2', () => {
  const input = () => ({
    company: ALPHA, sites: [BEND, HILLSBORO, PORTLAND],
    requirements: [sickTimeRow, req({ id: 'r-b', name: 'B' }), req({ id: 'r-a', name: 'A' })],
    companyFacts: { has_employees: true }, siteFacts: { 'site-portland': { site_employee_count: 6 } },
  })
  test('identical output across 50 runs, including order', () => {
    const first = JSON.stringify(resolve(input()))
    for (let i = 0; i < 50; i++) assert.equal(JSON.stringify(resolve(input())), first)
  })
  test('site order in the input does not change the output', () => {
    const a = resolve({ ...input(), sites: [HILLSBORO, PORTLAND, BEND] })
    const b = resolve({ ...input(), sites: [BEND, PORTLAND, HILLSBORO] })
    assert.equal(JSON.stringify(a), JSON.stringify(b))
  })
  test('no timestamps anywhere in the output', () => {
    assert.doesNotMatch(JSON.stringify(resolve(input())), /\d{4}-\d{2}-\d{2}T/)
  })
})

describe('resolved_by is the how, and it is always the same how', () => {
  test('every obligation this engine produces says computed_by_code', () => {
    const r = resolve({
      company: ALPHA, sites: [HILLSBORO],
      requirements: [sickTimeRow, req({ id: 'r-null', name: 'No expression' })],
      companyFacts: {}, siteFacts: {},
    })
    assert.ok(r.obligations.length > 0)
    assert.ok(r.obligations.every((o) => o.resolvedBy === 'computed_by_code'))
  })
})

// ---------------------------------------------------------------------------
// READING A FACT OUT OF THE DATABASE
// ---------------------------------------------------------------------------

describe('coerceFact — text out of company_switches, typed value in', () => {
  test("'true' becomes true — the bug this exists to prevent", () => {
    // Uncoerced, `'true' === true` is FALSE, and the evaluator compares with ===.
    // The requirement would read does_not_apply for a company that answered yes.
    assert.equal('true' === (true as unknown as string), false, 'sanity: the trap')
    assert.equal(coerceFact('true', 'boolean'), true)
    assert.equal(coerceFact('false', 'boolean'), false)
    assert.equal(coerceFact('TRUE', 'boolean'), true)
    assert.equal(coerceFact(' true ', 'boolean'), true)
  })
  test('an UNREADABLE boolean is null, never false', () => {
    for (const junk of ['yes', 'Y', '1', 'maybe', 'unknown']) {
      assert.equal(coerceFact(junk, 'boolean'), null, `${junk} must not read as a confident no`)
    }
  })
  test('numbers', () => {
    assert.equal(coerceFact('7', 'number'), 7)
    assert.equal(coerceFact('0', 'number'), 0)
    assert.equal(coerceFact('-3.5', 'number'), -3.5)
  })
  test('an unreadable number is null, not 0 — 0 would be "below every threshold"', () => {
    for (const junk of ['many', 'a few', '', 'NaN']) {
      assert.equal(coerceFact(junk, 'number'), null)
    }
  })
  test('enum and text pass through, trimmed', () => {
    assert.equal(coerceFact(' title_v ', 'enum'), 'title_v')
    assert.equal(coerceFact('anything', 'text'), 'anything')
  })
  test('null, undefined and empty are all not-established', () => {
    assert.equal(coerceFact(null, 'boolean'), null)
    assert.equal(coerceFact(undefined, 'number'), null)
    assert.equal(coerceFact('   ', 'enum'), null)
  })
  test('a coerced false still resolves the expression to false, not unknown', () => {
    // The other half: coercion must not turn a real `false` into an absence either.
    const o = only(resolve({
      company: ALPHA, sites: [HILLSBORO],
      requirements: [req({ id: 'r-he', name: 'Needs employees',
        appliesExpression: { switch: 'has_employees', op: 'is', value: true } })],
      companyFacts: { has_employees: coerceFact('false', 'boolean') }, siteFacts: {},
    }))
    assert.equal(o.status, 'does_not_apply')
  })
})

describe('isEstablished — state and value must agree', () => {
  test('known with a readable value is a fact', () => {
    assert.equal(isEstablished('known', 'true', 'boolean'), true)
  })
  test('a stale value behind needs_user is NOT a fact', () => {
    assert.equal(isEstablished('needs_user', 'true', 'boolean'), false)
    assert.equal(isEstablished('unknown', 'lqg', 'enum'), false)
  })
  test('known with an unreadable value is not a fact either', () => {
    assert.equal(isEstablished('known', 'yes', 'boolean'), false)
  })
})
