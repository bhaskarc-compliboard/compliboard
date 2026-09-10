# Detailed To-Do
**Version:** 2 · **Updated:** 10 September 2026
**Supersedes:** version 1 (9 Sep). Records Session A progress and adds the HR and
employment-library sections. Supersedes the phase summaries in `BUILD-PLAN.md` at task
level — the build plan stays as the *why*, this is the *what next*.

**No fixed demo date.** Built properly, phase by phase, ready when it is ready.

**Legend**
⚡ quality-affecting — spec before writing · 🔒 blocks later work · ⏱ effort, solo with Claude Code
✅ done · 🔄 in progress · ⬜ not started

---

## PHASE 0 — Foundation

Making the ground solid. Nothing here changes what a customer sees.

### 0.1 Environment and tooling ✅ DONE (9 Sep)
- ✅ `CLAUDE.md` in place, `@AGENTS.md` preserved
- ✅ `scripts/db-migrate.js` and `db-types.js`, project ref from env
- ✅ `package.json`: `typecheck`, `db:migrate`, `db:types`, `check`, `db:migrate:prod`
- ✅ Staging Supabase project created, West US
- ✅ Type generation working, `lib/database.types.ts` real
- ✅ Production migration gated behind a typed `PRODUCTION` confirmation
- ✅ `docs/` folder, five documents committed

### 0.2 Schema reproducibility ✅ DONE (9 Sep)
- ✅ `CURRENT-SCHEMA.md` — full production schema documented
- ✅ `000_baseline.sql` — 19 tables, 780 lines, reconstructed from catalogs
- ✅ Staging built from files alone, verified structurally identical to production
- ✅ Migration history recorded on both projects
- ✅ `baseline-outputs/` — 947 rows of AI output preserved before prompt changes

### 0.2b Local development points at staging ✅ DONE (10 Sep)
- ✅ `.env.local` app keys switched to staging; production keys removed from the laptop
- ✅ 188 `requirement_templates` loaded into staging (unblocks signup, profile save, obligation matching)
- ✅ Verified: My Account shows *Test Alpha Chemical*
- ⬜ Load `standard_templates` (1 row) so audits reuse the cache instead of regenerating

**Why:** the dev server ran for six hours pointed at production while hot-reloading a new, untested DELETE route. Local dev must never be one click from destroying production data.

### 0.3 Storage security ✅ DONE (9 Sep)
- ✅ Found: all three storage policies checked only `bucket_id` — any logged-in user could read and delete every file
- ✅ `002_storage_company_scoping.sql` — four policies, company-prefix scoped
- ✅ Tested on staging with two real users, six tests, all passed
- ✅ Impact traced module by module before applying — nothing broke
- ✅ Applied to production

### 0.4 🔒 Close the remaining service-role holes ✅ DONE (9 Sep)
The storage policies do not protect these — the service-role key bypasses RLS entirely.

**Full route map completed 9 Sep.** 21 routes: 17 service-role, 2 session-verified, 9 taking identity from a client parameter. Every one is now closed, deleted, or confirmed safe.

**Fixed — identity now derived from the verified session via `requireCompany()`:**

- ✅ **`/api/documents`** — all four methods, ownership checks, destination checks. **Now the reference implementation** (`CLAUDE.md` §3.6).
- ✅ **`/api/account`** — the worst of them. DELETE took `user_id` from the URL with **no authentication of any kind** and destroyed the whole company: rows across 15 tables, the company record and the login. One request, one guessed id. Now session-derived, gated on typing the company name, and it deletes the storage files too (previously orphaned forever). Tested 5/5 on staging including the real irreversible delete.
- ✅ **`/api/account/export`** — new. Every row the company owns, one JSON file. Tenant-scoped both directions, verified by searching each export for the other company's ids and name.
- ✅ **`/api/hr`** — accepts document ids, not `file_url`; rejects the whole request if any id fails ownership. Was the last way to read another company's files after migration 002, because the service role bypasses the storage policies.
- ✅ **`/api/audits`** — `company_id` from a query parameter and an unscoped DELETE; re-running someone else's audit would have rebuilt it against this company's documents.
- ✅ **`/api/hr-audits`** — `companyId`/`userId` from the body, and `handbookFileUrl` too, so a saved record could point at another company's file.
- ✅ **Unscoped-delete family** — `/api/folders`, `/api/calendar`, `/api/document-review`. All were `DELETE ?id=<uuid>` → `.delete().eq('id', id)` with no company predicate. Folders also gained a parent-ownership check and company-scoped "folder not empty" counts.
- ✅ **`/api/substeps`, `/api/link-research`** — wrote to checklists keyed on a body id. Linking checks **both** ends; checking only the row being updated still allows a link into another company's checklist.
- ✅ **`/api/obligations`** — returned any company's full compliance position, the most sensitive list in the product, to anyone who knew the id.

**Confirmed safe, left as they are:** `/api/signup` (no session exists yet), `/api/industries` (shared library data, no tenant rows), `/api/chat`, `/api/extract-dates`, `/api/scan-website`, `/api/feedback` (no database, no service role).

