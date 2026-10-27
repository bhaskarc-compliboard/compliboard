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
import { columnsFromFacts, clearsGraceAnchor, type StripePort } from './stripeWebhook.ts'
import { reconcileNeeded, type ReconcileReason } from './billing.ts'

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
  /**
   * The row is settled — `reconcileNeeded` says there is nothing worth asking about. **Checked on
   * the server as well as in the page (§222)**, so a client calling this route in a loop cannot
   * turn the mirror into a proxy. Nothing read, nothing written.
   */
  | { kind: 'not_needed' }
  /**
   * Stripe was asked and agrees with every column we hold. The commonest answer once the trigger
   * widened — a genuinely failing card looks exactly like a stale one until you ask.
   * **No write and no record**, because nothing happened.
   */
  | { kind: 'already_current'; subscriptionId: string }
  /** Asked Stripe; this customer has no subscription. **The mirror is left exactly as it was.** */
  | { kind: 'nothing_at_stripe' }
  /** Repaired. `written` is the patch, and `changed` names only the columns that actually moved. */
  | { kind: 'repaired'; subscriptionId: string; written: Record<string, unknown>; changed: string[] }
  /** The webhook landed between our read and our write. Its row stands; ours was refused. */
  | { kind: 'raced'; subscriptionId: string }
  /** Stripe did not answer inside `RECONCILE_DEADLINE_MS`. Nothing was written. */
  | { kind: 'timed_out' }
  /** We could not read the company, or the write was refused. Said, never swallowed (§5). */
  | { kind: 'failed'; error: string }

/**
 * THE OUTCOME, PLUS THE STATE THAT EARNED THE QUESTION.
 *
 * *** THE REASON IS CARRIED OUT, NOT RE-DERIVED. *** The route used to ask `reconcileNeeded` again
 * after the call, to put in the record — and by then the repair had settled the row, so the
 * question answered `null` and every record read "the mirror looked wrong". Found by reading a row
 * the staging run had just written, not by review. A fact about why we acted cannot be recovered
 * from the state we acted on; it has to travel.
 */
