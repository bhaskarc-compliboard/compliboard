# The Dashboard — the plan

**Version:** 3 · **Updated:** 20 October 2026 at step 10, the close-out: every step's status as it ended, the parked
section, and the change log brought level. **Version 2:** 20 October 2026: step 4 done; step 5b (the sidebar, board 4)
and decision 12 added. **Version 1:** 19 October 2026, by the Calendar chat, continued into the Dashboard.

> **The owner's working copy is a Claude Doc, "Dashboard — the master plan".** This file mirrors it so the next
> session can read the plan from the repository. When the two disagree, the owner's doc wins and this file is corrected.
> The pictures are `docs/dashboard-boards.html` (four boards: three approved 19 October, the sidebar 20 October). The read-only map is
> `docs/DASHBOARD-MACHINERY.md` (commit b98a17d). Branch `dashboard`, from `main` at fa26070.

**What it is.** The Dashboard is where a person lands after login. It shows four numbers that only go up, one quick
question at a time, the dates coming in the next 30 days, and the last three audits. No model is called anywhere on the
page, so every test is free.

## Ground rules

- Before any change, find from the code (not memory) everything the change touches in every section, and re-check
  those sections after. Goes at the top of every instruction.
- A claim without a file and line is a hypothesis, and is checked.
- When unsure, ask plainly and politely (Calendar decision 30).
- No model calls in this section. The Haiku guard stays on for every run anyway.
- Never `db:reset` or `db:restore` without the owner. Production is read-only for Claude Code. Claude Code pushes
  nothing; migrations, backup and variables are the owner's.
- `npm run cost` before and after every job; $0 is the expected number here.

## The steps

| # | Step | What it is | Status |
|---|---|---|---|
| 1 | Read-only map | `docs/DASHBOARD-MACHINERY.md`, read from the code and staging; nothing changed | **Done** 19 Oct (`b98a17d`) |
| 2 | Boards | Four boards in the HR frame: the page with history, the question card's four states, the first visit, the sidebar | **Done** 19–20 Oct (`9db6068`) |
| 3 | The plan | The owner's doc; this file mirrors it | **Done** 19 Oct (`9db6068`) |
| 4 | Migration 080 | `files_read` and `audits_done` kept by database triggers, backfilled once; `profiles.welcomed_at`; the gap-checklist bump; **and the profiles grant narrowed** — `authenticated` could update its own `company_id` | **Done** 20 Oct (`4af030e`, `ea3ad63`) |
| 5 | The page shell and the numbers | The 900 column, the welcome title, four tiles from `usage_counters`, dashes when there is nothing; login lands on `/dashboard` | **Done** 20 Oct (`4664f3e`) |
| 5b | The sidebar | Board 4: the green box goes, the active page marked as a workspace marks its active tab, the owner's order, a hairline, "Documents" and "Audit Workspace", plain grey counts | **Done** 20 Oct (`901b835`) |
| 6 | Upcoming and Recent audits | The Calendar's own rows and words for the next 30 days, six and a "more" line; the last three audits, each opening its report. **And the breadcrumb removed** | **Done** 20 Oct (`02b53aa`) |
| 7 | The three questions | One card, one question at a time, from `askableSwitches()`; answers through `/api/switches/answer`; three a calendar day. **And a date's status word moved first in `metaParts`** | **Done** 20 Oct (`3527c1d`) |
| 7b | The help line | Migration 081: `switches.help_plain` for all 22 company-scope questions, eleven questions reworded, `allowed_value_labels` for the three option switches | **Done** 20 Oct (`4682262`) |
| 8 | The owner's test on staging | By hand, every board against the real page, as two test users; free | **Done** 20 Oct. Also the step 8 pre-check: nothing AI-facing reads the requirements library — the three parked items below came out of it |
| 9 | Release | Backup, 080 and 081 on production, the fast-forward and push, the free live checks | **Released** 20 Oct — `3c2c2bf` on `main`, production on `000`–`081`. **Plus the hotfix `f4e09d4`**, found by the owner in the live checks: a report opened from the address could not be closed |
| 10 | Close-out | `docs/HANDOFF-FROM-DASHBOARD.md`; DECISIONS, SCHEMA, TESTING, RELEASE, HANDOFF-CODE §7, TEST-AT-FINISH-LINE, README, STATUS, CLAUDE.md §3.4a | **Done** 20 Oct (this commit) |

## Decisions

1. **Login lands on the Dashboard.** Today it lands on the marketing homepage; only password reset goes to `/dashboard`.
2. **Four numbers, and they only go up:** files read, questions answered, audits done, checklists created. "Issues
   identified" is dropped from this revision — it is a judgement, not an event, and it could overstate.
3. **Files, audits and checklists are counted by the database**, with a trigger on the table that records the event, so
   no route can forget. Questions answered stays on the code's existing bump (a stopped answer does not count, and all
   three chats already get that right). One backfill from today's readings and runs, written so it cannot count twice.
4. **A company with no number yet sees a dash**, not a zero, and no coaching line.
5. **The welcome is the page title.** "Welcome, ‹first name›" the first time this person opens the Dashboard, "Welcome
   back, ‹first name›" after; `profiles.welcomed_at`, set on the first view, decides. No name on file → "Welcome back".
6. **Upcoming** reads the one live view through `liveDates`, shows up to six dates in the next 30 days with the
   Calendar's own words for when, then "N more in the next 30 days" with a link. A row opens the Calendar's drawer
   (`/calendar?tab=calendar&date=`), as today.
7. **Recent audits replaces Recently read.** The last three runs with status `done` (a dismissed run still counts: the
   work was done). A row opens that report on the Audits page; if the Audits page cannot open a run from its address
   today, it learns to, the way the Calendar did.
