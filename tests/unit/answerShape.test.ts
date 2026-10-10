/**
 * S1 and A7 — AN ANSWER THAT PARSED IS NOT AN ANSWER THAT FITS (root R4, Job E2).
 *
 * *** MADE TO FAIL ON THE OLD CODE FIRST. *** The first group runs the real `extractJsonText`
 * against a reply whose narration carries a citation marker, and `oldGuard` is the shipped
 * `if (!obj)` copied exactly, showing it letting `[1]` through as an audit answer.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractJsonText } from '../../lib/ai.ts'
import { answerWith } from '../../lib/answerShape.ts'

/** The four fields an agency audit's shaper reads, and the one a checklist section's does. */
const AGENCY = ['findings', 'dates', 'contradictions', 'expected_not_seen'] as const
const TEMPLATE = ['lines'] as const

/** `lib/auditRun.ts` as it shipped: a parse failure was the only thing it refused. */
function oldGuard(raw: string): 'fail' | 'SHAPE IT' {
  let obj: Record<string, unknown> | null = null
  try { obj = JSON.parse(extractJsonText(raw)) as Record<string, unknown> } catch { obj = null }
  return obj ? 'SHAPE IT' : 'fail'
}

describe('*** S1: the citation marker in the model\'s own narration ***', () => {
  // What a search-enabled audit reply actually looks like: a sentence, cited, then the JSON.
  const cited = `I'll check the permit's conditions against what the company holds.[1]

{"findings": [{"title": "No written hazard communication programme", "word": "nothing_on_file"}],
 "dates": [], "contradictions": [], "expected_not_seen": []}`

  test('the OLD extractJsonText returned the marker, and JSON.parse SUCCEEDED on it', () => {
    // The shipped scan took the first `[` or `{`, whichever came first. `[1]` came first.
    const firstOpener = Math.min(
      ...[cited.indexOf('{'), cited.indexOf('[')].filter((i) => i >= 0))
    assert.equal(cited[firstOpener], '[', 'the marker is the first opener — that is the whole bug')
    assert.deepEqual(JSON.parse('[1]'), [1], 'and this is why nothing threw')
  })

  test('*** the old guard called it an answer and went on to shape it ***', () => {
    // `oldGuard` uses today's `extractJsonText`, which no longer returns the marker — so the proof
    // of the old behaviour is the shape check on the value the old extractor produced.
    assert.equal(oldGuard('[1]'), 'SHAPE IT',
      'an array holding the number 1 passed `if (!obj)`, found no fields, and the section was '
      + 'saved done with zero findings')
  })

  test('extractJsonText now skips the marker and returns the real object', () => {
    const out = JSON.parse(extractJsonText(cited)) as Record<string, unknown>
    assert.ok(Array.isArray(out.findings))
    assert.equal((out.findings as unknown[]).length, 1)
  })

  test('two markers run together are skipped too', () => {
    const out = JSON.parse(extractJsonText('As the permit says.[1][2]\n\n{"lines": [{"ref": "1.1"}]}'))
    assert.ok(Array.isArray((out as Record<string, unknown>).lines))
  })

  test('a comma-joined marker is skipped', () => {
    const out = JSON.parse(extractJsonText('Both sources agree.[1, 2]\n{"findings": []}'))
    assert.deepEqual((out as Record<string, unknown>).findings, [])
  })

  test('and the shape check refuses it even if it ever gets through again', () => {
    const r = answerWith([1], AGENCY)
    assert.equal(r.ok, false)
    assert.match(!r.ok ? r.why : '', /came back as a list, not as an object/)
  })
})

