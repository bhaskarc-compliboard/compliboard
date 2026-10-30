// SAMPLE TEXT — the answers are written in the product's voice and are replaced at step 12 by words from a real run. The four FACTS were checked at the source on 30 October 2026 and are not sample: local permits before the DCC licence (https://www.ca.gov/departments/100/services/1281/); 10 mg a serving, 100 mg a package, 500 mg medicinal exception for orally dissolving products (4 CCR §17304, read at https://law.cornell.edu/regulations/california/4-CCR-17304); child-resistant packaging and the universal symbol on the primary panel (https://cannabis.ca.gov/licensees/requirements-cannabis-goods); CCTT runs on Metrc and every licensee uses it after the account-manager training (https://cannabis.ca.gov/wp-content/uploads/sites/2/2022/04/Track-and-Trace_System_5-Steps.pdf). Step 12 confirms the real run cites the DCC's own copy of §17304, not Cornell's.
// Everything on this card is live today; this panel waits on no gate item.
/**
 * PANEL 3a — A QUESTION. Public pages step 18 (`docs/PUBLIC-PAGES-PLAN.md` §4 row 3a,
 * decisions 5 and 10). The first panel whose card is a CONVERSATION rather than a result: the
 * question, the answer with its sources, and a second question that the answer remembers.
 *
 * *** THE BUBBLE IS THE APP'S OWN, NOT A NEW ONE. *** `bg-gray-200` is #E5E7EB, which is what
 * the workspace, the calendar and HR all draw a person's question in
 * (`app/compliance/page.tsx:1116`, `components/CalendarAsk.tsx:259`,
 * `app/hr/HrWorkspace.tsx:668` — the same string in all three). It is written here as the literal
 * so the drawing cannot drift if a Tailwind grey ever moves, and smaller (10/14 rather than
 * 12/16) because the card is the app at about two-thirds.
 *
 * *** "official" IS THE PRODUCT'S WORD, DECIDED BY THE PRODUCT'S RULE. *** `labelFor()` in
 * `lib/howTo.ts:79` returns 'official' or 'other', and its first rule is that any `.gov` host is
 * official (`lib/howTo.ts:46`–`:51`). Both hosts on this card — ca.gov and cannabis.ca.gov — end
 * in .gov, so all four sources carry the word the product itself would give them. A source the
 * product calls "other" is never hidden; it is shown with the line that says so
 * (`OTHER_SOURCE_LINE`), and this scene simply has none.
 *
 * Grey, because the binder before it is white (decision 6, the panels alternate).
 */
import Frame from './Frame'
import AskBox from './AskBox'
import { PRIMARY_SMALL } from '@/components/buttonStyles'

/** A run of answer text, and the source marker that closes it. `null` ends the sentence plainly. */
type Span = { text: string; mark: number | null }

/**
 * EVERY WORD THIS PANEL SHOWS, IN ONE PLACE — see the SAMPLE TEXT note at the top. A licensed
 * cannabis distributor in California, because the industries rotate across the panels (decision
 * 4) and because this is the question the product is best at: one a person cannot answer from
 * memory and would otherwise pay for.
 */
const WORDS = {
  eyebrow: 'Compliance Workspace',
  headline: 'We want to make our own gummies. Where do we start?',
  typed:
    'We’re a licensed cannabis distributor in Sacramento. We want to start making our own ' +
    'gummies. What do we need before the first batch?',
  attach: 'Attach a file and ask any compliance question about it',
  under:
    'Ask anything. The answer comes with its sources, official pages first, and you can keep ' +
    'asking.',
  card: {
    kicker: 'Conversation',
    meta: 'started today · sample company',
    checklist: 'Make a checklist',
    summarise: 'Summarise',
    count: '2 of 2 answers · 4 sources',
    label: 'official',
  },
  asked:
    'We’re a licensed distributor in Sacramento. We want to start making our own gummies. ' +
    'What do we need before the first batch?',
  answer: [
    {
      text:
        'Two licences, in this order: your city’s permit first, then a manufacturing licence ' +
        'from the Department of Cannabis Control',
      mark: 1,
    },
    { text: '. Each gummy is capped at 10 mg THC and each package at 100 mg', mark: 2 },
    { text: ', in child‑resistant packaging with the universal symbol on the front', mark: 3 },
    {
      text:
        '. Every batch is tracked in Metrc from the first one, so the account‑manager training ' +
        'comes before you make anything',
      mark: 4,
    },
    { text: '.', mark: null },
  ] as Span[],
  sources: [
    { n: 1, host: 'ca.gov', title: 'Applying for a cannabis license' },
    { n: 2, host: 'cannabis.ca.gov', title: 'DCC regulations, 4 CCR §17304' },
    { n: 3, host: 'cannabis.ca.gov', title: 'Requirements for cannabis goods' },
    { n: 4, host: 'cannabis.ca.gov', title: 'Track and Trace, five steps' },
  ],
  askedAgain: 'Does the 100 mg cap apply to our medical customers too?',
  answerAgain: [
    {
      text:
        'Not always. An orally dissolving product, a lozenge or a strip, may hold up to 500 mg ' +
        'a package for medicinal sale only, labelled “FOR MEDICAL USE ONLY”, and each piece ' +
        'still 10 mg',
      mark: 2,
    },
    { text: '. A gummy is not one of those.', mark: null },
  ] as Span[],
}

