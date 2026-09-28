/**
 * THE WORD A DOCUMENT'S STATUS IS SHOWN AS — one place, because two surfaces show it.
 *
 * *** IT LIVES HERE BECAUSE THE DASHBOARD STARTED SHOWING READINGS TOO — 28 September 2026. ***
 * `app/documents/page.tsx` had this map inline, which was right while it was the only surface
 * reading `document_index_v`. The dashboard's readings list now reads the same view, and a second
 * copy of a display map is a second answer to "what does `needs_work` say to a person" — the
 * failure the label list exists to prevent, one layer up.
 *
 * `display_status` is computed in SQL by the view (migrations 043–049) from the scan's kind, its
 * dates and any correction. These are the words for it, and nothing here decides anything.
 */

/** The word on a row or a card. Short, because it sits in a table. */
export const STATUS_WORD: Record<string, string> = {
  needs_work: 'Needs work',
  expiring: 'Expiring',
  expired: 'Expired',
  could_not_read: 'Could not read',
  not_yet_read: 'Queued',
  current: 'Current',
  recorded: 'Recorded',
  on_file: 'On file',
}

/** The longer form, used as a heading when rows are grouped by status. */
export const STATUS_GROUP_LABEL: Record<string, string> = {
  needs_work: 'Needs work',
  expiring: 'Expiring within 90 days',
  expired: 'Expired',
  could_not_read: 'Could not read',
  not_yet_read: 'Not yet read',
  current: 'Current',
  recorded: 'Recorded',
  on_file: 'On file',
}

const AMBER_STATUSES = new Set(['needs_work', 'expiring', 'expired', 'could_not_read'])

/**
 * Amber means "this asks something of you".
 *
 * *** A DOCUMENT WITH WORK IN FLIGHT ASKS NOTHING YET, WHATEVER THE PREVIOUS READING SAID. ***
 * A re-read leaves the old scan current while the new one is queued, so `display_status` still reads
 * "Needs work" from a reading that is being replaced. Showing that in amber — and in the word — was
 * the 27 September defect: the row looked exactly as it had before the button was pressed.
 * `held` is grey for the same reason it says "Not read yet": nothing is going to read it on its own.
 */
export function isAmber(r: { display_status: string; document_status: string }): boolean {
  return r.document_status !== 'uploaded' && r.document_status !== 'reading'
    && r.document_status !== 'held'
    && AMBER_STATUSES.has(r.display_status)
}

/**
 * The word to show for one row, work in flight beating the reading still stored on it.
 *
 * `scanning` is for a surface that knows it has a scan in the air before the row's status has moved —
 * the Documents page's own upload loop does, and nothing else does.
 */
export function statusWord(
  r: { display_status: string; document_status: string }, scanning = false,
): string {
  if (r.document_status === 'held') return 'Not read yet'
  if (scanning || r.document_status === 'reading') return 'Reading…'
  if (r.document_status === 'uploaded') return 'Queued'
  return STATUS_WORD[r.display_status] ?? r.display_status
}
