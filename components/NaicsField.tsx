'use client'

/**
 * "WHAT YOU DO", TYPED, WITH SUGGESTIONS UNDERNEATH — extracted at My Account step 14 so two
 * screens share one.
 *
 * *** WHY THIS FILE EXISTS. *** `app/account/page.tsx` had the only copy: a text box, up to five
 * NAICS titles under it, and "Keep what you typed" always last. The walk's first screen asks the
 * same question with the website read's answer already in the box (step 14, board 7), and a second
 * copy is what `components/SwitchAnswerControl.tsx` was extracted to prevent at step 6. This one
 * would have been worse than most, because the rule it carries is small and easy to get subtly
 * wrong: **typing again clears the picked code**. Decision 3 says the code is stored only when a
 * suggestion was taken, so a stale code left on edited words is a classification nobody chose,
 * written into `companies.naics_code` where it is a join key.
 *
 * It is a WIDENING of the Company tab, not a change to it: the markup, the class names, the order
 * of the list and the behaviour are moved character for character, and `tests/unit/accountView.test.ts`
 * still pins the tab's own words.
 *
 * *** WHAT IT DOES NOT OWN. *** Not the row, not the label, not Save, not Cancel, not the heading.
 * The Company tab draws it inside a bordered row with a "Change" link; the walk draws it as a
 * field on a card with one button at the bottom. A component that owned those would have to be
 * told which screen it was on.
 */
import { useMemo } from 'react'
import { suggestNaics, keepTypedLabel, type NaicsTitle } from '@/lib/naicsTitles'

/** Moved from `app/account/page.tsx:97`, character for character. */
export const NAICS_FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-900 ' +
  'focus:border-[var(--green)] focus:outline-none'

export function NaicsField({
  value, onValue, onPick, busy, placeholder, label, showSuggestions, onShowSuggestions,
  autoFocus = false,
}: {
  /** The words in the box. The caller holds them: they are what gets saved. */
  value: string
  onValue: (v: string) => void
  /** Called with a code when a suggestion is taken, and with null whenever the words change. */
  onPick: (code: string | null) => void
  busy: boolean
  placeholder: string
  label: string
  /** The list is hidden until the person types, and after they choose — the tab's own behaviour. */
  showSuggestions: boolean
  onShowSuggestions: (v: boolean) => void
  autoFocus?: boolean
  /**
   * *** TWO PROPS WERE REMOVED HERE AT STEP 15, AND NOTHING LOST THEM. ***
   *
   * Step 14 added `showCode` (draw the picked code with a `clear` beside it) and `clearOnType`
   * (keep a PROPOSED code when the words change), both for the walk and both off for the Company
   * tab. The owner's walk replaced that design: the sentence is a textarea and the category is a
   * line of words with its own `change` link, so the walk now opens this control as a SEARCH box
   * over its own state. Editing the sentence can no longer touch the code, because they are not
   * the same field — which is the thing `clearOnType` existed to work around.
   *
   * `picked` went with them: it was only ever read to draw that line, and a prop a component
   * ignores is a claim nothing checks (`CLAUDE.md` §9a). The caller holds the code — it is the
   * thing being saved — and hears about every change through `onPick`.
   */
}) {
  const suggestions: NaicsTitle[] = useMemo(
    () => (showSuggestions ? suggestNaics(value) : []), [value, showSuggestions])

  return (
    <>
      <input type="text"
        value={value} autoFocus={autoFocus} disabled={busy}
        onChange={(e) => {
          onValue(e.target.value)
          onPick(null)              // the words are theirs again
          onShowSuggestions(true)
        }}
        placeholder={placeholder}
        aria-label={label}
        className={NAICS_FIELD} />

      {/* Board 1's suggestion box: at most five, then "Keep what you typed". */}
      {suggestions.length > 0 && (
        <div data-suggestions className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {suggestions.map((s) => (
            <button key={s.code} type="button"
              onClick={() => {
                onValue(s.title)
                onPick(s.code)
                onShowSuggestions(false)
              }}
              className="block w-full px-3 py-2 text-left text-[13.5px] text-gray-800 hover:bg-gray-50">
              {s.title}
            </button>
          ))}
          <button type="button"
            onClick={() => { onPick(null); onShowSuggestions(false) }}
            className="block w-full border-t border-gray-100 px-3 py-2 text-left text-[13.5px] text-gray-500 hover:bg-gray-50">
            {keepTypedLabel(value)}
          </button>
        </div>
      )}
    </>
  )
}

export default NaicsField
