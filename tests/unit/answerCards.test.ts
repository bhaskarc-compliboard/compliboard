/**
 * THE ANSWER AND ITS SOURCE CARDS — `docs/GAPS-PLAN.md` Part E step E3, decisions 67–69;
 * `docs/answer-boards.html` draft 3.
 *
 * `components/AnswerBody.tsx` draws an answer on SEVEN surfaces — the Workspace's chat and its
 * summary drawer, HR's chat and its drawer, the shared Ask screen (Calendar, Documents, Audits)
 * and the shared conversation drawer — so everything decided here lands in all of them at once.
 * Two kinds of test, as the summary's have: the RULES, run (the honesty split and the offer's
 * words are pure and live in `lib/askWords.ts` and `lib/auditsWords.ts` for exactly that reason),
 * and the SHAPE, read out of the component, because there is no renderer here.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { splitHonesty, REFUSED_NOTE, NOT_IN_WHAT_WE_HAVE } from '../../lib/askWords.ts'
import { runAuditOffer, agencyAsks, documentsOnFile, AGENCY_ASKS_GENERAL, ADD_A_FOLDER_HREF } from '../../lib/auditsWords.ts'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const BODY = read('components/AnswerBody.tsx')
const BODY_CODE = code(BODY)
const BOARDS = 'docs/answer-boards.html'

/* ── DECISION 67 — ONE CARD PER SOURCE ────────────────────────────────────── */

