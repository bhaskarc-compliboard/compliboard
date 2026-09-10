-- ============================================================
-- COMPLIBOARD — MIGRATION 004: MAKE THE DATABASE ENFORCE TENANCY TOO
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Every API route now derives company_id from the verified session (migrations 002/003
-- and the route work of 9–10 Sep). But every route still connects with the service-role
-- key, which ignores RLS completely. So the checks in application code are, today, the
-- ONLY thing separating one company's data from another's on the database side. A future
-- route that forgets one leaks silently, and nothing in Postgres would stop it.
--
-- This migration adds the second boundary. It does NOT convert any route off the
-- service-role key — policies first, tested; routes after, separately. One change at a
-- time, because a policy bug and a route bug look identical from the outside.
--
-- WHAT IT DOES
--
--   1. auth_company_id() — the tenancy rule in one named place
--   2. Policies on the five tables that had RLS on and none at all
--   3. documents moved onto company scope, plus its missing UPDATE policy
--   4. INSERT/UPDATE/DELETE for the four tables that only had SELECT
--   5. companies INSERT removed — no authenticated caller ever legitimately needs it
--   6. anon's grants dropped on all 18 tables
--
-- Explicit WITH CHECK on every INSERT and UPDATE. Every tenant policy goes through
-- auth_company_id(). The three reference tables stay readable by any authenticated user
-- and writable only by the service role.
-- ============================================================


-- ------------------------------------------------------------
-- 1. THE TENANCY RULE, IN ONE PLACE
--
-- Twenty of the twenty-eight existing policies, and all four storage policies, contain
-- the same subquery:
--
--     company_id in (select company_id from profiles where id = auth.uid())
--
-- That subquery reads `profiles`, and `profiles` has its own RLS. The dependency is
-- invisible and total:
--
--   *** If the "Users can view own profile" policy on profiles were ever dropped,   ***
--   *** narrowed, or replaced, that subquery would return NOTHING for every user.   ***
--   *** Every company-scoped policy in this database would then deny everything,    ***
--   *** and so would all file access in storage. No error would mention profiles.   ***
--   *** It would look exactly like the data had vanished.                           ***
--
-- SECURITY DEFINER breaks that chain. The function runs with its owner's rights, so it
-- reads profiles regardless of the policies on profiles, and the tenancy rule stops
-- depending on a policy on a different table that nobody thinks about when editing it.
--
-- search_path is pinned because a SECURITY DEFINER function without one can be
-- hijacked by a caller-controlled search_path — the standard Postgres footgun.
-- ------------------------------------------------------------

create or replace function public.auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profiles.company_id
  from public.profiles
  where profiles.id = auth.uid()
$$;

comment on function public.auth_company_id() is
  'The company of the currently authenticated user, read from profiles with definer '
  'rights so that tenancy does not depend on the RLS policies of profiles itself. '
  'Every company-scoped policy in this database is expressed through this function. '
  'Returns null when there is no session or the user has no profile, and a null '
  'company_id never matches a row, so the failure direction is closed.';

revoke all on function public.auth_company_id() from public;
grant execute on function public.auth_company_id() to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. obligation_evidence GETS ITS OWN TENANT COLUMN
--
-- Not in the original list, but required to express its policies without reintroducing
-- exactly the coupling section 1 removes: it has no company_id, so scoping it means a
-- subquery into obligations, which has its own RLS. Migration 003 solved the identical
-- problem for checklist_items by giving it a real column. Same treatment here.
--
-- The table is empty in production, so the backfill is a formality — but it is written
-- to be correct if that ever changes.
-- ------------------------------------------------------------

alter table public.obligation_evidence
  add column if not exists company_id uuid;

update public.obligation_evidence oe
set company_id = o.company_id
from public.obligations o
where oe.obligation_id = o.id
  and oe.company_id is null;

do $$
declare orphans bigint;
begin
  select count(*) into orphans from public.obligation_evidence where company_id is null;
  if orphans > 0 then
    raise exception 'Backfill incomplete: % obligation_evidence rows have no company_id.', orphans;
  end if;
end $$;

