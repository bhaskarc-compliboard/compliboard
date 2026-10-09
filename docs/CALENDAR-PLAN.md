# The Calendar section — the plan

**Version:** 4 · **Updated:** 9 October 2026: **Job E, the fix list** (§2.4, `docs/FIX-LIST-FAILURES.md`) — the
owner asked for a full read of the code for failures that look like facts, listed now and fixed at the end so the
calendar work is not diverted. Version 3: 9 October 2026: the owner's answers to step 3a (decisions 2 and 7); the jobs (§2.4);
**the cross-section gate as a standing rule** (§2.5). Version 2: 9 October 2026: the boards approved by the owner (§2.2); decision 11, one link per
section in the email; decision 16, the details the boards added; step 2 done. Version 1: 9 October 2026, by the
Calendar chat, from the owner's answers in that chat.
**Supersedes:** nothing. `docs/TODO.md` M5 (2820–2846) is the old design: dates from the requirement library's cadence.
Rev 1 does not use the library, so M5 waits for rev 2 (decision 20).
**The map** (how the calendar and everything that writes a date worked on 9 October, with file and line) is
`docs/CALENDAR-MACHINERY.md`, commit `44d2b11`. Its B-items are cited here as B1 … B18.
**The decision record** is `DECISIONS.md` §185, written with step 3a's docs commit.
When this file and the repository disagree, the repository wins and this file is corrected.

---

## 2.1 What the calendar is (the owner's vision)

- **One snapshot of every deadline the company has, from every section, in one place.** It is a company asset:
  everyone at the company sees the same dates.
- **Dates land from every section:**
  - **Documents:** the dates a reading finds go on the calendar by themselves, marked **not confirmed**. A person
    confirms them, alone or in bulk (decision 3).
  - **The Compliance Workspace and HR:** after a conversation's summary, the summary lists the dates it found. Each
    one has "Add to calendar". Nothing from a conversation goes on the calendar unless a person presses.
  - **Audits:** a date finding's "Add to calendar", as today, but with its source kept.
  - **By hand:** "Add a date".
- **Tabs:** the two views, **Calendar** (the month) and **List**, then **To confirm (n)**: every date waiting for a
  person, like Company information's queue.
- **A monthly email** at the start of each month lists every date due that month.
- **The layout is exactly HR's and the Workspace's:** the same shell, column, tabs, drawer, buttons, words and print.
- **The words:** never "compliant", never "AI" or a model's name, no cost on a customer screen, not legal advice.
  Short, plain sentences.

## 2.2 The boards

**"CompliBoard Calendar — the boards"**, https://claude.ai/artifact/7fKRsu68HtAFbGHWUtnkkh. **Approved by the owner,
9 October 2026.** Drawn in the HR boards' style (https://claude.ai/artifact/F4z7voVgDeRxKg8E8fvtjJ): the same shell,
type, colours and fictional company.

1. Calendar, the month · 2. List · 3. To confirm · 4. No dates yet
5. One date from a document, not confirmed · 6. One date, confirmed and repeating · 7. Add a date · 8. Not right
9. The Documents report's dates · 10. A summary's dates (Workspace and HR) · 11. The Audits report's dates
12. The monthly email · 13. A printed month

Every screen is drawn there first. A change to a screen changes its board too, so the boards keep describing the
product (`docs/HANDOFF-FROM-HR.md` §11).

## 2.3 The decisions (owner, 9 October 2026)

1. **One calendar, a company asset.** HR decision 29's first half, restated. Every read and write is by company
   (already true: `app/api/calendar/route.ts:74–88`).

