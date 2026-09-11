-- ============================================================
-- COMPLIBOARD — MIGRATION 008: SWITCHES, COVERAGE, CANDIDATES, JOBS
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Five of the six tables TODO 1.2 calls for. They are the layer the product is named
-- after: the library says what the law requires, and these say which of it reaches THIS
-- company. Without them `obligations` has no input, so resolution (Phase 4) cannot be
-- written and the requirements screen has nothing to show.
--
--   switches             the ~59 facts that determine applicability — reference data
--   company_switches     one company's answers, with basis and confidence
--   industry_coverage    which industry x jurisdiction x agency we have actually built
--   library_candidates   requirements produced with no library behind them
--   jobs                 the worker's queue
--
-- WHAT IS NOT HERE: `topics`. Deliberately — DECISIONS.md §23.2. Two of WORKSPACE.md's
-- open questions decide its columns (whether a company may have several open topics is a
-- partial unique index or the absence of one; what a summary contains is the column that
-- IS its output), and it is the furthest of the six from a caller. Building it now would
-- lock in a guess nothing exercises for months.
--
-- THE ONE THING MOST LIKELY TO BE GOT WRONG LATER, SO IT IS ENFORCED RATHER THAN WRITTEN
-- DOWN: a switch is either about the whole company or about one site, and a value must
-- match. `employee_count` is company-wide; `hazwaste_generator_category` is per-site, and
-- a company-wide answer to it is not approximately right — it is wrong at five of six
-- facilities, in the direction of a confident answer (DECISIONS.md §20). Sections 3 and 4
-- make the mismatch unrepresentable rather than discouraged.
-- ============================================================


-- ------------------------------------------------------------
-- 1. TYPES
--
-- Ten more, all of them enumerated in CHEMICAL-OR-WA.md §2.2/§2.3 or CLAUDE.md §4 — none
-- is invented here. Where a vocabulary is NOT settled anywhere, the column stays `text`
-- with a comment saying so, following DECISIONS.md §22.4: an enum guessed before the work
-- is an enum that gets fought.
-- ------------------------------------------------------------

do $$
begin
  -- Is this fact about the company, or about one site? DECISIONS.md §20.
  if not exists (select 1 from pg_type where typname = 'switch_scope') then
    create type public.switch_scope as enum ('company', 'site');
  end if;

  if not exists (select 1 from pg_type where typname = 'switch_value_type') then
    create type public.switch_value_type as enum ('enum', 'boolean', 'number', 'text');
  end if;

  if not exists (select 1 from pg_type where typname = 'switch_determination_source') then
    create type public.switch_determination_source as enum
      ('documents', 'profile', 'user_answer', 'computed_by_requirement');
  end if;

  -- How fast the answer goes stale. Drives expires_at, and an expired switch reverts to
  -- `unknown` rather than to its last value — a stale `false` is a false green.
  if not exists (select 1 from pg_type where typname = 'switch_volatility') then
    create type public.switch_volatility as enum ('static', 'annual', 'monthly');
  end if;

  -- *** THE SAFETY FEATURE, CHEMICAL-OR-WA.md §2.3. ***
  -- `unknown` means a dependent requirement is UNDETERMINED and is shown as an open
  -- question. It must never resolve to does_not_apply (CLAUDE.md §3.2). `needs_user`
  -- is the subset we can actually ask about, and it populates the switches screen.
  if not exists (select 1 from pg_type where typname = 'switch_state') then
    create type public.switch_state as enum ('known', 'unknown', 'needs_user');
  end if;

  if not exists (select 1 from pg_type where typname = 'switch_confidence') then
    create type public.switch_confidence as enum ('high', 'medium', 'low');
  end if;

  if not exists (select 1 from pg_type where typname = 'switch_value_source') then
    create type public.switch_value_source as enum
      ('ai_from_documents', 'ai_from_profile', 'user_set', 'computed');
  end if;

  -- DECISIONS.md §6. Three tiers of anchoring come from this PLUS row presence — see the
  -- comment on industry_coverage in section 5.
  if not exists (select 1 from pg_type where typname = 'coverage_status') then
    create type public.coverage_status as enum ('not_built', 'generated', 'verified');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum
      ('pending', 'running', 'succeeded', 'failed', 'cancelled');
  end if;

  -- The four kinds of long-running work CLAUDE.md §4 names. Adding a fifth is one
  -- ALTER TYPE ... ADD VALUE, which is exactly why §3.7 prefers enums to text + CHECK.
  if not exists (select 1 from pg_type where typname = 'job_type') then
    create type public.job_type as enum
      ('index_document', 'generate_library', 'check_library', 'monitor_changes');
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. switches — THE LIBRARY OF FACTS
--
-- Reference data, like requirement_templates and agencies: global, not scoped to a
-- company, readable by anyone signed in and written only by the service role.
--
-- `id` is a readable slug rather than a uuid on purpose. It is written by hand into
-- `applies_expression` on requirement rows — `hazwaste_generator_category = 'LQG'` is
-- reviewable by a person with domain knowledge and no database access, which is the whole
-- point of that column being machine-evaluable AND human-checkable.
--
-- THE ~59 SWITCHES, not 46. DECISIONS.md §23.1: `substance_exposure_above_action_level`
-- was one switch holding fourteen answers, and it decomposes into one per substance —
-- exposure_lead, exposure_silica, exposure_benzene and the rest. Each has its own action
-- level, its own standard and its own requirement, so each needs its own basis and its own
-- confidence. That also makes switches line up one-to-one with the rows they gate.
-- ------------------------------------------------------------

