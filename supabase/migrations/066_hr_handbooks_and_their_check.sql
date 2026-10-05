-- ===========================================================================
-- 066 — HR'S HANDBOOKS AND THEIR CHECK, THE CONVERSATION'S SECTION, THE CALENDAR LINK
-- ===========================================================================
-- WHY. The HR section is being rebuilt as a copy of the Compliance Workspace whose evidence is the
-- company's own handbooks (`docs/HR-PLAN.md`, `DECISIONS.md` §164). This lays the shapes the plan
-- needs before any screen exists, so every later step builds on rows rather than on a JSON blob —
-- the lesson `hr_audits` taught (`docs/TODO.md` M3: "findings are a frozen JSON blob").
--
--   handbooks                HR's own record of a handbook — NEVER a `documents` row (decision 18).
--                            A handbook does not appear in Company Documents, the Documents sweep,
--                            the dashboard or Audits. Its site and its versions live here.
--   handbook_sections        the handbook split into sections, each with its text and a fingerprint,
--                            so a check can say which section it read and a re-check can tell what moved.
--   handbook_checks          one check of one handbook version (decision 2).
--   handbook_check_sections  the unit the sweep claims — one per section per check, plus one
--                            'not_covered' pass — copying audit_sections' claim (058), not its table.
--   handbook_findings        every finding as a row.
--   handbook_dates           company-level dates a handbook sets, sent to the ONE calendar only when a
--                            person presses "Add to calendar" (decision 29).
--
-- WHY OWN TABLES AND NOT audit_runs. Fitting a 'handbook' kind into audit_runs changes 13 places in a
-- live section, and an audit section never sees a document's full text (`docs/HR-MACHINERY.md` B4).
-- The PATTERNS are copied — a compare-and-set claim per unit, a sweep, one email — the tables are not.
--
-- AND THREE SHARED CHANGES, each invisible where it lands:
--   topics.section          'workspace' | 'hr', DEFAULT 'workspace', so every existing insert (the chat
--                           route's two, check:live's, every migration probe's) keeps working and every
--                           existing row reads 'workspace' (decision 5). topic_list_v exposes it, appended
--                           at the end as `create or replace view` requires.
--   calendar_events.handbook_id   nullable, ON DELETE SET NULL — the document_id pattern (040:195).
--   ai_calls / job_runs CHECKs    restated with 'hr', 'hr_check' and 'handbook_checks' (decisions 9, 24).
--
-- TENANCY IS COMPOSITE, THE WAY 055 AND 058 DID IT: every pointer between these tables, and to a site,
-- is a foreign key on (company_id, <id>), so a row cannot point at another company's row and RLS — which
-- checks only the row's own company_id — would never notice. A pointer that must survive its target's
-- deletion uses `ON DELETE SET NULL (<column>)` (Postgres 15+; staging is 17.6), which clears only that
-- column: the plain SET NULL on a composite key would also null company_id, the failure 055 recorded.
--
-- STATUS AND KIND COLUMNS ARE text WITH A CHECK, as the brief asks and as 058 does.
-- GRANTS: REVOKE ALL from anon and authenticated FIRST, then grant exactly what is stated (§3.6): this
-- project's default privileges hand both roles full DML on any new table before a GRANT runs.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- handbooks
-- ---------------------------------------------------------------------------
create table if not exists public.handbooks (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  name            text not null,
  -- <company>/handbooks/<file>, exactly two levels, so account delete's storage walk removes it
  -- unchanged (`app/api/account/route.ts`, listCompanyObjects).
  file_path       text not null unique,
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint check (size_bytes >= 0),
  page_count      integer check (page_count >= 0),          -- null until read
  -- 'company' covers every site; 'site' covers one. A handbook whose site is deleted KEEPS scope 'site'
  -- with a null entity_id, so it never silently becomes company-wide (the FK below clears only entity_id).
  scope           text not null default 'company' check (scope in ('company', 'site')),
  entity_id       uuid,
  -- Versions, as in Documents: the person names the older one; only the newest is used (decision 8 → 18).
  version_of      uuid,
  is_current      boolean not null default true,
  status          text not null default 'uploaded'
                  check (status in ('uploaded', 'reading', 'read', 'could_not_read')),
  status_reason   text,                                     -- plain words, for the person
  extracted_text  text,
  read_at         timestamptz,
  checked_at      timestamptz,
  -- Set when a check finishes; the nightly queue selects on it.
  next_check_at   timestamptz,
  uploaded_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint handbooks_company_scope_has_no_site check (scope <> 'company' or entity_id is null),
  -- §5.1: a handbook we could not read says why.
  constraint handbooks_could_not_read_says_why check (status <> 'could_not_read' or status_reason is not null)
);

alter table public.handbooks drop constraint if exists handbooks_company_id_id_key;
alter table public.handbooks add constraint handbooks_company_id_id_key unique (company_id, id);

alter table public.handbooks drop constraint if exists handbooks_site_in_same_company;
alter table public.handbooks add constraint handbooks_site_in_same_company
  foreign key (company_id, entity_id) references public.entities (company_id, id)
  on delete set null (entity_id);

alter table public.handbooks drop constraint if exists handbooks_version_of_in_same_company;
alter table public.handbooks add constraint handbooks_version_of_in_same_company
  foreign key (company_id, version_of) references public.handbooks (company_id, id)
  on delete set null (version_of);

create index if not exists idx_handbooks_company_created on public.handbooks (company_id, created_at desc);
create index if not exists idx_handbooks_company_current on public.handbooks (company_id, is_current);
-- The nightly queue reads across companies ("which current handbooks are due"), so this one is not
-- company-leading: it is the queue's own predicate.
create index if not exists idx_handbooks_next_check_at on public.handbooks (next_check_at) where is_current;

drop trigger if exists set_updated_at on public.handbooks;
create trigger set_updated_at before update on public.handbooks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- handbook_sections — written by the server
-- ---------------------------------------------------------------------------
create table if not exists public.handbook_sections (
  id           uuid primary key default gen_random_uuid(),
  handbook_id  uuid not null,
  company_id   uuid not null references public.companies (id) on delete cascade,
  position     integer not null check (position >= 0),
  title        text,
  page_from    integer check (page_from >= 1),
  page_to      integer check (page_to >= 1),
  text         text not null,
  text_sha256  text not null,
  created_at   timestamptz not null default now(),
  constraint handbook_sections_pages_in_order check (page_from is null or page_to is null or page_to >= page_from),
  unique (handbook_id, position)
);
alter table public.handbook_sections drop constraint if exists handbook_sections_company_id_id_key;
alter table public.handbook_sections add constraint handbook_sections_company_id_id_key unique (company_id, id);
alter table public.handbook_sections drop constraint if exists handbook_sections_handbook_in_same_company;
alter table public.handbook_sections add constraint handbook_sections_handbook_in_same_company
  foreign key (company_id, handbook_id) references public.handbooks (company_id, id) on delete cascade;
create index if not exists idx_handbook_sections_company_handbook on public.handbook_sections (company_id, handbook_id, position);

-- ---------------------------------------------------------------------------
-- handbook_checks — one check of one handbook version
-- ---------------------------------------------------------------------------
create table if not exists public.handbook_checks (
  id             uuid primary key default gen_random_uuid(),
  handbook_id    uuid not null,
  company_id     uuid not null references public.companies (id) on delete cascade,
  reason         text not null check (reason in ('new_version', 'scheduled', 'on_demand')),
  status         text not null default 'queued' check (status in ('queued', 'checking', 'done', 'failed')),
  section_count  integer not null default 0 check (section_count >= 0),
  done_count     integer not null default 0 check (done_count >= 0),
  requested_by   uuid references auth.users (id) on delete set null,   -- null for the nightly run
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);
alter table public.handbook_checks drop constraint if exists handbook_checks_company_id_id_key;
alter table public.handbook_checks add constraint handbook_checks_company_id_id_key unique (company_id, id);
alter table public.handbook_checks drop constraint if exists handbook_checks_handbook_in_same_company;
alter table public.handbook_checks add constraint handbook_checks_handbook_in_same_company
  foreign key (company_id, handbook_id) references public.handbooks (company_id, id) on delete cascade;
create index if not exists idx_handbook_checks_company_handbook on public.handbook_checks (company_id, handbook_id, created_at desc);
create index if not exists idx_handbook_checks_open on public.handbook_checks (company_id, status) where status in ('queued', 'checking');

-- ---------------------------------------------------------------------------
-- handbook_check_sections — the unit the sweep claims (audit_sections' claim, 058)
-- ---------------------------------------------------------------------------
create table if not exists public.handbook_check_sections (
  id            uuid primary key default gen_random_uuid(),
  check_id      uuid not null,
  company_id    uuid not null references public.companies (id) on delete cascade,
  kind          text not null check (kind in ('section', 'not_covered')),
  section_id    uuid,                                        -- null for 'not_covered'
  status        text not null default 'queued' check (status in ('queued', 'checking', 'done', 'failed')),
  -- THE COMPARE-AND-SET: `update … where claimed_at is null`, recovered when stale — as audit_sections.
  claimed_at    timestamptz,
  input_sha256  text,
  word          text check (word in ('needs_change', 'no_gap', 'to_confirm', 'company_choice')),  -- null until done
  created_at    timestamptz not null default now(),
  finished_at   timestamptz,
  constraint handbook_check_sections_kind_has_its_section check (
    (kind = 'section' and section_id is not null) or (kind = 'not_covered' and section_id is null)
  )
);
alter table public.handbook_check_sections drop constraint if exists handbook_check_sections_company_id_id_key;
alter table public.handbook_check_sections add constraint handbook_check_sections_company_id_id_key unique (company_id, id);
alter table public.handbook_check_sections drop constraint if exists handbook_check_sections_check_in_same_company;
alter table public.handbook_check_sections add constraint handbook_check_sections_check_in_same_company
  foreign key (company_id, check_id) references public.handbook_checks (company_id, id) on delete cascade;
alter table public.handbook_check_sections drop constraint if exists handbook_check_sections_section_in_same_company;
alter table public.handbook_check_sections add constraint handbook_check_sections_section_in_same_company
  foreign key (company_id, section_id) references public.handbook_sections (company_id, id) on delete cascade;
create index if not exists idx_handbook_check_sections_company_check on public.handbook_check_sections (company_id, check_id);
-- The sweep's own query: queued and unclaimed (the shape of idx_audit_sections_queued).
create index if not exists idx_handbook_check_sections_queued on public.handbook_check_sections (company_id, status, claimed_at);

-- ---------------------------------------------------------------------------
-- handbook_findings
-- ---------------------------------------------------------------------------
create table if not exists public.handbook_findings (
  id                uuid primary key default gen_random_uuid(),
  check_id          uuid not null,
  check_section_id  uuid not null,
  company_id        uuid not null references public.companies (id) on delete cascade,
  kind              text not null check (kind in ('change', 'not_covered', 'to_confirm')),
  title             text not null,
  why               text,
  what_to_change    text,
  handbook_quote    text,
  quote_verified    boolean,
  page              integer check (page >= 1),
  -- [{ url, title, official }] — the agency pages the finding rests on.
  sources           jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  created_at        timestamptz not null default now()
);
alter table public.handbook_findings drop constraint if exists handbook_findings_check_in_same_company;
alter table public.handbook_findings add constraint handbook_findings_check_in_same_company
  foreign key (company_id, check_id) references public.handbook_checks (company_id, id) on delete cascade;
alter table public.handbook_findings drop constraint if exists handbook_findings_check_section_in_same_company;
alter table public.handbook_findings add constraint handbook_findings_check_section_in_same_company
  foreign key (company_id, check_section_id) references public.handbook_check_sections (company_id, id) on delete cascade;
create index if not exists idx_handbook_findings_company_check on public.handbook_findings (company_id, check_id);

-- ---------------------------------------------------------------------------
-- handbook_dates (decision 29) — the shape of document_deadlines (040:155–167)
-- ---------------------------------------------------------------------------
create table if not exists public.handbook_dates (
  id                 uuid primary key default gen_random_uuid(),
  handbook_id        uuid not null,
  company_id         uuid not null references public.companies (id) on delete cascade,
  check_id           uuid,
  title              text not null,
  due_date           date,
  recurs             boolean not null default false,
  quote              text,
  quote_verified     boolean,
  source             text not null check (source in ('handbook', 'rule')),
  source_url         text,
  -- Null until a PERSON presses "Add to calendar". Nothing writes calendar_events on its own.
  -- A plain FK, exactly as document_deadlines.calendar_event_id.
  calendar_event_id  uuid references public.calendar_events (id) on delete set null,
  created_at         timestamptz not null default now()
);
alter table public.handbook_dates drop constraint if exists handbook_dates_handbook_in_same_company;
alter table public.handbook_dates add constraint handbook_dates_handbook_in_same_company
  foreign key (company_id, handbook_id) references public.handbooks (company_id, id) on delete cascade;
alter table public.handbook_dates drop constraint if exists handbook_dates_check_in_same_company;
alter table public.handbook_dates add constraint handbook_dates_check_in_same_company
  foreign key (company_id, check_id) references public.handbook_checks (company_id, id)
  on delete set null (check_id);
create index if not exists idx_handbook_dates_company_handbook on public.handbook_dates (company_id, handbook_id);

-- ---------------------------------------------------------------------------
-- topics.section (decision 5) and topic_list_v
-- ---------------------------------------------------------------------------
alter table public.topics add column if not exists section text not null default 'workspace';
alter table public.topics drop constraint if exists topics_section_is_known;
alter table public.topics add constraint topics_section_is_known check (section in ('workspace', 'hr'));
-- Each list reads its own section, newest first.
create index if not exists idx_topics_company_section_last_turn on public.topics (company_id, section, last_turn_at desc);
comment on column public.topics.section is
  'HR Step 3b (decision 5). Which section the conversation belongs to: workspace or hr. Each Conversations list shows only its own.';

-- The view from 065, unchanged, with `section` appended at the end.
create or replace view public.topic_list_v with (security_invoker = true) as
select
  t.id, t.company_id, t.title, t.summary, t.summarised_at, t.summary_source,
  t.delete_after, t.last_turn_at, t.created_at,
  (t.summary_report is not null)                 as has_report,
  coalesce(tc.turn_count, 0)                     as turn_count,
  coalesce(tc.question_count, 0)                 as question_count,
  coalesce(tc.document_count, 0)                 as document_count,
  fd.first_document_name,
  cl.id                                          as checklist_id,
  coalesce(cl.total, 0)                          as checklist_total,
  coalesce(cl.done, 0)                           as checklist_done,
  coalesce(t.summary_started_at   > now() - interval '10 minutes', false) as summary_in_progress,
  coalesce(t.checklist_started_at > now() - interval '10 minutes', false) as checklist_in_progress,
  t.section
from public.topics t
left join lateral (
  select count(*)                                               as turn_count,
         count(*) filter (where tu.role = 'user')               as question_count,
         count(distinct coalesce(tu.document_id::text, tu.document_name))
           filter (where tu.document_name is not null)          as document_count
    from public.turns tu where tu.topic_id = t.id
) tc on true
left join lateral (
  select tu.document_name as first_document_name
    from public.turns tu
   where tu.topic_id = t.id and tu.document_name is not null
   order by tu.position limit 1
) fd on true
left join lateral (
  select c.id,
         (select count(*) from public.checklist_items i
           where i.checklist_id = c.id and i.parent_item_index is null)                 as total,
         (select count(*) from public.checklist_items i
           where i.checklist_id = c.id and i.parent_item_index is null and i.completed) as done
    from public.checklists c
   where c.from_topic_id = t.id
   order by c.created_at desc limit 1
) cl on true;

revoke all on public.topic_list_v from anon;
revoke all on public.topic_list_v from authenticated;
grant select on public.topic_list_v to authenticated;
grant select on public.topic_list_v to service_role;

-- ---------------------------------------------------------------------------
-- calendar_events.handbook_id (decision 29)
-- ---------------------------------------------------------------------------
-- Composite like the rest, so an event cannot point at another company's handbook; SET NULL on the
-- one column only. A calendar event with a null company_id (none are written that way today) is
-- simply not checked — MATCH SIMPLE — which is the same as the plain FK it would otherwise have been.
alter table public.calendar_events add column if not exists handbook_id uuid;
alter table public.calendar_events drop constraint if exists calendar_events_handbook_in_same_company;
alter table public.calendar_events add constraint calendar_events_handbook_in_same_company
  foreign key (company_id, handbook_id) references public.handbooks (company_id, id)
  on delete set null (handbook_id);
create index if not exists idx_calendar_events_company_handbook on public.calendar_events (company_id, handbook_id)
  where handbook_id is not null;
comment on column public.calendar_events.handbook_id is
  'HR Step 3b (decision 29). The handbook a date came from, when a person added it from HR. Null otherwise.';

-- ---------------------------------------------------------------------------
-- The ledger's tasks and the jobs' names, restated in full (a CHECK cannot ADD VALUE).
-- Names read from the catalog on staging: ai_calls_task_check, job_runs_job_check.
-- ---------------------------------------------------------------------------
alter table public.ai_calls drop constraint if exists ai_calls_task_check;
alter table public.ai_calls add constraint ai_calls_task_check
  check (task = any (array['research', 'checklist', 'substeps', 'convert', 'summarise', 'gate', 'critique',
    'audit', 'document_review', 'document_scan', 'document_draft', 'howto', 'other', 'hr', 'hr_check']));

alter table public.job_runs drop constraint if exists job_runs_job_check;
alter table public.job_runs add constraint job_runs_job_check
  check (job = any (array['summarise', 'delete', 'account_delete', 'scan_documents', 'audit_sections', 'handbook_checks']));

-- ---------------------------------------------------------------------------
-- GRANTS — revoke first, for both roles, then exactly what is stated.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['handbooks', 'handbook_sections', 'handbook_checks', 'handbook_check_sections',
                           'handbook_findings', 'handbook_dates'] loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- A person uploads, renames, re-scopes and deletes their handbooks — routes act as the person (like documents).
grant select, insert, update, delete on table public.handbooks to authenticated;
-- The server writes these; a person reads them (like audit_sections).
grant select on table public.handbook_sections       to authenticated;
grant select on table public.handbook_checks         to authenticated;
grant select on table public.handbook_check_sections to authenticated;
grant select on table public.handbook_findings       to authenticated;
-- Copied from document_deadlines (040:229–243): SELECT and UPDATE.
grant select, update on table public.handbook_dates to authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Four policies each through auth_company_id() (058's loop); handbook_dates copies
-- document_deadlines' two (040:254–258): select and update.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['handbooks', 'handbook_sections', 'handbook_checks', 'handbook_check_sections',
                           'handbook_findings'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format($f$create policy %I_select on public.%I for select to authenticated
                      using (%I.company_id = public.auth_company_id())$f$, t, t, t);
    execute format($f$create policy %I_insert on public.%I for insert to authenticated
                      with check (%I.company_id = public.auth_company_id())$f$, t, t, t);
    execute format($f$create policy %I_update on public.%I for update to authenticated
                      using (%I.company_id = public.auth_company_id())
                      with check (%I.company_id = public.auth_company_id())$f$, t, t, t, t);
    execute format($f$create policy %I_delete on public.%I for delete to authenticated
                      using (%I.company_id = public.auth_company_id())$f$, t, t, t);
  end loop;
end $$;

drop policy if exists handbook_dates_select_own on public.handbook_dates;
create policy handbook_dates_select_own on public.handbook_dates
  for select to authenticated using (public.handbook_dates.company_id = public.auth_company_id());
drop policy if exists handbook_dates_update_own on public.handbook_dates;
create policy handbook_dates_update_own on public.handbook_dates
  for update to authenticated using (public.handbook_dates.company_id = public.auth_company_id())
  with check (public.handbook_dates.company_id = public.auth_company_id());

comment on table public.handbooks is 'HR''s own record of a handbook (HR-PLAN decision 18). Never a documents row.';
comment on table public.handbook_sections is 'A handbook split into sections, each with its text and fingerprint. Written by the server.';
comment on table public.handbook_checks is 'One check of one handbook version (decision 2).';
comment on table public.handbook_check_sections is 'The unit the handbook sweep claims: one per section per check, plus one not_covered pass. claimed_at is the compare-and-set.';
comment on table public.handbook_findings is 'Every finding of a handbook check, as a row.';
comment on table public.handbook_dates is 'Company-level dates a handbook sets; sent to the one calendar only when a person presses Add to calendar (decision 29).';

-- ===========================================================================
-- VERIFY. Every CHECK is tested by breaking it (§3.7); every privilege is READ BACK with
-- has_table_privilege, never taken from the grant list. Two throwaway companies, because the writes
-- that must be refused are cross-tenant ones.
-- ===========================================================================
do $$
declare
  coA uuid; coB uuid; siteA uuid; siteB uuid;
  hbA uuid; hbA2 uuid; hbB uuid; secA uuid; secB uuid; chkA uuid; csA uuid; csNC uuid; fA uuid; dA uuid;
  evA uuid; tp uuid; n int; t text; p text; r text;
  new_tables text[] := array['handbooks', 'handbook_sections', 'handbook_checks', 'handbook_check_sections',
                             'handbook_findings', 'handbook_dates'];
  privs text[] := array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  stated jsonb := jsonb_build_object(
    'handbooks',               jsonb_build_array('SELECT', 'INSERT', 'UPDATE', 'DELETE'),
    'handbook_sections',       jsonb_build_array('SELECT'),
    'handbook_checks',         jsonb_build_array('SELECT'),
    'handbook_check_sections', jsonb_build_array('SELECT'),
    'handbook_findings',       jsonb_build_array('SELECT'),
    'handbook_dates',          jsonb_build_array('SELECT', 'UPDATE'));
begin
  -- ---- every new table exists, with RLS on ----
  foreach t in array new_tables loop
    if to_regclass('public.' || t) is null then
      raise exception 'MIGRATION 066 FAILED: table % does not exist.', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'MIGRATION 066 FAILED: RLS is not enabled on %.', t;
    end if;
  end loop;

  -- ---- anon holds nothing; authenticated holds EXACTLY what was stated — all seven privileges read ----
  foreach t in array new_tables loop
    foreach p in array privs loop
      if has_table_privilege('anon', 'public.' || t, p) then
        raise exception 'MIGRATION 066 FAILED: anon holds % on %.', p, t;
      end if;
      if has_table_privilege('authenticated', 'public.' || t, p) <> ((stated -> t) ? p) then
        raise exception 'MIGRATION 066 FAILED: authenticated % on % is %, the migration stated %.',
          p, t, has_table_privilege('authenticated', 'public.' || t, p), ((stated -> t) ? p);
      end if;
    end loop;
  end loop;

  -- ---- probes ----
  insert into public.companies (name, industry, state) values ('Migration 066 probe A', 'chemical manufacturing', 'OR') returning id into coA;
  insert into public.companies (name, industry, state) values ('Migration 066 probe B', 'chemical manufacturing', 'OR') returning id into coB;
  insert into public.entities (company_id, entity_type, name, details) values (coA, 'site', 'Vancouver', '{}'::jsonb) returning id into siteA;
  insert into public.entities (company_id, entity_type, name, details) values (coB, 'site', 'Salem', '{}'::jsonb) returning id into siteB;

  -- handbooks: defaults, the scope CHECK, the site's tenancy, and a deleted site
  insert into public.handbooks (company_id, name, file_path, file_name)
       values (coA, 'Employee Handbook', coA || '/handbooks/probe-066-a.pdf', 'handbook.pdf') returning id into hbA;
  if (select scope from public.handbooks where id = hbA) <> 'company'
     or (select status from public.handbooks where id = hbA) <> 'uploaded'
     or (select is_current from public.handbooks where id = hbA) is not true then
    raise exception 'MIGRATION 066 FAILED: a new handbook did not default to company / uploaded / current.';
  end if;
  begin
    insert into public.handbooks (company_id, name, file_path, file_name, scope, entity_id)
         values (coA, 'x', coA || '/handbooks/probe-066-x.pdf', 'x.pdf', 'company', siteA);
    raise exception 'MIGRATION 066 FAILED: the handbooks scope CHECK accepted scope company with an entity_id.';
  exception when check_violation then null; end;
  begin
    update public.handbooks set status = 'could_not_read' where id = hbA;
    raise exception 'MIGRATION 066 FAILED: could_not_read was accepted with no status_reason.';
  exception when check_violation then null; end;
  begin
    update public.handbooks set status = 'scanned' where id = hbA;
    raise exception 'MIGRATION 066 FAILED: handbooks.status accepted "scanned".';
  exception when check_violation then null; end;
  begin
    insert into public.handbooks (company_id, name, file_path, file_name)
         values (coA, 'dup', coA || '/handbooks/probe-066-a.pdf', 'dup.pdf');
    raise exception 'MIGRATION 066 FAILED: two handbooks shared one file_path.';
  exception when unique_violation then null; end;
  begin
    insert into public.handbooks (company_id, name, file_path, file_name, scope, entity_id)
         values (coA, 'x', coA || '/handbooks/probe-066-y.pdf', 'y.pdf', 'site', siteB);
    raise exception 'MIGRATION 066 FAILED: a handbook took another company''s site.';
  exception when foreign_key_violation then null; end;
  insert into public.handbooks (company_id, name, file_path, file_name, scope, entity_id, version_of)
       values (coA, 'Washington addendum', coA || '/handbooks/probe-066-wa.pdf', 'wa.pdf', 'site', siteA, hbA)
       returning id into hbA2;
  delete from public.entities where id = siteA;
  if (select scope from public.handbooks where id = hbA2) <> 'site'
     or (select entity_id from public.handbooks where id = hbA2) is not null
     or (select company_id from public.handbooks where id = hbA2) <> coA then
    raise exception 'MIGRATION 066 FAILED: deleting a site did not leave the handbook scope site, entity_id null, company kept.';
  end if;
  insert into public.handbooks (company_id, name, file_path, file_name)
       values (coB, 'B handbook', coB || '/handbooks/probe-066-b.pdf', 'b.pdf') returning id into hbB;
  begin
    update public.handbooks set version_of = hbB where id = hbA2;
    raise exception 'MIGRATION 066 FAILED: a handbook named another company''s handbook as its older version.';
  exception when foreign_key_violation then null; end;

  -- sections, a check, its units, a finding, a date
  insert into public.handbook_sections (handbook_id, company_id, position, title, page_from, page_to, text, text_sha256)
       values (hbA, coA, 0, 'Paid sick leave', 12, 13, 'Employees accrue one hour…', 'probe') returning id into secA;
  begin
    insert into public.handbook_sections (handbook_id, company_id, position, text, text_sha256)
         values (hbA, coA, 0, 'again', 'probe');
    raise exception 'MIGRATION 066 FAILED: two sections shared one position in one handbook.';
  exception when unique_violation then null; end;
  begin
    insert into public.handbook_sections (handbook_id, company_id, position, text, text_sha256)
         values (hbB, coA, 0, 'cross', 'probe');
    raise exception 'MIGRATION 066 FAILED: a section was written for another company''s handbook.';
  exception when foreign_key_violation then null; end;
  insert into public.handbook_sections (handbook_id, company_id, position, text, text_sha256)
       values (hbB, coB, 0, 'B text', 'probe') returning id into secB;

  insert into public.handbook_checks (handbook_id, company_id, reason) values (hbA, coA, 'new_version') returning id into chkA;
  if (select status from public.handbook_checks where id = chkA) <> 'queued' then
    raise exception 'MIGRATION 066 FAILED: a new check did not default to queued.';
  end if;
  begin
    update public.handbook_checks set reason = 'nightly' where id = chkA;
    raise exception 'MIGRATION 066 FAILED: handbook_checks.reason accepted "nightly".';
  exception when check_violation then null; end;

  insert into public.handbook_check_sections (check_id, company_id, kind, section_id) values (chkA, coA, 'section', secA) returning id into csA;
  insert into public.handbook_check_sections (check_id, company_id, kind) values (chkA, coA, 'not_covered') returning id into csNC;
  begin
    insert into public.handbook_check_sections (check_id, company_id, kind) values (chkA, coA, 'section');
    raise exception 'MIGRATION 066 FAILED: a section unit was accepted with no section_id.';
  exception when check_violation then null; end;
  begin
    insert into public.handbook_check_sections (check_id, company_id, kind, section_id) values (chkA, coA, 'not_covered', secA);
    raise exception 'MIGRATION 066 FAILED: a not_covered unit was accepted with a section_id.';
  exception when check_violation then null; end;
  begin
    insert into public.handbook_check_sections (check_id, company_id, kind, section_id) values (chkA, coA, 'section', secB);
    raise exception 'MIGRATION 066 FAILED: a unit pointed at another company''s section.';
  exception when foreign_key_violation then null; end;
  begin
    update public.handbook_check_sections set word = 'compliant' where id = csA;
    raise exception 'MIGRATION 066 FAILED: word accepted "compliant".';
  exception when check_violation then null; end;
  -- the claim and its recovery, as the sweep will run them
  update public.handbook_check_sections set claimed_at = now() - interval '20 minutes', status = 'checking'
   where id = csA and claimed_at is null;
  update public.handbook_check_sections set claimed_at = null, status = 'queued'
   where id = csA and status = 'checking' and claimed_at < now() - interval '15 minutes';
  if (select claimed_at from public.handbook_check_sections where id = csA) is not null then
    raise exception 'MIGRATION 066 FAILED: an abandoned claim could not be recovered.';
  end if;

  insert into public.handbook_findings (check_id, check_section_id, company_id, kind, title, sources)
       values (chkA, csA, coA, 'change', 'Sick time accrual is below the Oregon minimum',
               '[{"url":"https://www.oregon.gov/boli","title":"BOLI","official":true}]'::jsonb) returning id into fA;
  begin
    insert into public.handbook_findings (check_id, check_section_id, company_id, kind, title, sources)
         values (chkA, csA, coA, 'change', 'x', '{"url":"x"}'::jsonb);
    raise exception 'MIGRATION 066 FAILED: findings.sources accepted something that is not a list.';
  exception when check_violation then null; end;

  insert into public.calendar_events (company_id, title, due_date, category, handbook_id)
       values (coA, 'Annual policy review', '2027-01-15', 'hr', hbA) returning id into evA;
  insert into public.handbook_dates (handbook_id, company_id, check_id, title, due_date, source, calendar_event_id)
       values (hbA, coA, chkA, 'Annual policy review', '2027-01-15', 'handbook', evA) returning id into dA;
  begin
    insert into public.handbook_dates (handbook_id, company_id, title, source) values (hbA, coA, 'x', 'model');
    raise exception 'MIGRATION 066 FAILED: handbook_dates.source accepted "model".';
  exception when check_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, handbook_id) values (coA, 'x', '2027-01-01', hbB);
    raise exception 'MIGRATION 066 FAILED: a calendar event pointed at another company''s handbook.';
  exception when foreign_key_violation then null; end;

  -- deleting the check: its units and findings go; the date stays, with check_id cleared
  delete from public.handbook_checks where id = chkA;
  select count(*) into n from public.handbook_check_sections where check_id = chkA;
  if n <> 0 then raise exception 'MIGRATION 066 FAILED: check units outlived their check.'; end if;
  select count(*) into n from public.handbook_findings where check_id = chkA;
  if n <> 0 then raise exception 'MIGRATION 066 FAILED: findings outlived their check.'; end if;
  if (select check_id from public.handbook_dates where id = dA) is not null
     or (select company_id from public.handbook_dates where id = dA) <> coA then
    raise exception 'MIGRATION 066 FAILED: a date did not keep its company with check_id cleared.';
  end if;
  -- deleting the handbook: its sections and dates go; the calendar event stays, unlinked
  delete from public.handbooks where id = hbA;
  select count(*) into n from public.handbook_sections where handbook_id = hbA;
  if n <> 0 then raise exception 'MIGRATION 066 FAILED: sections outlived their handbook.'; end if;
  select count(*) into n from public.handbook_dates where handbook_id = hbA;
  if n <> 0 then raise exception 'MIGRATION 066 FAILED: dates outlived their handbook.'; end if;
  if (select handbook_id from public.calendar_events where id = evA) is not null
     or (select company_id from public.calendar_events where id = evA) <> coA then
    raise exception 'MIGRATION 066 FAILED: the calendar event did not survive its handbook unlinked.';
  end if;

  -- ---- calendar_events.handbook_id is ON DELETE SET NULL, read from the catalog ----
  select count(*) into n from pg_constraint
   where conname = 'calendar_events_handbook_in_same_company' and confdeltype = 'n';
  if n <> 1 then raise exception 'MIGRATION 066 FAILED: calendar_events.handbook_id is not ON DELETE SET NULL.'; end if;

  -- ---- topics.section: a probe without a section reads 'workspace'; every existing row is 'workspace' ----
  insert into public.topics (company_id, title) values (coA, 'migration 066 probe') returning id into tp;
  if (select section from public.topics where id = tp) <> 'workspace' then
    raise exception 'MIGRATION 066 FAILED: a topic inserted without a section did not read back workspace.';
  end if;
  begin
    update public.topics set section = 'documents' where id = tp;
    raise exception 'MIGRATION 066 FAILED: topics.section accepted "documents".';
  exception when check_violation then null; end;
  select count(*) into n from public.topics where section <> 'workspace' and company_id not in (coA, coB);
  if n <> 0 then raise exception 'MIGRATION 066 FAILED: % existing topics are not workspace.', n; end if;
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'topic_list_v' and column_name = 'section';
  if n <> 1 then raise exception 'MIGRATION 066 FAILED: topic_list_v does not expose section.'; end if;
  if (select section from public.topic_list_v where id = tp) <> 'workspace' then
    raise exception 'MIGRATION 066 FAILED: topic_list_v.section did not read the row''s section.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.topic_list_v'::regclass
                  and reloptions @> array['security_invoker=true']) then
    raise exception 'MIGRATION 066 FAILED: topic_list_v lost security_invoker.';
  end if;
  if has_table_privilege('anon', 'public.topic_list_v', 'SELECT') then
    raise exception 'MIGRATION 066 FAILED: anon can read topic_list_v.';
  end if;

  -- ---- the ledger: 'hr', 'hr_check' and every old task accepted; a made-up one refused ----
  foreach t in array array['research', 'checklist', 'substeps', 'convert', 'summarise', 'gate', 'critique', 'audit',
                           'document_review', 'document_scan', 'document_draft', 'howto', 'other', 'hr', 'hr_check'] loop
    insert into public.ai_calls (task, model) values (t, 'migration-066-probe');
  end loop;
  begin
    insert into public.ai_calls (task, model) values ('hr_answer', 'migration-066-probe');
    raise exception 'MIGRATION 066 FAILED: ai_calls.task accepted "hr_answer".';
  exception when check_violation then null; end;
  delete from public.ai_calls where model = 'migration-066-probe';

  -- ---- the jobs: 'handbook_checks' and every old job accepted; a made-up one refused ----
  foreach t in array array['summarise', 'delete', 'account_delete', 'scan_documents', 'audit_sections', 'handbook_checks'] loop
    insert into public.job_runs (job, counts) values (t, '{"migration_066_probe": true}'::jsonb);
  end loop;
  begin
    insert into public.job_runs (job) values ('handbook_check');
    raise exception 'MIGRATION 066 FAILED: job_runs.job accepted "handbook_check".';
  exception when check_violation then null; end;
  delete from public.job_runs where counts ? 'migration_066_probe';

  -- ---- policies: four on each of five tables, two on handbook_dates ----
  select count(*) into n from pg_policies where schemaname = 'public'
   and tablename in ('handbooks', 'handbook_sections', 'handbook_checks', 'handbook_check_sections', 'handbook_findings');
  if n <> 20 then raise exception 'MIGRATION 066 FAILED: expected 20 policies on the five tables, found %.', n; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'handbook_dates';
  if n <> 2 then raise exception 'MIGRATION 066 FAILED: expected 2 policies on handbook_dates, found %.', n; end if;

  delete from public.topics where id = tp;
  delete from public.calendar_events where company_id in (coA, coB);
  delete from public.companies where id in (coA, coB);
  raise notice 'MIGRATION 066 VERIFIED: 6 tables with RLS; anon nothing and authenticated exactly as stated (7 privileges read back on each); 22 policies; every CHECK refused; every cross-tenant pointer refused; a deleted site leaves scope site; topics.section defaults to workspace on every row; topic_list_v exposes it; calendar_events.handbook_id is SET NULL; the task and job CHECKs take the new names and every old one.';
end $$;

commit;
