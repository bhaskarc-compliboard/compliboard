# Handoff — the state of the code

**Written 21 September 2026, at the end of the session. Every figure below came from a command, and
the command is shown.** Nothing here is from memory. Where a figure is not measured, it says so.

**If you are the next chat: read `CLAUDE.md` first (especially §9a), then `HOW-WE-BUILD.md` §11 and
§12, then `docs/SCHEMA.md` for the database. This file is state, not method.**

---

## 1. Git

```
$ git log --oneline -6
cd93369 Read conversations overnight instead of guessing fact by fact as they happen
c0ef608 Put each source behind the number that cites it, and close the seams
3f8fb0e Put the answer's sources back, and stop breaking its sentences to do it
91ab9e9 Let the research answer find its own shape, and give it what the question is about
71c2a4d Keep the critic's working notes, stop showing them, and stop a crash on the customer's path
9b89a4a Reverse the order of the workspace module, and settle five decisions about its first writer
```

**Everything in this session is committed and pushed** — including `M1.2e` (the chat layout), the
schema generator, and the records below. `git status --porcelain` is empty at the commit this file
lands in.

> **One thing to know about `71c2a4d`:** M1.2d — the browser holding and sending turns — shipped
> inside it and **its commit message does not mention turns, topics or conversations.** The
> `TODO.md` row went unticked for a day and a status report then recommended building what was
> already built (`DECISIONS.md` §65, twelfth instance). **Tick the row in the same commit as the
> code.**

## 2. Migration state — staging is TWO AHEAD of production

```
$ npx supabase db query --project-ref amzsavsrabrlcprltpom --linked \
    "select count(*) n, max(version) latest from supabase_migrations.schema_migrations"
  {'latest': '030', 'n': 31}

$ npx supabase db query --project-ref <SUPABASE_PROD_REF> --linked   # same query
  {'latest': '028', 'n': 29}
```

| | staging | production |
|---|---|---|
| Latest migration | **030** | **028** |
| Count | 31 | 29 |

**Not on production: 029 (`critic_reviews` / `critic_findings`) and 030
(`checklists.research_sources`).** Both are additive — new tables, one new nullable column, no
`ALTER` of anything existing. **Shipping them needs `npm run preflight` then
`npm run db:migrate:prod`, run by the owner.**

**A reset is OWED for both** — `DECISIONS.md` §98. They were applied with `db:migrate`, so §3.7's
guarantee (the chain builds a database from nothing) is unmet for them. **The precondition is
`TODO.md` 0.10**, the one-command restore, because a reset today is eight manual steps.

> ### Update, 22 September — STILL OWED, and now one command away.
>
> **0.10 is built** (`npm run db:restore`) and **6.3c is decided and done** (`DECISIONS.md` §118):
> the worksheet was rebuilding only 194 of the library's 205 rows, because migration 013 put eleven
> requirement rows inside a migration and a from-zero run skips it. `supabase/seed-data/REQUIREMENTS.xlsx`
> now carries all 205, and the restore's read-only pre-flight reads **205 = 205** on every library
> line with the three seed files agreeing.
>
> **What has NOT happened: the restore has never been run to completion.** Step 1 is interactive by
> design — a human types RESET — and that run was not performed. **The owed reset closes when all
> eight steps pass, and not before.** One command, from an interactive terminal on a machine
> pointed at staging:
>
> ```
> npm run db:restore
> ```
>
> It will destroy, and nothing rebuilds: 430 obligations, 62 critic_findings, 33 topics, 20
> checklist_items, 13 checklists, 4 critic_reviews, 3 switch_determinations. **Confirmed nothing
> outside staging references any of them** — all 62 finding ids and all 4 review ids grepped across
> the repo: 0 matches, and `baseline-outputs/` is a production export from a database that has no
> critic tables at all.

> ### WHAT ACTUALLY HAPPENED, 22 September — READ THIS BEFORE RUNNING ANYTHING.
>
> The owner ran it. **All 31 migrations applied from zero — the chain builds the schema from
> nothing, which is what `CLAUDE.md` §3.7 and §98 wanted proved.** Then step 1 died in
> `scripts/schema-doc.js` and **steps 2-8 never ran.**
>
> **STAGING RIGHT NOW: full schema, NO LIBRARY.** 0 requirement_templates, 0 agencies, 0 switches,
> 0 companies. That is §98's vacuous-pass state — every check that reads the library will pass
> against nothing. **Do not trust a green result from staging until the restore is finished.**
>
> The crash is fixed (`DECISIONS.md` §119) and **the restore no longer needs repeating from the
> top.** The schema is already correct, so:
>
> ```
> npm run db:restore -- --from 5      # steps 2-4 already loaded; 5 is now the SWITCHES
> ```
>
> **Steps 2, 3 and 4 have since loaded clean** — 205 requirement rows, 33 agencies, 56 coverage
> rows, 198 with an agency. Step 5 then failed because 0.10's documented order ran the expressions
> before the switches they reference (`DECISIONS.md` §120): **216 errors, nothing written.** The
> order is fixed and the two are swapped, so **step 5 is now `load-switches.js`** and the resume
> gate has been checked against today's counts — 31 / 205 / 33 / 56 / 198, all passing.
>
> It re-reads step 1's own check first (`migrations applied 31 = 31`) and refuses if the database
> is not where `--from` claims. It needs no terminal prompt — only step 1 does.
>
> **The owed reset closes when steps 2-8 finish and every count matches.** Migration-wise the
> from-zero proof is already in hand; what is missing is the data.

