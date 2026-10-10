# Job E — the fix list, worked

**Version:** 1 · **Started:** 10 October 2026 · **Brief:** the owner's Job E (E0–E6), against
`docs/FIX-LIST-FAILURES.md` version 3, with §5's five answers ("yes to all", 10 October).

**The rule every item in this job obeys:**

> Each fix ships with a **proof that makes the failure happen** — made to fail on the old code
> first, then passing on the new. A check that cannot fail proves nothing.

This file is written as the job runs, one block per checkpoint, so the evidence is recorded beside
the code rather than reconstructed at the end. The per-section table, the two prompt wordings for
the owner's yes, what is LEFT and the spend are at the bottom.

**Standing constraints:** staging only · nothing pushed · `npm run haiku -- <command>` for anything
that can call a model · $3 cap · this job's own spend reported, not the ledger total.

**Ledger at job start:** 359 calls · $19.09.

---

## E0 — confirmed on the live tree

`scripts/fixlist-confirm.mjs` parses all **54 numbered items** out of the fix list and reads each
`file:line` from the current files. **Every line number has moved** — the list was read from the
`2026-10-09_0954` zip, which predates Calendar Job A, and Jobs A, B and C have shifted the files
since. So no item is confirmed by its line number. Each is confirmed by **behaviour**, at the point
in this job where it is reached, and this file records which line it is on now.

The full per-section confirmation table is at the bottom of this report, filled in as the job runs.

---

## E1 — the helper, then severity 1

### The helper: `lib/mustRead.ts` — root R2's one fix

**Commit `4b30a04`.** `mustRows` · `mustRow` · `mustCount` · `tryRows`, and `ReadFailed` carrying
`what` — named for the person ("your documents", "the folder's files"), not for the table, because
a bare PostgREST message is not a sentence anybody outside this codebase can act on.

**Why a helper rather than a rule.** The rule has existed since `CLAUDE.md` §3.12 and the list still
found forty-odd places breaking it, because `const { data } = …` is shorter than the correct thing
and reads fine. This makes the correct thing the shorter one. `tryRows`'s failure branch has **no
`rows` field at all**, so `tryRows(…).rows ?? []` cannot be written.

`mustCount` refuses a **null count with no error** as well, which is not theoretical: PostgREST
returns exactly that for a table that does not exist, and it is how `scripts/calendar-b6-rowcounts.mjs`
printed a confident `0` for a Workspace table this product has never had, from Calendar B6 until
Job C looked at it. The gate's own script carried the failure the gate exists to catch.

`tests/unit/mustRead.test.ts` — 9 tests.

### D3 · sev 1 · Documents — a folder deleted on a count nobody got

**Commit `4b30a04`.** Now `app/api/folders/route.ts`; `lib/folderDelete.ts` + `tests/unit/folderDelete.test.ts` (7 tests).

**D3 is worse than the list says.** The entry reads *"the count is unchecked"*. The consequence is
that the folder was **deleted**:

```ts
const { count } = await db…                 // `error` never destructured
if (count && count > 0) return refuse       // a failed read gives count: null
                                            // null && … is FALSY → falls through → DELETE RUNS
```

A folder full of compliance documents was deleted because a question about it went unanswered.
Sub-folders and `folder_audits` cascade; the documents become unfiled.

**The proof.** `tests/unit/folderDelete.test.ts` carries `oldGuard` — the shipped logic copied line
for line — and shows it returning `'DELETE IT'` for a folder holding four files whose count errored.
Then the fix throws `ReadFailed`, and the route returns **503** with plain words. An empty folder is
still deletable: a fix that refused everything would be no fix.

*The route's own test had to strip comments before asserting, because the paragraph explaining the
fix quotes the old `count && count > 0`. Third time that trap has bitten in these jobs (the
dashboard's test, the email frame's, now this).*

### W1 · sev 1 · Workspace (requirements) — a database hiccup closed every open obligation

Now `lib/obligationWriter.ts:96–110` → the same five reads, confirmed by reading them:
`companies`, `entities`, `requirement_templates`, `switches`, `company_switches`, destructured
`{ data: … }` five times with **no `error` anywhere**.

**Why severity 1, in the code's own words.** The whole set goes to
`close_and_replace_obligations` (migration 023), and that function's contract is *"this is the
complete set; reconcile it"* — the writer's own comment says so, and explains that a narrowed
payload is what makes a departed obligation detectable at all. So an **empty** set is not a
narrowed payload, it is an instruction to close everything:

| the read that failed | what happened |
|---|---|
| `requirement_templates` | an empty set → **every open obligation closed**, `obligations_computed_at` stamped, and /requirements saying *"we found none that apply to you. That is a result, not a gap."* |
| `company_switches` | every established fact gone → every decided row closed and reopened as `unknown` — a company that had told us 95 facts is asked all of them again |
| `switches` | no value types → `splitFacts` ignores every fact → the same |
| `entities` | no sites → every site-scoped obligation (73 of the 95 switches are site-scoped) leaves the set |

And it runs on **every** answer to a company question, from `/api/switches/answer:125`. A database
hiccup during an ordinary afternoon of answering questions was enough.

**The fix**, in `lib/obligationWriter.ts`:

1. All five reads go through `mustRow` / `mustRows`, so a failure throws `ReadFailed` before
   anything is written. The `companies` read moved from `.single()` to `.maybeSingle()` on purpose:
   it keeps *"this company does not exist"* (a real answer → "Company not found") apart from *"we
   could not ask"* (a `ReadFailed`). `single` reports both as an error and the two want different
   sentences.
2. **An empty library throws.** `requirement_templates` is shared reference data — 188 live rows,
   the same for every company in the vertical. Zero rows means the library is not there, not that
   this company is exempt from everything. Checked separately from the error, because a read can
   succeed and still come back empty: a filter that stops matching, a seed that did not run.
3. **An empty result never closes open rows.** Before the RPC, if the computed set is empty, the
   count of this company's open obligations is taken (through `mustCount`); if any are open, it
   refuses and says how many. This catches an emptiness that arose for a reason nobody has thought
   of yet — the damage is identical however it arose. It is deliberately *not* "refuse every empty
   set": a company with nothing open loses nothing, so that write proceeds and the timestamp is
   stamped, which is the state migration 022 exists to record.
4. The `obligations_computed_at` stamp's own error is checked. The rows are already reconciled at
   that point, so a stamp that silently failed leaves the company looking "never computed" and
   every later request recomputing — the lazy path's one job, undone without a word.

**The proof: `tests/unit/obligationWriterReads.test.ts`, 11 tests.** It runs the **real**
`writeObligations` against a thin fake database, one planned answer per table, logging every write
and RPC the real code attempts. Not copied logic — the code under test is the code that ships.

*Made to fail on the old code first.* With `lib/obligationWriter.ts` reverted to the shipped
version, **8 of the 11 failed**:

```
✔ the good run still works — a check that cannot see a presence proves nothing
✖ a failed requirement_templates read throws and writes NOTHING
✖ a failed company_switches read throws and writes NOTHING
✖ a failed switches read throws and writes NOTHING
✖ a failed entities read throws and writes NOTHING
✖ a failed companies read throws and writes NOTHING
✖ an empty library throws — 188 shared rows cannot mean "nothing applies to you"
✖ *** zero obligations while rows are open: refused, with the number in the sentence ***
✔ zero obligations with NOTHING open is allowed — migration 022's "computed, and nothing applies"
✖ and if that open-row count itself cannot be taken, we stop rather than guess
✔ no row and no error is "Company not found", not a read failure
ℹ pass 3 · fail 8
```

