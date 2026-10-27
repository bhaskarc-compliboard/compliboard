/**
 * WHAT A STRIPE EVENT DOES TO A COMPANY'S ROW — the whole of it, so the route is a signature check
 * and one call. My Account step 17.
 *
 * *** THE DIRECTION IS STRIPE → US, AND NEVER THE REVERSE. *** Migration 087's header argues it:
 * there are two places that could answer "is this company paying", and only one of them is ever
 * told the truth first. Stripe is where the card is charged, the retry is attempted and the coupon
 * is applied. These columns are a copy, so a page can be drawn and `accessFor()` evaluated without
 * a network call to Stripe on every request. When the two disagree, Stripe is right and this file
 * is the bug.
 *
 * ---- IDEMPOTENCY, AND WHY IT IS STRUCTURAL RATHER THAN BOOKKEEPING ------------------------------
 *
 * Stripe retries any delivery it did not get a 2xx for, so an event can arrive twice, and events can
 * arrive OUT OF ORDER. Two defences, and the first one is the important one:
 *
 *   1. *** THE PAYLOAD'S NUMBERS ARE NOT TRUSTED. THE SUBSCRIPTION IS RE-READ FROM STRIPE AND ITS
 *      PRESENT STATE IS WRITTEN. *** So a `customer.subscription.updated` that arrives AFTER a
 *      `customer.subscription.deleted` cannot resurrect a dead subscription: both handlers converge
 *      on what Stripe says now. A payload-trusting webhook has to reason about event ordering; this
 *      one does not have to, which is a much smaller thing to get right.
 *   2. The event id is `stripe_events`' primary key, so a REPLAY is an insert conflict and a
 *      two-line exit. Cheap, and it also leaves the record §5 wants: when a customer says they were
 *      charged and the product disagrees, this table is the only evidence of what we were told.
 *
 * ---- AND THE READ IS BEHIND A PORT, WHICH IS THE ONE SEAM IN THIS FILE -------------------------
 *
 * `StripePort.readSubscription` is the only thing here that touches the network. Everything else is
 * this function, the database, and arithmetic. `realStripePort()` builds the real one; a test hands
 * in a stub and exercises every branch below without a card, a CLI or a Stripe account.
 * *** THAT PORT IS THE ONLY BOUNDARY ANY TEST OF THIS FILE STUBS. *** The signature check, the
 * event row, the company lookup, the column writes and the grace anchor are all real.
 */
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
// Relative, with the extension, the way lib/ai.ts:25 imports lib/costLedger.ts — `node --test`
// resolves no `@/` alias, and the pure extractors below are unit-tested offline.
import { cardLineFrom, type CardLine } from './stripe.ts'

/** The present state of a subscription, as the columns of migration 087 need it. */
export type SubscriptionFacts = {
  id: string
  /** Stripe's own word, verbatim and un-translated. `lib/billing.ts` decides what it MEANS. */
  status: string
  /** From `items.data[0].current_period_end` — see `readSubscriptionFacts`. ISO, or null. */
  currentPeriodEnd: string | null
  /** Stripe's `trial_end`. Once a card exists, Stripe OWNS the trial end and we mirror it. */
  trialEnd: string | null
  /**
   * Stripe's `cancel_at` — "a date in the future at which the subscription will automatically get
   * canceled" (the SDK's own words). **ISO, or null when no cancellation is scheduled**, and that
   * null is load-bearing: it is how "Don't cancel subscription" in the portal clears the mirror.
   *
   * NOT `canceled_at`, which the SDK warns is "the time of the most recent update request, not the
   * end of the subscription period" — the moment the button was pressed, of no use to anybody.
   */
  cancelAt: string | null
  card: CardLine | null
  /**
   * WHAT THE NEXT INVOICE TOTALS, from Stripe's own preview of it — migration 090.
   *
   * **`null` means we could not establish it**, which is not the same as zero: a canceled
   * subscription has no upcoming invoice and Stripe refuses the preview outright
   * (`invoice_upcoming_none`, read from the sandbox). `columnsFromFacts` therefore leaves the
   * columns alone on a null and writes a real 0, because 0 is the commonest value there is —
   * every 100%-off coupon produces one.
   */
  nextCharge: { amountCents: number; currency: string } | null
  /** The discount in the words a person reads, or `null` for "there is no discount" — which IS a
   *  fact Stripe told us, and is written as nulls. See `columnsFromFacts`. */
  discount: DiscountFacts | null
}

