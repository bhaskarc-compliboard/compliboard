# The HR section — the plan

**Version:** 18 · **Updated:** 8 October 2026: HR goes live now — step 12's Opus machinery run and step 13's go-live happen now; the yardstick, the manual sets and the switches are held for the finish line (§180, `docs/TEST-AT-FINISH-LINE.md`). Version 17: 8 October 2026: step 11a done, the go-live moved into step 13 (§179). Version 16: 8 October 2026: step 10 done (§178). Version 15: 8 October 2026: step 9 built as a switch, off (§177). Version 14: 8 October 2026: step 8 done (§176). Version 13: 8 October 2026: the baseline (§175) — steps 8–14 rewritten, the switches in order. Version 12: 7 October 2026: step 8 part 1 done (§174). Version 11: step 7 done (§172). Version 10: step 6c done and step 6 complete (§171); migration 069 on production, 070 on staging. Version 9: step 6b done (§170); migration 069 on staging. Version 8: step 6a done (§169). Version 7: step 5b done (§168); the impact check comes before any code. Version 6: step 5a done (§167). Version 5: step 4 done; decision 32 (the page at /hr/new behind HR_PREVIEW). Version 4: 7 October 2026: §2.1, the page title is HR Workspace. Version 3: HR Step 3b, step 3b done (staging only). Version 2: HR Step 3a: step 3a done; decision 17 amended (every build stop on Haiku,
all Opus work in the testing step); the copy rule added to §2.5. Version 1: HR Step 2.

**The decision record** is `DECISIONS.md` §164. **The map** (how HR and everything it touches worked on 4
October, with file and line) is `docs/HR-MACHINERY.md`. When this file and the repository disagree, the
repository wins and this file is corrected.

---

## 2.1 What HR is (the owner's vision)

- **HR is the Compliance Workspace with the company's handbooks as the evidence.** Layout, buttons and
  placement are exactly the workspace's: one coherent app.
- **Tabs:** Ask a question · Conversations · Handbooks · Dates.
- **The page title is HR Workspace**, matching the sidebar and the Compliance Workspace's own title. *(Owner,
  7 October 2026. No code change now; step 4 builds it.)*
- **Handbooks:** a company adds one or more handbooks. Each covers every site, or one site, for example a
  Washington addendum for the Vancouver site. **Handbooks live in HR only. They are not shown in Company
  Documents, and HR reads and checks them itself.**
- **Ask:** a person asks about their policies. The answer:
  - reads the handbooks for that site;
  - checks the rule at the agency (web search, mothership first);
  - says the gap, why it is a gap, the source (the handbook passage and the agency page) and how to fix it,
    in plain words.

  New wording is drafted only on request. The conversation goes back and forth. **There is no checklist and
  there are no execution steps in HR.**
- **Day 1:** a question asked straight after upload is answered from the handbook itself. A grey line says
  the full check has not run yet.
- **Conversations:**
  - The person summarises a conversation, or the app does it the same night. A conversation that ends at
    5 pm is summarised that night.
  - Full conversations are deleted 12 months after the last message.
  - Summaries are kept until the person deletes them.
- **The handbook check:**
  - Each handbook is checked section by section against the agencies for its sites.
  - It runs the same night the handbook arrives, and whenever the person presses "Check now".
  - Results are stored per section. Later answers use them and say so.
  - Each handbook is read again every 90 days. The person is told that date plainly. They are also told
    that if they change the handbook before then, they should add the new version or press "Check now".
- **The words:** never "compliant", never "AI" or a model's name, and no cost on a customer screen. Not
  legal advice. Short, plain sentences.

## 2.2 The boards

The owner's canvas, **"CompliBoard HR Workspace — the feature boards"**:
https://claude.ai/artifact/F4z7voVgDeRxKg8E8fvtjJ (boards 1–12 and 11b).

## 2.3 The decisions (owner, 4 October 2026)

Decisions 6, 7 and 8 are **replaced by 18**. Decision 12 is narrowed by 28, and decision 16 by 27. The
replaced text is kept and struck through, so the record shows what changed.

1. **Share the look, not the logic.**
   - The workspace's display-only pieces move into shared components:
     - the four button strings, into one file (`DESIGN.md:185–190` says one file "is owed (§7)");
     - `Sheet`, `Empty`, `FoldRow`, `OneLineLink`, `Working`, the stages and the tabs;
     - the page's print CSS, into `app/globals.css`.
   - `ReportView` is shared too, with the source shape as a parameter.
   - The workspace imports these pieces. Its screen must not change, proven by `npm run measure` before and
     after. HR keeps its own page logic.
   - This is the first build task, and the workspace chat is told. (Map B10.)
