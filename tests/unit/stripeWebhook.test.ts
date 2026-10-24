/**
 * READING A STRIPE EVENT — the pure extractors of `lib/stripeWebhook.ts` and `lib/stripe.ts`.
 * My Account step 17.
 *
 * *** THESE THREE FUNCTIONS ARE WHERE THE API MOVED UNDER US, WHICH IS WHY THEY ARE TESTED HERE
 * AND NOT ONLY AGAINST THE SANDBOX. *** Each would have been written wrong from memory of an older
 * Stripe, each would have failed SILENTLY — a column that stays null for ever, with nothing raising
 * — and each is now pinned to a shape read out of the installed SDK's own declarations:
 *
 *   - THE INVOICE HAS NO TOP-LEVEL `subscription`. `Invoices.d.ts:645` declares
 *     `Parent { quote_details; subscription_details; type }`, and `Parent.SubscriptionDetails`
 *     carries `subscription: string | Subscription`.
 *   - THE SUBSCRIPTION HAS NO TOP-LEVEL `current_period_end`; it is on the item
 *     (`SubscriptionItems.d.ts:54`). Proved live as well, at the step 17 run: a real sandbox
 *     subscription returned `undefined` for the top-level field and `1794005208` for the item's.
 *   - A PAYMENT METHOD THAT IS NOT EXPANDED IS AN ID STRING, not a card.
 *
 * The whole route — signature, idempotency, the grace anchor, the column writes — was proved
 * against Stripe's sandbox with nothing stubbed; that run is in `DECISIONS.md` §213. This file is
 * the part that can run offline, in `npm run check`, for ever.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  customerIdOf, subscriptionIdOfInvoice, receiveStripeEvent, type SubscriptionFacts,
} from '../../lib/stripeWebhook.ts'
import { makeDb } from './fakeSupabase.ts'
import { cardLineFrom } from '../../lib/stripe.ts'

/** Only the fields each function reads; the rest of a real event is noise to it. */
const event = (object: unknown) =>
  ({ id: 'evt_1', type: 'customer.subscription.updated', data: { object } }) as never

// =================================================================================================
describe('customerIdOf — every handled event keys off the customer, so this must never miss one', () => {
// =================================================================================================

  test('the ordinary case: an id string', () => {
    assert.equal(customerIdOf(event({ customer: 'cus_123' })), 'cus_123')
  })

  test('an EXPANDED customer object, which is what `expand` produces', () => {
    assert.equal(customerIdOf(event({ customer: { id: 'cus_123', object: 'customer' } })), 'cus_123')
  })

  test('null when there is no customer to find — and that is a recordable state, not a crash', () => {
    // An event with no customer is recorded with its reason and acknowledged, so this returning
    // null must be safe rather than exceptional.
    for (const o of [{}, { customer: null }, { customer: '' }, { customer: 123 }, { customer: {} }, null]) {
      assert.equal(customerIdOf(event(o)), null, `customer ${JSON.stringify(o)} should give null`)
    }
  })
})

// =================================================================================================
describe('subscriptionIdOfInvoice — *** NOT invoice.subscription, WHICH DOES NOT EXIST ***', () => {
// =================================================================================================
  const invoice = (parent: unknown) => ({ id: 'in_1', object: 'invoice', parent }) as never

  test('parent.subscription_details.subscription, as an id string', () => {
    assert.equal(subscriptionIdOfInvoice(invoice({
      type: 'subscription_details',
      subscription_details: { subscription: 'sub_123', metadata: null },
      quote_details: null,
    })), 'sub_123')
  })

  test('...and expanded into an object', () => {
    assert.equal(subscriptionIdOfInvoice(invoice({
      type: 'subscription_details',
      subscription_details: { subscription: { id: 'sub_123', object: 'subscription' }, metadata: null },
      quote_details: null,
    })), 'sub_123')
  })

  test('an invoice that is NOT a subscription invoice is not ours to act on', () => {
    // A one-off invoice must not move this company's subscription columns.
    assert.equal(subscriptionIdOfInvoice(invoice({
      type: 'quote_details', quote_details: { quote: 'qt_1' }, subscription_details: null,
    })), null)
  })

  test('and nothing is assumed about a shape that is not there', () => {
    for (const p of [null, undefined, {}, { type: 'subscription_details', subscription_details: null },
                     { type: 'subscription_details', subscription_details: { subscription: null } },
                     { type: 'subscription_details', subscription_details: { subscription: {} } }]) {
      assert.equal(subscriptionIdOfInvoice(invoice(p)), null, `parent ${JSON.stringify(p)} should give null`)
    }
  })

  test('*** the field an older memory of this API would have reached for returns nothing ***', () => {
    // If a future SDK ever puts `subscription` back on the invoice, this test still passes and the
    // one above still describes the shape we read. The point is that THIS is not what we read.
    assert.equal(subscriptionIdOfInvoice({ id: 'in_1', object: 'invoice', subscription: 'sub_123' } as never), null)
  })
})

