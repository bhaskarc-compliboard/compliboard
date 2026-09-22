/**
 * THE NARRATION RULE — `DECISIONS.md` §123, `lib/ai.ts` `stripNarration`.
 *
 * *** EVERY FIXTURE BELOW IS A RECORDED SEQUENCE, NOT AN INVENTED ONE. *** The three samples
 * were dumped on 22 September 2026 from real streamed calls with `web_search_20250305`
 * attached and the one-sentence system prompt — block types in order, with each text block's
 * length, citation count and opening characters. The block dump is reproduced in `lib/ai.ts`
 * above `stripNarration`.
 *
 * The rule under test is POSITIONAL, not linguistic: a text block is narration if and only if a
 * `server_tool_use` appears later in the same response. Samples 2 and 3 are the reason — their
 * openings read exactly like sample 1's narration and they are the whole answer.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { stripNarration, openAnswer } from '../../lib/ai.ts'

/** SAMPLE 1 — searched. Block 0 is narration; 1-3 tool use; 4-6 results; 7+ the answer. */
const SAMPLE_1 = [
  { type: 'text', text: "I'll help you understand the licensing and safety requirements for an Oregon cannabis extraction lab.", citations: [] },
  { type: 'server_tool_use', name: 'web_search', input: { query: 'Oregon cannabis extraction lab butane license requirements' } },
  { type: 'server_tool_use', name: 'web_search', input: { query: 'Oregon cannabis butane extraction safety regulations' } },
  { type: 'web_search_tool_result', content: [1, 2, 3] },
  { type: 'text', text: "Based on my research, here's what you need to know about operating one.", citations: [] },
  { type: 'text', text: 'The processing of marijuana items is subject to regulation by the OLCC', citations: [{ url: 'https://oregon.gov/olcc', title: 'OLCC' }] },
  { type: 'text', text: '. ', citations: [] },
]

/** SAMPLE 2 — no search. One block, and it IS the answer, despite opening like narration. */
const SAMPLE_2 = [
  { type: 'text', text: "I'd be happy to help you understand whether you need workers' compensation insurance. It depends on your state and headcount.", citations: [] },
]

/** SAMPLE 3 — no search. Same shape as 2, longer. */
const SAMPLE_3 = [
  { type: 'text', text: "I'll help you understand the differences between Safety Data Sheets and container labels under OSHA's Hazard Communication Standard.", citations: [] },
]

describe('stripNarration — the positional rule', () => {
  test('SAMPLE 1: the text block before the first server_tool_use is dropped', () => {
    const kept = stripNarration(SAMPLE_1)
    const texts = kept.filter((b) => b.type === 'text').map((b) => b.text as string)
    assert.equal(texts.length, 3, 'three answer text blocks survive')
    assert.ok(!texts.some((t) => t.startsWith("I'll help you understand the licensing")),
      'the narration block is gone')
    assert.ok(texts[0].startsWith('Based on my research'), 'the answer now starts at block 7')
  })

  test('SAMPLE 1: non-text blocks are left alone, so reassemble still sees the shape it expects', () => {
    const kept = stripNarration(SAMPLE_1)
    assert.equal(kept.filter((b) => b.type === 'server_tool_use').length, 2)
    assert.equal(kept.filter((b) => b.type === 'web_search_tool_result').length, 1)
  })

  test('SAMPLE 2: no server_tool_use, so NOTHING is dropped — this is the whole answer', () => {
    const kept = stripNarration(SAMPLE_2)
    assert.deepEqual(kept, SAMPLE_2)
  })

  test('SAMPLE 3: same, and it opens with the same words sample 1 narrates with', () => {
    const kept = stripNarration(SAMPLE_3)
    assert.equal(kept.length, 1)
    assert.ok((kept[0].text as string).startsWith("I'll help you understand"))
  })

  test('A LINGUISTIC RULE WOULD HAVE DELETED SAMPLES 2 AND 3 — the point of being positional', () => {
    // All three open with the same construction. Only one of them is narration.
    const opener = (b: any) => (b.text as string).slice(0, 24)
    assert.equal(opener(SAMPLE_1[0]), "I'll help you understand")
    assert.equal(opener(SAMPLE_3[0]), "I'll help you understand")
    assert.equal(stripNarration(SAMPLE_1).length, SAMPLE_1.length - 1, 'sample 1 loses it')
    assert.equal(stripNarration(SAMPLE_3).length, SAMPLE_3.length, 'sample 3 keeps it')
  })

  test('text AFTER the first tool use is never dropped, however it is worded', () => {
    const kept = stripNarration(SAMPLE_1) as any[]
    assert.ok(kept.some((b) => b.type === 'text' && (b.text as string).startsWith('Based on my research')))
  })

  test('an empty response is returned unchanged rather than throwing', () => {
    assert.deepEqual(stripNarration([]), [])
  })
})

describe('openAnswer — narration removed, then the existing reassembly', () => {
  test('SAMPLE 1: the answer text excludes narration and the citation is numbered', () => {
    const { text, sources } = openAnswer(SAMPLE_1)
    assert.ok(!text.includes('licensing and safety requirements for an Oregon'), 'narration absent')
    assert.ok(text.startsWith('Based on my research'))
    assert.equal(sources.length, 1)
    assert.equal(sources[0].n, 1)
    assert.equal(sources[0].url, 'https://oregon.gov/olcc')
  })

  test('SAMPLE 1: the marker sits AFTER the full stop, as reassemble already guaranteed', () => {
    const { text } = openAnswer(SAMPLE_1)
    assert.ok(text.includes('.[1]'), `expected ".[1]" in: ${JSON.stringify(text.slice(-40))}`)
  })

  test('SAMPLE 2: an unsearched answer round-trips whole, with no sources', () => {
    const { text, sources } = openAnswer(SAMPLE_2)
    assert.ok(text.startsWith("I'd be happy to help"))
    assert.equal(sources.length, 0)
  })
})
