'use client'
/**
 * THE CALENDAR'S OWN PART OF THE CHAT — boards 1 and 2, as they stand after the lift
 * (`docs/GAPS-PLAN.md` Part A step 2).
 *
 * *** EVERYTHING GENERAL WENT TO `components/AskScreen.tsx`. *** The thread, the bubble, the
 * composer in both states, the examples overlay, the streamed answer, the four endings, the action
 * row and the one-topic line were never about dates; they are one screen now, which every section
 * renders. What is left here is the one thing that IS the Calendar's:
 *
 *   · how an offer looks,
 *   · what happens when it is pressed,
 *   · what the line says afterwards,
 *   · and the grey line computed from the dates an answer cited.
 *
 * One click writes a date into the customer's calendar, so the words and the states stay here
 * where they can be read and tested, not spread through the markup.
 *
 * *** THE MARKUP IS UNCHANGED FROM BEFORE THE LIFT, CHARACTER FOR CHARACTER. *** The proof that the
 * Calendar did not change is partly a `git diff` of this file: the offer block below is the same
 * text it was, moved by nobody.
 */
import { authHeaders } from '@/lib/supabase'
import {
  offerWords, matchOffer, unconfirmedCited, unconfirmedNote,
  ON_YOUR_CALENDAR, ALREADY_ON_YOUR_CALENDAR, COULD_NOT_ADD, type CalendarRow,
} from '@/lib/calendarView'
import type { AddDateOffer } from '@/lib/ask/offers'
import type { Exchange } from '@/components/AskScreen'

/** The composer's hint, board 2. */
export const COMPOSER_HINT = 'Ask about a date, or what is due…'
/** The line under the action row, HR's, word for word — one topic per conversation. */
export const ONE_TOPIC_LINE =
  'One topic per conversation. When you are done, summarise it. Start a new conversation for the next topic.'
/** The grey line while nothing has arrived. A claim about what is being read, so it is the Calendar's. */
export const READING_LINE = 'Reading your calendar…'
export const LOOKING_IT_UP = (searches: number) => `Looking it up${searches > 1 ? ` (${searches} searches)` : ''}…`

/** What the Calendar's chat answers from, under the title (board 1). */
export const CALENDAR_LEDE =
  'Every date your documents set, in one place. Ask when something is due, and we say where the date came from.'
/** The Conversations tab's empty state. */
export const CALENDAR_EMPTY_CONVERSATIONS =
  'Ask a question and the answer is kept here, with the dates and documents it drew on.'
/** The button under the empty box on a first visit. */
export const CALENDAR_FIRST_VISIT_BUTTON = 'Ask'
/**
 * THE ATTACH SLOT'S LABEL AND ITS FALLBACK LINK.
 *
 * *** THEY LIVE HERE AND NOT ON THE BRIEF, AND THAT IS NOT A CHOICE. *** `lib/ask/brief.ts` has a
 * `words` object with exactly these two fields on it, but **no client component can read it**:
 * `lib/ask/calendarBrief.ts` imports `lib/ask/engine.ts`, which imports `lib/ai.ts`, which imports
 * the model SDK — and `tests/unit/clientImports.test.ts` fails the build for any component that
 * reaches it. So every section's screen words come from a file like this one, and the Brief's
 * `words` has had no reader since it was written. Named in the Part A step 3 report.
 */
export const CALENDAR_ATTACH_LABEL = 'Add a document'
/** Only drawn if a section has no uploader. The Calendar uploads in place since step 3. */
export const CALENDAR_ATTACH_HREF = '/documents?return=%2Fcalendar%3Ftab%3Dask'

/** The grey line the screen shows while an answer is on its way. */
export const calendarThinkingLine = (x: Exchange): string =>
  x.phase === 'searching' ? LOOKING_IT_UP(x.searches) : READING_LINE

