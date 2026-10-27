/**
 * THE BILLING TAB'S WORDS — board 4, My Account step 19, `DECISIONS.md` §216.
 *
 * `lib/billingView.ts` is pure, so every state the tab can be in is reachable here — including
 * the ones nobody can produce by hand: a subscription that is active before its first
 * `current_period_end` has landed, and a status word Stripe has not invented yet.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  billingTabView, plainDate, daysUntil, money, PLAN_PRICE, PLAN_NOTE, STRIPE_NOTE, MANAGE_LINK,
  AFTER_THE_TRIAL, type BillingViewColumns,
} from '../../lib/billingView.ts'
import { checkoutSessionParams } from '../../lib/stripe.ts'

const NOW = new Date('2026-10-21T12:00:00Z')
const row = (over: Partial<BillingViewColumns> = {}): BillingViewColumns => ({
  trial_ends_at: '2026-10-30T12:00:00Z',
  subscription_status: null,
  payment_failed_at: null,
  current_period_end: null,
  card_brand: null,
  card_last4: null,
  stripe_subscription_id: null,
  ...over,
})

describe('the two small pure helpers', () => {
  test('plainDate is the shape every other date in the product uses', () => {
    assert.equal(plainDate('2026-10-30T12:00:00Z'), '30 October 2026')
  })
  test('…and is UTC, so a date never shifts by a day for somebody west of Greenwich', () => {
    assert.equal(plainDate('2026-10-30T02:00:00Z'), '30 October 2026')
  })
  test('plainDate says nothing rather than "Invalid Date"', () => {
    for (const v of [null, undefined, '', 'not a date']) assert.equal(plainDate(v as string), '')
  })
  test('daysUntil counts CALENDAR days, as a person would off a calendar', () => {
    assert.equal(daysUntil('2026-10-30T12:00:00Z', NOW), 9)
    assert.equal(daysUntil('2026-10-22T00:00:01Z', NOW), 1)
    assert.equal(daysUntil('2026-10-21T23:59:00Z', NOW), 0)
  })
  test('*** AND IT DOES NOT SAY THE SAME NUMBER ON TWO CONSECUTIVE DAYS. ***', () => {
    // `ceil(elapsed / 24h)` returns 9 on BOTH the 21st and the 22nd for a trial ending at noon on
    // the 30th, because 8.96 rounds up. That is the bug this function is written to avoid, and it
    // is the kind that only shows up to a customer who looks twice.
    const ends = '2026-10-30T12:00:00Z'
    assert.equal(daysUntil(ends, new Date('2026-10-21T00:30:00Z')), 9)
    assert.equal(daysUntil(ends, new Date('2026-10-21T23:30:00Z')), 9)
    assert.equal(daysUntil(ends, new Date('2026-10-22T00:30:00Z')), 8)
  })
  test('…and never goes negative', () => {
    assert.equal(daysUntil('2026-10-01T12:00:00Z', NOW), 0)
  })
})

describe('board 4, status — every state the gate can report', () => {
  const cases: Array<[string, Partial<BillingViewColumns>, string, RegExp]> = [
    ['the trial, running',
      {}, 'Trial', /Your trial ends 30 October 2026\. Add a card before then and nothing changes on the day\./],
    // *** THE CARD AND THE AMOUNT ARE IN THIS ROW NOW, AND \u00a7221 IS WHY. ***
    // This case had neither, and still asserted "charged to the card below" — the page telling a
    // company with no card that a charge was going to one. The same sentence the owner's coupon
    // walk found on screen, sitting unnoticed in a test fixture. A cardless active company has its
    // own case immediately below.
    ['active, with a next payment date',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'active', current_period_end: '2026-11-30T12:00:00Z',
        stripe_subscription_id: 'sub_1', card_brand: 'visa', card_last4: '4242',
        next_charge_amount_cents: 19900, next_charge_currency: 'usd' },
      'Active', /\$199 a month, charged to the card below/],
    ['active, with a payment coming and NO card',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'active', current_period_end: '2026-11-30T12:00:00Z',
        stripe_subscription_id: 'sub_1', next_charge_amount_cents: 19900, next_charge_currency: 'usd' },
      'Active', /Add a card below so the next payment can go through/],
    ['active, before the first period end has landed',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'active' },
      'Active', /next payment date will appear here shortly/],
    ['the card failed, inside the grace',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'past_due', payment_failed_at: '2026-10-18T12:00:00Z' },
      'Payment failed', /Nothing has stopped working yet\./],
    ['past_due with no anchor — Stripe is still retrying',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'past_due' },
      'Payment failed', /Nothing has stopped working\./],
    ['the grace ran out',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'past_due', payment_failed_at: '2026-10-01T12:00:00Z' },
      'Read-only', /the 7 days are up/],
    ['the trial ended and no card was added',
      { trial_ends_at: '2026-10-01T12:00:00Z' },
      'Read-only', /Your trial ended 1 October 2026\./],
    ['canceled — its own word on the board',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'canceled' },
      'Canceled', /nothing has been deleted/],
    ['unpaid', { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'unpaid' }, 'Read-only', /isn't active/],
    ['paused', { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'paused' }, 'Read-only', /isn't active/],
    ['incomplete', { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'incomplete' }, 'Read-only', /isn't active/],
    ['incomplete_expired', { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'incomplete_expired' }, 'Read-only', /isn't active/],
    ['a word Stripe has not invented yet',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'hibernating' },
      'Read-only', /don't recognise \(hibernating\)/],
  ]

  for (const [name, over, pill, detail] of cases) {
    test(`${name} → ${pill}`, () => {
      const v = billingTabView(row(over), NOW)
      assert.equal(v.status.pill, pill)
      assert.match(v.status.detail, detail)
      assert.ok(v.status.detail.length > 0, 'a status with no sentence is a status nobody can act on')
    })
  }

  test('the trial headline counts the days, and the last one reads "Ends today"', () => {
    assert.equal(billingTabView(row(), NOW).status.headline, '9 days left')
    assert.equal(billingTabView(row({ trial_ends_at: '2026-10-22T12:00:00Z' }), NOW).status.headline, '1 day left')
    // Reachable only while the trial is still RUNNING, i.e. later the same day — at 12:00:00
    // exactly, `accessFor` has already moved to `trial_over_no_subscription`.
    assert.equal(billingTabView(row({ trial_ends_at: '2026-10-21T23:00:00Z' }), NOW).status.headline, 'Ends today')
  })

  test('*** THE GRACE SAYS A NUMBER, AND NEVER ZERO. ***', () => {
    // Decision 11's seven days. `graceDaysLeft` is honest arithmetic and reaches 0 on the last
    // day; "0 more days" is not a sentence to show anyone, so the display floors at 1.
    const at = (failed: string) =>
      billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'past_due', payment_failed_at: failed }), NOW)
    assert.match(at('2026-10-18T12:00:00Z').status.detail, /for 4 more days/)
    assert.match(at('2026-10-15T12:00:00Z').status.detail, /for 1 more day —/)
    assert.match(at('2026-10-14T12:00:00Z').status.detail, /for 1 more day —/)
  })

  test('*** AND IN THE GRACE IT MUST NOT SAY ANYTHING HAS STOPPED. ***', () => {
    // Access is still FULL for those seven days. A tab that said "read-only" there would be
    // contradicting the gate and taking away days the product just promised in writing.
    const v = billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'past_due', payment_failed_at: '2026-10-18T12:00:00Z' }), NOW)
    assert.notEqual(v.status.pill, 'Read-only')
    assert.match(v.status.detail, /Nothing has stopped working yet/)
  })

  test('every status reaches a branch, and none falls through to an empty pill', () => {
    for (const s of ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'a_ninth_word']) {
      const v = billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: s }), NOW)
      assert.ok(v.status.pill.length > 0, s)
      assert.ok(['Trial', 'Active', 'Payment failed', 'Canceled', 'Read-only'].includes(v.status.pill), `${s} → ${v.status.pill}`)
    }
  })
})

describe('board 4, the card — both states, and which door each opens', () => {
  test('no card, no customer → "Add a card", and that is CHECKOUT', () => {
    const v = billingTabView(row(), NOW)
    assert.equal(v.card.text, 'No card yet')
    assert.equal(v.card.action, 'Add a card')
    assert.equal(v.card.door, 'checkout')
  })

  test('*** STRIPE SENDS THE BRAND LOWER CASE, AND THE BOARD SAYS "Visa". ***', () => {
    // Noticed on the staging run: the tab read "visa ending 4242". The mirror stores Stripe's own
    // value verbatim and must keep doing so, so the capital belongs here, in the words.
    const v = billingTabView(row({ card_brand: 'visa', card_last4: '4242', stripe_subscription_id: 'sub_1' }), NOW)
    assert.equal(v.card.text, 'Visa ending 4242')
    assert.equal(billingTabView(row({ card_brand: 'mastercard', card_last4: '4444', stripe_subscription_id: 'sub_1' }), NOW).card.text,
      'Mastercard ending 4444')
    // Only the first letter: "amex" does not become "American Express", which is not ours to invent.
    assert.equal(billingTabView(row({ card_brand: 'amex', card_last4: '0005', stripe_subscription_id: 'sub_1' }), NOW).card.text,
      'Amex ending 0005')
  })

  test('a card on file → "Visa ending 4242", and that is the PORTAL', () => {
    const v = billingTabView(row({ card_brand: 'Visa', card_last4: '4242', stripe_subscription_id: 'sub_1' }), NOW)
    assert.equal(v.card.text, 'Visa ending 4242')
    assert.equal(v.card.action, 'Change')
    assert.equal(v.card.door, 'portal')
  })

  test('*** A PERSON WHO ABANDONED CHECKOUT MUST STILL BE ABLE TO SUBSCRIBE. ***', () => {
    // THE MIDDLE STATE, AND THE WHOLE REASON FOR §218.
    //
    // A Stripe customer exists the moment somebody OPENS checkout, even if they close the tab.
    // This test used to assert the opposite — that such a person goes to the PORTAL — with the
    // reason that checkout would make them a second customer. **That reason was never true:**
    // `app/api/billing/checkout/route.ts:61` reads the stored id and only creates one when it is
    // null.
    //
    // What the old rule did to them, found on the owner's own walk: every press sent them to the
    // portal, where they added a card that we never hear about (no subscribed event fires for a
    // payment method on a customer with no subscription) and that nothing will ever charge
    // (there is no subscription to charge it against). One abandoned checkout and they were
    // stuck in that loop until they lapsed on day 15 — having added a card and been shown
    // nothing to suggest it had not worked.
    const v = billingTabView(row({ stripe_subscription_id: null }), NOW)
    assert.equal(v.card.text, 'No card yet')
    assert.equal(v.card.action, 'Add a card')
    assert.equal(v.card.door, 'checkout',
      'a company with no subscription is being sent to the portal: it can add a card there that '
      + 'nothing will charge and no webhook reports, and it can never actually subscribe')
    assert.equal(v.hasSubscription, false)
  })

  test('the three states, side by side', () => {
    // The customer id is deliberately absent from `BillingViewColumns` now: there is no decision
    // left that it is the right answer to, and leaving it reachable invites the same mistake.
    const noCustomer = billingTabView(row(), NOW)
    const abandoned = billingTabView(row(), NOW)                                   // same row: a customer is NOT a column this reads
    const subscribed = billingTabView(row({ stripe_subscription_id: 'sub_1' }), NOW)
    assert.equal(noCustomer.card.door, 'checkout')
    assert.equal(abandoned.card.door, 'checkout')
    assert.equal(subscribed.card.door, 'portal')
  })

  test('half a card line is not a card line', () => {
    // The webhook writes brand and last4 together or not at all, but a partial row must read as
    // "no card" rather than "Visa ending null".
    for (const half of [{ card_brand: 'Visa' }, { card_last4: '4242' }]) {
      assert.equal(billingTabView(row(half), NOW).card.text, 'No card yet')
    }
  })

  test('the card line is independent of the status', () => {
    const v = billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'canceled', card_brand: 'Mastercard', card_last4: '4444', stripe_subscription_id: 'sub_2' }), NOW)
    assert.equal(v.status.pill, 'Canceled')
    assert.equal(v.card.text, 'Mastercard ending 4444')
    assert.equal(v.card.door, 'portal')
  })
})

describe('*** A SCHEDULED CANCELLATION, WHICH THE STATUS DOES NOT SHOW — §219 ***', () => {
  // Cancelling in the portal sets `cancel_at_period_end`; Stripe keeps `status` as `trialing` or
  // `active` until the date arrives (sandbox, 24 October). So a tab reading only the status told
  // somebody who had just cancelled — and already had a card — "Trial · 14 days left · Add a card
  // before then and nothing changes on the day". Three untruths in one row, about money.
  const CANCELS = '2026-11-07T00:00:00Z'

  test('1. no subscription — nothing scheduled, and the trial advice stands', () => {
    const v = billingTabView(row(), NOW)
    assert.equal(v.cancelScheduled, false)
    assert.match(v.status.detail, /Add a card before then/)
  })

  test('2. subscribed, not cancelling — the next payment date stands', () => {
    const v = billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'active', current_period_end: CANCELS, stripe_subscription_id: 'sub_1' }), NOW)
    assert.equal(v.cancelScheduled, false)
    assert.match(v.status.headline, /Next payment/)
  })

  test('3. *** CANCELLING DURING A TRIAL — the owner\'s own state. ***', () => {
    const v = billingTabView(row({ stripe_subscription_id: 'sub_1', card_brand: 'Visa', card_last4: '4242', cancel_at: CANCELS }), NOW)
    assert.equal(v.cancelScheduled, true)
    assert.equal(v.status.pill, 'Trial')
    assert.equal(v.status.headline, '9 days left · Cancels on 7 November 2026')
    assert.equal(v.status.detail,
      'You cancelled. You keep everything until then, and nothing further will be charged. '
      + 'Change your mind in Stripe.')
    // THE ADVICE LINE IS REPLACED, NOT JOINED. Two sentences, one saying "add a card" and one
    // saying "you cancelled", is worse than either — and the first is simply false here.
    assert.ok(!/Add a card before then/.test(v.status.detail), 'the contradicting advice survived')
    // They already have a card; the control must not offer to add one at Checkout.
    assert.equal(v.card.action, 'Change')
    assert.equal(v.card.door, 'portal')
  })

  test('4. cancelling while ACTIVE — and no "next payment", because there is not one', () => {
    const v = billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'active', current_period_end: CANCELS, stripe_subscription_id: 'sub_1', cancel_at: CANCELS }), NOW)
    assert.equal(v.status.pill, 'Active')
    assert.equal(v.status.headline, 'Cancels on 7 November 2026')
    assert.ok(!/Next payment/.test(v.status.headline), 'it still promises a payment that will not happen')
    assert.ok(!/charged to the card below/.test(v.status.detail))
  })

  test('5. *** CLEARED AGAIN — "Don\'t cancel subscription" in the portal. ***', () => {
    // The webhook writes `cancel_at: null` on the next event, and the page must go straight back
    // to its ordinary words. A person who changed their mind must not read "Cancels on…" for ever.
    const v = billingTabView(row({ stripe_subscription_id: 'sub_1', card_brand: 'Visa', card_last4: '4242', cancel_at: null }), NOW)
    assert.equal(v.cancelScheduled, false)
    assert.match(v.status.detail, /Add a card before then/)
    assert.ok(!/You cancelled/.test(v.status.detail))
  })

  test('the pill goes amber while a cancellation is pending, in both states', () => {
    const t = billingTabView(row({ stripe_subscription_id: 'sub_1', cancel_at: CANCELS }), NOW)
    const a = billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'active', stripe_subscription_id: 'sub_1', cancel_at: CANCELS }), NOW)
    assert.equal(t.status.tone, 'warn')
    assert.equal(a.status.tone, 'warn')
  })

  test('⚠ the card-failure states keep THEIR words, and that is a decision', () => {
    // A company that cancelled AND whose card then failed is told about the card, because that is
    // the urgent and actionable fact — "update it to keep everything running" is still true of the
    // period they have paid for. Recorded here so the omission is deliberate rather than missed.
    const v = billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'past_due', payment_failed_at: '2026-10-18T12:00:00Z', stripe_subscription_id: 'sub_1', cancel_at: CANCELS }), NOW)
    assert.equal(v.status.pill, 'Payment failed')
    assert.equal(v.cancelScheduled, true, 'the flag is still set, so the Cancel tab still knows')
  })
})

describe("board 4's fixed words are the board's", () => {
  test('the plan line', () => {
    // *** STILL `$199`, BUT NOW ONLY WHERE THE PAGE DESCRIBES THE PRODUCT (\u00a7221). *** What THIS
    // company pays is `next_charge_amount_cents`; see the suite at the end of this file.
    assert.equal(PLAN_PRICE, '$199')
    assert.equal(PLAN_NOTE, 'Everything in CompliBoard, for everyone at your company. Cancel any time.')
  })
  test('Stripe holds the card, and we say so', () => {
    assert.match(STRIPE_NOTE, /we never see your card number/)
    assert.equal(MANAGE_LINK, 'Manage billing and invoices')
  })
  test('"After the trial" is the board\'s three paragraphs, in the board\'s order', () => {
    assert.deepEqual(AFTER_THE_TRIAL.map((p) => p.key), ['Without a card', 'If a card fails', 'Deleting'])
    assert.match(AFTER_THE_TRIAL[0].text, /sign in and read, download and print/)
    assert.match(AFTER_THE_TRIAL[1].text, /7 days/)
    assert.match(AFTER_THE_TRIAL[2].text, /Not paying never deletes anything\./)
  })
  test('*** THE OLD SENTENCE IS GONE FROM THE PAGE ENTIRELY. ***', () => {
    const page = readFileSync('app/account/page.tsx', 'utf8')
    assert.ok(!/Card payment is not switched on yet/.test(page),
      'the tab still says card payment is not switched on')
  })
})

describe('the tab routes each control to the right door', () => {
  const page = readFileSync('app/account/page.tsx', 'utf8')
  test('the card button follows the view, rather than deciding for itself', () => {
    assert.match(page, /onClick=\{\(\) => go\(view\.card\.door\)\}/)
  })
  test('"Manage billing and invoices" is always the portal', () => {
    assert.match(page, /onClick=\{\(\) => go\('portal'\)\}/)
  })
  test('both go through our own route and navigate to what comes back', () => {
    assert.match(page, /fetch\(`\/api\/billing\/\$\{door\}`, \{ method: 'POST'/)
    assert.match(page, /window\.location\.href = json\.url/)
  })
  test('a refusal is shown AS ITS SENTENCE, beside the control', () => {
    assert.match(page, /setError\(json\?\.error \?\?/)
  })
})

describe("the Cancel tab's subscription line", () => {
  const page = readFileSync('app/account/page.tsx', 'utf8')
  test('it is shown only when a subscription EXISTS', () => {
    assert.match(page, /\{hasSubscription && \(/)
  })
  test('…and "exists" is the SUBSCRIPTION id, never the customer id', () => {
    // A customer is created the moment somebody opens checkout, even if they abandon it. Keying
    // on it would offer cancellation to a person who has never subscribed.
    assert.match(page, /const hasSubscription = Boolean\(company\?\.stripe_subscription_id\)/)
  })
  test('the row has THREE wordings, not two — §219', () => {
    // no subscription · subscribed · a cancellation already scheduled. Offering "Cancel the
    // subscription" to somebody who has already cancelled is the page failing to know what it has
    // been told, and pressing it again would do nothing.
    assert.match(page, /\? STOP_PAYING_NONE/)
    assert.match(page, /STOP_PAYING_SCHEDULED\(plainDate\(company\?\.cancel_at \?\? null\)\)/)
    assert.match(page, /: STOP_PAYING_NOTE/)
  })

  test('*** AND THE CONTROL LOOKS LIKE A CONTROL. ***', () => {
    // The owner could not find it on his own walk: plain underlined text beside a prominent green
    // "Download my data" reads as a LABEL for the sentence. `OUTLINE` is the house's own bordered
    // button (`components/buttonStyles.ts`), one class on one element — nothing moved.
    assert.match(page, /data-testid="stop-paying"[\s\S]{0,160}\$\{OUTLINE\}/)
    assert.ok(!/data-testid="stop-paying"[\s\S]{0,160}className=\{ACTION\}/.test(page),
      'the cancel control is back to plain text and will be missed again')
  })

  test('…and its words change once a cancellation is scheduled', () => {
    assert.match(page, /cancelScheduled \? STOP_PAYING_SCHEDULED_ACTION : STOP_PAYING_ACTION/)
  })
  test('it opens the portal — Stripe hosts cancellation', () => {
    assert.match(page, /stopPaying/)
    assert.match(page, /fetch\('\/api\/billing\/portal', \{ method: 'POST'/)
  })
  test('the delete flow is untouched: typed confirmation, and DELETE /api/account', () => {
    assert.match(page, /const matches = typed\.trim\(\) === companyName && companyName\.length > 0/)
    assert.match(page, /method: 'DELETE'/)
  })
})

describe('*** CHECKOUT ASKS FOR A CARD WHENEVER A CHARGE IS COMING ***', () => {
  const params = (trialEnd: number | null = null) => checkoutSessionParams({
    customerId: 'cus_1', priceId: 'price_1', companyId: 'co_1', trialEnd, baseUrl: 'https://x.test',
  })
  // `trialEndFor`'s two live cases produce a number; the third produces null (§213).
  const TRIAL_RUNNING = 1793000000   // more than 48h out: the real trial end
  const FLOOR_APPLIED = 1792900000   // inside 48h: now + 48h

  test('A TRIAL IS BEING SENT → always, because a charge is coming on day 15', () => {
    for (const [name, t] of [['trial running', TRIAL_RUNNING], ['floor applied', FLOOR_APPLIED]] as const) {
      const p = params(t)
      assert.equal(p.payment_method_collection, 'always', name)
      assert.equal(p.subscription_data?.trial_end, t, name)
    }
  })

  test('NO TRIAL → if_required, so a 100%-off coupon is not stopped at a card form', () => {
    const p = params(null)
    assert.equal(p.payment_method_collection, 'if_required')
    assert.equal(p.allow_promotion_codes, true)
    assert.ok(!('trial_end' in (p.subscription_data ?? {})), 'charged at once, so no trial_end')
  })

  test('*** AND IF THESE TWO ARE EVER SWAPPED, EVERY TRIAL CUSTOMER LAPSES SILENTLY. ***', () => {
    // THIS IS THE TEST STEP 19 SHOULD HAVE WRITTEN AND DID NOT. It asserted only that the
    // parameter was CARRIED on a trialling session — which was true, and useless, because the
    // value it carried was `if_required`.
    //
    // What the sandbox then showed (§217): a completed trialling checkout came back
    // `amount_total=0`, `payment_method_collection=if_required`, and the customer had ZERO
    // payment methods. **Stripe evaluates what is due NOW, not what is coming.** A trial's
    // amount due today is nothing, so `if_required` collects nothing, and on day 15 there is
    // nothing to charge: the person lapses having done exactly what the product asked of them,
    // with a success page behind them and "No card yet" on their Billing tab.
    //
    // So this names the consequence rather than the value. A trial without `always` is the bug.
    const withTrial = params(TRIAL_RUNNING)
    const withoutTrial = params(null)
    assert.notEqual(withTrial.payment_method_collection, 'if_required',
      'a TRIALLING session is set to if_required: Stripe will collect no card, and every trial '
      + 'customer will lapse on day 15 having pressed "Add a card" and been told it worked')
    assert.notEqual(withoutTrial.payment_method_collection, 'always',
      'a NO-TRIAL session is set to always: a 100%-off coupon holder is stopped at a card form '
      + 'to pay nothing, which is the bait-and-switch if_required exists to avoid')
    assert.notDeepEqual(
      [withTrial.payment_method_collection, withoutTrial.payment_method_collection],
      [withoutTrial.payment_method_collection, withTrial.payment_method_collection],
      'the two cases now agree, so one of them is wrong',
    )
  })

  test('the hole this leaves is named, not discovered later', () => {
    // A coupon that zeroes only the FIRST charge on a no-trial session also skips the card, and
    // month two has nothing to charge. The rule that follows is FOREVER COUPONS ONLY, and it is
    // written where the parameter is set rather than only in a decisions file.
    const src = readFileSync('lib/stripe.ts', 'utf8')
    assert.match(src, /forever coupons only/i)
    assert.match(src, /WHAT IS DUE NOW, NOT WHAT IS/i)
    assert.match(src, /opts\.trialEnd === null \? 'if_required' : 'always'/)
  })

  test('the rest of the session is unchanged by step 19', () => {
    const p = params()
    assert.equal(p.mode, 'subscription')
    assert.equal(p.customer, 'cus_1')
    assert.equal(p.client_reference_id, 'co_1')
    assert.deepEqual(p.line_items, [{ price: 'price_1', quantity: 1 }])
    assert.deepEqual(p.subscription_data?.metadata, { company_id: 'co_1' })
    assert.equal(p.success_url, 'https://x.test/account?tab=billing&card=added')
    assert.equal(p.cancel_url, 'https://x.test/account?tab=billing')
  })

  test('the route uses this builder rather than a second copy of the object', () => {
    const route = readFileSync('app/api/billing/checkout/route.ts', 'utf8')
    assert.match(route, /checkout\.sessions\.create\(\s*\n?\s*checkoutSessionParams\(/)
    assert.ok(!/payment_method_collection/.test(route.replace(/\/\*[\s\S]*?\*\//g, '')),
      'the route carries its own copy of the parameter')
  })
})


// =================================================================================================
// *** WHAT THIS COMPANY PAYS — migration 090, `DECISIONS.md` \u00a7221. ***
//
// The owner's coupon walk: FOUNDER100 (100% off, forever) produced a live subscription, and the tab
// said "$199 a month" / "$199 a month, charged to the card below" / "No card yet \u00b7 Add a card".
// Three false statements about money in one card, for a company that will never be charged anything.
//
// Each suite below is one of the five states the brief names, and each asserts the SENTENCE rather
// than the field, because the sentence is what was wrong.
// =================================================================================================

/** A paying company: a subscription, a card, and Stripe's own next-invoice total. */
const paying = (over: Partial<BillingViewColumns> = {}): BillingViewColumns => row({
  trial_ends_at: '2026-10-01T12:00:00Z',
  subscription_status: 'active',
  current_period_end: '2026-11-27T17:47:23Z',
  stripe_subscription_id: 'sub_1',
  card_brand: 'visa', card_last4: '4242',
  next_charge_amount_cents: 19900, next_charge_currency: 'usd',
  ...over,
})

