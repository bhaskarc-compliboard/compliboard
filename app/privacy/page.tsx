/**
 * /privacy — A STUB, AND HONESTLY ONE. Public pages step 25a (`docs/PUBLIC-PAGES-PLAN.md` §6
 * step 25a). **The words are written at step 27**, after the remaining app work: what this page
 * may claim depends on what the app does the day it ships, and the app is still being finished
 * (Part C, deferred 2 November on the owner's word). Step 27a, the privacy map, is the first
 * move when it resumes.
 *
 * What could not wait is that the homepage's footer links here (`components/home/Footer.tsx`),
 * so this page exists now and says one true thing instead of nothing or a promise.
 *
 * *** THE ROBOTS EXPORT COMES OFF WHEN THE WORDS GO IN. *** It is the last line of step 27. An
 * empty page that Google has indexed as "Privacy policy" is worse than no page at all: the index
 * keeps the empty one and shows it to the person searching for the real one.
 *
 * AND WHEN THE WORDS DO GO IN THEY ARE A STARTING POINT FOR A LAWYER (decision 8). That note
 * belongs in this comment and in `docs/LEGAL-REVIEW.md`, which does not exist yet and is written
 * with the words — never on the page, where it would read as a disclaimer about the product.
 */
import type { Metadata } from 'next'
import PageShell from '@/components/home/PageShell'

export const metadata: Metadata = {
  title: 'Privacy policy · CompliBoard',
  robots: { index: false, follow: false },
}

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy policy">
      <p>
        We are writing this before CompliBoard opens to customers. It will say exactly what we
        collect, where it is kept, who else sees it, and how to get it back or delete it.
      </p>
    </PageShell>
  )
}
