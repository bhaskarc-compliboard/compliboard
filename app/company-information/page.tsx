'use client'

/**
 * COMPANY INFORMATION — the settled record, with the confirmation queue folded into the top of it.
 * Task 0, commit 2. Boards D and C of "CompliBoard Audits — the boards".
 *
 * *** WHY THE QUEUE LIVES HERE AND "TO CONFIRM" IS GONE. ***
 * They were one thing pretending to be two. "To confirm" was a list of questions about the company
 * with no way to see the company, and the answers it collected disappeared into tables no screen
 * showed. A person answering "is this your address?" wants to see the address they already gave;
 * a person reading their record wants the questions that would complete it. One page, the questions
 * at the top because they are the only part that asks for anything.
 *
 * *** EVERY LINE CAME FROM A PERSON. *** Declared facts are answers somebody typed; confirmed facts
 * are readings somebody agreed with. Nothing a model concluded on its own appears here — pending
 * proposals are in the queue as QUESTIONS, never in the record as facts (`DECISIONS.md` §108, §141).
 * That is why the page can say "Nothing here was guessed" and mean it.
 *
 * *** THE PRODUCT DOES NOT NAME WHAT DOES THE READING. *** It reads, finds, asks and says. There is
 * no mention on this page of what performs the reading, in any wording, empty state or error —
 * `docs/HANDOFF-AUDITS.md` §5. A person confirming a fact about their own business is not helped by
 * being told what read it; they are helped by the quote and the page it came from.
 *
 * ONE READ FOR THE RECORD (`/api/company-information`, built on `lib/companyContext.ts` so this screen and
 * every prompt see the same assembly) and ONE FOR THE QUEUE (`/api/to-confirm`, unchanged — the
 * same route the report drawer answers through, so a fact confirmed here and there is one row
 * changing state). No model call on this page.
 */

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
// The question lines and their order, in one place, because the sidebar badge counts the same lines
// this page draws. See lib/confirmationQueue.ts for why that is a file.
import { questionLines, type QuestionLine } from '@/lib/confirmationQueue'

// ---------------------------------------------------------------------------
// what the two reads return
// ---------------------------------------------------------------------------
interface QueueSource {
  proposal_id: string
  value: string
  quote: string | null
  quote_verified: boolean | null
  locator: string | null
  basis: string
  affects: string | null
  created_at: string
  document_id: string | null
  entity_id: string | null
  site: string | null
  as_of: string | null
  from: { kind: 'document' | 'conversation'; title: string; locator: string | null }
}
interface QueueKey {
  key: string
  is_switch: boolean
  sources: QueueSource[]
  source_count: number
  value: string | null
  agree: boolean
  affects: string | null
}
interface Site {
  id: string; name: string; address: string | null; state: string | null
  county: string | null; city: string | null; primary: boolean
}
interface Declared {
  switchId: string; label: string; value: string; scope: 'company' | 'site'
  entityId: string | null; siteName: string | null; question: string | null; source: string | null
  domain: string | null; topic: string; valueType: string | null; allowedValues: string[]
}
interface Confirmed {
  key: string; value: string; basis: string; entityId: string | null; siteName: string | null
  asOf: string | null; sourceDocumentTitle: string | null; sourceDocumentId: string | null
  sourceProposalId: string | null; locator: string | null
}
interface Record_ {
  company: {
    name: string; industrySlug: string | null; industryWords: string | null
    address: string | null; state: string | null; sites: Site[]
  }
  declared: Declared[]
  confirmed: Confirmed[]
  counts: { settled: number; declared: number; confirmed: number; waiting: number }
}

/**
 * *** FIVE QUESTIONS, AND THE PAGE SAYS SO. ***
 * `WORKSPACE.md` §7.5's argument, one number up from the old queue's three: a queue of forty is a
 * queue nobody opens. Three was right when a question was one fact; a document group is one
 * question standing for six, so five lines is a similar amount of work. A queue whose limit is
 * invisible reads as a queue that is nearly done, which is why the limit is printed beside the
 * heading rather than inferred from a "Show more" button.
 */
