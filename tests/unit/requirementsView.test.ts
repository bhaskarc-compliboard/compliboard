/**
 * THE REQUIREMENTS SCREEN — what it says, and what it must never say.
 *
 * The no-aggregate test is the one that matters. `DECISIONS.md` §58.3: a count on a screen is
 * the easiest thing in the world to add without noticing it is a claim, and
 * `app/requirements/page.tsx` already renders one today — of a state that cannot occur.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  renderRow, renderShown, sectionLabel, sectionBlurb, renderCoverageStrip, renderEmptyState,
  SECTIONS, type RequirementRow,
} from '../../lib/requirementsView.ts'

const row = (o: Partial<RequirementRow> = {}): RequirementRow => ({
  requirementName: 'Chemical storage compatibility / segregation',
  citation: 'Oregon Fire Code (IFC-based) Ch. 50',
  agency: 'LOCAL-FIRE', category: 'written_program',
  status: 'applies',
  resolutionRationale: 'Because hazardous chemicals are present at this site.',
  siteName: 'Test Alpha Chemical — Portland',
  liveEvidence: 0, expiredEvidence: 0, contradictingEvidence: 0,
  nextExpiry: null, evidenceNames: [],
  factsNeeded: [], inventoryNeeded: [], ...o,
})

describe('applies — two independent facts, never one verdict (§58.1)', () => {
  test('OWED and SHOWN are separate fields', () => {
    const r = renderRow(row())
    assert.equal(r.verdictLabel, 'OWED')
    assert.equal(r.shownLabel, 'SHOWN')
    assert.ok(r.verdictText.includes('Test Alpha Chemical — Portland'))
    assert.ok(r.shownText!.includes('Nothing yet'))
  })
  test('no combined verdict string exists anywhere on the row', () => {
    const r = renderRow(row())
    const all = JSON.stringify(r).toLowerCase()
    for (const w of ['compliant', 'satisfied', 'complete', 'done', 'all set'])
      assert.ok(!all.includes(w), `the row collapsed into a verdict containing "${w}"`)
  })
  test('NOTHING SHOWN IS NOT A WARNING — it is the honest default', () => {
    const r = renderRow(row())
    assert.equal(r.shownIsWarning, false,
      'dressing the day-one default as a warning makes the honest state look like a failure')
    assert.equal(r.action, 'Link a document')
  })
  test('expired evidence IS a warning', () => {
    const r = renderRow(row({ expiredEvidence: 1, nextExpiry: '2026-03-01' }))
    assert.equal(r.shownIsWarning, true)
    assert.match(r.shownText!, /expired on 2026-03-01/)
  })
  test('contradicting evidence is a warning and names the document', () => {
    const r = renderRow(row({ contradictingEvidence: 1, evidenceNames: ['Cascade_SDS_2019.pdf'] }))
    assert.equal(r.shownIsWarning, true)
    assert.match(r.shownText!, /contradicts/)
    assert.match(r.shownText!, /Cascade_SDS_2019\.pdf/)
  })
  test('live evidence reads as a fact with its expiry', () => {
    const s = renderShown(row({ liveEvidence: 1, evidenceNames: ['Permit 26-2841'], nextExpiry: '2027-03-01' }))
    assert.equal(s.isWarning, false)
    assert.match(s.text, /Permit 26-2841 — valid until 2027-03-01/)
  })
})

describe('does_not_apply — the reason is the content, verbatim', () => {
  const RAT = 'Ruled out by: industrial_stormwater = false. This is a definite no with the evidence behind it, not an absence of evidence.'
  test('the rationale is rendered unchanged, not summarised', () => {
    const r = renderRow(row({ status: 'does_not_apply', resolutionRationale: RAT }))
    assert.equal(r.verdictText, RAT,
      'paraphrasing here is §56.2 one layer out: a correct heading over an unchecked description')
    assert.equal(r.verdictLabel, 'NOT OWED')
  })
  test('it carries a correction affordance', () => {
    const r = renderRow(row({ status: 'does_not_apply', resolutionRationale: RAT }))
    assert.equal(r.action, "That's wrong — fix")
  })
  test('it has NO shown line — evidence is meaningless for something not owed', () => {
    const r = renderRow(row({ status: 'does_not_apply', resolutionRationale: RAT }))
    assert.equal(r.shownLabel, undefined)
  })
})

describe('undetermined and unknown are different rows (§21.3)', () => {
  test('undetermined is a dead end and offers no question', () => {
    const r = renderRow(row({ status: 'undetermined',
      resolutionRationale: 'This requirement carries no machine-evaluable condition. A person must decide.' }))
    assert.equal(r.verdictLabel, 'UNRESOLVED')
    assert.equal(r.action, undefined, 'offering a question the product cannot ask is the collapse §21.3 forbids')
  })
  test('unknown IS answerable and says so — WHEN a switch is what is missing', () => {
    const r = renderRow(row({ status: 'unknown', factsNeeded: ['exposure_butadiene'],
      resolutionRationale: 'Cannot decide yet. 1 fact(s) not established: exposure_butadiene.' }))
    assert.equal(r.verdictLabel, 'NOT YET KNOWN')
    assert.equal(r.action, 'Answer the question')
    assert.equal(r.waitingText, 'Waiting on: exposure_butadiene')
  })
  /**
   * *** THESE FOUR ARE THE DEFECT THE SCREEN FOUND, WRITTEN DOWN (§61). ***
   *
   * The test above USED to assert `action === 'Answer the question'` for any `unknown` row,
   * with no `factsNeeded` set. It passed. It was asserting the bug: twelve of Test Alpha's 136
   * unknown rows name no switch at all and had no question behind that button.
   */
  test('unknown waiting on QUANTITIES asks for the inventory, not for a question', () => {
    const r = renderRow(row({ status: 'unknown', factsNeeded: [], inventoryNeeded: ['psm'],
      resolutionRationale: 'Cannot decide yet. chemical inventory cannot answer: psm.' }))
    assert.equal(r.verdictLabel, 'NOT YET KNOWN')
    assert.equal(r.action, 'Add your chemical inventory')
    assert.notEqual(r.action, 'Answer the question',
      'there is no question behind this row — askableSwitches() has nothing to offer it')
  })
  test('every unknown row names what it is waiting for', () => {
    for (const o of [{ factsNeeded: ['psm_covered'] }, { inventoryNeeded: ['ehs'] }, {}]) {
      const r = renderRow(row({ status: 'unknown', ...o }))
      assert.ok(r.waitingText && r.waitingText.length > 0,
        `"we cannot say yet" with nothing after it is correct-looking and useless: ${JSON.stringify(o)}`)
    }
  })
  test('an unknown row naming NOTHING offers no action at all', () => {
    const r = renderRow(row({ status: 'unknown', factsNeeded: [], inventoryNeeded: [] }))
    assert.equal(r.action, undefined,
      'an affordance with nothing behind it invites a click that cannot work')
    assert.ok(r.waitingText!.includes('cannot yet name'))
  })
  test('the inventory sentence says quantities, because SDSs are what customers upload', () => {
    const r = renderRow(row({ status: 'unknown', inventoryNeeded: ['tri'] }))
    assert.match(r.waitingText!, /quantities/)
    assert.match(r.waitingText!, /safety data sheets/,
      'a customer who uploads their binder and sees no movement concludes the product is broken')
  })

  test('their labels are never equal', () => {
    assert.notEqual(renderRow(row({ status: 'unknown' })).verdictLabel,
                    renderRow(row({ status: 'undetermined' })).verdictLabel)
  })
})

