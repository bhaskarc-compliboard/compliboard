# CompliBoard — Master Build Plan v3

**Date:** 9 September 2026
**Supersedes:** Build Plan v1 and v2 — delete both.
**Revised against the actual codebase**, not the due-diligence description. Six planned items were wrong; they are corrected below and marked ⟲.

**Companions:** `CompliBoard-Decisions-v1.md` · `CompliBoard-Chemical-OR-WA-Vertical-Spec.md` · `BIZPULSES-PATTERNS.md` · `CLAUDE.md`

**Legend:** ⚡ quality-affecting, discuss first · 🔒 blocking · 🅑 proven in BizPulses · ✚ improvement on BizPulses · ⟲ corrected after reading the code · ⏱ effort

---

# PART A — CODEBASE BASELINE

What is actually there, verified by reading it. Everything in Part B is built on this.

## A.1 Stack

Next.js **16.2.6**, React **19.2.4**, TypeScript, Tailwind v4, Supabase (`@supabase/ssr` + `supabase-js`), Anthropic SDK, Resend. ~9,600 lines.

⟲ **Next.js 16 and React 19 are newer than most training data.** `AGENTS.md` already warns about this and it is load-bearing: read `node_modules/next/dist/docs/` before writing route, caching, or rendering code. Keep `AGENTS.md` exactly as it is; `CLAUDE.md` imports it with `@AGENTS.md` on line 1.

**Unused dependencies:** `ai` (^6.0.192) and `@ai-sdk/anthropic` (^3.0.81) are installed but `lib/ai.ts` uses the raw Anthropic SDK. Either a second path someone started, or dead weight. Decide and remove.

## A.2 Tenancy — ⟲ corrected

**There is no `memberships` table.** Tenancy is `profiles.company_id` — one company per user:

```sql
select company_id from public.profiles where id = auth.uid()
```

v2 was written around BizPulses's memberships model. Wrong for what exists.

**Decision: keep `profiles.company_id`.** It is correct for the separate-account-per-facility approach already chosen for the six-facility cannabis prospect. Migrating to memberships becomes a prerequisite only for F5 (multi-site roll-up views), not now.

**Consequence:** drop the `useCompanyId()` multi-company hook from Phase 0. A single-company helper is still worth extracting, but there is no company switcher to build.

## A.3 Existing tables

**Six tables already exist with a migration** — `supabase/migrations/001_step3_spine.sql`:

| Table | Notes |
|---|---|
| `requirement_templates` | The library. Columns differ from the spec — see A.5 |
| `entities` | `company_id`, `entity_type`, `name`, `parent_entity_id`, `details jsonb` |
| `obligations` | `company_id`, `entity_id`, `requirement_template_id`, `status`, `due_date`, `last_verified_at`, `notes` |
| `obligation_evidence` | Minimal: `obligation_id`, `document_id`, `added_at`, `added_by` |
| `corrections` | `requirement_template_id`, `obligation_id`, `company_id`, `reported_by`, `correction_text`, `status` |
| `agencies` | `jurisdiction`, `agency_type`, `name`, `phone`, `address`, `url` |

⟲ **This is roughly a week off Phase 2.** v2 assumed these had to be created. They exist, with indexes, and the design intent is right — the migration comment reads *"THE SPINE. What is missing = a query on this table, not an AI guess."*

**Eleven tables have no migration** and exist only in the live database: `companies`, `profiles`, `documents`, `company_folders`, `document_reviews`, `audits`, `hr_audits`, `folder_audits`, `checklists`, `checklist_items`, `standard_templates`, `company_templates`, `calendar_events`.

Confirmed from code: `audits` carries **both** `company_id` and `user_id` — the tenancy inconsistency, in the flesh.

## A.4 RLS — ⟲ corrected

Migration 001 enables RLS on all six spine tables, but **only creates SELECT policies.** There are no INSERT, UPDATE, or DELETE policies anywhere.

