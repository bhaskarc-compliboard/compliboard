'use client'

/**
 * /walk — THE THREE SCREENS AFTER SIGNUP. Board 7, My Account step 14, decision 10.
 *
 * What we found, three questions, done. **Every screen can be left**, and leaving writes nothing
 * further: "Skip for now" is on all three, including while the website is still being read.
 *
 * *** IT IS OUTSIDE `AppLayout`, AS BOARD 7 DRAWS IT. *** The board puts it in a `doorcard` on a
 * narrow board — the frame `/login`, `/join` and `/signup` use — not in the app shell. That is
 * decision 14 holding rather than being tested: the shell draws a sidebar, a company name and
 * counts, and a person halfway through telling us where they are should be looking at one thing.
 *
 * *** NOTHING IS WRITTEN WITHOUT A PRESS, AND NOTHING IS WRITTEN BY THIS FILE. ***
 *   · the company's own words go through the CALLER's own client, exactly as the Company tab does
 *     (`app/account/page.tsx` `writeCompany`) — 082's column grant is the boundary, not an `if`;
 *   · every address goes through `/api/sites`, which geocodes it and lets 083's trigger mirror the
 *     main one onto the company row. The walk never writes `entities`;
 *   · every answer goes through `/api/switches/answer`, the only writer of `company_switches`;
 *   · and `accepted_at` is stamped last, by `/api/website-read/accept`, because it is the record
 *     that the rest happened.
 *
 * *** AND WHAT IS SAVED IS WHAT IS IN THE FIELDS. *** The proposal fills them once, when the read
 * comes back. From that moment they are the person's. `planSaves` is built from the fields and
 * never from the proposal, so an edited sentence is what lands in `companies.what_you_do` — which
 * is the whole of "it proposes; the person confirms" (decision 9).
 *
 * Reopening this page later re-reads everything and re-saves nothing: the only writes are behind
 * the two buttons.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, authHeaders } from '@/lib/supabase'
import NaicsField from '@/components/NaicsField'
import { NAICS_TITLES } from '@/lib/naicsTitles'
import SwitchAnswerControl from '@/components/SwitchAnswerControl'
import { postSwitchAnswer } from '@/lib/switchAnswer'
import {
  askableHere, SKIP_WORD, ANSWER_FAILED, type CardQuestion,
} from '@/lib/dashboardView'
import { WHAT_YOU_DO_LABEL, WHAT_YOU_DO_PLACEHOLDER } from '@/lib/accountView'
import {
  SKIP, FOUND_TITLE, foundLede, CONFIRM, COMPANY_NAME_LABEL, COMPANY_NAME_NOTE,
  MAIN_ADDRESS_LABEL, OTHER_PLACES_LABEL, ADD_AS_SITE, NOTE_LABEL,
  ASK_TITLE, ASK_LEDE, ADDRESS_LABEL, ADDRESS_PLACEHOLDER, ADDRESS_HINT, CONTINUE,
  readingLine, askNotice, firstScreen, stepsDone, planSaves,
  walkQuestions, walkCounter, walkDone,
  categoryLine, categoryAction, sentenceRows, SENTENCE_COLS,
  CATEGORY_LABEL, CATEGORY_SEARCH_PLACEHOLDER,
  DONE_TITLE, DONE_LEDE, DONE_BUTTON, DASHBOARD_PATH, SAVE_FAILED,
  POLL_EVERY_MS, POLL_UP_TO_MS, WALK_STEPS,
  type ReadStatus, type ProposedPlace,
} from '@/lib/walkView'

const FIELD =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[14px] text-gray-900 ' +
  'focus:border-[var(--green)] focus:outline-none disabled:opacity-60'
const PRIMARY =
  'w-full rounded-xl bg-green-700 py-3 text-sm font-medium text-white transition-colors ' +
  'hover:bg-green-800 disabled:opacity-50'
const SKIP_LINK =
  'mt-4 block w-full text-center text-[13px] text-gray-500 underline transition-colors ' +
  'hover:text-gray-800 disabled:opacity-50'
const LABEL = 'mb-1 block text-xs font-medium text-gray-600'

export default function WalkPage() {
  return (
    <Suspense fallback={<Shell step={1}><p className="text-sm text-gray-400">Loading…</p></Shell>}>
      <Walk />
    </Suspense>
  )
}

/** Board 7's frame: the login card, with the three dots at the top. */
function Shell({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex gap-1.5" aria-label={`Step ${step} of ${WALK_STEPS}`}>
          {stepsDone(step).map((on, i) => (
            <span key={i}
              className={`h-1 flex-1 rounded-full ${on ? 'bg-green-700' : 'bg-gray-200'}`} />
          ))}
        </div>
        {children}
      </div>
    </main>
  )
}

