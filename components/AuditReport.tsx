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
/**
 * Documents' own amber statuses, the same set `app/audits/page.tsx` carries. Duplicated rather than
 * imported because that file is a page, not a module — importing from it would pull a client page
 * into this component. If a third copy is ever wanted, the set moves to a module first.
 */
const AMBER_DOC = new Set(['needs_work', 'expiring', 'expired', 'could_not_read'])
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
  /** A template finding answers a checklist line; an agency finding leaves both null. */
  template_line: string | null; template_text: string | null
  word: string | null; basis: string | null
  document_id: string | null; document: DocRef | null
  document_b_id: string | null; document_b: DocRef | null
  locator: string | null; quote: string | null; quote_verified: boolean | null
  what_to_do: string | null; due_on: string | null; recurs: boolean | null; passed: boolean | null
  value_a: string | null; value_b: string | null
  status: string; same_as: string | null; dismissed_reason: string | null; handle_error: boolean
  /** Other sections of this run that raised the same thing (migration 061, Run 7b item 5). */
  also_in_sections?: string[] | null
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
interface TemplateSection { title: string; lines: Array<{ ref: string; text: string }> }
interface Run {
  id: string; kind: string; scope: string | null; agency_label: string | null; status: string
  template_document_id: string | null; template_lines: TemplateSection[] | null
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

/**
 * ONE FINDING, ONE LINE — Audits Run 7b, item 4.
 *
 * It was five lines: title, then word · document · locator, then the quote, then what to do, then
 * two actions. Forty-three of those is the wall the owner saw. A finding is now **the word and the
 * title**, and everything else appears when you click it.
 *
 * *** THE DETAIL IS RENDERED AND HIDDEN, NOT UNMOUNTED. *** `hidden print:block` means a printed
 * report carries every finding in full whether or not anybody expanded it on screen — the same rule
 * `Section_` follows, and for the same reason: a printed report with a collapsed finding is a report
 * missing its evidence, and nobody reading it on paper can click.
 */
function FindingLine({ f, open, onToggle, onOpenDoc, onNotRight, reasonOpen, onCancelReason, onSaveReason, highlight, alsoUnder, off }: {
  f: Finding
  /** The other agencies that raised this same finding, already joined into words. */
  alsoUnder?: string | null
  open: boolean
  onToggle: () => void
  onOpenDoc: (documentId: string) => void
  onNotRight: () => void
  reasonOpen: boolean
  onCancelReason: () => void
  onSaveReason: (r: string) => void
  highlight?: boolean
  /**
   * Filtered out on screen. **Hidden, not unmounted** — a printed report carries every finding
   * whatever the reader had filtered to when they pressed Print, which is the same rule the
   * expanded detail follows.
   */
  off?: boolean
}) {
  const word = f.word
    ? <span className={AMBER_WORD.has(f.word) ? 'text-[var(--amber)]' : 'text-gray-600'}>{WORD[f.word] ?? f.word}</span>
    : <span className="text-[var(--amber)]">no answer</span>
  return (
    <div className={`border-b border-gray-100 last:border-b-0 ${highlight ? 'bg-amber-50/40' : ''} ${
      off ? 'hidden print:block' : ''}`}>
      {/* The whole line is the control. A title that is clickable only on its first few words is a
          control nothing announces (the same note the Audits page carries about its agency rows). */}
      <div role="button" tabIndex={0} onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        className="flex cursor-pointer items-baseline gap-2 py-1.5 hover:bg-gray-50">
        <span className={`no-print w-3 shrink-0 text-[11px] text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        <span className="shrink-0 text-[12px]">{word}</span>
        <span className="min-w-0 flex-1 truncate text-[14px] text-gray-900" title={f.title}>
          {f.template_line ? <span className="mr-2 font-medium text-gray-500">{f.template_line}</span> : null}
          {f.template_text ?? f.title}
        </span>
        {alsoUnder && (
          /* *** THE SAME FINDING, SHOWN ONCE UNDER EACH AGENCY IT BELONGS TO — Run 7b, item 5. ***
             Two regulators wanting the same record is a fact about the company, not a mistake, and
             a person reading the OSHA group should know the Department of Agriculture wants it too.
             Grey, after the title, because it is context and not the finding. */
          <span className="shrink-0 text-[11px] text-gray-400">also under {alsoUnder}</span>
        )}
        {f.handle_error && (
          <span className="shrink-0 text-[11px] text-[var(--amber)]">no document matched</span>
        )}
      </div>

      <div className={open ? 'pb-3 pl-5' : 'hidden pb-3 pl-5 print:block'}>
        {/* The full title, because the line above it is truncated. */}
        <p className="text-[13px] text-gray-800">{f.template_text ? f.title : null}</p>
        <p className="text-[12px] text-gray-500">
          {f.document && (
            <button onClick={(e) => { e.stopPropagation(); f.document_id && onOpenDoc(f.document_id) }}
              title={f.document.title}
              className="cursor-pointer text-gray-600 hover:underline hover:text-gray-900">
              {f.document.title}
            </button>
          )}
          {f.locator ? <span>{f.document ? ' · ' : ''}{f.locator}</span> : null}
          {f.basis === 'inferred' && <span className="text-gray-400"> · worked out, not stated</span>}
        </p>
        {f.quote && <p className="mt-1 text-[13px] italic text-gray-600">&ldquo;{f.quote}&rdquo;</p>}
        {f.what_to_do && <p className="mt-1 text-[13px] text-gray-700">{f.what_to_do}</p>}
        <div className="no-print mt-1.5 flex items-center gap-4">
          {f.word === 'nothing_on_file' && (
            <a href={`/documents?add=${encodeURIComponent(f.title)}`} onClick={(e) => e.stopPropagation()}
              className="text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">Add a document</a>
          )}
          <button onClick={(e) => { e.stopPropagation(); onNotRight() }}
            className="text-[13px] text-gray-500 hover:text-gray-800">Not right</button>
        </div>
        {reasonOpen && <ReasonBox onCancel={onCancelReason} onSave={onSaveReason} />}
      </div>
    </div>
  )
}

/**
 * THE DOCUMENT ONCE, THEN ITS FINDINGS — Audits Run 7b, item 4.
 *
 * Every finding used to repeat the document it cites, so eleven findings about one permit printed
 * its title eleven times. The title goes above them once, **left-aligned, one line, truncated** —
 * the owner's review found a centred document line, and `TITLE_LINE` is the class the rest of the
 * product already uses for exactly this.
 */
function DocGroup({ doc, docId, children, onOpenDoc, off }: {
  doc: DocRef | null; docId: string | null; children: React.ReactNode
  onOpenDoc: (documentId: string) => void
  /** Every finding under it is filtered out. Hidden on screen, printed anyway. */
  off?: boolean
}) {
  return (
    <div className={`mt-3 first:mt-0 ${off ? 'hidden print:block' : ''}`}>
      <div className="flex items-baseline gap-2 border-b border-gray-200 pb-0.5">
        {doc && docId ? (
          <button onClick={() => onOpenDoc(docId)} title={doc.title} className={`min-w-0 flex-1 ${TITLE_LINE}`}>
            {doc.title}
          </button>
        ) : (
          <p className="min-w-0 flex-1 text-left text-[13px] text-gray-500">Not tied to one document</p>
        )}
        {doc?.display_status && (
          <p className={`shrink-0 text-[12px] ${
            AMBER_DOC.has(doc.display_status) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
            {DOC_STATUS[doc.display_status] ?? doc.display_status}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * THE COUNTS BY WORD, AS FILTERS — Audits Run 7b, item 4.
 *
 * The owner's live report was 43 findings in one unfolded list. Counts at the top are the shape of
 * the answer; making each one narrow the groups below is what turns "43 findings" into "show me the
 * eleven with nothing on file". "all" clears it, and is shown as selected when nothing is filtered,
 * so the control always says which state it is in rather than leaving a person to infer it from
 * nothing being highlighted.
 */
function WordFilter({ counts, value, onChange, extra }: {
  counts: Array<{ word: string; label: string; n: number }>
  value: string | null
  onChange: (w: string | null) => void
  extra?: React.ReactNode
}) {
  const live = counts.filter((c) => c.n > 0)
  if (!live.length) return <p className="text-[13px] text-gray-600">Nothing was answered.</p>
  const pill = (on: boolean) =>
    `rounded-full px-2 py-0.5 text-[12px] transition-colors ${
      on ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
  return (
    <div className="no-print flex flex-wrap items-center gap-1.5">
      <button onClick={() => onChange(null)} className={pill(value === null)}>all</button>
      {live.map((c) => (
        <button key={c.word} onClick={() => onChange(value === c.word ? null : c.word)}
          className={pill(value === c.word)}>
          {c.n} {c.label}
        </button>
      ))}
      {extra}
    </div>
  )
}

/** The same counts as plain text, for print — a pill row prints as a row of grey boxes. */
function WordCountsPrint({ counts }: { counts: Array<{ word: string; label: string; n: number }> }) {
  const bits = counts.filter((c) => c.n > 0).map((c) => `${c.n} ${c.label}`)
  if (!bits.length) return null
  return <p className="hidden text-[13px] text-gray-700 print:block">{bits.join(' · ')}</p>
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
  /**
   * Earlier runs against the SAME checklist, with which lines moved. The comparison is by
   * `template_line`, which is the only thing that makes two runs comparable — see migration 059.
   */
  const [earlierTemplate, setEarlierTemplate] = useState<Array<{
    run: Run; changed: Array<{ ref: string; was: string | null; now: string | null }> }>>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  /**
   * WHICH WORD IS BEING SHOWN, AND WHICH FINDINGS ARE EXPANDED — Audits Run 7b, item 4.
   *
   * `focusWord` is what the Audits page passes when somebody clicks a count in an agency's
   * sentence, so it is the filter's starting value rather than a highlight. It used to tint the
   * matching rows amber and leave the other forty of them on screen, which is a highlight in a wall
   * of text; filtering is what the person asked for by clicking a number.
   */
  const [wordFilter, setWordFilter] = useState<string | null>(focusWord ?? null)
  const [openFinding, setOpenFinding] = useState<Record<string, boolean>>({})
  const toggleFinding = (id: string) => setOpenFinding((o) => ({ ...o, [id]: !o[id] }))

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
      const all: Run[] = json.runs ?? []
      if (rep.run.kind === 'template') {
        const same = all.filter((r) => r.id !== rep.run.id && r.status === 'done'
          && r.template_document_id && r.template_document_id === rep.run.template_document_id)
        // This run's word per line, to compare against.
        const nowByRef = new Map(rep.findings.filter((f) => f.template_line)
          .map((f) => [f.template_line as string, f.word]))
        const out: Array<{ run: Run; changed: Array<{ ref: string; was: string | null; now: string | null }> }> = []
        for (const r of same.slice(0, 5)) {
          const res2 = await fetch(`/api/audit-runs/${r.id}`, { headers: await authHeaders() })
          if (!res2.ok) continue
          const body = await res2.json()
          const changed: Array<{ ref: string; was: string | null; now: string | null }> = []
          for (const f of (body.findings ?? []) as Finding[]) {
            if (!f.template_line) continue
            const now = nowByRef.get(f.template_line) ?? null
            if (nowByRef.has(f.template_line) && now !== f.word) {
              changed.push({ ref: f.template_line, was: f.word, now })
            }
          }
          out.push({ run: r, changed })
        }
        setEarlierTemplate(out)
        setEarlier([])
      } else {
        setEarlier(all.filter((r) => r.id !== rep.run.id && r.status === 'done'
          && r.agency_label === rep.run.agency_label))
        setEarlierTemplate([])
      }
    })()
  }, [rep])

  /** While a run is still going the drawer follows it, on the page's own ten seconds. */
  useEffect(() => {
    if (!rep || rep.run.status === 'done') return
    const t = setInterval(() => { load() }, 10_000)
    return () => clearInterval(t)
  }, [rep, load])

  /**
   * *** A REPORT OPENS FOLDED — the owner's third review. ***
   *
   * Every section opened at once, so a DEQ report was twenty-four findings, eight dates, ten
   * expected items and a covers list in one scroll — and the thing a person came for was somewhere
   * in the middle of it. Closed with its count is a table of contents: you can see the shape of the
   * answer before you read any of it.
   *
   * ONE EXCEPTION EACH WAY. A report with a single section opens it — folding one thing is a
   * click that hides the only content. And on an agency report **Findings** opens, because it is
   * what the report is for; What this covers is included in the folding rather than pinned open,
   * which it was.
   *
   * The sentence "Every line below points at a document…" is outside the folds and always visible:
   * it is what the report IS, not part of its contents.
   */
  useEffect(() => {
    if (!rep) return
    const sectionCount = [
      rep.findings.some((f) => f.status === 'open' && f.kind === 'finding'),
      rep.findings.some((f) => f.status === 'open' && f.kind === 'date'),
      rep.findings.some((f) => f.status === 'open' && f.kind === 'contradiction'),
      rep.findings.some((f) => f.status === 'open' && f.kind === 'expected'),
      rep.sections.some((x) => x.status === 'could_not_complete'),
      true, // What this covers always has content
    ].filter(Boolean).length
    const single = sectionCount <= 1
    /**
     * *** `findings: true` IS GONE, BECAUSE THERE IS NO LONGER ONE "Findings" GROUP — Run 7b. ***
     * The findings are now one group per section, keyed `a-<section id>`, each opening only when the
     * run has a single section. That is what the owner's review asked for: 43 findings arrived in
     * one unfolded list, and the fix is not a shorter list but a list with a shape.
     */
    setOpen({
      covers: single, dates: single, contradictions: single,
      expected: single, failed: single, earlier: false, dismissed: false,
    })
  }, [runId, rep])

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
  // Passed first, then by date, and a recurring date with no day last: it is a real obligation and
  // it is not a deadline, so it does not belong in the middle of a list ordered by one.
  const dates = openF.filter((f) => f.kind === 'date')
    .sort((a, b) => Number(!!b.passed) - Number(!!a.passed)
      || Number(!a.due_on) - Number(!b.due_on)
      || String(a.due_on ?? '').localeCompare(String(b.due_on ?? '')))
  const contradictions = openF.filter((f) => f.kind === 'contradiction')
  const expected = openF.filter((f) => f.kind === 'expected')
  const failed = sections.filter((s) => s.status === 'could_not_complete')
  const docsRead = [...new Set(sections.flatMap((s) => s.documents_read ?? []))]
  /**
   * *** HELD UNREAD IS WHAT NO SECTION READ — Audits Run 8a, item 1(b). ***
   *
   * This was the plain union of every section's `documents_held_unread`, and on a whole-company run
   * that is the same list as `documents_read`. Each section is shown ITS agency's documents and the
   * rest by title only, so the DEQ section reads 5 and holds 7 unread, the OSHA section reads 8 and
   * holds 4 — and the unions come out 12 and 12 on a company that holds **twelve documents**. Read
   * off the rows of run 60d33549: `in BOTH unions: 12`, every held-unread id also a read id. The
   * meta line therefore said "12 documents read, 12 held unread", which reads as twenty-four.
   *
   * A document is held-but-not-read only when **no** section read it. Subtracting the read set is
   * the whole fix, and on a single-agency run it changes nothing: there the other documents really
   * were not read by anybody.
   */
  const docsUnread = [...new Set(sections.flatMap((s) => s.documents_held_unread ?? []))]
    .filter((id) => !docsRead.includes(id))
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

  /** One section again, used by both reports. */
  async function retry(sectionId: string, title: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/audit-runs/${run.id}/sections/${sectionId}/retry`, {
        method: 'POST', headers: await authHeaders(),
      })
      const j = await res.json().catch(() => null)
      setNotice(res.ok ? `Running ${title} again.` : (j?.error ?? 'We could not run that again.'))
      await load(); onChanged()
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

  /**
   * *** THE ZIP, FETCHED WITH THE SIGN-IN HEADER — Audits Run 9, item 1. ***
   *
   * It was a plain `<a href="/api/audit-runs/<id>/documents">`. On production that returned
   * `{"error":"Unauthorized"}`, and the cause is three lines:
   *
   *   · the link was a browser NAVIGATION, which sends cookies and no `Authorization` header;
   *   · `lib/auth.ts:71` reads the token only from `request.headers.get('authorization')`;
   *   · `lib/auth.ts:80` returns `{ error: 'Unauthorized' }` when there is no valid token, and the
   *     zip route calls `requireCompany` at `app/api/audit-runs/[id]/documents/route.ts:95`.
   *
   * Print was unaffected because it never makes a request: it is `window.print()` on the open
   * drawer.
   *
   * So the button now does what every other call on this screen does — `fetch` with
   * `authHeaders()` — and saves the response. The filename comes from the route's own
   * `content-disposition`, so the name a person gets is still the route's decision and not a second
   * copy of that logic here.
   *
   * *** AND IT MUST BE PRESSED IN A BROWSER TO BE PROVEN. *** A script that fetches the route with a
   * header proves the ROUTE. It cannot prove the button: the defect was entirely in how the browser
   * made the request, so only a real press exercises it. `docs/TESTING.md` says so in the audit set.
   */
  async function downloadDocuments() {
    setBusy(true)
    try {
      const res = await fetch(`/api/audit-runs/${run.id}/documents`, { headers: await authHeaders() })
      if (!res.ok) {
        // §5.1: when the failure is ours, say so, and never imply the person did something wrong.
        const json = await res.json().catch(() => null)
        setNotice(json?.error === 'Unauthorized'
          ? 'Your sign-in has expired. Reload the page and try again.'
          : 'We could not build that download just now. Nothing was changed; try again in a moment.')
        return
      }
      /**
       * The route's own filename, read off the header it already sets. The starred form first: an
       * HTTP header is latin-1, so the plain `filename=` is the ASCII fallback and `filename*` is
       * the real name (RFC 6266). Reading the fallback is what saved the file as
       * "Oregon DEQ Â· Oregon OSHA … .zip".
       */
      const disp = res.headers.get('content-disposition') ?? ''
      const starred = /filename\*=UTF-8''([^;]+)/i.exec(disp)
      const plain = /filename="([^"]+)"/.exec(disp)
      const name = starred ? decodeURIComponent(starred[1])
        : plain ? plain[1] : 'audit documents.zip'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoked on the next tick, not immediately: Safari cancels a download whose blob URL is
      // revoked in the same frame as the click.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      setNotice('We could not build that download just now. Nothing was changed; try again in a moment.')
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
      <button disabled={busy} onClick={downloadDocuments}
        className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300">
        Download the documents
      </button>
      <button onClick={() => setReasonFor('run')} className="text-[12px] text-gray-400 hover:text-gray-700 hover:underline">
        Not right
      </button>
    </>
  )

  /**
   * THE COUNTS, AND THE FILTER, SHARED BY BOTH REPORTS — Audits Run 7b, items 4 and 6.
   *
   * One definition so the agency report and the checklist report cannot drift into two vocabularies
   * for the same five numbers. `noAnswer` is only ever non-zero on a checklist: it is the row
   * `shapeTemplateFindings` writes for a line nobody answered.
   */
  const WORDS_IN_ORDER: Array<{ word: string; label: string }> = [
    { word: 'nothing_on_file', label: 'nothing on file' },
    { word: 'stale', label: 'out of date' },
    { word: 'on_file', label: 'on file' },
    { word: 'not_a_document_question', label: 'not a document question' },
  ]
  const countOf = (w: string, list: Finding[]) => list.filter((f) => f.word === w).length
  const countsFor = (list: Finding[]) => WORDS_IN_ORDER.map((x) => ({ ...x, n: countOf(x.word, list) }))
  /** The filter applies to findings only; a date or a disagreement carries no word to filter on. */
  const keep = (list: Finding[]) => (wordFilter ? list.filter((f) => f.word === wordFilter) : list)

  /**
   * FINDINGS UNDER THE DOCUMENT THEY CITE, in the order the documents were first cited.
   * Everything with no document goes in one group at the end rather than one group each.
   */
  const byDocument = (list: Finding[]) => {
    const order: Array<string | null> = []
    const map = new Map<string | null, Finding[]>()
    for (const f of [...list].sort((a, b) => a.ordinal - b.ordinal)) {
      const k = f.document_id ?? null
      if (!map.has(k)) { map.set(k, []); order.push(k) }
      map.get(k)!.push(f)
    }
    // Null last: "not tied to one document" is a footnote, not a heading to read first.
    order.sort((a, b) => Number(a === null) - Number(b === null))
    return order.map((k) => ({ docId: k, doc: k ? (map.get(k)![0].document ?? null) : null, items: map.get(k)! }))
  }

  /**
   * The OTHER agencies a collapsed finding belongs to, as words, for the group being rendered.
   * Section titles are the agency names, so the ids are turned back into the names a person reads.
   */
  const sectionTitleById = new Map(sections.map((x) => [x.id, x.title]))
  const otherAgencies = (f: Finding, hereId: string): string | null => {
    const ids = [f.section_id, ...(f.also_in_sections ?? [])]
    const names = [...new Set(ids.filter((id) => id !== hereId)
      .map((id) => sectionTitleById.get(id)).filter(Boolean) as string[])]
    if (!names.length) return null
    return names.length === 1 ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }

  /* ── BOARD G: THE REPORT AGAINST A CHECKLIST ─────────────────────────────── */
  if (run.kind === 'template') {
    const name = rep.documents?.[run.template_document_id ?? '']?.title ?? 'the checklist'
    // Counts by word, and no score. *** A CHECKLIST IS NOT A TEST AND HAS NO MARK. *** "11 of 15"
    // invites the reader to treat four lines as a fail and eleven as a pass, when one of the four
    // may be a record kept on a clipboard and never uploaded. The words carry what is true.
    const noAnswer = openF.filter((f) => f.template_line && !f.word).length
    // The counts are now the FILTER (Run 7b, item 6) — the same control the agency report has, and
    // one more entry for the rows that carry no word at all, which only a checklist produces.
    const tCounts = [...countsFor(openF),
                     ...(noAnswer ? [{ word: '__none', label: 'we did not get an answer for', n: noAnswer }] : [])]
    // `__none` is not a word, so it cannot be compared with one: it selects the rows whose word is
    // null, which is what the person clicking it is asking for.
    const tKeep = (list: Finding[]) => (wordFilter === '__none'
      ? list.filter((f) => !f.word)
      : wordFilter ? list.filter((f) => f.word === wordFilter) : list)

    return (
      <Drawer title={`Against ${name}`} sub={sub} onClose={onClose} footer={footer}>
        <WordFilter counts={tCounts} value={wordFilter} onChange={setWordFilter} />
        <WordCountsPrint counts={tCounts} />
        {/* The sentence about the form itself, under the header: what we noticed before answering
            a single line (Run 5a, item 6). */}
        {run.summary?.note && (
          <p className="mt-1 text-[13px] text-gray-500">{run.summary.note}</p>
        )}
        {run.scope && <p className="mt-1 text-[12px] text-gray-400">You asked: &ldquo;{run.scope}&rdquo;</p>}
        {run.status !== 'done' && (
          <p className="mt-2 text-[13px] text-gray-600">
            Still running · {run.done_count} of {run.section_count} section
            {run.section_count === 1 ? '' : 's'} done{run.estimate ? ` · ${run.estimate}` : ''}
          </p>
        )}
        {notice && <p className="no-print mt-2 text-[13px] text-gray-700">{notice}</p>}

        <p className="mt-3 font-serif text-[15px] leading-relaxed text-gray-800">
          Every line below is a line of your checklist, answered against the documents you have given
          us. None of it is a verdict on whether the company complies.
        </p>

        {/* One folded group per checklist section, in the checklist's own order. */}
        {sections.map((sec) => {
          const allT = openF.filter((f) => f.section_id === sec.id)
            .sort((a, b) => a.ordinal - b.ordinal)
          const mine = tKeep(allT)
          const key = `t-${sec.id}`
          return (
            // A one-section checklist opens; a three-section one starts closed with its counts,
            // which is the form's own table of contents.
            <Section_ key={sec.id} title={sec.title} count={mine.length}
              open={open[key] ?? sections.length <= 1}
              onToggle={() => setOpen((o) => ({ ...o, [key]: !(o[key] ?? sections.length <= 1) }))}>
              {sec.status === 'could_not_complete' ? (
                <div>
                  <p className="text-[13px] text-gray-600">{sec.could_not_complete_reason}</p>
                  <button disabled={busy} onClick={() => retry(sec.id, sec.title)}
                    className="no-print mt-1 text-[13px] text-[var(--green)] underline disabled:text-gray-300">
                    Run this section again
                  </button>
                </div>
              ) : allT.length === 0 ? (
                <p className="text-[13px] text-gray-500">Nothing was recorded here.</p>
              ) : (<>
                {mine.length === 0 && (
                  <p className="no-print text-[13px] text-gray-500">
                    No line in this section carries that word.
                  </p>
                )}
                {allT.map((f) => (
                /* *** ONE LINE PER CHECKLIST LINE — Audits Run 7b, item 6. ***
                   The reference, the word and the text; the document, locator, quote and what to do
                   appear on click. The same component the agency report uses, so the two reports
                   cannot drift into two ways of showing one finding. */
                <FindingLine key={f.id} f={f}
                  off={!mine.includes(f)}
                  open={!!openFinding[f.id]} onToggle={() => toggleFinding(f.id)}
                  onOpenDoc={onOpenDoc}
                  onNotRight={() => setReasonFor(f.id)}
                  reasonOpen={reasonFor === f.id}
                  onCancelReason={() => setReasonFor(null)}
                  onSaveReason={(rr) => dismiss(f.id, rr)} />
              ))}</>)}
            </Section_>
          )
        })}

        {/* *** EARLIER AUDITS AGAINST THIS CHECKLIST, AND WHAT MOVED. *** The whole reason to keep
            the lines on the run: the same questions in the same order, so a line's word can be
            compared. Anything else would be comparing two questionnaires. */}
        {earlierTemplate.length > 0 && (
          <Section_ title="Earlier audits against this checklist" count={earlierTemplate.length}
            open={!!open.earlier} onToggle={() => setOpen((o) => ({ ...o, earlier: !o.earlier }))}>
            {earlierTemplate.map((e) => (
              <div key={e.run.id} className="border-b border-gray-100 py-2 last:border-b-0">
                <p className="text-[13px] text-gray-700">
                  {fmt(e.run.finished_at ?? e.run.created_at)}
                  <a href={`/audits?run=${e.run.id}`} className="ml-2 text-[13px] text-[var(--green)] underline">Open</a>
                </p>
                {e.changed.length === 0 ? (
                  <p className="mt-0.5 text-[12px] text-gray-500">No line changed.</p>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {e.changed.map((c) => (
                      <li key={c.ref} className="text-[12px] text-gray-600">
                        <span className="font-medium text-gray-500">{c.ref}</span>{' '}
                        {(c.was && WORD[c.was]) ?? c.was ?? 'no answer'}
                        {' → '}
                        {(c.now && WORD[c.now]) ?? c.now ?? 'no answer'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Section_>
        )}

        {/* The print's last page, as the agency report has. */}
        <div className="hidden print:block" style={{ breakBefore: 'page' }}>
          <h3 className="mb-2 mt-6 text-[12px] font-medium uppercase tracking-wide text-gray-700">
            Documents this audit read
          </h3>
          <ol className="space-y-1">
            {citationOrder(findings, docsRead).map((id, i) => (
              <li key={id} className="text-[12px] text-gray-700">
                {i + 1}. {titleOf(id) ?? 'a document that is no longer on file'}
              </li>
            ))}
          </ol>
        </div>
      </Drawer>
    )
  }

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

      {/* *** THE COUNTS BY WORD, AS FILTERS — Audits Run 7b, item 4. ***
          The same row the checklist report has carried since Run 4b, now on the agency report too
          and now doing something: each one narrows every section group below it. */}
      {plain.length > 0 && (
        <div className="mt-3">
          <WordFilter counts={countsFor(plain)} value={wordFilter} onChange={setWordFilter} />
          <WordCountsPrint counts={countsFor(plain)} />
        </div>
      )}

      {/* ── FINDINGS, ONE FOLDED GROUP PER SECTION ───────────────────────── */}
      {plain.length > 0 && sections.map((sec) => {
        /**
         * *** A COLLAPSED FINDING APPEARS UNDER EVERY AGENCY THAT RAISED IT — Run 7b, item 5. ***
         *
         * `collapseDuplicates` kept one row and closed the others, so the closed rows are not in
         * `plain` at all. Filtering only on `section_id` would therefore drop the finding from every
         * agency but the one whose row survived — which is worse than printing it twice: the
         * Department of Agriculture's report would be missing something it genuinely asked for.
         *
         * So a section's findings are its own rows PLUS any row that names this section in
         * `also_in_sections`. Once per group, never twice in one.
         */
        const belongs = (f: Finding) =>
          f.section_id === sec.id || (f.also_in_sections ?? []).includes(sec.id)
        const mine = keep(plain.filter(belongs))
        const all = plain.filter(belongs)
        const key = `a-${sec.id}`
        // A one-section run opens its one group: folding the only content is a click that hides
        // everything. A three-agency run starts closed with its counts, which is the table of
        // contents the owner's review asked for.
        const isOpen = open[key] ?? sections.length <= 1
        const bits = countsFor(all).filter((c) => c.n > 0).map((c) => `${c.n} ${c.label}`)
        return (
          <Section_ key={sec.id} title={sec.title} count={mine.length} open={isOpen}
            onToggle={() => setOpen((o) => ({ ...o, [key]: !(o[key] ?? sections.length <= 1) }))}>
            <p className="mb-1 text-[12px] text-gray-500">{bits.join(' · ')}</p>
            {all.length === 0 ? (
              <p className="text-[13px] text-gray-500">Nothing was recorded here.</p>
            ) : (
              <>
                {mine.length === 0 && (
                  <p className="no-print text-[13px] text-gray-500">
                    Nothing in this section carries that word.
                  </p>
                )}
                {byDocument(all).map((g) => {
                  const shown = g.items.filter((f) => !wordFilter || f.word === wordFilter)
                  return (
                    <DocGroup key={g.docId ?? 'none'} doc={g.doc} docId={g.docId}
                      onOpenDoc={onOpenDoc} off={shown.length === 0}>
                      {g.items.map((f) => (
                        <FindingLine key={f.id} f={f}
                          alsoUnder={otherAgencies(f, sec.id)}
                          off={!!wordFilter && f.word !== wordFilter}
                          open={!!openFinding[f.id]} onToggle={() => toggleFinding(f.id)}
                          onOpenDoc={onOpenDoc}
                          onNotRight={() => setReasonFor(f.id)}
                          reasonOpen={reasonFor === f.id}
                          onCancelReason={() => setReasonFor(null)}
                          onSaveReason={(r) => dismiss(f.id, r)} />
                      ))}
                    </DocGroup>
                  )
                })}
              </>
            )}
          </Section_>
        )
      })}

      {/* Dismissed findings, once for the whole run rather than once per section: they are what a
          person has already said is not a problem, and they are not part of the answer. */}
      {dismissed.length > 0 && (
        <Section_ title="Dismissed" count={dismissed.length} open={!!open.dismissed}
          onToggle={() => setOpen((o) => ({ ...o, dismissed: !o.dismissed }))}>
          {dismissed.map((f) => (
            <p key={f.id} className="mt-1 text-[12px] text-gray-500">
              {f.title}{f.dismissed_reason ? ` — ${f.dismissed_reason}` : ''}
            </p>
          ))}
        </Section_>
      )}

      {/* ── DATES ────────────────────────────────────────────────────────── */}
      {dates.length > 0 && (
        <Section_ title="Dates" count={dates.length} open={!!open.dates}
          onToggle={() => setOpen((o) => ({ ...o, dates: !o.dates }))}>
          {dates.map((f) => {
            /**
             * *** A RECURRING OBLIGATION WITH NO DAY — Audits Run 6a, item 1. ***
             *
             * Migration 060 lets a date carry a null day when it recurs, because that is what some
             * permits say: the fee is annual and the day is on an invoice nobody has given us. The
             * line says so in words rather than showing a blank where a date goes — a blank reads
             * as a bug, and an invented day would be a deadline nobody set.
             *
             * No "Add to calendar" on one of these: the link would put a row on the calendar with
             * no date, which is the same false precision one step further on.
             */
            const undated = !f.due_on
            const meta = [
              fmt(f.due_on),
              f.recurs && !f.due_on ? null : (f.recurs ? 'recurring' : null),
              f.document ? f.document.title : null,
            ].filter(Boolean) as string[]
            return (
            <div key={f.id} className="flex items-start gap-3 border-b border-gray-100 py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-gray-900">
                  {f.title}
                  {undated && <span className="text-gray-500"> — recurs, no date in the reading</span>}
                </p>
                <p className="mt-0.5 text-[12px] text-gray-500">
                  {meta[0] ?? ''}
                  {f.passed ? <span className="text-[var(--amber)]">{meta.length ? ' · ' : ''}passed</span> : ''}
                  {meta.slice(1).map((x) => ` · ${x}`).join('')}
                </p>
              </div>
              {!undated && (
                <a href={`/calendar?add=${encodeURIComponent(f.title)}&on=${f.due_on ?? ''}`}
                  className="no-print shrink-0 text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">
                  Add to calendar
                </a>
              )}
            </div>
            )
          })}
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
              <button disabled={busy} onClick={() => retry(s.id, s.title)}
                className="no-print mt-1 text-[13px] text-[var(--green)] underline disabled:text-gray-300">
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