create table public.switches (
  id                    text primary key,
  label                 text not null,

  -- company or site. The composite unique below exists so company_switches can point at
  -- BOTH columns and the two can never drift apart — see section 3.
  scope                 public.switch_scope not null,

  value_type            public.switch_value_type not null,

  -- NOT NULL with an empty-array default, so nothing downstream ever has to distinguish
  -- "no constrained values" from "unknown".
  --
  -- *** A NOTE FOR WHOEVER WRITES THE 59-SWITCH SEED (TODO 6.2). *** A bulk insert through
  -- PostgREST normalises an array of objects to the UNION of their keys and fills anything
  -- missing with NULL — not with the column default. So a seed where some rows specify
  -- allowed_values and others do not will fail here on a not-null violation, which reads as
  -- a schema problem and is not one. Pass `defaultToNull: false`, the same flag the
  -- requirements loader needs for exactly the same reason.
  allowed_values        text[] not null default '{}',

  question_plain        text,
  determination_source  public.switch_determination_source not null,
  volatility            public.switch_volatility not null default 'static',

  -- "this switch means different things in OR vs WA" — CHEMICAL-OR-WA.md §2.2. WA's
  -- hazardous waste designation criteria are broader than Oregon's, so the same answer
  -- to the same question puts a company in a different category.
  jurisdiction_variant  boolean not null default false,

  -- The switch hierarchy. `psm_rmp_threshold` is only worth asking if the company handles
  -- a listed substance at all, so asking it first wastes a question.
  depends_on_switch     text references public.switches(id) on delete set null,
  depends_on_value      text,

  domain                text,   -- chemical | employment | transport | fire | licensing
  notes                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Not redundant with the primary key, despite appearances. It is the target of a
  -- COMPOSITE foreign key from company_switches, which is what stops a stored value
  -- claiming a scope the switch does not have. Postgres requires a unique constraint on
  -- exactly the referenced columns.
  constraint switches_id_scope_key unique (id, scope),

  -- cardinality(), NOT array_length(). `array_length('{}', 1)` returns **NULL**, not 0,
  -- so `array_length(...) > 0` is NULL, `false OR NULL` is NULL, and a CHECK passes on
  -- NULL. The first version of this constraint used array_length and accepted an enum
  -- switch with nothing to check values against — caught by testing it rather than by
  -- reading it. cardinality('{}') is 0, which is the answer the constraint needs.
  constraint switches_enum_has_values check (
    value_type <> 'enum' or cardinality(allowed_values) > 0
  ),
  constraint switches_dependency_is_complete check (
    (depends_on_switch is null and depends_on_value is null)
    or (depends_on_switch is not null and depends_on_value is not null)
  ),
  constraint switches_no_self_dependency check (depends_on_switch is distinct from id)
);

