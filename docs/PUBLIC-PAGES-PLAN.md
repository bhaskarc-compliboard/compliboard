# Public pages — the plan

**Version:** 4 · **Updated:** 30 October 2026 — the hero's final words; steps 13–15 built; boards and code now interleave per panel. **Written:** 29 October 2026, in the public-pages chat.
**Supersedes:** nothing. The homepage at `app/page.tsx` is replaced whole; nothing from it is kept.
**For:** the owner, this chat, and Claude Code. One step at a time. A step is crossed off here, with its date, before the next one starts.
**Shape:** boards first (the chat draws, the owner approves), then code (Claude Code builds one board per instruction, in the same order), then the four content pages, then the domain and the release.

---

## 1. What the pages are for

The homepage gives a first-time visitor a clear picture of what CompliBoard will solve for them. That is its whole job. It is told as a story: each panel is one moment in the week of the person who does compliance on top of two other jobs, in their own words on the left, and what CompliBoard gives back on the right, drawn in the product's own words.

The four other pages — privacy, terms, security, FAQ — are content pages in the same frame.

## 2. The rules every word follows

1. **True on the day of release.** The homepage goes live after the pieces it mentions are built. Six items are its gate (see §5). Every sentence that waits on one of them is marked in its panel's file with the PENDING item it waits on, and the last step before release walks those marks against the shipped product. Nothing beyond the gate list is mentioned.
2. **The product's words.** Never "AI", never "compliant", never a score or a percentage, never "overdue" (a date has passed). Every word drawn on a card is a word the product prints, or a sample answer in its voice, replaced before build by words from a real run on the fixture company.
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

## 4. The panels, in order

| | Panel | Left-hand line (draft) | The card shows |
|---|---|---|---|
| 1 | Hero | *Compliance is your job. It’s also your third one.* · four lines: *The inspector is coming Thursday.* / *The customer wants our audit binder by Friday.* / *The permit expired in March. You found out in June.* / *The handbook says 30 days. The state says 14.* · the turn: *CompliBoard has read the whole cabinet. It knows what to fix, what is due, and where you stand with each agency.* | nothing — words on the light ground with the waves |
| 2a | Audit by agency | *The inspector is coming Thursday.* | your documents with status, the fix, a report link; nothing on file last |
| 2b | The binder | *Hand them the binder.* (draft) | the binder: requirement, then the document behind it, print or PDF — **gate F4** |
| 3a | Research a question | *We're bringing in 192-proof ethanol. What do we need before it ships?* | the answer with numbered official sources |
| 3b | An executable checklist | *Now what do I actually do?* (draft) | must do / worth doing / to confirm, and "How do I do this?" |
| 4 | Documents and the fix | *Nobody has opened this plan since 2021.* | kind, status, numbered gaps with fixes, a fact to confirm |
| 5 | Calendar | *The permit expired in March. You found out in June.* (was the page-6 line) | a week with two dates, "not confirmed", "from:", "repeats yearly" |
| 6 | HR | *The handbook says 30 days. The state says 14.* | your handbook / the rule, side by side; suggested wording |
| 7 | Where we are | *"Where are we?"* | the four counters, due in 30 days, one question for today |
| 8 | Invitation to trial | *Start with the folder you have.* + $199 / everyone / 14 days / no card / nothing deleted | — |

## 5. The release gate

The homepage does not release while any of these is open. Each is already in `docs/PENDING.md`.

| | Item | What on the page waits on it |
|---|---|---|
| F4 | The binder | panel 2b entirely; "Download the binder" on 2a's card |
| F1 | Stripe live mode | the price sentences in panel 8 describe a working payment |
| S1 | The Resend sending domain | "everyone at your company" — colleagues can actually be invited; any email the page mentions |
| D2 | `.doc` and `.ppt` | the FAQ's list of file types, and "a file it cannot read, it says so" |
| F7 | Audits on the shared chat engine (`lib/ask/`) | the question typed into the audit panel's box, and the conversation line on panel 2a |
| — | **Chat over documents** (`docs/VISION-DOCUMENTS.md`, "Later, not rev 1"; no PENDING id yet — add one at step 35) | the question typed into the documents panel's box, and the conversation line on panel 4 |

Two things become real the day the page has a Start button and are **not** page work, listed so they are not forgotten: the unthrottled signup (`PENDING.md` S2) and the key-rotation gate.

## 6. The steps

Cross a step off with its date when it is done. A step is done when the owner has said so.

### Part A — boards (this chat draws, the owner approves)

- [x] **1. The template** — done 30 Oct (canvas "CompliBoard Homepage Boards", row 1–3). One panel as a wireframe at laptop and phone width: the screen rule, the two edges, the nav, where the backdrop shape sits, the colour rhythm of all nine panels in a strip. The audit card drawn twice, app-faithful and coloured, so the colour rule is chosen by eye.
- [x] **2. Hero** — done 30 Oct (light, with the waves).
- [ ] **3. Panel 2a — audit by agency.**
- [ ] **4. Panel 2b — the binder.**
- [ ] **5. Panel 3a — research a question.**
- [ ] **6. Panel 3b — an executable checklist.**
- [ ] **7. Panel 4 — documents and the fix.**
- [ ] **8. Panel 5 — calendar.**
- [ ] **9. Panel 6 — HR.**
- [ ] **10. Panel 7 — where we are.**
- [ ] **11. Panel 8 — invitation to trial, with the price.**
- [ ] **12. The words check.** Every sentence on every board against the product and the files: the source for each claim written beside it; every non-chemical detail checked at the agency's page; the sample text on each card replaced by words from a real run on the fixture company (Claude Code runs them, on the production model, once).

