/**
 * R1 FIX C — THE PROVENANCE SENTENCE, BEHIND A SWITCH. `DECISIONS.md` §128.
 *
 * Same property as R1.2 and R1.3: **with the switch off the prompt is byte-for-byte what it
 * was.** And one more that matters here — the sentence must sit immediately after the role, so
 * what the conversation already contains is settled before the model is told how to cite or how
 * to answer. There are now three independent switches; all eight combinations are asserted.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSystemPrompt, OPEN_ROLE, OPEN_CHECKLIST_SHAPE,
  PREFER_GOV_SOURCES, RESEARCH_SPECIALIST_BLOCK, PROVENANCE_SENTENCE,
} from '../../prompts/checklist.ts'

const NAMES = ['RESEARCH_PROVENANCE', 'RESEARCH_PREFER_GOV', 'RESEARCH_SPECIALIST'] as const

/** Sets all three every time, so no assertion can depend on the ambient environment. */
function withSwitches<T>(on: Partial<Record<(typeof NAMES)[number], boolean>>, fn: () => T): T {
  const before = NAMES.map((n) => [n, process.env[n]] as const)
  for (const n of NAMES) { if (on[n]) process.env[n] = 'true'; else delete process.env[n] }
  try { return fn() } finally {
    for (const [n, v] of before) { if (v === undefined) delete process.env[n]; else process.env[n] = v }
  }
}

describe('RESEARCH_PROVENANCE — off', () => {
  test('research is EXACTLY the role sentence — byte for byte', () => {
    withSwitches({}, () => {
      assert.equal(buildSystemPrompt('research', null, { open: true }), OPEN_ROLE)
    })
  })

  test('checklist is EXACTLY the shape it was — byte for byte', () => {
    withSwitches({}, () => {
      assert.equal(buildSystemPrompt('checklist', null, { open: true }), OPEN_CHECKLIST_SHAPE)
    })
  })

  test('anything but the exact string "true" is off', () => {
    const b = process.env.RESEARCH_PROVENANCE
    delete process.env.RESEARCH_PREFER_GOV; delete process.env.RESEARCH_SPECIALIST
    try {
      for (const v of ['ture', 'yes', 'on', '1', 'TRUE ', '']) {
        process.env.RESEARCH_PROVENANCE = v
        const expected = v.trim().toLowerCase() === 'true'
          ? `${OPEN_ROLE}\n\n${PROVENANCE_SENTENCE}` : OPEN_ROLE
        assert.equal(buildSystemPrompt('research', null, { open: true }), expected, JSON.stringify(v))
      }
    } finally { if (b === undefined) delete process.env.RESEARCH_PROVENANCE; else process.env.RESEARCH_PROVENANCE = b }
  })
})

describe('RESEARCH_PROVENANCE — on', () => {
  test('the sentence follows the role and nothing else changes', () => {
    withSwitches({ RESEARCH_PROVENANCE: true }, () => {
      assert.equal(buildSystemPrompt('research', null, { open: true }),
        `${OPEN_ROLE}\n\n${PROVENANCE_SENTENCE}`)
    })
  })

  test('checklist keeps the SHAPE last', () => {
    withSwitches({ RESEARCH_PROVENANCE: true }, () => {
      const p = buildSystemPrompt('checklist', null, { open: true })
      assert.ok(p.startsWith(`${OPEN_ROLE}\n\n${PROVENANCE_SENTENCE}`))
      assert.equal(p.replace(`\n\n${PROVENANCE_SENTENCE}`, ''), OPEN_CHECKLIST_SHAPE)
    })
  })

  test('it is the owner\'s sentence, verbatim', () => {
    assert.equal(PROVENANCE_SENTENCE,
      'Numbered sources in earlier answers in this conversation came from web searches run at ' +
      'the time; treat them as real.')
  })

  test('it makes a claim about the DATA, not an instruction to be agreeable', () => {
    // The permission to say this at all is that it is true: `reassemble()` builds `sources`
    // only from citations on search-grounded blocks. If this ever became "assume you searched"
    // it would be asking the model to assert something nobody checked.
    assert.match(PROVENANCE_SENTENCE, /came from web searches run at the time/)
    assert.ok(!/assume|pretend|always say/i.test(PROVENANCE_SENTENCE))
  })
})

describe('three switches, eight combinations, one fixed order', () => {
  test('all three on: role, provenance, how to cite, how to answer', () => {
    withSwitches({ RESEARCH_PROVENANCE: true, RESEARCH_PREFER_GOV: true, RESEARCH_SPECIALIST: true }, () => {
      assert.equal(buildSystemPrompt('research', null, { open: true }),
        `${OPEN_ROLE}\n\n${PROVENANCE_SENTENCE}\n\n${PREFER_GOV_SOURCES}\n\n${RESEARCH_SPECIALIST_BLOCK}`)
    })
  })

  test('provenance comes before the gov sentence, not after it', () => {
    withSwitches({ RESEARCH_PROVENANCE: true, RESEARCH_PREFER_GOV: true }, () => {
      const p = buildSystemPrompt('research', null, { open: true })
      assert.ok(p.indexOf(PROVENANCE_SENTENCE) < p.indexOf(PREFER_GOV_SOURCES))
    })
  })

  test('each of the eight combinations is a distinct prompt', () => {
    const seen = new Set<string>()
    for (const a of [false, true]) for (const b of [false, true]) for (const c of [false, true]) {
      seen.add(withSwitches(
        { RESEARCH_PROVENANCE: a, RESEARCH_PREFER_GOV: b, RESEARCH_SPECIALIST: c },
        () => buildSystemPrompt('research', null, { open: true })))
    }
    assert.equal(seen.size, 8)
  })

  test('substeps is untouched by all three', () => {
    const off = withSwitches({}, () => buildSystemPrompt('substeps', null, { open: true }))
    const on = withSwitches({ RESEARCH_PROVENANCE: true, RESEARCH_PREFER_GOV: true, RESEARCH_SPECIALIST: true },
      () => buildSystemPrompt('substeps', null, { open: true }))
    assert.equal(on, off)
  })
})
