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
 * CLICKING A ROW OPENS THE REPORT (`components/DocumentReport.tsx`), Run 4. Run 3's inline
 * accordion is gone: a report is read, and reading happens in the drawer.
 *
 * THE "WHAT WE'D EXPECT AND DON'T SEE" LINE IS UNDER AGENCY AND NOWHERE ELSE (Run 6). It is a
 * claim about a regulator's usual paperwork, and it is only true of an agency — see `expectedFor`
 * below for why each other grouping would turn it into a different and wrong sentence.
 *
 * WHAT IS STILL NOT HERE, ON PURPOSE: pinned views — not as a disabled control either, because a
 * greyed button that never lights up is a promise the product is not keeping.
 *
 * ---------------------------------------------------------------------------
 * *** AND SINCE `docs/GAPS-PLAN.md` PART A STEP 4b THERE ARE THREE TABS, AND THE TABLE IS ONE OF
 * THEM: Ask a question · Conversations · Documents (N). ***
 *
 * The chat is the door (§1): a person should not have to go to another section to get an answer
 * about their own documents. So a bare `/documents` opens the chat, and **everything that was on
 * this page is inside the Documents tab, unchanged** — the batch banner, the toolbar, the paused
 * note, the error line, the table and the groups, in the same markup and the same words.
 *
 * TWO THINGS ARE DELIBERATELY OUTSIDE THE TAB BODIES. The report drawer, so a `?document=` link
 * can open a report from any tab (the Calendar's rule, and what makes that link work at all); and
 * the two hidden file inputs, because the chat's own uploader and the toolbar's Add files share
 * them.
 *
 * *** THE CHAT'S WORDS ARE NOT IN THIS FILE, AND NOT ON THE BRIEF EITHER. *** `lib/documentsWords.ts`
 * holds them, and `lib/ask/documentsBrief.ts` reads the same file: a page is `'use client'` and a
 * brief reaches `lib/ai.ts`, so no page can import its own brief
 * (`tests/unit/clientImports.test.ts`). One copy, read from both sides.
 * ---------------------------------------------------------------------------
 */

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

import AppLayout from '@/components/AppLayout'
import { Tabs } from '@/components/Tabs'
import { Empty } from '@/components/Empty'
import { ConversationList } from '@/components/ConversationList'
import { WEB_SOURCE, type SourceShape } from '@/components/ReportView'
import type { SourceTarget } from '@/lib/sourceTitle'
import { PLAIN_AS_OF } from '@/lib/summaryWords'
import { AskScreen, useAskConversations } from '@/components/AskScreen'
import { ConversationDrawer } from '@/components/ConversationDrawer'
import { readTopicList, type TopicRow } from '@/lib/topicList'
import { DOCUMENTS_EXAMPLE_QUESTIONS } from '@/config/examples'
import {
  DOCUMENTS_LEDE, DOCUMENTS_COMPOSER_HINT, DOCUMENTS_FIRST_VISIT_BUTTON, DOCUMENTS_ONE_TOPIC_LINE,
  DOCUMENTS_EMPTY_CONVERSATIONS, DOCUMENTS_EMPTY_CONVERSATIONS_TITLE, DOCUMENTS_NOT_SUMMARISED,
  DOCUMENTS_ATTACH_LABEL, DOCUMENTS_LINK_MISSED, documentsThinkingLine,
  DOCUMENTS_NOTHING_YET_BEFORE, DOCUMENTS_NOTHING_YET_LINK, DOCUMENTS_NOTHING_YET_AFTER,
  ADD_FOLDER_HINT,
} from '@/lib/documentsWords'
import { STATUS_WORD, STATUS_GROUP_LABEL, isAmber, statusWord, notesWord } from '@/lib/documentStatus'
import { dayGroup, filesWord, readingProgress, READING_IN_BACKGROUND } from '@/lib/documentList'
import { documentName } from '@/lib/documentName'
import { ACCEPTED_FILE_TYPES, refusalFor, skippedLine, skippedSentences } from '@/lib/acceptedFiles'
import DocumentReport from '@/components/DocumentReport'
import { LIVE_SCAN_MAX } from '@/lib/documentBatch'

import { pausedFromRow, type BillingRow } from '@/lib/billing'
import PausedNote from '@/components/PausedNote'
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
  /** How many open gaps the reading worked out rather than quoted — migration 093, decision 48. */
  inferred_gap_count: number
  display_status: string
}

interface Folder { id: string; name: string; parent_id: string | null; sort_order: number }
interface Site { id: string; name: string; is_primary: boolean }
/** `expected_missing` off each document's CURRENT scan — Run 6. Shape written by the scan. */
interface ExpectedRow { document_id: string; expected_missing: unknown }
/** One upload, however many files were in it — Run 7. `summary` is `BatchSummary`. */
interface BatchRow {
  id: string; status: string; file_count: number; done_count: number; created_at: string
  notified_at: string | null; dismissed_at: string | null
  summary: {
    total: number; read: number; needs_work: number; expiring: number; expired: number
    could_not_read: number
    attention: Array<{ title: string; status: string; reason: string | null }>
    fine: string[]
  } | null
}

type GroupBy = 'date' | 'status' | 'agency' | 'subject' | 'kind' | 'site' | 'folder' | 'none'

/**
 * *** THE THREE TABS — `docs/GAPS-PLAN.md` Part A step 4b, decision 5. ***
 *
 * Ask a question is first and is where a bare `/documents` lands: the chat is the door (§1), and
 * the table a person came to read is one click away and unchanged. The key is also the `?tab=`
 * word, and the pattern is `app/calendar/page.tsx:85`–`:90`, copied — an unknown word falls back
 * to `ask` rather than throwing, because a tab name arrives from links, bookmarks and typing.
 */