### Part B — code (Claude Code, one instruction per step, in this order)

- [x] **13. Read-only map** — done 30 Oct, `6901ddb`, `docs/reports/public-pages-13-map.md`. Everything that touches the current homepage and the public surface: `app/page.tsx`, `components/HomepageSection.tsx`, who links to `/`, the login and signup redirects, every reader of `NEXT_PUBLIC_APP_URL`, the Supabase auth redirect settings, `app/layout.tsx`'s fonts and metadata. Report and stop; change nothing.
- [x] **14. The frame** — done 30 Oct, `b3a9c71`. The new page at `app/preview-home/page.tsx` with `noindex` and no link to it (decision 11). The tokens the pages add to `app/globals.css` (the blue, the muted red, the wave greens), `components/home/Frame.tsx` (a sentence left, a card right, full screen on a laptop, stacked on a phone, no words), the nav and the footer as their own files, `app/page.tsx` as the ordered list with nothing in it yet. Measured at 1440, 1280 and 390 with `npm run measure`.
- [x] **15. Hero** — done 30 Oct, `8caf1ce`; final words in 15b. `docs/reports/public-pages-13-15.md`.
- [ ] **16. Panel 2a.**
- [ ] **17. Panel 2b** — built with its gate comment; the page shows it only once F4 ships.
- [ ] **18. Panel 3a.**
- [ ] **19. Panel 3b.**
- [ ] **20. Panel 4.**
- [ ] **21. Panel 5.**
- [ ] **22. Panel 6.**
- [ ] **23. Panel 7.**
- [ ] **24. Panel 8.**
- [ ] **25. The swap, and the signed-in redirect.** `/preview-home` becomes `app/page.tsx`; the temporary address goes; the old `app/page.tsx`, `components/HomepageSection.tsx` and whatever step 13 found only they used are deleted, all in one commit. A signed-in visitor to `/` goes to `/dashboard` — a few lines, the only behaviour on the page.
- [ ] **26. One measured walk against a production build** (`next build && next start`), all nine panels at three widths, every link followed, screenshots in `shots/`.

### Part C — the four content pages

- [ ] **27. Privacy.** What is collected, where it lives (Supabase), who reads it (Anthropic for the reading, Resend for email, Stripe for billing, Vercel for hosting), how long (documents until deleted; conversations 12 months after the last message, summaries until deleted), deletion and export from My Account. Drafted for a lawyer; `docs/LEGAL-REVIEW.md` lists the clauses to check.
- [ ] **28. Terms of use.** Needs from the owner: the legal entity name and state; whether hello@compliboard.com receives mail.
- [ ] **29. Security.** Only what can be shown: one company per login, tenancy enforced in the database, files in private storage, nothing deleted for non-payment, the four-field signup. No certification claims.
- [ ] **30. FAQ.** From the real objections: not legal advice; where my documents go; which file types (the seven that work — D2 makes it all the picker offers); which industries; what happens after the trial; can I delete everything.

### Part D — the domain and the release

- [ ] **31. DNS at GoDaddy, one session.** compliboard.com to the Vercel project, and the Resend sending-domain records (S1). Propagation takes hours; start this early, it blocks nothing meanwhile.
- [ ] **32. The address change.** `NEXT_PUBLIC_APP_URL` on Vercel; Supabase Auth's Site URL and redirect list (reset-password, join) carrying both hosts during the switch; the four `from:` lines to the verified domain; the Stripe webhook address when F1 lands. Each read back, not assumed.
- [ ] **33. The gate check.** F4, F1, S1, D2, F7 and chat over documents against the shipped product; every gate comment in `components/home/` walked; the owner's own walk of the page against the app.
- [ ] **34. Release**, per `docs/RELEASE.md`, with the production-build walk.
- [ ] **35. Close-out.** `docs/HANDOFF-FROM-PUBLIC-PAGES.md`, the `STATUS.md` row, `docs/PENDING.md` updated, the boards file in `docs/`.

## 7. Open, waiting on the owner

- The legal entity name and state for the terms. (`components/AppLayout.tsx:466` prints “© 2026 CompliBoard LLC”; a line in a footer is not the legal fact — the owner confirms it.)
- Whether hello@compliboard.com receives mail (the signup error path already names it).
- ~~Which hero line~~ — chosen 30 Oct (see §4).

## 7a. Found along the way

- **The app shell's footer already links to `/privacy` and `/terms`** (`components/AppLayout.tsx:462–463`), so every signed-in person has had two dead links since the shell was built. Part C builds the pages; nothing else is needed. Found by step 13's map.

## 8. Change log

- v4, 30 October 2026 — the owner chose to build each panel as soon as its board is approved, so Parts A and B interleave from here (step numbers unchanged). Steps 13, 14, 15 built; the hero's final words chosen (headline, four lines, the turn); the calendar panel's line changed to match; §7a added.
- v3, 30 October 2026 — decision 11 (built at `/preview-home`, swapped at step 25), decision 12 (the hero goes light with the green waves; the dark room dropped), decision 6 amended; steps 1 and 2 done.
- v2, 30 October 2026 — decision 10: the ask box on every panel, left = headline + the typed box, right = the answer. Gate gains F7 (Audits on the shared chat) and chat over documents. Step 1's template board drawn on the canvas "CompliBoard Homepage Boards".
- v1, 29 October 2026 — written at the end of the first day's brainstorm: the structure, the rules, nine decisions, the panel order, the gate, 35 steps.
