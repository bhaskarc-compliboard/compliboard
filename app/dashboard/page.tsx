'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { liveDates, CALENDAR_COUNT_COLUMNS } from '@/lib/calendarCounts'
import { NOT_CONFIRMED } from '@/lib/calendarView'
import {
  welcomeFor, countWord, isNoCount, COUNTER_TILES, COUNTER_COLUMNS,
  type CounterRow, type Welcome,
} from '@/lib/dashboardView'

/**
 * *** THE DASHBOARD READS `calendar_v` THROUGH THE CALENDAR'S OWN FILTER — Calendar step 12. ***
 *
 * It used to `fetch('/api/calendar')`, the BASE table, and then decide for itself what was due:
 * `new Date(e.due_date)` between today and +30 days, in the browser. Three things were wrong with
 * that, and all three were measured on staging on 16 October 2026 before this was changed:
 *
 *   · **It showed dates a person had removed.** The route returns every row except `withdrawn`,
 *     so `dismissed` and superseded rows came too: Test Gamma showed 7 where 5 are live, and two
 *     of the extra were dates somebody had explicitly removed in the queue.
 *   · **It asserted days the Calendar refuses to.** A repeating date whose period was never read
 *     has no computable next date (decision 23) — `calendar_v.next_due` is NULL and the product
 *     says "repeats, how often wasn't read". The Dashboard read the raw anchor and announced
 *     "in 15 days". Cascade showed 4 where 1 is due; all three extras were that.
 *   · **A DATE compared with the browser's clock** slips a day for anybody west of UTC
 *     (`lib/calendarCounts.ts` carries the same reasoning for the info bar).
 *
 * Now: `liveDates` — the one filter the tab counts, the sidebar badge, the feed and the monthly
 * email share — and `next_due`, `days_until` and `has_passed` as the VIEW computed them against
 * the server's today. Nothing here does date arithmetic.
 *
 * *** STEP 6 REBUILDS THIS PANEL. *** Step 5 moved it inside the new column and changed nothing
 * about what it reads or says.
 */
