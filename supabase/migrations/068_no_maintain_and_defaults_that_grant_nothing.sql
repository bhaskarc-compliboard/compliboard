-- ===========================================================================
-- 068 — NO MAINTAIN FOR anon OR authenticated, AND DEFAULTS THAT GRANT THEM NOTHING
-- ===========================================================================
-- WHY. Two follow-ups to 067, both on the owner's instruction of 7 October 2026. 067 is already applied
-- on staging and is not edited; both go to production with it, in the same release.
--
-- 1. MAINTAIN — THE RIGHT OUR CHECKS COULD NOT SEE. Postgres 17 added MAINTAIN (the 'm' in an ACL):
--    VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW and LOCK TABLE on a table. After 067,
--    postgres's defaults still read `anon=arwdm, authenticated=arwdm`, and `scripts/schema-doc.js`,
--    `docs/SCHEMA.md` and `tests/unit/schemaGrants.test.ts` asked about seven rights, not eight — so all
--    three were blind to it. Read on staging before this was written: `authenticated` holds MAINTAIN on
--    the same 25 relations that held TRUNCATE (anon on none); service_role on 55, which is how the query
--    was shown to see a presence. A person holding it could LOCK a whole table — every company's rows —
--    and nothing in the app needs it. The data API cannot issue it; this closes the grant anyway.
--
-- 2. DEFAULTS THAT GRANT NOTHING. After 067 a table postgres creates in public still hands anon and
--    authenticated SELECT, INSERT, UPDATE, DELETE and MAINTAIN by default, and only each migration's
--    revoke-then-grant lines take them away (CLAUDE.md §3.6). This removes anon and authenticated from
--    postgres's defaults on public TABLES entirely, so a new table grants a person nothing until a
--    migration says so. service_role's defaults are unchanged.
--    · NOTHING EXISTING CHANGES: default privileges apply only to objects created later. Every existing
--      table keeps exactly the rights it has, and the verify block proves it against a snapshot.
--    · OUT OF SCOPE, recorded and unchanged: postgres's defaults on public SEQUENCES
--      (`anon=rwU, authenticated=rwU`) and FUNCTIONS (`anon=X, authenticated=X`); and supabase_admin's
--      defaults on public, which postgres may not change (it is not a member of supabase_admin; 067).
--    · FOR THE RECORD, not a change: of the 51 relations where authenticated holds a read or write right,
--      every right was granted explicitly by some migration except INSERT, UPDATE and DELETE on the VIEW
--      obligation_evidence_state (020:119 grants SELECT only). That view is not insertable or updatable
--      (information_schema.views: NO, NO), so the three are inert, and it keeps them. Were a table ever
--      dropped and recreated without its GRANT, a person would now get nothing — and check:live would say so.
--
-- WHAT IT DOES NOT TOUCH: SELECT, INSERT, UPDATE, DELETE on any existing relation for anyone;
-- service_role anywhere; any other schema.
-- ===========================================================================

begin;

-- ---- the snapshot, before anything changes: all eight rights of the three roles on every relation ----
create temp table _m068_before on commit drop as
select c.oid::regclass::text as rel, r.rolname as role, p.priv,
       has_table_privilege(r.rolname, c.oid, p.priv) as has
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
 cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                    ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) as p(priv)
 where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm');

-- ---- 1. MAINTAIN, revoked from people on every relation in public ----
do $$
declare rel text;
begin
  for rel in
    select c.oid::regclass::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  loop
    execute format('revoke maintain on table %s from anon, authenticated', rel);
  end loop;
end $$;

-- ---- 2. postgres's defaults on public tables: nothing for anon or authenticated ----
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- ===========================================================================
-- VERIFY. Raises unless every line holds; every right is READ BACK, never taken from the statements above.
-- ===========================================================================
do $$
declare bad text; n int; acl text;
begin
  if current_user <> 'postgres' then
    raise exception 'MIGRATION 068 FAILED: ran as %, not postgres — the defaults changed are not the ones that apply.', current_user;
  end if;

  -- the snapshot saw the thing it was taken for: MAINTAIN on documents for authenticated
  select count(*) into n from _m068_before
   where role = 'authenticated' and priv = 'MAINTAIN' and has and rel = 'documents';
  if n <> 1 then
    raise exception 'MIGRATION 068 FAILED: the snapshot did not see authenticated MAINTAIN on documents, so it cannot prove it was removed.';
  end if;

  -- no MAINTAIN — nor any of 067's three — for anon or authenticated anywhere in public
  select string_agg(format('%s %s %s', c.oid::regclass, r.rolname, p.priv), '; ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   cross join (values ('anon'), ('authenticated')) as r(rolname)
   cross join (values ('MAINTAIN'), ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) as p(priv)
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and has_table_privilege(r.rolname, c.oid, p.priv);
  if bad is not null then
    raise exception 'MIGRATION 068 FAILED: still granted: %', bad;
  end if;

  -- nothing else moved: anon and authenticated's other seven rights, and service_role's eight, exactly as before
  select string_agg(format('%s %s %s was %s', b.rel, b.role, b.priv, b.has), '; ') into bad
    from _m068_before b
   where not (b.role in ('anon', 'authenticated') and b.priv = 'MAINTAIN')
     and has_table_privilege(b.role, b.rel, b.priv) <> b.has;
  if bad is not null then
    raise exception 'MIGRATION 068 FAILED: a right other than MAINTAIN moved: %', bad;
  end if;

  -- the defaults themselves: postgres's entry for public tables names neither anon nor authenticated
  select d.defaclacl::text into acl from pg_default_acl d join pg_namespace s on s.oid = d.defaclnamespace
   where d.defaclrole = 'postgres'::regrole and s.nspname = 'public' and d.defaclobjtype = 'r';
  if acl is null or acl ~ '(^|[{,])(anon|authenticated)=' then
    raise exception 'MIGRATION 068 FAILED: postgres''s default privileges on public tables still name anon or authenticated: %', acl;
  end if;

  -- a table created now, as postgres, gives anon and authenticated nothing at all — and still gives
  -- service_role its defaults, so the probe is shown to be subject to the defaults
  create table public._migration_068_probe (id int);
  select string_agg(format('%s %s', r.rolname, p.priv), '; ') into bad
    from (values ('anon'), ('authenticated')) as r(rolname)
   cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                      ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) as p(priv)
   where has_table_privilege(r.rolname, 'public._migration_068_probe', p.priv);
  if bad is not null then
    raise exception 'MIGRATION 068 FAILED: a new table still gives a person: %', bad;
  end if;
  if not has_table_privilege('service_role', 'public._migration_068_probe', 'SELECT')
     or not has_table_privilege('service_role', 'public._migration_068_probe', 'MAINTAIN') then
    raise exception 'MIGRATION 068 FAILED: the probe table did not receive service_role''s defaults, so it proves nothing about the defaults.';
  end if;
  drop table public._migration_068_probe;

  raise notice 'MIGRATION 068 VERIFIED: no MAINTAIN, TRUNCATE, TRIGGER or REFERENCES for anon or authenticated; every other right of all three roles unchanged on every relation; postgres''s defaults on public tables grant anon and authenticated nothing; service_role''s defaults intact.';
end $$;

commit;
