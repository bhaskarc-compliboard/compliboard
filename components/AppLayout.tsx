'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  didYouKnow?: { icon: string; text: string }
}

/**
 * WHAT THE COMPANY INFORMATION PAGE FIRES WHEN IT CHANGES THE RECORD.
 *
 * Exported so the name has ONE definition. A string literal at each end is a rename waiting to break
 * silently: the listener would simply never fire, the badge would go back to being stale, and nothing
 * would fail. That is the same class of bug as the badge counting keys while the page drew lines.
 */
export const FACTS_CHANGED = 'compliboard:facts-changed'

/**
 * AND WHAT THE CALENDAR FIRES WHEN IT CONFIRMS OR REMOVES A DATE — Calendar step 9.
 *
 * A SECOND NAME RATHER THAN REUSING THE ONE ABOVE, because `FACTS_CHANGED` means "the company
 * record changed" and the Calendar changes no fact: a listener that had to guess which of two
 * meanings a single event carried would be one rename away from the silent breakage the paragraph
 * above describes. Both are listened to here, and each end imports the constant.
 *
 * It exists because the badge beside "Calendar" counts the dates waiting, and confirming the last
 * one from the queue has to take the badge with it — otherwise the nav says 9 while the page it
 * sits beside says "Nothing waiting", which is the 29 September failure in a new place.
 */
export const COUNTS_CHANGED = 'compliboard:counts-changed'

// *** NO ICONS. *** Multicolour OS emoji put seven uncontrolled colour schemes into a product
// whose rule is one green, used only where it means something — and they render differently on
// Mac and Windows, so the nav was a different object on each. Text only; no icon library.
//
// *** THE ORDER, THE WORDS AND THE LINE — Dashboard step 5b (`DASHBOARD-PLAN.md` decision 12,
// board 4). *** The places a person works come first, in the order they work in them, and the two
// items that are about the account rather than the work sit together under a hairline.
//
// Two words changed and NO href did: "Audits" became "Audit Workspace", because it is the fourth
// workspace and was the only one of the four not named as one; "Company Documents" became
// "Documents", because everything in this product is the company's and the longer name was the
// widest item in a 224px column. `/audits` and `/documents` are unchanged, so every link, every
// test that asserts an href, and every address a person has bookmarked still works.
//
// *** AND THE WORDS ELSEWHERE DID NOT FOLLOW. *** Four places still say "Company Documents" in
// prose a person reads — `lib/calendarView.ts:198`, `app/calendar/page.tsx:732`,
// `app/account/page.tsx:390` and `:432` — plus the marketing page (`app/page.tsx:275`). They name a
// section by a name the nav no longer shows. Left alone on purpose: this step owns the layout
// file, and those sentences are the Calendar's and the Account page's to change. Recorded in the
// step's report.
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Compliance Workspace', href: '/compliance' },
  { label: 'Audit Workspace', href: '/audits' },
  { label: 'HR Workspace', href: '/hr' },
  // THE SAME BADGE, THE SECOND NUMBER — Calendar step 7. "Calendar 10" is the queue of dates a
  // reading has found and nobody has confirmed, which is the one thing on this entry that asks for
  // a minute rather than offering a place to go. Same component, same position rule, same
  // nothing-at-zero.
  { label: 'Calendar', href: '/calendar', badge: 'calendarDates' as const },
  { label: 'Documents', href: '/documents' },
  //
  // *** THE HAIRLINE STARTS HERE, AND THE TWO ITEMS UNDER IT WERE NOT MOVED FOR TIDINESS. ***
  // Everything above the rule is somewhere a person goes to do the work. Company information and
  // My Account are the record of who they are and what they have told us, which is a different
  // kind of thing, and the line is the product saying so rather than a gap hoping it reads that
  // way.
  //
  // THE COUNT IS PART OF THE ITEM. "Company information" with nothing waiting is a record to read;
  // "Company information 3" is the one thing on this nav that asks for a minute rather than
  // offering a place to go.
  //
  // *** IT WAS "To confirm" UNTIL TASK 0, COMMIT 2, AND IT KEEPS ITS BADGE. *** The queue is now
  // the first section of the page rather than a screen of its own: the questions and the record
  // they complete are one thing. The badge still counts QUESTION LINES, which is the number of
  // decisions waiting, not the number of readings behind them. `/to-confirm` 308s here.
  //
  // Its POSITION was held unchanged through Task 0 for a reason this step has now spent: a person
  // who has learnt where the badge appears should not have to learn again. Decision 12 moves it
  // anyway, because the line it now sits under says more about what the item is than its place in
  // a list of eight did. The number is still beside the same words.
  { label: 'Company information', href: '/company-information', badge: 'toConfirm' as const, ruleBefore: true },
  { label: 'My Account', href: '/account', soon: false },
]

