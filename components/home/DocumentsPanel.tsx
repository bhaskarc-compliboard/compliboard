// GATE F12 — closed at `docs/GAPS-PLAN.md` Part A step 4b: the Documents page has the chat, the
// two routes and the source cards that open a report. The box on this panel is the marketing
// page's own and still types nothing; what it promised now exists behind the login.
// SAMPLE TEXT — the plan, the gap wording and the address are in the product's voice and stay sample (§2 rule 2, as narrowed on 30 Oct). The three gaps are the RULE's own elements and step 12 read them again, word for word, at https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.38 on 30 October 2026 — 1910.38, "Emergency action plans.":
//   · (c)(4) "Procedures to account for all employees after evacuation;"
//   · (c)(6) "The name or job title of every employee who may be contacted by employees who need more information about the plan or an explanation of their duties under the plan."
//   · (d) "An employer must have and maintain an employee alarm system. The employee alarm system must use a distinctive signal for each purpose and comply with the requirements in § 1910.165."
// The freshness line is the product's own nudge (docs/VISION-DOCUMENTS.md, "Freshness has two clocks").
// AND THE FRESHNESS LINE THAT SENTENCE NAMES IS NOT ON THE CARD — the owner's follow-up to step 20 removed it and moved the document's date forward: a plan revised last year gets no nudge. The reference above is kept because the nudge is still the product's and a later scene may want it.
/**
 * PANEL 4 — DOCUMENTS. Public pages step 20 (`docs/PUBLIC-PAGES-PLAN.md` §4 row 4, decisions 5
 * and 10). The first panel where the person brings the document and the product reads it, so the
 * box carries a file chip above the question — `components/home/AskBox.tsx`'s `file` prop, added
 * for this panel and passed by no other.
 *
 * *** THE WORDS ARE THE REPORT'S OWN WHERE THE REPORT HAS THEM. *** "Needs work" is
 * `lib/documentStatus.ts:16` and `components/DocumentReport.tsx:97`; "3 gaps" is what the
 * report's own header prints (`components/DocumentReport.tsx:574`); "Make a checklist for all 3
 * gaps" is that button's exact string (`:418`); "Confirm" and "Not right" are the pair the
 * product uses for a fact it wants checked (`components/DocumentReport.tsx:956`–`:958`, and
 * `lib/calendarQueue.ts:84`–`:85`, where the comment says neither word is negotiable).
 *
 * *** AND STEP 12 (30 October 2026) FIXED THE FOUR THAT WERE NOT. ***
 *   · the pill was "needs work"; the product writes **"Needs work"**, in all three places it
 *     prints it (above, and `components/AuditReport.tsx:37`);
 *   · the footer's second word was "Print"; the report's one control is **"Download"**
 *     (`components/DocumentReport.tsx:454`–`:455`, `printDrawer` under that word) and there is no
 *     "Print" on a document report at all;
 *   · "Draft section 4" is now **"Draft this section"**, the app's exact string
 *     (`components/DocumentReport.tsx:761`). The old note argued that "this" has no referent on a
 *     card with no gap selected; it sits under three numbered gaps, which is referent enough, and
 *     §2 rule 2 asks for the product's word rather than a better one;
 *   · the box's attach line was "Drop a file, or a whole folder", which the product never says.
 *     Its two controls are **"Add files"** (`app/documents/page.tsx:855`) and **"Add a folder"**
 *     (`:859`), and the line now uses them.
 *
 * Grey, because the checklist before it is white (decision 6).
 */
import Frame from './Frame'
import AskBox from './AskBox'
import { PRIMARY_SMALL } from '@/components/buttonStyles'

/**
 * EVERY WORD THIS PANEL SHOWS, IN ONE PLACE — see the SAMPLE TEXT note at the top. An emergency
 * action plan, because it is the document every manufacturer has and nobody has opened: the
 * panel's whole argument is that the product opened it.
 */
