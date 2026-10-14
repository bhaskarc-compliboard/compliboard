# E10 — the independent read

**Written by the Calendar chat, 12 October 2026. v4: a provenance note; M1 confirmed by the owner on
localhost.** Input for E11. Nothing here is code.

> **READ THIS FIRST: the readers did not have the live code.** The repo is not connected to the chat
> (by design: keys). Each reader rebuilt the files from an older copy, the 9 Oct zip, plus the Job E
> and E10 diffs. Anything Calendar Jobs A–C changed between 9 Oct and Job E's base is missing from
> that rebuild. So every line number here is approximate, and any claim about code **outside** the
> two diffs may be wrong. **Check each item against the real code before believing it**, which is
> what E11's "prove first" rule is for. Items whose whole chain sits inside the diffs are the safest
> (M5's `formatMoment` and `fmtIn`, for example). Items that lean on a file neither diff touched
> (M1's route reply, M2's page-path `email: false`, M3's signup page) need the real file read
> first.

## How this was done

The method was the same as for Job E. Three readers took one part each of
`docs/reports/jobE10-code.diff` (5,465 lines, 52 files):

- Audits;
- Documents, the nightly jobs and the shared libraries;
- HR and Requirements.

None of them wrote the code. They were given the specification (`jobE-independent-review.md` v2),
not E10's report. The chat then checked the worst findings against the code itself, and looked at all
nine E10 screenshots.

Each item is marked one of two ways:

- **READ**: confirmed by reading the code. The chain from cause to wrong result is complete.
- **TO PROVE**: E11 must show it with a test that fails before anything changes.

The chat traced four items itself; each is marked **chat-checked**.

## The verdict

E10 did what it was asked. Every item on the list was proved and built. But its fixes carry new
faults of the same kind, at about the same rate, and four of them would hit customers on the first
day. Two reasons, and both change how E11 works:

1. **The gate spent $0, so no customer path was walked end to end.** No real scan, no real audit, no
   page upload followed by the sweep, and no signup with "Don't see your industry?". Unit tests pass
   because they test what the author believed. A walk on Haiku costs cents and would have caught all
   four.
2. **Two of the chat's own specifications had holes,** and E10 built them faithfully:
   - **D1.2** said "now says it is on file". It should have said "was **not** on file before, and is
     now".
   - **D2** put the question on the Requirements page after the fact. One fact the reader found
     changes the design: **requirements only ever leave the list through the industry filter**
     (`lib/resolve.ts:257`). Answering a question can change a requirement's status but can never
     remove it. So a big drop comes from exactly two places: an industry change, or a library
     revision. The question belongs on Company information, at the moment the industry changes.

---

## 1. BREAKS THE NORMAL PATH: fix in E11

**M1. Workspace: every newly attached file is treated as unreadable.** CONFIRMED BY THE OWNER, on
localhost:3000 (E10's code), 12 Oct at 19:59. `Title_V_Air_Quality_Permit.pdf` was attached and a
question typed, and the page answered: "It is saved to Documents, but we could not read it well
enough to rely on…" with "Upload a clearer copy". On Vercel (the old code) the same file was read and
answered minutes earlier. The reader was right. The chat's "disputed" and "unresolved" were wrong.

- `app/compliance/page.tsx` (about line 473) now accepts only `scan?.status === 'read'`.
- `/api/document-scan` answers with the **scan's** status (`current`, `expiring`, `no_gaps_found`,
  `gaps_found`, `recorded`…), never `read`. The comment saying it is `documents.status` is wrong.
- **Result:** someone attaches a clean PDF and asks. The paid scan succeeds, then the page says the
  file could not be read and never asks the question. Attaching again pays again and fails again.
- **Fix:** read means anything except `could_not_read` and `uploaded`. Add a contract test that pins
  the page's check to the route's real response.

**M2. A page upload of 2–3 files now gets the email the design says it must never get.** READ,
chat-checked.

- The page path finishes its batch with `email: false` (`app/api/document-batches/route.ts:80`).
  That leaves the batch `done` with `notified_at` empty.
- The sweep's new end pass re-reads every batch with `notified_at` empty and calls
  `finishBatchIfDone` with email on. Its retry branch cannot tell "we chose not to email" from "the
  send failed", so it sends.
- **On release,** the first sweep emails every such batch from the last 7 days at once.
- **Fix:**
  - The row records that no email is wanted, and the retry respects it.
  - The retry claims the batch before it sends.
  - It gives up after a few failed sends.
  - Its query cannot be crowded out: it looks only at batches that want an email, or are not done,
    within the age limit. The reader's items 7 and 8 belong here.

**M3. Signup refuses "Don't see your industry?".** READ.

- The signup page offers `value="other"` with a description box. The X3 fix refuses any industry
  without library rows, so the visitor fills in the whole form and gets a 400. No email is kept, so
  the 400's promise ("we will let you know") cannot be kept.
- **Decision (§3 below): accept `other`.** Keep what they typed in the description box. The
  Requirements page then shows D2.4's "gap on our side" sentence.

**M4. N1 is fixed for new conversations only. Existing ones still carry the bug.** READ.

- Every existing `last_turn_at` was stamped by the app server's clock, 5–65 ms after its turn's own
  `created_at`.
- When new code summarises such a conversation before it gets a new turn, the summary's coverage is
  earlier than `last_turn_at` again. The result is a paid summary every night, the person's own
  summary overwritten, and the 12-month clean-up skipping the conversation for ever.
- **Fix:** a repair migration that sets every topic's `last_turn_at` to its newest turn's
  `created_at`. It runs on staging now and on production at Job D, in the same release as 078.
  - Prove it first: count the rows where the two differ, on staging, and on production with SELECT
    only.

**M5. Every due date in the audit drawer shows one day early.** READ, chat-checked.

- `components/AuditReport.tsx`'s date helper is now `formatMoment(iso, tz)` (`lib/calendarDate.ts`,
  Calendar's own library).
- For a plain day like `2027-01-05`, `formatMoment` builds **UTC midnight** and then shows it in the
  company's zone. Every US zone is behind UTC, so it reads "4 January 2027".
- The Audits page's deadline list and "Add to calendar" still show the right day, so they disagree
  with the drawer.
- **Fix at the source:** `formatMoment` treats a date-only value as a calendar day, with no zone
  conversion. Check every caller, Calendar's pages included.

**M6. "Audit again": the evidence close and the counts.** READ.

- **(a)** "Now on file" closes items that were **already** on file. The matcher is given every open
  row of the previous run, including ordinary `on_file` findings, which are most of any audit.
  - **Result:** production's first Audit again on its 70-finding run would say something like "25
    now on file" when nothing changed. A customer reads that as 25 problems fixed.
  - **Fix (D1.2 corrected):** close only when the old row was **not** on file
    (`nothing_on_file` / `stale`, or a date or expected document) and the new row is on file and
    cites a document.
  - An old `on_file` row matched by a new `on_file` row is simply carried.
- **(b)** "Still open from last time" also counts the items just closed as now on file. The three
  groups must be separate and must add up.
- **(c)** Check that the old email sentence "Against your last audit: N still open, N no longer
  raised" is gone. Remove it if it is not. (TO PROVE.)
- **(d)** The email, drawer and Past audits must agree after a person presses Close it.
  - Read the counts live, or update the stored summary on Close and Reopen.
  - A row a person dismissed ("Not right") must not be offered **Close it**, which today answers
    409 for ever.
- **(e)** A "not raised" item must stay visible in later audits until a person closes it.
  - Today it disappears after one more audit (`previousOpenFindings` reads only the previous run's
    own rows).
  - It should still be on the list the next audit is matched against, and still in the group.
- **(f)** Pair rows one to one. Two earlier rows with the same kind and title must not both link to
  one new row.
- **(g)** Limit **Close it** to rows marked not raised, and **Reopen** to rows a person closed.
- **(h)** The line "If it's taken care of, close it." is hidden on paper.
- **(i)** A checklist re-run on the saved lines keeps its "This checklist names X…" note.
- **(j)** D1 refined: an **identical title across kinds counts as raised**.
  - An `expected` document that comes back as a `finding`, or a finding the shaper re-saved as a
    date, is the same item. Carry it.
  - The model's cross-kind link with a *different* title stays ignored.
  - E9 measured this case ("Hydrostatic test records…"), and `shots/e10-not-raised.png` shows it
    landing in "Not raised in this audit".
- **(k)** Show the evidence closes in the **newer** report as a short group, "Since the last
  audit", that names the document. Show what a person closed there too. A count you cannot open is a
  statement with nothing behind it.

**M7. Requirements: D2 as built does not work. Replace it with D2 v2 (§3).** READ.

Five faults, and every one disappears in v2:

- **The industry case only half works, and its note goes stale.** Changing the industry recomputes
  nothing. The note appears at the next unrelated answer and blames that answer. "No, change my
  industry back" also recomputes nothing, so "Your industry is now Other…" stays for ever.
- **"Keep them" freezes the list.** Nothing records the decision, so the next recompute holds again,
  and no answer reaches the list until someone presses Yes.
- **"Yes" closes whatever a fresh recompute says at press time,** not the rows the note named. Every
  row is stamped as the person's decision.
- **A library revision counts as a drop.** The library versions a change as a new row with a new
  id, so a revision holds every affected company with a false note.
- **"If you didn't change anything…" shows on every hold.** The facts read lacks `updated_at`, so
  `newestAnswerIsNewer` is always false.

---

## 2. STUCK, OR COSTING MONEY: fix in E11

**Documents sweep**
- **R1. Attempts run back to back in one run.**
  - The document goes back to `uploaded`, its claim is cleared, and RULE 1 picks it again at once.
    Three attempts take seconds.
  - A 30-second storage blip fails every queued document in every company three times and settles
    them as "couldn't reach".
  - A throw after a paid scan re-scans and pays up to 3 times in a row.
  - **Fix:** a document is tried at most once per run.
- **R2. A document that kills the function is retried for ever.** The limit is checked only in the
  storage branch and the catch; recovery requeues regardless. **Fix:** check the count before
  starting.
- **R3. The recovery's own throw still ends the sweep for every company** (S3's second half).

**Long answers (D3)**
- **R4. `pause_turn`.**
  - When a continuation fails or is stopped, no ledger row is written at all, and the paid first
    piece is lost from the ledger.
  - Each continuation also gets its own ceiling and search cap. Cap the whole answer.
  - On the non-streaming path (document scan, audit, checklists-from-topic), continue as on the
    streaming path, or treat the result as incomplete. Never use it as finished.
- **R5. The conversation id reaches the page only inside `done`.** A first question that is
  stopped, fails or loses its connection still leaves "Try again" opening a new conversation.
  **Fix:** send the topic id as the stream's first line.

**HR**
- **R6. The handbook-check split.**
  - Each half claims again and adds an attempt, so the halves fail on their first ordinary error.
  - The recursion never checks the time budget.
  - The halves sit unclaimed, so an overlapping run can re-pack them into the original piece.
- **R7. The night-queue rule keys on the wrong thing.**
  - "Ever failed" stops nightly re-queuing for a handbook whose first check failed for a temporary
    reason.
  - A handbook whose scheduled check fails keeps `next_check_at` in the past, so it is re-queued and
    paid for every night.
  - **Fix:** key the stop on "this part could not be checked", and move `next_check_at` on a failed
    check.
- **R8. `queueDueChecks` has no per-item catch.** One handbook stops the night's queue for the rest.
- **R9. Fork path C is still open.** `lib/handbookRead.ts` reads `version_of` when the read starts.
  A delete mid-read relinks the chain, so the retire step walks from a deleted id and v0 stays
  current. **Fix:** take it from the fresh `siblings` read.
- **R10. S15 is half done on the HR page.** `loadRowChecks`, `loadCheckView` and the 5-second poll
  have no catch. A read handbook's drawer can still say "This handbook has not been read yet."
  `loadHandbooks` ignores its error.

**Audits sweep and retry**
- **R11. Retry can leave a part waiting for ever.** The new `notified_at` read sits between the
  re-queue and the run's reset. **Fix:** move the read above the delete.
- **R12. Unfinished-run reads can still stop the sweep for every company.**
  - The `left` read and the queued-recovery read are outside the per-run try. Move them inside.
  - A run whose finish throws every time is retried every 5 minutes for ever. Give it a limit.
  - An empty checklist run whose request died sits in the 50-run window for ever.

---

## 3. THE DECISIONS E11 BUILDS: the chat's recommendations

Pasting E11 is the owner's yes. If any of these four is wrong, say so before pasting.

### D1 refined (Audit again)
As M6: (a) the evidence close needs the old row to have been *not* on file; (j) an identical title
across kinds counts as raised; (k) a "Since the last audit" group names what closed and why.
Everything else in D1 stands.

### D2 v2 (Requirements): the question is asked at the moment the industry changes

1. **On Company information,** saving a new industry first works out what it would take off the
   list. If it would take any requirements off, the person is asked right there, before anything
   changes:
   - *"Changing your industry to <New> would take your <N> <Old> requirements off your list,
     because we don't have a list for <New> yet. Change it anyway?"*
   - Buttons: **Change it** and **Cancel**.
   - When the new industry *is* covered, use the same sentence without the "because…" clause.
   - **Change it** saves the industry and closes **exactly the rows that were shown**. Their count is
     checked again at the press, and if it moved, the person is asked again. Each row is recorded
     as closed by that person on that date, with the reason "industry changed to <New>".
   - **Cancel** changes nothing.
2. **A library revision is not a drop.** A requirement re-versioned in the library is matched to
   its new version (by its lineage in the library, not its row id) and reconciles silently, as it
   did before E10.
3. **Any other big drop is our problem, and the customer sees nothing alarming.** That means all of
   the list, or more than half, with no industry change. The list stays, nothing closes, the
   Requirements page loads normally, and it is logged for the owner (the job view will show it).
4. **These go:** the standing note on Requirements, "Keep them", and the question page's "held"
   sentence. Answers cannot cause drops.
   - An answer whose recompute fails after the answer was saved says: *"Your answer is saved. We
     couldn't update your requirements just now. That's on our side, and we'll try again."*
   - It never returns a 500.
5. **D2.4 stays:** *"We don't have requirements for this industry yet. That's a gap on our side —
   it doesn't mean none apply to you."*

### Signup "Don't see your industry?" (M3)
Accept `other`, and keep the description the visitor typed. It tells the owner which industries
people ask for.

### Ceilings for the audit and the summary (quality, §3.1)

- On Opus, the audit's 16,000 ceiling is hit in 5 of 9 stored golden runs. On production, one
  summary hit 12,000.
- In each case `askAI` already retries with double the room, so customers already get answers with
  that room. We simply pay for the cut-off first attempt as well.
- **Start the first attempt at the doubled number:** audit 32,000, summarise 24,000.
- What the customer gets does not change. We stop paying twice.
- `golden:audit` is re-baselined on Opus at the finish line anyway, because of 079.

---

## 4. SMALL WORDS: fix in E11

- **The "could not fetch the stored file" drawer.** Its link says **"Upload a clearer copy"**. The
  file is not unclear, it is gone, so the link should say **"Upload it again"**. Also hide **Open
  the file** and **Download** there, since both will fail.
- **The Dashboard header.** It shows the industry's slug ("chemical-manufacturing") under the
  company name, on screen and on paper. Show its label.
- **Calendar's own line on the Dashboard.** "1 date has passed. A gentle reminder in case any of
  them still need attention." Singular for one: "…in case it still needs attention."
- **`formatMoment`.** Its callers all get M5's source fix.

## 5. LATER: the full app audit after My Account (written down, not in E11)

- **Tamper-proofing within one company.** A member can write `closed_by`, `closed_at`,
  `closed_reason`, `not_raised_by_run_id` and `obligations_hold` directly through the database API
  with their own token. Make these writable only through server routes or RPCs.
  - Across companies it is safe: RLS holds and the person is recorded from the session.
- **The 1,000-row cap at scale.** It affects the index's closed count, the open-obligations read and
  `queueDueChecks`' handbook read. The confirm stamp also sends a long id list in one request.
- **HR answers download the text of retired versions on every question.**
- **The Documents drawer shows no reason** for a document read well before whose re-read failed.
- **The audit prompt still says** unclaimed items "will be recorded as no longer raised". That line
  goes with Audits' prompt round.
- **The handbook list does not group a chain's versions together.** Same-name rows read as
  duplicates. This is for HR's next layout pass.

## 6. FOR JOB D: added to what is already there

- Apply 073 to the last E11 migration on production **before** the push.
- Run M4's repair on production in the same release.
- **Production, SELECT only, before the push:**
  - findings closed as "not raised by the newer audit". The owner ran Audit again on production on
    12 Oct, on the old code. The old code probably did not link agency re-audits (O1 was Job E's
    fix), so probably nothing closed. If anything did, D1.6's reopen plan comes back;
  - batches from the last 7 days that were done with `notified_at` empty, so you know there is no
    email burst;
  - companies whose `industry` is not a library slug.
