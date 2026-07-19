'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
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

const INDUSTRY_QUESTIONS: Record<string, { key: string; label: string }[]> = {
  'chemical-manufacturing': [
    { key: 'repackaging', label: 'Do you manufacture, repackage, or bottle products?' },
    { key: 'hazmat_drivers', label: 'Do you have drivers who transport hazardous materials?' },
    { key: 'onsite_chemical_storage', label: 'Do you store chemicals on site in large quantities?' },
  ],
  'restaurant': [
    { key: 'liquor_license', label: 'Do you have a liquor license?' },
    { key: 'food_truck', label: 'Do you operate a food truck or catering operation?' },
  ],
  'food-beverage-manufacturing': [
    { key: 'fda_manufacturing', label: 'Do you manufacture under FDA oversight?' },
    { key: 'onsite_chemical_storage', label: 'Do you store chemicals or cleaning agents on site?' },
  ],
  'cannabis': [
    { key: 'repackaging', label: 'Do you process or repackage cannabis products?' },
    { key: 'onsite_chemical_storage', label: 'Do you use pesticides or chemical inputs?' },
  ],
  'auto-body-dry-cleaners': [
    { key: 'perc_solvents', label: 'Do you use perc or other chlorinated solvents?' },
    { key: 'onsite_chemical_storage', label: 'Do you store hazardous chemicals on site?' },
  ],
  'healthcare': [
    { key: 'controlled_substances', label: 'Do you handle controlled substances?' },
    { key: 'onsite_chemical_storage', label: 'Do you store hazardous materials or chemicals?' },
  ],
  'wood-products-sawmills': [
    { key: 'own_vehicles', label: 'Do you operate your own delivery or transport vehicles?' },
    { key: 'onsite_chemical_storage', label: 'Do you use chemical treatments or preservatives?' },
  ],
  'construction': [
    { key: 'own_vehicles', label: 'Do you operate your own vehicles or heavy equipment?' },
    { key: 'onsite_chemical_storage', label: 'Do you store hazardous materials on site?' },
  ],
  'other': [
    { key: 'onsite_chemical_storage', label: 'Do you store any hazardous chemicals or materials on site?' },
    { key: 'own_vehicles', label: 'Do you operate your own vehicles for business purposes?' },
  ],
}