8. **Three questions a calendar day**, one at a time, from `askableSwitches()` — company-scope only, never a site
   question on a company page. The question's words and its grey help line come from the switch itself, so Company
   information and the Dashboard ask alike. Answers go through `/api/switches/answer`, so there is one home for facts
   (its quiet recompute of obligations is kept; nothing shows them yet). No "that settled N requirements" line. "I don't
   know yet" moves to the next question and leaves the switch unanswered. After the third, the card goes quiet until
   another day.
9. **The questions never come from the Company information proposals queue.** 56 of its 60 pending keys on staging are
   names the scanner invented, not switches. Fixing that queue is Documents / Company information work, recorded in
   HANDOFF-CODE §7.
10. **Slightly-off numbers are acceptable to the owner**; nobody audits them. Honesty still: every number is a real
    event, never an estimate.
11. **The Dashboard prints nothing**, so it stays out of the print frame.
12. **The sidebar (board 4, 20 Oct).** Order: Dashboard, Compliance Workspace, Audit Workspace, HR Workspace, Calendar,
    Documents; a thin line; Company information, My Account. The active page is marked exactly as a workspace's active
    tab: the word in `--brand-strong`, a 2px underline in `--brand`; no box. "Company Documents" becomes "Documents";
    "Audits" becomes "Audit Workspace". Counts are plain small grey numbers, shown only when something waits for a person.

## Open questions

1. ~~Where "three today" is kept~~ — settled at step 4: counted from `switch_determinations` rows with `source = 'user_set'`
   written today; the day's skips live in the browser; no column.
2. Whether HR's handbook audits are `audit_runs` rows and so appear under Recent audits. Settled by the step 6 read.

## Parked for the final check

**The owner's decision, not Claude Code's.** All three came out of the step 8 pre-check (20 October), which asked
whether anything AI-facing reads the requirements library. Nothing does; these are the three things that would make
that rule visible in the product rather than merely true.

1. **The confirmation queue and its badge, hidden on production behind a flag** until the invented-keys fault is
   fixed. Facts already confirmed stay visible; only the "WAITING FOR YOU" section and the sidebar count go.
   Three files, all display: one name added to `PipelineSwitch` in `lib/pipelineConfig.ts`, the section wrapped in
   `app/company-information/page.tsx`, and the badge's fetch skipped in `components/AppLayout.tsx:136`. No
   migration.
2. **A guard on the requirements route and page.** `/requirements` is linked from nowhere, so a customer cannot
   reach it by accident — but `GET /api/obligations` **writes** 200-odd rows on a first visit, so guarding the page
   alone would leave a writable endpoint behind it. Four lines in each. No migration.
3. **The invented keys out of the shared brief.** `lib/companyContext.ts:357` puts `fact_proposals` key names into
   every HR answer's and every document draft's context as "names in circulation". Filtering them to real switches
   is one `.in()` clause — **and it is a prompt-input change, so `CLAUDE.md` §3.1 makes it the owner's to approve.**

**Collecting stays on in every case**: the Dashboard's questions and Company information's editor both write through
`/api/switches/answer`, which none of this touches.

## Change log

| Date | Change |
|---|---|
| 20 Oct 2026 | **Step 10, the close-out** (this commit): `docs/HANDOFF-FROM-DASHBOARD.md` written; `DECISIONS.md` §204–§206; SCHEMA, TESTING, RELEASE, HANDOFF-CODE §7, TEST-AT-FINISH-LINE, README, STATUS, CLAUDE.md §3.4a. v3: every step's status as it ended, and this parked section — which did not exist when step 10 asked for it to be copied, and was written here from the step 8 pre-check. |
| 20 Oct 2026 | **The hotfix** (`f4e09d4`), found by the owner in the step 9 live checks: `/audits?run=<id>` opened a report the X could not close, because `router.replace` will not navigate to the bare path of a prerendered route. The same line had broken the tab, unnoticed. **`next dev` does not reproduce it** — hence the standing rule: one measured walk per release against a production build. Escape now closes every drawer in the product. |
| 20 Oct 2026 | **Step 9, the release** (`3c2c2bf`): 080 and 081 on production, `main` fast-forwarded, the ten free live checks. No new environment variable. |
| 20 Oct 2026 | **Step 8 and its pre-check**: nothing AI-facing reads `requirement_templates`, `obligations` or `applies_expression` — 51 files checked, 0 hits, against 205 repo-wide. The three parked items above came out of it. |
| 20 Oct 2026 | **Step 7b** (`4682262`): migration 081 — the help line, eleven rewordings, option labels. Its self-test refused the first run over a rule that was too blunt; the rule is now a clause joiner, not the word "or". |
| 20 Oct 2026 | **Step 7** (`3527c1d`): the three questions; open question 1 settled in code; a date's status word moved first in `metaParts`, which changes the Calendar's list too. |
| 20 Oct 2026 | **Step 6** (`02b53aa`): Upcoming and Recent audits; open question 2 answered — HR's handbook audits are `handbook_checks`, not `audit_runs`; the breadcrumb removed. |
| 20 Oct 2026 | **Step 5b** (`901b835`): the sidebar, measured before and after on all eight signed-in pages. |
| 20 Oct 2026 | **Step 5** (`4664f3e`): the shell, the welcome, the four numbers, login lands on the Dashboard. |
| 20 Oct 2026 | **Step 4** (`4af030e`, `ea3ad63`): 080 on staging; the profiles grant narrowed (`authenticated` could update `company_id` — a tenancy hole, now closed); open question 1 settled. Board 4 approved; step 5b and decision 12 added. |
| 19 Oct 2026 | Plan written: 10 steps, 11 decisions, 2 open questions. Steps 1–3 done. Boards approved. |
