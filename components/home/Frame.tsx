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
      <div className={EDGES}>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[5fr_6fr]">
          {/* `min-w-0` on both: a grid column's default minimum is its content, so one long
              unbroken string in either side would widen the column and push the other out of
              the box rather than wrapping inside it. */}
          <div className="min-w-0">{children}</div>
          <div className="relative min-w-0">
            {/* THE WAVES SIT INSIDE THE RIGHT-HAND COLUMN, which is what keeps them off the
                text: absolute positioning is resolved against this column's own box, so there
                is no width at which they can drift under the words. Low and right — the bottom
                of the column, and reaching 240px PAST its right edge so that at 1440 and at 1280
                the band runs off the side of the screen and is cut by the section's
                `overflow-hidden`. The first draft stopped at the page's 120px margin, and the
                probe screenshot showed what that is: a hard vertical edge in mid-air, which
                reads as a bug rather than as a backdrop. */}
            {waves && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-[-240px] bottom-[-48px] left-0 h-[62%]"
              >
                <Waves faint />
              </div>
            )}
            {/* `relative` with no z-index: a positioned sibling paints above an earlier one, so
                the card is over the waves without starting a z-index argument. */}
            <div className="relative">{card}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
