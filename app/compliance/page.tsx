'use client'
/**
 * THE COMPLIANCE WORKSPACE — rebuilt from `prototypes/compliance-workspace.html`, Run 3.
 * `DECISIONS.md` §126.
 *
 * *** THE PROTOTYPE IS THE SPEC. *** Where it and the old page differed, it won: the tabs, the
 * docking composer, the drawers, the row pattern and the vocabulary are all its. Where it is
 * silent — auth, storage paths, how a checklist item persists — the old page's behaviour is kept.
 *
 * REBUILT RATHER THAN PATCHED. The old page carried two tabs that no longer exist ("Create
 * action items", "Saved"), and a layout with no drawer. Patching would have left the removed
 * vocabulary in the file.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES NOT DO
 *   · It does not touch a prompt or a pipeline switch (`CLAUDE.md` §3.1).
 *   · It does not read or write requirements, obligations or switches. It used to make ONE such
 *     write — "Save it" on a fact proposal, through `/api/switches/answer` — and that card is gone
 *     (Workspace Task 3, the owner's decision: facts belong to Company information). The page now
 *     only COUNTS a conversation's pending proposals, in the summary drawer, and links there.
 * ---------------------------------------------------------------------------
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useId } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
// Lifted to components/Drawer.tsx in Documents Run 4 so the Documents report uses the same one.
import { Drawer, printDrawer, printDate } from '@/components/Drawer'
import { printWithFrame } from '@/lib/printFrame'
import { AnswerBody, SourceList, type AnswerSource } from '@/components/AnswerBody'
import { EXAMPLE_QUESTIONS } from '@/config/examples'
import { displaySource } from '@/lib/sourceTitle'
import { readAnswerStream, ndjsonLines } from '@/lib/answerStream'
import { DOCUMENTS_BUCKET } from '@/lib/storage'
import { ACCEPTED_FILE_TYPES } from '@/lib/acceptedFiles'
// TYPES ONLY. `lib/summaryReport.ts` imports the model client and must not reach the browser; a type
// import is erased at build. The two strings it displays are copied below and pinned by a unit test.
import type { SummaryReport, ReportItem } from '@/lib/summaryReport'
import DocumentReport from '@/components/DocumentReport'
import {
  conversationStatus, progressPercent, friendlyDate,
} from '@/lib/conversationStatus'
import {
  groupItems, madeInWorkspace, mustDoLabel, oneLineSource, thingsToDo, noSourceText, itemSources, isResearching, howToHeading, stepSourceNumbers,
} from '@/lib/checklistView'
import { OTHER_SOURCE_LINE, DROPPED_LINE, urlKey, sourceCount, type HowToResult } from '@/lib/howTo'
import { CLAIM_WORDS, type ClaimKind } from '@/lib/topicClaim'

type Tab = 'ask' | 'conversations' | 'checklists'

/**
 * THE STAGES OF A QUESTION SENT WITH A FILE — Workspace Task 4, board 3. Each is shown while it is
 * TRUE, driven by the request it names, never by a timer:
 *   save   the storage upload and POST /api/documents
 *   read   POST /api/document-scan, awaited
 *   check  POST /api/chat, until the first answer text arrives
 *   write  while that text streams
 */
type Step = 'save' | 'read' | 'check' | 'write'

/** A file the person has chosen and not yet sent — held in page memory only. */
type Staged =
  | { kind: 'new'; file: File; name: string }
  /** Arriving from Documents' "Research this": already saved and read, so nothing to upload. */
  | { kind: 'saved'; id: string; name: string }

/** The file that went with a question, as its card shows it. */
interface Attachment {
  documentId: string | null
  name: string
  kind: string | null
  folder: string | null
  /** True once the scan has read it, or when it was read before (arriving, or a reopened turn). */
  read: boolean
  /** The turn names a document that has since been deleted from Documents (migration 039 keeps the name). */
  deleted?: boolean
}

/** One exchange on screen. `text` grows as the stream arrives. */
interface Exchange {
  id: string
  question: string
  text: string
  sources: AnswerSource[]
  /** What the answer is doing right now, driven by the REAL stream events — never a timer. */
  phase: 'sending' | 'searching' | 'writing' | 'done' | 'stopped' | 'stopped_early' | 'failed'
  searches: number
  error?: string
  /** The file sent with this question, and its card once read — Workspace Task 4. */
  attachment?: Attachment
  /** The stages still to show, and the one that is true now. Gone when the answer finishes. */
  steps?: { list: Step[]; at: Step }
  /** After Stop during the file's stages: what is true about the file, said instead of the usual line. */
  stopNote?: string
  file?: {
    name: string; kind: string; classification: string | null; folder: string | null
    unreadable: boolean; failure?: string
    /** From `document_index_v` after the scan — Run 6. The card says what the list says. */
    title?: string | null; agency?: string | null; status?: string | null; summary?: string | null
  }
}

interface TopicRow {
  id: string; title: string | null; summary: string | null
  summarised_at: string | null; summary_source: string | null
  delete_after: string | null; last_turn_at: string | null; created_at: string
  turnCount: number; checklistId: string | null
  /** From `topic_list_v` (migration 063) — Workspace Task 5, board 5. */
  questionCount: number; documentCount: number; firstDocumentName: string | null
  hasReport: boolean; checklistTotal: number; checklistDone: number
  /** A claim held and younger than ten minutes — migration 065, Workspace Stage 4. */
  summaryInProgress: boolean; checklistInProgress: boolean
}

/** One `topic_list_v` row, as the database returns it. */
interface TopicListRow {
  id: string; title: string | null; summary: string | null
  summarised_at: string | null; summary_source: string | null
  delete_after: string | null; last_turn_at: string | null; created_at: string
  has_report: boolean; turn_count: number; question_count: number; document_count: number
  first_document_name: string | null; checklist_id: string | null; checklist_total: number; checklist_done: number
  summary_in_progress: boolean; checklist_in_progress: boolean
}

const TOPIC_LIST_COLUMNS = 'id, title, summary, summarised_at, summary_source, delete_after, last_turn_at, created_at, '
  + 'has_report, turn_count, question_count, document_count, first_document_name, checklist_id, checklist_total, checklist_done, '
  + 'summary_in_progress, checklist_in_progress'

const toTopicRow = (r: TopicListRow): TopicRow => ({
  id: r.id, title: r.title, summary: r.summary, summarised_at: r.summarised_at, summary_source: r.summary_source,
  delete_after: r.delete_after, last_turn_at: r.last_turn_at, created_at: r.created_at,
  turnCount: Number(r.turn_count ?? 0), checklistId: r.checklist_id,
  questionCount: Number(r.question_count ?? 0), documentCount: Number(r.document_count ?? 0),
  firstDocumentName: r.first_document_name, hasReport: !!r.has_report,
  checklistTotal: Number(r.checklist_total ?? 0), checklistDone: Number(r.checklist_done ?? 0),
  summaryInProgress: !!r.summary_in_progress, checklistInProgress: !!r.checklist_in_progress,
})

interface ChecklistRow {
  id: string; title: string | null; created_at: string
  total: number; done: number; fromConversation: number; added: number
  /** Must do only — the drawer's progress and the tab's count (Workspace Task 6, board 8). */
  mustTotal: number; mustDone: number
}

/** One row of `checklist_list_v` (migration 064): the Checklists tab in one read. */
interface ChecklistListRow {
  id: string; title: string | null; created_at: string
  total: number; done: number; must_total: number; must_done: number
  from_conversation: number; added: number
}
const CHECKLIST_LIST_COLUMNS = 'id, title, created_at, total, done, must_total, must_done, from_conversation, added'

interface ItemRow {
  id: string; name: string; description: string | null; why: string | null
  source_url: string | null; source_title: string | null
  origin: string | null; completed: boolean; category: string; sort_order: number
  parent_item_index: number | null
  /** Task 6: every source the citation check let stand; "How do I do this?" and its claim. */
  sources: unknown; howto: HowToResult | null; howto_started_at: string | null
}
const ITEM_COLUMNS = 'id, name, description, why, source_url, source_title, origin, completed, category, sort_order, '
  + 'parent_item_index, sources, howto, howto_started_at'

/**
 * HOW MANY CONVERSATIONS AND CHECKLISTS ONE LOAD READS — Task 2b. It was the literal 60 in two
 * places. One name, used by both reads and by the counts line, which says "60+" when a list holds
 * exactly this many: a full read means there may be more, and a bare "60" would be a count we do
 * not have.
 */
const LIST_CAP = 60
/** "47", or "60+" for a read that came back full. The one rule, for the counts line and the tab. */
const countOf = (n: number) => (n >= LIST_CAP ? `${LIST_CAP}+` : String(n))
/** "1 conversation", "47 conversations", "60+ conversations". */
const countWord = (n: number, word: string) =>
  `${countOf(n)} ${word}${n === 1 ? '' : 's'}`

/*
 * THE BUTTONS, COPIED FROM AUDITS CHARACTER FOR CHARACTER — Workspace layout, Task 2.
 * The owner's decision: where `DESIGN.md` and Audits disagree, Audits wins, so these are its strings
 * rather than a fourth reading of §4. Copied, not imported, because Audits keeps them page-local too.
 */
/** `app/audits/page.tsx:155–157`, ACTION_PRIMARY. */
const PRIMARY =
  'cursor-pointer rounded-md bg-[var(--green)] px-4 py-2 text-[14px] font-medium text-white ' +
  'hover:bg-[var(--green-ink)] disabled:cursor-not-allowed disabled:opacity-50'
/** PRIMARY's box, outlined. Used ONLY beside PRIMARY on the first visit, so the pair is one size. */
const SECONDARY_LARGE =
  'cursor-pointer rounded-md border border-[var(--green)] px-4 py-2 text-[14px] font-medium text-[var(--green)] ' +
  'hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50'
/** `components/AuditReport.tsx:651`, the footer's "Audit again". */
const OUTLINE =
  'rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50 disabled:opacity-50'
/** `components/AuditReport.tsx:655`, the footer's text actions. */
const TEXT_ACTION = 'text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300'

/**
 * A CONVERSATION'S TITLE, AS SHOWN — Workspace Task 3. Titles are stored as typed (the first
 * question, verbatim — `lib/conversation.ts` `titleFromQuestion`), so many start lowercase. This
 * upper-cases the FIRST character only when it is a lowercase letter and leaves every other
 * character exactly as it is. Display only: the stored title and every other section (To-confirm
 * shows the same titles) are untouched. A title starting with a quote, a digit or anything else
 * that is not a lowercase letter — "'m opening…" — is left alone; null stays null so each caller's
 * fallback still applies.
 */
const displayTitle = (title: string | null): string | null =>
  title && /^\p{Ll}/u.test(title) ? title.charAt(0).toUpperCase() + title.slice(1) : title

/**
 * THE CONVERSATIONS LIST'S DATES — Workspace Task 5, board 5. A row says WHEN in the shortest way that
 * is still exact for its age, and rows are grouped Today, This week, then by month.
 * "This week" is the six days before today; older is a month heading.
 */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const daysAgo = (iso: string, now: Date) => Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)