## 3. Production row counts — the number that matters most

```
$ npx supabase db query --project-ref <prod> --linked "select 'obligations', count(*) …"
  checklist_items          235
  checklists                11
  companies                 10
  company_switches           0
  documents                 38
  obligations                0
  requirement_templates    205
  switches                  95
```

> ### **Production has 235 AI-written checklist rows and ZERO computed obligations.**
>
> The deterministic spine `CLAUDE.md` §1 calls the whole point of the product **has never produced
> a row a customer has seen.** Every "what you must do" any real person has read here was written
> by a model. `DECISIONS.md` §68, and §111 decided the fix (a checklist is a hybrid, linked to the
> obligations it satisfies) — **not built.**

## 4. What `npm run check` covers

```
$ python3 -c "…package.json…"
  check = npm run typecheck && npm run check:schema && npm run test && npm run build
  typecheck    = tsc --noEmit
  check:schema = node scripts/check-schema-contracts.js
  test         = node scripts/test-guard.js
  build        = next build

$ npm run test
ℹ tests 329 · suites 89 · pass 329 · fail 0
  test-guard: 329 tests, 0 skipped, 0 todo, floor 238. OK
```

**What it does NOT cover, and this has cost real defects:**

- **No authenticated HTTP request.** A missing grant, a wrong policy or a route guard is invisible
  to all 329 tests — `/api/obligations` 500'd for every real caller through six phases. Use
  `npm run check:live` (signs in as a real fixture) and drive routes as a signed-in user.
- **`check:schema` validates query strings against `lib/database.types.ts` offline.** It caught
  `critic_reviews` missing from `/api/account` DELETE on the day the table was created. It has one
  blind spot, documented in the script: `.from(variable)` cannot be attributed.
- **Nothing checks regulatory content.** A model checking a model produces agreement.

## 5. Built and verified, by module

| | |
|---|---|
| **M1.0** 7.2a's two routes | `/api/switches/ask`, `/api/switches/answer` — built, driven over HTTP, **no UI caller** |
| **M1.1** `topics` | migration 028, on **both** environments |
| **M1.2b** frame + prior turns | ⚠ **partly** — prior turns and the frame shipped; the web-search flag it claimed did not exist until M1.9 (§101) |
| **M1.2** follow-up classification | folded into the gate, four kinds |
| **M1.2c** signed turns | HMAC, contiguity, four attacks refused |
| **M1.2d** the conversation surface | committed in `71c2a4d`; **33 `topics` rows on staging** |
| **M1.2e** the chat layout | **done this session** — exchanges stack, composer at the bottom clearing on send, the gate's ask is a message answered in the same box, sources per exchange. Driven over HTTP: 3 exchanges stay, sources 11 · 10, not shared |
| **M1.9** the research answer | free-flowing, sources, search read from the gate. §105's bar met **on one question** |
| **2.3** the critic | built; findings now stored (029) and shown to nobody (§97) |

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
| **`expires_at` set by nothing** | `company_switches` — **0 of 19 rows** | v3.1: an expired fact must read `unknown`; a stale `false` is a false green |
| ~~**`substance_inventory` EXECUTE granted to PUBLIC**~~ | migration 013 | **NOT OPEN — corrected 22 Sep.** Migration **019** revoked it on 13 Sep; `pg_proc.proacl` on staging reads `postgres=X \| service_role=X \| authenticated=X`, no PUBLIC and no `anon`. This row, `TODO.md` 4.2b and `AUDIT-CHECKS.md`'s closing paragraph all carried the stale claim |
| **5 of 6 saved research answers have no sources** | pre-030 rows | They render markers with no list |

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
| **§117 release timing** | **OPEN, and the owner's.** Release now and improve module by module, or after every module's pass |

## 8. The exact next step

> ### `TODO.md` **R1.0 + R1.1** — the open baseline, and the config switches that make it reversible.
>
> **Why this and not M1's remaining rows:** §113 found the pipeline subtracting on five questions
> out of five verticals. Everything queued behind it — M1.3's overnight extractor, M1.4's site
> resolution, M1.5's fact display — adds more pipeline. **Building more of a thing measured as
> harmful is the error §113 exists to stop.**
>
> **R1.1 is not optional polish.** Without the switches, running the baseline means deleting work
> and rollback means rewriting it. With them, the release mechanism and the experiment framework
> are the same thing.

**Then, in order:** R1.2 (search that verifies rather than leads) → R1.3 (specialist behaviour and
a specific offer) → R1.4 (company facts) → R1.5 (the gate, at a much higher bar). **Each ships only
if it beats the step before, measured on real questions, benchmarked against an incognito chat
(§115).**

**Do not start with:** M1.3b's extractor (needs M1.3a's retention, which is gated on §116's four
conditions), or 7.2c's trigger (blocks only M1.6, which is behind M1.3c).

## 9. Two commands worth knowing

```
npm run check        typecheck · schema contracts · 329 tests · build.  Green as of this commit.
npm run check:live   signs in as a real staging fixture and writes as that user. Needs
                     CHECK_LIVE_PASSWORD in .env.local — there is no default any more.
npm run schema:doc   regenerates docs/SCHEMA.md from the live catalog. Runs inside db:migrate.
```

**The staging fixtures are `testalpha@`, `testalpha2@`, `testbeta@`, `testgamma@example.com`.**
Gamma is the empty one — chemical manufacturing, Oregon, and the company `TESTING.md` Case A1 needs.
All four are in `scripts/seed-staging-testdata.js`; Gamma was added there on 21 Sep after six days
of existing with no script behind it.
