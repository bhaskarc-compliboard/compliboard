/**
 * WHAT A COMPANY MAY DO, AND WHAT WE TELL STRIPE — the two rules, with no Stripe and no database in
 * them, so `tests/unit/billing.test.ts` can run them in plain Node. My Account step 17.
 *
 * `ACCOUNT-PLAN.md` decisions 11 and 12, and the owner's decisions of 23 October: one plan for
 * everyone at a company, $199 a month, monthly only; a card may be added from day one and is never
 * required to start; with a card on file the subscription starts by itself on day 15; without one,
 * read-only after the trial.
 *
 * *** BOTH FUNCTIONS ARE PURE AND TAKE `now` AS AN ARGUMENT. *** That is what makes the trial
 * boundary testable without waiting fourteen days, and it is why there is NO DAILY JOB ending
 * trials: the verdict is computed from timestamps at request time, so a trial that ends at 14:03
 * ends at 14:03 rather than at the next morning's sweep. A nightly job would mean up to 24 hours of
 * wrong state, a second thing that can be down, and a second source of truth about one fact —
 * which is the shape of problem migration 083 was written to remove. `ACCOUNT-PLAN.md` step 18's
 * "daily job that ends trials" is struck (the owner, 23 October).
 *
 * ---- WHERE THE STATUS WORDS COME FROM, AND WHY EACH ONE LANDS WHERE IT DOES ---------------------
 *
 * `companies.subscription_status` holds STRIPE'S OWN WORD, verbatim and un-translated (migration
 * 087). The sentences below are quoted from `docs.stripe.com/api/subscriptions/object`, read on
 * 23 October 2026, because this is a rule that decides whether a paying customer is refused and it
 * must not be written from memory:
 *
 *   `past_due`   "it becomes `past_due` when payment is required but cannot be paid … Once Stripe
 *                has exhausted all payment retry attempts, the subscription will become `canceled`
 *                or `unpaid`."                            → STRIPE IS STILL TRYING.
 *   `unpaid`     "when a subscription has a status of `unpaid`, no subsequent invoices will be
 *                attempted."                              → STRIPE HAS STOPPED TRYING.
 *   `paused`     "A subscription can enter a `paused` status in several ways, including when a
 *                trial ends without a payment method … A `paused` subscription doesn't advance to a
 *                new billing period or generate invoices until it resumes."
 *                                                         → WE ARE NOT BEING PAID.
 *   `incomplete` "a subscription moves into `incomplete` if the initial payment attempt fails …
 *                If the first invoice is not paid within 23 hours, the subscription transitions to
 *                `incomplete_expired`."                   → THE FIRST PAYMENT NEVER LANDED.
 *   `trialing`   "A subscription that is currently in a trial period is `trialing`."
 *
 * That difference between `past_due` and `unpaid` is the whole reason for the
 * `payment_failed_retrying` branch below, and it could not have been guessed.
 *
 * ---- AND AN UNRECOGNISED STATUS READS AS "NOT PAYING", LOUDLY ------------------------------------
 *
 * Stripe has added a status before (`paused`), which is why migration 087 keeps the column as `text`
 * rather than an ENUM — a value we do not know must be RECORDABLE. Here it must also be SAFE: it
 * falls to `read_only` with the reason `status_not_recognised`, so the refusal can say which word it
 * did not know rather than refusing silently (`CLAUDE.md` §5, §6 — a product that cannot explain a
 * refusal is asserting something it cannot support).
 */

/** The free trial, in days. The SQL default on `companies.trial_ends_at` is the same number, and
 *  migration 087's check 10 is what stops the two drifting apart. */
export const TRIAL_DAYS = 14

/** The grace after a payment first fails, in days. `ACCOUNT-PLAN.md` decision 11. */
export const GRACE_DAYS = 7

/**
 * *** STRIPE WILL NOT ACCEPT A CHECKOUT `trial_end` CLOSER THAN THIS. ***
 * "Has to be at least 48 hours in the future" — `subscription_data.trial_end` on
 * `docs.stripe.com/api/checkout/sessions/create`, read 23 October 2026. See `trialEndFor`.
 */
export const STRIPE_TRIAL_END_FLOOR_HOURS = 48

const DAY_MS = 24 * 60 * 60 * 1000

export type Access = 'full' | 'read_only'

/**
 * WHY the verdict is what it is. Not decoration: step 18 refuses a request with it, and step 19's
 * Billing tab draws a sentence from it. A gate that cannot say why it refused is one nobody can
 * debug and nobody should trust (`CLAUDE.md` §5).
 */