/**
 * THE DISCOUNT, FLATTENED TO WHAT THE BILLING TAB SAYS — migration 090.
 *
 * Every field is read straight off Stripe and translated into nothing. `duration` in particular is
 * Stripe's own word, because it is the only thing that tells `once` from `forever` — `discount.end`
 * is null for both, which is the trap §217 left open.
 */
export type DiscountFacts = {
  /** The coupon's `name` as shown to customers ("FOUNDER100"), falling back to its id. */
  name: string
  /** 100 for "100% off". Exactly one of this and `amountOffCents` is set — Stripe's own rule. */
  percentOff: number | null
  amountOffCents: number | null
  /** `forever` | `once` | `repeating`, verbatim. */
  duration: string
  /** `duration_in_months` — the "for 6 months". Null unless `repeating`. */
  months: number | null
  /** The DISCOUNT's own `end`, ISO. Set only for `repeating`; null for `once` and `forever`. */
  endsAt: string | null
}

/** The one seam. */
export type StripePort = {
  /** The subscription's PRESENT state, or null if Stripe does not have it (a deleted test object). */
  readSubscription(id: string): Promise<SubscriptionFacts | null>
  /**
   * THE CUSTOMER'S NEWEST SUBSCRIPTION ID, OR NULL IF THEY HAVE NONE — added at step 20 for
   * `lib/stripeReconcile.ts`, which has a customer and needs the subscription the webhook would
   * have told us about.
   *
   * *** IT RETURNS AN ID AND NOT FACTS, ON PURPOSE. *** The reconcile then calls
   * `readSubscription` for the flattening — the same call, the same expand list, the same
   * `cardLineFrom` — so there is one code path from a subscription to our columns and not two.
   * A `list` with its own `expand` would be a second one, and the first thing §217 D proved is
   * that an expand path can be silently unreadable.
   */
  latestSubscriptionId(customerId: string): Promise<string | null>
}

const iso = (unixSeconds: number | null | undefined): string | null =>
  typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000).toISOString() : null

/**
 * READ A SUBSCRIPTION AND FLATTEN IT TO THE FIVE FACTS WE KEEP.
 *
 * *** TWO FIELDS ARE NOT WHERE AN OLDER MEMORY OF THIS API PUTS THEM, AND BOTH WERE READ OUT OF THE
 * INSTALLED SDK'S OWN TYPES RATHER THAN RECALLED (`stripe@23.0.0`, 23 October 2026): ***
 *
 *   - THE SUBSCRIPTION HAS NO TOP-LEVEL `current_period_end`. It is on the ITEM:
 *     `node_modules/stripe/esm/resources/SubscriptionItems.d.ts:54` declares
 *     `current_period_end: number`, and `Subscriptions.d.ts` declares no such field at all.
 *     Written from memory this would have silently stored `undefined` for ever — a next-payment
 *     date that never appears, with nothing failing.
 *   - `expand: ['default_payment_method']` is what makes the card line readable at all; unexpanded
 *     it is an id string, which `cardLineFrom` correctly refuses.
 *   - *** AND THE FALLBACK NEEDED A DEEPER EXPAND THAN `'customer'`. CORRECTED 24 OCTOBER 2026. ***
 *     This asked for `['default_payment_method', 'customer']` and passed
 *     `customer.invoice_settings.default_payment_method` as the second source. Expanding
 *     `customer` returns the customer — but the payment method ON it is still an ID STRING, which
 *     `cardLineFrom` refuses exactly as it refuses the unexpanded first source. **So the fallback
 *     could never fire.** Proved against the sandbox at step 20: with the old list that field came
 *     back as `"pm_1UTw6K…"`; with `customer.invoice_settings.default_payment_method` expanded it
 *     comes back as an object, `type: 'card'`, `visa 4242`. A two-source fallback where the second
 *     source is structurally unreadable is one source wearing a comment that says two.
 */
