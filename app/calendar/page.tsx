/**
 * THE COMPLIANCE CALENDAR — Calendar Job B (`docs/CALENDAR-PLAN.md` decision 16, boards 1–8 and 13).
 *
 * *** EVERYTHING UNDER THIS PAGE WAS REBUILT IN JOB A *** (`DECISIONS.md` §186). This page writes
 * nothing of its own: every change goes through `lib/calendarDates.ts` by way of
 * `/api/calendar/dates`, and every day is read by `lib/calendarDate.ts`. There is no second writer
 * and no second idea of what a day is — which is how the old page could call a date "Overdue" in one
 * panel and "Due today" in the row beneath it (`docs/CALENDAR-MACHINERY.md` B2).
 *
 * THE SHELL IS HR's AND THE WORKSPACE's, piece for piece (decision 16): `AppLayout`, the 900 column,
 * the 28px serif title, `components/Tabs.tsx`, `components/Drawer.tsx` at 720, `components/Sheet.tsx`
 * for anything destructive, `components/Empty.tsx`, `components/buttonStyles.ts` for every action,
 * and `lib/printFrame.ts` for Print. Nothing here is styled by hand that one of those already styles.
 *
 * THE WORDS (§185c): **nothing says "overdue" or "not done" about a date.** All we know is that its
 * day has gone by — people do the work and record it in their own calendar, not necessarily in ours.
 * The group is "Dates that have passed". A date outside the current year shows its year. Never
 * "compliant" (§6).
 *
 * WHAT WENT: "Import from file" and `/api/extract-dates` (decision 17). Documents is the one door for
 * files and it reads dates with the line they came from; the importer enumerated dates from a
 * document with no anchor, which §3.3 names as the mode the model is unreliable in.
 */
'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient, authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { Tabs } from '@/components/Tabs'
import { Drawer, printDrawer } from '@/components/Drawer'
import { Sheet } from '@/components/Sheet'
import { Empty } from '@/components/Empty'
import { PRIMARY, OUTLINE, TEXT_ACTION } from '@/components/buttonStyles'
import { printWithFrame } from '@/lib/printFrame'
import { monthlyEmailPromised } from '@/lib/emailPromise'
import {
  today, formatDay, formatDayShort, formatMonth, monthRange, inMonth, isPast, dueWords,
  compareDays, nextOccurrence, isDayString, type HowOften,
} from '@/lib/calendarDate'

type Tab = 'month' | 'list' | 'confirm'

interface CalendarDate {
  id: string
  title: string
  description: string | null
  due_date: string | null
  source: 'document' | 'conversation' | 'audit' | 'hand' | 'handbook'
  state: 'not_confirmed' | 'confirmed' | 'done' | 'rejected' | 'withdrawn'
  rejected_reason: string | null
  is_recurring: boolean | null
  repeats_every: HowOften | null
  line_verified: boolean | null
  counts_as_due: boolean | null
  entity_id: string | null
  document_id: string | null
  document_deadline_id: string | null
  topic_id: string | null
  audit_finding_id: string | null
  handbook_id: string | null
  date_key: string
  completed_at: string | null
  created_at: string
}

const HOW_OFTEN: Array<{ key: HowOften; label: string }> = [
  { key: 'monthly', label: 'Every month' },
  { key: 'quarterly', label: 'Every three months' },
  { key: 'yearly', label: 'Every year' },
]

const SOURCE_WORDS: Record<CalendarDate['source'], string> = {
  document: 'From a document',
  conversation: 'From a conversation',
  audit: 'From an audit',
  handbook: 'From a handbook',
  hand: 'Added by hand',
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[14px] text-gray-400">Loading…</div>}>
      <Calendar />
    </Suspense>
  )
}

