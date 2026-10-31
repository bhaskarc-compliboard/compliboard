/**
 * THE HERO — public pages step 15 (`docs/PUBLIC-PAGES-PLAN.md` panel 1, decisions 7 and 12).
 *
 * Words only, no image (decision 7): the headline, four lines lifted from the panels further
 * down, the turn sentence, and one button. It is the one panel that does NOT use
 * `components/home/Frame.tsx`, because it has no card — the frame is a sentence on the left and
 * a card on the right, and this is a single column.
 *
 * LIGHT, NOT A DARK ROOM (decision 12, 30 October). White fading to the app's `--green-wash`,
 * the four green waves rising across the bottom, ink words with the headline's second sentence
 * in the product's own green. The dark green room and the inverse wordmark were dropped.
 *
 * *** IT REACHES UP UNDER THE NAV, AND THAT IS WHAT `-mt-[72px] pt-[72px]` IS FOR. *** The nav
 * is 72px tall, in the ordinary flow of the page and with no background of its own, so the
 * gradient has to start at the very top of the document or there would be a 72px band of plain
 * page above it — a line across the top of the page that the design does not have. The negative
 * margin pulls this section up by exactly the nav's height and the padding puts the content
 * back, so the nav sits ON the gradient (`components/home/Nav.tsx` is `z-30`, so its words stay
 * above it) and the section's own box is still a full screen tall.
 *
 * *** THE FOUR LINES POINT AT PANELS THAT DO NOT EXIST YET. *** `#audit`, `#binder`,
 * `#calendar` and `#hr` are the section ids steps 16, 17, 21 and 22 will give those panels
 * (`docs/PUBLIC-PAGES-PLAN.md` §6). Until then the four links move nobody: a same-page anchor
 * with no target leaves the page where it is, which is the quietest possible failure and is why
 * they are written now rather than wired later and forgotten.
 */
import { PRIMARY_LARGE } from '@/components/buttonStyles'
import { TRIAL_DAYS } from '@/lib/billing'
import { EDGES } from './Frame'
import Waves from './Waves'

/**
 * *** THE GROUND, THE WAVES, THE BUTTON'S ADDRESS AND THE SMALL PRINT ARE EXPORTED FROM HERE. ***
 * The closing panel (`components/home/Invite.tsx`, step 24) is the hero again at the other end of
 * the page — decision 12: "The closing panel matches it." Two copies of a gradient is two
 * gradients the day one of them is adjusted, and two copies of "14 days. No card." is two
 * promises the day the trial changes. So they live once, here, where the hero was built, and the
 * closing panel imports them.
 */
export const GROUND = 'linear-gradient(120deg, #FFFFFF 0%, #F6FBF7 50%, var(--green-wash) 100%)'
/** Where both Start buttons go. */
export const START_HREF = '/signup'
/**
 * The line beside both Start buttons, with the trial's length READ rather than typed.
 * `TRIAL_DAYS` is `lib/billing.ts:53`, the one place the number lives — the SQL default on
 * `companies.trial_ends_at` is the same number and migration 087's check 10 is what stops the
 * two drifting. The price on the closing panel is read from `lib/billingView.ts` for the same
 * reason (step 24); the trial was still a literal until step 12 noticed. `lib/billing.ts`
 * imports nothing at all, so nothing travels with it.
 *
 * "No card" is the other half and is a fact about the trial, not a number: a company with no
 * card is a normal, working state for the whole of it (`lib/billingView.ts:490`, "No card yet",
 * and `lib/billing.ts:130`, where the trial is consulted before anything else is).
 */
export const SMALL_PRINT = `${TRIAL_DAYS} days. No card.`

/**
 * THE WAVES ARE THE WHOLE SECTION, NOT A STRIP ALONG THE BOTTOM (step 15c). The board's bands
 * nest into the bottom-right corner and one of them reaches the top-right, so the drawing is
 * sized to the section and cropped by its `overflow-hidden`, not fitted into a 150/320px box.
 * The two sets are the same four bands drawn for the two shapes of screen: a 1440x900 curve
 * squeezed into a 390-wide phone is not the same curve. Each is in its own wrapper so the display
 * utility sits on a div and never argues with the svg's own `block`
 * (`components/buttonStyles.ts` has the long version of why that matters).
 *
 * The caller's section must be `relative overflow-hidden`, which is what crops both sets.
 */
export function WavesLayer() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 hidden lg:block">
        <Waves full />
      </div>
      <div className="absolute inset-0 lg:hidden">
        <Waves full phone />
      </div>
    </div>
  )
}

/**
 * The four lines, in the order the panels come in. Each is one moment, in the words of the
 * person who does compliance on top of two other jobs (`PUBLIC-PAGES-PLAN.md` §4).
 */
const LINES: { text: string; href: string }[] = [
  { text: 'The inspector is coming Thursday.', href: '#audit' },
  { text: 'The customer wants our audit binder by Friday.', href: '#binder' },
  { text: 'The permit expired in March. You found out in June.', href: '#calendar' },
  { text: 'The handbook says 30 days. The state says 14.', href: '#hr' },
]

export default function Hero() {
  return (
    <section
      data-public-section="hero"
      className="home-screen relative -mt-[72px] flex items-center overflow-hidden pt-[72px] pb-20 lg:pb-0"
      style={{ background: GROUND }}
    >
      <WavesLayer />

      {/* `relative z-10`: the words sit over the drawing. A positioned sibling would paint above
          an earlier one anyway, but the z-index says it rather than relying on source order. */}
      <div className={`${EDGES} relative z-10`}>
        {/* 980 inside the 120px edges. At 1440 the box's own 1200 less its edges is already 960,
            so this caps nothing there and everything above about 1460. */}
        <div className="flex max-w-[980px] flex-col gap-10">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--green-ink)]">
            For the person who does compliance on top of everything else
          </p>

          <h1 className="max-w-[24ch] font-serif text-[38px] leading-[1.1] text-[var(--ink)] lg:text-[60px]">
            Compliance is your job. <span className="text-[var(--green)]">It’s also your third one.</span>
          </h1>

          {/* WEIGHT 400, NOT 300, AND IT IS READ FROM THE FONT RATHER THAN CHOSEN. Source Serif 4
              is self-hosted and declared at 400 and 600 only (`app/layout.tsx:172`–`:173`); there
              is no 300 face in this project, so asking for 300 would either snap back to 400 or,
              worse, invite a browser to synthesise one. 400 is what the font has. */}
          <div className="flex flex-col gap-3 border-l-2 border-[var(--wave-1)] pl-[22px]">
            {LINES.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="font-serif text-[20px] font-normal leading-snug text-[var(--ink-soft)] no-underline lg:text-[26px]"
              >
                {l.text}
              </a>
            ))}
          </div>

          <p className="max-w-[54ch] text-[16px] leading-[1.55] text-[var(--ink)] lg:text-[18px]">
            CompliBoard has read the whole cabinet. It knows what to fix, what is due, and where you
            stand with each agency.
          </p>

          {/* On a phone the button takes its own row and the small print sits under it; from
              1024px up they are one line, 18px apart. */}
          <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:gap-[18px]">
            <a href={START_HREF} className={PRIMARY_LARGE}>
              Start free
            </a>
            <span className="text-[14px] text-[var(--ink-soft)]">{SMALL_PRINT}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
