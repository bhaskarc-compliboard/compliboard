/**
 * PREPARING AN ANSWER FOR THE SCREEN — DECISIONS.md §107.
 *
 * *** THE FIRST TWO CASES ARE THE SHAPES THE OWNER REPORTED SEEING, NOT SHAPES I CAPTURED. ***
 * Three re-runs of the same question did not reproduce either, so the mechanism below is a
 * HYPOTHESIS pinned by test rather than a defect observed in a captured run. The third case IS
 * from a captured run and is marked as such.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { displayLines, inlineParts } from '../../lib/answerDisplay.ts'

describe('displayLines — a missing break where two pieces of text meet', () => {
  // REPORTED: "...triggers the requirement.## Stormwater Permit", with the ## showing.
  test('a markdown heading that begins mid-line becomes its own line', () => {
    const out = displayLines('Outdoor storage triggers the requirement.## Stormwater Permit')
    assert.deepEqual(out, ['Outdoor storage triggers the requirement.', '## Stormwater Permit'])
  })

  test('and the heading still renders as a heading, not as literal ##', () => {
    const out = displayLines('…the requirement.## Stormwater Permit')
    assert.ok(out[1].startsWith('## '), 'the renderer keys on a leading "## "')
    // The predicate must key on a NON-HASH before the run: /\S#{1,3} / matches "## Heading"
    // itself, because \S eats the first hash. That assertion failed on correct output.
    assert.ok(!out.some((l) => /[^\s#]#{1,3}\s/.test(l)), 'no line may still carry a mid-line heading')
  })

  // REPORTED: a line starting with a lone colon under "No-Exposure Option".
  test('a line opening with punctuation joins the line above it', () => {
    assert.deepEqual(
      displayLines('You may qualify for the no-exposure option\n: if everything is under cover.'),
      ['You may qualify for the no-exposure option: if everything is under cover.'])
  })

  test('but a heading does NOT swallow the line below it', () => {
    const out = displayLines('## No-Exposure Option\n: Facilities may apply.')
    assert.deepEqual(out, ['## No-Exposure Option', ': Facilities may apply.'],
      'a colon under a heading stays put — welding it to the heading would be worse')
  })

  test('a bullet is not orphaned punctuation and survives', () => {
    assert.deepEqual(displayLines('Steps:\n- impervious pad\n• curbing'),
                     ['Steps:', '- impervious pad', '• curbing'])
  })

  // CAPTURED LIVE, 21 Sep: "**Stormwater permit**Because you have industrial activity…"
  test('a bold run welded to the sentence after it splits into heading + paragraph', () => {
    assert.deepEqual(displayLines('**Stormwater permit**Because you have industrial activity.'),
                     ['## Stormwater permit', 'Because you have industrial activity.'])
  })

  test('one line can carry a tail, a heading, and the sentence after it', () => {
    assert.deepEqual(displayLines('…is required.## Spill Containment'),
                     ['…is required.', '## Spill Containment'])
  })

  test('it is idempotent — running it on its own output changes nothing', () => {
    const once = displayLines('a.## B\n: c')
    assert.deepEqual(displayLines(once.join('\n')), once)
  })

  test('ordinary prose is untouched, blank lines included', () => {
    const t = 'One sentence.[1] Another.\n\n## Heading\n\nBody text.'
    assert.deepEqual(displayLines(t), t.split('\n'))
  })
})

describe('displayLines — a sentence boundary that lost its space', () => {
  // FOUND WHILE VERIFYING, not reported: "…Environmental Quality.You need an NPDES 1200-Z…".
  // The same shape appears in 2 of 3 earlier captured runs, so it recurs.
  test('a full stop welded to the next sentence gets its space back', () => {
    assert.deepEqual(
      displayLines('…administered by the Oregon Department of Environmental Quality.You need an NPDES 1200-Z permit.'),
      ['…administered by the Oregon Department of Environmental Quality. You need an NPDES 1200-Z permit.'])
  })

  test('a question mark and an exclamation mark too', () => {
    assert.deepEqual(displayLines('Do you?Yes. Really!No.'), ['Do you? Yes. Really! No.'])
  })

  // The guard that keeps it from mangling ordinary text.
  test('an abbreviation is left alone — the character before the stop must be lowercase or a digit', () => {
    assert.deepEqual(displayLines('Under U.S.Code and 40 CFR 112.'), ['Under U.S.Code and 40 CFR 112.'])
  })

  test('a decimal is not a sentence boundary', () => {
    assert.deepEqual(displayLines('Hold 1.5 times the volume.'), ['Hold 1.5 times the volume.'])
  })

  test('a space that is already there is not doubled', () => {
    assert.deepEqual(displayLines('One. Two.'), ['One. Two.'])
  })
})

describe('inlineParts — a marker is a thing, not three characters', () => {
  test('a line splits into text and markers, in order', () => {
    assert.deepEqual(inlineParts('You need coverage.[1] Storing drums qualifies.'), [
      { kind: 'text', text: 'You need coverage.' },
      { kind: 'marker', text: '[1]', n: 1 },
      { kind: 'text', text: ' Storing drums qualifies.' },
    ])
  })

  test('two markers in one line are both found', () => {
    assert.deepEqual(inlineParts('a[1]b[12]c').filter((p) => p.kind === 'marker').map((p) => p.n), [1, 12])
  })

  test('a bracketed number that is not a marker is left alone as text', () => {
    // `reassemble` only ever emits [digits]; anything else is the model's own prose.
    assert.deepEqual(inlineParts('see [a] and [1b]'), [{ kind: 'text', text: 'see [a] and [1b]' }])
  })

  test('a line with no markers is one text part', () => {
    assert.deepEqual(inlineParts('plain'), [{ kind: 'text', text: 'plain' }])
  })
})
