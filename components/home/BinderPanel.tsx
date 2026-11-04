// GATE F4 — CLOSED 4 November 2026 (`docs/GAPS-PLAN.md` Part C, decision 61). The binder exists:
// the report page has a binder mode that lays out the cover, the rows and the cited documents and
// hands the whole thing to the browser's print. The card's button carries the product's own words,
// "Print the binder". TWO THINGS IN THIS PANEL ARE STILL THE SCENE'S AND NOT THE PRODUCT'S, and
// they are recorded in `docs/GAPS-PLAN.md` §8 rather than quietly changed here: the typed line
// asks for a binder in the chat, and the product builds one from a BUTTON on the report or the
// checklist card; and "PDF · 96 pages" is a sample count. Both are words for step 12/33 to settle.
// GATE F6, a hypothesis to settle at step 12 — docs/PENDING.md F6 says the checklist (template) audit answers "not ready"; app/api/audit-runs/route.ts has a `kind === 'template'` branch. Which is true decides whether this scene's checklist is real. Do not resolve it here.
// SAMPLE TEXT — every string below is in the product's voice and is replaced at step 12 by words from a real run. Kept in WORDS so the swap is one place.
/**
 * PANEL 2b — THE BINDER. Public pages step 17 (`docs/PUBLIC-PAGES-PLAN.md` §4 panel 2b,
 * decisions 5 and 10). It follows the audit because it is the same work turned outward: the
 * audit is for you, the binder is for the person asking.
 *
 * The shape is `components/home/Frame.tsx`'s, and the card is `AuditPanel`'s with one addition —
 * a second page behind it, offset and turned by a degree, so the card reads as a STACK rather
 * than a screen. That is the whole idea of the panel in one shape: a binder is many pages in an
 * order somebody else chose.
 *
 * White, not grey: the panels alternate (decision 6), and the audit before it is grey.
 *
 * *** NOTHING IN THE CARD IS CLICKABLE, as in AuditPanel. *** "report", "Add a document",
 * "Print" and the download button are <span>s wearing link and button clothes, because the page
 * draws the app, it does not pretend to be it. `components/home/AskBox.tsx` says the same about
 * the box.
 *
 * STEP 12 CARRIED AuditPanel's TWO WORD FIXES ACROSS, because the tabs are that card's rows with
 * a reference added: the pill is **"Needs work"**, the product's own case
 * (`lib/documentStatus.ts:16`; the long version of why a document's word is on an audit row is in
 * `AuditPanel.tsx`'s header), and the link on the tab with nothing behind it is
 * **"Add a document"** (`components/AuditReport.tsx:233`). The other three pills keep the audits
 * vocabulary's lower case.
 */
import Frame from './Frame'
import AskBox from './AskBox'
import { PRIMARY_SMALL } from '@/components/buttonStyles'

/**
 * EVERY WORD THIS PANEL SHOWS, IN ONE PLACE — see the SAMPLE TEXT note at the top. The scene is
 * a grocery supplier audit rather than a chemical one on purpose (§2 decision 4: the industries
 * rotate across the panels, because the product reads any company's documents).
 */
