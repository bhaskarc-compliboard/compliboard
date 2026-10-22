'use client'

/**
 * /signup — THE FRONT DOOR. Board 6, My Account step 12, decision 8.
 *
 * *** FOUR FIELDS. *** A work email, a password, the company name, and a website that is optional
 * and worth asking for. Nothing else: the account and the 14-day trial exist the moment the button
 * is pressed, and everything else about the company is asked by the walk (board 7) or on the
 * Company tab, where the person can already see what the answers are for.
 *
 * *** WHAT WENT, AND WHY — the three fields this page used to collect. ***
 *   · the INDUSTRY dropdown, which was `distinct requirement_templates.industries`: a list that can
 *     only offer verticals we have already built, shown to somebody who has not yet seen the
 *     product (`docs/WORKSPACE.md:586`). Decision 3 replaces it with what the person types about
 *     themselves, with the NAICS titles as suggestions.
 *   · the STATE dropdown and the CITY box, which made a company's place something a person typed.
 *     A county — which half the library's agencies are keyed on — cannot come out of a dropdown at
 *     all, which is why `entities.county` is NULL for every account ever created (migration 082's
 *     header). The main site's street address and the Census geocoder are the source now
 *     (decisions 16 and 17).
 *   · the WEBSITE SCAN. The box stays and the model call goes: the website is STORED here and read
 *     once, with the person's confirmation, at step 13. Pressing a button that quietly spends money
 *     on a stranger's URL before they have an account was never a good trade.
 *
 * *** IT IS OUTSIDE `AppLayout`, LIKE `/login` AND `/join`. *** The shell reads a session to draw
 * the sidebar and the company name, and nobody here has one yet. The frame is the one this page
 * already had.
 *
 * The words are `lib/signupView.ts`'s, so this page, the route and the tests cannot disagree about
 * them; the rules are checked here for speed and again in the route, which is the boundary.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, authHeaders } from '@/lib/supabase'
import {
  emailLooksLikeOne, normaliseWebsite,
  SIGNUP_TITLE, SIGNUP_LEDE, EMAIL_LABEL, EMAIL_PLACEHOLDER, PASSWORD_LABEL,
  SIGNUP_PASSWORD_HINT, SIGNUP_PASSWORD_MIN, COMPANY_LABEL, COMPANY_PLACEHOLDER,
  WEBSITE_LABEL, WEBSITE_OPTIONAL, WEBSITE_PLACEHOLDER, WEBSITE_GREEN,
  SIGNUP_BUTTON, SIGNUP_BUSY, HAVE_ACCOUNT, SIGN_IN,
  EMAIL_INVALID, SIGNUP_PASSWORD_SHORT, COMPANY_REQUIRED, WEBSITE_UNREADABLE, NOTHING_SAVED,
} from '@/lib/signupView'

const FIELD =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 ' +
  'focus:border-green-500 focus:outline-none disabled:opacity-60'
const LABEL = 'mb-1 block text-xs font-medium text-gray-600'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorLink, setErrorLink] = useState<{ label: string; href: string } | null>(null)

  async function signUp() {
    if (busy) return
    setError(null)
    setErrorLink(null)

    // The same three rules the route enforces, in the order the fields are drawn, so a person is
    // not made to wait for a round trip to be told their password is short.
    if (!emailLooksLikeOne(email)) { setError(EMAIL_INVALID); return }
    if (password.length < SIGNUP_PASSWORD_MIN) { setError(SIGNUP_PASSWORD_SHORT); return }
    if (!companyName.trim()) { setError(COMPANY_REQUIRED); return }
    // The route never refuses over the website — it is optional, and an optional field must not be
    // able to stop an account. But it would store nothing, and dropping what somebody typed without
    // telling them is its own small dishonesty, so it is said here where they can still fix it.
    if (website.trim() && !normaliseWebsite(website)) { setError(WEBSITE_UNREADABLE); return }

    setBusy(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, companyName: companyName.trim(), website }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) {
        setError(j?.error ?? NOTHING_SAVED)
        setErrorLink(j?.link ?? null)
        setBusy(false)
        return
      }

      // Signed in with the password they just typed — the same call `app/login/page.tsx:24` makes.
      // The account exists either way; if this one step fails they are simply sent to sign in.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: j.email, password })
      if (signInError) { router.push('/login'); return }

      /**
       * *** AND THE WEBSITE READ IS KICKED HERE, BEFORE THE PAGE MOVES — step 13, decision 9. ***
       *
       * Awaited, and only the 202 is awaited: `/api/website-read` inserts the claim row inside the
       * request and does the fetch and the model call in `after()`. So this costs the person a few
       * milliseconds and guarantees the row EXISTS by the time the walk's first screen asks for it
       * — a kick fired off without awaiting would be cancelled by the navigation below, which is
       * the whole reason it is not written that way.
       *
       * No website, no post. The route refuses an empty one too (it is the boundary), but a
       * request we know the answer to is a request not worth making.
       *
       * A failure here is swallowed on purpose. The account exists, the person is signed in, and
       * "we could not start reading your website" is our problem to solve, not a thing to stop
       * somebody's first morning with. The walk shows the address screen when there is no row.
       */
      if (normaliseWebsite(website)) {
        try {
          await fetch('/api/website-read', { method: 'POST', headers: await authHeaders() })
        } catch {
          // Nothing to tell them: the next screen asks for the address instead.
        }
      }

      // Decision 1: a new account lands on the Dashboard, which is the page that says "Welcome"
      // rather than "Welcome back" on a first visit (`profiles.welcomed_at` is null). Step 14 moves
      // this landing to the walk.
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError(NOTHING_SAVED)
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

        <div className="mb-8">
          <h1 className="mb-1 text-2xl font-semibold text-gray-900">{SIGNUP_TITLE}</h1>
          <p className="text-sm text-gray-500">{SIGNUP_LEDE}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="signup-email">{EMAIL_LABEL}</label>
            <input id="signup-email" type="email" value={email} disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signUp()}
              placeholder={EMAIL_PLACEHOLDER} className={FIELD} aria-label={EMAIL_LABEL} />
          </div>

          <div>
            <label className={LABEL} htmlFor="signup-password">{PASSWORD_LABEL}</label>
            <input id="signup-password" type="password" value={password} disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signUp()}
              placeholder={SIGNUP_PASSWORD_HINT} className={FIELD} aria-label={PASSWORD_LABEL} />
          </div>

          <div>
            <label className={LABEL} htmlFor="signup-company">{COMPANY_LABEL}</label>
            <input id="signup-company" type="text" value={companyName} disabled={busy}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signUp()}
              placeholder={COMPANY_PLACEHOLDER} className={FIELD} aria-label={COMPANY_LABEL} />
          </div>

          <div>
            <label className={LABEL} htmlFor="signup-website">
              {WEBSITE_LABEL} <span className="text-gray-400">{WEBSITE_OPTIONAL}</span>
            </label>
            <input id="signup-website" type="text" value={website} disabled={busy}
              onChange={(e) => setWebsite(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signUp()}
              placeholder={WEBSITE_PLACEHOLDER} className={FIELD} aria-label={WEBSITE_LABEL} />
            <p className="mt-1 text-xs text-green-700">{WEBSITE_GREEN}</p>
          </div>

          {error && (
            <div>
              <p className="text-sm text-red-600">{error}</p>
              {errorLink && (
                <a href={errorLink.href} className="mt-1 inline-block text-sm font-medium text-green-700 hover:underline">
                  {errorLink.label}
                </a>
              )}
            </div>
          )}

          <button type="button" onClick={signUp} disabled={busy}
            className="w-full rounded-xl bg-green-700 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-50">
            {busy ? SIGNUP_BUSY : SIGNUP_BUTTON}
          </button>

          <p className="text-center text-sm text-gray-500">
            {HAVE_ACCOUNT}{' '}
            <a href="/login" className="font-medium text-green-700 hover:text-green-800">{SIGN_IN}</a>
          </p>
        </div>
      </div>
    </main>
  )
}
