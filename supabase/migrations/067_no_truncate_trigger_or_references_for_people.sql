-- ===========================================================================
-- 067 — NO TRUNCATE, TRIGGER OR REFERENCES FOR anon OR authenticated
-- ===========================================================================
-- WHY. `docs/SCHEMA.md` could not see grants until HR Step 3b-1 (`scripts/schema-doc.js` reads them with
-- has_table_privilege now). The first honest read showed `authenticated` holding TRUNCATE, TRIGGER and
-- REFERENCES on 25 relations in public — documents, calendar_events, companies, profiles among them —
-- from the default privileges `postgres` carries on public (`authenticated=arwdDxtm`) and from old
-- `grant all` lines (000_baseline). TRUNCATE is not subject to row-level security: a role holding it can
-- empty a whole table, every company's rows. The app never needs any of the three for a person.
--
-- HARDENING, NOT AN INCIDENT. Read on staging on 7 October 2026 before this was written:
--   · the data API (PostgREST) has no TRUNCATE verb, and no trigger or foreign key can be created
--     through it;
--   · of the 8 functions in public, the only one that runs dynamic SQL is increment_usage_counter,
--     which anon and authenticated may not execute (035:59–62); none mentions TRUNCATE;
--   · nothing in app/, lib/, scripts/ or supabase/ uses the three as those roles. REFERENCES is checked
--     against the role that CREATES a foreign key (the migration role), never the person inserting a
--     row, so taking it away changes no insert.
--   · anon holds nothing at all on any relation in public.
-- So no path let a person reach TRUNCATE. This closes the grant before one ever could.
--
-- WHAT IT DOES
--   1. Revokes the three from anon and authenticated on every table, partitioned table, view and
--      materialized view in public. (The brief named tables and partitioned tables; one of the 25 is a
--      view, obligation_evidence_state, and the same revoke closes it. It changes nothing a view does.)
--   2. ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public, so a table a migration creates
--      never grants them again. Migrations run as `postgres` (every table in public is owned by it, and
--      the verify block below refuses to pass as anyone else).
--   3. supabase_admin's defaults on public ALSO hand anon and authenticated arwdDxtm, and `postgres`
--      is NOT a member of supabase_admin, so it may not change them. This migration does not try to
--      work around that. Those defaults apply only to objects supabase_admin itself creates in public;
--      ours are created by postgres. The revoke-then-grant rule for every new table (CLAUDE.md §3.6)
--      stays the main guard, and `tests/unit/schemaGrants.test.ts` reads SCHEMA.md and fails if any of
--      the three ever comes back.
--
-- WHAT IT DOES NOT TOUCH: SELECT, INSERT, UPDATE and DELETE for anyone; service_role at all; any other
-- schema (storage carries the same postgres defaults and is out of scope here).
-- ===========================================================================

begin;

-- ---- the snapshot, before anything changes: every privilege of the three roles on every relation ----
create temp table _m067_before on commit drop as
select c.oid::regclass::text as rel, r.rolname as role, p.priv,
       has_table_privilege(r.rolname, c.oid, p.priv) as has
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
 cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) as p(priv)
 where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm');

-- ---- 1. the revoke ----
do $$
declare rel text;
begin
  for rel in
    select c.oid::regclass::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  loop
    execute format('revoke truncate, trigger, references on table %s from anon, authenticated', rel);
  end loop;
end $$;

-- ---- 2. the defaults our role may change ----
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- ===========================================================================
-- VERIFY. Raises unless every line holds. Privileges are READ BACK, never taken from the statements above.
-- ===========================================================================
do $$
declare bad text; n int;
begin
  -- the role this ran as is the one whose defaults were changed
  if current_user <> 'postgres' then
    raise exception 'MIGRATION 067 FAILED: ran as %, not postgres — the default privileges changed are not the ones that apply.', current_user;
  end if;

  -- (i) none of the three, for anon or authenticated, on any relation in public
  select string_agg(format('%s %s %s', c.oid::regclass, r.rolname, p.priv), '; ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   cross join (values ('anon'), ('authenticated')) as r(rolname)
   cross join (values ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) as p(priv)
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and has_table_privilege(r.rolname, c.oid, p.priv);
  if bad is not null then
    raise exception 'MIGRATION 067 FAILED (i): still granted: %', bad;
  end if;

  -- (ii) and (iii): authenticated's and anon's SELECT, INSERT, UPDATE, DELETE exactly as before
  select string_agg(format('%s %s %s was %s', b.rel, b.role, b.priv, b.has), '; ') into bad
    from _m067_before b
   where b.role in ('anon', 'authenticated') and b.priv in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
     and has_table_privilege(b.role, b.rel, b.priv) <> b.has;
  if bad is not null then
    raise exception 'MIGRATION 067 FAILED (ii/iii): a read or write privilege moved: %', bad;
  end if;

  -- (iv) service_role unchanged on every relation, all seven
  select string_agg(format('%s %s was %s', b.rel, b.priv, b.has), '; ') into bad
    from _m067_before b
   where b.role = 'service_role' and has_table_privilege('service_role', b.rel, b.priv) <> b.has;
  if bad is not null then
    raise exception 'MIGRATION 067 FAILED (iv): service_role changed: %', bad;
  end if;

  -- the snapshot saw the problem it was taken for — a check that cannot see a presence proves nothing
  select count(*) into n from _m067_before
   where role = 'authenticated' and priv = 'TRUNCATE' and has and rel in ('documents', 'calendar_events');
  if n <> 2 then
    raise exception 'MIGRATION 067 FAILED: the snapshot did not see TRUNCATE on documents and calendar_events (found %), so it cannot prove they were removed.', n;
  end if;

  -- (v) a table created now, as postgres, gets none of the three — and still gets the defaults that remain
  create table public._migration_067_probe (id int);
  if has_table_privilege('anon', 'public._migration_067_probe', 'TRUNCATE')
     or has_table_privilege('anon', 'public._migration_067_probe', 'TRIGGER')
     or has_table_privilege('anon', 'public._migration_067_probe', 'REFERENCES')
     or has_table_privilege('authenticated', 'public._migration_067_probe', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public._migration_067_probe', 'TRIGGER')
     or has_table_privilege('authenticated', 'public._migration_067_probe', 'REFERENCES') then
    raise exception 'MIGRATION 067 FAILED (v): a new table still grants TRUNCATE, TRIGGER or REFERENCES to anon or authenticated.';
  end if;
  -- ...and the probe IS subject to the defaults (so the line above is not vacuous): the remaining
  -- default still hands authenticated SELECT on a new table — which is why every new table revokes first.
  if not has_table_privilege('authenticated', 'public._migration_067_probe', 'SELECT') then
    raise exception 'MIGRATION 067 FAILED (v): the probe table did not receive the remaining defaults, so it proves nothing about them.';
  end if;
  drop table public._migration_067_probe;

  raise notice 'MIGRATION 067 VERIFIED: no TRUNCATE, TRIGGER or REFERENCES for anon or authenticated anywhere in public; SELECT/INSERT/UPDATE/DELETE unchanged for both; service_role unchanged; a new table gets none of the three.';
end $$;

commit;
