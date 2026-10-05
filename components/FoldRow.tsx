/**
 * ONE FOLDING ROW — lifted out of `app/compliance/page.tsx` unchanged, HR Step 3a (`docs/HR-PLAN.md`
 * decision 1), so the workspace and HR show the very same piece. Moved, not rewritten.
 */
'use client'

/**
 * ONE FOLDING ROW OF THE SUMMARY — a real button: Enter and Space work, `aria-expanded` says its state,
 * `aria-controls` names the panel. A chevron (screen only), the label, and the count at the right.
 */
export function FoldRow({ label, right, expanded, controls, onClick }: {
  label: string; right: string; expanded: boolean; controls: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} aria-controls={controls}
      className="flex w-full items-center gap-2 py-2.5 text-left hover:bg-gray-50">
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className={`no-print shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>
        <path d="m9 6 6 6-6 6" />
      </svg>
      <span className="min-w-0 flex-1 text-[14px] font-semibold text-gray-900">{label}</span>
      <span className="shrink-0 text-[12px] text-gray-500">{right}</span>
    </button>
  )
}