⟲ **This is why 17 routes use the service-role key.** It was not laziness — with no write policies, service role is the only path open.

That reframes the work: adding write policies is not "hardening," it is what makes those routes *able* to stop using the key.

**Also:** migration 001 contains **no `GRANT` statements**. BizPulses's hardest-won lesson is that Supabase does not automatically grant PostgREST access to migration-created tables. Verify before assuming those six tables are reachable.

Existing policy shape (SELECT only, subquery on profiles):

```sql
create policy "obligations scoped to own company"
  on public.obligations for select to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));
```

`requirement_templates` and `agencies` are shared reference data — readable by any authenticated user, written only by service role. That is correct and stays.

## A.5 Column names — ⟲ the spec and the schema disagree

The existing `requirement_templates` uses different names from the Chemical OR/WA spec. **Do not rename existing columns** — that breaks every query. Add new columns alongside and treat the existing names as canonical where they already work.

| Spec name | Actual column | Action |
|---|---|---|
| `jurisdiction_level` | `layer` | Keep `layer`. Add `jurisdiction_city`. |
| `name` | `requirement_name` | Keep. |
| `entity_scope` | `entity_type` | Keep. Add `product` as a valid value. |
| `verification_status` | `status` (`generated`/`reviewed`) | Keep column, extend values to `generated`/`disputed`/`verified`. |
| `applies_expression` | `trigger_condition` (free text) | **Add** `applies_expression jsonb` as a new column. Keep `trigger_condition` for reference. |
| `industries[]` | `industry` (text) | **Add** `industries text[]`, backfill from `industry`, migrate reads, then drop. |

Also already present and useful: `is_determination boolean` (the `produces_switch` precursor), `source`, `trigger_plain`, `fails_if`, `priority`, `created_at`, `updated_at`.

⟲ **`agencies` has a different shape than specced** — `jurisdiction text` + `agency_type` rather than `jurisdiction_level`/`state`/`county`. It is workable. Add `jurisdiction_level`, `jurisdiction_state`, `jurisdiction_county`, `review_interval`, and `industries text[]` alongside.

⟲ **`obligation_evidence` is minimal** — no `status`, `match_confidence`, `match_rationale`, `valid_from`, `valid_until`. All need adding.

## A.6 API routes — ⟲ worse than diligence reported

**21 routes**, not 17.

- **17 use the service-role key**
- **2 verify a token:** `folders/industry`, `cron/monthly-summary`
- **9 take `company_id` or `user_id` directly from a client parameter:** `account`, `audits`, `calendar`, `document-review`, `documents`, `folders`, `hr-audits`, `obligations`, `requirements`

**The reference implementation is `app/api/folders/industry/route.ts`** — bearer token → `supabase.auth.getUser(token)` → look up `profiles.company_id` → use that value. Copy it verbatim.

## A.7 `lib/ai.ts` — better than expected

Single pipe, 108 lines, well commented. Already handles:

- Automatic retry when `stop_reason === 'max_tokens'`, doubling to a 32k ceiling, rather than surfacing a truncated result
- `enableWebSearch` as a server-side tool — one round trip
- JSON extraction tolerant of the model narrating before the object
- Concatenating every text block in order rather than assuming the first is the answer

**Gaps, all Phase 1:** no task-based model routing · no token usage recording · no default temperature (the mismatch behind the checklist quality problem).

⟲ `app/api/scan-website/route.ts` still calls the Anthropic API directly via `fetch`. `askAI()` now supports web search, so migrate it back through the pipe.

## A.8 Route file sizes

`app/compliance/page.tsx` 1,267 lines · `app/documents/page.tsx` 1,103 · `app/hr/page.tsx` 570 · `app/calendar/page.tsx` 559 · `app/audits/page.tsx` 521.

Same shape as BizPulses's 700–850 line routes, which it flags as debt. Not urgent, but do not add to them.

---

# PART B — THE PLAN

## PHASE 0 — Foundation

