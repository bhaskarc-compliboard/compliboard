// EVERYTHING ONE REPORT NEEDS, IN ONE READ — Documents Run 4.
//
// The drawer shows ten sections off six tables. Fetching them from the browser would be six
// round trips per row click, each re-proving the same tenancy, and the drawer would fill in
// section by section in whatever order the network returned — which reads as the product
// thinking, when it is only the product fetching.
//
// *** IT ADDS NOTHING THE SCAN DID NOT SAY. *** Every field here is stored. The only computed
// values are the version chain (a self-join the client should not have to do) and the freshness
// nudge's arithmetic, which is a date subtraction and belongs where the row's other arithmetic
// already is. No model call — Run 4 reads a scan that already exists.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const documentId = request.nextUrl.searchParams.get('document_id')
    if (!documentId) return NextResponse.json({ error: 'Missing document_id.' }, { status: 400 })

    // The index row carries the corrected values and the computed status; everything else hangs
    // off it. Read through `authed.db`, so another company's document is simply not there.
    const { data: row } = await db
      .from('document_index_v').select('*').eq('document_id', documentId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const scanId = row.scan_id as string | null

    // Ordered, every one of them. An unordered list re-shuffles when an unrelated row is
    // updated, and a report a person is reading must not rearrange itself.
    const [scan, gaps, conditions, deadlines, facts, corrections, versions, sites, labels, lists, dates] = await Promise.all([
      scanId ? db.from('document_scans').select('*').eq('id', scanId).maybeSingle() : { data: null },
      // EVERY gap row for this document, not only the current scan's. A gap from an earlier
      // reading that still carries somebody's checklist has to stay reachable — the route sorts
      // them into "now" and "from earlier readings" below.
      db.from('document_gaps').select('*').eq('document_id', documentId)
        .order('scan_id').order('ordinal'),
      db.from('document_conditions').select('*').eq('document_id', documentId).order('ordinal'),
      // *** THE CURRENT READING'S DATES ONLY — Calendar decision 4 (`DECISIONS.md` §185, B3). ***
      // This read had no scan filter, so a document read twice listed BOTH readings' dates: staging's
      // `13-company-self-check.docx` showed one source line under two titles, which reads as two
      // obligations where there is one. `document_dates_current_v` (migration 073) is the one
      // definition — the current reading of a document no CONFIRMED newer version supersedes — and the
      // calendar's writer reads the same view, so the report and the calendar cannot disagree about
      // what this document's dates are.
      //
      // An earlier reading's dates are not shown "from earlier readings" the way gaps are (`:80–83`):
      // a gap may carry somebody's checklist or draft and has to stay reachable, while a date a person
      // acted on became a `calendar_events` row that survives on its own.
      db.from('document_dates_current_v').select('*').eq('document_id', documentId)
        .order('due_on', { nullsFirst: false }).order('title'),
      db.from('fact_proposals').select('*').eq('document_id', documentId).order('created_at').order('id'),
      db.from('document_corrections').select('*').eq('document_id', documentId)
        .order('created_at', { ascending: false }).order('id', { ascending: false }),
      // The version chain: this document, whatever it supersedes, and whatever supersedes it.
      // One level each way is all the data model holds today — `version_of` is a single link.
      db.from('document_index_v').select('document_id, title, file_name, doc_date, uploaded_at, version_of, version_confirmed')
        .eq('company_id', companyId).order('uploaded_at', { ascending: false }),
      db.from('entities').select('id, name').eq('company_id', companyId).order('name'),
      db.from('company_labels').select('kind, label').eq('company_id', companyId).order('kind').order('label'),
      // Checklists made from this document, with their items, so the report can show progress
      // against a gap weeks later — "checklist made 17 Sep · 2 of 5 done" is the vision's own
      // example and the reason the link is on the gap.
      db.from('checklists')
        .select('id, title, created_at, document_gap_id, checklist_items(id, completed, parent_item_index)')
        .eq('company_id', companyId).eq('document_id', documentId)
        .order('created_at', { ascending: false }),
      // *** WHAT THE CALENDAR SAYS ABOUT EACH DATE — Calendar decisions 3 and 6. ***
      // Since a reading's dates go on the calendar by themselves, the report's job on a date is to
      // say where it stands: on the calendar and not yet confirmed, confirmed, needing a day, or
      // refused with the reason the person gave. That state lives on `calendar_events`, matched by
      // `document_deadline_id` — not by `document_deadlines.calendar_event_id`, which is only set
      // when somebody pressed the button and so is null for every date the reading added.
      db.from('calendar_events')
        .select('id, document_deadline_id, state, rejected_reason, due_date, repeats_every, counts_as_due')
        .eq('company_id', companyId).eq('document_id', documentId)
        .not('document_deadline_id', 'is', null),
    ])

    const all = versions.data ?? []
    const chain = all.filter((v) =>
      v.document_id === documentId ||
      v.document_id === row.version_of ||
      v.version_of === documentId)

    // Gaps belonging to the CURRENT scan are the report's gaps. An older one is shown when a
    // person has work attached to it — a superseded finding with nothing hanging off it is
    // noise, and one with a checklist on it is a fortnight of somebody's afternoons — AND,
    // since Run 7, when it is STILL OPEN.
    //
    // *** THE SECOND CASE IS THE ONE THAT MATTERS. *** A gap the latest reading neither raised
    // nor named is not closed: a reading that failed to mention a missing evacuation procedure
    // is not evidence the procedure exists. `saveScan` marks it `not_seen_at` and leaves it
    // open, and a finding left open that the report does not show is a finding we have quietly
    // dropped. Superseded and dismissed rows are excluded — those were answered, one by the
    // next reading and one by a person.
    const allGaps = (gaps.data ?? []) as Array<Record<string, unknown>>
    const current = allGaps.filter((g) => g.scan_id === scanId)
    const listedGapIds = new Set((lists.data ?? []).map((c: Record<string, unknown>) => c.document_gap_id))
    const earlier = allGaps.filter((g) =>
      g.scan_id !== scanId && (listedGapIds.has(g.id) || g.status === 'open'))

    return NextResponse.json({
      row,
      scan: scan.data ?? null,
      gaps: current,
      earlierGaps: earlier,
      conditions: conditions.data ?? [],
      // The view names its key `deadline_id`; the report has always called it `id` and the drawer's
      // button sends it back as `deadline_id`. Mapped here rather than renamed in the component, so
      // the one place that knows about the view is the route that reads it.
      deadlines: ((deadlines.data ?? []) as Array<Record<string, unknown>>).map((d) => {
        const ev = ((dates.data ?? []) as Array<Record<string, unknown>>)
          .find((e) => e.document_deadline_id === d.deadline_id)
        return {
          id: d.deadline_id, title: d.title, due_on: d.due_on, source_line: d.source_line,
          recurs: d.recurs,
          // Whether the line was found in the document (decision 5). Null means there was no text to
          // check against — not "not found" — and the drawer says neither in that case.
          quote_verified: d.quote_verified,
          // The old pointer, still written when somebody presses the button, so nothing that read it
          // before changes.
          calendar_event_id: (d.calendar_event_id as string | null) ?? (ev?.id as string | null) ?? null,
          // What the calendar says about it, for the row's words.
          calendar_state: (ev?.state as string | null) ?? null,
          calendar_reason: (ev?.rejected_reason as string | null) ?? null,
          repeats_every: (ev?.repeats_every as string | null) ?? null,
        }
      }),
      facts: facts.data ?? [],
      corrections: corrections.data ?? [],
      versions: chain,
      sites: sites.data ?? [],
      labels: labels.data ?? [],
      checklists: (lists.data ?? []).map((c: Record<string, unknown>) => {
        // Only the top-level items. `/api/substeps` breaks one item into children that live
        // in this same table under a `parent_item_index`, and the checklist page has always
        // counted parents only — a report saying "3 of 19" beside a page saying "3 of 7" is
        // two numbers for one thing.
        const items = ((c.checklist_items ?? []) as Array<{ completed: boolean; parent_item_index: number | null }>)
          .filter((i) => i.parent_item_index === null)
        return {
          id: c.id, title: c.title, created_at: c.created_at,
          document_gap_id: c.document_gap_id,
          // Read LIVE off the items rather than stored on the checklist: progress that is
          // written down is progress that goes stale the moment somebody ticks something.
          done: items.filter((i) => i.completed).length,
          total: items.length,
        }
      }),
    })
  } catch (error) {
    console.error('documents/report:', error)
    return NextResponse.json({ error: 'We could not open that report just now.' }, { status: 500 })
  }
}
