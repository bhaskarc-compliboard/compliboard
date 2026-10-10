// THE CALENDAR'S OWN ROUTE — `docs/CALENDAR-PLAN.md` decision 8, `DECISIONS.md` §185.
//
// One door for every write to a date, around the one writer (`lib/calendarDates.ts`). Documents' report
// button, Audits' date finding, the summaries' "Add to calendar" and "Add a date" all come here, so the
// key, the state and the provenance are decided in one place rather than five.
//
// *** NO MODEL IS CALLED BY ANY METHOD HERE. *** A date is read from a document by the scan; this route
// only records what a person did about one.
//
// WHICH CLIENT WRITES WHAT: `authed.db` throughout — the caller, under RLS — because every row this
// route touches is the customer's own and `authenticated` holds SELECT, INSERT, UPDATE and DELETE on
// `calendar_events` (migration 073 read the grants back). There is no named service-role statement
// here, and that is deliberate: nothing in this route outranks the person using it.
//
// The old `/api/calendar` stays until the page is rebuilt (Job B), because the current page is its only
// caller and this route answers a different shape.
import { NextRequest, NextResponse, connection } from 'next/server'
import { requireCompany } from '@/lib/auth'
import {
  addDate, confirmDate, rejectDate, markDone, listDates, siblingsOnDay, setHowOften,
  DATE_SOURCES, type DateSource, type HowOften,
} from '@/lib/calendarDates'
import { isDayString, zoneForState } from '@/lib/calendarDate'

const HOW_OFTEN: HowOften[] = ['monthly', 'quarterly', 'yearly']

/** One sentence a non-technical person can act on, for the one failure this route can have. */
const BROKE = 'We could not save that just now. That is our side, not yours. Please try again.'

/**
 * POST — add a date.
 *
 * The STATE IS NOT TAKEN FROM THE BODY. It follows from the source, which is decision 3's whole point:
 * a document's dates arrive not-confirmed and wait for a person; a date a person pressed for — from an
 * audit, from a summary, by hand — is confirmed, because pressing it IS the confirmation. A client that
 * could name the state could confirm its own dates.
 */
export async function POST(request: NextRequest) {
  await connection()
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, userId, db } = authed.auth

  try {
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Expected a date.' }, { status: 400 })

    const source = String(body.source ?? 'hand') as DateSource
    if (!DATE_SOURCES.includes(source)) {
      return NextResponse.json({ error: 'That is not a kind of date.' }, { status: 400 })
    }
    const day = body.day ?? body.due_date ?? null
    if (day !== null && !isDayString(day)) {
      return NextResponse.json({ error: 'A date needs a day written as YYYY-MM-DD.' }, { status: 400 })
    }
    const every = body.every ?? body.repeats_every ?? null
    if (every !== null && !HOW_OFTEN.includes(every)) {
      return NextResponse.json({ error: 'A repeat is monthly, quarterly or yearly.' }, { status: 400 })
    }

    // *** EVERY ID IN THE BODY IS A CLIENT VALUE *** (§3.6). None is trusted: each is read through
    // `db`, which acts as the caller under RLS, so another company's row simply is not there. 404
    // rather than 403, so ids cannot be probed by watching which error comes back.
    const owns = async (table: string, id: unknown) => {
      if (!id) return true
      const { data } = await db.from(table).select('id').eq('id', id).maybeSingle()
      return !!data
    }
    for (const [table, id, what] of [
      ['documents', body.document_id, 'document'],
      ['document_deadlines', body.document_deadline_id, 'date'],
      ['topics', body.topic_id, 'conversation'],
      ['audit_findings', body.audit_finding_id, 'finding'],
      ['handbooks', body.handbook_id, 'handbook'],
      ['entities', body.entity_id, 'site'],
    ] as const) {
      if (!(await owns(table, id))) {
        return NextResponse.json({ error: `That ${what} was not found.` }, { status: 404 })
      }
    }

    const result = await addDate(db, {
      companyId, userId,
      source,
      title: String(body.title ?? ''),
      day,
      line: body.line ?? body.description ?? null,
      lineVerified: body.line_verified ?? null,
      // Decision 3: a reading's dates wait; a date a person pressed for is already agreed.
      state: source === 'document' ? 'not_confirmed' : 'confirmed',
      repeats: body.repeats === true || body.is_recurring === true,
      every,
      entityId: body.entity_id ?? null,
      documentId: body.document_id ?? null,
      documentDeadlineId: body.document_deadline_id ?? null,
      topicId: body.topic_id ?? null,
      auditFindingId: body.audit_finding_id ?? null,
      handbookId: body.handbook_id ?? null,
    })

    if (!result.created && result.reason === 'refused') {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // *** WHAT IS ALREADY THERE, AND WHY, IS PART OF THE ANSWER. *** A second press is not an error and
    // must not read like one: the screen says "On your calendar", or "Not right: <reason>" when a
    // person refused this exact date before (decision 6).
    const date = result.date
    const body_out: Record<string, unknown> = { date, created: result.created }
    if (!result.created) body_out.already = result.reason

    // Decision 7, the owner's answer of 9 October: NO SOFT MATCH. Other dates from the same document on
    // the same day are handed to the screen, which says what is there and lets the person decide. They
    // are never used to suppress this write — staging holds a document with two unrelated obligations
    // on one day, so a suppressing match would hide a real date.
    if (date.document_id && date.due_date) {
      const siblings = await siblingsOnDay(db, {
        companyId, documentId: date.document_id, day: date.due_date, exceptId: date.id,
      })
      if (siblings.length) {
        body_out.siblings = siblings.map((s) => ({ id: s.id, title: s.title, state: s.state }))
      }
    }
    return NextResponse.json(body_out, { status: result.created ? 200 : 200 })
  } catch (error) {
    console.error('calendar dates POST:', error)
    return NextResponse.json({ error: BROKE }, { status: 500 })
  }
}

