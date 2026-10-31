// GATE F4 — docs/PUBLIC-PAGES-PLAN.md §5. "Download the binder" waits on the binder being built. Walked at step 33.
// SAMPLE TEXT — the document names and fix sentences below are in the product's voice and are replaced at step 12 (the words check) by words from a real Cascade run. Keep them in WORDS so the swap is one place.
/**
 * PANEL 2a — THE AUDIT. Public pages step 16 (`docs/PUBLIC-PAGES-PLAN.md` §4 panel 2a,
 * decisions 3, 5 and 10). It is the FIRST panel after the hero because it is the fear.
 *
 * The shape is the frame's (`components/home/Frame.tsx`): the moment on the left in the person's
 * own words, with the box they typed it into, and on the right what the product gives back, drawn
 * in code with the app's own tokens (decision 5 — screenshots never read clean).
 *
 * *** THE FOUR PILLS ARE THE PRODUCT'S WORDS, NOT THE PAGE'S (§2 rule 2) — AND THEY COME FROM
 * TWO VOCABULARIES, WHICH IS THE APP'S OWN DOING. *** Corrected at step 12, 30 October 2026.
 *
 * Three of them are AUDIT words, the four a run is allowed to use (`lib/auditRun.ts:827`;
 * `prompts/audit-agency.ts:95` says "one of these four and no other"), printed lower case:
 * "on file", "out of date" (`stale`) and "nothing on file" are `app/audits/page.tsx:88`–`:89`
 * and the same map again at `components/AuditReport.tsx:103`–`:105`.
 *
 * "Needs work" is NOT one of those four. It is a DOCUMENT's status
 * (`lib/documentStatus.ts:16`), and it belongs on an audit row because the audit report itself
 * puts it there: `components/AuditReport.tsx:268`–`:272` prints a finding's document's own
 * `display_status` beside its title, through the map at `:36`–`:40`, under the comment at `:29`
 * — "Documents' own words for a status, so the audit does not invent a second vocabulary for
 * them." So a row CAN carry it, and this card's amber row does.
 *
 * What step 12 changed is the CASE: this file wrote "needs work", and every place the product
 * prints it writes **"Needs work"** (`lib/documentStatus.ts:16`, `components/DocumentReport.tsx:97`,
 * `components/AuditReport.tsx:37`). The other three stay lower case because that is how the
 * audits vocabulary prints them. The mixed case on this card is the app's mixed case, not the
 * page's invention — and that is the reason to keep it rather than tidy it.
 *
 * The missing row's link was "add" and is now **"Add a document"**, the report's own words for
 * exactly that affordance (`components/AuditReport.tsx:233`). "report" at the end of the three
 * held rows has no product string behind it — the app opens the document from its title — and is
 * named in the step 12 report as one of the card's own two words.
 *
 * *** AND NOTHING IN THE CARD IS CLICKABLE, ON PURPOSE. *** "report", "add", "Print", "Audit
 * again" and the binder button are <span>s wearing link and button clothes. They are a drawing of
 * the app, and a homepage that hands a visitor a control that does nothing is worse than a
 * homepage that draws one. `components/home/AskBox.tsx` says the same thing about the box.
 *
 * Colour does one job each (§2 rule 5): amber asks something of you, the muted red is only for
 * expired and passed, green is on file and the one action, grey is information.
 */
import Frame from './Frame'
import AskBox from './AskBox'
import { PRIMARY_SMALL } from '@/components/buttonStyles'

/**
 * EVERY WORD THIS PANEL SHOWS, IN ONE PLACE — see the SAMPLE TEXT note at the top. Step 12
 * replaces the card's words with words from a real run on the fixture company, and this is the
 * one object it edits.
 */
