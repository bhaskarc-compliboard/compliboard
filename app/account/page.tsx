'use client'

/**
 * MY ACCOUNT — step 6 (`docs/account-boards.html` boards 1 and 1b; `ACCOUNT-PLAN.md` decisions
 * 1, 3, 4, 5, 7, 15, 16).
 *
 * *** THE OLD COMPANY PROFILE FORM IS GONE, AND MIGRATION 082 IS WHY. *** It posted
 * `{ companyName, industry, state, county, city, employeeCount }` to `PUT /api/account`. Of those
 * six, `name` and `employee_count` are now out of `authenticated`'s column grant entirely, so the
 * statement no longer runs at all — it comes back "permission denied for column" and the route's
 * catch returns 500. The three place fields were the other half of the same mistake: a company's
 * address is its MAIN SITE's (decision 4), and typing a county is exactly what the geocoder
 * replaces. So the form, its PUT and the six fields go together, as this step's brief says.
 *
 * *** A CLOSED FIELD IS RENDERED, NEVER POSTED — 082's lesson, and it shapes every write here. ***
 * The name is drawn with the board's grey line and is in no request body. What this page writes, it
 * writes through exactly what the grant allows:
 *
 *   `about`, `what_you_do`, `website_url` — straight onto `companies` through the CALLER's own
 *                    client, so RLS and the column grant are the boundary rather than a route's `if`.
 *                    `about` is the sentence and `what_you_do` the broad industry line since step
 *                    15 (migration 086), which also revoked this page's right to `naics_code`
 *   a site         — `POST`/`PATCH /api/sites`, which geocodes server-side and writes as the caller
 *   a site removed — `site_removal_refusal` then a DELETE, both as the person (migration 082)
 *   an answer      — `lib/switchAnswer.ts` → `/api/switches/answer`, the one writer of a switch
 *
 * Nothing on this page holds the service role, and nothing on it sends a field it only displays.
 * `app/api/account` keeps its GET (the company row) and its DELETE (the Cancel tab, which needs
 * `auth.admin.deleteUser`); the PUT is deleted.
 *
 * *** THE TAB IS IN THE ADDRESS AND THE QUERY IS NEVER EMPTIED. *** `?tab=` the way Audits and the
 * Calendar do it, with the 20 October hotfix's lesson built in rather than repaired after:
 * `lib/accountView.ts` writes `?tab=company` for the first tab too, so no control on this page ever
 * asks the router to navigate to a bare path — the one thing `router.replace` will not do
 * (`DECISIONS.md` §206).
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { Tabs } from '@/components/Tabs'
import DashboardSection from '@/components/DashboardSection'
import SiteDrawer from '@/components/SiteDrawer'
import CompanyQuestions from '@/components/CompanyQuestions'
import PeopleTab from '@/components/PeopleTab'
import { PRIMARY, TEXT_ACTION, OUTLINE } from '@/components/buttonStyles'
import {
  billingTabView, plainDate, STRIPE_NOTE, MANAGE_LINK,
  AFTER_THE_TRIAL, reconcileTrigger, FINISHING_STALLED, type StatusTone,
} from '@/lib/billingView'
import { createClient, authHeaders } from '@/lib/supabase'
import {
  INDUSTRY_LINE, DONE, WRITE_HINT, lineAction, sentenceRows, SENTENCE_COLS,
} from '@/lib/walkView'
import {
  TITLE, LEDE, TABS, asTab, type AccountTab,
  COMPANY_HEADING, COMPANY_LABEL, NAME_NOTE,
  WHAT_YOU_DO_LABEL,
  WEBSITE_LABEL, WEBSITE_EMPTY, MAIN_SITE_LABEL, EDIT_ADDRESS,
  CHANGE, SAVE, CANCEL,
  SITES_HEADING, ADD_SITE, MAIN_PILL, EDIT, SITES_NOTE,
  siteSubLine, countyLine, addedLine, type SiteRow,
  // Board 3 — the Sign-in tab (step 8).
  SIGNIN_HEADING, NAME_LABEL, NAME_NOTE_SIGNIN, EMAIL_LABEL, EMAIL_NOTE, emailSentLine,
  PASSWORD_LABEL, PASSWORD_MASK, PASSWORD_LAST_CHANGED,
  passwordResetNote, SEND_RESET_LINK, RESET_SENT, RESET_FAILED,
  CHANGE_EMAIL_TITLE, NEW_EMAIL_LABEL, SEND_CONFIRMATION, EMAIL_CHANGE_FAILED,
  // Board 5 — the Cancel tab (step 9).
  CANCEL_HEADING, STOP_PAYING_LABEL, STOP_PAYING_NOTE, STOP_PAYING_ACTION, STOP_PAYING_NONE,
  STOP_PAYING_SCHEDULED, STOP_PAYING_SCHEDULED_ACTION,
  DOWNLOAD_LABEL, DOWNLOAD_NOTE, DOWNLOAD_ACTION,
  DELETE_TITLE, deleteWarning, TYPE_TO_CONFIRM, DELETE_ACTION, deleteConfirm, DELETE_FAILED,
} from '@/lib/accountView'
// The one loose email check the product has, shared with the invite box (step 7).
import { looksLikeEmail, BAD_EMAIL } from '@/lib/peopleView'
import { Sheet } from '@/components/Sheet'

export default function AccountPage() {
  // `useSearchParams` suspends on a prerendered route, which is the whole point of the Calendar's
  // own wrapper (`app/calendar/page.tsx:149`). Same shape here.
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="mx-auto w-full max-w-[900px] px-4 pt-6 sm:px-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">{TITLE}</h1>
        </div>
      </AppLayout>
    }>
      <Account />
    </Suspense>
  )
}

interface CompanyRow {
  id: string
  name: string | null
  /** The plain sentence about the business — `companies.about`, migration 086. */
  about: string | null
  /** The broad industry line. It changed meaning at step 15; the sentence moved to `about`. */
  what_you_do: string | null
  website_url: string | null
  /* ---- THE BILLING MIRROR (migration 087), step 19. ----
     Not a new request and not a new route: `GET /api/account` already does `select('*')` on
     `companies`, so these eight have been coming back since step 17 and nothing was reading them.
     They are READ here and written nowhere — Stripe owns every one of them (`DECISIONS.md` §216). */
  trial_ends_at: string | null
  subscription_status: string | null
  payment_failed_at: string | null
  current_period_end: string | null
  card_brand: string | null
  card_last4: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  /** Stripe's scheduled end (migration 089). */
  cancel_at: string | null
  /* ---- WHAT THIS COMPANY PAYS (migration 090, §221) ----
     The amount is Stripe's own next-invoice total; **0 is a real value and is not null**. The six
     discount columns are what turns "$0 a month" from a bug into a sentence. */
  next_charge_amount_cents: number | null
  next_charge_currency: string | null
  discount_name: string | null
  discount_percent_off: number | null
  discount_amount_off_cents: number | null
  discount_duration: string | null
  discount_months: number | null
  discount_ends_at: string | null
}

