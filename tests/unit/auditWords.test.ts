/**
 * THE AUDIT'S FIVE WORDS, AND THE HANDLE THAT MUST NEVER REACH A PERSON — `docs/GAPS-PLAN.md`
 * Part E step E0; the owner's decisions 47, 48, 49 and 59 of 4 November 2026, and W5.
 *
 * *** WHAT THIS FILE IS ABOUT IS A WALK, NOT A PATCH. ***
 *
 * On 3 November the owner ran his own auditor's checklist against his own documents and read the
 * report. Four of the ten lines came back `on_file` — green — while the sentence underneath each
 * listed what was missing, and six of the ten wrote a bare `D6`, `D9`, `D12` at him. Both are read
 * back out of staging in the migrations' own headers (run `8707eea9-6c58-4c98-ab9d-4ec5825642cd`),
 * and the six leaking lines below are THAT RUN'S REAL TEXT, pasted, not invented for a test.
 *
 * Three things are checked here and they are different in kind:
 *
 *   1. the five words, and that a near miss maps NARROWLY — `normaliseWord`;
 *   2. the handle sweep, on the real sentences — `nameDocumentHandles`;
 *   3. the words and the rules in the files that are not functions — the prompt, the migrations,
 *      the checklist route, the two screens — read out of the source, because the failure these
 *      guard against is one place being taught the fifth word and another not.
 *
 * (3) is the kind of assertion `tests/unit/fileTypes.test.ts` carries for the same reason: a
 * vocabulary spread over nine files drifts silently, and the drift is invisible until a customer
 * sees `on_file_gaps` printed raw on a pill.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

import { normaliseWord, nameDocumentHandles, titlesByHandle, runSummaryLine,
         type RunSummary } from '../../lib/auditRun.ts'
import { notesWord } from '../../lib/documentStatus.ts'
import type { AuditInput } from '../../lib/audit.ts'

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => readFileSync(p, 'utf8')

/** The newest migration that defines a thing is the one in force. Found, never assumed. */
function newestMigrationSaying(needle: string): { name: string; sql: string } {
  const dir = 'supabase/migrations'
  const hits = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .filter((f) => read(`${dir}/${f}`).includes(needle))
  assert.ok(hits.length, `no migration contains ${JSON.stringify(needle)}`)
  const name = hits[hits.length - 1]
  return { name, sql: read(`${dir}/${name}`) }
}

/* ── 1. THE FIVE WORDS ────────────────────────────────────────────────────── */

describe('the audit has five words and the gate keeps every one of them', () => {
  test('each of the five goes through unchanged', () => {
    for (const w of ['on_file', 'on_file_gaps', 'stale', 'nothing_on_file', 'not_a_document_question']) {
      assert.deepEqual(normaliseWord(w), { word: w, mapped: null }, `${w} should pass straight through`)
    }
  })

  test('the fifth word is the one the walk asked for, spelled this way and no other', () => {
    // The stored value is `on_file_gaps`. `on_file_with_gaps` is a NEAR MISS, not a second
    // spelling: it maps, and it is recorded as having been mapped.
    assert.deepEqual(normaliseWord('on_file_gaps'), { word: 'on_file_gaps', mapped: null })
    assert.deepEqual(normaliseWord('on_file_with_gaps'),
      { word: 'on_file_gaps', mapped: 'on_file_with_gaps' })
  })

  test('the five near misses map to it, and every mapping is reported', () => {
    for (const w of ['partial', 'incomplete', 'gaps', 'gaps_found', 'on_file_with_gaps']) {
      const got = normaliseWord(w)
      assert.equal(got.word, 'on_file_gaps', `${w} should mean on file with gaps found`)
      assert.equal(got.mapped, w, `${w} must be reported as mapped, never silently accepted`)
    }
    // And Run 4b's two still do what they did.
    assert.deepEqual(normaliseWord('expiring'), { word: 'stale', mapped: 'expiring' })
    assert.deepEqual(normaliseWord('expired'), { word: 'stale', mapped: 'expired' })
  })

  test('NOTHING WIDER MAPS, and that is the whole discipline of this function', () => {
    // Each of these could as easily mean `nothing_on_file`. A mapping that guesses is this
    // function deciding what the model meant, which is what its own comment forbids.
    for (const w of ['missing', 'insufficient', 'non_compliant', 'not_compliant', 'fail',
                     'needs_work', 'deficient', 'on file gaps', 'onfilegaps']) {
      assert.deepEqual(normaliseWord(w), { word: null, mapped: null },
        `${w} must be refused, not interpreted`)
    }
  })

  test('case and whitespace are forgiven; a non-string is not a word', () => {
    assert.equal(normaliseWord('  On_File_Gaps  ').word, 'on_file_gaps')
    assert.equal(normaliseWord('PARTIAL').word, 'on_file_gaps')
    for (const v of [null, undefined, 42, {}, [], '']) {
      assert.deepEqual(normaliseWord(v), { word: null, mapped: null })
    }
  })
})

