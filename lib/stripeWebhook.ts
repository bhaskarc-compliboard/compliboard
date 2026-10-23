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
  card: CardLine | null
}

/** The one seam. */
export type StripePort = {
  /** The subscription's PRESENT state, or null if Stripe does not have it (a deleted test object). */
  readSubscription(id: string): Promise<SubscriptionFacts | null>
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
 */
export function realStripePort(stripe: Stripe): StripePort {
  return {
    async readSubscription(id: string): Promise<SubscriptionFacts | null> {
      let sub: Stripe.Subscription
      try {
        sub = await stripe.subscriptions.retrieve(id, {
          expand: ['default_payment_method', 'customer'],
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
        card: cardLineFrom(sub.default_payment_method, customer?.invoice_settings?.default_payment_method),
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

  /** Everything the present state of a subscription says, in one place. */
  const fromSubscription = async (subscriptionId: string | null) => {
    if (!subscriptionId) return {}
    const facts = await port.readSubscription(subscriptionId)
    if (!facts) return {}
    const patch: Record<string, unknown> = {
      stripe_subscription_id: facts.id,
      subscription_status: facts.status,
      current_period_end: facts.currentPeriodEnd,
    }
    // *** THE TRIAL END IS MIRRORED, NOT COMPUTED. *** Once a card exists Stripe owns this number:
    // the 48-hour floor can have moved it later than ours, and an extension typed into the Stripe
    // Dashboard moves it again. Migration 087's header is the long form of why it is a column.
    if (facts.trialEnd) patch.trial_ends_at = facts.trialEnd
    // Only written when a card actually resolved — never cleared on a shape we did not expect, or
    // a customer who does have a card would be shown as having none (§6).
    if (facts.card) {
      patch.card_brand = facts.card.brand
      patch.card_last4 = facts.card.last4
    }
    return patch
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
      return write({ subscription_status: 'canceled', stripe_subscription_id: null })
    }

    // ---- PAID: the grace is over, and the period end has moved.
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
