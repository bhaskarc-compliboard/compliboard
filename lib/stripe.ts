/**
 * THE ONE PLACE THE STRIPE SDK IS CONSTRUCTED, and the one place its three variables are read.
 * My Account step 17. `lib/ai.ts`'s discipline (§3.4 — one call site) applied to payments.
 *
 * Server-only. This module reads `STRIPE_SECRET_KEY` and must never be imported from a client
 * component — `tests/unit/clientImports.test.ts` holds that, in the same list as `lib/auth.ts`.
 *
 * *** AN UNSET VARIABLE REFUSES THE REQUEST. IT DOES NOT GUESS, AND IT DOES NOT PASS AN EMPTY
 * STRING TO STRIPE. *** The same argument as `lib/cronSecret.ts`: a misconfiguration's safe reading
 * is "no". The tempting `new Stripe(process.env.STRIPE_SECRET_KEY!)` at module scope has two faults
 * at once — it crashes a build that has no key, and a non-null assertion on a missing secret
 * produces a 401 from Stripe that reads like a Stripe outage rather than a missing variable. So the
 * client is built lazily, once, and every reader below names the variable it wanted.
 *
 * *** AND NO PUBLISHABLE KEY IS NEEDED AT ALL. *** With Stripe-HOSTED Checkout the server creates
 * the session and the browser is sent to `session.url`; there is no Stripe.js, no
 * `@stripe/stripe-js`, and nothing Stripe-shaped in the client bundle. A publishable key is for the
 * embedded and Elements modes, which this product does not use. `ACCOUNT-PLAN.md` decision 12 —
 * Stripe hosts the card page and the portal, and we hold no card number.
 */
import Stripe from 'stripe'

/**
 * THE API VERSION IS DELIBERATELY NOT SET.
 *
 * `stripe@23.0.0` pins `2026-09-30.endive` (`node_modules/stripe/cjs/apiVersion.js`, read 23 October
 * 2026) and its TypeScript types describe THAT version's object shapes. Passing a different
 * `apiVersion` would leave the types describing a response the account does not send — the sort of
 * disagreement `tsc` cannot see, because the string is just a string. The dependency is pinned
 * exactly (`"stripe": "23.0.0"`, not `^23.0.0`) for the same reason: an SDK that carries an API
 * version inside it must not move on an `npm install`.
 */
export const STRIPE_API_VERSION = '2026-09-30.endive'

let client: Stripe | null = null

/**
 * A plain sentence naming the variable, rather than a stack trace.
 *
 * *** `variable` IS DECLARED AND ASSIGNED, NOT A CONSTRUCTOR PARAMETER PROPERTY. ***
 * `constructor(public readonly variable: string)` is valid TypeScript and `tsc --noEmit` accepts
 * it, but Node's strip-only mode — which is what `node --test tests/unit/*.test.ts` runs on
 * (`scripts/test-guard.js:108`) — refuses it: "TypeScript parameter property is not supported in
 * strip-only mode". So the shorthand would compile, pass typecheck, and break the whole unit suite
 * the first time any test imported this file. Written out long, it runs everywhere.
 */
export class StripeNotConfigured extends Error {
  readonly variable: string
  constructor(variable: string) {
    super(`${variable} is not set, so Stripe cannot be reached. Set it and try again.`)
    this.name = 'StripeNotConfigured'
    this.variable = variable
  }
}

function required(name: string): string {
  const v = (process.env[name] ?? '').trim()
  if (!v) throw new StripeNotConfigured(name)
  return v
}

/** The SDK, built once on first use. Throws `StripeNotConfigured` if the key is absent. */
export function getStripe(): Stripe {
  if (client) return client
  client = new Stripe(required('STRIPE_SECRET_KEY'))
  return client
}

/** The one $199/month recurring price. Test mode and live mode have DIFFERENT price ids. */
export function stripePriceId(): string {
  return required('STRIPE_PRICE_ID')
}

/** The webhook signing secret. The Stripe CLI's test secret and the dashboard endpoint's live
 *  secret are different values, and the CLI prints a NEW one each time `stripe listen` starts. */
export function stripeWebhookSecret(): string {
  return required('STRIPE_WEBHOOK_SECRET')
}

/**
 * Where Stripe sends the person back to. The idiom is the one already in `lib/documentBatch.ts:167`
 * and four other files, and the refusal matters more here than anywhere else: a blank variable
 * would build `/account?tab=billing` as a relative URL, Stripe would reject it, and the error would
 * be about Stripe rather than about a variable nobody set.
 */
export function appBaseUrl(): string {
  const v = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  if (!v) throw new StripeNotConfigured('NEXT_PUBLIC_APP_URL')
  return v
}

export type CardLine = { brand: string; last4: string }

