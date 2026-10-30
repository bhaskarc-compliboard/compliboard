/**
 * THE PUBLIC FOOTER — public pages step 14. One line, on the same two edges as the nav and
 * every panel (`EDGES`, `components/home/Frame.tsx`), so the last line of the page starts where
 * the first one did.
 *
 * THE FOUR LINKS ARE DEAD UNTIL PART C. `/privacy`, `/terms`, `/security` and `/faq` are
 * written at steps 27–30 of `docs/PUBLIC-PAGES-PLAN.md`; today every one of them is a 404. That
 * is acceptable here and nowhere else: this page is unlinked and `noindex` (decision 11), so
 * nobody can arrive at it, and the swap at step 25 cannot ship until Part C has run. The app's
 * own shell footer already links to two of them (`components/AppLayout.tsx:462`–`:463`), so the
 * 404s are not new and are not this step's to fix.
 *
 * The address is TEXT, not a `mailto:` — whether hello@compliboard.com receives mail is one of
 * the two things `PUBLIC-PAGES-PLAN.md` §7 is still waiting on the owner for. A link invites a
 * visitor to write to an address that may bounce; printing it states it and promises nothing.
 * It becomes a link the day the answer is yes.
 */
import { EDGES } from './Frame'
import { Wordmark } from './Nav'

const LINKS: { label: string; href: string }[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Security', href: '/security' },
  { label: 'FAQ', href: '/faq' },
]

export default function Footer() {
  return (
    <footer className="bg-[var(--surface)] py-8">
      <div
        className={`${EDGES} flex flex-col items-start gap-4 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center sm:justify-between`}
      >
        <Wordmark />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-[var(--ink-soft)]">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[var(--ink)]">
              {l.label}
            </a>
          ))}
          <span className="text-[var(--ink-faint)]">hello@compliboard.com</span>
        </div>
      </div>
    </footer>
  )
}
