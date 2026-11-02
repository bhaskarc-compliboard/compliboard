/**
 * THE CONTENT PAGE FRAME — public pages step 25a (`docs/PUBLIC-PAGES-PLAN.md` §6 step 25a).
 *
 * The four content pages (`/privacy`, `/terms`, `/security`, `/faq`) and the later `/contact`
 * (step 30a) are all the same shape: the public nav, a title, one optional line under it, the
 * page's own words, the public footer. That shape lives here once, so Part C writes words and
 * never a layout — and so the nav, the title and the footer sit on the same two edges as every
 * panel of the homepage.
 *
 * *** IT HOLDS NO WORDS OF ITS OWN. *** Everything a visitor reads is passed in by the page
 * file: `title`, the optional `lead`, and the body. That is the same rule `components/home/
 * Frame.tsx` follows for the homepage's panels (§2 rule 6, one file per page's sentences), and
 * it is what makes steps 27–30 a change to four page files and nothing else.
 *
 * WHITE, NOT PAGE-GREY, AND IT IS ONE GROUND FOR ALL FOUR. `components/home/Footer.tsx` is
 * already `--surface`, so white means the page and its footer are a single sheet with one rule
 * across it rather than two tones meeting at a seam that carries no meaning. The homepage
 * alternates grey and white because it has eight panels to separate (decision 6); a content page
 * has nothing to separate.
 *
 * THE TITLE IS A PANEL'S HEADLINE, NOT THE HERO'S. 32px rising to 44px in Source Serif 4 — the
 * size every `h2` on the homepage is set at (`components/home/AuditPanel.tsx:248` and the six
 * panels beside it), and the serif because `DESIGN.md` §1 gives the serif to "anything someone
 * reads at length, and the page title". The hero's own 60px and the closing panel's 56px are the
 * two ends of the homepage and are deliberately one and two steps above this: a policy page is a
 * document with a heading, not a pitch.
 *
 * *** `min-h-[100svh]` RATHER THAN `.home-screen`, AND BOTH HALVES OF THAT MATTER. *** The floor
 * is what stops the footer riding up the screen on a page holding one sentence — with the body
 * `flex-1` inside a column, the footer is pushed to the bottom of the viewport and sits under the
 * content on a long page instead. `.home-screen` (`app/globals.css:53`) is NOT the thing to reuse
 * here: it is wrapped in `@media (min-width: 1024px)` on purpose, because a homepage panel stacks
 * naturally on a phone — and a one-line page needs the floor at 390 most of all. `svh` is the
 * small viewport, so a phone's own toolbars cannot push the footer under the fold, and it is ONE
 * declaration: `min-h-screen` beside it would be two utilities for one property, and which of
 * those wins is the emit order's decision (the long version is in `app/globals.css:46`–`:48`).
 * Where `svh` is unsupported no height is forced and the footer simply follows the sentence,
 * which is a short page rather than a broken one.
 */
import type { ReactNode } from 'react'
import { EDGES } from './Frame'
import Nav from './Nav'
import Footer from './Footer'

export default function PageShell({
  title,
  lead,
  children,
}: {
  /** The page's heading, and its only required word. */
  title: string
  /**
   * One line under the heading, for a page that opens with one — the privacy page's scope
   * sentence, say. Unused by the four stubs, whose single sentence is their body (step 25a item
   * 3); it is here for steps 27–30 and 30a, which is also when it first gets measured.
   */
  lead?: string
  /** The page's words. */
  children?: ReactNode
}) {
  return (
    <main
      data-public-page="content"
      className="flex min-h-[100svh] flex-col bg-[var(--surface)]"
    >
      <Nav />

      {/* `flex-1` is what holds the footer down: the body takes whatever height is left over, so
          on a short page the footer is at the bottom of the screen and on a long one it follows
          the words. The top padding is clear air under the nav, which is 72px tall and in the
          ordinary flow of the page (`components/home/Nav.tsx`) — nothing has to be reserved for
          it, only breathed after. */}
      <div className="flex-1">
        <div className={`${EDGES} pt-12 pb-20 lg:pt-20 lg:pb-28`}>
          <h1 className="max-w-[22ch] font-serif text-[32px] leading-[1.12] text-[var(--ink)] lg:text-[44px]">
            {title}
          </h1>

          {lead && (
            <p className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-[var(--ink-soft)]">
              {lead}
            </p>
          )}

          {/* THE BODY'S TYPE IS SET ONCE, HERE, AND INHERITED. The page files pass plain
              paragraphs with no classes of their own — four copies of a size and a measure is
              four places to change the day the reading size changes, and the one thing this file
              exists to prevent. */}
          {children && (
            <div className="mt-8 max-w-[62ch] text-[18px] leading-[1.6] text-[var(--ink)]">
              {children}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  )
}
