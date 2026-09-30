// ONE RUN, EVERYTHING THE DRAWER RENDERS — Audits Run 2c, item 11.
//
//   GET   /api/audit-runs/[id]              the run, its sections, its findings, in one request
//   PATCH /api/audit-runs/[id]  { dismiss } close the banner, once
//
// *** ONE REQUEST, BECAUSE THE DRAWER IS ONE THING. *** A report that arrives as four fetches
// renders in four steps, and a person watching headings appear one at a time reads it as slow. Every
// finding's document title and file name are resolved here, server-side, off `document_index_v` —
// the same view the Documents page reads, so the audit and the page cannot name one document two
// ways.

import { NextResponse, type NextRequest } from 'next/server'

import { requireCompany } from '@/lib/auth'
import { estimateRun } from '@/lib/auditEstimate'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth
    const { id } = await ctx.params

    // Ownership on the caller's own client. Another company's run is not there, and not-there is
    // 404 so an id cannot be probed (§3.6).
    const { data: run } = await db.from('audit_runs')
      .select('id, kind, scope, agency_label, entity_id, status, section_count, done_count, '
            + 'readings_as_of, created_at, started_at, finished_at, summary, notified_at, '
            + 'dismissed_at, previous_run_id, template_document_id, template_lines')
      .eq('id', id).maybeSingle()
    if (!run) return NextResponse.json({ error: 'That audit was not found.' }, { status: 404 })

    const [{ data: sections }, { data: findings }] = await Promise.all([
      db.from('audit_sections')
        .select('id, ordinal, title, status, started_at, finished_at, model, ai_call_id, '
              + 'json_parsed, could_not_complete_reason, documents_read, documents_held_unread')
        .eq('run_id', id).order('ordinal'),
      db.from('audit_findings')
        .select('id, section_id, ordinal, kind, title, word, basis, document_id, scan_id, locator, '
              + 'quote, quote_verified, what_to_do, due_on, recurs, passed, document_b_id, '
              + 'value_a, value_b, source, status, same_as, closed_by_run_id, closed_reason, '
              + 'dismissed_reason, handle_error, template_line, template_text')
        .eq('run_id', id).order('ordinal'),
    ])

    // Asserted once, as in the collection route: the generated types cannot narrow a
    // multi-column select made through a policy. The columns are the ones named above.
    const rows = (findings ?? []) as unknown as Array<Record<string, unknown>>
    const secs = (sections ?? []) as unknown as Array<Record<string, unknown> & {
      ai_call_id: string | null; started_at: string | null; finished_at: string | null }>
    const runRow = run as unknown as Record<string, unknown> & { status: string }

    // *** EVERY DOCUMENT THE RUN TOUCHED, NOT ONLY THE ONES A FINDING CITES. ***
    // It read only the cited ones, so "What this covers" and the print's last page showed a raw
    // UUID for any document the run read and no finding mentioned — two of five on the first DEQ
    // run. Showing a person an id is worse than showing one to the model, which is what the
    // handles ruling was about (§145).
    const secRows = (sections ?? []) as unknown as Array<{
      documents_read: string[] | null; documents_held_unread: string[] | null
      started_at: string | null; finished_at: string | null }>
    const docIds = [...new Set([
      // The checklist itself, so the template report can title itself with its name.
      runRow.template_document_id,
      ...rows.flatMap((f) => [f.document_id, f.document_b_id]),
      ...secRows.flatMap((s) => [...(s.documents_read ?? []), ...(s.documents_held_unread ?? [])]),
    ].filter(Boolean))] as string[]
    // Kind and status travel with the title: "What this covers" shows title · kind · status on one
    // line, so a reader can see what each document IS without opening it.
    const doc = new Map<string, { title: string; file_name: string; kind: string | null; display_status: string | null }>()
    if (docIds.length) {
      const { data: docs } = await db.from('document_index_v')
        .select('document_id, title, file_name, kind, display_status').in('document_id', docIds)
      for (const d of docs ?? []) {
        doc.set(d.document_id, { title: d.title, file_name: d.file_name,
                                 kind: d.kind ?? null, display_status: d.display_status ?? null })
      }
    }

    const estimate = runRow.status === 'done' ? null : (await estimateRun(db, companyId, 1)).line

    return NextResponse.json({
      // No `cost_usd`: §147 takes it off every customer screen.
      run: { ...runRow, estimate },
      // The title of every document the run touched, keyed by id, so the drawer never has to
      // reach into the findings to name one — and never falls back to an id when it cannot.
      documents: Object.fromEntries([...doc.entries()]),
      sections: secs,
      findings: rows.map((f) => ({
        ...f,
        document: f.document_id ? doc.get(f.document_id as string) ?? null : null,
        document_b: f.document_b_id ? doc.get(f.document_b_id as string) ?? null : null,
      })),
    })
  } catch (error) {
    console.error('audit-runs/[id] GET:', error)
    return NextResponse.json({ error: 'We could not read that audit just now.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { db } = authed.auth
    const { id } = await ctx.params

    const body = await request.json().catch(() => null)
    if (String(body?.action ?? '') !== 'dismiss') {
      return NextResponse.json({ error: 'Expected { action: "dismiss" }.' }, { status: 400 })
    }

    const { data: run } = await db.from('audit_runs').select('id').eq('id', id).maybeSingle()
    if (!run) return NextResponse.json({ error: 'That audit was not found.' }, { status: 404 })

    // Through `db`, not the admin client: dismissing is the person's own act and 058 grants them
    // exactly this one UPDATE. Written once — `.is('dismissed_at', null)` — because a banner that
    // comes back after somebody closed it reads worse than one that never appeared.
    const { error } = await db.from('audit_runs')
      .update({ dismissed_at: new Date().toISOString() }).eq('id', id).is('dismissed_at', null)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('audit-runs/[id] PATCH:', error)
    return NextResponse.json({ error: 'We could not do that just now.' }, { status: 500 })
  }
}
