// GATE S1 (the Resend sending domain, docs/PUBLIC-PAGES-PLAN.md §5) — "everyone gets the month by email on the 1st" is the only line on this card that waits on anything. The box itself does not: Calendar was the shared chat's first customer (decision 28) and its Ask is live today. Walked at step 33.
// SAMPLE TEXT — the six dates are a sample company's and are replaced at step 12 by a real run. The THREE RULE ROWS were checked on 30 October 2026 and are not sample: the biennial update's month is the last digit of the USDOT number and its year the next-to-last digit, odd or even (https://www.fmcsa.dot.gov/registration/updating-your-registration) — 3841713 ends in 3, and 1 is odd, so March of an odd year; the Clearinghouse query on every driver is yearly, 49 CFR 382.701(b); an IFTA return is due the last day of the month after the quarter, so the first quarter falls on 30 April.
// *** THE PILL AND THE BUTTON ARE THE PRODUCT'S WORDS, AND BOTH DIFFER FROM THE BOARD. ***
//   · The board's "to confirm" is drawn here as "not confirmed", which is what the product prints
//     on a row for a date nobody has confirmed: `NOT_CONFIRMED` in `lib/calendarView.ts:191`, put
//     FIRST in the row's meta line at `:284` — and the comment above it (`:255`–`:272`) is about
//     this exact word being the one a truncated line must never lose. The tab is still called
//     "Dates to confirm" (`app/calendar/page.tsx:650`), which is why the header's "2 to confirm"
//     is left as the board wrote it.
//   · The board's "Send to my calendar" is the DRAWER's string, for one date
//     (`components/CalendarDateDrawer.tsx:227`). This card is the whole list, which is the tab's
//     job, and the tab says "Send to your calendar" (`app/calendar/page.tsx:773`). One word; the
//     step 21 report names it so it can be put back with one word.
//   · "confirmed" on the other four rows is NOT a product string, and there is no product string
//     to use: a confirmed row says nothing about its state, because `metaParts` pushes the state
//     only when there is something to say (`lib/calendarView.ts:280`–`:284`). The pill column
//     needs both halves or the rows read as ragged, so the board's word stands. Named in the
//     report.
/**
 * PANEL 5 — THE CALENDAR. Public pages step 21 (`docs/PUBLIC-PAGES-PLAN.md` §4 row 5, decisions
 * 5 and 10). The hero's third line points here (`#calendar`).
 *
 * *** THE PANEL'S ARGUMENT IS THE SOURCE LINE, NOT THE DATES. *** Every row says where its date
 * came from — a line of a document, in the document's own words, or the rule that sets it. A list
 * of dates is a calendar; a list of dates that can each be traced back to the sentence it was
 * read from is the product.
 *
 * And the two unconfirmed rows are shown, not hidden, with the word the product uses for them.
 * That is the §2 rule 2 point made in the one place a visitor can check it: a date nobody has
 * confirmed is still on the calendar, and it says so.
 *
 * White, because Documents before it is grey (decision 6).
 */
import Frame from './Frame'
import AskBox from './AskBox'
import { PRIMARY_SMALL } from '@/components/buttonStyles'

/**
 * EVERY WORD THIS PANEL SHOWS, IN ONE PLACE — see the SAMPLE TEXT note at the top. A trucking
 * company in Georgia: the industries rotate across the panels (decision 4), and a carrier's year
 * is the clearest case of dates that come from three places at once — a permit, a rule and a
 * driver's card.
 */
const WORDS = {
  eyebrow: 'Calendar',
  headline: 'The permit expires in March. You already know.',
  typed: 'What do we have due in the next 90 days?',
  attach: 'Add a document',
  under:
    'Every date it read in your documents, with the line it came from, and the ones the rules ' +
    'set. A date you have not confirmed yet still shows; nothing is hidden.',
  card: {
    title: 'Due in the next 90 days',
    meta: '6 dates · 2 to confirm · from 3 documents and 3 rules · sample company',
    send: 'Send to your calendar',
    apps: 'Google · Outlook',
    email: 'everyone gets the month by email on the 1st',
    confirmed: 'confirmed',
    open: 'not confirmed',
  },
  months: [
    {
      label: 'March 2027',
      rows: [
        {
          day: '31 Mar',
          title: 'Annual oversize permit, Georgia DOT',
          source: 'from GDOT-Annual-Permit-2026.pdf · “valid through 03/31/2027”',
          open: false,
        },
        {
          day: '31 Mar',
          title: 'Biennial update, USDOT 3841713',
          source: 'rule · fmcsa.dot.gov · a number ending in 13 files in March, odd years',
          open: false,
        },
        {
          day: '31 Mar',
          title: 'Apportioned plates expire, 6 trucks',
          source: 'from Cab-Cards-2026.pdf · “expiration 03/31/2027”',
          open: true,
        },
      ],
    },
    {
      label: 'April 2027',
      rows: [
        {
          day: '22 Apr',
          title: 'Clearinghouse query, every driver',
          source: 'rule · 49 CFR 382.701(b) · repeats yearly',
          open: true,
        },
        {
          day: '30 Apr',
          title: 'IFTA return, first quarter',
          source: 'rule · Georgia DOR · repeats quarterly',
          open: false,
        },
      ],
    },
    {
      label: 'May 2027',
      rows: [
        {
          day: '15 May',
          title: 'Medical certificate, driver M. Ortiz',
          source: 'from Medical-Card-Ortiz.pdf · “expires 05/15/2027”',
          open: false,
        },
      ],
    },
  ],
}