/**
 * THE DISCOUNT, FROM WHICHEVER OF THE TWO PLACES STRIPE PUT IT — migration 090.
 *
 * Pure, and exported so `tests/unit/stripeWebhook.test.ts` can drive every shape without a network.
 * Takes the raw fields so the test hands in exactly what Stripe hands in.
 *
 * *** THE SUBSCRIPTION WINS, AND BOTH ARE READ. *** A promotion code typed at Checkout lands on the
 * SUBSCRIPTION — `subscription.discounts`, an array (read live, 27 October: `customer.discount` was
 * null on the real FOUNDER100 subscription). A coupon applied by hand in the Dashboard lands on the
 * CUSTOMER instead. Reading only one of the two would mirror "no discount" for half the ways a
 * discount can exist, and the company would be told it owes the list price.
 *
 * A discount whose coupon did not expand is **not** a discount we can describe, and returning
 * something half-filled would put a blank name in a sentence about money. It returns null, and
 * `columnsFromFacts` then writes nulls — which is honest: we would rather say "no discount known"
 * than "a discount called ''".
 */
export function discountFactsFrom(
  subscriptionDiscounts: unknown,
  customerDiscount: unknown,
): DiscountFacts | null {
  const first = Array.isArray(subscriptionDiscounts) ? subscriptionDiscounts[0] : null
  for (const d of [first, customerDiscount]) {
    const facts = asDiscount(d)
    if (facts) return facts
  }
  return null
}

/** One Discount object → the six fields, or null if it is an id string, a deleted object, or has
 *  no readable coupon on it. */
function asDiscount(d: unknown): DiscountFacts | null {
  if (!d || typeof d !== 'object') return null
  const o = d as { end?: unknown; deleted?: unknown; source?: { coupon?: unknown } }
  if (o.deleted === true) return null
  const c = o.source?.coupon
  // An unexpanded coupon is an id string, not a coupon — exactly as an unexpanded payment method
  // is not a card. See the expand list in `realStripePort`.
  if (!c || typeof c !== 'object') return null
  const coupon = c as {
    id?: unknown; name?: unknown; percent_off?: unknown
    amount_off?: unknown; duration?: unknown; duration_in_months?: unknown
  }
  if (typeof coupon.duration !== 'string' || !coupon.duration) return null
  const name = typeof coupon.name === 'string' && coupon.name
    ? coupon.name
    : typeof coupon.id === 'string' && coupon.id ? coupon.id : null
  if (!name) return null
  return {
    name,
    percentOff: typeof coupon.percent_off === 'number' ? coupon.percent_off : null,
    amountOffCents: typeof coupon.amount_off === 'number' ? coupon.amount_off : null,
    duration: coupon.duration,
    months: typeof coupon.duration_in_months === 'number' ? coupon.duration_in_months : null,
    endsAt: iso(typeof o.end === 'number' ? o.end : null),
  }
}

