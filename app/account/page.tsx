'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { useRouter } from 'next/navigation'

const INDUSTRIES = [
  { label: 'Chemical Manufacturing', value: 'chemical-manufacturing' },
  { label: 'Food & Beverage Manufacturing', value: 'food-beverage-manufacturing' },
  { label: 'Restaurant / Food Service', value: 'restaurant' },
  { label: 'Cannabis', value: 'cannabis' },
  { label: 'Auto Body / Dry Cleaners', value: 'auto-body-dry-cleaners' },
  { label: 'Wood Products / Sawmills', value: 'wood-products-sawmills' },
  { label: 'Construction', value: 'construction' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Other', value: 'other' },
]

const EMPLOYEE_COUNTS = ['1-25', '26-75', '76-200', '200+']

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming'
]

export default function AccountPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [activeSection, setActiveSection] = useState<'profile' | 'password' | 'billing' | 'cancel'>('profile')

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [state, setState] = useState('')
  const [county, setCounty] = useState('')
  const [city, setCity] = useState('')
  const [employeeCount, setEmployeeCount] = useState('')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Cancel
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelConfirmText, setCancelConfirmText] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    async function loadAccount() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const res = await fetch(`/api/account?user_id=${user.id}`)
      const json = await res.json()
      if (json.data) {
        const d = json.data
        setFullName(d.full_name || '')
        setCompanyName(d.name || '')
        setIndustry(d.industry || '')
        setState(d.state || '')
        setCounty(d.county || '')
        setCity(d.city || '')
        setEmployeeCount(d.employee_count || '')
      }
      setLoading(false)
    }
    loadAccount()
  }, [])

  async function handleSaveProfile() {
    if (!userId) return
    if (!companyName || !industry || !state || !county || !city || !employeeCount) {
      setSaveError('Please fill in all required fields')
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          full_name: fullName,
          companyName,
          industry,
          state,
          county,
          city,
          employeeCount,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError('')
    setPasswordSuccess(false)
    if (!newPassword || !confirmPassword) { setPasswordError('Please fill in all fields'); return }
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleCancelAccount() {
    if (!userId) return
    setCancelling(true)
    try {
      await fetch(`/api/account?user_id=${userId}`, { method: 'DELETE' })
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      setCancelling(false)
    }
  }

  const sections = [
    { key: 'profile', label: 'Company Profile' },
    { key: 'password', label: 'Change Password' },
    { key: 'billing', label: 'Billing' },
    { key: 'cancel', label: 'Cancel Account' },
  ] as const

  if (loading) {
    return (
      <AppLayout title="My Account">
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="My Account">
      <div className="max-w-3xl mx-auto px-6 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">My Account</h1>
          <p className="text-sm text-gray-400">Manage your company profile, password, and billing</p>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-2 ${
                activeSection === s.key
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* COMPANY PROFILE */}
        {activeSection === 'profile' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-5">Company Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Your name</label>
                <input type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company name <span className="text-red-400">*</span></label>
                <input type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="Acme Chemical Co."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Industry <span className="text-red-400">*</span></label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}>
                  <option value="">Select your industry</option>
                  {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">State <span className="text-red-400">*</span></label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                    value={state}
                    onChange={(e) => setState(e.target.value)}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Number of employees <span className="text-red-400">*</span></label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}>
                    <option value="">Select range</option>
                    {EMPLOYEE_COUNTS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City <span className="text-red-400">*</span></label>
                  <input type="text"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                    placeholder="Portland"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">County <span className="text-red-400">*</span></label>
                  <input type="text"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                    placeholder="Multnomah"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                  />
                </div>
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              {saveSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm text-green-700">✓ Profile saved successfully</p>
                </div>
              )}
              <button onClick={handleSaveProfile} disabled={saving}
                className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {/* CHANGE PASSWORD */}
        {activeSection === 'password' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-5">Change Password</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
                <input type="password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
                <input type="password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              {passwordSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm text-green-700">✓ Password changed successfully</p>
                </div>
              )}
              <button onClick={handleChangePassword} disabled={changingPassword}
                className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                {changingPassword ? 'Changing...' : 'Change password'}
              </button>
            </div>
          </div>
        )}

        {/* BILLING */}
        {activeSection === 'billing' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Billing</h2>
            <p className="text-sm text-gray-400 mb-6">Manage your subscription and payment details</p>
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Current plan</p>
              <p className="text-sm font-medium text-green-900">Early Adopter — $29/month</p>
              <p className="text-xs text-green-600 mt-1">Locked in forever · Thank you for being an early supporter</p>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What's included</p>
              <div className="space-y-2">
                {['Unlimited compliance questions','Company Documents storage','HR Help module','Compliance Calendar','Deadline reminders'].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-green-500 text-xs">✓</span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <button disabled
              className="w-full border border-gray-200 text-gray-400 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed">
              Manage billing — Coming soon
            </button>
          </div>
        )}

        {/* CANCEL ACCOUNT */}
        {activeSection === 'cancel' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Cancel Account</h2>
            <p className="text-sm text-gray-400 mb-6">Permanently delete your account and all your data</p>
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
              <p className="text-sm font-semibold text-red-700 mb-2">⚠️ This cannot be undone</p>
              <p className="text-sm text-red-600">All your checklists, uploaded files, calendar events, and company data will be permanently deleted.</p>
            </div>
            {!showCancelConfirm ? (
              <button onClick={() => setShowCancelConfirm(true)}
                className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                Cancel my account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">Type <span className="font-semibold">DELETE</span> to confirm</p>
                <input type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-red-500 bg-gray-50"
                  placeholder="Type DELETE to confirm"
                  value={cancelConfirmText}
                  onChange={(e) => setCancelConfirmText(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelAccount}
                    disabled={cancelConfirmText !== 'DELETE' || cancelling}
                    className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                    {cancelling ? 'Deleting...' : 'Permanently delete my account'}
                  </button>
                  <button onClick={() => { setShowCancelConfirm(false); setCancelConfirmText('') }}
                    className="px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:border-gray-300 transition-colors">
                    Keep my account
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  )
}
