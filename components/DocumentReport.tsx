'use client'

/**
 * THE REPORT DRAWER — Documents Run 4.
 *
 * A row on the Documents page opens this. It is the whole reading of one document: what it is,
 * what it says, what is wrong with it, the dates it sets, the conditions it imposes, the facts it
 * proposes, and how sure we were. The accordion Run 3 used as a placeholder is gone.
 *
 * *** EVERY ACTION HERE IS FREE. *** Nothing in this drawer calls a model. A person confirms a
 * fact, dismisses a gap, corrects what a document is, sends a date to the calendar — all of that
 * is a row changing state. "Make a checklist", "Draft this section" and "Research this" are the
 * actions that cost money and they are Run 5; they are not here, and they are not here as
 * disabled buttons either, because a greyed button that never lights up is a promise the product
 * is not keeping.
 *
 * *** SECTIONS APPEAR ONLY WHEN THEY HAVE CONTENT. *** An empty "Gaps" heading on a permit says
 * the permit was judged and found clean, which is not what happened — a permit is the agency's
 * document and has no gaps to find. The absence of a heading is the honest rendering.
 *
 * A DOCUMENT WE COULD NOT READ GETS THE REASON AND NOTHING ELSE. Not an empty report with eight
 * blank sections, which would assert that we looked and found nothing. `CLAUDE.md` §5.1.
 */

import { useState, useEffect, useCallback } from 'react'
import { authHeaders } from '@/lib/supabase'
import { Drawer, printDrawer } from '@/components/Drawer'
import { DRAFT_NOTICE } from '@/prompts/document-draft'

/* ── the shapes, as the report route returns them ─────────────────────────── */
interface Row {
  document_id: string; title: string; file_name: string; kind: string | null
  agencies: string[]; subjects: string[]; issuer: string | null
  site_name: string | null; entity_id: string | null; folder_name: string | null; folder_id: string | null
  doc_date: string | null; doc_date_kind: string | null
  significant_date: string | null; significant_date_kind: string | null
  scanned_at: string | null; uploaded_at: string; latest_confirmed_at: string | null
  scan_status: string | null; document_status: string; could_not_read_reason: string | null
  summary: string | null; version_of: string | null; version_confirmed: boolean
  scan_id: string | null; open_gap_count: number; display_status: string
}
interface Gap {
  id: string; ordinal: number; title: string; description: string | null; fix: string | null
  citation: string | null; citation_url: string | null; locator: string | null
  basis: string; quote: string | null; quote_verified: boolean | null
  status: string; dismissed_reason: string | null
  draftable: boolean; draft_text: string | null; draft_created_at: string | null
}
interface ChecklistLink {
  id: string; title: string; created_at: string
  document_gap_id: string | null; done: number; total: number
}
interface Condition { id: string; title: string; condition_ref: string | null; evidence_expected: string | null }
interface Deadline {
  id: string; title: string; due_on: string | null; source_line: string | null
  recurs: boolean; calendar_event_id: string | null
}
interface Fact {
  id: string; switch_key: string; proposed_value: string; quote: string | null
  locator: string | null; basis: string; status: string; rejected_reason: string | null
  quote_verified: boolean | null
}
interface Version {
  document_id: string; title: string; file_name: string; doc_date: string | null
  uploaded_at: string; version_of: string | null; version_confirmed: boolean
}
interface Scan {
  page_refs: Record<string, string> | null; jurisdiction: string[] | null
  model: string | null; searches: number | null; cited_sources: number | null
  scanned_at: string; confidence_notes: string | null
}
interface Report {
  row: Row; scan: Scan | null; gaps: Gap[]; conditions: Condition[]; deadlines: Deadline[]
  earlierGaps: Gap[]
  facts: Fact[]; corrections: Array<{ field: string; new_value: unknown; reason: string | null }>
  versions: Version[]; sites: Array<{ id: string; name: string }>
  labels: Array<{ kind: string; label: string }>
  checklists: ChecklistLink[]
}

const KIND_LABEL: Record<string, string> = {
  permit: 'Permit', certificate: 'Certificate', program: 'Program', policy: 'Policy',
  record: 'Record', supplier_document: 'Supplier document', other: 'Other',
}
const STATUS_WORD: Record<string, string> = {
  needs_work: 'Needs work', expiring: 'Expiring', expired: 'Expired',
  could_not_read: 'Could not read', not_yet_read: 'Not yet read',
  current: 'Current', recorded: 'Recorded', on_file: 'On file',
}
const AMBER = new Set(['needs_work', 'expiring', 'expired', 'could_not_read'])
const DATE_LABEL: Record<string, string> = {
  expiry: 'Expires', revised: 'Revised', revised_on: 'Revised', last_entry: 'Last entry',
  serviced: 'Serviced', renewal: 'Renewal', effective: 'Effective', issued: 'Issued',
}
const KINDS = ['permit', 'certificate', 'program', 'policy', 'record', 'supplier_document', 'other']

