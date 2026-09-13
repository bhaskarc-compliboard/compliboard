-- ============================================================
-- COMPLIBOARD — MIGRATION 019: REVOKE EXECUTE ON substance_inventory FROM PUBLIC
-- ============================================================
--
-- *** THIS IS A SECURITY FIX. ***  It closes AUDIT-CHECKS.md check 22, and it is its own
-- migration so that the filename says so. It spent one commit as the unnamed second half of
-- `018_basis_is_structured`, where it was invisible to anyone reading the file list — which is
-- exactly how a pre-flight lost it. DECISIONS.md §56.
--
-- WHY IT WAS OPEN.  Migration 013 created `substance_inventory()` with no revoke, and
-- **Postgres grants EXECUTE on every new function to PUBLIC by default.** CLAUDE.md §3.6
-- records "not granting is not denying" for TABLES; the same default exists for FUNCTIONS and
-- is written down nowhere.
--
-- WHY IT LEAKED NOTHING, AND WHY THAT IS NOT A REASON TO LEAVE IT.  The function is
-- SECURITY INVOKER and reads `company_chemicals`, on which `anon` holds no grant, so an
-- unauthenticated call returns nothing. **The protection is therefore a TABLE grant rather
-- than the function grant** — a compensating control, which DECISIONS.md §45 says must be
-- named and tested or it is a belief. This removes the reliance rather than documenting it.
--
-- IDEMPOTENT. Revoking a grant that is already absent is a no-op, so this is safe on a
-- database where the combined 018 already ran.
-- ============================================================

revoke all on function public.substance_inventory(uuid, text) from public;
revoke all on function public.substance_inventory(uuid, text) from anon;
revoke all on function public.substance_inventory(uuid, text) from authenticated;
grant execute on function public.substance_inventory(uuid, text) to service_role;

-- ------------------------------------------------------------
-- VERIFY — from pg_proc.proacl, NOT information_schema.role_routine_grants.
-- That view is filtered to roles the CALLER belongs to and returns zero rows here, so a check
-- written against it passes vacuously. AUDIT-CHECKS.md check 22 records the trap.
-- ------------------------------------------------------------
do $$
declare bad bigint;
begin
  select count(*) into bad
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
   where ns.nspname = 'public' and p.proname = 'substance_inventory'
     and a.privilege_type = 'EXECUTE' and a.grantee = 0;          -- grantee 0 IS PUBLIC
  if bad > 0 then
    raise exception 'MIGRATION 019 FAILED: PUBLIC still holds EXECUTE on substance_inventory.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
     where ns.nspname='public' and p.proname='substance_inventory'
       and a.privilege_type='EXECUTE' and pg_get_userbyid(a.grantee) = 'service_role') then
    raise exception 'MIGRATION 019 FAILED: service_role cannot execute substance_inventory.';
  end if;
  raise notice 'MIGRATION 019 OK: EXECUTE on substance_inventory is service_role only.';
end $$;
