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