### 0.1 🔒 CLAUDE.md and AGENTS.md ⏱ 5 min
Replace `CLAUDE.md` with the new one. **Keep `@AGENTS.md` as line 1** and leave `AGENTS.md` untouched — its Next.js 16 warning is real.

### 0.2 🔒🅑 Migration + type generation pipeline ⏱ 1 hour
`scripts/db-migrate.js`, `scripts/db-types.js`, `.env.example`, and the `package.json` scripts. Project ref from env, not hardcoded, so staging and production can coexist.

Generated types land in `lib/database.types.ts`. Typing the Supabase clients as `createClient<Database>()` turns a wrong column name into a compile error instead of a runtime PostgREST 400. **CompliBoard has no equivalent gate today.**

### 0.3 🔒 Staging Supabase project ⏱ 30 min
Free tier. Unblocks safe migration testing now, and the shadow-checking agent (F3) later.

### 0.4 🔒 Backfill migrations for the 11 un-migrated tables ⏱ 1–2 days
Introspect production, write migration files, **replay into staging to prove it works.** BizPulses infers reproducibility and has never tested it; with two projects you can.

Every migration opens with a paragraph on *why*. 🅑

### 0.5 ⟲🔒 Write policies + GRANTs on the six spine tables ⏱ half day
Add INSERT/UPDATE/DELETE policies matching the existing SELECT pattern, plus explicit `WITH CHECK`. Add `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated, service_role;` for every table.

**This is what lets routes stop using the service-role key.**

### 0.6 🔒 RLS on the 11 backfilled tables ⏱ 1 day
Same `profiles.company_id` subquery pattern. Fully-qualified column names.

### 0.7 🔒 Fix tenancy: `company_id` everywhere ⏱ 1 day
`audits` carries both `company_id` and `user_id`. `documents` is queried by both depending on the path. Calendar is scoped to `user_id` and must be `company_id` — a compliance calendar is a company asset.

### 0.8 Auth on the 9 client-parameter routes ⏱ 1–2 days
Extract the `folders/industry` pattern to `lib/auth.ts`. Derive `company_id` from the verified token, never from a parameter. Then re-examine which of the 21 routes still need to exist at all — reads can go browser-direct under RLS.

### 0.9 ✚ Postgres ENUMs for new columns ⏱ with each migration
BizPulses uses `TEXT` + CHECK and names the resulting churn as debt — Postgres cannot add a value to a CHECK, so every addition is a drop-and-recreate restating all prior values.

Existing columns are bare `text` with no constraint at all. **Do not retrofit** — too much churn for no safety gain today. **Do use `CREATE TYPE ... AS ENUM` for every new enum-like column.**

### 0.10 ✚ `updated_at` trigger ⏱ 2 hours
The columns exist and default to `now()`, but nothing updates them on write. One trigger function applied to every table.

### 0.11 Housekeeping ⏱ 1 hour
Delete Build Plan v1 and v2, `CompliBoard-Requirements-Module-Definition.md`, `CompliBoard-Requirement-Template.xlsx` (both the project copy and the one in the repo root). Remove unused `ai` / `@ai-sdk/anthropic` deps. Resolve pricing ($199 vs $99). Remove HIPAA as a surfaced audit example. Remove or document `folder_audits`.

---

## PHASE 1 — Runtime fixes
*What changes the demo.*

### 1.1 🔒 Agency list ⏱ 1 afternoon
Populate the existing `agencies` table and tag by industry. **Moves cannabis from tier-3 (enumerate from nothing) to tier-2 (bounded agency scope).** Highest-value hour before the demo.

### 1.2 ⚡ Determination gate — Stage 1 ⏱ 1–2 days
Before enumerating: what facts decide this, which are unknown, which unknowns are *blocking*, what artifact resolves each. **The output schema must include an "ask" path** — its absence is the root cause of the demonstrated failure.

**Acceptance:** the 2.5L bottle question requests the SDS instead of enumerating past the missing packing group.

