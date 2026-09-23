# Handoff — the state of the code

**Rewritten 23 September 2026, after FIX ROUND 1. Every figure below came from a command run
today, and the command is shown.** Nothing is carried over from the previous handoff and nothing
is from memory. Where a figure is not measured, it says so.

**If you are the next chat: read `CLAUDE.md` first (especially §9a), then `HOW-WE-BUILD.md` §11
and §12, then `docs/SCHEMA.md` for the database. This file is state, not method.**

---

## 1. Git

```
$ git log --oneline -5
1d61f28 Fix round 1 F+I+G: R1.3 behind a switch, a summary that speaks to its reader, and five golden facts
b76e306 Fix round 1 C+D+E: history keeps its sources, tables keep their shape, and a drawer prints itself
3c56843 Fix round 1 A+B: a stream that ends is not a stream that finished
4f2f08f Record Run 3, and say plainly that the screen is unproven
a5587af Run 3: the page, rebuilt from the prototype
```

## 2. Migration state — STAGING 037, PRODUCTION 030

```
$ npm run preflight          # READ-ONLY. Prints both lists and derives the difference.
  INPUT 1 — supabase/migrations/, every file (38)
  INPUT 2 — supabase_migrations.schema_migrations on dsfwmafnphdlfogetsus, every row (31)
  PENDING COUNT: 7
```

**Not on production: 031–037** — `turns` and the topic lifecycle, `usage_counters`,
`origin`/`from_topic_id`, `fact_proposals`/`job_runs`, the counter function,
`checklist_items.source_title`, and **037, the storage bucket**. All additive; nothing drops or
alters an existing column. **Shipping them is `npm run preflight` then `npm run db:migrate:prod`,
run by the owner.**

> ### 037 IS A NO-OP ON BOTH LIVE DATABASES, AND IT STILL BELONGS IN THE CHAIN.
>
> `company-documents` exists on staging since 2026-09-09 and on production since 2026-06-03. What
> 037 fixes is the **from-zero** case: migration 002 writes four storage policies against a bucket
> no migration creates, so a database built from this chain gets the policies and nothing for them
> to apply to, and the first upload fails with `Bucket not found`. §127, recorded beside §98 and
> §118 as the same class.

## 3. Row counts, read 23 September

Staging, read with the service role:

```
topics 20 · turns 65 · checklists 8 · checklist_items 126 · usage_counters 1
fact_proposals 0 · job_runs 1 · documents 2 · companies 3
buckets: company-documents (public=false)
```

Production's row counts are **not in this handoff**, and that is deliberate:
`SUPABASE_PROD_URL` and `SUPABASE_PROD_SERVICE_ROLE_KEY` are **blank** in `.env.local` — which
`CLAUDE.md` §3.8 says is the better default — so the only production access from this machine is
`npm run preflight` and the Supabase CLI with `SUPABASE_PROD_REF`. The last measured production
counts are in `DECISIONS.md` §126's handoff and are now a day old. **Do not quote them as
current.**

> ### **Production still has 235 AI-written checklist rows and ZERO computed obligations.**
>
> Unchanged by Runs 1–3 and by this fix round, and still the thing that matters most. §68, and
> §111 decided the fix — **not built**, and deliberately not touched.

## 4. What `npm run check` covers — AND WHAT IT DOES NOT

```
$ npm run check      # typecheck && check:schema && test && build
  check-schema-contracts: ok — 137 files, 34 relations (33 tables + 1 view).
  tests 440 · pass 440 · fail 0
  test-guard: 440 tests, 0 skipped, 0 todo, floor 440. OK
  ✓ Compiled successfully
```

**Fix round 1 is the clearest evidence yet of what this gate cannot see.** Nine defects, found by
the owner using the product. **Every one of them had a green `npm run check` behind it** — an
answer that stopped silently, a table cut in half, a drawer that printed the page behind it, a
summary that named a character the product does not have. The gate answers *"does the code build
and behave"*. None of those nine was that question.

- **No authenticated HTTP request.** A missing grant, a wrong policy or a route guard is invisible
  to all 440 tests. `npm run check:live` signs in as a real fixture.
- **Nothing checks regulatory content.** A model checking a model produces agreement.
  `npm run golden:facts` is a **presence check on plain text**, not a verification.
- **⚠ IT EXECUTES 2 OF THIS REPO'S SCRIPTS** — `check-schema-contracts.js` and `test-guard.js`.
  `tsconfig.json`'s `include` has no `**/*.js` pattern, so the rest are invisible to it.
  `scripts/preflight-prod.js` sat unparseable from 15 to 22 September while the gate said green
  (§121). The proposed fix is a `check:syntax` step; **not built**, because it changes the commit
  gate.