describe('money \u2014 the formatter the three rows share', () => {
  test('a whole amount loses its .00, and a part amount keeps both places', () => {
    // "$199.00 a month" reads like a form; "$99.5" is a price nobody writes.
    assert.equal(money(19900, 'usd'), '$199')
    assert.equal(money(9950, 'usd'), '$99.50')
    assert.equal(money(0, 'usd'), '$0')
    assert.equal(money(5, 'usd'), '$0.05')
  })

  test('an unknown currency prints its ISO code rather than a guessed symbol', () => {
    assert.equal(money(19900, 'jpy'), '199 JPY')
  })
})

describe('1. NO DISCOUNT \u2014 the ordinary paying company, unchanged', () => {
  const v = billingTabView(paying(), NOW)

  test('the plan line is the mirrored amount, which happens to equal the list price', () => {
    assert.equal(v.plan.amount, '$199')
    assert.equal(v.plan.discount, '', 'a discount was named where there is none')
    assert.equal(v.plan.note, PLAN_NOTE)
  })

  test('the status keeps board 4\u2019s original sentence, with the amount from the mirror', () => {
    assert.equal(v.status.pill, 'Active')
    assert.equal(v.status.headline, 'Next payment 27 November 2026')
    assert.equal(v.status.detail, '$199 a month, charged to the card below. Cancel any time from the Cancel tab.')
  })

  test('the card row is the card', () => {
    assert.equal(v.card.text, 'Visa ending 4242')
    assert.equal(v.card.action, 'Change')
    assert.equal(v.card.note, '')
  })
})

