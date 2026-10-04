/**
 * HOW A CHECKLIST IS SHOWN — `lib/checklistView.ts`, Workspace Task 6, board 8.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  groupItems, madeInWorkspace, mustDoLabel, oneLineSource, shortTitle, thingsToDo, noSourceText, itemSources, isResearching, howToHeading, stepSourceNumbers,
  NO_SOURCE, NO_SOURCE_FOUND, HOWTO_LOCK_MS,
} from '../../lib/checklistView.ts'
import { NO_SOURCE as REPORT_NO_SOURCE } from '../../lib/summaryReport.ts'

const it = (category: string, name: string) => ({ category, name })

describe('three groups, in order, empty ones left out', () => {
  test('Must do, Worth doing, To confirm — each in the items\' own order', () => {
    const g = groupItems([it('to_confirm', 'q'), it('must_do', 'a'), it('good_to_have', 'w'), it('must_do', 'b')])
    assert.deepEqual(g.map((x) => x.group.title), ['Must do', 'Worth doing', 'To confirm'])
    assert.deepEqual(g[0].items.map((i) => i.name), ['a', 'b'])
    assert.deepEqual(g.map((x) => x.group.hint(x.items.length)),
      ['in the order to do them · 2', 'advice, not a legal rule · 1', 'open questions · 1'])
  })
  test('a Documents or Audits checklist (no to_confirm) shows only its groups', () => {
    assert.deepEqual(groupItems([it('must_do', 'a')]).map((x) => x.group.title), ['Must do'])
  })
  test('Must do is numbered; "How do I do this?" under Must do and To confirm only', () => {
    const g = groupItems([it('must_do', 'a'), it('good_to_have', 'w'), it('to_confirm', 'q')])
    assert.deepEqual(g.map((x) => [x.group.numbered, x.group.howTo]), [[true, true], [false, false], [false, true]])
  })
  test('an unknown category is shown under its own name, never dropped', () => {
    const g = groupItems([it('later_kind', 'x')])
    assert.equal(g[0].group.title, 'later_kind')
    assert.equal(g[0].items.length, 1)
  })
})

describe('the counts and the words', () => {
  test('must-dos only', () => {
    assert.equal(mustDoLabel(17, 2), '2 of 17 must-dos done')
    assert.equal(mustDoLabel(1, 0), '0 of 1 must-do done')
    assert.equal(mustDoLabel(0, 0), 'No must-dos')
  })
  test('no source: from the conversation, added, or neither', () => {
    assert.equal(noSourceText('conversation'), 'No source cited in the conversation')
    assert.equal(noSourceText('added'), 'No source found')
    assert.equal(noSourceText(null), 'No source given')
    assert.equal(NO_SOURCE, REPORT_NO_SOURCE)
    assert.equal(NO_SOURCE_FOUND, 'No source found')
  })
  test('sources: the list, else the one URL, else a Documents/Audits title with no link', () => {
    assert.deepEqual(itemSources({ sources: [{ title: 'T', url: 'https://ttb.gov', label: 'official' }], source_url: 'x', source_title: 'x' }),
      [{ title: 'T', url: 'https://ttb.gov', label: 'official' }])
    assert.deepEqual(itemSources({ sources: [], source_url: 'https://fda.gov', source_title: null }), [{ title: 'https://fda.gov', url: 'https://fda.gov' }])
    assert.deepEqual(itemSources({ sources: null, source_url: null, source_title: 'DEQ audit, 2026-10-01' }), [{ title: 'DEQ audit, 2026-10-01', url: null }])
    assert.deepEqual(itemSources({ sources: null, source_url: null, source_title: null }), [])
  })
  test('researching: a claim younger than the lock window, by the clock passed in', () => {
    const now = Date.parse('2026-10-04T06:00:00Z')
    assert.equal(isResearching('2026-10-04T05:59:00Z', now), true)
    assert.equal(isResearching(new Date(now - HOWTO_LOCK_MS - 1).toISOString(), now), false)
    assert.equal(isResearching(null, now), false)
  })
  test('the heading and the step numbering', () => {
    assert.equal(howToHeading(2, '2026-10-04'), 'How to do it · checked against 2 sources on 4 October 2026')
    assert.equal(howToHeading(1, '2026-10-04'), 'How to do it · checked against 1 source on 4 October 2026')
    const m = stepSourceNumbers([{ url: 'a' }, { url: 'b' }, { url: 'A' }], (u) => u.toLowerCase())
    assert.deepEqual([...m.entries()], [['a', 1], ['b', 2]])
  })
  test('the route and the page share the lock window', () => {
    const route = readFileSync('app/api/checklist-items/[id]/how-to/route.ts', 'utf8')
    assert.match(route, /import \{ HOWTO_LOCK_MS \} from '@\/lib\/checklistView'/)
  })
  test('the page no longer generates or shows micro-steps', () => {
    const page = readFileSync('app/compliance/page.tsx', 'utf8')
    assert.ok(!page.includes("mode: 'substeps'"))
    assert.ok(!/queueSteps|runStepQueue|MAX_STEPS_IN_FLIGHT/.test(page))
    assert.match(page, /\.is\('parent_item_index', null\)/)
  })
})

describe('numbering tells the truth — only the workspace promises an order', () => {
  test('a workspace checklist: Must do numbered, "in the order to do them · N"', () => {
    const items = [{ category: 'must_do', name: 'a', origin: 'conversation' }]
    const ordered = madeInWorkspace({ document_id: null }, items)
    assert.equal(ordered, true)
    const g = groupItems(items, { ordered })[0].group
    assert.deepEqual([g.numbered, g.hint(1)], [true, 'in the order to do them · 1'])
  })
  test('the box checklist (no origin, no document) is the workspace\'s too', () => {
    assert.equal(madeInWorkspace({ document_id: null }, [{ origin: null }]), true)
  })
  test('Documents (document_id set) and Audits (items with origin document): not numbered, "required · N"', () => {
    const docs = madeInWorkspace({ document_id: 'd1' }, [{ origin: 'document' }])
    const audit = madeInWorkspace({ document_id: null }, [{ origin: 'document' }, { origin: 'document' }])
    assert.deepEqual([docs, audit], [false, false])
    const g = groupItems([{ category: 'must_do' }, { category: 'must_do' }], { ordered: audit })[0].group
    assert.deepEqual([g.title, g.numbered, g.hint(2), g.howTo], ['Must do', false, 'required · 2', true])
  })
  test('Worth doing is unchanged either way', () => {
    assert.equal(groupItems([{ category: 'good_to_have' }], { ordered: false })[0].group.hint(1), 'advice, not a legal rule · 1')
  })
})

describe('one-line source links — Workspace Stage 2, on the ethanol fixture\'s real titles', () => {
  test('"eCFR :: …" keeps the rule, with the host beside it', () => {
    const o = oneLineSource('eCFR :: 27 CFR Part 17 -- Drawback on Taxpaid Distilled Spirits Used in Manufacturing Nonbeverage Products',
      'https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-17')
    assert.equal(o.host, 'ecfr.gov')
    assert.equal(o.title, '27 CFR Part 17 -- Drawback on Taxpaid Distilled Spirits Used in Manufacturing Nonbeverage Products')
    assert.equal(o.full, 'eCFR :: 27 CFR Part 17 -- Drawback on Taxpaid Distilled Spirits Used in Manufacturing Nonbeverage Products')
  })
  test('"… - CCOF.org" loses the site name', () => {
    assert.equal(oneLineSource('Strengthening Organic Enforcement: NOP Import Certificates - CCOF.org',
      'https://ccof.org/news/strengthening-organic-enforcement-nop-import-certificates/').title,
      'Strengthening Organic Enforcement: NOP Import Certificates')
    assert.equal(oneLineSource('National Organic Program Import Certificate Update: Cutoff Date September 19, 2024 - CCOF.org',
      'https://www.ccof.org/news/x').title, 'National Organic Program Import Certificate Update: Cutoff Date September 19, 2024')
  })
  test('"OAR 845-004-0101" is left alone — its hyphens are not a site name', () => {
    assert.deepEqual(oneLineSource('OAR 845-004-0101', 'https://oregon.public.law/rules/oar_845-004-0101'),
      { host: 'oregon.public.law', title: 'OAR 845-004-0101', full: 'OAR 845-004-0101' })
  })
  test('a statute\'s own " - " is kept; a site\'s " - Oregon.gov" or " | PHMSA" goes', () => {
    assert.equal(shortTitle('Chapter 471 - Alcoholic Liquors', 'oregonlegislature.gov'), 'Chapter 471 - Alcoholic Liquors')
    assert.equal(shortTitle('Industrial Alcohol Authority - Oregon.gov', 'oregon.gov'), 'Industrial Alcohol Authority')
    assert.equal(shortTitle('Hazardous Materials | PHMSA', 'phmsa.dot.gov'), 'Hazardous Materials')
  })
  test('Justia\'s chain of " :: " keeps the last link, the section itself', () => {
    assert.equal(shortTitle('2023 Oregon Revised Statutes :: Volume : 14 - Drugs and Alcohol :: Chapter 471 - Alcoholic Liquors Generally :: Section 471.404 - Importing liquor without license prohibited; exceptions; fee.', 'law.justia.com'),
      'Section 471.404 - Importing liquor without license prohibited; exceptions; fee.')
  })
  test('never cut to nothing', () => {
    assert.equal(shortTitle('ab :: c', 'x.gov'), 'ab :: c')
    assert.equal(shortTitle('TTB | x', 'ttb.gov'), 'TTB | x')
  })
  test('the counts', () => {
    assert.equal(thingsToDo(1), '1 thing to do')
    assert.equal(thingsToDo(4), '4 things to do')
  })
})

describe('the summary as an accordion — the page holds the rules (Stage 2)', () => {
  const page = readFileSync('app/compliance/page.tsx', 'utf8')
  const report = page.slice(page.indexOf('function ReportView('), page.indexOf('/** The words for each stage'))
  test('each authority and Sources fold; Still to confirm has no fold', () => {
    assert.match(report, /aria-expanded=\{expanded\}|<FoldRow label=\{g\.authority\}/)
    const confirm = report.slice(report.indexOf('Still to confirm'), report.indexOf('Asked and not answered'))
    assert.ok(!/fold-closed|FoldRow/.test(confirm), 'Still to confirm must never fold')
    assert.match(report, /<FoldRow label="Sources"/)
  })
  test('the order is the one Task 5 built: situation, What applies, Still to confirm, Asked, facts, Sources', () => {
    const at = (t: string) => report.indexOf(t)
    const order = ['AS_OF_LINE(report.as_of)', 'Your situation', 'What applies ·', 'Still to confirm', 'Asked and not answered', '{factsLine}', 'label="Sources"']
    for (let i = 1; i < order.length; i++) assert.ok(at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`)
  })
  test('rows are real buttons with aria-expanded and aria-controls', () => {
    const row = page.slice(page.indexOf('function FoldRow('), page.indexOf('/**\n * THE SUMMARY AS AN ACCORDION'))
    assert.match(row, /<button type="button" onClick=\{onClick\} aria-expanded=\{expanded\} aria-controls=\{controls\}/)
  })
  test('print opens every fold and prints full links, by CSS — not by changing state', () => {
    assert.match(page, /\.fold-closed \{ display: none; \}/)
    assert.match(page, /@media print \{[\s\S]*\.fold-closed \{ display: block !important; \}/)
    assert.match(page, /\.screen-only \{ display: none !important; \}/)
    assert.match(page, /\.print-only \{ display: inline !important; \}/)
  })
  test('every drawer opens folded: the report is keyed by its topic', () => {
    assert.match(page, /<ReportView key=\{summaryDrawer\.id\}/)
  })
})