const ROW = 'flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4'
const ROW_LAST = 'flex items-start justify-between gap-4 px-5 py-4'
const KEY = 'w-[128px] shrink-0 text-[13px] text-gray-500'
const ACTION = 'shrink-0 text-[13px] text-[var(--green-ink)] hover:underline disabled:text-gray-300'
const FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-900 ' +
  'focus:border-[var(--green)] focus:outline-none'

/**
 * ONE LINE OF THE COMPANY TAB — the walk's card, in this page's row.
 *
 * `docs/account-walk-card.html` draws the walk; this is the same thing in the tab's frame: the
 * words as text with a small `change`, and a box with `Done` when asked. The difference from the
 * walk is that here `Done` SAVES — there is no "Yes, that's us" at the bottom of this page to do
 * it later — and that is why the two are separate pieces rather than one component told which
 * page it is on (the note on `components/SwitchAnswerControl.tsx` makes the same argument).
 */
function TabLine({ value, open, busy, label, draft, onDraft, onOpen, onDone, multiline = false }: {
  value: string
  open: boolean
  busy: boolean
  label: string
  draft: string
  onDraft: (v: string) => void
  onOpen: () => void
  onDone: () => void
  multiline?: boolean
}) {
  const FIELD_CLASS =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-900 ' +
    'focus:border-[var(--green)] focus:outline-none'
  if (!open) {
    return (
      <p className="text-[14px] leading-6 text-gray-900">
        {value.trim() || <span className="text-gray-400">&nbsp;</span>}
        <button type="button" disabled={busy} onClick={onOpen}
          className="ml-2 align-baseline text-[13px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
          {lineAction(value)}
        </button>
      </p>
    )
  }
  return (
    <>
      {multiline ? (
        <textarea value={draft} disabled={busy} autoFocus
          rows={sentenceRows(draft)} cols={SENTENCE_COLS}
          onChange={(e) => onDraft(e.target.value)}
          aria-label={label} className={`${FIELD_CLASS} resize-none leading-6`} />
      ) : (
        <input type="text" value={draft} disabled={busy} autoFocus
          onChange={(e) => onDraft(e.target.value)}
          aria-label={label} className={FIELD_CLASS} />
      )}
      <p className="mt-1 text-[12.5px] text-gray-500">
        {WRITE_HINT}
        <button type="button" disabled={busy} onClick={onDone}
          className="ml-2 text-[var(--green-ink)] hover:underline disabled:text-gray-300">{DONE}</button>
      </p>
    </>
  )
}