describe('the fifth word is counted as something that needs a person', () => {
  const base: RunSummary = {
    total: 0, needs_person: 0, nothing_on_file: 0, on_file_gaps: 0, stale: 0, on_file: 0,
    not_a_document_question: 0, contradictions: 0, dates_passed: 0, expected: 0,
    sections: 1, sections_done: 1, could_not_complete: 0, carried: 0, closed: 0,
    reshaped_to_dates: [], dropped_undated: [], dropped_wordless: [],
    attention: [], agencies: ['Oregon DEQ'], note: null,
  } as unknown as RunSummary

  test('the sentence says it, in its own clause, before "out of date"', () => {
    const line = runSummaryLine({ ...base, needs_person: 3, on_file_gaps: 2, stale: 1 })
    assert.match(line, /2 things on file with gaps found/)
    assert.match(line, /1 thing out of date/)
    assert.ok(line.indexOf('gaps found') < line.indexOf('out of date'),
      'the fifth word reads second, before "out of date" (the owner, 4 November)')
  })

  test('the plural is right at one, which is why these are expressions and not a template', () => {
    assert.match(runSummaryLine({ ...base, needs_person: 1, on_file_gaps: 1 }),
      /1 thing on file with gaps found/)
    assert.doesNotMatch(runSummaryLine({ ...base, needs_person: 1, on_file_gaps: 1 }),
      /1 things/)
  })

  test('a word with none of them is left out of the sentence entirely', () => {
    const line = runSummaryLine({ ...base, needs_person: 1, nothing_on_file: 1 })
    assert.doesNotMatch(line, /gaps found/)
  })

  test('`needs_person` adds it, in every place that derives the number', () => {
    // The two screens derive it rather than trusting the stored key, because a run summarised
    // before 4 November has no such key. Both copies must name the fifth word or a re-audit of an
    // old run reports fewer things than it found.
    for (const f of ['app/audits/page.tsx', 'components/AuditReport.tsx']) {
      const fn = code(read(f))
      const i = fn.indexOf('function needsOf')
      assert.ok(i > 0, `${f} has no needsOf`)
      const body = fn.slice(i, i + 400)
      assert.match(body, /s\.on_file_gaps \?\? 0/, `${f}'s needsOf does not add the fifth word`)
    }
  })

  test('the audit summary counts it apart from nothing_on_file', () => {
    const src = code(read('lib/auditRun.ts'))
    assert.match(src, /const onFileGaps = count\(\(r\) => r\.word === 'on_file_gaps'\)/)
    assert.match(src, /needs_person: nothingOnFile \+ onFileGaps \+ stale \+ contradictions \+ notADocument/)
  })

  test('THE EMAIL\'S "and n more" NAMES EVERY WORD `attention` HOLDS', () => {
    /**
     * This is the defect the map found by reading the two together. `summariseRun`'s `attention`
     * list is capped at 25 and the email says how many did not fit, as
     * `nothing_on_file + stale − attention.length`. Widening the list and not the sum prints
     * "…and -2 more", and nothing reads a finished run's email text, so no test would have caught
     * it on its own.
     */
    const src = code(read('lib/auditNotify.ts'))
    assert.match(src, /const inAttention = summary\.nothing_on_file \+ \(summary\.on_file_gaps \?\? 0\) \+ summary\.stale/)
    assert.match(src, /if \(inAttention > summary\.attention\.length\)/)
    assert.doesNotMatch(src, /summary\.nothing_on_file \+ summary\.stale >/,
      'the old arithmetic is still there and would go negative')
    // And the list it counts out of names the same three words.
    const run = code(read('lib/auditRun.ts'))
    assert.match(run, /r\.word === 'nothing_on_file' \|\| r\.word === 'on_file_gaps' \|\| r\.word === 'stale'/)
  })
})

