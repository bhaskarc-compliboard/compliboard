/**
 * R1.2 STEP ONE — SOURCE PREFERENCE, BEHIND A SWITCH. `DECISIONS.md` §124.
 *
 * The property that matters is not "does the sentence appear" — it is **"is the prompt with the
 * switch off byte-for-byte what it was"**. A measurement comparing on against off is worthless
 * if turning it off also changed something else, and a prompt drifting by a newline is the kind
 * of difference nothing else in the suite would catch.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemPrompt, OPEN_ROLE, OPEN_CHECKLIST_SHAPE, PREFER_GOV_SOURCES } from '../../prompts/checklist.ts'

/**
 * The switch is read at the decision point, so setting it here is enough.
 *
 * *** IT ALSO CLEARS R1.3. *** These assertions are about ONE switch's effect. If
 * `RESEARCH_SPECIALIST` were set in the ambient environment — and it is, in `.env.local` —
 * every "unchanged" assertion here would be measuring two switches and calling it one.
 */
function withSwitch<T>(value: string | undefined, fn: () => T): T {
  const before = process.env.RESEARCH_PREFER_GOV
  const beforeSpecialist = process.env.RESEARCH_SPECIALIST
  const beforeProvenance = process.env.RESEARCH_PROVENANCE
  delete process.env.RESEARCH_SPECIALIST
  delete process.env.RESEARCH_PROVENANCE
  if (value === undefined) delete process.env.RESEARCH_PREFER_GOV
  else process.env.RESEARCH_PREFER_GOV = value
  try { return fn() } finally {
    if (before === undefined) delete process.env.RESEARCH_PREFER_GOV
    else process.env.RESEARCH_PREFER_GOV = before
    if (beforeSpecialist === undefined) delete process.env.RESEARCH_SPECIALIST
    else process.env.RESEARCH_SPECIALIST = beforeSpecialist
    if (beforeProvenance === undefined) delete process.env.RESEARCH_PROVENANCE
    else process.env.RESEARCH_PROVENANCE = beforeProvenance
  }
}

describe('RESEARCH_PREFER_GOV — off', () => {
  test('research is EXACTLY the role sentence, unchanged', () => {
    withSwitch(undefined, () => {
      assert.equal(buildSystemPrompt('research', null, { open: true }), OPEN_ROLE)
    })
  })

  test('checklist is EXACTLY the shape it was, unchanged', () => {
    withSwitch(undefined, () => {
      assert.equal(buildSystemPrompt('checklist', null, { open: true }), OPEN_CHECKLIST_SHAPE)
    })
  })

  test('anything but the exact string "true" is off — a typo does not silently enable it', () => {
    for (const v of ['ture', 'yes', 'on', '1', 'TRUE ', '']) {
      withSwitch(v, () => {
        const got = buildSystemPrompt('research', null, { open: true })
        const expected = v.trim().toLowerCase() === 'true' ? `${OPEN_ROLE}\n\n${PREFER_GOV_SOURCES}` : OPEN_ROLE
        assert.equal(got, expected, `RESEARCH_PREFER_GOV=${JSON.stringify(v)}`)
      })
    }
  })
})

describe('RESEARCH_PREFER_GOV — on', () => {
  test('research appends the sentence AFTER the role and changes nothing else', () => {
    withSwitch('true', () => {
      const p = buildSystemPrompt('research', null, { open: true })
      assert.ok(p.startsWith(OPEN_ROLE), 'the role sentence still comes first')
      assert.equal(p, `${OPEN_ROLE}\n\n${PREFER_GOV_SOURCES}`)
    })
  })

  test('checklist keeps the SHAPE last — the model must read the format instruction at the end', () => {
    withSwitch('true', () => {
      const p = buildSystemPrompt('checklist', null, { open: true })
      assert.ok(p.includes(PREFER_GOV_SOURCES), 'the sentence is present')
      assert.ok(p.trimEnd().endsWith('"good_to_have" is what is advisable but not required.'),
        'the shape instruction is still the last thing in the prompt')
      // The only difference from the off case is the inserted sentence.
      assert.equal(p.replace(`\n\n${PREFER_GOV_SOURCES}`, ''), OPEN_CHECKLIST_SHAPE)
    })
  })

  test('it is a PREFERENCE, not a prohibition — it permits the alternative with a disclosure', () => {
    // §113: a list of things not to do is a fence, and fences are what the baseline removed.
    assert.ok(/prefer official ones/.test(PREFER_GOV_SOURCES))
    assert.ok(/Use another source only when no official one covers the point, and say so\./.test(PREFER_GOV_SOURCES))
    assert.ok(!/\b(never|do not|must not|forbidden)\b/i.test(PREFER_GOV_SOURCES),
      'no prohibition wording')
  })

  test('substeps is untouched either way — it expands an item, it does not cite', () => {
    const off = withSwitch(undefined, () => buildSystemPrompt('substeps', null, { open: true }))
    const on = withSwitch('true', () => buildSystemPrompt('substeps', null, { open: true }))
    assert.equal(on, off)
  })
})
