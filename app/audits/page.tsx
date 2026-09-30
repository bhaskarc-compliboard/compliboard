/**
 * THE AUDITS PAGE — Audits Run 3, Boards E and E2.
 *
 * *** IT REPLACES THE OLD PAGE ENTIRELY, AND KEEPS ONE THING FROM IT: THE BOX. ***
 * The old page asked to be audited against a standard it would then enumerate from nothing — the
 * known-bad mode (CLAUDE.md §3.3), and the reason the whole engine is retired in this commit. What
 * survives is its white field with three grey example lines drawn as an overlay that clears on
 * typing, because that control taught people to type a sentence and it works.
 *
 * *** NO MODEL CALL ON THIS PAGE, INCLUDING IN THE BOX. *** The sentence is matched in code against
 * the agency labels the company's own readings produced. That is the architecture, not an economy:
 * "what's missing is a database query and never an AI guess" (§1), and a box that sent a sentence to
 * a model to find out which agency it meant would be guessing at something the database knows.
 *
 * *** THE ONLY STATUS WORDS ARE THE FOUR, PLUS THE DOCUMENT STATUSES DOCUMENTS ALREADY USES. ***
 * Nothing on this page says compliant, satisfied, met or all clear, and nothing on it names what does
 * the reading (§5.0). The strongest thing it says about a document is that it is on file.
 */
'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import AppLayout from '@/components/AppLayout'
import AuditReport from '@/components/AuditReport'
import DocumentReport from '@/components/DocumentReport'
import { authHeaders } from '@/lib/supabase'

/* ── the shapes the one read returns ──────────────────────────────────────── */
interface Doc {
  document_id: string; title: string; file_name: string; kind: string | null
  agencies: string[] | null; subjects: string[] | null; site_name: string | null
  doc_date: string | null; significant_date: string | null; significant_date_kind: string | null
  display_status: string; scan_id: string | null; could_not_read_reason: string | null
  open_gap_count: number | null
}
interface Deadline {
  document_id: string; title: string; due_on: string | null; recurs: boolean; source_line: string | null
}
interface Section {
  id: string; run_id: string; ordinal: number; title: string; status: string
  started_at: string | null; finished_at: string | null; could_not_complete_reason: string | null
}
interface Finding {
  id: string; run_id: string; section_id: string; kind: string; word: string | null
  title: string; document_id: string | null
}
interface RunSummary {
  total: number; needs_person?: number; nothing_on_file: number; stale: number; on_file: number
  not_a_document_question: number; contradictions: number; expected: number
  sections: number; sections_done: number; could_not_complete: number
  carried: number; closed: number; agencies: string[]; note: string | null
}
interface Run {
  id: string; kind: string; scope: string | null; agency_label: string | null; status: string
  section_count: number; done_count: number; readings_as_of: string | null; created_at: string
  started_at: string | null; finished_at: string | null; summary: RunSummary | null
  notified_at: string | null; dismissed_at: string | null; previous_run_id: string | null
  closed_count: number; estimate: string | null
}
interface Index {
  today: string
  agencies: string[]
  subjects: string[]
  sites: Array<{ id: string; name: string }>
  folders: Array<{ id: string; name: string }>
  counts: { read: number; held_unread: number; agencies: number }
  documents: Doc[]
  unplaced: Doc[]
  deadlines: Deadline[]
  expected: Array<{ document_id: string; titles: string[] }>
  sections: Section[]
  open_findings: Finding[]
  last_done: Record<string, string>
  active: Record<string, string>
  runs: Run[]
  banners: string[]
  estimate: string
}

/* ── the vocabulary, and it is short on purpose ───────────────────────────── */
const WORD: Record<string, string> = {
  nothing_on_file: 'nothing on file',
  stale: 'out of date',
  on_file: 'on file',
  not_a_document_question: 'not a document question',
}
/** The plural the counts line uses, which is not always the word itself. */
const WORD_COUNT: Record<string, (n: number) => string> = {
  nothing_on_file: (n) => `${n} nothing on file`,
  stale: (n) => `${n} out of date`,
  contradiction: (n) => `${n} disagreement${n === 1 ? '' : 's'}`,
  not_a_document_question: (n) => `${n} not a document question`,
  on_file: (n) => `${n} on file`,
}
/** Documents' own statuses, unchanged — this page must not invent a second vocabulary for them. */
const DOC_STATUS: Record<string, string> = {
  needs_work: 'Needs work', expiring: 'Expiring', expired: 'Expired',
  could_not_read: 'Could not read', not_yet_read: 'Not read yet',
  current: 'Current', recorded: 'Recorded', on_file: 'On file',
}
const AMBER_DOC = new Set(['needs_work', 'expiring', 'expired', 'could_not_read'])

