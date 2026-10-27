/**
 * THE RECONCILE — My Account step 20, `DECISIONS.md` §220.
 *
 * The defect this covers was found by a human with a card, not by a test: the owner completed a
 * real Checkout while his Stripe listener was dead, was charged $199, and was shown "No card yet".
 * These tests are what stops it coming back, and they are written against the three things that
 * could each bring it back on their own:
 *
 *   1. THE TRIGGER firing on the wrong state (too narrow and nobody is repaired; too wide and a
 *      perfectly good mirror is asked about on every page load).
 *   2. THE GUARD failing, so a reconcile could overwrite what a webhook had already written —
 *      which would make this a second source of truth rather than a read.
 *   3. AN ABSENCE being read as a fact. A customer who abandoned Checkout has no subscription at
 *      Stripe, and the page must not invent one.
 *
 * The one seam stubbed is `StripePort`, the same one `tests/unit/stripeWebhook.test.ts` stubs.
 * Everything else — the company row, the guarded update, the `stripe_events` record — is real
 * against `fakeSupabase.ts`, so "the mirror was left alone" is an assertion about state.
 */

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  reconcileFromStripe, recordReconcile, didRepair, changedFields, RECONCILE_DEADLINE_MS,
} from '../../lib/stripeReconcile.ts'
import {
  columnsFromFacts, receiveStripeEvent, type SubscriptionFacts, type StripePort,
} from '../../lib/stripeWebhook.ts'
import { reconcileTrigger, FINISHING_UP, FINISHING_STALLED } from '../../lib/billingView.ts'
import { reconcileNeeded, RECONCILE_STALE_HOURS } from '../../lib/billing.ts'
import { askAgainLine, ASK_AGAIN_LINE } from '../../lib/billing.ts'
import { makeDb } from './fakeSupabase.ts'

const CO = 'co-1'
const CUS = 'cus_1'
const SUB = 'sub_1'

const facts = (over: Partial<SubscriptionFacts> = {}): SubscriptionFacts => ({
  id: SUB,
  status: 'active',
  currentPeriodEnd: '2026-11-24T05:32:14.000Z',
  trialEnd: null,
  cancelAt: null,
  card: { brand: 'visa', last4: '4242' },
  // Migration 090: the undiscounted company pays the list price, and Stripe says so.
  discount: null,
  nextCharge: { amountCents: 19900, currency: 'usd' },
  ...over,
})

/** The nine columns as they stand when a delivery was missed: a customer, and nothing else. */
const missedDelivery = () => ({
  id: CO,
  stripe_customer_id: CUS,
  stripe_subscription_id: null,
  subscription_status: null,
  current_period_end: null,
  card_brand: null,
  card_last4: null,
  cancel_at: null,
  trial_ends_at: '2026-10-21T05:25:05.622Z',
  payment_failed_at: null,
})

/** `NOW`, and the anchor the §222 fixture carries: a day and a half old, so it is stale. */
const NOW = new Date('2026-10-29T12:00:00.000Z')
const ANCHOR = '2026-10-27T18:18:47.975Z'

/**
 * *** THE WALK'S SECOND OUTAGE, AS A ROW. ***
 * He paid, Stripe marked the invoice Paid, `invoice.paid` was never delivered. Our row still says
 * `past_due` with the grace anchor under it — and `accessFor` turns that company read_only on
 * day 8. Nothing heals it: §220's reconcile only ever filled a blank subscription id.
 */
const stalePastDue = () => ({
  ...missedDelivery(),
  stripe_subscription_id: SUB,
  subscription_status: 'past_due',
  payment_failed_at: ANCHOR,
  current_period_end: '2026-11-27T18:18:43+00:00',
  card_brand: 'visa',
  card_last4: '4242',
  next_charge_amount_cents: 19900,
  next_charge_currency: 'usd',
})

/** A port that counts its calls, so "no call was made" is a real assertion. */
function countingPort(opts: { latest?: string | null; read?: SubscriptionFacts | null } = {}) {
  const calls: string[] = []
  const port: StripePort = {
    async latestSubscriptionId(customerId) {
      calls.push(`latest:${customerId}`)
      return opts.latest === undefined ? SUB : opts.latest
    },
    async readSubscription(id) {
      calls.push(`read:${id}`)
      return opts.read === undefined ? facts() : opts.read
    },
  }
  return { port, calls }
}

