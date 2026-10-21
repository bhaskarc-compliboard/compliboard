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
import { suggestNaics, keepTypedLabel, type NaicsTitle } from '@/lib/naicsTitles'
import {
  TITLE, LEDE, TABS, asTab, type AccountTab,
  COMPANY_HEADING, COMPANY_LABEL, NAME_NOTE,
  WHAT_YOU_DO_LABEL, WHAT_YOU_DO_PLACEHOLDER, WHAT_YOU_DO_EMPTY,
  WEBSITE_LABEL, WEBSITE_EMPTY, MAIN_SITE_LABEL, EDIT_ADDRESS,
  CHANGE, SAVE, CANCEL,
  SITES_HEADING, ADD_SITE, MAIN_PILL, EDIT, SITES_NOTE,
  siteSubLine, countyLine, addedLine, type SiteRow,
} from '@/lib/accountView'

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
  const suggestions: NaicsTitle[] = useMemo(
    () => (showSuggestions ? suggestNaics(whatDraft) : []), [whatDraft, showSuggestions])

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
                      <input type="text"
                        value={whatDraft} autoFocus disabled={busy}
                        onChange={(e) => {
                          setWhatDraft(e.target.value)
                          setPickedCode(null)   // the words are theirs again
                          setShowSuggestions(true)
                        }}
                        placeholder={WHAT_YOU_DO_PLACEHOLDER}
                        aria-label={WHAT_YOU_DO_LABEL}
                        className={FIELD} />

                      {/* Board 1's suggestion box: at most five, then "Keep what you typed". */}
                      {suggestions.length > 0 && (
                        <div data-suggestions className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
                          {suggestions.map((s) => (
                            <button key={s.code} type="button"
                              onClick={() => {
                                setWhatDraft(s.title)
                                setPickedCode(s.code)
                                setShowSuggestions(false)
                              }}
                              className="block w-full px-3 py-2 text-left text-[13.5px] text-gray-800 hover:bg-gray-50">
                              {s.title}
                            </button>
                          ))}
                          <button type="button"
                            onClick={() => { setPickedCode(null); setShowSuggestions(false) }}
                            className="block w-full border-t border-gray-100 px-3 py-2 text-left text-[13.5px] text-gray-500 hover:bg-gray-50">
                            {keepTypedLabel(whatDraft)}
                          </button>
                        </div>
                      )}

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
   THE OTHER THREE TABS — today's content, under the new names, until steps 8, 9 and part C.
   Moved, not rewritten: the fields, the words and the rules are what `/account` shipped with. The
   boards for them (3, 4 and 5) arrive with their own steps.
   ================================================================================================= */

function SignInTab() {
  const supabase = createClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function change() {
    setError('')
    setDone(false)
    if (!newPassword || !confirmPassword) { setError('Please fill in all fields'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setBusy(true)
    try {
      const { error: e } = await supabase.auth.updateUser({ password: newPassword })
      if (e) throw e
      setDone(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DashboardSection heading="You" />
      <div className="max-w-[420px] rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-[14px] font-medium text-gray-900">Change your password</p>
        <div className="mt-3 space-y-3">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password" aria-label="New password" className={FIELD} />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="New password again" aria-label="New password again" className={FIELD} />
          {error && <p className="text-[13px] text-[var(--amber)]">{error}</p>}
          {done && <p className="text-[13px] text-[var(--green-ink)]">Your password has been changed.</p>}
          <button type="button" disabled={busy} onClick={change} className={PRIMARY}>
            {busy ? 'Changing…' : 'Save the new password'}
          </button>
        </div>
        {/* Step 8 asks for the current password and moves the email change here. Not claimed yet. */}
      </div>
    </>
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

function CancelTab({ companyName }: { companyName: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
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
        throw new Error(j.error || 'Could not delete your account')
      }
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account')
      setBusy(false)
    }
  }

  return (
    <>
      <DashboardSection heading="Cancel and delete" />
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-[14px] font-medium text-gray-900">Take your records first</p>
          <p className="mt-1 text-[13px] leading-5 text-gray-600">
            Download everything we hold on your company as a single file. Your uploaded files are
            not included — save those from Company Documents separately, because deleting the
            account deletes them too.
          </p>
          <button type="button" onClick={download} disabled={downloading}
            className={`mt-3 ${PRIMARY}`}>
            {downloading ? 'Preparing your file…' : 'Download my data'}
          </button>
          {downloadError && <p className="mt-2 text-[13px] text-[var(--amber)]">{downloadError}</p>}
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-[14px] font-medium text-red-800">
            Deleting the company is permanent and cannot be undone
          </p>
          <p className="mt-1 text-[13px] leading-5 text-red-700">
            There is no way to restore it afterwards and we do not keep a copy. Everything below is
            destroyed for <span className="font-medium">everyone</span> at your company, not only
            for you:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-red-700">
            <li>Every uploaded file, and the folders holding them</li>
            <li>Every document review, audit, and HR handbook audit</li>
            <li>Every checklist and checklist item</li>
            <li>Every calendar date and reminder</li>
            <li>Your requirements and the evidence linked to them</li>
            <li>Your company&apos;s facts, its sites and its saved audit templates</li>
            <li>Every login on this company account, including yours</li>
          </ul>

          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)}
              className="mt-4 rounded-md border border-red-300 px-4 py-2 text-[14px] font-medium text-red-700 hover:bg-red-100">
              Delete the company
            </button>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-[13px] text-red-800">
                To confirm, type your company name exactly as we hold it:{' '}
                <span className="font-medium">{companyName}</span>
              </p>
              <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)}
                aria-label="Type your company name to confirm"
                placeholder="Type your company name to confirm"
                className="w-full max-w-[420px] rounded-lg border border-red-200 px-3 py-2 text-[14px]" />
              {error && <p className="text-[13px] text-red-700">{error}</p>}
              <div className="flex items-center gap-2">
                <button type="button" onClick={destroy}
                  disabled={busy || !companyName || typed.trim() !== companyName}
                  className="rounded-md bg-red-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? 'Deleting…' : 'Permanently delete the company'}
                </button>
                <button type="button" onClick={() => { setConfirming(false); setTyped(''); setError('') }}
                  className={TEXT_ACTION}>Keep my account</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