2. **The handbook check gets its OWN tables:** a run per handbook version, a row per section with its text
   and fingerprint, and findings as rows.
   - It copies Audits' patterns (a claim per section, the 5-minute sweep, one email), not its tables.
   - Why: fitting `audit_runs` would change 13 places in a live section, and an audit section never sees a
     document's full text. (Map B4.)
3. **HR loads handbooks with its own loader**, not `lib/attachedDocument.ts`'s carried-file path. That path
   drops a failed file silently and caps at three (map B3). HR's loader:
   - reads the site's whole set of handbooks;
   - names any handbook it could not read;
   - gives no answer if none load.
4. **One quote check for handbook quotes, in one function.**
   - The rule is `verifyQuote`'s (strip Word HTML, ignore case and punctuation), plus a floor of 6 words.
   - A failed quote is flagged and never shown as a source.
   - A scanned handbook with no text says its quotes could not be checked.
   - The other four matchers stay as they are for now. (Map B1e.) *Made precise by 20.*
5. **A section column on `topics`**, `'workspace'` or `'hr'`, default `'workspace'`.
   - The default keeps every existing insert working (map B5: `chat:461–464`, `:642–645`, `check:live`,
     the migration probes).
   - Each list shows only its own section.
   - The usage counter stays one count per company: an HR answer counts as an answered question.
6. ~~A handbook flag on `documents`, set at upload through HR or by "use this in HR" in Documents; the scan
   may suggest it.~~ **Replaced by 18 and 21.**
7. ~~The site is set at upload on `documents.entity_id`.~~ **Replaced by 18 and 22.**
8. ~~Versions work as in Documents.~~ **Replaced by 18.** The person still names the older version, and only
   the newest is used for answers and checks, but on HR's own rows.
9. **Two new ledger tasks and two model settings.**
   - Ledger tasks: `'hr'` (answers) and `'hr_check'` (the handbook check).
   - Model settings: `AI_MODEL_HR` and `AI_MODEL_HR_CHECK`. Both are `claude-opus-5-5` on production, saved
     visible.
   - Summaries keep the `'summarise'` task. (Map B9.)
10. **HR reads from the company context:**
    - company and sites (state, city);
    - declared facts (headcount, company-wide and per site);
    - confirmed facts.

    Where employees work is recorded nowhere (map B8), so answers ask it under "Still to confirm". This is a
    quality change: it is shown to the owner with a real Opus run — **in the testing step** (decision 17 as amended).
11. **The HR summary has its own writer.** It reuses the matching helpers. A source may be a handbook
    passage (handbook, section, page, quote) or a web page. Items are grouped by authority, as in the
    workspace's summary. (Map B7.)
12. **Big handbooks.**
    - A size and page check at upload.
    - A PDF over 100 pages is split for the check and for answers.
    - Tested on a made-up 120-page handbook. No customer file enters the repository. (Map B2.)
    - *Made HR's alone by 28.*
13. **Same-night timing.**
    - The summary job runs at 10:00 UTC, the deleter at 10:30 UTC, and the new handbook queue at 10:00 UTC.
    - The quiet rule goes from 24 hours to 6.
    - This touches `vercel.json`, `lib/topicClaim.ts`, `tests/unit/topicClaim.test.ts`, the comment in
      `lib/conversationStatus.ts`, `check:live` and the docs. No screen words change.
    - **It reverses part of `DECISIONS.md` §161**, whose nightly-job line reads "both candidate lists wait
      for 24 hours of quiet". (Map B6.)
14. **The nightly summary job chooses the HR writer** for an HR conversation.
15. **Old HR is retired in the polish step.**
    - Removed: `app/hr/page.tsx`'s old body, `app/api/hr/route.ts`, `app/api/hr-audits/route.ts` and
      `prompts/hr.ts`.
    - The `hr_audits` table stays. Production holds 1 row, in a test company.
    - The two handbooks on production stay as ordinary documents (see 25).
16. **Two defects HR depends on are fixed in the foundations task**, each reported with its effect on
    Documents:
    - ~~`app/api/document-scan/route.ts` gets a `maxDuration`~~ — **moved to `HANDOFF-CODE.md` §7 by 27**;
    - `scripts/schema-doc.js` reads grants through `has_table_privilege` or `pg_class.relacl`, which
      `supabase_read_only_user` can see (map B12).

    Everything else goes to `HANDOFF-CODE.md` §7.
