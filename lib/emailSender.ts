/**
 * ONE SENDER FOR EVERY EMAIL THIS PRODUCT SENDS — Calendar decision 22 (`DECISIONS.md` §185).
 *
 * All four emails send from `CompliBoard <onboarding@resend.dev>`, written out in four files:
 * `lib/auditNotify.ts`, `lib/handbookCheckNotify.ts`, `lib/documentBatch.ts` and
 * `app/api/feedback/route.ts`. That address is **Resend's test sender, not a CompliBoard domain**,
 * and the audit email from the rev 1 smoke test arrived in the owner's JUNK folder because the
 * sending domain has no DNS records (`docs/HANDOFF-AUDITS.md` §8 item 6, `docs/HANDOFF-CODE.md` §7
 * item 5). The send itself was fine — Resend accepted it with an id.
 *
 * *** SO IT IS ONE CONSTANT, AND IT CHANGES ONCE. *** The owner's job is the DNS: verify the company
 * domain in Resend and add its records. The code's job is to have exactly one place to change when
 * he has. Four copies is how a fix reaches three of four senders and nobody notices which one was
 * missed.
 *
 * *** NOTHING CHANGES UNTIL `EMAIL_FROM` IS SET. *** With the variable unset, every sender uses the
 * address it used before, byte for byte, so adding this file cannot alter a single email that goes
 * out today. A unit test holds that.
 */

/** What every sender used before this file existed. Kept as the fallback, deliberately. */
export const RESEND_TEST_SENDER = 'CompliBoard <onboarding@resend.dev>'

/**
 * The `from` line for every email.
 *
 * Set `EMAIL_FROM` on Vercel once the domain is verified — `CompliBoard <hello@compliboard.com>` or
 * whatever the owner chooses. It is read at call time rather than at module load so a deploy that
 * sets it takes effect without a code change, and so a test can set it.
 *
 * A blank or whitespace-only value is treated as unset: an environment variable someone cleared
 * should fall back to something that works, not send from an empty address.
 */
export function emailFrom(): string {
  const set = (process.env.EMAIL_FROM ?? '').trim()
  return set || RESEND_TEST_SENDER
}

/**
 * Whether email can reach a real customer yet. False while the sender is still Resend's test
 * address, because that address delivers to the Resend account's own inbox and nowhere else.
 *
 * Nothing branches on this today — it is here so a screen or a job can say "we cannot email you yet"
 * honestly rather than appearing to have sent something (§5.1), and so the launch gate in decision 22
 * has something to read.
 */
export function canReachCustomers(): boolean {
  return emailFrom() !== RESEND_TEST_SENDER
}
