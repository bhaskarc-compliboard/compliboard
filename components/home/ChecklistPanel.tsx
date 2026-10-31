// SAMPLE TEXT — the item wording is in the product's voice and stays sample (§2 rule 2, as narrowed on 30 Oct: the industries rotate, so there is no one fixture to run). The RULES are not sample and were read again at the AGENCIES' OWN TEXT on 30 October 2026, which is the change step 12 made to this note — the first draft cited Cornell for both:
//   · 42 CFR 418.76, "Condition of participation: Hospice aide and homemaker services", https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-418/subpart-C/section-418.76 — (b) "Classroom and supervised practical training combined must total at least 75 hours" with "A minimum of 16 hours of classroom training must precede" the practical part; (c) an aide may furnish services "only after" the competency evaluation; (h) an on-site visit "No less frequently than every 14 days" and an annual on-site observation of each aide.
//   · OAR 333-035-0210, "Criminal Records Check", Division 35 (Hospice Program Licensure), https://secure.sos.state.or.us/oard/viewSingleRule.action?ruleVrsnRsn=298768, last amended 27 January 2023 — section (2): the program "must conduct a criminal records check on a subject individual and make a fitness determination prior to employment"; section (10): "a criminal records check is performed on a SI every three years"; section (8): "a hospice program is not required to complete a background check on" a subject individual licensed by a health professional regulatory board (ORS 676.160) or a contractor whose own employer has run one. (The rule was renumbered from 333-035-0060 by PH 204-2022, which is why a search for the old number still finds it.)
// AND (g) IS GONE WITH THE THIRD MUST-DO (the owner, step 12): the card is four items, so the RN writing each patient's care instructions — 418.76(g), true and checked — is simply not one of the four any more. Nothing on the card cites it.
// Everything on this card is live today; this panel waits on no gate item.
/**
 * PANEL 3b — THE CHECKLIST. Public pages step 19 (`docs/PUBLIC-PAGES-PLAN.md` §4 row 3b,
 * decisions 5 and 10). It follows the question because it is what the answer turns into: the
 * same conversation, made into something a person can do on a Monday.
 *
 * *** THE THREE GROUPS ARE THE PRODUCT'S OWN. *** `VIEW_GROUPS` in `lib/checklistView.ts:23`–
 * `:27` is Must do (numbered, "in the order to do them · N"), Worth doing ("advice, not a legal
 * rule · N") and To confirm ("open questions · N"), in that order, and an empty group is not
 * shown. The titles here are those titles. The hints are SHORTER than the product's — "Must do,
 * in order · 2" rather than "Must do / in the order to do them · 2" — because the card is the
 * app at about two-thirds and the app prints the hint in its own column on the right.
 *
 * *** THE SHORTENINGS ARE THE OWNER'S, DECIDED AT STEP 12 (30 October 2026). *** This note used
 * to say step 12 would decide whether to print the product's hint exactly. It decided not to: the
 * step 12 instruction writes the three counts out as "Must do, in order · 2", "Worth doing · 1",
 * "To confirm · 1" and the header as "1 of 4 done". So both shortenings stand and neither is an
 * accident. The one to remember is the header's, because it is not only shorter but counts
 * something else: the app's "1 of 2 must-dos done" (`mustDoLabel`, `lib/checklistView.ts:74`)
 * counts MUST DO ONLY, and "1 of 4 done" counts all four items — as the bar below it does.
 *
 * *** EVERY BOX AT ONE X, WHICH IS THE WHOLE REASON THE ROW IS A GRID. *** `DESIGN.md` §4, and
 * `app/compliance/page.tsx:1540` says it in the app's own words: "the checkbox is the first child
 * at a fixed size, so every one sits at the same x and every text block indents to the same left
 * margin." A 20px first column does that here whatever the row holds — a wash, an opened block of
 * steps, or nothing.
 *
 * FOUR ITEMS, NOT SIX (the owner, step 12). The card was too long beside the panel's own words —
 * `docs/PUBLIC-PAGES-PLAN.md` §6 step 6 carries the note — so one must-do and one piece of advice
 * came off. What is left is still every group the view has and still one item opened, which is
 * the whole argument of the panel: the steps, each with the page it came from.
 *
 * White, because the question panel before it is grey (decision 6).
 */
