'use client'

/**
 * DOCUMENTS — one table, folder as a filter, group by anything.
 *
 * *** A DOCUMENT HAS PROPERTIES, NOT A PLACE. *** A folder is where a person put a file; it is
 * set by the user and never touched by the scan. Everything else — agency, subject, kind, site,
 * status, the date that matters — is set by the scan. So a file lives in one folder and has many
 * properties, and any property can be the one you group by. This is Excel: one table, filter
 * narrows, group arranges. The Windows-style folder tree that used to be here is gone, and so
 * are the grid/list toggle and the log tab.
 *
 * Folder and Group by never mix in one list. Agency rows and folder rows in the same list show
 * the same file twice and read as a mistake.
 *
 * *** STATUS FIRST, BECAUSE THE OPERATOR'S QUESTION WALKING IN IS "WHAT NEEDS ME TODAY". ***
 * The page opens grouped by status and the group order is that question: Needs work, Expiring,
 * Expired, Could not read, Not yet read, then the routine words.
 *
 * *** NOTHING IS DROPPED FOR HAVING NO VALUE. *** Under any grouping, rows with nothing in that
 * column sit in their own last group — "No agency yet" — never filtered out. A list computed
 * from the rows that happen to have a value is the omniscient status tracker with a display
 * filter on it.
 *
 * WIDTH IS 900, not the 775 of a reading surface: this row carries a title, an agency, a kind, a
 * site, a date and a status, and that needs a third column. `DESIGN.md` §3.
 *
 * WHAT IS NOT HERE, ON PURPOSE (Run 4 and later): the report drawer, pinned views, the
 * "what we'd expect and don't see" line, and the To confirm queue. Clicking a row expands the
 * scan's own summary inline as a placeholder, and that is all this run claims.
 */

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { ACCEPTED_FILE_TYPES } from '@/lib/acceptedFiles'

interface IndexRow {
  document_id: string
  title: string
  file_name: string
  kind: string | null
  agencies: string[]
  subjects: string[]
  issuer: string | null
  site_name: string | null
  entity_id: string | null
  folder_name: string | null
  folder_id: string | null
  doc_date: string | null
  doc_date_kind: string | null
  significant_date: string | null
  significant_date_kind: string | null
  scanned_at: string | null
  uploaded_at: string
  scan_status: string | null
  document_status: string
  could_not_read_reason: string | null
  summary: string | null
  version_of: string | null
  scan_id: string | null
  open_gap_count: number
  display_status: string
}

interface Folder { id: string; name: string; parent_id: string | null; sort_order: number }
interface Site { id: string; name: string; is_primary: boolean }

type GroupBy = 'status' | 'agency' | 'subject' | 'kind' | 'site' | 'folder' | 'none'

/**
 * THE STATUS VOCABULARY, IN THE ORDER THE PAGE SHOWS IT.
 *
 * The order is the operator's question, not the alphabet. Amber is attention, never information
 * (`DESIGN.md` §2) — which is why Current, Recorded and On file are grey. There is no green word
 * for a document that is merely fine, and there is no "compliant": the database refuses that
 * value on `document_scans.status` (migration 040).
 */
const STATUS_ORDER: string[] = [
  'needs_work', 'expiring', 'expired', 'could_not_read', 'not_yet_read',
  'current', 'recorded', 'on_file',
]

const STATUS_GROUP_LABEL: Record<string, string> = {
  needs_work: 'Needs work',
  expiring: 'Expiring within 90 days',
  expired: 'Expired',
  could_not_read: 'Could not read',
  not_yet_read: 'Not yet read',
  current: 'Current',
  recorded: 'Recorded',
  on_file: 'On file',
}

const STATUS_WORD: Record<string, string> = {
  needs_work: 'Needs work',
  expiring: 'Expiring',
  expired: 'Expired',
  could_not_read: 'Could not read',
  not_yet_read: 'Queued',
  current: 'Current',
  recorded: 'Recorded',
  on_file: 'On file',
}

const AMBER_STATUSES = new Set(['needs_work', 'expiring', 'expired', 'could_not_read'])

/** What the date under the status word is called. The scan says which kind of date it is. */
const DATE_LABEL: Record<string, string> = {
  expiry: 'Expires',
  revised_on: 'Revised',
  revised: 'Revised',
  last_entry: 'Last entry',
  serviced: 'Serviced',
  renewal: 'Renewal',
  effective: 'Effective',
  issued: 'Issued',
}