export type BillingReason =
  /** The trial has not run out. Nothing else was consulted. */
  | 'trial'
  /** A subscription Stripe calls `active` or `trialing`, with no failed payment outstanding. */
  | 'subscribed'
  /** A payment failed and decision 11's seven days have not run out. */
  | 'payment_failed_in_grace'
  /** `past_due` — Stripe is still retrying — but no `payment_failed_at` was ever recorded. */
  | 'payment_failed_retrying'
  /** The seven days ran out. */
  | 'payment_failed_grace_over'
  /** The trial ended and no subscription was ever started. The ordinary end of a free trial. */
  | 'trial_over_no_subscription'
  /** Stripe's word says we are not being paid: `canceled`, `unpaid`, `paused`, `incomplete`… */
  | 'not_paying'
  /** A status word that did not exist when this was written. Refused, and named. */
  | 'status_not_recognised'

export type BillingVerdict = {
  access: Access
  reason: BillingReason
  /** The status this verdict was reached on, so a refusal can quote it. `null` = never subscribed. */
  status: string | null
}

/** Exactly the three columns of migration 087 that this rule reads — and no others. The Billing
 *  tab's `current_period_end`, `card_brand` and `card_last4` are things to DISPLAY: a wrong one is
 *  a cosmetic bug, and a wrong `trial_ends_at` is an access bug. */
export type BillingColumns = {
  /** NOT NULL in the database (migration 087), so this rule never has to guess at a missing one. */
  trial_ends_at: string | Date
  subscription_status: string | null
  payment_failed_at: string | Date | null
}

/** Stripe's eight words as of 23 October 2026. Only used to tell "a word we know" from "a word we
 *  do not", so the ninth one Stripe invents is refused by name rather than mistaken for a known one. */
export const KNOWN_STATUSES = [
  'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused',
] as const

function asDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v)
}

/**
 * MAY THIS COMPANY DO PAID WORK RIGHT NOW?
 *
 * Read the order: **the trial comes first, and on purpose.** A person who adds a card and cancels
 * it again on day 3 keeps what they were promised until day 15. Nothing here takes back a day
 * somebody was already given.
 */
export function accessFor(c: BillingColumns, now: Date): BillingVerdict {
  const status = c.subscription_status
  const trialEnds = asDate(c.trial_ends_at)

  // ---- 1. THE TRIAL, BEFORE ANYTHING ELSE IS CONSULTED. ----
  if (now.getTime() < trialEnds.getTime()) {
    return { access: 'full', reason: 'trial', status }
  }

  // ---- The trial is over. From here only a subscription gives access. ----
  if (status === null) {
    return { access: 'read_only', reason: 'trial_over_no_subscription', status }
  }

  const failedAt = c.payment_failed_at === null ? null : asDate(c.payment_failed_at)
  const graceEnds = failedAt === null ? null : failedAt.getTime() + GRACE_DAYS * DAY_MS
  const inGrace = graceEnds !== null && now.getTime() <= graceEnds
  const graceOver = graceEnds !== null && now.getTime() > graceEnds

  // ---- 2. A SUBSCRIPTION STRIPE IS HAPPY WITH. ----
  if (status === 'active' || status === 'trialing') {
    // `trialing` can outlast our own `trial_ends_at` if the mirror lagged; Stripe's word wins.
    if (graceOver) return { access: 'read_only', reason: 'payment_failed_grace_over', status }
    return {
      access: 'full',
      reason: inGrace ? 'payment_failed_in_grace' : 'subscribed',
      status,
    }
  }

  // ---- 3. DECISION 11'S GRACE, WHICH IS A WINDOW AND NOT A FLAG. ----
  if (status === 'past_due') {
    if (inGrace) return { access: 'full', reason: 'payment_failed_in_grace', status }
    if (graceOver) return { access: 'read_only', reason: 'payment_failed_grace_over', status }
    // *** `past_due` WITH NO ANCHOR MEANS OUR MIRROR DROPPED AN EVENT, NOT THAT THEY STOPPED
    // PAYING — SO THE CUSTOMER GETS THE BENEFIT OF IT. *** Stripe "has [not] exhausted all payment
    // retry attempts" in this state, so another `invoice.payment_failed` is coming and will set the
    // anchor (the webhook writes it only when it is null, so the clock starts from the FIRST
    // failure we hear about and Stripe's retries cannot keep pushing the deadline out). That makes
    // this branch BOUNDED by Stripe's retry schedule, which is why it can afford to be kind.
    return { access: 'full', reason: 'payment_failed_retrying', status }
  }

  // ---- 4. ...AND `unpaid` IS THE ONE THAT CANNOT AFFORD IT. ----
  // "no subsequent invoices will be attempted": no further `invoice.payment_failed` will ever fire,
  // so an anchor that has not arrived is never going to. Being kind here would be unbounded — full
  // access for ever to a company Stripe has given up collecting from.
  if (status === 'unpaid') {
    if (inGrace) return { access: 'full', reason: 'payment_failed_in_grace', status }
    if (graceOver) return { access: 'read_only', reason: 'payment_failed_grace_over', status }
    return { access: 'read_only', reason: 'not_paying', status }
  }

  // ---- 5. THE WORDS THAT MEAN WE ARE NOT BEING PAID. ----
  if (status === 'canceled' || status === 'paused'
      || status === 'incomplete' || status === 'incomplete_expired') {
    return { access: 'read_only', reason: 'not_paying', status }
  }

  // ---- 6. AND A WORD STRIPE INVENTED AFTER THIS WAS WRITTEN. ----
  return { access: 'read_only', reason: 'status_not_recognised', status }
}

