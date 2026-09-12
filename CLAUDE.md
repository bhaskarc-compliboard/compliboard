@AGENTS.md

# CompliBoard — Project Rules for Claude Code

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
| 2. Switches | **90 facts about this company or one of its sites** | AI determines, user can override |
| 3. Obligations | Which library rows apply | **Code. Never AI.** |
| 4. Evidence | Which documents prove each obligation | AI matches, stored as rows |

**On layer 2:** the count was `~46` here until 12 September, from an estimate in
`CHEMICAL-OR-WA.md` §2.4 written before the requirement library existed. The seeded list is
**90**, derived by reading all 188 `trigger_condition` strings in `requirement_templates` and
asking of each *which fact does this actually need* — which found 6 proposed switches nothing
uses and 30 missing facts that 48 requirements depend on. `DECISIONS.md` §36; the list itself
is `supabase/seed-data/switches.json`, which is the source of truth.

**And a switch is scoped to a company OR to one site** (`switch_scope`), which the old wording
missed: 70 of the 90 are site-scoped, because a second plant has its own air permit, its own
generator category and its own forklifts. `employee_count` exists twice for that reason — once
enterprise-wide and once per site — since Oregon's sick-time rule reads *"10+ Oregon employees
or 6+ with a Portland location"* in a single sentence.

---

## 2. Where the source of truth lives

**These documents live in `./docs/`.** Read the relevant ones at the start of a session
or a new feature rather than relying on memory of a past session — see `docs/README.md`
for what each covers. Not all of them are present at any given time; the owner adds them.

- **`HOW-WE-BUILD.md`** — **the working method. Read it before the first task of a
  session.** The three roles and why they stay separate, the loop from read-only
  investigation through to production, what counts as verification, and what the method
  has already caught. *This file holds the rules; that one holds the method and the
  reasoning behind them.*
- **`DECISIONS.md`** — every decision made and why, plus the condition under which it
  would be reversed.
- **`CHEMICAL-OR-WA.md`** — the full design of the first vertical: regulatory map, data
  model, runtime pipeline, display, verification, onboarding. Design only, not built.
- **`BUILD-PLAN.md`** — the phased plan, and why the order is the order.
- **`TODO.md`** — the task-level to-do: what is done, in progress, or not started. The
  *what next* to the build plan's *why*.
- **`WORKSPACE.md`** — the Compliance Workspace module: conversation model, fact capture,
  topic lifecycle, signup and industry classification. Design agreed, not built.
- **`PATTERNS.md`** — conventions carried over from the sibling Bizpulses project, with
  notes on what to copy and what not to.

**`STATUS.md` is at the repo root**, not in `docs/`. One line per module with the date it
was last actually checked — the difference between "not rebuilt yet" and "broken and
nobody noticed".

**Both plans are ordered horizontal first, vertical last.** The numbered phases are
infrastructure — schema, runtime pipeline, resolution, worker, library, observability. The
final section (`MODULES` in `TODO.md`, `PART C` in `BUILD-PLAN.md`) is the seven product
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
  closes nothing. Verify with:
  ```
  select * from information_schema.role_table_grants
   where table_schema='public' and grantee='anon';   -- must return zero rows
  ```
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
- **After adding a migration, run `npm run db:reset`.** It wipes staging and replays the
  whole chain from 000, which is the only thing that proves the chain can build a database
  from nothing. Applying migrations incrementally proves only that they worked once, in one
  order, from one starting state — the first from-zero run on 11 Sep found two collisions
  that had been invisible for months. The reset refuses `--production` by flag and again by
  ref; there is no combination of arguments that resets production.
- `npm run db:migrate` pushes migrations **and** regenerates TypeScript types. Never run
  one without the other — types must always reflect the live schema so a wrong column
  name is a compile error, not a runtime 400. If type generation fails, fix it and run
  `npm run db:types` **before writing any new queries.**
- **Enum-like columns use Postgres `ENUM`, not `TEXT` + CHECK.** `ALTER TYPE ... ADD VALUE`
  avoids the drop-and-recreate churn that requires restating every prior value.
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

---

## 10. Naming

The product is **CompliBoard** — one word, capital C, capital B — everywhere: code,
comments, table names, page titles, env prefixes. Not "Complyboard," not "Compli Board,"
not "Compliboard."

Image filenames use underscores, never spaces. Spaces break browser rendering.
