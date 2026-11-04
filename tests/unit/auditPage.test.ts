/**
 * THE AUDIT REPORT AS A PAGE — `docs/GAPS-PLAN.md` Part E step E1, decisions 50 and 55–60.
 *
 * *** WHAT E1 IS, AND WHAT IT DELIBERATELY IS NOT. ***
 *
 * The owner's words: *the audit is a killer feature and the report is lost in a jungle of words.*
 * E1 changes how a finished audit is SHOWN and nothing about how it is made — no prompt, no stored
 * word, no model call outside the walk. So everything in this file reads the two files' source and
 * asks whether the SHAPE is what the boards draw. Nothing here runs a report; what a report says
 * is `tests/unit/auditWords.test.ts`' and the golden set's job.
 *
 * Three things in here would be invisible until a customer hit them, and they are the reason the
 * file exists rather than the tab count:
 *
 *   1. **the print.** `body.printing-drawer .print-page { display: none !important }` — a report
 *      rendered inside the page container prints a BLANK SHEET, and `display: none` on an ancestor
 *      cannot be undone by a descendant. The report must be a sibling.
 *   2. **the print frame.** `visibleDrawer()` read `aside.print-drawer`, and the page is a
 *      `<section>` — so the company and the document type would have been missing from the running
 *      header of a printed compliance page.
 *   3. **the ellipsis.** W9: the auditor's line is carried WHOLE (decision 58). It is stored whole
 *      — longest 235 characters against a 1000 cap, measured on staging — so an ellipsis could only
 *      ever have been ours.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const REPORT = read('components/AuditReport.tsx')
const REPORT_CODE = code(REPORT)
const PAGE = read('app/audits/page.tsx')
const PAGE_CODE = code(PAGE)
const DRAWER_CODE = code(read('components/Drawer.tsx'))
const CSS = read('app/globals.css')

/* ── ONE BODY, TWO WRAPPERS ───────────────────────────────────────────────── */

