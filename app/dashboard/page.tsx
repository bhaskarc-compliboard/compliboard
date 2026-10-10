'use client'

import { useState, useEffect } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { isAmber, statusWord } from '@/lib/documentStatus'
import { today, formatDayShort, dueWords, compareDays, isPast } from '@/lib/calendarDate'

interface CompanyProfile {
  name: string
  industry?: string
  state?: string
  city?: string
}

/**
 * One date on the dashboard. It comes from `/api/calendar/dates?view=board`, the Calendar's own
 * route — so the dashboard and the Calendar page cannot disagree about which dates count. The
 * `counts_as_due` rule lives in the database (migration 073) and neither screen restates it.
 */
interface CalEvent {
  id: string; title: string; due_date: string | null
  state: string; source: string; counts_as_due: boolean | null
}

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
  /** The latest reading that could read the file — null only if no reading ever has (migration 076). */
  readable_scan_id: string | null
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
  /**
   * *** WHAT WE COULD NOT READ, NAMED — fix list 35 (B2), 34 (B1). ***
   * Three reads failed silently here and every one of them printed a confident zero: "0 files
   * reviewed", "No deadlines in the next 30 days.", a blank company name. A number nobody could
   * fetch is not a zero, and an empty list is not the absence of deadlines (`CLAUDE.md` §3.12,
   * `docs/FIX-LIST-FAILURES.md` R2 and R3). Each failure is held here and SAID on the panel it
   * belongs to, so a broken read can never read as good news.
   */
  const [broke, setBroke] = useState({ profile: false, dates: false, documents: false })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('company_id').eq('id', user.id).single()

      const companyId = profileData?.company_id
      if (companyId) {
        const { data: company, error: companyError } = await supabase
          .from('companies').select('name, industry, state, city').eq('id', companyId).single()
        if (companyError) setBroke(b => ({ ...b, profile: true }))
        if (company) setProfile(company)

        // THE CALENDAR'S OWN ROUTE, and its status is checked — fix list 34 (B1). `res.ok` was never
        // read here, so a 500, an expired session and a 404 all came out as "No deadlines in the
        // next 30 days." — the product telling a customer they are clear because it could not ask.
        try {
          const cRes = await fetch('/api/calendar/dates?view=board', { headers: await authHeaders() })
          if (!cRes.ok) throw new Error(`the calendar answered ${cRes.status}`)
          const cJson = await cRes.json()
          if (!Array.isArray(cJson?.dates)) throw new Error('the calendar came back in a shape we could not use')
          setEvents(cJson.dates as CalEvent[])
        } catch { setBroke(b => ({ ...b, dates: true })) }

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
              .select('document_id, title, file_name, kind, display_status, document_status, scanned_at, open_gap_count, readable_scan_id')
              .eq('company_id', companyId)
              .not('scanned_at', 'is', null)
              .order('scanned_at', { ascending: false }),
            supabase.from('checklists').select('research_answer').eq('company_id', companyId),
          ])
          if (readRes.error) throw new Error(readRes.error.message)
          if (checklistsRes.error) throw new Error(checklistsRes.error.message)
          const all = (readRes.data ?? []) as Reading[]
          const checklists = checklistsRes.data || []
          // FIVE MOST RECENT for the list; the counts are over everything, not over the five.
          setReadings(all.slice(0, 5))
          setStats({
            // Every document we got a reading out of — which is all of them except the ones we could
            // not open. A document that needs work was read perfectly well (`lib/documentBatch.ts`
            // uses the same definition for the batch email, so the two cannot disagree).
            // *** A FAILED RE-READ MUST NOT UN-READ A DOCUMENT — fix list 8 (B3). ***
            // This counted `display_status !== 'could_not_read'`, and migration 076 keeps the status
            // from the CURRENT reading on purpose (the report watches it to know a re-read landed).
            // So one rate-limited re-read dropped a perfectly well-read document out of the count.
            // `readable_scan_id` is the latest reading that COULD read it (migration 075/076): it is
            // non-null exactly when we have ever got a reading out of the file, which is what the
            // words "Files reviewed" claim.
            filesReviewed: all.filter(r => r.readable_scan_id !== null).length,
            issuesIdentified: all.reduce((sum, r) => sum + (r.open_gap_count ?? 0), 0),
            questionsAnswered: checklists.filter(c => c.research_answer).length,
            checklistsCreated: checklists.filter(c => !c.research_answer).length,
          })
        } catch { setBroke(b => ({ ...b, documents: true })) }
      }
      setLoading(false)
    }
    load()
  }, [])

  /**
   * *** THE NEXT THIRTY DAYS, AND WHAT HAS GONE BY — through `lib/calendarDate.ts`. ***
   *
   * This used to build `new Date(e.due_date)` here. That parses "2026-10-20" as UTC MIDNIGHT, which
   * is the evening of the 19th in Oregon — the off-by-one the map recorded as B2, and the reason the
   * dashboard and the calendar page could name different days for the same date. Every day on this
   * page now goes through the one helper, which reads a day at LOCAL NOON and asks what "today" is
   * in Pacific time.
   */
  const now = today()
  const in30 = (() => { const d = new Date(`${now}T12:00:00`); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10) })()
  const onBoard = events.filter(e => e.counts_as_due && e.due_date && e.state !== 'done')
  const upcoming = onBoard
    .filter(e => !isPast(e.due_date, now) && compareDays(e.due_date!, in30) <= 0)
    .sort((a, b) => compareDays(a.due_date!, b.due_date!))
  // §185c: dates whose day has gone by are "passed". Never "overdue", and never counted as a failure
  // — the work may well be done and recorded somewhere that is not this product.
  const passed = onBoard
    .filter(e => isPast(e.due_date, now))
    .sort((a, b) => compareDays(a.due_date!, b.due_date!))

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">

        {/* Welcome header */}
        <div className="mb-6">
          {/* A BLANK HEADING IS NOT A COMPANY WITH NO NAME — fix list 35 (B2). */}
          <h1 className="text-xl font-semibold text-gray-900">
            {profile?.name ?? (broke.profile ? 'Your company' : '')}
          </h1>
          {broke.profile && (
            <p className="mt-1 text-[13px] text-amber-900">
              We couldn’t load your company details just now. That is our side, not yours.
            </p>
          )}
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
              {/* *** A NUMBER WE COULD NOT FETCH IS NOT A ZERO — fix list 35 (B2). ***
                  All four of these printed 0 on a failed read, which on this page reads as "we have
                  done nothing for you" and on "Issues identified" reads as "you have no problems".
                  A dash says we do not know, which is the truth. */}
              <p className="text-2xl font-semibold text-gray-700">{broke.documents ? '—' : box.value}</p>
            </div>
          ))}
        </div>
        {broke.documents && (
          <p className="-mt-6 mb-8 text-[13px] text-amber-900">
            We couldn’t load your documents just now, so these counts aren’t available. That is our
            side, not yours.
          </p>
        )}

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
          {broke.documents ? (
            /* *** ...AND IT IS ONLY TRUE IF THE QUESTION WAS ASKED — fix list 35 (B2). ***
               The claim below was guarded by nothing: a failed read emptied the list and the page
               then stated, in its own voice, that nothing had been read. That is R2 exactly — a
               check that cannot see anything looks precisely like a check that found nothing. */
            <div className="px-6 py-5 text-sm text-amber-900 bg-amber-50 rounded-xl border border-amber-200">
              We couldn’t load your documents just now. That is our side, not yours.
              {' '}<a href="/documents" className="underline">Open Company Documents</a>
            </div>
          ) : readings.length === 0 ? (
            /* *** AN EMPTY STATE IS A CLAIM, AND THIS ONE HAS TO BE TRUE (`CLAUDE.md` §5.1). ***
               "No documents read yet" is exactly what it means — the query SUCCEEDED and returned no
               document with a scan on it — and it says what to do next rather than leaving a blank
               panel. It does NOT say "no documents": there may be files waiting to be read, and this
               list is about readings. */
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

        {/* THE CALENDAR PART (Calendar B3). Every row links into the page that owns it. */}
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Coming up</h2>
          <a href="/calendar" className="text-[13px] text-gray-500 hover:text-gray-900">Calendar →</a>
        </div>
        <div className="bg-white rounded-xl">
          {broke.dates ? (
            // R2/R3: a read that failed is SAID. "No deadlines" would be the product telling a
            // customer they are clear on the strength of a question it never got an answer to.
            <div className="px-6 py-5 text-sm text-amber-900 bg-amber-50 rounded-xl border border-amber-200">
              We couldn’t load your dates just now, so this is not a complete picture. That is our
              side, not yours. <a href="/calendar" className="underline">Open the calendar</a>
            </div>
          ) : upcoming.length === 0 && passed.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">Nothing due in the next 30 days.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcoming.map(e => (
                <a key={e.id} href="/calendar" className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                  <span className="text-sm text-gray-800">{e.title}</span>
                  <span className="text-xs text-gray-500">{dueWords(e.due_date, now)}</span>
                </a>
              ))}
              {passed.length > 0 && (
                <div className="px-6 py-3">
                  <p className="text-[13px] text-gray-600">
                    {passed.length} date{passed.length === 1 ? '' : 's'} {passed.length === 1 ? 'has' : 'have'} passed.
                    {' '}A gentle reminder in case any of them still need attention.
                  </p>
                  <div className="mt-1.5 space-y-0.5">
                    {passed.slice(0, 3).map(e => (
                      <a key={e.id} href="/calendar" className="block text-[13px] text-gray-500 hover:text-gray-900">
                        {formatDayShort(e.due_date, now)} · {e.title}
                      </a>
                    ))}
                  </div>
                  {passed.length > 3 && (
                    <a href="/calendar" className="mt-1 block text-[13px] text-gray-500 hover:text-gray-900">
                      and {passed.length - 3} more
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
