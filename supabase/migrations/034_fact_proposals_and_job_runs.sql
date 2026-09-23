-- ============================================================
-- COMPLIBOARD — MIGRATION 034: WHAT THE NIGHT READS, AND WHETHER IT RAN
-- ============================================================
--
-- Two tables for the nightly jobs.
--
-- ------------------------------------------------------------
-- 1. fact_proposals — THE NIGHTLY READER PROPOSES. IT NEVER WRITES A FACT.
--
-- §108, stated as a table rather than as an intention: facts inferred from free conversation are
-- **proposed to the customer, not written**. `company_switches` is what the product reasons
-- against; a value inferred from prose landing there directly is the failure §108 exists to
-- stop — the same fact, the same facility, two labels in one conversation (§104).
--
-- So the job writes HERE, with the turn it came from, and a human moves it or does not. There is
-- deliberately NO path from this table to `company_switches` in this migration or in the jobs.
-- ------------------------------------------------------------
create table if not exists public.fact_proposals (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  topic_id     uuid not null references public.topics(id) on delete cascade,
  -- The switch this is a candidate value FOR. Text, not a foreign key to `switches`: a
  -- conversation can suggest something the vocabulary does not have a switch for yet, and that
  -- is worth keeping rather than refusing at write time. Validating it against `switches`
  -- happens when a person acts on the proposal, where a bad key is visible.
  switch_key   text not null,
  proposed_value text not null,
  -- WHERE IT CAME FROM. Without this a proposal is an assertion with no provenance, which is
  -- the shape §3.3 warns about: a model enumerating from nothing. ON DELETE SET NULL because
  -- the turn is cleared after 7 days and the proposal outlives it.
  from_turn_id uuid references public.turns(id) on delete set null,
  -- The sentence the proposal was read out of, copied at write time. The turn it points at will
  -- be deleted; without this the proposal becomes unreviewable the moment the transcript goes.
  quote        text,
  status       text not null default 'proposed'
                 check (status in ('proposed', 'accepted', 'rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.fact_proposals is
  'Candidate company facts read out of a conversation overnight. PROPOSED, never written to '
  'company_switches — DECISIONS.md §108. The quote is copied because the turn it came from is '
  'cleared after 7 days.';

create index if not exists idx_fact_proposals_company_status
  on public.fact_proposals (company_id, status, created_at desc);
create index if not exists idx_fact_proposals_topic on public.fact_proposals (topic_id);

create trigger set_updated_at_fact_proposals
  before update on public.fact_proposals
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. job_runs — "DID IT RUN, AND WHAT DID IT TOUCH"
--
-- §116's second release gate, as a table. A retention promise on screen with nothing enforcing
-- it is a false statement to a customer; a deletion job with no record of having run is the
-- same statement one step removed. This makes the question answerable from the database rather
-- than from a log nobody has kept.
--
-- NOT company-scoped, deliberately: a nightly job runs across every tenant, and a row per
-- company would turn one run into hundreds of rows answering a question nobody asked. That is
-- also why it is closed to `authenticated` entirely — it is operational, not tenant data, and
-- a row here names other companies' topic counts.
-- ------------------------------------------------------------
create table if not exists public.job_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null check (job in ('summarise', 'delete', 'account_delete')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  -- What it touched, per job. jsonb rather than columns because the three jobs count different
  -- things and a shared column set would be mostly NULL and mostly misread.
  counts      jsonb not null default '{}'::jsonb,
  -- Per-item failures. One topic failing must not stop the others (§125), so failures are
  -- collected here rather than thrown — a run that processed 40 of 41 topics is a successful
  -- run with one recorded error, and that distinction is the reason this column exists.
  errors      jsonb not null default '[]'::jsonb,
  ok          boolean
);

comment on table public.job_runs is
  'One row per nightly run. Answers release gate 2 — did it run, and what did it remove '
  '(DECISIONS.md §116, §125). Operational, not tenant data: closed to authenticated.';
comment on column public.job_runs.errors is
  'Per-item failures. A run that processed 40 of 41 topics is a successful run with one error.';

create index if not exists idx_job_runs_job_started on public.job_runs (job, started_at desc);

-- ------------------------------------------------------------
-- 3. GRANTS — REVOKE FIRST, BOTH ROLES (CLAUDE.md §3.6).
-- ------------------------------------------------------------
revoke all on table public.fact_proposals from anon;
revoke all on table public.fact_proposals from authenticated;
-- A customer SEES their proposals and ACTS on them (accept / reject), so SELECT and UPDATE.
-- No INSERT: proposals come from the nightly reader, and a tenant inserting one would be
-- asserting a fact about themselves through a channel designed to require review.
-- No DELETE: rejecting is a status, not a disappearance — "we looked at this and said no" is
-- worth keeping, and a deleted proposal would be re-proposed on the next run.
grant select, update on table public.fact_proposals to authenticated;
grant all on table public.fact_proposals to service_role;

revoke all on table public.job_runs from anon;
revoke all on table public.job_runs from authenticated;
grant all on table public.job_runs to service_role;

alter table public.fact_proposals enable row level security;
alter table public.job_runs enable row level security;

drop policy if exists fact_proposals_select_own_company on public.fact_proposals;
create policy fact_proposals_select_own_company on public.fact_proposals
  for select to authenticated
  using (public.fact_proposals.company_id = public.auth_company_id());

drop policy if exists fact_proposals_update_own_company on public.fact_proposals;
create policy fact_proposals_update_own_company on public.fact_proposals
  for update to authenticated
  using (public.fact_proposals.company_id = public.auth_company_id())
  with check (public.fact_proposals.company_id = public.auth_company_id());

-- `job_runs` gets RLS with NO policies: service_role bypasses RLS, so the jobs still write;
-- any role that later acquires a grant by accident finds a table with no policy and no rows.

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare
  n int;
  v text;
  t text;
begin
  foreach t in array array['fact_proposals', 'job_runs'] loop
    foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege('anon', 'public.' || t, v) then
        raise exception 'MIGRATION 034 FAILED: anon holds % on %.', v, t;
      end if;
    end loop;
  end loop;

  foreach v in array array['SELECT', 'UPDATE'] loop
    if not has_table_privilege('authenticated', 'public.fact_proposals', v) then
      raise exception 'MIGRATION 034 FAILED: authenticated lacks % on fact_proposals.', v;
    end if;
  end loop;
  foreach v in array array['INSERT', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.fact_proposals', v) then
      raise exception 'MIGRATION 034 FAILED: authenticated holds % on fact_proposals, never granted.', v;
    end if;
  end loop;

  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.job_runs', v) then
      raise exception 'MIGRATION 034 FAILED: authenticated holds % on job_runs, which is operational.', v;
    end if;
  end loop;

  select count(*) into n from pg_policies where schemaname='public' and tablename='fact_proposals';
  if n <> 2 then raise exception 'MIGRATION 034 FAILED: expected 2 policies on fact_proposals, found %.', n; end if;

  select count(*) into n from pg_policies where schemaname='public' and tablename='job_runs';
  if n <> 0 then raise exception 'MIGRATION 034 FAILED: job_runs should have no policies, found %.', n; end if;

  -- THE job CHECK, TESTED BY VIOLATING IT (§3.7).
  begin
    insert into public.job_runs (job) values ('tidy_up');
    raise exception 'MIGRATION 034 FAILED: job accepted a value outside (summarise, delete, account_delete).';
  exception when check_violation then null;
  end;

  raise notice 'MIGRATION 034 OK: fact_proposals (authenticated SELECT+UPDATE only) and job_runs (closed, no policies); job name constraint refuses an unknown value.';
end $$;
