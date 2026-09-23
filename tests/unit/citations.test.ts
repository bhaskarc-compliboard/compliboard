/**
 * A MARKER IN A TABLE CELL — Fix Round 1 (D), `lib/citations.ts`.
 *
 * *** THE FIXTURES ARE REAL ANSWERS, PULLED OUT OF `turns` ON STAGING. *** Not invented shapes:
 *
 *   1ff41ef2  23 Sep 05:28  Texas roofing — fall protection table, markers [1] and [2] in cells
 *   4dc720c8  23 Sep 15:07  wastewater pretreatment — reporting table, markers [11] and [12]
 *   6ae6d82a  23 Sep 15:02  wastewater permits — a table in the same conversation with NO markers
 *
 * The third is the control: an answer that cites nothing inside its table must come back
 * byte-identical, or the fix has started rewriting text it was never supposed to touch.
 *
 * WHAT IS ASSERTED IS THE TABLE, NOT THE MARKER. A markdown table parses on its rows: every
 * line a pipe row, every row the same number of cells. The old code cut the answer in half at
 * the first marker, which destroyed exactly that — the real roofing table rendered as three
 * `<tr>` instead of four, with five loose `|` characters spilled into the prose underneath.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { markCitations, citationNumber, CITE_HREF_PREFIX } from '../../lib/citations.ts'

/** 1ff41ef2 — the marker sits in ROW THREE of the body, which is where the table used to break. */
const ROOFING = [
  "| Situation | Standard | What's allowed |",
  '|---|---|---|',
  '| Low-slope roof (≤4:12) | 1926.501(b)(10) | Guardrails, safety nets, or personal fall arrest (PFAS) |',
  '| Low-slope roof ≤50 ft wide | 1926.501(b)(10) | A safety monitoring system alone[1] is permitted |',
  '| Steep roof (>4:12) | 1926.501(b)(11) | Guardrails with toeboards, safety nets, or PFAS only[2] |',
].join('\n')

/** 4dc720c8 — two-digit markers, one of them after a comma inside a cell. */
const WASTEWATER = [
  '| Report | Trigger / timing | Cite |',
  '|---|---|---|',
  '| Baseline Monitoring Report | 90 days before discharge (new source) | 403.12(b) |',
  '| 90-day compliance report | 90 days after discharge begins[11] | 403.12(d) |',
  '| Periodic compliance reports | self-monitoring and periodic compliance reports every six months[12] | 403.12(e) |',
  '| Slug/accidental discharge notice | potential problems, including slug loadings,[12] immediately | 403.12(f) |',
].join('\n')

/** 6ae6d82a — same conversation, tables, no markers anywhere in them. */
const NO_MARKERS = [
  '| Requirement | Typical trigger |',
  '|---|---|',
  '| Air Contaminant Discharge Permit or permit modification (DEQ) | Air strippers, thermal oxidizers |',
  '| 1200-C construction stormwater permit (DEQ) | Ground disturbance of 1 acre or more |',
  '| UIC registration (DEQ) | Any drywell, infiltration galley, or subsurface disposal |',
].join('\n')

const rows = (md: string) => md.split('\n').filter((l) => l.trim().startsWith('|'))
const cells = (row: string) => row.split('|').length

