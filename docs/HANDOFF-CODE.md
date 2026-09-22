# Handoff — the state of the code

**Rewritten 22 September 2026. Every figure below came from a command run today, and the command is
shown.** Nothing here is carried over from the previous handoff, and nothing is from memory. Where a
figure is not measured, it says so.

**If you are the next chat: read `CLAUDE.md` first (especially §9a), then `HOW-WE-BUILD.md` §11 and
§12, then `docs/SCHEMA.md` for the database. This file is state, not method.**

---

## 1. Git

```
$ git log --oneline -6
28e6709 Close the owed reset, and fix a pre-flight that had not parsed since 15 September
e3344f9 Load the switches before the expressions that reference them
ac227e6 Stop schema-doc parsing from the first brace, and let the restore resume
616a337 Make the worksheet the library again, and keep content out of migrations
cc81821 Correct three documents that called a fixed thing broken
e5b7bd6 Add npm run db:restore, and find that the seed files no longer rebuild the library
```

---

## 2. Migration state — BOTH ENVIRONMENTS ON 030. THE GAP IS CLOSED.

```
$ npx supabase db query --project-ref <staging> --linked --agent no -o json \
    "select count(*)::int migs, max(version) latest from supabase_migrations.schema_migrations"
  {"latest": "030", "migs": 31}

$ same query against <SUPABASE_PROD_REF>
  {"latest": "030", "migs": 31}
```

| | staging | production |
|---|---|---|
| Latest migration | **030** | **030** |
| Count | 31 | 31 |
| Tables in `public` | 29 | 29 |

**029 and 030 were applied to production on 22 September** — the owner ran `npm run preflight`
(pending was exactly those two), then `npm run db:migrate:prod`. Their objects are on production and
were checked, not assumed:

```
$ select count(*) from information_schema.tables
   where table_schema='public' and table_name in ('critic_reviews','critic_findings');   -- 2
$ select count(*) from information_schema.columns
   where table_schema='public' and table_name='checklists' and column_name='research_sources'; -- 1, nullable
```

> ### ✅ `DECISIONS.md` §98's OWED RESET IS CLOSED.
>
> `npm run db:restore` ran to completion on staging on 22 September: **31 migrations applied from
> zero**, then all seven data steps, every count matching the file it came from. **§3.7's guarantee
> — that the chain plus the seed files rebuild a database from nothing — is demonstrated rather than
> believed**, for the first time in the project.
>
> **It took three attempts and each failure was a real defect the incremental path had hidden:**
> §118 (the seed files could no longer rebuild the library), §119 (a catalog parser that hunted for
> a brace), §120 (a step order that had never been executable). **None was found by anything except
> running from zero.**

---

## 3. Row counts, both databases, read today

```
$ select (select count(*) from public.companies), … -- one statement per environment
```

| | staging | production |
|---|---|---|
| `requirement_templates` | 205 | **205** |
| — retired / split children | — | 5 / 17 |
| — carrying `applies_expression` | 199 | **199** |
| `agencies` | 33 | **33** |
| `industry_coverage` | 56 | **56** |
| `switches` | 95 | **95** |
| — `depends_on_switch` edges | 40 | **40** |
| `companies` | 3 | **10** |
| `profiles` | 4 | **4** |
| `entities` | 4 | **10** |
| `company_switches` | 16 | **0** |
| `documents` | 0 | **38** |
| `checklists` / `checklist_items` | 0 / 0 | **11 / 235** |
| `obligations` | 0 | **0** |
| `topics` | 0 | **0** |
| `critic_reviews` / `critic_findings` | 0 / 0 | **0 / 0** |

**The library is byte-for-byte the same shape on both** — 205 rows, 5 retired, 17 children, 199
expressions, 95 switches, 40 edges.

> ### **Production still has 235 AI-written checklist rows and ZERO computed obligations.**
>
> Unchanged by any of this week's work, and still the thing that matters most. The deterministic
> spine `CLAUDE.md` §1 calls the whole point of the product **has never produced a row a customer
> has seen.** §68, and §111 decided the fix (a checklist is a hybrid, linked to the obligations it
> satisfies) — **not built.**

**Staging is a freshly rebuilt database.** It holds the library, the three test companies (Test
Alpha Chemical, Test Beta Cannabis, Test Gamma Solvents), four profiles, four sites and the 16
multi-site facts — and nothing else. Every document, checklist, topic, obligation and critic row on
staging was destroyed by the reset, deliberately and with nothing outside staging referencing them.

---

## 4. What `npm run check` covers — AND THE 20 SCRIPTS IT DOES NOT