/**
 * WHAT STRIPE SAYS THE NEXT INVOICE TOTALS — migration 090's whole argument.
 *
 * *** IT ASKS STRIPE RATHER THAN DOING THE ARITHMETIC. *** list price × (1 − percent/100) is wrong
 * the moment tax, a credit balance, a second discount, a proration or an `amount_off` in another
 * currency is in play, and every one of those is Stripe's to compute. `invoices.createPreview`
 * returns the invoice that WILL be raised; its `total` is the figure.
 *
 * *** AND IT IS CALLED ONCE PER EVENT, NEVER PER PAGE LOAD. *** That is the difference between a
 * mirror and a proxy (§213): the webhook and the reconcile pay this round trip, the Billing tab
 * reads a column.
 *
 * `null` on a refusal, and a refusal is NORMAL rather than exceptional: a canceled subscription has
 * no upcoming invoice and Stripe says so outright — `invoice_upcoming_none`, *"You cannot preview
 * the upcoming invoice for a canceled subscription"*, read from the sandbox on 27 October. The
 * `method` is `createPreview` and not `retrieveUpcoming`, which this SDK no longer carries
 * (`node_modules/stripe/esm/resources/Invoices.d.ts:114`).
 */
async function nextChargeFrom(
  stripe: Stripe,
  sub: Stripe.Subscription,
): Promise<{ amountCents: number; currency: string } | null> {
  try {
    const preview = await stripe.invoices.createPreview({ subscription: sub.id })
    if (typeof preview.total !== 'number' || typeof preview.currency !== 'string') return null
    return { amountCents: preview.total, currency: preview.currency }
  } catch {
    // Said in the log rather than thrown: the rest of the mirror is still worth writing, and a
    // null here is a state the words already handle (§5 — never silent, never made worse).
    console.log(`[stripeWebhook] no upcoming invoice for ${sub.id}; next charge left unwritten`)
    return null
  }
}

export function realStripePort(stripe: Stripe): StripePort {
  return {
    async readSubscription(id: string): Promise<SubscriptionFacts | null> {
      let sub: Stripe.Subscription
      try {
        sub = await stripe.subscriptions.retrieve(id, {
          expand: [
            'default_payment_method', 'customer.invoice_settings.default_payment_method',
            // *** `discounts.source.coupon`, AND THE LAST LEVEL IS THE WHOLE POINT — migration 090.
            // `expand: ['discounts']` alone gives expanded Discount objects whose
            // `source.coupon` is still an ID STRING. Checked against the live FOUNDER100
            // subscription on 27 October: it came back as the bare `"f4DDuTXd"`. That is §217 D
            // again — an expand one level too shallow reads as a missing value, not as an error,
            // so the whole discount would silently mirror as "no discount".
            'discounts.source.coupon',
            // A coupon applied to the CUSTOMER in the Dashboard lands here instead. The Checkout
            // promotion code landed on the subscription (`customer.discount` was null on the real
            // one), so the subscription is read first and this is the fallback — the same
            // two-source shape as the card line above.
            'customer.discount.source.coupon',
          ],
        })
      } catch {
        return null
      }
      const item = sub.items?.data?.[0]
      const customer = typeof sub.customer === 'object' && sub.customer && !('deleted' in sub.customer)
        ? (sub.customer as Stripe.Customer)
        : null
      return {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: iso(item?.current_period_end),
        trialEnd: iso(sub.trial_end),
        // *** `sub.cancel_at` DIRECTLY, NOT `sub.cancel_at_period_end`. ***
        // Read from the sandbox on 24 October rather than assumed: setting `cancel_at_period_end`
        // POPULATES `cancel_at` with the period end, and clearing it returns `cancel_at` to null.
        // So this one field already carries both directions, and no branch on the boolean is
        // needed. It is also strictly MORE correct than the boolean would be: a cancellation can
        // be scheduled for a FIXED future date (`cancel_at: <ts>` on update), which leaves
        // `cancel_at_period_end` false while a cancellation is very much scheduled. Keying on the
        // boolean would show that company nothing at all.
        cancelAt: iso(sub.cancel_at),
        card: cardLineFrom(sub.default_payment_method, customer?.invoice_settings?.default_payment_method),
        discount: discountFactsFrom(sub.discounts, customer?.discount),
        nextCharge: await nextChargeFrom(stripe, sub),
      }
    },

    /**
     * `status: 'all'` AND `limit: 1`, AND NEITHER IS AN OPTIMISATION.
     *
     * Without `status: 'all'` the list endpoint returns only subscriptions Stripe considers
     * active — it "does not include canceled subscriptions" by default
     * (`docs.stripe.com/api/subscriptions/list`, read 27 October 2026). The reconcile must be able
     * to find a `past_due` or `incomplete` one, because a customer whose first charge failed is
     * exactly somebody whose mirror is empty and who needs the truth on the page.
     *
     * The list is newest first, so `limit: 1` is the newest one. A company has at most one
     * subscription by construction (one plan, one customer, and `checkout` reuses the customer),
     * so this is "the one" rather than a choice between several — but if there ever were two, the
     * newest is the one that decides what they are paying now.
     */
    async latestSubscriptionId(customerId: string): Promise<string | null> {
      try {
        const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 1 })
        return list.data[0]?.id ?? null
      } catch {
        return null
      }
    },
  }
}

