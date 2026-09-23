# The Database

**GENERATED — do not edit.** `node --env-file=.env.local scripts/schema-doc.js`, and it runs
inside `npm run db:migrate`, so it cannot be stale by more than one migration.

**Read from:** staging (`amzsavsrabrlcprltpom`) · **on** 2026-09-23 04:25 UTC
**Migrations applied:** 37 — `000` to `036`

*Every figure here was read from the catalog of that database. Nothing is copied from the
migration files, which say what was intended rather than what is there — and the two have
differed (`CLAUDE.md` §3.6: default privileges grant what no GRANT statement mentions).*

---

## What this database is for

CompliBoard tells a business what it must do to be compliant and proves it against their real
documents. The schema has one organising idea, and it is worth holding while reading the rest:

> **`requirement_templates` is what the law requires. `switches` is the vocabulary of facts a
> business can have. `company_switches` is this business's answers. `obligations` is which
> requirements therefore apply — computed in code, never by a model.**

Everything else is either evidence that an obligation is met, a working surface over those four,
or tenancy. **Tenancy is `company_id` on every data table and RLS on all of them** — never a
`user_id`, and never enforced in a route alone.

## Which module uses which tables

**Compliance Workspace (M1) — research, conversations, checklists**

- `topics` — 0 rows · touched by route chat, route checklists/from-topic, route documents, route jobs/delete, route jobs/summarise, +3 more
- `checklists` — 0 rows · touched by route account, route checklists/from-topic, route link-research, route substeps, screen compliance, +1 more
- `checklist_items` — 0 rows · touched by route account/export, route account, route checklists/from-topic, route substeps, screen compliance, +1 more
- `critic_reviews` — 0 rows · touched by lib criticRecord
- `critic_findings` — 0 rows · touched by lib criticRecord

**Requirements (the deterministic spine)**

- `requirement_templates` — 205 rows · touched by route industries, route obligations, route switches/answer, route switches/ask, lib obligationWriter, +4 more
- `switches` — 95 rows · touched by route chat, route obligations, route switches/answer, route switches/ask, lib determinationGate, +5 more
- `company_switches` — 16 rows · touched by route switches/answer, route switches/ask, lib determinationGate, lib obligationWriter, script resolve-dryrun, +2 more
- `switch_determinations` — 0 rows · touched by route switches/answer, script audit-data-checks, script check-live
- `obligations` — 0 rows · touched by route account, route obligations, route switches/answer
- `obligation_evidence` — 0 rows · touched by route account/export, route account
- `agencies` — 33 rows · touched by route obligations, lib agencyScope, script load-agencies
- `industry_coverage` — 56 rows · touched by script assign-agencies
- `library_candidates` — 0 rows · **no code reads or writes it**
- `corrections` — 0 rows · **no code reads or writes it**

**Documents and evidence**

- `documents` — 0 rows · touched by route audits, route document-review, route documents, route folders, route hr, +1 more
- `document_reviews` — 0 rows · touched by route audits, route document-review, lib documentReview
- `company_folders` — 0 rows · touched by route document-review, route documents, route folders
- `company_templates` — 0 rows · touched by route audits
- `standard_templates` — 0 rows · touched by route audits

**Audits (M2)**

- `audits` — 0 rows · touched by route audits
- `hr_audits` — 0 rows · touched by route hr-audits

**Chemicals and substances**

- `company_chemicals` — 0 rows · touched by script audit-data-checks, script check-live
- `regulated_substances` — 0 rows · touched by script audit-data-checks

**Tenancy and accounts**

- `companies` — 3 rows · touched by route account/export, route account, route audits, route document-review, route hr, +13 more
- `profiles` — 4 rows · touched by route account/export, route account, route signup, screen audits, screen calendar, +8 more
- `entities` — 4 rows · touched by route switches/answer, route switches/ask, lib agencyScope, lib determinationGate, lib obligationWriter, +5 more

**Calendar**

- `calendar_events` — 0 rows · touched by route calendar

**Worker queue**

- `jobs` — 0 rows · **no code reads or writes it**

**Not assigned to a module above:** `fact_proposals`, `job_runs`, `turns`, `usage_counters`

---

## Every table

### `agencies`

Regulators. Reference data, not customer data: readable by any authenticated user, written only by the service role. Empty until Phase 2.1.

**Rows:** 33 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route obligations`, `lib agencyScope`, `script load-agencies`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `name` | text | no | — |
| `short_name` | text | no | — |
| `agency_type` | text | yes | — |
| `jurisdiction_level` | `jurisdiction_layer` (enum) | no | — |
| `jurisdiction_state` | text | yes | — |
| `jurisdiction_county` | text | yes | — |
| `jurisdiction_city` | text | yes | — |
| `industries` | ARRAY | no | `'{}'::text[]` |
| `review_interval` | text | yes | — |
| `url` | text | yes | — |
| `phone` | text | yes | — |
| `address` | text | yes | — |
| `contact_email` | text | yes | — |
| `notes` | text | yes | — |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Pointed at by:**

- `industry_coverage.agency_id` — ON DELETE CASCADE
- `requirement_templates.agency_id` — ON DELETE SET NULL

**Constraints:**

- `agencies_named_jurisdiction` — `CHECK (
CASE jurisdiction_level
    WHEN 'federal'::jurisdiction_layer THEN (jurisdiction_state IS NULL)
    WHEN 'state'::jurisdiction_layer THEN (jurisdiction_state IS NOT NULL)
    WHEN 'county'::jurisdiction_layer THEN ((jurisdiction_state IS NOT NULL) AND (jurisdiction_county IS NOT NULL))
    WHEN 'city'::jurisdiction_layer THEN ((jurisdiction_state IS NOT NULL) AND (jurisdiction_city IS NOT NULL))
    WHEN 'local'::jurisdiction_layer THEN (jurisdiction_state IS NOT NULL)
    ELSE false
END)`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `agencies readable by authenticated users` | SELECT | authenticated | `true` | — |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `agencies_pkey`, `agencies_short_name_jurisdiction_key`, `idx_agencies_industries`, `idx_agencies_jurisdiction`

### `audits`

One row per audit run. A frozen snapshot of results as checked that day — reusing a template later never rewrites past runs.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route audits`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `user_id` | uuid | no | — |
| `source_type` | text | no | — |
| `source_name` | text | no | — |
| `standard_template_id` | uuid | yes | — |
| `company_template_id` | uuid | yes | — |
| `uploaded_file_url` | text | yes | — |
| `line_items` | jsonb | no | `'[]'::jsonb` |
| `readiness_satisfied` | integer | no | `0` |
| `readiness_needs_info` | integer | no | `0` |
| `readiness_needs_work` | integer | no | `0` |
| `created_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `company_template_id` → `company_templates` — ON DELETE NO ACTION
- `standard_template_id` → `standard_templates` — ON DELETE NO ACTION

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `audits_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `audits_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `audits_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `audits_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `audits_pkey`

### `calendar_events`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route calendar`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | yes | — |
| `user_id` | uuid | yes | — |
| `title` | text | no | — |
| `description` | text | yes | — |
| `due_date` | date | no | — |
| `category` | text | yes | — |
| `is_recurring` | boolean | yes | `false` |
| `recurrence_period` | text | yes | — |
| `completed` | boolean | yes | `false` |
| `completed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | yes | `timezone('utc'::text, now())` |
| `entity_id` | uuid | yes | — |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `entity_id` → `entities` — ON DELETE SET NULL
- `user_id` → `auth.users` — ON DELETE CASCADE

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `calendar_events_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `calendar_events_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `calendar_events_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `calendar_events_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `calendar_events_pkey`, `idx_calendar_events_entity`

### `checklist_items`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route account/export`, `route account`, `route checklists/from-topic`, `route substeps`, `screen compliance`, `script check-live`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `checklist_id` | uuid | yes | — |
| `category` | `checklist_item_category` (enum) | no | — |
| `name` | text | no | — |
| `description` | text | yes | — |
| `why` | text | yes | — |
| `required_by` | text | yes | — |
| `recommended_by` | text | yes | — |
| `source_url` | text | yes | — |
| `cost_note` | text | yes | — |
| `providers` | jsonb | yes | `'[]'::jsonb` |
| `completed` | boolean | yes | `false` |
| `completed_at` | timestamp with time zone | yes | — |
| `sort_order` | integer | yes | `0` |
| `parent_item_index` | integer | yes | — |
| `time_estimate` | text | yes | — |
| `what_you_need` | text | yes | — |
| `is_determination` | boolean | yes | `false` |
| `clarifying_questions` | jsonb | yes | `'[]'::jsonb` |
| `agency_name` | text | yes | — |
| `search_hint` | text | yes | — |
| `pre_completed` | boolean | yes | `false` |
| `source` | text | yes | — |
| `company_id` | uuid | no | — |
| `origin` | text | yes | — |
| `source_title` | text | yes | — |

