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
    const [scan, gaps, conditions, deadlines, facts, corrections, versions, sites, labels, lists] = await Promise.all([
      scanId ? db.from('document_scans').select('*').eq('id', scanId).maybeSingle() : { data: null },
      // EVERY gap row for this document, not only the current scan's. A gap from an earlier
      // reading that still carries somebody's checklist has to stay reachable — the route sorts
      // them into "now" and "from earlier readings" below.
      db.from('document_gaps').select('*').eq('document_id', documentId)
        .order('scan_id').order('ordinal'),
      db.from('document_conditions').select('*').eq('document_id', documentId).order('ordinal'),
      // *** THE CALENDAR ROW COMES WITH THE DEADLINE — Calendar step 6. ***
      // The drawer's line says whether this date is on the calendar and whether anybody has
      // confirmed it, so it needs `status`. EMBEDDED rather than fetched separately, because
      // `document_deadlines.calendar_event_id` → `calendar_events.id` is a real single-column
      // foreign key (`document_deadlines_calendar_event_id_fkey`, read from `pg_constraint`), so
      // PostgREST can join it in this query — one round trip, through `authed.db`, so
      // `calendar_events_select` applies and another company's row simply is not there.
      //
      // NOT `calendar_v`: it has no foreign key, so it cannot be embedded. And NOT a second query
      // keyed on `calendar_events.deadline_id`, which would MISS rows — `proposeDate`'s `existing`
      // outcome leaves `deadline_id` pointing at the scan generation that first filed the date,
      // while every later deadline row carries its own stamp. The line needs no computed column,
      // so the raw table is enough.
      //
      // *** THE CONSTRAINT IS NAMED, AND IT HAS TO BE. ***
      // There are now TWO foreign keys between these tables, pointing at each other:
      // `document_deadlines.calendar_event_id` → `calendar_events.id` (migration 040) and
      // `calendar_events.deadline_id` → `document_deadlines.id` (migration 073). An unqualified
      // embed is therefore ambiguous and PostgREST refuses it —
      // `PGRST201: Could not embed because more than one relationship was found` — which is what
      // this query did on its first run, measured on staging. The wanted direction is the stamp,
      // so the key is named.
      db.from('document_deadlines')
        .select('*, calendar_events!document_deadlines_calendar_event_id_fkey(id, status)')
        .eq('document_id', documentId).order('due_on', { nullsFirst: false }).order('title'),
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
      // *** AND THIS ONE IS NOT SWALLOWED. ***
      // `?? []` on a failed query turns "we could not read the dates" into "this document sets no
      // dates" — the two are indistinguishable on screen and the wrong one reads as a fact
      // (`CLAUDE.md` §5.1: an empty state is a claim, and it has to be true). It is exactly how the
      // ambiguous embed above survived its first run: 0 deadlines, no error, a report that looked
      // complete. A reading we cannot load is now a 500 the catch below turns into words.
      deadlines: (() => {
        if (deadlines.error) throw new Error(`document_deadlines: ${deadlines.error.message}`)
        return deadlines.data ?? []
      })(),
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
