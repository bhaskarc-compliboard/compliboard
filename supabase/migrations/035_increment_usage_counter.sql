-- ============================================================
-- COMPLIBOARD — MIGRATION 035: AN ATOMIC INCREMENT
-- ============================================================
--
-- WHY A FUNCTION AND NOT A ROUTE-SIDE UPDATE.
--
-- PostgREST cannot express `set questions_answered = questions_answered + 1`. Doing it from the
-- route means read, add one in JavaScript, write back — and two answers completing at the same
-- moment then produce +1 instead of +2. A counter that loses events under load is worse than no
-- counter, because it is wrong in the direction nobody checks.
--
-- One statement, in the database, where `+ 1` is atomic.
--
-- *** EXECUTE IS REVOKED FROM PUBLIC EXPLICITLY. ***
-- Postgres grants EXECUTE on every new function to PUBLIC by default. `CLAUDE.md` §3.6 records
-- "not granting is not denying" for TABLES; the same default exists for FUNCTIONS and cost this
-- project a finding once already — migration 013 created `substance_inventory()` with no revoke
-- and PUBLIC held EXECUTE until migration 019 (`AUDIT-CHECKS.md` check 22). This does not repeat
-- that: the revoke is here, in the same migration as the function.
--
-- Only `service_role` may call it. `authenticated` holds SELECT and nothing else on
-- `usage_counters` (migration 032) — a counter a tenant can write is not a measurement, and a
-- function they could call would be that write by another name.

create or replace function public.increment_usage_counter(
  p_company_id uuid,
  p_field      text
) returns void
language plpgsql
-- SECURITY INVOKER, the default, stated for the reader: the only caller is `service_role`,
-- which already bypasses RLS. DEFINER would add nothing and would make the function a way
-- around the grants above if EXECUTE ever leaked.
security invoker
as $$
begin
  -- The field is not interpolated into SQL. A `format('update ... set %I', p_field)` would be
  -- an injection surface for the sake of two branches, so the two branches are written out.
  if p_field = 'questions_answered' then
    update public.usage_counters
       set questions_answered = questions_answered + 1
     where company_id = p_company_id;
  elsif p_field = 'checklists_created' then
    update public.usage_counters
       set checklists_created = checklists_created + 1
     where company_id = p_company_id;
  else
    raise exception 'increment_usage_counter: unknown field %', p_field;
  end if;

  if not found then
    raise exception 'increment_usage_counter: no usage_counters row for company %', p_company_id;
  end if;
end $$;

comment on function public.increment_usage_counter(uuid, text) is
  'Atomic +1 on a usage counter. Counters record events and never go down (DECISIONS.md §125). '
  'service_role only.';

revoke all on function public.increment_usage_counter(uuid, text) from public;
revoke all on function public.increment_usage_counter(uuid, text) from anon;
revoke all on function public.increment_usage_counter(uuid, text) from authenticated;
grant execute on function public.increment_usage_counter(uuid, text) to service_role;

-- ------------------------------------------------------------
-- VERIFY — including the grant, read from the catalog rather than trusted.
-- ------------------------------------------------------------
do $$
declare
  probe uuid;
  before_n int;
  after_n int;
begin
  -- AUDIT-CHECKS check 22's query shape: grantee = 0 is PUBLIC, unambiguously. A LIKE on the
  -- ACL text would match `postgres=X/postgres` and report a false alarm.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join lateral aclexplode(p.proacl) a on true
    where n.nspname = 'public' and p.proname = 'increment_usage_counter'
      and (p.proacl is null or (a.privilege_type = 'EXECUTE' and a.grantee = 0))
  ) then
    raise exception 'MIGRATION 035 FAILED: PUBLIC holds EXECUTE on increment_usage_counter.';
  end if;

  if has_function_privilege('authenticated', 'public.increment_usage_counter(uuid, text)', 'EXECUTE') then
    raise exception 'MIGRATION 035 FAILED: authenticated can execute increment_usage_counter.';
  end if;
  if not has_function_privilege('service_role', 'public.increment_usage_counter(uuid, text)', 'EXECUTE') then
    raise exception 'MIGRATION 035 FAILED: service_role cannot execute increment_usage_counter.';
  end if;

  -- IT ACTUALLY INCREMENTS. A function nobody has called is a comment.
  select id into probe from public.companies limit 1;
  if probe is not null then
    insert into public.usage_counters (company_id) values (probe) on conflict (company_id) do nothing;
    select questions_answered into before_n from public.usage_counters where company_id = probe;
    perform public.increment_usage_counter(probe, 'questions_answered');
    select questions_answered into after_n from public.usage_counters where company_id = probe;
    if after_n <> before_n + 1 then
      raise exception 'MIGRATION 035 FAILED: increment moved % to %, expected %.', before_n, after_n, before_n + 1;
    end if;
    -- Put it back: a verify block must not leave a counted event that never happened.
    update public.usage_counters set questions_answered = before_n where company_id = probe;

    -- An unknown field is refused rather than silently doing nothing.
    begin
      perform public.increment_usage_counter(probe, 'not_a_counter');
      raise exception 'MIGRATION 035 FAILED: an unknown field was accepted.';
    exception when others then
      if sqlerrm not like '%unknown field%' then raise; end if;
    end;
  end if;

  raise notice 'MIGRATION 035 OK: increment_usage_counter created, PUBLIC and authenticated hold no EXECUTE, +1 proved and reverted.';
end $$;