describe('S1: and a legitimate `[1]` INSIDE the answer is untouched', () => {
  // The reason the markers are skipped rather than stripped: `"sources": [1]` is a real field in
  // this product's own JSON shapes and is exactly the same characters. `stripMarkers` over the
  // whole reply would have deleted it.
  test('a sources array of one number survives', () => {
    const out = JSON.parse(extractJsonText('{"situation": "x", "sources": [1]}')) as Record<string, unknown>
    assert.deepEqual(out.sources, [1])
  })

  test('an answer that genuinely IS an array of objects still comes back whole', () => {
    // The handbook outline asks for exactly this shape.
    const out = JSON.parse(extractJsonText('[{"title": "1 Welcome"}, {"title": "2 Pay"}]')) as unknown[]
    assert.equal(out.length, 2)
  })

  test('narration before an array of objects does not break it', () => {
    const out = JSON.parse(extractJsonText('Here is the outline.\n[{"title": "1 Welcome"}]')) as unknown[]
    assert.equal(out.length, 1)
  })

  test('the stray-closer case the balanced scan was written for still works', () => {
    const out = JSON.parse(extractJsonText('{"status": "current", "could_not_read": {"reason": null}}\n  }\n}'))
    assert.equal((out as Record<string, unknown>).status, 'current')
  })

  test('a `}` inside a string cannot close the object', () => {
    const out = JSON.parse(extractJsonText('{"way_forward": "Use the } form", "status": "current"}'))
    assert.equal((out as Record<string, unknown>).status, 'current')
  })
})

describe('*** A7: valid JSON of the wrong shape ***', () => {
  test('a WRAPPED object is refused, and the reason names what it carried', () => {
    const r = answerWith({ result: { findings: [{ title: 'x' }] } }, AGENCY)
    assert.equal(r.ok, false)
    assert.match(!r.ok ? r.why : '', /carried none of the fields asked for/)
    assert.match(!r.ok ? r.why : '', /it carried "result"/, 'unguessable without it')
  })

  test('a RENAMED key is refused', () => {
    const r = answerWith({ issues: [{ title: 'x' }], notes: 'y' }, AGENCY)
    assert.equal(r.ok, false)
    assert.match(!r.ok ? r.why : '', /"issues", "notes"/)
  })

  test('a bare [] is refused — it is not an object', () => {
    assert.equal(answerWith([], AGENCY).ok, false)
  })

  test('null and a string are refused, each named', () => {
    assert.match(!answerWith(null, AGENCY).ok ? (answerWith(null, AGENCY) as { why: string }).why : '', /as null/)
    assert.match(!answerWith('ok', AGENCY).ok ? (answerWith('ok', AGENCY) as { why: string }).why : '', /as a string/)
  })

  test('an empty object is refused, and says it carried nothing at all', () => {
    const r = answerWith({}, AGENCY)
    assert.equal(r.ok, false)
    assert.match(!r.ok ? r.why : '', /it carried nothing at all/)
  })

  test('*** ONE of the fields is enough — a real answer omits what it did not find ***', () => {
    // Demanding every key would fail good answers: an audit that found no contradictions
    // legitimately leaves the key out. Carrying NONE of several is a different document.
    const r = answerWith({ findings: [] }, AGENCY)
    assert.equal(r.ok, true)
    assert.deepEqual(r.ok ? r.obj.findings : null, [])
  })

  test('a checklist answer is checked against its OWN field', () => {
    assert.equal(answerWith({ lines: [] }, TEMPLATE).ok, true)
    assert.equal(answerWith({ findings: [] }, TEMPLATE).ok, false,
      'an agency answer where a checklist one was asked for is the wrong document')
  })

  test('it does not unwrap, rename or repair — the raw text is kept and the section fails', () => {
    const r = answerWith({ result: { findings: [] } }, AGENCY)
    assert.equal(r.ok, false, 'a guess at what the model meant is a quiet rewrite of a regulatory answer')
  })
})

describe('A7: and lib/auditRun.ts goes through it', () => {
  const code = readFileSync('lib/auditRun.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('the fields come from the shaper that will read them, so the two cannot drift', () => {
    assert.match(code, /const FIELDS = isTemplate \? \(\['lines'\] as const\) : KINDS\.map\(\(k\) => k\.field\)/)
  })

  test('the parse goes through answerWith, and the reason reaches the section', () => {
    assert.match(code, /answerWith\(JSON\.parse\(extractJsonText\(raw\)\), FIELDS\)/)
    assert.match(code, /\$\{shapeWhy\}/)
  })

  test('the raw text is still kept on the row when the shape is refused', () => {
    const branch = code.slice(code.indexOf('if (!obj) {'), code.indexOf('const shaped = isTemplate'))
    assert.match(branch, /raw_text: raw\.slice\(0, 20000\)/)
    assert.match(branch, /json_parsed: false/)
  })
})