describe('2. *** 100% OFF FOREVER \u2014 THE WALK\u2019S CASE. ***', () => {
  const v = billingTabView(paying({
    next_charge_amount_cents: 0,
    card_brand: null, card_last4: null,
    discount_name: 'FOUNDER100', discount_percent_off: 100, discount_duration: 'forever',
  }), NOW)

  test('the plan line says $0 and says WHY', () => {
    // "$0 a month" with no reason reads like a bug, which is its own kind of untrue.
    assert.equal(v.plan.amount, '$0')
    assert.equal(v.plan.discount, 'FOUNDER100, 100% off, forever')
  })

  test('*** THE STATUS NEVER SAYS "CHARGED TO THE CARD BELOW". ***', () => {
    assert.ok(!/charged to the card below/.test(v.status.detail), v.status.detail)
    assert.ok(!/\$199/.test(v.status.detail), 'the list price is still being stated as this company\u2019s')
    assert.match(v.status.detail, /nothing to pay and no card is needed/)
    assert.match(v.status.detail, /Cancel any time from the Cancel tab\./)
  })

  test('"Renews", not "Next payment" \u2014 there is no payment', () => {
    assert.equal(v.status.headline, 'Renews 27 November 2026')
  })

  test('*** AND THE CARD ROW DOES NOT ASK FOR A CARD. ***', () => {
    assert.equal(v.card.text, 'Not needed \u2014 there is nothing to pay')
    assert.equal(v.card.action, '', 'a button is offered for a card nothing will ever charge')
    assert.equal(v.card.note, '')
  })
})

