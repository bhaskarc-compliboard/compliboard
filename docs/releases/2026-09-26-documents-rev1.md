# Documents rev 1 — release note

**Date written:** 26 September 2026
**Target:** production (`dsfwmafnphdlfogetsus`)
**Status when written:** NOT PUSHED. Nothing in this note has been applied to production.
**Last production push:** the deployed code is `origin/main` at commit `fa60e9c`; the last
migration applied is `039_turns_attached_document.sql`, which landed in commit `ede8996`
(23 September). Established by `npm run preflight`, which printed production's 40 applied
migrations in full and subtracted the files on disk, and by `git status -sb`: **21 commits
ahead of `origin/main`**, and a push to `main` is what deploys (`RELEASE.md`).

**`docs/RELEASE.md` is the procedure.** It was added to the repository on the morning of 26
September, after this note was first drafted; §6 below follows it step by step. Two things in
it change what this release has to do, and both are called out where they belong: **migrations
go first, then variables, then the code push** (§6), and **four `AI_MODEL_*` variables are set
on Vercel Production**, which contradicts `CLAUDE.md` §3.4a and makes the scan's production
model something the owner must read off the dashboard rather than something this note can
state (§3).

---

## 1. Commits since the last production push

Forty-one, oldest first. The first twenty-one are the layout pass and the cost-ledger work that
preceded Documents; the rest are Documents Runs 1 to 7.

| Commit | |
|---|---|
| `47bba7e` | Documentation refresh for the production state — and two named handoffs are not on disk |
| `f6652db` | Frame 1/3: no emoji in the shell, and Feedback loses its box |
| `359ce11` | Frame 2/3: identity moves to the header, and the sidebar is nav only |
| `3cc6212` | Frame 3/3: the agreed fonts and colour tokens are in the code |
| `c0602f6` | Opening state of /compliance: five sizes, buttons that look pressable, a footer at the bottom |
| `e71bd43` | Opening state round 2: the disclaimer joins the frame, the box holds its own examples |
| `f7a5ec3` | Opening state round 3: one column width, and attach stops pretending to be an outcome |
| `b4c2534` | Opening state round 4: 775 as a literal, because the token silently did nothing |
| `5b4d8a9` | Conversation view 1/3: the answer leaves its box, the question gets a shape |
| `dedfb41` | Conversation view 2/3: the answer is finally in the serif it was loaded for |
| `4a21d84` | Conversation view round 2: the composer is part of the page, not a bar over it |
| `b1f8118` | Conversations and Checklists lists: delete stops hiding, colour stops lying, the day stops repeating |
| `d7ca3fb` | Rows look clickable, and the scrim covers the header |
| `7e5697e` | Checklist drawer: rows instead of cards, and one column of checkboxes |
| `7950b99` | List density: 14px medium titles, tighter rows |
| `f1b0e1d` | List row titles: 13px, regular weight |
| `0012212` | DESIGN.md: the layout template, and the debt it does not yet describe |
| `9887b71` | The two handoffs exist: correct the docs that said otherwise |
| `ef2cf23` | Build on Haiku, and stop micro-steps buying themselves on every page load |
| `fad69ad` | TESTING.md: the manual set for the layout pass |
| `fa60e9c` | The composer grows with what you type |
| `a2d182c` | Measurement only: the document scan and date extraction write cost rows |
| `9fb8dfb` | Documents Run 1: the scan and its contract |
| `b3ef548` | The JSON extractor only trimmed narration BEFORE the object — one character, three 500s |
| `1fecd1a` | Golden documents: render the fixtures, judge them, and stop billing refused searches |
| `02f5e87` | Machinery: recover the answers we were throwing away, and say which number is which |
| `1ad883e` | Documents: the page's upload now runs the new scan, and one view carries the row |
| `230694e` | Documents: the page reads the scan — one table, folder filters, group by anything |
| `54e76ce` | Documents: corrections outrank the scan, and the date on the row is chosen in code |
| `d5c49d6` | Documents: the report drawer — the whole reading of one document, and the freedom to disagree |
| `e8fb422` | Documents: the date is computed when read, and the schema for what a person does next |
| `a5aad2d` | Documents: a checklist from a gap, a draft, research from a gap, and one queue to confirm |
| `5d5213c` | Documents: a confirmed fact is stored once, and an attachment is visible |
| `aad7d4e` | Documents: one number for a checklist's progress, not two |
| `e8cc2d3` | Documents: a quote can be checked against a PDF, and a gap knows what it replaces |
| `5745460` | Documents: one reading for a file however it arrives, and one question per fact |
| `b1730b4` | Documents: the three seams the tests found |
| `dc869fb` | Documents: deleting a file, and headings that say what kind of thing they name |
| `43df580` | Documents: an upload is a row, and many files are read in the background |
| `c7af767` | Documents: the page waits truthfully, and the upload is answered once |
| `2eb8282` | Documents: the four things the sweep's own tests found |

