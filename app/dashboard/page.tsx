'use client'

import { useState, useEffect } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'

interface CompanyProfile {
  name: string
  industry?: string
  state?: string
  city?: string
}

interface CalEvent { id: string; title: string; due_date: string }

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [stats, setStats] = useState({ filesReviewed: 0, issuesIdentified: 0, questionsAnswered: 0, checklistsCreated: 0 })
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
          const cRes = await fetch('/api/calendar', { headers: await authHeaders() })
          const cJson = await cRes.json()
          setEvents(cJson.data || [])
        } catch { setEvents([]) }

        // Real activity metrics — what CompliBoard has done for this company.
        try {
          const [reviewsRes, checklistsRes] = await Promise.all([
            fetch('/api/document-review', { headers: await authHeaders() }).then(r => r.json()),
            supabase.from('checklists').select('research_answer').eq('company_id', companyId),
          ])
          const reviews = reviewsRes.data || []
          const checklists = checklistsRes.data || []
          setStats({
            filesReviewed: reviews.length,
            issuesIdentified: reviews.reduce((sum: number, r: { gaps?: unknown }) => sum + (Array.isArray(r.gaps) ? r.gaps.length : 0), 0),
            questionsAnswered: checklists.filter(c => c.research_answer).length,
            checklistsCreated: checklists.filter(c => !c.research_answer).length,
          })
        } catch { /* leave stats at zero */ }
      }
      setLoading(false)
    }
    load()
  }, [])

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

        {/* Activity — what CompliBoard has done */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Files reviewed', value: stats.filesReviewed },
            { label: 'Issues identified', value: stats.issuesIdentified },
            { label: 'Questions answered', value: stats.questionsAnswered },
            { label: 'Checklists created', value: stats.checklistsCreated },
          ].map(box => (
            <div key={box.label} className="bg-white rounded-xl px-5 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">{box.label}</p>
              <p className="text-2xl font-semibold text-gray-700">{box.value}</p>
            </div>
          ))}
        </div>

        {/* Upcoming deadlines */}
        <h2 className="text-lg font-semibold text-orange-600 mb-3">Upcoming — next 30 days</h2>
        <div className="bg-white rounded-xl">
          {upcoming.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">No deadlines in the next 30 days.</p>
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
