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

import { Drawer, printDrawer, printDate } from '@/components/Drawer'
import { authHeaders } from '@/lib/supabase'
import {
  WORD_LABEL, WORD_ORDER, WORD_TINT, WORD_INK, TINT_GREY, INK_GREY, TINT_NO_ANSWER,
  citationOrder, orderedRows,
} from '@/lib/auditRows'

import type { Banner } from '@/lib/billing'
import PausedNote from '@/components/PausedNote'
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
  /**
   * The calendar row this date IS, attached by `app/api/audit-runs/[id]/route.ts` (Calendar step 6).
   * Null on every finding that is not a date, and on a date whose filing failed — which is logged
   * and counted on the run rather than hidden, because a date the audit found and could not file is
   * the one thing this line must not claim.
   */
  calendar_event_id?: string | null
  calendar_status?: string | null
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
  /** The fifth word (decision 47). Optional: a run summarised before 4 November has no key. */
  on_file_gaps?: number
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

/**
 * *** THE FIVE WORDS AND THEIR ORDER LIVE IN `lib/auditRows.ts` SINCE PART C. ***
 * The binder prints the same rows as this page, so the labels and the order are shared rather
 * than copied — see that file's header. `WORD` is the local name this file has always used.
 */
const WORD = WORD_LABEL
/**
 * Amber is attention. On file is not attention, and must not borrow the colour.
 *
 * *** AND THE FIFTH WORD IS AMBER, WHICH IS THE WHOLE POINT OF IT — decision 47. ***
 * The defect it was made for is four lines of the owner's own run reading GREEN while the
 * sentence underneath each listed what was missing.
 */
const AMBER_WORD = new Set(['nothing_on_file', 'on_file_gaps', 'stale'])

/**
 * *** THE PALETTE MOVED TO `lib/auditRows.ts` AT PART C — 4 November 2026. ***
 * The binder draws the same word pills as this page (`components/AuditBinder.tsx`), and E1a's
 * whole point was that one word must not be coloured in two places. The tints, their reasoning
 * and the board's own values are in that file beside the labels and the order.
 */

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
  return (s.nothing_on_file ?? 0) + (s.on_file_gaps ?? 0) + (s.stale ?? 0) + (s.contradictions ?? 0)
    + (s.not_a_document_question ?? 0)
}

const fmt = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso))
  return Number.isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * *** ONE BODY, TWO WRAPPERS — decision 55, 4 November 2026. ***
 *
 * The audit report is a PAGE on `/audits?run=<id>`, full width, with a document's reading as the
 * ONE drawer over it. The Calendar still opens it as a drawer, because there it is the second tab
 * of a date's drawer — a drawer SWAPPED for a drawer, not a drawer inside one — and
 * `tests/unit/calendarView.test.ts` pins that shape deliberately (step 8b).
 *
 * So the chrome is a prop and the body is one component. Two renderings of the same report is how
 * the two would drift into saying different things, which is the mistake `components/Drawer.tsx`'s
 * own header records about copying a drawer.
 *
 * **What differs, and only this:** the page has no scrim, no X and no fixed column; its footer is
 * a row at the end of the content rather than a sticky bar; and its header is an `<h1>` rather
 * than the drawer's `<h2>`. The print block, the print type and `printDrawer()` are the drawer's
 * and the page's alike — `aside.print-drawer` is what `visibleDrawer()` looks for, so the page
 * carries the same class and the same two data attributes, and Print works from either.
 */
