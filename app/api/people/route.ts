/**
 * GET /api/people — WHO CAN SIGN IN AT THE CALLER'S COMPANY, AND WHO IS STILL INVITED.
 *
 * *** WHY THIS ROUTE EXISTS AT ALL, RATHER THAN THE PAGE READING THE TABLES. ***
 * The page can read `profiles` and `invitations` perfectly well through the caller's own client —
 * both carry SELECT policies scoped by `auth_company_id()`. What it cannot read is **an email
 * address**, and that is the one thing board 2 puts on every row.
 *
 * `profiles` has no email column at all. The address lives on the login in `auth.users`, which is
 * not in the `public` schema, has no RLS policy a person could satisfy, and is reachable only
 * through the admin API — `supabaseAdmin.auth.admin.*`, which needs the service-role key. That key
 * must never be in browser code (`CLAUDE.md` §3.5), so a browser cannot resolve one address, let
 * alone a colleague's. `lib/auditNotify.ts:69` carries the same discovery, found the hard way when
 * `check-schema-contracts` refused it for selecting `profiles.email`.
 *
 * So: the tenant work is done as the CALLER (`requireCompany` → `authed.db`, policies apply), and
 * the admin client is used for exactly one thing — turning the ids that came back into addresses.
 * It is a named statement with a reason, which is the only way §3.6 permits it.
 *
 * *** AND IT NEVER RETURNS A TOKEN. *** `invitations.token` is outside `authenticated`'s SELECT
 * grant (migration 082) and outside this response too, even though the admin client could read it.
 * The token goes in one place: the link in the email, built by `POST /api/invitations`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { isLiveInvitation, orderPeople, type PersonRow, type InvitationRow } from '@/lib/peopleView'

export async function GET(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, userId, db } = authed.auth

  try {
    // ---- THE PEOPLE, AS THE CALLER ----
    // `profiles_select` scopes this to the caller's company, so the `eq` is the second lock rather
    // than the only one. `calendar_email` is migration 082's column (decision 6).
    const { data: profiles, error: pErr } = await db
      .from('profiles')
      .select('id, full_name, company_id, created_at, calendar_email')
      .eq('company_id', companyId)
    if (pErr) throw new Error(`profiles: ${pErr.message}`)

    // ---- THE ADDRESSES, AND NOTHING ELSE, AS THE SERVICE ROLE ----
    // One lookup per person. `getUserById` rather than a list-and-filter: the list API pages at 50
    // by default and a company with more people than that would silently lose the tail.
    const people: PersonRow[] = []
    for (const p of (profiles ?? []) as Array<{
      id: string; full_name: string | null; created_at: string | null; calendar_email: boolean
    }>) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(p.id)
      people.push({
        id: p.id,
        full_name: p.full_name,
        // A profile whose login has gone is a real state (an auth user removed outside the
        // product), and `personName` draws it honestly rather than inventing an address.
        email: user?.user?.email ?? null,
        created_at: p.created_at,
        calendar_email: p.calendar_email !== false,
        is_you: p.id === userId,
      })
    }

    // ---- THE INVITATIONS, AS THE CALLER ----
    // `invitations_select` is `company_id = auth_company_id()`. The token is not in the select list
    // and could not be read here even if it were (082's column grant).
    const { data: invites, error: iErr } = await db
      .from('invitations')
      .select('id, email, created_at, expires_at, accepted_at, cancelled_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
    if (iErr) throw new Error(`invitations: ${iErr.message}`)

    // LIVE means not accepted, not withdrawn and not out of time. The third is a comparison with
    // now, which no index can hold, so it is applied here through the one shared rule.
    const now = new Date()
    const live: InvitationRow[] = ((invites ?? []) as Array<{
      id: string; email: string; created_at: string; expires_at: string
      accepted_at: string | null; cancelled_at: string | null
    }>)
      .filter((i) => isLiveInvitation(i, now))
      .map((i) => ({ id: i.id, email: i.email, created_at: i.created_at, expires_at: i.expires_at }))

    return NextResponse.json({ people: orderPeople(people), invitations: live })
  } catch (error) {
    console.error('[/api/people] failed:', error)
    return NextResponse.json({ error: 'We could not read your people just now.' }, { status: 500 })
  }
}
