/**
 * ONE RULE, AT NINETEEN DOORS AND FOUR SWEEPS — My Account step 18, `ACCOUNT-PLAN.md` decision 11.
 *
 * The rule it applies is `lib/billing.ts` `accessFor`, which has no imports at all so the browser
 * can reach the same verdict. **The rule lives there; the doors live here.**
 *
 * *** THIS FILE DELIBERATELY DOES NOT IMPORT `next/server`, AND THAT IS NOT TIDINESS. ***
 * `lib/handbookCheck.ts` imports it, and `tests/unit/handbookCheck.test.ts` runs under plain
 * `node --test`, which cannot resolve the bare specifier `next/server` ("Did you mean to import
 * next/server.js?"). A `NextResponse` in here would have made the handbook sweep — the one cron
 * that was already testable offline — untestable. So the person-facing door, which must return a
 * real HTTP response, lives in `lib/requireAccess.ts` and imports this. Found by the test
 * refusing to load, not by foresight.
 *
 * ---- WHY TWO SHAPES AND NOT ONE ------------------------------------------------------------------
 *
 * A person pressing a button and a cron working a queue need opposite answers to the same question.
 *
 *   `requireAccess`  — one company, already authenticated, answer or refuse. Returns a 402 whose
 *                      body is ONE PLAIN SENTENCE the section's existing error path already renders.
 *   `splitByAccess`  — many companies' work items in one run: keep the ones that may be worked,
 *                      report the rest so the caller can leave them where they are and log once.
 *                      PURE — no database, no clock of its own — which is the only reason the
 *                      two-company cron test can run offline.
 *
 * ---- AND WHY A SKIP IS NOT A FAILURE -------------------------------------------------------------
 *
 * Decision 11: "nothing is ever deleted for non-payment." A skipped work item is LEFT IN THE STATE
 * THAT ALREADY MEANS 'WAITING' — not claimed, not marked failed, not touched at all — so the day a
 * card is added the work simply runs. Each cron's own comment says what that state is for its table.
 */

import { accessFor, type BillingColumns, type BillingReason, type BillingVerdict } from './billing.ts'

/**
 * WHAT A REFUSED PERSON IS TOLD.
 *
 * Four sentences, one per reason that can refuse. Every one of them says the same two things,
 * because `CLAUDE.md` §5.1 asks for both: **what still works** ("everything is still here to read
 * and download" — which is true, and is the whole of decision 11), and **what they can do next**.
 * None of them implies the person did anything wrong, because they did not.
 */
export function sentenceFor(reason: BillingReason, status: string | null): string {
  switch (reason) {
    case 'trial_over_no_subscription':
      return 'Your trial has ended. Everything is still here to read and download — '
           + 'add a card to start asking again.'
    case 'payment_failed_grace_over':
      return "We couldn't charge your card. Everything is still here to read and download — "
           + 'update your card to start asking again.'
    case 'not_paying':
      return "Your subscription isn't active. Everything is still here to read and download — "
           + 'add a card to start asking again.'
    // The fourth. It NAMES THE WORD, because this branch exists for a status Stripe invented after
    // this was written: a person who rings up can say which one, and support can act on it without
    // reading a log. Refusing silently here would be the product asserting something it cannot
    // explain (`CLAUDE.md` §6).
    case 'status_not_recognised':
      return `Your subscription is in a state we don't recognise${status ? ` (${status})` : ''}. `
           + 'Everything is still here to read and download — please get in touch, or add a card '
           + 'to start asking again.'
    // Not reachable from a read_only verdict; present so a new reason cannot fall through silently.
    default:
      return "Your subscription isn't active. Everything is still here to read and download — "
           + 'add a card to start asking again.'
  }
}

/**
 * THE REFUSAL, AS A VALUE — the whole decision `requireAccess` makes, with no `NextResponse`.
 *
 * `null` means carry on. Anything else is the exact status and body to return.
 *
 * *** IT IS SPLIT OUT FOR ONE REASON: THIS IS THE PART A TEST CAN RUN. *** `requireAccess` has
 * to import `next/server`, and `node --test` cannot resolve that specifier, so a rule living
 * inside it would be testable only by matching its own source text. Here it is nineteen doors'
 * worth of behaviour in a pure function, and `requireAccess` is the four lines that fetch a row
 * and wrap the answer.
 */
export function accessRefusal(
  row: BillingColumns | null,
  now: Date,
  readFailed = false,
): { status: number; body: Record<string, unknown> } | null {
  if (readFailed || !row) {
    // We could not establish that they may spend, so we do not spend — and it is said as OUR
    // problem, because it is (`CLAUDE.md` §5.1). 503 and not 402: nothing has been decided
    // about their subscription, so telling them to pay would be a claim we cannot support.
    return {
      status: 503,
      body: { error: "We couldn't check your subscription just now. Everything is still here to read "
                   + 'and download — please try again in a moment.' },
    }
  }
  const verdict = accessFor(row, now)
  if (verdict.access === 'full') return null
  return {
    status: 402,
    body: { error: sentenceFor(verdict.reason, verdict.status), reason: verdict.reason, access: 'read_only' },
  }
}

