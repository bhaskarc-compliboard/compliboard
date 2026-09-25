/**
 * PULLING THE JSON OUT OF A REPLY — the balanced-brace scan, Documents Run 2b.
 *
 * *** EVERY INPUT HERE IS A REAL MODEL RESPONSE, COPIED VERBATIM. *** Nothing is typed by hand
 * and nothing is trimmed: `tests/fixtures/json-extraction/` holds the raw text exactly as it
 * came back and exactly as it was stored on the scan row. `HOW-WE-BUILD.md` §104 — render the
 * example from code, and pin it with the real data.
 *
 * WHAT BROKE. `extractJsonText` used to take everything from the first opener to the LAST
 * closer in the string. That is correct whenever the model's braces balance, and wrong the
 * moment they do not — and they fail the same way every time: one `}` too many, after the
 * object is already complete.
 *
 *     "could_not_read": { "reason": null, "way_forward": null }
 *       }
 *     }
 *
 * `lastIndexOf('}')` swept the stray brace in, `JSON.parse` refused the lot, and a complete
 * reading — every top-level key present, status, gaps, facts, the lot — was discarded and
 * still charged for. Five of eighteen answers in Documents Run 2, and both of the Run 1
 * storm_water answers before that.
 *
 * The five `.failed.txt` files from Run 2 and the two from Run 1 are those answers. The three
 * `.parsed.txt` files are answers that were fine all along, and they are here to prove the fix
 * changed nothing for them — the assertion is byte-identity of the extracted slice, not merely
 * that they still parse.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractJsonText } from '../../lib/ai.ts'
import { SCAN_JSON_SCHEMA } from '../../prompts/document-scan.ts'

const DIR = 'tests/fixtures/json-extraction'
const raw = (name: string) => readFileSync(`${DIR}/${name}`, 'utf8')

/** Every top-level key of the document-scan contract, as `prompts/document-scan.ts` asks for it. */
const SCAN_KEYS = [
  'identity', 'summary', 'status', 'significant_date', 'significant_date_kind', 'freshness_note',
  'gaps', 'conditions', 'deadlines', 'facts', 'version_of', 'expected_missing',
  'confidence_notes', 'could_not_read',
]

function parsesToAScan(file: string) {
  const text = extractJsonText(raw(file))
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch (e) {
    assert.fail(`${file} still does not parse: ${(e as Error).message}`)
  }
  assert.equal(typeof parsed, 'object')
  assert.ok(!Array.isArray(parsed), 'a scan is an object, not an array')
  for (const k of SCAN_KEYS) {
    assert.ok(k in parsed, `${file}: top-level key "${k}" is missing — the answer was not recovered whole`)
  }
  return parsed
}

describe('extractJsonText — the five answers Documents Run 2 threw away', () => {
  test('05-sds-supplier run 1 — one extra closing brace, the SDS reading recovered whole', () => {
    const scan = parsesToAScan('run2-05-sds-supplier-run1.failed.txt')
    assert.equal((scan.identity as Record<string, unknown>).kind, 'supplier_document')
  })

  test('05-sds-supplier run 2 — same failure, same recovery', () => {
    const scan = parsesToAScan('run2-05-sds-supplier-run2.failed.txt')
    assert.equal((scan.identity as Record<string, unknown>).kind, 'supplier_document')
  })

  test('06b-forklift-log-photo run 1 — the photograph WAS read; only the brace was wrong', () => {
    const scan = parsesToAScan('run2-06b-forklift-log-photo-run1.failed.txt')
    assert.equal((scan.identity as Record<string, unknown>).kind, 'record')
    assert.equal(scan.status, 'recorded')
    // The answer that was stored as "could not read this clearly enough to rely on" had read
    // the site, the truck and four facts off the photograph. This run raised no gaps of its
    // own — the four things it wanted are in expected_missing — so the count asserted here is
    // the one the answer actually carries, not the one that would look best.
    assert.equal((scan.facts as unknown[]).length, 4)
    assert.equal((scan.expected_missing as unknown[]).length, 4)
  })

  test('06b-forklift-log-photo run 2 — recovered, and it is not a could_not_read answer', () => {
    const scan = parsesToAScan('run2-06b-forklift-log-photo-run2.failed.txt')
    assert.equal((scan.identity as Record<string, unknown>).kind, 'record')
    assert.equal((scan.could_not_read as Record<string, unknown>).reason, null)
  })

  test('06b-forklift-log-photo run 3 — the longest of the five, 12,743 characters', () => {
    const scan = parsesToAScan('run2-06b-forklift-log-photo-run3.failed.txt')
    assert.equal((scan.identity as Record<string, unknown>).site, 'Portland')
  })
})

describe('extractJsonText — the two answers Documents Run 1 threw away', () => {
  test('storm_water run 1 — the first of the three identical failures', () => {
    parsesToAScan('run1-storm-water-run1.failed.txt')
  })

  test('storm_water run 2 — the run whose prompt Part 5(a) reconstructed', () => {
    parsesToAScan('run1-storm-water-run2.failed.txt')
  })
})