/** Every event object we handle carries a `customer`; nothing else on them is common. */
export function customerIdOf(event: Stripe.Event): string | null {
  const o = event.data?.object as { customer?: unknown } | undefined
  if (!o) return null
  const c = o.customer
  if (typeof c === 'string' && c) return c
  if (c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string') {
    return (c as { id: string }).id
  }
  return null
}

/**
 * THE SUBSCRIPTION AN INVOICE BELONGS TO.
 *
 * *** THE INVOICE HAS NO TOP-LEVEL `subscription` EITHER. *** `Invoices.d.ts:645` declares
 * `Parent { quote_details; subscription_details; type }` and `Parent.SubscriptionDetails` carries
 * `subscription: string | Subscription`; a grep for a top-level `subscription:` field on the Invoice
 * returns nothing (read from the installed SDK, 23 October 2026). An invoice whose `parent.type` is
 * not `subscription_details` is not ours to act on — a one-off invoice, not this subscription.
 */
export function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent
  if (!parent || parent.type !== 'subscription_details') return null
  const s = parent.subscription_details?.subscription
  if (typeof s === 'string' && s) return s
  if (s && typeof s === 'object' && typeof s.id === 'string') return s.id
  return null
}

/** What `receiveStripeEvent` did, so a route can answer and a test can assert on it. */
export type EventResult = {
  status: number
  /** The company this event was applied to, or null if none could be found. */
  companyId: string | null
  /** True when the event id had already been recorded — the replay case. */
  duplicate: boolean
  /** The columns written to `companies`, for the log and the test. Null when none were. */
  written: Record<string, unknown> | null
  /** Why nothing was written, when nothing was. Also stored on the event row. */
  error: string | null
  /** True for an event type we do not handle: acknowledged, recorded, and ignored. */
  ignored: boolean
}

const HANDLED_TYPES = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
])

/**
 * RECORD THE EVENT, THEN APPLY IT.
 *
 * `db` must be the SERVICE-ROLE client: `stripe_events` gives `authenticated` and `anon` nothing at
 * all, and the eight billing columns on `companies` are outside `authenticated`'s UPDATE grant
 * (migration 087). That is §3.6's "no user session exists" case — a webhook has no caller to act
 * as — and the scoping is done here, by customer id, rather than by a policy.
 *
 * *** IT ANSWERS 200 FOR ALMOST EVERYTHING, AND THAT IS DELIBERATE. *** A 4xx or 5xx makes Stripe
 * retry. An event for a customer we cannot map will never succeed, so retrying it is noise that
 * buries the events that matter — it is recorded with its reason and acknowledged. The one thing
 * that DOES return 500 is failing to record the event at all: that is the one case where a retry is
 * exactly what we want, because the alternative is a payment fact nobody ever hears again.
 */