/** The side margin every part of the card carries instead of the card carrying padding. */
const SIDES = 'mx-4 lg:mx-6'

/** A person's question. The app's bubble, at the card's scale. */
function Asked({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`${SIDES} flex justify-end ${className}`}>
      <p className="max-w-[88%] rounded-2xl bg-[#E5E7EB] px-[14px] py-[10px] text-[14px] leading-relaxed text-[var(--ink)] lg:max-w-[85%]">
        {text}
      </p>
    </div>
  )
}

/**
 * An answer, in the serif. The markers are real <sup>s rather than the ¹²³ characters: those are
 * four of a kind in Unicode and stop at four, and a screen reader reads them as ordinary digits
 * stuck to the last word.
 */
function Answer({ spans }: { spans: Span[] }) {
  return (
    <p className={`${SIDES} font-serif text-[16px] leading-[1.5] text-[var(--ink)]`}>
      {spans.map((s, i) => (
        <span key={i}>
          {s.text}
          {s.mark && <sup className="text-[11px] font-medium text-[var(--green)]">{s.mark}</sup>}
        </span>
      ))}
    </p>
  )
}

export default function QuestionPanel() {
  return (
    <Frame
      id="workspace"
      tone="grey"
      card={
        /* The card carries NO padding of its own and the parts carry their own side margin, so
           the header strip can run edge to edge while every line under it holds the same 24px
           margin (16px below lg). 520 centred, as the audit's and the binder's. */
        <div className="lg:flex lg:justify-center">
          <div className="w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(20,23,26,.04),0_16px_40px_rgba(20,23,26,.10)] lg:w-[520px] lg:max-w-full lg:shrink-0">
            <div className="flex flex-col gap-[14px] pb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] bg-[var(--page)] px-6 pt-4 pb-[14px]">
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                  {WORDS.card.kicker}
                </p>
                <p className="text-[12px] text-[var(--ink-soft)]">{WORDS.card.meta}</p>
              </div>

              <Asked text={WORDS.asked} />
              <Answer spans={WORDS.answer} />

              {/* THE SOURCES, WHICH ARE THE POINT OF THE PANEL. Each row is the marker, the host,
                  the page, and the word the product itself gives that host. */}
              <div className={`${SIDES} rounded-lg bg-[var(--green-wash)] px-3 py-[10px]`}>
                {WORDS.sources.map((s) => (
                  <div key={s.n} className="flex items-baseline gap-2 text-[12px]">
                    <span className="font-medium text-[var(--green)]">[{s.n}]</span>
                    <span className="min-w-0 truncate">
                      <span className="text-[var(--ink)]">{s.host}</span>
                      <span className="text-[var(--ink-soft)]"> · {s.title}</span>
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[var(--green-ink)]">
                      <span className="h-[6px] w-[6px] rounded-full bg-[var(--green)]" />
                      {WORDS.card.label}
                    </span>
                  </div>
                ))}
              </div>

              <Asked text={WORDS.askedAgain} className="mt-1" />
              <Answer spans={WORDS.answerAgain} />

              {/* `pointer-events-none` on the button: PRIMARY_SMALL carries a hover colour, and a
                  hover state on something that cannot be pressed is a promise the page cannot
                  keep. Below lg the count takes a row of its own. */}
              <div
                className={`${SIDES} flex flex-wrap items-center gap-[18px] border-t border-[var(--line)] pt-3`}
              >
                <span className={`${PRIMARY_SMALL} pointer-events-none`}>
                  {WORDS.card.checklist}
                </span>
                <span className="text-[13px] text-[var(--ink-soft)]">{WORDS.card.summarise}</span>
                <span className="w-full text-[13px] text-[var(--ink-soft)] lg:ml-auto lg:w-auto">
                  {WORDS.card.count}
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
