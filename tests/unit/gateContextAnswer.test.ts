/**
 * THE THREE BLOCKS THE ANSWER CALL RECEIVES — M1.9, DECISIONS.md §103, §104.
 *
 * *** WHY THIS FILE EXISTS. *** The routing rule was written, a worked example was produced BY
 * HAND, and the example agreed with the intent. Running the real renderer disagreed with both
 * (§104). These tests pin the two things that disagreement exposed.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { splitForAnswer, businessFactsBlock, scenarioBlock, jurisdictionLine,
         type SwitchScope, type KnownFact, type Frame, type PriorTurn } from '../../lib/gateContext.ts'

const scopeOf: Record<string, SwitchScope> = {
  business_type: 'company', employee_count: 'company', has_employees: 'company',
  confined_spaces_present: 'site', entity_state: 'site', site_employee_count: 'site',
}
const hypoFrame: Frame = { jurisdiction: { state: 'Arizona', county: null, city: null },
                           tense: 'hypothetical', subject: 'a solvent blending facility' }
const f = (switch_id: string | null, fact: string, value: string, source: KnownFact['source']): KnownFact =>
  ({ switch_id, fact, value, source })

describe('splitForAnswer — the frame routes, not the label', () => {
  // The measurement that forced this: in ONE conversation, `entity_state = Arizona` came back
  // `stated_in_question` on turn 1 and `hypothetical` on turn 2. Routing on the label would put
  // the same fact in different blocks on consecutive turns.
  test('a fact stated in a hypothetical turn goes to the scenario whatever it is TAGGED', () => {
    const turn: PriorTurn = { turn: 1, frame: hypoFrame, facts: [
      f('entity_state', 'State the site is in', 'Arizona', 'stated_in_question'),   // NOT tagged hypothetical
    ]}
    const ctx = splitForAnswer([f('entity_state','State the site is in','Arizona','stated_in_question')],
                               [turn], hypoFrame, scopeOf)
    assert.equal(ctx.scenario.length, 1)
    assert.equal(ctx.business.length, 0)
    assert.equal(ctx.scenario[0].scope, 'site')
  })

  // *** THE REGRESSION. *** Routing on the key alone moved the BUSINESS'S OWN fact into the
  // scenario whenever the scenario mentioned the same switch — the business lost the fact and the
  // scenario listed `false` beside `true`.
  test("an ESTABLISHED business fact never migrates to the scenario, even when the scenario names the same switch", () => {
    const turn: PriorTurn = { turn: 1, frame: hypoFrame, facts: [
      f('confined_spaces_present', 'Permit-required confined spaces', 'true', 'hypothetical'),
    ]}
    const known = [
      f('confined_spaces_present', 'Permit-required confined spaces', 'false', 'user_set'),   // the business
      f('confined_spaces_present', 'Permit-required confined spaces', 'true',  'hypothetical'), // the scenario
    ]
    const ctx = splitForAnswer(known, [turn], hypoFrame, scopeOf)
    assert.deepEqual(ctx.business.map((b) => b.value), ['false'],
      'the business keeps its own answer')
    assert.deepEqual(ctx.scenario.map((s) => s.value), ['true'],
      'the scenario carries only what was stated about it')
  })

  test('with a present frame and no hypothetical turn there is no scenario at all', () => {
    const present: Frame = { jurisdiction: { state: 'Oregon', county: null, city: null }, tense: 'present', subject: null }
    const ctx = splitForAnswer([f('has_employees','Employs anyone','true','user_set')], [], present, scopeOf)
    assert.equal(ctx.scenario.length, 0)
    assert.equal(scenarioBlock(ctx.scenario, present, ctx.business), '')
  })
})

describe('scenarioBlock — site facts govern, company facts add', () => {
  const turn: PriorTurn = { turn: 1, frame: hypoFrame, facts: [
    f('site_employee_count','Employees at this site','12','hypothetical'),
    f('business_type','What the business does with chemicals','blend','hypothetical'),
  ]}
  test('site and company facts are rendered under DIFFERENT instructions', () => {
    const ctx = splitForAnswer(turn.facts, [turn], hypoFrame, scopeOf)
    const b = scenarioBlock(ctx.scenario, hypoFrame, [])
    assert.match(b, /ABOUT THE NEW SITE[\s\S]*these govern/)
    assert.match(b, /ABOUT THE BUSINESS AS A WHOLE[\s\S]*add to what is true of it/)
  })

  // The case "do not reconcile the two" would have suppressed: 47 + 12 = 59 crosses FMLA at 50.
  test('a per-site number plus the enterprise-wide counterpart produces the COMBINED figure', () => {
    const ctx = splitForAnswer(turn.facts, [turn], hypoFrame, scopeOf)
    const business = [f('employee_count','Employees, enterprise-wide','47','user_set')]
    const b = scenarioBlock(ctx.scenario, hypoFrame, business)
    assert.match(b, /COMBINED FIGURE MATTERS/)
    assert.match(b, /total to 59/)
  })

  test('and says nothing about a combined figure when the business has no such number on file', () => {
    const ctx = splitForAnswer(turn.facts, [turn], hypoFrame, scopeOf)
    assert.doesNotMatch(scenarioBlock(ctx.scenario, hypoFrame, []), /COMBINED FIGURE/)
  })
})

describe('jurisdictionLine — the answer is written for the QUESTION jurisdiction', () => {
  test('a hypothetical elsewhere names the scenario state and refuses the business state', () => {
    const l = jurisdictionLine(hypoFrame, 'Oregon')
    assert.match(l, /Answer for Arizona/)
    assert.match(l, /do not answer for Oregon/)
  })
  test('no jurisdiction in the frame asks rather than picking one', () => {
    const l = jurisdictionLine({ jurisdiction: { state: null, county: null, city: null }, tense: 'present', subject: null }, 'Oregon')
    assert.match(l, /does not name a place/)
  })
})

describe('businessFactsBlock', () => {
  test('renders provenance in English, never the enum', () => {
    const b = businessFactsBlock([f(null,'worksite state','Oregon','ai_from_profile')])
    assert.match(b, /\[from their profile\]/)
    assert.doesNotMatch(b, /ai_from_profile/)
  })
  test('empty in, empty out — no heading with nothing under it', () => {
    assert.equal(businessFactsBlock([]), '')
  })
})