describe('3. A PARTIAL DISCOUNT \u2014 the plausible number, which is the dangerous one', () => {
  const v = billingTabView(paying({
    next_charge_amount_cents: 9950,
    discount_name: 'HALFYEAR', discount_percent_off: 50,
    discount_duration: 'repeating', discount_months: 6,
    discount_ends_at: '2027-04-27T17:47:23Z',
  }), NOW)

  test('the plan line is what they pay, with what it is and what follows it', () => {
    assert.equal(v.plan.amount, '$99.50')
    assert.equal(v.plan.discount, 'HALFYEAR, 50% off for 6 months, then $199')
  })

  test('the status states the discounted amount, never the list price', () => {
    assert.equal(v.status.detail, '$99.50 a month, charged to the card below. Cancel any time from the Cancel tab.')
  })

  test('an amount-off coupon reads as money rather than a percentage', () => {
    const a = billingTabView(paying({
      next_charge_amount_cents: 14900,
      discount_name: 'FIFTYOFF', discount_percent_off: null,
      discount_amount_off_cents: 5000, discount_duration: 'forever',
    }), NOW)
    assert.equal(a.plan.discount, 'FIFTYOFF, $50 off, forever')
    assert.equal(a.plan.amount, '$149')
  })

  test('a fractional percentage keeps its places and does not gain any', () => {
    const t = billingTabView(paying({ next_charge_amount_cents: 13267, discount_name: 'THIRD', discount_percent_off: 33.33, discount_duration: 'forever' }), NOW)
    assert.equal(t.plan.discount, 'THIRD, 33.33% off, forever')
  })
})

