/**
 * THE PUBLIC NAV — public pages step 14.
 *
 * 72px tall, on the public content box's two edges (`EDGES`, `components/home/Frame.tsx`), so
 * the wordmark starts at the same x as every panel's first word and the footer's.
 *
 * NO BACKGROUND OF ITS OWN, ON PURPOSE. The hero is a light gradient with the waves across its
 * bottom (decision 12) and the nav sits ON it; a white bar above the gradient would draw a line
 * across the top of the page that the design does not have. It is `relative z-30` so it paints
 * above whatever the first panel is, and the hero pulls itself up underneath it.
 *
 * The button is `PRIMARY` from `components/buttonStyles.ts`, imported and not copied
 * (`DESIGN.md` §4: new code imports this file; it never copies a string). "Sign in" beside it is
 * a text link, not a second button — three bordered boxes in a row is three boxes.
 */
import { PRIMARY } from '@/components/buttonStyles'
import { EDGES } from './Frame'

/**
 * THE WORDMARK, and it is text rather than an image — it has to be selectable, it has to scale,
 * and it must not cost a request. The green is the product's own token; the orange is the
 * marketing orange from the owner's Framer hero (#F94300) and is deliberately NOT a token: no
 * app screen uses it, and a token the app does not use is a colour waiting to leak into it.
 *
 * Exported so `Footer.tsx` draws the same wordmark from the same place rather than a copy of it.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <a
      href="/"
      className={`text-[20px] font-medium tracking-tight ${className}`}
      aria-label="CompliBoard home"
    >
      <span style={{ color: 'var(--green)' }}>Compli</span>
      <span style={{ color: '#F94300' }}>Board</span>
    </a>
  )
}

export default function Nav() {
  return (
    <header className="relative z-30">
      <div className={`${EDGES} flex h-[72px] items-center justify-between gap-4`}>
        <Wordmark />
        <div className="flex items-center gap-5">
          <a
            href="/login"
            className="text-[14px] text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            Sign in
          </a>
          <a href="/signup" className={PRIMARY}>
            Start free
          </a>
        </div>
      </div>
    </header>
  )
}