// =================================================================================================
describe('THE TRIGGER IS THE STATE — §220’s three cases, and §222’s four', () => {
// =================================================================================================
  const NOW = new Date('2026-10-28T12:00:00Z')
  const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()
  /** A settled, paying company: the row that must NEVER cost a Stripe call. */
  const settled = { stripe_customer_id: CUS, stripe_subscription_id: SUB,
                    subscription_status: 'active', payment_failed_at: null }

  test('no Stripe customer → NO call. The ordinary trial, and most page loads.', () => {
    const t = reconcileTrigger({ stripe_customer_id: null, stripe_subscription_id: null }, false, NOW)
    assert.equal(t.call, false)
    assert.equal(t.say, null)
    assert.equal(t.reason, null)
  })

  test('*** A SETTLED ACTIVE ROW IS CORRECT, NOT STALE. NO CALL. ***', () => {
    // The line the whole widening turns on. "It has not changed in a while" is not a signal; a
    // paying company that nothing has happened to is simply right, and asking Stripe about it on
    // every page load would be the proxy §213 exists to avoid.
    assert.equal(reconcileTrigger(settled, false, NOW).call, false)
    assert.equal(reconcileTrigger({ ...settled, subscription_status: 'trialing' }, false, NOW).call, false)
  })

  test('a customer and NO subscription → one call — §220’s case, unchanged', () => {
    const t = reconcileTrigger({ stripe_customer_id: CUS, stripe_subscription_id: null }, false, NOW)
    assert.equal(t.call, true)
    assert.equal(t.reason, 'no_subscription_mirrored')
  })

  for (const status of ['past_due', 'unpaid', 'incomplete']) {
    test(`*** ${status} with NO anchor → one call: our mirror dropped an event ***`, () => {
      // `accessFor` already reasons exactly this in its `payment_failed_retrying` branch — it
      // gives the customer the benefit of the doubt and carries on. This goes and finds out.
      const t = reconcileTrigger({ ...settled, subscription_status: status, payment_failed_at: null }, false, NOW)
      assert.equal(t.call, true)
      assert.equal(t.reason, 'not_paying_without_anchor')
    })

    test(`${status} with a FRESH anchor → no call: Stripe told us an hour ago`, () => {
      const t = reconcileTrigger({ ...settled, subscription_status: status, payment_failed_at: hoursAgo(1) }, false, NOW)
      assert.equal(t.call, false, `a ${status} we had just been told about was questioned`)
    })

    test(`${status} with an anchor older than a day → one call`, () => {
      const t = reconcileTrigger({ ...settled, subscription_status: status, payment_failed_at: hoursAgo(25) }, false, NOW)
      assert.equal(t.call, true)
      assert.equal(t.reason, 'not_paying_unconfirmed')
    })
  }

  test('*** AN ANCHOR UNDER A PAYING STATUS — THE STATE THAT COST THE WALK. ***', () => {
    // He paid, `invoice.paid` was never delivered, the row kept its anchor. On day 8 `accessFor`
    // would have turned that paying customer read_only. This is the only signal there is.
    for (const status of ['active', 'trialing']) {
      const t = reconcileTrigger({ ...settled, subscription_status: status, payment_failed_at: hoursAgo(25) }, false, NOW)
      assert.equal(t.call, true, `${status} with a day-old anchor was not questioned`)
      assert.equal(t.reason, 'anchor_under_a_paying_status')
    }
  })

  test('…but not while the two events could still be in flight', () => {
    // `customer.subscription.updated` and `invoice.paid` can arrive a second apart in either
    // order. A reconcile racing a webhook is wasted work, not a repair.
    assert.equal(reconcileTrigger({ ...settled, payment_failed_at: hoursAgo(1) }, false, NOW).call, false)
    assert.equal(reconcileTrigger({ ...settled, payment_failed_at: hoursAgo(23) }, false, NOW).call, false)
    assert.equal(reconcileTrigger({ ...settled, payment_failed_at: hoursAgo(25) }, false, NOW).call, true)
  })

  test('`canceled` is never questioned — Stripe will not preview one at all', () => {
    // `invoice_upcoming_none`: the call could only ever come back empty-handed.
    assert.equal(reconcileTrigger({ ...settled, subscription_status: 'canceled' }, false, NOW).call, false)
    assert.equal(reconcileTrigger({ ...settled, subscription_status: 'canceled', payment_failed_at: hoursAgo(99) }, false, NOW).call, false)
  })

  test('*** §9a: THE RULE CAN RETURN FALSE, OR EVERY ASSERTION ABOVE PROVES NOTHING. ***', () => {
    // The control. A `reconcileNeeded` that returned a reason for everything would pass most of
    // this file, and would put a Stripe call on every Billing tab load in the product.
    const rows = [
      { stripe_customer_id: null, stripe_subscription_id: null, subscription_status: null, payment_failed_at: null },
      settled,
      { ...settled, subscription_status: 'trialing' },
      { ...settled, subscription_status: 'canceled' },
      { ...settled, subscription_status: 'past_due', payment_failed_at: hoursAgo(2) },
    ]
    for (const r of rows) assert.equal(reconcileNeeded(r, NOW), null, JSON.stringify(r))
    // ...and it can return each of the four, so "null" above is a decision and not a dead function.
    assert.deepEqual(
      [
        reconcileNeeded({ stripe_customer_id: CUS, stripe_subscription_id: null }, NOW),
        reconcileNeeded({ ...settled, subscription_status: 'past_due', payment_failed_at: null }, NOW),
        reconcileNeeded({ ...settled, subscription_status: 'past_due', payment_failed_at: hoursAgo(25) }, NOW),
        reconcileNeeded({ ...settled, payment_failed_at: hoursAgo(25) }, NOW),
      ],
      ['no_subscription_mirrored', 'not_paying_without_anchor', 'not_paying_unconfirmed',
       'anchor_under_a_paying_status'])
  })

  test('`?card=added` changes only the WORDS, and only for the Checkout case', () => {
    const quiet = reconcileTrigger({ stripe_customer_id: CUS, stripe_subscription_id: null }, false, NOW)
    const back = reconcileTrigger({ stripe_customer_id: CUS, stripe_subscription_id: null }, true, NOW)
    assert.equal(quiet.call, back.call)
    assert.equal(quiet.say, null, 'somebody browsing is shown a progress message')
    assert.equal(back.say, FINISHING_UP)

    // *** AND A STALE-STATE RECONCILE IS SILENT EVEN WITH `?card=added` ON THE ADDRESS. ***
    // It will usually find nothing — a genuinely failing card looks exactly like a stale one —
    // and "Finishing up…" for a repair nobody asked for would be a progress bar for a no-op.
    const stale = reconcileTrigger({ ...settled, subscription_status: 'past_due', payment_failed_at: hoursAgo(25) }, true, NOW)
    assert.equal(stale.call, true)
    assert.equal(stale.say, null)

    // A bookmarked `?card=added` still cannot make a call happen on a settled row.
    assert.equal(reconcileTrigger(settled, true, NOW).call, false)
  })

  test('a subscription with no customer — impossible, and still no call', () => {
    assert.equal(reconcileTrigger({ stripe_customer_id: null, stripe_subscription_id: SUB }, true, NOW).call, false)
  })
})

