/**
 * THE AUDIT REPORT — Audits Run 3, Board F.
 *
 * *** IT IS `DocumentReport`'S STRUCTURE, NOT A SECOND REPORT DESIGN. *** HANDOFF-AUDITS §5.5 names
 * the Documents report as the pattern for every report the product produces, "including an audit
 * report": the same 720 drawer, the same 12px uppercase section headings, the same rule that a
 * section appears only when it has content, the same footer vocabulary with at most one outlined
 * green action. What differs is what the sections are about.
 *
 * *** ONE REQUEST. *** `GET /api/audit-runs/[id]` returns the run, its sections and its findings with
 * every document already resolved. A report that arrives as four fetches renders in four steps, and a
 * person watching headings appear one at a time reads it as slow.
 *
 * *** IT NEVER SAYS WHETHER THE COMPANY COMPLIES. *** Every line points at a document or says what is
 * not there. The sentence that says so out loud is in "What this covers", because a reader who takes
 * this to an inspector has to know what it is and what it is not.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'

import { Drawer, printDrawer } from '@/components/Drawer'
import { authHeaders } from '@/lib/supabase'

interface DocRef { title: string; file_name: string; kind?: string | null; display_status?: string | null }

/** Documents' own words for a status, so the audit does not invent a second vocabulary for them. */
const DOC_STATUS: Record<string, string> = {
  needs_work: 'Needs work', expiring: 'Expiring', expired: 'Expired',
  could_not_read: 'Could not read', not_yet_read: 'Not read yet',
  current: 'Current', recorded: 'Recorded', on_file: 'On file',
}
const KIND_LABEL: Record<string, string> = {
  permit: 'Permit', certificate: 'Certificate', program: 'Program', policy: 'Policy',
  record: 'Record', supplier_document: "Supplier's document", other: 'Other',
}

/**
 * *** A TITLE IS TEXT, NOT A LINK-SHAPED OBJECT — the owner's review, 30 September. ***
 * One line, cut with an ellipsis, the whole title on hover, underlined only under the pointer.
 * The same class the page uses, for the same reason: a column of underlines reads as a column of
 * links rather than a list of documents.
 */
const TITLE_LINE =
  'block max-w-full truncate text-left text-[13px] text-gray-800 cursor-pointer ' +
  'hover:underline hover:text-gray-900'
interface Finding {
  id: string; section_id: string; ordinal: number; kind: string; title: string
  word: string | null; basis: string | null
  document_id: string | null; document: DocRef | null
  document_b_id: string | null; document_b: DocRef | null
  locator: string | null; quote: string | null; quote_verified: boolean | null
  what_to_do: string | null; due_on: string | null; recurs: boolean | null; passed: boolean | null
  value_a: string | null; value_b: string | null
  status: string; same_as: string | null; dismissed_reason: string | null; handle_error: boolean
}
interface Section {
  id: string; ordinal: number; title: string; status: string
  started_at: string | null; finished_at: string | null; model: string | null
  ai_call_id: string | null; json_parsed: boolean | null
  could_not_complete_reason: string | null
  documents_read: string[] | null; documents_held_unread: string[] | null
}
interface RunSummary {
  total: number; needs_person?: number; nothing_on_file: number; stale: number; on_file: number
  not_a_document_question: number; contradictions: number; expected: number
  sections: number; sections_done: number; could_not_complete: number
  carried: number; closed: number; agencies: string[]; note: string | null
}
interface Run {
  id: string; kind: string; scope: string | null; agency_label: string | null; status: string
  section_count: number; done_count: number; readings_as_of: string | null
  created_at: string; finished_at: string | null; summary: RunSummary | null
  previous_run_id: string | null; estimate: string | null
}
interface Report { run: Run; sections: Section[]; findings: Finding[]
  /** id -> title, for every document the run read or held. */
  documents?: Record<string, DocRef> }

const WORD: Record<string, string> = {
  nothing_on_file: 'nothing on file',
  stale: 'out of date',
  on_file: 'on file',
  not_a_document_question: 'not a document question',
}
/** Amber is attention. On file is not attention, and must not borrow the colour. */
const AMBER_WORD = new Set(['nothing_on_file', 'stale'])
/** The order findings are read in: what is missing, then what is old, then what is there. */
const WORD_ORDER = ['nothing_on_file', 'stale', 'on_file', 'not_a_document_question']

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

