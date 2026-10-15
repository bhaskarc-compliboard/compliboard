# The Calendar section — the plan

**Version:** 2 · **Updated:** 15 October 2026: decision 27, the drawer's second tab shows the report. **Version 1:** 15 October 2026, by the Calendar chat, after the owner's vision (this chat), the boards (step 2) and the read-only map (`docs/CALENDAR-MACHINERY.md`, step 3, commit `2d1da2e`).
**Supersedes:** nothing on main. **Nothing from the branch `calendar-attempt-1` or its `CALENDAR-PLAN.md` is carried here**; that attempt is abandoned (the owner, 15 October 2026).
**For:** the owner, Claude Code, and the next section's chat. The owner's living copy of the same plan is the Claude doc "Calendar — the master plan"; this file is the repository's record and is updated at every step.
**Line numbers** are `docs/CALENDAR-MACHINERY.md`'s, read at commit `2dab12c`; re-read before citing.

---

## 1. In one paragraph

The Calendar is rebuilt from main on the branch `calendar-v2`, in the HR Workspace's frame, as the regulatory expert down the hall: a person asks "when is the Tier II report due?" and gets the answer with the document it came from. Every date the product finds, however it finds it, lands in one table, `calendar_events`, through one shared function, `proposeDate()`, and shows on the calendar at once, confirmed or not. A "Dates to confirm" tab shortens the work of saying yes. A person can send one date, or the whole calendar, to Google or Outlook. On the first of each month, one email says what is due. Fifteen steps; the quality tests are held for the finish line like every other section's.

---

## 2.1 What the Calendar is (the owner's vision, 15 October 2026)

In an office, a person walks over to the regulatory expert and asks "when is that report due?" They do not scan a calendar. So the first tab is a chat: it answers calendar questions from the calendar's own rows and the readings of the documents behind them, with web search for the rule, the way the HR Workspace answers from handbooks. The second tab is the calendar itself, month view by default with a list beside it. Clicking a date opens a drawer with everything about it, nothing hidden. The third tab is the queue: Dates to confirm.

Dates come from three sections today, Documents above all. From now on those sections stop asking the person anything about dates: what they find flows to the one calendar, and the calendar is where a person confirms. Many people will never confirm; the product promised to be a guard, so a date shows on the calendar and in the email whether it is confirmed or not.

The layout is the HR section's, exactly. The words are the product's: never "AI", never "compliant", never "done" or "overdue" (a date has passed), no cost on a customer screen, not legal advice.

## 2.2 The boards

The canvas "Calendar Workspace boards" (eleven boards, approved 15 October 2026): 1 Ask a question, first visit · 2 The answer · 3 Calendar tab, nothing yet · 4 Calendar tab, the month (default) · 5 Calendar tab, the list · 6 A date, opened (the drawer) · 7 Dates to confirm · 8 Not right, and Remove (the sheet) · 9 Add a date (the sheet) · 10 The monthly email · 11 Send to your calendar (the sheet). The Conversations tab, the summary drawer, the delete-a-conversation sheet and the printed page are HR's boards 9 to 12 unchanged.

## 2.3 The decisions (the owner, 15 October 2026)

Each decision names its effect on other sections. "None" means no file outside Calendar changes for it.

