/**
 * *** A DATABASE READ THAT FAILS MUST NEVER COME BACK AS ZERO ROWS *** — root R2,
 * `docs/FIX-LIST-FAILURES.md`, Job E.
 *
 * The single most common defect in this codebase, and the most dangerous, because it is invisible:
 *
 * ```ts
 * const { data } = await db.from('documents').select('id')   // error never destructured
 * const docs = data ?? []                                    // a failure is now "no documents"
 * ```
 *
 * The query errored — a permission, a renamed column, a dropped connection — and the caller sees an
 * empty list. Downstream, "no documents" is not an absence of information; it is a STATEMENT. The
 * audit tells a company it holds nothing. The folder delete decides the folder is empty. The batch
 * email says nothing needs attention. **Every one of those is the product asserting a fact about a
 * customer's compliance on the strength of a question it never got an answer to.**
 *
 * There is no safe default. A read either answered or it did not, and only the caller knows what to
 * do when it did not — so this throws, and the caller decides: say "couldn't load", send no email,
 * record the failure against the job. What it will not do is let the failure look like a fact.
 *
 * **Why a helper rather than a rule.** The rule has existed since §3.12 and the list still found
 * forty-odd places breaking it, because `const { data } = ...` is shorter than the correct thing and
 * reads fine. This makes the correct thing the shorter one.
 */

/** What every PostgREST read returns. Structural, so it fits the Supabase client without importing it. */
export interface ReadResult<T> {
  data: T | null
  error: { message: string; code?: string | null } | null
}

/**
 * An error carrying WHERE it happened, so a catch block far away can say something a person can act
 * on (`CLAUDE.md` §5). A bare PostgREST message ("permission denied for table documents") is not a
 * sentence anybody outside this codebase can use.
 */
export class ReadFailed extends Error {
  readonly what: string
  readonly code: string | null
  constructor(what: string, message: string, code?: string | null) {
    super(`${what} could not be read: ${message}`)
    this.name = 'ReadFailed'
    this.what = what
    this.code = code ?? null
  }
}

/**
 * A list read. Throws `ReadFailed` on error; otherwise the rows, `[]` when there genuinely are none.
 *
 * ```ts
 * const docs = mustRows('your documents', await db.from('documents').select('id, name'))
 * ```
 *
 * `what` is named for the PERSON, not the table: "your documents", "the folder's files".
 */
export function mustRows<T>(what: string, res: ReadResult<T[]>): T[] {
  if (res.error) throw new ReadFailed(what, res.error.message, res.error.code)
  return res.data ?? []
}

/**
 * A single-row read (`.maybeSingle()`). Throws on error; returns `null` when the row is genuinely
 * absent — which is a real answer and a different thing from "we could not ask".
 */
export function mustRow<T>(what: string, res: ReadResult<T>): T | null {
  if (res.error) throw new ReadFailed(what, res.error.message, res.error.code)
  return res.data ?? null
}

/**
 * A count read (`{ count: 'exact', head: true }`).
 *
 * *** A NULL COUNT IS NOT ZERO, AND THAT IS NOT THEORETICAL. *** PostgREST returns `count: null`
 * with **no error** when the table does not exist — which is how `scripts/calendar-b6-rowcounts.mjs`
 * printed a confident `0` for a Workspace table this product has never had, from Calendar B6 until
 * Job C looked at it. The gate's own script had the failure the gate exists to catch.
 */
export function mustCount(what: string, res: { count: number | null; error: ReadResult<unknown>['error'] }): number {
  if (res.error) throw new ReadFailed(what, res.error.message, res.error.code)
  if (res.count === null) throw new ReadFailed(what, 'the count came back empty, which is not a count')
  return res.count
}

/**
 * For a caller that must NOT throw — a nightly job working through companies, where one company's
 * failure must not stop the rest. It returns the rows or the failure, and **the caller has to look
 * at which**, because there is no shape here that lets a failure be mistaken for an empty list.
 */
export function tryRows<T>(what: string, res: ReadResult<T[]>):
  { ok: true; rows: T[] } | { ok: false; error: ReadFailed } {
  if (res.error) return { ok: false, error: new ReadFailed(what, res.error.message, res.error.code) }
  return { ok: true, rows: res.data ?? [] }
}