---

## 2. Migrations 040 to 054, and what their verify blocks do to production data

Fourteen pending, plus `054` added by this preflight (§4 below). **Every one of them runs a
`DO` block that writes rows and then removes them.** That is worth stating plainly because
these run against live customer data, so the table below records, per migration, *whose*
company the probe rows are attached to and whether they are removed inside the same
transaction.

**Two facts that apply to all fourteen, established by reading the files rather than
remembering them:**

1. **040 to 051 attach their probe rows to an EXISTING company** — `select id into co from
   public.companies limit 1`, with no `ORDER BY`. On production that is an arbitrary real
   customer. For the duration of the transaction that customer's company gains a document
   named `migration-0NN-probe.pdf` (or a topic named `migration-0NN-probe`), and loses it again
   before the transaction commits. **052, 053 and 054 create their own throwaway company
   instead**, which is the better pattern and is the one to copy.
2. **A `DO` block is a single statement, so an unhandled exception inside it rolls back
   everything it wrote**, whether or not the file opens a transaction. The probe rows therefore
   cannot survive a failure; they can only survive a *successful* run that forgot to delete
   them, and the Removes column below is the check for that.

| # | What it does | Writes probe rows? | Removes them in the same transaction? |
|---|---|---|---|
| 040 | Five new tables (`document_scans`, `document_gaps`, `document_conditions`, `document_deadlines`, `company_labels`); `documents`, `fact_proposals`, `calendar_events` extended; `ai_calls.task` gains `document_scan` | Yes — a document, scan, gaps, proposals, a topic and an `ai_calls` row, on an **existing** company | Yes, explicitly: the document is deleted (scans, gaps, proposals cascade), the topic is deleted, the `ai_calls` row is deleted by model name. The one `company_labels` insert is inside a block expected to *fail*, so no label is ever written. **⚠ This is the only one of the fourteen with no `begin;`/`commit;` of its own** — its DDL is not wrapped, so a failure part-way leaves the schema half-changed |
| 041 | `document_gaps.basis` and `fact_proposals.basis` — read or inferred | Yes — document, scan, gaps, proposals, on an existing company | Yes — deletes the document; gaps, scan and proposals cascade |
| 042 | `document_scans.cited_sources` split from `searches`; the two were one column under the wrong name | Yes — document and scan, existing company | Yes — deletes the document, cascading the scan |
| 043 | `document_index_v`, one row per document joined to its current scan, folder and site | Yes — document, scan, gaps, existing company | Yes — deletes the document |
| 044 | The view reports `could_not_read` for a document with no scan row at all; a conclusion beats an absence | Yes — one document, existing company | Yes — deletes the document |
| 045 | `document_corrections`; the view prefers the newest correction field by field | Yes — document, scan, several corrections, existing company | Yes — deletes the document; corrections cascade |
| 046 | `fact_proposals.rejected_reason` | Yes — a topic and a proposal, existing company | Yes — deletes the topic; the proposal cascades |
| 047 | `fact_proposals.quote_verified`, where null is not false | Yes — a topic and three proposals, existing company | Yes — deletes the topic |
| 048 | Only a date whose kind is `expiry` may make a permit read Expired | Yes — document and scan, existing company | Yes — deletes the document |
| 049 | `significant_date` computed at read time in the view; the stored columns dropped | Yes — document, scan, several deadlines, a correction, existing company | Yes — deletes the deadlines, then the document |
| 050 | `checklists.document_id`/`document_gap_id`; drafts on `document_gaps`; `company_facts`; `ai_calls.task` gains `document_draft` | Yes — the widest probe: document, scan, gap, checklist, checklist items, `company_facts`, topic, proposals, `ai_calls`, existing company | Yes — and it has to be explicit: `checklists.document_id` and `company_facts.source_document_id` are **SET NULL**, not cascade, so deleting the document would have left both behind. Both are deleted by name |
| 051 | `fact_proposals.affects` | Yes — a topic and a proposal, existing company | Yes — deletes the topic |
| 052 | `document_scans.extracted_text`; `document_gaps` gains `superseded` and `superseded_by` | Yes — on its **own** throwaway company | Yes — deletes the company, which cascades everything |
| 053 | `document_batches`; `documents.batch_id` and `reading_since`; `fact_proposals` gains `withdrawn`; `document_gaps.not_seen_at`; `job_runs.job` gains `scan_documents` | Yes — on its **own** throwaway company, plus one `job_runs` row | Yes — deletes the `job_runs` row by name and the company, which cascades the rest |
| 054 | The documents already on production are set to `held` and will not be swept (§4) | Yes — on its **own** throwaway company | Yes — deletes the company |

