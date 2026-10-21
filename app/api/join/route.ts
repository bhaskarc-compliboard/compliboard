/**
 * /api/join — THE ONE ROUTE WITH NO SESSION. My Account step 7, decision 6.
 *
 * GET reads an invitation by its token and says whether it can be used. POST turns it into a login.
 * Both run as the SERVICE ROLE, and that is not a shortcut: the caller has no account yet, so there
 * is no `authenticated` role to act as and no policy they could satisfy. `/api/signup` holds the
 * key for the same reason and says so (`lib/auth.ts`'s list of three).
 *
 * *** THE TOKEN IS THE CREDENTIAL, SO IT IS TREATED AS ONE. ***
 *   · It arrives in the query string on GET and in the body on POST, and is never written to a log,
 *     never returned in a response, and never put in a page's HTML beyond the form that posts it.
 *   · It is checked AGAIN on POST. A GET that said "this link is good" is a statement about a
 *     moment; the thing that creates an account must satisfy itself, or a link withdrawn while
 *     somebody had the form open would still work.
 *   · 64 hex characters from `gen_random_uuid()` twice over (082) — about 244 bits, so guessing is
 *     not a threat model, and `invitations.token` carries a unique index so a lookup is exact.
 *
 * *** AND NOTHING IS LEFT HALF-MADE. *** POST does three things that can each fail: create the
 * login, create the profile, stamp `accepted_at`. If the second or third fails, the first is undone
 * before anything is said — because a login with no profile is an account that can sign in and then
 * belongs to no company, which is worse than no account at all. `CLAUDE.md` §5.1: the sentence a
 * person reads promises nothing was saved, so nothing may be saved.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth'
import {
  invitationProblem, joinProblemSentence, joinProblemLink, personName,
  JOIN_EMAIL_TAKEN, JOIN_PASSWORD_SHORT, JOIN_NAME_REQUIRED, JOIN_BROKEN, JOIN_PASSWORD_MIN,
} from '@/lib/peopleView'

/** Everything the page needs to draw the form, and nothing it does not. Never the token. */
interface JoinInvitation {
  email: string
  company: string
  inviter: string
}

/** One lookup, shared by GET and POST, so the two cannot disagree about what a token means. */
async function readInvitation(token: string) {
  const { data } = await supabaseAdmin
    .from('invitations')
    .select('id, company_id, email, invited_by, expires_at, accepted_at, cancelled_at')
    .eq('token', token)
    .maybeSingle()
  return data as {
    id: string; company_id: string; email: string; invited_by: string | null
    expires_at: string; accepted_at: string | null; cancelled_at: string | null
  } | null
}

/** Who sent it and to what, in the words the page shows. */
async function describe(inv: { company_id: string; invited_by: string | null }): Promise<{ company: string; inviter: string }> {
  const { data: co } = await supabaseAdmin
    .from('companies').select('name').eq('id', inv.company_id).maybeSingle()
  let inviter = ''
  if (inv.invited_by) {
    const { data: prof } = await supabaseAdmin
      .from('profiles').select('full_name').eq('id', inv.invited_by).maybeSingle()
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(inv.invited_by)
    inviter = personName(prof?.full_name, user?.user?.email)
  }
  return { company: (co?.name ?? '').trim() || 'this company', inviter }
}

