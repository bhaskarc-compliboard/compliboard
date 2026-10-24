/**
 * WHAT A COMPANY MAY DO, AND WHAT WE TELL STRIPE — `lib/billing.ts`, My Account step 17.
 *
 * Both functions take `now`, which is the whole reason this file can test a trial boundary, a
 * 48-hour floor and a seven-day grace without waiting a fortnight for any of them.
 *
 * The three trial cases of `trialEndFor` and EVERY status word `accessFor` can meet — Stripe's
 * eight, `null`, and one Stripe has not invented yet — are each exercised below, because this is
 * the rule that decides whether a paying customer is refused.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  accessFor, trialEndFor, TRIAL_DAYS, GRACE_DAYS, STRIPE_TRIAL_END_FLOOR_HOURS, KNOWN_STATUSES,
  graceDaysLeft, bannerFor, bannerFromRow, pausedFromRow,
  type BillingColumns,
} from '../../lib/billing.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** A fixed clock, so every expectation below is arithmetic rather than a race with the test run. */
const NOW = new Date('2026-10-23T12:00:00.000Z')
const at = (ms: number) => new Date(NOW.getTime() + ms)

const company = (over: Partial<BillingColumns> = {}): BillingColumns => ({
  trial_ends_at: at(5 * DAY).toISOString(),
  subscription_status: null,
  payment_failed_at: null,
  ...over,
})

// =================================================================================================
describe('trialEndFor — the three cases, and the 48-hour floor that makes it three', () => {
// =================================================================================================

  test('more than 48 hours of trial left: Stripe is told the real trial end', () => {
    const d = trialEndFor(at(5 * DAY).toISOString(), NOW)
    assert.equal(d.case, 'trial_running')
    assert.equal(d.trialEnd, Math.ceil(at(5 * DAY).getTime() / 1000))
  })

  test('INSIDE the floor: the real date would be refused by Stripe, so it is now + 48 hours', () => {
    // A person adding a card on day 13 of 14. Sending their real trial end is a 400 from Stripe
    // ("has to be at least 48 hours in the future"), so they could not add a card at all.
    const d = trialEndFor(at(24 * HOUR).toISOString(), NOW)
    assert.equal(d.case, 'floor_applied')
    assert.equal(d.trialEnd, Math.ceil((NOW.getTime() + 48 * HOUR) / 1000))
    // ...and the floor is LATER than their real trial end, never earlier: up to two free days.
    assert.ok(d.trialEnd! > Math.ceil(at(24 * HOUR).getTime() / 1000))
  })

  test('...and the floor NEVER charges before day 15, which omitting trial_end would', () => {
    // The point of the branch. With one day of trial left, no trial_end means an immediate charge.
    const d = trialEndFor(at(1 * HOUR).toISOString(), NOW)
    assert.notEqual(d.trialEnd, null, 'a trial still running must never produce an immediate charge')
    assert.ok(d.trialEnd! * 1000 > NOW.getTime())
  })

  test('the trial is over: no trial at all, so the card is charged at once and access comes back', () => {
    assert.deepEqual(trialEndFor(at(-1 * DAY).toISOString(), NOW), { trialEnd: null, case: 'trial_over' })
    assert.deepEqual(trialEndFor(at(-1).toISOString(), NOW), { trialEnd: null, case: 'trial_over' })
  })

  test('the two boundaries, to the millisecond', () => {
    // Exactly now is over. Exactly 48 hours out is inside the floor, because Stripe says "at
    // least" and a timestamp computed here is already in the past by the time Stripe reads it.
    assert.equal(trialEndFor(NOW.toISOString(), NOW).case, 'trial_over')
    assert.equal(trialEndFor(at(1).toISOString(), NOW).case, 'floor_applied')
    assert.equal(trialEndFor(at(48 * HOUR).toISOString(), NOW).case, 'floor_applied')
    assert.equal(trialEndFor(at(48 * HOUR + 1).toISOString(), NOW).case, 'trial_running')
  })

  test('a Date and an ISO string are the same input', () => {
    assert.deepEqual(trialEndFor(at(5 * DAY), NOW), trialEndFor(at(5 * DAY).toISOString(), NOW))
  })

  test('the timestamp is whole SECONDS, which is what Stripe takes', () => {
    const d = trialEndFor(new Date('2026-11-01T00:00:00.500Z'), NOW)
    assert.equal(d.trialEnd, Math.ceil(new Date('2026-11-01T00:00:00.500Z').getTime() / 1000))
    assert.equal(Number.isInteger(d.trialEnd), true)
  })
})