**Points at:**

- `checklist_id` → `checklists` — ON DELETE CASCADE
- `company_id` → `companies` — ON DELETE CASCADE

**Constraints:**

- `checklist_items_origin_is_known` — `CHECK (((origin IS NULL) OR (origin = ANY (ARRAY['conversation'::text, 'added'::text]))))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `checklist_items_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `checklist_items_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `checklist_items_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `checklist_items_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `checklist_items_pkey`, `idx_checklist_items_company`

### `checklists`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route account`, `route checklists/from-topic`, `route link-research`, `route substeps`, `screen compliance`, `screen dashboard`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | yes | — |
| `user_id` | uuid | yes | — |
| `question` | text | no | — |
| `title` | text | no | — |
| `safety_alert` | text | yes | — |
| `created_at` | timestamp with time zone | yes | `timezone('utc'::text, now())` |
| `research_answer` | text | yes | — |
| `converted_to_checklist_id` | uuid | yes | — |
| `research_sources` | jsonb | yes | — |
| `from_topic_id` | uuid | yes | — |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `converted_to_checklist_id` → `checklists` — ON DELETE NO ACTION
- `from_topic_id` → `topics` — ON DELETE SET NULL
- `user_id` → `auth.users` — ON DELETE CASCADE

**Pointed at by:**

- `checklist_items.checklist_id` — ON DELETE CASCADE
- `checklists.converted_to_checklist_id` — ON DELETE NO ACTION

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `checklists_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `checklists_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `checklists_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `checklists_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `checklists_pkey`, `idx_checklists_from_topic`

### `companies`

**Rows:** 3 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route account/export`, `route account`, `route audits`, `route document-review`, `route hr`, `route obligations`, `route signup`, `screen audits`, `screen compliance`, `screen dashboard`, `screen documents`, `screen hr`, `lib agencyScope`, `lib obligationWriter`, `script resolve-dryrun`, `script run-golden`, `script seed-multisite-fixture`, `script seed-staging-testdata`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `name` | text | no | — |
| `industry` | text | yes | — |
| `state` | text | yes | — |
| `county` | text | yes | — |
| `city` | text | yes | — |
| `employee_count` | integer | yes | — |
| `chemicals` | text | yes | — |
| `extra_profile` | jsonb | yes | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | yes | `timezone('utc'::text, now())` |
| `website_url` | text | yes | — |
| `scan_result` | jsonb | yes | — |
| `pre_completed_items` | jsonb | yes | — |
| `obligations_computed_at` | timestamp with time zone | yes | — |

**Pointed at by:**

- `audits.company_id` — ON DELETE CASCADE
- `calendar_events.company_id` — ON DELETE CASCADE
- `checklist_items.company_id` — ON DELETE CASCADE
- `checklists.company_id` — ON DELETE CASCADE
- `company_chemicals.company_id` — ON DELETE CASCADE
- `company_folders.company_id` — ON DELETE CASCADE
- `company_switches.company_id` — ON DELETE CASCADE
- `company_templates.company_id` — ON DELETE CASCADE
- `corrections.company_id` — ON DELETE SET NULL
- `critic_findings.company_id` — ON DELETE CASCADE
- `critic_reviews.company_id` — ON DELETE CASCADE
- `document_reviews.company_id` — ON DELETE CASCADE
- `documents.company_id` — ON DELETE CASCADE
- `entities.company_id` — ON DELETE CASCADE
- `fact_proposals.company_id` — ON DELETE CASCADE
- `hr_audits.company_id` — ON DELETE NO ACTION
- `jobs.company_id` — ON DELETE CASCADE
- `obligation_evidence.company_id` — ON DELETE CASCADE
- `obligations.company_id` — ON DELETE CASCADE
- `profiles.company_id` — ON DELETE NO ACTION
- `switch_determinations.company_id` — ON DELETE CASCADE
- `topics.company_id` — ON DELETE CASCADE
- `turns.company_id` — ON DELETE CASCADE
- `usage_counters.company_id` — ON DELETE CASCADE

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `companies_select` | SELECT | authenticated | `(id = auth_company_id())` | — |
| `companies_update` | UPDATE | authenticated | `(id = auth_company_id())` | `(id = auth_company_id())` |

**Triggers:** `create_primary_site` (AFTER → `create_primary_site`)

**Indexes:** `companies_pkey`

### `company_chemicals`

What one SITE holds, by CAS where identified. Tenant data. Replaces four boolean switches that were stand-ins for a per-substance calculation: a site with 9,000 lb each of five chemicals is below every threshold and reports nothing, which is correct and is not expressible as a boolean. Does NOT replace the exposure_* switches, which are airborne concentration rather than quantity held. Migration 013.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `script audit-data-checks`, `script check-live`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `entity_id` | uuid | no | — |
| `cas_number` | text | yes | — |
| `substance_name` | text | no | — |
| `max_quantity` | numeric | yes | — |
| `unit` | `chemical_unit` (enum) | yes | — |
| `physical_state` | `chemical_state` (enum) | yes | — |
| `source` | `switch_value_source` (enum) | yes | — |
| `confidence` | `switch_confidence` (enum) | yes | — |
| `basis` | text | yes | — |
| `determined_at` | timestamp with time zone | yes | — |
| `expires_at` | timestamp with time zone | yes | — |
| `user_locked` | boolean | no | `false` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `cas_number` → `regulated_substances` — ON DELETE RESTRICT
- `company_id` → `companies` — ON DELETE CASCADE
- `entity_id` → `entities` — ON DELETE CASCADE

**Constraints:**

- `company_chemicals_quantity_has_unit` — `CHECK ((((max_quantity IS NULL) AND (unit IS NULL)) OR ((max_quantity IS NOT NULL) AND (unit IS NOT NULL))))`
- `company_chemicals_quantity_not_negative` — `CHECK (((max_quantity IS NULL) OR (max_quantity >= (0)::numeric)))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `company_chemicals_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `company_chemicals_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `company_chemicals_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `company_chemicals_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `company_chemicals_one_per_site`, `company_chemicals_pkey`, `idx_company_chemicals_cas`, `idx_company_chemicals_company`, `idx_company_chemicals_entity`, `idx_company_chemicals_expiry`