describe('every file that says the words says all five', () => {
  const sites: Array<[string, string]> = [
    ['app/audits/page.tsx', "on_file_gaps: 'on file, gaps found'"],
    // *** `components/AuditReport.tsx` LEFT THIS LIST AT PART C, and the list got shorter, not
    // weaker. *** The binder prints the same rows as the report, so the labels moved to
    // `lib/auditRows.ts` and both read them from there — one copy where there were two. The
    // other three are a page, an email and a prompt, and each still says all five.
    ['lib/auditRows.ts', "on_file_gaps: 'on file, gaps found'"],
    ['lib/ask/auditsBrief.ts', "on_file_gaps: 'on file, gaps found'"],
    ['lib/auditNotify.ts', "on_file_gaps: 'on file, gaps found'"],
  ]
  for (const [file, needle] of sites) {
    test(`${file} shows the fifth word in the customer's words`, () => {
      assert.ok(read(file).includes(needle), `${file} does not say ${needle}`)
    })
  }

  test('it is amber, because the defect was four green pills over four lists of gaps', () => {
    const src = code(read('components/AuditReport.tsx'))
    assert.match(src, /AMBER_WORD = new Set\(\['nothing_on_file', 'on_file_gaps', 'stale'\]\)/)
  })

  test('it is read second, before "out of date"', () => {
    const src = code(read('lib/auditRows.ts'))
    assert.match(src,
      /WORD_ORDER = \['nothing_on_file', 'on_file_gaps', 'stale', 'on_file', 'not_a_document_question'\]/)
  })

  test('"Make a checklist" does not drop it — `NEEDS_PERSON` has five', () => {
    // `GAPS-PLAN` §7 flagged this set as the thing a fifth word had to be decided into or out of:
    // left out, every gap that HAS a document behind it would quietly never reach a checklist.
    const src = code(read('app/api/audit-checklist/route.ts'))
    assert.match(src,
      /NEEDS_PERSON = new Set\(\['nothing_on_file', 'on_file_gaps', 'stale', 'not_a_document_question'\]\)/)
  })

  test('the chat prompt counts five, and its name is the count', () => {
    const src = read('prompts/audits-answer.ts')
    assert.match(src, /export const AUDITS_FIVE_WORDS/)
    assert.doesNotMatch(src, /export const AUDITS_FOUR_WORDS/)
    assert.match(src, /one of five things about a line/)
    assert.match(src, /on file with gaps found/)
    // And the chat is still forbidden from making the word stronger than it is.
    assert.match(src, /never read it as the company being in breach/)
  })

  test('the audit prompt defines it, forbids on_file beside a shortfall, and offers five', () => {
    const src = read('prompts/audit-agency.ts')
    // Both shapes — the agency's and the template's — say five and no other.
    assert.equal((src.match(/one of these five and no other/g) ?? []).length, 2)
    assert.doesNotMatch(src, /one of these four and no other/)
    assert.match(src, /ON FILE IS FOR SOMETHING WITH NOTHING FALLING SHORT/)
    assert.match(src, /WHEN BOTH FIT, OUT OF DATE WINS/)
    /**
     * *** AND THE TWO SENTENCES OF 4 NOVEMBER ARE IN **BOTH** SHAPES — E0a. ***
     *
     * `auditTemplatePrompt` returns `[ROLE, HONESTY, SHAPE_T]`, so a template run never sees one
     * word of `SHAPE`. E0 put the tie-break in `SHAPE` only and then named it as the likely cause
     * of a TEMPLATE line going wrong — a sentence that model had never been shown. Counting two
     * occurrences is the cheap way to make the next rule land in both places.
     */
    assert.equal((src.match(/still inside its own dates is never\s+stale/gi) ?? []).length, 2,
      'the stale sentence must be in both shapes, not one')
    assert.match(src, /A DOCUMENT STILL INSIDE ITS OWN DATES IS NEVER STALE/,
      'the TEMPLATE shape carries it in capitals, where its own stale clause is')
    assert.equal((src.match(/an inspector will see on the day/g) ?? []).length, 2,
      'the practice-question sentence must be in both shapes, not one')
    /**
     * *** ONE QUOTE PER FINDING — E0b, 4 November 2026, and it is not a style rule. ***
     *
     * Three of six Clackamas sections were lost to this, every one the same shape on the same
     * line, read out of `audit_sections.raw_text`:
     *
     *   "quote": "Rohan Patel's last evaluation was 2 February 2023" and "Marcus Reed was
     *   certified and last evaluated on 19 September 2023",
     *
     * Two quotes joined with `and` inside one JSON string field. The string ends early, the object
     * breaks, `extractJsonText` cannot recover it, and a paid section is written
     * `could_not_complete`. Always on B2 — the fifth word's own two-shortfall case, which is
     * exactly what invites a second quote.
     */
    assert.equal((src.match(/ONE QUOTE PER FINDING/g) ?? []).length, 2,
      'the one-quote rule must be in both shapes, not one')
    assert.match(src, /never two quotes joined inside the\s+quote field/)
    // *** AND THE PARAGRAPH THAT CAUSED W4 IS GONE. ***
    // It read "ON FILE MEANS A DOCUMENT ANSWERS IT, EVEN IN PART", which is why the model was
    // right to call four lines with gaps `on_file`.
    assert.doesNotMatch(src, /ON FILE MEANS A DOCUMENT ANSWERS IT, EVEN IN PART/)
    assert.match(src, /A DOCUMENT THAT ANSWERS THE LINE ONLY IN PART IS on_file_gaps, NOT on_file/)
  })

  test('the template JSON schema is widened WITH the prompt, not after it', () => {
    // §136's lesson: a probe testing a copy of a schema tests the copy. A four-word enum beside a
    // five-word prompt would refuse the fifth word the moment AI_AUDIT_STRUCTURED is switched on.
    const src = read('prompts/audit-agency.ts')
    assert.match(src,
      /enum: \['on_file', 'on_file_gaps', 'stale', 'nothing_on_file', 'not_a_document_question'\]/)
  })

  test('the database accepts exactly those five, by the newest migration that says so', () => {
    const { sql } = newestMigrationSaying('audit_findings_word_check')
    assert.match(sql,
      /word in \('on_file', 'on_file_gaps', 'stale', 'nothing_on_file', 'not_a_document_question'\)/)
    // And a suggestion still cannot be one of them — decision 60 rests on this constraint.
    assert.match(sql, /an expected row took the fifth word/)
  })
})