function Calendar() {
  const supabase = createClient()
  const params = useSearchParams()

  const [dates, setDates] = useState<CalendarDate[]>([])
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  /** *** "COULDN'T LOAD" IS NOT AN EMPTY CALENDAR *** (R2/R3, `CLAUDE.md` §3.12). */
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('month')
  const [cursor, setCursor] = useState(() => {
    const t = today()
    return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) }
  })
  const [site, setSite] = useState<string>('all')
  const [showDone, setShowDone] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<CalendarDate | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [changing, setChanging] = useState(false)

  const now = today()

  /**
   * *** ?tab=confirm, EXACTLY — the monthly email already links to it *** (A5b, pinned by a test in
   * `tests/unit/calendarNotify.test.ts`). A link that has been sent cannot be fixed afterwards, so
   * the name it uses is the name this page answers to.
   */
  useEffect(() => {
    const t = params.get('tab')
    if (t === 'confirm' || t === 'list' || t === 'month') setTab(t as Tab)
  }, [params])

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadError('Please sign in again.'); setLoading(false); return }
      const h = await authHeaders()
      const [res, prof] = await Promise.all([
        fetch('/api/calendar/dates?view=all', { headers: h }),
        supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle(),
      ])
      // EVERY READ CHECKS ITS ERROR, and a failure is SAID rather than drawn as an empty month.
      if (!res.ok) throw new Error(`the calendar answered ${res.status}`)
      const json = await res.json()
      if (!json?.dates) throw new Error('the calendar came back in a shape we could not use')
      setDates(json.dates as CalendarDate[])

      const companyId = prof.data?.company_id
      if (companyId) {
        const [s, c, d] = await Promise.all([
          supabase.from('entities').select('id, name').eq('company_id', companyId).order('name'),
          supabase.from('companies').select('name').eq('id', companyId).maybeSingle(),
          supabase.from('document_index_v').select('document_id, title').eq('company_id', companyId),
        ])
        if (s.error) throw new Error(`the sites could not be read: ${s.error.message}`)
        if (d.error) throw new Error(`the documents could not be read: ${d.error.message}`)
        setSites(s.data ?? [])
        setCompanyName((c.data as { name?: string } | null)?.name ?? '')
        setDocs(Object.fromEntries(((d.data ?? []) as Array<{ document_id: string; title: string }>)
          .map((x) => [x.document_id, x.title])))
      }
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ---------------------------------------------------------------------------
  // EVERY WRITE GOES THROUGH THE ONE ROUTE. There is no insert on this page.
  // ---------------------------------------------------------------------------
  const act = useCallback(async (body: Record<string, unknown>, method: 'POST' | 'PATCH' = 'PATCH') => {
    setBusy(true)
    try {
      const res = await fetch('/api/calendar/dates', {
        method, headers: await authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not save that just now. That is our side, not yours.'); return null }
      setNotice(null)
      await load()
      return j
    } catch {
      setNotice('We could not save that just now. That is our side, not yours.')
      return null
    } finally { setBusy(false) }
  }, [load])

  const remove = useCallback(async (d: CalendarDate) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/calendar?id=${d.id}`, { method: 'DELETE', headers: await authHeaders() })
      if (!res.ok) { setNotice('We could not delete that just now. That is our side, not yours.'); return }
      setDeleting(null); setOpenId(null); await load()
    } finally { setBusy(false) }
  }, [load])

  // ---------------------------------------------------------------------------
  // WHAT EACH TAB SHOWS. `counts_as_due` is the database's own column (migration 073), so no query
  // here can get decision 5's rule wrong.
  // ---------------------------------------------------------------------------
  const bySite = useCallback((d: CalendarDate) =>
    site === 'all' || d.entity_id === site || d.entity_id === null, [site])

  const onBoard = useMemo(() => dates.filter((d) => d.counts_as_due && bySite(d)), [dates, bySite])
  const toConfirm = useMemo(() => dates.filter((d) => d.state === 'not_confirmed' && bySite(d)), [dates, bySite])
  const passed = useMemo(() => onBoard
    .filter((d) => d.state !== 'done' && isPast(d.due_date, now))
    .sort((a, b) => compareDays(a.due_date ?? '', b.due_date ?? '')), [onBoard, now])
  const ahead = useMemo(() => onBoard
    .filter((d) => d.state !== 'done' && !isPast(d.due_date, now))
    .sort((a, b) => compareDays(a.due_date ?? '', b.due_date ?? '')), [onBoard, now])
  const doneDates = useMemo(() => onBoard.filter((d) => d.state === 'done')
    .sort((a, b) => compareDays(b.due_date ?? '', a.due_date ?? '')), [onBoard])

  const open = openId ? dates.find((d) => d.id === openId) ?? null : null

  // ---------------------------------------------------------------------------
  // THE MONTH (board 1)
  // ---------------------------------------------------------------------------
  const month = useMemo(() => {
    const { first, last } = monthRange(cursor.y, cursor.m)
    // Monday first, as the board draws it: JS gives Sunday 0, so Sunday becomes the seventh column.
    const jsDow = new Date(cursor.y, cursor.m - 1, 1, 12).getDay()
    const lead = (jsDow + 6) % 7
    const daysIn = Number(last.slice(8))
    const cells: Array<{ day: number; iso: string; dates: CalendarDate[] } | null> =
      Array.from({ length: lead }, () => null)
    for (let n = 1; n <= daysIn; n++) {
      const iso = `${first.slice(0, 8)}${String(n).padStart(2, '0')}`
      cells.push({ day: n, iso, dates: onBoard.filter((d) => d.due_date === iso) })
    }
    return cells
  }, [cursor, onBoard])

  const step = (by: number) => setCursor((c) => {
    const m = c.m + by
    return m < 1 ? { y: c.y - 1, m: 12 } : m > 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m }
  })

  /** A date on the month: solid for confirmed, open for not confirmed, amber once its day has gone. */
  const dotClass = (d: CalendarDate) =>
    d.state === 'done' ? 'line-through text-gray-400'
      : isPast(d.due_date, now) ? 'text-[var(--amber)]'
        : d.state === 'not_confirmed' ? 'text-gray-500' : 'text-gray-900'

  const sourceOf = (d: CalendarDate): { words: string; href: string | null } => {
    // §185 decision 2's correction: when the source is gone, say so in plain words. Never a dead link.
    if (d.source === 'document') {
      return d.document_id
        ? { words: docs[d.document_id] ?? 'a document', href: `/documents?open=${d.document_id}` }
        : { words: 'The document this came from was deleted.', href: null }
    }
    if (d.source === 'conversation') {
      return d.topic_id
        ? { words: 'the conversation it came from', href: `/compliance?topic=${d.topic_id}` }
        : { words: 'The conversation this came from was deleted.', href: null }
    }
    if (d.source === 'audit') {
      return d.audit_finding_id
        ? { words: 'the audit that found it', href: '/audits' }
        : { words: 'The audit this came from was deleted.', href: null }
    }
    if (d.source === 'handbook') {
      return d.handbook_id
        ? { words: 'the handbook it came from', href: `/hr?handbook=${d.handbook_id}` }
        : { words: 'The handbook this came from was deleted.', href: null }
    }
    return { words: 'You added this date.', href: null }
  }

  const siteName = (id: string | null) => sites.find((s) => s.id === id)?.name ?? null

  const Row = ({ d }: { d: CalendarDate }) => (
    <div onClick={() => setOpenId(d.id)}
      className="group -mx-3 flex cursor-pointer items-start gap-4 rounded-lg px-3 py-2.5 hover:bg-white">
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] group-hover:text-[var(--green)] ${
          d.state === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{d.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-gray-500">
          {[
            d.due_date ? formatDayShort(d.due_date, now) : 'No day yet',
            siteName(d.entity_id),
            d.is_recurring
              ? (d.repeats_every
                ? HOW_OFTEN.find((h) => h.key === d.repeats_every)?.label.toLowerCase()
                : 'repeats — how often?')
              : null,
            d.state === 'not_confirmed' ? 'not confirmed' : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
      {d.due_date && d.state !== 'done' && (
        <span className={`shrink-0 text-[12px] ${isPast(d.due_date, now) ? 'text-[var(--amber)]' : 'text-gray-400'}`}>
          {dueWords(d.due_date, now)}
        </span>
      )}
    </div>
  )

  // ---------------------------------------------------------------------------
  // TO CONFIRM, grouped by document (board 3)
  // ---------------------------------------------------------------------------
  const groups = useMemo(() => {
    const m = new Map<string, { label: string; dates: CalendarDate[] }>()
    for (const d of toConfirm) {
      const key = d.document_id ?? d.source
      const label = d.document_id ? (docs[d.document_id] ?? 'A document') : SOURCE_WORDS[d.source]
      if (!m.has(key)) m.set(key, { label, dates: [] })
      m.get(key)?.dates.push(d)
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [toConfirm, docs])

  /**
   * Confirm several, ONE AFTER ANOTHER — Company information's own pattern
   * (`app/company-information/page.tsx:252–273`). A date already settled by an earlier call is
   * skipped rather than reported as a failure.
   */
  const confirmAll = useCallback(async (list: CalendarDate[]) => {
    setBusy(true)
    try {
      const h = await authHeaders({ 'Content-Type': 'application/json' })
      let failed: string | null = null
      for (const d of list) {
        if (!d.due_date) continue        // a repeat with no day: the person picks it first
        const res = await fetch('/api/calendar/dates', {
          method: 'PATCH', headers: h, body: JSON.stringify({ id: d.id, action: 'confirm' }),
        })
        if (!res.ok && res.status !== 404) {
          failed = (await res.json().catch(() => null))?.error ?? 'We could not confirm one of those.'
          break
        }
      }
      setNotice(failed)
      await load()
    } finally { setBusy(false) }
  }, [load])

  const printMonth = () => printWithFrame(
    { company: companyName || 'CompliBoard', type: `Calendar — ${formatMonth(cursor.y, cursor.m)}` })

  if (loading) {
    return <AppLayout title="Calendar"><div className="p-8 text-[14px] text-gray-400">Loading your calendar…</div></AppLayout>
  }

  return (
    <AppLayout title="Calendar">
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="no-print pt-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">Calendar</h1>
          {/*
            THE TRUE WORDS (decision 21, B15). The old tip promised that uploading a file would add
            every renewal date "automatically" and that "you never miss a deadline again" — a
            guarantee nothing can make, since a date we never read is one we cannot warn about.
            The second sentence promises the monthly email, so it is drawn only when that email can
            reach a customer: `lib/emailPromise.ts`, not a held-back line somebody must remember.
          */}
          <p className="mt-1 text-[14px] text-gray-500">
            When CompliBoard reads a document, the dates it sets appear here for you to confirm.
            {monthlyEmailPromised() && ' On the 1st of each month we email you what is due.'}
          </p>
        </div>

        {loadError && (
          <div className="no-print mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">We couldn’t load your calendar. That is our side, not yours.</p>
            <button onClick={() => { setLoading(true); load() }} className={`mt-1 ${TEXT_ACTION}`}>Try again</button>
          </div>
        )}

        <Tabs active={tab} onSelect={setTab}
          tabs={[
            { key: 'month', label: 'Calendar' },
            { key: 'list', label: 'List' },
            { key: 'confirm', label: `To confirm${toConfirm.length ? ` (${toConfirm.length})` : ''}` },
          ]}
          right={
            <button onClick={() => setAdding(true)}
              className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
              + Add a date
            </button>
          } />

        {notice && (
          <div className="no-print mb-4 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{notice}</p>
            <button onClick={() => setNotice(null)} className="text-sm text-red-500 hover:text-red-700">Close</button>
          </div>
        )}

        {sites.length > 1 && (
          <div className="no-print mb-4 flex items-center gap-2 text-[13px]">
            <span className="text-gray-500">Site</span>
            <select value={site} onChange={(e) => setSite(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[13px]">
              <option value="all">All sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* ── THE MONTH (board 1) ─────────────────────────────────────────── */}
        {tab === 'month' && (
          <section>
            <div className="no-print mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-medium text-gray-900">{formatMonth(cursor.y, cursor.m)}</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => step(-1)} className={TEXT_ACTION} aria-label="Previous month">←</button>
                <button onClick={() => setCursor({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) })}
                  className={TEXT_ACTION}>Today</button>
                <button onClick={() => step(1)} className={TEXT_ACTION} aria-label="Next month">→</button>
                <button onClick={printMonth} className={TEXT_ACTION}>Print</button>
              </div>
            </div>
            <div className="no-print grid grid-cols-7 border-t border-gray-200">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                <div key={d} className={`py-2 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400 ${i === 0 ? '' : 'border-l border-gray-100'}`}>{d}</div>
              ))}
              {month.map((cell, i) => (
                <div key={i} className={`min-h-[84px] border-t border-gray-100 p-1.5 ${i % 7 === 0 ? '' : 'border-l'}`}>
                  {cell && (
                    <>
                      <p className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                        cell.iso === now ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>{cell.day}</p>
                      {cell.dates.slice(0, 3).map((d) => (
                        <button key={d.id} onClick={() => setOpenId(d.id)}
                          className={`block w-full truncate text-left text-[11px] leading-5 ${dotClass(d)}`}>
                          {d.state === 'not_confirmed' ? '○ ' : '● '}{d.title}
                        </button>
                      ))}
                      {cell.dates.length > 3 && (
                        <p className="text-[11px] text-gray-400">+{cell.dates.length - 3} more</p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            {/* THE PRINTED MONTH IS THE LIST, NOT THE GRID (board 13). A grid of boxes prints as a
                grid of boxes; what a person carries into a meeting is the dates in order. */}
            <div className="hidden print:block">
              <h2 className="mb-2 font-serif text-[18px]">{formatMonth(cursor.y, cursor.m)}</h2>
              {onBoard.filter((d) => inMonth(d.due_date, cursor.y, cursor.m)).length === 0 && (
                <p className="text-[12px] text-gray-500">Nothing is due in this month.</p>
              )}
              {onBoard.filter((d) => inMonth(d.due_date, cursor.y, cursor.m))
                .sort((a, b) => compareDays(a.due_date ?? '', b.due_date ?? ''))
                .map((d) => (
                  <p key={d.id} className="border-b border-gray-100 py-1.5 text-[12px]">
                    {formatDayShort(d.due_date, now)} · {d.title}
                    {siteName(d.entity_id) ? ` · ${siteName(d.entity_id)}` : ''}
                    {d.state === 'not_confirmed' ? ' · not confirmed' : ''}
                    {d.state === 'done' ? ' · done' : ''}
                  </p>
                ))}
            </div>
          </section>
        )}

        {/* ── THE LIST (board 2) ──────────────────────────────────────────── */}
        {tab === 'list' && (
          <section>
            {!onBoard.length ? (
              <Empty title="No dates yet"
                note="Add documents in Company Documents and the dates they set will appear here, or add a date yourself." />
            ) : (
              <>
                {passed.length > 0 && (
                  <>
                    {/* §185c: "Dates that have passed", never "overdue" or "not done". */}
                    <h3 className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Dates that have passed
                    </h3>
                    <p className="mb-2 text-[12px] text-gray-500">
                      A gentle reminder in case any of these still need attention. If they’re already
                      taken care of, you can mark them done and we won’t list them again.
                    </p>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                      {passed.map((d) => <Row key={d.id} d={d} />)}
                    </div>
                  </>
                )}
                {ahead.length > 0 && (
                  <>
                    <h3 className="mb-1 mt-6 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ahead</h3>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                      {ahead.map((d) => <Row key={d.id} d={d} />)}
                    </div>
                  </>
                )}
                {doneDates.length > 0 && (
                  <div className="mt-6">
                    <button onClick={() => setShowDone((v) => !v)} className={TEXT_ACTION}>
                      {showDone ? 'Hide done' : `Show done (${doneDates.length})`}
                    </button>
                    {showDone && (
                      <div className="mt-2 divide-y divide-gray-100 border-y border-gray-100">
                        {doneDates.map((d) => <Row key={d.id} d={d} />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ── TO CONFIRM (board 3) ────────────────────────────────────────── */}
        {tab === 'confirm' && (
          <section>
            {!toConfirm.length ? (
              <Empty title="Nothing to confirm"
                note="When a reading finds a date in one of your documents, it appears here for you to check against its line." />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-[13px] text-gray-600">
                    {toConfirm.length} date{toConfirm.length === 1 ? '' : 's'} found in your documents.
                    Check each one against the line it came from.
                  </p>
                  <button disabled={busy} onClick={() => confirmAll(toConfirm)} className={PRIMARY}>
                    Confirm all {toConfirm.filter((d) => d.due_date).length}
                  </button>
                </div>
                {groups.map((g) => (
                  <div key={g.label} className="mb-6">
                    <div className="mb-1 flex items-center justify-between gap-4">
                      <h3 className="truncate text-[13px] font-medium text-gray-900">
                        {g.label} <span className="font-normal text-gray-400">· {g.dates.length}</span>
                      </h3>
                      <button disabled={busy} onClick={() => confirmAll(g.dates)} className={OUTLINE}>
                        Confirm all {g.dates.filter((d) => d.due_date).length}
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                      {g.dates.map((d) => (
                        <div key={d.id} className="py-1">
                          <Row d={d} />
                          {/* Decision 5: a line we could not find is SAID, not hidden. */}
                          {d.line_verified === false && (
                            <p className="px-3 pb-1 text-[12px] text-[var(--amber)]">
                              We could not find this line in the document.
                            </p>
                          )}
                          {!d.due_date && (
                            <p className="px-3 pb-1 text-[12px] text-gray-500">
                              Pick the day this falls on before it goes on the calendar.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        )}
      </div>

      {/* ── THE DRAWER FOR ONE DATE (boards 5 and 6) ───────────────────────── */}
      {open && (
        <Drawer title={open.title} onClose={() => setOpenId(null)}
          company={companyName} printType="Calendar"
          sub={[
            open.due_date ? formatDay(open.due_date) : 'No day yet',
            siteName(open.entity_id),
            open.state === 'not_confirmed' ? 'Not confirmed'
              : open.state === 'done' ? 'Done'
                : open.state === 'rejected' ? 'You said this is not right'
                  : open.state === 'withdrawn' ? 'No longer in the document' : 'Confirmed',
          ].filter(Boolean).join(' · ')}
          footer={
            <>
              {open.state === 'not_confirmed' && (
                <button disabled={busy || !open.due_date} onClick={() => act({ id: open.id, action: 'confirm' })} className={OUTLINE}>
                  Confirm
                </button>
              )}
              {(open.state === 'confirmed' || open.state === 'not_confirmed') && open.due_date && (
                <button disabled={busy} onClick={() => act({ id: open.id, action: 'done' })} className={TEXT_ACTION}>
                  Mark done
                </button>
              )}
              {open.state !== 'rejected' && (
                <button disabled={busy} onClick={() => { setRejecting(open.id); setReason('') }} className={TEXT_ACTION}>
                  Not right
                </button>
              )}
              <button disabled={busy} onClick={() => setChanging(true)} className={TEXT_ACTION}>Change</button>
              <button onClick={printDrawer} className={TEXT_ACTION}>Print</button>
              <span className="flex-1" />
              <a className={TEXT_ACTION} target="_blank" rel="noreferrer"
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(open.title)}&dates=${(open.due_date ?? '').replace(/-/g, '')}/${(open.due_date ?? '').replace(/-/g, '')}`}>
                Google
              </a>
              <a className={TEXT_ACTION} target="_blank" rel="noreferrer"
                href={`https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(open.title)}&startdt=${open.due_date ?? ''}&enddt=${open.due_date ?? ''}`}>
                Outlook
              </a>
              {/* DELETE IS FOR HAND-ADDED DATES ONLY (decision 6). A document's date is REJECTED, not
                  deleted, so the next reading of that document knows not to raise it again. */}
              {open.source === 'hand' && (
                <button disabled={busy} onClick={() => setDeleting(open)} className={TEXT_ACTION}>Delete</button>
              )}
            </>
          }>
          <section className="space-y-4">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Where it came from</h4>
              <p className="mt-1 text-[13px] text-gray-700">
                {SOURCE_WORDS[open.source]}
                {(() => {
                  const s = sourceOf(open)
                  return s.href
                    ? <> · <a href={s.href} className="text-[var(--green)] underline hover:text-[var(--green-ink)]">{s.words}</a></>
                    : <> · <span className="text-gray-500">{s.words}</span></>
                })()}
              </p>
              {open.description && <p className="mt-1 text-[13px] italic text-gray-600">“{open.description}”</p>}
              {open.line_verified === false && (
                <p className="mt-1 text-[12px] text-[var(--amber)]">We could not find this line in the document.</p>
              )}
            </div>

            {open.state === 'rejected' && open.rejected_reason && (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">You said</h4>
                <p className="mt-1 text-[13px] text-gray-700">{open.rejected_reason}</p>
              </div>
            )}

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">How often</h4>
              {!open.is_recurring ? (
                <p className="mt-1 text-[13px] text-gray-700">It happens once.</p>
              ) : (
                <>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {HOW_OFTEN.map((h) => (
                      <button key={h.key} disabled={busy}
                        onClick={() => act({ id: open.id, action: 'confirm', every: h.key })}
                        className={`rounded-md border px-2.5 py-1 text-[12px] ${
                          open.repeats_every === h.key
                            ? 'border-[var(--green)] bg-green-50 text-[var(--green-ink)]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                  {/* Decision 9: the reading says only THAT a date repeats, never how often, so the
                      person is asked rather than "annually" being written for them (B4). */}
                  {!open.repeats_every && (
                    <p className="mt-1 text-[12px] text-gray-500">Nobody has said how often yet.</p>
                  )}
                  {open.repeats_every && open.due_date && (
                    <p className="mt-1 text-[12px] text-gray-500">
                      Next after this one: {formatDay(nextOccurrence(open.due_date, open.repeats_every))}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* THE ONES DONE BEFORE (board 6). One row per occurrence is the history this product
                exists to keep: "we did this in January and again in February". */}
            {(() => {
              const earlier = dates.filter((d) => d.id !== open.id && d.state === 'done'
                && d.title === open.title && d.document_id === open.document_id)
                .sort((a, b) => compareDays(b.due_date ?? '', a.due_date ?? ''))
              return earlier.length ? (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Done before</h4>
                  <ul className="mt-1 space-y-0.5">
                    {earlier.map((d) => (
                      <li key={d.id} className="text-[13px] text-gray-600">{formatDay(d.due_date)}</li>
                    ))}
                  </ul>
                </div>
              ) : null
            })()}
          </section>
        </Drawer>
      )}

      {/* ── NOT RIGHT, with its one-line reason (board 8) ───────────────────── */}
      {rejecting && (
        <Sheet title="What is not right about this date?"
          lede="We keep it, with your reason, so the next reading of that document does not raise it again."
          onClose={() => setRejecting(null)}>
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. that is the old permit’s fee"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[var(--green)] focus:outline-none" />
          <div className="mt-3 flex items-center gap-2">
            <button disabled={busy || !reason.trim()}
              onClick={async () => { await act({ id: rejecting, action: 'reject', reason }); setRejecting(null); setOpenId(null) }}
              className={PRIMARY}>Save</button>
            <button onClick={() => setRejecting(null)} className={TEXT_ACTION}>Cancel</button>
          </div>
        </Sheet>
      )}

      {/* ── DELETE, hand-added only, through the sheet (decision 6) ─────────── */}
      {deleting && (
        <Sheet title="Delete this date?" lede="It will be removed from your calendar. This cannot be undone."
          onClose={() => setDeleting(null)}>
          <p className="mb-3 text-[13px] text-gray-700">{deleting.title}</p>
          <div className="flex items-center gap-2">
            <button disabled={busy} onClick={() => remove(deleting)} className={PRIMARY}>Delete</button>
            <button onClick={() => setDeleting(null)} className={TEXT_ACTION}>Keep it</button>
          </div>
        </Sheet>
      )}

      {adding && <AddDate onClose={() => setAdding(false)} sites={sites} act={act} />}
      {changing && open && <ChangeDate date={open} onClose={() => setChanging(false)} act={act} />}
    </AppLayout>
  )
}

/** "Add a date" (board 7). The route sets the state from the source, so a hand date is confirmed. */
function AddDate({ onClose, sites, act }: {
  onClose: () => void
  sites: Array<{ id: string; name: string }>
  act: (b: Record<string, unknown>, m?: 'POST' | 'PATCH') => Promise<unknown>
}) {
  const [title, setTitle] = useState('')
  const [day, setDay] = useState('')
  const [entity, setEntity] = useState('')
  const [repeats, setRepeats] = useState(false)
  const [every, setEvery] = useState<HowOften>('yearly')
  const [saving, setSaving] = useState(false)
  const ok = !!title.trim() && (isDayString(day) || repeats)
  return (
    <Sheet title="Add a date" lede="It goes straight on your calendar — you added it, so it is confirmed."
      onClose={onClose}>
      <label className="block text-[12px] text-gray-600">What is due</label>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Annual air permit fee"
        className="mb-3 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[var(--green)] focus:outline-none" />
      <label className="block text-[12px] text-gray-600">When</label>
      <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
        className="mb-3 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[var(--green)] focus:outline-none" />
      {sites.length > 1 && (
        <>
          <label className="block text-[12px] text-gray-600">Which site</label>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}
            className="mb-3 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px]">
            <option value="">The whole company</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </>
      )}
      <label className="mb-3 flex items-center gap-2 text-[13px] text-gray-700">
        <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
        It repeats
      </label>
      {repeats && (
        <select value={every} onChange={(e) => setEvery(e.target.value as HowOften)}
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px]">
          {HOW_OFTEN.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
        </select>
      )}
      <div className="flex items-center gap-2">
        <button disabled={!ok || saving} className={PRIMARY}
          onClick={async () => {
            setSaving(true)
            const r = await act({
              source: 'hand', title, day: isDayString(day) ? day : null,
              entity_id: entity || null, repeats, every: repeats ? every : null,
            }, 'POST')
            setSaving(false)
            if (r) onClose()
          }}>Add it</button>
        <button onClick={onClose} className={TEXT_ACTION}>Cancel</button>
      </div>
    </Sheet>
  )
}

/** "Change" — the day, and how often it repeats. Both go through `confirmDate`. */
function ChangeDate({ date, onClose, act }: {
  date: CalendarDate; onClose: () => void
  act: (b: Record<string, unknown>, m?: 'POST' | 'PATCH') => Promise<unknown>
}) {
  const [day, setDay] = useState(date.due_date ?? '')
  const [every, setEvery] = useState<HowOften | ''>(date.repeats_every ?? '')
  const [saving, setSaving] = useState(false)
  return (
    <Sheet title="Change this date" onClose={onClose}>
      <label className="block text-[12px] text-gray-600">When</label>
      <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
        className="mb-3 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px]" />
      {date.is_recurring && (
        <>
          <label className="block text-[12px] text-gray-600">How often</label>
          <select value={every} onChange={(e) => setEvery(e.target.value as HowOften)}
            className="mb-3 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px]">
            <option value="">Nobody has said yet</option>
            {HOW_OFTEN.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
          </select>
        </>
      )}
      <div className="flex items-center gap-2">
        <button disabled={saving || !isDayString(day)} className={PRIMARY}
          onClick={async () => {
            setSaving(true)
            const r = await act({ id: date.id, action: 'confirm', day, every: every || null })
            setSaving(false)
            if (r) onClose()
          }}>Save</button>
        <button onClick={onClose} className={TEXT_ACTION}>Cancel</button>
      </div>
    </Sheet>
  )
}
