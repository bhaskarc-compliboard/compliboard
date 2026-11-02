# Public pages — the plan

**Version:** 13 · **Updated:** 2 November 2026 — all eight boards and all eight panels built; the words check done; the four content pages as stubs and **the swap done, so the new page is `app/page.tsx`**; Part C deferred behind the app work; closed out at step 35. **Not pushed — production still serves the old page.** **Written:** 29 October 2026, in the public-pages chat.
**Supersedes:** nothing. The homepage at `app/page.tsx` is replaced whole; nothing from it is kept.
**For:** the owner, this chat, and Claude Code. One step at a time. A step is crossed off here, with its date, before the next one starts.
**Shape:** boards first (the chat draws, the owner approves), then code (Claude Code builds one board per instruction, in the same order), then the four content pages as stubs, the swap, and the domain. The content pages get their words after the remaining app work (§6, Part C).

---

## 1. What the pages are for

The homepage gives a first-time visitor a clear picture of what CompliBoard will solve for them. That is its whole job. It is told as a story: each panel is one moment in the week of the person who does compliance on top of two other jobs, in their own words on the left, and what CompliBoard gives back on the right, drawn in the product's own words.

The four other pages — privacy, terms, security, FAQ — are content pages in the same frame.

## 2. The rules every word follows

1. **True on the day of release.** The homepage goes live after the pieces it mentions are built. Seven items are its gate (see §5). Every sentence that waits on one of them is marked in its panel's file with the PENDING item it waits on, and the last step before release walks those marks against the shipped product. Nothing beyond the gate list is mentioned.
2. **The product's words.** Never "AI", never "compliant", never a score or a percentage, never "overdue" (a date has passed). Every word drawn on a card is a word the product prints, or a sample answer in its voice, and every card says "sample company". (Until 30 Oct this rule promised a real run on the fixture company; it was dropped when the industries began to rotate — one chemical fixture cannot stand in for five scenes, and a run on five invented document sets would still be a sample. See step 12.)
3. **Short, plain sentences.** The left-hand line is one sentence a compliance person would say, and under it the box with what they typed. The card carries five or six lines, not fifty.
4. **No "what we will never tell you" section.** The honesty lives in the cards. The not-legal-advice line lives in the terms and on every report's last line.
5. **Colour means something.** Inside a card: amber for attention, green for on file / confirmed / the one action, blue for dates, a muted red only for expired and passed, grey for information. Used generously (washes, pills, markers) but with the same jobs on every card. Outside the card, free: backdrop shapes, tints, the green rooms.
6. **One file per panel.** `components/home/<Panel>.tsx`, each holding its own sentence and its own card. The homepage file is the ordered list. Shared: the tokens and one frame component with no words in it.

## 3. Decisions so far

