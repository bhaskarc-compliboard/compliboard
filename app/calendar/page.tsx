'use client'
/**
 * /calendar — THE CALENDAR, IN THE HR WORKSPACE'S FRAME. Calendar step 7 (`docs/CALENDAR-PLAN.md`
 * §2.4; boards 1, 3 and 7 as empty states).
 *
 * *** TWO OF THE FOUR TABS ARE BUILT: THE CALENDAR (steps 8a and 8b) AND DATES TO CONFIRM (step
 * 9). *** The Calendar tab holds board 4 (the month, the default), board 5 (the list), board 6's
 * drawer with both its tabs, board 9 (Add a date), board 11 (Send to your calendar) and printing.
 * Dates to confirm holds board 7, the work queue, over `components/DateQueue.tsx`. Ask a question
 * and Conversations still say which step brings them — step 10 — rather than offering a control
 * that does nothing, and those two sentences are STAGING PLACEHOLDERS listed in
 * `docs/HANDOFF-CODE.md` §7. `CLAUDE.md` §5.1: an empty state is a message, and "nothing here" is
 * a claim that has to be true.
 *
 * *** THE FRAME IS HR'S, AND IT IS IMPORTED, NOT COPIED. *** `AppLayout`, `Tabs`, `Empty`,
 * `AttachControl` and the button strings are the same files the HR page renders; the 900 column, the
 * serif title, the lede, the box and the counts line are HR's own classes copied character for
 * character from `app/hr/HrWorkspace.tsx` (the column :629, the title :631, the box and the counts
 * line :770–818), which is how `npm run measure` can compare the two and find them equal.
 *
 * WHAT IT READS, AND NOTHING ELSE: `calendar_v` for the two counts and the next date
 * (`lib/calendarCounts.ts`, the one filter the sidebar badge shares), and `topic_list_v` through
 * `readTopicList(supabase, 'calendar')` for the conversations — the first caller to pass that word
 * (migration 073 widened `topics_section_is_known`; step 10 is the first to WRITE one). Both read as
 * the signed-in person: `calendar_v` is `security_invoker`, so RLS decides what comes back and this
 * page never names a company, plus `document_index_v` for the queue's group headings. **It reaches
 * no model.** It writes only through `POST` and `PATCH /api/calendar` — `lib/calendarDates.ts`, the
 * one writer (decision 6) — so it builds no row and names no status.
 *
 * WHAT WENT WITH THE OLD PAGE (601 lines, replaced whole — "keep NOTHING of it"): the add form and
 * its `?add=`/`?on=` prefill, the month grid, the list, the import-a-file form over
 * `/api/extract-dates`, the tick (`completed`, which decision 11 abolished) and the × (DELETE,
 * which migration 073 took off `authenticated`) — the two controls `docs/HANDOFF-CODE.md` §7 has
 * carried as expected-broken since step 5. Nothing imported from that file: checked by grepping the
 * repository for `app/calendar` — the only matches were four comments naming its line numbers, and
 * those comments are corrected in this commit. `POST /api/calendar` stays and now has no screen
 * caller; `/api/extract-dates` stays with no caller at all, and step 12 retires both it and its
 * prompt.
 *
 * `?date=<calendar_events.id>` and `?finding=<audit finding id>` open the drawer on that row — both
 * report drawers send them (§187). A link that resolves to nothing says so in one line rather than
 * opening in silence (decision 30), and it says the same thing whether the date was removed, was
 * withdrawn by the newest reading, or belongs to another company: telling a stranger that an id
 * exists but is not theirs is the probe §3.6 answers 404 to.
 *
 * Every word on this page is the owner's (the step 7 and 8a briefs, and boards 3, 4 and 5).
 */
import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppLayout, { COUNTS_CHANGED } from '@/components/AppLayout'
import { Tabs } from '@/components/Tabs'
import { Empty } from '@/components/Empty'
import { readTopicList, type TopicRow } from '@/lib/topicList'
import { readCalendarCounts, infoBarParts, type CalendarCounts } from '@/lib/calendarCounts'
import {
  readCalendarRows, listGroups, monthGrid, monthTitle, shiftMonth, openingMonth, monthOf,
  repeatWords, whenWords, passedWords, metaParts, hasNoDay, resolveLink,
  siteChoices, filterBySite,
  WEEKDAYS, PER_DAY, MORE_WORD, UNDATED_GROUP, UNDATED_STRIP, NOT_ON_CALENDAR, NOT_CONFIRMED,
  COULD_NOT_LOAD,
  type CalendarRow,
} from '@/lib/calendarView'
import { CalendarDateDrawer, type DocumentFacts, type FindingFacts } from '@/components/CalendarDateDrawer'
import { AddDateSheet } from '@/components/AddDateSheet'
import { DateQueue } from '@/components/DateQueue'
import { CalendarAsk, type Exchange } from '@/components/CalendarAsk'
import { ConversationList } from '@/components/ConversationList'
import { Drawer, printDrawer } from '@/components/Drawer'
import { ReportView, WEB_SOURCE, type SourceShape, type ReportLike } from '@/components/ReportView'
import { AnswerBody, type AnswerSource } from '@/components/AnswerBody'
import { displayTitle } from '@/lib/listWords'
import { conversationStatus, friendlyDate } from '@/lib/conversationStatus'
import { CLAIM_WORDS } from '@/lib/topicClaim'
import { type DocumentHead } from '@/lib/calendarQueue'
import { SendCalendarSheet } from '@/components/SendCalendarSheet'
import DocumentReport from '@/components/DocumentReport'
import AuditReport from '@/components/AuditReport'
import { authHeaders } from '@/lib/supabase'
import { printWithFrame, printDate } from '@/lib/printFrame'

type Tab = 'ask' | 'conversations' | 'calendar' | 'dates'

