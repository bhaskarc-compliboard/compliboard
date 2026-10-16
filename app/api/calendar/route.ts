// Compliance calendar: every date the product knows, in one table (migration 073).
//
// Every handler derives the company from the verified session via requireCompany(). CONVERTED OFF
// THE SERVICE-ROLE KEY (§0.9). Every query runs through `authed.db`, which acts as the caller under
// RLS, so the database enforces tenancy alongside the checks below rather than trusting them. It
// previously took company_id and user_id from a query parameter or the request body and never
// checked a session — so any caller could read another company's deadlines, write events into their
// calendar, or delete any event by id. Reference: app/api/documents/route.ts.
//
// *** NO CALENDAR LOGIC LIVES IN THIS ROUTE ANY MORE — Calendar step 5, decision 6. ***
// POST and PATCH are now three lines each over `lib/calendarDates.ts`: `proposeDate`, `confirmDate`,
// `dismissDate`, `setPeriod`. The route's job is the session, the body and the status code. Before
// this, this route and `app/api/document-actions/route.ts` each built their own row with their own
// vocabulary against a column with no CHECK (map B1), which is what one shared function ends.
//
// *** DELETE IS GONE, AND THAT IS THE POINT (decision 11). ***
// A date is never deleted: it is dismissed, with a reason, by a named person, and it stays. Migration
// 073 took DELETE off `authenticated` and dropped the DELETE policy, so there is nothing for a DELETE
// handler to do but fail. The old page's × button therefore fails on staging until step 7 replaces
// the page; that is recorded in `docs/HANDOFF-CODE.md` §7 as expected rather than left to be found.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { proposeDate, confirmDate, dismissDate, setPeriod } from '@/lib/calendarDates'

/**
 * THE OLD PAGE'S RECURRENCE WORDS, MAPPED — and ITS CALLER IS NOW GONE (Calendar step 7).
 * The old page offered monthly/quarterly/annually (:405–407 before step 7 replaced that file);
 * migration 073's `period` holds month/quarter/6 months/year/2 years. The same three-way mapping
 * the migration's backfill used (073 §2). Anything else becomes null, which means "repeats, how
 * often not known yet" (decision 23).
 *
 * *** IT IS KEPT, NOT DELETED, AND THE REASON IS NOT SENTIMENT. *** This route's whole body is
 * step 8's work — the new page's Add-a-date sheet is what will call POST — and narrowing a route's
 * accepted body is a change to its contract, not a tidy-up. `is_recurring` / `recurrence_period`
 * are still accepted; nothing on a screen sends them any more. Step 8 decides what POST takes and
 * this map goes then.
 */
const OLD_PERIOD_WORDS: Record<string, string> = { monthly: 'month', quarterly: 'quarter', annually: 'year' }

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const dueDate = typeof body?.due_date === 'string' && body.due_date ? body.due_date : null
    // `recurs` is the column's name; `is_recurring` is what the old page still sends.
    const recurs = body?.recurs === true || body?.is_recurring === true
    if (!title) return NextResponse.json({ error: 'Please give the date a name.' }, { status: 400 })
    // Migration 073's `calendar_events_date_or_recurs`, answered in words here rather than as a
    // constraint error: a one-off needs a day, a repeating date does not (decision 12).
    if (!dueDate && !recurs) {
      return NextResponse.json({ error: 'Please give a date, or say that it repeats.' }, { status: 400 })
    }

    // A site from the body is a client value and is never trusted to name a row this caller may
    // touch (§3.6). Read through `db`, which acts as the caller under RLS, so another company's site
    // simply is not there. 404 rather than 403 so ids cannot be probed.
    const entityId = typeof body?.entity_id === 'string' && body.entity_id ? body.entity_id : null
    if (entityId) {
      const { data: site } = await db.from('entities').select('id').eq('id', entityId).maybeSingle()
      if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }
    // The same rule for a document, if one is ever named here. Nothing sends it today — a document's
    // date arrives through `lib/documentScan.ts` (step 6), not through this route.
    const documentId = typeof body?.document_id === 'string' && body.document_id ? body.document_id : null
    if (documentId) {
      const { data: doc } = await db.from('documents').select('id').eq('id', documentId).maybeSingle()
      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // A DATE A PERSON TYPED IS CONFIRMED THE MOMENT IT IS MADE (§2.6), and `proposeDate` is what
    // decides that from the source, so this route does not name a status.
    const { id, outcome } = await proposeDate(db, {
      companyId, source: 'person', title, dueOn: dueDate, recurs,
      // The person's own note. NOT `sourceLine`, which is the sentence a DOCUMENT set the date in.
      description: typeof body?.description === 'string' && body.description ? body.description : null,
      documentId, entityId, addedBy: userId,
    })

    // `period` is not part of `proposeDate`'s contract — a document scan cannot say how often a date
    // repeats (decision 23), so the period is always a person's answer and is set on its own.
    const given = typeof body?.period === 'string' ? body.period
      : typeof body?.recurrence_period === 'string' ? (OLD_PERIOD_WORDS[body.recurrence_period] ?? null)
      : null
    if (recurs && given) {
      const p = await setPeriod(db, id, given)
      if (p.status !== 200) return NextResponse.json(p.json, { status: p.status })
    }

    // The row as it now stands, so the page can render it without a second request.
    const { data } = await db.from('calendar_events').select('*').eq('id', id).maybeSingle()
    return NextResponse.json({ data, outcome })
  } catch (error) {
    console.error('calendar POST:', error)
    return NextResponse.json({ error: 'We could not save that date just now.' }, { status: 500 })
  }
}