alter table public.obligation_evidence
  alter column company_id set not null;

alter table public.obligation_evidence
  add constraint obligation_evidence_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete cascade;

create index if not exists idx_obligation_evidence_company
  on public.obligation_evidence using btree (company_id);


-- ------------------------------------------------------------
-- 3. REWRITE EVERY EXISTING TENANT POLICY THROUGH auth_company_id()
--
-- Same meaning, one source of truth. Dropped and recreated rather than altered so the
-- final state is unambiguous in pg_policies.
-- ------------------------------------------------------------

-- --- calendar_events (from 003) ---
drop policy if exists "Company members can view their company events"      on public.calendar_events;
drop policy if exists "Company members can create events for their company" on public.calendar_events;
drop policy if exists "Company members can update their company events"    on public.calendar_events;
drop policy if exists "Company members can delete their company events"    on public.calendar_events;

create policy "calendar_events_select" on public.calendar_events for select to authenticated
  using (calendar_events.company_id = public.auth_company_id());
create policy "calendar_events_insert" on public.calendar_events for insert to authenticated
  with check (calendar_events.company_id = public.auth_company_id());
create policy "calendar_events_update" on public.calendar_events for update to authenticated
  using (calendar_events.company_id = public.auth_company_id())
  with check (calendar_events.company_id = public.auth_company_id());
create policy "calendar_events_delete" on public.calendar_events for delete to authenticated
  using (calendar_events.company_id = public.auth_company_id());

-- --- checklists (from 003) ---
drop policy if exists "Company members can view their company checklists"        on public.checklists;
drop policy if exists "Company members can create checklists for their company"  on public.checklists;
drop policy if exists "Company members can update their company checklists"      on public.checklists;
drop policy if exists "Company members can delete their company checklists"      on public.checklists;

create policy "checklists_select" on public.checklists for select to authenticated
  using (checklists.company_id = public.auth_company_id());
create policy "checklists_insert" on public.checklists for insert to authenticated
  with check (checklists.company_id = public.auth_company_id());
create policy "checklists_update" on public.checklists for update to authenticated
  using (checklists.company_id = public.auth_company_id())
  with check (checklists.company_id = public.auth_company_id());
create policy "checklists_delete" on public.checklists for delete to authenticated
  using (checklists.company_id = public.auth_company_id());

-- --- checklist_items (from 003) ---
drop policy if exists "Company members can view their company checklist items"       on public.checklist_items;
drop policy if exists "Company members can create checklist items for their company" on public.checklist_items;
drop policy if exists "Company members can update their company checklist items"     on public.checklist_items;
drop policy if exists "Company members can delete their company checklist items"     on public.checklist_items;

create policy "checklist_items_select" on public.checklist_items for select to authenticated
  using (checklist_items.company_id = public.auth_company_id());
create policy "checklist_items_insert" on public.checklist_items for insert to authenticated
  with check (checklist_items.company_id = public.auth_company_id());
create policy "checklist_items_update" on public.checklist_items for update to authenticated
  using (checklist_items.company_id = public.auth_company_id())
  with check (checklist_items.company_id = public.auth_company_id());
create policy "checklist_items_delete" on public.checklist_items for delete to authenticated
  using (checklist_items.company_id = public.auth_company_id());

-- --- company_folders (was a single ALL policy) ---
drop policy if exists "Users can manage their company folders" on public.company_folders;

create policy "company_folders_select" on public.company_folders for select to authenticated
  using (company_folders.company_id = public.auth_company_id());
create policy "company_folders_insert" on public.company_folders for insert to authenticated
  with check (company_folders.company_id = public.auth_company_id());
create policy "company_folders_update" on public.company_folders for update to authenticated
  using (company_folders.company_id = public.auth_company_id())
  with check (company_folders.company_id = public.auth_company_id());
create policy "company_folders_delete" on public.company_folders for delete to authenticated
  using (company_folders.company_id = public.auth_company_id());

