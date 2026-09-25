// WHAT THE PERSON SAYS BACK — Documents Run 4, the drawer's writes.
//
// *** ONE ROUTE, SEVEN VERBS, AND THAT IS DELIBERATE. *** Every action here is the same shape:
// somebody reading a report tells us the scan got something wrong, or accepts something it got
// right, about ONE document they own. Each needs the identical three steps first — verify the
// token, resolve the company, prove this document is theirs — and splitting them into six routes
// would be six copies of that check, which is how one of them eventually ends up trusting a body
// parameter instead (`CLAUDE.md` §3.6's opening note). The `action` is named in the body and
// every branch is small enough to read in one screen.
//
// *** NONE OF THESE CALLS A MODEL. *** Run 4 is the drawer reading a scan that already exists.
// Checklists, drafts and research-from-a-gap are Run 5 and are not here, not even disabled.
//
// WHICH CLIENT WRITES WHAT, and the split is the same one Run 3 settled:
//   · `authed.db` — the caller, under RLS — for reads, the ownership check, and the rows a
//     person is entitled to change: `documents.latest_confirmed_at`, `version_confirmed`.
//   · `supabaseAdmin` — for `document_corrections`, `document_gaps.status` and
//     `fact_proposals.status`. Migration 045 grants `authenticated` SELECT and no INSERT on
//     corrections, and 040 the same on the scan's own tables, because a correction outranks the
//     model on this customer's screen and is fed to the next scan as fact. RLS can say "your
//     company"; it cannot say "through the route that recorded who did it and what it replaced",
//     so the route holds that and the grant does not. §3.6's named-statement exception.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

