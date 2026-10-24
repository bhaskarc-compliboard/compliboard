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
import { customerIdOf, subscriptionIdOfInvoice } from '../../lib/stripeWebhook.ts'
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
