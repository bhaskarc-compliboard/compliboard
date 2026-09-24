# Handoff — the state of the code

**Rewritten 23 September 2026, after Fix Round 2 shipped to production. Every figure below came
from a command run today, and the command is shown.** Nothing is carried over from the previous
handoff and nothing is from memory. Where a figure is not measured, it says so.

**If you are the next chat: read `CLAUDE.md` first (especially §9a), then `HOW-WE-BUILD.md` §11
and §12, then `docs/SCHEMA.md` for the database. This file is state, not method.**

> ### THE TWO HANDOFFS ARE HERE — AND §8 HAS NOT YET BEEN RECONCILED WITH THEM.
>
> `docs/HANDOFF-LAYOUT.md` and `docs/HANDOFF-DOCUMENTS.md` **are in `docs/`** (both written
> 23 September). An earlier version of this file said they did not exist; they were placed while
> that check was running and were swept into an unrelated commit, which is why this banner said
> otherwise for a day.
>
> **What is still owed:** §8's next steps below are this file's own reading of the state, not
> their plan, and `HANDOFF-DOCUMENTS.md` §8's parked list is still not in `TODO.md`. Read the two
> handoffs directly until that second pass happens.

---

## 1. Git

```
$ git log --oneline -5
ede8996 Fix round 2: an attached file is part of the conversation, and "Read as:" needs no article
8a4b8bc Corrected prices: Opus 5 is $5/$25, not $15/$75 — every cost figure was ~2.8x too high
2f91730 Record §128: four decisions, the cost ledger, and the model comparison
e2922c0 Section J: a cost ledger written at the call, and the model comparison it makes possible
6ca3d1d Owner's decisions 1-4: medium by default, a provenance switch, the orphan gone, three runs
```

One branch, `main`, tracking `origin/main`.

## 2. Migration state — 039 ON BOTH. THE GAP IS CLOSED.

```
$ npm run preflight          # READ-ONLY. Prints both lists and derives the difference.
  INPUT 1 — supabase/migrations/, every file (40)
  INPUT 2 — supabase_migrations.schema_migrations on dsfwmafnphdlfogetsus, every row (40)
  PENDING COUNT: 0

$ …schema_migrations on amzsavsrabrlcprltpom (staging)
  applied 40, latest 039
```

**Nothing is pending on either database.** The 031–039 gap that stood through Runs 1–3 and both
fix rounds was closed by the owner after Fix Round 2. The last three are worth naming because
they are recent and each exists for a reason a reader will otherwise ask about:

| | |
|---|---|
| **037** | The `company-documents` bucket. Migration 002 wrote four storage policies against a bucket **no migration created**, so a from-zero build got the policies and nothing for them to apply to. A no-op on both live databases; it exists for the next database built from this chain (§127 B, recorded beside §98 and §118). |
| **038** | `ai_calls`, the cost ledger. Stores **the prices each call was costed at**, so correcting `config/pricing.ts` cannot rewrite what a past call cost (§128 J). |
| **039** | `turns.document_id` / `turns.document_name`. The link that makes an attached file part of the conversation. The name is a **copy**, so a transcript still reads correctly after the document is deleted (§129). |

## 3. Production

**The research section is live on production.** Deployment facts below are the owner's, recorded
as such — **this session has no way to read Vercel**, and it did not try.

- **No staging deployment exists.** One environment on Vercel: Production, from `main`.
- **Vercel Production variables are set. By name only** — this file never carries a value:
  `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` ·
  `ANTHROPIC_API_KEY` · `CRON_SECRET` · `RESEND_API_KEY` · `FEEDBACK_EMAIL`
- **Deliberately NOT set in Production**, and that is what makes production the open baseline:
  `RESEARCH_GATE` · `RESEARCH_FACTS_BLOCK` · `RESEARCH_LONG_PROMPT` · `CHECKLIST_GATE` ·
  `CHECKLIST_CRITIC` · `CHECKLIST_LONG_PROMPT` · `RESEARCH_PREFER_GOV` ·
  `RESEARCH_SPECIALIST` · `RESEARCH_PROVENANCE`. Every switch defaults OFF and an unset variable
  IS the product's behaviour (`lib/pipelineConfig.ts`). The last three are ON in `.env.local`
  only, for the owner's comparison, and ship only if that comparison says so.
> ### ⚠ `.env.local` IS HAIKU. PRODUCTION IS OPUS 5 / SONNET 5, BY DESIGN.
>
> The standing rule (`CLAUDE.md` §3.4a, `DECISIONS.md` §130) points `AI_MODEL_PROSE`,
> `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS` and `AI_MODEL_SUMMARY` at `claude-haiku-4-5` **on a
> development machine only**. Those four variables are **unset in Vercel Production**, so it runs
> the code defaults. Do not read a local answer's quality as the product's:
> `npm run golden:facts -- --model claude-opus-5` is how you ask that question.
>
> Haiku **refuses `output_config.effort`** (400), so `lib/ai.ts` drops it below the 5 family.
> `DEV_MAX_SEARCHES=2` caps searches whenever `NODE_ENV` is not production.

- **Model and effort:** `AI_MODEL_PROSE` / `AI_MODEL_JUDGEMENT` are unset in Production, so both
  fall back to the code default. `AI_EFFORT` is unset and `lib/ai.ts` `DEFAULT_EFFORT` is
  **`medium`** — a code default, not an environment one, so the two cannot disagree (§128).
- **Cron:** `vercel.json` schedules `/api/jobs/summarise` at 03:00 and `/api/jobs/delete` at
  03:30. Both refuse when `CRON_SECRET` is **unset** and answer 404, so the route cannot be
  confirmed to exist by probing it.

## 4. Row counts, staging, read today

```
requirement_templates 205 (200 live) · agencies 33 · switches 95 · industry_coverage 56
companies 3 · obligations 0
topics 63 · turns 217 (4 carrying a document) · checklists 16 · checklist_items 243
documents 6 · document_reviews 5 · ai_calls 78 · fact_proposals 0 · job_runs 1 · usage_counters 1
```

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
  check-schema-contracts: ok — 142 files, 35 relations (34 tables + 1 view).
  tests 457 · pass 457 · fail 0
  test-guard: 457 tests, 0 skipped, 0 todo, floor 457. OK
  ✓ Compiled successfully
```

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
> **`lib/documentReview.ts` passes no `ledger:` argument** — `grep -n ledger
> lib/documentReview.ts` returns nothing — so **every document scan is missing from this table.**
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
npm run check         typecheck · schema contracts · 457 tests · build. Green as of this commit.
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