describe('the sections, in order', () => {
  test('the ACTIONABLE section is second', () => {
    assert.deepEqual(SECTIONS.map((s) => s.key), ['applies', 'unknown', 'does_not_apply'])
  })
  test("what you don't is third — a peer, not a filter", () => {
    assert.equal(SECTIONS[2].key, 'does_not_apply')
    assert.match(sectionBlurb('does_not_apply'), /usually missing/)
  })
})

// ---------------------------------------------------------------------------
// *** THE NO-AGGREGATE TEST ***
// ---------------------------------------------------------------------------

/** Everything the screen says, assembled the way the page assembles it. */
function allScreenText(): string {
  const rows = [
    renderRow(row()),
    renderRow(row({ status: 'does_not_apply', resolutionRationale: 'Ruled out by: owns_fleet = false.' })),
    renderRow(row({ status: 'unknown', resolutionRationale: 'Cannot decide yet. 1 fact(s) not established: exposure_lead.' })),
    renderRow(row({ status: 'undetermined', resolutionRationale: 'A person must decide.' })),
    renderRow(row({ liveEvidence: 1, evidenceNames: ['Permit 26-2841'], nextExpiry: '2027-03-01' })),
  ]
  return [
    ...SECTIONS.map((s) => sectionLabel(s.key)),
    ...SECTIONS.map((s) => sectionBlurb(s.key)),
    ...renderCoverageStrip({ requirements: 200, agencies: 33, verified: 0,
                             switchesTotal: 95, switchesFromDocuments: 53 }),
    renderEmptyState(),
    ...rows.flatMap((r) => [r.title, r.subtitle, r.verdictLabel, r.verdictText,
                            r.shownLabel ?? '', r.shownText ?? '', r.action ?? '']),
  ].join('\n')
}

