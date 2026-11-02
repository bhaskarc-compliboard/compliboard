/**
 * THE PUBLIC FOOTER — public pages step 14. One line, on the same two edges as the nav and
 * every panel (`EDGES`, `components/home/Frame.tsx`), so the last line of the page starts where
 * the first one did.
 *
 * *** THE FOUR LINKS REACH REAL PAGES AS OF STEP 25a (2 November 2026). *** `/privacy`,
 * `/terms`, `/security` and `/faq` are four routes built on `components/home/PageShell.tsx`,
 * each one sentence saying it is being written before launch and each `noindex` until its words
 * go in. Their words come at steps 27–30 of `docs/PUBLIC-PAGES-PLAN.md`, after the remaining app
 * work (Part C, deferred 2 November). This note used to say every one of them was a 404, which
 * was true until step 25a and is the reason the swap at step 25 had to wait for it. The app's own
 * shell footer links to two of them (`components/AppLayout.tsx:462`–`:463`), so those two pages
 * fix older debt as well — every signed-in person has had those links since the shell was built.
 *
 * *** AND THERE IS NO EMAIL ADDRESS HERE, BY DECISION 13 (31 October 2026). *** This footer
 * printed `hello@compliboard.com` as text until step 25a took it off: the address does not
 * exist, and the owner has run public mailboxes before — "thousands of fake emails" — so nothing
 * on the public pages is a `mailto:` or a printed address. Nothing replaces it yet; `/contact`,
 * a short form with a bot check that delivers to an address nobody publishes, is step 30a.
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
        </div>
      </div>
    </footer>
  )
}