const WORDS = {
  eyebrow: 'Documents',
  headline: 'Nobody has opened this plan since 2025.',
  file: { name: 'Emergency-Action-Plan-2025.pdf', meta: '· 9 pages' },
  typed: 'What’s wrong with this plan?',
  attach: 'Add files, or a whole folder',
  under:
    'It says what the document is, what is wrong with it against the rule it is written to, ' +
    'each gap with its fix, and every date it sets. Then it asks you to confirm what it found.',
  card: {
    title: 'Emergency Action Plan',
    meta: 'program · OSHA · revised February 2025 · read 30 October 2026 · sample company',
    pill: 'Needs work',
    gapCount: '3 gaps',
    summary:
      'A written emergency action plan for one building. Most of it still holds; three things ' +
      'the rule requires are missing or out of date.',
    askedBefore: 'We found: ',
    found: 'one building, 1200 Pace Street, Longmont',
    askedAfter: ', page 1. Is that right?',
    confirm: 'Confirm',
    notRight: 'Not right',
    checklist: 'Make a checklist for all 3 gaps',
    draft: 'Draft this section',
    print: 'Download',
  },
  gaps: [
    {
      gap: 'No way to account for everyone after an evacuation.',
      fix: 'Add a headcount step and who does it, section 4. · 1910.38(c)(4)',
    },
    {
      gap: 'The two people to contact about the plan have both left since.',
      fix: 'Name the current ones, or use job titles, section 7. · 1910.38(c)(6)',
    },
    {
      gap: 'The alarm is described as “the bell” for every emergency.',
      fix: 'Say which signal means evacuate and which means shelter. · 1910.38(d)',
    },
  ],
}

/** The side padding every part of the card carries. 24px on a laptop, 16px below. */
const SIDES = 'px-4 lg:px-6'

export default function DocumentsPanel() {
  return (
    <Frame
      id="documents"
      tone="grey"
      card={
        <div className="lg:flex lg:justify-center">
          <div className="w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(20,23,26,.04),0_16px_40px_rgba(20,23,26,.10)] lg:w-[520px] lg:max-w-full lg:shrink-0">
            <div className={`${SIDES} border-b border-[var(--line)] pt-[18px] pb-[14px]`}>
              <p className="text-[18px] font-medium text-[var(--ink)]">{WORDS.card.title}</p>
              <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{WORDS.card.meta}</p>
            </div>

            <div className={`${SIDES} flex flex-col gap-3 pt-[14px]`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="shrink-0 rounded-full bg-[var(--amber-pill)] px-2 py-[2px] text-[12px] font-medium text-[var(--amber-ink)]">
                  {WORDS.card.pill}
                </span>
                <span className="text-[13px] text-[var(--ink)]">{WORDS.card.gapCount}</span>
              </div>

              {/* The summary is the serif, as the workspace's answers are: it is the one part of
                  the card a person would read aloud. */}
              <p className="font-serif text-[16px] leading-[1.5] text-[var(--ink)]">
                {WORDS.card.summary}
              </p>

              {/* THE GAPS, each numbered in a fixed 18px column so the three sit at one x and
                  every fix under them indents to the same margin (`DESIGN.md` §4, the same rule
                  the checklist's boxes follow). */}
              <div className="rounded-lg bg-[var(--amber-wash)] px-[14px] py-3">
                {WORDS.gaps.map((g, i) => (
                  <div
                    key={g.gap}
                    className={`grid grid-cols-[18px_1fr] items-start gap-2 ${i > 0 ? 'mt-3' : ''}`}
                  >
                    <span className="text-[13px] font-medium text-[var(--amber-ink)]">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[14px] leading-[1.45] text-[var(--ink)]">{g.gap}</p>
                      <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{g.fix}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* THE CONFIRMATION, which is the honest half of the report: it says what it read
                  and asks. Below lg the question and the two words stack, because side by side
                  at that width the words wrap to one per line. */}
              <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-3 text-[13px] lg:flex-row lg:items-baseline lg:justify-between lg:gap-4">
                <p className="text-[var(--ink)]">
                  {WORDS.card.askedBefore}
                  <strong className="font-medium">{WORDS.card.found}</strong>
                  {WORDS.card.askedAfter}
                </p>
                <p className="flex shrink-0 gap-[14px] font-medium text-[var(--green)]">
                  <span>{WORDS.card.confirm}</span>
                  <span>{WORDS.card.notRight}</span>
                </p>
              </div>
            </div>

            {/* `pointer-events-none` on the button: PRIMARY_SMALL carries a hover colour, and a
                hover state on something that cannot be pressed is a promise the page cannot
                keep. */}
            <div className={`${SIDES} pb-5`}>
              <div className="mt-3 flex flex-wrap items-center gap-[18px] border-t border-[var(--line)] pt-3">
                <span className={`${PRIMARY_SMALL} pointer-events-none`}>
                  {WORDS.card.checklist}
                </span>
                <span className="text-[13px] text-[var(--ink-soft)]">{WORDS.card.draft}</span>
                <span className="text-[13px] text-[var(--ink-soft)]">{WORDS.card.print}</span>
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
        <AskBox
          file={WORDS.file}
          typed={WORDS.typed}
          attach={WORDS.attach}
          label="Read it"
        />
        <p className="max-w-[44ch] text-[15px] leading-[1.55] text-[var(--ink-soft)]">
          {WORDS.under}
        </p>
      </div>
    </Frame>
  )
}
