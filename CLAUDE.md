@AGENTS.md

# CompliBoard — Project Rules for Claude Code

**Updated:** 7 October 2026 — §3.4a: the guard, `npm run haiku -- <command>` (§168); the owner's `.env.local` is still on Haiku.
7 October 2026 — §3.4a: the laptop runs Opus, Claude Code runs Haiku by command environment (§166).
7 October 2026 — §3.6: the default privileges now grant `anon` and `authenticated` nothing (migration 068); revoke-then-grant stands; read grants with `has_table_privilege`.
4 October 2026 — §3.7's reset rule (the owner's say-so only) and §3.11's four standing rules.
This file had no version line; changes before this one are dated where they were made.

Read automatically at the start of every session. This is the standing brief — these
rules should not need re-explaining in chat. **If anything here conflicts with an
instruction given in a session, pause and flag the conflict rather than silently
picking one.**

---

## 0. Who you're working with

The project owner has deep domain expertise in chemical and hazmat compliance and
**no coding experience.** He thinks in system architecture and business strategy,
learns visually, and values being challenged rather than agreed with.

- Explain in plain language as you go. Never assume familiarity with terms like
  "migration," "RLS policy," "environment variable," or "stored function" — say
  briefly what they mean the first time you use one in a session.
- Prefer small, reviewable steps over large silent changes.
- When there is a real architectural fork, surface it rather than picking quietly.
- Push back when something is wrong. Agreement that isn't earned is not useful here.

---

## 1. What this product is

CompliBoard tells a business what it must do to be compliant, and proves it against
their real documents. It is sold to SMBs, one industry vertical at a time, starting
with chemical manufacturing in Oregon.

**The one-sentence architecture:**

> The Requirements module answers *"what does this company have to do?"* deterministically,
> so that *"what's missing"* is a database query and never an AI guess.

Four layers, and the third is the important one:

| Layer | What | Produced by |
|---|---|---|
| 1. Library | What the law requires, by industry + jurisdiction | AI generates, **human verifies** |
| 2. Switches | **95 facts about this company or one of its sites** | AI determines, user can override |
| 3. Obligations | Which library rows apply | **Code. Never AI.** |
| 4. Evidence | Which documents prove each obligation | AI matches, stored as rows |

**On layer 2:** the count was `~46` here until 12 September, from an estimate in
`docs/archive/CHEMICAL-OR-WA.md` §2.4 written before the requirement library existed. The seeded list is
**95**, derived by reading all 188 `trigger_condition` strings in `requirement_templates` and
asking of each *which fact does this actually need* — which found 6 proposed switches nothing
uses and 30 missing facts that 48 requirements depend on. `DECISIONS.md` §36; the list itself
is `supabase/seed-data/switches.json`, which is the source of truth.

**And a switch is scoped to a company OR to one site** (`switch_scope`), which the old wording
missed: **73 of the 95** are site-scoped, because a second plant has its own air permit, its own
generator category and its own forklifts. `employee_count` exists twice for that reason — once
enterprise-wide and once per site — since Oregon's sick-time rule reads *"10+ Oregon employees
or 6+ with a Portland location"* in a single sentence.

---

## 2. Where the source of truth lives

**These documents live in `./docs/`.** Read the relevant ones at the start of a session
or a new feature rather than relying on memory of a past session — see `docs/README.md`
for what each covers. Not all of them are present at any given time; the owner adds them.

> **Eight moved to `docs/archive/` on 28 September 2026** and are marked `archive/` below. Archived
> means **not current**, not *not needed*: `docs/archive/README.md` names what supersedes each, and
> three of the eight are the only written design for work that has not been done yet. Nothing in this
> section points at a path that no longer exists.

- **`HOW-WE-BUILD.md`** — **the working method. Read it before the first task of a
  session.** The three roles and why they stay separate, the loop from read-only
  investigation through to production, what counts as verification, and what the method
  has already caught. *This file holds the rules; that one holds the method and the
  reasoning behind them.*
- **`DECISIONS.md`** — every decision made and why, plus the condition under which it
  would be reversed.
- **`archive/CHEMICAL-OR-WA.md`** *(archived 28 Sep — still the ONLY design for the vertical, and nothing has replaced it)* — the full design of the first vertical: regulatory map, data
  model, runtime pipeline, display, verification, onboarding. Design only, not built.
- **`archive/BUILD-PLAN.md`** *(archived 28 Sep — the ordering rule it carried is restated in this file below; `TODO.md` is what to follow)* — the phased plan, and why the order is the order.
- **`TODO.md`** — the task-level to-do: what is done, in progress, or not started. The
  *what next* to the build plan's *why*.
- **`WORKSPACE.md`** — the Compliance Workspace module: conversation model, fact capture,
  topic lifecycle, signup and industry classification. Design agreed, not built.
- **`DETERMINATION-GATE.md`** — the full specification for Stage 1 of the runtime pipeline,
  the step that decides whether the answer depends on a fact we do not have and asks for it
  instead of guessing. Prompt, output union, the two schema changes, route wiring, and how a
  user answers the question in place. **Built as of 11 Sep; §11, proximity confirmation, is
  specified and not built.**
- **`CRITIC-PASS.md`** — Stage 5, the pass that reviews a finished answer for errors before
  anybody acts on it: on a stronger model than the one that wrote it, and shown **only the
  output**, never the instructions that produced it, because a reviewer reading those is
  reviewing its own reasoning and will agree with it. **It reports and never regenerates** — a
  silent fix destroys the evidence, and a self-healing loop means no failure is ever found.
  **Built 12 Sep.**
