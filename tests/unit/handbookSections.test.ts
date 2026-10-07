/**
 * A HANDBOOK, CUT INTO SECTIONS — `lib/handbookSections.ts`, HR Step 5b. Pure: no model, no database.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  cutAtAnchors, findAnchor, proveCoverage, sectionsFromCuts, wordSections, pageStarts, joinPages, sectionPages,
  looksLikeScan, outlineParts, PAGE_BREAK, splitPages,
} from '../../lib/handbookSections.ts'

const TEXT = 'Contents\n1 Welcome page 2\n1 Welcome to the\ncompany, we are glad you are here today.\n2 Hours and pay Employees are paid every second Friday by deposit.\n3 Sick time Employees accrue one hour for every thirty worked.'

describe('cutting at anchors', () => {
  test('each anchor is found in order, whitespace between words may differ, and the cuts cover the text', () => {
    const { sections, dropped } = cutAtAnchors(TEXT, [
      { title: '1 Welcome', anchor: '1 Welcome to the company, we are glad' },
      { title: '2 Hours and pay', anchor: '2 Hours and pay Employees are paid every' },
      { title: '3 Sick time', anchor: '3 Sick time Employees accrue one hour' },
    ])
    assert.equal(dropped.length, 0)
    assert.deepEqual(sections.map((s) => s.title), ['1 Welcome', '2 Hours and pay', '3 Sick time'])
    assert.ok(sections[0].text.startsWith('Contents'), 'the contents page before the first heading stays, in the first section')
    assert.ok(sections[1].text.startsWith('2 Hours and pay'))
    assert.equal(proveCoverage(TEXT, sections), null)
  })
  test('the contents line is not taken for the section: 6 to 12 words must match, not the title alone', () => {
    assert.equal(findAnchor(TEXT, '1 Welcome to the company, we are glad', 0), TEXT.indexOf('1 Welcome to the'))
  })
  test('A MISSING ANCHOR is dropped and counted, and its text stays in the section before', () => {
    const { sections, dropped } = cutAtAnchors(TEXT, [
      { title: '1 Welcome', anchor: '1 Welcome to the company, we are glad' },
      { title: '2 Hours', anchor: '2 Hours and wages Employees are paid weekly' },       // reworded: not in the text
      { title: '3 Sick time', anchor: '3 Sick time Employees accrue one hour' },
    ])
    assert.deepEqual(dropped.map((d) => d.title), ['2 Hours'])
    assert.deepEqual(sections.map((s) => s.title), ['1 Welcome', '3 Sick time'])
    assert.ok(sections[0].text.includes('2 Hours and pay'))
    assert.equal(proveCoverage(TEXT, sections), null)
  })
  test('an anchor that goes backwards, or repeats the previous cut, is dropped', () => {
    const { sections, dropped } = cutAtAnchors(TEXT, [
      { title: '3', anchor: '3 Sick time Employees accrue one hour' },
      { title: '2', anchor: '2 Hours and pay Employees are paid every' },
      { title: '3 again', anchor: '3 Sick time Employees accrue one hour' },
    ])
    assert.deepEqual(dropped.map((d) => d.title), ['2', '3 again'])
    assert.equal(sections.length, 1)
    assert.equal(proveCoverage(TEXT, sections), null)
  })
  test('no anchor found: the whole handbook is one section', () => {
    const { sections } = cutAtAnchors(TEXT, [{ title: 'x', anchor: 'nothing like this is in the text at all' }])
    assert.equal(sections.length, 1); assert.equal(sections[0].text, TEXT); assert.equal(sections[0].title, null)
  })
})

describe('THE COVERAGE PROOF', () => {
  const ok = sectionsFromCuts('abcdefghij', [{ start: 0, title: 'a' }, { start: 4, title: 'b' }])
  test('passes when the sections join to the whole text', () => assert.equal(proveCoverage('abcdefghij', ok), null))
  test('refuses a gap', () => {
    const gap = [ok[0], { ...ok[1], start: 5, text: 'fghij' }]
    assert.match(proveCoverage('abcdefghij', gap)!, /gap between sections 0 and 1/)
  })
  test('refuses an overlap', () => {
    const over = [ok[0], { ...ok[1], start: 3, text: 'defghij' }]
    assert.match(proveCoverage('abcdefghij', over)!, /overlap/)
  })
  test('refuses a section whose text is not the text at its place', () => {
    assert.match(proveCoverage('abcdefghij', [ok[0], { ...ok[1], text: 'EFGHIJ' }])!, /not the text/)
  })
  test('refuses a missing end, and a missing beginning', () => {
    assert.match(proveCoverage('abcdefghij', [ok[0], { ...ok[1], end: 9, text: 'efghi' }])!, /ends at 9/)
    assert.match(proveCoverage('abcdefghij', [{ ...ok[1] }])!, /starts at 4/)
  })
})

describe('Word: the document\'s own headings', () => {
  const html = '<p>Riverside Bakery Handbook</p><h1>1. Welcome</h1><p>Hello.</p><h2>2.1 Breaks &amp; meals</h2><p>Rest.</p><h1></h1><p>x</p>'
  test('a section starts at each non-empty heading; text before the first stays in the first', () => {
    const s = wordSections(html)
    assert.deepEqual(s.map((x) => x.title), ['1. Welcome', '2.1 Breaks & meals'])
    assert.ok(s[0].text.startsWith('<p>Riverside'))
    assert.equal(proveCoverage(html, s), null)
  })
  test('no headings: one section', () => assert.equal(wordSections('<p>only text</p>').length, 1))
})

describe('pages', () => {
  const pages = ['Page one text.', 'Page two text.', 'Page three.']
  const text = joinPages(pages)
  test('a section knows its pages, and a newline between pages does not count', () => {
    const starts = pageStarts(pages)
    const s = sectionsFromCuts(text, [{ start: 0, title: 'a' }, { start: text.indexOf('Page two'), title: 'b' }])
    assert.deepEqual(sectionPages(text, starts, s[0]), { page_from: 1, page_to: 1 })
    assert.deepEqual(sectionPages(text, starts, s[1]), { page_from: 2, page_to: 3 })
  })
  test('a long handbook is outlined in parts, never splitting a page, and the parts join back to the text', () => {
    const many = Array.from({ length: 120 }, (_, i) => `page ${i + 1} `.padEnd(1000, 'x'))
    const parts = outlineParts(many, 30_000)
    assert.ok(parts.length > 1)
    assert.equal(parts[0].from, 1); assert.equal(parts[parts.length - 1].to, 120)
    for (let i = 1; i < parts.length; i++) assert.equal(parts[i].from, parts[i - 1].to + 1)
    assert.ok(parts.every((p) => p.text.length <= 30_000))
    assert.equal(parts.map((p) => p.text).join(PAGE_BREAK), joinPages(many))
  })
})

describe('a scan', () => {
  test('no text to speak of is a scan; a page of words is not', () => {
    assert.equal(looksLikeScan('', 2), true)
    assert.equal(looksLikeScan('  \n 12 \n', 1), true)
    assert.equal(looksLikeScan('Employees accrue one hour of sick time for every thirty hours worked.', 1), false)
  })
})