const fmt = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso))
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
const yearsSince = (iso: string | null) => {
  if (!iso) return 0
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
}
const isPast = (iso: string | null) => !!iso && iso < new Date().toISOString().slice(0, 10)

/* ── small pieces ─────────────────────────────────────────────────────────── */
/**
 * A SECTION HEADING, AND ITS COLOUR CARRIES A DISTINCTION — Run 6 addendum.
 *
 * A heading that NAMES a part of the report — Gaps, Conditions to keep, Facts we found — is
 * structure: it tells you where you are, and you read down from it. A heading that carries a
 * STATE or a DATE is itself information, and the thing under it repeats it.
 *
 * So the naming ones take the darker grey of body text and the state ones stay light. Same
 * 12px uppercase either way: this is weight, not a second heading style. `DESIGN.md` §4.
 */
function Section({ title, children, tone = 'name' }: {
  title: string; children: React.ReactNode; tone?: 'name' | 'state'
}) {
  return (
    <section className="mt-6 border-t border-gray-100 pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className={`mb-2 text-[12px] font-medium uppercase tracking-wide ${
        tone === 'state' ? 'text-gray-400' : 'text-gray-700'}`}>{title}</h3>
      {children}
    </section>
  )
}
/** "inferred" after a title, so a worked-out finding never reads as a quoted one. */
const Inferred = ({ basis }: { basis: string }) =>
  basis === 'inferred' ? <span className="ml-1.5 text-[12px] font-normal text-gray-400">inferred</span> : null

function ReasonBox({ label, onCancel, onSave }: {
  label: string; onCancel: () => void; onSave: (reason: string) => void
}) {
  const [text, setText] = useState('')
  return (
    <div className="mt-2 rounded-lg bg-gray-50 p-2.5">
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2}
        placeholder={label}
        className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-[13px]" />
      <div className="mt-1.5 flex items-center gap-3">
        {/* A REASON IS REQUIRED, and the button says so by being unusable without one. The next
            scan is shown this sentence; an empty one teaches it nothing. */}
        <button disabled={!text.trim()} onClick={() => onSave(text.trim())}
          className="text-[13px] text-[var(--green)] disabled:text-gray-300">Save</button>
        <button onClick={onCancel} className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
      </div>
    </div>
  )
}

/**
 * WHERE THIS FILE IS FILED, AND THE ONE PLACE IT CAN BE CHANGED.
 *
 * A folder is where a person put a file; everything else on this screen is what the scan
 * found. That makes filing the odd one out and the reason it reads as a line of prose with a
 * control in it rather than as another row of the identity grid: "Filed in ▾ Permits".
 *
 * It does not print — where a document is filed is not part of the evidence.
 */
function FilingLine({ row, folders, onMove, onChanged }: {
  row: Row
  folders: Array<{ id: string; name: string }>
  onMove: (documentId: string, folderId: string | null) => Promise<void> | void
  onChanged: () => void
}) {
  const [saving, setSaving] = useState(false)
  return (
    <p className="no-print -mt-1 mb-4 flex items-center gap-1.5 text-[12px] text-gray-500">
      Filed in
      <select
        value={row.folder_id ?? ''}
        disabled={saving}
        onChange={async (e) => {
          setSaving(true)
          try { await onMove(row.document_id, e.target.value || null); onChanged() }
          finally { setSaving(false) }
        }}
        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-[12px] text-gray-700 hover:border-gray-200 disabled:text-gray-300">
        <option value="">Nothing yet</option>
        {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </p>
  )
}

/* ── the drawer ───────────────────────────────────────────────────────────── */
export default function DocumentReport({
  documentId, companyName, onClose, onChanged, onPickFile, folders, onMove,
}: {
  documentId: string
  companyName: string | null
  onClose: () => void
  /** The page reloads its index when something here changes a value it shows. */
  onChanged: () => void
  /**
   * FILING LIVES HERE NOW, ONCE — Run 6 addendum, reversing Run 4.
   *
   * Run 4 kept "Move to…" on the row, reasoning that filing is a list action you do while
   * looking at several documents. In practice it put a form control in every row of a reading
   * surface: a list of documents with a dropdown on each line reads as a form, and the thing
   * you are scanning for — the title, the agency, the status — competes with a widget nobody
   * touches most days. The list is back to three columns and the control is here.
   *
   * The folder list and the move itself belong to the page, which already holds both; passing
   * them in avoids a second query for a list the caller has in hand.
   */
  folders: Array<{ id: string; name: string }>
  onMove: (documentId: string, folderId: string | null) => Promise<void> | void
  /** Opens the page's own file picker — used by "Upload a clearer copy" and "Add a newer version". */
  onPickFile: (versionOf?: string) => void
}) {
  const [r, setR] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [reasonFor, setReasonFor] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ kind: string; agencies: string; subjects: string; site: string; doc_date: string }>(
    { kind: '', agencies: '', subjects: '', site: '', doc_date: '' })
  /** The gap a model call is running for, so only that row says "Working…". */
  const [working, setWorking] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  /** The delete confirmation, shown in the drawer rather than as a browser dialog. */
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/report?document_id=${documentId}`, { headers: await authHeaders() })
    if (!res.ok) return
    const json: Report = await res.json()
    setR(json)
    setEdit({
      kind: json.row.kind ?? '',
      agencies: (json.row.agencies ?? []).join(', '),
      subjects: (json.row.subjects ?? []).join(', '),
      site: json.row.entity_id ?? '',
      doc_date: json.row.doc_date ?? '',
    })
  }, [documentId])
  useEffect(() => { load() }, [load])

  async function act(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch('/api/document-actions', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ document_id: documentId, ...body }),
      })
      await load()
      onChanged()
      return res.ok ? await res.json() : null
    } finally { setBusy(false) }
  }

  /**
   * *** THE SAME ROUTE THE To confirm PAGE USES. ***
   * A fact confirmed here and the same fact confirmed there are one row changing state, so
   * neither place can disagree with the other and nobody confirms twice. It also means the
   * destination logic — a key naming a switch goes through the declared-fact path, anything else
   * to company_facts — lives once rather than in whichever screen was written first.
   */
  async function verdictOnFact(factId: string, verdict: 'accepted' | 'rejected', reason?: string) {
    setBusy(true); setNotice(null)
    try {
      const res = await fetch('/api/to-confirm', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ proposal_id: factId, verdict, reason }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not save that just now.'); return }
      if (verdict === 'accepted') {
        setNotice(j.wrote === 'company_switches'
          ? 'Confirmed, and recorded against the question it answers.'
          : 'Confirmed.')
      }
      await load(); onChanged()
    } finally { setBusy(false) }
  }

  async function runChecklist(what: { gap_id?: string; all?: boolean }) {
    setWorking(what.gap_id ?? 'all'); setNotice(null)
    try {
      const res = await fetch('/api/document-checklist', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ document_id: documentId, ...what }),
      })
      const j = await res.json().catch(() => null)
      // §5.1: a refusal is a sentence a person can act on, not a silent nothing.
      if (!res.ok) { setNotice(j?.error ?? 'We could not make a checklist just now.'); return }
      setNotice(`Checklist made: ${j.title} — ${j.counts.must_do} to do, ${j.counts.good_to_have} worth doing.`)
      await load(); onChanged()
    } finally { setWorking(null) }
  }

  async function runDraft(gapId: string) {
    setWorking(`draft-${gapId}`); setNotice(null)
    try {
      const res = await fetch('/api/document-draft', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ document_id: documentId, gap_id: gapId }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not write that draft just now.'); return }
      // SAID OUT LOUD WHEN IT REPLACED SOMETHING, rather than swapping the text under somebody
      // who may have been half way through copying it.
      setNotice(j.replaced ? 'This draft replaced the one that was here before.' : null)
      await load()
    } finally { setWorking(null) }
  }

  if (!r) {
    return <Drawer title="Reading…" onClose={onClose} company={companyName}>
      <p className="text-[14px] text-gray-400">Opening the report.</p>
    </Drawer>
  }

  const { row, scan } = r
  const kind = row.kind
  const isProgram = kind === 'program' || kind === 'policy'
  const isPermit = kind === 'permit' || kind === 'certificate'
  const openGaps = r.gaps.filter((g) => g.status !== 'dismissed')
  const dismissed = r.gaps.filter((g) => g.status === 'dismissed')

  const sub = [
    kind ? (KIND_LABEL[kind] ?? kind) : null,
    row.agencies?.join(' · ') || null,
    row.site_name,
    row.file_name,
    row.scanned_at ? `read ${fmt(row.scanned_at)}` : null,
  ].filter(Boolean).join(' · ')

  const footer = (
    <>
      {/* THE ONE OUTLINED BUTTON, and the only one this run has. DESIGN.md §4: one primary or
          outlined action, everything else a text action. */}
      {isProgram && openGaps.length > 0 && (
        <button disabled={!!working} onClick={() => runChecklist({ all: true })}
          className="rounded-lg border border-[var(--green)] px-3.5 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-[var(--green-wash)] disabled:border-gray-200 disabled:text-gray-300">
          {working === 'all' ? 'Working…' : `Make a checklist for all ${openGaps.length} gaps`}
        </button>
      )}
      <button onClick={async () => {
        const j = await act({ action: 'file_url' })
        if (j?.url) window.open(j.url, '_blank', 'noopener')
      }} className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Open the file</button>
      <button disabled={busy} onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/document-scan', {
            method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ document_id: documentId }),
          })
          await load(); onChanged()
        } finally { setBusy(false) }
      }} className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300">
        {busy ? 'Working…' : 'Read it again'}
      </button>
      <button onClick={printDrawer}
        className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Download</button>
      {/* DESTRUCTIVE, AND IT LOOKS IT — 12px and faint (`DESIGN.md` §1, §4). It is the only
          irreversible action in the product's reading surface, so it is the quietest thing in
          the footer and it asks first. */}
      <button onClick={() => setConfirmDelete(true)}
        className="text-[12px] text-gray-400 hover:text-gray-700 hover:underline">Delete this file</button>
    </>
  )

  /**
   * THE CONFIRMATION, AND IT SAYS WHAT SURVIVES — Run 6 addendum.
   *
   * Not `window.confirm`: a browser dialog cannot say the second sentence, and the second
   * sentence is the whole point. Somebody who made a checklist from this document's gaps three
   * weeks ago is entitled to know, BEFORE they press the button, that the checklist is not about
   * to go with it. The schema already guarantees it — `checklists.document_id`,
   * `calendar_events.document_id` and `company_facts.source_document_id` are all `on delete set
   * null`, while the scans, gaps, deadlines, conditions and proposals cascade — so this sentence
   * is a description of what happens, not a promise somebody has to keep in code.
   *
   * The server proves ownership before it touches anything: `/api/documents` DELETE loads the
   * row through the caller's own client, compares its company to the session's, answers 404
   * rather than 403 so ids cannot be probed, and takes the storage path off the row it just
   * authorised rather than off the request.
   */
  const deletePanel = confirmDelete ? (
    <div className="no-print absolute inset-0 z-10 flex items-center justify-center bg-gray-900/30 px-6"
      onClick={() => setConfirmDelete(false)}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-medium text-gray-900">Delete this file and its reading?</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">
          Checklists made from it stay, with their link to it removed.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <button disabled={busy} onClick={async () => {
            setBusy(true)
            try {
              const res = await fetch(`/api/documents?id=${documentId}`, {
                method: 'DELETE', headers: await authHeaders(),
              })
              if (!res.ok) {
                const j = await res.json().catch(() => null)
                setConfirmDelete(false)
                setNotice(j?.error ?? 'We could not delete that just now. Nothing was removed.')
                return
              }
              // The row is gone, so there is nothing left for this drawer to show.
              onChanged()
              onClose()
            } finally { setBusy(false) }
          }} className="rounded-lg bg-[var(--amber)] px-3.5 py-1.5 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50">
            {busy ? 'Deleting…' : 'Delete'}
          </button>
          <button onClick={() => setConfirmDelete(false)}
            className="text-[14px] text-gray-600 hover:text-gray-900">Keep it</button>
        </div>
      </div>
    </div>
  ) : null

  /* ── a document we could not read: the reason, the way forward, nothing else ── */
  if (row.display_status === 'could_not_read') {
    return (
      <Drawer title={row.title} sub={sub} company={companyName} onClose={onClose} footer={footer}>
        {deletePanel}
        <FilingLine row={row} folders={folders} onMove={onMove} onChanged={onChanged} />
        <p className="text-[13px] text-[var(--amber)]">Could not read</p>
        <p className="mt-3 font-serif text-[17px] leading-relaxed text-gray-800">
          {row.could_not_read_reason
            || 'We could not read this clearly enough to rely on.'}
        </p>
        <button onClick={() => onPickFile()}
          className="mt-4 text-[14px] text-gray-600 underline hover:text-gray-900">Upload a clearer copy</button>
      </Drawer>
    )
  }

  /* ── the nudge, and it is the only thing that generates one ─────────────── */
  const stale = isProgram && !row.latest_confirmed_at && yearsSince(row.doc_date) > 3
  const passedDeadline = isPermit
    ? r.deadlines.find((d) => !d.recurs && isPast(d.due_on)) : undefined

  const identity: Array<[string, string, string | null]> = [
    ['Kind', kind ? (KIND_LABEL[kind] ?? kind) : '—', scan?.page_refs?.kind ?? null],
    ['Issuer', row.issuer ?? '—', scan?.page_refs?.issuer ?? null],
    ['Agency', row.agencies?.join(' · ') || '—', scan?.page_refs?.agencies ?? null],
    ['Subject', row.subjects?.join(' · ') || '—', null],
    ['Site', row.site_name ?? 'Company-wide', scan?.page_refs?.site ?? null],
    ['Jurisdiction', (scan?.jurisdiction ?? []).join(' · ') || '—', null],
    ['Document date', row.doc_date
      ? `${fmt(row.doc_date)}${row.doc_date_kind ? ` (${row.doc_date_kind.replace(/_/g, ' ')})` : ''}`
      : '—', scan?.page_refs?.doc_date ?? null],
  ]

  return (
    <Drawer title={row.title} sub={sub} company={companyName} onClose={onClose} footer={footer}>
      {deletePanel}
      {notice && (
        <p className="mb-4 rounded-lg bg-[var(--green-wash)] px-3 py-2 text-[13px] text-gray-800">{notice}</p>
      )}

      {/* THE HEADER AREA'S ONE CONTROL — filing, which is the only thing about a document that
          is the person's choice rather than the reading's finding. */}
      <FilingLine row={row} folders={folders} onMove={onMove} onChanged={onChanged} />

      {/* 1 ── status and the date that matters, on one line */}
      <Section title="Status" tone="state">
        <p className="text-[14px]">
          <span className={AMBER.has(row.display_status) ? 'text-[var(--amber)]' : 'text-gray-700'}>
            {STATUS_WORD[row.display_status] ?? row.display_status}
          </span>
          {isProgram && openGaps.length > 0 && (
            <span className="text-gray-500"> · {openGaps.length} gap{openGaps.length === 1 ? '' : 's'}</span>
          )}
          {row.significant_date && (
            <span className="text-gray-500">
              {' '}· {(row.significant_date_kind && DATE_LABEL[row.significant_date_kind]) ?? 'Date'} {fmt(row.significant_date)}
            </span>
          )}
        </p>
      </Section>

      {/* 2 ── the summary, in the serif, because it is read rather than scanned */}
      {row.summary && (
        <Section title="What this says">
          <p className="font-serif text-[17px] leading-relaxed text-gray-800">{row.summary}</p>
        </Section>
      )}

      {/* 3 ── the nudge. Amber wash, and always with the way forward. */}
      {stale && (
        <div className="mt-6 rounded-lg bg-[var(--amber-wash)] px-3.5 py-3">
          <p className="text-[14px] text-gray-800">
            This document is {Math.floor(yearsSince(row.doc_date))} years old. If there is a newer
            version, add it.
          </p>
          <div className="mt-2 flex items-center gap-4">
            <button onClick={() => onPickFile(documentId)}
              className="text-[14px] text-gray-700 underline hover:text-gray-900">Add a newer version</button>
            <button onClick={() => act({ action: 'confirm_latest' })}
              className="text-[14px] text-gray-700 underline hover:text-gray-900">This is the latest</button>
          </div>
        </div>
      )}
      {passedDeadline && (
        <div className="mt-6 rounded-lg bg-[var(--amber-wash)] px-3.5 py-3">
          <p className="text-[14px] text-gray-800">
            This date has passed: {passedDeadline.title} was due {fmt(passedDeadline.due_on)}.
          </p>
        </div>
      )}

      {/* 4 ── what this document is, and the one link that lets a person disagree */}
      <Section title="What this document is">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          {identity.map(([label, value, page]) => (
            <div key={label}>
              <dt className="text-[12px] text-gray-400">{label}</dt>
              <dd className="text-[13px] text-gray-800">
                {value}
                {page && <span className="ml-1.5 text-[12px] text-gray-400">{page}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {r.corrections.length > 0 && (
          <p className="mt-2 text-[12px] text-gray-500">
            {r.corrections.length} of these {r.corrections.length === 1 ? 'was' : 'were'} corrected by
            somebody here; the scan said otherwise.
          </p>
        )}
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="mt-2 text-[13px] text-gray-600 underline hover:text-gray-900">
            Not right? Change what this is
          </button>
        ) : (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[12px] text-gray-500">Kind
                <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}
                  className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-[13px]">
                  {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="text-[12px] text-gray-500">Site
                <select value={edit.site} onChange={(e) => setEdit({ ...edit, site: e.target.value })}
                  className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-[13px]">
                  <option value="">Company-wide</option>
                  {r.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="text-[12px] text-gray-500">Agencies
                <input list="cb-agency-labels" value={edit.agencies}
                  onChange={(e) => setEdit({ ...edit, agencies: e.target.value })}
                  className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-[13px]" />
                {/* The company's OWN labels are offered, so a correction does not create the
                    second spelling of an agency the whole label list exists to prevent. */}
                <datalist id="cb-agency-labels">
                  {r.labels.filter((l) => l.kind === 'agency').map((l) => <option key={l.label} value={l.label} />)}
                </datalist>
              </label>
              <label className="text-[12px] text-gray-500">Subjects
                <input list="cb-subject-labels" value={edit.subjects}
                  onChange={(e) => setEdit({ ...edit, subjects: e.target.value })}
                  className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-[13px]" />
                <datalist id="cb-subject-labels">
                  {r.labels.filter((l) => l.kind === 'subject').map((l) => <option key={l.label} value={l.label} />)}
                </datalist>
              </label>
              <label className="text-[12px] text-gray-500">Document date
                <input type="date" value={edit.doc_date}
                  onChange={(e) => setEdit({ ...edit, doc_date: e.target.value })}
                  className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-[13px]" />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button disabled={busy} onClick={async () => {
                // ONE CORRECTION ROW PER FIELD THAT ACTUALLY CHANGED, each carrying what it
                // replaced. A row for a field nobody touched would be noise in the record the
                // next scan reads.
                const list: Array<[string, unknown, unknown]> = []
                const lst = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
                if (edit.kind && edit.kind !== row.kind) list.push(['kind', row.kind, edit.kind])
                if (lst(edit.agencies).join('|') !== (row.agencies ?? []).join('|'))
                  list.push(['agencies', row.agencies ?? [], lst(edit.agencies)])
                if (lst(edit.subjects).join('|') !== (row.subjects ?? []).join('|'))
                  list.push(['subjects', row.subjects ?? [], lst(edit.subjects)])
                if ((edit.site || null) !== (row.entity_id || null))
                  list.push(['site', row.entity_id, edit.site || null])
                if ((edit.doc_date || null) !== (row.doc_date || null))
                  list.push(['doc_date', row.doc_date, edit.doc_date || null])
                for (const [field, oldV, newV] of list) {
                  await act({ action: 'correct', field, old_value: oldV, new_value: newV })
                }
                setEditing(false)
              }} className="text-[13px] text-[var(--green)] disabled:text-gray-300">Save</button>
              <button onClick={() => setEditing(false)}
                className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* 5 ── gaps, for programs and policies only */}
      {isProgram && (openGaps.length > 0 || dismissed.length > 0 || (r.earlierGaps ?? []).length > 0) && (
        <Section title="Gaps">
          <ol className="space-y-4">
            {openGaps.map((g, i) => (
              <li key={g.id}>
                <p className="text-[14px] font-medium text-gray-900">
                  {i + 1}. {g.title}<Inferred basis={g.basis} />
                </p>
                {g.description && <p className="mt-0.5 text-[13px] leading-relaxed text-gray-700">{g.description}</p>}
                {g.fix && <p className="mt-1 text-[13px] leading-relaxed text-gray-700"><span className="text-gray-400">Fix. </span>{g.fix}</p>}
                <p className="mt-1 text-[12px] text-gray-500">
                  {g.citation && (g.citation_url
                    ? <a href={g.citation_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-800">{g.citation}</a>
                    : <span>{g.citation}</span>)}
                  {g.citation && g.locator && ' · '}
                  {g.locator}
                </p>
                {/* THE CHECKLIST MADE FROM THIS GAP, with its progress read live off the items.
                    "checklist made 17 Sep · 2 of 5 done" weeks later is the point of the link. */}
                {r.checklists.filter((c) => c.document_gap_id === g.id).map((c) => (
                  <p key={c.id} className="mt-1 text-[12px] text-gray-500">
                    <a href={`/compliance?checklist=${c.id}`} className="underline hover:text-gray-800">{c.title}</a>
                    {' '}· checklist made {fmt(c.created_at)} · {c.done} of {c.total} done
                  </p>
                ))}

                {g.draft_text && (
                  <div className="mt-2 rounded-lg bg-gray-50 p-3">
                    <p className="text-[12px] text-gray-500">{DRAFT_NOTICE}</p>
                    <pre className="mt-2 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-gray-800">{g.draft_text}</pre>
                    <div className="mt-2 flex items-center gap-3 text-[12px]">
                      <button onClick={() => { navigator.clipboard?.writeText(g.draft_text ?? ''); setCopied(g.id) }}
                        className="text-[var(--green)]">{copied === g.id ? 'Copied' : 'Copy'}</button>
                      <span className="text-gray-400">drafted {fmt(g.draft_created_at)}</span>
                    </div>
                  </div>
                )}

                {reasonFor === g.id ? (
                  <ReasonBox label="Why is this not right?" onCancel={() => setReasonFor(null)}
                    onSave={async (reason) => { await act({ action: 'dismiss_gap', gap_id: g.id, reason }); setReasonFor(null) }} />
                ) : (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px]">
                    {/* E in the design puts the actions under the gap they belong to. */}
                    <button disabled={!!working} onClick={() => runChecklist({ gap_id: g.id })}
                      className="text-gray-600 underline hover:text-gray-900 disabled:text-gray-300">
                      {working === g.id ? 'Working…' : 'Make a checklist'}
                    </button>
                    {/* ONLY WHEN THE SCAN SAID THE TEXT COULD BE WRITTEN. A gap needing their
                        floor plan is not one we can draft, and offering it would be a promise
                        the route then refuses. */}
                    {g.draftable && (
                      <button disabled={!!working} onClick={() => runDraft(g.id)}
                        className="text-gray-600 underline hover:text-gray-900 disabled:text-gray-300">
                        {working === `draft-${g.id}` ? 'Writing…' : (g.draft_text ? 'Draft it again' : 'Draft this section')}
                      </button>
                    )}
                    <button onClick={() => {
                      const q = [g.title, g.fix].filter(Boolean).join('. ')
                      window.location.href = `/compliance?ask=${encodeURIComponent(q)}&document=${documentId}`
                    }} className="text-gray-600 underline hover:text-gray-900">Research this</button>
                    <button onClick={() => setReasonFor(g.id)}
                      className="text-gray-500 underline hover:text-gray-800">Not right</button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {/* A GAP FROM AN EARLIER READING THAT STILL CARRIES WORK. The new scan did not raise
              it — the model changed its mind, or renamed it past matching — and the checklist
              somebody has been working through does not vanish because of that. */}
          {(r.earlierGaps ?? []).length > 0 && (
            <div className="mt-5">
              <h4 className="text-[12px] font-medium uppercase tracking-wide text-gray-400">From earlier readings</h4>
              <ul className="mt-2 space-y-2">
                {r.earlierGaps.map((g) => (
                  <li key={g.id}>
                    <p className="text-[13px] text-gray-600">{g.title}</p>
                    {r.checklists.filter((c) => c.document_gap_id === g.id).map((c) => (
                      <p key={c.id} className="text-[12px] text-gray-500">
                        <a href={`/compliance?checklist=${c.id}`} className="underline hover:text-gray-800">{c.title}</a>
                        {' '}· checklist made {fmt(c.created_at)} · {c.done} of {c.total} done
                      </p>
                    ))}
                    <p className="text-[12px] text-gray-400">The latest reading did not raise this.</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dismissed.length > 0 && (
            // CLOSED, NEVER DELETED, WITH THE REASON. The next scan is shown these so it does
            // not raise them again, and a person can see what was decided and why.
            <div className="mt-5">
              <h4 className="text-[12px] font-medium uppercase tracking-wide text-gray-400">Dismissed</h4>
              <ul className="mt-2 space-y-2">
                {dismissed.map((g) => (
                  <li key={g.id}>
                    <p className="text-[13px] text-gray-500 line-through">{g.title}</p>
                    {g.dismissed_reason && <p className="text-[12px] text-gray-500">You said: {g.dismissed_reason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* 6 ── the dates this document sets */}
      {r.deadlines.length > 0 && (
        <Section title="Dates this document sets">
          <ul className="space-y-3">
            {r.deadlines.map((d) => {
              const past = !d.recurs && isPast(d.due_on)
              return (
                <li key={d.id}>
                  <p className="text-[13px] text-gray-900">
                    {d.title}
                    {d.due_on && <span className="text-gray-500"> · {fmt(d.due_on)}</span>}
                    {d.recurs && <span className="text-gray-400"> · repeats</span>}
                    {past && <span className="text-[var(--amber)]"> · Passed</span>}
                  </p>
                  {d.source_line && <p className="mt-0.5 text-[12px] text-gray-500">{d.source_line}</p>}
                  {d.calendar_event_id
                    ? <p className="mt-0.5 text-[12px] text-gray-400">In your calendar</p>
                    : d.due_on && (
                      <button disabled={busy} onClick={() => act({ action: 'deadline_to_calendar', deadline_id: d.id })}
                        className="mt-0.5 text-[12px] text-gray-600 underline hover:text-gray-900 disabled:text-gray-300">
                        Add to calendar
                      </button>
                    )}
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {/* 7 ── conditions, for permits and certificates */}
      {isPermit && r.conditions.length > 0 && (
        <Section title="Conditions to keep">
          <ul className="space-y-3">
            {r.conditions.map((c) => (
              <li key={c.id}>
                <p className="text-[13px] text-gray-900">
                  {c.condition_ref && <span className="text-gray-400">{c.condition_ref} </span>}{c.title}
                </p>
                {c.evidence_expected && (
                  <p className="mt-0.5 text-[12px] text-gray-500">
                    Evidence: {c.evidence_expected}{' '}
                    <button onClick={() => onPickFile()} className="underline hover:text-gray-800">Add the log</button>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 8 ── facts, proposed and never written silently (§108) */}
      {r.facts.length > 0 && (
        <Section title="Facts we found, please confirm">
          <ul className="space-y-3">
            {r.facts.map((f) => (
              <li key={f.id}>
                <p className="text-[13px] text-gray-900">
                  {f.switch_key.replace(/_/g, ' ')}: {f.proposed_value}<Inferred basis={f.basis} />
                </p>
                {f.quote && (
                  <p className="mt-0.5 text-[12px] italic text-gray-500">
                    “{f.quote}”{f.locator ? ` — ${f.locator}` : ''}
                  </p>
                )}
                {/* KEPT AND FLAGGED, NEVER DROPPED. A paraphrase a person can see is worth more
                    than a quote that vanished with no trace of why.

                    *** AND THE POSITIVE IS SHOWN NOW TOO — Run 6. *** Until this run the check
                    returned null for every document, because the text it compared against was
                    empty on any PDF, so there was only one state to draw and nothing to
                    distinguish. There are three states now and a verified row must not look like
                    an unchecked one (§6). Grey, not green: the words being in the file says
                    nothing about whether the fact is right, and a green tick would imply it did.

                    NULL DRAWS NOTHING, deliberately. A photograph of a page has no text to check
                    against, and saying either sentence about it would be a claim we cannot
                    support in either direction. */}
                {f.quote && f.quote_verified === true && (
                  <p className="text-[12px] text-gray-400">these words are in the file</p>
                )}
                {f.quote_verified === false && (
                  <p className="text-[12px] text-[var(--amber)]">quote not found in the file</p>
                )}
                {f.status === 'proposed' ? (
                  reasonFor === f.id ? (
                    <ReasonBox label="Why is this not right?" onCancel={() => setReasonFor(null)}
                      onSave={async (reason) => { await verdictOnFact(f.id, 'rejected', reason); setReasonFor(null) }} />
                  ) : (
                    <div className="mt-1 flex items-center gap-3">
                      <button disabled={busy} onClick={() => verdictOnFact(f.id, 'accepted')}
                        className="text-[12px] text-[var(--green)] disabled:text-gray-300">Confirm</button>
                      <button onClick={() => setReasonFor(f.id)}
                        className="text-[12px] text-gray-500 underline hover:text-gray-800">Not right</button>
                    </div>
                  )
                ) : (
                  <p className="mt-0.5 text-[12px] text-gray-400">
                    {f.status === 'accepted' ? 'Confirmed' : 'Not right'}
                    {f.rejected_reason ? ` — you said: ${f.rejected_reason}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 9 ── versions */}
      {r.versions.length > 1 && (
        <Section title="Versions">
          <ul className="space-y-2">
            {r.versions.map((v) => (
              <li key={v.document_id} className="text-[13px] text-gray-800">
                {v.title}
                <span className="text-[12px] text-gray-500">
                  {v.doc_date ? ` · ${fmt(v.doc_date)}` : ''} · added {fmt(v.uploaded_at)}
                  {v.document_id === documentId ? ' · This version' : ' · Superseded'}
                </span>
              </li>
            ))}
          </ul>
          {row.version_of && !row.version_confirmed && (
            <div className="mt-2 flex items-center gap-3">
              <p className="text-[12px] text-gray-500">We think this is a newer version of one of those.</p>
              <button disabled={busy} onClick={() => act({ action: 'version', verdict: 'same' })}
                className="text-[12px] text-[var(--green)] disabled:text-gray-300">Same document</button>
              <button disabled={busy} onClick={() => act({ action: 'version', verdict: 'not_same' })}
                className="text-[12px] text-gray-500 underline hover:text-gray-800">Not the same document?</button>
            </div>
          )}
        </Section>
      )}

      {/* 10 ── the quiet last line */}
      <p className="mt-8 border-t border-gray-100 pt-3 text-[12px] leading-relaxed text-gray-400">
        Read on {fmt(row.scanned_at)}. Quotes are word for word from the document and anything we
        worked out is marked inferred.{' '}
        {scan?.searches != null ? `${scan.searches} source${scan.searches === 1 ? '' : 's'} looked up. ` : ''}
        Read by {scan?.model ?? 'a model'}. Not legal advice.
      </p>
    </Drawer>
  )
}