/* ── 2. THE HANDLE LEAK ───────────────────────────────────────────────────── */

/**
 * The six leaking lines of run `8707eea9-6c58-4c98-ab9d-4ec5825642cd`, as stored. Shortened at
 * sentence boundaries only — not reworded — because the point of testing on real text is that it
 * has the shapes nobody would think to invent: "D6 is on file", "The reading of D1 proposes",
 * "D9 and D10 are blank checklist templates", "D7 (ACDP 26-0192-ST)".
 */
const TITLES = new Map<string, string>([
  ['D1', 'Emergency Action Plan and Hazardous Waste Contingency Plan, Revision 3'],
  ['D4', 'Material Safety Data Sheet – Sulfuric Acid, 93%'],
  ['D5', 'Oregon DEQ Acknowledgement of Hazardous Waste Site Identification Form'],
  ['D6', 'Oregon DEQ Simple Air Contaminant Discharge Permit (ACDP) No. 03-0217-ST-01'],
  ['D7', 'Oregon DEQ Simple Air Contaminant Discharge Permit (ACDP) No. ACDP 26-0192-ST'],
  ['D9', 'Pre-Inspection Audit Checklist for Oregon chemical blending and distribution'],
  ['D10', 'Pre-Inspection Audit Checklist for Oregon chemical blending and distribution'],
  ['D12', 'Written Hazard Communication Program, Revision 6 (Clackamas facility)'],
])