const WORDS = {
  eyebrow: 'Audit Workspace',
  headline: 'The inspector is coming Thursday.',
  typed: 'Audit us for Oregon DEQ',
  attach: 'Attach a checklist, your own or your auditor’s',
  under:
    'Every document you hold for them, what to fix in it, and what is not there at all. ' +
    'Ask a follow-up; it remembers the conversation.',
  card: {
    title: 'Oregon DEQ audit',
    meta: 'audited 1 October 2026 · 5 documents read · sample company',
    heldLabel: 'Your documents',
    heldCount: '5',
    missingLabel: 'Nothing on file',
    missingCount: '1',
    report: 'report',
    add: 'Add a document',
    binder: 'Download the binder',
    print: 'Print',
    again: 'Audit again',
  },
  rows: [
    {
      pill: 'Needs work',
      tone: 'amber' as const,
      title: 'Hazardous Waste Contingency Plan',
      lead: null,
      fix: 'Names a coordinator who has left. Name a new one in section 4.',
    },
    {
      pill: 'out of date',
      tone: 'red' as const,
      title: 'Stormwater permit 1200-Z',
      lead: 'Expired 14 March 2026.',
      fix: 'The renewal steps are in the report.',
    },
    {
      pill: 'on file',
      tone: 'green' as const,
      title: 'Scrubber inspection log',
      lead: null,
      fix: 'Condition 3.1, kept weekly.',
    },
  ],
  missing: {
    pill: 'nothing on file',
    title: 'Hazardous waste training records',
    fix: 'Add the roster, or tell us it does not apply.',
  },
}

/** The pill's two colours, by what the row is asking of you. */
const PILL: Record<'amber' | 'red' | 'green', string> = {
  amber: 'bg-[var(--amber-pill)] text-[var(--amber-ink)]',
  red: 'bg-[var(--red-muted)] text-white',
  green: 'bg-[var(--green-wash)] text-[var(--green-ink)]',
}

/** The wash behind the row. `green` carries none — on file is not attention (§2 rule 5). */
const WASH: Record<'amber' | 'red' | 'green', string> = {
  amber: 'bg-[var(--amber-wash)]',
  red: 'bg-[var(--red-wash)]',
  green: '',
}

/* `justify-self-start`: a grid item's default is to STRETCH, so the pill filled the whole
   104px column (and the whole row on a phone) and stopped being a pill. */
const PILL_BASE =
  'justify-self-start shrink-0 rounded-full px-2 py-[2px] text-[12px] font-medium'
const LINK = 'text-[12px] font-medium text-[var(--green)]'

/**
 * ONE ROW, AND IT IS THE SAME DOM AT BOTH WIDTHS. On a laptop: the pill, then the title with the
 * fix under it, then the link, all on one baseline. Below 1024 the three columns become one and
 * the row reads top to bottom — pill and link on the first line, then the title, then the fix —
 * which is a placement change, not a second copy of the row. (A second copy is how two surfaces
 * end up saying different things; `lib/documentStatus.ts`'s header is the long version.)
 */
function Row({
  pill,
  tone,
  title,
  lead,
  fix,
  link,
  dashed = false,
}: {
  pill: string
  tone: 'amber' | 'red' | 'green'
  title: string
  lead?: string | null
  fix: string
  link: string
  dashed?: boolean
}) {
  return (
    <div
      className={`-mx-[10px] grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 rounded-lg p-[10px] lg:grid-cols-[104px_1fr_auto] lg:gap-3 ${
        dashed ? 'border border-dashed border-[var(--amber-line)]' : WASH[tone]
      }`}
    >
      <span className={`${PILL_BASE} ${PILL[tone]} lg:col-start-1 lg:row-start-1`}>{pill}</span>
      <span className={`${LINK} justify-self-end lg:col-start-3 lg:row-start-1`}>{link}</span>
      {/* `min-w-0` with `truncate`: a grid column's default minimum is its content, so without it
          a long document name widens the column instead of ending in an ellipsis. */}
      <p className="col-span-2 min-w-0 truncate text-[14px] text-[var(--ink)] lg:col-span-1 lg:col-start-2 lg:row-start-1">
        {title}
      </p>
      <p className="col-span-2 text-[12px] text-[var(--ink-soft)] lg:col-span-1 lg:col-start-2 lg:row-start-2">
        {lead && <span className="font-medium text-[var(--red-muted)]">{lead} </span>}
        {fix}
      </p>
    </div>
  )
}