comment on table public.switches is
  'The ~59 facts about a company that determine which requirements apply. Reference data: '
  'global, readable by any authenticated user, written only by the service role. '
  'CHEMICAL-OR-WA.md §2.2 and §2.4.';

comment on column public.switches.scope is
  'company or site. A site-scoped switch is answered once per facility, because a '
  'company-wide answer to it is wrong at every site but one — and wrong confidently. '
  'DECISIONS.md §20.';


-- ------------------------------------------------------------
-- 3. company_switches — ONE COMPANY'S ANSWERS
--
-- Company data, so RLS applies.
--
-- THREE CONSTRAINTS DO THE REAL WORK HERE, and each closes a hole that would otherwise be
-- a convention nobody checks:
--
--   (a) foreign key (switch_id, scope) -> switches (id, scope)
--       `scope` is copied onto this table so a query can filter on it without a join. A
--       copy drifts the first time a library switch is reclassified from company to site.
--       The COMPOSITE key makes Postgres refuse the mismatch: you cannot store a value
--       claiming site scope against a switch defined as company scope.
--
--   (b) site_scope_has_a_site
--       A per-site switch with no site is the exact failure DECISIONS.md §20 warns about.
--       Here it is unrepresentable rather than merely discouraged.
--
--   (c) unique NULLS NOT DISTINCT (company_id, switch_id, entity_id)
--       Postgres treats two NULLs as different by default, so a plain unique constraint
--       would happily allow two conflicting company-wide values for employee_count —
--       precisely on the rows most likely to be written twice. Postgres 15+; we are on
--       17.6. NOTE the clause order: in a TABLE CONSTRAINT it goes after UNIQUE and before
--       the column list. In CREATE INDEX it goes after the column list. Getting that
--       backwards is a syntax error, and it cost a failed migration on 11 Sep.
--
-- `value` is TEXT and stays text, for every switch, including the ones that look like
-- numbers or booleans. `switches.value_type` says how to read it. DECISIONS.md §23.1
-- settles the one case that tempted an array: multi-value switches decompose instead.
-- ------------------------------------------------------------

create table public.company_switches (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  switch_id     text not null,
  scope         public.switch_scope not null,
  entity_id     uuid references public.entities(id) on delete cascade,

  value         text,

  -- Defaults to `unknown`, the safe direction: a row written without a state shows as an
  -- open question, never as a clear. CLAUDE.md §3.2.
  state         public.switch_state not null default 'unknown',
  confidence    public.switch_confidence,

  -- The sentence this was derived from, verbatim. "SDS inventory shows 1,400 lb methylene
  -- chloride; manifest log shows ~180 kg/month waste generation." Without it a user cannot
  -- tell a correct answer from a lucky one, and correcting a switch is the highest-leverage
  -- thing they can do (CHEMICAL-OR-WA.md §6.4).
  basis         text,
  source        public.switch_value_source,

  determined_at timestamptz,

  -- An expired switch reverts to `unknown`, not to its last value. Enforced in the
  -- resolution engine, not here — a column cannot express "on read, if past this date,
  -- pretend you do not know". The column is what makes that check possible.
  expires_at    timestamptz,

  -- A user who has corrected a fact must not have it overwritten by the next document
  -- scan that disagrees.
  user_locked   boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint company_switches_switch_scope_fkey
    foreign key (switch_id, scope) references public.switches(id, scope),

  constraint company_switches_site_scope_has_a_site check (
    (scope = 'company' and entity_id is null)
    or (scope = 'site' and entity_id is not null)
  ),

  constraint company_switches_one_value_per_scope
    unique nulls not distinct (company_id, switch_id, entity_id)
);

