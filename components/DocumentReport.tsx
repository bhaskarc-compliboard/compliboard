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

import type React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { authHeaders } from '@/lib/supabase'
import { Drawer, printDrawer } from '@/components/Drawer'
import { DRAFT_NOTICE } from '@/prompts/document-draft'

import type { Banner } from '@/lib/billing'
import PausedNote from '@/components/PausedNote'
import { CARD_SITUATION, CARD_APPLIES, CARD_CONFIRM, CARD_QUIET, TINT_AMBER } from '@/lib/reportPalette'
import { documentName } from '@/lib/documentName'
import {
  DOC_CARD_SAYS, DOC_CARD_GAPS, DOC_CARD_NOTES, DOC_CARD_DATES, DOC_CARD_WHAT, DOC_CARD_FACTS,
  DOC_CARD_CONDITIONS, DOC_CARD_VERSIONS, notesNoticed, factsWaiting, datesSummary, whatItIsSummary,
  SCANNED_PAGES, CHANGE_WHAT_THIS_IS, CONFIRM_ON_COMPANY,
} from '@/lib/documentsWords'
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
  /** Set when a later reading neither raised this finding nor named it — Run 7. */
  not_seen_at: string | null
}
interface ChecklistLink {
  id: string; title: string; created_at: string
  document_gap_id: string | null; done: number; total: number
}
interface Condition { id: string; title: string; condition_ref: string | null; evidence_expected: string | null }
interface Deadline {
  id: string; title: string; due_on: string | null; source_line: string | null
  recurs: boolean; calendar_event_id: string | null
  /**
   * The calendar row this date is, embedded by `app/api/documents/report/route.ts` through the
   * `calendar_event_id` foreign key (Calendar step 6). `null` only while a date has not been filed
   * — an undated one-off, which 073's CHECK refuses on the calendar and which this drawer therefore
   * still shows with the words it always had.
   */
  calendar_events: { id: string; status: string } | null
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
  /** D3: both already arrive — `/api/documents/report` selects `*` from `document_scans`. */
  quotes_checked: number | null; extracted_text: string | null
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
/**
 * *** ONE CARD OF THE READING — decision 72, 5 November 2026; `docs/documents-boards.html`. ***
 *
 * The same partition the summary report uses (`components/ReportView.tsx`, decision 62): a
 * coloured left edge, a tinted header, a one-line summary ON the header so a folded card still
 * says what is inside it, and a body that folds. The reading was nine sections stacked flat and
 * three printed pages; it is six cards now, two of them open.
 *
 * *** PRINT OPENS EVERYTHING. *** A folded body carries `fold-closed`, which the print rule in
 * `app/globals.css` shows — the same mechanism the summary uses, so paper and screen cannot
 * drift apart.
 */
function Card({ tint, title, summary, open, onToggle, controls, children }: {
  tint: string; title: string; summary?: React.ReactNode
  open: boolean; onToggle?: () => void; controls: string; children: React.ReactNode
}) {
  const head = (
    <>
      {onToggle && (
        <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`no-print shrink-0 opacity-60 transition-transform ${open ? 'rotate-90' : ''}`}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      )}
      <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.05em]">{title}</span>
      {summary && <span className="min-w-0 text-[12px] font-normal opacity-80">{summary}</span>}
    </>
  )
  return (
    <section className="mt-3.5 overflow-hidden rounded-[10px] border border-gray-200 bg-white first:mt-0">
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={controls}
          className={`print-tint flex w-full items-center gap-2.5 border-l-4 px-3.5 py-2.5 text-left ${tint}`}>
          {head}
        </button>
      ) : (
        <div className={`print-tint flex items-center gap-2.5 border-l-4 px-3.5 py-2.5 ${tint}`}>{head}</div>
      )}
      <div id={controls} className={`px-3.5 pb-3 pt-2 ${open ? '' : 'fold-closed'}`}>{children}</div>
    </section>
  )
}

