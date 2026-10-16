'use client'
/**
 * ONE DATE, OPENED — board 6's first tab, "The date" (Calendar step 8a; `docs/calendar-boards.html`).
 *
 * The shared 720 drawer (`components/Drawer.tsx`), the shared sheet for Remove (board 8), and
 * everything the product knows about one date with nothing hidden: when it is, whether it repeats
 * and by what rule, which site, where it was read from with the exact line in quotes, the document's
 * own state, the other live dates that document sets, and who confirmed or removed it.
 *
 * *** THE SECOND TAB IS STEP 8b. *** It is drawn, disabled, with a grey line under it, rather than
 * left off: board 6 has two tabs and a person who can see only one has no way of knowing whether
 * the report is missing or simply not built. Named in `docs/HANDOFF-CODE.md` §7.
 *
 * *** DECISION 30 RUNS THROUGH IT. *** Where the product does not know something it says so in one
 * sentence: a repeating date whose period was never read, a document that has a newer version, a
 * document that has been deleted, a site that no longer exists. What it CANNOT say is whether a day
 * was read from a document that only gave a month — nothing records that (`document_deadlines` has
 * `due_on`, `recurs` and `source_line`, and no precision flag), so that line of decision 30 is left
 * out rather than guessed at. Recorded in the step 8a report and in `DECISIONS.md`.
 *
 * It writes through `PATCH /api/calendar` only — `confirmDate`, `dismissDate` and `setPeriod` in
 * `lib/calendarDates.ts`, the one writer (decision 6). It builds no row and names no status.
 */
import { useState } from 'react'
import { authHeaders } from '@/lib/supabase'
import { Drawer, printDrawer } from '@/components/Drawer'
import { Sheet } from '@/components/Sheet'
import { statusWord, KIND_WORD } from '@/lib/documentStatus'
import {
  type CalendarRow, longDay, longDayAndWeekday, repeatWords, whenWords, passedWords, siteWords,
  PERIOD_CHOICES, PERIOD_LABEL, NOT_CONFIRMED, PERIOD_NOT_READ, ALREADY_HANDLED, NEWER_VERSION,
  DOCUMENT_GONE, googleCalendarUrl, outlookCalendarUrl, splitSiblings, ASKS_BEFORE,
} from '@/lib/calendarView'

/** What the drawer needs about the document a date was read from, when there is one. */
export interface DocumentFacts {
  document_id: string
  title: string | null
  file_name: string | null
  kind: string | null
  issuer: string | null
  display_status: string
  document_status: string
  /** True when another document in the same company names this one as the version it replaces. */
  hasNewerVersion: boolean
}
/** What it needs about an audit finding, when the date came from one. */
export interface FindingFacts {
  id: string
  title: string | null
  quote: string | null
  locator: string | null
  /** The run the finding belongs to — what the second tab opens for an audit date. */
  run_id: string | null
}

export interface DrawerData {
  row: CalendarRow
  /** The other LIVE dates the same document sets. Empty for an audit or a typed date. */
  siblings: CalendarRow[]
  document: DocumentFacts | null
  finding: FindingFacts | null
  /** Full names by profile id, for "confirmed by …" and "added by …". */
  names: Record<string, string>
  siteCount: number
}

const TEXT_ACTION = 'text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300'
const OUTLINE = 'rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50 disabled:opacity-50'

/** A heading over a block of facts, board 6's `.section-head`. */
const SectionHead = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-6 text-[12px] font-medium uppercase tracking-wide text-gray-500">{children}</p>
)
/** One key/value line, board 6's `.fact`. */
const Fact = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex gap-3 border-b border-gray-100 py-2 last:border-0">
    <span className="w-[150px] shrink-0 text-[13px] text-gray-500">{k}</span>
    <span className="min-w-0 flex-1 text-[13px] text-gray-900">{v}</span>
  </div>
)
/** The quiet grey box board 6 opens with, and every decision-30 line. */
const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-600">
    {children}
  </p>
)

