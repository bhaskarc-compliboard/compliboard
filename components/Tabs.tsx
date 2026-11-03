/**
 * THE TAB ROW — lifted out of `app/compliance/page.tsx` unchanged, HR Step 3a (`docs/HR-PLAN.md`
 * decision 1), so the workspace and HR show the very same piece. Moved, not rewritten.
 *
 * They are Audits' tabs — the classes were copied out of that page by the workspace layout pass.
 * *** AND AUDITS RENDERS THIS COMPONENT ITSELF SINCE 3 NOVEMBER 2026 *** (`docs/GAPS-PLAN.md` Part A
 * step 6b, decision 31): its hand-rolled two-button row became three tabs through this file, so the
 * classes are in one place again. The line numbers this comment used to give (`:502`–`:515`) had
 * moved to `:573`–`:587` and are left out rather than corrected, because the row they named is gone.
 * The caller owns the words, including any count inside a label ("Checklists (3)"), and whatever
 * sits at the right of the row (the workspace's "New conversation").
 */
'use client'

import type React from 'react'

export function Tabs<K extends string>({ tabs, active, onSelect, right }: {
  tabs: ReadonlyArray<{ key: K; label: string }>; active: K; onSelect: (key: K) => void; right?: React.ReactNode
}) {
  return (
    <div className="no-print mb-5 mt-5 flex items-center justify-between gap-6 border-b border-gray-200">
      <div className="flex items-center gap-6">
        {tabs.map(({ key: k, label }) => (
          <button key={k} onClick={() => onSelect(k)}
            className={`-mb-px border-b-2 pb-3 text-[14px] font-medium transition-colors ${
              active === k ? 'border-[var(--green)] text-[var(--green-ink)]'
                           : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {right}
    </div>
  )
}