describe('NO NUMERIC AGGREGATE — §58.3', () => {
  /**
   * *** THERE IS NO PATTERN-SHAPED EXCEPTION, AND THAT IS DELIBERATE. ***
   *
   * An earlier version allowlisted the three section headers by regex — `What you owe (40)` and
   * friends — on the argument that a section SIZE is navigation rather than a claim. **That
   * carve-out was reverted, and the reason is worth more than the counts were.** A test with an
   * exception for headers is a precedent: the next count added has something to point at, and
   * §58.3 exists precisely because a count is the easiest thing in the world to add without
   * noticing it is a claim. **A test that permits a category of the failure it was written to
   * prevent has stopped being the thing that prevents it.**
   *
   * The counts were also wrong on their own terms: "35 requirements apply to you" asserts a
   * denominator. 35 of what? Of a library where 0 of 200 rows are verified and 42 of 95 facts
   * have no determination path — which is what the strip three inches above says we do not
   * have. The list underneath is its own count.
   *
   * The strip is not an exception of that shape. It is an IDENTITY check against the exact
   * strings ONE function produces — not a pattern a future line could be written to match.
   * Widening it means editing renderCoverageStrip, which is a visible change to the one place
   * the product is allowed to describe its own library.
   */
  const STRIP = new Set(renderCoverageStrip({ requirements: 200, agencies: 33, verified: 0,
                                              switchesTotal: 95, switchesFromDocuments: 53 }))

  /**
   * What counts as a numeric aggregate.
   *
   * The second alternative — a bare parenthesised number at the end of a line — was added
   * after the identity test below showed that `What you owe (40)` **would have slipped past
   * the first pattern entirely.** The carve-out was not the only thing protecting that
   * heading; the detector could not see it either. Worth knowing, because it means the
   * earlier version of this test was weaker than it read.
   */
  const NUMERIC = /\b\d+\s*(%|of\s+\d+|requirements?|items?|complete|covered)\b|\(\s*\d+\s*\)\s*$/i

  test('no count or percentage outside the three section labels', () => {
    const text = allScreenText()
    const offenders: string[] = []
    for (const line of text.split('\n')) {
      if (STRIP.has(line.trim())) continue          // the coverage strip, by identity — see above
      const m = line.match(NUMERIC)
      if (m) offenders.push(`${m[0]}  ←  "${line.trim().slice(0, 72)}"`)
    }
    assert.deepEqual(offenders, [],
      'A count or percentage appeared outside the coverage strip. DECISIONS.md §58.3 — the ' +
      'screen may state what the LIBRARY contains and may not state where this customer ' +
      'stands. If you are adding a count to a heading: the list underneath is its own count, ' +
      'and a heading count asserts a denominator the coverage strip says we do not have.')
  })

  test('SECTION HEADINGS CARRY NO COUNT', () => {
    for (const s of SECTIONS) assert.doesNotMatch(sectionLabel(s.key), /\d/,
      'a heading count asserts a denominator the coverage strip says we do not have')
  })

  test('the strip exception is an IDENTITY, not a pattern a new line could match', () => {
    for (const line of ['You have met 12 of 40 requirements.',
                        'What you owe (40)',
                        '35 requirements apply to you.',
                        '12 of 40 complete']) {
      assert.ok(!STRIP.has(line), `"${line}" must not be excused`)
      assert.match(line, NUMERIC, `the detector must be able to see "${line}"`)
    }
  })

  test('no readiness, score, progress or satisfied wording', () => {
    const text = allScreenText()
    for (const w of [/readiness/i, /\bscore\b/i, /\bprogress\b/i, /\bsatisfied\b/i,
                     /% *(complete|compliant|covered)/i, /all set/i])
      assert.doesNotMatch(text, w, `the screen used wording DECISIONS.md §21.3/§58.3 removed: ${w}`)
  })

  test('the fixture exercises all four states, or both tests above pass by rendering nothing', () => {
    const t = allScreenText()
    for (const label of ['OWED', 'NOT OWED', 'NOT YET KNOWN', 'UNRESOLVED'])
      assert.ok(t.includes(label), `the fixture never produced a ${label} row`)
  })
})

describe('the coverage strip says two true things, and neither is the misreading', () => {
  const s = renderCoverageStrip({ requirements: 200, agencies: 33, verified: 0, switchesTotal: 95, switchesFromDocuments: 53 })
  test('it states what IS loaded before what is not checked', () => {
    assert.match(s[0], /200 requirements are loaded, across 33 agencies/)
    assert.match(s[1], /None has been checked against its published source/)
  })
  test('it never claims coverage or completeness', () => {
    for (const w of [/covered/i, /complete/i, /verified list/i]) assert.doesNotMatch(s.join(' '), w)
  })
  test('7.2d lives in the STRIP, not on a row', () => {
    assert.match(s[2], /53 can be established from your documents/)
    assert.match(s[2], /other 42/)
    // and it must NOT appear on an unanswered question, where it would read as an apology
    assert.doesNotMatch(renderRow(row({ status: 'unknown' })).verdictText, /42|95/)
  })
})

describe('the empty state is a claim and it has to be true (§5.1)', () => {
  test('zero obligations means resolution has not run, not that nothing applies', () => {
    const e = renderEmptyState()
    assert.match(e, /have not worked out/)
    assert.match(e, /not a result/)
    assert.doesNotMatch(e, /all set|nothing applies|compliant/i)
  })
})
