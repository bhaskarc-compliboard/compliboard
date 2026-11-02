/**
 * /faq — A STUB, AND HONESTLY ONE. Public pages step 25a (`docs/PUBLIC-PAGES-PLAN.md` §6 step
 * 25a). **The words are written at step 30**, after the remaining app work (Part C, deferred
 * 2 November on the owner's word).
 *
 * What could not wait is that the homepage's footer links here (`components/home/Footer.tsx`),
 * so this page exists now and says one true thing instead of nothing or a promise.
 *
 * THE ADDRESS IS `/faq` AND THE HEADING IS "Questions". The footer's link says FAQ because that
 * is the word a visitor looks for in a footer; the page says Questions because that is the word
 * the product uses. Both come from the plan (§6 step 30, "FAQ"; the footer's own label at
 * `components/home/Footer.tsx`).
 *
 * *** THE ROBOTS EXPORT COMES OFF WHEN THE WORDS GO IN. *** It is the last line of step 30. An
 * empty page that Google has indexed as "Questions" is worse than no page at all: the index
 * keeps the empty one and shows it to the person searching for the real one.
 */
import type { Metadata } from 'next'
import PageShell from '@/components/home/PageShell'

export const metadata: Metadata = {
  title: 'Questions · CompliBoard',
  robots: { index: false, follow: false },
}

export default function FaqPage() {
  return (
    <PageShell title="Questions">
      <p>We are writing this before CompliBoard opens to customers.</p>
    </PageShell>
  )
}
