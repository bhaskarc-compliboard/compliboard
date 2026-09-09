# CompliBoard — Current Production Schema

Captured **2026-09-09** from the live production Supabase project
(the ref in `SUPABASE_PROD_REF` in `.env.local` — not reproduced here).

Read via the Supabase CLI Management API as `supabase_read_only_user`
(`npx supabase db query --project-ref <SUPABASE_PROD_REF> --linked`). No writes were
issued and none are possible with that role.

PostgreSQL 17.6. Database `postgres`.

This document is a **snapshot of what is actually in production**, not a description of
what the migration files say should be there. Where the two disagree, this file is the
one that reflects reality.

---

## Contents

- [At a glance](#at-a-glance)
- [Findings worth acting on](#findings-worth-acting-on)
- [Global objects](#global-objects) — extensions, custom types, functions, triggers, sequences
- [Grants](#grants)
- [Tables](#tables) (alphabetical)
- [Storage](#storage)

---

## At a glance

**19 tables**, all in the `public` schema. No views, no materialised views, no
partitioned or foreign tables.

| Table | Rows | RLS | Policies |
|---|---:|---|---:|
| agencies | 0 | enabled | 1 |
| audits | 6 | enabled | **0** |
| calendar_events | 47 | enabled | 4 |
| checklist_items | 235 | enabled | 4 |
| checklists | 11 | enabled | 3 |
| companies | 10 | enabled | 3 |
| company_folders | 85 | enabled | 1 (ALL) |
| company_templates | 0 | enabled | **0** |
| corrections | 0 | enabled | 1 |
| document_reviews | 33 | enabled | **0** |
| documents | 38 | enabled | 3 |
| entities | 0 | enabled | 1 |
| folder_audits | 1 | enabled | 3 |
| hr_audits | 1 | enabled | **0** |
| obligation_evidence | 0 | enabled | 1 |
| obligations | 376 | enabled | 1 |
| profiles | 4 | enabled | 3 |
| requirement_templates | 188 | enabled | 1 |
| standard_templates | 1 | enabled | **0** |

Row counts are exact (`count(*)` at capture time), not estimates. `pg_class.reltuples`
was `-1` for most tables, meaning they have never been analysed or vacuumed.

RLS is enabled on every table, and `FORCE ROW LEVEL SECURITY` is off on every table
(so the table owner and superuser roles bypass RLS — this is the normal Supabase setup).

---

## Findings worth acting on

These are observations from the capture, not changes. Nothing here was altered.

1. **Storage policies do not scope by company or by user.** All three policies on
   `storage.objects` test only `bucket_id = 'company-documents'`. Any authenticated
   user can read, and delete, every file belonging to every other company. The policy
   names say "own folder" and "own files"; the expressions do not implement that. There
   are 52 objects across 7 distinct first path segments. See [Storage](#storage).

2. **Five tables have RLS enabled and zero policies:** `audits`, `company_templates`,
   `document_reviews`, `hr_audits`, `standard_templates`. RLS with no policy denies
   everything, so `anon` and `authenticated` cannot read or write these at all —
   every access is necessarily going through the service-role key today. `document_reviews`
   holds 33 rows and `audits` 6, so this path is live.

3. **Tenancy is split between two different keys.** `calendar_events`, `checklists`,
   `checklist_items`, `documents` and `folder_audits` scope by `user_id = auth.uid()`.
   `companies`, `company_folders`, `corrections`, `entities`, `obligations` and
   `obligation_evidence` scope by `company_id` via the `profiles` subquery. Two users at
   the same company cannot currently see each other's documents or calendar events.

4. **Write policies are missing on the company-scoped tables.** `obligations`,
   `obligation_evidence`, `entities` and `corrections` have `SELECT` only — no INSERT,
   UPDATE or DELETE. `documents` and `checklists` have no UPDATE policy. This matches
   the note in `CLAUDE.md` §3.6 about migration 001 being SELECT-only.

5. **No `WITH CHECK` on any UPDATE policy.** `calendar_events`, `checklists`,
   `checklist_items`, `companies` and `profiles` all have `USING` on UPDATE with no
   `WITH CHECK`, so a row can be updated into a state that no longer satisfies the
   policy — e.g. reassigning `user_id` to another user.

6. **No CHECK constraints exist anywhere in the database**, and no `ENUM` types exist.
   Every enum-like column (`obligations.status`, `obligations.resolved_by`,
   `requirement_templates.applies`, `.layer`, `.priority`, `.status`, `.entity_type`,
   `corrections.status`, `company_folders.section`, and others) is plain `TEXT` with a
   default and nothing constraining the value.

7. **No triggers and no functions exist in `public`.** The nine `updated_at` columns
   (`agencies`, `entities`, `obligations`, `requirement_templates`, `standard_templates`)
   default to `now()` on insert and are never advanced afterwards unless application code
   sets them explicitly.

8. **Most foreign keys are unindexed.** Only `entities.company_id`, `obligations.company_id`,
   `obligations.entity_id`, `obligations.requirement_template_id`,
   `obligation_evidence.obligation_id` and `obligation_evidence.document_id` have indexes.
   `documents.company_id`, `documents.folder_id`, `document_reviews.company_id`,
   `checklists.company_id`, `checklist_items.checklist_id`, `company_folders.company_id`,
   `company_folders.parent_id`, `calendar_events.company_id` and others have none.

9. **`anon` holds full DML grants on all 19 tables** (Supabase default privileges). RLS
   is the only thing preventing anonymous writes — consistent with `CLAUDE.md` §3.6
   treating RLS as the security boundary, but worth being explicit about.

10. **`hr_audits.company_id` and `profiles.company_id` have no `ON DELETE` action**
    (default `NO ACTION`), while every other reference to `companies` cascades. Deleting
    a company with rows in either table will fail on the constraint.

11. **`agencies`, `company_templates`, `corrections`, `entities` and `obligation_evidence`
    are empty**, so the entity/evidence half of the Requirements model is not yet in use
    in production. `obligations` (376) and `requirement_templates` (188) are populated.

---

## Global objects

### Extensions

| Extension | Version | Schema |
|---|---|---|
| pg_stat_statements | 1.11 | extensions |
| pgcrypto | 1.3 | extensions |
| plpgsql | 1.0 | pg_catalog |
| supabase_vault | 0.3.1 | vault |
| uuid-ossp | 1.1 | extensions |

### Custom types and enums

**None in `public`.** No enums, no domains, no composite types.

The only enum in a non-system schema is `storage.buckettype`
(`STANDARD`, `ANALYTICS`, `VECTOR`), which ships with Supabase Storage.

### Functions

**None in `public`.**

### Triggers

**None in `public`.**

### Sequences

**None in `public`.** Every primary key is a UUID defaulting to `gen_random_uuid()`,
except `profiles.id`, which has no default and is supplied from `auth.users.id`.

---

## Grants

Every one of the 19 tables carries the identical Supabase default grant set:

```
GRANT ALL ON <table> TO anon;
GRANT ALL ON <table> TO authenticated;
GRANT ALL ON <table> TO postgres;
GRANT ALL ON <table> TO service_role;
```

Expanded, "ALL" is: `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN`.

There are no column-level grants, no per-table exceptions, and no revocations. Because
this is uniform, the per-table sections below say "standard grant set" rather than
repeating it 19 times.

---

## Tables

---

### `agencies`

Regulator directory, looked up by jurisdiction and agency type. Not company-scoped —
shared reference data.

**Rows:** 0 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| jurisdiction | text | NOT NULL | — |
| agency_type | text | NOT NULL | — |
| name | text | NOT NULL | — |
| phone | text | NULL | — |
| address | text | NULL | — |
| url | text | NULL | — |
| created_at | timestamptz | NULL | `now()` |
| updated_at | timestamptz | NULL | `now()` |

**Primary key:** `agencies_pkey` — `PRIMARY KEY (id)`

**Foreign keys:** none

**Indexes**
- `agencies_pkey` — `CREATE UNIQUE INDEX agencies_pkey ON public.agencies USING btree (id)`
- `idx_agencies_lookup` — `CREATE INDEX idx_agencies_lookup ON public.agencies USING btree (jurisdiction, agency_type)`

**CHECK / UNIQUE constraints:** none

**RLS policies**

`agencies readable by authenticated users` — PERMISSIVE, role `authenticated`, `SELECT`
- `USING (true)`
- `WITH CHECK` — n/a

No INSERT, UPDATE or DELETE policy.

**Grants:** standard grant set.

---

### `audits`

Saved audit runs against a standard or an uploaded company template.

**Rows:** 6 · **RLS:** enabled (not forced) — **no policies, so all access is denied to
`anon` and `authenticated`**

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| company_id | uuid | NOT NULL | — |
| user_id | uuid | NOT NULL | — |
| source_type | text | NOT NULL | — |
| source_name | text | NOT NULL | — |
| standard_template_id | uuid | NULL | — |
| company_template_id | uuid | NULL | — |
| uploaded_file_url | text | NULL | — |
| line_items | jsonb | NOT NULL | `'[]'::jsonb` |
| readiness_satisfied | integer | NOT NULL | `0` |
| readiness_needs_info | integer | NOT NULL | `0` |
| readiness_needs_work | integer | NOT NULL | `0` |
| created_at | timestamptz | NOT NULL | `now()` |

**Primary key:** `audits_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `audits_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `audits_company_template_id_fkey` | `FOREIGN KEY (company_template_id) REFERENCES company_templates(id)` — no ON DELETE (NO ACTION) |
| `audits_standard_template_id_fkey` | `FOREIGN KEY (standard_template_id) REFERENCES standard_templates(id)` — no ON DELETE (NO ACTION) |

`user_id` is a plain uuid with **no** foreign key to `auth.users`.

**Indexes**
- `audits_pkey` — `CREATE UNIQUE INDEX audits_pkey ON public.audits USING btree (id)`

**CHECK / UNIQUE constraints:** none

**RLS policies:** none.

**Grants:** standard grant set.

---

### `calendar_events`

Compliance due dates and recurring events.

**Rows:** 47 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| company_id | uuid | NULL | — |
| user_id | uuid | NULL | — |
| title | text | NOT NULL | — |
| description | text | NULL | — |
| due_date | date | NOT NULL | — |
| category | text | NULL | — |
| is_recurring | boolean | NULL | `false` |
| recurrence_period | text | NULL | — |
| completed | boolean | NULL | `false` |
| completed_at | timestamptz | NULL | — |
| created_at | timestamptz | NULL | `timezone('utc'::text, now())` |

**Primary key:** `calendar_events_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `calendar_events_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `calendar_events_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` |

**Indexes**
- `calendar_events_pkey` — `CREATE UNIQUE INDEX calendar_events_pkey ON public.calendar_events USING btree (id)`

**CHECK / UNIQUE constraints:** none

**RLS policies** — all PERMISSIVE, role `authenticated`. Scoped by **user**, not company.

`Users can view own events` — `SELECT`
- `USING (auth.uid() = user_id)`

`Users can insert own events` — `INSERT`
- `WITH CHECK (auth.uid() = user_id)`

`Users can update own events` — `UPDATE`
- `USING (auth.uid() = user_id)`
- `WITH CHECK` — none

`Users can delete own events` — `DELETE`
- `USING (auth.uid() = user_id)`

**Grants:** standard grant set.

---

### `checklist_items`

Line items belonging to a checklist.

**Rows:** 235 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| checklist_id | uuid | NULL | — |
| category | text | NOT NULL | — |
| name | text | NOT NULL | — |
| description | text | NULL | — |
| why | text | NULL | — |
| required_by | text | NULL | — |
| recommended_by | text | NULL | — |
| source_url | text | NULL | — |
| cost_note | text | NULL | — |
| providers | jsonb | NULL | `'[]'::jsonb` |
| completed | boolean | NULL | `false` |
| completed_at | timestamptz | NULL | — |
| sort_order | integer | NULL | `0` |
| parent_item_index | integer | NULL | — |
| time_estimate | text | NULL | — |
| what_you_need | text | NULL | — |
| is_determination | boolean | NULL | `false` |
| clarifying_questions | jsonb | NULL | `'[]'::jsonb` |
| agency_name | text | NULL | — |
| search_hint | text | NULL | — |
| pre_completed | boolean | NULL | `false` |
| source | text | NULL | — |

**Primary key:** `checklist_items_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `checklist_items_checklist_id_fkey` | `FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE` |

**Indexes**
- `checklist_items_pkey` — `CREATE UNIQUE INDEX checklist_items_pkey ON public.checklist_items USING btree (id)`

`checklist_id` is not indexed.

**CHECK / UNIQUE constraints:** none

**RLS policies** — all PERMISSIVE, role `authenticated`, all using the same subquery
through the parent checklist's `user_id`.

`Users can view own checklist items` — `SELECT`
- `USING (checklist_id IN ( SELECT checklists.id FROM checklists WHERE (checklists.user_id = auth.uid())))`

`Users can insert own checklist items` — `INSERT`
- `WITH CHECK (checklist_id IN ( SELECT checklists.id FROM checklists WHERE (checklists.user_id = auth.uid())))`

`Users can update own checklist items` — `UPDATE`
- `USING (checklist_id IN ( SELECT checklists.id FROM checklists WHERE (checklists.user_id = auth.uid())))`
- `WITH CHECK` — none

`Users can delete own checklist items` — `DELETE`
- `USING (checklist_id IN ( SELECT checklists.id FROM checklists WHERE (checklists.user_id = auth.uid())))`

**Grants:** standard grant set.

---

### `checklists`

A generated checklist, or — when `research_answer` is set — a saved research answer.

**Rows:** 11 · **RLS:** enabled (not forced)

| Column | Type | Null | Default | Comment |
|---|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` | |
| company_id | uuid | NULL | — | |
| user_id | uuid | NULL | — | |
| question | text | NOT NULL | — | |
| title | text | NOT NULL | — | |
| safety_alert | text | NULL | — | |
| created_at | timestamptz | NULL | `timezone('utc'::text, now())` | |
| research_answer | text | NULL | — | If set, this row is a saved research answer, not a checklist. |
| converted_to_checklist_id | uuid | NULL | — | If set, points to the checklist this research answer was converted into. |

**Primary key:** `checklists_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `checklists_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `checklists_converted_to_checklist_id_fkey` | `FOREIGN KEY (converted_to_checklist_id) REFERENCES checklists(id)` — self-reference, no ON DELETE (NO ACTION) |
| `checklists_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` |

**Indexes**
- `checklists_pkey` — `CREATE UNIQUE INDEX checklists_pkey ON public.checklists USING btree (id)`

**CHECK / UNIQUE constraints:** none

**RLS policies** — all PERMISSIVE, role `authenticated`. Scoped by **user**, not company.

`Users can view own checklists` — `SELECT`
- `USING (auth.uid() = user_id)`

`Users can insert own checklists` — `INSERT`
- `WITH CHECK (auth.uid() = user_id)`

`Users can delete own checklists` — `DELETE`
- `USING (auth.uid() = user_id)`

No UPDATE policy.

**Grants:** standard grant set.

---

### `companies`

The tenant root. One row per customer company.

**Rows:** 10 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| name | text | NOT NULL | — |
| industry | text | NULL | — |
| state | text | NULL | — |
| county | text | NULL | — |
| city | text | NULL | — |
| employee_count | text | NULL | — |
| chemicals | text | NULL | — |
| extra_profile | jsonb | NULL | `'{}'::jsonb` |
| created_at | timestamptz | NULL | `timezone('utc'::text, now())` |
| website_url | text | NULL | — |
| scan_result | jsonb | NULL | — |
| pre_completed_items | jsonb | NULL | — |

`employee_count` is `text`, not a numeric type.

**Primary key:** `companies_pkey` — `PRIMARY KEY (id)`

**Foreign keys:** none

**Indexes**
- `companies_pkey` — `CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id)`

**CHECK / UNIQUE constraints:** none

**RLS policies** — all PERMISSIVE, role `authenticated`.

`Users can view own company` — `SELECT`
- `USING (id IN ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid())))`

`Users can insert company` — `INSERT`
- `WITH CHECK (true)` — any authenticated user may create any company row.

`Users can update own company` — `UPDATE`
- `USING (id IN ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid())))`
- `WITH CHECK` — none

No DELETE policy.

**Grants:** standard grant set.

---

### `company_folders`

Folder tree for company documents. Self-referencing via `parent_id`. `section`
separates the trees (default `'files'`).

**Rows:** 85 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| company_id | uuid | NULL | — |
| name | text | NOT NULL | — |
| parent_id | uuid | NULL | — |
| sort_order | integer | NULL | `0` |
| created_at | timestamptz | NULL | `now()` |
| section | text | NOT NULL | `'files'::text` |

**Primary key:** `company_folders_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `company_folders_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `company_folders_parent_id_fkey` | `FOREIGN KEY (parent_id) REFERENCES company_folders(id) ON DELETE CASCADE` |

**Indexes**
- `company_folders_pkey` — `CREATE UNIQUE INDEX company_folders_pkey ON public.company_folders USING btree (id)`

**CHECK / UNIQUE constraints:** none. Nothing constrains `section` to a known set, and
nothing prevents two sibling folders sharing a name.

**RLS policies**

`Users can manage their company folders` — PERMISSIVE, role `authenticated`, `ALL`
- `USING (company_id IN ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid())))`
- `WITH CHECK` — not specified; for an `ALL` policy Postgres reuses the `USING`
  expression as the check, so inserts and updates are constrained by the same predicate.

**Grants:** standard grant set.

---

### `company_templates`

A company's own uploaded audit template, versioned by `version` + `is_active`.

**Rows:** 0 · **RLS:** enabled (not forced) — **no policies, so all access is denied to
`anon` and `authenticated`**

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| company_id | uuid | NOT NULL | — |
| source_name | text | NOT NULL | — |
| uploaded_file_url | text | NULL | — |
| line_items | jsonb | NOT NULL | `'[]'::jsonb` |
| version | integer | NOT NULL | `1` |
| is_active | boolean | NOT NULL | `true` |
| created_at | timestamptz | NOT NULL | `now()` |

**Primary key:** `company_templates_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `company_templates_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |

**Indexes**
- `company_templates_pkey` — `CREATE UNIQUE INDEX company_templates_pkey ON public.company_templates USING btree (id)`

**CHECK / UNIQUE constraints:** none. Nothing enforces one active version per
`(company_id, source_name)`.

**RLS policies:** none.

**Grants:** standard grant set.

---

### `corrections`

> Table comment: *"User-reported fixes to any requirement or obligation. The learning loop."*

**Rows:** 0 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| requirement_template_id | uuid | NULL | — |
| obligation_id | uuid | NULL | — |
| company_id | uuid | NULL | — |
| reported_by | uuid | NULL | — |
| correction_text | text | NOT NULL | — |
| status | text | NULL | `'pending'::text` |
| created_at | timestamptz | NULL | `now()` |

**Primary key:** `corrections_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `corrections_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL` |
| `corrections_obligation_id_fkey` | `FOREIGN KEY (obligation_id) REFERENCES obligations(id) ON DELETE CASCADE` |
| `corrections_reported_by_fkey` | `FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE SET NULL` |
| `corrections_requirement_template_id_fkey` | `FOREIGN KEY (requirement_template_id) REFERENCES requirement_templates(id) ON DELETE CASCADE` |

**Indexes**
- `corrections_pkey` — `CREATE UNIQUE INDEX corrections_pkey ON public.corrections USING btree (id)`

**CHECK / UNIQUE constraints:** none. `status` is unconstrained text.

**RLS policies**

`corrections scoped to own company` — PERMISSIVE, role `authenticated`, `SELECT`
- `USING (company_id IN ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid())))`

No INSERT, UPDATE or DELETE policy — a user cannot currently file a correction through
an ordinary session.

**Grants:** standard grant set.

---

### `document_reviews`

Result of an AI review of one document: dates, coverage, gaps, action items.

**Rows:** 33 · **RLS:** enabled (not forced) — **no policies, so all access is denied to
`anon` and `authenticated`**

| Column | Type | Null | Default | Comment |
|---|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` | |
| company_id | uuid | NULL | — | |
| user_id | uuid | NULL | — | |
| document_id | uuid | NULL | — | |
| document_name | text | NOT NULL | — | |
| folder_id | uuid | NULL | — | |
| folder_name | text | NULL | — | |
| division_name | text | NULL | — | |
| document_type | text | NULL | — | |
| issued_by | text | NULL | — | |
| issue_date | date | NULL | — | |
| expiry_date | date | NULL | — | |
| renewal_date | date | NULL | — | |
| is_current | boolean | NULL | — | |
| expiring_soon | boolean | NULL | — | |
| days_until_expiry | integer | NULL | — | |
| coverage | text | NULL | — | |
| gaps | jsonb | NULL | `'[]'::jsonb` | |
| action_items | jsonb | NULL | `'[]'::jsonb` | |
| summary | text | NULL | — | |
| created_at | timestamptz | NULL | `now()` | |
| regulation_reference | text | NULL | — | The specific standard/regulation this document was checked against. |
| gap_fixes | jsonb | NULL | `'[]'::jsonb` | Array of {gap, fix} pairs — each identified gap paired with a concrete correction. |

**Primary key:** `document_reviews_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `document_reviews_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `document_reviews_document_id_fkey` | `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE` |

`folder_id` has **no** foreign key to `company_folders`, and `user_id` has none to
`auth.users`.

**Indexes**
- `document_reviews_pkey` — `CREATE UNIQUE INDEX document_reviews_pkey ON public.document_reviews USING btree (id)`

**CHECK / UNIQUE constraints:** none

**RLS policies:** none.

**Grants:** standard grant set.

---

### `documents`

Uploaded company files. `file_url` points into the `company-documents` storage bucket.

**Rows:** 38 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| company_id | uuid | NULL | — |
| user_id | uuid | NULL | — |
| name | text | NOT NULL | — |
| file_url | text | NOT NULL | — |
| file_type | text | NOT NULL | — |
| file_size | bigint | NULL | — |
| is_recurring | boolean | NULL | `false` |
| recurrence_period | text | NULL | — |
| uploaded_at | timestamptz | NULL | `timezone('utc'::text, now())` |
| folder_id | uuid | NULL | — |

**Primary key:** `documents_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `documents_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `documents_folder_id_fkey` | `FOREIGN KEY (folder_id) REFERENCES company_folders(id) ON DELETE SET NULL` |
| `documents_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` |

**Indexes**
- `documents_pkey` — `CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id)`

Neither `company_id` nor `folder_id` is indexed, though both are queried on every
folder listing.

**CHECK / UNIQUE constraints:** none

**RLS policies** — all PERMISSIVE, role `authenticated`. Scoped by **user**, not company.

`Users can view own documents` — `SELECT`
- `USING (auth.uid() = user_id)`

`Users can insert own documents` — `INSERT`
- `WITH CHECK (auth.uid() = user_id)`

`Users can delete own documents` — `DELETE`
- `USING (auth.uid() = user_id)`

No UPDATE policy, so moving a document between folders cannot be done through an
ordinary session.

**Grants:** standard grant set.

---

### `entities`

> Table comment: *"People, chemicals, equipment, and sites belonging to a company — each can carry its own obligations."*

**Rows:** 0 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| company_id | uuid | NOT NULL | — |
| entity_type | text | NOT NULL | — |
| name | text | NOT NULL | — |
| parent_entity_id | uuid | NULL | — |
| details | jsonb | NULL | `'{}'::jsonb` |
| created_at | timestamptz | NULL | `now()` |
| updated_at | timestamptz | NULL | `now()` |

**Primary key:** `entities_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `entities_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `entities_parent_entity_id_fkey` | `FOREIGN KEY (parent_entity_id) REFERENCES entities(id) ON DELETE SET NULL` |

**Indexes**
- `entities_pkey` — `CREATE UNIQUE INDEX entities_pkey ON public.entities USING btree (id)`
- `idx_entities_company` — `CREATE INDEX idx_entities_company ON public.entities USING btree (company_id)`

**CHECK / UNIQUE constraints:** none. `entity_type` is unconstrained text.

**RLS policies**

`entities scoped to own company` — PERMISSIVE, role `authenticated`, `SELECT`
- `USING (company_id IN ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid())))`

No INSERT, UPDATE or DELETE policy.

**Grants:** standard grant set.

---

### `folder_audits`

Saved result of auditing a whole folder against an industry.

**Rows:** 1 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| company_id | uuid | NULL | — |
| user_id | uuid | NULL | — |
| folder_id | uuid | NULL | — |
| folder_name | text | NOT NULL | — |
| industry | text | NOT NULL | — |
| file_names | text[] | NOT NULL | — |
| result_json | jsonb | NOT NULL | — |
| created_at | timestamptz | NULL | `now()` |
| parent_folder_name | text | NULL | — |

**Primary key:** `folder_audits_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `folder_audits_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `folder_audits_folder_id_fkey` | `FOREIGN KEY (folder_id) REFERENCES company_folders(id) ON DELETE CASCADE` |
| `folder_audits_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` |

**Indexes**
- `folder_audits_pkey` — `CREATE UNIQUE INDEX folder_audits_pkey ON public.folder_audits USING btree (id)`

**CHECK / UNIQUE constraints:** none

**RLS policies** — all PERMISSIVE, granted to role **`public`** (not `authenticated`),
scoped by user.

`Users can view own folder audits` — `SELECT`
- `USING (user_id = auth.uid())`

`Users can insert own folder audits` — `INSERT`
- `WITH CHECK (user_id = auth.uid())`

`Users can delete own folder audits` — `DELETE`
- `USING (user_id = auth.uid())`

No UPDATE policy. These are the only policies in the database granted to `public`
rather than `authenticated`; the effect is the same here because `auth.uid()` is null
for an anonymous request and `user_id = null` never matches.

**Grants:** standard grant set.

---

### `hr_audits`

> Table comment: *"Saved HR handbook audit results, one row per audit run."*

**Rows:** 1 · **RLS:** enabled (not forced) — **no policies, so all access is denied to
`anon` and `authenticated`**

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| company_id | uuid | NOT NULL | — |
| user_id | uuid | NOT NULL | — |
| handbook_name | text | NOT NULL | — |
| handbook_file_url | text | NOT NULL | — |
| present | jsonb | NOT NULL | `'[]'::jsonb` |
| missing | jsonb | NOT NULL | `'[]'::jsonb` |
| draft_policies | jsonb | NOT NULL | `'[]'::jsonb` |
| created_at | timestamptz | NOT NULL | `now()` |

**Primary key:** `hr_audits_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `hr_audits_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id)` — **no ON DELETE action** (NO ACTION); deleting a company with hr_audits rows will fail |

`user_id` has no foreign key to `auth.users`.

**Indexes**
- `hr_audits_pkey` — `CREATE UNIQUE INDEX hr_audits_pkey ON public.hr_audits USING btree (id)`

**CHECK / UNIQUE constraints:** none

**RLS policies:** none.

**Grants:** standard grant set.

---

### `obligation_evidence`

> Table comment: *"Many-to-many: one obligation can have several proofs, one document can satisfy several obligations."*

**Rows:** 0 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| obligation_id | uuid | NOT NULL | — |
| document_id | uuid | NOT NULL | — |
| added_at | timestamptz | NULL | `now()` |
| added_by | uuid | NULL | — |

**Primary key:** `obligation_evidence_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `obligation_evidence_added_by_fkey` | `FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL` |
| `obligation_evidence_document_id_fkey` | `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE` |
| `obligation_evidence_obligation_id_fkey` | `FOREIGN KEY (obligation_id) REFERENCES obligations(id) ON DELETE CASCADE` |

**Indexes**
- `obligation_evidence_pkey` — `CREATE UNIQUE INDEX obligation_evidence_pkey ON public.obligation_evidence USING btree (id)`
- `idx_obligation_evidence_document` — `CREATE INDEX idx_obligation_evidence_document ON public.obligation_evidence USING btree (document_id)`
- `idx_obligation_evidence_obligation` — `CREATE INDEX idx_obligation_evidence_obligation ON public.obligation_evidence USING btree (obligation_id)`

**CHECK / UNIQUE constraints:** none. There is no unique constraint on
`(obligation_id, document_id)`, so the same document can be linked to the same
obligation more than once.

**RLS policies**

`obligation_evidence scoped to own company` — PERMISSIVE, role `authenticated`, `SELECT`
- `USING (obligation_id IN ( SELECT obligations.id FROM obligations WHERE (obligations.company_id IN ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid())))))`

No INSERT, UPDATE or DELETE policy — evidence cannot be linked through an ordinary session.

**Grants:** standard grant set.

---

### `obligations`

> Table comment: *"THE SPINE. What is missing = a query on this table, not an AI guess."*

**Rows:** 376 · **RLS:** enabled (not forced)

| Column | Type | Null | Default | Comment |
|---|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` | |
| company_id | uuid | NOT NULL | — | |
| entity_id | uuid | NULL | — | |
| requirement_template_id | uuid | NOT NULL | — | |
| status | text | NOT NULL | `'missing'::text` | |
| due_date | date | NULL | — | |
| last_verified_at | timestamptz | NULL | — | |
| notes | text | NULL | — | |
| created_at | timestamptz | NULL | `now()` | |
| updated_at | timestamptz | NULL | `now()` | |
| resolved_by | text | NULL | `'ai_inferred'::text` | ai_inferred \| user_confirmed \| evidence_linked — how this status was decided. ai_inferred is always provisional and revisable. |
| resolution_rationale | text | NULL | — | Short audit trail for AI-inferred decisions, e.g. "applies=yes from scan_result.hazmat_drivers=true". Never populated for user_confirmed/evidence_linked. |

**Primary key:** `obligations_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `obligations_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` |
| `obligations_entity_id_fkey` | `FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE` |
| `obligations_requirement_template_id_fkey` | `FOREIGN KEY (requirement_template_id) REFERENCES requirement_templates(id) ON DELETE RESTRICT` |

`ON DELETE RESTRICT` on the template reference is what stops a library row being deleted
out from under an obligation that cites it.

**Indexes**
- `obligations_pkey` — `CREATE UNIQUE INDEX obligations_pkey ON public.obligations USING btree (id)`
- `idx_obligations_company` — `CREATE INDEX idx_obligations_company ON public.obligations USING btree (company_id)`
- `idx_obligations_entity` — `CREATE INDEX idx_obligations_entity ON public.obligations USING btree (entity_id)`
- `idx_obligations_template` — `CREATE INDEX idx_obligations_template ON public.obligations USING btree (requirement_template_id)`

**CHECK / UNIQUE constraints:** none.

Neither `status` nor `resolved_by` is constrained to its documented value set — the
allowed values live only in the column comments and in application code. There is also
no unique constraint on `(company_id, entity_id, requirement_template_id)`, so the same
requirement can be instantiated for the same company more than once.

**RLS policies**

`obligations scoped to own company` — PERMISSIVE, role `authenticated`, `SELECT`
- `USING (company_id IN ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid())))`

No INSERT, UPDATE or DELETE policy.

**Grants:** standard grant set.

---

### `profiles`

Links an `auth.users` row to a company. This is the tenancy join every company-scoped
RLS policy goes through.

**Rows:** 4 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | — (supplied from `auth.users.id`) |
| company_id | uuid | NULL | — |
| full_name | text | NULL | — |
| created_at | timestamptz | NULL | `timezone('utc'::text, now())` |

**Primary key:** `profiles_pkey` — `PRIMARY KEY (id)`

**Foreign keys**

| Constraint | Definition |
|---|---|
| `profiles_company_id_fkey` | `FOREIGN KEY (company_id) REFERENCES companies(id)` — **no ON DELETE action** (NO ACTION) |
| `profiles_id_fkey` | `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE` |

**Indexes**
- `profiles_pkey` — `CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)`

`company_id` is not indexed, although every company-scoped policy in the database
subqueries this table.

**CHECK / UNIQUE constraints:** none

**RLS policies** — all PERMISSIVE, role `authenticated`.

`Users can view own profile` — `SELECT`
- `USING (auth.uid() = id)`

`Users can insert own profile` — `INSERT`
- `WITH CHECK (auth.uid() = id)`

`Users can update own profile` — `UPDATE`
- `USING (auth.uid() = id)`
- `WITH CHECK` — none. With no check expression, a user can update their own row and
  set `company_id` to any company, which changes what every other policy grants them.

No DELETE policy.

**Grants:** standard grant set.

---

### `requirement_templates`

> Table comment: *"Master requirements list, per industry x jurisdiction. Cached and shared across all companies in that combo."*

**Rows:** 188 · **RLS:** enabled (not forced)

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| industry | text | NOT NULL | — |
| jurisdiction_state | text | NULL | — |
| jurisdiction_county | text | NULL | — |
| layer | text | NOT NULL | `'federal'::text` |
| category | text | NULL | — |
| requirement_name | text | NOT NULL | — |
| citation | text | NULL | — |
| cadence | text | NULL | — |
| applies | text | NOT NULL | `'universal'::text` |
| trigger_condition | text | NULL | — |
| trigger_plain | text | NULL | — |
| entity_type | text | NOT NULL | `'organization'::text` |
| evidence_description | text | NULL | — |
| fails_if | text | NULL | — |
| priority | text | NULL | `'high'::text` |
| status | text | NULL | `'generated'::text` |
| is_determination | boolean | NULL | `false` |
| source | text | NULL | — |
| created_at | timestamptz | NULL | `now()` |
| updated_at | timestamptz | NULL | `now()` |

`industry` is a single `text` column, not an array — one row serves one industry.

There are no `effective_from` / `effective_to` columns and no version column, so library
rows are currently edited in place rather than versioned.

**Primary key:** `requirement_templates_pkey` — `PRIMARY KEY (id)`

**Foreign keys:** none

**Indexes**
- `requirement_templates_pkey` — `CREATE UNIQUE INDEX requirement_templates_pkey ON public.requirement_templates USING btree (id)`
- `idx_requirement_templates_industry` — `CREATE INDEX idx_requirement_templates_industry ON public.requirement_templates USING btree (industry, jurisdiction_state, jurisdiction_county)`

**CHECK / UNIQUE constraints:** none. `layer`, `applies`, `entity_type`, `priority` and
`status` are all unconstrained text with defaults.

**RLS policies**

`requirement_templates readable by authenticated users` — PERMISSIVE, role `authenticated`, `SELECT`
- `USING (true)` — the library is readable by every authenticated user regardless of company.

No INSERT, UPDATE or DELETE policy.

**Grants:** standard grant set.

---

### `standard_templates`

> Table comment: *"Reusable, shared parsed checklist per named standard. Built once, reused by every company auditing against that standard."*

**Rows:** 1 · **RLS:** enabled (not forced) — **no policies, so all access is denied to
`anon` and `authenticated`**

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| standard_name | text | NOT NULL | — |
| source | text | NOT NULL | `'ai_generated'::text` |
| line_items | jsonb | NOT NULL | `'[]'::jsonb` |
| created_at | timestamptz | NOT NULL | `now()` |
| updated_at | timestamptz | NOT NULL | `now()` |

**Primary key:** `standard_templates_pkey` — `PRIMARY KEY (id)`

**Foreign keys:** none

**Indexes**
- `standard_templates_pkey` — `CREATE UNIQUE INDEX standard_templates_pkey ON public.standard_templates USING btree (id)`
- `standard_templates_standard_name_key` — `CREATE UNIQUE INDEX standard_templates_standard_name_key ON public.standard_templates USING btree (standard_name)`

**CHECK / UNIQUE constraints**
- `standard_templates_standard_name_key` — `UNIQUE (standard_name)`

This is the only UNIQUE constraint in the entire database.

**RLS policies:** none.

**Grants:** standard grant set.

---

## Storage

### Buckets

| Bucket | Public | Type | File size limit | Allowed MIME types | Created |
|---|---|---|---|---|---|
| `company-documents` | **false** (private) | STANDARD | none | any | 2026-06-03 |

One bucket. It holds **52 objects**, all at a path depth of exactly three segments,
across 7 distinct first path segments.

There is no file size limit and no MIME type restriction configured at the bucket level.

### Policies on `storage.objects`

RLS is enabled on `storage.objects` (and on every other table in the `storage` schema:
`buckets`, `buckets_analytics`, `buckets_vectors`, `migrations`, `s3_multipart_uploads`,
`s3_multipart_uploads_parts`, `vector_indexes`).

Three policies exist, all PERMISSIVE and all granted to `authenticated`:

`Users can view own files` — `SELECT`
- `USING (bucket_id = 'company-documents'::text)`

`Users can upload to own folder` — `INSERT`
- `WITH CHECK (bucket_id = 'company-documents'::text)`

`Users can delete own files` — `DELETE`
- `USING (bucket_id = 'company-documents'::text)`

**These expressions do not scope by user or by company.** The names describe an
ownership check that the predicates do not perform — the only condition tested is which
bucket the object is in. Any authenticated user of the application can read, and delete,
every file in `company-documents`, including files belonging to other companies. There
is no UPDATE policy.

No policies exist on any other `storage` table, so those are deny-all outside the
service role.

### Buckets not present

There are no other buckets — no separate bucket for uploaded audit templates or HR
handbooks, so `company_templates.uploaded_file_url` and `hr_audits.handbook_file_url`
either point into `company-documents` or are unused (both tables' file columns are
nullable, and `company_templates` is empty).

---

*End of snapshot. Captured read-only; no database object was modified.*
