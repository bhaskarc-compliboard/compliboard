/**
 * THE WHOLE SUBSCRIPTION LIFETIME, IN ABOUT FOUR MINUTES — My Account step 20 setup.
 *
 *   npm run stripe:clock              the full walk, then clean up
 *   npm run stripe:clock -- --keep    leave the fixture and the clock in place to poke at
 *   npm run stripe:clock -- --clean   delete anything a previous run left behind
 *
 * A Stripe **test clock** is a fake "now" that a customer and its subscription live inside. Moving
 * the clock forward makes Stripe genuinely do what it would do on that date — end the trial, raise
 * an invoice, charge the card, retry a failure — and fire the real webhooks. It is the only way to
 * see day 15 and the 7-day grace without waiting three weeks.
 *
 * ---- WHAT THIS PROVES, AND WHAT IT CANNOT ------------------------------------------------------
 *
 * PROVES: that Stripe's events, delivered through the CLI to our own route, move our own columns
 * the way `DECISIONS.md` §213 says they will, and that the Billing tab's words follow — printed at
 * each step from the REAL `lib/billingView.ts`, not a copy of it.
 *
 * CANNOT:
 *   · **Checkout.** Nothing here opens a payment page or types a card number. The subscription is
 *     created through the API, so `payment_method_collection: 'if_required'` (§216 B) and the
 *     hosted page's own behaviour are untested by this. That is the owner's own walk.
 *   · **The portal.** Cancelling, changing a card, and what the portal emits afterwards.
 *   · **Email.** Stripe's dunning emails are not sent for test-clock customers.
 *   · **The 7-day grace WINDOW.** The webhook anchors it with `payment_failed_at = new Date()` —
 *     our server's wall clock at the moment it handles the event (`lib/stripeWebhook.ts:327`), not
 *     the event's own timestamp. For a real customer those are seconds apart and it does not
 *     matter. For a test clock they are months apart, so advancing the clock cannot walk through
 *     the window: the anchor stays in real time and the gate reads the grace as already over.
 *     What this DOES prove is that the anchor gets written at all, and once, which is the half
 *     that had never been seen outside a unit test. The window's arithmetic is covered by
 *     `tests/unit/billing.test.ts` and by step 18's staging run with a hand-set anchor.
 *   · **Proration, tax, 3-D Secure, and anything requiring a real bank.**
 *   · **The price.** It uses `STRIPE_PRICE_ID`, so it confirms that id works — not that it costs
 *     what the Billing tab says it costs (§216 A: the one unguarded claim).
 *
 * ---- IT USES ITS OWN FIXTURE, ALWAYS ------------------------------------------------------------
 *
 * A company row it creates, named with its own prefix, and a Stripe customer that exists only
 * inside the clock. It never touches a company it did not make. Cleanup runs in a `finally`, and
 * `--clean` sweeps anything an interrupted run left.
 */

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { billingTabView } from '../lib/billingView.ts'
import { accessFor } from '../lib/billing.ts'

const PREFIX = 'STEP20 CLOCK'
const BILLING_COLS = 'id, name, trial_ends_at, subscription_status, payment_failed_at, current_period_end, card_brand, card_last4, stripe_customer_id, stripe_subscription_id'

// ---------------------------------------------------------------- environment
if (!existsSync('.env.local')) die('.env.local is not here. Run this from the project root.')
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim()
}
function die(msg) { console.error(`\n  stripe:clock — ${msg}\n`); process.exit(1) }
const need = (n) => process.env[n] || die(`${n} is not set in .env.local`)

const SECRET = need('STRIPE_SECRET_KEY')
if (!SECRET.startsWith('sk_test_') && !SECRET.startsWith('rk_test_')) {
  die('STRIPE_SECRET_KEY is NOT a test key. This creates subscriptions. Refusing.')
}
const PRICE = need('STRIPE_PRICE_ID')
const stripe = new Stripe(SECRET, { apiVersion: '2026-09-30.endive' })
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'))

