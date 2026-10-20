'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import DashboardSection from '@/components/DashboardSection'
import DashboardQuestions from '@/components/DashboardQuestions'
import {
  readCalendarRows, type CalendarRow,
  metaParts, whenWords, passedWords, longDay, siteWords,
} from '@/lib/calendarView'
import { runName, AUDIT_RUN_ROW_COLUMNS, AUDIT_DONE, type NameableRun } from '@/lib/auditView'
import {
  welcomeFor, countWord, isNoCount, COUNTER_TILES, COUNTER_COLUMNS,
  type CounterRow, type Welcome,
  splitUpcoming, moreLine, MORE_LINK, MORE_HREF, inNext30Days, RECENT_AUDITS_MAX,
  UPCOMING_EMPTY, UPCOMING_EMPTY_LINK, UPCOMING_EMPTY_HREF,
  AUDITS_EMPTY, AUDITS_EMPTY_LINK, AUDITS_EMPTY_HREF,
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
 * *** AND AT STEP 6 IT STOPPED PHRASING THEM TOO. *** The page used to write its own "Today",
 * "Tomorrow", "in N days" and its own red pill. Those are `whenWords` (`lib/calendarView.ts:173`),
 * and the rows now carry the Calendar's whole meta line — the day, how often, the site, what it
 * was read from, whether it is confirmed — from `metaParts` (`:255`). `readCalendarRows` is the
 * same call the Calendar page makes, so the two cannot disagree about what is on the calendar OR
 * about what to call it.
 */
interface AuditRunRow extends NameableRun {
  id: string
  entity_id: string | null
  status: string
  finished_at: string | null
  created_at: string
}

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [dates, setDates] = useState<CalendarRow[] | null>([])
  const [audits, setAudits] = useState<AuditRunRow[] | null>([])
  /** Names for a template run's checklist, and the site names both sections need. */
  const [docTitles, setDocTitles] = useState<Record<string, string>>({})
  const [siteNames, setSiteNames] = useState<Record<string, string>>({})
  const [siteCount, setSiteCount] = useState(0)
  const [people, setPeople] = useState<Record<string, string>>({})
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
      setCompanyId(companyId ?? null)
      if (companyId) {
        /**
         * THE SITES AND THE NAMES, for the same reason the Calendar reads them
         * (`app/calendar/page.tsx:239-241`): `siteWords` says nothing at all when a company has
         * ONE site (decision 24), so the count decides whether a site is named anywhere on this
         * page, and `metaParts` puts a person behind a typed date. Both are small reads scoped by
         * RLS, and neither is a second opinion about anything.
         */
        const [siteRes, peopleRes] = await Promise.all([
          supabase.from('entities').select('id, name'),
          supabase.from('profiles').select('id, full_name'),
        ])
        const sites = siteRes.data ?? []
        setSiteCount(sites.length)
        setSiteNames(Object.fromEntries(sites.map((s) => [s.id, s.name])))
        setPeople(Object.fromEntries((peopleRes.data ?? []).map((p) => [p.id, p.full_name ?? ''])))

        try {
          // The caller's own client, the Calendar's own call. `calendar_v` is security_invoker, so
          // RLS decides what comes back and this page names no company.
          setDates(await readCalendarRows(supabase))
        } catch (e) {
          // §5.1: a read that failed is not an empty calendar. The list says so rather than
          // drawing the day-one line over dates that exist.
          console.error('dashboard: the calendar could not be read', e)
          setDates(null)
        }

        /**
         * *** RECENT AUDITS — decision 7, read as the person. ***
         *
         * `audit_runs_select` is SELECT to `authenticated` `using (company_id = auth_company_id())`
         * (`docs/SCHEMA.md`), so the caller's own client returns this company's runs and no
         * other's, and the page names no company here either.
         *
         * `status = 'done'` and NOTHING about `dismissed_at`: dismissing a run clears its banner on
         * the Audits page, it does not un-run the audit. Decision 7 says the work was done, so it
         * counts. Ordered by `finished_at` — the moment the audit actually landed — with
         * `created_at` behind it for a row that somehow has no finish.
         */
        const { data: runRows, error: runError } = await supabase
          .from('audit_runs').select(AUDIT_RUN_ROW_COLUMNS)
          .eq('status', AUDIT_DONE)
          .order('finished_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(RECENT_AUDITS_MAX)
        if (runError) {
          console.error('dashboard: the audits could not be read', runError)
          setAudits(null)
        } else {
          const runs = (runRows ?? []) as unknown as AuditRunRow[]
          setAudits(runs)
          // A template run is named by its checklist, so the three rows' documents are looked up —
          // and only when there is a template run among them. Agency runs need nothing.
          const templateIds = runs.map((r) => r.template_document_id).filter((x): x is string => !!x)
          if (templateIds.length) {
            const { data: docs } = await supabase.from('document_index_v')
              .select('document_id, title').in('document_id', templateIds)
            setDocTitles(Object.fromEntries((docs ?? []).map((d) => [d.document_id, d.title ?? ''])))
          }
        }

        /**
         * *** READ WITH THE CALLER'S OWN CLIENT, NOT A ROUTE. ***
         *
         * Read from the catalog on 20 October: `authenticated` holds SELECT on
         * `public.usage_counters`, and the table carries exactly one policy —
         * `usage_counters_select_own_company`, SELECT to `authenticated`,
         * `using (company_id = auth_company_id())`. So a signed-in person can read their own
         * company's row and no other, and a `GET /api/dashboard/counters` would add a second hop,
         * a second place for the tenancy rule to live, and nothing else.
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
   * The next 30 days, in the view's own order. `inNext30Days` is the whole of the filter and it
   * reads only columns the VIEW computed; nothing here touches a clock.
   */
  const upcoming = (dates ?? [])
    .filter(inNext30Days)
    .sort((a, b) => (a.next_due ?? '').localeCompare(b.next_due ?? ''))
  const { shown, more } = splitUpcoming(upcoming)

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

        {/* ***** THE THREE QUESTIONS — step 7, decision 8. *****
            Board 1 puts the card directly under the numbers and above Upcoming, so that the one
            thing the product wants from a person is above the fold on a laptop. It owns its own
            reads and its own state, and it draws NOTHING when this company has no company-scope
            question left — no heading, no empty card. */}
        {companyId && <DashboardQuestions db={supabase} companyId={companyId} />}

        {/* ===== UPCOMING — decision 6 ===== */}
        <DashboardSection heading="Upcoming in the next 30 days" action="Open the Calendar →" href="/calendar" />
        {dates === null ? (
          /* §5.1: a read that failed is checked BEFORE the empty state, and says what is true —
             that we could not look — rather than "nothing is due", which is a claim about dates
             nobody read. Checked first here for exactly that reason. */
          <p className="border-y border-gray-100 py-3.5 text-[13px] text-[var(--amber)]">
            We could not load your dates just now. Nothing has changed — open the Calendar to see them.
          </p>
        ) : shown.length === 0 ? (
          <p className="border-y border-gray-100 py-3.5 text-[13px] text-gray-500">
            {UPCOMING_EMPTY}{' '}
            <a href={UPCOMING_EMPTY_HREF} className="ml-1 text-[12px] text-[var(--green-ink)] hover:underline">
              {UPCOMING_EMPTY_LINK}
            </a>
          </p>
        ) : (
          <>
            <div className="divide-y divide-gray-100 border-y border-gray-100">
              {shown.map((r) => (
                // Every row opens the date itself, where everything about it is (Calendar step
                // 8a's drawer). A dashboard that names a deadline and cannot show it is a dead
                // end. Unchanged from step 5.
                <a key={r.id} href={`/calendar?tab=calendar&date=${r.id}`}
                   className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-white">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">
                      {r.title}
                    </span>
                    {/* The Calendar's own meta line, through the Calendar's own function: the day,
                        how often, the site, what it was read from, and `not confirmed` when it is.
                        The Dashboard phrases none of it. */}
                    <span className="mt-0.5 block truncate text-[12px] text-gray-500">
                      {metaParts(r, siteCount, r.added_by ? people[r.added_by] : null).map((part, i) => (
                        <span key={i}>
                          {i > 0 && <span aria-hidden="true"> · </span>}
                          <span className={part === passedWords(r) ? 'text-[var(--amber)]' : ''}>{part}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  {/* *** THE BOARD'S `--danger` HAS NO TOKEN IN THIS PRODUCT, so this is amber. ***
                      `app/globals.css` carries one attention colour, `--amber` (#B7791F), and no
                      red one; and the Calendar's own list draws `whenWords` in plain grey with no
                      urgency colour at all (`app/calendar/page.tsx:614`). Amber is the nearest
                      thing that exists, and it is already what this very meta line uses for
                      `passedWords`. A week or less is amber; everything further out is the
                      Calendar's grey. */}
                  <span className={`shrink-0 text-[12px] tabular-nums ${
                    (r.days_until ?? 99) <= 7 ? 'text-[var(--amber)]' : 'text-gray-400'}`}>
                    {whenWords(r)}
                  </span>
                </a>
              ))}
            </div>
            {more > 0 && (
              <p className="pt-2.5 text-[12px] text-gray-500">
                {moreLine(more)}{' '}
                <a href={MORE_HREF} className="ml-1 text-[12px] text-[var(--green-ink)] hover:underline">
                  {MORE_LINK}
                </a>
              </p>
            )}
          </>
        )}

        {/* ===== RECENT AUDITS — decision 7. It replaced "Recently read" at step 5. ===== */}
        <DashboardSection heading="Recent audits" action="All audits →" href="/audits" />
        {audits === null ? (
          <p className="border-y border-gray-100 py-3.5 text-[13px] text-[var(--amber)]">
            We could not load your audits just now. Nothing has changed — open Audits to see them.
          </p>
        ) : audits.length === 0 ? (
          <p className="border-y border-gray-100 py-3.5 text-[13px] text-gray-500">
            {AUDITS_EMPTY}{' '}
            <a href={AUDITS_EMPTY_HREF} className="ml-1 text-[12px] text-[var(--green-ink)] hover:underline">
              {AUDITS_EMPTY_LINK}
            </a>
          </p>
        ) : (
          <div className="divide-y divide-gray-100 border-y border-gray-100">
            {audits.map((r) => {
              // `siteWords` says nothing at all for a single-site company (decision 24), and an
              // `audit_runs` row names its site in `entity_id` where a calendar row names it in
              // `site_id` — so the row is shaped for the shared function rather than copied.
              const site = siteWords(
                { site_id: null, entity_id: r.entity_id, site_name: r.entity_id ? siteNames[r.entity_id] ?? null : null },
                siteCount,
              )
              const when = longDay(r.finished_at ?? r.created_at)
              return (
                // *** /audits ALREADY OPENS A RUN FROM ITS ADDRESS. *** `app/audits/page.tsx:208`
                // reads `?run=`, `:791` draws that report. Nothing had to be taught; the Calendar's
                // `?date=` lesson had already been learnt on this page.
                <a key={r.id} href={`/audits?run=${r.id}`}
                   className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-white">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">
                      {runName(r, r.template_document_id ? docTitles[r.template_document_id] ?? null : null)}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-gray-500">
                      {[site, when].filter(Boolean).map((part, i) => (
                        <span key={i}>{i > 0 && <span aria-hidden="true"> · </span>}{part}</span>
                      ))}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--green-ink)]">Open the report</span>
                </a>
              )
            })}
          </div>
        )}

      </div>
    </AppLayout>
  )
}
