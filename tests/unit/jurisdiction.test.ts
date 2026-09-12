/**
 * THE MATCH KEY — all six cases, and the ways each has been or could be got wrong.
 *
 * `CLAUDE.md` §3.2 names a wrong jurisdiction as "a silent, dangerous failure", and
 * `DECISIONS.md` §24 records the live incident: 94 Oregon requirements silently dropped
 * for 7 of 10 production companies because the filter read a field that was null.
 *
 * The shape of that failure is the thing to test for: it produced FEWER ROWS AND A 200.
 * So every case below asserts the `unknown` answer as hard as the `true` and `false` ones —
 * a missing fact must never become a quiet exclusion.
 */

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  jurisdictionMatch,
  isSiteScopedLayer,
  type RequirementPlace,
  type CompanyPlace,
  type SitePlace,
} from '../../lib/jurisdiction.ts'

/** Test Alpha Chemical, read from staging on 12 Sep 2026. */
const ALPHA: CompanyPlace = { state: 'Oregon', county: 'Washington', city: 'Hillsboro' }
const ALPHA_SITE: SitePlace = {
  state: 'Oregon', county: 'Washington', city: 'Hillsboro',
  fireAuthority: 'Tualatin Valley Fire & Rescue',
}

const TEXAS: CompanyPlace = { state: 'Texas', county: 'Harris', city: 'Houston' }
const TEXAS_SITE: SitePlace = {
  state: 'Texas', county: 'Harris', city: 'Houston', fireAuthority: 'Houston Fire Department',
}

const req = (p: Partial<RequirementPlace>): RequirementPlace =>
  ({ layer: 'federal', state: null, county: null, city: null, ...p })

describe('case 1 — federal serves every state', () => {
  test('an Oregon company', () => {
    assert.equal(jurisdictionMatch(req({ layer: 'federal' }), ALPHA, ALPHA_SITE), true)
  })
  test('a Texas company — the same answer, which is the point', () => {
    assert.equal(jurisdictionMatch(req({ layer: 'federal' }), TEXAS, TEXAS_SITE), true)
  })
  test('a company with no address at all still gets federal rows', () => {
    // A federal row has no fact to be missing. If this ever returned `unknown`, a customer
    // mid-signup would see nothing at all rather than the 95 rows that reach everyone.
    const nowhere: CompanyPlace = { state: null, county: null, city: null }
    const nosite: SitePlace = { state: null, county: null, city: null, fireAuthority: null }
    assert.equal(jurisdictionMatch(req({ layer: 'federal' }), nowhere, nosite), true)
  })
})

describe('case 2 — state, against the COMPANY', () => {
  const oregonRow = req({ layer: 'state', state: 'Oregon' })
  test('matches', () => assert.equal(jurisdictionMatch(oregonRow, ALPHA, ALPHA_SITE), true))
  test('THE ONE THAT MATTERS: a Texas company does not get Oregon rows', () => {
    assert.equal(jurisdictionMatch(oregonRow, TEXAS, TEXAS_SITE), false)
  })
  test('case and whitespace do not decide jurisdiction', () => {
    assert.equal(jurisdictionMatch(req({ layer: 'state', state: ' oregon ' }), ALPHA, ALPHA_SITE), true)
  })
  test('a company with no stated state is unknown, NOT excluded', () => {
    // This is §24's incident in one assertion. `false` here drops 102 Oregon rows silently.
    const r = jurisdictionMatch(oregonRow, { state: null, county: null, city: null }, ALPHA_SITE)
    assert.notEqual(r, false, 'SILENT DROP: a missing address excluded a requirement')
    assert.equal(r, 'unknown')
  })
  test('an empty-string state is unknown, not a failed match', () => {
    const r = jurisdictionMatch(oregonRow, { state: '', county: '', city: '' }, ALPHA_SITE)
    assert.equal(r, 'unknown')
  })
})

describe('case 3 — county, against the company (zero live rows today)', () => {
  const countyRow = req({ layer: 'county', county: 'Washington' })
  test('matches', () => assert.equal(jurisdictionMatch(countyRow, ALPHA, ALPHA_SITE), true))
  test('different county is false', () => {
    assert.equal(jurisdictionMatch(countyRow, { ...ALPHA, county: 'Multnomah' }, ALPHA_SITE), false)
  })
  test('signup hardcodes county to the empty string — that must be unknown', () => {
    // TODO 4.1 inherits this: `/api/signup` writes `county: ''` and never asks. If `''`
    // compared as a real value, every county row would answer `false` for every customer.
    assert.equal(jurisdictionMatch(countyRow, { ...ALPHA, county: '' }, ALPHA_SITE), 'unknown')
  })
})