export async function receiveStripeEvent(args: {
  event: Stripe.Event
  db: SupabaseClient
  port: StripePort
}): Promise<EventResult> {
  const { event, db, port } = args
  const customerId = customerIdOf(event)

  // ---- 1. WHICH COMPANY? Keyed on the customer id, which every object carries. ----
  let companyId: string | null = null
  if (customerId) {
    const { data } = await db
      .from('companies').select('id').eq('stripe_customer_id', customerId).maybeSingle()
    companyId = data?.id ?? null
  }

  const noCompanyReason = !customerId
    ? 'the event carries no Stripe customer id'
    : companyId === null
      ? `no company holds Stripe customer ${customerId}`
      : null

  // ---- 2. RECORD IT. The primary key is Stripe's event id, so a replay lands here. ----
  const { error: insertError } = await db.from('stripe_events').insert({
    id: event.id,
    type: event.type,
    company_id: companyId,
    stripe_customer_id: customerId,
    payload: event as unknown as Record<string, unknown>,
    handled: false,
    error: noCompanyReason,
  })

  if (insertError) {
    // 23505 = unique_violation. We have seen this event id before, so the work is already done.
    if (insertError.code === '23505') {
      return { status: 200, companyId, duplicate: true, written: null, error: null, ignored: false }
    }
    // We could not even write down what Stripe told us. This is the one case worth a retry.
    console.error('[stripe/webhook] could not record event', event.id, insertError)
    return {
      status: 500, companyId, duplicate: false, written: null,
      error: `could not record the event: ${insertError.message}`, ignored: false,
    }
  }

  // ---- 3. An event we cannot attach to a company is recorded with its reason, and acknowledged. ----
  if (noCompanyReason || companyId === null) {
    await db.from('stripe_events').update({ handled: false }).eq('id', event.id)
    return {
      status: 200, companyId: null, duplicate: false, written: null,
      error: noCompanyReason, ignored: false,
    }
  }

  // ---- 4. An event type we do not handle: acknowledged, recorded, ignored. ----
  if (!HANDLED_TYPES.has(event.type)) {
    await db.from('stripe_events').update({ handled: true }).eq('id', event.id)
    return { status: 200, companyId, duplicate: false, written: null, error: null, ignored: true }
  }

  // ---- 5. THE COLUMNS. ----
  try {
    const written = await applyToCompany({ event, companyId, db, port })
    await db.from('stripe_events').update({ handled: true, error: null }).eq('id', event.id)
    return { status: 200, companyId, duplicate: false, written, error: null, ignored: false }
  } catch (e) {
    // A row left `handled = false` with an `error` is a payment fact we received and did not apply.
    // §5 refuses to let that go silent, and §6 is why it is a row rather than a log line.
    const message = e instanceof Error ? e.message : String(e)
    await db.from('stripe_events').update({ handled: false, error: message }).eq('id', event.id)
    console.error('[stripe/webhook] could not apply', event.type, event.id, e)
    return { status: 200, companyId, duplicate: false, written: null, error: message, ignored: false }
  }
}

/**
 * THE MAPPING FROM A SUBSCRIPTION TO OUR COLUMNS — the one copy of it.
 *
 * *** EXPORTED AT STEP 20 BECAUSE A SECOND CALLER ARRIVED, AND A SECOND COPY WOULD HAVE BEEN A
 * SECOND SOURCE OF TRUTH. *** `lib/stripeReconcile.ts` repairs a mirror that a missed webhook
 * delivery left empty. It must write exactly what the webhook writes — including the two rules
 * below, which are opposite to each other and neither of which is obvious:
 *
 *   · `trial_ends_at` is written ONLY when Stripe has one. A null there would erase our own trial.
 *   · `cancel_at` is written EVEN WHEN NULL, because the absence is a fact Stripe is telling us
 *     and it is the only way "Don't cancel subscription" reaches the page (§219).
 *   · the card line is only ever ADDED, never cleared on a shape we failed to read (§6).
 *
 * A reconcile that re-derived these would drift from the webhook the first time one of them
 * changed, and the drift would be silent and about money.
 */