**054 also changes existing production rows, and it is the only one that does.** The other
fourteen add and remove their own probes; 054 deliberately updates every `documents` row whose
status is `uploaded`. That is the point of it.

---

## 3. Environment variables

| Variable | Production needs it? | Notes |
|---|---|---|
| `AI_MODEL_DOCUMENT_SCAN` | **No — leave unset** | Optional. Unset falls back to **the judgement tier**, and see the conflict below: what that resolves to on production is not knowable from this repository. Local builds point it at Haiku (`CLAUDE.md` §3.4a) |
| `AI_MODEL_DOCUMENT_DRAFT` | **No — leave unset** | Optional. Unset falls back to the prose tier |
| `AI_SCAN_STRUCTURED` | **No — leave unset** | Default is on. Only the exact string `false` turns the JSON schema off; the prose path loses about one answer in five to an unparseable brace (Documents Run 2b). It exists so the two can be compared, not as a switch to throw |
| `NOTIFY_TEST_TO` | **NO — MUST NOT EXIST** | Staging only. If it is set on production, **every customer's batch email goes to that address instead of to them.** Check it is absent before the push and after |
| `NEXT_PUBLIC_APP_URL` | **YES — NEW, AND THE PUSH IS NOT DONE WITHOUT IT** | The site's public origin, no trailing slash, e.g. `https://app.compliboard.com`. It is the only source of the link in the batch email. Unset does not produce a bad link — it **refuses the send** and logs why; the banner still carries the summary |
| `CRON_SECRET` | **Already present** | Unchanged. The sweep uses the same `x-cron-secret` header check as the two nightly jobs, and `lib/jobAuth.ts` refuses every request when the secret is unset rather than opening the route |
| `RESEND_API_KEY` | **Already present** | Unchanged — the same key `/api/feedback` uses. The batch email is plain text through the same wiring |
| `DEV_MAX_SEARCHES` | **No — must stay unset** | Caps `web_search.max_uses` whenever `NODE_ENV` is not production. It has no effect on production and should not be set there |

`AI_MODEL_DOCUMENT_SCAN`, `AI_MODEL_DOCUMENT_DRAFT`, `AI_SCAN_STRUCTURED` and
`NEXT_PUBLIC_APP_URL` were added to `.env.example` by this preflight; three of the four existed
in code and had never been written down.

### ⚠ Two documents disagree about production's models, and the scan's model depends on it

`RELEASE.md` lists `AI_MODEL_PROSE`, `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS` and
`AI_MODEL_SUMMARY` among the nine variables **set on Vercel Production on 23 September**.
`CLAUDE.md` §3.4a says the opposite in as many words: *"Production is untouched by this: those
variables are UNSET there, so it runs the code defaults."*