2. **Every date says where it came from, with a link back.** A new `source` column with a CHECK:
   `document`, `conversation`, `audit`, `hand`, `handbook`.
   - Links: `document_id` (exists, `040:195`), `handbook_id` (exists, `066:300–313`), and new nullable columns for a
     conversation (`topic_id`) and an audit finding. Each one is a composite foreign key on `(company_id, <id>)`
     with `ON DELETE SET NULL (<column>)`, as 066 does, so a date cannot point at another company's row.
   - **The source's own link must be set; a date may carry others too** (owner, 9 October, after step 3a): an audit
     date carries its finding AND the finding's document, so its drawer opens the document and the same-day check
     works from both sides. A document date carries its document and the deadline row it came from
     (`document_deadline_id`, step 3a's proposal 3, accepted).
   - Migration 073 also makes `company_id` NOT NULL (a composite key is not checked when any part is null) and adds a
     unique `(company_id, id)` to `topics`, `audit_findings` and `document_deadlines`, which a composite key needs
     (step 3a's proposals 1 and 2, accepted; one migration, and the Workspace, Audits and Documents re-run their
     checks).
   - `category` stays for the old rows and is no longer written or shown (B9).
   - The drawer shows the source and opens it: the document's report, the conversation's summary, the audit's
     report, or HR's handbook (`/hr?handbook=<id>`).

3. **Document dates go on the calendar by themselves, marked not confirmed.** *This reverses* the rule in
   `docs/VISION-DOCUMENTS.md` ("Deadlines go to the calendar on the person's say-so") and HR decision 29's second
   half ("Nothing goes to the calendar unless the person presses"), **for document dates only**.
   - **Why (the owner):** a folder upload or a connected drive brings dozens of dates. Asking for each one first
     means they sit in a queue nobody opens, and a real expiry never reaches the calendar or the email. That is the
     false negative the product's rules call the dangerous one (`principles`: a hidden real requirement is far worse
     than an extra one).
   - **The guardrails that make it safe** are decisions 4, 5 and 6.
   - **Conversation dates are NOT added by themselves.** In a conversation a date is often an example or a rule
     ("within 30 days"), not this company's deadline. A person picks (decision 13).
   - **Audit dates and dates added by hand** are confirmed from the start, because a person pressed.

4. **Only the current reading of the current version counts.** Today a re-read keeps the old reading's dates, the
   report shows both, a date can be sent twice, and "Expired/Expiring" can come from an older reading (B3,
   `CALENDAR-MACHINERY.md` D3).
   - One database view, "the current dates", defined once: the current reading (`document_scans.is_current`) of a
     document that no **confirmed** newer version supersedes (`documents.version_of`, `version_confirmed`). The
     query that does it ran on staging (D3: 36 dates over 11 documents).
   - An **unconfirmed** proposed version does **not** hide the older document's dates. Hiding a real date on a guess
     is the dangerous direction.
   - The calendar reads only this view. **Documents' report** (`app/api/documents/report/route.ts:43`) and
     `document_index_v`'s significant date (`049:156–171`, which drives Expired/Expiring) move onto it too. That is a
     Documents change, and it fixes a Documents defect (§2.6).
   - **When a reading or a version stops being current,** its not-confirmed dates leave the calendar. They are
     marked `withdrawn`, never deleted. A **confirmed** date stays: a person said it is right. The new reading's
     matching date is recognised by the date key (decision 7) and is not added a second time.

5. **A document date's source line is checked against the document** before it goes on the calendar. Today it is
   stored unchecked, while gaps and facts are checked (B16).
   - `saveScan` runs the same `verifyQuote` (`lib/documentScan.ts:196`) on each deadline's `source_line`, and stores
     the answer on the deadline row (a new column on `document_deadlines`).
   - This is a check **after** the reading. It changes nothing the model sees or writes, so it is not a §3.1 quality
     change. It is a change to Documents' code and table, and is reported as such.
   - **Found:** the date goes on the calendar, not confirmed.
   - **Not found, or no source line:** the date goes only to the To confirm tab, with "We could not find this line in
     the document." It is not on the month or in the email until confirmed.
   - **No day** (a repeat like "by the 5th", C3): the To confirm tab, with "Pick the day", as Audits already treats
     one (`AuditReport.tsx:1029–1031`).

6. **A date's states, and the words.**
   - `not_confirmed` · `confirmed` · `done` · `rejected` · `withdrawn`, as a column with a CHECK.
   - On screen: **Not confirmed** (grey), **Passed** (amber, a past date not done), **Done**. Withdrawn dates are not
     shown. Never "compliant", never green for routine (`DESIGN.md` §2).
   - **Not right** asks for one line of reason. The date is kept as `rejected` with the reason, so the next reading
     of that document does not add it again. Documents' dismiss pattern (`VISION-DOCUMENTS.md`, "Not right").
   - **Delete** is for dates added by hand, through the delete sheet (`components/Sheet.tsx`), never the browser's
     `confirm()` (`page:242`). A document's date is rejected, not deleted.

