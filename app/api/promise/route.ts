// WHAT THE PRODUCT MAY PROMISE — Calendar B4 (`DECISIONS.md` §185b, decision 21).
//
// *** WHY THIS IS A ROUTE AND NOT A FUNCTION THE PAGE CALLS. ***
// `monthlyEmailPromised()` reads `EMAIL_FROM`, and **the browser cannot see it**: Next only inlines
// `NEXT_PUBLIC_*` into the client bundle. The calendar page, the landing page and My Account are all
// `'use client'`, so calling it there would answer `false` for ever — the sentences would stay hidden
// after the domain was verified, silently, and nobody would know why. That is the gate never opening,
// which B2 shipped with only a warning comment and the owner refused.
//
// So the answer is computed ON THE SERVER, in one place, and handed to whoever asks. One source of
// truth, no second environment variable to drift from the first.
//
// *** IT IS PUBLIC, DELIBERATELY. *** The landing page is public, so this must be. It reveals one
// boolean about which of our own features is switched on — not a secret, and nothing about any
// company. It reads no table and calls no model.
import { NextResponse } from 'next/server'
import { monthlyEmailPromised } from '@/lib/emailPromise'

export async function GET() {
  return NextResponse.json(
    { monthlyEmail: monthlyEmailPromised() },
    // A minute, so a release that sets `EMAIL_FROM` shows up quickly without every page load asking.
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}
