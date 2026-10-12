/**
 * A9, A10, A14 and D5 — AN EMPTY LIST PRINTED AS A STATEMENT (root R3, Job E3).
 *
 * *** MADE TO FAIL ON THE OLD CODE FIRST. *** `oldSubject` is the shipped subject line copied
 * character for character, and the first group shows it emailing *"nothing needs you"* about an
 * audit whose every part failed.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { RunSummary } from '../../lib/auditRun.ts'

// Imported dynamically: `auditSubject` does not exist on the shipped `lib/auditNotify.ts`, and a
// top-level import of it makes the whole file fail to load — true, and silent about which behaviour
// changed. This way the old-code run names each failing case.
const auditSubject = (s: RunSummary): string => subjectFn!(s)
let subjectFn: ((s: RunSummary) => string) | null = null
test('load lib/auditNotify.ts', async () => {
  const m = await import('../../lib/auditNotify.ts') as { auditSubject?: (s: RunSummary) => string }
  subjectFn = m.auditSubject ?? (() => { throw new Error('auditSubject is not exported') })
})

const strip = (p: string) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const summary = (o: Partial<RunSummary> = {}): RunSummary => ({
  total: 0, needs_person: 0, nothing_on_file: 0, stale: 0, on_file: 0,
  not_a_document_question: 0, contradictions: 0, dates_passed: 0, expected: 0,
  sections: 1, sections_done: 1, could_not_complete: 0, carried: 0, closed: 0,
  attention: [], agencies: ['Oregon DEQ'], note: null, ...o,
})

/** `lib/auditNotify.ts` as it shipped. */
function oldSubject(s: RunSummary): string {
  return s.note
    ? 'Your audit is done'
    : s.needs_person
      ? `Your ${s.agencies.length === 1 ? s.agencies[0] : 'compliance'} audit: `
        + `${s.needs_person} thing${s.needs_person === 1 ? '' : 's'} that need`
        + `${s.needs_person === 1 ? 's' : ''} you`
      : `Your ${s.agencies.length === 1 ? s.agencies[0] : 'compliance'} audit: nothing needs you`
}

describe('*** A9: the subject line of an audit that did not happen ***', () => {
  // One section, it hit a rate limit, nothing finished. `needs_person` is counted from the
  // FINDINGS, and there are none — because nothing ran.
  const allFailed = summary({ sections: 1, sections_done: 0, could_not_complete: 1 })

  test('the OLD subject said "nothing needs you" about it', () => {
    assert.equal(oldSubject(allFailed), 'Your Oregon DEQ audit: nothing needs you',
      'this is the shipped behaviour, and it is a false statement in a mail list')
  })

  test('*** the new one says it could not be finished ***', () => {
    assert.equal(auditSubject(allFailed), 'Your Oregon DEQ audit could not be finished')
  })

  test('some finished and some did not: BOTH halves, and never "nothing needs you"', () => {
    const half = summary({ sections: 4, sections_done: 3, could_not_complete: 1, needs_person: 2,
                           agencies: ['Oregon DEQ', 'Oregon OSHA', 'Portland Fire', 'ODA'] })
    assert.equal(auditSubject(half),
      'Your compliance audit: 2 things that need you, and 1 of 4 parts did not finish')
  })

  test('some finished, none of them found anything, one failed: the failure leads', () => {
    const quiet = summary({ sections: 2, sections_done: 1, could_not_complete: 1 })
    assert.equal(auditSubject(quiet), 'Your Oregon DEQ audit: 1 of 2 parts did not finish')
    assert.ok(!auditSubject(quiet).includes('nothing needs you'),
      'what the part that never ran would have found is not known')
  })

  test('and a clean run is word for word what it was — this must not change', () => {
    for (const s of [summary(), summary({ needs_person: 1 }), summary({ needs_person: 5 }),
                     summary({ needs_person: 3, agencies: ['A', 'B'] })]) {
      assert.equal(auditSubject(s), oldSubject(s), JSON.stringify(s.agencies) + s.needs_person)
    }
  })

  /**
   * *** THE NOTE CASE LEFT THIS LIST — E10, N4. ***
   *
   * It used to be the fourth row above: `summary({ note: 'This checklist names Cascade Analytical,
   * not you.' })`, asserted equal to `oldSubject`, which answers "Your audit is done". That row has
   * `sections: 1, sections_done: 1` — a checklist audit that RAN. So the assertion pinned A9's own
   * defect one branch higher up: a finished checklist audit, and a checklist audit whose every part
   * failed, both reported "Your audit is done". The rule is now "no sections", and the cases are in
   * `tests/unit/noteIsNotAnEmptyState.test.ts`.
   */
  test('a note on a run that RAN no longer outranks the count (N4)', () => {
    const ran = summary({ note: 'This checklist names Cascade Analytical, not you.', needs_person: 2 })
    assert.equal(oldSubject(ran), 'Your audit is done', 'this is what shipped')
    assert.equal(auditSubject(ran), 'Your Oregon DEQ audit: 2 things that need you')
    // And with no sections at all, the note is still the whole answer.
    assert.equal(auditSubject(summary({ note: 'nothing to audit against', sections: 0, sections_done: 0 })),
      'Your audit is done')
  })

  test('plurals at one, on both halves', () => {
    assert.equal(auditSubject(summary({ needs_person: 1, sections: 1, sections_done: 1 })),
      'Your Oregon DEQ audit: 1 thing that needs you')
    // Two sections, one finished and found one thing, one failed: both halves singular.
    assert.equal(auditSubject(summary({ sections: 2, sections_done: 1, could_not_complete: 1,
                                       needs_person: 1 })),
      'Your Oregon DEQ audit: 1 thing that needs you, and 1 of 2 parts did not finish')
    // And the case above it: nothing finished, so there is no result to count.
    assert.equal(auditSubject(summary({ sections: 1, sections_done: 0, could_not_complete: 1,
                                       needs_person: 1 })),
      'Your Oregon DEQ audit could not be finished')
  })
})

