/**
 * WHICH DATE GOES ON THE ROW — chosen from the kind, in code.
 *
 * *** THE MODEL USED TO PICK THIS AND IT PICKED WRONG IN A WAY NOBODY WOULD SPOT. *** Golden
 * case 01 is an Emergency Action Plan whose cover says "Revised February 2021". The scan stored
 * `significant_date_kind: renewal, significant_date: 2026-01-01` — a date that appears nowhere
 * in the document — and the Documents page printed "Renewal 1 January 2026" beside it. That
 * reads as a live obligation on a plan five years out of date, and it is the freshness signal
 * the whole section is supposed to surface.
 *
 * `CLAUDE.md` §3.2 one field further down: WHICH date matters is a property of the kind, kind is
 * a small enum, and there is nothing here for a model to decide.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { chooseSignificantDate } from '../../lib/documentScan.ts'

const dl = (title: string, due_on: string | null, recurs = false, source_line: string | null = null) =>
  ({ title, due_on, recurs, source_line })

describe('chooseSignificantDate', () => {
  test('a permit takes its expiry, not a recurring report date', () => {
    const got = chooseSignificantDate('permit', '2021-09-01', 'issued', [
      dl('Annual report to the Department', '2027-02-15', true),
      dl('Permit expires', '2026-11-15', false, 'condition 1.2'),
      dl('Renewal application due', '2026-07-18', false, 'condition 1.3'),
    ])
    assert.deepEqual(got, { date: '2026-11-15', kind: 'expiry' })
  })

  test('a permit with no named expiry takes the latest non-recurring deadline', () => {
    const got = chooseSignificantDate('certificate', '2022-03-03', 'issued', [
      dl('Semi-annual monitoring report', '2026-07-31', true),
      dl('Renewal application', '2027-02-10'),
      dl('Licence term ends', '2027-03-02'),
    ])
    assert.deepEqual(got, { date: '2027-03-02', kind: 'expiry' })
  })

  test('a permit with no dated deadline at all falls back to its own date', () => {
    const got = chooseSignificantDate('permit', '2021-09-01', 'issued', [dl('Renewal', null)])
    assert.deepEqual(got, { date: '2021-09-01', kind: 'issued' })
  })

  test('THE CASE THIS EXISTS FOR: a program takes its own revision date, never a deadline', () => {
    const got = chooseSignificantDate('program', '2021-02-01', 'revised', [
      dl('Annual plan review in January', '2026-01-01', true),
      dl('Evacuation drills twice a year', '2026-04-01', true),
    ])
    assert.deepEqual(got, { date: '2021-02-01', kind: 'revised' },
      'the plan is five years old; a 2026 review date on the row hides exactly that')
  })

  test('a policy dated "effective" keeps that word rather than being relabelled revised', () => {
    const got = chooseSignificantDate('policy', '2025-05-12', 'effective', [])
    assert.deepEqual(got, { date: '2025-05-12', kind: 'effective' })
  })

  test('a program whose date kind is something else is still reported as revised', () => {
    const got = chooseSignificantDate('program', '2021-02-01', 'issued', [])
    assert.deepEqual(got, { date: '2021-02-01', kind: 'revised' })
  })

  test('a record takes its last entry', () => {
    const got = chooseSignificantDate('record', '2026-09-18', 'last_entry', [
      dl('M. Chen operator evaluation due', '2027-03-11'),
    ])
    assert.deepEqual(got, { date: '2026-09-18', kind: 'last_entry' },
      'an operator evaluation two years out is not how recent the log is')
  })

  test('a supplier document takes the supplier’s revision date', () => {
    const got = chooseSignificantDate('supplier_document', '2024-03-18', 'revised', [])
    assert.deepEqual(got, { date: '2024-03-18', kind: 'revised' })
  })

  test('nothing to go on gives null, not a guess', () => {
    assert.deepEqual(chooseSignificantDate('program', null, null, []), { date: null, kind: null })
    assert.deepEqual(chooseSignificantDate(null, null, null, []), { date: null, kind: null })
  })
})
