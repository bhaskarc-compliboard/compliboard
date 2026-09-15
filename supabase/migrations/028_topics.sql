-- ============================================================
-- COMPLIBOARD — MIGRATION 028: TOPICS
-- ============================================================
--
-- WHY NOW, AND WHY IT IS THE FIRST THING IN M1.  `DECISIONS.md` §69 sorted M1's six decisions by
-- what they cost to reverse. D23 — build topics, minimal shape — is the one that is **free today
-- and stops being free the moment conversations are stored.** Everything else in M1 costs the
-- same to undo whenever it is done. So this goes first, not because anything depends on it, but
-- because its window closes.
--
-- WHAT A TOPIC IS.  One exploration. `WORKSPACE.md` §6: conversation is a working mode, not an
-- archive — the transcript is disposable, and what survives is the summary.
--
-- ------------------------------------------------------------
-- *** WHAT THIS TABLE DELIBERATELY DOES NOT HAVE ***
--
-- Four absences, each a decision rather than an omission. Recorded here because the next person
-- to open this file will wonder about all four, and the cheapest place to answer is where the
-- columns would have been.
--
--   NO facts column.        §78 — a hypothetical is NEVER stored. "The Arizona facility would
--                           have 12 employees" belongs to the conversation the gate reads
--                           (M1.2b gives it prior turns), and storing it too would put one fact
--                           in two places under different rules. That is the two-systems problem
--                           this project has already produced twice: §71 (checklist_items vs
--                           obligations) and §24 (scan_result vs the site's own jurisdiction).
--                           A real fact goes to `company_switches` through 7.2a's route.
--
--   NO transcript column.   `WORKSPACE.md` §6.4 — transcripts are disposable, closed and
--                           discarded. Keeping one here would make the disposable thing durable
--                           by accident.
--
--   NO checklist reference. D22 / §77 — M1 writes no checklists, and what a checklist IS remains
--                           `TODO.md` item 6. `WORKSPACE.md` v3.6 marks the terminal object
--                           provisional for exactly this reason: **a topic closes onto a SUMMARY**
--                           until item 6 decides otherwise.
--
--   NO jurisdiction column. §77 item 8 — the jurisdiction of a QUESTION is frame, returned by the
--                           gate per turn. It is not a property of the topic: one exploration can
--                           ask about Oregon and then about Arizona.
--
-- **§78 removed a column rather than adding a well-designed one.** That is the shape to keep.
-- ------------------------------------------------------------

create type public.topic_status as enum ('open', 'closed');

comment on type public.topic_status is
  'Postgres ENUM rather than TEXT + CHECK (CLAUDE.md §3.7): `alter type ... add value` avoids the '
  'drop-and-recreate churn that requires restating every prior value. Two values today.';

create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  title       text not null,
  status      public.topic_status not null default 'open',
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,

  -- *** THE LOAD-BEARING COLUMN. *** `WORKSPACE.md` §6.5 says what a user returns to is "open
  -- checklists, closed topics, and their company profile" — and under D22 checklists are out, so
  -- **closed topics carry the entire landing surface.** If this is thin, there is nothing to come
  -- back to. It is nullable because an OPEN topic has not been summarised yet.
  summary     text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- A closed topic has a closing time; an open one does not. Both directions, because a
  -- one-sided check passes on the case it was not written for.
  constraint topics_closed_has_a_time
    check ((status = 'closed' and closed_at is not null)
        or (status = 'open'   and closed_at is null)),

  -- A title that is blank is a topic nobody can find again. `cardinality`/length rather than
  -- `array_length` semantics — CLAUDE.md §3.7's NULL trap does not apply to text, but an empty
  -- string does pass a naive NOT NULL, which is what this catches.
  constraint topics_title_is_not_blank check (length(btrim(title)) > 0)
);

comment on table public.topics is
  'One exploration. The transcript is disposable (WORKSPACE.md §6.4); the summary is what '
  'survives. Holds NO facts — a hypothetical is never stored (DECISIONS.md §78) and a real fact '
  'goes to company_switches. Migration 028.';

-- Company-leading, per CLAUDE.md §3.7. Every read is "this company's topics", most often the
-- open ones.
create index idx_topics_company_status on public.topics (company_id, status, opened_at desc);

create trigger set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- GRANTS AND RLS
--
-- *** NOT GRANTING IS NOT DENYING. *** This database carries default privileges that hand `anon`
-- full DML on anything created in `public`, so the REVOKE is not redundant — without it `anon`
-- holds everything on this table the moment it exists (CLAUDE.md §3.6, found on 11 Sep when a
-- table deliberately omitted from every grant line came out readable and writable).
-- ------------------------------------------------------------

