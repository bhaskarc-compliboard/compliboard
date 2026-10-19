# Handoff — from the Calendar section

**Version:** 1 · **Updated:** 19 October 2026, by the Calendar chat at the close of the Calendar's build
(`docs/CALENDAR-PLAN.md` step 15).
**Supersedes:** nothing. This is the close-out file `docs/CALENDAR-PLAN.md` step 15 calls for; it is written in the
shape of `docs/HANDOFF-FROM-HR.md`, which is the file to read beside it.
**For:** the next section's chat, any later Calendar chat, and Claude Code. Read it first, then the files it points to.
**Checked against:** the repository at `da7d2f0` (local, 19 October 2026), `npm run preflight`, and the staging and
production reads quoted below. **Corrected within the hour of being written:** it said migration 079 was pending on
production; the owner applied it while this file was being written, and every figure below was re-read afterwards. **Where this file and the repository disagree, the repository wins:
say so and correct this file.**

---

## 0. In one paragraph

The Calendar is **live on production** at `https://compliboard.vercel.app/calendar`. Every date the product knows
lives in **one table** and is written by **one function**. Dates arrive on their own: a document reading or a
finished audit proposes them, a person confirms or removes them, and a person may type one. The section is four
tabs — Ask a question · Conversations · Calendar · Dates to confirm — a month grid and a list, a drawer that says
everything about one date including the document's own report, a confirm queue, a subscription feed for Google and
Outlook, and one email on the first of the month. The chat runs on the **shared ask engine** (`lib/ask/`), which is
HR's answer route lifted out and made general; Calendar is its first and so far only customer. **Migrations 073–079
are on production** (`npm run preflight`: `PENDING COUNT: 0`). **One release gate is
still open: the Resend sending domain's DNS**, and until it is done the monthly job refuses to send on production
rather than mailing customers from Resend's sandbox address. §7 lists what is owed, in order.

---

## 1. Read these, in this order

| File | Why |
| --- | --- |
| `CLAUDE.md` | The project rules. §3.4a (the `npm run haiku` guard), §3.6 (RLS is the boundary), §3.7 (production is SELECT only; no reset without the owner), §3.11, §9.1, §9a |
| `docs/CALENDAR-PLAN.md` (v19) | The Calendar's plan: the owner's vision (§2.1), decisions 1–32 (§2.3), the steps and what each proved (§2.4), the contract for the table and `proposeDate` (§2.6) |
| `docs/DECISIONS.md` §185–§201 | Every Calendar step: what was built, what was proved, what it cost, and its effects on other sections by file |
| `docs/calendar-boards.html` | The owner's twelve boards. Every screen was drawn here before it was built, and the words on them are his |
| `docs/TEST-AT-FINISH-LINE.md`, the Calendar part | Everything the Calendar leaves for the end, in blocks A–J, the same shape HR used |
| `docs/TESTING.md` | The Calendar's manual sets: C7 to C14b |
| `docs/RELEASE.md` | How a change reaches production, **and the Calendar's own release routine** (step 0, the DNS gate, to step 9, the 1st of November) |
| `STATUS.md` | The Calendar row |
| `docs/HANDOFF-CODE.md` §7 | Open defects and owed work, the Calendar's among them |
| `docs/CALENDAR-MACHINERY.md` | The read-only map of 15 October: every file that touched a date before this section existed. Its "B" numbers are cited all through the decisions |
| `docs/HANDOFF-FROM-HR.md` | The section this one copied: the frame, the night-job shape, and the engine the chat was lifted from |

---

## 2. Where the Calendar stands

**On production** (`https://compliboard.vercel.app`):

- **The code:** `main` at `da7d2f0`. The owner merged `calendar-v2` and ran `docs/RELEASE.md`'s calendar routine.
- **The database:** migrations `000`–`079` on both. `npm run preflight`, 19 October: **`PENDING COUNT: 0`**. The
  owner applied 079 on 19 October, a few hours after it was written.