export default function AppLayout({ children, title, didYouKnow }: AppLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [toConfirm, setToConfirm] = useState<number | null>(null)
  const [calendarDates, setCalendarDates] = useState<number | null>(null)

  // Read once per page load, AND ONCE MORE WHENEVER THE PAGE SAYS THE ANSWER CHANGED.
  //
  // *** STILL NOT POLLING, AND THAT IS THE POINT. *** A live count would mean every screen in the
  // product asking for a number that only changes when the person themselves changes it. The count
  // is read on a pathname change, as it always was, and on ONE event the Company information page
  // dispatches after a write it has already awaited.
  //
  // Found by the 29 September smoke test: the badge read 12 while the page showed the question
  // answered and gone. Both numbers were right for the moment each was fetched, which is what makes
  // it the worse kind of wrong — nothing looked broken, the nav just quietly disagreed with the page
  // in front of it.
  const loadCount = useCallback(async () => {
    /**
     * *** THE CALENDAR'S NUMBER IS READ BESIDE THIS ONE, THROUGH THE CALENDAR'S OWN FILTER ***
     * — Calendar step 7. `countDatesToConfirm` is the same filter the Dates-to-confirm tab counts
     * with (`lib/calendarCounts.ts`): live rows, still `proposed`. One definition at both ends is
     * the whole lesson of the paragraph above, and it is why this is not a second query written
     * here. It is a HEAD request for a count, so no rows cross the wire for a badge.
     *
     * Its own try/catch: a calendar that cannot be counted must not take the facts badge down with
     * it, and neither must stop the nav rendering.
     */
    try {
      const { countDatesToConfirm } = await import('@/lib/calendarCounts')
      setCalendarDates(await countDatesToConfirm(supabase))
    } catch { /* the nav must render whether or not this answers */ }
    try {
      const { authHeaders } = await import('@/lib/supabase')
      const res = await fetch('/api/to-confirm', { headers: await authHeaders() })
      if (!res.ok) return
      const j = await res.json()
      // `question_lines`, not `count` and not `key_count`: the badge has to be the number of lines
      // the Company information page actually draws, or it promises a different amount of work. The
      // route and the page build those lines with the same function (`lib/confirmationQueue.ts`), so
      // the two cannot drift. `count` is kept as an alias for the same number.
      setToConfirm(j.question_lines ?? j.count ?? 0)
    } catch { /* the nav must render whether or not this answers */ }
  }, [supabase])

  useEffect(() => { loadCount() }, [pathname, loadCount])

  // The event, not a prop and not a context. `AppLayout` wraps every page and the page that changes
  // the count is one of its children, so a callback would have to be threaded through the layout for
  // the benefit of a single screen. A window event is one line at each end and nothing else in the
  // product is touched by it — which is what the fix was asked to be.
  useEffect(() => {
    const onChanged = () => { loadCount() }
    window.addEventListener(FACTS_CHANGED, onChanged)
    window.addEventListener(COUNTS_CHANGED, onChanged)
    return () => {
      window.removeEventListener(FACTS_CHANGED, onChanged)
      window.removeEventListener(COUNTS_CHANGED, onChanged)
    }
  }, [loadCount])

  useEffect(() => {
    async function loadCompany() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      if (profile?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profile.company_id)
          .single()
        if (company) setCompanyName(company.name)
      }
    }
    loadCompany()
  }, [])

  useEffect(() => {
    if (title) document.title = `${title} — CompliBoard`
    else document.title = 'CompliBoard'
  }, [title])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function sendFeedback() {
    if (!feedbackMessage.trim()) return
    setFeedbackLoading(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: feedbackMessage }),
      })
      setFeedbackSent(true)
      setFeedbackMessage('')
      setTimeout(() => {
        setShowFeedback(false)
        setFeedbackSent(false)
      }, 2000)
    } catch (error) {
      console.error(error)
    } finally {
      setFeedbackLoading(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText('https://compliboard.com')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareEmail() {
    const subject = encodeURIComponent('You need to see this compliance tool')
    const body = encodeURIComponent('Hi, I have been using CompliBoard for compliance questions. Worth checking out: https://compliboard.com')
    window.open('mailto:?subject=' + subject + '&body=' + body)
  }

  function shareLinkedIn() {
    const url = encodeURIComponent('https://compliboard.com')
    window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + url, '_blank')
  }

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  /**
   * *** THE ACTIVE PAGE IS MARKED EXACTLY AS A WORKSPACE MARKS ITS ACTIVE TAB — board 4,
   * decision 12. *** The green box is gone. It was the only filled shape in the product that
   * carried no meaning: green here means "this is the thing", and a page you are already on is not
   * a thing to act on.
   *
   * The two tokens are read from `components/Tabs.tsx:22`, not chosen: an active tab is
   * `border-[var(--green)] text-[var(--green-ink)]` plus `font-medium`. So the word is
   * `--green-ink` (#256541) at weight 500 and the line under it is 2px of `--green` (#2F7D52) —
   * the same two colours doing the same job in a vertical list, which is the whole point. A tab
   * draws its line with `border-b-2`; here it is `text-decoration`, because the line has to be as
   * wide as the WORD and a border would run the width of the row.
   *
   * There is no `aria-selected` to copy: `Tabs.tsx` marks its active tab with classes alone.
   * (Worth its own fix one day; it is not this step's file.)
   *
   * `underline-offset-[6px]` is the board's number, and it is not decoration: at the default
   * offset the line runs through the descenders of "Compliance Workspace" and "Company
   * information", which is five of the eight items.
   */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* `space-y-1` is untouched. Board 4 draws the items 2px apart; the step's instruction says
          the item y positions move for the reorder and the line, so a third reason to move them
          is not this step's to add. */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <div key={item.href}>
              {/* THE HAIRLINE, NOT A GAP. A gap asks the eye to infer a grouping; a line states
                  one. Inset by the items' own `px-3` so it starts and ends where the words do,
                  and drawn in `--line` (#E6E9ED), the same token every other hairline in the
                  product uses. `my-3.5` is board 4's 14px. */}
              {item.ruleBefore && <div className="mx-3 my-3.5 h-px bg-[var(--line)]" />}
              <button
                onClick={() => {
                  if (!item.soon) {
                    router.push(item.href)
                    setSidebarOpen(false)
                  }
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'text-[var(--green-ink)] font-medium'
                    : item.soon
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
                }`}>
                <span className={`text-left ${
                  isActive ? 'underline decoration-[var(--green)] decoration-2 underline-offset-[6px]' : ''}`}>
                  {item.label}
                </span>
                {/* A COUNT, NOT A DOT, AND NOW NOT A PILL EITHER. "3" says how much work; a dot
                    says only that something happened, which is the kind of badge people learn to
                    ignore. The grey pill went with the green box (board 4): a filled shape beside
                    a word reads as a control, and this is a number. Plain 12px in the faint grey,
                    tabular so two numbers in a column do not jitter. Nothing is shown at zero —
                    an empty queue should not ask for attention. */}
                {item.badge === 'toConfirm' && !!toConfirm && (
                  <span className="shrink-0 text-xs tabular-nums text-gray-400">{toConfirm}</span>
                )}
                {item.badge === 'calendarDates' && !!calendarDates && (
                  <span className="shrink-0 text-xs tabular-nums text-gray-400">{calendarDates}</span>
                )}
                {item.soon && (
                  <span className="shrink-0 text-xs tabular-nums text-gray-400">Soon</span>
                )}
              </button>
            </div>
          )
        })}
      </nav>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header. `no-print` (app/globals.css, @media print only): the site header never prints. It is
          sticky, so on paper it landed wherever the page behind a drawer was scrolled to — across the
          summary's "Your situation" in Workspace Stage 2's print check. On screen nothing changes. */}
      <header className="no-print bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <a href="/dashboard" className="hidden lg:flex items-center gap-2 pl-3">
            <span className="text-base font-semibold"><span className="text-green-700">Compli</span><span className="text-orange-600">Board</span></span>
          </a>
          {/*
            *** THE BREADCRUMB IS GONE — Dashboard step 6F. ***
            It drew "/ Dashboard" and "/ My Account" beside the wordmark, and only those two: six
            of the eight signed-in pages passed no `title` at all, so the bar said where you were
            on a quarter of the product and nothing on the rest. A trail of one is not a trail, and
            the sidebar already marks the page you are on (step 5b).

            The MARKUP is removed rather than the pages' prop, so no page can bring it back by
            passing a title — and the prop itself stays, because it has a second job this step did
            not touch: `document.title` at the effect below, which is the name on the browser tab.
            /dashboard and /account keep passing it for that, and that is now all it does.
          */}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowReferral(true); setShowFeedback(false) }}
            className="text-sm text-gray-500 hover:text-green-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-50 hidden sm:flex items-center gap-1.5">
            <span>Refer a friend</span>
          </button>
          {/* Same classes as Refer a friend. One boxed button beside one plain button implied a
              difference in importance that is not there. Feedback stays visible at every width. */}
          <button
            onClick={() => { setShowFeedback(true); setShowReferral(false) }}
            className="text-sm text-gray-500 hover:text-green-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-50">
            <span>Feedback</span>
          </button>

          {/*
            IDENTITY LIVES IN THE HEADER, NOT AT THE FOOT OF THE SIDEBAR.
            Who you are signed in as is true on every page regardless of where you are, which is
            what a header is for — and the sidebar's bottom block is space the navigation needs.
            Log out belongs beside the name rather than under the nav.
          */}
          <div className="h-4 w-px bg-gray-200" />
          {companyName && (
            <span className="text-sm text-gray-600 hidden sm:block">{companyName}</span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50">
            <span>Log out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">

        {/*
          Sidebar — desktop. `no-print`, for the reason the header above carries it: it is
          navigation, and a printed page cannot be navigated. **Found at Calendar step 8b**, by
          photographing a page with print media emulated for the first time: every printed page in
          the product was carrying the whole nav down its left edge, including HR's conversation and
          both report drawers. One class, print-only, so nothing on screen changes.
        */}
        <aside className="no-print hidden lg:flex flex-col w-56 bg-white border-r border-gray-200 sticky top-[57px] h-[calc(100vh-57px)]">
          <SidebarContent />
        </aside>

        {/* Sidebar — mobile overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black bg-opacity-30" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-64 bg-white shadow-xl">
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1">
            {children}
          </div>

          {/* Footer */}
          <footer className="border-t border-gray-100 px-6 py-4 bg-white">
            {/*
              THE DISCLAIMER BELONGS TO THE FRAME. It is the same sentence on every screen, so a
              hand-written copy at the bottom of one page's own column floated wherever that
              page's content happened to end. Here it is in the footer every screen already has.

              NOT marked no-print, deliberately — the compliance page's copy was not either, and
              a printed answer that drops the line saying it was AI-generated is the one place
              the sentence matters most.
            */}
            {/* THE FOOTER'S CONTENTS SIT IN THE PAGE COLUMN — the same box as the page's own
                `print-page` div: 900 wide, centred, with the same `px-4 sm:px-6` inside it. So
                the disclaimer starts at the x the page title starts at. It was 775 with no
                padding, which lined up with no page: 24px left of the workspace's title and
                38px right of every 900 page's (measured, Workspace layout Task 1). A page that
                is not 900 wide will not line up with this, and that is that page's to fix. */}
            <div className="mx-auto w-full max-w-[900px] px-4 sm:px-6">
            {/*
              *** THE FOOTER SAID THE WORD THE DESIGN RULE FORBIDS — changed 30 September 2026. ***
              It read "Answers are generated by AI … and AI can make mistakes", on every signed-in
              page. `HANDOFF-AUDITS.md` §5.0 is explicit that the product never names what does the
              reading, and calls Company information "the first page held to this rule end to end" —
              which it was not, because this line is under it. Found by rendering the Audits page and
              reading it (Run 3b).

              What replaces it says the same three things and keeps the product as the subject: what
              we do, that we can be wrong, and that this is not legal advice. Nothing is softened —
              "It can make mistakes; check before you act" is blunter than what it replaces.
            */}
            <p className="text-[12px] leading-relaxed text-gray-400 mb-3">
              <span className="text-gray-500">CompliBoard reads your documents and current regulatory sources.</span>{' '}
              It can make mistakes; check before you act. This is not legal advice.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
                <a href="mailto:hello@compliboard.com" className="hover:text-gray-600 transition-colors">Contact</a>
              </div>
              <p className="text-xs text-gray-400">© 2026 CompliBoard LLC</p>
            </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <span className="text-green-400">✓</span>
          {toast}
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFeedback(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Send us feedback</h3>
              <button onClick={() => setShowFeedback(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            {feedbackSent ? (
              <div className="text-center py-6">
                <p className="text-sm font-medium text-gray-900">Thank you for your feedback</p>
                <p className="text-xs text-gray-500 mt-1">We read every message</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Tell us what is working, what is not, or what you wish CompliBoard did.
                </p>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-gray-50"
                  rows={5}
                  placeholder="Your message..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={sendFeedback}
                    disabled={feedbackLoading || !feedbackMessage.trim()}
                    className="flex-1 bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                    {feedbackLoading ? 'Sending...' : 'Send feedback'}
                  </button>
                  <button
                    onClick={() => setShowFeedback(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:border-gray-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {showReferral && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowReferral(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Refer a friend</h3>
              <button onClick={() => setShowReferral(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Know someone who struggles with compliance? Share CompliBoard with them.
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 mb-4">
              <span className="text-sm text-gray-600 flex-1">compliboard.com</span>
              <button onClick={copyLink}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors whitespace-nowrap">
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <div className="space-y-2">
              <button onClick={shareEmail}
                className="w-full flex items-center p-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-green-500 hover:text-green-700 hover:bg-green-50 transition-colors">
                <div className="text-left">
                  <p className="font-medium">Send via email</p>
                  <p className="text-xs text-gray-400">Opens your email with a message ready to send</p>
                </div>
              </button>
              <button onClick={shareLinkedIn}
                className="w-full flex items-center p-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                <div className="text-left">
                  <p className="font-medium">Share on LinkedIn</p>
                  <p className="text-xs text-gray-400">Share with your professional network</p>
                </div>
              </button>
            </div>
            <button onClick={() => setShowReferral(false)}
              className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export { AppLayout }
export type { AppLayoutProps }
