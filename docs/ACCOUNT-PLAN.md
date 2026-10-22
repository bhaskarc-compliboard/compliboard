# My Account — the plan

**Version:** 1 · **Written:** 21 October 2026, by the Calendar and Dashboard chat, continued into My Account.

> **The owner's working copy is a Claude Doc, "My Account — the master plan".** This file mirrors it so the next session
> can read the plan from the repository. When the two disagree, the owner's doc wins and this file is corrected.
> The pictures are `docs/account-boards.html` (nine boards, approved 21 October). The map is `docs/ACCOUNT-MACHINERY.md`
> (commit 5f3b940). Branch `account`, from `main` at c22025b.

**What it is.** My Account is where a company keeps its own facts (the name, what it does, its website, its sites), who
can sign in, how each person signs in, billing, and the way out. Around it sits the front door: a four-field signup, a
website read that proposes what we found, and a three-screen walk. Then billing on Stripe with a read-only state after
the trial. Three parts, built and released in order: **A the account page · B the front door · C billing.**

## Ground rules

- Before any change, find from the code (not memory) everything the change touches in every section, and re-check
  those sections after. Goes at the top of every instruction.
- A claim without a file and line is a hypothesis, and is checked.
- When unsure, ask plainly and politely (Calendar decision 30).
- The sidebar and the shared frame are not touched by this section; the page sits on them as every section does.
- Model calls only in part B's website read, behind its own variable; every other step is $0. The Haiku guard stays on.
- Never `db:reset` or `db:restore` without the owner. Production is read-only for Claude Code. Migrations, backups,
  variables and Stripe keys are the owner's. Claude Code pushes only on the owner's word.
- Every release ends with one measured walk against the built app, not the dev server.
- `npm run cost` before and after every job.

## The steps

| # | Step | What it is | Status |
|---|---|---|---|
| 1 | Read-only map | `docs/ACCOUNT-MACHINERY.md`, from the code and staging; nothing changed | Done 21 Oct (5f3b940) |
| 2 | The vision | The owner's, in the chat | Done 21 Oct |
| 3 | Boards | Nine boards: the five tabs, a site in the drawer, signup, the walk, the read-only state | Done 21 Oct |
| 4 | The plan | The owner's doc; this file mirrors it | Done 21 Oct |
| **A** | **The account page** | | |
| 5 | Migration 082 | Company facts (`website`, `what_you_do`, `naics_code`, `library`); the company name closed to a person (both doors); sites a person may add, edit and remove (never the main one); invitations; the per-person monthly-email switch; `trial_started_at`. One stop: the migration and the county-from-address answer reviewed in the chat first | Done 21 Oct (d8c0f58, applied to staging; `DECISIONS.md` §207) |
| 6 | The Company tab | The shared frame and tab row; the facts; "what you do" typed with suggestions; the website line; the main site; the three questions with their answers; the sites list and the site drawer; **the geocoder**; and the Company information name fix 082 made necessary | Done 21 Oct |
| 7 | The People tab | Who can sign in; invite by email → a link; `/join` where the person sets their own password; remove; the monthly-email switch read by the job | Done 21 Oct |
| 8 | The Sign-in tab | Name; email change with confirmation; password change that asks for the current one; the shared sheet | Done 21 Oct |
| 9 | The Cancel tab | Download my data; delete the company (today's flow, the boards' words). The subscription line arrives with part C | Done 21 Oct |
| 10 | The owner's test, part A | By hand on staging; free | Done 21 Oct — two findings, both fixed (`ea0a3a6`): the site drawer closes on Save, and the password changes by reset link rather than a form |
| 11 | Release A | The routine: backup, 082 on production, read back, push, the built-app walk, live checks | Prepared 21 Oct (`a1b5284`, `b97e1da`); **082 and 083 applied to production by the owner and read back 22 Oct** — the rest of the routine is the owner's |
| **B** | **The front door** | | |
| 12 | Signup | Four fields; the account, the company and its main site created together; the trial starts; lands on the walk | **Released 22 Oct** — migration 084 on production · `c767ab1`, `e091df9` · `DECISIONS.md` §209 |
| 13 | The website read | `AI_MODEL_WEBSITE` (Opus 5.5); one read; the card proposes; nothing written until "Yes, that's us" | **Released 22 Oct** — migration 085 on production · `6983946`, `fe100e3` · `DECISIONS.md` §210 |
| 14 | The walk | Three screens; every screen can be left; the Dashboard picks up | **Released 22 Oct** — `8c659c5`, `4c4f985` · `DECISIONS.md` §211 |
| 15 | The owner's test, part B | Real websites, Opus 5.5 against Sonnet 5.5, side by side | **Released 22 Oct** — `npm run website:compare`, five hosts; three findings from the owner's walk fixed and the card redrawn · migration 086 on production · `cebdfed`, `922eba8`, `6c38a7b`, `6afa908`, `f9147bb`, `2440cef` · `DECISIONS.md` §212 |
| 16 | Release B | The routine; `AI_MODEL_WEBSITE` set on Vercel by the owner | **Released 22 Oct** — four backup CSVs, the variable set before the push, 084/085/086 applied, production read back six ways, `main` fast-forwarded to `2440cef`, ten live checks passed, one measured walk against the production build. `docs/RELEASE.md` |
| **C** | **Billing** | | |
| 17 | Stripe, the wiring | The owner's Stripe account and keys; **migration 087** (`stripe_customer_id`, `subscription_status`, `trial_ends_at`, `current_period_end`) — the plan first called it 083, which is `one_address`; 084, 085 and 086 are taken too; checkout and portal routes; the webhook. One stop | Not started |
| 18 | The read-only state | One rule the paid routes check; the banner; the 7-day grace; the daily job that ends trials | Not started |
| 19 | The Billing tab and the Cancel tab's subscription line | As drawn | Not started |
| 20 | The owner's test, part C | Stripe test mode: a test card, a failing card, the trial ending | Not started |
| 21 | Release C | The routine | Not started |
| 22 | Close-out | `docs/HANDOFF-FROM-ACCOUNT.md`; DECISIONS, SCHEMA, TESTING, RELEASE, HANDOFF-CODE §7, TEST-AT-FINISH-LINE; project docs synced | Not started |

