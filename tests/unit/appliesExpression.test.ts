/**
 * THE TRUTH TABLES.
 *
 * This is the first test file in the project, and it is first for a reason: every layer
 * above the evaluator inherits whatever this gets wrong, and what it would get wrong is
 * invisible. `CLAUDE.md` §3.10 — the resolution engine is pure logic with safety properties
 * and MUST have tests.
 *
 * WHAT MAKES THIS DANGEROUS RATHER THAN MERELY IMPORTANT. Evaluation is three-valued:
 * true | false | unknown. Map those to obligation_status and the asymmetry is total —
 *
 *     true    -> applies         the customer sees the requirement
 *     unknown -> undetermined    the customer sees an open question
 *     false   -> does_not_apply  THE REQUIREMENT LEAVES THE LIST
 *
 * An error in the `true` direction is over-inclusion: noisy, visible, arguable, survivable.
 * An error in the `false` direction is a FALSE GREEN — the requirement is gone and nothing
 * anywhere records that it was ever considered. `CLAUDE.md` §3.2: absence of evidence never
 * produces a clear.
 *
 * So there is really only one bug in this file, wearing three faces: COLLAPSING `unknown`
 * TO `false`. The three cells where it hides are marked DANGEROUS below and each has its
 * own named test spelling out what a wrong answer would do to a customer.
 *
 * WHY THE OPERANDS ARE BUILT FROM FACTS RATHER THAN FROM LITERALS. The tests could assert
 * and3/or3/not3 directly. They do not, because resolution never calls those — it calls
 * evaluate(), and the path from "a switch nobody has answered" to `unknown` is part of the
 * property. A test that proved the tables while the operand lookup returned `false` would
 * pass and prove nothing.
 */

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluate,
  type Expression,
  type Facts,
  type Jurisdiction,
  type Truth,
} from '../../lib/appliesExpression.ts'

// ---------------------------------------------------------------------------
// OPERANDS
// ---------------------------------------------------------------------------

/** Two facts established, and a third deliberately absent. `u` is never a key here. */
const FACTS: Facts = { t: true, f: false }

const T: Expression = { switch: 't', op: 'is', value: true }
const F: Expression = { switch: 'f', op: 'is', value: true }
/** A switch NOBODY HAS ANSWERED. Not false. This operand is the whole test file. */
const U: Expression = { switch: 'never_established', op: 'is', value: true }

const OPERANDS: Array<[string, Expression]> = [['true', T], ['false', F], ['unknown', U]]

const ev = (e: Expression, facts: Facts = FACTS): Truth => evaluate(e, facts)

// ---------------------------------------------------------------------------
// THE TABLES
// ---------------------------------------------------------------------------

/** all_of: a definite false wins over unknown; unknown wins over true. */
const ALL: Record<string, Truth> = {
  'true AND true': true,      'true AND false': false,      'true AND unknown': 'unknown',
  'false AND true': false,    'false AND false': false,     'false AND unknown': false,
  'unknown AND true': 'unknown', 'unknown AND false': false, 'unknown AND unknown': 'unknown',
}

/** any_of: a definite true wins over unknown; unknown wins over false. */
const ANY: Record<string, Truth> = {
  'true OR true': true,       'true OR false': true,        'true OR unknown': true,
  'false OR true': true,      'false OR false': false,      'false OR unknown': 'unknown',
  'unknown OR true': true,    'unknown OR false': 'unknown', 'unknown OR unknown': 'unknown',
}

describe('all_of — the complete 3x3 table', () => {
  for (const [an, a] of OPERANDS) {
    for (const [bn, b] of OPERANDS) {
      const key = `${an} AND ${bn}`
      test(key, () => {
        assert.equal(ev({ all: [a, b] }), ALL[key], key)
        // Commutative: order of operands must not change the answer.
        assert.equal(ev({ all: [b, a] }), ALL[key], `${key} (operands reversed)`)
      })
    }
  }
})

