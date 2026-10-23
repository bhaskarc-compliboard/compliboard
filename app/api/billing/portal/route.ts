/**
 * /api/billing/portal — "MANAGE BILLING". My Account step 17, `ACCOUNT-PLAN.md` decision 12.
 *
 * A Stripe-hosted Billing Portal session, and nothing else. This one route IS "change the card",
 * "see my invoices" and — the one that matters for `lib/accountView.ts`'s Cancel tab — "stop
 * paying". Stripe hosts all of it, so there is no cancel route for us to build, no card form, and
 * no card number anywhere near this server.
 *
 * *** THE PORTAL NEEDS A CONFIGURATION SAVED IN THE DASHBOARD, ONCE PER MODE. ***
 * No `configuration` is passed, so the session uses the account's DEFAULT one
 * (`docs.stripe.com/api/customer_portal/sessions/create`, read 23 October 2026). The configuration
 * object carries `livemode`, so test and live are separate records and the settings must be saved
 * in each. The owner saved the sandbox's default on 23 October; live mode is on step 20's list.
 *
 * `supabaseAdmin` is NOT used here: this route only READS, and a person may read their own billing
 * columns (migration 087 leaves `authenticated`'s table-wide SELECT on `companies` intact, which is
 * also what lets `/api/account` draw the Billing tab). So it runs on `authed.db`, under RLS, which
 * fails closed if its scoping is wrong — §3.6's preference, and there is no reason to depart from it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { getStripe, appBaseUrl, StripeNotConfigured } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { data: company } = await db
      .from('companies')
      .select('stripe_customer_id')
      .eq('id', companyId)
      .single()

    if (!company?.stripe_customer_id) {
      // There is nothing to manage yet, and that is not a failure the person caused — they simply
      // have not added a card. Say the true thing and name what they can do (§5.1).
      return NextResponse.json(
        { error: 'There is no card on file yet, so there is nothing to manage. Add a card first.' },
        { status: 409 }
      )
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: `${appBaseUrl()}/account?tab=billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    if (error instanceof StripeNotConfigured) {
      console.error(`[billing/portal] ${error.variable} is not set`)
      return NextResponse.json(
        { error: 'Card payment is not set up on this server yet.' },
        { status: 503 }
      )
    }
    console.error('[billing/portal]', error)
    return NextResponse.json(
      { error: 'We could not open the billing page. Nothing was changed. Please try again.' },
      { status: 500 }
    )
  }
}
