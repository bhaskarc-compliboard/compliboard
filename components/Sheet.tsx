/**
 * THE SHEET (a small centred dialog over a scrim) — lifted out of `app/compliance/page.tsx` unchanged, HR Step 3a (`docs/HR-PLAN.md`
 * decision 1), so the workspace and HR show the very same piece. Moved, not rewritten.
 */
'use client'

import type React from 'react'
import { useEffect } from 'react'

export function Sheet({ title, lede, children, onClose }: {
  title: string; lede?: string; children: React.ReactNode; onClose: () => void
}) {
  // Escape closes a sheet, as a click outside it already does (Workspace Task 3).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-medium text-gray-900">{title}</h3>
        {lede && <p className="mb-3 mt-1 text-[13px] leading-relaxed text-gray-600">{lede}</p>}
        {children}
      </div>
    </div>
  )
}
