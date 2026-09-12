'use client'

/**
 * WHAT THE CRITIC FOUND, shown to the user.
 *
 * Spec: docs/CRITIC-PASS.md §6. Decision: DECISIONS.md §39.
 *
 * Three severities, three treatments, and the first one is the reason this component exists
 * rather than a caption:
 *
 *   blocking   — the item was WITHHELD from the answer, and this says which and why. The
 *                product removed something it was about to tell you. That is a stronger
 *                statement than a caveat and is shown as one.
 *   coverage   — a regulator with jurisdiction that the answer never addressed.
 *   qualifying — the item stands and carries something unverified.
 *
 * SPECIFICS ARE COUNTED SEPARATELY AND SHOWN LAST. "Flag every date, fee and threshold" is
 * pattern-matching rather than judgement and fires on nearly every answer; mixing it into the
 * findings would make the list look alarming on a correct answer, which is the failure mode
 * §7 is about — a product that appends caveats to everything is one nobody reads.
 *
 * NOTHING RENDERS WHEN THERE IS NOTHING TO SAY. An empty review is the expected result on a
 * correct answer and must look like one.
 */

import type { Finding } from '@/lib/criticPass'

export interface AppliedCritique {
  withheld: Array<{ item: string | null; finding: string; because: string; quote: string }>
  qualifications: Finding[]
  gaps: Finding[]
  unverifiedSpecifics: Finding[]
  complete: boolean
}

export function CritiqueNotice({ critique }: { critique: AppliedCritique | null | undefined }) {
  if (!critique) return null
  const { withheld, qualifications, gaps, unverifiedSpecifics, complete } = critique
  const nothing =
    withheld.length === 0 && qualifications.length === 0 &&
    gaps.length === 0 && unverifiedSpecifics.length === 0
  if (nothing && complete) return null

  return (
    <div className="no-print mt-4 space-y-3">
      {/* An incomplete review must never look like a clean one — CLAUDE.md §5. */}
      {!complete && (
        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
          <p className="text-sm text-gray-700">
            The review of this answer did not finish, so it has not been fully checked. Treat
            what follows as partial.
          </p>
        </div>
      )}

      {withheld.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">
            {withheld.length === 1 ? 'One item was removed from this answer' : `${withheld.length} items were removed from this answer`}
          </p>
          <ul className="mt-2 space-y-3">
            {withheld.map((w, i) => (
              <li key={i} className="text-sm text-red-950">
                <span className="font-medium">{w.item ?? 'An item'}</span> — {w.finding}
                <p className="mt-1 text-red-900">{w.because}</p>
                {/* The quote is what makes this checkable rather than asserted. */}
                <p className="mt-1 border-l-2 border-red-300 pl-2 text-xs italic text-red-800">“{w.quote}”</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Not covered here</p>
          <ul className="mt-2 space-y-1">
            {gaps.map((g, i) => (
              <li key={i} className="text-sm text-amber-950">{g.finding}</li>
            ))}
          </ul>
        </div>
      )}

      {qualifications.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-600">Worth knowing</p>
          <ul className="mt-2 space-y-2">
            {qualifications.map((q, i) => (
              <li key={i} className="text-sm text-gray-800">
                {q.finding}
                {q.item && <span className="text-gray-500"> — {q.item}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unverifiedSpecifics.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
            {unverifiedSpecifics.length} specific {unverifiedSpecifics.length === 1 ? 'figure' : 'figures'} in this answer {unverifiedSpecifics.length === 1 ? 'has' : 'have'} not been checked against a source
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Dates, fees, thresholds and form numbers change. None of the requirement rows behind
            this answer carries a link to its source yet.
          </p>
          <ul className="mt-2 space-y-1">
            {unverifiedSpecifics.map((s, i) => (
              <li key={i} className="text-xs text-gray-700">“{s.quote}”</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