import Frame from './Frame'
import AskBox from './AskBox'
import { PRIMARY_SMALL } from '@/components/buttonStyles'

/**
 * EVERY WORD THIS PANEL SHOWS, IN ONE PLACE — see the SAMPLE TEXT note at the top. A hospice in
 * Bend: the industries rotate across the panels (decision 4), and this is the shape of question
 * the checklist is for — a date, two people, and a rule in two places at once.
 */
const WORDS = {
  eyebrow: 'Compliance Workspace · the checklist',
  headline: 'Two aides start Monday. What has to be in place first?',
  typed:
    'We’re a hospice in Bend. Two hospice aides start Monday. Make me a checklist of what has ' +
    'to be done before their first home visit, in order.',
  attach: 'Attach a file and ask any compliance question about it',
  under:
    'Must do, in order. Worth doing. To confirm. Every item has “How do I do this?” — the ' +
    'steps, each with the page it came from.',
  card: {
    kicker: 'Checklist',
    progress: '1 of 4 done · sample company',
    title: 'Before two new aides make their first visit',
    howTo: 'How do I do this?',
    /** The app's ONE control on a checklist: `app/compliance/page.tsx:1523`, `printDrawer` under the
     *  word "Download". There is no "Print" on a checklist, which is what this card drew until
     *  step 12. */
    download: 'Download',
    count: 'from the conversation · 2 sources',
  },
  groups: {
    must: 'Must do, in order · 2',
    worth: 'Worth doing · 1',
    confirm: 'To confirm · 1',
  },
  items: {
    one: {
      text: 'Run the criminal records check and make the fitness determination before the hire date.',
      note: 'OAR 333‑035‑0210 · again every three years',
    },
    two: {
      text:
        'Confirm each aide’s 75‑hour training and competency evaluation, or run the evaluation ' +
        'before the first visit.',
      note: '42 CFR 418.76(b), (c)',
      steps: [
        'Ask for the certificate of a training programme of at least 75 hours, 16 of them ' +
          'classroom before 16 practical.',
        'If they trained elsewhere, have your RN run the competency evaluation and watch the ' +
          'listed tasks.',
        'File both in the aide’s record; the 12‑hour in‑service clock starts today.',
      ],
      source: 'ecfr.gov · official',
    },
    four: {
      text:
        'Put the nurse’s 14‑day home visits and the yearly observation of each aide on the ' +
        'calendar now.',
      small: '418.76(h)',
    },
    five: {
      text:
        'Is either aide licensed by a health board, a CNA for instance? That changes the records ' +
        'check.',
      small: '333‑035‑0210(8)',
    },
  },
}

/** The side padding every part of the card carries. 24px on a laptop, 16px below. */
const SIDES = 'px-4 lg:px-6'

/** The tick inside a box that is done. The app draws a ✓ character; a drawn card draws the shape. */
function Tick() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[11px] w-[11px]"
    >
      <path d="m5 13 5 5L20 7" />
    </svg>
  )
}

/**
 * ONE ITEM. The first column is 20px whatever the row holds, so the five boxes on this card sit
 * at one x and every line of text starts at one x under the others.
 */
function Item({
  box,
  wash,
  done = false,
  text,
  note,
  small,
  children,
}: {
  /** `done` is filled green; `open` is a faint outline; `confirm` borrows the amber line. */
  box: 'done' | 'open' | 'confirm'
  /** The wash behind the row. A washed row carries no hairline — the wash is the separation. */
  wash?: 'page' | 'amber'
  done?: boolean
  text: string
  /** The rule, on its own line under the item. */
  note?: string
  /** The rule, inline after the item, for the shorter rows. */
  small?: string
  /** The opened "How do I do this?" block, or the words that offer it. */
  children?: React.ReactNode
}) {
  const washed = wash === 'page' ? 'bg-[var(--page)]' : wash === 'amber' ? 'bg-[var(--amber-wash)]' : ''
  return (
    <div
      className={`grid grid-cols-[20px_1fr] items-start gap-3 py-[10px] ${
        wash ? `-mx-[10px] rounded-lg px-[10px] ${washed}` : 'border-b border-[var(--line)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded ${
          box === 'done'
            ? 'bg-[var(--green)]'
            : box === 'confirm'
              ? 'border-[1.5px] border-[var(--amber-line)]'
              : 'border-[1.5px] border-[var(--ink-faint)]'
        }`}
      >
        {box === 'done' && <Tick />}
      </span>

      <div className="min-w-0">
        <p className={`text-[14px] ${done ? 'text-[var(--ink-soft)] line-through' : 'text-[var(--ink)]'}`}>
          {text}
          {small && <span className="text-[12px] text-[var(--ink-soft)]"> {small}</span>}
        </p>
        {note && <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{note}</p>}
        {children}
      </div>
    </div>
  )
}