### 1.3 ⚡ Critic pass — Stage 5 ⏱ 2–3 days
Fresh call, sees only the output, adversarial framing. Physical object · regime · scope exclusions · assumed determinations · every date/fee/threshold · agency coverage · unstated assumptions.

**Acceptance:** catches the combination-packaging error in the saved 2.5L output.

### 1.4 ⚡ Split identification from expansion ⏱ 1 day
Identification at `temperature: 0.1`, stating physical object and regime. Critic runs. Only survivors get sub-steps and costs.

### 1.5 ⚡ Temperature audit ⏱ 2 hours
`lib/ai.ts` passes no temperature unless a caller sets one — so checklist generation runs at the API default. Document intended temperature per call site.

### 1.6 Model routing + token accounting in `lib/ai.ts` ⏱ half day
`task` parameter routing to model tier: strong for determination gate and identification, **strongest for critic**, cheap for expansion. Record `usage` on every call — the SDK returns it and nothing currently reads it.

### 1.7 ⟲ Migrate `scan-website` back through `askAI()` ⏱ 2 hours
It bypasses the pipe with a raw `fetch` because it needed web search. `askAI()` now supports `enableWebSearch`.

### 1.8 ✚ Zod at the AI boundary ⏱ 1–2 days
`askAIJson` currently returns `any` after a `JSON.parse`. A malformed extraction surfaces as a Postgres error. Validate at the boundary for a per-field diagnosis.

### 1.9 🅑 Two error messages, two audiences ⏱ half day
`response_message` (plain language, always written) and `error_message` (technical, with the first 3000 chars of raw model output folded in for parse failures).

### 1.10 Golden-file test set ⏱ 1 day
**Test #1 is the 2.5L bottle case with the correct answer written out.**

---

## PHASE 2 — Schema extensions
⟲ *Much smaller than v2 assumed — six of eight tables already exist.*

### 2.1 🔒 Extend `requirement_templates` ⏱ half day
Add: `industries text[]` · `jurisdiction_city` · `agency_id` · `secondary_agency_ids[]` · `applies_expression jsonb` · `scope_rules` · `citation_url` · `citation_quote` · `source_checked_at` · `citation_federal_analogue` · `produces_switch` · `verification_note` · `verified_by` · `verified_at` · `version` · `effective_from` · `effective_to` · `supersedes_id` · `cadence_type` · `cadence_anchor` · `evidence_types text[]`.

Extend `status` values to `generated`/`disputed`/`verified`.
**Do not rename existing columns.**

### 2.2 🔒 Extend `agencies` ⏱ 2 hours
Add `jurisdiction_level`, `jurisdiction_state`, `jurisdiction_county`, `industries text[]`, `review_interval`.

### 2.3 🔒 Extend `obligation_evidence` ⏱ 2 hours
Add `status`, `match_confidence`, `match_rationale`, `contribution`, `valid_from`, `valid_until`, `assessed_at`, `assessed_by`, `superseded_by`.

### 2.4 🔒 New tables ⏱ 1 day
`switches` (with `depends_on_switch`/`depends_on_value`) · `company_switches` · `industry_coverage` · `library_candidates` · `jobs`.

Only five new tables, not eleven.

### 2.5 🔒 Jurisdiction in the match key ⏱ half day
`app/api/sync-obligations/route.ts` matches on industry alone. **A live correctness bug** — a Texas chemical manufacturer is served Oregon requirements.

### 2.6 🅑✚ Derived types from the generated schema ⏱ half day
`type TableName = keyof Database["public"]["Tables"]` and equivalents. Renaming a table or switch becomes a compile error.

### 2.7 Extend `entities.entity_type` to include `product` ⏱ 10 min
Needed for cannabis per-SKU pre-approval obligations.

---

## PHASE 3 — The worker
`jobs` table as the queue · poll loop · compare-and-set claim · per-job-type serialization · stuck-job clearing · progress messaging · cancel checkpoints · first job type `index_document`.