describe('any_of — the complete 3x3 table', () => {
  for (const [an, a] of OPERANDS) {
    for (const [bn, b] of OPERANDS) {
      const key = `${an} OR ${bn}`
      test(key, () => {
        assert.equal(ev({ any: [a, b] }), ANY[key], key)
        assert.equal(ev({ any: [b, a] }), ANY[key], `${key} (operands reversed)`)
      })
    }
  }
})

describe('not — three values in, three values out', () => {
  test('not true  -> false', () => assert.equal(ev({ not: T }), false))
  test('not false -> true',  () => assert.equal(ev({ not: F }), true))
  test('not unknown -> unknown', () => assert.equal(ev({ not: U }), 'unknown'))
})

// ---------------------------------------------------------------------------
// THE THREE DANGEROUS CELLS, NAMED
// ---------------------------------------------------------------------------

describe('DANGEROUS CELLS — the ones where a wrong answer hides a requirement', () => {
  /**
   * The customer has told us they have employees. They have NOT told us the headcount.
   * The requirement turns on both. The honest answer is "we cannot say yet" — an open
   * question on their screen. The wrong answer is `false`, and the requirement silently
   * leaves the list.
   */
  test('all_of(true, unknown) is unknown — NEVER false', () => {
    const r = ev({ all: [T, U] })
    assert.notEqual(r, false, 'FALSE GREEN: a requirement would vanish on a fact nobody supplied')
    assert.equal(r, 'unknown')
  })

  /**
   * One branch of an OR is definitely false; the other is unanswered. An unanswered branch
   * can still turn out to be true, so the disjunction is not settled.
   */
  test('any_of(false, unknown) is unknown — NEVER false', () => {
    const r = ev({ any: [F, U] })
    assert.notEqual(r, false, 'FALSE GREEN: an unanswered branch was treated as a settled no')
    assert.equal(r, 'unknown')
  })

  /**
   * The classic implementation bug: `return !v`. In JavaScript `!'unknown'` is `false`,
   * because a non-empty string is truthy. Five of the 199 live expressions contain a `not`.
   */
  test('not(unknown) is unknown — NEVER false, and !"unknown" is the bug', () => {
    // Widened on purpose: the compiler knows `!'unknown'` statically, but the evaluator
    // sees a Truth at runtime and this is the coercion that would bite it.
    const asSeenAtRuntime: string = 'unknown'
    assert.equal(!asSeenAtRuntime, false, 'sanity: this is why `return !v` is wrong')
    assert.equal(ev({ not: U }), 'unknown')
  })

  /**
   * Short-circuiting is allowed in one direction only. `all` may stop at a definite false;
   * `any` may stop at a definite true. Neither may step over an `unknown` to reach a false.
   */
  test('all_of MAY short-circuit to false past an unknown', () => {
    assert.equal(ev({ all: [U, F, U] }), false)
  })
  test('any_of MAY short-circuit to true past an unknown', () => {
    assert.equal(ev({ any: [U, T, U] }), true)
  })
})

// ---------------------------------------------------------------------------
// N-ARY AND NESTING — the tables above are binary; the real expressions are not
// ---------------------------------------------------------------------------