describe('A9: and the corrected result is emailed after a retry', () => {
  const retry = strip('app/api/audit-runs/[id]/sections/[sid]/retry/route.ts')

  test('*** the retry clears `notified_at` — nothing did, so no correction was ever sent ***', () => {
    assert.match(retry, /notified_at: null/)
    assert.match(retry, /status: 'running', finished_at: null, notified_at: null/)
  })

  test('the write is checked, so a cleared status with a kept notified_at cannot happen quietly', () => {
    assert.match(retry, /if \(runErr\) throw runErr/)
  })

  test('and it counts the retry on the summary, so a second email can say why', () => {
    assert.match(retry, /patchRunSummary\(supabaseAdmin, id, \{\s*\n\s*add: \{ retried_parts: 1 \},/)
  })

  /**
   * *** AND WHETHER AN EMAIL ACTUALLY WENT IS READ BEFORE IT IS CLEARED — E10, §4. ***
   *
   * The sentence below was said whenever a part had been re-run, including when no email had gone
   * at all — which is the commonest reason somebody retries a part. Clearing `notified_at` destroys
   * the only record of it, so the retry reads it first and keeps it on the summary.
   */
  test('the retry records whether an email had gone, before clearing notified_at', () => {
    assert.match(retry, /mustRow<\{ notified_at: string \| null \}>\('this audit'/)
    assert.ok(retry.indexOf("select('notified_at')") < retry.indexOf('notified_at: null'),
      'it must be read BEFORE the update that clears it')
    assert.match(retry, /set: \{ emailed_before: true \}/)
  })

  test('summariseRun carries `retried_parts` past the end-of-run write', () => {
    // That write REPLACES the summary, so a key nobody carries forward disappears when the run
    // finishes — which is exactly what A2's entry is about.
    assert.match(strip('lib/auditRun.ts'), /retried_parts: Number\(\(\(run\?\.summary \?\? \{\}\)/)
  })

  test('the email says why the second one came — and only when there WAS a first one', () => {
    const notify = strip('lib/auditNotify.ts')
    assert.match(notify, /if \(summary\.retried_parts && summary\.emailed_before\) \{/)
    assert.match(notify, /This replaces the email we sent before/)
    // And the key survives the end-of-run write, like `retried_parts` beside it.
    assert.match(strip('lib/auditRun.ts'), /emailed_before: Boolean\(\(\(run\?\.summary \?\? \{\}\)/)
  })
})

describe('*** A10: "done" is per agency, not per run ***', () => {
  const route = strip('app/api/audits/index/route.ts')

  test('the last-done run for an agency is one that FINISHED that agency\'s section', () => {
    assert.match(route, /if \(doneTitles\.get\(id\)\?\.has\(l\) && !doneByAgency\.has\(l\)\) doneByAgency\.set\(l, r\)/)
    assert.ok(!/if \(r\.status === 'done' && !doneByAgency\.has\(l\)\) doneByAgency\.set\(l, r\)/.test(route),
      'the old rule took any done run carrying the label, failed section or not')
  })

  test('the sections are read BEFORE that choice is made, or it cannot be made at all', () => {
    const read = route.indexOf("from('audit_sections')")
    const choice = route.indexOf('const doneByAgency = new Map')
    assert.ok(read > 0 && read < choice)
  })

  test('*** and the amber line could never show: it read the ACTIVE run\'s sections ***', () => {
    const page = strip('app/audits/page.tsx')
    // It was `activeSections.filter(...)`, and `activeSections` is [] whenever there is no active
    // run — which is exactly when the line is drawn (`!v.activeRun`).
    assert.ok(!/const failed = activeSections\.filter/.test(page))
    assert.match(page, /const failedRunId = idx\.last_failed\?\.\[label\] \?\? null/)
    assert.match(page, /v\.failed\.length > 0 && !v\.activeRun/, 'the line itself is unchanged')
  })

  test('the server names the run that failed this agency', () => {
    assert.match(route, /last_failed: Object\.fromEntries/)
    assert.match(route, /failedTitles\.get\(id\)\?\.has\(l\)/)
  })

  test('a template run still appears for no agency — it carries no agency_label', () => {
    assert.match(route, /String\(r\.agency_label \?\? ''\)\.split\(' · '\)/)
  })
})

describe('*** A14: a checklist that could not be read, shown as "done · 0 to look at" ***', () => {
  const page = strip('app/audits/page.tsx')

  /**
   * *** CORRECTED BY E10, N4: THE TEST IS NO SECTIONS, NOT A NOTE. *** These two asserted the note
   * was the CONDITION, and `createRun` notes runs that finish as well ("This checklist names <X>;
   * treated as a template for you."), so every such audit lost its counts. A14's case — a checklist
   * the reading could not read — is a run with `section_count === 0`, and that is what both lines
   * now branch on. The behaviour is pinned in `tests/unit/noteIsNotAnEmptyState.test.ts`.
   */
  test('the note replaces the count on the landed-checklist line when there was nothing to audit', () => {
    assert.match(page, /\{landedTemplate\.section_count === 0/)
    assert.match(page, /Your audit against \{checklistTitle\(landedTemplate, idx\)\}: \{landedTemplate\.summary\?\.note\}/)
  })

  test('and on the run row in the list', () => {
    assert.match(page, /: r\.section_count === 0\s*\n?\s*\? r\.summary\?\.note/)
  })

  test('a run WITHOUT a note still shows its counts — the note is not a new empty state', () => {
    assert.match(page, /\{needsOf\(r\.summary\)\} to look at/)
    assert.match(page, /\{needsOf\(landedTemplate\.summary\)\} to look at/)
  })

  test('the note is written onto the run when the checklist could not be read', () => {
    // `createRun`'s template branch: 0 sections, status done, and the note on the summary.
    const run = strip('lib/auditRun.ts')
    assert.match(run, /summary: \{ \.\.\.summaryBase, note: noteLines\.join\(' '\) \}/)
  })
})

describe('*** D5: a gap still open is work still to do (the owner, 10 Oct) ***', () => {
  const m = readFileSync('supabase/migrations/079_a_gap_still_open_is_work_still_to_do.sql', 'utf8')

  test('the branch is in the view', () => {
    assert.match(m, /when coalesce\(g\.open_gaps, 0\) > 0 then 'needs_work'/)
  })

  test('it sits AFTER expired and expiring, and BEFORE every "nothing to do" branch', () => {
    const expiring = m.indexOf("then 'expiring'")
    const gap = m.indexOf("when coalesce(g.open_gaps, 0) > 0 then 'needs_work'")
    const current = m.indexOf("in ('permit', 'certificate') then 'current'")
    const recorded = m.indexOf("= 'record' then 'recorded'")
    const onFile = m.indexOf("else 'on_file'")
    assert.ok(expiring > 0 && gap > expiring, 'an expiry is the more urgent fact')
    assert.ok(gap < current && gap < recorded && gap < onFile,
      'those three are the branches that were making the false statement')
  })

  test('`gaps_found` is untouched, so nothing that says "Needs work" today stops', () => {
    assert.match(m, /when s\.status = 'gaps_found' then 'needs_work'/)
  })

  test('the verify block TRIES it, both ways, and keeps the expiry case', () => {
    assert.match(m, /MIGRATION 079 FAILED: a document with an open gap shows/)
    assert.match(m, /MIGRATION 079 FAILED: the document still says needs_work with no open gap left/)
    assert.match(m, /MIGRATION 079 FAILED: an expired permit with an open gap shows/)
  })

  test('and it proves its own fixture first — a check that cannot see a presence proves nothing', () => {
    assert.match(m, /the probe does not have the 1 open gap it needs \(% found\), so the check proves nothing/)
  })
})
