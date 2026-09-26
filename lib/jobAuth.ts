/**
 * THE NIGHTLY JOBS' FRONT DOOR — `DECISIONS.md` §125, Run 2 Task 4.
 *
 * The jobs run on Vercel Cron hitting a protected route; there is no worker. That means these
 * routes are on the public internet, and the only thing between an anonymous request and a
 * route that DELETES EVERY EXPIRED TRANSCRIPT is this header check.
 *
 * ---------------------------------------------------------------------------
 * WHY A SHARED SECRET AND NOT A SESSION
 *
 * There is no user. Cron is not signed in, has no company, and `requireCompany` has nothing to
 * check. So: a secret in the environment, sent as a header, compared here.
 *
 * *** IT REFUSES WHEN THE SECRET IS UNSET. *** The tempting shape is
 * `if (secret && header !== secret) refuse` — which, on a deploy where `CRON_SECRET` was never
 * set, opens the route to everyone and looks exactly like a route that is working. An absent
 * secret is a misconfiguration, and the safe reading of a misconfiguration is "no".
 *
 * *** AND THE COMPARISON IS LENGTH-SAFE. *** A plain `!==` on strings returns as soon as two
 * characters differ, so the time it takes leaks how much of a guess was right. `timingSafeEqual`
 * needs equal-length buffers, so the lengths are compared first — and that comparison leaks only
 * the length, which is not the secret.
 * ---------------------------------------------------------------------------
 */
import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export type JobAuth =
  | { ok: true }
  | { ok: false; response: NextResponse }

/** The header Vercel Cron is configured to send. */
const HEADER = 'x-cron-secret'

export function requireCronSecret(request: NextRequest): JobAuth {
  const expected = process.env.CRON_SECRET ?? ''
  if (!expected) {
    // Loud in the log, opaque to the caller. The operator needs to know the route is
    // misconfigured; an anonymous caller must not learn why it refused.
    console.error('JOB REFUSED: CRON_SECRET is not set, so no request can be authorised. ' +
                  'The job did not run.')
    return { ok: false, response: NextResponse.json({ error: 'Not found.' }, { status: 404 }) }
  }

  const given = request.headers.get(HEADER) ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  const same = a.length === b.length && timingSafeEqual(a, b)
  if (!same) {
    console.warn('JOB REFUSED: bad or missing cron secret.')
    // 404, not 401: an unauthenticated caller should not be able to confirm the route exists.
    return { ok: false, response: NextResponse.json({ error: 'Not found.' }, { status: 404 }) }
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

export async function startJobRun(admin: Db, job: 'summarise' | 'delete' | 'account_delete' | 'scan_documents'): Promise<JobRecorder> {
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