/**
 * *** A TITLE IS TEXT, NOT A LINK-SHAPED OBJECT — the owner's review, 30 September. ***
 *
 * Every document title on the first build was a full-width underlined link. Twelve of them down a
 * page is twelve blue-ish bars, and the eye reads the underline before the words: the list stopped
 * looking like a list of documents and started looking like a list of links. A title is the content.
 * So it is plain dark text, ONE line, cut with an ellipsis, the whole title in `title=` for a hover,
 * and the underline arrives only when the pointer is on it.
 *
 * `cursor-pointer` is explicit because a `<button>` defaults to an arrow — the same fix Company
 * information needed in Task 0 commit 4, and the same reason.
 */
const TITLE_LINE =
  'block w-full truncate text-left text-[13px] text-gray-800 cursor-pointer ' +
  'hover:underline hover:text-gray-900'
/** An agency line: clickable across its whole width, with the wash and the pointer to say so. */
const AGENCY_ROW =
  'flex w-full items-start gap-3 py-3 text-left cursor-pointer rounded-md ' +
  'hover:bg-gray-50/70 transition-colors'

const ACTION_GREEN =
  'cursor-pointer text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)] ' +
  'disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline'
const ACTION_QUIET = 'cursor-pointer text-[13px] text-gray-500 hover:text-gray-800'
const ACTION_PRIMARY =
  'cursor-pointer rounded-md bg-[var(--green)] px-4 py-2 text-[14px] font-medium text-white ' +
  'hover:bg-[var(--green-ink)] disabled:cursor-not-allowed disabled:opacity-50'
const controlClass =
  'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[14px] text-gray-700 hover:border-gray-300'

/**
 * *** A STORED SUMMARY GOES STALE THE FIRST TIME YOU LEARN SOMETHING. ***
 * `needs_person` was added to `RunSummary` on 30 September; every run written before that has a
 * summary jsonb without the key, and reading it straight gave "0 to look at" on runs holding
 * nineteen things that need a person. Migration 049 says the same thing about
 * `significant_date`: "a derived field stored is a field that goes stale the first time you learn
 * something". So it is DERIVED from the parts when the key is absent, and the old rows are left
 * alone — backfilling a jsonb would make the same mistake again, one migration later.
 */
function needsOf(s: RunSummary | null | undefined): number {
  if (!s) return 0
  if (typeof s.needs_person === 'number') return s.needs_person
  return (s.nothing_on_file ?? 0) + (s.stale ?? 0) + (s.contradictions ?? 0)
    + (s.not_a_document_question ?? 0)
}

const fmt = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso))
  return Number.isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
const daysUntil = (iso: string, today: string) =>
  Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400_000)

export default function AuditsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[14px] text-gray-400">Loading…</div>}>
      <Audits />
    </Suspense>
  )
}