✚ Skip BizPulses's claim/reset dance. ✚ Never assume a single worker.

🔒 **The worker never publishes regulatory content** — library generation writes `status = generated` into a review queue. 🔒 **The determination gate and critic stay synchronous.**

🅑 **The worker does not hot-reload.** Confirm a restart before asking for a test.

---

## PHASE 4 — Resolution engine
Pure code, no AI. Atomic `replace_obligations` stored function with an in-SQL ownership guard 🅑 — DELETE+INSERT in one transaction, so a failed recompute leaves prior obligations intact.

✚ **First tests in the codebase.** The safety properties must be covered: `unknown` never yields `does_not_apply` · expired evidence never yields `satisfied` · state X never receives state-Y requirements · resolution is idempotent · obligations are never deleted.

✚ `npm run check` = `typecheck && test && build`.

---

## PHASE 5 — Library data: chemical Oregon
Migrate the 188 rows (both spreadsheets merged — `MERGEDv2` has the VERIFY hit list, 26 switches, and an agency-encoding `Layer`; the intake file has normalized jurisdiction) · load 46 switches · write `applies_expression` for all rows · federal layer agency by agency · Oregon layer · primary-source retrieval · human verification by fact class · standing "confirm before publishing" list (**CFATS is entry #1**).

⟲ **`supabase/seed-data/load-chemical-requirements.sql` already exists** (109KB). Check what it loads before regenerating anything.

---

## PHASE 6 — Switch determination and evidence
Public-records lookups (EPA RCRAInfo, ECHO, TRI, FMCSA SAFER, DEQ/Ecology, **OLCC licensee list**) · ⚡ switch determination from documents · ⚡ normalize audit output into `obligation_evidence` · evidence expiry enforced in code.

---

## PHASE 7 — Screens
Registry pattern 🅑 · `note` as a first-class field 🅑 · switches screen · requirements page · coverage strip · answer display upgrades (object and regime tags) · calendar from cadence · onboarding.

CompliBoard already has a design system (`max-w-6xl`, underline tabs, flat cards). BizPulses has none and flags it as debt — **do not copy backwards.**

---

## PHASE 8 — Observability
✚ Error tracking · worker heartbeat · AI cost tracking · rate limiting. BizPulses has none of this and calls it the second-highest-value gap.

---

# FUTURE
**F1 Cannabis** — mine `library_candidates`; tag existing OSHA and fire-code rows with `cannabis` *first*; OLCC layer; license-type switch hierarchy; local layer deep for traction jurisdictions; salesperson verification tagged with who and when.
**F2 Washington** — chemical (~90 rows) then cannabis (near-full rebuild). Generated independently, never seeded from Oregon.
**F3 Checking agent** — different model, primary-source tiebreak, seeded known-bad rows, quarterly human spot-check of the checker's judgments.
**F4 Change monitoring** — Federal Register + eCFR APIs, OAR/WAC, agency bulletins.
**F5 Multi-site** — requires migrating `profiles.company_id` → memberships.
**F6 Platform** — Stripe, file upload, Drive OAuth, domain, Framer homepage, PDF export, `claude-sonnet-5` ⚡ only with a golden-file pass.
**F7 Other verticals** — hospice, brewery, food & beverage, restaurants, auto body, wood products. ISO 9001 stays on the `standard_templates` path.

---

# SESSION 1 — start here

1. Rotate the four leaked keys
2. `CLAUDE.md` (0.1)
3. Scripts + `package.json` + `.env.example` (0.2)
4. Staging project (0.3)
5. `npm run db:types` → first clean type generation
6. Schema dump → migration backfill (0.4)

Then Phase 1 for the demo.

---

# STILL NEEDED

1. **Schema dump for the 11 un-migrated tables.** The blocker on 0.4.
2. Pricing: $199 or $99, and the discount floor for a six-account deal
3. Demo date
4. Cannabis prospect: processor or not? one license entity or six?
5. What the other two salespeople are targeting
