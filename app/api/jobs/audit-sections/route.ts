// THE AUDIT SWEEP — Audits Run 2b, item 7.
//
//   GET  /api/jobs/audit-sections     (Vercel Cron, every five minutes, Authorization: Bearer CRON_SECRET)
//   POST /api/jobs/audit-sections     (by hand, x-cron-secret) — `lib/cronSecret.ts`
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
import { mustRows } from '@/lib/mustRead'
import { requireCronSecret } from '@/lib/jobAuth'
// A ROW ONLY WHEN THERE WAS WORK OR AN ERROR — not one every five minutes saying nothing (`lib/jobRun.ts`).
import { lazyJobRun } from '@/lib/jobRun'
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

/**
 * VERCEL CRON CALLS WITH GET — `Authorization: Bearer <CRON_SECRET>` (`lib/cronSecret.ts`). The same
 * job as POST, which stays for a person running it by hand with `x-cron-secret`. Workspace Stage 4 Part 3.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

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
  // Opened when the sweep finds work, before that work; an empty sweep writes no row (`lib/jobRun.ts`).
  const run = lazyJobRun(supabaseAdmin, 'audit_sections')
  const errors: Array<{ section: string; error: string }> = []
  let recovered = 0, done = 0, couldNotComplete = 0, companies = 0, runsFinished = 0, notified = 0
  // WHAT WENT OUT, ON THE RUN'S OWN ROW — the document sweep's reasoning: the provider's id is the
  // only thing that can settle "did it arrive" with Resend weeks later.
  const sent: Array<{ run: string; to: string; id: string | null; error?: string }> = []
  let stoppedForTime = false

  try {
    // ---- recover anything abandoned, before anything else ----
    const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS).toISOString()
    // *** S4 (root R2, Job E4): "NO WORK" AND "THE SWEEP IS BROKEN" LOOKED IDENTICAL. ***
    // Every read in this loop was `{ data: … }`. A failure anywhere made the sweep finish green
    // with `companies: 0` — and `lib/jobRun.ts` writes NO ROW for a run that found nothing and
    // errored nothing, so a sweep broken for days left no trace at all. That silence is what
    // `job_runs` exists to prevent. Thrown, so the catch records one whole row with the error.
    /**
     * *** AND A SECTION CLAIMED BUT NEVER STARTED IS RECOVERED TOO — R7, item S9. ***
     *
     * This looked only at `status = 'running'`. RULE 2 claims a company's whole queue at once and
     * leaves every section at `queued` until its turn (deliberately — "running" on four rows when
     * one is running is the product describing work that is not happening), so a sweep the platform
     * kills before its `finally` leaves those sections **queued with a claim no run will ever
     * take**: invisible to every later sweep, and the person watches an audit that never moves.
     * The `finally` covers the ordinary path; this covers the killed one, which is the only one
     * that needs recovering.
     */
    const stuck = mustRows<{ id: string; run_id: string; status: string }>('the audits that stalled',
      await supabaseAdmin.from('audit_sections').select('id, run_id, status')
        .in('status', ['running', 'queued']).lt('claimed_at', stuckBefore))
    if (stuck.length) await run.open()
    for (const s of stuck) {
      if (s.status === 'queued') {
        // Never started: the claim is all that is wrong with it, and it has written nothing.
        const freed = mustRows<{ id: string }>('that part of the audit',
          await supabaseAdmin.from('audit_sections')
            .update({ claimed_at: null })
            .eq('id', s.id).eq('status', 'queued').lt('claimed_at', stuckBefore).select('id'))
        if (freed.length) recovered++
        continue
      }
      /**
       * *** O3's OTHER HALF — R7, item S10. ***
       *
       * `runSection` inserts its findings BEFORE matching and collapsing, so a section the platform
       * killed after the insert left its rows in the table, showing on the report. The MANUAL retry
       * has deleted them since Job E (`app/api/audit-runs/[id]/sections/[sid]/retry/route.ts`);
       * this recovery did not, so re-running a killed section inserted a SECOND set and the report
       * showed every finding twice. The duplicate pass cannot help: it collapses across sections,
       * not across two attempts at one.
       *
       * Deleted rather than closed, for the reason the retry route gives: `closed` is the history
       * of a finding that WAS raised and then was not, and these were never a finished answer.
       * Before the re-queue, so a row that survives the delete is never re-run against.
       */
      const { error: oldRows } = await supabaseAdmin.from('audit_findings')
        .delete().eq('section_id', s.id).eq('run_id', s.run_id)
      if (oldRows) {
        errors.push({ section: s.id, error: `the stalled attempt's own findings could not be cleared, `
          + `so it is left alone rather than run again on top of them: ${oldRows.message}` })
        continue
      }
      // Guarded on the claim still being old, so a run that picked it up between the SELECT and
      // the UPDATE is not robbed of it (§4).
      const back = mustRows<{ id: string }>('that part of the audit',
        await supabaseAdmin.from('audit_sections')
          .update({ status: 'queued', claimed_at: null })
          .eq('id', s.id).eq('status', 'running').lt('claimed_at', stuckBefore).select('id'))
      if (back.length) recovered++
    }

    const unfinished = mustRows<{ id: string; company_id: string }>('the audits that did not finish',
      await supabaseAdmin.from('audit_runs').select('id, company_id')
        .in('status', ['queued', 'running']).order('created_at', { ascending: true }).limit(50))
    /**
     * *** THE RUNS NOTHING IS LEFT TO DO ON — R7, item S8. ***
     *
     * `finishRunIfDone` can throw: it reads the sections, summarises the findings and reads the
     * run's own summary, and all three throw since Job E (A2 and A8 — a failed read there stores
     * an all-zero summary and emails "nothing needs you"). The throw is caught per run below, so
     * the sweep survives it — and **nothing ever tries again**: every section is `done`, so the
     * recovery above has nothing to re-queue and no later sweep's queue contains this run. The
     * run says "Audit running" for ever, no email goes, and the agency shows no button. The
     * comment on `finishRunIfDone` said "the recovery re-runs it", and it does not.
     *
     * So every sweep begins by trying to finish the runs that have nothing left to do — once, not
     * per company, because this is a recovery and not part of the queue. It is the rule for the
     * state the throw leaves behind, and on an ordinary sweep it finds nothing.
     */
    for (const r of unfinished) {
      const left = mustRows<{ id: string }>('the parts of that audit still to run', await supabaseAdmin
        .from('audit_sections').select('id').eq('run_id', r.id)
        .in('status', ['queued', 'running']).limit(1))
      if (left.length) continue
      try {
        const fin = await finishRunIfDone(supabaseAdmin, r.id)
        if (!fin.finished) continue
        await run.open()
        runsFinished++
        const sent2 = await notifyRun(supabaseAdmin, r.id, fin.summary as RunSummary)
        if (sent2.notified) notified++
        if (sent2.id || sent2.error) {
          sent.push({ run: r.id, to: sent2.to ?? '', id: sent2.id ?? null, ...(sent2.error ? { error: sent2.error } : {}) })
        }
      } catch (e) {
        errors.push({ section: `run:${r.id}`, error: e instanceof Error ? e.message : String(e) })
      }
    }

    for (;;) {
      if (Date.now() - startedAt > BUDGET_MS - RESERVE_MS) { stoppedForTime = true; break }

      // The oldest queued section of the oldest queued run decides which company is next, so an
      // audit started at nine finishes before one started at ten. Ordered by the RUN's creation,
      // not the section's, because sections of one run are written in one statement and share a
      // timestamp — ordering on that would be arbitrary within a run.
      const nextRuns = mustRows<{ id: string; company_id: string; created_at: string }>(
        'the audits waiting to run', await supabaseAdmin.from('audit_runs')
          .select('id, company_id, created_at').in('status', ['queued', 'running'])
          .order('created_at', { ascending: true }).limit(50))
      let companyId: string | null = null
      for (const r of nextRuns) {
        const q = mustRows<{ id: string }>('the parts waiting on that audit', await supabaseAdmin
          .from('audit_sections')
          .select('id').eq('run_id', r.id).eq('status', 'queued').is('claimed_at', null).limit(1))
        if (q.length) { companyId = r.company_id; break }
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
      // The CLAIM's own result: an empty list here means another run took them, which `continue`
      // handles — a failed write must not look like that, or this loop spins on one company.
      const queue = mustRows<{ id: string; run_id: string; ordinal: number }>(
        'the parts this run claimed', await supabaseAdmin.from('audit_sections')
          .update({ claimed_at: nowIso })
          .eq('company_id', companyId).eq('status', 'queued').is('claimed_at', null)
          .select('id, run_id, ordinal'))
      if (!queue.length) continue
      await run.open()   // work found: the row exists before any section runs
      companies++

      // Run order, then ordinal: an older run's sections before a newer run's, and within a run
      /**
       * *** ONE COMPANY'S FAILURE MUST NOT END THE SWEEP — R7, item S9. ***
       *
       * The read below throws since Job E, and the throw reached the SWEEP's catch: the run ended
       * for every company after this one. The sections stay claimed, which is the recoverable
       * direction — the recovery at the top of this sweep now frees a claimed-but-queued section
       * after the stuck window — and the loop moves on, because a claimed company is one the next
       * `q` read cannot see.
       */
      try {
        // the order they were created in. The run's own created_at decides, read once.
        const runRows = mustRows<{ id: string; created_at: string }>('those audits',
          await supabaseAdmin.from('audit_runs')
            .select('id, created_at').in('id', [...new Set(queue.map((s) => s.run_id))]))
        const createdAt = new Map(runRows.map((r) => [r.id, r.created_at]))
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
          //
          // *** AND ONLY THIS RUN'S OWN CLAIMS — Workspace Stage 4 Part 3. *** This used to clear every
          // claimed, queued section of the company. A second sweep alive at the same time (a duplicate
          // cron delivery, or the `after()` kick from a new audit) may have claimed that company's newer
          // sections; clearing its claim let a third sweep take them too, and two sweeps would pay for
          // the same section. The ids are the ones this run claimed, and nothing else.
          await supabaseAdmin.from('audit_sections')
            .update({ claimed_at: null })
            .in('id', queue.map((s) => s.id)).eq('status', 'queued').eq('claimed_at', nowIso)
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
      } catch (e) {
        // S9: recorded against the company, and the sweep goes on to the next one.
        errors.push({ section: `company:${companyId}`, error: e instanceof Error ? e.message : String(e) })
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