describe('case 4 — city, against the SITE and never the company', () => {
  const portlandRow = req({ layer: 'city', city: 'Portland' })
  test('the site decides, even when the company address differs', () => {
    // A Hillsboro-headquartered company with a Portland plant owes Portland's rules there.
    const portlandPlant: SitePlace = { ...ALPHA_SITE, city: 'Portland' }
    assert.equal(jurisdictionMatch(portlandRow, ALPHA, portlandPlant), true)
    assert.equal(jurisdictionMatch(portlandRow, ALPHA, ALPHA_SITE), false)
  })
  test('a site with no city is unknown', () => {
    assert.equal(jurisdictionMatch(portlandRow, ALPHA, { ...ALPHA_SITE, city: null }), 'unknown')
  })
})

describe('case 5 — local, the authority having jurisdiction', () => {
  /** All three live `local` rows carry state = Oregon and no county or city. */
  const fireRow = req({ layer: 'local', state: 'Oregon' })

  test('an Oregon site with a named fire authority is in scope', () => {
    assert.equal(jurisdictionMatch(fireRow, ALPHA, ALPHA_SITE), true)
  })
  test('a Texas site is out of scope — the Oregon Fire Code does not reach it', () => {
    assert.equal(jurisdictionMatch(fireRow, TEXAS, TEXAS_SITE), false)
  })
  test('fire authority is preferred, but county then city are accepted', () => {
    // Test Beta Cannabis has fire_authority NULL, county Multnomah, city Portland.
    const beta: SitePlace = {
      state: 'Oregon', county: 'Multnomah', city: 'Portland', fireAuthority: null,
    }
    assert.equal(jurisdictionMatch(fireRow, ALPHA, beta), true)
  })
  test('city alone is enough when county is also missing', () => {
    const thin: SitePlace = { state: 'Oregon', county: null, city: 'Bend', fireAuthority: null }
    assert.equal(jurisdictionMatch(fireRow, ALPHA, thin), true)
  })
  test('an Oregon site with NO identifiable authority is unknown, not dropped', () => {
    // `DECISIONS.md` §25: when the authority is unknown the local requirements show as
    // undetermined. A site that exists has a fire authority whether or not we know which.
    const nowhere: SitePlace = { state: 'Oregon', county: null, city: null, fireAuthority: null }
    const r = jurisdictionMatch(fireRow, ALPHA, nowhere)
    assert.notEqual(r, false, 'a fire-code requirement was dropped for want of a county')
    assert.equal(r, 'unknown')
  })
  test('a site with no state is unknown even with an authority named', () => {
    const stateless: SitePlace = { ...ALPHA_SITE, state: null }
    assert.equal(jurisdictionMatch(fireRow, ALPHA, stateless), 'unknown')
  })
})

describe('case 6 — a NULL layer is not territorial and passes through untouched', () => {
  const iso = req({ layer: null })
  test('an Oregon company', () => assert.equal(jurisdictionMatch(iso, ALPHA, ALPHA_SITE), true))
  test('a Texas company — geography must not decide a registrar contract', () => {
    assert.equal(jurisdictionMatch(iso, TEXAS, TEXAS_SITE), true)
  })
  test('a company with no address at all', () => {
    const nowhere: CompanyPlace = { state: null, county: null, city: null }
    const nosite: SitePlace = { state: null, county: null, city: null, fireAuthority: null }
    assert.equal(jurisdictionMatch(iso, nowhere, nosite), true)
  })
  // Passing through is NOT the same as applying. These three rows are gated by
  // `holds_iso_certification`, so an uncertified company gets `does_not_apply` from the
  // EXPRESSION, not from the match key. Asserted in resolve.test.ts.
})

describe('structure', () => {
  test('city and local are the per-site layers', () => {
    assert.equal(isSiteScopedLayer('city'), true)
    assert.equal(isSiteScopedLayer('local'), true)
    assert.equal(isSiteScopedLayer('federal'), false)
    assert.equal(isSiteScopedLayer('state'), false)
    assert.equal(isSiteScopedLayer('county'), false)
    assert.equal(isSiteScopedLayer(null), false)
  })
  test('an unhandled layer throws rather than defaulting to in-scope', () => {
    // A seventh enum value must not silently behave like `federal` and reach everyone.
    assert.throws(
      () => jurisdictionMatch(req({ layer: 'tribal' as never }), ALPHA, ALPHA_SITE),
      /unhandled jurisdiction_layer/,
    )
  })
})