**Deleted rather than fixed** — all three orphaned with zero callers:
`/api/folders/industry`, `/api/requirements`, `/api/sync-obligations`.
Confirmed before deleting: no `vercel.json`, no cron schedule anywhere in the repo, **no cron jobs configured in Vercel at all**, the marketing site is not in this repo, and no script or document holds a hardcoded URL. Hardening three routes nobody calls is worse than deleting them.
`CLAUDE.md` §3.6 previously named `/api/folders/industry` as the reference to copy — it now names `/api/documents`.

**Two prompt-injection paths closed along the way.** `company_name` and `industry` were arriving from the request body and going straight into prompts (`/api/hr`, `/api/audits`, `/api/document-review`). All three now read them from the company record. Caller-supplied free text landing inside a prompt is a way to lean on the model's instructions, not just a label.

**One real bug found while closing `/api/hr`:** any non-PDF was base64-encoded and labelled `image/jpeg`. A `.docx` handbook — the format handbooks usually arrive in — was passed to the model as an unreadable picture, and the model answered anyway. Confident output from nothing. Now only PDFs and real image types are sent; anything else is named to the user with the reason.

**Testing.** Every fix was exercised against staging with two real companies and real session tokens, not asserted from reading the code. For each route: no login → 401; own rows → own rows only; another company's id → 404 (never 403, so ids cannot be probed); delete of another company's row → 404 and the row verified intact by service role; write naming another company → landed in the caller's own company.

**Acceptance met:** no route derives tenant identity from a client parameter. Every service-role use is either a route with a verified session or a place where no session exists.

### 0.5 Tenancy consistency ✅ DONE (10 Sep) — migration 003, **applied to production**
Every data table now scopes by `company_id`, in the column and in the policy. Applied to
staging, tested with three logins across two companies, then applied to production and
verified there: 235 checklist items backfilled with zero nulls, twelve company-scoped
policies and none user-scoped, `folder_audits` gone (18 tables now, was 19), row counts
unchanged at 11 / 235 / 47, and history recording 000–003. Types regenerated from
production are byte-identical to the staging-generated file, which is the check that the
two databases have not drifted.

- ✅ `calendar_events` — route fixed 9 Sep; **RLS policies replaced 10 Sep**. All four verbs, company-scoped, explicit `WITH CHECK`. No runtime change: nothing reads this table from the browser, so this aligns the database with what the route already enforced and is what lets the route stop using the service-role key.
- ✅ `checklists` — company-scoped. Gained an **UPDATE policy**, which it never had; that absence is why linking a research answer to a checklist had to go through a service-role route.
- ✅ `checklist_items` — **gained a real `company_id` column**, backfilled from the parent (235 rows, 0 orphans) and set `NOT NULL` with an FK and index. Policies now scope on its own column instead of subquerying `checklists`. One less table whose RLS has to hold for this table's RLS to work — the same coupling that makes the storage policies fragile.
- ✅ `folder_audits` — **deleted**, see below.
- ⬜ `documents.company_id` is still nullable. Every ownership check written in 0.4 fails closed on a null, which is the safe direction, but the column should not permit it. Left for the Phase 1 schema rebuild rather than patched here.

**Colleagues now see each other's checklists.** That is the intent and it matches documents and the calendar — the compliance record is a company asset. It is a visible product change, not just an internal one.

**One hazard fixed in the same change, not after.** `deleteChecklist` in `app/compliance/page.tsx` deleted with `.eq('id', id)` and no ownership filter; `toggleCheck` updated a checklist item the same way. Both were safe *only* because RLS narrowed them to the caller's own rows. Widening the policies to company scope without adding an explicit company filter would have turned "delete my checklist" into "delete any colleague's checklist", reachable from the existing UI. Both now carry `.eq('company_id', companyId)`.

**folder_audits is retired, not deferred.** It inferred compliance from folder *names* — a folder called "DOT" with any file in it read as green. A filename is not evidence, and an expired permit filed in a correctly-named folder scored identically to a current one. That is the false-green failure the product exists to prevent, so it is deleted rather than re-scoped: table, three policies, three foreign keys, generated types, its entry in the account-delete list, and its references here. There was no page, component or nav entry. One production row destroyed — a scan result derived from folder names, not a customer document.

**`/api/cron/monthly-summary` deleted with it.** A third of the email was built on folder audits, and §0.8 established the route had never run — no `vercel.json`, no cron jobs configured in Vercel at all. Dead code calling dead code. `CRON_SECRET` is removed from `.env.example` too. A monthly summary is still wanted, but it should be written against obligations and evidence — what the company must do and what proves it — not against folder names. That belongs after Phase 4, when obligations are real.

### 0.6 Write policies on every table ✅ DONE (10 Sep) — migration 004, **applied to production**

Every table now has a full set of access rules, and the tenancy rule lives in one named
place instead of being re-derived in twenty of them.