export function columnsFromFacts(facts: SubscriptionFacts): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    stripe_subscription_id: facts.id,
    subscription_status: facts.status,
    current_period_end: facts.currentPeriodEnd,
  }
  // *** THE TRIAL END IS MIRRORED, NOT COMPUTED. *** Once a card exists Stripe owns this number:
  // the 48-hour floor can have moved it later than ours, and an extension typed into the Stripe
  // Dashboard moves it again. Migration 087's header is the long form of why it is a column.
  if (facts.trialEnd) patch.trial_ends_at = facts.trialEnd
  // *** WRITTEN EVEN WHEN NULL, WHICH IS THE OPPOSITE OF THE CARD RULE BELOW, ON PURPOSE. ***
  // A card line is only ever ADDED, because a shape we failed to read must not erase a card
  // somebody really has. A scheduled cancellation is the reverse: the absence is a fact Stripe
  // is telling us, and it is the only way "Don't cancel subscription" reaches the page. If this
  // were conditional, a person who changed their mind would read "Cancels on 7 November" for
  // ever — the same class of false statement about money that this whole column exists to stop.
  patch.cancel_at = facts.cancelAt

  // Only written when a card actually resolved — never cleared on a shape we did not expect, or
  // a customer who does have a card would be shown as having none (§6).
  if (facts.card) {
    patch.card_brand = facts.card.brand
    patch.card_last4 = facts.card.last4
  }

  /* ---- MIGRATION 090: WHAT THIS COMPANY PAYS. Two rules, opposite to each other. --------------
     THE DISCOUNT IS WRITTEN EVEN WHEN NULL, like `cancel_at` and for the same reason: we read the
     subscription, and "there is no discount on it" is a fact Stripe told us. It is also the only
     way REMOVING a coupon in the portal reaches the page. A conditional write would leave a
     company reading "FOUNDER100, 100% off, forever" after the coupon was taken off them — a false
     statement about money, which is the one thing this mirror exists to prevent.

     THE AMOUNT IS WRITTEN ONLY WHEN WE HAVE ONE, like the card line. `null` from
     `nextChargeFrom` does not mean "nothing to pay"; it means Stripe would not tell us — a
     canceled subscription has no upcoming invoice at all. Clearing on that would turn "you pay
     $99.50" into a blank. *** A REAL ZERO IS NOT A NULL *** and must still be written: every
     100%-off coupon produces one, and 0 is the figure the whole finding is about. */
  patch.discount_name = facts.discount?.name ?? null
  patch.discount_percent_off = facts.discount?.percentOff ?? null
  patch.discount_amount_off_cents = facts.discount?.amountOffCents ?? null
  patch.discount_duration = facts.discount?.duration ?? null
  patch.discount_months = facts.discount?.months ?? null
  patch.discount_ends_at = facts.discount?.endsAt ?? null

  if (facts.nextCharge) {
    patch.next_charge_amount_cents = facts.nextCharge.amountCents
    patch.next_charge_currency = facts.nextCharge.currency
  }
  return patch
}

/**
 * DOES STRIPE'S PRESENT STATUS MEAN THE GRACE ANCHOR IS STALE? — §222.
 *
 * `payment_failed_at` is decision 11's clock. A successful payment clears it; `accessFor` reads it
 * as "the seven days are running" and, once they are up, turns the company read_only. So an anchor
 * left under a status that says we ARE being paid will eventually lock out a paying customer —
 * which is exactly what a missed `invoice.paid` did on the owner's walk.
 *
 * *** IT IS A PREDICATE AND NOT A WRITE, ON PURPOSE. *** `lib/stripeReconcile.ts` applies it;
 * `columnsFromFacts` deliberately does not. Folding it into the shared mapping would change the
 * webhook too, and break it: a LATE `invoice.payment_failed` re-reads live state, would find
 * `active`, would have the anchor cleared by the mapping — and then that handler's
 * `.is('payment_failed_at', null)` write would MATCH and stamp a fresh anchor on somebody who had
 * already paid. The rule is shared; where it is applied is not, and the difference is load-bearing.
 */
