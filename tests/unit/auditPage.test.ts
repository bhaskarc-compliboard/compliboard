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
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const REPORT = read('components/AuditReport.tsx')
const REPORT_CODE = code(REPORT)
/**
 * *** THE WORDS, THE ORDER AND THE PALETTE MOVED TO `lib/auditRows.ts` AT PART C. ***
 * The binder (`components/AuditBinder.tsx`) prints the same rows as the report page, so one file
 * holds the vocabulary both draw: the five labels, their order, the four tints and the ordering
 * rules. Every assertion below that used to read the component now reads the module — the rule
 * each one protects is unchanged, and the point of E1a's palette tests is stronger for it: there
 * is one file to look in, not two.
 */
const ROWS = read('lib/auditRows.ts')
const ROWS_CODE = code(ROWS)
const BINDER = read('components/AuditBinder.tsx')
const BINDER_CODE = code(BINDER)
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
    assert.match(REPORT_CODE, /chrome = 'drawer', onPrintBinder \}/)
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
    //
    // *** THE TYPE MOVED AT E1a AND THE COLUMN DID NOT. *** The reference is board 1's own
    // 13px/600 now instead of 14px/500, and the word's column is the board's 132px PILL instead of
    // a 150px cell of coloured text. What decision 59 is about is the fixed width, and both are
    // still fixed — the pixel check is in the E1a block below.
    assert.match(REPORT_CODE, /w-\[36px\] shrink-0 text-\[13px\] font-semibold leading-5 text-gray-700/)
    assert.match(REPORT_CODE, /w-\[132px\] shrink-0 rounded-full/)
    assert.ok(!REPORT_CODE.includes('w-[150px]'), 'the old word cell is back')
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
    // Board 1 writes it "▸ Also noted — 3 things: …", with the things on the line.
    assert.match(REPORT_CODE, /Also noted<\/span>/)
    assert.match(REPORT_CODE, /\{noted\.length\} thing\{noted\.length === 1 \? '' : 's'\}: \{noted\.join\(' · '\)\}/)
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
    // The order itself lives in `lib/auditRows.ts` `orderedRows` since Part C, so the strip, the
    // report's rows and the binder's tabs cannot fall into three different orders.
    assert.match(REPORT_CODE, /const stripCells = orderedRows\(sections, openF\)/)
    assert.match(ROWS_CODE, /export function orderedRows/)
    assert.match(ROWS_CODE, /\.sort\(\(a, b\) => a\.ordinal - b\.ordinal\)\)/)
    assert.match(ROWS_CODE, /f\.kind !== 'expected'/, 'a suggestion is not a line of the checklist')
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
    assert.match(ROWS_CODE, /border border-dashed border-\[var\(--amber\)\] bg-white/)
    // The strip and the binder both draw it from the one constant.
    assert.match(REPORT_CODE, /: TINT_NO_ANSWER\}`\}/)
    assert.match(BINDER_CODE, /TINT_NO_ANSWER/)
    assert.equal(Object.keys({
      on_file: 1, on_file_gaps: 1, stale: 1, nothing_on_file: 1, not_a_document_question: 1,
    }).length, 5)
    for (const w of ['on_file', 'on_file_gaps', 'stale', 'nothing_on_file', 'not_a_document_question']) {
      assert.ok(ROWS_CODE.includes(`${w}:`), `WORD_TINT has no ${w}`)
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

/* ── E1a: BOARD 1'S LAYOUT, NOT ONLY ITS COLOURS ──────────────────────────── */

/**
 * *** WHY A PALETTE GETS A TEST OF ITS OWN. ***
 *
 * The same word is drawn three times on one page — in the strip, in the counts under it, and as
 * the row's own pill — and the three used to be three different pieces of styling: solid
 * saturated blocks with white text, grey/dark chips, and coloured text. Three copies of a colour
 * is three copies that drift, and the one that drifts is the one nobody is looking at.
 *
 * So these tests are about the SINGLE SOURCE, not about which green it is: the hex values appear
 * once in the whole app, in the palette, and all three places read it by name.
 */
const BOARDS = read('docs/audit-report-boards.html')
const TINTS = ['#DCEFE3', '#1F5A3A', '#FCEBC6', '#7A4F0F', '#F8D7D3', '#7A1F17', '#E9EBEF', '#4B5563']

describe('the five words have one palette — E1a item 2', () => {
  test('the tints are the BOARD\'s own values, copied out of the file', () => {
    // Not matched by eye: `docs/audit-report-boards.html:149` is `.c-green`, `.c-amber`, `.c-red`,
    // `.c-grey`, and every one of the eight values is in it.
    for (const hex of TINTS) {
      assert.ok(BOARDS.includes(hex), `${hex} is not a colour board 1 uses`)
    }
  })

  test('each value appears in exactly ONE file, and that file is the palette', () => {
    const files = execSync("grep -rl -- '#DCEFE3\\|#FCEBC6\\|#F8D7D3\\|#E9EBEF' app lib components || true",
      { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    assert.deepEqual(files, ['lib/auditRows.ts'],
      'a second file carries the tints and the two will drift')
    for (const hex of TINTS) {
      assert.equal((ROWS_CODE.match(new RegExp(hex, 'g')) ?? []).length, 1,
        `${hex} is written more than once inside the palette's own file`)
    }
  })

  test('the strip, the counts and the row pill all read WORD_TINT', () => {
    const at = (name: string) => REPORT_CODE.indexOf(name)
    for (const [name, from, to] of [
      ['the strip', 'function Strip(', 'function Counts('],
      ['the counts', 'function Counts(', 'function WordCountsPrint('],
      ['the row pill', 'const pill =', 'const noted = ['],
    ] as Array<[string, string, string]>) {
      const block = REPORT_CODE.slice(at(from), at(to))
      assert.ok(block.length > 0, `${name} is not where this test thinks it is`)
      assert.match(block, /WORD_TINT\[/, `${name} does not read the palette`)
    }
    // And the binder's pill is the fourth reader of the same map — Part C, decision 61.
    assert.match(BINDER_CODE, /WORD_TINT\[f\.word\] \?\? TINT_GREY/)
    assert.match(ROWS_CODE, /export const WORD_TINT: Record<string, string> = \{/)
    // nothing_on_file is the PINK in all three, because all three read one map.
    assert.match(ROWS_CODE, /nothing_on_file: TINT_PINK/)
    assert.match(ROWS_CODE, /nothing_on_file: INK_PINK/)
    // The ink map is built FROM the same four values, not written out again: `TINT_PINK` is
    // `bg-[#F8D7D3] ${INK_PINK}`, so there is one place to change a colour and not two.
    assert.match(ROWS_CODE, /export const TINT_PINK = `bg-\[#F8D7D3\] \$\{INK_PINK\}`/)
    assert.match(ROWS_CODE, /not_a_document_question: TINT_GREY/)
    assert.match(ROWS_CODE, /on_file: TINT_GREEN/)
    assert.match(ROWS_CODE, /on_file_gaps: TINT_AMBER/)
    assert.match(ROWS_CODE, /stale: TINT_AMBER/)
  })

  test('there is still ONE label per word: the pill capitalises in CSS', () => {
    // The counts read "4 on file" and board 1's pill reads "On file". A second map of capitalised
    // labels is how `lib/documentStatus.ts`'s note about four copies of KIND_WORD happened.
    assert.match(REPORT_CODE, /first-letter:uppercase/)
    assert.equal((ROWS_CODE.match(/on_file_gaps: 'on file, gaps found'/g) ?? []).length, 1)
    assert.ok(!REPORT_CODE.includes("on_file_gaps: 'on file, gaps found'"),
      'the component carries a second copy of the labels')
  })
})

