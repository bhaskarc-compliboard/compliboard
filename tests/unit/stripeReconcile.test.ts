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
  reconcileFromStripe, recordReconcile, didRepair, RECONCILE_DEADLINE_MS,
} from '../../lib/stripeReconcile.ts'
import { columnsFromFacts, type SubscriptionFacts, type StripePort } from '../../lib/stripeWebhook.ts'
import { reconcileTrigger, FINISHING_UP, FINISHING_STALLED } from '../../lib/billingView.ts'
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
describe('THE TRIGGER IS THE STATE, NOT THE QUERY STRING — the three cases the brief names', () => {
// =================================================================================================

  test('no Stripe customer → NO call. The ordinary trial, and most page loads.', () => {
    const t = reconcileTrigger({ stripe_customer_id: null, stripe_subscription_id: null }, false)
    assert.equal(t.call, false)
    assert.equal(t.say, null)
  })

  test('a customer AND a subscription → NO call. The mirror is already right.', () => {
    const t = reconcileTrigger({ stripe_customer_id: CUS, stripe_subscription_id: SUB }, false)
    assert.equal(t.call, false)
  })

  test('*** a customer and NO subscription → ONE call. The only state that cannot be right. ***', () => {
    const t = reconcileTrigger({ stripe_customer_id: CUS, stripe_subscription_id: null }, false)
    assert.equal(t.call, true)
  })

  test('`?card=added` changes only the WORDS, never whether the call is made', () => {
    // The widening, as a test: the same two columns decide the call in both rows below.
    const quiet = reconcileTrigger({ stripe_customer_id: CUS, stripe_subscription_id: null }, false)
    const back = reconcileTrigger({ stripe_customer_id: CUS, stripe_subscription_id: null }, true)
    assert.equal(quiet.call, back.call)
    assert.equal(quiet.say, null, 'somebody browsing is shown a progress message')
    assert.equal(back.say, FINISHING_UP)

    // …and it cannot make a call happen on a state that is fine. A bookmarked `?card=added` is
    // the case the state-based trigger exists to stop re-firing for ever.
    assert.equal(reconcileTrigger({ stripe_customer_id: CUS, stripe_subscription_id: SUB }, true).call, false)
    assert.equal(reconcileTrigger({ stripe_customer_id: null, stripe_subscription_id: null }, true).call, false)
  })

  test('a subscription with no customer — impossible, and still no call', () => {
    // Cannot happen (the checkout route writes the customer first), so the rule must not depend
    // on it being impossible.
    assert.equal(reconcileTrigger({ stripe_customer_id: null, stripe_subscription_id: SUB }, true).call, false)
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
    assert.deepEqual(
      out.kind === 'repaired' ? out.written : null,
      columnsFromFacts(facts()),
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

  test('already mirrored: Stripe is never asked either — the cheap exit', async () => {
    const db = makeDb({
      companies: [{ ...missedDelivery(), stripe_subscription_id: 'sub_already', subscription_status: 'active' }],
      stripe_events: [],
    })
    const { port, calls } = countingPort()
    const out = await reconcileFromStripe({ companyId: CO, db: db as never, port })
    assert.equal(out.kind, 'already_mirrored')
    assert.deepEqual(calls, [])
    assert.equal(db.tables.companies[0].stripe_subscription_id, 'sub_already')
  })
})

// =================================================================================================
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

  test('*** THE QUIET NO-OP IS DELIBERATELY NOT RECORDED. ***', async () => {
    // A company that abandoned Checkout sits in this state for ever. One row per page load would
    // fill the one table whose job is to make a payment fact findable with rows that are not
    // payment facts. The line is: a row when something changed, or when something went wrong.
    const db = makeDb({ companies: [missedDelivery()], stripe_events: [] })
    for (const outcome of [
      { kind: 'nothing_at_stripe' } as const,
      { kind: 'no_customer' } as const,
      { kind: 'already_mirrored', subscriptionId: SUB } as const,
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
    // No mapping in the route itself: if a column name appears here, somebody has started a
    // second copy of the write.
    assert.ok(!/stripe_subscription_id|subscription_status|card_brand/.test(ROUTE),
      'the route writes columns itself instead of going through the shared mapping')
  })
})

// =================================================================================================
describe('THE PAGE CALLS IT ONCE, THEN DRAWS', () => {
// =================================================================================================
  const PAGE = readFileSync('app/account/page.tsx', 'utf8')

  test('the trigger is the shared rule, not a condition written again in the page', () => {
    assert.match(PAGE, /const trigger = reconcileTrigger\(company, cardAdded\)/)
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
