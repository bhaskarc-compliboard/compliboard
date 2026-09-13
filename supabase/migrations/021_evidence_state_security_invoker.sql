-- ============================================================
-- COMPLIBOARD — MIGRATION 021: THE EVIDENCE VIEW RUNS AS THE CALLER
-- ============================================================
--
-- *** THIS IS A TENANCY FIX, AND THE VIEW SHIPPED WITHOUT IT ONE MIGRATION AGO. ***
--
-- WHAT WAS WRONG.  `obligation_evidence_state` was created in 020 with no `security_invoker`
-- option. **Postgres defaults a view to the VIEW OWNER's rights**, so row-level security on
-- `obligations` and `obligation_evidence` would have been evaluated as `postgres` rather than
-- as the caller. `authenticated` holds SELECT on the view. **Every company would have seen
-- every other company's evidence counts through it.**
--
-- Nothing leaked: the view has existed only on staging, both base tables hold 0 rows on
-- production, and no route reads it. It is fixed before it can.
--
-- WHY THIS IS THE EXACT SHAPE `CLAUDE.md` §3.6 WARNS ABOUT, one object further out. §3.6 says
-- RLS is the security boundary and records that a table created in `public` starts life with
-- `anon` holding everything unless explicitly revoked — "not granting is not denying". **A
-- VIEW has the same trap with a different default**: it is not that permission was granted by
-- accident, it is that the view QUIETLY BYPASSES the policies on what it reads. The base
-- tables' three policies are correct and irrelevant, because nothing was consulting them.
--
-- HOW IT WAS FOUND.  It was listed as one of three things to verify by measurement rather than
-- assume, before 020 went to production. `reloptions` came back NULL. **The other two were
-- fine; this one was not, and none of the three would have been checked if the migration had
-- been declared finished when its own tests passed** — 020's behavioural block tests what the
-- view COUNTS, and a view counts correctly whoever it is counting for.
--
-- ANY VIEW OVER A TENANT TABLE NEEDS THIS. There is one today. `AUDIT-CHECKS.md` check 25 is
-- the standing query so a second one cannot ship without it.
-- ============================================================

alter view public.obligation_evidence_state set (security_invoker = on);

-- ------------------------------------------------------------
-- VERIFY — the option is set, and no other view in public is missing it.
-- ------------------------------------------------------------
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ')
    into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'v'
     and not coalesce(array_to_string(c.reloptions, ',') like '%security_invoker=on%', false);

  if missing is not null then
    raise exception 'MIGRATION 021 FAILED: view(s) still run as owner and bypass RLS: %', missing;
  end if;

  raise notice 'MIGRATION 021 OK: every view in public runs as the caller.';
end $$;