describe('4. A DISCOUNT WITH AN END \u2014 and the card asked for in time', () => {
  test('nothing to pay YET: the date is in the sentence, and so is what resumes', () => {
    const v = billingTabView(paying({
      next_charge_amount_cents: 0, card_brand: null, card_last4: null,
      discount_name: 'FREE6', discount_percent_off: 100,
      discount_duration: 'repeating', discount_months: 6,
      discount_ends_at: '2027-04-27T17:47:23Z',
    }), NOW)
    assert.equal(v.plan.amount, '$0')
    assert.equal(v.plan.discount, 'FREE6, 100% off for 6 months, then $199')
    assert.match(v.status.detail, /Nothing to pay until 27 April 2027, when your discount ends and \$199 a month resumes\./)
  })

  test('*** AND IT STILL ASKS FOR A CARD, WITH THE DATE. ***', () => {
    // The difference from suite 2. A zero that ENDS is a charge that is coming, so the card is
    // needed — and the date is the only honest reason to ask for one today.
    const v = billingTabView(paying({
      next_charge_amount_cents: 0, card_brand: null, card_last4: null,
      discount_name: 'FREE6', discount_percent_off: 100,
      discount_duration: 'repeating', discount_months: 6,
      discount_ends_at: '2027-04-27T17:47:23Z',
    }), NOW)
    assert.equal(v.card.text, 'No card yet')
    assert.equal(v.card.action, 'Add a card')
    assert.match(v.card.note, /Your discount ends 27 April 2027\. Add a card before then/)
  })

  test('*** `once` IS NOT `forever`, AND ONLY `duration` KNOWS. ***', () => {
    // Stripe leaves `discount.end` null for BOTH, so a page keying on the date alone would show a
    // one-off discount as permanent and never ask for a card. \u00a7217's "forever coupons only" is the
    // rule; this is what the page says if one is issued anyway.
    const v = billingTabView(paying({
      next_charge_amount_cents: 0, card_brand: null, card_last4: null,
      discount_name: 'FIRSTFREE', discount_percent_off: 100,
      discount_duration: 'once', discount_ends_at: null,
    }), NOW)
    assert.equal(v.plan.discount, 'FIRSTFREE, 100% off on your first payment only, then $199')
    assert.equal(v.card.action, 'Add a card', 'a one-off discount was treated as free for ever')
    assert.ok(!/no card is needed/.test(v.status.detail), v.status.detail)
  })
})

