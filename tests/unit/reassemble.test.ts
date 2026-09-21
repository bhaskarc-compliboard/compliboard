/**
 * REASSEMBLING A WEB-SEARCH ANSWER — DECISIONS.md §106.
 *
 * *** THESE BLOCKS ARE A REAL RESPONSE, NOT AN INVENTION. *** Dumped from the API on 21 Sep for
 * the question that produced the broken formatting. The shape is the whole point: block 7 ends
 * mid-sentence carrying a citation, and block 8 is ". " — joined with "\n" that is the orphaned
 * full stop a customer saw. §104: render the example from code, and pin it with the real data.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { reassemble } from '../../lib/ai.ts'

const DEQ = 'https://www.oregon.gov/deq/wq/wqpermits/Pages/Stormwater-Industrial.aspx'
const cite = (url: string, title: string) => ({ type: 'web_search_result_location', url, title, cited_text: '…' })

describe('reassemble — prose is continuous, citations become footnotes', () => {
  test('adjacent blocks join with NOTHING, so a split sentence reads as one sentence', () => {
    const { text } = reassemble([
      { type: 'text', text: "Oregon DEQ's current 1200-Z ", citations: [] },
      { type: 'text', text: 'took effect July 1, 2026', citations: [cite(DEQ, 'DEQ')] },
      { type: 'text', text: '. ', citations: [] },
    ])
    assert.doesNotMatch(text, /\n/, 'no break may come from a block boundary')
    assert.match(text, /current 1200-Z took effect July 1, 2026\.\[1\]/)
  })

  test('the marker sits AFTER the punctuation, the way a footnote does', () => {
    const { text } = reassemble([
      { type: 'text', text: 'the permit was reissued', citations: [cite(DEQ, 'DEQ')] },
      { type: 'text', text: '. Covered facilities', citations: [] },
    ])
    assert.match(text, /reissued\.\[1\] Covered/)
    assert.doesNotMatch(text, /reissued\[1\]\./)
  })

  test('a paragraph break survives, because it is the MODEL\'s own text', () => {
    const { text } = reassemble([
      { type: 'text', text: 'One.', citations: [] },
      { type: 'text', text: '\n\n**Next.**', citations: [] },
    ])
    assert.match(text, /One\.\n\n\*\*Next\.\*\*/)
  })

  test('the same source cited twice gets ONE number', () => {
    const { text, sources } = reassemble([
      { type: 'text', text: 'first claim', citations: [cite(DEQ, 'DEQ')] },
      { type: 'text', text: ' and second claim', citations: [cite(DEQ, 'DEQ')] },
    ])
    assert.equal(sources.length, 1)
    assert.deepEqual(sources.map((s) => s.n), [1])
    assert.equal((text.match(/\[1\]/g) ?? []).length, 2, 'cited twice, numbered once')
  })

  test('two different sources are numbered in first-seen order', () => {
    const { sources } = reassemble([
      { type: 'text', text: 'a', citations: [cite('https://b.example', 'B')] },
      { type: 'text', text: 'b', citations: [cite('https://a.example', 'A')] },
    ])
    assert.deepEqual(sources, [
      { n: 1, title: 'B', url: 'https://b.example' },
      { n: 2, title: 'A', url: 'https://a.example' },
    ])
  })

  test('non-text blocks are dropped and no answer means no sources', () => {
    const { text, sources } = reassemble([
      { type: 'thinking', thinking: 'hidden' },
      { type: 'server_tool_use', name: 'web_search' },
      { type: 'web_search_tool_result', content: [] },
    ])
    assert.equal(text, '')
    assert.deepEqual(sources, [])
  })

  test('a citation with no url is ignored rather than numbered', () => {
    const { text, sources } = reassemble([
      { type: 'text', text: 'claim', citations: [{ type: 'web_search_result_location', title: 'no url' }] },
    ])
    assert.equal(text, 'claim')
    assert.equal(sources.length, 0)
  })
})
