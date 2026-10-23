/**
 * /api/stripe/webhook — THE ONE ROUTE IN THIS PRODUCT WITH NO SESSION AND NO BEARER TOKEN.
 * My Account step 17.
 *
 * *** SO THE SIGNATURE IS THE WHOLE OF THE SECURITY, AND IT IS CHECKED BEFORE ANYTHING IS READ. ***
 * `stripe.webhooks.constructEvent` verifies the `stripe-signature` header against the raw body with
 * `STRIPE_WEBHOOK_SECRET`. Until it returns, the body is a string nobody has any reason to believe:
 * not parsed, not logged, not written anywhere. A bad signature is a 400 and no row.
 *
 * *** AN UNSET SECRET REFUSES EVERY REQUEST. *** `lib/cronSecret.ts:17` makes the same argument and
 * it matters more here: `if (secret && …)` would open this route to anyone on a deploy where the
 * variable was never set, and would look exactly like a route that works.
 *
 * ---- THE RAW BODY, AND WHY THERE IS NO `bodyParser` CONFIG ---------------------------------------
 *
 * `await request.text()`, which is what Next 16's own webhook example does — this repository's copy
 * of the documentation, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/`
 * `route.md:566`, and the same page at :597: *"Notably, unlike API Routes with the Pages Router, you
 * do not need to use `bodyParser` to use any additional configuration."* Signature verification
 * needs the bytes Stripe signed, so `request.json()` here would break it in a way that only shows
 * up as "invalid signature" and sends you looking at the secret.
 *
 * `runtime = 'nodejs'` because the SDK's verification uses Node's crypto.
 *
 * ---- WHY THERE IS SO LITTLE IN THIS FILE --------------------------------------------------------
 *
 * Everything the event DOES is `lib/stripeWebhook.ts`, behind a port for the one Stripe read it
 * makes. That is what lets the whole mapping — idempotency, the company lookup, the grace anchor,
 * the column writes — be exercised from a test with no card, no Stripe CLI and no network.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth'
import { getStripe, stripeWebhookSecret, StripeNotConfigured } from '@/lib/stripe'
import { receiveStripeEvent, realStripePort } from '@/lib/stripeWebhook'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let secret: string
  let stripe: ReturnType<typeof getStripe>
  try {
    secret = stripeWebhookSecret()
    stripe = getStripe()
  } catch (error) {
    if (error instanceof StripeNotConfigured) {
      // Refuse, loudly, and do not touch the body. 500 rather than 503 so Stripe retries: the
      // events are real and a variable will be set.
      console.error(`[stripe/webhook] ${error.variable} is not set — every webhook is refused`)
      return NextResponse.json({ error: 'Webhooks are not configured on this server.' }, { status: 500 })
    }
    throw error
  }

  // The bytes Stripe signed. Nothing below trusts them until constructEvent has.
  const raw = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No stripe-signature header.' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret)
  } catch (error) {
    // Either somebody is posting here who is not Stripe, or the secret is the wrong one — and the
    // Stripe CLI prints a NEW secret every time `stripe listen` starts, which is the usual cause of
    // this on a laptop. Log the reason; do not echo the body back.
    const message = error instanceof Error ? error.message : String(error)
    console.error('[stripe/webhook] signature refused:', message)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  // The service role, because a webhook has no caller to act as, and because migration 087 gives
  // `authenticated` no write on any of these columns and nothing at all on `stripe_events`. The
  // scoping is by customer id inside `receiveStripeEvent`, not by a policy. §3.6.
  const result = await receiveStripeEvent({
    event,
    db: supabaseAdmin,
    port: realStripePort(stripe),
  })

  console.log(
    `[stripe/webhook] ${event.type} ${event.id} company=${result.companyId ?? 'none'} `
    + `${result.duplicate ? 'duplicate' : result.ignored ? 'ignored' : 'applied'}`
    + (result.error ? ` error=${result.error}` : '')
    + (result.written ? ` wrote=${Object.keys(result.written).join(',')}` : '')
  )

  return NextResponse.json(
    { received: true, duplicate: result.duplicate, ignored: result.ignored },
    { status: result.status }
  )
}
