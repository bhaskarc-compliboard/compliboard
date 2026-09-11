# Master Build Plan
**Version:** 3.4 · **Updated:** 10 September 2026
**Supersedes:** version 3.3 (10 Sep). **3.4** corrects A.5: `is_determination` is not the `produces_switch` precursor but a companion to it, and `source` becomes `generated_by` with two values — the one column rename this plan permits. See DECISIONS.md §22.

**3.3** added `PART C — MODULES`. The phases in Part B are now
horizontal only; everything vertical moved to the end. Phase 7 (Screens) was dissolved into
the modules that own each screen, and the Compliance Workspace — which had no phase here at
all, and sat at Phase 3 in `TODO.md` ahead of its own dependencies — became M1. Version 3.1
annotated where the service-role assessment had been resolved by migrations 003–005 and the
route conversions; version 3 (9 Sep) revised the plan against the actual codebase rather than
the due-diligence description — six planned items were wrong and are corrected below, marked
⟲. Versions 1 and 2 deleted.

3.2 also replaced the stale `SESSION 1 — start here` list with where the work actually is,
and dropped the schema dump from `STILL NEEDED` — it was done on 9 Sep.

**3.3** adds 2.8, the multi-facility structure, and puts a ~4 day estimate on Phase 2;
corrects A.2 — `profiles.company_id` does not block user management, only an invite flow is
missing, and `memberships` answers a different question and stays in F5; and adds the
user-management feature block, which has no phase because it needs no migration.

**Companions:** `DECISIONS.md` · `CHEMICAL-OR-WA.md` · `PATTERNS.md` · `CLAUDE.md`

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

⟲ **And it does not block user management.** Several people at one company is already a working state on this schema — two `profiles` rows sharing a `company_id`, proven on staging 10 Sep, each seeing the other's checklists. What is missing is an **invite flow**: `/api/signup` creates a new company every time, so there is no route that adds a second person to an existing one. That is a feature, not a migration. `memberships` answers a different question — **one person across several companies** — and stays in F5.

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

**Eleven tables have no migration** and exist only in the live database: `companies`, `profiles`, `documents`, `company_folders`, `document_reviews`, `audits`, `hr_audits`, `folder_audits`, `checklists`, `checklist_items`, `standard_templates`, `company_templates`, `calendar_events`. *(Resolved 9 Sep by `000_baseline.sql`, which captures all of them; `folder_audits` has since been deleted.)*

Confirmed from code: `audits` carries **both** `company_id` and `user_id` — the tenancy inconsistency, in the flesh.

## A.4 RLS — ⟲ corrected

Migration 001 enables RLS on all six spine tables, but **only creates SELECT policies.** There are no INSERT, UPDATE, or DELETE policies anywhere.

⟲ **This is why 17 routes used the service-role key.** It was not laziness — with no write policies, service role was the only path open. *(Resolved 10 Sep: migrations 003–005 gave every table full policies, and the routes were converted to run as the caller. Ten now do; four keep the key for a named reason. See `TODO.md` §0.9.)*

That reframes the work: adding write policies is not "hardening," it is what makes those routes *able* to stop using the key.

**Also:** migration 001 contains **no `GRANT` statements**. BizPulses's hardest-won lesson is that Supabase does not automatically grant PostgREST access to migration-created tables. Verify before assuming those six tables are reachable.

Existing policy shape (SELECT only, subquery on profiles):

```sql
create policy "obligations scoped to own company"
  on public.obligations for select to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));
```

`requirement_templates` and `agencies` are shared reference data — readable by any authenticated user, written only by service role. That is correct and stays. *(`standard_templates` joined them on 10 Sep; it was the only one missing its read policy.)*

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

Also already present and useful: `is_determination boolean`, `source`, `trigger_plain`, `fails_if`, `priority`, `created_at`, `updated_at`.

⟲ **Two corrections to that line (DECISIONS.md §22).** `is_determination` is **not** the `produces_switch` precursor — they coexist: the boolean says a row determines something, the name says *what*, and the resolution engine needs the second to write a value back. And `source` becomes **`generated_by`** with two values, `ai | manual`: the model name drives no decision, and trust is carried by `verification_status`, which is independent of origin. `priority` now has a written definition — the test is whether the business stops when an inspector finds it missing (§22.1).