function Shell({ chrome, title, sub, children, footer, onClose, company, topLine, printType, printDates }: {
  chrome: 'page' | 'drawer'
  title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode
  onClose: () => void; company?: string | null
  printType?: string; printDates?: string; topLine?: React.ReactNode
}) {
  if (chrome === 'drawer') {
    return (
      <Drawer title={title} sub={sub} onClose={onClose} footer={footer} topLine={topLine}
        company={company} printType={printType} printDates={printDates}>
        {children}
      </Drawer>
    )
  }
  return (
    /* `print-drawer` and the two data attributes are what `printDrawer()` reads (Drawer.tsx:37).
       A page that printed without them would print with no company and no type in the frame. */
    <section className="print-drawer mx-auto w-full max-w-[1000px]"
      data-print-company={company ?? ''} data-print-type={printType ?? ''}>
      <div className="hidden print:block mb-5">
        <p className="font-serif text-[22px] font-semibold leading-tight text-gray-900">{title}</p>
        <p className="mt-1.5 text-[11px] text-gray-500">
          {printDates ? `${printDates} · ` : ''}Printed {printDate(new Date())}
        </p>
      </div>
      <div className="no-print">
        {topLine && <div className="mb-2">{topLine}</div>}
        {/* ← Back to the list, because a page has no X and the browser's Back is not a control
            the product offers. It is a text action above the title, the same slot `topLine` is. */}
        <button onClick={onClose}
          className="text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">
          ← All audits
        </button>
        <h1 className="mt-2 font-serif text-[24px] font-semibold leading-tight text-gray-900">{title}</h1>
        {sub && <p className="mt-1 text-[12.5px] text-gray-500">{sub}</p>}
      </div>
      <div className="mt-4">{children}</div>
      {footer && (
        <footer className="no-print mt-8 flex items-center gap-4 border-t border-gray-200 pt-4">
          {footer}
        </footer>
      )}
    </section>
  )
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
function FindingLine({ f, open, onToggle, onOpenDoc, onNotRight, reasonOpen, onCancelReason, onSaveReason, highlight, alsoUnder, off, showDoc }: {
  f: Finding
  /** The other agencies that raised this same finding, already joined into words. */
  alsoUnder?: string | null
  /**
   * *** THE FOURTH COLUMN — board 1, E1a item 5 — AND ONLY THE CHECKLIST REPORT HAS IT. ***
   * Board 1 ends every row with the document it rests on, right-aligned, or an em dash when there
   * is none. The AGENCY report groups its findings UNDER the document they cite (`DocGroup`), so
   * the same column there would print the title once as a heading and again on each row beneath
   * it. One prop, so there is still one row component and not two.
   */
  showDoc?: boolean
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
  /**
   * *** THE WORD IS A TINTED PILL IN A FIXED COLUMN — board 1, E1a item 5. ***
   *
   * It was coloured TEXT: amber for three of the five words and grey for the other two, so
   * "on file" and "not a document question" were the same object to anybody reading down the left
   * edge. The pill is the board's own, and it is the strip's cell again at the size of a word —
   * which is the point: the picture at the top of the page and the rows under it now say the same
   * thing in the same four colours.
   *
   * 132px is board 1's own pill width. `first-letter:uppercase` is why there is still ONE label per
   * word in this file: the counts read "4 on file" and the pill reads "On file".
   */
  const pill = 'print-tint mt-px w-[132px] shrink-0 rounded-full px-2 py-0.5 text-center '
    + 'text-[11px] font-semibold leading-[15px] first-letter:uppercase'
  const word = f.word
    ? <span className={`${pill} ${WORD_TINT[f.word] ?? TINT_GREY}`}>{WORD[f.word] ?? f.word}</span>
    : <span className={`${pill} ${TINT_NO_ANSWER}`}>no answer</span>
  /** The asides that are columns, not prose. Everything else stays where the model wrote it. */
  const noted = [
    f.basis === 'inferred' ? 'worked out from the document, not stated in it' : '',
    f.quote === null || f.quote === undefined ? '' :
      f.quote_verified === false ? 'we could not find that quote in the reading word for word' : '',
    f.handle_error ? 'the reading named a document we could not match' : '',
    // NOT `alsoUnder`: it is already on the row itself, where a person sees it without opening
    // anything. Twice is noise, and the fold is for what has nowhere else to be.
    f.kind === 'date' && f.due_on
      ? `a date, not a finding: due ${f.due_on}${f.recurs ? ', and it repeats' : ''}${f.passed ? ' — passed' : ''}`
      : '',
  ].filter(Boolean)
  return (
    /* `id` is what the strip's cell scrolls to — a picture nobody can get to the inside of is a
       picture they have to take on trust. */
    <div id={`f-${f.id}`} className={`${highlight ? 'bg-amber-50/40' : ''} ${
      off ? 'hidden print:block' : ''}`}>
      {/* The whole line is the control. A title that is clickable only on its first few words is a
          control nothing announces (the same note the Audits page carries about its agency rows). */}
      <div role="button" tabIndex={0} onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        className="flex cursor-pointer items-start gap-3 border-b border-gray-50 py-2.5 last:border-b-0 hover:bg-gray-50">
        <span className={`no-print w-3 shrink-0 text-[11px] leading-5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        {/* *** FOUR FIXED COLUMNS THAT LINE UP DOWN THE PAGE — decision 59, board 1's own grid. ***
            Board 1 is `10px 132px 26px 1fr 260px` with a 12px gutter. The word's column was 150px
            and held coloured text; it is the board's 132px pill now. Everything decision 59 was
            about still holds and is why these are widths and not padding: the cell was `shrink-0`
            with NO width once, so every requirement's left edge moved with the length of the word
            beside it and twenty rows read as a ragged edge. Nothing truncates. */}
        {word}
        {/* *** THE AUDITOR'S LINE, WHOLE — decision 58, 4 November 2026, and W9. ***
            This was `truncate`, so a 235-character checklist line ended in an ellipsis and the
            person had to open the row — or hover — to read the question they had been asked. The
            line is stored whole (`template_text`, longest 235 against a 1000 cap, measured on
            staging), so the truncation was ours alone. It wraps now, on screen and on paper.
            `w-[36px]` on the reference keeps the requirements' left edges in one column down the
            page, which is decision 59 applied to the one place a list of rows has a prefix. */}
        {/* *** THE REFERENCE IS ITS OWN CELL, NOT A PREFIX — decision 59, measured. ***
            It was an `inline-block` inside the requirement, and a wrapped line then started at
            the REFERENCE's left edge instead of the requirement's: "A1  Current Oregon DEQ Air
            Contaminant Discharge Permit on site, not expired, with the renewal application due
            date / noted." — the second line 37px to the left of the first. Photographed before
            this was changed. Two cells, so a requirement of any length is one block. */}
        {f.template_line
          ? <span className="w-[36px] shrink-0 text-[13px] font-semibold leading-5 text-gray-700">{f.template_line}</span>
          : null}
        <span className="min-w-0 flex-1 text-[14px] leading-snug text-gray-900">
          {f.template_text ?? f.title}
          {/* *** THE SAME FINDING, SHOWN ONCE UNDER EACH AGENCY IT BELONGS TO — Run 7b, item 5. ***
              Two regulators wanting the same record is a fact about the company, not a mistake, and
              a person reading the OSHA group should know the Department of Agriculture wants it too.
              *** INSIDE THE REQUIREMENT'S OWN CELL SINCE E1a. *** It was a `shrink-0` span of its
              own between the requirement and the document, which is a fifth column that only some
              rows have — and a column only some rows have is what makes the others look misaligned.
              It is context about the finding, so it sits with the finding. */}
          {alsoUnder && <span className="text-[11px] text-gray-400"> · also under {alsoUnder}</span>}
          {f.handle_error && (
            <span className="text-[11px] text-[var(--amber)]"> · no document matched</span>
          )}
        </span>
        {showDoc && (
          /* Board 1's last column: the document this line rests on, right-aligned and wrapping, or
             an em dash where there is nothing — which on this report is the honest mark for a line
             with nothing on file.
             *** 260px, BUT NEVER MORE THAN 28% OF THE ROW. *** `shrink` alone does nothing here:
             the requirement is `flex-1` with `min-w-0`, so it gives up its own width first and the
             line never overflows — measured at a 661px row, where the requirement was squeezed to
             149px and this column still held all 260. The cap is what makes the two share, and it
             is a percentage of the row, so every row in one report still lands on one edge. */
          <span className="w-[260px] min-w-0 max-w-[28%] text-right text-[13px] leading-snug">
            {f.document && f.document_id ? (
              <button onClick={(e) => { e.stopPropagation(); onOpenDoc(f.document_id as string) }}
                title={f.document.title}
                className="cursor-pointer text-right text-[var(--green)] underline hover:text-[var(--green-ink)]">
                {f.document.title}
              </button>
            ) : <span className="text-gray-400">—</span>}
          </span>
        )}
      </div>

      {/* *** INDENTED UNDER THE ROW'S TEXT, NOT UNDER THE CHEVRON — board 1's `.fopen`. ***
          Board 1 indents the open part to 180px where its requirement column starts at 204 — 24px
          to the left of the text it belongs to, so the fold reads as part of that line and not as
          a new left edge. This row's requirement starts at 216 (12 chevron + 12 + 132 pill + 12 +
          36 reference + 12), measured off the classes above rather than chosen, so the same 24px
          is 192. Photographed at 168 first, which put it 48px out and under the reference. */}
      <div className={open ? 'border-b border-gray-50 pb-3 pl-[192px]'
                           : 'hidden border-b border-gray-50 pb-3 pl-[192px] print:block'}>
        {/*
          *** TWO LABELLED PARTS, NOT THREE — board 1 asks for three and the data holds two. ***
          Board 1's open row is *What we found · The line we read · What to do*. There is no
          `what_we_found` column: `what_to_do` carries BOTH, and the live rows prove it — B2's
          reads "The roster is dated 1 October 2026 and lists four operators. It shows only two of
          them… Have a qualified person evaluate him now." Splitting that is a prompt change and a
          §3.1 decision, recorded in `docs/GAPS-PLAN.md` §7 as a later prompt job. Until then the
          honest shape is the two parts the fields actually are, and the label says which.
        */}
        {(f.document || f.locator || f.quote) && (<>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">The line we read</p>
          {f.quote && <p className="mt-0.5 font-serif text-[14px] italic leading-relaxed text-gray-700">&ldquo;{f.quote}&rdquo;</p>}
          <p className="mt-0.5 text-[12px] text-gray-500">
            {f.document && (
              /* `text-left` is not decoration: a <button> is `text-align: center` by default, and
                 a long document title wrapping inside this line printed its SECOND line centred.
                 Photographed on the print of the Clackamas report before this was fixed. */
              <button onClick={(e) => { e.stopPropagation(); f.document_id && onOpenDoc(f.document_id) }}
                title={f.document.title}
                className="cursor-pointer text-left text-gray-600 hover:underline hover:text-gray-900">
                {f.document.title}
              </button>
            )}
            {f.locator ? <span>{f.document ? ' · ' : ''}{f.locator}</span> : null}
          </p>
        </>)}
        {f.what_to_do && (<>
          <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">What to do</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-700">{f.what_to_do}</p>
        </>)}
        {/*
          *** ALSO NOTED CARRIES ONLY WHAT IS A FIELD. ***
          Board 1's fold holds the caveats and the "proposed, not confirmed" asides. Measured on
          the live rows, those are PROSE INSIDE `what_to_do` — "All of these names and addresses
          were only proposed by the readings; none has been confirmed" is one sentence of A1's
          what_to_do, not a column. So this fold holds the four things that ARE separable, and
          nothing is moved out of the prose, where it stays visible above.
        */}
        {noted.length > 0 && (
          /* Board 1 draws this as one folded grey line — "▸ Also noted — 3 things: …" — and the
             things are on the line in the board too, so the ▸ there opens nothing. One line here,
             with the count, for the reason the board's is one line: it is already inside the fold
             the row itself is, and a fold inside a fold would have to be unfolded on paper by
             somebody who cannot click. */
          <p className="mt-2 text-[12px] text-gray-400">
            <span className="no-print">▸ </span>
            <span className="font-medium uppercase tracking-wide">Also noted</span>
            {' '}— {noted.length} thing{noted.length === 1 ? '' : 's'}: {noted.join(' · ')}
          </p>
        )}
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
/**
 * *** THE STRIP — board 1, and TEMPLATE RUNS ONLY (the owner, 4 November 2026). ***
 *
 * One cell per checklist line, in the auditor's own order (decision 50), coloured by its word. It
 * is the picture: ten cells tell somebody at a glance what a page of prose takes a minute to say.
 *
 * **An agency run has no strip and that is the decision, not an omission.** A checklist has a
 * fixed list of questions in a fixed order; an agency run's findings are however many the reading
 * produced, grouped by document in citation order. Forty-three cells in that order is decoration —
 * it looks like a picture and is not one. Agency runs keep the counts row, which is true.
 *
 * The cell is a BUTTON: it scrolls to its row and opens it, because a picture nobody can get to
 * the inside of is a picture they have to take on trust (the same reason the counts are a filter).
 */
/**
 * *** THE CELLS STRETCH THE FULL WIDTH — board 1, E1a item 2. ***
 * `flex-1`, as the board's own `.strip .cell` does. They were `min-w-[34px]` and left-packed, so a
 * ten-line checklist drew a short row of chips in the top-left corner of a 1000px page and read as
 * a toolbar. Stretched, the row IS the checklist: every line has the same share of it, and the
 * colours are in the proportions the counts underneath say they are in.
 */
function Strip({ cells, onPick }: {
  cells: Array<{ id: string; ref: string | null; word: string | null }>
  onPick: (id: string) => void
}) {
  if (!cells.length) return null
  return (
    <div className="mt-4 flex gap-1">
      {cells.map((c) => (
        <button key={c.id} onClick={() => onPick(c.id)}
          title={`${c.ref ?? ''} — ${c.word ? (WORD[c.word] ?? c.word) : 'we did not get an answer'}`}
          className={`print-tint flex h-[34px] min-w-0 flex-1 items-center justify-center overflow-hidden
            rounded-md px-1 text-[12px] font-semibold ${
            c.word ? (WORD_TINT[c.word] ?? TINT_GREY) : TINT_NO_ANSWER}`}>
          {c.ref ?? '·'}
        </button>
      ))}
    </div>
  )
}

/**
 * *** THE COUNTS ROW, DIRECTLY UNDER THE STRIP — board 1, E1a item 3. ***
 *
 * The numbers in the word's own tint with the count bold, and the run's totals on the right:
 * *"4 on file · 2 on file, gaps found · 2 out of date · 2 nothing on file"* and
 * *"10 lines · 3 sections · 11 documents read"*. It is the shape of the answer in one line, which
 * is what turns "43 findings" into "show me the eleven with nothing on file".
 *
 * *** THE "all" CHIP IS GONE — the owner, 4 November. *** It was there so the control would always
 * say which state it was in rather than leave a person to infer it from nothing being highlighted.
 * A row of five tinted counts with none of them ringed says that by itself: ringed means only
 * those are shown, and pressing the ringed one again shows them all. One fewer control, and the
 * row now reads as the board's counts rather than as a filter bar that happens to carry numbers.
 */
function Counts({ counts, value, onChange, right }: {
  counts: Array<{ word: string; label: string; n: number }>
  value: string | null
  onChange: (w: string | null) => void
  /** The totals the board puts at the right-hand end. The checklist report passes them. */
  right?: string
}) {
  const live = counts.filter((c) => c.n > 0)
  if (!live.length) return <p className="text-[13px] text-gray-600">Nothing was answered.</p>
  return (
    <div className="no-print mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {live.map((c) => (
        <button key={c.word} onClick={() => onChange(value === c.word ? null : c.word)}
          title={value === c.word
            ? 'Showing only these — press again for all of them'
            : `Show only these ${c.n}`}
          className={`rounded-full px-2 py-0.5 text-[13px] ${
            value === c.word ? `${WORD_TINT[c.word] ?? TINT_GREY} ring-1 ring-gray-900/25`
                             : 'text-gray-500 hover:bg-gray-100'}`}>
          <b className={`font-semibold ${value === c.word ? '' : (WORD_INK[c.word] ?? INK_GREY)}`}>{c.n}</b>
          {' '}{c.label}
        </button>
      ))}
      {right && <span className="ml-auto text-[12px] text-gray-500">{right}</span>}
    </div>
  )
}

/** The same counts as plain text, for print — a row of tinted capsules is a screen control. */
function WordCountsPrint({ counts, right }: {
  counts: Array<{ word: string; label: string; n: number }>; right?: string
}) {
  const bits = counts.filter((c) => c.n > 0).map((c) => `${c.n} ${c.label}`)
  if (!bits.length) return null
  return (
    <p className="hidden text-[13px] text-gray-700 print:block">
      {bits.join(' · ')}{right ? ` · ${right}` : ''}
    </p>
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

export default function AuditReport({ runId, focusWord, onClose, onChanged, onOpenDoc, companyName, topLine, paused = null, chrome = 'drawer', onPrintBinder }: {
  runId: string; focusWord?: string | null; onClose: () => void; onChanged: () => void
  /**
   * *** A PAGE ON /audits, A DRAWER ON THE CALENDAR — decision 55, 4 November 2026. ***
   * One body, two wrappers (`Shell`). It defaults to `drawer` so the Calendar — which opens this
   * as the second tab of a date's drawer, and whose shape `tests/unit/calendarView.test.ts` pins
   * — needs no change at all. `/audits` passes `page`.
   */
  chrome?: 'page' | 'drawer'
  /**
   * *** SWITCH THIS REPORT INTO BINDER MODE — Part C, decision 61. ***
   * Only `app/audits/page.tsx` passes it, because only a page can change its own address. Without
   * it (the Calendar's drawer) the footer's button navigates to `/audits?run=<id>&binder=1`
   * instead, which is the same destination by the same route a bookmark would take.
   */
  onPrintBinder?: () => void
  /** Step 18, decision 11 — a prop from the page, which already holds the verdict. */
  paused?: Banner | null
  /** On paper, top left of every page (board 10). The page reads it; this component has no session. */
  companyName?: string | null
  /**
   * A LINE ABOVE THE TITLE, IN THE HEADER — `Drawer`'s own `topLine` slot, which
   * `components/DocumentReport.tsx` has taken since Audits Run 4a and this component did not.
   * Added additively at Calendar step 8b: the Calendar's date drawer opens an audit's report as
   * its second tab, and without a way back that tab is a dead end — Close is not "back".
   * `app/audits/page.tsx` passes nothing and is unchanged, in markup and in behaviour.
   */
  topLine?: React.ReactNode
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
      // *** SUGGESTIONS ARE FOLDED, ALWAYS — decision 60, 4 November 2026. ***
      // Every other group opens when it is the only one there is. This one does not, even then:
      // a suggestion is not a finding, and a report that opens on "what companies like you
      // usually hold" leads with the one list nobody has checked.
      expected: false,
      failed: single, earlier: false, dismissed: false,
    })
  }, [runId, rep])

  /**
   * The two states before the report exists go through the Shell as well, or a failed read on
   * `/audits?run=<id>` would open a DRAWER over the page a person is already looking at — the
   * chrome changing under them because something went wrong, which is the opposite of §5.1's
   * "say plainly whose problem it is".
   */
  if (error) {
    return <Shell chrome={chrome} title="Audit" onClose={onClose} topLine={topLine} company={companyName}>
      <p className="text-[14px] text-[var(--amber)]">{error}</p>
      <button onClick={load} className="mt-2 text-[13px] text-[var(--green)] underline">Try again</button>
    </Shell>
  }
  if (!rep) {
    return <Shell chrome={chrome} title="Reading…" onClose={onClose} topLine={topLine} company={companyName}>
      <p className="text-[14px] text-gray-400">Opening…</p>
    </Shell>
  }

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
   * *** THE ZIP IS GONE, AND WITH IT THE BUTTON THAT FETCHED IT — Part C, decision 61. ***
   *
   * `downloadDocuments` lived here: it fetched `GET /api/audit-runs/[id]/documents` with
   * `authHeaders()` and saved the blob, written that way because a plain `<a href>` sends no
   * `Authorization` header and returned `{"error":"Unauthorized"}` on production (Run 9, item 1).
   * Both it and the route are deleted. Two reasons, and the second is the one that matters:
   *
   *   · **§143, the owner's decision of 1 October:** when the binder lands it REPLACES the
   *     download. A person wants the folder they can hand over, not a choice between two kinds of
   *     archive.
   *   · **The zip could not be handed over anyway at the size that mattered.** It built the whole
   *     archive in memory and returned it as one response body, with no size check, against
   *     Vercel's 4.5 MB limit (`docs/GAPS-PLAN.md`): an audit over a dozen scanned PDFs failed as
   *     a 500 that read "We could not build that download just now". The binder is drawn in the
   *     browser and never crosses that wall.
   */

  // THE ONE META LINE. Audited date, sections, what it read and what it only listed, and how fresh
  // the evidence was. No cost: what a reading cost us is our business, not a line on the report
  // somebody takes to an inspector.
  /**
   * *** THE TITLE, ONE STRING, WHOLE — board 1 and the owner's call of 4 November. ***
   *
   * A template run is named by the checklist's own reading title. Board 1 draws that title with
   * the issuer on a second line — *"Northwest Supplier Assurance Program, revision 2026-03"* —
   * and **it is not two fields**: the scan writes one string, *"Pre-Inspection Audit Checklist for
   * Oregon chemical blending and distribution facilities (Northwest Supplier Assurance Program,
   * revision 2026-03), blank template"*. Splitting it is a prompt change, recorded in
   * `docs/GAPS-PLAN.md` §7 as a later prompt job. It prints whole, which is true.
   *
   * An agency run is "<agency> audit, <date>" — the date in the title because a page can be
   * bookmarked and two audits of the same agency are told apart by when they ran.
   */
  const auditedOn = fmt(run.finished_at ?? run.created_at)
  const titleText = run.kind === 'template'
    ? (rep.documents?.[run.template_document_id ?? '']?.title ?? 'Against your checklist')
    : `${everything ? 'Audit of everything' : agency}${auditedOn ? `, ${auditedOn}` : ''}`

  /**
   * *** ONE META LINE UNDER THE TITLE — board 1, E1a item 1. ***
   *
   * The board's line is *"Northwest Supplier Assurance Program, revision 2026-03 · audited
   * 3 November 2026 · readings as of 3 November 2026 · you asked: '…'"*, and **its first part is
   * not a field.** The scan writes ONE string and the issuer and revision are inside it —
   * *"…(Northwest Supplier Assurance Program, revision 2026-03), blank template"* — read off
   * `document_index_v.title` on staging, where there is no issuer column and no revision column to
   * read instead. Splitting it is a prompt change (§3.1), recorded in `docs/GAPS-PLAN.md` §7 with
   * the title split it belongs to. So this line starts at "audited", and the issuer stays in the
   * title above it, where it is true.
   *
   * *** AND "You asked" IS IN IT NOW, NOT UNDER IT. *** It was a fourth grey paragraph of its own
   * on both reports. The board has four things on one line; four lines of meta is the jungle this
   * step is clearing.
   *
   * The lines, sections and documents go to the RIGHT-HAND END OF THE COUNTS ROW on the checklist
   * report, which is where board 1 puts them. An agency run has no strip and no fixed line count,
   * so its sections and documents stay here.
   */
  const counted = `${run.section_count} section${run.section_count === 1 ? '' : 's'} · `
    + `${docsRead.length} document${docsRead.length === 1 ? '' : 's'} read`
    + (docsUnread.length ? `, ${docsUnread.length} held unread` : '')
  const sub = [
    `audited ${fmt(run.finished_at ?? run.created_at)}`,
    run.kind === 'template' ? '' : counted,
    run.readings_as_of ? `readings as of ${fmt(run.readings_as_of)}` : '',
    run.scope ? `you asked: “${run.scope}”` : '',
  ].filter(Boolean).join(' · ')
  // ON PAPER (board 10): one line of this audit's own dates, absolute. Sections and documents print in the body.
  const printDates = `Audited ${fmt(run.finished_at ?? run.created_at)}`
    + (run.readings_as_of ? ` · Readings as of ${fmt(run.readings_as_of)}` : '')

  /**
   * *** THE FOOTER IN BOARD 1'S ORDER — E1a item 8. ***
   *
   * Audit again · Print · Make a checklist · Download the files · Not right, then the board's own
   * closing sentence at the right-hand end. Print moved up to second because it is the thing a
   * person does with a finished report; "Download the files" used to be pushed to the far right by
   * `ml-auto`, where a reader found it last and the sentence that belongs there had nowhere to go.
   *
   * *** "Download the documents" → "Download the files" — the owner, 4 November. *** Until Part C
   * builds the binder, this button hands over the raw files it has, and "the documents" reads like
   * the report. Board 1's primary action is **Build the binder**, which decision 57 holds back to
   * Part C: HIDDEN, not greyed, because a greyed control promises something.
   */
  const footer = (
    <>
      <button disabled={busy || Boolean(paused)} onClick={auditAgain}
        className="whitespace-nowrap rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50 disabled:opacity-50">
        {busy ? 'Working…' : 'Audit again'}
      </button>
      <button onClick={printDrawer} className="whitespace-nowrap text-[14px] text-gray-600 hover:text-gray-900 hover:underline">Print</button>
      <button disabled={busy || !plain.length} onClick={makeChecklist}
        className="whitespace-nowrap text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300">
        Make a checklist
      </button>
      {/* *** "Print the binder" — Part C, decision 61, in the slot the zip's button had. ***
          On the page it switches this report into binder mode (the page owns the address). In the
          Calendar's drawer there is no page to switch, so it opens `/audits?run=<id>&binder=1` —
          the binder is a page, and a drawer inside a drawer is the one shape decision 55 forbids. */}
      <button onClick={() => (onPrintBinder
        ? onPrintBinder()
        : (window.location.href = `/audits?run=${run.id}&binder=1`))}
        className="whitespace-nowrap text-[14px] text-gray-600 hover:text-gray-900 hover:underline">
        Print the binder
      </button>
      <button onClick={() => setReasonFor('run')} className="whitespace-nowrap text-[12px] text-gray-400 hover:text-gray-700 hover:underline">
        Not right
      </button>
      {/*
        *** THE SENTENCE IS THE PAGE'S, AND `whitespace-nowrap` IS WHY. ***
        Board 1's footer is `white-space: nowrap` across a 852px page. The Calendar opens this same
        report in a 720px drawer, and photographed there the sentence took the room five actions
        needed: "Audit again", "Make a checklist", "Download the files" and "Not right" each broke
        mid-phrase onto two lines. The actions are what the footer is FOR, so they never break now,
        and the one thing that is only commentary stands down where there is no room for it. The
        drawer still says when the audit ran — it is the first thing in the meta line.
      */}
      {chrome === 'page' && (
        <span className="ml-auto text-[12px] text-gray-400">
          Every audit is kept. This one is exactly what it said on {auditedOn}.
        </span>
      )}
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
    { word: 'on_file_gaps', label: 'on file, gaps found' },
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
    // Counts by word, and no score. *** A CHECKLIST IS NOT A TEST AND HAS NO MARK. *** "11 of 15"
    // invites the reader to treat four lines as a fail and eleven as a pass, when one of the four
    // may be a record kept on a clipboard and never uploaded. The words carry what is true.
    const noAnswer = openF.filter((f) => f.template_line && !f.word).length
    // The counts are now the FILTER (Run 7b, item 6) — the same control the agency report has, and
    // one more entry for the rows that carry no word at all, which only a checklist produces.
    /**
     * *** A SUGGESTION IS NEVER IN THE COUNTS — decision 60, 4 November 2026. ***
     * This counted over `openF`, which includes `kind = 'expected'` rows — and every expected row
     * carries the word `nothing_on_file` (`audit_findings_expected_is_expected`, 058:209). A
     * template run writes no expected rows today, so nothing was wrong on screen; but board 1 puts
     * "Usually held — not seen" on this report, and the count would have been wrong the day that
     * arrived. The agency report has always counted over `plain` for the same reason.
     */
    const tCounts = [...countsFor(openF.filter((f) => f.kind !== 'expected')),
                     ...(noAnswer ? [{ word: '__none', label: 'we did not get an answer for', n: noAnswer }] : [])]
    // `__none` is not a word, so it cannot be compared with one: it selects the rows whose word is
    // null, which is what the person clicking it is asking for.
    const tKeep = (list: Finding[]) => (wordFilter === '__none'
      ? list.filter((f) => !f.word)
      : wordFilter ? list.filter((f) => f.word === wordFilter) : list)

    /**
     * *** THE STRIP, IN THE AUDITOR'S OWN ORDER — board 1, decisions 50 and 55. ***
     * One cell per checklist line, section by section, each section's lines in their own ordinal
     * order. It is built from the ROWS and not from `run.template_lines`, because the rows are
     * what the report shows and a strip that disagreed with the rows under it would be worse than
     * no strip (decision 50: a line nobody answered is still a row, and still a cell).
     */
    const stripCells = orderedRows(sections, openF)
      .map((f) => ({ id: f.id, ref: f.template_line, word: f.word }))
    /** Board 1's right-hand end: "10 lines · 3 sections · 11 documents read". The lines are the
     *  cells, so the number beside the strip and the strip itself can never disagree. */
    const tRight = `${stripCells.length} line${stripCells.length === 1 ? '' : 's'} · `
      + `${run.section_count} section${run.section_count === 1 ? '' : 's'} · `
      + `${docsRead.length} document${docsRead.length === 1 ? '' : 's'} read`
      + (docsUnread.length ? `, ${docsUnread.length} held unread` : '')

    return (
      <Shell chrome={chrome} title={titleText} sub={sub} onClose={onClose} footer={footer} topLine={topLine}
        company={companyName} printType="Audit report" printDates={printDates}>
        {/* The run's own state first, because a page somebody has just opened must say whether
            what they are looking at is finished. */}
        {run.status !== 'done' && (
          <p className="mt-2 text-[13px] text-gray-600">
            Still running · {run.done_count} of {run.section_count} section
            {run.section_count === 1 ? '' : 's'} done{run.estimate ? ` · ${run.estimate}` : ''}
          </p>
        )}
        <Strip cells={stripCells} onPick={(id) => {
          setOpenFinding((o) => ({ ...o, [id]: true }))
          document.getElementById(`f-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }} />
        {/* The counts DIRECTLY under the strip, with the run's totals at the right-hand end — the
            two together are board 1's answer to "what shape is this report" (E1a items 2 and 3). */}
        <Counts counts={tCounts} value={wordFilter} onChange={setWordFilter} right={tRight} />
        <WordCountsPrint counts={tCounts} right={tRight} />
        <p className="mt-3 font-serif text-[15px] leading-relaxed text-gray-800">
          Every line below is a line of your checklist, answered against the documents you have given
          us. None of it is a verdict on whether the company complies.
        </p>
        {/* The sentence about the form itself: what we noticed before answering a single line
            (Run 5a, item 6). Under the lede, because both are about the whole report. */}
        {run.summary?.note && (
          <p className="mt-1.5 text-[13px] text-gray-500">{run.summary.note}</p>
        )}
        {/* *** ONE NOTE, NOT TWO. *** It was rendered twice, one line after the other, from E1's
            move of this block — invisible on a paying account (`PausedNote` returns null without a
            banner) and two identical panels on a paused one. */}
        <PausedNote banner={paused} />
        {notice && <p className="no-print mt-2 text-[13px] text-gray-700">{notice}</p>}
        {/* *** "Not right" ON THE RUN HAD NOWHERE TO PUT THE ANSWER ON THIS REPORT. *** The footer
            button sets `reasonFor` to 'run' on both reports and only the agency branch drew the
            box, so on a checklist report the press did nothing a person could see. §5 — never
            silent. */}
        {reasonFor === 'run' && (
          <ReasonBox onCancel={() => setReasonFor(null)}
            onSave={(r) => { setReasonFor(null); setNotice(`Thank you — we have kept that: “${r}”`) }} />
        )}

        {/* One folded group per checklist section, in the checklist's own order. */}
        {sections.map((sec) => {
          const allT = openF.filter((f) => f.section_id === sec.id)
            .sort((a, b) => a.ordinal - b.ordinal)
          const mine = tKeep(allT)
          const key = `t-${sec.id}`
          return (
            /**
             * *** THE SECTIONS OPEN — board 1, 4 November 2026. ***
             * They started closed on a multi-section checklist, as "the form's own table of
             * contents". The strip above is that table of contents now, and it is better at it:
             * it shows every line's word at a glance, which a row of closed headings does not.
             * A page a person has navigated to in order to read is not a page to open three
             * times before anything is on it.
             */
            <Section_ key={sec.id} title={sec.title} count={mine.length}
              open={open[key] ?? true}
              onToggle={() => setOpen((o) => ({ ...o, [key]: !(o[key] ?? true) }))}>
              {sec.status === 'could_not_complete' ? (
                <div>
                  <p className="text-[13px] text-gray-600">{sec.could_not_complete_reason}</p>
                  <button disabled={busy || Boolean(paused)} onClick={() => retry(sec.id, sec.title)}
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
                <FindingLine key={f.id} f={f} showDoc
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

        {/* *** THE SUGGESTIONS, ONE FOLDED GREY LINE, NEVER COUNTED — decision 60, board 1. ***
            They are not findings and they are not one of the five words. `tCounts` already
            excludes them (E0); this is where board 1 puts them on the checklist report, which is
            the last thing on the page and folded even when it is the only thing there. */}
        {expected.length > 0 && (
          /* *** ONE FOLDED GREY LINE AT THE FOOT OF THE ROWS — board 1's `.sugg`, E1a item 7. ***
             It was a section heading like every other, which gave a list nobody has checked the
             same weight on the page as the checklist's own answers. A grey panel after the last
             row is the board's own answer to that, and it says in the line itself that these are
             suggestions and are not in the counts. */
          <div className="mt-5 rounded-lg border border-gray-100 bg-gray-50 px-3.5 py-3">
            <button onClick={() => setOpen((o) => ({ ...o, expected: !o.expected }))}
              className="flex w-full items-baseline gap-1.5 text-left text-[13px] text-gray-500">
              <span className="no-print text-gray-400">{open.expected ? '▾' : '▸'}</span>
              <span>
                <span className="font-medium text-gray-700">Usually held — not seen</span>
                {' · '}{expected.length} document{expected.length === 1 ? '' : 's'} companies like
                this usually hold that we have not been shown. These are suggestions, nobody has
                checked them against a requirement, and they are not in the counts above.
              </span>
            </button>
            <div className={open.expected ? 'mt-2' : 'hidden print:mt-2 print:block'}>
              {expected.map((f) => (
                <div key={f.id} className="border-b border-gray-200 py-2 last:border-b-0">
                  <p className="text-[14px] text-gray-800">{f.title}</p>
                  {f.what_to_do && <p className="mt-0.5 text-[12px] text-gray-500">{f.what_to_do}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

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
      </Shell>
    )
  }

  return (
    <Shell chrome={chrome} title={titleText}
      sub={sub} onClose={onClose} footer={footer} topLine={topLine}
      company={companyName} printType="Audit report" printDates={printDates}>
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
      {/* *** AND THE AGENCY REPORT HAD NO NOTE AT ALL — found at E1a, 4 November 2026. ***
          Commit 10786ee put the read-only note in this component twice, one line after the other,
          and both copies went into the CHECKLIST branch. So a paused customer opening an agency
          report saw a disabled "Audit again" and nothing saying why, which is the one thing the
          read-only rule exists to prevent (`tests/unit/readOnlyUi.test.ts`: every paid control
          sits beside the note). One per branch now. */}
      <PausedNote banner={paused} />
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
          {/* No strip here, and that is decision 55's call, not an omission: an agency run's
              findings are however many the reading produced, in citation order, and 43 cells in
              that order is decoration. The counts are true of both reports and stay on both. */}
          <Counts counts={countsFor(plain)} value={wordFilter} onChange={setWordFilter} />
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
             * *** AND SINCE CALENDAR STEP 6 IT IS ON THE CALENDAR TOO. ***
             * This comment used to end "No 'Add to calendar' on one of these: the link would put a
             * row on the calendar with no date." That was right about the OLD link, which carried
             * the date in the address and would have carried an empty one. It is not a reason to
             * hide the line: migration 073's `calendar_events_date_or_recurs` holds a recurring
             * date with no day — 060's rule, copied — so an undated recurring obligation IS filed,
             * and saying nothing about it here would be the one screen that pretends otherwise.
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
              {/**
                * *** AUDITS STOPS ASKING — Calendar step 6, decision 7. ***
                *
                * There was an "Add to calendar" link here carrying the title and the day in the
                * address, which the old `/calendar` page (:78–88, before step 7 replaced that
                * file) turned into a prefilled form for a
                * person to save. Two things were wrong with it: the product had already found the
                * date and was asking to be allowed to keep it, and the link could name no finding,
                * so the calendar row it made could never say which audit it came from
                * (`docs/CALENDAR-MACHINERY.md` B7). `lib/auditRun.ts` files it now, and this is a
                * statement with a way back to the date.
                *
                * An HREF, not a button: `?finding=` is read at step 8, and a link starts working
                * the moment it is (`docs/HANDOFF-CODE.md` §7).
                */}
              {/* *** A FOURTH WORDING, WITH NO LINK — Calendar step 6b, decision 29. ***
                * A finished run of an agency withdraws that agency's earlier proposed dates it did
                * not match, and an earlier run's report page stays openable — so this is where a
                * withdrawn row is actually read. Saying "waiting for your confirmation" about a
                * date the newest audit of this agency did not find again is the omniscient status
                * tracker pointing the other way (§6).
                *
                * NOT A LINK: `calendar_v` does not return a withdrawn row (migration 075), so
                * `?finding=` would open a page that cannot find it at step 8. */}
              {f.calendar_event_id && (
                f.calendar_status === 'withdrawn'
                  ? <span className="no-print shrink-0 text-[12px] text-gray-400">
                      Not in the latest audit of this agency
                    </span>
                  : <a href={`/calendar?finding=${f.id}`}
                      className="no-print shrink-0 text-[12px] text-gray-400 underline hover:text-gray-600">
                      {f.calendar_status === 'confirmed' ? 'On your calendar'
                        : f.calendar_status === 'dismissed' ? 'Removed from your calendar'
                        : 'On your calendar — waiting for your confirmation'}
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
      {/* *** DECISION 60'S SIXTH LABEL. *** It is not one of the five words: it is a suggestion,
          folded, outside every count and outside the strip. The words are the owner's, board 1. */}
      {expected.length > 0 && (
        <Section_ title="Usually held — not seen · documents companies like this usually hold that we have not been shown"
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
              <button disabled={busy || Boolean(paused)} onClick={() => retry(s.id, s.title)}
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
    </Shell>
  )
}
