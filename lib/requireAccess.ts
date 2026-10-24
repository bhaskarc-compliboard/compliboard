/**
 * THE DOOR FOR A PERSON — My Account step 18. The 402 half of `lib/accessGate.ts`.
 *
 * Server-only: it imports `lib/auth.ts`, which holds the service-role key (`CLAUDE.md` §3.5).
 * It is a separate file from the rule and the sweeps' splitter for one concrete reason, written
 * out in `lib/accessGate.ts`'s header: this imports `next/server`, and anything that does cannot
 * be loaded by `node --test`.
 */

import { NextResponse } from 'next/server'
import type { AuthedCompany } from './auth.ts'
import { accessFor, type BillingColumns } from './billing.ts'
import { accessRefusal } from './accessGate.ts'

/**
 * THE DOOR FOR A PERSON. `null` means carry on; a response means stop and return it.
 *
 *     const authed = await requireCompany(request)
 *     if (!authed.ok) return authed.response
 *     const paused = await requireAccess(authed.auth)     // <- these two lines
 *     if (paused) return paused
 *
 * **Read through `auth.db`, the caller's own RLS-scoped client — not `supabaseAdmin`.** Migration
 * 087 left `authenticated`'s SELECT on `companies` intact (it is what draws the Billing tab), so a
 * person may read their own billing columns and this needs no new service-role use. It also fails
 * CLOSED if the scoping is ever wrong: a policy mistake returns no row, and no row refuses.
 *
 * 402 and not 403: "Payment Required" is the one status that means exactly this, and it is
 * distinguishable in a log from the 401/404 `requireCompany` already returns.
 */
export async function requireAccess(
  auth: AuthedCompany,
  now: Date = new Date(),
): Promise<NextResponse | null> {
  const { data, error } = await auth.db
    .from('companies')
    // Written out rather than shared from a constant: `check-schema-contracts.js` check 1
    // validates column names inside a query string and can only read a literal.
    .select('trial_ends_at, subscription_status, payment_failed_at, stripe_customer_id')
    .eq('id', auth.companyId)
    .maybeSingle()

  if (error) console.error('[requireAccess] could not read billing for company', auth.companyId, error)

  // The whole decision is `accessRefusal`, which is pure and tested in
  // `tests/unit/accessGate.test.ts`. What is left here is the fetch and the wrapper.
  const refusal = accessRefusal((data as unknown as BillingColumns | null) ?? null, now, Boolean(error))
  if (!refusal) return null
  return NextResponse.json(refusal.body, { status: refusal.status })
}