- ✅ **`auth_company_id()`** — `SECURITY DEFINER`, `search_path` pinned, returns the
  caller's `company_id` from `profiles` with definer rights. Every company-scoped policy
  goes through it. **53 of 58 policies** use it; **0 reference `profiles` directly**, down
  from 19.
- ✅ **The five zero-policy tables** — `audits`, `company_templates`, `document_reviews`,
  `hr_audits` got the full four. `standard_templates` joined the reference tables
  (readable by any authenticated user, service-role writes only); it was the only one of
  the three missing its read policy, which is why checking the shared cache forced
  `/api/audits` onto the service-role key.
- ✅ **`documents`** — moved from `auth.uid() = user_id` to company scope, matching what
  its route has done since 9 Sep, and gained the UPDATE policy it never had. 38 rows,
  0 with a null company, nothing became invisible.
- ✅ **`obligations`, `obligation_evidence`, `entities`, `corrections`** — were SELECT
  only, now full. `obligations` has **no DELETE policy on purpose** (§3.2: obligations are
  never deleted, only marked).
- ✅ **`obligation_evidence` gained its own `company_id`** — backfilled, `NOT NULL`, FK,
  index. Without it, scoping meant another subquery into another protected table, which
  is the coupling this migration removes.
- ✅ **`companies` INSERT and `profiles` INSERT removed** — neither had a legitimate
  caller. Both happen in signup under the service role. Allowing a session to do either
  let anyone manufacture a company, or attach themselves to one by writing their own
  profile row.
- ✅ **`anon` revoked on all 18 tables** — 144 privileges to 0. It was denied by policy
  anyway, but one forgotten policy on a new table and it would have had everything. Now
  it is refused at the grant, before policies are consulted.

**Verified on production:** 58 policies / 0 via profiles / 53 via the function, no table
with RLS on and zero policies, anon privileges 0, every row count identical across all 18
tables, types byte-identical to the staging-generated file.

**Tested on staging with real logins at the browser's own surface** (anon key + user JWT,
not through the app): 12 tables show only the caller's rows, cross-company writes refused,
moving a row into another company refused by `WITH CHECK`, reference tables read but not
write, creating a company refused, and an unauthenticated caller refused outright.

**Not done here, deliberately: no route was converted off the service-role key.** Rules
first, proven; routes after. See 0.9.

### 0.9 Convert routes off the service-role key ⬜ **NEXT** ⏱ 1–2 days
Now that 004 makes the database enforce tenancy, most routes no longer need the key that
bypasses it. The honest remaining justification is two places:

- **`/api/signup`** — no session exists yet, by definition.
- **`/api/account` DELETE** — calls `auth.admin.deleteUser()`; removing a login is not
  something a user token can do.

Everything else could run under the caller's own token, which would make the database the
enforcing layer rather than a second opinion. `/api/obligations` and `/api/account`
GET/PUT could switch today with no other change.

**Verification method — this is the part that matters.** Do NOT verify a conversion by
HTTP status. RLS is a filter, not a gate: a read that is too narrow returns `[]` with a
200, and a partially-narrowed join returns rows with the joined object silently empty.
A 200 proves nothing. Every conversion is verified by comparing, per table, the rows
returned under the caller's token against the same query run with the service role —
exact id sets, not just counts — plus a check that any joined data is present.

Writes are the safe direction: a blocked write errors loudly with `42501`. Reads are where
the danger is.

**Order — cheapest and loudest failures first:**
1. ✅ `/api/obligations` — done 10 Sep, the pattern proof
2. `/api/industries` · 3. `/api/calendar` · 4. `/api/folders`
5. `/api/link-research`, `/api/substeps` · 6. `/api/documents`
7. `/api/hr-audits`, `/api/hr` · 8. `/api/account/export`, `/api/audits` — last, most tables

**⚠️ The profiles trap on `/api/account/export`. Decide before converting it.**
That route reads `profiles` filtered by `company_id`, to list everyone on the account. But
the SELECT policy on `profiles` is `auth.uid() = id` — a user can see only their own row.
Under RLS that query silently returns ONE row instead of all of them, and the export looks
complete while having quietly lost every colleague. No error, no empty result, just less
data than the customer is owed — from the endpoint whose entire purpose is giving them
everything we hold.

Two ways out, and it needs a decision, not a guess: give `profiles` a company-scoped
SELECT policy so colleagues can see each other (consistent with documents, checklists and
the calendar, and probably right), or accept that the export covers only the requesting
user and say so in the file's own `note` field. The same trap applies to `/api/account`
DELETE, which reads `profiles` by `company_id` to find the logins to remove — but that
route keeps the service-role key anyway.

**⚠️ `standard_templates` keeps the service-role key for its cache-miss insert.**
`/api/audits` reads the shared parsed-standard cache and, on a miss, writes the newly
generated checklist back to it (`app/api/audits/route.ts`, around line 237). That table is
reference data: `SELECT USING (true)`, no write policy, deliberately. Giving it an INSERT
policy would let any authenticated user write into the cache every other company reads —
poisoning shared regulatory content from a normal session. So when that route converts, it
holds both clients and uses the admin one for that single insert, with a comment saying
why. A route may keep the key for a named statement; it may not keep it out of habit.