const args = process.argv.slice(2)
const KEEP = args.includes('--keep')
const CLEAN_ONLY = args.includes('--clean')
/** Matches `npm run stripe:watch`'s own default; both must point at the same server. */
const PORT = process.env.PORT ?? '3000'

// ---------------------------------------------------------------- small helpers
const DAY = 86400
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const iso = (unix) => new Date(unix * 1000).toISOString()

/** Stripe processes an advance in the background; nothing is true until the clock is ready. */
async function settle(clockId, label) {
  process.stdout.write(`  ${label} `)
  for (let i = 0; i < 120; i++) {
    const c = await stripe.testHelpers.testClocks.retrieve(clockId)
    if (c.status === 'ready') { console.log(`✓ clock now ${iso(c.frozen_time).slice(0, 10)}`); return c }
    if (c.status === 'internal_failure') die('the test clock failed inside Stripe')
    process.stdout.write('.')
    await sleep(2000)
  }
  die('the test clock did not settle in four minutes')
}

/** Our own columns, and the words the tab would draw from them — the REAL view function. */
/**
 * `now` is THE CLOCK'S time, not the wall clock, and that is the whole point of the function.
 *
 * `accessFor` compares `trial_ends_at` against a `now` the caller supplies (§213: the rule is
 * computed at request time, from timestamps). The fixture's trial ends fourteen real days from
 * today, while the test clock is months ahead — so asking the gate about the WALL clock reports
 * "Trial, 14 days left" at every step, however far Stripe has advanced. The first run of this
 * script did exactly that and looked, at a glance, as though the webhook had done nothing.
 *
 * The clock's `frozen_time` is this customer's today. That is what the person would see.
 */
async function report(companyId, heading, nowUnix) {
  // The webhook writes through the service role; give it a moment after the clock settles.
  await sleep(4000)
  const { data: c } = await db.from('companies').select(BILLING_COLS).eq('id', companyId).single()
  const now = new Date(nowUnix * 1000)
  console.log(`\n  ══ ${heading} ${'═'.repeat(Math.max(0, 62 - heading.length))}`)
  console.log(`  (the clock says it is ${now.toISOString().slice(0, 10)})`)
  console.log('  OUR COLUMNS (the mirror, written by the webhook)')
  console.log(`    subscription_status  ${c.subscription_status ?? '(null)'}`)
  console.log(`    current_period_end   ${c.current_period_end ?? '(null)'}`)
  console.log(`    payment_failed_at    ${c.payment_failed_at ?? '(null)'}`)
  console.log(`    card                 ${c.card_brand ?? '(none)'} ${c.card_last4 ?? ''}`)
  console.log(`    trial_ends_at        ${c.trial_ends_at}`)
  const verdict = accessFor(c, now)
  const view = billingTabView(c, now)
  console.log('  THE GATE (lib/billing.ts accessFor)')
  console.log(`    access ${verdict.access}   reason ${verdict.reason}`)
  console.log('  THE BILLING TAB WOULD SAY (lib/billingView.ts, the real one)')
  console.log(`    [${view.status.pill}] ${view.status.headline}`)
  console.log(`    ${view.status.detail}`)
  console.log(`    Card: ${view.card.text}  ·  ${view.card.action} → ${view.card.door}`)
  return c
}

/** Everything this script has ever created, by its own prefix. */
async function cleanup(quiet = false) {
  const say = (s) => { if (!quiet) console.log(s) }
  const { data: cos } = await db.from('companies').select('id, name').like('name', `${PREFIX}%`)
  for (const c of cos ?? []) {
    await db.from('companies').delete().eq('id', c.id)
    say(`  deleted company fixture ${c.name}`)
  }
  const clocks = await stripe.testHelpers.testClocks.list({ limit: 100 })
  for (const k of clocks.data) {
    if (k.name?.startsWith(PREFIX)) {
      await stripe.testHelpers.testClocks.del(k.id)   // takes its customers and subscriptions with it
      say(`  deleted test clock ${k.id}`)
    }
  }
  if (!cos?.length && !clocks.data.some((k) => k.name?.startsWith(PREFIX))) say('  nothing left behind')
}