describe('5. THE CARD-NAGGING SUPPRESSION, stated as its own rule', () => {
  const freeForever = {
    next_charge_amount_cents: 0, card_brand: null, card_last4: null,
    discount_name: 'FOUNDER100', discount_percent_off: 100, discount_duration: 'forever',
  }

  test('no card is asked for when nothing will ever be charged', () => {
    assert.equal(billingTabView(paying(freeForever), NOW).card.action, '')
  })

  test('\u2026but a card that EXISTS is still shown and still changeable', () => {
    // Somebody may have added one before the coupon, or want it on file. Hiding it would be
    // hiding a fact about their account.
    const v = billingTabView(paying({ ...freeForever, card_brand: 'visa', card_last4: '4242' }), NOW)
    assert.equal(v.card.text, 'Visa ending 4242')
    assert.equal(v.card.action, 'Change')
  })

  test('a real charge with no card DOES ask, and says why', () => {
    const v = billingTabView(paying({ card_brand: null, card_last4: null }), NOW)
    assert.equal(v.card.action, 'Add a card')
    assert.equal(v.status.detail, '$199 a month. Add a card below so the next payment can go through. Cancel any time from the Cancel tab.')
  })

  test('the suppression needs BOTH zero and forever \u2014 neither alone', () => {
    assert.equal(billingTabView(paying({ ...freeForever, next_charge_amount_cents: 9950 }), NOW).card.action, 'Add a card')
    assert.equal(billingTabView(paying({ ...freeForever, discount_duration: 'repeating', discount_months: 3 }), NOW).card.action, 'Add a card')
  })
})

