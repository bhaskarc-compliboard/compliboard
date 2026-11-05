/**
 * THE AUDITS PAGE — Audits Run 3, Boards E and E2.
 *
 * *** IT REPLACES THE OLD PAGE ENTIRELY, AND KEEPS ONE THING FROM IT: THE BOX. ***
 * The old page asked to be audited against a standard it would then enumerate from nothing — the
 * known-bad mode (CLAUDE.md §3.3), and the reason the whole engine is retired in this commit. What
 * survives is its white field with three grey example lines drawn as an overlay that clears on
 * typing, because that control taught people to type a sentence and it works.
 *
 * *** NO MODEL CALL ON THIS PAGE, INCLUDING IN THE BOX. *** The sentence is matched in code against
 * the agency labels the company's own readings produced. That is the architecture, not an economy:
 * "what's missing is a database query and never an AI guess" (§1), and a box that sent a sentence to
 * a model to find out which agency it meant would be guessing at something the database knows.
 *
 * *** THE ONLY STATUS WORDS ARE THE FOUR, PLUS THE DOCUMENT STATUSES DOCUMENTS ALREADY USES. ***
 * Nothing on this page says compliant, satisfied, met or all clear, and nothing on it names what does
 * the reading (§5.0). The strongest thing it says about a document is that it is on file.
 */
'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import AppLayout from '@/components/AppLayout'
import AuditReport from '@/components/AuditReport'
import AuditBinder from '@/components/AuditBinder'
import { runName, checklistTitle as sharedChecklistTitle } from '@/lib/auditView'
import DocumentReport from '@/components/DocumentReport'
import { authHeaders, createClient } from '@/lib/supabase'

import { pausedFromRow, type BillingRow, type Banner } from '@/lib/billing'
import PausedNote from '@/components/PausedNote'
import { Tabs } from '@/components/Tabs'
import { Empty } from '@/components/Empty'
import { ConversationList } from '@/components/ConversationList'
import { ConversationDrawer } from '@/components/ConversationDrawer'
import { WEB_SOURCE, type SourceShape } from '@/components/ReportView'
import { PLAIN_AS_OF } from '@/lib/summaryWords'
import { AskScreen, useAskConversations, type Exchange } from '@/components/AskScreen'
import { readTopicList, type TopicRow } from '@/lib/topicList'
import { AUDITS_EXAMPLE_QUESTIONS } from '@/config/examples'
import {
  AUDITS_LEDE, AUDITS_COMPOSER_HINT, AUDITS_FIRST_VISIT_BUTTON, AUDITS_ONE_TOPIC_LINE,
  AUDITS_EMPTY_CONVERSATIONS, AUDITS_EMPTY_CONVERSATIONS_TITLE, AUDITS_NOT_SUMMARISED,
  AUDITS_ATTACH_LABEL, auditsThinkingLine, runAuditCardWords,
  auditsCommandAgencyLine, auditsCommandTemplateLine,
  WHICH_AGENCY, NO_AGENCIES, ATTACH_THE_FILE, COULD_NOT_AUDIT, AUDITS_COMMAND_TAB_LINK,
} from '@/lib/auditsWords'
import { checkRunAuditOffer } from '@/lib/auditsOffer'
import { readCommand } from '@/lib/auditsCommand'
import type { Offer } from '@/lib/ask/offers'
/* ── the shapes the one read returns ──────────────────────────────────────── */
interface Doc {
  document_id: string; title: string; file_name: string; kind: string | null
  agencies: string[] | null; subjects: string[] | null; site_name: string | null
  doc_date: string | null; significant_date: string | null; significant_date_kind: string | null
  display_status: string; scan_id: string | null; could_not_read_reason: string | null
  open_gap_count: number | null
}
interface Deadline {
  document_id: string; title: string; due_on: string | null; recurs: boolean; source_line: string | null
}
interface Section {
  id: string; run_id: string; ordinal: number; title: string; status: string
  started_at: string | null; finished_at: string | null; could_not_complete_reason: string | null
}
interface Finding {
  id: string; run_id: string; section_id: string; kind: string; word: string | null
  title: string; document_id: string | null
}
interface RunSummary {
  total: number; needs_person?: number; nothing_on_file: number; stale: number; on_file: number
  /** The fifth word (decision 47). Optional: a run summarised before 4 November has no key. */
  on_file_gaps?: number
  not_a_document_question: number; contradictions: number; expected: number
  sections: number; sections_done: number; could_not_complete: number
  carried: number; closed: number; agencies: string[]; note: string | null
}
interface Run {
  id: string; kind: string; scope: string | null; agency_label: string | null; status: string
  section_count: number; done_count: number; readings_as_of: string | null; created_at: string
  started_at: string | null; finished_at: string | null; summary: RunSummary | null
  notified_at: string | null; dismissed_at: string | null; previous_run_id: string | null
  template_document_id: string | null
  /** The checklist's own sections and lines, for the By template row's "16 lines in 3 sections". */
  template_lines: unknown
  closed_count: number; estimate: string | null
}
interface Index {
  today: string
  agencies: string[]
  subjects: string[]
  sites: Array<{ id: string; name: string }>
  folders: Array<{ id: string; name: string }>
  counts: { read: number; held_unread: number; agencies: number }
  documents: Doc[]
  unplaced: Doc[]
  deadlines: Deadline[]
  expected: Array<{ document_id: string; titles: string[] }>
  sections: Section[]
  open_findings: Finding[]
  last_done: Record<string, string>
  active: Record<string, string>
  runs: Run[]
  banners: string[]
  estimate: string
}

/* ── the vocabulary, and it is short on purpose ───────────────────────────── */
const WORD: Record<string, string> = {
  nothing_on_file: 'nothing on file',
  on_file_gaps: 'on file, gaps found',
  stale: 'out of date',
  on_file: 'on file',
  not_a_document_question: 'not a document question',
}
/** The plural the counts line uses, which is not always the word itself. */
/**
 * THE COUNTS, AS THE CLAUSES OF A SENTENCE — Audits Run 7b, item 3.
 *
 * What stood here was `WORD_COUNT`, which read as a list because it was built for one:
 * "4 nothing on file · 2 out of date". The owner's review of the live report said the two lines
 * under an open agency read as lists, and they did. These are the same numbers written as something
 * a person says out loud, so they can be joined with commas and an "and". `WORD_COUNT` is gone
 * rather than left beside this one: two vocabularies for the same five numbers is how a screen ends
 * up saying it both ways.
 *
 * **The plural is per clause and it has to be right at one**, which is the whole reason this is a
 * function and not a template string: "1 things with nothing on file" is the kind of mistake that
 * makes a reader stop trusting everything around it.
 */
const WORD_CLAUSE: Record<string, (n: number) => string> = {
  nothing_on_file: (n) => `${n} thing${n === 1 ? '' : 's'} with nothing on file`,
  on_file_gaps: (n) => `${n} thing${n === 1 ? '' : 's'} on file with gaps found`,
  contradiction: (n) => `${n} disagreement${n === 1 ? '' : 's'} between documents`,
  not_a_document_question: (n) => `${n} thing${n === 1 ? '' : 's'} no document can answer`,
  on_file: (n) => `${n} thing${n === 1 ? '' : 's'} on file`,
  stale: (n) => `${n} thing${n === 1 ? '' : 's'} out of date`,
}
/** "a, b, and c" — the Oxford comma kept, because these clauses carry commas of their own. */
function joinClauses(parts: React.ReactNode[]): React.ReactNode[] {
  if (parts.length <= 1) return parts
  const out: React.ReactNode[] = []
  parts.forEach((p, i) => {
    out.push(p)
    if (i < parts.length - 2) out.push(', ')
    else if (i === parts.length - 2) out.push(parts.length === 2 ? ' and ' : ', and ')
  })
  return out
}
/** Documents' own statuses, unchanged — this page must not invent a second vocabulary for them. */
const DOC_STATUS: Record<string, string> = {
  needs_work: 'Needs work', expiring: 'Expiring', expired: 'Expired',
  could_not_read: 'Could not read', not_yet_read: 'Not read yet',
  current: 'Current', recorded: 'Recorded', on_file: 'On file',
}
const AMBER_DOC = new Set(['needs_work', 'expiring', 'expired', 'could_not_read'])

/**
 * *** A TITLE IS TEXT, NOT A LINK-SHAPED OBJECT — the owner's review, 30 September. ***
 *
 * Every document title on the first build was a full-width underlined link. Twelve of them down a
 * page is twelve blue-ish bars, and the eye reads the underline before the words: the list stopped
 * looking like a list of documents and started looking like a list of links. A title is the content.
 * So it is plain dark text, ONE line, cut with an ellipsis, the whole title in `title=` for a hover,
 * and the underline arrives only when the pointer is on it.
 *
 * `cursor-pointer` is explicit because a `<button>` defaults to an arrow — the same fix Company
 * information needed in Task 0 commit 4, and the same reason.
 */
const TITLE_LINE =
  'block w-full truncate text-left text-[13px] text-gray-800 cursor-pointer ' +
  'hover:underline hover:text-gray-900'
/** An agency line: clickable across its whole width, with the wash and the pointer to say so. */
const AGENCY_ROW =
  'flex w-full items-start gap-3 py-3 text-left cursor-pointer rounded-md ' +
  'hover:bg-gray-50/70 transition-colors'

/** The two group headings on the Audits tab — board 4's small uppercase label. */
const GROUP_LABEL = 'mt-6 mb-0.5 text-[11px] uppercase tracking-wide text-gray-400'

const ACTION_GREEN =
  'cursor-pointer text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)] ' +
  'disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline'
const ACTION_QUIET = 'cursor-pointer text-[13px] text-gray-500 hover:text-gray-800'
// `ACTION_PRIMARY` went with the box at step 6b: the Ask tab's own Send button is the shared
// screen's, and nothing else on this page is a filled green button.
const controlClass =
  'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[14px] text-gray-700 hover:border-gray-300'

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

