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
| 2. Switches | ~46 facts about this company | AI determines, user can override |
| 3. Obligations | Which library rows apply | **Code. Never AI.** |
| 4. Evidence | Which documents prove each obligation | AI matches, stored as rows |

---

## 2. Where the source of truth lives

**These documents live in `./docs/`.** Read the relevant ones at the start of a session
or a new feature rather than relying on memory of a past session — see `docs/README.md`
for what each covers. Not all of them are present at any given time; the owner adds them.

- **`CompliBoard-Decisions-v1.md`** — every decision made and why, plus the condition
  under which it would be reversed. Newest first.
- **`CompliBoard-Chemical-OR-WA-Vertical-Spec.md`** — the full design: regulatory map,
  data model, runtime pipeline, display, verification, onboarding.
- **`CompliBoard-Build-Plan-v3.md`** — the phased task list.
- **`CompliBoard-Compliance-Workspace-Design.md`** — the Compliance Workspace module:
  conversation model, fact capture, and topic lifecycle.
- **`BIZPULSES-PATTERNS.md`** — conventions carried over from a sibling project, with
  notes on what to copy and what not to.

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

- `company_id` is derived from the verified session token, **never from a client parameter.**
  The reference implementation is `app/api/folders/industry/route.ts` — copy that pattern.
- Every table needs `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies. Migration 001
  created SELECT-only policies, which is why writes currently go through the service-role
  key. Adding the write policies is what lets those routes stop using it.
- Explicit `WITH CHECK` on every policy, not just `USING`.
- Fully-qualified column names in policy predicates.
- **`GRANT` is not automatic** — every new table needs its own grant line or all reads
  and writes fail with "permission denied," even for service role, even when RLS passes.
  Migration 001 has no GRANT statements; verify before assuming those tables are reachable.
- The service-role key is permitted only where no user session exists: the worker, the cron
  route, and signup. Everywhere else it is a bug.

### 3.7 Database changes

- All schema changes go through tracked migration files. Never ad hoc changes to the
  live database.
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
- Column conventions: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` · `TIMESTAMPTZ NOT
  NULL DEFAULT now()` · `NUMERIC` never float · `DATE` not timestamp for dates ·
  indexes named `idx_<table>_<cols>`, always company-leading · `updated_at` with a trigger.

### 3.8 Environments

Staging and production are separate Supabase projects. The project ref is an environment
variable, never hardcoded. **Never test experimental changes against production data.**

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