## Decisions

1. **The company name is not editable by a person**, from either door (My Account and Company information). It is tied
   to the company id and everything hangs on it. A wrong name is fixed by us.
2. **Email is editable**, with a confirmation link to the new address; the old address keeps working until it is clicked.
3. ~~**"What you do" is typed, with suggestions** from a standard list (the NAICS titles)~~ — **AMENDED 22 October at
   step 15, after the owner's own walk.** The card was asking a person to agree with a six-digit code, and nothing read
   it: `grep -rn naics_code app lib components prompts scripts` found two writers and no reader. **NAICS leaves every
   screen a person sees.** What a person reads and writes is now two plain lines — a sentence about the business
   (`companies.about`, migration 086) and a broad industry line (`companies.what_you_do`, which changed meaning) — each
   as text with a small `change` that turns that one line into a box. No suggestions anywhere. The industry line is
   proposed by the website read from a closed list of five industries and three roles and is what will choose a
   requirement table when there is more than one; `companies.naics_code` stays, unwritten, with the person's UPDATE
   revoked by 086. Which requirements library a company gets is still a separate, unseen column (`chemical` for
   everyone today). `DECISIONS.md` §212.
4. **One address per site; the company's address is its main site's.** State and county are read from the address,
   never typed. Adding a site is a name and an address, nothing else. The main site cannot be removed.
5. **The three questions on the Company tab are the top three switches** (has employees, how many, what the business
   does), with their help lines, editable, written through `/api/switches/answer`. `companies.employee_count` is retired
   as a thing anyone reads.
6. **People: an invite link, an individual password.** Who can sign in is a list; inviting is one email; the person sets
   their own password at the link and lands in the company. No roles in this version. The monthly calendar email has a
   per-person switch.
7. **The page is tabs, the edits are drawers.** Five tabs in the shared tab row. A site, an invitation, a password change
   open in the shared drawer or sheet, as a date or a report does. The page itself stays a glance.