> ### `tsconfig.json` NOW EXCLUDES `.next/**/* ?.*`, AND THE REASON MATTERS TO THE NEXT PERSON.
>
> A file-sync tool on this machine duplicates generated files — `routes.d 2.ts`,
> `cache-life.d 3.ts`, **936 of them**, all under `.next/`. `tsc` then sees Next's own globals
> declared twice and fails with TS6200 on code nobody wrote, so the gate flipped red and green
> depending on whether the sync had run. TypeScript's globber has `*`, `?` and `**` and **no
> character classes**, which is why the first attempt (`* [0-9].*`) silently matched nothing.

## 5. The three commands that cost money, and when to run them

```
npm run check:live    signs in as a real staging fixture and writes as that user.
                      Needs CHECK_LIVE_PASSWORD. Last run 23 Sep: 16 steps pass, 1 fails —
                      `sources`, the known gap in §6. Everything else is green.
npm run golden        the determination-gate golden cases (the gate is off everywhere).
npm run golden:facts  the owner's five questions, with the facts each answer must contain.
                      On demand. NEVER in `npm run check` — every case is a real searching answer.
  -- seattle                    one case
  -- --effort medium --runs 3   the effort comparison (§127 H)
```

## 6. Open defects — where each lives

| | Where | Note |
|---|---|---|
| **A third turn will not stand by its own citations** | `lib/historySources.ts`; `check:live` step `sources` | **The fix asked for is in and works** — history carries its numbered sources on all three replay paths. Asked *directly* whether the sources were real, the model still hedges, because history is replayed as plain text and the `server_tool_use` blocks are not stored. §127 C has the measured wordings and the two ways to close it, **both of which are the owner's call** |
| **The company's industry never reaches the answer** | `lib/determinationGate.ts` — `grep -n industry` returns nothing | The gate puts state/county/city in `known` and not the industry. §105 defers it |
| **A fact answered to the gate is lost one turn later** | `app/api/chat/route.ts`, `factsFromGate()` | The `answering` fact is labelled `user_set` and stored nowhere, so the filter drops the only copy. **Gate is off everywhere; this is dormant** |
| **Enum values arrive as free text** | same path | `hazwaste_generator_category` allows `none\|vsqg\|sqg\|lqg`; the value carried was `"small quantity generator"`. Dormant for the same reason |
| **Citations discarded for every non-research caller** | `lib/ai.ts` — `askAI` returns `.text` only | `/api/audits` runs web search on two calls and drops its sources |
| **`expires_at` set by nothing** | `company_switches` | An expired fact must read `unknown`; a stale `false` is a false green. On the GATE |
| **`lib/answerDisplay.ts` has no callers** | `grep -rn answerDisplay app lib components` returns only the file itself | Orphaned by Run 3's `AnswerBody`. ~20 tests still run against it, so the suite is partly testing code nothing uses. **Not deleted** — that is a decision, not a fix |
| **`outcome: 'ask'` is not rendered** | `components/archive/GateAskCard.tsx` | Both gate switches are off; turning either on leaves the question unrendered. **R1.5** |

## 7. The exact next step

> ### THE OWNER'S PASS. The research/checklist section is code-complete and unsigned-off.
>
> **`docs/TESTING.md`'s R3 finish-line set (ten actions) and the FIX ROUND 1 set (four).** The
> four are: **attach a file and see it classified · an answer that stops on its own · a third
> turn standing by its sources · print a drawer.** Each is there because the failure was silent.
>
> **Nothing in this repository claims either set has been run.**

**Then, on what the pass finds:** R1.2 (`RESEARCH_PREFER_GOV`) and R1.3 (`RESEARCH_SPECIALIST`)
are both ON in `.env.local` and **unset in production**. Each ships only if the owner's comparison
says it beats the step before, benchmarked against an incognito chat (§115). §127 F prints both
prompts before and after.

## 8. Commands worth knowing

```
npm run check        typecheck · schema contracts · 440 tests · build.  Green as of 1d61f28.
npm run check:live   signs in as a real staging fixture. Needs CHECK_LIVE_PASSWORD.
npm run schema:doc   regenerates docs/SCHEMA.md from the live catalog. Runs inside db:migrate.
npm run db:restore   rebuilds STAGING from zero — reset, then the data steps, printing
                     got-vs-expected after each. Refuses production four ways. `-- --from N`
                     resumes and re-checks every skipped step first.
npm run preflight    READ-ONLY. Prints migrations on disk and applied on production in full,
                     then derives the pending set in front of you.
```

**The staging fixtures are `testalpha@`, `testalpha2@`, `testbeta@`, `testgamma@example.com`.**
Gamma is the empty one — chemical manufacturing, Oregon. All four are in
`scripts/fixtures/staging-testdata.js`, which `scripts/seed-staging-testdata.js` and
`scripts/db-restore.js` both import so the count has one definition.
