/**
 * THE CRITIC PASS — the two pure halves, which had no test at all until 13 September.
 *
 * *** WHY THIS FILE EXISTS. *** `lib/criticPass.ts` is called from `/api/chat` and
 * `/api/audits` and was the ONLY module in the project with production callers and ZERO test
 * coverage. Its own contract is that it never regenerates — findings are applied in code by
 * severity, so a wrong item is withheld with its reason rather than silently rewritten
 * (`DECISIONS.md` §39). **That contract lives entirely in `normaliseCritique` and
 * `applyCritique`, both pure**, and neither had ever been asserted.
 *
 * `criticise()` itself is not tested here — it calls a model, and a model checking a model is
 * the thing `docs/TESTING.md` refuses. What IS testable is what the product does with whatever
 * comes back, including the shapes a model gets wrong.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseCritique, applyCritique, buildCriticPrompt, dispositionOf,
         type CriticResult } from '../../lib/criticPass.ts'

const f = (o: Partial<CriticResult['findings'][number]> = {}) => ({
  severity: 'blocking' as const, question: 1 as const, quote: 'the answer said X',
  item: 'Oregon sick time', finding: 'asserts a threshold the rule does not state',
  because: 'ORS 653.606 says 10, the answer said 6', ...o,
})

describe('a finding with no quote is an impression, and is dropped', () => {
  test('no quote at all', () => {
    const r = normaliseCritique({ findings: [{ ...f(), quote: undefined }], complete: true })
    assert.equal(r.findings.length, 0,
      'the prompt asks for a quote precisely so an invented finding is hard to write')
  })
  test('a whitespace quote is not a quote', () => {
    assert.equal(normaliseCritique({ findings: [f({ quote: '   ' })] }).findings.length, 0)
  })
  test('a non-string quote is not a quote', () => {
    assert.equal(normaliseCritique({ findings: [f({ quote: 42 as never })] }).findings.length, 0)
  })
  test('a real quote survives, and is trimmed', () => {
    const r = normaliseCritique({ findings: [f({ quote: '  said X  ' })] })
    assert.equal(r.findings.length, 1)
    assert.equal(r.findings[0].quote, 'said X')
  })
})

describe('garbage in never throws — the critic must not be able to break the answer', () => {
  for (const [name, raw] of [
    ['null', null], ['undefined', undefined], ['a string', 'sorry, I could not comply'],
    ['a number', 7], ['an empty object', {}], ['findings as a string', { findings: 'none' }],
    ['findings as null', { findings: null }],
  ] as const) {
    test(name, () => {
      const r = normaliseCritique(raw)
      assert.deepEqual(r.findings, [])
      assert.equal(r.complete, false,
        'unparseable is NOT a clean pass — an answer nobody reviewed must not read as reviewed')
    })
  }
})

describe('an unknown severity or question is coerced, never dropped', () => {
  test('a severity the model invented becomes `qualifying`, not `blocking`', () => {
    const r = normaliseCritique({ findings: [f({ severity: 'catastrophic' as never })] })
    assert.equal(r.findings[0].severity, 'qualifying',
      'coercing UP to blocking would let a malformed critique withhold a correct answer')
  })
  test('a question number out of range becomes 7', () => {
    assert.equal(normaliseCritique({ findings: [f({ question: 99 as never })] }).findings[0].question, 7)
    assert.equal(normaliseCritique({ findings: [f({ question: 0 as never })] }).findings[0].question, 7)
  })
  test('the finding is KEPT — a malformed label is not a reason to discard the substance', () => {
    assert.equal(normaliseCritique({ findings: [f({ severity: 'x' as never })] }).findings.length, 1)
  })
})

describe('`complete` defaults to true and only an explicit false clears it', () => {
  test('absent means complete', () => {
    assert.equal(normaliseCritique({ findings: [] }).complete, true)
  })
  test('explicit false is honoured', () => {
    assert.equal(normaliseCritique({ findings: [], complete: false }).complete, false)
  })
})

describe('applyCritique splits the three ways §6.1 specifies', () => {
  const result: CriticResult = { complete: true, findings: [
    f({ severity: 'blocking',   question: 1, item: 'A' }),
    f({ severity: 'qualifying', question: 2, item: 'B' }),
    f({ severity: 'coverage',   question: 6, item: 'DEQ' }),
    f({ severity: 'qualifying', question: 5, item: '$650 fee' }),
  ] }

  test('blocking findings are WITHHELD and carry the reason to show in their place', () => {
    const a = applyCritique(result)
    assert.equal(a.withheld.length, 1)
    assert.equal(a.withheld[0].item, 'A')
    assert.ok(a.withheld[0].because.length > 0,
      'withholding without a reason is a silent fix — §39 forbids exactly that')
    assert.ok(a.withheld[0].quote.length > 0)
  })

  /**
   * *** THE ONE THAT MATTERS. *** Question 5 is "flag every specific" — pattern-matching, not
   * adversarial judgement, and it fires on nearly every answer. Folding it into the findings
   * count makes the count meaningless, and the count is the only way to detect a critic that
   * has started inventing (`docs/CRITIC-PASS.md` §7.1).
   */
  test('question 5 is separated out and never inflates the qualifications', () => {
    const a = applyCritique(result)
    assert.equal(a.qualifications.length, 1, 'question 5 must not be counted as a qualification')
    assert.equal(a.qualifications[0].item, 'B')
    assert.equal(a.unverifiedSpecifics.length, 1)
    assert.equal(a.unverifiedSpecifics[0].item, '$650 fee')
  })

  test('a question-5 finding marked BLOCKING still blocks — severity outranks the split', () => {
    const a = applyCritique({ complete: true, findings: [f({ severity: 'blocking', question: 5 })] })
    assert.equal(a.withheld.length, 1)
    assert.equal(a.unverifiedSpecifics.length, 1,
      'it is counted as a specific AND withheld — the two are different questions about one finding')
  })

  test('coverage findings are gaps, not qualifications', () => {
    const a = applyCritique(result)
    assert.equal(a.gaps.length, 1)
    assert.equal(a.gaps[0].item, 'DEQ')
  })

  test('an empty critique withholds nothing — the negative control', () => {
    const a = applyCritique({ findings: [], complete: true })
    assert.deepEqual(a.withheld, []); assert.deepEqual(a.qualifications, [])
    assert.deepEqual(a.gaps, []);     assert.deepEqual(a.unverifiedSpecifics, [])
    assert.equal(a.complete, true)
  })

  test('IT NEVER REWRITES — nothing in the output is a replacement answer', () => {
    const a = applyCritique(result)
    const keys = Object.keys(a).join(' ')
    for (const w of ['corrected', 'rewritten', 'replacement', 'revised', 'fixed'])
      assert.ok(!keys.includes(w), `applyCritique exposed a "${w}" field — §39 says it reports, never regenerates`)
  })
})