### `company_folders`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route document-review`, `route documents`, `route folders`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | yes | — |
| `name` | text | no | — |
| `parent_id` | uuid | yes | — |
| `sort_order` | integer | yes | `0` |
| `created_at` | timestamp with time zone | yes | `now()` |
| `section` | `folder_section` (enum) | no | `'files'::folder_section` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `parent_id` → `company_folders` — ON DELETE CASCADE

**Pointed at by:**

- `company_folders.parent_id` — ON DELETE CASCADE
- `documents.folder_id` — ON DELETE SET NULL

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `company_folders_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `company_folders_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `company_folders_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `company_folders_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `company_folders_pkey`

### `company_switches`

**Rows:** 16 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route switches/answer`, `route switches/ask`, `lib determinationGate`, `lib obligationWriter`, `script resolve-dryrun`, `script run-golden`, `script seed-multisite-fixture`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `switch_id` | text | no | — |
| `scope` | `switch_scope` (enum) | no | — |
| `entity_id` | uuid | yes | — |
| `value` | text | yes | — |
| `state` | `switch_state` (enum) | no | `'unknown'::switch_state` |
| `confidence` | `switch_confidence` (enum) | yes | — |
| `basis` | jsonb | yes | — |
| `source` | `switch_value_source` (enum) | yes | — |
| `determined_at` | timestamp with time zone | yes | — |
| `expires_at` | timestamp with time zone | yes | — |
| `user_locked` | boolean | no | `false` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |
| `determined_from` | uuid | yes | — |
| `evidence_class` | `evidence_class` (enum) | yes | — |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `determined_from` → `switch_determinations` — ON DELETE SET NULL
- `entity_id` → `entities` — ON DELETE CASCADE
- `evidence_class` → `switch_determinations` — ON DELETE SET NULL
- `scope` → `switches` — ON DELETE NO ACTION
- `switch_id` → `switches` — ON DELETE NO ACTION

**Constraints:**

- `company_switches_evidence_class_not_absent` — `CHECK ((evidence_class IS DISTINCT FROM 'absent'::evidence_class))`
- `company_switches_site_scope_has_a_site` — `CHECK ((((scope = 'company'::switch_scope) AND (entity_id IS NULL)) OR ((scope = 'site'::switch_scope) AND (entity_id IS NOT NULL))))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `company_switches_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `company_switches_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `company_switches_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `company_switches_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `company_switches_one_value_per_scope`, `company_switches_pkey`, `idx_company_switches_company`, `idx_company_switches_entity`, `idx_company_switches_expiry`, `idx_company_switches_switch`

### `company_templates`

Private, per-company parsed templates (a specific buyers own form). Never shared across companies. Re-run reuses the active version; a genuinely new version increments version and deactivates the old one.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route audits`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `source_name` | text | no | — |
| `uploaded_file_url` | text | yes | — |
| `line_items` | jsonb | no | `'[]'::jsonb` |
| `version` | integer | no | `1` |
| `is_active` | boolean | no | `true` |
| `created_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE

**Pointed at by:**

- `audits.company_template_id` — ON DELETE NO ACTION

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `company_templates_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `company_templates_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `company_templates_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `company_templates_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `company_templates_pkey`

### `corrections`

User-reported fixes to any requirement or obligation. The learning loop.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by: NOTHING in app/, lib/ or scripts/.**

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `requirement_template_id` | uuid | yes | — |
| `obligation_id` | uuid | yes | — |
| `company_id` | uuid | yes | — |
| `reported_by` | uuid | yes | — |
| `correction_text` | text | no | — |
| `status` | text | yes | `'pending'::text` |
| `created_at` | timestamp with time zone | yes | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE SET NULL
- `obligation_id` → `obligations` — ON DELETE CASCADE
- `reported_by` → `auth.users` — ON DELETE SET NULL
- `requirement_template_id` → `requirement_templates` — ON DELETE CASCADE

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `corrections_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `corrections_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `corrections_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `corrections_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `corrections_pkey`

### `critic_findings`

What the critic found, never shown to a customer (DECISIONS.md §97). `quote` is verbatim from the answer and is constrained non-blank because a finding that cannot point at a sentence is an impression (CRITIC-PASS.md §7). Migration 029.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `lib criticRecord`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `review_id` | uuid | no | — |
| `company_id` | uuid | no | — |
| `severity` | `critic_severity` (enum) | no | — |
| `question_no` | smallint | no | — |
| `item` | text | yes | — |
| `finding` | text | no | — |
| `because` | text | yes | — |
| `quote` | text | no | — |
| `disposition` | `critic_disposition` (enum) | no | — |
| `created_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `review_id` → `critic_reviews` — ON DELETE CASCADE

**Constraints:**

- `critic_findings_question_no_is_1_to_7` — `CHECK (((question_no >= 1) AND (question_no <= 7)))`
- `critic_findings_quote_is_not_blank` — `CHECK ((length(btrim(quote)) > 0))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS is enabled and there are NO policies** — so no role without a bypass can see a row.

**Indexes:** `critic_findings_pkey`, `idx_critic_findings_company_severity`, `idx_critic_findings_review`

### `critic_reviews`

One row per criticise() call, INCLUDING reviews that found nothing — that is the denominator CRITIC-PASS.md §7.1 needs for "blocking findings as a share of answers". Findings are never shown to a customer (DECISIONS.md §97); this is where the evidence lives instead. Migration 029.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `lib criticRecord`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `source` | `critic_source` (enum) | no | — |
| `question` | text | no | — |
| `answer_title` | text | yes | — |
| `complete` | boolean | no | — |
| `created_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE

**Pointed at by:**

- `critic_findings.review_id` — ON DELETE CASCADE

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS is enabled and there are NO policies** — so no role without a bypass can see a row.

**Indexes:** `critic_reviews_pkey`, `idx_critic_reviews_company_created`

### `document_reviews`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route audits`, `route document-review`, `lib documentReview`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | yes | — |
| `user_id` | uuid | yes | — |
| `document_id` | uuid | yes | — |
| `document_name` | text | no | — |
| `folder_id` | uuid | yes | — |
| `folder_name` | text | yes | — |
| `division_name` | text | yes | — |
| `document_type` | text | yes | — |
| `issued_by` | text | yes | — |
| `issue_date` | date | yes | — |
| `expiry_date` | date | yes | — |
| `renewal_date` | date | yes | — |
| `is_current` | boolean | yes | — |
| `expiring_soon` | boolean | yes | — |
| `days_until_expiry` | integer | yes | — |
| `coverage` | text | yes | — |
| `gaps` | jsonb | yes | `'[]'::jsonb` |
| `action_items` | jsonb | yes | `'[]'::jsonb` |
| `summary` | text | yes | — |
| `created_at` | timestamp with time zone | yes | `now()` |
| `regulation_reference` | text | yes | — |
| `gap_fixes` | jsonb | yes | `'[]'::jsonb` |
| `entity_id` | uuid | yes | — |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `document_id` → `documents` — ON DELETE CASCADE
- `entity_id` → `entities` — ON DELETE SET NULL

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `document_reviews_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `document_reviews_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `document_reviews_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `document_reviews_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `document_reviews_pkey`, `idx_document_reviews_entity`

