/**
 * WHAT `/quality` READS — `docs/GAPS-PLAN.md` decision 75 (the owner, 4 November 2026).
 *
 * *** THE GATE IS `requireOwner`, AND EVERY REFUSAL IS 404. *** `lib/auth.ts` compares the
 * signed-in address against `QUALITY_EMAIL`; an unset variable refuses everyone. A 403 would
 * confirm to a signed-in stranger that this page exists, which `CLAUDE.md` §3.6 answers 404 to
 * everywhere else in this codebase.
 *
 * *** AND THE READ IS A NAMED SERVICE-ROLE SELECT, WITH ITS REASON. *** §3.6 permits the key for a
 * named statement with a comment explaining it, and this is that comment.
 *
 * `quality_reports` grants `anon` and `authenticated` **nothing** — migration 095 revokes from both
 * and then grants to neither, read back with `has_table_privilege` for all eight rights. So
 * `authed.db`, the client that runs as the caller, cannot read this table and never will: there is
 * no policy to widen, because there is no grant for a policy to act on. The service role is the
 * only thing that can see it, which is exactly the property wanted — and the gate above is what
 * decides whether this route is willing to look.
 *
 * It reads and returns. Nothing here writes; the job is the only writer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireOwner, supabaseAdmin } from '@/lib/auth'

/** At most this many days back, so one request cannot ask for the whole table. */
const MAX_DAYS = 30

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request)
  if (!owner.ok) return owner.response

  const url = new URL(request.url)
  const asked = Number(url.searchParams.get('days') ?? 14)
  const days = Number.isFinite(asked) ? Math.min(Math.max(Math.floor(asked), 1), MAX_DAYS) : 14

  // ---- THE ONE NAMED SERVICE-ROLE READ ----
  // Why the key: nobody is granted anything on `quality_reports` (migration 095), so there is no
  // caller-scoped client that can read it. The gate above has already established that the caller
  // is the owner; this statement does no filtering of its own because the report is deliberately
  // cross-company — that is what it is for.
  const { data: rows, error } = await supabaseAdmin
    .from('quality_reports')
    .select('date, company_id, counts, rows')
    .order('date', { ascending: false })
    .limit(days * 200)
  if (error) {
    console.error(`NIGHT WATCH: could not read quality_reports: ${error.message}`)
    return NextResponse.json({ error: 'Could not read the report just now.' }, { status: 500 })
  }

  // Company names, so the page can say "Cascade Specialty Chemicals" rather than a uuid. One read,
  // service role, for the same reason: the report spans companies by design.
  const ids = [...new Set((rows ?? []).map((r) => r.company_id).filter(Boolean))] as string[]
  const { data: companies } = ids.length
    ? await supabaseAdmin.from('companies').select('id, name').in('id', ids)
    : { data: [] as Array<{ id: string; name: string | null }> }

  const days_seen = [...new Set((rows ?? []).map((r) => String(r.date)))].sort().reverse().slice(0, days)
  return NextResponse.json({
    days: days_seen,
    reports: (rows ?? []).filter((r) => days_seen.includes(String(r.date))),
    companies: Object.fromEntries((companies ?? []).map((c) => [c.id, c.name ?? c.id])),
  })
}
