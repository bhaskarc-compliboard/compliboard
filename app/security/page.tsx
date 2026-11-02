/**
 * /security — A STUB, AND HONESTLY ONE. Public pages step 25a (`docs/PUBLIC-PAGES-PLAN.md` §6
 * step 25a). **The words are written at step 29**, after the remaining app work (Part C,
 * deferred 2 November on the owner's word) — and this page in particular cannot be written
 * early, because it may say only what can be shown.
 *
 * What could not wait is that the homepage's footer links here (`components/home/Footer.tsx`),
 * so this page exists now and says one true thing instead of nothing or a promise.
 *
 * *** THE ROBOTS EXPORT COMES OFF WHEN THE WORDS GO IN. *** It is the last line of step 29. An
 * empty page that Google has indexed as "Security" is worse than no page at all: the index keeps
 * the empty one and shows it to the person searching for the real one.
 */
import type { Metadata } from 'next'
import PageShell from '@/components/home/PageShell'

export const metadata: Metadata = {
  title: 'Security · CompliBoard',
  robots: { index: false, follow: false },
}

export default function SecurityPage() {
  return (
    <PageShell title="Security">
      <p>
        We are writing this before CompliBoard opens to customers. It will say only what we can
        show you — how your company’s data is kept apart from everyone else’s, and where your
        files live.
      </p>
    </PageShell>
  )
}