interface ScanData {
  certifications: string[]
  chemicals: string[]
  operations: Record<string, boolean | null>
  multiple_locations: boolean
  city: string | null
  state: string | null
}

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [industries, setIndustries] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/industries')
      .then((r) => r.json())
      .then((d) => setIndustries(d.industries || []))
      .catch(() => setIndustries([]))
  }, [])
  const [businessDescription, setBusinessDescription] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [website, setWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanData, setScanData] = useState<ScanData | null>(null)
  const scanResultRef = useRef<ScanData | null>(null)

  // Pop-up state
  const [showPopup, setShowPopup] = useState(false)
  const [confirmedCerts, setConfirmedCerts] = useState<string[]>([])
  const [operations, setOperations] = useState<Record<string, boolean | null>>({})

  async function handleWebsiteBlur() {
    if (!website || website.trim().length < 4) return
    if (scanning || scanData) return
    setScanning(true)
    try {
      const res = await fetch('/api/scan-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: website, industry: industry || 'other' }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        const data = json.data as ScanData
        scanResultRef.current = data
        setScanData(data)
        setConfirmedCerts(data.certifications || [])
        setOperations(data.operations || {})
      }
    } catch {
      // Silent failure
    } finally {
      setScanning(false)
    }
  }

  function toggleCert(cert: string) {
    setConfirmedCerts(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    )
  }

  function toggleOperation(key: string, value: boolean) {
    setOperations(prev => ({ ...prev, [key]: prev[key] === value ? null : value }))
  }

  async function handleSignup() {
    if (!email || !password || !companyName || !industry || !state || !city) {
      setError('Please fill in all required fields')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const currentScanData = scanResultRef.current
      const scanResult = currentScanData ? {
        ...currentScanData,
        certifications: confirmedCerts,
        operations: { ...currentScanData.operations, ...operations },
        custom_industry: industry === 'other' && businessDescription ? businessDescription : null,
      } : (industry === 'other' && businessDescription ? {
        certifications: [],
        chemicals: [],
        customers: [],
        multiple_locations: false,
        city: null,
        state: null,
        operations: {},
        custom_industry: businessDescription,
      } : null)

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          companyName,
          industry,
          state,
          county: '',
          city,
          employeeCount: '',
          websiteUrl: website || null,
          scanResult,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Signup failed')

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      if (currentScanData && (confirmedCerts.length > 0 || INDUSTRY_QUESTIONS[industry]?.length > 0)) {
        setShowPopup(true)
        setLoading(false)
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  async function handlePopupConfirm() {
    router.push('/')
    router.refresh()
  }

  const industryQuestions = INDUSTRY_QUESTIONS[industry] || []

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">

      {/* Confirmation Pop-up */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">One last thing</h2>
              <p className="text-sm text-gray-500">Help us tailor CompliBoard to your business. Takes 30 seconds.</p>
            </div>

            {confirmedCerts.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                  We found these certifications on your website
                </p>
                <div className="space-y-2">
                  {confirmedCerts.map(cert => (
                    <label key={cert} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={confirmedCerts.includes(cert)}
                        onChange={() => toggleCert(cert)}
                        className="w-4 h-4 accent-green-700"
                      />
                      <span className="text-sm text-gray-800">{cert}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Uncheck anything that doesn&apos;t apply</p>
              </div>
            )}

            {industryQuestions.length > 0 && (
              <div className="mb-6">
                {confirmedCerts.length > 0 && <div className="border-t border-gray-100 mb-6" />}
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                  A few quick questions
                </p>
                <div className="space-y-3">
                  {industryQuestions.map(q => (
                    <div key={q.key} className="p-3 rounded-xl border border-gray-200">
                      <p className="text-sm text-gray-800 mb-2">{q.label}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleOperation(q.key, true)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            operations[q.key] === true
                              ? 'bg-green-700 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}>
                          Yes
                        </button>
                        <button
                          onClick={() => toggleOperation(q.key, false)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            operations[q.key] === false
                              ? 'bg-gray-700 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}>
                          No
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handlePopupConfirm}
              className="w-full bg-green-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
              Set up my CompliBoard →
            </button>
            <p className="text-center text-xs text-gray-400 mt-3 cursor-pointer hover:text-gray-600"
              onClick={handlePopupConfirm}>
              Skip for now
            </p>
          </div>
        </div>
      )}

      {/* Signup Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create your account</h1>
          <p className="text-gray-500 text-sm">Set up CompliBoard for your business</p>
        </div>

        <div className="space-y-3">

          <input type="text"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
            placeholder="Company name *"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />

          <div className="relative">
            <input type="text"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50 pr-10"
              placeholder="Website — highly recommended for a personalised setup"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onBlur={handleWebsiteBlur}
            />
            {scanning && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!scanning && scanData && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-sm">✓</div>
            )}
          </div>
          {!scanning && scanData && (
            <p className="text-xs text-green-700 -mt-1 px-1">
              Website scanned — we&apos;ll personalise your setup based on what we found
            </p>
          )}

          <select
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}>
            <option value="">Select your industry *</option>
            {industries.map(slug => <option key={slug} value={slug}>{slug}</option>)}
            <option value="other">Don&apos;t see your industry?</option>
          </select>

          {industry === 'other' && (
            <input type="text"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
              placeholder="What does your business do, or what industry are you in?"
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              autoFocus
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
              value={state}
              onChange={(e) => setState(e.target.value)}>
              <option value="">Select state *</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="text"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
              placeholder="City *"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="pt-2 border-t border-gray-100 space-y-3">
            <input type="email"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
              placeholder="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input type="password"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
              placeholder="Password (min. 6 characters) *"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-green-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
            {loading ? 'Creating your account...' : 'Create account →'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="text-green-700 hover:text-green-800 font-medium">Log in</a>
          </p>

        </div>
      </div>
    </main>
  )
}
