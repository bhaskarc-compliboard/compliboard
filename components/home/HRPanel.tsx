// SAMPLE TEXT — the handbook sentence, the company, the section and the page number are in the product's voice and are replaced at step 12 by a real run. The STATE FACT is not sample: KRS 337.055, read at https://law.justia.com/codes/kentucky/chapter-337/section-337-055 on 30 October 2026 — wages are due not later than the next normal pay period after dismissal or leaving, OR fourteen (14) days after it, WHICHEVER LAST OCCURS.
// AND THE REASONING MUST NOT BE SIMPLIFIED TO A FLAT 14 DAYS. "You pay every two weeks" is the sample company's own pay period, read from its handbook, and it is what makes 30 days wrong: the next normal pay period is at most 14 days away, so the later of the two is never 30. On a MONTHLY payroll the next normal pay period could fall after the fourteenth day and be the one that counts, and a 30-day clause could still be wrong for a different reason — but the sentence on this card would not be. Step 12 keeps the pay period in the scene or the card stops being true.
// NO GATE — HR's chat and its check against the agency are live today (docs/PUBLIC-PAGES-PLAN.md §5 lists neither).
// *** THE CARD SHOWS WHAT HR DOES AND NOTHING HR DOES NOT — the owner, step 22b, 30 October 2026. ***
// Its three strings are the product's: "Add a handbook" is HR's attach line (`app/hr/HrWorkspace.tsx:749`), the
// draft block is labelled "Suggested wording" exactly as HR labels it (`:123`), and the one action is "Research
// this" (`:795`–`:802`, under the comment "No checklist in HR."). What step 22 drew and 22b took off: a "needs
// work" pill, which is DOCUMENTS' word (`lib/documentStatus.ts:16`) and not HR's — its sentence stays, as a
// sentence; and the two controls "Use this wording" and "Add to a checklist", which HR does not have. The only
// difference left is colour: HR draws the draft block grey (`bg-gray-50`), this card draws it green, because the
// public pages' cards are coloured (decision 5).
// HISTORY, one line: HR has no status word for a clause that disagrees with the agency because the per-section
// word rules left the run on 8 October 2026 and are parked on `parked/hr-check-structured` (`lib/handbookCheck.ts:22`–`:24`).
/**
 * PANEL 6 — HR. Public pages step 22 (`docs/PUBLIC-PAGES-PLAN.md` §4 row 6, decisions 5 and 10).
 * The hero's fourth line points here (`#hr`).
 *
 * The shape of the panel is the argument: two quotes side by side, the handbook on the left and
 * the state on the right, and under them the one sentence that says which governs. Everything
 * else on the card hangs off that pair.
 *
 * Grey, because the calendar before it is white (decision 6, the panels alternate). It was built
 * before the calendar was — step 21's instruction arrived cut off — and followed Documents for
 * one commit; step 21 put the calendar between them and nothing here had to change.
 */
import Frame from './Frame'
import AskBox from './AskBox'
import { PRIMARY_SMALL } from '@/components/buttonStyles'

/**
 * EVERY WORD THIS PANEL SHOWS, IN ONE PLACE — see the SAMPLE TEXT note at the top. A restaurant
 * in Kentucky: the industries rotate across the panels (decision 4), and final pay is the rule a
 * handbook is most often wrong about, because the handbook was written once and the state moved.
 */
const WORDS = {
  eyebrow: 'HR',
  headline: 'The handbook says 30 days. The state says 14.',
  typed: 'A server quit yesterday. When do we have to pay her last check?',
  /** HR's own words under its box: `app/hr/HrWorkspace.tsx:749`, `:798` and `:850`. */
  attach: 'Add a handbook',
  under:
    'It answers from your handbook first, then checks the state. Where the two disagree it says ' +
    'so, and offers the words that fix it.',
  card: {
    title: 'Final pay after leaving',
    meta: 'handbook check · Kentucky · Employee Handbook 2024, section 6.3 · sample company',
    answer:
      'Her last check is due on the next regular payday, or 14 days after her last day, ' +
      'whichever is later. Not 30.',
    handbookLabel: 'Your handbook',
    handbookQuote:
      '“Final pay will be issued within 30 days after your last day of work.”',
    handbookSource: 'section 6.3, page 14',
    stateLabel: 'Kentucky',
    stateQuote:
      '“…not later than the next normal pay period … or fourteen (14) days … whichever last occurs.”',
    stateSource: 'KRS 337.055 · apps.legislature.ky.gov',
    verdict:
      'You pay every two weeks, so the handbook’s 30 days is later than the state allows.',
    /** HR's own label for a draft, word for word: `app/hr/HrWorkspace.tsx:123`. */
    suggestedLabel: 'Suggested wording',
    suggested:
      '“If you leave or are let go, your final pay is issued on the next regular payday, or ' +
      'within 14 days of your last day, whichever is later.”',
    /** HR's one action: `app/hr/HrWorkspace.tsx:795`–`:802`. */
    action: 'Research this',
    checked: 'checked against the state today',
  },
}