/** A group's heading: what the rows below it are, and how many of them there are. */
function GroupLabel({ text, count, tone }: { text: string; count: string; tone: 'green' | 'amber' }) {
  return (
    <p
      className={`flex items-baseline gap-2 text-[12px] font-medium uppercase tracking-[0.06em] ${
        tone === 'green' ? 'text-[var(--green-ink)]' : 'text-[var(--amber-ink)]'
      }`}
    >
      {text}
      <span className="font-normal tracking-normal text-[var(--ink-soft)]">{count}</span>
    </p>
  )
}

export default function AuditPanel() {
  return (
    <Frame
      id="audit"
      tone="grey"
      card={
        /* 520 IS THE BOARD'S CARD, and with step 16b's content box it fits with room to spare:
           the right-hand column is 6fr of (1200 − 64) at 1440, about 620, and of (1040 − 64) at
           1280, about 530. The card is 520 at both and sits CENTRED in that column, which is
           what makes the air between the words and the card match the boards.
           `shrink-0` is not decoration: a flex item's default is to shrink, so at 1280 the card
           would give up its last few pixels to the column rather than keep its width.
           `max-w-full` is the guard for a column narrower than the card — it caps rather than
           overflows, and below `lg` the card is simply the full width of the page. */
        <div className="lg:flex lg:justify-center">
          <div className="w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(20,23,26,.04),0_16px_40px_rgba(20,23,26,.10)] lg:w-[520px] lg:max-w-full lg:shrink-0">
            <div className="border-b border-[var(--line)] px-6 pt-5 pb-[14px]">
              <p className="text-[18px] font-medium text-[var(--ink)]">{WORDS.card.title}</p>
              <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{WORDS.card.meta}</p>
            </div>

            <div className="px-6 pt-4 pb-5">
              <GroupLabel text={WORDS.card.heldLabel} count={WORDS.card.heldCount} tone="green" />
              <div className="mt-2 flex flex-col gap-1">
                {WORDS.rows.map((r) => (
                  <Row key={r.title} {...r} link={WORDS.card.report} />
                ))}
              </div>

              <div className="mt-5">
                <GroupLabel
                  text={WORDS.card.missingLabel}
                  count={WORDS.card.missingCount}
                  tone="amber"
                />
                <div className="mt-2">
                  <Row
                    pill={WORDS.missing.pill}
                    tone="amber"
                    title={WORDS.missing.title}
                    fix={WORDS.missing.fix}
                    link={WORDS.card.add}
                    dashed
                  />
                </div>
              </div>

              {/* `pointer-events-none` on the button: PRIMARY_SMALL carries a hover colour, and a
                  hover state on something that cannot be pressed is a promise the page cannot
                  keep. */}
              <div className="mt-4 flex flex-wrap items-center gap-[18px] border-t border-[var(--line)] pt-[14px]">
                <span className={`${PRIMARY_SMALL} pointer-events-none`}>{WORDS.card.binder}</span>
                <span className="text-[13px] text-[var(--ink-soft)]">{WORDS.card.print}</span>
                <span className="text-[13px] text-[var(--ink-soft)]">{WORDS.card.again}</span>
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
        <h2 className="max-w-[16ch] font-serif text-[32px] leading-[1.12] text-[var(--ink)] lg:text-[44px]">
          {WORDS.headline}
        </h2>
        <AskBox typed={WORDS.typed} attach={WORDS.attach} label="Audit" />
        <p className="max-w-[44ch] text-[15px] leading-[1.55] text-[var(--ink-soft)]">
          {WORDS.under}
        </p>
      </div>
    </Frame>
  )
}