- **What 079 did, read back from production afterwards** (`RELEASE.md` step 3a's own query): **67 live rows now have
  a day the calendar places and 7 need one**, where it was 47 and 27 — **the 20 that moved are exactly the class the
  migration was for**, and the figures match what was predicted from the pre-migration read to the row. Of the 20,
  **one** has a day behind it and now reads "passed"; the other 19 passed rows are one-offs, as before.
- **The one variable the release added:** `AI_MODEL_CALENDAR = claude-opus-5-5` (values live in `docs/RELEASE.md`,
  which is the authoritative list; `CLAUDE.md` deliberately carries only the names).
- **The cron:** `/api/jobs/calendar-month`, `0 14 1 * *` (the 1st at 14:00 UTC), in `vercel.json`.
- **The gate that is still shut:** all four product emails send from `onboarding@resend.dev`, Resend's shared
  sandbox address. On production the monthly job **refuses to run** while that is true — it claims nothing, sends
  nothing, logs one line, writes the reason on its `job_runs` row and answers 503 (`lib/email.ts`
  `sandboxSenderRefusal`). So the first of the month cannot email customers from the sandbox, whatever anybody
  forgets. Verifying the domain and changing the four `from:` lines is step 0 of the calendar routine.

**Figures, read with one SELECT each on 19 October** (production, then staging):

| | production | staging |
|---|---|---|
| live rows (`status in (proposed, confirmed)`, `replaced_by` null) | 74 | 52 |
| with a day the calendar places | 47 → **67**, after 079 | 40 (16 before it) |
| needing a day | 27 → **7**, after 079 | 12 |
| companies with a person to email | 4 | — |

**Cost of the whole build: $1.01.** Every build step ran on Haiku through the guard; the one Opus run was step 13's
machinery check, **$0.9109** of a $2.00 budget, and step 10b's walk was **$0.1009**. Steps 5–9, 11, 12, 14, 14b and
15 cost **$0.00**.

**Tests:** 1377 at `da7d2f0` (`npm run check`). `check:live` carries the Calendar's four relations and, since 14b,
the day rule as a real signed-in person.

---

## 3. What the Calendar is (the owner's vision, as built)

> Every date your documents set, in one place. Ask when something is due, and we say where the date came from.

- **Dates arrive; nobody types them in.** A document reading or a finished audit proposes a date the moment it
  finds one. A person confirms it, removes it with an optional reason, or sets how often it repeats and — since
  step 14b — which day it falls on.
- **A proposed date shows everywhere** (decision 8): the month, the list, the Dashboard, the chat's answers and the
  email. Confirming is a quality mark, not a gate. On the page it is marked "not confirmed"; the email carries no
  such mark (decision 18).
- **Nothing is ever deleted and nothing is "done"** (decision 11). A date has **passed**; it is never "overdue".
  A person removes it, with their name on the removal, and it stays in the table.
- **The product says what it does not know** (decision 30): a repeating date whose frequency was never read, a day
  that was never read, a document with a newer version, a site that no longer exists, a date the chat could not
  find. Never a silent guess shown as read.
- **The month and the list show dates and nothing else** (decision 32, step 14b). Every question for a person lives
  in the date drawer and in Dates to confirm.

---

## 4. How it works, end to end

### 4.1 One table, one writer

`calendar_events` (migration 073) holds every date in the product. Every row names its **source**
(`document | audit | handbook | rule | person`), the **line it was read from**, its **site**, and its **status**
(`proposed | confirmed | dismissed | withdrawn`).

**`proposeDate()` in `lib/calendarDates.ts` is the only thing that creates a date** (decision 6). Documents calls it
(`lib/documentScan.ts`), Audits calls it (`lib/auditRun.ts`), the chat's offer calls it through
`POST /api/calendar`, and Add a date calls it. It returns one of four outcomes — `created`, `existing`, `replaced`,
`revived` — and holds the invariant no constraint can see: **at most one live row per (company, document,
lower(title))**, a moved date superseding the one it replaces rather than sitting beside it.

The other four writers are `confirmDate`, `dismissDate`, `setPeriod` and `setDay`, each loading the row through the
**caller's own client** so RLS decides tenancy and another company's row is simply absent — 404, never 403.

### 4.2 `calendar_v` is what every screen reads

One view, `security_invoker`, every base column plus five computed ones: `next_due`, `days_until`, `has_passed`,
`source_title` and the site read **live from the document**, so a correction in Documents reaches the calendar with
no code here. **Nothing derived is stored** (migration 049's rule).

`next_due`, as it stands after 079:

| the row | `next_due` |
|---|---|
| a one-off | its own day, passed or not |
| repeating, a day and a period | the next occurrence, counted from the anchor; never in the past |
| **repeating, a day, no period** | **that day** (079) — the document said a day; only what follows it is unknown |
| repeating, no day | null, with or without a period (decision 12) |

`has_passed` is `next_due < current_date`, said once off the day the product shows.

**`liveDates()` / `liveDatesFor()` in `lib/calendarCounts.ts` is the one filter** — `status in ('proposed',
'confirmed')` and `replaced_by is null` — shared by the tab counts, the sidebar badge, both views, the queue, the
drawer, the chat's context, the Dashboard, the feed and the email. No two surfaces can disagree about what is on
the calendar. A withdrawn row never reaches any of them: the view drops it (decision 29, migration 075).

### 4.3 What the section reads

`calendar_v` (everything), `document_index_v` (the queue's group headings and the drawer's document facts),
`audit_findings` (the drawer's audit card), `entities` (the sites), `profiles` and `auth.users` (who confirmed
what, and who the email goes to), `topic_list_v` (the Conversations tab). **The chat's context additionally packs
the readings behind the dates and the audit findings** — `lib/ask/calendarBrief.ts`.

### 4.4 The chat, and the shared engine (decision 28)

`lib/ask/` is **HR's answer route lifted out and made general**. HR was deliberately not touched; it still runs its
own copy, and that duplication is paid off by moving HR over after this release.

A section joins by writing **a Brief** (`lib/ask/brief.ts`) with five things and no sixth:

| field | what it is |
|---|---|
| `section` | which `topics.section` these conversations are, and which model tier and ledger task the call runs on |
| `words` | every sentence the screens say. No sentence a person reads lives in the engine |
| `packContext` | what the question is answered FROM, as named blocks with a budget, plus the passages a quote may be checked against |
| `promptSentences` | added after the shared system prompt, in order |
| `offers` | which structured offers an answer may end with (`add_date` is the only kind today) |
| `extraStep` *(optional)* | one more call after the answer — the escape hatch for HR's agency check |

`checkBrief()` **throws** on a sixth field, at the moment it is used: a sixth kind of difference between sections is
a conversation with the owner, not a field.

**To move a section onto the engine** (the order HR, Audits and the Workspace should follow):

1. Add the section's word to `topics.section`'s CHECK (a migration) and to `TopicSection` in `lib/topicList.ts`.
2. Add its tier to `lib/ai.ts` `AITask` and its task to `lib/costLedger.ts` and `ai_calls_task_check`.
3. Write `lib/ask/<section>Brief.ts`: the five fields. `packContext` is the only real work — it is where the
   section says what it knows, in blocks, with a budget and a sentence for whatever did not fit.
4. Add a route that calls `answer(brief, ctx)` and streams, and one that calls `summarise(...)`.
5. **Run both paths side by side with the old one on the same questions** and compare words, links, stored rows and
   cost — that is the decision-28 switch-over, not a swap.
6. Delete the section's own copies (for HR: `lib/hrAnswer.ts`'s link check, quote check, marker numbering and
   history rebuild). `tests/unit/askEngine.test.ts` holds that no engine file imports HR's, so this is a deletion
   and not an untangling.

### 4.5 The monthly email, and its gate

`/api/jobs/calendar-month`, the 1st at 14:00 UTC, in the night-job shape: the cron secret first (404 for every
refusal), then one `job_runs` row opened before the work.

**The claim comes first, before the render and before the send.** `calendar_mailings` has `unique (company_id,
month)`, so the job INSERTs that row as its claim; a unique violation means another run has this company and this
month. A failed send **keeps** its claim — freeing it automatically would email everybody twice at the next cron —
and a person clears the row having read why.

What it says is a pure function: `lib/calendarEmail.ts` turns rows into the one shared template's shape
(`lib/email.ts`, decision 25) — due this month, early next month, passed last month, a line for the dates that need
a day, grouped by site only when there is more than one site (decision 24), **no confirmed marks anywhere**
(decision 18).

**Nothing leaves for a real address on staging:** `NOTIFY_TEST_TO` is the To when it is set, and it is **absent on
production by design and must stay absent**. And nothing leaves at all from the sandbox sender on production — §2.

### 4.6 The feed

`GET /api/calendar/feed?t=<token>` is **the one route in the product with no session**, because Google and Outlook
fetch a subscribed calendar from their own servers carrying nothing of the person. The address is the credential:
the company comes from the token row and never from the query string, the service role is used for two named reads
and no write, and everything else — no token, a malformed one, an unknown one, a revoked one — is the same empty
**404**. One generator, `lib/calendarIcs.ts`, serves both the feed and the one-time `.ics` download, and **the
person's own note is never in either** (the owner).

### 4.7 Models and the ledger

| path | tier | ledger task | model on production |
|---|---|---|---|
| the chat's answer | `calendar` | `calendar` | `AI_MODEL_CALENDAR` = `claude-opus-5-5` |
| the conversation summary | `summary` | `summary` | as the workspace's |
| **the monthly email** | — | — | **it calls no model at all** |

An answer on Opus cost **$0.157–$0.273** against **$0.0073** on Haiku, measured at step 13: 21–37× for an answer
that is much better — 4 of 5 web sources official where Haiku had 0 of 3, and "I can't tell you yet" where it does
not know.

---

## 5. The code map

**Page:** `app/calendar/page.tsx` (~1,000 lines, the whole client page).

**Routes**

| Route | Does |
| --- | --- |
| `app/api/calendar/route.ts` | POST add a date; PATCH with one of five actions — `confirm`, `dismiss`, `period`, `day`, `confirm_many` |
| `app/api/calendar/answer/route.ts` | POST an answer (streamed), over `lib/ask/` |
| `app/api/calendar/topics/[id]/summarise/route.ts` | POST summarise a conversation |
| `app/api/calendar/feed/route.ts` | GET the subscription feed — **no session**, token only |
| `app/api/calendar/feed-token/route.ts` | POST mint or rotate this company's feed token |
| `app/api/jobs/calendar-month/route.ts` | GET (cron) / POST (by hand): the monthly email |

**Libraries and prompts**

| File | Does |
| --- | --- |
| `lib/calendarDates.ts` | **The one writer.** `proposeDate`, `confirmDate`, `dismissDate`, `setPeriod`, `setDay`, `confirmMany`, and the two withdrawal rules |
| `lib/calendarCounts.ts` | **The one filter.** `liveDates`, `liveDatesFor`, the counts and the info bar's fragments |
| `lib/calendarView.ts` | What the two views show and every phrase they say |
| `lib/calendarQueue.ts` | The confirm queue's shape and words, and "Needs a day or how often" |
| `lib/calendarEmail.ts` | The monthly email as pure data |
| `lib/calendarIcs.ts` | The `.ics`, for the feed and the download |
| `lib/ask/brief.ts`, `engine.ts`, `passages.ts`, `offers.ts` | The shared chat engine |
| `lib/ask/calendarBrief.ts` | The Calendar's brief: what its answers are given |
| `prompts/ask.ts`, `prompts/calendar-answer.ts` | The shared system prompt and the Calendar's sentences |

**Components:** `CalendarDateDrawer.tsx`, `DateQueue.tsx`, `AddDateSheet.tsx`, `RemoveDateSheet.tsx`,
`SendCalendarSheet.tsx`, `CalendarAsk.tsx`. Everything else is imported from the shared set, never copied.

**Migrations**

| # | Adds | Where |
| --- | --- | --- |
| 073 | One table for every date: the rename, the drops, the CHECKs, the keys, the indexes, `calendar_v`, `calendar_mailings`, `calendar_feed_tokens`; `calendar` added to the ledger, the job names and `topics.section` | production |
| 074 | Files the dates already read — every current document reading's deadlines onto the calendar | production |
| 075 | The fourth status word `withdrawn` and `withdrawn_at`; `calendar_v` stops returning those rows (decision 29) | production |
| 076 | One live feed token per company (the partial unique index step 8b owed) | production |
| 077 | A mailing is claimed before it is sent: `calendar_mailings.sent_at` becomes nullable | production |
| 078 | A person may only make the moves the product offers: a column-level UPDATE grant plus a trigger over `calendar_person_move_refusal` | production |
| 079 | A repeating date with a day is a date: `calendar_v`'s `next_due` and `has_passed`; `calendar_person_day_refusal`; `grant update (due_date)` | production |

**Tests:** `tests/unit/calendarDates.test.ts`, `calendarView.test.ts`, `calendarQueue.test.ts`,
`calendarEmail.test.ts`, `calendarIcs.test.ts`, `calendarShell.test.ts`, `askEngine.test.ts`. `check:live` carries
the Calendar's four relations, the 078 move rules and the 079 day rule, each as a real signed-in person.

---

## 6. What the Calendar changed outside the Calendar, and the shared files

**The cross-section rule** (`DECISIONS.md` §180, decision 26): a section that changes a shared file before the
finish line re-runs the free checks of every section that uses it.

**What was changed, and why** — every file outside `app/calendar`, `lib/calendar*` and the Calendar's own
components, read from `git diff 54ec6ae..da7d2f0`:

| File | What and why |
| --- | --- |
| `lib/documentScan.ts` | One `proposeDate()` call beside the `document_deadlines` insert, and one guarded withdrawal after the filing loop (decisions 6 and 29). **This is how dates arrive at all.** |
| `lib/auditRun.ts` | The same two: one call beside the findings insert, one withdrawal in `finishRunIfDone`, and a `calendar_withdrawn` count on the run summary |
| `app/api/document-actions/route.ts` | The `deadline_to_calendar` case **deleted** (decision 7): sections stop asking, dates arrive |
| `components/DocumentReport.tsx` | "Add to calendar" became a line with a link, plus a fourth wording for a withdrawn date |
| `components/AuditReport.tsx` | The same, and the `/calendar?add=` link became a line |
| `app/api/documents/report/route.ts` | The drawer embeds each deadline's calendar row (id and status) so the report can say where the date went |
| `app/api/audit-runs/[id]/route.ts` | The same for findings |
| `app/dashboard/page.tsx` | Reads `calendar_v` through `liveDates` instead of the old route, so it stops showing removed dates and days the view refuses to compute (step 12) |
| `components/AppLayout.tsx` | The Calendar's sidebar badge and `COUNTS_CHANGED`, so confirming the last date takes the badge with it |
| `components/AttachControl.tsx` | **Moved out of `app/hr/HrWorkspace.tsx` character for character** so both chats draw the same control. HR renders the moved file |
| `components/AnswerBody.tsx` | A source card may carry an `href`: a calendar date opens its drawer. HR's handbook card has nowhere to go and is unchanged |
| `lib/ai.ts`, `lib/costLedger.ts` | The `calendar` tier and ledger task |
| `lib/jobAuth.ts`, `lib/jobRun.ts`, `vercel.json` | The `calendar_month` job name and its cron row |
| `lib/topicList.ts` | `TopicSection` gains `'calendar'` |
| `lib/documentStatus.ts` | `KIND_WORD` shared, so the queue and the drawer say what Documents says |
| `lib/email.ts` | **The one email template** (decision 25), and the sandbox-sender rule |
| `app/api/account/route.ts`, `app/api/account/export/route.ts` | Delete and export cover `calendar_mailings` and `calendar_feed_tokens` |
| `app/documents/page.tsx` | A `?return=` parameter, so a link from the Calendar comes back |
| `config/examples.ts` | The Calendar's three example questions, where the owner can edit them |
| `app/api/extract-dates/route.ts`, `prompts/extract-dates.ts` | **Deleted** (decision 15): the old importer had no caller left |
| `scripts/check-live.js` | The Calendar's probes |
| `scripts/check-schema-contracts.js` | Knows the new relations |
| `scripts/measure-layout.mjs` | `--select`, `--type`, ordered actions and `--date` — all available to every section's walks |

**Shared files the Calendar depends on.** A change to any of these re-runs the Calendar's free checks:
`lib/ask/*` (and `prompts/ask.ts`), `lib/email.ts`, `lib/topicList.ts`, `lib/topicClaim.ts`, `lib/listWords.ts`,
`lib/conversation.ts`, `lib/summaryReport.ts`, `lib/howTo.ts`, `lib/documentStatus.ts`, `lib/printFrame.ts`,
`lib/pipelineConfig.ts`, `lib/ai.ts`; `components/Drawer.tsx`, `Sheet.tsx`, `Tabs.tsx`, `Empty.tsx`,
`AnswerBody.tsx`, `ReportView.tsx`, `ConversationList.tsx`, `AttachControl.tsx`, `buttonStyles.ts`,
`DocumentReport.tsx`, `AuditReport.tsx`; `vercel.json`.

---

## 7. What is owed, in order

1. **The Resend sending domain's DNS — the release gate** (decision 19). Verify the domain in Resend, add the three
   records, then **one commit that moves all four `from:` lines** and gives the three older senders the same guard
   the monthly job has. `docs/RELEASE.md`'s calendar routine, step 0; `HANDOFF-CODE.md` §7. **Until this is done the
   monthly email does not go out on production, by design** — and a `job_runs` row will say so on 1 November.
2. ~~**Migration 079 on production.**~~ **Done by the owner, 19 October:** `PENDING COUNT: 0`, and the read-back
   gives 67 dates placed and 7 needing a day, which is what `RELEASE.md` step 3a said to expect.
3. **The three existing emails onto the one template** (decision 25): `lib/documentBatch.ts`, `lib/auditNotify.ts`,
   `lib/handbookCheckNotify.ts`. Each moves with its own walk and its own test. They take the sandbox guard in (1).
4. **HR, Audits and the Workspace onto the shared engine** (decision 28) — the six steps in §4.4, one section at a
   time, each with the side-by-side comparison before the old path is deleted.
5. **Company information's literal `'FACTS_CHANGED'`** (`app/company-information/page.tsx:318`): one line, found
   while adding `COUNTS_CHANGED`, needs that page's own walk.
6. **`same_as_deadline_id` in the document-scan prompt** — a Documents change, and the long-term fix for the title
   drift decision 29 works around (§189). Measured, like every prompt change.
7. **A month-only precision flag on `document_deadlines`** — also Documents' — so decision 30's *"the certificate
   gives the month, not the day. We've placed it on 30 November; pick the day if you know it"* becomes sayable.
   Today nothing records that a document gave only a month, so that line is left out rather than guessed.
8. **The Dashboard's own rebuild, whenever it happens, keeps its calendar read.** Its upcoming list must go on
   reading `calendar_v` through `liveDates` with `next_due`, `days_until` and `has_passed` in the select — step 12's
   screenshot caught a bug no test had, because `days_until` was missing and every row was filtered out.

---

## 8. Known defects and limits

- **`check:live` cannot be pointed at production.** It signs in as the staging fixture and writes a probe row into
  every tenant table, and its database client is built from `NEXT_PUBLIC_SUPABASE_URL`. The free production checks
  are unauthenticated `curl` probes, written out in the release routine, step 6.
- **Nothing records whether the three older emails have ever reached anybody but the owner.** The sandbox sender is
  normally limited to the account's own verified address. `notified_at` is stamped on Resend's *acceptance*, not on
  delivery. Only the Resend dashboard can settle it; check while verifying the domain.
- **A withdrawn date shows a fourth, unlinked line in both report drawers** — "Not in the latest reading of this
  file" / "Not in the latest audit of this agency" — with no link, because `calendar_v` does not return the row.
  Expected, not a defect.
- **The Calendar's conversation drawer has no Delete and no facts line**, where HR's has both. Neither was in the
  step 10b brief; the route for the first exists already and is section-agnostic.
- **`period` is never inferred from a title.** "next **annual** maintenance" is prose, and reading a frequency out
  of it is the guess decision 30 forbids. The scan returns a boolean and no period (decision 23).

---

## 9. Held for the finish line

`docs/TEST-AT-FINISH-LINE.md`, the Calendar part (A–J): the yardstick on Opus, the eleven scenarios in its F, the
two switches, and the manual sets C7–C14b. **Nothing in this repository says any of them has been run by a person.**

---

## 10. Test data

**Staging**, read 19 October: **Cascade Specialty Chemicals, LLC** — 37 live dates, 22 of them repeating with a day
and no period, 11 needing a day; the richest company for looking at the two views. **Test Gamma Solvents**
(`testgamma@example.com`, the `check:live` and `npm run measure` fixture) — 12 live dates, 2 moved onto the grid by
079, 1 needing a day (*"Respirator fit testing"*, confirmed, which is the example of a row the queue never shows and
the new section does). **Test Alpha Chemical** — 3 dates, all one-offs.

Build-test conversations and probe dates are on all three; clean them before the yardstick.

---

## 11. How the Calendar chat worked, and the lessons worth carrying

- **The plan was written and locked before any code** (`docs/CALENDAR-PLAN.md`), and every step's brief opened with
  the standing instruction: *find from the repository and the live schema every file, query, view, job, test and
  page that reads or writes what you are about to touch, and list them with what happens to each.* Twice that found
  a reader nobody remembered — the Dashboard, and the report drawers.
- **Every absence was proved with a presence first** (§9a). The step 14 production reads each carried a control;
  step 14a's "staging holds no such row" was paired with the same query on production returning 3 and 2.
- **A guard is tested by running it, not by reading it.** The sandbox-sender refusal was proved on a
  production-flagged isolated server with both controls, and the proof was taken from the database rather than
  from the HTTP status.
- **Two corrections the files forced on a brief**, both written up rather than papered over: `RELEASE.md` had never
  had a backup step, and `check:live` cannot be aimed at production.
- **The owner's own look found what the tests could not.** Step 14b exists because he opened the calendar on
  production and saw a strip full of dates that had days. No test could have said that was wrong; every one of them
  was passing.

---

## 12. For the next section's chat

- **The words are the owner's.** Every sentence on these screens came from a board or a brief. If a sentence needs
  to change, it is his call, and it lives in a `lib/*Words`-shaped file where a test can read it, never in markup.
- **Decision 30 is a standing rule, not a Calendar one.** Wherever the product does not know something it says so in
  one clear sentence and asks. An empty state is a message, and "nothing found" is a claim that has to be true.
- **Nothing derived is stored.** `next_due` is computed at read time. A derived date stored is a date that goes
  stale the first time its anchor moves (migration 049's rule).
- **One filter, one writer.** Before you add a second query for "what is on the calendar", or a second place that
  writes a date, read `lib/calendarCounts.ts` and `lib/calendarDates.ts` — both exist because the product once had
  two of each and they disagreed.
- **Build on Haiku, through `npm run haiku -- <command>`.** The owner's `.env.local` runs Opus on all thirteen
  tiers, so the guard is the only thing keeping a build run cheap. Its refusal is the proof a run was not on Opus.
- **`check:live` on port 3999** unless a brief says otherwise, including inside `npm run db:migrate`.
- **Production is SELECT only, one query per stated need, and the SQL goes in the report.**