export function clearsGraceAnchor(status: string): boolean {
  return status === 'active' || status === 'trialing'
}

/** The mapping itself. Returns what it wrote, so the caller can log it and a test can assert it. */
async function applyToCompany(args: {
  event: Stripe.Event
  companyId: string
  db: SupabaseClient
  port: StripePort
}): Promise<Record<string, unknown> | null> {
  const { event, companyId, db, port } = args
  // `Stripe.Event.data.object` is a union of every object Stripe can send, so each branch below
  // narrows it to the one it actually handles. Through `unknown`, because the union does not overlap
  // a bare record type and `tsc` is right to say so.
  const object = event.data.object as unknown

  /** Everything the present state of a subscription says — `columnsFromFacts`, above, shared
   *  verbatim with the reconcile. The read is still the port's, so a test stubs one thing. */
  const fromSubscription = async (subscriptionId: string | null) => {
    if (!subscriptionId) return {}
    const facts = await port.readSubscription(subscriptionId)
    if (!facts) return {}
    return columnsFromFacts(facts)
  }

  const write = async (patch: Record<string, unknown>) => {
    if (Object.keys(patch).length === 0) return null
    const { error } = await db.from('companies').update(patch).eq('id', companyId)
    if (error) throw new Error(`could not write the billing columns: ${error.message}`)
    return patch
  }

  switch (event.type) {
    // ---- THE TRIGGER, NOT THE SOURCE OF TRUTH. The session says WHICH subscription; the
    // subscription says what state it is in, and that is what gets written.
    case 'checkout.session.completed': {
      const s = object as unknown as Stripe.Checkout.Session
      const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id ?? null
      return write(await fromSubscription(subId))
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = object as unknown as Stripe.Subscription
      return write(await fromSubscription(sub.id))
    }

    // ---- GONE. `trial_ends_at` and `stripe_customer_id` are LEFT ALONE: the first is history, and
    // the second is how this company is recognised if they ever come back.
    case 'customer.subscription.deleted': {
      // `cancel_at` is cleared too: the scheduled end has ARRIVED, so there is no longer a future
      // date to tell anybody about. Leaving it set would have the tab say "Cancels on 7 November"
      // on 8 November, beside a status that already says canceled.
      return write({ subscription_status: 'canceled', stripe_subscription_id: null, cancel_at: null })
    }

    // ---- PAID: the grace is over, and the period end has moved.
    // The clearing is UNCONDITIONAL here and conditional in the reconcile (`clearsGraceAnchor`),
    // because this branch has an invoice in its hand saying it was paid — a stronger fact than a
    // status. See that function's header for why the two must not be merged.
    case 'invoice.paid': {
      const inv = object as unknown as Stripe.Invoice
      const patch = await fromSubscription(subscriptionIdOfInvoice(inv))
      return write({ ...patch, payment_failed_at: null })
    }

    // ---- FAILED: start the seven days, *** ONLY IF THEY ARE NOT ALREADY RUNNING. ***
    case 'invoice.payment_failed': {
      const inv = object as unknown as Stripe.Invoice
      const patch = await fromSubscription(subscriptionIdOfInvoice(inv))
      const written = await write(patch)

      // Stripe retries a failed payment several times, and each attempt fires this event. Writing
      // `now()` every time would push decision 11's deadline out on every retry, so the grace would
      // never run out. `.is(null)` makes the clock start from the FIRST failure we heard about.
      const { error } = await db
        .from('companies')
        .update({ payment_failed_at: new Date().toISOString() })
        .eq('id', companyId)
        .is('payment_failed_at', null)
      if (error) throw new Error(`could not start the grace period: ${error.message}`)

      const { data } = await db
        .from('companies').select('payment_failed_at').eq('id', companyId).single()
      return { ...(written ?? {}), payment_failed_at: data?.payment_failed_at ?? null }
    }

    default:
      return null
  }
}
