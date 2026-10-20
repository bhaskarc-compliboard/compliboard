-- ===========================================================================
-- 080 — THE DASHBOARD'S COUNTERS, KEPT BY THE DATABASE
-- ===========================================================================
-- WHY.
--
-- `docs/DASHBOARD-PLAN.md` decision 2: the Dashboard shows four numbers and they only go up —
-- files read, questions answered, audits done, checklists created. Two of those do not exist.
-- Decision 3 says where they are kept: **by a trigger on the table that records the event, so no
-- route can forget.**
--
-- "So no route can forget" is not a figure of speech. `docs/DASHBOARD-MACHINERY.md` §B1 listed the
-- five `bumpCounter` sites and §B2 found the holes by reading the code beside them:
--
--   · `app/api/document-checklist/route.ts:8` says in its own header "same `checklists_created`
--     counter" — and the file contains no `bumpCounter` call. A checklist made from a document gap
--     has never been counted.
--   · `app/api/audit-checklist/route.ts:57` inserts a checklist too, and never bumped either. That
--     one nothing had even noticed.
--
-- Two of the four routes that create a checklist do not count it. That is what a counter kept in
-- application code costs, and it is the whole argument for moving it into the table.
--
-- WHAT THIS MIGRATION DOES, and nothing else:
--
--   1. `usage_counters.files_read` and `.audits_done`, beside the two from 032, same shape, same
--      CHECK, same grants — `authenticated` reads and does not write.
--   2. Three triggers: a finished reading, a run reaching `done`, a checklist row created.
--      `questions_answered` is NOT touched (decision 3): all three chats already get the hard part
--      right — a STOPPED answer must not count — and a trigger on `turns` could not see that.
--   3. One backfill, written so a second run of it cannot double anything.
--   4. `profiles.welcomed_at`, for decision 5's "Welcome" / "Welcome back".
--
-- WHAT IT DOES NOT DO: it does not backfill `checklists_created`. That counter has been running
-- since 032 and Test Gamma holds 5 against 3 surviving rows — two checklists were deleted and the
-- counter correctly kept them (032's own rule). Recomputing it from `checklists` would set it to 3,
-- and **a counter that goes down is the one thing 032 exists to prevent.** It keeps counting from
-- where it is; from today the trigger catches the two routes that were missing.
--
-- READ FROM THE CODE BEFORE WRITING THIS (19 October 2026), because each trigger needs the one
-- write that is the event:
--
--   files_read    `lib/documentScan.ts:749` — the single INSERT into `document_scans`. One row per
--                 reading; a re-read inserts a NEW row and `:747` flips the previous one's
--                 `is_current` to false. So the event is an INSERT, and an UPDATE of a scan row —
--                 which is all `:747` ever does — is not a reading and must not count.
--                 A failed read reaches the same INSERT (`:1097` and `app/api/document-scan/
--                 route.ts:151` show `saveScan` has no early return for a refusal), carrying
--                 `status = 'could_not_read'`. That is the row the trigger must skip.
--   audits_done   `lib/auditRun.ts:1117` — `update ... status 'done' ... .neq('status','done')`,
--                 already a compare-and-set, so one section of many finishes the run. AND two
--                 INSERTs that are born done: `:234` (a template run with no sections) and `:305`
--                 (an agency run with no agencies). So the trigger must fire on both the insert
--                 and the transition, and on neither a second time.
--   checklists    four INSERTs: `app/api/chat/route.ts:410`, `app/api/checklists/from-topic/
--                 route.ts:258`, `app/api/document-checklist/route.ts:109` and
--                 `app/api/audit-checklist/route.ts:57`. The first two bump today; the last two
--                 never have.
--
-- AND ONE CONSEQUENCE, SAID OUT LOUD RATHER THAN DISCOVERED LATER. `app/api/chat/route.ts:433`
-- deletes a checklist whose items failed to save, and today's bump at `:439` sits after that, so a
-- rolled-back checklist is not counted. A trigger on INSERT counts it. The row existed, so it is a
-- real event and not an estimate (decision 10) — but it is a change, it is in the direction of
-- counting slightly more, and it happens only when a `checklist_items` insert errors.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. THE TWO COLUMNS.
--
-- Same shape as 032's two, including the CHECK — a counter that could go negative is a counter
-- somebody decremented, and the constraint is what makes that impossible rather than merely
-- impolite. NOT NULL DEFAULT 0 so every existing row gets a real number, not a null the page would
-- have to guess at.
--
-- *** THE GRANTS FROM 032 ARE LEFT EXACTLY AS THEY ARE, AND HERE IS WHAT THEY ARE. ***
-- `032_usage_counters.sql:60-63`:
--
--     revoke all on table public.usage_counters from anon;
--     revoke all on table public.usage_counters from authenticated;
--     grant select on table public.usage_counters to authenticated;
--     grant all    on table public.usage_counters to service_role;
--
-- and one policy, `usage_counters_select_own_company` (`032:68`), SELECT for `authenticated`
-- where the row is this caller's company. `authenticated` therefore holds SELECT and nothing else.
-- ADDING A COLUMN DOES NOT CHANGE THAT: a table-level GRANT SELECT covers columns added later, and
-- the absence of INSERT/UPDATE covers them too. Nothing is re-granted here, and §4 reads all of it
-- back from the catalog afterwards rather than trusting this paragraph.
-- ---------------------------------------------------------------------------
alter table public.usage_counters
  add column if not exists files_read  integer not null default 0,
  add column if not exists audits_done integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.usage_counters'::regclass
                    and conname = 'usage_counters_files_read_check') then
    alter table public.usage_counters
      add constraint usage_counters_files_read_check check (files_read >= 0);
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.usage_counters'::regclass
                    and conname = 'usage_counters_audits_done_check') then
    alter table public.usage_counters
      add constraint usage_counters_audits_done_check check (audits_done >= 0);
  end if;
