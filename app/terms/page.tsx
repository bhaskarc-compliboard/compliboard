/**
 * /terms — A STUB, AND HONESTLY ONE. Public pages step 25a (`docs/PUBLIC-PAGES-PLAN.md` §6 step
 * 25a). **The words are written at step 28**, after the remaining app work (Part C, deferred
 * 2 November on the owner's word).
 *
 * What could not wait is that the homepage's footer links here (`components/home/Footer.tsx`),
 * so this page exists now and says one true thing instead of nothing or a promise.
 *
 * *** THE ROBOTS EXPORT COMES OFF WHEN THE WORDS GO IN. *** It is the last line of step 28. An
 * empty page that Google has indexed as "Terms of use" is worse than no page at all: the index
 * keeps the empty one and shows it to the person searching for the real one.
 *
 * AND WHEN THE WORDS DO GO IN THEY ARE A STARTING POINT FOR A LAWYER (decision 8). That note
 * belongs in this comment and in `docs/LEGAL-REVIEW.md`, which does not exist yet and is written
 * with the words — never on the page, where it would read as a disclaimer about the product.
 */
import type { Metadata } from 'next'
import PageShell from '@/components/home/PageShell'

export const metadata: Metadata = {
  title: 'Terms of use · CompliBoard',
  robots: { index: false, follow: false },
}

export default function TermsPage() {
  return (
    <PageShell title="Terms of use">
      <p>We are writing this before CompliBoard opens to customers.</p>
    </PageShell>
  )
}
