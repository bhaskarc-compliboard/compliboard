/**
 * THE STAGES OF A QUESTION SENT WITH A FILE — lifted out of `app/compliance/page.tsx` unchanged, HR Step 3a (`docs/HR-PLAN.md`
 * decision 1), so the workspace and HR show the very same piece. Moved, not rewritten.
 */
'use client'

import { stageWords, type Step } from '@/components/stageWords'
export type { Step }

/**
 * THE STAGES, EACH SHOWN WHILE IT IS TRUE — Workspace Task 4, board 3. Done: a green tick and grey
 * text. Now: a small spinner and dark text. Still to come: an empty circle and light grey. The
 * stage moves only when the request it names moves (`ask()`); nothing here runs on a timer.
 */
export function Stages({ steps, name, onStop, count }: { steps: { list: Step[]; at: Step }; name: string; onStop: () => void
  /** HR Step 6a, additive: the sources checked so far, for the 'hr_check' step. The workspace never passes it. */
  count?: number }) {
  const at = steps.list.indexOf(steps.at)
  return (
    <div className="no-print mb-4">
      <ol className="space-y-1.5">
        {steps.list.map((step, i) => {
          const state = i < at ? 'done' : i === at ? 'now' : 'next'
          return (
            <li key={step} className="flex items-center gap-2.5 text-[13px]">
              <span className="flex w-3.5 shrink-0 justify-center">
                {state === 'done' ? <span className="text-[12px] leading-none text-[var(--green)]">✓</span>
                  : state === 'now' ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
                  : <span className="h-3 w-3 rounded-full border border-gray-300" />}
              </span>
              <span className={state === 'done' ? 'text-gray-500' : state === 'now' ? 'text-gray-900' : 'text-gray-400'}>
                {stageWords(step, name, count)}
              </span>
            </li>
          )
        })}
      </ol>
      <button onClick={onStop} className="mt-2 text-[12.5px] text-gray-400 underline hover:text-gray-700">Stop</button>
    </div>
  )
}
