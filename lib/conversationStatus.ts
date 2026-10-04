/**
 * WHAT A CONVERSATION ROW SAYS ABOUT ITSELF — Run 3, `DECISIONS.md` §126; the retention rule
 * replaced in Workspace Task 2 (`lib/retention.ts`).
 *
 * The three states come from the real columns, never from a guess:
 *
 *   summarised_at IS NULL                      → "not summarised yet"
 *   summarised_at set, turns still there       → "summarised · full conversation kept until <date>"
 *   summarised_at set, turns cleared           → "summarised · back-and-forth cleared"
 *
 * *** THE THIRD STATE IS DECIDED BY `has_turns`, NOT BY A DATE. *** The date says when the
 * transcript MAY go; the nightly deleter says when it DID. Reading the date would make the row
 * claim a deletion that has not happened yet — between the due date and the next 03:30 run (or
 * longer, if the deleter skips a topic whose summary is older than its last turn), the
 * conversation is still there and openable, and a row saying otherwise would hide a working
 * "Open the conversation" button.
 *
 * *** THE DATE IS `last_turn_at` + 12 MONTHS, FROM `lib/retention.ts`. *** It used to be the stored
 * `delete_after`, which only the nightly summariser stamped — so a summary made by hand showed no
 * date and was in fact never cleared. The countdown is the same for both kinds of summary now.
 *
 * `daysLeft` rounds UP, so a few remaining hours still count as a day. Rounding down would show
 * zero on a conversation that is still open, which reads as gone.
 */
import { clearsAt } from './retention.ts'

export type ConversationState = 'not_summarised' | 'kept' | 'cleared'

export interface TopicLike {
  summarised_at?: string | null
  last_turn_at?: string | null
}

export interface ConversationStatus {
  state: ConversationState
  /** The words for the row. */
  label: string
  /** Days left before the transcript may be cleared, when that applies. */
  daysLeft: number | null
}

/** "3 October 2027" — the date written out, in UTC so the row does not move with the viewer's clock. */
const longDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function conversationStatus(
  topic: TopicLike,
  hasTurns: boolean,
  now: Date = new Date(),
): ConversationStatus {
  if (!topic.summarised_at) {
    return { state: 'not_summarised', label: 'Not summarised yet', daysLeft: null }
  }
  if (!hasTurns) {
    return { state: 'cleared', label: 'Summarised · back-and-forth cleared', daysLeft: null }
  }
  const due = clearsAt(topic.last_turn_at)
  if (!due) {
    // Summarised with turns but no last-turn time: no date can be computed, so none is claimed.
    return { state: 'kept', label: 'Summarised · full conversation kept', daysLeft: null }
  }
  const days = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86_400_000))
  return {
    state: 'kept',
    label: days === 0
      ? 'Summarised · full conversation due to be cleared'
      : `Summarised · full conversation kept until ${longDate(due)}`,
    daysLeft: days,
  }
}

/** "3 of 11 done" — and "No items yet" rather than "0 of 0 done", which reads as a failure. */
export function progressLabel(total: number, done: number): string {
  if (total === 0) return 'No items yet'
  return `${done} of ${total} done`
}

/** 0–100, and 0 when there is nothing to divide by rather than NaN. */
export function progressPercent(total: number, done: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

/**
 * A date a person reads: "Today", "Yesterday", then "21 September".
 * The year appears only when it is not this one — a list of this month's conversations all
 * carrying "2026" is noise.
 */
export function friendlyDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  const month = d.toLocaleString('en-GB', { month: 'long' })
  return d.getFullYear() === now.getFullYear()
    ? `${d.getDate()} ${month}`
    : `${d.getDate()} ${month} ${d.getFullYear()}`
}
