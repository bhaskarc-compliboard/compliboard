# Handoff — the state of the code

**State sections rewritten 28 September 2026, after Documents rev 1 shipped to production. Every
figure below came from a command run today, and the command is shown.** Nothing is from memory.
Where a figure is not measured, it says so.

*(§1–§4 were rewritten on 28 September. §5–§9 keep their 23 September text except where a fact in
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

```
$ git log --oneline -5
2f4d380 Read it again survives closing the drawer
5bf3b7e Bake-off part 2: six answer keys corrected, 147 answers re-judged
f2dcbc7 The bake-off: seven configurations, 135 answers, and four answer keys that are wrong
6301b73 Bake-off: the runs from configurations 1 to 5
8fd5588 Bake-off report: the table that tells a spec problem from a model problem
```

One branch, `main`, tracking `origin/main`.

**⚠ THE LOCAL TREE IS AHEAD OF PRODUCTION.** The commit deployed is the one pushed on **26 September**
with Documents rev 1. Everything since — the bake-off, the six answer-key corrections and the
"Read it again" fix — is committed locally and **not pushed**. `git log origin/main..HEAD` is the list.
A push to `main` deploys (`RELEASE.md`), so that list is also the next release's contents.

## 2. Migration state — 054 ON BOTH. NOTHING PENDING.

*(Rewritten 28 September 2026. This section was headed "039 ON BOTH" and had been since 23 September;
migrations 040–054 went to production on the 26th.)*

```
$ ls supabase/migrations/*.sql | wc -l
55                                    # 000 … 054

$ npm run preflight          # READ-ONLY. Prints both lists and derives the difference.
  PENDING COUNT: 0           # production, dsfwmafnphdlfogetsus
```

**Nothing is pending on either database. Both are on `000`–`054`, 55 migrations each.** The fifteen
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

## 9. Commands worth knowing

```
npm run check         typecheck · schema contracts · 544 tests · build. Green as of this commit.
                      (was written as 457 until 28 Sep; the committed floor had been 528 for days.)
npm run check:live    signs in as a real staging fixture and writes as that user.
  -- --only sources      the third-turn citation step alone
  -- --only attachment   attach a PDF and ask about it (Fix Round 2)
npm run cost          READ-ONLY. Where the money went, and what the total does not include.
npm run golden:facts  the owner's five questions, three runs each, priced.
  -- --model claude-sonnet-5   compare a model WITHOUT changing any default
npm run schema:doc    regenerates docs/SCHEMA.md from the live catalog. Runs inside db:migrate.
npm run db:restore    rebuilds STAGING from zero. Refuses production four ways.
npm run preflight     READ-ONLY. Both migration lists, and the pending set derived in front of you.
```

**The staging fixtures are `testalpha@`, `testalpha2@`, `testbeta@`, `testgamma@example.com`.**
Gamma is the empty one — chemical manufacturing, Oregon. All four are in
`scripts/fixtures/staging-testdata.js`, which `scripts/seed-staging-testdata.js` and
`scripts/db-restore.js` both import so the count has one definition.

**The test fixture for attachments is `tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf`** —
a deliberately wrong staff policy, and every assertion in `check:live --only attachment` is a
statement the PDF actually makes.
