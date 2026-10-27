/**
 * ONE READ FROM STRIPE, WHEN OUR MIRROR HAS A CUSTOMER AND NO SUBSCRIPTION — My Account step 20,
 * `DECISIONS.md` §220.
 *
 * *** WHAT HAPPENED, BECAUSE IT IS THE WHOLE ARGUMENT FOR THIS FILE. ***
 * During the owner's card walk his Stripe CLI listener died. He completed a real Checkout, was
 * charged $199, landed back on the Billing tab — and the tab said **"No card yet"**. Nothing was
 * broken: Stripe had the subscription, the webhook had simply never been delivered. Our columns are
 * a copy (§213), and a copy that misses one delivery is wrong until something tells it otherwise.
 *
 * *** AND THE SAME GAP EXISTS WITH NO OUTAGE AT ALL. *** Stripe redirects the browser back the
 * instant the session completes; the webhook is a separate delivery that lands a moment later. So
 * "No card yet, seconds after paying" is not an edge case — on a fast redirect it is the LIKELY
 * first paint. The only reason it had not been seen constantly is that we had been watching a
 * terminal rather than the page.
 *
 * ---- THIS IS A READ, NOT A SECOND SOURCE OF TRUTH -----------------------------------------------
 *
 * The direction is still Stripe → us and never the reverse. This file asks Stripe what is true and
 * writes the SAME COLUMNS THROUGH THE SAME MAPPING the webhook uses — `columnsFromFacts` and
 * `readSubscription` are imported from `lib/stripeWebhook.ts`, not reimplemented. The only thing
 * here that the webhook does not also do is find the subscription from the customer, which is the
 * one fact a missed delivery deprives us of.
 *
 * So the invariant §213 states is untouched: there is one mapping from Stripe's objects to our
 * columns, and two ways of being told to run it — pushed (the webhook) and pulled (this).
 *
 * ---- THE WEBHOOK WINS EVERY TIE ------------------------------------------------------------------
 *
 * The write is `.is('stripe_subscription_id', null)`: it only ever fills an EMPTY mirror. If the
 * webhook landed while we were talking to Stripe, our update matches zero rows and we say so
 * (`raced`) rather than overwriting it. That makes this safe to run concurrently with a delivery,
 * which is exactly the case it exists for — and it is the same `.is(null)` shape
 * `app/api/billing/checkout/route.ts` already uses to turn two colleagues pressing at once into a
 * no-op instead of a second Stripe customer.
 *
 * *** IT ALSO MEANS THIS CAN NEVER UNDO ANYTHING. *** It cannot cancel, cannot clear a card, cannot
 * move a status. The only state it can change is "we know of no subscription" → "we know of this
 * one". There is no argument to make about what happens when it is wrong, because the only thing
 * it can do when it is wrong is nothing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { columnsFromFacts, type StripePort } from './stripeWebhook.ts'

/**
 * HOW LONG THE PERSON WAITS FOR STRIPE BEFORE THE PAGE IS DRAWN ANYWAY.
 *
 * The page must never hang on this. Two Stripe round trips from a warm server are well inside a
 * second; six seconds is "Stripe is having a bad day", and at that point the honest thing is to
 * draw what the mirror says and tell them to refresh — which is strictly better than a spinner,
 * because the mirror may well be repaired by the webhook a moment later anyway.
 */
export const RECONCILE_DEADLINE_MS = 6000

export type ReconcileOutcome =
  /** No Stripe customer, so there is nothing at Stripe to ask about. The ordinary trial state. */
  | { kind: 'no_customer' }
  /** The mirror already names a subscription. Nothing to do, and nothing read. */
  | { kind: 'already_mirrored'; subscriptionId: string }
  /** Asked Stripe; this customer has no subscription. **The mirror is left exactly as it was.** */
  | { kind: 'nothing_at_stripe' }
  /** Repaired. `written` is the patch, which is what the webhook would have written. */
  | { kind: 'repaired'; subscriptionId: string; written: Record<string, unknown> }
  /** The webhook landed between our read and our write. Its row stands; ours was refused. */
  | { kind: 'raced'; subscriptionId: string }
  /** Stripe did not answer inside `RECONCILE_DEADLINE_MS`. Nothing was written. */
  | { kind: 'timed_out' }
  /** We could not read the company, or the write was refused. Said, never swallowed (§5). */
  | { kind: 'failed'; error: string }