/* `Section` — the flat heading this drawer used for every part — is gone with decision 72:
   every part is a `Card` now, folded or open, in the summary report's own partition style. */

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
  documentId, companyName, onClose, onChanged, onPickFile, folders, onMove, topLine, paused = null,
}: {
  documentId: string
  companyName: string | null
  /**
   * Step 18, decision 11. A PROP and not a read of its own: every page that mounts this drawer
   * already holds the verdict, and a second `companies` read per drawer open would be a request
   * the brief explicitly asked us not to add. Defaulted to null so a mount that has not been
   * taught about it behaves exactly as it did before.
   */
  paused?: Banner | null
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
  /** Opens the page's own file picker — used by "Add it again" and "Add a newer version". */
  onPickFile: (versionOf?: string) => void
  /** A line above the title — the Audits section's way back to the audit it came from. */
  topLine?: React.ReactNode
}) {
  const [r, setR] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [reasonFor, setReasonFor] = useState<string | null>(null)
  /** Which card's "Not right" is asking which item it is about (decision 72). */
  const [picking, setPicking] = useState<'gaps' | 'notes' | null>(null)
  /**
   * *** WHAT IS OPEN WHEN THE DRAWER OPENS — decision 72. *** What it says and the gaps read
   * from the page; everything else folded to a header that says what is inside it. The owner's
   * own printed report was three pages because all nine sections were flat.
   */
  const [cards, setCards] = useState({
    says: true, gaps: true, notes: false, dates: false, what: false, facts: false,
    conditions: false, versions: false,
  })
  const flip = (k: keyof typeof cards) => setCards((c) => ({ ...c, [k]: !c[k] }))
  const [edit, setEdit] = useState<{ kind: string; agencies: string; subjects: string; site: string; doc_date: string }>(
    { kind: '', agencies: '', subjects: '', site: '', doc_date: '' })
  /** The gap a model call is running for, so only that row says "Working…". */
  const [working, setWorking] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  /** The delete confirmation, shown in the drawer rather than as a browser dialog. */
  const [confirmDelete, setConfirmDelete] = useState(false)
  /**
   * The scan id that was current when "Read it again" was pressed, or null when no re-read is in
   * flight from THIS drawer. It is how the poll below knows the new reading has landed rather than
   * guessing from a status that may return to the value it already had.
   */
  const [rereadFrom, setRereadFrom] = useState<string | null>(null)

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

  /**
   * *** WHILE THIS DOCUMENT IS QUEUED OR BEING READ, ASK AGAIN EVERY TEN SECONDS. ***
   *
   * Ten seconds for the same reason the Documents page uses ten (its own note): a scan is 20 to 120
   * seconds, so a row changes while you are looking at it without a reading costing a poll a second.
   *
   * *** IT READS `document_status`, NOT WHETHER THIS DRAWER ASKED FOR THE RE-READ. *** A document can
   * be queued or reading because somebody dropped a folder in, because the sweep recovered a stuck
   * row, or because another person at the same company pressed the button. All of those should make
   * the open drawer fill itself in, and none of them are visible in this component's state.
   *
   * **`rereading` is what the footer shows** and it is deliberately narrower: it means THIS drawer
   * asked, and the scan that was current then is still current. It clears the moment a new scan is —
   * which is the condition the fix was written for, because the status alone can come back to the
   * value it already had and prove nothing.
   *
   * There is no attempt limit, matching the page. A queue that never drains is a broken sweep, and
   * the honest thing is to go on saying "Reading…" rather than to stop and imply it finished.
   */
  const inFlight = r?.row.document_status === 'uploaded' || r?.row.document_status === 'reading'
  const rereading = !!rereadFrom && (inFlight || (r?.row.scan_id ?? null) === rereadFrom)
  useEffect(() => {
    if (!inFlight && !rereading) return
    const t = setInterval(() => { load(); onChanged() }, 10_000)
    return () => clearInterval(t)
  }, [inFlight, rereading, load, onChanged])

  // The new reading is current: stop calling it a re-read, and say so once.
  useEffect(() => {
    if (!rereadFrom) return
    if (r?.row.document_status !== 'read' && r?.row.document_status !== 'could_not_read') return
    if ((r?.row.scan_id ?? null) === rereadFrom) return
    setRereadFrom(null)
    setNotice('Read again — this is the new reading.')
  }, [r?.row.document_status, r?.row.scan_id, rereadFrom])

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
  /**
   * *** A SCANNED PDF, AND HOW THAT IS KNOWN — PENDING D3. ***
   * The reading got no text out of the file AND checked no quote against it. Both halves
   * matter: a reading that simply quoted nothing also has `quotes_checked = 0`, and saying "this
   * is a scan" about it would be a claim about the file nobody made. Read on staging: 10 of 47
   * current readings have no extracted text, and all 10 have `quotes_checked = 0`.
   */
  const isScan = Boolean(scan) && !((scan?.extracted_text ?? '').trim()) && (scan?.quotes_checked ?? 0) === 0
  const isProgram = kind === 'program' || kind === 'policy'
  const isPermit = kind === 'permit' || kind === 'certificate'
  const openGaps = r.gaps.filter((g) => g.status !== 'dismissed')
  const dismissed = r.gaps.filter((g) => g.status === 'dismissed')
  /**
   * *** GAPS READ FROM THE PAGE, AND NOTES — decision 48, 4 November 2026 (board 2). ***
   *
   * Migration 093 made `basis` decide whether the ROW says "Needs work"; this is the same split
   * in the drawer, so somebody who sees "Current · 1 note" on the list can open it and find the
   * note. A gap whose words are in the document is a gap; one the reading worked out is a note,
   * in the reader's own hedged words. Nothing is hidden either way.
   */
  const readGaps = openGaps.filter((g) => g.basis !== 'inferred')
  const noteGaps = openGaps.filter((g) => g.basis === 'inferred')
  /**
   * *** AND THE GATE IS GONE, WHICH WAS A DEFECT ALL ALONG. ***
   *
   * Every gap list here was behind `isProgram` — `kind === 'program' || kind === 'policy'`. The
   * forklift roster is a RECORD: its row said "Needs work" off two gaps read from the page, and
   * opening it showed no gaps at all. A person was told there was work and never told what. Found
   * by mapping decision 48 against board 2, which draws that roster's gaps and its notes.
   *
   * `hasFindings` replaces the kind test: a document with something to show shows it, whatever
   * kind it is. `isProgram` stays for the two things that really are about programs — the
   * three-year freshness line and the checklist button, which drafts program text.
   */
  const hasFindings = openGaps.length > 0 || dismissed.length > 0 || (r.earlierGaps ?? []).length > 0

  // *** THE SUB-LINE SAYS WHEN IT WAS READ, AND NOW SAYS WHEN IT IS BEING READ. ***
  // While a re-read is queued or running, the drawer goes on showing the OLD reading — which is the
  // honest thing, because it is still the only reading there is — and this is the one line that tells
  // you a newer one is coming. Without it the drawer looks identical before and after pressing the
  // button, which is the defect this change is about wearing a different disguise.
  const sub = [
    kind ? (KIND_LABEL[kind] ?? kind) : null,
    row.agencies?.join(' · ') || null,
    row.site_name,
    row.file_name,
    row.document_status === 'reading' ? 'Reading…'
      : row.document_status === 'uploaded' ? 'Queued to be read again'
      : row.scanned_at ? `read ${fmt(row.scanned_at)}` : null,
  ].filter(Boolean).join(' · ')
  // ON PAPER (board 10): one line of this document's own dates, absolute — its own date (DATE_LABEL,
  // e.g. "Revised 1 February 2021") and when it was read. Kind, agency and site print in the body.
  const printDates = [
    row.doc_date ? `${(row.doc_date_kind && DATE_LABEL[row.doc_date_kind]) || 'Dated'} ${fmt(row.doc_date)}` : null,
    row.scanned_at ? `Read ${fmt(row.scanned_at)}` : null,
  ].filter(Boolean).join(' · ')

  /**
   * ONE GAP, RENDERED THE SAME WHICHEVER LIST IT IS IN — decision 48, 4 November 2026.
   *
   * It was inline inside one "Gaps" list. There are two lists now — what was read from the page
   * and what the reading worked out — and they get the same body, the same actions and the same
   * numbering logic, because a note somebody can act on is not a lesser thing: it can still be
   * drafted, researched, made into a checklist and dismissed. A second copy of sixty lines of
   * JSX is how the two would have drifted into saying different things.
   *
   * `<Inferred>` is gone from the title: the section heading says what every item in it is, and
   * the badge on every line of a list called Notes is noise. The badge is still used on facts.
   */
  /**
   * *** BREATHING ROOM IS A RULE — decision 73, 5 November 2026 (the owner: this is the demo
   * report). *** Inside every card an item is
   *
   *     title · 8px · the reason · 12px · Fix (the word in weight) · 10px · the rule, small grey
   *
   * with **14px above and 16px below** each item and a hairline between blocks. Those are the
   * board's own numbers, measured off it at 1280, and they are written as `pt-3.5 pb-4`,
   * `mt-2`, `mt-3` and `mt-2.5` below rather than left to a `space-y`: the gap a reader sees is
   * the sum of two paddings and a rule, and nothing else should be guessing at it.
   */
  const gapItem = (g: Gap, i: number) => (
  <li key={g.id} className="border-t border-gray-100 pb-4 pt-3.5 first:border-t-0 first:pt-1">
    <p className="text-[14px] font-medium text-gray-900">
      {i + 1}. {g.title}
    </p>
    {g.description && <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{g.description}</p>}
    {g.fix && <p className="mt-3 text-[13px] leading-relaxed text-gray-700"><span className="font-semibold text-gray-900">Fix. </span>{g.fix}</p>}
    <p className="mt-2.5 text-[12px] text-gray-500">
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
      /* *** THE THREE BUTTONS ARE NOT HERE ANY MORE — decision 72. *** They were under every
         gap: the owner's own printed report carried TWELVE of them. They sit once, at the foot
         of the card, and act on the item a person picks there. Only "Draft this section" stays
         per item, because it is offered on some gaps and not others and the card's foot cannot
         say which. */
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
        {/* ONLY WHEN THE SCAN SAID THE TEXT COULD BE WRITTEN. A gap needing their floor plan is
            not one we can draft, and offering it would be a promise the route then refuses.
            It stays PER ITEM because it is offered on some and not others, and the card's foot
            cannot say which. */}
        {g.draftable && (
          <button disabled={!!working || Boolean(paused)} onClick={() => runDraft(g.id)}
            className="text-gray-600 underline hover:text-gray-900 disabled:text-gray-300">
            {working === `draft-${g.id}` ? 'Writing…' : (g.draft_text ? 'Draft it again' : 'Draft this section')}
          </button>
        )}
      </div>
    )}
  </li>
  )

  /**
   * *** THE THREE BUTTONS, ONCE, AT THE FOOT OF THE CARD — decision 72. ***
   *
   * `Make a checklist` and `Research this` act on the card's items together, which is what a
   * person pressing a button at the foot of a list means. `Not right` cannot: it is one
   * person's verdict on one finding. So it asks which — the items by number, in one line — and
   * then opens that item's own reason box where the item is. One row of controls, and nothing
   * the per-item row could do is lost.
   */
  const cardFoot = (items: Gap[], what: 'gaps' | 'notes') => {
    if (!items.length) return null
    const q = items.map((g) => [g.title, g.fix].filter(Boolean).join('. ')).join(' ')
    return (
      <div className="no-print mt-3 border-t border-gray-100 pt-3">
        <div className="flex flex-wrap items-center gap-4 text-[12px]">
          <button disabled={!!working || Boolean(paused)}
            onClick={() => runChecklist(items.length === 1 ? { gap_id: items[0].id } : { all: true })}
            className="text-gray-600 underline hover:text-gray-900 disabled:text-gray-300">
            {working === 'all' || (items.length === 1 && working === items[0].id) ? 'Working…' : 'Make a checklist'}
          </button>
          <button onClick={() => {
            window.location.href = `/compliance?ask=${encodeURIComponent(q)}&document=${documentId}`
          }} className="text-gray-600 underline hover:text-gray-900">Research this</button>
          <button onClick={() => setPicking(picking === what ? null : what)}
            className="text-gray-500 underline hover:text-gray-800">Not right</button>
        </div>
        {picking === what && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-gray-500">
            <span>Which one is not right?</span>
            {items.map((g, i) => (
              <button key={g.id} onClick={() => { setReasonFor(g.id); setPicking(null) }}
                className="underline hover:text-gray-900">{i + 1}</button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const footer = (
    <>
      {/* THE ONE OUTLINED BUTTON, and the only one this run has. DESIGN.md §4: one primary or
          outlined action, everything else a text action. */}
      {isProgram && openGaps.length > 0 && (
        <button disabled={!!working || Boolean(paused)} onClick={() => runChecklist({ all: true })}
          className="rounded-lg border border-[var(--green)] px-3.5 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-[var(--green-wash)] disabled:border-gray-200 disabled:text-gray-300">
          {working === 'all' ? 'Working…' : `Make a checklist for all ${openGaps.length} gaps`}
        </button>
      )}
      <button onClick={async () => {
        const j = await act({ action: 'file_url' })
        if (j?.url) window.open(j.url, '_blank', 'noopener')
      }} className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Open the file</button>
      {/* *** IT QUEUES, IT DOES NOT SCAN — 28 September 2026. ***
          This used to POST `/api/document-scan`, which runs the whole 20-to-120-second model call
          inside the request, and `await` it here. So closing the drawer aborted the fetch and took
          the reading with it: the person pressed the button, walked away, and came back to the row
          exactly as they left it. `/api/document-rescan` puts the document back in the queue and
          hands it to the sweep, and returns in a few hundred milliseconds. The reading now happens
          on the server whatever the browser does. `DECISIONS.md` §138. */}
      {/* *** NOT OFFERED WHILE IT IS QUEUED OR BEING READ — W1, closed here. ***
          The owner watched a folder of nine files for eleven minutes with nothing on the screen
          moving, and pressed "Read it again" on a file that was simply waiting its turn — the
          sweep reads one document at a time and was working the whole while. The list says
          Queued or Reading… on the row now and this button is not drawn at all: a control that
          starts the thing that is already happening is a control that cannot help. The progress
          line on the day group (decision 70) is the other half of the same fix. */}
      {row.document_status !== 'uploaded' && row.document_status !== 'reading' && (
      <button disabled={busy || rereading || Boolean(paused)} onClick={async () => {
        setBusy(true)
        try {
          const res = await fetch('/api/document-rescan', {
            method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ document_id: documentId }),
          })
          if (!res.ok) {
            const j = await res.json().catch(() => null)
            setNotice(j?.error ?? 'We could not queue that document for another reading.')
            return
          }
          // The scan that was current when we asked. The poll below stops when a DIFFERENT one is,
          // which is the only reliable signal that the new reading has landed — the status alone can
          // return to the value it already had.
          setRereadFrom(r?.row.scan_id ?? null)
          setNotice('Reading it again. You can close this — it will keep going.')
          await load(); onChanged()
        } finally { setBusy(false) }
      }} className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300">
        {busy ? 'Queueing…' : rereading ? 'Reading…' : 'Read it again'}
      </button>
      )}
      {/* *** "Print", NOT "Download" — decision 73's footer: Open the file · Read it again ·
          Print · Not right. *** The control opens the browser's print dialogue, which is where
          a PDF comes from; calling it Download described the one thing a person might do with
          the dialogue rather than the thing the button does. */}
      <button onClick={printDrawer}
        className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Print</button>
      {/* DESTRUCTIVE, AND IT LOOKS IT — 12px and faint (`DESIGN.md` §1, §4). It is the only
          irreversible action in the product's reading surface, so it is the quietest thing in
          the footer and it asks first. */}
      {/* *** "Not right" IN THE FOOTER OPENS WHAT THIS DOCUMENT IS — decision 73's footer, and
          it writes nothing new. *** The per-item "Not right" says one finding is wrong. This one
          is the whole document being the wrong KIND of thing — filed under the wrong agency,
          dated wrong, taken for a permit when it is a certificate — which is exactly what the
          correction editor already does (`document_corrections`, the next reading is shown
          them). So it opens that card and that editor rather than inventing a second way to
          disagree. E4 is display and words: no new write, no new route. */}
      <button onClick={() => {
        setCards((c) => ({ ...c, what: true }))
        setEditing(true)
        setTimeout(() => document.getElementById('cb-doc-what')?.scrollIntoView({ block: 'center' }), 0)
      }} className="text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Not right</button>
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
      <Drawer title={documentName(row.title)} sub={sub} company={companyName} onClose={onClose} footer={footer}
        printType="Document report" printDates={printDates}
        topLine={topLine}>
        {deletePanel}
        <FilingLine row={row} folders={folders} onMove={onMove} onChanged={onChanged} />
        <p className="text-[13px] text-[var(--amber)]">Could not read</p>
        <p className="mt-3 font-serif text-[17px] leading-relaxed text-gray-800">
          {row.could_not_read_reason
            || 'We could not read this clearly enough to rely on.'}
        </p>
        {/* *** "Add it again", NOT "Upload a clearer copy" — B1, decision 51. ***
        Since B1 the sentence above this control can be a FORMAT refusal: "Save it as
        .docx or PDF and add it again." Telling that person to upload a clearer copy of a
        file whose sharpness was never the problem is the wrong instruction in the most
        visible place, photographed on the walk. The sentence says what to do; this is
        only the way to do it, and these words are true of every reason. */}
        <button onClick={() => onPickFile()}
          className="mt-4 text-[14px] text-gray-600 underline hover:text-gray-900">Add it again</button>
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
    <Drawer title={documentName(row.title)} sub={sub} company={companyName} onClose={onClose} footer={footer}
        printType="Document report" printDates={printDates}
        topLine={topLine}>
      {deletePanel}
      {/* Step 18: one note at the top of the drawer, because the paused controls in here are
          spread across the gaps list and the footer. Nothing is restyled and nothing moves. */}
      <PausedNote banner={paused} />
      {notice && (
        <p className="mb-4 rounded-lg bg-[var(--green-wash)] px-3 py-2 text-[13px] text-gray-800">{notice}</p>
      )}

      {/* THE HEADER AREA'S ONE CONTROL — filing, which is the only thing about a document that
          is the person's choice rather than the reading's finding. */}
      <FilingLine row={row} folders={folders} onMove={onMove} onChanged={onChanged} />

      {/* *** 1 ── THE TITLE LINE — decision 72. The old Status card is gone: its word, the two
             counts, the kind, the agency and the dates are one line under the title. *** */}
      <p className="mb-1 text-[13px] leading-relaxed">
        <span className={AMBER.has(row.display_status) ? 'text-[var(--amber)]' : 'text-gray-700'}>
          {STATUS_WORD[row.display_status] ?? row.display_status}
        </span>
        {readGaps.length > 0 && (
          <span className="text-gray-500"> · {readGaps.length} gap{readGaps.length === 1 ? '' : 's'} read from the page</span>
        )}
        {noteGaps.length > 0 && (
          <span className="text-gray-500"> · {noteGaps.length} note{noteGaps.length === 1 ? '' : 's'}</span>
        )}
        {kind && <span className="text-gray-500"> · {KIND_LABEL[kind] ?? kind}</span>}
        {row.agencies?.length ? <span className="text-gray-500"> · {row.agencies.join(' · ')}</span> : null}
        {row.significant_date && (
          <span className="text-gray-500">
            {' '}· {((row.significant_date_kind && DATE_LABEL[row.significant_date_kind]) ?? 'Date').toLowerCase()} {fmt(row.significant_date)}
          </span>
        )}
        {row.scanned_at && <span className="text-gray-500"> · read {fmt(row.scanned_at)}</span>}
      </p>

      {/* *** THE ONE NOTE A SCANNED PDF CARRIES — PENDING D3, closed here. *** No text came out
          of the file, so nothing in this reading was checked against it. Said on the one kind of
          document it is true of, and nowhere else (decision 74). */}
      {isScan && <p className="mb-3 text-[13px] text-gray-500">{SCANNED_PAGES}</p>}

      {/* 2 ── WHAT IT SAYS — open, grey, and in the serif because it is read rather than scanned. */}
      {row.summary && (
        <Card tint={CARD_SITUATION} title={DOC_CARD_SAYS} open={cards.says}
          onToggle={() => flip('says')} controls="cb-doc-says">
          <p className="py-1 font-serif text-[17px] leading-relaxed text-gray-800">{row.summary}</p>
        </Card>
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

      {/* 3 ── GAPS READ FROM THE PAGE — open, amber. Decision 48 split this from Notes; decision
             72 makes it a card and puts its three buttons once at the foot. */}
      {hasFindings && (
        <Card tint={`${TINT_AMBER} border-l-current`} title={DOC_CARD_GAPS}
          summary={String(readGaps.length)}
          open={cards.gaps} onToggle={() => flip('gaps')} controls="cb-doc-gaps">
          {readGaps.length > 0 ? (
            <ol>
              {readGaps.map((g, i) => gapItem(g, i))}
            </ol>
          ) : (
            /* AN EMPTY STATE IS A MESSAGE, AND THIS ONE IS A CLAIM — §5.1. This section only
               renders because the reading DID find things; printing nothing here would read as a
               list that failed to load. What is true is that none of them is quoted. */
            <p className="text-[13px] text-gray-600">
              Nothing in this reading is quoted from the document itself.
              {noteGaps.length > 0 ? ' What it found is under Notes, in its own words.' : ''}
            </p>
          )}
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
                    {/* *** STILL OPEN, AND SAID SO — Run 7. ***
                        Two different things share this list and they must not read the same.
                        A superseded gap was answered by the next reading and is here only
                        because somebody's checklist is attached to it. One still `open` with
                        `not_seen_at` is a finding the latest reading passed over in silence,
                        and it is STILL OPEN: nothing closes a gap without a person. */}
                    {g.status === 'open' && g.not_seen_at ? (
                      <p className="text-[12px] text-[var(--amber)]">
                        Not seen in the latest reading. Still open — we do not close a finding
                        because a reading stopped mentioning it.
                      </p>
                    ) : (
                      <p className="text-[12px] text-gray-400">The latest reading did not raise this.</p>
                    )}
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
          {cardFoot(readGaps, 'gaps')}
        </Card>
      )}

      {/* 4 ── NOTES — folded, blue, and its header says what is in it. Decision 48 made these a
             list of their own; decision 74 takes the explanation off the top of it: the heading
             and the count are the distinction, and "nobody has checked them" is not a sentence
             to read on your own document. */}
      {noteGaps.length > 0 && (
        <Card tint={CARD_CONFIRM} title={DOC_CARD_NOTES} summary={notesNoticed(noteGaps.length)}
          open={cards.notes} onToggle={() => flip('notes')} controls="cb-doc-notes">
          <ol>
            {noteGaps.map((g, i) => gapItem(g, i))}
          </ol>
          {cardFoot(noteGaps, 'notes')}
        </Card>
      )}

      {/* 5 ── DATES THIS DOCUMENT SETS — folded, green; the header counts them and says whether
             they are on the calendar. */}
      {r.deadlines.length > 0 && (
        <Card tint={CARD_APPLIES} title={DOC_CARD_DATES}
          summary={datesSummary(
            r.deadlines.length,
            r.deadlines.filter((d) => !d.recurs && isPast(d.due_on)).length,
            r.deadlines.filter((d) => d.calendar_events && d.calendar_events.status !== 'withdrawn').length,
          )}
          open={cards.dates} onToggle={() => flip('dates')} controls="cb-doc-dates">
          <ul className="space-y-3 py-1">
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
                  {/**
                    * *** DOCUMENTS STOPS ASKING — Calendar step 6, decision 7. ***
                    *
                    * There was an "Add to calendar" button here, and it was the wrong shape twice
                    * over: it asked a person to do what the product already knew — it had read the
                    * permit's renewal date and was keeping it to itself until somebody found this
                    * drawer — and it meant a calendar whose completeness depended on who clicked.
                    * The scan files every date as it finds them now (`lib/documentScan.ts`), so
                    * this is a STATEMENT, not a request.
                    *
                    * An HREF AND NOT A BUTTON, deliberately. `/calendar?date=<id>` opens nothing
                    * until step 8 builds the parameter, and a link to a page that does not read it
                    * yet starts working the moment it does — a button would need its handler
                    * written twice. `docs/HANDOFF-CODE.md` §7 records it as expected on staging.
                    */}
                  {/* *** AND A FOURTH WORDING, WITH NO LINK — Calendar step 6b, decision 29. ***
                    * This drawer lists EVERY reading's deadline rows, not just the newest
                    * (`app/api/documents/report/route.ts` filters on `document_id` alone), so an
                    * older reading's date whose row the newest reading withdrew lands here. The
                    * three wordings below would have called it "On your calendar — waiting for
                    * your confirmation", which is the product asserting a date no reading of this
                    * file currently says.
                    *
                    * NO LINK, and that is not an omission: `calendar_v` does not return a
                    * withdrawn row (migration 075), so `/calendar?date=<id>` would open a page
                    * that cannot find it. A sentence with nowhere to go is better than a link to
                    * nothing. Decision 30: when the product does not know something it says so.
                    */}
                  {d.calendar_events
                    ? d.calendar_events.status === 'withdrawn'
                    ? <p className="mt-0.5 text-[12px] text-gray-400">Not in the latest reading of this file</p>
                    : <p className="mt-0.5 text-[12px] text-gray-400">
                        <a href={`/calendar?date=${d.calendar_events.id}`} className="underline hover:text-gray-600">
                          {d.calendar_events.status === 'confirmed' ? 'On your calendar'
                            : d.calendar_events.status === 'dismissed' ? 'Removed from your calendar'
                            : 'On your calendar — waiting for your confirmation'}
                        </a>
                      </p>
                    /* An undated one-off is not on the calendar and cannot be: 073's
                       `calendar_events_date_or_recurs` refuses a date with no day that does not
                       recur, and an invented day would be a deadline nobody set (migration 060's
                       rule). It keeps the words it has always had, which are just the title and
                       the source line above. */
                    : null}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* 6 ── WHAT THIS DOCUMENT IS — folded; its header says the six fields' headline and
             offers the way to disagree (decision 72). It is drawn here, after the dates, by the
             order of the cards in the markup. */}
      <Card tint={CARD_QUIET} title={DOC_CARD_WHAT}
        summary={whatItIsSummary([
          kind ? (KIND_LABEL[kind] ?? kind) : null,
          row.agencies?.join(' · ') || null,
          row.site_name ?? 'Company-wide',
          ...(scan?.jurisdiction ?? []),
        ])}
        open={cards.what} onToggle={() => flip('what')} controls="cb-doc-what">
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
            somebody here; the reading said otherwise.
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
      </Card>

      {/* ── CONDITIONS TO KEEP — a permit's own, folded. Decision 72 names seven parts and this
             is not one of them; it is not dropped for that, because a permit's conditions are
             the thing its evidence is judged against. Folded, after the seven, and said in the
             step's report. */}
      {isPermit && r.conditions.length > 0 && (
        <Card tint={CARD_QUIET} title={DOC_CARD_CONDITIONS} summary={String(r.conditions.length)}
          open={cards.conditions} onToggle={() => flip('conditions')} controls="cb-doc-cond">
          <ul className="space-y-3 py-1">
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
        </Card>
      )}

      {/* 7 ── THINGS WE THINK ARE TRUE ABOUT YOU — folded, grey, and its header carries the
             count and the way to settle them (decision 72). Proposed, never written silently
             (§108). The heading was "Facts we found, please confirm". */}
      {r.facts.length > 0 && (
        <Card tint={CARD_QUIET} title={DOC_CARD_FACTS} summary={factsWaiting(r.facts.length)}
          open={cards.facts} onToggle={() => flip('facts')} controls="cb-doc-facts">
          <ul className="space-y-3 py-1">
            {r.facts.map((f) => (
              <li key={f.id}>
                <p className="text-[13px] text-gray-900">
                  {/* *** THE "inferred" BADGE IS GONE — decision 74: not a word on a customer's
                      screen. *** It said a worked-out fact was worked out, which the card's own
                      heading ("Things we think are true about you") now says of every line in
                      it, in words a person uses. The quote under the line is the other half:
                      a fact with the file's own words under it is a different thing from one
                      without, and that difference is visible without a label. */}
                  {f.switch_key.replace(/_/g, ' ')}: {f.proposed_value}
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
                    {/* *** WITHDRAWN IS NOT REJECTED, AND THE WORDING KEEPS THEM APART — Run 7. ***
                        "Not right" is the person saying we were wrong, and the next scan is
                        shown it. This is US saying the row came from a reading we have replaced —
                        nobody was wrong, and the row stays so the change is visible rather than a
                        proposal that silently disappeared from the queue.

                        *** THE WORDS CHANGED 29 SEPTEMBER 2026, BECAUSE THEY STOPPED BEING TRUE. ***
                        It read "No longer proposed by the latest reading", which was true while a
                        proposal was withdrawn only when the new reading went SILENT about its key.
                        Re-reading a document now withdraws every pending proposal from its earlier
                        readings, so a key the latest reading DOES restate has a withdrawn row too —
                        and for that row the old sentence was simply false.

                        One line, true in both cases: it names where the row came from and claims
                        nothing about what replaced it, because in the silent case nothing did. */}
                    {f.status === 'accepted' ? 'Confirmed'
                      : f.status === 'withdrawn' ? 'From an earlier reading of this document'
                      : 'Not right'}
                    {f.rejected_reason ? ` — you said: ${f.rejected_reason}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── VERSIONS — folded, and the same case as Conditions: not one of decision 72's seven,
             and not dropped, because it is how somebody sees which copy they are reading. */}
      {r.versions.length > 1 && (
        <Card tint={CARD_QUIET} title={DOC_CARD_VERSIONS} summary={String(r.versions.length)}
          open={cards.versions} onToggle={() => flip('versions')} controls="cb-doc-vers">
          <ul className="space-y-2 py-1">
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
        </Card>
      )}

      {/* *** THE QUIET LAST LINE IS GONE — decision 74, amended by the owner, 5 November 2026. ***
          It read: "Read on 3 November. Quotes are word for word from the document and anything we
          worked out is marked inferred. Read by claude-opus-5-5. Not legal advice." Four things
          were wrong with it on the customer's own page: "we" and "ours" put the product on the
          other side of the table; "inferred" is a word for a developer; the quote claim was
          UNQUALIFIED and simply untrue on a scanned PDF (`PENDING.md` D3); and the model's name
          is not something a person reading their forklift roster has any use for. What the line
          was protecting is kept where it belongs — the two card headings, and the scan note
          under the title. The app's own standing line still sits at the foot of every page
          (`components/AppLayout.tsx`), and the printed frame carries decision 64's sentence. */}
    </Drawer>
  )
}
