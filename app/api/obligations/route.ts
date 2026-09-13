import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { writeObligations } from '@/lib/obligationWriter'

/**
 * GET /api/obligations — M6's only data source.
 *
 * *** IT RESOLVES LAZILY: if this company's obligations have never been computed, this request
 * computes and stores them. *** `DECISIONS.md` §60. Not at signup, because writing at signup
 * decides what a company sees before they have told us anything, and that is M7's decision.
 * Lazy leaves M7 free to trigger a write at signup later; eager takes the choice away.
 *
 * SYNCHRONOUS. Measured: 1.1 ms of compute, ~243 ms of round trips, 221 obligations for a
 * two-site company. Backgrounding it would settle the worker's contract before Phase 5 is
 * specced. `lib/obligationWriter.ts` records what would change that answer.
 *
 * ONE ENDPOINT, ONE SHAPE. M6 is the only consumer, and a second endpoint would be two
 * contracts for one question.
 *
 * *** WHAT THIS NO LONGER RETURNS, AND WHY IT MATTERS THAT IT IS GONE FROM HERE TOO. *** The
 * previous version returned `counts: { total, missing, satisfied }` — a numeric aggregate, of
 * two statuses that cannot occur under the current enum. `DECISIONS.md` §58.3 forbids the
 * screen rendering one, and `lib/requirementsView.ts` is where that is enforced — but a count
 * the route still computes is one `const` away from reappearing on a page. It is removed at
 * the source.
 */
export async function GET(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    const { data: company } = await db
      .from('companies')
      .select('id, industry, state, obligations_computed_at')
      .eq('id', companyId)
      .single()

    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    // NULL means NEVER COMPUTED, which is a different state from "computed and nothing
    // applies" — and a row count cannot tell them apart (migration 022).
    let computedAt = company.obligations_computed_at
    if (!computedAt) {
      const written = await writeObligations(db, companyId)
      computedAt = written.computedAt
    }

    // TWO QUERIES, JOINED IN CODE — not one embed.
    //
    // `obligation_evidence_state` is a VIEW with no foreign-key relationship behind it, and
    // PostgREST can only embed what a FK describes. Writing it as an embed typechecks, reads
    // naturally, and fails at request time. Caught by `npm run check:schema`, which validates
    // query strings against the generated types precisely because tsc cannot see into them
    // (CLAUDE.md §3.6).
    const { data: rows, error } = await db
      .from('obligations')
      .select('id, entity_id, status, resolution_rationale, determined_by, requirement_templates(requirement_name, citation, category, agency_id), entities(name)')
      .eq('company_id', companyId)
      .is('applicable_to', null)
    if (error) throw new Error(error.message)

    const [{ data: evidence }, { data: agencyRows }] = await Promise.all([
      db.from('obligation_evidence_state')
        .select('obligation_id, live_evidence, expired_evidence, contradicting_evidence, next_expiry')
        .eq('company_id', companyId),
      db.from('agencies').select('id, short_name'),
    ])
    const evidenceFor = Object.fromEntries((evidence ?? []).map((e) => [e.obligation_id, e]))
    const agencyName = Object.fromEntries((agencyRows ?? []).map((a) => [a.id, a.short_name]))

    const shaped = (rows ?? []).map((o) => {
      const rt = o.requirement_templates as unknown as {
        requirement_name: string; citation: string | null; category: string | null
        agency_id: string | null
      }
      const ev = evidenceFor[o.id] ?? null
      const det = (o.determined_by ?? {}) as { switches_missing?: string[]; inventory_missing?: string[] }
      return {
        obligationId: o.id,
        requirementName: rt.requirement_name,
        citation: rt.citation ?? '',
        agency: rt.agency_id ? (agencyName[rt.agency_id] ?? null) : null,
        category: rt.category,
        status: o.status,
        resolutionRationale: o.resolution_rationale ?? '',
        siteName: (o.entities as unknown as { name: string } | null)?.name ?? null,
        liveEvidence: ev?.live_evidence ?? 0,
        expiredEvidence: ev?.expired_evidence ?? 0,
        contradictingEvidence: ev?.contradicting_evidence ?? 0,
        nextExpiry: ev?.next_expiry ?? null,
        evidenceNames: [] as string[],
        factsNeeded: det.switches_missing ?? [],
        inventoryNeeded: det.inventory_missing ?? [],
      }
    })

    // The coverage strip's inputs. Facts about the LIBRARY, not about this customer —
    // which is the distinction §58.3 draws, and the only numbers this response carries.
    const [{ count: requirements }, { count: agencies }, { count: verified },
           { count: switchesTotal }, { count: switchesFromDocuments }] = await Promise.all([
      db.from('requirement_templates').select('*', { count: 'exact', head: true }).is('effective_to', null),
      db.from('agencies').select('*', { count: 'exact', head: true }),
      db.from('requirement_templates').select('*', { count: 'exact', head: true }).is('effective_to', null).eq('status', 'verified'),
      db.from('switches').select('*', { count: 'exact', head: true }),
      db.from('switches').select('*', { count: 'exact', head: true }).eq('determination_source', 'documents'),
    ])

    return NextResponse.json({
      rows: shaped,
      coverage: {
        requirements: requirements ?? 0, agencies: agencies ?? 0, verified: verified ?? 0,
        switchesTotal: switchesTotal ?? 0, switchesFromDocuments: switchesFromDocuments ?? 0,
      },
      computedAt,
    })
  } catch (error) {
    // §5.1 — plain language, and never a claim about data we did not read.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'We could not work out your requirements.' },
      { status: 500 },
    )
  }
}
