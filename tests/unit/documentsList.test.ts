/**
 * THE DOCUMENTS LIST AND THE DOCUMENT DRAWER — `docs/GAPS-PLAN.md` Part E step E4,
 * decisions 70–74; `docs/documents-boards.html`.
 *
 * Two kinds, as every display step's tests have: the RULES, run — the short name, the day
 * grouping and the progress arithmetic are pure and live in `lib/documentName.ts` and
 * `lib/documentList.ts` for exactly that reason — and the SHAPE, read out of the page and the
 * drawer, because there is no renderer here.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { documentName, sourceCardName, NAME_MIN_WORDS } from '../../lib/documentName.ts'
import { dayGroup, readingProgress, aboutLeft, filesWord, READING_IN_BACKGROUND } from '../../lib/documentList.ts'
import { notesNoticed, factsWaiting, datesSummary, whatItIsSummary, SCANNED_PAGES, ADD_FOLDER_HINT } from '../../lib/documentsWords.ts'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const PAGE = read('app/documents/page.tsx')
const PAGE_CODE = code(PAGE)
const DRAWER = read('components/DocumentReport.tsx')
const DRAWER_CODE = code(DRAWER)

/* ── DECISION 71 — ONE NAME, SIX SURFACES ─────────────────────────────────── */