const WORDS = {
  eyebrow: 'Audit Workspace · the binder',
  headline: 'The customer wants our audit binder by Friday.',
  typed: 'Build the binder for the Northwest Grocers supplier audit',
  attach: 'Northwest-Grocers-Supplier-Checklist-2026.pdf · attached',
  under:
    'One PDF, in their order: each requirement on a tab, the document that answers it behind. ' +
    'Print it, or send it.',
  card: {
    kicker: 'Audit binder',
    title: 'Northwest Grocers supplier audit',
    meta: 'prepared 4 November 2026 · 12 requirements · 11 documents · 96 pages · sample company',
    more: 'and 8 more tabs, in the checklist’s own order',
    download: 'Print the binder',
    print: 'Print',
    format: 'PDF · 96 pages',
    report: 'report',
    add: 'Add a document',
  },
  tabs: [
    {
      ref: 'A1',
      tone: 'green' as const,
      wash: false,
      title: 'Written food safety plan',
      lead: null,
      line: 'HACCP Plan, revised March 2026 · 14 pages',
      pill: 'on file',
      link: 'report',
    },
    {
      ref: 'A4',
      tone: 'amber' as const,
      wash: true,
      title: 'Allergen control program',
      lead: null,
      line:
        'Allergen Control Procedure, 2025 · 6 pages · names no one who checks the labels. ' +
        'Add a name in section 3.',
      pill: 'Needs work',
      link: 'report',
    },
    {
      ref: 'B2',
      tone: 'red' as const,
      wash: true,
      title: 'Pest control records, last 12 months',
      lead: 'Pest service log ends 2 March 2026.',
      line: 'Seven months are missing. Ask the vendor for the rest.',
      pill: 'out of date',
      link: 'report',
    },
    {
      ref: 'C1',
      tone: 'amber' as const,
      wash: true,
      title: 'Product recall plan',
      lead: null,
      line: 'The tab is left in and says so. Add the plan and the binder updates.',
      pill: 'nothing on file',
      link: 'Add a document',
    },
  ],
}

type Tone = 'amber' | 'red' | 'green'

/**
 * One pair of colours per tone, worn twice on every row: by the tab's square reference and by
 * the pill at the other end. They are AuditPanel's pairs, and they have to be — a row that says
 * "needs work" in one amber on the audit card and another amber on the binder card is two
 * answers to one question (§2 rule 5, colour does one job).
 */
const TONE: Record<Tone, string> = {
  amber: 'bg-[var(--amber-pill)] text-[var(--amber-ink)]',
  red: 'bg-[var(--red-muted)] text-white',
  green: 'bg-[var(--green-wash)] text-[var(--green-ink)]',
}

/** The wash behind a tab. `green` carries none — on file is not attention. */
const WASH: Record<Tone, string> = {
  amber: 'bg-[var(--amber-wash)]',
  red: 'bg-[var(--red-wash)]',
  green: '',
}

/* `justify-self-*`: a grid item stretches by default, which turns a pill into a bar and a
   two-letter reference into a 44px slab of colour. */
const PILL_BASE = 'justify-self-start shrink-0 rounded-full px-2 py-[2px] text-[12px] font-medium'
const REF_BASE = 'w-11 shrink-0 justify-self-start rounded py-[2px] text-center text-[12px] font-medium'
const LINK = 'text-[12px] font-medium text-[var(--green)]'

/**
 * ONE TAB, AND IT IS THE SAME DOM AT BOTH WIDTHS (AuditPanel's row, with the reference added).
 * On a laptop: the reference, the requirement with its document under it, the word for where it
 * stands, the link — four columns on one baseline. Below 1024 they become one column and the tab
 * reads top to bottom: reference, word and link on the first line, then the requirement, then
 * the line under it. A placement change, not a second copy of the row.
 */
