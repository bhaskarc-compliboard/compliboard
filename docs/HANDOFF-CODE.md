# Handoff — the state of the code

**State sections rewritten 28 September 2026, after Documents rev 1 shipped to production. Every
figure below came from a command run today, and the command is shown.** Nothing is from memory.
Where a figure is not measured, it says so.

*(§1 and §2 corrected 3 October 2026, from commands run that day and the 1 October preflight; §7
gained four rows the same day, after Workspace Task 3 one open row (the cron jobs) and seven
resolved ones, and after Task 4 two more resolved. After Task 5 (`cfa3738`), §7 gained four open rows and two
resolved ones, and §2's heading was corrected to 063 pending. On 4 October 2026, after the Task 6
release, §1 and §2 were brought to that day's `git` and `npm run preflight` output and §7's Task 6 rows
marked released. §1–§4 were rewritten on 28 September. §5–§9 keep their 23 September text except where a fact in
them was wrong; those carry dated notes. The structure is unchanged on purpose — this is the file
the next chat trusts, and a reader who knows where §6 is should still find it there.)*

**If you are the next chat: read `CLAUDE.md` first (especially §9a), then `HOW-WE-BUILD.md` §11
and §12, then `docs/SCHEMA.md` for the database. This file is state, not method.**

> ### BOTH HANDOFFS ARE FINISHED. THE WORK THEY BRIEFED IS ON PRODUCTION.
>
> *(Corrected 28 September 2026. This banner used to say §8 had not been reconciled with them.)*
>
> `docs/archive/HANDOFF-LAYOUT.md` (the layout pass, finished 24 September) and `docs/archive/HANDOFF-DOCUMENTS.md`
> (the Documents section, released 26 September) are both **marked completed at the top** and kept.
> Neither is a live instruction.
>
> **Current instead:** `docs/VISION-DOCUMENTS.md` for the module's purpose, `docs/DESIGN.md` §3 and
> §6 for the layout template and file structure, `docs/RELEASE.md` for what Vercel holds,
> `docs/INVENTORY-2026-09.md` for every file's state and who calls what.

---

## 1. Git

> ### UPDATED 4 OCTOBER 2026, AFTER THE WORKSPACE TASK 6 RELEASE.
> ```
> $ git fetch && git log --oneline -5                  # 4 October 2026
> a701436 Workspace Task 6 docs: decisions (§157), handoff v5, the Task 6 test set, resolved and open defects
> eec4d22 Workspace Task 6: the checklist in three groups, … the Checklists tab in one read
> d353f2b Docs: production's AI_MODEL_SUMMARY was Sonnet until 4 October; every model variable is now Opus 5.5, visible (owner)
> 5601dda Workspace Task 5 docs: decisions (§156), handoff, the Task 5 test set, resolved and open defects
> cfa3738 Workspace Task 5: the summary report … and the Conversations list in one read …
> $ git rev-parse --short origin/main
> a701436
> $ git log --oneline origin/main..HEAD               # ahead
> (nothing)
> $ git log --oneline HEAD..origin/main               # behind
> (nothing)
> ```
> **`HEAD` and `origin/main` are the same commit, `a701436`**: Workspace Tasks 1–6 are pushed, so they
> are what Vercel builds from. The paragraphs below are kept as they were.

*(Corrected 3 October 2026, at the close of the Workspace layout pass. This section said the local
tree was ahead of production with the bake-off and the "Read it again" fix unpushed; that stopped
being true with the 1 October pushes (`DECISIONS.md` §151, §152).)*

```
$ git fetch origin && git log --oneline -3          # 3 October 2026, before the layout commit
ec8e070 Audits Run 9: the zip downloads from a browser; the close-out records
1e34fc2 Audits Run 8b: the page explained element by element; the folder-test brief
358647d Audits Run 8a: the email answered, labels leave with their document, the record straight

$ git rev-parse --short origin/main
ec8e070
$ git log --oneline origin/main..HEAD               # ahead
(nothing)
$ git log --oneline HEAD..origin/main               # behind
(nothing)
```

One branch, `main`, tracking `origin/main`. **On 3 October, before the layout commit, `HEAD` and
`origin/main` were the same commit, `ec8e070`.** The Workspace layout pass is one local commit on top
of it, and is **not pushed**: `git log origin/main..HEAD` lists it. A push to `main` deploys
(`RELEASE.md`), so that list is the next release's contents. What Vercel last built was not read here
— the dashboard is the owner's.

## 2. Migration state — 065 FILES (000 … 064), ALL 65 APPLIED ON PRODUCTION, NONE PENDING.