// =================================================================================================
describe('*** THE EXPAND LIST IS WHAT MAKES THE SECOND SOURCE READABLE AT ALL *** — §217', () => {
  // The real shapes, copied from a sandbox read at step 20. `cardLineFrom` was always correct;
  // what was wrong was what the port handed it.
  const EXPANDED_PM = { id: 'pm_1', type: 'card', card: { brand: 'visa', last4: '4242' } }
  const UNEXPANDED_PM = 'pm_1UTw6KDfr228eUmOnNnMV0Cc'

  test("with the OLD expand list, the fallback's input was an id string — so it never fired", () => {
    // `expand: ['default_payment_method', 'customer']` returns the customer, but the payment
    // method ON it stays an id. `cardLineFrom` refuses it, correctly, and the tab says
    // "No card yet" for a company that has one.
    assert.equal(cardLineFrom(null, UNEXPANDED_PM), null)
  })

  test('with the NEW expand list it is an object, and the card line appears', () => {
    assert.deepEqual(cardLineFrom(null, EXPANDED_PM), { brand: 'visa', last4: '4242' })
  })

  test('the port asks for the deep path, not just `customer`', () => {
    const src = readFileSync('lib/stripeWebhook.ts', 'utf8')
    assert.match(src, /expand: \['default_payment_method', 'customer\.invoice_settings\.default_payment_method'\]/)
    // The shallow form is the defect. If it ever comes back, the fallback is dead again and
    // nothing fails — which is why this is asserted on the string rather than left to a comment.
    assert.ok(!/expand: \['default_payment_method', 'customer'\]/.test(src),
      "the port is back to expanding `customer`, so the card-line fallback cannot fire")
  })

  test('the subscription source still wins when both are readable', () => {
    assert.deepEqual(
      cardLineFrom({ type: 'card', card: { brand: 'amex', last4: '0005' } }, EXPANDED_PM),
      { brand: 'amex', last4: '0005' },
    )
  })
})

describe('cardLineFrom — a brand and four digits, and NEVER anything longer (decision 12)', () => {
// =================================================================================================
  const card = (brand: string, last4: string) =>
    ({ id: 'pm_1', object: 'payment_method', type: 'card', card: { brand, last4 } })

  test('the subscription\'s own default payment method is preferred', () => {
    assert.deepEqual(cardLineFrom(card('visa', '4242'), card('mastercard', '5555')),
      { brand: 'visa', last4: '4242' })
  })

  test('...and the customer\'s invoice_settings default is the fallback', () => {
    assert.deepEqual(cardLineFrom(null, card('mastercard', '5555')), { brand: 'mastercard', last4: '5555' })
    assert.deepEqual(cardLineFrom(undefined, card('amex', '0005')), { brand: 'amex', last4: '0005' })
  })

  test('*** AN UNEXPANDED PAYMENT METHOD IS AN ID STRING, NOT A CARD ***', () => {
    // Without `expand: ['default_payment_method']` this is all Stripe sends, and treating it as a
    // card would write the string "pm_1234…" into a column that must hold four digits.
    assert.equal(cardLineFrom('pm_1234567890', null), null)
  })

  test('a payment method that is not a card is not a card line', () => {
    assert.equal(cardLineFrom({ type: 'us_bank_account', us_bank_account: { last4: '6789' } }, null), null)
    assert.equal(cardLineFrom({ type: 'card' }, null), null)
    assert.equal(cardLineFrom({ type: 'card', card: {} }, null), null)
    assert.equal(cardLineFrom({ type: 'card', card: { brand: 'visa' } }, null), null)
    assert.equal(cardLineFrom({ type: 'card', card: { last4: '4242' } }, null), null)
  })

  test('*** AND ANYTHING THAT IS NOT EXACTLY FOUR DIGITS IS REFUSED BEFORE THE DATABASE SEES IT ***', () => {
    // Migration 087's CHECK refuses these too, and proves it by trying. This refuses them one layer
    // earlier, so a surprising value is dropped rather than raising a constraint violation inside
    // the webhook — where the failure would be a payment fact we could not record.
    for (const bad of ['4242424242424242', '424', '42424', 'visa 4242', '', '42 42', '424x']) {
      assert.equal(cardLineFrom(card('visa', bad), null), null, `last4 "${bad}" must be refused`)
    }
  })

  test('null when neither source has one — and the caller then LEAVES THE COLUMNS ALONE', () => {
    // Proved live: a real sandbox subscription with no card returned null here, and the card
    // columns stayed null rather than being cleared from a value that was correct (§6).
    assert.equal(cardLineFrom(null, null), null)
    assert.equal(cardLineFrom(undefined, undefined), null)
    assert.equal(cardLineFrom({}, 'pm_1'), null)
  })
})

/* =================================================================================================
 * THE MAPPING ITSELF — `receiveStripeEvent`, driven with a stub port and a fake database.
 *
 * Until step 20 this file tested only the pure helpers; the mapping had never been exercised. It
 * can be now because `tests/unit/resolveNextServer.mjs` lets Node load the modules at all and
 * `EventResult.written` hands back the exact patch.
 * ============================================================================================== */

