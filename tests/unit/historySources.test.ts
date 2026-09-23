/**
 * HISTORY CARRIES ITS SOURCES — Fix Round 1 (C), `lib/historySources.ts`.
 *
 * The regression these pin is the 23 September third turn that said its own citations had not
 * been retrieved. The markers were real; the list behind them was missing from the context.
 * What is asserted here is the shape the model must be able to read: **every marker in the
 * answer has a line under it naming the source and its URL.**
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { appendSources } from '../../lib/historySources.ts'

const S = [
  { n: 1, title: 'Hazard Communication Standard', url: 'https://www.osha.gov/hazcom' },
  { n: 2, title: 'FMCSA Hazardous Materials Registration', url: 'https://www.fmcsa.dot.gov/hazmat' },
]

describe('the sources come back with the answer', () => {
  test('every marker in the text has a line naming its source and URL', () => {
    const answer = 'An SDS is required [1] and carriers must register [2].'
    const out = appendSources(answer, S)
    for (const s of S) {
      assert.ok(out.includes(`[${s.n}] ${s.title} — ${s.url}`), `no line for marker ${s.n}`)
    }
  })

  test('the answer itself is not altered — only appended to', () => {
    const answer = 'An SDS is required [1].'
    assert.ok(appendSources(answer, S).startsWith(answer))
  })

  test('the heading names the list and claims NOTHING about where it came from', () => {
    // Measured, same sequence both ways: "Sources retrieved by web search while writing this
    // answer" made the third turn deny categorically — "I did not run any searches before those
    // two answers" — because history is replayed as plain text with no tool-use blocks, so the
    // claim sits inside a turn the model can inspect and disown. The neutral heading hedged
    // instead of denying. This pins the weaker wording deliberately; see lib/historySources.ts.
    const out = appendSources('x [1]', S)
    assert.match(out, /\n\nSources cited in this answer:\n/)
    assert.ok(!/retrieved|verified|web search/i.test(out.split('\n')[2]), 'the heading claims provenance')
  })
})

describe('no sources is not the same as an empty list', () => {
  test('an answer with no sources comes back byte-identical', () => {
    const answer = 'No search was needed for this one.'
    assert.equal(appendSources(answer, []), answer)
    assert.equal(appendSources(answer, null), answer)
    assert.equal(appendSources(answer, undefined), answer)
  })

  test('an empty heading is never written — it would assert the answer had none', () => {
    assert.ok(!appendSources('x', []).includes('Sources cited'))
  })
})

describe('the rows are what a database returns, not what a type promises', () => {
  test('a source with no URL is dropped — a marker pointing at nothing is the original bug', () => {
    const out = appendSources('a [1] b [2]', [
      S[0],
      { n: 2, title: 'Broken', url: '' },
    ])
    assert.ok(out.includes('[1] Hazard Communication Standard'))
    assert.ok(!out.includes('Broken'))
  })

  test('a missing title falls back to the URL rather than printing an empty name', () => {
    const out = appendSources('a [1]', [{ n: 1, title: '', url: 'https://www.epa.gov/rcra' }])
    assert.ok(out.includes('[1] https://www.epa.gov/rcra — https://www.epa.gov/rcra'))
  })

  test('nulls in the array do not throw — turns.sources is jsonb, not a guarantee', () => {
    const rows = [null, S[0]] as unknown as typeof S
    assert.ok(appendSources('a [1]', rows).includes('[1] Hazard Communication'))
  })
})
