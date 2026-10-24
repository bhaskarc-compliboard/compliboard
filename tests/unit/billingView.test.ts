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
  billingTabView, plainDate, daysUntil, PLAN_PRICE, PLAN_NOTE, STRIPE_NOTE, MANAGE_LINK,
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
  stripe_customer_id: null,
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
    ['active, with a next payment date',
      { trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'active', current_period_end: '2026-11-30T12:00:00Z' },
      'Active', /charged to the card below/],
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

  test('a card on file → "Visa ending 4242", and that is the PORTAL', () => {
    const v = billingTabView(row({ card_brand: 'Visa', card_last4: '4242', stripe_customer_id: 'cus_1' }), NOW)
    assert.equal(v.card.text, 'Visa ending 4242')
    assert.equal(v.card.action, 'Change')
    assert.equal(v.card.door, 'portal')
  })

  test('*** A CUSTOMER WITHOUT A CARD STILL GOES TO THE PORTAL. ***', () => {
    // Somebody opened checkout and abandoned it: Stripe has a customer, we have no card line.
    // Sending them back to checkout would make a SECOND customer for the same company, which
    // migration 087's unique index on `stripe_customer_id` exists to make impossible.
    const v = billingTabView(row({ stripe_customer_id: 'cus_1' }), NOW)
    assert.equal(v.card.text, 'No card yet')
    assert.equal(v.card.action, 'Add a card')
    assert.equal(v.card.door, 'portal')
  })

  test('half a card line is not a card line', () => {
    // The webhook writes brand and last4 together or not at all, but a partial row must read as
    // "no card" rather than "Visa ending null".
    for (const half of [{ card_brand: 'Visa' }, { card_last4: '4242' }]) {
      assert.equal(billingTabView(row(half), NOW).card.text, 'No card yet')
    }
  })

  test('the card line is independent of the status', () => {
    const v = billingTabView(row({ trial_ends_at: '2026-10-01T12:00:00Z', subscription_status: 'canceled', card_brand: 'Mastercard', card_last4: '4444', stripe_customer_id: 'cus_2' }), NOW)
    assert.equal(v.status.pill, 'Canceled')
    assert.equal(v.card.text, 'Mastercard ending 4444')
    assert.equal(v.card.door, 'portal')
  })
})

describe("board 4's fixed words are the board's", () => {
  test('the plan line', () => {
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
  test('without one, the row says what is true instead of hiding silently', () => {
    assert.match(page, /\{hasSubscription \? STOP_PAYING_NOTE : STOP_PAYING_NONE\}/)
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

describe('*** THE CHECKOUT SESSION ASKS FOR A CARD ONLY WHEN THERE IS SOMETHING TO CHARGE ***', () => {
  const params = (trialEnd: number | null = null) => checkoutSessionParams({
    customerId: 'cus_1', priceId: 'price_1', companyId: 'co_1', trialEnd, baseUrl: 'https://x.test',
  })

  test('payment_method_collection is if_required', () => {
    assert.equal(params().payment_method_collection, 'if_required')
  })

  test('…so a 100%-off coupon needs no card, which is why promotion codes are on at all', () => {
    assert.equal(params().allow_promotion_codes, true)
    assert.equal(params().payment_method_collection, 'if_required')
  })

  test('it is carried on a TRIALLING session too, where a card is still collected', () => {
    // `if_required` is about the amount due being zero FOR EVER, not zero today: a trial has a
    // real charge coming, so Stripe still asks. Pinned because getting this backwards would mean
    // nobody on a trial ever gives us a card and every one of them lapses on day 15.
    const p = params(1793000000)
    assert.equal(p.payment_method_collection, 'if_required')
    assert.deepEqual(p.subscription_data?.trial_end, 1793000000)
  })

  test('no trial_end key at all once the trial is over — charged at once', () => {
    assert.ok(!('trial_end' in (params(null).subscription_data ?? {})))
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
