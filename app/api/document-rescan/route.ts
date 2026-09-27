// READ IT AGAIN, AS A QUEUED JOB — 28 September 2026.
//
// *** WHY THIS ROUTE EXISTS, AND IT IS A DEFECT SEEN ON PRODUCTION. ***
// "Read it again" in the report drawer used to POST `/api/document-scan`, which runs the whole scan
// INSIDE the request — 20 to 120 seconds of model call. So closing the drawer aborted the fetch, the
// browser dropped the request, the serverless function was cut with it, and the document was left
// wherever it happened to be: `reading` for ever if the throw came after the status was set, or the
// old reading still current with nothing to say a re-read had been asked for. **The person did the
// thing the product told them to do and nothing happened.**
//
// *** SO IT WORKS THE WAY AN UPLOAD DOES, WHICH ALREADY SURVIVES A CLOSED TAB. ***
// Documents Run 7 settled this shape for a folder of thirty files and it is the same shape here:
//
//   1. the document goes back in the queue     `status = 'uploaded'`, `reading_since = null`
//   2. a batch of one is created               so the banner and the page can report it
//   3. the sweep is kicked with `after()`      the response is already sent
//   4. the response returns at once
//
// **Nothing about the reading is in this request.** `after()` runs `sweep()` — the SAME function the
// cron route calls, not an "urgent" copy of it — once the response has gone, and the sweep claims the
// company's whole queue, reads its documents one after another, and writes the scan. Close the drawer,
// close the tab, lose the network: the reading happens anyway, because nothing about it depends on a
// browser still being there. `app/api/document-batches/route.ts` is where this pattern is documented.
//
// *** IT DOES NOT REPLACE `/api/document-scan`. *** That route is still the live path: one to three
// files uploaded in the page are read in the request, on purpose, because somebody is watching and a
// row that fills in while you look at it is the better experience. `check-live.js` drives it too.
// This route is for the one case where the reading is asked for by somebody who may walk away.
//
// *** A BATCH OF ONE NEVER EMAILS. *** `finishBatchIfDone` refuses to notify a one-file batch — see
// the note there. A person who just pressed "Read it again" is looking at the drawer.

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { sweep } from '@/app/api/jobs/scan-documents/route'

// The same ceiling as the batches route, and for the same reason: `after()` runs the sweep on this
// invocation, so the function has to be allowed to live long enough to read what it claimed.
export const maxDuration = 800

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, userId, db } = authed.auth

  let documentId: string | null = null
  try {
    const body = await request.json()
    documentId = typeof body?.document_id === 'string' ? body.document_id : null
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with document_id.' }, { status: 400 })
  }
  if (!documentId) return NextResponse.json({ error: 'Missing document_id.' }, { status: 400 })

  try {
    // Ownership through the caller's own client, under RLS, so another company's document simply is
    // not there — 404 rather than 403 so ids cannot be probed by watching which error comes back
    // (`CLAUDE.md` §3.6, the pattern from /api/documents).
    const { data: doc } = await db
      .from('documents')
      .select('id, name, status')
      .eq('id', documentId)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // *** THE BATCH IS CREATED BY THE SERVER. *** `authenticated` holds SELECT and UPDATE on
    // `document_batches` and neither INSERT nor DELETE (migration 053): a batch is a claim that a
    // set of files arrived together, and the page's banner is written from it. Company and uploader
    // come from the verified session; nothing in the body can name either. §3.6's named-statement
    // exception, and the name is: the one-document batch this re-read is.
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('document_batches')
      .insert({ company_id: companyId, created_by: userId, file_count: 1, status: 'queued' })
      .select('id')
      .single()
    if (batchError) throw batchError

    // *** BACK IN THE QUEUE, AND THE CLAIM CLEARED IN THE SAME WRITE. ***
    // `status = 'uploaded'` IS the queue the sweep reads (its rule 4a), and `reading_since = null`
    // is the claim — a row still carrying a claim from a killed run would be skipped until the
    // stuck-row recovery released it, which is up to fifteen minutes of a person watching nothing
    // happen. Both move together or neither does.
    //
    // **`batch_id` is repointed at the new batch, and that is deliberate rather than incidental.**
    // The document's original upload batch is long since `done` with its summary STORED on the row,
    // so moving the document does not rewrite any history — and the new batch has to contain this
    // document or `finishBatchIfDone` would find an empty batch and never close it.
    //
    // Written through `db`, not the admin client: it is the caller's own document and RLS should
    // still be the thing that says so.
    const { error: upError } = await db
      .from('documents')
      .update({ status: 'uploaded', reading_since: null, batch_id: batch.id })
      .eq('id', documentId)
    if (upError) throw upError

    // *** THE RESPONSE GOES FIRST; THE SWEEP RUNS AFTER IT. ***
    // This is the whole fix. The caller is told "queued" in a few hundred milliseconds and can close
    // the drawer, and the reading proceeds on this invocation regardless of what the browser does.
    after(async () => {
      try { await sweep() } catch (e) { console.error('document-rescan: kicked sweep failed:', e) }
    })

    return NextResponse.json({
      ok: true,
      document_id: documentId,
      batch_id: batch.id,
      status: 'uploaded',
      // What the drawer says while it waits. The wording is the product's, not the browser's, so the
      // two surfaces cannot drift: the page's row and the drawer are describing one state.
      message: 'Queued — we are reading it again. You can close this; it will keep going.',
    })
  } catch (error) {
    // *** NOT A 500 FOR SOMETHING THE PERSON CAN ACT ON. *** Nothing has been read and nothing is
    // claimed about the document, so there is nothing to write onto it — this is a request that
    // failed, not a reading that failed, and it is the one case in this area where a plain error is
    // the honest answer. The technical detail goes to the log (§5, two messages, two audiences).
    console.error('document-rescan:', error)
    return NextResponse.json(
      { error: 'We could not queue that document for another reading. Nothing about it has changed.' },
      { status: 500 },
    )
  }
}
