-- ============================================================
-- COMPLIBOARD — MIGRATION 023: A SIGNED-IN CALLER MAY COMPUTE THEIR OWN OBLIGATIONS
-- ============================================================
--
-- WHY.  `/api/obligations` computes a company's requirements on the first GET (Phase 4.3,
-- DECISIONS.md §62) and connects AS THE CALLER — `requireCompany()` returns a client built
-- from the anon key plus the request's own token, so RLS applies (CLAUDE.md §3.6). That is
-- right and is not what changes here.
--
-- What is wrong is that the two functions it calls are executable only by `service_role`:
--
--     close_and_replace_obligations : EXECUTE -> postgres, service_role     (016)
--     substance_inventory           : EXECUTE -> postgres, service_role     (019)
--
-- So the route's first write fails with `42501 permission denied for function
-- close_and_replace_obligations` and returns 500, and it fails for EVERY company whose
-- obligations have never been computed — which on production is all ten of them.
--
-- *** IT HAD NEVER BEEN RUN THROUGH THE ROUTE. *** Phase 4.3's write was proved by a script
-- holding the service-role key. That set `obligations_computed_at`, so every later request
-- found it non-NULL and skipped the write. The measurement was real and the path it measured
-- was not the one customers use. DECISIONS.md §63.
--
-- ------------------------------------------------------------
-- THE CHOICE, AND WHY IT IS THIS ONE
-- ------------------------------------------------------------
--
-- Two ways to fix it:
--
--   (a) give the route a named service-role client for these two statements, or
--   (b) let the CALLER execute them, with their identity validated.
--
-- **(b), because (a) moves a tenant-scoped write off the security boundary.** CLAUDE.md §3.6:
-- RLS is the boundary and route guards are a UX affordance. A service-role client computing
-- obligations would carry out a per-tenant write with policies disabled, and the only thing
-- standing between one company's data and another's would be a `companyId` variable in
-- TypeScript. That is precisely the shape §3.6 exists to refuse. The service-role exceptions
-- in this project are all statements with NO session (`signup`, `industries`) or admin calls
-- with no table equivalent (`auth.admin.deleteUser`). This is neither.
--
-- Under (b) the protection is layered, and the order matters:
--
--   1. GRANT — only `authenticated` may call it at all; `anon` gets nothing.
--   2. THE NEW GUARD BELOW — `p_company_id` must BE the caller's company. A signed-in user
--      passing someone else's id is refused by name, loudly, before any row is touched.
--   3. RLS — the function is SECURITY INVOKER, so `obligations_insert` / `_update` are
--      evaluated as the caller regardless. Even if the guard were removed, a cross-tenant
--      write would affect zero rows.
--
-- Guard 2 is not what makes this safe; layer 3 is. Guard 2 is what turns a silent zero-row
-- update into an error somebody can read — CLAUDE.md §5, never silent.
--
-- ------------------------------------------------------------
-- WHY THE GUARD IS CONDITIONAL ON auth.uid()
-- ------------------------------------------------------------
--
-- `service_role` and `postgres` have no `auth.uid()` and no row in `profiles`, so
-- `auth_company_id()` returns NULL for them. An unconditional equality check would therefore
-- break every script, the seed tooling and the future worker — all of which legitimately act
-- for a company without being a user. The guard applies when there IS a user, which is
-- exactly when it has something to check.
--
-- NOT CHANGED HERE: `substance_inventory` keeps its own tenancy through RLS on
-- `company_chemicals` rather than through a guard. It is `LANGUAGE sql STABLE` and SECURITY
-- INVOKER, so an entity belonging to another company reads zero chemical rows and returns
-- NULL — "unknown", which is the honest answer to a question about a site we can see nothing
-- of, and not a leak. That reliance is a compensating control, so it is NAMED and TESTED
-- (AUDIT-CHECKS.md check 22) rather than assumed — DECISIONS.md §45.
-- ============================================================

-- ------------------------------------------------------------
-- 1. THE GUARD. Everything else in the function is unchanged from 016; this adds one block
--    immediately after the existing null check and before any other work.
-- ------------------------------------------------------------

create or replace function public.close_and_replace_obligations(
  p_company_id   uuid,
  p_obligations  jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bad        bigint;
  v_closed     bigint;
  v_touched    bigint;
  v_opened     bigint;
  v_open_total bigint;
  v_caller     uuid;
begin
  if p_company_id is null then
    raise exception 'close_and_replace_obligations: p_company_id is required';
  end if;

  -- *** THE CALLER MAY ONLY REPLACE THEIR OWN COMPANY'S OBLIGATIONS. ***
  -- Skipped when there is no user (service_role, the CLI, the future worker): those callers
  -- are restricted by the GRANT instead, and have no company of their own to compare against.
  if auth.uid() is not null then
    v_caller := public.auth_company_id();
    if v_caller is null then
      raise exception 'close_and_replace_obligations: caller has no company (no profiles row)';
    end if;
    if v_caller <> p_company_id then
      raise exception 'close_and_replace_obligations: caller belongs to company %, not %',
        v_caller, p_company_id;
    end if;
  end if;

  if p_obligations is null or jsonb_typeof(p_obligations) <> 'array' then
    raise exception 'close_and_replace_obligations: p_obligations must be a JSON array, got %',
      coalesce(jsonb_typeof(p_obligations), 'null');
  end if;

  -- ----------------------------------------------------------
  -- GUARDS. All of them run BEFORE anything is written, so a refused call leaves the
  -- company's obligations exactly as they were rather than half-closed.
  --
  -- *** AN EMPTY ARRAY IS A VALID PAYLOAD AND ALWAYS WAS. *** Every guard below counts rows
  -- from `jsonb_array_elements`, which yields nothing for `[]`, so all three pass with zero.
  -- The close then closes everything open, the insert inserts nothing, and the company is
  -- left with an empty, COMPUTED list. That is the correct result for a company in an
  -- industry the library does not cover yet, and it is every vertical except chemical Oregon.
  -- ----------------------------------------------------------

  -- 1. TENANCY on the payload's entity ids. Distinct from the caller check above: that one
  --    asks who you are, this one asks whether the sites you named are yours.
  select count(*) into v_bad
    from jsonb_array_elements(p_obligations) x
    left join public.entities e on e.id = nullif(x->>'entity_id', '')::uuid
   where nullif(x->>'entity_id', '') is not null
     and (e.id is null or e.company_id <> p_company_id);
  if v_bad > 0 then
    raise exception 'close_and_replace_obligations: % obligation(s) name an entity that does not belong to company %',
      v_bad, p_company_id;
  end if;

  -- 2. The requirement must exist.
  select count(*) into v_bad
    from jsonb_array_elements(p_obligations) x
    left join public.requirement_templates rt on rt.id = (x->>'requirement_template_id')::uuid
   where rt.id is null;
  if v_bad > 0 then
    raise exception 'close_and_replace_obligations: % obligation(s) name a requirement_template that does not exist', v_bad;
  end if;

  -- 3. No duplicate (entity, requirement) pairs.
  select count(*) into v_bad from (
    select (x->>'requirement_template_id')::uuid as rtid, nullif(x->>'entity_id','')::uuid as eid
      from jsonb_array_elements(p_obligations) x
     group by 1, 2 having count(*) > 1) d;
  if v_bad > 0 then
    raise exception 'close_and_replace_obligations: payload names the same (entity, requirement) % time(s) over', v_bad;
  end if;

  create temporary table _incoming on commit drop as
  select (x->>'requirement_template_id')::uuid            as rtid,
         nullif(x->>'entity_id', '')::uuid                as eid,
         (x->>'status')::public.obligation_status         as status,
         coalesce(nullif(x->>'resolved_by',''), 'computed_by_code') as resolved_by,
         x->>'resolution_rationale'                       as rationale,
         coalesce(x->'determined_by', '{}'::jsonb)        as determined_by
    from jsonb_array_elements(p_obligations) x;

  update public.obligations o
     set applicable_to = current_date,
         updated_at    = now()
   where o.company_id = p_company_id
     and o.applicable_to is null
     and not exists (
       select 1 from _incoming i
        where i.rtid = o.requirement_template_id
          and i.eid is not distinct from o.entity_id
          and i.status = o.status);
  get diagnostics v_closed = row_count;

  update public.obligations o
     set last_verified_at = now(),
         updated_at       = now()
   where o.company_id = p_company_id
     and o.applicable_to is null
     and exists (
       select 1 from _incoming i
        where i.rtid = o.requirement_template_id
          and i.eid is not distinct from o.entity_id
          and i.status = o.status);
  get diagnostics v_touched = row_count;

  insert into public.obligations
    (company_id, entity_id, requirement_template_id, status, applicable_from,
     resolved_by, resolution_rationale, determined_by)
  select p_company_id, i.eid, i.rtid, i.status, current_date,
         i.resolved_by, i.rationale, i.determined_by
    from _incoming i
   where not exists (
     select 1 from public.obligations o
      where o.company_id = p_company_id
        and o.applicable_to is null
        and o.requirement_template_id = i.rtid
        and o.entity_id is not distinct from i.eid);
  get diagnostics v_opened = row_count;

  select count(*) into v_open_total
    from public.obligations
   where company_id = p_company_id and applicable_to is null;

  drop table _incoming;

  return jsonb_build_object(
    'closed', v_closed, 'unchanged', v_touched, 'opened', v_opened,
    'open_total', v_open_total, 'received', jsonb_array_length(p_obligations));
end $$;

-- ------------------------------------------------------------
-- 2. THE GRANTS. `create or replace function` RESETS the ACL to the default, which on this
--    database means the pg_default_acl rows hand EXECUTE back to PUBLIC — CLAUDE.md §3.6's
--    "not granting is not denying", in its function form. So the revoke is restated here and
--    is not redundant: without it, 023 would silently REOPEN what 019 closed.
-- ------------------------------------------------------------

revoke all on function public.close_and_replace_obligations(uuid, jsonb) from public;
revoke all on function public.close_and_replace_obligations(uuid, jsonb) from anon;
grant execute on function public.close_and_replace_obligations(uuid, jsonb) to authenticated;
grant execute on function public.close_and_replace_obligations(uuid, jsonb) to service_role;

revoke all on function public.substance_inventory(uuid, text) from public;
revoke all on function public.substance_inventory(uuid, text) from anon;
grant execute on function public.substance_inventory(uuid, text) to authenticated;
grant execute on function public.substance_inventory(uuid, text) to service_role;

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare n bigint;
begin
  -- anon holds nothing on either function.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, '{}')) a
   where ns.nspname = 'public'
     and p.proname in ('close_and_replace_obligations', 'substance_inventory')
     and a.privilege_type = 'EXECUTE'
     and (a.grantee = 0 or pg_get_userbyid(a.grantee) = 'anon');   -- grantee 0 IS PUBLIC
  if n > 0 then
    raise exception 'MIGRATION 023 FAILED: PUBLIC or anon holds EXECUTE on % function(s).', n;
  end if;

  -- authenticated holds EXECUTE on both, which is the whole point of this migration.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, '{}')) a
   where ns.nspname = 'public'
     and p.proname in ('close_and_replace_obligations', 'substance_inventory')
     and a.privilege_type = 'EXECUTE'
     and pg_get_userbyid(a.grantee) = 'authenticated';
  if n <> 2 then
    raise exception 'MIGRATION 023 FAILED: authenticated holds EXECUTE on % of 2 functions.', n;
  end if;

  -- The caller guard is present in the function body. Checked by text because there is no
  -- second session inside a migration to call it as.
  if position('caller belongs to company' in
       (select prosrc from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
         where ns.nspname = 'public' and p.proname = 'close_and_replace_obligations')) = 0 then
    raise exception 'MIGRATION 023 FAILED: the caller-identity guard is not in the function body.';
  end if;

  raise notice 'MIGRATION 023 OK: authenticated may compute its own obligations; anon holds nothing.';
end $$;