/**
 * *** ONE CLICK PUTS THE DATE ON THE CALENDAR, CONFIRMED, WITH THIS PERSON'S NAME ON IT ***
 * (decision 17). It goes through `POST /api/calendar` with `source: 'rule'` — `proposeDate` is
 * the one writer, and it is what decides that a rule date a person pressed is confirmed.
 *
 * A failure says so and the line stays an offer: the date is not there, so the line must not
 * say it is (§5.1).
 */
async function accept(
  x: Exchange, i: number, offer: AddDateOffer,
  patch: (p: Partial<Exchange>) => void,
  onChanged: () => Promise<void> | void,
) {
  const mark = (v: { id: string | null; already: boolean; failed?: boolean }) =>
    patch({ added: { ...(x.added ?? {}), [i]: v } })
  mark({ id: null, already: false })
  try {
    const res = await fetch('/api/calendar', {
      method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        source: 'rule', title: offer.title, due_date: offer.due_on, recurs: offer.recurs,
        period: offer.period, entity_id: offer.site, source_url: offer.source_url, source_line: offer.source_line,
      }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok || !j?.data?.id) { mark({ id: null, already: false, failed: true }); return }
    mark({ id: String(j.data.id), already: j.outcome === 'existing' })
    await onChanged()
  } catch { mark({ id: null, already: false, failed: true }) }
}

/**
 * WHAT THE CALENDAR PUTS UNDER AN ANSWER — the shared screen's `afterAnswer` slot. The page builds
 * this with its live rows and its own refresh, and hands it in.
 */
export function calendarAfterAnswer(
  rows: CalendarRow[],
  onChanged: () => Promise<void> | void,
  busy = false,
) {
  return function CalendarAfterAnswer(x: Exchange, patch: (p: Partial<Exchange>) => void) {
    const unconfirmed = x.phase === 'done' ? unconfirmedCited(x.sources, rows) : []
    return (
      <>
        {/* THE OFFER, board 2: one underlined line, and what it says after it is pressed. */}
        {/*
            *** ONLY `add_date` IS DRAWN HERE, AND THE NARROWING IS NEW ON 3 NOVEMBER 2026. ***
            `Offer` became a union when Audits gained `run_audit` (decision 43). `calendarBrief`
            declares `offers: ['add_date']` and `parseOffers` already drops anything else, so this
            filter changes no behaviour today — it makes that a type guarantee rather than a fact
            about a list in another file, and the index below is the index in THIS list so a
            pressed card still marks itself.
        */}
        {x.phase === 'done' && x.offers.filter((o) => o.kind === 'add_date').map((o, i) => {
          const state = x.added?.[i]
          const already = matchOffer(rows, o)
          const landed = state?.id ?? already?.id ?? null
          if (landed) {
            return (
              <p key={i} className="mt-3 text-[15px]">
                <a href={`/calendar?tab=calendar&date=${landed}`}
                  className="text-[var(--green-ink)] underline underline-offset-2">
                  {state && !state.already ? ON_YOUR_CALENDAR : ALREADY_ON_YOUR_CALENDAR}
                </a>
                <span className="text-gray-500"> — {o.title}</span>
              </p>
            )
          }
          return (
            <p key={i} className="mt-3 text-[15px]">
              <button onClick={() => accept(x, i, o, patch, onChanged)} disabled={busy}
                className="text-left text-[var(--green-ink)] underline underline-offset-2 hover:no-underline disabled:text-gray-300">
                {offerWords(o)}
              </button>
              {state?.failed && <span className="mt-1 block text-[13px] text-amber-800">{COULD_NOT_ADD}</span>}
            </p>
          )
        })}
        {/* Board 2's grey line, computed from the dates the answer cited — never written by
            the model, so it cannot be wrong about which dates are confirmed. */}
        {unconfirmed.length > 0 && (
          <p className="mt-3 text-[13px] text-gray-400">{unconfirmedNote(unconfirmed)}</p>
        )}
      </>
    )
  }
}
