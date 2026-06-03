'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const INDUSTRIES = [
  'Chemical Manufacturing',
  'Food & Beverage',
  'Cannabis',
  'Construction',
  'Restaurant',
  'Manufacturing',
  'Transportation',
  'Healthcare',
  'Other',
]

const EMPLOYEE_COUNTS = ['1-25', '26-75', '76-200']

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

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [state, setState] = useState('')
  const [county, setCounty] = useState('')
  const [city, setCity] = useState('')
  const [employeeCount, setEmployeeCount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup() {
    if (!email || !password || !companyName || !industry || !state || !city || !employeeCount) {
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('Signup failed')

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          industry,
          state,
          county,
          city,
          employee_count: employeeCount,
        })
        .select()
        .single()
      if (companyError) throw companyError

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          company_id: companyData.id,
          full_name: '',
        })
      if (profileError) throw profileError

      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create your account</h1>
          <p className="text-gray-500 text-sm">Set up CompliBoard for your business</p>
        </div>
        <div className="space-y-4">
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
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
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
              <label className="block text-xs font-medium text-gray-600 mb-1">County</label>
              <input type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                placeholder="Multnomah"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Login details</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-400">*</span></label>
                <input type="email"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password <span className="text-red-400">*</span></label>
                <input type="password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
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
