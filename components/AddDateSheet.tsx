'use client'
/**
 * ADD A DATE — board 9 (Calendar step 8b; `docs/calendar-boards.html`).
 *
 * A date a person types is CONFIRMED the moment it is saved, with their name on it. That is not
 * this sheet's decision: `proposeDate()` in `lib/calendarDates.ts` creates a `person` source
 * confirmed with `added_by` (the step 5 rule, `docs/CALENDAR-PLAN.md` §2.6), and this sheet sends
 * `POST /api/calendar` exactly as it stands. **It builds no row and names no status.**
 *
 * *** A REPEATING DATE MAY HAVE NO DAY. *** Migration 060's rule, carried into 073's
 * `calendar_events_date_or_recurs`: a one-off needs a day, a repeating date does not. So "When" is
 * required only when the date happens once, and for a repeating one it is the anchor to count from
 * and may be left empty — which is decision 23's honest state, "it repeats, we do not know when
 * yet", and the calendar shows it in the strip above the grid rather than inventing a day.
 *
 * *** THE REFUSALS ARE SENTENCES IN THE SHEET, NOT A BROWSER ALERT. *** `CLAUDE.md` §5.1. The old
 * `/calendar` page's `alert('No compliance dates found in this file…')` is the named anti-pattern
 * this product was corrected for once already (`DECISIONS.md` §27).
 */
import { useState } from 'react'
import { authHeaders } from '@/lib/supabase'
import { Sheet } from '@/components/Sheet'
import { PRIMARY } from '@/components/buttonStyles'
import { PERIOD_CHOICES, EVERY_SITE, addDateProblem } from '@/lib/calendarView'

/** The owner's words, board 9. The two refusals live in `lib/calendarView.ts`, where they are tested. */
export const ADD_LEDE = 'It goes on the calendar now, as confirmed, with your name on it.'
export const SAVE_FAILED = 'We could not save that date. Nothing was added. Please try again.'

const FIELD = 'mt-1.5 w-full rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-[var(--green)] placeholder:text-gray-400'
const LABEL = 'block text-[13px] text-gray-700'
/** Board 9's segmented control. */
const seg = (on: boolean) =>
  `rounded-md border px-2.5 py-1 text-[13px] ${on
    ? 'border-[var(--green)] text-[var(--green-ink)]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`

export function AddDateSheet({ sites, onClose, onSaved }: {
  /** Offered only when there is more than one — decision 24, the rule HR and Documents use. */
  sites: Array<{ id: string; name: string }>
  onClose: () => void
  /** The new date's id, so the page can open its drawer on it. */
  onSaved: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [period, setPeriod] = useState<string | null>(null)
  const [recurs, setRecurs] = useState(false)
  const [site, setSite] = useState<string>('every')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    // The same two rules the database holds, asked here so a person reads a sentence instead of a
    // constraint error. The route checks them again; this is not the guard, it is the manners.
    const problem = addDateProblem({ title, when, recurs })
    if (problem) { setError(problem); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: title.trim(),
          due_date: when || null,
          recurs,
          period: recurs ? period : null,
          entity_id: site === 'every' ? null : site,
          description: note.trim() || null,
        }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setError(j?.error ?? SAVE_FAILED); return }
      onSaved(String(j?.data?.id ?? ''))
    } catch {
      setError(SAVE_FAILED)
    } finally { setBusy(false) }
  }

  return (
    <Sheet title="Add a date" lede={ADD_LEDE} onClose={onClose}>
      {error && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{error}</p>
      )}
      <label className={LABEL}>What is it?</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD}
        placeholder="For example: Washington business licence renewal" />

      <div className="mt-4">
        <label className={LABEL}>
          When{recurs && <span className="text-gray-400"> — the day to count from, if you know it</span>}
        </label>
        <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className={FIELD} />
      </div>

      <div className="mt-4">
        <label className={LABEL}>Repeats</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button type="button" className={seg(!recurs)}
            onClick={() => { setRecurs(false); setPeriod(null) }}>No</button>
          {PERIOD_CHOICES.map((c) => (
            <button key={c.value} type="button" className={seg(recurs && period === c.value)}
              onClick={() => { setRecurs(true); setPeriod(c.value) }}>
              {/* "every year" reads as "Every year" at the head of a choice. */}
              {c.label.charAt(0).toUpperCase() + c.label.slice(1)}
            </button>
          ))}
          {/* Decision 23's honest answer, offered rather than hidden: it repeats and nobody knows
              how often yet. The calendar shows such a date in the strip above the grid. */}
          <button type="button" className={seg(recurs && !period)}
            onClick={() => { setRecurs(true); setPeriod(null) }}>I don&apos;t know how often</button>
        </div>
      </div>

      {sites.length > 1 && (
        <div className="mt-4">
          <label className={LABEL}>Site</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button type="button" className={seg(site === 'every')} onClick={() => setSite('every')}>{EVERY_SITE}</button>
            {sites.map((s) => (
              <button key={s.id} type="button" className={seg(site === s.id)} onClick={() => setSite(s.id)}>{s.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className={LABEL}>A note, if you want one</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${FIELD} resize-none`}
          placeholder="Where to file it, who handles it, anything the next person should know." />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={busy} className={PRIMARY}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onClose} className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Cancel</button>
      </div>
    </Sheet>
  )
}
