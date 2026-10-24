/**
 * /api/billing/checkout — "ADD A CARD". My Account step 17, `ACCOUNT-PLAN.md` decisions 11 and 12.
 *
 * Creates a Stripe-HOSTED Checkout session in subscription mode for the one price, and hands the
 * browser its URL. Nothing about a card touches this server at any point: decision 12 — Stripe
 * hosts the card page, and we hold no card number.
 *
 * The owner's decisions of 23 October: one plan for everyone at a company, $199 a month, monthly
 * only; coupons made in Stripe and typed by the customer on Stripe's own page
 * (`allow_promotion_codes`); a card may be added from day one and is never required to start.
 *
 * ---- WHY THIS ROUTE HOLDS `supabaseAdmin`, NAMED AS §3.6 REQUIRES ------------------------------
 *
 * It must WRITE `companies.stripe_customer_id`, and migration 087 deliberately leaves all eight
 * billing columns out of `authenticated`'s UPDATE grant — a person may read their billing state and
 * may not write it. So `authed.db` would be refused by the grant, correctly. The company is
 * identified by `requireCompany()` from the verified token and never from the body, and every
 * statement below is scoped by that one id. This is the fourth entry on §3.6's list.
 *
 * ---- AND THE CUSTOMER IS CREATED ONCE, THEN REMEMBERED FOR EVER ---------------------------------
 *
 * Written back BEFORE the session is created, on purpose. A crash between the two then leaves a
 * Stripe customer we own and can find again, rather than an orphan plus a second customer on the
 * next press. The unique partial index on `stripe_customer_id` (087 §3) is the other half: two
 * colleagues pressing at the same moment end with one 23505 and a re-read, never with two
 * customers for one company — because two companies pointing at one Stripe customer would mean one
 * card paying for another company's access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { getStripe, stripePriceId, appBaseUrl, StripeNotConfigured, checkoutSessionParams } from '@/lib/stripe'
import { trialEndFor } from '@/lib/billing'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId } = authed.auth

    // Read through the admin client because the write below needs it anyway, and because reading
    // the company twice through two different clients would be the more confusing shape.
    const { data: company, error: readError } = await supabaseAdmin
      .from('companies')
      .select('id, name, stripe_customer_id, trial_ends_at')
      .eq('id', companyId)
      .single()

    if (readError || !company) {
      return NextResponse.json(
        { error: 'We could not read your company, so we cannot start a card setup. Please try again.' },
        { status: 404 }
      )
    }

    const stripe = getStripe()
    const baseUrl = appBaseUrl()

    // ---- 1. THE CUSTOMER: the one we already have, or one made now and remembered. ----
    let customerId = company.stripe_customer_id
    if (!customerId) {
      // The email comes from the VERIFIED token's user, read through the admin client — never from
      // the request body, which is §3.6's whole point about deriving identity from the session.
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId)
      const customer = await stripe.customers.create({
        email: user?.user?.email ?? undefined,
        name: company.name ?? undefined,
        // Belt and braces for the webhook. It keys off the customer id, but if that lookup ever
        // fails, the event still carries the answer on the object itself.
        metadata: { company_id: companyId },
      })
      customerId = customer.id

      const { error: writeError } = await supabaseAdmin
        .from('companies')
        .update({ stripe_customer_id: customerId })
        .eq('id', companyId)
        // Only if it is still null. A colleague who pressed at the same moment may have won; this
        // turns the race into a no-op rather than an overwrite.
        .is('stripe_customer_id', null)

      if (writeError) {
        // The unique index did its job, or something else refused. Re-read and use whichever
        // customer actually landed, rather than creating a second one.
        const { data: again } = await supabaseAdmin
          .from('companies').select('stripe_customer_id').eq('id', companyId).single()
        if (!again?.stripe_customer_id) {
          return NextResponse.json(
            { error: 'We could not save your Stripe customer, so the card page was not opened. Please try again.' },
            { status: 500 }
          )
        }
        customerId = again.stripe_customer_id
      } else {
        // The update may have matched zero rows (the `.is` filter), which is not an error. Read
        // back what is actually there, so the session is created against the remembered customer.
        const { data: again } = await supabaseAdmin
          .from('companies').select('stripe_customer_id').eq('id', companyId).single()
        if (again?.stripe_customer_id) customerId = again.stripe_customer_id
      }
    }

    // ---- 2. THE TRIAL WE TELL STRIPE ABOUT — three cases, and the 48-hour floor. ----
    // `lib/billing.ts` owns the arithmetic and is unit-tested across all three; this route only
    // applies it. The case is logged because a run has to be readable back against the rule.
    const trial = trialEndFor(company.trial_ends_at, new Date())
    console.log(
      `[billing/checkout] company=${companyId} trial_ends_at=${company.trial_ends_at} `
      + `case=${trial.case} trial_end=${trial.trialEnd ?? 'none'}`
    )

    // ---- 3. THE SESSION. ----
    const session = await stripe.checkout.sessions.create(
      checkoutSessionParams({
        customerId, priceId: stripePriceId(), companyId, trialEnd: trial.trialEnd, baseUrl }))

    if (!session.url) {
      // Stripe returned a session with nowhere to send the person. Say so plainly rather than
      // navigating the browser to `undefined` (§5.1).
      return NextResponse.json(
        { error: 'Stripe did not return a card page for this session. Nothing was charged. Please try again.' },
        { status: 502 }
      )
    }

    // The browser navigates to this. The route does not 303 itself: the Billing tab calls it with
    // `fetch`, and a redirect would be followed by the fetch rather than by the window.
    return NextResponse.json({ url: session.url, trialCase: trial.case })
  } catch (error) {
    if (error instanceof StripeNotConfigured) {
      console.error(`[billing/checkout] ${error.variable} is not set`)
      return NextResponse.json(
        { error: 'Card payment is not set up on this server yet. Nothing was charged.' },
        { status: 503 }
      )
    }
    console.error('[billing/checkout]', error)
    return NextResponse.json(
      { error: 'We could not open the card page. Nothing was charged. Please try again.' },
      { status: 500 }
    )
  }
}