describe('the prompt is built per question set and never leaks the generating instructions', () => {
  test('both sets build', () => {
    for (const set of ['requirements', 'evidence'] as const)
      assert.ok(buildCriticPrompt(set).length > 0)
  })
  test('the two sets differ', () => {
    assert.notEqual(buildCriticPrompt('requirements'), buildCriticPrompt('evidence'))
  })
})

describe('dispositionOf — what the CODE did with the finding (DECISIONS.md §97)', () => {
  const finding = (o: Partial<CriticResult['findings'][number]>) => ({
    severity: 'qualifying' as const, question: 1 as const, quote: 'q',
    item: 'An item', finding: 'f', because: 'b', ...o,
  })

  // *** THE REGRESSION. The first version tested `question === 5` FIRST and recorded a finding
  // that was BOTH blocking and a specific as `counted` — while the route had deleted the item it
  // named. `applyCritique` puts it in BOTH buckets, because the two filters are independent.
  test('a finding that is blocking AND question 5 records what HAPPENED: withheld', () => {
    const f5 = finding({ severity: 'blocking', question: 5, item: 'Report Biennial Waste Activity' })
    // The route removed it, which is the fact the record has to carry.
    assert.equal(dispositionOf(f5, new Set(['Report Biennial Waste Activity'])), 'withheld')
    // And applyCritique really does put it in both, which is WHY the order matters.
    const applied = applyCritique({ findings: [f5], complete: true })
    assert.equal(applied.withheld.length, 1)
    assert.equal(applied.unverifiedSpecifics.length, 1)
  })

  // *** THE SECOND REGRESSION, one layer down. Several findings can name the SAME item and the
  // route deletes by item NAME, so a qualifying finding on a deleted item must NOT read as kept.
  test('ANY finding naming a withheld item is withheld, whatever its own severity', () => {
    const removed = new Set(['Install ANSI-compliant plumbed eyewash station'])
    for (const q of [3, 4] as const) {
      assert.equal(
        dispositionOf(finding({ severity: 'qualifying', question: q,
                                item: 'Install ANSI-compliant plumbed eyewash station' }), removed),
        'withheld',
        `q${q} qualifying on a removed item must not read as kept — the answer shipped without it`)
    }
  })

  test('question 5 is counted when its item SURVIVED', () => {
    assert.equal(dispositionOf(finding({ question: 5 }), new Set()), 'counted')
  })

  // A blocking finding that removed nothing must not read as one that did — "blocking" and
  // "acted on" are different populations and the record has to keep them apart.
  test('blocking with item null removes nothing, so it is kept, not withheld', () => {
    assert.equal(dispositionOf(finding({ severity: 'blocking', question: 6, item: null }), new Set()), 'kept')
  })

  test('blocking whose item the caller did not remove is kept — /api/audits removes nothing', () => {
    assert.equal(dispositionOf(finding({ severity: 'blocking', item: 'Untouched' }), new Set()), 'kept')
  })

  test('an ordinary qualifying finding is kept', () => {
    assert.equal(dispositionOf(finding({}), new Set()), 'kept')
  })
})
