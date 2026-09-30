// THE AUDIT SWEEP — Audits Run 2b, item 7.
//
//   POST /api/jobs/audit-sections     (Vercel Cron, every five minutes, CRON_SECRET)
//
// *** IT IS THE DOCUMENT SWEEP'S SHAPE, AND DELIBERATELY NOT A SECOND DESIGN. ***
// `app/api/jobs/scan-documents/route.ts` already worked out the four rules — recover first, oldest
// queue decides the company, claim the whole company in one statement, check the budget per item —
// and every one of them is here for the same reason it is there. The differences are named where
// they occur and there are only three: a section claims on `claimed_at` rather than
// `documents.reading_since`, the order within a company is run-then-ordinal rather than upload time,
// and a run is finished rather than a batch.
//
// WHY A SWEEP AT ALL. One agency audit is 30 to 70 seconds on Haiku and will be minutes on a real
// model. A company with four agencies is past any serverless request ceiling, and a person who
// started it has left the tab. So the work is queued rows and a cron, and the answer arrives by
// email — which is the same reasoning §143's batches carry, one module across.

import { NextResponse, type NextRequest } from 'next/server'

import { supabaseAdmin } from '@/lib/auth'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { runSection, finishRunIfDone, runSummaryLine, type RunSummary } from '@/lib/auditRun'
import { notifyRun } from '@/lib/auditNotify'

export const maxDuration = 800

/**
 * THE TIME BUDGET, AND IT IS THE DOCUMENT SWEEP'S NUMBERS UNCHANGED.
 *
 * 640 s of budget, 130 s held back, so the run stops STARTING sections at **510 s**. A section is
 * one model call; the reserve is what lets the one in flight land, the run finish its own
 * `job_runs` row and send its email rather than being cut off mid-write. Copied rather than
 * re-derived, because two sweeps with two ceilings is two things to reason about.
 */
const BUDGET_MS = 640_000
const RESERVE_MS = 130_000
/** A claim older than this was abandoned by a run that died. Same 15 minutes as documents. */
const STUCK_AFTER_MS = 900_000

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response
  return sweep()
}

/**
 * Exported and callable with no request, so a route can kick it with `after()` and a test can call
 * it directly — the same reason the document sweep exports its own.
 */
