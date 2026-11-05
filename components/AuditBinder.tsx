/**
 * THE BINDER — `docs/GAPS-PLAN.md` Part C, DECISION 61 (the owner, 4 November 2026).
 *
 * *** IT IS THE REPORT PAGE PRINTED, WITH THE DOCUMENTS AT THE BACK, MADE BY THE BROWSER. ***
 *
 * One stored file a customer hands to an inspector — but nothing is stored and nothing is built on
 * a server. The browser already holds a signed URL to every file the person owns, already prints
 * through `printWithFrame`, and can draw a PDF page with `pdfjs-dist`, which is in the tree
 * already (`officeparser` depends on it). So the binder is a MODE of the report page: the person
 * presses "Print the binder", the page fetches the cited documents one at a time, lays them out,
 * and opens the print dialog. They save as PDF.
 *
 * **What that buys, against the server build mapped at half one (now `docs/GAPS-PLAN.md` §5b as the
 * rev 2 binder):** no `pdf-lib`, no font embedding, no migration, no stored object, no new storage
 * ceiling, no claim, no 202, no route. **What it costs:** the binder is whatever the browser's
 * "Save as PDF" makes of it — the original PDFs go in as rendered pages rather than as their own
 * page objects, so the text in them is not selectable in the result. An inspector reads it; a
 * search engine does not. That is the trade the owner took, written here so rev 2 knows why.
 *
 * *** THE ROWS ARE NOT WRITTEN TWICE. *** Everything about which line comes first, which document
 * is "Document 3" and which page it is on comes from `lib/auditRows.ts`, which the report page
 * reads too. A binder that numbered its tabs differently from the report that cites them would be
 * worse than no binder.
 *
 * *** NO MODEL CALL, AND NO GATE. *** Nothing here reaches `lib/ai.ts`. A paused company may print
 * its binder: it is their own files and their own finished audit, and decision 11 pauses paid work,
 * not reading what you already have.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { printDrawer, printDate } from '@/components/Drawer'
import { PREPARED_LINE } from '@/lib/printFrame'
import { authHeaders, createClient } from '@/lib/supabase'
import {
  WORD_LABEL, WORD_ORDER, WORD_TINT, TINT_GREY, TINT_NO_ANSWER,
  citationOrder, citedDocumentIds, citeLabel, documentNumbers, orderedRows, plainTextOf,
} from '@/lib/auditRows'

interface DocRef { title: string; file_name: string; kind?: string | null; display_status?: string | null }
interface Finding {
  id: string; section_id: string; ordinal: number; kind: string; status: string; title: string
  template_line: string | null; template_text: string | null
  word: string | null; document_id: string | null; document_b_id: string | null
  locator: string | null; quote: string | null; what_to_do: string | null
}
interface Section { id: string; ordinal: number; title: string; documents_read: string[] | null }
interface Run {
  id: string; kind: string; scope: string | null; agency_label: string | null; status: string
  template_document_id: string | null; section_count: number
  readings_as_of: string | null; created_at: string; finished_at: string | null
}
interface Report { run: Run; sections: Section[]; findings: Finding[]; documents?: Record<string, DocRef> }

/** What one document turned into. `pages` are data URLs — see the note on `renderPdf`. */
interface Tab {
  n: number
  id: string
  doc: DocRef | null
  citedBy: string[]
  kind: 'pdf' | 'image' | 'text' | 'missing'
  pages: string[]
  text: string | null
  /** §5.1: ours, plainly, and never a claim about a file we did not read. */
  trouble: string | null
}

const KIND_LABEL: Record<string, string> = {
  permit: 'Permit', certificate: 'Certificate', program: 'Program', policy: 'Policy',
  record: 'Record', supplier_document: "Supplier's document", other: 'Other',
}

const fmt = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso))
  return Number.isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * *** THE SENTENCE FOR A FILE WE COULD NOT FETCH — the Part C map's words, §5.1. ***
 * It never says the person did something wrong, it never claims anything about the contents, and
 * it says what IS still true: the reading stands, and the row above it is what the audit found.
 */
const MISSING_FILE = (when: string) =>
  `This file could not be fetched on ${when}. Its record and its reading are intact, and the rows `
  + 'above are what the audit found in it.'

/** A text-bearing original is shown as the text the reading was made from, and says so. */
const TEXT_RENDERING = (what: string) =>
  `A text rendering of ${what}; the original is on file in CompliBoard.`

