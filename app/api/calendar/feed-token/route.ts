// THE SECRET ADDRESS FOR THIS COMPANY'S CALENDAR FEED — Calendar step 8b part 3 (decision 20,
// `DECISIONS.md` §193). This route is the ONE that needs a session; the feed itself has none,
// because the token IS the credential there.
//
// POST → the company's live token, creating one the first time the sheet is opened.
//
// *** WHY THE INSERT IS SERVICE-ROLE AND THE READ IS NOT. *** Migration 073 grants `authenticated`
// SELECT on `calendar_feed_tokens` and nothing else, deliberately: a person may read their own
// company's token (the policy scopes it through `auth_company_id()`), and nobody writes one from a
// browser. So the read runs as the caller under RLS, and the insert is a NAMED service-role
// statement with this comment on it (`CLAUDE.md` §3.6).
//
// *** THE TOKEN IS 256 BITS FROM THE CSPRNG. *** `randomBytes(32).toString('base64url')` — 43
// URL-safe characters, the same class of secret as a session token. Not `Math.random()`, and not a
// UUID, which is 122 bits and is an identifier rather than a credential. URL-safe because it is
// pasted into Google Calendar's "from URL" box by hand.
//
// It is never put in the account export (`app/api/account/export/route.ts` says why) and the row
// is removed when the company is deleted (`app/api/account/route.ts`), so deleting a company stops
// the link answering — which is exactly what it should do.

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    // As the caller, under RLS: the OLDEST live token for this company, if there is one.
    const live = async () => {
      const { data } = await db.from('calendar_feed_tokens')
        .select('token, created_at').is('revoked_at', null).order('created_at', { ascending: true })
      return (data ?? []) as Array<{ token: string; created_at: string }>
    }
    const found = await live()
    if (found.length === 1) return NextResponse.json({ token: found[0].token })

    if (found.length === 0) {
      const token = randomBytes(32).toString('base64url')
      // NAMED STATEMENT, service role: `authenticated` holds no INSERT here by design (073).
      const { error } = await supabaseAdmin.from('calendar_feed_tokens')
        .insert({ company_id: companyId, token })
      if (error) throw error
    }

    /**
     * *** ONE LIVE TOKEN PER COMPANY, CONVERGED — and this is a correction, not a flourish. ***
     *
     * The first version read, and if it found nothing inserted. Opening the sheet once left TWO
     * live tokens on staging. The cause is that React Strict Mode double-invokes an effect in
     * development, so the sheet sent the POST twice within a few milliseconds: both reads found
     * nothing, and both inserted. It is not a development-only fault — two people opening the
     * sheet at the same moment, or one person in two tabs, race exactly the same way — and the
     * consequence is real: a live credential nobody knows about, which revoking "the" link would
     * not revoke.
     *
     * So after the insert the row set is read again and converged: the OLDEST live token wins and
     * every other is revoked. Idempotent, and it also tidies a company that already has two.
     *
     * **The durable fix is a partial unique index** — `unique (company_id) where revoked_at is
     * null` — which would make the second insert fail instead of succeeding. That is a migration,
     * and step 8b has none; it is recorded in `docs/HANDOFF-CODE.md` §7 for the next one.
     */
    const all = await live()
    if (all.length > 1) {
      const keep = all[0].token
      const { error: revokeError } = await supabaseAdmin.from('calendar_feed_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('company_id', companyId).is('revoked_at', null).neq('token', keep)
      if (revokeError) throw revokeError
      console.warn(`calendar feed-token: ${all.length - 1} duplicate token(s) revoked for one company`)
      return NextResponse.json({ token: keep })
    }
    return NextResponse.json({ token: all[0].token })
  } catch (error) {
    console.error('calendar feed-token:', error)
    return NextResponse.json({ error: 'We could not make that link just now.' }, { status: 500 })
  }
}
