'use client'
/**
 * /calendar — THE CALENDAR, IN THE HR WORKSPACE'S FRAME. Calendar step 7 (`docs/CALENDAR-PLAN.md`
 * §2.4; boards 1, 3 and 7 as empty states).
 *
 * *** STEP 8a BUILT THE CALENDAR TAB; THE OTHER THREE ARE STILL SHELLS. *** The Calendar tab now
 * holds board 4 (the month, the default), board 5 (the list) and board 6's first tab (the date
 * drawer) with board 8's Remove sheet. Ask a question and Dates to confirm still say which step
 * brings them — steps 10 and 9 — rather than offering a control that does nothing, and those two
 * sentences are STAGING PLACEHOLDERS listed in `docs/HANDOFF-CODE.md` §7. `CLAUDE.md` §5.1: an
 * empty state is a message, and "nothing here" is a claim that has to be true.
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
 * page never names a company. **It writes nothing, calls no route and reaches no model.**
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
import { Suspense, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { Tabs } from '@/components/Tabs'
import { Empty } from '@/components/Empty'
import { AttachControl } from '@/components/AttachControl'
import { PRIMARY } from '@/components/buttonStyles'
import { CALENDAR_EXAMPLE_QUESTIONS } from '@/config/examples'
import { readTopicList, type TopicRow } from '@/lib/topicList'
import { readCalendarCounts, infoBarParts, type CalendarCounts } from '@/lib/calendarCounts'
import {
  readCalendarRows, listGroups, monthGrid, monthTitle, shiftMonth, openingMonth, monthOf,
  repeatWords, whenWords, passedWords, metaParts, hasNoDay, resolveLink,
  WEEKDAYS, PER_DAY, MORE_WORD, UNDATED_GROUP, UNDATED_STRIP, NOT_ON_CALENDAR, NOT_CONFIRMED,
  COULD_NOT_LOAD,
  type CalendarRow,
} from '@/lib/calendarView'
import { CalendarDateDrawer, type DocumentFacts, type FindingFacts } from '@/components/CalendarDateDrawer'

type Tab = 'ask' | 'conversations' | 'calendar' | 'dates'

/** The four tabs, in the owner's order. The key is also the `?tab=` word. */
const TAB_KEYS: readonly Tab[] = ['ask', 'conversations', 'calendar', 'dates'] as const
const asTab = (v: string | null): Tab =>
  (TAB_KEYS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'ask'

/** The owner's words, step 7. */
const LEDE = 'Every date your documents set, in one place. Ask when something is due, and we say '
  + 'where the date came from.'
/**
 * THE THREE STAGING PLACEHOLDERS. Each names the step that replaces it, and each is listed in
 * `docs/HANDOFF-CODE.md` §7. They are not polish-later wording: they are the honest answer to "why
 * is there nothing here", which is that this part is not built yet.
 */
const ASK_ARRIVES = 'Asking a question arrives with step 10.'
const DATES_ARRIVES = (n: number) =>
  `${n} ${n === 1 ? 'date' : 'dates'} waiting. This view arrives with step 9.`
/**
 * THE INFO BAR ON THE CALENDAR TAB — board 4's line, which counts what the tab is showing rather
 * than what the whole section holds.
 */
const CALENDAR_BAR = (dates: number, waiting: number) =>
  `${dates} ${dates === 1 ? 'date' : 'dates'}${waiting > 0 ? `, ${waiting} not confirmed yet` : ''}. `
  + 'Click a date to see where it came from.'
/** The conversations tab's own line for the case the owner's brief could not have: a row exists. */
const CONVERSATIONS_ARRIVE = (n: number) =>
  `${n} ${n === 1 ? 'conversation' : 'conversations'}. This view arrives with step 10.`

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

  const [box, setBox] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [counts, setCounts] = useState<CalendarCounts>({ dates: 0, toConfirm: 0, nextDate: null })
  const [rows, setRows] = useState<CalendarRow[]>([])
  const [siteCount, setSiteCount] = useState(0)
  const [names, setNames] = useState<Record<string, string>>({})
  const [companyName, setCompanyName] = useState<string | null>(null)
  /** Month is the default view, as board 4 is the tab's first board. */
  const [view, setView] = useState<'month' | 'list'>('month')
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
  const [extra, setExtra] = useState<{ id: string; document: DocumentFacts | null; finding: FindingFacts | null } | null>(null)
  /**
   * *** NOTHING IS CLAIMED BEFORE THE READ ANSWERS. *** "No dates yet" drawn while the query is in
   * flight is a sentence that is false for a second on every visit, and false for longer on a slow
   * connection — and for a company whose dates ARE there it is the worst kind of wrong, because it
   * reads as data loss. Until this is true the tabs show no counts and the bodies show one grey line.
   */
  const [loaded, setLoaded] = useState(false)

  // The composer grows with its text, exactly as HR's does (`app/hr/HrWorkspace.tsx`).
  useLayoutEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [box])

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
    let c, t, r, sites, people
    try {
      [c, t, r, sites, people] = await Promise.all([
        readCalendarCounts(supabase),
        readTopicList(supabase, 'calendar'),
        readCalendarRows(supabase),
        supabase.from('entities').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id, full_name'),
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
    setSiteCount(sites.count ?? 0)
    setNames(Object.fromEntries(((people.data ?? []) as Array<{ id: string; full_name: string | null }>)
      .filter((x) => x.full_name).map((x) => [x.id, x.full_name as string])))
    setLoaded(true)
    return r
  }, [supabase])

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
   * WHAT THE DRAWER NEEDS BEYOND THE ROW, read when it opens and not before: the document's own
   * state, whether a newer version of it exists (decision 14), and the audit finding behind an
   * audit date. Three small reads for one date beat five joined columns on every row of the grid.
   */
  const openId = open?.id ?? null
  const openDocId = open?.document_id ?? null
  const openFindingId = open?.audit_finding_id ?? null
  useEffect(() => {
    let live = true
    if (!openId) return
    ;(async () => {
      let document: DocumentFacts | null = null
      let finding: FindingFacts | null = null
      if (openDocId) {
        const [d, newer] = await Promise.all([
          supabase.from('document_index_v')
            .select('document_id, title, file_name, kind, issuer, display_status, document_status')
            .eq('document_id', openDocId).maybeSingle(),
          // Decision 14: somebody uploaded a newer version of the file this date was read from.
          supabase.from('document_index_v').select('document_id').eq('version_of', openDocId).limit(1),
        ])
        const row = d.data as Omit<DocumentFacts, 'hasNewerVersion'> | null
        if (row) document = { ...row, hasNewerVersion: ((newer.data ?? []) as unknown[]).length > 0 }
      }
      if (openFindingId) {
        const { data } = await supabase.from('audit_findings')
          .select('id, title, quote, locator').eq('id', openFindingId).maybeSingle()
        finding = (data as FindingFacts | null) ?? null
      }
      // Stamped with the row it belongs to, so a slow read landing after the drawer has moved on
      // cannot put one date's document under another date's title.
      if (live) setExtra({ id: openId, document, finding })
    })()
    return () => { live = false }
  }, [supabase, openId, openDocId, openFindingId])
  const shown = extra && extra.id === openId ? extra : { document: null, finding: null }

  /** Open a date: the address, which the drawer is derived from, so a reload opens the same one. */
  const openDate = (id: string) => {
    const p = new URLSearchParams(params.toString())
    p.delete('finding'); p.set('date', id)
    router.replace(`/calendar?${p}`, { scroll: false })
  }
  const closeDate = () => {
    const p = new URLSearchParams(params.toString())
    p.delete('date'); p.delete('finding')
    router.replace(`/calendar${p.toString() ? `?${p}` : ''}`, { scroll: false })
  }

  const groups = listGroups(rows)
  const undated = groups.undated
  /** The month shown: the one chosen, else the linked date's, else the soonest date still ahead. */
  const monthKey = month
    ?? (open && !hasNoDay(open) ? monthOf(open.next_due) : null)
    ?? openingMonth(rows, new Date().toISOString().slice(0, 10))
  const cells = monthGrid(monthKey, rows)
  const today = new Date().toISOString().slice(0, 10)

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

  /** One date on a day box — board 4. */
  const dateButton = (r: CalendarRow) => (
    <button key={r.id} onClick={() => openDate(r.id)} title={r.title}
      className={`flex w-full items-start gap-1 truncate text-left text-[11px] leading-tight hover:underline ${
        r.has_passed ? 'text-gray-400' : 'text-gray-700'}`}>
      <Dot confirmed={r.status === 'confirmed'} faint={!!r.has_passed} />
      <span className="truncate">{r.title}</span>
    </button>
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
            <a href={newHref}
              className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span className="hidden sm:inline">{sideLabel}</span>
            </a>
          } />

        {/* A link that pointed at a date the calendar no longer carries (decision 30). */}
        {linkMissed && (
          <div className="no-print mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
            {NOT_ON_CALENDAR}
          </div>
        )}

        {/* ================= ASK A QUESTION (board 1; the answer is step 10) ================= */}
        {tab === 'ask' && (
          <div className="no-print">
            <div>
              <div className="relative rounded-xl border border-gray-200 bg-white focus-within:border-[var(--green)]">
                <div className="flex items-end gap-2 p-3.5">
                  <textarea
                    ref={composerRef}
                    value={box}
                    onChange={(e) => setBox(e.target.value)}
                    rows={1}
                    className="max-h-36 min-h-[92px] flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[16px] text-gray-900 outline-none placeholder:text-[16px] placeholder:text-gray-400"
                  />
                </div>
                {/* The examples, as HR and the workspace show them: an overlay, gone the moment
                    anything is typed; not clickable, not a prompt, nothing reaches a model. */}
                {!box && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-5">
                    {CALENDAR_EXAMPLE_QUESTIONS.map((e) => (
                      <p key={e.label} className="truncate text-[14px] text-gray-400">e.g. {e.question}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* One line under the box, HR's: the attach slot left, one action right. The slot is a
                  LINK to Company Documents, where the uploader is — the Calendar has none of its own
                  and will not invent a second one. */}
              <div className="mt-[10px] flex items-start justify-between gap-4">
                <p className="min-w-0 text-[12px] text-gray-500">
                  <AttachControl label="Add a document" href="/documents" />
                </p>
                <div className="flex shrink-0 items-center gap-3">
                  <button className={PRIMARY} disabled>Ask</button>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-gray-500">{ASK_ARRIVES}</p>

              {/* THE INFO BAR, HR's counts line and its rule for zero: a fragment whose number is 0
                  is left out, "next date" is left out when nothing is ahead, and all four zero draws
                  no bar at all (`lib/calendarCounts.ts`, where that rule is tested). */}
              {loaded && bar.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                  <p className="text-[13px] text-gray-500">{bar.join(' · ')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= CONVERSATIONS (HR's board 9; the list is step 10) ================= */}
        {tab === 'conversations' && (
          <div className="pt-1">
            {!loaded ? waiting : topics.length === 0 ? (
              <Empty title="No conversations yet"
                note="Ask a question and the answer is kept here, with the dates and documents it drew on." />
            ) : (
              // Unreachable until step 10 writes the first `topics.section = 'calendar'` row — and
              // here anyway, because an empty state drawn over rows that exist is a false statement.
              <p className="text-[13px] text-gray-500">{CONVERSATIONS_ARRIVE(topics.length)}</p>
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
                <p className="text-[13px] text-gray-500">{CALENDAR_BAR(counts.dates, counts.toConfirm)}</p>
                <div className="flex shrink-0 items-center gap-3 text-[13px]">
                  {(['month', 'list'] as const).map((v) => (
                    <button key={v} onClick={() => setView(v)}
                      className={view === v ? 'font-medium text-[var(--green-ink)]' : 'text-gray-500 hover:text-gray-900'}>
                      {v === 'month' ? 'Month' : 'List'}
                    </button>
                  ))}
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
                <div className="mt-3 grid grid-cols-7 border-l border-t border-gray-200">
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
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
                  <span className="inline-flex items-center gap-1.5"><Dot confirmed faint={false} />confirmed</span>
                  <span className="inline-flex items-center gap-1.5"><Dot confirmed={false} faint={false} />{NOT_CONFIRMED}</span>
                  {undated.length > 0 && <span>{UNDATED_STRIP(undated.length)} — see the list</span>}
                </div>
              </>) : (<>
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
                              {metaParts(r, siteCount, r.added_by ? names[r.added_by] : null).map((part, i) => (
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
                              {metaParts(r, siteCount, r.added_by ? names[r.added_by] : null).join(' · ')}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] text-gray-400">{whenWords(r)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>)}
            </>)}
          </div>
        )}

        {/* ================= DATES TO CONFIRM (board 7; the queue is step 9) ================= */}
        {tab === 'dates' && (
          <div className="pt-1">
            {!loaded ? waiting : counts.toConfirm === 0 ? (
              <Empty title="Nothing waiting"
                note="When a reading finds a date, it lands here for you to confirm or set right." />
            ) : (
              <p className="text-[13px] text-gray-500">{DATES_ARRIVES(counts.toConfirm)}</p>
            )}
          </div>
        )}
      </div>

      {/* ONE DATE, OPENED — board 6's first tab. It is mounted outside the column because the
          shared drawer is `position: fixed`, as it is on Documents and Audits. */}
      {open && (
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
            siteCount,
          }}
          company={companyName}
          onClose={closeDate}
          onOpenOther={openDate}
          onChanged={() => { void load() }}
        />
      )}
    </AppLayout>
  )
}
