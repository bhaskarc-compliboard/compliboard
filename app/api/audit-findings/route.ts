// A PERSON'S OWN EDITS TO A FINDING — Audits Run 3.
//
//   PATCH /api/audit-findings  { id, action: 'dismiss', reason }
//
// One route, one verb, ownership proved first — the `document-actions` shape. A dismissal is the
// person's own act and migration 058 grants them exactly this one UPDATE, so it goes through THEIR
// client and not the service role.
//
// *** A REASON IS REQUIRED, AND THAT IS THE POINT OF THE ACTION. *** "Not right" with no reason is a
// row that disappears and teaches nobody anything; with one, it is the only evidence we have that a
// finding was wrong, and every one of them is a line in the next brief.

import { NextResponse, type NextRequest } from 'next/server'

import { requireCompany } from '@/lib/auth'

export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { db } = authed.auth

    const body = await request.json().catch(() => null)
    const id = String(body?.id ?? '').trim()
    const action = String(body?.action ?? '')
    const reason = String(body?.reason ?? '').trim()
    if (!id || action !== 'dismiss') {
      return NextResponse.json({ error: 'Expected an id and action "dismiss".' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ error: 'Tell us what is wrong with it, so we can do better next time.' },
        { status: 400 })
    }

    // Ownership on the caller's client: another company's finding is not there, and not-there is
    // 404 so an id cannot be probed (§3.6).
    const { data: found } = await db.from('audit_findings').select('id, status').eq('id', id).maybeSingle()
    if (!found) return NextResponse.json({ error: 'That finding was not found.' }, { status: 404 })

    // Guarded on it still being open, so two taps do not overwrite the first reason.
    const { data: back, error } = await db.from('audit_findings')
      .update({ status: 'dismissed', dismissed_reason: reason.slice(0, 2000) })
      .eq('id', id).eq('status', 'open').select('id')
    if (error) throw error
    if (!back?.length) {
      return NextResponse.json({ error: 'That finding is no longer open.' }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('audit-findings PATCH:', error)
    return NextResponse.json({ error: 'We could not save that just now.' }, { status: 500 })
  }
}