/** Which of the three cases `trialEndFor` landed in. The route logs this, so a run can be read back
 *  and checked against the rule rather than against a recollection of it. */
export type TrialEndCase =
  /** More than 48 hours of trial left: Stripe is told the real trial end. */
  | 'trial_running'
  /** Less than 48 hours left but not yet over: Stripe refuses the real date, so it gets the floor. */
  | 'floor_applied'
  /** The trial is over: no trial at all, charged at once, access back the same second. */
  | 'trial_over'

export type TrialEndDecision = {
  /** Unix SECONDS for Stripe's `subscription_data.trial_end`, or null to send no trial at all. */
  trialEnd: number | null
  case: TrialEndCase
}

/**
 * WHAT WE TELL STRIPE THE TRIAL ENDS, when a person presses "Add a card".
 *
 * *** AND THE 48-HOUR FLOOR IS WHY THIS IS THREE CASES AND NOT TWO. ***
 * "Has to be at least 48 hours in the future" (`subscription_data.trial_end`,
 * `docs.stripe.com/api/checkout/sessions/create`, read 23 October 2026). Sending the real trial end
 * to somebody with one day left is a 400 from Stripe, so they could not add a card AT ALL at the
 * moment they most want to.
 *
 * So, inside the floor, they are given `now + 48 hours` instead. That is up to two free days, and it
 * is the choice that keeps the owner's own promise — "no charge before day 15" — because OMITTING
 * `trial_end` would charge them today, on day 13.
 *
 *   more than 48h left  →  the real `trial_ends_at`   (no charge before day 15)
 *   inside 48h, not over →  now + 48h                 (no charge before day 15; up to 2 days free)
 *   already over         →  null, no trial            (charged at once, access back at once)
 */
export function trialEndFor(trialEndsAt: string | Date, now: Date): TrialEndDecision {
  const ends = asDate(trialEndsAt).getTime()
  const nowMs = now.getTime()
  if (ends <= nowMs) return { trialEnd: null, case: 'trial_over' }

  const floor = nowMs + STRIPE_TRIAL_END_FLOOR_HOURS * 60 * 60 * 1000
  if (ends <= floor) return { trialEnd: Math.ceil(floor / 1000), case: 'floor_applied' }
  return { trialEnd: Math.ceil(ends / 1000), case: 'trial_running' }
}

/* ===================================================================================================
 * WHAT THE PERSON IS TOLD — My Account step 18, `ACCOUNT-PLAN.md` decision 11.
 *
 * These are here, in the one file with NO IMPORTS, because the browser needs them. `AppLayout` and
 * every section page compute the verdict client-side from four columns they already read, so the
 * banner and the note beside a control can be drawn without a round trip. Nothing below touches
 * Stripe, the database or `next/server`.
 * ================================================================================================= */

/**
 * HOW MANY WHOLE DAYS OF DECISION 11'S GRACE ARE LEFT.
 *
 * Raw arithmetic, so a test can pin it: it may return 0, and it may go negative once the grace is
 * over. `bannerFor` is what clamps it for display — see the note there, because "0 more days" is not
 * a sentence we show anyone.
 */
export function graceDaysLeft(paymentFailedAt: string | Date, now: Date): number {
  const ends = asDate(paymentFailedAt).getTime() + GRACE_DAYS * DAY_MS
  return Math.ceil((ends - now.getTime()) / DAY_MS)
}

/** Which door the banner's one button goes to. A card is CHANGED in the portal and ADDED at
 *  checkout, and a company that already has a Stripe customer belongs in the portal. */
export type BannerAction = 'checkout' | 'portal'

export type Banner = {
  text: string
  /** The button's words. */
  button: string
  action: BannerAction
  /** Which of the four texts this is, so a test names a case rather than matching a sentence. */
  kind: 'trial_over' | 'in_grace' | 'grace_over' | 'not_active'
}