function Account() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()

  const tabParam = asTab(params.get('tab'))
  const [tab, setTab] = useState<AccountTab>(tabParam)
  useEffect(() => { setTab(tabParam) }, [tabParam])

  /** The address as it stands, including a change this page made that the router has not taken. */
  const searchRef = useRef(params.toString())
  useEffect(() => { searchRef.current = params.toString() }, [params])

  /**
   * The state moves first and the address follows, which is the audits hotfix's shape. There is no
   * empty-query branch here because `asTab` has no null: every tab, including the first, is written.
   */
  const selectTab = (k: AccountTab) => {
    setTab(k)
    const p = new URLSearchParams(searchRef.current)
    p.set('tab', k)
    searchRef.current = p.toString()
    router.replace(`/account?${p}`, { scroll: false })
  }

  const [company, setCompany] = useState<CompanyRow | null>(null)
  const [sites, setSites] = useState<SiteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  /** null = closed, { site } = editing one, { site: null } = "+ Add a site". */
  const [drawer, setDrawer] = useState<{ site: SiteRow | null } | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const res = await fetch('/api/account', { headers: await authHeaders() })
    const json = await res.json().catch(() => null)
    const d = json?.data
    if (d) {
      setCompany({
        id: d.id, name: d.name ?? null, about: d.about ?? null,
        what_you_do: d.what_you_do ?? null, website_url: d.website_url ?? null,
        // The mirror, read. Named one by one rather than spread, so this page takes exactly what
        // it draws and a column added to `companies` later does not arrive here by accident.
        trial_ends_at: d.trial_ends_at ?? null,
        subscription_status: d.subscription_status ?? null,
        payment_failed_at: d.payment_failed_at ?? null,
        current_period_end: d.current_period_end ?? null,
        card_brand: d.card_brand ?? null,
        card_last4: d.card_last4 ?? null,
        stripe_customer_id: d.stripe_customer_id ?? null,
        stripe_subscription_id: d.stripe_subscription_id ?? null,
        cancel_at: d.cancel_at ?? null,
        // Migration 090. `?? null` and NOT `?? 0`: an unread amount must stay unread — see
        // `moneyFor`, which refuses to print the list price in its place.
        next_charge_amount_cents: d.next_charge_amount_cents ?? null,
        next_charge_currency: d.next_charge_currency ?? null,
        discount_name: d.discount_name ?? null,
        discount_percent_off: d.discount_percent_off ?? null,
        discount_amount_off_cents: d.discount_amount_off_cents ?? null,
        discount_duration: d.discount_duration ?? null,
        discount_months: d.discount_months ?? null,
        discount_ends_at: d.discount_ends_at ?? null,
      })
    }
    // As the person: `entities_select` scopes it, so no company is named here.
    const { data: rows } = await supabase
      .from('entities')
      .select('id, name, address, postal_code, state, county, city, is_primary, created_at')
      .eq('entity_type', 'site')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
    setSites((rows ?? []) as SiteRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ---- THE RECONCILE — My Account step 20, `DECISIONS.md` §220 ---------------------------------
     A customer returning from Checkout must never be told "No card yet" seconds after being
     charged. That is what the owner was shown during his own walk, when his Stripe listener had
     died and the completed session's events were never delivered — and the same gap exists with
     no outage at all, because Stripe redirects the browser back before the webhook lands.

     *** THE TRIGGER IS THE STATE, NOT `?card=added`. *** `reconcileTrigger` in `lib/billingView.ts`
     holds the rule and the argument for it. `?card=added` decides only whether the person is told
     we are finishing up, and it is stripped afterwards so a refresh cannot re-trigger the message.

     *** AND IT RUNS AT MOST ONCE. *** `asked` is a ref, so the reload this effect performs — which
     changes `company` and re-runs it — cannot start a second request. Never a poll, and never a
     spinner that can hang: whatever the route answers, the mirror is re-read and the page is
     drawn. On the quiet path (no `card=added`) nothing is said at all, which is what keeps a
     company who genuinely abandoned Checkout from being shown a progress message about a repair
     that will correctly do nothing. */
  const cardAdded = params.get('card') === 'added'
  const asked = useRef(false)
  const [finishing, setFinishing] = useState<string | null>(null)
  const [stalled, setStalled] = useState(false)

  /** Take `card=added` off the address, keeping the tab. Board 1's rule: never a bare path. */
  const dropCardParam = useCallback(() => {
    const q = new URLSearchParams(searchRef.current)
    if (!q.has('card')) return
    q.delete('card')
    if (!q.get('tab')) q.set('tab', 'billing')
    searchRef.current = q.toString()
    router.replace(`/account?${q}`, { scroll: false })
  }, [router])

  useEffect(() => {
    if (tab !== 'billing' || !company || asked.current) return
    const trigger = reconcileTrigger(company, cardAdded)
    if (!trigger.call) { dropCardParam(); return }
    asked.current = true
    ;(async () => {
      setFinishing(trigger.say)
      let repaired = false
      try {
        // No body: the company is the session's, and there is no id to pass (§3.6).
        const res = await fetch('/api/billing/reconcile', { method: 'POST', headers: await authHeaders() })
        repaired = Boolean((await res.json().catch(() => null))?.repaired)
      } catch {
        // Deliberately ignored. The reconcile is a repair, not the page: whether it answered or
        // not, the lines below draw what the mirror actually says, which is never a lie.
      }
      /* *** A REPAIR IS A FULL NAVIGATION, NOT A SOFT RELOAD — AND THE STAGING RUN IS WHY. ***
         `load()` re-reads the company for THIS page. It cannot re-read `components/AppLayout.tsx`'s
         own `companies` query, which drew the read-only band above the top bar on mount. So the
         repaired tab said "Active · Next payment 24 November 2026 · Visa ending 4242" with a band
         across the top of it still saying "Your trial has ended — add a card". One of the two was
         false, and it was the loud one.

         Only on a repair, and only then: the quiet path (a company that really did abandon
         Checkout) and the stalled path both stay soft, because nothing changed for them and a
         reload would be a flash for no reason. There is no loop — after this navigation the mirror
         names a subscription, so `reconcileTrigger` returns `call: false` and this never runs
         again. It also drops `?card=added` by not carrying it, which is the same thing
         `dropCardParam` does on the other paths. */
      if (repaired) { window.location.replace('/account?tab=billing'); return }
      await load()
      setFinishing(null)
      // Said only to somebody back from Checkout — see FINISHING_STALLED. The condition is read
      // off the FRESH row this render is given, not off this closure's stale `company`, so it is
      // checked in the render below instead of here.
      setStalled(cardAdded)
      dropCardParam()
    })()
    // *** NO `live` CLEANUP, AND THE STAGING RUN IS WHY. ***
    // It had one — `let live = true`, cleared in a cleanup, with `if (!live) return` after the
    // reload, which is the ordinary way to write this. It hung the page on "Finishing up…" for
    // ever: `load()` sets `company`, `company` is in these deps, so the effect re-runs, so the
    // PREVIOUS run's cleanup fires and sets `live = false` — cancelling the very continuation that
    // clears `finishing`. The re-run then exits on `asked.current` and nothing ever puts the
    // sentence right. The guard was cancelling itself, and the only thing it protected against was
    // a setState after unmount, which React 19 does not even warn about. Caught on staging, by
    // looking at the page three seconds after the request; nothing in the gate could have seen it.
  }, [tab, company, cardAdded, load, dropCardParam])

  const mainSite = useMemo(() => sites.find((s) => s.is_primary) ?? null, [sites])

  // ── The two lines the card shows, each openable on its own ─────────────────────────────────────
  const [openLine, setOpenLine] = useState<'about' | 'industry' | null>(null)
  const [aboutDraft, setAboutDraft] = useState('')
  const [industryDraft, setIndustryDraft] = useState('')
  /**
   * The code of a suggestion the person PICKED, and nothing else. Typing again clears it, because
   * the sentence is then no longer the standard's — decision 3: the code is stored only when a
   * suggestion was taken, and a stale code on edited words would be a classification nobody chose.
   */

  // ── The website ────────────────────────────────────────────────────────────────────────────────
  const [editSite, setEditSite] = useState(false)
  const [siteDraft, setSiteDraft] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * THE ONE WRITE ONTO `companies`, THROUGH THE CALLER'S OWN CLIENT.
   *
   * Three columns, every one of them in 082's `grant update (…) on companies to authenticated`. A
   * fourth would not be refused by an `if` here — it would be refused by Postgres, which is the
   * point of putting the boundary in the grant (`CLAUDE.md` §3.6).
   */
  async function writeCompany(patch: Partial<Pick<CompanyRow, 'about' | 'what_you_do' | 'website_url'>>) {
    if (!company || busy) return
    setBusy(true)
    setNotice(null)
    const { error } = await supabase.from('companies').update(patch).eq('id', company.id)
    setBusy(false)
    if (error) {
      // The sentence a person is shown is ours, in plain words. The column-grant refusal itself
      // reads "permission denied for table companies" — table, not column, and it names nothing a
      // person could act on (§5.1, and the surprise recorded at step 5).
      setNotice('We could not save that just now. Nothing was changed.')
      return
    }
    setCompany({ ...company, ...patch })
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-[900px] px-4 pt-6 sm:px-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">{TITLE}</h1>
          <p className="mt-1 text-[14px] text-gray-500">{LEDE}</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* The 900 column, the same as /calendar, /hr and /compliance. */}
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="no-print pt-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">{TITLE}</h1>
          <p className="mt-1 text-[14px] text-gray-500">{LEDE}</p>
        </div>

        <Tabs active={tab} onSelect={selectTab} tabs={TABS} />

        {notice && <p className="mb-4 text-[13px] text-[var(--amber)]">{notice}</p>}

        {tab === 'company' && company && (
          <>
            {/* ─────────────────────────── Your company ─────────────────────────── */}
            <DashboardSection heading={COMPANY_HEADING} />
            <div className="rounded-xl border border-gray-200 bg-white">
              {/* THE NAME. Shown, with the board's grey line, and in no request body. */}
              <div className={ROW}>
                <p className={KEY}>{COMPANY_LABEL}</p>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-gray-900">{company.name ?? '—'}</p>
                  <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">{NAME_NOTE}</p>
                </div>
                {/* Deliberately no control. Board 1 draws a dash where the action would be. */}
                <span className="shrink-0 text-[13px] text-gray-300">—</span>
              </div>

              {/* *** THE SAME TWO LINES THE WALK'S CARD SHOWS — `docs/account-walk-card.html`. ***
                  The sentence and the broad industry line, each read as text with a small `change`
                  that turns THAT one into a box. The NAICS control is gone from both doors: step 15
                  took it off every screen a person sees, and 086 took the grant with it, so this
                  page could not write `naics_code` now even if it still tried. */}
              <div className={ROW}>
                <p className={KEY}>{WHAT_YOU_DO_LABEL}</p>
                <div className="min-w-0 flex-1">
                  <TabLine
                    value={company.about ?? ''} open={openLine === 'about'} busy={busy}
                    label={WHAT_YOU_DO_LABEL} multiline
                    draft={aboutDraft} onDraft={setAboutDraft}
                    onOpen={() => { setAboutDraft(company.about ?? ''); setOpenLine('about') }}
                    onDone={async () => {
                      await writeCompany({ about: aboutDraft.trim() || null })
                      setOpenLine(null)
                    }} />
                </div>
              </div>

              <div className={ROW}>
                <p className={KEY}>{INDUSTRY_LINE}</p>
                <div className="min-w-0 flex-1">
                  <TabLine
                    value={company.what_you_do ?? ''} open={openLine === 'industry'} busy={busy}
                    label={INDUSTRY_LINE}
                    draft={industryDraft} onDraft={setIndustryDraft}
                    onOpen={() => { setIndustryDraft(company.what_you_do ?? ''); setOpenLine('industry') }}
                    onDone={async () => {
                      await writeCompany({ what_you_do: industryDraft.trim() || null })
                      setOpenLine(null)
                    }} />
                </div>
              </div>

              {/* THE WEBSITE. */}
              <div className={ROW}>
                <p className={KEY}>{WEBSITE_LABEL}</p>
                <div className="min-w-0 flex-1">
                  {editSite ? (
                    <>
                      <input type="text" value={siteDraft} autoFocus disabled={busy}
                        onChange={(e) => setSiteDraft(e.target.value)}
                        placeholder="example.com" aria-label={WEBSITE_LABEL} className={FIELD} />
                      <div className="mt-2 flex items-center gap-3">
                        <button type="button" disabled={busy} className={PRIMARY}
                          onClick={async () => {
                            await writeCompany({ website_url: siteDraft.trim() || null })
                            setEditSite(false)
                          }}>{SAVE}</button>
                        <button type="button" className={TEXT_ACTION}
                          onClick={() => setEditSite(false)}>{CANCEL}</button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[14px] text-gray-900">
                      {company.website_url
                        ? company.website_url
                        : <span className="text-gray-400">{WEBSITE_EMPTY}</span>}
                    </p>
                    /*
                      *** BOARD 1'S SECOND LINE HERE IS NOT DRAWN, ON PURPOSE. *** It reads "Read on
                      21 October 2026 · 2 facts confirmed from it". Nothing has ever read a website:
                      that is step 13, behind `AI_MODEL_WEBSITE`. Drawing the line now would be the
                      page asserting a read that never happened — the omniscient-tracker
                      anti-pattern in miniature (`CLAUDE.md` §6). It arrives with the read.
                    */
                  )}
                </div>
                {!editSite && (
                  <button type="button" className={ACTION}
                    onClick={() => { setSiteDraft(company.website_url ?? ''); setEditSite(true) }}>
                    {CHANGE}
                  </button>
                )}
              </div>

              {/* THE MAIN SITE — the company's address (decision 4). */}
              <div className={ROW_LAST}>
                <p className={KEY}>{MAIN_SITE_LABEL}</p>
                <div className="min-w-0 flex-1">
                  {mainSite ? (
                    <>
                      <p className="text-[14px] text-gray-900">{mainSite.name ?? '—'}</p>
                      <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">
                        {siteSubLine(mainSite) || 'No address yet'}
                      </p>
                    </>
                  ) : (
                    // Migration 010's trigger gives every company one, so this is a real anomaly
                    // rather than an empty state — and it says so instead of drawing a blank row.
                    <p className="text-[14px] text-gray-500">
                      We cannot find your main site. Write to us and we will put it right.
                    </p>
                  )}
                </div>
                {mainSite && (
                  <button type="button" className={ACTION}
                    onClick={() => setDrawer({ site: mainSite })}>{EDIT_ADDRESS}</button>
                )}
              </div>
            </div>

            {/* ──────────────────── Three things we need to know ──────────────────── */}
            <CompanyQuestions db={supabase} companyId={company.id} onAnswered={load} />

            {/* ───────────────────────────── Sites ───────────────────────────── */}
            <div className="mt-9 mb-2 flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-[20px] font-normal text-gray-900">{SITES_HEADING}</h2>
              <button type="button" className={ACTION}
                onClick={() => setDrawer({ site: null })}>{ADD_SITE}</button>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white">
              {sites.map((s, i) => (
                <div key={s.id} className={i === sites.length - 1 ? ROW_LAST : ROW}>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[14px] text-gray-900">
                      {s.name ?? '—'}
                      {s.is_primary && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                          {MAIN_PILL}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">
                      {[s.address ?? '', countyLine(s), s.is_primary ? null : addedLine(s)]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" className={ACTION}
                    onClick={() => setDrawer({ site: s })}>{EDIT}</button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] leading-5 text-gray-500">{SITES_NOTE}</p>
          </>
        )}

        {/* Step 7 replaced the empty state with the list, the invite card and Remove. */}
        {tab === 'people' && <PeopleTab db={supabase} />}

        {tab === 'signin' && <SignInTab />}
        {tab === 'billing' && <BillingTab company={company} finishing={finishing} stalled={stalled} />}
        {tab === 'cancel' && <CancelTab companyName={company?.name ?? ''} company={company} />}
      </div>

      {drawer && (
        <SiteDrawer
          site={drawer.site}
          db={supabase}
          companyName={company?.name ?? null}
          onClose={() => { setDrawer(null); load() }}
          onSaved={() => load()} />
      )}
    </AppLayout>
  )
}

/* =================================================================================================
   THE OTHER THREE TABS.

   Sign-in and Cancel are boards 3 and 5, built at steps 8 and 9. Billing is still today's
   placeholder and arrives properly with part C.
   ================================================================================================= */

/**
 * BOARD 3 — your name, your email, your password.
 *
 * *** EACH OF THE THREE IS WRITTEN A DIFFERENT WAY, AND THE DIFFERENCE IS THE POINT. ***
 *   · the NAME goes straight onto `profiles` as the caller — `full_name` is in the column grant
 *     (080) and the UPDATE policy is `auth.uid() = profiles.id`, so a person can only ever write
 *     their own row and no route is needed to say so.
 *   · the EMAIL goes through the caller's OWN session — `supabase.auth.updateUser({ email })` in
 *     the browser — because the login system has to send the confirmation and bind it to that
 *     session. No admin call: a route that could change anybody's address is not a thing to build
 *     for a form a person fills in about themselves.
 *   · the PASSWORD goes through `POST /api/account/password`, which re-checks the current one
 *     SERVER-SIDE. That cannot be done in the browser, because nothing would stop a caller
 *     skipping the check.
 */
function SignInTab() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [editName, setEditName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [resetSent, setResetSent] = useState(false)
  const [emailSheet, setEmailSheet] = useState(false)
  /** Board 3's promise, shown under Email once the link is on its way. */
  const [emailSent, setEmailSent] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    setEmail(user.email ?? '')
    const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    setName(data?.full_name ?? '')
    setLoaded(true)
  }, [])
  useEffect(() => { load() }, [load])

  async function saveName() {
    if (!userId || busy) return
    setBusy(true)
    setNotice(null)
    const { error } = await supabase.from('profiles').update({ full_name: nameDraft.trim() }).eq('id', userId)
    setBusy(false)
    if (error) { setNotice('We could not save your name just now.'); return }
    setName(nameDraft.trim())
    setEditName(false)
  }

  /**
   * *** THE SAME CALL `/forgot-password` MAKES, FOR THE ADDRESS ON THIS ACCOUNT. ***
   * `app/forgot-password/page.tsx:21`, with the same `redirectTo`, so there is one way to set a
   * password in this product and one page that accepts it. The address is the session's own and is
   * never typed here: a box would turn "change my password" into "send a reset link to an address
   * I choose", which is a different and much worse feature.
   */
  async function sendResetLink() {
    if (busy || !email) return
    setBusy(true)
    setNotice(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (error) { setNotice(RESET_FAILED); return }
    setResetSent(true)
  }

  if (!loaded) return null

  return (
    <>
      <DashboardSection heading={SIGNIN_HEADING} />
      {notice && <p className="mb-3 text-[13px] text-[var(--amber)]">{notice}</p>}

      <div className="rounded-xl border border-gray-200 bg-white">
        {/* ---- Your name ---- */}
        <div className={ROW}>
          <p className={KEY}>{NAME_LABEL}</p>
          <div className="min-w-0 flex-1">
            {editName ? (
              <>
                <input type="text" value={nameDraft} autoFocus disabled={busy}
                  onChange={(e) => setNameDraft(e.target.value)}
                  aria-label={NAME_LABEL} className={FIELD} />
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" disabled={busy} className={PRIMARY} onClick={saveName}>{SAVE}</button>
                  <button type="button" className={TEXT_ACTION}
                    onClick={() => setEditName(false)}>{CANCEL}</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[14px] text-gray-900">{name || <span className="text-gray-400">Not given</span>}</p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">{NAME_NOTE_SIGNIN}</p>
              </>
            )}
          </div>
          {!editName && (
            <button type="button" className={ACTION}
              onClick={() => { setNameDraft(name); setEditName(true) }}>{CHANGE}</button>
          )}
        </div>

        {/* ---- Email ---- */}
        <div className={ROW}>
          <p className={KEY}>{EMAIL_LABEL}</p>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-gray-900">{email}</p>
            <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">{emailSent ?? EMAIL_NOTE}</p>
          </div>
          <button type="button" className={ACTION} onClick={() => setEmailSheet(true)}>{CHANGE}</button>
        </div>

        {/* ---- Password ---- */}
        <div className={ROW_LAST}>
          <p className={KEY}>{PASSWORD_LABEL}</p>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] tracking-[0.15em] text-gray-900">{PASSWORD_MASK}</p>
            {/* What will happen, before it happens, naming the address it goes to. Once it has
                gone, the row says so and stops offering the button — pressing it twice sends two
                links, and the second one invalidates the first. */}
            <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">
              {resetSent ? RESET_SENT : passwordResetNote(email)}
            </p>
            {/* Board 3 draws "Last changed ‹date›" here. The login system does not hold that fact —
                see `lib/accountView.ts` PASSWORD_LAST_CHANGED — so nothing is drawn rather than a
                date that means something else. */}
            {PASSWORD_LAST_CHANGED && (
              <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">{PASSWORD_LAST_CHANGED}</p>
            )}
          </div>
          {!resetSent && (
            <button type="button" disabled={busy} className={ACTION}
              onClick={sendResetLink}>{SEND_RESET_LINK}</button>
          )}
        </div>
      </div>
      {emailSheet && (
        <EmailSheet current={email} onClose={() => setEmailSheet(false)}
          onSent={(next) => { setEmailSent(emailSentLine(next, email)); setEmailSheet(false) }} />
      )}
    </>
  )
}

/**
 * The email change, on the caller's own session. `updateUser({ email })` is what makes the login
 * system send the confirmation and bind it to this person; there is no admin call here and no
 * route, because the thing being changed is the identity of the session making the request.
 */
function EmailSheet({ current, onClose, onSent }: {
  current: string; onClose: () => void; onSent: (next: string) => void
}) {
  const supabase = createClient()
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (busy) return
    setError(null)
    if (!looksLikeEmail(next)) { setError(BAD_EMAIL); return }
    setBusy(true)
    const { error: e } = await supabase.auth.updateUser({ email: next.trim() })
    setBusy(false)
    if (e) { setError(e.message || EMAIL_CHANGE_FAILED); return }
    onSent(next.trim())
  }

  return (
    <Sheet title={CHANGE_EMAIL_TITLE} lede={EMAIL_NOTE} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-gray-600" htmlFor="new-email">
            {NEW_EMAIL_LABEL}
          </label>
          <input id="new-email" type="text" value={next} disabled={busy}
            onChange={(e) => setNext(e.target.value)}
            placeholder={current} aria-label={NEW_EMAIL_LABEL} className={FIELD} />
        </div>
        {error && <p className="text-[13px] text-[var(--amber)]">{error}</p>}
        <div className="flex items-center gap-3 pt-1">
          <button type="button" disabled={busy || !next.trim()} className={PRIMARY}
            onClick={send}>{SEND_CONFIRMATION}</button>
          <button type="button" className={TEXT_ACTION} onClick={onClose}>{CANCEL}</button>
        </div>
      </div>
    </Sheet>
  )
}