describe('n-ary and nested', () => {
  test('all_of over many: one unknown among all-true is unknown', () => {
    assert.equal(ev({ all: [T, T, T, U] }), 'unknown')
  })
  test('all_of over many: one false anywhere is false', () => {
    assert.equal(ev({ all: [T, U, F, U] }), false)
  })
  test('any_of over many: all false is false', () => {
    assert.equal(ev({ any: [F, F, F] }), false)
  })
  test('any_of over many: one unknown among all-false is unknown', () => {
    assert.equal(ev({ any: [F, F, U] }), 'unknown')
  })
  test('empty all_of is true, empty any_of is false — the identity elements', () => {
    // Not a preference: `all` over nothing is vacuously true, `any` over nothing is
    // vacuously false. Getting these backwards inverts every expression built on them.
    assert.equal(ev({ all: [] }), true)
    assert.equal(ev({ any: [] }), false)
  })
  test('unknown propagates up through three levels of nesting', () => {
    assert.equal(ev({ all: [T, { any: [F, { all: [T, U] }] }] }), 'unknown')
  })
  test('double negation returns the value, including unknown', () => {
    assert.equal(ev({ not: { not: T } }), true)
    assert.equal(ev({ not: { not: F } }), false)
    assert.equal(ev({ not: { not: U } }), 'unknown')
  })
  test('de Morgan holds across all three values', () => {
    // not(a AND b) === (not a) OR (not b), for every pair. If this fails, the two
    // tables above disagree with each other and one of them is wrong.
    for (const [, a] of OPERANDS) {
      for (const [, b] of OPERANDS) {
        assert.equal(ev({ not: { all: [a, b] } }), ev({ any: [{ not: a }, { not: b }] }))
        assert.equal(ev({ not: { any: [a, b] } }), ev({ all: [{ not: a }, { not: b }] }))
      }
    }
  })
})

// ---------------------------------------------------------------------------
// OPERAND RESOLUTION — where `unknown` is produced in the first place
// ---------------------------------------------------------------------------

describe('a fact that is not established is unknown, not false', () => {
  test('switch absent from facts', () => {
    assert.equal(evaluate({ switch: 'nope', op: 'is', value: true }, {}), 'unknown')
  })
  test('switch present but null', () => {
    assert.equal(evaluate({ switch: 'x', op: 'is', value: true }, { x: null }), 'unknown')
  })
  test('switch present but undefined', () => {
    assert.equal(evaluate({ switch: 'x', op: 'is', value: true }, { x: undefined }), 'unknown')
  })
  test('a false fact is false — absence and negation are different things', () => {
    assert.equal(evaluate({ switch: 'x', op: 'is', value: true }, { x: false }), false)
  })
  test('numeric comparison on an unset switch is unknown, not a coerced 0', () => {
    // Number(undefined) is NaN and NaN >= 6 is false. If the guard above were removed,
    // every headcount threshold would silently read "below the threshold".
    assert.equal(evaluate({ switch: 'n', op: '>=', value: 6 }, {}), 'unknown')
    assert.equal(evaluate({ switch: 'n', op: '>=', value: 6 }, { n: 0 }), false)
    assert.equal(evaluate({ switch: 'n', op: '>=', value: 6 }, { n: 6 }), true)
  })
})

describe('the `known` operator asks a different question and answers it definitely', () => {
  test('known on an unset switch is FALSE, not unknown', () => {
    // "Has this been established?" is answerable even when the value is not. This is the
    // one operator for which absence produces a definite answer.
    assert.equal(evaluate({ switch: 'x', op: 'known' }, {}), false)
  })
  test('known on a set switch is true, whatever the value', () => {
    assert.equal(evaluate({ switch: 'x', op: 'known' }, { x: false }), true)
    assert.equal(evaluate({ switch: 'x', op: 'known' }, { x: 0 }), true)
  })
})

describe('jurisdiction clauses read entities, and absence is unknown', () => {
  const OR: Jurisdiction = { state: 'Oregon', county: 'Multnomah', city: 'Portland' }
  test('matches', () => {
    assert.equal(evaluate({ jurisdiction: 'city', op: 'is', value: 'Portland' }, {}, undefined, OR), true)
  })
  test('definitively does not match — this is a legitimate false', () => {
    assert.equal(evaluate({ jurisdiction: 'state', op: 'is', value: 'Texas' }, {}, undefined, OR), false)
  })
  test('missing jurisdiction is unknown', () => {
    assert.equal(evaluate({ jurisdiction: 'city', op: 'is', value: 'Portland' }, {}, undefined, {}), 'unknown')
  })
  test('empty-string jurisdiction is unknown, not a failed match', () => {
    assert.equal(
      evaluate({ jurisdiction: 'city', op: 'is', value: 'Portland' }, {}, undefined, { city: '' }),
      'unknown',
    )
  })
  test('no jurisdiction supplied at all is unknown', () => {
    assert.equal(evaluate({ jurisdiction: 'state', op: 'is', value: 'Oregon' }, {}), 'unknown')
  })
})