export async function GET(request: NextRequest) {
  try {
    const token = (request.nextUrl.searchParams.get('t') ?? '').trim()
    const inv = token ? await readInvitation(token) : null
    const problem = invitationProblem(inv)

    if (problem || !inv) {
      // An unusable link still says WHO to ask where we know, which is what makes "ask them for a
      // new one" an instruction rather than a shrug. A token we cannot find tells us nothing about
      // anybody, so that one says so.
      const who = inv ? (await describe(inv)).inviter : null
      return NextResponse.json({
        ok: false,
        problem,
        message: joinProblemSentence(problem ?? 'not_found', who),
        link: joinProblemLink(problem ?? 'not_found'),
      })
    }

    const { company, inviter } = await describe(inv)
    const payload: JoinInvitation = { email: inv.email, company, inviter }
    return NextResponse.json({ ok: true, invitation: payload })
  } catch (error) {
    console.error('[/api/join GET] failed:', error)
    return NextResponse.json({
      ok: false, problem: 'not_found',
      message: joinProblemSentence('not_found', null),
      link: joinProblemLink('not_found'),
    })
  }
}

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null
  try {
    const body = await request.json().catch(() => null)
    const token = String(body?.token ?? '').trim()
    const fullName = String(body?.full_name ?? '').trim()
    const password = String(body?.password ?? '')

    // ---- THE TOKEN, CHECKED AGAIN ----
    const inv = token ? await readInvitation(token) : null
    const problem = invitationProblem(inv)
    if (problem || !inv) {
      const who = inv ? (await describe(inv)).inviter : null
      return NextResponse.json(
        { error: joinProblemSentence(problem ?? 'not_found', who) }, { status: 400 })
    }

    // ---- WHAT THE PERSON TYPED, CHECKED SERVER-SIDE TOO ----
    // The page checks the same two things. This is the one that counts: a form is a convenience and
    // a route is a boundary.
    if (!fullName) return NextResponse.json({ error: JOIN_NAME_REQUIRED }, { status: 400 })
    if (password.length < JOIN_PASSWORD_MIN) {
      return NextResponse.json({ error: JOIN_PASSWORD_SHORT }, { status: 400 })
    }

    // ---- 1. THE LOGIN ----
    // The same call `/api/signup:29` makes, with `email_confirm: true`: the invitation that reached
    // this address IS the confirmation that somebody reads it, and a second confirmation mail would
    // ask a person to prove twice what they have already proved once.
    const { data: made, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email,
      password,
      email_confirm: true,
    })
    if (authError || !made?.user) {
      // The address already has an account somewhere. Said plainly, with the way forward, rather
      // than as whatever the auth system calls it.
      const msg = (authError?.message ?? '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: JOIN_EMAIL_TAKEN, link: { label: 'Go to sign in', href: '/login' } },
          { status: 409 })
      }
      console.error('[/api/join] createUser failed:', authError?.message)
      return NextResponse.json({ error: JOIN_BROKEN }, { status: 500 })
    }
    createdUserId = made.user.id

    // ---- 2. THE PROFILE, WHICH IS WHAT PUTS THEM IN THE COMPANY ----
    // `profiles.company_id` IS the tenancy (§3.6). Until this row exists the login belongs to
    // nobody, which is why step 3 cannot be allowed to run without it.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: made.user.id, company_id: inv.company_id, full_name: fullName })
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(made.user.id)
      createdUserId = null
      console.error('[/api/join] profile insert failed:', profileError.message)
      return NextResponse.json({ error: JOIN_BROKEN }, { status: 500 })
    }

    // ---- 3. THE INVITATION IS SPENT ----
    // Stamped, never deleted: what was sent, to whom and when it was taken is the record. From here
    // the same link reads "already used" (`invitationProblem`), which is what makes it one-use.
    const { error: stampError } = await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', inv.id).is('accepted_at', null)
    if (stampError) {
      await supabaseAdmin.auth.admin.deleteUser(made.user.id)   // profiles cascades with the login
      createdUserId = null
      console.error('[/api/join] stamping accepted_at failed:', stampError.message)
      return NextResponse.json({ error: JOIN_BROKEN }, { status: 500 })
    }

    // The page signs them in with the password they just chose — the same call the login page
    // makes — so no session is minted here and no token of ours is handed to a browser.
    return NextResponse.json({ ok: true, email: inv.email })
  } catch (error) {
    if (createdUserId) {
      // The promise in JOIN_BROKEN is that nothing was saved, so an unexpected throw undoes the
      // one thing that might have been.
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {})
    }
    console.error('[/api/join POST] failed:', error)
    return NextResponse.json({ error: JOIN_BROKEN }, { status: 500 })
  }
}