comment on column public.company_switches.value is
  'Always text. switches.value_type says how to read it. Multi-value switches decompose '
  'into one switch per value rather than becoming an array — DECISIONS.md §23.1, because '
  'applies_expression has to be able to name a fact directly.';


-- ------------------------------------------------------------
-- 4. industry_coverage — WHAT WE HAVE ACTUALLY BUILT
--
-- Reference data. It routes the pipeline, renders the coverage strip, and IS the library
-- build queue — DECISIONS.md §6, "coverage is data, not a code branch".
--
-- *** HOW THE THREE TIERS ARE EXPRESSED, BECAUSE IT IS NOT ONE COLUMN AND NOT A BOOLEAN ***
--
--   Tier 1, full library   rows exist with status generated or verified, row_count > 0.
--                          The pipeline reasons against known requirement rows.
--
--   Tier 2, agency list    rows exist naming the agencies, all still `not_built`.
--   only                   The pipeline works through regulators one at a time. Worse
--                          than tier 1, substantially better than nothing.
--
--   Tier 3, nothing        NO ROWS AT ALL for that industry x jurisdiction. We do not
--                          even know who regulates them. Free enumeration — the mode that
--                          produced the B- answer and invented a requirement.
--
-- So tier 3 is the ABSENCE of rows, which is why `status` alone cannot carry it and why
-- agency_id is NOT NULL: a coverage row is always a claim about one named regulator. The
-- day OLCC rows land, cannabis answers improve with no deploy and no feature flag.
-- ------------------------------------------------------------

create table public.industry_coverage (
  id                  uuid primary key default gen_random_uuid(),
  industry            text not null,
  jurisdiction_state  text,                    -- null = the federal layer, which serves every state
  agency_id           uuid not null references public.agencies(id) on delete cascade,

  status              public.coverage_status not null default 'not_built',
  row_count           integer not null default 0,
  last_verified_at    timestamptz,
  verified_by         text,
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint industry_coverage_unique
    unique nulls not distinct (industry, jurisdiction_state, agency_id),

  constraint industry_coverage_verified_has_rows check (
    status = 'not_built' or row_count > 0
  )
);

comment on table public.industry_coverage is
  'industry x jurisdiction x agency -> how far we have got. Reads the same way to the '
  'pipeline and to the user: the coverage strip is this table rendered. Empty until the '
  'agencies table is populated (Phase 2.1), because every row names an agency.';


-- ------------------------------------------------------------
-- 5. library_candidates — WHAT WE WERE ASKED FOR AND DID NOT HAVE
--
-- Every requirement the pipeline produced with no library behind it, counted. A real
-- operator using the product for six months produces a usage-ranked, operator-validated
-- build queue — the design partner becomes the library generator (DECISIONS.md §6).
--
-- *** THIS IS OURS, NOT THE CUSTOMER'S. ***
-- No company_id, and no grant to `authenticated` at all. Two companies in the same
-- industry asking the same unanswered question must land on the SAME row so times_seen
-- counts across all of them — that is the entire value of the table, and a company_id
-- would split the count and make the queue useless. It is a build queue for us, not
-- customer data, so no user should read it and none can.
--
-- normalized_name is a separate column from raw_name and is the unique key. Without it
-- times_seen never increments, because no two model outputs phrase a requirement
-- identically and every occurrence would insert a new row.
-- ------------------------------------------------------------