### `documents`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route audits`, `route document-review`, `route documents`, `route folders`, `route hr`, `route hr-audits`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | yes | — |
| `user_id` | uuid | yes | — |
| `name` | text | no | — |
| `file_url` | text | no | — |
| `file_type` | text | no | — |
| `file_size` | bigint | yes | — |
| `is_recurring` | boolean | yes | `false` |
| `recurrence_period` | text | yes | — |
| `uploaded_at` | timestamp with time zone | yes | `timezone('utc'::text, now())` |
| `folder_id` | uuid | yes | — |
| `entity_id` | uuid | yes | — |
| `from_topic_id` | uuid | yes | — |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `entity_id` → `entities` — ON DELETE SET NULL
- `folder_id` → `company_folders` — ON DELETE SET NULL
- `from_topic_id` → `topics` — ON DELETE SET NULL
- `user_id` → `auth.users` — ON DELETE CASCADE

**Pointed at by:**

- `document_reviews.document_id` — ON DELETE CASCADE
- `obligation_evidence.company_id` — ON DELETE CASCADE
- `obligation_evidence.document_id` — ON DELETE CASCADE
- `obligation_evidence.document_id` — ON DELETE CASCADE
- `switch_determinations.document_id` — ON DELETE SET NULL

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `documents_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `documents_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `documents_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `documents_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `documents_id_company`, `documents_pkey`, `idx_documents_entity`, `idx_documents_from_topic`

### `entities`

**Rows:** 4 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route switches/answer`, `route switches/ask`, `lib agencyScope`, `lib determinationGate`, `lib obligationWriter`, `script check-live`, `script resolve-dryrun`, `script run-golden`, `script seed-multisite-fixture`, `script seed-staging-testdata`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `entity_type` | `entity_scope` (enum) | no | — |
| `name` | text | no | — |
| `parent_entity_id` | uuid | yes | — |
| `is_primary` | boolean | no | `false` |
| `details` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |
| `state` | text | yes | — |
| `county` | text | yes | — |
| `city` | text | yes | — |
| `address` | text | yes | — |
| `postal_code` | text | yes | — |
| `fire_authority` | text | yes | — |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `parent_entity_id` → `entities` — ON DELETE SET NULL

**Pointed at by:**

- `calendar_events.entity_id` — ON DELETE SET NULL
- `company_chemicals.entity_id` — ON DELETE CASCADE
- `company_switches.entity_id` — ON DELETE CASCADE
- `document_reviews.entity_id` — ON DELETE SET NULL
- `documents.entity_id` — ON DELETE SET NULL
- `entities.parent_entity_id` — ON DELETE SET NULL
- `obligation_evidence.entity_id` — ON DELETE CASCADE
- `obligations.entity_id` — ON DELETE CASCADE
- `switch_determinations.entity_id` — ON DELETE CASCADE

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `entities_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `entities_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `entities_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `entities_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `entities_pkey`, `idx_entities_company`, `idx_entities_jurisdiction`, `idx_entities_one_primary`, `idx_entities_parent`

### `fact_proposals`

Candidate company facts read out of a conversation overnight. PROPOSED, never written to company_switches — DECISIONS.md §108. The quote is copied because the turn it came from is cleared after 7 days.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route jobs/summarise`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `topic_id` | uuid | no | — |
| `switch_key` | text | no | — |
| `proposed_value` | text | no | — |
| `from_turn_id` | uuid | yes | — |
| `quote` | text | yes | — |
| `status` | text | no | `'proposed'::text` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `from_turn_id` → `turns` — ON DELETE SET NULL
- `topic_id` → `topics` — ON DELETE CASCADE

**Constraints:**

- `fact_proposals_status_check` — `CHECK ((status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'rejected'::text])))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `fact_proposals_select_own_company` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `fact_proposals_update_own_company` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Triggers:** `set_updated_at_fact_proposals` (BEFORE → `set_updated_at`)

**Indexes:** `fact_proposals_pkey`, `idx_fact_proposals_company_status`, `idx_fact_proposals_topic`

### `hr_audits`

Saved HR handbook audit results, one row per audit run.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route hr-audits`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `user_id` | uuid | no | — |
| `handbook_name` | text | no | — |
| `handbook_file_url` | text | no | — |
| `present` | jsonb | no | `'[]'::jsonb` |
| `missing` | jsonb | no | `'[]'::jsonb` |
| `draft_policies` | jsonb | no | `'[]'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE NO ACTION

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `hr_audits_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `hr_audits_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `hr_audits_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `hr_audits_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `hr_audits_pkey`

### `industry_coverage`

industry x jurisdiction x agency -> how far we have got. Reads the same way to the pipeline and to the user: the coverage strip is this table rendered. Empty until the agencies table is populated (Phase 2.1), because every row names an agency.

**Rows:** 56 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `script assign-agencies`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `industry` | text | no | — |
| `jurisdiction_state` | text | yes | — |
| `agency_id` | uuid | no | — |
| `status` | `coverage_status` (enum) | no | `'not_built'::coverage_status` |
| `row_count` | integer | no | `0` |
| `last_verified_at` | timestamp with time zone | yes | — |
| `verified_by` | text | yes | — |
| `notes` | text | yes | — |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `agency_id` → `agencies` — ON DELETE CASCADE

**Constraints:**

- `industry_coverage_verified_has_a_verifier` — `CHECK (((status <> 'verified'::coverage_status) OR ((verified_by IS NOT NULL) AND (last_verified_at IS NOT NULL))))`
- `industry_coverage_verified_has_rows` — `CHECK (((status = 'not_built'::coverage_status) OR (row_count > 0)))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `industry_coverage readable by authenticated users` | SELECT | authenticated | `true` | — |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `idx_industry_coverage_agency`, `idx_industry_coverage_lookup`, `industry_coverage_pkey`, `industry_coverage_unique`

### `job_runs`

One row per nightly run. Answers release gate 2 — did it run, and what did it remove (DECISIONS.md §116, §125). Operational, not tenant data: closed to authenticated.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `lib jobAuth`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `job` | text | no | — |
| `started_at` | timestamp with time zone | no | `now()` |
| `finished_at` | timestamp with time zone | yes | — |
| `counts` | jsonb | no | `'{}'::jsonb` |
| `errors` | jsonb | no | `'[]'::jsonb` |
| `ok` | boolean | yes | — |

**Constraints:**

- `job_runs_job_check` — `CHECK ((job = ANY (ARRAY['summarise'::text, 'delete'::text, 'account_delete'::text])))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS is enabled and there are NO policies** — so no role without a bypass can see a row.

**Indexes:** `idx_job_runs_job_started`, `job_runs_pkey`

### `jobs`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by: NOTHING in app/, lib/ or scripts/.**

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `job_type` | `job_type` (enum) | no | — |
| `status` | `job_status` (enum) | no | `'pending'::job_status` |
| `company_id` | uuid | yes | — |
| `serialization_key` | text | no | — |
| `payload` | jsonb | no | `'{}'::jsonb` |
| `result` | jsonb | yes | — |
| `progress_message` | text | yes | — |
| `attempts` | integer | no | `0` |
| `max_attempts` | integer | no | `3` |
| `cancel_requested` | boolean | no | `false` |
| `heartbeat_at` | timestamp with time zone | yes | — |
| `response_message` | text | yes | — |
| `error_message` | text | yes | — |
| `scheduled_for` | timestamp with time zone | no | `now()` |
| `started_at` | timestamp with time zone | yes | — |
| `finished_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE

**Constraints:**

- `jobs_attempts_within_limit` — `CHECK ((attempts <= max_attempts))`
- `jobs_finished_after_started` — `CHECK (((finished_at IS NULL) OR (started_at IS NULL) OR (finished_at >= started_at)))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `jobs_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `idx_jobs_claim`, `idx_jobs_company`, `idx_jobs_one_running_per_key`, `jobs_pkey`

### `library_candidates`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by: NOTHING in app/, lib/ or scripts/.**

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `industry` | text | no | — |
| `jurisdiction_state` | text | yes | — |
| `normalized_name` | text | no | — |
| `raw_name` | text | no | — |
| `citation_guess` | text | yes | — |
| `agency_guess` | text | yes | — |
| `times_seen` | integer | no | `1` |
| `first_seen_at` | timestamp with time zone | no | `now()` |
| `last_seen_at` | timestamp with time zone | no | `now()` |
| `status` | text | no | `'new'::text` |
| `operator_feedback` | text | yes | — |
| `promoted_to_requirement_id` | uuid | yes | — |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `promoted_to_requirement_id` → `requirement_templates` — ON DELETE SET NULL

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS is enabled and there are NO policies** — so no role without a bypass can see a row.

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `idx_library_candidates_queue`, `library_candidates_pkey`, `library_candidates_unique`

### `obligation_evidence`

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route account/export`, `route account`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `obligation_id` | uuid | no | — |
| `document_id` | uuid | yes | — |
| `entity_id` | uuid | yes | — |
| `status` | text | yes | — |
| `contribution` | `evidence_contribution` (enum) | no | `'satisfies'::evidence_contribution` |
| `match_confidence` | text | yes | — |
| `match_rationale` | text | yes | — |
| `valid_from` | date | yes | — |
| `valid_until` | date | yes | — |
| `assessed_at` | timestamp with time zone | yes | — |
| `assessed_by` | text | yes | — |
| `superseded_by` | uuid | yes | — |
| `added_at` | timestamp with time zone | no | `now()` |
| `added_by` | uuid | yes | — |
| `matched_by` | `evidence_source` (enum) | no | — |
| `superseded_reason` | text | yes | — |

**Points at:**

- `added_by` → `auth.users` — ON DELETE SET NULL
- `company_id` → `documents` — ON DELETE CASCADE
- `company_id` → `companies` — ON DELETE CASCADE
- `document_id` → `documents` — ON DELETE CASCADE
- `document_id` → `documents` — ON DELETE CASCADE
- `entity_id` → `entities` — ON DELETE CASCADE
- `obligation_id` → `obligations` — ON DELETE CASCADE
- `superseded_by` → `obligation_evidence` — ON DELETE SET NULL

**Pointed at by:**

- `obligation_evidence.superseded_by` — ON DELETE SET NULL

**Constraints:**

- `obligation_evidence_confidence_fits_source` — `CHECK ((((matched_by = 'user'::evidence_source) AND (match_confidence IS NULL)) OR ((matched_by <> 'user'::evidence_source) AND (match_confidence IS NOT NULL))))`
- `obligation_evidence_window` — `CHECK (((valid_until IS NULL) OR (valid_from IS NULL) OR (valid_until >= valid_from)))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `obligation_evidence_delete` | DELETE | authenticated | `(company_id = auth_company_id())` | — |
| `obligation_evidence_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `obligation_evidence_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `obligation_evidence_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Indexes:** `idx_obligation_evidence_company`, `idx_obligation_evidence_document`, `idx_obligation_evidence_entity`, `idx_obligation_evidence_expiry`, `idx_obligation_evidence_obligation`, `idx_obligation_evidence_one_live`, `obligation_evidence_pkey`

### `obligations`

The resolved list: which library rows apply to this company. Produced by CODE, never by AI. Rows are NEVER DELETED — a requirement that stops applying gets applicable_to set and stays. CLAUDE.md §3.2.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route account`, `route obligations`, `route switches/answer`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `entity_id` | uuid | yes | — |
| `requirement_template_id` | uuid | no | — |
| `status` | `obligation_status` (enum) | no | `'unknown'::obligation_status` |
| `applicable_from` | date | no | `CURRENT_DATE` |
| `applicable_to` | date | yes | — |
| `due_date` | date | yes | — |
| `last_verified_at` | timestamp with time zone | yes | — |
| `notes` | text | yes | — |
| `resolved_by` | text | no | `'ai_inferred'::text` |
| `resolution_rationale` | text | yes | — |
| `determined_by` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `entity_id` → `entities` — ON DELETE CASCADE
- `requirement_template_id` → `requirement_templates` — ON DELETE RESTRICT

**Pointed at by:**

- `corrections.obligation_id` — ON DELETE CASCADE
- `obligation_evidence.obligation_id` — ON DELETE CASCADE

**Constraints:**

- `obligations_window` — `CHECK (((applicable_to IS NULL) OR (applicable_to >= applicable_from)))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `obligations_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `obligations_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `obligations_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `idx_obligations_company`, `idx_obligations_entity`, `idx_obligations_one_open`, `idx_obligations_template`, `obligations_pkey`

### `profiles`

**Rows:** 4 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route account/export`, `route account`, `route signup`, `screen audits`, `screen calendar`, `screen compliance`, `screen dashboard`, `screen documents`, `screen hr`, `screen upload`, `lib auth`, `script check-live`, `script seed-staging-testdata`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | — |
| `company_id` | uuid | yes | — |
| `full_name` | text | yes | — |
| `created_at` | timestamp with time zone | yes | `timezone('utc'::text, now())` |

**Points at:**

- `company_id` → `companies` — ON DELETE NO ACTION
- `id` → `auth.users` — ON DELETE CASCADE

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `profiles_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `Users can update own profile` | UPDATE | authenticated | `(auth.uid() = id)` | — |

**Indexes:** `profiles_pkey`

### `regulated_substances`

The federal lists, keyed by CAS. Reference data: identical for every customer, so the thresholds live here once rather than on each company row. NULL threshold means not on that list — not "no threshold". Migration 013.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `cas_number`

**Read or written by:** `script audit-data-checks`

