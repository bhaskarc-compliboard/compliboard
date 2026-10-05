/**
 * THE WORKING LINE — lifted out of `app/compliance/page.tsx` unchanged, HR Step 3a (`docs/HR-PLAN.md`
 * decision 1), so the workspace and HR show the very same piece. Moved, not rewritten.
 */
'use client'

/**
 * THE WORKING STATE, DRIVEN BY REAL EVENTS.
 *
 * The prototype animated four fixed steps on a 520 ms timer. That is a fiction — it is not
 * reporting progress, it is filling silence (`CLAUDE.md` §5.1). These words come from the
 * stream: `searching` events are counted as they arrive, and `writing` means text has started.
 */
export function Working({ phase, searches, onStop }: { phase: string; searches: number; onStop: () => void }) {
  const label = phase === 'searching'
    ? (searches <= 1 ? 'Checking a source…' : `Checking ${searches} sources…`)
    : phase === 'writing' ? 'Writing the answer…' : 'Working on it…'
  return (
    <div className="no-print flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
      <span className="text-[13px] text-gray-600">{label}</span>
      <button onClick={onStop} className="ml-auto text-[12.5px] text-gray-400 underline hover:text-gray-700">Stop</button>
    </div>
  )
}