-- *** THE REVOKE FROM `authenticated` IS NOT REDUNDANT, AND THE FIRST ATTEMPT AT THIS MIGRATION
--     PROVED IT. *** Granting SELECT/INSERT/UPDATE does not REMOVE what the default ACL already
--     handed out. `pg_default_acl` on this database reads:
--
--         authenticated=arwdDxtm/postgres        -- a=insert r=select w=update d=DELETE ...
--
--     so `authenticated` holds DELETE on `public.topics` the instant the table exists, before any
--     grant statement runs. The verify block below refused the migration for exactly that:
--
--         ERROR: MIGRATION 028 FAILED: authenticated holds DELETE on a table whose rows are
--         closed, not deleted.
--
--     The whole file rolled back — the table did not exist afterwards — which is the
--     transaction-per-file behaviour working. **Revoking then granting is the only way to end up
--     with the set of privileges the migration names.** CLAUDE.md §3.6: "not granting is not
--     denying."

revoke all on table public.topics from anon;
revoke all on table public.topics from authenticated;
grant select, insert, update on table public.topics to authenticated;
grant all on table public.topics to service_role;

-- DELETE is deliberately absent from `authenticated`. A topic is closed, not deleted — the same
-- shape as `obligations` having no DELETE policy (CLAUDE.md §3.2) and `switch_determinations`
-- being append-only (migration 025). **The absence is the design**, and the verify block asserts
-- it so a later widening cannot happen quietly.

alter table public.topics enable row level security;

-- All four predicates go through `auth_company_id()` rather than re-deriving the subquery: a
-- copy of it silently depends on `profiles`' own RLS (CLAUDE.md §3.6).
create policy topics_select on public.topics
  for select to authenticated
  using (company_id = public.auth_company_id());

create policy topics_insert on public.topics
  for insert to authenticated
  with check (company_id = public.auth_company_id());

-- Explicit WITH CHECK as well as USING, so a row cannot be updated OUT of the caller's company.
create policy topics_update on public.topics
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());

-- ------------------------------------------------------------
-- VERIFY — constraints are TRIED, not asserted. CLAUDE.md §3.7: a constraint nobody has
-- attempted to break is a comment.
-- ------------------------------------------------------------
do $$
declare v_company uuid; v_id uuid; n bigint; ok boolean;
begin
  select id into v_company from public.companies limit 1;
  if v_company is null then
    raise notice 'MIGRATION 028: no company to test against; table created, constraints not exercised.';
  else
    -- a blank title must be refused
    ok := false;
    begin
      insert into public.topics (company_id, title) values (v_company, '   ');
    exception when check_violation then ok := true; end;
    if not ok then raise exception 'MIGRATION 028 FAILED: a blank title was accepted.'; end if;

    -- closed with no closed_at must be refused
    ok := false;
    begin
      insert into public.topics (company_id, title, status) values (v_company, 'probe', 'closed');
    exception when check_violation then ok := true; end;
    if not ok then raise exception 'MIGRATION 028 FAILED: a closed topic with no closed_at was accepted.'; end if;

    -- open with a closed_at must be refused
    ok := false;
    begin
      insert into public.topics (company_id, title, closed_at) values (v_company, 'probe', now());
    exception when check_violation then ok := true; end;
    if not ok then raise exception 'MIGRATION 028 FAILED: an open topic carrying closed_at was accepted.'; end if;

    -- and an ordinary open topic must be accepted, then removed
    insert into public.topics (company_id, title) values (v_company, 'probe') returning id into v_id;
    delete from public.topics where id = v_id;
  end if;

  -- anon holds nothing
  select count(*) into n from information_schema.role_table_grants
   where table_schema='public' and table_name='topics' and grantee='anon';
  if n > 0 then raise exception 'MIGRATION 028 FAILED: anon holds % grant(s).', n; end if;

  -- authenticated cannot DELETE, and that is the design
  select count(*) into n from information_schema.role_table_grants
   where table_schema='public' and table_name='topics' and grantee='authenticated' and privilege_type='DELETE';
  if n > 0 then raise exception 'MIGRATION 028 FAILED: authenticated holds DELETE on a table whose rows are closed, not deleted.'; end if;

  -- three policies, all through auth_company_id()
  select count(*) into n from pg_policies
   where schemaname='public' and tablename='topics'
     and coalesce(qual,'')||coalesce(with_check,'') like '%auth_company_id%';
  if n <> 3 then raise exception 'MIGRATION 028 FAILED: % of 3 policies go through auth_company_id().', n; end if;

  raise notice 'MIGRATION 028 OK: topics created; three constraints tried and refused; anon holds nothing; no DELETE for authenticated.';
end $$;
