/**
 * MAKING AN ACCOUNT, AND UNDOING IT — My Account step 12, decision 8.
 *
 * *** WHY THIS IS A FUNCTION AND NOT JUST THE ROUTE'S BODY. *** The thing most worth testing about
 * signup is the thing hardest to test in a route: what happens when the second step fails. The old
 * route could not be asked that question — it was three writes in one `try` whose `catch` returned a
 * 500 — and the answer, read out of the code in `docs/ACCOUNT-MACHINERY.md` §B3, was "a login that
 * can never be used and whose address can never be registered again".
 *
 * So the order and the undo live here, with the three things that touch the outside world passed in
 * (`SignupPorts`). `app/api/signup/route.ts` supplies them from the service-role client; the test
 * supplies three fakes and can therefore make the company creation fail on purpose and watch the
 * login be deleted. Nothing in this file imports a client, a key or the network.
 *
 * THE ORDER IS FIXED AND IT IS THE ONLY SAFE ONE:
 *
 *   1. everything that can be checked without writing anything — the email's shape, the password's
 *      length, a company name that is not blank;
 *   2. the login, because the address is the one thing that can collide and finding that out after
 *      creating a company would leave the company behind;
 *   3. the company, its main site and the profile, in ONE transaction (migration 084);
 *   4. and if 3 fails, 2 is deleted before anything is said, so the address is free to try again.
 *
 * The person is signed in by the PAGE, with the password they just typed, exactly as `/join` and
 * the login page do (`app/join/page.tsx:112`, `app/login/page.tsx:24`). No session is minted here.
 */
import {
  emailLooksLikeOne, normaliseWebsite,
  EMAIL_INVALID, SIGNUP_PASSWORD_MIN, SIGNUP_PASSWORD_SHORT, COMPANY_REQUIRED,
  EMAIL_TAKEN, SIGN_IN_LINK, NOTHING_SAVED, UNDO_FAILED,
} from './signupView.ts'

export interface SignupInput {
  email?: unknown
  password?: unknown
  companyName?: unknown
  website?: unknown
}

/** The three things that reach outside. A failure is a value, never an exception, except where noted. */
export interface SignupPorts {
  /** `auth.admin.createUser` with `email_confirm: true`. `taken` is the duplicate-address case. */
  createLogin(email: string, password: string): Promise<{ id: string } | { problem: 'taken' | 'broken' }>
  /**
   * Migration 084's one transaction. Returns the new company's id, or null when it did not happen.
   * It is handed no email: the address belongs to the login system and the company row has nowhere
   * to put it (084's header, settled at the step 12 stop).
   */
  createCompany(args: { userId: string; companyName: string; website: string | null }):
    Promise<string | null>
  /** `auth.admin.deleteUser`. True when the login is really gone — the sentence depends on it. */
  deleteLogin(id: string): Promise<boolean>
}

export type SignupOutcome =
  | { ok: true; email: string; companyId: string }
  | { ok: false; status: 400 | 409 | 500; error: string; link?: { label: string; href: string } }

const refuse = (status: 400 | 409 | 500, error: string): SignupOutcome => ({ ok: false, status, error })

export async function createAccount(input: SignupInput, ports: SignupPorts): Promise<SignupOutcome> {
  const email = typeof input.email === 'string' ? input.email.trim() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const companyName = typeof input.companyName === 'string' ? input.companyName.trim() : ''
  // An optional field cannot refuse an account: unreadable goes in as nothing. The PAGE says so
  // before it posts, which is where a person can still fix it (`WEBSITE_UNREADABLE`).
  const website = normaliseWebsite(typeof input.website === 'string' ? input.website : null)

  // ---- 1. WHAT CAN BE CHECKED WITHOUT WRITING ANYTHING ----
  // The page checks the same three. These are the ones that count: a form is a convenience, a route
  // is a boundary. Said once each, in the order the fields are drawn, so the first thing a person
  // is told about is the first thing they typed.
  if (!emailLooksLikeOne(email)) return refuse(400, EMAIL_INVALID)
  if (password.length < SIGNUP_PASSWORD_MIN) return refuse(400, SIGNUP_PASSWORD_SHORT)
  if (!companyName) return refuse(400, COMPANY_REQUIRED)

  // ---- 2. THE LOGIN ----
  const login = await ports.createLogin(email, password)
  if ('problem' in login) {
    // Nothing has been written, so there is nothing to undo and the address is untouched.
    return login.problem === 'taken'
      ? { ok: false, status: 409, error: EMAIL_TAKEN, link: { ...SIGN_IN_LINK } }
      : refuse(500, NOTHING_SAVED)
  }

  // ---- 3. THE COMPANY, ITS MAIN SITE AND THE PROFILE — TOGETHER OR NOT AT ALL ----
  let companyId: string | null = null
  try {
    companyId = await ports.createCompany({ userId: login.id, companyName, website })
  } catch {
    // A thrown port is the same outcome as a port that returned nothing: no company.
    companyId = null
  }
  if (companyId) return { ok: true, email, companyId }

  // ---- 4. THE UNDO ----
  // 084 already rolled back the company, its site and the profile. What is left is the login, and
  // leaving it is what made the old failure permanent.
  let undone = false
  try {
    undone = await ports.deleteLogin(login.id)
  } catch {
    undone = false
  }
  // And the sentence tells the truth about which of the two just happened (`CLAUDE.md` §5.1).
  return refuse(500, undone ? NOTHING_SAVED : UNDO_FAILED)
}
