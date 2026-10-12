/**
 * *** A NOTE ON A RUN IS NOT "THE AUDIT COULD NOT BE DONE" *** — E10, N4.
 *
 * Job E's A14 made a note on an audit run replace the count, because a checklist the reading could
 * not read becomes a DONE run with 0 sections and a note saying why, and the page said
 * "is done · 0 to look at" about an audit that never happened.
 *
 * *** BUT `createRun` ALSO NOTES RUNS THAT FINISH. *** `lib/auditRun.ts` writes
 * "This checklist names <X>; treated as a template for you." on a run whose every section is queued
 * and about to run — that is the NORMAL case of auditing yourself against an auditor's own field
 * form, and Run 5a item 6 decided deliberately to note it and audit it anyway.
 *
 * So four places read "has a note" as "could not be done", and a perfectly good checklist audit came
 * out with its counts missing:
 *
 *   - `app/audits/page.tsx`, the landed-checklist line;
 *   - `app/audits/page.tsx`, the Past audits row;
 *   - `lib/auditNotify.ts` `auditSubject` — which is A9's own function, carrying A9's defect in the
 *     branch above the fix: a checklist run whose every part failed got "Your audit is done";
 *   - `lib/auditRun.ts` `runSummaryLine`, the banner and the email's first paragraph.
 *
 * The test is NO SECTIONS. `summary.sections` (and the run row's `section_count`) is 0 only when
 * there was nothing to audit against. A note beside a real result is said as well as the counts.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { auditSubject } from '../../lib/auditNotify.ts'
import { runSummaryLine, type RunSummary } from '../../lib/auditRun.ts'

const NOTE = 'This checklist names Cascade Analytical; treated as a template for you.'

const summary = (o: Partial<RunSummary> = {}): RunSummary => ({
  total: 0, needs_person: 0, nothing_on_file: 0, stale: 0, on_file: 0,
  not_a_document_question: 0, contradictions: 0, dates_passed: 0, expected: 0,
  sections: 1, sections_done: 1, could_not_complete: 0, carried: 0, closed: 0,
  attention: [], agencies: ['Oregon DEQ'], note: null, ...o,
} as RunSummary)

describe('*** N4: a finished checklist audit shows its counts ***', () => {
  test('a run with sections and a note is a run that HAPPENED: the subject counts', () => {
    const finished = summary({ note: NOTE, sections: 3, sections_done: 3, needs_person: 2 })
    assert.equal(auditSubject(finished), 'Your Oregon DEQ audit: 2 things that need you')
    assert.ok(!auditSubject(finished).includes('Your audit is done'),
      'the note must not swallow the result of an audit that ran')
  })

  test('and the part that did not finish is still said — A9, which the note branch was hiding', () => {
    const halfFailed = summary({ note: NOTE, sections: 4, sections_done: 3, could_not_complete: 1, needs_person: 2 })
    assert.equal(auditSubject(halfFailed),
      'Your Oregon DEQ audit: 2 things that need you, and 1 of 4 parts did not finish')
    const allFailed = summary({ note: NOTE, sections: 2, sections_done: 0, could_not_complete: 2 })
    assert.equal(auditSubject(allFailed), 'Your Oregon DEQ audit could not be finished',
      'before E10 this said "Your audit is done" about a checklist audit where nothing ran at all')
  })

  test('no sections IS the could-not-be-done case, and A14 still holds there', () => {
    const nothingToAudit = summary({
      note: 'We could not find any checklist lines in that file, so there was nothing to audit against. The file is on file.',
      sections: 0, sections_done: 0,
    })
    assert.equal(auditSubject(nothingToAudit), 'Your audit is done')
    assert.equal(runSummaryLine(nothingToAudit), nothingToAudit.note)
  })

  test('the banner and the email paragraph say the result AND the note, in that order', () => {
    const line = runSummaryLine(summary({ note: NOTE, sections: 3, sections_done: 3, needs_person: 1, nothing_on_file: 1 }))
    assert.equal(line, 'Your Oregon DEQ audit found 1 thing that needs you: 1 thing with nothing on file. ' + NOTE)
    // A run with no note is byte-identical to what it was.
    assert.equal(runSummaryLine(summary({ needs_person: 1, nothing_on_file: 1 })),
      'Your Oregon DEQ audit found 1 thing that needs you: 1 thing with nothing on file.')
  })

  test('both places on the page decide on section_count, not on the note', () => {
    const page = readFileSync('app/audits/page.tsx', 'utf8')
    assert.match(page, /\{landedTemplate\.section_count === 0/)
    assert.match(page, /: r\.section_count === 0\s*\n?\s*\? r\.summary\?\.note/)
    // And neither of them uses the note to decide whether the audit happened. The shape that did:
    // `{landedTemplate.summary?.note ? <>…: {note}</> : <>…is done…</>}`.
    assert.ok(!/\{landedTemplate\.summary\?\.note\s*\n?\s*\? <>Your audit against/.test(page),
      'the landed-checklist line still decides on the note')
    assert.ok(!/: r\.summary\?\.note\s*\n?\s*\? r\.summary\.note/.test(page),
      'the Past audits row still decides on the note')
  })

  test('a finished run with a note still shows the note, on its own line', () => {
    const page = readFileSync('app/audits/page.tsx', 'utf8')
    assert.match(page, /r\.section_count > 0 && r\.summary\?\.note/)
  })

  test('the note is still written on a checklist that finished — that is the whole point', () => {
    const run = readFileSync('lib/auditRun.ts', 'utf8')
    assert.match(run, /treated as a template for you/)
    // It goes on the run whether or not there are sections: `summaryBase` carries it into the
    // queued branch too.
    assert.match(run, /\.\.\.\(sections\.length\s*\n?\s*\? \(hasSummary \? \{ summary: summaryBase \} : \{\}\)/)
  })
})
