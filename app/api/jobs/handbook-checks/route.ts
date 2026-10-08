// THE HANDBOOK SWEEP — HR Step 8, part 1.
//   GET  /api/jobs/handbook-checks     (Vercel Cron, Authorization: Bearer CRON_SECRET) — NOT scheduled yet: the
//                                       vercel.json entry is step 10's (the owner). Until then it is called by hand.
//   POST /api/jobs/handbook-checks     (by hand, x-cron-secret) — `lib/cronSecret.ts`
//
// The audit sweep's shape (`app/api/jobs/audit-sections/route.ts`), copied into `lib/handbookCheck.ts` sweepChecks
// so a script can drive it; this route is the door. A `job_runs` row only when there was work or an error
// (`lib/jobRun.ts`, job 'handbook_checks').
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/auth'
import { requireCronSecret } from '@/lib/jobAuth'
import { sweepChecks } from '@/lib/handbookCheck'

export const maxDuration = 800

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response
  const r = await sweepChecks(supabaseAdmin)
  return NextResponse.json({ job: 'handbook_checks', ...r })
}