// =================================================================================================
describe('accessFor — the trial comes first, and nothing takes back a day already given', () => {
// =================================================================================================

  test('the guard can see a YES at all — or every assertion below would pass on a broken rule', () => {
    // §9a: when a check reports an absence, prove it can see a presence first. A rule that returned
    // read_only for everything would satisfy most of this file.
    assert.equal(accessFor(company(), NOW).access, 'full')
  })

  test('inside the trial: full, with nothing else consulted', () => {
    const v = accessFor(company(), NOW)
    assert.deepEqual(v, { access: 'full', reason: 'trial', status: null })
  })

  test('...even when the subscription was cancelled on day 3', () => {
    // The promise was fourteen days. Cancelling does not claw back the eleven that are left.
    for (const status of KNOWN_STATUSES) {
      const v = accessFor(company({ subscription_status: status }), NOW)
      assert.equal(v.access, 'full', `cancelled-during-trial lost access on status ${status}`)
      assert.equal(v.reason, 'trial')
    }
  })

  test('the trial boundary, to the millisecond', () => {
    assert.equal(accessFor(company({ trial_ends_at: at(1).toISOString() }), NOW).access, 'full')
    assert.equal(accessFor(company({ trial_ends_at: NOW.toISOString() }), NOW).access, 'read_only')
  })

  test('the trial ran out and no card was ever added: read-only, and the reason says which', () => {
    const v = accessFor(company({ trial_ends_at: at(-1 * DAY).toISOString() }), NOW)
    assert.deepEqual(v, { access: 'read_only', reason: 'trial_over_no_subscription', status: null })
  })
})

// =================================================================================================
describe('accessFor — EVERY status word, after the trial has run out', () => {
// =================================================================================================
  const expired = (over: Partial<BillingColumns> = {}) =>
    company({ trial_ends_at: at(-1 * DAY).toISOString(), ...over })

  test('active and trialing pay for access', () => {
    for (const status of ['active', 'trialing']) {
      const v = accessFor(expired({ subscription_status: status }), NOW)
      assert.deepEqual(v, { access: 'full', reason: 'subscribed', status })
    }
  })

  test('canceled, paused, incomplete and incomplete_expired do not', () => {
    for (const status of ['canceled', 'paused', 'incomplete', 'incomplete_expired']) {
      const v = accessFor(expired({ subscription_status: status }), NOW)
      assert.deepEqual(v, { access: 'read_only', reason: 'not_paying', status })
    }
  })

  test('null — never subscribed — is the ordinary end of a free trial', () => {
    const v = accessFor(expired({ subscription_status: null }), NOW)
    assert.deepEqual(v, { access: 'read_only', reason: 'trial_over_no_subscription', status: null })
  })

  test('*** AND A WORD STRIPE HAS NOT INVENTED YET IS REFUSED BY NAME, NOT MISTAKEN FOR A KNOWN ONE ***', () => {
    // The column is `text` and not an ENUM precisely so this value can be RECORDED (migration 087).
    // Here it must also be SAFE: read_only, and the reason quotes the word so the refusal can say
    // what it did not understand instead of going quiet.
    for (const status of ['something_stripe_adds_in_2027', 'ACTIVE', 'active ', '', 'trial']) {
      const v = accessFor(expired({ subscription_status: status }), NOW)
      assert.equal(v.access, 'read_only', `an unknown status "${status}" granted access`)
      assert.equal(v.reason, 'status_not_recognised')
      assert.equal(v.status, status, 'the refusal cannot quote the word it did not know')
    }
  })

  test('every one of Stripe\'s eight words reaches a reason that is NOT "not recognised"', () => {
    // The complement of the test above, and the one that would fail if Stripe's vocabulary moved
    // under us: a word in KNOWN_STATUSES must be handled by a branch, never by the fall-through.
    for (const status of KNOWN_STATUSES) {
      const v = accessFor(expired({ subscription_status: status }), NOW)
      assert.notEqual(v.reason, 'status_not_recognised', `${status} fell through to the default`)
    }
  })
})

