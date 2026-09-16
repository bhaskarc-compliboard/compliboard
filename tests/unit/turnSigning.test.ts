/**
 * SIGNED TURNS — the attacks, as tests.
 *
 * *** EVERY TEST HERE IS A NEGATIVE ONE, AND CHECK 14 APPLIES TO ALL OF THEM. *** A guard test
 * must FAIL when the guard is removed, and a probe that trips an EARLIER guard has tested the
 * earlier guard. So each attack below changes exactly ONE thing from a valid conversation, and
 * asserts on the REASON rather than on the fact that something threw (`DECISIONS.md` §81, §88).
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
process.env.TURN_SIGNING_SECRET ??= 'test-secret-that-is-long-enough-to-pass-the-check'
const { sealTurn, verifyTurns, BadConversation } = await import('../../lib/turnSigning.ts')
import type { PriorTurn, Frame } from '../../lib/gateContext.ts'

const CO = '11111111-1111-1111-1111-111111111111'
const TOPIC = '22222222-2222-2222-2222-222222222222'
const AZ: Frame = { jurisdiction: { state: 'Arizona', county: null, city: 'Phoenix' }, tense: 'hypothetical', subject: 'a facility' }

const turn = (n: number, value: string): PriorTurn => ({
  turn: n, frame: AZ,
  facts: [{ switch_id: 'employee_count', fact: 'employee_count', value, source: 'hypothetical' }],
})
const conversation = () => [turn(1, '12'), turn(2, '40'), turn(3, '40')].map(t => sealTurn(t, CO, TOPIC))
const reason = (fn: () => unknown): string => {
  try { fn(); return '(did not throw)' } catch (e) { return e instanceof BadConversation ? e.reason : `(${(e as Error).name})` }
}

describe('a conversation the server issued verifies', () => {
  test('three sealed turns round-trip', () => {
    const got = verifyTurns(conversation(), CO, TOPIC)
    assert.equal(got.length, 3)
    assert.equal(got[1].facts[0].value, '40')
  })
  test('ABSENT IS NOT FAILURE — undefined and [] are a first turn, not an error', () => {
    assert.deepEqual(verifyTurns(undefined, CO, TOPIC), [])
    assert.deepEqual(verifyTurns(null, CO, TOPIC), [])
    assert.deepEqual(verifyTurns([], CO, TOPIC), [])
  })
})

describe('forgery by AUTHORSHIP — the signature catches it', () => {
  test('editing a fact value invalidates the turn', () => {
    const c = conversation()
    c[1].turn.facts[0].value = '5000'
    assert.equal(reason(() => verifyTurns(c, CO, TOPIC)), 'a turn did not verify')
  })
  test('a wholly invented turn does not verify', () => {
    const c = conversation()
    c.push({ turn: turn(4, '1'), sig: 'deadbeef'.repeat(8) })
    assert.equal(reason(() => verifyTurns(c, CO, TOPIC)), 'a turn did not verify')
  })
  test('changing the FRAME invalidates it — tense is what makes a fact hypothetical', () => {
    const c = conversation()
    c[0].turn.frame = { ...AZ, tense: 'present' }
    assert.equal(reason(() => verifyTurns(c, CO, TOPIC)), 'a turn did not verify')
  })
  test('renumbering a turn invalidates it — `turn` is inside the MAC', () => {
    const c = conversation()
    c[2].turn.turn = 9
    assert.notEqual(reason(() => verifyTurns(c, CO, TOPIC)), '(did not throw)')
  })
})

describe('replay across a boundary — company and topic are INSIDE the MAC', () => {
  test('another company cannot use a stolen turn', () => {
    assert.equal(reason(() => verifyTurns(conversation(), '99999999-9999-9999-9999-999999999999', TOPIC)),
      'a turn did not verify')
  })
  test('a turn cannot be replayed into a different conversation', () => {
    assert.equal(reason(() => verifyTurns(conversation(), CO, '88888888-8888-8888-8888-888888888888')),
      'a turn did not verify')
  })
})

describe('forgery by OMISSION — the signature cannot catch it, contiguity can', () => {
  /**
   * *** THE ATTACK THE SPEC WAS MISSING. *** Keep "12 employees" from turn 1, drop turn 2 where it
   * became 40. EVERY REMAINING SIGNATURE IS VALID — the server issued both of them. Only the SET
   * is wrong. §9.1a.
   */
  test('dropping the turn where a correction happened is REFUSED', () => {
    const c = conversation()
    const gappy = [c[0], c[2]]                     // 1 and 3. Both genuine. 2 removed.
    assert.equal(reason(() => verifyTurns(gappy, CO, TOPIC)), 'turns are not contiguous')
  })
  test('and every turn in that set individually verifies — the signature is not what caught it', () => {
    const c = conversation()
    assert.equal(verifyTurns([c[0]], CO, TOPIC).length, 1, 'turn 1 alone is valid')
    // c[2] alone is turn 3, which is non-contiguous by itself — proving the check is on the SET.
    assert.equal(reason(() => verifyTurns([c[2]], CO, TOPIC)), 'turns are not contiguous')
  })
  test('reordering is refused', () => {
    const c = conversation()
    assert.equal(reason(() => verifyTurns([c[1], c[0], c[2]], CO, TOPIC)), 'turns are not contiguous')
  })
  test('duplicating a turn is refused', () => {
    const c = conversation()
    assert.equal(reason(() => verifyTurns([c[0], c[0], c[2]], CO, TOPIC)), 'turns are not contiguous')
  })
})

describe('TRUNCATION is accepted, deliberately', () => {
  /**
   * A client sending 1,2 when it received 3 passes. The server cannot know turn 3 existed, and a
   * MAC chain would not help — a truncation is a valid PREFIX. It is accepted because it is
   * indistinguishable from ordinary loss (a closed tab, a failed response), so refusing it would
   * refuse the honest case equally. §9.1a.
   */
  test('a valid prefix verifies, and this is the documented gap', () => {
    const c = conversation()
    assert.equal(verifyTurns([c[0], c[1]], CO, TOPIC).length, 2)
  })
})

describe('the secret is required', () => {
  test('a short or missing secret refuses to sign rather than signing with a default', async () => {
    const saved = process.env.TURN_SIGNING_SECRET
    process.env.TURN_SIGNING_SECRET = 'too-short'
    assert.throws(() => sealTurn(turn(1, '12'), CO, TOPIC), /TURN_SIGNING_SECRET/)
    process.env.TURN_SIGNING_SECRET = saved
  })
})
