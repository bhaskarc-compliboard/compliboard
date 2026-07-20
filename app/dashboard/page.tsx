'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'

interface CompanyProfile {
  name: string
  industry?: string
  state?: string
  city?: string
}

interface Obligation { status: string }
interface CalEvent { id: string; title: string; due_date: string }

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('company_id').eq('id', user.id).single()

      const companyId = profileData?.company_id
      if (companyId) {
        const { data: company } = await supabase
          .from('companies').select('name, industry, state, city').eq('id', companyId).single()
        if (company) setProfile(company)

        try {
          const oRes = await fetch(`/api/obligations?company_id=${companyId}`)
          const oJson = await oRes.json()
          setObligations(oJson.data || [])
        } catch { setObligations([]) }

        try {
          const cRes = await fetch(`/api/calendar?company_id=${companyId}`)
          const cJson = await cRes.json()
          setEvents(cJson.data || [])
        } catch { setEvents([]) }
      }
      setLoading(false)
    }
    load()
  }, [])

  // Pending until files have been read (no obligations synced yet)
  const hasData = obligations.length > 0
  const total = obligations.length
  const satisfied = obligations.filter(o => o.status === 'satisfied').length
  const needsAttention = obligations.filter(o => ['missing', 'at_risk', 'expiring_soon'].includes(o.status)).length
  const expiringSoon = obligations.filter(o => o.status === 'expiring_soon').length
  const unconfirmed = obligations.filter(o => o.status === 'unconfirmed').length
  const coverage = total > 0 ? Math.round((satisfied / total) * 100) : 0

  // Upcoming deadlines in the next 30 days
  const now = new Date()
  const in30 = new Date(); in30.setDate(now.getDate() + 30)
  const upcoming = events
    .filter(e => { const d = new Date(e.due_date); return d >= new Date(now.toDateString()) && d <= in30 })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  function daysUntil(dateStr: string) {
    const d = new Date(dateStr)
    return Math.ceil((d.getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24))
  }

  const boxes = [
    { label: 'Coverage', value: hasData ? `${coverage}%` : '—', tone: 'text-gray-700' },
    { label: 'Needs attention', value: hasData ? needsAttention : '—', tone: 'text-gray-700' },
    { label: 'Expiring soon', value: hasData ? expiringSoon : '—', tone: 'text-gray-700' },
    { label: 'Unconfirmed', value: hasData ? unconfirmed : '—', tone: 'text-gray-700' },
  ]

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Dashboard">
      <div className="p-6 max-w-5xl mx-auto">

        {/* Welcome header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">{profile?.name}</h1>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {profile?.industry && <span className="text-sm text-gray-500">{profile.industry}</span>}
            {profile?.industry && profile?.state && <span className="text-gray-300">·</span>}
            {profile?.state && <span className="text-sm text-gray-500">{profile.state}</span>}
            {profile?.state && profile?.city && <span className="text-gray-300">·</span>}
            {profile?.city && <span className="text-sm text-gray-500">{profile.city}</span>}
          </div>
        </div>

        {/* Scorecard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {boxes.map(box => (
            <div key={box.label} className="bg-white rounded-xl px-5 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">{box.label}</p>
              <p className={`text-2xl font-semibold ${hasData ? box.tone : 'text-gray-300'}`}>{box.value}</p>
            </div>
          ))}
        </div>

        {/* Pending prompt (only before any files are read) */}
        {!hasData && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-green-900">Your numbers are waiting on your documents</p>
              <p className="text-sm text-green-700 mt-0.5">Add a file and CompliBoard starts scoring your compliance and tracking your deadlines.</p>
            </div>
            <button
              onClick={() => router.push('/documents')}
              className="whitespace-nowrap bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-green-800 transition-colors">
              Add a document
            </button>
          </div>
        )}

        {/* Upcoming deadlines */}
        <h2 className="text-lg font-semibold text-orange-600 mb-3">Upcoming — next 30 days</h2>
        <div className="bg-white rounded-xl">
          {upcoming.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">
                {hasData ? 'No deadlines in the next 30 days.' : 'Deadlines will appear here once we read your documents.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcoming.map(e => {
                const d = daysUntil(e.due_date)
                const urgent = d <= 7
                return (
                  <div key={e.id} className="px-6 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-800">{e.title}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${urgent ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                      {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
