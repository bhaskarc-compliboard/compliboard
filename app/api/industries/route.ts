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
// ⚠️ THIS ROUTE BROKE IN PRODUCTION ON 11 SEP AND NOTHING NOTICED.
//
// Migration 007 replaced `industry text` with `industries text[]`, and this — the only
// caller, named as such in 007's own header — kept selecting the old column. PostgREST
// answered `42703: column requirement_templates.industry does not exist`, the catch below
// turned it into a 500, and the signup dropdown came back empty. **An empty dropdown
// blocks signup**, on the one page that has no session and no other way in.
//
// `npm run check` passed the whole time. A column name inside .select() is a STRING, and
// the generated types cannot see into it — which is the entire value of the generated
// types everywhere else. Renaming a column is therefore a two-part change: the migration,
// and a sweep of every query string that names it. CLAUDE.md §3.7.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('requirement_templates')
      .select('industries')
      // Retired rows do not count. A requirement superseded by a split is still in the
      // table (effective_to set, never deleted) and its industry is still served by its
      // children — but if an industry's rows were ever ALL retired, the product can no
      // longer serve it and the dropdown must stop offering it.
      .is('effective_to', null)

    if (error) throw error

    // One row can serve several verticals now — cannabis extraction and chemical blending
    // share OSHA and fire-code rows (CLAUDE.md §7) — so this flattens rather than maps.
    const industries = Array.from(
      new Set((data ?? []).flatMap((r) => r.industries ?? []).filter(Boolean))
    ).sort()

    return NextResponse.json({ industries })
  } catch (err) {
    console.error('GET /api/industries failed:', err)
    return NextResponse.json({ error: 'Failed to load industries' }, { status: 500 })
  }
}