// =================================================================================================
describe('accessFor — decision 11\'s seven days, which is a window and not a flag', () => {
// =================================================================================================
  const failed = (status: string, failedAgo: number | null) => accessFor(company({
    trial_ends_at: at(-30 * DAY).toISOString(),
    subscription_status: status,
    payment_failed_at: failedAgo === null ? null : at(-failedAgo).toISOString(),
  }), NOW)

  test('a payment failed an hour ago: still working, and the reason says why', () => {
    for (const status of ['active', 'past_due', 'unpaid']) {
      const v = failed(status, 1 * HOUR)
      assert.equal(v.access, 'full', `${status} lost access inside the grace`)
      assert.equal(v.reason, 'payment_failed_in_grace')
    }
  })

  test('the seven-day boundary, to the millisecond', () => {
    assert.equal(failed('past_due', GRACE_DAYS * DAY).access, 'full')
    assert.equal(failed('past_due', GRACE_DAYS * DAY + 1).access, 'read_only')
    assert.equal(failed('past_due', GRACE_DAYS * DAY + 1).reason, 'payment_failed_grace_over')
  })

  test('the grace runs out even while Stripe still says active', () => {
    // Stripe may not have moved the subscription off `active` yet. The grace is OURS and it has run.
    const v = failed('active', 8 * DAY)
    assert.deepEqual(v, { access: 'read_only', reason: 'payment_failed_grace_over', status: 'active' })
  })

  test('past_due with NO anchor: full, because Stripe is still retrying and the anchor is coming', () => {
    // "Once Stripe has exhausted all payment retry attempts, the subscription will become canceled
    // or unpaid" — so in past_due another invoice.payment_failed is still due, and it will set the
    // anchor. Our mirror dropped an event; the customer does not pay for that. Bounded by Stripe.
    const v = failed('past_due', null)
    assert.deepEqual(v, { access: 'full', reason: 'payment_failed_retrying', status: 'past_due' })
  })

  test('*** unpaid with NO anchor: read-only, because no further attempt will ever be made ***', () => {
    // "when a subscription has a status of unpaid, no subsequent invoices will be attempted" — so an
    // anchor that has not arrived is never going to. Being kind here would be full access for ever.
    const v = failed('unpaid', null)
    assert.deepEqual(v, { access: 'read_only', reason: 'not_paying', status: 'unpaid' })
  })

  test('and the two differ ONLY in that one fact, which is the point', () => {
    assert.equal(failed('past_due', null).access, 'full')
    assert.equal(failed('unpaid', null).access, 'read_only')
    assert.equal(failed('past_due', 1 * HOUR).access, failed('unpaid', 1 * HOUR).access)
    assert.equal(failed('past_due', 9 * DAY).access, failed('unpaid', 9 * DAY).access)
  })

  test('a failed payment during the trial changes nothing: the trial still wins', () => {
    const v = accessFor(company({ subscription_status: 'past_due', payment_failed_at: at(-30 * DAY).toISOString() }), NOW)
    assert.deepEqual(v, { access: 'full', reason: 'trial', status: 'past_due' })
  })
})

// =================================================================================================
describe('the number 14 lives in two places, and this is what stops them drifting', () => {
// =================================================================================================

  test('TRIAL_DAYS agrees with migration 087\'s SQL default on companies.trial_ends_at', () => {
    // Migration 087's own check 10 compares them inside the database. This compares them from the
    // other side, offline, so `npm run check` fails on a drift without a database to hand.
    const sql = readFileSync('supabase/migrations/087_what_stripe_tells_us.sql', 'utf8')
    const m = sql.match(/default \(now\(\) \+ interval '(\d+) days'\)/)
    assert.ok(m, 'no 14-day default found in migration 087 — has the column default moved?')
    assert.equal(Number(m![1]), TRIAL_DAYS, `SQL says ${m![1]} days, lib/billing.ts says ${TRIAL_DAYS}`)
  })

  test('the constants are the decisions they claim to be', () => {
    assert.equal(TRIAL_DAYS, 14)                      // the owner, 23 Oct; five places of marketing copy
    assert.equal(GRACE_DAYS, 7)                       // ACCOUNT-PLAN decision 11
    assert.equal(STRIPE_TRIAL_END_FLOOR_HOURS, 48)    // Stripe's floor, not ours
    assert.equal(KNOWN_STATUSES.length, 8)            // Stripe's vocabulary as of 23 Oct 2026
  })
})

