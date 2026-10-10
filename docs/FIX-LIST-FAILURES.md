# Failures that look like facts — the fix list

**Version:** 3 · **Updated:** 9 October 2026: D4 and D13 partly fixed by A3e (`c02f4f2`), from its sweep table.
Version 2: 9 October 2026: L1, WA1 and AR1 FIXED by Job A's A3e (`621490d`), confirmed on the live
tree; A-prompt narrowed. Version 1: 9 October 2026, by the Calendar chat, at the owner's request: *"do a full read on all
codes and find out similar flaws. make a list and at the end of this session, fix all, so that we don't get diverted
from the original work."*
**Fixed by:** Job E (`docs/CALENDAR-PLAN.md` §2.4), after Job C. Not before: Calendar's work comes first.
**Read from:** the code zip `compliboard_2026-10-09_0954_no-keys.zip`, read-only, in four parts (Documents · Audits ·
Workspace and HR · shared code with Dashboard and My Account). That zip is from **before Calendar Job A**, so:
- line numbers are the zip's and may have moved — **Claude Code confirms every line on the live tree before fixing**;
- Job A's own new code (`lib/calendarDates.ts`, `app/api/calendar/dates`, `saveScan`'s calendar step, migrations
  073–076, the monthly email) is **not** in the zip and must be swept the same way in E0.
**Marks:** ✓ = the chat read the line itself and the claim holds. · = traced by the review, not yet re-read by the
chat. HYPOTHESIS = one step could not be traced; it says which.

---

## 1. The flaw, in plain words

Something fails — a rate limit, a timeout, a database hiccup, a file that cannot be read — and the code treats the
**absence** that follows as a **real "nothing"**. Then it shows that "nothing" to a person, tells it to the model,
emails it, or acts on it: deletes, withdraws, closes, cancels. It looks exactly like it worked (`HOW-WE-BUILD.md` §3),
and it breaks `CLAUDE.md` §3.2: absence of evidence is not evidence of absence.

The case that started this (Calendar Job A, A3d/A3e): a permit's re-read hit a rate limit. The failed reading became
the permit's current reading, so the permit lost its title and agency, dropped out of Oregon DEQ's audit, and the
audit's prompt then said of it *"WHAT THE READING FOUND WRONG WITH IT: nothing"* (`lib/audit.ts:337–339`) — a false
statement made from a failure. Migrations 075 and 076 and step A3e fix that one. This list is everywhere else.

**Severity:** 1 = deletes, closes or loses data · 2 = tells the model or a person something false · 3 = hides
something true or shows a blank · 4 = cosmetic.

---

## 2. Six roots, not eighty patches

Almost every item is one of six patterns. **Fix the pattern once, then apply it** — that is how Job E stays a job and
not a month.

| Root | The pattern | The one fix |
|---|---|---|
| R1 | A failed reading becomes the document's current reading, and everything downstream believes it | The rule of `DECISIONS.md` §185a, already in 075/076/A3e: a reading that could not read owns its status and nothing else. Remaining: the **writes** (withdraw, prune) and two screens |
| R2 | A database read that fails comes back as zero rows (`data ?? []`, only `data` destructured, `error` never read) | One helper that throws on `error`, used everywhere; screens show "Couldn't load" instead of their empty state |
| R3 | An empty list is printed as a statement ("nothing", "none", "nothing needs you") when the truth may be "not read" | Say "not read" when it was not read; count failures before saying "nothing" |
| R4 | A model answer that did not finish or did not fit is saved as complete | Check `stop_reason`; reject an answer whose shape is wrong; strip citation markers before parsing |
| R5 | Something is switched off before its replacement is ready | Switch over only once the new thing has succeeded |
| R6 | A renamed label is invisible to the code that decides what is still in use | Decide "in use" from the view that applies corrections |

---

## 3. The list

### R1 — a failed reading becomes the current one

1. **D1 · sev 1 · ✓ FIXED (Job E1, "Job E: D1 — a failed re-read emptied a document's open questions") · Documents.** `lib/documentScan.ts:931–934` withdraws every pending fact proposal of the
   document on **every** save, a failed one included (`saveScan` has no early exit for `could_not_read`; the only
   branch is `:978`). A rate-limited "Read it again" empties that document's questions from Company information and
   the sidebar badge, and replaces them with nothing. It also runs before the insert (`:940`). **Fix:** withdraw only
   after a readable reading's facts are in; never on `could_not_read`.
   **Closed:** a `could_not_read` reading now withdraws nothing and says why, on a new `facts` step
   returned beside `calendar` (`FactsStep`); and the rows a good re-read replaces are **chosen by
   id before** the insert and **withdrawn after** it, so a failed insert leaves the earlier
   questions standing. The read that chooses them goes through `tryRows`; a failure there withdraws
   nothing and records it on the step rather than throwing, because `saveScan`'s caller writes a
   `could_not_read` scan over a reading whose save threw. **Proof:**
   `scripts/fixlist-d1-proposals.mjs`, free, on staging, run twice. On the shipped code: the failed
   reading withdrew **6 of 6**, and the refused insert left **0 of 6**. On the fix: 6 of 6 stand in
   both cases, and part C shows an ordinary good re-read still withdrawing all 6 — a fix that
   stopped withdrawing anything would bring back the two-paraphrases arbitration the withdrawal was
   introduced for.
2. **L1 · sev 1 · ✓ · Documents → Audits.** `lib/companyLabels.ts:57–58` (`pruneOrphanLabels`, called after a
   document delete at `app/api/documents/route.ts:302`) decides a label is dead from `is_current` scans. After a
   failed re-read, deleting any other document deletes the agency label if that permit was its only carrier, and
   "audit everything" stops auditing that agency. **Fix:** alive = carried by the latest **readable** reading (see
   also D2, R6).
   **FIXED in A3e** (`621490d`): `lib/companyLabels.ts:64` now uses `readableScanIds(admin, companyId)`; the replay
   (failed re-read → delete another document) shows removed 0 and "Oregon DEQ" still there.
   **SUPERSEDED IN JOB E1 by D2's fix**, which reads `document_index_v` instead — the same readable
   rule, in SQL, plus the corrections `readableScanIds` could not see. `readableScanIds` is no longer
   called from this file, and `scripts/fixlist-d2-rename.mjs` re-proves the L1 case through the new read.
3. **D6 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** `app/api/document-scan/route.ts:88–96` (and `app/api/jobs/scan-documents/route.ts:
   211–218`): **any** storage download error is told to the person as *"Upload it again — the record is here but the
   file is not"*, which makes them create a duplicate, and it is saved as a failed reading that replaces a good one
   (then D1). **Fix:** that wording only for object-not-found; for anything else, say storage was unreachable, write
   no reading, leave the document queued.
4. **D13 · sev 3 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** `components/DocumentReport.tsx:500`: after a failed re-read the drawer shows only
   the reason and "Upload a clearer copy"; it hides the earlier reading's open gaps, checklists, dates and facts.
   `app/api/documents/index/route.ts:69–73` reads `expected_missing` from the current scan too. "Upload a clearer
   copy" is the wrong advice for a rate limit. **Fix:** the drawer shows the last readable reading under the grey
   line (§185a), with "Read it again" as the way forward when the failure was not the file. **PARTLY FIXED in A3e**
   (`c02f4f2`): the report's gaps split (`app/api/documents/report/route.ts:31`) and the index's `expected_missing`
   (`app/api/documents/index/route.ts:73`) now take the readable reading. **Still open:** the drawer's own
   `could_not_read` view (`components/DocumentReport.tsx:500`) and its "Upload a clearer copy" advice — E0 checks.