8. **Signup is four fields** — email, password, company name, website (optional, "Highly recommended — it helps us know
   your company"). The account and the trial exist from that second. The company and its main site are created with the
   account, together or not at all. **Built 22 October as migration 084's one SECURITY DEFINER function, with the login
   deleted again when that transaction fails** so the address is free to try again — the old route left a login that
   could sign in, 404 on every page and never be registered again (`ACCOUNT-MACHINERY.md` §B3). Two things the brief did
   not have and the stop settled: the function takes **no email** (the login system owns the address), and
   `companies.industry` — a JOIN KEY, not a label — takes a column DEFAULT of `chemical-manufacturing` rather than a
   dropdown, because a null empties `lib/agencyScope.ts`'s agency list and switches off industry filtering in
   `lib/resolve.ts`. `DECISIONS.md` §209.
9. **The website is the first door for information.** One read, on `AI_MODEL_WEBSITE` (Opus 5.5 to start; Sonnet 5.5
   compared at the test). It proposes; the person confirms; nothing is written on the model's word alone.
   **Built 22 October (migration 085).** The proposal lands in `website_reads` — the pages fetched, what the model
   said, or the reason it could not be read — and `authenticated` holds SELECT on it and nothing else. The old
   scanner was replaced rather than reused: it was a blind SSRF (`docs/TODO.md:1075`), it asked the model to decide
   facts that are switches, and it told the model to fall back on public directories when a site was thin. The new
   one has one anchor and no search tool. Two things the stop settled: the NAICS ask is the BROADEST fitting code
   rather than a confident one (the first wording returned "" on both real cards), and http is allowed only after
   https fails to CONNECT. `DECISIONS.md` §210.
10. **The walk is three screens and can be left at any point.** The Dashboard's own card continues the questions.
11. **After the trial without a card, or after a failed card's 7-day grace: read-only, never locked out.** Sign in, read,
    download and print everything; asking, reading documents and auditing pause; one banner, one button. Nothing is ever
    deleted for non-payment.
12. **Stripe hosts the card page and the billing portal.** We hold a customer id and a subscription status per company,
    kept current by the webhook, and never a card number.
13. **Cancel is two different things**: stopping the subscription (the company stays, read-only) and deleting the company
    for good (typed confirmation, download first).
14. **The sidebar and the shared frame are untouched** by this section.
15. **A site with rows attached cannot be removed, and is not reassigned either.** Added 21 October from migration
    082's reading of the schema: `obligations.entity_id` is ON DELETE CASCADE and a referential cascade does not consult
    an RLS policy, so removing a site would have destroyed obligations that no policy lets a person delete. Removal is
    refused while any of the seven cascade relations holds a row, naming what is attached. Reassigning those rows to the
    main site was rejected: an air permit held by one plant is not another's. **"Closing" a site — a stamp that keeps
    every row and drops the site out of lists and resolution — is recorded as a later decision and is not built.**
    `DECISIONS.md` §207 B.
16. **State and county come from the Census Bureau's geocoder, behind `GEOCODER_URL`.** Settled at the
    step 5 stop and built at step 6 (`lib/geocode.ts`). One address in, state and county out, free, no
    key, and it is the authority the FIPS codes come from. A shipped HUD ZIP-to-county table was
    rejected: a split ZIP gives a probability rather than an answer, and picking the largest share
    would assign a plant to the wrong county silently. **The variable set to an empty string disables
    it and every address is "not matched", so the product never fails because the service is down** —
    the site is saved with its name and address as typed, the person is told in one sentence, and they
    may type the county themselves. A person never types a state or county that WAS resolved.
    `DECISIONS.md` §207 A.
19. **The Dashboard greets the COMPANY, and a tab that has been greeted stays greeted.** Added 22 October at step 15.
    The title was the person's first name, and an account made through signup has none — `/api/signup` writes
    `full_name` NULL, because board 6 asks four things and a name is not one — so every new customer saw a bare
    "Welcome". It is the company name now, which is required at signup and closed to editing. And the first visit is
    remembered in `sessionStorage` beside the question skips: the title is derived from `profiles.welcomed_at`, a
    column the Dashboard itself writes as soon as it has drawn, so any second mount after that stamp — a reload, a
    back-then-forward, a second press of the walk's last button — read its own stamp and flipped to "Welcome back" on
    what the person experienced as their first visit. The owner saw it on 22 October; five measured runs could not
    reproduce which trigger, and the mechanism does not depend on knowing. With storage unavailable the page behaves
    exactly as it did before. `DECISIONS.md` §212.

17. **A company has ONE address, and the company row is a mirror of its main site.** Added 21 October
    at step 6b (migration 083). Step 6 made `entities.state/county/city` the geocoded truth, but
    `lib/jurisdiction.ts:93` and `:99` resolve the STATE and COUNTY layers against
    `companies.state/county` — read there by `lib/obligationWriter.ts:98` and passed at
    `lib/resolve.ts:283`. Step 6's own walk proved they drift: the main site moved to Washington
    while the company row stayed Oregon. So a trigger on `entities` copies the main site's three
    columns onto the company, those three leave the person's column grant, and **the four readers are
    deliberately left alone** — moving them is a change to resolution (`CLAUDE.md` §3.1) and belongs
    in its own step with its own golden run. The mirror makes the wrong answer impossible meanwhile.
    The direction is site → company and never the reverse: the site is the only one of the two ever
    read off a real street address. **Moving the readers and retiring the three columns is owed.**

## Open questions

1. ~~**County from an address**~~ — **ANSWERED at the step 5 stop, 21 October.** Nothing geocodes anything today:
   signup asks for a state and a city and sends `county: ''`, so **every company's main site has a NULL county** and
   every county-level agency is silently out of scope. The source will be the **Census Bureau's own free geocoder
   behind a variable**, built in step 6; a shipped HUD ZIP-to-county table was rejected because a split ZIP gives a
   probability rather than an answer. `DECISIONS.md` §207 A.
2. ~~**"Download my data"**~~ — **ANSWERED at step 9, 21 October.** The route exists
   (`app/api/account/export/route.ts`) and still runs green after 082 and 083 — measured as
   `testgamma`: **HTTP 200, 336.6 KB, 25 top-level keys**. It returns **ONE JSON file**, not files:
   the company row, its people (names and ids, nothing from `auth`), documents DESCRIBED rather than
   embedded, folders, reviews, audits, HR audits, checklists and their items, calendar events and
   mailings, obligations and their evidence, sites, corrections, templates and HR's six tables, plus
   a summary. **It reads no `topics` and no `turns`, so the CONVERSATIONS are not in it** — board 5's
   "and conversation, as files" overstates it on two counts, and the page's line says what the file
   actually holds. Adding conversations to the export is owed.
3. **The email-change and invitation emails** — **half answered at step 7, 21 October.** The INVITATION email is
   **ours**, not the login system's: `lib/invitationEmail.ts` through `lib/email.ts`'s template and Resend, so the first
   thing a new colleague reads from this product is in the product's own voice, and because the token is ours — 082
   keeps it out of `authenticated`'s grant, so only a service-role reader can put it in a link. On staging it goes to
   `NOTIFY_TEST_TO` and nowhere else; the sandbox-sender guard is in force. **The EMAIL-CHANGE mail is still the login
   system's** and arrives with step 8, which is where this question is finally settled.

## Change log

| Date | Change |
|---|---|
| 21 Oct 2026 | Plan written: 22 steps in three parts, 14 decisions, 3 open questions. Steps 1–4 done. Boards approved. |
| 22 Oct 2026 | **Part B released.** Steps 12–16 marked Released with their commits; migrations 084, 085 and 086 on production; `main` at `2440cef`. The routine as it ran is in `docs/RELEASE.md`, including what to do when the push is refused with 403. |
| 22 Oct 2026 | Step 15 done (migration 086): the card redrawn. Decision 3 amended — NAICS leaves every screen a person sees, `about` holds the sentence, `what_you_do` holds the broad industry line. Decision 19 added: the Dashboard greets the company, and a greeted tab stays greeted. Step 17's migration is **087**. |
| 22 Oct 2026 | Step 13 done (migration 085): the website read. Decision 9 gains what was built and what the stop settled; step 17's migration is **086** — the plan called it 083, which is `one_address`. |
| 22 Oct 2026 | Step 12 done (migration 084). Decision 8 gains a sentence: `companies.industry` is a join key, so it takes a DEFAULT of `chemical-manufacturing` rather than a question — `DECISIONS.md` §209. Steps 10 and 11's rows corrected: both had been done and the table still said "Not started". Step 17's row no longer calls its migration 083, which is `one_address`. |
| 21 Oct 2026 | Steps 8 and 9 done: the Sign-in tab (name, email, a password change that asks for the current one) and the Cancel tab (board 5's words, the inert subscription row, the export, the delete). Open question 2 answered. Two of the three no-current-password routes closed; /forgot-password stays, because it is recovery. |
| 21 Oct 2026 | Step 7 done: the People tab, invitations, `/join`, remove, and the monthly-email switch read by the job. Open question 3 half answered — the invitation email is ours. |
| 21 Oct 2026 | Step 6b: migration 083 written (not run). Decision 17 added: the company row is a mirror of its main site; state, county and city leave the person's grant, and so do INSERT and DELETE on companies. Company information's company block is down to `industry`. |
| 21 Oct 2026 | Step 6 done: the Company tab, the site drawer and the geocoder; Company information no longer sends the name. Decision 16 added (the Census geocoder behind a variable). `lib/naicsTitles.ts` ships the 1,012 six-digit NAICS 2022 titles. |
| 21 Oct 2026 | Step 5 done: migration 082 written, applied to staging and proved as a signed-in person. Open question 1 answered (nothing geocodes; the Census geocoder in step 6). Decision 15 added: a site with rows is refused, never reassigned; "closing a site" recorded as a later decision. |
