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
