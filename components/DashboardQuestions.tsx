'use client'

/**
 * THE THREE QUESTIONS — board 2, Dashboard step 7 (`docs/DASHBOARD-PLAN.md` decisions 8, 9, 10).
 *
 * One card, one question at a time, between the four numbers and Upcoming, because the one thing
 * the product wants from a person belongs above the fold.
 *
 * *** THE WORDS ARE THE SWITCH'S, NOT THIS FILE'S. *** The question is `switches.question_plain`,
 * handed over by `GET /api/switches/ask` through `askableSwitches()`
 * (`lib/switchAsk.ts:138`). So the Company information page and this card ask in the same words,
 * and changing a question is a data change.
 *
 * *** AND SO IS THE GREY LINE UNDER IT — `switches.help_plain`, migration 081. ***
 * Board 2 draws a sentence under each question saying what counts ("Anyone on payroll, full or
 * part time. Owners who only draw a share do not count."). Step 7 could not draw it: there was no
 * such column, and the nearest thing — `notes` — is OUR working note ("NOT IN §2.4 AND NEEDED BY
 * 9 REQUIREMENTS"), which on a customer's Dashboard would be the raw-industry-slug mistake step 5
 * removed. Writing the sentence here instead would be this component inventing regulatory
 * guidance, which `CLAUDE.md` §3.3 forbids. So it lives in the library beside the question, and
 * this draws it when it is there and nothing when it is null — which is every site-scope switch
 * today, and any question nobody has written a line for.
 *
 * *** NOTHING SAYS WHAT THE ANSWER DID — decision 8. *** `/api/switches/answer` returns
 * `unblocked` and an obligation delta and this card ignores both. "That settled 4 requirements" is
 * a claim about a resolution nothing on this page shows, and the owner's decision is that the
 * Dashboard asks and moves on.
 */
import { useState, useEffect, useCallback } from 'react'
import DashboardSection from './DashboardSection'
import { postSwitchAnswer } from '@/lib/switchAnswer'
import SwitchAnswerControl from './SwitchAnswerControl'
import {
  askableHere, nextQuestion, cardNumber, questionState,
  localMidnightIso, skipKey, readSkips, writeSkip,
  QUESTIONS_HEADING, QUESTIONS_NOTE, QUESTIONS_DONE, QUESTIONS_DONE_SUB,
  ANSWER_FAILED, SKIP_WORD, QUESTIONS_PER_DAY,
  type CardQuestion,
} from '@/lib/dashboardView'
import type { SupabaseClient } from '@supabase/supabase-js'