| Column | Type | Null | Default |
|---|---|---|---|
| `cas_number` | text | no | — |
| `name` | text | no | — |
| `synonyms` | ARRAY | no | `'{}'::text[]` |
| `is_ehs` | boolean | no | `false` |
| `ehs_tpq_lb` | numeric | yes | — |
| `is_tri_listed` | boolean | no | `false` |
| `tri_manufacture_lb` | numeric | yes | — |
| `tri_otherwise_used_lb` | numeric | yes | — |
| `is_psm_listed` | boolean | no | `false` |
| `psm_threshold_lb` | numeric | yes | — |
| `is_rmp_listed` | boolean | no | `false` |
| `rmp_threshold_lb` | numeric | yes | — |
| `cercla_rq_lb` | numeric | yes | — |
| `is_dea_list_i` | boolean | no | `false` |
| `source_list` | text | yes | — |
| `source_url` | text | yes | — |
| `source_checked_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Pointed at by:**

- `company_chemicals.cas_number` — ON DELETE RESTRICT

**Constraints:**

- `regulated_substances_cas_format` — `CHECK ((cas_number ~ '^[0-9]{2,7}-[0-9]{2}-[0-9]$'::text))`
- `regulated_substances_ehs_has_tpq` — `CHECK (((NOT is_ehs) OR (ehs_tpq_lb IS NOT NULL)))`
- `regulated_substances_psm_has_threshold` — `CHECK (((NOT is_psm_listed) OR (psm_threshold_lb IS NOT NULL)))`
- `regulated_substances_rmp_has_threshold` — `CHECK (((NOT is_rmp_listed) OR (rmp_threshold_lb IS NOT NULL)))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `regulated_substances readable by authenticated users` | SELECT | authenticated | `true` | — |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `regulated_substances_pkey`

### `requirement_templates`

THE LIBRARY. What the law requires, by industry and jurisdiction. Reference data: global, readable by any authenticated user, written only by the service role. Rows are VERSIONED, never edited in place — a change is a new row with version + 1 and the old row gets effective_to. CLAUDE.md §3.2.

**Rows:** 205 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route industries`, `route obligations`, `route switches/answer`, `route switches/ask`, `lib obligationWriter`, `script assign-agencies`, `script load-expressions`, `script load-requirements`, `script resolve-dryrun`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `version` | integer | no | `1` |
| `supersedes_id` | uuid | yes | — |
| `split_from_id` | uuid | yes | — |
| `effective_from` | date | yes | — |
| `effective_to` | date | yes | — |
| `requirement_name` | text | no | — |
| `category` | text | yes | — |
| `entity_type` | `entity_scope` (enum) | no | `'organization'::entity_scope` |
| `source_type` | `requirement_source_type` (enum) | no | `'statutory'::requirement_source_type` |
| `jurisdiction_layer` | `jurisdiction_layer` (enum) | yes | — |
| `jurisdiction_state` | text | yes | — |
| `jurisdiction_county` | text | yes | — |
| `jurisdiction_city` | text | yes | — |
| `industries` | ARRAY | no | `'{}'::text[]` |
| `agency_id` | uuid | yes | — |
| `secondary_agency_ids` | ARRAY | no | `'{}'::uuid[]` |
| `citation` | text | yes | — |
| `citation_url` | text | yes | — |
| `citation_quote` | text | yes | — |
| `citation_federal_analogue` | text | yes | — |
| `source_checked_at` | timestamp with time zone | yes | — |
| `applies` | `applies_mode` (enum) | no | `'universal'::applies_mode` |
| `applies_expression` | jsonb | yes | — |
| `trigger_condition` | text | yes | — |
| `trigger_plain` | text | yes | — |
| `scope_rules` | text | yes | — |
| `produces_switch` | text | yes | — |
| `is_determination` | boolean | no | `false` |
| `cadence_type` | text | yes | — |
| `cadence_anchor` | text | yes | — |
| `cadence` | text | yes | — |
| `evidence_description` | text | yes | — |
| `evidence_types` | ARRAY | no | `'{}'::text[]` |
| `fails_if` | text | yes | — |
| `priority` | `requirement_priority` (enum) | no | `'high'::requirement_priority` |
| `status` | `verification_status` (enum) | no | `'generated'::verification_status` |
| `verification_note` | text | yes | — |
| `verified_by` | text | yes | — |
| `verified_at` | timestamp with time zone | yes | — |
| `generated_by` | `generated_by` (enum) | no | `'ai'::generated_by` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `agency_id` → `agencies` — ON DELETE SET NULL
- `split_from_id` → `requirement_templates` — ON DELETE SET NULL
- `supersedes_id` → `requirement_templates` — ON DELETE SET NULL

**Pointed at by:**

- `corrections.requirement_template_id` — ON DELETE CASCADE
- `library_candidates.promoted_to_requirement_id` — ON DELETE SET NULL
- `obligations.requirement_template_id` — ON DELETE RESTRICT
- `requirement_templates.split_from_id` — ON DELETE SET NULL
- `requirement_templates.supersedes_id` — ON DELETE SET NULL

**Constraints:**

- `requirement_templates_contractual_has_no_jurisdiction` — `CHECK ((((source_type = 'contractual'::requirement_source_type) AND (jurisdiction_layer IS NULL)) OR ((source_type <> 'contractual'::requirement_source_type) AND (jurisdiction_layer IS NOT NULL))))`
- `requirement_templates_named_jurisdiction` — `CHECK ((((jurisdiction_layer IS DISTINCT FROM 'county'::jurisdiction_layer) OR (jurisdiction_county IS NOT NULL)) AND ((jurisdiction_layer IS DISTINCT FROM 'city'::jurisdiction_layer) OR (jurisdiction_city IS NOT NULL)) AND ((jurisdiction_layer IS DISTINCT FROM 'state'::jurisdiction_layer) OR (jurisdiction_state IS NOT NULL))))`
- `requirement_templates_version_window` — `CHECK (((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to >= effective_from)))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `requirement_templates readable by authenticated users` | SELECT | authenticated | `true` | — |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `idx_requirement_templates_agency`, `idx_requirement_templates_industries`, `idx_requirement_templates_jurisdiction`, `idx_requirement_templates_live`, `idx_requirement_templates_split_from`, `idx_requirement_templates_supersedes`, `requirement_templates_name_version_key`, `requirement_templates_pkey`

### `standard_templates`

Reusable, shared parsed checklist per named standard. Built once, reused by every company auditing against that standard.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route audits`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `standard_name` | text | no | — |
| `source` | text | no | `'ai_generated'::text` |
| `line_items` | jsonb | no | `'[]'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Pointed at by:**

- `audits.standard_template_id` — ON DELETE NO ACTION

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `standard_templates_select` | SELECT | authenticated | `true` | — |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `standard_templates_pkey`, `standard_templates_standard_name_key`

### `switch_determinations`

Every determination ever made about a company's switches, append-only. company_switches
holds the current winner and points here with determined_from. Exists so that
document-versus-document disagreement is recorded WITHOUT reusing user_locked, which means a
PERSON decided and must keep meaning only that. DECISIONS.md §24.1, §47;
docs/SWITCH-DETERMINATION.md §7.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route switches/answer`, `script audit-data-checks`, `script check-live`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `entity_id` | uuid | yes | — |
| `switch_id` | text | no | — |
| `value` | text | yes | — |
| `evidence_class` | `evidence_class` (enum) | no | — |
| `confidence` | `switch_confidence` (enum) | yes | — |
| `document_id` | uuid | yes | — |
| `locator` | text | yes | — |
| `quote` | text | yes | — |
| `reasoning` | text | yes | — |
| `source` | `switch_value_source` (enum) | no | — |
| `model` | text | yes | — |
| `prompt_sha256` | text | yes | — |
| `determined_at` | timestamp with time zone | no | `now()` |
| `created_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `document_id` → `documents` — ON DELETE SET NULL
- `entity_id` → `entities` — ON DELETE CASCADE
- `switch_id` → `switches` — ON DELETE RESTRICT

