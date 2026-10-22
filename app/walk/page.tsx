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
import SwitchAnswerControl from '@/components/SwitchAnswerControl'
import { postSwitchAnswer } from '@/lib/switchAnswer'
import {
  askableHere, nextQuestion, cardNumber, SKIP_WORD, ANSWER_FAILED,
  QUESTIONS_PER_DAY, type CardQuestion,
} from '@/lib/dashboardView'
import { WHAT_YOU_DO_LABEL, WHAT_YOU_DO_PLACEHOLDER } from '@/lib/accountView'
import {
  SKIP, FOUND_TITLE, foundLede, CONFIRM, COMPANY_NAME_LABEL, COMPANY_NAME_NOTE,
  MAIN_ADDRESS_LABEL, OTHER_PLACES_LABEL, ADD_AS_SITE, NOTE_LABEL,
  ASK_TITLE, ASK_LEDE, ADDRESS_LABEL, ADDRESS_PLACEHOLDER, ADDRESS_HINT, CONTINUE,
  readingLine, askNotice, firstScreen, stepsDone, planSaves, questionsDone,
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
  const [addressDraft, setAddressDraft] = useState('')
  const [others, setOthers] = useState<Array<{ place: ProposedPlace; add: boolean }>>([])
  const filled = useRef(false)

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

  /** One address through the route that geocodes it. Returns the sentence to show, or null. */
  async function putSite(body: Record<string, unknown>, method: 'POST' | 'PATCH'): Promise<string | null> {
    const res = await fetch('/api/sites', {
      method, headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) return (j?.error as string) ?? SAVE_FAILED
    // The geocoder's own sentence, shown exactly as the site drawer shows it: the site was saved,
    // and we could not work out where it is. `CLAUDE.md` §5.1 — never assert what we did not read.
    return j?.geocode && j.geocode.matched === false ? (j.geocode.message as string) : null
  }

  async function confirm() {
    if (busy) return
    setBusy(true)
    setNotice(null)
    const steps = planSaves({
      whatYouDo: whatDraft, naicsCode: pickedCode,
      mainAddress: addressDraft, mainSite, others,
    })
    const sentences: string[] = []
    for (const step of steps) {
      if (step.kind === 'company') {
        // The Company tab's one write, through the caller's own client (`app/account/page.tsx`
        // `writeCompany`). 082's column grant is what refuses a fourth column, not this line, and
        // the id is the one `companies_select` let us read — never one sent from anywhere.
        if (!companyId) { sentences.push(SAVE_FAILED); continue }
        const { error } = await supabase.from('companies')
          .update({ what_you_do: step.what_you_do, naics_code: step.naics_code })
          .eq('id', companyId)
        if (error) sentences.push(SAVE_FAILED)
      } else if (step.kind === 'main-site') {
        const s = await putSite({ id: step.id, name: step.name, address: step.address }, 'PATCH')
        if (s) sentences.push(s)
      } else if (step.kind === 'new-site') {
        const s = await putSite({ name: step.name, address: step.address }, 'POST')
        if (s) sentences.push(s)
      } else {
        await fetch('/api/website-read/accept', { method: 'POST', headers: await authHeaders() })
      }
    }
    setBusy(false)
    if (sentences.length) { setNotice(sentences.join(' ')); return }
    setScreen(2)
  }

  async function saveAddressOnly() {
    if (busy || !addressDraft.trim()) return
    setBusy(true)
    setNotice(null)
    const s = mainSite
      ? await putSite({ id: mainSite.id, name: mainSite.name, address: addressDraft.trim() }, 'PATCH')
      : SAVE_FAILED
    setBusy(false)
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
            <NaicsField
              value={whatDraft} onValue={setWhatDraft}
              picked={pickedCode} onPick={setPickedCode}
              showSuggestions={showSuggestions} onShowSuggestions={setShowSuggestions}
              busy={busy} showCode clearOnType={false}
              placeholder={WHAT_YOU_DO_PLACEHOLDER} label={WHAT_YOU_DO_LABEL} />
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
  const [asks, setAsks] = useState<CardQuestion[] | null>(null)
  const [answered, setAnswered] = useState(0)
  const [skips, setSkips] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState('')

  const load = useCallback(async () => {
    try {
      // No `entity_id`: that parameter is what makes the route answer about a SITE, and this
      // screen names none — `askableHere` drops any site-scoped row that still arrives.
      const res = await fetch('/api/switches/ask', { headers: await authHeaders() })
      if (!res.ok) { setAsks([]); return }
      const j = await res.json()
      setAsks(askableHere((j?.ready ?? []) as CardQuestion[]))
    } catch {
      setAsks([])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const current = useMemo(() => nextQuestion(asks ?? [], skips), [asks, skips])

  useEffect(() => {
    if (asks !== null && questionsDone(answered, Boolean(current))) onDone()
  }, [asks, answered, current, onDone])

  async function answer(value: string) {
    if (!current || busy) return
    setBusy(true)
    setFailed(false)
    const res = await postSwitchAnswer({ switch_id: current.switch_id, value, entity_id: null })
    if (!res.ok) { setFailed(true); setBusy(false); return }
    setDraft('')
    setAnswered((n) => n + 1)
    await load()
    setBusy(false)
  }

  if (asks === null || !current) return <Shell step={step}><p className="text-sm text-gray-400">…</p></Shell>

  return (
    <Shell step={step}>
      <p className="text-[12px] tabular-nums text-gray-400">{cardNumber(answered, QUESTIONS_PER_DAY)}</p>
      <p className="mt-1.5 font-serif text-[19px] leading-7 text-gray-900 text-balance">{current.question}</p>
      {current.help && <p className="mt-1 text-[13px] leading-5 text-gray-500">{current.help}</p>}

      <SwitchAnswerControl
        question={current} busy={busy}
        draft={draft} onDraft={setDraft}
        onAnswer={answer}
        trailing={
          <button type="button" disabled={busy}
            onClick={() => setSkips([...skips, current.switch_id])}
            className="ml-auto text-[13px] text-gray-500 underline transition-colors hover:text-gray-800 disabled:opacity-50">
            {SKIP_WORD}
          </button>
        } />

      {failed && <p className="mt-3 text-[13px] text-[var(--amber)]">{ANSWER_FAILED}</p>}

      <button type="button" disabled={busy} className={SKIP_LINK} onClick={onDone}>{SKIP}</button>
    </Shell>
  )
}
