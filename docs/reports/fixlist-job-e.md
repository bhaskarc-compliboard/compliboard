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

---

## E4 and E5 — the rest of root R2, the printing, and §4's items

Forty-one items in one commit, because they are one defect in thirty files: `const { data } = …`
with the `error` discarded, and an absence printed as a statement. The sweep is assertable exactly —
`tests/unit/failedReads.test.ts` greps each file for that shape and requires the list to be **empty**
— so this section says what each absence was *saying*, which is the part that mattered.

### C1 · Shared, every section — the most shared item on the list

`lib/companyContext.ts`, **nine reads, none checked.** Every absence renders as a claim: *"State:
not recorded"*, *"(no sites recorded)"*, *"(nothing declared yet…)"*, *"(nothing confirmed yet)"*,
labels *"(none yet)"*, and the dismissed-gaps block simply left out.

That block goes into **five prompts** — Workspace answers, HR answers, the handbook check (kept 90
days), the document scan, drafts, audits — and onto the Company information screen. So a failed read
did not degrade an answer: it told the model, under a heading saying *"treat these as settled"*, that
a company had declared nothing and confirmed nothing, and the model reasoned from that. `CLAUDE.md`
§3.3 names enumerating from nothing as the known-bad mode; this was the one place that could hand it
nothing while looking full.

All nine now throw, so **no model call is made on a context built from a failed read** — the fix the
list asks for, in those words. The screens that must say "couldn't load" instead are D9's, below.

### Audits — A3, A4, A6, A8, A11, A12, A13, A15, O3

| item | what the absence said |
|---|---|
| **A11** | *"None of your documents name an agency yet"* on a specific audit, and an "audit everything" run **finishing, done**, with *"No document on file names an agency yet, so there is nothing to audit."* — to a company holding eleven labels |
| **A3** | *"(none — this company holds no document any reading attributed to this agency)"* and *"(nothing else on file)"*, then the section saved **done** and emailed |
| **A4** | the gaps read is the one that prints *"WHAT THE READING FOUND WRONG WITH IT: nothing"* — **the sentence this whole fix list started from**, in a second place. The other four dropped silently: a permit's conditions, its dates, what the reading expected, the facts waiting |
| **A6** | with no run row, `isTemplate` was false, so a **checklist line was audited as an agency**: no document carries that name, the model saw "(none…)", the section was saved done, and the previous-run link was lost. Four wrong answers from one unread row |
| **A8** | a failed findings read gave every count 0 and an empty `attention` list — and `finishRunIfDone` **wrote that over the summary** (nothing recomputes it) and `notifyRun` emailed it |
| **A12** | `index.txt` in the downloadable zip saying *"(a document this audit cited is no longer on file)"* **for every document** — a file a person hands an inspector |
| **A13** | the drawer saying *"0 documents read"* and *"Nothing was answered."* |
| **A15** | a database error answered as **"not found"** — about the person's own audit, their own finding, their own document |
| **O3** | the `done` write was unchecked, so a failure left the section **running** with its findings already inserted and shown; the recovery re-ran it fifteen minutes later and **inserted a second set**. The duplicate pass cannot help — it collapses across sections, not across two attempts at one. The retry now clears the attempt it replaces, deleting rather than closing: `closed` is the history of a finding that WAS raised, and these were never a finished answer |

A6's guard sits **before** `buildAuditInput`, so nothing is spent on a section that cannot be
audited.

### D6 · Documents — "upload it again" for every storage failure

`lib/storageMiss.ts`, new. `download()` fails for two different reasons and both got the same
sentence: *"Upload it again — the record is here but the file is not."* Right when the object is
gone; **wrong, and expensive, for a timeout, a 5xx, a dropped connection or an expired token** —
the file is there, and the sentence makes a person upload a **second copy**, which then gets read,
appears on the page, and shows the audit two of everything. And a failed reading was written over a
good one either way.

`fileIsMissing` reads `status`, `statusCode` (the REST layer returns it as a string) and the
message, because the Storage client's error shape is not one thing — and **anything unrecognised
counts as unreachable**, the direction that writes nothing. On that branch **no reading is written
at all** and the row goes back to `uploaded` for the next pass.

### Documents — D7, D8, D9, D10, D11, D12, D13, D14, D-two, D15

| item | what the absence said, or did |
|---|---|
| **D7** | the batch summary of **0**, stored, the batch marked done **for good**, and *"We've read your 0 documents. Nothing needs attention."* emailed |
| **D-two** | the `is_current` clear unchecked, so a document had **two current scans** — the view returned two rows and the report's `.maybeSingle()` errored into **"Document not found"** about a document on the page |
| **D14** | a new agency never entered the company's vocabulary, so "audit everything" skipped a regulator the reading had named, silently. Said out loud now rather than thrown: the reading is still valuable |
| **D10, D11** | the scan run on a partial context (re-raising gaps a person dismissed, coining second spellings of agencies); and *"Not seen in the latest reading"* stamped on gaps the reading **did** raise, `open_gap_count` doubled, checklists left attached to replaced findings |
| **D9** | *"Nothing declared yet"*, *"0 waiting"*, *"Merge X … on 0 documents?"* — **and the one that is not a word on a screen:** with the context empty, a proposal that contradicts a settled fact is not lifted out of the queue, so **Confirm all overwrites the settled value**. A failed read turned a review queue into a bulk overwrite |
| **D8** | a failed switch lookup wrote the answer as a plain company fact instead of through `/api/switches/answer`, so the obligation engine never saw it and **the question disappeared**. The person answered; nothing moved |
| **D12, D15** | *"There are no open gaps on this document"* while the drawer listed them; whole sections of the report vanishing under "Needs work"; the to-confirm count 0 and **the sidebar badge gone** — and nobody looks for a queue they are not told about |
| **D13** | the drawer stripped to the reason and *"Upload a clearer copy"* for **every** `could_not_read` document, hiding the last good reading's gaps, dates, facts and checklists. It is now only for a document **nobody has ever read**; otherwise the full view is drawn under the grey line it already has, with "Could not read" still in its Status section |

### HR — H2, H3, H5, H6, H7, H8

| item | what the absence said |
|---|---|
| **H2** | a handbook still listed as *"Reading <handbook>"* with an **empty block** in the prompt — and the model, asked a question against a source that says nothing, answers that the handbook does not cover it. The person is told their own handbook is silent on something it may say plainly |
| **H3** | every current, read handbook in the product looked **never checked**, so each got a full check it did not need, with a **false reason** on it, and its `next_check_at` reset. On production that is the HR model once per handbook, in one night, and it costs money |
| **H5** | *"a site that was removed"* told to the model about every site handbook — and `lib/handbookCheck.ts` stores that sentence **with the check**, so it is still there 90 days later |
| **H6** | *"X has not been checked yet"* about a check that finished weeks ago |
| **H7** | *"No handbooks yet"* and *"Not checked yet"* — one function, read by the rows and the drawer |
| **H8** | the *"N parts could not be checked"* line left out, so an email headed **"Your handbook check is done"** read as a complete check. It now **says** we could not work it out, rather than looking complete — R3's rule: say "not read" when it was not read |

### Workspace and shared — W6, W7, W8, W9, M5, B4, S4

| item | what the absence said, or did |
|---|---|
| **W7** | *"No conversations yet"* in **both** the Workspace and HR, about a company with eighty-six. One function, both sections |
| **W6** | every owed row saying *"Nothing yet. No document has been linked to this requirement."* at once, and *"0 requirements are loaded"* about the library |
| **W8** | the overwrite history lost: with no `priorRow`, the answer was recorded as if nothing had been there before — on the one write whose job is to preserve it (§49) |
| **W9** | the facts-waiting line hidden by `count ?? 0` — which covered **both** an error and a NULL count, and a null count comes back from PostgREST with **no error** |
| **M5** | *"Thank you for your feedback — we read every message."* We did not have it: Resend returns errors, it does not throw. Two more things on the way: `FEEDBACK_EMAIL!` would have sent to `undefined`, and the message was interpolated into HTML unescaped, so a `<` in a sentence ate the rest of it. The words now stay in the box on a failure |
| **B4** | the Company information badge **vanishing**. It stays at "not known" and the nav now says so with a quiet dash, so "nothing waiting" and "we could not look" are different things |
| **S4** | a sweep broken for days finishing green with `companies: 0` — and `lib/jobRun.ts` writes **no row** for a run that found nothing and errored nothing, so it left **no trace at all**. That silence is what `job_runs` exists to prevent |

### 35c · every section — what a printed page carried

One line of CSS each, and the Calendar job was right not to touch it: this changes what Audits, HR,
Documents and the Calendar all print. The sidebar, the mobile overlay and the footer **links** are
now `no-print`; the header already was. A printed audit no longer has *"Dashboard · Audits ·
Compliance Workspace · HR Workspace · …"* down its left edge and *"Privacy Policy · Terms of
Service · Contact"* at the foot, on paper somebody hands an inspector.

**The disclaimer is deliberately still printed** — `AppLayout.tsx` says so in its own comment, and
35c's entry says it must survive any fix. The copyright moved to a `print-only` line beneath it, so
a page a company files still says whose product produced it.

### B10's follow-on — "read on <date>" is the company's day

