/**
 * THE COMPANY CONTEXT'S RENDERER — Task 0, commit 1.
 *
 * `buildCompanyContext` is a database read and is exercised by `check:live` and by the golden runs.
 * `renderCompanyContext` and `subjectOf` are pure, they are where the defect this commit exists to
 * fix actually lived, and they are testable without a database — so they are tested here.
 *
 * *** THE PROPERTY UNDER TEST IS "NEVER TWO BARE VALUES". *** Read off the staging fixture before
 * this commit, a two-site company produced SEVEN pairs of contradictions in one block — `Employees
 * at this site = 1` and `= 6`, `Air permit tier = title_v` and `= none` — under a heading telling
 * the model to treat them as settled. The storage had `scope` and `entity_id` all along; the
 * rendering threw them away. These assertions fail if that regresses.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { renderCompanyContext, ALL_PARTS,
         type CompanyContextParts, type ConfirmedFact } from '../../lib/companyContext.ts'
// `subjectOf` lives beside the gate's own renderer, because the gate, the established block and
// this block must phrase a fact identically — one function, three call sites.
import { subjectOf } from '../../lib/gateContext.ts'

const HILLSBORO = 'Test Alpha Chemical — Hillsboro'
const PORTLAND = 'Test Alpha Chemical — Portland'

function parts(over: Partial<CompanyContextParts> = {}): CompanyContextParts {
  return {
    company: {
      name: 'Test Alpha Chemical',
      industrySlug: 'chemical-manufacturing',
      industryWords: 'chemical manufacturing',
      address: 'Hillsboro, OR',
      state: 'OR',
      sites: [
        { id: 'a', name: HILLSBORO, address: '1 Main St', state: 'OR', county: 'Washington', city: 'Hillsboro', primary: true },
        { id: 'b', name: PORTLAND, address: '2 Front Ave', state: 'OR', county: null, city: 'Portland', primary: false },
      ],
    },
    declared: [],
    confirmed: [],
    labels: { agencies: [], subjects: [] },
    keys: [],
    document: null,
    ...over,
  }
}

/** A confirmed fact, with the fields a test does not care about defaulted. Added when
 *  `sourceDocumentId` and `sourceProposalId` arrived: three inline literals had to change for a
 *  field none of them asserts, which is the shape that makes people stop adding tests. */
const confirmed = (over: Partial<ConfirmedFact> & { key: string; value: string }): ConfirmedFact => ({
  basis: 'read', entityId: null, siteName: null, asOf: null,
  sourceDocumentTitle: null, sourceDocumentId: null, sourceProposalId: null, ...over,
})

const declared = (label: string, value: string, siteName: string | null) => ({
  switchId: 'site_employee_count', label, value,
  scope: (siteName ? 'site' : 'company') as 'site' | 'company',
  entityId: siteName ? 'x' : null, siteName, question: null, source: 'user_set',
})

describe('subjectOf — what a fact is about', () => {
  test('a company-wide fact is its label and nothing else', () => {
    assert.equal(subjectOf({ switch_id: 'employee_count', fact: 'Employees, enterprise-wide', value: '7', source: 'user_set' }),
      'Employees, enterprise-wide')
  })
  test('a site-scoped fact names its site', () => {
    assert.equal(subjectOf({ switch_id: 'site_employee_count', fact: 'Employees at this site', value: '6', source: 'user_set', site: PORTLAND }),
      `Employees at this site (${PORTLAND})`)
  })
  test('an explicitly null site renders like a company-wide fact', () => {
    assert.equal(subjectOf({ switch_id: 'x', fact: 'Air permit tier', value: 'none', source: 'user_set', site: null }),
      'Air permit tier')
  })
})

describe('the declared block never shows two bare values for one label', () => {
  const block = renderCompanyContext(parts({
    declared: [
      declared('Employees at this site', '1', HILLSBORO),
      declared('Employees at this site', '6', PORTLAND),
    ],
  }), ['declared'])

  test('each line carries its site', () => {
    assert.match(block, new RegExp(`Employees at this site \\(${HILLSBORO}\\) = 1`))
    assert.match(block, new RegExp(`Employees at this site \\(${PORTLAND}\\) = 6`))
  })

  test('and the bare form appears nowhere — the regression this locks', () => {
    // THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. Before this commit the block
    // contained `Employees at this site = 1` and `Employees at this site = 6`.
    assert.doesNotMatch(block, /Employees at this site = /)
  })
})

