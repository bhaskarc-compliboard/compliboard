// RUN ONE SECTION AGAIN — Audits Run 2c, item 11.
//
//   POST /api/audit-runs/[id]/sections/[sid]/retry
//
// *** ONLY A SECTION THAT COULD NOT COMPLETE. *** Re-running a `done` section would write a second
// set of findings for the same agency into the same run and the report would show everything twice.
// Re-running a `queued` or `running` one would race the sweep. So the guard is in the UPDATE's own
// WHERE clause, not in an `if` above it: a section that changed state between the read and the write
// is simply not updated, and the caller is told nothing happened.

import { NextResponse, type NextRequest } from 'next/server'
import { after } from 'next/server'

import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { sweep } from '@/app/api/jobs/audit-sections/route'
import { patchRunSummary } from '@/lib/auditSummary'
import { mustRow } from '@/lib/mustRead'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { db } = authed.auth
    const { id, sid } = await ctx.params

    // Ownership of BOTH, on the caller's client, and the section must belong to this run — a
    // section id from another run of the same company would otherwise be retryable through the
    // wrong URL, which is a smaller version of the same bug 404-not-403 exists to close.
    // A15's shape, finished here (E10, §4): a failed read answering "not found" is a claim about
    // the person's own audit, and only one of the two possible causes is theirs. `mustRow` throws
    // and the catch below answers 500 with a sentence saying it is our side.
    const run = mustRow<{ id: string }>('that audit',
      await db.from('audit_runs').select('id').eq('id', id).maybeSingle())
    if (!run) return NextResponse.json({ error: 'That audit was not found.' }, { status: 404 })
    const section = mustRow<{ id: string; title: string; status: string }>('that part of the audit',
      await db.from('audit_sections')
        .select('id, status, title').eq('id', sid).eq('run_id', id).maybeSingle())
    if (!section) return NextResponse.json({ error: 'That part of the audit was not found.' }, { status: 404 })

    if (section.status !== 'could_not_complete') {
      return NextResponse.json({
        error: section.status === 'done'
          ? `The ${section.title} part finished, so there is nothing to run again.`
          : `The ${section.title} part is already waiting to run.`,
      }, { status: 400 })
    }

    // *** O3 (fix list §4, Job E4): THIS SECTION'S OLD ROWS GO FIRST. ***
    // `runSection` inserts findings BEFORE matching and collapsing, so a section that failed after
    // the insert left its rows in the table, showing on the report. Running it again inserted a
    // SECOND set, and the duplicate pass cannot help: it collapses across sections, not across two
    // attempts at one. So the attempt being replaced is cleared before the section is re-queued —
    // the rows belong to an attempt that did not finish, and nothing else points at them.
    //
    // Deleted rather than closed, deliberately: `closed` is the history of a finding that WAS
    // raised and then was not (§3.2), and these were never a finished answer about anything.
    const { error: oldRows } = await supabaseAdmin.from('audit_findings')
      .delete().eq('section_id', sid).eq('run_id', id)
    if (oldRows) throw oldRows

    // The reason is cleared with the status, because 058 refuses a queued section that carries one —
    // the constraint is what makes "a reason means it failed" true rather than hoped for.
    const { data: back, error } = await supabaseAdmin.from('audit_sections')
      .update({ status: 'queued', claimed_at: null, could_not_complete_reason: null,
                started_at: null, finished_at: null })
      .eq('id', sid).eq('status', 'could_not_complete').select('id')
    if (error) throw error
    if (!back?.length) {
      return NextResponse.json({ error: 'That part changed while we were looking at it. Try again.' },
        { status: 409 })
    }

    // The run goes back to running, so a finished run that has a part re-queued does not go on
    // claiming it is done — and `finishRunIfDone` will claim it again when the part lands.
    //
    // *** `notified_at` GOES WITH IT — fix list A9, Job E3. ***
    // `notifyRun` refuses a run that already has one (`lib/auditNotify.ts:76`), and that guard is
    // right: it is what stops a duplicate email. But nothing cleared it on a retry, so **the
    // corrected result was never emailed at all.** The person was told "nothing needs you" about an
    // audit whose every part had failed, pressed Run again, it worked, and they heard nothing. One
    // duplicate is recoverable; a correction nobody is told about is not.
    //
    // *** AND WHETHER ONE HAD ACTUALLY GONE IS READ BEFORE IT IS CLEARED (E10, §4). *** The second
    // email opens "This replaces the email we sent before", and that was said whenever a part had
    // been re-run — including when the first email never went at all, because the run failed before
    // `notifyRun` or because the send itself failed. Clearing `notified_at` destroys the only
    // record of it, so it is read first and kept on the summary. Checked, because reading it as
    // absent is exactly how the false sentence gets said (root R2).
    const before = mustRow<{ notified_at: string | null }>('this audit',
      await supabaseAdmin.from('audit_runs').select('notified_at').eq('id', id).maybeSingle())

    const { error: runErr } = await supabaseAdmin.from('audit_runs')
      .update({ status: 'running', finished_at: null, notified_at: null }).eq('id', id)
    if (runErr) throw runErr

    // Counted on the summary so the second email can say why it is the second. There is no column
    // for it; `patchRunSummary` keeps every other key (fix list A2) and `summariseRun` carries this
    // one forward past the end-of-run write.
    //
    // `emailed_before` goes with it, and is only ever set to true: a later retry does not un-send
    // an email that went, and `patchRunSummary`'s `set` keeps every other key.
    const patched = await patchRunSummary(supabaseAdmin, id, {
      add: { retried_parts: 1 },
      ...(before?.notified_at ? { set: { emailed_before: true } } : {}),
    })
    if (!patched.ok) {
      console.warn(`audit retry ${sid}: the run's summary was left as it was — ${patched.error.message}`)
    }

    after(async () => {
      try { await sweep() } catch (e) { console.error('kicked audit sweep failed:', e) }
    })
    return NextResponse.json({ ok: true, queued: section.title })
  } catch (error) {
    console.error('audit section retry:', error)
    return NextResponse.json({ error: 'We could not run that again just now.' }, { status: 500 })
  }
}
