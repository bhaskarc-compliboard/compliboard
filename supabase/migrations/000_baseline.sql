-- ============================================================
-- COMPLIBOARD — MIGRATION 000: PRODUCTION BASELINE
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Production was built incrementally, partly through the dashboard, and only six
-- of its nineteen tables were ever captured in a migration file (001_step3_spine).
-- Staging, meanwhile, is an empty project: no tables, no buckets, no migration
-- history. The result is that CLAUDE.md §3.8 — test a migration on staging before
-- production — could not actually be carried out, because there was nothing on
-- staging for a migration to apply against.
--
-- This file is the missing starting point: the structure of production's public
-- schema as it stood on 2026-09-09, so that staging can be brought to the same
-- shape and every later migration replays identically on both.
--
-- HOW IT WAS PRODUCED
--
-- Not with `supabase db dump` — that runs pg_dump inside Docker, and this machine
-- has neither Docker nor a local pg_dump. It was reconstructed instead by reading
-- production's system catalogs over the Management API (`supabase db query`),
-- read-only, and emitting DDL from what they returned: pg_attribute for columns,
-- pg_constraint for keys, pg_indexes for indexes, pg_policies for RLS, and
-- pg_class/pg_attribute comments. It is equivalent in content to a schema-only
-- pg_dump of `public`, but it is generated code and deserves a read before it runs.
--
-- STRUCTURE ONLY. There is not a single INSERT in this file and no row of customer
-- data. Sections, in dependency order:
--   1. Tables (columns, types, defaults, NOT NULL)
--   2. Primary key and unique constraints
--   3. Foreign keys
--   4. Indexes
--   5. Row Level Security — enable, then policies
--   6. Grants
--   7. Comments
--
-- WHAT IS DELIBERATELY NOT HERE — read before applying:
--
--   * The `storage` schema's own tables (storage.buckets, storage.objects and the
--     rest) are created and owned by Supabase. Every project, staging included,
--     already has them, so recreating them here would fail and is not wanted. What
--     IS included, at the end of section 5, are the three policies production has
--     on storage.objects — reproduced exactly as they exist today, unscoped and
--     wrong, because a baseline records what is, not what ought to be. Migration
--     002 is what replaces them.
--   * The `company-documents` bucket itself is a ROW in storage.buckets, i.e. data,
--     not structure. It is therefore not in this file. Staging has no bucket, so
--     one must be created there before storage policies can be tested against
--     anything. Flagged rather than smuggled in as an INSERT.
--   * auth.users is referenced by several foreign keys below. That table belongs to
--     Supabase Auth and already exists on every project; it is referenced, never
--     created.
--   * No functions, triggers, sequences, enums, domains or views appear here
--     because production has none in public.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------