const LEAKED: Array<[string, string]> = [
  ['A1', 'D6 is on file. It is an Oregon DEQ Simple Air Contaminant Discharge Permit issued '
       + '2023-09-01 with a printed expiry of 2028-08-31. A second air permit, D7 '
       + '(ACDP 26-0192-ST), names ‘Cascade Specialty Chemicals, LLC’.'],
  ['A2', 'D5 is on file: Oregon DEQ’s acknowledgement, dated 2026-01-22, that it received EPA '
       + 'Form 8700-12 on 20 January 2026.'],
  ['A3', 'D12 is on file: Written Hazard Communication Program Revision 6, effective 2026-01-15. '
       + 'The only SDS-type document on file is D4, a sulfuric acid sheet dated 2019-08-12.'],
  ['A4', 'D1 is on file: Emergency Action Plan and Hazardous Waste Contingency Plan Revision 3, '
       + 'dated 2025-02-10.'],
  ['C1', 'The reading of D12 proposes that the company labels and ships its own blended products. '
       + 'D9 and D10 are blank checklist templates: they list these records as expected but '
       + 'contain no records themselves.'],
  ['C2', 'The reading of D1 proposes Clackamas Fire District #1 as the local fire authority. '
       + 'D9 and D10 are blank checklist templates that list these items but hold none of them.'],
]