17. **Build first, then test.** *(Amended by the owner, 4 October 2026, after step 3a; `DECISIONS.md` §164.)*
    - There is no separate measurement step and no prompts-first step.
    - **Every build stop runs on Haiku, with no Opus runs.** ~~Each build task that adds a prompt ends its stop
      with one real Opus run.~~
    - **All Opus work moves to the testing step (step 12).** It begins with **one Opus run per paid path**, to
      catch machinery that only fails on the real model — refused schemas, longer outputs, slower calls —
      and then the quality pass. Each Opus run is estimated first, with a $3 cap per task unless the owner
      raises it.
    - The quality judgement is the testing step at the end.
18. **Handbooks are HR's own.**
    - HR has its own handbook table: company, site, name, file path, version, status, page count, and the
      read and checked dates.
    - HR has its own reading (text, page count, sections, the size and page check) and its own check.
    - The file is stored in the `company-documents` bucket, under an HR prefix inside the company's own
      folder.
    - A handbook's site and versions live on HR's own rows, not on `documents`.
    - Nothing in Documents, the Documents sweep, the dashboard or Audits sees a handbook.
    - **Known consequence, accepted by the owner:** Audits will not cite a handbook.
19. **HR proposes company facts only from conversations**, by the workspace's rule (only the person's own
    words).
    - They go into Company information's one queue, labelled with the conversation's title.
    - HR's handbook reading proposes no facts in rev 1, so Company information's tables do not change.
20. **A new HR-only quote function**, checking against HR's own stored handbook text.
    - `verifyQuote` does not change, so Documents' quote flags and its golden set do not move.
    - The new function may reuse `verifyQuote`'s normalisation.
21. **Dropped:** no "Use in HR" in Documents, and no "add from Company Documents" in HR.
    - A handbook enters HR only by upload in HR.
    - The Documents scan prompt does not change.
22. **Not needed:** HR never writes `documents.entity_id`. The "Company-wide" correction gap
    (`049_significant_date_at_read_time.sql:52`) stays dormant, and is recorded in `HANDOFF-CODE.md` §7 as
    a known Documents defect.
23. **Accepted:** a workspace conversation picked up again the next day is summarised again that night.
24. **Account delete, export and the job name.**
    - The new HR tables go into account delete (`app/api/account/route.ts` `COMPANY_SCOPED_TABLES`) and into
      account export.
    - Account delete must also remove HR's stored files.
    - The handbook queue gets its own `job_runs` job name, restating `job_runs_job_check` (pattern
      `058_the_audit_as_rows.sql:261–263`).
25. **The two handbooks uploaded through old HR stay in Company Documents** as ordinary documents. They are
    test data. No migration flags them.
26. **`HANDOFF-CODE.md` §7 gains a Dashboard row:** "Questions answered" (`app/dashboard/page.tsx:87`, `:99`)
    counts checklists, not answers. Not HR's to fix.
27. **Decision 16 changes.**
    - The `app/api/document-scan/route.ts` `maxDuration` fix moves to `HANDOFF-CODE.md` §7, because HR no
      longer depends on it.
    - The `scripts/schema-doc.js` grants fix stays in HR foundations, so the grants on HR's new tables can be
      seen.
28. **Decision 12 is HR's alone.** HR's reader does the size and page check, and splits a PDF over 100 pages.
    Nothing changes in Documents.
29. **HR dates go to the ONE calendar, never to a second one.**
    - **What is listed:**
      - The handbook check also lists the company-level dates a handbook sets, for example an annual policy
        review, an open-enrolment window or a yearly training cycle.
      - Each date carries its quote, checked like every other quote, and is stored in HR's own table.
      - A check finding that cites a dated rule (for example a 1 July wage change) may carry its date too,
        sourced to the agency page.
    - **"Add to calendar":**
      - Each date has an "Add to calendar" button, with the Documents report's button and words (pattern
        `app/api/document-actions/route.ts:127–151`).
      - It inserts a `calendar_events` row with category `'hr'`, the handbook's site as `entity_id`, and a
        link back to the handbook. It then marks the date as in the calendar.
      - Nothing goes to the calendar unless the person presses the button.
    - **The link:**
      - The link is a new nullable `calendar_events.handbook_id`, `ON DELETE SET NULL` (the `document_id`
        pattern, `040_document_scan.sql:195`).
      - It is added in foundations, and reported as an effect on the Calendar section.
    - Per-employee dates ("within 30 days of hire") stay as text in the check, and never become events.
    - Steps: the column in step 3, the dates and the button in step 8.
30. **A Dates tab in HR** lists the company's `'hr'` calendar events, read from `calendar_events` (one table,
    two views), in the workspace's row style.
    - It is built in step 11.
    - How the main calendar shows each source, plus reminders and recurrence, belong to the Calendar's own
      rebuild.