function Audits() {
  const router = useRouter()
  const params = useSearchParams()
  const openRun = params.get('run')
  const tab = params.get('tab') === 'past' ? 'past' : 'stand'

  const [idx, setIdx] = useState<Index | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ask, setAsk] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [choices, setChoices] = useState<string[] | null>(null)
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({})
  const [drawerWord, setDrawerWord] = useState<string | null>(null)
  /**
   * *** THE DOCUMENT'S OWN REPORT, HERE, NOT A STUB THAT SENDS PEOPLE AWAY — Run 3b, item 1. ***
   * The first build opened a panel saying "open it in Documents for its full reading", which is the
   * product telling somebody to go and do the thing themselves. `DocumentReport` is one component
   * and it mounts here as readily as it mounts on Documents. `fromAudit` remembers which audit to
   * go back to, so Back returns to the report rather than closing everything.
   */
  const [openDoc, setOpenDoc] = useState<string | null>(null)
  const [fromAudit, setFromAudit] = useState<string | null>(null)
  const [site, setSite] = useState('all')
  const [groupBy, setGroupBy] = useState<'agency' | 'subject' | 'site'>('agency')
  const firstOpenDone = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/audits/index', { headers: await authHeaders() })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? 'We could not read your audits just now.'); return }
      setError(null)
      setIdx(json as Index)
    } catch {
      setError('We could not read your audits just now.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  /**
   * *** TEN SECONDS, AND ONLY WHILE SOMETHING IS ACTUALLY RUNNING. ***
   * Documents polls its own list on the same interval. A poll that runs when nothing is moving is
   * a page that costs a request every ten seconds for ever, so this stops when no run is active.
   */
  const anyActive = !!idx && Object.keys(idx.active).length > 0
  useEffect(() => {
    if (!anyActive) return
    const t = setInterval(() => { load() }, 10_000)
    return () => clearInterval(t)
  }, [anyActive, load])

  /** The first audited agency opens itself, once. After that the person's clicks decide. */
  useEffect(() => {
    if (!idx || firstOpenDone.current) return
    firstOpenDone.current = true
    const first = idx.agencies.find((a) => idx.last_done[a])
    if (first) setOpenLines({ [first]: true })
  }, [idx])

  const visibleDocs = useMemo(() => {
    if (!idx) return []
    if (site === 'all') return idx.documents
    const name = idx.sites.find((s) => s.id === site)?.name
    return idx.documents.filter((d) => d.site_name === name)
  }, [idx, site])

  /* ── starting a run: the sentence is matched here, in code ────────────────── */
  async function startRun(agency: string, scope?: string | null) {
    setBusy(true); setNotice(null); setChoices(null)
    try {
      const res = await fetch('/api/audit-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ kind: 'agency', agency, ...(scope ? { scope } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) { setNotice(json?.error ?? 'We could not start that audit just now.'); return }
      setAsk('')
      setNotice(json.estimate ? `Started. ${json.estimate}` : 'Started.')
      await load()
    } finally { setBusy(false) }
  }

  /**
   * THE BOX, AND WHAT IT DOES WITH A SENTENCE.
   *
   * Case-insensitive substring against the company's own agency labels, longest label first so
   * "Oregon OSHA" wins over a shorter label that is contained in it. "everything" or "all" runs
   * every agency. No match shows the agency names as one-click choices — which is the honest answer:
   * the page knows exactly which agencies it can audit, so it says them rather than guessing.
   */
  function submitAsk() {
    if (!idx) return
    const text = ask.trim()
    if (!text) return
    if (!idx.agencies.length) { setNotice('None of your documents carries an agency yet.'); return }

    const lower = text.toLowerCase()
    if (/\b(everything|all|every agency|all agencies)\b/.test(lower)) {
      startRun('all', text); return
    }
    const hit = [...idx.agencies].sort((a, b) => b.length - a.length)
      .find((a) => lower.includes(a.toLowerCase()))
    if (hit) {
      // The rest of the sentence is kept as the scope, verbatim: "for the Portland plant only"
      // is the person's own words about what they meant, and it is shown back to them on the run.
      const rest = text.replace(new RegExp(hit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim()
      startRun(hit, rest || text)
      return
    }
    setChoices(idx.agencies)
    setNotice(null)
  }

  async function dismissRun(id: string) {
    setIdx((cur) => cur ? { ...cur, banners: cur.banners.filter((b) => b !== id) } : cur)
    await fetch(`/api/audit-runs/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ action: 'dismiss' }),
    })
    load()
  }

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString())
    if (v === null) p.delete(k); else p.set(k, v)
    router.replace(`/audits${p.toString() ? `?${p}` : ''}`, { scroll: false })
  }

  /* ── per-agency derived numbers, all off the one read ─────────────────────── */
  function agencyView(label: string) {
    if (!idx) return null
    const docs = visibleDocs.filter((d) => (d.agencies ?? []).includes(label))
    const lastRunId = idx.last_done[label] ?? null
    const lastRun = lastRunId ? idx.runs.find((r) => r.id === lastRunId) ?? null : null
    const activeId = idx.active[label] ?? null
    const activeRun = activeId ? idx.runs.find((r) => r.id === activeId) ?? null : null

    // The section of the active run that is about THIS agency, for "section k of n".
    const activeSections = activeRun ? idx.sections.filter((s) => s.run_id === activeRun.id) : []
    const mine = activeSections.find((s) => s.title === label) ?? null
    const k = mine ? activeSections.filter((s) => s.ordinal <= mine.ordinal).length : 0

    const findings = lastRun
      ? idx.open_findings.filter((f) => {
          if (f.run_id !== lastRun.id) return false
          const sec = idx.sections.find((s) => s.id === f.section_id)
          return !sec || sec.title === label
        })
      : []
    const byWord = {
      nothing_on_file: findings.filter((f) => f.word === 'nothing_on_file' && f.kind === 'finding').length,
      stale: findings.filter((f) => f.word === 'stale').length,
      contradiction: findings.filter((f) => f.kind === 'contradiction').length,
      not_a_document_question: findings.filter((f) => f.word === 'not_a_document_question').length,
      on_file: findings.filter((f) => f.word === 'on_file').length,
    }
    const needs = byWord.nothing_on_file + byWord.stale + byWord.contradiction + byWord.not_a_document_question
    const failed = activeSections.filter((s) => s.status === 'could_not_complete')
    return { docs, lastRun, activeRun, mine, k, n: activeSections.length, byWord, needs, failed }
  }

  /* ── loading, and the two empty states that are claims ────────────────────── */
  if (error) {
    return <AppLayout><div className="mx-auto w-full max-w-[900px] px-4 pt-8 sm:px-6">
      <p className="text-[14px] text-[var(--amber)]">{error}</p>
      <button onClick={load} className={`mt-2 ${ACTION_GREEN}`}>Try again</button>
    </div></AppLayout>
  }
  if (!idx) {
    return <AppLayout><div className="mx-auto w-full max-w-[900px] px-4 pt-8 sm:px-6">
      <p className="text-[14px] text-gray-400">Loading…</p>
    </div></AppLayout>
  }

  const runCount = idx.runs.length

  return (
    <AppLayout>
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="no-print pt-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">Audits</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Where you stand with each agency, from the documents you have given us. Every line points
            at a document, or at something we do not see.
          </p>
        </div>

        {/* THE TABS, in the old page's shape — the one piece of its chrome worth keeping. */}
        <div className="no-print mb-5 mt-5 flex items-center gap-6 border-b border-gray-200">
          <button onClick={() => setParam('tab', null)}
            className={`-mb-px border-b-2 pb-3 text-[14px] font-medium transition-colors ${
              tab === 'stand' ? 'border-[var(--green)] text-[var(--green-ink)]'
                             : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Where you stand
          </button>
          <button onClick={() => setParam('tab', 'past')}
            className={`-mb-px border-b-2 pb-3 text-[14px] font-medium transition-colors ${
              tab === 'past' ? 'border-[var(--green)] text-[var(--green-ink)]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Past audits{runCount ? ` (${runCount})` : ''}
          </button>
        </div>

        {tab === 'stand' && (
          <>
            {/* ── THE BOX ────────────────────────────────────────────────── */}
            <div className="no-print relative mb-3">
              <textarea value={ask} onChange={(e) => setAsk(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitAsk() }}
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white p-4 text-[14px] text-gray-800 focus:border-[var(--green)] focus:outline-none" />
              {/* The examples are an OVERLAY, not a placeholder: three lines of guidance, gone the
                  moment a person types. A placeholder can only hold one line. */}
              {!ask && (
                <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-4">
                  <p className="text-[14px] text-gray-400">e.g. Audit us for Oregon DEQ</p>
                  <p className="text-[14px] text-gray-400">e.g. Audit everything</p>
                  <p className="text-[14px] text-gray-400">e.g. Audit us against the attached checklist</p>
                </div>
              )}
            </div>

            <div className="no-print mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                {/* Inert on purpose, and it says so. An affordance that looks live and does nothing
                    is worse than a sentence that admits it is not here yet (§5.1). */}
                <p className="text-[12px] text-gray-400">
                  Attach a checklist, your own or your auditor&rsquo;s · coming next
                </p>
                <a href="/compliance" className="mt-1 inline-block text-[12px] text-gray-500 underline hover:text-gray-800">
                  Or ask a question in the Compliance Workspace
                </a>
              </div>
              <button onClick={submitAsk} disabled={busy || !ask.trim()} className={ACTION_PRIMARY}>
                {busy ? 'Starting…' : 'Audit'}
              </button>
            </div>

            {notice && <p className="no-print mb-4 text-[13px] text-gray-600">{notice}</p>}
            {choices && (
              <div className="no-print mb-5 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="text-[13px] text-gray-700">
                  We audit by agency, and these are the agencies your documents mention.
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {choices.map((a) => (
                    <button key={a} onClick={() => startRun(a, ask.trim() || null)} className={ACTION_GREEN}>{a}</button>
                  ))}
                  <button onClick={() => startRun('all', ask.trim() || null)} className={ACTION_GREEN}>Everything</button>
                </div>
              </div>
            )}

            {/* ── the thin line ──────────────────────────────────────────── */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
              <p className="text-[13px] text-gray-500">
                {idx.counts.read} document{idx.counts.read === 1 ? '' : 's'} read
                {idx.counts.held_unread ? ` · ${idx.counts.held_unread} held, not read yet` : ''}
                {' · '}{idx.counts.agencies} agenc{idx.counts.agencies === 1 ? 'y' : 'ies'}
              </p>
              <div className="flex items-center gap-2">
                {idx.sites.length > 1 && (
                  <select value={site} onChange={(e) => setSite(e.target.value)} className={controlClass}>
                    <option value="all">Site: All sites</option>
                    {idx.sites.map((s) => <option key={s.id} value={s.id}>Site: {s.name}</option>)}
                  </select>
                )}
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'agency' | 'subject' | 'site')}
                  className={controlClass}>
                  <option value="agency">Group by: Agency</option>
                  <option value="subject">Group by: Subject</option>
                  <option value="site">Group by: Site</option>
                </select>
              </div>
            </div>

            {/* ── the empty states, each of which is a claim and has to be true ── */}
            {idx.counts.read === 0 ? (
              <div className="mt-6">
                <p className="text-[14px] text-gray-600">Read some documents first. Audits are built from their readings.</p>
                <a href="/documents" className={`mt-2 inline-block ${ACTION_GREEN}`}>Go to Documents</a>
              </div>
            ) : idx.agencies.length === 0 ? (
              <p className="mt-6 text-[14px] text-gray-600">None of your documents carries an agency yet.</p>
            ) : groupBy === 'agency' ? (
              <>
                {/* The all-agencies runs waiting to be seen, newest first. One line each, not one
                    per agency it covered. */}
                {idx.runs.filter((r) => r.status === 'done' && r.section_count > 1
                                        && idx.banners.includes(r.id)).slice(0, 2).map((r) => (
                  <div key={r.id}
                    className="mt-3 flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <p className="min-w-0 flex-1 text-[13px] text-gray-900">
                      Your audit of everything is done · {needsOf(r.summary)} to look at
                    </p>
                    <button onClick={() => setParam('run', r.id)} className={ACTION_GREEN}>Open</button>
                    <button onClick={() => dismissRun(r.id)} className={ACTION_QUIET}>Dismiss</button>
                  </div>
                ))}
                <div className="mt-1">
                  {idx.agencies.map((label) => {
                    const v = agencyView(label)!
                    const open = !!openLines[label]
                    const bannerId = v.lastRun && idx.banners.includes(v.lastRun.id) ? v.lastRun.id : null
                    return (
                      <div key={label} className="border-b border-gray-100">
                        {/* The WHOLE line opens it. A chevron three pixels wide was the only
                            thing you could hit, and nothing said the rest of the line was
                            clickable — no pointer, no wash. */}
                        <div className={AGENCY_ROW} role="button" tabIndex={0}
                          onClick={() => setOpenLines((o) => ({ ...o, [label]: !o[label] }))}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); setOpenLines((o) => ({ ...o, [label]: !o[label] })) } }}>
                          <span className={`mt-0.5 w-3 shrink-0 text-[12px] text-gray-400 transition-transform ${
                            open ? 'rotate-90' : ''}`}>▸</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] text-gray-900">{label}</p>
                            {v.activeRun ? (
                              <p className="mt-0.5 text-[12px] text-gray-500">
                                {v.mine && v.mine.status === 'queued'
                                  ? `waiting, section ${v.k} of ${v.n}`
                                  : `Audit running · ${v.activeRun.estimate ?? idx.estimate}`}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[12px] text-gray-500">
                                {v.docs.length} document{v.docs.length === 1 ? '' : 's'}
                                {' · '}
                                {v.lastRun ? `last audited ${fmt(v.lastRun.finished_at ?? v.lastRun.created_at)}` : 'not audited yet'}
                                {v.lastRun ? ` · ${v.needs} to look at` : ''}
                              </p>
                            )}
                            {v.failed.length > 0 && !v.activeRun && (
                              <p className="mt-0.5 text-[12px] text-[var(--amber)]">
                                {v.failed.length} part{v.failed.length === 1 ? '' : 's'} of the last audit did not finish.
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {v.activeRun ? (
                              <p className="text-[12px] text-gray-500">
                                {v.n > 1 ? `section ${v.k} of ${v.n}` : ''}
                              </p>
                            ) : (
                              <button disabled={busy}
                                onClick={(e) => { e.stopPropagation(); startRun(label) }}
                                className={ACTION_GREEN}>
                                {v.lastRun ? 'Audit again' : 'Audit'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* *** A BANNER BELONGS TO A RUN, AND "Audit everything" IS ONE RUN. ***
                            One banner per AGENCY line put four of them on the page after one
                            action, each announcing a quarter of the same news. A single-agency run
                            keeps its banner here, on the line it is about; an all-agencies run is
                            announced once, above the list. */}
                        {bannerId && v.lastRun && v.lastRun.section_count === 1 && (
                          <div className="mb-3 flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <p className="min-w-0 flex-1 text-[13px] text-gray-900">
                              Your {label} audit is done · {v.needs} to look at
                            </p>
                            <button onClick={() => setParam('run', bannerId)} className={ACTION_GREEN}>Open</button>
                            <button onClick={() => dismissRun(bannerId)} className={ACTION_QUIET}>Dismiss</button>
                          </div>
                        )}

                        {open && <AgencyBody label={label} idx={idx} v={v}
                          onOpenRun={(w) => { setDrawerWord(w); setParam('run', v.lastRun!.id) }}
                          onOpenDoc={(d) => { setFromAudit(null); setOpenDoc(d) }} />}
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-[12px] text-gray-500">
                  An audit of everything runs one section per agency, in this order. Each line updates
                  as its section lands. We email you when the last one does.
                </p>
              </>
            ) : (
              <GroupedByOther by={groupBy} idx={idx} docs={visibleDocs} onAudit={startRun} busy={busy}
                onOpenDoc={(d) => { setFromAudit(null); setOpenDoc(d) }} />
            )}

            {/* ── the last group, only when it has something in it ────────── */}
            {idx.unplaced.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h2 className="text-[12px] font-medium uppercase tracking-wide text-gray-700">
                  Documents we read but could not place under an agency
                  <span className="ml-2 font-normal text-gray-400">{idx.unplaced.length}</span>
                </h2>
                <div className="mt-2">
                  {idx.unplaced.map((d) => (
                    <div key={d.document_id} className="flex items-center gap-3 border-b border-gray-100 py-2">
                      <button onClick={() => { setFromAudit(null); setOpenDoc(d.document_id) }}
                        title={d.title} className={`min-w-0 flex-1 ${TITLE_LINE}`}>{d.title}</button>
                      <p className={`shrink-0 text-[12px] ${AMBER_DOC.has(d.display_status) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                        {DOC_STATUS[d.display_status] ?? d.display_status}
                      </p>
                      <button onClick={() => { setFromAudit(null); setOpenDoc(d.document_id) }}
                        className={ACTION_GREEN}>Open</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'past' && (
          <>
            {idx.runs.length === 0 ? (
              <p className="mt-2 text-[14px] text-gray-600">No audits yet.</p>
            ) : (
              <>
                <div>
                  {idx.runs.map((r) => {
                    const secs = idx.sections.filter((s) => s.run_id === r.id)
                    const docsRead = new Set(secs.flatMap(() => [] as string[])).size
                    const failed = secs.filter((s) => s.status === 'could_not_complete')
                    const prev = r.previous_run_id ? idx.runs.find((x) => x.id === r.previous_run_id) : null
                    const prevOpen = needsOf(prev?.summary) + (r.closed_count ?? 0)
                    return (
                      <div key={r.id} className="flex items-start gap-3 border-b border-gray-100 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] text-gray-900">
                            {fmt(r.finished_at ?? r.created_at)}
                            <span className="ml-2 text-gray-600">
                              {r.section_count > 1 ? 'All agencies' : (r.agency_label ?? 'All agencies')}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[12px] text-gray-500">
                            {r.status !== 'done'
                              ? `Running · ${r.estimate ?? idx.estimate}`
                              : <>
                                  {needsOf(r.summary)} to look at
                                  {` · ${r.summary?.sections_done ?? 0} of ${r.section_count} section${r.section_count === 1 ? '' : 's'}`}
                                  {prev && r.closed_count > 0
                                    ? ` · ${r.closed_count} of ${prevOpen} from ${fmt(prev.finished_at ?? prev.created_at)} closed`
                                    : ''}
                                </>}
                          </p>
                          {failed.length > 0 && (
                            <p className="mt-0.5 text-[12px] text-[var(--amber)]">
                              {failed.map((f) => f.title).join(', ')} did not finish.
                            </p>
                          )}
                          {r.scope && <p className="mt-0.5 text-[12px] text-gray-400">&ldquo;{r.scope}&rdquo;</p>}
                        </div>
                        <button onClick={() => setParam('run', r.id)} className={`shrink-0 ${ACTION_GREEN}`}>Open</button>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-[12px] text-gray-500">
                  Every audit is kept. Open one and its report is exactly what it said on the day,
                  against the documents as they stood then.
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* The audit report. Hidden, not unmounted, while a document's report is on top of it, so
          Back returns to it at the same scroll position rather than re-rendering from the top. */}
      {openRun && (
        <div className={openDoc ? 'hidden' : ''}>
          <div className="no-print fixed inset-0 z-[45] bg-gray-900/20"
            onClick={() => { setParam('run', null); setDrawerWord(null) }} />
          <AuditReport runId={openRun} focusWord={drawerWord}
            onClose={() => { setParam('run', null); setDrawerWord(null) }}
            onChanged={load}
            onOpenDoc={(d) => { setFromAudit(openRun); setOpenDoc(d) }} />
        </div>
      )}

      {/* THE DOCUMENT'S OWN REPORT, THE SAME COMPONENT DOCUMENTS MOUNTS. */}
      {openDoc && (
        <>
          <div className="no-print fixed inset-0 z-[45] bg-gray-900/30"
            onClick={() => { setOpenDoc(null); setFromAudit(null) }} />
          <DocumentReport
              documentId={openDoc}
              companyName={null}
              onClose={() => { setOpenDoc(null); setFromAudit(null) }}
              onChanged={load}
              folders={idx.folders ?? []}
              /* The way back, in the header's own flow above the title rather than as an overlay
                 pinned to the top with nothing under it (§147). `Drawer`'s `topLine` slot. */
              topLine={
                <button onClick={() => { setOpenDoc(null) }}
                  className="cursor-pointer text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">
                  ← {fromAudit ? 'Back to the audit' : 'Back to Audits'}
                </button>
              }
              onMove={async (documentId, folderId) => {
                await fetch('/api/documents', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                  body: JSON.stringify({ id: documentId, folder_id: folderId }),
                })
                await load()
              }}
              /* This page has no file picker of its own, and building a second upload path here
                 would be two of them. Documents is the upload surface, and it now shows the
                 hint it is sent (Run 3b, item 5), so this lands somewhere that does the thing. */
              onPickFile={() => { window.location.href = '/documents?add=a+clearer+copy' }}
          />
        </>
      )}
    </AppLayout>
  )
}

/* ── what is inside an agency line ────────────────────────────────────────── */
function AgencyBody({ label, idx, v, onOpenRun, onOpenDoc }: {
  label: string
  idx: Index
  v: { docs: Doc[]; lastRun: Run | null; byWord: Record<string, number>; needs: number }
  onOpenRun: (word: string | null) => void
  onOpenDoc: (documentId: string) => void
}) {
  const docIds = new Set(v.docs.map((d) => d.document_id))
  const subjects = [...new Set(v.docs.flatMap((d) => d.subjects ?? []))].sort()
  const noSubject = v.docs.filter((d) => !(d.subjects ?? []).length)

  const deadlinesFor = (ids: Set<string>) => idx.deadlines.filter((dl) => ids.has(dl.document_id))
  const expectedTitles = [...new Set(idx.expected
    .filter((e) => docIds.has(e.document_id))
    .flatMap((e) => e.titles))]

  // Deadlines already printed in an earlier group of this agency.
  const shown = new Set<string>()

  const groups: Array<{ name: string; docs: Doc[] }> = [
    ...subjects.map((s) => ({ name: s, docs: v.docs.filter((d) => (d.subjects ?? []).includes(s)) })),
    ...(noSubject.length ? [{ name: 'No subject yet', docs: noSubject }] : []),
  ]

  return (
    <div className="mb-4 pl-6">
      {groups.map((g) => (
        <div key={g.name} className="mb-3">
          <h3 className="text-[12px] font-medium uppercase tracking-wide text-gray-700">
            {g.name}<span className="ml-2 font-normal text-gray-400">{g.docs.length}</span>
          </h3>
          {g.docs.map((d) => (
            <div key={d.document_id} className="flex items-center gap-3 border-b border-gray-100 py-1.5">
              {/* Opens the document's OWN report here. `/documents?doc=` was a link that landed on
                  a page which does not read the parameter — it opened Documents and nothing else. */}
              <button onClick={() => onOpenDoc(d.document_id)} title={d.title}
                className={`min-w-0 flex-1 ${TITLE_LINE}`}>{d.title}</button>
              <p className={`shrink-0 text-[12px] ${AMBER_DOC.has(d.display_status) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                {DOC_STATUS[d.display_status] ?? d.display_status}
                {/* A record's date IS its last entry, which is the only thing that says whether it
                    is being kept. Other kinds carry their own date in the status word already. */}
                {d.kind === 'record' && d.significant_date ? ` · last entry ${fmt(d.significant_date)}` : ''}
              </p>
            </div>
          ))}
          {/* *** ONCE PER DOCUMENT, NOT ONCE PER SUBJECT. *** The self-check carries five subject
              labels, so its two deadlines were printed five times — twelve lines of repeat under one
              agency. A deadline belongs to a document, and the document is listed under each of its
              subjects; the dates go under the first group that claims it. */}
          {deadlinesFor(new Set(g.docs.map((x) => x.document_id)))
            .filter((dl) => !shown.has(`${dl.document_id}|${dl.title}`) && (shown.add(`${dl.document_id}|${dl.title}`), true))
            .map((dl, i) => {
            const passed = !!dl.due_on && dl.due_on <= idx.today
            const inDays = dl.due_on ? daysUntil(dl.due_on, idx.today) : null
            return (
              <p key={`${dl.document_id}-${i}`} className="mt-1 text-[12px] text-gray-500">
                {dl.title}
                {dl.due_on
                  ? <> — {fmt(dl.due_on)} · {passed
                      ? <span className="text-[var(--amber)]">passed</span>
                      : `in ${inDays} day${inDays === 1 ? '' : 's'}`}</>
                  /* *** A RECURRING DEADLINE WITH NO DATE IS NOT TOLD IT HAS PASSED. ***
                     This read the reading's `source_line` into the gap where a month and day
                     should go, which printed a whole permit condition into the line — and then
                     claimed "passed for 2026" about a date nobody has. `document_deadlines` holds
                     no month-and-day column, so when `due_on` is null there is nothing to compare
                     with today and the honest line says only that it recurs. */
                  : <> — recurs · <span className="text-gray-400">no date in the reading</span></>}
              </p>
            )
          })}
        </div>
      ))}

      {/* THE LAST AUDIT'S OPEN FINDINGS, BY WORD, ON ONE LINE. Each count opens the report at
          that word — a number a person cannot get to the inside of is a number they have to
          take on trust. */}
      {v.lastRun && (
        <p className="mt-2 text-[12px] text-gray-600">
          Last audit, {fmt(v.lastRun.finished_at ?? v.lastRun.created_at)}:{' '}
          {(['nothing_on_file', 'stale', 'contradiction', 'not_a_document_question', 'on_file'] as const)
            .filter((w) => v.byWord[w] > 0)
            .map((w, i, arr) => (
              <span key={w}>
                <button onClick={() => onOpenRun(w)} className="underline hover:text-gray-900">
                  {WORD_COUNT[w](v.byWord[w])}
                </button>
                {i < arr.length - 1 ? ' · ' : ''}
              </span>
            ))}
          {v.needs === 0 && v.byWord.on_file === 0 && <span>nothing open</span>}
        </p>
      )}

      {expectedTitles.length > 0 && (
        <p className="mt-2 text-[12px] text-gray-400">
          Based on similar companies we would also expect: {expectedTitles.slice(0, 6).join(' · ')}
          {expectedTitles.length > 6 ? ` · and ${expectedTitles.length - 6} more` : ''}
        </p>
      )}
    </div>
  )
}

/**
 * GROUPED BY SUBJECT OR SITE.
 *
 * *** AN AUDIT IS STILL RUN BY AGENCY, AND THIS SAYS SO RATHER THAN PRETENDING OTHERWISE. ***
 * A subject spans regulators — "Air Quality" is DEQ's, "Powered Industrial Trucks" is OSHA's — and a
 * site holds documents from several. So these groupings arrange what the company HOLDS, and the
 * action stays on the agency names inside each group. Offering "Audit" on a subject would promise a
 * run the engine cannot do.
 */
function GroupedByOther({ by, idx, docs, onAudit, busy, onOpenDoc }: {
  by: 'subject' | 'site'; idx: Index; docs: Doc[]
  onAudit: (agency: string) => void; busy: boolean
  onOpenDoc: (documentId: string) => void
}) {
  const keyOf = (d: Doc): string[] =>
    by === 'subject' ? (d.subjects ?? []) : [d.site_name ?? 'No site recorded']
  const names: string[] = [...new Set(docs.flatMap(keyOf))].sort()
  const none = docs.filter((d) => keyOf(d).length === 0)

  return (
    <div className="mt-1">
      {[...names.map((n) => ({ name: n, docs: docs.filter((d) => keyOf(d).includes(n)) })),
        ...(none.length ? [{ name: by === 'subject' ? 'No subject yet' : 'No site recorded', docs: none }] : []),
      ].map((g) => {
        const ag = [...new Set(g.docs.flatMap((d) => d.agencies ?? []))].sort()
        return (
          <div key={g.name} className="border-b border-gray-100 py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-gray-900">{g.name}</p>
                <p className="mt-0.5 text-[12px] text-gray-500">
                  {g.docs.length} document{g.docs.length === 1 ? '' : 's'}
                  {ag.length ? ` · ${ag.join(', ')}` : ' · no agency yet'}
                </p>
              </div>
              <div className="shrink-0 space-x-3 text-right">
                {ag.map((a) => (
                  <button key={a} disabled={busy} onClick={() => onAudit(a)} className={ACTION_GREEN}>
                    Audit {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5 pl-0">
              {g.docs.map((d) => (
                <div key={d.document_id} className="flex items-center gap-3 py-1">
                  <button onClick={() => onOpenDoc(d.document_id)} title={d.title}
                    className={`min-w-0 flex-1 ${TITLE_LINE}`}>{d.title}</button>
                  <p className={`shrink-0 text-[12px] ${AMBER_DOC.has(d.display_status) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                    {DOC_STATUS[d.display_status] ?? d.display_status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <p className="mt-4 text-[12px] text-gray-500">
        Audits are run by agency. Grouping by {by} arranges what you hold; the action stays on the
        agency it would be run for.
      </p>
      {idx.agencies.length === 0 && (
        <p className="mt-2 text-[14px] text-gray-600">None of your documents carries an agency yet.</p>
      )}
    </div>
  )
}
