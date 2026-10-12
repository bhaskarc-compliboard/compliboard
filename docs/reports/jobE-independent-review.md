# Job E — the independent read

**Written by the Calendar chat, 12 October 2026. v2: §7 adds the owner's decisions ("lets do it",
12 Oct 2026, 12:15).** Input for E10. Nothing here is code.

## How this was done

E9 was Claude Code checking its own work. This is a second read by readers who did not write the
code and were not shown E9's conclusions. Three readers each took one part of
`docs/reports/jobE-code.diff` (5,862 lines, 61 files): Audits and company information; Documents,
the nightly jobs and the shared libraries; HR, Workspace and Requirements. The chat then checked the
worst findings line by line against the code itself.

Each finding is marked one of three ways:

- **MEASURED**: E9 ran it on staging and saw it happen.
- **READ**: confirmed by reading the code. The chain from cause to wrong result is complete.
- **TO PROVE**: a reader found it, the chat did not trace every step, and E10 must show it with a
  test that fails before anything is changed.

## The verdict in one paragraph

Job E did what it set out to do. The 43 fixes stop the lies they were aimed at, and a brand-new
company works. But it opened one new class of fault, named here as **R7: a loud failure with no way
back.** Job E turned silent failures into thrown errors, which is right. In about fifteen places the
throw lands somewhere that never recovers: a claim nobody releases, a run left saying "running", a
page left empty, a sweep that stops for every company. Before Job E, a database hiccup in those
places told a small lie. Now it leaves something stuck for good. Separately, there is one bug on the
normal path that would cost money every night from the first day after release (N1). E9 did not find
it, because nobody asked it to look there.

---

## 1. BREAKS THE NORMAL PATH: fix before release

### N1. Every summary written after release is redone every night, for ever. READ, found by two readers independently

- **Where:** `lib/summaryReport.ts` (`newestTurnAt`, the `summary_covers_through` write), read by
  `lib/topicClaim.ts` (`nightlyCandidates`, about line 166) and `lib/retention.ts`
  (`clearingDecision`).
- **Mechanism:**
  - `summary_covers_through` is the newest turn's `created_at`, stamped by Postgres at insert.
  - `last_turn_at` is written afterwards by `touchTopic` (`lib/conversation.ts:56`, unchanged), using
    the app server's clock once the insert has returned.
  - So `last_turn_at` is always a few milliseconds later. The test `last > covers` is always true,
    and every summarised conversation reads as "spoken to since".
- **Result, every night, for every conversation summarised after release and quiet for 6 hours:**
  - a paid summary call;
  - a person's own summary is overwritten, because the rule that protects it never applies;
  - the title is rewritten, and facts already confirmed or rejected may be proposed again;
  - the 12-month clean-up answers `skip_not_covered` for ever, so transcripts are never cleared.
- **Why nothing caught it:** rows the 078 backfill touched are fine (it set the two values equal).
  The tests used hand-written timestamps that were equal too.
- **Fix direction:** one clock. Either write `last_turn_at` from the inserted turn's own
  `created_at`, or have both readers ask "is there a turn newer than the coverage?" against `turns`.
  Then repair any staging rows written since Job E.
- **Proof first:** one staging SELECT comparing `last_turn_at` with the newest turn's `created_at`
  for topics summarised since Job E. Then a test built from those real values, shown failing.

### N2. "Audit again" closes findings the new audit raised again. MEASURED (E9 3a, 3b) and READ

There are three causes, and only the first is new in Job E:

1. **Matching uses the list's kind, but the saved row can have another kind.** `shapeFindings`
   saves a `nothing_on_file` finding with a future due date as a **date**, and a contradiction
   missing its second document as a **finding**. `matchAgainstPrevious` looks the row up by the
   list's kind, so the lookup misses and the previous finding is closed.
2. **The model is shown every open row as F1, F2…** That includes dates, expected documents and
   contradictions, and the rows do not say which kind they are. But only `findings` items have a
   `same_as` field (`prompts/audit-agency.ts`). So a previous date, expected document or
   contradiction can be claimed only by a new *finding* (E9 3a, wrong kind) or not at all (E9 3b,
   closed and re-created).
3. **Nothing checks that the pair has the same kind.**