**Also still to do:** the nine browser call sites that read `profiles` directly to fetch
`company_id` (requirements, audits, calendar, dashboard, hr, compliance, documents, upload,
AppLayout) should call `auth_company_id()` by RPC instead. No policy depends on `profiles`
any more, but those pages still do — that is what finishes decoupling the base case.

### 0.7 Housekeeping ⬜ ⏱ 2 hours
- ⬜ Delete four orphaned storage files under a prefix matching no company
- ⬜ Remove unused deps: `ai`, `@ai-sdk/anthropic`
- ⬜ `updated_at` trigger — nine columns exist, nothing advances them
- ⬜ Resolve pricing: $199 or $99
- ⬜ Remove HIPAA as a surfaced audit example
- ⬜ Fix `app/upload/page.tsx:89` — `getPublicUrl` on a private bucket, already broken
- ⬜ Add to docs: baseline exports go in git **only** while data is synthetic
- ⬜ **`supabase db query -o json` returns two different JSON shapes.** Which one depends
  on the CLI's agent detection (`--agent auto|yes|no`): a bare array `[{...}]` when it
  thinks a person is calling, a wrapped object `{"boundary":…,"rows":[…],"warning":…}`
  when it thinks a program is. Anything parsing that output must handle both, and must
  treat an unrecognised payload as a failure rather than as an empty result. This cost
  two aborted production migrations on 10 Sep: the parser read only the wrapped form, so
  in a human terminal it read a full history as empty and reported every migration as
  pending — silently, because nothing threw. Fixed in `scripts/db-migrate.js`; that is
  currently the only place in the repo that parses CLI JSON, and any new one has the same
  trap waiting.

- ⬜ **Deleting a route breaks `npm run check` until `.next/types` is cleared.** Next.js
  generates a route validator under `.next/types/` referencing every route file. Delete a
  route and the stale validator remains, so `tsc --noEmit` — which runs *before* `next
  build` in `npm run check` — fails with `TS2307: Cannot find module
  '../../app/api/<name>/route.js'`. Hit this deleting the three orphans on 9 Sep. Fix is
  `rm -rf .next/types`; the build regenerates it. Worth a line in the check script or a
  `predev`/`prebuild` clean so the next person does not lose ten minutes to it.

---

## PHASE 1 — Schema rebuild

Production data is test data. Rebuild the schema correctly rather than patching it. Everything drops and reloads.

### 1.1 🔒 Design the corrected schema ⚡ ⏱ 2 days
- ⬜ Postgres `ENUM` for every enum-like column, replacing bare `text`
- ⬜ `industries text[]` on requirements — one row, many verticals
- ⬜ Switch hierarchy: `depends_on_switch` / `depends_on_value`
- ⬜ Fifth state `not_applicable`, distinct from `unknown`
- ⬜ Jurisdiction columns: level, state, county, city
- ⬜ Versioning: `version`, `effective_from`, `effective_to`, `supersedes_id`
- ⬜ `scope_rules` — what a requirement does NOT cover, and its common misreading
- ⬜ `applies_expression jsonb`
- ⬜ Verification: `verification_status`, `verified_by`, `verified_at`, `citation_url`, `citation_quote`, `source_checked_at`
- ⬜ New cadence values: `continuous`, `pre_approval`
- ⬜ `entity_scope` gains `product`

### 1.2 New tables ⬜ ⏱ 2 days
- ⬜ `switches` — definitions with hierarchy
- ⬜ `company_switches` — value, `basis`, confidence, source, `user_locked`, `expires_at`
- ⬜ `industry_coverage` — industry × jurisdiction × agency → status
- ⬜ `library_candidates` — requirements produced without a library
- ⬜ `jobs` — the worker queue
- ⬜ `topics` — conversation topics, open/closed, with summaries

### 1.3 Rebuild ⬜ ⏱ 1 day
- ⬜ Write migrations, apply to staging, verify from scratch
- ⬜ Rebuild staging from zero — proves the migrations are complete
- ⬜ Rebuild production, reload the 188 requirements, recreate test accounts

### 1.4 🔒 Jurisdiction in the match key ⬜ ⏱ half day
The obligation-matching logic matches on industry alone. 90 of 188 rows are Oregon-specific. (It lived in `app/api/sync-obligations`, deleted 9 Sep as orphaned — the bug is in the matching rule, which still has to be written correctly here.) **A Texas chemical manufacturer is currently served Oregon requirements** — a live correctness bug, not a scale limit.

### 1.5 `STATUS.md` ⬜ ⏱ 1 hour
One line per module: working / broken / not-yet-rebuilt / verified-on-date. Prevents "broken and nobody noticed" during a rebuild.

---

## PHASE 2 — The runtime pipeline

