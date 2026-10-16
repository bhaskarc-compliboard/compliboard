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
// A date is never deleted: it is dismissed by a named person, with an optional reason, and it stays.
// (The reason was required until step 8a; the owner made it optional — `lib/calendarDates.ts` says why.) Migration
// 073 took DELETE off `authenticated` and dropped the DELETE policy, so there is nothing for a DELETE
// handler to do but fail. The old page's × button therefore fails on staging until step 7 replaces
// the page; that is recorded in `docs/HANDOFF-CODE.md` §7 as expected rather than left to be found.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { proposeDate, confirmDate, dismissDate, setPeriod, confirmMany } from '@/lib/calendarDates'

/**
 * *** THE OLD PAGE'S RECURRENCE WORDS ARE GONE — Calendar step 12. ***
 * This file carried `OLD_PERIOD_WORDS` (monthly/quarterly/annually → month/quarter/year) and
 * accepted `is_recurring`, because the 601-line page sent them. Its own comment said the map
 * would go when a step settled what POST takes; step 8b settled it and step 12 removes it.
 * **Nothing sends the old words**: `components/AddDateSheet.tsx` and `components/CalendarAsk.tsx`
 * send `recurs` and `period`, and they are the only two callers. `git show 48107ea` has the page
 * that sent them.
 */

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const dueDate = typeof body?.due_date === 'string' && body.due_date ? body.due_date : null
    const recurs = body?.recurs === true
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

    /**
     * *** THE CHAT'S OFFER IS THE ONE OTHER SOURCE THIS ROUTE ACCEPTS — Calendar step 10b,
     * decision 17. *** `source: 'rule'` means the chat found the date in a rule and a person
     * pressed the line that adds it. It is `CONFIRMED_SOURCES`, so `proposeDate` makes it
     * confirmed with that person's name on it, exactly as a typed date is: both are a person
     * saying "yes, this applies to us".
     *
     * ONLY THAT ONE EXTRA WORD. A body naming any other source — 'document', 'audit',
     * 'handbook' — is a caller claiming a MACHINE read something, and nothing a browser sends
     * may claim that. Those arrive through `lib/documentScan.ts` and `lib/auditRun.ts`.
     */
    const asRule = body?.source === 'rule'
    const sourceUrl = typeof body?.source_url === 'string' && body.source_url ? body.source_url : null
    const sourceLine = typeof body?.source_line === 'string' && body.source_line ? body.source_line : null
    if (asRule && !sourceUrl) {
      return NextResponse.json({ error: 'A date from a rule needs the page the rule was read on.' }, { status: 400 })
    }

    // A DATE A PERSON TYPED IS CONFIRMED THE MOMENT IT IS MADE (§2.6), and `proposeDate` is what
    // decides that from the source, so this route does not name a status.
    const { id, outcome } = await proposeDate(db, {
      companyId, source: asRule ? 'rule' : 'person', title, dueOn: dueDate, recurs,
      ...(asRule ? { sourceUrl, sourceLine } : {}),
      // The person's own note. NOT `sourceLine`, which is the sentence a DOCUMENT set the date in.
      description: typeof body?.description === 'string' && body.description ? body.description : null,
      documentId, entityId, addedBy: userId,
    })

    // `period` is not part of `proposeDate`'s contract — a document scan cannot say how often a date
    // repeats (decision 23), so the period is always a person's answer and is set on its own.
    const given = typeof body?.period === 'string' ? body.period : null
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

/**
 * *** GET IS GONE — Calendar step 12. ***
 *
 * It returned the BASE table, every row except withdrawn, and its last caller was the Dashboard.
 * The Dashboard now reads `calendar_v` through `liveDates` like every other reader
 * (`lib/calendarCounts.ts`), which is what stopped it showing dates a person had removed and
 * announcing days the view refuses to compute (`app/dashboard/page.tsx` has the measurement).
 * Nothing calls a GET here now — proved by grepping `app`, `components`, `lib` and `scripts` for
 * `/api/calendar'` and finding four callers, all of them POST or PATCH.
 *
 * A GET that nothing reads is not free: it is a second shape of the same question, one that
 * returned dismissed and superseded rows to anybody who asked. `git show 6ea71d3` has it.
 */

/**
 * WHAT A PERSON DOES TO A DATE: confirm it, remove it (a reason is optional since step 8a), or say
 * how often it repeats — which is refused on a date that happens once.
 *
 * `{ id, action: 'confirm' | 'dismiss' | 'period', reason?, period? }`. There is no `completed` any
 * more — decision 11: a date has passed, it is never done. The old page's tick sends the old body
 * and gets a 400 naming the actions, which is honest; step 7 replaces that page.
 *
 * *** STEP 9 ADDED TWO THINGS FOR THE QUEUE, AND NEITHER IS A NEW RULE. ***
 *   · `{ action: 'confirm', period }` — confirm a repeating date and say how often in ONE press,
 *     which is what the queue's row picker does. A period on a one-off is refused exactly as
 *     `period` refuses it, through the same function (`periodProblem`), so one call and two cannot
 *     disagree. `period` absent means "do not touch it", which is what every caller before step 9
 *     meant.
 *   · `{ action: 'confirm_many', ids: [...] }` — "Confirm all from this document". It takes IDS and
 *     not a document, because the ids are the ones the person could see when they pressed it; the
 *     reasoning is in `lib/calendarDates.ts`.
 *
 * OWNERSHIP IS PROVED AS IT ALWAYS WAS, and now in one place: each function in
 * `lib/calendarDates.ts` loads the row through `db` — the caller's own client under RLS — so another
 * company's row is simply absent and the answer is 404, never 403, so ids cannot be probed (§3.6).
 */
const ACTIONS = ['confirm', 'dismiss', 'period', 'confirm_many'] as const

export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : ''
    const action = typeof body?.action === 'string' ? body.action : ''
    if (!(ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json(
        { error: `Expected an action: ${ACTIONS.join(', ')}.` }, { status: 400 })
    }
    // `confirm_many` carries `ids`, not `id`, so the id check comes after the action is known —
    // otherwise the one action that does not take an id would always answer "Missing id".
    if (action === 'confirm_many') {
      const many = await confirmMany(db, body?.ids, userId)
      return NextResponse.json(many.json, { status: many.status })
    }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const result = action === 'confirm'
      // `undefined` and `null` are different answers here: absent is "leave the period alone",
      // and null is the queue's "I don't know yet" — confirm it and leave the period unset, so the
      // date stays in the strip with its decision-30 line instead of acquiring a frequency.
      ? await confirmDate(db, id, userId,
          'period' in (body ?? {}) ? (body.period === null ? null : String(body.period)) : undefined)
      : action === 'dismiss' ? await dismissDate(db, id, userId, String(body?.reason ?? ''))
      : await setPeriod(db, id, body?.period === null || body?.period === undefined ? null : String(body.period))
    return NextResponse.json(result.json, { status: result.status })
  } catch (error) {
    console.error('calendar PATCH:', error)
    return NextResponse.json({ error: 'We could not change that date just now.' }, { status: 500 })
  }
}