// ---------------------------------------------------------------- the walk
if (CLEAN_ONLY) { console.log('\n  sweeping anything a previous run left:'); await cleanup(); console.log(); process.exit(0) }

console.log('\n  ┌──────────────────────────────────────────────────────────────────────┐')
console.log('  │  A SUBSCRIPTION LIFETIME ON A TEST CLOCK                             │')
console.log('  └──────────────────────────────────────────────────────────────────────┘')
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.log('\n  ⚠ STRIPE_WEBHOOK_SECRET is not in .env.local, so the webhook will refuse')
  console.log('    every event with a 400 and OUR COLUMNS WILL NOT MOVE. Run')
  console.log('    `npm run stripe:watch` first, paste the line it prints, restart the server.')
}
try {
  const r = await fetch(`http://localhost:${PORT}/api/stripe/webhook`, { method: 'POST', body: '{}' })
  console.log(`\n  dev server on :${PORT} answers the webhook route (${r.status} to an unsigned POST — 400 is correct)`)
} catch {
  console.log(`\n  ⚠ nothing is answering on localhost:${PORT}. Start the dev server, or the`)
  console.log('    events will have nowhere to go and our columns will not move.')
}

await cleanup(true)   // never build on top of a previous run

let companyId = null, clockId = null
try {
  // ---- 1. OUR OWN company fixture, in its trial, exactly as signup leaves one. ----
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const name = `${PREFIX} ${stamp}`
  const trialEnds = new Date(Date.now() + 14 * DAY * 1000).toISOString()
  const { data: co, error: ce } = await db.from('companies')
    .insert({ name, trial_started_at: new Date().toISOString(), trial_ends_at: trialEnds })
    .select('id').single()
  if (ce) die(`could not create the company fixture: ${ce.message}`)
  companyId = co.id
  console.log(`\n  company fixture  ${name}\n  id               ${companyId}`)

  // ---- 2. The clock, and a customer that lives inside it. ----
  const startUnix = Math.floor(Date.now() / 1000)
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: startUnix, name })
  clockId = clock.id
  const customer = await stripe.customers.create({
    name, test_clock: clockId, email: `step20+${stamp}@example.com`,
    metadata: { company_id: companyId, created_by: 'scripts/stripe-clock.mjs' },
  })
  // A card that works. `pm_card_visa` is Stripe's own test method.
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } })

  // *** THE WEBHOOK FINDS A COMPANY BY `stripe_customer_id`, SO IT IS WRITTEN FIRST. ***
  // This is exactly what `/api/billing/checkout` does before it hands the person to Stripe
  // (`lib/stripeWebhook.ts:181`). Without it every event arrives, finds no company, and is
  // recorded in `stripe_events` with its error — which is the designed behaviour, and not what
  // we are trying to see here.
  await db.from('companies').update({ stripe_customer_id: customer.id }).eq('id', companyId)
  console.log(`  stripe customer  ${customer.id}\n  test clock       ${clockId}`)

  // ---- 3. The subscription, with the trial the checkout route would have sent. ----
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: PRICE }],
    trial_end: startUnix + 14 * DAY,
    metadata: { company_id: companyId },
  })
  console.log(`  subscription     ${sub.id}  (${sub.status})`)
  await report(companyId, 'STEP 1 — day 0, trialing', startUnix)

  // ---- 4. Past day 15: the trial ends, the first invoice is raised and paid. ----
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: startUnix + 15 * DAY })
  await settle(clockId, 'advancing to day 15')
  await report(companyId, 'STEP 2 — day 15, the trial converted', startUnix + 15 * DAY)

  // ---- 5. A card that will be DECLINED on the next renewal. ----
  // Attaching succeeds; the charge is what fails, which is the real shape of a card going bad.
  const bad = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: bad.id } })
  console.log('\n  swapped in a card that declines on charge (pm_card_chargeCustomerFail)')

  // ---- 6. The next renewal fails. `payment_failed_at` is written, and the grace begins. ----
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: startUnix + 46 * DAY })
  await settle(clockId, 'advancing past the next renewal')
  const afterFail = await report(companyId, 'STEP 3 — the renewal failed, the anchor is written', startUnix + 46 * DAY)
  // ---- THE GRACE WINDOW, WITH ONE NAMED SUBSTITUTION. ----
  // The row above is real in every column. But its `payment_failed_at` is our server's real
  // clock (see the header), which sits BEFORE `trial_ends_at` on the clock's timeline — so the
  // trial rule, which `accessFor` consults first and should, wins and the grace is never reached.
  // The two windows cannot overlap on a test clock.
  //
  // So this re-asks the gate about THE SAME COLUMNS with the anchor moved onto the clock's own
  // failure day. Nothing is written; it is a question, not a fixture. It shows what a real
  // customer sees, because for them the webhook's stamp and the failure ARE the same moment.
  if (afterFail?.payment_failed_at) {
    const failedOnClock = new Date((startUnix + 46 * DAY) * 1000).toISOString()
    const asIf = { ...afterFail, payment_failed_at: failedOnClock }
    console.log('\n  ── the grace window, asked of the same row ─────────────────────────────')
    console.log(`     substituting payment_failed_at → ${failedOnClock.slice(0, 10)} (the clock's`)
    console.log("     failure day). Nothing is written. The webhook's own stamp is real time.")
    for (const [label, when] of [
      ['3 days later ', new Date((startUnix + 49 * DAY) * 1000)],
      ['9 days later ', new Date((startUnix + 55 * DAY) * 1000)],
    ]) {
      const v = accessFor(asIf, when)
      const w = billingTabView(asIf, when)
      console.log(`     ${label} access ${v.access.padEnd(9)} [${w.status.pill}] ${w.status.headline}`)
      console.log(`                   ${w.status.detail}`)
    }
  }

  // ---- 7. Past the grace. Access goes. ----
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: startUnix + 56 * DAY })
  await settle(clockId, 'advancing past the 7-day grace')
  await report(companyId, 'STEP 4 — the grace is over', startUnix + 56 * DAY)

  console.log('\n  ── what to check in the four blocks above ──────────────────────────────')
  console.log('   1. day 0    : status trialing, access full, tab says Trial')
  console.log('   2. day 15   : status active, current_period_end set, card Visa 4242,')
  console.log('                 tab says Active with a next payment date')
  console.log('   3. renewal  : status past_due, payment_failed_at SET, access STILL FULL,')
  console.log('                 tab says Payment failed with the days left')
  console.log('   4. +7 days  : access read_only, tab says Read-only')
  console.log('\n   If the columns never moved, the webhook is not reaching the app:')
  console.log('   `npm run stripe:watch` in its own terminal, and the secret in .env.local.\n')
} catch (e) {
  // A Stripe error object prints sixty lines of response headers. The message and the request id
  // are the whole of what anybody needs, and the id is what Stripe's support can look up.
  const msg = e?.raw?.message ?? e?.message ?? String(e)
  console.error(`\n  ✖ FAILED: ${msg}`)
  if (e?.raw?.request_log_url) console.error(`    Stripe's log for it: ${e.raw.request_log_url}`)
  process.exitCode = 1
} finally {
  if (KEEP) {
    console.log(`  --keep: leaving company ${companyId} and clock ${clockId} in place.`)
    console.log('  Sweep them later with `npm run stripe:clock -- --clean`.\n')
  } else {
    console.log('\n  cleaning up:')
    await cleanup()
    console.log()
  }
}
