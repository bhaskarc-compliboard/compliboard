/**
 * THE PRINT FRAME — `lib/printFrame.ts`, the canvas feature boards, board 10.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { printFrameCss, cssString, printDate } from '../../lib/printFrame.ts'

describe('the frame on every printed page', () => {
  const css = printFrameCss({ company: 'Test Gamma Solvents', type: 'Summary report' })
  test('company top left, uppercase and spaced; the document type top right; a hairline under both', () => {
    assert.match(css, /@top-left \{ content: "Test Gamma Solvents";[^}]*text-transform: uppercase; letter-spacing: 0\.06em/)
    assert.match(css, /@top-right \{ content: "Summary report";/)
    for (const box of ['top-left', 'top-center', 'top-right']) {
      assert.match(css, new RegExp(`@${box} \\{[^}]*border-bottom: 0\\.5pt solid`))
    }
  })
  test('"Prepared with CompliBoard" bottom left; "Page n of N" bottom right, from the browser\'s own counters', () => {
    assert.match(css, /@bottom-left \{ content: "Prepared with CompliBoard";/)
    assert.match(css, /@bottom-right \{ content: "Page " counter\(page\) " of " counter\(pages\);/)
    for (const box of ['bottom-left', 'bottom-center', 'bottom-right']) {
      assert.match(css, new RegExp(`@${box} \\{[^}]*border-top: 0\\.5pt solid`))
    }
  })
  test('the side margins stay at 10mm — wider clipped the right edge in Chrome 154', () => {
    assert.match(css, /margin: 20mm 10mm 18mm 10mm;/)
  })
  test('print only', () => assert.match(css, /^@media print \{/))
})

describe('the pieces', () => {
  test('a company name cannot break out of the CSS string', () => {
    assert.equal(cssString('Smith "& Sons"'), '"Smith \\"& Sons\\""')
    assert.equal(cssString('a\\b'), '"a\\\\b"')
    assert.equal(cssString('line\none'), '"line one"')
  })
  test('dates on paper are absolute', () => {
    assert.equal(printDate('2026-10-03'), '3 October 2026')
    assert.equal(printDate(null), '')
    assert.equal(printDate('not a date'), '')
  })
  test('the title block has no relative date and no "CompliBoard"', () => {
    const drawer = readFileSync('components/Drawer.tsx', 'utf8')
    const block = drawer.slice(drawer.indexOf('<div className="hidden print:block'), drawer.indexOf('<header'))
    assert.match(block, /font-serif/)
    assert.match(block, /Printed \{printDate\(new Date\(\)\)\}/)
    assert.ok(!/CompliBoard/.test(block))
    assert.ok(!/\{sub/.test(block), 'the relative sub line must not print')
  })
  test('every printed drawer names its type', () => {
    const want: Array<[string, string]> = [
      ['app/compliance/page.tsx', 'printType="Summary report"'], ['app/compliance/page.tsx', 'printType="Checklist"'],
      ['components/DocumentReport.tsx', 'printType="Document report"'], ['components/AuditReport.tsx', 'printType="Audit report"']]
    for (const [f, s] of want) assert.ok(readFileSync(f, 'utf8').includes(s), `${f}: ${s}`)
  })
})

/** A file's code without its comments, so a comment that tells the history of `window.print()` is not code. */
const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('one print path for the workspace and the four drawers', () => {
  test('the drawers and the conversation both print through printWithFrame — no copy, no bare window.print()', () => {
    const drawer = code('components/Drawer.tsx')
    assert.match(drawer, /printWithFrame\(visibleDrawer\(\), 'printing-drawer'\)/)
    assert.ok(!/window\.print\(\)/.test(drawer), 'Drawer.tsx must not print by itself')
    const page = code('app/compliance/page.tsx')
    assert.match(page, /printWithFrame\(\{ company: companyName \?\? '', type: 'Conversation' \}\)/)
    assert.ok(!/window\.print\(\)/.test(page), 'the workspace page must not print by itself')
    const lib = code('lib/printFrame.ts')
    assert.equal((lib.match(/window\.print\(\)/g) ?? []).length, 1, 'one window.print(), in printWithFrame')
  })
  test('a printed conversation opens with its title and absolute dates', () => {
    const page = readFileSync('app/compliance/page.tsx', 'utf8')
    assert.match(page, /`Started \$\{printDate\(convo\.created_at\)\}`/)
    assert.match(page, /`Last message \$\{printDate\(convo\.last_turn_at\)\}`/)
  })
})
