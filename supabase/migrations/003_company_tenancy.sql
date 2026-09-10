-- ============================================================
-- COMPLIBOARD — MIGRATION 003: COMPANY TENANCY, AND RETIRING folder_audits
-- ============================================================
--
-- WHY THIS EXISTS
--
-- CompliBoard's tenant is the COMPANY (CLAUDE.md §3.6: every data table carries
-- company_id, never user_id). Three tables never got that memo. checklists,
-- checklist_items and calendar_events all decide who may see a row by comparing
-- auth.uid() to a user_id, which produces two problems at once.
--
-- The visible one: two people at the same company do not see the same compliance
-- record. One person's checklists are invisible to their colleague. For a product
-- whose whole claim is "here is what your company must do and what proves it", a
-- record that fragments per login is the wrong shape.
--
-- The quieter one: checklist_items has no company_id at all. It reaches tenancy
-- through checklist_id -> checklists.user_id, so every policy on it is a subquery
-- into another table that has its own RLS. That is the same coupling that makes the
-- storage policies fragile — drop the parent's policy and the child silently denies
-- everything, with no obvious connection to the change.
--
-- WHAT THIS MIGRATION DOES
--
--   1. Adds company_id to checklist_items, backfills it from the parent checklist,
--      and makes it NOT NULL. 235 production rows, 0 with a missing parent, so the
--      backfill is total.
--   2. Replaces the RLS policies on all three tables with company-scoped ones —
--      SELECT, INSERT, UPDATE and DELETE on each, every one with an explicit
--      WITH CHECK where it applies. checklists previously had no UPDATE policy at all.
--   3. Drops folder_audits entirely.
--
-- WHY folder_audits IS DELETED, NOT FIXED
--
-- The feature inferred compliance from FOLDER NAMES. A folder called "DOT" with any
-- file in it read as green. A filename is not evidence, and an expired permit filed
-- in a correctly-named folder scored the same as a current one. That is the
-- false-green failure this product exists to prevent (CLAUDE.md §6, "the omniscient
-- status tracker"), so it is being removed rather than re-scoped. There is no page,
-- component or nav entry for it; the only remaining consumer was the monthly-summary
-- cron route, which is deleted in the same change and had never run.
--
-- BEFORE APPLYING — what changes for a user
--
-- Colleagues will see each other's checklists. That is the intent, and it matches
-- documents and the calendar. It is a visible change, not just an internal one.
--
-- Calendar behaviour does not change at all: no browser client reads calendar_events,
-- the route already scopes by company, and all 47 production rows carry a company_id.
-- This migration aligns the database with what the route already does.
--
-- Checked against production first: checklists 11 rows / 0 null company_id,
-- calendar_events 47 / 0, checklist_items 235 / 0 orphaned, and no user_id anywhere
-- pointing at a deleted profile. Nothing becomes invisible.
--
-- One code change is REQUIRED alongside this migration and must ship with it:
-- app/compliance/page.tsx deletes a checklist with `.eq('id', id)` and no ownership
-- filter, and updates a checklist item the same way. Both are safe today only because
-- RLS narrows them to the caller's own rows. Widening the policy without adding an
-- explicit company filter turns "delete my checklist" into "delete any colleague's
-- checklist". The filters are added in the same commit.
-- ============================================================

-- ------------------------------------------------------------
-- 1. checklist_items gets a real tenant column
-- ------------------------------------------------------------

alter table public.checklist_items
  add column if not exists company_id uuid;

-- Backfill from the parent. Every row has a parent today; the WHERE guard keeps this
-- re-runnable and makes a partial state impossible to create by accident.
update public.checklist_items ci
set company_id = c.company_id
from public.checklists c
where ci.checklist_id = c.id
  and ci.company_id is null;

-- Refuse to continue if anything failed to backfill. Better to abort the whole
-- migration than to add a NOT NULL that silently fails, or worse, to leave rows
-- unreachable by every policy below.
do $$
declare
  orphans bigint;
begin
  select count(*) into orphans from public.checklist_items where company_id is null;
  if orphans > 0 then
    raise exception 'Backfill incomplete: % checklist_items rows have no company_id. '
                    'These have a missing or null checklist_id and would be invisible '
                    'to every policy. Resolve them before re-running.', orphans;
  end if;
end $$;

alter table public.checklist_items
  alter column company_id set not null;

alter table public.checklist_items
  add constraint checklist_items_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete cascade;

create index if not exists idx_checklist_items_company
  on public.checklist_items using btree (company_id);

-- ------------------------------------------------------------
-- 2. Company-scoped RLS, replacing the user-scoped policies
--
--    The predicate is the same one every other table uses: the row's company must be
--    the company on the caller's profile. Written out per policy rather than through a
--    helper so the definition is visible in pg_policies without indirection.
-- ------------------------------------------------------------

-- --- checklists ---------------------------------------------------------------

drop policy if exists "Users can view own checklists"   on public.checklists;
drop policy if exists "Users can insert own checklists" on public.checklists;
drop policy if exists "Users can delete own checklists" on public.checklists;

create policy "Company members can view their company checklists"
  on public.checklists for select to authenticated
  using (checklists.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

create policy "Company members can create checklists for their company"
  on public.checklists for insert to authenticated
  with check (checklists.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

-- New: there was no UPDATE policy before, which is why linking a research answer to
-- a checklist had to go through a service-role route.
create policy "Company members can update their company checklists"
  on public.checklists for update to authenticated
  using (checklists.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()))
  with check (checklists.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

create policy "Company members can delete their company checklists"
  on public.checklists for delete to authenticated
  using (checklists.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

-- --- checklist_items ----------------------------------------------------------
-- Now scoped on its own column rather than by subquery into checklists. One less
-- table whose RLS has to hold for this table's RLS to work.

drop policy if exists "Users can view own checklist items"   on public.checklist_items;
drop policy if exists "Users can insert own checklist items" on public.checklist_items;
drop policy if exists "Users can update own checklist items" on public.checklist_items;
drop policy if exists "Users can delete own checklist items" on public.checklist_items;

create policy "Company members can view their company checklist items"
  on public.checklist_items for select to authenticated
  using (checklist_items.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

create policy "Company members can create checklist items for their company"
  on public.checklist_items for insert to authenticated
  with check (checklist_items.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

create policy "Company members can update their company checklist items"
  on public.checklist_items for update to authenticated
  using (checklist_items.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()))
  with check (checklist_items.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

create policy "Company members can delete their company checklist items"
  on public.checklist_items for delete to authenticated
  using (checklist_items.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

-- --- calendar_events ----------------------------------------------------------
-- A compliance calendar is a company asset. No browser client reads this table today,
-- so this changes nothing at runtime — it aligns the database with what the route
-- already enforces, and it is what lets the route stop using the service-role key.

drop policy if exists "Users can view own events"   on public.calendar_events;
drop policy if exists "Users can insert own events" on public.calendar_events;
drop policy if exists "Users can update own events" on public.calendar_events;
drop policy if exists "Users can delete own events" on public.calendar_events;

create policy "Company members can view their company events"
  on public.calendar_events for select to authenticated
  using (calendar_events.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

create policy "Company members can create events for their company"
  on public.calendar_events for insert to authenticated
  with check (calendar_events.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

create policy "Company members can update their company events"
  on public.calendar_events for update to authenticated
  using (calendar_events.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()))
  with check (calendar_events.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

create policy "Company members can delete their company events"
  on public.calendar_events for delete to authenticated
  using (calendar_events.company_id in (
    select profiles.company_id from public.profiles where profiles.id = auth.uid()));

-- ------------------------------------------------------------
-- 3. Retire folder_audits
--
--    Dropping the table takes its policies, its three foreign keys and its index with
--    it. One production row is destroyed; it is a scan result derived from folder
--    names, not a customer document, and nothing references it.
-- ------------------------------------------------------------

drop table if exists public.folder_audits;

-- ------------------------------------------------------------
-- 4. Verification — run by hand after applying, against STAGING first.
--
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname='public'
--     and tablename in ('checklists','checklist_items','calendar_events')
--   order by tablename, cmd;
--   -- expect 12 policies, four per table, every predicate naming profiles
--
--   select count(*) filter (where company_id is null) as must_be_zero
--   from public.checklist_items;
--
--   select to_regclass('public.folder_audits') is null as folder_audits_gone;
--
--   -- and as two real users at different companies: each sees only their own
--   -- checklists, and neither can delete the other's.
-- ------------------------------------------------------------