create table public.library_candidates (
  id                  uuid primary key default gen_random_uuid(),
  industry            text not null,
  jurisdiction_state  text,

  normalized_name     text not null,   -- lowercased, punctuation-stripped: the dedupe key
  raw_name            text not null,   -- what the model actually said, for reading

  citation_guess      text,
  agency_guess        text,

  times_seen          integer not null default 1,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),

  -- Vocabulary NOT settled anywhere, so text rather than a guessed enum — the same
  -- reasoning as cadence_type in DECISIONS.md §22.4. It becomes an enum once the queue
  -- has been worked through once and the states are known rather than imagined.
  status              text not null default 'new',
  operator_feedback   text,

  promoted_to_requirement_id uuid references public.requirement_templates(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint library_candidates_unique
    unique nulls not distinct (industry, jurisdiction_state, normalized_name)
);


-- ------------------------------------------------------------
-- 6. jobs — THE WORKER'S QUEUE
--
-- The table IS the queue. Poll loop, no queue service (CLAUDE.md §4).
--
-- *** company_id IS NULLABLE, AND THAT HAS AN RLS CONSEQUENCE WORTH STATING RATHER THAN
-- *** LEAVING TO BE DISCOVERED.
--
-- Document jobs belong to a company. LIBRARY jobs do not — library generation is for an
-- industry and a jurisdiction, and requirement_templates has no company_id at all. So
-- company_id is null on those rows, and a company-scoped policy CANNOT express a row with
-- no company: `company_id = auth_company_id()` is never true when company_id is NULL.
--
--   ==> LIBRARY JOBS ARE INVISIBLE TO EVERY AUTHENTICATED USER. Only the service role,
--   ==> which bypasses RLS, can see or touch them. That is correct — they are our work,
--   ==> not a customer's — but it is not obvious from reading the policy, and someone
--   ==> will eventually wonder why a job they can see in the dashboard returns nothing
--   ==> through the API. This is why.
--
-- *** SERIALIZATION LIVES IN THE TABLE, NOT ONLY IN THE WORKER. ***
--
-- PATTERNS.md §5 shows how BizPulses does it: select the in-flight org ids, then exclude
-- them from the next query. That is a read-then-act sequence with no lock, and CLAUDE.md
-- §4 says never assume a single worker instance — two workers polling at the same moment
-- both see the same empty in-flight set and both claim.
--
-- serialization_key plus a partial unique index turns that race into a constraint
-- violation. The key is `company:<uuid>` for document work and
-- `library:<industry>:<jurisdiction>` for library work, so the rule CLAUDE.md §4 states in
-- prose — serialize per company for document jobs, per industry + jurisdiction for library
-- jobs — is the same rule the database enforces. A second worker gets an error instead of
-- a duplicate, which is the ✚ improvement on the pattern being ported.
-- ------------------------------------------------------------

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  job_type          public.job_type not null,
  status            public.job_status not null default 'pending',

  company_id        uuid references public.companies(id) on delete cascade,  -- NULL for library jobs

  serialization_key text not null,

  payload           jsonb not null default '{}',
  result            jsonb,

  -- Written after classification and after each chunk, and polled by the browser. Without
  -- it the user gets nothing at all for the duration of a multi-minute run — recorded as
  -- an audit-engine finding before the worker exists, so the worker ships with it rather
  -- than rediscovering it afterwards.
  progress_message  text,

  attempts          integer not null default 0,
  max_attempts      integer not null default 3,

  -- Checked immediately before every irreversible step (CLAUDE.md §4). A flag rather than
  -- a status so that requesting a cancellation cannot itself drag a running job backwards.
  cancel_requested  boolean not null default false,

  -- What stuck-job clearing measures. Without it "stuck" has no definition and the clear
  -- step at the top of every cycle is guesswork.
  heartbeat_at      timestamptz,

  -- Two messages, two audiences — CLAUDE.md §5. response_message is plain language and is
  -- always written, on success AND failure. error_message is technical, and for a parse
  -- failure it carries the first 3000 characters of the raw model response so a bad
  -- extraction is diagnosable from the database days later.
  response_message  text,
  error_message     text,

  scheduled_for     timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint jobs_attempts_within_limit check (attempts <= max_attempts),
  constraint jobs_finished_after_started check (
    finished_at is null or started_at is null or finished_at >= started_at
  )
);

