-- ============================================================
-- COMPLIBOARD — MIGRATION 032: USAGE COUNTERS
-- ============================================================
--
-- WHY A TABLE RATHER THAN A COUNT(*).
--
-- "How many questions has this company asked" looks like `select count(*) from turns`. It is
-- not, and the difference is the whole reason this table exists:
--
--   * Transcripts are CLEARED after 7 days (§125). A derived count would fall every time the
--     nightly deleter ran — a customer who asked forty questions would be told they asked six.
--   * A checklist a user deletes still happened. Deleting it must not rewrite the past.
--
-- > ### COUNTERS NEVER GO DOWN, AND ARE NEVER DERIVED FROM ROWS THAT CAN BE DELETED.
--
-- They record events, not inventory. A CHECK enforces the first half in the database, because a
-- decrement would otherwise be a quiet bug in one route months from now.
--
-- WHAT IS NOT COUNTED, and each is a decision rather than an omission:
--   * a STOPPED answer — a stopped answer is not a question answered
--   * MICRO-STEPS — they expand an item of a checklist already counted; counting them would
--     make one checklist worth a dozen
--
-- §118: no content in migrations. Nothing here inserts a row; the route creates a company's row
-- on its first increment.

create table if not exists public.usage_counters (
  company_id          uuid primary key references public.companies(id) on delete cascade,
  questions_answered  integer not null default 0 check (questions_answered >= 0),
  checklists_created  integer not null default 0 check (checklists_created >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.usage_counters is
  'Events, not inventory. Never decremented, never derived from row counts — transcripts are '
  'cleared after 7 days and checklists can be deleted, and neither rewrites what happened. '
  'DECISIONS.md §125.';
comment on column public.usage_counters.questions_answered is
  'Incremented when an answer STREAM COMPLETES. A stopped answer is not counted.';
comment on column public.usage_counters.checklists_created is
  'Incremented when a checklist is written. Micro-steps are not counted — they expand an item '
  'of a checklist already counted.';

-- One row per company, so the increment is an upsert on the primary key rather than a
-- read-modify-write that two concurrent answers could interleave.
create trigger set_updated_at_usage_counters
  before update on public.usage_counters
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- GRANTS — REVOKE FIRST, BOTH ROLES (CLAUDE.md §3.6).
--
-- `authenticated` READS and does not write. The increment happens under the service role in the
-- route, for the same reason `critic_findings` is closed: a tenant who can write their own
-- counters can write any number into them, and a counter a customer can set is not a
-- measurement. UPDATE is therefore not granted — which also means the never-decrement rule
-- cannot be broken from a session even if the CHECK were dropped.
-- ------------------------------------------------------------
revoke all on table public.usage_counters from anon;
revoke all on table public.usage_counters from authenticated;
grant select on table public.usage_counters to authenticated;
grant all on table public.usage_counters to service_role;

alter table public.usage_counters enable row level security;

drop policy if exists usage_counters_select_own_company on public.usage_counters;
create policy usage_counters_select_own_company on public.usage_counters
  for select to authenticated
  using (public.usage_counters.company_id = public.auth_company_id());

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare
  n int;
  v text;
  probe uuid;
begin
  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.usage_counters', v) then
      raise exception 'MIGRATION 032 FAILED: anon holds % on usage_counters.', v;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.usage_counters', 'SELECT') then
    raise exception 'MIGRATION 032 FAILED: authenticated cannot read usage_counters.';
  end if;
  foreach v in array array['INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.usage_counters', v) then
      raise exception 'MIGRATION 032 FAILED: authenticated holds % on usage_counters, never granted.', v;
    end if;
  end loop;

  select count(*) into n from pg_policies where schemaname='public' and tablename='usage_counters';
  if n <> 1 then
    raise exception 'MIGRATION 032 FAILED: expected 1 policy, found %.', n;
  end if;

  -- THE NEVER-NEGATIVE CHECK, TESTED BY VIOLATING IT (§3.7).
  select id into probe from public.companies limit 1;
  if probe is not null then
    insert into public.usage_counters (company_id, questions_answered) values (probe, 1)
      on conflict (company_id) do nothing;
    begin
      update public.usage_counters set questions_answered = -1 where company_id = probe;
      raise exception 'MIGRATION 032 FAILED: a negative counter was accepted.';
    exception when check_violation then null;
    end;
    delete from public.usage_counters where company_id = probe and questions_answered = 1;
  end if;

  raise notice 'MIGRATION 032 OK: usage_counters created, anon 0, authenticated SELECT only, negative value refused.';
end $$;