describe('a handle never reaches the person — W5, on the six real lines', () => {
  test('all six come out with no handle left in them', () => {
    for (const [ref, text] of LEAKED) {
      const out = nameDocumentHandles(text, TITLES)!
      assert.doesNotMatch(out, /\bD\d{1,3}\b/, `line ${ref} still carries a handle: ${out}`)
    }
  })

  test('and what replaces it is the title the person sees in their own list', () => {
    const a1 = nameDocumentHandles(LEAKED[0][1], TITLES)!
    assert.match(a1, /^Oregon DEQ Simple Air Contaminant Discharge Permit \(ACDP\) No\. 03-0217-ST-01 is on file\./)
    const a3 = nameDocumentHandles(LEAKED[2][1], TITLES)!
    assert.match(a3, /^Written Hazard Communication Program, Revision 6 \(Clackamas facility\) is on file:/)
    assert.match(a3, /document on file is Material Safety Data Sheet – Sulfuric Acid, 93%/)
  })

  test('two in a row keep both names, which reads correctly', () => {
    const out = nameDocumentHandles('D9 and D10 are blank checklist templates.', TITLES)!
    assert.equal(out, 'Pre-Inspection Audit Checklist for Oregon chemical blending and distribution '
      + 'and Pre-Inspection Audit Checklist for Oregon chemical blending and distribution '
      + 'are blank checklist templates.')
  })

  test('three or more collapse to a count, because three long titles in one parenthesis is worse', () => {
    assert.equal(nameDocumentHandles('See D1, D4 and D6 for this.', TITLES),
      'See 3 of the documents on file for this.')
    assert.equal(nameDocumentHandles('See D1, D4, D5, D6 for this.', TITLES),
      'See 4 of the documents on file for this.')
  })

  test('a range collapses the same way', () => {
    assert.equal(nameDocumentHandles('as documents D4–D6', TITLES), 'as documents 3 of the documents on file')
    // Backwards or equal is not a range and is left alone rather than reported as "0 of them".
    assert.match(nameDocumentHandles('D6–D4', TITLES)!, /Permit \(ACDP\) No\. 03-0217-ST-01/)
  })

  test('the leading word is kept, not eaten', () => {
    assert.equal(nameDocumentHandles('document D5 says so', TITLES),
      'document Oregon DEQ Acknowledgement of Hazardous Waste Site Identification Form says so')
  })

  test('A HANDLE WE NEVER GAVE IS LEFT EXACTLY AS WRITTEN', () => {
    // There is nothing true to put in its place. `handle_error` is already how the row records
    // that the model named something it was not shown.
    assert.equal(nameDocumentHandles('D99 is on file.', TITLES), 'D99 is on file.')
    assert.equal(nameDocumentHandles('D1, D2 and D99 together', TITLES),
      'Emergency Action Plan and Hazardous Waste Contingency Plan, Revision 3, D2 and D99 together')
  })

  test('nothing that merely looks like a handle is touched', () => {
    for (const s of ['Drum 9 was relabelled', 'Form 8700-12', 'ORR 000 215 889',
                     'ACDP 03-0217-ST-01', 'the D sheet', 'D1234567']) {
      assert.equal(nameDocumentHandles(s, TITLES), s, `${s} should be untouched`)
    }
  })

  test('null and empty come back as they went in', () => {
    assert.equal(nameDocumentHandles(null, TITLES), null)
    assert.equal(nameDocumentHandles('', TITLES), '')
  })

  test('the titles come off the block the section was actually given', () => {
    const input = {
      documents: [{ handle: 'D1', title: 'The permit' }],
      other_documents: [{ handle: 'D7', title: 'The roster' }],
    } as unknown as AuditInput
    const m = titlesByHandle(input)
    assert.equal(m.get('D1'), 'The permit')
    assert.equal(m.get('D7'), 'The roster')
    assert.equal(m.size, 2)
  })

  test('THE SWEEP IS APPLIED TO THE PROSE FIELDS AND NOT TO `quote`', () => {
    /**
     * A quote is word for word from the reading it cites, and `quote_verified` checks it against
     * the document's own text. If a real document says "D1" — a drum number, a form code —
     * rewriting it would corrupt the one field the product promises is untouched. Measured: 0 of
     * 425 findings on staging carry a handle in `quote`; 51 carry one in `what_to_do`.
     */
    const src = code(read('lib/auditRun.ts'))
    assert.match(src, /what_to_do: named\(str\(item\.what_to_do\) \?\? str\(item\.why\)\)/)
    assert.match(src, /locator: named\(str\(item\.locator\)\)/)
    assert.match(src, /what_to_do: named\(str\(a\.what_to_do\)\)/)
    assert.match(src, /locator: named\(str\(a\.locator\)\), quote: str\(a\.quote\)/)
    assert.doesNotMatch(src, /quote: named\(/, 'a quote must never be rewritten')
  })
})

/* ── 3. DECISION 48, 49 AND 59, WHERE THEY LIVE ───────────────────────────── */

describe('needs work only on a gap read from the page — decision 48', () => {
  test('the newest migration defining the view requires a READ gap for needs_work', () => {
    const { name, sql } = newestMigrationSaying('as display_status')
    assert.match(sql, /when s\.status = 'gaps_found' and coalesce\(g\.read_gaps, 0\) > 0 then 'needs_work'/,
      `${name} does not gate needs_work on a gap read from the page`)
    // There must be NO arm for a gaps_found scan with no read gap: falling through to the kind's
    // own arms is literally "the status the document would otherwise have". (Matched at the start
    // of a line, because this migration's own WHY paragraph quotes 049's old arm in prose.)
    assert.doesNotMatch(sql, /^\s*when s\.status = 'gaps_found' then 'needs_work'/m,
      'the unconditional arm 049 wrote is still in the view')
    assert.match(sql, /count\(\*\) filter \(where dg\.basis = 'inferred'\)::int as inferred_gaps/)
    assert.match(sql, /as inferred_gap_count/)
  })

  test('the probe walks the arm in both directions, which is what makes it a check', () => {
    // §9a: a check that cannot see anything looks exactly like a check that found nothing. The
    // probe must prove it can still SEE needs_work, not only that it stopped saying it.
    const { sql } = newestMigrationSaying('as display_status')
    assert.match(sql, /a gap read from the page reads %, wanted needs_work/)
    assert.match(sql, /a gap the reading worked out reads %, wanted on_file/)
    assert.match(sql, /the read gap reopened and the row reads %, wanted needs_work/)
    // And decision 60's own words: a record falls to Recorded, not Current.
    assert.match(sql, /a record with only inferred gaps reads %, wanted recorded/)
  })

  test('the note count is the LAST column, because calendar_v depends on the view', () => {
    const { sql } = newestMigrationSaying('as inferred_gap_count')
    assert.match(sql, /create or replace view public\.document_index_v/)
    assert.doesNotMatch(sql, /drop view if exists public\.document_index_v/,
      'dropping the view would take calendar_v with it (073)')
    assert.match(sql, /is at % and is not the last column/)
    assert.match(sql, /perform 1 from public\.calendar_v limit 1/)
  })

  test('the words for a note are the product\'s own, in one place', () => {
    assert.equal(notesWord(0), null)
    assert.equal(notesWord(null), null)
    assert.equal(notesWord(undefined), null)
    assert.equal(notesWord(1), '1 note')
    assert.equal(notesWord(6), '6 notes')
  })

  test('the Documents list shows them, in a FIXED, LEFT-ALIGNED column — decision 59', () => {
    const src = code(read('app/documents/page.tsx'))
    assert.match(src, /notesWord\(r\.inferred_gap_count\)/)
    // The column was `w-[160px] shrink-0 text-right`. A right-aligned column drifts the moment a
    // second cell joins it, and a column that drifts is a failure, photographed, not a style note.
    assert.match(src, /flex w-\[200px\] shrink-0 items-start gap-3 text-left/)
    assert.doesNotMatch(src, /w-\[160px\] shrink-0 text-right/)
  })

  test('the report\'s status column is fixed too, so the titles line up down the page', () => {
    /**
     * *** THE WIDTH MOVED AT E1a, THE RULE DID NOT — 4 November 2026. ***
     * The word's column was 150px of coloured text, measured on "not a document question" at 12px.
     * It is board 1's 132px tinted PILL now (E1a item 5), which is still a fixed, left-aligned
     * column and is still what keeps every requirement's left edge in one line down the page —
     * which is all decision 59 ever asked for. `tests/unit/auditPage.test.ts` holds the four
     * columns and the pixel check.
     */
    const src = code(read('components/AuditReport.tsx'))
    assert.match(src, /w-\[132px\] shrink-0 rounded-full/)
    assert.doesNotMatch(src, /w-\[150px\]/)
  })

  test('the drawer splits what was read from what was worked out, for EVERY kind', () => {
    /**
     * The gap list used to be gated on `isProgram` — program or policy only. The forklift roster
     * is a RECORD: its row said "Needs work" off two gaps read from the page, and opening it
     * showed no gaps at all. A person was told there was work and never told what.
     */
    const src = code(read('components/DocumentReport.tsx'))
    assert.match(src, /const readGaps = openGaps\.filter\(\(g\) => g\.basis !== 'inferred'\)/)
    assert.match(src, /const noteGaps = openGaps\.filter\(\(g\) => g\.basis === 'inferred'\)/)
    assert.match(src, /title="Gaps read from the page"/)
    assert.match(src, /<Section title="Notes">/)
    assert.match(src, /\{hasFindings && \(/)
    assert.doesNotMatch(src, /\{isProgram && \(openGaps\.length > 0/,
      'the gap list is still gated on the document being a program')
  })

  test('the chat is told the two apart, so it cannot state a guess as a finding', () => {
    const src = code(read('lib/ask/documentsBrief.ts'))
    assert.match(src, /notes="\$\{d\.inferred_gap_count\}"/)
    assert.match(src, /inferred_gap_count/)
    // `gaps=` keeps its name and narrows to the read ones, so an answer written against the old
    // attribute cannot silently start counting notes.
    assert.doesNotMatch(src, /gaps="\$\{d\.open_gap_count\}"/)
  })
})

describe('a template run does not read its own template — decision 49', () => {
  test('`buildAuditInput` takes the id and drops it from EVERYTHING, not only from carries()', () => {
    const src = code(read('lib/audit.ts'))
    assert.match(src, /excludeDocumentId\?: string \| null/)
    assert.match(src, /\.filter\(\(r\) => !opts\.excludeDocumentId \|\| r\.document_id !== opts\.excludeDocumentId\)/)
    // Dropped from `all`, so it is in neither `documents` nor `other_documents`: the auditor's own
    // checklist is not evidence about the company, it is the question.
    const i = src.indexOf('const all =')
    const j = src.indexOf('const mine = all.filter(carries)')
    assert.ok(i > 0 && j > i, 'the filter must come before the two lists are split')
  })

  test('the run passes its own template_document_id, and an agency run passes null', () => {
    const src = code(read('lib/auditRun.ts'))
    assert.match(src,
      /excludeDocumentId: isTemplate \? \(runRow\?\.template_document_id \?\? null\) : null/)
  })

  test('the golden runner reports the block it fed, not a different one', () => {
    // A script that prints "17 documents" about a run that read 16 is §136 in miniature.
    const src = code(read('scripts/run-golden-audit.js'))
    assert.match(src, /excludeDocumentId: templateDocId/)
    assert.match(src, /async function templateDocumentIdFor/)
  })
})

describe('a golden key that the fifth word made out of date — E0a', () => {
  test('cascade-template-12 A5 accepts the fifth word, with the reason written on the case', () => {
    // The 2025 annual report ON FILE records the deviation; the notification evidence is what is
    // missing. That is a document answering the line in part. The key was written when there was
    // no word for that, and the owner widened it rather than let a right answer fail.
    const j = JSON.parse(read('tests/golden/audits/cases/cascade-template-12.json'))
    const all = [...(j.must ?? []), ...(j.must_not ?? []), ...(j.acceptable ?? [])]
    const a5 = all.find((c: { ref?: string }) => c.ref === 'A5')
    assert.ok(a5, 'cascade-template-12 has no A5 check')
    assert.deepEqual(a5.accept, ['nothing_on_file', 'on_file_gaps'])
    assert.match(a5.corrected, /THE KEY WAS OUT OF DATE, NOT THE ANSWER/)
  })
})

describe('a suggestion is never a finding and never in a count — decision 60', () => {
  test('the checklist report counts over findings only', () => {
    const src = code(read('components/AuditReport.tsx'))
    assert.match(src, /countsFor\(openF\.filter\(\(f\) => f\.kind !== 'expected'\)\)/)
    assert.doesNotMatch(src, /tCounts = \[\.\.\.countsFor\(openF\),/)
  })

  test('it carries the owner\'s own sixth label and is folded, always', () => {
    const src = read('components/AuditReport.tsx')
    assert.match(src, /title="Usually held — not seen/)
    assert.match(code(src), /expected: false,/)
  })
})