export type ReconcileResult = ReconcileOutcome & { reason: ReconcileReason | null }

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
  /** For `reconcileNeeded`'s staleness clock. The tests pin it; the route does not pass one. */
  now?: Date
}): Promise<ReconcileResult> {
  const { companyId, db, port } = args
  const deadlineMs = args.deadlineMs ?? RECONCILE_DEADLINE_MS

  // ---- 1. WHAT WE KNOW. Every column the mapping can write, because step 3 has to tell
  //         "Stripe agrees with us" from "Stripe disagrees" — and that is a diff, not a guess. ----
  const { data: company, error: readError } = await db
    .from('companies')
    // Written out rather than shared from a constant: `check-schema-contracts.js` check 1
    // validates column names inside a query string and can only read a literal.
    .select('id, stripe_customer_id, stripe_subscription_id, subscription_status, '
          + 'current_period_end, trial_ends_at, payment_failed_at, cancel_at, card_brand, '
          + 'card_last4, next_charge_amount_cents, next_charge_currency, discount_name, '
          + 'discount_percent_off, discount_amount_off_cents, discount_duration, '
          + 'discount_months, discount_ends_at')
    .eq('id', companyId)
    .maybeSingle()

  if (readError || !company) {
    return { kind: 'failed', reason: null,
             error: `could not read the company: ${readError?.message ?? 'no row'}` }
  }

  /* *** A COPY, TAKEN BEFORE ANY `await`, AND THAT IS THE WHOLE COMPARE-AND-SET. ***
     Step 4 writes only if the row still looks the way it did HERE. That means "here" has to be a
     snapshot: reading `company.subscription_status` later would read whatever it says later, and
     the guard would compare the row against itself and always match.

     PostgREST already hands back a decoded copy, so in production the spread changes nothing. It
     is not decoration: `tests/unit/fakeSupabase.ts` returns the LIVE row object, so a test that
     mutates the table mid-flight — which is exactly how the race below is driven — would have
     silently passed the guard. The test found this, not review. */
  const row = { ...(company as unknown as Record<string, unknown>) } as Record<string, unknown> & {
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    subscription_status: string | null
  }

  if (!row.stripe_customer_id) return { kind: 'no_customer', reason: null }

  // *** THE SAME RULE THE PAGE ASKED, ASKED AGAIN HERE. ***
  // The page decides whether to call; this decides whether to spend. Without it, a client looping
  // on this route would turn the mirror into a proxy — one Stripe round trip per request, which is
  // the thing §213 exists to avoid. `reconcileNeeded` is pure and lives beside `accessFor`.
  const reason = reconcileNeeded(row, args.now ?? new Date())
  if (!reason) return { kind: 'not_needed', reason: null }

  // ---- 2. THE STRIPE READS, ON ONE BUDGET. ----
  // When the mirror already names a subscription there is nothing to look up: we read THAT one.
  // The list call is only for §220's case, where the id is the fact we are missing.
  const customerId = row.stripe_customer_id
  const known = row.stripe_subscription_id
  const facts = await withDeadline((async () => {
    const subscriptionId = known ?? await port.latestSubscriptionId(customerId)
    if (!subscriptionId) return null
    // The SAME read the webhook makes, with the same expand list — §217 D is why that matters.
    return port.readSubscription(subscriptionId)
  })(), deadlineMs)

  if (facts === DEADLINE) return { kind: 'timed_out', reason }
  // Stripe has no subscription for this customer: somebody who opened Checkout and closed the tab.
  // *** THE MIRROR IS LEFT ALONE. *** The page must not invent a subscription from an absence —
  // that is §3.2's rule about evidence, applied to money.
  if (!facts) return { kind: 'nothing_at_stripe', reason }

  // ---- 3. WHAT WOULD CHANGE. ----
  const written: Record<string, unknown> = columnsFromFacts(facts)

  /* *** AND THE GRACE ANCHOR, WHICH `columnsFromFacts` DELIBERATELY DOES NOT TOUCH. ***
     This is the column the whole of §222 is about: a customer who paid, whose `invoice.paid` was
     never delivered, sits at `past_due` with an anchor and is turned read_only on day 8. Stripe
     saying `active` means the payment is not failing, so the anchor is stale and is cleared —
     which is exactly what the webhook's `invoice.paid` branch does.

     ⚠ IT IS DONE HERE AND NOT INSIDE `columnsFromFacts`, AND THAT IS NOT TIDINESS. Putting it in
     the shared mapping would change the webhook too, and break it: a LATE `invoice.payment_failed`
     (status since moved to `active`) re-reads live state, would have the anchor cleared by the
     mapping, and then that handler's `.is('payment_failed_at', null)` write would MATCH and stamp
     a fresh anchor on a paying customer. The predicate is shared; where it is applied is not. */
  if (clearsGraceAnchor(facts.status)) written.payment_failed_at = null

  const changed = changedFields(row, written)
  // Stripe agrees with every column we hold. The commonest answer, once the trigger widened to
  // states that merely LOOK wrong: a genuinely failing card is indistinguishable from a stale one
  // until you ask, and asking is the whole point. No write, and no record — nothing happened.
  if (changed.length === 0) return { kind: 'already_current', reason, subscriptionId: facts.id }

  // ---- 4. THE WRITE: COMPARE-AND-SET ON WHAT WE READ. ----
  /* *** §220's `.is('stripe_subscription_id', null)` IS GONE, AND THIS REPLACES WHAT IT GAVE US. ***
     That guard filled a blank and never overwrote, which is why the reconcile could not heal a
     stale row — the §222 hole. The property worth keeping was not "only fill a blank"; it was
     *** THE WEBHOOK WINS EVERY TIE ***. So the write is now conditional on the row still looking
     the way it did when we read it: if a delivery landed in between, it moved the status or the
     subscription id, our filter matches nothing, and we say `raced` rather than overwriting it.
     The same compare-and-set shape as `lib/topicClaim.ts` and the checkout route's `.is(null)`.

     `.is` and not `.eq` for a null: PostgREST's `eq.null` matches no row at all, so a null read
     back as a null has to be filtered with `is`. Getting that wrong would make every §220 repair
     report itself as `raced`. */
  let q = db.from('companies').update(written).eq('id', companyId)
  q = known === null ? q.is('stripe_subscription_id', null) : q.eq('stripe_subscription_id', known)
  q = row.subscription_status === null
    ? q.is('subscription_status', null)
    : q.eq('subscription_status', row.subscription_status)

  // So zero rows can be told from one. Without a `select()` PostgREST returns no body and
  // "the webhook got there first" would be indistinguishable from "we wrote it".
  const { data: updated, error: writeError } = await q.select('id')

  if (writeError) {
    return { kind: 'failed', reason,
             error: `could not write the billing columns: ${writeError.message}` }
  }
  if (!updated || updated.length === 0) return { kind: 'raced', reason, subscriptionId: facts.id }
  return { kind: 'repaired', reason, subscriptionId: facts.id, written, changed }
}

