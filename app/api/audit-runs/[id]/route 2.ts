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
import { mustRow, mustRows } from '@/lib/mustRead'
import { zoneForState } from '@/lib/calendarDate'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth
    const { id } = await ctx.params

    // Ownership on the caller's own client. Another company's run is not there, and not-there is
    // 404 so an id cannot be probed (§3.6).
    // *** A15: A DATABASE ERROR SHOWN AS "NOT FOUND" *** (root R2, Job E4). `mustRow` throws, the
    // catch below answers 500 with a sentence saying it is our side — rather than telling a person
    // their own audit does not exist, which is a claim about their data and is the one thing §5.1
    // says never to make from a failure.
    const run = mustRow<Record<string, unknown>>('this audit', await db.from('audit_runs')
      .select('id, kind, scope, agency_label, entity_id, status, section_count, done_count, '
            + 'readings_as_of, created_at, started_at, finished_at, summary, notified_at, '
            + 'dismissed_at, previous_run_id, template_document_id, template_lines')
      .eq('id', id).maybeSingle())
    if (!run) return NextResponse.json({ error: 'That audit was not found.' }, { status: 404 })

    const [sectionsRes, findingsRes] = await Promise.all([
      db.from('audit_sections')
        .select('id, ordinal, title, status, started_at, finished_at, model, ai_call_id, '
              + 'json_parsed, could_not_complete_reason, documents_read, documents_held_unread')
        .eq('run_id', id).order('ordinal'),
      db.from('audit_findings')
        .select('id, section_id, ordinal, kind, title, word, basis, document_id, scan_id, locator, '
              + 'quote, quote_verified, what_to_do, due_on, recurs, passed, document_b_id, '
              + 'value_a, value_b, source, status, same_as, closed_by_run_id, closed_reason, '
              + 'dismissed_reason, handle_error, template_line, template_text, also_in_sections')
        .eq('run_id', id).order('ordinal'),
    ])

    // *** A13: THE DRAWER SAID "0 DOCUMENTS READ" AND "NOTHING WAS ANSWERED." *** (Job E4.)
    // Both reads were `{ data: … }`. A failed findings read emptied the drawer and the page then
    // said so in words; a failed sections read made every document "no longer on file". Those are
    // statements about an audit a person may be about to hand an inspector.
    // Asserted once, as in the collection route: the generated types cannot narrow a
    // multi-column select made through a policy. The columns are the ones named above.
    const rows = mustRows("this audit's findings", findingsRes) as unknown as Array<Record<string, unknown>>
    const secs = mustRows("this audit's parts", sectionsRes) as unknown as Array<Record<string, unknown> & {
      ai_call_id: string | null; started_at: string | null; finished_at: string | null }>
    const runRow = run as unknown as Record<string, unknown> & { status: string }

    // *** EVERY DOCUMENT THE RUN TOUCHED, NOT ONLY THE ONES A FINDING CITES. ***
    // It read only the cited ones, so "What this covers" and the print's last page showed a raw
    // UUID for any document the run read and no finding mentioned — two of five on the first DEQ
    // run. Showing a person an id is worse than showing one to the model, which is what the
    // handles ruling was about (§145).
    const secRows = secs as unknown as Array<{
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
      // A13: unchecked, every cited document read "(a document this audit cited is no longer on
      // file)" — about documents sitting in the table.
      const docs = mustRows<{ document_id: string; title: string; file_name: string
                              kind: string | null; display_status: string | null }>(
        'the documents this audit read', await db.from('document_index_v')
          .select('document_id, title, file_name, kind, display_status').in('document_id', docIds))
      for (const d of docs) {
        doc.set(d.document_id, { title: d.title, file_name: d.file_name,
                                 kind: d.kind ?? null, display_status: d.display_status ?? null })
      }
    }

    const estimate = runRow.status === 'done' ? null : (await estimateRun(db, companyId, 1)).line

    // *** WHICH OF THESE DATES ARE ALREADY ON THE CALENDAR — Calendar decision 7. ***
    //
    // Without this the drawer could only know what THIS browser had pressed, so a person who added a
    // date and came back tomorrow would be offered "Add to calendar" on a date that is already there.
    // Pressing again is harmless — the key refuses it — but the LABEL would be wrong, and a screen
    // that says the opposite of what is true is the thing §6 is about.
    //
    // Keyed by finding id, and the state travels with it, because the words differ: a date a person
    // confirmed reads "On your calendar", and one they refused reads so rather than inviting them to
    // add it again (decision 6).
    const dateIds = rows.filter((f) => f.kind === 'date').map((f) => f.id as string)
    const onCalendar: Record<string, { id: string; state: string }> = {}
    if (dateIds.length) {
      // Checked (E4): a failed read offers "Add to calendar" on a date that is already there, and
      // on one the person refused — the label says the opposite of what is true, which is §6's rule.
      const evs = mustRows<{ id: string; audit_finding_id: string; state: string }>(
        'your calendar', await db.from('calendar_events')
          .select('id, audit_finding_id, state')
          .eq('company_id', companyId).in('audit_finding_id', dateIds))
      for (const e of evs) {
        onCalendar[e.audit_finding_id as string] = { id: e.id as string, state: e.state as string }
      }
    }

    // *** THE COMPANY'S ZONE, FOR "READINGS AS OF <DATE>" *** — B10's follow-on, Job E4.
    // `readings_as_of` is a timestamptz and the drawer printed it in the BROWSER's zone, so the
    // same audit read "8 October" at the plant and "9 October" to anybody east of it. Sent with
    // the run; a failed read falls back to Pacific inside `zoneForState`, and says so.
    const coRead = await db.from('companies').select('state').eq('id', companyId).maybeSingle()
    if (coRead.error) console.error(`audit run: could not read the company's state: ${coRead.error.message}`)
    const timezone = zoneForState(coRead.data?.state as string | null)

    return NextResponse.json({
      timezone,
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
        // Null on every finding that is not a date, and on a date nobody has added.
        on_calendar: onCalendar[f.id as string] ?? null,
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

    // A15 (E4): a failed read answering "not found" is a claim about the person's own audit.
    const run = mustRow<{ id: string }>('that audit',
      await db.from('audit_runs').select('id').eq('id', id).maybeSingle())
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