```
$ npm run check      # typecheck && check:schema && test && build
  check-schema-contracts: ok — 110 files, 30 relations (29 tables + 1 view).
  tests 329 · suites 89 · pass 329 · fail 0
  test-guard: 329 tests, 0 skipped, 0 todo, floor 238. OK
  ✓ Compiled successfully
```

**What it does NOT cover, and each of these has cost a real defect:**

- **No authenticated HTTP request.** A missing grant, a wrong policy or a route guard is invisible
  to all 329 tests. Use `npm run check:live`, which signs in as a real fixture.
- **Nothing checks regulatory content.** A model checking a model produces agreement.
- **⚠ IT EXECUTES 2 OF THIS REPO'S 22 SCRIPTS.** `check:schema` runs
  `scripts/check-schema-contracts.js` and `test` runs `scripts/test-guard.js`; a syntax error in
  either fails the gate. **The other twenty are invisible to it** — `tsconfig.json`'s `include`
  lists `**/*.ts`, `**/*.tsx`, `**/*.mts` and the `.next` type folders and **no `**/*.js` pattern**,
  no test imports a script, and `next build` does not compile `scripts/`. **`scripts/preflight-prod.js`
  sat unparseable from 15 to 22 September while `npm run check` reported green** (§121). Swept
  22 Sep with `node --check` over all 24 tracked `.js`/`.mjs` files: **0 broken.** The proposed fix
  is a `check:syntax` step; it is **not built**, because it changes the commit gate.

---

## 5. Built and verified, by module

| | |
|---|---|
| **M1.0** 7.2a's two routes | `/api/switches/ask`, `/api/switches/answer` — built, driven over HTTP, **no UI caller** |
| **M1.1** `topics` | migration 028, on **both** environments (both now on 030) |
| **M1.2b** frame + prior turns | ⚠ **partly** — prior turns and the frame shipped; the web-search flag it claimed did not exist until M1.9 (§101) |
| **M1.2** follow-up classification | folded into the gate, four kinds |
| **M1.2c** signed turns | HMAC, contiguity, four attacks refused |
| **M1.2d** the conversation surface | committed in `71c2a4d`. The 33 `topics` rows it had written on staging were destroyed by the 22 Sep reset — **`topics` is 0 on both environments today** |
| **M1.2e** the chat layout | done 21 Sep — exchanges stack, composer at the bottom clearing on send, the gate's ask is a message answered in the same box, sources per exchange. Driven over HTTP: 3 exchanges stay, sources 11 · 10, not shared |
| **M1.9** the research answer | free-flowing, sources, search read from the gate. §105's bar met **on one question** |
| **2.3** the critic | built; findings stored (029, **now on production too**) and shown to nobody (§97). 0 rows in either environment |

**Built and reached by nothing:**

```
$ for m in sdsExtraction basis …; do grep -rl "lib/$m" app | wc -l; done
  sdsExtraction  0 files in app/
  basis          0 files in app/
```

## 6. Open defects — where each lives

| | Where | Note |
|---|---|---|
| **The company's industry never reaches the answer** | `lib/determinationGate.ts` — `grep -n industry` returns **nothing** | The gate puts state/county/city in `known` and not the industry. §105 defers it |
| **A fact answered to the gate is lost one turn later** | `app/api/chat/route.ts`, `factsFromGate()` — the filter keeps only `stated_in_question` and `hypothetical` | The `answering` fact is labelled `user_set` (`determinationGate.ts:475`) and is **stored nowhere**, so the filter drops the only copy. Measured: turn 2's sealed turn carries 2 facts and not the generator category |
| **Enum values arrive as free text** | same path | `hazwaste_generator_category` allows `none\|vsqg\|sqg\|lqg`; the value carried was `"small quantity generator"`. `/api/switches/answer` would 400 on it |
| **Citations discarded for every non-research caller** | `lib/ai.ts` — `askAI` returns `.text` only | `/api/audits` runs web search on two calls and drops its sources |
| **`expires_at` set by nothing** | `company_switches` — **0 of 16 rows carry one** on staging (re-read 22 Sep), and **48 of 95 switches are non-static** | v3.1: an expired fact must read `unknown`; a stale `false` is a false green. On the GATE |
| ~~**`substance_inventory` EXECUTE granted to PUBLIC**~~ | migration 013 | **NOT OPEN — corrected 22 Sep.** Migration **019** revoked it on 13 Sep; `pg_proc.proacl` on staging reads `postgres=X \| service_role=X \| authenticated=X`, no PUBLIC and no `anon`. This row, `TODO.md` 4.2b and `AUDIT-CHECKS.md`'s closing paragraph all carried the stale claim |
| ~~**5 of 6 saved research answers have no sources**~~ | pre-030 rows on staging | **Gone with the reset — `checklists` is 0 on staging.** The defect shape is untested rather than fixed: production's 11 checklists predate 030 and **0 carry `research_sources`** |