/** The side padding every part of the card carries. 24px on a laptop, 16px below. */
const SIDES = 'px-4 lg:px-6'

/** One of the two quotes. The same box twice, so the pair reads as a comparison and not as a verdict. */
function Quote({
  label,
  tone,
  quote,
  source,
}: {
  label: string
  /** The label's colour only: amber for what you wrote, blue for what the state did. */
  tone: 'amber' | 'blue'
  quote: string
  source: string
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] px-[14px] py-3">
      <p
        className={`text-[12px] font-medium uppercase tracking-[0.06em] ${
          tone === 'amber' ? 'text-[var(--amber-ink)]' : 'text-[var(--blue)]'
        }`}
      >
        {label}
      </p>
      <p className="mt-2 font-serif text-[15px] leading-[1.45] text-[var(--ink)]">{quote}</p>
      <p className="mt-2 text-[12px] text-[var(--ink-soft)]">{source}</p>
    </div>
  )
}

export default function HRPanel() {
  return (
    <Frame
      id="hr"
      tone="grey"
      card={
        <div className="lg:flex lg:justify-center">
          <div className="w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(20,23,26,.04),0_16px_40px_rgba(20,23,26,.10)] lg:w-[520px] lg:max-w-full lg:shrink-0">
            <div className={`${SIDES} border-b border-[var(--line)] pt-[18px] pb-[14px]`}>
              <p className="text-[18px] font-medium text-[var(--ink)]">{WORDS.card.title}</p>
              <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{WORDS.card.meta}</p>
            </div>

            <div className={`${SIDES} flex flex-col gap-[14px] pt-[14px]`}>
              {/* The answer is the serif, as the workspace's answers are: the one part of the card
                  a person would read aloud. */}
              <p className="font-serif text-[16px] leading-[1.5] text-[var(--ink)]">
                {WORDS.card.answer}
              </p>

              {/* Side by side from 1024px, stacked below it — at 390 two columns of a 15px serif
                  quote would be four words a line. */}
              <div className="grid gap-[14px] lg:grid-cols-2">
                <Quote
                  label={WORDS.card.handbookLabel}
                  tone="amber"
                  quote={WORDS.card.handbookQuote}
                  source={WORDS.card.handbookSource}
                />
                <Quote
                  label={WORDS.card.stateLabel}
                  tone="blue"
                  quote={WORDS.card.stateQuote}
                  source={WORDS.card.stateSource}
                />
              </div>

              {/* THE SENTENCE THAT SAYS WHICH ONE GOVERNS, between the two quotes and the
                  wording that fixes it. It wore a "needs work" pill until step 22b: the word was
                  Documents', HR has none of its own, and a sentence does not need a badge to be
                  read as a verdict. */}
              <p className="text-[14px] text-[var(--ink)]">{WORDS.card.verdict}</p>

              {/* THE DRAFT. Green because it is the thing to do, not the thing that is wrong — the
                  app draws the same block grey, which is the difference the step 22 report names. */}
              <div className="rounded-lg bg-[var(--green-wash)] px-[14px] py-3">
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--green-ink)]">
                  {WORDS.card.suggestedLabel}
                </p>
                <p className="mt-2 font-serif text-[15px] leading-[1.45] text-[var(--ink)]">
                  {WORDS.card.suggested}
                </p>
              </div>
            </div>

            {/* `pointer-events-none` on the button: PRIMARY_SMALL carries a hover colour, and a
                hover state on something that cannot be pressed is a promise the page cannot keep.
                Below lg the "checked" line takes a row of its own. */}
            <div className={`${SIDES} pb-5`}>
              <div className="mt-[14px] flex flex-wrap items-center gap-[18px] border-t border-[var(--line)] pt-3">
                <span className={`${PRIMARY_SMALL} pointer-events-none`}>{WORDS.card.action}</span>
                <span className="w-full text-[13px] text-[var(--ink-soft)] lg:ml-auto lg:w-auto">
                  {WORDS.card.checked}
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
