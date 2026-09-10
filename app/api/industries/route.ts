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
//
// KEEPS THE SERVICE-ROLE KEY, and this is a real exception rather than an oversight
// (§0.9). It is called from app/signup/page.tsx, which is a public page with no auth
// guard and, by definition, no session — a visitor choosing their industry has not
// created an account yet. requirement_templates is readable `to authenticated`, and
// migration 004 revoked anon's grants entirely, so a request with no token gets nothing
// and the dropdown comes back empty. An empty dropdown blocks signup.
//
// The alternative — granting anon read on requirement_templates — was rejected: it
// re-opens the not-logged-in role that 004 deliberately closed, to serve one dropdown.
// A route serving a pre-login page is the same justification /api/signup has.
//
// The data here is not tenant data. It is the shared regulatory library, identical for
// every company, so there is nothing to scope and nothing to leak.
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