They cannot both be right, and the scan resolves as:

```
AI_MODEL_DOCUMENT_SCAN  ||  AI_MODEL_JUDGEMENT  ||  AI_MODEL  ||  'claude-sonnet-4-5'
```

So **what model reads a customer's document on production is not knowable from this
repository.** If `AI_MODEL_JUDGEMENT` is set to Haiku on Vercel — which is what it is set to
locally — every scan in this release runs on Haiku, and this note's cost figures and the smoke
test's model assertion are both wrong.

**Before the push: open the Vercel dashboard, read the value of `AI_MODEL_JUDGEMENT`, and
correct whichever of the two documents is out of date.** Smoke test step 6 asserts against
whatever that value turns out to be, not against an assumption.

---

## 4. `vercel.json`

One line added:

```json
{ "path": "/api/jobs/scan-documents", "schedule": "*/5 * * * *" }
```

Every five minutes, the most frequent Vercel Pro allows. **An empty run costs almost nothing:
measured five times warm on staging at 88, 89, 102, 106 and 158 ms** — one indexed query
against `idx_documents_queued` (partial, `where status = 'uploaded'`) plus one `job_runs` row.
At 288 runs a day that is about **30 seconds of function time daily**. The first run after a
deploy was 224 ms, cold.

The two existing crons are unchanged: `summarise` at 03:00, `delete` at 03:30.

---

## 5. What changes for a person on production, the moment it deploys

- **The Documents page is new.** One table, filtered by folder or site, grouped by status,
  agency, subject, kind, site or folder. Clicking a row opens the report drawer: what the
  document is, what it says, what is wrong with it, the dates it sets, the conditions it
  imposes, the facts it proposes, and how sure we were.
- **The Review button is gone.** A file is read once, on upload, by the scan — whichever door
  it comes in by, the Documents page or the conversation attach. The old review path still
  exists for the audit engine and the dashboard's review list; nothing in the product POSTs to
  it any more.
- **Dates come from the scan.** The separate date-extraction call is gone from the page. A
  document's dates are read out of it with the line they came from, and go to the calendar on
  the person's say-so.
- **A new sidebar item, "To confirm", with a count.** Facts the scan reads are proposed, never
  written. Nothing about a company is recorded until somebody says so.
- **Uploads of four files or more go to the background** and are answered by one email and one
  banner. Three or fewer are read in the page as before.
- **The 38 documents already on production will NOT be read.** They are set to `held` by
  migration 054 and show as *"Not read yet — press Add files to read new ones, or open this and
  press Read it again."* Nothing is spent on them and no email goes out about them until
  somebody asks for one. This was the owner's choice, taken at preflight; the alternative was
  about $6–11 and forty minutes of sweep.

---

## 6. Preflight, and the procedure `RELEASE.md` sets out

### The one rule, and the one place this release strains it

> **Migrations first, then variables, then code.** Every migration is additive, so the old code
> ignores new tables and nothing changes for customers when a migration lands.

Fourteen of the fifteen are additive in exactly that sense. **054 is not** — it runs
`update public.documents set status = 'held'` against live rows. So between step 2 and step 5
production runs the *old* code against 38 documents carrying a status the old code has never
seen.

**That is safe here, and it was checked rather than assumed.** `documents.status` is added by
migration 040, so it does not exist on production today; and the deployed tree
(`origin/main`, `fa60e9c`) reads it nowhere — `git grep status origin/main -- app/documents/page.tsx`
returns nothing, and every `status` in the deployed API routes is an HTTP code. The column is
created by 040 with `default 'uploaded'` on all 38 rows and flipped to `held` by 054, and
nothing deployed looks at it in between.

### The three things that must be true before a release

