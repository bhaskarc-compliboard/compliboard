// THE HANDBOOK NIGHT QUEUE — HR Step 10 (HR-PLAN decision 13).
//   GET  /api/jobs/handbook-queue     (Vercel Cron, 10:00 UTC, Authorization: Bearer CRON_SECRET)
//   POST /api/jobs/handbook-queue     (by hand, x-cron-secret) — `lib/cronSecret.ts`
//
// It ONLY QUEUES (`lib/handbookCheck.ts` queueDueChecks): every current, read handbook that has never been checked,
// is a newer version not yet checked, or whose next_check_at has passed gets a check with no requester (so no email).
// Then `after()` starts the sweep, which does the checking; the five-minute sweep carries on from there.
//
// The cron secret first, like the sweep (a 404 without it, writing nothing). Recorded in job_runs as 'handbook_checks' (the
// name migration 066 gave HR's queue; the sweep writes under it too, and the counts say which job wrote a row).
import { NextResponse, after, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/auth'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { queueDueChecks, sweepChecks } from '@/lib/handbookCheck'

export const maxDuration = 800

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response
  // The nightly jobs' record: a row opened before the work (`lib/jobAuth.ts` startJobRun), so a crash is visible.
  const run = await startJobRun(supabaseAdmin, 'handbook_checks')
  const errors: Array<{ error: string }> = []
  let result: Awaited<ReturnType<typeof queueDueChecks>> = { queued: [], skippedOpen: [], notDue: 0 }
  try {
    result = await queueDueChecks(supabaseAdmin)
  } catch (e) {
    errors.push({ error: e instanceof Error ? e.message : String(e) })
  }
  await run.finish({ job: 'queue', queued: result.queued, skipped_open: result.skippedOpen, not_due: result.notDue }, errors)
  if (result.queued.length) {
    after(async () => {
      try { await sweepChecks(supabaseAdmin) } catch (e) { console.error('handbook queue: kicked sweep failed:', e) }
    })
  }
  return NextResponse.json({ job: 'handbook_queue', run: run.id, queued: result.queued, skipped_open: result.skippedOpen, not_due: result.notDue, errors })
}
