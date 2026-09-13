/**
 * THE SDS PIPELINE — the check digit, and the three rules that stop a silent wrong answer.
 *
 * `DECISIONS.md` §45 made an unmatched CAS produce `unknown` rather than `false`, which is the
 * safe failure. The failure it does NOT cover is a typo that lands on a DIFFERENT REAL
 * SUBSTANCE — that resolves confidently, against the wrong thresholds. These tests are mostly
 * about that.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidCas, normaliseCas, toChemicalRows, inventoryReadiness,
  type SdsExtraction,
} from '../../lib/sdsExtraction.ts'

describe('CAS check digit', () => {
  test('real registry numbers validate', () => {
    for (const cas of [
      '7664-93-9',   // sulfuric acid
      '7664-39-3',   // hydrofluoric acid
      '1310-73-2',   // sodium hydroxide
      '67-64-1',     // acetone
      '7782-50-5',   // chlorine
      '50-00-0',     // formaldehyde
      '108-88-3',    // toluene
    ]) assert.equal(isValidCas(cas), true, cas)
  })

  test('THE DANGEROUS CASE: a transposition that stays well-formed is caught', () => {
    // 7664-93-9 is sulfuric acid. Transpose two digits and you can land on hydrofluoric acid,
    // which is a real substance with very different thresholds. The check digit is what
    // separates "unknown, and we say so" from "confident, about the wrong chemical".
    assert.equal(isValidCas('7664-93-9'), true)
    assert.equal(isValidCas('7466-93-9'), false, 'a transposed CAS must not validate')
    assert.equal(isValidCas('7664-39-9'), false, 'wrong check digit for hydrofluoric acid')
  })

  test('malformed shapes are rejected', () => {
    for (const bad of ['not-a-cas', '7664-93', '76649-39', '', '7664–93–9']) {
      assert.equal(isValidCas(bad), false, bad)
    }
  })

  test('null and undefined are not valid, and do not throw', () => {
    assert.equal(isValidCas(null), false)
    assert.equal(isValidCas(undefined), false)
    assert.equal(normaliseCas(null), null)
  })

  test('normaliseCas returns null rather than passing a bad CAS through', () => {
    assert.equal(normaliseCas(' 7664-93-9 '), '7664-93-9')
    assert.equal(normaliseCas('7466-93-9'), null, 'a failing CAS must never reach the FK')
  })
})

const sds = (over: Partial<SdsExtraction> = {}): SdsExtraction => ({
  product_name: 'Formalin 40%',
  supplier: 'Cascade Specialty Chemicals, LLC',
  revision_date: '2025-11-04',
  physical_state: 'liquid',
  composition_withheld: false,
  components: [
    { name: 'Formaldehyde', cas_number: '50-00-0', concentration_low: 37, concentration_high: 41,
      quote: 'Formaldehyde ... 37-41% ... CAS 50-00-0' },
    { name: 'Methanol', cas_number: '67-56-1', concentration_low: 10, concentration_high: 15,
      quote: 'Methanol ... 10-15% ... CAS 67-56-1' },
  ],
  ...over,
})

describe('one SDS is one product and several substances', () => {
  test('a mixture produces one row per component', () => {
    const rows = toChemicalRows(sds(), 'site-1', 'doc-1')
    assert.equal(rows.length, 2)
    assert.deepEqual(rows.map((r) => r.cas_number).sort(), ['50-00-0', '67-56-1'])
  })
  test('the concentration RANGE goes in the basis and is never collapsed to a number', () => {
    const rows = toChemicalRows(sds(), 'site-1', 'doc-1')
    assert.match(rows[0].basis, /37–41%/)
    // §44.1: apportioning a quantity from a midpoint would manufacture a magnitude.
    assert.equal(rows[0].max_quantity, null)
  })
})

describe('an SDS never carries a quantity, and the type says so', () => {
  test('max_quantity and unit are null on every row', () => {
    for (const r of toChemicalRows(sds(), 'site-1', 'doc-1')) {
      assert.equal(r.max_quantity, null)
      assert.equal(r.unit, null)
    }
  })
  test('readiness reports zero quantified and an unknown verdict', () => {
    const r = inventoryReadiness(toChemicalRows(sds(), 'site-1', 'doc-1'))
    assert.deepEqual(r, { identified: 2, unidentified: 0, quantified: 0, verdict: 'unknown' })
  })
})

describe('a component with no usable CAS is KEPT, not dropped', () => {
  test('a trade-secret component still produces a row', () => {
    const rows = toChemicalRows(sds({
      components: [{ name: 'Proprietary surfactant blend', cas_number: null,
        concentration_low: 1, concentration_high: 5, quote: 'Proprietary ... 1-5%' }],
    }), 'site-1', 'doc-1')
    assert.equal(rows.length, 1, 'dropping it would make the site look cleaner than it is')
    assert.equal(rows[0].cas_number, null)
    assert.equal(rows[0].confidence, 'low')
    assert.match(rows[0].basis, /no usable CAS/)
  })

  test('a CAS failing the check digit is stored as NULL with the raw string in the basis', () => {
    const rows = toChemicalRows(sds({
      components: [{ name: 'Sulfuric acid', cas_number: '7466-93-9',
        concentration_low: null, concentration_high: null, quote: 'Sulfuric acid CAS 7466-93-9' }],
    }), 'site-1', 'doc-1')
    assert.equal(rows[0].cas_number, null, 'a bad CAS must never reach regulated_substances')
    assert.match(rows[0].basis, /REJECTED: check digit/)
    assert.match(rows[0].basis, /7466-93-9/, 'the raw string is kept so a human can correct it')
  })

  test('composition withheld entirely still produces one row for the product', () => {
    const rows = toChemicalRows(sds({ components: [], composition_withheld: true }), 'site-1', 'doc-1')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].substance_name, 'Formalin 40%')
    assert.equal(rows[0].cas_number, null)
    assert.match(rows[0].basis, /trade secret/)
  })

  test('readiness counts the unidentified separately — the number the UI has to say', () => {
    const rows = toChemicalRows(sds({
      components: [
        { name: 'Formaldehyde', cas_number: '50-00-0', concentration_low: null, concentration_high: null, quote: 'q' },
        { name: 'Proprietary blend', cas_number: null, concentration_low: null, concentration_high: null, quote: 'q' },
      ],
    }), 'site-1', 'doc-1')
    const r = inventoryReadiness(rows)
    assert.equal(r.identified, 1)
    assert.equal(r.unidentified, 1)
    assert.equal(r.verdict, 'unknown')
  })
})

describe('the basis always names the document', () => {
  test('every row carries doc:<id> and a verbatim quote', () => {
    for (const r of toChemicalRows(sds(), 'site-1', 'doc-abc')) {
      assert.match(r.basis, /^doc:doc-abc · /)
      assert.match(r.basis, /"/)
    }
  })
})