end $$;

comment on column public.usage_counters.files_read is
  'Incremented when a reading is STORED — one INSERT into document_scans that is not '
  'could_not_read. A re-read is a second reading and counts again; an UPDATE of a scan row is not '
  'a reading and does not. Kept by a trigger (migration 080), never by a route.';
comment on column public.usage_counters.audits_done is
  'Incremented when an audit run REACHES done — the insert of a run born done, or the update that '
  'moves one into done. A later write to a done run does not count again. A dismissed run has '
  'already counted; dismissing changes nothing. Kept by a trigger (migration 080).';

-- ---------------------------------------------------------------------------
-- 2. THE ONE WAY A TRIGGER TOUCHES A COUNTER.
--
-- WHY A SHARED HELPER AND NOT THREE COPIES: three copies of "insert the row if it is missing, then
-- add one" is three places for the missing-row case to be got wrong, and the missing-row case is
-- not hypothetical — Cascade Specialty Chemicals has twelve readings and **no `usage_counters` row
-- at all** (`docs/DASHBOARD-MACHINERY.md` §B4), because it has never completed an answer through a
-- route and `bumpCounter` is what creates the row.
--
-- WHY ONE STATEMENT AND NOT TWO: `lib/conversation.ts:188-196` does it in two round trips — insert,
-- swallow 23505, then RPC — because PostgREST cannot express `x = x + 1`. In SQL there is no such
-- constraint, so this is a single upsert and the create-or-add is atomic rather than merely quick.
--
-- WHY `security definer`, WHICH 035's FUNCTION IS NOT. `increment_usage_counter` is SECURITY
-- INVOKER and says why (`035:30-32`): its only caller is `service_role`, which already bypasses
-- RLS. These run in a TRIGGER, and the caller is whoever did the insert — `authenticated` for a
-- checklist made from a chat, `service_role` for a reading. `authenticated` holds SELECT on
-- `usage_counters` and nothing else (032), so an invoker-rights trigger would fail the moment a
-- person made a checklist. DEFINER is not a convenience here; it is the only thing that works.
--
-- AND BECAUSE IT IS DEFINER, TWO THINGS FOLLOW, BOTH OF THEM 035's LESSON (`035:14-19`, which
-- records migration 013 leaving PUBLIC holding EXECUTE until 019):
--
--   · `set search_path = public, pg_temp`, as `public.auth_company_id()` does
--     (`004_rls_completion.sql:61-62`). Without it the function resolves `usage_counters` against
--     the caller's search_path.
--   · EXECUTE revoked from PUBLIC, `anon` and `authenticated` BY NAME. Postgres grants EXECUTE on
--     every new function to PUBLIC, and a definer-rights function that adds one to a counter is,
--     if callable, a tenant writing their own measurements. The triggers call it as the table
--     owner and do not need the grant.
--
-- The field is branched, never interpolated — `035:36-37`'s reasoning, unchanged: a
-- `format('... set %I', p_field)` would be an injection surface for the sake of four branches.
-- ---------------------------------------------------------------------------
create or replace function public.bump_usage_counter_for(
  p_company_id uuid,
  p_field      text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A row with no company is not a company's event. It cannot be counted and must not raise:
  -- `checklists.company_id` is NULLABLE (migration 000), so this is reachable.
  if p_company_id is null then return; end if;

  if p_field = 'files_read' then
    insert into public.usage_counters (company_id, files_read) values (p_company_id, 1)
      on conflict (company_id) do update set files_read = usage_counters.files_read + 1;
  elsif p_field = 'audits_done' then
    insert into public.usage_counters (company_id, audits_done) values (p_company_id, 1)
      on conflict (company_id) do update set audits_done = usage_counters.audits_done + 1;
  elsif p_field = 'checklists_created' then
    insert into public.usage_counters (company_id, checklists_created) values (p_company_id, 1)
      on conflict (company_id) do update set checklists_created = usage_counters.checklists_created + 1;
  elsif p_field = 'questions_answered' then
    insert into public.usage_counters (company_id, questions_answered) values (p_company_id, 1)
      on conflict (company_id) do update set questions_answered = usage_counters.questions_answered + 1;
  else
    raise exception 'bump_usage_counter_for: unknown field %', p_field;
  end if;
end $$;

comment on function public.bump_usage_counter_for(uuid, text) is
  'Atomic create-or-add on one usage counter, for the triggers of migration 080. SECURITY DEFINER '
  'because the caller is whoever wrote the row and authenticated holds only SELECT on '
  'usage_counters (032). A null company is ignored, not raised — checklists.company_id is '
  'nullable. Counters record events and never go down (DECISIONS.md §125).';

revoke all on function public.bump_usage_counter_for(uuid, text) from public;
revoke all on function public.bump_usage_counter_for(uuid, text) from anon;
revoke all on function public.bump_usage_counter_for(uuid, text) from authenticated;

-- ---------------------------------------------------------------------------
-- 3. A READING FINISHED.
--
-- AFTER INSERT, and only where the reading is not a failure. AFTER rather than BEFORE because the
-- counter is a consequence of the row, not a condition of it: a counter that could refuse an insert
-- would mean a failure to count loses the reading, and the reading is the thing worth keeping.
--
-- The WHEN clause is on the trigger rather than inside the function so the function is not even
-- called for a failed read — and so `pg_trigger` itself records the rule, where §5 can read it back.
--
-- `status is distinct from 'could_not_read'` and not `<> `: `document_scans.status` is nullable
-- (migration 040), `null <> 'could_not_read'` is null, and a WHEN that evaluates to null does not
-- fire. A reading stored without a status word is still a reading.
-- ---------------------------------------------------------------------------
create or replace function public.document_scans_count_reading()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.bump_usage_counter_for(new.company_id, 'files_read');
  return null;   -- AFTER trigger: the return value is ignored.
end $$;

comment on function public.document_scans_count_reading is
  'Adds one to usage_counters.files_read for each stored reading. Migration 080.';

drop trigger if exists document_scans_count_reading on public.document_scans;
create trigger document_scans_count_reading
  after insert on public.document_scans
  for each row
  when (new.status is distinct from 'could_not_read')
  execute function public.document_scans_count_reading();

-- ---------------------------------------------------------------------------
-- 4. AN AUDIT RUN REACHED `done`.
--
-- TWO TRIGGERS, ONE FUNCTION, because the event has two shapes and a single trigger cannot express
-- both: `lib/auditRun.ts:234` and `:305` INSERT a run that is already done (no sections, no
-- agencies — there was nothing to audit and the run is finished the moment it is made), while
-- `:1117` UPDATES one into done.
--
-- THE UPDATE TRIGGER'S WHEN CLAUSE IS THE WHOLE POINT: `old.status is distinct from 'done' and
-- new.status = 'done'`. A run that is already done and is written to again — `dismissed_at` set
-- when a person dismisses the report, `notified_at` set when the email goes — does not satisfy it
-- and does not count a second time. A dismissed run keeps its count, which is decision 7's rule in
-- the other direction: the work was done, so it still counts.
-- ---------------------------------------------------------------------------
create or replace function public.audit_runs_count_done()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.bump_usage_counter_for(new.company_id, 'audits_done');
  return null;
end $$;

comment on function public.audit_runs_count_done is
  'Adds one to usage_counters.audits_done when a run reaches done — once, on the transition or on '
  'an insert that is born done. Migration 080.';

drop trigger if exists audit_runs_count_done_insert on public.audit_runs;
create trigger audit_runs_count_done_insert
  after insert on public.audit_runs
  for each row
  when (new.status = 'done')
  execute function public.audit_runs_count_done();

drop trigger if exists audit_runs_count_done_update on public.audit_runs;
create trigger audit_runs_count_done_update
  after update on public.audit_runs
  for each row
  when (old.status is distinct from 'done' and new.status = 'done')
  execute function public.audit_runs_count_done();

-- ---------------------------------------------------------------------------
-- 5. A CHECKLIST WAS CREATED.
--
-- AFTER INSERT, unconditionally. Every one of the four routes that make a checklist goes through
-- this one row, which is the point: two of them have never counted, and after this neither of them
-- has to remember to. The two code bumps that exist today are removed in the same commit as this
-- migration (`app/api/chat/route.ts:438-440` and `app/api/checklists/from-topic/route.ts:272-273`),
-- because a trigger plus a bump is a checklist counted twice.
-- ---------------------------------------------------------------------------
create or replace function public.checklists_count_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.bump_usage_counter_for(new.company_id, 'checklists_created');
  return null;
end $$;

comment on function public.checklists_count_created is
  'Adds one to usage_counters.checklists_created for each checklist row. Migration 080 — it '
  'replaces the two bumps in app/api/chat and app/api/checklists/from-topic, and covers the two '
  'routes that never bumped at all (document-checklist, audit-checklist).';

drop trigger if exists checklists_count_created on public.checklists;
create trigger checklists_count_created
  after insert on public.checklists
  for each row
  execute function public.checklists_count_created();

-- ---------------------------------------------------------------------------
-- 6. THE BACKFILL — ONCE, AND IT CANNOT COUNT TWICE.
--
-- *** IT SETS; IT DOES NOT ADD. *** `files_read = (select count(*) ...)`, never
-- `files_read = files_read + (select count(*) ...)`. So running this migration a second time — a
-- `db:reset` replaying the chain from 000, a hand-run against a database that already has it —
-- computes the same count from the same rows and writes the same number. There is no accumulation
-- to go wrong. That is the only reason a backfill may live inside a migration at all.
--
-- THE FILTERS ARE THE TRIGGERS' FILTERS, WORD FOR WORD, so the number this writes today and the
-- number the triggers keep from tomorrow are the same measurement:
--   files_read   every document_scans row whose status is not 'could_not_read' (§3's WHEN)
--   audits_done  every audit_runs row whose status is 'done'  (§4's two WHENs, settled)
--
-- A re-run after real use does NOT lose what the triggers added: the rows are still there, so the
-- recount includes them. The one thing it would overwrite is a number the triggers added for a row
-- that has since been deleted — and a deleted reading or run is exactly the case 032 says a counter
-- should keep. Said out loud because it is the only way this backfill is ever lossy, it is only
-- reachable by replaying 080 on a live database, and `db:reset` wipes the rows anyway.
--
-- EVERY COMPANY GETS A ROW, including the ones with nothing to count — Cascade has twelve readings
-- and no row, and a company with no readings at all should still read 0 rather than absent. The
-- Dashboard shows a dash for a company with no number (decision 4) and that is a decision about
-- ZERO, which it can only make if the row is there to say zero.
-- ---------------------------------------------------------------------------
insert into public.usage_counters (company_id)
select c.id from public.companies c
on conflict (company_id) do nothing;

update public.usage_counters u set
  files_read = (
    select count(*) from public.document_scans s
     where s.company_id = u.company_id
       and s.status is distinct from 'could_not_read'),
  audits_done = (
    select count(*) from public.audit_runs r
     where r.company_id = u.company_id
       and r.status = 'done');

-- ---------------------------------------------------------------------------
-- 7. `profiles.welcomed_at` — DECISION 5.
--
-- "Welcome, ‹first name›" the first time this person opens the Dashboard, "Welcome back" after.
-- One nullable timestamp; null means never welcomed. Nothing else on `profiles`.
--
-- *** AND THE GRANT IS WHERE THIS GETS INTERESTING, SO READ WHAT IS THERE FIRST. ***
-- Read back from staging on 19 October 2026: `authenticated` holds table-wide UPDATE on
-- `profiles` (migration 000), under one policy —
--
--     "Users can update own profile"  UPDATE  authenticated  using (auth.uid() = id)   -- no WITH CHECK
--
-- A column-blind UPDATE on a row whose only test is that it is YOUR row. `profiles.company_id` is
-- in that row. `public.auth_company_id()` reads `profiles.company_id`. **Every RLS policy in this
-- product is scoped by that function** (`CLAUDE.md` §3.6: 59 of 65 policies call it). So a caller
-- going straight to PostgREST — not through a route, because a route is a UX affordance and not the
-- boundary — can write another company's id into their own profile and be inside that company for
-- every table at once. This is 078's finding in a worse place: there the blast radius was one
-- section's dates, here it is tenancy.
--
-- This migration does not go looking for that. It arrives at it, because decision 5 needs a person
-- to be able to write ONE column of their own profile, and the only honest way to grant one column
-- is to stop granting all of them.
--
-- SO: REVOKE THE TABLE-WIDE UPDATE, GRANT TWO COLUMNS (`CLAUDE.md` §3.6, 078's shape).
--
--   `full_name`    — `app/api/account/route.ts:116` updates it through `authed.db`, the CALLER's
--                    own client. The Account page must keep working, so this stays granted.
--   `welcomed_at`  — what decision 5 needs.
--
-- And what is no longer granted is `company_id`, `id` and `created_at`.
--
-- EVERY OTHER WRITER OF THIS TABLE IS THE SERVICE ROLE AND IS UNTOUCHED, checked one by one rather
-- than assumed: `app/api/signup/route.ts:58` (supabaseAdmin, inserts the row),
-- `scripts/run-golden-audit.js:941` (`db` built from SUPABASE_SERVICE_ROLE_KEY at `:63`, relinks
-- the Cascade fixture after a reset). `grep -rn "from('profiles')" app lib scripts` finds no other
-- write of any kind.
--
-- THE EXPLICIT `with check`, which that policy has never had. Postgres falls back to USING when an
-- UPDATE policy has no WITH CHECK, so this changes no behaviour — it is `CLAUDE.md` §3.6's house
-- rule ("Explicit WITH CHECK on every policy, not just USING") said in the catalog instead of
-- relied on as a default.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists welcomed_at timestamptz;

comment on column public.profiles.welcomed_at is
  'When this person first opened the Dashboard. Null means never: the title reads "Welcome, '
  '‹name›" and then "Welcome back, ‹name›" (DASHBOARD-PLAN decision 5). A person may set it once '
  'from null and may never change or clear it — profiles_person_update_refusal, migration 080.';

revoke update on table public.profiles from authenticated;
grant update (full_name, welcomed_at) on table public.profiles to authenticated;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = public.profiles.id)
  with check (auth.uid() = public.profiles.id);

-- ---------------------------------------------------------------------------
-- 8. AND THE RULE A GRANT CANNOT EXPRESS — 078/079's shape, for the same reason.
--
-- A column grant lets a person WRITE `welcomed_at`. It cannot say "once, from nothing". Without
-- this, a person can clear it and be welcomed as new again, or back-date it, which makes the one
-- fact the title turns on a thing the browser can set to anything.
--
-- It is small, and that is not the argument. `calendar_person_day_refusal` (079) is the same rule
-- about a different column and was written for the same reason: the moment a grant lets a person
-- write a column, the question "what may they write into it" has to be answered somewhere, and
-- the catalog is the only place that cannot be talked around.
--
-- A PURE FUNCTION, so §9 can prove every case of it with no login — 078's reasoning exactly. The
-- trigger is then one line of gate: the rule applies when the caller is `authenticated`, and the
-- service role (signup, the fixture relink, account deletion) is untouched. `current_user` and not
-- `auth.role()`, for 078's reason: the JWT's claim is what the caller sent; the role the database
-- is running as is what the database can be sure of.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_person_welcome_refusal(
  old_welcomed timestamptz, new_welcomed timestamptz
) returns text
language sql
immutable
as $$
  select case
    when old_welcomed is null then null                      -- setting it, or leaving it unset
    when new_welcomed is distinct from old_welcomed
      then 'Your first visit is already recorded and is not changed here.'
    else null                                                -- unchanged
  end;
$$;

comment on function public.profiles_person_welcome_refusal is
  'Whether a PERSON may make this change to profiles.welcomed_at: NULL when they may, else the '
  'sentence to refuse with. It may be SET from nothing — the Dashboard''s first visit — and never '
  'changed or cleared by hand afterwards. A pure function so migration 080 can prove every case '
  'without a login, as 078 and 079 do for the calendar. Migration 080.';

create or replace function public.profiles_guard_person_update()
returns trigger
language plpgsql
as $$
declare
  refusal text;
begin
  if current_user <> 'authenticated' then return new; end if;
  refusal := public.profiles_person_welcome_refusal(old.welcomed_at, new.welcomed_at);
  if refusal is not null then
    raise exception using errcode = 'check_violation', message = refusal;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_person_update on public.profiles;
create trigger profiles_person_update
  before update on public.profiles
  for each row execute function public.profiles_guard_person_update();

-- ===========================================================================
-- 9. VERIFY — AND EVERY COUNTER IS PROVED BY MOVING IT.
--
-- 073–079's shape: a throwaway company, each event fired once, each counter read back, and every
-- "does not count" case tried rather than asserted. `032:101` is the house rule this follows —
-- "THE NEVER-NEGATIVE CHECK, TESTED BY VIOLATING IT" — and `CLAUDE.md` §3.7's "a constraint
-- nobody has tried to break is a comment".
--
-- WHAT THIS BLOCK CANNOT PROVE, said out loud as 078 does: it runs as the migration's own role, so
-- §8's GATE is open and the welcome rule's refusal cannot be exercised through a real UPDATE here.
-- The RULE is proved exhaustively, because it is a pure function of two values. The GATE is proved
-- by `check:live` as a signed-in person. §9a: a check that cannot see a presence is not a check,
-- so the two halves are split rather than faked.
-- ===========================================================================
do $$
declare
  co     uuid;
  docu   uuid;
  runid  uuid;
  c      record;
  before_c record;
  n      int;
  owner_a text;
  owner_b text;
begin
  insert into public.companies (name) values ('080 probe company') returning id into co;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, '080 probe permit', co::text || '/080.pdf', 'application/pdf') returning id into docu;

  -- A brand-new company has no usage_counters row: that is the case Cascade is in, and the one
  -- the helper exists for. Prove it is absent before anything fires.
  select count(*) into n from public.usage_counters where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 080 FAILED: a new company already had a counters row; the test below proves nothing.';
  end if;

  -- ---- 9a. A FINISHED READING ADDS ONE, AND CREATES THE ROW. ----
  insert into public.document_scans (document_id, company_id, status) values (docu, co, 'gaps_found');
  select * into c from public.usage_counters where company_id = co;
  if not found then
    raise exception 'MIGRATION 080 FAILED: a reading did not create the company''s counters row.';
  end if;
  if c.files_read <> 1 then
    raise exception 'MIGRATION 080 FAILED: one reading moved files_read to %, expected 1.', c.files_read;
  end if;
  if c.audits_done <> 0 or c.checklists_created <> 0 or c.questions_answered <> 0 then
    raise exception 'MIGRATION 080 FAILED: a reading moved another counter (audits %, checklists %, questions %).',
      c.audits_done, c.checklists_created, c.questions_answered;
  end if;

  -- ---- 9b. A FAILED READ ADDS NOTHING. ----
  insert into public.document_scans (document_id, company_id, status, could_not_read_reason)
       values (docu, co, 'could_not_read', '080 probe: a file we could not open');
  select files_read into n from public.usage_counters where company_id = co;
  if n <> 1 then
    raise exception 'MIGRATION 080 FAILED: a failed read moved files_read to %, expected it to stay 1.', n;
  end if;

  -- ---- 9c. A RE-SAVE OF THE SAME READING ADDS NOTHING. ----
  -- This is the write `lib/documentScan.ts:747` makes on every re-read, and it must not count.
  update public.document_scans set is_current = false where company_id = co;
  update public.document_scans set summary = '080 probe: edited after the fact' where company_id = co;
  select files_read into n from public.usage_counters where company_id = co;
  if n <> 1 then
    raise exception 'MIGRATION 080 FAILED: updating a stored reading moved files_read to %, expected 1.', n;
  end if;

  -- ---- 9d. AN AUDIT RUN REACHING done ADDS ONE — the transition. ----
  insert into public.audit_runs (company_id, kind, agency_label, status)
       values (co, 'agency', 'Oregon DEQ', 'queued') returning id into runid;
  select audits_done into n from public.usage_counters where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 080 FAILED: a queued run moved audits_done to %, expected 0.', n;
  end if;
  update public.audit_runs set status = 'done', finished_at = now() where id = runid;
  select audits_done into n from public.usage_counters where company_id = co;
  if n <> 1 then
    raise exception 'MIGRATION 080 FAILED: a run reaching done moved audits_done to %, expected 1.', n;
  end if;

  -- ---- 9e. A SECOND WRITE TO A DONE RUN ADDS NOTHING. ----
  -- `dismissed_at` is the real one: a person dismissing the report writes a done row again.
  update public.audit_runs set dismissed_at = now() where id = runid;
  update public.audit_runs set status = 'done', notified_at = now() where id = runid;
  select audits_done into n from public.usage_counters where company_id = co;
  if n <> 1 then
    raise exception 'MIGRATION 080 FAILED: writing to a done run again moved audits_done to %, expected 1.', n;
  end if;

  -- ---- 9f. A RUN BORN done ADDS ONE — `lib/auditRun.ts:234` and `:305`. ----
  insert into public.audit_runs (company_id, kind, agency_label, status, started_at, finished_at)
       values (co, 'agency', 'Nothing to audit', 'done', now(), now());
  select audits_done into n from public.usage_counters where company_id = co;
  if n <> 2 then
    raise exception 'MIGRATION 080 FAILED: a run inserted as done moved audits_done to %, expected 2.', n;
  end if;

  -- ---- 9g. A CHECKLIST ADDS ONE. ----
  select * into before_c from public.usage_counters where company_id = co;
  insert into public.checklists (company_id, question, title)
       values (co, '080 probe: what does the law require?', '080 probe checklist');
  select * into c from public.usage_counters where company_id = co;
  if c.checklists_created <> before_c.checklists_created + 1 then
    raise exception 'MIGRATION 080 FAILED: a checklist moved checklists_created % → %, expected +1.',
      before_c.checklists_created, c.checklists_created;
  end if;
  if c.files_read <> before_c.files_read or c.audits_done <> before_c.audits_done
     or c.questions_answered <> before_c.questions_answered then
    raise exception 'MIGRATION 080 FAILED: a checklist moved another counter.';
  end if;

  -- ---- 9h. questions_answered WAS NEVER TOUCHED BY ANY OF IT (decision 3). ----
  select questions_answered into n from public.usage_counters where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 080 FAILED: questions_answered moved to % and nothing here should touch it.', n;
  end if;

  -- ---- 9i. A CHECKLIST WITH NO COMPANY IS IGNORED, NOT RAISED. ----
  -- `checklists.company_id` is nullable, so this is reachable and must not break the insert.
  insert into public.checklists (company_id, question, title)
       values (null, '080 probe: orphan', '080 probe orphan checklist');

  -- ---- 9j. THE NEVER-NEGATIVE CHECKS, TESTED BY VIOLATING THEM (032's rule). ----
  begin
    update public.usage_counters set files_read = -1 where company_id = co;
    raise exception 'MIGRATION 080 FAILED: a negative files_read was accepted.';
  exception when check_violation then null;
  end;
  begin
    update public.usage_counters set audits_done = -1 where company_id = co;
    raise exception 'MIGRATION 080 FAILED: a negative audits_done was accepted.';
  exception when check_violation then null;
  end;

  -- ---- 9k. CLEAN UP EVERYTHING THIS BLOCK MADE. ----
  delete from public.checklists where title in ('080 probe checklist', '080 probe orphan checklist');
  delete from public.audit_runs where company_id = co;
  delete from public.document_scans where company_id = co;
  delete from public.documents where id = docu;
  delete from public.companies where id = co;          -- cascades to usage_counters
  select count(*) into n from public.usage_counters where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 080 FAILED: the probe company''s counters row outlived it.';
  end if;

  -- ---- 9l. THE WELCOME RULE, EXHAUSTIVELY — it is a function of two values. ----
  if public.profiles_person_welcome_refusal(null, now()) is not null then
    raise exception 'MIGRATION 080 FAILED: a person could not record their first visit.';
  end if;
  if public.profiles_person_welcome_refusal(null, null) is not null then
    raise exception 'MIGRATION 080 FAILED: leaving welcomed_at unset was refused.';
  end if;
  if public.profiles_person_welcome_refusal('2026-10-01'::timestamptz, '2026-10-01'::timestamptz) is not null then
    raise exception 'MIGRATION 080 FAILED: leaving welcomed_at as it is was refused.';
  end if;
  if public.profiles_person_welcome_refusal('2026-10-01'::timestamptz, null) is null then
    raise exception 'MIGRATION 080 FAILED: a person could clear welcomed_at and be welcomed as new again.';
  end if;
  if public.profiles_person_welcome_refusal('2026-10-01'::timestamptz, '2026-09-01'::timestamptz) is null then
    raise exception 'MIGRATION 080 FAILED: a person could back-date welcomed_at.';
  end if;

  -- ---- 9m. THE TRIGGERS ARE WHERE AND WHAT THEY SAY THEY ARE. ----
  -- tgtype bits: 1 ROW, 2 BEFORE, 4 INSERT, 16 UPDATE. AFTER is "not BEFORE".
  select count(*) into n from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
   where cl.relname = 'document_scans' and t.tgname = 'document_scans_count_reading'
     and not t.tgisinternal and (t.tgtype & 2) = 0 and (t.tgtype & 4) = 4;
  if n <> 1 then raise exception 'MIGRATION 080 FAILED: the reading trigger is not AFTER INSERT on document_scans.'; end if;

  select count(*) into n from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
   where cl.relname = 'audit_runs' and t.tgname = 'audit_runs_count_done_insert'
     and not t.tgisinternal and (t.tgtype & 2) = 0 and (t.tgtype & 4) = 4;
  if n <> 1 then raise exception 'MIGRATION 080 FAILED: the audit insert trigger is not AFTER INSERT.'; end if;

  select count(*) into n from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
   where cl.relname = 'audit_runs' and t.tgname = 'audit_runs_count_done_update'
     and not t.tgisinternal and (t.tgtype & 2) = 0 and (t.tgtype & 16) = 16;
  if n <> 1 then raise exception 'MIGRATION 080 FAILED: the audit update trigger is not AFTER UPDATE.'; end if;

  select count(*) into n from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
   where cl.relname = 'checklists' and t.tgname = 'checklists_count_created'
     and not t.tgisinternal and (t.tgtype & 2) = 0 and (t.tgtype & 4) = 4;
  if n <> 1 then raise exception 'MIGRATION 080 FAILED: the checklist trigger is not AFTER INSERT.'; end if;

  select count(*) into n from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
   where cl.relname = 'profiles' and t.tgname = 'profiles_person_update'
     and not t.tgisinternal and (t.tgtype & 2) = 2 and (t.tgtype & 16) = 16;
  if n <> 1 then raise exception 'MIGRATION 080 FAILED: the profiles guard is not BEFORE UPDATE.'; end if;

  -- ---- 9n. THE HELPER IS DEFINER, OWNED AS 032/035's FUNCTION IS, AND NOBODY CAN CALL IT. ----
  select p.prosecdef::text into owner_a from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'bump_usage_counter_for';
  if owner_a <> 'true' then
    raise exception 'MIGRATION 080 FAILED: bump_usage_counter_for is not SECURITY DEFINER.';
  end if;
  select pg_get_userbyid(p.proowner) into owner_a from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'bump_usage_counter_for';
  select pg_get_userbyid(p.proowner) into owner_b from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'increment_usage_counter';
  if owner_a is distinct from owner_b then
    raise exception 'MIGRATION 080 FAILED: the helper is owned by % and 035''s bump by %.', owner_a, owner_b;
  end if;
  -- PUBLIC holding EXECUTE on a definer-rights counter bump is a tenant writing their own
  -- measurements. `035:73-74`'s query shape: grantee = 0 is PUBLIC, unambiguously.
  if exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    left join lateral aclexplode(p.proacl) a on true
    where ns.nspname = 'public' and p.proname = 'bump_usage_counter_for'
      and (p.proacl is null or (a.privilege_type = 'EXECUTE' and a.grantee = 0))
  ) then
    raise exception 'MIGRATION 080 FAILED: PUBLIC holds EXECUTE on bump_usage_counter_for.';
  end if;
  if has_function_privilege('authenticated', 'public.bump_usage_counter_for(uuid, text)', 'EXECUTE') then
    raise exception 'MIGRATION 080 FAILED: authenticated can call bump_usage_counter_for.';
  end if;
  if has_function_privilege('anon', 'public.bump_usage_counter_for(uuid, text)', 'EXECUTE') then
    raise exception 'MIGRATION 080 FAILED: anon can call bump_usage_counter_for.';
  end if;

  -- ---- 9o. 032's GRANTS ON usage_counters ARE EXACTLY AS THEY WERE. ----
  if not has_table_privilege('authenticated', 'public.usage_counters', 'SELECT') then
    raise exception 'MIGRATION 080 FAILED: authenticated lost SELECT on usage_counters.';
  end if;
  foreach owner_a in array array['INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.usage_counters', owner_a) then
      raise exception 'MIGRATION 080 FAILED: authenticated gained % on usage_counters.', owner_a;
    end if;
  end loop;
  foreach owner_a in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.usage_counters', owner_a) then
      raise exception 'MIGRATION 080 FAILED: anon holds % on usage_counters.', owner_a;
    end if;
  end loop;
  -- The new columns are readable through that table-wide SELECT, and writable by nobody.
  foreach owner_a in array array['files_read', 'audits_done'] loop
    if not has_column_privilege('authenticated', 'public.usage_counters', owner_a, 'SELECT') then
      raise exception 'MIGRATION 080 FAILED: authenticated cannot read %.', owner_a;
    end if;
    if has_column_privilege('authenticated', 'public.usage_counters', owner_a, 'UPDATE') then
      raise exception 'MIGRATION 080 FAILED: authenticated can write %.', owner_a;
    end if;
  end loop;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'usage_counters';
  if n <> 1 then
    raise exception 'MIGRATION 080 FAILED: usage_counters should carry 032''s one policy, found %.', n;
  end if;

  -- ---- 9p. THE PROFILES GRANT: two columns, and the one that matters is gone. ----
  foreach owner_a in array array['full_name', 'welcomed_at'] loop
    if not has_column_privilege('authenticated', 'public.profiles', owner_a, 'UPDATE') then
      raise exception 'MIGRATION 080 FAILED: authenticated lost UPDATE on %, which a route writes.', owner_a;
    end if;
  end loop;
  foreach owner_a in array array['company_id', 'id', 'created_at'] loop
    if has_column_privilege('authenticated', 'public.profiles', owner_a, 'UPDATE') then
      raise exception 'MIGRATION 080 FAILED: authenticated can still write profiles.%, which decides tenancy.', owner_a;
    end if;
  end loop;
  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'MIGRATION 080 FAILED: authenticated lost SELECT on profiles.';
  end if;
  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'MIGRATION 080 FAILED: anon holds SELECT on profiles.';
  end if;

  -- ---- 9q. THE BACKFILL AGREES WITH THE TRIGGERS, ON THIS DATABASE'S REAL ROWS. ----
  -- Not a restatement of §6: it recomputes both numbers a second way and compares. A company whose
  -- counter disagrees with its own rows means the filters drifted apart.
  select count(*) into n from public.usage_counters u
   where u.files_read <> (select count(*) from public.document_scans s
                           where s.company_id = u.company_id and s.status is distinct from 'could_not_read')
      or u.audits_done <> (select count(*) from public.audit_runs r
                            where r.company_id = u.company_id and r.status = 'done');
  if n <> 0 then
    raise exception 'MIGRATION 080 FAILED: % company(ies) have a backfilled counter that does not match their rows.', n;
  end if;
  -- `cmp`, not `c`: `c` is a RECORD variable declared at the top of this block, and plpgsql
  -- resolves `c.id` to the variable rather than to the table alias — "record c has no field id",
  -- which is how the first run of this migration refused itself.
  select count(*) into n from public.companies cmp
   where not exists (select 1 from public.usage_counters u where u.company_id = cmp.id);
  if n <> 0 then
    raise exception 'MIGRATION 080 FAILED: % company(ies) still have no counters row.', n;
  end if;

  raise notice 'MIGRATION 080 OK: files_read and audits_done added and backfilled to match every '
               'company''s own rows; a reading counts once and a failed read, a re-save and an '
               'update never do; a run counts on the transition into done and on an insert born '
               'done, and never twice; a checklist counts on its row, a null company is ignored; '
               'questions_answered untouched; both new CHECKs refused -1; the helper is DEFINER, '
               'owned as 035''s is, and callable by nobody; 032''s grants and its one policy are '
               'unchanged; welcomed_at may be set once from null and never changed, cleared or '
               'back-dated; and authenticated can no longer rewrite profiles.company_id.';
end $$;

commit;