// *** THE CONTROL MOVED TO `components/SwitchAnswerControl.tsx` AT MY ACCOUNT STEP 6. *** The number
// box, the two words and the option buttons are now one piece, because the Company tab asks these
// same three questions and a second copy would eventually post a label where a value belongs. The
// skip stays here: it is the Dashboard's own, and My Account shows Cancel in its place.
const SKIP =
  'ml-auto text-[13px] text-gray-500 underline transition-colors hover:text-gray-800 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export function DashboardQuestions({ db, companyId }: { db: SupabaseClient; companyId: string }) {
  const [asks, setAsks] = useState<CardQuestion[] | null>(null)
  const [answeredToday, setAnsweredToday] = useState(0)
  const [skips, setSkips] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [numberDraft, setNumberDraft] = useState('')

  /**
   * *** "THREE TODAY" IS COUNTED FROM WHAT WAS WRITTEN, NOT FROM A COLUMN — open question 1,
   * settled at step 4. *** `switch_determinations` is append-only and `source = 'user_set'` is
   * exactly what a person's answer writes (`lib/switchDetermination.ts:242`), so the count is a
   * query and there is nothing to keep in step with anything.
   *
   * The day starts at the BROWSER'S midnight, sent as an absolute instant. A UTC day would end an
   * Oregon person's quota at four in the afternoon; see `localMidnightIso`.
   *
   * Read as the person: `switch_determinations_select` is SELECT to `authenticated`
   * `using (company_id = auth_company_id())`, so this names no company for scoping — the `eq` is
   * belt and braces on a table whose rows the person may also insert.
   */
  const countToday = useCallback(async () => {
    const { count, error } = await db
      .from('switch_determinations')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('source', 'user_set')
      .gte('determined_at', localMidnightIso())
    // A count that could not be read is not zero. Leaving it where it was means the card does not
    // suddenly hand out three more questions because one query failed.
    if (!error && typeof count === 'number') setAnsweredToday(count)
  }, [db, companyId])

  const loadAsks = useCallback(async () => {
    try {
      const { authHeaders } = await import('@/lib/supabase')
      // No `entity_id`: that parameter is what makes the route answer about a SITE, and this page
      // names no site (decision 8). `askableHere` drops any site-scoped row that still arrives.
      const res = await fetch('/api/switches/ask', { headers: await authHeaders() })
      if (!res.ok) { setAsks([]); return }
      const j = await res.json()
      setAsks(askableHere((j?.ready ?? []) as CardQuestion[]))
    } catch {
      // The block simply does not appear. A dashboard that cannot work out what to ask has
      // nothing honest to put here, and an error about our own machinery is not the person's.
      setAsks([])
    }
  }, [])

  useEffect(() => {
    setSkips(readSkips(typeof window === 'undefined' ? null : window.localStorage, skipKey()))
    loadAsks()
    countToday()
  }, [loadAsks, countToday])

  const state = questionState(asks ?? [], answeredToday, skips)
  const current = nextQuestion(asks ?? [], skips)

  async function answer(value: string) {
    if (!current || busy) return   // a second click sends nothing
    setBusy(true)
    setFailed(false)
    const res = await postSwitchAnswer({ switch_id: current.switch_id, value, entity_id: null })
    if (!res.ok) {
      // The card stays on the same question and the counter does not move: nothing was written,
      // so nothing may look as though it was.
      setFailed(true)
      setBusy(false)
      return
    }
    // An answered switch leaves `askables` on its own, because `askableSwitches` drops anything
    // established. Re-reading both is one round trip each and keeps the count honest even if a
    // colleague answered something in another tab.
    setNumberDraft('')
    await Promise.all([loadAsks(), countToday()])
    setBusy(false)
  }

  function skip() {
    if (!current || busy) return
    // Writes NOTHING to the database. "I don't know yet" is not a fact about the company, and the
    // switch stays unanswered so a document or a later question can still establish it.
    setFailed(false)
    setSkips(writeSkip(typeof window === 'undefined' ? null : window.localStorage, skipKey(), current.switch_id))
  }

  // Nothing at all — not a heading, not an empty card. This company has no company-scope question
  // left, and there is nothing to say about that.
  if (asks === null || state === 'hidden') return null

  return (
    <div className="mt-2">
      <DashboardSection heading={QUESTIONS_HEADING} quiet={QUESTIONS_NOTE} />
      {state === 'quiet' || !current ? (
        // Board 2, state d: a dashed panel, so it reads as a note rather than as a thing to press.
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-5">
          <p className="text-[16px] font-medium leading-6 text-gray-900">{QUESTIONS_DONE}</p>
          <p className="mt-1 text-[13px] leading-5 text-gray-500">{QUESTIONS_DONE_SUB}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white px-6 pb-[18px] pt-5">
          <p className="text-[12px] tabular-nums text-gray-400">
            {cardNumber(answeredToday, QUESTIONS_PER_DAY)}
          </p>
          <p className="mt-1.5 font-serif text-[19px] leading-7 text-gray-900 text-balance">
            {current.question}
          </p>
          {current.help && (
            <p className="mt-1 text-[13px] leading-5 text-gray-500">{current.help}</p>
          )}

          <SwitchAnswerControl
            question={current} busy={busy}
            draft={numberDraft} onDraft={setNumberDraft}
            onAnswer={answer}
            trailing={
              <button type="button" disabled={busy} onClick={skip} className={SKIP}>{SKIP_WORD}</button>
            } />

          {failed && (
            <p className="mt-3 text-[13px] text-[var(--amber)]">{ANSWER_FAILED}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default DashboardQuestions