comment on column public.jobs.company_id is
  'NULL for library jobs, which belong to an industry and jurisdiction rather than a '
  'customer. Consequence: the company-scoped SELECT policy never matches them, so library '
  'jobs are invisible to every authenticated user and visible only to the service role.';

comment on column public.jobs.serialization_key is
  'company:<uuid> for document work, library:<industry>:<jurisdiction> for library work. '
  'The partial unique index on running rows makes two workers claiming the same key a '
  'constraint violation rather than a lost race. CLAUDE.md §4 — never assume one worker.';


-- ------------------------------------------------------------
-- 7. GRANTS
--
-- GRANT is not automatic (CLAUDE.md §3.6). anon gets nothing anywhere — migration 004
-- revoked every anon grant and no new table may quietly return one.
--
-- *** NOT GRANTING IS NOT THE SAME AS DENYING, AND THIS FILE PROVED IT. ***
--
-- This project carries DEFAULT PRIVILEGES on the public schema — pg_default_acl rows for
-- both `postgres` and `supabase_admin` — that grant anon, authenticated AND service_role
-- everything on any table created there, before a single GRANT statement runs. So the
-- first version of this migration simply omitted library_candidates from the grant list,
-- and `authenticated` held full DML on it anyway. Section 11's own check caught that on
-- the first run and refused the migration.
--
-- Closing a table therefore takes an explicit REVOKE, not an absent GRANT. That is also
-- why the anon revokes below are load-bearing rather than decorative: migration 004
-- revoked every anon grant in the database, and the default privileges hand them straight
-- back on every new table ever created.
-- ------------------------------------------------------------

grant all on public.switches           to authenticated, service_role;
grant all on public.company_switches   to authenticated, service_role;
grant all on public.industry_coverage  to authenticated, service_role;
grant all on public.jobs               to authenticated, service_role;
grant all on public.library_candidates to service_role;

revoke all on public.switches           from anon;
revoke all on public.company_switches   from anon;
revoke all on public.industry_coverage  from anon;
revoke all on public.jobs               from anon;
revoke all on public.library_candidates from anon;

-- The one that has to be said out loud: library_candidates is OUR build queue. No signed-in
-- user should hold any privilege on it, and the default privileges gave them one.
revoke all on public.library_candidates from authenticated;


-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
--
-- Every company-scoped policy goes through auth_company_id(), never a repeated subquery
-- against profiles. Explicit WITH CHECK on every INSERT and UPDATE.
--
-- switches and industry_coverage are reference data: readable by anyone signed in, written
-- only by the service role, which means no INSERT/UPDATE/DELETE policy exists for them at
-- all. library_candidates gets RLS with NO POLICIES WHATSOEVER — RLS with no policy denies
-- everything, which combined with no grant to authenticated is belt and braces on a table
-- no user should ever reach.
--
-- jobs is readable by the owning company so a browser can poll progress_message, and
-- writable by nobody but the service role. A user may request a cancellation through a
-- route that holds the service-role key; they may not update the row directly, because
-- then they could drag a finished job backwards.
-- ------------------------------------------------------------

alter table public.switches           enable row level security;
alter table public.company_switches   enable row level security;
alter table public.industry_coverage  enable row level security;
alter table public.library_candidates enable row level security;
alter table public.jobs               enable row level security;

create policy "switches readable by authenticated users"
  on public.switches for select to authenticated using (true);

create policy "industry_coverage readable by authenticated users"
  on public.industry_coverage for select to authenticated using (true);

create policy company_switches_select on public.company_switches
  for select to authenticated using (company_switches.company_id = public.auth_company_id());
create policy company_switches_insert on public.company_switches
  for insert to authenticated with check (company_switches.company_id = public.auth_company_id());