/**
 * THE ONE LINE THE BILLING TAB SHOWS ABOUT A CARD — a brand and four digits, and never a number.
 * `ACCOUNT-PLAN.md` decision 12; migration 087's CHECK on `card_last4` refuses anything else.
 *
 * *** ⚡ THE TWO SOURCES BELOW ARE A HYPOTHESIS, NOT A VERIFIED FACT, AND STEP 20 IS WHERE IT GETS
 * CHECKED. *** Stripe's documentation says what `default_payment_method` MEANS on each object —
 * "ID of the default payment method for the subscription… If neither are set, invoices will use the
 * customer's invoice_settings.default_payment_method" (`docs.stripe.com/api/subscriptions/object`,
 * read 23 October 2026) — which is where the order of preference here comes from. What it does NOT
 * say, and what was not confirmed in this step, is WHICH OF THE TWO hosted Checkout actually
 * populates when a subscription starts with a trial. So:
 *
 *   - the subscription's own `default_payment_method` is preferred, then
 *   - the customer's `invoice_settings.default_payment_method`,
 *   - and if neither resolves to a CARD, this returns null and the caller LEAVES BOTH COLUMNS
 *     ALONE rather than clearing a line that was correct.
 *
 * Returning null on an unexpected shape is the whole point: a wrong card line is a cosmetic bug, and
 * a cleared one on a customer who does have a card is a lie about their account (§6). Step 20's
 * by-hand list carries "read the real card line off a sandbox subscription and confirm which source
 * filled it"; until then nothing here is asserted as known.
 */
export function cardLineFrom(
  subscriptionDefault: unknown,
  customerDefault: unknown,
): CardLine | null {
  for (const pm of [subscriptionDefault, customerDefault]) {
    const card = asCard(pm)
    if (card) return card
  }
  return null
}

/** A PaymentMethod only counts if it is expanded AND is a card AND carries both fields. An id
 *  string is not a card, and neither is a bank account. */
function asCard(pm: unknown): CardLine | null {
  if (!pm || typeof pm !== 'object') return null
  const o = pm as { type?: unknown; card?: unknown }
  if (o.type !== 'card' || !o.card || typeof o.card !== 'object') return null
  const c = o.card as { brand?: unknown; last4?: unknown }
  if (typeof c.brand !== 'string' || !c.brand) return null
  // Four digits or nothing — the same rule the database enforces, applied before the write so a
  // surprising value is dropped here rather than raising a constraint violation in the webhook.
  if (typeof c.last4 !== 'string' || !/^[0-9]{4}$/.test(c.last4)) return null
  return { brand: c.brand, last4: c.last4 }
}


/**
 * THE CHECKOUT SESSION'S PARAMETERS, AS A VALUE — My Account step 19.
 *
 * Pulled out of `app/api/billing/checkout/route.ts` so the parameters can be ASSERTED rather than
 * matched as source text. What this object says decides whether a person is asked for a card, how
 * long they go unbilled, and where they land afterwards; a test that only grepped the route for a
 * string would pass on a line that had been commented out.
 */
export function checkoutSessionParams(opts: {
  customerId: string
  priceId: string
  companyId: string
  /** Unix seconds from `trialEndFor`, or null for no trial at all. */
  trialEnd: number | null
  baseUrl: string
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: 'subscription',
    customer: opts.customerId,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    // The owner's coupons, made in Stripe and typed by the customer on Stripe's page.
    allow_promotion_codes: true,
    // *** `always` WHENEVER A TRIAL IS BEING SENT. CORRECTED 24 OCTOBER 2026 — §217. ***
    //
    // This line read a flat `'if_required'` from step 19 until the owner's own card walk, with
    // the reasoning that a trialling session has a real charge coming on day 15 so Stripe would
    // still ask for a card. **That was wrong, and the sandbox said so:** a completed trialling
    // checkout came back `amount_total=0`, `payment_method_collection=if_required`, and the
    // customer had ZERO payment methods attached. STRIPE EVALUATES WHAT IS DUE NOW, NOT WHAT IS
    // COMING. A trial's amount due today is nothing, so `if_required` collects nothing — and the
    // person lapses on day 15 having done exactly what the product asked of them.
    //
    // So: a trial means a charge is coming, which means a card is required.
    //
    // `if_required` survives only for the case it was added for — a session with NO trial where
    // a 100%-off coupon leaves nothing to pay, so nobody is stopped at a card form to pay zero
    // (`allow_promotion_codes` is what makes that reachable).
    //
    // ⚠ THE HOLE THAT LEAVES, NAMED RATHER THAN DISCOVERED LATER: a coupon that zeroes only the
    // FIRST charge on a no-trial session also skips the card, and then month two has nothing to
    // charge. **The rule that follows is: forever coupons only.** A time-limited discount must
    // not be issued against this flow until this line knows the difference, which it cannot ask
    // Stripe at session-creation time.
    payment_method_collection: opts.trialEnd === null ? 'if_required' : 'always',
    // So a session in the Stripe dashboard can be traced back to a company by eye.
    client_reference_id: opts.companyId,
    subscription_data: {
      metadata: { company_id: opts.companyId },
      // No trial once the trial has ended: charged at once, and access comes back the same second
      // the webhook writes `active` — there is no daily job to wait for.
      ...(opts.trialEnd === null ? {} : { trial_end: opts.trialEnd }),
    },
    // Both doors lead back to the Billing tab, which is where the person started.
    success_url: `${opts.baseUrl}/account?tab=billing&card=added`,
    cancel_url: `${opts.baseUrl}/account?tab=billing`,
  }
}
