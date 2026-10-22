/**
 * POST /api/signup — THE ONLY ROUTE THAT CREATES A COMPANY. My Account step 12, decision 8.
 *
 * *** IT HOLDS THE SERVICE KEY BECAUSE THERE IS NO SESSION YET. *** That is the first of the three
 * reasons `lib/auth.ts:21`-`:24` names for using `supabaseAdmin` at all, and this route is one of
 * them by name. The caller is nobody: there is no `authenticated` role to act as, and after 083
 * `authenticated` holds no INSERT on `companies` at all. Everything below is therefore written by
 * the route's own hand, which is why the order and the undo are tested (`lib/signup.ts`).
 *
 * *** WHAT CHANGED AT STEP 12. ***
 *
 *   · FOUR FIELDS, not seven. The industry, state and city are gone from the body: a place now
 *     comes from the main site's street address through the geocoder (decisions 16, 17) and what a
 *     company does is typed on the Company tab (decision 3). `companies.industry` is a join key
 *     rather than a label, so it is not left empty either — migration 084 gives it a DEFAULT of
 *     `chemical-manufacturing` and nothing here names it. `scanResult` and `employeeCount` are
 *     gone too — the website is STORED here and read at step 13, so this route makes no model call
 *     and `companies.scan_result` is no longer written by anything.
 *   · ONE WRITE, not three. `create_company_for_login` (migration 084) inserts the company, lets
 *     `create_primary_site` make the main site and inserts the profile in a single transaction.
 *     Before this, each was its own statement with no rollback: a failure at the second or third
 *     left a login that could sign in, 404 on every page, and never be registered again
 *     (`docs/ACCOUNT-MACHINERY.md` §B3's table).
 *   · AND AN UNDO. When that transaction fails, the login this route had just made is deleted
 *     before the person is told anything, so the address they typed is free to try again. The
 *     sentence they read says which of the two happened — `lib/signupView.ts` `NOTHING_SAVED` and
 *     `UNDO_FAILED`.
 *
 * The three calls that touch the outside world are handed to `createAccount` as ports, so the order
 * and the undo are proved by a test rather than by reading this file (`tests/unit/signup.test.ts`).
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth'
import { createAccount, type SignupPorts } from '@/lib/signup'
import { NOTHING_SAVED } from '@/lib/signupView'

/**
 * The duplicate-address case, by the auth system's own error code where it gives one and by its
 * wording where it does not — `app/api/join/route.ts:134` reads the message alone, and the codes
 * are in the SDK's own list (`@supabase/auth-js` `ErrorCode`: `email_exists`,
 * `user_already_exists`). Either answer means the same thing to the person.
 */
const TAKEN_CODES = ['email_exists', 'user_already_exists']
const TAKEN_WORDS = /already|registered|exists/i

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    const ports: SignupPorts = {
      async createLogin(email, password) {
        try {
          // `email_confirm: true`, the same call `/api/join:126` makes: the trial starts the moment
          // this button is pressed (decision 8), so a person is not left outside their own account
          // waiting for a confirmation mail. Confirming the ADDRESS is what step 13's walk and the
          // monthly mail do, by arriving.
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email, password, email_confirm: true,
          })
          if (error || !data?.user) {
            const taken = TAKEN_CODES.includes(error?.code ?? '') || TAKEN_WORDS.test(error?.message ?? '')
            if (!taken) console.error('[/api/signup] createUser failed:', error?.message)
            return { problem: taken ? 'taken' : 'broken' }
          }
          return { id: data.user.id }
        } catch (err) {
          console.error('[/api/signup] createUser threw:', err)
          return { problem: 'broken' }
        }
      },

      async createCompany({ userId, companyName, website }) {
        // Migration 084. One statement, so Postgres makes it atomic; the parameter names are the
        // function's own and are checked by its self-test, because an untyped client would send a
        // misspelled one happily (`lib/auth.ts:36` builds the client without the `Database` generic).
        const { data, error } = await supabaseAdmin.rpc('create_company_for_login', {
          p_user_id: userId,
          p_company_name: companyName,
          p_website: website,
        })
        if (error || typeof data !== 'string') {
          console.error('[/api/signup] create_company_for_login failed:', error?.message ?? 'no company id returned')
          return null
        }
        return data
      },

      async deleteLogin(id) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
        if (error) console.error('[/api/signup] could not undo the login:', error.message)
        return !error
      },
    }

    const outcome = await createAccount(body ?? {}, ports)
    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error, link: outcome.link ?? null }, { status: outcome.status })
    }
    // The page signs them in with the password they just typed and lands on /dashboard. Step 14
    // moves that landing to the walk; nothing here mints a session.
    return NextResponse.json({ ok: true, email: outcome.email })
  } catch (error) {
    // Reached only before a login exists: every port above returns a value rather than throwing.
    console.error('[/api/signup] failed:', error)
    return NextResponse.json({ error: NOTHING_SAVED }, { status: 500 })
  }
}
