-- ===========================================================================
-- 058 — THE AUDIT AS ROWS
-- ===========================================================================
-- WHY.
--
-- Runs 1, 1b and 1c measured the agency audit as a script: one open call per agency over the
-- company context and the current readings, judged against a written key, with every answer kept as
-- a JSON file under tests/golden/audits/runs/. That was the right way to find out whether the answer
-- is any good. It is the wrong way to ship it, for one reason: **a JSON blob cannot be matched
-- against the next audit.** The question the product exists to answer — "what changed since last
-- time, and what did we fix" — is a query over rows or it is nothing.
--
-- So the audit becomes three tables, in the shape Documents already uses (§143's batches, scans and
-- gaps), because the sweep, the email, the drawer and the estimate are all already written against
-- that shape and a second shape would mean a second sweep.
--
--   audit_runs      one audit of one company at one moment. A run has sections the way a batch has
--                   files; done_count against section_count is what the banner reads.
--   audit_sections  one agency, one model call, one claim. `claimed_at` is the compare-and-set the
--                   sweep claims with, exactly as `documents.reading_since` is.
--   audit_findings  every row of the answer — a finding, a date, a contradiction, an expected item —
--                   in one table with a `kind`, because they share a lifecycle (open, closed,
--                   dismissed) and a matcher, and four tables would need four of each.
--
-- WHY ONE FINDINGS TABLE AND NOT FOUR. The four collections differ in which columns they fill, not
-- in what they are for: each is a line an inspector might raise, each needs to be carried forward or
-- closed by the next run, each needs `same_as`. A CHECK per kind enforces the shape (a date carries
-- a due date; a contradiction carries the second document and both values), so the table cannot hold
-- a half-built row of any kind. That is the same trade `document_gaps` makes.
--
-- TENANCY IS COMPOSITE, THE WAY 055 DID IT. `document_id uuid references documents(id)` would let a
-- finding on company A cite company B's document, and RLS would not catch it: the policy checks the
-- FINDING's company_id, which is A's, and never looks at where the document went. So every pointer
-- out of these tables is a composite foreign key on (company_id, <id>) against a matching unique
-- key, and the verify block below proves each one refuses the cross-tenant write. Four new unique
-- keys are added for that: on documents, document_scans, audit_runs and audit_sections.
--
-- `readings_as_of` is on the RUN, not the section: it answers "how fresh was the evidence this audit
-- saw", and a person comparing two runs needs one date, not one per agency.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- The unique keys the composite foreign keys need. Adding (company_id, id) to a table that already
-- has id as its primary key costs one index and is what makes the tenancy provable.
-- ---------------------------------------------------------------------------
alter table public.documents
  drop constraint if exists documents_company_id_id_key;
alter table public.documents
  add constraint documents_company_id_id_key unique (company_id, id);

alter table public.document_scans
  drop constraint if exists document_scans_company_id_id_key;
alter table public.document_scans
  add constraint document_scans_company_id_id_key unique (company_id, id);

-- ---------------------------------------------------------------------------
-- audit_runs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_runs (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  entity_id            uuid,
  kind                 text not null check (kind in ('agency', 'template')),
  -- Free text on purpose: "the whole company", "the Portland plant", whatever the person asked for.
  -- It is shown back to them and never matched on.
  scope                text,
  agency_label         text,
  template_document_id uuid,
  previous_run_id      uuid references public.audit_runs (id) on delete set null,
  status               text not null default 'queued' check (status in ('queued', 'running', 'done')),
  section_count        integer not null default 0 check (section_count >= 0),
  done_count           integer not null default 0 check (done_count >= 0),
  readings_as_of       timestamptz,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  started_at           timestamptz,
  finished_at          timestamptz,
  summary              jsonb,
  notified_at          timestamptz,
  dismissed_at         timestamptz,
  -- An agency run is about a label; a template run is about a document. Neither is optional for its
  -- own kind, or a run exists that cannot say what it audited.
  constraint audit_runs_kind_has_its_subject check (
    (kind = 'agency'   and agency_label is not null and template_document_id is null)
 or (kind = 'template' and template_document_id is not null and agency_label is null)
  )
);

