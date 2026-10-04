/**
 * THE NIGHTLY JOBS' FRONT DOOR — `DECISIONS.md` §125, Run 2 Task 4; Workspace Stage 4 Part 3.
 *
 * The jobs run on Vercel Cron hitting a protected route; there is no worker. That means these
 * routes are on the public internet, and the only thing between an anonymous request and a
 * route that DELETES EVERY EXPIRED TRANSCRIPT is this check.
 *
 * WHY A SHARED SECRET AND NOT A SESSION: there is no user. Cron is not signed in, has no company,
 * and `requireCompany` has nothing to check. So: a secret in the environment, sent as a header.
 *
 * *** THE RULE IS `cronVerdict` (`lib/cronSecret.ts`), tested in `tests/unit/cronSecret.test.ts`. ***
 * GET with `Authorization: Bearer <CRON_SECRET>` is Vercel Cron; POST with `x-cron-secret` is a
 * person running a job by hand. Both compared with `timingSafeEqual`; an unset secret refuses both.
 * Until Stage 4 Part 3 only the POST door existed, and every scheduled call was GET → 405.
 *
 * *** EVERY REFUSAL IS 404, AND STAYS 404. *** An unauthenticated caller must not be able to confirm
 * that the route exists, and a refusal that answered 401 would confirm exactly that. Vercel's own
 * example answers 401, but nothing reads the status but a person in the logs, and the log line below
 * says which refusal it was. 404 is also what the routes have always answered, so the runbooks
 * (`docs/TESTING.md`) and anything watching for it are unchanged.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cronVerdict } from './cronSecret.ts'

export type JobAuth =
  | { ok: true }
  | { ok: false; response: NextResponse }

const NOT_FOUND = () => NextResponse.json({ error: 'Not found.' }, { status: 404 })

export function requireCronSecret(request: NextRequest): JobAuth {
  const verdict = cronVerdict(request.method, (n) => request.headers.get(n), process.env.CRON_SECRET)
  if (verdict === 'unset') {
    // Loud in the log, opaque to the caller. The operator needs to know the route is
    // misconfigured; an anonymous caller must not learn why it refused.
    console.error('JOB REFUSED: CRON_SECRET is not set, so no request can be authorised. ' +
                  'The job did not run.')
    return { ok: false, response: NOT_FOUND() }
  }
  if (verdict === 'refused') {
    console.warn(`JOB REFUSED: ${request.method} with a bad or missing cron secret ` +
                 '(GET needs "Authorization: Bearer <CRON_SECRET>"; POST needs "x-cron-secret").')
    return { ok: false, response: NOT_FOUND() }
  }
  return { ok: true }
}

/**
 * ONE ROW PER RUN — `DECISIONS.md` §116's second release gate, as a table.
 *
 * "Did it run, and what did it touch" has to be answerable from the database. A retention
 * promise on screen with nothing enforcing it is a false statement to a customer; a deletion job
 * with no record of having run is the same statement one step removed.
 *
 * The row is opened BEFORE the work and closed after, so a job that crashes half way leaves a
 * row with `finished_at` null — which is a visible failure rather than an absence indistinguishable
 * from "cron never fired".
 */
export interface JobRecorder {
  id: string
  finish(counts: Record<string, unknown>, errors: unknown[]): Promise<void>
}

type Db = { from: (t: string) => any }

export async function startJobRun(admin: Db, job: 'summarise' | 'delete' | 'account_delete' | 'scan_documents' | 'audit_sections'): Promise<JobRecorder> {
  const { data, error } = await admin.from('job_runs').insert({ job }).select('id').single()
  if (error) throw new Error(`could not open a job_runs row for ${job}: ${error.message}`)
  const id = data.id as string
  return {
    id,
    async finish(counts, errors) {
      const { error: e } = await admin.from('job_runs').update({
        finished_at: new Date().toISOString(),
        counts,
        errors,
        // `ok` is about whether the RUN completed, not whether every item succeeded. A run that
        // processed 40 of 41 topics is a successful run with one recorded error — collapsing
        // those would make one bad topic look like a failed deletion sweep.
        ok: true,
      }).eq('id', id)
      if (e) console.error(`could not close job_runs ${id}: ${e.message}`)
    },
  }
}