1. **Nothing from the first attempt carries over.** Not the branch, the plan, the migrations or the decisions. What is needed is redone here. *Effect: none.*
2. **The layout is HR's, exactly.** The HR boards are the reference; `components/Drawer.tsx`, `Sheet.tsx`, `Tabs.tsx`, `Empty.tsx`, `buttonStyles.ts`, `AnswerBody.tsx`, `ReportView.tsx`, `ConversationList.tsx` and `lib/printFrame.ts` are imported, never copied (map C6). *Effect: none; shared files are read, not changed.*
3. **Four tabs:** Ask a question · Conversations · Calendar · Dates to confirm (N). The Calendar tab opens on the month view. *Effect: none.*
4. **The chat is the first tab.** It answers from the calendar rows and the readings of the documents behind them, with web search for the rule. *Effect: `lib/ai.ts` and `lib/costLedger.ts` gain a `calendar` tier and ledger task (map C7, five touches); `topics.section` gains `'calendar'` (map C3, a migration).*
5. **One table for every date, `calendar_events`.** Every row names its source, the line it was read from, its site and its status. §2.6 is the contract. *Effect: `app/api/account/export/route.ts` and `app/api/account/route.ts` keep covering it; `scripts/check-live.js` gains its probes (map B10).*
6. **One shared function, `proposeDate()`** in `lib/calendarDates.ts`. Sections that find a date call it and keep no calendar logic of their own. *Effect: one call added in `lib/documentScan.ts` beside the `document_deadlines` insert (map B2, :893–898) and one in `lib/auditRun.ts` beside the findings insert (map B3, :497).*
7. **Sections stop asking.** The "Add to calendar" button in `components/DocumentReport.tsx` (:827–831) becomes a line with a link; the `deadline_to_calendar` case in `app/api/document-actions/route.ts` (:127–152) goes; the `/calendar?add=` link in `components/AuditReport.tsx` (:1052–1055) becomes a line. *Effect: Documents and Audits, those three files; their free checks re-run.*
8. **Unconfirmed dates show everywhere:** the month, the list, the chat's answers and the email. On the page they are marked "not confirmed"; the email carries no such mark. Confirming is a quality mark, not a gate. *Effect: the Dashboard reads the new table and shows them the same way (map B8).*
9. **Confirm all from this document,** so a first scan's flood is a few clicks. *Effect: none.*
10. **Clicking a date opens a drawer with everything.** Nothing hidden. *Effect: none.*
11. **No done tick.** Never "done" or "overdue"; a date has passed, and it stays until a newer document replaces it or a person removes it with a reason. Close, never delete: `completed` and `completed_at` go; `authenticated` loses DELETE on the table. *Effect: `app/dashboard/page.tsx` stops reading `completed` (map D8).*
12. **A recurring date has a period and an anchor;** the next date is worked out when read, never stored (migration 049's rule). A recurring date with no day is allowed and shown as "repeats, day not known yet" (map B3, migration 060's rule). *Effect: none.*
13. **The same date is never proposed twice.** The key is the document, not the scan: a re-read that finds the same `(document_id, title, date)` leaves the row alone; a moved date is proposed anew and the old row marked `replaced_by`. (`document_deadlines` rows are per scan — map B2 — so the scan's row id cannot be the key.) *Effect: none.*
14. **A date whose document is gone or has a newer version stays,** with a line saying so. `document_id` is already ON DELETE SET NULL (map B1). *Effect: none.*
15. **The old import goes.** `app/api/extract-dates/route.ts` and `prompts/extract-dates.ts` are deleted; their only caller was the old page (map B5). A file dropped on the calendar is a document and goes through `/api/document-scan`. Calendar has no document store of its own. *Effect: none outside Calendar; `docs/TODO.md:2799` and `INVENTORY-2026-09.md:164` close.*
16. **The chat's baseline sends readings, not files.** Every date row with its document's stored reading (kind, agency, summary, conditions, the other deadlines); the file itself only when attached, or later as a measured switch. A quality decision, the owner's. *Effect: none.*
17. **The chat may offer a date it found in a rule,** with the source. One click puts it on the calendar as confirmed with the person's name, the same as typing it in. *Effect: none.*
18. **A monthly email on the 1st:** what is due this month by site, each with its source; what passed last month; one link. No confirmed marks; the footer says to remove a wrong date in CompliBoard. Every person at the company receives it. *Effect: `vercel.json`, `lib/jobAuth.ts:66`, `lib/jobRun.ts:27` and the `job_runs_job_check` CHECK gain `calendar_month` (map C4).*
19. **The Resend sending-domain DNS is a release gate** for the email, not Calendar work. *Effect: all four emails.*
20. **Their calendar, kept in step.** "Send to your calendar" on the Calendar tab: a subscription link for Google Calendar or Outlook, copy-the-link, and a one-time `.ics` download. "Send to my calendar" in a date's drawer: that one date through Google's and Outlook's add-an-event pages (the old page's links, map B5 :247–256). The link is a secret address per company, replaceable later in My Account. *Effect: a new public route `/api/calendar/feed` that answers to a token, not a session — named in §2.6 because it is the one place a session is not required.*
21. **"Add a document" sits under the ask box,** where HR puts "Add a handbook". *Effect: none.*
22. **Cross-section changes are made from this chat,** not from the other sections' chats: the feed is one feature with one contract. The other chats learn of it through the step reports, `HANDOFF-CODE.md` §7 and `DECISIONS.md`. *Effect: as decisions 6 and 7.*
23. **The scan's prompt is not changed.** The scan says only whether a date repeats, not how often (map B2: `recurs` is a boolean, there is no period column). A repeating date from a document shows as "repeats, how often not read yet"; the person sets the period when confirming. Returning the period from the scan is a measured switch for the Documents section later. Of the 37 deadlines on staging, 33 repeat — this is the common case. *Effect: none now.*
24. **Sites.** A date inherits the site of whatever found it; "Every site" is a real value (`entity_id` null). With one site nothing about sites shows, as in HR. A document-sourced date's site is read live from the document through the view, never copied, so a correction or a removed site in Documents or HR reaches the calendar with no new code there. *Effect: none. For the My Account chat: when a second site is added, ask once which documents and dates marked for every site belong to the first site only.*
25. **The one shared email template** is built in step 11 (`lib/email.ts`: wordmark, title, lede, grouped rows, one green button, footer; HTML plus a plain-text twin), the calendar email first. The three existing plain-text emails (map C5) move onto it as a small follow-up. *Effect: Audits, HR and Documents, in the follow-up only.*
26. **The standing instruction for every coding job (the owner, 15 October).** Before any change, find every file, query, view, job, test and page that reads or writes what is about to be touched, by searching the repository and reading the live schema, never from memory and never from the docs alone, and list them in the job's plan with what happens to each. After the change, re-run every touched section's free checks and walk one real customer path per touched section on Haiku. A change that breaks a section the plan did not name is a stop, not a fix.
27. **The drawer has two tabs: "The date" and "The report".** The second shows the document's report through `components/DocumentReport.tsx` exactly as Documents and the workspace show it, with every action on it live; an audit-sourced date shows `components/AuditReport.tsx`; a handbook-sourced date the handbook check drawer; a typed or rule-sourced date has no second tab. The same drawer opens from a chat answer's source card, from the monthly email's link (`/calendar?date=<id>`) and from the Dashboard's upcoming rows. The first tab ends with: "If you have already handled this, add the proof in Company Documents and it will show here." Matching a later-uploaded filed report to its date is a rev 2 switch. *Effect: `DocumentReport.tsx` and `AuditReport.tsx` become shared files for Calendar's J list (read, not changed); `app/dashboard/page.tsx` rows open the drawer.*