Where answer quality actually changes. Everything here is ⚡.

### 2.1 🔒 Agency list ⬜ ⏱ 1 afternoon
Moves cannabis from *enumerate from nothing* to *bounded agency scope*. **Highest value per hour in the entire plan.**

- ⬜ Chemical Oregon: Oregon OSHA, DEQ, OSFM, local fire, local sewer, SoS, DOR, BOLI, ODOT, ODA + federal OSHA-baseline, EPA, DOT/PHMSA, FMCSA
- ⬜ Cannabis Oregon: OLCC, Oregon OSHA, ODA, DOR, Water Resources, DEQ, local fire, local jurisdiction
- ⬜ Tag by industry via `industries[]`

### 2.2 Determination gate — Stage 1 ⚡ ⏱ 2 days
- ⬜ Classify: what facts decide this, which are known, which are blocking
- ⬜ **Output schema must include an "ask" path** — its absence is the root cause of the 2.5L failure
- ⬜ At most one blocking question, always paired with what it unlocks
- ⬜ Stricter threshold for checklists (§4.3 of the workspace design)

**Acceptance:** the 2.5L bottle question requests the SDS instead of enumerating past the missing packing group.

### 2.3 Critic pass — Stage 5 ⚡ ⏱ 3 days
Fresh call, sees only the output, adversarial framing.

- ⬜ Physical object · regime · scope exclusions · assumed determinations · every date/fee/threshold · agency coverage · unstated assumptions
- ⬜ Must see what the answer is *built on*, not just the latest turn
- ⬜ Strongest model
- ⬜ Material error → one loop back to identification

**Acceptance:** catches the combination-packaging error in the saved 2.5L output.

### 2.4 Split identification from expansion ⚡ ⏱ 1 day
- ⬜ Identification at `temperature: 0.1`, stating physical object and regime per requirement
- ⬜ Only survivors get sub-steps and costs
- ⬜ Sub-steps go to determination and decision first, procurement second

### 2.5 `lib/ai.ts` improvements ⚡ ⏱ 1 day
- ⬜ Task-based model routing — strongest for critic, cheap for expansion
- ⬜ Record token usage per call
- ⬜ Temperature audit across every call site
- ⬜ Migrate `scan-website` back through `askAI()` (web search is now supported)

### 2.6 Zod at the AI boundary ⬜ ⏱ 2 days
`askAIJson` returns `any` after a `JSON.parse`. A malformed extraction surfaces as a Postgres error rather than a per-field diagnosis.

**Found 9 Sep, live on staging — an empty model response becomes a raw 500.**
`JSON.parse` at `lib/ai.ts:107` runs unconditionally on whatever came back. The
truncation guard above it (line 63) only fires on `stop_reason === 'max_tokens'`, so a
response that is empty for any other reason is never caught: `JSON.parse('')` throws
`SyntaxError: Unexpected end of JSON input`, which propagates out of the route and
reaches the caller verbatim as `{"error": "Unexpected end of JSON input"}`.

- **Reproduction:** `POST /api/audits` with a question that classifies as a named
  standard, so the classify call runs with `enableWebSearch: true` at 16k max tokens.
  Failed after 37s against staging. Server log:
  `Audit engine error: SyntaxError: Unexpected end of JSON input`.
- **Not caused by the identity changes** made to that route the same day — the request
  got as far as the classify call, so session, company lookup and industry guard all
  passed. Very likely pre-existing; not proven by testing the prior code.
- Two things need fixing together: the guard must cover an empty or unparseable body,
  not only the truncation stop reason; and the failure must not surface as a bare parser
  string. See 2.7 — this is exactly the case where `error_message` should carry the
  first 3000 characters of the raw response so a bad extraction is diagnosable from the
  database days later, and `response_message` should say something an operator can act on.
- Logged, not investigated, by decision.

### 2.7 Two error messages ⬜ ⏱ half day
- ⬜ `response_message` — plain language, always written, success and failure
- ⬜ `error_message` — technical, with the first 3000 chars of raw model output on parse failures
- ⬜ Fix silent failures: storage upload, DB insert, export

### 2.8 Golden-file test set ⬜ ⏱ 1 day
- ⬜ Schema: input, expected, actual, matched, missed, extra
- ⬜ **Test #1 is the 2.5L bottle case with the correct answer written out**
- ⬜ Add every failure found
- ⬜ Re-run after every prompt change or model upgrade

---

## PHASE 3 — Compliance Workspace

See `docs/WORKSPACE.md` for the full design.

### 3.1 Follow-up classification ⚡ ⏱ 2 days
- ⬜ Elaboration → expansion only
- ⬜ Refinement → update fact, re-run identification → critic → expansion
- ⬜ New question → full pipeline
- ⬜ **Refinement recomputes, never appends**

### 3.2 Fact capture from conversation ⚡ ⏱ 3 days
- ⬜ Established facts write to `company_switches`; exploration stays in the transcript
- ⬜ Every capture records `basis` — the actual sentence the user said
- ⬜ `user_stated` applies immediately; `ai_inferred` confirms before applying
- ⬜ Confirm when ambiguous