const KIND_LABEL: Record<string, string> = {
  permit: 'Permit',
  certificate: 'Certificate',
  program: 'Program',
  policy: 'Policy',
  record: 'Record',
  supplier_document: 'Supplier document',
  other: 'Other',
}

const EMPTY_GROUP: Record<GroupBy, string> = {
  status: 'No status yet',
  agency: 'No agency yet',
  subject: 'No subject yet',
  kind: 'No kind yet',
  site: 'No site yet',
  folder: 'Not in a folder',
  none: '',
}

const COLLAPSE_AT = 8

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[14px] text-gray-400">Loading…</div>}>
      <DocumentsPageContent />
    </Suspense>
  )
}

function DocumentsPageContent() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<IndexRow[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [folderFilter, setFolderFilter] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [siteFilter, setSiteFilter] = useState<string>('all')

  const [folderMenuOpen, setFolderMenuOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, { gaps: number; deadlines: number; facts: number }>>({})
  const [showAll, setShowAll] = useState<Set<string>>(new Set())

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  /** Documents this browser is scanning right now, so the row says Reading… rather than Queued. */
  const [readingIds, setReadingIds] = useState<Set<string>>(new Set())

  const [sortKey, setSortKey] = useState<'title' | 'kind' | 'site' | 'date' | 'status'>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  async function load() {
    try {
      const res = await fetch('/api/documents/index', { headers: await authHeaders() })
      if (!res.ok) { setError('We could not load your documents just now.'); return }
      const json = await res.json()
      setRows((json.documents ?? []).map((r: IndexRow) => ({
        ...r, agencies: asArray(r.agencies), subjects: asArray(r.subjects),
      })))
      setFolders(json.folders ?? [])
      setSites(json.sites ?? [])
      setError('')
    } catch {
      setError('We could not load your documents just now.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // UPLOAD. One file at a time, and one scan at a time — never in parallel.
  // ---------------------------------------------------------------------------
  async function onFilesPicked(picked: FileList | null) {
    if (!picked || picked.length === 0) return
    const files = Array.from(picked)
    setUploading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user?.id ?? '').single()
      const companyId = profile?.company_id
      if (!companyId) throw new Error('No company on this account.')

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`)
        const targetFolder = folderFilter === 'all' ? null : folderFilter
        const path = `${companyId}/${targetFolder ?? 'unfiled'}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('company-documents').upload(path, file)
        if (upErr) throw upErr

        const dbRes = await fetch('/api/documents', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            name: file.name, file_url: path,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size, folder_id: targetFolder,
          }),
        })
        if (!dbRes.ok) throw new Error(`We could not save ${file.name}.`)
        const { id } = await dbRes.json()
        await load()

        // *** ONE AFTER ANOTHER. *** Each scan is a model call of 20 to 100 seconds over a whole
        // PDF. Thirty at once would rate-limit, and the failures would not be the documents'
        // fault. A scan that fails does not fail the upload: the file is stored and the row is
        // there, and the reading can be asked for again.
        if (id) {
          setReadingIds((s) => new Set(s).add(id))
          setProgress(`Reading ${i + 1} of ${files.length}: ${file.name}`)
          try {
            await fetch('/api/document-scan', {
              method: 'POST',
              headers: await authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ document_id: id }),
            })
          } catch (e) {
            console.error('document-scan:', e)
          } finally {
            setReadingIds((s) => { const n = new Set(s); n.delete(id); return n })
          }
          await load()
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
      setProgress('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  async function expand(row: IndexRow) {
    if (expandedId === row.document_id) { setExpandedId(null); return }
    setExpandedId(row.document_id)
    if (detail[row.document_id] || !row.scan_id) return
    // Counts only. The report itself is the drawer, and the drawer is Run 4.
    const [g, d, f] = await Promise.all([
      supabase.from('document_gaps').select('id', { count: 'exact', head: true })
        .eq('document_id', row.document_id).eq('status', 'open'),
      supabase.from('document_deadlines').select('id', { count: 'exact', head: true })
        .eq('document_id', row.document_id),
      supabase.from('fact_proposals').select('id', { count: 'exact', head: true })
        .eq('document_id', row.document_id),
    ])
    setDetail((prev) => ({
      ...prev,
      [row.document_id]: { gaps: g.count ?? 0, deadlines: d.count ?? 0, facts: f.count ?? 0 },
    }))
  }

  async function createFolder() {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolder(true)
    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, parent_id: null }),
      })
      setNewFolderName('')
      await load()
    } finally { setCreatingFolder(false) }
  }

  async function renameFolder(id: string) {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name) return
    await fetch('/api/folders', {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, name }),
    })
    await load()
  }

  async function moveTo(documentId: string, folderId: string | null) {
    await fetch('/api/documents', {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: documentId, folder_id: folderId }),
    })
    await load()
  }

  // ---------------------------------------------------------------------------
  // FILTER, THEN GROUP. Folder narrows; Group by arranges. They never mix.
  // ---------------------------------------------------------------------------
  const olderVersionCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) if (r.version_of) counts[r.version_of] = (counts[r.version_of] ?? 0) + 1
    return counts
  }, [rows])

  const filtered = useMemo(() => rows.filter((r) => {
    if (folderFilter !== 'all' && r.folder_id !== folderFilter) return false
    if (siteFilter !== 'all' && r.entity_id !== siteFilter) return false
    return true
  }), [rows, folderFilter, siteFilter])

  /**
   * ONE ROW CAN LAND IN SEVERAL GROUPS, and that is deliberate: a document answering to both
   * OSHA and DEQ appears under each. The vision's own example. Counting rows is therefore not
   * counting documents under those two groupings, which is why no total sits beside the control.
   */
  const groups = useMemo(() => {
    if (groupBy === 'none') return []
    const map = new Map<string, IndexRow[]>()
    const push = (k: string, r: IndexRow) => { if (!map.has(k)) map.set(k, []); map.get(k)!.push(r) }

    for (const r of filtered) {
      if (groupBy === 'status') push(r.display_status, r)
      else if (groupBy === 'agency') {
        if (r.agencies.length) r.agencies.forEach((a) => push(a, r)); else push('', r)
      } else if (groupBy === 'subject') {
        if (r.subjects.length) r.subjects.forEach((a) => push(a, r)); else push('', r)
      } else if (groupBy === 'kind') push(r.kind ? (KIND_LABEL[r.kind] ?? r.kind) : '', r)
      else if (groupBy === 'site') push(r.site_name ?? '', r)
      else if (groupBy === 'folder') push(r.folder_name ?? '', r)
    }

    const entries = [...map.entries()]
    if (groupBy === 'status') {
      entries.sort((a, b) => STATUS_ORDER.indexOf(a[0]) - STATUS_ORDER.indexOf(b[0]))
      return entries.map(([k, v]) => ({ key: k, label: STATUS_GROUP_LABEL[k] ?? k, rows: v }))
    }
    // Named groups alphabetically; the empty one always last, never dropped.
    entries.sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
    return entries.map(([k, v]) => ({ key: k || '__none__', label: k || EMPTY_GROUP[groupBy], rows: v }))
  }, [filtered, groupBy])

  const flat = useMemo(() => {
    if (groupBy !== 'none') return []
    const val = (r: IndexRow) => ({
      title: r.title ?? '', kind: r.kind ?? '', site: r.site_name ?? '',
      date: r.significant_date ?? r.doc_date ?? '', status: r.display_status,
    })[sortKey] ?? ''
    return [...filtered].sort((a, b) => {
      const c = String(val(a)).localeCompare(String(val(b)))
      return sortDir === 'asc' ? c : -c
    })
  }, [filtered, groupBy, sortKey, sortDir])

  const folderCount = (id: string) => rows.filter((r) => r.folder_id === id).length
  const statusWord = (r: IndexRow) =>
    r.display_status === 'not_yet_read' && (readingIds.has(r.document_id) || r.document_status === 'reading')
      ? 'Reading…'
      : (STATUS_WORD[r.display_status] ?? r.display_status)

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  function Row({ r }: { r: IndexRow }) {
    const amber = AMBER_STATUSES.has(r.display_status)
    const older = olderVersionCount[r.document_id] ?? 0
    const dateLabel = r.significant_date_kind
      ? (DATE_LABEL[r.significant_date_kind] ?? r.significant_date_kind) : ''
    const meta = [
      r.file_name,
      r.folder_name,
      r.scanned_at ? `read ${fmtShort(r.scanned_at)}` : null,
      older ? `${older} older version${older === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ')
    const open = expandedId === r.document_id
    const d = detail[r.document_id]

    return (
      <div className="border-b border-gray-100 last:border-b-0">
        <div onClick={() => expand(r)}
          className="group -mx-3 flex cursor-pointer items-start gap-4 rounded-lg px-3 py-2.5 hover:bg-white">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">{r.title}</p>
            <p className="mt-0.5 truncate text-[12px] text-gray-500">{meta}</p>
            {r.display_status === 'could_not_read' && (
              // *** SAID OUT LOUD, ON THE ROW. *** Never a log line, never dropped from a count,
              // and never a claim about contents nobody read — only what we could not do and
              // what would fix it. `CLAUDE.md` §5.1.
              <p className="mt-1 text-[12px] text-[var(--amber)]">
                {r.could_not_read_reason || 'We could not read this clearly enough to rely on.'}{' '}
                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                  className="text-gray-600 underline hover:text-gray-900">Upload a clearer copy</button>
              </p>
            )}
          </div>

          <div className="w-[230px] shrink-0">
            <p className="truncate text-[12px] text-gray-600">{r.agencies.join(' · ') || '—'}</p>
            <p className="mt-0.5 truncate text-[12px] text-gray-400">
              {[r.kind ? (KIND_LABEL[r.kind] ?? r.kind) : null, r.site_name].filter(Boolean).join(' · ') || ' '}
            </p>
          </div>

          <div className="w-[160px] shrink-0 text-right">
            <p className={`text-[13px] ${amber ? 'text-[var(--amber)]' : 'text-gray-500'}`}>{statusWord(r)}</p>
            {r.significant_date && (
              <p className="mt-0.5 text-[12px] text-gray-400">{dateLabel} {fmtDate(r.significant_date)}</p>
            )}
          </div>
        </div>

        {open && (
          // A PLACEHOLDER, AND LABELLED AS ONE. The report is the drawer and the drawer is Run 4.
          <div className="-mx-3 mb-2 rounded-lg bg-white px-3 pb-3 pt-1">
            {r.summary
              ? <p className="font-serif text-[17px] leading-relaxed text-gray-800">{r.summary}</p>
              : <p className="text-[13px] text-gray-400">No reading yet.</p>}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-gray-500">
              <span>{d ? d.gaps : r.open_gap_count} gap{(d ? d.gaps : r.open_gap_count) === 1 ? '' : 's'}</span>
              <span>{d ? d.deadlines : '—'} deadline{d && d.deadlines === 1 ? '' : 's'}</span>
              <span>{d ? d.facts : '—'} fact{d && d.facts === 1 ? '' : 's'}</span>
              <span className="text-gray-300">|</span>
              <label className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                Move to…
                <select value={r.folder_id ?? ''} onChange={(e) => moveTo(r.document_id, e.target.value || null)}
                  className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[12px] text-gray-700">
                  <option value="">Not in a folder</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
    )
  }

  const controlClass =
    'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[14px] text-gray-700 hover:border-gray-300'

  return (
    <AppLayout>
      <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden"
        onChange={(e) => onFilesPicked(e.target.files)} />
      {/* A whole folder. `webkitdirectory` is not in React's typings; the cast is the only way a
          browser offers a folder picker at all. */}
      <input ref={folderInputRef} type="file" multiple className="hidden"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => onFilesPicked(e.target.files)} />

      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="no-print pt-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">Documents</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Everything you hold, read and grouped by what it is — not by where you filed it.
          </p>
        </div>

        {/* CONTROLS. Folder narrows, Group by arranges, and the two never mix in one list. */}
        <div className="no-print mt-5 flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4">
          <div className="relative">
            <button onClick={() => setFolderMenuOpen((v) => !v)} className={controlClass}>
              Folder: {folderFilter === 'all'
                ? `All files (${rows.length})`
                : (folders.find((f) => f.id === folderFilter)?.name ?? 'All files')} ▾
            </button>
            {folderMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFolderMenuOpen(false)} />
                <div className="absolute z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button onClick={() => { setFolderFilter('all'); setFolderMenuOpen(false) }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[14px] text-gray-700 hover:bg-gray-50">
                    <span>All files</span><span className="text-[12px] text-gray-400">{rows.length}</span>
                  </button>
                  {folders.map((f) => (
                    <div key={f.id} className="flex items-center gap-1 px-3 py-1.5 hover:bg-gray-50">
                      {renamingId === f.id ? (
                        <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameFolder(f.id); if (e.key === 'Escape') setRenamingId(null) }}
                          onBlur={() => renameFolder(f.id)}
                          className="w-full rounded border border-gray-200 px-1.5 py-0.5 text-[14px]" />
                      ) : (
                        <>
                          <button onClick={() => { setFolderFilter(f.id); setFolderMenuOpen(false) }}
                            className="flex flex-1 items-center justify-between text-left text-[14px] text-gray-700">
                            <span className="truncate">{f.name}</span>
                            <span className="ml-2 text-[12px] text-gray-400">{folderCount(f.id)}</span>
                          </button>
                          <button onClick={() => { setRenamingId(f.id); setRenameValue(f.name) }}
                            className="text-[12px] text-gray-400 hover:text-gray-700">rename</button>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="my-1 border-t border-gray-100" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createFolder() }}
                      placeholder="New folder"
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-[14px]" />
                    <button onClick={createFolder} disabled={creatingFolder || !newFolderName.trim()}
                      className="text-[14px] text-[var(--green)] disabled:text-gray-300">Add</button>
                  </div>
                  {/* Drive connection is its own run. Shown because the page's shape is the
                      promise; greyed and inert because it does not work yet. */}
                  <div className="cursor-not-allowed px-3 py-1.5 text-[14px] text-gray-300" title="Not connected yet">
                    Connect your drive
                  </div>
                </div>
              </>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-[14px] text-gray-500">
            Group by
            <select value={groupBy}
              onChange={(e) => { setGroupBy(e.target.value as GroupBy); setShowAll(new Set()) }}
              className={controlClass}>
              <option value="status">Status</option>
              <option value="agency">Agency</option>
              <option value="subject">Subject</option>
              <option value="kind">Kind</option>
              <option value="site">Site</option>
              <option value="folder">Folder</option>
              <option value="none">None</option>
            </select>
          </label>

          {/* Only when there is a choice to make. */}
          {sites.length > 1 && (
            <label className="flex items-center gap-1.5 text-[14px] text-gray-500">
              Site
              <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className={controlClass}>
                <option value="all">All sites</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}

          <div className="ml-auto flex items-center gap-3">
            {progress && <span className="text-[12px] text-gray-500">{progress}</span>}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="rounded-md bg-[var(--green)] px-5 py-2.5 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50">
              {uploading ? 'Working…' : 'Add files'}
            </button>
            <button onClick={() => folderInputRef.current?.click()} disabled={uploading}
              className="text-[14px] text-gray-600 underline hover:text-gray-900 disabled:text-gray-300">
              Add a folder
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-[13px] text-[var(--amber)]">{error}</p>}

        {loading ? (
          <p className="mt-8 text-[14px] text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-8 text-[14px] text-gray-500">
            Nothing here yet. Add a file and we will read it and tell you what it is.
          </p>
        ) : groupBy === 'none' ? (
          <table className="mt-5 w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                {([['title', 'Document'], ['kind', 'Kind'], ['site', 'Site'], ['date', 'Date'], ['status', 'Status']] as const)
                  .map(([k, label]) => (
                    <th key={k} className="pb-2 text-[12px] font-medium uppercase tracking-wide text-gray-400">
                      <button onClick={() => { setSortKey(k); setSortDir(sortKey === k && sortDir === 'asc' ? 'desc' : 'asc') }}
                        className="hover:text-gray-700">
                        {label}{sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {flat.map((r) => (
                <tr key={r.document_id} className="border-b border-gray-100 hover:bg-white">
                  <td className="py-2.5 text-[13px] text-gray-900">
                    <button onClick={() => expand(r)} className="text-left hover:text-[var(--green)]">{r.title}</button>
                    <span className="block text-[12px] text-gray-500">{r.file_name}</span>
                  </td>
                  <td className="py-2.5 text-[12px] text-gray-600">{r.kind ? (KIND_LABEL[r.kind] ?? r.kind) : '—'}</td>
                  <td className="py-2.5 text-[12px] text-gray-600">{r.site_name ?? '—'}</td>
                  <td className="py-2.5 text-[12px] text-gray-600">{fmtDate(r.significant_date) || '—'}</td>
                  <td className={`py-2.5 text-[13px] ${AMBER_STATUSES.has(r.display_status) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                    {statusWord(r)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mt-5">
            {groups.map((g) => {
              const opened = showAll.has(g.key)
              const visible = opened ? g.rows : g.rows.slice(0, COLLAPSE_AT)
              return (
                <section key={g.key} className="mb-7">
                  <h2 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-gray-400">
                    {g.label} <span className="ml-1 text-gray-300">{g.rows.length}</span>
                  </h2>
                  <div>{visible.map((r) => <Row key={`${g.key}-${r.document_id}`} r={r} />)}</div>
                  {g.rows.length > COLLAPSE_AT && !opened && (
                    <button onClick={() => setShowAll((s) => new Set(s).add(g.key))}
                      className="mt-1.5 text-[12px] text-gray-600 underline hover:text-gray-900">
                      Show all {g.rows.length}
                    </button>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
