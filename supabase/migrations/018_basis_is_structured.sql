-- ============================================================
-- COMPLIBOARD — MIGRATION 018: `basis` BECOMES STRUCTURED, AND ONE GRANT CLOSES
-- ============================================================
--
-- TWO UNRELATED CHANGES IN ONE FILE, and that is a deliberate trade rather than carelessness:
-- both are small, both close a recorded finding, and two migrations for twelve lines apiece is
-- churn in a chain that gets replayed from zero on every `npm run db:reset`. They are in
-- clearly separated sections with their own reasoning, and neither depends on the other.
--
-- ------------------------------------------------------------
-- PART 1 — WHY `basis` BECOMES jsonb.  DECISIONS.md §50.
-- ------------------------------------------------------------
-- `basis` answers "what does this switch value rest on". As text it cannot answer the two
-- questions that matter operationally — *which values rest on this document* and *what did we
-- actually read* — which is the identical argument migration 007 made for
-- `obligations.determined_by`, in its own header: free text "cannot answer either question
-- that matters operationally".
--
-- *** AND THE QUOTE IS THE POINT. *** Phase 7.2 writes a verbatim span from the document into
-- `basis`, and the strongest verification available in that phase is checking that span,
-- character by character, against the document it names. A quote buried in prose cannot be
-- extracted reliably; a quote in a field can. `docs/SWITCH-DETERMINATION.md` §10.3.
--
-- THE EXISTING ROWS ARE CONVERTED, NOT DROPPED. Sixteen rows on staging carry a plain string
-- from the multi-site fixture. Each becomes a `computed` basis with the old text preserved in
-- `reasoning`, so nothing that was written down is lost and every row is valid against the
-- shape the renderer expects.
--
-- ------------------------------------------------------------
-- PART 2 — WHY `substance_inventory` LOSES ITS PUBLIC GRANT.  AUDIT-CHECKS.md check 22.
-- ------------------------------------------------------------
-- Migration 013 created it with no revoke, and **Postgres grants EXECUTE on every new function
-- to PUBLIC by default.** CLAUDE.md §3.6 records "not granting is not denying" for tables; the
-- same default exists for functions and is written down nowhere.
--
-- It leaks nothing today — the function is SECURITY INVOKER and reads `company_chemicals`, on
-- which `anon` holds no grant, so an unauthenticated call returns nothing. **That means the
-- protection is a TABLE grant rather than the function grant**, which is exactly the
-- compensating-control shape DECISIONS.md §45 says must be named and tested or it is a belief.
-- This removes the reliance.
-- ============================================================

-- ------------------------------------------------------------
-- PART 1
-- ------------------------------------------------------------
alter table public.company_switches
  alter column basis type jsonb
  using case
    when basis is null then null
    -- Already structured (nothing is yet, but a re-run must be safe).
    when basis like '{%' then basis::jsonb
    else jsonb_build_object(
      'v', 1,
      'kind', 'computed',
      'at', to_char(coalesce(updated_at, created_at, now()), 'YYYY-MM-DD'),
      'reasoning', basis)
  end;

comment on column public.company_switches.basis is
  $c$WHAT THIS VALUE RESTS ON, structured. { v, kind: user_answer|document|computed, at, and
per-kind fields: question/previous_value · document_id/locator/quote/reasoning · computed_from }.
The sentence a person reads is produced by renderBasis() in lib/basis.ts and is NEVER stored —
one place to change the wording, and the two cannot drift. jsonb rather than text because prose
cannot answer "which switches rest on this document" and cannot yield a quote for
character-by-character checking against its source. DECISIONS.md §50.$c$;

-- ------------------------------------------------------------
-- PART 2
-- ------------------------------------------------------------
revoke all on function public.substance_inventory(uuid, text) from public;
revoke all on function public.substance_inventory(uuid, text) from anon;
revoke all on function public.substance_inventory(uuid, text) from authenticated;
grant execute on function public.substance_inventory(uuid, text) to service_role;

-- ------------------------------------------------------------
-- VERIFY — both parts attempted, not asserted.
-- ------------------------------------------------------------
do $$
declare t text; n bigint; bad bigint; ok boolean;
begin
  -- PART 1: the column is jsonb and every surviving row is valid against the shape.
  select udt_name into t from information_schema.columns
   where table_schema='public' and table_name='company_switches' and column_name='basis';
  if t <> 'jsonb' then
    raise exception 'MIGRATION 018 FAILED: basis is %, not jsonb.', t;
  end if;

  select count(*) into n from public.company_switches where basis is not null;
  select count(*) into bad from public.company_switches
   where basis is not null
     and (basis->>'v' is null or basis->>'kind' is null or basis->>'at' is null);
  if bad > 0 then
    raise exception 'MIGRATION 018 FAILED: % of % converted rows lack v, kind or at.', bad, n;
  end if;
  raise notice 'MIGRATION 018 OK: basis is jsonb; % row(s) converted and all well-formed.', n;

  -- A non-object must be refused by the cast, not silently stored.
  ok := false;
  begin
    update public.company_switches set basis = '"just a string"'::jsonb
     where id = (select id from public.company_switches limit 1);
    -- jsonb accepts a bare string, so this is a SHAPE check rather than a type check:
    -- the row must still fail the v/kind/at test above.
    if exists (select 1 from public.company_switches
                where basis is not null and basis->>'kind' is null) then ok := true; end if;
    raise exception '__mig018_rollback__';
  exception when others then
    if sqlerrm <> '__mig018_rollback__' then raise; end if;
  end;
  if not ok then
    raise notice 'MIGRATION 018 NOTE: no rows to shape-test against.';
  else
    raise notice 'MIGRATION 018 OK: a bare string in basis is detectable as malformed (rolled back).';
  end if;

  -- PART 2: PUBLIC must hold no EXECUTE on substance_inventory. Read from pg_proc.proacl,
  -- NOT from information_schema.role_routine_grants, which is caller-filtered and returns
  -- zero rows here — a check written against it passes vacuously (AUDIT-CHECKS check 22).
  select count(*) into bad
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
   where ns.nspname = 'public' and p.proname = 'substance_inventory'
     and a.privilege_type = 'EXECUTE' and a.grantee = 0;
  if bad > 0 then
    raise exception 'MIGRATION 018 FAILED: PUBLIC still holds EXECUTE on substance_inventory.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
     where ns.nspname='public' and p.proname='substance_inventory'
       and a.privilege_type='EXECUTE' and pg_get_userbyid(a.grantee) = 'service_role') then
    raise exception 'MIGRATION 018 FAILED: service_role cannot execute substance_inventory.';
  end if;
  raise notice 'MIGRATION 018 OK: EXECUTE on substance_inventory is service_role only.';
end $$;
