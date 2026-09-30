// THE AUDIT RUNS — Audits Run 2c, item 11.
//
//   POST /api/audit-runs   start one
//   GET  /api/audit-runs   the company's runs, newest first
//
// *** OWNERSHIP IS PROVED ON THE CALLER'S OWN CLIENT, BEFORE ANY SERVICE-ROLE WRITE. ***
// `app/api/document-batches/route.ts` is the pattern and the reason is §3.6: `requireCompany`
// returns a client built from the anon key plus this request's token, so RLS applies and another
// company's row simply is not there. A row that is not there returns **404, not 403**, so ids cannot
// be probed by watching which error comes back.

import { NextResponse, type NextRequest } from 'next/server'
import { after } from 'next/server'

import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { createRun } from '@/lib/auditRun'
import { estimateRun } from '@/lib/auditEstimate'
import { auditAgenciesFor } from '@/lib/audit'
import { sweep } from '@/app/api/jobs/audit-sections/route'

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const kind = String(body?.kind ?? 'agency')
    const agency = String(body?.agency ?? '').trim()
    const scope = body?.scope == null ? null : String(body.scope).trim().slice(0, 300)
    const entityId = body?.entity_id == null ? null : String(body.entity_id)

    // *** THE TEMPLATE KIND IS REFUSED IN A SENTENCE, NOT A CODE. *** It is the next thing to
    // build and the table already carries it (058), so the honest answer is that it is not ready —
    // not a shrug, and not silently treating it as an agency audit (§5.1).
    if (kind === 'template') {
      return NextResponse.json({
        error: 'Auditing against one of your own checklists is not ready yet. '
          + 'You can run an audit by agency in the meantime.',
      }, { status: 400 })
    }
    if (kind !== 'agency') {
      return NextResponse.json({ error: `We do not know how to run a "${kind}" audit.` }, { status: 400 })
    }
    if (!agency) {
      return NextResponse.json({
        error: 'Name the agency to audit, or "all" for every agency your documents mention.',
      }, { status: 400 })
    }

    // The site, if one was named, must be this company's. Proved on the caller's client so
    // another company's site is simply not there — and 058's composite key would refuse the write
    // anyway, which is the belt to this brace.
    if (entityId) {
      const { data: site } = await db.from('entities').select('id').eq('id', entityId).maybeSingle()
      if (!site) return NextResponse.json({ error: 'That site was not found.' }, { status: 404 })
    }

    const held = await auditAgenciesFor(db, companyId)
    if (agency !== 'all' && !held.includes(agency)) {
      // The company's own vocabulary, said back to them, because a typo and an agency that has
      // never appeared in a document look identical from here.
      return NextResponse.json({
        error: held.length
          ? `None of your documents mention "${agency}". They mention: ${held.join(', ')}.`
          : 'None of your documents name an agency yet, so there is nothing to audit. '
            + 'Upload a permit, a plan or a record first.',
      }, { status: 400 })
    }

    const run = await createRun(supabaseAdmin, {
      companyId, kind: 'agency', agency, scope, entityId, createdBy: userId,
    })
    const estimate = await estimateRun(supabaseAdmin, companyId, run.sectionIds.length)

    // The response goes first; the sweep runs after it. A four-agency audit must not hold the
    // browser open for five minutes — the same reason the batch route kicks its sweep this way.
    if (run.sectionIds.length) {
      after(async () => {
        try { await sweep() } catch (e) { console.error('kicked audit sweep failed:', e) }
      })
    }

    return NextResponse.json({
      ok: true, id: run.runId, status: run.status,
      agencies: run.agencies, sections: run.sectionIds.length,
      estimate: estimate.line,
    })
  } catch (error) {
    console.error('audit-runs POST:', error)
    return NextResponse.json({ error: 'We could not start that audit just now.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    // Read on the caller's client: the SELECT policy is the scoping, not a .eq() somebody could
    // forget. The .eq is there as well, because a policy and a filter agreeing is cheap.
    const { data: runs, error } = await db.from('audit_runs')
      .select('id, kind, scope, agency_label, status, section_count, done_count, '
            + 'readings_as_of, created_at, started_at, finished_at, summary, '
            + 'notified_at, dismissed_at, previous_run_id')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(50)
    if (error) throw error

    // The generated types cannot narrow a multi-column select through a policy, so the shape is
    // asserted once here rather than at each use. The columns are the ones named in the select above.
    const rows = (runs ?? []) as unknown as Array<Record<string, unknown> & { id: string; status: string }>
    const ids = rows.map((r) => r.id)

    // *** THE COST, THROUGH THE SECTIONS' LEDGER ROWS. *** `ai_calls` is not scoped to a run, so
    // the join is the sections' `ai_call_id`s. Two reads for every run on the page rather than one
    // per run, because a list that costs N+1 queries is a list that gets slow quietly.
    const costByRun = new Map<string, number>()
    const sectionsByRun = new Map<string, Array<Record<string, unknown>>>()
    if (ids.length) {
      const { data: secs } = await db.from('audit_sections')
        .select('id, run_id, ordinal, title, status, ai_call_id, started_at, finished_at')
        .in('run_id', ids).order('ordinal')
      for (const s of secs ?? []) {
        if (!sectionsByRun.has(s.run_id)) sectionsByRun.set(s.run_id, [])
        sectionsByRun.get(s.run_id)!.push(s)
      }
      const callIds = (secs ?? []).map((s: { ai_call_id: string | null }) => s.ai_call_id).filter(Boolean)
      if (callIds.length) {
        const { data: calls } = await db.from('ai_calls').select('id, cost_usd').in('id', callIds)
        const costById = new Map((calls ?? []).map((c: { id: string; cost_usd: number | null }) =>
          [c.id, Number(c.cost_usd ?? 0)]))
        for (const s of secs ?? []) {
          if (!s.ai_call_id) continue
          costByRun.set(s.run_id, (costByRun.get(s.run_id) ?? 0) + (costById.get(s.ai_call_id) ?? 0))
        }
      }
    }

    const estimate = await estimateRun(db, companyId, 1)

    return NextResponse.json({
      runs: rows.map((r) => ({
        ...r,
        cost_usd: costByRun.get(r.id as string) ?? 0,
        sections: sectionsByRun.get(r.id as string) ?? [],
        // The estimate only means anything for a run still going. On a finished one the real
        // duration is on the row, and showing a guess next to a fact is how a product loses trust.
        estimate: r.status === 'done' ? null : estimate.line,
      })),
    })
  } catch (error) {
    console.error('audit-runs GET:', error)
    return NextResponse.json({ error: 'We could not read your audits just now.' }, { status: 500 })
  }
}