**Pointed at by:**

- `company_switches.determined_from` — ON DELETE SET NULL
- `company_switches.evidence_class` — ON DELETE SET NULL

**Constraints:**

- `switch_determinations_absent_has_no_value` — `CHECK ((((evidence_class = 'absent'::evidence_class) AND (value IS NULL)) OR (evidence_class <> 'absent'::evidence_class)))`
- `switch_determinations_declared_has_no_document` — `CHECK (((evidence_class <> 'declared'::evidence_class) OR ((document_id IS NULL) AND (quote IS NULL))))`
- `switch_determinations_quote_needs_a_document` — `CHECK (((quote IS NULL) OR (document_id IS NOT NULL)))`
- `switch_determinations_stated_needs_evidence` — `CHECK (((evidence_class <> ALL (ARRAY['stated'::evidence_class, 'implied'::evidence_class])) OR ((document_id IS NOT NULL) AND (quote IS NOT NULL))))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `switch_determinations_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `switch_determinations_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |

**Indexes:** `idx_switch_determinations_company`, `idx_switch_determinations_document`, `switch_determinations_id_class`, `switch_determinations_pkey`

### `switches`

The ~59 facts about a company that determine which requirements apply. Reference data: global, readable by any authenticated user, written only by the service role. CHEMICAL-OR-WA.md §2.2 and §2.4.

**Rows:** 95 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route chat`, `route obligations`, `route switches/answer`, `route switches/ask`, `lib determinationGate`, `lib obligationWriter`, `script load-switches`, `script resolve-dryrun`, `script run-golden`, `script seed-multisite-fixture`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | text | no | — |
| `label` | text | no | — |
| `scope` | `switch_scope` (enum) | no | — |
| `value_type` | `switch_value_type` (enum) | no | — |
| `allowed_values` | ARRAY | no | `'{}'::text[]` |
| `question_plain` | text | yes | — |
| `determination_source` | `switch_determination_source` (enum) | no | — |
| `volatility` | `switch_volatility` (enum) | no | `'static'::switch_volatility` |
| `jurisdiction_variant` | boolean | no | `false` |
| `depends_on_switch` | text | yes | — |
| `depends_on_value` | text | yes | — |
| `domain` | text | yes | — |
| `notes` | text | yes | — |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |
| `thresholds` | ARRAY | yes | — |

**Points at:**

- `depends_on_switch` → `switches` — ON DELETE SET NULL

**Pointed at by:**

- `company_switches.scope` — ON DELETE NO ACTION
- `company_switches.switch_id` — ON DELETE NO ACTION
- `switch_determinations.switch_id` — ON DELETE RESTRICT
- `switches.depends_on_switch` — ON DELETE SET NULL

**Constraints:**

- `switches_dependency_is_complete` — `CHECK ((((depends_on_switch IS NULL) AND (depends_on_value IS NULL)) OR ((depends_on_switch IS NOT NULL) AND (depends_on_value IS NOT NULL))))`
- `switches_enum_has_values` — `CHECK (((value_type <> 'enum'::switch_value_type) OR (cardinality(allowed_values) > 0)))`
- `switches_no_self_dependency` — `CHECK ((depends_on_switch IS DISTINCT FROM id))`
- `switches_thresholds_only_on_numeric` — `CHECK (((thresholds IS NULL) OR (value_type = 'number'::switch_value_type)))`
- `switches_thresholds_sorted_and_distinct` — `CHECK (((thresholds IS NULL) OR (cardinality(thresholds) = 0) OR array_is_ascending(thresholds)))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `switches readable by authenticated users` | SELECT | authenticated | `true` | — |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `idx_switches_depends_on`, `idx_switches_scope`, `switches_id_scope_key`, `switches_pkey`

### `topics`

One exploration. The transcript is disposable (WORKSPACE.md §6.4); the summary is what survives. Holds NO facts — a hypothetical is never stored (DECISIONS.md §78) and a real fact goes to company_switches. Migration 028.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route chat`, `route checklists/from-topic`, `route documents`, `route jobs/delete`, `route jobs/summarise`, `route topics/[id]`, `lib conversation`, `script check-live`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `company_id` | uuid | no | — |
| `title` | text | no | — |
| `status` | `topic_status` (enum) | no | `'open'::topic_status` |
| `opened_at` | timestamp with time zone | no | `now()` |
| `closed_at` | timestamp with time zone | yes | — |
| `summary` | text | yes | — |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |
| `idle_at` | timestamp with time zone | yes | — |
| `summarised_at` | timestamp with time zone | yes | — |
| `summary_source` | text | yes | — |
| `extracted_at` | timestamp with time zone | yes | — |
| `delete_after` | timestamp with time zone | yes | — |
| `last_turn_at` | timestamp with time zone | yes | — |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE

**Pointed at by:**

- `checklists.from_topic_id` — ON DELETE SET NULL
- `documents.from_topic_id` — ON DELETE SET NULL
- `fact_proposals.topic_id` — ON DELETE CASCADE
- `turns.topic_id` — ON DELETE CASCADE

**Constraints:**

- `topics_closed_has_a_time` — `CHECK ((((status = 'closed'::topic_status) AND (closed_at IS NOT NULL)) OR ((status = 'open'::topic_status) AND (closed_at IS NULL))))`
- `topics_summary_source_is_known` — `CHECK (((summary_source IS NULL) OR (summary_source = ANY (ARRAY['user'::text, 'nightly'::text]))))`
- `topics_title_is_not_blank` — `CHECK ((length(btrim(title)) > 0))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `topics_insert` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `topics_select` | SELECT | authenticated | `(company_id = auth_company_id())` | — |
| `topics_update` | UPDATE | authenticated | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |

**Triggers:** `set_updated_at` (BEFORE → `set_updated_at`)

**Indexes:** `idx_topics_company_status`, `idx_topics_delete_after`, `idx_topics_last_turn`, `topics_pkey`

### `turns`

One message in a conversation. Cleared 7 days after the topic is summarised (DECISIONS.md §125, superseding §110's 15 days); the topic row and its summary survive.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `id`

**Read or written by:** `route jobs/delete`, `route jobs/summarise`, `lib conversation`, `script check-live`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `topic_id` | uuid | no | — |
| `company_id` | uuid | no | — |
| `position` | integer | no | — |
| `role` | text | no | — |
| `text` | text | no | — |
| `sources` | jsonb | yes | — |
| `stopped` | boolean | no | `false` |
| `created_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE
- `topic_id` → `topics` — ON DELETE CASCADE

**Pointed at by:**

- `fact_proposals.from_turn_id` — ON DELETE SET NULL

**Constraints:**

