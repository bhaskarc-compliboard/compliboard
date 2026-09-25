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
    const [scan, gaps, conditions, deadlines, facts, corrections, versions, sites, labels] = await Promise.all([
      scanId ? db.from('document_scans').select('*').eq('id', scanId).maybeSingle() : { data: null },
      db.from('document_gaps').select('*').eq('document_id', documentId).order('ordinal'),
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
    ])

    const all = versions.data ?? []
    const chain = all.filter((v) =>
      v.document_id === documentId ||
      v.document_id === row.version_of ||
      v.version_of === documentId)

    return NextResponse.json({
      row,
      scan: scan.data ?? null,
      gaps: gaps.data ?? [],
      conditions: conditions.data ?? [],
      deadlines: deadlines.data ?? [],
      facts: facts.data ?? [],
      corrections: corrections.data ?? [],
      versions: chain,
      sites: sites.data ?? [],
      labels: labels.data ?? [],
    })
  } catch (error) {
    console.error('documents/report:', error)
    return NextResponse.json({ error: 'We could not open that report just now.' }, { status: 500 })
  }
}