/** "Today", "This week", or "September 2026". */
function listGroup(iso: string, now: Date = new Date()): string {
  const days = daysAgo(iso, now)
  if (days <= 0) return 'Today'
  if (days <= 6) return 'This week'
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** "3:42 pm" today; "Wed 30 Sep" this week; "18 Sep 2025" before that. */
function listWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const days = daysAgo(iso, now)
  if (days <= 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  if (days <= 6) return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** What the conversation's summary is, in the words the row uses. */
function summaryWords(t: { summarised_at: string | null; turnCount: number }): string {
  if (!t.summarised_at) return 'Not summarised yet'
  return t.turnCount > 0 ? 'Summary ready' : 'Summary only — the full conversation was cleared'
}

/** How Audits writes a date — `app/audits/page.tsx:189–194`, copied: "30 September 2026". */
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso))
  return Number.isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CompliancePage() {
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('ask')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  /**
   * THE FILE CHOSEN AND NOT YET SENT — Workspace Task 4, board 2.
   *
   * Choosing a file only STAGES it, here, in page memory: nothing is uploaded, no `documents` row
   * is written and nothing is read until the question is sent. It used to be uploaded and scanned
   * the moment it was picked (`onFilePicked`, `docs/WORKSPACE-MACHINERY.md` 4b), so a file chosen
   * by mistake was already in Documents, already paid for, and its facts already in the queue. One
   * file at a time; choosing another replaces it. A staged file does not start the conversation, so
   * the first visit keeps "Make a checklist" and "Research this" (machinery N4).
   */
  const [staged, setStaged] = useState<Staged | null>(null)

  /**
   * ARRIVING FROM A GAP — Documents Run 5, and this is the whole change to this page.
   *
   * "Research this" on a gap in the report drawer opens the workspace with the gap as the
   * question and the document attached, because retyping the gap and re-finding the file is the
   * work the link exists to save.
   *
   * Two URL parameters, read once on load: `?ask=` fills the composer, `?document=` stages the
   * document by id as a chip (Task 4). It is already saved and read, so sending it shows only the
   * last two stages; nothing is uploaded again.
   *
   * `window.location.search` rather than `useSearchParams()` deliberately: the hook would need
   * this page wrapped in a Suspense boundary it does not have, and restructuring the workspace's
   * top level is not this run's to do. The layout chat owns this file.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ask = params.get('ask')
    const documentId = params.get('document')
    if (!ask && !documentId) return
    if (ask) setBox(ask)
    if (documentId) {
      (async () => {
        const res = await fetch('/api/documents/index', { headers: await authHeaders() })
        if (!res.ok) return
        const json = await res.json()
        const row = (json.documents ?? []).find((d: { document_id: string }) => d.document_id === documentId)
        if (row) setStaged({ kind: 'saved', id: documentId, name: row.file_name ?? row.title })
      })()
    }
    // The parameters are consumed: a reload should not re-fill a composer somebody has cleared.
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // ---- the conversation on screen ----
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [topicId, setTopicId] = useState('')
  const [box, setBox] = useState('')
  const inFlight = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  /** The composer, so a click with an empty box puts the cursor there rather than doing nothing. */
  const composerRef = useRef<HTMLTextAreaElement>(null)

  // ---- lists ----
  const [topics, setTopics] = useState<TopicRow[]>([])
  /**
   * SEARCH — Workspace Task 5, board 5. Shown once there are more than 20 conversations. It filters,
   * as you type, by title and summary text — *** OVER THE CONVERSATIONS ALREADY LOADED ONLY, at most
   * `LIST_CAP` (60). *** It does not query the database, so an older conversation beyond the 60 is
   * not found by it.
   */
  const [search, setSearch] = useState('')
  const [checklists, setChecklists] = useState<ChecklistRow[]>([])

  // ---- drawers and sheets ----
  const [summaryDrawer, setSummaryDrawer] = useState<TopicRow | null>(null)
  const [listDrawer, setListDrawer] = useState<{ row: ChecklistRow; items: ItemRow[]; ordered: boolean } | null>(null)
  const [scopeFor, setScopeFor] = useState<string | null>(null)
  /**
   * THE DOCUMENTS REPORT, OPENED FROM A FILE CARD — Workspace Task 4, board 4. The same component
   * `/documents` opens (`app/documents/page.tsx`, the `<DocumentReport` mount), handed the same
   * props; nothing inside it changed. It needs the company's folder list for its filing control,
   * which this page does not otherwise hold, so it is read when the report opens.
   */
  const [reportDoc, setReportDoc] = useState<string | null>(null)
  const [reportFolders, setReportFolders] = useState<Array<{ id: string; name: string }>>([])
  /**
   * WHAT IS BEING DELETED, IN THE PAGE'S OWN CONFIRMATION — Workspace Task 3, board 7. It was the
   * browser's `confirm()`, a pop-up that offered no way to keep a copy first; the owner rejected it.
   * `deleteBusy` disables "Delete for good" while the request runs; `deleteFailed` keeps the sheet
   * open with one plain line instead of closing on a failure nobody would then see.
   */
  const [deleting, setDeleting] = useState<
    { kind: 'conversation'; topic: TopicRow } | { kind: 'checklist'; id: string } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  /**
   * THIS TAB'S OWN PRESSES OF SUMMARISE AND TURN INTO A CHECKLIST — Workspace Stage 4. Keyed
   * `${kind}:${topicId}`, holding what the conversation showed BEFORE the press (its `summarised_at`, or
   * its newest checklist), so when the claim clears the page can tell a result that landed from a run
   * that failed. Set the moment the button is pressed, so the button is disabled before any request
   * leaves. Everyone else's runs — a reload, another tab — are read from `topic_list_v`'s two flags.
   */
  const [waits, setWaits] = useState<Record<string, { kind: ClaimKind; topicId: string; before: string | null }>>({})
  const waitsRef = useRef(waits)
  useEffect(() => { waitsRef.current = waits }, [waits])

  const fileInput = useRef<HTMLInputElement>(null)

  /**
   * "HOW DO I DO THIS?" — Workspace Task 6, board 9. `howToBusy` is this tab's own click; the item's
   * `howto_started_at`, read from the database, is everyone's (a reload, a second tab). Either shows
   * the spinner. `howToError` holds the route's plain sentence for an item whose run failed.
   *
   * The machine-written micro-steps are gone: never generated, never shown. The rows already stored
   * (`parent_item_index` set) stay in the database untouched; the drawer simply does not read them.
   */
  const [howToBusy, setHowToBusy] = useState<Record<string, boolean>>({})
  const [howToError, setHowToError] = useState<Record<string, string>>({})
  /**
   * The clock the "researching" test reads, kept in state so rendering stays pure. It only has to be
   * good to the minute: it decides whether a claim is older than `HOWTO_LOCK_MS` (10 minutes).
   */
  const [clock, setClock] = useState(0)
  useEffect(() => {
    const tick = () => setClock(Date.now())
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 30_000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [])

  const started = exchanges.length > 0

  /**
   * THE COMPOSER GROWS WITH WHAT YOU TYPE.
   *
   * Two problems that looked like one. `rows={1}` with `max-h-36` and nothing resizing it meant
   * that past two lines the box scrolled and **the beginning of your own question went out of
   * sight**. And the three examples vanish the moment there is text, so the box collapsed from
   * about 130px to a single line — it shrank exactly when you were giving it more.
   *
   * `min-h-[92px]` holds the floor at roughly the height the examples give it, so typing grows
   * the box from there instead of dropping it to one line first. `max-h-36` is kept: past that
   * it scrolls, which is right — a composer must not eat the page — but by then you have seen
   * what you wrote.
   *
   * *** KEYED ON `box`, NOT ON KEYSTROKES. *** Clicking an example sets the state directly and
   * fires no `onChange`, so an onChange-only handler would leave the box the wrong size for the
   * text now in it. A layout effect runs before paint, so the box is never briefly wrong.
   *
   * `height = 'auto'` first is what makes it shrink as well as grow: `scrollHeight` of an
   * element already stretched to fit its content is that stretched height, so without the reset
   * the box would ratchet upwards and never come back down after a delete.
   */
  useLayoutEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [box])

  // ------------------------------------------------------------------ loading
  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from('profiles').select('company_id').maybeSingle()
      if (prof?.company_id) {
        setCompanyId(prof.company_id as string)
        // The printed header names the company. An id on a page handed to an inspector is worth
        // nothing; if the name cannot be read the header simply omits that line (Fix Round 1 E).
        const { data: co } = await supabase
          .from('companies').select('name').eq('id', prof.company_id as string).maybeSingle()
        if (co?.name) setCompanyName(co.name as string)
      }
    })()
  }, [supabase])

  /**
   * THE CONVERSATIONS LIST IN ONE READ — Workspace Task 5, board 5. It was 1 + 2N reads: a turn count
   * and a checklist per topic (`docs/WORKSPACE-MACHINERY.md` 2a). `topic_list_v` (migration 063)
   * computes every row's counts in the database, as the caller, so the list is ONE round trip
   * whatever N is. Turn counts still decide "cleared" vs "kept"; the date only says when it may go.
   * Newest activity first; a topic with no turns falls back to when it was opened.
   */
  const loadTopics = useCallback(async () => {
    const { data } = await supabase
      .from('topic_list_v')
      .select(TOPIC_LIST_COLUMNS)
      .order('last_turn_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(LIST_CAP)
    setTopics(((data ?? []) as unknown as TopicListRow[]).map(toTopicRow))
  }, [supabase])

  /**
   * THE CHECKLISTS TAB IN ONE READ — Workspace Task 6, B3. It was 1 + N: the checklists, then each
   * one's items (`docs/HANDOFF-CODE.md` §7). `checklist_list_v` (migration 064) counts top-level items
   * and must-dos in the database, as the caller, under every base-table policy.
   */
  const loadChecklists = useCallback(async () => {
    const { data, error } = await supabase
      .from('checklist_list_v').select(CHECKLIST_LIST_COLUMNS)
      .order('created_at', { ascending: false }).limit(LIST_CAP)
    if (error) { setNotice('Your checklists could not be loaded. Please reload the page.'); return }
    setChecklists(((data ?? []) as unknown as ChecklistListRow[]).map((c) => ({
      id: c.id, title: c.title, created_at: c.created_at, total: c.total, done: c.done,
      mustTotal: c.must_total, mustDone: c.must_done, fromConversation: c.from_conversation, added: c.added,
    })))
  }, [supabase])

  useEffect(() => {
    if (companyId) { loadTopics(); loadChecklists() }
  }, [companyId, loadTopics, loadChecklists])

  /**
   * THE FACTS LINE IN THE SUMMARY DRAWER — Workspace Task 3, board 6.
   *
   * How many facts read out of THIS conversation are still waiting for a person. Counted, not
   * shown: the facts themselves are confirmed in Company information, which is where the line
   * links. Read as the caller under RLS, like every other row on this page; `fact_proposals` grants
   * `authenticated` SELECT (migration 034). Null while unknown, so nothing flashes "0".
   */
  const [drawerFacts, setDrawerFacts] = useState<number | null>(null)
  const drawerTopicId = summaryDrawer?.id ?? null
  useEffect(() => {
    setDrawerFacts(null)
    if (!drawerTopicId) return
    let live = true
    ;(async () => {
      const { count } = await supabase.from('fact_proposals')
        .select('id', { count: 'exact', head: true })
        .eq('topic_id', drawerTopicId).eq('status', 'proposed')
      if (live) setDrawerFacts(count ?? 0)
    })()
    return () => { live = false }
  }, [drawerTopicId, supabase])

  /**
   * THE SUMMARY REPORT, FOR THE OPEN DRAWER — Workspace Task 5, board 6. Read when the drawer opens,
   * as the caller under RLS, so the list never carries every report. Null while unknown or absent: a
   * conversation summarised before migration 063 has text only, and the drawer shows that as before.
   */
  const [drawerReport, setDrawerReport] = useState<SummaryReport | null>(null)
  const drawerSummarisedAt = summaryDrawer?.summarised_at ?? null
  useEffect(() => {
    setDrawerReport(null)
    if (!drawerTopicId || !drawerSummarisedAt) return
    let live = true
    ;(async () => {
      const { data } = await supabase.from('topics').select('summary_report').eq('id', drawerTopicId).maybeSingle()
      if (live) setDrawerReport(((data as { summary_report?: SummaryReport | null } | null)?.summary_report) ?? null)
    })()
    return () => { live = false }
  }, [drawerTopicId, drawerSummarisedAt, supabase])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [exchanges.length])

  // ------------------------------------------------------------------ asking
  const patch = (id: string, p: Partial<Exchange>) =>
    setExchanges((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)))

  /** Copy the document's current kind and folder onto the cards that show it — one read for all. */
  async function cardInfo(ids: string[]): Promise<Record<string, { kind: string | null; folder: string | null; title: string | null }>> {
    if (!ids.length) return {}
    const { data } = await supabase.from('document_index_v')
      .select('document_id, kind, folder_name, title').in('document_id', ids)
    return Object.fromEntries(((data ?? []) as Array<{ document_id: string; kind: string | null; folder_name: string | null; title: string | null }>)
      .map((r) => [r.document_id, { kind: r.kind, folder: r.folder_name, title: r.title }]))
  }

  /**
   * STEP 1 — SAVE. Storage, then the `documents` row, exactly as the old attach did (it moved here
   * from the picker). `from_topic_id` is the open conversation or null, as before; the chat route
   * back-fills it when the turn is saved (`app/api/chat/route.ts`, the `attached` back-fill).
   */
  async function saveFile(file: File): Promise<{ id: string } | { failure: string }> {
    if (!companyId) return { failure: 'We could not tell which company you are signed in to, so the file was not saved. Reload the page and try again.' }
    const path = `${companyId}/compliance/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file)
    if (upErr) return { failure: `We could not upload ${file.name} — the transfer did not complete on our side.` }
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: file.name, file_url: path, file_type: file.type, file_size: file.size, from_topic_id: topicId || null }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok || !j?.id) return { failure: `${file.name} reached us but could not be saved to your documents.` }
    return { id: String(j.id) }
  }

  /**
   * STEP 2 — READ. `/api/document-scan`, awaited. *** NO ABORT SIGNAL IS PASSED, ON PURPOSE. ***
   * The route reads nothing of the request's signal (`app/api/document-scan/route.ts`) and neither
   * does the scan (`lib/documentScan.ts`, the `askAIWithCitations` call), and §138 records what an
   * abandoned scan request did on production: the reading was lost and the document could be left
   * "Reading…". So Stop does not cut this request; the page stops WAITING for it, and says so.
   */
  async function readFile(documentId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      const res = await fetch('/api/document-scan', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ document_id: documentId }),
      })
      const scan = await res.json().catch(() => null)
      if (res.ok && scan?.status !== 'could_not_read') return { ok: true }
      const said = scan?.could_not_read
      return {
        ok: false,
        reason: said?.reason
          ? `It is saved to Documents, but ${said.reason.charAt(0).toLowerCase()}${said.reason.slice(1)}${said.way_forward ? ` ${said.way_forward}` : ''}`
          : 'It is saved to Documents, but we could not read it well enough to rely on. A photo taken square-on in good light would do it, or the original PDF if you have one.',
      }
    } catch {
      return { ok: false, reason: 'It is saved to Documents, but we could not read it just now. Try again in a moment.' }
    }
  }

  async function ask(question: string, mode: 'research' | 'checklist') {
    const q = question.trim()
    if (!q || busy) return
    const file = staged
    setBox('')
    setNotice(null)
    const id = `x${Date.now()}`
    // The stages this question will really go through. A file already in Documents skips the first
    // two; the checklist path answers in one piece, so it has no "writing" stage.
    const tail: Step[] = mode === 'research' ? ['check', 'write'] : ['check']
    const list: Step[] = !file ? [] : file.kind === 'new' ? ['save', 'read', ...tail] : tail
    setExchanges((prev) => [...prev, {
      id, question: q, text: '', sources: [], phase: 'sending', searches: 0,
      attachment: file ? { documentId: file.kind === 'saved' ? file.id : null, name: file.name, kind: null, folder: null, read: file.kind === 'saved' } : undefined,
      steps: list.length ? { list, at: list[0] } : undefined,
    }])
    // The file now belongs to this question, whatever happens to it.
    setStaged(null)
    setBusy(true)
    const controller = new AbortController()
    inFlight.current = controller
    const at = (step: Step) => patch(id, { steps: { list, at: step } })
    let documentId: string | null = file?.kind === 'saved' ? file.id : null
    let read = file?.kind === 'saved'

    try {
      if (file?.kind === 'new') {
        // ---- 1. SAVE. Stop is honoured only once the save has finished: a half-made upload with
        // no `documents` row would be a stored file nobody can see.
        const saved = await saveFile(file.file)
        if ('failure' in saved) {
          patch(id, { phase: 'failed', steps: undefined, error: saved.failure })
          // Nothing was asked. The question and the file go back, so trying again is one click.
          setBox(q); setStaged(file)
          return
        }
        documentId = saved.id
        patch(id, { attachment: { documentId, name: file.name, kind: null, folder: null, read: false } })
        if (controller.signal.aborted) {
          patch(id, { phase: 'stopped', steps: undefined,
            stopNote: 'Stopped. The file is saved in Documents but was not read. Your question was not sent.' })
          return
        }

        // ---- 2. READ.
        at('read')
        const STOPPED = Symbol('stopped')
        const whenStopped = new Promise<typeof STOPPED>((resolve) =>
          controller.signal.addEventListener('abort', () => resolve(STOPPED), { once: true }))
        const outcome = await Promise.race([readFile(documentId), whenStopped])
        if (outcome === STOPPED) {
          patch(id, { phase: 'stopped', steps: undefined,
            stopNote: 'Stopped. Your question was not sent. The file is saved in Documents and is still being read there.' })
          return
        }
        if (!outcome.ok) {
          // *** IT STOPS BEFORE ASKING. *** A question about a file nobody could read would get an
          // answer about nothing. The card says why, in the scan's own words; the question goes back
          // in the box; the file is not staged again — a clearer copy is the way on.
          setExchanges((prev) => prev.map((x) => (x.id === id ? {
            id, question: '', text: '', sources: [], phase: 'done' as const, searches: 0,
            file: { name: file.name, kind: (file.name.split('.').pop() ?? 'file').toUpperCase(),
              classification: null, folder: null, unreadable: true, failure: outcome.reason },
          } : x)))
          setBox(q)
          return
        }
        read = true
      }

      if (documentId) {
        const info = (await cardInfo([documentId]))[documentId]
        patch(id, { attachment: { documentId, name: file!.name, kind: info?.kind ?? null, folder: info?.folder ?? null, read } })
      }

      // ---- 3. CHECK, then 4. WRITE.
      if (list.length) at('check')
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        signal: controller.signal,
        body: JSON.stringify({
          question: q, mode, topicId,
          // Each earlier answer carries the sources its `[n]` markers point at. Without them a
          // later turn reads its own markers as references to nothing and says the sources were
          // never retrieved — which is false, and the summariser then archives the claim (§127).
          history: exchanges.filter((x) => x.phase === 'done' && x.text && !x.file)
            .map((x) => ({ question: x.question, answer: x.text, sources: x.sources })),
          // The attachment travels with the question it belongs to (§129), exactly as before: the
          // route stores `document_id` and `document_name` on the turn (migration 039) and reads
          // the file from storage itself.
          documentId,
        }),
      })

      // The checklist path answers with one JSON body, not a stream.
      if (!(res.headers.get('content-type') ?? '').includes('x-ndjson')) {
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          patch(id, { phase: 'failed', steps: undefined, error: json?.error ?? 'That request could not be completed.' })
          return
        }
        if (json?.topicId) setTopicId(String(json.topicId))
        patch(id, { phase: 'done', steps: undefined, text: `**${json?.title ?? 'Checklist'}** — saved to your checklists.` })
        await loadChecklists()
        return
      }

      // THE STREAM IS READ THROUGH `lib/answerStream.ts`, WHICH KNOWS THE DIFFERENCE BETWEEN
      // A STREAM THAT ENDED AND A STREAM THAT FINISHED. The old loop here marked anything that
      // did not throw as `done`, which is how the 22 Sep hazmat answer showed four lines ending
      // mid-sentence with no message at all (`DECISIONS.md` §127).
      const outcome = await readAnswerStream(
        ndjsonLines(res.body!.getReader()),
        (p) => patch(id, { text: p.text, searches: p.searches, phase: p.phase,
          ...(list.length && p.text ? { steps: { list, at: 'write' as Step } } : {}) }),
        () => controller.signal.aborted,
      )
      if (outcome.kind === 'done') {
        patch(id, { text: outcome.text, sources: outcome.sources, phase: 'done', steps: undefined })
        if (outcome.topicId) setTopicId(outcome.topicId)
      } else if (outcome.kind === 'stopped_by_user') {
        patch(id, { text: outcome.text, phase: 'stopped', steps: undefined })
      } else if (outcome.kind === 'stopped_early') {
        patch(id, { text: outcome.text, phase: 'stopped_early', steps: undefined })
      } else {
        patch(id, { text: outcome.text, phase: 'failed', steps: undefined, error: outcome.message })
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        // The person stopped it. Keep what arrived; say nothing that sounds like a fault.
        setExchanges((prev) => prev.map((x) => (x.id === id ? { ...x, phase: 'stopped', steps: undefined } : x)))
      } else {
        patch(id, { phase: 'failed', steps: undefined, error: 'The answer could not be completed.' })
      }
    } finally {
      inFlight.current = null
      setBusy(false)
      loadTopics()
    }
  }

  function stop() {
    inFlight.current?.abort()
    inFlight.current = null
  }

  function newConversation() {
    stop()
    setExchanges([])
    setTopicId('')
    setBox('')
    setNotice(null)
    setTab('ask')
  }

  /** A tab change is a change of context: a notice about the last thing done does not follow you. */
  function switchTab(next: Tab) {
    setTab(next)
    setNotice(null)
  }

  // ------------------------------------------------------------------ files
  /**
   * CHOOSING A FILE STAGES IT — Workspace Task 4, board 2. That is all: no upload, no row, no
   * reading. `ask()` does those, in order and on screen, when the question is sent. The old
   * `onFilePicked` uploaded and scanned at the moment of picking (`docs/WORKSPACE-MACHINERY.md` 4b).
   */
  function stageFile(file: File) {
    setStaged({ kind: 'new', file, name: file.name })
    composerRef.current?.focus()
  }

  // ------------------------------------------------------------------ convert / summarise
  /**
   * "TURN THIS INTO A CHECKLIST" AND "SUMMARISE THIS CONVERSATION" — ONE PRESS, ONE CALL (Workspace
   * Stage 4). The route claims the conversation and answers at once (202); the work runs on the server
   * whether or not this tab stays open. A 409 means a run is already going — this tab waits for it, it
   * is not an error. The poll below fills in the result when the claim clears.
   */
  async function startClaimed(kind: ClaimKind, t: string, send: () => Promise<Response>, failed: string) {
    const key = `${kind}:${t}`
    if (waitsRef.current[key]) return
    // What the conversation shows now, read fresh: the comparison when the claim clears is against this.
    const { data: now } = await supabase.from('topic_list_v').select('summarised_at, checklist_id').eq('id', t).maybeSingle()
    const before = ((kind === 'summary' ? now?.summarised_at : now?.checklist_id) ?? null) as string | null
    const next = { ...waitsRef.current, [key]: { kind, topicId: t, before } }
    waitsRef.current = next
    setWaits(next)
    let res: Response | null = null
    try { res = await send() } catch { res = null }
    const j = res ? await res.json().catch(() => null) : null
    // 202 started; 409 WITH the claim's status is a run already going. Any other 409 is a refusal with
    // its own sentence (a conversation with no messages), and is shown.
    if (res && (res.status === 202 || (res.status === 409 && (j?.status === 'writing' || j?.status === 'building')))) {
      await loadTopics(); return
    }
    setNotice(j?.error ?? failed)
    dropWait(key)
  }
  function dropWait(key: string) {
    const next = { ...waitsRef.current }
    delete next[key]
    waitsRef.current = next
    setWaits(next)
  }
  const CHECKLIST_FAILED = 'That conversation could not be turned into a checklist. Please try again.'
  const SUMMARY_FAILED = 'That conversation could not be summarised just now. Nothing was changed. Please try again.'

  async function convert(scope: 'discussed' | 'complete') {
    const t = scopeFor
    setScopeFor(null)
    if (!t) return
    await startClaimed('checklist', t, async () => fetch('/api/checklists/from-topic', {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ topicId: t, scope }),
    }), CHECKLIST_FAILED)
  }

  async function summarise(t: string) {
    if (!t) { setNotice('There is no conversation to summarise yet. Ask a question first.'); return }
    await startClaimed('summary', t, async () => fetch(`/api/topics/${t}/summarise`, {
      method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
    }), SUMMARY_FAILED)
  }

  /** Whether a run of this kind is going on this conversation — this tab's own, or anyone's. */
  const inProgress = (t: TopicRow | string | null | undefined, kind: ClaimKind): boolean => {
    if (!t) return false
    const id = typeof t === 'string' ? t : t.id
    if (waits[`${kind}:${id}`]) return true
    const row = typeof t === 'string' ? topics.find((x) => x.id === t) : t
    return !!row && (kind === 'summary' ? row.summaryInProgress : row.checklistInProgress)
  }

  /**
   * THE POLL — every 5 seconds while any conversation on the page has a run going, as "How do I do
   * this?" waits on its item. Reads only `topic_list_v` for those conversations; no call is made. When a
   * claim clears: this tab's own summary opens in the drawer and its own checklist opens, as before
   * Stage 4; a claim that cleared with nothing new is a run that failed, and is said so plainly.
   */
  const watching = [...new Set([
    ...topics.filter((t) => t.summaryInProgress || t.checklistInProgress).map((t) => t.id),
    ...Object.values(waits).map((w) => w.topicId),
  ])].sort().join(',')
  useEffect(() => {
    if (!watching) return
    const ids = watching.split(',')
    const t = setInterval(async () => {
      const { data, error } = await supabase.from('topic_list_v').select(TOPIC_LIST_COLUMNS).in('id', ids)
      if (error || !data) return
      const fresh = new Map(((data as unknown as TopicListRow[]).map(toTopicRow)).map((r) => [r.id, r]))
      setTopics((rows) => rows.map((r) => fresh.get(r.id) ?? r))
      setSummaryDrawer((d) => (d && fresh.has(d.id) ? fresh.get(d.id)! : d))
      for (const [key, w] of Object.entries(waitsRef.current)) {
        const row = fresh.get(w.topicId)
        if (!row) continue
        if (w.kind === 'summary' && !row.summaryInProgress) {
          dropWait(key)
          if (row.summarised_at && row.summarised_at !== w.before) setSummaryDrawer(row)
          else setNotice(SUMMARY_FAILED)
        }
        if (w.kind === 'checklist' && !row.checklistInProgress) {
          dropWait(key)
          if (row.checklistId && row.checklistId !== w.before) { await loadChecklists(); await openChecklist(row.checklistId) }
          else setNotice(CHECKLIST_FAILED)
        }
      }
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, supabase])

  // ------------------------------------------------------------------ conversations
  async function openConversation(t: TopicRow) {
    setNotice(null)
    setWorking('Opening…')
    try {
      const res = await fetch(`/api/topics/${t.id}`, { headers: await authHeaders() })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'That conversation could not be opened. Please try again.'); return }
      const turns = (j.turns ?? []) as Array<{ role: string; text: string; sources: AnswerSource[] | null; stopped: boolean
        document_id: string | null; document_name: string | null }>
      // THE CONVERSATION'S FILES COME BACK WITH IT — Workspace Task 4 (machinery N5). The turn
      // stores the document's id and a copy of its name (migration 039); the card's kind and folder
      // are read for every document of the conversation in ONE query, not one per turn. A turn whose
      // id is gone (deleting a document sets it null) but whose name is kept is a deleted file.
      const info = await cardInfo([...new Set(turns.map((t) => t.document_id).filter((d): d is string => !!d))])
      const rebuilt: Exchange[] = []
      for (let i = 0; i < turns.length; i++) {
        if (turns[i].role !== 'user') continue
        const answer = turns[i + 1]?.role === 'assistant' ? turns[i + 1] : null
        const docId = turns[i].document_id
        const docName = turns[i].document_name
        rebuilt.push({
          id: `r${i}`, question: turns[i].text,
          text: answer?.text ?? '', sources: answer?.sources ?? [],
          phase: turns[i].stopped ? 'stopped' : 'done', searches: 0,
          attachment: docName ? {
            documentId: docId, name: docName, read: !!docId, deleted: !docId,
            kind: docId ? info[docId]?.kind ?? null : null, folder: docId ? info[docId]?.folder ?? null : null,
          } : undefined,
        })
      }
      setExchanges(rebuilt)
      setTopicId(t.id)
      setSummaryDrawer(null)
      setTab('ask')
    } finally { setWorking(null) }
  }

  useEffect(() => {
    if (!reportDoc) return
    let live = true
    ;(async () => {
      const res = await fetch('/api/documents/index', { headers: await authHeaders() })
      const j = res.ok ? await res.json().catch(() => null) : null
      if (live) setReportFolders((j?.folders ?? []) as Array<{ id: string; name: string }>)
    })()
    return () => { live = false }
  }, [reportDoc])

  /** "Move to…" inside the report — the same request `/documents`' `moveTo` makes. */
  async function moveDocument(documentId: string, folderId: string | null) {
    await fetch('/api/documents', {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: documentId, folder_id: folderId }),
    })
  }

  /** Opens the confirmation. Nothing is deleted until "Delete for good". */
  function askToDelete(what: { kind: 'conversation'; topic: TopicRow } | { kind: 'checklist'; id: string }) {
    setDeleteFailed(false)
    setDeleting(what)
  }

  function cancelDelete() {
    if (deleteBusy) return
    setDeleting(null)
    setDeleteFailed(false)
  }

  /** Returns whether the conversation is gone. A refusal or a request that never landed is false. */
  async function deleteConversation(t: TopicRow): Promise<boolean> {
    try {
      const res = await fetch(`/api/topics/${t.id}`, { method: 'DELETE', headers: await authHeaders() })
      if (!res.ok) return false
    } catch { return false }
    if (topicId === t.id) { setExchanges([]); setTopicId('') }
    setSummaryDrawer(null)
    await loadTopics()
    return true
  }

  // ------------------------------------------------------------------ checklists
  async function openChecklist(id: string) {
    const { data: row } = await supabase.from('checklists').select('id, title, created_at, document_id').eq('id', id).maybeSingle()
    if (!row) { setNotice('That checklist could not be opened. Please try again.'); return }
    // Top-level items only. The old micro-steps (`parent_item_index` set) are not read or shown.
    const { data: items, error } = await supabase
      .from('checklist_items').select(ITEM_COLUMNS)
      .eq('checklist_id', id).is('parent_item_index', null).order('sort_order')
    if (error) { setNotice('That checklist could not be opened. Please try again.'); return }
    const parents = (items ?? []) as unknown as ItemRow[]
    const r = row as unknown as { id: string; title: string | null; created_at: string; document_id: string | null }
    setHowToError({})
    // Numbered "in the order to do them" only when the workspace made it (`madeInWorkspace`).
    setListDrawer({ row: rowFor(r, parents), items: parents, ordered: madeInWorkspace(r, parents) })
  }

  /** The drawer's counts, from the items it holds. Must do only for the progress (board 8). */
  function rowFor(r: { id: string; title: string | null; created_at: string }, items: ItemRow[]): ChecklistRow {
    const must = items.filter((i) => i.category === 'must_do')
    return {
      id: r.id, title: r.title, created_at: r.created_at,
      total: items.length, done: items.filter((i) => i.completed).length,
      mustTotal: must.length, mustDone: must.filter((i) => i.completed).length,
      fromConversation: items.filter((i) => i.origin === 'conversation').length,
      added: items.filter((i) => i.origin === 'added').length,
    }
  }

  function setDrawerItems(update: (items: ItemRow[]) => ItemRow[]) {
    setListDrawer((d) => {
      if (!d) return d
      const items = update(d.items)
      return { ...d, items, row: rowFor(d.row, items) }
    })
  }

  /**
   * THE TICK CHECKS ITS OWN WRITE NOW (machinery N8). It was awaited and its error dropped, so a
   * refused write left a tick on screen that the database never held. On a failure the tick is taken
   * back and the page says so.
   */
  async function toggleItem(item: ItemRow) {
    if (!listDrawer || !companyId) return
    const next = !item.completed
    setDrawerItems((items) => items.map((i) => (i.id === item.id ? { ...i, completed: next } : i)))
    // `.eq('company_id')` beside `.eq('id')` — RLS already restricts this, and the second
    // filter is what keeps that true if a policy is ever loosened.
    let failed = false
    try {
      const { data, error } = await supabase.from('checklist_items')
        .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
        .eq('id', item.id).eq('company_id', companyId).select('id')
      // Under RLS a refused update changes zero rows rather than erroring; both are a failure.
      failed = !!error || !data?.length
    } catch { failed = true }
    if (failed) {
      setDrawerItems((items) => items.map((i) => (i.id === item.id ? { ...i, completed: !next } : i)))
      setNotice(`"${item.name}" could not be marked ${next ? 'done' : 'not done'}. Nothing was changed. Please try again.`)
      return
    }
    loadChecklists()
  }

  /**
   * "HOW DO I DO THIS?" — ONE CLICK, ONE CALL (`app/api/checklist-items/[id]/how-to/route.ts`).
   * The route claims the item in the database before it calls anything; a 409 means another click or
   * tab holds it, and this one waits for that result instead of paying for a second.
   */
  async function howTo(item: ItemRow) {
    if (howToBusy[item.id] || (clock > 0 && isResearching(item.howto_started_at, clock))) return
    setHowToBusy((b) => ({ ...b, [item.id]: true }))
    setHowToError((e) => { const n = { ...e }; delete n[item.id]; return n })
    try {
      const res = await fetch(`/api/checklist-items/${item.id}/how-to`, {
        method: 'POST', headers: await authHeaders() })
      const j = await res.json().catch(() => null)
      if (res.ok && j?.howto) {
        setDrawerItems((items) => items.map((i) => (i.id === item.id ? { ...i, howto: j.howto, howto_started_at: null } : i)))
      } else if (j?.status === 'researching') {
        // 202 (this press started it; the work runs on the server after the reply — Stage 4) or 409
        // (another click or tab holds it). Either way the page waits on the claim below.
        setDrawerItems((items) => items.map((i) => (i.id === item.id ? { ...i, howto_started_at: new Date().toISOString() } : i)))
      } else {
        setHowToError((e) => ({ ...e, [item.id]: j?.error ?? 'We could not look this up just now. Nothing was saved. Please try again.' }))
      }
    } catch {
      setHowToError((e) => ({ ...e, [item.id]: 'We could not look this up just now. Nothing was saved. Please try again.' }))
    } finally {
      setHowToBusy((b) => ({ ...b, [item.id]: false }))
    }
  }

  /**
   * WAITING FOR A RUN SOMEBODY ELSE STARTED — a reload, a second tab, or a 409. While an item in the
   * open drawer is marked researching in the database and this tab has no request of its own in
   * flight, re-read just those items every 5 seconds until the claim clears. Reads only; no call.
   */
  const waitingIds = (listDrawer?.items ?? [])
    .filter((i) => !i.howto && !howToBusy[i.id] && clock > 0 && isResearching(i.howto_started_at, clock)).map((i) => i.id).join(',')
  useEffect(() => {
    if (!waitingIds) return
    const ids = waitingIds.split(',')
    const t = setInterval(async () => {
      const { data } = await supabase.from('checklist_items').select('id, howto, howto_started_at').in('id', ids)
      const fresh = new Map(((data ?? []) as Array<{ id: string; howto: HowToResult | null; howto_started_at: string | null }>)
        .map((r) => [r.id, r]))
      setDrawerItems((items) => items.map((i) => {
        const f = fresh.get(i.id)
        return f ? { ...i, howto: f.howto, howto_started_at: f.howto_started_at } : i
      }))
      // A claim that cleared with no result is a run that failed: said, not silently reset (Stage 4 —
      // the research now runs after the reply, so this is where its failure reaches the page).
      for (const f of fresh.values()) {
        if (!f.howto && !f.howto_started_at) {
          setHowToError((e) => ({ ...e, [f.id]: 'We could not look this up just now. Nothing was saved. Please try again.' }))
        }
      }
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingIds, supabase])

  /**
   * Returns whether the checklist is gone. *** BOTH DELETES ARE CHECKED NOW *** (machinery N8):
   * they were awaited and their errors dropped, so a refused delete closed the drawer as though it
   * had worked. Items first; if they cannot go, the checklist is not touched.
   */
  async function deleteChecklist(id: string): Promise<boolean> {
    if (!companyId) return false
    try {
      const { error: iErr } = await supabase.from('checklist_items').delete().eq('checklist_id', id).eq('company_id', companyId)
      if (iErr) return false
      const { error: cErr } = await supabase.from('checklists').delete().eq('id', id).eq('company_id', companyId)
      if (cErr) return false
    } catch { return false }
    setListDrawer(null)
    await loadChecklists()
    return true
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    setDeleteFailed(false)
    const ok = deleting.kind === 'conversation'
      ? await deleteConversation(deleting.topic)
      : await deleteChecklist(deleting.id)
    setDeleteBusy(false)
    if (ok) setDeleting(null)
    else setDeleteFailed(true)
  }

  /**
   * GROUP BY THE DAY, RATHER THAN PRINTING IT ON EVERY ROW.
   *
   * Both lists repeated "Yesterday" down the whole column — a line per row saying the same
   * thing, which is a date you cannot scan and a line you cannot use. The rows keep the order
   * they arrived in; this only buckets consecutive rows that share the label `friendlyDate`
   * already produces, so a list that is not sorted by date still renders truthfully.
   */
  function groupByDay<T>(rows: T[], dateOf: (row: T) => string): Array<{ day: string; rows: T[] }> {
    const out: Array<{ day: string; rows: T[] }> = []
    for (const row of rows) {
      const day = dateOf(row)
      const last = out[out.length - 1]
      if (last && last.day === day) last.rows.push(row)
      else out.push({ day, rows: [row] })
    }
    return out
  }

  // ------------------------------------------------------------------ render
  // THE FACTS LINE — Task 3, unchanged in its words; Task 5 lets the report place it (board 6).
  const factsLine = drawerFacts ? (
    <div className="no-print flex items-center justify-between gap-4 border-y border-gray-200 py-3">
      <p className="text-[14px] text-gray-600">
        {drawerFacts === 1
          ? '1 fact from this conversation is waiting in Company information'
          : `${drawerFacts} facts from this conversation are waiting in Company information`}
      </p>
      <a href="/company-information" className="shrink-0 text-[14px] text-[var(--green-ink)] hover:underline">
        Review →
      </a>
    </div>
  ) : null

  // The list as searched (Task 5). Matching is on title and summary text, over the loaded rows only.
  const q = search.trim().toLowerCase()
  const shownTopics = !q ? topics
    : topics.filter((t) => `${t.title ?? ''}\n${t.summary ?? ''}`.toLowerCase().includes(q))

  // The conversation's actions under the box need an answer to act on, and a topic to act on it.
  const hasAnswer = exchanges.some((x) => x.phase === 'done' && !x.file && !!x.text)
  // "last asked" on the counts line: the most recent activity across the conversations loaded,
  // each one's last turn or, with none, when it was opened.
  const lastAsked = topics.reduce<string | null>((max, t) => {
    const at = t.last_turn_at ?? t.created_at
    return !max || at > max ? at : max
  }, null)

  return (
    <AppLayout>
      {/* THE FILE PICKER, AT PAGE LEVEL, AS ON AUDITS (`app/audits/page.tsx:475–476`) — Task 2b.
          It lived inside an "Attach a file" sheet, so attaching was three clicks: open the sheet,
          press "Choose a file", pick. Now the attach line, the docked paperclip and the file card's
          "Upload a clearer copy" each call `.click()` on this. The handler is unchanged, and it
          already cleared the value after a pick, as Audits' does, so the same file can be chosen
          twice. */}
      <input ref={fileInput} type="file" className="hidden"
        accept={ACCEPTED_FILE_TYPES}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) stageFile(f); e.target.value = '' }} />
      <style jsx global>{`
        .print-only { display: none; }
        .fold-closed { display: none; }
        @media print {
          .no-print { display: none !important; }
          .sources-print a::after { content: " — " attr(href); font-size: 10px; color: #444; word-break: break-all; }

          /* WORKSPACE STAGE 2 — PRINT IS ALWAYS OPEN, AND LINKS ARE READABLE ON PAPER.
           * A folded accordion panel is hidden on screen only; on paper every panel is open,
           * whatever was folded, and the screen is not touched (no state change). A one-line
           * link prints its full title and its full address instead of the cut-down line. */
          .fold-closed { display: block !important; }
          .screen-only { display: none !important; }
          .print-only { display: inline !important; }

          /* ----------------------------------------------------------------------------
           * DOWNLOAD FROM A DRAWER PRINTS THE DRAWER, AND NOTHING ELSE — Fix Round 1 (E).
           *
           * A drawer is \`position: fixed\` in a 560px column over the page. Printing it gave
           * a clipped strip of the drawer AND the whole page behind it — the tab bar, the
           * other conversations, the composer. \`printDrawer()\` stamps this class on <body>
           * for the duration of the print dialog: the page is hidden, and the drawer stops
           * being a panel and becomes the document.
           * -------------------------------------------------------------------------- */
          body.printing-drawer .print-page { display: none !important; }
          body.printing-drawer .print-drawer {
            position: static !important; max-width: none !important; width: 100% !important;
            border: 0 !important; box-shadow: none !important; display: block !important;
          }
          /* The body scrolls on screen; on paper it must run to as many pages as it needs. */
          body.printing-drawer .print-drawer .drawer-body {
            overflow: visible !important; padding: 0 !important; flex: none !important;
          }
        }
      `}</style>

      {/*
        900, THE SAME COLUMN AS DOCUMENTS, AUDITS AND COMPANY INFORMATION — Workspace layout, Task 2.
        It was 775, the reading measure; the owner put this page in the same shell as the working
        surfaces, so it now takes their width and their `pb-16` (`app/audits/page.tsx:478`).

        A LITERAL, NOT `max-w-[var(--measure)]`, AND THE REASON IS A TRAP WORTH KNOWING. (The token
        holds 775 in any case, so it would no longer be this width even if it worked.)
        The token route looks identical and silently did nothing on localhost: Tailwind
        regenerated the utility `.max-w-[var(--measure)]{max-width:var(--measure)}` — it scans
        this file for classes — while the dev server kept serving a stale `globals.css` whose
        `:root` block still ended at `--radius`. So the rule referenced a variable that did not
        exist, the declaration was discarded, and the column ran the full 1290px.

        *** IT FAILS OPEN. *** An undefined custom property in a `max-width` does not fall back
        to something sensible or warn; it removes the constraint. The production build had the
        token and was fine, so this only ever appears in the one place we actually look at it.
        `--measure` stays defined in `globals.css` for `DESIGN.md` to point at; the number that
        has to survive a stale cache is written here.
      */}
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="no-print pt-6">
          {/* Serif at 28 reads heavier than sans at 24, so the weight comes off — the typeface
              carries the emphasis. font-normal is explicit rather than inherited. */}
          <h1 className="font-serif text-[28px] font-normal text-gray-900">Compliance Workspace</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Research the rules that apply to you, and turn what you find into action steps.
          </p>
        </div>

        {/* THE TABS ARE AUDITS' TABS — `app/audits/page.tsx:488–501`, classes copied. The count sits
            inside the label as Audits writes it, "Checklists (3)", and is absent at none. Tab state
            stays in React state here: nothing links to a tab of this page. */}
        <div className="no-print mb-5 mt-5 flex items-center justify-between gap-6 border-b border-gray-200">
          <div className="flex items-center gap-6">
            {([['ask', 'Ask a question'], ['conversations', 'Conversations'], ['checklists', 'Checklists']] as const)
              .map(([k, label]) => (
                <button key={k} onClick={() => switchTab(k)}
                  className={`-mb-px border-b-2 pb-3 text-[14px] font-medium transition-colors ${
                    tab === k ? 'border-[var(--green)] text-[var(--green-ink)]'
                              : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {label}{k === 'checklists' && checklists.length > 0 ? ` (${countOf(checklists.length)})` : ''}
                </button>
              ))}
          </div>
          <button onClick={() => newConversation()}
            className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">New conversation</span>
          </button>
        </div>

        {notice && (
          <div className="no-print mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {notice}
            <button onClick={() => setNotice(null)} className="ml-3 text-xs underline">Dismiss</button>
          </div>
        )}

        {/* ================= ASK ================= */}
        {tab === 'ask' && (
          <div className={started ? 'pt-1' : ''}>
            {/* THE PRINTED TITLE BLOCK, page 1 of a printed conversation (board 10), the same as a
                drawer's: the title in the serif, then one grey line of absolute dates. The company,
                "Conversation" and the page numbers are in the shared frame (`printWithFrame`). */}
            {started && (() => {
              const convo = topics.find((t) => t.id === topicId)
              const dates = [
                convo?.created_at ? `Started ${printDate(convo.created_at)}` : null,
                convo?.last_turn_at ? `Last message ${printDate(convo.last_turn_at)}` : null,
                `Printed ${printDate(new Date())}`,
              ].filter(Boolean).join(' · ')
              return (
                // Flush with the frame's header, as a drawer's title is: the column's own padding
                // (`.print-page` px-4 sm:px-6) is taken back, on paper only — the block is hidden on screen.
                <div className="hidden print:block mb-6 -ml-4 sm:-ml-6">
                  <p className="font-serif text-[22px] font-semibold leading-tight text-gray-900">
                    {displayTitle(convo?.title ?? null) ?? 'Conversation'}
                  </p>
                  <p className="mt-1.5 text-[11px] text-gray-500">{dates}</p>
                </div>
              )
            })()}
            {exchanges.map((x) => (
              <div key={x.id} className="mb-8">
                {/* The question was `text-[15px] font-medium` and nothing else, so in a long
                    thread it read as a slightly bold paragraph and vanished. Right-aligned in a
                    grey bubble it is findable when scrolling back. GREY, not green: green is
                    carrying state on this page — the active tab, the primary action — and every
                    question you have ever asked is not a state. */}
                {x.file ? <FileCard file={x.file} onRetry={() => fileInput.current?.click()} /> : (
                  <div className="mb-5 flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-gray-200 px-4 py-3 text-[16px] leading-relaxed text-gray-900">
                      {/* The file that went with the question, named in the question itself (Task 4). */}
                      {x.attachment && (
                        <p className="mb-1 flex items-center gap-1.5 text-[13px] text-gray-600">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="shrink-0" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
                          <span className="truncate">{x.attachment.name}</span>
                        </p>
                      )}
                      <p>{x.question}</p>
                    </div>
                  </div>
                )}

                {/* A question sent with a file shows its real stages; one without shows Working. */}
                {x.steps ? (
                  <Stages steps={x.steps} name={x.attachment?.name ?? 'the file'} onStop={stop} />
                ) : (x.phase === 'sending' || x.phase === 'searching' || (x.phase === 'writing' && !x.text)) && (
                  <Working phase={x.phase} searches={x.searches} onStop={stop} />
                )}

                {/* THE FILE CARD, ABOVE THE ANSWER — Workspace Task 4, board 4. Once the stages are
                    over and the file was read, or on a reopened turn. */}
                {!x.steps && x.attachment && (x.attachment.read || x.attachment.deleted) && (
                  <AttachedCard a={x.attachment} onOpen={(docId) => setReportDoc(docId)} />
                )}

                {/* NO CARD. The thing you read was inside a bordered white rectangle on a grey
                    page, which framed it as a widget rather than as the answer. The prose and its
                    sources sit on the page itself; the conversation's actions are under the box. */}
                {x.text && (
                  <>
                    <AnswerBody text={x.text} sources={x.sources} />
                    <div className="sources-print"><SourceList sources={x.sources} /></div>
                  </>
                )}

                {/* The amber stays — a stopped answer IS an attention state — but a filled box
                    on a page that no longer has any other boxes shouts. A left rule carries it. */}
                {x.phase === 'stopped_early' && (
                  <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
                    <b className="font-semibold">This answer stopped early.</b>{' '}
                    The answer stopped before it was finished, so what is above is incomplete. Nothing
                    was saved for it.
                    <button onClick={() => ask(x.question, 'research')}
                      className="ml-2 font-medium underline hover:no-underline">Try again</button>
                  </div>
                )}
                {x.phase === 'stopped' && (
                  <p className="mt-2 text-[14px] text-gray-500">
                    {/* After Stop during the file's own stages, the line says what is true about the
                        file (`ask()`, Task 4). After Stop while the answer was coming, the file was
                        already saved and read, and that is said too. */}
                    {x.stopNote ?? <>
                      Stopped. {x.attachment?.read ? 'The file is saved in Documents and was read. ' : ''}
                      {x.text ? 'What arrived is above — ' : ''}Ask again, or change the question.
                    </>}
                  </p>
                )}
                {x.phase === 'failed' && (
                  <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
                    {x.error} You can ask again, or rephrase the question.
                  </div>
                )}
              </div>
            ))}

            <div ref={bottomRef} />

            {/*
              THE COMPOSER IS THE LAST THING IN THE CONVERSATION, NOT A BAR BOLTED TO THE WINDOW.
              It was `fixed inset-x-0 bottom-0` with its own border and blur, so it floated over
              the footer band and covered the disclaimer — and it needed pb-32 on the page to
              reserve room for itself. Now it simply follows the last exchange, inside the page
              column, which means it lines up with the answers instead of spanning past them.
            */}
            <div className={`no-print ${started ? 'mt-8' : ''}`}>
              <div>
                <div className="relative rounded-xl border border-gray-200 bg-white focus-within:border-[var(--green)]">
                  {/* THE STAGED FILE, AS A CHIP IN THE BOX — Workspace Task 4, board 2. It replaces
                      the "Asking about ‹name› remove" line above the box (Documents Run 5): the file
                      sits where the question is written, and × leaves nothing anywhere, because
                      nothing has been saved yet. `px-5` puts it on the x typed text starts on. */}
                  {staged && (
                    <div className="px-5 pt-3.5">
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded bg-gray-100 px-2 py-1 text-[13px] text-gray-700">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="shrink-0" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
                        <span className="truncate">{staged.name}</span>
                        <button onClick={() => setStaged(null)} disabled={busy} aria-label="Remove the file" title="Remove the file"
                          className="ml-0.5 shrink-0 text-gray-400 hover:text-gray-800 disabled:text-gray-300">×</button>
                      </span>
                    </div>
                  )}
                  <div className="flex items-end gap-2 p-3.5">
                    <textarea
                      ref={composerRef}
                      value={box}
                      onChange={(e) => setBox(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(box, 'research') } }}
                      rows={1}
                      placeholder={started ? 'Ask about a rule, or describe a job you need the steps for…' : undefined}
                      className="max-h-36 min-h-[92px] flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[16px] text-gray-900 outline-none placeholder:text-[16px] placeholder:text-gray-400"
                    />
                    {started && (
                      <>
                        <button onClick={() => fileInput.current?.click()} title="Attach a file" aria-label="Attach a file"
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
                        </button>
                        {busy ? (
                          <button onClick={stop} title="Stop" aria-label="Stop"
                            className="rounded-lg bg-gray-900 p-2 text-white hover:bg-gray-700">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
                          </button>
                        ) : (
                          <button onClick={() => ask(box, 'research')} title="Send" aria-label="Send" disabled={!box.trim()}
                            className="rounded-lg bg-[var(--green)] p-2 text-white hover:bg-[var(--green-ink)] disabled:opacity-40">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/*
                    THE EXAMPLES, AS AUDITS SHOWS THEM — `app/audits/page.tsx:511–518`, Workspace
                    layout Task 2b. An OVERLAY from the top of the box, not a placeholder (a
                    placeholder holds one line) and not buttons: guidance to read, gone the moment
                    anything is typed. They are NOT clickable. They used to be, and a click sent the
                    sentence straight to research — a paid call from a click on an example.

                    *** THE INSET IS THE TEXTAREA'S OWN. *** `p-5` is 20px: the box's `p-3.5` (14)
                    plus the textarea's `px-1.5 py-1.5` (6), so "e.g." starts on the pixel typed
                    text starts on. Measured with `npm run measure`, not assumed.
                  */}
                  {!started && !box && !staged && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-5">
                      {EXAMPLE_QUESTIONS.map((e) => (
                        <p key={e.label} className="truncate text-[14px] text-gray-400">e.g. {e.question}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/*
                  THE CONVERSATION'S ACTIONS, UNDER THE BOX — Workspace Task 3, board 1.
                  They sat under the newest answer, so they moved down the page with every question
                  and acted on "this" when what they act on is the whole conversation. Under the box
                  they stay where the next thing is typed. Shown once there is an answer to act on
                  and a topic to act on it; every one is disabled while a request is in flight.
                  The checklist is the step forward, so it carries the green; the other two are the
                  page's text actions. The line beneath replaces the four-answer nudge: said once,
                  always, rather than interrupting the fourth answer.
                */}
                {started && (
                  <div className="no-print">
                    {hasAnswer && topicId && (
                      <div className="mt-[10px] flex flex-wrap items-center gap-5">
                        {/* Disabled the moment it is pressed, and while any run on this conversation is
                            going, with the run's own words in place of the button's (Stage 4). */}
                        <button onClick={() => setScopeFor(topicId)} disabled={busy || inProgress(topicId, 'checklist')}
                          className="text-[14px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
                          {inProgress(topicId, 'checklist') ? CLAIM_WORDS.checklist : 'Turn this into a checklist'}
                        </button>
                        <button onClick={() => summarise(topicId)} disabled={busy || inProgress(topicId, 'summary')} className={TEXT_ACTION}>
                          {inProgress(topicId, 'summary') ? CLAIM_WORDS.summary : 'Summarise this conversation'}
                        </button>
                        {/* The shared print frame (board 10), the same path the drawers take — not a copy. */}
                        <button onClick={() => printWithFrame({ company: companyName ?? '', type: 'Conversation' })}
                          disabled={busy} className={TEXT_ACTION}>
                          Download
                        </button>
                      </div>
                    )}
                    <p className="mt-2 text-[12px] text-gray-500">
                      One topic per conversation. When you are done, summarise it. Start a new conversation for the next topic.
                    </p>
                  </div>
                )}

                {/*
                  ONE LINE UNDER THE BOX, IN AUDITS' SHAPE — Workspace layout, Task 2 (board A).
                  `app/audits/page.tsx:522–542`: the attach control on the left as a quiet 12px
                  underlined line, the actions on the right. Attaching is still not a third outcome
                  — it is something you do before you ask, so it reads as a line, not a button.

                  *** THE ACTIONS ARE NOT DISABLED ON AN EMPTY BOX. *** `!box.trim()` in the
                  disabled condition once rendered the primary action as a pale rectangle at 40%
                  opacity on every first visit, so nothing on the page looked like the thing to do.
                  A click with an empty box puts the cursor in the box; nothing is sent and no
                  route is called. `busy` still disables, because during a request they genuinely
                  cannot be pressed.
                */}
                {!started && (
                  <div className="mt-[10px] flex items-start justify-between gap-4">
                    <p className="min-w-0 text-[12px] text-gray-500">
                      {/* ONE CLICK OPENS THE PICKER, AS ON AUDITS (Task 2b). The pin is the docked
                          composer's paperclip path, at 13px, in the line's own colour. */}
                      <button onClick={() => fileInput.current?.click()} disabled={busy}
                        className="inline-flex cursor-pointer items-center gap-1.5 text-left hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="shrink-0" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
                        <span className="underline">Attach a file and ask any compliance question about it</span>
                      </button>
                    </p>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() => { if (!box.trim()) { composerRef.current?.focus(); return } ask(box, 'checklist') }}
                        disabled={busy}
                        className={SECONDARY_LARGE}>
                        Make a checklist
                      </button>
                      <button
                        onClick={() => { if (!box.trim()) { composerRef.current?.focus(); return } ask(box, 'research') }}
                        disabled={busy}
                        className={PRIMARY}>
                        Research this
                      </button>
                    </div>
                  </div>
                )}

                {/*
                  THE COUNTS LINE — Audits' "thin line", `app/audits/page.tsx:576` and `:579`, classes
                  copied. What this page is made of, said once, before anything is asked. Built from
                  the topics and checklists the page already loads (`loadTopics`, `loadChecklists`);
                  both read at most LIST_CAP rows, and a full read is said as "60+".
                */}
                {!started && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                    <p className="text-[13px] text-gray-500">
                      {countWord(topics.length, 'conversation')}
                      {' · '}{countWord(checklists.length, 'checklist')}
                      {topics.length > 0 ? ` · last asked ${fmtDate(lastAsked)}` : ''}
                    </p>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ================= CONVERSATIONS ================= */}
        {tab === 'conversations' && (
          <div className="pt-1">
            {/* THE RETENTION LINE, AT THE TOP, AS AUDITS' COUNTS LINE — `app/audits/page.tsx:576`
                and `:579`, classes copied (Workspace layout, Task 2, board D). Words: the owner's 12-month rule, Workspace
                features Task 2 (`lib/retention.ts`). */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-nowrap">
              <p className="min-w-0 flex-1 text-[13px] text-gray-500">
                Full conversations are kept for 12 months after the last message. Summaries are kept until you
                delete them.
              </p>
              {topics.length > 20 && (
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations" aria-label="Search conversations"
                  className="w-56 shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[var(--green)]" />
              )}
            </div>

            {topics.length > 0 && shownTopics.length === 0 && (
              <p className="mt-4 text-[13px] text-gray-500">No conversation’s title or summary contains “{search.trim()}”.</p>
            )}
            {topics.length === 0 ? (
              <div className="mt-4"><Empty title="No conversations yet" note="Ask a question and it will appear here." /></div>
            ) : (
              <div className="mt-4">
                {groupByDay(shownTopics, (t) => listGroup(t.last_turn_at ?? t.created_at)).map((g, gi) => (
                  <div key={g.day + gi} className={gi === 0 ? '' : 'mt-6'}>
                    <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-400">{g.day}</p>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                      {/*
                        A LIST IS SCANNED; THE DRAWER IS WORKED FROM. The title is 13px and
                        regular — it separates from the 12px gray-500 meta line by colour and
                        size alone, which is how Finder, Drive and Dropbox set a filename, and
                        it keeps these lists dense as they grow. The checklist drawer's item
                        name stays 16px on purpose: that is reading text, and the two are
                        allowed to differ.

                        THE ROW HAS TO LOOK CLICKABLE. Grey text on a grey page with no response
                        to the pointer gave no sign that a row opened anything. `-mx-3` with a
                        matching `px-3` lets the hover fill sit slightly proud of the text
                        WITHOUT moving the text, so titles stay aligned with the page column.
                        The title turns green because the title is the thing you are aiming at.
                        The Checklists row below is the same pattern.

                        NO DELETE ON THE ROW — Workspace Task 3, board 7. Deleting is done from the
                        drawer, where the thing is open in front of you and its confirmation can
                        offer a download first. A Delete beside every row was one stray click from
                        the browser's pop-up and no copy.
                      */}
                      {g.rows.map((t) => {
                        // ONE GREY LINE, ITS PARTS SEPARATED BY " · " — Workspace Task 5, board 5.
                        const parts: React.ReactNode[] = [
                          listWhen(t.last_turn_at ?? t.created_at),
                          `${t.questionCount} question${t.questionCount === 1 ? '' : 's'}`,
                        ]
                        if (t.firstDocumentName) parts.push(
                          <span key="file" className="inline-flex min-w-0 items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
                            <span className="truncate">{t.firstDocumentName}{t.documentCount > 1 ? ` +${t.documentCount - 1}` : ''}</span>
                          </span>)
                        // A RUN GOING SAYS SO, IN THE ROW'S OWN LINE — Workspace Stage 4.
                        parts.push(inProgress(t, 'summary') ? CLAIM_WORDS.summary : summaryWords(t))
                        if (inProgress(t, 'checklist')) parts.push(CLAIM_WORDS.checklist)
                        else if (t.checklistId) parts.push(`Checklist ${t.checklistDone} of ${t.checklistTotal} done`)
                        return (
                          <div key={t.id} className="group -mx-3 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white">
                            <button onClick={() => setSummaryDrawer(t)} className="min-w-0 flex-1 text-left">
                              <p className="truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">{displayTitle(t.title) ?? 'Untitled conversation'}</p>
                              {/* NO COLOUR HERE. Amber is reserved for a real attention state and
                                  "not summarised yet" is the normal condition of anything asked
                                  today; green for a routine fact is the same mistake the other way. */}
                              <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-gray-500">
                                {parts.map((part, i) => (
                                  <React.Fragment key={i}>{i > 0 && <span aria-hidden="true">·</span>}{part}</React.Fragment>
                                ))}
                              </p>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= CHECKLISTS ================= */}
        {tab === 'checklists' && (
          <div className="pt-1">
            {checklists.length === 0 ? (
              <Empty title="No checklists yet" note="Ask a question, then turn the answer into a checklist." />
            ) : (
              <div>
                {groupByDay(checklists, (c) => friendlyDate(c.created_at)).map((g, gi) => (
                  <div key={g.day + gi} className={gi === 0 ? '' : 'mt-6'}>
                    <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-400">{g.day}</p>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                      {g.rows.map((c) => (
                        <div key={c.id} className="group -mx-3 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white">
                          <button onClick={() => openChecklist(c.id)} className="min-w-0 flex-1 text-left">
                            <p className="truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">{c.title ?? 'Untitled checklist'}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
                              {/* GREEN ONLY WHEN IT IS ACTUALLY DONE. Every row was green,
                                  including rows at zero, which made the colour mean "this is a
                                  checklist" rather than "this is finished". */}
                              <span className={c.mustTotal > 0 && c.mustDone === c.mustTotal ? 'text-[var(--green)]' : undefined}>
                                {mustDoLabel(c.mustTotal, c.mustDone)}
                              </span>
                              {(c.fromConversation > 0 || c.added > 0) && (
                                <span>{c.fromConversation} from the conversation · {c.added} newly checked</span>
                              )}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {working && (
        <div className="no-print fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-[13px] text-white shadow-lg">
          {working}
        </div>
      )}

      {/* z-[45], not z-40: AppLayout's sticky header is z-40 too, so at z-40 they tied and the
          top bar showed at full strength through the scrim. Order is page, scrim (45), drawer
          (50). */}
      {(summaryDrawer || listDrawer) && (
        <div className="no-print fixed inset-0 z-[45] bg-gray-900/30"
          onClick={() => { setSummaryDrawer(null); setListDrawer(null) }} />
      )}

      {summaryDrawer && (
        <Drawer title={displayTitle(summaryDrawer.title) ?? 'Conversation'}
          sub={`${friendlyDate(summaryDrawer.last_turn_at ?? summaryDrawer.created_at)} · ${conversationStatus(summaryDrawer, summaryDrawer.turnCount > 0).label}`}
          company={companyName}
          // On paper (board 10): absolute dates only, never "Today" or "Yesterday".
          printType="Summary report"
          printDates={summaryDrawer.summarised_at
            ? `Summarised ${printDate(summaryDrawer.summarised_at)}`
            : `Last message ${printDate(summaryDrawer.last_turn_at ?? summaryDrawer.created_at)}`}
          onClose={() => setSummaryDrawer(null)}
          footer={
            <>
              {/* HONEST TO WHAT EXISTS: "Open the conversation" only while turns are there. */}
              {summaryDrawer.turnCount > 0 && (
                <button onClick={() => openConversation(summaryDrawer)} className={OUTLINE}>
                  Open the conversation
                </button>
              )}
              {summaryDrawer.checklistId && (
                <button onClick={() => { const id = summaryDrawer.checklistId!; setSummaryDrawer(null); openChecklist(id) }}
                  className={TEXT_ACTION}>
                  Open the checklist
                </button>
              )}
              <button onClick={printDrawer} className={`ml-auto ${TEXT_ACTION}`}>
                Download
              </button>
              {/* At the far right, after Download, in the same quiet grey as the checklist
                  drawer's Delete. It opens the page's own confirmation, never the browser's. */}
              <button onClick={() => askToDelete({ kind: 'conversation', topic: summaryDrawer })}
                className="ml-3 text-[14px] text-gray-400 hover:text-red-600">
                Delete
              </button>
            </>
          }>
          {/* A full-height column, so the facts line below can sit at the foot of the drawer,
              directly above its footer, however short the summary is (`mt-auto`). */}
          <div className="flex min-h-full flex-col">
          {inProgress(summaryDrawer, 'summary') ? (
            // A SUMMARY BEING WRITTEN — Workspace Stage 4. The line in place of the body; the poll
            // replaces it with the report when the claim clears.
            <p className="text-[12px] text-gray-500">{CLAIM_WORDS.summary}</p>
          ) : drawerReport ? (
            // Keyed by the topic: a new drawer is a new mount, so every open starts folded (Stage 2).
            <ReportView key={summaryDrawer.id} report={drawerReport} factsLine={factsLine} />
          ) : summaryDrawer.summary ? (
            <AnswerBody text={summaryDrawer.summary} sources={[]} />
          ) : (
            <p className="text-[14px] leading-relaxed text-gray-600">
              This one hasn&apos;t been summarised yet. The summary is written overnight, and the full
              conversation is here until then.
            </p>
          )}
          {summaryDrawer.summarised_at && summaryDrawer.turnCount === 0 && (
            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-[12.5px] text-gray-500">
              The messages in this conversation were cleared 12 months after the last message. The summary
              above is kept.
            </p>
          )}
          {/* FACTS FROM THIS CONVERSATION, WAITING — Workspace Task 3, board 6. Counted here and
              confirmed in Company information, which is where the sidebar's badge points
              (`components/AppLayout.tsx:41`). No line at none. */}
          {/* A text-only summary keeps the facts line at the foot, as in Task 3; a report carries it
              between "Asked and not answered" and the sources (board 6). */}
          {!drawerReport && factsLine && <div className="mt-auto">{factsLine}</div>}
          </div>
        </Drawer>
      )}

      {listDrawer && (
        <Drawer title={listDrawer.row.title ?? 'Checklist'}
          sub={checklistSub(listDrawer.row)}
          company={companyName}
          printType="Checklist"
          printDates={`Made ${printDate(listDrawer.row.created_at)}`}
          onClose={() => setListDrawer(null)}
          footer={
            <>
              <button onClick={printDrawer} className={OUTLINE}>Download</button>
              <button onClick={() => askToDelete({ kind: 'checklist', id: listDrawer.row.id })}
                className="ml-auto text-[14px] text-gray-400 hover:text-red-600">Delete</button>
            </>
          }>
          {/* MUST DO ONLY — the bar and the line count legal obligations, not advice or questions (board 8). */}
          <div className="mb-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-[var(--green)] transition-all"
                style={{ width: `${progressPercent(listDrawer.row.mustTotal, listDrawer.row.mustDone)}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-gray-500">{mustDoLabel(listDrawer.row.mustTotal, listDrawer.row.mustDone)}</p>
          </div>
          {/*
            THREE GROUPS — Workspace Task 6, board 8. Must do (numbered, in the order to do them),
            Worth doing (advice, not a legal rule), To confirm (open questions). An empty group is
            not shown. Checklists from Documents and Audits use the first two and render the same way.

            ROWS, NOT CARDS (unchanged): the checkbox is the first child at a fixed size, so every one
            sits at the same x and every text block indents to the same left margin.
          */}
          {groupItems(listDrawer.items, { ordered: listDrawer.ordered }).map(({ group, items }) => (
            <section key={group.key} className="mt-6 first:mt-2">
              <div className="flex items-baseline justify-between pb-2">
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-gray-700">{group.title}</h3>
                <span className="text-[12px] text-gray-500">{group.hint(items.length)}</span>
              </div>
              <div className="divide-y divide-gray-100 border-t border-gray-200">
                {items.map((item, n) => {
                  const sources = itemSources(item)
                  const researching = !!howToBusy[item.id] || (clock > 0 && isResearching(item.howto_started_at, clock))
                  return (
                    <div key={item.id} className="py-4">
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleItem(item)} aria-label={item.completed ? 'Mark not done' : 'Mark done'}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] ${
                            item.completed ? 'border-[var(--green)] bg-[var(--green)] text-white' : 'border-gray-300 hover:border-[var(--green)]'}`}>
                          {item.completed && '✓'}
                        </button>
                        <div className={`min-w-0 flex-1 ${item.completed ? 'opacity-60' : ''}`}>
                          <p className="text-[16px] font-medium text-gray-900">
                            {group.numbered && <span className="mr-1.5 text-gray-400">{n + 1}.</span>}
                            {item.name}
                          </p>
                          {item.description && <p className="mt-1 text-[15px] leading-relaxed text-gray-600">{item.description}</p>}
                          {/* WHERE IT CAME FROM, then EACH SOURCE ON ONE LINE — Workspace Stage 2:
                              "[n] host · title", cut with "…", the full title on hover; full on paper.
                              A Documents or Audits item names its document or audit, unlinked. */}
                          {((item.origin && item.origin !== 'document') || !sources.length) && (
                            <p className="mt-2 text-[12px] text-gray-500">
                              {item.origin && item.origin !== 'document' && (item.origin === 'conversation' ? 'from this conversation' : 'newly checked')}
                              {item.origin && item.origin !== 'document' && !sources.length && <span className="text-gray-300"> · </span>}
                              {!sources.length && <span className="text-gray-400">{noSourceText(item.origin)}</span>}
                            </p>
                          )}
                          {sources.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {sources.map((src, k) => src.url
                                ? <OneLineLink key={k} n={k + 1} title={src.title} url={src.url} />
                                : <p key={k} className="text-[12px] text-gray-500">{src.title}</p>)}
                            </div>
                          )}
                          {sources.filter((src) => src.label === 'other' && src.url).map((src, k) => (
                            <p key={k} className="mt-1 text-[12px] text-gray-500">{OTHER_SOURCE_LINE(hostLabel(src.url as string))}</p>
                          ))}
                          {group.howTo && (
                            item.howto ? <HowToSteps result={item.howto} />
                            : researching ? (
                              <p className="no-print mt-2 flex items-center gap-2.5 text-[13px] text-gray-900">
                                <span aria-hidden className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--green)] border-r-transparent" />
                                Looking this up — checking sources…
                              </p>
                            ) : (
                              <button onClick={() => howTo(item)}
                                className="no-print mt-2 text-[13px] text-[var(--green-ink)] underline underline-offset-2 hover:text-gray-900">
                                How do I do this?
                              </button>
                            )
                          )}
                          {howToError[item.id] && !researching && (
                            <p className="no-print mt-1 text-[13px] text-gray-600">{howToError[item.id]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </Drawer>
      )}

      {scopeFor && (
        <Sheet onClose={() => setScopeFor(null)} title="How much should this cover?"
          lede="A checklist that stops where the conversation stopped can read as though you're finished.">
          <button onClick={() => convert('discussed')}
            className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40">
            <b className="block text-[14px] font-medium text-gray-900">Just what we discussed</b>
            <span className="mt-0.5 block text-[13px] text-gray-600">Drawn from this conversation and the sources it cited — nothing else.</span>
          </button>
          <button onClick={() => convert('complete')}
            className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40">
            <b className="block text-[14px] font-medium text-gray-900">Everything on this subject</b>
            <span className="mt-0.5 block text-[13px] text-gray-600">The items we discussed, plus what we did not reach — those are checked now and marked as newly researched.</span>
          </button>
          <button onClick={() => setScopeFor(null)} className="mt-3 w-full py-2 text-[13px] text-gray-500 hover:text-gray-800">Not now</button>
        </Sheet>
      )}

      {/* THE DOCUMENTS REPORT — Workspace Task 4. Scrim at z-[45], drawer at z-50, as on /documents.
          `onPickFile` is the one prop with no twin here: on /documents it opens that page's
          uploader, and "Add a newer version" files the upload as a version of this document. This
          page has no version upload, so a version request goes to Documents to be done there;
          "Upload a clearer copy" and "Add the log" stage a file in this box instead. */}
      {reportDoc && (
        <>
          <div className="no-print fixed inset-0 z-[45] bg-gray-900/30" onClick={() => setReportDoc(null)} />
          <DocumentReport
            documentId={reportDoc}
            companyName={companyName}
            onClose={() => setReportDoc(null)}
            onChanged={loadChecklists}
            folders={reportFolders}
            onMove={moveDocument}
            onPickFile={(versionOf) => {
              setReportDoc(null)
              if (versionOf) window.location.href = '/documents'
              else fileInput.current?.click()
            }}
          />
        </>
      )}

      {/* THE PAGE'S OWN DELETE CONFIRMATION — Workspace Task 3, board 7. It replaces `confirm()`.
          It says what goes and what stays, and offers the copy first: "Download the summary" /
          "Download the checklist" print the drawer still open beneath it, exactly as the drawer's
          own Download does. Cancel has the focus, so Enter does not delete; Escape and a click
          outside cancel. A failure keeps the sheet open and says so in one plain line. */}
      {deleting && (
        <Sheet onClose={cancelDelete}
          title={deleting.kind === 'conversation' ? 'Delete this conversation?' : 'Delete this checklist?'}
          lede={deleting.kind === 'conversation'
            ? 'This deletes the conversation and its summary for good. You cannot undo it.'
            : 'This deletes the checklist and every box you ticked, for good. You cannot undo it.'}>
          <p className="text-[13px] leading-relaxed text-gray-600">
            {deleting.kind === 'conversation'
              ? 'Download the summary first if you may need it. Checklists, files and facts that came from it stay.'
              : 'Download it first if you may need it.'}
          </p>
          {deleteFailed && (
            <p className="mt-3 text-[13px] text-amber-900">That could not be deleted. Nothing was changed. Please try again.</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={printDrawer} className={OUTLINE}>
              {deleting.kind === 'conversation' ? 'Download the summary' : 'Download the checklist'}
            </button>
            {/* OUTLINE's box in red: the one destructive action, the same size as its neighbour. */}
            <button onClick={confirmDelete} disabled={deleteBusy}
              className="rounded-md border border-[#B42318] px-3 py-1.5 text-[14px] font-medium text-[#B42318] hover:bg-red-50 disabled:opacity-50">
              Delete for good
            </button>
            <button onClick={cancelDelete} autoFocus className={`ml-auto ${TEXT_ACTION}`}>
              Cancel
            </button>
          </div>
        </Sheet>
      )}

    </AppLayout>
  )
}

/* ------------------------------------------------------------------ pieces */

/**
 * THE WORKING STATE, DRIVEN BY REAL EVENTS.
 *
 * The prototype animated four fixed steps on a 520 ms timer. That is a fiction — it is not
 * reporting progress, it is filling silence (`CLAUDE.md` §5.1). These words come from the
 * stream: `searching` events are counted as they arrive, and `writing` means text has started.
 */
function Working({ phase, searches, onStop }: { phase: string; searches: number; onStop: () => void }) {
  const label = phase === 'searching'
    ? (searches <= 1 ? 'Checking a source…' : `Checking ${searches} sources…`)
    : phase === 'writing' ? 'Writing the answer…' : 'Working on it…'
  return (
    <div className="no-print flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
      <span className="text-[13px] text-gray-600">{label}</span>
      <button onClick={onStop} className="ml-auto text-[12.5px] text-gray-400 underline hover:text-gray-700">Stop</button>
    </div>
  )
}

/** Copies of `lib/summaryReport.ts`' `NO_SOURCE` and `AS_OF_LINE` — that file is server-only (see the
 *  import above). `tests/unit/summaryReport.test.ts` fails if these two drift from the originals. */
const NO_SOURCE = 'No source cited in the conversation'
const AS_OF_LINE = (asOf: string) => {
  const d = new Date(`${asOf.slice(0, 10)}T00:00:00Z`)
  const when = Number.isNaN(d.getTime()) ? asOf
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return `What applies to you as of ${when}, from this conversation. Rules and tariffs change. Check before you act.`
}

/**
 * THE SUMMARY REPORT IN THE DRAWER — Workspace Task 5, board 6. In this order: the as-of line, your
 * situation, what applies grouped by authority, still to confirm, asked and not answered, the facts
 * line, and the sources as one numbered list. An item's sources are "[n] title" links to the list's
 * own entries; an item with none says so in grey. Download prints all of it (`printDrawer`).
 */
/**
 * ONE SOURCE ON ONE LINE — Workspace Stage 2. On screen: "[n] host · title", cut with "…" by CSS, the
 * full title on hover (`oneLineSource`, `lib/checklistView.ts`). On paper: the full title and the full
 * address, because a link on paper is only useful if its address can be read.
 */
function OneLineLink({ n, title, url, after }: { n?: number; title: string; url: string; after?: React.ReactNode }) {
  const one = oneLineSource(title, url)
  const num = n === undefined ? '' : `[${n}] `
  return (
    <span className="flex min-w-0 items-baseline text-[12.5px]">
      <a href={url} target="_blank" rel="noopener noreferrer" title={one.full}
         className="min-w-0 text-emerald-800 underline underline-offset-2">
        <span className="screen-only block truncate">{num}{one.host} · {one.title}</span>
        <span className="print-only break-all">{num}{one.full} — {url}</span>
      </a>
      {after && <span className="shrink-0 whitespace-pre text-gray-500">{after}</span>}
    </span>
  )
}

/**
 * ONE FOLDING ROW OF THE SUMMARY — a real button: Enter and Space work, `aria-expanded` says its state,
 * `aria-controls` names the panel. A chevron (screen only), the label, and the count at the right.
 */
function FoldRow({ label, right, expanded, controls, onClick }: {
  label: string; right: string; expanded: boolean; controls: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} aria-controls={controls}
      className="flex w-full items-center gap-2 py-2.5 text-left hover:bg-gray-50">
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className={`no-print shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>
        <path d="m9 6 6 6-6 6" />
      </svg>
      <span className="min-w-0 flex-1 text-[14px] font-semibold text-gray-900">{label}</span>
      <span className="shrink-0 text-[12px] text-gray-500">{right}</span>
    </button>
  )
}

/**
 * THE SUMMARY AS AN ACCORDION — Workspace Stage 2, the canvas feature boards, board 6b, with the
 * owner's one change: Still to confirm comes AFTER the agencies. The order is the one Task 5 built.
 *   · Open on first view: the as-of line, Your situation, Still to confirm (NEVER folded), Asked and
 *     not answered, the facts line.
 *   · Folded on first view: each authority under What applies (one row: chevron, the authority,
 *     "N things to do"), and Sources (one row: "Sources" and the count).
 *   · "Open all" / "Close all" beside "What applies · N things to do".
 *   · Rows are real buttons with aria-expanded and aria-controls. Nothing is remembered: the drawer
 *     mounts this with the topic as its key, so every open starts folded.
 *   · PRINT IS ALWAYS OPEN: a folded panel carries `fold-closed`, hidden on screen and shown by the
 *     page's print CSS. The screen state is not changed to print.
 */
function ReportView({ report, factsLine }: { report: SummaryReport; factsLine: React.ReactNode }) {
  const byN = new Map(report.sources.map((src) => [src.n, src]))
  const heading = 'mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400'
  const uid = useId()
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const total = report.applies.reduce((n, g) => n + g.items.length, 0)
  const allOpen = report.applies.length > 0 && open.size === report.applies.length
  const toggle = (gi: number) => setOpen((o) => { const n = new Set(o); if (n.has(gi)) n.delete(gi); else n.add(gi); return n })
  const item = (it: ReportItem, key: string) => (
    <li key={key} className="py-2.5">
      <p className="text-[15px] font-medium text-gray-900">{it.name}</p>
      <p className="mt-0.5 text-[14px] leading-relaxed text-gray-600">{it.what_to_do}</p>
      <div className="mt-1 space-y-0.5">
        {it.sources.length ? it.sources.map((n) => {
          const src = byN.get(n)
          return src ? <OneLineLink key={n} n={n} title={src.title} url={src.url} /> : null
        }) : <p className="text-[12.5px] text-gray-400">{NO_SOURCE}</p>}
      </div>
    </li>
  )
  return (
    <div className="space-y-6">
      <p className="text-[13px] text-gray-500">{AS_OF_LINE(report.as_of)}</p>
      <section>
        <h4 className={heading}>Your situation</h4>
        <p className="text-[15px] leading-relaxed text-gray-800">{report.situation}</p>
      </section>
      {report.applies.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">What applies · {thingsToDo(total)}</h4>
            <button type="button" className="no-print text-[12px] text-[var(--green-ink)] hover:underline"
              onClick={() => setOpen(allOpen ? new Set() : new Set(report.applies.map((_, gi) => gi)))}>
              {allOpen ? 'Close all' : 'Open all'}
            </button>
          </div>
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {report.applies.map((g, gi) => {
              const id = `${uid}-a${gi}`
              return (
                <div key={g.authority + gi}>
                  <FoldRow label={g.authority} right={thingsToDo(g.items.length)} expanded={open.has(gi)} controls={id} onClick={() => toggle(gi)} />
                  <ul id={id} className={`divide-y divide-gray-100 pb-2 pl-[22px] ${open.has(gi) ? '' : 'fold-closed'}`}>
                    {g.items.map((it, i) => item(it, `${gi}-${i}`))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      )}
      {report.to_confirm.length > 0 && (
        <section>
          <h4 className={heading}>Still to confirm</h4>
          <ul className="divide-y divide-gray-100">{report.to_confirm.map((it, i) => item(it, `c-${i}`))}</ul>
        </section>
      )}
      {report.unanswered.length > 0 && (
        <section>
          <h4 className={heading}>Asked and not answered</h4>
          <ul className="list-disc space-y-1 pl-5 text-[14px] text-gray-700">
            {report.unanswered.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </section>
      )}
      {factsLine}
      {report.sources.length > 0 && (
        <section className="border-y border-gray-200">
          <FoldRow label="Sources" right={String(report.sources.length)} expanded={sourcesOpen}
            controls={`${uid}-src`} onClick={() => setSourcesOpen((v) => !v)} />
          {/* The full titles, as before: the list is where a source is read in full. */}
          <ol id={`${uid}-src`} className={`space-y-1.5 pb-3 ${sourcesOpen ? '' : 'fold-closed'}`}>
            {report.sources.map((src) => {
              const shown = displaySource(src.title, src.url)
              return (
                <li key={src.n} className="flex gap-2 text-[13px] leading-snug">
                  <span className="shrink-0 text-gray-400">{src.n}.</span>
                  <span>
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                       className="text-emerald-800 underline underline-offset-2">{shown.title}</a>
                    {' '}<span className="text-gray-400">{shown.host}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}

/** The words for each stage, as board 3 has them. */
const stageWords = (step: Step, name: string) =>
  step === 'save' ? 'Saving the file'
    : step === 'read' ? `Reading ${name}`
    : step === 'check' ? 'Checking it against your question'
    : 'Writing the answer'

/**
 * THE STAGES, EACH SHOWN WHILE IT IS TRUE — Workspace Task 4, board 3. Done: a green tick and grey
 * text. Now: a small spinner and dark text. Still to come: an empty circle and light grey. The
 * stage moves only when the request it names moves (`ask()`); nothing here runs on a timer.
 */
function Stages({ steps, name, onStop }: { steps: { list: Step[]; at: Step }; name: string; onStop: () => void }) {
  const at = steps.list.indexOf(steps.at)
  return (
    <div className="no-print mb-4">
      <ol className="space-y-1.5">
        {steps.list.map((step, i) => {
          const state = i < at ? 'done' : i === at ? 'now' : 'next'
          return (
            <li key={step} className="flex items-center gap-2.5 text-[13px]">
              <span className="flex w-3.5 shrink-0 justify-center">
                {state === 'done' ? <span className="text-[12px] leading-none text-[var(--green)]">✓</span>
                  : state === 'now' ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
                  : <span className="h-3 w-3 rounded-full border border-gray-300" />}
              </span>
              <span className={state === 'done' ? 'text-gray-500' : state === 'now' ? 'text-gray-900' : 'text-gray-400'}>
                {stageWords(step, name)}
              </span>
            </li>
          )
        })}
      </ol>
      <button onClick={onStop} className="mt-2 text-[12.5px] text-gray-400 underline hover:text-gray-700">Stop</button>
    </div>
  )
}

/**
 * THE FILE CARD — Workspace Task 4, board 4. Above the answer, between hairlines, no box: what was
 * read, what it was read as, where it is filed, and the report one click away. A file deleted from
 * Documents since keeps its name (migration 039 stores it on the turn) and loses the button.
 */
function AttachedCard({ a, onOpen }: { a: Attachment; onOpen: (documentId: string) => void }) {
  const kind = a.kind ? (FILE_KIND_LABEL[a.kind] ?? a.kind) : null
  return (
    <div className="mb-4 flex items-center justify-between gap-4 border-y border-gray-200 py-3">
      <div className="flex min-w-0 items-start gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="mt-[3px] shrink-0 text-gray-500" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
        <div className="min-w-0">
          {a.deleted ? (
            <p className="truncate text-[14px]">
              <span className="font-medium text-gray-900">{a.name}</span>
              <span className="text-gray-500"> · This file was deleted from Documents</span>
            </p>
          ) : (
            <>
              <p className="truncate text-[14px] font-medium text-gray-900">{a.name}</p>
              <p className="mt-0.5 text-[12px] text-gray-500">
                {['Read', kind, a.folder ? `Saved to Documents → ${a.folder}` : 'Saved to Documents'].filter(Boolean).join(' · ')}
              </p>
            </>
          )}
        </div>
      </div>
      {!a.deleted && a.documentId && (
        <button onClick={() => onOpen(a.documentId!)} className={`shrink-0 ${OUTLINE}`}>Open the report</button>
      )}
    </div>
  )
}

/**
 * THE WORDS THE DOCUMENTS PAGE USES, FOR THE CARD THAT NOW READS THE SAME ROW — Run 6.
 *
 * Deliberately the same strings as `app/documents/page.tsx`. A file attached in a conversation
 * and the same file on the Documents list are one row in `document_index_v`; two vocabularies
 * for it would be two products. Kept short here rather than shared, because the Documents page
 * owns the full vocabulary (eight statuses, seven kinds) and this card shows the subset a scan
 * can return for a file somebody just attached.
 */
const FILE_KIND_LABEL: Record<string, string> = {
  permit: 'Permit', certificate: 'Certificate', program: 'Program', policy: 'Policy',
  record: 'Record', supplier_document: 'Supplier document', other: 'Other',
}
/** The four that ask something of somebody. The rest are information and stay grey. */
const FILE_ATTENTION = new Set(['Needs work', 'Expiring', 'Expired', 'Could not read'])

function FileCard({ file, onRetry }: { file: NonNullable<Exchange['file']>; onRetry: () => void }) {
  return (
    <div className={`mb-3 flex items-start gap-3 rounded-xl border p-3 ${file.unreadable ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <span className="shrink-0 rounded bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">{file.kind}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-gray-900">{file.name}</p>
        {file.unreadable ? (
          <>
            {/* §5.1: the failure is OURS, nothing is asserted about contents nobody read, and a
                way forward is offered. */}
            <p className="mt-1 text-[13px] leading-relaxed text-amber-900">
              {file.failure ?? 'We could not read this one well enough to rely on it. A photo taken square-on in good light would do it, or the original PDF if you have one. It is saved to Documents either way.'}
            </p>
            <button onClick={onRetry} className="mt-2 text-[12.5px] font-medium text-emerald-700 underline">
              Upload a clearer copy
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-gray-600">
              {/*
                *** NO ARTICLE. *** This read "Read as a {classification}", and the
                classification came from the model — "Employee Handbook Addendum", "Insurance
                Certificate", "SDS". Any fixed article is wrong for half of them, and the owner
                saw "Read as a Employee Handbook Addendum" on production. Choosing a/an by first
                letter would still be wrong for "an SDS" (a consonant that reads as a vowel) and
                for "a US EPA permit". A colon needs no article and cannot be wrong.

                The classification is now the KIND — one of seven words the database will accept
                — with the title beside it, because the scan gives both and the list shows both.
              */}
              {file.classification ? <>Read as: <b className="font-medium">{file.classification}</b>{file.title ? <> — {file.title}</> : null}. </> : null}
              Saved to Documents{file.folder ? ` → ${file.folder}` : ''}.
            </p>
            {/* Agency and status, in the Documents page's own words. Amber is attention and
                never information (`DESIGN.md` §2), so only the four statuses that ask something
                of somebody are coloured. */}
            {(file.agency || file.status) && (
              <p className="mt-0.5 text-[12px] text-gray-500">
                {file.agency}
                {file.agency && file.status ? ' · ' : ''}
                {file.status && (
                  <span className={FILE_ATTENTION.has(file.status) ? 'text-[var(--amber)]' : ''}>{file.status}</span>
                )}
              </p>
            )}
            {file.summary && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">{file.summary}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}



function Sheet({ title, lede, children, onClose }: {
  title: string; lede?: string; children: React.ReactNode; onClose: () => void
}) {
  // Escape closes a sheet, as a click outside it already does (Workspace Task 3).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-medium text-gray-900">{title}</h3>
        {lede && <p className="mb-3 mt-1 text-[13px] leading-relaxed text-gray-600">{lede}</p>}
        {children}
      </div>
    </div>
  )
}

function Empty({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center">
      <b className="block text-[15px] font-medium text-gray-900">{title}</b>
      <span className="mt-1 block text-[13px] text-gray-500">{note}</span>
    </div>
  )
}

/** The drawer's second line: the date, then where the items came from, in words. */
function checklistSub(r: ChecklistRow): string {
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`
  const where = r.added > 0 ? `${r.fromConversation} from the conversation · ${r.added} newly checked`
    : r.fromConversation > 0 ? `${n(r.fromConversation, 'item')} from the conversation`
    : n(r.total, 'item')
  return `${friendlyDate(r.created_at)} · ${where}`
}

function hostLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/**
 * "HOW TO DO IT" UNDER AN ITEM — Workspace Task 6, board 9. A grey left rule, the line saying how many
 * sources it was checked against and when, the numbered steps each with its source and label, then the
 * dropped-steps line if any. Printed with the checklist (no `no-print`): Download carries it.
 */
function HowToSteps({ result }: { result: HowToResult }) {
  const nums = stepSourceNumbers(result.steps, urlKey)
  return (
    <div className="mt-3 border-l-2 border-gray-200 pl-3">
      <p className="text-[12px] text-gray-500">{howToHeading(sourceCount(result), result.checked_on)}</p>
      {result.steps.length > 0 && (
        <ol className="mt-1 list-decimal space-y-2 pl-5">
          {result.steps.map((st, k) => (
            <li key={k} className="text-[14px] leading-relaxed text-gray-800">
              {st.text}
              {/* The same one-line link (Stage 2); the label stays outside the cut, so it is never lost. */}
              <OneLineLink n={nums.get(urlKey(st.url))} title={st.title} url={st.url}
                after={st.label === 'official' ? ' · official source' : undefined} />
              {st.label === 'other' && (
                <span className="block text-[12px] text-gray-500">{OTHER_SOURCE_LINE(st.host)}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {result.note && <p className="mt-2 text-[12px] text-gray-600">{result.note}</p>}
      {result.dropped > 0 && <p className="mt-1.5 text-[12px] text-gray-500">{DROPPED_LINE(result.dropped)}</p>}
    </div>
  )
}
