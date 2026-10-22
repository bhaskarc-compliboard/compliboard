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
 *   `what_you_do`, `naics_code`, `website_url` — straight onto `companies` through the CALLER's own
 *                    client, so RLS and the column grant are the boundary rather than a route's `if`
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
import { PRIMARY, TEXT_ACTION } from '@/components/buttonStyles'
import { createClient, authHeaders } from '@/lib/supabase'
import NaicsField from '@/components/NaicsField'
import {
  TITLE, LEDE, TABS, asTab, type AccountTab,
  COMPANY_HEADING, COMPANY_LABEL, NAME_NOTE,
  WHAT_YOU_DO_LABEL, WHAT_YOU_DO_PLACEHOLDER, WHAT_YOU_DO_EMPTY,
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
  CANCEL_HEADING, STOP_PAYING_LABEL, STOP_PAYING_NOTE, STOP_PAYING_ACTION, STOP_PAYING_DISABLED,
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
  what_you_do: string | null
  naics_code: string | null
  website_url: string | null
}

const ROW = 'flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4'
const ROW_LAST = 'flex items-start justify-between gap-4 px-5 py-4'
const KEY = 'w-[128px] shrink-0 text-[13px] text-gray-500'
const ACTION = 'shrink-0 text-[13px] text-[var(--green-ink)] hover:underline disabled:text-gray-300'
const FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-900 ' +
  'focus:border-[var(--green)] focus:outline-none'

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
        id: d.id, name: d.name ?? null, what_you_do: d.what_you_do ?? null,
        naics_code: d.naics_code ?? null, website_url: d.website_url ?? null,
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

  const mainSite = useMemo(() => sites.find((s) => s.is_primary) ?? null, [sites])

  // ── "What you do", with suggestions ────────────────────────────────────────────────────────────
  const [editWhat, setEditWhat] = useState(false)
  const [whatDraft, setWhatDraft] = useState('')
  /**
   * The code of a suggestion the person PICKED, and nothing else. Typing again clears it, because
   * the sentence is then no longer the standard's — decision 3: the code is stored only when a
   * suggestion was taken, and a stale code on edited words would be a classification nobody chose.
   */
  const [pickedCode, setPickedCode] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

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
  async function writeCompany(patch: Partial<Pick<CompanyRow, 'what_you_do' | 'naics_code' | 'website_url'>>) {
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

              {/* WHAT YOU DO, typed, with suggestions underneath. */}
              <div className={ROW}>
                <p className={KEY}>{WHAT_YOU_DO_LABEL}</p>
                <div className="min-w-0 flex-1">
                  {editWhat ? (
                    <>
                      {/* *** THE CONTROL MOVED TO `components/NaicsField.tsx` AT STEP 14. *** The
                          walk uses the same one — at step 15 as a SEARCH box beside its category
                          line — and a second copy of "typing clears the picked code" is the kind of
                          small rule a copy gets subtly wrong (decision 3). Nothing about this row
                          has changed since it moved. */}
                      <NaicsField
                        value={whatDraft} onValue={setWhatDraft}
                        onPick={setPickedCode}
                        showSuggestions={showSuggestions} onShowSuggestions={setShowSuggestions}
                        busy={busy} autoFocus
                        placeholder={WHAT_YOU_DO_PLACEHOLDER} label={WHAT_YOU_DO_LABEL} />

                      <div className="mt-2 flex items-center gap-3">
                        <button type="button" disabled={busy} className={PRIMARY}
                          onClick={async () => {
                            // Decision 3: the words are kept as typed, and the code is stored ONLY
                            // when a suggestion was picked. Nothing picked writes NULL, which is
                            // the normal case and is not a gap for anything to fill in later.
                            await writeCompany({
                              what_you_do: whatDraft.trim() || null,
                              naics_code: pickedCode,
                            })
                            setEditWhat(false)
                            setShowSuggestions(false)
                          }}>{SAVE}</button>
                        <button type="button" className={TEXT_ACTION}
                          onClick={() => { setEditWhat(false); setShowSuggestions(false) }}>{CANCEL}</button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[14px] text-gray-900">
                      {company.what_you_do
                        ? company.what_you_do
                        : <span className="text-gray-400">{WHAT_YOU_DO_EMPTY}</span>}
                    </p>
                  )}
                </div>
                {!editWhat && (
                  <button type="button" className={ACTION}
                    onClick={() => {
                      setWhatDraft(company.what_you_do ?? '')
                      // An existing code was picked once; it survives until the words change.
                      setPickedCode(company.naics_code ?? null)
                      setShowSuggestions(false)
                      setEditWhat(true)
                    }}>{CHANGE}</button>
                )}
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
        {tab === 'billing' && <BillingTab />}
        {tab === 'cancel' && <CancelTab companyName={company?.name ?? ''} />}
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

function BillingTab() {
  return (
    <>
      <DashboardSection heading="Your plan" />
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-[14px] font-medium text-gray-900">$199 a month</p>
        <p className="mt-1 text-[13px] leading-5 text-gray-600">
          Everything in CompliBoard, for everyone at your company. Cancel any time.
        </p>
        <p className="mt-4 text-[13px] text-gray-500">
          Card payment is not switched on yet. Nothing is charged, and nothing is owed.
        </p>
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
function CancelTab({ companyName }: { companyName: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [typed, setTyped] = useState('')
  const [confirming, setConfirming] = useState(false)
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
        {/* ---- Stop paying. Present, with its sentence, and inert until part C. ---- */}
        <div className={ROW}>
          <p className={KEY}>{STOP_PAYING_LABEL}</p>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-5 text-gray-600">{STOP_PAYING_NOTE}</p>
          </div>
          <div className="shrink-0 text-right">
            {/* Not a link, because there is nowhere for it to go yet. A control that did nothing
                would be the page promising a screen that does not exist. */}
            <p className="text-[13px] text-gray-300">{STOP_PAYING_ACTION}</p>
            <p className="mt-0.5 text-[12px] text-gray-400">{STOP_PAYING_DISABLED}</p>
          </div>
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