5. **WA1 · sev 3 · ✓ · Workspace.** `lib/attachedDocument.ts:146–148`: an attached document's "read as" and summary
   come from the current scan and go blank after a failed re-read. **Fix:** the readable reading. **FIXED in A3e**: `lib/attachedDocument.ts:152`, named as a
   Workspace change.
6. **AR1 · sev 3 · ✓ · Audits.** `lib/auditRun.ts:585`, `:773` store the findings' `scan_id` from the current scan;
   `:1020–1022` takes the report's "readings as of" date from `is_current` scans. **Fix:** the readable reading.
   **FIXED in A3e**: `:1026` now reads the readable reading; `:586`, `:774` needed no change, because
   `lib/audit.ts:234` now fills `scan_id` with the readable scan.
7. **D-two · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** `lib/documentScan.ts:744`: the `is_current: false` update is unchecked and not
   atomic with the insert. If it fails, a document has two current scans, the view returns two rows, and the report
   route's `.maybeSingle()` errors into "Document not found" (404). **Fix:** check the error; one statement or a
   function.
8. **B3 · sev 3 · ✓ FIXED (Calendar B3, commit "Calendar B3: the dashboard's dates, and three confident zeros") · Dashboard (ours).** `app/dashboard/page.tsx:97`: "Files reviewed" counts
   `display_status !== 'could_not_read'`; 076 keeps the status from the current reading, so a failed re-read still
   drops a well-read document from the count and lists it as "Could not read". **Fix:** count documents with a
   readable reading. Goes into **Job B** (the dashboard is rebuilt there).
   **Closed:** `filesReviewed` counts `readable_scan_id !== null`. **On today's staging data the old
   rule and the new one both say 12** — so the fix changes no number anybody can see, and saying "the
   counts match" would be reporting the absence of a test as proof. `scripts/calendar-b3-readable-count.mjs`
   BUILDS the state instead (a good reading, then a failed re-read on top) and asks the view: old rule
   NO, new rule yes. The probe is a throwaway company, deleted on exit and on a crash.

### R2 — a failed database read becomes "zero rows"

*Severity 1 first. One helper, then these.*

9. **D3 · sev 1 · ✓ FIXED (Job E1, "Job E: the R2 helper, and D3") · Documents.** `app/api/folders/route.ts:134–158`: the "does this folder still hold files /
   sub-folders" counts never read `error`, so a failed count is 0 and a full folder is deleted — sub-folders and
   `folder_audits` cascade, documents become unfiled. No screen calls it today; the API does. **Fix:** check both
   errors, refuse on failure.
10. **W1 · sev 1 · ✓ FIXED (Job E1, "Job E: W1 — a database hiccup closed every open obligation") · Workspace (requirements).** `lib/obligationWriter.ts:96–110`: five reads, only `company`
    checked. A failed `requirement_templates` read sends an empty set to `close_and_replace_obligations` (migration
    023), which **closes every open obligation**, stamps `obligations_computed_at`, and /requirements says "found
    none that apply to you. That is a result, not a gap." A failed `company_switches` read closes every decided row
    and reopens it as unknown. Runs on **every** answer to a company question. Rows are closed, not deleted; the next
    good run reopens them. **Fix:** check all five; refuse an empty set while open rows exist.
   **Closed:** all five go through `mustRow`/`mustRows`; the `companies` read moved to
   `.maybeSingle()` so "this company does not exist" stays apart from "we could not ask"; an
   **empty library** throws (188 shared rows cannot mean "nothing applies to you"); and an empty
   result is refused while open rows exist, with the count in the sentence — which catches an
   emptiness that arose for a reason nobody has thought of yet. `obligations_computed_at`'s own
   error is checked too. **Proof:** `tests/unit/obligationWriterReads.test.ts` runs the real
   `writeObligations` against a fake database and logs every RPC attempted; **8 of its 11 tests
   fail on the shipped code**, the first with `Missing expected rejection` — the old code did not
   throw, it called `close_and_replace_obligations(0 obligations)`.
11. **M2 · sev 1 · ➜ MOVED TO MY ACCOUNT'S SECTION (the owner's §5 answer 4, 10 October) · NOT FIXED HERE · My Account (ours).** `app/api/account/route.ts:356–360` (profiles read unchecked → no login
    deleted, the company row still is), `:137` (a failed storage list = "no files"; files stay in the bucket; more
    than 1000 in a folder are missed), `:424–426` (`deleteUser` errors ignored). The response says `success: true`.
    The person asked us to delete their data and we kept some and said we did not. **Fix:** check every error and
    stop before deleting rows; page the storage list; check each `deleteUser`.
12. **M1 · sev 1 · ➜ MOVED TO MY ACCOUNT'S SECTION (the owner's §5 answer 4, 10 October) · NOT FIXED HERE · My Account (ours).** `app/api/account/export/route.ts:61–63`: a failed table read becomes
    `[]` and its count 0 (also profiles `:109`, checklist_items `:117`, obligation_evidence `:123`). The cancel screen
    says "Take your records first", and the deletion after it is permanent. **Fix:** fail the whole export if any read
    fails. *(See also O4: the export leaves whole tables out.)*
13. **M3 · sev 1 (small) · ➜ MOVED TO MY ACCOUNT'S SECTION (the owner's §5 answer 4, 10 October) · NOT FIXED HERE · My Account (ours).** `app/api/account/route.ts:57` and
    `app/account/page.tsx:75`: a failed load shows a blank name (or a blank form with no error); Save then writes
    `full_name: ''` over the stored name (`route.ts:116–118`). **Fix:** GET returns 500 on any read error; the page
    shows it and disables Save.
14. **A2 · sev 1 · ✓ FIXED (Job E1, "Job E: A2 — a failed read of a run's summary erased the run") · Audits.** `lib/auditRun.ts:513–514`, `:538–539`: a failed read of the run's summary
    merges `{}` and writes it back, erasing the run's note ("This checklist names X…"), the extraction receipt and
    earlier sections' counts. **Fix:** check the error, or patch the summary in SQL (`summary || patch`).
    **Closed, and it is not small.** Both call sites go through `lib/auditSummary.ts`'s
    `patchRunSummary`, which reads through `mustRow` and **writes nothing at all** on a failure,
    returning it for the caller to warn about — a section that read documents, called a model and
    saved its findings must not be failed for a bookkeeping read, but it must not write a summary
    built on one either. Two more reads of the same column were checked for the same reason:
    `finishRunIfDone`'s collapse count (that write REPLACES the summary) and `summariseRun`'s own
    read of the run, which carries the note, the receipt and the reshaped lists forward.
    **Proof:** `tests/unit/auditSummary.test.ts`, 15 tests. `oldPatch` is the shipped
    read-modify-write copied line for line and shows the summary becoming **one key** on a failed
    read — note, receipt and the earlier section's count gone. Three tests fail on the shipped
    `lib/auditRun.ts`.
    **The SQL route was NOT taken**, with a reason: it needs a migration and two functions to express
    "append to this list" and "add to this number", and the only thing it buys beyond this is
    atomicity for a read-modify-write race that is not live — the sweep claims one company at a time
    and runs its sections one after another (`app/api/jobs/audit-sections/route.ts`). If sections ever
    run concurrently, `lib/auditSummary.ts` is where that fix goes, and it says so.
