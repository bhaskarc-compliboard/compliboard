import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/obligations?company_id=xxx
// Returns every obligation for this company, joined with its full
// requirement details — this is the data source for the real
// "what's missing" screen. Sorted so the most urgent, unresolved
// items surface first.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

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