-- --- companies ---
-- INSERT is REMOVED, not rewritten. It was WITH CHECK (true): any authenticated user
-- could create a company row. Checked before deciding — the only INSERT into companies
-- anywhere in the codebase is app/api/signup/route.ts, which runs under the service-role
-- key and bypasses RLS entirely. Every browser use of this table is a SELECT. So the
-- policy had no legitimate caller and its only effect was to permit junk rows.
--
-- DELETE is also deliberately absent: deleting a company happens in /api/account under
-- the service role, after a typed confirmation. It is not a thing a session may do.
drop policy if exists "Users can view own company"   on public.companies;
drop policy if exists "Users can update own company" on public.companies;
drop policy if exists "Users can insert company"     on public.companies;

create policy "companies_select" on public.companies for select to authenticated
  using (companies.id = public.auth_company_id());
create policy "companies_update" on public.companies for update to authenticated
  using (companies.id = public.auth_company_id())
  with check (companies.id = public.auth_company_id());

-- --- profiles ---
-- INSERT is REMOVED, same reasoning as companies: the only insert into profiles in the
-- codebase is app/api/signup/route.ts, under the service-role key. No session ever
-- legitimately creates a profile row, and permitting it let a user attach themselves to
-- an arbitrary company by writing their own row.
--
-- SELECT and UPDATE stay as they are — scoped auth.uid() = id, which is the base case
-- the rest of this scheme sits on and cannot itself be expressed through
-- auth_company_id() without circularity.
--
-- NOTE on how decoupled the base case actually is. After this migration NO POLICY reads
-- profiles: auth_company_id() is SECURITY DEFINER, so tenancy no longer depends on
-- profiles' own RLS. But ten call sites in the app still read profiles under the user's
-- token to fetch company_id (requirements, audits, calendar, dashboard, hr, compliance,
-- documents, upload, AppLayout). Those still need the SELECT policy below.
--
-- The dependency is therefore reduced, not removed — and its failure mode is much
-- better. Dropping this policy used to deny everything, everywhere, silently, including
-- file access. Now it breaks nine pages that visibly query profiles and get nothing.
-- Bounded and greppable rather than global and mute. Collapsing those call sites onto
-- auth_company_id() via RPC would finish the job; that is a separate change.
drop policy if exists "Users can insert own profile" on public.profiles;

-- --- entities ---
drop policy if exists "entities scoped to own company" on public.entities;

create policy "entities_select" on public.entities for select to authenticated
  using (entities.company_id = public.auth_company_id());
create policy "entities_insert" on public.entities for insert to authenticated
  with check (entities.company_id = public.auth_company_id());
create policy "entities_update" on public.entities for update to authenticated
  using (entities.company_id = public.auth_company_id())
  with check (entities.company_id = public.auth_company_id());
create policy "entities_delete" on public.entities for delete to authenticated
  using (entities.company_id = public.auth_company_id());

-- --- obligations ---
drop policy if exists "obligations scoped to own company" on public.obligations;

create policy "obligations_select" on public.obligations for select to authenticated
  using (obligations.company_id = public.auth_company_id());
create policy "obligations_insert" on public.obligations for insert to authenticated
  with check (obligations.company_id = public.auth_company_id());
create policy "obligations_update" on public.obligations for update to authenticated
  using (obligations.company_id = public.auth_company_id())
  with check (obligations.company_id = public.auth_company_id());
-- NOTE: no DELETE policy, and that is deliberate. CLAUDE.md §3.2: obligations are never
-- deleted, only marked. "We were subject to this from March 2024 to January 2026" is the
-- history this product exists to preserve. Removing one is a service-role operation with
-- a reason, not something a session does.

-- --- obligation_evidence (now on its own column) ---
drop policy if exists "obligation_evidence scoped to own company" on public.obligation_evidence;

create policy "obligation_evidence_select" on public.obligation_evidence for select to authenticated
  using (obligation_evidence.company_id = public.auth_company_id());
create policy "obligation_evidence_insert" on public.obligation_evidence for insert to authenticated
  with check (obligation_evidence.company_id = public.auth_company_id());
create policy "obligation_evidence_update" on public.obligation_evidence for update to authenticated
  using (obligation_evidence.company_id = public.auth_company_id())
  with check (obligation_evidence.company_id = public.auth_company_id());
