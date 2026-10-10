/**
 * WHETHER THE PRODUCT MAY PROMISE THE MONTHLY EMAIL — the owner, 9 October 2026 (Calendar B4).
 *
 * Decision 21 rewrites the words that promise more than rev 1 does. Some of the new words promise
 * the **monthly email**, and that email reaches no customer until two separate things are true
 * (`DECISIONS.md` §185b). So rather than hold those sentences back by hand and hope somebody
 * remembers to add them — the owner's instruction was explicit: *"Do not hold them by hand"* — the
 * sentences are rendered only when this function says yes.
 *
 * **The two gates:**
 *   1. **The sending domain** (decision 22). Until the company domain is verified in Resend and
 *      `EMAIL_FROM` is set, every email sends from Resend's test address, which reaches the Resend
 *      account's own inbox and nowhere else. `canReachCustomers()` in `lib/emailSender.ts`.
 *   2. **The off switch** (§185b). A monthly email is the only one nobody asked for, and an
 *      unasked-for email with no way to stop it is what people mark as spam — which takes the other
 *      three emails' sender down with it. `MY_ACCOUNT_OFF_SWITCH_EXISTS` below.
 *
 * *** IT SHORT-CIRCUITS ON THE CONSTANT, AND THAT IS DELIBERATE. *** The switch does not exist, so
 * the answer is `false` everywhere today — in a server component, in a client component, in a test —
 * without reading an environment variable at all. That matters, because `process.env.EMAIL_FROM` is
 * **not available in client code**: Next only inlines `NEXT_PUBLIC_*` into the browser bundle. While
 * the constant is false the question never arises.
 *
 * *** AND THE NOTE FOR WHOEVER FLIPS IT. *** My Account's chat builds the switch and sets
 * `MY_ACCOUNT_OFF_SWITCH_EXISTS = true`. At that moment the second gate starts being asked, and on a
 * CLIENT page it would read `EMAIL_FROM` as undefined and answer `false` for ever — the words would
 * stay hidden after the domain was verified, silently. **So that change must also carry the domain's
 * state into the browser** (a `NEXT_PUBLIC_` value set beside `EMAIL_FROM` at release, or the gate
 * resolved on the server and passed down). This is written here rather than in a ticket because the
 * person who flips the constant is the person who needs to read it.
 */
import { canReachCustomers } from './emailSender.ts'

/**
 * Does My Account have the "turn the monthly email off" switch?
 *
 * **FALSE until My Account's chat builds it** (`DECISIONS.md` §185b, `docs/HANDOFF-CODE.md` §7). It is
 * a constant and not an environment variable on purpose: it describes whether a FEATURE EXISTS in
 * this code, which is a fact about the repository, not about a deployment.
 */
export const MY_ACCOUNT_OFF_SWITCH_EXISTS = false

/**
 * Whether a screen may tell a person they will get the monthly email.
 *
 * `opts` exists for the tests, which have to be able to see all four states — a gate only ever
 * exercised in its "no" state is a gate nobody has shown can say yes.
 */
export function monthlyEmailPromised(opts?: { switchExists?: boolean; canReach?: boolean }): boolean {
  const switchExists = opts?.switchExists ?? MY_ACCOUNT_OFF_SWITCH_EXISTS
  // Short-circuits: while the switch does not exist, `canReachCustomers()` is never called, so this
  // works unchanged in client code where `EMAIL_FROM` cannot be read.
  if (!switchExists) return false
  return opts?.canReach ?? canReachCustomers()
}