**Two entries in `TODO.md` that are NOT open, checked this session:** 6.4f's coverage-row defect is
**fixed** (0 mismatched rows; migration 024 did it and the entry was never updated), and 7.2d's
*"42 of 95 have no determination path"* — all 95 carry a `determination_source`; what is missing is
the implementation for 42.

## 7. Decided this session and NOT built

| | |
|---|---|
| **§113 THE OPEN BASELINE** | Research runs **one open call** in production; the gate, facts block, frame/scenario blocks and long prompt **switched off behind config**. `TODO.md` **R1**. A five-question benchmark against raw Claude and ChatGPT found CompliBoard weaker on most |
| **§108 / §110 overnight extraction + 15-day retention** | `TODO.md` M1.3a/b/c. Conversational facts are read overnight from whole conversations and **proposed**, not written |
| **§111 a checklist is a hybrid** | Item 6 decided, §68 resolved. Starts from the obligations that apply; matched items linked; everything else a labelled suggestion |
| **§112 checklists come after research** | The Create tab is untouched by **sequencing**, not by a blocker |
| **§116 chat history is GATED** | Four gates before it ships: the deletion job, a check that it ran, immediate removal on account deletion, the privacy policy |
| **§117 release timing** | ✅ **ANSWERED 22 Sep — every module ships in the first release, no compromise.** Credential rotation and any remaining gate items happen **once, just before launch** |

## 8. The exact next step

**The database work is finished.** Both environments are on 030, staging rebuilds from zero, the
worksheet is authoritative, and the pre-flight runs. None of that is the product.

> ### `TODO.md` **R1.0 + R1.1** — the open baseline, and the config switches that make it reversible.
>
> **Why this and not M1's remaining rows:** §113 found the pipeline subtracting on five questions
> out of five verticals. Everything queued behind it — M1.3's overnight extractor, M1.4's site
> resolution, M1.5's fact display — adds more pipeline. **Building more of a thing measured as
> harmful is the error §113 exists to stop.**
>
> **R1.1 is not optional polish.** Without the switches, running the baseline means deleting work
> and rollback means rewriting it. With them, the release mechanism and the experiment framework
> are the same thing — and §117's answer (every module ships in the first release) makes that
> mechanism the thing the release itself runs on.

**Then, in order:** R1.2 (search that verifies rather than leads) → R1.3 (specialist behaviour and
a specific offer) → R1.4 (company facts) → R1.5 (the gate, at a much higher bar). **Each ships only
if it beats the step before, measured on real questions, benchmarked against an incognito chat
(§115).**

**Do not start with:** M1.3b's extractor (needs M1.3a's retention, which is gated on §116's four
conditions), or 7.2c's trigger (blocks only M1.6, which is behind M1.3c).

**Still on the GATE before a real customer document:** the checklist/obligation reconciliation,
`expires_at`, and **key rotation — the seven leaked credentials plus the born-rotated eighth.**
Production catch-up used to sit beside rotation on that list; **it is done and rotation is not.**

## 9. Two commands worth knowing

```
npm run check        typecheck · schema contracts · 329 tests · build.  Green as of this commit.
npm run check:live   signs in as a real staging fixture and writes as that user. Needs
                     CHECK_LIVE_PASSWORD in .env.local — there is no default any more.
npm run schema:doc   regenerates docs/SCHEMA.md from the live catalog. Runs inside db:migrate.
npm run db:restore   rebuilds STAGING from zero in one command — reset, then the seven data
                     steps, printing got-vs-expected after each from the seed files. Refuses
                     production four ways. `-- --from N` resumes, but re-reads every skipped
                     step's own checks first and refuses if they do not hold.
npm run preflight    READ-ONLY. Prints migrations on disk and migrations applied on production
                     in full, then derives the pending set in front of you.
```

**The staging fixtures are `testalpha@`, `testalpha2@`, `testbeta@`, `testgamma@example.com`.**
Gamma is the empty one — chemical manufacturing, Oregon, and the company `TESTING.md` Case A1 needs.
All four are in `scripts/fixtures/staging-testdata.js`, which `scripts/seed-staging-testdata.js`
and `scripts/db-restore.js` both import so the count has one definition. Gamma was added on 21 Sep
after six days of existing with no script behind it. **All three companies were rebuilt by the
22 Sep restore and are present.**