- `turns_role_check` — `CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `turns_insert_own_company` | INSERT | authenticated | — | `(company_id = auth_company_id())` |
| `turns_select_own_company` | SELECT | authenticated | `(company_id = auth_company_id())` | — |

**Indexes:** `idx_turns_company_created`, `idx_turns_topic`, `idx_turns_topic_position`, `turns_pkey`

### `usage_counters`

Events, not inventory. Never decremented, never derived from row counts — transcripts are cleared after 7 days and checklists can be deleted, and neither rewrites what happened. DECISIONS.md §125.

**Rows:** 0 · **RLS:** enabled · **Primary key:** `company_id`

**Read or written by:** `lib conversation`, `script check-live`

| Column | Type | Null | Default |
|---|---|---|---|
| `company_id` | uuid | no | — |
| `questions_answered` | integer | no | `0` |
| `checklists_created` | integer | no | `0` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

**Points at:**

- `company_id` → `companies` — ON DELETE CASCADE

**Constraints:**

- `usage_counters_checklists_created_check` — `CHECK ((checklists_created >= 0))`
- `usage_counters_questions_answered_check` — `CHECK ((questions_answered >= 0))`

**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*

- `anon` — **nothing**
- `authenticated` — **nothing**
- `service_role` — **nothing**

**RLS policies:**

| Policy | For | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| `usage_counters_select_own_company` | SELECT | authenticated | `(company_id = auth_company_id())` | — |

**Triggers:** `set_updated_at_usage_counters` (BEFORE → `set_updated_at`)

**Indexes:** `usage_counters_pkey`

---

## Enums

| Type | Values |
|---|---|
| `applies_mode` | conditional | universal |
| `checklist_item_category` | must_do | good_to_have |
| `chemical_state` | solid | liquid | gas |
| `chemical_unit` | lb | gal | ft3 |
| `coverage_status` | not_built | generated | verified |
| `critic_disposition` | withheld | kept | counted |
| `critic_severity` | blocking | qualifying | coverage |
| `critic_source` | chat_checklist | audit |
| `entity_scope` | organization | site | chemical | equipment | person | product |
| `evidence_class` | stated | declared | implied | inferred | absent |
| `evidence_contribution` | satisfies | partially_satisfies | contradicts | superseded |
| `evidence_source` | user | document_review | ai_match |
| `folder_section` | files | hr | log |
| `generated_by` | ai | manual |
| `job_status` | pending | running | succeeded | failed | cancelled |
| `job_type` | index_document | generate_library | check_library | monitor_changes |
| `jurisdiction_layer` | federal | state | county | city | local |
| `obligation_status` | applies | does_not_apply | undetermined | unknown |
| `obligation_type` | permit | written_program | training | recordkeeping | monitoring | reporting | physical_control | certification | credential | fees_taxes |
| `requirement_priority` | critical | high | standard |
| `requirement_source_type` | statutory | contractual |
| `switch_confidence` | high | medium | low |
| `switch_determination_source` | documents | profile | user_answer | computed_by_requirement |
| `switch_scope` | company | site |
| `switch_state` | known | unknown | needs_user |
| `switch_value_source` | ai_from_documents | ai_from_profile | user_set | computed |
| `switch_value_type` | enum | boolean | number | text |
| `switch_volatility` | static | annual | monthly |
| `topic_status` | open | closed |
| `verification_status` | generated | disputed | verified |

## Functions

### `array_is_ascending(a numeric[])`

**Returns** `boolean` · **security invoker**

Strictly ascending test for a numeric array. Exists because a CHECK constraint may not contain a subquery and this rule needs one — see migration 012 section 3. IMMUTABLE so the planner accepts it inside a constraint.

### `auth_company_id()`

**Returns** `uuid` · **SECURITY DEFINER**

The company of the currently authenticated user, read from profiles with definer rights so that tenancy does not depend on the RLS policies of profiles itself. Every company-scoped policy in this database is expressed through this function. Returns null when there is no session or the user has no profile, and a null company_id never matches a row, so the failure direction is closed.

### `close_and_replace_obligations(p_company_id uuid, p_obligations jsonb)`

**Returns** `jsonb` · **security invoker**

Writes one company's obligations atomically. CLOSES rows that changed or went away by
setting applicable_to, and INSERTS the new ones — it contains no DELETE, because obligations
are history and CLAUDE.md §3.2 forbids deleting them. Unchanged rows are touched, not
reopened, so a repeat run writes nothing. Close runs before insert because
idx_obligations_one_open rejects the other order. Ownership is checked in SQL: the only
caller holds the service role and RLS will not check it for them. DECISIONS.md §47.

### `create_primary_site()`

**Returns** `trigger` · **security invoker**

Gives every new company a primary site, in the same statement that creates the company. TODO 1.6: a default site for everyone, including single-site customers, so that nothing downstream ever has to ask whether a company has sites. A trigger rather than route code because /api/signup is three inserts with no transaction, and a site created by the third one is a site that can silently fail to exist.

### `increment_usage_counter(p_company_id uuid, p_field text)`

**Returns** `void` · **security invoker**

Atomic +1 on a usage counter. Counters record events and never go down (DECISIONS.md §125). service_role only.

### `set_updated_at()`

**Returns** `trigger` · **security invoker**

Advances updated_at on UPDATE. Attached to every table carrying the column. Before this existed the column defaulted on INSERT and never moved again.

### `substance_inventory(p_entity_id uuid, p_list text)`

**Returns** `boolean` · **security invoker**

Does this SITE hold ANY ONE substance at or above ITS OWN threshold on the named list? An EXISTS, never a sum. THREE-VALUED: true when a known substance is over its threshold (safe even if the rest of the inventory is incomplete); NULL when nothing is recorded OR when any row is unidentified, unquantified, or in a unit we cannot compare; false only when every row is evaluable and none qualifies. An unidentified drum is absence of evidence, and absence of evidence never produces a clear — CLAUDE.md §3.2. Migrations 013 and 014.

## Views

### `obligation_evidence_state`

What has been SHOWN for each obligation. NOT whether it is owed — that is
obligations.status, and the two are independent facts (docs/EVIDENCE-LINKING.md §5). Expiry is
filtered HERE so no consumer can forget it (CLAUDE.md §3.2). A corrected link
(superseded_reason set) is excluded exactly as a superseded one is.

## Triggers

| Table | Trigger | When | Function |
|---|---|---|---|
| `agencies` | `set_updated_at` | BEFORE | `set_updated_at` |
| `companies` | `create_primary_site` | AFTER | `create_primary_site` |
| `company_chemicals` | `set_updated_at` | BEFORE | `set_updated_at` |
| `company_switches` | `set_updated_at` | BEFORE | `set_updated_at` |
| `entities` | `set_updated_at` | BEFORE | `set_updated_at` |
| `fact_proposals` | `set_updated_at_fact_proposals` | BEFORE | `set_updated_at` |
| `industry_coverage` | `set_updated_at` | BEFORE | `set_updated_at` |
| `jobs` | `set_updated_at` | BEFORE | `set_updated_at` |
| `library_candidates` | `set_updated_at` | BEFORE | `set_updated_at` |
| `obligations` | `set_updated_at` | BEFORE | `set_updated_at` |
| `regulated_substances` | `set_updated_at` | BEFORE | `set_updated_at` |
| `requirement_templates` | `set_updated_at` | BEFORE | `set_updated_at` |
| `standard_templates` | `set_updated_at` | BEFORE | `set_updated_at` |
| `switches` | `set_updated_at` | BEFORE | `set_updated_at` |
| `topics` | `set_updated_at` | BEFORE | `set_updated_at` |
| `usage_counters` | `set_updated_at_usage_counters` | BEFORE | `set_updated_at` |

## Migrations applied, in order

```
000
001
002
003
004
005
006
007
008
009
010
011
012
013
014
015
016
017
018
019
020
021
022
023
024
025
026
027
028
029
030
031
032
033
034
035
036
```
