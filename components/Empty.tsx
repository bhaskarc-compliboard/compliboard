/**
 * THE EMPTY STATE — lifted out of `app/compliance/page.tsx` unchanged, HR Step 3a (`docs/HR-PLAN.md`
 * decision 1), so the workspace and HR show the very same piece. Moved, not rewritten.
 */
'use client'

export function Empty({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center">
      <b className="block text-[15px] font-medium text-gray-900">{title}</b>
      <span className="mt-1 block text-[13px] text-gray-500">{note}</span>
    </div>
  )
}
