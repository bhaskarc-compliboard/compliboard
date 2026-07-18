import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/sync-obligations
// Body: { company_id: string }
//
// Finds every requirement_templates row that applies to this company
// (same match logic as /api/requirements) and creates one obligations
// row for each — skipping any that already exist, so this is safe to
// run more than once. Universal rows and conditional rows both get an
// obligation; the "does this really apply" judgment for conditional
// rows happens later (Step 5's self-resolving rows), not here.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_id } = body
    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('industry, scan_result')
      .eq('id', company_id)
      .single()

    if (companyError) throw companyError
    if (!company?.industry) {
      return NextResponse.json({ error: 'Company has no industry set' }, { status: 400 })
    }

    const state = (company.scan_result as Record<string, unknown> | null)?.state as string | undefined

    let templateQuery = supabaseAdmin
      .from('requirement_templates')
      .select('id')
      .eq('industry', company.industry)

    templateQuery = state
      ? templateQuery.or(`jurisdiction_state.is.null,jurisdiction_state.eq.${state}`)
      : templateQuery.is('jurisdiction_state', null)

    const { data: templates, error: templatesError } = await templateQuery
    if (templatesError) throw templatesError
    if (!templates || templates.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, total: 0 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('obligations')
      .select('requirement_template_id')
      .eq('company_id', company_id)
      .is('entity_id', null)

    if (existingError) throw existingError
    const existingIds = new Set((existing || []).map((o) => o.requirement_template_id))

    const toCreate = templates
      .filter((t) => !existingIds.has(t.id))
      .map((t) => ({
        company_id,
        entity_id: null,
        requirement_template_id: t.id,
        status: 'missing',
      }))

    if (toCreate.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('obligations').insert(toCreate)
      if (insertError) throw insertError
    }

    return NextResponse.json({
      created: toCreate.length,
      skipped: templates.length - toCreate.length,
      total: templates.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync obligations' },
      { status: 500 }
    )
  }
}
