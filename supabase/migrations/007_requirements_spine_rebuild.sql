-- ============================================================
-- COMPLIBOARD — MIGRATION 007: REBUILD THE REQUIREMENTS SPINE
-- ============================================================
--
-- WHY THIS EXISTS
--
-- The five tables that hold the Requirements model — agencies, requirement_templates,
-- entities, obligations, obligation_evidence — were built for a simpler design than the
-- one the product now has. They are missing versioning, jurisdiction beyond a single
-- text column, machine-evaluable applicability, evidence expiry, and any way to record
-- the period a company was subject to a requirement.
--
-- All five are empty or regenerable, so they are dropped and recreated rather than
-- patched: agencies 0 rows, entities 0, obligation_evidence 0, obligations 376 rows that
-- are pure derived output (188 templates x 2 companies) and are rebuilt by resolution,
-- and requirement_templates 188 rows that reload from a worksheet. NOTHING IS PRESERVED
-- THROUGH THE DROP, deliberately and safely.
--
-- THE SPECIFICATION IS A FILE, NOT A DOCUMENT.
-- supabase/seed-data/REQUIREMENTS-FILLED-2026-09-11.xlsx carries 42 columns across 194
-- validated rows. Every column it carries is a column requirement_templates now holds,
-- and scripts/load-requirements.js already validates the file end to end. The two are
-- exactly congruent: no worksheet column without a home, no schema column with nothing to
-- fill it. That congruence is checked by the validator, not asserted here.
--
-- WHAT THIS MIGRATION DOES
--
--   1. Two more enum types (generated_by; jurisdiction_layer already exists from 006)
--   2. Drops the five tables in dependency order, handling `corrections` explicitly
--   3. agencies              — jurisdiction split into level/state/county
--   4. requirement_templates — 43 columns, versioned, unique on (name, version)
--   5. entities             — entity_scope enum, a primary-site flag
--   6. obligations          — obligation_status enum, AND A VALIDITY WINDOW
--   7. obligation_evidence  — expiry, contribution, confidence, entity_id
--   8. corrections' foreign keys restored
--   9. Grants, RLS policies, indexes, updated_at triggers — all recreated by hand
--
-- WHAT IT DELIBERATELY DOES NOT DO
--
--   requirement_templates.category stays TEXT. The worksheet supplies the ten-value
--   obligation_type for all 194 rows, so the column converts as part of the LOAD, not as
--   part of the schema. Converting it here would mean this migration cannot run until the
--   worksheet is loaded, and the worksheet cannot be loaded until this migration runs.
--
-- ------------------------------------------------------------
-- THREE COLUMNS ADDED THAT NO PLANNING DOCUMENT ASKED FOR
--
-- Each closes a gap between a safety property in CLAUDE.md §3.2 and a column that can
-- hold it. Each is free today and expensive or impossible once a customer has data.
--
--   obligations.applicable_from / applicable_to
--     §3.2: "Obligations are never deleted, only marked. 'We were subject to this from
--     March 2024 to January 2026' is the history the product exists to preserve."
--     There was no column that could hold either date. created_at is when WE INSERTED A
--     ROW, which is a different fact. Once a real customer has obligations, the date they
--     became subject is not recoverable from anything — it is simply gone.
--
--     This also settles a contradiction in the plan. TODO 4.2 specifies
--     replace_obligations as "DELETE+INSERT in one transaction"; §3.2 forbids deleting
--     obligations at all. Both cannot be right. The window is the resolution: replace
--     CLOSES an obligation by setting applicable_to and inserts a new one. Nothing is
--     deleted, and the history survives the recompute that produced it.
--
--   obligations.determined_by jsonb
--     §6.1 principle 3: "Show the reason. Every applicable requirement displays why:
--     which switch, which value, which evidence." resolution_rationale is free text and
--     cannot answer either question that matters operationally — which obligations must
--     be recomputed when one switch changes, and what turns on a given switch. The prose
--     column stays, for the sentence a human reads.
--
--   entities.is_primary
--     TODO 1.6 seeds one site per company at signup "including for single-site
--     customers, so nothing is special-cased later". That promise needs a column naming
--     the default site, or every caller re-derives it and they will not all agree.
-- ============================================================