- **`archive/AUDIT-CHECKS.md`** *(archived 28 Sep — **no check in it has been re-run since 22 September** and it covers none of the five tables Documents added; the questions are still worth asking and should be pulled forward with the Audits work)* — the questions `npm run check` does not answer. It answers *"does
  the code build and behave"*; nothing answered *"is what we are telling customers actually
  true"*, and this is that second set. Each check is a question, the query that answers it,
  and **the answer on the date it was last actually run** — including where that answer is
  bad. A check earns its place only if a wrong answer would reach a customer and **nothing
  else would notice**.
- **`TESTING.md`** — three kinds of test that get confused, kept apart: **manual** (two per
  feature, the perfect case and the edge case, and the edge case is where domain knowledge
  does work no script replicates), **automated regression** (the golden-file set,
  `npm run golden`, which can only tell you the output *moved*), and **unattended
  exploration** (the overnight agent — and the hard line that it **cannot validate
  regulatory content**, because a model checking a model produces agreement, and agreement
  is not verification). Writing the manual set is step 12 of `HOW-WE-BUILD.md` §2's loop.
- **`PATTERNS.md`** — conventions carried over from the sibling Bizpulses project, with
  notes on what to copy and what not to.

**`STATUS.md` is at the repo root**, not in `docs/`. One line per module with the date it
was last actually checked — the difference between "not rebuilt yet" and "broken and
nobody noticed".

**Both plans are ordered horizontal first, vertical last.** The numbered phases are
infrastructure — schema, runtime pipeline, resolution, worker, library, observability. The
final section (`MODULES` in `TODO.md`, `PART C` in `archive/BUILD-PLAN.md`) is the seven product
modules, worked one at a time once the ground under them has stopped moving. **Do not start
module work because it is more visible than schema work** — each module names the phases it
depends on, and starting early means building it twice. `DECISIONS.md` §18 has the reasoning
and the one condition under which this ordering is traded.

**Filenames here are stable and do not carry version numbers.** The version is in each
file's header block. Updating a document means editing it in place and raising that
number — never renaming the file, because a rename breaks every reference to it. See
`docs/README.md` and `DECISIONS.md` §15.8.

At the start of a session or a new feature, **read the relevant sections rather than
relying on memory of a past session** — chat conversations elsewhere don't carry over.

If the owner references a decision "from our chat" that isn't in these files, ask him
to drop in an updated document rather than guessing.

---

## 3. Non-negotiable rules

### 3.1 ⚡ Quality-affecting changes require discussion first

**Do not make these changes without explicit discussion in this session:**
prompt edits · temperature, model, or parameter changes · what data or context feeds
a prompt · truncation or token limits · web_search on/off · JSON extraction schema
changes · batching sizes · retry or fallback logic · requirements matching or
resolution logic.

**Safe without discussion:** pure UI and display · labels · routing · folder structure ·
variable renames · CSS · adding a read-only lookup · changing a dropdown data source
that doesn't affect what is stored or fed to AI.

When unsure which side a change falls on, ask. The cost of asking is one message.

### 3.2 The safety properties that must never break

These are enforced in code and covered by tests. If a change would violate one, stop
and flag it.

- **`unknown` never resolves to `does_not_apply`.** Absence of evidence never produces
  a clear. A requirement may only be marked not-applicable with positive contradicting
  evidence, and that evidence is recorded.
- **Expired evidence can never satisfy a requirement.** Enforced in the prompt *and* in code.
- **Readiness and coverage counts are computed in code, never by AI.**
- **Jurisdiction is always part of the match key.** Serving Oregon requirements to a
  Texas company is a silent, dangerous failure.
- **Library rows are versioned, never edited in place.** A change creates a new version
  with `effective_from`; the old row gets `effective_to`. Audits pin to a version and
  stay reproducible.
- **Obligations are never deleted, only marked.** "We were subject to this from March
  2024 to January 2026" is the history the product exists to preserve.
- **Resolution is deterministic.** Same inputs, identical output, every time.

### 3.3 Never let the model enumerate from nothing

The single most important thing learned from testing: AI reasons excellently *against
an artifact* and enumerates unreliably *from nothing.* Artifact-anchored answers matched
paid consultant work at ~99%. One unanchored answer scored B− and asserted a requirement
that does not exist, with $650–1,800 of cost estimates attached.

Every stage must have an anchor: a document, an agency scope, a library row, or a draft
to critique. If a prompt is being written that asks the model to produce a complete list
with no anchor, that is the bug.

### 3.4 The AI module is the only call site

All AI calls go through `lib/ai.ts` — `askAI()` / `askAIJson()`. The Anthropic SDK is
imported nowhere else. Model and task routing are private constants inside that module.

Verify with: `grep -rn "@anthropic-ai" app lib components` — should return only `lib/ai.ts`.

**Known exception to fix:** `app/api/scan-website/route.ts` calls the Anthropic API directly
via `fetch` because it needs the web_search tool. `askAI()` now supports `enableWebSearch`,
so that route should be migrated back through the pipe.

`askAI()` already handles: automatic retry when `stop_reason === 'max_tokens'`, web search
as a server-side tool, and JSON extraction tolerant of narration around the object. Do not
reimplement any of that at a call site.

