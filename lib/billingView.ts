/**
 * THE BILLING TAB'S WORDS — board 4, My Account step 19.
 *
 * Pure, and with NO IMPORTS BUT `lib/billing.ts`, so `tests/unit/billingView.test.ts` can run every
 * state in plain Node and the browser can render it without a round trip.
 *
 * *** THIS TAB READS THE MIRROR AND WRITES NOTHING. ***
 * Every value below comes from the eight columns migration 087 keeps in step with Stripe, which
 * `GET /api/account` already returns (`select('*')`). Nothing here calls Stripe, and nothing here
 * decides anything: the two buttons hand the person to Stripe's own pages and the webhook writes
 * what comes back. A tab that recomputed a status would be a second source of truth about the one
 * fact §213 exists to keep single.
 *
 * ---- ⚡ THE PRICE: CORRECTED 27 OCTOBER 2026 (§221), AND THIS IS THE IMPORTANT PART ------------
 *
 * This file used to state `$199` as the price of THIS COMPANY'S plan, with a note saying the
 * number was display-only and Stripe held the truth. §216 A called it "the one unguarded claim on
 * the Billing tab". The owner's coupon walk is that claim meeting a discount: `FOUNDER100` (100%
 * off, forever) produced a live subscription that will never be charged anything, and the tab said
 * **"$199 a month, charged to the card below"** beside **"No card yet · Add a card"**.
 *
 * *** SO THE LIST PRICE IS NOW USED ONLY WHERE THE PAGE DESCRIBES THE PRODUCT, NEVER WHERE IT
 * DESCRIBES THIS COMPANY. *** What this company pays comes from `next_charge_amount_cents`
 * (migration 090) — Stripe's own answer to "what is the next invoice", mirrored by the webhook and
 * the reconcile through the mapping they share. Which means:
 *
 *   · a company WITH a subscription is told its own mirrored amount, and nothing else;
 *   · a company WITHOUT one (a trial, a lapsed trial, a cancellation) is told `PLAN_PRICE`,
 *     because for them it is the product's price and there is no discount to know about;
 *   · and if a subscription exists but no amount has been mirrored yet, the page says so rather
 *     than falling back to the list price, because that fallback is exactly the bug.
 *
 * `PLAN_PRICE` therefore survives, with a much narrower job, and the old warning still applies to
 * it: **if the plan's price changes in Stripe, this line must change in the same commit**
 * (`docs/RELEASE.md` holds the price id).
 */

import {
  accessFor, GRACE_DAYS, graceDaysLeft, reconcileNeeded,
  type BillingColumns, type ReconcileColumns, type ReconcileReason,
} from './billing.ts'

/**
 * THE PRODUCT'S LIST PRICE — for a company that has no subscription, and nowhere else.
 * See the header. A company WITH a subscription is described by `next_charge_amount_cents`.
 */
export const PLAN_PRICE = '$199'
export const PLAN_PERIOD = 'a month'
/** Board 4's own second line, verbatim. */
export const PLAN_NOTE = 'Everything in CompliBoard, for everyone at your company. Cancel any time.'

/** Board 4's line under the plan rows, verbatim. */
export const STRIPE_NOTE =
  'Cards and invoices are handled by Stripe on its own secure page; we never see your card number.'
export const MANAGE_LINK = 'Manage billing and invoices'

/** Board 4's third section, verbatim. Three plain paragraphs, in the board's order. */
export const AFTER_THE_TRIAL: ReadonlyArray<{ key: string; text: string }> = [
  { key: 'Without a card',
    text: 'Your account stays, and so does everything in it. You can sign in and read, download '
        + 'and print. Asking, reading documents and auditing pause until a card is added.' },
  { key: 'If a card fails',
    text: 'We try again for 7 days and email you. After that, the same pause until the card is fixed.' },
  { key: 'Deleting',
    text: 'Only you can delete your company, from the Cancel tab. Not paying never deletes anything.' },
]