function Section_({ title, count, children, open, onToggle }: {
  title: string; count?: number; children: React.ReactNode; open: boolean; onToggle: () => void
}) {
  return (
    <section className="mt-6 border-t border-gray-100 pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <button onClick={onToggle}
        className="mb-2 flex w-full items-center gap-2 text-left text-[12px] font-medium uppercase tracking-wide text-gray-700">
        <span className="no-print w-3 text-gray-400">{open ? '▾' : '▸'}</span>
        {title}
        {count !== undefined && <span className="font-normal text-gray-400">{count}</span>}
      </button>
      {/* Print shows every section whatever is folded on screen: a printed report with a collapsed
          section is a report missing a page, and nobody reading it on paper can expand it. */}
      <div className={open ? '' : 'hidden print:block'}>{children}</div>
    </section>
  )
}

function ReasonBox({ onCancel, onSave }: { onCancel: () => void; onSave: (r: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="no-print mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-[12px] text-gray-600">What is wrong with it? We keep the reason with the finding.</p>
      <textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} rows={2}
        className="mt-1.5 w-full rounded border border-gray-200 p-2 text-[13px]" />
      <div className="mt-2 flex items-center gap-3">
        <button disabled={!v.trim()} onClick={() => onSave(v.trim())}
          className="cursor-pointer text-[13px] text-[var(--green)] underline disabled:text-gray-300 disabled:no-underline">Save</button>
        <button onClick={onCancel} className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
      </div>
    </div>
  )
}

