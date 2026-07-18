-- ============================================================
-- COMPLIBOARD — STEP 3: THE SPINE
-- Creates 6 new tables. Nothing existing is touched or deleted.
-- Safe to run once. Run the whole script in one go.
-- ============================================================

-- 1. REQUIREMENT_TEMPLATES
-- The master list of requirements — one row per requirement,
-- per industry, per jurisdiction. This is where the merged
-- 188-row chemical list will eventually live as real data.
create table public.requirement_templates (
  id uuid primary key default gen_random_uuid(),
  industry text not null,                    -- free text, e.g. "chemical-manufacturing"
  jurisdiction_state text,                    -- e.g. "Oregon", null = federal-only
  jurisdiction_county text,                   -- e.g. "Multnomah", null = state/federal-only
  layer text not null default 'federal',      -- federal | state | county | contractual
  category text,                              -- e.g. "Written Safety Programs"
  requirement_name text not null,
  citation text,
  cadence text,                               -- e.g. "Annual — due March 1"
  applies text not null default 'universal',  -- universal | conditional
  trigger_condition text,                     -- machine-readable-ish trigger
  trigger_plain text,                         -- plain-language sentence for self-resolving rows
  entity_type text not null default 'organization', -- organization | person | chemical | equipment | site
  evidence_description text,                  -- what document proves this
  fails_if text,                              -- what makes it fail even if the doc exists
  priority text default 'high',               -- critical | high | standard
  status text default 'generated',            -- generated | reviewed (INTERNAL ONLY — never shown publicly)
  is_determination boolean default false,     -- true = "confirm this applies" row, not a hard claim
  source text,                                -- which generator produced it (claude/gpt/gemini/manual)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.requirement_templates is 'Master requirements list, per industry x jurisdiction. Cached and shared across all companies in that combo.';

-- 2. ENTITIES
-- The "things" that can owe a requirement, beyond just the company itself.
create table public.entities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null,                  -- organization | person | chemical | equipment | site
  name text not null,                         -- e.g. "Margaret Chen", "Hydrofluoric Acid", "Forklift #2"
  parent_entity_id uuid references public.entities(id) on delete set null, -- e.g. equipment belongs to a site
  details jsonb default '{}'::jsonb,          -- flexible per-type fields (hire_date, CAS number, serial number, address, etc.)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.entities is 'People, chemicals, equipment, and sites belonging to a company — each can carry its own obligations.';

-- 3. OBLIGATIONS — THE SPINE
-- This entity owes this requirement. Due when, status what, evidence where.
create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete cascade, -- null = obligation belongs to the company itself
  requirement_template_id uuid not null references public.requirement_templates(id) on delete restrict,
  status text not null default 'missing',     -- missing | satisfied | expiring_soon | at_risk | not_applicable
  due_date date,
  last_verified_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.obligations is 'THE SPINE. What is missing = a query on this table, not an AI guess.';

-- 4. OBLIGATION_EVIDENCE
-- Links an obligation to the document that proves it — works the
-- same whether the file was uploaded, emailed in, or Drive-connected,
-- because it only points at a documents row, never the file itself.
create table public.obligation_evidence (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.obligations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  added_at timestamptz default now(),
  added_by uuid references auth.users(id) on delete set null
);

comment on table public.obligation_evidence is 'Many-to-many: one obligation can have several proofs, one document can satisfy several obligations.';

-- 5. CORRECTIONS
-- Every user-reported fix, remembered forever. Feeds the
-- generated -> reviewed promotion and fixes county-layer truth
-- for every future customer in that jurisdiction.
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  requirement_template_id uuid references public.requirement_templates(id) on delete cascade,
  obligation_id uuid references public.obligations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  correction_text text not null,
  status text default 'pending',              -- pending | applied | rejected
  created_at timestamptz default now()
);

comment on table public.corrections is 'User-reported fixes to any requirement or obligation. The learning loop.';

-- 6. AGENCIES
-- The "who to call" truth table. One real phone number per
-- jurisdiction x agency type, shared by every requirement that
-- needs it. Never generated per-row, never monetized.
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,                 -- e.g. "Oregon", "Multnomah County", "Federal"
  agency_type text not null,                  -- e.g. "air_quality_permit", "osha_regional"
  name text not null,
  phone text,
  address text,
  url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.agencies is 'Truth-side contact facts. Joined at display time, never baked into requirement rows.';

-- ============================================================
-- Helpful indexes — makes lookups fast as data grows
-- ============================================================
create index idx_entities_company on public.entities(company_id);
create index idx_obligations_company on public.obligations(company_id);
create index idx_obligations_entity on public.obligations(entity_id);
create index idx_obligations_template on public.obligations(requirement_template_id);
create index idx_obligation_evidence_obligation on public.obligation_evidence(obligation_id);
create index idx_obligation_evidence_document on public.obligation_evidence(document_id);
create index idx_requirement_templates_industry on public.requirement_templates(industry, jurisdiction_state, jurisdiction_county);
create index idx_agencies_lookup on public.agencies(jurisdiction, agency_type);

-- ============================================================
-- Row Level Security — matches your existing tables' pattern.
-- Locked down by default; we'll add specific policies once
-- the API routes that use these tables are built (Step 5).
-- ============================================================
alter table public.requirement_templates enable row level security;
alter table public.entities enable row level security;
alter table public.obligations enable row level security;
alter table public.obligation_evidence enable row level security;
alter table public.corrections enable row level security;
alter table public.agencies enable row level security;

-- requirement_templates and agencies are shared reference data —
-- readable by any authenticated user, never user-writable directly
-- (only your backend, using the service role key, writes to these).
create policy "requirement_templates readable by authenticated users"
  on public.requirement_templates for select
  to authenticated
  using (true);

create policy "agencies readable by authenticated users"
  on public.agencies for select
  to authenticated
  using (true);

-- entities, obligations, obligation_evidence, corrections are
-- company-scoped — a user can only see rows for their own company.
create policy "entities scoped to own company"
  on public.entities for select
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy "obligations scoped to own company"
  on public.obligations for select
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy "obligation_evidence scoped to own company"
  on public.obligation_evidence for select
  to authenticated
  using (
    obligation_id in (
      select id from public.obligations
      where company_id in (select company_id from public.profiles where id = auth.uid())
    )
  );

create policy "corrections scoped to own company"
  on public.corrections for select
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));

-- ============================================================
-- Done. 6 tables, indexes, and safe default access rules created.
-- ============================================================
