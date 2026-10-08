/**
 * ONE SUMMARY AND ONE CHECKLIST AT A TIME — Workspace Stage 4, migration 065.
 *
 * Part 1 measured it on staging: a second press of "Summarise this conversation" or "Turn this into a
 * checklist", in one tab or two, started a second paid call — two summaries overwrote each other and
 * two checklists were made — and nothing was recorded while either ran. This module is the claim that
 * closes it, in the shape "How do I do this?" already uses (`checklist_items.howto_started_at`):
 *
 *   1. CLAIM by compare-and-set BEFORE any model call: the column is set only where it is empty or
 *      older than CLAIM_LOCK_MS. No row back means somebody else holds it, and no call is made.
 *   2. RELEASE only our own claim: the clear matches the exact timestamp we wrote, so a run that timed
 *      out and lost its claim can never clear the claim of the run that took over.
 *   3. SAVE CONDITIONALLY: the summary is written only while this run still holds its claim AND the
 *      summary is still the one it read (`guardSummaryWrite`). A late result is discarded, not written.
 *
 * A claim older than ten minutes is a run that died without clearing it (a function killed at its
 * time limit). The view `topic_list_v` uses the same ten minutes, and so does HOWTO_LOCK_MS.
 *
 * Pure where it can be, so `tests/unit/topicClaim.test.ts` can run every rule without a database.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

type Db = SupabaseClient<any, any, any>   // eslint-disable-line @typescript-eslint/no-explicit-any

/** A claim this old is a dead run, and the next press may take it. Matches migration 065's view. */
export const CLAIM_LOCK_MS = 10 * 60_000

/**
 * How long a route lets its own work run before it gives up and clears its claim. UNDER the lock, so
 * the run that holds the claim always clears it itself before anybody else could take it as stale.
 */
export const CLAIM_WORK_MS = 9 * 60_000

export type ClaimKind = 'summary' | 'checklist'

export const CLAIM_COLUMN: Record<ClaimKind, 'summary_started_at' | 'checklist_started_at'> = {
  summary: 'summary_started_at',
  checklist: 'checklist_started_at',
}

/** The words the screen and a 409 use, so the two never disagree. */
export const CLAIM_WORDS: Record<ClaimKind, string> = {
  summary: 'Summary being written…',
  checklist: 'Checklist being built…',
}

/** Whether a claim set at `startedAt` still holds at `now`. */
export function isClaimHeld(startedAt: string | null | undefined, now: number): boolean {
  if (!startedAt) return false
  const t = Date.parse(startedAt)
  return Number.isFinite(t) && now - t < CLAIM_LOCK_MS
}

/**
 * The PostgREST filter that makes the claim a compare-and-set: the column is empty, or older than the
 * lock. Built here, once, so the route and the nightly job cannot write two versions of it.
 */
export function claimFilter(kind: ClaimKind, now: number): string {
  const col = CLAIM_COLUMN[kind]
  const stale = new Date(now - CLAIM_LOCK_MS).toISOString()
  return `${col}.is.null,${col}.lt."${stale}"`
}

/** Any PostgREST filter chain: the two calls the guard needs. */
interface Filterable<Q> { eq(col: string, v: unknown): Q; is(col: string, v: null): Q }

/**
 * THE CONDITIONAL SAVE. The summary update matches only while (a) this run's claim is the one on the
 * row and (b) `summarised_at` is still what the run read. Either changed means somebody else's work
 * landed or took over, and this write must not replace it.
 */
export function guardSummaryWrite<Q extends Filterable<Q>>(
  q: Q, guard: { claimedAt: string; summarisedAt: string | null },
): Q {
  const held = q.eq(CLAIM_COLUMN.summary, guard.claimedAt)
  return guard.summarisedAt === null ? held.is('summarised_at', null) : held.eq('summarised_at', guard.summarisedAt)
}

export type Claim =
  | { ok: true; claimedAt: string; summarisedAt: string | null }
  | { ok: false; held: true }