// =================================================================================================
describe('THE REPAIR — what the walk needed, through the same mapping the webhook uses', () => {
// =================================================================================================

  test('a missed delivery is repaired, and the columns are the WEBHOOK’S, not a second set', async () => {
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const { port, calls } = countingPort()

    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })

    assert.equal(out.kind, 'repaired')
    assert.equal(didRepair(out), true)
    assert.deepEqual(calls, [`latest:${CUS}`, `read:${SUB}`])

    // *** THE ONE CODE PATH, ASSERTED. *** If anybody ever writes a second mapping in
    // `lib/stripeReconcile.ts`, this fails — it compares what the reconcile wrote with what
    // `columnsFromFacts` says, which is what the webhook writes.
    // `columnsFromFacts` PLUS the one column it deliberately does not touch: §222's anchor rule,
    // applied by the reconcile because Stripe says `active`. Everything else must be the shared
    // mapping verbatim — a second copy of it in `lib/stripeReconcile.ts` fails here.
    assert.deepEqual(
      out.kind === 'repaired' ? out.written : null,
      { ...columnsFromFacts(facts()), payment_failed_at: null },
      'the reconcile wrote something other than the webhook’s own mapping',
    )

    const row = db.tables.companies[0]
    assert.equal(row.stripe_subscription_id, SUB)
    assert.equal(row.subscription_status, 'active')
    assert.equal(row.current_period_end, '2026-11-24T05:32:14.000Z')
    assert.equal(row.card_brand, 'visa')
    assert.equal(row.card_last4, '4242')
  })

  test('…and `trial_ends_at` is NOT erased by a subscription that has no trial', async () => {
    // The asymmetry `columnsFromFacts` holds, checked from this side too: the lapsed company's own
    // trial end is history and a null from Stripe must not overwrite it.
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const { port } = countingPort({ read: facts({ trialEnd: null }) })
    await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(db.tables.companies[0].trial_ends_at, '2026-10-21T05:25:05.622Z')
  })

  test('a scheduled cancellation comes across with the repair (§219’s column)', async () => {
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const { port } = countingPort({ read: facts({ cancelAt: '2026-11-24T00:00:00.000Z' }) })
    await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(db.tables.companies[0].cancel_at, '2026-11-24T00:00:00.000Z')
  })

  test('no customer: Stripe is NEVER asked, and nothing is written', async () => {
    const db = makeDb({ companies: [{ ...missedDelivery(), stripe_customer_id: null }], stripe_events: [] })
    const { port, calls } = countingPort()
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(out.kind, 'no_customer')
    assert.deepEqual(calls, [], 'a trialling company’s page load made a Stripe call')
    assert.equal(db.tables.companies[0].stripe_subscription_id, null)
  })

  test('*** §222: A SETTLED ROW IS REFUSED BY THE ROUTE TOO, NOT ONLY BY THE PAGE. ***', async () => {
    // This test used to assert a "cheap exit" on any row that named a subscription — which is
    // precisely what left a stale `past_due` unhealable. The exit is now the SHARED RULE, asked a
    // second time on the server, so a client looping on the route cannot spend a Stripe call per
    // request and turn the mirror into a proxy.
    const db = makeDb({
      companies: [{ ...missedDelivery(), stripe_subscription_id: 'sub_already', subscription_status: 'active' }],
      stripe_events: [],
    })
    const { port, calls } = countingPort()
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(out.kind, 'not_needed')
    assert.deepEqual(calls, [], 'a settled row cost a Stripe call')
    assert.equal(db.tables.companies[0].stripe_subscription_id, 'sub_already')
  })

  test('a STALE row is asked about — and the known id is used, with no list call', async () => {
    // The id is not the missing fact here, so `latestSubscriptionId` must not be called: the row
    // already names the subscription and that is the one to re-read.
    const db = makeDb({ companies: [stalePastDue()], stripe_events: [] })
    const { port, calls } = countingPort()
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port, now: NOW })
    assert.equal(out.kind, 'repaired')
    assert.deepEqual(calls, [`read:${SUB}`], 'the reconcile listed subscriptions it did not need')
  })

  test('*** AND STRIPE AGREEING IS `already_current`: NO WRITE, NO RECORD. ***', async () => {
    // Once the trigger widened this became the COMMONEST answer — a genuinely failing card looks
    // exactly like a stale one until you ask. It must cost a read and nothing else.
    const db = makeDb({ companies: [stalePastDue()], stripe_events: [] })
    const { port } = countingPort({ read: facts({
      status: 'past_due',
      // Every column exactly as the row already holds it — including the period end, spelled the
      // way Postgres spells it, which is what `changedFields` compares as an instant.
      currentPeriodEnd: '2026-11-27T18:18:43.000Z',
      nextCharge: { amountCents: 19900, currency: 'usd' },
    }) })
    const before = JSON.stringify(db.tables.companies[0])
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port, now: NOW })
    assert.equal(out.kind, 'already_current')
    assert.equal(JSON.stringify(db.tables.companies[0]), before, 'a no-op reconcile moved a column')
    assert.equal(db.log.filter((l) => l.startsWith('update')).length, 0, 'it issued an UPDATE anyway')
  })
})