interface Proposal {
  name: string | null
  what_you_do: string | null
  naics_code: string | null
  naics_title: string | null
  addresses: ProposedPlace[]
  notes: string | null
}

function Walk() {
  const router = useRouter()
  const supabase = createClient()

  const [screen, setScreen] = useState<1 | 2 | 3>(1)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // ── The read ───────────────────────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<ReadStatus | null>(null)
  const [host, setHost] = useState<string | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const startedAt = useRef<number>(Date.now())
  const [waited, setWaited] = useState(0)

  // ── The fields. Filled ONCE from the proposal; theirs from then on. ────────────────────────────
  const [whatDraft, setWhatDraft] = useState('')
  const [pickedCode, setPickedCode] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  /**
   * The picker's own box, and it is SEPARATE from the sentence on purpose. Typing in it searches
   * the standard list; the sentence is the person's words and is never touched by it. That also
   * retires the trap step 14 worked around: there is no longer any way for editing the sentence to
   * drop a proposed code, because the two are not the same field any more.
   */
  const [picking, setPicking] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [addressDraft, setAddressDraft] = useState('')
  const [others, setOthers] = useState<Array<{ place: ProposedPlace; add: boolean }>>([])
  const filled = useRef(false)
  /** What this mount has already written, so a second press does not write it twice. */
  const saved = useRef<Set<string>>(new Set())

  /** OUR title for whatever code is picked — `lib/naicsTitles.ts`, never the model's words. */
  const categoryTitle = useMemo(
    () => (pickedCode ? NAICS_TITLES.find((t) => t.code === pickedCode)?.title ?? null : null),
    [pickedCode])

  // ── The company and its main site, which signup made and which has no address yet ─────────────
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [mainSite, setMainSite] = useState<{ id: string; name: string } | null>(null)

  const loadSite = useCallback(async () => {
    // Read as the person. `companies_select` and `entities_select` are scoped by
    // `auth_company_id()`, so these two queries can only see this company at all — exactly how the
    // Company tab reads the same two rows.
    const { data: co } = await supabase.from('companies').select('id').maybeSingle()
    if (co) setCompanyId(co.id as string)
    const { data } = await supabase
      .from('entities').select('id, name, is_primary')
      .eq('entity_type', 'site').eq('is_primary', true).maybeSingle()
    if (data) setMainSite({ id: data.id as string, name: (data.name as string) ?? '' })
  }, [supabase])

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/website-read', { headers: await authHeaders() })
      const j = await res.json()
      setStatus((j?.status ?? 'none') as ReadStatus)
      setHost(j?.host ?? null)
      if (j?.proposal) setProposal(j.proposal as Proposal)
    } catch {
      // A read we cannot ask about is a read we do not have: the address screen asks instead.
      setStatus('none')
    }
    setWaited(Date.now() - startedAt.current)
  }, [])

  useEffect(() => { loadSite(); poll() }, [loadSite, poll])

  // Every two seconds while it is running, for forty, and then `firstScreen` calls it `ask`.
  useEffect(() => {
    if (status !== 'reading' || waited >= POLL_UP_TO_MS) return
    const t = setTimeout(poll, POLL_EVERY_MS)
    return () => clearTimeout(t)
  }, [status, waited, poll])

  // The proposal fills the boxes exactly once. A later poll must not overwrite a person's typing.
  useEffect(() => {
    if (filled.current || !proposal) return
    filled.current = true
    setWhatDraft(proposal.what_you_do ?? '')
    setPickedCode(proposal.naics_code ?? null)
    const [first, ...rest] = proposal.addresses ?? []
    if (first) setAddressDraft(first.address)
    setOthers(rest.map((place) => ({ place, add: true })))
  }, [proposal])

  const face = firstScreen(status ?? 'none', waited)
  const notice1 = askNotice(status ?? 'none', host, waited)

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // SAVING
  // ─────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * One address through the route that geocodes it.
   *
   * *** A REFUSAL AND A GEOCODER MISS ARE NOT THE SAME THING, AND CONFLATING THEM WEDGED THE
   * WALK. *** Found on the step 15 walk: Jost Chemical's second site is in POLAND, the Census
   * Bureau's geocoder is American, so it answered "no match" — and the walk, which treated any
   * sentence as a reason not to move on, left the person on screen 1 with "We could not find that
   * address" and no way forward but to untick a site that had in fact been saved.
   *
   *   · `failed`  — the write did not happen. The person must know, and must be able to try again.
   *   · `missed`  — the row IS there, with the address exactly as typed and no state or county.
   *                 That is the designed behaviour (decision 16) and not a failure.
   */
  async function putSite(body: Record<string, unknown>, method: 'POST' | 'PATCH'):
    Promise<{ failed?: string; missed?: string }> {
    const res = await fetch('/api/sites', {
      method, headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) return { failed: (j?.error as string) ?? SAVE_FAILED }
    // The geocoder's own sentence, word for word as the site drawer shows it (§5.1).
    return j?.geocode && j.geocode.matched === false ? { missed: j.geocode.message as string } : {}
  }

  async function confirm() {
    if (busy) return
    setBusy(true)
    setNotice(null)
    const steps = planSaves({
      whatYouDo: whatDraft, naicsCode: pickedCode,
      mainAddress: addressDraft, mainSite, others,
    })
    const stop: string[] = []
    for (const step of steps) {
      // *** A STEP THAT ALREADY WENT THROUGH IS NOT DONE TWICE. *** Staying on this screen invites
      // a second press, and a second press would POST the extra sites again — one company, two
      // Portland plants, and nobody would know where the duplicate came from.
      const key = step.kind === 'new-site' ? `new:${step.address}` : step.kind
      if (saved.current.has(key)) continue

      if (step.kind === 'company') {
        // The Company tab's one write, through the caller's own client (`app/account/page.tsx`
        // `writeCompany`). 082's column grant is what refuses a fourth column, not this line, and
        // the id is the one `companies_select` let us read — never one sent from anywhere.
        if (!companyId) { stop.push(SAVE_FAILED); continue }
        const { error } = await supabase.from('companies')
          .update({ what_you_do: step.what_you_do, naics_code: step.naics_code })
          .eq('id', companyId)
        if (error) { stop.push(SAVE_FAILED); continue }
      } else if (step.kind === 'main-site') {
        const r = await putSite({ id: step.id, name: step.name, address: step.address }, 'PATCH')
        if (r.failed) { stop.push(r.failed); continue }
        // *** THE MAIN SITE IS THE ONE ADDRESS THAT HOLDS THE WALK UP. *** It is what 083 mirrors
        // onto the company row and what `lib/jurisdiction.ts` resolves against, so an address we
        // could not place is worth a pause: the person can correct it and press again. Any other
        // site's miss is not — see below.
        if (r.missed) { stop.push(r.missed); continue }
      } else if (step.kind === 'new-site') {
        const r = await putSite({ name: step.name, address: step.address }, 'POST')
        if (r.failed) { stop.push(r.failed); continue }
        // A second site we could not place IS SAVED, with its address as typed. Holding the walk
        // up for it would mean a company with a plant in Poland could never finish, and the county
        // box in the site drawer is one tab away.
      } else {
        await fetch('/api/website-read/accept', { method: 'POST', headers: await authHeaders() })
      }
      saved.current.add(key)
    }
    setBusy(false)
    if (stop.length) { setNotice(stop.join(' ')); return }
    setScreen(2)
  }

  async function saveAddressOnly() {
    if (busy || !addressDraft.trim()) return
    setBusy(true)
    setNotice(null)
    const r = mainSite
      ? await putSite({ id: mainSite.id, name: mainSite.name, address: addressDraft.trim() }, 'PATCH')
      : { failed: SAVE_FAILED }
    setBusy(false)
    // The same rule as the card's: this IS the main site, so an address we could not place is
    // worth a pause rather than a shrug.
    const s = r.failed ?? r.missed
    if (s) { setNotice(s); return }
    setScreen(2)
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────

  if (screen === 2) return <Questions onDone={() => setScreen(3)} step={2} />
  if (screen === 3) {
    return (
      <Shell step={3}>
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">{DONE_TITLE}</h1>
        <p className="mb-6 text-sm leading-6 text-gray-500">{DONE_LEDE}</p>
        <button type="button" className={PRIMARY}
          onClick={() => { router.push(DASHBOARD_PATH); router.refresh() }}>{DONE_BUTTON}</button>
      </Shell>
    )
  }

  // ---- SCREEN 1 ----
  if (status === null || face === 'waiting') {
    return (
      <Shell step={1}>
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">{FOUND_TITLE}</h1>
        <p className="text-sm text-gray-500">{host ? readingLine(host) : '…'}</p>
        <button type="button" className={SKIP_LINK} onClick={() => setScreen(2)}>{SKIP}</button>
      </Shell>
    )
  }

  if (face === 'found' && proposal) {
    return (
      <Shell step={1}>
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">{FOUND_TITLE}</h1>
        <p className="mb-6 text-sm text-gray-500">{foundLede(host ?? '')}</p>

        <div className="space-y-4">
          {proposal.name && (
            <div>
              <p className={LABEL}>{COMPANY_NAME_LABEL}</p>
              <p className="text-[14px] text-gray-900">{proposal.name}</p>
              <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">{COMPANY_NAME_NOTE}</p>
            </div>
          )}

          <div>
            <label className={LABEL} htmlFor="walk-what">{WHAT_YOU_DO_LABEL}</label>
            {/* *** A TEXTAREA, BECAUSE THE SENTENCE IS THE THING BEING CHECKED. *** The website
                read's sentence is routinely 140 characters and a single-line box ran it off the
                edge, so the person was asked to confirm words they could not see. It grows from
                two lines to four; longer than that scrolls, which is rarer than the cap. */}
            <textarea id="walk-what" value={whatDraft} disabled={busy}
              rows={sentenceRows(whatDraft)} cols={SENTENCE_COLS}
              onChange={(e) => setWhatDraft(e.target.value)}
              placeholder={WHAT_YOU_DO_PLACEHOLDER} aria-label={WHAT_YOU_DO_LABEL}
              className={`${FIELD} resize-none leading-6`} />

            {/* The standard category, in words. The code is what gets SAVED; the title is the
                only part of it a person can agree or disagree with. */}
            {picking ? (
              <div className="mt-2">
                <NaicsField
                  value={categoryDraft} onValue={setCategoryDraft}
                  onPick={(code) => {
                    setPickedCode(code)
                    // Picking one closes the control and the line says what was chosen. Clearing
                    // (the list's "Keep what you typed") leaves it open to pick again.
                    if (code) setPicking(false)
                  }}
                  showSuggestions={showSuggestions} onShowSuggestions={setShowSuggestions}
                  busy={busy} autoFocus
                  placeholder={CATEGORY_SEARCH_PLACEHOLDER} label={CATEGORY_LABEL} />
              </div>
            ) : (
              <p className="mt-1.5 text-[12.5px] leading-5 text-gray-500">
                {categoryLine(pickedCode, categoryTitle)}
                <button type="button" disabled={busy}
                  onClick={() => {
                    // Seeded from the sentence, so the first list offered is about their business
                    // rather than empty. What is typed here is a SEARCH and is never saved.
                    setCategoryDraft(whatDraft.trim())
                    setShowSuggestions(true)
                    setPicking(true)
                  }}
                  className="ml-2 text-[var(--green-ink)] hover:underline disabled:text-gray-300">
                  {categoryAction(pickedCode)}
                </button>
              </p>
            )}
          </div>

          <div>
            <label className={LABEL} htmlFor="walk-address">{MAIN_ADDRESS_LABEL}</label>
            <input id="walk-address" type="text" value={addressDraft} disabled={busy}
              onChange={(e) => setAddressDraft(e.target.value)}
              placeholder={ADDRESS_PLACEHOLDER} aria-label={MAIN_ADDRESS_LABEL} className={FIELD} />
          </div>

          {others.length > 0 && (
            <div>
              <p className={LABEL}>{OTHER_PLACES_LABEL}</p>
              <div className="space-y-2">
                {others.map((o, i) => (
                  <label key={`${o.place.address}-${i}`}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                    <input type="checkbox" checked={o.add} disabled={busy}
                      aria-label={`${ADD_AS_SITE}: ${o.place.address}`}
                      onChange={(e) => setOthers(others.map((x, j) =>
                        j === i ? { ...x, add: e.target.checked } : x))}
                      className="mt-0.5 h-4 w-4 accent-green-700" />
                    <span className="min-w-0 text-[13.5px] text-gray-800">
                      {o.place.label && <b className="font-medium">{o.place.label}</b>}
                      {o.place.label && ' — '}
                      {o.place.address}
                      <span className="mt-0.5 block text-[12.5px] text-gray-500">{ADD_AS_SITE}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {proposal.notes && (
            <div>
              <p className={LABEL}>{NOTE_LABEL}</p>
              <p className="text-[13px] leading-5 text-gray-600">{proposal.notes}</p>
            </div>
          )}

          {notice && <p className="text-[13px] leading-5 text-[var(--amber)]">{notice}</p>}

          <button type="button" disabled={busy} className={PRIMARY} onClick={confirm}>
            {busy ? 'Saving…' : CONFIRM}
          </button>
        </div>
        <button type="button" disabled={busy} className={SKIP_LINK}
          onClick={() => setScreen(2)}>{SKIP}</button>
      </Shell>
    )
  }

  // ---- SCREEN 1, the address ----
  return (
    <Shell step={1}>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">{ASK_TITLE}</h1>
      <p className="mb-6 text-sm text-gray-500">{ASK_LEDE}</p>
      {notice1 && <p className="mb-4 text-[13px] leading-5 text-gray-700">{notice1}</p>}
      <div>
        <label className={LABEL} htmlFor="walk-main">{ADDRESS_LABEL}</label>
        <input id="walk-main" type="text" value={addressDraft} disabled={busy}
          onChange={(e) => setAddressDraft(e.target.value)}
          placeholder={ADDRESS_PLACEHOLDER} aria-label={ADDRESS_LABEL} className={FIELD} />
        <p className="mt-1 text-[12.5px] text-gray-400">{ADDRESS_HINT}</p>
      </div>
      {notice && <p className="mt-3 text-[13px] leading-5 text-[var(--amber)]">{notice}</p>}
      <button type="button" disabled={busy} className={`${PRIMARY} mt-5`} onClick={saveAddressOnly}>
        {busy ? 'Saving…' : CONTINUE}
      </button>
      <button type="button" disabled={busy} className={SKIP_LINK}
        onClick={() => setScreen(2)}>{SKIP}</button>
    </Shell>
  )
}

/**
 * SCREEN 2 — the Dashboard's question card, in the walk.
 *
 * The same list (`GET /api/switches/ask`), the same control
 * (`components/SwitchAnswerControl.tsx`), the same writer (`/api/switches/answer`), and the same
 * skip word. What differs is the frame and the counter, which is why the control does not own
 * either (step 6's note on that file).
 */
function Questions({ onDone, step }: { onDone: () => void; step: number }) {
  /**
   * *** THE THREE ARE TAKEN ONCE, WHEN THIS SCREEN OPENS. ***
   *
   * It used to re-fetch after every answer and end when three had been ANSWERED, which is the
   * Dashboard's rule and wrong here: "I don't know yet" writes nothing and so counted for nothing,
   * and the screen handed over the next of the twenty-odd company-scope switches, for ever. The
   * owner's walk reached a sixth question still labelled "3 of 3". `lib/walkView.ts` `walkQuestions`
   * carries the reasoning.
   *
   * So: one fetch, the first three, asked in order. Answering and skipping both use one of the
   * three. The counter is the position in this list. The Dashboard's card is untouched.
   */
  const [three, setThree] = useState<CardQuestion[] | null>(null)
  const [at, setAt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        // No `entity_id`: that parameter is what makes the route answer about a SITE, and this
        // screen names none — `askableHere` drops any site-scoped row that still arrives.
        const res = await fetch('/api/switches/ask', { headers: await authHeaders() })
        if (!res.ok) { if (live) setThree([]); return }
        const j = await res.json()
        if (live) setThree(walkQuestions(askableHere((j?.ready ?? []) as CardQuestion[])))
      } catch {
        if (live) setThree([])
      }
    })()
    return () => { live = false }
  }, [])

  const total = three?.length ?? 0
  const current = three && at < total ? three[at] : null

  useEffect(() => {
    if (three !== null && walkDone(at, total)) onDone()
  }, [three, at, total, onDone])

  async function answer(value: string) {
    if (!current || busy) return
    setBusy(true)
    setFailed(false)
    const res = await postSwitchAnswer({ switch_id: current.switch_id, value, entity_id: null })
    if (!res.ok) { setFailed(true); setBusy(false); return }
    setDraft('')
    setBusy(false)
    setAt((i) => i + 1)          // one of the three, used
  }

  if (three === null || !current) return <Shell step={step}><p className="text-sm text-gray-400">…</p></Shell>

  return (
    <Shell step={step}>
      <p className="text-[12px] tabular-nums text-gray-400">{walkCounter(at, total)}</p>
      <p className="mt-1.5 font-serif text-[19px] leading-7 text-gray-900 text-balance">{current.question}</p>
      {current.help && <p className="mt-1 text-[13px] leading-5 text-gray-500">{current.help}</p>}

      <SwitchAnswerControl
        question={current} busy={busy}
        draft={draft} onDraft={setDraft}
        onAnswer={answer}
        trailing={
          <button type="button" disabled={busy}
            onClick={() => { setDraft(''); setAt((i) => i + 1) }}
            className="ml-auto text-[13px] text-gray-500 underline transition-colors hover:text-gray-800 disabled:opacity-50">
            {SKIP_WORD}
          </button>
        } />

      {failed && <p className="mt-3 text-[13px] text-[var(--amber)]">{ANSWER_FAILED}</p>}

      <button type="button" disabled={busy} className={SKIP_LINK} onClick={onDone}>{SKIP}</button>
    </Shell>
  )
}
