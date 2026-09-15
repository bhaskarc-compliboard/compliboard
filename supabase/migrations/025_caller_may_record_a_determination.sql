-- ============================================================
-- COMPLIBOARD — MIGRATION 025: A SIGNED-IN CALLER MAY RECORD A DETERMINATION
-- ============================================================
--
-- WHY.  `POST /api/switches/answer` (Phase 7.2a) writes three things in one order:
--
--     1. switch_determinations   the append-only history
--     2. company_switches        pinned to it by the composite FK (determined_from, evidence_class)
--     3. obligations             recomputed
--
-- The route connects AS THE CALLER — `requireCompany()` returns a client built from the anon
-- key plus the request's own token, so RLS applies (CLAUDE.md §3.6). Step 1 fails:
--
--     permission denied for table switch_determinations
--
-- Migration 017 created the table with SELECT for `authenticated` and one SELECT policy. **No
-- INSERT grant and no INSERT policy.** A person can read the determination history of their own
-- company and cannot add to it — which makes the first user answer impossible.
--
-- *** THIS IS §63 AGAIN, ONE TABLE OVER. *** There it was two FUNCTIONS granted to
-- `service_role` only while the route ran as the caller. Here it is a TABLE, and it was
-- invisible for the identical reason: **nothing had ever written a determination from a
-- request.** `lib/switchDetermination.ts` has had four exports and four tests since 13 September
-- with no production caller (AUDIT-CHECKS.md check 29). An unreached module cannot discover that
-- its table is read-only to the people who will use it.
--
-- ------------------------------------------------------------
-- UPDATE AND DELETE ARE ABSENT ON PURPOSE. THE ABSENCE IS THE DESIGN.
-- ------------------------------------------------------------
--
-- `switch_determinations` is **append-only**. A determination is what we concluded at a moment,
-- from a stated source, and the overwrite history in §49 depends on the old row still being
-- there. A correction is a NEW determination that outranks the old one by the precedence ladder
-- in `lib/switchDetermination.ts` — never an edit of what was concluded before.
--
-- So this migration grants INSERT and nothing else, and adds no UPDATE or DELETE policy. **If a
-- future reader wonders whether they were forgotten: they were not.** `obligations` carries the
-- same shape for the same reason — no DELETE policy, because obligations are marked and never
-- deleted (CLAUDE.md §3.2).
--
-- WHAT THIS DOES NOT WIDEN. `anon` holds nothing here before or after; the REVOKE below is
-- restated rather than assumed, because this database carries default privileges that hand
-- `anon` full DML on anything created in `public` (CLAUDE.md §3.6, "not granting is not
-- denying").
-- ============================================================

grant insert on table public.switch_determinations to authenticated;

revoke all on table public.switch_determinations from anon;

-- The caller may record a determination for THEIR OWN company only. Same predicate as the
-- SELECT policy 017 already carries, and the same one `company_switches_insert` uses — written
-- through `auth_company_id()` rather than re-deriving the subquery, because a copy of it
-- silently depends on `profiles`' own RLS (CLAUDE.md §3.6).
create policy switch_determinations_insert
  on public.switch_determinations
  for insert
  to authenticated
  with check (company_id = public.auth_company_id());

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare n bigint;
begin
  -- authenticated can now INSERT.
  if not exists (
    select 1 from information_schema.role_table_grants
     where table_schema='public' and table_name='switch_determinations'
       and grantee='authenticated' and privilege_type='INSERT') then
    raise exception 'MIGRATION 025 FAILED: authenticated still cannot INSERT.';
  end if;

  -- ...and the policy exists to scope it.
  if not exists (
    select 1 from pg_policies
     where schemaname='public' and tablename='switch_determinations'
       and policyname='switch_determinations_insert' and cmd='INSERT') then
    raise exception 'MIGRATION 025 FAILED: the INSERT policy is missing.';
  end if;

  -- APPEND-ONLY IS STILL TRUE. This is the assertion that matters most, because a later
  -- migration widening the table would otherwise do it silently.
  select count(*) into n
    from information_schema.role_table_grants
   where table_schema='public' and table_name='switch_determinations'
     and grantee='authenticated' and privilege_type in ('UPDATE','DELETE','TRUNCATE');
  if n > 0 then
    raise exception 'MIGRATION 025 FAILED: authenticated holds % mutating grant(s) on an append-only table.', n;
  end if;

  select count(*) into n
    from pg_policies
   where schemaname='public' and tablename='switch_determinations' and cmd in ('UPDATE','DELETE');
  if n > 0 then
    raise exception 'MIGRATION 025 FAILED: % UPDATE/DELETE policy(ies) exist on an append-only table.', n;
  end if;

  -- anon holds nothing.
  select count(*) into n
    from information_schema.role_table_grants
   where table_schema='public' and table_name='switch_determinations' and grantee='anon';
  if n > 0 then
    raise exception 'MIGRATION 025 FAILED: anon holds % grant(s).', n;
  end if;

  raise notice 'MIGRATION 025 OK: authenticated may INSERT its own determinations; table remains append-only; anon holds nothing.';
end $$;
