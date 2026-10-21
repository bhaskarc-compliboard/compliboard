'use client'

/**
 * /join — WHERE AN INVITED PERSON BECOMES A COLLEAGUE. My Account step 7, decision 6.
 *
 * *** IT IS OUTSIDE `AppLayout`, AND THAT IS NOT A STYLE CHOICE. *** The shell reads a session to
 * draw the sidebar, the company name and the counts. Nobody here has one yet. So this sits in the
 * login page's frame — the same centred card on the same grey page — which is also the honest
 * signal to the person: this is a door, not a room.
 *
 * *** THE TOKEN IS NEVER DRAWN. *** It is read from the address, sent to `/api/join`, and held in
 * memory. The page shows the address it was sent to and the company it is for, both of which the
 * route returns; it never shows, logs or links the credential itself.
 *
 * Four dead ends, each its own sentence (`lib/peopleView.ts`): expired, withdrawn, already used,
 * and not found. All four are the same plain card — `CLAUDE.md` §5.1, and never a stack trace.
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  joinTitle, joinButton, JOIN_NAME_LABEL, JOIN_PASSWORD_LABEL, JOIN_EMAIL_LABEL,
  JOIN_PASSWORD_HINT, JOIN_PASSWORD_MIN, JOIN_PASSWORD_SHORT, JOIN_NAME_REQUIRED, JOIN_BROKEN,
} from '@/lib/peopleView'

const FIELD =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 ' +
  'focus:border-green-500 focus:outline-none disabled:text-gray-500'
const LABEL = 'mb-1 block text-xs font-medium text-gray-600'

export default function JoinPage() {
  return (
    <Suspense fallback={<Shell><p className="text-sm text-gray-400">Loading…</p></Shell>}>
      <Join />
    </Suspense>
  )
}

/** The login page's frame, character for character where it matters. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  )
}

interface Invitation { email: string; company: string; inviter: string }

function Join() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const token = params.get('t') ?? ''

  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  /** The sentence for a dead link, and the one thing the person can do about it. */
  const [dead, setDead] = useState<{ message: string; link: { label: string; href: string } | null } | null>(null)

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorLink, setErrorLink] = useState<{ label: string; href: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/join?t=${encodeURIComponent(token)}`)
      const j = await res.json()
      if (j?.ok && j.invitation) setInvitation(j.invitation as Invitation)
      else setDead({ message: j?.message ?? '', link: j?.link ?? null })
    } catch {
      // Our problem, said as ours, with the one thing they can try (§5.1).
      setDead({ message: 'We could not check that link just now. Try it again in a moment.', link: null })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  async function join() {
    if (busy) return
    setError(null)
    setErrorLink(null)
    // The same two rules the route enforces. Checked here so the person is not made to wait for a
    // round trip to be told their password is short; checked there because that is the boundary.
    if (!fullName.trim()) { setError(JOIN_NAME_REQUIRED); return }
    if (password.length < JOIN_PASSWORD_MIN) { setError(JOIN_PASSWORD_SHORT); return }

    setBusy(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, full_name: fullName.trim(), password }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) {
        setError(j?.error ?? JOIN_BROKEN)
        setErrorLink(j?.link ?? null)
        setBusy(false)
        return
      }

      // Signed in with the password they just chose — the same call `app/login/page.tsx:24` makes.
      // The account exists either way; if this one step fails they are simply sent to sign in.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: j.email, password,
      })
      if (signInError) { router.push('/login'); return }
      // The Dashboard's welcome fires on its own: `profiles.welcomed_at` is null on a brand new
      // profile, which is what `welcomeFor` reads (Dashboard step 5).
      router.push('/dashboard')
    } catch {
      setError(JOIN_BROKEN)
      setBusy(false)
    }
  }

  if (loading) return <Shell><p className="text-sm text-gray-400">Checking your invitation…</p></Shell>

  if (dead) {
    return (
      <Shell>
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">CompliBoard</h1>
        <p className="mt-4 text-sm leading-6 text-gray-700">{dead.message}</p>
        {dead.link && (
          <a href={dead.link.href} className="mt-4 inline-block text-sm font-medium text-green-700 hover:underline">
            {dead.link.label}
          </a>
        )}
      </Shell>
    )
  }

  if (!invitation) return null

  return (
    <Shell>
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-semibold leading-snug text-gray-900">
          {joinTitle(invitation.inviter, invitation.company)}
        </h1>
        <p className="text-sm text-gray-500">
          Choose a password and you are in. Everyone here sees the same things.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="join-email">{JOIN_EMAIL_LABEL}</label>
          {/* Read-only: the invitation was sent to this address and is only good for it. */}
          <input id="join-email" type="text" value={invitation.email} readOnly disabled
            className={FIELD} aria-label={JOIN_EMAIL_LABEL} />
        </div>
        <div>
          <label className={LABEL} htmlFor="join-name">{JOIN_NAME_LABEL}</label>
          <input id="join-name" type="text" value={fullName} disabled={busy}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Sam Patel" className={FIELD} aria-label={JOIN_NAME_LABEL} />
        </div>
        <div>
          <label className={LABEL} htmlFor="join-password">{JOIN_PASSWORD_LABEL}</label>
          <input id="join-password" type="password" value={password} disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={JOIN_PASSWORD_HINT} className={FIELD} aria-label={JOIN_PASSWORD_LABEL} />
          <p className="mt-1 text-xs text-gray-500">{JOIN_PASSWORD_HINT}</p>
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

        <button type="button" onClick={join} disabled={busy}
          className="w-full rounded-xl bg-green-700 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-50">
          {busy ? 'Setting you up…' : joinButton(invitation.company)}
        </button>
      </div>
    </Shell>
  )
}