/**
 * CLAIM. Returns the timestamp written (the release and the guarded save match on it) and the
 * `summarised_at` the row had at that moment, so the caller can tell whether a summary landed since
 * it last looked. Throws on a database error — a claim we cannot read is not a claim we hold.
 */
export async function claimTopic(db: Db, topicId: string, kind: ClaimKind, now = Date.now()): Promise<Claim> {
  const claimedAt = new Date(now).toISOString()
  const { data, error } = await db.from('topics')
    .update({ [CLAIM_COLUMN[kind]]: claimedAt })
    .eq('id', topicId)
    .or(claimFilter(kind, now))
    .select('id, summarised_at')
  if (error) throw new Error(`claiming the conversation: ${error.message}`)
  if (!data?.length) return { ok: false, held: true }
  return { ok: true, claimedAt, summarisedAt: (data[0] as { summarised_at: string | null }).summarised_at ?? null }
}

/**
 * RELEASE — only our own claim. Returns whether it was still ours: false means the run timed out and
 * somebody else took over (or a guarded save already cleared it), which the checklist route reads to
 * decide whether a late result is kept.
 */
export async function releaseTopic(db: Db, topicId: string, kind: ClaimKind, claimedAt: string): Promise<boolean> {
  const col = CLAIM_COLUMN[kind]
  const { data, error } = await db.from('topics').update({ [col]: null })
    .eq('id', topicId).eq(col, claimedAt).select('id')
  if (error) { console.error(`releasing the ${kind} claim on ${topicId}: ${error.message}`); return false }
  return !!data?.length
}

/** A promise that rejects after `ms`, raced against the work, so a run gives up before its lock goes stale. */
export class ClaimTimeout extends Error {
  constructor(kind: ClaimKind) { super(`the ${kind} run passed ${CLAIM_WORK_MS / 60_000} minutes and was given up`) }
}
export function withinClaimTime<T>(work: Promise<T>, kind: ClaimKind, ms = CLAIM_WORK_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ClaimTimeout(kind)), ms) })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

// ---------------------------------------------------------------------------
// THE NIGHTLY JOB'S CHOICE — `app/api/jobs/summarise/route.ts`, here so it can be tested.
// ---------------------------------------------------------------------------

/**
 * A conversation is idle once nothing has been said for SIX HOURS (HR-PLAN decision 13, HR Step 10: was 24). The job
 * runs at 10:00 UTC, so a conversation that ends in the afternoon or evening, Pacific time, is summarised that night.
 * This reverses part of DECISIONS.md §161 ("both candidate lists wait for 24 hours of quiet"); the quiet rule itself
 * — both lists wait — is unchanged.
 */
export const IDLE_HOURS = 6

export interface NightlyTopic {
  id: string; summarised_at: string | null; summary_source: string | null; last_turn_at: string | null
}

/**
 * WHICH CONVERSATIONS TONIGHT'S RUN SUMMARISES, AND WHICH IT LEAVES BECAUSE A PERSON'S SUMMARY IS
 * CURRENT. Both rules apply the quiet rule (IDLE_HOURS) — the second list used to have none, so a
 * conversation spoken to five minutes ago was summarised in the middle of being had.
 *
 *   candidate:   quiet for IDLE_HOURS or more, AND (never summarised OR spoken to since its summary)
 *   userCurrent: summarised by the person, and nothing said since — left alone, and COUNTED, so
 *                `skipped_user_summary` counts what it says (it could never be anything but 0).
 */
export function nightlyCandidates<T extends NightlyTopic>(rows: T[], now: number):
  { candidates: T[]; userCurrent: T[] } {
  const idleBefore = now - IDLE_HOURS * 3600_000
  const candidates: T[] = []
  const userCurrent: T[] = []
  for (const t of rows) {
    if (!t.last_turn_at) continue
    const last = Date.parse(t.last_turn_at)
    const spokenSince = t.summarised_at !== null && last > Date.parse(t.summarised_at)
    if (t.summarised_at !== null && !spokenSince) {
      if (t.summary_source === 'user') userCurrent.push(t)
      continue
    }
    if (last <= idleBefore) candidates.push(t)
  }
  return { candidates, userCurrent }
}
