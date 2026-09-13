'use client'

/**
 * THE REQUIREMENTS SCREEN — M6.
 *
 * Spec: `docs/REQUIREMENTS-SCREEN.md`. Decisions: `DECISIONS.md` §21.3, §58, §58.1–§58.6.
 *
 * *** THIS FILE COMPOSES. IT DOES NOT PHRASE. *** Every sentence comes from
 * `lib/requirementsView.ts`, because every rule this screen carries is a rule about what it
 * SAYS — no verdict, no count, no "satisfied", an empty evidence line rendered as a fact rather
 * than a warning — and a rule about wording is testable only where the wording is produced.
 * `tests/unit/requirementsView.test.ts` asserts all of it without rendering React.
 *
 * WHAT WAS HERE BEFORE, AND WHY THIS IS A REWRITE RATHER THAN AN EDIT. The previous 279 lines
 * were written against the pre-007 vocabulary — `missing`, `at_risk`, `expiring_soon`,
 * `satisfied`, `unconfirmed`. **Not one of those can occur**; the enum is
 * `applies | does_not_apply | undetermined | unknown`. It rendered empty because `obligations`
 * holds 0 rows, so nothing looked wrong. Two things went with it:
 *
 *   - THE `satisfied` FILTER. §58.1 separated *is this OWED* from *what has been SHOWN*, and a
 *     "satisfied" filter collapses them back into the single verdict M6 was blocked to prevent.
 *     Whether an obligation is met is a join against `obligation_evidence`, never a column
 *     (§21.3) — and the old filter was reading a column that no longer exists.
 *   - ITS COUNT. Same denominator problem in a different place: "Satisfied (12)" of what, in a
 *     library where 0 of 200 rows have been checked against a published source?
 */

import { useState, useEffect } from 'react'
import { authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import AIDisclaimer from '@/components/AIDisclaimer'
import {
  SECTIONS, sectionLabel, sectionBlurb, renderRow, renderCoverageStrip, renderEmptyState,
  type RequirementRow, type ObligationStatus,
} from '@/lib/requirementsView'

type SectionKey = (typeof SECTIONS)[number]['key']

interface ApiRow extends RequirementRow {
  obligationId: string
  /** Present on `unknown` rows: the facts that would settle it. */
  factsNeeded: string[]
}

interface Coverage {
  requirements: number; agencies: number; verified: number
  switchesTotal: number; switchesFromDocuments: number
}

export default function RequirementsPage() {
  const [rows, setRows] = useState<ApiRow[]>([])
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [open, setOpen] = useState<SectionKey>('applies')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/obligations', { headers: await authHeaders() })
        if (!res.ok) throw new Error(`Could not load your requirements (${res.status}).`)
        const data = await res.json()
        setRows(data.rows ?? [])
        setCoverage(data.coverage ?? null)
      } catch (e) {
        // CLAUDE.md §5.1 — say whose problem it is, and never assert anything about data we
        // did not successfully read.
        setError(e instanceof Error ? e.message : 'We could not load your requirements.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const inSection = (k: SectionKey) =>
    rows.filter((r) =>
      k === 'unknown'
        ? r.status === 'unknown' || r.status === 'undetermined'
        : r.status === (k as ObligationStatus))

  // `undetermined` sits at the FOOT of the questions section under its own heading, never
  // interleaved: §21.3 — `unknown` is a question we can ask, `undetermined` is a dead end.
  // Offering them as one list either floods the customer with unanswerable questions or
  // buries the answerable ones.
  const questions = rows.filter((r) => r.status === 'unknown')
  const deadEnds = rows.filter((r) => r.status === 'undetermined')

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Requirements</h1>

        {coverage && (
          <section aria-label="What's behind this list" className="mt-4 rounded border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">What&apos;s behind this list</p>
            {renderCoverageStrip({ ...coverage, nothingAsserted: rows.length === 0 }).map((line) => (
              <p key={line} className="mt-1 text-sm text-gray-600">{line}</p>
            ))}
          </section>
        )}

        {loading && <p className="mt-8 text-sm text-gray-500">Working out your requirements…</p>}

        {error && (
          <p className="mt-8 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        )}

        {!loading && !error && rows.length === 0 && (
          /* §5.1 — an empty state is a claim and it has to be true. Zero obligations means
             resolution has not run, NOT that nothing applies. */
          <p className="mt-8 rounded border border-gray-200 p-4 text-sm text-gray-600">{renderEmptyState()}</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            {/* THREE PEER SECTIONS, NO COUNTS. A heading count asserts a denominator the strip
                above says we do not have, and the list underneath is its own count (§58.3). */}
            <nav className="mt-8 flex gap-6 border-b border-gray-200" aria-label="Sections">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setOpen(s.key)}
                  aria-current={open === s.key ? 'true' : undefined}
                  className={`-mb-px border-b-2 pb-2 text-sm ${
                    open === s.key ? 'border-gray-900 font-medium text-gray-900'
                                   : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {sectionLabel(s.key)}
                </button>
              ))}
            </nav>

            <p className="mt-4 text-sm text-gray-600">{sectionBlurb(open)}</p>

            <ul className="mt-4 space-y-3">
              {(open === 'unknown' ? questions : inSection(open)).map((r) => (
                <Row key={r.obligationId} row={r} />
              ))}
            </ul>

            {open === 'unknown' && deadEnds.length > 0 && (
              <section className="mt-10 border-t border-gray-200 pt-6">
                <h2 className="text-sm font-medium text-gray-900">Needs a person</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Nothing we can ask will settle these. Someone has to decide.
                </p>
                <ul className="mt-4 space-y-3">
                  {deadEnds.map((r) => <Row key={r.obligationId} row={r} />)}
                </ul>
              </section>
            )}
          </>
        )}

        <AIDisclaimer />
      </div>
    </AppLayout>
  )
}

/** One row. All four states go through the same shell; the four ROOTS keep them apart. */
function Row({ row }: { row: ApiRow }) {
  const v = renderRow(row)
  return (
    <li className="rounded border border-gray-200 p-4">
      <p className="font-medium text-gray-900">{v.title}</p>
      <p className="mt-0.5 text-xs text-gray-500">{v.subtitle}</p>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">
            {v.verdictLabel}
          </dt>
          <dd className="text-gray-700">{v.verdictText}</dd>
        </div>

        {/* UNCONDITIONAL on an `applies` row — §58.1. A row asserting an obligation and then
            saying nothing is completed by the reader as "and you have done it". */}
        {v.shownLabel && (
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">
              {v.shownLabel}
            </dt>
            <dd className={v.shownIsWarning ? 'text-amber-700' : 'text-gray-700'}>
              {v.shownIsWarning && <span aria-hidden className="mr-1">⚠</span>}
              {v.shownText}
            </dd>
          </div>
        )}
      </dl>

      {row.status === 'unknown' && row.factsNeeded.length > 0 && (
        /* The ask lives behind this: GET /api/switches/ask orders by the dependency graph and
           says what each unblocks. Rendering these as gaps would discard three fields that
           already exist (§58.2). */
        <p className="mt-3 text-xs text-gray-500">
          Waiting on: {row.factsNeeded.join(', ')}
        </p>
      )}

      {v.action && (
        <button className="mt-3 text-sm text-gray-900 underline underline-offset-2">{v.action}</button>
      )}
    </li>
  )
}