31. **Dates for individual employees are a LATER version, not rev 1.**
    - They wait for user roles (today every login at a company sees every row), and for the owner's legal
      review of holding employee records.
    - When built, they hold names, what is due and the date only — never test results, leave reasons or
      licence numbers.
    - Job-duty dates (CDL renewals, drug and alcohol tests, forklift certification) go to the main calendar
      as compliance items. The rest go to HR's view.
32. **The new HR page lives at `/hr/new`, behind a preview switch, until the release** (owner, 7 October 2026).
    - A server page renders it only when `process.env.HR_PREVIEW === '1'`; otherwise `notFound()`. The variable
      is read per request (`await connection()`), and it is NOT a `NEXT_PUBLIC_` one. The page body is a
      client component the server page renders. The check is `lib/hrPreview.ts`.
    - `HR_PREVIEW` is set ONLY in the owner's `.env.local` and NEVER on Vercel, so on production `/hr/new`
      does not exist.
    - Every new HR API route added from now until the release does the same check and returns 404 without it.
    - The sidebar still points to old `/hr`, and nothing links to `/hr/new`.
    - In step 11 the page moves to `/hr`, old HR is deleted, and the switch is removed.

## 2.4 The steps

1. **The read-only map** — DONE 4 October (`docs/HR-MACHINERY.md`).
2. **The decisions and the plan, on paper** — this commit.
3. **Foundations.**
   - (a) Lift the shared pieces (decision 1). The workspace must look the same, measured. **DONE 4 October
     (`279c946`)**: 9 screen views and 5 prints identical on two fresh servers, pixel-identical screenshots
     and PDFs; `DECISIONS.md` §164.
   - (b) Migrations for decisions 2, 5, 9, 18 and 24, and the nullable `calendar_events.handbook_id`
     (decision 29); the `schema-doc.js` grants fix (decisions 16, 27). **DONE 4 October, on staging**
     (`095c984`, `7b7c860`, `c7121a0`): migration 066 and its verify block, 24 new check:live probe lines,
     the ledger tasks and tiers, `handbookPath()`, account delete and export, the workspace list filter;
     `DECISIONS.md` §164. Nothing on production.
   - STOP for review.
4. **The page:** `/hr` as the workspace page, built from the shared pieces. STOP: the owner looks. **DONE 7 October**
   at `/hr/new` behind `HR_PREVIEW` (decision 32): 4a shared the list's words, reading and row with no visible change
   (`fd8cedc`); 4b built the shell (`94eb4ac`); `DECISIONS.md` §166.
5. **The Handbooks tab:** upload with the site sheet, rows, versions, could-not-read, delete. HR's own
   reader, with the size and page check (decisions 18, 28). STOP. **5a DONE 7 October** (`86cc896`,
   `DECISIONS.md` §167): adding with the site sheet, every version shown, the drawer, deleting. **5b DONE 7 October**
   (`bee8f30`, §168): HR's reader (text, pages, sections, the coverage proof), "Read it again", and the Haiku guard
   (`npm run haiku`). **The size and page check at upload is deferred to step 6** (owner), when answers send the
   handbook to the model.