create policy "obligation_evidence_delete" on public.obligation_evidence for delete to authenticated
  using (obligation_evidence.company_id = public.auth_company_id());

-- --- corrections ---
drop policy if exists "corrections scoped to own company" on public.corrections;

create policy "corrections_select" on public.corrections for select to authenticated
  using (corrections.company_id = public.auth_company_id());
create policy "corrections_insert" on public.corrections for insert to authenticated
  with check (corrections.company_id = public.auth_company_id());
create policy "corrections_update" on public.corrections for update to authenticated
  using (corrections.company_id = public.auth_company_id())
  with check (corrections.company_id = public.auth_company_id());
create policy "corrections_delete" on public.corrections for delete to authenticated
  using (corrections.company_id = public.auth_company_id());


-- ------------------------------------------------------------
-- 4. documents — ONTO COMPANY SCOPE, PLUS THE MISSING UPDATE
--
-- Same table/route split migration 003 fixed for checklists: the ROUTE went
-- company-scoped on 9 Sep, the TABLE never did. Its policies still read
-- auth.uid() = user_id, so two people at one company cannot see each other's files even
-- though the route intends them to. It also had no UPDATE policy at all, which is why
-- moving a document between folders had to go through the service role.
--
-- Verified against production before writing this: 38 rows, 0 with a null company_id,
-- 0 pointing at a company that does not exist. Nothing becomes invisible.
-- ------------------------------------------------------------

drop policy if exists "Users can view own documents"   on public.documents;
drop policy if exists "Users can insert own documents" on public.documents;
drop policy if exists "Users can delete own documents" on public.documents;

create policy "documents_select" on public.documents for select to authenticated
  using (documents.company_id = public.auth_company_id());
create policy "documents_insert" on public.documents for insert to authenticated
  with check (documents.company_id = public.auth_company_id());
create policy "documents_update" on public.documents for update to authenticated
  using (documents.company_id = public.auth_company_id())
  with check (documents.company_id = public.auth_company_id());
create policy "documents_delete" on public.documents for delete to authenticated
  using (documents.company_id = public.auth_company_id());


-- ------------------------------------------------------------
-- 5. THE FIVE TABLES THAT HAD RLS ON AND NO POLICIES AT ALL
--
-- RLS with no policy denies everything, which is why these were reachable only by the
-- service role. Four are tenant data and get the standard four policies.
-- standard_templates is the odd one out — see below.
-- ------------------------------------------------------------

-- --- audits ---
create policy "audits_select" on public.audits for select to authenticated
  using (audits.company_id = public.auth_company_id());
create policy "audits_insert" on public.audits for insert to authenticated
  with check (audits.company_id = public.auth_company_id());
create policy "audits_update" on public.audits for update to authenticated
  using (audits.company_id = public.auth_company_id())
  with check (audits.company_id = public.auth_company_id());
create policy "audits_delete" on public.audits for delete to authenticated
  using (audits.company_id = public.auth_company_id());

-- --- company_templates ---
create policy "company_templates_select" on public.company_templates for select to authenticated
  using (company_templates.company_id = public.auth_company_id());
create policy "company_templates_insert" on public.company_templates for insert to authenticated
  with check (company_templates.company_id = public.auth_company_id());
create policy "company_templates_update" on public.company_templates for update to authenticated
  using (company_templates.company_id = public.auth_company_id())
  with check (company_templates.company_id = public.auth_company_id());
create policy "company_templates_delete" on public.company_templates for delete to authenticated
  using (company_templates.company_id = public.auth_company_id());

-- --- document_reviews ---
create policy "document_reviews_select" on public.document_reviews for select to authenticated
  using (document_reviews.company_id = public.auth_company_id());
create policy "document_reviews_insert" on public.document_reviews for insert to authenticated
  with check (document_reviews.company_id = public.auth_company_id());
create policy "document_reviews_update" on public.document_reviews for update to authenticated
  using (document_reviews.company_id = public.auth_company_id())
  with check (document_reviews.company_id = public.auth_company_id());
