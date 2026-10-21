/**
 * INVITATIONS — POST sends one, PATCH withdraws one. My Account step 7, board 2, decision 6.
 *
 * *** THE SPLIT, AND IT IS THE WHOLE DESIGN. ***
 * Everything that decides WHETHER an invitation may exist runs as the CALLER, so migration 082's
 * policies and column grants are the boundary: `invitations_insert` checks
 * `company_id = auth_company_id() and invited_by = auth.uid()`, and the column grant lets a person
 * write only `company_id, email, invited_by, expires_at`. The service role appears for exactly one
 * thing — reading the token back to put in a link — because the token is outside the person's
 * SELECT grant on purpose: **the person doing the inviting never learns the credential they sent.**
 *
 * *** `expires_at` IS NOT SENT, THOUGH THE GRANT ALLOWS IT. ***
 * The column's default is `now() + interval '7 days'` (082). Letting the database own "seven days"
 * means board 2's promise — *"the link is good for 7 days"* — has one definition, in the schema,
 * rather than one here and one there that can drift. A later step that wants a different window
 * changes the default and this route is untouched.
 */
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { renderEmail, SANDBOX_FROM, sandboxSenderRefusal } from '@/lib/email'
import { invitationEmail } from '@/lib/invitationEmail'
import {
  looksLikeEmail, BAD_EMAIL, alreadySignsIn, alreadyInvited, INVITE_FAILED,
  isLiveInvitation, personName,
} from '@/lib/peopleView'

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, userId, db } = authed.auth

  try {
    const body = await request.json().catch(() => null)
    const email = String(body?.email ?? '').trim()
    const resend = body?.resend === true

    if (!looksLikeEmail(email)) {
      return NextResponse.json({ error: BAD_EMAIL }, { status: 400 })
    }

    // ---- 1. DOES THIS ADDRESS ALREADY SIGN IN HERE? ----
    // The address is on the login, not the profile, so this is ids as the caller then addresses
    // through the admin API — `/api/people`'s reasoning, unchanged.
    const { data: profiles } = await db
      .from('profiles').select('id').eq('company_id', companyId)
    for (const p of (profiles ?? []) as Array<{ id: string }>) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id)
      if ((u?.user?.email ?? '').toLowerCase() === email.toLowerCase()) {
        return NextResponse.json({ error: alreadySignsIn(email) }, { status: 409 })
      }
    }

    // ---- 2. IS ONE ALREADY OUT? ----
    //
    // *** AND HERE IS A GAP BETWEEN THE INDEX AND THE RULE, HANDLED RATHER THAN DISCOVERED LATER. ***
    // `idx_invitations_company_email_live` (082) is partial on `accepted_at is null and cancelled_at
    // is null`. A partial index cannot reference `now()`, so an EXPIRED invitation still occupies it
    // — while `isLiveInvitation` correctly says that invitation is dead. Without this, inviting
    // somebody whose first link ran out would come back as a unique-violation 500 for a person who
    // did nothing wrong. So: an expired row blocking the way is withdrawn first, which is true as
    // well as convenient — it IS withdrawn, time withdrew it.
    const { data: blocking } = await db
      .from('invitations')
      .select('id, email, accepted_at, cancelled_at, expires_at')
      .eq('company_id', companyId)
      .is('accepted_at', null).is('cancelled_at', null)
    const now = new Date()
    const match = ((blocking ?? []) as Array<{
      id: string; email: string; accepted_at: string | null; cancelled_at: string | null; expires_at: string
    }>).find((i) => i.email.toLowerCase() === email.toLowerCase())

    if (match) {
      const live = isLiveInvitation(match, now)
      if (live && !resend) {
        return NextResponse.json({ error: alreadyInvited(email) }, { status: 409 })
      }
      // Withdrawn as the CALLER — `grant update (cancelled_at)` and `invitations_update`'s policy
      // are what permit it, and `invitations_guard_person_update` is what would refuse an
      // un-cancel. "Send the link again" is a new invitation, never an extended one, so what was
      // sent and when stays true (082's comment on `expires_at`).
      const { error: cancelErr } = await db
        .from('invitations').update({ cancelled_at: now.toISOString() }).eq('id', match.id)
      if (cancelErr) throw new Error(`withdrawing the old invitation: ${cancelErr.message}`)
    }

    // ---- 3. THE ROW, AS THE CALLER ----
    const { data: created, error: insErr } = await db
      .from('invitations')
      .insert({ company_id: companyId, email, invited_by: userId })
      .select('id, email, created_at, expires_at')
      .single()
    if (insErr || !created) {
      console.error('[/api/invitations] insert refused:', insErr?.message)
      return NextResponse.json({ error: INVITE_FAILED }, { status: 400 })
    }

    // ---- 4. THE LINK, AND ONLY NOW THE SERVICE ROLE ----
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
    // *** A LINK THAT DOES NOT WORK IS WORSE THAN NO EMAIL *** — `lib/auditNotify.ts`'s rule. An
    // invitation whose only content is a dead link is the worst possible version of this email.
    if (!appUrl) {
      await supabaseAdmin.from('invitations')
        .update({ cancelled_at: new Date().toISOString() }).eq('id', created.id)
      console.error('[/api/invitations] NEXT_PUBLIC_APP_URL is not set, so the link would be dead')
      return NextResponse.json({ error: INVITE_FAILED }, { status: 500 })
    }

    const { data: withToken } = await supabaseAdmin
      .from('invitations').select('token').eq('id', created.id).single()
    const token = withToken?.token
    if (!token) {
      await supabaseAdmin.from('invitations')
        .update({ cancelled_at: new Date().toISOString() }).eq('id', created.id)
      return NextResponse.json({ error: INVITE_FAILED }, { status: 500 })
    }

    // Who is asking, in the words the person will read. Their name, or the address they sign in
    // with — never "someone", because an email asking you to join a company must say who is asking.
    const { data: me } = await db.from('profiles').select('full_name').eq('id', userId).single()
    const { data: myLogin } = await supabaseAdmin.auth.admin.getUserById(userId)
    const inviter = personName(me?.full_name, myLogin?.user?.email)
    const { data: co } = await db.from('companies').select('name').eq('id', companyId).single()
    const company = (co?.name ?? '').trim() || 'your company'

    const mail = invitationEmail({ inviter, company, appUrl, token })
    const { html, text } = renderEmail(mail.shape)

    // The same guard the monthly email carries: on production, from the sandbox sender, nothing
    // leaves. The invitation is withdrawn rather than left live with no email behind it — an
    // invitation nobody received is an invitation that cannot be accepted, and leaving the row
    // would block the index for a colleague who then cannot be re-invited.
    const sandbox = sandboxSenderRefusal(SANDBOX_FROM, process.env.VERCEL_ENV)
    const key = process.env.RESEND_API_KEY
    if (sandbox || !key) {
      await supabaseAdmin.from('invitations')
        .update({ cancelled_at: new Date().toISOString() }).eq('id', created.id)
      console.error(`INVITATION NOT SENT: ${sandbox ?? 'RESEND_API_KEY is not set'}`)
      return NextResponse.json({ error: INVITE_FAILED }, { status: 503 })
    }

    // The To is the override on staging; who it is FOR goes in the log either way, which is how a
    // run that went to the test address is still traceable to the person it was meant for.
    const override = (process.env.NOTIFY_TEST_TO ?? '').trim()
    const to = override ? [override] : [email]
    const sent = await new Resend(key).emails.send({
      from: SANDBOX_FROM, to, subject: mail.subject, html, text,
    })
    if (sent.error) {
      await supabaseAdmin.from('invitations')
        .update({ cancelled_at: new Date().toISOString() }).eq('id', created.id)
      console.error(`[/api/invitations] Resend: ${sent.error.message}`)
      return NextResponse.json({ error: INVITE_FAILED }, { status: 502 })
    }
    console.log(`invitation: ${email} to ${company} by ${inviter}`
      + `${override ? ` (sent to ${override} instead)` : ''} — Resend id ${sent.data?.id ?? 'unknown'}`)

    // *** THE RESPONSE CARRIES NO TOKEN. *** It is in the link, in the email, and nowhere else.
    return NextResponse.json({ invitation: created, resend_id: sent.data?.id ?? null })
  } catch (error) {
    console.error('[/api/invitations] failed:', error)
    return NextResponse.json({ error: INVITE_FAILED }, { status: 500 })
  }
}

/** PATCH — withdraw one. The only column a person may change on an invitation (082). */
export async function PATCH(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    const body = await request.json().catch(() => null)
    const id = String(body?.id ?? '').trim()
    if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // As the caller. `invitations_update`'s policy scopes it and
    // `invitations_guard_person_update` refuses un-cancelling and withdrawing an accepted one —
    // its sentence is the one shown, because the database's refusal is the honest one.
    const { error } = await db
      .from('invitations')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', id).eq('company_id', companyId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[/api/invitations PATCH] failed:', error)
    return NextResponse.json({ error: 'We could not withdraw that invitation just now.' }, { status: 500 })
  }
}