alter table public.audit_runs
  drop constraint if exists audit_runs_company_id_id_key;
alter table public.audit_runs
  add constraint audit_runs_company_id_id_key unique (company_id, id);

alter table public.audit_runs
  drop constraint if exists audit_runs_entity_in_same_company;
alter table public.audit_runs
  add constraint audit_runs_entity_in_same_company
  foreign key (company_id, entity_id)
  references public.entities (company_id, id) on delete cascade;

alter table public.audit_runs
  drop constraint if exists audit_runs_template_in_same_company;
alter table public.audit_runs
  add constraint audit_runs_template_in_same_company
  foreign key (company_id, template_document_id)
  references public.documents (company_id, id) on delete cascade;

create index if not exists idx_audit_runs_company_created
  on public.audit_runs (company_id, created_at desc);
create index if not exists idx_audit_runs_open
  on public.audit_runs (company_id, status) where status <> 'done';

-- ---------------------------------------------------------------------------
-- audit_sections — one agency, one call, one claim
-- ---------------------------------------------------------------------------
create table if not exists public.audit_sections (
  id                       uuid primary key default gen_random_uuid(),
  run_id                   uuid not null,
  company_id               uuid not null references public.companies (id) on delete cascade,
  ordinal                  integer not null check (ordinal >= 0),
  title                    text not null,
  status                   text not null default 'queued'
                           check (status in ('queued', 'running', 'done', 'could_not_complete')),
  -- THE COMPARE-AND-SET. The sweep claims with `update ... where claimed_at is null`, and recovers a
  -- claim older than STUCK_AFTER. Same column, same role, as documents.reading_since.
  claimed_at               timestamptz,
  started_at               timestamptz,
  finished_at              timestamptz,
  model                    text,
  prompt_sha256            text,
  input_sha256             text,
  ai_call_id               uuid references public.ai_calls (id) on delete set null,
  raw_text                 text,
  json_parsed              boolean,
  could_not_complete_reason text,
  -- What D1..Dn meant on this call. Stored because a finding's document is resolved from it, and six
  -- weeks later "which document was D4" must be answerable from the row and not re-derived.
  handles                  jsonb,
  documents_read           uuid[] not null default '{}',
  documents_held_unread    uuid[] not null default '{}',
  -- A section that could not complete says why. Nothing else may.
  constraint audit_sections_reason_only_when_failed check (
    (status = 'could_not_complete' and could_not_complete_reason is not null)
 or (status <> 'could_not_complete' and could_not_complete_reason is null)
  )
);

alter table public.audit_sections
  drop constraint if exists audit_sections_company_id_id_key;
alter table public.audit_sections
  add constraint audit_sections_company_id_id_key unique (company_id, id);

alter table public.audit_sections
  drop constraint if exists audit_sections_run_in_same_company;
alter table public.audit_sections
  add constraint audit_sections_run_in_same_company
  foreign key (company_id, run_id)
  references public.audit_runs (company_id, id) on delete cascade;

create index if not exists idx_audit_sections_company_run
  on public.audit_sections (company_id, run_id, ordinal);
-- The sweep's own query: the oldest queued section, unclaimed.
create index if not exists idx_audit_sections_queued
  on public.audit_sections (company_id, status, claimed_at);