/**
 * *** THE WORDS MOVED TO `lib/auditView.ts` AT DASHBOARD STEP 6. *** `checklistTitle` and the
 * expression that named a run in the Past audits list both live there now, because the Dashboard's
 * "Recent audits" shows the same runs and a second copy is a second answer. This page looks the
 * document up — it holds the list already — and hands the title over; nothing else changed.
 */
const titleOfTemplate = (run: { template_document_id: string | null }, idx: Index): string | null =>
  run.template_document_id
    ? idx.documents.find((x) => x.document_id === run.template_document_id)?.title ?? null
    : null
/** Kept at this page's own two call sites (the running and the landed banner), now one line. */
const checklistTitle = (run: { template_document_id: string | null; scope: string | null }, idx: Index): string =>
  sharedChecklistTitle(run, titleOfTemplate(run, idx))
/**
 * The run's name as the DASHBOARD writes it — "Against Fire marshal checklist". It was the Past
 * audits row's own line until step 6b; it is now the hover on a By template row, whose visible
 * text is the file name (board 4's words). Both pages still name a run with one function, which
 * is what `tests/unit/dashboardView.test.ts` holds and what `lib/auditView.ts` exists for.
 */
const runTitle = (run: Run, idx: Index): string => runName(run, titleOfTemplate(run, idx))

const fmt = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso))
  return Number.isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
/**
 * *** THE THREE TABS — `docs/GAPS-PLAN.md` Part A step 6b, decision 31. ***
 *
 * Ask a question · Conversations · Audits (N). The first two are the shared screen the Calendar
 * and Documents already use; the third is the page's old two tabs folded into one, with the box
 * taken out of it (decision 32). The key is also the `?tab=` word, and the pattern is
 * `app/documents/page.tsx:139`–`:141`, copied.
 */
/**
 * *** FOUR TABS SINCE DECISION 56, 4 November 2026. ***
 * Ask a question · Conversations · Agency audits · Auditor checklists. `audits` keeps its key so
 * every bookmark and every `?tab=audits` lands where it did — it is only the LABEL that becomes
 * "Agency audits" — and `checklists` is the new one, which board 3 draws.
 */
type Tab = 'ask' | 'conversations' | 'audits' | 'checklists'
const TAB_KEYS: readonly Tab[] = ['ask', 'conversations', 'audits', 'checklists'] as const

const daysUntil = (iso: string, today: string) =>
  Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400_000)

export default function AuditsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[14px] text-gray-400">Loading…</div>}>
      <Audits />
    </Suspense>
  )
}