-- ------------------------------------------------------------
-- 1. TWO MORE TYPES
--
-- The other ten came from 006. jurisdiction_layer, obligation_status, entity_scope,
-- applies_mode, requirement_priority, verification_status and requirement_source_type
-- all already exist and are used below for the first time.
-- ------------------------------------------------------------

do $$
begin
  -- Origin only. Trust lives in verification_status and is independent: a manual row can
  -- be unverified, an AI row can be primary-source verified. The model name (gpt, claude,
  -- gemini) is gone because it drove no decision — DECISIONS.md §22.3.
  if not exists (select 1 from pg_type where typname = 'generated_by') then
    create type public.generated_by as enum ('ai', 'manual');
  end if;

  -- How a document bears on a requirement. TEXT would have been the lazy choice; this is
  -- an enum because CLAUDE.md §3.7 says enum-like columns are enums, and because
  -- `contradicts` is load-bearing: §3.2 permits does_not_apply ONLY with positive
  -- contradicting evidence, and this is where that evidence is recorded as such.
  if not exists (select 1 from pg_type where typname = 'evidence_contribution') then
    create type public.evidence_contribution as enum
      ('satisfies', 'partially_satisfies', 'contradicts', 'superseded');
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. DROP, IN DEPENDENCY ORDER
--
-- `corrections` is NOT being rebuilt and holds two foreign keys into tables that are.
-- `drop table ... cascade` would take those constraints with it, silently, and they would
-- never come back — the table would keep its columns and quietly lose its referential
-- integrity. So they are dropped by name here and restored by name in section 8.
--
-- corrections holds 0 rows, so nothing is orphaned in the meantime.
-- ------------------------------------------------------------

alter table public.corrections drop constraint if exists corrections_obligation_id_fkey;
alter table public.corrections drop constraint if exists corrections_requirement_template_id_fkey;

drop table if exists public.obligation_evidence   cascade;
drop table if exists public.obligations           cascade;
drop table if exists public.entities              cascade;
drop table if exists public.requirement_templates cascade;
drop table if exists public.agencies              cascade;


-- ------------------------------------------------------------
-- 3. agencies
--
-- The old shape had one `jurisdiction text` column doing the work of three. Splitting it
-- is what lets resolution filter on jurisdiction at all — CLAUDE.md §3.2, "Jurisdiction
-- is always part of the match key. Serving Oregon requirements to a Texas company is a
-- silent, dangerous failure."
--
-- Still empty after this migration. Populating it is Phase 2.1, and until then every
-- requirement_templates.agency_id is null — which is why that column is nullable.
-- ------------------------------------------------------------