/* =================================================================================================
 * THE RECONCILE'S TRIGGER, AND THE TWO THINGS IT CAN SAY — My Account step 20, `DECISIONS.md` §220.
 *
 * *** THE TRIGGER IS THE STATE, NOT THE QUERY STRING, AND THAT IS THE WIDENING. ***
 * The obvious rule is "`?card=added` is on the address, so reconcile". It is too narrow in both
 * directions. A person who bookmarks `/account?tab=billing&card=added` re-triggers it for ever;
 * and — the case that actually happened — somebody who comes back to the Billing tab an hour after
 * a missed delivery, or follows the read-only banner there, has no query string at all and the
 * identical broken mirror. During the owner's own walk the address had no `card=added` on it by
 * the time he looked.
 *
 * So the condition is the one state that cannot be right: **a Stripe customer and no subscription.**
 * A customer exists the moment Checkout is OPENED (§218), so that state has two readings — "they
 * abandoned the session" and "we missed the event" — and asking Stripe is the only way to tell
 * them apart. The reconcile is what asks, and `nothing_at_stripe` is the answer that means the
 * first one, on which nothing is written and nothing is said.
 *
 * `?card=added` survives for exactly one job: deciding whether the person is WAITING. Somebody who
 * has just come back from Checkout is owed a word about the delay; somebody browsing is not owed a
 * progress message about a repair they never asked for. Same request either way, different words.
 *
 * And the query string is stripped afterwards, so a refresh cannot re-trigger the message.
 * ============================================================================================== */

/** Shown while the reconcile is in flight, and only to somebody back from Checkout. */
export const FINISHING_UP = 'Finishing up…'
/**
 * Shown when the reconcile ended and the mirror STILL has no subscription — to somebody back from
 * Checkout, who may well have just been charged.
 *
 * *** IT DOES NOT CLAIM ANYTHING ABOUT THEIR CARD, BECAUSE WE DO NOT KNOW. *** §5.1: never assert
 * a fact about something we failed to read. It says what is true — we are not finished — and what
 * they can do. The webhook may land a second later, and then a refresh is all it takes.
 */
export const FINISHING_STALLED = 'Finishing up — refresh in a moment.'

export type ReconcileTrigger = {
  /** Whether to POST `/api/billing/reconcile` on this load. */
  call: boolean
  /** The line to show while it runs, or null for the quiet path. */
  say: string | null
  /** Why, when it fires. For the log, and so a test names a case rather than a boolean. */
  reason: ReconcileReason | null
}

/**
 * SHOULD THIS LOAD ASK THE SERVER TO RECONCILE, AND SHOULD IT SAY SO?
 *
 * The RULE is `reconcileNeeded` in `lib/billing.ts` — the server asks the same function before it
 * spends a Stripe call, so the page and the route cannot drift. What lives here is the WORDS.
 *
 * *** WIDENED AT §222: IT NO LONGER FIRES ONLY ON AN EMPTY MIRROR. *** A missed delivery on a
 * subscription we already know about leaves the row stale, and §220's `.is(null)` guard could not
 * heal it — which, on the owner's walk, left a customer who had just paid $199 sitting at
 * "payment failed" with the grace counting down to a lock-out. `reconcileNeeded`'s header has the
 * four states that now qualify and why each one is a state Stripe does not leave alone.
 *
 * `?card=added` still does one job and one only: deciding whether the person is WAITING. Somebody
 * back from Checkout is owed a word about the delay. Somebody whose stale `past_due` is being
 * quietly checked is not owed a progress message about a repair they never asked for — and if it
 * finds nothing, as it will for a genuinely failing card, they should see no sign it happened.
 */