/** Neither a PDF, nor an image, nor anything with stored text — rare, and not silent. */
const NOTHING_TO_SHOW =
  'This file is on file in CompliBoard and cannot be shown in a printed binder. Open it in '
  + 'CompliBoard to read it.'

/**
 * *** `pdfjs-dist` RUNS ON THE MAIN THREAD, ON PURPOSE, AND THIS IS THE NEXT 16 PART. ***
 *
 * A PDF page is drawn by `pdfjs-dist`, which normally talks to a Web Worker whose URL the bundler
 * has to produce. Read out of the library rather than guessed: `pdf.mjs` checks
 * `globalThis.pdfjsWorker?.WorkerMessageHandler` FIRST (`#mainThreadWorkerMessageHandler`,
 * `node_modules/pdfjs-dist/build/pdf.mjs:15660`) and uses it in place of a worker when it is set.
 * So importing the worker module and parking it on `globalThis` gives a working pdf.js with **no
 * `new Worker`, no `workerSrc` URL, and no 1.2 MB file copied into `public/`** — which matters
 * under Turbopack, where `new Worker(new URL(<bare specifier>, import.meta.url))` is the one shape
 * `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md` does not promise.
 *
 * Both imports are dynamic and happen only when a binder is being prepared, so no page that is not
 * a binder carries 1.6 MB of PDF machinery.
 *
 * The cost of no worker is that parsing blocks the main thread. The screen is showing
 * "Preparing the binder… 3 of 11" at the time and nothing else is being asked of it, which is the
 * one moment in this product where that is the right trade.
 */
async function loadPdfjs() {
  const [lib, worker] = await Promise.all([
    import('pdfjs-dist/build/pdf.mjs'),
    import('pdfjs-dist/build/pdf.worker.mjs'),
  ])
  ;(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = worker
  return lib
}

/**
 * *** EVERY PAGE BECOMES A JPEG, AND THE CANVAS IS THROWN AWAY. ***
 *
 * Keeping a canvas per page in the DOM is how this runs out of memory: a 40-page permit at print
 * resolution is 40 × 1240 × 1754 × 4 bytes ≈ 350 MB of live bitmaps. A JPEG data URL of the same
 * page is 100–300 KB, prints identically, and survives the print dialog — which matters, because
 * the signed URL the bytes came from expires in 120 seconds and a person may sit on the dialog for
 * longer than that. Nothing in the printed binder depends on a URL still being alive.
 */
async function renderPdf(bytes: ArrayBuffer, onPage: (n: number, of: number) => void): Promise<string[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    // ~150 dpi on A4's long edge: enough to read a scanned permit, small enough to print.
    const scale = Math.min(1654 / Math.max(base.width, base.height), 3)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) break
    // White behind it: a PDF page with no background paints transparent, which prints black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    out.push(canvas.toDataURL('image/jpeg', 0.82))
    canvas.width = 0; canvas.height = 0
    page.cleanup()
    onPage(i, doc.numPages)
  }
  await doc.destroy()
  return out
}

/** A fetched file as a data URL, so the printed page needs no network and no live signed URL. */
function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('could not read the file'))
    r.readAsDataURL(blob)
  })
}

