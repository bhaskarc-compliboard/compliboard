'use client'

/**
 * THE CONTROL A SWITCH IS ANSWERED WITH — extracted at My Account step 6 so two pages share one.
 *
 * *** WHY THIS FILE EXISTS. *** `components/DashboardQuestions.tsx` had the only copy: a number box
 * with a Save beside it for a `number` switch, two words for a `boolean`, one button per option for
 * an `enum`, each posting the VALUE while showing the LABEL. My Account's Company tab asks the same
 * three questions (`ACCOUNT-PLAN.md` decision 5, board 1) and needed the same control. A second copy
 * is the thing `components/Tabs.tsx` and `components/Drawer.tsx` exist to prevent, and this one
 * would have been worse than most: the rule that an option button **shows `allowed_value_labels`
 * and posts `allowed_values`** is the kind of detail a copy gets subtly wrong, and getting it wrong
 * writes a value no requirement expression compares against — silently, into
 * `company_switches.value`.
 *
 * *** WHAT IT DELIBERATELY DOES NOT OWN. *** Not the question, not the help line, not the card, not
 * the heading, not the day's counter, not "I don't know yet". Those differ between the two pages,
 * and a component that owned them would have to be told which page it was on, which is how one
 * shared piece becomes two pieces in a trench coat. The Dashboard passes its skip button as
 * `trailing`; My Account passes Cancel.
 *
 * The words and the shapes are `DashboardQuestions`' own, moved rather than redrawn, so the
 * Dashboard looks exactly as it did on 20 October.
 */
import type React from 'react'
import { answerKind, optionButtons, YES_NO, type CardQuestion } from '@/lib/dashboardView'

/** Moved from `components/DashboardQuestions.tsx`, character for character. */
export const CHOICE =
  'rounded-lg border border-gray-200 bg-white px-4 py-[7px] text-[14px] font-medium text-gray-900 ' +
  'transition-colors hover:border-[var(--green)] hover:text-[var(--green-ink)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-900'

const SAVE =
  'rounded-md bg-[var(--green)] px-4 py-2 text-[14px] font-medium text-white transition-colors ' +
  'hover:bg-[var(--green-ink)] disabled:cursor-not-allowed disabled:opacity-50'

export function SwitchAnswerControl({ question, busy, draft, onDraft, onAnswer, trailing }: {
  question: CardQuestion
  /** Nothing may be pressed twice: a second click must send nothing. */
  busy: boolean
  /** The number box's text, held by the caller so it can be cleared when an answer lands. */
  draft: string
  onDraft: (v: string) => void
  /** Called with the VALUE to post, never with the label. */
  onAnswer: (value: string) => void
  /** The caller's own last control on the row: the Dashboard's skip, My Account's Cancel. */
  trailing?: React.ReactNode
}) {
  // `askableHere` has already dropped any type no control fits, so a null kind cannot reach a card
  // in either caller. It is still handled, because a silent blank row is the harder bug.
  const kind = answerKind(question.value_type)
  if (kind === null) return null

  if (kind === 'number') {
    return (
      <div className="mt-4 flex items-center gap-2.5">
        <input
          type="number" inputMode="numeric" value={draft} disabled={busy}
          onChange={(e) => onDraft(e.target.value)}
          aria-label={question.question}
          className="w-[120px] rounded-lg border border-gray-200 px-2.5 py-[7px] text-[14px] tabular-nums text-gray-900 disabled:opacity-50" />
        <button type="button" disabled={busy || draft.trim() === ''}
          onClick={() => onAnswer(draft.trim())} className={SAVE}>
          Save
        </button>
        {trailing}
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      {/* A yes-or-no switch gets the two words; a choice gets one button per option. The button
          SHOWS `allowed_value_labels[value]` and POSTS the value, because the value is a key a
          requirement's expression compares against and the route refuses anything else
          (`app/api/switches/answer/route.ts:69`). */}
      {(kind === 'yes_no' ? YES_NO : optionButtons(question)).map((opt) => (
        <button key={opt.value} type="button" disabled={busy}
          onClick={() => onAnswer(opt.value)} className={CHOICE}>
          {opt.label}
        </button>
      ))}
      {trailing}
    </div>
  )
}

export default SwitchAnswerControl