// =================================================================================================
describe('*** §222: THE STALE MIRROR — what the walk’s second outage left behind ***', () => {
// =================================================================================================

  test('past_due with a stale anchor is corrected to active, AND THE ANCHOR IS CLEARED', async () => {
    // The whole finding. He paid $199, `invoice.paid` was never delivered, the row sat at
    // `past_due` with an anchor — and on day 8 `accessFor` turns that paying customer read_only.
    const db = makeDb({ companies: [stalePastDue()], stripe_events: [] })
    const { port } = countingPort({ read: facts({ status: 'active' }) })

    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port, now: NOW })

    assert.equal(out.kind, 'repaired')
    const row = db.tables.companies[0]
    assert.equal(row.subscription_status, 'active')
    assert.equal(row.payment_failed_at, null, 'the grace anchor survived, so the lock-out still comes')
    assert.ok((out.kind === 'repaired' ? out.changed : []).includes('payment_failed_at'))
    assert.ok((out.kind === 'repaired' ? out.changed : []).includes('subscription_status'))
  })

  test('…and the end state is the webhook’s own, column for column', async () => {
    // "Exactly as the webhook would": the same mapping plus the same anchor rule. Driven here by
    // running BOTH — the reconcile on one database, `invoice.paid` on another — and comparing.
    const f = facts({ status: 'active' })
    const viaReconcile = makeDb({ companies: [stalePastDue()], stripe_events: [] })
    await reconcileFromStripe({ companyId: CO, db: viaReconcile as never, port: countingPort({ read: f }).port, now: NOW })

    const viaWebhook = makeDb({ companies: [stalePastDue()], stripe_events: [] })
    await receiveStripeEvent({
      event: { id: 'evt_paid', type: 'invoice.paid',
        data: { object: { customer: CUS, parent: { type: 'subscription_details', subscription_details: { subscription: SUB } } } } } as never,
      db: viaWebhook as never,
      port: { readSubscription: async () => f, latestSubscriptionId: async () => SUB } as never,
    })

    const only = (r: Record<string, unknown>) => {
      const o: Record<string, unknown> = {}
      for (const k of Object.keys(r).sort()) if (k !== 'id') o[k] = r[k]
      return o
    }
    assert.deepEqual(only(viaReconcile.tables.companies[0]), only(viaWebhook.tables.companies[0]),
      'the reconcile and the webhook disagree about the row they both just wrote')
  })

  test('the anchor is NOT cleared while Stripe still says the payment is failing', async () => {
    // `clearsGraceAnchor` is a predicate on Stripe's word, not a wish. A reconcile that found
    // `past_due` and cleared the anchor would restart the seven days on every page load, and the
    // grace would never run out for anybody.
    const db = makeDb({ companies: [stalePastDue()], stripe_events: [] })
    const { port } = countingPort({ read: facts({ status: 'past_due', currentPeriodEnd: '2027-01-01T00:00:00.000Z' }) })
    await reconcileFromStripe({ companyId: CO, db: db as never, port, now: NOW })
    assert.equal(db.tables.companies[0].payment_failed_at, ANCHOR)
  })

  test('*** TIMESTAMPS ARE COMPARED AS INSTANTS, OR EVERY RECONCILE WOULD "REPAIR". ***', () => {
    // Postgres hands back `+00:00`; the mapping holds `.000Z`. Compared as text these differ, and
    // a reconcile would write, return `repaired`, and file a record for a change it did not make.
    assert.deepEqual(changedFields(
      { current_period_end: '2026-11-27T18:18:43+00:00', next_charge_amount_cents: 19900 },
      { current_period_end: '2026-11-27T18:18:43.000Z', next_charge_amount_cents: 19900 }), [])
    // …and a real move is still seen.
    assert.deepEqual(changedFields(
      { current_period_end: '2026-11-27T18:18:43+00:00' },
      { current_period_end: '2026-12-27T18:18:43.000Z' }), ['current_period_end'])
    // `numeric` can arrive from PostgREST as a string; 100 and "100" are not a discount changing.
    assert.deepEqual(changedFields({ discount_percent_off: '100' }, { discount_percent_off: 100 }), [])
    assert.deepEqual(changedFields({ card_brand: null }, { card_brand: 'visa' }), ['card_brand'])
    assert.deepEqual(changedFields({ card_brand: 'visa' }, { card_brand: null }), ['card_brand'])
  })
})