### 3.3 Scoped questions ⚡ ⏱ 1 day
When a durable fact permits multiple answers, ask the scoped question rather than re-asking the fact. *"You operate your own fleet and also use carriers. For this shipment — which?"* The answer is context, not an overwrite.

### 3.4 Topic lifecycle ⬜ ⏱ 3 days
- ⬜ Explicit close: summary written, facts extracted, transcript discarded
- ⬜ Tell the user the real reason — past conversations pollute future answers
- ⬜ Auto-close on inactivity
- ⬜ Creating a checklist closes the topic
- ⬜ Flag stale checklists when a fact changes — **flag, never auto-regenerate**

### 3.5 In-context fact display ⬜ ⏱ 2 days
Before an answer, show **only the facts this question depends on.** Not a wall.

### 3.6 Dashboard verification section ⬜ ⏱ 2 days
- ⬜ Three at a time, never more
- ⬜ Ranked by consequence internally
- ⬜ **No numbers** until the library is verified
- ⬜ Empty state is the good state
- ⬜ Frame as an inbox that gets quiet, not a burn-down

---

## PHASE 4 — Resolution engine

Pure code. No AI. The easiest piece, and the one that most needs tests.

### 4.1 Resolution function ⬜ ⏱ 3 days
Jurisdiction + switches + library version → obligations. Deterministic.

### 4.2 Atomic `replace_obligations` ⬜ ⏱ 1 day
DELETE+INSERT in one transaction with an in-SQL ownership guard. **Half-written obligations are worse than stale ones.**

### 4.3 Determination chain ⬜ ⏱ 1 day
`produces_switch` writes back, re-resolve, cap at 3 passes.

### 4.4 🔒 First tests in the codebase ⬜ ⏱ 2 days
Vitest. The safety properties must be covered:
- ⬜ `unknown` never yields `does_not_apply`
- ⬜ expired evidence never yields `satisfied`
- ⬜ state X never receives state-Y requirements
- ⬜ resolution is idempotent
- ⬜ obligations are never deleted, only marked

Then `npm run check` becomes `typecheck && test && build`.

---

## PHASE 5 — The worker

### 5.1 Worker skeleton ⬜ ⏱ 3 days
`jobs` table as queue · poll loop · compare-and-set claim · per-job-type serialization · stuck-job clearing · progress messaging · cancel checkpoints.

**Never assume a single instance.** Fast lane (documents) separate from slow lane (library generation).

### 5.2 First job: `index_document` ⬜ ⏱ 3 days
Index on upload, not lazily during audit. By audit time every document is already indexed.

### 5.3 Deployment ⬜ ⏱ 1 day
Railway or similar. **The worker does not hot-reload** — restart after every change.

**Two hard limits:** the worker never publishes regulatory content (writes `generated` to a review queue). The determination gate and critic stay synchronous.

---

## PHASE 6 — Library: chemical Oregon

### 6.1 Migrate the 188 rows ⬜ ⏱ 2 days
Merge both spreadsheets. `MERGEDv2` has the VERIFY hit list, 26 switches, fixed-date calendar, and an agency-encoding `Layer`. The intake file has normalized jurisdiction, `is_determination`, `source`.

### 6.2 Load 46 switches ⬜ ⏱ 1 day
Definitions, hierarchy, jurisdiction variants, volatility.

### 6.3 Write `applies_expression` for 188 rows ⬜ ⏱ 5 days
Free text → machine-evaluable. **Slow, and worth doing slowly.**

### 6.4 Federal layer, agency by agency ⬜ ⏱ 1 week
~95 rows serving every state forever.

### 6.5 Oregon layer, agency by agency ⬜ ⏱ 1 week
**Cite OAR 437, not 29 CFR.** Oregon is a State Plan state.

### 6.6 Primary-source retrieval ⬜ ⏱ 4 days
Every disputed item and flagged specific resolved by **retrieval, not model vote.** eCFR, Federal Register, Oregon OAR/ORS.

### 6.7 Human verification by fact class ⬜ ⏱ 4 days
Dates/fees/thresholds → disputed → critical citations → divergence-table rows → `scope_rules`. ~50–60 rows. Mark `verified` with date **and verifier**.

### 6.8 Standing "confirm before publishing" list ⬜ ongoing
**CFATS is entry #1** — lapsed since July 2023, verified live. Models state it as current with full confidence.

---

## PHASE 7 — Switches and evidence

### 7.1 Public-records lookups ⬜ ⏱ 4 days
EPA RCRAInfo (**generator category, free**), ECHO, TRI, FMCSA SAFER, DEQ/Ecology, SoS, **OLCC licensee list** (cannabis license type, endorsements, tier — free).

### 7.2 Switch determination from documents ⚡ ⏱ 4 days
One AI pass. Every value logs `basis`, confidence, source.