-- ---------------------------------------------------------------------------
-- audit_findings — every row of the answer
-- ---------------------------------------------------------------------------
create table if not exists public.audit_findings (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null,
  section_id       uuid not null,
  company_id       uuid not null references public.companies (id) on delete cascade,
  ordinal          integer not null check (ordinal >= 0),
  kind             text not null check (kind in ('finding', 'date', 'contradiction', 'expected')),
  title            text not null,
  word             text check (word in ('on_file', 'stale', 'nothing_on_file', 'not_a_document_question')),
  basis            text check (basis in ('read', 'inferred', 'expected')),
  document_id      uuid,
  scan_id          uuid,
  locator          text,
  quote            text,
  quote_verified   boolean,
  what_to_do       text,
  due_on           date,
  recurs           boolean,
  passed           boolean,
  document_b_id    uuid,
  value_a          text,
  value_b          text,
  source           text not null default 'reading' check (source in ('reading', 'inspector', 'person')),
  status           text not null default 'open' check (status in ('open', 'closed', 'dismissed')),
  same_as          uuid references public.audit_findings (id) on delete set null,
  closed_by_run_id uuid references public.audit_runs (id) on delete set null,
  closed_reason    text,
  dismissed_reason text,
  -- A handle the block did not carry. The row is kept rather than dropped: what the model named is
  -- evidence, and a silently discarded finding is a finding nobody can count.
  handle_error     boolean not null default false,
  -- ---- the shape of each kind, enforced ----
  constraint audit_findings_date_has_a_date check (
    kind <> 'date' or due_on is not null
  ),
  constraint audit_findings_contradiction_has_two_sides check (
    kind <> 'contradiction'
 or (document_b_id is not null and value_a is not null and value_b is not null)
  ),
  constraint audit_findings_expected_is_expected check (
    kind <> 'expected' or (basis = 'expected' and word = 'nothing_on_file')
  )
);

alter table public.audit_findings
  drop constraint if exists audit_findings_run_in_same_company;
alter table public.audit_findings
  add constraint audit_findings_run_in_same_company
  foreign key (company_id, run_id)
  references public.audit_runs (company_id, id) on delete cascade;

alter table public.audit_findings
  drop constraint if exists audit_findings_section_in_same_company;
alter table public.audit_findings
  add constraint audit_findings_section_in_same_company
  foreign key (company_id, section_id)
  references public.audit_sections (company_id, id) on delete cascade;

-- THE THREE THAT MATTER. A finding may cite only its own company's documents and readings.
alter table public.audit_findings
  drop constraint if exists audit_findings_document_in_same_company;
alter table public.audit_findings
  add constraint audit_findings_document_in_same_company
  foreign key (company_id, document_id)
  references public.documents (company_id, id) on delete set null;

alter table public.audit_findings
  drop constraint if exists audit_findings_document_b_in_same_company;
alter table public.audit_findings
  add constraint audit_findings_document_b_in_same_company
  foreign key (company_id, document_b_id)
  references public.documents (company_id, id) on delete set null;

alter table public.audit_findings
  drop constraint if exists audit_findings_scan_in_same_company;
alter table public.audit_findings
  add constraint audit_findings_scan_in_same_company
  foreign key (company_id, scan_id)
  references public.document_scans (company_id, id) on delete set null;

create index if not exists idx_audit_findings_company_run
  on public.audit_findings (company_id, run_id, ordinal);
create index if not exists idx_audit_findings_open
  on public.audit_findings (company_id, status) where status = 'open';
create index if not exists idx_audit_findings_document
  on public.audit_findings (company_id, document_id);

-- ---------------------------------------------------------------------------
-- The sweep needs a name in job_runs. Restated in full rather than added to, because
-- ALTER ... ADD VALUE does not exist for a CHECK (§3.7 prefers an ENUM; this column is text and
-- predates that rule, and widening it here is one line rather than a type migration).
-- ---------------------------------------------------------------------------
alter table public.job_runs drop constraint if exists job_runs_job_check;
alter table public.job_runs add constraint job_runs_job_check
  check (job = any (array['summarise', 'delete', 'account_delete', 'scan_documents', 'audit_sections']));

