'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PASSWORD_MIN, PASSWORD_HINT, PASSWORD_TOO_SHORT, NOT_A_RECOVERY } from '@/lib/accountView'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  /**
   * *** THIS GATE EXISTED AND WAS NEVER READ. Closed at My Account step 8. ***
   *
   * `ready` was set here and used NOWHERE: the form below rendered unconditionally and
   * `handleUpdate` had no check, so **a signed-in person who simply navigated to /reset-password
   * could set a new password without supplying the current one.** A borrowed laptop or an unlocked
   * screen was enough to lock the owner out of their own compliance records — the exact hole board
   * 3 is about, reached by typing a URL. `docs/ACCOUNT-MACHINERY.md` §B2 listed this as the third
   * of three ways to change a password without the current one; the other two are My Account's
   * form, which step 8 replaced with a server-checked route, and /forgot-password, which STAYS,
   * because somebody who has forgotten their password cannot be asked for it.
   *
   * *** THE URL IS CHECKED AS WELL AS THE EVENT, AND THAT IS NOT BELT AND BRACES. ***
   * Supabase processes the recovery token out of the URL when the client initialises, which can
   * happen BEFORE this listener attaches — so a gate on the event alone would intermittently lock
   * out the very people it is for. A recovery link carries `type=recovery`, in the hash for the
   * implicit flow and in the query for PKCE, and either is proof the person arrived by link.
   */
  useEffect(() => {
    const fromLink = () => {
      if (typeof window === 'undefined') return false
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const query = new URLSearchParams(window.location.search)
      return hash.get('type') === 'recovery' || query.get('type') === 'recovery' || query.has('code')
    }
    if (fromLink()) setReady(true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleUpdate() {
    // The gate, read at last. A page that is not a recovery cannot set a password.
    if (!ready) {
      setError(NOT_A_RECOVERY)
      return
    }
    if (!password.trim()) {
      setError('Please enter a new password')
      return
    }
    // *** TEN, NOT SIX — the same floor /join and the Sign-in tab apply. *** A rule a person meets
    // at one door and not another is not a rule, and this was the cheapest door to walk through.
    if (password.length < PASSWORD_MIN) {
      setError(PASSWORD_TOO_SHORT)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Set new password</h1>
          <p className="text-sm text-gray-400">Choose a strong password for your account</p>
        </div>

        {!ready ? (
          /* Not a recovery: say so plainly, with the way to get one. Never a blank form that
             looks usable (CLAUDE.md §5.1). */
          <div className="space-y-3">
            <p className="text-sm leading-6 text-gray-700">{NOT_A_RECOVERY}</p>
            <a href="/forgot-password" className="inline-block text-sm font-medium text-green-700 hover:underline">
              Send me a reset link
            </a>
          </div>
        ) : success ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-sm text-green-700 font-medium mb-1">Password updated</p>
            <p className="text-sm text-green-600">Your password has been reset. Redirecting you to the dashboard...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                placeholder={PASSWORD_HINT}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                placeholder="Repeat your new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleUpdate}
              disabled={loading}
              className="w-full bg-green-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {loading ? 'Updating...' : 'Update password →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
