/**
 * POST /api/account/password — CHANGE YOUR PASSWORD, HAVING PROVED YOU KNOW IT.
 *
 * *** THE WHOLE POINT OF THIS ROUTE IS THE WORD "CURRENT". ***
 * `docs/ACCOUNT-MACHINERY.md` §B2 found three ways to change a password in this product and
 * **none of them asked for the current one**. The dangerous one is not the forgotten-password
 * flow — that is recovery, and a person who has forgotten cannot supply what they forgot. It is
 * that a signed-in session was enough: a borrowed laptop, an unlocked screen, a shared machine in a
 * plant office, and whoever is sitting there can set a new password and lock the owner out of their
 * own compliance records. Board 3 says *"the current one is asked for, which it is not today"*.
 * This is that.
 *
 * *** AND IT IS CHECKED ON THE SERVER, WHICH IS WHY IT IS A ROUTE AND NOT A FORM. ***
 * A browser could call `signInWithPassword` itself and then `updateUser`, and that would look
 * identical on screen — and be worth nothing, because nothing stops a caller skipping the first
 * half. The check has to happen somewhere the caller cannot step around.
 *
 * *** NO ADMIN CLIENT. *** The current password is verified by actually signing in with it, and the
 * update is made on THAT session — so the whole operation is the person acting as themselves, and a
 * route that could set anybody's password never exists. `requireCompany` first, so an unauthenticated
 * caller cannot use this as an oracle for whether a password is right.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import {
  PASSWORD_MIN, PASSWORD_TOO_SHORT, PASSWORDS_DIFFER, WRONG_CURRENT_PASSWORD,
  PASSWORD_CHANGE_FAILED, CURRENT_PASSWORD_REQUIRED,
} from '@/lib/accountView'

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { userId } = authed.auth

  try {
    const body = await request.json().catch(() => null)
    const current = String(body?.current ?? '')
    const next = String(body?.next ?? '')
    const again = String(body?.again ?? '')

    if (!current) return NextResponse.json({ error: CURRENT_PASSWORD_REQUIRED }, { status: 400 })
    if (next.length < PASSWORD_MIN) return NextResponse.json({ error: PASSWORD_TOO_SHORT }, { status: 400 })
    if (next !== again) return NextResponse.json({ error: PASSWORDS_DIFFER }, { status: 400 })

    // The caller's own address, from the verified session — never from the body. Taking it from
    // input would turn this route into "sign in as anyone whose password you can guess".
    const { data: me } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = me?.user?.email
    if (!email) {
      console.error('[/api/account/password] no login for the session user')
      return NextResponse.json({ error: PASSWORD_CHANGE_FAILED }, { status: 500 })
    }

    // ---- THE CHECK: sign in with the current password ----
    // A fresh client, built for this request only, so the session it mints belongs to nobody else
    // and is thrown away at the end of the handler (`lib/auth.ts`'s rule about never hoisting a
    // per-request client).
    const asThem = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: signedIn, error: signInError } = await asThem.auth.signInWithPassword({
      email, password: current,
    })
    if (signInError || !signedIn?.session) {
      // One sentence, and it does not say whether the account exists or how many tries are left —
      // the caller is already authenticated as this person, so there is nothing to enumerate, and
      // there is nothing useful to add either.
      return NextResponse.json({ error: WRONG_CURRENT_PASSWORD }, { status: 403 })
    }

    // Belt and braces: the session we just minted must be the SAME person as the session that
    // called. It cannot be otherwise — the address came from `userId` — and if it ever were, this
    // would be the line that stopped a password being set on the wrong account.
    if (signedIn.user?.id !== userId) {
      console.error('[/api/account/password] the re-check signed in a different user')
      return NextResponse.json({ error: PASSWORD_CHANGE_FAILED }, { status: 500 })
    }

    // ---- THE CHANGE, ON THAT SESSION ----
    const { error: updateError } = await asThem.auth.updateUser({ password: next })
    if (updateError) {
      // Supabase refuses a password it considers weak or identical; its own sentence is the honest
      // one to pass on, because it says what to do differently.
      console.error('[/api/account/password] updateUser:', updateError.message)
      return NextResponse.json({ error: updateError.message || PASSWORD_CHANGE_FAILED }, { status: 400 })
    }

    // *** THE OTHER SESSIONS ARE LEFT ALONE, DELIBERATELY. *** Signing every device out is the
    // right answer when a password is changed because it was STOLEN, and the wrong one when it is
    // changed as housekeeping — it would sign the person out of the tab they are standing in.
    // `/forgot-password` is the flow for the stolen case. Recorded rather than left unconsidered.
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[/api/account/password] failed:', error)
    return NextResponse.json({ error: PASSWORD_CHANGE_FAILED }, { status: 500 })
  }
}