create table public.agencies (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  short_name            text,
  agency_type           text,

  jurisdiction_level    public.jurisdiction_layer,
  jurisdiction_state    text,
  jurisdiction_county   text,
  jurisdiction_city     text,

  industries            text[] not null default '{}',
  review_interval       text,                    -- how often to re-check this agency's rules

  url                   text,
  phone                 text,
  address               text,
  contact_email         text,
  notes                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.agencies is
  'Regulators. Reference data, not customer data: readable by any authenticated user, '
  'written only by the service role. Empty until Phase 2.1.';


-- ------------------------------------------------------------
-- 4. requirement_templates — THE LIBRARY
--
-- 43 columns, congruent with the worksheet. Reference data like agencies: global, not
-- scoped to a company, readable by everyone signed in and writable only by the service
-- role.
--
-- THE VERSIONING RULE, because it is the one most easily broken by a well-meaning UPDATE:
-- a change to a requirement creates a NEW ROW with version + 1 and its own id; the old
-- row gets effective_to and stays forever. It is never edited in place. That is what
-- makes an audit reproducible — an obligation's foreign key points at the exact version
-- it was resolved against, so re-running last year's audit gives last year's answer.
-- CLAUDE.md §3.2.
--
-- `unique (requirement_name, version)` is what makes the load re-runnable with
-- `on conflict` instead of the old seed file's "safe to run once". A load that can only
-- be run once cannot be tested.
-- ------------------------------------------------------------

create table public.requirement_templates (
  id                        uuid primary key default gen_random_uuid(),

  -- versioning
  version                   integer not null default 1,
  supersedes_id             uuid references public.requirement_templates(id) on delete set null,
  split_from_id             uuid references public.requirement_templates(id) on delete set null,
  effective_from            date,
  effective_to              date,

  -- identity
  requirement_name          text not null,
  category                  text,                        -- see the header: stays TEXT, the load converts it
  entity_type               public.entity_scope not null default 'organization',
  source_type               public.requirement_source_type not null default 'statutory',

  -- jurisdiction. NULLABLE on purpose: a contractual row has no jurisdiction level at
  -- all. Defaulting ISO 9001 to `federal` would assert that US federal law requires it,
  -- which is false. DECISIONS.md §21.2.
  jurisdiction_layer        public.jurisdiction_layer,
  jurisdiction_state        text,
  jurisdiction_county       text,
  jurisdiction_city         text,

  industries                text[] not null default '{}',
  agency_id                 uuid references public.agencies(id) on delete set null,
  secondary_agency_ids      uuid[] not null default '{}',

  -- citation
  citation                  text,
  citation_url              text,
  citation_quote            text,
  citation_federal_analogue text,
  source_checked_at         timestamptz,

  -- applicability
  applies                   public.applies_mode not null default 'universal',
  applies_expression        jsonb,                       -- machine-evaluable; Phase 6.3
  trigger_condition         text,
  trigger_plain             text,
  scope_rules               text,                        -- what this does NOT cover
  produces_switch           text,                        -- the NAME of a switch; §22.2
  is_determination          boolean not null default false,

  -- timing. `cadence` is prose and is irreducible — 188 of 188 rows are populated with
  -- things like "PHA every 5 years; audit every 3; refresher <=3; incident investigation
  -- within 48 hours". cadence_type NEVER replaces it. Free text until the pass shows what
  -- the vocabulary needs to be — DECISIONS.md §22.4.
  cadence_type              text,
  cadence_anchor            text,
  cadence                   text,

  -- evidence and failure
  evidence_description      text,
  evidence_types            text[] not null default '{}',
  fails_if                  text,

  -- priority. Defined by consequence: critical means the business stops.
  -- DECISIONS.md §22.1.
  priority                  public.requirement_priority not null default 'high',

  -- verification. Only a person sets `verified` — the worker may never do it
  -- (CLAUDE.md §4). generated_by is origin and says nothing about trust.
  status                    public.verification_status not null default 'generated',
  verification_note         text,
  verified_by               text,
  verified_at               timestamptz,
  generated_by              public.generated_by not null default 'ai',

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint requirement_templates_name_version_key unique (requirement_name, version),

  -- A contractual row has no jurisdiction; every other row has one. Enforced rather than
  -- documented, because the whole point of splitting `layer` was that the two axes had
  -- been silently sharing a column.
  constraint requirement_templates_contractual_has_no_jurisdiction check (
    (source_type = 'contractual' and jurisdiction_layer is null)
    or (source_type <> 'contractual' and jurisdiction_layer is not null)
  ),

  -- A named jurisdiction must actually be named.
  constraint requirement_templates_named_jurisdiction check (
    (jurisdiction_layer is distinct from 'county' or jurisdiction_county is not null)
    and (jurisdiction_layer is distinct from 'city' or jurisdiction_city is not null)
    and (jurisdiction_layer is distinct from 'state' or jurisdiction_state is not null)
  ),

  -- A retired row must say when. A live row must not.
  constraint requirement_templates_version_window check (
    effective_to is null or effective_from is null or effective_to >= effective_from
  )
);

comment on table public.requirement_templates is
  'THE LIBRARY. What the law requires, by industry and jurisdiction. Reference data: '
  'global, readable by any authenticated user, written only by the service role. '
  'Rows are VERSIONED, never edited in place — a change is a new row with version + 1 '
  'and the old row gets effective_to. CLAUDE.md §3.2.';

comment on column public.requirement_templates.split_from_id is
  'The row this one was carved out of. Distinct from supersedes_id: that means the rule '
  'CHANGED and this version replaces the last, this means the rule was one row and should '
  'have been several. Only the first is a legal event.';

comment on column public.requirement_templates.category is
  'The shape of the duty — ten values, see the obligation_type enum. Deliberately still '
  'TEXT: the worksheet supplies the value for all 194 rows, so the column converts as part '
  'of the load rather than as part of the schema.';


-- ------------------------------------------------------------
-- 5. entities — organisations, sites, chemicals, equipment, people, products
--
-- Company data, so RLS applies. entity_scope gained `product` in 006 for cannabis
-- per-SKU pre-approval.
--
-- is_primary is the default site. TODO 1.6 seeds one site per company at signup for
-- EVERY customer including single-site ones, precisely so that nothing downstream has to
-- ask "does this company have sites?" — and that only works if there is an unambiguous
-- answer to "which one is the default". The partial unique index makes at most one
-- primary per company a database fact rather than a convention.
-- ------------------------------------------------------------

create table public.entities (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  entity_type       public.entity_scope not null,
  name              text not null,
  parent_entity_id  uuid references public.entities(id) on delete set null,
  is_primary        boolean not null default false,
  details           jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.entities.name is
  'The name the operator actually uses — "CompanyA-Hillsboro", never "Site 2". A plant '
  'manager thinks "the Hillsboro plant"; making them translate that into an id makes the '
  'product harder to use than the spreadsheet it replaces. CHEMICAL-OR-WA.md §6.6.';


-- ------------------------------------------------------------
-- 6. obligations — WHICH LIBRARY ROWS APPLY TO THIS COMPANY
--
-- Produced by code, never by AI (CLAUDE.md §1, layer 3). Company data, so RLS applies.
--
-- *** THE VALIDITY WINDOW IS THE POINT OF THIS TABLE. ***
--
-- applicable_from / applicable_to make "we were subject to this from March 2024 to
-- January 2026" storable. Before this migration there was no column that could hold
-- either date, and §3.2 names that sentence as the history the product exists to
-- preserve. When resolution finds a requirement no longer applies, it SETS
-- applicable_to. It does not delete the row. It never deletes the row.
--
-- That is also why there is no DELETE policy on this table in section 10, and why the
-- DELETE+INSERT shape sketched for replace_obligations in TODO 4.2 has to become
-- CLOSE+INSERT. A refresh that deletes history is a refresh that destroys the record the
-- customer is paying us to keep.
--
-- status is about APPLICABILITY, not about whether the duty has been met. Whether an
-- obligation is satisfied is a JOIN against obligation_evidence and is never a column
-- read — that is why the state is `applies` and not `satisfied`. DECISIONS.md §21.3.
-- ------------------------------------------------------------

create table public.obligations (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  entity_id                uuid references public.entities(id) on delete cascade,
  requirement_template_id  uuid not null references public.requirement_templates(id) on delete restrict,

  -- Defaults to `unknown`, the safest possible value: if resolution ever fails to set it,
  -- the row surfaces as an open question rather than as a clear. §3.2 — absence of
  -- evidence must never produce a clear.
  status                   public.obligation_status not null default 'unknown',

  applicable_from          date not null default current_date,
  applicable_to            date,

  due_date                 date,
  last_verified_at         timestamptz,
  notes                    text,

  -- How this row came to exist. resolved_by and resolution_rationale are the prose a
  -- person reads; determined_by is the same fact in a form a query can use — which
  -- switches, at which values. Needed for "show the reason" on screen (§6.1) and for
  -- "recompute everything that turns on employee_count" when a switch changes.
  resolved_by              text not null default 'ai_inferred',
  resolution_rationale     text,
  determined_by            jsonb not null default '{}',

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint obligations_window check (applicable_to is null or applicable_to >= applicable_from)
);

comment on table public.obligations is
  'The resolved list: which library rows apply to this company. Produced by CODE, never '
  'by AI. Rows are NEVER DELETED — a requirement that stops applying gets applicable_to '
  'set and stays. CLAUDE.md §3.2.';

comment on column public.obligations.status is
  'Whether the requirement APPLIES. NOT whether it has been met — that is a join against '
  'obligation_evidence and is never a column read. A row reading `applies` with no '
  'evidence behind it is an open duty, not a satisfied one. DECISIONS.md §21.3.';

-- ON DELETE RESTRICT above is deliberate: a library row cannot be deleted while an
-- obligation cites it. An audit that pinned to that version must stay reproducible.


-- ------------------------------------------------------------
-- 7. obligation_evidence — WHICH DOCUMENTS PROVE WHICH OBLIGATIONS
--
-- Rows, not JSON. That single choice is what makes "what's missing" a database query
-- rather than an AI guess, lets audits run incrementally instead of recomputing from
-- scratch, and gives resolution tracking somewhere to live.
--
-- *** valid_until IS A SAFETY PROPERTY WITH A COLUMN AT LAST. ***
-- §3.2: "Expired evidence can never satisfy a requirement. Enforced in the prompt AND in
-- code." There was no column for code to enforce against, which is exactly why TODO 7.4
-- records evidence expiry as "currently a prompt rule only". A prompt rule is a request;
-- a column and a comparison are enforcement.
--
-- contribution = 'contradicts' is the other half of a safety property: §3.2 permits an
-- obligation to be marked does_not_apply ONLY with positive contradicting evidence, and
-- ONLY if that evidence is recorded. This is where it is recorded.
-- ------------------------------------------------------------

create table public.obligation_evidence (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  obligation_id     uuid not null references public.obligations(id) on delete cascade,
  document_id       uuid references public.documents(id) on delete cascade,
  entity_id         uuid references public.entities(id) on delete cascade,

  status            text,                                 -- vocabulary settles in 7.3
  contribution      public.evidence_contribution not null default 'satisfies',
  match_confidence  text,
  match_rationale   text,

  -- The window this document actually covers. valid_until is what expiry is enforced
  -- against; null means it does not expire, which must be a deliberate answer and not a
  -- forgotten field.
  valid_from        date,
  valid_until       date,

  assessed_at       timestamptz,
  assessed_by       text,
  superseded_by     uuid references public.obligation_evidence(id) on delete set null,

  added_at          timestamptz not null default now(),
  added_by          uuid references auth.users(id) on delete set null,

  constraint obligation_evidence_window check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

comment on column public.obligation_evidence.valid_until is
  'When this document stops proving anything. Expired evidence can never satisfy a '
  'requirement (CLAUDE.md §3.2) and this is the column that comparison runs against. '
  'NULL means "does not expire" and must be a decision, not an omission.';

comment on column public.obligation_evidence.contribution is
  '`contradicts` is how an obligation earns does_not_apply: §3.2 allows that status only '
  'with positive contradicting evidence, recorded. Without a row here saying so, a '
  'not-applicable marking has no basis and must not be made.';


-- ------------------------------------------------------------
-- 8. corrections' FOREIGN KEYS, RESTORED
--
-- Dropped by name in section 2 so that `cascade` could not take them silently. Restored
-- by name here so the restoration is equally visible. If this section is ever deleted,
-- corrections keeps its columns and loses its referential integrity, which is the kind
-- of loss nothing reports.
-- ------------------------------------------------------------

alter table public.corrections
  add constraint corrections_obligation_id_fkey
  foreign key (obligation_id) references public.obligations(id) on delete cascade;

alter table public.corrections
  add constraint corrections_requirement_template_id_fkey
  foreign key (requirement_template_id) references public.requirement_templates(id) on delete cascade;


-- ------------------------------------------------------------
-- 9. GRANTS
--
-- CLAUDE.md §3.6: "GRANT is not automatic — every new table needs its own grant line or
-- all reads and writes fail with permission denied, even for service role, even when RLS
-- passes." A dropped table takes its grants with it, so all five need them again.
--
-- `anon` gets nothing. Migration 004 revoked every anon grant in the database and that
-- must not silently return through a rebuild.
--
-- `authenticated` holds full DML on all five, exactly as before. On the two reference
-- tables that is wider than the policies allow — RLS gives them SELECT only, so writes
-- are refused by policy rather than by grant. That is the existing arrangement from 004
-- and is preserved rather than quietly tightened here; narrowing it is its own change.
-- ------------------------------------------------------------

grant all on public.agencies              to authenticated, service_role;
grant all on public.requirement_templates to authenticated, service_role;
grant all on public.entities              to authenticated, service_role;
grant all on public.obligations           to authenticated, service_role;
grant all on public.obligation_evidence   to authenticated, service_role;

revoke all on public.agencies              from anon;
revoke all on public.requirement_templates from anon;
revoke all on public.entities              from anon;
revoke all on public.obligations           from anon;
revoke all on public.obligation_evidence   from anon;


-- ------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
--
-- Thirteen policies were destroyed by the drop and are recreated here, unchanged in
-- meaning. Every company-scoped policy goes through auth_company_id() — never a repeated
-- subquery against profiles, because a copy of that subquery depends on profiles' own RLS
-- invisibly (migration 004, section 1).
--
-- Explicit WITH CHECK on every INSERT and UPDATE, per §3.6.
--
-- *** obligations has NO DELETE POLICY, on purpose. ***
-- Obligations are never deleted, only marked (§3.2). The absence of the policy is the
-- enforcement: even a route that tries will change zero rows. If a future migration adds
-- one, that is a decision to destroy compliance history and should be argued for in
-- writing first.
-- ------------------------------------------------------------

alter table public.agencies              enable row level security;
alter table public.requirement_templates enable row level security;
alter table public.entities              enable row level security;
alter table public.obligations           enable row level security;
alter table public.obligation_evidence   enable row level security;

-- Reference data: readable by anyone signed in, written only by the service role, which
-- bypasses RLS entirely. No INSERT/UPDATE/DELETE policy exists for either table, so no
-- authenticated caller can write one.
create policy "agencies readable by authenticated users"
  on public.agencies for select to authenticated using (true);

create policy "requirement_templates readable by authenticated users"
  on public.requirement_templates for select to authenticated using (true);

-- entities
create policy entities_select on public.entities
  for select to authenticated using (entities.company_id = public.auth_company_id());
create policy entities_insert on public.entities
  for insert to authenticated with check (entities.company_id = public.auth_company_id());
create policy entities_update on public.entities
  for update to authenticated using (entities.company_id = public.auth_company_id())
                            with check (entities.company_id = public.auth_company_id());
create policy entities_delete on public.entities
  for delete to authenticated using (entities.company_id = public.auth_company_id());

-- obligations — note the deliberate absence of a delete policy
create policy obligations_select on public.obligations
  for select to authenticated using (obligations.company_id = public.auth_company_id());
create policy obligations_insert on public.obligations
  for insert to authenticated with check (obligations.company_id = public.auth_company_id());
create policy obligations_update on public.obligations
  for update to authenticated using (obligations.company_id = public.auth_company_id())
                               with check (obligations.company_id = public.auth_company_id());

-- obligation_evidence
create policy obligation_evidence_select on public.obligation_evidence
  for select to authenticated using (obligation_evidence.company_id = public.auth_company_id());
create policy obligation_evidence_insert on public.obligation_evidence
  for insert to authenticated with check (obligation_evidence.company_id = public.auth_company_id());
create policy obligation_evidence_update on public.obligation_evidence
  for update to authenticated using (obligation_evidence.company_id = public.auth_company_id())
                                        with check (obligation_evidence.company_id = public.auth_company_id());
create policy obligation_evidence_delete on public.obligation_evidence
  for delete to authenticated using (obligation_evidence.company_id = public.auth_company_id());


-- ------------------------------------------------------------
-- 11. INDEXES
--
-- Company-leading, per the naming convention in CLAUDE.md §3.7. Every foreign key gets
-- one: the schema snapshot of 9 Sep found most FKs unindexed, which is a full table scan
-- on every join and gets worse with every customer.
-- ------------------------------------------------------------

create index idx_agencies_jurisdiction on public.agencies (jurisdiction_level, jurisdiction_state);

create index idx_requirement_templates_industries on public.requirement_templates using gin (industries);
create index idx_requirement_templates_jurisdiction on public.requirement_templates (jurisdiction_layer, jurisdiction_state);
create index idx_requirement_templates_agency on public.requirement_templates (agency_id);
create index idx_requirement_templates_supersedes on public.requirement_templates (supersedes_id);
create index idx_requirement_templates_split_from on public.requirement_templates (split_from_id);

-- The library's working set: rows that have not been superseded.
create index idx_requirement_templates_live on public.requirement_templates (requirement_name)
  where effective_to is null;

create index idx_entities_company on public.entities (company_id);
create index idx_entities_parent on public.entities (parent_entity_id);

-- At most one primary site per company, enforced rather than assumed.
create unique index idx_entities_one_primary on public.entities (company_id)
  where is_primary;

create index idx_obligations_company on public.obligations (company_id);
create index idx_obligations_entity on public.obligations (entity_id);
create index idx_obligations_template on public.obligations (requirement_template_id);

-- *** RESOLUTION IS IDEMPOTENT, ENFORCED HERE. ***
-- TODO 4.4 requires "resolution is idempotent" as a test. This makes it a database fact:
-- one OPEN obligation per company, site and requirement. A second resolution run cannot
-- double the rows even if the code forgets. Closed obligations are excluded from the
-- index, so the same requirement can legitimately apply again later — which is what a
-- company that starts, stops and restarts an activity actually does.
--
-- NULLS NOT DISTINCT is required and is why this needs Postgres 15+ (we are on 17.6):
-- entity_id is null for organisation-scoped obligations, and by default Postgres treats
-- two nulls as different, which would allow unlimited duplicates on exactly the rows most
-- likely to be duplicated.
create unique index idx_obligations_one_open nulls not distinct
  on public.obligations (company_id, entity_id, requirement_template_id)
  where applicable_to is null;

create index idx_obligation_evidence_company on public.obligation_evidence (company_id);
create index idx_obligation_evidence_obligation on public.obligation_evidence (obligation_id);
create index idx_obligation_evidence_document on public.obligation_evidence (document_id);
create index idx_obligation_evidence_entity on public.obligation_evidence (entity_id);

-- Finding evidence that is about to lapse is a product feature, not a report.
create index idx_obligation_evidence_expiry on public.obligation_evidence (company_id, valid_until)
  where valid_until is not null;


-- ------------------------------------------------------------
-- 12. updated_at TRIGGERS
--
-- set_updated_at() survives — 006 created the function, and dropping a table does not
-- drop a function. The TRIGGERS were attached to the tables and went with them.
-- standard_templates keeps the trigger it already has and is untouched here.
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['agencies', 'requirement_templates', 'entities', 'obligations'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
-- obligation_evidence has no updated_at column: an evidence row is a statement about a
-- document at a point in time. It is superseded by another row, not edited.


-- ------------------------------------------------------------
-- 13. VERIFY WHAT THIS FILE ACTUALLY DID
--
-- The five tables were dropped. If any part of the rebuild silently did not happen, that
-- is a table with no policies — which denies everything — or no grants, which denies
-- everything with a different message. Both look like "the app is broken" from outside
-- and neither points here. So the migration checks its own work and fails loudly.
-- ------------------------------------------------------------

do $$
declare
  n_tables  integer;
  n_policies integer;
  n_rls     integer;
  missing   text;
begin
  select count(*) into n_tables from pg_tables
   where schemaname = 'public'
     and tablename in ('agencies','requirement_templates','entities','obligations','obligation_evidence');
  if n_tables <> 5 then
    raise exception 'MIGRATION 007: expected 5 rebuilt tables, found %', n_tables;
  end if;

  select count(*) into n_policies from pg_policies
   where schemaname = 'public'
     and tablename in ('agencies','requirement_templates','entities','obligations','obligation_evidence');
  if n_policies <> 13 then
    raise exception 'MIGRATION 007: expected 13 policies, found %', n_policies;
  end if;

  select count(*) into n_rls from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relrowsecurity
     and c.relname in ('agencies','requirement_templates','entities','obligations','obligation_evidence');
  if n_rls <> 5 then
    raise exception 'MIGRATION 007: RLS is not enabled on all five, only %', n_rls;
  end if;

  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'obligations' and cmd = 'DELETE') then
    raise exception 'MIGRATION 007: a DELETE policy exists on obligations. They are never deleted, only marked (CLAUDE.md §3.2).';
  end if;

  select string_agg(t, ', ') into missing from unnest(array[
    'corrections_obligation_id_fkey','corrections_requirement_template_id_fkey']) t
   where not exists (select 1 from pg_constraint where conname = t);
  if missing is not null then
    raise exception 'MIGRATION 007: corrections lost foreign key(s): %', missing;
  end if;

  -- anon must hold nothing. 004 revoked every anon grant; a rebuild must not return them.
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon'
       and table_name in ('agencies','requirement_templates','entities','obligations','obligation_evidence')
  ) then
    raise exception 'MIGRATION 007: anon holds a grant on a rebuilt table. Migration 004 revoked all of them.';
  end if;

  raise notice 'MIGRATION 007 OK: 5 tables, 13 policies, RLS on all five, no DELETE policy on obligations, corrections intact, anon holds nothing.';
end $$;
