// AN UPLOAD, AS A ROW — Documents Run 7.
//
// POST   creates the batch the files will be filed against
// PATCH  start (hand it to the sweep) · finish (the live path) · dismiss (the banner)
//
// *** THE BATCH IS CREATED BY THE SERVER, NOT BY THE BROWSER. *** `authenticated` holds SELECT
// and UPDATE on `document_batches` and neither INSERT nor DELETE (migration 053), because a
// batch is a claim that a set of files arrived together and an email goes out on the strength
// of it. The company and the uploader come from the verified session; nothing in the body can
// name either.
//
// *** `after()` IS WHY A FOLDER IS READ IN MINUTES AND NOT AT THE NEXT TICK. ***
// The cron cadence is every five minutes, which is the backstop. `after()` from `next/server`
// runs the sweep once the response has been sent, so the person who just dropped thirty files in
// sees the first rows turn from Queued to Reading… while they are still looking at the page.
// It is the SAME sweep function the cron route calls — a second "urgent" path would be a second
// thing to keep correct, and it is the one that would drift.

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { sweep, finishBatchIfDone } from '@/app/api/jobs/scan-documents/route'

export const maxDuration = 800

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId } = authed.auth

    const body = await request.json().catch(() => ({}))
    const fileCount = Number.isFinite(Number(body?.file_count)) ? Math.max(0, Number(body.file_count)) : 0

    const { data, error } = await supabaseAdmin.from('document_batches')
      .insert({ company_id: companyId, created_by: userId, file_count: fileCount })
      .select('id').single()
    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (error) {
    console.error('document-batches POST:', error)
    return NextResponse.json({ error: 'We could not start that upload.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const id = String(body?.id ?? '').trim()
    const action = String(body?.action ?? '')
    if (!id || !['start', 'finish', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'Expected an id and an action.' }, { status: 400 })
    }

    // Ownership through the caller's own client, so another company's batch simply is not
    // there. 404 rather than 403 so ids cannot be probed (§3.6).
    const { data: batch } = await db.from('document_batches')
      .select('id, company_id, status').eq('id', id).maybeSingle()
    if (!batch) return NextResponse.json({ error: 'That upload was not found.' }, { status: 404 })

    if (action === 'dismiss') {
      // Through `db`, not the admin client: dismissing is the person's own act and migration
      // 053 grants them exactly this. Written once — a banner that comes back after somebody
      // has closed it reads worse than one that never appeared.
      const { error } = await db.from('document_batches')
        .update({ dismissed_at: new Date().toISOString() }).eq('id', id).is('dismissed_at', null)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'finish') {
      // THE LIVE PATH. Three files or fewer are read in the page, so by the time this is called
      // every document is already settled; this computes the summary and marks the batch done.
      // `email: false` is the whole difference between the two paths: somebody who watched the
      // files go in does not need to be told by email that they went in.
      const res = await finishBatchIfDone(id, new URL(request.url).origin, { email: false })
      return NextResponse.json({ ok: true, ...res })
    }

    // action === 'start'
    const fileCount = Number.isFinite(Number(body?.file_count)) ? Math.max(0, Number(body.file_count)) : null
    await supabaseAdmin.from('document_batches')
      .update({ status: 'queued', ...(fileCount === null ? {} : { file_count: fileCount }) })
      .eq('id', id)

    // The response goes first; the sweep runs after it. A folder upload must not hold the
    // browser open for the length of thirty scans.
    const origin = new URL(request.url).origin
    after(async () => {
      try { await sweep(origin) } catch (e) { console.error('kicked sweep failed:', e) }
    })
    return NextResponse.json({ ok: true, queued: true, company_id: companyId })
  } catch (error) {
    console.error('document-batches PATCH:', error)
    return NextResponse.json({ error: 'We could not update that upload.' }, { status: 500 })
  }
}