export default function AuditBinder({ runId, companyName, onBack }: {
  runId: string
  companyName?: string | null
  /** Back to the report page. The binder is a mode of it, not a place of its own. */
  onBack: () => void
}) {
  const [rep, setRep] = useState<Report | null>(null)
  const [tabs, setTabs] = useState<Tab[] | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** One preparation per visit: React runs an effect twice in development, and this is not idempotent. */
  const started = useRef(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/audit-runs/${runId}`, { headers: await authHeaders() })
    const json = await res.json()
    if (!res.ok) { setError(json?.error ?? 'We could not read that audit just now.'); return null }
    setRep(json as Report)
    return json as Report
  }, [runId])

  /**
   * *** THE FILES COME DOWN ONE AT A TIME, THROUGH THE PATH "Open the file" ALREADY USES. ***
   *
   * `POST /api/document-actions { action: 'file_url' }` returns a 120-second signed URL and —
   * B2's decision 53 — hands over the CONVERTED copy when there is one, which is exactly what a
   * binder wants: a HEIC or a multi-page TIFF is a file an inspector's computer cannot open.
   * No new route, no service-role read, and RLS decides what the person may have.
   *
   * One at a time rather than in parallel: twelve simultaneous downloads of scanned permits is a
   * way to be rate-limited and to hold twelve files in memory at once, for a page whose progress
   * line is counting documents anyway.
   *
   * *** AND ONE FILE'S FAILURE NEVER COSTS THE OTHERS (§5.1). *** Every fetch is caught; the tab
   * is drawn with the sentence instead of the file, and the cover counts how many.
   */
  const prepare = useCallback(async (r: Report) => {
    const cited = citedDocumentIds(r.findings.filter((f) => f.status === 'open'))
    const numbers = documentNumbers(r.findings.filter((f) => f.status === 'open'))
    const today = printDate(new Date())

    // The stored text for every cited document, in ONE read, under RLS as the caller — the same
    // text the reading was made from (`document_scans.extracted_text`), not a summary of it.
    const textById = new Map<string, string>()
    if (cited.length) {
      const { data } = await createClient().from('document_scans')
        .select('document_id, extracted_text').in('document_id', cited).eq('is_current', true)
      for (const row of (data ?? []) as Array<{ document_id: string; extracted_text: string | null }>) {
        if (row.extracted_text) textById.set(row.document_id, row.extracted_text)
      }
    }

    const out: Tab[] = []
    for (const [i, id] of cited.entries()) {
      const doc = r.documents?.[id] ?? null
      const citedBy = r.findings
        .filter((f) => f.status === 'open' && (f.document_id === id || f.document_b_id === id))
        .map((f) => f.template_line)
        .filter((x): x is string => Boolean(x))
      setProgress(`Preparing the binder… ${i + 1} of ${cited.length} document${cited.length === 1 ? '' : 's'}`)
      const tab: Tab = {
        n: numbers.get(id) ?? i + 1, id, doc, citedBy,
        kind: 'missing', pages: [], text: null, trouble: null,
      }
      try {
        const res = await fetch('/api/document-actions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(await authHeaders()) },
          // *** `document_id`, NOT `documentId` — found by the walk, 4 November 2026. ***
          // `app/api/document-actions/route.ts:45` refuses a body without `document_id` with a
          // 400, and every document came back as "could not be fetched": the binder's own
          // missing-file page, eight times, for eight files that were all perfectly fine. The
          // sentence was honest and the cause was this line.
          body: JSON.stringify({ document_id: id, action: 'file_url' }),
        })
        const json = await res.json()
        if (!res.ok || !json?.url) throw new Error(json?.error ?? 'no url')
        const file = await fetch(json.url)
        if (!file.ok) throw new Error(`the file came back ${file.status}`)
        const blob = await file.blob()
        const name = (doc?.file_name ?? '').toLowerCase()
        const isPdf = blob.type === 'application/pdf' || name.endsWith('.pdf')
        const isImage = blob.type.startsWith('image/')
        if (isPdf) {
          tab.kind = 'pdf'
          tab.pages = await renderPdf(await blob.arrayBuffer(), (p, of) => {
            setProgress(`Preparing the binder… ${i + 1} of ${cited.length} documents · page ${p} of ${of}`)
          })
        } else if (isImage) {
          tab.kind = 'image'
          tab.pages = [await toDataUrl(blob)]
        } else {
          tab.kind = 'text'
          tab.text = textById.get(id) ?? null
        }
      } catch {
        // The reason is not shown: a person cannot act on "404 from storage", and the sentence
        // already says the only two things that are true and useful.
        tab.kind = 'missing'
        tab.trouble = MISSING_FILE(today)
      }
      out.push(tab)
      setTabs([...out])
    }
    setProgress(null)
    return out
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      const r = await load()
      if (!r) return
      try {
        await prepare(r)
      } catch {
        setError('We could not prepare that binder just now. Nothing was changed; try again.')
        return
      }
      // The dialog opens on its own: the person pressed "Print the binder", and a page that
      // finished preparing and then waited to be pressed again would be asking twice.
      setTimeout(() => printDrawer(), 400)
    })()
  }, [load, prepare])

  if (error) {
    return (
      <section className="mx-auto w-full max-w-[1000px]">
        <button onClick={onBack} className="text-[13px] text-[var(--green)] underline">← Back to the report</button>
        <p className="mt-3 text-[14px] text-[var(--amber)]">{error}</p>
      </section>
    )
  }
  if (!rep) {
    return (
      <section className="mx-auto w-full max-w-[1000px]">
        <p className="text-[14px] text-gray-400">Opening…</p>
      </section>
    )
  }

  const { run, sections, findings } = rep
  const open = findings.filter((f) => f.status === 'open')
  const rows = orderedRows(sections, open.filter((f) => f.kind === 'finding'))
  const numbers = documentNumbers(open)
  const docsRead = [...new Set(sections.flatMap((s) => s.documents_read ?? []))]
  const auditedOn = fmt(run.finished_at ?? run.created_at)
  const title = run.kind === 'template'
    ? (rep.documents?.[run.template_document_id ?? '']?.title ?? 'Against your checklist')
    : `${run.section_count > 1 ? 'Audit of everything' : (run.agency_label ?? 'All agencies')}, ${auditedOn}`
  const counts = WORD_ORDER
    .map((w) => ({ w, n: open.filter((f) => f.kind === 'finding' && f.word === w).length }))
    .filter((c) => c.n > 0)
  const missing = (tabs ?? []).filter((t) => t.kind === 'missing').length
  /** The documents the audit read and no row cites: titles only, at the back, as the report has. */
  const alsoRead = citationOrder(open, docsRead).filter((id) => !numbers.has(id))

  return (
    /* The same class and the same two attributes the report page carries, because `printDrawer()`
       reads them for the running header (`components/Drawer.tsx` `visibleDrawer`). The type says
       "Audit binder" so the paper says which of the two it is. */
    <section className="print-drawer mx-auto w-full max-w-[1000px]"
      data-print-company={companyName ?? ''} data-print-type="Audit binder">
      <div className="no-print mb-6 flex items-center gap-4 border-b border-gray-200 pb-3">
        <button onClick={onBack} className="text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">
          ← Back to the report
        </button>
        {progress
          ? <span className="text-[13px] text-gray-600">{progress}</span>
          : (
            <button onClick={() => printDrawer()}
              className="rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50">
              Print the binder
            </button>
          )}
        <span className="ml-auto text-[12px] text-gray-400">
          Print this page, or save it as a PDF, and the whole binder is one file.
        </span>
      </div>

      {/* ── THE COVER ─────────────────────────────────────────────────────── */}
      <div className="binder-sheet">
        <p className="text-[13px] uppercase tracking-wide text-gray-500">{companyName}</p>
        <h1 className="mt-2 font-serif text-[26px] font-semibold leading-tight text-gray-900">{title}</h1>
        <p className="mt-3 text-[13px] text-gray-600">
          Audited {auditedOn} · Printed {printDate(new Date())}
          {run.readings_as_of ? ` · Readings as of ${fmt(run.readings_as_of)}` : ''}
        </p>
        <p className="mt-1 text-[13px] text-gray-700">
          {counts.map((c) => `${c.n} ${WORD_LABEL[c.w]}`).join(' · ')}
          {` · ${rows.length} line${rows.length === 1 ? '' : 's'}`}
          {` · ${numbers.size} document${numbers.size === 1 ? '' : 's'} behind this report`}
        </p>
        {missing > 0 && (
          <p className="mt-1 text-[13px] text-[var(--amber)]">
            {missing} file{missing === 1 ? '' : 's'} could not be fetched. Each one has a page of its own
            saying so.
          </p>
        )}
        {/* *** THE COVER CARRIES NOTHING IN OUR OWN VOICE — decision 64, 4 November 2026. ***
            It said "Prepared with CompliBoard. Every line points at a document…" here, and the
            printed footer said "Prepared with CompliBoard" again at the foot of all 19 pages. The
            whole sentence is in the footer now (`PREPARED_LINE`, `lib/printFrame.ts`), so a person
            meets it once per page and the cover is the audit's own facts. */}
      </div>

      {/* ── THE REPORT, ROW BY ROW IN THE AUDITOR'S ORDER ─────────────────── */}
      <div className="binder-sheet mt-10" style={{ breakBefore: 'page' }}>
        <h2 className="text-[12px] font-medium uppercase tracking-wide text-gray-700">The report</h2>
        {[...sections].sort((a, b) => a.ordinal - b.ordinal).map((sec) => {
          const mine = rows.filter((f) => f.section_id === sec.id)
          if (!mine.length) return null
          return (
            <div key={sec.id} className="mt-5">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">{sec.title}</p>
              {mine.map((f) => {
                const cite = citeLabel(f.document_id ? numbers.get(f.document_id) : undefined, f.locator)
                return (
                  <div key={f.id} className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
                    {/* The report page's own pill, from the one palette (E1a): the binder and the
                        screen colour a word the same way or they are two vocabularies. */}
                    <span className={`print-tint mt-px w-[132px] shrink-0 rounded-full px-2 py-0.5 text-center
                      text-[11px] font-semibold leading-[15px] first-letter:uppercase ${
                      f.word ? (WORD_TINT[f.word] ?? TINT_GREY) : TINT_NO_ANSWER}`}>
                      {f.word ? (WORD_LABEL[f.word] ?? f.word) : 'no answer'}
                    </span>
                    {f.template_line
                      ? <span className="w-[36px] shrink-0 text-[13px] font-semibold leading-5 text-gray-700">{f.template_line}</span>
                      : null}
                    <span className="min-w-0 flex-1 text-[14px] leading-snug text-gray-900">
                      {f.template_text ?? f.title}
                      {f.quote && (
                        <span className="mt-1 block font-serif text-[13px] italic leading-relaxed text-gray-700">
                          &ldquo;{f.quote}&rdquo;
                        </span>
                      )}
                      {f.what_to_do && (
                        <span className="mt-1 block text-[13px] leading-relaxed text-gray-700">{f.what_to_do}</span>
                      )}
                    </span>
                    <span className="w-[160px] min-w-0 shrink-0 text-right text-[12px] leading-snug text-gray-600">
                      {cite ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── THE DOCUMENTS, ONCE EACH, IN ORDER OF FIRST CITATION ──────────── */}
      {(tabs ?? []).map((t) => (
        <div key={t.id}>
          <div className="binder-sheet mt-10 border-t border-gray-300 pt-6" style={{ breakBefore: 'page' }}>
            <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500">Document {t.n}</p>
            <h2 className="mt-1 font-serif text-[18px] leading-snug text-gray-900">
              {t.doc?.title ?? 'a document that is no longer on file'}
            </h2>
            <p className="mt-1 text-[12px] text-gray-600">
              {t.doc?.kind ? `${KIND_LABEL[t.doc.kind] ?? t.doc.kind} · ` : ''}
              {t.citedBy.length ? `cited by ${t.citedBy.join(', ')}` : 'read by this audit'}
              {t.kind === 'pdf' && t.pages.length ? ` · ${t.pages.length} page${t.pages.length === 1 ? '' : 's'}` : ''}
              {t.doc?.file_name ? ` · ${t.doc.file_name}` : ''}
            </p>
            {t.kind === 'text' && (
              <p className="mt-1 text-[12px] italic text-gray-500">
                {TEXT_RENDERING(describe(t.doc?.file_name ?? ''))}
              </p>
            )}
            {t.trouble && <p className="mt-2 text-[13px] text-[var(--amber)]">{t.trouble}</p>}
            {t.kind === 'text' && !t.text && (
              <p className="mt-2 text-[13px] text-gray-600">{NOTHING_TO_SHOW}</p>
            )}
          </div>
          {t.kind === 'text' && t.text && (
            <div className="binder-sheet mt-4 whitespace-pre-wrap font-serif text-[12.5px] leading-relaxed text-gray-800">
              {plainTextOf(t.text)}
            </div>
          )}
          {t.pages.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="binder-page mt-4 block w-full"
              style={i === 0 ? undefined : { breakBefore: 'page' }} />
          ))}
        </div>
      ))}

      {/* Decision 64: on paper this is the running footer of every page (`lib/printFrame.ts`);
          on screen the binder says it once, at its foot. */}
      <p className="no-print mt-8 border-t border-gray-200 pt-3 text-[12px] leading-relaxed text-gray-400">
        {PREPARED_LINE}
      </p>

      {/* ── WHAT THE AUDIT READ AND NO ROW CITES ──────────────────────────── */}
      {alsoRead.length > 0 && (
        <div className="binder-sheet mt-10 border-t border-gray-300 pt-6" style={{ breakBefore: 'page' }}>
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-gray-700">
            Documents this audit read
          </h2>
          <p className="mt-1 text-[12px] text-gray-500">
            Read for context. No line of the report rests on them, so they are listed and not reproduced.
          </p>
          <ol className="mt-2 space-y-1">
            {alsoRead.map((id) => (
              <li key={id} className="text-[12.5px] text-gray-700">
                {rep.documents?.[id]?.title ?? 'a document that is no longer on file'}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

/** "a Word document" / "a spreadsheet" / "a text file" — what the line above the text should call it. */
function describe(fileName: string): string {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.') + 1)
  if (ext === 'docx' || ext === 'odt' || ext === 'rtf') return 'a Word document'
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods' || ext === 'csv') return 'a spreadsheet'
  if (ext === 'pptx' || ext === 'odp') return 'a presentation'
  if (ext === 'md' || ext === 'html') return 'a text file'
  return 'the original file'
}