### 7.3 Normalize audit output into `obligation_evidence` ⚡ ⏱ 4 days
**One table resolves three findings:** no resolution tracking, dashboard-only-climbing, audits recomputing from scratch.

### 7.4 Evidence expiry in code ⬜ ⏱ half day
Currently a prompt rule only.

---

## PHASE 8 — Screens

- ⬜ Company profile screen — *"here's what we understand, correct anything wrong"* ⏱ 4 days
- ⬜ Requirements page, grouped by agency ⏱ 4 days
- ⬜ Coverage strip from `industry_coverage` ⏱ 1 day
- ⬜ Answer display: object tags `[the case]`, regime tags `[DOT — transport]`, verification badges ⏱ 2 days
- ⬜ Calendar reads cadence from obligations ⏱ 2 days
- ⬜ Onboarding: 3 fields → scan → confirm screen → ~7 questions → documents ⏱ 5 days
- ⬜ Enable numbers — **gated on library verification**

---

## PHASE 9 — Observability

- ⬜ Error tracking, app and worker
- ⬜ Worker heartbeat — today if the worker dies, nothing notices
- ⬜ AI cost tracking per company per task
- ⬜ Rate limiting

---

## PHASE 10 — Cannabis Oregon

- ⬜ **Start by tagging existing OSHA and fire-code rows with `cannabis`** — probably 30–50 rows already owned. Find what you have before generating.
- ⬜ Mine `library_candidates` — usage-ranked, operator-validated queue
- ⬜ OLCC layer (OAR 845 Div 25)
- ⬜ License-type switch hierarchy: producer / processor / wholesaler / retailer / laboratory, endorsements, tier, extraction method
- ⬜ Local layer deep for two or three traction jurisdictions, thin elsewhere and stated
- ⬜ Salesperson verification pass — his license type only, tagged with who and when
- ⬜ OLCC Compliance Education bulletins as a monitored source

**The wedge:** cannabis extraction *is* chemical manufacturing. Flammable storage, LEL monitoring, room classification, hot work, confined space, boilers. Almost every cannabis tool is Metrc-adjacent; nobody covers the side where a fire marshal shuts a room down.

---

## PHASE 11+ — Later

**Washington** — chemical (~90 rows, federal already serves it), then cannabis (near-full rebuild). Divergence table is the mandatory review list. **Generated independently, never seeded from Oregon.**

**Checking agent** — shadow comparison, different model, primary-source tiebreak, seeded known-bad rows, quarterly human spot-check of the checker's judgments.

**Change monitoring** — Federal Register + eCFR APIs, OAR/WAC, agency bulletins, per-agency review intervals.

**Multi-site** — `profiles.company_id` → memberships. Roll-up dashboard.

**Platform** — Stripe, Drive OAuth, domain, Framer homepage, PDF export, `claude-sonnet-5` (⚡ golden-file pass before and after).

**Key rotation** — 🔒 **before any real customer data enters the app.** Four keys leaked in a zip on 9 Sep.

---

## PHASE 6b — HR module *(feature work — not part of gap-closing)*

**Findings from reading the code, 10 Sep. Design decided, nothing built.**

### The architecture decision
**One requirements table, tagged by domain** — `employment`, `environmental`, `transport`, `fire`, `licensing`. Modules are *views over rows*, not separate systems.

Employment law is an independent **body of law** but not an independent **module**: it is read by HR *and* belongs in a chemical manufacturer's overall obligation list, because they employ people. A separate library would hide it from every vertical.

Two things only work this way:
- **Shared switches.** `employee_count` drives FMLA at 50, OFLA at 25, Oregon sick time at 10 — *and* OSHA recordkeeping thresholds. Determined once, used by both.
- **One company picture.** "What does this company owe?" must return chemical and employment obligations together.

**Test for a new domain:** does it need different *columns*, or just different *rows*? Employment needs the same columns. Same table.

### What is wrong with HR today
- ⬜ **Audit reads ONE handbook; ask reads ALL of them.** Backwards. SMB reality is one large legacy handbook plus several later amendments, so auditing a single file reports sections "missing" that exist in another document.
- ⬜ **The "requirements" are eleven hardcoded words in a prompt** — anti-harassment, EEO, FMLA, ADA, and so on. No citations, no jurisdiction, no thresholds. FMLA is federal at 50+; Oregon has **OFLA** (25+, broader) and **Paid Leave Oregon** (nearly all employers). A handbook can pass "FMLA present" and miss both Oregon obligations. **A false green produced by a checklist that doesn't know which state it's in.**
- ⬜ **Employee count is never consulted**, so the audit cannot know what applies.
- ⬜ **`draft_policies` required for EVERY missing section** — the highest-risk tier (suggested legal language) shipping unconditionally with no citation, jurisdiction, or verification. **Turn off until a library exists.** Same for `draft_policy` in ask mode.
- ⬜ **Findings are a frozen JSON blob** (`present`/`missing`/`draft_policies` arrays). No per-finding row, no status, no `resolved_by`, no link to the document that closed it. The lifecycle below cannot be built on this shape.
- ⬜ **Ask and audit do not talk.** A question touching a known non-compliant section should report it; there are no finding rows to look up.