export function reconcileTrigger(
  c: ReconcileColumns,
  cardAdded: boolean,
  now: Date = new Date(),
): ReconcileTrigger {
  const reason = reconcileNeeded(c, now)
  if (!reason) return { call: false, say: null, reason: null }
  // Only the empty-mirror case can follow a Checkout, so only it can be waited on. The three
  // stale-state cases are reached by opening the tab, where nothing is pending.
  const waiting = cardAdded && reason === 'no_subscription_mirrored'
  return { call: true, say: waiting ? FINISHING_UP : null, reason }
}

/** The tone of the status pill. The page maps these to colours; the words are decided here. */
export type StatusTone = 'trial' | 'good' | 'warn' | 'paused'

export type BillingTabView = {
  /** True when Stripe has a cancellation scheduled. The Cancel tab reads it too. */
  cancelScheduled: boolean
  /**
   * Whether there is a subscription to manage at all. The page uses it to decide whether to offer
   * "Manage billing and invoices", which goes to the portal unconditionally — and a portal opened
   * for a customer with no subscription is the same dead end the card door used to lead to.
   */
  hasSubscription: boolean
  status: {
    /** The pill's word: Trial · Active · Payment failed · Canceled · Read-only. */
    pill: string
    tone: StatusTone
    /** The line beside the pill — "9 days left", "Next payment 30 November 2026", or ''. */
    headline: string
    /** The sentence under it. Always written; never empty. */
    detail: string
  }
  /* ---- WHAT THIS COMPANY PAYS — migration 090, §221. ---- */
  plan: {
    /** "$0" · "$99.50" · "$199". The mirrored amount, or the list price when there is no
     *  subscription to have an amount. Never the list price as a stand-in for an unread one. */
    amount: string
    /** "a month". */
    period: string
    /** "FOUNDER100, 100% off, forever" · "HALFYEAR, 50% off for 6 months, then $199" · ''. */
    discount: string
    /** The line under it. Board 4's own, or the sentence that says the amount is not known yet. */
    note: string
  }
  card: {
    /** "No card yet" · "Visa ending 4242" · "Not needed — there is nothing to pay". */
    text: string
    /** "Add a card" or "Change". **`''` means render no button at all.** */
    action: string
    /** Which door the action opens. A card is ADDED at checkout and CHANGED in the portal. */
    door: 'checkout' | 'portal'
    /** A second line under the card text, or ''. The date a discount ends, when one does. */
    note: string
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "visa" → "Visa". Only the first letter: "American Express" is not ours to invent from "amex". */
function titleCase(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v
}

/** "30 October 2026" — the shape every other date in this product uses (`lib/checklistView.ts`). */
export function plainDate(v: string | Date | null | undefined): string {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Whole days from `now` to `then`, **counted off a calendar**, never below 0.
 *
 * *** CALENDAR DAYS, NOT ELAPSED HOURS, AND THE TEST IS WHAT FOUND THAT. ***
 * `ceil((then - now) / 24h)` looks equivalent and is not. On 22 October, with the trial ending at
 * noon on the 30th, it returns **9** — because 8.96 days rounds up — so the page would say "9 days
 * left" on two consecutive days and then jump. It also made "Ends today" unreachable: by the time
 * the elapsed count hit 0 the trial was already over and `accessFor` had moved on, so that branch
 * was dead code that read as if it worked.
 *
 * Both dates are floored to UTC midnight and subtracted, which is what somebody counting squares
 * on a calendar does: 9 all through the 21st, 8 all through the 22nd, 0 on the 30th until the
 * moment it ends.
 */
export function daysUntil(then: string | Date, now: Date): number {
  const d = then instanceof Date ? then : new Date(then)
  const midnight = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  return Math.max(0, Math.round((midnight(d) - midnight(now)) / DAY_MS))
}

/* =================================================================================================
 * WHAT THIS COMPANY PAYS, IN WORDS — migration 090, `DECISIONS.md` §221.
 * ============================================================================================== */

/**
 * CENTS → "$199" · "$99.50" · "$0".
 *
 * **Trailing `.00` is dropped and nothing else is.** "$199.00 a month" reads like a form; "$199 a
 * month" is what the boards say and what the owner's wording asks for. But "$99.50" must keep both
 * places, and "$99.5" would be a price nobody writes.
 *
 * The currency symbol is taken from a small table rather than `Intl.NumberFormat`, because
 * `Intl` formats to the RUNTIME's locale conventions — the same amount renders "US$199.00" in some
 * and "199,00 $US" in others, and this string has to match a board. An unknown currency is printed
 * with its ISO code beside the number instead of a guessed symbol, which is ugly and true.
 */
const SYMBOLS: Readonly<Record<string, string>> = { usd: '$', eur: '\u20ac', gbp: '\u00a3' }

export function money(amountCents: number, currency: string): string {
  const whole = amountCents / 100
  const digits = Number.isInteger(whole) ? 0 : 2
  const n = whole.toFixed(digits)
  const symbol = SYMBOLS[currency?.toLowerCase() ?? '']
  return symbol ? `${symbol}${n}` : `${n} ${(currency ?? '').toUpperCase()}`.trim()
}

/** What the coupon takes off, in words: "100% off" · "50% off" · "$50 off". */
function takesOff(c: BillingViewColumns): string {
  if (typeof c.discount_percent_off === 'number') {
    // 33.33% must keep its places; 50% must not become "50.00%".
    const p = Number.isInteger(c.discount_percent_off)
      ? String(c.discount_percent_off)
      : String(Number(c.discount_percent_off.toFixed(2)))
    return `${p}% off`
  }
  if (typeof c.discount_amount_off_cents === 'number') {
    return `${money(c.discount_amount_off_cents, c.next_charge_currency ?? 'usd')} off`
  }
  // A discount we know the name of and not the shape of. Saying the name alone is still true.
  return 'discount applied'
}

/** How long it lasts: "forever" · "for 6 months" · "on your first payment only". */
function lastsFor(c: BillingViewColumns): string {
  if (c.discount_duration === 'forever') return 'forever'
  if (c.discount_duration === 'repeating') {
    const m = c.discount_months
    return typeof m === 'number' && m > 0 ? `for ${m} month${m === 1 ? '' : 's'}` : 'for a while'
  }
  // *** `once` IS THE ONE THAT HAS TO BE SAID OUT LOUD. *** It zeroes one charge and nothing after
  // it, and `discount.end` is null for it exactly as it is for `forever` — so a page that did not
  // read `duration` would show a one-off discount as permanent. §217's "forever coupons only" is
  // the rule; this is what the page says if one is ever issued anyway.
  if (c.discount_duration === 'once') return 'on your first payment only'
  return ''
}

/**
 * THE DISCOUNT PHRASE THAT FOLLOWS THE AMOUNT, or ''.
 *
 *   "FOUNDER100, 100% off, forever"
 *   "HALFYEAR, 50% off for 6 months, then $199"
 *
 * The "then" tail is only added when the discount ENDS and the list price is the thing that
 * resumes — which is what a person actually needs to know about a temporary discount, and the one
 * place a list price is still the truth about this company's future.
 */
export function discountPhrase(c: BillingViewColumns): string {
  if (!c.discount_name) return ''
  const off = takesOff(c)
  const lasts = lastsFor(c)
  const temporary = c.discount_duration === 'repeating' || c.discount_duration === 'once'
  const head = lasts
    // "50% off for 6 months" reads as one clause; "100% off, forever" needs the comma.
    ? (temporary ? `${c.discount_name}, ${off} ${lasts}` : `${c.discount_name}, ${off}, ${lasts}`)
    : `${c.discount_name}, ${off}`
  return temporary ? `${head}, then ${PLAN_PRICE}` : head
}

/** The three things the page needs to know about the money, decided once. */
type Money = {
  /** True when a subscription exists AND Stripe has told us its next total. */
  known: boolean
  /** The mirrored total in cents when `known`, else null. **0 is a real value.** */
  cents: number | null
  /** What to print: the mirrored amount, or the list price when there is no subscription. */
  amount: string
  /** True when nothing will EVER be charged — zero, and a discount that does not end. */
  freeForever: boolean
  /** True when a charge is coming that is more than nothing. */
  willCharge: boolean
  /** "a month" — carried so the sentences do not each reach for the constant. */
  period: string
}

function moneyFor(c: BillingViewColumns, hasSubscription: boolean): Money {
  const cents = typeof c.next_charge_amount_cents === 'number' ? c.next_charge_amount_cents : null
  const known = hasSubscription && cents !== null
  // *** THE FALLBACK IS THE BUG, SO THERE ISN'T ONE. *** With a subscription and no mirrored
  // amount the page must not print the list price: that is precisely what told a FOUNDER100
  // customer they owed $199. `known: false` makes the words say so instead.
  const amount = known ? money(cents as number, c.next_charge_currency ?? 'usd') : PLAN_PRICE
  const zero = known && cents === 0
  // `forever` only. A `repeating` or `once` zero is temporary, and a card WILL be needed.
  const freeForever = zero && c.discount_duration === 'forever'
  return {
    known, cents, amount, freeForever, period: PLAN_PERIOD,
    willCharge: known && (cents as number) > 0,
  }
}

/**
 * THE SENTENCE UNDER "ACTIVE" — the second of the three false statements §221 is about.
 *
 * It used to be one string: **"$199 a month, charged to the card below. Cancel any time from the
 * Cancel tab."** For the FOUNDER100 company every clause of it was wrong — not $199, not charged,
 * and there was no card below. So it is now four sentences for four genuinely different states,
 * and the rule running through all of them is: **never say "charged to the card below" unless
 * there is a card below and something to charge to it.**
 */
function activeDetail(m: Money, hasCard: boolean, discountEnds: string): string {
  const CANCEL_ANY_TIME = 'Cancel any time from the Cancel tab.'

  // 1. Nothing to pay, ever. No amount, no card, no instruction — just the fact.
  if (m.freeForever) {
    return `Your discount covers the whole of it, so there is nothing to pay and no card is `
         + `needed. ${CANCEL_ANY_TIME}`
  }

  // 2. Nothing to pay YET, and that will change on a date we know. This is the state that would
  //    otherwise lapse somebody silently — see §221 on what is handled here and what is owed.
  if (m.known && m.cents === 0) {
    return discountEnds
      ? `Nothing to pay until ${discountEnds}, when your discount ends and ${PLAN_PRICE} ${PLAN_PERIOD} `
        + `resumes. ${CANCEL_ANY_TIME}`
      : `There is nothing to pay at the moment. ${CANCEL_ANY_TIME}`
  }

  // 3. A real charge is coming and there is a card for it. The original sentence, with the
  //    company's OWN amount in place of the list price.
  if (hasCard) return `${m.amount} ${m.period}, charged to the card below. ${CANCEL_ANY_TIME}`

  // 4. A real charge is coming and there is NO card. The one case where asking is the right thing
  //    to do, and it is said as a consequence rather than as a nag.
  return `${m.amount} ${m.period}. Add a card below so the next payment can go through. `
       + CANCEL_ANY_TIME
}

/** "9 days left" · "1 day left" · "Ends today". */
function daysLeftPhrase(n: number): string {
  if (n === 0) return 'Ends today'
  return `${n} day${n === 1 ? '' : 's'} left`
}

/** Exactly the columns this view reads. A superset of `accessFor`'s three. */
export type BillingViewColumns = BillingColumns & {
  current_period_end?: string | Date | null
  card_brand?: string | null
  card_last4?: string | null
  /** Which door the card control opens. NOT the customer id — see below. */
  stripe_subscription_id?: string | null
  /** Stripe's scheduled end (migration 089). Set = a cancellation is pending; null = none. */
  cancel_at?: string | Date | null
  /* ---- WHAT THIS COMPANY PAYS (migration 090) ----
     `next_charge_amount_cents` is Stripe's own next-invoice total. **0 is a real value and is not
     the same as null**: 0 means nothing to pay, null means we could not establish it. */
  next_charge_amount_cents?: number | null
  next_charge_currency?: string | null
  discount_name?: string | null
  discount_percent_off?: number | null
  discount_amount_off_cents?: number | null
  /** Stripe's word: `forever` | `once` | `repeating`. The only thing telling `once` from `forever`. */
  discount_duration?: string | null
  discount_months?: number | null
  discount_ends_at?: string | Date | null
}

/**
 * THE WHOLE TAB, AS WORDS. One function, every state, no branching left for the page to do.
 *
 * The status comes from `accessFor`'s REASON rather than from Stripe's status word, so this tab
 * and the gate can never disagree about whether a company is paused — they are the same decision
 * read twice. The Stripe word is still used, but only to tell `canceled` apart from the other
 * not-paying words, which is a wording difference and not an access one.
 */
export function billingTabView(c: BillingViewColumns, now: Date): BillingTabView {
  const verdict = accessFor(c, now)
  const status = c.subscription_status

  // ---- THE CARD. Both halves come from the mirror; neither is computed. ----
  //
  // *** THE DOOR IS THE SUBSCRIPTION'S, NOT THE CUSTOMER'S. CORRECTED 24 OCTOBER 2026 — §218. ***
  // This read `c.stripe_customer_id ? 'portal' : 'checkout'`, with the comment that "a customer
  // may exist without a card … and the portal is still the right door then". It is not.
  //
  // A Stripe customer exists the moment somebody OPENS checkout, even if they close the tab. The
  // old rule therefore sent that person to the PORTAL on every subsequent press, where they can
  // attach a card that:
  //   · we never hear about — none of the six events the webhook handles fires for a payment
  //     method attached to a customer with no subscription; and
  //   · nothing will ever charge, because there is no subscription to charge it against.
  // One abandoned checkout and the person is stuck in that loop until they lapse on day 15,
  // having added a card and been shown no sign that anything is wrong.
  //
  // The portal manages a subscription. With no subscription there is nothing to manage, and the
  // door is checkout — which reuses the stored customer (`billing/checkout/route.ts:61` only
  // creates one when the column is null), so nobody gets a second customer. That was step 19's
  // stated reason for the old rule and it was unfounded.
  //
  // `app/account/page.tsx`'s Cancel tab already keyed on the subscription, with that reasoning
  // written out beside it. This now matches it.
  const hasSubscription = Boolean(c.stripe_subscription_id)
  const hasCard = Boolean(c.card_brand && c.card_last4)

  /**
   * *** A SCHEDULED CANCELLATION DOES NOT SHOW IN THE STATUS, SO IT HAS TO SHOW HERE. ***
   *
   * Cancelling in the portal sets `cancel_at_period_end`; Stripe keeps `status` as `trialing` or
   * `active` until the date arrives (read from the sandbox, 24 October — migration 089's header
   * has the three lines). So before step 20 this tab told somebody who had just cancelled, and
   * already had a card, "Trial · 14 days left · Add a card before then and nothing changes on the
   * day" — three separate untruths in one row, about money.
   *
   * Where it applies, the cancellation sentence REPLACES the advice line rather than joining it.
   * Two sentences, one saying "add a card" and one saying "you cancelled", is worse than either.
   */
  const cancelScheduled = Boolean(c.cancel_at)
  const cancelsOn = cancelScheduled ? plainDate(c.cancel_at ?? null) : ''
  const CANCELLED_DETAIL =
    'You cancelled. You keep everything until then, and nothing further will be charged. '
    + 'Change your mind in Stripe.'
  const door: 'checkout' | 'portal' = c.stripe_subscription_id ? 'portal' : 'checkout'
  /* ---- WHAT THIS COMPANY PAYS. One decision, used by all three rows. ---- */
  const m = moneyFor(c, hasSubscription)
  const discount = discountPhrase(c)
  const discountEnds = c.discount_ends_at ? plainDate(c.discount_ends_at) : ''

  const plan: BillingTabView['plan'] = {
    amount: m.amount,
    period: PLAN_PERIOD,
    discount,
    // The one case the old code had no words for: a subscription exists and Stripe has not told us
    // what the next invoice totals (a canceled subscription has no upcoming invoice at all). The
    // page must NOT fall back to the list price here — that fallback is the whole finding.
    note: hasSubscription && !m.known
      ? 'Your plan is active. The amount of your next payment will appear here shortly.'
      : PLAN_NOTE,
  }

  /* ---- THE CARD ROW. ------------------------------------------------------------------------
     *** IT DOES NOT ASK FOR A CARD WHEN NOTHING WILL EVER BE CHARGED. ***
     A 100%-off-forever customer was being shown "No card yet · Add a card" — an instruction to do
     something pointless, beside a status claiming a $199 charge that will never happen. There is
     no card because none is needed, and saying so is both true and the end of the matter.

     `forever` is the only duration that earns this. A `repeating` or `once` zero is temporary and
     a card WILL be needed, so that company is still asked — with the date, see `note`. */
  const card: BillingTabView['card'] = hasCard
    // *** THE BRAND IS CAPITALISED HERE, BECAUSE STRIPE SENDS IT LOWER CASE. ***
    // `card.brand` comes back as `visa`, `mastercard`, `amex`. The mirror stores Stripe's own
    // value verbatim (migration 087's rule, and the webhook must not translate), so the one place
    // that can fix the sentence is the one that writes the sentence. Board 4 and the step 19 brief
    // both say "Visa ending 4242"; the staging run showed "visa ending 4242".
    ? { text: `${titleCase(c.card_brand ?? '')} ending ${c.card_last4}`, action: 'Change', door, note: '' }
    : m.freeForever
      ? { text: 'Not needed \u2014 there is nothing to pay', action: '', door, note: '' }
      : {
          text: 'No card yet',
          action: 'Add a card',
          door,
          // *** AND WHEN A DISCOUNT ENDS, THE DATE IS THE POINT. *** A person on "50% off for 6
          // months" with no card has a real deadline, and it is the only honest reason to ask them
          // for a card today. Without the date the request has no force and reads as nagging.
          note: discountEnds && !hasCard
            ? `Your discount ends ${discountEnds}. Add a card before then so the payment can go through.`
            : '',
        }

  // ---- THE STATUS. Driven by the gate's own reason. ----
  switch (verdict.reason) {
    case 'trial': {
      const n = daysUntil(c.trial_ends_at, now)
      return {
        card, plan, hasSubscription, cancelScheduled,
        status: {
          pill: 'Trial', tone: cancelScheduled ? 'warn' : 'trial',
          headline: cancelScheduled
            ? `${daysLeftPhrase(n)} · Cancels on ${cancelsOn}`
            : daysLeftPhrase(n),
          detail: cancelScheduled
            ? CANCELLED_DETAIL
            : `Your trial ends ${plainDate(c.trial_ends_at)}. `
              + 'Add a card before then and nothing changes on the day.',
        },
      }
    }

    case 'subscribed':
      if (cancelScheduled) {
        return {
          card, plan, hasSubscription, cancelScheduled,
          status: {
            pill: 'Active', tone: 'warn', headline: `Cancels on ${cancelsOn}`,
            // No "next payment" line: there isn't one. That was the other false statement.
            detail: CANCELLED_DETAIL,
          },
        }
      }
      return {
        card, plan, hasSubscription, cancelScheduled,
        status: {
          pill: 'Active', tone: 'good',
          // *** "NEXT PAYMENT" ONLY WHEN THERE IS A PAYMENT. *** A 100%-off-forever company has a
          // renewal date and no payment; calling it a payment is the same class of false statement
          // as the price was. It gets "Renews" instead, which is exactly what happens on the day.
          headline: !c.current_period_end ? ''
            : m.freeForever ? `Renews ${plainDate(c.current_period_end)}`
            : `Next payment ${plainDate(c.current_period_end)}`,
          // `current_period_end` can be null for a moment after checkout, before the subscription
          // webhook lands. Saying so is better than an empty line or an invented date.
          detail: !c.current_period_end
            ? 'Your subscription is active. The next payment date will appear here shortly.'
            : activeDetail(m, hasCard, discountEnds),
        },
      }

    // Access is still FULL here — decision 11's seven days. The words must not suggest otherwise.
    case 'payment_failed_in_grace': {
      const n = c.payment_failed_at === null ? GRACE_DAYS : Math.max(1, graceDaysLeft(c.payment_failed_at, now))
      return {
        card, plan, hasSubscription, cancelScheduled,
        status: {
          pill: 'Payment failed', tone: 'warn', headline: `${n} day${n === 1 ? '' : 's'} left`,
          detail: `We couldn't charge your card. We'll try again for ${n} more day${n === 1 ? '' : 's'} `
                + '— update it to keep everything running. Nothing has stopped working yet.',
        },
      }
    }

    // `past_due` with no anchor: Stripe is still retrying and we have no date to quote.
    case 'payment_failed_retrying':
      return {
        card, plan, hasSubscription, cancelScheduled,
        status: {
          pill: 'Payment failed', tone: 'warn', headline: '',
          detail: "We couldn't charge your card and we're trying again. Nothing has stopped "
                + 'working. Updating your card now is the quickest way to settle it.',
        },
      }

    case 'payment_failed_grace_over':
      return {
        card, plan, hasSubscription, cancelScheduled,
        status: {
          pill: 'Read-only', tone: 'paused', headline: '',
          detail: `We couldn't charge your card and the ${GRACE_DAYS} days are up. Everything is `
                + 'still here to read and download. Update your card to start asking again.',
        },
      }

    case 'trial_over_no_subscription':
      return {
        card, plan, hasSubscription, cancelScheduled,
        status: {
          pill: 'Read-only', tone: 'paused', headline: '',
          detail: `Your trial ended ${plainDate(c.trial_ends_at)}. Everything is still here to read `
                + 'and download. Add a card to start asking, reading documents and auditing again.',
        },
      }

    case 'not_paying':
      // `canceled` is its own word on the board. The rest — `unpaid`, `paused`, `incomplete`,
      // `incomplete_expired` — are states a person did not choose, so they read as Read-only.
      if (status === 'canceled') {
        return {
          card, plan, hasSubscription, cancelScheduled,
          status: {
            pill: 'Canceled', tone: 'paused', headline: '',
            detail: 'Your subscription is canceled. Everything is still here to read and download, '
                  + 'and nothing has been deleted. Add a card whenever you want to start again.',
          },
        }
      }
      return {
        card, plan, hasSubscription, cancelScheduled,
        status: {
          pill: 'Read-only', tone: 'paused', headline: '',
          detail: "Your subscription isn't active. Everything is still here to read and download. "
                + 'Add a card to start asking again.',
        },
      }

    // A status word Stripe invented after this was written. Named, so support can act on it.
    case 'status_not_recognised':
    default:
      return {
        card, plan, hasSubscription, cancelScheduled,
        status: {
          pill: 'Read-only', tone: 'paused', headline: '',
          detail: `Your subscription is in a state we don't recognise${status ? ` (${status})` : ''}. `
                + 'Everything is still here to read and download — please get in touch, or add a '
                + 'card to start asking again.',
        },
      }
  }
}
