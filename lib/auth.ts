// Server-only. This module holds the SUPABASE_SERVICE_ROLE_KEY and must never be
// imported from a client component — see CLAUDE.md §3.5.
//
// Every API route that touches company data needs the same three steps before it is
// allowed to do anything: verify the bearer token, turn the verified user id into a
// company_id by reading profiles, and refuse the request if either fails. Repeating
// that by hand in each handler is how one of them ends up trusting a query parameter
// instead — which is exactly what had happened in app/api/documents/route.ts.
//
// TWO CLIENTS, AND THE DIFFERENCE MATTERS
//
// `supabaseAdmin` uses the service-role key. It bypasses RLS entirely, so any query
// made with it is unfiltered and the caller is wholly responsible for its own scoping.
//
// `authed.db` is built per request from the ANON key plus the caller's own token, so
// PostgREST runs every statement as that user and the policies apply. Migrations 002
// through 004 made those policies complete, which is what lets routes stop relying on
// the key that ignores them. A route running on `authed.db` fails closed if its own
// scoping is wrong; a route on `supabaseAdmin` leaks.
//
// Prefer `authed.db`. `supabaseAdmin` remains exported for exactly three things:
//   - verifying the bearer token (auth.getUser), which needs elevated rights
//   - /api/signup, where no session exists yet
//   - /api/account DELETE, which calls auth.admin.deleteUser
// Anything else using it is now a decision that needs a comment explaining itself.
//
// The worked example of the pattern is app/api/documents/route.ts (CLAUDE.md §3.6):
// reads scoped to the session's company, writes using the session's ids, an ownership
// check on every row touched, and 404 rather than 403 so ids cannot be probed.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
  /**
   * A Supabase client acting AS THE CALLER, under RLS.
   *
   * Built fresh for this request because it carries this request's token — it must
   * never be hoisted to module scope or cached between requests, or one user's client
   * would serve another's. Queries through it are filtered by the policies, so a
   * scoping mistake produces an empty result rather than another company's data.
   */
  db: SupabaseClient
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
 *     const { companyId, userId, db } = authed.auth
 */
export async function requireCompany(
  request: NextRequest
): Promise<{ ok: true; auth: AuthedCompany } | { ok: false; response: NextResponse }> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  // Verifying the token needs elevated rights, so this one step stays on the admin
  // client regardless of what the route does afterwards.
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // The caller's own client. Anon key plus their token, so PostgREST runs as them and
  // every policy applies. persistSession/autoRefreshToken are off because this lives
  // for one request on a server — there is no session to persist and nothing to refresh.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )

  // Read through the admin client, not `db`. profiles' SELECT policy is auth.uid() = id
  // so `db` would work here too, but this lookup is what every other policy depends on
  // via auth_company_id(), and it should not itself be subject to a policy that a future
  // change might narrow. Keeping it on the admin client makes the base case unconditional.
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

  return { ok: true, auth: { userId: user.id, companyId: profile.company_id, db } }
}
