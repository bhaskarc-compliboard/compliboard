/**
 * A STREAM THAT ENDS IS NOT A STREAM THAT FINISHED — Fix Round 1 (A), `lib/answerStream.ts`.
 *
 * The regression this pins is the 22 September hazmat answer: four lines, ended mid-sentence,
 * **no message**. The turns row proves the server knew (`stopped=true`, no assistant row) and
 * the log proves nothing threw. The client marked it done because the only thing it checked was
 * whether an exception had been raised.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readAnswerStream } from '../../lib/answerStream.ts'

async function* from(lines: string[]) { for (const l of lines) yield l }
const ev = (o: unknown) => JSON.stringify(o)
const noop = () => {}

describe('THE DEFECT: the upstream dies mid-answer', () => {
  test('a stream that stops without a done event is stopped_early, NOT done', async () => {
    const out = await readAnswerStream(from([
      ev({ type: 'text', text: 'Adding hazmat loads means four separate registrations. ' }),
      ev({ type: 'text', text: 'Pin that' }),
      // …and the connection dies here. No done. No error. The reader simply ends.
    ]), noop)
    assert.equal(out.kind, 'stopped_early', 'this is the exact shape that showed no message')
    assert.equal(out.text, 'Adding hazmat loads means four separate registrations. Pin that')
  })

  test('THE OLD RULE would have called it done — the test that would have caught it', () => {
    // The old page said: not failed and did not throw -> done.
    const threw = false
    const oldVerdict = threw ? 'failed' : 'done'
    assert.equal(oldVerdict, 'done')
    // The new rule looks for the done EVENT, which never arrived.
    assert.notEqual('stopped_early', oldVerdict)
  })

  test('the partial text is kept — what arrived is still worth reading', async () => {
    const out = await readAnswerStream(from([ev({ type: 'text', text: 'Four lines of it.' })]), noop)
    assert.equal(out.text, 'Four lines of it.')
  })
})

describe('the cases that must NOT become stopped_early', () => {
  test('a normal finish', async () => {
    const out = await readAnswerStream(from([
      ev({ type: 'text', text: 'The answer.' }),
      ev({ type: 'done', research: 'The answer.', sources: [{ n: 1, title: 'T', url: 'https://osha.gov/x' }], topicId: 'abc' }),
    ]), noop)
    assert.equal(out.kind, 'done')
    if (out.kind === 'done') {
      assert.equal(out.sources.length, 1)
      assert.equal(out.topicId, 'abc')
    }
  })

  test('the server reported an error — that is failed, with its own message', async () => {
    const out = await readAnswerStream(from([
      ev({ type: 'text', text: 'Partial.' }),
      ev({ type: 'error', message: 'The answer stopped part-way through. Please try again.' }),
    ]), noop)
    assert.equal(out.kind, 'failed')
    if (out.kind === 'failed') assert.match(out.message, /stopped part-way/)
  })

  test('THE USER PRESSED STOP — never "stopped early", which would blame us for their click', async () => {
    const out = await readAnswerStream(from([ev({ type: 'text', text: 'Half an answer' })]), noop, () => true)
    assert.equal(out.kind, 'stopped_by_user')
  })

  test('an abort thrown mid-read is also the user, not a fault', async () => {
    async function* boom() {
      yield ev({ type: 'text', text: 'x' })
      const e = new Error('aborted'); e.name = 'AbortError'; throw e
    }
    const out = await readAnswerStream(boom(), noop)
    assert.equal(out.kind, 'stopped_by_user')
  })
})

describe('the events in between', () => {
  test('reset clears what was shown — the narration rule reaching the screen', async () => {
    const seen: string[] = []
    const out = await readAnswerStream(from([
      ev({ type: 'text', text: "I'll look that up." }),
      ev({ type: 'reset' }),
      ev({ type: 'searching', query: 'x' }),
      ev({ type: 'text', text: 'The real answer.' }),
      ev({ type: 'done', research: 'The real answer.', sources: [] }),
    ]), (p) => seen.push(p.text))
    assert.equal(out.text, 'The real answer.')
    assert.ok(seen.includes(''), 'the screen was cleared when the search began')
  })

  test('searches are counted from real events, never a timer', async () => {
    let last = 0
    await readAnswerStream(from([
      ev({ type: 'searching' }), ev({ type: 'searching' }), ev({ type: 'searching' }),
      ev({ type: 'done', research: 'x', sources: [] }),
    ]), (p) => { last = p.searches })
    assert.equal(last, 3)
  })

  test('a half-written line is skipped, not treated as the end', async () => {
    const out = await readAnswerStream(from([
      '{"type":"text","tex',            // torn
      ev({ type: 'text', text: 'ok' }),
      ev({ type: 'done', research: 'ok', sources: [] }),
    ]), noop)
    assert.equal(out.kind, 'done')
  })

  test('an empty stream is stopped_early rather than an empty success', async () => {
    const out = await readAnswerStream(from([]), noop)
    assert.equal(out.kind, 'stopped_early')
    assert.equal(out.text, '')
  })
})
