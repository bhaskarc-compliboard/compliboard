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
| 7 | The People tab | Who can sign in; invite by email → a link; `/join` where the person sets their own password; remove; the monthly-email switch read by the job | Not started |
| 8 | The Sign-in tab | Name; email change with confirmation; password change that asks for the current one; the shared sheet | Not started |
| 9 | The Cancel tab | Download my data; delete the company (today's flow, the boards' words). The subscription line arrives with part C | Not started |
| 10 | The owner's test, part A | By hand on staging; free | Not started |
| 11 | Release A | The routine: backup, 082 on production, read back, push, the built-app walk, live checks | Not started |
| **B** | **The front door** | | |
| 12 | Signup | Four fields; the account, the company and its main site created together; the trial starts; lands on the walk | Not started |
| 13 | The website read | `AI_MODEL_WEBSITE` (Opus 5.5 to start); one read; the card proposes name, what they do, addresses; nothing written until "Yes, that's us". One stop: the prompt and two real cards reviewed first | Not started |
| 14 | The walk | Three screens; every screen can be left; the Dashboard picks up | Not started |
| 15 | The owner's test, part B | Real websites, Opus 5.5 against Sonnet 5.5, side by side | Not started |
| 16 | Release B | The routine; `AI_MODEL_WEBSITE` set on Vercel by the owner | Not started |
| **C** | **Billing** | | |
| 17 | Stripe, the wiring | The owner's Stripe account and keys; migration 083 (`stripe_customer_id`, `subscription_status`, `trial_ends_at`, `current_period_end`); checkout and portal routes; the webhook. One stop | Not started |
| 18 | The read-only state | One rule the paid routes check; the banner; the 7-day grace; the daily job that ends trials | Not started |
| 19 | The Billing tab and the Cancel tab's subscription line | As drawn | Not started |
| 20 | The owner's test, part C | Stripe test mode: a test card, a failing card, the trial ending | Not started |
| 21 | Release C | The routine | Not started |
| 22 | Close-out | `docs/HANDOFF-FROM-ACCOUNT.md`; DECISIONS, SCHEMA, TESTING, RELEASE, HANDOFF-CODE §7, TEST-AT-FINISH-LINE; project docs synced | Not started |

## Decisions

1. **The company name is not editable by a person**, from either door (My Account and Company information). It is tied
   to the company id and everything hangs on it. A wrong name is fixed by us.
2. **Email is editable**, with a confirmation link to the new address; the old address keeps working until it is clicked.
3. **"What you do" is typed, with suggestions** from a standard list (the NAICS titles); anything typed is kept, and the
   standard code is stored when a suggestion was picked. Never a dropdown. Which requirements library a company gets is
   a separate, unseen column (`chemical` for everyone today).
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
   account, together or not at all.
9. **The website is the first door for information.** One read, on `AI_MODEL_WEBSITE` (Opus 5.5 to start; Sonnet 5.5
   compared at the test). It proposes; the person confirms; nothing is written on the model's word alone.
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
2. **"Download my data"**: does the route exist and what does it produce? Settled by the step 9 read.
3. **The email-change and invitation emails** are sent by the login system, not by our sender; on staging they reach real
   addresses. The owner tests with his own.

## Change log

| Date | Change |
|---|---|
| 21 Oct 2026 | Plan written: 22 steps in three parts, 14 decisions, 3 open questions. Steps 1–4 done. Boards approved. |
| 21 Oct 2026 | Step 6b: migration 083 written (not run). Decision 17 added: the company row is a mirror of its main site; state, county and city leave the person's grant, and so do INSERT and DELETE on companies. Company information's company block is down to `industry`. |
| 21 Oct 2026 | Step 6 done: the Company tab, the site drawer and the geocoder; Company information no longer sends the name. Decision 16 added (the Census geocoder behind a variable). `lib/naicsTitles.ts` ships the 1,012 six-digit NAICS 2022 titles. |
| 21 Oct 2026 | Step 5 done: migration 082 written, applied to staging and proved as a signed-in person. Open question 1 answered (nothing geocodes; the Census geocoder in step 6). Decision 15 added: a site with rows is refused, never reassigned; "closing a site" recorded as a later decision. |
