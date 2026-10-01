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
import { extractTemplate, countLines } from '@/lib/auditTemplate'
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

    // ---------------------------------------------------------------------------
    // A TEMPLATE AUDIT — Audits Run 4b, item 8.
    //
    // The checklist is a document the company has already uploaded, so it has been through
    // Documents' own path and has a row. This reads it for its LINES — the one place Audits opens a
    // file, because a checklist is the question and nothing else in the product has read it — and
    // then makes one section per checklist section.
    // ---------------------------------------------------------------------------
    if (kind === 'template') {
      const templateDocumentId = String(body?.template_document_id ?? '').trim()
      if (!templateDocumentId) {
        return NextResponse.json({ error: 'Attach the checklist you want to be audited against.' },
          { status: 400 })
      }
      // Ownership on the caller's own client: another company's document is simply not there, and
      // 058's composite key would refuse the write anyway.
      const { data: doc } = await db.from('documents')
        .select('id, name, file_url, file_type').eq('id', templateDocumentId).maybeSingle()
      if (!doc) return NextResponse.json({ error: 'That file was not found.' }, { status: 404 })

      const { data: blob, error: dlError } = await supabaseAdmin.storage
        .from('company-documents').download(doc.file_url as string)
      if (dlError || !blob) {
        // §5.1: the failure is ours and it says so, and it does not imply the file is at fault.
        return NextResponse.json({
          error: 'We could not open that file just now. Nothing was audited; try again in a moment.',
        }, { status: 502 })
      }

      // This company's own name, to compare against whatever the form prints.
      const { data: company } = await db.from('companies').select('name').eq('id', companyId).maybeSingle()

      /**
       * *** THE CHECKLIST IS READ INSIDE createRun, NOT BEFORE IT — Audits Run 6a, item 3. ***
       *
       * It used to be `extractTemplate(...)` here and then `createRun(..., templateSections)`, which
       * meant the extraction — a model call, billed to task `audit` — happened before any run row
       * existed to hang it on. Every template audit therefore under-reported what it cost by one
       * call: $0.5405 against $0.5634 on the rev 1 baseline. Passing the reading as a function lets
       * `createRun` insert the run, stamp `started_at`, and only then spend the money.
       */
      const buffer = await blob.arrayBuffer()
      const run = await createRun(supabaseAdmin, {
        companyId, kind: 'template', scope, entityId, createdBy: userId,
        templateDocumentId,
        templateExtract: () => extractTemplate({
          buffer, fileName: String(doc.name), fileType: String(doc.file_type),
          companyId, db: supabaseAdmin,
        }),
        companyName: company?.name ?? null,
        previousRunId: body?.previous_run_id ? String(body.previous_run_id) : null,
      })
      const estimate = await estimateRun(supabaseAdmin, companyId, run.sectionIds.length)

      if (run.sectionIds.length) {
        after(async () => {
          try { await sweep() } catch (e) { console.error('kicked audit sweep failed:', e) }
        })
      }
      return NextResponse.json({
        ok: true, id: run.runId, status: run.status, kind: 'template',
        sections: run.sectionIds.length, lines: countLines(run.templateSections ?? []),
        // The sentence when a file held no lines, so the box can say it rather than showing a run
        // that looks broken.
        note: run.note ?? null,
        estimate: run.sectionIds.length ? estimate.line : null,
      })
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
    // *** COST IS NOT ON A CUSTOMER SCREEN — §147, the owner's second review. ***
    // What a reading cost us is our business. It stays in `ai_calls`, in `npm run cost`, and in the
    // golden runner's tables, which is where the question "is this worth what it costs" is actually
    // asked. `lib/auditRun.ts` keeps `costOfSections` for those readers.
    const sectionsByRun = new Map<string, Array<Record<string, unknown>>>()
    if (ids.length) {
      const { data: secs } = await db.from('audit_sections')
        .select('id, run_id, ordinal, title, status, started_at, finished_at')
        .in('run_id', ids).order('ordinal')
      for (const s of secs ?? []) {
        if (!sectionsByRun.has(s.run_id)) sectionsByRun.set(s.run_id, [])
        sectionsByRun.get(s.run_id)!.push(s)
      }
    }

    const estimate = await estimateRun(db, companyId, 1)

    return NextResponse.json({
      runs: rows.map((r) => ({
        ...r,
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