describe('*** THE WEBHOOK WINS EVERY TIE. *** The guard, exercised as a real race', () => {
// =================================================================================================

  test('a webhook write that lands MID-FLIGHT is not overwritten', async () => {
    // Not a mocked return value: the port itself writes what a webhook would have written, in
    // between the reconcile's read of the row and its own update. That is the actual sequence the
    // `.is('stripe_subscription_id', null)` guard exists for, and the only way to prove the guard
    // rather than to assert that it is spelled correctly.
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const port: StripePort = {
      async latestSubscriptionId() {
        Object.assign(db.tables.companies[0], {
          stripe_subscription_id: 'sub_webhook',
          subscription_status: 'trialing',
          card_brand: 'mastercard',
          card_last4: '4444',
        })
        return SUB
      },
      async readSubscription() { return facts() },
    }

    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })

    assert.equal(out.kind, 'raced')
    assert.equal(didRepair(out), false)
    const row = db.tables.companies[0]
    assert.equal(row.stripe_subscription_id, 'sub_webhook', 'the reconcile overwrote the webhook')
    assert.equal(row.subscription_status, 'trialing')
    assert.equal(row.card_brand, 'mastercard')
    assert.equal(row.card_last4, '4444')
  })

  test('*** §222: AND NOW ON AN EXISTING SUBSCRIPTION, WHICH `.is(null)` COULD NOT GUARD. ***', async () => {
    // The old guard was "only ever fill a blank". It made the race safe and made the stale row
    // unhealable. The property that had to survive the widening is not "fill a blank" — it is
    // *** THE WEBHOOK WINS EVERY TIE ***, and this is that property on a row the old guard would
    // have refused to touch at all.
    //
    // Run as a real race: the port itself writes what `invoice.paid` would have written, in
    // between the reconcile's read of the row and its own update.
    const db = makeDb({ companies: [stalePastDue()], stripe_events: [] })
    const port: StripePort = {
      async latestSubscriptionId() { return SUB },
      async readSubscription() {
        Object.assign(db.tables.companies[0], {
          subscription_status: 'active',
          payment_failed_at: null,
          current_period_end: '2027-01-27T00:00:00.000Z',
          card_brand: 'mastercard',
          card_last4: '4444',
        })
        return facts({ status: 'active' })
      },
    }

    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port, now: NOW })

    assert.equal(out.kind, 'raced')
    assert.equal(didRepair(out), false)
    const row = db.tables.companies[0]
    // Every value is the WEBHOOK'S, not the reconcile's — including the ones the reconcile was
    // about to write with the same name and a different value.
    assert.equal(row.current_period_end, '2027-01-27T00:00:00.000Z')
    assert.equal(row.card_brand, 'mastercard')
    assert.equal(row.card_last4, '4444')
  })

  test('the compare-and-set keys on BOTH the status and the subscription id', async () => {
    // Either moving is enough to mean a delivery landed. Driven one at a time, because a guard
    // that only checked one of them would pass the test above by luck.
    for (const landed of [
      { subscription_status: 'canceled' },
      { stripe_subscription_id: 'sub_replaced' },
    ]) {
      const db = makeDb({ companies: [stalePastDue()], stripe_events: [] })
      const port: StripePort = {
        async latestSubscriptionId() { return SUB },
        async readSubscription() {
          Object.assign(db.tables.companies[0], landed)
          return facts({ status: 'active' })
        },
      }
      const out = await reconcileFromStripe({ companyId: CO, db: db as never, port, now: NOW })
      assert.equal(out.kind, 'raced', `a webhook that set ${JSON.stringify(landed)} was overwritten`)
    }
  })

  test('*** AND A NULL IS FILTERED WITH `is`, NOT `eq`. ***', async () => {
    // PostgREST's `eq.null` matches NO row, so §220's case — a blank subscription id and a null
    // status — would report `raced` on every single repair and heal nothing. The fake database
    // models that distinction, so this is a real assertion and not a reading of the source.
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const { port } = countingPort()
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(out.kind, 'repaired', 'a null-valued compare-and-set matched nothing')
  })

  test('the write is scoped to the ONE company, so a second company is never touched', async () => {
    const other = { ...missedDelivery(), id: 'co-2', stripe_customer_id: 'cus_2' }
    const db = makeDb({ companies: [missedDelivery(), other], stripe_events: [] })
    const { port } = countingPort()
    await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(db.tables.companies[1].stripe_subscription_id, null)
    assert.equal(db.tables.companies[1].subscription_status, null)
  })
})

