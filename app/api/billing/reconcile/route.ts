/**
 * /api/billing/reconcile — "I just paid and the page says I have no card." My Account step 20,
 * `DECISIONS.md` §220.
 *
 * One read from Stripe, for the caller's own company, when our mirror has a Stripe customer and no
 * subscription. The whole of what it does is `lib/stripeReconcile.ts`; the reasoning is in that
 * file's header, including why this is a READ and not a second source of truth, and why the webhook
 * wins every tie. This file is the door.
 *
 * ---- WHAT THE DOOR ITSELF HAS TO GET RIGHT ------------------------------------------------------
 *
 * *** THE COMPANY COMES FROM `requireCompany`, AND THERE IS NO BODY. ***
 * Not read, not parsed, not accepted. A route that writes billing columns as the service role and
 * takes an id from the caller would let anybody repair — or, with a bug, alter — another company's
 * mirror. §3.6: the company is derived from the verified session token and never from a client
 * parameter. The absence of a body is the strongest form of that: there is no id to pass.
 *
 * *** AND IT HOLDS `supabaseAdmin`, NAMED AS §3.6 REQUIRES. ***
 * The fifth entry on that list, beside `/api/billing/checkout` and for the same reason: migration
 * 087 leaves all nine billing columns out of `authenticated`'s UPDATE grant, and 087 §5 gives
 * `authenticated` nothing at all on `stripe_events`. So `authed.db` would be refused by the grant,
 * correctly. Every statement is scoped by the one id `requireCompany` returned.
 *
 * *** NO `requireAccess`. *** This route cannot reach a model and spends nothing
 * (`scripts/check-schema-contracts.js` check 3 computes that closure and will not list it), and
 * gating the repair of a billing mirror behind the billing gate would be circular: the company
 * most likely to need it is one the gate currently reads as read-only because the mirror is empty.
 * `/api/billing/checkout` and `/api/billing/portal` are ungated for the same reason.
 *
 * *** AND IT ANSWERS 200 FOR EVERY BUSINESS OUTCOME, INCLUDING THE ONES THAT DID NOTHING. ***
 * The page's next move is the same in all of them — draw what the mirror now says — so a 4xx would
 * only give the browser something to handle that it does not need to handle. The outcome is in the
 * body, in words, for the log and for the test. A 5xx is kept for the two cases that are genuinely
 * about this server: no Stripe key, and an exception nobody expected.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { getStripe, StripeNotConfigured } from '@/lib/stripe'
import { realStripePort } from '@/lib/stripeWebhook'
import { reconcileFromStripe, recordReconcile, didRepair } from '@/lib/stripeReconcile'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const outcome = await reconcileFromStripe({
      companyId,
      db: supabaseAdmin,
      port: realStripePort(getStripe()),
    })

    // The customer id for the record, read back rather than carried: the reconcile may have
    // written it nowhere, and a record that invents the id it was keyed on is no record.
    const { data: after } = await supabaseAdmin
      .from('companies')
      .select('stripe_customer_id')
      .eq('id', companyId)
      .maybeSingle()

    const recorded = await recordReconcile({
      companyId,
      customerId: after?.stripe_customer_id ?? null,
      outcome,
      db: supabaseAdmin,
    })

    console.log(
      `[billing/reconcile] company=${companyId} outcome=${outcome.kind}`
      + (outcome.kind === 'repaired' ? ` subscription=${outcome.subscriptionId}`
        + ` wrote=${Object.keys(outcome.written).join(',')}` : '')
      + (outcome.kind === 'failed' ? ` error=${outcome.error}` : '')
      + (recorded ? ' recorded' : '')
    )

    return NextResponse.json({ repaired: didRepair(outcome), outcome: outcome.kind })
  } catch (error) {
    if (error instanceof StripeNotConfigured) {
      console.error(`[billing/reconcile] ${error.variable} is not set`)
      // Nothing was changed, and the page will draw the mirror as it stands. Said as our problem
      // (§5.1), and 503 rather than 500 because a variable will be set.
      return NextResponse.json(
        { error: 'Card payment is not set up on this server yet. Nothing was changed.' },
        { status: 503 }
      )
    }
    console.error('[billing/reconcile]', error)
    return NextResponse.json(
      { error: "We couldn't check your subscription with Stripe just now. Nothing was changed." },
      { status: 500 }
    )
  }
}