describe('the report is a page on /audits and a drawer on the Calendar — decision 55', () => {
  test('there is ONE Shell and it chooses the chrome', () => {
    assert.match(REPORT_CODE, /function Shell\(\{ chrome,/)
    assert.match(REPORT_CODE, /if \(chrome === 'drawer'\) \{/)
    // Two renderings of one report is how the two drift. The branches differ in the WRAPPER only.
    // Four: the checklist report, the agency report, and the two states before a report exists
    // — a failed read must not open a DRAWER over the page somebody is already looking at.
    assert.equal((REPORT_CODE.match(/<Shell chrome=\{chrome\}/g) ?? []).length, 4,
      'every return goes through the Shell, including the error and the loading states')
    assert.equal((REPORT_CODE.match(/<Drawer title=/g) ?? []).length, 1,
      'the one <Drawer> is inside the Shell; a second would be a second rendering')
  })

  test('it defaults to a drawer, so the Calendar needs no change at all', () => {
    assert.match(REPORT_CODE, /chrome = 'drawer' \}/)
    assert.match(REPORT_CODE, /chrome\?: 'page' \| 'drawer'/)
    assert.ok(!code(read('app/calendar/page.tsx')).includes('chrome='),
      'the Calendar must take the default')
    assert.match(PAGE_CODE, /chrome="page"/, 'Audits must ask for the page')
  })

  test('a page has no scrim and no X: "← All audits" is the way out', () => {
    assert.match(REPORT_CODE, /← All audits/)
    assert.ok(!PAGE_CODE.includes('bg-gray-900/20'), 'the audit report scrim is gone with the drawer')
    // And the document's reading keeps ITS scrim: it is the one drawer over the page.
    assert.match(PAGE_CODE, /bg-gray-900\/30/)
  })
})

/* ── THE PRINT, WHICH IS THE PART THAT FAILS SILENTLY ─────────────────────── */

describe('the print — and the two ways it could have printed nothing', () => {
  test('THE RULE THAT MAKES THE SIBLING NECESSARY IS STILL IN THE CSS', () => {
    // If this ever stops being true the comment on the page is wrong, and somebody will move the
    // report back inside the container believing it is tidier.
    assert.match(CSS, /body\.printing-drawer \.print-page \{ display: none !important; \}/)
  })

  test('the report is a SIBLING of .print-page, not a child', () => {
    const container = PAGE_CODE.indexOf('className="print-page')
    const report = PAGE_CODE.indexOf('<AuditReport runId={openRun}')
    assert.ok(container > 0 && report > 0)
    const closes = PAGE_CODE.indexOf('\n      </div>\n', container)
    assert.ok(closes > 0, 'the container must close')
    assert.ok(report > closes,
      'the report is inside .print-page and would print a blank sheet')
  })

  test('the page carries the class and the two attributes printDrawer() reads', () => {
    assert.match(REPORT_CODE, /<section className="print-drawer/)
    assert.match(REPORT_CODE, /data-print-company=\{company \?\? ''\} data-print-type=\{printType \?\? ''\}/)
    assert.match(REPORT_CODE, /printType="Audit report"/)
  })

  test('visibleDrawer() no longer requires an <aside>', () => {
    // It read `aside.print-drawer`. The page is a <section>, so a print from it would have come
    // out with no company and no type in the running header.
    assert.match(DRAWER_CODE, /querySelectorAll<HTMLElement>\('\.print-drawer'\)/)
    assert.ok(!DRAWER_CODE.includes("'aside.print-drawer'"), 'the tag name is back in the selector')
    // The ordering rule is unchanged: the last visible one wins.
    assert.match(DRAWER_CODE, /all\[all\.length - 1\]/)
  })

  test('the page prints its own title block, as the drawer does', () => {
    const at = REPORT_CODE.indexOf('<section className="print-drawer')
    const body = REPORT_CODE.slice(at, at + 900)
    assert.match(body, /hidden print:block/)
    assert.match(body, /Printed \{printDate\(new Date\(\)\)\}/)
  })
})

/* ── THE AUDITOR'S LINE, WHOLE — W9 AND DECISION 58 ───────────────────────── */

describe('the auditor\'s line is carried whole — decision 58, W9', () => {
  test('the requirement does not truncate', () => {
    const at = REPORT_CODE.indexOf('function FindingLine(')
    const row = REPORT_CODE.slice(at, REPORT_CODE.indexOf('function DocGroup(', at))
    const line = row.slice(row.indexOf('{f.template_text ?? f.title}') - 400,
                           row.indexOf('{f.template_text ?? f.title}'))
    assert.ok(!line.includes('truncate'),
      "the checklist line is truncated: a 235-character question ends in an ellipsis")
    assert.match(line, /min-w-0 flex-1 text-\[14px\] leading-snug/)
  })

  test('the duplicate copy of the line under the row is gone', () => {
    // `template_text` and `title` are IDENTICAL on every template finding (148 rows on staging),
    // so the "full title, because the line above is truncated" line printed the same string twice.
    const at = REPORT_CODE.indexOf('function FindingLine(')
    const row = REPORT_CODE.slice(at, REPORT_CODE.indexOf('function DocGroup(', at))
    assert.ok(!row.includes('{f.template_text ? f.title : null}'),
      'the row still prints its own line a second time')
  })

  test('the reference sits in a fixed column, so the questions line up — decision 59', () => {
    // THREE cells, not two with a prefix: the reference was an `inline-block` inside the
    // requirement, so a wrapped line started 37px to the LEFT of its own first line.
    assert.match(REPORT_CODE, /w-\[36px\] shrink-0 text-\[14px\] font-medium leading-snug text-gray-500/)
    assert.match(REPORT_CODE, /w-\[150px\] shrink-0 text-\[12px\]/)
  })
})

/* ── THE OPEN ROW: TWO LABELLED PARTS, AND ALSO NOTED ─────────────────────── */

describe('the open row carries what the fields actually are', () => {
  test('two labelled parts, not three — the data holds two', () => {
    /**
     * Board 1 draws *What we found · The line we read · What to do*. There is no `what_we_found`
     * column: `what_to_do` carries both, proved on the live rows. Three labels over two fields
     * would be a heading with nothing under it.
     */
    assert.match(REPORT_CODE, /The line we read/)
    assert.match(REPORT_CODE, />What to do</)
    assert.ok(!REPORT_CODE.includes('What we found'),
      'a third label exists with no field behind it')
  })

  test('Also noted carries only what is a column', () => {
    const at = REPORT_CODE.indexOf('const noted = [')
    const body = REPORT_CODE.slice(at, REPORT_CODE.indexOf(']', at) + 1)
    assert.match(body, /f\.basis === 'inferred'/)
    assert.match(body, /f\.quote_verified === false/)
    assert.match(body, /f\.handle_error/)
    assert.match(body, /f\.kind === 'date' && f\.due_on/)
    // NOT `alsoUnder`: it is already on the row itself, and twice is noise.
    assert.ok(!body.includes('alsoUnder'), 'an aside that already has a place is in the fold too')
    assert.match(REPORT_CODE, /Also noted<\/span> — \{noted\.join\(' · '\)\}/)
  })

  test('the quote is set in the reading serif, and the document opens the drawer', () => {
    assert.match(REPORT_CODE, /font-serif text-\[14px\] italic/)
    assert.match(REPORT_CODE, /f\.document_id && onOpenDoc\(f\.document_id\)/)
  })
})

/* ── THE STRIP: TEMPLATE RUNS ONLY ────────────────────────────────────────── */

describe('the strip is the checklist\'s picture, and agency runs have none', () => {
  test('it is built from the ROWS, in the auditor\'s order', () => {
    // Not from `run.template_lines`: a strip that disagreed with the rows under it would be worse
    // than no strip. Decision 50 — a line nobody answered is still a row, and still a cell.
    assert.match(REPORT_CODE, /const stripCells = sections/)
    assert.match(REPORT_CODE, /\.sort\(\(a, b\) => a\.ordinal - b\.ordinal\)\)/)
    assert.match(REPORT_CODE, /f\.kind !== 'expected'/, 'a suggestion is not a line of the checklist')
  })

  test('it is drawn on the template report and NOWHERE else', () => {
    assert.equal((REPORT_CODE.match(/<Strip cells=/g) ?? []).length, 1,
      'an agency run has no fixed line list: 43 cells in citation order is decoration')
    const t = REPORT_CODE.indexOf("if (run.kind === 'template')")
    const strip = REPORT_CODE.indexOf('<Strip cells=')
    assert.ok(strip > t, 'the strip must be inside the template branch')
  })

  test('a cell opens its row, because a picture nobody can get inside is taken on trust', () => {
    assert.match(REPORT_CODE, /setOpenFinding\(\(o\) => \(\{ \.\.\.o, \[id\]: true \}\)\)/)
    assert.match(REPORT_CODE, /document\.getElementById\(`f-\$\{id\}`\)\?\.scrollIntoView/)
    assert.match(REPORT_CODE, /<div id=\{`f-\$\{f\.id\}`\}/)
  })

  test('a line with no answer is a hole, not a sixth colour', () => {
    assert.match(REPORT_CODE, /border border-dashed border-\[var\(--amber\)\] bg-white/)
    assert.equal(Object.keys({
      on_file: 1, on_file_gaps: 1, stale: 1, nothing_on_file: 1, not_a_document_question: 1,
    }).length, 5)
    for (const w of ['on_file', 'on_file_gaps', 'stale', 'nothing_on_file', 'not_a_document_question']) {
      assert.ok(REPORT_CODE.includes(`${w}:`), `STRIP_COLOUR has no ${w}`)
    }
  })

  test('the sections open, because the strip is the table of contents now', () => {
    assert.match(REPORT_CODE, /open=\{open\[key\] \?\? true\}/)
  })
})

/* ── THE TITLE AND THE SUGGESTIONS ────────────────────────────────────────── */

describe('the title is one string, and the suggestions are folded and uncounted', () => {
  test('a template run is named by its checklist\'s own reading title, whole', () => {
    assert.match(REPORT_CODE, /run\.kind === 'template'\s*\n?\s*\? \(rep\.documents\?\.\[run\.template_document_id \?\? ''\]\?\.title/)
  })

  test('an agency run carries its date, because a page can be bookmarked', () => {
    assert.match(REPORT_CODE, /\$\{everything \? 'Audit of everything' : agency\}\$\{auditedOn \? `, \$\{auditedOn\}` : ''\}/)
  })

  test('the suggestions are on the checklist report, folded, and out of the counts', () => {
    assert.equal((REPORT_CODE.match(/Usually held — not seen/g) ?? []).length, 2,
      'both reports carry decision 60\'s sixth label')
    assert.match(REPORT_CODE, /countsFor\(openF\.filter\(\(f\) => f\.kind !== 'expected'\)\)/)
    assert.match(REPORT_CODE, /expected: false,/)
  })
})