15. **C1 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Shared — every section.** `lib/companyContext.ts:232, 234, 276, 300, 311, 340, 357,
    369, 384`: none of the eight reads checks `error`. A failure is rendered as a statement — "State: not recorded",
    "(no sites recorded)", "(nothing declared yet…)", "(nothing confirmed yet)", labels "(none yet)", and the
    dismissed-gaps block left out. It feeds Workspace answers, HR answers, the handbook check (kept 90 days), document
    scans (which then re-raise gaps a person dismissed — D10), drafts, audits (A5) and the Company information screen
    (D9). **Fix:** throw on any error, so no model call is made on a context built from a failed read. *The single most
    shared item on this list.*
16. **A3 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Audits.** `lib/audit.ts:135`: the document list read is unchecked; a failure tells the model
    "(none — this company holds no document any reading attributed to this agency)" (`:325`) and "(nothing else on
    file)" (`:408`), the section is saved done and the result emailed. **Fix:** throw.
17. **A4 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Audits.** `lib/audit.ts:163–180`: the five evidence reads (gaps, conditions, deadlines,
    expected, proposals) never read `error`. A failed gaps read prints "found wrong with it: nothing" (`:339`); the
    others silently drop. **Fix:** check all five and throw.
18. **A6 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Audits.** `lib/auditRun.ts:382–384`: if the run row cannot be read, a checklist section is
    audited as an agency named after the checklist line; no document carries it; the model sees "(none…)"; saved
    done; the previous-run link is lost. **Fix:** `fail(...)` when `error || !runRow`.
19. **A8 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Audits.** `lib/auditRun.ts:1179–1186`: the end-of-run summary is computed from three
    unchecked reads; a failed findings read stores an all-zero summary for good and emails "nothing needs you".
    **Fix:** check all three and throw before marking the run done.
20. **A11 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Audits.** `lib/audit.ts:117` (agency list, `company_labels`): a failure makes a specific
    audit refuse with "None of your documents name an agency yet" (`app/api/audit-runs/route.ts:126–127`) and an
    "all" audit finish as "No document on file names an agency yet…" (`lib/auditRun.ts:287–293`). **Fix:** throw.
21. **A12, A13 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Audits.** `app/api/audit-runs/[id]/documents/route.ts:104–109`, `:136–142` (the zip's
    index.txt says "(a document this audit cited is no longer on file)" for every document — a file a person may
    hand an inspector) and `app/api/audit-runs/[id]/route.ts:33–44`, `:71–76` (the drawer says "no longer on file",
    "0 documents read", "Nothing was answered."). **Fix:** check errors, return 500.
22. **D7 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** `lib/documentBatch.ts:60`, `:65–67`: a failed read gives a batch summary of 0;
    `app/api/jobs/scan-documents/route.ts:327–335` stores it, marks the batch done for good and emails "We've read your
    0 documents. Nothing needs attention." **Fix:** throw; mark done only when the summary counts every document.
23. **D8 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** `app/api/to-confirm/route.ts:313–314`: a failed `switches` lookup makes a
    company-question answer (e.g. has employees) a plain fact; the obligation engine never sees it and the question
    disappears. **Fix:** check, return 500.
24. **D9 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Company information.** `app/api/company-information/route.ts:51–53`, `:78–80`, `:107–109`
    (and C1): a failure shows "Nothing declared yet" / "Nothing confirmed yet", "0 waiting", "Merge X … on 0
    documents?"; worse, a proposal that contradicts a settled fact is not lifted out, so **Confirm all overwrites the
    settled value** (`app/company-information/page.tsx:221–227`, `:255`). **Fix:** C1 plus checks here; "Couldn't
    load".
25. **D10, D11 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** The scan's context reads (`lib/documentScan.ts:453–456` open gaps; C1's
    labels, keys, corrections, dismissed) — a failure re-raises dismissed gaps and coins second spellings of agencies.
    `lib/documentScan.ts:810–812`, `:831`, `:880–883`: a failed read of the fresh or prior gaps stamps "Not seen in
    the latest reading" on gaps the reading did raise, doubles `open_gap_count`, or says "The latest reading did not
    raise this" for all. **Fix:** throw; never scan on a partial context.
26. **D12, D15 · sev 2–3 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** `app/api/document-checklist/route.ts:55` ("There are no open gaps on
    this document" while the drawer lists them); `app/api/documents/report/route.ts:35–60` (nine reads, sections
    vanish under "Needs work"); `app/api/to-confirm/route.ts:74`, `:78` (count 0, the badge disappears — also B4).
    **Fix:** check, return 500.
27. **D14 · sev 3 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents → Audits.** `lib/documentScan.ts:972`: the `company_labels` upsert result is not
    checked; a new agency never enters the vocabulary, so "audit everything" skips it. **Fix:** check, throw.
28. **H2 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · HR.** `lib/hrAnswer.ts:153–155`: a read handbook whose sections fail to load is still listed
    as used ("Reading <handbook>"), with an empty block in the prompt; the model then says the handbook does not cover
    the question. HYPOTHESIS for the model's wording. **Fix:** throw; a read handbook with no sections is "not used",
    with a reason.
29. **H3 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · HR.** `lib/handbookCheck.ts:553–556`: if the nightly job's read of finished checks fails,
    every current handbook of every company looks never checked; each gets a full Opus check with a false reason, and
    its next date is reset. **Fix:** throw. *(Costs money when it happens.)*
30. **H5, H6 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · HR.** `lib/hrAnswer.ts:124`, `lib/handbookCheck.ts:302–303` (a failed sites read tells
    the model every site handbook "applies to a site that was removed", stored with the check); `lib/hrAnswer.ts:
    611–617` (behind `HR_ANSWER_USES_CHECK`, off: "X has not been checked yet"). **Fix:** throw.
31. **W5 · sev 2 · ✓ FIXED (Job E2, "Job E: S1, A7, S2, H1, W5 and HR-read") · Workspace.** `app/api/checklist-items/[id]/how-to/route.ts:87`: a failed read sends "CHECKLIST
    TITLE: (none)" to the model, and the result is saved and **never redone** (`:61`); a zero-step result is kept for
    good too. **Fix:** check, release the claim.
    **Closed, both halves.** The checklist read is checked and a failure releases the claim, so the
    next press can try again rather than a wrong answer being saved for good — `:61` returns a
    stored `howto` without asking anything. And a result with **no usable step** is not stored:
    `checkHowTo` accepts `steps: []` because every step may be dropped for a link the search never
    returned, which is right per step and wrong to keep, since an empty answer would then show for
    ever. S2's stop-reason guard is in this route too, before the parse.
32. **W6 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Requirements.** `app/api/obligations/route.ts:63–69`, `:112`: every owed row says "Nothing yet.
    No document has been linked to this requirement."; "0 requirements are loaded". No nav link today. **Fix:** check.
33. **W8 · sev 3 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Workspace.** `app/api/switches/answer/route.ts:76–81`: a failed read records the answer with
    no previous value; the overwrite history is lost. **Fix:** check before any write.