### The intended design
Upload → scan the **whole handbook set** → store **findings as rows** → findings are the durable artifact → questions consult them → a finding stays open until a corrected document actually satisfies it.

- ⬜ Scan once at upload, not per question. Same fix as `obligation_evidence`: compute once, store as rows, query thereafter. Also makes repeat questions consistent.
- ⬜ A new upload **re-scans affected findings**; a finding closes only if the new document actually satisfies it. Never "a document arrived, assume it's fixed" — that is a false green produced by a file.
- ⬜ Record **which document closed a finding and when**. That is the evidence trail.
- ⬜ Report carries a coverage statement: "Reviewed against N employment requirements. X gaps, Y undetermined."
- ⬜ A user can dismiss a finding ("we're under 25 employees") — that writes back to `company_switches`, not just hiding the row.

### Risk tiers for "here is the fix"
| Tier | What | Gate |
|---|---|---|
| 1 | Missing-section detection | Ship now — an absence is reliably detectable |
| 2 | Anchored comparison against a verified requirement row | **Needs the employment library** |
| 3 | Suggested policy language | Verified rows only, always framed as a draft for counsel |

**Three standing rules:** every finding cites the rule (no citation → no assertion) · never say "you are compliant", only what was checked and found · suggested language is visibly a draft, never a fix to accept.

### Cheap and honest, available now
- ⬜ Audit reads all handbooks
- ⬜ Drop `draft_policies` / `draft_policy`
- ⬜ Label the output a **generic completeness check**, not a compliance finding

### Already good in the code
- ✅ Conflict handling is in the ask prompt — names which handbook says what, does not silently pick
- ✅ Ask mode reads all handbooks so an answer in an older document is still found
- ✅ Four-outcome answer shape with citations *(written 10 Sep, untested)*

---

## PHASE 6c — Employment law library (Oregon & Washington) *(library #2)*

**Why second, ahead of cannabis:** it applies to **every** vertical — chemical, cannabis, hospice, brewery. It is the one domain that does not fragment by industry, and it is smaller than chemical.

- ⬜ Agency list: BOLI · Oregon OSHA · Paid Leave Oregon · Oregon Employment Dept · WA L&I · WA PFML · WA ESD + federal DOL, EEOC, FMLA/ADA
- ⬜ Generate agency by agency, same bounded method as chemical
- ⬜ **OR/WA divergences are the high-risk rows:** OFLA vs WA leave, Paid Leave Oregon vs WA PFML, state-fund vs private workers' comp, Oregon CAT vs WA B&O, OAR vs WAC citations, minimum-wage tiers
- ⬜ Employee-count thresholds are the core switch: 10 / 25 / 50 / 100
- ⬜ Primary-source retrieval, then human verification by fact class
- ⬜ Tag rows `domain = employment`

---

## PHASE 8b — Signup and industry classification *(feature work)*

Full design in `WORKSPACE.md` §10.

- ⬜ Remove the industry dropdown and `/api/industries` — it is circular, offering only verticals already built
- ⬜ Signup collects **email, password, website, address** only
- ⬜ **Address required** — it decides which body of law reaches them; not derivable from a website
- ⬜ Scan runs as a background job, not inline; do not block signup
- ⬜ Scan output carries a **sufficiency confidence**, not just extracted fields
- ⬜ `primary_industry` + `secondary_activities[]`, with `basis` and `resolved_by`
- ⬜ Classification presented as a **teaching confirmation**, correctable
- ⬜ Three distinct fallback messages: no website · unreachable · uninformative
- ⬜ Unmatched industries write to `library_candidates` — signup becomes demand research

---

## Next three sessions

**Session A — close the remaining holes** (0.4, 0.5, 0.6) — 🔄 in progress
Done: `/api/documents`, `/api/account`, `/api/account/export`, staging as local default.
Next: commit and test `/api/hr`, then `/api/audits`, `/api/hr-audits`, the unscoped-delete family, delete the three orphaned routes. Then tenancy consistency, then write policies on all 19 tables.

**Rule for this session: gap-closing only.** Feature work is handled when each section is handled. A real defect found while closing a gap (the `.docx` bug) belongs; a redesign does not.

**Session B — schema rebuild** (1.1–1.4)
Design, migrate, rebuild staging from zero, rebuild production, jurisdiction in the match key.

**Session C — the runtime fixes** (2.1–2.4)
Agency list, determination gate, critic pass, split identification from expansion. **This is where answer quality changes.**

---

## Open decisions

1. Pricing — $199 or $99
2. Cannabis prospect — processor or not? one license entity or six?
3. What the other two salespeople are targeting. A single-site Oregon chemical manufacturer is the cheapest validation of this whole architecture, and the one you can verify personally.
4. Auto-close interval for topics
5. One open topic at a time, or several?
6. How aggressively to confirm before writing a fact
