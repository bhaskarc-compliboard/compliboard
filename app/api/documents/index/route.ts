// THE DOCUMENTS PAGE'S ONE READ — Documents Run 3, commit 1.
//
// `document_index_v` (migration 043) is one row per document with everything the page groups and
// sorts by already joined: what the scan says it is, which folder and site it sits in, its dates,
// its open gap count, and a display_status computed in SQL against today. This route hands those
// rows back for the caller's company and does nothing else to them.
//
// *** THE ORDER IS SET HERE, NOT LEFT TO THE DATABASE. *** PostgREST returns rows in whatever
// order Postgres yields with no ORDER BY, and that order changes when a row is updated — which is
// how Documents Run 2b found the scan prompt changing with nothing else having changed. A list a
// person is looking at must not reshuffle because something unrelated was written.
//
// Tenancy is the view's own: it is `security_invoker`, so it shows exactly the rows the caller
// could select from `documents`. The `.eq('company_id', …)` below is belt and braces — the
// policies are the boundary (§3.6) and this is the second lock, not the first.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { data, error } = await db
      .from('document_index_v')
      .select('*')
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false })
      .order('document_id', { ascending: true })

    if (error) {
      console.error('documents/index:', error.message)
      return NextResponse.json({ error: 'We could not load your documents just now.' }, { status: 500 })
    }

    // The folder list travels with the index because every render of the page needs both and
    // they are always read together — the Folder control counts documents per folder.
    const { data: folders } = await db
      .from('company_folders')
      .select('id, name, parent_id, sort_order')
      .eq('company_id', companyId)
      .order('sort_order')
      .order('name')

    // Sites decide whether the Site control appears at all: the vision shows it only when the
    // company has more than one.
    const { data: sites } = await db
      .from('entities')
      .select('id, name, is_primary')
      .eq('company_id', companyId)
      .order('name')

    // WHAT WE'D EXPECT AND DON'T SEE — Documents Run 6.
    //
    // Every scan has answered this since Run 1 and nothing has ever read the answer: the
    // `expected_missing` column on `document_scans` holds what a company like this one usually
    // also holds, and the prompt requires each entry to say plainly that it is based on similar
    // companies rather than on a checked requirement.
    //
    // Only the CURRENT scan of each document, because an entry from a superseded reading is a
    // guess about a document we have since read again.
    //
    // *** THE AGENCY IS NOT TAKEN FROM HERE. *** These rows carry the scan's own agencies, and a
    // person may have corrected them; `document_index_v` above is the row that knows. So this
    // returns the entries by document id and the page groups them under whatever agency the
    // index row says — otherwise the line would appear under the agency somebody corrected away.
    const { data: expected } = await db
      .from('document_scans')
      .select('document_id, expected_missing')
      .eq('company_id', companyId)
      .eq('is_current', true)
      .order('document_id')

    return NextResponse.json({
      documents: data ?? [],
      folders: folders ?? [],
      sites: sites ?? [],
      expected: expected ?? [],
    })
  } catch (error) {
    console.error('documents/index:', error)
    return NextResponse.json({ error: 'We could not load your documents just now.' }, { status: 500 })
  }
}
