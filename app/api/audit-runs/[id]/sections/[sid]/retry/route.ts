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

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { db } = authed.auth
    const { id, sid } = await ctx.params

    // Ownership of BOTH, on the caller's client, and the section must belong to this run — a
    // section id from another run of the same company would otherwise be retryable through the
    // wrong URL, which is a smaller version of the same bug 404-not-403 exists to close.
    const { data: run } = await db.from('audit_runs').select('id').eq('id', id).maybeSingle()
    if (!run) return NextResponse.json({ error: 'That audit was not found.' }, { status: 404 })
    const { data: section } = await db.from('audit_sections')
      .select('id, status, title').eq('id', sid).eq('run_id', id).maybeSingle()
    if (!section) return NextResponse.json({ error: 'That part of the audit was not found.' }, { status: 404 })

    if (section.status !== 'could_not_complete') {
      return NextResponse.json({
        error: section.status === 'done'
          ? `The ${section.title} part finished, so there is nothing to run again.`
          : `The ${section.title} part is already waiting to run.`,
      }, { status: 400 })
    }

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
    await supabaseAdmin.from('audit_runs')
      .update({ status: 'running', finished_at: null }).eq('id', id)

    after(async () => {
      try { await sweep() } catch (e) { console.error('kicked audit sweep failed:', e) }
    })
    return NextResponse.json({ ok: true, queued: section.title })
  } catch (error) {
    console.error('audit section retry:', error)
    return NextResponse.json({ error: 'We could not run that again just now.' }, { status: 500 })
  }
}