describe('a document is called the same thing everywhere — decision 71', () => {
  /**
   * The ten longest titles on staging are in `docs/GAPS-PLAN.md` §8 before and after. These are
   * the shapes that decide the rule, each one a real title read off `document_index_v`.
   */
  test('⚡ THE CUT IS THE FIRST CLAUSE, AND NEVER BEFORE THE FIFTH WORD', () => {
    assert.equal(
      documentName('Annual Report, Reporting Year 2025, for Standard Air Contaminant Discharge Permit 26-2841-ST-01, with Oregon DEQ Receipt Confirmation (Submission ACDP-AR-2025-262841), Portland Facility'),
      'Annual Report, Reporting Year 2025')
    assert.equal(
      documentName('Powered Industrial Truck (Forklift) Operator Certification Roster, current as of 1 October 2026 (Clackamas Blending & Supply LLC)'),
      'Powered Industrial Truck (Forklift) Operator Certification Roster')
    // The five-word floor: without it this becomes "Material", which is the shape of every SDS.
    assert.equal(
      documentName('Material Safety Data Sheet (old MSDS format) – Sulfuric Acid, 93%, MSDS No. CSC-SA-093'),
      'Material Safety Data Sheet (old MSDS format) – Sulfuric Acid')
    assert.equal(NAME_MIN_WORDS, 5)
    // A title already short is left exactly as it is.
    assert.equal(documentName('Site map 2026'), 'Site map 2026')
    assert.equal(documentName(''), '')
    assert.equal(documentName(null), '')
  })

  test('⚡ A BRACKET IN THE MIDDLE OF A NAME IS PART OF THE NAME, and two permits proved it', () => {
    // Cutting at every " (" made these one name. The number is what tells them apart.
    const a = documentName('Oregon DEQ Simple Air Contaminant Discharge Permit (ACDP) No. 03-0217-ST-01, Clackamas Blending & Supply LLC, 14200 SE Industrial Way, Clackamas')
    const b = documentName('Oregon DEQ Simple Air Contaminant Discharge Permit (ACDP) No. ACDP 26-0192-ST, Cascade Specialty Chemicals, LLC, 4820 NW Yeon Avenue, Portland')
    assert.equal(a, 'Oregon DEQ Simple Air Contaminant Discharge Permit (ACDP) No. 03-0217-ST-01')
    assert.equal(b, 'Oregon DEQ Simple Air Contaminant Discharge Permit (ACDP) No. ACDP 26-0192-ST')
    assert.notEqual(a, b)
    // And a cut never lands inside a bracket, which would leave an unclosed "(" on the screen.
    const c = documentName('Pre-Inspection Audit Checklist for Oregon chemical blending and distribution facilities (Northwest Supplier Assurance Program, revision 2026-03), blank template')
    assert.equal((c.match(/\(/g) ?? []).length, (c.match(/\)/g) ?? []).length)
    assert.ok(c.endsWith('revision 2026-03)'), c)
  })

  test('a source card keeps the suffix that says what the card IS', () => {
    assert.equal(
      sourceCardName('Powered Industrial Truck (Forklift) Operator Certification Roster, current as of 1 October 2026 — its line in your list'),
      'Powered Industrial Truck (Forklift) Operator Certification Roster — its line in your list')
    assert.equal(sourceCardName('Oregon DEQ — what we read in it'), 'Oregon DEQ — what we read in it')
  })

  test('⚡ ALL SIX SURFACES CALL IT, AND NONE OF THEM CUTS A TITLE ITSELF', () => {
    const callers: Array<[string, RegExp]> = [
      ['app/documents/page.tsx', /documentName\(r\.title\)/],
      ['components/DocumentReport.tsx', /<Drawer title=\{documentName\(row\.title\)\}/],
      ['components/ReportView.tsx', /sourceCardName\(String\(/],
      ['components/AnswerBody.tsx', /sourceCardName\(s\.title\)/],
      ['components/AuditReport.tsx', /return t \? documentName\(t\) : null/],
      ['components/AuditBinder.tsx', /documentName\(t\.doc\.title\)/],
    ]
    for (const [f, re] of callers) {
      assert.match(code(read(f)), re, `${f} does not use the one name function`)
      assert.match(read(f), /from '@\/lib\/documentName'/, `${f} does not import it`)
    }
    // *** AND THE BINDER'S COVER IS THE EXCEPTION, BECAUSE DECISION 57 SAYS SO. *** The auditor's
    // own title for their checklist is carried whole; only the tab sheets are shortened.
    assert.match(code(read('components/AuditBinder.tsx')),
      /rep\.documents\?\.\[run\.template_document_id \?\? ''\]\?\.title/)
  })
})

/* ── DECISION 70 — THE LIST ───────────────────────────────────────────────── */

describe('the list groups by the day a file arrived — decision 70', () => {
  test('Date added is the default, and Status is still a choice', () => {
    assert.match(PAGE_CODE, /useState<GroupBy>\('date'\)/)
    assert.match(PAGE_CODE, /<option value="date">Date added<\/option>/)
    assert.match(PAGE_CODE, /<option value="status">Status<\/option>/)
  })

  test('today, yesterday, this month by day, older by month — newest first', () => {
    const now = new Date('2026-11-05T18:00:00Z')
    assert.equal(dayGroup('2026-11-05T09:00:00Z', now).label, 'Today')
    assert.equal(dayGroup('2026-11-04T09:00:00Z', now).label, 'Yesterday')
    assert.equal(dayGroup('2026-11-02T09:00:00Z', now).label, '2 November')
    assert.equal(dayGroup('2026-10-03T09:00:00Z', now).label, 'October')
    assert.equal(dayGroup('2025-10-03T09:00:00Z', now).label, 'October 2025')
    // The keys sort newest-first as text, which is what the page does with them.
    const keys = ['2026-11-05T09:00:00Z', '2026-11-02T09:00:00Z', '2026-10-03T09:00:00Z']
      .map((d) => dayGroup(d, now).key).sort((a, b) => b.localeCompare(a))
    assert.deepEqual(keys, ['2026-11-05', '2026-11-02', '2026-10'])
    assert.match(PAGE_CODE, /entries\.sort\(\(a, b\) => b\[0\]\.localeCompare\(a\[0\]\)\)/)
    assert.equal(filesWord(8), '8 files')
    assert.equal(filesWord(1), '1 file')
  })

  test('⚡ THE PROGRESS LINE, AND ITS ARITHMETIC — W1', () => {
    const now = new Date('2026-11-05T18:00:00Z')
    const p = readingProgress({ file_count: 8, done_count: 5, created_at: '2026-11-05T17:55:00Z' }, now)
    // The board's own line, to the word.
    assert.equal(p?.line, 'Reading in the background · 5 of 8 done · about 3 minutes left')
    assert.equal(p?.fraction, 0.625)
    // Nothing is claimed before the first document lands: an average of none is not an estimate.
    assert.equal(readingProgress({ file_count: 8, done_count: 0, created_at: '2026-11-05T17:55:00Z' }, now)?.line,
      'Reading in the background · 0 of 8 done')
    // …and the line goes when the batch is done.
    assert.equal(readingProgress({ file_count: 3, done_count: 3, created_at: '2026-11-05T17:55:00Z' }, now), null)
    assert.equal(aboutLeft(0), 'under a minute left')
    assert.equal(aboutLeft(61_000), 'about a minute left')
    assert.equal(READING_IN_BACKGROUND, 'Reading in the background')
  })

  test('⚡ THE ESTIMATE IS THE BATCH\'S OWN ELAPSED AVERAGE, because nothing else is recorded', () => {
    // Read on staging rather than assumed: `document_scans` has `scanned_at` and no start;
    // `documents.reading_since` is cleared when a reading lands — 0 rows of 47 carry it.
    assert.match(read('lib/documentList.ts'), /0 rows of 47 still carry it/)
    assert.match(PAGE_CODE, /const batchProgress = useMemo/)
    assert.match(PAGE_CODE, /b \? readingProgress\(b\) : null/)
    // *** AND IT IS NOT DRAWN UNLESS SOMETHING IS IN FLIGHT. *** Photographed on the walk: a
    // batch queued on 3 November and never finished made the list say "Reading in the
    // background · 0 of 1 done" two days later, in the present tense (§5.1).
    assert.match(PAGE_CODE, /if \(inFlight === 0\) return null/)
  })

  test('the banner is gone and the group header says it in place', () => {
    assert.ok(!PAGE_CODE.includes('banner?.summary'), 'the receipt box is still drawn')
    assert.ok(!PAGE.includes('We&rsquo;ve read your'), 'the banner sentence is still in the page')
    assert.match(PAGE_CODE, /\{g\.files \? `· \$\{filesWord\(g\.rows\.length\)\}` : g\.rows\.length\}/)
    assert.match(PAGE_CODE, /\{batchProgress\.line\}/)
  })

  test('the row leads with the short name, and alternate rows are shaded', () => {
    assert.match(PAGE_CODE, /\{documentName\(r\.title\)\}/)
    assert.match(PAGE_CODE, /shade=\{i % 2 === 1\}/)
    assert.match(PAGE_CODE, /shade \? 'bg-white\/70' : ''/)
  })

  test('⚡ "Read it again" IS NOT OFFERED ON A QUEUED OR READING DOCUMENT — W1', () => {
    assert.match(DRAWER_CODE, /row\.document_status !== 'uploaded' && row\.document_status !== 'reading' && \(/)
    // The row says which of the two it is; `statusWord` has said so since the Calendar's step 8a.
    assert.match(code(read('lib/documentStatus.ts')), /if \(scanning \|\| r\.document_status === 'reading'\) return 'Reading…'/)
    assert.match(code(read('lib/documentStatus.ts')), /if \(r\.document_status === 'uploaded'\) return 'Queued'/)
  })
})

/* ── DECISIONS 72, 73 AND 74 — THE DRAWER ─────────────────────────────────── */

describe('the drawer is cards, folded, in one voice — decisions 72–74', () => {
  test('the order and the fold', () => {
    const at = (t: string) => DRAWER_CODE.indexOf(`title={${t}}`)
    const order = ['DOC_CARD_SAYS', 'DOC_CARD_GAPS', 'DOC_CARD_NOTES', 'DOC_CARD_DATES',
      'DOC_CARD_WHAT', 'DOC_CARD_FACTS']
    for (let i = 1; i < order.length; i++) {
      assert.ok(at(order[i - 1]) > -1 && at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`)
    }
    assert.match(DRAWER_CODE, /says: true, gaps: true, notes: false, dates: false, what: false, facts: false/)
    // Print opens everything, by the same CSS the summary uses.
    assert.match(DRAWER_CODE, /\$\{open \? '' : 'fold-closed'\}/)
    assert.match(read('app/globals.css'), /@media print \{[\s\S]*\.fold-closed \{ display: block !important; \}/)
  })

  test('the title line carries what the Status card used to, and that card is gone', () => {
    assert.ok(!DRAWER_CODE.includes('title="Status"'))
    const line = DRAWER_CODE.slice(DRAWER_CODE.indexOf('STATUS_WORD[row.display_status]'))
    assert.match(line.slice(0, 1200), /gap\{readGaps\.length === 1 \? '' : 's'\} read from the page/)
    assert.match(line.slice(0, 1200), /KIND_LABEL\[kind\] \?\? kind/)
    assert.match(line.slice(0, 1200), /row\.agencies\.join\(' · '\)/)
    assert.match(line.slice(0, 1200), /read \{fmt\(row\.scanned_at\)\}/)
  })

  test('⚡ THE THREE BUTTONS ARE AT THE CARD\'S FOOT, ONCE — the old print had twelve', () => {
    assert.match(DRAWER_CODE, /const cardFoot = \(items: Gap\[\], what: 'gaps' \| 'notes'\)/)
    assert.match(DRAWER_CODE, /\{cardFoot\(readGaps, 'gaps'\)\}/)
    assert.match(DRAWER_CODE, /\{cardFoot\(noteGaps, 'notes'\)\}/)
    // One of each in the foot, and none of them left in the item.
    const item = DRAWER_CODE.slice(DRAWER_CODE.indexOf('const gapItem ='), DRAWER_CODE.indexOf('const cardFoot ='))
    assert.ok(!item.includes('Make a checklist'), 'the item still carries its own checklist button')
    assert.ok(!item.includes('Research this'), 'the item still carries its own research button')
    // "Not right" asks WHICH, because one verdict belongs to one finding.
    assert.match(DRAWER_CODE, /Which one is not right\?/)
  })

  test('the spacing inside a card is the board\'s, and the numbers are written down', () => {
    assert.match(DRAWER_CODE, /className="border-t border-gray-100 pb-4 pt-3\.5 first:border-t-0 first:pt-1"/)
    assert.match(DRAWER_CODE, /\{g\.description && <p className="mt-2 /)
    assert.match(DRAWER_CODE, /\{g\.fix && <p className="mt-3 /)
    assert.match(DRAWER_CODE, /<span className="font-semibold text-gray-900">Fix\. <\/span>/)
    assert.match(DRAWER_CODE, /<p className="mt-2\.5 text-\[12px\] text-gray-500">/)
  })

  test('every folded header says what is inside it', () => {
    assert.equal(notesNoticed(2), '2 things we noticed')
    assert.equal(notesNoticed(1), '1 thing we noticed')
    assert.equal(factsWaiting(4), '4 — please confirm on Company information →')
    assert.equal(datesSummary(4, 2, 4), '4, two overdue · on your calendar')
    assert.equal(datesSummary(1, 0, 0), '1')
    assert.equal(whatItIsSummary(['Record', 'OSHA', 'Company-wide', 'Oregon', 'federal']),
      'Record · OSHA · Company-wide · Oregon · federal — not right? change it')
  })

  test('⚡ ONE VOICE: no "ours", no "inferred", no honesty line in the footer — decision 74', () => {
    const live = DRAWER_CODE
    for (const bad of ['notes are ours', 'our reading', 'CompliBoard', 'marked inferred',
      'nobody has checked them', '<Inferred', 'Quotes are word for word']) {
      assert.ok(!live.includes(bad), `the drawer still says "${bad}"`)
    }
    // The footer is decision 73's four, and Print is called Print.
    assert.match(live, />Open the file<\/button>/)
    assert.match(live, />Print<\/button>/)
    assert.ok(!live.includes('>Download</button>'), 'the footer still says Download')
  })

  test('⚡ PENDING D3 — the scan note, on the one kind of document it is true of', () => {
    assert.equal(SCANNED_PAGES,
      'These pages are a scan, so the quotes could not be checked against the file.')
    assert.match(DRAWER_CODE, /\{isScan && <p className="mb-3 text-\[13px\] text-gray-500">\{SCANNED_PAGES\}<\/p>\}/)
    // BOTH halves, because a reading that quoted nothing also has quotes_checked = 0.
    assert.match(DRAWER_CODE,
      /const isScan = Boolean\(scan\) && !\(\(scan\?\.extracted_text \?\? ''\)\.trim\(\)\) && \(scan\?\.quotes_checked \?\? 0\) === 0/)
    assert.match(DRAWER_CODE, /quotes_checked: number \| null; extracted_text: string \| null/)
    // And the route already sends both: it selects * from document_scans.
    assert.match(code(read('app/api/documents/report/route.ts')), /from\('document_scans'\)\.select\('\*'\)/)
  })

  test('the cards use the summary report\'s palette, from the one file', () => {
    for (const tint of ['CARD_SITUATION', 'CARD_APPLIES', 'CARD_CONFIRM', 'CARD_QUIET', 'TINT_AMBER']) {
      assert.ok(DRAWER_CODE.includes(tint), `the drawer does not use ${tint}`)
    }
    assert.match(DRAWER_CODE, /from '@\/lib\/reportPalette'/)
  })

  test('"Add a folder first" still lands where E3 put it', () => {
    assert.match(ADD_FOLDER_HINT, /^Add the folder for your audit/)
    assert.match(PAGE_CODE, /\{wantsFolder && <span className="text-\[12px\] text-gray-600">\{ADD_FOLDER_HINT\}<\/span>\}/)
  })
})
