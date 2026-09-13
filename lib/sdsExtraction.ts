/**
 * THE SDS PIPELINE — turning a safety data sheet into `company_chemicals` rows.
 *
 * Spec: `docs/SWITCH-DETERMINATION.md` §3–4. Semantics: `DECISIONS.md` §45 (an unidentified
 * chemical makes the answer unknown), §44.1 (a proxy with a fabricated magnitude).
 *
 * *** THE THING TO UNDERSTAND BEFORE READING ANY OF THIS: AN SDS HAS NO QUANTITY IN IT. ***
 *
 * An SDS describes a SUBSTANCE. It is authored by the manufacturer, identical for every
 * customer, and it says nothing whatever about how much of the stuff any particular site
 * holds. `substance_inventory()` needs `max_quantity` and a unit before it will return
 * anything but NULL — so **uploading twenty-four SDSs resolves zero requirements.** It moves
 * the fifteen inventory-backed requirements from "unknown, nothing known" to "unknown,
 * quantity missing", which is a far better question to put to a customer and is the same
 * obligation_status.
 *
 * That is not a defect in this pipeline. It is the pipeline being honest about what its input
 * contains, and the alternative — estimating a quantity from drum counts or the word "bulk" —
 * is §44.1 exactly: a number nobody wrote down, feeding a threshold test, producing a
 * confident answer. The quantity comes from a Tier II report, an inventory list, purchase
 * records, or a question. Never from the SDS.
 */

import type { Truth } from './appliesExpression.ts'

// ---------------------------------------------------------------------------
// CAS NUMBERS — the join key, and the one thing worth validating in code
// ---------------------------------------------------------------------------

/**
 * Is this a well-formed CAS registry number, INCLUDING its check digit?
 *
 * *** WHY THE CHECK DIGIT MATTERS MORE HERE THAN ANYWHERE ELSE. *** `DECISIONS.md` §45
 * established that a CAS matching nothing makes a row unevaluable, so the requirement becomes
 * UNKNOWN rather than wrongly cleared. That is the safe failure and it is already handled.
 *
 * **The dangerous failure is a typo that lands on a DIFFERENT REAL SUBSTANCE.** `7664-93-9`
 * is sulfuric acid; `7664-39-3` is hydrofluoric acid. Two transposed digits, both valid, both
 * in the reference table, wildly different thresholds — and the result is not `unknown`, it is
 * a confident answer about a chemical the site does not hold.
 *
 * The check digit does not catch every transposition, but it catches most, it is arithmetic
 * rather than judgement, and it costs nothing. The last digit is a weighted sum of the
 * others: reverse the remaining digits, multiply by 1, 2, 3 … and take mod 10.
 */
export function isValidCas(raw: string | null | undefined): boolean {
  if (!raw) return false
  const m = /^(\d{2,7})-(\d{2})-(\d)$/.exec(raw.trim())
  if (!m) return false
  const digits = (m[1] + m[2]).split('').reverse()
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * (i + 1), 0)
  return sum % 10 === Number(m[3])
}

/** Normalised for storage and joining. Returns null for anything that is not a valid CAS. */
export function normaliseCas(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  return isValidCas(t) ? t : null
}

// ---------------------------------------------------------------------------
// WHAT THE MODEL IS ASKED TO RETURN
// ---------------------------------------------------------------------------

/**
 * One component of one product. A 40% formalin solution is ONE SDS and at least TWO of these.
 *
 * `concentration_low/high` are the RANGE the SDS prints — "30-60%" — and they are kept as a
 * range on purpose. Collapsing a range to a midpoint to apportion a quantity is the textbook
 * §44.1 move: it manufactures a magnitude with a decimal point on it and no source.
 */
export interface SdsComponent {
  /** As printed in §3. Kept even when the CAS is withheld. */
  name: string
  /** null when withheld as a trade secret, illegible, or failing the check digit. */
  cas_number: string | null
  concentration_low: number | null
  concentration_high: number | null
  /** Verbatim, for `basis`. Checked as a substring of the document text. */
  quote: string
}