⟲ **`agencies` has a different shape than specced** — `jurisdiction text` + `agency_type` rather than `jurisdiction_level`/`state`/`county`. It is workable. Add `jurisdiction_level`, `jurisdiction_state`, `jurisdiction_county`, `review_interval`, and `industries text[]` alongside.

⟲ **`obligation_evidence` is minimal** — no `status`, `match_confidence`, `match_rationale`, `valid_from`, `valid_until`. All need adding.

## A.6 API routes — ⟲ worse than diligence reported

**21 routes**, not 17.

- **17 use the service-role key** *(as of 9 Sep. Now 4 — see `TODO.md` §0.9.)*
- **2 verify a token:** `folders/industry`, `cron/monthly-summary`  *(as of 9 Sep: every route with company data verifies a token; `folders/industry` has since been deleted as orphaned)*
- **9 take `company_id` or `user_id` directly from a client parameter:** `account`, `audits`, `calendar`, `document-review`, `documents`, `folders`, `hr-audits`, `obligations`, `requirements`

**The reference implementation is `app/api/documents/route.ts`, using `requireCompany()` from `lib/auth.ts`** — bearer token → `supabase.auth.getUser(token)` → look up `profiles.company_id` → use that value, plus an ownership check on every row touched and 404 rather than 403. (This was originally `app/api/folders/industry/route.ts`, deleted 9 Sep as orphaned.)

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

**This is what lets routes stop using the service-role key.** *(Done 10 Sep — migrations 003–005, then the conversions.)*

### 0.6 🔒 RLS on the 11 backfilled tables ⏱ 1 day
Same `profiles.company_id` subquery pattern. Fully-qualified column names.

### 0.7 🔒 Fix tenancy: `company_id` everywhere ⏱ 1 day
`audits` carries both `company_id` and `user_id`. `documents` is queried by both depending on the path. Calendar is scoped to `user_id` and must be `company_id` — a compliance calendar is a company asset.

### 0.8 Auth on the 9 client-parameter routes ⏱ 1–2 days
Extract the token-verification pattern to `lib/auth.ts` (done 9 Sep — `requireCompany()`). Derive `company_id` from the verified token, never from a parameter. Then re-examine which of the 21 routes still need to exist at all — reads can go browser-direct under RLS.

### 0.9 ✚ Postgres ENUMs for new columns ⏱ with each migration
BizPulses uses `TEXT` + CHECK and names the resulting churn as debt — Postgres cannot add a value to a CHECK, so every addition is a drop-and-recreate restating all prior values.

Existing columns are bare `text` with no constraint at all. **Do not retrofit** — too much churn for no safety gain today. **Do use `CREATE TYPE ... AS ENUM` for every new enum-like column.**

### 0.10 ✚ `updated_at` trigger ⏱ 2 hours
The columns exist and default to `now()`, but nothing updates them on write. One trigger function applied to every table.

### 0.11 Housekeeping ⏱ 1 hour
Delete Build Plan v1 and v2, `CompliBoard-Requirements-Module-Definition.md`, `CompliBoard-Requirement-Template.xlsx` (both the project copy and the one in the repo root). Remove unused `ai` / `@ai-sdk/anthropic` deps. Resolve pricing ($199 vs $99). Remove HIPAA as a surfaced audit example. ~~Remove or document `folder_audits`.~~ Deleted 10 Sep (migration 003) — it inferred compliance from folder names, which is the false-green failure.

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

## PHASE 2 — Schema extensions ⏱ ~4 days
⟲ *Much smaller than v2 assumed — six of eight tables already exist.*

**This is `TODO.md`'s Phase 1, counted differently.** The ~4 days here is the column and
table work alone. `TODO.md` Phase 1 is **~1.5 weeks** because it also carries the design pass
(1.1), rebuilding staging from zero and then production (1.3), and `STATUS.md` (1.5). Same
work, two scopes — this plan says what is added, that one says what the week looks like.

### 2.1 🔒 Extend `requirement_templates` ⏱ half day
Add: `industries text[]` · `jurisdiction_city` · `agency_id` · `secondary_agency_ids[]` · `applies_expression jsonb` · `scope_rules` · `citation_url` · `citation_quote` · `source_checked_at` · `citation_federal_analogue` · `produces_switch` · `verification_note` · `verified_by` · `verified_at` · `version` · `effective_from` · `effective_to` · `supersedes_id` · `cadence_type` · `cadence_anchor` · `evidence_types text[]`.