describe('*** A SCHEDULED CANCELLATION IS MIRRORED, AND CLEARED — §219 ***', () => {
  const COMPANY = 'co-1'
  const facts = (over: Partial<SubscriptionFacts> = {}): SubscriptionFacts => ({
    id: 'sub_1', status: 'trialing',
    currentPeriodEnd: '2026-11-07T00:00:00.000Z',
    trialEnd: '2026-11-07T00:00:00.000Z',
    cancelAt: null, card: null, ...over,
  })
  const portOf = (f: SubscriptionFacts) => ({ readSubscription: async () => f })
  const subEvent = (type: string) => ({
    id: `evt_${Math.random().toString(36).slice(2)}`, type,
    data: { object: { id: 'sub_1', customer: 'cus_1', object: 'subscription' } },
  }) as never

  const dbWith = () => makeDb({
    companies: [{ id: COMPANY, stripe_customer_id: 'cus_1', cancel_at: null }],
    stripe_events: [],
  })

  test('cancel_at is WRITTEN when Stripe has scheduled one', async () => {
    const db = dbWith()
    const r = await receiveStripeEvent({
      event: subEvent('customer.subscription.updated'), db: db as never,
      port: portOf(facts({ cancelAt: '2026-11-07T00:00:00.000Z' })) as never,
    })
    assert.equal(r.status, 200)
    assert.equal(r.companyId, COMPANY)
    assert.equal(r.written?.cancel_at, '2026-11-07T00:00:00.000Z')
    assert.equal(db.tables.companies[0].cancel_at, '2026-11-07T00:00:00.000Z')
  })

  test('*** AND CLEARED TO NULL WHEN IT IS NOT — the "Don\'t cancel subscription" path. ***', async () => {
    // This is the half that a conditional write would have broken. `cancel_at` is null on a
    // subscription that is not cancelling, so the absence must reach the column. If it did not, a
    // person who changed their mind in the portal would read "Cancels on 7 November" for ever —
    // the same false statement about money the column exists to prevent.
    const db = dbWith()
    db.tables.companies[0].cancel_at = '2026-11-07T00:00:00.000Z'   // already cancelling
    const r = await receiveStripeEvent({
      event: subEvent('customer.subscription.updated'), db: db as never,
      port: portOf(facts({ cancelAt: null })) as never,
    })
    assert.equal(r.status, 200)
    assert.ok('cancel_at' in (r.written ?? {}), 'the patch left cancel_at out entirely, so a cleared cancellation never reaches the page')
    assert.equal(r.written?.cancel_at, null)
    assert.equal(db.tables.companies[0].cancel_at, null)
  })

  test('…on `created` as well as `updated`', async () => {
    const db = dbWith()
    const r = await receiveStripeEvent({
      event: subEvent('customer.subscription.created'), db: db as never,
      port: portOf(facts({ cancelAt: '2026-12-01T00:00:00.000Z' })) as never,
    })
    assert.equal(db.tables.companies[0].cancel_at, '2026-12-01T00:00:00.000Z')
    assert.equal(r.written?.subscription_status, 'trialing')
  })

  test('…and cleared on `deleted`, because the date has ARRIVED', async () => {
    // Leaving it set would have the tab say "Cancels on 7 November" on 8 November, beside a
    // status that already reads canceled.
    const db = dbWith()
    db.tables.companies[0].cancel_at = '2026-11-07T00:00:00.000Z'
    const r = await receiveStripeEvent({
      event: subEvent('customer.subscription.deleted'), db: db as never,
      port: portOf(facts()) as never,
    })
    assert.equal(r.written?.subscription_status, 'canceled')
    assert.equal(r.written?.stripe_subscription_id, null)
    assert.equal(r.written?.cancel_at, null)
    assert.equal(db.tables.companies[0].cancel_at, null)
  })

  test('the status is NOT changed by a scheduled cancellation — Stripe keeps trialing', async () => {
    // The finding this whole section exists for. Proved against the sandbox on 24 October:
    // setting `cancel_at_period_end` leaves `status` exactly as it was. A page reading only the
    // status cannot tell a cancelling company from a happy one.
    const db = dbWith()
    const r = await receiveStripeEvent({
      event: subEvent('customer.subscription.updated'), db: db as never,
      port: portOf(facts({ status: 'trialing', cancelAt: '2026-11-07T00:00:00.000Z' })) as never,
    })
    assert.equal(r.written?.subscription_status, 'trialing')
    assert.equal(r.written?.cancel_at, '2026-11-07T00:00:00.000Z')
  })

  test('the port reads `cancel_at`, never `canceled_at`', () => {
    const src = readFileSync('lib/stripeWebhook.ts', 'utf8')
    assert.match(src, /cancelAt: iso\(sub\.cancel_at\)/)
    // `canceled_at` is the time the button was pressed, not the end of the period — the SDK says
    // so in its own declaration. Using it would put a PAST date on the page.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/canceled_at/.test(code), 'the port reads canceled_at, which is the request time')
  })
})
