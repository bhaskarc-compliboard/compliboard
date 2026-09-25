// THE SCAN, FROM THE BROWSER — Documents Run 3, commit 1.
//
// One document in, one reading out. The page uploads a file, records it, and calls this once per
// document; everything else about what a document IS comes from here.
//
// *** IT NEVER RETURNS 500 FOR A MODEL OR PARSE FAILURE. ***
// A scan that the model could not produce, or produced in a form we could not use, is not a
// server error — it is an answer, and the answer is "we could not read this clearly enough to
// rely on". `CLAUDE.md` §5.1: never assert anything about a document the product did not
// successfully read, always say whose problem it is, always give the way forward. A 500 tells the
// page nothing it can show a person, and the old review path's 500s are exactly what this
// replaces. The only 4xx/5xx here are for the request being wrong (no token, no such document,
// the file missing from storage) — never for the reading.
//
// *** IT DOES NOT TOUCH THE OLD REVIEW PATH. *** `/api/document-review`, `document_reviews`, the
// audit engine's auto-index loop and the compliance page's attach card are all unchanged and
// still on the old reading. Two readings of one document coexist until those callers are
// rewired, which is Run 5.
//
// THE LEDGER ROW IS WRITTEN INSIDE `runDocumentScan`, task `document_scan`, with the company
// from the verified session. Nothing here writes one, because a second one would double-count.
//
// *** TWO CLIENTS, AND THE SPLIT IS THE POINT. ***
// Everything the CALLER is entitled to do runs on `authed.db`, under RLS: finding the document,
// checking it is theirs, reading their company, fetching the file, setting documents.status.
//
// The scan itself is written with `supabaseAdmin`, and that is deliberate rather than
// convenient. Migration 040 grants `authenticated` SELECT on document_scans, document_gaps,
// document_conditions, document_deadlines and company_labels and INSERT on none of them — read
// back with has_table_privilege rather than taken from the grant list (§3.6). That is not an
// omission to correct: **a signed-in user must not be able to author a reading.** These rows say
// what a model concluded from a document, and the product's whole claim is that they came from
// reading the file. Granting INSERT would let anyone with a session POST a fabricated compliance
// reading for their own company straight at PostgREST, and RLS cannot express "only the server
// may write this" — a WITH CHECK on auth_company_id() would happily pass it.
//
// So this is §3.6's named-statement exception, and the name is: the scan this server just
// produced, for a document whose ownership was already proved on `authed.db` above, under the
// company id from the verified token and never from the body.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { runDocumentScan, saveScan, buildScanContext, failedScan } from '@/lib/documentScan'

const BUCKET = 'company-documents'

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  let documentId: string | null = null
  try {
    const body = await request.json()
    documentId = typeof body?.document_id === 'string' ? body.document_id : null
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with document_id.' }, { status: 400 })
  }
  if (!documentId) {
    return NextResponse.json({ error: 'Missing document_id.' }, { status: 400 })
  }

  // Read through `authed.db`, which acts as the caller under RLS, so a document belonging to
  // another company simply is not there. 404 rather than 403 so ids cannot be probed by watching
  // which error comes back — `CLAUDE.md` §3.6, the pattern from /api/documents.
  const { data: doc } = await db
    .from('documents')
    .select('id, name, file_url, file_type, company_id, entity_id')
    .eq('id', documentId)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data: company } = await db
    .from('companies')
    .select('id, name, industry, city, state')
    .eq('id', companyId)
    .maybeSingle()
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // *** `reading` BEFORE THE CALL, NOT AFTER. *** The scan takes 20 to 100 seconds. A row that
  // still says `uploaded` for that whole time tells the person nothing is happening, and the
  // page shows this column as its status word. Written first so the truth is on the row while
  // the work is in flight, not once it is over.
  await db.from('documents').update({ status: 'reading' }).eq('id', documentId)

  try {
    const { data: blob, error: dlError } = await db.storage.from(BUCKET).download(doc.file_url)
    if (dlError || !blob) {
      // The file is not where its row says it is. That IS a product failure and it is said out
      // loud on the row rather than thrown, because the document still exists and still needs a
      // status somebody can act on.
      const reason = 'We could not fetch the stored file for this document.'
      const wayForward = 'Upload it again — the record is here but the file is not.'
      // Written as a scan so the reason is ON THE ROW and survives a reload.
      const { scanId } = await saveScan(supabaseAdmin, failedScan(reason, wayForward),
        { documentId, companyId, entityId: doc.entity_id ?? null })
      return NextResponse.json({ scan_id: scanId, status: 'could_not_read', could_not_read: { reason, way_forward: wayForward } })
    }

    const context = await buildScanContext(db, company, documentId)
    const scan = await runDocumentScan({
      buffer: await blob.arrayBuffer(),
      fileName: doc.name,
      fileType: doc.file_type || 'application/pdf',
      companyId,
      context,
    })

    // `saveScan` writes the scan, its gaps, conditions, deadlines and fact proposals, upserts any
    // new labels, and sets documents.status to read or could_not_read from the scan's own status.
    const { scanId } = await saveScan(supabaseAdmin, scan, {
      documentId,
      companyId,
      entityId: doc.entity_id ?? null,
    })

    return NextResponse.json({
      scan_id: scanId,
      status: scan.status,
      kind: scan.identity.kind,
      title: scan.identity.title,
      json_parsed: scan.json_parsed,
      could_not_read: scan.status === 'could_not_read' ? scan.could_not_read : null,
    })
  } catch (error) {
    // THE LAST RESORT, AND IT IS STILL NOT A 500.
    //
    // Something broke at our end — the model call threw, a write was refused. The document is
    // left saying could_not_read with a reason a person can read, because the alternative is a
    // row stuck on `reading` forever and a page that spins. The technical detail goes to the
    // log, not to the customer (§5, two messages, two audiences).
    console.error('document-scan:', error)
    const reason = "We couldn't read this file — it did not arrive as something we can open. "
      + 'That is our end of it, not a problem with what you sent.'
    const wayForward = 'A PDF exported from the original, or a straight-on photo in good light, would do it.'
    // Same as above: the row carries the reason, not just this response.
    let scanId: string | null = null
    try {
      ({ scanId } = await saveScan(supabaseAdmin, failedScan(reason, wayForward),
        { documentId, companyId, entityId: doc.entity_id ?? null }))
    } catch (saveError) {
      console.error('document-scan: could not even record the failure:', saveError)
      await db.from('documents').update({ status: 'could_not_read' }).eq('id', documentId)
    }
    return NextResponse.json({ scan_id: scanId, status: 'could_not_read', could_not_read: { reason, way_forward: wayForward } })
  }
}
