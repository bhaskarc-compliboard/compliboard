'use client'
/**
 * BOARD 8 — ONE SHEET, TWO TITLES (`docs/calendar-boards.html` board 8).
 *
 * The board says it in its own note: *"'Not right' on an unconfirmed date and 'Remove' on any date
 * both offer a one-line reason, optional."* They are the same action on the same row — `dismiss`
 * through `PATCH /api/calendar`, the one writer — so they are the same sheet, and the only thing
 * that changes is the title.
 *
 * *** IT WAS LIFTED OUT OF `components/CalendarDateDrawer.tsx` AT STEP 9, NOT COPIED. *** The queue
 * needed the identical sheet for "Not right", and a second copy of a destructive confirmation is
 * two places for its wording, its optional-reason rule and its focus behaviour to drift. The drawer
 * now renders this file, so the two surfaces cannot disagree.
 *
 * *** THE REASON IS OPTIONAL, AND CANCEL HOLDS THE FOCUS. *** The first is the owner's ruling at
 * step 8a — the reason was never load-bearing (what stops a re-reading proposing the date again is
 * that a PERSON removed it, recorded in `dismissed_by`), and a toll on removing a date is how a
 * wrong date stays on a calendar. The second is board 8's: `autoFocus` on Cancel means Enter never
 * removes anything.
 */
import { Sheet } from '@/components/Sheet'

/** The lede is the same sentence in both cases, because the consequence is the same. */
export const REMOVE_LEDE = 'It leaves your calendar and the monthly email. It stays on file with '
  + 'your reason, so we do not put it back from the same document.'
export const REMOVE_TITLE = 'Remove this date?'
export const NOT_RIGHT_TITLE = 'Not right?'
export const WHY_LABEL = 'Why? Optional, one line.'
export const WHY_PLACEHOLDER = 'For example: the permit was renewed, or the date in the document is wrong.'

export function RemoveDateSheet({ mode, reason, onReason, busy, error, onRemove, onClose }: {
  /** `remove` is the drawer's footer action; `not-right` is a queue row's. Same action, two titles. */
  mode: 'remove' | 'not-right'
  reason: string
  onReason: (v: string) => void
  busy: boolean
  /** The route's own sentence when the write failed, shown in the sheet rather than swallowed. */
  error?: string | null
  onRemove: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={mode === 'remove' ? REMOVE_TITLE : NOT_RIGHT_TITLE} lede={REMOVE_LEDE} onClose={onClose}>
      <label className="block text-[13px] text-gray-700">{WHY_LABEL}</label>
      <textarea value={reason} onChange={(e) => onReason(e.target.value)} rows={2}
        placeholder={WHY_PLACEHOLDER}
        className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-[var(--green)] placeholder:text-gray-400" />
      {error && <p className="mt-2 text-[13px] text-amber-800">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button disabled={busy} onClick={onRemove}
          className="rounded-md bg-red-700 px-3.5 py-1.5 text-[14px] font-medium text-white hover:bg-red-800 disabled:opacity-50">
          {busy ? 'Removing…' : 'Remove'}
        </button>
        <button autoFocus onClick={onClose}
          className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Cancel</button>
      </div>
    </Sheet>
  )
}
