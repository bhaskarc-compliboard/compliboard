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
import { mustRow } from '@/lib/mustRead'

/** The words on a finding a person closed by hand (the owner's decision D1.3, migration 082). */
export const CLOSED_BY_A_PERSON = 'closed by a person'

export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { db, userId } = authed.auth

    const body = await request.json().catch(() => null)
    const id = String(body?.id ?? '').trim()
    const action = String(body?.action ?? '')
    const reason = String(body?.reason ?? '').trim()
    if (!id || (action !== 'dismiss' && action !== 'close' && action !== 'reopen')) {
      return NextResponse.json({ error: 'Expected an id and action "dismiss", "close" or "reopen".' },
        { status: 400 })
    }
    if (action === 'dismiss' && !reason) {
      return NextResponse.json({ error: 'Tell us what is wrong with it, so we can do better next time.' },
        { status: 400 })
    }

    /**
     * *** "CLOSE IT" AND "REOPEN" — the owner's decision D1.3, 12 October 2026. ***
     *
     * The audit no longer closes a finding because the newer audit went quiet about it: the item
     * moves to "Not raised in this audit" and **the person closes it**. So these two actions are
     * the only way a finding is closed by hand, and the one that matters is that **Reopen undoes
     * it** — the whole complaint in E9 item 3 was a close a person could not undo.
     *
     * Through the caller's own client: closing is their act and migration 058 grants them the one
     * UPDATE. The ownership read below is what makes another company's finding a 404.
     */
    if (action === 'close' || action === 'reopen') {
      const mine = mustRow<{ id: string; status: string }>('that finding',
        await db.from('audit_findings').select('id, status').eq('id', id).maybeSingle())
      if (!mine) return NextResponse.json({ error: 'That finding was not found.' }, { status: 404 })

      const patch = action === 'close'
        ? { status: 'closed', closed_by: userId, closed_at: new Date().toISOString(),
            closed_reason: CLOSED_BY_A_PERSON }
        // Reopen leaves NO trace of the close, so the row reads exactly as it did before it.
        : { status: 'open', closed_by: null, closed_at: null, closed_reason: null }
      const { data: back, error } = await db.from('audit_findings').update(patch)
        .eq('id', id).eq('status', action === 'close' ? 'open' : 'closed').select('id')
      if (error) throw error
      if (!back?.length) {
        return NextResponse.json({
          error: action === 'close'
            ? 'That one is no longer open. Reload the audit to see where it stands.'
            : 'That one is already open. Reload the audit to see where it stands.',
        }, { status: 409 })
      }
      return NextResponse.json({ ok: true })
    }

    // Ownership on the caller's client: another company's finding is not there, and not-there is
    // 404 so an id cannot be probed (§3.6).
    // A15 (Job E4): a database error shown as "not found" is a claim about the person's own data.
    const found = mustRow<{ id: string; status: string }>('that finding',
      await db.from('audit_findings').select('id, status').eq('id', id).maybeSingle())
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
