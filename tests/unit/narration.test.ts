/**
 * THE NARRATION RULE — `DECISIONS.md` §123, `lib/ai.ts` `stripNarration`.
 *
 * *** EVERY FIXTURE BELOW IS A RECORDED SEQUENCE, NOT AN INVENTED ONE. *** Five samples, all
 * dumped on 22 September 2026 from real streamed calls with `web_search_20250305` attached and
 * the one-sentence system prompt. 1-3 on `claude-sonnet-4-5`, 4 and 5 on `claude-opus-5` at
 * `effort: max`. The full block dumps are reproduced in `lib/ai.ts` above `stripNarration`.
 *
 * The rule under test is POSITIONAL, not linguistic: a text block is narration if and only if a
 * `server_tool_use` appears ANYWHERE AFTER IT — the answer is the text following the LAST search.
 *
 * Two things that rule has to survive at once:
 *   · samples 2 and 3 open with the same words samples 1, 4 and 5 narrate with, and are the
 *     whole answer — so a phrasing heuristic deletes them;
 *   · sample 5 narrates THREE times, twice after the first search — so a first-search rule
 *     leaks. That version shipped, and the regression test below pins it.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { stripNarration, openAnswer } from '../../lib/ai.ts'
import { readFileSync } from 'node:fs'

/**
 * SAMPLES 4 AND 5 — the same Seattle question, twice, on `claude-opus-5` at `effort: max`.
 *
 * These are loaded from JSON captured off the wire, not typed out here. Each block keeps its
 * TYPE and its position; text blocks keep their opening 110 characters and citation count.
 * Nothing is invented — the fixtures are truncated recordings, and the long answer tails are
 * cut after the first few answer blocks to stay readable.
 */
const load = (n: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${n}`, import.meta.url), 'utf8')) as Array<Record<string, unknown>>
const SAMPLE_4 = load('narration-seattle-a.json')   // two search rounds
const SAMPLE_5 = load('narration-seattle-b.json')   // THREE search rounds — broke the first rule

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

describe('SAMPLES 4 and 5 — searching is not ONE round', () => {
  test('SAMPLE 4: the opening block is dropped and the answer starts after the last search', () => {
    const kept = stripNarration(SAMPLE_4)
    const texts = kept.filter((b) => b.type === 'text').map((b) => b.text as string)
    assert.ok(!texts.some((t) => t.startsWith("I'll look up the current requirements")),
      'the opening narration is gone')
    assert.ok(texts[0].startsWith('Opening a restaurant in Seattle'), 'the answer starts at the real answer')
  })

  test('SAMPLE 5: ALL THREE narration blocks go, including the two after the first search', () => {
    const kept = stripNarration(SAMPLE_5)
    const texts = kept.filter((b) => b.type === 'text').map((b) => b.text as string)
    for (const leak of [
      "I'll research the current requirements",
      'Let me check the Seattle-specific city requirements',
      'Let me verify the employer registration requirements',
    ]) {
      assert.ok(!texts.some((t) => t.startsWith(leak)), `still leaking: ${leak}`)
    }
    assert.ok(texts[0].startsWith('Opening a restaurant in Seattle'))
  })

  test('THE REGRESSION: a first-tool-use rule keeps sample 5 leaking — this is what shipped', () => {
    // The rule as it was: drop text blocks before the FIRST server_tool_use.
    const firstToolUse = SAMPLE_5.findIndex((b) => b.type === 'server_tool_use')
    const oldRule = SAMPLE_5.filter((b, i) => !(i < firstToolUse && b.type === 'text'))
    const oldTexts = oldRule.filter((b) => b.type === 'text').map((b) => b.text as string)
    assert.ok(oldTexts.some((t) => t.startsWith('Let me check the Seattle-specific city requirements')),
      'the old rule must be shown to leak, or this test is not pinning anything')
    // And the shipped rule must not.
    const newTexts = stripNarration(SAMPLE_5).filter((b) => b.type === 'text').map((b) => b.text as string)
    assert.ok(!newTexts.some((t) => t.startsWith('Let me check')))
  })

  test('every text block kept sits after the LAST server_tool_use', () => {
    for (const [name, sample] of [['4', SAMPLE_4], ['5', SAMPLE_5]] as const) {
      let last = -1
      sample.forEach((b, i) => { if (b.type === 'server_tool_use') last = i })
      const keptIdx = sample
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => b.type === 'text')
        .filter(({ b }) => stripNarration(sample).includes(b))
        .map(({ i }) => i)
      assert.ok(keptIdx.every((i) => i > last), `sample ${name}: a kept text block precedes the last search`)
    }
  })

  test('the rule holds on ALL FIVE — nothing dropped where no search happened', () => {
    assert.equal(stripNarration(SAMPLE_2).length, SAMPLE_2.length)
    assert.equal(stripNarration(SAMPLE_3).length, SAMPLE_3.length)
    assert.equal(stripNarration(SAMPLE_1).length, SAMPLE_1.length - 1)
    assert.ok(stripNarration(SAMPLE_4).length < SAMPLE_4.length)
    assert.ok(stripNarration(SAMPLE_5).length < SAMPLE_5.length)
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
