/**
 * WHAT STOPS A FOLDER BEING DELETED — fix list **D3**, root R2, Job E.
 *
 * *** THE OLD CODE DELETED A FOLDER FULL OF FILES WHEN THE COUNT FAILED. ***
 *
 * ```ts
 * const { count } = await db.from('documents').select('*', { count: 'exact', head: true })…
 * if (count && count > 0) return refuse            // count is null on a failed read
 * ```
 *
 * `error` was never destructured, and a failed read gives `count: null`. `null && …` is falsy, so
 * the guard fell through and the delete ran. The one thing standing between a person and the loss
 * of a folder of compliance documents was a question nobody checked the answer to.
 *
 * It is a seam of its own, rather than three lines in the route, because the only way to prove a
 * failure is to MAKE it happen — and a route behind `requireCompany` cannot be handed a database
 * that errors. `tests/unit/folderDelete.test.ts` hands this one.
 */
import { mustCount } from './mustRead.ts'

/** What a `{ count: 'exact', head: true }` read gives back. */
export interface CountResult {
  count: number | null
  error: { message: string; code?: string | null } | null
}

export interface FolderBlockers { files: number; subfolders: number }

/**
 * How many files and sub-folders the folder still holds, from the two counts the route took.
 *
 * **Throws `ReadFailed` if either count could not be taken** — the caller turns that into "we
 * couldn't check", never into "it is empty". Both counts must be scoped to the company as well as
 * the folder: an unscoped count could be satisfied by another company's rows.
 *
 * It takes the RESULTS rather than the client. The first version took a `db` and ran the queries
 * itself, which read better but made `tsc` chase the Supabase client's generic chain until it gave
 * up ("Type instantiation is excessively deep"). The seam is the same either way: the route cannot
 * reach a count without going through `mustCount`.
 */
export function folderBlockers(counts: { files: CountResult; subfolders: CountResult }): FolderBlockers {
  return {
    files: mustCount("the folder's files", counts.files),
    subfolders: mustCount("the folder's sub-folders", counts.subfolders),
  }
}