/** The pill's colours. The WORDS are `lib/billingView.ts`'s; only the paint is here. */
const PILL_TONE: Record<StatusTone, string> = {
  trial:  'bg-amber-50 text-amber-800 border-amber-200',
  good:   'bg-green-50 text-[var(--green-ink)] border-green-200',
  warn:   'bg-amber-50 text-amber-800 border-amber-200',
  paused: 'bg-gray-100 text-gray-700 border-gray-200',
}

/**
 * BOARD 4 — the Billing tab, My Account step 19.
 *
 * *** IT READS THE MIRROR AND WRITES NOTHING. *** Every line comes from the eight columns
 * migration 087 keeps in step with Stripe, which `GET /api/account` already returned. The two
 * buttons do one thing each: ask our own route for a Stripe URL and go there. Stripe takes the
 * card, Stripe hosts the portal, the webhook writes what came back, and this tab reads it on the
 * next load. Nothing about a subscription is decided here. `DECISIONS.md` §216.
 *
 * The words are all in `lib/billingView.ts`, which is pure and has every state under test —
 * including the ones that are hard to reach by hand (a status Stripe has not invented yet, a
 * subscription active before its first `current_period_end` has landed).
 */
function BillingTab({ company, finishing, stalled }: {
  company: CompanyRow | null
  /** `FINISHING_UP` while the reconcile is in flight for somebody back from Checkout; else null. */
  finishing: string | null
  /** True once a reconcile for somebody back from Checkout has finished. See the render below. */
  stalled: boolean
}) {
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState('')

  // Hand the person to Stripe. A refusal from either route is shown AS ITS SENTENCE, beside the
  // control that was pressed — both routes already answer in plain words (§5.1), including the
  // portal's 409 for a company with no customer yet and the 503 for a server with no key.
  async function go(door: 'checkout' | 'portal') {
    if (busy) return
    setBusy(door); setError('')
    try {
      const res = await fetch(`/api/billing/${door}`, { method: 'POST', headers: await authHeaders() })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.url) {
        setError(json?.error ?? "We couldn't open the payment page just now. Please try again in a moment.")
        setBusy(null)
        return
      }
      window.location.href = json.url
    } catch {
      setError("We couldn't open the payment page just now. Please try again in a moment.")
      setBusy(null)
    }
  }

  // Before the row has loaded there is nothing true to say, so nothing is said. A default of
  // "Trial" would be this page asserting a status it has not read.
  //
  // `trial_ends_at` is in the condition because `billingTabView` requires it, and it requires it
  // because migration 087 made the column NOT NULL — the rule is never allowed to guess at a
  // missing trial end. So this branch is "the row has not arrived", not a state a company can be
  // in, and it says the one true thing rather than rendering a plan nobody has read.
  if (!company || !company.trial_ends_at) {
    return (
      <>
        <DashboardSection heading="Your plan" />
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-[13px] text-gray-500">Reading your plan…</p>
        </div>
      </>
    )
  }

  const view = billingTabView({ ...company, trial_ends_at: company.trial_ends_at }, new Date())

  /* ---- THE TWO WORDS THE RECONCILE ADDS, AND NOTHING ELSE ABOUT THIS TAB CHANGES (§220) ----
     While it runs, the card line says `Finishing up…` instead of "No card yet" — because "No card
     yet" is the sentence we are not yet entitled to, and it is the one the owner was shown after
     paying $199.

     After it runs, `FINISHING_STALLED` appears ONLY if the mirror still has no subscription. That
     is checked here, against the row this render was given, rather than inside the effect that
     reloaded it — a closure there would be holding the row from BEFORE the reload and would show
     the note to somebody whose repair had just succeeded. A repaired mirror simply draws Active,
     and the note is never seen. */
  const cardText = finishing ?? view.card.text
  const stillWaiting = stalled && !view.hasSubscription

  return (
    <>
      <DashboardSection heading="Your plan" />

      <div className="rounded-xl border border-gray-200 bg-white">
        {/* ---- Plan ----
            *** THE AMOUNT IS THIS COMPANY'S, NOT THE PRODUCT'S (§221). *** It was `PLAN_PRICE`,
            a constant, and a 100%-off customer was therefore told "$199 a month" about a
            subscription that will never be charged anything. `view.plan.amount` is the mirrored
            next-invoice total when there is a subscription, and the list price only when there is
            none — the one case where the page is describing the product and not this company.
            The discount is named beside it, because "$0 a month" with no reason reads like a bug. */}
        <div className={ROW}>
          <p className={KEY}>Plan</p>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-gray-900">
              <span data-testid="billing-amount" className="font-medium">{view.plan.amount}</span>{' '}
              <span className="text-[13px] text-gray-500">{view.plan.period}</span>
              {view.plan.discount && (
                <span data-testid="billing-discount" className="text-[13px] text-gray-500">
                  {' \u2014 '}{view.plan.discount}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[13px] leading-5 text-gray-600">{view.plan.note}</p>
          </div>
        </div>

        {/* ---- Status ---- */}
        <div className={ROW}>
          <p className={KEY}>Status</p>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span data-testid="billing-pill"
                className={`rounded-full border px-2 py-0.5 text-[12px] font-medium ${PILL_TONE[view.status.tone]}`}>
                {view.status.pill}
              </span>
              {view.status.headline && (
                <span className="text-[14px] text-gray-900">{view.status.headline}</span>
              )}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-gray-600">{view.status.detail}</p>
          </div>
        </div>

        {/* ---- Card ---- */}
        <div className={ROW_LAST}>
          <p className={KEY}>Card</p>
          <div className="min-w-0 flex-1">
            <p data-testid="billing-card-line" className="text-[14px] text-gray-900">{cardText}</p>
            {stillWaiting ? (
              <p data-testid="billing-finishing" className="mt-1 text-[13px] text-gray-500">
                {FINISHING_STALLED}
              </p>
            ) : view.card.note ? (
              /* The date a discount ends, for a company with no card. §221: the only honest
                 reason to ask for a card today is a deadline, and without the date the request
                 reads as nagging. */
              <p data-testid="billing-card-note" className="mt-1 text-[13px] text-gray-500">
                {view.card.note}
              </p>
            ) : null}
            {error && <p className="mt-1 text-[13px] text-[var(--amber)]">{error}</p>}
          </div>
          {/* *** AN EMPTY ACTION RENDERS NO BUTTON (§221). *** A company whose discount covers the
              whole of it, for ever, has nothing to pay and needs no card — so there is nothing for
              a button to do, and offering one is an instruction to waste a minute. */}
          {view.card.action && (
            <button type="button" data-testid="billing-card-action"
              onClick={() => go(view.card.door)} disabled={busy !== null || finishing !== null} className={ACTION}>
              {busy === view.card.door ? 'Opening…' : view.card.action}
            </button>
          )}
        </div>
      </div>

      {/* ---- Stripe's own page, and the way back to it ----
          The LINK is offered only when there is a subscription to manage (§218). It goes to the
          portal unconditionally, and a portal opened for a customer with no subscription is the
          same dead end the card door above used to lead to: a card can be added there that
          nothing will charge and no webhook reports. The sentence about Stripe holding the card
          is true either way, so it stays. */}
      <p className="mt-3 text-[13px] leading-5 text-gray-500">
        {STRIPE_NOTE}
        {view.hasSubscription && (
          <>
            {' '}
            <button type="button" data-testid="billing-manage" onClick={() => go('portal')} disabled={busy !== null}
              className="text-[var(--green-ink)] hover:underline disabled:text-gray-300">
              {busy === 'portal' ? 'Opening…' : MANAGE_LINK}
            </button>
          </>
        )}
      </p>

      {/* ---- After the trial — board 4's three plain paragraphs ---- */}
      <DashboardSection heading="After the trial" />
      <div className="rounded-xl border border-gray-200 bg-white">
        {AFTER_THE_TRIAL.map((p, i) => (
          <div key={p.key} className={i === AFTER_THE_TRIAL.length - 1 ? ROW_LAST : ROW}>
            <p className={KEY}>{p.key}</p>
            <p className="min-w-0 flex-1 text-[13px] leading-5 text-gray-600">{p.text}</p>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * BOARD 5 — two different things, kept apart (decision 13): stopping the subscription, and deleting
 * the company for good. The delete is what the page does today with its words tidied; the
 * subscription row is new and is deliberately inert until part C.
 *
 * *** THE ROUTE IS NOT TOUCHED. *** `/api/account` DELETE's order — children, then the company,
 * then the logins last so a failure leaves the account still reachable — is exactly as it was.
 */
function CancelTab({ companyName, company }: { companyName: string; company: CompanyRow | null }) {
  const supabase = createClient()
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [typed, setTyped] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [stopBusy, setStopBusy] = useState(false)
  const [stopError, setStopError] = useState('')

  // A subscription exists if Stripe gave us one. `stripe_customer_id` is NOT the test: a customer
  // is created the moment somebody opens checkout, even if they abandon it, so it would offer
  // cancellation to a person who never subscribed.
  const hasSubscription = Boolean(company?.stripe_subscription_id)
  // Stripe keeps the status as `trialing`/`active` until the date arrives, so this is the only
  // thing that says a cancellation is already scheduled (§219).
  const cancelScheduled = Boolean(company?.cancel_at)

  async function stopPaying() {
    if (stopBusy) return
    setStopBusy(true); setStopError('')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST', headers: await authHeaders() })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.url) {
        setStopError(json?.error ?? "We couldn't open the billing page just now. Please try again in a moment.")
        setStopBusy(false)
        return
      }
      window.location.href = json.url
    } catch {
      setStopError("We couldn't open the billing page just now. Please try again in a moment.")
      setStopBusy(false)
    }
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Fetches the export with the session token attached, then hands the browser the file. A plain
  // link cannot be used because the route requires an Authorization header.
  async function download() {
    setDownloading(true)
    setDownloadError('')
    try {
      const res = await fetch('/api/account/export', { headers: await authHeaders() })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not build your export')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="(.+)"/)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = match ? match[1] : 'compliboard-export.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download your data')
    } finally {
      setDownloading(false)
    }
  }

  async function destroy() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ confirmation: typed.trim() }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || DELETE_FAILED)
      }
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : DELETE_FAILED)
      setBusy(false)
      setConfirming(false)
    }
  }

  const matches = typed.trim() === companyName && companyName.length > 0

  return (
    <>
      <DashboardSection heading={CANCEL_HEADING} />

      <div className="rounded-xl border border-gray-200 bg-white">
        {/* ---- Stop paying — LIVE since step 19, and it opens Stripe's portal. ----
            *** STRIPE HOSTS CANCELLATION, AND THAT IS A DECISION. *** We could call
            `subscriptions.update({ cancel_at_period_end: true })` from our own route, and then we
            would own the confirmation screen, the "are you sure", the wording about what happens
            at the end of the period, and the reinstate path — all of which Stripe already has,
            localised and tested, and all of which would be a second place the subscription can be
            changed. The portal is one door, and the webhook tells us what happened through the
            mirror. `DECISIONS.md` §216.

            The row is shown only when a subscription EXISTS. Offering "Cancel the subscription" to
            somebody still in their trial would invent a relationship they do not have, and the
            button would reach a portal with nothing in it. */}
        <div className={ROW}>
          <p className={KEY}>{STOP_PAYING_LABEL}</p>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-5 text-gray-600">
              {!hasSubscription
                ? STOP_PAYING_NONE
                : cancelScheduled
                  ? STOP_PAYING_SCHEDULED(plainDate(company?.cancel_at ?? null))
                  : STOP_PAYING_NOTE}
            </p>
            {stopError && <p className="mt-1 text-[13px] text-[var(--amber)]">{stopError}</p>}
          </div>
          {hasSubscription && (
            // *** `OUTLINE`, NOT `ACTION`. *** The owner could not find this control on his own
            // walk: as plain underlined text beside a prominent green "Download my data" button it
            // read as a LABEL for the sentence, not as the thing to press. `OUTLINE` is the house's
            // own bordered control (`components/buttonStyles.ts`, used by AuditReport's footer and
            // HR's "Check now") — a button at a smaller weight than the primary beside it. Nothing
            // moves and nothing else is restyled: it is one class on one element.
            <button type="button" data-testid="stop-paying" onClick={stopPaying}
              disabled={stopBusy} className={`shrink-0 whitespace-nowrap ${OUTLINE}`}>
              {stopBusy ? 'Opening…' : cancelScheduled ? STOP_PAYING_SCHEDULED_ACTION : STOP_PAYING_ACTION}
            </button>
          )}
        </div>

        {/* ---- Download everything ---- */}
        <div className={ROW_LAST}>
          <p className={KEY}>{DOWNLOAD_LABEL}</p>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-5 text-gray-600">{DOWNLOAD_NOTE}</p>
            {downloadError && <p className="mt-1 text-[13px] text-[var(--amber)]">{downloadError}</p>}
          </div>
          <button type="button" onClick={download} disabled={downloading}
            className={`shrink-0 whitespace-nowrap ${PRIMARY}`}>
            {downloading ? 'Preparing your file…' : DOWNLOAD_ACTION}
          </button>
        </div>
      </div>

      {/* ---- Delete the company for good ---- */}
      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-[14px] font-medium text-red-800">{DELETE_TITLE}</p>
        <p className="mt-1 text-[13px] leading-5 text-red-700">{deleteWarning(companyName || 'this company')}</p>

        <label className="mt-4 block text-[12px] font-medium text-red-800" htmlFor="delete-confirm">
          {TYPE_TO_CONFIRM}
        </label>
        <input id="delete-confirm" type="text" value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={companyName} aria-label={TYPE_TO_CONFIRM}
          className="mt-1 w-full max-w-[420px] rounded-lg border border-red-200 bg-white px-3 py-2 text-[14px]" />

        {error && <p className="mt-2 text-[13px] text-red-700">{error}</p>}

        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={!matches}
            onClick={() => setConfirming(true)}
            className="rounded-md bg-red-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
            {DELETE_ACTION}
          </button>
          <button type="button" className={TEXT_ACTION}
            onClick={() => { setTyped(''); setError('') }}>{CANCEL}</button>
        </div>
      </div>

      {confirming && (
        <Sheet title={DELETE_TITLE}
          lede={deleteWarning(companyName)}
          onClose={() => setConfirming(false)}>
          <div className="flex items-center gap-2">
            {/* The house rule: the confirming button never repeats the one that opened it, and the
                last thing a person reads names what is about to be destroyed. */}
            <button type="button" disabled={busy} onClick={destroy}
              className="rounded-md bg-red-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? 'Deleting…' : deleteConfirm(companyName)}
            </button>
            <button type="button" className={TEXT_ACTION} onClick={() => setConfirming(false)}>{CANCEL}</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
