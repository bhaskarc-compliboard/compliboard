import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/requirements?company_id=xxx
// Looks up the company's industry + state, then returns every
// requirement_templates row that applies — federal rows always,
// state rows only if they match. This is the spine's first real
// connection to the app: a query, not an AI guess.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
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

    let query = supabaseAdmin
      .from('requirement_templates')
      .select('*')
      .eq('industry', company.industry)

    query = state
      ? query.or(`jurisdiction_state.is.null,jurisdiction_state.eq.${state}`)
      : query.is('jurisdiction_state', null)

    const { data, error } = await query.order('priority', { ascending: true }).order('category', { ascending: true })

    if (error) throw error

    return NextResponse.json({ data, count: data?.length || 0, industry: company.industry, state: state || null })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch requirements' },
      { status: 500 }
    )
  }
}
