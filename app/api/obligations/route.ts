import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// SORT ORDER
//
// These two maps used to be `Record<string, number>` with a `|| 9` fallback, and that
// cost something real: `obligations.status` holds `unconfirmed` in 127 of 376 rows —
// 34% — a value that appears in NEITHER the specification NOR anywhere else in this
// file. Every one of those rows fell through the fallback and sorted silently to the
// bottom of the customer's requirements list. Nothing threw. Nothing logged.
//
// So the maps are now keyed by the enum, not by `string`. `Record<ObligationStatus, …>`
// does not compile if a value is added, removed or renamed, which turns the next
// vocabulary change from a silent re-sort into a build failure.
//
// These two types come FROM THE DATABASE, via lib/database.types.ts, which is generated
// by `npm run db:types` against the live schema. They are not written out here on
// purpose: a value renamed in SQL now fails this file at compile time instead of
// quietly re-sorting a customer's requirements list. That is the whole point of
// DECISIONS.md §21.3, and `Record<ObligationStatus, number>` below is what enforces it —
// it will not compile if a state is added, removed or renamed.
// ---------------------------------------------------------------------------

type ObligationStatus = Database['public']['Enums']['obligation_status']
type RequirementPriority = Database['public']['Enums']['requirement_priority']

// Actionable first, then answerable, then stuck, then closed.
//
// NOTE: these four say whether a requirement APPLIES, not whether it has been met —
// that is a join against obligation_evidence (DECISIONS.md §21.3). So within `applies`
// this route cannot yet put an unmet obligation above a met one; it has no evidence
// join. Adding one is TODO 7.3, and it is the reason the state is not called
// `satisfied`.
const STATUS_RANK: Record<ObligationStatus, number> = {
  applies: 1,
  unknown: 2,
  undetermined: 3,
  does_not_apply: 4,
}

const PRIORITY_RANK: Record<RequirementPriority, number> = {
  critical: 1,
  high: 2,
  standard: 3,
}

// TRANSITIONAL — delete when migration 007 converts obligations.status to the enum.
// The column is still `text` and still holds the pre-006 vocabulary, so both values have
// to keep ranking correctly in the meantime. Expressed as the MAPPING from DECISIONS.md
// §21.3 rather than as numbers, so the two cannot drift apart:
//
//   missing     -> applies       (it applies; whether it is met is an evidence join)
//   unconfirmed -> undetermined  (we asked and could not resolve it)
//
// `unconfirmed` is 127 of 376 rows and has been ranking 9 — sorting last — since the
// column was written, because it appeared in no map. This is the fix.
const LEGACY_STATUS_RANK: Record<string, number> = {
  missing: STATUS_RANK.applies,
  unconfirmed: STATUS_RANK.undetermined,
}

// The `?? 9` is a last resort for a value from neither vocabulary. Today nothing reaches
// it. If something ever does, it sorts last — so if a whole block of requirements
// appears at the bottom of the list for no reason, this is the first place to look.
function statusRank(status: string | null): number {
  if (!status) return 9
  return STATUS_RANK[status as ObligationStatus] ?? LEGACY_STATUS_RANK[status] ?? 9
}

// `priority` is nullable, so a null legitimately reaches the fallback and sorts last.
function priorityRank(priority: string | null | undefined): number {
  if (!priority) return 9
  return PRIORITY_RANK[priority as RequirementPriority] ?? 9
}

// GET /api/obligations
// Returns every obligation for the signed-in user's company, joined with its full
// requirement details — this is the data source for the real "what's missing" screen.
// Sorted so the most urgent, unresolved items surface first.
//
// The company comes from the verified session. The company_id parameter is gone: it let
// any caller read any company's compliance position, which is the single most sensitive
// list this product holds.
//
// FIRST ROUTE CONVERTED OFF THE SERVICE-ROLE KEY (§0.9). It queries through `authed.db`,
// which acts as the caller under RLS, so the database enforces tenancy here rather than
// merely agreeing with the code. The `.eq('company_id', …)` below is now a filter rather
// than the boundary — the policy is the boundary — and it stays because a query that
// states its own scope is easier to read and costs nothing.
//
// Chosen to go first because its failure is loud and harmless: read-only, one table, and
// a scoping mistake shows up as an empty list rather than as another company's data.
export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId: company_id, db } = authed.auth

    const { data, error } = await db
      .from('obligations')
      .select(
        `
        id,
        status,
        due_date,
        last_verified_at,
        notes,
        entity_id,
        requirement_templates (
          id,
          category,
          requirement_name,
          citation,
          cadence,
          applies,
          trigger_plain,
          entity_type,
          evidence_description,
          fails_if,
          priority,
          layer,
          jurisdiction_state,
          jurisdiction_county
        )
      `
      )
      .eq('company_id', company_id)

    if (error) throw error

    const sorted = (data || []).sort((a, b) => {
      const aPriority = priorityRank((a.requirement_templates as any)?.priority)
      const bPriority = priorityRank((b.requirement_templates as any)?.priority)
      if (aPriority !== bPriority) return aPriority - bPriority
      return statusRank(a.status) - statusRank(b.status)
    })

    // `at_risk` and `expiring_soon` are gone (DECISIONS.md §21.3). They are DERIVED from
    // evidence expiry rather than stored, and a stored copy of a derived value is the
    // stale flag that lets an expired certificate keep satisfying a requirement —
    // exactly what CLAUDE.md §3.2 forbids. Neither key has ever been non-zero: no row in
    // production has ever held either value.
    const counts = {
      total: sorted.length,
      missing: sorted.filter((o) => o.status === 'missing').length,
      satisfied: sorted.filter((o) => o.status === 'satisfied').length,
    }

    return NextResponse.json({ data: sorted, counts })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch obligations' },
      { status: 500 }
    )
  }
}
