import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

// GET /api/obligations
// Returns every obligation for the signed-in user's company, joined with its full
// requirement details — this is the data source for the real "what's missing" screen.
// Sorted so the most urgent, unresolved items surface first.
//
// The company comes from the verified session. The company_id parameter is gone: it let
// any caller read any company's compliance position, which is the single most sensitive
// list this product holds. Reference: app/api/documents/route.ts.
export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const company_id = authed.auth.companyId

    const { data, error } = await supabaseAdmin
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

    const priorityRank: Record<string, number> = { critical: 1, high: 2, standard: 3 }
    const statusRank: Record<string, number> = {
      missing: 1,
      at_risk: 2,
      expiring_soon: 3,
      satisfied: 4,
      not_applicable: 5,
    }

    const sorted = (data || []).sort((a, b) => {
      const aPriority = priorityRank[(a.requirement_templates as any)?.priority] || 9
      const bPriority = priorityRank[(b.requirement_templates as any)?.priority] || 9
      if (aPriority !== bPriority) return aPriority - bPriority
      const aStatus = statusRank[a.status] || 9
      const bStatus = statusRank[b.status] || 9
      return aStatus - bStatus
    })

    const counts = {
      total: sorted.length,
      missing: sorted.filter((o) => o.status === 'missing').length,
      satisfied: sorted.filter((o) => o.status === 'satisfied').length,
      at_risk: sorted.filter((o) => o.status === 'at_risk').length,
      expiring_soon: sorted.filter((o) => o.status === 'expiring_soon').length,
    }

    return NextResponse.json({ data: sorted, counts })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch obligations' },
      { status: 500 }
    )
  }
}
