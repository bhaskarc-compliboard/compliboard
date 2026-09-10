// Server-only. This module holds the SUPABASE_SERVICE_ROLE_KEY and must never be
// imported from a client component — see CLAUDE.md §3.5.
//
// Every API route that touches company data needs the same three steps before it is
// allowed to do anything: verify the bearer token, turn the verified user id into a
// company_id by reading profiles, and refuse the request if either fails. Repeating
// that by hand in each handler is how one of them ends up trusting a query parameter
// instead — which is exactly what had happened in app/api/documents/route.ts.
//
// The worked example of this pattern is app/api/documents/route.ts (CLAUDE.md §3.6):
// reads scoped to the session's company, writes using the session's ids, an ownership
// check on every row touched, and 404 rather than 403 so ids cannot be probed.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// The service-role client bypasses RLS entirely, so every caller of this module is
// responsible for scoping its own queries by the company_id returned below.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type AuthedCompany = {
  /** The authenticated user's id, taken from the verified token — never from input. */
  userId: string
  /** The company that user belongs to, read from profiles — never from input. */
  companyId: string
}

/**
 * Verify the request's bearer token and resolve the caller's company.
 *
 * Returns either `{ ok: true, auth }` or `{ ok: false, response }`, where `response`
 * is the exact error to return to the client — 401 when the token is missing or
 * invalid, 404 when the user has no company. Handlers stay one line:
 *
 *     const authed = await requireCompany(request)
 *     if (!authed.ok) return authed.response
 *     const { companyId, userId } = authed.auth
 */
export async function requireCompany(
  request: NextRequest
): Promise<{ ok: true; auth: AuthedCompany } | { ok: false; response: NextResponse }> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Company not found' }, { status: 404 }),
    }
  }

  return { ok: true, auth: { userId: user.id, companyId: profile.company_id } }
}