/** The side padding every part of the card carries. 24px on a laptop, 16px below. */
const SIDES = 'px-4 lg:px-6'

/**
 * ONE DATE. The 64px first column holds at every width, so the six days line up and every title
 * starts at one x (`DESIGN.md` §4, the rule the checklist's boxes and the gaps' numbers follow).
 * Below 1024 the pill drops under the words rather than squeezing the title into a third of the
 * row; the day column does not move.
 */
function Row({
  day,
  title,
  source,
  open,
}: {
  day: string
  title: string
  source: string
  /** Not confirmed: the amber wash and the product's word, instead of a hairline. */
  open: boolean
}) {
  return (
    <div
      className={`grid grid-cols-[64px_1fr] items-baseline gap-x-3 gap-y-1 lg:grid-cols-[64px_1fr_auto] ${
        open
          ? '-mx-[10px] rounded-lg bg-[var(--amber-wash)] px-[10px] py-[9px]'
          : 'border-b border-[var(--line)] py-[9px]'
      }`}
    >
      <span className="text-[14px] font-medium text-[var(--blue)] lg:col-start-1 lg:row-start-1">
        {day}
      </span>
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        <p className="text-[14px] text-[var(--ink)]">{title}</p>
        <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{source}</p>
      </div>
      <span
        className={`col-start-2 justify-self-start rounded-full px-2 py-[2px] text-[12px] font-medium lg:col-start-3 lg:row-start-1 ${
          open
            ? 'bg-[var(--amber-pill)] text-[var(--amber-ink)]'
            : 'bg-[var(--green-wash)] text-[var(--green-ink)]'
        }`}
      >
        {open ? WORDS.card.open : WORDS.card.confirmed}
      </span>
    </div>
  )
}

export default function CalendarPanel() {
  return (
    <Frame
      id="calendar"
      tone="white"
      card={
        <div className="lg:flex lg:justify-center">
          <div className="w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(20,23,26,.04),0_16px_40px_rgba(20,23,26,.10)] lg:w-[520px] lg:max-w-full lg:shrink-0">
            <div className={`${SIDES} border-b border-[var(--line)] pt-[18px] pb-[14px]`}>
              <p className="text-[18px] font-medium text-[var(--ink)]">{WORDS.card.title}</p>
              <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{WORDS.card.meta}</p>
            </div>

            <div className={SIDES}>
              {WORDS.months.map((m, i) => (
                <div key={m.label}>
                  <p
                    className={`mb-[2px] text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)] ${
                      i === 0 ? 'mt-[10px]' : 'mt-3'
                    }`}
                  >
                    {m.label}
                  </p>
                  {m.rows.map((r) => (
                    <Row key={`${r.day} ${r.title}`} {...r} />
                  ))}
                </div>
              ))}
            </div>

            {/* `pointer-events-none` on the button: PRIMARY_SMALL carries a hover colour, and a
                hover state on something that cannot be pressed is a promise the page cannot keep.
                The email line is the one on gate S1; below lg it takes a row of its own. */}
            <div className={`${SIDES} pb-5`}>
              <div className="mt-[14px] flex flex-wrap items-center gap-[18px] border-t border-[var(--line)] pt-3">
                <span className={`${PRIMARY_SMALL} pointer-events-none`}>{WORDS.card.send}</span>
                <span className="text-[13px] text-[var(--ink-soft)]">{WORDS.card.apps}</span>
                <span className="w-full text-[13px] text-[var(--ink-soft)] lg:ml-auto lg:w-auto">
                  {WORDS.card.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--green-ink)]">
          {WORDS.eyebrow}
        </p>
        <h2 className="max-w-[17ch] font-serif text-[32px] leading-[1.12] text-[var(--ink)] lg:text-[44px]">
          {WORDS.headline}
        </h2>
        <AskBox typed={WORDS.typed} attach={WORDS.attach} label="Ask" />
        <p className="max-w-[44ch] text-[15px] leading-[1.55] text-[var(--ink-soft)]">
          {WORDS.under}
        </p>
      </div>
    </Frame>
  )
}