describe('a caller gets only the parts it asked for', () => {
  const p = parts({
    declared: [declared('Air permit tier', 'title_v', HILLSBORO)],
    confirmed: [confirmed({ key: 'facility_address', value: '4410 NW Front Ave',
                            asOf: '2021-02-01', sourceDocumentTitle: 'Emergency Action Plan' })],
    labels: { agencies: ['Oregon DEQ'], subjects: ['air emissions'] },
    keys: ['facility_address'],
  })

  test('company only: no declared, no confirmed, no labels', () => {
    const b = renderCompanyContext(p, ['company'])
    assert.match(b, /WHO THIS COMPANY IS/)
    assert.doesNotMatch(b, /DECLARED/)
    assert.doesNotMatch(b, /CONFIRMED/)
    assert.doesNotMatch(b, /LABELS/)
  })

  test('the document part renders nothing when no document was named', () => {
    assert.doesNotMatch(renderCompanyContext(p, ALL_PARTS), /TOLD US ABOUT IT/)
  })

  test('asking for more parts makes a longer block — so sha256 fingerprints the send, not the store', () => {
    assert.ok(renderCompanyContext(p, ALL_PARTS).length
            > renderCompanyContext(p, ['company']).length)
  })
})

describe('the block says which facts were declared and which were confirmed', () => {
  const b = renderCompanyContext(parts({
    declared: [declared('Employs anyone', 'true', null)],
    confirmed: [confirmed({ key: 'facility_address', value: '4410 NW Front Ave', entityId: 'b',
                            siteName: PORTLAND, asOf: '2021-02-01',
                            sourceDocumentTitle: 'Emergency Action Plan' })],
  }), ['declared', 'confirmed'])

  test('declared says a person answered it directly', () => {
    assert.match(b, /answered directly by somebody at the company/)
  })
  test('confirmed names the document and the as-of date', () => {
    assert.match(b, /from "Emergency Action Plan"/)
    assert.match(b, /as of 2021-02-01/)
  })
  test('a confirmed fact about one site names that site', () => {
    assert.match(b, new RegExp(`facility address \\(${PORTLAND}\\)`))
  })
  test('an inferred fact says so rather than passing as stated', () => {
    const inferred = renderCompanyContext(parts({
      confirmed: [confirmed({ key: 'employee_count', value: '40', basis: 'inferred' })],
    }), ['confirmed'])
    assert.match(inferred, /\(inferred, not stated outright\)/)
  })
})

describe('an empty section is never silence', () => {
  test('nothing declared is not the same as nothing applies, and it says so', () => {
    // CLAUDE.md §5.1 applied to a prompt rather than a screen: an empty list is a claim.
    assert.match(renderCompanyContext(parts(), ['declared']),
      /nothing declared yet — this is not the same as "nothing applies"/)
  })
  test('no sites recorded says that rather than printing an empty list', () => {
    const p = parts()
    p.company.sites = []
    assert.match(renderCompanyContext(p, ['company']), /\(no sites recorded\)/)
  })
})

describe('the industry is shown as words and as the slug it joins on', () => {
  test('both, when they differ', () => {
    assert.match(renderCompanyContext(parts(), ['company']),
      /Industry: chemical manufacturing \(recorded as chemical-manufacturing\)/)
  })
  test('once, when the slug is already words', () => {
    const p = parts()
    p.company.industrySlug = 'other'
    p.company.industryWords = null
    assert.match(renderCompanyContext(p, ['company']), /Industry: other\n/)
  })
})

describe('the link ids never reach the block — Task 0, commit 2', () => {
  // A uuid in a prompt is noise the model cannot act on. These two fields exist for the page and
  // the renderer must not touch them, or every stored prompt_sha256 moves for nothing.
  test('a fact with ids renders identically to the same fact without them', () => {
    const withIds = renderCompanyContext(parts({
      confirmed: [confirmed({ key: 'facility_address', value: '4410 NW Front Ave',
                              sourceDocumentTitle: 'Emergency Action Plan',
                              sourceDocumentId: '11111111-1111-1111-1111-111111111111',
                              sourceProposalId: '22222222-2222-2222-2222-222222222222' })],
    }), ALL_PARTS)
    const withoutIds = renderCompanyContext(parts({
      confirmed: [confirmed({ key: 'facility_address', value: '4410 NW Front Ave',
                              sourceDocumentTitle: 'Emergency Action Plan' })],
    }), ALL_PARTS)
    assert.equal(withIds, withoutIds)
    assert.doesNotMatch(withIds, /1111-1111|2222-2222/)
  })
})
