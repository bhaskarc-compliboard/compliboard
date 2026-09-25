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

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { runDocumentScan, saveScan, buildScanContext } from '@/lib/documentScan'

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
      await db.from('documents').update({ status: 'could_not_read' }).eq('id', documentId)
      return NextResponse.json({
        scan_id: null,
        status: 'could_not_read',
        could_not_read: {
          reason: 'We could not fetch the stored file for this document.',
          way_forward: 'Upload it again — the record is here but the file is not.',
        },
      })
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
    const { scanId } = await saveScan(db, scan, {
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
    await db.from('documents').update({ status: 'could_not_read' }).eq('id', documentId)
    return NextResponse.json({
      scan_id: null,
      status: 'could_not_read',
      could_not_read: {
        reason: "We couldn't finish reading this document — something went wrong at our end, not with your file.",
        way_forward: 'It has been saved. Try reading it again in a moment.',
      },
    })
  }
}
