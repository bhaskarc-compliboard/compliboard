// THE SUBSCRIPTION FEED — Calendar step 8b part 3 (decision 20, board 11; `DECISIONS.md` §193).
//
//   GET /api/calendar/feed?t=<token>  →  text/calendar for exactly one company
//
// *** THIS IS THE ONE ROUTE IN THE PRODUCT WITH NO SESSION, AND THAT IS BY DESIGN. ***
// Google Calendar and Outlook fetch a subscribed calendar from their own servers, on their own
// schedule, carrying nothing of the person: no cookie, no bearer token, no origin. So the address
// itself has to be the credential, which is what migration 073's comment on
// `calendar_feed_tokens` already says. Everything below exists to make that one fact safe.
//
// 1. NO SESSION — `requireCompany()` is not called and no header is read but the query string.
// 2. SERVICE ROLE, FOR TWO NAMED READS AND NO WRITE. There is no `auth.uid()`, so RLS has nothing
//    to work with (`CLAUDE.md` §3.6's named-statement exception). The two statements are below.
// 3. THE COMPANY COMES FROM THE TOKEN ROW, NEVER FROM THE QUERY STRING. §3.6's rule — the tenant
//    is derived from the credential and never from a client parameter — with the token standing in
//    for the session. There is no other parameter this route reads.
// 4. 404, EMPTY, FOR EVERYTHING ELSE. No `t`, a malformed `t`, an unknown `t`, a revoked `t`, a
//    token whose company has been deleted: all identical, never 403, never a sentence naming which.
//    That is `lib/jobAuth.ts` `requireCronSecret`'s own policy — "loud in the log, opaque to the
//    caller" — and the reason is §3.6's: a different answer for "exists but revoked" is an oracle.
// 5. THE TOKEN IS NEVER LOGGED. A refusal logs that it happened and nothing of the secret.
// 6. GET ONLY. No other method is exported, so Next answers 405 for them.
// 7. NO SHARED CACHE. `private, no-store` — see the headers below for what that is really for.
//
// NO RATE LIMITER, and that is a decision rather than an omission: a 256-bit token is not
// enumerable, and a limiter on an unauthenticated route is itself a lever for denying service to
// the customer whose calendar it is. If one is ever wanted it belongs in front of the app.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth'
import { buildIcs, ICS_COLUMNS } from '@/lib/calendarIcs'
import type { CalendarRow } from '@/lib/calendarView'
import { LIVE_STATUSES } from '@/lib/calendarCounts'

export const runtime = 'nodejs'
// Never prerendered and never revalidated from a cache of Next's own: this answer is different for
// every token and must be read from the database each time.
export const dynamic = 'force-dynamic'

/** One answer for every refusal. No body, so there is nothing to read differences out of. */
const NOT_FOUND = () => new NextResponse(null, { status: 404 })

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('t') ?? ''
    // Length-checked before it reaches the database: a 43-character base64url string is what this
    // route issues, and anything else is not a token of ours.
    if (!token || token.length < 20 || token.length > 200) return NOT_FOUND()

    // STATEMENT ONE — the token. `token` is UNIQUE (073), so this is one row or none.
    const { data: row, error } = await supabaseAdmin
      .from('calendar_feed_tokens')
      .select('company_id')
      .eq('token', token)
      .is('revoked_at', null)
      .maybeSingle()
    if (error) {
      console.error('calendar feed: token lookup failed')   // never the token itself
      return NOT_FOUND()
    }
    const companyId = (row as { company_id?: string } | null)?.company_id
    if (!companyId) {
      console.warn('calendar feed: refused a request with an unknown or revoked token')
      return NOT_FOUND()
    }

    // STATEMENT TWO — that company's live dates and nothing else. `company_id` is the token row's.
    // `calendar_v` already drops withdrawn rows (migration 075); these two filters are the same
    // "live" the Calendar tab and the sidebar badge use (`lib/calendarCounts.ts`).
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('calendar_v')
      .select(ICS_COLUMNS)
      .eq('company_id', companyId)
      .in('status', LIVE_STATUSES as unknown as string[])
      .is('replaced_by', null)
    if (rowsError) throw rowsError

    const { text } = buildIcs((rows ?? []) as unknown as CalendarRow[], {
      name: 'CompliBoard — compliance dates',
      now: new Date(),
    })

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="compliboard.ics"',
        // *** WHAT `no-store` IS ACTUALLY FOR HERE. *** The token is in the URL, so a cache keyed
        // on the URL could not serve one company's file to another even if it ignored this. The
        // two risks that are real are a REVOKED token still being answered out of an edge cache,
        // and a stale file after a date changes. `private` additionally forbids any shared cache
        // from storing it at all.
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    })
  } catch (err) {
    console.error('calendar feed:', err)
    // Even a server fault answers 404: a 500 here would tell a prober that the token was good.
    return NOT_FOUND()
  }
}
