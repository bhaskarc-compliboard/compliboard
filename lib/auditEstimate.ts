// HOW LONG THIS WILL TAKE — Audits Run 2b, item 9.
//
// *** IT IS MEASURED, NEVER GUESSED, AND IT SAYS WHAT IT RESTS ON. ***
// "About four minutes" with nothing behind it is the omniscient status tracker in a smaller costume
// (§6). So the number comes from `audit_sections` rows that actually finished, and the sentence names
// how many — a person who reads "from 3 earlier sections" knows to distrust it, which is the honest
// state of a young product.
//
// *** THE LEDGER'S `wall_ms` IS NOT USED, AND THAT IS THE WHOLE POINT OF THIS FILE. ***
// `ai_calls.wall_ms` times the MODEL CALL. A section is the call plus building the input block (four
// table reads), resolving handles, writing up to seventy finding rows, and the section's own two
// updates. On the Run 2a golden runs the call was 27–70 s while the section was 30–72 s, so the
// ledger would under-report every time, always in the direction that makes the product look faster
// than it is. `started_at` to `finished_at` on the row is the thing a person actually waits for.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export interface Estimate {
  /** Mean seconds per section, or null when nothing has ever finished. */
  meanSeconds: number | null
  /** How many finished sections the mean rests on. Zero means the sentence below says so. */
  sampleSize: number
  /** Whether the sample is this company's own, or everybody's. */
  scope: 'company' | 'all' | 'none'
  /** The sentence to show. Never a bare number. */
  line: string
}

/**
 * This company's own finished sections first, because a company with forty documents per agency is
 * slower than one with two and its own history says so. Falls back to every company's, which is
 * still measured, and says which it used.
 */
export async function estimateRun(db: Db, companyId: string, sections = 1): Promise<Estimate> {
  const own = await meanOf(db, companyId)
  const use = own.n > 0 ? { ...own, scope: 'company' as const } : { ...(await meanOf(db, null)), scope: 'all' as const }

  if (!use.n || use.mean === null) {
    return {
      meanSeconds: null, sampleSize: 0, scope: 'none',
      line: 'This is your first audit; we will email you when it is done.',
    }
  }

  const totalSeconds = use.mean * Math.max(1, sections)
  const minutes = Math.max(1, Math.round(totalSeconds / 60))
  return {
    meanSeconds: use.mean, sampleSize: use.n, scope: use.scope,
    line: `About ${minutes} minute${minutes === 1 ? '' : 's'}, from ${use.n} earlier `
      + `section${use.n === 1 ? '' : 's'}${use.scope === 'all' ? ' across all companies' : ''}.`,
  }
}

/** Both timestamps, or the row is not evidence about duration. */
async function meanOf(db: Db, companyId: string | null): Promise<{ mean: number | null; n: number }> {
  let q = db.from('audit_sections')
    .select('started_at, finished_at')
    .eq('status', 'done')
    .not('started_at', 'is', null)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    // The last fifty, so a model change six weeks ago stops dragging the number around.
    .limit(50)
  if (companyId) q = q.eq('company_id', companyId)

  const { data, error } = await q
  if (error) throw new Error(`estimateRun: ${error.message}`)
  const rows = (data ?? []) as Array<{ started_at: string; finished_at: string }>
  const seconds = rows
    .map((r) => (Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)
    // A negative or absurd duration is a clock problem, not a measurement. Dropped rather than
    // averaged in, and it cannot make the estimate look better — only more honest about its sample.
    .filter((s) => s > 0 && s < 3600)
  if (!seconds.length) return { mean: null, n: 0 }
  return { mean: seconds.reduce((a, b) => a + b, 0) / seconds.length, n: seconds.length }
}