describe('a source is a card: number, title, origin, and the quote when there is one', () => {
  test('the fixed grid is the board\'s — 26px for the number, then everything else', () => {
    assert.match(BODY_CODE, /grid-cols-\[26px_1fr\]/)
    assert.match(read(BOARDS), /\.card2 \{ display: grid; grid-template-columns: 26px 1fr;/)
  })

  test('⚡ THE QUOTE IS THE ONLY THING THAT SAYS "CHECKED", so it is drawn only when there is one', () => {
    // Decision 67: no kind labels. A card with a quote under it is checked, a card without one is
    // a reference the answer named (E2d), and the origin line already says whose it is.
    assert.match(BODY_CODE, /\{s\.quote && \(/)
    assert.match(BODY_CODE, /font-serif text-\[13\.5px\] italic/)
    for (const pill of ['k-quote', 'k-named', 'k-web', 'QUOTE', 'NAMED']) {
      assert.ok(!BODY_CODE.includes(pill), `the card still draws a ${pill} label`)
    }
  })

  test('an audit finding carries a thin amber left edge, and nothing else does', () => {
    assert.match(BODY_CODE, /const FINDING_EDGE = 'border-l-\[3px\] border-l-\[#B7791F\]'/)
    assert.match(BODY_CODE, /isFinding\(s\) \? ` \$\{FINDING_EDGE\}` : ''/)
    // The board's own value, and the audit report's amber ink.
    assert.match(read(BOARDS), /\.card2\.finding \{ border-left: 3px solid #B7791F; \}/)
    assert.match(BODY_CODE, /s\.label === 'an audit finding' \|\| s\.label === 'your audit'/)
  })

  test('the title is the link: in place where the page can swap, a new tab for a web page', () => {
    assert.match(BODY_CODE, /onOpenSource\?: \(target: SourceTarget\) => void/)
    assert.match(BODY_CODE, /const swaps = Boolean\(onOpenSource && target && target\.kind !== 'web'\)/)
    assert.match(BODY_CODE, /target="_blank" rel="noopener noreferrer"/)
    // …and plain text where there is nowhere to go: HR's handbook passage.
    assert.match(BODY_CODE, /: <span className="block text-\[14px\] leading-5 text-gray-900">\{title\}<\/span>/)
  })

  test('the fold at three survives, and every card still prints', () => {
    assert.match(BODY_CODE, /const SOURCES_SHOWN = 3/)
    assert.match(BODY_CODE, /hidden \? 'hidden print:grid' : 'grid'/)
    assert.match(BODY_CODE, /Show all \$\{sources\.length\} sources/)
  })
})

/* ── DECISION 68 — AN HONESTY LINE IS A NOTE ──────────────────────────────── */

describe('the refused-quote marker leaves the running text — decision 68', () => {
  test('it is lifted out, counted, and NOT A WORD of the answer is changed', () => {
    const one = `The log says “eight readings a day” ${NOT_IN_WHAT_WE_HAVE} for August.`
    assert.deepEqual(splitHonesty(one), { body: 'The log says “eight readings a day” for August.', refused: 1 })
    const two = `A ${NOT_IN_WHAT_WE_HAVE} and B ${NOT_IN_WHAT_WE_HAVE}.`
    assert.equal(splitHonesty(two).refused, 2)
    assert.equal(splitHonesty(two).body, 'A and B.')
    // An answer with no marker is returned untouched, character for character.
    const clean = 'Nothing was refused here.\n\n- a list\n- of things'
    assert.deepEqual(splitHonesty(clean), { body: clean, refused: 0 })
  })

  test('the note says how many, in the product\'s own voice, and counts in words', () => {
    assert.match(REFUSED_NOTE(1), /^One quote in this answer could not be matched, word for word/)
    assert.match(REFUSED_NOTE(3), /^3 quotes in this answer could not be matched/)
    assert.match(REFUSED_NOTE(1), /no source card\.$/)
  })

  test('it is drawn after the body, as a grey note with a mark', () => {
    const at = (s: string) => BODY_CODE.indexOf(s)
    assert.ok(at('markCitations(body)') < at('{refused > 0 && ('), 'the note comes after the body')
    assert.match(BODY_CODE, /border-l-\[3px\] border-gray-200 bg-gray-50/)
    assert.match(BODY_CODE, /<span aria-hidden className="text-gray-400">ⓘ<\/span>/)
  })

  test('⚡ THE OTHER THREE LINES decision 68 NAMES CANNOT MOVE, AND THE FILE SAYS SO', () => {
    // "not audited yet" and "readings as of" are PROMPT INSTRUCTIONS: the sentence on the screen
    // is the model's own words, and lifting it would be a prompt change (§3.1), which E3 is not.
    assert.match(read('prompts/audits-answer.ts'), /export const AUDITS_NOT_AUDITED_YET/)
    assert.match(read('lib/askWords.ts'), /AND THE OTHER THREE LINES decision 68 NAMES CANNOT MOVE/)
    // The Queued sentence is already drawn by the screen, outside the answer.
    assert.match(code(read('components/AskScreen.tsx')), /CLAIM_WORDS/)
  })
})

/* ── DECISION 69 — THE OFFER SAYS WHAT IT NEEDS ───────────────────────────── */

describe('the run-audit offer asks for documents — decision 69', () => {
  test('the four parts, with the count and the kinds', () => {
    const o = runAuditOffer({ agency: 'Oregon OSHA', fileName: null, documents: 7 })
    assert.equal(o.question, 'Do you want me to run the Oregon OSHA audit?')
    assert.equal(o.reads, 'It reads every Oregon OSHA document and gives you a line per finding.')
    assert.match(o.onFile, /^7 documents are on file for Oregon OSHA\. The more you add first — /)
    assert.match(o.onFile, /written programs, training and evaluation records, inspection logs and safety data sheets — the more the audit can answer\.$/)
    assert.equal(o.run, 'Run the Oregon OSHA audit')
    assert.equal(o.add, 'Add a folder first')
  })

  test('the count is a sentence, not a number: none, one, many', () => {
    assert.equal(documentsOnFile(0, 'EPA'), 'No documents are on file for EPA.')
    assert.equal(documentsOnFile(1, 'EPA'), '1 document is on file for EPA.')
    assert.equal(documentsOnFile(12, null), '12 documents are on file.')
  })

  test('⚡ THE KINDS ARE MATCHED ON A KEYWORD, because a label is the company\'s own words', () => {
    // Read off `company_labels` on staging: all of these are real labels of real companies.
    for (const label of ['Oregon OSHA', 'U.S. OSHA', 'OSHA']) {
      assert.match(agencyAsks(label), /written programs/, label)
    }
    for (const label of ['Oregon DEQ', 'Oregon Department of Environmental Quality']) {
      assert.match(agencyAsks(label), /permit and its renewal/, label)
    }
    assert.match(agencyAsks('EPA'), /waste manifests/)
    for (const label of ['Local fire authority', 'Oregon State Fire Marshal']) {
      assert.match(agencyAsks(label), /extinguisher maintenance/, label)
    }
    // Anything else gets the line that is true of every agency, never a guess.
    assert.equal(agencyAsks('DOT PHMSA'), AGENCY_ASKS_GENERAL)
    assert.equal(agencyAsks(null), AGENCY_ASKS_GENERAL)
  })

  test('the template offer is the same shape, for the file', () => {
    const o = runAuditOffer({ agency: null, fileName: 'checklist.docx', documents: 12 })
    assert.equal(o.question, 'Do you want me to audit against checklist.docx?')
    assert.match(o.reads, /every line of the file/)
    assert.match(o.onFile, /^12 documents are on file\. /)
    assert.match(o.onFile, /the file asks about/)
    assert.equal(o.run, 'Audit against checklist.docx')
  })

  test('both buttons are drawn, the press is 6b\'s, and the second goes to the folder', () => {
    const page = code(read('app/audits/page.tsx'))
    assert.match(page, /\{words\.run\}/)
    assert.match(page, /\{words\.add\}/)
    assert.match(page, /href=\{ADD_A_FOLDER_HREF\}/)
    // The press itself is unchanged from step 6b: the same claim, the same one-press rule.
    assert.match(page, /const out = await pressOffer\(o, attached\?\.id \?\? null, attached\?\.name \?\? null\)/)
    assert.match(page, /patch\(\{ added: \{ \.\.\.\(x\.added \?\? \{\}\), \[i\]: \{ id: null, already: false \} \} \}\)/)
    // The count comes from the same place the agency ROW counts from.
    assert.match(page, /agencyView\(o\.agency\)\?\.docs\.length/)
  })

  test('⚡ "Add a folder first" CANNOT open the picker, and the product does not pretend it can', () => {
    assert.equal(ADD_A_FOLDER_HREF, '/documents?tab=documents&add=folder')
    const docs = read('app/documents/page.tsx')
    assert.match(code(docs), /const wantsFolder = addHint === 'folder'/)
    assert.match(code(docs), /autoFocus=\{wantsFolder\}/)
    // A file dialog needs a real user gesture: the page says so rather than calling .click().
    assert.match(docs, /a file dialog opens only inside a real user gesture/)
    assert.match(read('lib/documentsWords.ts'), /export const ADD_FOLDER_HINT = 'Add the folder for your audit/)
  })
})

/* ── THE SEVEN SURFACES ───────────────────────────────────────────────────── */

describe('one component draws the answer on seven surfaces', () => {
  test('all seven render it, and only the three with a reading drawer pass the one new prop', () => {
    const uses = [
      ['app/compliance/page.tsx', 'the Workspace chat and its summary drawer'],
      ['app/hr/HrWorkspace.tsx', 'HR\'s chat and its drawer'],
      ['components/AskScreen.tsx', 'the Calendar, Documents and Audits chats'],
      ['components/ConversationDrawer.tsx', 'the conversation drawer those three mount'],
    ] as Array<[string, string]>
    for (const [f, why] of uses) assert.match(read(f), /<AnswerBody/, `${f} — ${why}`)
    // The one prop E3 adds, forwarded and nothing more.
    assert.match(code(read('components/AskScreen.tsx')), /<SourceList sources=\{x\.sources\} onOpenSource=\{onOpenSource\} \/>/)
    for (const f of ['app/documents/page.tsx', 'app/audits/page.tsx', 'app/calendar/page.tsx']) {
      assert.match(code(read(f)), /onOpenSource=\{openSourceInPlace\}/, f)
      // ONE definition per page, used by the summary's sources and the answer's alike.
      assert.equal((code(read(f)).match(/const openSourceInPlace =/g) ?? []).length, 1, f)
    }
    // HR passes none: a handbook passage has no reading to open. The Workspace's chat answers
    // carry web sources only, and its own document reading belongs to the summary drawer.
    assert.ok(!code(read('app/hr/HrWorkspace.tsx')).includes('onOpenSource'))
    assert.match(code(read('app/compliance/page.tsx')), /<SourceList sources=\{x\.sources\} \/>/)
  })

  test('the marker lives in a file a browser component may import', () => {
    // `lib/ask/passages.ts` imports `lib/documentScan.ts`, which a client file must not reach.
    assert.match(read('lib/askWords.ts'), /export const NOT_IN_WHAT_WE_HAVE = '\(we could not find these words in what we have on file\)'/)
    assert.match(code(read('lib/ask/passages.ts')), /import \{ NOT_IN_WHAT_WE_HAVE \} from '\.\.\/askWords\.ts'/)
    assert.ok(!/^import /m.test(code(read('lib/askWords.ts'))), 'lib/askWords.ts must import nothing')
  })

  test('the boards are committed beside the plan', () => {
    assert.match(read('docs/GAPS-PLAN.md'), /docs\/answer-boards\.html/)
  })
})
