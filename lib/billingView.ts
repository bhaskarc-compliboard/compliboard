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
 * ---- WHY THE PRICE IS A CONSTANT HERE, AND WHAT THAT COSTS -------------------------------------
 *
 * `$199` is DISPLAY ONLY. The money that is actually charged is Stripe's, under `STRIPE_PRICE_ID`,
 * and nothing in this repository can read it without an API call. So these two can disagree, and
 * if they ever do the page is lying about a price. The honest options were: show nothing, call
 * Stripe on every page load, or state the number and say plainly where the truth is. The owner's
 * boards show the number, so it is stated — and `docs/RELEASE.md` is where the price id lives.
 * **If the plan's price changes in Stripe, this line must change in the same commit.**
 */

import { accessFor, GRACE_DAYS, graceDaysLeft, type BillingColumns } from './billing.ts'

/** Display only. See the header: Stripe holds the real price. */
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

/** The tone of the status pill. The page maps these to colours; the words are decided here. */
export type StatusTone = 'trial' | 'good' | 'warn' | 'paused'

export type BillingTabView = {
  status: {
    /** The pill's word: Trial · Active · Payment failed · Canceled · Read-only. */
    pill: string
    tone: StatusTone
    /** The line beside the pill — "9 days left", "Next payment 30 November 2026", or ''. */
    headline: string
    /** The sentence under it. Always written; never empty. */
    detail: string
  }
  card: {
    /** "No card yet" or "Visa ending 4242". */
    text: string
    /** "Add a card" or "Change". */
    action: string
    /** Which door the action opens. A card is ADDED at checkout and CHANGED in the portal. */
    door: 'checkout' | 'portal'
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

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
  stripe_customer_id?: string | null
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
  const hasCard = Boolean(c.card_brand && c.card_last4)
  const card: BillingTabView['card'] = hasCard
    ? { text: `${c.card_brand} ending ${c.card_last4}`, action: 'Change', door: 'portal' }
    // A customer may exist without a card (a session opened and abandoned), and the portal is
    // still the right door then — it is where Stripe lets them add one to an existing customer.
    : { text: 'No card yet', action: 'Add a card', door: c.stripe_customer_id ? 'portal' : 'checkout' }

  // ---- THE STATUS. Driven by the gate's own reason. ----
  switch (verdict.reason) {
    case 'trial': {
      const n = daysUntil(c.trial_ends_at, now)
      return {
        card,
        status: {
          pill: 'Trial', tone: 'trial', headline: daysLeftPhrase(n),
          detail: `Your trial ends ${plainDate(c.trial_ends_at)}. `
                + 'Add a card before then and nothing changes on the day.',
        },
      }
    }

    case 'subscribed':
      return {
        card,
        status: {
          pill: 'Active', tone: 'good',
          headline: c.current_period_end ? `Next payment ${plainDate(c.current_period_end)}` : '',
          // `current_period_end` can be null for a moment after checkout, before the subscription
          // webhook lands. Saying so is better than an empty line or an invented date.
          detail: c.current_period_end
            ? `${PLAN_PRICE} ${PLAN_PERIOD}, charged to the card below. Cancel any time from the Cancel tab.`
            : 'Your subscription is active. The next payment date will appear here shortly.',
        },
      }

    // Access is still FULL here — decision 11's seven days. The words must not suggest otherwise.
    case 'payment_failed_in_grace': {
      const n = c.payment_failed_at === null ? GRACE_DAYS : Math.max(1, graceDaysLeft(c.payment_failed_at, now))
      return {
        card,
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
        card,
        status: {
          pill: 'Payment failed', tone: 'warn', headline: '',
          detail: "We couldn't charge your card and we're trying again. Nothing has stopped "
                + 'working. Updating your card now is the quickest way to settle it.',
        },
      }

    case 'payment_failed_grace_over':
      return {
        card,
        status: {
          pill: 'Read-only', tone: 'paused', headline: '',
          detail: `We couldn't charge your card and the ${GRACE_DAYS} days are up. Everything is `
                + 'still here to read and download. Update your card to start asking again.',
        },
      }

    case 'trial_over_no_subscription':
      return {
        card,
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
          card,
          status: {
            pill: 'Canceled', tone: 'paused', headline: '',
            detail: 'Your subscription is canceled. Everything is still here to read and download, '
                  + 'and nothing has been deleted. Add a card whenever you want to start again.',
          },
        }
      }
      return {
        card,
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
        card,
        status: {
          pill: 'Read-only', tone: 'paused', headline: '',
          detail: `Your subscription is in a state we don't recognise${status ? ` (${status})` : ''}. `
                + 'Everything is still here to read and download — please get in touch, or add a '
                + 'card to start asking again.',
        },
      }
  }
}
