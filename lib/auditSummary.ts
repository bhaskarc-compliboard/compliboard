/**
 * PATCHING A RUN'S SUMMARY WITHOUT ERASING IT — fix list **A2**, root R2, Job E.
 *
 * `audit_runs.summary` is one jsonb column that several things write to at different moments, each
 * adding its own key: the run's `note` ("This checklist names 14 lines…"), the extraction's receipt
 * (`extraction_ai_call_id`), the words a rule reshaped or refused (`reshaped_to_dates`,
 * `dropped_undated`, `dropped_wordless`), the duplicates a later section collapsed
 * (`collapsed_duplicates`), and the counts `summariseRun` writes at the end.
 *
 * There is no column for most of those, so each is added by read-modify-write. And it was written:
 *
 * ```ts
 * const { data: cur } = await db.from('audit_runs').select('summary')…   // error discarded
 * const prev = (cur?.summary ?? {}) as Record<string, unknown>           // a failure becomes {}
 * await db.from('audit_runs').update({ summary: { ...prev, …mine } })    // and overwrites the lot
 * ```
 *
 * *** SO A FAILED READ DID NOT LOSE THE PATCH. IT LOST EVERYTHING ELSE. *** The spread of `{}` wrote
 * a summary holding only the three keys this step happened to be adding, and the run's note, the
 * extraction receipt and every earlier section's counts were gone — permanently, because nothing
 * recomputes them. The report and the email then read what was left.
 *
 * It is a seam of its own because the only way to prove that is to make the read fail, and
 * `runSection` cannot be handed a database that errors on one statement.
 *
 * *** WHAT THIS DELIBERATELY DOES NOT DO. *** The other fix `docs/FIX-LIST-FAILURES.md` offers is
 * `summary || patch` in SQL, which would also close a read-modify-write race. That race is not live:
 * the sweep claims one company at a time and runs its sections one after another
 * (`app/api/jobs/audit-sections/route.ts`), which `lib/auditRun.ts` states at the first of these
 * call sites. Taking the SQL route means a migration and two functions to express "append to this
 * array" and "add to this number", and it would buy atomicity nothing is contending for. If sections
 * ever run concurrently, that is the fix to make, and this file is where it goes.
 */
import { mustRow, ReadFailed } from './mustRead.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export type Summary = Record<string, unknown>

export interface SummaryPatch {
  /** Keys whose value is a list this step adds to the end of. */
  append?: Record<string, unknown[]>
  /** Keys whose value is a running count this step adds to. */
  add?: Record<string, number>
}

/**
 * The merge, pure, so what it does to each kind of key is testable without a database.
 *
 * A key the patch does not name is carried through untouched — that is the whole point. A key it
 * names that `prev` holds in the wrong shape (a number where a list belongs, because an older
 * version of the code wrote it) is replaced rather than crashed on, and the previous value is not
 * silently added to a list it is not part of.
 */
export function mergeSummary(prev: Summary, patch: SummaryPatch): Summary {
  const out: Summary = { ...prev }
  for (const [key, items] of Object.entries(patch.append ?? {})) {
    if (!items.length) continue
    const was = Array.isArray(prev[key]) ? (prev[key] as unknown[]) : []
    out[key] = [...was, ...items]
  }
  for (const [key, n] of Object.entries(patch.add ?? {})) {
    if (!n) continue
    const was = Number(prev[key])
    out[key] = (Number.isFinite(was) ? was : 0) + n
  }
  return out
}

/** True when the patch would change nothing, so the read and the write can both be skipped. */
export function patchIsEmpty(patch: SummaryPatch): boolean {
  return !Object.values(patch.append ?? {}).some((v) => v.length)
    && !Object.values(patch.add ?? {}).some((v) => !!v)
}

export type PatchResult =
  | { ok: true; summary: Summary; changed: boolean }
  | { ok: false; error: ReadFailed | Error }

/**
 * Add this step's keys to a run's summary, keeping everything already there.
 *
 * **It returns the failure rather than throwing**, and the caller warns. A section that read a
 * document, called a model and saved its findings must not be marked `could_not_complete` because a
 * bookkeeping read failed — but it must not write a summary built on a failure either. So on a
 * failure nothing is written, and the keys this step would have added are lost. That is the lesser
 * loss, said out loud, instead of the run's note and receipt being lost silently.
 */
export async function patchRunSummary(db: Db, runId: string, patch: SummaryPatch): Promise<PatchResult> {
  if (patchIsEmpty(patch)) return { ok: true, summary: {}, changed: false }
  let prev: Summary
  try {
    prev = (mustRow<{ summary: Summary | null }>("the audit run's summary",
      await db.from('audit_runs').select('summary').eq('id', runId).maybeSingle())?.summary ?? {})
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) }
  }
  const summary = mergeSummary(prev, patch)
  const { error: wErr } = await db.from('audit_runs').update({ summary }).eq('id', runId)
  if (wErr) return { ok: false, error: new Error(`the audit run's summary could not be saved: ${wErr.message}`) }
  return { ok: true, summary, changed: true }
}

/**
 * *** WHAT HAPPENED TO THE LAST AUDIT'S FINDINGS — the owner's decision D1.4, 12 October 2026. ***
 *
 * One line, in one place, for the email, the drawer and Past audits — because three copies of a
 * count are three chances for them to disagree, which is what N3 was. Three facts, and they are
 * never added together:
 *
 *   · **still open from last time** — carried: the newer audit raised it again.
 *   · **now on file** — the one close an audit makes on its own, citing the document (D1.2).
 *   · **not raised this time** — still open, waiting for a person (D1.3). "please check" is there
 *     because it is the only one of the three that asks anything of them.
 *
 * Null when there is nothing to say, so a first audit carries no line at all.
 */
export function carryLine(s: { carried: number; closed: number; not_raised?: number }): string | null {
  const bits: string[] = []
  if (s.carried) bits.push(`${s.carried} still open from last time`)
  if (s.closed) bits.push(`${s.closed} now on file`)
  const nr = s.not_raised ?? 0
  if (nr) bits.push(`${nr} not raised this time — please check`)
  return bits.length ? bits.join(' · ') : null
}