and the first one's detail is the production failure itself:

```
✖ a failed requirement_templates read throws and writes NOTHING
  AssertionError: Missing expected rejection.
    actual: undefined, operator: 'rejects'
```

— the old code did not throw. It carried on and called
`close_and_replace_obligations(0 obligations)`, which is the line that closes the company's
requirements. On the new code all 11 pass.

The first test in the group is the good run, deliberately: §9a — a check that reports an absence
must be shown seeing a presence first. One applying library row in, one obligation out, the RPC
called with 1, the timestamp stamped.

### D1 · sev 1 · Documents — a failed re-read emptied a document's open questions

Now `lib/documentScan.ts:989–993` for the withdrawal (the fix list's `:931–934`), and the file still
had **one** early exit for `could_not_read` — the calendar step's, added in Calendar A3. Confirmed by
reading `saveScan` end to end: there was no other.

**What it did.** "Read it again" on a document, the reading service refuses, and the one statement

```ts
db.from('fact_proposals').update({ status: 'withdrawn' })
  .eq('document_id', documentId).eq('status', 'proposed')
```

ran anyway. A failed reading proposes no facts, so the document's open questions left Company
information and the sidebar badge and **nothing took their place**. Same rule as the calendar step's,
in a second place: a reading that could not read the document has no opinion about what it says.

**And a second fault the list names in one clause** — *"It also runs before the insert"*. The comment
that was there argued for that, and its reason was sound: the new reading's own rows must not be
caught by the withdrawal. But if the insert then failed, the earlier questions were already gone and
the new ones never arrived.

**The fix.**

1. On `could_not_read`, withdraw nothing, and **say so**: a new `FactsStep` returned beside
   `CalendarStep`, with `skipped` carrying the reason. Same shape and the same argument — a step that
   quietly did nothing is indistinguishable from a step that never ran, and both look like success.
2. The rows to withdraw are **chosen by id before** the insert and **withdrawn after** it. The new
   reading's rows cannot be in a list made before they existed, so the old comment's concern is still
   met, and a failed insert now leaves the earlier questions standing.
3. The read that chooses them goes through `tryRows`. A failure withdraws nothing and records it on
   the step rather than throwing — because `saveScan`'s caller writes a `could_not_read` scan over a
   reading whose save threw (`app/api/document-scan/route.ts:147`), so throwing here would turn a
   perfectly good reading into a failed one to punish a hiccup in a bookkeeping query. Leaving both
   sets pending is visible and recoverable: `lib/confirmationQueue.ts` lifts the pair out for a
   person.

**The proof: `scripts/fixlist-d1-proposals.mjs`** — free, no model called (a stored real-model
reading of the chemical Emergency Action Plan replayed through `saveScan` with `linkLedger: false`,
and `failedScan`, which by construction calls nothing), in a throwaway company deleted on exit and on
a crash. It takes `--old`, which asserts nothing, so **the same script runs against the shipped
code** and makes the failure happen.

Against the shipped code (`git stash push lib/documentScan.ts`):

```
PART A — one document, read well, then read again by a service that refused
   after a GOOD reading                6 row(s): proposed=6
   after the FAILED reading            6 row(s): withdrawn=6
 ✗ a failed reading withdrew 6 of 6 open question(s) — Company information and the sidebar badge go empty
 ✗ 6 proposal(s) are marked withdrawn by a reading that read nothing

PART B — a GOOD re-read whose fact insert fails
   after a GOOD reading                6 row(s): proposed=6
 · the second reading's save threw: fact_proposals: the write was refused (made to fail on purpose)
   after the refused insert            6 row(s): withdrawn=6
 ✗ the document is left with 0 open question(s) instead of 6
```

On the fix:

```
PART A
 · reading 2 … step says {"proposed":0,"withdrawn":0,"skipped":"the document could not be
   read, so this reading replaces none of its earlier questions","error":null}
   after the FAILED reading            6 row(s): proposed=6
 ✓ a failed re-read leaves all 6 open question(s) where they were
 ✓ nothing is marked withdrawn by a reading that read nothing
 ✓ the step says why it did nothing

PART B
   after the refused insert            6 row(s): proposed=6
 ✓ the earlier 6 open question(s) stand: nothing was withdrawn for rows that never got written

PART C — an ordinary GOOD re-read, which must still replace the earlier questions
 · the second GOOD reading's step: {"proposed":6,"withdrawn":6,"skipped":null,"error":null}
   after a GOOD re-read               12 row(s): withdrawn=6 proposed=6
 ✓ a good re-read leaves its own 6 question(s) open and no others
 ✓ the earlier reading's 6 question(s) are withdrawn, not deleted — the drawer still shows them
 ✓ every open question is the new reading's own wording
```

**Part C is there on purpose.** §9a — a check that reports an absence must be shown seeing a
presence. The withdrawal exists because one Emergency Action Plan read twice proposed *"Yes, kept in
the front office"* and *"Yes — an AED kept in the front office"* for one key, and the confirmation
queue then asked a person to arbitrate between two paraphrases of one sentence. A fix that stopped
withdrawing anything would bring that back, and would have passed parts A and B.

**Also shown in the script, verbatim:** the one shipped statement, run on a document of its own, so
the comparison does not rest on remembering what the old code did — 6 open questions → 0.

**Effects on other sections, by file.** `saveScan`'s return gained `facts`; both callers
(`app/api/document-scan/route.ts`, `app/api/jobs/scan-documents/route.ts`) destructure `{ scanId }`
only, so nothing else changes. Company information (`app/api/company-information/route.ts`) and the
sidebar badge (`components/AppLayout.tsx:77`) read `fact_proposals` and now keep their rows through a
failed re-read; neither file changed. No migration.

### D2 (with L1) · sev 1 · Documents → Audits — a renamed label deleted by the next tidy-up

Now `app/api/company-labels/route.ts:102–136` for the rename and `lib/companyLabels.ts:58` for the
prune. Confirmed by reading both.

**The failure, and why it is not a bug in the rename.** The rename route writes the new name into
`document_corrections` and `company_labels` and **never into a scan** — deliberately, and
`document_corrections`' own description says why: *"the scan row is never edited, so what the model
said stays readable and a re-scan cannot undo a person."* `pruneOrphanLabels` read raw
`document_scans`. So after a rename:

```
document_index_v.agencies  (corrections applied) = ["Oregon Department of Environmental Quality"]
document_scans.agencies    (the raw reading)     = ["Oregon DEQ"]
```

the old name was gone from `company_labels`, the new name was in no scan, and the next delete of
**any** document — which is when pruning runs (`app/api/documents/route.ts:302`) — deleted the
renamed label. `auditAgenciesFor` reads `company_labels`, so the company lost that agency from "audit
everything" immediately after telling us what to call it. It **deletes**, which is why it is
severity 1.

**The fix is one read.** `document_index_v.agencies, subjects` carries both rules at once: the view
takes a document's identity from the reading that could read it (migration 076 — that is L1) and then
applies the person's corrections field by field (that is D2). `lib/companyLabels.ts` no longer touches
`document_scans`, and no longer calls `readableScanIds` either: the rule it was standing in for now
arrives in the same read, from SQL, where it is defined.

**The proof: `scripts/fixlist-d2-rename.mjs`** — free, no model called, a throwaway company, run
twice. The rename is performed exactly as the route performs it (a correction row per carrying
document, the old vocabulary row deleted, the new one inserted), because the route needs a session
and the code under test is the prune.

On the shipped code:

```
· a person renames "Oregon DEQ" → "Oregon Department of Environmental Quality" (1 document corrected)
· pruneOrphanLabels after a document delete: removed 1 — agency:Oregon Department of Environmental Quality
   the company's vocabulary: subject:Air quality
   "audit everything" would audit: (nothing)
 ✗ the renamed agency was pruned
 ✗ "audit everything" no longer audits that agency
 ✗ a failed re-read made the renamed agency an orphan and it was deleted
```

On the fix:

```
· pruneOrphanLabels after a document delete: removed 0
   "audit everything" would audit: Oregon Department of Environmental Quality
 ✓ the renamed agency survives a document delete
 ✓ "audit everything" still audits it, under its new name
 ✓ the two labels no document carries are still pruned
 ✓ ...and the renamed one is still there
 ✓ a failed re-read leaves the vocabulary alone (L1, and the rename survives with it)
```

The subject `Air quality` survived on the old code too, and that is the useful contrast: it was never
renamed, so the raw scan still carried it. Only the corrected name was invisible.

**The third block is the one that keeps the function honest.** Two labels no document carries —
the `Test Gamma Solvents` case in `lib/companyLabels.ts`'s own header, which is why the prune exists
— are still removed. A fix that pruned nothing would have passed every other check in the script.

**Effects on other sections, by file.** `lib/audit.ts:117` (`auditAgenciesFor`) and the Audits page
group by `company_labels`, so this changes what "audit everything" audits — in the direction of
auditing what the person named. `tests/unit/documentScanCalendar.test.ts` had two A3e assertions
naming `readableScanIds(admin, companyId)` in this file; both were updated to the stronger shape
(`document_index_v` present, `document_scans` absent), and the updated test was checked to **fail**
on the shipped `lib/companyLabels.ts`. No migration; the view already existed.

### A2 · sev 1 · Audits — a failed read of a run's summary erased the run

Now `lib/auditRun.ts:513–523` and `:538–544` (the fix list's `:513–514`, `:538–539`). Both were
read-modify-write of one jsonb column:

```ts
const { data: cur } = await db.from('audit_runs').select('summary')…   // error discarded
const prevSummary = (cur?.summary ?? {}) as Record<string, unknown>    // a failure becomes {}
await db.from('audit_runs').update({ summary: { ...prevSummary, …mine } })
```

**The list marks it "sev 1 (small)". It is not small.** A failed read did not lose the patch — it
lost everything else. `audit_runs.summary` is where several things live that have no column of their
own: the run's note (*"This checklist names Cascade Analytical, not you"*), the extraction's receipt
`extraction_ai_call_id`, the words a rule reshaped or refused, the duplicates earlier sections
collapsed, and the counts `summariseRun` writes at the end. Spreading `{}` wrote a summary holding
only the three keys that step was adding, and **nothing recomputes the rest** — the report and the
email then read what was left.

**The fix:** `lib/auditSummary.ts`, a seam of its own, because the only way to prove this is to make
the read fail and `runSection` cannot be handed a database that errors on one statement.
`patchRunSummary` reads through `mustRow` and, on a failure, **writes nothing** and returns the
failure for the caller to warn about. A section that read documents, called a model and saved its
findings must not be marked `could_not_complete` because a bookkeeping read failed — but it must not
write a summary built on one either. The keys that step would have added are lost; that is the lesser
loss, said out loud, instead of the note and receipt being lost silently.

**Two more reads of the same column, checked for the same reason** (both in A2's own sentence):
`finishRunIfDone`'s collapse count — the write there *replaces* the summary, so a failed read would
store `collapsed_duplicates: 0` for good — and `summariseRun`'s read of the run, which is what
carries the note, the receipt and the reshaped lists forward, and whose result is written back over
`summary`. Both now `mustRow`. `summariseRun`'s other two reads are fix-list **A8** and are left for
E4 with their own proof: a failed findings read stores an all-zero summary and emails "nothing needs
you", which is a different failure needing a different sentence.

**The SQL route was considered and not taken.** The list offers `summary || patch`, which would also
close a read-modify-write race. That race is not live — the sweep claims one company at a time and
runs its sections one after another (`app/api/jobs/audit-sections/route.ts`), which `lib/auditRun.ts`
states at the first call site. Taking it means a migration and two functions to express "append to
this list" and "add to this number", for atomicity nothing is contending for. `lib/auditSummary.ts`
records that, and is where the fix goes if sections ever run concurrently.

**The proof: `tests/unit/auditSummary.test.ts`, 15 tests.** `oldPatch` is the shipped
read-modify-write, copied line for line:

```
✔ with the read working, it keeps everything and appends
✔ *** with the read FAILING: the summary becomes one key ***
    assert.deepEqual(Object.keys(out), ['reshaped_to_dates'])
    out.note === undefined                  — the run's note is gone, and nothing recomputes it
    out.extraction_ai_call_id === undefined  — so is the extraction receipt
    out.collapsed_duplicates === undefined   — and so is an earlier section's count
```

and the last group reads `lib/auditRun.ts` itself; **three of the 15 fail on the shipped file**.
`mergeSummary` is pure, so what it does to each kind of key is tested without a database — including
a key held in the wrong shape by an older version of the code, where `[...7]` would throw and
`7 + [..]` would produce a string.

**Effects on other sections, by file.** `lib/auditRun.ts` only; `lib/auditSummary.ts` is new. The
run's summary is read by `components/AuditReport.tsx`, `app/audits/page.tsx`,
`app/api/audits/index/route.ts` and `lib/auditNotify.ts` (the email's subject) — none changed, and
all four now read a summary that cannot have been built on a failed read. No migration.

### H4 · sev 1–2 · HR — a handbook switched off before its replacement could be read

Now `lib/handbookSave.ts:57–61`. Confirmed: the newer row went in `is_current: true` and the older one
was set `is_current: false` **in the same request**, before the new file had been read.

**E0's check of HR's own decisions, which the list asked for.** HR-PLAN decision 8: *"only the newest
is used for answers and checks, but on HR's own rows."* Decision 18: versions live on HR's own table.
**Neither says when `is_current` flips**, so nothing in HR contradicts the fix.

**What it cost.** If the read then failed — a scan, a .doc, a rate limit — the company's readable
handbook was gone from every path that could reach it:

| the path | what it did |
|---|---|
| `lib/hrAnswer.ts:119` | answers load current versions only → `withText` empty → `HR_REFUSALS.unreadable`: *"None of your handbooks could be read"*, about a handbook we held and could read |
| `lib/handbookCheck.ts:290`, `:332` | the older version's **open check** cancelled as replaced |
| `lib/handbookCheck.ts:550` | the nightly job wants current **and** read, so it checked neither |

**The fix does not change what `is_current` means.** The newer row still arrives current, so the page
shows it and the reader claims it. What moved is **the switching off**: the older version is retired
in `lib/handbookRead.ts`, on the one write that sets `status: 'read'` — the write that proves the new
version can be read. R5 in one line: switch over once the new thing has succeeded, never before.

Until then **both are current**, and that is a state the product already supported and already
rendered — `lib/handbookSave.ts`'s own header described it (*"both stay current and both are shown"*)
and `olderVersions` skips a current row, so the two list cleanly and neither appears twice. With both
current:

- the new version unread → `unread` includes it → the answer **waits** for it (§183, unchanged);
- the new version unreadable → the previous version has text and is used, and the new one is named as
  not used with its reason. **No false refusal.**
- the older version's open check is not cancelled, because `is_current` is still true;
- the nightly job keeps checking it.

**Two consequences I had to fix with it, both named.** `setHandbookSite`'s *"current version only"*
guard tested `is_current`; with two current versions that would let a person set the site from the
**older** one, and the walk goes down the chain, which is precisely the version-split the guard
exists to prevent. It now tests **newest in the chain** — nothing names it as the version it
replaces — which is what the guard always meant. And one line of UI copy (`inUseNote` in
`lib/handbooks.ts`) says which version answers a question while the other is read: *"in use while the
new version is read"*, or *"in use — the new version could not be read"*. Without it the two look
like two handbooks of one name and nothing says which one answers. Labels are §3.1-safe.

**One judgement call, stated plainly.** With the fix, a company whose new version could not be read
now gets an answer from the previous version, and the prompt's "Not included, so not read for this
answer" line names the unreadable one — so **the prompt's content changes** in that case, from a
refusal to an answer plus that line. I took it because it is the owner's own §5 answer (1) — *readers
take the latest readable reading* — applied to HR's own table, and because the behaviour it replaces
is a false statement. It is not a prompt **edit**: no file in `prompts/` changed. The two versions
share a name, so that line can read oddly (*"Employee Handbook" used, and "Employee Handbook" could
not be read*); **a one-line sharpening of that wording is drafted in E6 for the owner's yes**, since
the words themselves are a §3.1 change.

**The proof.** `tests/unit/handbookSave.test.ts`: the upload must write exactly **one** row, and *no
row may be marked not-current on the strength of a file nobody has read*. Five H4 tests in
`tests/unit/handbookRead.test.ts`, driving the real `readHandbook` through its injected deps:

```
✔ *** H4: a NEW VERSION retires the older one only once it has been read ***
    assert f.log.indexOf('db.update status=read') < f.log.indexOf('db.update is_current=false')
✔ H4: a reading that FAILED retires nothing, so the older version stays in use
✔ H4: a run that lost its claim retires nothing either
✔ H4: a first handbook (no version_of) retires nothing
✔ H4: if the retirement itself is refused, the READING still succeeded and both stay current
```

**Four of them fail on the shipped `lib/handbookSave.ts` and `lib/handbookRead.ts`** — checked by
stashing both files. Plus six tests in `tests/unit/handbooks.test.ts` for `inUseNote` and for the two
versions listing without a duplicate.

**Effects on other sections, by file.** All HR: `lib/handbookSave.ts`, `lib/handbookRead.ts`,
`lib/handbooks.ts`, `app/hr/HrWorkspace.tsx`, `app/api/handbooks/route.ts`. `lib/handbookCheck.ts`
needed **no change** — its two `is_current` tests become correct on their own once the flag stops
lying. `app/api/handbooks/route.ts` lost its `older_not_replaced` log and `HrWorkspace` the matching
notice, since the save no longer has a second write to fail. **Nothing in Documents, Audits, the
dashboard or the Calendar reads a handbook** (HR-PLAN decision 18), so nothing else is touched. No
migration.

### W2 · sev 1 · Workspace and HR — a summary now says how far it read

Now `lib/summaryReport.ts:570` for the stamp, `app/api/topics/[id]/summarise/route.ts:76` and `:85`
for the window, `lib/retention.ts:67` and `lib/topicClaim.ts:156` for the two readers. Confirmed by
reading all four.

**The window, exactly.** The route loads the turns at `:76`, claims at `:85`, calls the model, then
writes — and the write stamps `summarised_at = new Date()`. A message sent in between is **newer than
anything the model saw and older than `summarised_at`.** Two things read that as "covered":

| reader | what it did |
|---|---|
| `lib/topicClaim.ts:156` | `spokenSince = last_turn_at > summarised_at` → false → the nightly job never summarised that conversation again. For good. |
| `lib/retention.ts:67` | the 12-month deleter's one safety test was `summarised_at >= last_turn_at` → `clear` → **it deleted turns the summary does not contain** |

The transcript is disposable and the summary is what survives (`WORKSPACE.md` §6.4). So what the
deleter took was gone, and the summary never mentioned it. HR conversations use the same writer and
the same deleter.

**Migration 078 — `topics.summary_covers_through`.** The newest turn the summary actually read,
computed by the run from the turns in its own hand, so there is no window in it at all.

*Why not reuse `summarised_at`.* It is also the token both screens watch to know a summary has landed
(`app/compliance/page.tsx:714`, `app/hr/HrWorkspace.tsx:444`: `row.summarised_at !== w.before`).
Moving it back to the last turn's time would mean a re-summary of an unchanged conversation wrote the
identical value and the page would never notice the new summary. And the drawers print it —
"Summarised 5 January" is a true sentence about a different question.

*The backfill is narrow and says what it assumes.* For an existing row there is no record of which
turns its summary read. So where `summarised_at >= last_turn_at` the column is set to `last_turn_at`
— which asserts nothing new, being exactly what both readers already believed of those rows and
already acted on. Everywhere else it stays NULL, and **NULL means not known**, which the deleter
treats as "do not clear". Those are the rows today's code already skipped. On staging the backfill
reached **86 of 86** topics; the migration's verify block builds all three cases and checks that the
two it cannot vouch for stay NULL.

**The code.**

1. `newestTurnAt(turns)` in `lib/summaryReport.ts`, called **before any model call**. It throws if
   the turns carry no `created_at`, naming the fix — because a caller that forgets writes a summary
   with no coverage, which is then never cleared and re-summarised every night for ever, a silent
   permanent waste. Failing before the paid call costs nothing. `TurnLike` gained `created_at`.
2. The nightly job's own turn read (`app/api/jobs/summarise/route.ts:111`) did not select
   `created_at`; the two per-topic routes go through `loadTurns`, which does.
3. `lib/retention.ts` tests the coverage, with a new reason `skip_not_covered` — listed separately
   from `skip_no_summary` in the job's record, because this row *has* a summary.
4. `lib/topicClaim.ts`'s "spoken since" tests the coverage. An unknown coverage counts as
   spoken-since, so the conversation is summarised again and the coverage becomes known.
5. **`app/api/jobs/delete/route.ts` deleted on anything it did not recognise.** It read
   `if keep continue; if skip_no_summary continue;` and then deleted — so W2's new reason would have
   fallen straight through to the delete. It now tests `if (decision !== 'clear') continue`, which is
   what it always meant. That is a second defect, found by adding to the enum, and it would have made
   this fix worse than no fix.

**`last_turn_at` was NOT added to `guardSummaryWrite`, and the list asks for it.** With the coverage
stamped, a summary that lands after a new turn is recorded honestly and re-summarised tonight;
refusing the write would throw away a paid model answer that is correct for the turns it read, and
leave the person pressing Summarise again. The guard's job — not overwriting another run's work — is
unchanged and still holds. Recorded here rather than done quietly.

**The proof.** `tests/unit/retention.test.ts` and `tests/unit/topicClaim.test.ts` each carry the
shipped rule copied line for line beside the new one:

```
✔ the OLD rule cleared it, because the summary was written after the turn
    (turns loaded 10:00, person speaks 10:03, summary lands 10:05)
✔ *** the new rule skips it: the coverage stops before the last turn ***
✔ and once it has been summarised again, covering that turn, it clears
✔ a coverage we do not have is never a covering one — not an older row, not a new column
✔ the old rule and the new one agree on an unraced conversation, or this would be a regression
✔ the OLD rule called it covered, so this job never summarised it again
✔ *** the new rule sees the gap and summarises it tonight ***
✔ and a summary that DID cover the last turn is still left alone — or this is a cost regression
```

plus `newestTurnAt`'s own tests, including that it **throws rather than guessing**.
**Seven tests fail on the shipped files** (checked by stashing the four). The end-to-end staging run
— a raced topic through the real `/api/jobs/delete` — is in the gate's nightly-jobs part below.

**LEFT, named and scoped.** The drawers print "Summarised 5 January" over a summary that may stop
short of the newest message and say nothing about it. Saying so needs `summary_covers_through` on
`topic_list_v` (a view migration) and a line in both drawers. Severity 3, and it is a screen, so it
goes in **E4** with the other screens rather than being half-done here.

**Effects on other sections, by file.** `lib/summaryReport.ts`, `lib/retention.ts`,
`lib/topicClaim.ts`, `lib/conversation.ts` (unchanged — it already selected `created_at`),
`app/api/jobs/summarise/route.ts`, `app/api/jobs/delete/route.ts`, migration 078,
`lib/database.types.ts` and `docs/SCHEMA.md` (both regenerated by `db:migrate`). **HR shares every
one of these**: `app/api/hr/topics/[id]/summarise/route.ts` needed no change because it uses
`loadTurns`. The Calendar, Documents and Audits do not read `topics.summarised_at`.

### A1 with O1 · sev 1 · Audits — "Audit again", and the four ways it closed a finding nobody spoke about

Now `lib/auditRun.ts:938–979` (`matchAgainstPrevious`) and `app/api/audit-runs/route.ts:131–133`.
Both confirmed by reading them.

**O1 first, because it is why none of A1 had ever happened.** `components/AuditReport.tsx:568` has
always sent `previous_run_id`. The template branch of `app/api/audit-runs/route.ts` has always kept
it. **The agency branch dropped it.** `runSection` reads `runRow.previous_run_id` to decide whether
to show the model the previous findings (`:395`), so for the re-audit a customer actually presses,
`previous` was always empty and the matcher never ran. "Carried" and "closed" existed, were tested,
and nothing in the app could reach them.

**Which is exactly why the list says "Fix with A1, never before it."** Restoring that one field would
have switched all four of A1's faults on at once, for every re-audit, the moment it shipped.

**A1's four faults, each with what it cost:**

| | the non-answer | what happened |
|---|---|---|
| 1 | the read of the section's own new rows was `const { data: fresh } = …` | a failed read gave an empty list, nothing could be matched, and **every open finding of the previous run was closed** as "not raised by the newer audit" |
| 2 | rows were matched by **position** (`freshRows[i++]`) while `shapeFindings` **drops** items | one dropped item shifted every later answer onto the wrong row: `same_as` landed elsewhere and the finding the model said *is* still being raised was closed |
| 3 | a **checklist** answer has none of the four arrays | every previous finding was unmatched by construction, so a checklist re-run closed every open finding of the agency audit before it |
| 4 | closing ran **before** `collapseAgainstEarlier` and before the section's own `done` write | a throw in either left findings closed by a section that then failed |

**The fix.** `matchAgainstPrevious` now carries forward and **closes nothing**; `closeUnmatchedPrevious`
is its own function, called last. The fresh read goes through `mustRows`. Rows are matched by
**(kind, title)** — as `collapseAgainstEarlier` already did, for the reason written out there, with
the kind added so a date and a finding of the same wording stay apart. An answer carrying none of the
four lists closes nothing, while **`findings: []` still counts as an answer and still closes**: the
model saying it found none is a real answer about that agency; a missing key is an answer we did not
get, and §3.2's first rule applies. The caller skips a template run outright. And
`closeUnmatchedPrevious`'s own failure is reported, not thrown: the previous findings stay open,
which shows a person work that may already be done rather than closing work that may not be.

**O1's fix is one validated value for both branches**, read through `db` — the caller's own client
under RLS — so another company's run is simply not there, answering 404 rather than 403 so ids cannot
be probed (§3.6). The template branch's unchecked pass-through of a client id is closed with it.

**The proof: `tests/unit/auditMatcher.test.ts`, 19 tests.** `oldMatcher` is the shipped function
copied line for line, driven against a fake client that records every write, so what was closed is
read off the writes:

```
✔ the OLD code closed ALL THREE of the previous run's open findings            (fault 1)
✔ the OLD code attached F2 to the WRONG ROW, and p2 looked claimed by a row that is not it   (fault 2)
✔ the OLD code closed every previous finding, because none could be matched    (fault 3)
```

and then the fix, including the good run first (§9a — two carried to the right rows, the one nothing
claimed reported unmatched and **not** closed here) and the orderings for fault 4 read off the file:
`close > collapse` and `close > done`.

**14 of the 19 fail on the shipped `lib/auditRun.ts` and `app/api/audit-runs/route.ts`.**
`closeUnmatchedPrevious` is imported dynamically on purpose: a top-level import of an export the old
file does not have makes the whole test file fail to load, which is true and says nothing about which
behaviour changed.

**Effects on other sections, by file.** `lib/auditRun.ts` and `app/api/audit-runs/route.ts`, both
Audits. `matchAgainstPrevious`'s **return type changed** (`{ carried, closed }` → `{ carried,
unmatched }`); its only caller is `runSection`, in the same file. `components/AuditReport.tsx` is
unchanged — it already sent the field. **Golden sets that would move:** the Audits golden set's
`carried` and `closed` counts can now be non-zero for an agency re-run, where before they were
always 0; nothing is re-run here (they are paid), and this is named below under "which golden sets
would move". No migration.

---

## E1's close — the cross-section gate, all eight parts

Run after the last severity-1 item. Part 1 had already run after each of the seven checkpoints.

| # | section | what was checked | before | after | pass |
|---|---|---|---|---|---|
| 1 | all | `npm run check` after every checkpoint, floor only up | 1128 | **1216** | ✓ 1144→1155→1170→1180→1197→1216 |
| 2 | Calendar | `calendar_events`, `document_deadlines` (caller / service) | 2/3, 40/40 | 2/3, 40/40 | ✓ unchanged |
| 2 | Documents | `documents`, `document_scans`, `document_gaps`, `document_batches` | 12/12, 14/14, 25/25, 0/0 | identical | ✓ |
| 2 | Documents | `company_folders`, `document_corrections`, `fact_proposals`, `company_labels` | — (new to the script) | 0/0, 0/0, 54/90, 11/11 | ✓ see note |
| 2 | Audits | `audit_runs`, `audit_findings`, **`audit_sections`** | 0/0, 0/0, 0/0 | 0/0, 0/0, 0/0 | ✓ **and the table name was wrong** |
| 2 | HR | `handbooks`, `handbook_sections`, `handbook_checks`, `handbook_check_sections` | 1/14, 0/83, 0/31, 0/226 | identical | ✓ |
| 2 | Workspace | `topics`, `turns`, `checklists`, `checklist_items` | 0/86, 0/221, 0/7, 0/38 | identical | ✓ |
| 2 | Requirements | `obligations`, `company_switches`, `requirement_templates`, `switches` | — (new to the script) | 0/0, 0/16, 205/205, 95/95 | ✓ see note |
| 2 | Company info | `companies`, `entities`, `profiles` | 1/6, 1/7, 1/5 | identical | ✓ |
| 2 | Jobs and cost | `job_runs`, `ai_calls` | **ERR**/42, 12/359 | **ERR**/43, 12/**359** | ✓ by design; ai_calls unmoved |
| 3 | HR, Workspace, Documents, Audits, Requirements | shared files changed, each section's free checks re-run | — | `check`, `check:schema`, `audit:data`, `mutation` | ✓ below |
| 4 | all 8 pages | load and show their rows, by measured title, `BLOCKED` printed | — | **8/8**, `BLOCKED (0)` each | ✓ `shots/jobE-gate-*.png` |
| 5 | all 7 cron jobs | run by hand on the isolated server; `job_runs` row written | 7× 200 | **7× 200** | ✓ |
| 5b | Workspace, HR | **W2 end to end** through the real `/api/jobs/delete` | old rule: cleared | **skip_not_covered** | ✓ below |
| 6 | all | every email's sender, read from the code that sends it | `emailFrom()` | `emailFrom()` | ✓ unchanged |
| 7 | all | `CHECK_LIVE_BASE_URL=http://localhost:3999 npm run check:live` | ok | **ok**, 62 probes | ✓ |
| 8 | all | which golden sets would move | — | **none** | ✓ below |

### Part 2's two notes

**The row counts the script was not taking.** Job E reads and writes seven tables the gate's script
did not name: `company_folders` (D3's delete), `document_corrections` (D2's renames),
`fact_proposals` (D1), `company_labels` (D2), and `obligations` / `company_switches` /
`requirement_templates` (W1). They are in it now, under Documents and a new Requirements section, so
there is no "before" for them — and inventing one would be the thing this report is not for. What
can be said: every one of Job E's own writes to staging was in a throwaway company deleted on exit
and on a crash, and the only schema write was migration 078's column.

**And the gate's own script named a table that does not exist. Again.** It listed
`audit_run_sections`; the table is **`audit_sections`**. Since Job C that prints `NO TABLE` rather
than a confident `0`, which is how it was caught — before C5 it would have printed `0` and the
Audits row of three zeros in Jobs B's gate table would have been two real zeros and one blind spot.
`topic_messages` was the same mistake in the same script. Both are now right.

### Part 3 — the shared files, and each section's free checks

| file Job E changed | whose shared list it is on | that section's free checks |
|---|---|---|
| `lib/summaryReport.ts` | HR (`TEST-AT-FINISH-LINE.md` J), Calendar (step 7) | `npm run check` — HR's and the Workspace's units green |
| `lib/topicClaim.ts` (the quiet rule) | HR (J) | same; `tests/unit/topicClaim.test.ts` 24 tests |
| `lib/documentScan.ts` (`saveScan`) | HR (J), Calendar (J) | same; plus `scripts/fixlist-d1-proposals.mjs` on staging |
| `lib/auditRun.ts`, `lib/auditSummary.ts` | Audits | `npm run audit:data` — 0 failed, **4 SKIPPED and said so** |
| `lib/companyLabels.ts` | Documents → Audits | `scripts/fixlist-d2-rename.mjs` on staging |
| `lib/obligationWriter.ts` | Requirements | `npm run mutation` — **all nine mutations caught**, two of them by the resolver's own tests |
| `lib/handbookSave.ts`, `lib/handbookRead.ts`, `lib/handbooks.ts`, `app/hr/HrWorkspace.tsx` | HR's own | `npm run check`; HR's units green |
| `app/api/jobs/delete/route.ts`, `app/api/jobs/summarise/route.ts` | nightly, every section | part 5 above |

`npm run check:schema` is green and prints its documented blind spot — seven `.from(variable)` call
sites it cannot attribute to a table, one of which is Job E's own proof script. `npm run mutation`
restored every file and the suite came back 1216/1216.

### Part 5b — W2, end to end, on staging

Two conversations thirteen months old, both summarised, in a throwaway company. The script **checks
first that no real staging conversation is due** — one is past the line and holds 0 turns, so the job
has nothing of anybody's to take; if that ever changes the script stops rather than running a
destructive job over real fixtures to make a point.

```
the deleter's decision, read off those rows, under both rules:
   W2 covered   old: clear              now: clear
   W2 raced     old: clear              now: skip_not_covered
 ✓ the OLD rule cleared the raced conversation — its three turns, one of them never summarised

POST http://localhost:3998/api/jobs/delete → 200
{"topics_cleared":1,"turns_deleted":3,"by_topic":[{"topic":"5ce40538…","turns":3}],
 "skipped_no_summary":[],"skipped_not_covered":["6dbff7cb…"]}

turns left: covered=0  raced=3
 ✓ the COVERED conversation was cleared, as it should be
 ✓ the RACED conversation kept all 3 turns: the summary stops before the last one
 ✓ and the job SAYS which conversation it left, under skipped_not_covered
 ✓ the job wrote its job_runs row, with the same counts
```

The decision is a pure function, so both rules are computed from the **same real rows** without
reverting the code — the method `scripts/calendar-a3b-failed-reread.mjs` used for the audit block.

### Part 8 — the golden sets are not re-run, and NONE would move

Checked rather than asserted: `git diff --name-only 0d1f62e HEAD -- prompts/ lib/ai.ts
lib/pipelineConfig.ts` returns **nothing**. E1 changed no prompt, no model setting and no pipeline
switch, so no stored model output can differ. `npm run golden`, `golden:facts`, `golden:docs` and
`golden:audit` would all land where they are.

**One thing they would not catch, and it is named rather than left:** the Audits golden set's
`carried` and `closed` counts were always 0, because O1 meant the matcher never ran. They can now be
non-zero for an **agency** re-run. That is not a prompt change and the stored answers do not move —
but the first real re-audit after this ships is the first time those two numbers mean anything, and
`docs/TEST-AT-FINISH-LINE.md`'s Audits part should carry a line for it.

### What the gate caught in E1

1. **Two stray duplicate files** — `lib/handbookRead 2.ts` and `lib/handbookSave 2.ts`, byte-identical
   copies swept into the W2 commit. Nothing imported them; removed in `71963a9`. Found by listing
   every file the job had touched for part 3, not by `npm run check`, which was green throughout.
2. **The gate's own table name** (`audit_run_sections`), above.
3. **Seven 404s in part 5's first run.** `requireCronSecret` is deliberately opaque, so a gate run
   with no secret in its environment looks exactly like seven broken jobs. The script now reads
   `CRON_SECRET` out of `.env.local` and refuses to run without it.
4. **`dry_run` was not printed.** The first version showed `calendar-month`'s counts as `sent: 1`
   with nothing to say whether anything had been sent — and Calendar B8's slip was a gate run that
   sent a real email. On a dry run `counts.sent` means *would have been sent*
   (`lib/calendarNotify.ts:344` returns before `emails.send`, read to be sure). The flag is printed
   first now.
5. **My own W2 script read the wrong level of the job's answer** and reported two failures that were
   not the product's: the route spreads its counts at the top level, and the script looked under
   `json.counts`. It printed the whole answer, which is how it was caught — §9a again, in my own
   check.

**E1's spend: $0.00.** The ledger reads 359 calls / $19.09, unmoved from the start of the job,
including the gate's own run of all seven nightly jobs.

---

## E2 — R4: answers that did not finish, or did not fit

Six items, one commit, because five of them meet in two new seams: `lib/answerShape.ts`
(`answerWith`, `finishedCleanly`) and the citation-marker skip in `extractJsonText`.

### S1 · Shared → Audits, Documents — the model's own citation became the answer

Now `lib/ai.ts:548` (`extractJsonText`). Confirmed: `const start = … Math.min(firstBrace, firstBracket)`.

**The whole failure in four lines.** With web search on, the model narrates: *"I'll check the permit's
conditions first.**[1]**"*. `[1]` is the first `[` in the string. The balanced walk ended one
character later. The "JSON" returned was `[1]`. **`JSON.parse('[1]')` succeeds** — so nothing threw,
`lib/auditRun.ts`'s only guard was `if (!obj)`, the array passed it, `shapeFindings` found none of
its fields, and the section was saved **done with zero findings** and emailed as *"found nothing
that needs you"*. A whole agency audit, paid for, recorded as a clean bill of health.

**The fix, and the clause a test forced into it.** An opener whose balanced slice is a citation
marker — `[1]`, `[12]`, `[1, 2]` — is skipped **when there is prose in front of it**, and the search
goes on after it. That last clause is the discriminator: a citation marker is by definition inside a
sentence, so something non-blank always precedes it, while a reply that simply *is* `[1,2]` is an
answer. `tests/unit/documentScan.test.ts` has asserted since Documents Run 2 that `[1,2]` survives
fences and trailing words, and **the first version of this fix broke that test** — which is how the
clause was found rather than reasoned about.

**`stripMarkers` was not used, and the list suggests it.** It deletes `[\d+]` from prose. Over a
whole reply it would delete `"sources": [1]` — a legitimate field in this product's own JSON shapes,
and exactly the same characters. The skip only ever declines to *start* a value at a marker; it never
edits one. That is written into `lib/ai.ts` beside the code.

### A7 · Audits — valid JSON of the wrong shape

`lib/answerShape.ts` `answerWith(parsed, fields)`: a plain object carrying **at least one** of the
fields asked for. Not all of them — a real audit legitimately omits `contradictions` when it found
none, and demanding every key would fail good answers; carrying **none** of several is not an
omission, it is a different document. The fields come from the shaper that will read them, so the
check and the shaping cannot drift:

```ts
const FIELDS = isTemplate ? (['lines'] as const) : KINDS.map((k) => k.field)
```

**It does not unwrap, rename or repair.** A guess at what the model meant is a quiet rewrite of a
regulatory answer, and `CRITIC-PASS.md`'s rule applies — a silent fix destroys the evidence. The raw
text is still kept on the row, and the reason now names what the answer **did** carry, so
`{"result": …}` is diagnosable from the row instead of reading as "a shape we could not read".

### S2 · Shared → Workspace, HR — nobody looked at the stop reason

**E0's open question, answered.** The list says of the chat route *"it passes `stopReason` to the
screen; whether the screen shows it — not checked"*. Checked: `stopReason` appears **nowhere** in the
codebase outside the one line that sends it. The screen did not show it.

So an answer cut off at 16,000 tokens was saved into the conversation as an answer, went into the
summary from there, and was counted as a question answered. `askAI` retries on `max_tokens`;
`askAIOpenStream` does not, so a stream's truncation is final.

`finishedCleanly(stopReason)`: `end_turn` and `stop_sequence` are complete; `max_tokens`, `refusal`,
`pause_turn`, `tool_use`, an unknown reason, and **no reason at all** are not, each with its own
sentence. Four callers act on it:

| caller | before | now |
|---|---|---|
| `app/api/chat/route.ts` | saved the turn, bumped `questions_answered` | still SENDS what arrived — it is the person's — and saves nothing, counts nothing, flags `incomplete` |
| `lib/answerStream.ts` | `done` on any `done` event | `stopped_early`, whose block already says the answer is incomplete, that nothing was saved, and offers Try again |
| `app/api/hr/answer/route.ts` | saved it with a **check record** attached | the same as the chat route |
| `lib/handbookCheck.ts` | stored the piece **done**: `checked_at`, the 90-day date, the email | `fail(…)`, which puts the rows back for a retry |

The chat's new path reuses the page's existing `stopped_early` block on purpose: it is the same thing
one layer down, and its sentence *"Nothing was saved for it"* stays true because nothing is saved.

### H1 · HR — a handbook checked with no text in the prompt

`lib/handbookCheck.ts:295`. The sections read was `const { data: secsRaw } = …`.

**The arithmetic that made it invisible:** a failed read gave `secs = []`, so `mine = []`, so
`whole` was `0 === 0` — **true** — and the prompt told the model it held the entire handbook, with
nothing in it. `CLAUDE.md` §3.3 names the model enumerating from nothing as the known-bad mode; this
handed it nothing and then stored the answer **done**, with `checked_at` set, the next check in 90
days and the "your handbook check is done" email sent.

Now `tryRows`, and `if (!mine.length) fail(…)` by name before the model call — because a handbook
whose sections were deleted between the queue and the claim reads back as zero rows with **no
error** and produces the same empty prompt. `fail` was moved above the input assembly so both guards
can use it.

### W5 · Workspace — researched with no subject, and kept for ever

`app/api/checklist-items/[id]/how-to/route.ts:87`. The checklist read was unchecked, so a failure
sent the model `CHECKLIST TITLE: (none)` and `QUESTION: (none)` — and the answer was **saved and
never redone**, because `:61` returns a stored `howto` without asking anything. One failed read, one
wrong answer, kept.

Both halves closed: the read is checked and the claim released, so a second press pays for a second
try; and a result with **no usable step** is not stored. `checkHowTo` accepts `steps: []` because
every step may be dropped for a link the search never returned — right per step, wrong to keep,
since an empty answer would then show for ever. S2's guard is in this route too, before the parse,
because a truncated answer that happens to parse is the dangerous case.

### HR-read · HR — the HYPOTHESIS, traced

The list says *"a wrong-shape reply becomes `[]` sections; not traced beyond that. E0 traces it."*
**Traced by running it**, in `tests/unit/answerFinish.test.ts`:

```
no anchors → cutAtAnchors returns no cuts
           → sectionsFromCuts falls back to [{ start: 0, title: null }]
           → ONE untitled section holding the entire handbook
           → proveCoverage(text, that) === null   ← it PASSES
```

So the handbook was stored `read`, the page said **1 section**, the long-handbook selection path had
nothing to choose between, and the nightly check had one oversized piece to do in a single call.
Nothing about the handbook's *text* was false, which is why it is not R3 — but *"we read it into one
section"* is still a statement about a call whose answer we did not get.

`modelOutline` now throws on a reply with no `sections` field and on a list whose every item was
dropped, which lands in `readHandbook`'s catch as `could_not_read` with a reason and "Read it again"
— wording HR already shows. **An empty list is still allowed**: `{"sections": []}` is the model
saying a short part has no boundary in it, and that must stay possible; a partial drop is logged
rather than silent.

### E2's proof

| file | tests | fail on the shipped code |
|---|---|---|
| `tests/unit/answerShape.test.ts` | 22 | **5** |
| `tests/unit/answerFinish.test.ts` | 25 | **14** |

Both carry the shipped logic: `oldGuard` is `lib/auditRun.ts`'s `if (!obj)` copied exactly and shows
it accepting `[1]`; the chat group reproduces `sawDone = true` on any `done` event; H1's group
asserts `0 === 0` is true, which is the whole of it.

**Floor 1216 → 1263. No prompt file changed** (`git diff --name-only … -- prompts/` is empty), so no
golden set would move. **Spend: $0.00** — every proof here is free.

**Effects on other sections, by file.** `lib/ai.ts` (`extractJsonText`) is read by the document scan,
the audit, the handbook outline and the checklist path — all four are covered above or by the
untouched-shape tests. `lib/answerShape.ts` is new. `lib/answerStream.ts` is the Workspace's and
HR's shared reader. `lib/handbookCheck.ts`, `lib/handbookRead.ts`, `app/api/hr/answer/route.ts` are
HR's. `app/api/chat/route.ts` and `app/api/checklist-items/[id]/how-to/route.ts` are the Workspace's.
`lib/auditRun.ts` is Audits'. No migration.

---

## E3 — R3: an empty list printed as a statement

The owner's §5 answer (3) holds: **the two prompt wordings are drafted in E6 and NOT applied.** What
E3 ships is the three non-prompt items and D5, which the owner decided.

### A9 · Audits — "nothing needs you" about an audit that never ran

Now `lib/auditNotify.ts:113–122`. `needs_person` is counted from the **findings**, and a run whose
every section hit a rate limit has none — because nothing ran. So the subject read
**"Your Oregon DEQ audit: nothing needs you"**. The body has carried the *"N of M parts of this
audit did not finish"* line all along; the subject is what a person reads in a list of mail, and it
said the opposite.

`auditSubject(summary)` is pure and exported so the wording is testable without a database or a
send:

| state | subject |
|---|---|
| nothing finished | `Your Oregon DEQ audit could not be finished` |
| some finished, some did not | `Your compliance audit: 2 things that need you, and 1 of 4 parts did not finish` |
| some finished, found nothing, one failed | `Your Oregon DEQ audit: 1 of 2 parts did not finish` |
| a clean run | **word for word what it was** — asserted against the shipped function |

"Nothing needs you" is never said when a part never ran: what that part would have found is not
known.

**And the second half, which is worse.** The retry route set the run back to `running` and cleared
`finished_at` — but not `notified_at`. `notifyRun` refuses a run that already has one, and that
guard is right; it is what stops a duplicate. But nothing cleared it, so **the corrected result was
never emailed at all.** A person told "nothing needs you" about an audit whose every part had failed
pressed Run again, it worked, and they heard nothing. One duplicate is recoverable; a correction
nobody is told about is not.

The retry now clears it, checks the write, and counts `retried_parts` on the run's summary through
A2's `patchRunSummary` — carried forward past `summariseRun`'s replacing write, which is exactly
what A2's entry is about — so the second email opens with *"This replaces the email we sent before:
one part of this audit was run again, and the result below is the one that counts."*

### A10 · Audits — "done" was per run, not per agency

`app/api/audits/index/route.ts`. A run is `done` once every section has **settled**, and a section
that could not complete counts as settled (`finishRunIfDone`). So an "audit everything" run where
Oregon DEQ's section hit a rate limit was the newest **done** run for Oregon DEQ — and the page
showed that agency as *"· 0 to look at"* and *"found nothing open"*, from a section that never ran,
**while hiding the findings of the last run that did**.

The sections carry the agency, so they are now read **before** the choice and the test is: did THIS
run finish a section titled this agency? A template run carries no `agency_label` and still appears
for nobody.

**The amber line's own bug was worse than "can never show" — it is why it can't.** `failed` came
from `activeSections`, which is `[]` whenever there is no active run, which is **exactly** when the
line is drawn (`v.failed.length > 0 && !v.activeRun`). The server now names the run that failed this
agency (`last_failed`) and the page reads the failed sections off that run. The line's words are
unchanged.

`components/AuditReport.tsx` was checked and needed **no change**: its `failed` comes from the run's
own sections, and its "Could not complete" section shows each reason with a "Run this section again"
button. The list's reference was to the zip's line 1130, which has moved.

### A14 · Audits — a checklist nobody could read, shown as "done · 0 to look at"

`createRun`'s template branch writes a done run with 0 sections and the note saying why. Both places
the page shows such a run — the landed-checklist line and the run row in the list — now show the
note instead of the count. A run **without** a note still shows its counts, so the note is not a new
empty state.

### D5 · Documents — a gap still open is work still to do (the owner's)

**Migration 079**, and the reason is recorded as the owner's in `DECISIONS.md` §189b with the one
condition that would reverse it.

`display_status` took `needs_work` from the current reading's own status and nothing else, so a
document read twice — the first reading finding a gap, the second finding none — showed **"Current"**
and the batch email listed it under *"On file and nothing to do"*. `open_gap_count` has been on the
view since 049 and already counted every open gap from any reading; **only `display_status` ignored
it.** One branch:

```sql
when coalesce(g.open_gaps, 0) > 0 then 'needs_work'
```

**Where it sits, and why.** After `expired` and `expiring` — an expiry is the more urgent fact and a
date nobody can argue with, so a permit that has run out still says so. Before `current`, `recorded`
and `on_file` — the three branches that were making the false statement. `gaps_found` is untouched,
so **no document that says "Needs work" today stops saying it**: the change can only add the label.

**The view body is 076's, character for character**, with the one branch inserted — built by copying
076's own text rather than retyping it (§9a: copy names from the artifact). A view cannot be patched.

**The verify block tries the rule three ways, and proves its own fixture first:** the open gap makes
it `needs_work`; closing the gap stops it (a branch that could only ever say "needs work" would pass
the first check and be no better than a hardcoded label); and an expired permit with an open gap
still says `expired`. **Its first run failed and was right to:** the probe document was left at
`status = 'uploaded'`, so the CASE's first branch fired and it read `not_yet_read` — the check caught
my fixture, not the rule.

**It moved one real document on staging.** Read off the database after applying it:

```
title       OSHA Form 300A Summary of Work-Related Injuries and Illnesses, CY 2025, Portland Facility
file        10-osha-300a-2025.pdf      kind record      readings 1      open_gap_count 2
before      recorded    ("On file and nothing to do" in the batch email)
after       needs_work
```

The other five `needs_work` documents were already `gaps_found` and did not move.

### E3's proof

`tests/unit/auditWords.test.ts`, 26 tests, **16 of them failing on the shipped files**. `oldSubject`
is the shipped subject copied character for character and shows it emailing "nothing needs you" about
an audit whose every part failed; the clean-run cases are asserted **equal** to it, so A9 cannot have
changed a subject it was not meant to.

**Effects on other sections, by file.** `lib/auditNotify.ts`, `lib/auditRun.ts`,
`app/api/audits/index/route.ts`, `app/audits/page.tsx`,
`app/api/audit-runs/[id]/sections/[sid]/retry/route.ts` — all Audits. Migration 079 changes
`document_index_v`, which **Documents, Audits, the Calendar and the Workspace all read**: the Audits
page and `lib/audit.ts` read `agencies` and `scan_id` (unchanged), `lib/documentBatch.ts` groups the
batch email by `display_status` (which is the point), `app/documents/page.tsx` draws the label, and
`lib/companyLabels.ts` reads `agencies`/`subjects` (unchanged). `lib/database.types.ts` and
`docs/SCHEMA.md` regenerated by `db:migrate`. **Spend: $0.00.**