Extend `status` values to `generated`/`disputed`/`verified`.
**Do not rename existing columns** — with one deliberate exception: `source` → `generated_by`, collapsing `claude|gpt|gemini` to `ai|manual` (DECISIONS.md §22.3). It is renamed rather than kept because `source` and `source_type` would otherwise sit adjacent with unrelated meanings.

### 2.2 🔒 Extend `agencies` ⏱ 2 hours
Add `jurisdiction_level`, `jurisdiction_state`, `jurisdiction_county`, `industries text[]`, `review_interval`.

### 2.3 🔒 Extend `obligation_evidence` ⏱ 2 hours
Add `status`, `match_confidence`, `match_rationale`, `contribution`, `valid_from`, `valid_until`, `assessed_at`, `assessed_by`, `superseded_by`.

### 2.4 🔒 New tables ⏱ 1 day
`switches` (with `depends_on_switch`/`depends_on_value`) · `company_switches` · `industry_coverage` · `library_candidates` · `jobs`.

Only five new tables, not eleven.

### 2.5 🔒⟲ Make the match key's inputs correct and complete ⏱ half day
⟲ **Renamed and re-scoped 11 Sep, and the bug description below was wrong in this document
and three others.**

The deleted `app/api/sync-obligations` did **not** match on industry alone — it filtered on
`jurisdiction_state`. The defect was that the state came from `scan_result->>'state'`, an
unverified AI website scan, rather than from `companies.state`. `scan_result` is null for 7
of 10 production companies, so those fell back to federal-only and **silently lost all 94
Oregon rows**; and the two sources already disagree on a live row. The direction is
under-serving, not the over-serving recorded here. Full account in `TODO.md` 1.4.

**The implementation is Phase 4 work, not Phase 2 schema work.** Phase 4 is
"jurisdiction + switches + library version → obligations", and the match key is most of
that sentence; it belongs in the resolution engine as a tested pure predicate, never as a
SQL filter whose failure mode is fewer rows with a 200.

What Phase 2 lands is the **inputs**: jurisdiction columns on `entities` so `local` and
`city` requirements are resolvable at all (migration 009), the decision that
`companies.state/county/city` is authoritative and `scan_result` never is (`DECISIONS.md`
§24.1), and the six-case match rule written into `CHEMICAL-OR-WA.md` §3.2.

### 2.6 🅑✚ Derived types from the generated schema ⏱ half day
`type TableName = keyof Database["public"]["Tables"]` and equivalents. Renaming a table or switch becomes a compile error.

### 2.7 Extend `entities.entity_type` to include `product` ⏱ 10 min
Needed for cannabis per-SKU pre-approval obligations.

### 2.8 🔒⚡ Multi-facility structure ⏱ 1 day
Design in `CHEMICAL-OR-WA.md` §6.6; decision and reasoning in `DECISIONS.md` §20.

One company with sites in different places is normal in chemical manufacturing, and their
requirement lists genuinely differ by site — different OSHA citations, different waste rules,
a different air authority. The six-facility cannabis prospect is one business with six sites,
not six legal entities.

One account per facility remains the near-term answer and it works. It costs a roll-up view,
it makes each company-level document get uploaded once per account, and consolidating later
means merging live customer accounts and choosing which copy of a shared document wins.

**Structure now, interface later.** `entities` seeded with one site per company at signup —
including single-site customers, so nothing is special-cased afterwards · `entity_id` on
`documents` and `obligation_evidence` (`obligations` already has it) · a `scope` column on
`switches`, `company` or `site`, with a nullable `entity_id` on `company_switches`, because
employee count is company-wide while generator category and air permit tier are not · sites
named the way the operator names them (`CompanyA-Hillsboro`, never `Site 2`).

⚡ **Site is a property of data, not of people.** A permit belongs to a site; a user belongs
to the company and sees all of it. *"Which site am I looking at"* is a **filter**, never a
permission. Per-user site access is the trap: it complicates the one-site case, turns a
dropdown into a permissions system, and makes every query ask which sites a person may see
before it can ask anything useful. If a customer asks for it later, it is a separate
permissions feature, priced as one.

