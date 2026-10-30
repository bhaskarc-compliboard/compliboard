/**
 * THE NEW HOMEPAGE, BUILT BESIDE THE OLD ONE — `docs/PUBLIC-PAGES-PLAN.md` decision 11.
 *
 * This file is the ORDERED LIST OF PANELS and nothing else (§2 rule 6). Every sentence and
 * every card lives in its own file under `components/home/`; nothing is written here, so the
 * order of the story can be changed by moving one line.
 *
 * WHY IT IS NOT `/`. The old marketing page at `app/page.tsx` keeps serving `/` until step 25,
 * so this one can be pushed to production as it grows and looked at on a real phone, without a
 * half-built homepage ever being the first thing a visitor sees. Two things keep it private, and
 * they are different kinds of thing: **nothing links to it** (so nobody arrives), and it sends
 * **`noindex, nofollow`** (so no crawler keeps it). The second is the one that matters, because
 * a link somewhere one day is a mistake and an indexed half-built homepage is a lasting one.
 *
 * *** AND THE ROBOTS LINE MUST COME OFF AT STEP 25. *** When this file becomes `app/page.tsx`
 * the export below would ship the real homepage as unindexable — the quietest launch failure
 * there is. There is no `app/robots.ts` and no `public/robots.txt` in this project to contradict
 * it and nothing that would warn. `docs/reports/public-pages-13-map.md` §8 item 1 records it as
 * the first thing step 25 does.
 */
import type { Metadata } from 'next'
import Nav from '@/components/home/Nav'
import Hero from '@/components/home/Hero'
import AuditPanel from '@/components/home/AuditPanel'
import BinderPanel from '@/components/home/BinderPanel'
import QuestionPanel from '@/components/home/QuestionPanel'
import ChecklistPanel from '@/components/home/ChecklistPanel'
import Footer from '@/components/home/Footer'

export const metadata: Metadata = {
  title: 'CompliBoard',
  robots: { index: false, follow: false },
}

export default function PreviewHomePage() {
  return (
    <main className="bg-[var(--surface)]" data-public-page="preview-home">
      <Nav />
      {/* The panels, in the order of `docs/PUBLIC-PAGES-PLAN.md` §4. Steps 20 to 24 fill in the
          rest: documents and the fix, calendar, HR, where we are, the invitation to trial. */}
      <Hero />
      <AuditPanel />
      <BinderPanel />
      <QuestionPanel />
      <ChecklistPanel />
      <Footer />
    </main>
  )
}