create table if not exists public.agencies (
  id uuid default gen_random_uuid() not null,
  jurisdiction text not null,
  agency_type text not null,
  name text not null,
  phone text,
  address text,
  url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.audits (
  id uuid default gen_random_uuid() not null,
  company_id uuid not null,
  user_id uuid not null,
  source_type text not null,
  source_name text not null,
  standard_template_id uuid,
  company_template_id uuid,
  uploaded_file_url text,
  line_items jsonb default '[]'::jsonb not null,
  readiness_satisfied integer default 0 not null,
  readiness_needs_info integer default 0 not null,
  readiness_needs_work integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.calendar_events (
  id uuid default gen_random_uuid() not null,
  company_id uuid,
  user_id uuid,
  title text not null,
  description text,
  due_date date not null,
  category text,
  is_recurring boolean default false,
  recurrence_period text,
  completed boolean default false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.checklist_items (
  id uuid default gen_random_uuid() not null,
  checklist_id uuid,
  category text not null,
  name text not null,
  description text,
  why text,
  required_by text,
  recommended_by text,
  source_url text,
  cost_note text,
  providers jsonb default '[]'::jsonb,
  completed boolean default false,
  completed_at timestamp with time zone,
  sort_order integer default 0,
  parent_item_index integer,
  time_estimate text,
  what_you_need text,
  is_determination boolean default false,
  clarifying_questions jsonb default '[]'::jsonb,
  agency_name text,
  search_hint text,
  pre_completed boolean default false,
  source text
);

create table if not exists public.checklists (
  id uuid default gen_random_uuid() not null,
  company_id uuid,
  user_id uuid,
  question text not null,
  title text not null,
  safety_alert text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  research_answer text,
  converted_to_checklist_id uuid
);

create table if not exists public.companies (
  id uuid default gen_random_uuid() not null,
  name text not null,
  industry text,
  state text,
  county text,
  city text,
  employee_count text,
  chemicals text,
  extra_profile jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  website_url text,
  scan_result jsonb,
  pre_completed_items jsonb
);

create table if not exists public.company_folders (
  id uuid default gen_random_uuid() not null,
  company_id uuid,
  name text not null,
  parent_id uuid,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  section text default 'files'::text not null
);

create table if not exists public.company_templates (
  id uuid default gen_random_uuid() not null,
  company_id uuid not null,
  source_name text not null,
  uploaded_file_url text,
  line_items jsonb default '[]'::jsonb not null,
  version integer default 1 not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.corrections (
  id uuid default gen_random_uuid() not null,
  requirement_template_id uuid,
  obligation_id uuid,
  company_id uuid,
  reported_by uuid,
  correction_text text not null,
  status text default 'pending'::text,
  created_at timestamp with time zone default now()
);

create table if not exists public.document_reviews (
  id uuid default gen_random_uuid() not null,
  company_id uuid,
  user_id uuid,
  document_id uuid,
  document_name text not null,
  folder_id uuid,
  folder_name text,
  division_name text,
  document_type text,
  issued_by text,
  issue_date date,
  expiry_date date,
  renewal_date date,
  is_current boolean,
  expiring_soon boolean,
  days_until_expiry integer,
  coverage text,
  gaps jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  summary text,
  created_at timestamp with time zone default now(),
  regulation_reference text,
  gap_fixes jsonb default '[]'::jsonb
);

create table if not exists public.documents (
  id uuid default gen_random_uuid() not null,
  company_id uuid,
  user_id uuid,
  name text not null,
  file_url text not null,
  file_type text not null,
  file_size bigint,
  is_recurring boolean default false,
  recurrence_period text,
  uploaded_at timestamp with time zone default timezone('utc'::text, now()),
  folder_id uuid
);

create table if not exists public.entities (
  id uuid default gen_random_uuid() not null,
  company_id uuid not null,
  entity_type text not null,
  name text not null,
  parent_entity_id uuid,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.folder_audits (
  id uuid default gen_random_uuid() not null,
  company_id uuid,
  user_id uuid,
  folder_id uuid,
  folder_name text not null,
  industry text not null,
  file_names text[] not null,
  result_json jsonb not null,
  created_at timestamp with time zone default now(),
  parent_folder_name text
);

create table if not exists public.hr_audits (
  id uuid default gen_random_uuid() not null,
  company_id uuid not null,
  user_id uuid not null,
  handbook_name text not null,
  handbook_file_url text not null,
  present jsonb default '[]'::jsonb not null,
  missing jsonb default '[]'::jsonb not null,
  draft_policies jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.obligation_evidence (
  id uuid default gen_random_uuid() not null,
  obligation_id uuid not null,
  document_id uuid not null,
  added_at timestamp with time zone default now(),
  added_by uuid
);

create table if not exists public.obligations (
  id uuid default gen_random_uuid() not null,
  company_id uuid not null,
  entity_id uuid,
  requirement_template_id uuid not null,
  status text default 'missing'::text not null,
  due_date date,
  last_verified_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  resolved_by text default 'ai_inferred'::text,
  resolution_rationale text
);

create table if not exists public.profiles (
  id uuid not null,
  company_id uuid,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.requirement_templates (
  id uuid default gen_random_uuid() not null,
  industry text not null,
  jurisdiction_state text,
  jurisdiction_county text,
  layer text default 'federal'::text not null,
  category text,
  requirement_name text not null,
  citation text,
  cadence text,
  applies text default 'universal'::text not null,
  trigger_condition text,
  trigger_plain text,
  entity_type text default 'organization'::text not null,
  evidence_description text,
  fails_if text,
  priority text default 'high'::text,
  status text default 'generated'::text,
  is_determination boolean default false,
  source text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.standard_templates (
  id uuid default gen_random_uuid() not null,
  standard_name text not null,
  source text default 'ai_generated'::text not null,
  line_items jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- ------------------------------------------------------------
-- 2. PRIMARY KEY AND UNIQUE CONSTRAINTS
-- ------------------------------------------------------------

alter table public.agencies add constraint agencies_pkey PRIMARY KEY (id);
alter table public.audits add constraint audits_pkey PRIMARY KEY (id);
alter table public.calendar_events add constraint calendar_events_pkey PRIMARY KEY (id);
alter table public.checklist_items add constraint checklist_items_pkey PRIMARY KEY (id);
alter table public.checklists add constraint checklists_pkey PRIMARY KEY (id);
alter table public.companies add constraint companies_pkey PRIMARY KEY (id);
alter table public.company_folders add constraint company_folders_pkey PRIMARY KEY (id);
alter table public.company_templates add constraint company_templates_pkey PRIMARY KEY (id);
alter table public.corrections add constraint corrections_pkey PRIMARY KEY (id);
alter table public.document_reviews add constraint document_reviews_pkey PRIMARY KEY (id);
alter table public.documents add constraint documents_pkey PRIMARY KEY (id);
alter table public.entities add constraint entities_pkey PRIMARY KEY (id);
alter table public.folder_audits add constraint folder_audits_pkey PRIMARY KEY (id);
alter table public.hr_audits add constraint hr_audits_pkey PRIMARY KEY (id);
alter table public.obligation_evidence add constraint obligation_evidence_pkey PRIMARY KEY (id);
alter table public.obligations add constraint obligations_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.requirement_templates add constraint requirement_templates_pkey PRIMARY KEY (id);
alter table public.standard_templates add constraint standard_templates_pkey PRIMARY KEY (id);
alter table public.standard_templates add constraint standard_templates_standard_name_key UNIQUE (standard_name);

-- ------------------------------------------------------------
-- 3. FOREIGN KEYS
--    Added after every table exists, so declaration order does not matter.
-- ------------------------------------------------------------

alter table public.audits add constraint audits_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.audits add constraint audits_company_template_id_fkey FOREIGN KEY (company_template_id) REFERENCES company_templates(id);
alter table public.audits add constraint audits_standard_template_id_fkey FOREIGN KEY (standard_template_id) REFERENCES standard_templates(id);
alter table public.calendar_events add constraint calendar_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.calendar_events add constraint calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.checklist_items add constraint checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE;
alter table public.checklists add constraint checklists_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.checklists add constraint checklists_converted_to_checklist_id_fkey FOREIGN KEY (converted_to_checklist_id) REFERENCES checklists(id);
alter table public.checklists add constraint checklists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.company_folders add constraint company_folders_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.company_folders add constraint company_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES company_folders(id) ON DELETE CASCADE;
alter table public.company_templates add constraint company_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.corrections add constraint corrections_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
alter table public.corrections add constraint corrections_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES obligations(id) ON DELETE CASCADE;
alter table public.corrections add constraint corrections_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.corrections add constraint corrections_requirement_template_id_fkey FOREIGN KEY (requirement_template_id) REFERENCES requirement_templates(id) ON DELETE CASCADE;
alter table public.document_reviews add constraint document_reviews_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.document_reviews add constraint document_reviews_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public.documents add constraint documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.documents add constraint documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES company_folders(id) ON DELETE SET NULL;
alter table public.documents add constraint documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.entities add constraint entities_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.entities add constraint entities_parent_entity_id_fkey FOREIGN KEY (parent_entity_id) REFERENCES entities(id) ON DELETE SET NULL;
alter table public.folder_audits add constraint folder_audits_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.folder_audits add constraint folder_audits_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES company_folders(id) ON DELETE CASCADE;
alter table public.folder_audits add constraint folder_audits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.hr_audits add constraint hr_audits_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public.obligation_evidence add constraint obligation_evidence_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.obligation_evidence add constraint obligation_evidence_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public.obligation_evidence add constraint obligation_evidence_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES obligations(id) ON DELETE CASCADE;
alter table public.obligations add constraint obligations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.obligations add constraint obligations_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
alter table public.obligations add constraint obligations_requirement_template_id_fkey FOREIGN KEY (requirement_template_id) REFERENCES requirement_templates(id) ON DELETE RESTRICT;
alter table public.profiles add constraint profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- CHECK constraints: production has none.

-- ------------------------------------------------------------
-- 4. INDEXES (constraint-backed indexes are created by section 2)
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_agencies_lookup ON public.agencies USING btree (jurisdiction, agency_type);
CREATE INDEX IF NOT EXISTS idx_entities_company ON public.entities USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_obligation_evidence_document ON public.obligation_evidence USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_obligation_evidence_obligation ON public.obligation_evidence USING btree (obligation_id);
CREATE INDEX IF NOT EXISTS idx_obligations_company ON public.obligations USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_obligations_entity ON public.obligations USING btree (entity_id);
CREATE INDEX IF NOT EXISTS idx_obligations_template ON public.obligations USING btree (requirement_template_id);
CREATE INDEX IF NOT EXISTS idx_requirement_templates_industry ON public.requirement_templates USING btree (industry, jurisdiction_state, jurisdiction_county);

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.agencies enable row level security;
alter table public.audits enable row level security;
alter table public.calendar_events enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklists enable row level security;
alter table public.companies enable row level security;
alter table public.company_folders enable row level security;
alter table public.company_templates enable row level security;
alter table public.corrections enable row level security;
alter table public.document_reviews enable row level security;
alter table public.documents enable row level security;
alter table public.entities enable row level security;
alter table public.folder_audits enable row level security;
alter table public.hr_audits enable row level security;
alter table public.obligation_evidence enable row level security;
alter table public.obligations enable row level security;
alter table public.profiles enable row level security;
alter table public.requirement_templates enable row level security;
alter table public.standard_templates enable row level security;

-- Policies, exactly as production has them. Note that five tables
-- (audits, company_templates, document_reviews, hr_audits, standard_templates)
-- have RLS enabled and no policy at all, which denies every ordinary session.
-- That is reproduced faithfully; it is not corrected here.

create policy "agencies readable by authenticated users"
  on public.agencies
  as permissive
  for select
  to authenticated
  using (true)
;

create policy "Users can delete own events"
  on public.calendar_events
  as permissive
  for delete
  to authenticated
  using ((auth.uid() = user_id))
;

create policy "Users can insert own events"
  on public.calendar_events
  as permissive
  for insert
  to authenticated
  with check ((auth.uid() = user_id))
;

create policy "Users can update own events"
  on public.calendar_events
  as permissive
  for update
  to authenticated
  using ((auth.uid() = user_id))
;

create policy "Users can view own events"
  on public.calendar_events
  as permissive
  for select
  to authenticated
  using ((auth.uid() = user_id))
;

create policy "Users can delete own checklist items"
  on public.checklist_items
  as permissive
  for delete
  to authenticated
  using ((checklist_id IN ( SELECT checklists.id
   FROM checklists
  WHERE (checklists.user_id = auth.uid()))))
;

create policy "Users can insert own checklist items"
  on public.checklist_items
  as permissive
  for insert
  to authenticated
  with check ((checklist_id IN ( SELECT checklists.id
   FROM checklists
  WHERE (checklists.user_id = auth.uid()))))
;

create policy "Users can update own checklist items"
  on public.checklist_items
  as permissive
  for update
  to authenticated
  using ((checklist_id IN ( SELECT checklists.id
   FROM checklists
  WHERE (checklists.user_id = auth.uid()))))
;

create policy "Users can view own checklist items"
  on public.checklist_items
  as permissive
  for select
  to authenticated
  using ((checklist_id IN ( SELECT checklists.id
   FROM checklists
  WHERE (checklists.user_id = auth.uid()))))
;

create policy "Users can delete own checklists"
  on public.checklists
  as permissive
  for delete
  to authenticated
  using ((auth.uid() = user_id))
;

create policy "Users can insert own checklists"
  on public.checklists
  as permissive
  for insert
  to authenticated
  with check ((auth.uid() = user_id))
;

create policy "Users can view own checklists"
  on public.checklists
  as permissive
  for select
  to authenticated
  using ((auth.uid() = user_id))
;

create policy "Users can insert company"
  on public.companies
  as permissive
  for insert
  to authenticated
  with check (true)
;

create policy "Users can update own company"
  on public.companies
  as permissive
  for update
  to authenticated
  using ((id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
;

create policy "Users can view own company"
  on public.companies
  as permissive
  for select
  to authenticated
  using ((id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
;

create policy "Users can manage their company folders"
  on public.company_folders
  as permissive
  for all
  to authenticated
  using ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
;

create policy "corrections scoped to own company"
  on public.corrections
  as permissive
  for select
  to authenticated
  using ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
;

create policy "Users can delete own documents"
  on public.documents
  as permissive
  for delete
  to authenticated
  using ((auth.uid() = user_id))
;

create policy "Users can insert own documents"
  on public.documents
  as permissive
  for insert
  to authenticated
  with check ((auth.uid() = user_id))
;

create policy "Users can view own documents"
  on public.documents
  as permissive
  for select
  to authenticated
  using ((auth.uid() = user_id))
;

create policy "entities scoped to own company"
  on public.entities
  as permissive
  for select
  to authenticated
  using ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
;

create policy "Users can delete own folder audits"
  on public.folder_audits
  as permissive
  for delete
  to public
  using ((user_id = auth.uid()))
;

create policy "Users can insert own folder audits"
  on public.folder_audits
  as permissive
  for insert
  to public
  with check ((user_id = auth.uid()))
;

create policy "Users can view own folder audits"
  on public.folder_audits
  as permissive
  for select
  to public
  using ((user_id = auth.uid()))
;

create policy "obligation_evidence scoped to own company"
  on public.obligation_evidence
  as permissive
  for select
  to authenticated
  using ((obligation_id IN ( SELECT obligations.id
   FROM obligations
  WHERE (obligations.company_id IN ( SELECT profiles.company_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))))))
;

create policy "obligations scoped to own company"
  on public.obligations
  as permissive
  for select
  to authenticated
  using ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
;

create policy "Users can insert own profile"
  on public.profiles
  as permissive
  for insert
  to authenticated
  with check ((auth.uid() = id))
;

create policy "Users can update own profile"
  on public.profiles
  as permissive
  for update
  to authenticated
  using ((auth.uid() = id))
;

create policy "Users can view own profile"
  on public.profiles
  as permissive
  for select
  to authenticated
  using ((auth.uid() = id))
;

create policy "requirement_templates readable by authenticated users"
  on public.requirement_templates
  as permissive
  for select
  to authenticated
  using (true)
;

-- Storage policies as they exist in production today. These are the three
-- bucket-only policies migration 002 replaces; they are recorded here so the
-- baseline is an honest snapshot and so 002 has something to drop.

-- IDEMPOTENT ON PURPOSE, unlike the 30 policies above.
--
-- Those live on public tables, so `drop schema`/`drop table` takes them away and this
-- file recreates them on a clean run. These three live on storage.objects, which is NOT
-- in public and therefore survives anything that only clears public — including
-- `npm run db:reset`. Without the guards below, the second run of this file against the
-- same project fails with:
--
--     ERROR: policy "Users can delete own files" for table "objects" already exists
--
-- which is exactly what happened on 11 September, the first time the chain was ever run
-- from an empty database. Migration 002 already drops-if-exists for the same reason; this
-- file should have from the start.
drop policy if exists "Users can delete own files"     on storage.objects;
drop policy if exists "Users can upload to own folder" on storage.objects;
drop policy if exists "Users can view own files"       on storage.objects;

create policy "Users can delete own files"
  on storage.objects
  as permissive
  for delete
  to authenticated
  using ((bucket_id = 'company-documents'::text))
;

create policy "Users can upload to own folder"
  on storage.objects
  as permissive
  for insert
  to authenticated
  with check ((bucket_id = 'company-documents'::text))
;

create policy "Users can view own files"
  on storage.objects
  as permissive
  for select
  to authenticated
  using ((bucket_id = 'company-documents'::text))
;

-- ------------------------------------------------------------
-- 6. GRANTS
--    CLAUDE.md §3.7: a new table without a grant line is unreachable, even for
--    the service role. Production grants all four Supabase roles full DML on
--    every table; RLS is what actually constrains them.
-- ------------------------------------------------------------

grant all on table public.agencies to anon, authenticated, service_role;
grant all on table public.audits to anon, authenticated, service_role;
grant all on table public.calendar_events to anon, authenticated, service_role;
grant all on table public.checklist_items to anon, authenticated, service_role;
grant all on table public.checklists to anon, authenticated, service_role;
grant all on table public.companies to anon, authenticated, service_role;
grant all on table public.company_folders to anon, authenticated, service_role;
grant all on table public.company_templates to anon, authenticated, service_role;
grant all on table public.corrections to anon, authenticated, service_role;
grant all on table public.document_reviews to anon, authenticated, service_role;
grant all on table public.documents to anon, authenticated, service_role;
grant all on table public.entities to anon, authenticated, service_role;
grant all on table public.folder_audits to anon, authenticated, service_role;
grant all on table public.hr_audits to anon, authenticated, service_role;
grant all on table public.obligation_evidence to anon, authenticated, service_role;
grant all on table public.obligations to anon, authenticated, service_role;
grant all on table public.profiles to anon, authenticated, service_role;
grant all on table public.requirement_templates to anon, authenticated, service_role;
grant all on table public.standard_templates to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 7. COMMENTS
-- ------------------------------------------------------------

comment on table public.agencies is 'Truth-side contact facts. Joined at display time, never baked into requirement rows.';
comment on table public.audits is 'One row per audit run. A frozen snapshot of results as checked that day — reusing a template later never rewrites past runs.';
comment on table public.company_templates is 'Private, per-company parsed templates (a specific buyers own form). Never shared across companies. Re-run reuses the active version; a genuinely new version increments version and deactivates the old one.';
comment on table public.corrections is 'User-reported fixes to any requirement or obligation. The learning loop.';
comment on table public.entities is 'People, chemicals, equipment, and sites belonging to a company — each can carry its own obligations.';
comment on table public.hr_audits is 'Saved HR handbook audit results, one row per audit run.';
comment on table public.obligation_evidence is 'Many-to-many: one obligation can have several proofs, one document can satisfy several obligations.';
comment on table public.obligations is 'THE SPINE. What is missing = a query on this table, not an AI guess.';
comment on table public.requirement_templates is 'Master requirements list, per industry x jurisdiction. Cached and shared across all companies in that combo.';
comment on table public.standard_templates is 'Reusable, shared parsed checklist per named standard. Built once, reused by every company auditing against that standard.';

comment on column public.checklists.research_answer is 'If set, this row is a saved research answer, not a checklist.';
comment on column public.checklists.converted_to_checklist_id is 'If set, points to the checklist this research answer was converted into.';
comment on column public.document_reviews.regulation_reference is 'The specific standard/regulation this document was checked against.';
comment on column public.document_reviews.gap_fixes is 'Array of {gap, fix} pairs — each identified gap paired with a concrete correction.';
comment on column public.obligations.resolved_by is 'ai_inferred | user_confirmed | evidence_linked — how this status was decided. ai_inferred is always provisional and revisable.';
comment on column public.obligations.resolution_rationale is 'Short audit trail for AI-inferred decisions, e.g. "applies=yes from scan_result.hazmat_drivers=true". Never populated for user_confirmed/evidence_linked.';