A day now. Two to three weeks after customer data exists, because it reaches resolution,
switches, evidence, documents and every screen at once.

**Not here:** site selector, roll-up dashboard, per-site onboarding. Those are Part C.

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

## PHASE 8 — Observability
✚ Error tracking · worker heartbeat · AI cost tracking · rate limiting. BizPulses has none of this and calls it the second-highest-value gap.

---

# FEATURE — USER MANAGEMENT

**No phase, no migration, no dependency.** It works on the schema in production today, so it
is not waiting on anything in Part B — it ships when a customer needs it.

Invite a person to an existing company · list who has access · remove access. Records created
by a removed person **survive**: the compliance record is a company asset (`DECISIONS.md` §1,
§14), so revoking access must never cascade a delete through someone's document reviews,
audits or checklists.

**Ships rather than being stockpiled.** Code written and held back has never been tested
against real use, and an invite flow is exactly where the first real attempt finds the
problems — mail that does not arrive, a link that expires, an invitee who already has an
account somewhere else.

🅑 **Port the flow from BizPulses, not the schema.** It has invite/list/remove already. Its
`memberships` table answers a different question (one person, several organisations) and
stays in F5.

**The interim has a cost, and it is a choice rather than an oversight.** Early customers with
more than one person share a login (`DECISIONS.md` §17.4). Every write records `user_id`, so
a shared login attributes every upload, tick and audit run to one person. *"Who marked this
complete, and when"* is part of what a compliance record is for. A shared login does not
corrupt the record; it flattens it, and it cannot be un-flattened afterwards.

---

# PART C — MODULES

Everything in Part B is **horizontal**: schema, the runtime pipeline, the worker, resolution,
library data, observability. Each of those is infrastructure that every part of the product
stands on. This part is **vertical**: one module at a time, built last, on ground that has
stopped moving.

**Why the order changed.** Screens used to be Phase 7, sitting inside the horizontal
sequence, and the Compliance Workspace had no phase in this plan at all — it lived only in
`WORKSPACE.md` and, in `TODO.md`, at Phase 3, ahead of the determination gate, the critic
pass, `company_switches` and the resolution engine that are all *inputs* to it. A module
built while its foundations are being poured is a module built twice. Meanwhile the other
six modules had no phase either: their findings sat scattered as debts under whichever
gap-closing session happened to surface them.

**This makes the plan longer and more honest — most of the real product work is in this
part.** Part B is short by comparison because infrastructure is smaller than product.

**There is no Phase 7 above.** It was Screens, and it moved here, distributed to the modules
that own each screen. The remaining phases are deliberately not renumbered — this document,
`TODO.md` and `DECISIONS.md` reference phases by number throughout, and renumbering breaks
every reference silently.

`TODO.md` carries these at task level, as M1–M7, with the findings behind each. This is the
*why*; that is the *what next*.

**Design system:** CompliBoard already has one (`max-w-6xl`, underline tabs, flat cards).
BizPulses has none and flags it as debt — **do not copy backwards.** Registry pattern 🅑 ·
`note` as a first-class field 🅑 apply across every module below.

## M1 — Compliance Workspace
The conversation surface. Follow-up classification, fact capture into `company_switches` with
`basis`, scoped questions, topic lifecycle, in-context fact display, answer display with
object and regime tags. Full design in `WORKSPACE.md`.
**Depends on** the determination gate and critic pass (1.2, 1.3), `company_switches` (2.4),
resolution (Phase 4).

## M2 — Audits
Readiness rebuilt on `obligation_evidence` rows rather than recomputed per run, and the whole
engine moved to the worker — it is the clearest case in the codebase for Phase 3.
⚠️ **One item does not wait for its turn:** the auto-index loop drops any document it cannot
download, silently, and computes readiness correctly from a smaller input. Observed in a real
run on 10 Sep — two satisfied, one needs-info, computed from one readable document out of
eight. Half a day, live in production.
**Depends on** the worker (Phase 3), Phase 6's normalisation of audit output into
`obligation_evidence`, Zod at the AI boundary (1.8).

