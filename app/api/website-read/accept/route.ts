/**
 * POST /api/website-read/accept — "YES, THAT'S US", RECORDED. My Account step 14, decision 9.
 *
 * It stamps `accepted_at` on the caller's own newest READY read, and does nothing else. The facts
 * the person confirmed were already saved by the walk, each through the route that owns its table:
 * `companies` through the caller's own client under 082's column grant, every address through
 * `/api/sites` so it is geocoded and 083's trigger mirrors the main one. **This route writes no
 * fact about the company at all** — it writes down that a person said yes.
 *
 * *** IT TAKES NO ID, AND THAT IS THE WHOLE OF ITS TENANCY. *** The row is found from the verified
 * token's company, never from the body — `CLAUDE.md` §3.6, the same reason `/api/account` DELETE
 * takes no company id. There is therefore no id to probe and no 403 to tell apart from a 404:
 * another company's read is not refused here, it is unreachable.
 *
 * *** AND ONLY A `ready` ROW. *** A read that failed has nothing to accept, and a read still
 * running has not said anything yet. `authenticated` holds SELECT on `website_reads` and nothing
 * else (085), so the stamp itself is the service role's — a named statement, which is the only way
 * §3.6 permits it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

/** Nothing to accept: said plainly, and the walk simply carries on to the questions. */
const NOT_READY = 'There is nothing to confirm.'
const FAILED = 'We could not record that just now.'

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    // Found AS THE CALLER: `website_reads_select` is `using (company_id = auth_company_id())`, so
    // this request can only see this company's rows at all. The `eq` is the second lock.
    const { data: row } = await db
      .from('website_reads')
      .select('id, status, accepted_at')
      .eq('company_id', companyId)
      .order('started_at', { ascending: false })
      .limit(1).maybeSingle()

    const read = row as { id: string; status: string; accepted_at: string | null } | null
    if (!read || read.status !== 'ready') {
      return NextResponse.json({ ok: false, error: NOT_READY }, { status: 400 })
    }
    // Already stamped: the person pressed twice, or came back to the walk by URL. The first
    // moment is the true one, so it stands — and this is not an error to tell anybody about.
    if (read.accepted_at) return NextResponse.json({ ok: true, accepted_at: read.accepted_at })

    const at = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('website_reads')
      .update({ accepted_at: at })
      .eq('id', read.id)
      .eq('company_id', companyId)      // belt and braces on a client that ignores RLS
      .eq('status', 'ready')
      .is('accepted_at', null)
    if (error) {
      console.error('[/api/website-read/accept] could not stamp:', error.message)
      return NextResponse.json({ ok: false, error: FAILED }, { status: 500 })
    }
    return NextResponse.json({ ok: true, accepted_at: at })
  } catch (error) {
    console.error('[/api/website-read/accept] failed:', error)
    return NextResponse.json({ ok: false, error: FAILED }, { status: 500 })
  }
}