/* =================================================================================================
 * THE BANNER — My Account step 18, board 8, `ACCOUNT-PLAN.md` decision 11.
 * ============================================================================================== */

describe('graceDaysLeft — honest arithmetic, including the awkward numbers', () => {
  const failed = '2026-10-16T12:00:00Z'   // GRACE_DAYS = 7, so the grace ends 2026-10-23T12:00
  const at = (iso: string) => graceDaysLeft(failed, new Date(iso))

  test('7 on the day it failed', () => { assert.equal(at('2026-10-16T12:00:00Z'), 7) })
  test('1 on the last full day', () => { assert.equal(at('2026-10-22T12:00:00Z'), 1) })
  test('0 at the exact moment the grace ends', () => { assert.equal(at('2026-10-23T12:00:00Z'), 0) })
  test('negative after it, which is what makes the clamp in bannerFor visible', () => {
    assert.equal(at('2026-10-25T12:00:00Z'), -2)
  })
  test('it rounds UP, so a part-day still counts as a day somebody has', () => {
    assert.equal(at('2026-10-22T23:59:00Z'), 1)
  })
})

describe('bannerFor — four texts, and nothing when nothing is wrong', () => {
  const now = new Date('2026-10-23T12:00:00Z')
  const past = '2026-10-01T00:00:00Z'
  const future = '2026-11-30T00:00:00Z'
  const opts = (p: string | null = null, sub = false) =>
    ({ paymentFailedAt: p, hasSubscription: sub, now })

  test('1. the trial ended and no card was added — board 8\'s words, exactly', () => {
    const b = bannerFor(accessFor({ trial_ends_at: past, subscription_status: null, payment_failed_at: null }, now), opts())
    assert.equal(b?.kind, 'trial_over')
    assert.equal(b?.text, 'Your trial has ended. Everything is still here to read and download. '
      + 'Add a card to keep asking, reading documents and auditing.')
    assert.equal(b?.button, 'Add a card')
  })

  test('2. the card failed and the grace is running — WITH N, AND ACCESS IS STILL FULL', () => {
    const threeDaysAgo = '2026-10-20T12:00:00Z'
    const verdict = accessFor({ trial_ends_at: past, subscription_status: 'past_due', payment_failed_at: threeDaysAgo }, now)
    assert.equal(verdict.access, 'full', 'the grace must not take access away')
    const b = bannerFor(verdict, opts(threeDaysAgo))
    assert.equal(b?.kind, 'in_grace')
    assert.equal(b?.text, "We couldn't charge your card. We'll try again for 4 more days "
      + '— update it to keep everything running.')
    assert.equal(b?.button, 'Update your card')
  })

  test('…and on the last day it says "1 more day", not "1 more days"', () => {
    const sixDaysAgo = '2026-10-17T12:00:00Z'
    const b = bannerFor(accessFor({ trial_ends_at: past, subscription_status: 'past_due', payment_failed_at: sixDaysAgo }, now), opts(sixDaysAgo))
    assert.match(b!.text, /for 1 more day —/)
  })

  test('…and at N = 0 it is CLAMPED to 1, because "0 more days" is not a sentence', () => {
    const exactly7 = '2026-10-16T12:00:00Z'   // graceDaysLeft is 0 at this instant
    assert.equal(graceDaysLeft(exactly7, now), 0)
    const verdict = accessFor({ trial_ends_at: past, subscription_status: 'past_due', payment_failed_at: exactly7 }, now)
    assert.equal(verdict.reason, 'payment_failed_in_grace', 'the boundary is inclusive')
    assert.match(bannerFor(verdict, opts(exactly7))!.text, /for 1 more day —/)
  })

  test('3. the grace ran out', () => {
    const tenDaysAgo = '2026-10-13T12:00:00Z'
    const b = bannerFor(accessFor({ trial_ends_at: past, subscription_status: 'past_due', payment_failed_at: tenDaysAgo }, now), opts(tenDaysAgo))
    assert.equal(b?.kind, 'grace_over')
    assert.match(b!.text, /the 7 days are up/)
    assert.match(b!.text, /still here to read and download/)
    assert.equal(b?.button, 'Update your card')
  })

  test('4. not paying, and a status we do not know, share one text', () => {
    for (const status of ['canceled', 'unpaid', 'paused', 'incomplete', 'incomplete_expired', 'teleported']) {
      const b = bannerFor(accessFor({ trial_ends_at: past, subscription_status: status, payment_failed_at: null }, now), opts())
      assert.equal(b?.kind, 'not_active', status)
      assert.match(b!.text, /Your subscription isn't active\./)
    }
  })

  test('nothing at all while the trial is running, or while subscribed', () => {
    assert.equal(bannerFor(accessFor({ trial_ends_at: future, subscription_status: null, payment_failed_at: null }, now), opts()), null)
    assert.equal(bannerFor(accessFor({ trial_ends_at: past, subscription_status: 'active', payment_failed_at: null }, now), opts()), null)
  })

  test('…and nothing for `payment_failed_retrying`, which is the one deliberate gap', () => {
    // `past_due` with no anchor. There is no N to quote, and `accessFor` reasons it is our mirror
    // having dropped an event rather than their card having failed. The banner arrives when the
    // next `invoice.payment_failed` writes the anchor. Asserted so the gap is a decision on the
    // record rather than an omission somebody finds later.
    const v = accessFor({ trial_ends_at: past, subscription_status: 'past_due', payment_failed_at: null }, now)
    assert.equal(v.reason, 'payment_failed_retrying')
    assert.equal(v.access, 'full')
    assert.equal(bannerFor(v, opts()), null)
  })

  test('*** THE BUTTON GOES TO THE PORTAL ONLY WHEN A SUBSCRIPTION EXISTS. ***', () => {
    // CORRECTED 24 OCTOBER 2026 (§218). This asserted the door by `hasStripeCustomer`, with the
    // reason "sending somebody with a dead card to checkout would make them a second Stripe
    // customer". **That reason was never true**: `app/api/billing/checkout/route.ts:61` reads
    // `company.stripe_customer_id` and only creates one when it is null, so the stored customer
    // is reused. The old rule sent anybody who had merely OPENED checkout to the portal, where a
    // card can be added that nothing will ever charge.
    const v = accessFor({ trial_ends_at: past, subscription_status: 'canceled', payment_failed_at: null }, now)
    assert.equal(bannerFor(v, opts(null, false))?.action, 'checkout', 'no subscription → checkout')
    assert.equal(bannerFor(v, opts(null, true))?.action, 'portal', 'subscription → portal')
  })
})

describe('bannerFromRow / pausedFromRow — the one difference between them', () => {
  const now = new Date('2026-10-23T12:00:00Z')
  const past = '2026-10-01T00:00:00Z'
  const inGrace = { trial_ends_at: past, subscription_status: 'past_due', payment_failed_at: '2026-10-20T12:00:00Z' }

  test('*** THE BAND SHOWS IN THE GRACE; THE CONTROLS DO NOT PAUSE. ***', () => {
    // This is the whole reason there are two functions. A banner drawn only on `read_only` would
    // first appear on day 8 — telling somebody about a window that has already shut. And buttons
    // disabled during the grace would take away the seven days the banner is promising.
    assert.equal(bannerFromRow(inGrace, now)?.kind, 'in_grace', 'the layout would show nothing')
    assert.equal(pausedFromRow(inGrace, now), null, 'the controls were disabled inside the grace')
  })

  test('once read-only, both say the same thing', () => {
    const lapsed = { trial_ends_at: past, subscription_status: null, payment_failed_at: null }
    assert.equal(bannerFromRow(lapsed, now)?.kind, 'trial_over')
    assert.equal(pausedFromRow(lapsed, now)?.kind, 'trial_over')
  })

  test('both are null for a paying company, so a paying screen is what it was', () => {
    const paying = { trial_ends_at: past, subscription_status: 'active', payment_failed_at: null }
    assert.equal(bannerFromRow(paying, now), null)
    assert.equal(pausedFromRow(paying, now), null)
  })

  test('both are null before the row has loaded — no flash of a banner on every page load', () => {
    assert.equal(bannerFromRow(null, now), null)
    assert.equal(pausedFromRow(null, now), null)
  })
})