export default function AuditReport({ runId, focusWord, onClose, onChanged, onOpenDoc }: {
  runId: string; focusWord?: string | null; onClose: () => void; onChanged: () => void
  /**
   * *** THE PAGE OPENS THE DOCUMENT, NOT THIS COMPONENT — Run 3b, item 1. ***
   * This used to render its own panel saying "open it in Documents for its full reading", which is
   * the product asking somebody to go and do it themselves. The real report is
   * `components/DocumentReport.tsx`, it needs the folder list and the page holds it, so the click
   * goes up and the page mounts it with a Back line.
   */
  onOpenDoc: (documentId: string) => void
}) {
  const [rep, setRep] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [reasonFor, setReasonFor] = useState<string | null>(null)
  const [earlier, setEarlier] = useState<Run[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit-runs/${runId}`, { headers: await authHeaders() })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? 'We could not read that audit just now.'); return }
      setError(null); setRep(json as Report)
    } catch { setError('We could not read that audit just now.') }
  }, [runId])

  useEffect(() => { load() }, [load])

  /** Earlier runs for the same agency, for the last section. One extra read, only for the drawer. */
  useEffect(() => {
    if (!rep) return
    ;(async () => {
      const res = await fetch('/api/audit-runs', { headers: await authHeaders() })
      if (!res.ok) return
      const json = await res.json()
      const mine = (json.runs ?? []).filter((r: Run) =>
        r.id !== rep.run.id && r.status === 'done' && r.agency_label === rep.run.agency_label)
      setEarlier(mine)
    })()
  }, [rep])

  /** While a run is still going the drawer follows it, on the page's own ten seconds. */
  useEffect(() => {
    if (!rep || rep.run.status === 'done') return
    const t = setInterval(() => { load() }, 10_000)
    return () => clearInterval(t)
  }, [rep, load])

  useEffect(() => {
    // Everything open by default when it has content; the focus word, if one came in from a count
    // on the page, decides nothing about folding — it only says which list the person meant.
    setOpen({ covers: true, findings: true, dates: true, contradictions: true,
              expected: true, failed: true, earlier: false })
  }, [runId])

  if (error) {
    return <Drawer title="Audit" onClose={onClose}>
      <p className="text-[14px] text-[var(--amber)]">{error}</p>
      <button onClick={load} className="mt-2 text-[13px] text-[var(--green)] underline">Try again</button>
    </Drawer>
  }
  if (!rep) return <Drawer title="Reading…" onClose={onClose}><p className="text-[14px] text-gray-400">Opening…</p></Drawer>

  const { run, sections, findings } = rep
  /**
   * *** AN ALL-AGENCIES RUN IS NOT NAMED BY STRINGING ITS AGENCIES TOGETHER. ***
   * `agency_label` holds "Oregon DEQ · Oregon OSHA · Oregon State Fire Marshal · U.S. OSHA" for a
   * run of everything, because the column has to say what the run was about and a four-agency run
   * was about four. As a drawer title that is a wall of text; the agencies belong in What this
   * covers, where there is room for them and each is a section heading anyway.
   */
  const everything = run.section_count > 1
  const agency = everything ? 'Audit of everything' : (run.agency_label ?? 'All agencies')
  const agencyList = String(run.agency_label ?? '').split(' · ').map((x) => x.trim()).filter(Boolean)
  const openF = findings.filter((f) => f.status === 'open')
  const dismissed = findings.filter((f) => f.status === 'dismissed')
  const plain = openF.filter((f) => f.kind === 'finding')
    .sort((a, b) => WORD_ORDER.indexOf(a.word ?? '') - WORD_ORDER.indexOf(b.word ?? ''))
  const dates = openF.filter((f) => f.kind === 'date')
    .sort((a, b) => Number(!!b.passed) - Number(!!a.passed) || String(a.due_on).localeCompare(String(b.due_on)))
  const contradictions = openF.filter((f) => f.kind === 'contradiction')
  const expected = openF.filter((f) => f.kind === 'expected')
  const failed = sections.filter((s) => s.status === 'could_not_complete')
  const docsRead = [...new Set(sections.flatMap((s) => s.documents_read ?? []))]
  const docsUnread = [...new Set(sections.flatMap((s) => s.documents_held_unread ?? []))]
  // The route's own map first; the findings are the fallback for an older response shape. A
  // document the run read and no finding cites has a title here and had none before.
  const titleOf = (id: string) =>
    rep.documents?.[id]?.title
    ?? findings.find((f) => f.document_id === id)?.document?.title
    ?? findings.find((f) => f.document_b_id === id)?.document_b?.title ?? null

  async function dismiss(id: string, reason: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/audit-findings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ id, action: 'dismiss', reason }),
      })
      if (!res.ok) { const j = await res.json().catch(() => null); setNotice(j?.error ?? 'We could not save that.'); return }
      setReasonFor(null); await load(); onChanged()
    } finally { setBusy(false) }
  }

  async function auditAgain() {
    setBusy(true)
    try {
      const res = await fetch('/api/audit-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ kind: 'agency', agency: everything ? 'all' : agency,
                               previous_run_id: run.id, scope: run.scope }),
      })
      const json = await res.json()
      if (!res.ok) { setNotice(json?.error ?? 'We could not start that audit just now.'); return }
      setNotice(json.estimate ? `Running again. ${json.estimate}` : 'Running again.')
      onChanged()
      // The drawer follows the NEW run, so pressing the button shows its progress rather than
      // leaving the person on a report that has just been superseded.
      if (json.id) window.location.href = `/audits?run=${json.id}`
    } finally { setBusy(false) }
  }

  async function makeChecklist() {
    setBusy(true)
    try {
      const items = plain.filter((f) => AMBER_WORD.has(f.word ?? '') || f.word === 'not_a_document_question')
      const res = await fetch('/api/audit-checklist', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ run_id: run.id, finding_ids: items.map((f) => f.id) }),
      })
      const json = await res.json()
      setNotice(res.ok
        ? `Checklist made with ${json.items ?? items.length} item${(json.items ?? items.length) === 1 ? '' : 's'}.`
        : (json?.error ?? 'We could not make that checklist just now.'))
      onChanged()
    } finally { setBusy(false) }
  }

  // THE ONE META LINE. Audited date, sections, what it read and what it only listed, and how fresh
  // the evidence was. No cost: what a reading cost us is our business, not a line on the report
  // somebody takes to an inspector.
  const sub = `audited ${fmt(run.finished_at ?? run.created_at)} · `
    + `${run.section_count} section${run.section_count === 1 ? '' : 's'} · `
    + `${docsRead.length} document${docsRead.length === 1 ? '' : 's'} read`
    + (docsUnread.length ? `, ${docsUnread.length} held unread` : '')
    + (run.readings_as_of ? ` · readings as of ${fmt(run.readings_as_of)}` : '')

  const footer = (
    <>
      <button disabled={busy} onClick={auditAgain}
        className="rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50 disabled:opacity-50">
        {busy ? 'Working…' : 'Audit again'}
      </button>
      <button disabled={busy || !plain.length} onClick={makeChecklist}
        className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300">
        Make a checklist
      </button>
      <button onClick={printDrawer} className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Print</button>
      <a href={`/api/audit-runs/${run.id}/documents`}
        className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Download the documents</a>
      <button onClick={() => setReasonFor('run')} className="text-[12px] text-gray-400 hover:text-gray-700 hover:underline">
        Not right
      </button>
    </>
  )

  return (
    <Drawer title={everything ? `Audit of everything · ${run.section_count} sections` : `${agency} audit`}
      sub={sub} onClose={onClose} footer={footer}>
      {/*
        *** THE HEADER SAID THE SAME THING TWICE, AND ONE OF THEM CARRIED A PRICE. ***
        The drawer's own `sub` already reads "n sections · m documents read · readings as of …", and
        this line repeated it with the date and the cost bolted on. The date belongs in the meta
        line; the cost does not belong on a customer's screen at all (§147). One line now, built
        once, passed to the Drawer as `sub`.
      */}
      {run.status !== 'done' && (
        <p className="mt-2 text-[13px] text-gray-600">
          Still running · {run.done_count} of {run.section_count} section
          {run.section_count === 1 ? '' : 's'} done{run.estimate ? ` · ${run.estimate}` : ''}
        </p>
      )}
      {run.scope && <p className="mt-1 text-[12px] text-gray-400">You asked: &ldquo;{run.scope}&rdquo;</p>}
      {notice && <p className="no-print mt-2 text-[13px] text-gray-700">{notice}</p>}
      {reasonFor === 'run' && (
        <ReasonBox onCancel={() => setReasonFor(null)}
          onSave={(r) => { setReasonFor(null); setNotice(`Thank you — we have kept that: “${r}”`) }} />
      )}

      {/* ── WHAT THIS COVERS ─────────────────────────────────────────────── */}
      <Section_ title="What this covers" open={!!open.covers}
        onToggle={() => setOpen((o) => ({ ...o, covers: !o.covers }))}>
        {everything && agencyList.length > 1 && (
          <p className="mb-2 text-[12px] text-gray-500">
            Agencies: {agencyList.join(' · ')}
          </p>
        )}
        {docsRead.length > 0 && (
          <>
            <p className="text-[12px] text-gray-500">Documents read</p>
            <ul className="mt-1 space-y-1">
              {docsRead.map((id) => {
                const d = rep.documents?.[id]
                return (
                  <li key={id} className="flex items-baseline gap-2">
                    <button onClick={() => onOpenDoc(id)} title={d?.title ?? undefined}
                      className={`min-w-0 flex-1 ${TITLE_LINE}`}>
                      {/* Never the id. A document whose row has gone says so in words. */}
                      {titleOf(id) ?? 'a document that is no longer on file'}
                    </button>
                    <span className="shrink-0 text-[12px] text-gray-500">
                      {d?.kind ? (KIND_LABEL[d.kind] ?? d.kind) : ''}
                      {d?.kind && d?.display_status ? ' · ' : ''}
                      {d?.display_status ? (DOC_STATUS[d.display_status] ?? d.display_status) : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {docsUnread.length > 0 && (
          <p className="mt-2 text-[12px] text-gray-500">
            {docsUnread.length} other document{docsUnread.length === 1 ? '' : 's'} you hold were listed
            by title only, for this audit to say what is NOT among them. Their contents were not read here.
          </p>
        )}
        {run.readings_as_of && (
          <p className="mt-2 text-[12px] text-gray-500">Readings as of {fmt(run.readings_as_of)}</p>
        )}
        <p className="mt-1 text-[12px] text-gray-500">
          Company information as of {fmt(run.readings_as_of ?? run.created_at)}
        </p>
        <p className="mt-3 font-serif text-[15px] leading-relaxed text-gray-800">
          Every line below points at a document, or says what we do not see. None of it is a verdict
          on whether the company complies.
        </p>
      </Section_>

      {/* ── FINDINGS ─────────────────────────────────────────────────────── */}
      {plain.length > 0 && (
        <Section_ title="Findings" count={plain.length} open={!!open.findings}
          onToggle={() => setOpen((o) => ({ ...o, findings: !o.findings }))}>
          {plain.map((f) => (
            <div key={f.id}
              className={`border-b border-gray-100 py-3 last:border-b-0 ${
                focusWord && f.word === focusWord ? 'bg-amber-50/40' : ''}`}>
              <p className="text-[15px] text-gray-900">{f.title}</p>
              <p className="mt-0.5 text-[12px]">
                <span className={AMBER_WORD.has(f.word ?? '') ? 'text-[var(--amber)]' : 'text-gray-500'}>
                  {WORD[f.word ?? ''] ?? f.word}
                </span>
                {f.basis === 'inferred' && <span className="text-gray-400"> · worked out, not stated</span>}
                {f.document && (
                  <>
                    {' · '}
                    <button onClick={() => f.document_id && onOpenDoc(f.document_id)}
                      title={f.document.title}
                      className="cursor-pointer text-gray-600 hover:underline hover:text-gray-900">
                      {f.document.title}
                    </button>
                    {f.locator ? <span className="text-gray-500"> · {f.locator}</span> : null}
                  </>
                )}
                {/* A handle the block did not carry. The row was kept rather than dropped, so the
                    report says plainly that this one points at nothing. */}
                {f.handle_error && <span className="text-[var(--amber)]"> · we could not match this to a document</span>}
              </p>
              {f.quote && <p className="mt-1 text-[13px] italic text-gray-600">&ldquo;{f.quote}&rdquo;</p>}
              {f.what_to_do && <p className="mt-1 text-[13px] text-gray-700">{f.what_to_do}</p>}
              <div className="no-print mt-1.5 flex items-center gap-4">
                {f.word === 'nothing_on_file' && (
                  <a href={`/documents?add=${encodeURIComponent(f.title)}`}
                    className="text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">Add a document</a>
                )}
                <button onClick={() => setReasonFor(f.id)} className="text-[13px] text-gray-500 hover:text-gray-800">Not right</button>
              </div>
              {reasonFor === f.id && (
                <ReasonBox onCancel={() => setReasonFor(null)} onSave={(r) => dismiss(f.id, r)} />
              )}
            </div>
          ))}
          {dismissed.length > 0 && (
            <div className="mt-3">
              <p className="text-[12px] font-medium uppercase tracking-wide text-gray-400">Dismissed</p>
              {dismissed.map((f) => (
                <p key={f.id} className="mt-1 text-[12px] text-gray-500">
                  {f.title}{f.dismissed_reason ? ` — ${f.dismissed_reason}` : ''}
                </p>
              ))}
            </div>
          )}
        </Section_>
      )}

      {/* ── DATES ────────────────────────────────────────────────────────── */}
      {dates.length > 0 && (
        <Section_ title="Dates" count={dates.length} open={!!open.dates}
          onToggle={() => setOpen((o) => ({ ...o, dates: !o.dates }))}>
          {dates.map((f) => (
            <div key={f.id} className="flex items-start gap-3 border-b border-gray-100 py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-gray-900">{f.title}</p>
                <p className="mt-0.5 text-[12px] text-gray-500">
                  {fmt(f.due_on)}
                  {f.passed ? <span className="text-[var(--amber)]"> · passed</span> : ''}
                  {f.recurs ? ' · recurring' : ''}
                  {f.document ? ` · ${f.document.title}` : ''}
                </p>
              </div>
              <a href={`/calendar?add=${encodeURIComponent(f.title)}&on=${f.due_on ?? ''}`}
                className="no-print shrink-0 text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">
                Add to calendar
              </a>
            </div>
          ))}
        </Section_>
      )}

      {/* ── DISAGREEMENTS ────────────────────────────────────────────────── */}
      {contradictions.length > 0 && (
        <Section_ title="Disagreements between documents" count={contradictions.length} open={!!open.contradictions}
          onToggle={() => setOpen((o) => ({ ...o, contradictions: !o.contradictions }))}>
          {contradictions.map((f) => (
            <div key={f.id} className="border-b border-gray-100 py-3 last:border-b-0">
              <p className="text-[15px] text-gray-900">{f.title}</p>
              <p className="mt-1 text-[13px] text-gray-700">
                <button onClick={() => f.document_id && onOpenDoc(f.document_id)}
                  title={f.document?.title ?? undefined}
                  className="cursor-pointer hover:underline hover:text-gray-900">{f.document?.title ?? 'one document'}</button>
                {' says '}<span className="text-gray-900">{f.value_a}</span>
              </p>
              <p className="mt-0.5 text-[13px] text-gray-700">
                <button onClick={() => f.document_b_id && onOpenDoc(f.document_b_id)}
                  title={f.document_b?.title ?? undefined}
                  className="cursor-pointer hover:underline hover:text-gray-900">{f.document_b?.title ?? 'the other'}</button>
                {' says '}<span className="text-gray-900">{f.value_b}</span>
              </p>
              <p className="mt-1 text-[12px] text-gray-500">The audit shows both and does not pick one.</p>
              <a href="/company-information" className="no-print mt-1 inline-block text-[13px] text-[var(--green)] underline">
                Settle it on Company information
              </a>
            </div>
          ))}
        </Section_>
      )}

      {/* ── EXPECTED ─────────────────────────────────────────────────────── */}
      {expected.length > 0 && (
        <Section_ title="What we would expect and do not see · based on similar companies"
          count={expected.length} open={!!open.expected}
          onToggle={() => setOpen((o) => ({ ...o, expected: !o.expected }))}>
          {expected.map((f) => (
            <div key={f.id} className="border-b border-gray-100 py-2 last:border-b-0">
              <p className="text-[14px] text-gray-800">{f.title}</p>
              {f.what_to_do && <p className="mt-0.5 text-[12px] text-gray-500">{f.what_to_do}</p>}
            </div>
          ))}
        </Section_>
      )}

      {/* ── COULD NOT COMPLETE ───────────────────────────────────────────── */}
      {failed.length > 0 && (
        <Section_ title="Could not complete" count={failed.length} open={!!open.failed}
          onToggle={() => setOpen((o) => ({ ...o, failed: !o.failed }))}>
          {failed.map((s) => (
            <div key={s.id} className="border-b border-gray-100 py-2 last:border-b-0">
              <p className="text-[14px] text-gray-900">{s.title}</p>
              <p className="mt-0.5 text-[13px] text-gray-600">{s.could_not_complete_reason}</p>
              <button disabled={busy} onClick={async () => {
                setBusy(true)
                try {
                  const res = await fetch(`/api/audit-runs/${run.id}/sections/${s.id}/retry`, {
                    method: 'POST', headers: await authHeaders(),
                  })
                  const j = await res.json().catch(() => null)
                  setNotice(res.ok ? `Running ${s.title} again.` : (j?.error ?? 'We could not run that again.'))
                  await load(); onChanged()
                } finally { setBusy(false) }
              }} className="no-print mt-1 text-[13px] text-[var(--green)] underline disabled:text-gray-300">
                Run this section again
              </button>
            </div>
          ))}
        </Section_>
      )}

      {/* ── EARLIER AUDITS ───────────────────────────────────────────────── */}
      {earlier.length > 0 && (
        <Section_ title="Earlier audits" count={earlier.length} open={!!open.earlier}
          onToggle={() => setOpen((o) => ({ ...o, earlier: !o.earlier }))}>
          {earlier.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-b-0">
              <p className="min-w-0 flex-1 text-[13px] text-gray-700">
                {fmt(r.finished_at ?? r.created_at)}
                <span className="text-gray-500"> · {needsOf(r.summary)} needed you</span>
              </p>
              {/* Computed from closed_by_run_id, so it is a count of rows and not a claim. */}
              {r.id === run.previous_run_id && run.summary && (
                <p className="shrink-0 text-[12px] text-gray-500">
                  {run.summary.closed} of {run.summary.closed + run.summary.carried} findings
                  from {fmt(r.finished_at ?? r.created_at)} are closed
                </p>
              )}
              <a href={`/audits?run=${r.id}`} className="shrink-0 text-[13px] text-[var(--green)] underline">Open</a>
            </div>
          ))}
        </Section_>
      )}

      {/* ── THE PRINT'S LAST PAGE ────────────────────────────────────────── */}
      <div className="hidden print:block" style={{ breakBefore: 'page' }}>
        <h3 className="mb-2 mt-6 text-[12px] font-medium uppercase tracking-wide text-gray-700">
          Documents this audit read
        </h3>
        <ol className="space-y-1">
          {citationOrder(findings, docsRead).map((id, i) => {
            const cites = findings.filter((f) => f.document_id === id || f.document_b_id === id)
            const where = [...new Set(cites.map((f) => f.locator).filter(Boolean))]
            return (
              <li key={id} className="text-[12px] text-gray-700">
                {i + 1}. {titleOf(id) ?? 'a document that is no longer on file'}
                {where.length ? ` — ${where.join('; ')}` : ''}
              </li>
            )
          })}
        </ol>
      </div>
    </Drawer>
  )
}

/**
 * CITATION ORDER, AND IT IS THE ORDER THE FINDINGS ARE IN.
 *
 * The print's last page and the zip's index both number the documents the same way, so a printed
 * report and a downloaded folder can be read side by side. Documents a finding cites come first, in
 * the order they are first cited; documents the run read and never cited come after, so the list is
 * still complete.
 */
export function citationOrder(findings: Array<{ document_id: string | null; document_b_id: string | null }>,
                              read: string[]): string[] {
  const seen: string[] = []
  for (const f of findings) {
    for (const id of [f.document_id, f.document_b_id]) {
      if (id && !seen.includes(id)) seen.push(id)
    }
  }
  for (const id of read) if (!seen.includes(id)) seen.push(id)
  return seen
}