type Tab = 'ask' | 'conversations' | 'documents'
const TAB_KEYS: readonly Tab[] = ['ask', 'conversations', 'documents'] as const
const asTab = (v: string | null): Tab =>
  (TAB_KEYS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'ask'

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

// The status words, the group labels and the amber rule live in `lib/documentStatus.ts` — the
// dashboard's readings list reads the same view and must say the same words (28 September 2026).

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
  date: 'Date unknown',
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
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  /**
   * *** THE HINT AN AUDIT SENT — Audits Run 3b, item 5. ***
   *
   * An audit finding of "nothing on file" offers "Add a document", and it passed the finding's
   * title as `?add=`. **This page read no parameter at all** — checked by grepping it for
   * `useSearchParams`: no match — so the link opened Documents and the person was left to remember
   * what they had come for. It is shown above the upload control, as a sentence and not a form
   * field: what to upload is the person's decision, and we do not know their file name.
   */
  const searchParams = useSearchParams()
  const addHint = (searchParams.get('add') ?? '').trim().slice(0, 200)
  /**
   * *** `?add=folder` — WHERE "Add a folder first" LANDS (decision 69, 5 November 2026). ***
   *
   * The Audits chat's offer card sends a person here to add an audit's worth of files before the
   * audit runs. **It cannot open the picker for them, and that is a browser rule, not a gap in
   * the product:** a file dialog opens only inside a real user gesture, so a `.click()` on mount
   * is refused by Chrome and would leave the person looking at a page that promised a dialog.
   *
   * So the link does the two things a link can: it opens the Documents tab, and it puts the
   * folder control one keystroke away — the hint says what to do and the control takes the focus
   * ring. One press of Enter, or one click, and the person is in their own folders.
   */
  const wantsFolder = addHint === 'folder'
  /**
   * *** WHERE THE PERSON CAME FROM, SO THEY CAN GO BACK — Calendar step 10b, ADDITIVE. ***
   *
   * The Calendar's chat has no uploader of its own and will not invent a second one: its
   * "Add a document" is a link here. Without a way back, a person who came from the middle of a
   * conversation has to find it again. The link is drawn only when `?return=` is present.
   *
   * **ONLY AN INTERNAL PATH.** It must start with a single `/` and not `//`, or it is ignored:
   * a `return=` taken at face value is an open redirect, and this one is written into an anchor
   * a person will click.
   */
  const backTo = (() => {
    const raw = (searchParams.get('return') ?? '').trim()
    return /^\/(?!\/)[\w\-/?=&%.]*$/.test(raw) ? raw.slice(0, 200) : null
  })()

  /**
   * *** WHICH TAB, AND IT IS DERIVED BEFORE IT IS READ — decision 13. ***
   *
   * A link carrying `?add=`, `?return=` or `?document=` is a link about a DOCUMENT, and it must
   * land on the table or on a report — never on a chat box the person did not ask for. Four kinds
   * of link already send those words (an audit finding, a Calendar or Workspace report drawer,
   * Company information's fact links, the batch email) and asking four other sections to add a
   * `?tab=` to their links would put this page's layout into their files. So the derivation lives
   * here, exactly as the Calendar derives its own (`app/calendar/page.tsx:169`).
   *
   * Then `?tab=`, and then `ask` — which is what a bare `/documents` and the sidebar both are.
   */
  const linkedDoc = (searchParams.get('document') ?? '').trim().slice(0, 100)
  const tab = asTab(searchParams.get('tab')
    ?? ((addHint || backTo || linkedDoc) ? 'documents' : null))

  const [rows, setRows] = useState<IndexRow[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [expected, setExpected] = useState<ExpectedRow[]>([])
  /** The finished upload nobody has dismissed, and whether anything is still being read. */
  const [banner, setBanner] = useState<BatchRow | null>(null)
  /** The batches still reading — `/api/documents/index` has returned these all along (`working`)
   *  and nothing drew them until decision 70 put the progress on the group header. */
  const [working, setWorking] = useState<BatchRow[]>([])
  const [inFlight, setInFlight] = useState(0)
  /** Agency groups whose expected-and-don't-see line has been opened out. */
  const [expandedExpected, setExpandedExpected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [folderFilter, setFolderFilter] = useState<string>('all')
  /**
   * *** THE DEFAULT IS THE DAY A FILE ARRIVED — decision 70, 5 November 2026. ***
   * It was Status. Status answers "what needs work"; this list is also where somebody stands a
   * minute after dropping a folder in, and grouped by day a batch lands together under one
   * heading with its progress on it (W1). Status is one choice away and unchanged.
   */
  const [groupBy, setGroupBy] = useState<GroupBy>('date')
  const [siteFilter, setSiteFilter] = useState<string>('all')

  const [folderMenuOpen, setFolderMenuOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // THE DRAWER REPLACES RUN 3'S INLINE EXPANSION. An accordion that grows a row was the
  // placeholder while the report had nowhere to live; a report is read, and reading happens in
  // the drawer at 720 (`DESIGN.md` §4), over the page rather than inside the list.
  const [openDoc, setOpenDoc] = useState<string | null>(null)
  /**
   * *** A SOURCE INSIDE A SUMMARY OPENS IN PLACE — decision 63, 4 November 2026. ***
   * True when this reading was opened from a conversation's summary rather than from the list, so
   * the way back says where it goes and the summary underneath is hidden rather than unmounted.
   */
  const [docFromSummary, setDocFromSummary] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
  // Step 18: four more columns on a read this page already made. `paused` is null when access is
  // full, so a paying company's screen is exactly what it was.
  const [billing, setBilling] = useState<BillingRow | null>(null)
  const paused = pausedFromRow(billing)
  /** Set when "Add a newer version" opened the picker, so the next upload links to this one. */
  const [versionOf, setVersionOf] = useState<string | null>(null)
  const [showAll, setShowAll] = useState<Set<string>>(new Set())

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  /**
   * *** THE LIVE PATH COUNTS TOO — decision 70, and it had to, or the bar would be blind to the
   * commonest case. *** Three files or fewer are read in this browser one after another
   * (`LIVE_SCAN_MAX`); `done_count` on the batch row is written only by the SWEEP, so a folder
   * of three would have shown the day group with no bar at all. This is the same two numbers,
   * from the loop that is doing the reading.
   */
  const [liveRead, setLiveRead] = useState<{ done: number; total: number } | null>(null)
  /**
   * WHAT THE LAST PICK SKIPPED, AND WHY — B1, decision 51. Its own state and not `progress`,
   * because `progress` is cleared in the upload's `finally` and this has to stay on the screen
   * after the upload has finished: it is the answer to "where are my other three files". Cleared
   * at the start of the next pick.
   */
  const [skipped, setSkipped] = useState<{ line: string; sentences: string[] } | null>(null)
  /** Documents this browser is scanning right now, so the row says Reading… rather than Queued. */
  const [readingIds, setReadingIds] = useState<Set<string>>(new Set())

  const [sortKey, setSortKey] = useState<'title' | 'kind' | 'site' | 'date' | 'status'>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  /** The conversations of THIS section. `readTopicList` has taken the word since step 1. */
  const [topics, setTopics] = useState<TopicRow[]>([])

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
      setExpected(json.expected ?? [])
      setBanner(json.banner ?? null)
      setWorking((json.working ?? []) as BatchRow[])
      setInFlight(Number(json.in_flight ?? 0))
      setError('')
    } catch {
      setError('We could not load your documents just now.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * *** WHILE ANYTHING IS BEING READ, THE PAGE ASKS AGAIN EVERY TEN SECONDS — Run 7. ***
   *
   * A folder upload hands its files to the background sweep and returns immediately, so without
   * this the rows would say Queued until somebody reloaded. Ten seconds because a scan is 20 to
   * 120 seconds: fast enough that a row changes while you are looking at it, slow enough that
   * thirty files do not cost thirty polls each.
   *
   * *** IT POLLS ON THE DOCUMENTS, NOT ON A BATCH. *** `in_flight` counts every row saying
   * uploaded or reading, whatever put it there — a folder, a re-read asked for in the drawer, a
   * document the sweep recovered. A page that stopped refreshing because no batch was open
   * would leave those rows saying Queued for ever with no way to find out otherwise.
   *
   * It stops the moment nothing is in flight, so an idle Documents page makes no requests at
   * all. `uploading` is excluded because the upload loop reloads on its own between files.
   */
  useEffect(() => {
    if (inFlight === 0 || uploading) return
    const t = setInterval(() => { load() }, 10_000)
    return () => clearInterval(t)
  }, [inFlight, uploading])   // eslint-disable-line react-hooks/exhaustive-deps

  // The drawer's print header carries the company, because a printed compliance page with no
  // company on it is not evidence of anything (`DESIGN.md` §5).
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!p?.company_id) return
      const { data: c } = await supabase
        .from('companies')
        .select('name, trial_ends_at, subscription_status, payment_failed_at, stripe_subscription_id')
        .eq('id', p.company_id).single()
      setCompanyName(c?.name ?? null)
      setBilling(c)
    })()
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * THE CONVERSATIONS, read as the page's own read and handed to the hook — the Calendar's shape
   * (`app/calendar/page.tsx:365`–`:372`). One reader, not two: the hook needs to re-read them
   * while a summary is being written, and the Conversations tab needs the same list.
   */
  const reloadTopics = useCallback(async () => {
    const rows = await readTopicList(supabase, 'documents')
    setTopics(rows)
    return rows
  }, [supabase])
  useEffect(() => { void reloadTopics() }, [reloadTopics])

  const conv = useAskConversations({
    topics, reloadTopics, summarisePath: (id) => `/api/documents/topics/${id}/summarise`,
  })

  /**
   * THE TAB IS IN THE ADDRESS, so a link can open one — `app/calendar/page.tsx:316`–`:321`,
   * copied. `replace`, not `push`: three tabs on one page are not three places a Back button
   * should walk. The default tab DELETES the key rather than writing `?tab=ask`, so the plain
   * `/documents` the sidebar links to stays plain.
   */
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(searchParams.toString())
    if (v === null) p.delete(k); else p.set(k, v)
    router.replace(`/documents${p.toString() ? `?${p}` : ''}`, { scroll: false })
  }
  /**
   * *** WHERE A SOURCE OF OURS OPENS — decision 63 for a summary, decision 67 for an answer. ***
   * One definition, used by the conversation drawer's report AND by the cards under an answer:
   * two copies of a swap is two behaviours waiting to differ.
   */
  const openSourceInPlace = (t: SourceTarget) => {
    if (t.kind === 'document') { setDocFromSummary(true); setOpenDoc(t.id) }
    else if (t.kind === 'audit') window.location.href = `/audits?run=${t.id}`
    // A date lives on the Calendar, which opens it from the address (E2b item 4).
    else if (t.kind === 'date') window.location.href = `/calendar?date=${t.id}`
  }

  const selectTab = (k: Tab) => setParam('tab', k === 'ask' ? null : k)

  /**
   * "+ NEW CONVERSATION" IS A BUTTON, not a link, and the reason is React's own lint rule: it has
   * to CLEAR the open conversation, which is a state change, and an effect that watched the
   * address for it is refused ("Avoid calling setState() directly within an effect") — rightly,
   * because the reset belongs to the press. The Calendar reached the same answer at step 8a.
   */
  const startNewConversation = () => {
    conv.startNewConversation()
    selectTab('ask')
  }

  /**
   * *** `?document=<id>` OPENS THAT REPORT — decision 13, and it closes `PENDING.md` D15. ***
   *
   * Until now this page read `add` and `return` and not `document`, so every source card in a
   * Calendar answer, every fact link in Company information and every `?document=` in the product
   * landed on a list with nothing open. The id is resolved against the rows this page has already
   * read — no second query, and therefore no way to show a document the list does not.
   *
   * *** NOT FINDING IT IS AN ANSWER, NOT A SILENCE *** (decision 30). Deleted, or another
   * company's — which is simply not in `rows`, because RLS decided that and not this page. Both
   * say the same thing and neither says which: telling a stranger that an id EXISTS but is not
   * theirs is the probe §3.6 answers 404 to.
   */
  useEffect(() => {
    if (!linkedDoc || loading) return
    if (rows.some((r) => r.document_id === linkedDoc)) setOpenDoc(linkedDoc)
  }, [linkedDoc, loading, rows])
  const linkMissed = !loading && !!linkedDoc && !rows.some((r) => r.document_id === linkedDoc)

  // ---------------------------------------------------------------------------
  // UPLOAD. One file at a time, and one scan at a time — never in parallel.
  // ---------------------------------------------------------------------------
  /**
   * *** A FEW FILES ARE READ HERE; MANY GO TO THE BACKGROUND — Documents Run 7. ***
   *
   * `LIVE_SCAN_MAX` (3) is the line, and `lib/documentBatch.ts` carries the reason beside it:
   * four is not a performance threshold, it is the number above which this page can no longer
   * honestly say "wait here and it will be done". A browser tab closed at file four of thirty
   * must not lose files five to thirty.
   *
   * BOTH PATHS CREATE A BATCH, and that is the point of the row: the upload is answered once,
   * as a banner here and — for the background path only — as one email, rather than file by
   * file. Somebody who watched three files go in does not need to be told by email that they
   * went in.
   *
   * The upload itself is identical either way. Only what happens after the last row is written
   * differs: the live path scans in this loop and then asks the server to finish the batch; the
   * background path tells the server to start, and the sweep reads them.
   */
  async function onFilesPicked(picked: FileList | null) {
    if (!picked || picked.length === 0) return

    /**
     * *** THE FILES WE CANNOT READ ARE DROPPED HERE, BEFORE ANYTHING IS UPLOADED — B1,
     * decision 51. ***
     *
     * THIS FUNCTION SERVES BOTH PICKERS, AND THE FOLDER ONE HAS NO `accept` AT ALL
     * (`:820`–`:821`: `webkitdirectory` with no `accept`, because a directory picker cannot
     * filter). So before B1 a folder of thirty files containing four `.doc`s uploaded all
     * thirty, wrote thirty rows, and the sweep read twenty-six and told the customer that
     * **"something went wrong at our end"** about the other four. Not silently dropped —
     * uploaded, charged a row, and then blamed on us. That is what this closes.
     *
     * The `accept` on the FILES picker is a hint the dialog may let somebody past (All Files, a
     * typed name, a drag), so this runs for both paths and not only the folder.
     *
     * WHAT THE PERSON IS TOLD: the count by type on one line, then each type's own sentence
     * underneath — the same sentences the chat, HR, the Workspace and the reader use. Never a
     * bare count: "3 files skipped" with nothing after it is the silence §5.1 forbids.
     */
    const all = Array.from(picked)
    const files = all.filter((f) => !refusalFor(f.name, f.type))
    const refused = all.filter((f) => refusalFor(f.name, f.type))
    setSkipped(refused.length
      ? { line: skippedLine(refused.map((f) => f.name)), sentences: skippedSentences(refused.map((f) => f.name)) }
      : null)
    if (!files.length) {
      // Everything in the folder was a type we cannot read. The line above says which and what to
      // do; there is nothing to upload and no batch to open.
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (folderInputRef.current) folderInputRef.current.value = ''
      return
    }

    const live = files.length <= LIVE_SCAN_MAX
    setUploading(true)
    setError('')
    let batchId: string | null = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user?.id ?? '').single()
      const companyId = profile?.company_id
      if (!companyId) throw new Error('No company on this account.')

      // The batch first, so every row written below can name it. Created by the server: the
      // company and the uploader come from the session, never from here.
      const bRes = await fetch('/api/document-batches', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ file_count: files.length }),
      })
      batchId = bRes.ok ? (await bRes.json()).id ?? null : null

      const ids: string[] = []
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
            batch_id: batchId,
            // Set only when "Add a newer version" opened the picker. The match is the person's,
            // not the model's, so it is confirmed from the start.
            ...(versionOf ? { version_of: versionOf, version_confirmed: true } : {}),
          }),
        })
        if (!dbRes.ok) throw new Error(`We could not save ${file.name}.`)
        const { id } = await dbRes.json()
        if (id) ids.push(id)
        await load()
      }

      // *** DECISION 11: THE FILES ARE STORED, AND ONLY THE READING PAUSES. ***
      // Uploading writes no model call, and the owner's rule for step 18 is that no non-model
      // write is gated — a read-only company must still be able to put its records somewhere
      // safe. The rows stay `uploaded`, which this page already draws as **Queued**, and the
      // sweep reads them the day a card is added. Said out loud here rather than letting the
      // scan below come back 402 and look like nothing happened (§5.1: never a silent failure).
      if (paused) {
        setProgress(`${files.length} file${files.length === 1 ? '' : 's'} uploaded and saved — `
          + 'queued to be read. Add a card to start reading them.')
        await load()
        return
      }

      if (!live) {
        // *** THE FILES ARE SAFE THE MOMENT THEY ARE ROWS. *** Nothing else happens in the
        // browser: the rows say Queued, the server is told to start, and the page polls. Close
        // the tab and the sweep still reads them.
        setProgress(`${files.length} files uploaded — reading them in the background`)
        if (batchId) {
          await fetch('/api/document-batches', {
            method: 'PATCH',
            headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ id: batchId, action: 'start', file_count: files.length }),
          })
        }
        await load()
        return
      }

      // *** ONE AFTER ANOTHER. *** Each scan is a model call of 20 to 120 seconds over a whole
      // PDF. Three at once would rate-limit, and the failures would not be the documents'
      // fault. Serial is also what feeds each reading forward into the next — the labels, the
      // fact keys, what the company already holds. A scan that fails does not fail the upload:
      // the file is stored and the row is there, and the reading can be asked for again.
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        setReadingIds((s) => new Set(s).add(id))
        setLiveRead({ done: i, total: ids.length })
        setProgress(`Reading ${i + 1} of ${ids.length}: ${files[i]?.name ?? ''}`)
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
          setLiveRead({ done: i + 1, total: ids.length })
        }
        await load()
      }
      setLiveRead(null)

      // The batch is finished by the server, which computes the summary from the index — the
      // same function the sweep calls, so the banner says the same thing either way. No email:
      // the person is looking at the result.
      if (batchId) {
        await fetch('/api/document-batches', {
          method: 'PATCH',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: batchId, action: 'finish' }),
        })
        await load()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
      setProgress('')
      setVersionOf(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }



  async function dismissBanner(id: string) {
    // Optimistic, then recorded. The row is what stops it coming back on the next device; this
    // is only so the banner does not sit there while the request is in flight.
    setBanner(null)
    await fetch('/api/document-batches', {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, action: 'dismiss' }),
    })
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
    // *** A COMPANY-WIDE DOCUMENT BELONGS TO EVERY SITE — Run 6. ***
    // `entity_id` null is not "no site", it is "all of them": an employee handbook, a corporate
    // policy, an SDS the company holds. Filtering those out left somebody standing at the
    // Hillsboro plant being shown a list with the handbook missing from it, which reads as the
    // handbook not existing. The scan already draws this distinction — `site_scope` is
    // company_wide, site or unknown — and it was only the filter that did not.
    if (siteFilter !== 'all' && r.entity_id !== null && r.entity_id !== siteFilter) return false
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

    const labels = new Map<string, string>()
    for (const r of filtered) {
      if (groupBy === 'date') {
        const g = dayGroup(r.uploaded_at)
        labels.set(g.key, g.label)
        push(g.key, r)
      } else if (groupBy === 'status') push(r.display_status, r)
      else if (groupBy === 'agency') {
        if (r.agencies.length) r.agencies.forEach((a) => push(a, r)); else push('', r)
      } else if (groupBy === 'subject') {
        if (r.subjects.length) r.subjects.forEach((a) => push(a, r)); else push('', r)
      } else if (groupBy === 'kind') push(r.kind ? (KIND_LABEL[r.kind] ?? r.kind) : '', r)
      else if (groupBy === 'site') push(r.site_name ?? '', r)
      else if (groupBy === 'folder') push(r.folder_name ?? '', r)
    }

    const entries = [...map.entries()]
    if (groupBy === 'date') {
      // Newest first: the key is `YYYY-MM-DD` for a day and `YYYY-MM` for a month, and both sort
      // as text — a month's key is a prefix of its days', so October sits after 31 October.
      entries.sort((a, b) => b[0].localeCompare(a[0]))
      return entries.map(([k, v]) => ({ key: k, label: labels.get(k) ?? k, rows: v, files: true }))
    }
    if (groupBy === 'status') {
      entries.sort((a, b) => STATUS_ORDER.indexOf(a[0]) - STATUS_ORDER.indexOf(b[0]))
      return entries.map(([k, v]) => ({ key: k, label: STATUS_GROUP_LABEL[k] ?? k, rows: v, files: false }))
    }
    // Named groups alphabetically; the empty one always last, never dropped.
    entries.sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
    return entries.map(([k, v]) => ({ key: k || '__none__', label: k || EMPTY_GROUP[groupBy], rows: v, files: false }))
  }, [filtered, groupBy])

  /**
   * *** THE NEWEST BATCH THAT IS STILL READING, AS A LINE AND A BAR (decision 70). ***
   * One batch: two folders going at once is not a thing a person does, and two bars on one
   * header would be a design for a case nobody is in. `readingProgress` returns null once the
   * batch is done, which is what takes the line off the screen.
   */
  const batchProgress = useMemo(() => {
    if (liveRead) {
      return {
        done: liveRead.done, total: liveRead.total,
        fraction: liveRead.total ? liveRead.done / liveRead.total : 0,
        line: `${READING_IN_BACKGROUND} · ${liveRead.done} of ${liveRead.total} done`,
      }
    }
    /**
     * *** AND NOTHING IS DRAWN UNLESS SOMETHING IS ACTUALLY IN FLIGHT. ***
     * Photographed on the walk: Cascade's list said "Reading in the background · 0 of 1 done"
     * above a batch created on 3 November that had been `queued` ever since — a sentence in the
     * present tense about a thing that stopped two days ago. `in_flight` is the page's own count
     * of rows saying uploaded or reading, from the same read; the line claims the present only
     * when the present is true (§5.1).
     */
    if (inFlight === 0) return null
    const b = [...working].sort((a, z) => String(z.created_at).localeCompare(String(a.created_at)))[0]
    return b ? readingProgress(b) : null
  }, [working, liveRead, inFlight])

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

  /**
   * WHAT WE'D EXPECT AND DON'T SEE, UNDER EACH AGENCY — Run 6.
   *
   * Every scan has answered this since Run 1 and nothing has ever shown the answer. The prompt
   * asks "for a company like this one, what would usually sit alongside this document and is not
   * in the list" and requires each entry to say it is based on similar companies rather than on
   * a checked requirement — so the line ends by saying exactly that, in the product's own voice
   * rather than trusting the model to keep saying it.
   *
   * *** UNDER AGENCY ONLY, AND THAT IS NOT A LAYOUT DECISION. *** "What we'd expect and don't
   * see" is a claim about a REGULATOR's usual paperwork. Under Kind it would read as a list of
   * documents of that kind; under Folder, as a comment on somebody's filing; under Status, as a
   * claim that a missing document has a status. The sentence is only true of an agency, so it is
   * only shown there.
   *
   * DEDUPLICATED BY WORDING, because seven documents answering to OSHA each propose a hazard
   * communication program and the same sentence four times is noise. Case, spacing and trailing
   * punctuation ignored; the first spelling wins, and the order is the document order so it does
   * not reshuffle between loads.
   *
   * NOTHING WHEN THERE IS NOTHING. An empty state is a message and "nothing found" is a claim
   * (§5.1) — a group whose scans proposed no entries gets no line at all, not a line saying we
   * expected nothing.
   */
  const expectedByDocument = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of expected) {
      const items = Array.isArray(e.expected_missing) ? e.expected_missing : []
      const titles = items
        .map((i) => (i && typeof i === 'object' ? String((i as { title?: unknown }).title ?? '') : String(i ?? '')))
        .map((t) => t.trim())
        .filter(Boolean)
      if (titles.length) map.set(e.document_id, titles)
    }
    return map
  }, [expected])

  const expectedFor = (groupRows: IndexRow[]): string[] => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const r of groupRows) {
      for (const t of expectedByDocument.get(r.document_id) ?? []) {
        const k = t.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (seen.has(k)) continue
        seen.add(k)
        out.push(t)
      }
    }
    return out
  }

  const folderCount = (id: string) => rows.filter((r) => r.folder_id === id).length
  const rowWord = (r: IndexRow) => statusWord(r, readingIds.has(r.document_id))

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  function Row({ r, shade }: { r: IndexRow; shade?: boolean }) {
    const amber = isAmber(r)
    const older = olderVersionCount[r.document_id] ?? 0
    const dateLabel = r.significant_date_kind
      ? (DATE_LABEL[r.significant_date_kind] ?? r.significant_date_kind) : ''
    const meta = [
      r.file_name,
      r.folder_name,
      r.scanned_at ? `read ${fmtShort(r.scanned_at)}` : null,
      older ? `${older} older version${older === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ')
    return (
      /* ALTERNATE ROWS SHADED — decision 71, board 1: white and the page's own grey, so the eye
         keeps its place across four columns without a rule under every row. */
      <div className={`border-b border-gray-100 last:border-b-0 ${shade ? 'bg-white/70' : ''}`}>
        <div onClick={() => setOpenDoc(r.document_id)}
          className="group -mx-3 flex cursor-pointer items-start gap-4 rounded-lg px-3 py-2.5 hover:bg-white">
          <div className="min-w-0 flex-1">
            {/* THE SHORT NAME LEADS — decision 71. One rule, six surfaces (`lib/documentName.ts`);
                the file name is underneath, which is also what tells two near-duplicate readings
                apart when their first clauses are the same. */}
            <p className="truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">{documentName(r.title)}</p>
            <p className="mt-0.5 truncate text-[12px] text-gray-500">{meta}</p>
            {/* WHAT TO DO ABOUT IT, ON THE ROW. An empty state is a message (§5.1) and
                "Not read yet" on its own leaves somebody waiting for something that is not
                coming. These two are the only ways to have it read, so they are named. */}
            {r.document_status === 'held' && (
              <p className="mt-1 text-[12px] text-gray-500">
                Not read yet — press Add files to read new ones, or open this and press
                {' '}<span className="text-gray-700">Read it again</span>.
              </p>
            )}
            {r.display_status === 'could_not_read' && (
              // *** SAID OUT LOUD, ON THE ROW. *** Never a log line, never dropped from a count,
              // and never a claim about contents nobody read — only what we could not do and
              // what would fix it. `CLAUDE.md` §5.1.
              <p className="mt-1 text-[12px] text-[var(--amber)]">
                {r.could_not_read_reason || 'We could not read this clearly enough to rely on.'}{' '}
                {/* *** "Add it again", NOT "Upload a clearer copy" — B1, decision 51. ***
                Since B1 the sentence above this control can be a FORMAT refusal: "Save it as
                .docx or PDF and add it again." Telling that person to upload a clearer copy of a
                file whose sharpness was never the problem is the wrong instruction in the most
                visible place, photographed on the walk. The sentence says what to do; this is
                only the way to do it, and these words are true of every reason. */}
                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                  className="text-gray-600 underline hover:text-gray-900">Add it again</button>
              </p>
            )}
          </div>

          <div className="w-[230px] shrink-0">
            <p className="truncate text-[12px] text-gray-600">{r.agencies.join(' · ') || '—'}</p>
            <p className="mt-0.5 truncate text-[12px] text-gray-400">
              {[r.kind ? (KIND_LABEL[r.kind] ?? r.kind) : null, r.site_name].filter(Boolean).join(' · ') || ' '}
            </p>
          </div>

          {/* *** NO FORM CONTROL ON A ROW — Run 6 addendum, reversing Run 4. ***
              "Move to…" sat here on the reasoning that filing is a list action. What it
              actually produced was a dropdown on every line of a reading surface: the list
              read as a form, and the things somebody scans a list FOR — the title, the
              agency, the status — competed with a widget nobody touches most days. Filing
              lives once, in the drawer's header area. Three columns again. */}

          {/* *** ALIGNMENT, AND IT IS A RULE NOW — decision 59, 4 November 2026. ***
              This column was `text-right`, so the status word sat against the edge and the note
              count beside it would have pushed the word around: a column that drifts is a
              failure, photographed, not a style note. Status words and action links sit in fixed,
              LEFT-aligned columns on every list and report in the app, so they line up down the
              page whatever sits beside them. The width is unchanged; only the alignment and the
              one new cell inside it are. */}
          <div className="flex w-[200px] shrink-0 items-start gap-3 text-left">
            <div className="w-[108px] shrink-0">
              <p className={`text-[13px] ${amber ? 'text-[var(--amber)]' : 'text-gray-500'}`}>{rowWord(r)}</p>
              {r.significant_date && (
                <p className="mt-0.5 text-[12px] text-gray-400">{dateLabel} {fmtDate(r.significant_date)}</p>
              )}
            </div>
            {/* *** THE GUESSES, COUNTED AND NEVER HIDDEN — decision 48. ***
                A document whose gaps are all worked out keeps its normal state; this is how
                somebody knows there is still something in the reading to look at. Grey, because
                it asks nothing of them today. Opening the row opens the reading's Notes. */}
            <p className="w-[64px] shrink-0 text-[12px] text-gray-400">
              {notesWord(r.inferred_gap_count) ?? ''}
            </p>
          </div>
        </div>

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
          {/*
            *** THE LEDE FOLLOWS THE TAB, AND NOTHING A PERSON SEES TODAY CHANGED. ***

            On the Documents tab it is the sentence that has been under this title since Run 6,
            word for word — it describes the table, and the table is what that tab shows. On the
            two new tabs it is the chat's own sentence, because "grouped by what it is, not by
            where you filed it" says nothing about a question box.

            One line that tells the person what they are looking at, rather than one line that is
            true of one third of the page.
          */}
          <p className="mt-1 text-[14px] text-gray-500">
            {tab === 'documents'
              ? 'Everything you hold, read and grouped by what it is — not by where you filed it.'
              : DOCUMENTS_LEDE}
          </p>
        </div>

        {/*
          *** THE TAB ROW — decision 5. Ask a question · Conversations · Documents (N). ***

          `components/Tabs.tsx`, imported and not edited; it owns its own `mb-5 mt-5` and the
          hairline, so this page adds no margin of its own.

          THE COUNT'S RULE IS THE CALENDAR'S, AND IT HAS TWO HALVES: zero is hidden, and so is a
          count nobody has read yet (`loading`). A tab that said "Documents (0)" for half a second
          on every load would be the product stating a fact it had not checked.

          "+ New conversation" is on the two conversation tabs only. On the Documents tab the
          thing a person wants at the right is Add files, and that is already in the toolbar.
        */}
        <Tabs active={tab} onSelect={selectTab}
          tabs={[
            { key: 'ask', label: 'Ask a question' },
            { key: 'conversations', label: 'Conversations' },
            { key: 'documents', label: `Documents${!loading && rows.length > 0 ? ` (${rows.length})` : ''}` },
          ]}
          right={tab === 'documents' ? null : (
            <button onClick={startNewConversation}
              className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span className="hidden sm:inline">New conversation</span>
            </button>
          )} />

        {/* A link that pointed at a document this company no longer holds (decision 30). */}
        {linkMissed && (
          <div className="no-print mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
            {DOCUMENTS_LINK_MISSED}
          </div>
        )}

        {/* ================= ASK A QUESTION — boards 1, 1b, 2 and 3 ================= */}
        {tab === 'ask' && (
          <div>
            {/* The key is `askKey` alone — `app/calendar/page.tsx:588`'s comment says why: keying
                on the conversation id makes the FIRST answer of a new conversation remount the
                view and the answer vanish. */}
            <AskScreen
              key={conv.askKey}
              section="documents"
              endpoints={{ answer: '/api/documents/answer' }}
              onOpenSource={openSourceInPlace}
              words={{
                composerHint: DOCUMENTS_COMPOSER_HINT,
                firstVisitButton: DOCUMENTS_FIRST_VISIT_BUTTON,
                emptyConversations: DOCUMENTS_EMPTY_CONVERSATIONS,
                oneTopicLine: DOCUMENTS_ONE_TOPIC_LINE,
              }}
              examples={DOCUMENTS_EXAMPLE_QUESTIONS}
              companyName={companyName}
              paused={paused}
              topicId={conv.askTopicId}
              initial={conv.askInitial}
              onTopicId={conv.setAskTopicId}
              /* An attached file lands in Documents unfiled, so the list and the count move. */
              onChanged={async () => { await load(); await reloadTopics() }}
              onSummarise={conv.summarise}
              summaryBusy={conv.summaryRunning(conv.askTopicId)}
              /* *** NO `href` HERE, ON PURPOSE. *** This page IS Documents: a link that sent the
                 person to the page they are standing on would be the control doing nothing.
                 `onPick` is the uploader (decision 6), through `lib/chatUpload.ts`. */
              attach={{ label: DOCUMENTS_ATTACH_LABEL, onPick: () => { void load() } }}
              /* DECISION 8, wired at Part A step 5: a checklist made from this chat lives in the
                 Compliance Workspace's Checklists tab, and the ready line links straight to it. */
              canMakeChecklist
              onMakeChecklist={conv.makeChecklist}
              checklistBusy={conv.checklistRunning(conv.askTopicId)}
              checklistReadyId={conv.checklistReady?.topicId === conv.askTopicId ? conv.checklistReady.id : null}
              thinkingLine={documentsThinkingLine}
              /* No offers (decision: three different writers), so nothing under an answer. */
              afterAnswer={undefined}
            />
            {conv.notice && (
              <div className="no-print mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                {conv.notice}
                <button onClick={() => conv.setNotice(null)} className="ml-3 underline">Dismiss</button>
              </div>
            )}

            {/*
              *** BOARD 1b — NOTHING ON FILE YET (decision 7). ***

              One line under the box, and only while the company holds nothing. It waits for
              `loading` to finish: a line that said "nothing on file" before the read came back
              would be a claim about an empty list nobody had looked at (`CLAUDE.md` §5.1, and
              `CLAUDE.md` §9a — an empty state is a claim and it has to be true).

              "Documents tab" switches tabs rather than linking, because the person is already on
              the page; a link to `/documents?tab=documents` would reload the whole thing.
            */}
            {!loading && rows.length === 0 && (
              <p className="no-print mt-4 text-[13px] text-gray-500">
                {DOCUMENTS_NOTHING_YET_BEFORE}
                <button onClick={() => selectTab('documents')} className="underline hover:text-gray-900">
                  {DOCUMENTS_NOTHING_YET_LINK}
                </button>
                {DOCUMENTS_NOTHING_YET_AFTER}
              </p>
            )}
          </div>
        )}

        {/* ================= CONVERSATIONS — HR's board 9, its list and its drawer ================= */}
        {tab === 'conversations' && (
          <div className="pt-1">
            {topics.length === 0 ? (
              <Empty title={DOCUMENTS_EMPTY_CONVERSATIONS_TITLE} note={DOCUMENTS_EMPTY_CONVERSATIONS} />
            ) : (
              <ConversationList topics={topics}
                running={(t, kind) => kind === 'summary' && conv.summaryRunning(t.id)}
                onOpen={conv.setConvDrawer} />
            )}
          </div>
        )}

        {/* ================= DOCUMENTS — today's page, with nothing moved inside it ================= */}
        {tab === 'documents' && (<>

        {/*
          *** THE "WE'VE READ YOUR n DOCUMENTS" BANNER IS GONE — decision 70, 5 November 2026. ***

          It was a receipt in a box above the list: what the batch came to, its counts, the titles
          behind them. Everything it said is in the list itself — the rows it names are the rows
          under it, each with its own status word — and while a batch was still READING it said
          nothing at all, which is the eleven minutes of silence W1 records. The group header
          says it now, in place: "Today · 8 files" with the progress line under it.

          `banner` is still read (the route returns it) and still dismissed, because the row is
          what stops the EMAIL being sent twice; nothing draws it.
        */}

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
              <option value="date">Date added</option>
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
            {backTo && (
              <a href={backTo} className="text-[12px] text-[var(--green-ink)] underline hover:no-underline">
                ← Back to where you were
              </a>
            )}
            {addHint && !wantsFolder && (
              <span className="max-w-[300px] truncate text-[12px] text-gray-600" title={addHint}>
                Add: {addHint}
              </span>
            )}
            {wantsFolder && <span className="text-[12px] text-gray-600">{ADD_FOLDER_HINT}</span>}
            {progress && <span className="text-[12px] text-gray-500">{progress}</span>}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="rounded-md bg-[var(--green)] px-5 py-2.5 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50">
              {uploading ? 'Working…' : 'Add files'}
            </button>
            <button onClick={() => folderInputRef.current?.click()} disabled={uploading}
              // `autoFocus` only when the person was SENT here for a folder: focus that moves on
              // an ordinary visit is focus taken from whatever they were doing.
              autoFocus={wantsFolder}
              className={`text-[14px] underline disabled:text-gray-300 ${wantsFolder
                ? 'rounded-sm text-[var(--green-ink)] outline outline-2 outline-offset-4 outline-[var(--green)]'
                : 'text-gray-600 hover:text-gray-900'}`}>
              Add a folder
            </button>
          </div>
        </div>

        {/* The upload buttons above are deliberately NOT disabled: storing a file calls no model,
            and decision 11 pauses spending, not the product. The note says what will happen. */}
        <PausedNote banner={paused} />

        {error && <p className="mt-4 text-[13px] text-[var(--amber)]">{error}</p>}

        {/* WHAT WAS SKIPPED, AND WHAT TO DO ABOUT IT (B1). A line and then the sentences — not a
            tooltip: a sentence somebody has to hover to find is a sentence they will not read.
            Dismissable, because once they have saved the file as .docx the notice is in the way. */}
        {skipped && (
          <div className="mt-4 rounded-md border border-[var(--amber)]/40 bg-amber-50/50 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-gray-900">{skipped.line}</p>
                {skipped.sentences.map((t) => (
                  <p key={t} className="mt-1 text-[13px] text-gray-700">{t}</p>
                ))}
              </div>
              <button onClick={() => setSkipped(null)} aria-label="Dismiss"
                className="shrink-0 text-[13px] text-gray-400 hover:text-gray-700">Dismiss</button>
            </div>
          </div>
        )}

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
                    <button onClick={() => setOpenDoc(r.document_id)} className="text-left hover:text-[var(--green)]">{documentName(r.title)}</button>
                    <span className="block text-[12px] text-gray-500">{r.file_name}</span>
                  </td>
                  <td className="py-2.5 text-[12px] text-gray-600">{r.kind ? (KIND_LABEL[r.kind] ?? r.kind) : '—'}</td>
                  <td className="py-2.5 text-[12px] text-gray-600">{r.site_name ?? '—'}</td>
                  <td className="py-2.5 text-[12px] text-gray-600">{fmtDate(r.significant_date) || '—'}</td>
                  <td className={`py-2.5 text-[13px] ${isAmber(r) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                    {rowWord(r)}
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
              // Only under Agency, and only when the scans actually proposed something.
              const missing = groupBy === 'agency' ? expectedFor(g.rows) : []
              return (
                <section key={g.key} className="mb-7">
                  {/* *** A HEADING THAT NAMES SOMETHING IS DARKER THAN ONE THAT STATES SOMETHING. ***
                      Grouped by Agency, Subject, Kind, Site or Folder, the heading is the NAME of
                      the thing the rows belong to — Oregon DEQ, Permits, Portland — and you read
                      down from it. Grouped by Status it is a state, and every row underneath
                      repeats it in its own right-hand column; a dark heading there would be the
                      same word twice, louder the first time. Same 12px uppercase either way: this
                      is weight, not a second heading style. `DESIGN.md` §4. */}
                  <h2 className={`mb-1.5 text-[12px] font-medium uppercase tracking-wide ${
                    groupBy === 'status' ? 'text-gray-400' : 'text-gray-700'}`}>
                    {g.label}{' '}
                    <span className="ml-1 font-normal text-gray-300">
                      {g.files ? `· ${filesWord(g.rows.length)}` : g.rows.length}
                    </span>
                  </h2>
                  {/* *** THE BATCH'S PROGRESS, ON THE DAY IT LANDED — decision 70, W1. ***
                      Only on the newest day group, and only while a batch of that day is still
                      reading: a bar and a line that says how many are done and roughly how long
                      is left. The arithmetic is `lib/documentList.ts`, where it is tested. */}
                  {g.key === groups[0]?.key && batchProgress && (
                    <div className="no-print mb-2.5">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-[var(--green)] transition-all"
                          style={{ width: `${Math.round(batchProgress.fraction * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-[12px] text-gray-500">{batchProgress.line}</p>
                    </div>
                  )}
                  {missing.length > 0 && (() => {
                    // The amber wash, not amber text: this asks for attention without claiming
                    // anything is wrong. Amber is attention and never information (`DESIGN.md`
                    // §2), and the last sentence is the whole reason this is allowed to exist —
                    // it is what similar companies hold, not a requirement anybody checked.
                    //
                    // *** THREE, THEN "AND N MORE" — Run 7. *** Run 6 shipped this as every
                    // entry joined by semicolons and measured the result: sixteen items under
                    // Oregon DEQ, from three documents, as one paragraph above the list. A line
                    // that is five lines long is not a line, and it pushed the documents — the
                    // thing the page is for — below the fold. Three is what fits on one line at
                    // 900 and is the count the eye takes in without reading.
                    //
                    // EXPANDABLE IN PLACE, and the count is always shown: a truncation that
                    // hides how much it truncated is the product deciding what you get to see.
                    const open = expandedExpected.has(g.key)
                    const shown = open ? missing : missing.slice(0, 3)
                    const rest = missing.length - shown.length
                    return (
                      <p className="mb-2 rounded-lg bg-[var(--amber-wash)] px-3 py-2 text-[12px] leading-relaxed text-gray-700">
                        What we&rsquo;d expect and don&rsquo;t see: {shown.join('; ')}
                        {rest > 0 ? (
                          <>
                            {' '}
                            <button onClick={() => setExpandedExpected((prev) => new Set(prev).add(g.key))}
                              className="underline hover:text-gray-900">and {rest} more</button>
                          </>
                        ) : '.'}
                        {open && missing.length > 3 && (
                          <>
                            {' '}
                            <button onClick={() => setExpandedExpected((prev) => {
                              const n = new Set(prev); n.delete(g.key); return n
                            })} className="underline hover:text-gray-900">show fewer</button>
                          </>
                        )}
                        {' '}
                        <span className="text-gray-500">
                          Based on what similar companies hold, not on a checked requirement.
                        </span>
                      </p>
                    )
                  })()}
                  <div>{visible.map((r, i) => <Row key={`${g.key}-${r.document_id}`} r={r} shade={i % 2 === 1} />)}</div>
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

        </>)}
      </div>

      {/* z-[45] scrim, then the drawer at z-50 — the order AppLayout's sticky header needs. */}
      {openDoc && (
        <>
          <div className="no-print fixed inset-0 z-[45] bg-gray-900/30"
            onClick={() => { setOpenDoc(null); setDocFromSummary(false) }} />
          <DocumentReport
            paused={paused}
            documentId={openDoc}
            companyName={companyName}
            onClose={() => { setOpenDoc(null); setDocFromSummary(false) }}
            topLine={docFromSummary ? (
              <button onClick={() => { setOpenDoc(null); setDocFromSummary(false) }}
                className="cursor-pointer text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">
                ← Back to the summary
              </button>
            ) : undefined}
            onChanged={load}
            // Filing moved off the row and into the drawer (Run 6 addendum). The list and the
            // action both already live here, so the drawer is handed them rather than fetching
            // a list this page is holding.
            folders={folders}
            onMove={moveTo}
            onPickFile={(v) => { setVersionOf(v ?? null); fileInputRef.current?.click() }}
          />
        </>
      )}

      {/* ================= THE CONVERSATION DRAWER — `components/ConversationDrawer.tsx` =================
          The shared one, with Delete, and the workspace's report shape (`WEB_SOURCE`): a Documents
          answer's sources are web pages and passage quotes, which is what that shape draws. HR
          passes its own because its report has handbook headings; this section has none. */}
      {conv.convDrawer && (
        /* Hidden, not unmounted, while a reading from one of its sources is over it: closing that
           reading returns to the summary where it was (decision 63). */
        <div className={docFromSummary && openDoc ? 'hidden' : ''}>
        <ConversationDrawer
          topic={conv.convDrawer}
          companyName={companyName}
          paused={paused}
          notSummarisedLine={DOCUMENTS_NOT_SUMMARISED}
          sourceShape={WEB_SOURCE as unknown as SourceShape<{ n: number; title: string; url: string }>}
          /* E2b item 6: the Workspace's as-of line mentions tariffs and stays the Workspace's;
             these three get the plain one, the same line their stored plain text now carries. */
          reportWords={{ asOf: PLAIN_AS_OF }}
          factsLine={null}
          onClose={() => conv.setConvDrawer(null)}
          onOpen={async (t) => { if (await conv.openConversation(t)) selectTab('ask') }}
          onSummarise={conv.summarise}
          summaryRunning={conv.summaryRunning(conv.convDrawer.id)}
          onDeleted={() => { conv.setConvDrawer(null); void reloadTopics() }}
          onOpenSource={openSourceInPlace}
        />
        </div>
      )}
    </AppLayout>
  )
}
