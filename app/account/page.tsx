'use client'

import { useState, useEffect } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { useRouter } from 'next/navigation'

// Industries now come from the database (/api/industries), not a hardcoded list.

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
  const [industries, setIndustries] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/industries')
      .then((r) => r.json())
      .then((d) => setIndustries(d.industries || []))
      .catch(() => setIndustries([]))
  }, [])
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
  const [cancelError, setCancelError] = useState('')
  // The company name as last saved. The editable field above can be changed without
  // saving, and the delete confirmation must match what is actually stored.
  const [savedCompanyName, setSavedCompanyName] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    async function loadAccount() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const res = await fetch('/api/account', { headers: await authHeaders() })
      const json = await res.json()
      if (json.data) {
        const d = json.data
        setFullName(d.full_name || '')
        setCompanyName(d.name || '')
        setSavedCompanyName(d.name || '')
        setIndustry(d.industry || '')
        setState(d.state || '')
        setCounty(d.county || '')
        setCity(d.city || '')
        // Integer column since migration 006. 0 is a legitimate headcount, so test for
        // null rather than falsiness — `d.employee_count || ''` would blank a real 0.
        setEmployeeCount(d.employee_count == null ? '' : String(d.employee_count))
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
    if (!/^\d+$/.test(employeeCount.trim())) {
      setSaveError('Number of employees must be a whole number, for example 42.')
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/account', {
        method: 'PUT',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          full_name: fullName,
          companyName,
          industry,
          state,
          county,
          city,
          employeeCount: Number(employeeCount.trim()),
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSavedCompanyName(companyName)
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

  // Fetches the export with the session token attached, then hands the browser the
  // resulting file. A plain link cannot be used because the route requires an
  // Authorization header.
  async function handleDownloadData() {
    setDownloading(true)
    setDownloadError('')
    try {
      const res = await fetch('/api/account/export', { headers: await authHeaders() })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not build your export')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="(.+)"/)
      const filename = match ? match[1] : 'compliboard-export.json'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download your data')
    } finally {
      setDownloading(false)
    }
  }

  async function handleCancelAccount() {
    setCancelling(true)
    setCancelError('')
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ confirmation: cancelConfirmText.trim() }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not delete your account')
      }
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Could not delete your account')
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
      <AppLayout title="My Account" didYouKnow={{ icon: '⚙️', text: 'The more detail you add to your company profile — industry, state, county, employee count, and chemicals handled — the more accurate and specific your compliance checklists become. CompliBoard uses your profile to filter regulations that actually apply to your business and skip everything that does not.' }}>
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="My Account" didYouKnow={{ icon: '⚙️', text: 'The more detail you add to your company profile — industry, state, county, employee count, and chemicals handled — the more accurate and specific your compliance checklists become. CompliBoard uses your profile to filter regulations that actually apply to your business and skip everything that does not.' }}>
      <div className="max-w-3xl mx-auto px-6 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">My Account</h1>
          <p className="text-sm text-gray-400">Manage your company profile, password, and billing</p>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-6 border-b border-gray-200 mb-8">
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`text-sm pb-3 font-medium transition-colors border-b-2 -mb-px ${
                activeSection === s.key
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* COMPANY PROFILE */}
        {activeSection === 'profile' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                  {industries.map(slug => <option key={slug} value={slug}>{slug}</option>)}
                  <option value="other">Other</option>
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
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    placeholder="e.g. 42"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)} />
                  <p className="mt-1 text-xs text-gray-500">
                    The exact number, not a range — several rules turn on a specific
                    headcount (25, 50, 100), so a range cannot answer them.
                  </p>
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Billing</h2>
            <p className="text-sm text-gray-400 mb-6">Manage your subscription and payment details</p>
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Current plan</p>
              <p className="text-sm font-medium text-green-900">CompliBoard — $199/month</p>
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Cancel Account</h2>
            <p className="text-sm text-gray-400 mb-6">Permanently delete your account and all your data</p>
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
              <p className="text-sm font-semibold text-red-700 mb-2">⚠️ This is permanent and cannot be undone</p>
              <p className="text-sm text-red-600 mb-3">
                There is no way to restore this account afterwards. We do not keep a copy.
                Everything below is destroyed for <span className="font-semibold">everyone</span> on
                your company account, not only for you:
              </p>
              <ul className="text-sm text-red-600 space-y-1 list-disc pl-5">
                <li>Every uploaded file, and the folders holding them</li>
                <li>Every document review, audit, and HR handbook audit</li>
                <li>Every checklist and checklist item</li>
                <li>Every calendar event and deadline reminder</li>
                <li>Your compliance obligations and the evidence linked to them</li>
                <li>Your company profile and saved audit templates</li>
                <li>Every login on this company account, including yours</li>
              </ul>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl mb-6">
              <p className="text-sm font-semibold text-gray-800 mb-1">Take your records first</p>
              <p className="text-sm text-gray-600 mb-3">
                Download everything we hold on your company as a single file. Your uploaded
                files are not included — save those from Company Documents separately, because
                deleting the account deletes them too.
              </p>
              <button onClick={handleDownloadData} disabled={downloading}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-white transition-colors disabled:opacity-50">
                {downloading ? 'Preparing your file…' : 'Download my data'}
              </button>
              {downloadError && <p className="text-sm text-red-600 mt-2">{downloadError}</p>}
            </div>

            {!showCancelConfirm ? (
              <button onClick={() => setShowCancelConfirm(true)}
                className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                Cancel my account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  To confirm, type your company name exactly as it appears on your profile:
                  {' '}<span className="font-semibold">{savedCompanyName}</span>
                </p>
                <input type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-red-500 bg-gray-50"
                  placeholder="Type your company name to confirm"
                  value={cancelConfirmText}
                  onChange={(e) => setCancelConfirmText(e.target.value)}
                />
                {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelAccount}
                    disabled={cancelConfirmText.trim() !== savedCompanyName || !savedCompanyName || cancelling}
                    className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                    {cancelling ? 'Deleting...' : 'Permanently delete my account'}
                  </button>
                  <button onClick={() => { setShowCancelConfirm(false); setCancelConfirmText(''); setCancelError('') }}
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
