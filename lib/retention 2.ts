/**
 * HOW LONG A CONVERSATION IS KEPT — Workspace Task 2, checkpoint 2. The owner's decision,
 * 3 October 2026: **the full conversation (its turns) is kept for 12 months after the topic's last
 * turn; the summary is kept until the person deletes it.**
 *
 * It replaces the 7-day rule (`delete_after = summarised_at + 7 days`, stamped by the nightly
 * summariser) and its 30-day backstop for unsummarised topics. Two things were wrong with that pair:
 *
 *   · A summary made by hand stamped no `delete_after` and the nightly job skipped it, so the
 *     transcript was never cleared at all (`docs/WORKSPACE-MACHINERY.md` N2).
 *   · The backstop cleared turns with NO summary — a conversation could vanish with nothing kept.
 *
 * *** THE DATE IS COMPUTED FROM `last_turn_at`, NOT STORED. *** A stored `delete_after` has to be
 * re-stamped on every path that adds a turn, and a path that forgets is a transcript that is cleared
 * too early or never. `last_turn_at` is already kept current by the one function every turn goes
 * through (`lib/conversation.ts` `touchTopic`), so computing from it cannot drift. `delete_after`
 * stays in the table, unwritten by the jobs, rather than being dropped in a migration this change
 * does not need.
 *
 * *** NO CONVERSATION LOSES ITS TURNS WITHOUT A SUMMARY THAT COVERS THEM. *** A topic past the
 * line is cleared only when its summary covers its last turn. One with no summary — or with turns
 * newer than its summary's coverage — is SKIPPED; the nightly summariser picks it up (its candidate
 * rule takes both cases, `app/api/jobs/summarise/route.ts`), and the deleter clears it on a later
 * night.
 *
 * *** AND "COVERS" IS NOT "WAS WRITTEN AFTER" — fix list W2, severity 1, migration 078. ***
 *
 * The test used to be `summarised_at >= last_turn_at`, and `summarised_at` is the time the summary
 * was WRITTEN. The turns it read were loaded minutes earlier — in the route, before the claim — so a
 * message sent in between is newer than anything the model saw and older than `summarised_at`. The
 * test said "covered"; the deleter cleared; **and the turns it deleted were turns no summary
 * contains.** The transcript is disposable and the summary is what survives (`WORKSPACE.md` §6.4),
 * so what went was gone, and the summary never mentioned it.
 *
 * The test is now `summary_covers_through` — the newest turn the summary actually read, computed by
 * the run from the turns in its own hand, so there is no window in it. **NULL means we do not know**,
 * and an unknown coverage is never treated as a covering one: those rows are skipped and
 * re-summarised, which is what today's code already did with them.
 */

export const RETENTION_MONTHS = 12

/** `iso` plus `months` calendar months, in UTC. 31 March + 1 month lands on 1 May, as Date does. */
function addMonths(iso: string | Date, months: number): Date {
  const d = new Date(iso)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

/** When this conversation's turns become due for clearing, or null when it has no turns yet. */
export function clearsAt(lastTurnAt: string | null | undefined): Date | null {
  if (!lastTurnAt) return null
  const d = new Date(lastTurnAt)
  if (Number.isNaN(d.getTime())) return null
  return addMonths(d, RETENTION_MONTHS)
}

/**
 * A `last_turn_at` earlier than this is past the line. The deleter queries on it, so the database
 * returns only topics old enough to consider; `clearingDecision` then makes the call per topic.
 */
export function clearingCutoff(now: Date = new Date()): Date {
  return addMonths(now, -RETENTION_MONTHS)
}

export type ClearingDecision = 'keep' | 'clear' | 'skip_no_summary' | 'skip_not_covered'

export interface RetentionTopic {
  last_turn_at?: string | null
  summarised_at?: string | null
  /** The newest turn the stored summary read (migration 078). NULL = we do not know how far it read. */
  summary_covers_through?: string | null
  summary?: string | null
}

export function clearingDecision(topic: RetentionTopic, now: Date = new Date()): ClearingDecision {
  const due = clearsAt(topic.last_turn_at)
  if (!due || due.getTime() > now.getTime()) return 'keep'
  const hasSummary = Boolean(String(topic.summary ?? '').trim()) && Boolean(topic.summarised_at)
  if (!hasSummary) return 'skip_no_summary'

  // *** HOW FAR THE SUMMARY READ, NOT WHEN IT WAS WRITTEN *** (W2, migration 078 — the paragraph at
  // the top of this file). A coverage we do not have is NOT a coverage: the row is skipped, the
  // nightly summariser takes it, and a later night clears it with a coverage that can be checked.
  const covers = topic.summary_covers_through
  if (!covers) return 'skip_not_covered'
  const coversAt = new Date(covers).getTime()
  const lastAt = new Date(topic.last_turn_at as string).getTime()
  if (Number.isNaN(coversAt)) return 'skip_not_covered'
  if (coversAt < lastAt) return 'skip_not_covered'
  return 'clear'
}