describe('inventory clauses are unknown unless the caller can answer them', () => {
  test('no resolver supplied is unknown', () => {
    assert.equal(evaluate({ inventory: 'ehs' }, {}), 'unknown')
  })
  test('a resolver returning unknown stays unknown — migration 014 semantics', () => {
    assert.equal(evaluate({ inventory: 'ehs' }, {}, () => 'unknown'), 'unknown')
  })
  test('a resolver returning true or false is taken at its word', () => {
    assert.equal(evaluate({ inventory: 'psm' }, {}, () => true), true)
    assert.equal(evaluate({ inventory: 'psm' }, {}, () => false), false)
  })
  test('an unknown inventory inside an all_of does not clear the requirement', () => {
    assert.equal(evaluate({ all: [T, { inventory: 'tri' }] }, FACTS, () => 'unknown'), 'unknown')
  })
})

// ---------------------------------------------------------------------------
// DETERMINISM — CLAUDE.md §3.2
// ---------------------------------------------------------------------------

describe('determinism', () => {
  test('the same inputs give the same answer every time', () => {
    const e: Expression = { all: [T, { any: [F, U] }, { not: U }] }
    const first = ev(e)
    for (let i = 0; i < 100; i++) assert.equal(ev(e), first)
  })
  test('evaluation does not mutate the facts it was given', () => {
    const facts: Facts = { t: true, f: false }
    const before = JSON.stringify(facts)
    ev({ all: [T, F, U] }, facts)
    assert.equal(JSON.stringify(facts), before)
  })
})

// ---------------------------------------------------------------------------
// THE REAL ROW — Oregon sick time, read from the library on 12 Sep 2026
// ---------------------------------------------------------------------------

/**
 * One of exactly two live expressions that mix a company-scoped switch with a site-scoped
 * one, and the shape the resolution layer has to get right:
 *
 *   has_employees AND (employee_count >= 10 OR (site_employee_count >= 6 AND city = Portland))
 */
const OREGON_SICK_TIME: Expression = {
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

describe('Oregon sick time — the real expression', () => {
  const portland: Jurisdiction = { state: 'Oregon', city: 'Portland' }
  const salem: Jurisdiction = { state: 'Oregon', city: 'Salem' }

  test('12 employees anywhere in Oregon: applies on the company branch alone', () => {
    assert.equal(
      evaluate(OREGON_SICK_TIME, { has_employees: true, employee_count: 12 }, undefined, salem),
      true,
    )
  })
  test('7 employees, 6 of them at a Portland site: applies on the site branch', () => {
    assert.equal(
      evaluate(
        OREGON_SICK_TIME,
        { has_employees: true, employee_count: 7, site_employee_count: 6 },
        undefined,
        portland,
      ),
      true,
    )
  })
  test('7 employees, 6 at a SALEM site: does not apply — a real, evidenced false', () => {
    assert.equal(
      evaluate(
        OREGON_SICK_TIME,
        { has_employees: true, employee_count: 7, site_employee_count: 6 },
        undefined,
        salem,
      ),
      false,
    )
  })
  test('has employees, headcount unknown: UNDETERMINED, not cleared', () => {
    // The state a real customer is in on day one. company_switches is empty, so this is
    // what nearly every requirement will return on the first resolution run.
    assert.equal(evaluate(OREGON_SICK_TIME, { has_employees: true }, undefined, portland), 'unknown')
  })
  test('no employees at all: does not apply, and that is evidenced', () => {
    assert.equal(evaluate(OREGON_SICK_TIME, { has_employees: false }, undefined, portland), false)
  })
  test('nothing established at all: unknown', () => {
    assert.equal(evaluate(OREGON_SICK_TIME, {}, undefined, {}), 'unknown')
  })
})
