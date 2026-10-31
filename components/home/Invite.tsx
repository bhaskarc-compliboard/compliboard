// THE PRICE LIVES IN THE CODE, SO THIS PANEL READS IT RATHER THAN PRINTING IT. `PLAN_PRICE` ('$199') and `PLAN_PERIOD` ('a month') are `lib/billingView.ts:47`–`:48`, the product's list price for a company with no subscription, and the header above them (`:33`–`:35`) carries the standing warning: if the plan's price changes in Stripe, that line must change in the same commit. Importing it means this page changes with it. The module is safe to import from a page — `lib/billingView.ts` imports only `lib/billing.ts`, which imports nothing at all, so no Stripe SDK and no server code comes with it.
// GATE F1 (Stripe live mode, docs/PUBLIC-PAGES-PLAN.md §5) — the §5 row for this panel: "the price sentences in panel 8 describe a working payment". The number is real and in code; what waits on F1 is that a person who presses Start free can actually be charged it. Walked at step 33.
// "ONE PRICE", AND NOTHING ABOUT WHO IT COVERS (the owner, 30 October 2026). Seats may be limited later, so this panel must not say "unlimited users", "everyone at your company", "the whole team" or anything of that shape, whatever the old homepage said. Note that `PLAN_NOTE` in `lib/billingView.ts:50` — the account page's own second line — DOES say "for everyone at your company": that is the app's sentence to its paying customer and is not borrowed here on purpose.
// AND NOT HERE: "nothing is deleted" and "cancel any time". The security page (step 29) carries what can be shown about the first, and the second is the account page's line, not the homepage's.
/**
 * PANEL 8 — THE INVITATION. Public pages step 24 (`docs/PUBLIC-PAGES-PLAN.md` §4 row 8,
 * decisions 9 and 12). The last thing the page says.
 *
 * *** IT IS THE HERO AGAIN, AT THE OTHER END OF THE PAGE. *** Decision 12: "The closing panel
 * matches it." So it does not use `components/home/Frame.tsx` — it has no card — and it does not
 * define a ground or a set of waves of its own. `GROUND`, `WavesLayer`, `START_HREF` and
 * `SMALL_PRINT` are imported from `components/home/Hero.tsx`, which is where they were written,
 * so the two ends of the page cannot drift apart: one gradient, one drawing, one address, one
 * promise about the trial.
 *
 * The headline is 56px where a panel's is 44px — one size up (`DESIGN.md` §1's scale), because
 * it is the page's last sentence and there is nothing after it to balance against.
 */
import { PRIMARY_LARGE } from '@/components/buttonStyles'
import { PLAN_PRICE, PLAN_PERIOD } from '@/lib/billingView'
import { EDGES } from './Frame'
import { GROUND, SMALL_PRINT, START_HREF, WavesLayer } from './Hero'

/** EVERY WORD THIS PANEL SHOWS, IN ONE PLACE — except the price, which is read (see the top). */
const WORDS = {
  eyebrow: 'Start',
  headline: 'Start with the folder you have.',
  first: 'Drop in the permits, the plans and the handbook, as they are. Ask anything.',
  second:
    'CompliBoard reads what you have and tells you what to fix, what is due, and where you ' +
    'stand with each agency.',
  button: 'Start free',
  /** "$199 a month after the trial. One price." — the first three words are the product's. */
  price: `${PLAN_PRICE} ${PLAN_PERIOD} after the trial. One price.`,
}

export default function Invite() {
  return (
    <section
      id="start"
      data-public-section="start"
      className="home-screen relative flex items-center overflow-hidden py-20 lg:py-24"
      style={{ background: GROUND }}
    >
      <WavesLayer />

      {/* `relative z-10`: the words sit over the drawing, as they do in the hero. */}
      <div className={`${EDGES} relative z-10`}>
        <div className="flex max-w-[640px] flex-col gap-7">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--green-ink)]">
            {WORDS.eyebrow}
          </p>

          <h2 className="max-w-[16ch] font-serif text-[38px] leading-[1.1] text-[var(--ink)] lg:text-[56px]">
            {WORDS.headline}
          </h2>

          <p className="text-[18px] leading-[1.55] text-[var(--ink)]">{WORDS.first}</p>
          <p className="text-[18px] leading-[1.55] text-[var(--ink-soft)]">{WORDS.second}</p>

          {/* The hero's own button row: on a phone the button takes its own row and the small
              print sits under it; from 1024px up they are one line, 18px apart. */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:gap-[18px]">
              <a href={START_HREF} className={PRIMARY_LARGE}>
                {WORDS.button}
              </a>
              <span className="text-[14px] text-[var(--ink-soft)]">{SMALL_PRINT}</span>
            </div>
            <p className="text-[14px] text-[var(--ink-soft)]">{WORDS.price}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