6. **The answer:** the loader, web search, the quote and link checks, sources, the day-1 line, drafting on
   request, refusals, the ledger. On Haiku (decision 17). STOP. **6a DONE 7 October** (`0e082f4`,
   `DECISIONS.md` §169): the first real answer, checked quotes and links, follow-ups, text first. **6b next**:
   reopening and the list, plus §169's two follow-ups (the check record; `AI_SEARCH_MAX_HR`). **6b DONE 7 October**
   (`d0e2a0c`, §170): reopen, list, drawer, delete, "Not answered", the check record (migration 069, staging
   only), `AI_SEARCH_MAX_HR`. **6c DONE 7 October** (`7f0d22a`, §171): a long handbook's right sections (one
   selection call plus a safety net), the honest wait (migration 070, staging only), suggested wording as a draft.
   **STEP 6 COMPLETE.** (6c was: a long
   handbook's right sections (the outline-selection call, replacing the temporary over-budget line).)
7. **Conversations and the HR summary** (claim + `after()`; facts from the person's own words, decision 19).
   On Haiku (decision 17). STOP. **DONE 7 October** (`b7d298f`, `DECISIONS.md` §172): one writer with an HR
   option, HR's route behind `HR_PREVIEW`, the drawer with HR's words and source shape, facts to the one queue.
> ### THE BASELINE (the owner, 8 October 2026; `DECISIONS.md` §175). STEPS 8–14 REWRITTEN.
> Rev 1 is **Opus 5.5 at full power, unrestricted**. HR copies the workspace and invents nothing new: the answer's
> prompt is the workspace's open role sentence plus what HR is given; a handbook check is an open HR answer to one
> fixed question; whole handbooks are sent when they fit. Improvements come later as **switches, off by default,
> each measured against the yardstick** (step 12). A switch that only lowers cost (caching) may go on once proven;
> a switch that changes quality stays off until measured.

8. **The handbook check.**
   - **Part 1 DONE 7 October** (`65ca4b9`, §174): the engine — Check now, the sweep, claims, one open check per
     handbook, retry once, cancel on a newer version, stop on delete, progress, finish, next_check_at +90 days.
   - **The baseline DONE 8 October** (`e28a213`, §175): each piece is the same call as an HR answer (migration 072
     stores its answer, sources and check record), the whole handbook when it fits; the row and the drawer draw each
     part as an HR answer. The structured check (Step 8 part 2) is parked on the local branch
     `parked/hr-check-structured`.
   - **STEP 8 DONE 8 October** (`b789dbe`, §176): the email when a check someone pressed finishes (Audits' pattern,
     `notified_at` from 071), the link that opens the handbook's drawer, an older version's drawer, and a check where
     every part failed shown as one line.
   - **Moved with the structured check, for the owner to confirm:** the handbook's company-level dates and "Add to
     calendar" (decision 29) were read from the structured answer; an open answer has no dates to list. They return
     with that switch (below), or by a decision of the owner's before then. STOP.
9. **Answers use the stored check** — built as **a switch, off by default**, judged in the
   testing step against the yardstick. STOP. **BUILT 8 October** (`d2c4df5`, §177): `HR_ANSWER_USES_CHECK`, off; not set
   on production.
10. **Same-night operations** (decisions 13 and 14; the handbook queue, the `vercel.json` entries). When the nightly
    check runs, the Handbooks tab's line and the upload sheet's lede return to the owner's words (§175). STOP.
    **DONE 8 October** (`c6e9ae2`, §178): the summary job at 10:00 UTC with HR conversations by HR's writer, the deleter
    at 10:30, the quiet rule 6 hours or more, the handbook night queue at 10:00 and the sweep every 5 minutes, the
    owner's words restored.
11. **Polish:** retire old HR (decision 15); **the Dates tab** (decision 30); the print frame on HR's drawers. STOP:
    the owner looks.
    **11a DONE 8 October** (`0f79785`, §179), behind the preview switch: the Dates tab hidden, the Ask tab's paperclip
    removed, "Choose where it applies" (current version only), every control clicked, three prints checked.
    **THE GO-LIVE MOVED (owner, 8 October): it is no longer in step 11. It is part of step 13, the release, after
    step 12's testing:** the page moves to `/hr`, old HR is retired (decision 15), `HR_PREVIEW` is removed, and
    `AI_MODEL_HR` and `AI_MODEL_HR_CHECK` are set in Vercel.
    **CHANGED AGAIN (owner, 8 October, §180): HR GOES LIVE NOW, before the finish line.** Step 12's Opus machinery run
    and step 13's go-live happen NOW. The yardstick, the manual sets and the switches are **held for the finish line
    (`docs/TEST-AT-FINISH-LINE.md`, HR part)**.
12. **Testing, with the yardstick.** **NOW (owner, 8 October 2026):** the Opus machinery run only
    (`docs/TEST-AT-FINISH-LINE.md` HR C). **Held for the finish line** (`docs/TEST-AT-FINISH-LINE.md`, HR part): the
    yardstick, decision 10's run, the held fixes and the manual tests. As first written: First **one Opus run per paid path** (answer, summary, handbook check), to catch
    machinery that only fails on the real model. Then **the yardstick**: a baseline run of fixed HR cases — real
    handbooks that belong to the companies they are checked for, and real problems — on Opus 5.5 everywhere,
    recorded; it is what every switch is measured against, one at a time, on the same measures (the workspace's,
    `docs/WORKSPACE-PLAN.md`: what is missed, what is stated more firmly than its evidence, the share of claims from
    the agency's own pages, and searches, tokens and cost per call). Then decision 10's run, the held fixes, and the
    manual tests in `docs/TESTING.md`.
    **Also judge (§172):** whether HR summaries cite handbook passages on Opus. If not, the ready fallback is code
    that attaches a checked handbook quote found in the same paragraph as an item's basis; the owner decides then.
    **Also judge (§175):** how often the grey mark lands on proposed wording or a quote of the law, and whether a
    handbook check on Opus answers the fixed question section by section without being told to.
13. **Release** (the `docs/RELEASE.md` routine). **NOW, after step 12's Opus machinery run (owner, 8 October 2026,
    §180; `docs/TEST-AT-FINISH-LINE.md` HR H).** The three research switches are confirmed `true` on production
    (8 October), and HR reads the same three (§175). **The go-live, moved here from step 11 (§179):** the page to
    `/hr`, old HR retired, `HR_PREVIEW` removed, `AI_MODEL_HR` and `AI_MODEL_HR_CHECK` set in Vercel.
14. **The morning after the go-live** (`docs/TEST-AT-FINISH-LINE.md` HR I). **The next morning's `job_runs` check, and the close-out** (`HANDOFF-HR.md`, `STATUS.md`, `HANDOFF-CODE.md` §7).

### THE SWITCHES, IN ORDER (after the release; each off by default, each measured against the yardstick)

1. **Prompt caching** for the handbooks in the answer and the check — cost only; may go on once proven (§175).
2. **Answers use the stored check** (step 9) — **built, off** (`HR_ANSWER_USES_CHECK`, §177). The testing step
   measures it on Opus: whether it cuts searches (production averages 2.6 an answer), and the order its checks go in
   (today, handbook order, so the question's own handbook can be the one left out for the budget).
3. ~~The workspace's three research blocks for HR~~ — **not a switch any more: in the baseline since 8 October**
   (§175). The owner confirmed all three `true` on production, and HR's prompt is built by the workspace's own
   function, so it carries them as the workspace does.
4. **Cards for handbook words written without quotation marks** — code spots long passages that match the
   handbook word for word (the owner, 8 October).
5. **The structured check** — the local branch `parked/hr-check-structured`: per-section words, "not covered",
   still to confirm, the dates and "Add to calendar", the enforced output format.
6. **Suggested wording as a draft** — the label asked for again, so proposed text is drawn as a draft and never
   marked as a quote (§175 found the mark on proposed wording).
7. **The quote-marker form** ([H12: "…"]) asked for again.

## 2.5 Standing rules

The rules live in these documents. They are not copied here:
- `CLAUDE.md`, all of it, especially §3.7 (no reset or restore without the owner's say-so), §3.11 and §9.1;
- `docs/HOW-WE-BUILD.md`;
- `docs/HANDOFF-WORKSPACE-TO-HR.md` §6–§8;
- `docs/RELEASE.md`.

**And two rules of this section's own (owner, 4 October 2026):** every HR task from here on begins with an
impact check for the work it is about to do, in the shape of §2.6. **A task whose effect on another section
is not in this plan stops before writing code.**

**The impact check is done and REPORTED BEFORE ANY CODE IS WRITTEN (owner, 7 October 2026, `DECISIONS.md` §168).**
Step 5b listed it at the end instead; that is the mistake this line exists to prevent.

**A copy in the code may be deliberate. Before removing one, find the comment or test that explains it; if it
guards something, stop and report.** *(Added after step 3a, where the page's copies of two summary words
turned out to guard the browser bundle from the model SDK: `tests/unit/summaryReport.test.ts` said so.)*

## 2.6 Effects on other sections, decision by decision

From two read-only checks on 4 October 2026: the first against decisions 1–17, the second redone after the
owner's answers 18–31. "Not stated" marks an effect the brief had not named; the answer beside it is the
owner's.

**What the second check confirmed, with lines:**

- **Documents never lists stored files; it reads `documents` rows only.**
  - The only `storage … .list(` call in `app`, `lib`, `components` and `scripts` is account delete,
    `app/api/account/route.ts:137`.
  - Every `.download(` takes `file_url` from a `documents` row:
    - `app/api/document-scan/route.ts:87`;
    - `app/api/jobs/scan-documents/route.ts:211`;
    - `app/api/document-draft/route.ts:84`;
    - `app/api/audit-runs/route.ts:55`;
    - `app/api/audit-runs/[id]/documents/route.ts:170–171`;
    - `lib/attachedDocument.ts:98`.
  - So a file under an HR prefix, with no `documents` row, is invisible to Documents.
- **The storage policies cover any path under the company's own prefix.**
  - `002_storage_company_scoping.sql:91–144`: select, insert, update (USING and WITH CHECK) and delete, each
    on `bucket_id = 'company-documents' and (storage.foldername(name))[1]::uuid in (the caller's
    company)`.
  - Staging's live `pg_policies` for `storage.objects` lists exactly these four.
- **Account delete removes stored files by prefix, not through rows.**
  - `listCompanyObjects` lists `<company>/` and then each folder **one level down only**
    (`app/api/account/route.ts:134–152`).
  - It removes what it finds (`:355`).
  - **So HR's files must sit at `<company>/<hr-prefix>/<file>`, exactly two levels.** A deeper path
    (`<company>/<hr-prefix>/<handbook>/<part>.pdf`, for example split parts) would survive an account
    delete, unless the walk is extended — which changes My Account.
  - Each folder listing is also capped at 1,000 (`:137`, `:145`). That is true of Documents' folders today
    too.
- **None of these can see a handbook kept in HR's own tables:**
  - the Documents sweep (`app/api/jobs/scan-documents/route.ts:165–184`, `documents` rows);
  - the Documents report (`document_index_v`);
  - the dashboard's counts (`app/dashboard/page.tsx:82–87`, `document_index_v` and `checklists`);
  - Audits' input (`lib/audit.ts`, `document_index_v` and `company_labels`).

  This holds as long as HR's reading writes **no** `company_labels`; decision 18 implies it, and this states
  it. The Calendar's existing paths (`app/api/calendar/route.ts`, `calendar_events` by company) see a
  handbook only through the events decision 29 adds.
- **The calendar (decisions 29–30):**
  - `calendar_events.category` is free `text` with **no CHECK**.
    - `000_baseline.sql:90–103`.
    - `006_enums_and_constraints.sql:66–71` deliberately left it unconverted.
    - Staging's constraint list for the table shows only its PK and four FKs. The list can see constraints,
      so the absence of a CHECK is real.
  - The main calendar shows `e.category` as small grey text (`app/calendar/page.tsx:526`). Its
    `CalendarEvent` type has no `document_id` (`:8–18`), so **it shows no source and no link**. An `'hr'`
    event would show its title, the grey word **"hr"**, its due line and its date — no site, no link to the
    handbook.
  - The `CATEGORIES` dropdown (`:20–23`) offers neither `'document'` nor `'hr'`. That is already true for
    Documents' dates.
  - The Documents report's pattern (`app/api/document-actions/route.ts:127–151`) writes
    `category: 'document'` and **no `entity_id`**. HR's version adds both the site and `handbook_id`.

| # | Files outside HR it changes or depends on | Section | What a person there sees; proof | Answer |
|---|---|---|---|---|
| 1 | `app/compliance/page.tsx` (buttons `:183–194`, CSS `:1132–1166`, `Working` `:1901`, `OneLineLink` `:1935`, `FoldRow` `:1954`, `ReportView` `:1982`, stages `:2076–2111`, `Sheet` `:2221`, `Empty` `:2241`, tabs `:1200–1217`); `app/globals.css`; new shared component files | Workspace; shared components | Nothing. Proof: `npm run measure` before and after. The print class names occur only in `app/compliance/page.tsx` (grep). The Audits, Company information and report copies are not changed | As planned |
| 2 | New tables; account delete and export; `job_runs_job_check`; the job union in `lib/jobAuth.ts:66`; `vercel.json` | My Account; nightly jobs | Nothing visible. Proof: `scripts/check-schema-contracts.js` fails the build if a `company_id` table is missing from account delete | **Not stated → 24** |
| 3 | None (`lib/attachedDocument.ts` untouched) | — | Nothing | — |
| 4 | Would have touched `verifyQuote` (`lib/documentScan.ts:189–202`) | Documents | Nothing | **Ambiguous → 20**: a new HR-only function |
| 5 | `topics` column; `topic_list_v` recreated (`065:43–86`); the list at `app/compliance/page.tsx:432–437`; inserts at `chat:461–464`, `:642–645`; `check-live.js:109–111`, `:821–825`; `/api/to-confirm` (`app/api/to-confirm/route.ts:74–75`) | Workspace; Company information | Workspace: nothing; the same rows. Proof: `check:live` plus a measure run. Company information: HR facts join the one queue, labelled with the conversation's title | **Not stated → 19** (facts, by the person's own words). The counter is invisible: the dashboard does not read `usage_counters` (map B5) → **26** |
| 6 | — | — | — | **Replaced by 18, 21**: no `documents` flag, no scan-prompt change, no Documents UI |
| 7 | — | — | — | **Replaced by 18, 22**: HR never writes `documents.entity_id`, so the Documents site filter (`app/documents/page.tsx:478`), the scan's fact sites (`lib/documentScan.ts:743`, `:950–955`) and the `049:52` gap are untouched |
| 8 | — | — | — | **Replaced by 18**: versions on HR's rows |
| 9 | Migration restating `ai_calls_task_check` (`064:71–75`); `lib/costLedger.ts:22–36`; `lib/ai.ts:27`, `:96–140`; `tests/unit/costLedger.test.ts:111–115`; `docs/RELEASE.md:85–96`; `.env.example` | Scripts (cost); release | Customers: nothing. The owner: `npm run cost` lists `hr` and `hr_check` under "NEVER written a row" until first used | As planned |
| 10 | `lib/companyContext.ts`, existing parts only | — | Nothing | As planned |
| 11 | Reuses `normaliseForMatch` / `quoteKey` (`lib/summaryReport.ts:159–167`) unchanged | Workspace (shared lib) | Nothing. Proof: `tests/unit/summaryReport.test.ts` | As planned; facts per **19** |
| 12 | Would have been refused by the Documents sweep over 100 pages | Documents | Nothing now: no handbook reaches the sweep | **Not stated → 28**: HR's alone |
| 13 | `vercel.json:3–4`; `lib/topicClaim.ts:128`; `tests/unit/topicClaim.test.ts:133–156`; `lib/conversationStatus.ts:12–14`; `scripts/check-live.js:386–392`, `:803`; the docs in map B6 | Workspace; nightly jobs | Workspace: a conversation reads "Summary ready" the morning after. "The summary is written overnight" (`app/compliance/page.tsx:1690`) stays true for Oregon (10:00 UTC is 3 am PDT, 2 am PST). A conversation picked up the next day is summarised again. Proof: the topicClaim unit test, plus the `job_runs` check | **Not stated → 23**: accepted |
| 14 | `app/api/jobs/summarise/route.ts:120–124` | Nightly jobs; Workspace | Workspace: nothing. Proof: `check:live` summarise | As planned |
| 15 | Removes the old HR files; comments naming them at `lib/storage.ts:10`, `lib/documentContent.ts:31`, `app/api/chat/route.ts:101`; `hr_audits` stays in account delete and export; `components/AIDisclaimer.tsx` stays for `/requirements` | Requirements; My Account | Nothing | The old handbooks → **25** |
| 16 | `scripts/schema-doc.js:139–142`, which regenerates `docs/SCHEMA.md` | Every section's schema doc | `SCHEMA.md`'s "nothing" grants become real grant lists | **27**: the `document-scan` `maxDuration` part moves to `HANDOFF-CODE.md` §7 |
| 17 | Process only | — | Nothing | — |
| 18 | `company-documents` bucket, under an HR prefix; storage policies `002:91–144` (unchanged); account delete's walk (`app/api/account/route.ts:134–152`) | My Account | Nothing, **if HR's files sit exactly two levels deep**. Deeper files would survive an account delete. Proof: a delete probe on a staging company that holds a handbook | **24** covers deleting the files; the two-level path is a requirement on HR's build |
| 19 | `fact_proposals` (unchanged shape); `/api/to-confirm` | Company information | Facts from HR conversations appear in the one queue, labelled with the conversation's title | Stated |
| 20 | None (`verifyQuote` unchanged) | Documents | Nothing. Proof: the Documents golden set does not move | Stated |
| 21 | None | Documents | Nothing | Stated |
| 22 | `HANDOFF-CODE.md` §7 row | Documents | Nothing (dormant) | Stated |
| 23 | As 13 | Workspace | As 13 | Stated |
| 24 | `app/api/account/route.ts:189–215`; `app/api/account/export/route.ts:79–89`; `job_runs_job_check`; `lib/jobAuth.ts:66` | My Account; nightly jobs | Export gains HR's tables. Delete removes HR rows and files | Stated |
| 25 | None | Documents | Nothing: the two production files stay as they are | Stated |
| 26 | `HANDOFF-CODE.md` §7 row | Dashboard | Nothing | Stated |
| 27 | `app/api/document-scan/route.ts` untouched; `HANDOFF-CODE.md` §7 row | Documents | Nothing | Stated |
| 28 | None outside HR | Documents | Nothing | Stated |
| 29 | `calendar_events` gains `handbook_id` (nullable, `ON DELETE SET NULL`); `lib/database.types.ts` regenerated; account export (`select *` of `calendar_events`, `app/api/account/export/route.ts`) | **Calendar**; My Account | Calendar: events marked `'hr'` appear in the main calendar only when a person presses "Add to calendar", shown as described above (grey "hr", no link, no site). The export's calendar rows gain a `handbook_id` field. Proof: a staging probe inserting one `'hr'` event | Stated, and reported as a Calendar effect. The export field is the same change seen from My Account |
| 30 | Reads `calendar_events` only | Calendar | Nothing in the main calendar | Stated |
| 31 | Later version | — | — | Stated |

**This step's own doc edits:**
- `DECISIONS.md`, `HANDOFF-CODE.md`, `HOW-WE-BUILD.md`, `VISION-DOCUMENTS.md`, `WORKSPACE-PLAN.md`,
  `STATUS.md`, `README.md`, `HANDOFF-WORKSPACE-TO-HR.md`.
- No code reads any of them. Scripts and tests mention them only inside strings: `scripts/bakeoff-report.js`,
  `tests/unit/extractJsonText.test.ts`.