7. **One date, once.** The same deadline must not land twice: from two readings, from Documents and Audits, or from
   two presses (B7, B8).
   - Every write goes through **one shared function** (decision 8), which checks for an existing date with the same
     key before it writes, as a compare-and-set, not check-then-insert. The parked HR route already has the pattern
     (`parked/hr-check-structured:app/api/hr/handbook-dates/[id]/calendar/route.ts:49–57`).
   - **The key, settled in step 3a against staging rows** (`DECISIONS.md` §185 and step 3a's report): a stored
     `date_key`, unique per company, built only by the shared function:
     `document:<document>:<day or no-day>:<the normalised source line>`, `audit:<finding>:…`,
     `conversation:<topic>:…`, `handbook:<handbook>:…`, and `hand:<the date's own id>`.
   - **Why the line is in it:** on staging, 3 of 36 current dates share a document and a day with another, and every
     one of the three is a different obligation (a fire-extinguisher certificate sets a 6-year maintenance and a
     monthly inspection on the same day). Document and day alone would merge them and lose one. The normalised line
     survived a re-read that renamed the date completely, so titles are not a key and the line is.
   - **Audits and Documents are NOT matched automatically** (owner, 9 October). An audit finding has no source line
     (`lib/audit.ts:176` does not read it), and a loose "same document, same day" match would tell a person a
     different obligation is already on the calendar, which hides a real date. Instead the finding shows **"A date
     from this document on this day is already on your calendar"**, with that date's title and state, and the person
     decides. Board 11 is drawn so.
   - Hand-added dates are never matched against each other: a person pressing Add is the authority.

8. **One shared "add to calendar" function**, in `lib/`, with a route around it. Every section calls it: Documents
   (after a reading, and the report's button), Audits, the summaries, and "Add a date". It sets the source, the link,
   the site and the state, applies the key, and returns the date. `app/api/document-actions/route.ts:127–152` and the
   page's own inserts move onto it.

9. **Repeats.**
   - A repeating date carries **how often**: monthly, quarterly or yearly, as a column with a CHECK.
   - **A document date's repeat is set by a person.** The scan says only "repeats, yes or no"
     (`lib/documentScan.ts:101`), and today every repeat is written as "annually" (`actions:144`, B4) though
     staging's only repeats are monthly (C3). So a not-confirmed repeating date reads "Repeats — how often?", and the
     person picks when they confirm. **That "annually" rule goes.**
   - **When a confirmed repeating date is ticked done,** the next one is made. The done one stays, so the history is
     kept. One row per occurrence.
   - **Teaching the scan to say how often** is a prompt change in Documents (§3.1). It is a switch, off by default,
     measured at the finish line (§2.4, the switches).

10. **The To confirm tab.** Every date waiting for a person: not-confirmed document dates, dates whose line was not
    found, and repeats with no day.
    - Grouped by document: "Air Contaminant Discharge Permit 26-2841 · 4 dates", with **Confirm all 4**. One
      **Confirm all** at the top.
    - Each date: Confirm, Not right (with a reason), and for a repeat, how often. A repeat with no day asks for the
      day.
    - The pattern is Company information's queue: `confirmAll` one after another, a 404 counted as already settled
      (`app/company-information/page.tsx:252–273`, `:511–514`).
    - The tab shows its count in its name, as Past audits does. The sidebar may show the same count later; not in
      rev 1.

11. **The monthly email.**
    - **When:** the 1st of each month, by a new cron job. The hour is set in step 8, after the nightly jobs
      (10:00 and 10:30 UTC).
    - **To:** every login at the company (B11: there is no company contact and no roles). A person can turn it off
      on My Account, as part of My Account's own work.
    - **What it says, in order:** what is due this month; what has passed and is not done; then "Found in your
      documents, not yet confirmed: N", with one link to the To confirm tab. Not-confirmed dates due this month are
      listed and marked "not confirmed". Plain text, **one link per section** (the To confirm tab; the
      calendar), not one per date: in plain text a link after every date is a wall of addresses (board 12). No cost,
      never "compliant".
    - **A company with nothing due, nothing passed and nothing to confirm gets no email.**
    - **The pattern is Audits'** (`lib/auditNotify.ts`): `NEXT_PUBLIC_APP_URL` or no email, `NOTIFY_TEST_TO`, and a
      `job_runs` row. A new job name needs the `job_runs_job_check` CHECK restated (`066:324–326`) and
      `lib/jobAuth.ts:66`'s type.
    - **It cannot reach a customer until the sending domain is verified** (decision 22).

12. **Removing a login keeps its dates.** `calendar_events.user_id` is `ON DELETE CASCADE` to `auth.users`
    (`000:364`, B10). It becomes `ON DELETE SET NULL`: the date stays, and only "added by" is lost.

13. **Dates in Workspace and HR summaries.**
    - The summary report gains a **Dates** list: title, day, repeats yes or no, and the line it rests on.
    - Each date is checked in code before it is shown, by the checks that already exist (`CALENDAR-MACHINERY.md` D4):
      a date stated in an answer by `checkCitations` (`lib/summaryReport.ts:210–225`); a date the person said by the
      facts check (`:310–321`). A date that fails is dropped and counted, as facts are.
    - `checkReport` must carry the new field, or it is silently dropped (`:336–345`).
    - Drawn in `components/ReportView.tsx` as a "Dates" section, each with **Add to calendar** or **On your
      calendar**. The date links back to the conversation (`topic_id`, decision 2).
    - **This is a quality change** (§3.1): one paragraph in `prompts/summary-report.ts` and the same in
      `prompts/hr-summary.ts`. It goes **before** HR's copied facts paragraph, because
      `tests/unit/hrSummary.test.ts:89` pins `endsWith(facts)`. It waits for the owner's yes at step 7, and the
      finish line measures it in both sections.
    - It is done in this chat, not in the Workspace and HR chats, because both summaries come from one writer
      (`lib/summaryReport.ts`) and HR's prompt copies the Workspace's paragraphs under a test. One change, one place.
    - HR's **handbook check** dates (`handbook_dates`) stay parked with the structured check (HR switch 5). When they
      return, they use decision 8's function, and the parked route's "annually" rule goes (B4).

14. **Sites.** A date carries the site (`entity_id`, `009:98–99`, written by nothing today, B13) when its source has
    one: the document's site, the handbook's site. The page shows a site filter only when the company has more than
    one site, as Documents does.

15. **Dates are days, not times.** All date arithmetic goes through one helper in `lib/` that reads `YYYY-MM-DD` as
    a calendar day, never as UTC midnight (B2). The calendar, the dashboard and the email use it. "Today" is taken in
    Pacific time in rev 1, because every customer is in Oregon or Washington; a company's own time zone is a later
    item.

16. **The layout copies HR and the Workspace exactly.**
    - `AppLayout`, the 900 column (`max-w-[900px] px-4 pb-16 sm:px-6`), the 28px serif title and one grey line,
      `components/Tabs.tsx` with **Calendar · List · To confirm (n)**.
    - The drawer for one date (`components/Drawer.tsx`, 720): title, day, state, repeats, site, the source with its
      line and a link back, and the actions in the button vocabulary (`components/buttonStyles.ts`): Confirm, Mark
      done, Not right, Change and Delete (hand-added only), Add to Google / Outlook. A repeating date shows the next
      day it will get, and the ones done before (board 6).
    - The month: a solid dark dot for a date on the calendar, an open grey dot for not confirmed, amber for passed and
      not done, struck through for done. Today is a dark circle, not green. Prev, next and Today; a site filter
      (board 1).
    - The list: "Passed, not done" first, then by month, then Later. Done dates are hidden behind "Show done (n)"
      (board 2).
    - "Add a date" follows HR's "Add a handbook" placement. The empty state is `components/Empty.tsx`.
    - Print: the month's list through the shared print frame (`lib/printFrame.ts`).
    - No boxes, no emoji, no red or amber panels (`page:314–329`). Passed is amber text, not a panel.

17. **"Import from file" is retired.** The page's import, `app/api/extract-dates/route.ts` and
    `prompts/extract-dates.ts` are deleted (B6). Documents is the one door for files, and it reads dates with their
    lines. "Add a date" by hand stays.

18. **The dashboard's calendar part** uses decision 15's helper and leaves out done dates (B2, B5). The rest of the
    dashboard is its own work.

19. **The old rows.** Production holds 47 rows, all from the old importer, all test data (the owner, 9 October; the
    owner's read-only query: 24 repeating, 23 not, none done, none linked). They become hand-added, confirmed dates.
    Nothing else is done to them.

20. **Not in rev 1:**
    - dates from the requirement library's cadence (`TODO.md` M5) — rev 2, with the library;
    - per-employee dates (HR decision 31);
    - a reminder before each expiry: the monthly email is rev 1's only alert;
    - a calendar feed others can subscribe to (.ics); the per-date Google and Outlook links stay;
    - the dashboard and sidebar showing the To confirm count.

21. **Promises that are not true today get true words** (B15): the calendar page's tip and empty state
    (`page:283`, `:504`), the landing page (`app/page.tsx:80–95`: "automatically", "alerted before anything
    expires"), and My Account (`app/account/page.tsx:390`, `:421`: "Deadline reminders"). They say what rev 1 does:
    dates found in your documents, a monthly email.

22. **The sending address is a launch gate for every email, not only this one.** The code sends from
    `onboarding@resend.dev` (four places, `CALENDAR-MACHINERY.md` D5), which is Resend's test sender and may deliver
    only to the Resend account's own address (D5, HYPOTHESIS). **The owner's job:** look at the Resend dashboard,
    then verify the company domain in Resend and add its DNS records at GoDaddy. The code then changes the sender in
    one place for all four emails.

## 2.4 The steps

1. **The read-only map.** **DONE 9 October** (`44d2b11`, `docs/CALENDAR-MACHINERY.md`). Four bugs proved: the done
   tick never saves (B1), the day is off in Oregon (B2), nothing makes a next repeat (B4), Audits' dates lose their
   source (B7).
2. **The plan (this file) and the boards.** **DONE 9 October**: boards approved (§2.2).
3. **Foundations.**
   - The migration: `source`, the state, how often, `topic_id` and the audit finding link (composite, SET NULL on the
     column), `user_id` SET NULL, the job name, `document_deadlines`' quote column, the current-dates view, and the
     date key with its unique index. Revoke-then-grant, a verify block that tries the writes it must refuse.
   - The shared function and its route (decision 8). The date helper (decision 15).
   - **The done tick's missing token** (B1) is fixed here, one line, because it is a data bug, not a layout one.
   - Unit tests for the key, the states, repeats rolling forward, and the date helper. `check:live` gains calendar
     probes (B17).
   - STOP for review.
4. **Documents into the calendar.** `saveScan`'s quote check on deadlines (decision 5); the auto-add after a reading;
   withdrawing a stale reading's or version's not-confirmed dates; the report and `document_index_v` onto the
   current dates (decision 4); the report's date row reads "On your calendar · not confirmed · Confirm";
   `deadline_to_calendar` onto the shared function. Documents' free checks re-run. STOP.
5. **The page.** The reflow (decision 16), the three tabs, the drawer, To confirm with Confirm all, "Add a date",
   repeats, print. The import retired (decision 17). STOP: the owner looks.
6. **Audits' "Add to calendar"** onto the shared function, with its document and finding, and "On your calendar".
   Audits' free checks re-run. STOP.
7. **Dates in Workspace and HR summaries** (decision 13). **Quality change: the prompt paragraph is shown to the
   owner first.** Workspace and HR free checks re-run; their finish-line parts gain a line. STOP.
8. **The monthly email** (decision 11). Proved with `NOTIFY_TEST_TO`. Reaching customers waits for decision 22. STOP.
9. **The dashboard's calendar part and the promise words** (decisions 18, 21). STOP.
10. **Release** (the `docs/RELEASE.md` routine), **the morning after** (the new job's `job_runs` row on the 1st), and
    the close-out: the Calendar part of `docs/TEST-AT-FINISH-LINE.md` (A to J, with its shared files),
    `docs/HANDOFF-FROM-CALENDAR.md`, `STATUS.md`'s Calendar row, and the Project docs synced.

The owner may release after any STOP. Each release follows `docs/RELEASE.md`.

### The jobs (owner, 9 October 2026: bigger jobs for work the owner need not watch)

The steps above are the order of work. Claude Code runs them as four long jobs, each with a commit per checkpoint, a
running report file and the stop rules of `CLAUDE.md` §9a, and each ending with the cross-section gate (§2.5):

- **Job A — everything underneath the page:** steps 3b, 4, 6 and 8. Stops at its end.
- **Job B — the page:** step 5, with the dashboard's calendar part and the promise words (step 9). Ends with
  screenshots beside each board: **the owner looks.**
- **Job C — dates in the Workspace and HR summaries:** step 7, after the owner says yes to the prompt paragraph.
- **Job D — release and close-out:** step 10.
- **Job E — the fix list** (`docs/FIX-LIST-FAILURES.md`, the owner, 9 October 2026: *"do a full read on all codes and
  find out similar flaws. make a list and at the end of this session, fix all, so that we don't get diverted"*). 55
  entries (some group several places) across every section where a failure — a rate limit, a timeout, a failed database read — is shown, told to
  the model, emailed or acted on as a real "nothing", plus 9 found on the way. Runs after Job C; the chat recommends
  **before Job D**, so one release and one finish-line run cover every section it touches. Its first step (E0)
  confirms each line on the live tree and stops for the owner's five answers (that file, §5). Until then, Jobs A–C
  take nothing from the list except: the dashboard items B1, B2 and B3 go into **Job B**, because Job B rebuilds
  that code and must not ship them again.

### The switches, for the finish line (each off by default)

1. **The scan says how often a date repeats** (decision 9). A Documents prompt change.
2. **Undated repeats placed from their line** ("by the 5th" → the 5th of each month), in code, once the scan says how
   often.

### What this section depends on

- **The sending domain** (decision 22): the owner.
- **The file-types run** (`VISION-DOCUMENTS.md`, "File types"): an iPhone photo of a permit cannot be read today, so
  its dates cannot reach the calendar. It says "could not read" honestly. Not a blocker; a gap until that run.

## 2.5 Standing rules

The rules live in `CLAUDE.md` (all of it, especially §3.1, §3.7, §3.11 and §9.1), `docs/HOW-WE-BUILD.md`,
`docs/HANDOFF-FROM-HR.md` §11 and `docs/RELEASE.md`. They are not copied here. This section's own:

- **The impact check is reported before any code**, in the shape of §2.6. A task whose effect on another section is
  not in this plan stops before writing code.
- **Every model-capable command goes through `npm run haiku -- <command>`.** The calendar itself calls no model; only
  step 7's summary does.
- **`npm run cost` before and after every task.** $3 per task unless the owner raises it.
- **The chat writes the docs it owns straight into `docs/`** (the owner's laptop, the `docs` folder only) and checks
  each write by checksum on the laptop. Claude Code writes all code, runs every migration and makes every commit.
  `docs/CALENDAR-PLAN.md` is the chat's file: Claude Code reports what the repository contradicts and does not edit
  it.
- **⚡ THE CROSS-SECTION GATE — A STANDING REQUIREMENT FOR EVERY CHANGE, IN EVERY SECTION** (the owner, 9 October
  2026: "every change must check if other sections are getting impacted. I burnt once before"). It goes into
  `CLAUDE.md` as a rule for every chat, not only this one. Every job ends with it, and part 1 runs after every
  checkpoint:
  1. `npm run check` after every checkpoint; the test floor only goes up.
  2. **Row counts per section, before and after**, as the signed-in caller and as the service role, for the
     fixture companies, over every table the sections read. A difference the job's own writes do not explain is a
     stop (`HOW-WE-BUILD.md` §3: a read that is too narrow returns fewer rows with a 200).
  3. **The shared-file lists** (`docs/TEST-AT-FINISH-LINE.md` J parts, `docs/HANDOFF-FROM-HR.md` §6): every file the
     job changed that another section lists, and that section's free checks re-run.
  4. **Every page still loads and shows its rows**, with no model call and no write (`npm run measure`, its BLOCKED
     list printed): /compliance, /hr, /documents, /audits, /company-information, /dashboard, /calendar, /account.
     Screenshots in `shots/`.
  5. **The nightly jobs**, run by hand on an isolated server: each writes its `job_runs` row as before.
  6. **The emails**: each sends from the address it used before, unless the change was meant to move it.
  7. `CHECK_LIVE_BASE_URL=http://localhost:3999 npm run check:live`: every section's probes green.
  8. **The golden sets are not re-run** (paid): the report says which would move, and why.

  The report carries one table: section · what was checked · before · after · pass, or why not.

## 2.6 Effects on other sections, decision by decision

| # | Files outside the calendar it changes or depends on | Section | What a person there sees | Proof |
|---|---|---|---|---|
| 2, 3, 12 | The migration on `calendar_events`; `app/api/account/export/route.ts` (`select *` picks up the new columns) | My Account | The export's calendar rows gain fields | `check:live`; an export read |
| 4 | `app/api/documents/report/route.ts:43`; `document_index_v` (recreated, `049:156–171`) | **Documents** | The report lists only the current reading's dates, once. Expired/Expiring comes from the current reading only. **A fix** (B3) | A staging document read twice; the report before and after |
| 5 | `lib/documentScan.ts` `saveScan` (`:893–898`); `document_deadlines` gains a column | **Documents** | Nothing on the report. A date whose line was not found does not go on the calendar by itself | Documents' unit tests; the golden set's rows do not move (the model's output is unchanged) |
| 3, 4, 8 | `lib/documentScan.ts` (the auto-add after a reading, and on the sweep's path); `app/api/document-actions/route.ts:127–152` | **Documents** | Reading a document puts its dates on the calendar, not confirmed. The report's date row reads "On your calendar · not confirmed · Confirm" (`components/DocumentReport.tsx:811–833`) | A staging upload; the calendar and the report |
| 4 | `app/api/audits/index/route.ts:72–78`, `lib/audit.ts:175–177` read every version's dates (B3) | Audits | **Not changed in this plan.** Recorded in `docs/HANDOFF-CODE.md` §7 for Audits | — |
| 7, 8 | `components/AuditReport.tsx:1029–1056` | **Audits** | "Add to calendar" adds the date in place with its document; then "On your calendar" | Audits' free checks; a staging click |
| 13 | `lib/summaryReport.ts` (type `:57–69`, `checkReport` `:259–346`); `prompts/summary-report.ts`; `prompts/hr-summary.ts`; `tests/unit/hrSummary.test.ts:80–90`; `components/ReportView.tsx`; `app/compliance/page.tsx` and `app/hr/HrWorkspace.tsx` (where they pass the drawer its data) | **Workspace, HR** | A summary shows the dates it found, each with "Add to calendar". **A quality change** in both prompts | Both sections' free checks; both finish-line parts gain the dates to judge |
| 11 | `vercel.json`; `lib/jobAuth.ts:66`; `job_runs_job_check`; the sender in `lib/auditNotify.ts`, `lib/handbookCheckNotify.ts`, `lib/documentBatch.ts`, `app/api/feedback/route.ts` (decision 22) | Nightly jobs; every email | A new job on the 1st. The sender changes once for all four emails | `job_runs` the morning after; `NOTIFY_TEST_TO` |
| 15, 18 | `app/dashboard/page.tsx:110–119` | Dashboard | "Upcoming" shows a date on the day it is due, and leaves out done ones | The date helper's tests |
| 21 | `app/page.tsx:80–95`; `app/account/page.tsx:390`, `:421` | Landing; My Account | Words that match what rev 1 does | Reading the page |
| 17 | Deletes `app/api/extract-dates/route.ts`, `prompts/extract-dates.ts` | — | Nothing elsewhere: the page is its only caller (`CALENDAR-MACHINERY.md` A3) | grep |

**Shared files this section will change**, so the cross-section rule applies (`docs/TEST-AT-FINISH-LINE.md`):
`lib/summaryReport.ts`, `components/ReportView.tsx`, `prompts/summary-report.ts` (HR's answer prompt does not read
it; HR's summary prompt copies two of its paragraphs), `lib/documentScan.ts`, `document_index_v`, `vercel.json`,
`lib/jobAuth.ts`.

## 2.7 Open, for the boards or a later step

- The hour of the monthly email (step 8).
- Whether account export should include `document_deadlines` (`CALENDAR-MACHINERY.md` A9, HYPOTHESIS that leaving
  them out is deliberate). The owner's call.
- What "Add a date" asks for besides a title and a day: site, how often, a note.
