# The Dashboard — the plan

**Version:** 1 · **Written:** 19 October 2026, by the Calendar chat, continued into the Dashboard.

> **The owner's working copy is a Claude Doc, "Dashboard — the master plan".** This file mirrors it so the next
> session can read the plan from the repository. When the two disagree, the owner's doc wins and this file is corrected.
> The pictures are `docs/dashboard-boards.html` (three boards, approved 19 October). The read-only map is
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
| 1 | Read-only map | `docs/DASHBOARD-MACHINERY.md`, read from the code and staging; nothing changed | Done 19 Oct (b98a17d) |
| 2 | Boards | Three boards in the HR frame: the page with history, the question card's four states, the first visit | Done 19 Oct |
| 3 | The plan | The owner's doc; this file mirrors it | Done 19 Oct |
| 4 | Migration 080 | Two counters that never go down (`files_read`, `audits_done`) kept by database triggers, backfilled once; `profiles.welcomed_at`; the gap-checklist bump. One stop: the migration is reviewed in the chat before it runs on staging | Not started |
| 5 | The page shell and the numbers | The Dashboard moves onto the shared frame and column; the welcome title; four tiles reading `usage_counters`, dashes when there is nothing; login lands on `/dashboard` | Not started |
| 6 | Upcoming and Recent audits | The Calendar's rows and words for the next 30 days, up to six and a "more" line; the last three audits, each opening its report on the Audits page | Not started |
| 7 | The three questions | One card, one question at a time, from the existing ranking (`lib/switchAsk.ts`, `GET /api/switches/ask`); answers through `/api/switches/answer`; three a calendar day, then the quiet card | Not started |
| 8 | The owner's test on staging | By hand, every board against the real page, as two test users; free | Not started |
| 9 | Release | The routine, short form: backup, 080 on production, push, the free checks | Not started |
| 10 | Close-out | `docs/HANDOFF-FROM-DASHBOARD.md`; DECISIONS, SCHEMA, TESTING, HANDOFF-CODE §7, TEST-AT-FINISH-LINE scenarios; CLAUDE.md §3.4a says Opus 5; README marks the three archived handoffs; project docs synced | Not started |

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

## Open questions

1. Where "three today" is kept: counted from `switch_determinations` written today, with the day's skips held in the
   browser — or one small column. Settled at the step 4 stop.
2. Whether HR's handbook audits are `audit_runs` rows and so appear under Recent audits. Settled by the step 6 read.

## Change log

| Date | Change |
|---|---|
| 19 Oct 2026 | Plan written: 10 steps, 11 decisions, 2 open questions. Steps 1–3 done. Boards approved. |
