/**
 * THE HOMEPAGE — `docs/PUBLIC-PAGES-PLAN.md` §6 step 25, decision 11. It served at
 * `/preview-home` from step 14 until the swap on 2 November 2026, and this file IS that file,
 * moved: `git mv app/preview-home/page.tsx app/page.tsx`, with the old marketing page,
 * `components/HomepageSection.tsx` and the three images only it loaded deleted in the same
 * commit.
 *
 * This file is the ORDERED LIST OF PANELS and nothing else (§2 rule 6). Every sentence and
 * every card lives in its own file under `components/home/`; nothing is written here, so the
 * order of the story can be changed by moving one line.
 *
 * *** THE `robots: { index: false, follow: false }` EXPORT CAME OFF, AND IT WAS THE FIRST EDIT
 * OF THE SWAP. *** It is why the page could grow in public for three weeks — nothing linked to
 * it, so nobody arrived, and no crawler kept it. Shipping it with the export still on would have
 * made the real homepage unindexable, which is the quietest launch failure there is: there is no
 * `app/robots.ts` and no `public/robots.txt` in this project to contradict it and nothing that
 * would warn. `docs/reports/public-pages-13-map.md` §8 item 1 named it as the first thing step 25
 * does, and the version of this comment written at step 14 said the same in capitals.
 *
 * **Four pages DO still carry that export, deliberately:** `/privacy`, `/terms`, `/security` and
 * `/faq` are honest stubs until their words are written (step 25a; steps 27–30 take the export
 * off, one page at a time). The footer links to all four, which is why 25a came first.
 *
 * The description below is the hero's own turn sentence, imported from
 * `components/home/Hero.tsx` rather than typed again — a search result and a shared link show one
 * sentence, and it should be the sentence the page opens with, in the same words, the day either
 * is reworded.
 */
import type { Metadata } from 'next'
import Nav from '@/components/home/Nav'
import Hero, { TURN } from '@/components/home/Hero'
import AuditPanel from '@/components/home/AuditPanel'
import BinderPanel from '@/components/home/BinderPanel'
import QuestionPanel from '@/components/home/QuestionPanel'
import ChecklistPanel from '@/components/home/ChecklistPanel'
import DocumentsPanel from '@/components/home/DocumentsPanel'
import CalendarPanel from '@/components/home/CalendarPanel'
import HRPanel from '@/components/home/HRPanel'
import Invite from '@/components/home/Invite'
import Footer from '@/components/home/Footer'

export const metadata: Metadata = {
  title: 'CompliBoard',
  description: TURN,
}

export default function HomePage() {
  return (
    <main className="bg-[var(--surface)]" data-public-page="home">
      <Nav />
      {/* The panels, in the order of `docs/PUBLIC-PAGES-PLAN.md` §4. Step 23 is struck, so the
          invitation closes the page. The tones alternate — documents grey, calendar white, HR
          grey (decision 6) — and the closing panel is the hero's light ground again
          (decision 12), which is why it carries no tone of its own. */}
      <Hero />
      <AuditPanel />
      <BinderPanel />
      <QuestionPanel />
      <ChecklistPanel />
      <DocumentsPanel />
      <CalendarPanel />
      <HRPanel />
      <Invite />
      <Footer />
    </main>
  )
}