describe('extractJsonText — answers that already parsed come out byte-identical', () => {
  // NOT "they still parse". A slice that parses but is a different slice would be a silent
  // change to every caller that never had this bug, which is most of them.
  const unchanged = (file: string) => {
    const text = raw(file)
    const got = extractJsonText(text)
    const fenced = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const start = fenced.indexOf('{')
    const end = fenced.lastIndexOf('}')
    assert.equal(got, fenced.slice(start, end + 1),
      `${file}: the extracted slice moved — a balanced answer must be untouched`)
    parsesToAScan(file)
  }

  test('01-eap-chemical run 1 — 14,008 characters, nine gaps, unchanged', () => {
    unchanged('run2-01-eap-chemical-run1.parsed.txt')
  })

  test('02-acdp-chemical run 1 — thirteen conditions, unchanged', () => {
    unchanged('run2-02-acdp-chemical-run1.parsed.txt')
  })

  test('03-olcc-cannabis run 1 — the only case that passed Run 2, unchanged', () => {
    unchanged('run2-03-olcc-cannabis-run1.parsed.txt')
  })
})

describe('extractJsonText — the behaviours the balanced scan must not lose', () => {
  test('narration before the object is still trimmed', () => {
    const out = extractJsonText('I will read this document now.\n{"a":1}')
    assert.equal(out, '{"a":1}')
  })

  test('prose after the object is still trimmed', () => {
    const out = extractJsonText('{"a":1}\n\nLet me know if you would like a draft of that section.')
    assert.equal(out, '{"a":1}')
  })

  test('a top-level array is still extracted', () => {
    const out = extractJsonText('```json\n[{"a":1},{"b":2}]\n```')
    assert.deepEqual(JSON.parse(out), [{ a: 1 }, { b: 2 }])
  })

  test('a closing brace inside a string does not end the object', () => {
    const out = extractJsonText('{"fix":"add a } to the template","n":1}')
    assert.deepEqual(JSON.parse(out), { fix: 'add a } to the template', n: 1 })
  })

  test('an escaped quote inside a string does not end the string', () => {
    const out = extractJsonText('{"quote":"the rule says \\"shall\\" not \\"may\\"","n":1} trailing prose')
    assert.deepEqual(JSON.parse(out), { quote: 'the rule says "shall" not "may"', n: 1 })
  })

  test('a truncated object still reaches JSON.parse and fails there, not here', () => {
    // No matching closer exists. The old sweep is the fallback so the caller sees the same
    // parse error it always saw, rather than an empty string or a thrown exception from here.
    const out = extractJsonText('{"identity":{"kind":"permit"')
    assert.ok(out.startsWith('{'), 'something is still returned for a cut-off answer')
    assert.throws(() => JSON.parse(out))
  })
})

describe('the failure no extractor can fix — and what replaced the extractor for it', () => {
  // Documents Run 2b, case 04 run 3. The model wrote two quoted sentences joined by "vs." inside
  // ONE string value, without escaping the inner quotes:
  //
  //     "quote": "Cool cooked beans from 135°F…" vs. "The blast chiller operator records…"
  //
  // The string ends at the second quote and `vs.` is a syntax error from there on. There is no
  // slice of this text that parses, so the balanced scan cannot help and neither could any
  // other extractor: the bytes are not JSON. Documents Run 3 therefore sends the shape as
  // `output_config.format` (a json_schema) so the API enforces it, and keeps `extractJsonText`
  // as the fallback rather than the mechanism.
  const FIXTURE = 'run2b-04-fsp-food-run3.unescaped-quote.txt'

  test('the fixture still does not parse, and that is the honest result', () => {
    const text = extractJsonText(raw(FIXTURE))
    assert.ok(text.startsWith('{'), 'a slice is still returned, so the caller gets its own error')
    assert.throws(() => JSON.parse(text), /JSON/)
  })

  test('extractJsonText does not throw on it — the caller decides what a bad answer means', () => {
    // lib/documentScan.ts keeps the paid text and stores could_not_read; it must never 500.
    assert.doesNotThrow(() => extractJsonText(raw(FIXTURE)))
  })

  test('the scan schema declares every key of the contract the prompt asks for', () => {
    const props = SCAN_JSON_SCHEMA.properties as Record<string, unknown>
    for (const k of SCAN_KEYS) {
      assert.ok(k in props, `SCAN_JSON_SCHEMA is missing "${k}" — the schema and the prompt's JSON block must say the same thing`)
    }
    assert.equal(SCAN_JSON_SCHEMA.type, 'object')
  })

  test('the schema compels no content: nothing is required, so a field it cannot read stays null', () => {
    // A schema that forced every field would make the model invent a doc_date rather than
    // return null. The syntax is enforced; the content is not.
    assert.equal((SCAN_JSON_SCHEMA as Record<string, unknown>).required, undefined)
    const gaps = (SCAN_JSON_SCHEMA.properties as any).gaps.items
    assert.equal(gaps.required, undefined)
  })
})