## 2.4 The steps

| # | Step | What happens | The stop | Status |
|---|---|---|---|---|
| 1 | The vision, written down | This file and the owner's master-plan doc. | Done. | done 15 Oct |
| 2 | The boards | Eleven boards in the HR style. | "That one", board by board. | done 15 Oct |
| 3 | The map (read-only) | `docs/CALENDAR-MACHINERY.md`; the tree is `calendar-v2` from main and staging is on 072. | The report. | done 15 Oct, `2d1da2e` |
| 4 | The plan, locked | This file; `DECISIONS.md` §185 records it (written by Claude Code at the start of step 5, as HR's §164 was). | The owner's yes. | **in progress** |
| 5 | Foundations | Migration 073 (§2.6); `lib/calendarDates.ts` with `proposeDate()` and the no-duplicates rule; `calendar_v`; the three CHECKs widened (`ai_calls`, `job_runs`, `topics.section`); the ledger task and tier; unit tests; `check:live` probes for `calendar_events`. One SELECT-only read of production first: any row with a null `company_id`. | The migration reviewed in the chat before it runs on staging. | not started |
| 6 | The feeds | The two `proposeDate()` calls (Documents, Audits); the report's line; the Audits line; `deadline_to_calendar` removed. Documents' golden set and both sections' free checks re-run. | The owner scans a file on localhost and sees its dates arrive. | not started |
| 7 | The page shell | `/calendar` rebuilt in the HR frame: title, lede, four tabs, info bars, empty states. | The owner looks. | not started |
| 8 | The Calendar tab | Month view, list view, the drawer with its two tabs (the report tab reusing `DocumentReport` / `AuditReport`), Add a date, the Remove sheet, "passed", recurrence, print through the shared frame, `?date=<id>` opening the drawer. | The owner looks. | not started |
| 9 | Dates to confirm | The queue by document; Confirm, Confirm all, Not right with a reason; the counts. | The owner looks. | not started |
| 10 | Ask a question | `/api/calendar/answer` from HR's route; topics with section `calendar`; the summary; the "add this date" offer. The prompt is shown with a real run before any screen. | The prompt (quality), then the owner looks. | not started |
| 11 | The monthly email | `lib/email.ts`; `/api/jobs/calendar-month`; recipients; `calendar_mailings`; `NOTIFY_TEST_TO`. | The email in the test inbox. | not started |
| 12 | Retire the old | extract-dates route and prompt, the old page; the Dashboard on `calendar_v`; export and delete cover the new columns; `SCHEMA.md`, `STATUS.md`, `HANDOFF-CODE.md`. | The report. | not started |
| 13 | The machinery on Opus | One run per paid path (an answer, a summary, the email), cost estimated first. | The owner's yes on the budget. | not started |
| 14 | Release | preflight, `db:migrate:prod`, `AI_MODEL_CALENDAR` on Vercel, push, free live checks, one paid check. Gate: the sending-domain DNS before the email reaches a customer. | The owner runs the routine. | not started |
| 15 | The morning after, and close-out | `job_runs` next morning and on the 1st; `HANDOFF-FROM-CALENDAR.md`; the `STATUS.md` row; the Calendar part of `TEST-AT-FINISH-LINE.md`; project docs synced; boards aligned. | Done. | not started |

Steps 5 to 12 are the build, one or two Claude Code jobs each, smaller than HR's. Every job's instruction opens with decision 26 and closes with the cross-section gate and a report that names its effects on other sections by file.

## 2.5 Standing rules for the build

- Machinery on Haiku through `npm run haiku -- <command>`; the owner tests on Opus 5.5. `.env.local` is never changed for a model variable.
- Anything that changes what the model sees or writes is a quality change and waits for the owner's yes: the calendar prompt (step 10), the context block's parts (§2.6), any search limit.
- `check:live` on port 3999 only, including inside `npm run db:migrate`. No `db:reset` or `db:restore`. Production: SELECT only, one per stated need, SQL in the report.
- Every migration: REVOKE then GRANT for both roles; a CHECK is tested by violating it; `has_table_privilege` reads grants back.
- Screenshots in `shots/`. Docs updated in the job's own commit: `DECISIONS.md`, this file, `TESTING.md`, `STATUS.md`, `HANDOFF-CODE.md` §7.
- Nothing is read from or cited to `calendar-attempt-1`.

## 2.6 The contract

**`calendar_events` after migration 073** (the table as read in map B1, changed as follows; every existing row is backfilled before a constraint lands):

| Column | Change | Why |
|---|---|---|
| `company_id` | NOT NULL | the only nullable tenant column in the date family (map B1). Backfill: none expected; step 5's production read says |
| `user_id` | renamed `added_by`, nullable, ON DELETE SET NULL | a person's date names who typed it; a document's date has nobody. `CLAUDE.md` §3.6: data tables carry `company_id`, never `user_id` as identity. Two writers name it today (map B1); both are replaced |
| `status` | new, text NOT NULL, CHECK in (`proposed`, `confirmed`, `dismissed`), default `proposed` | backfill: every existing row `confirmed` |
| `source` | new, text NOT NULL, CHECK in (`document`, `audit`, `handbook`, `rule`, `person`) | backfill: `document` where `document_id` is set, else `person`. Replaces `category`, which had three vocabularies and no CHECK (map B1) |
| `category`, `is_recurring`, `recurrence_period`, `completed`, `completed_at` | dropped | decisions 11 and 12. `is_recurring` → `recurs`; `recurrence_period` → `period` |
| `recurs` | boolean NOT NULL default false | as `document_deadlines.recurs` |
| `period` | text nullable, CHECK in (`month`, `quarter`, `6 months`, `year`, `2 years`) | null = not known yet (decision 23) |
| `due_date` | nullable; CHECK `(due_date IS NOT NULL OR recurs)` | migration 060's rule, copied: a recurring date may have no day; a one-off date must |
| `source_line`, `source_url`, `source_page` | new, text nullable | the exact line (from `document_deadlines.source_line`, `audit_findings`, `handbook_dates.quote`), the rule's URL, the page |
| `audit_finding_id` | new; composite FK `(company_id, audit_finding_id)` → `audit_findings(company_id, id)` ON DELETE SET NULL (audit_finding_id) | the 066 shape (map B1) |
| `deadline_id` | new; FK → `document_deadlines(id)` ON DELETE SET NULL | the row the date was last read from; informational, never the dedupe key |
| `confirmed_by`, `confirmed_at`, `dismissed_by`, `dismissed_at`, `dismissed_reason`, `replaced_by` | new | the history the drawer shows; `replaced_by` → `calendar_events(id)` |
| `entity_id`, `document_id`, `handbook_id`, `title`, `description`, `created_at` | unchanged | |
| indexes | `idx_calendar_events_company_due (company_id, due_date)`, `idx_calendar_events_company_status (company_id, status)`; the no-duplicates key: UNIQUE `(company_id, document_id, lower(title), coalesce(due_date, '0001-01-01'))` WHERE `source = 'document'` | map B1: no index on the one read path |
| grants | REVOKE ALL from anon and authenticated; GRANT SELECT, INSERT, UPDATE to authenticated — **no DELETE** | decision 11: remove is a dismissal |
| policies | select/insert/update own, through `auth_company_id()`, WITH CHECK on both writes; the DELETE policy dropped | |

**`calendar_v`** (security_invoker): every column above, plus `site_id` = the document's current site for a document-sourced row (through `document_index_v`), else the row's own `entity_id`; `site_name`; `next_due` = `due_date` for a one-off, the next occurrence of `due_date` by `period` on or after today for a repeating date with a period, null otherwise; `days_until`; `has_passed`; `source_title` (the document's title from `document_index_v`, the handbook's name, the audit's agency and date). Nothing derived is stored.

**`proposeDate(client, input)`** in `lib/calendarDates.ts`: `{ companyId, source, title, dueOn, recurs, sourceLine?, sourceUrl?, sourcePage?, documentId?, deadlineId?, auditFindingId?, handbookId?, entityId?, addedBy?, status? }` → `{ id, outcome: 'created' | 'existing' | 'replaced' }`. Rules: a `document` source with the same `(company_id, document_id, lower(title), due_date)` returns `existing`, even when dismissed; the same title with a different date marks the old row `replaced_by` and creates the new one; `person` and `rule` sources are created `confirmed` with `added_by`; everything else `proposed`. Pure except for the two queries; unit-tested on every branch.

**Callers:** `lib/documentScan.ts` after the `document_deadlines` insert (:893–898), as the client that ran the scan; `lib/auditRun.ts` after the findings insert (:497) for `kind = 'date'` rows; HR when its structured check returns (no call now; `tests/unit/hrPolish.test.ts:17` stays as it is); `POST /api/calendar` for a typed date and for the chat's offer.

**The chat (`POST /api/calendar/answer`):** HR's route shape (map C1) with the handbooks replaced by the calendar block. Prompt: `buildSystemPrompt('research', null, { open: true })` plus two calendar sentences (step 10 shows them with a real run first). Message: the company context with parts `company`, `declared`, `confirmed` (named once as `CALENDAR_CONTEXT_PARTS`, exported, as `SCAN_CONTEXT_PARTS` is — map C8), then every `calendar_v` row that is not dismissed with its document's reading, then the question. Task `calendar`, model `AI_MODEL_CALENDAR` falling back to the `prose` tier, search limit `AI_SEARCH_MAX_CALENDAR` unset. After the call: links checked with `findReturned` and labelled with `labelFor`; a row the answer cites gets a card ("your calendar · not confirmed"); a `check_record` saved on the turn. The "add this date" offer is a structured block the answer may return; the page renders it as one line; clicking it POSTs `/api/calendar` with `source: 'rule'`.

**Conversations:** `topics.section = 'calendar'` (migration widens `topics_section_is_known`; `lib/topicList.ts:49` gains the word); the summarise route copied from HR's with `kind: 'calendar'` on `summariseTopic` only if its words differ, else `'workspace'`.

**The monthly job:** `/api/jobs/calendar-month`, `vercel.json` `0 14 1 * *` (07:00 Pacific in summer, 06:00 in winter); GET delegates to POST; `requireCronSecret` first; `startJobRun(…, 'calendar_month')`; one email per company that has at least one date due this month or passed last month, to every profile at the company; `calendar_mailings (company_id, month, sent_at, sent_to)` UNIQUE `(company_id, month)` is the stamp against a double send; `NOTIFY_TEST_TO` and `dryRun` as the three emails do.

**The feed:** `GET /api/calendar/feed?t=<token>` answers `text/calendar` for the company whose `calendar_feed_tokens` row holds the token (one row per company; rotate = a new row, the old one revoked). It is the one route without a session, by design; it reads through the service role scoped to that company and nothing else, and it never writes. One date's "Send to my calendar" is the old page's two links (map B5 :247–256), client-side, no route.

**What the Dashboard reads after step 12:** `calendar_v`, next 30 days, `status <> 'dismissed'`, with the same "not confirmed" words.

## 2.7 Effects on other sections, by file

- **Documents:** `lib/documentScan.ts` (one call after :893–898; `chooseSignificantDate` and `document_index_v` untouched), `components/DocumentReport.tsx` (:810–838, the button becomes a line; and the whole component is rendered inside the calendar drawer's second tab, so any later change to it re-runs Calendar's free checks), `app/api/document-actions/route.ts` (the `deadline_to_calendar` case removed; D6 goes with it). Re-run: `npm run golden:docs` on Haiku against the fixtures, `npm run check`, `check:live` on 3999.
- **Audits:** `lib/auditRun.ts` (one call after :497), `components/AuditReport.tsx` (:1052–1055, the link becomes a line). Re-run: `npm run golden:audit` is paid; the free checks only, plus one Haiku audit on the Cascade fixture in step 6.
- **HR:** no file. Note for HR's chat: the parked branch `parked/hr-check-structured` wrote `category = 'hr'` and `handbook_id`; after 073 it must write `source = 'handbook'` through `proposeDate()` instead.
- **The Compliance Workspace:** `prompts/checklist.ts` untouched; `lib/topicList.ts:49` gains `'calendar'`; `lib/summaryReport.ts` untouched unless step 10 needs its own words.
- **Everything:** `lib/ai.ts` (:27, :96–148), `lib/costLedger.ts` (:22–41), `tests/unit/costLedger.test.ts:113–117`, `lib/jobAuth.ts:66`, `lib/jobRun.ts:27`, `vercel.json`, `app/api/account/export/route.ts` and `app/api/account/route.ts` (the new tables `calendar_mailings` and `calendar_feed_tokens` carry `company_id`, so check 2 in `scripts/check-schema-contracts.js` demands they be listed), `scripts/check-live.js` (new probes), `app/dashboard/page.tsx`, `docs/SCHEMA.md` (regenerated by `db:migrate`).
- **Known and left alone:** `scripts/schema-doc.js`'s composite-FK rendering (map D3) and the export's coverage of `document_deadlines` and `audit_findings` (map D9) are for the whole-app audit after My Account, unless the owner says otherwise.

## 2.8 Held for the finish line

The Calendar's part of `docs/TEST-AT-FINISH-LINE.md` is written at step 15 in the A–J shape. What it will hold: the yardstick (about eight real calendar questions against Test Alpha's documents, keys written first, three runs each on Opus 5.5 at production settings); the manual sets in `docs/TESTING.md`; and the switches, each off by default and measured against the baseline — the file itself sent to the model when a question needs it; the scan returning a period (a Documents switch); prompt caching for the calendar block; Sonnet 5.5 against Opus 5.5 per task.