`formatMoment(iso, tz)` in `lib/calendarDate.ts`. `formatDay` is for a **day string**, which has no
zone and needs none; `document_scans.scanned_at` and `audit_runs.readings_as_of` are
`timestamptz`, and both were formatted with **no `timeZone` at all** — the browser's. B10 settled
the rule for the calendar: a reading taken at 6pm in Oregon is the 8th, and it must read as the 8th
to somebody opening the page from a hotel in Berlin, because the reading happened at the plant.
The same sentence was wrong in two other sections. Both routes now send the company's zone with
their data, so a drawer cannot draw a date before it knows which day it is.

### §4 — O2, O5, O6, O7, O8, O9

**O6 is PROVED, not a hypothesis**, and all three legs were read on the live tree:

1. `app/api/document-scan/route.ts` wrote `status: 'reading'` and **not** `reading_since`;
2. the sweep's recovery filters stalled rows on `reading_since` being earlier than its cutoff — and
   **a less-than never matches NULL**;
3. that route had **no `maxDuration`**, so a 20-to-100-second scan outlived the platform's default
   and was killed.

Together: the platform kills the request, the row says *"Reading…"*, and **nothing can ever recover
it** — the document sticks for ever and its batch never finishes, so the batch email never goes
either. One null column. Fixed on all three legs, and the recovery now also catches a `reading` row
with a NULL claim (gated on `uploaded_at` being old), because a path that forgets that line again
must not be invisible a second time.

