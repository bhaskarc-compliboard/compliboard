/**
 * ONE SOURCE ON ONE LINE — lifted out of `app/compliance/page.tsx` unchanged, HR Step 3a (`docs/HR-PLAN.md`
 * decision 1), so the workspace and HR show the very same piece. Moved, not rewritten.
 */
'use client'

import type React from 'react'
import { oneLineSource } from '@/lib/checklistView'

// Its `screen-only` / `print-only` rules are in `app/globals.css`.
/**
 * ONE SOURCE ON ONE LINE — Workspace Stage 2. On screen: "[n] host · title", cut with "…" by CSS, the
 * full title on hover (`oneLineSource`, `lib/checklistView.ts`). On paper: the full title and the full
 * address, because a link on paper is only useful if its address can be read.
 */
export function OneLineLink({ n, title, url, after }: { n?: number; title: string; url: string; after?: React.ReactNode }) {
  const one = oneLineSource(title, url)
  const num = n === undefined ? '' : `[${n}] `
  return (
    <span className="flex min-w-0 items-baseline text-[12.5px]">
      <a href={url} target="_blank" rel="noopener noreferrer" title={one.full}
         className="min-w-0 text-emerald-800 underline underline-offset-2">
        <span className="screen-only block truncate">{num}{one.host} · {one.title}</span>
        <span className="print-only break-all">{num}{one.full} — {url}</span>
      </a>
      {after && <span className="shrink-0 whitespace-pre text-gray-500">{after}</span>}
    </span>
  )
}