## M3 — HR
One requirements table tagged by domain, not a separate system. Findings as rows with a
lifecycle instead of a frozen JSON blob; audit reads the whole handbook set; `draft_policies`
off until there are verified rows behind it. Today the "requirements" are eleven hardcoded
words in a prompt with no jurisdiction and no thresholds — a handbook can pass "FMLA present"
and miss both Oregon obligations.
**Depends on** the employment law library, which is horizontal and belongs in Part B.

## M4 — Documents
Index once at upload as a worker job rather than reviewing the same file twice inline; make
"what this document is about" joinable to requirement rows rather than prose; record what a
document supersedes.
**Depends on** the worker (Phase 3), schema versioning (Phase 2).

## M5 — Calendar
Cadence read from obligations, not extracted from whatever dates a PDF happened to mention.
Extraction survives only for the date the law cannot know — this permit's expiry — which is
the anchored mode the model is reliable in.
**Depends on** library cadence (Phase 5), resolution (Phase 4).

## M6 — Dashboard
Real metrics only once evidence rows exist. Today the number can only climb, which is a
progress bar, not a compliance measure. Requirements page grouped by agency, coverage strip
from `industry_coverage`, the verification section from `WORKSPACE.md` — three at a time,
empty state is the good state. **Numbers stay off until the library is verified** (Phase 5's human verification pass).
**Depends on** Phase 6's evidence normalisation, `industry_coverage` (2.4).

## M7 — Onboarding and signup
Remove the industry dropdown — it is circular, offering only verticals already built. Email,
password, website and **address**; the scan as a background job; classification presented as a
teaching confirmation; unmatched industries write to `library_candidates`, so signup doubles
as demand research. Design in `WORKSPACE.md` §10.
**Depends on** the worker (Phase 3), `library_candidates` (2.4).

---

# FUTURE
**F1 Cannabis** — mine `library_candidates`; tag existing OSHA and fire-code rows with `cannabis` *first*; OLCC layer; license-type switch hierarchy; local layer deep for traction jurisdictions; salesperson verification tagged with who and when.
**F2 Washington** — chemical (~90 rows) then cannabis (near-full rebuild). Generated independently, never seeded from Oregon.
**F3 Checking agent** — different model, primary-source tiebreak, seeded known-bad rows, quarterly human spot-check of the checker's judgments.
**F4 Change monitoring** — Federal Register + eCFR APIs, OAR/WAC, agency bulletins.
**F5 Multi-site** — the roll-up dashboard and site selector, on the structure 2.8 puts in
place. `memberships` belongs here and nowhere else: it solves **one person across several
companies**, not several people in one company, and it is not a prerequisite for user
management. ⚠️ `auth_company_id()` returns a single `uuid` and **54 of 58 policies** call it,
plus four storage policies — changing its signature is its own migration with its own
rehearsal.
**F6 Platform** — Stripe, file upload, Drive OAuth, domain, Framer homepage, PDF export, `claude-sonnet-5` ⚡ only with a golden-file pass.
**F7 Other verticals** — hospice, brewery, food & beverage, restaurants, auto body, wood products. ISO 9001 stays on the `standard_templates` path.

---

# WHERE THIS ACTUALLY IS — 10 September 2026

**Phase 0 is done except housekeeping.** 0.1–0.3 landed 9 Sep. 0.4 was solved differently
than planned — no Docker, so the baseline was reconstructed from the production catalogs
(`000_baseline.sql`, 19 tables, structure only). 0.5–0.8 landed as migrations 002–005, all
applied to production, plus the route conversions: every route now derives the company from
the verified session, ten run under RLS on the caller's token, and the four that keep the
service-role key each carry a named reason in the file.

**What is left of Phase 0:** housekeeping (`TODO.md` §0.7), and key rotation — still
outstanding, now six credentials rather than four, and now item 1 of the gate at the top of
`TODO.md`.

**Next:** Phase 2 (schema extensions) as the rebuild, then Phase 1 (runtime fixes), because
the rebuild is cheap only until the first real customer document is in the database. Read the
gate in `TODO.md` before choosing anything else.

---

# STILL NEEDED

1. Pricing: $199 or $99, and the discount floor for a six-account deal
2. Cannabis prospect: processor or not? one license entity or six?
3. What the other two salespeople are targeting

**No demo date.** Built properly, phase by phase, ready when it is ready (`TODO.md`).
