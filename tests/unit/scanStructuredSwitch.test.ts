/**
 * AI_SCAN_STRUCTURED — the scan's shape, enforced or asked for.
 *
 * *** THIS IS A SWITCH BECAUSE OF WHAT HAPPENED WHEN THE SCHEMA LANDED. *** Four of the seven
 * golden fixtures lost their agency in the same change that introduced `output_config.format`,
 * and one program turned `current`. Nobody has established whether the schema constrained the
 * model or Haiku was being Haiku, and the only way to find out is to run the same documents
 * both ways. A change that cannot be turned off is a change that cannot be attributed.
 *
 * The default is ON: the safe default is the one where the JSON is valid at the source. Only the
 * exact string "false" turns it off, so a typo does not silently drop the constraint.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { scanStructuredOutput } from '../../lib/ai.ts'

const withEnv = (value: string | undefined, fn: () => void) => {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'AI_SCAN_STRUCTURED')
  const before = process.env.AI_SCAN_STRUCTURED
  try {
    if (value === undefined) delete process.env.AI_SCAN_STRUCTURED
    else process.env.AI_SCAN_STRUCTURED = value
    fn()
  } finally {
    if (had) process.env.AI_SCAN_STRUCTURED = before
    else delete process.env.AI_SCAN_STRUCTURED
  }
}

describe('AI_SCAN_STRUCTURED', () => {
  test('ON: unset, and the scan sends output_config.format', () => {
    withEnv(undefined, () => {
      assert.equal(scanStructuredOutput(), true,
        'unset must mean on — the safe default is valid JSON at the source')
    })
    // ...and the same for the values somebody would actually type meaning "yes".
    for (const v of ['true', 'TRUE', '1', 'on', '']) {
      withEnv(v, () => assert.equal(scanStructuredOutput(), true, `"${v}" must not turn the schema off`))
    }
  })

  test('OFF: "false" only, and then extractJsonText is the mechanism again', () => {
    for (const v of ['false', 'FALSE', ' false ']) {
      withEnv(v, () => assert.equal(scanStructuredOutput(), false, `"${v}" must turn the schema off`))
    }
    // A typo must NOT silently drop the constraint — that is the failure mode this guards.
    for (const v of ['flase', 'no', '0', 'off']) {
      withEnv(v, () => assert.equal(scanStructuredOutput(), true,
        `"${v}" is not "false"; a near miss must leave the schema ON rather than quietly removing it`))
    }
  })
})