Prompts live in `prompts/`, one file per task, never inline in code. They are edited
constantly and must not require a code change.

Record token usage on every call.

### 3.4a ⚡ Build and test on the cheapest model. The real model judges OUTPUT.

**Standing rule, 24 September 2026.** A build session spends its calls on SHAPE — does a table
render, does an answer have headings, does a checklist come back with items, does the stream
stop cleanly. Haiku answers all of that for a fraction of the price. Use the expensive model
when the question is **"is this answer any good"**, and not before.

`.env.local` therefore points `AI_MODEL_PROSE`, `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS` and
`AI_MODEL_SUMMARY` at `claude-haiku-4-5`.

> ### ⚡ CHANGED 7 OCTOBER 2026 (the owner; `DECISIONS.md` §166): THE LAPTOP RUNS OPUS, CLAUDE CODE RUNS HAIKU.
> The owner's laptop (`.env.local`) runs **every model setting on `claude-opus-5-5`**, so his own tests show
> real quality. The paragraph above describes `.env.local` as it was and no longer holds.
> **Claude Code builds and tests machinery on Haiku by setting every model variable in the command's own
> environment** for any run that can call a model — `npm run check:live` against a server, a script, and
> the isolated server copy (`HOW-WE-BUILD.md` §3c) — **never by editing `.env.local`.** A run that calls a
> model without that override would run on Opus and spend real money.
>
> **THE GUARD (HR Step 5b, `DECISIONS.md` §168): `npm run haiku -- <command>`.** It sets every model variable
> `lib/ai.ts` reads to the code's Haiku id, asks `lib/ai.ts` what each task tier resolves to
> (`npm run haiku:check` prints the table), and refuses (exit 1, the command never starts) if any is not Haiku.
> **Every model-capable command of Claude Code's goes through it** — the isolated server
> (`env HR_PREVIEW=1 node scripts/haiku.mjs npx next dev -p 3998` in the copy), `check:live`, any script.
>
> **As read on 7 October, the owner's `.env.local` is still on Haiku until he switches it** (prose, judgement,
> substeps, summary, hr and hr_check on `claude-haiku-4-5`; critique and default unset). The guard makes Claude
> Code's runs Haiku either way.

> ### ⚠ CORRECTED 26 SEPTEMBER 2026: THESE VARIABLES *ARE* SET ON VERCEL PRODUCTION.
>
> This section used to say *"Production is untouched by this: those variables are UNSET there, so it
> runs the code defaults — Opus 5 and Sonnet 5."* **That was wrong**, and it stayed wrong for three
> days while `RELEASE.md` said the opposite. Documents rev 1's preflight caught the contradiction and
> could not settle it from the repository, because **what model reads a customer's document is not a
> fact this codebase contains** — it is a fact about a dashboard. Reading the dashboard settled it.
>
> **Set on Vercel Production today, by name:** `AI_MODEL_PROSE`, `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS`,
> `AI_MODEL_SUMMARY`, `AI_MODEL_DOCUMENT_SCAN` and `AI_SCAN_STRUCTURED`. `AI_MODEL_JUDGEMENT` was
> re-added as a **Config** variable rather than a secret, so it can be read back instead of only
> overwritten. *(Corrected 28 September 2026: this paragraph named the values too, and they had already
> moved — `AI_MODEL_DOCUMENT_SCAN` is `claude-opus-5-5` since 27 September. **The values are not
> repeated here on purpose.** Two lists is how the contradiction this box records happened;
> `RELEASE.md` carries the values, this file carries the names.)*
>
> ### `docs/RELEASE.md` IS THE AUTHORITATIVE RECORD OF WHAT VERCEL HOLDS.
>
> Its closing list of variables set on Production is the one place that tracks it — updated on
> 26 September with the four the Documents release added. **This file must not carry a second copy of
> that list**, because two lists is how this contradiction happened: the names above are here to say
> which knobs exist, and `RELEASE.md` says what they are set to. When the two disagree again, the
> dashboard wins and `RELEASE.md` gets corrected. `DECISIONS.md` §136.

**A local `AI_MODEL_*` is still a local decision**, and the code defaults (Opus 5, Sonnet 5) are still
what an unset variable means — that part was always true. What changed is that production no longer
*relies* on being unset, so **a model question about production is answered by reading `RELEASE.md` or
the dashboard, never by reading the code defaults** (`lib/pipelineConfig.ts` says the same about
switches).

The one deliberate exception is a quality read:

```
npm run golden:facts -- --model claude-opus-5
```

**No test hardcodes a model.** Every script resolves through `modelForTask()`, so changing one
environment variable moves all of them. `scripts/run-golden.js` used to fall back to a literal
`claude-sonnet-4-5` while reading `AI_MODEL` — a variable none of the task tiers use — and so
ran on a model nobody had selected.

