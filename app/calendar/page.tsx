'use client'
/**
 * /calendar — THE CALENDAR, IN THE HR WORKSPACE'S FRAME. Calendar step 7 (`docs/CALENDAR-PLAN.md`
 * §2.4; boards 1, 3 and 7 as empty states).
 *
 * *** THIS IS A SHELL, AND IT SAYS SO ON EVERY TAB. *** Four tabs stand, the counts are real and
 * read live, and nothing can be asked, opened, added or confirmed yet. Each tab that cannot do its
 * work yet says which step brings it (steps 8, 9 and 10) rather than offering a control that does
 * nothing — decision 30, and `CLAUDE.md` §5.1: an empty state is a message, and "nothing here" is a
 * claim that has to be true. Those three sentences are STAGING PLACEHOLDERS and are listed in
 * `docs/HANDOFF-CODE.md` §7 as expected rather than left to be found.
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
 * `?date=` and `?finding=` are step 8's, and both report drawers already link here with them. They
 * are not ignored in silence: a dead link is the product saying nothing when it knows perfectly well
 * what was asked for (decision 30), so the page says in one line that opening one date arrives with
 * step 8.
 *
 * Every word on this page is the owner's (the step 7 brief).
 */
import { Suspense, useState, useEffect, useLayoutEffect, useRef } from 'react'
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
const CALENDAR_ARRIVES = (n: number) =>
  `${n} ${n === 1 ? 'date' : 'dates'}. The month and list views arrive with step 8.`
const DATES_ARRIVES = (n: number) =>
  `${n} ${n === 1 ? 'date' : 'dates'} waiting. This view arrives with step 9.`
/**
 * AND A FOURTH, FOR A LINK THAT CANNOT BE HONOURED YET — decision 30. Both report drawers send
 * `/calendar?date=<id>` and `/calendar?finding=<id>`; step 8 opens the drawer on it. Until then the
 * page says so, politely, rather than opening and looking as though the link had done nothing.
 */
const ONE_DATE_ARRIVES = 'That link points at one date. Opening a single date arrives with step 8; '
  + 'the dates themselves are all here.'
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
  const tab = asTab(params.get('tab'))
  /** Step 8's parameters. Read here only to say that they are not read yet. */
  const linkedToOne = !!(params.get('date') || params.get('finding'))

  const [box, setBox] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [counts, setCounts] = useState<CalendarCounts>({ dates: 0, toConfirm: 0, nextDate: null })
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

  useEffect(() => {
    let live = true
    ;(async () => {
      // Both reads as the caller, in parallel, and both are reads: this page writes nothing.
      const [c, t] = await Promise.all([
        readCalendarCounts(supabase),
        readTopicList(supabase, 'calendar'),
      ])
      if (!live) return
      setCounts(c)
      setTopics(t)
      setLoaded(true)
    })()
    return () => { live = false }
  }, [supabase])

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

        {/* A link to one date, which step 8 answers. HR's notice slot, in grey: this is not a failure. */}
        {linkedToOne && (
          <div className="no-print mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
            {ONE_DATE_ARRIVES}
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

        {/* ================= CALENDAR (boards 3 to 6; the views are step 8) ================= */}
        {tab === 'calendar' && (
          <div className="pt-1">
            {!loaded ? waiting : counts.dates === 0 ? (
              <Empty title="No dates yet"
                note="Add your permits, certificates and reports in Company Documents. The dates they set show up here, with the line they came from." />
            ) : (
              <p className="text-[13px] text-gray-500">{CALENDAR_ARRIVES(counts.dates)}</p>
            )}
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
    </AppLayout>
  )
}
