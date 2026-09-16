/**
 * SIGNED CONVERSATION TURNS — M1.2c.
 *
 * *** WHY SIGN AT ALL. *** §78 says a hypothetical fact is never stored, so the conversation lives
 * with the client. That raises the obvious question: what stops a client sending back a turn it
 * invented? A fact labelled `[stated_in_question]` that nobody stated would reach the gate as
 * established. `DECISIONS.md` §89.
 *
 * The server signs each turn as it issues one and refuses any it did not. **Nothing is stored** —
 * §78 is preserved exactly, the client still holds the conversation, and a forged turn does not
 * verify.
 *
 * *** AND A SIGNATURE PROVES ISSUANCE, NOT COMPLETENESS. *** Each turn is signed on its own, so a
 * client could send turns 1, 2 and 4 — dropping the one where a correction happened — and every
 * remaining turn would verify. That is forgery by OMISSION rather than by authorship, and it is
 * the more useful attack: keep "12 employees", drop the turn where it became 40.
 * `verifyTurns` therefore asserts contiguity as well as signatures. `GATE-HISTORY.md` §9.1a.
 *
 * *** WHAT IS NOT CAUGHT, AND IT IS DELIBERATE. *** Truncation — a client sending 1,2,3 when it
 * received 4 — passes, because the server cannot know turn 4 existed. A MAC chain would not fix
 * it either: a truncation is a valid PREFIX, and chains prevent reordering and insertion rather
 * than stopping early. Catching it needs server state. It is accepted because it is
 * **indistinguishable from ordinary loss** — a closed tab, a failed response — so refusing it
 * would refuse the honest case equally.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PriorTurn } from './gateContext.ts'

/** A turn as it crosses the wire. The client never constructs one; it echoes what it was given. */
export interface SealedTurn {
  turn: PriorTurn
  sig: string
}

export class BadConversation extends Error {
  // Declared and assigned explicitly rather than as a TypeScript parameter property:
  // `constructor(public readonly reason: string)` is not supported by Node's type stripping,
  // which is what runs the test suite. The same constraint that made `@/lib` imports
  // unusable here (DECISIONS.md §67) — the suite runs the real files, not a build of them.
  readonly reason: string

  constructor(reason: string) {
    super('We could not verify this conversation.')
    this.name = 'BadConversation'
    this.reason = reason
  }
}

/**
 * *** THE SECRET IS REQUIRED. A DEFAULT WOULD BE WORSE THAN NO SIGNATURE. ***
 *
 * A signature made with a known default proves nothing and READS AS VERIFIED, which is the worst
 * of both. `CLAUDE.md` §3.5 — never a literal in a code file; environment only.
 *
 * It is an EIGHTH credential on a rotation list of seven that is already overdue (`TODO.md` gate
 * item 3). It is the only one of the eight that has never leaked, and the way to keep that true
 * is to create it inside that rotation rather than early and forgotten. §89.
 */
function secret(): Buffer {
  const s = process.env.TURN_SIGNING_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'TURN_SIGNING_SECRET is missing or too short (32+ chars). Refusing to sign — a default ' +
      'secret is a signature that proves nothing and reads as verified.'
    )
  }
  return Buffer.from(s, 'utf8')
}

/**
 * The canonical form the MAC covers.
 *
 * *** `company` AND `topic` ARE INSIDE THE MAC, NOT CHECKED AFTERWARDS. *** A signature covering
 * only the facts is a token any company can replay into any conversation. Binding it to the
 * session's company means a stolen turn is useless to anybody else — the same property
 * `requireCompany()` gives every other route (`CLAUDE.md` §3.6).
 *
 * The QUESTION TEXT IS NOT SIGNED. Only claims reach the gate (§4), so only claims are signed; a
 * user may retype their question freely. And key order is fixed here rather than left to
 * `JSON.stringify` of a reassembled object, because a MAC over a differently-ordered object is a
 * different MAC.
 */
function canonical(turn: PriorTurn, companyId: string, topicId: string): string {
  return JSON.stringify({
    v: 1,
    company: companyId,
    topic: topicId,
    turn: turn.turn,
    frame: turn.frame,
    facts: turn.facts,
  })
}

export function sealTurn(turn: PriorTurn, companyId: string, topicId: string): SealedTurn {
  const sig = createHmac('sha256', secret()).update(canonical(turn, companyId, topicId)).digest('hex')
  return { turn, sig }
}

/** Constant-time, because a timing oracle on a MAC is how MACs are broken. */
function sigMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string' || given.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given, 'hex'))
  } catch {
    return false   // non-hex input
  }
}

/**
 * Verify every turn and the shape of the set.
 *
 * ABSENT IS NOT FAILURE. `undefined` and `[]` both mean "a first turn", which is how every
 * conversation starts — a scheme that cannot tell "no turns" from "bad turns" makes every first
 * turn an error (`GATE-HISTORY.md` §9.3).
 */
export function verifyTurns(
  sealed: unknown,
  companyId: string,
  topicId: string
): PriorTurn[] {
  if (sealed === undefined || sealed === null) return []
  if (!Array.isArray(sealed)) throw new BadConversation('turns is not an array')
  if (sealed.length === 0) return []

  const out: PriorTurn[] = []
  for (const s of sealed as SealedTurn[]) {
    if (!s || typeof s !== 'object' || !s.turn || typeof s.turn !== 'object') {
      throw new BadConversation('a turn is malformed')
    }
    const expected = createHmac('sha256', secret())
      .update(canonical(s.turn, companyId, topicId)).digest('hex')
    if (!sigMatches(expected, s.sig)) {
      // Deliberately does NOT say which turn or why. A verification error that narrates its
      // reasoning is a tool for finding the one field that is not covered.
      throw new BadConversation('a turn did not verify')
    }
    out.push(s.turn)
  }

  // *** CONTIGUITY. The check signatures cannot make. ***
  // Exactly 1..N, in order, no gaps and no repeats. Omission in the middle has no legitimate
  // counterpart — a client has no reason to hold turns 1, 2 and 4 and not 3 — so refusing it
  // costs nothing honest. §9.1a.
  for (let i = 0; i < out.length; i++) {
    if (out[i].turn !== i + 1) throw new BadConversation('turns are not contiguous')
  }
  return out
}