| | |
|---|---|
| 1. `npm run check` green | **Yes** — `check-schema-contracts: ok — 171 files, 44 relations (42 tables + 2 views)`; `test-guard: 509 tests, 0 skipped, 0 todo, floor 509`; `Compiled successfully` |
| 2. `npm run check:live` on staging with every pending migration applied | **Ran. Green on production's configuration; 2 failures on the local build tier** — see below |
| 3. The owner's manual tests from `docs/TESTING.md` for this feature | **Owner's to do.** The Documents sets are in `TESTING.md`: Run 5's ten, Run 6's six plus three addendum, Run 7's seven |

### `check:live` — what it actually said

Against staging with all 55 migrations applied, on the laptop's own configuration
(`AI_MODEL_* = claude-haiku-4-5`, `DEV_MAX_SEARCHES=2`):

```
✓ switch_determinations  authenticated can write   ✓ anon refused (42501)
✓ topics                 authenticated can write   ✓ anon refused (42501)
✓ company_chemicals      authenticated can write   ✓ anon refused (42501)
✓ research · ✓ checklist · ✓ conversation · ✓ reload · ✓ continue · ✓ counters · ✓ stop
✓ convert discussed · ✓ convert complete
✓ attachment/scan   read as "policy" · "Harbor Kitchen — Ballard Employee Handbook
                    Addendum…" · needs_work
✗ attachment/tier   tier 2 named: NO · headcount (56, or 25 and 31): NO
✗ attachment/errors named 3 of the policy's errors, needs 5
✓ attachment/persist · ✓ topic GET · ✓ summarise · ✓ topic DELETE · ✓ history
check:live FAILED — 2 problem(s).
```

**Every tenancy, grant, policy and wiring assertion passed**, which is what this gate exists
for — §63 and §80 were a missing grant and a missing policy. The two failures are assertions
about the *quality* of a research answer.

**So the same step was re-run with the `AI_MODEL_*` variables unset and no search cap — that
is, on production's own configuration:**

```
✓ attachment/scan    read as "policy" · "Harbor Kitchen — Ballard Employee Handbook Addendum…"
✓ attachment/tier    Tier 2, counted across both locations (25 + 31 = 56)
✓ attachment/errors  named 6 of 7: 30-day card window, 180-day waiting period, 24-hour
                     carryover, find-your-own-cover, tip credit, the minimum wage figure
✓ attachment/persist turn 1 carries "Harbor-Kitchen-Employee-Policy-2026.pdf"
```