34. **B1 · sev 2 · ✓ FIXED (Calendar B3, same commit) · Dashboard (ours).** `app/dashboard/page.tsx:64–67`: `res.ok` never checked — a 500, an
    expired session or a 404 all show "No deadlines in the next 30 days." **Goes into Job B**: the dashboard's
    calendar part is rebuilt there and must not ship this again.
   **Closed:** `if (!cRes.ok) throw` plus a shape check, and the sentence "No deadlines in the next 30
   days." is gone from the file. The panel now says it could not load and links to the calendar.
35. **B2 · sev 2 · ✓ FIXED (Calendar B3, same commit) · Dashboard (ours).** `app/dashboard/page.tsx:57`, `:89`, `:102`: failed reads show 0 in all
    four counters, "No documents read yet." and a blank company name — the "confident zero" the file's own comment
    forbids. **Job B.**
   **Closed:** each of the three reads sets its own flag (`broke.profile` / `.dates` / `.documents`),
   and each panel says so: the four counters show **—** rather than 0, the heading falls back to "Your
   company", and the readings list is guarded BEFORE its empty state — whose comment claimed the
   sentence was true while nothing checked that the query had succeeded.
   **Proved by breaking the reads, not by reading the source:** `npm run measure -- /dashboard --break
   "/api/calendar/dates" --break "document_index_v" --break "/companies" --shot ...`. `--break` was
   added to `scripts/measure-layout.mjs` for this and is there for the rest of this list.
   `shots/b3-dash-good.png` is the same page with every read working — R2: a check that reports an
   absence has to be shown seeing a presence first.