// =================================================================================================
describe('AN ABSENCE IS NOT A FACT — the customer who abandoned Checkout', () => {
// =================================================================================================

  test('*** Stripe has no subscription: the mirror is left EXACTLY as it was. ***', async () => {
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const before = JSON.stringify(db.tables.companies[0])
    const { port, calls } = countingPort({ latest: null })

    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })

    assert.equal(out.kind, 'nothing_at_stripe')
    assert.deepEqual(calls, [`latest:${CUS}`], 'it went on to read a subscription that is not there')
    assert.equal(JSON.stringify(db.tables.companies[0]), before, 'a column moved on an absence')
  })

  test('…and a subscription Stripe will not hand back is the same answer, not a crash', async () => {
    // `readSubscription` returns null when the retrieve throws — a deleted test object, a key
    // for another account. The reconcile must land on "nothing", never on a half-written row.
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const before = JSON.stringify(db.tables.companies[0])
    const { port } = countingPort({ read: null })
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(out.kind, 'nothing_at_stripe')
    assert.equal(JSON.stringify(db.tables.companies[0]), before)
  })

  test('no company row at all: said, not swallowed, and nothing written', async () => {
    const db = makeDb({ companies: [], stripe_events: [] })
    const { port, calls } = countingPort()
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(out.kind, 'failed')
    assert.match(out.kind === 'failed' ? out.error : '', /could not read the company/)
    assert.deepEqual(calls, [])
  })
})

// =================================================================================================
describe('IT NEVER BLOCKS THE PAGE — the deadline', () => {
// =================================================================================================

  test('Stripe not answering is a `timed_out`, with nothing written', async () => {
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const port: StripePort = {
      // Never resolves. This is what "Stripe is having a bad day" looks like to this function.
      latestSubscriptionId: () => new Promise(() => {}),
      readSubscription: () => new Promise(() => {}),
    }
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port, deadlineMs: 5 })
    assert.equal(out.kind, 'timed_out')
    assert.equal(db.tables.companies[0].stripe_subscription_id, null)
  })

  test('the real deadline is seconds, not minutes — a person is waiting on it', () => {
    assert.ok(RECONCILE_DEADLINE_MS > 0 && RECONCILE_DEADLINE_MS <= 10000,
      `RECONCILE_DEADLINE_MS is ${RECONCILE_DEADLINE_MS}ms, which is not a wait anybody will sit through`)
  })

  test('a slow-but-answering Stripe still repairs — the deadline is not a race we usually lose', async () => {
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const port: StripePort = {
      latestSubscriptionId: () => new Promise((r) => setTimeout(() => r(SUB), 10)),
      readSubscription: () => new Promise((r) => setTimeout(() => r(facts()), 10)),
    }
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port, deadlineMs: 2000 })
    assert.equal(out.kind, 'repaired')
  })
})