/** The four tabs, in the owner's order. The key is also the `?tab=` word. */
const TAB_KEYS: readonly Tab[] = ['ask', 'conversations', 'calendar', 'dates'] as const
const asTab = (v: string | null): Tab =>
  (TAB_KEYS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'ask'

/** The owner's words, step 7. */
const LEDE = 'Every date your documents set, in one place. Ask when something is due, and we say '
  + 'where the date came from.'
/**
 * *** THE LAST STAGING PLACEHOLDER WENT WITH STEP 10b. *** Three sentences named the step that
 * would replace them — step 9's on Dates to confirm, step 10's under the Ask box, and the
 * Conversations tab's line for a row that could not exist yet. All three are gone, and so are
 * their rows in `docs/HANDOFF-CODE.md` §7. `CLAUDE.md` §5.1: an empty state is a message, and
 * "nothing here" is a claim that has to be true — which is now the only kind of empty state
 * this page draws.
 */
/**
 * THE INFO BAR ON THE CALENDAR TAB — board 4's line, which counts what the tab is showing rather
 * than what the whole section holds.
 */
const CALENDAR_BAR = (dates: number, waiting: number) =>
  `${dates} ${dates === 1 ? 'date' : 'dates'}${waiting > 0 ? `, ${waiting} not confirmed yet` : ''}. `
  + 'Click a date to see where it came from.'
/** What the drawer says about a conversation nobody has summarised yet — the workspace's words. */
const NOT_SUMMARISED =
  'This conversation has not been summarised yet. Open it and press "Summarise this conversation" when you are done.'
const SUMMARY_FAILED = 'That conversation could not be summarised just now. Nothing was changed. Please try again.'

/**
 * BOARD 4'S DOT, DRAWN AND NOT TYPED. The board writes it as ● and ○, and the first build put
 * those characters in the button. Two things were wrong with that: they are font-dependent
 * glyphs, so the mark is a different size and weight on a Mac and on Windows — the reason
 * `components/AppLayout.tsx` banned emoji from the nav — and they land in the element's text, so
 * the row's accessible name became "○Six-year internal maintenance…" and nothing could match the
 * title. A 7px circle, filled when confirmed and hollow when not, says the same thing in any font.
 */
const Dot = ({ confirmed, faint }: { confirmed: boolean; faint: boolean }) => (
  <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"
    className={`mt-[1px] shrink-0 ${faint ? 'text-gray-300' : 'text-[var(--green)]'}`}>
    <circle cx="4" cy="4" r="3" fill={confirmed ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

/**
 * THE DRAWER'S TWO TABS, DRAWN ABOVE A REPORT'S TITLE — board 6, kept visible while the report is
 * open. `Drawer`'s `topLine` slot is the header's own flow above the title (§147), which is where
 * Audits puts its way back; the Calendar puts the tab row there instead, so the two tabs stay in
 * the place they were and "The date" goes back to it.
 */
function ReportTabs({ onBack, second }: { onBack: () => void; second: string }) {
  return (
    <div className="no-print flex items-center gap-6 border-b border-gray-200">
      <button onClick={onBack}
        className="-mb-px border-b-2 border-transparent pb-2 text-[14px] font-medium text-gray-500 hover:text-gray-900">
        The date
      </button>
      <span className="-mb-px border-b-2 border-[var(--green)] pb-2 text-[14px] font-medium text-[var(--green-ink)]">
        {second}
      </span>
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[14px] text-gray-400">Loading…</div>}>
      <Calendar />
    </Suspense>
  )
}

function Calendar() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  /** The two links both report drawers send (§187). Step 8a opens the drawer on them. */
  const linkedDate = params.get('date')
  const linkedFinding = params.get('finding')
  /**
   * A LINK TO ONE DATE LANDS ON THE TAB THE DATE LIVES ON. The drawer is mounted outside the tab
   * bodies, so without this it opened over "Ask a question" — and closing it left the person on a
   * chat box they never asked for. Neither report drawer sends `?tab=`, and asking Documents and
   * Audits to add one would put the Calendar's layout into two other sections' links.
   */
  const tab = asTab(params.get('tab') ?? ((linkedDate || linkedFinding) ? 'calendar' : null))

  const [topics, setTopics] = useState<TopicRow[]>([])
  const [counts, setCounts] = useState<CalendarCounts>({ dates: 0, toConfirm: 0, nextDate: null })
  const [rows, setRows] = useState<CalendarRow[]>([])
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [companyName, setCompanyName] = useState<string | null>(null)
  /** Month is the default view, as board 4 is the tab's first board. */
  const [view, setView] = useState<'month' | 'list'>('month')
  /** Board 4's site filter. 'all' is off, and with one site it is never drawn (decision 24). */
  const [siteFilter, setSiteFilter] = useState('all')
  /** Board 11, opened from the info bar. */
  const [sending, setSending] = useState(false)
  const [month, setMonth] = useState<string | null>(null)
  /**
   * *** WHICH DATE IS OPEN IS THE ADDRESS, NOT A PIECE OF STATE. ***
   * `?date=` is what both report drawers already send, what the monthly email will send at step 11,
   * and what this page writes when a row is clicked — so storing "which drawer is open" beside it
   * would be two answers to one question, and the first effect written here did exactly that: it
   * watched the parameter and copied it into state, which React's own lint calls a cascading
   * render and which would have let the two disagree after a Back. Derived, they cannot.
   */
  /** The read did not answer. NOT the same state as "there are none" (§5.1). */
  const [loadFailed, setLoadFailed] = useState(false)
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([])
  /**
   * WHAT THE QUEUE'S GROUP HEADINGS NEED BEYOND THE ROW — the document's kind word and the day the
   * reading ran (`document_index_v.kind`, `.scanned_at`). The view the dates come from carries the
   * document's TITLE and nothing else about it, and "a document, its kind word, when it was read"
   * is the owner's heading for step 9. One read of the company's documents, not one per group.
   */
  const [heads, setHeads] = useState<Record<string, DocumentHead>>({})
  /**
   * THE SECOND TAB, MOUNTED THE WAY AUDITS MOUNTS ONE (`app/audits/page.tsx:792–833`): the date's
   * drawer goes `hidden` and the report's own drawer takes its place, so the report is byte-for-byte
   * what Documents and Audits show and neither shared file changes. The tab row rides along in the
   * report's `topLine`, so "The date" is one click away in the place it already was.
   */
  const [report, setReport] = useState<{ kind: 'document' | 'audit'; id: string } | null>(null)
  /** A document opened FROM an audit report, as Audits does it — the third level. */
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [extra, setExtra] = useState<{ id: string; document: DocumentFacts | null; finding: FindingFacts | null } | null>(null)
  /**
   * *** NOTHING IS CLAIMED BEFORE THE READ ANSWERS. *** "No dates yet" drawn while the query is in
   * flight is a sentence that is false for a second on every visit, and false for longer on a slow
   * connection — and for a company whose dates ARE there it is the worst kind of wrong, because it
   * reads as data loss. Until this is true the tabs show no counts and the bodies show one grey line.
   */
  const [loaded, setLoaded] = useState(false)

  // The composer, its examples and its attach line moved into `components/CalendarAsk.tsx` with
  // the ask view at step 10b; the page keeps the frame, the counts and the other three tabs.

  /**
   * ONE READ OF EVERYTHING THE PAGE DRAWS, as the caller. `calendar_v` is `security_invoker`, so
   * RLS decides what comes back and this page names no company.
   *
   * `entities` is counted and not listed, because the only question asked of it is decision 24's:
   * does this company have more than one site? With one site, nothing about sites shows anywhere
   * (`lib/calendarView.ts` `siteWords`). `profiles` is read for the full names behind
   * "confirmed by…" and "added by…" — its own policy already scopes it to the company.
   */
  const load = useCallback(async () => {
    let c, t, r, siteRows, people, folderRows, docRows
    try {
      [c, t, r, siteRows, people, folderRows, docRows] = await Promise.all([
        readCalendarCounts(supabase),
        readTopicList(supabase, 'calendar'),
        readCalendarRows(supabase),
        // The sites themselves, not just how many: decision 24 needs the count to decide whether
        // to say anything at all, and the filter and the Add sheet need the names.
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name'),
        // The folder list `DocumentReport` files a document into. Documents and Audits each hand it
        // the list they already hold rather than making the drawer fetch one; so does this.
        supabase.from('company_folders').select('id, name').order('name'),
        // The queue's group headings. `document_index_v` is `security_invoker` like everything else
        // this page reads, so RLS decides what comes back.
        supabase.from('document_index_v').select('document_id, kind, scanned_at'),
      ])
    } catch (err) {
      // *** A READ THAT FAILED IS NOT AN EMPTY CALENDAR. *** Drawing "No dates yet" here would be
      // the product asserting something about the customer's compliance on the strength of a query
      // that never answered — §5.1's worked example, and it happened once during this step's own
      // screenshots. `loaded` is set so the page stops saying "Loading…"; `loadFailed` is what it
      // says instead.
      console.error('calendar: load', err)
      setLoadFailed(true)
      setLoaded(true)
      return []
    }
    setLoadFailed(false)
    setCounts(c)
    setTopics(t)
    setRows(r)
    setSites((siteRows.data ?? []) as Array<{ id: string; name: string }>)
    setNames(Object.fromEntries(((people.data ?? []) as Array<{ id: string; full_name: string | null }>)
      .filter((x) => x.full_name).map((x) => [x.id, x.full_name as string])))
    setFolders((folderRows.data ?? []) as Array<{ id: string; name: string }>)
    setHeads(Object.fromEntries(
      ((docRows.data ?? []) as Array<{ document_id: string; kind: string | null; scanned_at: string | null }>)
        .map((d) => [d.document_id, { kind: d.kind, scanned_at: d.scanned_at }])))
    setLoaded(true)
    return r
  }, [supabase])

  /**
   * *** EVERY NUMBER ON THE PAGE, AND THE ONE IN THE NAV, AFTER A WRITE — step 9. ***
   *
   * `load()` re-reads the counts and the rows together, so the two tab labels, the info bar and
   * both views move in one render. The sidebar badge is not this page's to render — it lives in
   * `AppLayout`, which wraps every page — so it is told, with the event `AppLayout` listens for.
   * Without this the nav would read "9" beside a queue saying "Nothing waiting", which is exactly
   * the disagreement `lib/calendarCounts.ts` exists to prevent.
   */
  const refresh = useCallback(async () => {
    await load()
    window.dispatchEvent(new Event(COUNTS_CHANGED))
  }, [load])

  useEffect(() => {
    let live = true
    ;(async () => {
      await load()
      if (!live) return
      const { data: co } = await supabase.from('companies').select('name').limit(1).maybeSingle()
      if (live) setCompanyName((co as { name?: string } | null)?.name ?? null)
    })()
    return () => { live = false }
  }, [supabase, load])

  /**
   * THE TAB IS IN THE ADDRESS, so a link can open one — `app/audits/page.tsx:421–425`, copied. It is
   * Audits' pattern and not HR's for a measured reason: HR keeps its tab in `useState` and reads only
   * `?handbook=`, so there is nothing of HR's to copy here, and the Calendar needs the address
   * because steps 8 and 9 are linked to from the report drawers and from the monthly email.
   * `replace`, not `push`: four tabs on one page are not four places a Back button should walk.
   */
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString())
    if (v === null) p.delete(k); else p.set(k, v)
    router.replace(`/calendar${p.toString() ? `?${p}` : ''}`, { scroll: false })
  }
  const selectTab = (k: Tab) => setParam('tab', k === 'ask' ? null : k)

  /**
   * THE SIDE LINK, HR'S CONTROL AS AN `<a href>` — "+ New conversation" on the two conversation tabs,
   * "+ Add a date" on the two date tabs. Both only change the address (`?tab=…&new=1`); steps 8 to 10
   * give them behaviour, and an href is what lets that happen with no handler to write twice.
   */
  const newHref = (() => {
    const p = new URLSearchParams(params.toString())
    p.set('tab', tab)
    p.set('new', '1')
    return `/calendar?${p}`
  })()
  const sideLabel = tab === 'calendar' || tab === 'dates' ? 'Add a date' : 'New conversation'

  const bar = infoBarParts(counts, topics.length)
  /** A grey line while the read is in flight, in the Suspense fallback's words. */
  const waiting = <p className="pt-4 text-[14px] text-gray-400">Loading…</p>

  /**
   * A LINK FROM SOMEWHERE ELSE — `?date=<calendar_events.id>` from the Documents drawer and
   * `?finding=<audit finding id>` from an audit's, resolved against the rows already read. No
   * second query, and therefore no way for the drawer to show a row the two views do not.
   *
   * *** NOT FINDING IT IS AN ANSWER, NOT A SILENCE *** (decision 30). A link can point at a date
   * that has since been removed, that the newest reading withdrew (step 6b — `calendar_v` does not
   * return it), or that belongs to another company — which simply is not in `rows`, because RLS
   * decided that, not this page. All three land the same way and say the same true thing; none of
   * them says which, because telling a stranger that an id EXISTS but is not theirs is the probe
   * §3.6 answers 404 to.
   */
  const open = resolveLink(rows, linkedDate, linkedFinding)
  const linkMissed = loaded && !!(linkedDate || linkedFinding) && !open
  /**
   * THE ASK TAB'S CONVERSATION. `askTopicId` is the open one; `askInitial` is what a reopened
   * conversation's stored turns rebuild into. `CalendarAsk` is keyed on the topic, so opening
   * another conversation — or starting a new one — gives it fresh state with nothing to reset.
   */
  const [askTopicId, setAskTopicId] = useState<string | null>(null)
  const [askInitial, setAskInitial] = useState<Exchange[]>([])
  const [askKey, setAskKey] = useState(0)
  /** The conversation open in the summary drawer, and the summary being written for one. */
  const [convDrawer, setConvDrawer] = useState<TopicRow | null>(null)
  const [summaryWait, setSummaryWait] = useState<{ topicId: string; before: string | null } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /**
   * "SUMMARISE THIS CONVERSATION" — the workspace's shape, which HR copied and this copies from
   * HR: a 202 and then a poll, because the writer runs in `after()` and nobody is watching it.
   * A claim already held (409 `writing`) is not a failure — somebody else pressed it first.
   */
  const summaryRunning = (id: string | null) =>
    !!id && (summaryWait?.topicId === id || !!topics.find((t) => t.id === id)?.summaryInProgress)

  async function summarise(id: string) {
    if (summaryRunning(id)) return
    setNotice(null)
    const before = topics.find((t) => t.id === id)?.summarised_at ?? null
    setSummaryWait({ topicId: id, before })
    let res: Response | null = null
    try {
      res = await fetch(`/api/calendar/topics/${id}/summarise`,
        { method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }) })
    } catch { res = null }
    const j = res ? await res.json().catch(() => null) : null
    if (res && (res.status === 202 || (res.status === 409 && j?.status === 'writing'))) {
      setTopics(await readTopicList(supabase, 'calendar'))
      return
    }
    setNotice(j?.error ?? SUMMARY_FAILED)
    setSummaryWait(null)
  }

  /**
   * THE POLL, every 5 seconds while a summary is being written here or anywhere. When this tab's
   * own claim clears, the summary opens in the drawer; if it cleared with nothing new, the
   * failure is said plainly rather than left as a spinner that stops (§5.1).
   */
  const summaryWatching = !!summaryWait || topics.some((t) => t.summaryInProgress)
  useEffect(() => {
    if (!summaryWatching) return
    const t = setInterval(async () => {
      const list = await readTopicList(supabase, 'calendar')
      setTopics(list)
      setConvDrawer((d) => (d ? list.find((r) => r.id === d.id) ?? d : d))
      setSummaryWait((w) => {
        if (!w) return w
        const row = list.find((r) => r.id === w.topicId)
        if (!row || row.summaryInProgress) return w
        if (row.summarised_at && row.summarised_at !== w.before) setConvDrawer(row)
        else setNotice(SUMMARY_FAILED)
        return null
      })
    }, 5000)
    return () => clearInterval(t)
  }, [summaryWatching, supabase])

  /**
   * A CONVERSATION REOPENED ON THE ASK TAB, the workspace's way: `/api/topics/[id]`, which is
   * section-agnostic and scoped by RLS, so nothing new was needed for the Calendar.
   */
  async function openConversation(t: TopicRow) {
    setNotice(null)
    const res = await fetch(`/api/topics/${t.id}`, { headers: await authHeaders() })
    const j = await res.json().catch(() => null)
    if (!res.ok) { setNotice(j?.error ?? 'That conversation could not be opened. Please try again.'); return }
    const turns = (j.turns ?? []) as Array<{ role: string; text: string; sources: AnswerSource[] | null }>
    const rebuilt: Exchange[] = []
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].role !== 'user') continue
      const a = turns[i + 1]?.role === 'assistant' ? turns[i + 1] : null
      rebuilt.push({ id: `r${i}`, question: turns[i].text, text: a?.text ?? '', sources: a?.sources ?? [],
        offers: [], phase: a ? 'done' : 'failed', searches: 0,
        ...(a ? {} : { error: 'That question was not answered.' }) })
    }
    setAskInitial(rebuilt)
    setAskTopicId(t.id)
    setAskKey((n) => n + 1)
    setConvDrawer(null)
    selectTab('ask')
  }

  /**
   * THE DRAWER'S REPORT, read as the caller when a conversation is opened. `topic_list_v` carries
   * whether a report exists (`hasReport`) but not the report itself — HR reads it the same way
   * (`app/hr/HrWorkspace.tsx:447`), because a list of twenty conversations must not carry twenty
   * reports to show one.
   */
  const [convReport, setConvReport] = useState<{ id: string; report: unknown | null } | null>(null)
  const convDrawerId = convDrawer?.id ?? null
  const convSummarisedAt = convDrawer?.summarised_at ?? null
  useEffect(() => {
    let live = true
    // No synchronous reset when the drawer closes: the render below already ignores a report
    // whose id is not the open one (`convReport?.id === convDrawer.id`), and clearing it here is
    // the setState-inside-an-effect React's own lint rule refuses.
    if (!convDrawerId) return
    ;(async () => {
      const { data } = await supabase.from('topics').select('summary_report').eq('id', convDrawerId).maybeSingle()
      if (live) setConvReport({ id: convDrawerId, report: (data as { summary_report?: unknown } | null)?.summary_report ?? null })
    })()
    return () => { live = false }
  }, [supabase, convDrawerId, convSummarisedAt])

  /** `?new=1` — what the side link has written since step 7, now with the sheet behind it. */
  const adding = params.get('new') === '1'
  /**
   * *** "+ NEW CONVERSATION" IS A BUTTON HERE AND A LINK ON THE DATE TABS, and that split is the
   * lint rule's doing as much as the design's. *** Since step 7 the side control has only written
   * `?new=1`; on the two date tabs that still opens Add a date. On the two conversation tabs it
   * now has to clear the conversation, which is a state change — and written as an effect
   * watching the parameter, React's own rule refuses it ("Avoid calling setState() directly
   * within an effect"), rightly: the reset belongs to the press, not to a render that notices
   * the address changed. The same answer as step 8a's, from the other side.
   */
  const startNewConversation = () => {
    setAskTopicId(null)
    setAskInitial([])
    setAskKey((n) => n + 1)
    setNotice(null)
    setConvDrawer(null)
    selectTab('ask')
  }

  const closeAdd = () => {
    const p = new URLSearchParams(params.toString())
    p.delete('new')
    router.replace(`/calendar${p.toString() ? `?${p}` : ''}`, { scroll: false })
  }

  /**
   * WHAT THE DRAWER NEEDS BEYOND THE ROW, read when it opens and not before: the document's own
   * state, whether a newer version of it exists (decision 14), and the audit finding behind an
   * audit date. Three small reads for one date beat five joined columns on every row of the grid.
   */
  const openId = open?.id ?? null
  const openDocFor = open?.document_id ?? null
  const openFindingId = open?.audit_finding_id ?? null
  useEffect(() => {
    let live = true
    if (!openId) return
    ;(async () => {
      let document: DocumentFacts | null = null
      let finding: FindingFacts | null = null
      if (openDocFor) {
        const [d, newer] = await Promise.all([
          supabase.from('document_index_v')
            .select('document_id, title, file_name, kind, issuer, display_status, document_status')
            .eq('document_id', openDocFor).maybeSingle(),
          // Decision 14: somebody uploaded a newer version of the file this date was read from.
          supabase.from('document_index_v').select('document_id').eq('version_of', openDocFor).limit(1),
        ])
        const row = d.data as Omit<DocumentFacts, 'hasNewerVersion'> | null
        if (row) document = { ...row, hasNewerVersion: ((newer.data ?? []) as unknown[]).length > 0 }
      }
      if (openFindingId) {
        const { data } = await supabase.from('audit_findings')
          .select('id, title, quote, locator, run_id').eq('id', openFindingId).maybeSingle()
        finding = (data as FindingFacts | null) ?? null
      }
      // Stamped with the row it belongs to, so a slow read landing after the drawer has moved on
      // cannot put one date's document under another date's title.
      if (live) setExtra({ id: openId, document, finding })
    })()
    return () => { live = false }
  }, [supabase, openId, openDocFor, openFindingId])
  const shown = extra && extra.id === openId ? extra : { document: null, finding: null }

  /** Open a date: the address, which the drawer is derived from, so a reload opens the same one. */
  const openDate = (id: string) => {
    setReport(null)
    setOpenDocId(null)
    const p = new URLSearchParams(params.toString())
    p.delete('finding'); p.set('date', id)
    router.replace(`/calendar?${p}`, { scroll: false })
  }
  const closeDate = () => {
    setReport(null)
    setOpenDocId(null)
    const p = new URLSearchParams(params.toString())
    p.delete('date'); p.delete('finding')
    router.replace(`/calendar${p.toString() ? `?${p}` : ''}`, { scroll: false })
  }

  /**
   * THE SITE FILTER NARROWS WHAT THE TAB DRAWS, AND NOTHING ELSE. The month, the list, the strip
   * and the info bar's own numbers all read `shownRows`. **The tab labels and the sidebar badge
   * keep the company's totals on purpose**: they are the section's count of work waiting, the
   * badge is read on every page in the product where no filter exists, and a badge that followed a
   * filter would disagree with the page the moment somebody picked a site — which is the 29
   * September failure `components/AppLayout.tsx` carries in full.
   */
  const shownRows = filterBySite(rows, siteFilter)
  const groups = listGroups(shownRows)
  const undated = groups.undated
  /** The month shown: the one chosen, else the linked date's, else the soonest date still ahead. */
  const monthKey = month
    ?? (open && !hasNoDay(open) ? monthOf(open.next_due) : null)
    ?? openingMonth(shownRows, new Date().toISOString().slice(0, 10))
  const cells = monthGrid(monthKey, shownRows)
  const today = new Date().toISOString().slice(0, 10)

  /** One date on a day box — board 4. */
  const dateButton = (r: CalendarRow) => (
    <button key={r.id} onClick={() => openDate(r.id)} title={r.title}
      className={`flex w-full items-start gap-1 truncate text-left text-[11px] leading-tight hover:underline ${
        r.has_passed ? 'text-gray-400' : 'text-gray-700'}`}>
      <Dot confirmed={r.status === 'confirmed'} faint={!!r.has_passed} />
      <span className="truncate">{r.title}</span>
    </button>
  )

  /**
   * THE LIST — board 5, and the one the printer gets. It is a variable rather than inline markup
   * because it is drawn in two places: as the List view, and, hidden on screen, under the month
   * grid so that **a printed calendar is always the list**. A month grid on paper is six boxes of
   * truncated titles; the list prints every date with where it came from, which is what somebody
   * carries into a meeting. HR prints a conversation the same way (`printWithFrame`), and the
   * shared frame puts the company and the page numbers in the margins (board 10).
   */
  const listBody = (
    <>
                {/* THE LIST — board 5. Grouped by month, soonest first; the dates with no day last. */}
                {groups.months.map((g) => (
                  <div key={g.key} className="mt-5">
                    <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-500">{g.title}</p>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                      {g.rows.map((r) => (
                        <button key={r.id} onClick={() => openDate(r.id)}
                          className="group -mx-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white">
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[13px] group-hover:text-[var(--green)] ${
                              r.has_passed ? 'text-gray-400' : 'text-gray-900'}`}>{r.title}</span>
                            <span className="mt-0.5 block truncate text-[12px] text-gray-500">
                              {metaParts(r, sites.length, r.added_by ? names[r.added_by] : null).map((part, i) => (
                                <span key={i}>
                                  {i > 0 && <span aria-hidden="true"> · </span>}
                                  <span className={part === passedWords(r) ? 'text-[var(--amber)]' : ''}>{part}</span>
                                </span>
                              ))}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] text-gray-400">{whenWords(r)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {undated.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-400">{UNDATED_GROUP}</p>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                      {undated.map((r) => (
                        <button key={r.id} onClick={() => openDate(r.id)}
                          className="group -mx-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">{r.title}</span>
                            <span className="mt-0.5 block truncate text-[12px] text-gray-500">
                              {metaParts(r, sites.length, r.added_by ? names[r.added_by] : null).join(' · ')}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] text-gray-400">{whenWords(r)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
    </>
  )

  return (
    <AppLayout>
      {/* The 900 column, the same as /hr and /compliance (`app/hr/HrWorkspace.tsx:629`). */}
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="no-print pt-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">Calendar</h1>
          <p className="mt-1 text-[14px] text-gray-500">{LEDE}</p>
        </div>

        <Tabs active={tab} onSelect={selectTab}
          tabs={[
            { key: 'ask', label: 'Ask a question' },
            { key: 'conversations', label: 'Conversations' },
            // A count of 0 is hidden, and so is a count nobody has read yet (the owner's rule for
            // zero, and `loaded` for the second half of it).
            { key: 'calendar', label: `Calendar${loaded && counts.dates > 0 ? ` (${counts.dates})` : ''}` },
            { key: 'dates', label: `Dates to confirm${loaded && counts.toConfirm > 0 ? ` (${counts.toConfirm})` : ''}` },
          ]}
          right={
            // The same control, twice: a LINK on the date tabs (it writes `?new=1`, which Add a
            // date reads) and a BUTTON on the conversation tabs (it clears the conversation).
            tab === 'calendar' || tab === 'dates' ? (
              <a href={newHref}
                className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                <span className="hidden sm:inline">{sideLabel}</span>
              </a>
            ) : (
              <button onClick={startNewConversation}
                className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                <span className="hidden sm:inline">{sideLabel}</span>
              </button>
            )
          } />

        {/* A link that pointed at a date the calendar no longer carries (decision 30). */}
        {linkMissed && (
          <div className="no-print mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
            {NOT_ON_CALENDAR}
          </div>
        )}

        {/* ================= ASK A QUESTION — boards 1 and 2 ================= */}
        {tab === 'ask' && (
          <div>
            {/*
              *** THE KEY IS `askKey` ALONE, AND IT HELD THE TOPIC ID FOR ONE WALK. ***
              Keying on the conversation is the obvious thing and it is wrong: the FIRST answer of
              a new conversation sets the topic id, so the key changed from "new" to the id in the
              same render — React remounted the ask view and the answer that had just arrived
              vanished, leaving an empty box and a conversation count one higher. Measured on the
              isolated server, step 10b's first walk. `askKey` changes only when a person opens
              another conversation or starts a new one, which are the two times the view SHOULD be
              fresh.
            */}
            <CalendarAsk
              key={askKey}
              rows={rows}
              companyName={companyName}
              topicId={askTopicId}
              initial={askInitial}
              onTopicId={setAskTopicId}
              onChanged={refresh}
              onSummarise={summarise}
              summaryBusy={summaryRunning(askTopicId)}
            />
            {notice && (
              <div className="no-print mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                {notice}
                <button onClick={() => setNotice(null)} className="ml-3 underline">Dismiss</button>
              </div>
            )}

            {/* THE INFO BAR, HR's counts line and its rule for zero: a fragment whose number is 0
                is left out, "next date" is left out when nothing is ahead, and all four zero draws
                no bar at all (`lib/calendarCounts.ts`, where that rule is tested). */}
            {loaded && bar.length > 0 && (
              <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                <p className="text-[13px] text-gray-500">{bar.join(' · ')}</p>
              </div>
            )}
          </div>
        )}

        {/* ================= CONVERSATIONS — HR's board 9, its list and its drawer ================= */}
        {tab === 'conversations' && (
          <div className="pt-1">
            {!loaded ? waiting : topics.length === 0 ? (
              <Empty title="No conversations yet"
                note="Ask a question and the answer is kept here, with the dates and documents it drew on." />
            ) : (
              <ConversationList topics={topics} running={(t, kind) => kind === 'summary' && summaryRunning(t.id)}
                onOpen={setConvDrawer} />
            )}
          </div>
        )}

        {/* ================= CALENDAR — boards 3, 4 and 5 ================= */}
        {tab === 'calendar' && (
          <div className="pt-1">
            {!loaded ? waiting : loadFailed ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                {COULD_NOT_LOAD}
                <button onClick={() => { void load() }} className="ml-2 font-medium underline hover:no-underline">Try again</button>
              </p>
            ) : rows.length === 0 ? (
              <Empty title="No dates yet"
                note="Add your permits, certificates and reports in Company Documents. The dates they set show up here, with the line they came from." />
            ) : (<>
              {/* Board 4's info bar: what this tab is showing, and the Month/List switch at the
                  right, Month first. The site filter and the whole-calendar feed the board also
                  draws there are step 8b's and step 11's; neither is faked here. */}
              <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                <p className="text-[13px] text-gray-500">
                  {CALENDAR_BAR(shownRows.length, shownRows.filter((r) => r.status === 'proposed').length)}
                </p>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-[13px]">
                  {(['month', 'list'] as const).map((v) => (
                    <button key={v} onClick={() => setView(v)}
                      className={view === v ? 'font-medium text-[var(--green-ink)]' : 'text-gray-500 hover:text-gray-900'}>
                      {v === 'month' ? 'Month' : 'List'}
                    </button>
                  ))}
                  {/* The site filter, only when there is a choice to make — decision 24. */}
                  {sites.length > 1 && (<>
                    <span aria-hidden="true" className="text-gray-300">·</span>
                    <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
                      aria-label="Which site"
                      className="cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1 text-[13px] text-gray-700 outline-none focus:border-[var(--green)]">
                      {siteChoices(rows, sites).map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </>)}
                  <span aria-hidden="true" className="text-gray-300">·</span>
                  {/* Board 4's own link, opening board 11. */}
                  <button onClick={() => setSending(true)}
                    className="text-gray-500 underline hover:text-gray-900">Send to your calendar</button>
                  <span aria-hidden="true" className="text-gray-300">·</span>
                  {/* The shared print frame, as HR prints a conversation (`app/hr/HrWorkspace.tsx:744`). */}
                  <button onClick={() => printWithFrame({ company: companyName ?? '', type: 'Calendar' })}
                    className="text-gray-500 underline hover:text-gray-900">Print</button>
                </div>
              </div>

              {view === 'month' ? (<>
                {/* THE MONTH BAR — the month, and the three ways to move. */}
                <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-serif text-[18px] text-gray-900">{monthTitle(monthKey)}</p>
                  <div className="flex items-center gap-4 text-[13px]">
                    <button onClick={() => setMonth(shiftMonth(monthKey, -1))} className="text-gray-500 hover:text-gray-900">
                      ‹ {monthTitle(shiftMonth(monthKey, -1)).split(' ')[0]}
                    </button>
                    <button onClick={() => setMonth(monthOf(today))} className="text-[var(--green-ink)] hover:underline">Today</button>
                    <button onClick={() => setMonth(shiftMonth(monthKey, 1))} className="text-gray-500 hover:text-gray-900">
                      {monthTitle(shiftMonth(monthKey, 1)).split(' ')[0]} ›
                    </button>
                  </div>
                </div>

                {/* A DATE WITH NO DAY CANNOT SIT ON A GRID (decisions 12 and 23), and leaving it out
                    of the month view with no word would be the calendar quietly dropping dates it
                    has. The strip says how many and lists them, each opening the same drawer. */}
                {undated.length > 0 && (
                  <div className="no-print mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5">
                    <p className="text-[12px] font-medium text-gray-600">{UNDATED_STRIP(undated.length)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      {undated.map((r) => (
                        <button key={r.id} onClick={() => openDate(r.id)}
                          className="max-w-full truncate text-left text-[12px] text-gray-600 underline hover:text-gray-900">
                          {r.title}{repeatWords(r) ? ` · ${repeatWords(r)}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* THE GRID. Seven equal columns, six equal rows: `grid-rows-6` with a fixed row
                    height, so a busy day scrolls inside its box and the month never changes shape
                    under the pointer when you press next (board 4). */}
                <div className="no-print mt-3 grid grid-cols-7 border-l border-t border-gray-200">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="border-b border-r border-gray-200 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">{d}</div>
                  ))}
                  {cells.map((c) => {
                    const shown = c.rows.slice(0, PER_DAY)
                    const rest = c.rows.length - shown.length
                    return (
                      <div key={c.day}
                        className={`h-[92px] overflow-hidden border-b border-r border-gray-200 px-1.5 pb-1 pt-1 ${c.inMonth ? '' : 'bg-gray-50/60'}`}>
                        <div className="mb-0.5 flex items-center gap-1">
                          <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] ${
                            c.day === today ? 'bg-[var(--green)] font-medium text-white'
                              : c.inMonth ? 'text-gray-600' : 'text-gray-300'}`}>{c.n}</span>
                        </div>
                        <div className="space-y-0.5">
                          {shown.map(dateButton)}
                          {rest > 0 && (
                            <button onClick={() => setView('list')}
                              className="text-[11px] text-gray-500 underline hover:text-gray-900">{MORE_WORD(rest)}</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="no-print mt-2 flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
                  <span className="inline-flex items-center gap-1.5"><Dot confirmed faint={false} />confirmed</span>
                  <span className="inline-flex items-center gap-1.5"><Dot confirmed={false} faint={false} />{NOT_CONFIRMED}</span>
                  {undated.length > 0 && <span>{UNDATED_STRIP(undated.length)} — see the list</span>}
                </div>
                {/* On paper the month is the list: see `listBody`. */}
                <div className="hidden print:block">{listBody}</div>
              </>) : listBody}
            </>)}
          </div>
        )}

        {/* ================= DATES TO CONFIRM — board 7, the work queue ================= */}
        {tab === 'dates' && (
          <div className="pt-1">
            {!loaded ? waiting : loadFailed ? (
              /**
               * *** A READ THAT FAILED IS NOT AN EMPTY QUEUE, AND THIS TAB SAID IT WAS. ***
               * Until step 9 this branch did not exist here: the tab tested `counts.toConfirm === 0`,
               * and a failed read leaves that 0 — so a company with nine dates waiting was told
               * "Nothing waiting". The Calendar tab was given this guard at step 8a after the same
               * thing happened to it in front of a screenshot (`lib/calendarView.ts` carries the
               * full account); the queue inherited the bug and not the fix. §5.1's worked example.
               */
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                {COULD_NOT_LOAD}
                <button onClick={() => { void load() }} className="ml-2 font-medium underline hover:no-underline">Try again</button>
              </p>
            ) : (
              <DateQueue rows={rows} heads={heads} siteCount={sites.length}
                onOpen={openDate} onChanged={refresh} />
            )}
          </div>
        )}
      </div>

      {/* ONE DATE, OPENED — board 6's first tab. It is mounted outside the column because the
          shared drawer is `position: fixed`, as it is on Documents and Audits. `hidden` while a
          report is over it, exactly as `app/audits/page.tsx:792` hides the audit behind a document. */}
      {open && (
        <div className={report || openDocId ? 'hidden' : ''}>
        <CalendarDateDrawer
          key={open.id}
          data={{
            row: open,
            // The other LIVE dates the same document sets — the view's rows, not a second read, so
            // the drawer can never list a date the calendar itself does not show.
            siblings: open.document_id
              ? rows.filter((r) => r.id !== open.id && r.document_id === open.document_id)
              : [],
            document: shown.document,
            finding: shown.finding,
            names,
            siteCount: sites.length,
          }}
          company={companyName}
          onClose={closeDate}
          onOpenOther={openDate}
          onChanged={() => { void refresh() }}
          /**
           * The second tab exists only when there is a report behind it: a document's reading, or
           * the audit that found the date. A typed date has neither, so the tab is not drawn at all
           * — there is nothing for it to show later, and a disabled tab promises one.
           */
          onOpenReport={
            open.source === 'audit' && extra?.id === open.id && extra.finding?.run_id
              ? () => setReport({ kind: 'audit', id: extra.finding!.run_id as string })
              : open.document_id
              ? () => setReport({ kind: 'document', id: open.document_id as string })
              : null
          }
        />
        </div>
      )}

      {/*
        THE SECOND TAB'S CONTENT — the real report, mounted over the date's drawer. The tab row
        travels with it in `topLine`, so the two tabs stay where they were and "The date" goes back.
      */}
      {open && report && !openDocId && (
        report.kind === 'audit' ? (
          <AuditReport runId={report.id} companyName={companyName}
            onClose={closeDate} onChanged={() => { void refresh() }}
            onOpenDoc={(id) => setOpenDocId(id)}
            topLine={<ReportTabs onBack={() => setReport(null)} second="The audit" />} />
        ) : (
          <DocumentReport documentId={report.id} companyName={companyName} folders={folders}
            onClose={closeDate} onChanged={() => { void refresh() }}
            onMove={async (documentId, folderId) => {
              await fetch('/api/documents', {
                method: 'PATCH',
                headers: await authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ id: documentId, folder_id: folderId }),
              })
              await load()
            }}
            /* This page has no file picker, and building a second upload path here would be two of
               them. Documents is the upload surface and shows the hint it is sent — the same answer
               `app/audits/page.tsx:833` gives. */
            onPickFile={() => { window.location.href = '/documents?add=a+clearer+copy' }}
            topLine={<ReportTabs onBack={() => setReport(null)} second={'The report'} />}
          />
        )
      )}

      {/* ================= THE CONVERSATION DRAWER — HR's, which is the workspace's ================= */}
      {convDrawer && (
        <div className="no-print fixed inset-0 z-[45] bg-gray-900/30" onClick={() => setConvDrawer(null)} />
      )}
      {convDrawer && (
        <Drawer title={displayTitle(convDrawer.title) ?? 'Conversation'}
          sub={`${friendlyDate(convDrawer.last_turn_at ?? convDrawer.created_at)} · ${conversationStatus(convDrawer, convDrawer.turnCount > 0).label}`}
          company={companyName}
          printType="Summary report"
          printDates={convDrawer.summarised_at
            ? `Summarised ${printDate(convDrawer.summarised_at)}`
            : `Last message ${printDate(convDrawer.last_turn_at ?? convDrawer.created_at)}`}
          onClose={() => setConvDrawer(null)}
          footer={
            <>
              {convDrawer.turnCount > 0 && (
                <button onClick={() => openConversation(convDrawer)}
                  className="rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50">
                  Open the conversation
                </button>
              )}
              <button onClick={() => summarise(convDrawer.id)} disabled={summaryRunning(convDrawer.id)}
                className="ml-3 text-[14px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
                {summaryRunning(convDrawer.id) ? CLAIM_WORDS.summary : 'Summarise this conversation'}
              </button>
              <button onClick={printDrawer} className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline">
                Download
              </button>
            </>
          }>
          <div className="flex min-h-full flex-col">
            {summaryRunning(convDrawer.id)
              ? <p className="text-[12px] text-gray-500">{CLAIM_WORDS.summary}</p>
              : convReport?.id === convDrawer.id && convReport.report
              ? <ReportView key={convDrawer.id} report={convReport.report as ReportLike<{ n: number; title: string; url: string }>}
                  factsLine={null} sourceShape={WEB_SOURCE as unknown as SourceShape<{ n: number; title: string; url: string }>} />
              : convDrawer.summary
              ? <AnswerBody text={convDrawer.summary} sources={[]} />
              : <p className="text-[14px] leading-relaxed text-gray-600">{NOT_SUMMARISED}</p>}
          </div>
        </Drawer>
      )}

      {/* SEND TO YOUR CALENDAR — board 11. It is handed `rows`, not `shownRows`: a subscription is
          the whole calendar, and a feed that quietly followed whichever site filter happened to be
          on when the link was made would be a calendar missing dates nobody could account for. */}
      {sending && <SendCalendarSheet rows={rows} onClose={() => setSending(false)} />}

      {/* ADD A DATE — board 9. Only on the two date tabs; "+ New conversation" writes the same
          `?new=1` on the other two and step 10 answers it there. */}
      {adding && (tab === 'calendar' || tab === 'dates') && (
        <AddDateSheet sites={sites} onClose={closeAdd}
          onSaved={async (id) => {
            await load()
            const p = new URLSearchParams(params.toString())
            p.delete('new'); p.delete('finding')
            p.set('tab', 'calendar')
            if (id) p.set('date', id)
            router.replace(`/calendar?${p}`, { scroll: false })
          }} />
      )}

      {/* A document opened FROM the audit report — Audits' third level, and the same way back. */}
      {openDocId && (
        <DocumentReport documentId={openDocId} companyName={companyName} folders={folders}
          onClose={() => setOpenDocId(null)} onChanged={() => { void refresh() }}
          onMove={async (documentId, folderId) => {
            await fetch('/api/documents', {
              method: 'PATCH',
              headers: await authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ id: documentId, folder_id: folderId }),
            })
            await load()
          }}
          onPickFile={() => { window.location.href = '/documents?add=a+clearer+copy' }}
          topLine={
            <button onClick={() => setOpenDocId(null)}
              className="cursor-pointer text-[13px] text-[var(--green)] underline hover:text-[var(--green-ink)]">
              ← Back to the audit
            </button>
          } />
      )}
    </AppLayout>
  )
}
