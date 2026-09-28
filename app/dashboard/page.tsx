'use client'

import { useState, useEffect } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { isAmber, statusWord } from '@/lib/documentStatus'

interface CompanyProfile {
  name: string
  industry?: string
  state?: string
  city?: string
}

interface CalEvent { id: string; title: string; due_date: string }

/**
 * One line of the readings list. Every field is a column of `document_index_v` — the same view the
 * Documents page groups and the report drawer opens, so the dashboard cannot say a different word
 * about a document than the page it links to. That is the whole reason this reads the view rather
 * than a table: a second query shape is a second answer.
 */
interface Reading {
  document_id: string
  title: string | null
  file_name: string
  kind: string | null
  display_status: string
  document_status: string
  scanned_at: string | null
  open_gap_count: number
}

const KIND_WORD: Record<string, string> = {
  permit: 'Permit', certificate: 'Certificate', program: 'Program', policy: 'Policy',
  record: 'Record', supplier_document: 'Supplier document', other: 'Other',
}

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [stats, setStats] = useState({ filesReviewed: 0, issuesIdentified: 0, questionsAnswered: 0, checklistsCreated: 0 })
  const [readings, setReadings] = useState<Reading[]>([])
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

        // *** THE READINGS AND THE COUNTS BOTH COME FROM `document_index_v` — 28 September 2026. ***
        //
        // This block used to GET `/api/document-review`, and by 28 September that was a live query
        // against a table nothing writes any more: `document_reviews` held **0 rows**, so "Files
        // reviewed" and "Issues identified" both read 0 on a company with ten documents and 88 open
        // gaps. Worse than wrong — it was a confident zero, which is the one thing `CLAUDE.md` §6
        // says the dashboard must never show. The old review route is deleted.
        //
        // `document_index_v` is one row per document joined to its CURRENT scan, which is what makes
        // the counts honest: a re-read replaces a reading rather than adding one, and a corrected
        // status is counted as corrected. Read through the caller's own client, so RLS scopes it.
        try {
          const [readRes, checklistsRes] = await Promise.all([
            supabase.from('document_index_v')
              .select('document_id, title, file_name, kind, display_status, document_status, scanned_at, open_gap_count')
              .eq('company_id', companyId)
              .not('scanned_at', 'is', null)
              .order('scanned_at', { ascending: false }),
            supabase.from('checklists').select('research_answer').eq('company_id', companyId),
          ])
          const all = (readRes.data ?? []) as Reading[]
          const checklists = checklistsRes.data || []
          // FIVE MOST RECENT for the list; the counts are over everything, not over the five.
          setReadings(all.slice(0, 5))
          setStats({
            // Every document we got a reading out of — which is all of them except the ones we could
            // not open. A document that needs work was read perfectly well (`lib/documentBatch.ts`
            // uses the same definition for the batch email, so the two cannot disagree).
            filesReviewed: all.filter(r => r.display_status !== 'could_not_read').length,
            issuesIdentified: all.reduce((sum, r) => sum + (r.open_gap_count ?? 0), 0),
            questionsAnswered: checklists.filter(c => c.research_answer).length,
            checklistsCreated: checklists.filter(c => !c.research_answer).length,
          })
        } catch { /* leave stats at zero and the list empty */ }
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

        {/* *** THE READINGS LIST — the five most recent, and a way through to all of them. ***
            It links to /documents rather than opening a drawer here: one reading surface, and the
            drawer belongs to the page that owns the document (`docs/DESIGN.md` §3). */}
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Recently read</h2>
          {readings.length > 0 && (
            <a href="/documents" className="text-[13px] text-gray-600 hover:text-gray-900 hover:underline">
              All documents
            </a>
          )}
        </div>
        <div className="bg-white rounded-xl mb-8">
          {readings.length === 0 ? (
            /* *** AN EMPTY STATE IS A CLAIM, AND THIS ONE HAS TO BE TRUE (`CLAUDE.md` §5.1). ***
               "No documents read yet" is exactly what it means — the query returned no document with
               a scan on it — and it says what to do next rather than leaving a blank panel. It does
               NOT say "no documents": there may be files waiting to be read, and this list is about
               readings. */
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">No documents read yet.</p>
              <a href="/documents" className="mt-2 inline-block text-[13px] text-gray-600 hover:text-gray-900 underline">
                Add files
              </a>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {readings.map(r => (
                <a key={r.document_id} href="/documents"
                   className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-gray-50">
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-800 truncate">{r.title || r.file_name}</span>
                    <span className="block text-xs text-gray-400">
                      {r.kind ? (KIND_WORD[r.kind] ?? r.kind) : 'Document'}
                      {r.scanned_at ? ` · read ${new Date(r.scanned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-medium ${isAmber(r) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                    {statusWord(r)}
                  </span>
                </a>
              ))}
            </div>
          )}
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