| item | what it did |
|---|---|
| **O7** | a refused claim `continue`d and RULE 1 re-selected **the same company's oldest document** on the next line — a tight loop against the database until the ~800-second budget ran out, with nothing in `job_runs` to say why |
| **O8** | the same shape in HR's wait loop, on the one branch with no `setTimeout`, while the person watched a spinner |
| **O9** | an answer that had **not read the conversation** was saved as its next turn — so the transcript showed a reply that had read none of what came before, the summary was built from it, and nobody could tell. It refuses now, **before the model call**: nothing spent, nothing written. The old comment's choice (answer anyway) is reversed deliberately, and the reason is in the code: it was only defensible while the answer was not kept, and it always was |
| **O2** | "Audit again" on a checklist report posted `kind: 'agency'` with a SCREEN LABEL as the agency — so a multi-section checklist re-ran as an audit of every agency (a different, more expensive thing), and a one-section one got a 400 about "All agencies". A template run re-runs as a template run now |
| **O5** | signup created the login first with no way back: either later insert failing left a login with **no company and no profile**, so the person could sign in and reach nothing, and signing up again said *"already registered"*. The order cannot change (`profiles.id` IS the login's id), so what is added is the undo — newest first — and a failed undo names both ids in the log, because that is the one case somebody must clear by hand |

### E4/E5's proof

`tests/unit/failedReads.test.ts`, **46 tests, 41 failing on the shipped tree** — every group.
`uncheckedReads()` is the whole method: it greps a file for
`const { data: x } = … db|admin|supabaseAdmin|supabase …` with no `error` beside it, and the
assertion is that the list is **empty**. That is the defect, stated as a pattern, over eighteen
files; the behaviour of the helpers they call through is proved against fake databases in
`mustRead.test.ts`, `obligationWriterReads.test.ts`, `folderDelete.test.ts`, `auditSummary.test.ts`,
`auditMatcher.test.ts`, `answerShape.test.ts` and `answerFinish.test.ts`.

`fileIsMissing` and `formatMoment` are tested properly rather than grepped: the storage error's
three shapes, and the same instant reading as two different days in two zones.

**What the sweep caught that I had missed.** Its first run failed on **ten** groups, and every one
was a read I had not yet found — including nine in `lib/handbookCheck.ts` alone (the stuck recovery,
the claim, the cancel, the piece's own rows, the live re-read, the night queue's two, and two more),
the ledger polls, and seven ownership probes answering **404** from a failed read. The pattern-level
assertion found them; reading the files had not.

**What the gate's own tooling caught.** `npm run check:schema` refused the first draft of O6's
comment: it reads query-shaped text and attributes it to the last table the file named, so quoting
the sweep's filter inside `document-scan/route.ts` made it report two columns `companies` does not
have. A false report, and a fair one — the comment is reworded and says so.

**Floor 1289 → 1335. No prompt changed. Spend: $0.00.**

---

## E6 — the two prompt wordings, DRAFTED AND NOT APPLIED

**Nothing in this section is in the code.** `prompts/` is untouched by the whole job
(`git diff --name-only 0d1f62e HEAD -- prompts/` is empty), which is also why no golden set would
move. These wait for the owner's yes, per §5 answer 3 and `CLAUDE.md` §3.1.

There are **three**, not two: the list names the A-prompt and D4, and E2's H4 fix created a third
by making a case reachable that was previously a refusal. Each is given as the exact words now, the
exact words proposed, and what else would have to change with them.

---

### Wording 1 · the A-prompt — a document with no readable reading says "nothing"

**Where:** `lib/audit.ts`, `renderAuditInput`, the per-document block.
**Why it is still open:** A3e fixed the main case — a document whose **re-read** failed now shows
its earlier reading's findings. What is left is a document with **no readable reading at all**: a
file uploaded, read once, and that once failed. It has no gaps because nobody ever got any.

**The words now** (`lib/audit.ts:378–380`), for a document with no open gaps:

```
      WHAT THE READING FOUND WRONG WITH IT: nothing
```

**That sentence is not an absence in a prompt — it is a STATEMENT**, and for this document it is
false. The model then reasons about a permit nobody has read as though a reading had looked and found
it clean, which is the more convincing of the two wrong answers.

**The words proposed.** Three cases where there is one today:

```
      WHAT THE READING FOUND WRONG WITH IT: nothing
```
— unchanged, and **only** when a reading succeeded and raised no gaps. That is a real opinion.

```
      WE HAVE NOT READ THIS DOCUMENT. Nothing below is known about its contents. Do not treat its
      absence from your findings as evidence that it complies, and do not treat it as evidence that
      it does not.
```
— when no reading of it has ever succeeded.

```
      WHAT THE LAST READING THAT COULD READ IT FOUND WRONG WITH IT: nothing (read <date>; the
      latest attempt could not read it)
```
— when the current reading failed but an earlier one succeeded and raised no gaps. A3e already
hands the earlier reading's findings through; this is the wording for the case where that reading
found none, which today falls back to the first line and loses the "as of" entirely.

**What else changes with it.** `BuiltAuditInput`'s per-document shape gains two fields the view
already has — whether any reading ever succeeded (`readable_scan_id is not null`) and that
reading's date — and `d.status`/`d.display_status` already carry `could_not_read`, so no new read.
**`prompt_sha256` moves for every audit of a company holding an unread document**, which is the
intended tripwire firing, not a regression.

**Which golden sets would move:** the Audits golden set, and only for fixtures that include an
unread document. Today's fixtures all read, so in practice: none, until one is added — and one
should be.

---

### Wording 2 · D4 — "what this company already holds" is not what it holds

**Where:** `prompts/document-scan.ts:74` and `lib/documentScan.ts`'s `existing` list.
**Why it matters:** this list is what the model answers *"is this a newer version of one of
these?"* against, and what `expected_missing` is written against.

**The words now** (`prompts/document-scan.ts:144–145`):

```
WHAT THIS COMPANY ALREADY HOLDS
${existing}
```

with `existing` built from read documents only, cut at **40 alphabetically** with no "and more", and
`'  (nothing else on file yet)'` when the list is empty.

**Three things are wrong and they compound.** In a folder upload, file 1 is read while 2–N are still
queued — so the model is told the company does **not** hold documents it uploaded in the same
gesture, and writes them into *"What we'd expect and don't see"*. That list is then **frozen at scan
time** and never re-checked (`app/documents/page.tsx` reads `expected_missing` off the scan), so the
page goes on suggesting a document the company filed five minutes later. The cut at 40 does the
same thing silently to a company with more.

**The words proposed:**

```
WHAT THIS COMPANY ALREADY HOLDS
Every document on file, including ones not read yet. A document marked "not read yet" is held by
this company — treat it as present. Do not suggest it as something they are missing.
${existing}
```

with `existing` built as:

```
  - <title> (<kind>)                      ← a document that has been read
  - <file name> — not read yet            ← uploaded, queued, or read and refused
  ...and <N> more on file.                ← when the list was cut
```

and the empty case changed from `(nothing else on file yet)` to:

```
  (this is the first document on file)
```

— because *"nothing else on file **yet**"* reads as a prediction, and on the first upload of a
folder of twelve it is false within the minute.

**What else changes with it.**
1. `lib/documentScan.ts`'s `existing` read takes every `documents` row, not only readable scans,
   and carries `name` for the unread ones. One read instead of one, no new cost.
2. The cut rises from 40 and gains the *"and N more"* line. **40 is not the right number and this
   draft does not pick one** — it is a token-budget question and the owner should see a rendered
   block at, say, 40, 80 and 200 before choosing. Noted as open.
3. **The frozen expected list is a separate fix and does not need a prompt change at all**:
   `app/documents/page.tsx`'s `expectedByDocument` filters each stored title against what the company
   holds *now*. That one can ship on its own, and it is the half that stops a stale suggestion being
   shown. **It is not in this commit either**, because it only makes sense beside the words above —
   if it ships alone, the model goes on writing the entries and the page goes on hiding them, which
   is a rule nobody can see firing.

**Which golden sets would move:** `npm run golden:docs` — every stored document-scan answer, because
the prompt gains two lines and the held-documents list changes shape. `npm run golden:facts` reads
`prompts/checklist` and would not move.

---

### Wording 3 · H4's consequence — two versions, one name

**Where:** `lib/hrAnswer.ts`'s `notUsed` line, which reaches the prompt at `:332`.
**Why it is new:** before E1's H4 fix, a handbook whose new version could not be read produced a
**refusal** — *"None of your handbooks could be read"* — and this line was never rendered. Now the
previous version is used and the unreadable one is named as not used. That is the right behaviour,
and the two versions **share a name**, so the line can read oddly.

**The words now** (`lib/hrAnswer.ts:130–132`, then `:332`):

```
Not included, so not read for this answer: "Employee Handbook" (could not be read: <reason>).
```

— in an answer that also says it read *"Employee Handbook"*. Both sentences are true of different
versions of one document, and nothing says so.

**The words proposed** — one clause, only when the unreadable handbook has a `version_of`:

```
Not included, so not read for this answer: "Employee Handbook" (the newest version, added
<date>, could not be read: <reason>; the version before it was used instead).
```

**What else changes with it.** `HandbookRowForAnswer` already carries `version_of` and `created_at`,
so nothing new is read. The change is one branch in the string that builds `notUsed`.

**Which golden sets would move:** none. HR has no golden set, and `prompts/hr-answer.ts` is not
touched — the words are built in `lib/hrAnswer.ts`. The owner's finish-line test for HR is what
judges it (`docs/TEST-AT-FINISH-LINE.md`).

---

## E0 — the per-section confirmation table, all 54 items

**Every line number in the list had moved.** It was read from the `2026-10-09_0954` zip, which
predates Calendar Job A, and Jobs A, B and C shifted the files since. So no item was confirmed by
its line number: each was confirmed by **behaviour**, at the point in this job where it was reached,
and `scripts/fixlist-confirm.mjs` parses all 54 and prints where each one's code sits now.

**Every item on the list was still true** when it was reached, except the ones Jobs A–C had already
closed. Not one turned out to be a mis-read.

| § | item | sev | section | still true? | where |
|---|---|---|---|---|---|
| R1 | D1 | 1 | Documents | **yes** | E1 |
| R1 | L1 | 1 | Documents → Audits | fixed in A3e, **superseded by D2** | E1 |
| R1 | D6 | 2 | Documents | **yes**, and worse — see D6 | E4 |
| R1 | D13 | 3 | Documents | **yes** | E4 |
| R1 | WA1 | 3 | Workspace | fixed in A3e | — |
| R1 | AR1 | 3 | Audits | fixed in A3e | — |
| R1 | D-two | 2 | Documents | **yes** | E4 |
| R1 | B3 | 3 | Dashboard | fixed in Calendar B3 | — |
| R2 | D3 | 1 | Documents | **yes**, and worse — the folder was **deleted** | E1 |
| R2 | W1 | 1 | Requirements | **yes** | E1 |
| R2 | M2, M1, M3 | 1 | My Account | **yes** | **moved** — §4a |
| R2 | A2 | 1 | Audits | **yes**, and not "small" | E1 |
| R2 | C1 | 2 | **shared, every section** | **yes** — nine reads | E4 |
| R2 | A3, A4, A6, A8, A11, A12, A13 | 2 | Audits | **yes**, all seven | E4 |
| R2 | D7, D8, D9, D10, D11, D12, D15 | 2 | Documents | **yes**, all seven | E4 |
| R2 | D14 | 3 | Documents → Audits | **yes** | E4 |
| R2 | H2, H3, H5, H6 | 2 | HR | **yes**, all four | E4 |
| R2 | W5 | 2 | Workspace | **yes**, both halves | E2 |
| R2 | W6, W8 | 2–3 | Requirements, Workspace | **yes** | E4 |
| R2 | B1, B2 | 2 | Dashboard | fixed in Calendar B3 | — |
| R2 | B2b (35b) | 2 | Landing page | **PARKED by the owner** | — |
| R2 | P1 (35c) | 3 | **the app shell, every section** | **yes** | E4 |
| R2 | M4 | 2 | My Account, signup | **yes** | **moved** — §4a |
| R2 | M5 | 2 | shared | **yes**, and two more faults with it | E4 |
| R2 | A15, W7, W9, H7, H8, B4, S4 | 3 | five sections | **yes**, all seven | E4 |
| R3 | A-prompt | 2 | Audits | **yes** | **E6 — drafted, NOT applied** |
| R3 | D4 | 2 | Documents | **yes**, all three parts | **E6 — drafted, NOT applied** |
| R3 | A9 | 2 | Audits | **yes**, both halves | E3 |
| R3 | A10 | 2 | Audits | **yes**, and the amber line's cause found | E3 |
| R3 | A14 | 3 | Audits | **yes** | E3 |
| R3 | D5 | 2 | Documents | **yes** — **the owner decided it** | E3, migration 079 |
| R4 | S1 | 2 | shared → Audits, Documents | **yes** | E2 |
| R4 | A7 | 2 | Audits | **yes** | E2 |
| R4 | S2 | 2 | shared → Workspace, HR | **yes**, and the screen did not show it | E2 |
| R4 | H1 | 2 | HR | **yes** | E2 |
| R4 | HR-read | 2 | HR | **HYPOTHESIS → traced, and real** | E2 |
| R5 | H4 | 1–2 | HR | **yes**; HR's own decisions do not contradict the fix | E1 |
| R5 | A1 | 1 | Audits | **yes**, all four faults | E1, with O1 |
| R5 | W2 | 1 | Workspace and HR | **yes** | E1, migration 078 |
| R5 | O3 | 2 | Audits | **yes**, and the retry left a second set | E4 |
| R5 | HR-dup | 2 | HR | **yes** | E5 |
| R6 | D2 | 1 | Documents → Audits | **yes** | E1, with L1 |
| §4 | O1 | — | Audits | **yes** — and it is why A1 had never run | E1, with A1 |
| §4 | O2 | — | Audits | **yes** | E5 |
| §4 | O4 | — | My Account | **yes** — the owner has decided it | **moved** — §4a |
| §4 | O5 | — | Signup | **yes** | E5 |
| §4 | O6 | — | Documents | **HYPOTHESIS → PROVED on all three legs** | E5 |
| §4 | O7, O8, O9 | — | Documents, HR, both workspaces | **yes**, all three | E5 |

**54 items parsed; 54 accounted for.** 43 fixed in this job, 5 fixed by Jobs A–C, 5 moved to My
Account's section (§4a), 2 drafted for the owner (E6), 1 parked by the owner (35b). L1 is counted
with D2 and O1 with A1.

### The impact check, per section

Written before the code of each checkpoint, and the per-item effects are under each item above. The
cross-section shape of the job is small, and that is the point of a helper:

| section | files this job changed | what a person there sees |
|---|---|---|
| **shared** | `lib/mustRead.ts`, `lib/answerShape.ts`, `lib/auditSummary.ts`, `lib/storageMiss.ts`, `lib/folderDelete.ts` (all new), `lib/ai.ts`, `lib/companyContext.ts`, `lib/answerStream.ts`, `lib/calendarDate.ts`, `components/AppLayout.tsx` | nothing, until a read fails — then a sentence instead of a false one. And every printed page loses the navigation |
| **Documents** | `lib/documentScan.ts`, `lib/documentBatch.ts`, `lib/companyLabels.ts`, `components/DocumentReport.tsx`, 6 routes, migration 079 | a document with an open gap says "Needs work"; a failed re-read no longer empties its questions; a renamed agency survives; "read on <date>" is the plant's day |
| **Audits** | `lib/audit.ts`, `lib/auditRun.ts`, `lib/auditNotify.ts`, `components/AuditReport.tsx`, `app/audits/page.tsx`, 5 routes | "Audit again" links the runs and carries findings forward; a failed section no longer reads as "0 to look at"; the subject says what did not finish; "Readings as of" is the plant's day |
| **HR** | `lib/handbookSave.ts`, `lib/handbookRead.ts`, `lib/handbookCheck.ts`, `lib/handbookCheckView.ts`, `lib/handbookCheckNotify.ts`, `lib/handbooks.ts`, `lib/hrAnswer.ts`, `app/hr/HrWorkspace.tsx`, 2 routes | a new version does not switch the old one off until it has been read, and the list says which answers a question |
| **Workspace** | `lib/summaryReport.ts`, `lib/topicClaim.ts`, `lib/topicList.ts`, `lib/retention.ts`, `app/compliance/page.tsx`, 3 routes, migration 078 | a summary says how far it read; an answer that did not finish is not saved; turns are not deleted unless a summary covers them |
| **Requirements** | `lib/obligationWriter.ts`, 2 routes | a database hiccup no longer closes every open obligation |
| **Calendar** | — | **nothing.** Job E changed no calendar file |
| **My Account** | — | **nothing**, deliberately — §4a |
| **nightly jobs** | `app/api/jobs/{delete,summarise,scan-documents,audit-sections}/route.ts` | a broken sweep writes a row saying so instead of finishing green |

---

## THE CROSS-SECTION GATE — all eight parts, at the end of the job

| # | section | what was checked | before | after | pass |
|---|---|---|---|---|---|
| 1 | all | `npm run check` after every checkpoint, floor only up | 1128 | **1336** | ✓ 1144→1155→1170→1180→1197→1216→1263→1289→1335→1336 |
| 2 | Calendar | `calendar_events`, `document_deadlines` | 2/3, 40/40 | **identical** | ✓ |
| 2 | Documents | 8 tables | 12/12, 14/14, 25/25, 0/0 + 4 new | **identical** | ✓ |
| 2 | Audits | `audit_runs`, `audit_findings`, `audit_sections` | 0/0, 0/0, 0/0 | **identical** | ✓ |
| 2 | HR | 4 tables | 1/14, 0/83, 0/31, 0/226 | **identical** | ✓ |
| 2 | Workspace | 4 tables | 0/86, 0/221, 0/7, 0/38 | **identical** | ✓ |
| 2 | Requirements | 4 tables | 0/0, 0/16, 205/205, 95/95 | **identical** | ✓ |
| 2 | Company info | `companies`, `entities`, `profiles` | 1/6, 1/7, 1/5 | **identical** | ✓ |
| 2 | Jobs and cost | `job_runs`, `ai_calls` | ERR/42, 12/359 | ERR/53, **12/359** | ✓ job_runs grew by the gate's own runs; **ai_calls unmoved** |
| 3 | HR, Workspace, Documents, Audits, Requirements | shared files, each section's free checks | — | `check`, `check:schema`, `audit:data`, `mutation` | ✓ below |
| 4 | all 8 pages | load and show their rows, `BLOCKED` printed | 8/8 | **8/8**, `BLOCKED (0)` each | ✓ `shots/jobE-gate-*.png` |
| 4 | Calendar, HR, Audits | **as the PRINTER sees them** (35c) | sidebar + links present | **both gone, disclaimer kept** | ✓ `shots/jobE-print-*.png` |
| 5 | all 7 cron jobs | run by hand on the isolated server | 7× 200 | **7× 200** | ✓ |
| 5b | Workspace, HR | **W2 end to end** through the real `/api/jobs/delete` | old rule: cleared | **skip_not_covered**, 3 turns kept | ✓ |
| 6 | all | every email's sender, from the code that sends it | `emailFrom()` | `emailFrom()` | ✓ unchanged |
| 7 | all | `check:live` on 3999 | ok, 62 | **ok, 62** | ✓ |
| 8 | all | which golden sets would move | — | **none** | ✓ below |

### Part 3 — the free checks, re-run and named

- **`npm run check`** — typecheck, `check:schema`, 1336 tests, build. Green.
- **`npm run audit:data`** (Audits) — 0 failed, **4 SKIPPED and it says so**: `company_chemicals` and
  `switch_determinations` hold no rows, so those checks are **untested, not passing**. Unchanged by
  this job and reported as the script reports it.
- **`npm run mutation`** (the resolution engine) — **all nine mutations caught**, every file
  restored, the suite back to 1336.
- **`npm run check:schema`** — green, and it printed its documented blind spot (seven
  `.from(variable)` call sites it cannot attribute). **It also refused a draft of mine**, which is
  in E4's section.

### Part 8 — the golden sets are not re-run, and NONE would move

Checked, not asserted: `git diff --name-only 0d1f62e HEAD -- prompts/ lib/pipelineConfig.ts`
returns **nothing**. `lib/ai.ts` changed, but only `extractJsonText`, and only to **stop** it
returning a citation marker in place of the answer — for a reply whose JSON it already found, the
slice is byte-identical, which `tests/unit/answerShape.test.ts` asserts on five shapes including the
stray-closer case the balanced scan was written for.

So `npm run golden`, `golden:facts`, `golden:docs` and `golden:audit` would all land where they are.

**Three things they would not catch, named rather than left:**

1. **The Audits golden set's `carried` and `closed` were always 0**, because O1 meant the matcher
   never ran. They can now be non-zero for an **agency** re-run. The stored answers do not move —
   but the first real re-audit after this is the first time those two numbers mean anything.
2. **No fixture holds an unread document**, so the A-prompt's case (E6, wording 1) cannot be seen in
   any golden set at all. One should be added with that wording.
3. **E6's wordings, if applied, WOULD move `golden:docs`** — every stored document-scan answer,
   because the held-documents list changes shape. That is named in E6 beside each wording.

### What the gate caught across the whole job

1. **Two stray duplicate files** (`lib/handbookRead 2.ts`, `lib/handbookSave 2.ts`), byte-identical,
   swept into the W2 commit. Found by listing every file the job had touched for part 3 — not by
   `npm run check`, which was green throughout. Removed in `71963a9`.
2. **The gate's own row-count script named a table that does not exist** — `audit_run_sections`; the
   table is `audit_sections`. The same mistake as `topic_messages`, in the same file, and only
   visible because Job C made a null count print `NO TABLE` instead of `0`.
3. **Seven 404s in part 5's first run**: bash does not read `.env.local` and `requireCronSecret` is
   deliberately opaque, so a gate run with no secret looks exactly like seven broken jobs.
4. **`dry_run` was not printed**, so `calendar-month`'s `sent: 1` said nothing about whether
   anything had been sent — and Calendar B8's slip was a gate run that sent a real email. On a dry
   run `counts.sent` means *would have been sent* (`lib/calendarNotify.ts:344` returns before
   `emails.send`; read to be sure). The flag goes first now.
5. **My own W2 script read the wrong level of the job's answer** and reported two failures that were
   not the product's. It printed the whole answer, which is how it was caught.
6. **`npm run check:schema` refused a comment of mine**, reading query-shaped text in it as a real
   query against the last table the file named.
7. **The E4/E5 sweep test found ten groups of unchecked reads I had not located** — nine in
   `lib/handbookCheck.ts` alone — after I had read every one of those files by hand.

---

## WHAT IS LEFT, AND WHY

**Nothing on the list is left unexplained.** Five groups:

### 1. The two prompt wordings — waiting for the owner's yes
**A-prompt** and **D4**, plus a third (H4's consequence) that E2's fix created. All three are in
E6 above, with the exact words now and the exact words proposed. `prompts/` is untouched by the
whole job. **This is the only thing in Job E waiting on a decision.**

### 2. My Account's five — moved, by the owner's own answer
**M1, M2, M3, M4, O4.** `docs/FIX-LIST-FAILURES.md` §4a is new and says what Job E's work bears on
each, so that chat starts from something rather than from the raw list. **O5 was fixed here** and
not moved, because it is one route away from the page and leaving a person with a dead account was
not worth carrying.

### 3. 35b — parked by the owner
Two marketing PNGs saying "overdue" in baked pixels. The owner's decision of 9 October: the landing
page is its own project once every section is done.

### 4. Three things this job found and did NOT do, each with its reason

- **`summary_covers_through` is not on `topic_list_v`**, so the drawers print *"Summarised
  5 January"* over a summary that may stop short of the newest message and say nothing about it.
  Severity 3, and it is a screen; it needs a view migration and a line in both drawers. **For the
  next job that touches those screens.**
- **D4's cut at 40 is not raised to a number.** It is a token-budget question and the owner should
  see a rendered block at 40, 80 and 200 before choosing. Named in E6.
- **`audit_runs.summary` is still read-modify-write**, not `summary || patch` in SQL. The race it
  would close is not live (sections run one after another, and `app/api/jobs/audit-sections` is
  where that is enforced); `lib/auditSummary.ts` is where that fix goes if they ever run
  concurrently, and it says so.

### 5. What is NOT proved by any of this

**Quality.** Every proof in this job is free and mechanical: a fake database, a replay, a file read.
They prove the machinery does what it says. Not one of them says whether an audit's findings are any
good, whether a summary reads well, or whether a handbook check is right — that is the owner's test
on Opus, and `docs/TEST-AT-FINISH-LINE.md` is where it lives. **Job E spent $0.00 and called no
model, which is exactly why.**

---

## THE SPEND

**$0.00.** The ledger reads **359 calls / $19.09** — the same figure it read when Job E started, and
after the gate's own by-hand run of all seven nightly jobs twice over.

```
  TOTAL             359      8620766       279550        240    3253s    $19.09
```

Every proof in this job is free: a fake database that returns an error, a stored real-model answer
replayed through the code that ships, a migration's own verify block, a file read. The one job that
can spend — `calendar-month` — was run with `?dry=1`, and `lib/calendarNotify.ts:344` was read to be
sure that returns before `emails.send`.

**$3 was the cap. Nothing was pushed.**

---

## E7 — AFTER THE FACT: THE FORTY FILES THIS JOB ITSELF COMMITTED BY ACCIDENT

**This is a correction to the record above.** The gate's part 3 found **two** stray duplicate files
and `71963a9` removed them. It did not cover the three commits that came *after* it, and those
added **thirty-nine more**. Twelve more sat untracked in the working tree at the end.

| | |
|---|---|
| **What they are** | `lib/auditRun 5.ts` beside `lib/auditRun.ts`, `app/audits/page 3.tsx` beside `page.tsx`, `app/api/signup/route 2.ts`, `components/AppLayout 2.tsx` — 39 tracked, 12 untracked, 51 in all. |
| **Where they came from** | This job's own proof method. Every fix had to be made to fail on the old code first, so each one stashed or checked out the old file and restored it afterwards; the editor resolved the conflict by keeping both copies and numbering the loser. `git add` took them. |
| **Why nothing went red** | Nothing imports them (`grep` for a ` N` import specifier returns nothing), and Next routes only an exact `route.ts` / `page.tsx`, so they are not routes or pages. `npm run check` was green over all of them, through the whole job. |

**Why it still mattered, in three ways:**

1. **Seven were STALE.** `lib/auditRun 2.ts` was 1398 lines against the live 1546 — a snapshot of the
   code from *before* A1, A2, A6, A8 and O3 were fixed. `lib/ai 2.ts` was pre-S1. A grep for a
   pattern this job removed would have found it, in a file that ships nothing. §189c's own rule: a
   reading not taken from the shipping code is not evidence.
2. **Three tests were sweeping them.** `tests/unit/appShell.test.ts`, `clientImports.test.ts` and
   `fonts.test.ts` walk `app/`, `components/` and `lib/` with `readdirSync`. A stale copy that passes
   a check the live file would fail is a green run that proves nothing — and `clientImports.test.ts`
   is the one keeping `SUPABASE_SERVICE_ROLE_KEY` out of browser code. *(Checked: all three iterate
   inside a single `test()`, so the file set never moved the count — removing files could not lower
   the floor.)*
3. **`tsc` compiled all of it** — 20,150 lines of dead code on every run.

**One more went with them:** `scripts/.tmp-r7-cdp 2.mjs`, a dot-prefixed Chrome-devtools harness
committed by accident on 26 September (`e17858d`), no original, nothing references it, superseded by
`scripts/measure-layout.mjs`.

### The fix is a check, not vigilance

Caught by hand once and missed twice more in the same job, by me, while I knew about it. So:
**`tests/unit/noStrayCopies.test.ts`**, three tests, floor **1336 → 1339**.

- It walks `app`, `components`, `lib`, `tests`, `scripts`, `prompts`, `config`, `supabase`, `hooks`
  and fails on any name matching `/ \d+\.[A-Za-z0-9]+$/` — tracked **or untracked**, since twelve of
  the fifty-one were never committed and were still being compiled and swept.
- It is **proved against a present copy first** (§9a): one test plants a real file named the real
  way in a real scanned directory and fails if the walk goes past it. A second test holds the
  pattern against seven names it must flag and seven it must not (`source-serif-4/OFL.txt`,
  `079_a_gap.sql`, `measure-layout.mjs`).
- Made to fail on the old tree, as every fix in this job was: restoring `lib/auditRun 2.ts` from
  `HEAD` turns it red, naming that file, and the tree without it is green 3/3.
- The planted-copy test asserts `includes`, not an exact list, on purpose — with a real stray also
  present an exact match would have failed saying *"the walk is blind"*, which is the wrong cause.
  That is the same defect this whole job is about, in my own test.

### The gate, for this checkpoint

**Part 1 only, and that is the whole of what applies.** No behaviour changed: 1339/1339 pass, 0
skipped, 0 todo, typecheck and `check:schema` clean, build compiled. The other seven parts have
nothing to check — the database was not touched (no row counts to compare), no page, component,
cron, email or prompt changed, and `prompts/` is untouched so **no golden set would move**. Deleting
a file nothing imports and adding one test file is the entire diff.

**Still $0.00, and still nothing pushed.**

---

# E8 — FOR THE OWNER

**One account of Job E in plain words.** You saw a lot of alarming messages while this ran. Most of
them were the job working — a check refusing something, a test going red on purpose, a script
catching its own mistake. Section 4 below takes every alarming moment one at a time and says whether
anything was actually harmed. The short answer, up front:

> **Nothing was harmed. No customer, no production database, no money, no lost work.** Job E read
> the code, fixed 43 faults, and spent **$0.00**. Everything it changed is on your laptop and on
> staging. **Nothing was pushed.** Two database changes went onto staging only.

---

## 1. WHAT WAS FIXED

**43 items.** Every one is a case where **the product said something that was not true** because a
question to the database came back empty and nobody checked whether it had failed. "No gaps found"
and "we could not look" arrived as the same answer, and the product printed the first one.

### Documents

| item | what could go wrong before | what happens now | commit |
|---|---|---|---|
| **D3** | A count of what was in a folder failed, the failed count read as "empty", and **the folder was deleted** with its contents. | The count has to succeed or the delete refuses and says why. | `4b30a04` |
| **D1** | You pressed "Read it again", the reading service refused, and **every open question that document had raised was withdrawn** — the old reading's findings gone, the new one empty. | The questions to withdraw are chosen before the new reading is saved and withdrawn only after it has been saved. A failed reading withdraws nothing. | `fdbe72a` |
| **D2 + L1** | You renamed an agency label; the next nightly tidy-up read the old name, did not find it, and **deleted the label you had just made**. | The tidy-up reads the same corrected list the rest of the product reads, so a renamed label survives. | `f97721e` |
| **D5** | A document whose reading found a problem, read a second time with no new problem, showed **"Current"** and was listed in the email under "nothing to do" — while the problem was still open. | A document with any open gap says **"Needs work"**. Database change 079. One real staging document moved. | `255fefe` |
| **D6** | Any storage failure — a timeout, a dropped connection — told you *"Upload it again."* So you uploaded a **second copy**, which was then read, shown, and audited as a separate document. | A genuinely missing file still says "upload it again". Anything else says storage could not be reached, **writes no reading at all**, and tries again on the next pass. | `7040f24` |
| **D7** | A failed read of a batch gave a summary of **0**, marked the batch finished **for good**, and emailed *"We've read your 0 documents. Nothing needs attention."* | The batch fails and can be picked up again. No email claims nothing. | `7040f24` |
| **D8** | You answered a question about your company, a lookup failed, and the answer was filed as a plain note instead of as a fact — so the requirements engine never saw it and **the question simply disappeared**. | The lookup has to succeed. Your answer reaches the engine or you are told it did not. | `7040f24` |
| **D9** | On the review queue: *"Nothing declared yet"*, *"0 waiting"* — and worse, **"Confirm all" could overwrite a fact you had already settled**, because the list of settled facts had failed to load and nothing was held back. | Every read is checked; a failed one stops the queue rather than emptying it. | `7040f24` |
| **D10, D11** | A document re-read on half its context: questions you had already dismissed came back, second spellings of agency names were invented, and findings the reading **did** raise were stamped *"Not seen in the latest reading"*. | Those reads are checked, so the reading either has its context or does not run. | `7040f24` |
| **D12, D15** | *"There are no open gaps on this document"* while the drawer on your screen listed them. The to-confirm count showing 0 and **the sidebar badge disappearing** — and nobody looks for a queue they are not told about. | Both say "couldn't load" instead of "none". | `7040f24` |
| **D13** | **Every** unreadable document was stripped back to *"Upload a clearer copy"*, hiding the last good reading's findings, dates and checklists. | That view is now only for a document **nobody has ever read**. Otherwise the full view stays, with "Could not read" in its status. | `7040f24` |
| **D14** | A newly named agency never entered your company's vocabulary, so "audit everything" **silently skipped a regulator** the reading had named. | Said out loud instead of silently, and the reading is kept. | `7040f24` |
| **D-two** | A document ended up with **two current readings**, so the report page errored into *"Document not found"* about a document sitting on the page. | The switch-over is checked, so there is only ever one. | `7040f24` |
| **O6** | A document stuck on *"Reading…"* **for ever**, and its batch never finished, so the batch email never went. Three faults in a row: the row never recorded when the reading started, the recovery sweep could not match a row with nothing recorded, and the request had no time limit so the platform killed it mid-read. | All three fixed, and the sweep now also catches a stuck row with nothing recorded. | `7040f24` |
| **O7** | A nightly sweep that could not claim a document **re-picked the same one on the next line** — a tight loop against the database until its 800-second budget ran out, with nothing recorded to say why. | It moves on, and a run that does nothing still leaves a record. | `7040f24` |

### Audits

| item | what could go wrong before | what happens now | commit |
|---|---|---|---|
| **A1 + O1** | **"Audit again" never actually compared anything.** The button sent the link to the previous audit; the agency branch of the route dropped it. So "carried forward" and "closed" were built, tested, and unreachable — and the four faults behind them would all have switched on at once the moment that one field was restored. | The link is kept, findings are matched to the previous run by kind and title, and **closing happens last**, after everything that can still fail. | `27aedae` |
| **A2** | A failed read of an audit run's own summary **erased the rest of it** — the summary is one record holding several things, it was read, added to and written back, and a failed read wrote back only the new part. | The read is checked and **nothing is written** if it failed; the caller is told. | `7f372d0` |
| **A3, A4** | *"(none — this company holds no document attributed to this agency)"* and **"WHAT THE READING FOUND WRONG WITH IT: nothing"** — the sentence this whole list started from — then the section saved as **done** and emailed. | Those reads are checked. The section fails instead of claiming a clean bill of health. | `7040f24` |
| **A6** | With one unread row, a **checklist line was audited as if it were an agency**: no document carries that name, the model was shown "(none…)", it was saved done, and the link to the previous run was lost. Four wrong answers from one unread row. | Guarded **before** any model call, so nothing is spent on a section that cannot be audited. | `7040f24` |
| **A8** | A failed read of the findings gave every count 0 and an empty attention list — and that was **written over the real summary** and emailed. | Checked. | `7040f24` |
| **A11** | *"None of your documents name an agency yet"* — and an "audit everything" run **finishing, done**, saying there was nothing to audit, to a company holding eleven labels. | Checked. | `7040f24` |
| **A12** | The downloadable zip's index saying *"(a document this audit cited is no longer on file)"* **for every document** — a file you hand an inspector. | Checked. | `7040f24` |
| **A13, A15** | *"0 documents read"*, *"Nothing was answered."*, and a database error answered as **"not found"** about your own audit. | Checked; a failure says it failed. | `7040f24` |
| **A7** | The model returned valid data **of the wrong shape**, nothing threw, no field matched, and the audit was saved with zero findings. | The answer must carry at least one field the reader expects. It is never unwrapped, renamed or repaired — the raw text is kept. | `6df0421` |
| **A9** | An audit whose every part hit a rate limit emailed the subject **"your audit: nothing needs you"**. Nothing had run. | The subject now says what did not finish. The body always did. | `255fefe` |
| **A10** | An "audit everything" run where one agency's part failed made that agency show **"0 to look at — found nothing open"**, hiding the findings of the last run that did work. | The question is now *did this run finish a part for this agency*, read from the parts themselves. | `255fefe` |
| **A14** | A checklist nobody could read shown as **"done · 0 to look at"**. | It shows the note saying why instead of a count. | `255fefe` |
| **O2** | "Audit again" on a checklist report re-ran as **an audit of every agency** — a different and more expensive thing — because a screen label was sent as an agency name. | A template run re-runs as a template run. | `7040f24` |
| **O3** | A failed "done" write left a part **running** with its findings already shown, and the recovery re-ran it fifteen minutes later and **inserted a second set**. | The retry clears the attempt it replaces. | `7040f24` |

### Workspace and Requirements

| item | what could go wrong before | what happens now | commit |
|---|---|---|---|
| **W1** | A database hiccup while working out which rules apply gave an **empty** set — and the engine's contract is *"this is the complete set, reconcile it"*, so an empty set is an instruction to **close every obligation the company has**. | All five reads must succeed, and an empty result with obligations still open refuses outright. | `db75f13` |
| **W2** | A summary recorded **when** it was written but not **how far it read**. A message arriving while the model was working was newer than anything the model saw and older than the stamp — so it counted as covered, the nightly job never summarised that conversation again, **and the cleanup could delete the turn**. | A new column records how far the summary read. Database change 078, 86 of 86 staging conversations backfilled. | `0d09212` |
| **W5** | A how-to answer researched with **"(none)"** as the title and question, then **saved and never redone** because a stored answer is returned without asking again. | The read is checked, the claim released so a second press pays for a second try, and an answer with no usable step is not stored. | `6df0421` |
| **W6** | Every owed row saying *"Nothing yet. No document has been linked"* at once, and *"0 requirements are loaded"* about the library. | Checked. | `7040f24` |
| **W7** | *"No conversations yet"* in **both** the Workspace and HR, about a company with eighty-six. | One function, both sections, checked. | `7040f24` |
| **W8** | The history of what an answer replaced was lost — on the one write whose job is to preserve it. | Checked. | `7040f24` |
| **W9** | The "facts waiting" line hidden, because a count of zero and a count that failed were treated the same. | Told apart. | `7040f24` |
| **O9** | An answer that had **not read the conversation** was saved as its next turn, the summary built from it, and nobody could tell. | It refuses **before** the model call: nothing spent, nothing written. | `7040f24` |

### HR

| item | what could go wrong before | what happens now | commit |
|---|---|---|---|
| **H4** | A new handbook version was switched on and **the old one switched off in the same moment, before the new file had been read**. If that reading then failed, the company's readable handbook was gone from every path that could reach it. | The older version is retired only **after** the new one has been read. | `f6ebdc1` |
| **H1** | A handbook checked with **no text in the prompt** — the failed read gave zero sections, the arithmetic then said "this is the whole handbook", and the model was asked to judge a handbook it had not been shown. Stored **done**, next check in 90 days, "your handbook check is done" emailed. | It fails by name before the model call. | `6df0421` |
| **H2** | A handbook listed as *"Reading <handbook>"* with an **empty block** in the prompt — so the model, asked about a source that says nothing, replies that your handbook does not cover it. | Checked. | `7040f24` |
| **H3** | **Every** current handbook looked never-checked, so each got a full check it did not need, with a false reason on it — on production that is the HR model once per handbook in one night, and it costs money. | Checked. | `7040f24` |
| **H5** | *"a site that was removed"* told to the model about every site handbook — and that sentence is **stored with the check**, so it is still there 90 days later. | Checked. | `7040f24` |
| **H6, H7** | *"X has not been checked yet"* about a check that finished weeks ago; *"No handbooks yet"*. | Checked. | `7040f24` |
| **H8** | The *"N parts could not be checked"* line left out, so an email headed **"Your handbook check is done"** read as a complete check. | It says what could not be worked out. | `7040f24` |
| **HR-read** | A wrong-shaped reply became **one untitled section holding the entire handbook** — the page said "1 section", the long-handbook path had nothing to choose between, and the nightly check had one oversized piece. Traced by running it, not assumed. | A reply with no sections, or one whose every item was dropped, is refused with "Read it again". An empty list is still allowed, because a short part may genuinely have no boundary. | `6df0421` |
| **HR-dup** | A failed delete of a handbook's earlier sections was followed straight by the insert, so the handbook ended up with **two sets of sections** — the model handed the whole handbook twice, the budget spent twice, and a 14-part handbook shown as 28. | The reading fails instead, leaving the earlier sections intact. | `140897a` |
| **O8** | HR's wait loop spinning against the database on the one branch with no pause, while you watched a spinner. | Fixed. | `7040f24` |

### Shared — these touch every section at once

| item | what could go wrong before | what happens now | commit |
|---|---|---|---|
| **the helper** | Nothing. This is the fix underneath 40 of the others: `lib/mustRead.ts` makes checking a read **shorter to write than not checking it**. The rule had been written down for weeks and the list still found forty-odd places breaking it. | — | `4b30a04` |
| **C1** | The most shared item on the list: nine unchecked reads in the block that describes your company. A failure rendered as *"State: not recorded"*, *"(nothing declared yet)"*, *"(nothing confirmed yet)"* — and that block goes into **five prompts** and onto a screen. So the model was told, under a heading saying *"treat these as settled"*, that your company had declared nothing, and reasoned from that. | All nine fail, so **no model call is made on a context built from a failed read**. | `7040f24` |
| **S1** | With web search on, the model narrates *"I'll check the permit's conditions first.**[1]**"* — and `[1]` is valid data on its own. So the citation marker became the answer, nothing threw, no field matched, and a **whole agency audit was saved as a clean bill of health** and emailed. | A citation marker is skipped when there is prose in front of it, and the search continues. | `6df0421` |
| **S2** | Nobody looked at **why the model stopped**. An answer cut off at 16,000 tokens was saved into the conversation as a finished answer, went into the summary, and was counted as a question answered. The screen never showed it. | Only a clean stop counts as finished. What arrived is still shown — it is yours — but nothing is saved or counted, and the screen offers Try again. | `6df0421` |
| **S4** | A sweep broken for days **finishing green** with "0 companies" — and leaving no trace at all, because a run that found nothing and errored nothing wrote no record. | A failure is recorded where somebody can find it. | `7040f24` |
| **M5** | *"Thank you for your feedback — we read every message."* We did not have it: the mail service returns errors rather than raising them. Two more faults alongside: it could have sent to an undefined address, and a `<` in your message ate the rest of it. | Your words stay in the box on a failure. | `7040f24` |
| **B4** | The Company information badge **vanishing** when its read failed. | It stays, with a quiet dash, so "nothing waiting" and "we could not look" are different things. | `7040f24` |
| **35c** | A printed audit carried **"Dashboard · Audits · Compliance Workspace · HR Workspace"** down its left edge and **"Privacy Policy · Terms of Service · Contact"** at the foot — on paper you hand an inspector. | Navigation and footer links do not print, in every section. **The disclaimer deliberately still does**, and the copyright moved beneath it. | `7040f24` |
| **B10's follow-on** | *"Read on <date>"* in Documents and Audits used **the reader's own time zone**, so a reading taken at 6pm in Oregon read as the next day to somebody opening the page from Berlin. | Both send the company's zone. The reading happened at the plant. | `7040f24` |
| **O5** | Signup created your login first. If a later step failed you were left with **a login and no company** — you could sign in and reach nothing, and signing up again said *"already registered"*. | The order cannot change, so what was added is the undo, newest first; a failed undo names both ids in the log, because that is the one case somebody must clear by hand. | `7040f24` |

### Calendar and Dashboard

**Job E changed no calendar file.** Four Dashboard and Calendar items on the list (B1, B2, B3, WA1,
AR1) had already been fixed by Jobs A–C and were confirmed as closed, not re-fixed.

---

## 2. WHAT WAS LEFT, AND WHY

| what | why | who decides |
|---|---|---|
| **The three prompt wordings** (A-prompt, D4, and H4's consequence) | A prompt change is a quality change, and your rule is that those are discussed first (`CLAUDE.md` §3.1). Your own answer 3 said the wording goes to you before it goes in. Section 5 below has each one. | **you** |
| **My Account's five** — M1, M2, M3, M4, O4 | Your answer 4: everything about My Account moves to My Account's own section. `docs/FIX-LIST-FAILURES.md` **§4a** is new and says what Job E's work bears on each, so that chat starts from something. | you, already decided |
| **O5 was NOT moved** | It is one route away from that page, and leaving somebody with a dead account was not worth carrying to another chat. Fixed here. | — |
| **35b** — two marketing images with "overdue" baked into the pixels | Parked by you on 9 October: the landing page is its own project once every section is done. It needs artwork, not code. | you, already decided |
| **"Summarised 5 January" over a summary that stopped short** | Severity 3, and it is a screen, not a wrong statement about compliance. It needs a database view change and a line in two drawers. Left for the next job that touches those screens. | me, recorded |
| **D4's cut at 40 documents** | A token-budget question. You should see a rendered block at 40, 80 and 200 before picking a number. Named in the wording below. | **you** |
| **The audit summary's read-then-write** | The race it would close is not live — audit parts run one after another. The file says where the fix goes if they ever run at the same time. | me, recorded |
| **Whether any of it is any GOOD** | Every proof in this job is free and mechanical: a fake database, a replay, a file read. They prove the machinery does what it says. **Not one says whether an audit's findings are right.** That is your test on Opus, and `docs/TEST-AT-FINISH-LINE.md` is where it lives. Job E called no model at all, which is why it cost nothing. | **you** |

---

## 3. THE CROSS-SECTION TABLE — every section, including the ones Job E did not mean to touch

Row counts were taken **before and after, both as a signed-in customer and as the service role**, so
a change that only a policy could see would still show. "As caller / as service role".

| section | what was checked | before | after | pass |
|---|---|---|---|---|
| **all** | `npm run check` after every checkpoint, floor only up | 1128 tests | **1339** | ✓ 1144→1155→1170→1180→1197→1216→1263→1289→1335→1336→**1339** |
| **Documents** | 8 tables' row counts; page loads; print | 12/12, 14/14, 25/25, 0/0 + 4 new | **identical** | ✓ |
| **Audits** | `audit_runs`, `audit_findings`, `audit_sections` | 0/0, 0/0, 0/0 | **identical** | ✓ |
| **Workspace** | 4 tables | 0/86, 0/221, 0/7, 0/38 | **identical** | ✓ |
| **Requirements** | 4 tables | 0/0, 0/16, 205/205, 95/95 | **identical** | ✓ |
| **HR** | 4 tables | 1/14, 0/83, 0/31, 0/226 | **identical** | ✓ |
| **Company information** | `companies`, `entities`, `profiles` | 1/6, 1/7, 1/5 | **identical** | ✓ |
| **Calendar** | `calendar_events`, `document_deadlines` — **a section Job E did not mean to touch at all** | 2/3, 40/40 | **identical**, and no calendar file changed | ✓ |
| **Dashboard** | page loads with its rows, blocked list printed | loads | loads, `BLOCKED (0)` | ✓ |
| **My Account** | page loads; **deliberately unchanged** (§4a) | loads | loads, no file changed | ✓ |
| **Landing page** | 35b parked; print rules apply to it like everywhere | — | unchanged | ✓ |
| **Signup** | O5's undo, by test; `check:schema`'s account-delete rule | — | undo added | ✓ |
| **all 8 pages** | load and show their rows, with each page's blocked list **printed** | 8/8 | **8/8, `BLOCKED (0)` each** | ✓ `shots/jobE-gate-*.png` |
| **Calendar, HR, Audits** | re-rendered **as the printer sees them** (35c) | sidebar + footer links present | **both gone, disclaimer kept** | ✓ `shots/jobE-print-*.png` |
| **nightly jobs** | all 7 run by hand on an isolated server | 7 × 200 | **7 × 200** | ✓ |
| **Workspace + HR** | W2 end to end through the **real** deleter | old rule: turns cleared | **skipped, 3 turns kept** | ✓ |
| **emails** | every sender, read from the code that sends it | `emailFrom()` | unchanged | ✓ |
| **all** | `check:live` on port 3999 (the free port) | ok, 62 probes | **ok, 62** | ✓ |
| **all** | which golden sets would move | — | **none** | ✓ `prompts/` untouched |
| **cost ledger** | `ai_calls` | 359 calls / $19.09 | **359 / $19.09** | ✓ unmoved |
| **job records** | `job_runs` | 42 | 53 | ✓ grew only by the gate's own runs |

**Four free checks were re-run, not assumed:** `npm run check` (typecheck, schema contracts, tests,
build), `npm run audit:data` (**0 failed, and 4 skipped — it says so: two tables hold no rows, so
those checks are untested, not passing**), `npm run mutation` (**all nine deliberate sabotages
caught**), `npm run check:schema` (green, and it printed its own documented blind spot).

---

## 4. THE ALARMING MOMENTS, EXPLAINED

**Nine things looked bad. Eight were the machinery working. One was a real mistake of mine, and it
is the fifty-one files.**

### a. The 51 numbered copies — `lib/auditRun 5.ts` beside `lib/auditRun.ts`

**What it was.** Forty of them were committed by three of my own Job E commits; twelve more sat
loose in the folder. They came from this job's own method: every fix had to be **made to fail on the
old code first**, so each one put the old file back, proved the failure, and restored the new — and
something duplicated the file each time, numbering the copy.

**Was anything harmed? No.** Nothing imported them, and the web framework only treats an exactly
named file as a page or a route, so **not one of them ever ran**. No customer data, no production, no
money. What they did was lie to a reader: **seven were stale copies of the code from before the
fixes**, so a search for a fault this job removed would have found it in a file that ships nothing.
Three tests that scan folders were also sweeping them — including the one that keeps the database
master key out of browser code.

**What stops it now.** A check, not vigilance — I caught two of these by hand mid-job and missed
thirty-nine more in the three commits after. `tests/unit/noStrayCopies.test.ts` fails the build on
any such file, committed or loose, and it is proved against a planted copy so it cannot pass by
being blind. All 51 are gone; the repository is 20,150 lines lighter. **See item 7 — the cause is
almost certainly iCloud, and that part is yours, not mine.**

### b. "The folder was deleted" (D3)

**What it was.** The list said *"the count is unchecked"*. Reading it showed the consequence was that
the folder **and its contents were deleted** when the count failed. Alarming, and real.
**Was anything harmed?** No — this was found by reading the code, not by it happening to a customer.
It is fixed and has a test that makes the old code delete and the new code refuse.

### c. Migration 079's verify block failed twice

**What it was.** A database change ships with a block that proves its own rule. Mine refused itself
twice. **Both times the fault was my test fixture, not the rule** — once a missing field, once a
document left in the wrong state so an earlier branch fired first. Both are recorded in the
migration itself. **Nothing harmed:** a verify block that fails rolls the whole change back, which is
exactly what it is for.

### d. A commit whose file had not actually changed

**What it was.** One edit aborted halfway, so the file was unchanged while the commit went ahead.
**Caught, re-run, and the commit amended.** Nothing was lost; the commit now contains what its
message says.

### e. An edit of mine broke a working file — and an existing test caught it

**What it was.** Editing the handbook email, I swallowed one line of structure, so a count ran inside
the error branch. **The test suite caught it immediately.** This is the system working.

### f. Seven nightly jobs returning 404

**What it was.** The gate's first run showed all seven jobs failing. **They were not failing** — the
script runs from a shell, a shell does not read the secrets file, and the jobs deliberately refuse a
caller with no secret in a way that looks identical to being broken. The script now reads the secret
and **refuses to run without it**, so "no secret" can never again look like "seven broken jobs".

### g. The run that could have sent a real email

**What it was.** The gate runs the monthly calendar job by hand, and its output said `sent: 1`
without saying whether it was a dry run — and a previous job's slip **was** exactly that, a gate run
that sent real mail. **Nothing was sent:** I read the line in the sending code that returns before
the mail service is called, and the dry-run flag is now printed first in the output.

### h. My own checking scripts reporting false failures

**What it was.** Twice. A script of mine read the wrong level of a job's answer and reported two
failures that were not the product's — it printed the whole answer, which is how it was caught. And
the schema checker **refused a comment I had written**, because it reads query-shaped text and
attributes it to the last table named. **Nothing harmed.** Both are recorded.

### i. A test found ten groups of faults I had already missed by hand

**What it was.** After reading those files by hand, the sweep test found **ten more groups of
unchecked reads**, nine in one file. Alarming to read, and the best news in the job: it is why the
sweep is a test and not a checklist.

**And two more for completeness.** `npm run db:reset` / `db:restore` were **not run** at any point in
Job E — your rule of 4 October. And nothing was ever pushed: the work sits 47 commits ahead of the
remote, for you to look at first.

---

## 5. THE WORDINGS WAITING FOR YOU

Three. **None of them is in the code** — `prompts/` is untouched by the whole job, which is also why
no golden set moves. Full detail, including what else changes with each, is in §E6 above.

### Wording 1 · the audit prompt — a document nobody has read is described as clean

**Where:** the block the audit prompt builds for each document (`lib/audit.ts`).
**Why:** a file uploaded, read once, and that once failed has no findings — because nobody ever got
any. The prompt says the same thing it says about a clean document.

| now | proposed |
|---|---|
| `WHAT THE READING FOUND WRONG WITH IT: nothing` — for every document with no open findings, **including one nobody could read** | **unchanged**, but only when a reading actually succeeded and found nothing. Then two new cases: *"WE HAVE NOT READ THIS DOCUMENT. Nothing below is known about its contents. Do not treat its absence from your findings as evidence that it complies, and do not treat it as evidence that it does not."* — and, when the latest attempt failed but an earlier one worked, *"WHAT THE LAST READING THAT COULD READ IT FOUND WRONG WITH IT: nothing (read &lt;date&gt;; the latest attempt could not read it)"* |

**Why it matters:** the model then reasons about a permit nobody has read **as though a reading had
looked and found it clean** — the more convincing of the two wrong answers.

### Wording 2 · the document-reading prompt — "what this company already holds" is not what it holds

**Where:** `prompts/document-scan.ts`, the held-documents list.
**Why:** this is the list the model answers *"is this a newer version of one of these?"* against, and
what *"what we'd expect and don't see"* is written against. Upload a folder of twelve and file 1 is
read while 2–12 are still queued — so the model is told you do **not** hold documents you uploaded in
the same gesture, and writes them up as missing. That list is then frozen and never re-checked.

| now | proposed |
|---|---|
| `WHAT THIS COMPANY ALREADY HOLDS` then read documents only, cut at 40 alphabetically with no "and more", and `(nothing else on file yet)` when empty | `WHAT THIS COMPANY ALREADY HOLDS` plus *"Every document on file, including ones not read yet. A document marked 'not read yet' is held by this company — treat it as present. Do not suggest it as something they are missing."*; unread files listed by name as `— not read yet`; `...and N more on file.` when cut; and the empty case becomes **`(this is the first document on file)`** |

**Two things for you to decide:** the cut at 40 — **this draft deliberately does not pick a number**,
you should see a rendered block at 40, 80 and 200 first. And **this one would move `golden:docs`**:
every stored document-reading answer, because the prompt gains two lines. That is the tripwire
firing as designed, not a regression.

### Wording 3 · the HR answer — two versions, one name

**Where:** the "not included" line in `lib/hrAnswer.ts`. **This one is new, created by E1's H4 fix:**
before it, an unreadable new version produced a refusal and this line never appeared.

| now | proposed |
|---|---|
| `Not included, so not read for this answer: "Employee Handbook" (could not be read: <reason>).` — in an answer that also says it read *"Employee Handbook"* | `Not included, so not read for this answer: "Employee Handbook" (the newest version, added <date>, could not be read: <reason>; the version before it was used instead).` |

Both sentences are true, of different versions of one document, and nothing says so. **No golden set
moves** — HR has none, and the words are built in code, not in a prompt file.

---

## 6. SPEND, TESTS, AND WHAT IS ON STAGING BUT NOT ON PRODUCTION

| | |
|---|---|
| **Spend for Job E** | **$0.00.** The cost ledger reads **359 calls / $19.09** — the same figure it read when the job started, and the same after the gate ran all seven nightly jobs twice. **No model was called.** Every proof is a fake database that errors, a stored real answer replayed through the shipping code, a database change's own verify block, or a file read. Your cap was $3. |
| **Tests** | **1128 → 1339.** The floor only goes up, and it is committed, so a suite that quietly shrinks fails the build. |
| **On staging, not production — database change 078** | A new column recording **how far a summary read** (as distinct from when it was written). Backfilled **86 of 86** staging conversations. | 
| **On staging, not production — database change 079** | A document with any open gap now reads **"Needs work"**. It moved exactly **one real staging document** (`10-osha-300a-2025.pdf`, 2 open gaps) from "Recorded" to "Needs work". The change can only **add** that label — no document that says "Needs work" today stops saying it. |
| **Also staging-only, from earlier jobs** | Database changes **073–077** (the Calendar jobs). Nothing from 073 onward is on production. |
| **Other staging changes** | The gate's own by-hand runs added 11 rows to the job-record table (42 → 53). No customer-visible row moved anywhere else — every count in section 3 is identical. |
| **Production** | **Untouched.** No query was run against it in this job, read or write. |
| **Git** | **Nothing pushed.** 47 commits ahead of the remote. |

---

## 7. THE ONE CHECK: IS THIS REPOSITORY INSIDE AN iCLOUD-SYNCED FOLDER?

**Read-only. Nothing was changed. The answer is yes, and it explains the numbered copies.**

**The evidence, in the order I found it:**

1. **`~/Library/Mobile Documents/com~apple~CloudDocs/Desktop` exists**, as a symbolic link pointing
   at `/Users/bhaskar/Desktop`. So the real Desktop — and this repository inside it — is reachable
   from inside the iCloud Drive container.
2. **The iCloud daemon is running** (`bird`), and no other sync client is: no Dropbox, no Google
   Drive, no OneDrive, and `~/Library/CloudStorage` is empty.
3. **`brctl status` — iCloud's own status command — names this repository by path.** It lists
   `Under /Desktop/compliboard/.git` and `Under /Desktop/compliboard/.next/...` among the items it is
   trying to upload, and it is **failing**: *"Failed user key sync … Cannot determine iCloud Account
   state"*, last attempt 29.8 hours ago, still marked needs-upload. One of the items it names is a
   **git object** — the internal storage git keeps every version of your files in.
4. **`.git` itself contains 70 numbered copies**, which I have not touched: **`.git/index 2` through
   `.git/index 58`** (57 of them), `AUTO_MERGE 2–10`, and two copies each of the stash references.
   `.git/index` is the file git rewrites on nearly every command — exactly the "rewritten quickly"
   case.
5. **The oldest of them is dated 13 June 2026**, four months before Job E, and they grow with the
   repository (5 KB, then 94 KB, then 119 KB). **So this has been happening quietly since at least
   June, and my job's forty are not a new thing — the stash-and-restore cycles simply gave it forty
   opportunities in one day.**
6. **Ten more numbered copies sit elsewhere on your Desktop**, outside this repository, in folders
   that have nothing to do with code (`Scan 2.jpeg`, `Scan 3.jpeg`). Same pattern, same cause.
7. There are **no `.icloud` placeholder files** in the repository and **no cloud metadata** on its
   files, which is why this needed `brctl` to settle rather than a guess.

**What this means, plainly.** iCloud is trying to sync a git repository, including `.git`. Those
copies are its conflict copies, and the two `CALENDAR-PLAN 2.md` files you saw in chat are the same
mechanism on a document.

**And it has already broken something — found while writing this section, so the paragraph that
first stood here saying "nothing is broken today" was wrong and is replaced.** Two of those copies
are **git references**, and git reads everything in that folder as a reference whatever it is called:

```
$ git log --all
fatal: bad object refs/stash 2          ← the command simply does not run

$ git fsck
error: refs/stash 2: badRefName: invalid refname format
error: refs/stash 3: badRefName: invalid refname format
error: refs/stash 2: invalid sha1 pointer 0000000000000000000000000000000000000000
error: refs/stash 3: invalid sha1 pointer 0000000000000000000000000000000000000000
```

**How bad is it, exactly.** Mild, and worth fixing before it is not. **No commit is lost and no work
is lost** — every ordinary command works (`git status`, `git log`, `git commit`, `git diff`), all 47
commits are present, and the two broken references are copies of a *temporary* stash from this job's
own old-code proofs, whose content was committed properly long ago. What is broken is the family of
commands that read **every** reference: `git log --all` fails outright, and `git fsck` — the command
you would run to ask "is my repository healthy?" — now reports four errors that have nothing to do
with your repository's health. **I have not touched them**, because they are inside `.git` and you
said change nothing. Deleting those two stray files is a two-second job and I will do it on your
word.

That is the point: `.git/index`, the stash references and the packed history are exactly the files a
sync conflict can corrupt, iCloud has already made **70** copies of them, and two of those copies
have already cost you a working command.

**The fix is yours, not mine, and I have changed nothing.** The three usual options, in the order I
would pick them: move the repository out of `~/Desktop` (something like `~/code/compliboard`) and
re-point your editor at it; or turn off iCloud's Desktop & Documents syncing; or rename the folder to
end in `.nosync`, which iCloud skips — the weakest of the three, because it only protects this one
folder. **A git repository should not live in a synced folder at all**, and that is worth doing
before the next long job, because the guard I added catches the copies, not the cause.

**And one honest limit on that guard.** It watches the nine folders that hold code — `app`,
`components`, `lib`, `tests`, `scripts`, `prompts`, `config`, `supabase`, `hooks`. It does **not**
watch `docs/`, the repository root, or anything inside `.git`, which is where your two
`CALENDAR-PLAN 2.md` files and all 70 of the git copies are. Extending it to `docs/` and the root is
a one-line change and I have not made it, because this report was asked for with no code changes.
`.git` should stay outside it either way: those files are git's business, not a test's.