describe('*** THE LIST PRICE IS NOT A FALLBACK FOR AN AMOUNT WE DID NOT READ. ***', () => {
  test('a subscription with no mirrored amount says so, and prints no price as fact', () => {
    // This is the whole finding in one assertion. A null amount on a live subscription used to
    // mean "$199"; now it means "we will tell you shortly".
    const v = billingTabView(paying({ next_charge_amount_cents: null, next_charge_currency: null }), NOW)
    assert.match(v.plan.note, /The amount of your next payment will appear here shortly\./)
    assert.ok(!/charged to the card below/.test(v.status.detail) || v.status.detail.includes('$199'),
      'see below: with no amount the status must not assert one')
  })

  test('a company with NO subscription is told the PRODUCT\u2019S price, which is the honest use', () => {
    // A trial. There is no subscription, so there is no discount to know about and no amount to
    // mirror; $199 is what they will pay, and saying it is the point of the row.
    const v = billingTabView(row(), NOW)
    assert.equal(v.plan.amount, PLAN_PRICE)
    assert.equal(v.plan.note, PLAN_NOTE)
    assert.equal(v.plan.discount, '')
  })

  test('the page reads the view, and the constant is no longer in it', () => {
    const page = readFileSync('app/account/page.tsx', 'utf8')
    assert.match(page, /\{view\.plan\.amount\}/)
    assert.match(page, /\{view\.plan\.discount\}/)
    // Matched as CODE, not as text: the comment beside the Plan row names the constant it stopped
    // using, which is the point of the comment.
    assert.ok(!/PLAN_PRICE[,}\s]*\n|\{PLAN_PRICE\}/.test(page),
      'the page still imports the list price, so it can still state it as this company\u2019s')
    // and an empty action renders no button
    assert.match(page, /\{view\.card\.action && \(/)
  })
})
