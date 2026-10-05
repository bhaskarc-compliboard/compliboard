/**
 * THE COST LEDGER'S ARITHMETIC — `lib/costLedger.ts`, `DECISIONS.md` §128 J.
 *
 * *** THE PROPERTY THAT MATTERS IS NOT "DOES IT MULTIPLY". *** It is that an UNKNOWN MODEL
 * PRICES AS NULL AND NEVER AS ZERO. A ledger that silently costs an unrecognised model at $0.00
 * reports a total that is too small and looks perfectly healthy — which is the precise failure
 * the table was built to end, arriving through the table itself.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { estimateCost, priceFor, describeCost, LEDGER_TASKS } from '../../lib/costLedger.ts'
import { MODEL_PRICES, PRICE_PER_SEARCH, PRICE_SOURCE_URL } from '../../config/pricing.ts'

describe('an unknown model is UNPRICED, not free', () => {
  test('costUsd is null, and the prices on the row are null with it', () => {
    const c = estimateCost({ model: 'claude-something-7', inputTokens: 1e6, outputTokens: 1e6, searches: 3 })
    assert.equal(c.costUsd, null)
    assert.equal(c.priceInputPerM, null)
    assert.equal(c.priceOutputPerM, null)
  })

  test('null is not zero — the distinction the whole table depends on', () => {
    const c = estimateCost({ model: 'nope', inputTokens: 500_000, outputTokens: 500_000, searches: 0 })
    assert.notEqual(c.costUsd, 0)
    assert.equal(c.costUsd, null)
  })

  test('a model id is matched EXACTLY — a near-miss does not inherit a price', () => {
    assert.ok(priceFor('claude-opus-5'))
    assert.equal(priceFor('claude-opus-5-1'), null, 'a later model must not be priced as this one')
    assert.equal(priceFor('claude-opus'), null)
    assert.equal(priceFor(''), null)
  })
})

describe('the arithmetic, against the table as it stands', () => {
  const M = 1_000_000

  test('one million in and one million out is inputPerM + outputPerM', () => {
    for (const [model, p] of Object.entries(MODEL_PRICES)) {
      const c = estimateCost({ model, inputTokens: M, outputTokens: M, searches: 0 })
      assert.equal(c.costUsd, p.inputPerM + p.outputPerM, model)
    }
  })

  test('searches are added at the per-search price', () => {
    const none = estimateCost({ model: 'claude-opus-5', inputTokens: 0, outputTokens: 0, searches: 0 })
    const four = estimateCost({ model: 'claude-opus-5', inputTokens: 0, outputTokens: 0, searches: 4 })
    assert.equal(none.costUsd, 0)
    assert.equal(four.costUsd, 4 * PRICE_PER_SEARCH)
  })

  test('input and output are priced DIFFERENTLY — swapping them changes the total', () => {
    const a = estimateCost({ model: 'claude-opus-5', inputTokens: M, outputTokens: 0, searches: 0 })
    const b = estimateCost({ model: 'claude-opus-5', inputTokens: 0, outputTokens: M, searches: 0 })
    assert.notEqual(a.costUsd, b.costUsd, 'output is the expensive side and must not be flattened')
    assert.ok((b.costUsd ?? 0) > (a.costUsd ?? 0))
  })

  test('negative counts cannot produce a credit', () => {
    const c = estimateCost({ model: 'claude-opus-5', inputTokens: -1e9, outputTokens: -1e9, searches: -5 })
    assert.equal(c.costUsd, 0)
  })

  test('a zero-token call still prices, at zero — that is not the same as unpriced', () => {
    const c = estimateCost({ model: 'claude-sonnet-5', inputTokens: 0, outputTokens: 0, searches: 0 })
    assert.equal(c.costUsd, 0)
    assert.notEqual(c.priceInputPerM, null)
  })
})

describe('the row carries the prices it was costed at', () => {
  test('the prices come back with the estimate, for storing alongside it', () => {
    const c = estimateCost({ model: 'claude-opus-5', inputTokens: 10, outputTokens: 10, searches: 1 })
    assert.equal(c.priceInputPerM, MODEL_PRICES['claude-opus-5'].inputPerM)
    assert.equal(c.priceOutputPerM, MODEL_PRICES['claude-opus-5'].outputPerM)
    assert.equal(c.pricePerSearch, PRICE_PER_SEARCH)
  })
})

describe('the log line is greppable even when the insert fails', () => {
  test('it names the task, the model, the counts and the money', () => {
    const line = describeCost({
      companyId: null, task: 'research', model: 'claude-opus-5', effort: 'medium',
      inputTokens: 1200, outputTokens: 5900, searches: 4, wallMs: 45400,
    })
    assert.match(line, /research/); assert.match(line, /claude-opus-5\/medium/)
    assert.match(line, /in=1200/); assert.match(line, /out=5900/)
    assert.match(line, /searches=4/); assert.match(line, /45\.4s/); assert.match(line, /\$0\./)
  })

  test('an unpriced model says UNPRICED rather than $0.0000', () => {
    const line = describeCost({
      companyId: null, task: 'other', model: 'mystery', effort: null,
      inputTokens: 1, outputTokens: 1, searches: 0, wallMs: 1,
    })
    assert.match(line, /UNPRICED/)
    assert.ok(!line.includes('$0.0000'))
  })
})

describe('the task list matches the CHECK constraint', () => {
  test('every task the code can write is one the CHECK constraint allows', () => {
    // The migration's CHECK is the authority; this asserts the TypeScript union has not drifted
    // from it. A task the code writes and the constraint refuses is a row silently lost — and
    // this test earned its place by catching exactly that when `document_scan` was added to the
    // code — and again when `document_draft` was. Migration 038 wrote the original list;
    // **migration 050 owns it now**, having dropped and recreated the constraint to add
    // `document_draft` beside `document_scan`. **Migration 064 owns it now** (Workspace Task 6),
    // having recreated it again to add `howto`. **Migration 066 owns it now** (HR Step 3b), having
    // recreated it to add `hr` and `hr_check`.
    const inMigration = [
      'research', 'checklist', 'substeps', 'convert', 'summarise',
      'gate', 'critique', 'audit', 'document_review', 'document_scan', 'document_draft', 'howto', 'other',
      'hr', 'hr_check',
    ]
    assert.deepEqual([...LEDGER_TASKS].sort(), inMigration.sort())
  })
})

describe('Opus 5.5 prices EXACTLY, and not by resembling Opus 5 — 26 September 2026', () => {
  // $4 in, $20 out, read off PRICE_SOURCE_URL on 26 September 2026. The reason this is a test and
  // not a comment: the ONE failure mode of this table is a model id that resolves at the API and
  // prices as null here, which records tokens with no money and leaves a total that looks healthy.
  // Opus 5.5 is the live candidate — the bake-off may move the judgement tier onto it.

  test('the id prices at $4 in and $20 out per million', () => {
    const p = priceFor('claude-opus-5-5')
    assert.ok(p, 'claude-opus-5-5 must be in the table, or its calls record no cost')
    assert.equal(p.inputPerM, 4)
    assert.equal(p.outputPerM, 20)
  })

  test('a million in and a million out is $24', () => {
    const c = estimateCost({ model: 'claude-opus-5-5', inputTokens: 1e6, outputTokens: 1e6, searches: 0 })
    assert.equal(c.costUsd, 24)
    assert.equal(c.priceInputPerM, 4)
    assert.equal(c.priceOutputPerM, 20)
  })

  test('it is CHEAPER than Opus 5, which is the direction the page says', () => {
    const five = estimateCost({ model: 'claude-opus-5', inputTokens: 1e6, outputTokens: 1e6, searches: 0 })
    const fiveFive = estimateCost({ model: 'claude-opus-5-5', inputTokens: 1e6, outputTokens: 1e6, searches: 0 })
    assert.ok((fiveFive.costUsd ?? 0) < (five.costUsd ?? 0))
  })

  test('the neighbouring spellings are NOT it — exact match, no prefix inheritance', () => {
    // `claude-opus-5-5` and `claude-opus-5` differ by two characters and by a dollar per million in.
    assert.equal(priceFor('claude-opus-5-5-20260922'), null)
    assert.equal(priceFor('claude-opus-55'), null)
    assert.equal(priceFor('claude-opus-5.5'), null)
    assert.notEqual(priceFor('claude-opus-5')?.inputPerM, priceFor('claude-opus-5-5')?.inputPerM)
  })

  test('one search costs the same on it as on every other model', () => {
    // $10 per 1,000 searches is not per model, so this is the whole assertion there is to make.
    const c = estimateCost({ model: 'claude-opus-5-5', inputTokens: 0, outputTokens: 0, searches: 1 })
    assert.equal(c.costUsd, PRICE_PER_SEARCH)
    assert.equal(PRICE_PER_SEARCH * 1000, 10)
  })

  test('the table says where its numbers came from', () => {
    assert.match(PRICE_SOURCE_URL, /^https:\/\/platform\.claude\.com\/docs\/en\/about-claude\/pricing$/)
  })
})