35b. **B2b · sev 2 · PARKED BY THE OWNER — the landing page is its own project · Landing page (ours).**
    **Two marketing images say "overdue" in baked pixels**, which `DECISIONS.md` §185c forbids
    everywhere: all the product knows is that a day has gone by, and "overdue" states that the work
    was not done. Found by LOOKING at the page during Calendar B4 — the rule had already been applied
    to the calendar page, the dashboard and the monthly email, and nothing had looked at the picture
    on the most public screen we have.
    - `public/Hero2.png` — "⚠ Overdue · 3 deadlines past due", then "99 days overdue", "48 days
      overdue", "17 days overdue" on three rows, plus "+ Add deadline".
      Evidence: `shots/calendar-jobB-b4-hero-asset-crop.png`.
    - `public/Audit_report_4.png` — "Update due before September 2025 — currently overdue."
      Evidence: `shots/calendar-jobB-b4-audit-asset-overdue.png`.
    `public/How_it_works_6.png` was checked too and is clean.
    **Claude Code cannot fix these**: they are flattened PNGs, so the words are pixels and there is
    no text to edit. The JSX mock beside Hero2 on the same page *was* fixed in Calendar B4 ("3 dates
    have passed", amber not red) — which now leaves the real screen and the picture of it
    disagreeing, and the picture is the one a visitor reads first. **The owner's call**: new artwork,
    or drop the two panels from the images. **Not Job D and not Job E** (the owner, 9 October 2026, evening: *"that is a whole work after all the
    sections are done. the whole app idea changed since that landing page was made"*). The landing page is
    rewritten as its own project once every section is done; these two images go with it.

35c. **P1 · sev 3 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · the app shell (ours).**
    **Every printed page carries the left navigation and the footer links.** `app/globals.css`'s
    `@media print` block hides only `.no-print`, and `components/AppLayout.tsx`'s sidebar is not
    marked with it — the header at `:220` is, the sidebar is not. So a printed audit, handbook,
    document report or calendar month has "Dashboard · Audits · Compliance Workspace · HR
    Workspace · …" down its left edge and "Privacy Policy · Terms of Service · Contact" at the
    bottom, on paper a person hands to an inspector.
    **Found during Calendar B7**, by rendering the page as the PRINTER sees it rather than by
    reading the stylesheet — `npm run measure -- /calendar --print --full --shot …`, which is what
    `--print` was added for. Checked on `/hr` as well: **the same**, so it is not the Calendar's.
    Evidence: `shots/calendar-jobB-board13-print.png`.
    **Not fixed here, deliberately.** One line of CSS changes what EVERY section prints, and a
    Calendar job is the wrong place to change Audits' and HR's printed output without their impact
    check (§3.12). The disclaimer line in the footer is marked print-visible **on purpose**
    (`AppLayout.tsx:298`) and must survive any fix.

36. **M4 · sev 2 · ➜ MOVED TO MY ACCOUNT'S SECTION (the owner's §5 answer 4, 10 October) · NOT FIXED HERE · My Account and signup (ours).** `app/signup/page.tsx:81`, `app/account/page.tsx:40`: a failed
    industry list leaves only "Don't see your industry?", so a company signs up as `other` — which drives requirements
    and every prompt. It has failed once already (11 Sep). **Fix:** check `res.ok`, show an error with retry.
37. **M5 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Shared.** `components/AppLayout.tsx:134–139`, `app/api/feedback/route.ts:10`: "Thank you for
    your feedback" whether or not the email went (Resend returns errors, it does not throw). **Fix:** check both.
38. **The rest, sev 3 · ✓ ALL SEVEN FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items"):** A15 (database errors shown as "not found" — `app/api/audit-runs/[id]/route.ts:26–31`, the
    retry route, audit-findings, audit-checklist, the zip route); W7 (`lib/topicList.ts:63` → "No conversations
    yet" in both Workspace and HR); W9 (`app/compliance/page.tsx:365–368`, facts-waiting line hidden); H7
    (`app/hr/HrWorkspace.tsx:197–199`, `lib/handbookCheckView.ts:74, 104, 108` → "No handbooks yet", "Not checked
    yet"); H8 (`lib/handbookCheckNotify.ts:79–82`, the email omits "N parts could not be checked"); B4
    (`components/AppLayout.tsx:77`, the Company information badge vanishes); S4 (`lib/jobRun.ts:34` with unchecked
    "find work" queries in `app/api/jobs/scan-documents/route.ts:165–168` and `app/api/jobs/audit-sections` `:75`,
    `:94`, `:114` — a sweep broken for days looks the same as "no work", the silence the file says it prevents).

### R3 — an empty list printed as a statement

39. **A-prompt · sev 2 · ✓ · Audits.** `lib/audit.ts:337–339`: a document whose reading failed is printed "WHAT THE
    READING FOUND WRONG WITH IT: nothing". **A3e FIXED the main case** (`lib/audit.ts:174–177`: the permit
    now shows its 1 gap, 4 conditions and 1 date after a failed re-read). **Still open:** a document with **no**
    readable reading at all still gets "nothing" — it must say "not read". **Quality change (§3.1): the words go to the owner.**
40. **D4 · sev 2 · ✓ · Documents.** `lib/documentScan.ts:445–447`: "WHAT THIS COMPANY ALREADY HOLDS" lists only
    current-scan titles, cut at 40 alphabetically with no "and more", and leaves out documents queued but not read
    and failed ones; then `(nothing else on file yet)` (`prompts/document-scan.ts:74`). In a folder upload, file 1 is
    read while 2–N are queued, so the model lists documents the company **does** hold as "What we'd expect and don't
    see" (`app/documents/page.tsx:901`); and `expected_missing` is frozen at scan time, never re-checked. **Fix:**
    list every document (unread ones by file name, marked "not read yet"), say "and N more", and filter the
    expected list against what is held when the page shows it. **PARTLY FIXED in A3e** (`lib/documentScan.ts:453`):
    a document whose re-read failed is listed from its readable reading. **Still open:** queued documents, the cut
    at 40, the frozen expected list. **Quality change: the prompt goes to the owner.**
41. **A9 · sev 2 · ✓ FIXED (Job E3, "Job E: A9, A10, A14 and D5") · Audits.** `lib/auditNotify.ts:96–103`: the subject ignores failed sections — an audit whose
    every section hit a rate limit is emailed as "Your Oregon DEQ audit: nothing needs you". After Retry, the
    corrected result is never emailed (`:66`, `notified_at` already set). **Fix:** branch the subject on what
    finished; re-notify after a retry.
    **Closed, both halves.** `auditSubject(summary)` is pure and exported: nothing finished →
    *"Your <X> audit could not be finished"*; some did → both halves, *"2 things that need you, and
    1 of 4 parts did not finish"*; and **"nothing needs you" is never said when a part never ran**,
    because what that part would have found is not known. A clean run's subject is word for word
    what it was, asserted against the shipped function. The retry now clears `notified_at` — nothing
    did, so **the corrected result was never emailed at all** — and counts `retried_parts` on the
    summary (carried forward past `summariseRun`'s replacing write), so the second email says
    *"This replaces the email we sent before"* rather than arriving unexplained.
42. **A10 · sev 2 · ✓ FIXED (Job E3, same commit) · Audits.** `app/api/audits/index/route.ts:91`: "Where you stand" takes the
    newest **done** run, even when that agency's section in it failed, so it shows "· 0 to look at" and "found nothing
    open" and hides the last good run's findings. The amber "parts did not finish" line can never show
    (`app/audits/page.tsx:456`, `:663`, `:666`). Same in `components/AuditReport.tsx:1130`. **Fix:** per agency, the
    newest run whose section for that agency is done.
    **Closed:** the sections are read **before** the last-done-run choice is made, and the test is
    "did THIS run finish a section titled this agency?". A template run carries no `agency_label`
    and so still appears for nobody. **And the amber line's own bug was worse than "can never show"
    — it is WHY:** `failed` came from `activeSections`, which is `[]` whenever there is no active
    run, which is exactly when the line is drawn. The server now names the run that failed this
    agency (`last_failed`) and the page reads the failed sections off that run; the line's words are
    unchanged. `components/AuditReport.tsx` was checked and needed **no change**: its `failed` comes
    from the run's **own** sections, and its "Could not complete" section shows each reason with a
    "Run this section again" button.
43. **A14 · sev 3 · ✓ FIXED (Job E3, same commit) · Audits.** `lib/auditRun.ts:216–227`, `app/audits/page.tsx:571`, `:760`: a
    checklist that could not be read (rate limit) becomes a done run with 0 sections, shown "done · 0 to look at";
    the note saying why is not shown. **Fix:** show the note instead of a count.
    **Closed, in both places the page shows such a run:** the landed-checklist line and the run row
    in the list. A run with a note shows the note; a run without one still shows its counts, so the
    note is not a new empty state.
44. **D5 · sev 2 · ✓ FIXED (Job E3, migration 079, THE OWNER'S DECISION — `DECISIONS.md` §189b) · Documents.** `supabase/migrations/049_significant_date_at_read_time.
    sql:76`, `:92–94` (the latest `document_index_v` in the zip; 074–076 replaced it since — check): `needs_work`
    comes only from the reading's own status, never from gaps still open from earlier readings, so a re-read that
    says "no gaps" shows "Current", and the batch email lists it under "On file and nothing to do"
    (`lib/documentBatch.ts:112`, `:189`). **The owner decides** (§5).
    **The owner's answer, 10 October: yes.** Migration 079 adds one branch —
    `when coalesce(g.open_gaps, 0) > 0 then 'needs_work'` — **after** `expired`/`expiring` (an
    expiry is the more urgent fact and a date nobody can argue with) and **before** `current`,
    `recorded` and `on_file`, the three branches that were making the false statement. `gaps_found`
    is untouched, so no document that says "Needs work" today stops saying it: this can only add
    the label. `open_gap_count` has been on the view since 049 and already counted every open gap
    from any reading; only `display_status` ignored it.
    **It moved one real document on staging:** `10-osha-300a-2025.pdf`, kind `record`, one reading,
    **2 open gaps**, which showed `recorded` — and which the batch email listed under "On file and
    nothing to do". The reason is recorded as the owner's in `DECISIONS.md` §189b, with the one
    condition that would reverse it.

### R4 — an answer that did not finish or did not fit, saved as complete

45. **S1 · sev 2 · ✓ FIXED (Job E2, same commit) · Shared → Audits, Documents.** `lib/ai.ts:557–559`
    (`extractJsonText` starts at the first `{` **or** `[`): if a cited sentence before the JSON carries a marker like
    `[1]`, the "JSON" found is `[1]`, `JSON.parse` succeeds, and the agency audit finds no fields — the section is
    saved **done with zero findings** (`lib/auditRun.ts:449`, `:615`, `:547`). `stripMarkers` (`lib/howTo.ts:101`)
    exists for exactly this and only two callers use it. The document scan shares the path (HYPOTHESIS: its
    structured output may prevent prose first). **Fix:** strip markers inside `extractJsonText`; callers reject a
    result that is not a plain object with their keys.
    **Closed, in two halves.** `extractJsonText` no longer STARTS a value at a citation marker: an
    opener whose balanced slice is `[1]`, `[12]` or `[1, 2]` **and has prose in front of it** is
    skipped and the search goes on. The "prose in front of it" clause is the whole discriminator and
    a test found it — a reply that simply IS `[1,2]` is an answer, and
    `tests/unit/documentScan.test.ts` has asserted since Documents Run 2 that it survives fences
    and trailing words; the first version of this fix broke that test. **`stripMarkers` was NOT
    used**, deliberately: it deletes `[\d+]` from prose, and over a whole reply it would delete
    `"sources": [1]`, a legitimate field in this product's own JSON. The second half is the caller's
    (A7's entry). **Proof:** `tests/unit/answerShape.test.ts`, 22 tests — the cited reply, two
    markers run together, a comma-joined one, and five that the legitimate shapes are untouched.
    5 fail on the shipped files.
46. **A7 · sev 2 · ✓ FIXED (Job E2, same commit) · Audits.** `lib/auditRun.ts:449`, `:463`, `:615`, `:546`: only a parse failure fails
    a section; valid JSON of the wrong shape (wrapped object, renamed key, `[]`) becomes zero findings, a done
    section, and "found nothing that needs you". Checklist runs handle this honestly; agency runs do not. **Fix:**
    require the keys before shaping; otherwise fail and keep the raw text.
    **Closed:** `lib/answerShape.ts` `answerWith(parsed, fields)` — a plain object carrying **at
    least one** of the fields asked for. Not all of them: a real audit legitimately omits
    `contradictions` when it found none, and demanding every key would fail good answers; carrying
    NONE of several is a different document. The fields come from the shaper that will read them
    (`KINDS` for an agency section, `['lines']` for a checklist one), so the check and the shaping
    cannot drift. **It does not unwrap, rename or repair** — a guess at what the model meant is a
    quiet rewrite of a regulatory answer (`CRITIC-PASS.md`). The raw text is still kept on the row,
    and the reason now names what the answer DID carry, so `{"result": …}` is diagnosable from it.
47. **S2 · sev 2 · ✓ FIXED (Job E2, same commit) · Shared → Workspace, HR.** `lib/ai.ts:518` returns no stop reason;
    the stream's `done` carries `stopReason` but no caller acts on `max_tokens`, `refusal` or `pause_turn`:
    `app/api/chat/route.ts:496–508` saves the turn and counts "questions answered" (it passes `stopReason` to the
    screen; whether the screen shows it — not checked); `app/api/hr/answer/route.ts:197`; `lib/handbookCheck.ts:357`
    stores a piece cut off at 16,000 tokens as done, so later sections show no findings. **Fix:** anything other than
    `end_turn` is incomplete — marked as such, or failed.
    **E0's open question, answered: the screen did NOT show it.** `stopReason` appeared nowhere in
    the codebase outside the one line that sent it.
    **Closed:** `finishedCleanly(stopReason)` in `lib/answerShape.ts` — `end_turn` and
    `stop_sequence` are complete; everything else, and **no reason at all**, is not. Four callers
    act on it. The chat route and the HR answer route still SEND what arrived (it is the person's)
    and save nothing, count nothing; `lib/answerStream.ts` turns that into `stopped_early`, whose
    block on the page already says the answer is incomplete, that nothing was saved, and offers Try
    again — the same treatment a dropped connection already had. `lib/handbookCheck.ts` fails the
    piece instead of storing it done, so `checked_at`, the 90-day date and the "check is done" email
    cannot follow from a half-read handbook. The how-to route releases its claim.
48. **H1 · sev 2 · ✓ FIXED (Job E2, same commit) · HR.** `lib/handbookCheck.ts:294–299`: if the sections read fails, `secs` and `mine` are empty,
    `whole` is true, and the model is asked to check a handbook with no text; the answer passes `:357`, the check is
    stored done, `checked_at` set, the next check in 90 days, and the "check is done" email goes. **Fix:** throw;
    `if (!mine.length) fail(...)` before the call.
    **Closed:** the sections read goes through `tryRows` and a failure fails the piece; and
    `if (!mine.length) fail(...)` is there by name, before the model call, because a handbook whose
    sections were deleted between the queue and the claim reads back as zero rows with **no error**
    and gives the same empty prompt. `fail` was moved above the input assembly so both guards can
    use it. The arithmetic that made this invisible: `secs = []` gave `mine = []`, so `whole` was
    `0 === 0` — **true** — and the prompt told the model it held the entire handbook.
49. **HR-read · sev 2 · ✓ TRACED AND FIXED (Job E2, same commit) · HR.** `lib/handbookRead.ts:48`: a wrong-shape reply becomes `[]` sections; not
    traced beyond that. E0 traces it.
    **Traced, and it is real.** Zero anchors → `cutAtAnchors` returns no cuts → `sectionsFromCuts`
    falls back to `[{ start: 0, title: null }]`, **one untitled section holding the entire
    handbook** — and `proveCoverage` PASSES it, because one section covering the whole text is
    exactly what it looks for. So the handbook was stored `read`, the page said **1 section**, the
    long-handbook selection path had nothing to choose between, and the nightly check had one
    oversized piece. Nothing about the text was false, which is why it was not R3; "we read it into
    one section" is still a statement about a call whose answer we did not get.
    **Closed:** `modelOutline` throws on a reply with no `sections` field, and on a list whose every
    item was dropped — which lands in `readHandbook`'s catch as `could_not_read` with a reason and
    "Read it again", which HR already shows. **An empty list is still allowed**: `{"sections": []}`
    is the model saying a short part has no boundary in it, and a partial drop is logged rather than
    silent. The trace is RUN, not described, in `tests/unit/answerFinish.test.ts`.

### R5 — switched off before the replacement is ready

50. **H4 · sev 1–2 · ✓ FIXED (Job E1, "Job E: H4 — a handbook switched off before its replacement could be read") · HR.** `lib/handbookSave.ts:52–61`: a new handbook version is inserted current and the older
    one set not-current **at upload**, before the new one is read. If the read fails (a scan, a .doc, a rate limit),
    answers use current versions only (`lib/hrAnswer.ts:119`), so a company with one handbook is told "None of your
    handbooks could be read" (`lib/hrAnswerWords.ts:8`); the older version's open check is cancelled as replaced
    (`lib/handbookCheck.ts:290`, `:332–335`); the nightly job checks neither. **Fix:** switch `is_current` only when
    the new version reaches `read`. *(HR's own decision may say otherwise — E0 checks `HR-PLAN.md` and DECISIONS.)*
    **E0 checked HR's own decisions:** HR-PLAN decision 8 says *"only the newest is used for answers
    and checks"* and decision 18 that versions live on HR's own rows. **Neither says WHEN
    `is_current` flips**, so nothing in HR contradicts the fix.
    **Closed, and not by changing what `is_current` means.** The newer row still arrives current, so
    the page shows it and the reader claims it; what moved is the **switching off** — the older
    version is retired in `lib/handbookRead.ts`, on the one write that sets `status: 'read'`. Until
    then both are current, a state this product already supported and already rendered
    (`olderVersions` skips a current row, so the two list cleanly and neither appears twice). With
    both current: an unread new version makes the answer WAIT (§183, unchanged), and an unreadable
    one leaves the previous version in use and named as not used — so the company is no longer told
    *"None of your handbooks could be read"* about a handbook it holds and we can read. The older
    version's open check is no longer cancelled as replaced (`lib/handbookCheck.ts:290` tests
    `is_current`, which is now still true), and the nightly job keeps checking it (`:550`).
    `setHandbookSite`'s "current version only" guard was retightened to **newest in the chain**,
    because with two current versions `is_current` would have let a person set the site from the
    older one — the split that guard exists to prevent. One new line of UI copy (`inUseNote`) says
    which version answers a question while the other is read.
    **Proof:** `tests/unit/handbookSave.test.ts` — no row may be marked not-current on the strength
    of a file nobody has read — and five H4 tests in `tests/unit/handbookRead.test.ts`: retired after
    the read and never before; nothing retired on a failed reading, a lost claim, or a first
    handbook; and a refused retirement does not fail the reading. **Four fail on the shipped files.**
51. **A1 · sev 1 · ✓ FIXED with O1 (Job E1, "Job E: A1 and O1 — Audit again, and the four ways it closed a finding nobody spoke about") · Audits.** `lib/auditRun.ts:944–973` (`matchAgainstPrevious`):
    any earlier open finding no new row claims is **closed** ("not raised by the newer audit"). Four non-answers cause
    that: the read of the new rows is unchecked (`:944`); rows are matched by position while `shapeFindings` drops
    some items, so later `same_as` answers land on the wrong row; a checklist run has none of the matcher's arrays, so
    a checklist re-run closes everything; closing happens before `collapseAgainstEarlier`, so a section that then
    fails has already closed findings. **Fix:** check the error; match by title as `collapseAgainstEarlier` does; skip
    for checklist runs and answers with no `findings` array; close only when the section has otherwise finished.
    **Fix together with O1** — fixing O1 alone switches A1 on.
    **Closed, all four faults, with O1 in the same commit.** (1) the fresh read goes through
    `mustRows`, so a failed read throws instead of closing everything; (2) rows are matched by
    **(kind, title)**, as `collapseAgainstEarlier` already did, so one dropped item no longer shifts
    every later `same_as` onto the wrong row; (3) the caller skips a **template** run, and the
    matcher closes nothing when the answer carried none of the four lists — while `findings: []`
    still counts as an answer and still closes; (4) the closing moved into
    `closeUnmatchedPrevious`, called **after** the collapse and after the section is marked done, and
    its own failure is reported rather than failing a section that finished.
    **Proof:** `tests/unit/auditMatcher.test.ts`, 19 tests. `oldMatcher` is the shipped function
    copied line for line, and each fault's group shows it closing a customer's open findings —
    all three of them on a failed read, p2 on a mis-positioned match, all three on a checklist
    re-run. **14 of the 19 fail on the shipped files.**
52. **W2 · sev 1 · ✓ FIXED (Job E1, "Job E: W2 — a summary now says how far it read") · Workspace and HR.** `lib/summaryReport.ts:461` stamps `summarised_at` = the time of writing,
    but the turns were read minutes earlier (`app/api/topics/[id]/summarise/route.ts:76`) and the chat route does not
    look at the running summary. A message sent while "Summarise" runs counts as covered: the nightly job never
    re-summarises (`lib/topicClaim.ts:156`) and, 12 months on, the deleter's test passes (`lib/retention.ts:67`) and
    **deletes turns no summary contains**. HR conversations too. **Fix:** stamp "covers through" = the newest turn
    actually read; add `last_turn_at` to `guardSummaryWrite`.
    **Closed by migration 078**, `topics.summary_covers_through` — the newest turn the summary
    actually read, computed by the run from the turns in its own hand, so there is no window in it.
    `newestTurnAt` is called **before any model call** and throws if the turns carry no `created_at`,
    because a summary with no coverage is never cleared and re-summarised every night for ever; the
    nightly job's own turn read gained `created_at`. Both readers now test coverage, not
    `summarised_at`: `lib/retention.ts` (`skip_not_covered`, a new reason) and `lib/topicClaim.ts`'s
    "spoken since". **NULL means not known and is never treated as covering** — which is what the
    backfill leaves on every row it could not vouch for. `app/api/jobs/delete/route.ts` was also
    changed to delete **only** on `'clear'`: it tested for the two skip reasons and deleted on
    anything else, so W2's new reason would have fallen straight through to the delete.
    **`last_turn_at` was NOT added to `guardSummaryWrite`**, deliberately: with the coverage stamped,
    a summary that landed after a new turn is recorded honestly and re-summarised tonight, whereas
    refusing the write would throw away a paid answer that is correct for the turns it read.
    **Proof:** `tests/unit/retention.test.ts` and `tests/unit/topicClaim.test.ts` each carry the
    shipped rule copied line for line beside the new one — *"the OLD rule cleared it, because the
    summary was written after the turn"* — plus `newestTurnAt`'s tests in
    `tests/unit/summaryDates.test.ts`. **Seven tests fail on the shipped files.** The end-to-end
    staging run is in the gate's nightly-jobs part.
    **LEFT, named:** the drawers print "Summarised 5 January" over a summary that may stop short of
    the newest message, and say nothing about it. That needs `summary_covers_through` on
    `topic_list_v` (a view migration) and a line in both drawers. It is severity 3, it is a screen,
    and it goes in **E4** with the other screens.
53. **O3 · sev 2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Audits.** `lib/auditRun.ts:497`, `:546`: findings are inserted before matching and collapse;
    a later throw marks the section failed but its rows stay and show, and Retry inserts a second set. The final
    `done` update is unchecked too: a failure leaves the section "running", recovered after 15 minutes, re-run,
    duplicated. **Fix:** write findings and status together, or delete the section's rows on failure/retry.
54. **HR-dup · sev 2 · ✓ FIXED (Job E5, "Job E: HR-dup, E6's wordings, and the job's close") · HR.** `lib/handbookRead.ts:196`: the error on deleting the old sections is ignored before
    the insert, so a handbook can end up with two sets of sections. **Fix:** check it.
    **Closed:** the delete is checked and a refusal **fails the reading**, which leaves the handbook
    exactly as it was with its earlier sections intact and "Read it again" on the page. Two sets of
    sections is not a tidiness problem: `lib/hrAnswer.ts` builds a block per section, so the model
    would be handed the whole handbook **twice** — the same clause under two handles, the budget
    spent twice over, and the page saying a 14-part handbook has 28 parts. The undo on the other
    path (a claim lost after the insert) now says so too, rather than leaving the same state by the
    other door. **Proof:** `tests/unit/handbookRead.test.ts`, which fails on the shipped file.

### R6 — a renamed label the rest of the code cannot see

55. **D2 · sev 1 · ✓ FIXED (Job E1, "Job E: D2 and L1 — a renamed label deleted by the next tidy-up") · Documents → Audits.** `app/api/company-labels/route.ts:126–135`: a rename writes the new name
    into `document_corrections` and `company_labels` only, never into a scan. `pruneOrphanLabels`
    (`lib/companyLabels.ts:57`) reads raw scans, so the next delete of **any** document deletes the renamed label —
    the old name is already gone — and the company loses that agency from "audit everything". **Fix:** decide "in
    use" from `document_index_v`, which applies corrections (one fix with L1).
    **Closed:** `pruneOrphanLabels` now reads `document_index_v.agencies, subjects` — one read that
    carries BOTH rules, because the view takes a document's identity from the readable reading
    (migration 076, L1) and then applies the person's corrections on top (D2). It no longer touches
    `document_scans` at all. **Proof:** `scripts/fixlist-d2-rename.mjs`, free, on staging, run twice.
    On the shipped code: *"removed 1 — agency:Oregon Department of Environmental Quality"* and
    `"audit everything" would audit: (nothing)` — immediately after the person told us what to call
    it. On the fix: removed 0, the renamed agency still audited, **and the two labels no document
    carries are still pruned**, which a fix that pruned nothing would have passed everything else.

---

## 4. Found on the way — not this class, but serious

- **O1 · ✓ FIXED with A1 (Job E1, same commit) · Audits.** "Audit again" never links runs: the agency branch of `app/api/audit-runs/route.ts:131–133`
  drops `previous_run_id` (the template branch at `:84` keeps it; `components/AuditReport.tsx:550` sends it). So
  "carried" and "closed" never happen in the app. **Fix with A1, never before it.**
  **Closed:** both branches now take one validated `previousRunId`, read through the caller's own
  client so another company's run is simply not there (404, not 403 — §3.6). The template branch
  used to pass the client's id straight through unchecked; that is closed too. **Fixed in the same
  commit as A1 and not a minute before**, because this one field is what kept A1's four faults from
  ever running in the app.
- **O2 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Audits.** "Audit again" on a checklist report posts `kind: 'agency'` (`components/AuditReport.tsx:549`):
  a multi-section checklist re-runs as an all-agencies audit; a one-section one gets a 400.
- **O4 · ➜ MOVED TO MY ACCOUNT'S SECTION (the owner's §5 answer 4, 10 October) · NOT FIXED HERE · My Account (ours).** The export leaves out whole tables while the page says "Download everything we hold
  on your company": conversations (topics, turns), fact proposals, company facts, company switches, the document
  readings (scans, gaps, conditions, deadlines, corrections), audit runs and findings, company labels. It still
  exports old tables (`audits`, `hr_audits`, `document_reviews`). The deletion that follows destroys all of them.
  **The owner decides** what the export holds (§5).
- **O5 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Signup (ours).** `app/api/signup/route.ts:29–60` creates the login first; if the company or profile
  insert fails there is no rollback — a login with no company, and a retry says "already registered".
- **O6 · ✓ PROVED AND FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** `app/api/document-scan/route.ts:84` sets `reading` with `reading_since` null and
  the route has no `maxDuration`; if the platform kills it, the stuck-row recovery
  (`app/api/jobs/scan-documents/route.ts:147–148`, `.lt('reading_since', …)`) never matches a null — the row says
  "Reading…" for ever and its batch never finishes.
- **O7 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Documents.** `app/api/jobs/scan-documents/route.ts:182–188`: a claim update that errors `continue`s and
  re-selects the same company at once — a tight loop on the database until the time budget ends.
- **O8 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · HR.** `app/api/hr/answer/route.ts:125–146`: the wait loop's reads are unchecked; a failed read means
  "reload" with no sleep — a tight loop until the 800-second limit.
- **O9 · ✓ FIXED (Job E4 and E5, "Job E: the rest of R2, printing, and section 4's items") · Workspace and HR.** `app/api/chat/route.ts:341–344`, `app/api/hr/answer/route.ts:88`: if loading the
  history fails, the answer runs with no earlier turns but is saved into the conversation as if it continued it.

---

## 4a. ⚡ MY ACCOUNT'S SECTION — SIX ITEMS, MOVED, NOT FIXED

**The owner's §5 answer 4, 10 October 2026:** *"the export holds everything the deletion destroys —
and every My Account item moves to My Account's own section, the next one after Calendar: M1, M2,
M3, M4, O4, O5 (the export, account deletion, the name field, the industry list, signup), so that
page is worked once."*

**Job E did not fix five of them.** They are listed here together so the next chat has one place to
start from, with what Job E learned that bears on them.

| item | sev | what it is | what Job E's work bears on it |
|---|---|---|---|
| **M1** | 1 | `app/api/account/export/route.ts`: a failed table read becomes `[]` and its count 0, under a screen that says "Take your records first" — before a permanent deletion | `lib/mustRead.ts` is the tool: `mustRows` on every read, and **fail the whole export if any read fails**. A partial export under that sentence is the worst shape on the list |
| **M2** | 1 | `app/api/account/route.ts`: the profiles read unchecked (no login deleted, the company row gone), a failed storage list read as "no files", `deleteUser` errors ignored — and the answer says `success: true` | the same tool, plus the storage list needs **paging** (more than 1000 in a folder are missed). `success: true` over a partial deletion is M2's whole point |
| **M3** | 1 (small) | a failed load shows a blank name, and Save then writes `full_name: ''` over the stored one | `mustRow`; GET answers 500; the page shows it and disables Save |
| **M4** | 2 | a failed industry list leaves only "Don't see your industry?", so a company signs up as `other` — which drives requirements and every prompt | `res.ok`, an error with a retry. It has failed once already (11 Sep) |
| **O4** | — | the export leaves out whole tables while the page says "Download everything we hold on your company" | **the owner has decided it**: everything the deletion destroys. `app/api/account` DELETE's own table list is the inventory, and `npm run check:schema` already enforces that list against every `company_id` table |
| **O5** | — | signup created the login first with no rollback | **FIXED in Job E5** — it was one route, away from the My Account page, and leaving a person with a dead account was not worth carrying. The undo is in `app/api/signup/route.ts` |

**And one thing Job E found that belongs to that chat.** `app/api/account/route.ts` DELETE is the
only place that names every table carrying a `company_id`, and `scripts/check-schema-contracts.js`
enforces it. **Migrations 078 and 079 added no table**, so that list is still complete — but a chat
working My Account should run `npm run check:schema` first and read what it says, because that check
is the only thing standing between a new table and a deletion that misses it.

---

## 5. What the owner decides before Job E

> **ANSWERED — the owner, 10 October 2026: "yes to all".** (1) Keep A3d/A3e's approach: readers take the latest
> readable reading; Job E fixes the remaining writes and screens. (2) D5: a document with a gap still open from an
> earlier reading shows "Needs work". (3) The R3 prompt words (A-prompt, D4) are drafted by Claude Code and shown to
> the owner before they go in. (4) The export holds everything the deletion destroys — **and every My Account item
> moves to My Account's own section, the next one after Calendar**: M1, M2, M3, M4, O4, O5 (the export, account
> deletion, the name field, the industry list, signup), so that page is worked once. (5) Job E runs before Job D.

1. **R1's approach.** Keep A3d/A3e's: readers take the latest *readable* reading, and Job E fixes the remaining
   *writes* (D1, L1) and screens (D6, D13). The alternative — a failed reading never becomes current at all — means
   reworking every view since 044 for no gain over what 075/076 already do. **The chat recommends keeping A3e's.**
2. **D5.** Should a document with gaps still open from an earlier reading show "Needs work" even when the latest
   reading found none? **The chat recommends yes**: the gap is still open, so the person still has work. It is
   Documents' rule, so it is recorded in DECISIONS with the reason.
3. **The words in R3** (A-prompt, D4) are prompt changes, so they are quality changes (§3.1): shown to the owner
   before they go in. Golden sets are not re-run (they are paid); the report says what they would move.
4. **O4, the export.** **The chat recommends: everything the deletion destroys.** Otherwise "Take your records
   first" is untrue.
5. **When.** Job E runs after Job C. **Before Job D** means one release and one finish-line run covering every
   section; after Job D means Calendar ships sooner and Job E gets its own release. **The chat recommends before Job
   D**, because Job E touches every section and the finish-line run has to cover them anyway.

---

## 6. How Job E runs

**E0 — confirm and impact check (no code).** For every item: confirm the line on the live tree, mark items already
fixed by A3d/A3e, and run the same R2 sweep over Job A's new code (not in the zip). One table: item · file:line now ·
section · still true? · the fix. The impact check for each section touched. **STOP** for the owner's answers to §5.

**E1 — the helper and severity 1.** One helper for R2 (throws on `error`, one file, its own tests), then: D3, M2, M1,
M3, W1, D1, L1+D2, A2, H4, W2, then A1+O1 together. Each fix ships with a **free proof that makes the failure happen**
— a fake database that returns an error, or a replay like A3b's — printing the line before and after.

**E2 — R4, answers.** `extractJsonText` and the shape checks (S1, A7), stop reasons (S2), H1, W5, HR-read.

**E3 — R3, words.** A9, A10, A14; A-prompt and D4 after the owner's yes; D5 by the owner's answer.

**E4 — the rest of R2, section by section,** each screen saying "Couldn't load" instead of its empty state.

**E5 — §4's items** the owner keeps in.

**Every checkpoint:** `npm run check` with the floor raised; the cross-section gate (`CALENDAR-PLAN.md` §2.5, all
eight parts) with one table per section; every section's free checks re-run and named; `npm run cost` before and
after — the proofs are free, so Job E should cost almost nothing; $3 cap. Each item in this file is marked FIXED with
its commit, or LEFT with the reason. Job D then runs the finish-line parts (A–J) for **every** section Job E touched,
not only Calendar's.