**All four pass.** The two failures were an artefact of the Haiku build tier and
`DEV_MAX_SEARCHES=2`, exactly as `CLAUDE.md` §3.4a predicts ("use the expensive model when the
question is *is this answer any good*"). They were carried as an open item through Runs 6 and 7
and this settles them.

*It also depends on the conflict in §3: if `AI_MODEL_JUDGEMENT` really is set to Haiku on
Vercel, then production's configuration is the first run, not the second.*

### The rest of the preflight

| Step | Result |
|---|---|
| `npm run preflight` (read-only, production) | **Pass.** Printed production's 40 applied migrations and the 54 then on disk in full, derived `PENDING COUNT: 14`. Nothing applied. **Re-run it after 054 and expect 15** |
| From-zero chain, `000` → `054` | **Pass.** Replayed against an emptied staging schema; 55 migrations recorded, `max(version) = 054`, `EXIT=0`. Types and `docs/SCHEMA.md` regenerated: 42 tables, 30 enums, 7 functions, 2 views, 16 triggers, 55 migrations |
| `npm run db:restore` | **Pass**, `EXIT=0` — staging left usable |
| `npm run golden:docs -- --seed-only` | **Pass** — three companies with their sites. No document uploaded, no model called |

### A note on how the from-zero result was established

Twice during this work `npm run db:reset` **appeared to run and did nothing**: the pty
automation never matched the confirmation prompt, the command sat there, and the only way to
tell was to query `supabase_migrations.schema_migrations` afterwards. Both times the result
above was taken from the database, not from the command's exit. A release note that said "the
chain builds from zero" on the strength of a command that never typed RESET would be exactly
the failure `HOW-WE-BUILD.md` §3 is about.

### The procedure, with this release's specifics

1. **`npm run preflight`.** The pending list must be exactly `040` … `054`, fifteen files, and nothing else. If it names anything unexpected, stop.
2. **`npm run db:migrate:prod`**, type `PRODUCTION`. Fifteen migrations. Expect the notices each verify block raises; the ones that matter are `MIGRATION 052 OK`, `053 OK`, `054 OK`. It regenerates `lib/database.types.ts` from production afterwards.
3. **Variables.** One new one is **required**: `NEXT_PUBLIC_APP_URL`, the site's public origin with no trailing slash. It is a `NEXT_PUBLIC_*` variable, so it is **inlined at build time** — it must exist on Vercel *before* the push that builds the new code, which is why this step comes before step 5 and not after. While you are there: **read `AI_MODEL_JUDGEMENT`** (§3) and **confirm `NOTIFY_TEST_TO` does not exist**.
4. **`git status --porcelain && npm run typecheck`.** Commit `lib/database.types.ts` if step 2 changed it.
5. **`git push`.** 21 commits. Watch Vercel until green.
6. **Prove it on the live site** — §7 below is that step, written out for this feature.

### Release gates still owed (from `RELEASE.md`, unchanged by this release)

- Credential rotation (`docs/HANDOFF-CODE.md`, `TODO.md`).
- The privacy-policy line stating that transcripts are cleared 7 days after summarising.

Neither is introduced or resolved by Documents rev 1.

---

## 7. Smoke test, to run on production after the push

This is `RELEASE.md` step 6 — "prove it on the live site" — written out for this feature. Ten
minutes, in order. Stop at the first one that fails.

1. **Upload one golden fixture** through the Documents page — `tests/golden/documents/fixtures/01-eap-chemical.pdf` is the one with known planted gaps. One file, so it is read in the page.
2. **Watch the row.** It should go **Queued → Reading… → Needs work**, with the status changing while you look at it. If it sits on Queued, the scan route is not being reached; if it sits on Reading…, the scan is running or has been killed.
3. **Open the drawer.** It should show the kind, the agency, the date that matters, a summary in the serif, and a list of gaps with citations. The footer should offer *Open the file*, *Read it again*, *Download* and *Delete this file*.
4. **Confirm one fact.** In *Facts we found, please confirm*, press **Confirm** on one. The message should say either "Confirmed" or "Confirmed, and recorded against the question it answers."
5. **Check the To confirm count.** The sidebar should carry a number, and it should be one lower than before step 4. Open the page: three at a time, with the ranking line printed.
6. **Check the ledger.** `select task, model, input_tokens, output_tokens, searches, cost_usd from ai_calls order by created_at desc limit 3` — there should be exactly one new `document_scan` row, and **its model must equal whatever `AI_MODEL_JUDGEMENT` is set to on Vercel** (§3: two documents disagree about whether it is set at all). If that variable is absent the answer is `claude-sonnet-4-5` and the row should cost roughly $0.15 — 29k in, 3.5k out and about one search, measured. If the row says `claude-haiku-4-5` and you expected Sonnet, a build variable has leaked; if it says Sonnet and you expected Haiku, `CLAUDE.md` §3.4a is the document that is out of date.
7. **Check the sweep ran.** Within five minutes: `select job, started_at, finished_at, ok, counts from job_runs where job = 'scan_documents' order by started_at desc limit 1`. There should be a row, `ok = true`, `finished_at` set, and `counts` showing zeros — it has nothing to do, because the 38 are held.
8. **Check the 38 are still held.** `select status, count(*) from documents group by status` — 38 `held`, one `read` (the fixture), nothing `uploaded`.
9. **Check no email went out.** `select id, notified_at from document_batches order by created_at desc limit 3` — the fixture's batch should be `done` with `notified_at` **null**, because one file is the live path.
10. **Check `NOTIFY_TEST_TO` is absent** from the production environment. If it is set, every customer's batch email goes to that address.

### If something is wrong

Nothing in this release deletes or rewrites a customer's data except migration 054's status
update, and that is reversible with `update documents set status = 'uploaded' where status =
'held'`. The Documents page reads a view; the old tables are untouched. The fastest rollback is
to redeploy the previous build — the migrations can stay, because every one of them only adds.
