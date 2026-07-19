import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/industries
// Returns the distinct industry values that actually have requirement
// files in the database. This is what the signup dropdown reads — so the
// dropdown only ever offers industries the product can genuinely serve.
// Today that's just "chemical-manufacturing"; it grows on its own as
// requirement files for new industries are loaded. No hardcoded list.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('requirement_templates')
      .select('industry')

    if (error) throw error

    // Collapse to distinct, non-empty values, sorted for a stable order.
    const industries = Array.from(
      new Set((data ?? []).map((r) => r.industry).filter(Boolean))
    ).sort()

    return NextResponse.json({ industries })
  } catch (err) {
    console.error('GET /api/industries failed:', err)
    return NextResponse.json({ error: 'Failed to load industries' }, { status: 500 })
  }
}