describe('the strip and the counts are board 1\'s top of page — E1a items 2 and 3', () => {
  test('the cells stretch the full width', () => {
    const strip = REPORT_CODE.slice(REPORT_CODE.indexOf('function Strip('),
                                    REPORT_CODE.indexOf('function Counts('))
    assert.match(strip, /min-w-0 flex-1/, 'the cells are packed left again')
    assert.ok(!strip.includes('min-w-[34px]'), 'the old fixed cell is back')
    assert.ok(!strip.includes('flex-wrap'), 'board 1 draws one row, not a block of chips')
  })

  test('the counts row has no "all" chip, and the selected one clears itself', () => {
    const counts = REPORT_CODE.slice(REPORT_CODE.indexOf('function Counts('),
                                     REPORT_CODE.indexOf('function WordCountsPrint('))
    assert.ok(!/>all</.test(counts), 'the "all" chip is back')
    assert.ok(!counts.includes('onChange(null)}'), 'a control that only clears is the "all" chip again')
    // Pressing the one that is on shows them all again — which is what the chip used to do.
    assert.match(counts, /onChange\(value === c\.word \? null : c\.word\)/)
    assert.match(counts, /value === c\.word \? `\$\{WORD_TINT\[c\.word\] \?\? TINT_GREY\} ring-1/)
    // The count in the word's own ink, the words after it muted — board 3's treatment of the same
    // five numbers. Board 1 draws them in plain dark text; the brief puts the palette on them and
    // the brief wins, which is written on the map itself.
    assert.match(counts, /WORD_INK\[c\.word\] \?\? INK_GREY/)
  })

  test('the checklist report puts the totals at the right-hand end, from the cells themselves', () => {
    // "10 lines · 3 sections · 11 documents read". The lines are `stripCells.length`, so the
    // number beside the strip and the strip cannot disagree.
    assert.match(REPORT_CODE, /const tRight = `\$\{stripCells\.length\} line/)
    assert.match(REPORT_CODE, /<Counts counts=\{tCounts\} value=\{wordFilter\} onChange=\{setWordFilter\} right=\{tRight\}/)
    assert.match(REPORT_CODE, /<WordCountsPrint counts=\{tCounts\} right=\{tRight\}/)
    // The agency report has no fixed line list, so no strip and no line count — the counts only.
    assert.match(REPORT_CODE, /<Counts counts=\{countsFor\(plain\)\} value=\{wordFilter\} onChange=\{setWordFilter\} \/>/)
  })

  test('the strip comes first, then the counts, then the lede', () => {
    const t = REPORT_CODE.indexOf("if (run.kind === 'template')")
    const strip = REPORT_CODE.indexOf('<Strip cells=', t)
    const counts = REPORT_CODE.indexOf('<Counts counts={tCounts}', t)
    const lede = REPORT_CODE.indexOf('Every line below is a line of your checklist', t)
    assert.ok(strip > 0 && counts > strip && lede > counts,
      'board 1 reads strip, counts, lede, sections — in that order')
  })
})

