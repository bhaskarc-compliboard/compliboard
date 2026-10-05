/**
 * A ROW ONLY WHEN THERE WAS SOMETHING TO SAY — the two five-minute sweeps' `job_runs` record.
 * Cron release follow-up, 4 October 2026 (`DECISIONS.md` §163).
 *
 * `scan-documents` and `audit-sections` run every five minutes. Opening a `job_runs` row at the top of
 * every run (`startJobRun`, `lib/jobAuth.ts`) wrote 576 rows a day saying "nothing to do", and nothing
 * clears the table. So a sweep's row is opened LAZILY:
 *
 *   · `open()` — called by the sweep the moment it finds work (a stuck row recovered, or a company's
 *     queue claimed), BEFORE that work runs. A run that then crashes still leaves its row with
 *     `finished_at` null, which is the property `startJobRun` exists for: a visible failure, not an
 *     absence indistinguishable from "cron never fired".
 *   · `finish(counts, errors)` — closes the opened row as before; a run that never opened one but hit
 *     an error writes ONE complete row (an error is always recorded); a run that found nothing and
 *     failed at nothing writes NOTHING.
 *
 * The nightly `summarise` and `delete` keep `startJobRun`: they run once a night, and their row is the
 * evidence that they ran. For the sweeps, Vercel's own cron log is that evidence (`docs/TESTING.md`,
 * the cron release's CR-1).
 *
 * No Next.js here, so `tests/unit/jobRun.test.ts` drives it with a stand-in database.
 */
type Db = { from: (t: string) => any }   // eslint-disable-line @typescript-eslint/no-explicit-any

// 'handbook_checks' is HR's queue (HR Step 3b; migration 066 adds it to job_runs_job_check). No route
// yet — that is HR step 10.
export type SweepJob = 'scan_documents' | 'audit_sections' | 'handbook_checks'

/** What `finish` does: close the opened row, write a whole one, or write nothing. */
export type RecordDecision = 'update' | 'insert' | 'none'

export function recordDecision(opened: boolean, errorCount: number): RecordDecision {
  if (opened) return 'update'
  return errorCount > 0 ? 'insert' : 'none'
}

export interface LazyJobRun {
  /** The row's id once opened; null while nothing has been recorded. */
  readonly id: string | null
  open(): Promise<void>
  finish(counts: Record<string, unknown>, errors: unknown[]): Promise<RecordDecision>
}

export function lazyJobRun(admin: Db, job: SweepJob): LazyJobRun {
  let id: string | null = null
  let opening: Promise<void> | null = null
  return {
    get id() { return id },
    open() {
      // Once only, however many times the sweep finds work.
      opening ??= (async () => {
        const { data, error } = await admin.from('job_runs').insert({ job }).select('id').single()
        if (error) throw new Error(`could not open a job_runs row for ${job}: ${error.message}`)
        id = data.id as string
      })()
      return opening
    },
    async finish(counts, errors) {
      const decision = recordDecision(id !== null, errors.length)
      if (decision === 'none') return decision
      // `ok` is about whether the RUN completed, not whether every item succeeded — as `startJobRun`.
      const closing = { finished_at: new Date().toISOString(), counts, errors, ok: true }
      const { error } = decision === 'update'
        ? await admin.from('job_runs').update(closing).eq('id', id)
        : await admin.from('job_runs').insert({ job, ...closing })
      if (error) console.error(`could not ${decision === 'update' ? 'close' : 'write'} job_runs for ${job}: ${error.message}`)
      return decision
    },
  }
}