- **What the customer gets:** "closed: not raised by the newer audit" on things the newer audit
  raised. That cannot be undone, and the email repeats the number.
- **This needs the owner's decision (D1 below)** before E10 touches it, because the fix that
  covers cause 2 changes the prompt.

### N3. "No longer raised" counts include the run's own duplicate merges. TO PROVE

`collapseAgainstEarlier` marks an in-run duplicate with `closed_by_run_id = this run`. The run's
closed count (`summariseRun`) and the index's `closedByRun` (`app/api/audits/index/route.ts`) do not
exclude those rows. O1 now links every agency re-audit, so this number now prints in the email, the
drawer and Past audits.

### N4. A finished checklist audit shows no counts when the run carries a note. READ

`app/audits/page.tsx` (about lines 587 and 780) treats "the run has a note" as "the run could not be
done". But `createRun` also notes runs that **finished**: "This checklist names X; treated as a
template for you." That is the normal case of auditing yourself against an auditor's form. Past
audits then shows the note and no "to look at" count. The test should be "no sections", not "has a
note".

### N5. While a new handbook version is being read, HR answers use both versions. MEASURED (E9 4) and READ

Under H4, the old version is retired only when the new one reaches `read`. `lib/hrAnswer.ts:136`
uses every current row whose text is saved and whose status is `read` **or `reading`**, and the text
is saved before the outline calls. For a few minutes per upload, the model gets the same handbook
twice under one name and may quote the superseded one. One version per chain must be used, and the
newest readable one wins.

### N6. The version chain can fork and leave two versions current for good. TO PROVE (the retire step is READ)

`lib/handbookRead.ts` (about line 279) retires only the immediate parent (`row.version_of`). The
"Add a newer version" button shows on any current row. There are three ways in:

- **A.** v2 cannot be read, so v1 and v2 are both current (H4 working). The person adds v3 from
  v2's drawer, the natural move. v3 retires v2, and **v1 stays current for ever**. Both are then used
  in answers and both are checked nightly, with nothing on the page explaining it.
- **B.** They add v3 from v1's drawer. v2 stays current, and answers say "<Name> could not be read"
  while quoting "<Name>".
- **C.** Deleting v1 during the read brings v0 back as current.

**Fix direction:** a successful read retires every older version in its chain, not only the parent.
The add button offers itself only on the newest row.

### N7. Requirements: a legitimate empty result is a permanent 500. MEASURED (E9 5) and READ

- `industry: 'other'` (a real choice) makes `/api/obligations` answer 500 every time, and 200
  obligations stay open.
- In `app/api/switches/answer/route.ts`, the answer is saved **before** `writeObligations` can throw,
  but the person is told "Nothing has been changed". That sentence is false: their answer was
  recorded.
- **The owner's decision (D2 below).**

### N8. The copyright line has gone from every page on screen. READ

`components/AppLayout.tsx`: the on-screen `© 2026 CompliBoard LLC` was deleted and a `print-only`
copy added. The comment says "drawn twice rather than moved". In fact it was moved. This affects
every section.

---

## 2. R7: ONE HICCUP, STUCK FOR GOOD

The same pattern repeats in every section. Job E made a read throw, and the throw lands where
nothing recovers. **The fix is one rule applied everywhere,** and E10 should write it into
`CLAUDE.md` as R7:

> Every claim is released, or recoverable by the sweep's own recovery rule. Every sweep catches per
> company and per item, so one failure never stops the others. A throw that reaches a page shows the
> page's failure line, never its empty state. Every state a throw can leave behind has a rule that
> moves it on. A test per sweep injects a failure and shows the next run recovering.

### Documents

- **S1. A storage error that is not a 404 makes the sweep loop and starves every company.** READ.
  This corrects E9 9a.
  - `scan-documents/route.ts` (about lines 258–262) sets the row back to `uploaded` and calls
    `continue` inside the `try`. The `finally` then clears the claim.
  - RULE 1 picks the globally oldest document, which is this one, at once.
  - The run spins on it until the 510-second budget ends, every five minutes. No other company's
    documents are read while it lasts.
  - Needs an attempt limit. After the limit the document says it could not be fetched, the batch
    finishes, and the email goes.