/**
 * THE BAND ABOVE THE TOP BAR, OR NOTHING.
 *
 * *** READ THE SECOND CASE CAREFULLY: IT RENDERS WHILE ACCESS IS STILL `full`. ***
 * `payment_failed_in_grace` is decision 11's seven days, and during them `accessFor` returns
 * `full` — correctly, that is what the grace IS. So a banner drawn only on `read_only` would first
 * appear on day 8, telling somebody about a window that has already shut. The whole point of the
 * grace is that they are told inside it. `AppLayout` therefore renders on
 * `access === 'read_only' || reason === 'payment_failed_in_grace'`.
 *
 * `payment_failed_retrying` deliberately gets NO banner, and it is the one gap here. It means
 * `past_due` with no `payment_failed_at` — which `accessFor` reasons is our mirror having dropped
 * an event rather than their card having failed, and it is bounded by Stripe's own retries. There
 * is no anchor, so there is no N: any sentence would either invent a number or alarm somebody
 * without giving them a date. When the next `invoice.payment_failed` arrives the anchor is written
 * and the grace banner appears then.
 */
export function bannerFor(
  verdict: BillingVerdict,
  opts: { paymentFailedAt: string | Date | null; hasStripeCustomer: boolean; now: Date },
): Banner | null {
  const update = {
    button: 'Update your card',
    action: (opts.hasStripeCustomer ? 'portal' : 'checkout') as BannerAction,
  }
  const add = {
    button: 'Add a card',
    action: (opts.hasStripeCustomer ? 'portal' : 'checkout') as BannerAction,
  }

  switch (verdict.reason) {
    // ---- 1. The ordinary end of a free trial. Board 8's words, unchanged. ----
    case 'trial_over_no_subscription':
      return {
        ...add,
        kind: 'trial_over',
        text: 'Your trial has ended. Everything is still here to read and download. '
            + 'Add a card to keep asking, reading documents and auditing.',
      }

    // ---- 2. Inside the grace. ACCESS IS STILL FULL — nothing has stopped working yet. ----
    case 'payment_failed_in_grace': {
      // The clamp. `graceDaysLeft` is honest arithmetic and reaches 0 on the last day; "0 more
      // days" is not something to say to a person, and "1 more day" is both true and plain, so the
      // floor is 1 for display only. The singular is handled rather than printing "1 more days".
      const raw = opts.paymentFailedAt === null ? GRACE_DAYS : graceDaysLeft(opts.paymentFailedAt, opts.now)
      const n = Math.max(1, raw)
      return {
        ...update,
        kind: 'in_grace',
        text: `We couldn't charge your card. We'll try again for ${n} more ${n === 1 ? 'day' : 'days'} `
            + '— update it to keep everything running.',
      }
    }

    // ---- 3. The seven days ran out. ----
    case 'payment_failed_grace_over':
      return {
        ...update,
        kind: 'grace_over',
        text: `We couldn't charge your card and the ${GRACE_DAYS} days are up. Everything is still `
            + 'here to read and download. Update your card to keep asking, reading documents and auditing.',
      }

    // ---- 4. Stripe's word says we are not being paid, including a word we do not know. ----
    // One text for both, because the difference between `canceled` and a status invented next year
    // is ours to act on and not theirs to read. The word itself goes in the 402 and the log.
    case 'not_paying':
    case 'status_not_recognised':
      return {
        ...add,
        kind: 'not_active',
        text: "Your subscription isn't active. Everything is still here to read and download. "
            + 'Add a card to keep asking, reading documents and auditing.',
      }

    // `trial`, `subscribed`, `payment_failed_retrying` — nothing is wrong, or nothing we can date.
    default:
      return null
  }
}

/** The shape every screen already reads, once its `select('name')` is widened. */
export type BillingRow = {
  trial_ends_at: string | Date
  subscription_status: string | null
  payment_failed_at: string | Date | null
  stripe_customer_id?: string | null
}

/**
 * THE BAND FOR `AppLayout` — read-only, OR inside the grace (where access is still full).
 * One function so the layout and the six pages cannot drift on the condition.
 */
export function bannerFromRow(row: BillingRow | null, now: Date = new Date()): Banner | null {
  if (!row) return null
  const verdict = accessFor(row, now)
  if (verdict.access !== 'read_only' && verdict.reason !== 'payment_failed_in_grace') return null
  return bannerFor(verdict, {
    paymentFailedAt: row.payment_failed_at,
    hasStripeCustomer: Boolean(row.stripe_customer_id),
    now,
  })
}

/**
 * THE NOTE BESIDE A CONTROL — `read_only` ONLY, which is the difference from `bannerFromRow`.
 *
 * During the grace the banner appears and **the buttons still work**, because access is still
 * full. Disabling them then would take away seven days the product just promised in writing.
 */
export function pausedFromRow(row: BillingRow | null, now: Date = new Date()): Banner | null {
  if (!row) return null
  if (accessFor(row, now).access !== 'read_only') return null
  return bannerFromRow(row, now)
}