describe('the row is board 1\'s four columns — E1a item 5', () => {
  const ROW = REPORT_CODE.slice(REPORT_CODE.indexOf('function FindingLine('),
                                REPORT_CODE.indexOf('function DocGroup('))

  test('four fixed columns and nothing between them', () => {
    assert.match(ROW, /w-3 shrink-0 text-\[11px\] leading-5/)          // the chevron
    assert.match(ROW, /w-\[132px\] shrink-0 rounded-full/)              // the pill
    assert.match(ROW, /w-\[36px\] shrink-0 text-\[13px\]/)              // the reference
    assert.match(ROW, /min-w-0 flex-1 text-\[14px\] leading-snug/)      // the requirement
    assert.match(ROW, /w-\[260px\] min-w-0 max-w-\[28%\] text-right/)    // the document
    assert.match(ROW, /items-start gap-3/, 'board 1 aligns the row to the top, at a 12px gutter')
  })

  test('nothing is a column that only SOME rows have', () => {
    // `also under …` and `no document matched` were `shrink-0` spans of their own between the
    // requirement and the document — a fifth column on some rows only, which is what makes the
    // rows without it look misaligned. Both are inside the requirement's cell now.
    const req = ROW.slice(ROW.indexOf('{f.template_text ?? f.title}'), ROW.indexOf('{showDoc && ('))
    assert.match(req, /also under \{alsoUnder\}/)
    assert.match(req, /no document matched/)
    assert.ok(!req.includes('shrink-0'), 'an aside is a column again')
  })

  test('the document column is the CHECKLIST report\'s, because the agency report groups by document', () => {
    assert.match(ROW, /showDoc\?: boolean/)
    assert.equal((REPORT_CODE.match(/<FindingLine key=\{f\.id\} f=\{f\} showDoc/g) ?? []).length, 1,
      'exactly one report passes it, and it is the one with no DocGroup')
    // An em dash where there is nothing, which on this report is the mark of a line with nothing
    // on file — board 1 draws exactly that.
    assert.match(ROW, /\) : <span className="text-gray-400">—<\/span>\}/)
  })

  test('the word is a PILL, and no word is coloured text any more', () => {
    assert.ok(!ROW.includes("AMBER_WORD.has(f.word) ? 'text-[var(--amber)]' : 'text-gray-600'"),
      'the word is coloured text again: "on file" and "not a document question" look the same')
    // AMBER_WORD still has a job — it is what "Make a checklist" collects — so it stays.
    assert.match(REPORT_CODE, /AMBER_WORD\.has\(f\.word \?\? ''\)/)
  })

  test('the open part is indented under the row\'s text, not under the chevron', () => {
    // 24px to the left of the requirement column, which is where board 1 puts it against its own
    // grid — the row's requirement starts at 216, so the fold starts at 192.
    assert.match(ROW, /pb-3 pl-\[192px\]/)
    assert.ok(!ROW.includes("'pb-3 pl-5'"), 'the fold starts a new left edge of its own again')
  })
})