interface CalEvent {
  id: string; title: string; status: string
  next_due: string | null; days_until: number | null; has_passed: boolean | null
}

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [events, setEvents] = useState<CalEvent[] | null>([])
  /**
   * *** THE FOUR NUMBERS COME FROM `usage_counters` AND NOWHERE ELSE — decision 2. ***
   *
   * `null` is not "all zeros": it is "no row", which `countWord` draws as a dash exactly like a 0.
   * The page used to count rows instead — `document_index_v` for files, a `research_answer` split
   * on `checklists` for the other two — and `docs/DASHBOARD-MACHINERY.md` §C recorded what that
   * cost: "Questions answered" read 0 for Test Gamma against a counter holding 31, because the
   * split counted checklist ROWS and the counter counts chat ANSWERS. Those are two different
   * questions and only one of them is the one the label asks. Counting inventory also means a
   * number can go DOWN when a row is deleted, and decision 2 is that these four only go up.
   */
  const [counters, setCounters] = useState<CounterRow | null>(null)
  // Null until the profile has been read. There is no sensible placeholder greeting: a guess
  // here would flash the wrong one of the two sentences, so the page waits instead.
  const [welcome, setWelcome] = useState<Welcome | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // The person's own row: the name for the greeting, and whether they have been here before.
      const { data: profileData } = await supabase
        .from('profiles').select('company_id, full_name, welcomed_at').eq('id', user.id).single()

      const greeting = welcomeFor(profileData?.full_name, profileData?.welcomed_at)
      setWelcome(greeting)

      const companyId = profileData?.company_id
      if (companyId) {
        try {
          // The caller's own client: `calendar_v` is security_invoker, so RLS decides what comes
          // back and this page names no company.
          // `title` and `days_until` on top of the counts' own columns: the counts need neither,
          // and this list is the whole of what a dashboard row shows. **`days_until` was missing
          // from the first version of this line**, and because `undefined >= 0` is false the
          // filter below dropped every row — the page drew "No deadlines in the next 30 days"
          // over a company with one. Found in the step's own screenshot, not by a test.
          const { data: cal, error: calError } = await liveDates(supabase, `${CALENDAR_COUNT_COLUMNS}, title, days_until`)
          if (calError) throw new Error(calError.message)
          setEvents((cal ?? []) as unknown as CalEvent[])
        } catch (e) {
          // §5.1: a read that failed is not an empty calendar. The list says so rather than
          // drawing "No deadlines in the next 30 days" over dates that exist.
          console.error('dashboard: the calendar could not be read', e)
          setEvents(null)
        }

        /**
         * *** READ WITH THE CALLER'S OWN CLIENT, NOT A ROUTE. ***
         *
         * The step asked which path this takes and why. Read from the catalog on 20 October:
         * `authenticated` holds SELECT on `public.usage_counters`, and the table carries exactly
         * one policy — `usage_counters_select_own_company`, SELECT to `authenticated`,
         * `using (company_id = auth_company_id())`. So a signed-in person can read their own
         * company's row and no other, and a `GET /api/dashboard/counters` would add a second
         * hop, a second place for the tenancy rule to live, and nothing else.
         *
         * `maybeSingle`, not `single`: a company with no row yet is the ordinary day-one state
         * (board 3), and `single` turns it into an error.
         */
        const { data: counterRow, error: counterError } = await supabase
          .from('usage_counters').select(COUNTER_COLUMNS).eq('company_id', companyId).maybeSingle()
        if (counterError) {
          // A failed read is not four zeros. `null` draws four dashes, which is what "we have
          // nothing to show you" looks like — and never a confident 0 (`CLAUDE.md` §6).
          console.error('dashboard: the counters could not be read', counterError)
          setCounters(null)
        } else {
          setCounters((counterRow ?? null) as CounterRow | null)
        }
      }
      setLoading(false)

      /**
       * *** THE FIRST VISIT IS RECORDED AFTER THE PAGE HAS DRAWN, ONCE, AND MAY FAIL. ***
       *
       * This write is the only one the Dashboard does. It goes through the caller's own client on
       * the column grant migration 080 added, so the rule that a recorded first visit is never
       * changed is enforced by the database, not by this line
       * (`profiles_person_welcome_refusal`).
       *
       * A refusal is SWALLOWED on purpose, and there are two of them: a colleague's tab racing
       * this one, and the refusal trigger itself if `welcomed_at` is somehow already set. Neither
       * is a thing to tell a person about on their first morning — and the title above is already
       * right for THIS view, because it was computed from the row as it was read.
       */
      if (greeting.firstVisit) {
        const { error: welcomeError } = await supabase
          .from('profiles').update({ welcomed_at: new Date().toISOString() }).eq('id', user.id)
        if (welcomeError) console.debug('dashboard: welcomed_at was not recorded', welcomeError.message)
      }
    }
    load()
  }, [])

  /**
   * The next 30 days, from the view's own numbers: a date with no day computable is not a
   * deadline (`next_due` null), and one that has passed belongs to the Calendar's list, not to
   * "upcoming". `days_until` is the server's count, so nothing here reads a clock.
   */
  const upcoming = (events ?? [])
    .filter((e) => e.next_due && !e.has_passed && e.days_until !== null && e.days_until >= 0 && e.days_until <= 30)
    .sort((a, b) => (a.next_due ?? '').localeCompare(b.next_due ?? ''))

  if (loading || !welcome) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Dashboard">
      {/* The 900 column, the same as /hr, /calendar and /compliance
          (`app/calendar/page.tsx:627`). No `print-page`: decision 11, the Dashboard prints
          nothing, so it stays out of the print frame. */}
      <div className="mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="pt-6">
          {/* The welcome IS the title — decision 5. The company name and the raw industry slug
              that stood here are gone: the slug was machine text on the first line a person
              reads (`docs/DASHBOARD-MACHINERY.md` §B), and the company name is in the topbar. */}
          <h1 className="font-serif text-[28px] font-normal text-gray-900">{welcome.title}</h1>
          <p className="mt-1 text-[14px] text-gray-500">{welcome.lede}</p>
        </div>

        {/* *** THE FOUR NUMBERS — one row of hairline cells, board 1. ***
            No cards: a hairline above and below, a hairline between each pair, and one surface
            for the whole page. Tabular numbers so the four values do not jitter against each
            other, and the reading serif at 34px because these are the page's own figures. */}
        <div className="mt-6 grid grid-cols-2 border-t border-b border-gray-200 sm:grid-cols-4">
          {COUNTER_TILES.map((tile, i) => (
            <div key={tile.key}
                 className={`py-[18px] pr-5 ${i > 0 ? 'pl-5 sm:border-l sm:border-gray-200' : ''}`}>
              <p className="text-xs font-medium uppercase tracking-[0.04em] text-gray-700">{tile.label}</p>
              <p className={`mt-1.5 font-serif text-[34px] font-normal leading-10 tabular-nums ${
                isNoCount(counters?.[tile.key]) ? 'text-gray-300' : 'text-gray-900'}`}>
                {countWord(counters?.[tile.key])}
              </p>
            </div>
          ))}
        </div>

        {/* Upcoming deadlines — step 6 rebuilds this in the boards' words and rows. Step 5 only
            moved it inside the column. */}
        <h2 className="mt-9 mb-3 text-lg font-semibold text-orange-600">Upcoming — next 30 days</h2>
        <div className="bg-white rounded-xl">
          {events === null ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-amber-800">
                We could not load your dates just now. Nothing has changed — open the Calendar to see them.
              </p>
            </div>
          ) : upcoming.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">No deadlines in the next 30 days.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcoming.map(e => {
                const d = e.days_until as number
                const urgent = d <= 7
                return (
                  // Every row opens the date itself, where everything about it is (step 8a's
                  // drawer). A dashboard that names a deadline and cannot show it is a dead end.
                  <a key={e.id} href={`/calendar?tab=calendar&date=${e.id}`}
                    className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <span className="min-w-0 text-sm text-gray-800">
                      <span className="truncate">{e.title}</span>
                      {/* Decision 8: an unconfirmed date shows everywhere, marked, in the page's
                          own words — lower case, because it is the normal condition of a date a
                          reading found yesterday, not an alarm. */}
                      {e.status === 'proposed' && (
                        <span className="ml-2 text-xs text-gray-400">{NOT_CONFIRMED}</span>
                      )}
                    </span>
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-md ${urgent ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                      {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`}
                    </span>
                  </a>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
