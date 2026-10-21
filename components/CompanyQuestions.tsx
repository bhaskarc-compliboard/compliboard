'use client'

/**
 * "THREE THINGS WE NEED TO KNOW" — My Account step 6, board 1 (`ACCOUNT-PLAN.md` decision 5).
 *
 * The same three switches the Dashboard asks (`components/DashboardQuestions.tsx`), shown as three
 * rows with their current answers and a Change on each. The difference between the two screens is
 * the whole reason both exist: the Dashboard asks what is NOT yet answered, one at a time, and this
 * shows all three WHETHER OR NOT they are answered, because board 1 is a glance at the company's
 * own facts.
 *
 * *** SO IT DOES NOT CALL `/api/switches/ask`, AND THAT IS NOT AN OVERSIGHT. *** That route returns
 * what can usefully be asked next, which by design excludes anything already established — exactly
 * the three rows this block must draw with their answers in them. It reads `switches` for the words
 * and `company_switches` for the answers, both as the person, and writes through the one writer
 * (`lib/switchAnswer.ts` → `/api/switches/answer`), which is what recomputes obligations.
 *
 * *** THE WORDS ARE THE LIBRARY'S. *** The question is `switches.question_plain` and the grey line
 * under it is `switches.help_plain` (migration 081). Nothing in this file writes a question or a
 * sentence about what counts — writing regulatory guidance here is what `CLAUDE.md` §3.3 forbids,
 * and it is why the Dashboard's card carries the same rule in the same words.
 *
 * The control is `components/SwitchAnswerControl.tsx`, shared with the Dashboard so that "show the
 * label, post the value" has one implementation.
 */
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import DashboardSection from './DashboardSection'
import SwitchAnswerControl from './SwitchAnswerControl'
import { TEXT_ACTION } from './buttonStyles'
import { postSwitchAnswer } from '@/lib/switchAnswer'
import { ANSWER_FAILED, type CardQuestion } from '@/lib/dashboardView'
import {
  QUESTIONS_HEADING, QUESTIONS_NOTE, NOT_ANSWERED, THREE_SWITCHES, CHANGE, CANCEL, answerWord,
} from '@/lib/accountView'

interface Row {
  id: string
  question: string
  help: string | null
  valueType: string
  allowedValues: string[]
  labels: Record<string, string> | null
  /** The stored value, or null when nothing has answered it. */
  value: string | null
}

const ACTION = 'shrink-0 text-[13px] text-[var(--green-ink)] hover:underline disabled:text-gray-300'

export function CompanyQuestions({ db, companyId, onAnswered }: {
  db: SupabaseClient
  companyId: string
  /** The page re-reads itself: an answer can change what a later question depends on. */
  onAnswered?: () => void
}) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const [sw, cs] = await Promise.all([
      db.from('switches')
        .select('id, value_type, allowed_values, allowed_value_labels, question_plain, help_plain')
        .in('id', THREE_SWITCHES as unknown as string[]),
      // Company scope: `entity_id is null`. NEVER the primary site's id — a company-wide answer to
      // a per-site question is wrong at every site but one, confidently (`DECISIONS.md` §20).
      db.from('company_switches')
        .select('switch_id, value, state')
        .eq('company_id', companyId).is('entity_id', null),
    ])
    if (sw.error || !sw.data) { setRows([]); return }
    const answerOf = new Map<string, string>()
    for (const r of cs.data ?? []) {
      if (r.state === 'known' && typeof r.value === 'string') answerOf.set(r.switch_id, r.value)
    }
    // *** THE ORDER IS THE BOARD'S, NOT THE QUERY'S. *** `in()` returns rows in whatever order
    // Postgres gives them; board 1 reads has employees, how many, what the business does.
    const byId = new Map(sw.data.map((s) => [s.id, s]))
    const built: Row[] = []
    for (const id of THREE_SWITCHES) {
      const s = byId.get(id)
      // A switch that is not in the library is left OUT rather than drawn with invented words.
      if (!s || !s.question_plain) continue
      built.push({
        id,
        question: s.question_plain,
        help: s.help_plain ?? null,
        valueType: String(s.value_type),
        allowedValues: (s.allowed_values ?? []) as string[],
        labels: (s.allowed_value_labels ?? null) as Record<string, string> | null,
        value: answerOf.get(id) ?? null,
      })
    }
    setRows(built)
  }, [db, companyId])

  useEffect(() => { load() }, [load])

  async function answer(switchId: string, value: string) {
    if (busy) return
    setBusy(true)
    setFailed(false)
    // `entity_id: null` — these three are company-scoped, and the route refuses a site-scoped
    // switch without a site anyway.
    const res = await postSwitchAnswer({ switch_id: switchId, value, entity_id: null })
    if (!res.ok) { setFailed(true); setBusy(false); return }
    setEditing(null)
    setDraft('')
    await load()
    onAnswered?.()
    setBusy(false)
  }

  // Nothing is drawn until the library has answered. An empty heading over three blank rows would
  // be a section claiming three facts exist.
  if (rows === null || rows.length === 0) return null

  return (
    <>
      <DashboardSection heading={QUESTIONS_HEADING} quiet={QUESTIONS_NOTE} />
      <div className="rounded-xl border border-gray-200 bg-white">
        {rows.map((r, i) => {
          const q: CardQuestion = {
            switch_id: r.id, question: r.question, help: r.help, scope: 'company',
            value_type: r.valueType, allowed_values: r.allowedValues, allowed_value_labels: r.labels,
          }
          return (
            <div key={r.id} className={`px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[14px] leading-5 text-gray-900">{r.question}</p>
                  <p className="mt-0.5 text-[15px] font-medium text-gray-900">
                    {r.value === null
                      ? <span className="font-normal text-gray-400">{NOT_ANSWERED}</span>
                      : answerWord(r.value, r.valueType, r.labels)}
                  </p>
                  {/* The library's own sentence, and nothing when there is none. */}
                  {r.help && <p className="mt-1 text-[12.5px] leading-5 text-gray-500">{r.help}</p>}
                </div>
                {editing !== r.id && (
                  <button type="button" disabled={busy} className={ACTION}
                    onClick={() => { setEditing(r.id); setDraft(r.value ?? ''); setFailed(false) }}>
                    {CHANGE}
                  </button>
                )}
              </div>

              {editing === r.id && (
                <SwitchAnswerControl
                  question={q} busy={busy} draft={draft} onDraft={setDraft}
                  onAnswer={(v) => answer(r.id, v)}
                  trailing={
                    <button type="button" disabled={busy} className={`ml-auto ${TEXT_ACTION}`}
                      onClick={() => { setEditing(null); setDraft('') }}>{CANCEL}</button>
                  } />
              )}

              {failed && editing === r.id && (
                <p className="mt-3 text-[13px] text-[var(--amber)]">{ANSWER_FAILED}</p>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default CompanyQuestions
