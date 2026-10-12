/**
 * *** A BIG DROP IN THE REQUIREMENTS WAITS FOR A PERSON *** — the owner's decision **D2**,
 * 12 October 2026, out of E9 item 5 and N7 (`docs/reports/jobE-independent-review.md` §7).
 *
 * E9 measured the dead end on staging: a company that legitimately stops being a chemical
 * manufacturer (`industry: 'other'`, a real choice) gets **500 from `/api/obligations`, every time,
 * for ever** — 200 obligations open, nothing closed, and no button anywhere that can recompute the
 * list. Job E's W1 guard was doing its job; there was simply no way out of the state it protected.
 * And `/api/switches/answer` said **"Nothing has been changed"** after it had already saved the
 * person's answer, which is false, and a person told that answers the question again.
 *
 * Every customer sentence below is the owner's, word for word. The threshold is NOT a sentence: it
 * is internal and never shown (D2.2), which is why its edges are tested here and not described
 * anywhere a customer can read.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  HOLD_RULE, holdNote, industryWords, ANSWER_HELD, NO_LIBRARY_FOR_INDUSTRY, type Hold,
} from '../../lib/obligationHold.ts'
import { newestAnswerIsNewer, previousIndustryOf } from '../../lib/obligationWriter.ts'
import { renderEmptyState } from '../../lib/requirementsView.ts'

const hold = (o: Partial<Hold> = {}): Hold => ({
  held_at: '2026-10-12T19:00:00Z', open_total: 200, would_close: 200,
  industry: 'other', industry_has_library: false, answer_changed: true, ...o,
})

describe('*** how big is "a big drop" (D2.2 — internal, never shown) ***', () => {
  test('all of the open list holds', () => {
    assert.equal(HOLD_RULE.holds(200, 200), true)
    assert.equal(HOLD_RULE.holds(1, 1), true)
  })

  test('more than half holds; exactly half does not', () => {
    assert.equal(HOLD_RULE.holds(200, 101), true)
    assert.equal(HOLD_RULE.holds(200, 100), false,
      'half is an ordinary answer. Holding there would make the hold the common case rather than the alarming one.')
    assert.equal(HOLD_RULE.holds(2, 1), false)
    assert.equal(HOLD_RULE.holds(3, 2), true)
  })

  test('a handful off a long list never holds — the normal case of answering a question', () => {
    for (const n of [1, 2, 3, 5, 12]) assert.equal(HOLD_RULE.holds(200, n), false)
  })

  test('nothing open can never hold: there is nothing to lose', () => {
    assert.equal(HOLD_RULE.holds(0, 0), false)
    assert.equal(HOLD_RULE.holds(0, 5), false,
      'and a company whose list has never computed must still be computable — migration 022')
  })

  test('nothing leaving never holds either', () => {
    assert.equal(HOLD_RULE.holds(200, 0), false)
  })

  test('no percentage appears in anything a customer reads', () => {
    for (const s of [...holdNote(hold(), industryWords, 'chemical-manufacturing').lines,
                     ...holdNote(hold({ industry_has_library: true }), industryWords, null).lines,
                     ANSWER_HELD, NO_LIBRARY_FOR_INDUSTRY]) {
      assert.ok(!/%|per cent|percent|half|threshold/i.test(s), `this sentence leaks the rule: ${s}`)
    }
  })
})

describe('*** the note, word for word (D2.1) ***', () => {
  test('the industry changed to one we have no library for', () => {
    const n = holdNote(hold(), industryWords, 'chemical-manufacturing')
    assert.deepEqual(n.lines, [
      'Your industry is now Other. We don\'t have a list of requirements for that industry yet, '
      + 'so the 200 requirements from Chemical manufacturing would drop off. '
      + 'Have they stopped applying to you?',
    ])
    assert.deepEqual(n.buttons, [
      { label: 'Yes, they no longer apply', action: 'confirm' },
      { label: 'No, change my industry back', action: 'industry' },
    ])
  })

  test('otherwise: their own answers, with both numbers and no percentage', () => {
    const n = holdNote(hold({ industry_has_library: true, would_close: 120, open_total: 200 }),
      industryWords, null)
    assert.deepEqual(n.lines, [
      'Your latest answers would remove 120 of your 200 requirements. Have they stopped applying to you?',
    ])
    assert.deepEqual(n.buttons, [
      { label: 'Yes, they no longer apply', action: 'confirm' },
      { label: 'Keep them', action: 'keep' },
    ])
  })

  test('and if no answer of theirs changed, it is likely us — said last, and only then', () => {
    const theirs = holdNote(hold({ answer_changed: true }), industryWords, 'chemical-manufacturing')
    assert.equal(theirs.lines.length, 1,
      'their answer IS newer than the last recompute, so telling them nothing changed would be a lie')
    const ours = holdNote(hold({ answer_changed: false }), industryWords, 'chemical-manufacturing')
    assert.equal(ours.lines.length, 2)
    assert.equal(ours.lines[1],
      "If you didn't change anything, this is likely a problem on our side — please tell us.")
  })

  test('one requirement reads as one', () => {
    const n = holdNote(hold({ would_close: 1, open_total: 1 }), industryWords, 'chemical-manufacturing')
    assert.match(n.lines[0], /so the 1 requirement from/)
  })

  test('an old industry we cannot name is not guessed at', () => {
    const n = holdNote(hold(), industryWords, null)
    assert.match(n.lines[0], /would drop off/)
    assert.match(n.lines[0], /from your previous industry/)
  })

  test('the slug is never shown raw', () => {
    assert.equal(industryWords('chemical-manufacturing'), 'Chemical manufacturing')
    assert.equal(industryWords('other'), 'Other')
    assert.equal(industryWords(null), null)
    for (const line of holdNote(hold(), industryWords, 'chemical-manufacturing').lines) {
      assert.ok(!line.includes('chemical-manufacturing'), 'a hyphenated slug reads as a bug')
    }
  })

  test('never says "AI", never says a date is done or overdue', () => {
    for (const s of [...holdNote(hold(), industryWords, 'chemical-manufacturing').lines,
                     ...holdNote(hold({ industry_has_library: true, answer_changed: false }), industryWords, null).lines,
                     ANSWER_HELD, NO_LIBRARY_FOR_INDUSTRY]) {
      assert.ok(!/\bAI\b|artificial intelligence/i.test(s), s)
      assert.ok(!/\boverdue\b|\bnot done\b/i.test(s), s)
    }
  })
})

describe('*** the question page (D2.3): the answer WAS saved ***', () => {
  test('the sentence says what happened and where the rest is waiting', () => {
    assert.equal(ANSWER_HELD,
      'Your answer is saved. It would change your requirements a lot, so we\'ve held that for you '
      + 'to confirm on the Requirements page.')
  })

  test('the false "Nothing has been changed" is gone from the writer', () => {
    const w = readFileSync('lib/obligationWriter.ts', 'utf8')
    assert.ok(!/which is never a real answer\. Nothing has been changed\./.test(w),
      'the answer is saved BEFORE this runs, so "nothing has been changed" is false')
    assert.match(w, /Your requirements have not been changed\./)
  })

  test('the route returns it instead of a 500, and the page shows it', () => {
    assert.match(readFileSync('app/api/switches/answer/route.ts', 'utf8'), /held: ANSWER_HELD/)
    assert.match(readFileSync('app/company-information/page.tsx', 'utf8'),
      /setNotice\(typeof j\?\.held === 'string' \? j\.held : null\)/)
    // And through the other door into the same route.
    assert.match(readFileSync('app/api/to-confirm/route.ts', 'utf8'), /ok\?\.held \? \{ held: ok\.held \} : \{\}/)
  })
})

describe('*** an industry the library does not cover (D2.4) ***', () => {
  test('the gap is ours, and it is not a finding about them', () => {
    assert.equal(renderEmptyState('2026-10-12T19:00:00Z', false), NO_LIBRARY_FOR_INDUSTRY)
    assert.match(NO_LIBRARY_FOR_INDUSTRY, /That's a gap on our side — it doesn't mean none apply to you\./)
  })

  test('a covered industry whose answers resolve to nothing keeps the old, true sentence', () => {
    assert.match(renderEmptyState('2026-10-12T19:00:00Z', true),
      /found none that apply to you\. That is a result, not a gap/)
    assert.match(renderEmptyState('2026-10-12T19:00:00Z'), /That is a result, not a gap/)
  })

  test('never computed still outranks both — it is not a result at all', () => {
    assert.match(renderEmptyState(null, false), /We have not worked out your requirements yet/)
    assert.match(renderEmptyState(null, true), /We have not worked out your requirements yet/)
  })
})

describe('the two facts the note is built from', () => {
  test('"did anything of theirs change": newer than the last recompute', () => {
    const at = '2026-10-10T12:00:00Z'
    assert.equal(newestAnswerIsNewer([{ updated_at: '2026-10-11T09:00:00Z' }], at), true)
    assert.equal(newestAnswerIsNewer([{ updated_at: '2026-10-09T09:00:00Z' }], at), false)
    assert.equal(newestAnswerIsNewer([], at), false)
    assert.equal(newestAnswerIsNewer([{ updated_at: null }], at), false)
    // Never computed: the first computation of a company that already holds answers is not a
    // moment to tell them nothing of theirs changed.
    assert.equal(newestAnswerIsNewer([{ updated_at: '2020-01-01T00:00:00Z' }], null), true)
    assert.equal(newestAnswerIsNewer([], 'not a date'), true)
  })

  test('the old industry is read from the library rows behind the open requirements', () => {
    const library = [
      { id: 'r1', industries: ['chemical-manufacturing'] },
      { id: 'r2', industries: ['chemical-manufacturing'] },
      { id: 'r3', industries: ['cannabis-extraction'] },
      { id: 'r4', industries: null },
    ]
    assert.equal(previousIndustryOf(['r1', 'r2', 'r3'], library, 'other'), 'chemical-manufacturing')
    // The industry they are in NOW is never the answer to "what were they before".
    assert.equal(previousIndustryOf(['r1', 'r2'], library, 'chemical-manufacturing'), null)
    // A tie is not an answer: naming one of two would be a guess (§9.1).
    assert.equal(previousIndustryOf(['r1', 'r3'], library, 'other'), null)
    assert.equal(previousIndustryOf([], library, 'other'), null)
    assert.equal(previousIndustryOf(['r4'], library, 'other'), null)
  })
})