- **S2. Recovery can no longer free documents that were claimed but never started.** READ.
  - The recovery SELECT finds `uploaded` and `reading` rows with an old claim. The UPDATE now
    requires `.eq('status', 'reading')`.
  - The sweep's claim leaves rows at `uploaded`, so they are found and never freed. The old code's
    guard (`lt('reading_since', stuckBefore)`) freed them.
  - Any run killed mid-company leaves those documents "Queued" for ever.
- **S3. A throw after the claim ends the run for every company and leaves that company's queue
  claimed** (`mustRow('the company')`, about line 230; the recovery throw, about line 174). TO PROVE.
  It is permanent while S2 stands.
- **S4. A batch whose summary read fails never finishes and never emails.** TO PROVE.
  `finishBatchIfDone` is only called for batches in the queue just processed. The comment "the next
  pass summarises it properly" is false.
- **S5. `/api/document-scan` promises a retry that never happens** ("We will try it again on our
  next pass"). It answers 200 with `status: 'uploaded'`, and the Workspace's `readFile` treats that
  as read and asks the question anyway. TO PROVE.
- **S6. A company-context read failure** (`lib/companyContext.ts` now throws) lands in the scan
  routes' catch. The result is "Something went wrong at our end" saved as the reading, with no
  automatic retry. TO PROVE.
- **S7. Throws inside the scan save, after the new reading is inserted and before its gaps are
  written, can leave a good reading with zero gaps** (`lib/documentScan.ts` about lines 889, 892 and
  916). TO PROVE. It depends on `lib/readableScan.ts`, which the readers could not see.

### Audits

- **S8. A failed read inside `finishRunIfDone` leaves the run "running" for ever.** No email goes,
  and the agency shows "Audit running" with no button. The comment says "the recovery re-runs it",
  but recovery only re-queues sections still marked `running`. TO PROVE.
- **S9. The audit sweep can orphan claimed sections** (a throw after the claim and before the
  `try/finally`). The recovery looks only at `running`, the same shape as S2. One bad read also
  stops the sweep for every company. TO PROVE.
- **S10. O3 is half fixed.** The manual retry deletes the failed attempt's rows, but the automatic
  15-minute recovery re-runs a killed section and inserts a second set. TO PROVE.

### HR and Workspace

- **S11. In the handbook sweep, one failed read ends the run for every company after it.** The reads
  are `recoverStuck`, the per-check query, the claim and `finishCheckIfDone`, and they sit in a
  `try/finally` with no catch. TO PROVE.
- **S12. The H1 guard's `fail()` runs before the rows are set to `checking`,** so `failRows` matches
  nothing. A persistent failure retries for ever and the check never finishes. TO PROVE.
- **S13. HR's refusal when earlier messages cannot be loaded (O9) comes after the question is
  saved.** The transcript keeps an unanswered question, and asking again puts it in twice. The
  Workspace route does this correctly. TO PROVE.
- **S14. A failed conversation-list read blanks the HR page.** It sits in a `Promise.all` with no
  catch, so handbooks, sites and the company id never load, the tab says "No handbooks yet", and
  uploads are refused. TO PROVE.
- **S15. Throws on the pages become unhandled rejections.** The pages then show their empty states:
  "No conversations yet", "Not checked yet", and "This handbook has not been read yet" about one that
  has been read. Workspace delete also gets stuck busy. TO PROVE.

---

## 3. LONG ANSWERS (S2 in the fix list): NEEDS NUMBERS FIRST

The new rule treats `max_tokens` and `pause_turn` as unfinished, which is right. But nothing gives
the answer more room.

- **Handbook check:** a piece that genuinely needs more than 16,000 tokens fails twice (two paid
  calls). `queueDueChecks` then re-queues it every night, for ever.
- **Chat and HR:** "Try again" stops at the same ceiling.
- `answerStream.ts:129` drops `topicId` on an incomplete answer, so an incomplete *first* answer
  leaves an orphan conversation.

`stop_reason` is recorded nowhere (E9 item 2). **Before deciding:**

- Add `stop_reason` to `ai_calls` (an additive column).
- Count, on production with SELECT only, the calls with `output_tokens >= 15900` by task over the
  last 30 days.

The owner decides on the numbers.

---

## 4. WRONG WORDS AND SMALLER ITEMS

- **Wrong advice after "We could not fetch the stored file".** The "Could not read" drawer says
  "nothing about your file needs changing, press Read it again", but the way forward is to upload it
  again (`components/DocumentReport.tsx` about lines 537 and 557). READ by the reader.
- **A false line in retry emails.** The retry email can open "This replaces the email we sent
  before" when no email was sent (`lib/auditNotify.ts` about line 234).
- **Two time zones in the audit drawer.** "Readings as of" uses the company's zone; "Company
  information as of" and "Audited" use the browser's.
- **A9 is incomplete for runs with a note.** The note check comes first, so a checklist run whose
  every part failed still gets "Your audit is done".
- **The `inUseNote` label.** It ignores the row's own status: a version that could not be read is
  labelled "in use…". A forked chain lists v0 twice.
- **079 and the audit input.** A document now shows to the audit model as `needs_work` beside
  "WHAT THE READING FOUND WRONG WITH IT: nothing", because the open gap from the earlier reading is
  not passed in. **This touches what the audit reads, so it is the owner's call** (§3.1).
- **Reads still unchecked in places marked fixed:**
  - the zip route's documents and titles reads (A12's sentence);
  - the retry route's run and section reads (A15);
  - the new O1 code's "That earlier audit was not found" on a database error;
  - `summariseRun`'s closed count;
  - the index's `closedByRun`;
  - the to-confirm facts reads.