create policy "document_reviews_delete" on public.document_reviews for delete to authenticated
  using (document_reviews.company_id = public.auth_company_id());

-- --- hr_audits ---
create policy "hr_audits_select" on public.hr_audits for select to authenticated
  using (hr_audits.company_id = public.auth_company_id());
create policy "hr_audits_insert" on public.hr_audits for insert to authenticated
  with check (hr_audits.company_id = public.auth_company_id());
create policy "hr_audits_update" on public.hr_audits for update to authenticated
  using (hr_audits.company_id = public.auth_company_id())
  with check (hr_audits.company_id = public.auth_company_id());
create policy "hr_audits_delete" on public.hr_audits for delete to authenticated
  using (hr_audits.company_id = public.auth_company_id());

-- --- standard_templates — REFERENCE DATA, not tenant data ---
--
-- The shared, cross-customer cache of parsed standards. DECISIONS.md §1 calls this "the
-- one place where marginal cost falls as the customer base grows" — every company that
-- audits against OSHA 1910.1200 reuses the same parsed checklist. It carries no
-- company_id and must not.
--
-- So it matches requirement_templates and agencies: readable by any authenticated user,
-- written only by the service role (no INSERT/UPDATE/DELETE policy). It was the only one
-- of the three missing its read policy, which is why checking the cache forced
-- /api/audits onto the service-role key.
create policy "standard_templates_select" on public.standard_templates for select to authenticated
  using (true);


-- ------------------------------------------------------------
-- 6. DROP anon's GRANTS
--
-- anon is the not-logged-in role. Supabase's defaults grant it full DML on every table,
-- and today RLS is the only thing stopping it — no policy names anon, so every request
-- is denied. That works until someone adds a table and forgets to enable RLS, or writes
-- a policy `to public` by habit. Then anon is one mistake from full read-write.
--
-- Nothing breaks: no code path queries these tables before login. Signup goes through
-- /api/signup under the service role, and every page authenticates first.
--
-- REFERENCES and TRIGGER are included: the point is that anon holds nothing at all.
-- ------------------------------------------------------------

revoke all on table public.agencies              from anon;
revoke all on table public.audits                from anon;
revoke all on table public.calendar_events       from anon;
revoke all on table public.checklist_items       from anon;
revoke all on table public.checklists            from anon;
revoke all on table public.companies             from anon;
revoke all on table public.company_folders       from anon;
revoke all on table public.company_templates     from anon;
revoke all on table public.corrections           from anon;
revoke all on table public.document_reviews      from anon;
revoke all on table public.documents             from anon;
revoke all on table public.entities              from anon;
revoke all on table public.hr_audits             from anon;
revoke all on table public.obligation_evidence   from anon;
revoke all on table public.obligations           from anon;
revoke all on table public.profiles              from anon;
revoke all on table public.requirement_templates from anon;
revoke all on table public.standard_templates    from anon;


-- ------------------------------------------------------------
-- 7. VERIFICATION — run by hand after applying, against STAGING first.
--
--   -- every tenant policy goes through the function; none re-derives the rule
--   select tablename, cmd, policyname,
--          coalesce(qual, with_check) like '%auth_company_id%' as via_function
--   from pg_policies where schemaname='public' order by tablename, cmd;
--
--   -- no table left with RLS on and zero policies
--   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   left join pg_policies p on p.schemaname='public' and p.tablename=c.relname
--   where n.nspname='public' and c.relkind='r' and c.relrowsecurity
--   group by c.relname having count(p.policyname)=0;
--
--   -- anon holds nothing
--   select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
--   where n.nspname='public' and c.relkind='r' and pg_get_userbyid(x.grantee)='anon';
--
--   -- the function answers correctly for a real session, and null for none
--   select public.auth_company_id();
--
-- Then, as two real users at different companies: each sees only their own rows in
-- every table, and neither can write into the other's.
--
-- ROUTES ARE NOT CONVERTED IN THIS MIGRATION. They all still use the service-role key
-- and are unaffected by everything above. Converting them is the next change, once
-- these policies are proven.
-- ------------------------------------------------------------