create policy company_switches_update on public.company_switches
  for update to authenticated using (company_switches.company_id = public.auth_company_id())
                                with check (company_switches.company_id = public.auth_company_id());
create policy company_switches_delete on public.company_switches
  for delete to authenticated using (company_switches.company_id = public.auth_company_id());

-- SELECT only. Library jobs have a NULL company_id, so this never matches them.
create policy jobs_select on public.jobs
  for select to authenticated using (jobs.company_id = public.auth_company_id());


-- ------------------------------------------------------------
-- 9. INDEXES
-- ------------------------------------------------------------

create index idx_switches_scope on public.switches (scope);
create index idx_switches_depends_on on public.switches (depends_on_switch);

create index idx_company_switches_company on public.company_switches (company_id);
create index idx_company_switches_entity on public.company_switches (entity_id);
create index idx_company_switches_switch on public.company_switches (switch_id);

-- Finding what has gone stale is a product behaviour, not a report: an expired switch
-- reverts to unknown, and the requirements it gates become open questions again.
create index idx_company_switches_expiry on public.company_switches (company_id, expires_at)
  where expires_at is not null;

create index idx_industry_coverage_lookup on public.industry_coverage (industry, jurisdiction_state);
create index idx_industry_coverage_agency on public.industry_coverage (agency_id);

create index idx_library_candidates_queue on public.library_candidates (times_seen desc, industry);

create index idx_jobs_company on public.jobs (company_id);

-- The claim query: oldest pending job that is due. Partial, because a queue is mostly
-- finished rows and the worker only ever asks about pending ones.
create index idx_jobs_claim on public.jobs (scheduled_for) where status = 'pending';

-- *** SERIALIZATION, ENFORCED. ***
-- At most one RUNNING job per serialization key. Two workers racing for the same company's
-- documents, or the same industry's library, get a unique violation instead of both
-- proceeding. Partial on `running` so finished jobs never block a later one.
create unique index idx_jobs_one_running_per_key on public.jobs (serialization_key)
  where status = 'running';


-- ------------------------------------------------------------
-- 10. updated_at TRIGGERS
--
-- set_updated_at() came from 006 and survives; the triggers attach per table.
-- ------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['switches','company_switches','industry_coverage','library_candidates','jobs'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()', t);
  end loop;
end $$;


-- ------------------------------------------------------------
-- 11. VERIFY
-- ------------------------------------------------------------

do $$
declare n integer;
begin
  select count(*) into n from pg_tables where schemaname = 'public'
   and tablename in ('switches','company_switches','industry_coverage','library_candidates','jobs');
  if n <> 5 then raise exception 'MIGRATION 008: expected 5 new tables, found %', n; end if;

  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relrowsecurity
     and c.relname in ('switches','company_switches','industry_coverage','library_candidates','jobs');
  if n <> 5 then raise exception 'MIGRATION 008: RLS is not enabled on all five, only %', n; end if;

  -- library_candidates must have RLS on and NO policies. If a future migration adds one,
  -- that is a decision to expose our build queue to customers and should be argued first.
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'library_candidates';
  if n <> 0 then raise exception 'MIGRATION 008: library_candidates has % policy/policies. It is our build queue, not customer data.', n; end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'jobs' and cmd <> 'SELECT') then
    raise exception 'MIGRATION 008: jobs has a write policy. Only the service role writes the queue.';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon'
       and table_name in ('switches','company_switches','industry_coverage','library_candidates','jobs')
  ) then
    raise exception 'MIGRATION 008: anon holds a grant on a new table. 004 revoked all of them.';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'authenticated' and table_name = 'library_candidates'
  ) then
    raise exception 'MIGRATION 008: authenticated holds a grant on library_candidates.';
  end if;

  raise notice 'MIGRATION 008 OK: 5 tables, RLS on all five, library_candidates closed, jobs read-only to users, anon holds nothing.';
end $$;
