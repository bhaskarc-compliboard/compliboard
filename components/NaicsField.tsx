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
  value, onValue, onPick, picked, busy, placeholder, label, showSuggestions, onShowSuggestions,
  autoFocus = false, showCode = false, clearOnType = true,
}: {
  /** The words in the box. The caller holds them: they are what gets saved. */
  value: string
  onValue: (v: string) => void
  /** Called with a code when a suggestion is taken, and with null whenever the words change. */
  onPick: (code: string | null) => void
  picked: string | null
  busy: boolean
  placeholder: string
  label: string
  /** The list is hidden until the person types, and after they choose — the tab's own behaviour. */
  showSuggestions: boolean
  onShowSuggestions: (v: boolean) => void
  autoFocus?: boolean
  /**
   * Draw the code that is about to be stored, with a way to drop it. OFF by default, so the
   * Company tab renders exactly what it rendered before this file existed.
   *
   * The walk turns it ON, and needs to: its box arrives PREFILLED from the website read with a
   * code already picked, and the suggestion list — which carries "Keep what you typed", the
   * normal way to drop a code — is hidden until somebody types. Without this line a person who
   * agrees with the sentence but not with the classification has no way to say so.
   */
  showCode?: boolean
  /**
   * *** WHETHER TYPING DROPS THE CODE, AND THE TWO SCREENS WANT DIFFERENT ANSWERS. ***
   *
   * ON (the default, the Company tab): the code is there because the person PICKED a suggestion,
   * so it is a claim about those exact words. Editing them makes it a classification nobody chose
   * — decision 3 — and it goes.
   *
   * OFF (the walk): the code did not come from a suggestion, it came from the website read, and
   * it is a PROPOSAL about the business rather than about the sentence. Changing one word of
   * "We manufacture high purity specialty chemicals" should not silently drop a code the person
   * was shown and agreed with. It is only off where `showCode` is on, so the code is visible with
   * a `clear` beside it the whole time: nothing is kept that the person cannot see and remove.
   *
   * The risk this takes, named: somebody could rewrite the sentence completely and leave a code
   * that no longer fits. `companies.naics_code` is read by nothing today — `grep -rn naics_code
   * app lib components prompts scripts` finds only the writers and this control — so the cost is a
   * wrong label on a card they confirmed, not a wrong answer downstream. If something ever reads
   * it, this is the line to come back to.
   */
  clearOnType?: boolean
}) {
  const suggestions: NaicsTitle[] = useMemo(
    () => (showSuggestions ? suggestNaics(value) : []), [value, showSuggestions])

  return (
    <>
      <input type="text"
        value={value} autoFocus={autoFocus} disabled={busy}
        onChange={(e) => {
          onValue(e.target.value)
          if (clearOnType) onPick(null)       // the words are theirs again
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
      {/* What is actually going to be stored as the code, when one was taken. */}
      {showCode && picked && (
        <p className="mt-1 text-[12.5px] text-gray-500">
          NAICS {picked}
          <button type="button" disabled={busy}
            onClick={() => onPick(null)}
            className="ml-2 text-[var(--green-ink)] hover:underline disabled:text-gray-300">clear</button>
        </p>
      )}
    </>
  )
}

export default NaicsField
