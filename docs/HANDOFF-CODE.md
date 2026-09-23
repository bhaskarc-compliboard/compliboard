# Handoff — the state of the code

**Rewritten 22 September 2026, after RUN 1. Every figure below came from a command run today, and
the command is shown.** Nothing here is carried over from the previous handoff, and nothing is from memory. Where a
figure is not measured, it says so.

**If you are the next chat: read `CLAUDE.md` first (especially §9a), then `HOW-WE-BUILD.md` §11 and
§12, then `docs/SCHEMA.md` for the database. This file is state, not method.**

---

## 1. Git

```
$ git log --oneline -5
4915e5d The from-zero restore refused migration 031, and it was right
1510403 Run 2: the nightly jobs, and conversion with scope and provenance
1821601 Run 2: conversations persist, and counters record events
5c2994f Searching is not one round: the narration rule leaked and is corrected
2c812e8 Add an env-controlled reasoning effort to the open call
```

## 2. Migration state — STAGING 036, PRODUCTION 030. THE GAP IS BACK, BY DESIGN.

| | staging | production |
|---|---|---|
| Latest migration | **036** | **030** |
| Count | 37 | 31 |
| Tables in `public` | 33 | 29 |

**Not on production: 031–036** — `turns` and the topic lifecycle, `usage_counters`,
`origin`/`from_topic_id`, `fact_proposals`/`job_runs`, the counter function, and
`checklist_items.source_title`. All additive; nothing drops or alters an existing column.
**Shipping them is `npm run preflight` then `npm run db:migrate:prod`, run by the owner.**

> ### ✅ AND THE CHAIN STILL BUILDS FROM ZERO — re-proved 23 September on 000–036.
>
> `npm run db:restore` ran to completion: **37 migrations against an empty database**, then all
> seven data steps, every count matching its source file.
>
> **That run REFUSED migration 031 the first time, and it was right.** 031 tested its CHECK
> constraint by violating it — `insert … select id from public.companies limit 1` — which on an
> empty database inserts **zero rows and raises nothing**, so the probe "succeeded" and control
> fell through to its own failure `raise`. It had applied cleanly to staging an hour earlier.
> **§98 catching this run's own work**, and the third real defect that rule has found.

## 3. Row counts, read 23 September

```
$ select (select count(*) from public.requirement_templates), … -- one statement per environment
```

| | staging | production |
|---|---|---|
| `requirement_templates` | 205 | **205** |
| — carrying `applies_expression` | 199 | **199** |
| `agencies` · `industry_coverage` · `switches` | 33 · 56 · 95 | **33 · 56 · 95** |
| `companies` · `profiles` · `entities` | 3 · 4 · 4 | **10 · 4 · 10** |
| `company_switches` | 16 | **0** |
| `documents` | 0 | **38** |
| `checklists` / `checklist_items` | 0 / 0 | **11 / 235** |
| `obligations` | 0 | **0** |
| `turns` · `topics` · `usage_counters` | 0 · 0 · 0 | *(table does not exist)* |
| `fact_proposals` · `job_runs` | 0 · 0 | *(table does not exist)* |

> **Staging's conversation tables are empty because the from-zero restore ran after the proofs.**
> Everything in §125 was driven on staging and passed — a conversation saved and reopened, the
> summariser and deleter run end to end, account deletion proved on a throwaway fixture — and then
> the restore wiped it, which is what a restore does. The proofs are in §125 and in `check:live`,
> which re-creates them on demand.

> ### **Production still has 235 AI-written checklist rows and ZERO computed obligations.**
>
> Unchanged by Runs 1 and 2, and still the thing that matters most. §68, and §111 decided the fix
> — **not built**, and deliberately not touched by this run.

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
- **Nothing checks regulatory content.** A model checking a model produces agreement. **R1 did
  not change this** — the three benchmark answers were timed, not scored.
- **`npm run check:live` now drives `/api/chat` too**, as `testgamma`, in both modes: that research
  streams and carries sources, that the checklist shape is intact, and that a follow-up names the
  prior subject. It needs a server at `CHECK_LIVE_BASE_URL` (default `http://localhost:3000`) and
  **skips loudly** when there is none, so `npm run db:migrate` is not blocked by a dev server
  being down.
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
| **R1.0** the open baseline | ✅ **22 Sep** — research and checklist run one open streaming call. One sentence of role, search the model decides on, history as plain pairs. `lib/ai.ts` `askAIOpenStream` |
| **R1.1** the six switches | ✅ **22 Sep** — `lib/pipelineConfig.ts`. All default OFF. Off means the path is **not entered**: `/api/chat` branches before the gate block |
| **micro-steps** | ✅ **22 Sep** — background, 3 in flight, never lost and never repeated, sources inherited from the parent item |

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

> ### RUN 3 — the page.
>
> `prototypes/compliance-workspace.html` is the design reference and is **read by Run 3**. Runs 1
> and 2 deliberately did not build from it: the page got a stream reader, a history payload, an
> abort controller and one line to keep the topic id, and nothing else.
>
> **Everything Run 3 needs on the server now exists** — a conversation that persists and reopens
> (`GET /api/topics/<id>`), counters to display, conversion with scope, and a documents route that
> accepts `from_topic_id`.

**What Run 2 did NOT finish, and Run 3 or later owns:**

- **The client half of Task 5.** `documents.from_topic_id` exists and `/api/documents` accepts it
  with the same ownership check the folder gets, but **nothing sends it yet** — the research
  upload still parses a file inline without creating a document row. That is page work.
- **A history list, a summary view, a proposals screen.** All four nightly artifacts —
  summaries, `fact_proposals`, `job_runs`, counters — are written and **read by nothing on
  screen**. §9a's rule: a thing is done when something real uses it, and these are half done.
- **§111's hybrid.** Still deferred. `origin` records provenance; nothing links an item to an
  obligation.
- **Gate 4, the privacy policy.** Three of §116's four retention gates are built; this one is the
  owner's and cannot be built here.

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