describe('the print carries the picture and the whole line — E1a', () => {
  test('ONE rule makes a tint survive the printer, and it is scoped to one class', () => {
    // A browser drops background colours on paper by default: without this the ten cells and
    // every pill print as identical white capsules, on the copy that goes to an inspector.
    assert.match(CSS, /\.print-tint \{ -webkit-print-color-adjust: exact; print-color-adjust: exact; \}/)
    const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    assert.equal((rules.match(/print-color-adjust/g) ?? []).length, 2, 'both spellings, once each')
  })

  test('the strip and the pill carry it; the counts row prints as words', () => {
    assert.match(REPORT_CODE, /className=\{`print-tint flex h-\[34px\]/)
    assert.match(REPORT_CODE, /const pill = 'print-tint mt-px w-\[132px\]/)
    const counts = REPORT_CODE.slice(REPORT_CODE.indexOf('function Counts('),
                                     REPORT_CODE.indexOf('function WordCountsPrint('))
    assert.match(counts, /no-print/, 'a ring and a hover are screen furniture')
    assert.ok(!counts.includes('print-tint'))
  })
})

describe('the footer is board 1\'s row — E1a item 8', () => {
  test('the order is Audit again · Print · Make a checklist · Download the files · Not right', () => {
    const foot = REPORT_CODE.slice(REPORT_CODE.indexOf('const footer = ('),
                                   REPORT_CODE.indexOf('const WORDS_IN_ORDER'))
    const order = ['Audit again', '>Print<', 'Make a checklist', 'Print the binder', 'Not right']
    let at = -1
    for (const bit of order) {
      const next = foot.indexOf(bit)
      assert.ok(next > at, `${bit} is out of board 1's order`)
      at = next
    }
  })

  test('the zip\'s button is gone: Part C replaced it, as §143 said it would', () => {
    assert.ok(!REPORT_CODE.includes('Download the documents'),
      'the button still calls the raw files "the documents", which reads as the report')
    assert.ok(!REPORT_CODE.includes('Download the files'), 'the zip button is still there')
    // And it is no longer pushed to the far right, where the closing sentence belongs.
    assert.ok(!REPORT_CODE.includes('ml-auto text-[14px] text-gray-600'))
  })

  test('the closing sentence is the board\'s, and it names this run\'s own date', () => {
    assert.match(REPORT_CODE, /Every audit is kept\. This one is exactly what it said on \{auditedOn\}\./)
  })

  test('the five actions never break mid-phrase, and the sentence is the PAGE\'s', () => {
    // Photographed in the Calendar's 720px drawer: the sentence took the room the actions needed
    // and four of the five broke onto two lines ("Not / right"). The actions are what a footer is
    // for; the commentary stands down where there is no room for it.
    const foot = REPORT_CODE.slice(REPORT_CODE.indexOf('const footer = ('),
                                   REPORT_CODE.indexOf('const WORDS_IN_ORDER'))
    assert.equal((foot.match(/whitespace-nowrap/g) ?? []).length, 5, 'one per action')
    assert.match(foot, /\{chrome === 'page' && \(/)
  })

  test('the binder control is REAL now, and it was never greyed first', () => {
    // Decision 57 held it back to Part C hidden rather than disabled, because a greyed control
    // promises something. It arrived as a working control and the word is "Print", not "Build":
    // the browser makes it (decision 61).
    assert.ok(!REPORT_CODE.includes('Build the binder'))
    assert.match(REPORT_CODE, /Print the binder/)
  })
})

describe('one meta line, and the two notes that were wrong — E1a item 1', () => {
  test('the line is built once and carries "you asked"', () => {
    assert.match(REPORT_CODE, /`audited \$\{fmt\(run\.finished_at \?\? run\.created_at\)\}`/)
    assert.match(REPORT_CODE, /run\.scope \? `you asked: “\$\{run\.scope\}”` : ''/)
    // Not a fourth grey paragraph under the title on either report.
    assert.ok(!REPORT.includes('You asked: &ldquo;'), 'the scope is a line of its own again')
    // The checklist report's sections and documents are on the counts row, not in the meta line.
    assert.match(REPORT_CODE, /run\.kind === 'template' \? '' : counted/)
  })

  test('the issuer is NOT in the meta line, because there is no issuer field', () => {
    // Board 1's line starts "Northwest Supplier Assurance Program, revision 2026-03 · ". The scan
    // writes ONE string and the issuer is inside the title; `document_index_v` has no issuer or
    // revision column to read instead. GAPS-PLAN §7 holds the split, with the prompt change.
    assert.ok(!REPORT_CODE.includes('issuer'), 'a field that does not exist is being rendered')
  })

  test('the read-only note is drawn ONCE per report, and both reports draw it', () => {
    // Commit 10786ee put it in twice, one line after the other, and both copies landed in the
    // checklist branch — so a paused customer saw two panels there and NONE on an agency report.
    assert.equal((REPORT_CODE.match(/<PausedNote banner=\{paused\} \/>/g) ?? []).length, 2,
      'one per report: two panels, or a paid control with nothing saying why it is off')
  })

  test('"Not right" on the run has somewhere to put the answer on BOTH reports', () => {
    assert.equal((REPORT_CODE.match(/reasonFor === 'run' && \(/g) ?? []).length, 2,
      'the footer sets it on both reports and only one of them drew the box')
  })
})

describe('the suggestions are one folded grey line at the foot — E1a item 7', () => {
  test('the checklist report draws board 1\'s panel, not another section heading', () => {
    // The checklist branch runs from its own `if` to the agency report's return. Both reports
    // carry decision 60's label; only the AGENCY one still carries it as a section heading, which
    // is right there — that report is a column of folded sections and this one is a list of rows.
    const from = REPORT_CODE.indexOf("if (run.kind === 'template')")
    // The agency report's Shell is the one that breaks the line after the title — the checklist's
    // passes `sub` on the same line — which is how the two are told apart by position.
    const to = REPORT_CODE.indexOf('<Shell chrome={chrome} title={titleText}\n')
    assert.ok(from > 0 && to > from, 'the two branches are not where this test thinks they are')
    const tmpl = REPORT_CODE.slice(from, to)
    assert.match(tmpl, /rounded-lg border border-gray-100 bg-gray-50 px-3\.5 py-3/)
    assert.match(tmpl, /\{open\.expected \? '▾' : '▸'\}/)
    assert.ok(!/title="Usually held — not seen/.test(tmpl),
      'it is a section heading again, with the weight of the checklist\'s own answers')
    assert.match(REPORT_CODE.slice(to), /title="Usually held — not seen/)
  })

  test('it still prints, folded or not, and is still out of every count', () => {
    assert.match(REPORT_CODE, /'hidden print:mt-2 print:block'/)
    assert.match(REPORT_CODE, /countsFor\(openF\.filter\(\(f\) => f\.kind !== 'expected'\)\)/)
    assert.match(REPORT_CODE, /expected: false,/)
  })
})

/* ── PART C: THE BINDER — decision 61 ─────────────────────────────────────── */

/**
 * *** THESE RUN THE RULES, THEY DO NOT READ THEM. ***
 *
 * `lib/auditRows.ts` is pure on purpose — it imports nothing, so a test can call it. The numbering
 * a binder's tabs depend on is therefore checked by numbering some findings, not by matching a
 * regular expression against the source. Everything in this file above it is a SHAPE test because
 * there is no renderer here; this part needs none.
 */
import {
  citationOrder, citedDocumentIds, documentNumbers, pageFromLocator, citeLabel, orderedRows,
  plainTextOf,
} from '../../lib/auditRows.ts'

const f = (id: string, doc: string | null, extra: Partial<{
  section_id: string; ordinal: number; kind: string; document_b_id: string | null; locator: string | null
}> = {}) => ({
  id, document_id: doc, document_b_id: extra.document_b_id ?? null,
  section_id: extra.section_id ?? 's1', ordinal: extra.ordinal ?? 0,
  kind: extra.kind ?? 'finding', locator: extra.locator ?? null,
})

describe('the binder numbers documents by first citation — decision 57', () => {
  test('one number per document, however many rows cite it', () => {
    const rows = [f('1', 'A'), f('2', 'B'), f('3', 'A'), f('4', 'C'), f('5', 'B')]
    assert.deepEqual(citedDocumentIds(rows), ['A', 'B', 'C'])
    assert.deepEqual([...documentNumbers(rows)], [['A', 1], ['B', 2], ['C', 3]])
  })

  test('a contradiction cites TWO documents and both get a number, in the order written', () => {
    const rows = [f('1', 'A', { document_b_id: 'B', kind: 'contradiction' }), f('2', 'C')]
    assert.deepEqual(citedDocumentIds(rows), ['A', 'B', 'C'])
  })

  test('a row with nothing on file adds no tab', () => {
    assert.deepEqual(citedDocumentIds([f('1', null), f('2', 'A'), f('3', null)]), ['A'])
  })

  test('the TABS are the cited documents; the read-only ones are not tabs', () => {
    // `citationOrder` appends everything the run read, which is right for the report's last page
    // and wrong for the binder: eleven documents nothing cites would be eleven tabs to leaf past.
    const rows = [f('1', 'A')]
    assert.deepEqual(citationOrder(rows, ['A', 'B', 'C']), ['A', 'B', 'C'])
    assert.deepEqual(citedDocumentIds(rows), ['A'])
  })

  test('the auditor\'s order is section by section, and a suggestion is not a line', () => {
    const sections = [{ id: 's2', ordinal: 2 }, { id: 's1', ordinal: 1 }]
    const rows = [
      f('b', 'A', { section_id: 's2', ordinal: 1 }),
      f('a2', 'A', { section_id: 's1', ordinal: 2 }),
      f('a1', 'A', { section_id: 's1', ordinal: 1 }),
      f('x', 'A', { section_id: 's1', ordinal: 3, kind: 'expected' }),
    ]
    assert.deepEqual(orderedRows(sections, rows).map((r) => r.id), ['a1', 'a2', 'b'])
  })
})

describe('a row cites "Document n, page p" — and only a page the locator names', () => {
  test('the page comes off the real column\'s own shapes', () => {
    // Every one of these is a locator read off staging, not an invented example.
    assert.equal(pageFromLocator('page 1, header table'), 'page 1')
    assert.equal(pageFromLocator('Page 1, September table and supervisor review section'), 'page 1')
    assert.equal(pageFromLocator('Pages 1–2, August and September 2026 tables'), 'pages 1–2')
    assert.equal(pageFromLocator('Section 1, page 2'), 'page 2')
    assert.equal(pageFromLocator('next six-year maintenance due dates shown on page 1'), 'page 1')
    // The FIRST page named wins: a finding that spans two pages starts on the first.
    assert.equal(pageFromLocator('page 1, operator table; page 2'), 'page 1')
  })

  test('a locator with no page gives the document alone, and nothing is invented', () => {
    assert.equal(pageFromLocator('Section 3, chemical inventory; Section 6, training'), null)
    assert.equal(pageFromLocator(null), null)
    assert.equal(citeLabel(3, 'Section 3, chemical inventory'), 'Document 3')
    assert.equal(citeLabel(3, 'page 1, operator table'), 'Document 3, page 1')
    // No document, no citation — a line with nothing on file cites nothing.
    assert.equal(citeLabel(undefined, 'page 1'), null)
  })
})

describe('the rows are written once, and the binder reads them — decision 61', () => {
  test('the report, the binder and the module are one chain', () => {
    assert.match(REPORT_CODE, /from '@\/lib\/auditRows'/)
    assert.match(BINDER_CODE, /from '@\/lib\/auditRows'/)
    assert.match(ROWS_CODE, /export function citationOrder/)
    // The component no longer owns it: a second `export function citationOrder` is a second rule.
    assert.ok(!REPORT_CODE.includes('export function citationOrder'))
  })

  test('the zip route and its button are gone, and nothing calls them', () => {
    assert.ok(!existsSync('app/api/audit-runs/[id]/documents/route.ts'),
      'the zip route is still there; it hand-copied citationOrder and failed over 4.5 MB')
    // CODE, not comments: `components/AuditReport.tsx` keeps a paragraph saying what was deleted
    // and why, which is the record of a decision and not a caller.
    for (const [file, src] of [['components/AuditReport.tsx', REPORT_CODE],
                               ['app/audits/page.tsx', PAGE_CODE],
                               ['components/AuditBinder.tsx', BINDER_CODE]] as Array<[string, string]>) {
      assert.ok(!src.includes('downloadDocuments'), `${file} still calls the zip`)
      assert.ok(!/audit-runs\/[^'"`]*\/documents/.test(src), `${file} still fetches the zip`)
    }
  })

  test('the module stays pure, so the binder never counts as a paid route', () => {
    // `scripts/check-schema-contracts.js` makes any route that can REACH lib/ai.ts call
    // requireAccess (PAID_COUNT). The binder calls no model; an import is how that would change.
    assert.ok(!/^import /m.test(ROWS_CODE.replace(/^\s*$/gm, '')),
      'lib/auditRows.ts imports something; it must import nothing at all')
  })
})

describe('what the binder lays out — decision 61 and the Part C map\'s words', () => {
  test('the cover says who, what, when, how many, and who prepared it', () => {
    assert.match(BINDER_CODE, /Audited \{auditedOn\} · Printed \{printDate\(new Date\(\)\)\}/)
    assert.match(BINDER_CODE, /Prepared with CompliBoard\./)
    assert.match(BINDER_CODE, /None of it is a verdict on whether the company complies\./)
    // The auditor's own title, whole — decision 57, and the same expression the report uses.
    assert.match(BINDER_CODE, /rep\.documents\?\.\[run\.template_document_id \?\? ''\]\?\.title/)
  })

  test('one header sheet per cited document, each starting a new page', () => {
    assert.match(BINDER_CODE, /\{\(tabs \?\? \[\]\)\.map\(\(t\) => \(/)
    assert.match(BINDER_CODE, /Document \{t\.n\}/)
    assert.match(BINDER_CODE, /cited by \$\{t\.citedBy\.join\(', '\)\}/)
    assert.match(BINDER_CODE, /style=\{\{ breakBefore: 'page' \}\}/)
  })

  test('a file we could not fetch is a page that says so, and the cover counts it', () => {
    assert.match(BINDER_CODE, /This file could not be fetched on \$\{when\}\./)
    assert.match(BINDER_CODE, /Its record and its reading are intact/)
    assert.match(BINDER_CODE, /\{missing\} file\{missing === 1 \? '' : 's'\} could not be fetched/)
    // §5.1: it never says what is IN a file it could not read, and never blames the person.
    assert.ok(!/your file|you (did|should)/i.test(BINDER_CODE))
  })

  test('a Word original is the stored text, read under RLS as the caller, and says so', () => {
    assert.match(BINDER_CODE, /createClient\(\)\.from\('document_scans'\)/)
    assert.match(BINDER_CODE, /\.select\('document_id, extracted_text'\)/)
    assert.match(BINDER_CODE, /\.eq\('is_current', true\)/)
    assert.ok(!BINDER_CODE.includes('supabaseAdmin'), 'the binder must read as the person')
    assert.match(BINDER_CODE, /A text rendering of \$\{what\}; the original is on file in CompliBoard\./)
  })

  test('the files come down the path "Open the file" already uses', () => {
    // B2's decision 53: that route hands over the CONVERTED copy when there is one, which is
    // exactly what a binder wants for a HEIC or a multi-page TIFF.
    assert.match(BINDER_CODE, /'\/api\/document-actions'/)
    assert.match(BINDER_CODE, /action: 'file_url'/)
    assert.match(BINDER_CODE, /Preparing the binder… \$\{i \+ 1\} of \$\{cited\.length\}/)
  })

  test('pdf.js is loaded ONLY when a binder is being prepared', () => {
    // 1.6 MB of PDF machinery on a page that is not a binder is a page nobody asked to be slower.
    assert.match(BINDER_CODE, /await Promise\.all\(\[\s*import\('pdfjs-dist\/build\/pdf\.mjs'\)/)
    assert.ok(!/^import .*pdfjs/m.test(BINDER_CODE), 'a static import would bundle it into the page')
    const elsewhere = execSync("grep -rln pdfjs-dist app lib components || true", { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)
    assert.deepEqual(elsewhere, ['components/AuditBinder.tsx'])
  })

  test('the worker is the main thread, and the reason is read out of pdf.js itself', () => {
    assert.match(BINDER_CODE, /globalThis as unknown as \{ pdfjsWorker\?: unknown \}\)\.pdfjsWorker = worker/)
    assert.ok(!BINDER_CODE.includes('new Worker('), 'Turbopack does not promise that shape')
    assert.ok(!BINDER_CODE.includes('workerSrc'), 'a worker URL means a file copied into public/')
  })

  test('a rendered page is a JPEG, not a live canvas', () => {
    // 40 pages of canvas at print resolution is ~350 MB of live bitmaps; and a data URL survives
    // the print dialog, which the 120-second signed URL the bytes came from does not.
    assert.match(BINDER_CODE, /canvas\.toDataURL\('image\/jpeg', 0\.82\)/)
    assert.match(BINDER_CODE, /canvas\.width = 0; canvas\.height = 0/)
  })

  test('the binder prints through the ONE print path, with its own type on the paper', () => {
    assert.match(BINDER_CODE, /<section className="print-drawer/)
    assert.match(BINDER_CODE, /data-print-company=\{companyName \?\? ''\} data-print-type="Audit binder"/)
    assert.match(BINDER_CODE, /printDrawer\(\)/)
    // E1a's rule still holds: without it the pills and the strip print as white capsules.
    assert.match(CSS, /\.print-tint \{ -webkit-print-color-adjust: exact; print-color-adjust: exact; \}/)
    assert.match(CSS, /\.binder-sheet \{ break-inside: avoid; \}/)
  })
})

describe('getting to the binder — one address, three doors', () => {
  test('it is a mode of the report page, at the report\'s own address', () => {
    assert.match(PAGE_CODE, /const binderParam = params\.get\('binder'\) === '1'/)
    assert.match(PAGE_CODE, /\{binder \? \(/)
    assert.match(PAGE_CODE, /<AuditBinder runId=\{openRun\} companyName=\{companyName\}/)
    // Closing the report closes the binder with it, or the next run would open in binder mode.
    assert.match(PAGE_CODE, /if \(k === 'run' && v === null\) p\.delete\('binder'\)/)
  })

  test('the report\'s footer switches modes; the Calendar\'s drawer navigates', () => {
    assert.match(REPORT_CODE, /onPrintBinder\?: \(\) => void/)
    assert.match(REPORT_CODE, /window\.location\.href = `\/audits\?run=\$\{run\.id\}&binder=1`/)
    assert.match(PAGE_CODE, /onPrintBinder=\{\(\) => setParam\('binder', '1'\)\}/)
    // And the Calendar is unchanged, as it has been since E1: it passes no prop and gets the link.
    assert.ok(!code(read('app/calendar/page.tsx')).includes('onPrintBinder'))
  })

  test('board 3\'s card gets it on the latest FINISHED run', () => {
    // It was `i === 0`, the top row — and the walk found the top row of this card on staging is a
    // run still queued, so the control vanished. A binder can only be made of an audit that
    // finished, and the newest finished one is the one a person hands over today.
    assert.match(PAGE_CODE, /const latestDone = runs\.find\(\(r\) => r\.status === 'done'\)\?\.id/)
    assert.match(PAGE_CODE, /\{r\.id === latestDone && \(/)
    assert.match(PAGE_CODE, /onPrintBinder\(r\.id\)/)
    assert.match(PAGE_CODE, /onPrintBinder=\{\(id\) => \{ setParam\('run', id\); setParam\('binder', '1'\) \}\}/)
  })

  test('a paused company may print one: no gate, no model', () => {
    assert.ok(!BINDER_CODE.includes('requireAccess') && !BINDER_CODE.includes('paused'),
      'the binder is the customer\'s own files and their own finished audit')
    assert.ok(!BINDER_CODE.includes('@/lib/ai'))
  })

  test('GATE F4 is off both homepage panels, and the words are the product\'s', () => {
    const audit = read('components/home/AuditPanel.tsx')
    const binderPanel = read('components/home/BinderPanel.tsx')
    assert.ok(!/^\/\/ GATE F4 — docs/m.test(audit), 'the gate comment is still open on AuditPanel')
    assert.match(audit, /binder: 'Print the binder'/)
    assert.match(binderPanel, /GATE F4 — CLOSED/)
    assert.match(binderPanel, /download: 'Print the binder'/)
    assert.match(read('docs/PENDING.md'), /~~\*\*F4\*\*~~ \| ~~The binder~~ — \*\*CLOSED/)
  })
})

/**
 * *** THE WORD DOCUMENT'S STORED TEXT IS HTML, AND THE BINDER PRINTED THE TAGS. ***
 * Found by the walk, not by reading: `lib/documentContent.ts:421` reads a `.docx` with
 * `mammoth.convertToHtml`, so `document_scans.extracted_text` holds markup — confirmed on
 * staging, where the Emergency Action Plan's text begins `<p>Emergency Action Plan and Hazardous
 * Waste Contingency Plan</p>`. The reading is not changed (that is what the model is shown, a
 * §3.1 decision); the binder converts it, and never renders it.
 */
describe('a Word original prints its words, not its tags — found by the walk', () => {
  test('block tags become line breaks and every other tag goes', () => {
    const stored = '<p>Emergency Action Plan</p><p>Clackamas Blending &amp; Supply LLC</p>'
      + '<h1>7. Non-routine tasks</h1><p>Before a non-routine task<br />the shift lead reviews.</p>'
    assert.equal(plainTextOf(stored),
      'Emergency Action Plan\nClackamas Blending & Supply LLC\n7. Non-routine tasks\n'
      + 'Before a non-routine task\nthe shift lead reviews.')
  })

  test('an entity that spells a tag stays text, and does not become one', () => {
    // `&amp;` is decoded LAST, or `&amp;lt;p&amp;gt;` would come out as a tag nobody wrote.
    assert.equal(plainTextOf('<p>a &amp;lt;p&amp;gt; b</p>'), 'a &lt;p&gt; b')
    assert.equal(plainTextOf('<p>5 &lt; 6 &amp; 7 &gt; 6</p>'), '5 < 6 & 7 > 6')
  })

  test('the binder converts and never renders', () => {
    assert.ok(!BINDER_CODE.includes('dangerouslySetInnerHTML'),
      "a customer's own file would be putting markup into the page")
    assert.match(BINDER_CODE, /\{plainTextOf\(t\.text\)\}/)
  })
})
