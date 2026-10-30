/**
 * THE PANEL FRAME — public pages step 14 (`docs/PUBLIC-PAGES-PLAN.md` §2 rule 6, decision 6).
 *
 * Every story panel is the same shape: the moment on the left in the person's own words, what
 * CompliBoard gives back on the right as a drawn card. This file holds that shape and **no
 * words at all** — the rule is one file per panel, each holding its own sentence and its own
 * card, so the frame can be changed once for nine panels without touching a single sentence.
 *
 * THE EDGES ARE EXPORTED, NOT COPIED. `EDGES` below is the one box the whole public surface
 * aligns to: the nav, every panel and the footer import it, so the wordmark, each panel's first
 * word and the footer's first word sit at the same x at every width. Three copies of a padding
 * literal is how that alignment goes quietly wrong (`DESIGN.md` §3 — alignment on two edges is
 * most of what makes a page look deliberate).
 *
 * FULL SCREEN ON A LAPTOP, NATURAL STACKING ON A PHONE (decision 6). At 1024px and up the
 * section is at least a screen tall (`.home-screen` in `app/globals.css`, which carries the
 * `100vh` → `100svh` fallback) with its content vertically centred, and the grid is 5fr of text
 * to 6fr of card with a 64px gutter. Below 1024px no height is forced, the two become one
 * column with the words above the card, and the edges go to 16px.
 */
import type { ReactNode } from 'react'
import Waves from './Waves'

/**
 * The public pages' content box: 1200px centred, 120px side edges on a laptop, 16px below.
 * `box-sizing: border-box` is global (`app/globals.css`), so the padding is INSIDE the 1200 —
 * at 1440 the first glyph is at x=240, at 1280 at x=160, at 390 at x=16.
 */
export const EDGES = 'mx-auto w-full max-w-[1200px] px-4 lg:px-[120px]'

export default function Frame({
  children,
  card,
  tone = 'grey',
  id,
  waves = true,
}: {
  /** The left-hand column: the panel's own headline, its box, its words. */
  children: ReactNode
  /** The right-hand column: the panel's drawn card. */
  card: ReactNode
  /** The alternating page rhythm (decision 6): `grey` is `--page`, `white` is `--surface`. */
  tone?: 'grey' | 'white'
  /** The section anchor, so the hero's three lines can point at a panel. */
  id?: string
  /** The two pale waves behind the card. Off for a panel that needs a quiet right side. */
  waves?: boolean
}) {
  return (
    <section
      id={id}
      data-public-section={id ?? 'panel'}
      className={`home-screen relative flex items-center overflow-hidden py-16 lg:py-24 ${
        tone === 'grey' ? 'bg-[var(--page)]' : 'bg-[var(--surface)]'
      }`}
    >
      {/* THE WAVES ARE THE SECTION'S, NOT THE COLUMN'S — changed at step 16, and the reason is
          the drawing's own shape. They used to hang off the right-hand column, which kept them
          off the text by construction; what that cannot do is hide the BOTTOM of the drawing.
          Step 15c's `faint` pair is a drawing with its own aspect that ends at its own baseline
          (`xMaxYMax meet`), and a column ends wherever its card ends — so the first render of
          this panel put a flat pale edge across the middle of the section, in mid-air, which is
          the same defect the waves' right edge had at step 14.
          Anchored to the section instead: the right reaches 240px past the page and the bottom
          hangs 11% of the section's height BELOW it, so both ends are cut by `overflow-hidden`
          at every width. It starts at the halfway mark, which is still well right of the text
          (the words have 5fr of 11 inside a box with a 120px edge), so it cannot drift under
          them either.
          *** AND THE LEFT END IS FADED, BECAUSE `meet` ALWAYS LEAVES ONE EDGE ON THE PAGE. ***
          `meet` fits the whole drawing inside its box, which means the drawing has a left edge
          and it is somewhere on the screen — and the fill is not zero-height there, so it is a
          straight vertical step. Measured in the screenshot at 1440 before this was added:
          #EAF3ED against #F7F8FA, 88px tall, at x=714, which is the box's own left edge. No
          amount of moving the box fixes that (the drawing's width follows its height, so the
          edge moves with the box), so the left 200px of the drawing is masked out instead. The
          -webkit- copy is for Safari before 15.4; where neither is supported the backdrop simply
          has the faint edge back, which is the right way round for a decoration. */}
      {waves && (
        <div
          aria-hidden="true"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 200px)',
            maskImage: 'linear-gradient(to right, transparent 0, black 200px)',
          }}
          className="pointer-events-none absolute right-[-240px] bottom-[-11%] left-1/2 h-[76%]"
        >
          <Waves faint />
        </div>
      )}

      {/* `relative z-10`: the words and the card are over the drawing. */}
      <div className={`${EDGES} relative z-10`}>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[5fr_6fr]">
          {/* `min-w-0` on both: a grid column's default minimum is its content, so one long
              unbroken string in either side would widen the column and push the other out of
              the box rather than wrapping inside it. */}
          <div className="min-w-0">{children}</div>
          <div className="min-w-0">{card}</div>
        </div>
      </div>
    </section>
  )
}
