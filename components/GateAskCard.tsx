'use client'

/**
 * THE ASK CARD — how a determination-gate question reaches the user.
 *
 * Spec: docs/DETERMINATION-GATE.md §5. Decision: DECISIONS.md §4, §34.
 *
 * A question with nowhere to put the answer is worse than no question, so this component is
 * the question AND the two ways of answering it. It renders in the ANSWER position — where
 * the checklist would have been — not as an error and not as a modal, because an ask is a
 * successful outcome of a well-formed request.
 *
 * WHAT IS NOT SHOWN, DELIBERATELY: `assumed_if_unanswered` and `why_blocking`. Showing
 * somebody what the product would have guessed invites them to accept the guess, which
 * defeats the gate. Those two fields exist for golden files and for a reviewer reading logs.
 */

import { useRef, useState } from 'react'
import type { GateAsk, GateAnswering } from '@/lib/determinationGate'

export function GateAskCard({
  ask,
  onAnswer,
  busy,
}: {
  ask: GateAsk
  /** Re-submits the ORIGINAL question plus the fact. The caller owns the question text —
   *  this component never rewrites it. */
  onAnswer: (answering: GateAnswering | null, file: File | null) => void
  busy: boolean
}) {
  const [typed, setTyped] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const factName = ask.switch_id || ask.question

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-700">One thing first</p>
      <p className="mt-2 text-base font-medium text-amber-950">{ask.question}</p>

      {ask.artifact && (
        <p className="mt-2 text-sm text-amber-900">
          The quickest way is to upload {ask.artifact}.
        </p>
      )}

      {ask.unlocks.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-amber-900">That gets you:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
            {ask.unlocks.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            // The artifact is a better source than the user's recollection: the fact
            // arrives as ai_from_documents rather than user_set. No `answering` object is
            // sent — the gate re-reads the fact out of the document itself.
            if (f) onAnswer(null, f)
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {ask.artifact ? `Upload ${ask.artifact}` : 'Upload a document'}
        </button>

        <span className="text-sm text-amber-800">or</span>

        <input
          type="text"
          value={typed}
          disabled={busy}
          placeholder="type the answer"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && typed.trim()) {
              onAnswer({ switch_id: ask.switch_id, fact: factName, value: typed.trim() }, null)
            }
          }}
          className="min-w-[14rem] flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || !typed.trim()}
          onClick={() =>
            onAnswer({ switch_id: ask.switch_id, fact: factName, value: typed.trim() }, null)
          }
          className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Send'}
        </button>
      </div>

      {ask.known.length > 0 && (
        // Quietly demonstrates the product is not asking for things it already knows —
        // which is the promise in WORKSPACE.md §4.4 and the visible half of the
        // persistence bound in DETERMINATION-GATE.md §7.
        <p className="mt-4 text-xs text-amber-800">
          What we already have: {ask.known.map((k) => `${k.fact}: ${k.value}`).join(' · ')}
        </p>
      )}
    </div>
  )
}