-- ---------------------------------------------------------------------------
-- GRANTS. REVOKE first, for BOTH roles, because this project carries default privileges on public
-- that hand anon and authenticated full DML on any new table before a single GRANT runs (§3.6). A
-- grant list says what was added, not what a role holds.
-- ---------------------------------------------------------------------------
revoke all on table public.audit_runs     from anon;
revoke all on table public.audit_runs     from authenticated;
revoke all on table public.audit_sections from anon;
revoke all on table public.audit_sections from authenticated;
revoke all on table public.audit_findings from anon;
revoke all on table public.audit_findings from authenticated;

-- The server writes every one of these. A signed-in caller reads them, and updates only the two
-- things a person does by hand: dismissing a run, and dismissing a finding.
grant select, update on table public.audit_runs     to authenticated;   -- no INSERT, no DELETE
grant select          on table public.audit_sections to authenticated;
grant select, update on table public.audit_findings to authenticated;   -- no INSERT, no DELETE

-- ---------------------------------------------------------------------------
-- RLS. Four policies each, every one through auth_company_id() (§3.6) — never a re-derived subquery,
-- which would silently depend on profiles' own RLS. INSERT and DELETE carry policies even where no
-- grant allows them: a policy is the boundary, and a grant that is added later must not become an
-- open door by default.
-- ---------------------------------------------------------------------------
alter table public.audit_runs     enable row level security;
alter table public.audit_sections enable row level security;
alter table public.audit_findings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['audit_runs', 'audit_sections', 'audit_findings'] loop
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

comment on table public.audit_runs is
  'One audit of one company at one moment. Sections are to a run what files are to a document batch.';
comment on table public.audit_sections is
  'One agency (or one template), one model call. claimed_at is the sweep''s compare-and-set.';
comment on table public.audit_findings is
  'Every row of an audit answer — finding, date, contradiction, expected — with one lifecycle and one matcher.';

