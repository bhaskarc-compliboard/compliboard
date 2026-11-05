/**
 * THE SUMMARY REPORT AS FIVE CARDS — `docs/GAPS-PLAN.md` Part E step E2, decisions 62–64.
 *
 * One file draws the summary in SIX places (the Compliance Workspace, HR, and the shared
 * conversation drawer that the Calendar, Documents and Audits each mount), so everything here is
 * about `components/ReportView.tsx` and the hosts that pass it something. Two kinds of test:
 *
 *   · the RULES, run — `sourceTarget` is pure, so which address opens what is checked by calling
 *     it with the shapes the briefs actually write, including the one read off staging where a
 *     document passage carries `href` and an EMPTY `url`;
 *   · the SHAPE, read — there is no renderer here, so the fold's default state, the five cards and
 *     the board's own paddings are read out of the source.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

import { sourceTarget } from '../../lib/sourceTitle.ts'
import {
  CARD_SITUATION_TITLE, CARD_APPLIES_TITLE, CARD_CONFIRM_TITLE, CARD_UNANSWERED_TITLE,
  CARD_SOURCES_TITLE, CONFIRM_COUNT, UNANSWERED_COUNT, UNANSWERED_LINE, APPLIES_COUNT, GROUPS_COUNT,
} from '../../lib/summaryWords.ts'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const VIEW = read('components/ReportView.tsx')
const VIEW_CODE = code(VIEW)
const DRAWER = code(read('components/ConversationDrawer.tsx'))
const PALETTE = code(read('lib/reportPalette.ts'))
const CSS = read('app/globals.css')
const BOARDS = 'docs/summary-report-boards.html'

/* ── THE FIVE CARDS — decision 62 ─────────────────────────────────────────── */