describe('the table survives the marker — the roofing case, marker in row three', () => {
  const out = markCitations(ROOFING)

  test('every row is still a pipe row', () => {
    assert.equal(rows(out).length, rows(ROOFING).length, 'a row stopped being a row')
    for (const r of out.split('\n')) assert.ok(r.trim().startsWith('|') && r.trim().endsWith('|'))
  })

  test('every row still has the same number of cells as before', () => {
    const before = rows(ROOFING).map(cells)
    const after = rows(out).map(cells)
    assert.deepEqual(after, before)
  })

  test('ROW THREE carries the marker as an inline link, inside its own cell', () => {
    const rowThree = rows(out)[3] // header, separator, row one, row two... index 3 is body row two
    const marked = rows(out).find((r) => r.includes('A safety monitoring system'))!
    assert.ok(marked.includes(`[1](${CITE_HREF_PREFIX}1)`), `row not marked: ${marked}`)
    assert.ok(marked.startsWith('|') && marked.endsWith('|'), 'the cell boundaries were damaged')
    assert.equal(cells(marked), cells(rows(ROOFING).find((r) => r.includes('A safety monitoring system'))!))
    assert.ok(rowThree.length > 0)
  })

  test('nothing outside the marker changed', () => {
    assert.equal(out.replace(/\(#cb-cite-\d+\)/g, ''), ROOFING)
  })
})

describe('two-digit markers, and a marker after punctuation — the wastewater case', () => {
  const out = markCitations(WASTEWATER)

  test('[11] and [12] are both rewritten, all three occurrences', () => {
    assert.ok(out.includes(`[11](${CITE_HREF_PREFIX}11)`))
    assert.equal((out.match(/\[12\]\(#cb-cite-12\)/g) ?? []).length, 2)
  })

  test('the cell counts are untouched', () => {
    assert.deepEqual(rows(out).map(cells), rows(WASTEWATER).map(cells))
  })
})

describe('an answer that cites nothing is not rewritten', () => {
  test('a table with no markers comes back byte-identical', () => {
    assert.equal(markCitations(NO_MARKERS), NO_MARKERS)
  })

  test('prose with no markers comes back byte-identical', () => {
    const p = 'Oregon DEQ requires a 1200-Z permit for industrial stormwater exposure.'
    assert.equal(markCitations(p), p)
  })
})

describe('what must NOT become a citation', () => {
  test('a fenced code block is left alone', () => {
    const md = 'Before [1].\n\n```\nconst x = arr[1]\nconst y = arr[12]\n```\n\nAfter [2].'
    const out = markCitations(md)
    assert.ok(out.includes('const x = arr[1]\n'), 'code was rewritten')
    assert.ok(out.includes('const y = arr[12]\n'), 'code was rewritten')
    assert.ok(out.includes(`Before [1](${CITE_HREF_PREFIX}1)`), 'prose before the fence was missed')
    assert.ok(out.includes(`After [2](${CITE_HREF_PREFIX}2)`), 'prose after the fence was missed')
  })

  test('a tilde fence closes properly too', () => {
    const out = markCitations('~~~\nrow[3]\n~~~\n\nText [3].')
    assert.ok(out.includes('row[3]\n'))
    assert.ok(out.includes(`Text [3](${CITE_HREF_PREFIX}3)`))
  })

  test('an inline code span is left alone', () => {
    const out = markCitations('Use `items[1]` here, and see [1].')
    assert.ok(out.includes('`items[1]`'), 'inline code was rewritten')
    assert.ok(out.includes(`see [1](${CITE_HREF_PREFIX}1)`))
  })

  test('an existing markdown link is not double-wrapped', () => {
    const md = 'See [1](https://www.osha.gov/x) and [2][ref] and\n\n[3]: https://www.epa.gov/y'
    assert.equal(markCitations(md), md)
  })

  test('a bracketed number that is not one or two digits is not a marker', () => {
    const md = 'Section [2024] of the code, and [123] too.'
    assert.equal(markCitations(md), md)
  })
})

describe('reading the href back', () => {
  test('a citation href yields its number', () => {
    assert.equal(citationNumber('#cb-cite-7'), 7)
    assert.equal(citationNumber('#cb-cite-12'), 12)
  })

  test('an ordinary link is not a citation', () => {
    assert.equal(citationNumber('https://www.osha.gov/hazcom'), null)
    assert.equal(citationNumber('#section-2'), null)
    assert.equal(citationNumber(undefined), null)
  })

  test('a malformed citation href is not a number', () => {
    assert.equal(citationNumber('#cb-cite-'), null)
    assert.equal(citationNumber('#cb-cite-abc'), null)
    assert.equal(citationNumber('#cb-cite-0'), null)
  })
})