/**
 * WHICH COLUMNS THE PATCH WOULD ACTUALLY MOVE.
 *
 * *** TIMESTAMPS ARE COMPARED AS INSTANTS, NOT AS STRINGS. *** Postgres hands back
 * `2026-11-27T18:18:43+00:00` where the mapping holds `2026-11-27T18:18:43.000Z`. The same moment,
 * two spellings — and compared as text every reconcile would report a change, write, and file a
 * record saying it had repaired something it had not. Numbers are compared loosely for the mirror
 * of that reason: `numeric` can arrive as a string.
 */
export function changedFields(
  row: Record<string, unknown>,
  patch: Record<string, unknown>,
): string[] {
  const out: string[] = []
  for (const [k, next] of Object.entries(patch)) {
    if (!same(row[k], next)) out.push(k)
  }
  return out.sort()
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b)
  if (typeof a === 'string' && typeof b === 'string') {
    const ta = Date.parse(a)
    const tb = Date.parse(b)
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta === tb
  }
  return false
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
 * `no_customer` and `not_needed` never reach Stripe at all. Two more DO reach it and are still not
 * recorded:
 *
 *   · `nothing_at_stripe` — a company that abandoned Checkout sits in that state for ever, and
 *     every visit to the Billing tab would write another row saying nothing happened;
 *   · `already_current` (§222) — Stripe agreeing with every column we hold, which once the trigger
 *     widened is the COMMONEST answer. A genuinely failing card looks exactly like a stale one
 *     until you ask, so a real `past_due` customer would write a row on every page load for as
 *     long as their card kept failing.
 *
 * The table whose job is to make a payment fact FINDABLE would fill with rows that are not payment
 * facts. So the line is: **a row is written when something changed, or when something went wrong.**
 * Both are things somebody would come looking for.
 * ============================================================================================== */

export async function recordReconcile(args: {
  companyId: string
  customerId: string | null
  outcome: ReconcileOutcome
  db: SupabaseClient
  /** Which of the four states earned the question. Carried out of `reconcileFromStripe`, never
   *  re-derived: by the time it has repaired the row, the state no longer qualifies. */
  reason?: string | null
  now?: Date
}): Promise<boolean> {
  const { companyId, customerId, outcome, db } = args
  const now = args.now ?? new Date()

  // See the note above: only a change or a failure earns a row. `repaired` is the only outcome
  // that changed anything, and it is only ever returned when `changedFields` found a difference.
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
      // The state that earned the question, not a fixed sentence: since §222 there are four, and
      // "which one fired" is the first thing anybody reading this row will want.
      why: args.reason ?? 'the mirror looked wrong',
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