function Audits() {
  const router = useRouter()
  const params = useSearchParams()

  /**
   * *** THE DRAWER AND THE TAB ARE STATE, SEEDED FROM THE ADDRESS — the 20 October hotfix. ***
   *
   * They were derived from `useSearchParams()` directly: `openRun = params.get('run')`. That is the
   * right shape and it did not work, and the way it failed is worth keeping.
   *
   * *** A REPORT OPENED FROM THE ADDRESS COULD NOT BE CLOSED ON PRODUCTION, AND CLOSED FINE IN DEV. ***
   * The X called `setParam('run', null)`, which removed the only parameter and asked the router for
   * `/audits`. **`router.replace` to the bare path of this prerendered route does not navigate**:
   * `useSearchParams()` kept returning `run=…`, so `openRun` was still the id and the drawer
   * re-rendered open. Measured on a production build of this tree on 20 October:
   *
   *   /audits?run=<id>           → X → address UNCHANGED, drawer still open   (the bug)
   *   /audits?tab=past&run=<id>  → X → /audits?tab=past, drawer closed         (a parameter remained)
   *   /calendar?tab=calendar&date=<id> → X → /calendar?tab=calendar, closed    (never hits it)
   *
   * The Calendar escaped it by accident: `closeDate` keeps `?tab=`, so its query is never empty.
   * A trailing `?` was tried and changes nothing — the router refuses the navigation either way.
   * `next dev` renders on demand and does not reproduce it at all, which is why every walk of this
   * page before today passed (`node_modules/next/dist/docs/.../use-search-params.md`: "In
   * development, routes are rendered on-demand…").
   *
   * *** AND THE TAB WAS BROKEN BY THE SAME LINE, UNNOTICED. *** "Where you stand" from
   * `/audits?tab=past` removes the only parameter too: on the same build the address did not change
   * and the page stayed on Past audits. One cause, two controls; only the drawer was reported.
   *
   * So the address is no longer what the page reads from render to render. It seeds this state,
   * and an effect follows it **only when it actually changes** — a link from the Dashboard, a
   * reload, Back — never on a re-render, which is what let a closed drawer come back.
   */
  const runParam = params.get('run')
  /**
   * *** THE DERIVED TAB — `docs/GAPS-PLAN.md` Part A step 6b, decision 31. ***
   *
   * Three tabs now, and `ask` is where a bare `/audits` lands: the chat is the door (§1). Two
   * rules keep every link that exists today landing where it did, and they were read out of the
   * repository rather than remembered (step 6's map):
   *
   *   · **`?run=`** — the Dashboard's Recent audits rows, the audit email (`lib/auditNotify.ts`),
   *     `components/AuditReport.tsx`'s three links and the bakeoff script all send it and nothing
   *     else. The drawer is mounted outside the tabs and opens either way; the tab BEHIND it has
   *     to be the one the report belongs to, so `?run=` lands on Audits.
   *   · **`?tab=past` and `?tab=stand`** — written and read by this page alone (proved by
   *     grepping `app lib components scripts tests`), so the only carrier is an old bookmark.
   *     Both fold into the one Audits tab, which is what they both became.
   *
   * Anything else, including nothing, is `ask`.
   */
  const rawTab = params.get('tab')
  const tabParam: Tab =
    rawTab === 'past' || rawTab === 'stand' ? 'audits'
    : TAB_KEYS.includes((rawTab ?? '') as Tab) ? (rawTab as Tab)
    : runParam ? 'audits'
    : 'ask'
  /**
   * *** THE BINDER IS A MODE OF THE REPORT PAGE, AT ITS OWN ADDRESS — Part C, decision 61. ***
   *
   * `/audits?run=<id>&binder=1`, and a parameter rather than a state for three reasons: the
   * checklist card and the Calendar's drawer both LINK to it from outside this component; a person
   * who reloads while the dialog is open gets the binder back and not the report; and the hotfix
   * above is satisfied by construction — `binder` is never the only parameter, because it is
   * meaningless without `run`, so the empty-query case it records cannot arise from closing it.
   *
   * **The derived-tab rule is untouched**: `?run=` still decides the tab, and `binder` says
   * nothing about which tab is behind the page.
   */
  const binderParam = params.get('binder') === '1'
  const [openRun, setOpenRun] = useState<string | null>(runParam)
  const [binder, setBinder] = useState<boolean>(binderParam)
  const [tab, setTab] = useState<Tab>(tabParam)
  useEffect(() => { setOpenRun(runParam) }, [runParam])
  useEffect(() => { setBinder(binderParam) }, [binderParam])
  useEffect(() => { setTab(tabParam) }, [tabParam])
  /**
   * *** AND THE TAB BEHIND A TEMPLATE RUN'S PAGE IS THE CHECKLISTS TAB — decision 56. ***
   *
   * `?run=` lands on `audits` above, because that rule was written when there was one audits tab
   * and it must go on holding for every link that exists. A TEMPLATE run belongs behind the
   * Auditor checklists tab, so that closing the report returns to the card it was opened from.
   *
   * It cannot be decided from the address: the run's kind is in the index, which arrives after
   * the first render. So this corrects the tab once the index lands, and only when the person has
   * not chosen a tab themselves since — `movedForRun` is what keeps it from fighting a click.
   */
  const movedForRun = useRef<string | null>(null)

  /**
   * The address as it stands, including a change this page made that the router did not take.
   * Without it, `new URLSearchParams(params.toString())` would read a stale `run=` back out and
   * the next tab click would resurrect the report a person had just closed.
   */
  const searchRef = useRef(params.toString())
  useEffect(() => { searchRef.current = params.toString() }, [params])

  const [idx, setIdx] = useState<Index | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [choices, setChoices] = useState<string[] | null>(null)
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({})
  const [drawerWord, setDrawerWord] = useState<string | null>(null)
  /**
   * *** THE DOCUMENT'S OWN REPORT, HERE, NOT A STUB THAT SENDS PEOPLE AWAY — Run 3b, item 1. ***
   * The first build opened a panel saying "open it in Documents for its full reading", which is the
   * product telling somebody to go and do the thing themselves. `DocumentReport` is one component
   * and it mounts here as readily as it mounts on Documents. `fromAudit` remembers which audit to
   * go back to, so Back returns to the report rather than closing everything.
   */
  const [openDoc, setOpenDoc] = useState<string | null>(null)
  const [fromAudit, setFromAudit] = useState<string | null>(null)
  /**
   * Where a document's reading was opened FROM, for the one line that goes back. A third origin
   * arrived with decision 63 — a source inside a summary — and the audit's own `fromAudit` cannot
   * say it: that one carries a run id and a summary has none.
   */
  const [docFrom, setDocFrom] = useState<'audit' | 'summary' | null>(null)
  const [site, setSite] = useState('all')
  const [groupBy, setGroupBy] = useState<'agency' | 'subject' | 'site'>('agency')
  /** Agency rows whose "Earlier audits" list has been opened out. */
  const [openEarlier, setOpenEarlier] = useState<Record<string, boolean>>({})
  /**
   * *** WHAT A HANDLED COMMAND LEAVES ON THE ASK TAB — decision 39. ***
   * A command writes no turn and no topic, so the thread cannot hold it. It is one notice above
   * the composer: the words the person typed, and the one line saying what started. `choices` is
   * the other half — an audit word with no agency in it shows the agency names, which is what the
   * box has always done when it could not match (`:467`–`:468` before this step).
   */
  const [commandLine, setCommandLine] = useState<{ asked: string; said: string } | null>(null)
  /**
   * The file the paperclip put in on this turn. The OFFER's press needs it — a `run_audit` offer
   * about an attached file carries a marker and no id (decision 45), so the code supplies which
   * file it meant, and this is where the page holds it.
   */
  const [attached, setAttached] = useState<{ id: string; name: string } | null>(null)
  const [topics, setTopics] = useState<TopicRow[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/audits/index', { headers: await authHeaders() })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? 'We could not read your audits just now.'); return }
      setError(null)
      setIdx(json as Index)
    } catch {
      setError('We could not read your audits just now.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** Decision 56's correction, once per run id, once the index can answer what kind it is. */
  useEffect(() => {
    if (!openRun || !idx || movedForRun.current === openRun) return
    const r = idx.runs.find((x) => x.id === openRun)
    if (!r) return
    movedForRun.current = openRun
    if (r.kind === 'template') setTab('checklists')
  }, [openRun, idx])

  /**
   * THE CONVERSATIONS, read as the page's own read and handed to the hook — Documents' shape
   * (`app/documents/page.tsx:380`–`:387`). One reader, not two.
   */
  const supabase = useMemo(() => createClient(), [])
  const reloadTopics = useCallback(async () => {
    const rows = await readTopicList(supabase, 'audits_chat')
    setTopics(rows)
    return rows
  }, [supabase])
  useEffect(() => { void reloadTopics() }, [reloadTopics])

  const conv = useAskConversations({
    topics, reloadTopics, summarisePath: (id) => `/api/audits/topics/${id}/summarise`,
  })

  // THE COMPANY, FOR PAPER — board 10. Every printed drawer names the company at the top of every
  // page; this page passed none (the audit) or `null` (a document's report). Read as /documents reads it.
  const [companyName, setCompanyName] = useState<string | null>(null)
  // Step 18, decision 11 — from the company read just below, widened by four columns.
  const [billing, setBilling] = useState<BillingRow | null>(null)
  const paused = pausedFromRow(billing)
  useEffect(() => {
    (async () => {
      const supabase = createClient()
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
  }, [])

  /**
   * *** TEN SECONDS, AND ONLY WHILE SOMETHING IS ACTUALLY RUNNING. ***
   * Documents polls its own list on the same interval. A poll that runs when nothing is moving is
   * a page that costs a request every ten seconds for ever, so this stops when no run is active.
   */
  const anyActive = !!idx && Object.keys(idx.active).length > 0
  useEffect(() => {
    if (!anyActive) return
    const t = setInterval(() => { load() }, 10_000)
    return () => clearInterval(t)
  }, [anyActive, load])

  /**
   * *** NOTHING OPENS ITSELF — Audits Run 7b, item 3. ***
   *
   * This opened the first audited agency on load. One line of thirty documents is most of a screen,
   * and the owner's review of the live report put it plainly: the page opened long. A page whose job
   * is "where do I stand" should answer that in one screen of one-line answers, and then let the
   * person choose what to read. `openLines` starts empty and only a click changes it.
   *
   * The ref the old effect guarded with is kept and unused by nothing: it is gone too.
   */

  const visibleDocs = useMemo(() => {
    if (!idx) return []
    if (site === 'all') return idx.documents
    const name = idx.sites.find((s) => s.id === site)?.name
    return idx.documents.filter((d) => d.site_name === name)
  }, [idx, site])

  /**
   * *** THE AUDIT BUTTON ON A ROW. *** One POST, and the notice above the rows. It is
   * `startAgencyRun` below plus this tab's own line, so the button and a typed command cannot
   * start a run two different ways — which they did until step 6b, because the box had its own
   * copy of this call.
   */
  async function startRun(agency: string, scope?: string | null) {
    setNotice(null); setChoices(null)
    const out = await startAgencyRun(agency, scope ?? null)
    setNotice(out.line)
  }

  /**
   * *** AUDITING AGAINST A FILE THE PERSON HAS ALREADY ATTACHED — Run 4b's `attachChecklist`,
   * with its first half removed. ***
   *
   * It used to do six things: pick a file, upload it to storage, write the row through
   * `POST /api/documents`, then start the run. The first three are `lib/chatUpload.ts`'s now
   * (decision 40) — the paperclip on the Ask tab puts the file in through Documents' own path and
   * asks for the reading, which `attachChecklist` never did and which is why a checklist used to
   * sit in the list saying "Not read yet" for ever. What is left is the fourth thing.
   *
   * The reading of the checklist AS A DOCUMENT and the extraction of its LINES are still
   * different questions asked of the same file, and the second still does not wait for the
   * first: a template audit needs the lines, not the scan's verdict.
   */
  async function startTemplateRun(documentId: string, fileName: string, scope: string | null) {
    setBusy(true)
    try {
      const res = await fetch('/api/audit-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          kind: 'template', template_document_id: documentId,
          ...(scope ? { scope } : {}),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) return { ok: false as const, line: json?.error ?? COULD_NOT_AUDIT }
      await load()
      // The note comes back when a file held no lines; it is the honest line and it wins.
      return {
        ok: true as const,
        line: json.note ?? auditsCommandTemplateLine(fileName, json.lines ?? 0, json.sections ?? 0),
        runId: json.id as string | null,
      }
    } finally { setBusy(false) }
  }

  /**
   * *** "AUDIT AGAIN AGAINST THIS CHECKLIST" — board 3, and the 6b leftover answered. ***
   *
   * Step 6b left this button off the By template row on purpose, and wrote down why:
   * *"`template_document_id` can point at a document that has since been deleted, and a button
   * that fails with 'That file was not found' is worse than no button. It waits for the row to
   * say whether the file is still there."*
   *
   * **The row CAN say.** `/api/audits/index` returns `documents` as the whole unfiltered
   * `document_index_v` for the company (`route.ts:31`–`:36`), so a `template_document_id` that is
   * not in that list is a file that is gone. The card checks before it draws the control, and
   * when the file is gone it says so in words instead of offering a button that cannot work.
   *
   * It opens the new run's report the moment the run exists, because that is where the person
   * was going.
   */
  async function auditAgainstTemplate(documentId: string, fileName: string) {
    const r = await startTemplateRun(documentId, fileName, 'Audit us against the attached template.')
    setNotice(r.line)
    if (r.ok && r.runId) setParam('run', r.runId)
  }

  /** The same, for an agency — `startRun` with its words rather than its notice. */
  async function startAgencyRun(agency: string, scope: string | null) {
    setBusy(true)
    try {
      const res = await fetch('/api/audit-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ kind: 'agency', agency, ...(scope ? { scope } : {}) }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) return { ok: false as const, line: json?.error ?? COULD_NOT_AUDIT }
      await load()
      return {
        ok: true as const,
        line: auditsCommandAgencyLine(agency === 'all' ? 'all-agency' : agency),
        runId: json.id as string | null,
      }
    } finally { setBusy(false) }
  }

  /**
   * The hook `components/AskScreen.tsx` calls before it sends anything (decision 37). `'handled'`
   * means a run started, or the page asked a question back; the screen then clears the box and
   * the chip and writes NO topic and NO turn. `'ask'` sends the sentence to the model.
   */
  async function beforeAsk(question: string, file: { id: string; name: string } | null) {
    if (!idx) return 'ask' as const
    const cmd = readCommand(question, idx.agencies, Boolean(file))
    if (!cmd) return 'ask' as const
    setChoices(null)
    if (cmd.kind === 'choose') {
      if (!idx.agencies.length) {
        setCommandLine({ asked: question, said: NO_AGENCIES }); return 'handled' as const
      }
      setCommandLine({ asked: question, said: WHICH_AGENCY })
      setChoices(idx.agencies)
      return 'handled' as const
    }
    if (cmd.kind === 'template') {
      if (!file) { setCommandLine({ asked: question, said: ATTACH_THE_FILE }); return 'handled' as const }
      const out = await startTemplateRun(file.id, file.name, question)
      setCommandLine({ asked: question, said: out.line })
      return 'handled' as const
    }
    const out = await startAgencyRun(cmd.agency, cmd.scope)
    setCommandLine({ asked: question, said: out.line })
    return 'handled' as const
  }

  /**
   * *** THE OFFER'S PRESS — decisions 41, 43 and 45. ***
   *
   * The model proposed; this starts it. `checkRunAuditOffer` holds the payload against the
   * company's OWN agency labels (`lib/audit.ts` `auditAgenciesFor` reads the same rows the page's
   * `idx.agencies` came from), so an agency the company does not hold never reaches
   * `/api/audit-runs` — and that route would refuse it a second time anyway.
   *
   * **It writes the same line a typed command writes**, because the person did the same thing.
   */
  async function pressOffer(offer: Offer, attachedId: string | null, attachedName: string | null) {
    if (offer.kind !== 'run_audit' || !idx) return { ok: false as const, line: COULD_NOT_AUDIT }
    const checked = checkRunAuditOffer(offer, {
      agencies: idx.agencies, attachedDocumentId: attachedId,
    })
    if (!checked) return { ok: false as const, line: COULD_NOT_AUDIT }
    const out = checked.documentId
      ? await startTemplateRun(checked.documentId, attachedName ?? 'the attached file', null)
      : await startAgencyRun(checked.agency as string, null)
    return out
  }

  /**
   * *** EVERY EARLIER RUN FOR ONE AGENCY — what the Past audits tab held that an agency row did
   * not (decision 31). ***
   *
   * The agency row shows the LATEST done run. Past audits showed them all, so folding the two
   * tabs into one would have lost every run but the newest unless they came back somewhere, and
   * this is where. Read off the SECTIONS and not off `agency_label`, for the reason
   * `app/api/audits/index/route.ts:88`–`:91` gives: an "all agencies" run carries every label in
   * one string, and its SECTIONS are what belong to one agency.
   */
  function earlierFor(label: string): Run[] {
    if (!idx) return []
    const latest = idx.last_done[label] ?? null
    const active = idx.active[label] ?? null
    return idx.runs.filter((r) => {
      if (r.id === latest || r.id === active) return false
      if (r.kind === 'template') return false
      return idx.sections.some((x) => x.run_id === r.id && x.title === label)
    })
  }

  /**
   * *** WHAT GOES UNDER AN ANSWER — the shared screen's `afterAnswer` slot, and Audits puts one
   * thing in it: the offer (decision 41). ***
   *
   * `components/CalendarAsk.tsx` `calendarAfterAnswer` is the shape, copied: the offers the
   * answer carried, each a line the person can press, and what the line says once it has been.
   * **The card cannot be pressed twice** — `x.added` is the shared screen's own per-offer record
   * and the moment it is set the line stops being a button. A second press would be a second
   * `POST /api/audit-runs`, and the route's own claim answers 409 anyway; this means the person
   * never gets that far.
   */
  function auditsAfterAnswer(x: Exchange, patch: (p: Partial<Exchange>) => void) {
    return (
      <>
        {x.phase === 'done' && x.offers.filter((o) => o.kind === 'run_audit').map((o, i) => {
          const state = x.added?.[i]
          if (state) {
            return (
              <p key={i} className="mt-3 text-[15px] text-gray-800">
                {state.failed ? COULD_NOT_AUDIT : (
                  <>
                    {state.id ?? ''}{' '}
                    <button onClick={() => selectTab('audits')} className={ACTION_GREEN}>
                      Open the Audits tab
                    </button>
                  </>
                )}
              </p>
            )
          }
          return (
            <p key={i} className="mt-3 text-[15px]">
              <button
                disabled={busy || Boolean(paused)}
                onClick={async () => {
                  // Marked BEFORE the call, so the line stops being a button at the first press.
                  patch({ added: { ...(x.added ?? {}), [i]: { id: null, already: false } } })
                  const out = await pressOffer(o, attached?.id ?? null, attached?.name ?? null)
                  patch({ added: { ...(x.added ?? {}), [i]: {
                    id: out.ok ? out.line : null, already: false, failed: !out.ok,
                  } } })
                }}
                className="text-left text-[var(--green-ink)] underline underline-offset-2 hover:no-underline disabled:text-gray-300">
                {runAuditCardWords({
                  agency: o.agency,
                  fileName: o.attached ? (attached?.name ?? 'the attached file') : null,
                })}
              </button>
            </p>
          )
        })}
      </>
    )
  }

  async function dismissRun(id: string) {
    setIdx((cur) => cur ? { ...cur, banners: cur.banners.filter((b) => b !== id) } : cur)
    await fetch(`/api/audit-runs/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ action: 'dismiss' }),
    })
    load()
  }

  /**
   * ONE CALL SITE API, UNCHANGED — every `setParam('tab', …)` and `setParam('run', …)` on this page
   * still reads the same. What changed is underneath: the state moves FIRST, so closing works
   * whether or not the router agrees to navigate, and the address is then written to match.
   *
   * `history.replaceState` for the empty case, because that is the one the router refuses. It
   * writes the address without a navigation, which is exactly what is wanted now that nothing is
   * derived from the address between renders. It adds no history entry — neither did
   * `router.replace`, so Back behaves as it did.
   */
  const setParam = (k: string, v: string | null) => {
    if (k === 'run') setOpenRun(v)
    if (k === 'binder') setBinder(v === '1')
    // Closing the report closes the binder with it: a `&binder=1` left behind would open the
    // binder of the NEXT run somebody pressed.
    if (k === 'run' && v === null) setBinder(false)
    // Three tabs since step 6b, and `ask` is still what an unknown word falls back to — a tab
    // name arrives from links, bookmarks and typing. The old two words both mean Audits.
    if (k === 'tab') setTab(v === 'past' || v === 'stand' ? 'audits'
      : TAB_KEYS.includes((v ?? '') as Tab) ? (v as Tab) : 'ask')
    const p = new URLSearchParams(searchRef.current)
    if (v === null) p.delete(k); else p.set(k, v)
    if (k === 'run' && v === null) p.delete('binder')
    searchRef.current = p.toString()
    const url = `/audits${p.toString() ? `?${p}` : ''}`
    if (p.toString()) router.replace(url, { scroll: false })
    else window.history.replaceState(null, '', url)
  }
  /** The default tab DELETES the key, so the plain `/audits` the sidebar links to stays plain. */
  const selectTab = (k: Tab) => setParam('tab', k === 'ask' ? null : k)

  /**
   * "+ NEW CONVERSATION" IS A BUTTON, not a link, and the reason is React's own lint rule: it has
   * to CLEAR the open conversation, which is a state change, and an effect that watched the
   * address for it is refused. Documents and the Calendar both reached the same answer.
   */
  const startNewConversation = () => {
    conv.startNewConversation()
    setCommandLine(null); setChoices(null); setAttached(null)
    selectTab('ask')
  }

  /* ── per-agency derived numbers, all off the one read ─────────────────────── */
  function agencyView(label: string) {
    if (!idx) return null
    const docs = visibleDocs.filter((d) => (d.agencies ?? []).includes(label))
    const lastRunId = idx.last_done[label] ?? null
    const lastRun = lastRunId ? idx.runs.find((r) => r.id === lastRunId) ?? null : null
    const activeId = idx.active[label] ?? null
    const activeRun = activeId ? idx.runs.find((r) => r.id === activeId) ?? null : null

    // The section of the active run that is about THIS agency, for "section k of n".
    const activeSections = activeRun ? idx.sections.filter((s) => s.run_id === activeRun.id) : []
    const mine = activeSections.find((s) => s.title === label) ?? null
    const k = mine ? activeSections.filter((s) => s.ordinal <= mine.ordinal).length : 0

    const findings = lastRun
      ? idx.open_findings.filter((f) => {
          if (f.run_id !== lastRun.id) return false
          const sec = idx.sections.find((s) => s.id === f.section_id)
          return !sec || sec.title === label
        })
      : []
    const byWord = {
      nothing_on_file: findings.filter((f) => f.word === 'nothing_on_file' && f.kind === 'finding').length,
      // No `kind` guard: `audit_findings_expected_is_expected` (058:209) forbids a suggestion from
      // carrying the fifth word, which is what keeps decision 60's suggestions out of the counts.
      on_file_gaps: findings.filter((f) => f.word === 'on_file_gaps').length,
      stale: findings.filter((f) => f.word === 'stale').length,
      contradiction: findings.filter((f) => f.kind === 'contradiction').length,
      not_a_document_question: findings.filter((f) => f.word === 'not_a_document_question').length,
      on_file: findings.filter((f) => f.word === 'on_file').length,
    }
    const needs = byWord.nothing_on_file + byWord.on_file_gaps + byWord.stale
      + byWord.contradiction + byWord.not_a_document_question
    const failed = activeSections.filter((s) => s.status === 'could_not_complete')
    return { docs, lastRun, activeRun, mine, k, n: activeSections.length, byWord, needs, failed }
  }

  /* ── loading, and the two empty states that are claims ────────────────────── */
  if (error) {
    return <AppLayout><div className="mx-auto w-full max-w-[900px] px-4 pt-8 sm:px-6">
      <p className="text-[14px] text-[var(--amber)]">{error}</p>
      <button onClick={load} className={`mt-2 ${ACTION_GREEN}`}>Try again</button>
    </div></AppLayout>
  }
  if (!idx) {
    return <AppLayout><div className="mx-auto w-full max-w-[900px] px-4 pt-8 sm:px-6">
      <p className="text-[14px] text-gray-400">Loading…</p>
    </div></AppLayout>
  }

  const runCount = idx.runs.length
  /** The newest finished run of any kind, for the line under the box. */
  const newestDone = idx.runs.find((r) => r.status === 'done')?.finished_at
    ?? idx.runs.find((r) => r.status === 'done')?.created_at ?? null
  /**
   * *** THE TEMPLATE RUNS NOW HAVE A HOME, so the two grey lines that stood in for one are gone. ***
   *
   * What stood here was `runningTemplate` / `landedTemplate` / `seenTemplate`: one line under the
   * box while a checklist run went, one when it landed, and browser state so the second did not
   * come back. Its own comment said why — *"a checklist run is the one thing the page cannot
   * otherwise show… it has no agency line to live on"*. The **By template** group below is that
   * home (decision 31), so the stand-in is deleted rather than moved.
   */
  const templateRuns = idx.runs.filter((r) => r.kind === 'template')
  /**
   * *** ONE CARD PER CHECKLIST, NOT ONE PER RUN — board 3, decision 56. ***
   *
   * Grouped by `template_document_id`, newest run first inside each card, cards ordered by their
   * newest run. A checklist audited four times is one card with four rows, which is the whole
   * point of the tab: *"Checklists your auditors gave you, and every audit run against them."*
   *
   * A run whose `template_document_id` is null cannot be grouped and is not dropped — it goes
   * under its own card named from `scope`, because a run nobody can find is worse than an odd
   * card. (No such row exists on staging: `audit_runs_kind_has_its_subject` forbids it.)
   */
  const checklistCards = (() => {
    const by = new Map<string, Run[]>()
    for (const r of templateRuns) {
      const k = r.template_document_id ?? `scope:${r.scope ?? r.id}`
      if (!by.has(k)) by.set(k, [])
      by.get(k)!.push(r)
    }
    return [...by.entries()].map(([key, runs]) => ({ key, runs, newest: runs[0] }))
  })()
  const agencyRunCount = idx.runs.filter((r) => r.kind !== 'template').length
  const checklistCount = checklistCards.length

  return (
    <AppLayout>
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className={`no-print pt-6 ${openRun ? 'hidden' : ''}`}>
          <h1 className="font-serif text-[28px] font-normal text-gray-900">Audits</h1>
          {/* The lede moved into `lib/auditsWords.ts` at step 6a, unchanged, so the brief and the
              page read one copy of it. The words are the ones this page has always shown. */}
          <p className="mt-1 text-[14px] text-gray-500">{AUDITS_LEDE}</p>
        </div>

        {/*
          *** THE TAB ROW — decision 31. Ask a question · Conversations · Audits (N). ***

          `components/Tabs.tsx`, imported and not edited; it owns its own `mb-5 mt-5` and the
          hairline, so this page adds no margin of its own. The hand-rolled two-button row that
          stood here had exactly these classes — Tabs was lifted out of this page's chrome at HR
          step 3a — so the row does not move.

          The count's rule is Documents': zero is hidden, and so is a count nobody has read yet.
          "+ New conversation" is on the two conversation tabs only; on the Audits tab the thing a
          person wants at the right is an Audit button, and every row carries one.
        */}
        {/* *** THE REPORT IS A PAGE, SO THE TABS GO WHILE IT IS OPEN — decision 55. ***
            Not unmounted: the tab bodies hold a composer with typed text, a conversation and a
            scroll position, and `openRun` changes on a click. `hidden` keeps all of it and gives
            the report the full width the owner asked for. */}
        <div className={openRun ? 'hidden' : ''}>
        <Tabs active={tab} onSelect={selectTab}
          tabs={[
            { key: 'ask', label: 'Ask a question' },
            { key: 'conversations', label: 'Conversations' },
            /* Decision 56: the key stays `audits` so every bookmark and every `?tab=audits` lands
               where it did; only the word changes, because there is a second audits tab now. */
            { key: 'audits', label: `Agency audits${agencyRunCount ? ` (${agencyRunCount})` : ''}` },
            { key: 'checklists', label: `Auditor checklists${checklistCount ? ` (${checklistCount})` : ''}` },
          ]}
          right={tab === 'audits' || tab === 'checklists' ? null : (
            <button onClick={startNewConversation}
              className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span className="hidden sm:inline">New conversation</span>
            </button>
          )} />

        {/* ================= ASK A QUESTION — boards 1, 2 and 3 ================= */}
        {tab === 'ask' && (
          <div>
            <AskScreen
              key={conv.askKey}
              section="audits_chat"
              endpoints={{ answer: '/api/audits/answer' }}
              words={{
                composerHint: AUDITS_COMPOSER_HINT,
                firstVisitButton: AUDITS_FIRST_VISIT_BUTTON,
                emptyConversations: AUDITS_EMPTY_CONVERSATIONS,
                oneTopicLine: AUDITS_ONE_TOPIC_LINE,
              }}
              examples={AUDITS_EXAMPLE_QUESTIONS}
              companyName={companyName}
              paused={paused}
              topicId={conv.askTopicId}
              initial={conv.askInitial}
              onTopicId={conv.setAskTopicId}
              onChanged={async () => { await load(); await reloadTopics() }}
              onSummarise={conv.summarise}
              summaryBusy={conv.summaryRunning(conv.askTopicId)}
              /* Decision 33's words, and decision 40's reading: the paperclip puts the file in
                 through Documents' own path (`lib/chatUpload.ts`), which asks for the scan.
                 `attachChecklist` never did, which is why a checklist used to sit in the list
                 saying "Not read yet" for ever. */
              attach={{ label: AUDITS_ATTACH_LABEL, onPick: (d) => { setAttached(d); void load() } }}
              canMakeChecklist
              onMakeChecklist={conv.makeChecklist}
              checklistBusy={conv.checklistRunning(conv.askTopicId)}
              checklistReadyId={conv.checklistReady?.topicId === conv.askTopicId ? conv.checklistReady.id : null}
              thinkingLine={auditsThinkingLine}
              /* THE ONE OFFER (decision 41). The press is `pressOffer`, in code. */
              afterAnswer={auditsAfterAnswer}
              /* THE LOOKER (decisions 32, 37, 38). Code looks first; only a question goes on. */
              beforeAsk={beforeAsk}
            />

            {/* *** WHAT A HANDLED COMMAND LEAVES BEHIND — decision 39. ***
                No topic, no turn: the question and the one line, above the composer, until the
                next thing happens. */}
            {commandLine && (
              <div className="no-print mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[13px] text-gray-500">&ldquo;{commandLine.asked}&rdquo;</p>
                <p className="mt-1 text-[14px] text-gray-800">
                  {commandLine.said}
                </p>
                {/* "Audits tab" is a control, not prose: the person is already on the page, so it
                    switches tabs rather than linking and reloading the whole thing. */}
                {commandLine.said.endsWith(`${AUDITS_COMMAND_TAB_LINK}.`) && (
                  <button onClick={() => selectTab('audits')} className={`mt-1 ${ACTION_GREEN}`}>
                    Open the Audits tab
                  </button>
                )}
                {choices && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {choices.map((a) => (
                      <button key={a} onClick={async () => {
                        const out = await startAgencyRun(a, null)
                        setChoices(null); setCommandLine({ asked: commandLine.asked, said: out.line })
                      }} className={ACTION_GREEN}>{a}</button>
                    ))}
                    <button onClick={async () => {
                      const out = await startAgencyRun('all', null)
                      setChoices(null); setCommandLine({ asked: commandLine.asked, said: out.line })
                    }} className={ACTION_GREEN}>Everything</button>
                  </div>
                )}
              </div>
            )}
            {conv.notice && (
              <div className="no-print mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                {conv.notice}
                <button onClick={() => conv.setNotice(null)} className="ml-3 underline">Dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* ================= CONVERSATIONS — HR's board 9, its list and its drawer ================= */}
        {tab === 'conversations' && (
          <div className="pt-1">
            {topics.length === 0 ? (
              <Empty title={AUDITS_EMPTY_CONVERSATIONS_TITLE} note={AUDITS_EMPTY_CONVERSATIONS} />
            ) : (
              <ConversationList topics={topics}
                running={(t, kind) => kind === 'summary' && conv.summaryRunning(t.id)}
                onOpen={conv.setConvDrawer} />
            )}
          </div>
        )}

        {tab === 'audits' && (
          <>
            {/*
              *** THE BOX IS GONE FROM THIS TAB — decision 32, the owner, 3 November 2026. ***

              What stood here was the textarea, its three example lines as an overlay, the attach
              link, the "Or ask a question in the Compliance Workspace" link and the Audit button.
              Typing happens on the Ask tab now, and the matching that lived behind that button is
              `readCommand` at the top of this file, unchanged in what it does. The Workspace link
              went with it (decision 35): it was a bare `href="/compliance"` that carried nothing
              the person had typed, and this page answers the question where it was asked.

              **`PausedNote` stays**, and it has to: the Audit and Audit again buttons below are
              paid controls, and `tests/unit/readOnlyUi.test.ts:128`–`:145` holds that every screen
              owning one shows the same note.
            */}
            <PausedNote banner={paused} />

            {notice && <p className="no-print mb-4 text-[13px] text-gray-600">{notice}</p>}

            {/* ── the thin line ──────────────────────────────────────────── */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
              {/* The date the banners used to carry, where it belongs: on the line that already
                  counts what the page is made of. Each agency line keeps its own date. */}
              <p className="text-[13px] text-gray-500">
                {idx.counts.read} document{idx.counts.read === 1 ? '' : 's'} read
                {idx.counts.held_unread ? ` · ${idx.counts.held_unread} held, not read yet` : ''}
                {' · '}{idx.counts.agencies} agenc{idx.counts.agencies === 1 ? 'y' : 'ies'}
                {newestDone ? ` · last audited ${fmt(newestDone)}` : ''}
              </p>
              <div className="flex items-center gap-2">
                {idx.sites.length > 1 && (
                  <select value={site} onChange={(e) => setSite(e.target.value)} className={controlClass}>
                    <option value="all">Site: All sites</option>
                    {idx.sites.map((s) => <option key={s.id} value={s.id}>Site: {s.name}</option>)}
                  </select>
                )}
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'agency' | 'subject' | 'site')}
                  className={controlClass}>
                  <option value="agency">Group by: Agency</option>
                  <option value="subject">Group by: Subject</option>
                  <option value="site">Group by: Site</option>
                </select>
              </div>
            </div>

            {/* ── the empty states, each of which is a claim and has to be true ── */}
            {idx.counts.read === 0 ? (
              <div className="mt-6">
                <p className="text-[14px] text-gray-600">Read some documents first. Audits are built from their readings.</p>
                {/* `?tab=documents` since `docs/GAPS-PLAN.md` Part A step 4b: /documents opens the chat now,
                    and somebody sent here by a finding wants the table and the upload control. */}
                <a href="/documents?tab=documents" className={`mt-2 inline-block ${ACTION_GREEN}`}>Go to Documents</a>
              </div>
            ) : idx.agencies.length === 0 ? (
              <p className="mt-6 text-[14px] text-gray-600">None of your documents carries an agency yet.</p>
            ) : groupBy === 'agency' ? (
              <>
                {/*
                  *** NO BANNERS — the owner's third review. ***
                  Every finished run raised one, so two template runs in a morning put two "audit of
                  everything is done" lines above a list whose every row already carried its own
                  date and count. A banner is for news a page cannot otherwise show; this page shows
                  all of it. `audit_runs.dismissed_at` stays as a column — a dismissal already
                  recorded is not ours to erase — and nothing here reads it.
                */}
                <p className={GROUP_LABEL}>By agency</p>
                <div className="mt-1">
                  {idx.agencies.map((label) => {
                    const v = agencyView(label)!
                    const open = !!openLines[label]
                    return (
                      <div key={label} className="border-b border-gray-100">
                        {/* The WHOLE line opens it. A chevron three pixels wide was the only
                            thing you could hit, and nothing said the rest of the line was
                            clickable — no pointer, no wash. */}
                        <div className={AGENCY_ROW} role="button" tabIndex={0}
                          onClick={() => setOpenLines((o) => ({ ...o, [label]: !o[label] }))}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); setOpenLines((o) => ({ ...o, [label]: !o[label] })) } }}>
                          <span className={`mt-0.5 w-3 shrink-0 text-[12px] text-gray-400 transition-transform ${
                            open ? 'rotate-90' : ''}`}>▸</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] text-gray-900">{label}</p>
                            {v.activeRun ? (
                              <p className="mt-0.5 text-[12px] text-gray-500">
                                {v.mine && v.mine.status === 'queued'
                                  ? `waiting, section ${v.k} of ${v.n}`
                                  : `Audit running · ${v.activeRun.estimate ?? idx.estimate}`}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[12px] text-gray-500">
                                {v.docs.length} document{v.docs.length === 1 ? '' : 's'}
                                {' · '}
                                {v.lastRun ? `last audited ${fmt(v.lastRun.finished_at ?? v.lastRun.created_at)}` : 'not audited yet'}
                                {v.lastRun ? ` · ${v.needs} to look at` : ''}
                              </p>
                            )}
                            {v.failed.length > 0 && !v.activeRun && (
                              <p className="mt-0.5 text-[12px] text-[var(--amber)]">
                                {v.failed.length} part{v.failed.length === 1 ? '' : 's'} of the last audit did not finish.
                              </p>
                            )}
                          </div>
                          {/* Decision 59: the action sits in a fixed, left-aligned column, so
                              "Audit again" and "section 2 of 4" start at the same place. */}
                          <div className="w-[104px] shrink-0 text-left">
                            {v.activeRun ? (
                              <p className="text-[12px] text-gray-500">
                                {v.n > 1 ? `section ${v.k} of ${v.n}` : ''}
                              </p>
                            ) : (
                              <button disabled={busy || Boolean(paused)}
                                onClick={(e) => { e.stopPropagation(); startRun(label) }}
                                className={ACTION_GREEN}>
                                {v.lastRun ? 'Audit again' : 'Audit'}
                              </button>
                            )}
                          </div>
                        </div>

                        {open && <>
                          <AgencyBody label={label} idx={idx} v={v}
                            onOpenRun={(w) => { setDrawerWord(w); setParam('run', v.lastRun!.id) }}
                            onOpenDoc={(d) => { setFromAudit(null); setOpenDoc(d) }} />
                          <EarlierRuns runs={earlierFor(label)} idx={idx}
                            open={!!openEarlier[label]}
                            onToggle={() => setOpenEarlier((o) => ({ ...o, [label]: !o[label] }))}
                            onOpen={(id) => setParam('run', id)} />
                        </>}
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-[12px] text-gray-500">
                  An audit of everything runs one section per agency, in this order. Each line
                  updates as its section lands. We will email you when the last one is done.
                </p>
              </>
            ) : (
              <GroupedByOther by={groupBy} idx={idx} docs={visibleDocs} onAudit={startRun} busy={busy} paused={Boolean(paused)}
                onOpenDoc={(d) => { setFromAudit(null); setOpenDoc(d) }} />
            )}

            {/* ── the last group, only when it has something in it ────────── */}
            {idx.unplaced.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h2 className="text-[12px] font-medium uppercase tracking-wide text-gray-700">
                  Documents we read but could not place under an agency
                  <span className="ml-2 font-normal text-gray-400">{idx.unplaced.length}</span>
                </h2>
                <div className="mt-2">
                  {idx.unplaced.map((d) => (
                    <div key={d.document_id} className="flex items-center gap-3 border-b border-gray-100 py-2">
                      <button onClick={() => { setFromAudit(null); setOpenDoc(d.document_id) }}
                        title={d.title} className={`min-w-0 flex-1 ${TITLE_LINE}`}>{d.title}</button>
                      <p className={`shrink-0 text-[12px] ${AMBER_DOC.has(d.display_status) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                        {DOC_STATUS[d.display_status] ?? d.display_status}
                      </p>
                      <button onClick={() => { setFromAudit(null); setOpenDoc(d.document_id) }}
                        className={ACTION_GREEN}>Open</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* *** BY TEMPLATE LEFT THIS TAB — decision 56, 4 November 2026. ***
                The group that stood here is the **Auditor checklists** tab now, as one card per
                checklist with a table of its runs (board 3). This tab is the agency rows, which
                decision 56 says are untouched — and the pixel method says so too. */}
            {idx.runs.length > 0 && (
              <p className="mt-4 text-[12px] text-gray-500">
                Every audit is kept. Open one and its report is exactly what it said on the day,
                against the documents as they stood then.
              </p>
            )}
          </>
        )}

        {/* ============ AUDITOR CHECKLISTS — board 3, decision 56 ============ */}
        {tab === 'checklists' && (
          <ChecklistCards cards={checklistCards} idx={idx} paused={paused} busy={busy}
            onPrintBinder={(id) => { setParam('run', id); setParam('binder', '1') }}
            onOpen={(id) => setParam('run', id)}
            onOpenDoc={(id) => { setFromAudit(null); setOpenDoc(id) }}
            onAuditAgain={auditAgainstTemplate} />
        )}
        </div>

      </div>

      {/* *** THE AUDIT REPORT, AS A PAGE — decision 55, 4 November 2026. ***
          Same address (`/audits?run=<id>`), so the email, the Dashboard, this page's own links and
          every bookmark land here unchanged, and the 20 October hotfix is untouched: the parameter
          still seeds state and `setParam('run', null)` still closes it. What changed is that the
          report renders in the body instead of in an `<aside>`.

          *** IT IS A SIBLING OF `.print-page`, NOT A CHILD, AND THAT IS NOT TIDINESS. ***
          `app/globals.css:138` is `body.printing-drawer .print-page { display: none !important }`,
          and `display: none` on an ancestor cannot be undone by a descendant. Rendered inside the
          container, this report would print a blank sheet — the one failure a printed compliance
          page must not have. Outside it, the page's own chrome is hidden for the print and the
          report prints as the document, exactly as a drawer does.

          Hidden under a document's reading, which is the ONE drawer over it (decision 55). */}
      {openRun && (
        <div className={`${openDoc ? 'hidden' : ''} mx-auto w-full max-w-[1000px] px-4 pb-16 pt-6 sm:px-6`}>
          {/* *** THE BINDER IS THE SAME PAGE IN ANOTHER MODE — decision 61. *** Same address with
              `&binder=1`, same container, same sibling-of-`.print-page` rule, so the print path is
              the one E1 proved. The two never render together: the binder IS the report, with its
              documents behind it. */}
          {binder ? (
            <AuditBinder runId={openRun} companyName={companyName}
              onBack={() => setParam('binder', null)} />
          ) : (
            <AuditReport runId={openRun} focusWord={drawerWord} paused={paused} chrome="page"
              onClose={() => { setParam('run', null); setDrawerWord(null) }}
              onChanged={load}
              onOpenDoc={(d) => { setFromAudit(openRun); setDocFrom('audit'); setOpenDoc(d) }}
              onPrintBinder={() => setParam('binder', '1')}
              companyName={companyName} />
          )}
        </div>
      )}

      {/* THE DOCUMENT'S OWN REPORT, THE SAME COMPONENT DOCUMENTS MOUNTS. */}
      {openDoc && (
        <>
          <div className="no-print fixed inset-0 z-[45] bg-gray-900/30"
            onClick={() => { setOpenDoc(null); setFromAudit(null); setDocFrom(null) }} />
          <DocumentReport
            paused={paused}
              documentId={openDoc}
              companyName={companyName}
              onClose={() => { setOpenDoc(null); setFromAudit(null); setDocFrom(null) }}
              onChanged={load}
              folders={idx.folders ?? []}
              /* The way back, in the header's own flow above the title rather than as an overlay
                 pinned to the top with nothing under it (§147). `Drawer`'s `topLine` slot. */
              topLine={
                <button onClick={() => { setOpenDoc(null); setDocFrom(null) }}
                  className="cursor-pointer text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">
                  ← {docFrom === 'summary' ? 'Back to the summary'
                     : fromAudit ? 'Back to the audit' : 'Back to Audits'}
                </button>
              }
              onMove={async (documentId, folderId) => {
                await fetch('/api/documents', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                  body: JSON.stringify({ id: documentId, folder_id: folderId }),
                })
                await load()
              }}
              /* This page has no file picker of its own, and building a second upload path here
                 would be two of them. Documents is the upload surface, and it now shows the
                 hint it is sent (Run 3b, item 5), so this lands somewhere that does the thing. */
              onPickFile={() => { window.location.href = '/documents?add=a+clearer+copy' }}
          />
        </>
      )}

      {/* ================= THE CONVERSATION DRAWER — `components/ConversationDrawer.tsx` =================
          The shared one, with Delete, and the workspace's report shape (`WEB_SOURCE`): an Audits
          answer's sources are web pages and passage quotes, which is what that shape draws. */}
      {/* *** A SOURCE OPENS IN PLACE — decision 63, 4 November 2026. ***
          Hidden, not unmounted, while a document's reading is over it: closing the reading comes
          back to the summary at the scroll position it was left at, which is the whole of what
          "in place" means. The Calendar has swapped its date drawer for a reading this way since
          step 8b, and this is that shape. Never a drawer inside a drawer (decision 55). */}
      {conv.convDrawer && (
        <div className={docFrom === 'summary' && openDoc ? 'hidden' : ''}>
        <ConversationDrawer
          topic={conv.convDrawer}
          companyName={companyName}
          paused={paused}
          notSummarisedLine={AUDITS_NOT_SUMMARISED}
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
          onOpenSource={(t) => {
            if (t.kind === 'document') { setDocFrom('summary'); setFromAudit(null); setOpenDoc(t.id) }
            // An audit is a PAGE (decision 55), so it is a navigation and not a swap.
            else if (t.kind === 'audit') window.location.href = `/audits?run=${t.id}`
            // A date lives on the Calendar, which opens it from the address (E2b item 4).
            else if (t.kind === 'date') window.location.href = `/calendar?date=${t.id}`
          }}
        />
        </div>
      )}
    </AppLayout>
  )
}

/**
 * *** THE EARLIER RUNS FOR ONE AGENCY — every line the Past audits tab carried that an agency
 * row did not (decision 31). ***
 *
 * Folded in rather than copied: the date, the count to look at, how many of the previous run's
 * findings this one closed, the person's own scope in quotation marks, and the amber line where
 * a part did not finish. Each opens the same `?run=` the Past audits list opened.
 *
 * It is collapsed by default for the reason the agency rows are (Run 7b, item 3: *"a page whose
 * job is 'where do I stand' should answer that in one screen"*) — six earlier runs under an open
 * agency would be most of a screen of history above the documents the person came to read.
 */
/**
 * *** THE AUDITOR CHECKLISTS TAB — board 3, decision 56, 4 November 2026. ***
 *
 * One white card per checklist, and inside it a TABLE of its runs, newest first: the date, the
 * four counts as coloured cells, what closed since the run before, and the links. The card is the
 * checklist; the rows are what has been run against it. That is the shape the owner drew, and it
 * is the one thing the By template group could not be: it listed RUNS, so a checklist audited
 * four times was four rows with no sense that they were the same questions.
 *
 * *** EVERY NUMBER HERE IS ALREADY IN `/api/audits/index`. *** The counts are `run.summary`'s own
 * five words; "since last run" is `run.closed_count`, which that route computes at `:167`; the
 * lines and sections are `template_lines` and `section_count`; and whether the auditor's file is
 * still on file is a lookup in `idx.documents`, which is the whole unfiltered list. No new query,
 * no new column.
 *
 * *** NO BINDER CONTROL UNTIL PART C — HIDDEN, NOT GREYED (the owner, 4 November). ***
 * Board 3 draws "Build the binder" on the latest run. It is not drawn at all until Part C builds
 * it, and the reason is the Calendar's own rule, pinned in `tests/unit/calendarView.test.ts`:
 * *"a date with no report HIDES the tab rather than disabling it… a greyed tab promises
 * something"*. A disabled button is a promise with no date on it.
 *
 * ALIGNMENT (decision 59): the counts are five fixed cells and the links a fixed column, so they
 * line up down a card and between cards whatever the dates beside them are.
 */
const CELL = 'w-[86px] shrink-0 text-left text-[12px]'
function ChecklistCards({ cards, idx, paused, busy, onOpen, onPrintBinder, onOpenDoc, onAuditAgain }: {
  cards: Array<{ key: string; runs: Run[]; newest: Run }>
  idx: Index
  paused: Banner | null
  busy: boolean
  onOpen: (runId: string) => void
  /** Board 3's second action on the latest run: open that run's page in binder mode. */
  onPrintBinder: (runId: string) => void
  onOpenDoc: (documentId: string) => void
  onAuditAgain: (documentId: string, fileName: string) => void
}) {
  if (!cards.length) {
    /* AN EMPTY STATE IS A MESSAGE, AND IT SAYS WHAT TO DO (§5.1). Never "no checklists". */
    return (
      <div className="mt-2">
        <p className="text-[14px] text-gray-600">
          No auditor has given you a checklist yet — or none has been audited against.
        </p>
        <p className="mt-2 text-[13px] text-gray-500">
          Have one? Attach it with the paperclip on the <b>Ask a question</b> tab and type
          {' '}<i>Audit us against the attached template</i>.
        </p>
      </div>
    )
  }
  return (
    <div className="mt-2">
      <p className="text-[13px] text-gray-600">
        Checklists your auditors gave you, and every audit run against them.
      </p>
      {cards.map(({ key, runs, newest }) => {
        const docId = newest.template_document_id
        /* The auditor's own file, if it is still on file. `idx.documents` is every document the
           company holds, so `undefined` here means deleted — and the card says so. */
        const doc = docId ? idx.documents.find((d) => d.document_id === docId) : undefined
        const title = doc?.title ?? checklistTitle(newest, idx)
        const lines = Array.isArray(newest.template_lines)
          ? (newest.template_lines as Array<{ lines?: unknown[] }>)
            .reduce((n, sec) => n + (Array.isArray(sec?.lines) ? sec.lines.length : 0), 0)
          : 0
        /** The newest run that FINISHED: the only kind there can be a binder of. */
        const latestDone = runs.find((r) => r.status === 'done')?.id
        return (
          <div key={key} className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[15px] text-gray-900">{title}</p>
            <p className="mt-0.5 text-[12px] text-gray-500">
              {lines ? `${lines} line${lines === 1 ? '' : 's'} in ` : ''}
              {newest.section_count} section{newest.section_count === 1 ? '' : 's'}
              {' · '}last run {fmt(newest.finished_at ?? newest.created_at)}
            </p>

            <div className="mt-3 border-t border-gray-100">
              {/* The header row of the table, in the same fixed columns as the rows below it. */}
              <div className="flex items-center gap-3 border-b border-gray-100 py-1.5 text-[11px] uppercase tracking-wide text-gray-400">
                <span className="w-[150px] shrink-0">Run</span>
                <span className={CELL}>On file</span>
                <span className={CELL}>Gaps found</span>
                <span className={CELL}>Out of date</span>
                <span className={CELL}>Not on file</span>
                <span className="min-w-0 flex-1">Since last run</span>
                <span className="w-[230px] shrink-0 text-left">&nbsp;</span>
              </div>
              {runs.map((r, i) => {
                const s = r.summary
                const prev = runs[i + 1] ?? null
                return (
                  <div key={r.id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-b-0">
                    <span className="w-[150px] shrink-0 text-[13px] text-gray-900">
                      {r.status === 'done' ? fmt(r.finished_at ?? r.created_at) : 'Running…'}
                    </span>
                    <span className={`${CELL} text-gray-600`}>{s?.on_file ?? 0}</span>
                    <span className={`${CELL} text-[var(--amber)]`}>{s?.on_file_gaps ?? 0}</span>
                    <span className={`${CELL} text-[var(--amber)]`}>{s?.stale ?? 0}</span>
                    <span className={`${CELL} text-[var(--amber)]`}>{s?.nothing_on_file ?? 0}</span>
                    <span className="min-w-0 flex-1 text-[12px] text-gray-500">
                      {prev && r.closed_count > 0
                        ? `${r.closed_count} line${r.closed_count === 1 ? '' : 's'} closed since ${fmt(prev.finished_at ?? prev.created_at)}`
                        : '—'}
                    </span>
                    {/* Decision 59: a fixed, left-aligned column, so Open the report starts at
                        the same place on every row of every card.
                        *** AND BOARD 3'S SECOND ACTION ARRIVED AT PART C — decision 61. *** The
                        board draws "Build the binder" on the LATEST run only, and that is right
                        for the same reason the strip is: the binder is the thing you hand over
                        today, and an older run's binder is a historical document nobody asks for.
                        It is "Print the binder" now, because the browser makes it. */}
                    <span className="w-[230px] shrink-0 text-left">
                      <button onClick={() => onOpen(r.id)} className={ACTION_GREEN}>Open the report</button>
                      {/* *** THE LATEST FINISHED RUN, NOT THE LATEST ROW — found by the walk. ***
                          It was `i === 0`, and the top row of this card on staging is a run that
                          is still queued: the control vanished altogether. A binder can only be
                          made of an audit that finished, and the newest finished one is the one a
                          person hands over today. */}
                      {r.id === latestDone && (
                        <button onClick={() => onPrintBinder(r.id)} className={`ml-3 ${ACTION_GREEN}`}>
                          Print the binder
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              {doc && docId ? (
                <>
                  <button disabled={busy || Boolean(paused)}
                    onClick={() => onAuditAgain(docId, doc.file_name ?? doc.title)}
                    className={`${ACTION_GREEN} disabled:text-gray-300`}>
                    Audit again against this checklist
                  </button>
                  <button onClick={() => onOpenDoc(docId)}
                    className="text-[13px] text-gray-600 underline hover:text-gray-900">
                    Open the auditor&rsquo;s file
                  </button>
                </>
              ) : (
                /* §5.1 — say plainly what we cannot do and why, and never offer a control that
                   would fail. The file is gone; the reports made from it are all still here. */
                <p className="text-[12px] text-gray-500">
                  The auditor&rsquo;s file is no longer on file, so this one cannot be run again.
                  Add it from the <b>Ask a question</b> tab and audit against it there. Every
                  report above is kept.
                </p>
              )}
            </div>
          </div>
        )
      })}
      <p className="mt-5 text-[12px] text-gray-500">
        Have another auditor&rsquo;s checklist? Attach it with the paperclip on the
        {' '}<b>Ask a question</b> tab and type <i>Audit us against the attached template</i>.
      </p>
    </div>
  )
}

function EarlierRuns({ runs, idx, open, onToggle, onOpen }: {
  runs: Run[]; idx: Index; open: boolean; onToggle: () => void; onOpen: (id: string) => void
}) {
  if (!runs.length) return null
  return (
    <div className="mb-4 pl-6">
      <button onClick={onToggle} className="text-[12px] text-gray-500 hover:text-gray-800">
        {open ? '▾' : '▸'} Earlier audits ({runs.length})
      </button>
      {open && runs.map((r) => {
        const failed = idx.sections.filter((x) => x.run_id === r.id && x.status === 'could_not_complete')
        const prev = r.previous_run_id ? idx.runs.find((x) => x.id === r.previous_run_id) : null
        const prevOpen = needsOf(prev?.summary) + (r.closed_count ?? 0)
        return (
          <div key={r.id} className="mt-1 flex items-start gap-3 border-t border-gray-100 pt-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-gray-600">
                {fmt(r.finished_at ?? r.created_at)}
                {r.status !== 'done'
                  ? ` · Running · ${r.estimate ?? idx.estimate}`
                  : <>
                      {` · ${needsOf(r.summary)} to look at`}
                      {prev && r.closed_count > 0
                        ? ` · ${r.closed_count} of ${prevOpen} from ${fmt(prev.finished_at ?? prev.created_at)} closed`
                        : ''}
                    </>}
              </p>
              {failed.length > 0 && (
                <p className="text-[12px] text-[var(--amber)]">
                  {failed.map((f) => f.title).join(', ')} did not finish.
                </p>
              )}
              {r.scope && <p className="text-[12px] text-gray-400">&ldquo;{r.scope}&rdquo;</p>}
            </div>
            <button onClick={() => onOpen(r.id)} className={`shrink-0 ${ACTION_GREEN}`}>Open</button>
          </div>
        )
      })}
    </div>
  )
}

/* ── what is inside an agency line ────────────────────────────────────────── */
function AgencyBody({ label, idx, v, onOpenRun, onOpenDoc }: {
  label: string
  idx: Index
  v: { docs: Doc[]; lastRun: Run | null; byWord: Record<string, number>; needs: number }
  onOpenRun: (word: string | null) => void
  onOpenDoc: (documentId: string) => void
}) {
  const docIds = new Set(v.docs.map((d) => d.document_id))
  const subjects = [...new Set(v.docs.flatMap((d) => d.subjects ?? []))].sort()
  const noSubject = v.docs.filter((d) => !(d.subjects ?? []).length)

  const deadlinesFor = (ids: Set<string>) => idx.deadlines.filter((dl) => ids.has(dl.document_id))
  const expectedTitles = [...new Set(idx.expected
    .filter((e) => docIds.has(e.document_id))
    .flatMap((e) => e.titles))]

  // Deadlines already printed in an earlier group of this agency.
  const shown = new Set<string>()

  const groups: Array<{ name: string; docs: Doc[] }> = [
    ...subjects.map((s) => ({ name: s, docs: v.docs.filter((d) => (d.subjects ?? []).includes(s)) })),
    ...(noSubject.length ? [{ name: 'No subject yet', docs: noSubject }] : []),
  ]

  return (
    <div className="mb-4 pl-6">
      {groups.map((g) => (
        <div key={g.name} className="mb-3">
          <h3 className="text-[12px] font-medium uppercase tracking-wide text-gray-700">
            {g.name}<span className="ml-2 font-normal text-gray-400">{g.docs.length}</span>
          </h3>
          {g.docs.map((d) => (
            <div key={d.document_id} className="flex items-center gap-3 border-b border-gray-100 py-1.5">
              {/* Opens the document's OWN report here. `/documents?doc=` was a link that landed on
                  a page which does not read the parameter — it opened Documents and nothing else. */}
              <button onClick={() => onOpenDoc(d.document_id)} title={d.title}
                className={`min-w-0 flex-1 ${TITLE_LINE}`}>{d.title}</button>
              <p className={`shrink-0 text-[12px] ${AMBER_DOC.has(d.display_status) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                {DOC_STATUS[d.display_status] ?? d.display_status}
                {/* A record's date IS its last entry, which is the only thing that says whether it
                    is being kept. Other kinds carry their own date in the status word already. */}
                {d.kind === 'record' && d.significant_date ? ` · last entry ${fmt(d.significant_date)}` : ''}
              </p>
            </div>
          ))}
          {/* *** ONCE PER DOCUMENT, NOT ONCE PER SUBJECT. *** The self-check carries five subject
              labels, so its two deadlines were printed five times — twelve lines of repeat under one
              agency. A deadline belongs to a document, and the document is listed under each of its
              subjects; the dates go under the first group that claims it. */}
          {deadlinesFor(new Set(g.docs.map((x) => x.document_id)))
            .filter((dl) => !shown.has(`${dl.document_id}|${dl.title}`) && (shown.add(`${dl.document_id}|${dl.title}`), true))
            .map((dl, i) => {
            const passed = !!dl.due_on && dl.due_on <= idx.today
            const inDays = dl.due_on ? daysUntil(dl.due_on, idx.today) : null
            return (
              <p key={`${dl.document_id}-${i}`} className="mt-1 text-[12px] text-gray-500">
                {dl.title}
                {dl.due_on
                  ? <> — {fmt(dl.due_on)} · {passed
                      ? <span className="text-[var(--amber)]">passed</span>
                      : `in ${inDays} day${inDays === 1 ? '' : 's'}`}</>
                  /* *** A RECURRING DEADLINE WITH NO DATE IS NOT TOLD IT HAS PASSED. ***
                     This read the reading's `source_line` into the gap where a month and day
                     should go, which printed a whole permit condition into the line — and then
                     claimed "passed for 2026" about a date nobody has. `document_deadlines` holds
                     no month-and-day column, so when `due_on` is null there is nothing to compare
                     with today and the honest line says only that it recurs. */
                  : <> — recurs · <span className="text-gray-400">no date in the reading</span></>}
              </p>
            )
          })}
        </div>
      ))}

      {/* *** THE LAST AUDIT'S OPEN FINDINGS, AS A SENTENCE — Audits Run 7b, item 3. ***
          Same numbers, same links, said rather than listed. Each number still opens the report
          filtered to that word: a number a person cannot get to the inside of is a number they have
          to take on trust. A word with none of them is left out of the sentence entirely — "0
          disagreements between documents" is a clause that costs a reader time and tells them
          nothing. */}
      {v.lastRun && (() => {
        const clauses = (['nothing_on_file', 'on_file_gaps', 'contradiction',
                          'not_a_document_question', 'on_file', 'stale'] as const)
          .filter((w) => v.byWord[w] > 0)
          .map((w) => (
            <button key={w} onClick={() => onOpenRun(w)} className="underline hover:text-gray-900">
              {WORD_CLAUSE[w](v.byWord[w])}
            </button>
          ))
        return (
          <p className="mt-2 text-[12px] text-gray-600">
            The last audit, on {fmt(v.lastRun.finished_at ?? v.lastRun.created_at)},{' '}
            {clauses.length
              ? <>found {joinClauses(clauses)}.</>
              : <>found nothing open.</>}
          </p>
        )
      })()}

      {/* The same, for what similar companies hold and this one does not. Three titles, because a
          sentence with six names in it is a list again; the rest are in the report. */}
      {expectedTitles.length > 0 && (
        <p className="mt-2 text-[12px] text-gray-400">
          Based on similar companies, we would also expect: {expectedTitles.slice(0, 3).join(', ')}
          {expectedTitles.length > 3
            ? `, and ${expectedTitles.length - 3} more.`
            : '.'}
        </p>
      )}
    </div>
  )
}

/**
 * GROUPED BY SUBJECT OR SITE.
 *
 * *** AN AUDIT IS STILL RUN BY AGENCY, AND THIS SAYS SO RATHER THAN PRETENDING OTHERWISE. ***
 * A subject spans regulators — "Air Quality" is DEQ's, "Powered Industrial Trucks" is OSHA's — and a
 * site holds documents from several. So these groupings arrange what the company HOLDS, and the
 * action stays on the agency names inside each group. Offering "Audit" on a subject would promise a
 * run the engine cannot do.
 */
function GroupedByOther({ by, idx, docs, onAudit, busy, paused, onOpenDoc }: {
  by: 'subject' | 'site'; idx: Index; docs: Doc[]
  onAudit: (agency: string) => void; busy: boolean
  /** Step 18: a prop, not a second read — the parent already has the verdict. */
  paused: boolean
  onOpenDoc: (documentId: string) => void
}) {
  const keyOf = (d: Doc): string[] =>
    by === 'subject' ? (d.subjects ?? []) : [d.site_name ?? 'No site recorded']
  const names: string[] = [...new Set(docs.flatMap(keyOf))].sort()
  const none = docs.filter((d) => keyOf(d).length === 0)

  return (
    <div className="mt-1">
      {[...names.map((n) => ({ name: n, docs: docs.filter((d) => keyOf(d).includes(n)) })),
        ...(none.length ? [{ name: by === 'subject' ? 'No subject yet' : 'No site recorded', docs: none }] : []),
      ].map((g) => {
        const ag = [...new Set(g.docs.flatMap((d) => d.agencies ?? []))].sort()
        return (
          <div key={g.name} className="border-b border-gray-100 py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-gray-900">{g.name}</p>
                <p className="mt-0.5 text-[12px] text-gray-500">
                  {g.docs.length} document{g.docs.length === 1 ? '' : 's'}
                  {ag.length ? ` · ${ag.join(', ')}` : ' · no agency yet'}
                </p>
              </div>
              <div className="shrink-0 space-x-3 text-right">
                {ag.map((a) => (
                  <button key={a} disabled={busy || paused} onClick={() => onAudit(a)} className={ACTION_GREEN}>
                    Audit {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5 pl-0">
              {g.docs.map((d) => (
                <div key={d.document_id} className="flex items-center gap-3 py-1">
                  <button onClick={() => onOpenDoc(d.document_id)} title={d.title}
                    className={`min-w-0 flex-1 ${TITLE_LINE}`}>{d.title}</button>
                  {/* Decision 59: fixed and left-aligned, so the words line up down the group
                      however long the titles beside them are. 96px fits "Could not read". */}
                  <p className={`w-[96px] shrink-0 text-left text-[12px] ${AMBER_DOC.has(d.display_status) ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                    {DOC_STATUS[d.display_status] ?? d.display_status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <p className="mt-4 text-[12px] text-gray-500">
        Audits are run by agency. Grouping by {by} arranges what you hold; the action stays on the
        agency it would be run for.
      </p>
      {idx.agencies.length === 0 && (
        <p className="mt-2 text-[14px] text-gray-600">None of your documents carries an agency yet.</p>
      )}
    </div>
  )
}
