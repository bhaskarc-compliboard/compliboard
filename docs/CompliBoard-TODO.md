# CompliBoard — Detailed To-Do

**Date:** 9 September 2026
**Supersedes:** the phase summaries in `CompliBoard-Build-Plan-v3.md` at task level. The build plan stays as the *why*; this is the *what next*.
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

### 0.3 Storage security ✅ DONE (9 Sep)
- ✅ Found: all three storage policies checked only `bucket_id` — any logged-in user could read and delete every file
- ✅ `002_storage_company_scoping.sql` — four policies, company-prefix scoped
- ✅ Tested on staging with two real users, six tests, all passed
- ✅ Impact traced module by module before applying — nothing broke
- ✅ Applied to production

### 0.4 🔒 Close the remaining service-role holes ⬜ NEXT ⏱ 1–2 days
The storage policies do not protect these — the service-role key bypasses RLS entirely.

- ⬜ **`/api/hr`** — takes `file_url` straight from the request body and downloads it with the service role. Currently the remaining way to read another company's file.
- ⬜ **`/api/audits`** — takes `company_id` from a query parameter, never verifies the session
- ⬜ Audit the other 15 service-role routes; list every one taking `company_id` or `user_id` from a client parameter
- ⬜ Apply `requireCompany()` from `lib/auth.ts` to each
- ⬜ Update client callers to send the bearer token

**Acceptance:** no route derives tenant identity from a client parameter. Every service-role use is either a route with a verified session or a place where no session exists (worker, cron, signup).

### 0.5 Tenancy consistency ⬜ ⏱ 1 day
- ⬜ `calendar_events` — scoped to `user_id`, must be `company_id`. A compliance calendar is a company asset.
- ⬜ `checklists` and `checklist_items` — same
- ⬜ `folder_audits` — same, or remove if the feature is retired
- ⬜ `documents.company_id` is nullable — decide whether to make it NOT NULL

**Acceptance:** every data table scopes by `company_id`. Two people at the same company see the same thing.

### 0.6 Write policies on every table ⬜ 🔒 ⏱ 1 day
Five tables have RLS on and **zero policies** — `audits`, `company_templates`, `document_reviews`, `hr_audits`, `standard_templates`. RLS with no policy denies everything, which is why those tables are only reachable by service role.

- ⬜ SELECT/INSERT/UPDATE/DELETE policies on all 19 tables
- ⬜ Explicit `WITH CHECK`, not just `USING`
- ⬜ Fully-qualified column names in predicates
- ⬜ `GRANT` line for every table

**Note the coupling:** the storage policy reads `profiles`, and `profiles` has its own RLS. If the "view own profile" policy were ever dropped, *all* storage access silently stops for everyone, with no obvious connection to the change. Document this.

### 0.7 Housekeeping ⬜ ⏱ 2 hours
- ⬜ Delete four orphaned storage files under a prefix matching no company
- ⬜ Remove unused deps: `ai`, `@ai-sdk/anthropic`
- ⬜ `updated_at` trigger — nine columns exist, nothing advances them
- ⬜ Resolve pricing: $199 or $99
- ⬜ Remove HIPAA as a surfaced audit example
- ⬜ Delete `folder_audits` if retired
- ⬜ Fix `app/upload/page.tsx:89` — `getPublicUrl` on a private bucket, already broken
- ⬜ Add to docs: baseline exports go in git **only** while data is synthetic

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
`sync-obligations` matches on industry alone. 90 of 188 rows are Oregon-specific. **A Texas chemical manufacturer is currently served Oregon requirements** — a live correctness bug, not a scale limit.

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

See `docs/CompliBoard-Compliance-Workspace-Design.md` for the full design.

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

## Next three sessions

**Session A — close the remaining holes** (0.4, 0.5, 0.6)
`/api/hr` and `/api/audits`, then tenancy consistency, then write policies on all 19 tables.

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