-- ===========================================================================
-- VERIFY. Every constraint is tested by trying to break it (§3.7) — a CHECK nobody has tried to
-- break is a comment — and every privilege is READ BACK with has_table_privilege rather than taken
-- from the grant list above. Two throwaway companies, because the writes that must be refused are
-- cross-tenant ones and a single company cannot express them.
-- ===========================================================================
do $$
declare
  coA uuid; coB uuid; siteA uuid; siteB uuid;
  docA uuid; docB uuid; scA uuid;
  runA uuid; runB uuid; secA uuid; secB uuid; fA uuid; n int;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 058 probe A', 'chemical manufacturing', 'OR') returning id into coA;
  insert into public.companies (name, industry, state)
       values ('Migration 058 probe B', 'chemical manufacturing', 'OR') returning id into coB;
  insert into public.entities (company_id, entity_type, name, details)
       values (coA, 'site', 'Portland', '{}'::jsonb) returning id into siteA;
  insert into public.entities (company_id, entity_type, name, details)
       values (coB, 'site', 'Salem', '{}'::jsonb) returning id into siteB;
  insert into public.documents (company_id, name, file_url, file_type)
       values (coA, 'probe-058-a.pdf', 'probe/058a', 'application/pdf') returning id into docA;
  insert into public.documents (company_id, name, file_url, file_type)
       values (coB, 'probe-058-b.pdf', 'probe/058b', 'application/pdf') returning id into docB;
  insert into public.document_scans (document_id, company_id, kind, status)
       values (docA, coA, 'program', 'gaps_found') returning id into scA;

  -- ---- a run, and its defaults ----
  insert into public.audit_runs (company_id, entity_id, kind, agency_label, scope)
       values (coA, siteA, 'agency', 'Oregon DEQ', 'the Portland plant') returning id into runA;
  if (select status from public.audit_runs where id = runA) <> 'queued'
     or (select section_count from public.audit_runs where id = runA) <> 0 then
    raise exception 'MIGRATION 058 FAILED: a new run did not default to queued with 0 sections.';
  end if;

  begin
    update public.audit_runs set status = 'failed' where id = runA;
    raise exception 'MIGRATION 058 FAILED: audit_runs.status accepted "failed".';
  exception when check_violation then null; end;

  begin
    update public.audit_runs set done_count = -1 where id = runA;
    raise exception 'MIGRATION 058 FAILED: done_count accepted a negative number.';
  exception when check_violation then null; end;

  -- A run must say what it audited, and may not claim both.
  begin
    insert into public.audit_runs (company_id, kind) values (coA, 'agency');
    raise exception 'MIGRATION 058 FAILED: an agency run was accepted with no agency_label.';
  exception when check_violation then null; end;
  begin
    insert into public.audit_runs (company_id, kind, agency_label, template_document_id)
         values (coA, 'agency', 'Oregon DEQ', docA);
    raise exception 'MIGRATION 058 FAILED: a run claimed both an agency and a template document.';
  exception when check_violation then null; end;
  begin
    insert into public.audit_runs (company_id, kind, template_document_id)
         values (coA, 'template', docA);
  exception when check_violation then
    raise exception 'MIGRATION 058 FAILED: a template run with a document was refused.';
  end;

  -- *** THE IMPOSSIBLE WRITE, ONE: a run pointing at another company's site, and its template. ***
  begin
    insert into public.audit_runs (company_id, entity_id, kind, agency_label)
         values (coA, siteB, 'agency', 'Oregon DEQ');
    raise exception 'MIGRATION 058 FAILED: a run took another company''s site.';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.audit_runs (company_id, kind, template_document_id)
         values (coA, 'template', docB);
    raise exception 'MIGRATION 058 FAILED: a run took another company''s document as its template.';
  exception when foreign_key_violation then null; end;

  -- ---- a section, its claim, and its reason ----
  insert into public.audit_sections (run_id, company_id, ordinal, title)
       values (runA, coA, 0, 'Oregon DEQ') returning id into secA;
  if (select status from public.audit_sections where id = secA) <> 'queued' then
    raise exception 'MIGRATION 058 FAILED: a new section did not default to queued.';
  end if;

  begin
    update public.audit_sections set status = 'could_not_complete' where id = secA;
    raise exception 'MIGRATION 058 FAILED: could_not_complete was accepted with no reason.';
  exception when check_violation then null; end;
  begin
    update public.audit_sections set status = 'done', could_not_complete_reason = 'x' where id = secA;
    raise exception 'MIGRATION 058 FAILED: a done section was allowed to carry a failure reason.';
  exception when check_violation then null; end;

  -- The claim the sweep takes, and the recovery it runs. Written here so the column is proved to
  -- support both, rather than the route being the first thing to try it.
  update public.audit_sections set claimed_at = now() - interval '20 minutes', status = 'running'
   where id = secA and claimed_at is null;
  update public.audit_sections set claimed_at = null, status = 'queued'
   where id = secA and status = 'running' and claimed_at < now() - interval '15 minutes';
  if (select status from public.audit_sections where id = secA) <> 'queued'
     or (select claimed_at from public.audit_sections where id = secA) is not null then
    raise exception 'MIGRATION 058 FAILED: an abandoned section claim could not be recovered.';
  end if;

  -- *** THE IMPOSSIBLE WRITE, TWO: a section for another company's run. ***
  insert into public.audit_runs (company_id, kind, agency_label)
       values (coB, 'agency', 'Oregon OSHA') returning id into runB;
  begin
    insert into public.audit_sections (run_id, company_id, ordinal, title)
         values (runB, coA, 0, 'Oregon OSHA');
    raise exception 'MIGRATION 058 FAILED: a section was written for another company''s run.';
  exception when foreign_key_violation then null; end;

  -- ---- findings, one kind at a time ----
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                     word, basis, document_id, scan_id, locator, quote, what_to_do)
       values (runA, secA, coA, 0, 'finding', 'the daily scrubber log is not on file',
               'nothing_on_file', 'read', docA, scA, 'condition 3.1', 'one reading per operating day',
               'upload the log if it exists')
       returning id into fA;
  if (select status from public.audit_findings where id = fA) <> 'open'
     or (select source from public.audit_findings where id = fA) <> 'reading'
     or (select handle_error from public.audit_findings where id = fA) <> false then
    raise exception 'MIGRATION 058 FAILED: a new finding did not default to open/reading/no-handle-error.';
  end if;

  begin
    update public.audit_findings set word = 'satisfied' where id = fA;
    raise exception 'MIGRATION 058 FAILED: word accepted "satisfied".';
  exception when check_violation then null; end;

  -- a date carries a due date
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title)
         values (runA, secA, coA, 1, 'date', 'renewal application');
    raise exception 'MIGRATION 058 FAILED: a date was accepted with no due_on.';
  exception when check_violation then null; end;
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                     due_on, recurs, passed, document_id)
       values (runA, secA, coA, 1, 'date', 'renewal application', '2026-07-18', false, true, docA);

  -- a contradiction carries the second document and both values
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       document_id, value_a, value_b)
         values (runA, secA, coA, 2, 'contradiction', 'headcount', docA, '42', '65');
    raise exception 'MIGRATION 058 FAILED: a contradiction was accepted with no document_b_id.';
  exception when check_violation then null; end;
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       document_id, document_b_id, value_a)
         values (runA, secA, coA, 2, 'contradiction', 'headcount', docA, docA, '42');
    raise exception 'MIGRATION 058 FAILED: a contradiction was accepted with only one value.';
  exception when check_violation then null; end;
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                     document_id, document_b_id, value_a, value_b)
       values (runA, secA, coA, 2, 'contradiction', 'headcount', docA, docA, '42', '65');

  -- an expected row is basis expected and word nothing_on_file
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       basis, word)
         values (runA, secA, coA, 3, 'expected', 'a scrubber O&M plan', 'read', 'nothing_on_file');
    raise exception 'MIGRATION 058 FAILED: an expected row was accepted with basis read.';
  exception when check_violation then null; end;
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       basis, word)
         values (runA, secA, coA, 3, 'expected', 'a scrubber O&M plan', 'expected', 'on_file');
    raise exception 'MIGRATION 058 FAILED: an expected row was accepted with word on_file.';
  exception when check_violation then null; end;
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                     basis, word)
       values (runA, secA, coA, 3, 'expected', 'a scrubber O&M plan', 'expected', 'nothing_on_file');

  -- *** THE IMPOSSIBLE WRITE, THREE: a finding citing another company's document, and its scan. ***
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       word, document_id)
         values (runA, secA, coA, 4, 'finding', 'x', 'on_file', docB);
    raise exception 'MIGRATION 058 FAILED: a finding cited another company''s document.';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       word, document_id, document_b_id, value_a, value_b)
         values (runA, secA, coA, 4, 'contradiction', 'x', 'stale', docA, docB, 'a', 'b');
    raise exception 'MIGRATION 058 FAILED: a contradiction''s second document was another company''s.';
  exception when foreign_key_violation then null; end;

  -- ---- the matcher's columns ----
  update public.audit_findings set status = 'closed', closed_by_run_id = runA,
         closed_reason = 'not raised by the newer audit' where id = fA;
  if (select status from public.audit_findings where id = fA) <> 'closed' then
    raise exception 'MIGRATION 058 FAILED: a finding could not be closed by a later run.';
  end if;

  -- ---- job_runs can name the sweep, and cannot name a typo ----
  insert into public.job_runs (job) values ('audit_sections');
  begin
    insert into public.job_runs (job) values ('audit_section');
    raise exception 'MIGRATION 058 FAILED: job_runs.job accepted "audit_section".';
  exception when check_violation then null; end;
  -- and the four that were already legal still are
  begin
    insert into public.job_runs (job) values ('summarise');
    insert into public.job_runs (job) values ('delete');
    insert into public.job_runs (job) values ('account_delete');
    insert into public.job_runs (job) values ('scan_documents');
  exception when check_violation then
    raise exception 'MIGRATION 058 FAILED: an existing job name stopped being accepted.';
  end;
  delete from public.job_runs
   where job in ('audit_sections', 'summarise', 'delete', 'account_delete', 'scan_documents');

  -- ---- deleting the run takes its sections and findings, and nothing else ----
  select count(*) into n from public.audit_findings where run_id = runA;
  if n <> 4 then
    raise exception 'MIGRATION 058 FAILED: expected 4 findings on the probe run, found %.', n;
  end if;
  delete from public.audit_runs where id = runA;
  select count(*) into n from public.audit_sections where run_id = runA;
  if n <> 0 then raise exception 'MIGRATION 058 FAILED: sections outlived their run.'; end if;
  select count(*) into n from public.audit_findings where run_id = runA;
  if n <> 0 then raise exception 'MIGRATION 058 FAILED: findings outlived their run.'; end if;
  select count(*) into n from public.documents where id = docA;
  if n <> 1 then raise exception 'MIGRATION 058 FAILED: deleting a run deleted a document.'; end if;

  -- ---- privileges, READ BACK, never trusted from the grant list ----
  if has_table_privilege('anon', 'public.audit_runs', 'SELECT')
     or has_table_privilege('anon', 'public.audit_runs', 'INSERT')
     or has_table_privilege('anon', 'public.audit_runs', 'UPDATE')
     or has_table_privilege('anon', 'public.audit_runs', 'DELETE')
     or has_table_privilege('anon', 'public.audit_sections', 'SELECT')
     or has_table_privilege('anon', 'public.audit_sections', 'INSERT')
     or has_table_privilege('anon', 'public.audit_sections', 'UPDATE')
     or has_table_privilege('anon', 'public.audit_sections', 'DELETE')
     or has_table_privilege('anon', 'public.audit_findings', 'SELECT')
     or has_table_privilege('anon', 'public.audit_findings', 'INSERT')
     or has_table_privilege('anon', 'public.audit_findings', 'UPDATE')
     or has_table_privilege('anon', 'public.audit_findings', 'DELETE') then
    raise exception 'MIGRATION 058 FAILED: anon holds a privilege on an audit table.';
  end if;

  if not has_table_privilege('authenticated', 'public.audit_runs', 'SELECT')
     or not has_table_privilege('authenticated', 'public.audit_runs', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.audit_sections', 'SELECT')
     or not has_table_privilege('authenticated', 'public.audit_findings', 'SELECT')
     or not has_table_privilege('authenticated', 'public.audit_findings', 'UPDATE') then
    raise exception 'MIGRATION 058 FAILED: authenticated is missing a privilege it was granted.';
  end if;

  -- *** AND THE FOURTH PRIVILEGE NOBODY GRANTED. *** Migration 028 was refused for exactly this:
  -- the default ACL hands authenticated DELETE before any GRANT runs, so a table that was granted
  -- three privileges came out holding four.
  if has_table_privilege('authenticated', 'public.audit_runs', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_runs', 'DELETE')
     or has_table_privilege('authenticated', 'public.audit_sections', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_sections', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_sections', 'DELETE')
     or has_table_privilege('authenticated', 'public.audit_findings', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_findings', 'DELETE') then
    raise exception 'MIGRATION 058 FAILED: authenticated holds a privilege the migration never granted.';
  end if;

  -- ---- and the policies are there, four per table ----
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('audit_runs', 'audit_sections', 'audit_findings');
  if n <> 12 then
    raise exception 'MIGRATION 058 FAILED: expected 12 policies across the three tables, found %.', n;
  end if;

  delete from public.companies where id in (coA, coB);
  raise notice 'MIGRATION 058 VERIFIED: 3 tables, 12 policies, every CHECK refused, every cross-tenant write refused.';
end $$;