- **E9's X1:** the eight unchecked reads that fall through to a write. These five go in E10:
  - `lib/handbookSave.ts:104` and `:111`;
  - `lib/conversation.ts:92`;
  - `lib/calendarDates.ts:296`;
  - `app/compliance/page.tsx:759`.

  The three in `app/api/account/route.ts` stay with My Account. The other 86 are not fixed one by
  one. A guard test counts them and may only go down, the same way the test floor may only go up.
- **E9's X2:** GET `/api/jobs/calendar-month` ignores `?dry=1`. It must honour it or refuse it.
- **E9's X3:** `/api/signup` must check `industry` against the library's slugs.
- **Checklist re-runs pay for a fresh extraction.** "Audit again" on a checklist re-reads the
  checklist with a paid call, although migration 059 says re-runs reuse the stored lines
  (`components/AuditReport.tsx` about line 583).
- **A10's sections read is cut off at 1,000 rows.** It is ordered only by ordinal, so the last
  agency drops out at about 90 runs. TO PROVE.
- **The how-to route.** It queries `.eq('id', checklist_id ?? '')`, which is a uuid error for a
  legacy item with no checklist, so that item can never be researched.
- **E9's 9b caveat:** a batch email whose send fails is never retried.
- **E6 wording 3** (the HR answer's handbook-version line) must also tell apart two *different*
  handbooks that share a name. E9 found two on staging. The chat will redraft it for the owner.

---

## 5. FOR JOB D

1. **Migrations before the push.** Code without 078's column breaks every summary write and both
   nightly jobs on their first query. A push to main deploys at once, so the owner applies 073–079
   (and any E10 migration) to production **first**, then the push.
2. **`golden:audit`'s input moved for 3 of 5 cases** (079, E9 item 7). It must be re-run and
   re-baselined on Opus at the finish line.
3. **Clear E9's staging leftovers:** three companies and two audit runs (ids in `jobE-verify.md`).

## 6. THE OWNER'S DECISIONS THIS NEEDS

- **D1, "Audit again".**
  - Recommended:
    - The code stops closing findings on its own. A previous finding the new audit did not match is
      marked "not seen in the newer audit", and the person closes it.
    - Matching becomes same kind first. The same title and the same saved kind count as a match
      without asking the model. `same_as` is honoured only when the kinds agree. The saved kind
      is used, not the list's.
  - The prompt change that gives dates, expected documents and contradictions their own `same_as`
    waits for a paid golden run.
- **D2, Requirements.**
  - Recommended: an empty result while rows are open keeps the list on the page, with a plain note
    and a person's button, "These no longer apply", instead of a 500.
  - The switch-answer route says the answer was saved and the list was not recomputed, instead of
    "Nothing has been changed".
- **D3, long answers.** Decided on the numbers in §3.

---

## 7. DECIDED: the owner, 12 October 2026, "lets do it" (yes to all three as below)

Customer wording below is the draft. E10 shows the final words, with screenshots, in its report.
Every customer line follows the standing rules: short and plain, never says "AI", says whose
problem a failure is, and never says "done", "not done" or "overdue" about a date.

### D1, "Audit again": the system never closes a finding because the newer audit went quiet

1. **Match on plain facts first.** The same *saved* kind and the same title (ignoring case,
   punctuation and spacing) is the same item, without asking the model. The model's `same_as` counts
   only when it points at a row of the same saved kind. A wrong-kind link is ignored and counted in
   the run's record. Matching uses the kind the row was **saved** as, never the list it came from.
2. **Only evidence closes.** When the newer audit raises the same item and now says it is on file,
   citing a document, the old one closes with the reason **"Now on file: <document title>"**.
3. **Silence never closes.** An old item the newer audit did not match stays open and moves to a
   group on the report:
   - **Heading:** "Not raised in this audit".
   - **Line:** "If it's taken care of, close it."
   - **Button:** "Close it".
   - **Afterwards:** "Closed by <name> on <date>", with **Reopen**.
4. **The counts.** Duplicates merged inside one run never count as closed (N3). The email, drawer
   and Past audits say, for example: "4 still open from last time · 1 now on file · 2 not raised this
   time — please check".
5. **The prompt is unchanged.** The later prompt change (show each old item's kind, and give dates,
   expected documents and contradictions their own `same_as`) waits for Audits' next round and a
   paid golden run.
6. **Production, SELECT only:** count findings already closed with "not raised by the newer audit".
   If there are any, E10 writes the plan to reopen them into the new group. A production data change
   is the owner's to run, at Job D.

### D2, Requirements: never a dead end, and a big drop needs the person's yes

1. **The page always loads.** When a recompute would close **all of the open list, or more than
   half of it**, nothing closes on its own. The current list stays, and a note sits on top.
   - **When the industry changed:** "Your industry is now <Industry>. We don't have a list of
     requirements for that industry yet, so the <N> requirements from <Old industry> would drop off.
     Have they stopped applying to you?"
   - **Otherwise:** "Your latest answers would remove <N> of your <M> requirements. Have they stopped
     applying to you?"
   - **And if no answer changed:** "If you didn't change anything, this is likely a problem on our
     side — please tell us."
   - **Buttons:** "Yes, they no longer apply" (closes them, recorded as closed by that person on that
     date) and "No, change my industry back" (to Company information), or "Keep them" when the
     industry did not change.
2. **The threshold is internal.** No percentage is ever shown. A normal answer that drops a handful
   never triggers it.
3. **The question page:** "Your answer is saved. It would change your requirements a lot, so we've
   held that for you to confirm on the Requirements page." The false "Nothing has been changed"
   goes.
4. **An industry the library does not cover:** "We don't have requirements for this industry yet.
   That's a gap on our side — it doesn't mean none apply to you." This replaces "we found none that
   apply to you. That is a result, not a gap" for that case only.

### D3, long answers: handle the two stops properly, and record why every call stopped

1. **`pause_turn` is not a failure.** Send the assistant content back and continue, up to 3 times
   (Anthropic's documented handling).
2. **The `max_tokens` ceiling goes from 16,000 to 32,000** for Workspace chat answers and HR
   answers. Other tasks are unchanged unless the numbers in (5) say otherwise. The honest
   "incomplete, nothing saved" message stays for the rare answer that still hits it. An incomplete
   *first* answer keeps its conversation, with the question marked stopped.
3. **The handbook check never retries the same way.** A piece that hits the ceiling is split in two
   at a section break and each half is checked. A part that still cannot be checked says **"We
   couldn't check this part. That's on our side. Press Check again to try once more."** and is not
   re-queued nightly. It waits for a new version of the handbook or a person's press.
4. **`stop_reason` is recorded on every `ai_calls` row** (a new column, staging migration).
5. **Production, SELECT only:** the calls in the last 90 days with `output_tokens >= 15900`, by
   task. Plus the proof, from stored answers and no paid run, that no golden case comes near the
   ceiling.

## 8. NEXT AFTER E10 (not in E10: fixing and new features stay apart)

**The owner's job view.** Every nightly job writes a heartbeat on every run, including the runs with
nothing to do. An owner-only page shows each job's last run and any red flags. A morning email says
"all ran, nothing stuck" or names what is wrong.