/** A group's heading. Green for what is required, grey for advice, amber for a question. */
function GroupLabel({ text, tone }: { text: string; tone: 'green' | 'grey' | 'amber' }) {
  return (
    <p
      className={`pt-3 pb-1 text-[12px] font-medium uppercase tracking-[0.06em] ${
        tone === 'green'
          ? 'text-[var(--green-ink)]'
          : tone === 'amber'
            ? 'text-[var(--amber-ink)]'
            : 'text-[var(--ink-soft)]'
      }`}
    >
      {text}
    </p>
  )
}

export default function ChecklistPanel() {
  return (
    <Frame
      id="checklist"
      tone="white"
      card={
        <div className="lg:flex lg:justify-center">
          <div className="w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(20,23,26,.04),0_16px_40px_rgba(20,23,26,.10)] lg:w-[520px] lg:max-w-full lg:shrink-0">
            <div className={`${SIDES} border-b border-[var(--line)] bg-[var(--page)] pt-4 pb-[14px]`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                  {WORDS.card.kicker}
                </p>
                <p className="text-[12px] text-[var(--ink-soft)]">{WORDS.card.progress}</p>
              </div>
              <p className="mt-2 text-[18px] font-medium text-[var(--ink)]">{WORDS.card.title}</p>
              {/* One of four, drawn rather than described. `w-1/4` is that fraction exactly. */}
              <div aria-hidden="true" className="mt-3 h-1 w-full rounded-sm bg-[var(--line)]">
                <div className="h-full w-1/4 rounded-sm bg-[var(--green)]" />
              </div>
            </div>

            <div className={`${SIDES} pt-3`}>
              <GroupLabel text={WORDS.groups.must} tone="green" />

              <Item box="done" done text={WORDS.items.one.text} note={WORDS.items.one.note} />

              <Item box="open" wash="page" text={WORDS.items.two.text} note={WORDS.items.two.note}>
                {/* THE OPENED BLOCK: the steps, each with the page they came from. The left rule
                    is `--wave-1`, the palest of the wave greens, so the block reads as an aside
                    of the item rather than a second item. */}
                <div className="mt-1 border-l-2 border-[var(--wave-1)] pl-3">
                  <p className="text-[12px] font-medium text-[var(--green-ink)]">
                    {WORDS.card.howTo}
                  </p>
                  {WORDS.items.two.steps.map((s, i) => (
                    <p key={i} className="mt-1 text-[13px] leading-[1.45] text-[var(--ink)]">
                      {i + 1}. {s}
                      <span className="text-[12px] text-[var(--ink-soft)]">
                        {' '}
                        · {WORDS.items.two.source}
                      </span>
                    </p>
                  ))}
                </div>
              </Item>

              <GroupLabel text={WORDS.groups.worth} tone="grey" />
              <Item box="open" text={WORDS.items.four.text} small={WORDS.items.four.small} />

              <GroupLabel text={WORDS.groups.confirm} tone="amber" />
              <Item
                box="confirm"
                wash="amber"
                text={WORDS.items.five.text}
                small={WORDS.items.five.small}
              />
            </div>

            {/* `pointer-events-none` on the button: PRIMARY_SMALL carries a hover colour, and a
                hover state on something that cannot be pressed is a promise the page cannot keep.
                Below lg the count takes a row of its own. */}
            <div className={`${SIDES} pb-5`}>
              <div className="mt-[14px] flex flex-wrap items-center gap-[18px] border-t border-[var(--line)] pt-3">
                <span className={`${PRIMARY_SMALL} pointer-events-none`}>{WORDS.card.download}</span>
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
        <AskBox typed={WORDS.typed} attach={WORDS.attach} label="Make a checklist" />
        <p className="max-w-[44ch] text-[15px] leading-[1.55] text-[var(--ink-soft)]">
          {WORDS.under}
        </p>
      </div>
    </Frame>
  )
}