describe('the summary is five cards, and the colours come from one palette', () => {
  test('each card has its own tint, and the two quiet ones share the pale pair', () => {
    assert.match(PALETTE, /export const CARD_SITUATION = `\$\{TINT_GREY\} border-l-current`/)
    assert.match(PALETTE, /export const CARD_APPLIES = `\$\{TINT_GREEN\} border-l-current`/)
    assert.match(PALETTE, /export const CARD_CONFIRM = `\$\{TINT_AMBER\} border-l-current`/)
    assert.match(PALETTE, /export const CARD_QUIET = 'bg-gray-50 text-gray-500 border-l-gray-300'/)
    for (const c of ['CARD_SITUATION', 'CARD_APPLIES', 'CARD_CONFIRM', 'CARD_QUIET']) {
      assert.ok(VIEW_CODE.includes(`tint={${c}}`), `the ${c} card does not use its tint`)
    }
    // CARD_QUIET twice: Not answered here and Sources are the same pale card.
    assert.equal((VIEW_CODE.match(/tint=\{CARD_QUIET\}/g) ?? []).length, 2)
  })

  test('STILL TO CONFIRM IS AMBER, AND BOARD 2 DRAWS IT BLUE', () => {
    // The brief wins where a board and a brief disagree — the rule written on every board file.
    // Amber is also what the rest of the product already means: something needs a person.
    assert.match(read(BOARDS), /\.sr \.s-con \.hd \{ border-left-color: #3B6FA6/)
    assert.match(PALETTE, /CARD_CONFIRM = `\$\{TINT_AMBER\}/)
    assert.match(read('lib/reportPalette.ts'), /\*\*Board 2 draws Still to confirm in BLUE/)
  })

  test('the card headers are the only coloured thing, and they survive the printer', () => {
    // E1a's rule: a browser drops background colours on paper, and `print-tint` is the override.
    assert.equal((VIEW_CODE.match(/print-tint flex/g) ?? []).length, 2, 'the header, folding or not')
    assert.match(CSS, /\.print-tint \{ -webkit-print-color-adjust: exact; print-color-adjust: exact; \}/)
  })
})

/* ── THE FOLD, THE RIGHT WAY UP — decision 62 ─────────────────────────────── */

describe('what is open when a summary opens', () => {
  test('What applies opens, with the FIRST authority open and the rest folded', () => {
    assert.match(VIEW_CODE, /useState<Set<number>>\(\(\) => new Set\(\[0\]\)\)/)
    assert.match(VIEW_CODE, /useState\(\{ applies: true, confirm: false, unanswered: false, sources: false \}\)/)
  })

  test('the other three cards open folded, each with its count on the header line', () => {
    assert.match(VIEW_CODE, /title=\{CARD_CONFIRM_TITLE\} count=\{CONFIRM_COUNT\(report\.to_confirm\.length\)\}/)
    assert.match(VIEW_CODE, /title=\{CARD_UNANSWERED_TITLE\} count=\{UNANSWERED_COUNT\(report\.unanswered\.length\)\}/)
    assert.match(VIEW_CODE, /title=\{CARD_SOURCES_TITLE\} count=\{String\(report\.sources\.length\)\}/)
  })

  test('Open all / Close all does not fold the card it sits in', () => {
    // The header is itself a button since E2; without stopPropagation, "Open all" closed the card.
    const right = VIEW_CODE.slice(VIEW_CODE.indexOf('right={'), VIEW_CODE.indexOf('{report.applies.map'))
    assert.match(right, /e\.stopPropagation\(\)/)
    assert.match(right, /\{allOpen \? 'Close all' : 'Open all'\}/)
  })

  test('print opens every fold, by CSS, without touching the screen\'s state', () => {
    assert.match(VIEW_CODE, /\$\{open \? '' : 'fold-closed'\}/)
    assert.match(CSS, /@media print \{[\s\S]*\.fold-closed \{ display: block !important; \}/)
  })
})

/* ── THE WORDS — decision 62 ──────────────────────────────────────────────── */

describe('the words on the cards', () => {
  test('the five titles, and the renamed one', () => {
    assert.equal(CARD_SITUATION_TITLE, 'Your situation')
    assert.equal(CARD_APPLIES_TITLE, 'What applies')
    assert.equal(CARD_CONFIRM_TITLE, 'Still to confirm')
    assert.equal(CARD_UNANSWERED_TITLE, 'Not answered here')
    assert.equal(CARD_SOURCES_TITLE, 'Sources')
    // "Asked and not answered" is gone from the one file that drew it.
    assert.ok(!VIEW_CODE.includes('Asked and not answered'))
  })

  test('Still to confirm\'s count says what it MEANS, and the others count plainly', () => {
    assert.equal(CONFIRM_COUNT(3), '3 things we could not settle from the documents')
    assert.equal(CONFIRM_COUNT(1), '1 thing we could not settle from the documents')
    assert.equal(UNANSWERED_COUNT(1), '1 question')
    assert.equal(APPLIES_COUNT(6, 3), '6 things to do · 3 authorities')
    assert.equal(APPLIES_COUNT(1, 1), '1 thing to do · 1 authority')
    assert.equal(GROUPS_COUNT(2), '2 authorities')
  })

  test('every unanswered question carries the owner\'s line, and it is polite', () => {
    assert.equal(UNANSWERED_LINE,
      'this came up and the conversation did not settle it. Ask it on its own and we will answer.')
    assert.match(VIEW_CODE, /\{UNANSWERED_LINE\}/)
  })

  test('HR\'s own words still win, and are not said twice', () => {
    // HR passes `heading` ("What to change · 3 things"), so the card's TITLE is that sentence and
    // the count beside it is only the authorities — "3 things" once, not twice.
    assert.match(VIEW_CODE, /title=\{words\?\.heading \? words\.heading\(total\) : CARD_APPLIES_TITLE\}/)
    assert.match(VIEW_CODE, /count=\{words\?\.heading \? GROUPS_COUNT\(report\.applies\.length\)/)
    assert.match(code(read('app/hr/HrWorkspace.tsx')), /words=\{HR_REPORT_WORDS\}/)
  })
})

/* ── THE SPACING — board 2's own numbers ──────────────────────────────────── */

describe('the gaps are board 2\'s, and they are arithmetic and not taste', () => {
  test('the board\'s paddings are what this file says they are', () => {
    const boards = read(BOARDS)
    assert.match(boards, /\.sr \.item \{ padding: 8px 0 10px 18px; border-top: 1px solid/)
    assert.match(boards, /\.sr \.auth \{ display: flex; align-items: center; gap: 8px; padding: 10px 0 6px;/)
  })

  test('…and the product carries the same three numbers', () => {
    // item → item   = 10 (bottom) + 1 (rule) + 8 (top)  = 19px
    // authority row → its first item = 6 + 1 + 8        = 15px
    assert.match(VIEW_CODE, /className="border-t border-gray-100 pb-2\.5 pl-\[18px\] pt-2 first:border-t-0"/)
    assert.match(VIEW_CODE, /className="flex w-full items-center gap-2 pb-1\.5 pt-2\.5 text-left/)
  })

  test('decision 59: an authority\'s count sits in a fixed column', () => {
    assert.match(VIEW_CODE, /w-\[110px\] shrink-0 text-right text-\[12px\] text-gray-500/)
  })
})

/* ── A SOURCE OPENS IN PLACE — decision 63 ────────────────────────────────── */

describe('which address opens what — run, not read', () => {
  test('a document, an audit and a web page are told apart by the address', () => {
    const doc = '/documents?document=7d6a4d4f-84a5-450d-a26e-9bf47e8edd36'
    const run = '/audits?run=ac3d6966-3d32-470c-b1dd-ce05f5b79405'
    assert.deepEqual(sourceTarget({ url: doc }),
      { kind: 'document', id: '7d6a4d4f-84a5-450d-a26e-9bf47e8edd36', url: doc })
    assert.deepEqual(sourceTarget({ url: run }),
      { kind: 'audit', id: 'ac3d6966-3d32-470c-b1dd-ce05f5b79405', url: run })
    assert.equal(sourceTarget({ url: 'https://www.oregon.gov/deq/aq' }).kind, 'web')
  })

  test('⚡ A DOCUMENT PASSAGE CARRIES ITS ADDRESS IN `href`, AND ITS `url` IS EMPTY', () => {
    // Read off staging rather than assumed: a Documents turn's source is
    // { kind: 'passage', label: 'your document', href: '/documents?document=…', url: '' }.
    // A rule that only looked at `url` would call every one of them a web page.
    const t = sourceTarget({ href: '/documents?document=7d6a4d4f-84a5-450d-a26e-9bf47e8edd36', url: '' })
    assert.equal(t.kind, 'document')
    assert.equal(t.id, '7d6a4d4f-84a5-450d-a26e-9bf47e8edd36')
  })

  test('anything malformed or unknown is a web page, which is the safe answer', () => {
    for (const u of ['', '/documents?document=not-a-uuid', '/audits', '/documents?document=1&x=2',
      'javascript:alert(1)', '/some/other/page']) {
      assert.equal(sourceTarget({ url: u }).kind, 'web', `${u} should be left alone`)
    }
    assert.equal(sourceTarget({}).kind, 'web')
  })
})

describe('the swap, where there is a drawer to swap', () => {
  test('ReportView asks the host, and only for a source of ours', () => {
    assert.match(VIEW_CODE, /onOpenSource\?: \(target: SourceTarget\) => void/)
    assert.match(VIEW_CODE, /if \(!onOpenSource \|\| t\.kind === 'web'\) return sourceShape\.link\(src\)/)
  })

  test('the shared drawer forwards it and does nothing else with it', () => {
    // The swap belongs to the page: a reading needs the folder list and the move handler, which
    // every page that mounts this drawer already holds for its own document drawer.
    assert.match(DRAWER, /onOpenSource\?: \(target: SourceTarget\) => void/)
    assert.match(DRAWER, /onOpenSource=\{onOpenSource\}/)
    assert.ok(!DRAWER.includes('DocumentReport'), 'the drawer must not grow a second reading of its own')
  })

  test('the four sections that HAVE a reading drawer swap it, and say where back goes', () => {
    for (const [file, back] of [
      ['app/audits/page.tsx', /← \{docFrom === 'summary' \? 'Back to the summary'/],
      ['app/documents/page.tsx', /← Back to the summary/],
      ['app/calendar/page.tsx', /\{docFromSummary \? 'Back to the summary' : 'Back to the audit'\}/],
      ['app/compliance/page.tsx', /← Back to the summary/],
    ] as Array<[string, RegExp]>) {
      const src = code(read(file))
      assert.match(src, /onOpenSource=\{\(t\) => \{/, `${file} does not take a source`)
      assert.match(src, /t\.kind === 'document'/, `${file} does not open a document in place`)
      assert.match(src, /window\.location\.href = `\/audits\?run=\$\{t\.id\}`/, `${file} does not open an audit`)
      assert.match(src, back, `${file} has no way back to the summary`)
    }
  })

  test('the summary is HIDDEN under the reading, never unmounted', () => {
    // "In place" means the scroll position survives: closing the reading comes back to the
    // summary where it was. The Calendar has done this with its date drawer since step 8b.
    assert.match(code(read('app/audits/page.tsx')), /docFrom === 'summary' && openDoc \? 'hidden' : ''/)
    assert.match(code(read('app/documents/page.tsx')), /docFromSummary && openDoc \? 'hidden' : ''/)
    assert.match(code(read('app/calendar/page.tsx')), /docFromSummary && openDocId \? 'hidden' : ''/)
    assert.match(code(read('app/compliance/page.tsx')), /docFromSummary && reportDoc \? 'hidden' : ''/)
  })

  test('HR does not, and that is a reason and not an omission', () => {
    // An HR summary's sources are handbook passages. `HR_SOURCE` draws them with NO LINK at all,
    // because there is no reading of a handbook to open — so there is nothing to swap to.
    const hr = read('app/hr/HrWorkspace.tsx')
    assert.ok(!code(hr).includes('onOpenSource'))
    assert.match(hr, /kind !== 'handbook' \? WEB_SOURCE\.link\(src\)/)
    assert.match(read('app/compliance/page.tsx'), /HR does not, and that is not an omission/)
  })
})

/* ── ONE SENTENCE AT THE FOOT — decision 64 ───────────────────────────────── */

describe('the audit report and the binder say it once, at the foot', () => {
  test('the sentence exists once, where the printed page already had a footer', () => {
    const frame = read('lib/printFrame.ts')
    assert.match(frame, /export const PREPARED_LINE =/)
    assert.match(frame, /'Prepared with CompliBoard\. Every line points at a document, or says what we do not see\. '/)
    assert.match(frame, /\+ 'It is not a verdict on whether the company complies, and it is not legal advice; check before you act\.'/)
    assert.match(frame, /@bottom-left \{ content: \$\{cssString\(PREPARED_LINE\)\}/)
  })

  test('the lede and the cover carry nothing in CompliBoard\'s voice', () => {
    const report = code(read('components/AuditReport.tsx'))
    const binder = code(read('components/AuditBinder.tsx'))
    for (const [what, src] of [['the report', report], ['the binder', binder]] as Array<[string, string]>) {
      assert.ok(!/None of it is a verdict/.test(src), `${what} still says it above the rows`)
      assert.ok(!/Prepared with CompliBoard\. Every line/.test(src), `${what} says it twice`)
      assert.match(src, /\{PREPARED_LINE\}/, `${what} does not say it at its foot`)
    }
    // What is left of the lede is a fact about the run, not a promise about the product.
    assert.match(report, /Every line below is a line of your checklist, answered against the documents you have given us\./)
    assert.match(report, /Every line below points at a document, or says what we do not see\./)
  })
})

/* ── AND WHAT E2 TOOK AWAY ────────────────────────────────────────────────── */

describe('what the five cards replaced', () => {
  test('FoldRow is gone, and nothing imports it', () => {
    assert.ok(!existsSync('components/FoldRow.tsx'))
    for (const f of ['components/ReportView.tsx', 'app/compliance/page.tsx', 'app/hr/HrWorkspace.tsx']) {
      assert.ok(!read(f).includes("from '@/components/FoldRow'"), `${f} still imports it`)
    }
  })

  test('the boards are committed beside the plan', () => {
    assert.ok(existsSync(BOARDS))
    assert.match(read('docs/GAPS-PLAN.md'), /docs\/summary-report-boards\.html/)
  })
})