function Tab({
  tabRef,
  tone,
  wash,
  title,
  lead,
  line,
  pill,
  link,
}: {
  tabRef: string
  tone: Tone
  wash: boolean
  title: string
  lead?: string | null
  line: string
  pill: string
  link: string
}) {
  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 py-[11px] lg:grid-cols-[44px_1fr_auto_auto] ${
        wash ? `-mx-[10px] rounded-lg px-[10px] ${WASH[tone]}` : 'border-b border-[var(--line)]'
      }`}
    >
      <span className={`${REF_BASE} ${TONE[tone]} lg:col-start-1 lg:row-start-1`}>{tabRef}</span>
      <span className={`${PILL_BASE} ${TONE[tone]} lg:col-start-3 lg:row-start-1`}>{pill}</span>
      <span className={`${LINK} justify-self-end lg:col-start-4 lg:row-start-1`}>{link}</span>
      {/* `min-w-0` with `truncate`: a grid column's minimum is its content by default, so a long
          requirement would widen the column instead of ending in an ellipsis. */}
      <p className="col-span-3 min-w-0 truncate text-[14px] text-[var(--ink)] lg:col-span-1 lg:col-start-2 lg:row-start-1">
        {title}
      </p>
      <p className="col-span-3 text-[12px] text-[var(--ink-soft)] lg:col-span-1 lg:col-start-2 lg:row-start-2">
        {lead && <span className="font-medium text-[var(--red-muted)]">{lead} </span>}
        {line}
      </p>
    </div>
  )
}

export default function BinderPanel() {
  return (
    <Frame
      id="binder"
      tone="white"
      card={
        /* THE STACK. The wrapper is only there to be positioned against: the card stays in the
           flow and gives the wrapper its height, and the second page is absolute over the same
           box, pushed 14px and turned 1.2deg so it shows past the right and bottom edges. It is
           DROPPED below lg (`hidden lg:block`) — on a phone the card is the full width of the
           page and a second page behind it would either be cut off or push the page sideways.
           The transform is inline rather than two Tailwind utilities: translate and rotate are
           one property, and which of two utilities wins is the emit order's decision. */
        <div className="lg:flex lg:justify-center">
          <div className="relative w-full lg:w-[520px] lg:max-w-full lg:shrink-0">
            <div
              aria-hidden="true"
              style={{ transform: 'translate(14px, 14px) rotate(1.2deg)' }}
              className="absolute inset-0 hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_8px_24px_rgba(20,23,26,.07)] lg:block"
            />

            <div className="relative w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(20,23,26,.04),0_16px_40px_rgba(20,23,26,.10)]">
              {/* THE COVER, in the page grey so it reads as the outside of the document and the
                  tabs read as the inside. The title is the serif, because it is the only line on
                  the card a person would read aloud. */}
              <div className="border-b border-[var(--line)] bg-[var(--page)] px-6 pt-5 pb-4">
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                  {WORDS.card.kicker}
                </p>
                <p className="mt-1 font-serif text-[22px] leading-[1.2] text-[var(--ink)]">
                  {WORDS.card.title}
                </p>
                <p className="mt-2 text-[12px] text-[var(--ink-soft)]">{WORDS.card.meta}</p>
              </div>

              <div className="px-6 pt-[10px]">
                {/* `ref` is destructured out rather than spread: React treats a prop called
                    `ref` specially, and this one is a tab's reference in a checklist. */}
                {WORDS.tabs.map(({ ref, ...rest }) => (
                  <Tab key={ref} tabRef={ref} {...rest} />
                ))}
                <p className="pt-3 text-[12px] text-[var(--ink-soft)]">{WORDS.card.more}</p>
              </div>

              {/* `pointer-events-none` on the button: PRIMARY_SMALL carries a hover colour, and a
                  hover state on something that cannot be pressed is a promise the page cannot
                  keep. Below lg the format line takes a row of its own (`w-full`). */}
              <div className="px-6 pb-5">
                <div className="mt-4 flex flex-wrap items-center gap-[18px] border-t border-[var(--line)] pt-[14px]">
                  <span className={`${PRIMARY_SMALL} pointer-events-none`}>
                    {WORDS.card.download}
                  </span>
                  <span className="text-[13px] text-[var(--ink-soft)]">{WORDS.card.print}</span>
                  <span className="w-full text-[13px] text-[var(--ink-soft)] lg:ml-auto lg:w-auto">
                    {WORDS.card.format}
                  </span>
                </div>
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
        <h2 className="max-w-[18ch] font-serif text-[32px] leading-[1.12] text-[var(--ink)] lg:text-[44px]">
          {WORDS.headline}
        </h2>
        <AskBox typed={WORDS.typed} attach={WORDS.attach} label="Build" />
        <p className="max-w-[44ch] text-[15px] leading-[1.55] text-[var(--ink-soft)]">
          {WORDS.under}
        </p>
      </div>
    </Frame>
  )
}