> ### UPDATED 4 OCTOBER 2026, AFTER THE WORKSPACE TASK 6 RELEASE.
> The owner ran `npm run db:migrate:prod`, which applied `064_the_checklist_in_three_groups.sql`.
> `npm run preflight` (read-only; one query, `select version || '_' || name as f from
> supabase_migrations.schema_migrations order by 1`, through the Supabase CLI's management API), run
> afterwards: **INPUT 1, 65 files on disk; INPUT 2, 65 rows on production (`dsfwmafnphdlfogetsus`), 064
> among them; `PENDING COUNT: 0`.** Staging also holds 064. **The replay from empty (`npm run db:reset`)
> is still owed, for the final workspace release.** The paragraphs below are kept as they were.

> ### UPDATED 4 OCTOBER 2026, AFTER WORKSPACE TASK 6 (`eec4d22`).
> Task 6 added `064_the_checklist_in_three_groups.sql`, applied on staging. `npm run preflight`, run after the
> Task 6 code commit, read **65 on disk, 64 on production (`dsfwmafnphdlfogetsus`), `PENDING COUNT: 1`**, and
> the one pending file is `064_the_checklist_in_three_groups.sql`. So 063 went to production with the Task 5
> release. 064 goes with the Task 6 release (`npm run db:migrate:prod`, the owner's action). **The replay from
> empty (`npm run db:reset`) was not run in Task 6, by the owner's decision; it is owed for the final
> workspace release.**

> ### UPDATED 3 OCTOBER 2026, AFTER WORKSPACE TASK 5 (`cfa3738`).
> Task 5 added `063_the_summary_as_a_report.sql`, applied on staging. `npm run preflight`, run after the
> Task 5 code commit, read **64 on disk, 63 on production (`dsfwmafnphdlfogetsus`), `PENDING COUNT: 1`**, and
> the one pending file is `063_the_summary_as_a_report.sql`. It goes to production with the Task 5
> release (`npm run db:migrate:prod`, the owner's action). The paragraphs below are kept as they were.

> ### UPDATED 3 OCTOBER 2026, AFTER WORKSPACE TASK 3 (`2937b0b`).
> Workspace Task 2 added `062_a_fact_outlives_its_conversation.sql` (`055df59`), so there are now
> **63 files, 000 … 062**. `npm run preflight`, run after the Task 3 commit, read **63 on disk, 63 on
> production (`dsfwmafnphdlfogetsus`), 062 among them, `PENDING COUNT: 0`** — 062 went to production
> with the Task 2 release. The figures in the block below are from 1 October and are kept as they were.

*(Corrected 3 October 2026. This section was headed "057 ON PRODUCTION, 060 ON STAGING. THREE
PENDING: 058, 059, 060" — true when written on 1 October, and false later the same day, when 058–060
and then 061 went up (`DECISIONS.md` §150, §151). The heading is the fact most often out of date in
this file, so it states the numbers.)*

```
$ ls supabase/migrations/*.sql | wc -l              # 3 October 2026
62                                    # 000 … 061

$ npm run preflight          # READ-ONLY. Run in Workspace layout Task 1 (1 October 2026, after the pushes).
  TARGET REF : dsfwmafnphdlfogetsus
  INPUT 1 — supabase/migrations/, every file (62)
  INPUT 2 — supabase_migrations.schema_migrations on dsfwmafnphdlfogetsus, every row (62)
  DERIVED — INPUT 1 minus INPUT 2: (nothing pending)
  DERIVED — INPUT 2 minus INPUT 1 (applied but absent from disk): (none)
  PENDING COUNT: 0
```

**The layout pass adds no migration**, so the release that carries it is code only. The preflight is
re-run before that push (Workspace layout Task 3, after the commit), and the release note carries its
output, not this file.

> ### THE PREFLIGHT WINS, AND THIS SECTION HAS NOW BEEN WRONG TWICE.
> On 1 October this file said three migrations were pending while `DECISIONS.md` §150–§152 said they
> had gone up; Task 1's preflight settled it in the decisions' favour. **A migration-state sentence
> written from memory is a guess wearing a number.** Read the preflight; if the two disagree, the
> preflight wins and this gets corrected again.

**The Audits contract, 058 to 060 — what each one's verify block proves by trying to break it:**

| | |
|---|---|
| **058** | `audit_runs`, `audit_sections`, `audit_findings`. The part that matters is not RLS: every finding is tied to its run, section, document and scan by **composite foreign keys on `(company_id, <id>)`**, so a finding cannot cite another company's document even when written by the service role, which passes every policy. The verify block attempts exactly that write and requires the `foreign_key_violation`. It also attempts an INSERT as `authenticated` and requires the refusal, and reads every grant back with `has_table_privilege` rather than trusting its own grant list. |
| **059** | `audit_findings.template_line` / `template_text`, `audit_runs.template_lines` jsonb. Proves the lines store and come back as the same count; proves a template run still may not also claim an agency; proves an agency finding may leave both columns null; proves deleting a run takes its findings **and leaves the checklist document**; and re-reads the privileges, because adding a column is a chance to widen one by accident. |
| **060** | One CHECK narrowed by one case: a `date` may have a null `due_on` when `recurs is true`. Proves the recurring undated row lands as kind `date` with a null day and no word; proves a one-off with no day is **still refused**; proves `recurs` null — "the model did not say" — is **also refused**, which is the clause the comment is about; proves dates with days are unaffected; proves the other two per-kind CHECKs and 058's cross-tenant FK still refuse what they refused. |

**Nothing in 058–060 touches an existing customer row**, and nothing in them is destructive: 058 and
059 create tables and columns, 060 replaces one CHECK with a strictly looser one, so no row already in
the table can be made illegal by it.

The fifteen from the Documents release are below, unchanged. The fifteen
that landed on 26 September are the Documents contract, and the release note
(`docs/releases/2026-09-26-documents-rev1.md` §2) tabulates every one of them with what its verify
block writes and removes. The four worth naming here:

| | |
|---|---|
| **040** | The five Documents tables — `document_scans`, `document_gaps`, `document_conditions`, `document_deadlines`, `company_labels` — plus `documents.status`. **The only one of the fifteen with no `begin;`/`commit;` of its own**, so a failure part-way would leave the schema half-changed. |
| **049** | `significant_date` is computed **in the view**, at read time, and the stored columns dropped. A derived value stored goes stale the first time you learn something. |
| **052/053** | `document_scans.extracted_text`; `document_gaps.superseded`; `document_batches`, `documents.batch_id` and `reading_since`. These two create their **own throwaway company** for their probe rows rather than attaching them to a real customer's — the pattern to copy. |
| **054** | The documents already on production are set to `held` and are never swept. **The only one of the fifteen that changes existing customer rows**, and the point of it. |

The three from the previous release are kept below because a reader still asks about them:

| | |
|---|---|
| **037** | The `company-documents` bucket. Migration 002 wrote four storage policies against a bucket **no migration created**, so a from-zero build got the policies and nothing for them to apply to. A no-op on both live databases; it exists for the next database built from this chain (§127 B, recorded beside §98 and §118). |
| **038** | `ai_calls`, the cost ledger. Stores **the prices each call was costed at**, so correcting `config/pricing.ts` cannot rewrite what a past call cost (§128 J). |
| **039** | `turns.document_id` / `turns.document_name`. The link that makes an attached file part of the conversation. The name is a **copy**, so a transcript still reads correctly after the document is deleted (§129). |

## 3. Production

**The research section is live on production.** Deployment facts below are the owner's, recorded
as such — **this session has no way to read Vercel**, and it did not try.

- **No staging deployment exists.** One environment on Vercel: Production, from `main`.
- **⚠ `docs/RELEASE.md` IS THE AUTHORITATIVE LIST OF WHAT VERCEL HOLDS — not this file.**
  *(Corrected 28 September 2026.)* This section used to carry its own list, and on 26 September that
  list and `CLAUDE.md` §3.4a **contradicted each other about whether the `AI_MODEL_*` variables are
  set at all** — which made the model that reads a customer's document unknowable from the repository
  until somebody opened the dashboard (`DECISIONS.md` §136). Three lists is worse than two. The names
  are below so a reader knows which knobs exist; **the values are in `RELEASE.md` only.**
  `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` ·
  `ANTHROPIC_API_KEY` · `CRON_SECRET` · `RESEND_API_KEY` · `FEEDBACK_EMAIL` ·
  `NEXT_PUBLIC_APP_URL` · `AI_MODEL_PROSE` · `AI_MODEL_JUDGEMENT` · `AI_MODEL_SUBSTEPS` ·
  `AI_MODEL_SUMMARY` · `AI_MODEL_DOCUMENT_SCAN` · `AI_SCAN_STRUCTURED` · `AI_EFFORT` ·
  `RESEARCH_PREFER_GOV` · `RESEARCH_SPECIALIST` · `RESEARCH_PROVENANCE`
- **`NOTIFY_TEST_TO` must NOT exist in Production** and is confirmed absent. Set there, every
  customer's batch email goes to that address instead of to them.
- **Deliberately NOT set in Production**, and that is what makes production the open baseline:
  `RESEARCH_GATE` · `RESEARCH_FACTS_BLOCK` · `RESEARCH_LONG_PROMPT` · `CHECKLIST_GATE` ·
  `CHECKLIST_CRITIC` · `CHECKLIST_LONG_PROMPT` · `RESEARCH_PREFER_GOV` ·
  `RESEARCH_SPECIALIST` · `RESEARCH_PROVENANCE`. Every switch defaults OFF and an unset variable
  IS the product's behaviour (`lib/pipelineConfig.ts`). The last three are ON in `.env.local`
  only, for the owner's comparison, and ship only if that comparison says so.
> ### ⚠ `.env.local` IS HAIKU. PRODUCTION IS NOT — AND IT IS NOT THE CODE DEFAULTS EITHER.
>
> *(Corrected 28 September 2026. This box said the four `AI_MODEL_*` variables are "unset in Vercel
> Production, so it runs the code defaults". **They are set.** That sentence was wrong for three days
> and is the reason `RELEASE.md` is now the single authoritative list — `DECISIONS.md` §136.)*
>
> The standing rule (`CLAUDE.md` §3.4a, `DECISIONS.md` §130) points `AI_MODEL_PROSE`,
> `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS` and `AI_MODEL_SUMMARY` at `claude-haiku-4-5` **on a
> development machine only** — a build session asks "does this render", not "is this true".
>
> **Production reads a document on `claude-opus-5-5` with `AI_SCAN_STRUCTURED = false`.** That is a
> measured choice, not a default: the bake-off ran seven configurations over the seven golden
> documents, three runs each (`tests/golden/documents/bakeoff/2026-09-27-rejudged.md`,
> `DECISIONS.md` §139). Do not read a local answer's quality as the product's:
> `npm run golden:facts -- --model claude-opus-5` is how you ask that question, and
> `npm run golden:docs -- --model <id> --structured on|off` is how you ask it about a document.
>
> Haiku **refuses `output_config.effort`** (400), so `lib/ai.ts` drops it below the 5 family.
> `DEV_MAX_SEARCHES=2` caps searches whenever `NODE_ENV` is not production.

- **Model and effort:** the `AI_MODEL_*` variables **are** set in Production — values in
  `RELEASE.md`. `AI_EFFORT` is set; `lib/ai.ts` `DEFAULT_EFFORT` is **`medium`**, and
  `modelAcceptsEffort()` **drops the parameter** below the 5 family, because `claude-haiku-4-5`
  returns 400 for every level of it (§130).
- **Cron:** `vercel.json` schedules `/api/jobs/summarise` at 03:00, `/api/jobs/delete` at 03:30 and
  — *added 26 September* — **`/api/jobs/scan-documents` every five minutes**, the most frequent Vercel
  Pro allows. All three refuse when `CRON_SECRET` is **unset** and answer 404, so a route cannot be
  confirmed to exist by probing it. An empty sweep run costs almost nothing: measured five times warm
  on staging at 88, 89, 102, 106 and 158 ms, about 30 seconds of function time a day at 288 runs.

## 4. Row counts, staging, read today

*(Re-read 28 September 2026. The previous figures were from 23 September and are replaced, not
restamped — staging was reset and reseeded for the bake-off in between, so the conversation-era counts
are **lower** on purpose and that is not a loss.)*

```
requirement_templates 205 · agencies 33 · switches 95 · industry_coverage 56
companies 6 · obligations 0
topics 7 · turns 21 · checklists 2 · checklist_items 6
documents 10 · document_scans 25 · document_gaps 88 · document_deadlines 47
document_conditions 49 · document_corrections 0 · company_labels 18
fact_proposals 138 · company_facts 0 · document_batches 2
document_reviews 0 · ai_calls 153 · job_runs 1
```

> ### `document_reviews` IS 0 ON STAGING. IT IS 34 ON PRODUCTION.
>
> *(Corrected 28 September 2026. This box read "`document_reviews` IS 0, AND THE DASHBOARD STILL
> READS IT" without saying which database, and the figure is a STAGING figure — every number in this
> section is.)*
>
> Read through the linked Supabase CLI on 28 September: **staging 0, production 34.** The old review
> path writes nothing any more — `/api/document-scan` is the reading for every door a file comes in by
> (Run 6) — and `/api/document-review` was deleted, so the dashboard defect this box described is
> fixed (`app/dashboard/page.tsx` reads `document_index_v`). What is NOT true is "a table nothing
> fills": production's 34 rows are the only readings that exist for 39 of its 41 documents, and the
> audit engine is the one thing that reads them.
>
> **And the 34 rows are not customer data.** All ten companies on production are the owner's own test
> rows — `CB-Test-1`, `CB-Test-2`, `CB-Test-3`, `CB-Test 1`, `CB-Test 2`, `ZZ Throwaway Test`,
> `zz-test-empty` — none matching a staging fixture name or a golden company. **Production has no
> real customer on it**, which is what makes the 39 `held` documents and the six July `audits` rows
> safe to leave alone.

Production row counts are **not in this handoff**: `SUPABASE_PROD_URL` and
`SUPABASE_PROD_SERVICE_ROLE_KEY` are **blank** in `.env.local`, which `CLAUDE.md` §3.8 says is the
better default, so the only production access from this machine is `npm run preflight` and the
Supabase CLI with `SUPABASE_PROD_REF`. Do not quote the figures in §126's handoff as current.

> ### **Production still has AI-written checklist rows and ZERO computed obligations.**
> Unchanged by every run so far. §68, and §111 decided the fix — **not built**, and deliberately
> not touched.

## 5. What `npm run check` covers — and what it does not

```
$ npm run check      # typecheck && check:schema && test && build
  check-schema-contracts: ok — 174 files, 44 relations (42 tables + 2 views).
  tests 544 · pass 544 · fail 0
  test-guard: 544 tests, 0 skipped, 0 todo, floor 544. OK
  ✓ Compiled successfully
```

*(Re-run 28 September 2026. This block said `142 files, 35 relations` and `457 tests` with a floor of
457, which was the 23 September figure and had been left standing through the fifteen Documents
migrations. The floor in `scripts/test-guard.js` was already **528** when this was read — so the
document was two revisions behind the committed constant, not one. It is **544** as of Task 0's
commit 1: sixteen for the company context's renderer.)*

**Both fix rounds are the evidence of what this gate cannot see.** Eleven defects across them,
every one found by a person using the product, every one with a green `npm run check` behind it:
an answer that stopped silently, a table cut in half by its own citation, a drawer that printed
the page behind it, a summary that named a character the product does not have, and a file that
reached Documents and never reached the model. The gate answers *"does the code build and
behave"*. None of those was that question.

- **No authenticated HTTP request.** A missing grant, a wrong policy or a route guard is
  invisible to all 457 tests. `npm run check:live` signs in as a real fixture.
- **Nothing checks regulatory content.** A model checking a model produces agreement.
  `npm run golden:facts` is a **presence check on plain text**, not a verification.
- **⚠ A DIRECTORY RENAME UNDER `app/` FAILS IT ON A FILE NOBODY EDITED.** *(Added 29 September
  2026, Task 0 commit 3.)* Next generates a route validator into `.next/types/validator.ts` that
  imports every page and route by path. `npm run check` runs **`typecheck` before `build`**, so after
  `git mv app/your-company app/company-information` the stale validator still imported the old paths
  and `tsc` failed twice:

  ```
  .next/types/validator.ts(179,39): error TS2307: Cannot find module '../../app/your-company/page.js'
  .next/types/validator.ts(494,39): error TS2307: Cannot find module '../../app/api/your-company/route.js'
  ```

  **`rm -rf .next`** fixes it — the directory is gitignored — and the regenerated validator names the
  new paths. Worth knowing because the error points at generated code in a file the commit did not
  touch, and the obvious reading is that the rename was done wrong.

- **⚠ It executes 2 of this repository's scripts.** `tsconfig.json`'s `include` has no
  `**/*.js` pattern, so the rest are invisible to it — `scripts/preflight-prod.js` sat
  unparseable for seven days while the gate said green (§121). The fix is a `check:syntax` step;
  **not built**, because it changes the commit gate.

## 6. The cost ledger — read this before spending anything

`ai_calls` (migration 038) records every model call **at the call**, with the prices it was
costed at. `npm run cost` splits it and **names what it is missing** every run.

```
$ npm run cost
  COST LEDGER — 78 call(s)          prices verified 2026-09-23
  task          calls   input tok  output tok  searches    stored  at current   share
  research         66     1234567      121286        84    $24.53      $10.04   83.7%
  checklist         3      153007       23536        10     $3.54       $1.45   12.1%
  convert           6        5981       18553         0     $1.14       $0.49    4.1%
  summarise         3        3466         451         0     $0.02       $0.01    0.1%
  TOTAL            78     1397021      163826        94    $29.22      $12.00

  INPUT  58.1%   what we SEND: prompt + history + search results
  OUTPUT 34.1%   what comes back, reasoning tokens included
  SEARCH  7.8%
```

**"stored" against "at current" is not a price change — it is a correction.** The first version of
`config/pricing.ts` was wrong: Opus 5 was listed at $15/$75 per million and is **$5/$25**; Sonnet 5
was $3/$15 and is **$2/$10**. Owner-verified 23 Sep. Rows are **not repriced** — a row keeps the
price it was costed at, by design — so the stored figure for those 59 rows is a number **nobody
was charged**. Quote the corrected column.

> ### THE TWO NUMBERS TO CARRY AROUND
>
> **2.03 visible characters per billed output token.** Plain prose is about 4, so roughly half
> the output bill is reasoning you never see.
>
> **~4,500 input tokens per source retrieved.** A source is not paid for once: it is replayed as
> input on every later turn of that conversation.

> ### ⛔ AND THE LARGEST KNOWN HOLE IN EVERY FIGURE ABOVE
>
> **⚠ CORRECTED 28 SEPTEMBER 2026: `lib/documentReview.ts` DOES pass a `ledger:` argument.**
> It is at **`lib/documentReview.ts:90`** — `ledger: { companyId, task: 'document_review' }`, with the
> comment above it reading "MEASUREMENT ONLY — the call itself is unchanged". This box used to say
> *"`lib/documentReview.ts` passes no `ledger:` argument — `grep -n ledger lib/documentReview.ts`
> returns nothing"*, and that grep now returns line 90. **The claim was true when it was written and
> the fix was not recorded here.**
>
> The `document_review` task still has **zero rows**, and the reason is different and worth stating:
> its one remaining caller is the audit engine's auto-index loop, and **no audit has been run on
> staging or production since the ledger existed** (production's six `audits` rows are from 25 July).
>
> **⚠ CORRECTED AGAIN, 1 October 2026: that loop's engine no longer exists.** Audits Run 3 deleted
> `app/api/audits/route.ts` and the old page on 30 September. `document_review` therefore has zero
> rows and now also has **no live caller**, which is a different kind of nothing and should not be
> read as "untested". The `audits` and `hr_audits` tables are kept and unread.

### The `audit` tier, added 30 September 2026

`AITask` gained `audit`, and `TASK_MODELS.audit = () => process.env.AI_MODEL_AUDIT || TASK_MODELS.judgement()`.

It is worth knowing **why it exists**, because the shape catches people out: `audit` was already a
`LedgerTask` — in `LEDGER_TASKS` and in migration 038's CHECK — while being absent from `AITask`. So
the ledger could say `audit` and `modelForTask('audit')` threw *"TASK_MODELS[task] is not a function"*.
The spend was recorded as `audit` while the model was whatever `judgement` happened to be, and the one
thing a bake-off needs is to move one model without moving three others.

- **`AI_MODEL_AUDIT`** is the variable. Unset means the judgement tier, exactly as
  `AI_MODEL_DOCUMENT_SCAN` behaves. **`docs/RELEASE.md` is the authoritative record of what Vercel
  holds**; this file carries the name, never the value (§3.4a's rule, and the reason for it).
- **Every audit call writes a cost row**, task `audit`: the section's call in `lib/auditRun.ts` and
  the checklist extraction in `lib/auditTemplate.ts`.
- **16,000 output tokens from the first attempt.** It was 8,000, and the rev 1 baseline measured the
  cost of that: five of fifteen runs came back `stop_reason=max_tokens` and were retried at 16,000,
  and `lib/ai.ts` accumulates the ledger **across** retries, so the truncated attempt is bought and
  thrown away — $0.4508 against $0.2158 for the same audit. The doubling retry stays as the backstop
  and now climbs from 16,000 to the 21,333 hard ceiling.
- **`AI_AUDIT_STRUCTURED`** exists in `lib/pipelineConfig.ts` and **unset means OFF** — deliberately
  not the scan's inverted convention. It has never been measured against the baseline.
> So the call site is counted and simply has not been called. *"A call site with no `ledger:`
> argument is a call nobody is counting"* is still the rule; this is no longer an instance of it.
> **The owner measured a two-page PDF scan at $1.10 on live on 23 September** (the owner's
> figure; not reproduced by this session). That one call is more than the entire `convert` task's
> recorded spend.
>
> Six of ten tasks have never written a row — `substeps`, `gate`, `critique`, `audit`,
> `document_review`, `other` — so **these totals are a floor, not a total**, and `npm run cost`
> says so every run. `TODO.md` M4 carries it as two separate pieces of work: count the calls
> first, then ask why a two-page scan costs $1.10. **This is where the Documents chat starts.**

## 7. Open defects

| | Where | Note |
|---|---|---|
| **Document scans are uncounted and expensive** | `lib/documentReview.ts` | See §6. The single biggest unknown in what this product costs to run |
| **A third turn will not reliably stand by its citations** | `prompts/checklist.ts` `PROVENANCE_SENTENCE` | With `RESEARCH_PROVENANCE` on, 2 of 3 runs stand by their sources; before it, 0 of 3. The structural cause is unchanged — the tool-use blocks are not stored — and the real fix is to store and replay them (§128) |
| **Re-sending an attachment on every turn is unbounded in cost** | `lib/attachedDocument.ts`, `MAX_CARRIED_DOCUMENTS = 3` | Correct but expensive on long PDFs. A size threshold was deliberately **not** invented; the measurement to justify one is in `ai_calls` (§129) |
| **`outcome: 'ask'` is not rendered** | `components/archive/GateAskCard.tsx` | Both gate switches are off; turning either on leaves the question unrendered. **R1.5** |
| **The company's industry never reaches the answer** | `lib/determinationGate.ts` | The gate puts state/county/city in `known` and not the industry. §105 defers it. Dormant — the gate is off |
| **Citations discarded for every non-research caller** | `lib/ai.ts` — `askAI` returns `.text` only | `/api/audits` runs web search on two calls and drops its sources |
| **`expires_at` set by nothing** | `company_switches` | An expired fact must read `unknown`; a stale `false` is a false green |
| **A checklist audit on the thinnest fixture is refused in prose** | Haiku, via `scripts/check-live.js`'s template flow | Four checklist lines against two documents, one of which is the checklist. `prompts/audit-agency.ts:290` says *"Never reply with prose explaining that you cannot answer"* and Haiku replies with prose anyway — *"I need clarification to proceed. You've provided: 1. A checklist with 4 lines … 2. Two documents on file (D1 and D2)"*. Reproduced twice on 1 October; the same code answers all eight lines of `cascade-template-13` against Cascade's twelve documents (7/9 musts, Haiku). So it is thin evidence, not the plumbing. **`check:live` fails on it and the failure is left standing**: the fixture was not enriched to make it pass, because a fixture tuned until the model complies measures the fixture |
| **`not_a_document_question` had a matcher that could never match** | `scripts/run-golden-audit.js` — FIXED 30 Sep | It compared the word with underscores against the same words with spaces, so the check failed every run while the answers held two and three of them. Named here because the class is the dangerous part: a check that cannot see anything looks exactly like a check that found nothing |
| **/compliance?checklist=<id> opens nothing (DocumentReport.tsx:701, :760; page reads only ask and document). The owner will look after this pass.** | `components/DocumentReport.tsx:701`, `:760`; `app/compliance/page.tsx`, the `?ask=`/`?document=` effect | Added 3 October 2026 (Workspace layout). Confirmed on screen in Task 1 with a real checklist id and a non-existent one: no drawer, the Ask tab, no notice, the parameter left in the URL |
| **The Audits box's typed question is not carried to the workspace (audits/page.tsx:533; HANDOFF-AUDITS §8 item 2).** | `app/audits/page.tsx:533`, a plain `href="/compliance"` | Added 3 October 2026. Seen in Task 1: a sentence typed into the Audits box, the link followed, the workspace's box empty |
| **The failed line can show a raw provider message (lib/ai.ts:833–834 via route.ts:382), and several messages end with two instructions.** | `app/compliance/page.tsx`, the failed line; `app/api/chat/route.ts:382`; `lib/ai.ts:833–834` | Added 3 October 2026. Every string that can reach `x.error`, each followed on screen by *"You can ask again, or rephrase the question."*: **a JSON answer instead of a stream** — "Unauthorized" (`lib/auth.ts:80`), "Company not found" (`:109`), the conversation-lost sentence (`route.ts:77–79`, from 524, 540, 568), "This topic is closed. Ask your question again and we’ll open a new one." (`:546`), the AI module's own error on the checklist path (`:382` ← `lib/ai.ts:833`, the provider's message as is, or `:834`, "The model returned no message."), "The checklist came back in a shape we could not read. Please try again." (`:393`), "We could not start this conversation. Please try that again." (`:606`), "Something went wrong" (`:803`), and the page's fallback "That request could not be completed."; **a stream that failed** — "The answer stopped part-way through. Please try again." (`route.ts:477`), or `lib/answerStream.ts:93`'s fallback; **a request that threw** — "The answer could not be completed." Not reachable from this page: "No question or file provided" (`:187`) and the file-parse message (`:239`, multipart only). Unchanged by the layout pass, by decision: the owner decides |
| **conversation_reset is sent by the route and read by no page.** | `app/api/chat/route.ts:82` | Added 3 October 2026. `grep -rn conversation_reset app components lib` finds the route alone. So "start fresh" in the conversation-lost sentence is not done by the page: the conversation on screen is not cleared |
| ~~Cron jobs never run: GET → 405.~~ | `lib/cronSecret.ts`, `lib/jobAuth.ts`; the four `app/api/jobs/*` routes | **RESOLVED 4 October 2026, `14eb03b` (Workspace Stage 4 Part 3, `DECISIONS.md` §162), to be released.** Each route gains a GET that runs its POST; GET takes `Authorization: Bearer <CRON_SECRET>` (Vercel), POST keeps `x-cron-secret` (by hand); refusals stay 404. Proven on staging through both doors on all four jobs, and refused on all four with `CRON_SECRET` unset. Also closed for a double delivery: the audit sweep releases only its own claims, the deleter logs only what it deleted. **Proven on production only by the live checks in `docs/TESTING.md`, "The cron release".** *(The row as it stood: Added 3 October 2026. Vercel's logs on 3 October: every scheduled call GET → 405, every 5 minutes; production `job_runs` had never held a `summarise` or `delete` row; written up in `docs/reports/workspace-task2.md`.)* |
| ~~The Checklists tab still reads 1 + N~~ | `app/compliance/page.tsx:429` `loadChecklists`; `supabase/migrations/064_the_checklist_in_three_groups.sql` | **RESOLVED 4 October 2026, `eec4d22`.** Workspace Task 6. One read through `checklist_list_v`, `security_invoker`, with must-do counts. Measured: 1 request for 19 checklists. **Released 4 October 2026**: migration 064 on production (`npm run preflight`: `PENDING COUNT: 0`), the code pushed (`a701436`) |
| ~~`prompts/summarise.ts` is now unused~~ | `prompts/summarise.ts` | **RESOLVED 4 October 2026, `eec4d22`: deleted.** No importer, and no reference to `SUMMARISE_PROMPT` outside the file. `prompts/summary-report.ts`'s header says where to read it (`git show cfa3738:prompts/summarise.ts`) |
| **Items that depend on something under To confirm are stated as settled.** | `prompts/summary-report.ts` rule 8; `prompts/convert.ts` `CONVERT_DISCUSSED` rule 6 | Added 4 October 2026 (Workspace Task 6, STOP 1; `DECISIONS.md` §157). The checklist stated drawback as settled in items 3 and 16 while *whether drawback applies to imported spirits* was under To confirm, and softened secondary containment. **The owner's plan: a consistency check — a separate, narrow pass asking which items depend on something under To confirm — covering the summary AND the checklist.** No prompt change was made. Not built *(4 October 2026: the Task 6 code is on production; this row stays OPEN — see `docs/WORKSPACE-PLAN.md` Stage 3.)* |
| **"How do I do this?" proves a step's link, not its words.** | `lib/howTo.ts` `checkHowTo` | Added 4 October 2026 (Workspace Task 6, STOP 1). The check confirms a step's URL is a page this call's search returned; it does not confirm the page says the step. **For the quality pass:** each step carries words from its page, and code confirms they appear in that page's text *(4 October 2026: the Task 6 code is on production; this row stays OPEN — see `docs/WORKSPACE-PLAN.md` Stage 3.)* |
| **Effort is not the lever for the mothership rule.** | `lib/ai.ts` `effortForHowto`; `AI_EFFORT_HOWTO` | Added 4 October 2026 (Workspace Task 6, STOP 2). At medium, "How do I do this?" searched more (3 against 1 for the OLCC Industrial Alcohol Authority) but cited unofficial copies of the rules (oregon.public.law, Justia) where low had used the Secretary of State's site: 1 of 6 steps official against 4 of 6. For the quality pass *(4 October 2026: the Task 6 code is on production; this row stays OPEN — see `docs/WORKSPACE-PLAN.md` Stage 3.)* |
| **Copy sites compete with the official text in search.** | `lib/ai.ts`, where the web-search tool is configured | Added 4 October 2026 (Workspace Task 6). **For the quality pass:** measure blocking known copy sites (Justia, public.law, FindLaw, Casetext and similar) from the search, so the official text is the only full text found. Not built *(4 October 2026: the Task 6 code is on production; this row stays OPEN — see `docs/WORKSPACE-PLAN.md` Stage 3.)* |
| **"Everything on this subject" re-adds discussed points as "added".** | `app/api/checklists/from-topic/route.ts`, the `complete` branch, `origin` | Added 4 October 2026 (Workspace Task 6, STOP 2). An item is `added` when its link is not one the conversation cited, so a discussed point (FDA Prior Notice, the facility registration) comes back as *newly checked* when the search finds a new link for it. Behaviour older than Task 6, made visible by search. For the quality pass *(4 October 2026: the Task 6 code is on production; this row stays OPEN — see `docs/WORKSPACE-PLAN.md` Stage 3.)* |
| **`check:live` has no probe for `checklist_items`, `checklist_list_v` or the how-to route.** | `scripts/check-live.js` | Added 4 October 2026 (Workspace Task 6). The table probes all pass, but none touches what Task 6 added. The `to_confirm` write and the view were proved by hand as `testgamma` on staging (`DECISIONS.md` §157) *(4 October 2026: the Task 6 code is on production; this row stays OPEN — see `docs/WORKSPACE-PLAN.md` Stage 3.)* |
| ~~The print of a checklist with how-to steps has not been looked at on paper~~ | `app/compliance/page.tsx` `HowToSteps`, `printDrawer` | **RESOLVED 4 October 2026 by the owner's live check on production**: a checklist with "How do I do this?" steps (MNBP registration, 7 steps) printed correctly (`DECISIONS.md` §158) |
| **Rule 8's condition was applied to one of two dependent items in one run.** | `prompts/summary-report.ts:72` | Added 3 October 2026 (`DECISIONS.md` §156). In the Part B run on Opus 5.5, the TTB drawback item said it depends on what is still to confirm; **the CBP excise item read as settled while drawback was under *Still to confirm***. One run, so not a rate. Watch it at the quality test; no prompt change was made |
| ~~DEFERRED POLISH — after Task 6, before the quality test (owner, 4 October)~~ | `app/compliance/page.tsx` `ReportView` (`:1851`), `OneLineLink` (`:1804`) | **RESOLVED 4 October 2026, `04f81c6` (Workspace Stage 2).** (1) The summary drawer as an accordion, per board 6b: each authority folded with *N things to do*; *Still to confirm* never folded; *Open all*; print always open. (2) One-line source links, *[n] host · title*, cut with *…*, the full title on hover, full title and address in print. Also fixed: the site header no longer prints (`components/AppLayout.tsx:220`). `DECISIONS.md` §159 |
| **The app-wide print sweep waits.** | every page with `window.print()` or a drawer outside the workspace | Added 4 October 2026 (Workspace Stage 2, `DECISIONS.md` §160). The print frame covers the four drawers (summary, checklist, Documents report, Audits report) and the workspace conversation only, by the owner's decision; the rest of the app waits until every section has its new look |
| **The Documents report prints its on-screen buttons; the disclaimer prints the site footer's links.** | `components/DocumentReport.tsx` (*Add a newer version*, *This is the latest*, *Confirm*, *Not right*); `components/AppLayout.tsx`, the footer | Added 4 October 2026, seen on the Stage 2 prints (`shots/s2p-documents-report-*.png`). Older than Stage 2. For the print sweep |
| ~~A second press of Summarise or Turn into a checklist pays twice; leaving the page can lose the work~~ | `app/api/topics/[id]/summarise/route.ts`, `app/api/checklists/from-topic/route.ts`, `lib/topicClaim.ts`, migration 065 | **RESOLVED 4 October 2026 (Workspace Stage 4 Part 2, `DECISIONS.md` §161), to be released.** A claim on the conversation before any model call, a 409 for a second press, the work in `after()` after a 202, a conditional save; the row and the drawer say *Summary being written…* / *Checklist being built…*. Proven on staging on a local server; **on Vercel only by `docs/TESTING.md` S4-2**, the paid production test |
| **A failed summary or checklist shows the general sentence, not its reason.** | `app/compliance/page.tsx` `SUMMARY_FAILED`, `CHECKLIST_FAILED`; the server log | Added 4 October 2026. The owner's decision for rev 1 (`DECISIONS.md` §161): the work runs after the reply, so the page learns of a failure only when the claim clears with nothing new, and says *"…could not be summarised just now. Nothing was changed. Please try again."* / *"…could not be turned into a checklist. Please try again."* The reason — a shape that did not parse, *nothing in this conversation could be turned into checklist items* — is in the server log only. A column for the reason would bring it back to the page |
| **A summary or checklist run past 9 minutes is still paid for.** | `lib/topicClaim.ts` `CLAIM_WORK_MS`; `lib/ai.ts` `callWithCitations` | Added 4 October 2026. The route gives up and clears its claim at 9 minutes, under the 10-minute lock, and a late result is discarded (the summary's save is conditional; a late checklist is removed). But the non-streaming AI path takes no cancel signal, so the model call itself runs to the end and is billed. Adding a signal touches `lib/ai.ts` and is a discussion first (`CLAUDE.md` §9). No run has come near 9 minutes: the longest measured was 6.7 s on Haiku |
| **`check:live`'s `checklist/saved` fails: "13 item rows for 9 items returned".** | `scripts/check-live.js:314`; `app/api/chat/route.ts`, the checklist branch | Added 4 October 2026, first seen in the full `check:live` run of Stage 4 Part 2. Not this task's route. **Hypothesis, not verified** (the run deletes its checklist): line 314 counts must-do and good-to-have only, and the route has also saved to-confirm items since Task 6, so 13 = 9 + 4. To check: print the categories before the cleanup |
| **`job_runs` grows by about 576 rows a day and nothing clears it.** | `lib/jobAuth.ts` `startJobRun`; `vercel.json` (the two `*/5` sweeps) | Added 4 October 2026 (the cron release, `DECISIONS.md` §162). From the release, `scan_documents` and `audit_sections` each open a row every 5 minutes whether or not there is work — 288 a day each, about 210,000 a year — plus the two nightly rows. Harmless at that size, but no job prunes it. Options for the owner: skip the row when a sweep finds nothing, or prune rows older than N days |
| **The print frame is untested in Safari and Firefox.** | `lib/printFrame.ts` `printFrameCss` | Added 4 October 2026. Measured in Chrome 154 only. To the best of current knowledge neither draws CSS page margin boxes, so the frame's top and bottom lines would be missing there and their own header and footer would follow their print settings |
| ~~The notice stays across the workspace's tabs until Dismiss~~ | `app/compliance/page.tsx` | **RESOLVED 3 October 2026, `2937b0b`.** Machinery (iii). It clears on a tab change, on New conversation and on opening a conversation |
| ~~"Save it" on a proposal shows "Not found"~~ | `app/compliance/page.tsx` → `/api/switches/answer:53` | **RESOLVED by removal, 3 October 2026, `2937b0b`.** Machinery (i): the proposal's key was not a switch id. The card is gone; facts are confirmed in Company information, and the summary drawer links there |
| ~~"Make a checklist" from the box saves nothing~~ | `app/api/chat/route.ts`, the open checklist branch | **RESOLVED 3 October 2026, `cbdc99c`.** Machinery N1. The checklist and its items are written as the caller; `check:live` asserts the rows |
| ~~A summary made by hand stops the transcript ever being cleared~~ | `app/api/jobs/delete/route.ts`, `lib/retention.ts` | **RESOLVED in code 3 October 2026, `6a77339`.** Machinery N2. Clearing is 12 months after the last turn, whoever wrote the summary. **It runs only once the cron release ships** (row above) |
| ~~"Wrap up and start fresh" titles the next conversation "Carrying on…"~~ | `app/compliance/page.tsx` | **RESOLVED by removal, 3 October 2026, `2937b0b`.** Machinery N3. The nudge and its pre-fill are gone |
| ~~Deleting a conversation deletes its facts, decided ones included~~ | `supabase/migrations/062_a_fact_outlives_its_conversation.sql`, `app/api/to-confirm/route.ts` | **RESOLVED 3 October 2026, `055df59`.** Machinery N7. Migration 062 is on staging and on production (`npm run preflight`, 3 October, after `2937b0b`: 63 and 63, `PENDING COUNT: 0`) |
| ~~The checklist delete ignores its errors~~ | `app/compliance/page.tsx` `deleteChecklist` | **RESOLVED 3 October 2026, `2937b0b`** — the deletes only. Machinery N8: both deletes are checked, items first, and a failure keeps the confirmation open with a plain line. N8's other unchecked writes are not covered here: the checklist tick still ignores its error, and the proposal updates went with the card |
| ~~Attaching a file first removes "Make a checklist"~~ | `app/compliance/page.tsx` | **RESOLVED 3 October 2026, `76f8c42`.** Machinery N4. A chosen file is only staged as a chip in the box; it no longer becomes an exchange, so the first visit keeps both buttons |
| ~~Reopening a conversation hides its attachments~~ | `app/compliance/page.tsx` `openConversation` | **RESOLVED 3 October 2026, `76f8c42`.** Machinery N5. Each turn's file card comes back, from one `document_index_v` read for the whole conversation; a file deleted since keeps its name and says so |
| ~~Summarising again could propose the same fact twice~~ | `lib/summaryReport.ts:370` `proposalsToInsert` | **RESOLVED 3 October 2026, `cfa3738`.** Workspace Task 5. A pending proposal for the same conversation with the same key and value is not inserted again. A repeated fact within one summary is inserted once. Both are covered by `tests/unit/summaryReport.test.ts:196–210` |
| ~~The Conversations list makes 1 + 2N reads~~ | `app/compliance/page.tsx:384` `loadTopics`; `supabase/migrations/063_the_summary_as_a_report.sql` | **RESOLVED 3 October 2026, `cfa3738`.** Workspace Task 5. One read through the view `topic_list_v`, `security_invoker`, so the caller's policies apply. **Migration 063 is on staging only until `npm run db:migrate:prod`** *(4 October 2026: 063 is on production — `npm run preflight`, 65 and 65)* |

## 8. The next steps — THIS FILE'S READING, not the two handoffs'

`HANDOFF-LAYOUT.md` and `HANDOFF-DOCUMENTS.md` are now in `docs/` (see the banner at the top).
What follows was derived from the state above **before** they were read, and has not yet been
reconciled with them — where they disagree, they win.

1. **The owner's manual passes are still not claimed to have been run.** `TESTING.md` carries
   three sets now — R3's ten finish-line actions, Fix Round 1's four, and Fix Round 2's two.
   **Nothing in this repository says any of them has been done by a person**, and the research
   section is now live on production, so that gap is in front of customers rather than behind a
   flag.
2. **Documents, starting from the ledger gap in §6.** Count the calls before tuning anything.
3. **The three research switches await the owner's comparison** (§128). They are on locally and
   unset in production; each ships only on that comparison, against an incognito chat (§115).
4. **R1.5 before either gate is switched on**, because the page cannot render `outcome: 'ask'`.
5. **Email deliverability: verify the sending domain in Resend with its DNS records before
   customers. The batch email and the audit email use the same sender.** Added 1 October 2026. The
   audit email from the rev 1 smoke test **arrived and went to junk**. The send is not the problem —
   the production `job_runs` row shows Resend accepted it with an id and no error — so this is a DNS
   job, and it is one job for both emails because both go through the same sender.

## 8a. Before the first customer with a big folder — not simulated, to check at the line

*Added 1 October 2026 (Audits Run 8a, item 8). Carried into `docs/HANDOFF-FOLDER-TEST.md` by
reference rather than copied, so there is one copy of it.*

> ### ⚠ NONE OF THE THREE BELOW HAS BEEN TESTED UNDER LOAD, BECAUSE NO LOAD EXISTS.
>
> Every queue this product has run has been one document at a time, or twelve fixtures read one after
> another with nothing else waiting. **The folder test is the first time a real queue will exist** —
> twenty to forty documents dropped as one batch, then an audit of everything over the result. Each
> item below is therefore a **hypothesis with the file to open**, not a finding. Reading the line is
> cheap; discovering it with a customer's folder in the queue is not.

### (a) What happens when the model refuses a call for rate limiting

**Hypothesis: nothing backs off, and one refusal costs the whole unit of work.**

`lib/ai.ts` retries on exactly one condition — `grep -c 429 lib/ai.ts` returns **0**, and the only
retry is:

```ts
// lib/ai.ts
if ((message as any).stop_reason === 'max_tokens' && maxTokens < HARD_CEILING && attempt < MAX_RETRIES) {
  maxTokens = Math.min(maxTokens * 2, HARD_CEILING)
```

So a `429` or an `overloaded_error` is **thrown**, not retried. What each sweep then does with the
throw differs, and both are worth reading:

- **The audit sweep** — `app/api/jobs/audit-sections/route.ts`, the `catch` at line 135 — lands it as
  `runSection`'s `fail()`: the section becomes `could_not_complete` with the message on the row. That
  is recoverable: `POST /api/audit-runs/[id]/sections/[sid]/retry` re-buys one section, and the
  report shows the reason. **One rate-limited section does not spoil the run.**
- **The document scan** — `refusedScan` in `lib/documentScan.ts:553` — writes
  `status: 'could_not_read'` with *"The reading service refused our request to read this document, so
  nothing was read."* The document is left needing a re-scan. That wording exists because of
  `DECISIONS.md` §136: before it, a refusal read *"the file did not arrive as something we can
  open"*, which was a claim about twelve perfectly readable documents.

**What to check at the line:** whether a batch of forty uploads can trip the account's rate limit at
all, and if it can, whether forty documents come back `could_not_read` with a refusal message — which
is honest and is also forty re-scans a person has to ask for one at a time.

### (b) How long the sweep that an upload kicks is allowed to live

**Hypothesis: it is that route's own function limit, and that is shorter than the cron's 800 seconds.**

The cron paths say so explicitly:

```
app/api/jobs/audit-sections/route.ts:25   export const maxDuration = 800
app/api/jobs/scan-documents/route.ts:70   export const maxDuration = 800
```

The routes that **kick** a sweep inline do not:

```
$ grep -n maxDuration app/api/audit-runs/route.ts app/api/documents/route.ts
(no output)
```

`POST /api/audit-runs` starts the sweep with `after()` (lines 89 and 139), and `after()` work runs
inside the invocation that scheduled it — so it gets that route's limit, which with no
`maxDuration` is the platform default and is **not** 800. The audit sweep's own budget assumes it has
640 s with 130 s held back (`BUDGET_MS`/`RESERVE_MS`, lines 35–36), and it stops *starting* sections
at 510 s. **A kicked sweep that is killed at the platform default will be cut off long before its own
budget thinks it should stop** — mid-section, with `claimed_at` set.

**Why that is survivable and still worth knowing:** the stuck-section recovery at the top of every
cycle returns a `running` section with an old `claimed_at` to `queued`, so the cron picks the work
up. The cost is a wasted model call and a delay of up to five minutes, invisible to the person except
as an audit that takes longer than its estimate. **What to check at the line:** whether
`app/api/audit-runs/route.ts` should carry `maxDuration = 800` like the cron does, which is a
one-line change nobody should make without measuring what a kicked sweep currently gets.

### (c) What a backlog looks like, and what it is the trigger for

**Hypothesis: the cron drains one company at a time, oldest first, and a backlog is visible in
`job_runs` before anybody complains.**

The queue picks a company, claims **all** of that company's queued sections in one statement, and
loops:

```ts
// app/api/jobs/audit-sections/route.ts
const { data: claimed } = await supabaseAdmin.from('audit_sections')
  .update({ claimed_at: nowIso })
  .eq('company_id', companyId).eq('status', 'queued').is('claimed_at', null)
  .select('id, run_id, ordinal')
```

and stops starting new ones when the budget runs out:

```ts
if (Date.now() - startedAt > BUDGET_MS - RESERVE_MS) { stoppedForTime = true; break }
```

writing `stopped_for_time` onto the `job_runs` row (line 173). **So a backlog reads as:
`job_runs` rows for `audit_sections`, tick after tick, each ending `stopped_for_time: true` with
sections still `queued` afterwards.** One such row is a busy five minutes; the same row every five
minutes for an hour is a queue that is not draining.

**That is the worker's trigger** — `CLAUDE.md` §4 — and nothing else needs to be designed first,
because **the claim mechanism already supports several workers**: the claim is a
compare-and-set (`.eq('status','queued').is('claimed_at', null)`) and a second sweep claiming the same
company gets an empty result and moves to another one. A second instance is therefore additive, not a
race. **What to check at the line:** the one production `job_runs` row that exists for
`audit_sections` reads `stopped_for_time: false` with `wall_ms: 176995` — three sections in 177
seconds. Forty documents and a dozen agencies is the first case where that number could exceed the
budget.

## 9. Commands worth knowing

```
npm run check         typecheck · schema contracts · 559 tests · build. Green as of this commit.
                      (was written as 457 until 28 Sep and 544 until 1 Oct; the floor is committed,
                       so the number here is the one thing in this block that goes stale silently.)
npm run check:live    signs in as a real staging fixture and writes as that user.
  -- --only sources      the third-turn citation step alone
  -- --only attachment   attach a PDF and ask about it (Fix Round 2)
  -- --only template     the checklist audit alone — start, lines, one row per line, the cost
npm run cost          READ-ONLY. Where the money went, and what the total does not include.
npm run golden:facts  the owner's five questions, three runs each, priced.
  -- --model claude-sonnet-5   compare a model WITHOUT changing any default
npm run golden:audit  the five audit cases. The judge reads the ROWS, not the model's JSON.
  -- cascade-deq --mode whole --times 1        one case, one run
  -- --fixtures-only                           the confirmed fact and the relinked login, no model call
npm run schema:doc    regenerates docs/SCHEMA.md from the live catalog. Runs inside db:migrate.
npm run db:reset      wipes STAGING and replays 000…060. Typed RESET, no bypass flag.
npm run db:restore    rebuilds STAGING's data after a reset. Refuses production four ways.
npm run preflight     READ-ONLY. Both migration lists, and the pending set derived in front of you.
node scripts/page-text.mjs '/audits?run=<id>' '<expr>'
                      what a signed-in page ACTUALLY says, in headless Chrome. Not a test.
node --env-file=.env.local scripts/bakeoff-audit-capture.mjs <model> baseline
                      the ledger and every run's drawer text, written to disk, once.
node scripts/bakeoff-audit-report.js --model <model> --label baseline
                      the bake-off tables. Calls NO model and reads NO database.
```

### Getting a working database back after a reset — the two commands, and what each is for

**`npm run db:reset` rebuilds the SCHEMA and nothing else.** It replays 000 to 060 from empty, which
is the only thing that proves the chain can build a database from nothing. **Take the result from the
database, never from the exit code** — twice on 22 September it appeared to run and did nothing
because the automation never matched the confirmation prompt:

```
$ npx supabase db query --project-ref <staging> --linked \
    "select max(version) as newest, count(*) as total from supabase_migrations.schema_migrations;"
  newest 060 · total 61
```

**`npm run db:restore` then rebuilds the DATA**, ten steps, every count checked against the file it
came from. The two that matter to Audits:

- **Step 9 — Cascade's twelve readings, restored from stored runs with NO model call.** It replays
  `tests/golden/documents/runs/real-model/` through the same `saveScan` with `linkLedger: false`.
  Its own line reads `12 reading(s) restored. 0 model calls — check with npm run cost.` A reset used
  to mean re-buying twelve real-model reads.
- **Step 10 — `run-golden-audit.js --fixtures-only`.** A reset drops `profiles` and leaves
  `auth.users`, so `testcascade@example.com` survives pointing at a company that no longer exists;
  this relinks it to the recreated one. It also confirms the single fact the OSHA contradiction needs
  (the plan's 42, written directly rather than fished out of a proposal, because the real model
  proposes different switch keys from Haiku's for the same sentence) and writes agency-label
  corrections only where a reading contradicts that document's own answer key. **No model call.**

> ### AND THE ONE THAT HAS COST A WHOLE CYCLE TWICE: `rm -rf .next` UNDER A RUNNING `next dev`.
>
> The dev server does not die. It keeps answering, and it answers **HTTP 000** to everything, so
> `check:live` fails every route and the failure looks like the code. **Stop the server, clear
> `.next`, start it again, and wait for `/login` to return 200 before running anything against it.**
> `DECISIONS.md` §147.

**The staging fixtures are `testalpha@`, `testalpha2@`, `testbeta@`, `testgamma@example.com`.**
Gamma is the empty one — chemical manufacturing, Oregon. All four are in
`scripts/fixtures/staging-testdata.js`, which `scripts/seed-staging-testdata.js` and
`scripts/db-restore.js` both import so the count has one definition.

**The test fixture for attachments is `tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf`** —
a deliberately wrong staff policy, and every assertion in `check:live --only attachment` is a
statement the PDF actually makes.