/* ---- THE SWEEPS ---------------------------------------------------------------------------------- */

/** A company id we were given work for but could find no company row for. Not a billing state —
 *  an orphan — and it is skipped for the same reason: there is nobody to bill. */
export type SkipReason = BillingReason | 'company_not_found'

export type Skipped<T> = { item: T; companyId: string; reason: SkipReason }

export type Split<T> = { allowed: T[]; skipped: Skipped<T>[] }

/** The least a `loadBilling` caller has to provide. Matches `lib/handbookCheck.ts`'s `Db`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BillingDb = { from: (t: string) => any }

/**
 * PURE. Given work items and what we know about their companies, say which may be worked.
 *
 * Order is preserved in both lists, because `jobs/scan-documents` picks the OLDEST allowed item and
 * an unstable order would make which document is read next depend on a Map's iteration.
 *
 * A company absent from `billing` is skipped, not allowed. A read that FAILED throws before it gets
 * here — the caller awaits its query — so an absence here means the row is genuinely not there.
 */
export function splitByAccess<T extends { company_id: string }>(
  items: readonly T[],
  billing: ReadonlyMap<string, BillingColumns>,
  now: Date,
): Split<T> {
  const allowed: T[] = []
  const skipped: Skipped<T>[] = []
  // One verdict per company, not per item: a company with forty queued documents is one decision.
  const verdicts = new Map<string, BillingVerdict | null>()

  for (const item of items) {
    const id = item.company_id
    if (!verdicts.has(id)) {
      const cols = billing.get(id)
      verdicts.set(id, cols ? accessFor(cols, now) : null)
    }
    const v = verdicts.get(id) ?? null
    if (v === null) skipped.push({ item, companyId: id, reason: 'company_not_found' })
    else if (v.access === 'read_only') skipped.push({ item, companyId: id, reason: v.reason })
    else allowed.push(item)
  }
  return { allowed, skipped }
}

/**
 * ONE LOG LINE PER SKIPPED COMPANY PER RUN — not per item.
 *
 * A read-only company with forty queued documents would otherwise write forty identical lines
 * every five minutes, for ever, and the line that mattered would be unfindable among them.
 * Returns the lines as well as printing them, so a test can read them rather than capture stdout.
 */
export function logSkips<T>(job: string, skipped: readonly Skipped<T>[], what: string): string[] {
  const byCompany = new Map<string, { reason: SkipReason; n: number }>()
  for (const s of skipped) {
    const e = byCompany.get(s.companyId)
    if (e) e.n += 1
    else byCompany.set(s.companyId, { reason: s.reason, n: 1 })
  }
  const lines: string[] = []
  for (const [companyId, { reason, n }] of byCompany) {
    const line = `[${job}] skipped company ${companyId}: read_only (${reason}) — `
               + `${n} ${what}${n === 1 ? '' : 's'} left queued`
    lines.push(line)
    console.log(line)
  }
  return lines
}

/**
 * Read the billing columns for a set of companies in ONE query.
 *
 * Takes its client as a parameter so a cron can hand it the admin client (it serves every company,
 * so there is no caller to scope to) and a test can hand it a fake.
 *
 * The parameter is the STRUCTURAL shape below and not `SupabaseClient`, for the same reason
 * `lib/handbookCheck.ts` declares its own `Db`: the full client type cannot be satisfied by a
 * hand-written fake without 24 properties nothing calls, and a cron test that cannot fake its
 * database is a cron test that has to reach a real one.
 */
export async function loadBilling(
  db: BillingDb,
  companyIds: readonly string[],
): Promise<Map<string, BillingColumns>> {
  const ids = [...new Set(companyIds)]
  const out = new Map<string, BillingColumns>()
  if (ids.length === 0) return out
  // *** WRITTEN OUT, NOT INTERPOLATED FROM `BILLING_SELECT`. ***
  // `scripts/check-schema-contracts.js` check 1 validates every column named in a query string
  // against the generated types — and it cannot see into a template literal, so
  // `select(\`id, ${BILLING_SELECT}\`)` was reported as "no such column '_'". A select it cannot
  // read is a select nothing checks, which is the one thing that check exists to prevent.
  const { data, error } = await db
    .from('companies')
    .select('id, trial_ends_at, subscription_status, payment_failed_at, stripe_customer_id')
    .in('id', ids)
  // Throw rather than return an empty map: an empty map would skip every company, which looks
  // exactly like "nobody may spend" and would silently stop all work. §9a — a check that cannot
  // see anything must not be read as a check that found nothing.
  if (error) throw new Error(`loadBilling failed: ${error.message}`)
  for (const row of data ?? []) {
    out.set((row as { id: string }).id, row as unknown as BillingColumns)
  }
  return out
}