export function CalendarDateDrawer({ data, onClose, onChanged, onOpenOther, onOpenReport, company }: {
  data: DrawerData
  onClose: () => void
  /** Told after every write, so the views behind the drawer re-read. */
  onChanged: () => void
  /** Swap the drawer to another date of the same document. */
  onOpenOther: (id: string) => void
  /**
   * *** THE SECOND TAB IS THE PAGE'S TO MOUNT, NOT THIS COMPONENT'S. ***
   * `components/DocumentReport.tsx` and `components/AuditReport.tsx` each render their OWN
   * `Drawer`, so showing one here would be a drawer inside a drawer. The page mounts it over this
   * one exactly as `app/audits/page.tsx:792–833` does — that drawer goes `hidden`, the report's
   * takes its place, and the report is byte-for-byte what Documents and Audits show, with every
   * action on it live and no change to either shared file. The tab row travels with it, in the
   * report's own `topLine` slot, so "The date" is one click away where it has always been.
   * Null when the date has no report to show (a typed or rule-sourced date): the tab is then
   * HIDDEN, not disabled — there is nothing to arrive later.
   */
  onOpenReport: (() => void) | null
  company: string | null
}) {
  const { row, siblings, document: doc, finding, names, siteCount } = data
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [reason, setReason] = useState('')
  const [picking, setPicking] = useState(false)

  /**
   * A different date starts clean — a failure, an open picker and a half-typed reason all belong to
   * the row they happened on. There is no effect for that: the page mounts this with `key={row.id}`,
   * so React gives each date its own component and its own state, and there is nothing to reset.
   */

  async function act(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: row.id, ...body }),
      })
      if (!res.ok) {
        // The route's own sentence, which is written for a person (§5.1) — never a status code.
        const j = await res.json().catch(() => null)
        setError(j?.error ?? 'We could not change that date just now. Nothing was changed.')
        return false
      }
      onChanged()
      return true
    } catch {
      setError('We could not reach the server. Nothing was changed.')
      return false
    } finally { setBusy(false) }
  }

  const site = siteWords(row, siteCount)
  const passed = passedWords(row)
  const repeat = repeatWords(row)
  const day = longDay(row.next_due)
  const nameOf = (id: string | null) => (id && names[id]) || 'someone at your company'

  // The head's sub line, board 6: site · day · how far · state.
  const sub = [
    site, day || (repeat || 'no day yet'), day ? whenWords(row) : '',
    passed || (row.status === 'proposed' ? NOT_CONFIRMED : ''),
  ].filter(Boolean).join(' · ')

  /** Board 6 draws both sibling sections the same way, so they are one function. */
  const siblingRow = (s: CalendarRow) => (
    <button key={s.id} onClick={() => onOpenOther(s.id)}
      className="group flex w-full items-baseline justify-between gap-3 py-2 text-left">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">{s.title}</span>
        <span className="mt-0.5 block text-[12px] text-gray-500">
          {[longDay(s.next_due) || repeatWords(s) || 'no day yet',
            s.status === 'proposed' ? NOT_CONFIRMED : 'confirmed'].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0 text-[12px] text-gray-400">{whenWords(s)}</span>
    </button>
  )
  const { before, others } = splitSiblings(row, siblings)

  const footer = (
    <>
      {row.status === 'proposed' && (
        <button className={OUTLINE} disabled={busy}
          onClick={async () => { await act({ action: 'confirm' }) }}>
          {busy ? 'Working…' : 'Confirm'}
        </button>
      )}
      {row.recurs && (
        <button className={TEXT_ACTION} disabled={busy} onClick={() => setPicking((p) => !p)}>
          Set how often
        </button>
      )}
      {doc && (
        <button className={TEXT_ACTION} disabled={busy} onClick={async () => {
          setBusy(true)
          try {
            // The same helper Documents' own footer uses: a signed URL good for 120 seconds,
            // never a public one (`app/api/document-actions/route.ts`, case 'file_url').
            const res = await fetch('/api/document-actions', {
              method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ document_id: doc.document_id, action: 'file_url' }),
            })
            const j = res.ok ? await res.json() : null
            if (j?.url) window.open(j.url, '_blank', 'noopener')
            else setError('We could not open that file just now.')
          } finally { setBusy(false) }
        }}>Open the file</button>
      )}
      {googleCalendarUrl(row) && (
        <a className={TEXT_ACTION} target="_blank" rel="noopener noreferrer" href={googleCalendarUrl(row)}>
          Send to my calendar
        </a>
      )}
      {googleCalendarUrl(row) && (
        <a className="text-[14px] text-gray-500 hover:text-gray-900 hover:underline"
          target="_blank" rel="noopener noreferrer" href={outlookCalendarUrl(row)}>Outlook</a>
      )}
      {doc && <button onClick={printDrawer} className={TEXT_ACTION}>Download</button>}
      <button onClick={() => setRemoving(true)} disabled={busy}
        className="ml-auto text-[12px] text-gray-400 hover:text-red-700 hover:underline disabled:text-gray-300">
        Remove
      </button>
    </>
  )

  return (
    <>
      <Drawer title={row.title} sub={sub} onClose={onClose} company={company}
        printType="Calendar date" printDates={day ? `Due ${day}` : undefined} footer={footer}>

        {/* The two tabs, board 6. "The report" is hidden, not greyed, when there is none. */}
        {onOpenReport && (
          <div className="no-print mb-1 flex items-center gap-6 border-b border-gray-200">
            <span className="-mb-px border-b-2 border-[var(--green)] pb-2.5 text-[14px] font-medium text-[var(--green-ink)]">
              The date
            </span>
            <button onClick={onOpenReport}
              className="-mb-px border-b-2 border-transparent pb-2.5 text-[14px] font-medium text-gray-500 hover:text-gray-900">
              {row.source === 'audit' ? 'The audit' : 'The report'}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">{error}</p>
        )}

        {/* DECISION 30, in order of how much it changes what the date means. */}
        {row.recurs && !row.period && <Note>{PERIOD_NOT_READ}</Note>}
        {row.source === 'document' && !row.document_id && <Note>{DOCUMENT_GONE}</Note>}
        {doc?.hasNewerVersion && <Note>{NEWER_VERSION}</Note>}

        <SectionHead>The date</SectionHead>
        <div>
          <Fact k="When" v={day
            ? <>{longDayAndWeekday(row.next_due)}{passed ? <span className="text-[var(--amber)]"> · {passed}</span> : <span className="text-gray-500"> · {whenWords(row)}</span>}</>
            : <span className="text-gray-500">No day yet</span>} />
          <Fact k="Repeats" v={row.recurs
            ? (row.period ? PERIOD_LABEL[row.period] : <span className="text-gray-500">Yes — how often wasn&apos;t read</span>)
            : 'No'} />
          {row.recurs && row.due_date && (
            <Fact k="Counting from" v={longDay(row.due_date)} />
          )}
          {siteCount > 1 && <Fact k="Site" v={site} />}
          <Fact k="State" v={row.status === 'confirmed'
            ? <>Confirmed{row.confirmed_at ? ` by ${nameOf(row.confirmed_by)} on ${longDay(row.confirmed_at)}` : ''}</>
            : <span className="text-gray-500">{NOT_CONFIRMED}</span>} />
        </div>

        {/* The period picker, opened from the footer. Five choices and nothing else: the route
            refuses anything outside them, and a free-text box would invite a sixth. */}
        {picking && (
          <div className="no-print mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[12px] text-gray-500">How often does it repeat?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PERIOD_CHOICES.map((c) => (
                <button key={c.value} disabled={busy}
                  onClick={async () => { if (await act({ action: 'period', period: c.value })) setPicking(false) }}
                  className={`rounded-md border px-2.5 py-1 text-[13px] ${row.period === c.value
                    ? 'border-[var(--green)] text-[var(--green-ink)]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  {c.label}
                </button>
              ))}
              {row.period && (
                <button disabled={busy} onClick={async () => { if (await act({ action: 'period', period: null })) setPicking(false) }}
                  className="rounded-md px-2.5 py-1 text-[13px] text-gray-500 hover:underline">
                  We don&apos;t know
                </button>
              )}
            </div>
          </div>
        )}

        {/*
          *** WHICH CARD IS DRAWN IS DECIDED BY `source`, NOT BY WHICH ID HAPPENS TO BE SET. ***
          Written the other way round first — `doc ? … : finding ? …` — and an audit's date showed
          the DOCUMENT as where it came from, because `lib/auditRun.ts` files a date finding with
          the document it is about as well as the finding itself, so an audit row carries both ids.
          Caught by opening one and reading it. `source` is the column that says what found the
          date (migration 073's CHECK: document, audit, handbook, rule, person), and it is the only
          thing entitled to answer this question.
        */}
        <SectionHead>Where it came from</SectionHead>
        {row.source === 'audit' && finding ? (
          <div className="rounded-lg border border-gray-200 p-3.5">
            <p className="text-[13px] font-medium text-gray-900">{row.source_title ?? 'An audit'}</p>
            {finding.title && <p className="mt-0.5 text-[12px] text-gray-500">From the finding: {finding.title}</p>}
            {(finding.quote || row.source_line) && (
              <p className="mt-2 text-[12.5px] italic leading-relaxed text-gray-600">
                {finding.locator ? <span className="not-italic text-gray-500">{finding.locator} · </span> : null}
                &ldquo;{finding.quote ?? row.source_line}&rdquo;
              </p>
            )}
            {/* The document the finding was about, when there is one: context, not the source. */}
            {doc && (
              <p className="mt-2 text-[12px] text-gray-500">
                About {doc.title ?? 'a document'}
                {doc.kind ? ` · ${KIND_WORD[doc.kind] ?? doc.kind}` : ''} · {statusWord(doc)}
              </p>
            )}
          </div>
        ) : row.source === 'document' && doc ? (
          <div className="rounded-lg border border-gray-200 p-3.5">
            <p className="text-[13px] font-medium text-gray-900">{doc.title ?? 'A document'}</p>
            <p className="mt-0.5 text-[12px] text-gray-500">
              {[doc.kind ? KIND_WORD[doc.kind] ?? doc.kind : null, doc.issuer, statusWord(doc), doc.file_name]
                .filter(Boolean).join(' · ')}
            </p>
            {row.source_line && (
              <p className="mt-2 text-[12.5px] italic leading-relaxed text-gray-600">
                {row.source_page ? <span className="not-italic text-gray-500">Page {row.source_page} · </span> : null}
                &ldquo;{row.source_line}&rdquo;
              </p>
            )}
          </div>
        ) : row.source === 'person' ? (
          <div className="rounded-lg border border-gray-200 p-3.5">
            <p className="text-[13px] text-gray-900">
              Added by {nameOf(row.added_by)}{row.created_at ? ` on ${longDay(row.created_at)}` : ''}
            </p>
            {row.description && <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-600">{row.description}</p>}
          </div>
        ) : (
          // An audit row whose finding has been deleted, or a source with no card of its own yet
          // (a handbook date, which arrives when HR's structured check returns). Honest either way.
          <p className="text-[13px] text-gray-500">
            {row.source_title
              ? <>From {row.source_title}. We cannot show more about it here.</>
              : <>We cannot say where this date came from.</>}
          </p>
        )}

        {before.length > 0 && (
          <>
            {/* Board 6's third section. It is the document's own other dates that fall earlier —
                `lib/calendarView.ts` `splitSiblings` says why it cannot be the conditions. */}
            <SectionHead>{ASKS_BEFORE(before.length)}</SectionHead>
            <div className="divide-y divide-gray-100 border-y border-gray-100">
              {before.map(siblingRow)}
            </div>
          </>
        )}

        {others.length > 0 && (
          <>
            <SectionHead>Other dates this document sets · {others.length}</SectionHead>
            <div className="divide-y divide-gray-100 border-y border-gray-100">
              {others.map(siblingRow)}
            </div>
          </>
        )}

        <SectionHead>History</SectionHead>
        <p className="text-[13px] leading-relaxed text-gray-600">
          {row.source === 'person'
            ? `Added by ${nameOf(row.added_by)}${row.created_at ? ` on ${longDay(row.created_at)}` : ''}.`
            : row.source === 'audit'
            ? `Found by an audit${row.created_at ? ` on ${longDay(row.created_at)}` : ''}.`
            : `Read from the document${row.created_at ? ` on ${longDay(row.created_at)}` : ''}.`}
          {' '}
          {row.status === 'confirmed'
            ? `Confirmed by ${nameOf(row.confirmed_by)}${row.confirmed_at ? ` on ${longDay(row.confirmed_at)}` : ''}.`
            : 'Not confirmed yet.'}
          {' '}{ALREADY_HANDLED}
        </p>
      </Drawer>

      {/* BOARD 8 — one sheet, and Cancel is the button that holds the focus, so Enter never removes. */}
      {removing && (
        <Sheet title="Remove this date?"
          lede="It leaves your calendar and the monthly email. It stays on file with your reason, so we do not put it back from the same document."
          onClose={() => setRemoving(false)}>
          <label className="block text-[13px] text-gray-700">Why? Optional, one line.</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            placeholder="For example: the permit was renewed, or the date in the document is wrong."
            className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-[var(--green)] placeholder:text-gray-400" />
          <div className="mt-4 flex items-center gap-3">
            <button disabled={busy}
              onClick={async () => { if (await act({ action: 'dismiss', reason })) { setRemoving(false); onClose() } }}
              className="rounded-md bg-red-700 px-3.5 py-1.5 text-[14px] font-medium text-white hover:bg-red-800 disabled:opacity-50">
              {busy ? 'Removing…' : 'Remove'}
            </button>
            <button autoFocus onClick={() => setRemoving(false)} className={`ml-auto ${TEXT_ACTION}`}>Cancel</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