export interface SdsExtraction {
  product_name: string
  supplier: string | null
  revision_date: string | null
  physical_state: 'solid' | 'liquid' | 'gas' | null
  components: SdsComponent[]
  /** True when §3 says composition is withheld. NOT the same as an empty components list. */
  composition_withheld: boolean
}

/** One row destined for `company_chemicals`, with the provenance the table requires. */
export interface ChemicalRow {
  entity_id: string
  substance_name: string
  cas_number: string | null
  /** ALWAYS null from an SDS. Present in the type because the table has it and a later pass fills it. */
  max_quantity: null
  unit: null
  physical_state: 'solid' | 'liquid' | 'gas' | null
  source: 'ai_from_documents'
  confidence: 'high' | 'medium' | 'low'
  basis: string
}

// ---------------------------------------------------------------------------
// THE RULES, AS CODE
// ---------------------------------------------------------------------------

/**
 * Turn one extraction into rows.
 *
 * THREE RULES, and each one is a way this produces a silent wrong answer if broken.
 *
 * 1. **A component with no readable CAS still becomes a row.** Trade-secret composition is
 *    ordinary, not exotic. Dropping the component makes the site look cleaner than it is,
 *    which is the false green; keeping it with a null CAS makes `substance_inventory()`
 *    return `unknown` for that site, which is `DECISIONS.md` §45 working as designed.
 *
 * 2. **A CAS that fails the check digit is stored as NULL, and the raw string goes in the
 *    basis.** Never store it as-is: a malformed CAS that happens to match a row in
 *    `regulated_substances` is a confident answer about the wrong chemical.
 *
 * 3. **`max_quantity` and `unit` are always null.** There is no quantity in an SDS. The type
 *    says `null`, not `number | null`, so a later edit that tries to fill one here is a
 *    compile error rather than a fabricated threshold.
 */
export function toChemicalRows(
  extraction: SdsExtraction,
  entityId: string,
  documentId: string,
): ChemicalRow[] {
  const components = extraction.components.length
    ? extraction.components
    : // Composition withheld entirely: the product is still on site and still unidentified.
      // One row, no CAS — the honest record, and the one that produces `unknown`.
      [{
        name: extraction.product_name,
        cas_number: null,
        concentration_low: null,
        concentration_high: null,
        quote: extraction.composition_withheld
          ? 'Composition withheld as a trade secret'
          : 'No composition section found',
      } satisfies SdsComponent]

  return components.map((c) => {
    const cas = normaliseCas(c.cas_number)
    const rejected = c.cas_number && !cas
    const range =
      c.concentration_low !== null && c.concentration_high !== null
        ? ` (${c.concentration_low}–${c.concentration_high}%)`
        : ''
    return {
      entity_id: entityId,
      substance_name: c.name,
      cas_number: cas,
      max_quantity: null,
      unit: null,
      physical_state: extraction.physical_state,
      source: 'ai_from_documents',
      // A named component with a valid CAS is as strong as this document gets. Anything
      // else is weaker BECAUSE OF WHAT IS MISSING, which is the honest reason.
      confidence: cas ? 'high' : 'low',
      basis:
        `doc:${documentId} · ${extraction.product_name}${range} · "${c.quote}"` +
        (rejected ? ` · CAS "${c.cas_number}" REJECTED: check digit does not validate` : '') +
        (cas ? '' : ' · no usable CAS, so this substance cannot be matched to a threshold'),
    }
  })
}

/**
 * What an SDS upload can and cannot settle, for the message the user sees.
 *
 * Returned rather than rendered here so the wording lives with the UI, but computed here so
 * it cannot drift from what the pipeline actually did. `CLAUDE.md` §5.1 — an empty state is a
 * claim and it has to be true.
 */
export function inventoryReadiness(rows: ChemicalRow[]): {
  identified: number
  unidentified: number
  quantified: number
  verdict: Truth
} {
  const identified = rows.filter((r) => r.cas_number !== null).length
  return {
    identified,
    unidentified: rows.length - identified,
    // Always zero from SDSs alone. Stated explicitly so the caller cannot assume otherwise.
    quantified: 0,
    // Every threshold question stays `unknown` until quantities arrive. This is the value
    // `substance_inventory()` will return, computed here so the UI can say so before asking.
    verdict: 'unknown',
  }
}