> ### AND THE TRAP THAT COMES WITH IT: `effort` IS REFUSED BELOW THE 5 FAMILY.
> `claude-haiku-4-5` returns **400 — "This model does not support the effort parameter"** for
> every level. It is `temperature` pointing the other way (§3.4's note): the 5 family refuses
> `temperature`, everything below it refuses `output_config.effort`. `lib/ai.ts`
> `modelAcceptsEffort()` drops the parameter rather than sending it, or switching to Haiku would
> 400 every research and checklist call.

`DEV_MAX_SEARCHES` caps `web_search.max_uses` whenever `NODE_ENV` is not `production`. A source
retrieved is ~4,500 input tokens replayed on every later turn (`DECISIONS.md` §128 J); building
a layout needs the shape of an answer, not its breadth.

### 3.5 Secrets

Never write an API key, password, or token into a code file. All secrets in environment
variables from a gitignored `.env`. **If you ever generate code containing a literal key,
stop and flag it — that is always a mistake, never a shortcut.**

`SUPABASE_SERVICE_ROLE_KEY` must never appear in browser code.
Verify with: `grep -rn "SERVICE_ROLE\|service_role" app components`

### 3.6 Security boundary

**RLS is the security boundary, not middleware.** Route guards are a UX affordance.

Tenancy is `profiles.company_id` — one company per user. A user's company is found with
`select company_id from profiles where id = auth.uid()`. Every RLS policy uses that
subquery; every data table carries `company_id`, **never `user_id`**.

**Read that direction carefully: one *company* per user, not one *user* per company.**
Several `profiles` rows may share a `company_id`, and colleagues at one company are a normal,
working state — that is what migrations 003–005 exist to scope. What is missing is an invite
route, not a schema change; `/api/signup` creates a new company every time. A `memberships`
table would be for the opposite shape — one person across several companies — and is not
needed for user management. `DECISIONS.md` §19 records this, because the plan got it backwards
once.

- `company_id` is derived from the verified session token, **never from a client parameter.**
  The reference implementation is `app/api/documents/route.ts`, using `requireCompany()`
  from `lib/auth.ts` — copy that pattern. It covers all four methods: reading scoped to
  the session's company, writing with the session's ids rather than the body's, an
  ownership check on every row touched, and a destination check on the row being written
  into. A row belonging to another company returns **404, not 403**, so ids cannot be
  probed by watching which error comes back.
- Every table needs `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies. **Done —
  migrations 003–010.** All 23 tables carry what they need — the three reference tables
  (`requirement_templates`, `agencies`, `standard_templates`, `switches`,
  `industry_coverage`) are read-only to authenticated callers, `library_candidates` is
  closed to them entirely, `jobs` is read-only, and the not-logged-in role holds no grants
  at all. `obligations` has **no DELETE policy on purpose** — §3.2, obligations are marked,
  never deleted.
- **Tenancy is expressed through `public.auth_company_id()`**, a `SECURITY DEFINER`
  function returning the caller's company from `profiles` with definer rights. 59 of 65
  policies call it. Write new policies through it — never re-derive the subquery, because
  a copy of it silently depends on `profiles`' own RLS.
- Explicit `WITH CHECK` on every policy, not just `USING`.
- Fully-qualified column names in policy predicates.
- **`GRANT` is not automatic** — every new table needs its own grant line or all reads
  and writes fail with "permission denied," even for service role, even when RLS passes.
  Migration 001 has no GRANT statements; verify before assuming those tables are reachable.
- **...and NOT granting is not denying.** The other half of the same surprise, and the more
  dangerous half. This project carries **default privileges** on `public` — `pg_default_acl`
  rows owned by both `postgres` and `supabase_admin` — which grant `anon`, `authenticated`
  and `service_role` full DML on **any** table created there, before a single `GRANT`
  statement runs. So migration 004's revokes apply only to the tables that existed in
  September; every table created after it starts life with `anon` holding everything again.

  **Any migration that creates a table in `public` must explicitly `REVOKE ALL ... FROM
  anon`**, or `anon` silently holds full DML on it and RLS is the only thing standing
  between an unauthenticated request and the data. Leaving a table out of the grant list
  closes nothing.

  **AND THE SAME IS TRUE OF `authenticated`, WHICH THIS RULE USED TO OMIT.** The default ACL
  reads `authenticated=arwdDxtm/postgres` — `a` insert, `r` select, `w` update, **`d` DELETE** —
  and it arrives before any `GRANT` runs. So a migration that grants
  `select, insert, update` to `authenticated` does **not** produce a table without DELETE:
  it produces a table where DELETE was already there and three privileges were re-stated.

  > ### A GRANT LIST DESCRIBES WHAT YOU ADDED, NOT WHAT THE ROLE HOLDS.
  > The only way to know what a role holds is to **read it**. Every table this project
  > deliberately keeps append-only or non-deletable — `switch_determinations`, `topics`,
  > `obligations` — depends on that distinction.

  > ### SINCE MIGRATION 068 (7 October 2026), `postgres`'s DEFAULTS GRANT `anon` AND `authenticated` NOTHING.
  > `pg_default_acl` for `postgres` on public tables now reads `{postgres=arwdDxtm, service_role=arwdDxtm}`:
  > a table a migration creates gives a person no right at all until the migration grants one (067 and 068
  > also took TRUNCATE, TRIGGER, REFERENCES and MAINTAIN off every existing table; `DECISIONS.md` §165).
  > **The rule below still stands, unchanged:** `supabase_admin`'s defaults on public still grant both roles
  > everything for objects IT creates, `postgres` cannot change those, and a REVOKE that turns out to be
  > redundant costs nothing. Write REVOKE-then-GRANT every time. `tests/unit/schemaGrants.test.ts` fails if
  > `docs/SCHEMA.md` ever shows TRUNCATE, TRIGGER, REFERENCES or MAINTAIN for either role.

  **So the shape for a new table is REVOKE, then GRANT, for both roles:**
  ```sql
  revoke all on table public.<t> from anon;
  revoke all on table public.<t> from authenticated;
  grant select, insert, update on table public.<t> to authenticated;   -- no DELETE
  ```
  Verify by reading, never by trusting the grant list:
  ```
  select grantee, privilege_type from information_schema.role_table_grants
   where table_schema='public' and table_name='<t>';
  -- anon: zero rows. authenticated: exactly what the migration named, and nothing else.
  ```
  *(7 October 2026: that view is blind from the Supabase CLI — it connects as `supabase_read_only_user`
  and sees no rows at all, `docs/HR-MACHINERY.md` B12. Read with `has_table_privilege('<role>',
  'public.<t>', '<RIGHT>')` instead, for all eight rights including MAINTAIN, as migrations 066–068's
  verify blocks do.)*
  **Found twice, both times by a migration's own verify block refusing it** — 11 Sep for
  `anon` (migration 008) and 15 Sep for `authenticated` (migration 028, which granted three
  privileges and was refused for holding a fourth it never granted). `DECISIONS.md` §81.
  Found on 11 Sep when migration 008's own verification block refused it: a table
  deliberately omitted from every grant line still came out readable and writable by
  `authenticated`, and only an explicit `REVOKE` closed it.
- **A column rename is TWO changes: the migration, and a sweep of every query string that
  names the column.** A column name inside `.select('x')` or `.eq('x', …)` is a string
  literal — `tsc` and the generated types cannot see into it, which is exactly what makes
  them valuable everywhere else. `npm run check` runs
  **`scripts/check-schema-contracts.js`** for this: it validates every query string against
  `lib/database.types.ts` (offline, no credentials), and separately enforces that
  `/api/account` DELETE names every table carrying a `company_id`. It has one blind spot,
  documented in the script: a `.from(variable)` call cannot be attributed to a table, there
  are two such call sites, and they must be checked by hand after any rename. Written after
  007 renamed a column and broke signup in production with a green build.
- **Routes connect as the caller.** `requireCompany()` returns `authed.db`, a client built
  from the anon key plus the request's own token, so policies apply. It is built per
  request and must never be hoisted to module scope or cached — it carries one user's
  token. Ten routes use it.
- The service-role key is permitted only where no user session exists, or for a **named
  statement** with a comment explaining it. Today: `signup` (no session yet), `account`
  DELETE (`auth.admin.deleteUser`), `industries` (serves the pre-login signup page), and
  one insert in `audits` (the shared standard cache, which has no tenant column). A route
  may hold it for a named statement; it may not hold it out of habit. The worker, when it
  exists, will use it for the same reason signup does.

### 3.7 Database changes

- All schema changes go through tracked migration files. Never ad hoc changes to the
  live database.
- **⚡ `npm run db:reset` AND `npm run db:restore` RUN ONLY WHEN THE OWNER SAYS SO IN THE BRIEF.**
  *Changed 4 October 2026 (`DECISIONS.md` §161).* A migration is applied with
  `CHECK_LIVE_BASE_URL=http://localhost:3999 npm run db:migrate`, and that is where it stops.
  The reset wipes staging and replays the whole chain from 000 — the only thing that proves the
  chain can build a database from nothing (the first from-zero run on 11 Sep found two
  collisions invisible for months) — **and it also wipes every conversation, document, fixture
  and the `ai_calls` cost ledger on staging**, which `db:restore` does not put back. So whether
  to pay that is the owner's decision, and the owner's decision is that the rebuild from empty
  waits until just before the rev 1 launch.

  **Why the rule changed.** It used to read *"After adding a migration, run `npm run db:reset`"*,
  and on 4 October Claude Code obeyed it after migration 065: the restore wiped staging's
  conversations, documents, fixtures and cost ledger, against the owner's decision above. **What
  that run proved, so it is not paid for twice:** 66 migrations, `000` → `065`, rebuilt staging
  from zero and every verify block passed — read back from `supabase_migrations.schema_migrations`,
  not from the exit code.

  When the brief does call for it, Claude Code runs it on staging under a pty (both ask for a
  typed confirmation and there is no bypass flag, by design). The reset refuses `--production`
  by flag and again by ref; there is no combination of arguments that resets production. **The
  production guard is never automated, by anyone** — `npm run db:migrate:prod` and its typed
  confirmation stay a human action.

  > ### AND A PTY THAT NEVER TYPED THE WORD LOOKS EXACTLY LIKE A RESET THAT RAN.
  >
  > Twice on 22 September `npm run db:reset` **appeared to run and did nothing**: the automation never
  > matched the confirmation prompt, the command sat there, and the only way to tell was to query
  > `supabase_migrations.schema_migrations` afterwards. **So the result of a reset is taken from the
  > database, never from the command's exit code.** A release note that said "the chain builds from
  > zero" on the strength of a command that never typed RESET would be exactly the failure
  > `HOW-WE-BUILD.md` §3 is about.
- `npm run db:migrate` pushes migrations **and** regenerates TypeScript types. Never run
  one without the other — types must always reflect the live schema so a wrong column
  name is a compile error, not a runtime 400. If type generation fails, fix it and run
  `npm run db:types` **before writing any new queries.**
- **Enum-like columns use Postgres `ENUM`, not `TEXT` + CHECK.** `ALTER TYPE ... ADD VALUE`
  avoids the drop-and-recreate churn that requires restating every prior value.
- **⚡ A PRODUCTION QUERY BY CLAUDE CODE IS READ-ONLY, ONE PER STATED NEED, AND ITS SQL GOES IN THE
  REPORT.** Added 28 September 2026. Reading production is sometimes the only way to answer a question
  about production — *"is `extracted_text` populated on the scan that ran?"* cannot be answered from
  the repository. So it is allowed, and it is fenced:

  - **`SELECT` only.** No `INSERT`, `UPDATE`, `DELETE`, `ALTER` or `DO` block, ever, whatever a brief
    seems to invite. A write against production is `npm run db:migrate:prod` behind a human's typed
    confirmation and nothing else.
  - **One query per need that has been stated out loud**, not a session of poking about. If a second
    query is needed, say what new question made it necessary.
  - **The exact SQL goes in the report**, not a description of it. `scripts/preflight-prod.js` exists
    because *"I diffed the history against the directory"* is indistinguishable, on the page, from a
    summary written from context: **a check that reports its conclusion is a summary; a check that
    reports its inputs is a check.**
  - **Say which credential ran it.** `SUPABASE_PROD_SERVICE_ROLE_KEY` is deliberately blank on a laptop
    (§3.8), so a production read goes through the Supabase CLI's own DB connection — which is *not*
    the service role. A report saying "read through the service role" when it was a superuser
    connection describes a test nobody ran.

- For catalog queries (constraint names, column lists, indexes, anything in
  `pg_constraint`, `pg_catalog`, `information_schema`) use the Supabase CLI, not the JS
  client — PostgREST does not expose system catalogs:
  ```
  npx supabase db query --project-ref <ref> --linked "SELECT ..."
  ```
  `--linked` is required. Confirm any live constraint name this way before writing a
  DROP — not from memory, not from the prior migration file.
- Every migration opens with a paragraph explaining **why**, not just what.
- **`CHECK` constraints pass on NULL, so a NULL inside one silently disables it.** The
  usual way to write one by accident is `array_length()`: on an empty array it returns
  **NULL, not 0**, so `array_length(col, 1) > 0` is NULL, `false OR NULL` is NULL, and the
  constraint accepts everything. Use `cardinality()`, which returns 0 — or wrap the
  expression in `coalesce`. This shipped once, in migration 008, and was caught only by
  attempting the write the constraint was supposed to refuse. **Test a CHECK by violating
  it; a constraint nobody has tried to break is a comment.**
- Column conventions: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` · `TIMESTAMPTZ NOT
  NULL DEFAULT now()` · `NUMERIC` never float · `DATE` not timestamp for dates ·
  indexes named `idx_<table>_<cols>`, always company-leading · `updated_at` with a trigger.

### 3.8 Environments

Staging and production are separate Supabase projects. The project ref is an environment
variable, never hardcoded. **Never test experimental changes against production data.**

**A development machine points at STAGING.** `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in a local `.env.local`
hold staging values. Production values live in the hosting platform's own environment
settings, under those same variable names, and are not needed on a laptop for the app
to run.

The reason is not tidiness. `npm run dev` runs the same code as production, including
routes that delete a company, its files and its logins. Pointed at production, an
ordinary click in the local UI destroys live customer data with no undo. Assume any
locally-running server will eventually be clicked in.

`.env.example` carries a `PRODUCTION REFERENCE` block — `SUPABASE_PROD_URL`,
`SUPABASE_PROD_ANON_KEY`, `SUPABASE_PROD_SERVICE_ROLE_KEY`. **Nothing reads these.**
They exist so production credentials, if written down at all, sit somewhere clearly
labelled instead of in the live variables. Leaving them blank is the better default.

The migration scripts are the exception and are separate on purpose: `npm run db:migrate`
targets staging, `npm run db:migrate:prod` targets production behind a typed confirmation.
Those read `SUPABASE_PROD_REF` / `SUPABASE_PROD_DB_PASSWORD` / `SUPABASE_PROD_POOLER_HOST`,
which genuinely do have to be present locally to ship a migration.

**Before asking the owner to test anything locally, confirm which project the dev server
is pointed at.** A cheap way: the staging company names differ from production's.

### 3.9 Version control

Git from the first file. Commit at natural checkpoints — after something works, not
mid-edit — so there is always a working state to roll back to. Plain-language commit
messages saying what changed and why.

### 3.10 Quality gate

`npm run check` = `typecheck && test && build`. Must pass before any commit.

The resolution engine is pure logic with safety properties (§3.2) and **must** have tests.
A wrong comparison direction there is silent and dangerous.

---

### 3.11 Four standing rules from the workspace work — 4 October 2026

- **Screenshots go in `shots/`** at the project root (git-ignored) — `npm run measure -- … --shot
  shots/<task>-<what>.png`. Never `.next/shots/`: `npm run check` runs `next build`, which empties `.next/`,
  and a task's screenshots were lost that way before the owner saw them.
- **`check:live` runs only on port 3999 unless a brief says otherwise — including inside `npm run db:migrate`**,
  which chains into it: `CHECK_LIVE_BASE_URL=http://localhost:3999 npm run db:migrate`. Nothing listens there,
  so the table probes run and the paid steps cost nothing. Without it, `check:live` drives port 3000, where the
  owner's dev server may be up; on 4 October that spent $0.2981 by accident (`HOW-WE-BUILD.md` §3c). A full
  paid run goes against an isolated Haiku server on another port (§3c), only when a brief asks for one.
- **Long paid work never runs inside the request: claim, reply, finish with `after()`.** The pattern is
  `lib/topicClaim.ts` — a compare-and-set claim in the database before any model call (a held claim is a 409,
  no call), a 202 at once, the work in `after()` from `next/server` (on Vercel, `waitUntil` up to
  `maxDuration`), a save conditional on still holding the claim, and the claim cleared by the run that set it.
  Copied by `app/api/topics/[id]/summarise/route.ts`, `app/api/checklists/from-topic/route.ts` and
  `app/api/checklist-items/[id]/how-to/route.ts`. Why: work tied to a request was lost on production when the
  person left (`DECISIONS.md` §138), and a second press paid twice (§161). A cron job claims its work items the
  same way (§162).
- **Every report names its effects on other sections, by file** — §9.1's last clause, restated here because
  shared pieces (the drawer, the print frame, the app shell, `lib/summaryReport.ts`, the job routes) change
  several sections at once.

## 4. The worker

Long-running work runs in a separate always-on Node worker, not in serverless routes:
document indexing on upload · library generation · the shadow checking agent · change
monitoring.

- The `jobs` table **is** the queue. Poll loop, no queue service.
- Claim by compare-and-set: `UPDATE ... WHERE id = ? AND status = 'pending'` returning
  the row. Empty means another poll won the race.
- Serialize per `company_id` for document jobs; per `industry + jurisdiction` for library
  jobs.
- **Never assume a single worker instance.**
- Accumulate in memory, write once. Check for cancellation immediately before every
  irreversible step.
- Clear stuck jobs at the top of every cycle, guarded so a job completing between SELECT
  and UPDATE isn't clobbered.

**Two hard limits:**

- **The worker never publishes regulatory content.** Library generation writes
  `verification_status = generated` into a review queue. Only a human sets `verified`.
- **The determination gate and critic pass stay synchronous.** They are in the user's
  request path. Having a worker must not pull the runtime pipeline into async.

### 4.1 The worker does not hot-reload

The app hot-reloads; the worker is a plain Node process. After **any** change under the
worker directory, it must be stopped and restarted.

**Always confirm the worker has been restarted before asking the owner to test a
worker-side change.** Testing against the old process appears to succeed or fail for
entirely the wrong reason and wastes a full cycle.

---

## 5. Error handling

**Never silent.** No infinite spinner, no bare error code, no console-only failure.

Two messages, two audiences:
- `response_message` — plain language, always written, on success *and* failure
- `error_message` — technical; for parse failures, fold in the first 3000 characters of
  the raw model response so a bad extraction is diagnosable from the database days later

Named error classes carry the failure mode; one catch block maps each to a sentence a
non-technical operator can act on.

### 5.1 How the product speaks when something fails

**Every message the user sees must be polite, plain, and honest about whose problem it is.**

- **When the failure is the product's** — a file it cannot read, a service that did not
  respond, a parse that failed — **say so plainly, and never imply the user did something
  wrong.**
- **Never assert anything about a document the product did not successfully read.** Not its
  contents, not what it lacks, not what the user should check in it.
- **Always tell the user what they can do next**, if there is anything.
- **This applies to error messages, empty states and refusals alike.** An empty state is a
  message: "nothing found" is a claim, and it has to be true.

**The worked example, because it shipped and nobody noticed:**

> `alert('No compliance dates found in this file. Make sure it contains deadline or expiry dates.')`

Shown by `/calendar` for a document `/api/extract-dates` had **rejected before any
date-finding ran**. Three failures in one sentence: it asserted a fact about contents
nobody had read, it implied the user's file was at fault, and it told them to go and check
something that was never the problem. The cause was structural — "no dates" and "could not
read it" returned an identical empty array, so the caller could not tell them apart. Fixed
11 Sep by `extraction_failed`; see `DECISIONS.md` §27.

`WORKSPACE.md` §10.8 applies this same rule to the three signup-scan failures, with wording
worked out per case. That section is the pattern to copy, not to duplicate.

Validate AI output with Zod at the boundary — a per-field diagnosis beats a Postgres
error string. Keep the database constraints too.

---

## 6. Honesty is a product feature

`note` is a first-class field on the data contract, not a caption. And coverage
**changes what the product will assert**, not just what it says:

- Undetermined obligations show as open questions, never as clear
- The coverage strip states plainly what is verified, partial, and not built:
  `OSHA ✓verified · DEQ ✓verified · Local fire ◐partial · ODA ○not built`
- A verified row and an AI-generated row must not look the same in the UI
- Specific dates, fees, and thresholds that haven't been primary-source checked carry
  a verification badge

The "omniscient status tracker" — asserting compliance status before real evidence
exists — is a named anti-pattern here and was deliberately removed once already.

---

## 7. Verticals are data, not code

**There must never be an `if (industry === '...')` branch anywhere.**

Coverage lives in `industry_coverage` (industry × jurisdiction × agency → status). The
pipeline reads it and degrades gracefully:

| Anchor available | Behaviour |
|---|---|
| Full library | Reason against known requirement rows |
| Agency list only | Work through regulators one at a time |
| Nothing | Free enumeration — the known-bad mode |

Adding a vertical means inserting rows. Requirements carry `industries[]` as an array so
one row can serve several verticals — cannabis extraction and chemical blending share
OSHA and fire-code requirements.

---

## 8. Stack decisions already made

Do not re-litigate without flagging.

- **Next.js 16 / React 19** — see `AGENTS.md`. This is newer than your training data.
  Read `node_modules/next/dist/docs/` before writing route, caching, or rendering code.
  Do not assume App Router conventions you remember are still current.
- Supabase (managed cloud) for database, auth, storage
- Claude via the Messages API, called only through `lib/ai.ts`
- Marketing site in Framer, separate from this codebase
- Always-on Node worker for long-running jobs (Railway or similar)
- Resend for email; Stripe pending

---

## 9. Communication during sessions

- Before a structurally significant change — new architecture pattern, new major
  dependency, anything touching `lib/ai.ts`, anything touching auth or RLS — explain the
  plan in plain language and wait for a go-ahead.
- After completing a chunk, summarize plainly: what now works, what to click to see it,
  what is still not built.
- **Default bias is toward building it correctly now, not deferring for speed.** Only
  defer when it genuinely cannot be built yet. When proposing to defer, label the reason:
  - **Genuinely blocked** — needs something not yet available (data, dependency, a decision)
  - **More effort required** — could be built now; the owner decides whether to pull it in

  This labelling makes lazy deferrals catchable before they're accepted. CompliBoard is
  sold on trustworthiness; correctness takes priority over shipping speed.

### 9.1 ⚡ THE STANDING COMMAND FOR EVERY INSTRUCTION AND EVERY REPORT

*Added 29 September 2026 by the owner, and it carries on every instruction from here.
`DECISIONS.md` §142.*

> **Before you assert a cause, point at the line that says it. If you can't, call it a
> hypothesis and check it. Never file a record you haven't seen evidence for. Every report
> ends with how this run's changes affect sections other than the one being built, by file.**

It is §9a's first rule promoted from a long run to every run, because the failures it catches
are not rare. Three in one week: a cause asserted from a user-facing error message when
`raw_text` on the same row said "your credit balance is too low"; a check reporting "0 scan
rows" that was reading a PostgREST error as an empty result; and a count of `check:live`
failures stated as two when a second run made it three and a third made it two again.

**The last clause is not bookkeeping.** A section that reports only its own effects is how a
Documents rule gets changed for the Company information page and nobody tells the Documents
golden set — which is exactly what commit 4's third fix is.

---

## 9a. ⚡ RULES FOR A LONG RUN

**You will be given a brief and left to work.** These are the rules you have been checked against
all along; they are here because on a long run nobody is checking but you. `HOW-WE-BUILD.md` §5a,
§12; `DECISIONS.md` §65.

> ### Before you assert a cause, point at the line that says it. If you can't, call it a
> ### hypothesis and check it. Never file a record you haven't seen evidence for.

- **Copy names from the artifact. Never compose one.** A filename, a section number, a column, a
  function, a migration — read it back out of the file before you write it. Four of twelve recorded
  mistakes are a composed cross-reference; each cost one `grep`. A suffixed number (`§80a`) is the
  easiest kind to invent because it reads like a refinement.
- **⚡ WHEN A CHECK REPORTS AN ABSENCE, PROVE IT CAN SEE A PRESENCE FIRST.** Added 28 September 2026.
  A probe reported **"0 scan rows"** and was thirty seconds from filing "the route's catch does not
  write the row" — the opposite of the truth. The query named a column the table does not have,
  PostgREST returned an *error*, and the script read the error as an empty result. **A check that
  cannot see anything looks exactly like a check that found nothing.** So before believing "nothing is
  there": run the same check where the thing IS there, or drop the filter and count rows.
  `scripts/check-schema-contracts.js` catches this class in the app's own queries (§3.6) and cannot see
  into a throwaway script — which is where it bit.
- **Show the input, not the conclusion.** Paste the query, the row, the diff, the command's output.
  *"The check passes"* is a claim; the output is evidence. A number nobody can trace back to a
  command does not go in a record.
- **Verify as a signed-in user, not the service role.** A grant, a policy and a route guard are all
  invisible to `service_role`. Six phases of tests passed while `/api/obligations` 500'd for every
  real caller. And **read the error body, not the status code** — an ordered guard returns the same
  refusal as the one you meant to test.
- **A thing is done when something real uses it.** Not when it compiles, not when it is returned by
  a function. A field nothing reads is a claim nothing can check; four modules had ~17 exports,
  ~60 tests and zero callers. **The acceptance condition is a reader.**
- **A plan is not evidence about code.** When `TODO.md` and `grep` disagree, the program wins and
  the plan gets fixed. Tick the row in the same commit as the code, or the next person reads the
  row.
- **Render the example from code.** A worked example typed by hand shows what you meant the rule to
  do. Run it.
- **Check your own work against the brief before reporting.** Re-read the brief, list what it
  asked, and say which items are done, which are not, and what you changed that it did not ask
  for. **Report what is unfinished plainly** — a partial result described as complete is worse than
  a partial result.
- **Stop for exactly three things:** a product decision, a production migration, and the end.
  Everything else, decide and record the reasoning.

---

## 10. Naming

The product is **CompliBoard** — one word, capital C, capital B — everywhere: code,
comments, table names, page titles, env prefixes. Not "Complyboard," not "Compli Board,"
not "Compliboard."

Image filenames use underscores, never spaces. Spaces break browser rendering.