const SHOW = 5

type GroupBy = 'topic' | 'site' | 'document' | 'source'

/** A value as a person reads it. Booleans become Yes and No; everything else is shown AS STORED.
 *  The switch library carries `allowed_values` and no labels for them, so there is nothing to
 *  render an enum through — `title_v` is shown as `title_v` rather than as a guess at what it is
 *  called. When labels exist in the library, this is the one place that changes. */
function plainValue(value: string, valueType: string | null): string {
  if (valueType === 'boolean') {
    if (value === 'true') return 'Yes'
    if (value === 'false') return 'No'
  }
  return value
}

const keyWords = (k: string) => k.replace(/_/g, ' ')

export default function YourCompanyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[14px] text-gray-400">Loading…</div>}>
      <YourCompanyContent />
    </Suspense>
  )
}

function YourCompanyContent() {
  const [rec, setRec] = useState<Record_ | null>(null)
  const [queue, setQueue] = useState<QueueKey[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [industries, setIndustries] = useState<string[]>([])

  const [openQ, setOpenQ] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const [siteFilter, setSiteFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('topic')
  const [find, setFind] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const [editingCompany, setEditingCompany] = useState(false)
  const [companyDraft, setCompanyDraft] = useState({ name: '', industry: '', city: '', state: '' })
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [lineDraft, setLineDraft] = useState('')

  const load = useCallback(async () => {
    try {
      const h = await authHeaders()
      const [r, q] = await Promise.all([
        fetch('/api/company-information', { headers: h }),
        fetch('/api/to-confirm', { headers: h }),
      ])
      if (r.ok) setRec(await r.json())
      if (q.ok) setQueue((await q.json()).keys ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  // The same list signup offers, so an industry edited here can only be one the product serves.
  useEffect(() => {
    fetch('/api/industries').then((r) => r.json())
      .then((d) => setIndustries(d.industries ?? [])).catch(() => {})
  }, [])

  // -------------------------------------------------------------------------
  // THE QUESTION LINES
  //
  // A key is LIFTED OUT of its document group when the product does not know the answer: its own
  // sources disagree, or it disagrees with something already settled for that key and that site.
  // Both are the same event from a person's side — "you have two different answers to this" — and
  // burying either inside "the permit says 6 things about you" would be the page hiding the only
  // question on it that it genuinely cannot answer.
  // -------------------------------------------------------------------------
  const settledFor = useCallback((key: string, entityId: string | null): string | null => {
    if (!rec) return null
    const c = rec.confirmed.find((f) => f.key === key && (f.entityId ?? null) === entityId)
    if (c) return c.value
    const d = rec.declared.find((f) => f.switchId === key && (f.entityId ?? null) === entityId)
    return d ? d.value : null
  }, [rec])

  const lines: Array<QuestionLine<QueueKey>> =
    useMemo(() => questionLines(queue, settledFor), [queue, settledFor])

  const visible = lines.slice(0, SHOW)
  const moreWaiting = lines.length - visible.length

  // -------------------------------------------------------------------------
  // answering — the existing routes, unchanged
  // -------------------------------------------------------------------------
  async function answer(key: string, verdict: 'accepted' | 'rejected', opts?: { why?: string; value?: string }) {
    setBusy(true)
    try {
      const res = await fetch('/api/to-confirm', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key, verdict, reason: opts?.why, value: opts?.value }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not save that just now.'); return }
      setNotice(null); setRejecting(null); setReason('')
      await load()
    } finally { setBusy(false) }
  }

  /** ONE AFTER ANOTHER, NOT IN PARALLEL, and a key already settled by an earlier call is skipped
   *  rather than reported as a failure: Confirm settles a KEY, so two facts in this group that
   *  share a key are one decision and the second call correctly finds nothing pending. */
  async function confirmAll(keys: QueueKey[]) {
    setBusy(true)
    try {
      const h = await authHeaders({ 'Content-Type': 'application/json' })
      let failed: string | null = null
      for (const k of keys) {
        const res = await fetch('/api/to-confirm', {
          method: 'POST', headers: h,
          body: JSON.stringify({ key: k.key, verdict: 'accepted' }),
        })
        if (!res.ok && res.status !== 404) {
          const j = await res.json().catch(() => null)
          failed = j?.error ?? 'We could not save one of those.'
          break
        }
      }
      setNotice(failed)
      await load()
    } finally { setBusy(false) }
  }

  async function saveCompany() {
    setBusy(true)
    try {
      const res = await fetch('/api/company-information', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'company', ...companyDraft }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not save that just now.'); return }
      setEditingCompany(false); setNotice(null); await load()
    } finally { setBusy(false) }
  }

  async function saveLine(payload: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch('/api/company-information', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not save that just now.'); return }
      setEditingLine(null); setNotice(null); await load()
    } finally { setBusy(false) }
  }

  // -------------------------------------------------------------------------
  // THE RECORD
  // -------------------------------------------------------------------------
  const industryText = (slug: string | null, words: string | null) =>
    !slug ? 'not recorded' : words ? `${words} (${slug})` : slug

  type RecordLine = {
    id: string; label: string; value: string; site: string | null; siteId: string | null
    meta: string; group: string; sortKey: string
    edit: { kind: 'declared'; d: Declared } | { kind: 'confirmed'; f: Confirmed }
    documentTitle?: string | null; documentId?: string | null
  }

  const recordLines = useMemo<RecordLine[]>(() => {
    if (!rec) return []
    const out: RecordLine[] = []

    for (const d of rec.declared) {
      out.push({
        id: `d:${d.switchId}:${d.entityId ?? 'co'}`,
        label: d.label,
        value: plainValue(d.value, d.valueType),
        site: d.siteName, siteId: d.entityId,
        // "you answered" plus the question it answered, so a line nobody remembers giving can be
        // recognised by the question rather than by its key.
        meta: d.question ? `you answered · ${d.question}` : 'you answered',
        group: groupBy === 'topic' ? d.topic
             : groupBy === 'site' ? (d.siteName ?? 'The whole company')
             : groupBy === 'document' ? 'Not from a document'
             : 'You answered',
        sortKey: d.label,
        edit: { kind: 'declared', d },
      })
    }

    for (const f of rec.confirmed) {
      const bits = [
        f.asOf ? `as of ${f.asOf}` : null,
        f.locator,
        // `declared` means a person typed over what the document said (migration 056). The record
        // has to say that, or the line claims a provenance it lost.
        f.basis === 'declared' ? 'you corrected this' : null,
        f.basis === 'inferred' ? 'worked out from the document, not stated in it' : null,
      ].filter(Boolean)
      out.push({
        id: `f:${f.key}:${f.entityId ?? 'co'}`,
        label: keyWords(f.key),
        value: f.value,
        site: f.siteName, siteId: f.entityId,
        meta: bits.join(' · '),
        group: groupBy === 'topic' ? 'Confirmed from documents'
             : groupBy === 'site' ? (f.siteName ?? 'The whole company')
             : groupBy === 'document' ? (f.sourceDocumentTitle ?? 'Not from a document')
             : (f.basis === 'declared' ? 'You answered' : 'Confirmed from a document'),
        sortKey: keyWords(f.key),
        edit: { kind: 'confirmed', f },
        documentTitle: f.sourceDocumentTitle,
        documentId: f.sourceDocumentId,
      })
    }

    return out
  }, [rec, groupBy])

  const filtered = useMemo(() => {
    const q = find.trim().toLowerCase()
    return recordLines.filter((l) => {
      if (siteFilter !== 'all' && l.siteId !== siteFilter) return false
      if (!q) return true
      return [l.label, l.value, l.site ?? '', l.meta, l.documentTitle ?? '']
        .join(' ').toLowerCase().includes(q)
    })
  }, [recordLines, siteFilter, find])

  const groups = useMemo(() => {
    const m = new Map<string, RecordLine[]>()
    for (const l of filtered) {
      if (!m.has(l.group)) m.set(l.group, [])
      m.get(l.group)!.push(l)
    }
    for (const v of m.values()) v.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || (a.site ?? '').localeCompare(b.site ?? ''))
    // "Confirmed from documents" sits last under Topic — it is one heading standing for a different
    // kind of certainty, and putting it among the topics would imply it is one.
    return [...m.entries()].sort((a, b) => {
      const last = (n: string) => (n === 'Confirmed from documents' || n === 'Not from a document' ? 1 : 0)
      return last(a[0]) - last(b[0]) || a[0].localeCompare(b[0])
    })
  }, [filtered])

  /** A group opens on click, and opens BY ITSELF when Find matched something inside it — a filter
   *  that leaves every match folded away has not filtered anything. */
  const searching = find.trim().length > 0
  const isOpen = (name: string) => searching || openGroups.has(name)

  /** The one-line summary on a folded heading: enough to recognise the group without opening it.
   *  Two lines, then "and N more" — a summary that lists everything is the group unfolded. */
  const summarise = (ls: RecordLine[]) =>
    ls.slice(0, 2).map((l) => `${l.label}${l.site ? ` (${l.site})` : ''}: ${l.value}`).join(' · ')
    + (ls.length > 2 ? ` · and ${ls.length - 2} more` : '')

  const controlClass =
    'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[14px] text-gray-700 hover:border-gray-300'
  const sites = rec?.company.sites ?? []
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <AppLayout>
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">

        {/* PRINT ONLY. A printed profile with no company and no date is not evidence of anything —
            the same header the report drawer prints, for the same reason. */}
        <div className="mb-4 hidden border-b border-gray-300 pb-2 print:block">
          {rec?.company.name && <p className="text-[13px] font-semibold text-gray-900">{rec.company.name}</p>}
          <p className="text-[15px] font-medium text-gray-900">Company information</p>
          <p className="text-[11px] text-gray-600">Printed {today} · CompliBoard</p>
        </div>

        <div className="pt-6 print:hidden">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-serif text-[28px] font-normal text-gray-900">Company information</h1>
            {rec && (
              <p className="shrink-0 text-[12px] text-gray-400">
                {rec.counts.settled} {rec.counts.settled === 1 ? 'fact' : 'facts'} settled
                {' · '}{rec.counts.waiting} waiting
              </p>
            )}
          </div>
          <p className="mt-1 text-[14px] text-gray-500">
            What CompliBoard knows about your company. Every line came from you, or from a document
            you confirmed. Nothing here was guessed.
          </p>
        </div>

        {notice && (
          <p className="no-print mt-4 rounded-lg bg-[var(--amber-wash)] px-3 py-2 text-[13px] text-gray-800">{notice}</p>
        )}

        {loading ? (
          <p className="mt-8 text-[14px] text-gray-400">Loading…</p>
        ) : !rec ? (
          <p className="mt-8 text-[14px] text-gray-500">
            We could not load your company just now. Reload the page and it should come back.
          </p>
        ) : (
          <>
            {/* ============================ WAITING FOR YOU ============================ */}
            {lines.length > 0 && (
              <section className="no-print mt-7">
                <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 pb-2">
                  <h2 className="text-[12px] font-medium uppercase tracking-wide text-gray-500">
                    Waiting for you <span className="ml-1 text-gray-400">{lines.length}</span>
                  </h2>
                  <p className="shrink-0 text-[12px] text-gray-400">
                    Up to five questions show here. The rest come up as you answer.
                  </p>
                </div>

                <div className="divide-y divide-gray-100">
                  {visible.map((line) => {
                    if (line.kind === 'document') {
                      const open = openQ.has(line.id)
                      return (
                        <div key={line.id} className="py-4">
                          <button onClick={() => setOpenQ((s) => {
                              const n = new Set(s); n.has(line.id) ? n.delete(line.id) : n.add(line.id); return n
                            })}
                            className="flex w-full items-start gap-2 text-left">
                            <span className="mt-0.5 shrink-0 text-[11px] text-gray-300">{open ? '▼' : '▶'}</span>
                            <span className="text-[14px] text-gray-900">
                              The {line.title} says {line.keys.length}{' '}
                              {line.keys.length === 1 ? 'thing' : 'things'} about you. Are they right?
                            </span>
                          </button>

                          {open && (
                            <div className="mt-3 pl-5">
                              <button disabled={busy} onClick={() => confirmAll(line.keys)}
                                className="rounded-md bg-[var(--green)] px-4 py-2 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50">
                                Confirm all {line.keys.length}
                              </button>
                              <ul className="mt-3 divide-y divide-gray-100">
                                {line.keys.map((k) => {
                                  const s = k.sources[0]
                                  return (
                                    <li key={k.key} className="py-2.5">
                                      <p className="text-[14px] text-gray-900">
                                        {keyWords(k.key)}{k.sources[0]?.site ? ` (${k.sources[0].site})` : ''}:{' '}
                                        <span className="font-medium">{k.value}</span>
                                        {s?.as_of && <>, as of {s.as_of}. Is that still right?</>}
                                      </p>
                                      <p className="mt-0.5 text-[12px] text-gray-400">
                                        {s?.basis === 'inferred'
                                          ? `inferred from ${s.from.title}`
                                          : s?.quote ? 'quoted' : 'read in the document'}
                                        {s?.locator ? ` · ${s.locator}` : ''}
                                      </p>
                                      {s?.quote && (
                                        <p className="mt-0.5 pl-3 text-[12px] italic text-gray-400">“{s.quote}”</p>
                                      )}
                                      {s?.quote_verified === false && (
                                        <p className="mt-0.5 pl-3 text-[12px] text-[var(--amber)]">
                                          these words were not found in the file
                                        </p>
                                      )}
                                      <div className="mt-1.5 flex items-center gap-4">
                                        <button disabled={busy} onClick={() => answer(k.key, 'accepted')}
                                          className="text-[13px] text-[var(--green)] disabled:text-gray-300">Confirm</button>
                                        <button onClick={() => setRejecting(k.key)}
                                          className="text-[13px] text-gray-600 underline hover:text-gray-900">Not right</button>
                                      </div>
                                      {rejecting === k.key && (
                                        <RejectBox reason={reason} setReason={setReason} busy={busy}
                                          onCancel={() => { setRejecting(null); setReason('') }}
                                          onSave={() => answer(k.key, 'rejected', { why: reason.trim() })} />
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      )
                    }

                    if (line.kind === 'disagreement') {
                      const k = line.k
                      const values = [...new Set(k.sources.map((s) => s.value))]
                      return (
                        <div key={line.id} className="py-4">
                          <p className="text-[14px] text-gray-900">
                            {keyWords(k.key)}{k.sources[0]?.site ? ` (${k.sources[0].site})` : ''} —{' '}
                            <span className="text-[var(--amber)]">
                              {line.settled !== null ? 'this is not what we have' : 'we have two different answers'}
                            </span>
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {line.settled !== null && (
                              <li className="text-[12px] text-gray-500">
                                <span className="font-medium text-gray-800">{line.settled}</span>
                                {' — '}what you have settled
                              </li>
                            )}
                            {k.sources.map((s) => (
                              <li key={s.proposal_id} className="text-[12px] text-gray-500">
                                <span className="font-medium text-gray-800">{s.value}</span>
                                {' — '}{s.from.kind === 'document' ? s.from.title : 'a conversation'}
                                {s.locator ? ` · ${s.locator}` : ''}
                                {s.as_of ? ` · as of ${s.as_of}` : ''}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 flex flex-wrap items-center gap-4">
                            {values.map((v) => (
                              <button key={v} disabled={busy} onClick={() => answer(k.key, 'accepted', { value: v })}
                                className="text-[13px] text-[var(--green)] disabled:text-gray-300">
                                Confirm “{v}”
                              </button>
                            ))}
                            <button onClick={() => setRejecting(k.key)}
                              className="text-[13px] text-gray-600 underline hover:text-gray-900">Not right</button>
                          </div>
                          {rejecting === k.key && (
                            <RejectBox reason={reason} setReason={setReason} busy={busy}
                              onCancel={() => { setRejecting(null); setReason('') }}
                              onSave={() => answer(k.key, 'rejected', { why: reason.trim() })} />
                          )}
                        </div>
                      )
                    }

                    const k = line.k
                    const s = k.sources[0]
                    return (
                      <div key={line.id} className="py-4">
                        <p className="text-[14px] text-gray-900">
                          {keyWords(k.key)}{s?.site ? ` (${s.site})` : ''}:{' '}
                          <span className="font-medium">{k.value}</span>
                          {s?.as_of && <>, as of {s.as_of}. Is that still right?</>}
                        </p>
                        <p className="mt-0.5 text-[12px] text-gray-400">
                          {k.sources.map((x) => x.from.title).join(' · ')}
                        </p>
                        <div className="mt-1.5 flex items-center gap-4">
                          <button disabled={busy} onClick={() => answer(k.key, 'accepted')}
                            className="text-[13px] text-[var(--green)] disabled:text-gray-300">Confirm</button>
                          <button onClick={() => setRejecting(k.key)}
                            className="text-[13px] text-gray-600 underline hover:text-gray-900">Not right</button>
                        </div>
                        {rejecting === k.key && (
                          <RejectBox reason={reason} setReason={setReason} busy={busy}
                            onCancel={() => { setRejecting(null); setReason('') }}
                            onSave={() => answer(k.key, 'rejected', { why: reason.trim() })} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {moreWaiting > 0 && (
                  <p className="mt-3 text-[12px] text-gray-400">{moreWaiting} more waiting.</p>
                )}
              </section>
            )}

            {/* ============================== THE COMPANY ============================== */}
            <section className="mt-8">
              <h2 className="border-b border-gray-200 pb-2 text-[12px] font-medium uppercase tracking-wide text-gray-500">
                Company
              </h2>

              <div className="border-b border-gray-100 py-4">
                {editingCompany ? (
                  <div className="max-w-[520px] space-y-2">
                    <input value={companyDraft.name} onChange={(e) => setCompanyDraft({ ...companyDraft, name: e.target.value })}
                      placeholder="Company name" className="w-full rounded border border-gray-200 px-2 py-1.5 text-[14px]" />
                    <select value={companyDraft.industry} onChange={(e) => setCompanyDraft({ ...companyDraft, industry: e.target.value })}
                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-[14px]">
                      <option value="">Select your industry</option>
                      {industries.map((s) => <option key={s} value={s}>{s}</option>)}
                      <option value="other">other</option>
                    </select>
                    <div className="flex gap-2">
                      <input value={companyDraft.city} onChange={(e) => setCompanyDraft({ ...companyDraft, city: e.target.value })}
                        placeholder="City" className="w-1/2 rounded border border-gray-200 px-2 py-1.5 text-[14px]" />
                      <input value={companyDraft.state} onChange={(e) => setCompanyDraft({ ...companyDraft, state: e.target.value })}
                        placeholder="State" className="w-1/2 rounded border border-gray-200 px-2 py-1.5 text-[14px]" />
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <button disabled={busy} onClick={saveCompany}
                        className="text-[13px] text-[var(--green)] disabled:text-gray-300">Save</button>
                      <button onClick={() => setEditingCompany(false)}
                        className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[14px] text-gray-900">{rec.company.name || 'not recorded'}</p>
                      <p className="mt-0.5 text-[12px] text-gray-500">
                        {industryText(rec.company.industrySlug, rec.company.industryWords)}
                        {rec.company.address ? ` · ${rec.company.address}` : ''}
                      </p>
                    </div>
                    <button className="no-print shrink-0 text-[13px] text-gray-600 underline hover:text-gray-900"
                      onClick={() => {
                        setCompanyDraft({
                          name: rec.company.name ?? '',
                          industry: rec.company.industrySlug ?? '',
                          city: (rec.company.address ?? '').split(',')[0]?.trim() ?? '',
                          state: rec.company.state ?? '',
                        })
                        setEditingCompany(true)
                      }}>Edit</button>
                  </div>
                )}
              </div>

              <h2 className="mt-6 border-b border-gray-200 pb-2 text-[12px] font-medium uppercase tracking-wide text-gray-500">
                Sites <span className="ml-1 text-gray-400">{sites.length}</span>
              </h2>
              <div className="divide-y divide-gray-100">
                {sites.map((s) => (
                  <div key={s.id} className="py-3">
                    <p className="text-[14px] text-gray-900">
                      {s.name}
                      {s.primary && <span className="ml-2 text-[12px] text-gray-400">primary</span>}
                    </p>
                    <p className="mt-0.5 text-[12px] text-gray-500">
                      {[s.address, s.city, s.county ? `${s.county} County` : null, s.state]
                        .filter(Boolean).join(', ') || 'no address recorded'}
                    </p>
                  </div>
                ))}
                {/* *** NOT A LINK, BECAUSE THERE IS NOWHERE FOR IT TO GO. ***
                    Nothing in the product creates or edits a site: `grep` finds no insert into
                    `entities` in any page or route. The only site rows come from the trigger that
                    makes one with the company. A greyed "Add a site" that did nothing would be the
                    page promising a screen that does not exist, so it says what is true instead. */}
                <p className="no-print py-3 text-[12px] text-gray-400">
                  Your first site was made with your company. There is no screen for adding or
                  changing a site yet.
                </p>
              </div>
            </section>

            {/* ============================== CONTROLS ============================== */}
            <div className="no-print mt-7 flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4">
              {sites.length > 1 && (
                <label className="flex items-center gap-1.5 text-[14px] text-gray-500">
                  Site
                  <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className={controlClass}>
                    <option value="all">All sites</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-1.5 text-[14px] text-gray-500">
                Group by
                <select value={groupBy} onChange={(e) => { setGroupBy(e.target.value as GroupBy); setOpenGroups(new Set()) }}
                  className={controlClass}>
                  <option value="topic">Topic</option>
                  <option value="site">Site</option>
                  <option value="document">Document</option>
                  <option value="source">Source</option>
                </select>
              </label>
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a fact"
                className="ml-auto w-56 rounded-md border border-gray-200 px-2.5 py-1.5 text-[14px] text-gray-700 placeholder:text-gray-400" />
            </div>

            {/* =============================== THE RECORD =============================== */}
            <section className="mt-5">
              {rec.counts.settled === 0 ? (
                <div className="space-y-3 py-2">
                  {lines.length === 0 && <p className="text-[14px] text-gray-500">Nothing settled yet.</p>}
                  <p className="text-[14px] text-gray-500">
                    Nothing declared yet. Answers you give at signup or during research land here,
                    each with the question it answered and the site it belongs to.
                  </p>
                  <p className="text-[14px] text-gray-500">
                    Nothing confirmed from a document yet. When a reading finds a fact about you, it
                    waits here until you say it is right.
                  </p>
                </div>
              ) : groups.length === 0 ? (
                <p className="py-2 text-[14px] text-gray-500">
                  Nothing here matches “{find.trim()}”.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {groups.map(([name, ls]) => (
                    <div key={name} className="py-3">
                      <button onClick={() => setOpenGroups((s) => {
                          const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n
                        })}
                        className="flex w-full items-start gap-2 text-left">
                        <span className="mt-1 shrink-0 text-[11px] text-gray-300 print:hidden">{isOpen(name) ? '▼' : '▶'}</span>
                        <span className="min-w-0">
                          <span className="text-[12px] font-medium uppercase tracking-wide text-gray-600">{name}</span>
                          <span className="ml-1.5 text-[12px] text-gray-400">{ls.length}</span>
                          {!isOpen(name) && (
                            <span className="mt-0.5 block truncate text-[12px] text-gray-500">{summarise(ls)}</span>
                          )}
                        </span>
                      </button>

                      {(isOpen(name) || true) && (
                        <div className={isOpen(name) ? 'mt-2 divide-y divide-gray-50 pl-5' : 'hidden print:block mt-2 divide-y divide-gray-50 pl-5'}>
                          {ls.map((l) => (
                            <div key={l.id} className="py-2.5">
                              {editingLine === l.id ? (
                                <div className="max-w-[420px]">
                                  {l.edit.kind === 'declared' && l.edit.d.valueType === 'enum' && l.edit.d.allowedValues.length > 0 ? (
                                    <select value={lineDraft} onChange={(e) => setLineDraft(e.target.value)}
                                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-[14px]">
                                      {l.edit.d.allowedValues.map((v) => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                  ) : l.edit.kind === 'declared' && l.edit.d.valueType === 'boolean' ? (
                                    <select value={lineDraft} onChange={(e) => setLineDraft(e.target.value)}
                                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-[14px]">
                                      <option value="true">Yes</option>
                                      <option value="false">No</option>
                                    </select>
                                  ) : (
                                    <input value={lineDraft} onChange={(e) => setLineDraft(e.target.value)}
                                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-[14px]" />
                                  )}
                                  <div className="mt-1.5 flex items-center gap-3">
                                    <button disabled={busy || !lineDraft.trim()}
                                      onClick={() => saveLine(l.edit.kind === 'declared'
                                        ? { action: 'declared', switch_id: l.edit.d.switchId, value: lineDraft.trim(), entity_id: l.edit.d.entityId }
                                        : { action: 'confirmed', key: l.edit.f.key, value: lineDraft.trim(), entity_id: l.edit.f.entityId })}
                                      className="text-[13px] text-[var(--green)] disabled:text-gray-300">Save</button>
                                    <button onClick={() => setEditingLine(null)}
                                      className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-[14px] text-gray-900">
                                      {l.label}{l.site ? <span className="text-gray-500"> ({l.site})</span> : ''}:{' '}
                                      <span className="font-medium">{l.value}</span>
                                    </p>
                                    <p className="mt-0.5 text-[12px] text-gray-400">
                                      {l.meta}
                                      {l.documentId && l.documentTitle && (
                                        <>
                                          {l.meta ? ' · ' : ''}
                                          <a href={`/documents?document=${l.documentId}`}
                                            className="underline hover:text-gray-700">{l.documentTitle}</a>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  <button className="no-print shrink-0 text-[13px] text-gray-600 underline hover:text-gray-900"
                                    onClick={() => {
                                      setEditingLine(l.id)
                                      setLineDraft(l.edit.kind === 'declared' ? l.edit.d.value : l.edit.f.value)
                                    }}>Edit</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  )
}

/** A reason is required to reject, here and in the drawer, for the same reason: "not right" with no
 *  sentence is a finding buried rather than answered. */
function RejectBox({ reason, setReason, busy, onSave, onCancel }: {
  reason: string; setReason: (v: string) => void; busy: boolean
  onSave: () => void; onCancel: () => void
}) {
  return (
    <div className="mt-2 rounded-lg bg-gray-50 p-2.5">
      <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
        placeholder="Why is this not right?"
        className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-[13px]" />
      <div className="mt-1.5 flex items-center gap-3">
        <button disabled={!reason.trim() || busy} onClick={onSave}
          className="text-[13px] text-[var(--green)] disabled:text-gray-300">Save</button>
        <button onClick={onCancel} className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
      </div>
    </div>
  )
}