// =================================================================================================
describe('THE RECORD — in `stripe_events`, with a type that says `reconcile`', () => {
// =================================================================================================
  const NOW = new Date('2026-10-27T12:00:00.000Z')

  test('a repair is recorded, keyed so it cannot collide with a Stripe event id', async () => {
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    const { port } = countingPort()
    const outcome = await reconcileFromStripe({ companyId: CO, db: db as never, port })
    const wrote = await recordReconcile({ companyId: CO, customerId: CUS, outcome, db: db as never, now: NOW })

    assert.equal(wrote, true)
    assert.equal(db.tables.stripe_events.length, 1)
    const row = db.tables.stripe_events[0]
    assert.equal(row.id, `reconcile_${CO}_${NOW.getTime()}`)
    assert.equal(row.type, 'reconcile.repaired')
    assert.equal(row.company_id, CO)
    assert.equal(row.stripe_customer_id, CUS)
    assert.equal(row.handled, true)
    assert.equal(row.error, null)
    // The "source" the brief asked for, said in the payload as well as in the type.
    assert.equal(row.payload.source, 'reconcile')
    assert.equal(row.payload.outcome.kind, 'repaired')
  })

  test('*** THE RECORD NAMES THE STATE THAT EARNED THE QUESTION, NOT A FALLBACK. ***', async () => {
    // The route used to ask `reconcileNeeded` AGAIN after the call, to fill this in — and a
    // successful repair settles the row, so the question answered null and every record read
    // "the mirror looked wrong". Found by reading a row the staging run had just written. A fact
    // about why we acted cannot be recovered from the state we acted on; it has to travel.
    const db = makeDb({ companies: [stalePastDue()], stripe_events: [] })
    const { port } = countingPort({ read: facts({ status: 'active' }) })
    // *** The enclosing suite shadows `NOW` with an earlier date, which would put the fixture's
    // anchor in the FUTURE and make the row settled. The clock is named here on purpose. ***
    const stale = new Date('2026-10-29T12:00:00.000Z')
    const outcome = await reconcileFromStripe({ companyId: CO, db: db as never, port, now: stale })
    assert.equal(outcome.reason, 'not_paying_unconfirmed')

    await recordReconcile({ companyId: CO, customerId: CUS, reason: outcome.reason, outcome, db: db as never, now: stale })
    const row = db.tables.stripe_events[0]
    assert.equal(row.payload.why, 'not_paying_unconfirmed')
    // `facts()`'s period end differs from the fixture's, so that moves too. Named rather than
    // trimmed: the record's job is to say exactly which columns a reconcile touched.
    assert.deepEqual(row.payload.outcome.changed,
      ['current_period_end', 'payment_failed_at', 'subscription_status'])

    // …and the route is the one that must pass it. A source check, because the wiring is what broke.
    const route = readFileSync('app/api/billing/reconcile/route.ts', 'utf8')
    assert.match(route, /reason: outcome\.reason/)
    assert.ok(!/reconcileNeeded\(/.test(route), 'the route re-derives the reason again')
  })

  test('*** THE QUIET NO-OP IS DELIBERATELY NOT RECORDED. ***', async () => {
    // A company that abandoned Checkout sits in this state for ever. One row per page load would
    // fill the one table whose job is to make a payment fact findable with rows that are not
    // payment facts. The line is: a row when something changed, or when something went wrong.
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    for (const outcome of [
      { kind: 'nothing_at_stripe' } as const,
      { kind: 'no_customer' } as const,
      { kind: 'not_needed' } as const,
      { kind: 'already_current', subscriptionId: SUB } as const,
    ]) {
      assert.equal(
        await recordReconcile({ companyId: CO, customerId: CUS, outcome, db: db as never, now: NOW }),
        false, `${outcome.kind} wrote a row`)
    }
    assert.equal(db.tables.stripe_events.length, 0)
  })

  test('a failure and a timeout ARE recorded, unhandled and with their reason', async () => {
    const db = makeDb({ companies: [], stripe_events: [] })
    await recordReconcile({
      companyId: CO, customerId: null, db: db as never, now: NOW,
      outcome: { kind: 'failed', error: 'could not write the billing columns: nope' },
    })
    await recordReconcile({
      companyId: CO, customerId: CUS, db: db as never, now: new Date(NOW.getTime() + 1),
      outcome: { kind: 'timed_out' },
    })
    assert.equal(db.tables.stripe_events.length, 2)
    assert.equal(db.tables.stripe_events[0].handled, false)
    assert.match(db.tables.stripe_events[0].error, /could not write/)
    assert.equal(db.tables.stripe_events[1].type, 'reconcile.timed_out')
    assert.match(db.tables.stripe_events[1].error, /did not answer inside the deadline/)
  })
})

// =================================================================================================
describe('THE DOOR — the route takes its company from the session and nothing from the body', () => {
// =================================================================================================
  const ROUTE = readFileSync('app/api/billing/reconcile/route.ts', 'utf8')

  test('`requireCompany` first, and the company id comes from its answer', () => {
    assert.match(ROUTE, /const authed = await requireCompany\(request\)/)
    assert.match(ROUTE, /if \(!authed\.ok\) return authed\.response/)
    assert.match(ROUTE, /const \{ companyId \} = authed\.auth/)
  })

  test('*** IT CANNOT BE AIMED AT ANOTHER COMPANY: THERE IS NO BODY AT ALL. ***', () => {
    // The strongest form of §3.6's rule. Not "the body's id is ignored" — there is no id to pass.
    assert.ok(!/request\.json\(\)|request\.text\(\)|searchParams/.test(ROUTE),
      'the route reads something off the request besides its token')
    // and the one id it uses is the one from the session, at every statement
    assert.equal((ROUTE.match(/companyId/g) ?? []).length >= 4, true)
  })

  test('the service role is used, and named — the fifth entry on §3.6’s list', () => {
    assert.match(ROUTE, /supabaseAdmin/)
    assert.match(ROUTE, /§3\.6/)
    assert.match(ROUTE, /out of `authenticated`'s UPDATE grant/)
  })

  test('no `requireAccess`, with the reason written down', () => {
    // Deliberate, and the reason is circularity: the company most likely to need the repair is
    // the one the gate currently reads as read-only BECAUSE the mirror is empty.
    assert.ok(!/requireAccess\(/.test(ROUTE))
    assert.match(ROUTE, /NO `requireAccess`/)
  })

  test('the reconcile and the record both come from the shared library', () => {
    assert.match(ROUTE, /from '@\/lib\/stripeReconcile'/)
    assert.match(ROUTE, /realStripePort/)
    // No mapping in the route itself. It now SELECTS four columns to key the record on (§222),
    // so the assertion is about WRITING: no `.update(` anywhere, and no card column at all.
    assert.ok(!/\.update\(/.test(ROUTE),
      'the route writes columns itself instead of going through the shared mapping')
    assert.ok(!/card_brand|card_last4|next_charge/.test(ROUTE),
      'the route names a column only the mapping should know about')
  })
})

// =================================================================================================
describe('THE PAGE CALLS IT ONCE, THEN DRAWS', () => {
// =================================================================================================
  const PAGE = readFileSync('app/account/page.tsx', 'utf8')

  test('the trigger is the shared rule, not a condition written again in the page', () => {
    assert.match(PAGE, /const trigger = reconcileTrigger\(company, cardAdded, new Date\(\)\)/)
    assert.match(PAGE, /if \(!trigger\.call\)/)
    // If the page re-derived it, the page and the route could disagree about when to repair.
    assert.ok(!/stripe_customer_id && !company\.stripe_subscription_id/.test(PAGE),
      'the page re-derives the trigger instead of sharing it')
  })

  test('*** ONCE PER LOAD: A REF, NOT A PIECE OF STATE. ***', () => {
    // The effect reloads the company, which changes `company`, which re-runs the effect. State
    // would be stale inside that closure; a ref is read at the moment it is checked.
    assert.match(PAGE, /const asked = useRef\(false\)/)
    assert.match(PAGE, /if \(tab !== 'billing' \|\| !company \|\| asked\.current\) return/)
    assert.match(PAGE, /asked\.current = true/)
  })

  test('it POSTs with no body, and the page draws whatever happens', () => {
    assert.match(PAGE, /fetch\('\/api\/billing\/reconcile', \{ method: 'POST', headers: await authHeaders\(\) \}\)/)
    // The catch is empty ON PURPOSE and says so — the page's next move is identical either way.
    assert.match(PAGE, /\/\/ Deliberately ignored\./)
    assert.match(PAGE, /await load\(\)/)
  })

  test('*** A REPAIR NAVIGATES; THE OTHER TWO PATHS DO NOT. ***', () => {
    // `load()` cannot re-read `AppLayout`'s own companies query, so a soft reload left the
    // read-only band above a tab that now said Active — found on staging, not by the gate.
    assert.match(PAGE, /if \(repaired\) \{ window\.location\.replace\('\/account\?tab=billing'\); return \}/)
    assert.match(PAGE, /repaired = Boolean\(\(await res\.json\(\)\.catch\(\(\) => null\)\)\?\.repaired\)/)
    // and the navigation is the ONLY one on this path: a reload on every outcome would be a flash
    // for a company that correctly had nothing repaired.
    assert.equal((PAGE.match(/window\.location\.replace/g) ?? []).length, 1)
  })

  test('…and the route answers with the flag the page keys off', () => {
    const route = readFileSync('app/api/billing/reconcile/route.ts', 'utf8')
    assert.match(route, /repaired: didRepair\(outcome\)/)
  })

  test('*** NO SELF-CANCELLING CLEANUP, WHICH IS WHAT HUNG IT ONCE. ***', () => {
    // `load()` changes `company`, `company` is in the deps, so a cleanup would fire and cancel the
    // continuation that clears `finishing` — leaving "Finishing up…" on screen for ever. The
    // comment is required to stay, because the next person to add one will add it for good reasons.
    // Matched as a LINE OF CODE, not as text: the comment below it quotes the thing it removed,
    // which is the point of the comment and must not fail the test.
    assert.ok(!/^\s*let live = true$/m.test(PAGE), 'the self-cancelling cleanup is back')
    assert.ok(!/return \(\) => \{ live = false \}/.test(PAGE), 'the cleanup is back')
    assert.match(PAGE, /NO `live` CLEANUP, AND THE STAGING RUN IS WHY/)
  })

  test('`?card=added` is stripped, so a refresh cannot re-trigger the message', () => {
    assert.match(PAGE, /q\.delete\('card'\)/)
    assert.match(PAGE, /dropCardParam/)
    // …and never to a bare path, which is the one thing `router.replace` will not do (§206).
    assert.match(PAGE, /router\.replace\(`\/account\?\$\{q\}`, \{ scroll: false \}\)/)
  })

  test('the card line says `Finishing up…` instead of the sentence we have not earned', () => {
    assert.match(PAGE, /const cardText = finishing \?\? view\.card\.text/)
    assert.match(PAGE, /\{cardText\}/)
  })

  test('*** AND THE STALLED NOTE IS CHECKED AGAINST THE FRESH ROW, NOT THE OLD ONE. ***', () => {
    // Inside the effect, `company` is the row from before the reload — a repaired company would
    // be told to refresh. The condition therefore lives in the render.
    assert.match(PAGE, /const stillWaiting = stalled && !view\.hasSubscription/)
    assert.match(PAGE, /\{FINISHING_STALLED\}/)
  })

  test('neither word is written twice: both come from `lib/billingView.ts`', () => {
    assert.ok(!PAGE.includes('Finishing up…') || PAGE.includes('FINISHING_STALLED'),
      'the page carries its own copy of the wording')
    assert.equal(FINISHING_UP, 'Finishing up…')
    assert.equal(FINISHING_STALLED, 'Finishing up — refresh in a moment.')
  })
})

// =================================================================================================
describe('A 402 IS NOT A QUESTION TO REPHRASE — the owner hit this in the Compliance Workspace', () => {
// =================================================================================================

  test('402 drops the line; every other failure keeps it', () => {
    assert.equal(askAgainLine(402), '')
    for (const s of [500, 503, 400, 404, 409, 200, null, undefined]) {
      assert.equal(askAgainLine(s), ASK_AGAIN_LINE, `status ${s} lost the line`)
    }
  })

  test('…including a failure with NO status, which is a broken stream and not a refusal', () => {
    // `answerStream`'s `failed` outcome carries a message and no response. Rephrasing may well
    // help there, so the line stays.
    assert.equal(askAgainLine(undefined), ASK_AGAIN_LINE)
  })

  test('all three screens ask the shared function, and none carries the sentence itself', () => {
    for (const f of ['app/compliance/page.tsx', 'app/hr/HrWorkspace.tsx', 'components/CalendarAsk.tsx']) {
      const src = readFileSync(f, 'utf8')
      assert.match(src, /\{askAgainLine\(x\.failedStatus\)\}/, `${f} does not ask the shared function`)
      assert.ok(!/You can ask again, or rephrase the question\./.test(src),
        `${f} still carries its own copy of the line`)
      assert.match(src, /failedStatus: res\.status/, `${f} never records the status it failed with`)
    }
  })

  test('and the Calendar’s "Try again" goes with it, for the same reason', () => {
    const src = readFileSync('components/CalendarAsk.tsx', 'utf8')
    assert.match(src, /x\.failedStatus !== 402 && \(/)
  })
})