/** True only for the one outcome that changed a column. The route and the page both key off it. */
export const didRepair = (o: ReconcileOutcome): boolean => o.kind === 'repaired'

const DEADLINE = Symbol('deadline')

/** Race a promise against the clock. The loser is abandoned, not cancelled — see the note in
 *  `reconcileFromStripe` about why an abandoned Stripe read is harmless here. */
async function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | typeof DEADLINE> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      p,
      new Promise<typeof DEADLINE>((resolve) => { timer = setTimeout(() => resolve(DEADLINE), ms) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * ASK STRIPE ONCE, AND FILL AN EMPTY MIRROR.
 *
 * `db` must be the SERVICE-ROLE client, for the same reason `/api/billing/checkout` holds one:
 * migration 087 leaves all nine billing columns out of `authenticated`'s UPDATE grant, so a
 * person may read their billing state and may not write it. The company is the CALLER'S OWN,
 * taken from the verified session by the route and passed in here as an id — never from a body.
 *
 * `port` is `lib/stripeWebhook.ts`'s one seam, so every test of this file stubs exactly one thing
 * and the real implementation is shared with the webhook.
 *
 * ---- WHY THE ABANDONED READ IS HARMLESS ----------------------------------------------------------
 *
 * On a deadline the Stripe promise is left running. If it resolves afterwards, nothing happens:
 * the only code that could write is below the `await`, and we have already returned. Nothing is
 * queued, nothing retries, and the next page load simply asks again.
 */
export async function reconcileFromStripe(args: {
  companyId: string
  db: SupabaseClient
  port: StripePort
  /** Overridden only by the tests, which must not wait six seconds to prove a timeout. */
  deadlineMs?: number
}): Promise<ReconcileOutcome> {
  const { companyId, db, port } = args
  const deadlineMs = args.deadlineMs ?? RECONCILE_DEADLINE_MS

  // ---- 1. WHAT WE KNOW. The trigger is the STATE, not a query string — see `reconcileTrigger`
  //         in `lib/billingView.ts` for the page's half of the same rule. ----
  const { data: company, error: readError } = await db
    .from('companies')
    // Written out rather than shared from a constant: `check-schema-contracts.js` check 1
    // validates column names inside a query string and can only read a literal.
    .select('id, stripe_customer_id, stripe_subscription_id')
    .eq('id', companyId)
    .maybeSingle()

  if (readError || !company) {
    return { kind: 'failed', error: `could not read the company: ${readError?.message ?? 'no row'}` }
  }

  const row = company as unknown as {
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
  }

  if (row.stripe_subscription_id) {
    return { kind: 'already_mirrored', subscriptionId: row.stripe_subscription_id }
  }
  if (!row.stripe_customer_id) return { kind: 'no_customer' }

  // ---- 2. THE TWO STRIPE READS, ON ONE BUDGET. ----
  const customerId = row.stripe_customer_id
  const facts = await withDeadline((async () => {
    const subscriptionId = await port.latestSubscriptionId(customerId)
    if (!subscriptionId) return null
    // The SAME read the webhook makes, with the same expand list — §217 D is why that matters.
    return port.readSubscription(subscriptionId)
  })(), deadlineMs)

  if (facts === DEADLINE) return { kind: 'timed_out' }
  // Stripe has no subscription for this customer: somebody who opened Checkout and closed the tab.
  // *** THE MIRROR IS LEFT ALONE. *** The page must not invent a subscription from an absence —
  // that is §3.2's rule about evidence, applied to money.
  if (!facts) return { kind: 'nothing_at_stripe' }

  // ---- 3. THE WRITE, WHICH ONLY EVER FILLS A NULL. ----
  const written = columnsFromFacts(facts)
  const { data: updated, error: writeError } = await db
    .from('companies')
    .update(written)
    .eq('id', companyId)
    .is('stripe_subscription_id', null)
    // So zero rows can be told from one. Without a `select()` PostgREST returns no body and
    // "the webhook got there first" would be indistinguishable from "we wrote it".
    .select('id')

  if (writeError) {
    return { kind: 'failed', error: `could not write the billing columns: ${writeError.message}` }
  }
  if (!updated || updated.length === 0) return { kind: 'raced', subscriptionId: facts.id }
  return { kind: 'repaired', subscriptionId: facts.id, written }
}

/* =================================================================================================
 * THE RECORD — in `stripe_events`, with a type that says `reconcile`.
 *
 * *** WHY THAT TABLE IS THE RIGHT HOME, GIVEN THE BRIEF ASKED THE QUESTION. ***
 * Its own comment (migration 087) says what it is for: "the only record of what Stripe told us —
 * the thing you need when a customer says they were charged and the product disagrees". A
 * reconcile is precisely that conversation's other half. The row that explains the walk's
 * incident is not a webhook row — there is none, that is the whole problem — it is this one.
 * Putting it anywhere else would mean the answer to "what were we told about this company's
 * money, and when" lives in two places.
 *
 * `id` is Stripe's event id for a webhook row, so a reconcile needs an id of its own that cannot
 * collide: `reconcile_<companyId>_<ms>`. The `reconcile_` prefix is also the "source" the brief
 * asks for — Stripe has no event type called `reconcile`, so the value cannot be mistaken for one
 * — and `payload.source` says it a second time for anyone reading a row rather than a column.
 * **No migration was needed, and none is wanted:** a `source` column would be a third way of
 * saying the same thing.
 *
 * *** WHAT IS DELIBERATELY NOT RECORDED: THE QUIET NO-OP. ***
 * `no_customer` and `already_mirrored` never reach Stripe at all. `nothing_at_stripe` does, and is
 * still not recorded — because a company that abandoned Checkout sits in that state for ever, and
 * every visit to the Billing tab would write another row saying nothing happened. The table whose
 * job is to make a payment fact FINDABLE would fill with rows that are not payment facts. So the
 * line is: **a row is written when something changed, or when something went wrong.** Both are
 * things somebody would come looking for.
 * ============================================================================================== */

export async function recordReconcile(args: {
  companyId: string
  customerId: string | null
  outcome: ReconcileOutcome
  db: SupabaseClient
  now?: Date
}): Promise<boolean> {
  const { companyId, customerId, outcome, db } = args
  const now = args.now ?? new Date()

  // See the note above: only a change or a failure earns a row.
  const worth = outcome.kind === 'repaired' || outcome.kind === 'failed'
    || outcome.kind === 'raced' || outcome.kind === 'timed_out'
  if (!worth) return false

  const { error } = await db.from('stripe_events').insert({
    id: `reconcile_${companyId}_${now.getTime()}`,
    type: `reconcile.${outcome.kind}`,
    company_id: companyId,
    stripe_customer_id: customerId,
    payload: {
      source: 'reconcile',
      why: 'the mirror had a Stripe customer and no subscription',
      outcome,
      at: now.toISOString(),
    },
    // `handled` means "our columns were written", exactly as it does for a webhook row.
    handled: outcome.kind === 'repaired',
    error: outcome.kind === 'failed' ? outcome.error
      : outcome.kind === 'timed_out' ? 'Stripe did not answer inside the deadline; nothing was written'
      : null,
  })
  if (error) {
    // The reconcile itself may well have worked. A record we could not write is said in the log
    // and never allowed to fail the repair (§5 — never silent, and never making it worse).
    console.error('[billing/reconcile] could not record the reconcile', companyId, error)
    return false
  }
  return true
}