| # | Decision | Date |
|---|---|---|
| 1 | **One domain.** compliboard.com serves the homepage, the four pages, and the app. No `app.` subdomain. Reversal: the marketing site moves to its own tool, or per-industry sites. | 29 Oct |
| 2 | **Same repo, same Vercel project.** The pages live under `app/` beside the sections. compliboard.vercel.app redirects to compliboard.com once the domain is primary. | 29 Oct |
| 3 | **Story panels, not feature sections.** Problem on the left, the product's answer on the right. Audit first, because it is the fear. | 29 Oct |
| 4 | **Industries rotate across the panels** — chemical, a flavour maker, a food manufacturer, a cannabis processor, a restaurant — because the product reads any company's documents today. Every non-chemical detail is checked against the agency's own page before it ships. | 29 Oct |
| 5 | **Drawn cards, not screenshots.** Screenshots never read clean. Each card is drawn in code with the app's tokens and five or six lines of large text. | 29 Oct |
| 6 | **Full-screen panels on a laptop, natural stacking on a phone.** No scroll-snap. The panels alternate page grey and white; the hero and the closing panel are light with the green waves (decision 12 replaced the deep green room). | 29 Oct, amended 30 Oct |
| 7 | **No image in the hero.** Words only: the headline, four lines lifted from the panels (each a link to its panel), the turn sentence, the button. | 29 Oct, amended 30 Oct |
| 8 | **The legal pages are drafted as a starting point for a lawyer.** The note saying so is for the owner (`docs/LEGAL-REVIEW.md` and a comment at the top of each page file), never on the page. | 29 Oct |
| 9 | **Price folds into the closing panel.** One number beside one button. | 29 Oct |
| 10 | **Every panel shows the ask box.** The left side is the moment (the headline) and the move (the product's own box with the sentence the person typed); the right side is the answer. Documents shows the drop as well as the box. The same back-and-forth conversation is shown in every section, because the owner is adding the shared chat to Audits and Documents, which were built before it existed. | 30 Oct |
| 11 | **Built beside the old homepage, swapped at the end.** The new page grows at `/preview-home` (unlinked, `noindex`), whole from its first panel and pushable to production as it grows, so it can be looked at clean on a phone. The old `app/page.tsx` keeps serving `/` until step 25 swaps them in one commit and deletes the old files. | 30 Oct |
| 12 | **The hero is light, not a dark room.** White fading to the app's green wash, four green waves rising at the bottom right from the palest wash to the app's #2F7D52, words in ink with the headline's last words in green (from the owner's Framer hero). The closing panel matches it. Behind each panel's card, one or two of the same waves in the two palest greens only; the strong green is kept for the hero and the close. The dark green room and the inverse wordmark are dropped. | 30 Oct |
| 13 | **No email address anywhere on the public pages.** The owner has run public mailboxes before — "thousands of fake emails" — so nothing on the site is a `mailto:` or a printed address. `hello@compliboard.com` does not exist and comes off the footer. A `/contact` page carries a short form with a bot check instead, and it delivers to an address that is never published. The legal entity named on those pages is **CompliBoard LLC**. | 31 Oct |

## 4. The panels, in order

| | Panel | Left-hand line (draft) | The card shows |
|---|---|---|---|
| 1 | Hero | *Compliance is your job. It’s also your third one.* · four lines: *The inspector is coming Thursday.* / *The customer wants our audit binder by Friday.* / *The permit expired in March. You found out in June.* / *The handbook says 30 days. The state says 14.* · the turn: *CompliBoard has read the whole cabinet. It knows what to fix, what is due, and where you stand with each agency.* | nothing — words on the light ground with the waves |
| 2a | Audit by agency | *The inspector is coming Thursday.* | your documents with status, the fix, a report link; nothing on file last |
| 2b | The binder | *Hand them the binder.* (draft) | the binder: requirement, then the document behind it, print or PDF — **gate F4** |
| 3a | Research a question | *We want to make our own gummies. Where do we start?* (a licensed cannabis distributor, Sacramento) | a conversation: the question, the answer with four official sources, a follow-up and its answer, "Make a checklist" |
| 3b | An executable checklist | *Two aides start Monday. What has to be in place first?* (a hospice in Bend, Oregon) | must do in order / worth doing / to confirm, one item opened with "How do I do this?" |
| 4 | Documents and the fix | *Nobody has opened this plan since 2025.* (a brewery in Longmont, Colorado) | the file dropped in and a question typed; the report: kind, needs work · 3 gaps, a summary, three gaps with fixes, one fact to confirm |
| 5 | Calendar | *The permit expires in March. You already know.* (a small trucking company in Macon, Georgia, asking in early March) | the typed question "What do we have due in the next 90 days?"; the answer: six dates in March, April and May, blue dates, green confirmed, amber to confirm, each with the document and its line or the rule; Send to my calendar · Google · Outlook; everyone gets the month by email on the 1st |
| 6 | HR | *The handbook says 30 days. The state says 14.* (a restaurant in Louisville, Kentucky; "A server quit yesterday. When do we have to pay her last check?") | the answer in one sentence; the handbook's sentence and KRS 337.055 side by side; one plain sentence on why the handbook is wrong (paid every two weeks); Suggested wording; Research this — HR's own shape, no status pill, no wording button (the owner, 30 Oct: the app stays as it is) |
| ~~7~~ | ~~Where we are~~ | struck 30 Oct: the dashboard tells a customer where they stand; a visitor has nothing in it yet. Statistics across all customers may take this slot later, once the numbers are real and large enough to mean something. | — |
| 8 | Invitation to trial | *Start with the folder you have.* · "Drop in the permits, the plans and the handbook, as they are. Ask anything." · "CompliBoard reads what you have and tells you what to fix, what is due, and where you stand with each agency." · Start free · 14 days. No card. · "$199 a month after the trial. One price." — not "everyone" (seats may be limited later by API cost); nothing about deletion or cancelling | none — words on the hero's ground with the hero's waves |

## 5. The release gate

The homepage does not release while any of these is open. Each is already in `docs/PENDING.md`.

| | Item | What on the page waits on it |
|---|---|---|
| F4 | The binder | panel 2b entirely; "Download the binder" on 2a's card |
| F1 | Stripe live mode | the price sentences in panel 8 describe a working payment |
| S1 | The Resend sending domain | the calendar card's "everyone gets the month by email on the 1st"; the contact form's delivery; any email the page mentions. (The phrase "everyone at your company" came off the page on 30 Oct — decision in §4 row 8.) |
| D2 | `.doc` and `.ppt` | the FAQ's list of file types, and "a file it cannot read, it says so" |
| F6 | The checklist (template) audit — PENDING says it answers “not ready”; `app/api/audit-runs/route.ts:47` has the `kind === 'template'` branch. **Still a hypothesis: step 12 was narrowed to words and did not settle it. Settled at step 33.** | panel 2b's scene: a customer's checklist in, a binder out |
| F7 | Audits on the shared chat engine (`lib/ask/`) | the question typed into the audit panel's box, and the conversation line on panel 2a |
| — | **Chat over documents** (`docs/VISION-DOCUMENTS.md`, "Later, not rev 1"; no PENDING id yet — add one at step 35) | the question typed into the documents panel's box, and the conversation line on panel 4 |

Two things become real the day the page has a Start button and are **not** page work, listed so they are not forgotten: the unthrottled signup (`PENDING.md` S2) and the key-rotation gate.

## 6. The steps

Cross a step off with its date when it is done. A step is done when the owner has said so.

### Part A — boards (this chat draws, the owner approves)

- [x] **1. The template** — done 30 Oct (canvas "CompliBoard Homepage Boards", row 1–3). One panel as a wireframe at laptop and phone width: the screen rule, the two edges, the nav, where the backdrop shape sits, the colour rhythm of all nine panels in a strip. The audit card drawn twice, app-faithful and coloured, so the colour rule is chosen by eye.
- [x] **2. Hero** — done 30 Oct (light, with the waves).
- [x] **3. Panel 2a — audit by agency** — done 30 Oct (coloured card chosen by eye; the box on the left for the first time).
- [x] **4. Panel 2b — the binder** — done 30 Oct (a Washington food maker, a grocery chain's checklist; every tab with its state and a report link).
- [x] **5. Panel 3a — research a question** — done 30 Oct (a California cannabis distributor making gummies; four facts checked at the agency's pages; the card as a conversation with a header, bubbles, a green source block).
- [x] **6. Panel 3b — an executable checklist** — done 30 Oct (an Oregon hospice hiring two aides; 42 CFR 418.76 and OAR 333-035-0210 read at the text). **The owner: the card is too long; revisit before step 12.**
- [x] **7. Panel 4 — documents and the fix** — done 30 Oct (a Colorado brewery's emergency action plan revised in 2025 (was 2021; changed 30 Oct, the freshness nudge dropped with it); the three gaps are 1910.38(c)(4), (c)(6) and (d), read at osha.gov).
- [x] **8. Panel 5 — calendar** — done 30 Oct (a Georgia trucking company asked in March; the card follows the question: March, April, May only, the permit the headline names first. Checked: the biennial update month and year rule at fmcsa.dot.gov; 49 CFR 382.701(b) for the yearly Clearinghouse query; IFTA quarterly returns due the last day of the month after the quarter. The owner reworked it twice: one month in the headline, and the card as if asked in March).
- [x] **9. Panel 6 — HR** — done 30 Oct (a Kentucky restaurant's final-pay clause against KRS 337.055: next normal pay period or 14 days, whichever is later; the card gives the company's two-week payroll as the reason 30 is wrong).
- ~~**10. Panel 7 — where we are.**~~ Struck 30 Oct (see §4 row 7 and §8).
- [x] **11. Panel 8 — invitation to trial, with the price** — done 30 Oct (the hero's ground and waves; one price line; "everyone" dropped on the owner's word).
- [x] **12. The words check** — done 30 Oct, `b32e2ab`, `docs/reports/public-pages-12-words.md`. Nine words moved to the product's own ("Needs work" with its capital; "Add a document"; "Summarise this conversation"; "Download" not "Print" on the checklist and documents cards; "Draft this section"; "Add files, or a whole folder"; "Google Calendar · Outlook"), the hero's "14 days" now read from `TRIAL_DAYS` as the price is read from `PLAN_PRICE`. Every fact re-opened and quoted in the report; three citations improved, two dead pages replaced (the biennial-update rule read at 49 CFR 390.19(b)(2)–(3) because fmcsa.dot.gov answered 403). Greps clean, and proved against the old `app/page.tsx`, which fails three of them. Checklist cut to four items. 12b (`b08f11c`): the question panel's fourth sentence is now the account, not the training — "the account has to exist before any commercial cannabis activity", source row 4 is 4 CCR §15047.2, and the file says why §15048(b) sank the old line. The eighteen boards on the canvas carry all of these words too (canvas note s12).

### Part B — code (Claude Code, one instruction per step, in this order)

- [x] **13. Read-only map** — done 30 Oct, `6901ddb`, `docs/reports/public-pages-13-map.md`. Everything that touches the current homepage and the public surface: `app/page.tsx`, `components/HomepageSection.tsx`, who links to `/`, the login and signup redirects, every reader of `NEXT_PUBLIC_APP_URL`, the Supabase auth redirect settings, `app/layout.tsx`'s fonts and metadata. Report and stop; change nothing.
- [x] **14. The frame** — done 30 Oct, `b3a9c71`. The new page at `app/preview-home/page.tsx` with `noindex` and no link to it (decision 11). The tokens the pages add to `app/globals.css` (the blue, the muted red, the wave greens), `components/home/Frame.tsx` (a sentence left, a card right, full screen on a laptop, stacked on a phone, no words), the nav and the footer as their own files, `app/page.tsx` as the ordered list with nothing in it yet. Measured at 1440, 1280 and 390 with `npm run measure`.
- [x] **15. Hero** — done 30 Oct, `8caf1ce`; final words in 15b. `docs/reports/public-pages-13-15.md`.
- [x] **16. Panel 2a** — done 30 Oct, `c00d05a` + `ebc2de8` (16b: the content box is 1200 at 1440, the card centred at 520; the shared ask box).
- [x] **17. Panel 2b** — done 30 Oct, `9e3039e`, with its F4 and F6 gate comments; shown on /preview-home (release-day rule).
- [x] **18. Panel 3a** — done 30 Oct.
- [x] **19. Panel 3b** — done 30 Oct, `217c03f` (to be shortened with the board).
- [x] **20. Panel 4** — done 30 Oct, `dd307b7` (the file chip on the ask box; the 2025 follow-up).
- [x] **21. Panel 5** — done 30 Oct, `a792274`. The product's words replaced two of the board's: the pill is "not confirmed" (`lib/calendarView.ts:191`) and the button "Send to your calendar" (the tab's string; "Send to my calendar" is the drawer's, for one date). Boards to follow at step 12.
- [x] **22. Panel 6** — done 30 Oct, `5f9848c`. **Two things on the card are not HR's:** "needs work" is Documents' word (HR stores prose answers; the per-section status word is parked on `parked/hr-check-structured`), and "Use this wording" / "Add to a checklist" are not controls HR has (its one action is "Research this"; the "Suggested wording" block is real, drawn grey). **Decided 30 Oct: the app stays as it is; the card follows it — no pill, the reason as a plain sentence, "Suggested wording" without the section, "Research this" as the one action — 22b done 30 Oct, `6cd9412`.**
- ~~**23. Panel 7.**~~ Struck 30 Oct.
- [x] **24. Panel 8** — done 30 Oct, `fe8e560`. The price is read from `lib/billingView.ts:47`–`:48` (`PLAN_PRICE`, `PLAN_PERIOD`), not typed, so it moves with the app; GATE F1 comment on the working payment. 24b (`6cd9412`): the headline on two lines, 16ch.
- [x] **25a. The four pages, as stubs** — done 2 Nov, `bffe191`. `components/home/PageShell.tsx` (nav, serif h1 at the panels' 44px, an unused lead slot for later, the body, the footer; white; `min-h-[100svh]` so a one-line page still holds the footer down), four routes each `noindex` with its own title, the owner's one sentence as the whole body; the footer's address gone and its hrefs now exactly `/ /privacy /terms /security /faq`. Side effect, nothing touched: the signed-in shell's two dead links land. Left for 30a: the `mailto:` at `components/AppLayout.tsx:464`. (The owner, 2 Nov.) The words wait until the app work is finished, "we'll have a better idea what to write then"; what cannot wait is that the footer links somewhere. So `/privacy`, `/terms`, `/security` and `/faq` are built now as four real routes that each say, in one honest line, that the page is being written before launch. **Each carries `robots: { index: false, follow: false }` until its words are written** — an empty page titled "Terms of use" is worse indexed than not there at all — and taking that off is the last line of steps 27–30. One shell file holds the nav, the title and the footer so the four pages are a heading and a slot. The footer's printed `hello@compliboard.com` comes off in the same commit (decision 13).
- [x] **25. The swap** — done 2 Nov, `5e12cd4`. `git mv` of the preview page onto `app/page.tsx`; the robots export off first; the old page, `HomepageSection.tsx` and the three images only it loaded deleted (each re-grepped that day, not taken from the map); `/preview-home` 404s. The page's description is the hero's turn sentence, exported from `Hero.tsx` so the two cannot drift. The old page's "$49 / $29 a month, early adopter price locked forever" went with it — the one visitor-facing number that moved. (The signed-in redirect was taken out of this step on 31 Oct — see §7a and §7b.) `/preview-home` becomes `app/page.tsx`; **the `robots: { index: false, follow: false }` export comes off first**, or the real homepage ships unindexable; the temporary address goes; the old `app/page.tsx`, `components/HomepageSection.tsx` and whatever step 13 found only they used are deleted, all in one commit. **Comes after step 25a**, so the footer's four links reach a real page rather than a 404. Part C's words come later still, and the swap does not wait for them.
- [x] **26. One measured walk against a production build** — done inside step 25, 2 Nov: `next build` (○ Static for `/` and the four stubs), `next start`, `curl -sI /` with no `X-Robots-Tag` and no `noindex` in the HTML, all nine sections and eight anchors in the served HTML, every link on the page walked (nav, three Start free, four hero lines, four footer) and each landing, measured at 1440/1280/390 against the production build with section heights identical to the 12b run, `shots/pp-25-home-*.png`. Nothing left for a separate step.

### Part C — the four content pages

**Deferred 2 Nov, on the owner's word: these are written after the remaining app work is done, not now.** The reason is the truth rule read forward — what the privacy page may claim depends on what the app does the day it ships, and the app is still being finished. Step 25a puts honest stubs behind the links in the meantime, so nothing on the page is broken while the words wait. Each of 27–30 ends by taking its page's `noindex` off, and step 27a (the privacy map) is still the first move when they resume, because it is what makes the words true rather than generic.

- [ ] **27. Privacy.** What is collected, where it lives (Supabase), who reads it (Anthropic for the reading, Resend for email, Stripe for billing, Vercel for hosting), how long (documents until deleted; conversations 12 months after the last message, summaries until deleted), deletion and export from My Account. Drafted for a lawyer; `docs/LEGAL-REVIEW.md` lists the clauses to check.
- [ ] **28. Terms of use.** CompliBoard LLC, Oregon, governing law Oregon (§7). No email address on the page; the contact route is `/contact` (decision 13). Not legal advice, said here and on every report's last line.
- [ ] **29. Security.** Only what can be shown: one company per login, tenancy enforced in the database, files in private storage, nothing deleted for non-payment, the four-field signup. No certification claims.
- [ ] **30a. Contact** (new, 31 Oct, decision 13). `/contact`: name, company, email, message, a bot check, one button. It delivers to the owner's private address through Resend (so it rides gate S1) and stores nothing. The form says what it does with what you type, and the privacy page's sub-processor list gains whatever the bot check is. The footer's printed address comes off in the same commit.
- [ ] **30. FAQ.** From the real objections: not legal advice; where my documents go; which file types (the seven that work — D2 makes it all the picker offers); which industries; what happens after the trial; can I delete everything.

### Part D — the domain and the release

- [ ] **31. DNS at GoDaddy, one session.** compliboard.com to the Vercel project, and the Resend sending-domain records (S1). Propagation takes hours; start this early, it blocks nothing meanwhile.
- [ ] **32. The address change.** `NEXT_PUBLIC_APP_URL` on Vercel; Supabase Auth's Site URL and redirect list (reset-password, join) carrying both hosts during the switch; the four `from:` lines to the verified domain; the Stripe webhook address when F1 lands. Each read back, not assumed.
- [ ] **33. The gate check.** F4, F1, S1, D2, F6, F7 and chat over documents against the shipped product; every gate comment in `components/home/` walked; the owner's own walk of the page against the app.
- [ ] **34. Release**, per `docs/RELEASE.md`, with the production-build walk.
- [ ] **35. Close-out.** `docs/HANDOFF-FROM-PUBLIC-PAGES.md`, the `STATUS.md` row, `docs/PENDING.md` updated, the boards file in `docs/`.

## 7. Open, waiting on the owner

- ~~The legal entity name and state~~ — confirmed 31 Oct: **CompliBoard LLC, registered in Oregon.** The terms name it and take Oregon for the governing-law line; `docs/LEGAL-REVIEW.md` asks the lawyer to confirm the venue wording and whether the Oregon Consumer Privacy Act reaches a company this size, since the answer changes the privacy page's rights section.
- ~~Whether hello@compliboard.com receives mail~~ — answered 31 Oct: **it does not exist.** See decision 13.
- **Where the contact form delivers.** A private address nobody publishes, or a mailbox the owner already reads. Needed before step 30a can send anything.
- ~~Which hero line~~ — chosen 30 Oct (see §4).

## 7b. Later, not now

- **The signed-in redirect at `/`** (the owner, 31 Oct): a signed-in visitor who types the bare domain should land on `/dashboard`, but it is not part of building the front page and it is not worth a middleware. Its own job, in its own session, after reading every path that reaches `/`. Until then a signed-in visitor sees the homepage, with Sign in and Start free in the nav — which is wrong-ish, not broken.
- One homepage per industry for demos (the owner, 30 Oct): the same eight panels with every scene from one industry, shown by the sales team as the homepage when demoing to that industry. The rotating-industry page stays the public one. Every panel is its own file with its words in one WORDS object, so an industry version is a set of WORDS, not a new page.
- Statistics across all customers (the owner, 30 Oct): a quiet strip above the invitation — questions answered, audits run, documents read — once the numbers are real and large enough to mean something.

## 7a. Found along the way

- **Two places in the running app give out an address that does not exist** (31 Oct). `components/AppLayout.tsx:464` is a `mailto:hello@compliboard.com` in the signed-in shell's footer, and `lib/signupView.ts:97` tells a person whose signup failed to "Email hello@compliboard.com and we will clear it so you can try again." The second is the serious one: it is the sentence a person reads at the exact moment they cannot become a customer, and the mail goes nowhere. **Not fixed in this session** (the owner, 31 Oct: nothing in the running app changes here). Both become a link to `/contact` once it exists — a two-line change, for the app session, and it should not wait long.

- **The new footer links to four pages that do not exist.** `components/home/Footer.tsx:22`–`:25` points at `/privacy`, `/terms`, `/security` and `/faq`; `ls app` has no such routes. Harmless while the page is unlinked at `/preview-home`; at step 25 they become four 404s on the front door. **Resolved 2 Nov by step 25a:** the four routes are built as honest `noindex` stubs before the swap, and Part C fills them later. (The signed-in shell already has the same dead links — `components/AppLayout.tsx:466` — which is older debt, fixed by the same four pages.)
- **There is no server-side session anywhere in this app.** `@supabase/ssr` is a dependency, but `lib/supabase.ts:1` imports `createBrowserClient` from it and nothing imports `createServerClient`; there is no `middleware.ts`, and every signed-in page guards itself in a `useEffect` with `supabase.auth.getUser()` (`app/dashboard/page.tsx:82`–`:84` is the pattern). So a signed-in redirect at `/` is NOT "a few lines" if done on the server — that would mean a middleware that sees every request in the app.
  **Decided 31 Oct (the owner): not in this session, and not as a side effect of the swap.** This session builds the front page and nothing else; nothing is added to or removed from the running app. The redirect becomes its own job, after a proper study of every link and every path that reaches `/` — including `app/account/page.tsx:1077`, which lands a just-deleted company on `/` on purpose. It is therefore OUT of step 25 and listed in §7b.
- **No analytics, no trackers, no third-party scripts.** `package.json` has no analytics package of any kind (the dependencies are the Anthropic SDK and `ai`, Supabase, Stripe, Resend, Next/React, and the document readers `mammoth`, `officeparser`, `xlsx`); `grep` for Google Analytics, gtag, PostHog, Mixpanel, Segment, Hotjar, Plausible and Facebook across `app components lib` returns only ordinary English words ("segment", "plausible") in comments. Nothing writes `document.cookie`. This is a fact the privacy and security pages can state plainly — and one to re-check at step 33, because it is the kind of thing that gets added quietly.

- `lib/billingView.ts:50` (`PLAN_NOTE`, the account page's second line under the price) says "for everyone at your company". The owner asked the homepage not to say "everyone" because seats may be limited by API cost; the app already says it to paying customers. His call whether that line changes too.

- **`app/layout.tsx:182`–`:185` sets a site-wide description, "Compliance made simple"** (2 Nov, step 25's report). The homepage and the four stubs now carry their own; every other page inherits that one. An app-session change, two lines, when the app's own metadata is looked at.
- **The app shell's footer already links to `/privacy` and `/terms`** (`components/AppLayout.tsx:462–463`), so every signed-in person has had two dead links since the shell was built. Part C builds the pages; nothing else is needed. Found by step 13's map.

## 8. Change log

- v13, 2 Nov 2026 — **steps 25a, 25 and 26 done** (`bffe191`, `5e12cd4`): the four content pages as `noindex`
  one-line stubs on `components/home/PageShell.tsx`, then the swap — `app/preview-home/page.tsx` moved onto
  `app/page.tsx` with the robots export deleted first, the old marketing page, `components/HomepageSection.tsx` and
  the three images only it loaded gone, `/preview-home` 404ing — and step 26's measured walk against a production
  build folded into it. **Closed out at step 35:** `docs/HANDOFF-FROM-PUBLIC-PAGES.md` written, the `STATUS.md`
  row added (v40), **F12 — chat over documents** given an id in `docs/PENDING.md` (v2) as §5 asked, and this file
  committed for the first time since v4. **NOT pushed:** `git fetch && git log origin/main..HEAD --oneline | wc -l`
  → **21** on 2 November, `origin/main` still at `5dea8db`, so `https://compliboard.vercel.app/` serves the OLD
  marketing page and the swap has changed nothing a visitor can see; the push is the owner's and the release is
  step 34. **What resumes later, and where:** Part C's words (steps 27–30, each ending by taking its page's
  `noindex` off, 27a the privacy map first), `/contact` (30a, still waiting on where it delivers — §7), the domain
  (31–32) and the gate check (33, which also owes F7 a mark on `components/home/AuditPanel.tsx`).
  `docs/HANDOFF-FROM-PUBLIC-PAGES.md` §6 and §7 carry the detail.
- v12, 31 Oct – 2 Nov 2026 — steps 8, 9 and 11 (calendar, HR, invitation boards) and 21, 22, 24 built; panel 7 struck, so the page is eight panels; step 12 and 12b, the words check, done and carried back onto all eighteen boards. Decision 13: no email address anywhere public, a `/contact` form with a bot check instead, entity **CompliBoard LLC, Oregon**. The signed-in redirect left step 25 and became its own later job (§7b), because this app has no server-side session and the owner's rule is that nothing in the running app changes in this session. **Part C deferred to after the app work; step 25a builds the four pages as `noindex` stubs now so the footer links work.**
- v11, 30 October 2026 — the documents scene moved to 2025; steps 8 (calendar, Georgia trucking, asked in March) and 9 (HR, Kentucky restaurant, KRS 337.055) approved; step 20 built, 21 and 22 briefed; panel 7 (where we are) struck — the page is eight panels; statistics across customers may take the slot later.
- v10, 30 October 2026 — step 7 (documents board, Colorado brewery) approved; step 20 briefed; the checklist card (step 6) marked too long, to revisit.
- v9, 30 October 2026 — step 6 (the checklist board, hospice, Oregon) approved; step 18 built; step 19 briefed.
- v8, 30 October 2026 — step 5 (the question board) approved: cannabis, California, every fact checked at the source; step 18 briefed.
- v7, 30 October 2026 — step 17 built; F6 (the checklist audit) added to the gate table, which the binder panel's file already named.
- v6, 30 October 2026 — step 4 (the binder board) approved; step 16 built, with 16b correcting the frame's content box (120px from the window, not from a 1200 box) and centring the card; step 17 briefed.
- v5, 30 October 2026 — step 3 done: the audit board approved with the coloured card and the ask box on the left; step 16 (its code) briefed.
- v4, 30 October 2026 — the owner chose to build each panel as soon as its board is approved, so Parts A and B interleave from here (step numbers unchanged). Steps 13, 14, 15 built; the hero's final words chosen (headline, four lines, the turn); the calendar panel's line changed to match; §7a added.
- v3, 30 October 2026 — decision 11 (built at `/preview-home`, swapped at step 25), decision 12 (the hero goes light with the green waves; the dark room dropped), decision 6 amended; steps 1 and 2 done.
- v2, 30 October 2026 — decision 10: the ask box on every panel, left = headline + the typed box, right = the answer. Gate gains F7 (Audits on the shared chat) and chat over documents. Step 1's template board drawn on the canvas "CompliBoard Homepage Boards".
- v1, 29 October 2026 — written at the end of the first day's brainstorm: the structure, the rules, nine decisions, the panel order, the gate, 35 steps.