// A compliance calendar is a COMPANY asset — everyone at the company sees the same deadlines. The
// user_id parameter is gone along with company_id: it let any caller read any person's calendar, and
// it also meant two people at one company saw different deadlines, which is not what a compliance
// calendar is for.
//
// It still returns dismissed and superseded rows, because this is the raw table and the Dashboard
// and the old page both read it. The CALENDAR's own reads move to `calendar_v` with
// `status <> 'dismissed'` and `replaced_by is null` at steps 8 and 12 (§2.6).
//
// *** WITHDRAWN ROWS ARE THE ONE EXCEPTION, AND THEY ARE EXCLUDED HERE — step 6b, decision 29. ***
// Not for tidiness: a withdrawn row is a date the newest reading of the document, or the newest
// audit of the agency, no longer says. Showing it would be the product asserting something no
// reading currently supports, which is §6's named anti-pattern. `calendar_v` drops them in the
// view itself, so the Calendar and the Dashboard inherit the rule at steps 8 and 12; this route
// reads the base table and has to say it. Both readers of this route — `app/dashboard/page.tsx:64`
// and the old page's own read (:112, before step 7) — are fixed by this one line. After step 7 the
// Dashboard is the only reader of this GET: the new page reads `calendar_v` directly.
export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { data, error } = await db
      .from('calendar_events')
      .select('*')
      .eq('company_id', companyId)
      .neq('status', 'withdrawn')
      .order('due_date', { ascending: true })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

/**
 * WHAT A PERSON DOES TO A DATE: confirm it, remove it with a reason, or say how often it repeats.
 *
 * `{ id, action: 'confirm' | 'dismiss' | 'period', reason?, period? }`. There is no `completed` any
 * more — decision 11: a date has passed, it is never done. The old page's tick sends the old body
 * and gets a 400 naming the actions, which is honest; step 7 replaces that page.
 *
 * OWNERSHIP IS PROVED AS IT ALWAYS WAS, and now in one place: each function in
 * `lib/calendarDates.ts` loads the row through `db` — the caller's own client under RLS — so another
 * company's row is simply absent and the answer is 404, never 403, so ids cannot be probed (§3.6).
 */
const ACTIONS = ['confirm', 'dismiss', 'period'] as const

export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : ''
    const action = typeof body?.action === 'string' ? body.action : ''
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (!(ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json(
        { error: `Expected an action: ${ACTIONS.join(', ')}.` }, { status: 400 })
    }

    const result = action === 'confirm' ? await confirmDate(db, id, userId)
      : action === 'dismiss' ? await dismissDate(db, id, userId, String(body?.reason ?? ''))
      : await setPeriod(db, id, body?.period === null || body?.period === undefined ? null : String(body.period))
    return NextResponse.json(result.json, { status: result.status })
  } catch (error) {
    console.error('calendar PATCH:', error)
    return NextResponse.json({ error: 'We could not change that date just now.' }, { status: 500 })
  }
}
