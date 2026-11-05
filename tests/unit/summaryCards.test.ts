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
    assert.match(PALETTE, /export const CARD_CONFIRM = 'bg-\[#E6EFF9\] text-gray-800 border-l-\[#3B6FA6\]'/)
    assert.match(PALETTE, /export const CARD_QUIET = 'bg-gray-50 text-gray-500 border-l-gray-300'/)
    for (const c of ['CARD_SITUATION', 'CARD_APPLIES', 'CARD_CONFIRM', 'CARD_QUIET']) {
      assert.ok(VIEW_CODE.includes(`tint={${c}}`), `the ${c} card does not use its tint`)
    }
    // CARD_QUIET twice: Not answered here and Sources are the same pale card.
    assert.equal((VIEW_CODE.match(/tint=\{CARD_QUIET\}/g) ?? []).length, 2)
  })

  test('STILL TO CONFIRM IS BLUE, AND AMBER IS RESERVED — decision 62 corrected at E2a', () => {
    /**
     * E2 drew it amber, said out loud that board 2 drew it blue, and the owner corrected the
     * DECISION rather than the board: amber is the audit report's word for a document that falls
     * short ("on file, gaps found", "out of date"). A thing the conversation could not settle is
     * a question, not a shortfall. Board 2's own `.s-con` is where both values come from.
     */
    assert.match(read(BOARDS), /\.sr \.s-con \.hd \{ border-left-color: #3B6FA6; background: #E6EFF9; \}/)
    assert.match(PALETTE, /CARD_CONFIRM = 'bg-\[#E6EFF9\]/)
    assert.ok(!/CARD_CONFIRM = `\$\{TINT_AMBER\}/.test(PALETTE), 'Still to confirm is amber again')
    // And amber is still exactly where it was: the audit report's two words for a shortfall.
    assert.match(code(read('lib/auditRows.ts')), /on_file_gaps: TINT_AMBER/)
    assert.match(code(read('lib/auditRows.ts')), /stale: TINT_AMBER/)
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

/* ── E2a: A DOCUMENT SOURCE SURVIVES INTO THE SUMMARY ─────────────────────── */

/**
 * *** THE HALF OF DECISION 63 THAT WAS MISSING, AND E2 SAID SO. ***
 *
 * `gatherSources` keys a source by its URL and drops one that has none unless the caller passes
 * `keyWithoutUrl`. Only HR did, so a document or an audit cited in a Workspace, Calendar,
 * Documents or Audits conversation never reached a summary: E2's in-place swap was built for a
 * source that could not arrive. These run the real function on the real stored shape, read off
 * staging — `{ kind: 'passage', label: 'your document', href: '/documents?document=…', url: '' }`.
 */
describe('a source of ours is kept, with its address — E2a', () => {
  const docHref = '/documents?document=7d6a4d4f-84a5-450d-a26e-9bf47e8edd36'
  const runHref = '/audits?run=ac3d6966-3d32-470c-b1dd-ce05f5b79405'
  const turnWith = (sources: Array<Record<string, unknown>>) =>
    [{ role: 'assistant', text: 'An answer [1] with a citation.', sources }] as never

  test('the document passage survives, keeps its href, and is keyed by what it points at', async () => {
    const { gatherSources } = await import('../../lib/summaryReport.ts')
    const { PASSAGE_SOURCES } = await import('../../lib/sourceTitle.ts')
    const src = { n: 1, kind: 'passage', label: 'your document', title: 'Spill Response Procedure — what we read in it',
      href: docHref, url: '', quote: 'Neutralise with soda ash.' }
    const { sources } = gatherSources(turnWith([src]), PASSAGE_SOURCES)
    assert.equal(sources.length, 1)
    assert.equal((sources[0] as unknown as { href: string }).href, docHref)
    assert.equal(sources[0].title, 'Spill Response Procedure — what we read in it')
    // And `sourceTarget` — what the drawer asks — now has something to answer with.
    assert.equal(sourceTarget(sources[0] as unknown as { url: string; href: string }).kind, 'document')
  })

  test('…and WITHOUT the option it is dropped, which is what E2 found', async () => {
    const { gatherSources } = await import('../../lib/summaryReport.ts')
    const src = { n: 1, kind: 'passage', label: 'your document', title: 'A document', href: docHref, url: '' }
    assert.equal(gatherSources(turnWith([src])).sources.length, 0)
  })

  test('the same document cited three times is ONE numbered source', async () => {
    const { gatherSources } = await import('../../lib/summaryReport.ts')
    const { PASSAGE_SOURCES } = await import('../../lib/sourceTitle.ts')
    const one = (n: number, quote: string) =>
      ({ n, kind: 'passage', label: 'your document', title: 'A document', href: docHref, url: '', quote })
    const { sources, perTurn } = gatherSources(
      turnWith([one(1, 'first'), one(2, 'second'), one(3, 'third')]), PASSAGE_SOURCES)
    assert.equal(sources.length, 1)
    // All three of the turn's own numbers map onto the one global number.
    assert.deepEqual([...perTurn[0].values()], [1, 1, 1])
  })

  test('an audit source is kept too, and a web source is exactly as it was', async () => {
    const { gatherSources } = await import('../../lib/summaryReport.ts')
    const { PASSAGE_SOURCES } = await import('../../lib/sourceTitle.ts')
    const { sources } = gatherSources(turnWith([
      { n: 1, kind: 'passage', label: 'the audit', title: 'The Oregon DEQ audit', href: runHref, url: '' },
      { n: 2, title: 'Air Contaminant Discharge Permits', url: 'https://www.oregon.gov/deq/aq' },
    ]), PASSAGE_SOURCES)
    assert.equal(sources.length, 2)
    assert.equal(sourceTarget(sources[0] as unknown as { url: string; href: string }).kind, 'audit')
    assert.equal(sources[1].url, 'https://www.oregon.gov/deq/aq')
    assert.equal(sourceTarget(sources[1] as unknown as { url: string }).kind, 'web')
  })

  test('a source with neither a url nor an address of ours is still dropped', async () => {
    const { gatherSources } = await import('../../lib/summaryReport.ts')
    const { PASSAGE_SOURCES } = await import('../../lib/sourceTitle.ts')
    const { sources } = gatherSources(
      turnWith([{ n: 1, kind: 'handbook', title: 'A handbook passage', url: '' }]), PASSAGE_SOURCES)
    assert.equal(sources.length, 0, 'only HR knows how to key a handbook passage')
  })

  test('the model\'s list line says what one of ours IS, where a web page has its address', async () => {
    const { passageLineOf } = await import('../../lib/sourceTitle.ts')
    assert.equal(passageLineOf({ n: 3, title: 'A document', url: '', label: 'your document' }),
      '3. A document — your document')
    assert.equal(passageLineOf({ n: 1, title: 'DEQ', url: 'https://oregon.gov/deq' }),
      '1. DEQ — https://oregon.gov/deq')
  })

  test('every section that is not HR passes it, and HR is untouched', () => {
    const sr = code(read('lib/summaryReport.ts'))
    assert.match(sr, /numberedTranscript\(turns, hr \? HR_SOURCES : PASSAGE_SOURCES\)/)
    assert.match(sr, /sources: hr \? HR_SOURCES : PASSAGE_SOURCES/)
    assert.match(sr, /renderPlainText\(checked\.report, \{ sourceLine: PASSAGE_SOURCES\.lineOf \}\)/)
    // HR's own three are unchanged, including its handbook key.
    assert.match(code(read('lib/hrSummary.ts')),
      /export const HR_SOURCES = \{ keyWithoutUrl: hrKeyWithoutUrl, keepFields: true, lineOf: hrLineOf \}/)
  })

  test('⚡ IT CHANGES WHAT THE MODEL IS SHOWN, AND THAT IS WRITTEN DOWN', () => {
    // §3.1: what feeds a prompt is a decision, not a refactor. The summariser's numbered list now
    // carries the company's own documents, exactly as HR's has carried handbooks since Step 7.
    assert.match(read('lib/sourceTitle.ts'), /IT CHANGES WHAT THE MODEL IS SHOWN, WHICH IS WHY IT IS THE OWNER'S CALL/)
    assert.match(read('docs/GAPS-PLAN.md'), /E2a/)
  })
})

/* ── E2a item 3: STILL TO CONFIRM LEADS SOMEWHERE ─────────────────────────── */

/**
 * The card that says "we could not settle this from the documents" offered nowhere to settle it.
 * Company information is that page, and its first section is called *Waiting for you*.
 */
describe('Still to confirm links to Company information — E2a item 3', () => {
  test('the link goes to the exact question when the item names the page\'s own key', async () => {
    const { confirmHref, CONFIRM_HREF } = await import('../../lib/summaryWords.ts')
    assert.equal(confirmHref('employee_count'), '/company-information?key=employee_count')
    assert.equal(confirmHref('hazwaste_generator_category'),
      '/company-information?key=hazwaste_generator_category')
    assert.equal(CONFIRM_HREF, '/company-information')
  })

  test('…and to the page itself when it does not, which is every item today', async () => {
    const { confirmHref } = await import('../../lib/summaryWords.ts')
    for (const k of [undefined, null, '', '   ']) {
      assert.equal(confirmHref(k), '/company-information')
    }
    // `to_confirm` items are prose and carry no key: read off staging, and the prompt asks for a
    // key on a FACT, not on an item. The exact-question link turns on with a §3.1 prompt change.
    assert.match(read('lib/summaryWords.ts'), /TODAY NO ITEM CARRIES A KEY/)
    assert.match(code(read('lib/summaryReport.ts')), /key\?: string/)
  })

  test('the words are in the words file, and both are the owner\'s', async () => {
    const { CONFIRM_LINK, CONFIRM_ONE } = await import('../../lib/summaryWords.ts')
    assert.equal(CONFIRM_LINK, 'Confirm them on Company information →')
    assert.equal(CONFIRM_ONE, 'Confirm it on Company information →')
    assert.ok(!VIEW_CODE.includes('Company information'), 'the component writes the words itself')
  })

  test('the header carries one link and every item carries its own', () => {
    assert.match(VIEW_CODE, /\{CONFIRM_LINK\}/)
    assert.match(VIEW_CODE, /href=\{confirmHref\(it\.key\)\}/)
    assert.match(VIEW_CODE, /\{CONFIRM_ONE\}/)
    // Only under Still to confirm: What applies' items are things to do, not things to settle.
    assert.match(VIEW_CODE, /report\.to_confirm\.map\(\(it, i\) => item\(it, `c-\$\{i\}`, true\)\)/)
    // What applies' items are things to do, not things to settle: they take the two-argument form.
    assert.match(VIEW_CODE, /item\(it, `\$\{gi\}-\$\{i\}`\)/)
  })

  test('the page answers the key by the key it already keys the question by', () => {
    // `lib/confirmationQueue.ts` builds `one:<key>`, `dis:<key>` and a document group whose
    // members are those keys. Matching on anything else — a label, a question's words — would be
    // matching on something the model wrote rather than on something the page holds.
    const page = code(read('app/company-information/page.tsx'))
    assert.match(page, /const askedKey = useSearchParams\(\)\.get\('key'\)/)
    assert.match(page, /l\.keys\.some\(\(k\) => k\.key === askedKey\)/)
    assert.match(page, /l\.k\.key === askedKey/)
    // A group is opened; everything is scrolled to and marked.
    assert.match(page, /if \(line\.kind === 'document'\) setOpenQ\(\(o\) => new Set\(o\)\.add\(line\.id\)\)/)
    assert.match(page, /getElementById\(`q-\$\{line\.id\}`\)\?\.scrollIntoView/)
    // All three kinds of waiting line can be landed on.
    assert.equal((page.match(/id=\{`q-\$\{line\.id\}`\}/g) ?? []).length, 3)
  })

  test('a key that is not waiting opens the page, and nothing else happens', () => {
    const page = code(read('app/company-information/page.tsx'))
    assert.match(page, /if \(!line\) return/)
  })
})
