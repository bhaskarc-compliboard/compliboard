/**
 * R1.3 — HOW THE SPECIALIST ANSWERS, BEHIND A SWITCH. `DECISIONS.md` §128.
 *
 * Same property as R1.2 and for the same reason: **with the switch off the prompt must be
 * byte-for-byte what it was.** A comparison of on against off measures nothing if turning it
 * off also moved a newline.
 *
 * And one property R1.2 did not have to consider: the two switches are independent, so all
 * FOUR combinations are asserted, with the order fixed — who you are, how to cite, how to
 * answer. An order that drifts is a different prompt presented as the same one.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSystemPrompt, OPEN_ROLE, OPEN_CHECKLIST_SHAPE, PREFER_GOV_SOURCES, RESEARCH_SPECIALIST_BLOCK,
} from '../../prompts/checklist.ts'

/** Both switches, always set together, so no assertion depends on the ambient environment. */
function withSwitches<T>(gov: boolean, specialist: boolean, fn: () => T): T {
  const b1 = process.env.RESEARCH_PREFER_GOV, b2 = process.env.RESEARCH_SPECIALIST
  const b3 = process.env.RESEARCH_PROVENANCE
  delete process.env.RESEARCH_PROVENANCE   // R1.3's assertions are about R1.2 and R1.3 only
  if (gov) process.env.RESEARCH_PREFER_GOV = 'true'; else delete process.env.RESEARCH_PREFER_GOV
  if (specialist) process.env.RESEARCH_SPECIALIST = 'true'; else delete process.env.RESEARCH_SPECIALIST
  try { return fn() } finally {
    if (b1 === undefined) delete process.env.RESEARCH_PREFER_GOV; else process.env.RESEARCH_PREFER_GOV = b1
    if (b2 === undefined) delete process.env.RESEARCH_SPECIALIST; else process.env.RESEARCH_SPECIALIST = b2
    if (b3 === undefined) delete process.env.RESEARCH_PROVENANCE; else process.env.RESEARCH_PROVENANCE = b3
  }
}

describe('RESEARCH_SPECIALIST — off', () => {
  test('research is EXACTLY the role sentence — byte for byte', () => {
    withSwitches(false, false, () => {
      assert.equal(buildSystemPrompt('research', null, { open: true }), OPEN_ROLE)
    })
  })

  test('checklist is EXACTLY the shape it was — byte for byte', () => {
    withSwitches(false, false, () => {
      assert.equal(buildSystemPrompt('checklist', null, { open: true }), OPEN_CHECKLIST_SHAPE)
    })
  })

  test('anything but the exact string "true" is off — a typo does not silently enable it', () => {
    const b = process.env.RESEARCH_SPECIALIST
    delete process.env.RESEARCH_PREFER_GOV
    delete process.env.RESEARCH_PROVENANCE
    try {
      for (const v of ['ture', 'yes', 'on', '1', 'TRUE ', '']) {
        process.env.RESEARCH_SPECIALIST = v
        const got = buildSystemPrompt('research', null, { open: true })
        const expected = v.trim().toLowerCase() === 'true'
          ? `${OPEN_ROLE}\n\n${RESEARCH_SPECIALIST_BLOCK}` : OPEN_ROLE
        assert.equal(got, expected, `RESEARCH_SPECIALIST=${JSON.stringify(v)}`)
      }
    } finally { if (b === undefined) delete process.env.RESEARCH_SPECIALIST; else process.env.RESEARCH_SPECIALIST = b }
  })
})

describe('RESEARCH_SPECIALIST — on', () => {
  test('research appends the block AFTER the role and changes nothing else', () => {
    withSwitches(false, true, () => {
      assert.equal(buildSystemPrompt('research', null, { open: true }),
        `${OPEN_ROLE}\n\n${RESEARCH_SPECIALIST_BLOCK}`)
    })
  })

  test('checklist keeps the SHAPE last — the format instruction must be what it reads last', () => {
    withSwitches(false, true, () => {
      const p = buildSystemPrompt('checklist', null, { open: true })
      assert.ok(p.startsWith(`${OPEN_ROLE}\n\n${RESEARCH_SPECIALIST_BLOCK}`))
      assert.ok(p.trimEnd().endsWith('"good_to_have" is what is advisable but not required.'))
      // Nothing but the block was inserted: strip it and the original shape is back.
      assert.equal(p.replace(`\n\n${RESEARCH_SPECIALIST_BLOCK}`, ''), OPEN_CHECKLIST_SHAPE)
    })
  })

  test('substeps is untouched either way — it expands an item somebody is already reading', () => {
    const off = withSwitches(false, false, () => buildSystemPrompt('substeps', null, { open: true }))
    const on = withSwitches(false, true, () => buildSystemPrompt('substeps', null, { open: true }))
    assert.equal(on, off)
  })
})

describe('the two switches are independent, and the order is fixed', () => {
  test('both on: role, then how to cite, then how to answer', () => {
    withSwitches(true, true, () => {
      assert.equal(buildSystemPrompt('research', null, { open: true }),
        `${OPEN_ROLE}\n\n${PREFER_GOV_SOURCES}\n\n${RESEARCH_SPECIALIST_BLOCK}`)
    })
  })

  test('both on, checklist: the same head, and the shape still last', () => {
    withSwitches(true, true, () => {
      const p = buildSystemPrompt('checklist', null, { open: true })
      assert.ok(p.startsWith(`${OPEN_ROLE}\n\n${PREFER_GOV_SOURCES}\n\n${RESEARCH_SPECIALIST_BLOCK}`))
      assert.equal(
        p.replace(`\n\n${PREFER_GOV_SOURCES}\n\n${RESEARCH_SPECIALIST_BLOCK}`, ''), OPEN_CHECKLIST_SHAPE)
    })
  })

  test('each of the four combinations is a distinct prompt', () => {
    const seen = new Set<string>()
    for (const gov of [false, true]) for (const sp of [false, true]) {
      seen.add(withSwitches(gov, sp, () => buildSystemPrompt('research', null, { open: true })))
    }
    assert.equal(seen.size, 4)
  })
})

describe('the block says what to do, never what not to do — §113', () => {
  test('no prohibition verb, the rule the open baseline turns on', () => {
    // The same list R1.2 uses, deliberately. A wider one that also catches "don't" fails on
    // *"a fact you don't have"* — which describes what the model is missing, not something it
    // is forbidden to do. §113 is about fences placed in front of the model, not contractions.
    assert.ok(!/\b(never|do not|must not|forbidden)\b/i.test(RESEARCH_SPECIALIST_BLOCK),
      `a prohibition reached the block: ${RESEARCH_SPECIALIST_BLOCK}`)
  })

  test('it is the owner\'s four sentences, verbatim — not a paraphrase', () => {
    assert.equal(RESEARCH_SPECIALIST_BLOCK,
      "Answer what was asked, then say what they didn't ask but need to know. Where the answer " +
      "depends on a fact you don't have, say which fact and what each answer would mean, rather " +
      'than assuming. Write for a busy owner: plain sentences, the most important thing first, ' +
      'and only as long as it needs to be. End with one specific offer of what you could do next.')
    assert.equal(RESEARCH_SPECIALIST_BLOCK.split('. ').length, 4)
  })
})