/** PATCH — confirm, reject with a reason, or mark done (which makes the next one when it repeats). */
export async function PATCH(request: NextRequest) {
  await connection()
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, userId, db } = authed.auth

  try {
    const body = await request.json().catch(() => null)
    const id = body?.id
    const action = body?.action
    if (!id || !action) {
      return NextResponse.json({ error: 'Expected a date and an action.' }, { status: 400 })
    }

    if (action === 'confirm') {
      const day = body.day ?? undefined
      if (day !== undefined && day !== null && !isDayString(day)) {
        return NextResponse.json({ error: 'A date needs a day written as YYYY-MM-DD.' }, { status: 400 })
      }
      const every = body.every ?? undefined
      if (every !== undefined && every !== null && !HOW_OFTEN.includes(every)) {
        return NextResponse.json({ error: 'A repeat is monthly, quarterly or yearly.' }, { status: 400 })
      }
      const r = await confirmDate(db, { companyId, id, day, every })
      return r.ok ? NextResponse.json({ date: r.date })
        : NextResponse.json({ error: r.error }, { status: r.status })
    }

    if (action === 'how_often') {
      // Its own action, not a flavour of confirm: picking a period on a not-confirmed date saves the
      // period and leaves the date waiting (decision 6, the owner's point 5 in Job B).
      const every = body.every ?? null
      if (every !== null && !HOW_OFTEN.includes(every)) {
        return NextResponse.json({ error: 'A repeat is monthly, quarterly or yearly.' }, { status: 400 })
      }
      const r = await setHowOften(db, { companyId, id, every })
      return r.ok ? NextResponse.json({ date: r.date })
        : NextResponse.json({ error: r.error }, { status: r.status })
    }

    if (action === 'reject') {
      const r = await rejectDate(db, { companyId, id, reason: String(body.reason ?? '') })
      return r.ok ? NextResponse.json({ date: r.date })
        : NextResponse.json({ error: r.error }, { status: r.status })
    }

    if (action === 'done') {
      const r = await markDone(db, { companyId, userId, id })
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
      // `next` is the occurrence this tick created, or null with `why` when it could not be worked
      // out — a repeat nobody has said how often, or one with no day yet. Said, not guessed (B4).
      return NextResponse.json({ date: r.done, next: r.next, why: r.why })
    }

    return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 })
  } catch (error) {
    console.error('calendar dates PATCH:', error)
    return NextResponse.json({ error: BROKE }, { status: 500 })
  }
}

/**
 * GET — the three tabs, from one place.
 *   ?view=board       the month and the list: every date that counts as due (the database's own
 *                     `counts_as_due`, migration 073, so no caller can get decision 5's rule wrong)
 *   ?view=to_confirm  the To confirm tab: every date waiting for a person
 *   ?view=all         everything, withdrawn and rejected included, for the drawer and for Print
 */
export async function GET(request: NextRequest) {
  await connection()
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    const asked = request.nextUrl.searchParams.get('view') ?? 'board'
    const view = (['board', 'to_confirm', 'all'] as const).includes(asked as 'board')
      ? (asked as 'board' | 'to_confirm' | 'all') : 'board'
    // *** THE COMPANY'S ZONE COMES FROM THE SERVER *** (B10). The browser's own zone is the
    // traveller's, not the company's: somebody opening the calendar from a hotel in Berlin must see
    // the same "today" as the plant in Portland, because the dates are the plant's. Sent with the
    // dates rather than from a route of its own, so a screen cannot draw a day before it knows
    // which day it is. A read that fails falls back to Pacific inside `zoneForState`.
    const { data: co, error: coErr } = await db.from('companies')
      .select('state').eq('id', companyId).maybeSingle()
    if (coErr) console.error(`calendar dates: could not read the company's state: ${coErr.message}`)
    const timezone = zoneForState(co?.state)

    const dates = await listDates(db, { companyId, view })
    // The count the tab's own name carries ("To confirm (4)"), so the page does not have to fetch
    // twice to draw its own tab bar.
    const toConfirm = view === 'to_confirm' ? dates.length
      : (await listDates(db, { companyId, view: 'to_confirm' })).length
    return NextResponse.json({ dates, view, to_confirm_count: toConfirm, timezone })
  } catch (error) {
    console.error('calendar dates GET:', error)
    return NextResponse.json({ error: BROKE }, { status: 500 })
  }
}