const CORRECTABLE = ['kind', 'agencies', 'subjects', 'site', 'doc_date', 'title'] as const
const SCAN_KINDS = ['permit', 'certificate', 'program', 'policy', 'record', 'supplier_document', 'other']

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    if (!body?.action || !body?.document_id) {
      return NextResponse.json({ error: 'Expected an action and a document_id.' }, { status: 400 })
    }
    const { action, document_id: documentId } = body

    // THE ONE OWNERSHIP CHECK, ONCE, FOR EVERY BRANCH BELOW. Through `authed.db`, so another
    // company's document is simply absent; 404 rather than 403 so ids cannot be probed.
    const { data: doc } = await db
      .from('documents').select('id, company_id, version_of').eq('id', documentId).maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    switch (action) {
      // -----------------------------------------------------------------------
      // "Not right? Change what this is."
      // -----------------------------------------------------------------------
      case 'correct': {
        const { field, old_value: oldValue, new_value: newValue, reason } = body
        if (!CORRECTABLE.includes(field)) {
          return NextResponse.json({ error: `"${field}" is not something you can correct here.` }, { status: 400 })
        }
        if (field === 'kind' && !SCAN_KINDS.includes(String(newValue))) {
          return NextResponse.json({ error: `"${newValue}" is not a kind of document.` }, { status: 400 })
        }
        // A site must be one of THIS company's entities — a uuid from a body naming another
        // company's plant is exactly the shape §3.6 exists to refuse.
        if (field === 'site' && newValue) {
          const { data: site } = await db.from('entities').select('id').eq('id', newValue).maybeSingle()
          if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }
        const { error } = await supabaseAdmin.from('document_corrections').insert({
          document_id: documentId, company_id: companyId, field,
          old_value: oldValue ?? null, new_value: newValue ?? null,
          reason: reason ? String(reason).slice(0, 2000) : null,
          created_by: userId,
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // -----------------------------------------------------------------------
      // "Not right" on a gap. Closed, never deleted, with the reason on the row.
      // -----------------------------------------------------------------------
      case 'dismiss_gap': {
        const { gap_id: gapId, reason } = body
        if (!gapId) return NextResponse.json({ error: 'Missing gap_id.' }, { status: 400 })
        // A REASON IS REQUIRED. "Doesn't apply" with no sentence is how a real finding gets
        // buried; the reason is what the NEXT scan is shown so it does not raise it again.
        if (!reason || !String(reason).trim()) {
          return NextResponse.json({ error: 'Please say why this is not right.' }, { status: 400 })
        }
        const { data: gap } = await db.from('document_gaps')
          .select('id, document_id').eq('id', gapId).maybeSingle()
        if (!gap || gap.document_id !== documentId) {
          return NextResponse.json({ error: 'Gap not found' }, { status: 404 })
        }
        const { error } = await supabaseAdmin.from('document_gaps')
          .update({ status: 'dismissed', dismissed_reason: String(reason).slice(0, 2000) })
          .eq('id', gapId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // -----------------------------------------------------------------------
      // Confirm or reject a proposed fact. §108: nothing about a company is written silently.
      // -----------------------------------------------------------------------
      case 'fact': {
        const { fact_id: factId, verdict, reason } = body
        if (!factId || !['accepted', 'rejected'].includes(verdict)) {
          return NextResponse.json({ error: 'Expected a fact_id and a verdict.' }, { status: 400 })
        }
        if (verdict === 'rejected' && !String(reason ?? '').trim()) {
          return NextResponse.json({ error: 'Please say why this is not right.' }, { status: 400 })
        }
        const { data: fact } = await db.from('fact_proposals')
          .select('id, document_id').eq('id', factId).maybeSingle()
        if (!fact || fact.document_id !== documentId) {
          return NextResponse.json({ error: 'Fact not found' }, { status: 404 })
        }
        const { error } = await supabaseAdmin.from('fact_proposals')
          .update({ status: verdict, ...(reason ? { rejected_reason: String(reason).slice(0, 2000) } : {}) })
          .eq('id', factId)
        if (error) throw error
        // WHERE AN ACCEPTED FACT GOES NEXT IS RUN 5. It changes state here and nothing else
        // reads it yet, which is stated rather than implied so nobody assumes it landed.
        return NextResponse.json({ ok: true })
      }

      // -----------------------------------------------------------------------
      // "Add to calendar" on a deadline.
      // -----------------------------------------------------------------------
      case 'deadline_to_calendar': {
        const { deadline_id: deadlineId } = body
        if (!deadlineId) return NextResponse.json({ error: 'Missing deadline_id.' }, { status: 400 })
        const { data: dl } = await db.from('document_deadlines')
          .select('id, document_id, title, due_on, source_line, recurs, calendar_event_id')
          .eq('id', deadlineId).maybeSingle()
        if (!dl || dl.document_id !== documentId) {
          return NextResponse.json({ error: 'Deadline not found' }, { status: 404 })
        }
        if (dl.calendar_event_id) return NextResponse.json({ ok: true, already: true })
        if (!dl.due_on) {
          return NextResponse.json({ error: 'That deadline has no date to add.' }, { status: 400 })
        }
        const { data: event, error: evErr } = await db.from('calendar_events').insert({
          company_id: companyId, user_id: userId,
          title: dl.title, description: dl.source_line ?? null,
          due_date: dl.due_on, category: 'document',
          is_recurring: !!dl.recurs, recurrence_period: dl.recurs ? 'annually' : null,
          document_id: documentId,
        }).select('id').single()
        if (evErr) throw evErr
        const { error } = await supabaseAdmin.from('document_deadlines')
          .update({ calendar_event_id: event.id }).eq('id', deadlineId)
        if (error) throw error
        return NextResponse.json({ ok: true, calendar_event_id: event.id })
      }

      // -----------------------------------------------------------------------
      // "This is the latest" — the second answer to the freshness nudge.
      // -----------------------------------------------------------------------
      case 'confirm_latest': {
        // A TIMESTAMP, NOT A BOOLEAN. Null means nobody has answered; false would mean somebody
        // said no, which is not a thing the nudge asks.
        const { error } = await db.from('documents')
          .update({ latest_confirmed_at: new Date().toISOString() }).eq('id', documentId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // -----------------------------------------------------------------------
      // A proposed version match: "Same document" / "Not the same document?"
      // -----------------------------------------------------------------------
      case 'version': {
        const { verdict } = body
        if (!['same', 'not_same'].includes(verdict)) {
          return NextResponse.json({ error: 'Expected same or not_same.' }, { status: 400 })
        }
        const patch = verdict === 'same'
          ? { version_confirmed: true }
          // NOT deleted — the link is cleared and the document stands alone again. The older
          // document itself stays exactly where it was.
          : { version_of: null, version_confirmed: false }
        const { error } = await db.from('documents').update(patch).eq('id', documentId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      // -----------------------------------------------------------------------
      // "Open the file" — a short-lived signed URL, never a public one.
      // -----------------------------------------------------------------------
      case 'file_url': {
        const { data: full } = await db.from('documents')
          .select('file_url').eq('id', documentId).maybeSingle()
        if (!full?.file_url) {
          return NextResponse.json({ error: 'That document has no stored file.' }, { status: 404 })
        }
        const { data: signed, error } = await db.storage
          .from('company-documents').createSignedUrl(full.file_url, 120)
        if (error || !signed) {
          return NextResponse.json({ error: 'We could not open that file just now.' }, { status: 502 })
        }
        return NextResponse.json({ url: signed.signedUrl })
      }

      default:
        return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 })
    }
  } catch (error) {
    console.error('document-actions:', error)
    return NextResponse.json({ error: 'We could not save that just now.' }, { status: 500 })
  }
}
