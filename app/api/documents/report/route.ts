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
      db.from('document_deadlines').select('*').eq('document_id', documentId).order('due_on', { nullsFirst: false }).order('title'),
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
        .select('id, title, created_at, document_gap_id, checklist_items(id, completed)')
        .eq('company_id', companyId).eq('document_id', documentId)
        .order('created_at', { ascending: false }),
    ])

    const all = versions.data ?? []
    const chain = all.filter((v) =>
      v.document_id === documentId ||
      v.document_id === row.version_of ||
      v.version_of === documentId)

    // Gaps belonging to the CURRENT scan are the report's gaps. Anything older is shown only
    // when a person has work attached to it, because a superseded finding with nothing hanging
    // off it is noise, and one with a checklist on it is a fortnight of somebody's afternoons.
    const allGaps = (gaps.data ?? []) as Array<Record<string, unknown>>
    const current = allGaps.filter((g) => g.scan_id === scanId)
    const listedGapIds = new Set((lists.data ?? []).map((c: Record<string, unknown>) => c.document_gap_id))
    const earlier = allGaps.filter((g) => g.scan_id !== scanId && listedGapIds.has(g.id))

    return NextResponse.json({
      row,
      scan: scan.data ?? null,
      gaps: current,
      earlierGaps: earlier,
      conditions: conditions.data ?? [],
      deadlines: deadlines.data ?? [],
      facts: facts.data ?? [],
      corrections: corrections.data ?? [],
      versions: chain,
      sites: sites.data ?? [],
      labels: labels.data ?? [],
      checklists: (lists.data ?? []).map((c: Record<string, unknown>) => {
        const items = (c.checklist_items ?? []) as Array<{ completed: boolean }>
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