export async function sweep() {
  const startedAt = Date.now()
  const run = await startJobRun(supabaseAdmin, 'audit_sections')
  const errors: Array<{ section: string; error: string }> = []
  let recovered = 0, done = 0, couldNotComplete = 0, companies = 0, runsFinished = 0, notified = 0
  // WHAT WENT OUT, ON THE RUN'S OWN ROW — the document sweep's reasoning: the provider's id is the
  // only thing that can settle "did it arrive" with Resend weeks later.
  const sent: Array<{ run: string; to: string; id: string | null; error?: string }> = []
  let stoppedForTime = false

  try {
    // ---- recover anything abandoned, before anything else ----
    const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS).toISOString()
    const { data: stuck } = await supabaseAdmin.from('audit_sections')
      .select('id').eq('status', 'running').lt('claimed_at', stuckBefore)
    for (const s of (stuck ?? []) as Array<{ id: string }>) {
      // Guarded on the claim still being old, so a run that picked it up between the SELECT and
      // the UPDATE is not robbed of it (§4).
      const { data: back } = await supabaseAdmin.from('audit_sections')
        .update({ status: 'queued', claimed_at: null })
        .eq('id', s.id).eq('status', 'running').lt('claimed_at', stuckBefore).select('id')
      if (back?.length) recovered++
    }

    for (;;) {
      if (Date.now() - startedAt > BUDGET_MS - RESERVE_MS) { stoppedForTime = true; break }

      // The oldest queued section of the oldest queued run decides which company is next, so an
      // audit started at nine finishes before one started at ten. Ordered by the RUN's creation,
      // not the section's, because sections of one run are written in one statement and share a
      // timestamp — ordering on that would be arbitrary within a run.
      const { data: nextRuns } = await supabaseAdmin.from('audit_runs')
        .select('id, company_id, created_at').in('status', ['queued', 'running'])
        .order('created_at', { ascending: true }).limit(50)
      let companyId: string | null = null
      for (const r of (nextRuns ?? []) as Array<{ id: string; company_id: string }>) {
        const { data: q } = await supabaseAdmin.from('audit_sections')
          .select('id').eq('run_id', r.id).eq('status', 'queued').is('claimed_at', null).limit(1)
        if (q?.length) { companyId = r.company_id; break }
      }
      if (!companyId) break

      // Claim the whole company's queued sections in one statement. A second run overlapping this
      // one sees nothing unclaimed here and moves to another company, which is what keeps one
      // company's audits strictly one after another across runs as well as within one.
      //
      // *** THE CLAIM IS `claimed_at` AND THE STATUS DOES NOT MOVE. *** Same reason the document
      // sweep claims on `reading_since`: writing `status = 'running'` across four sections puts
      // "running" on four rows when one is running and three are waiting — the product describing
      // work that is not happening. `runSection` sets `running` on the one it is actually doing.
      const nowIso = new Date().toISOString()
      const { data: claimed } = await supabaseAdmin.from('audit_sections')
        .update({ claimed_at: nowIso })
        .eq('company_id', companyId).eq('status', 'queued').is('claimed_at', null)
        .select('id, run_id, ordinal')
      const queue = ((claimed ?? []) as Array<{ id: string; run_id: string; ordinal: number }>)
      if (!queue.length) continue
      companies++

      // Run order, then ordinal: an older run's sections before a newer run's, and within a run
      // the order they were created in. The run's own created_at decides, read once.
      const { data: runRows } = await supabaseAdmin.from('audit_runs')
        .select('id, created_at').in('id', [...new Set(queue.map((s) => s.run_id))])
      const createdAt = new Map((runRows ?? []).map((r: { id: string; created_at: string }) => [r.id, r.created_at]))
      queue.sort((a, b) => (createdAt.get(a.run_id) ?? '').localeCompare(createdAt.get(b.run_id) ?? '')
        || a.ordinal - b.ordinal)

      const touchedRuns = new Set<string>()
      try {
        for (const sec of queue) {
          // Per SECTION, not per company: a company with forty agencies must not carry the run
          // past its ceiling.
          if (Date.now() - startedAt > BUDGET_MS - RESERVE_MS) {
            stoppedForTime = true
            // Hand the claim back so the next run takes it rather than the recovery above waiting
            // out fifteen minutes. The status never moved, so the row has been saying queued all
            // along and goes on saying it.
            await supabaseAdmin.from('audit_sections').update({ claimed_at: null }).eq('id', sec.id)
            continue
          }
          touchedRuns.add(sec.run_id)
          try {
            const r = await runSection(supabaseAdmin, sec.id)
            if (r.status === 'done') done++
            else { couldNotComplete++; errors.push({ section: sec.id, error: r.reason ?? 'no reason given' }) }
          } catch (e) {
            // `runSection` is written not to throw; this is the belt for the day it does, so one
            // section cannot take the sweep down with it.
            couldNotComplete++
            errors.push({ section: sec.id, error: e instanceof Error ? e.message : String(e) })
          }
        }
      } finally {
        // *** THE CLAIM IS RELEASED IN A FINALLY, ALWAYS. *** A section left claimed and queued is
        // invisible to the next sweep until the fifteen-minute recovery notices it, which is
        // fifteen minutes of a person watching a run that is not moving.
        await supabaseAdmin.from('audit_sections')
          .update({ claimed_at: null })
          .eq('company_id', companyId).eq('status', 'queued').not('claimed_at', 'is', null)
      }

      for (const runId of touchedRuns) {
        try {
          const fin = await finishRunIfDone(supabaseAdmin, runId)
          if (!fin.finished) continue
          runsFinished++
          const r = await notifyRun(supabaseAdmin, runId, fin.summary as RunSummary)
          if (r.notified) notified++
          if (r.id || r.error) {
            sent.push({ run: runId, to: r.to ?? '', id: r.id ?? null, ...(r.error ? { error: r.error } : {}) })
          }
        } catch (e) {
          errors.push({ section: `run:${runId}`, error: e instanceof Error ? e.message : String(e) })
        }
      }
    }
  } catch (e) {
    errors.push({ section: '(run)', error: e instanceof Error ? e.message : String(e) })
  }

  const counts = {
    companies, done, could_not_complete: couldNotComplete, recovered,
    runs_finished: runsFinished, notified, sent,
    stopped_for_time: stoppedForTime,
    wall_ms: Date.now() - startedAt,
  }
  await run.finish(counts, errors)
  return NextResponse.json({ job: 'audit_sections', run: run.id, ...counts, errors })
}

/** Re-exported so a caller that already has the summary can render the one line the email uses. */
export { runSummaryLine }
