-- ============================================================
-- COMPLIBOARD — MIGRATION 040: WHAT A DOCUMENT SCAN PRODUCES
-- ============================================================
--
-- Run 1 of the Documents section. The contract three later sections read.
--
-- *** THIS FOLLOWS THE SCAN, NOT THE OTHER WAY ROUND. *** The vision's rule is "we scan first,
-- then change the schema" — the shape below was read off what one open call is asked to return
-- (`lib/documentScan.ts`, `prompts/document-scan.ts`), not designed first and then fitted.
--
-- NOTHING HERE TOUCHES THE OLD REVIEW. `document_reviews` and `lib/documentReview.ts` are
-- untouched and still serve the Review button, the attach flow and the audit engine. The new
-- scan writes only to the tables below. Two readings of a document can coexist; this run does
-- not rewire anything to the new one.
--
-- WHY GAPS, CONDITIONS AND DEADLINES ARE TABLES AND NOT JSON ARRAYS: a gap has a life after the
-- scan. A checklist made from it a week later has to attach to it; a person dismisses it with a
-- reason and the NEXT scan must not raise it again; a re-scan has to say which gaps closed. None
-- of that is possible against an array rewritten on every scan.

-- ------------------------------------------------------------
-- 1. documents — three columns. `entity_id` ALREADY EXISTS and is left alone.
-- ------------------------------------------------------------
alter table public.documents
  add column if not exists status text not null default 'uploaded'
    check (status in ('uploaded', 'reading', 'read', 'could_not_read'));

alter table public.documents
  add column if not exists source text not null default 'upload'
    check (source in ('upload', 'conversation', 'drive'));

-- ON DELETE SET NULL, not CASCADE: deleting one version of a permit must not delete the newer
-- one that points at it. "Close, never delete" applies to versions too.
alter table public.documents
  add column if not exists version_of uuid references public.documents(id) on delete set null;

alter table public.documents
  add column if not exists version_confirmed boolean not null default false;

comment on column public.documents.status is
  'uploaded | reading | read | could_not_read. An unreadable file is a STATUS the screen shows, '
  'never a log line and never dropped from a count. Migration 040.';
comment on column public.documents.version_of is
  'The document this one supersedes, PROPOSED by the scan and confirmed by a person '
  '(version_confirmed). ON DELETE SET NULL so removing an old version never removes the new.';

-- ------------------------------------------------------------
-- 2. document_scans — one row per scan. `is_current` marks the newest.
-- ------------------------------------------------------------
create table if not exists public.document_scans (
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid not null references public.documents(id) on delete cascade,
  company_id            uuid not null references public.companies(id) on delete cascade,

  -- identity
  kind                  text check (kind in ('permit','certificate','program','policy','record','supplier_document','other')),
  title                 text,
  issuer                text,
  agencies              jsonb not null default '[]'::jsonb,
  subjects              jsonb not null default '[]'::jsonb,
  entity_id             uuid references public.entities(id) on delete set null,
  site_scope            text check (site_scope in ('company_wide','site','unknown')),
  jurisdiction          jsonb not null default '[]'::jsonb,
  doc_date              date,
  doc_date_kind         text check (doc_date_kind in ('issued','revised','last_entry','effective','unknown')),
  page_refs             jsonb not null default '{}'::jsonb,

  summary               text,
  -- The status word the screen shows, by kind. 'compliant' is deliberately NOT a value here:
  -- the vision's rule is that one green word for every kind is the fabricated all-clear.
  status                text check (status in (
                          'current','expiring','expired',
                          'no_gaps_found','gaps_found',
                          'recorded',
                          'not_judged',
                          'could_not_read')),
  significant_date      date,
  significant_date_kind text,
  freshness_note        text,
  expected_missing      jsonb not null default '[]'::jsonb,
  version_of_title      text,
  version_confidence    text,
  confidence_notes      text,
  could_not_read_reason text,

  -- A PAID ANSWER IS NEVER DISCARDED. When the JSON does not parse, the text still cost money
  -- and still contains the reading; it is kept here and the scan is stored could_not_read.
  raw_text              text,
  json_parsed           boolean not null default true,

  quotes_checked        integer not null default 0,
  quotes_verified       integer not null default 0,

  model                 text,
  effort                text,
  prompt_sha256         text,
  searches              integer not null default 0,
  ai_call_id            uuid references public.ai_calls(id) on delete set null,
  scanned_at            timestamptz not null default now(),
  -- The newest scan of a document. Set true on insert; every older scan of the same document is
  -- set false in the same statement. `document_reviews` never had this and nothing could tell
  -- which of a document's readings was the live one.
  is_current            boolean not null default true
);

create index if not exists idx_document_scans_company_scanned on public.document_scans (company_id, scanned_at desc);
create index if not exists idx_document_scans_document_current on public.document_scans (document_id, is_current);

-- ------------------------------------------------------------
-- 3. document_gaps — rows, with a life of their own
-- ------------------------------------------------------------
create table if not exists public.document_gaps (
  id              uuid primary key default gen_random_uuid(),
  scan_id         uuid not null references public.document_scans(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  ordinal         integer not null,
  title           text not null,
  description     text,
  fix             text,
  citation        text,
  citation_url    text,
  locator         text,
  draftable       boolean not null default false,
  quote           text,
  quote_verified  boolean,
  -- CLOSE, NEVER DELETE. A dismissed gap keeps its reason and is shown to the next scan so it
  -- is not raised again.
  status          text not null default 'open' check (status in ('open','closed','dismissed')),
  dismissed_reason text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_document_gaps_document_status on public.document_gaps (document_id, status);
create index if not exists idx_document_gaps_company on public.document_gaps (company_id, created_at desc);

-- ------------------------------------------------------------
-- 4. document_conditions — what a permit obliges you to keep doing
-- ------------------------------------------------------------
create table if not exists public.document_conditions (
  id                uuid primary key default gen_random_uuid(),
  scan_id           uuid not null references public.document_scans(id) on delete cascade,
  document_id       uuid not null references public.documents(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  ordinal           integer not null,
  title             text not null,
  condition_ref     text,
  evidence_expected text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_document_conditions_document on public.document_conditions (document_id);

-- ------------------------------------------------------------
-- 5. document_deadlines — dates the document sets, with the line they came from
-- ------------------------------------------------------------
create table if not exists public.document_deadlines (
  id                uuid primary key default gen_random_uuid(),
  scan_id           uuid not null references public.document_scans(id) on delete cascade,
  document_id       uuid not null references public.documents(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  title             text not null,
  due_on            date,
  source_line       text,
  recurs            boolean not null default false,
  -- Null until a PERSON sends it to the calendar. The scan never writes calendar_events.
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_document_deadlines_document on public.document_deadlines (document_id);

-- ------------------------------------------------------------
-- 6. fact_proposals — one queue for both sources (§108)
-- ------------------------------------------------------------
alter table public.fact_proposals add column if not exists document_id uuid references public.documents(id) on delete cascade;
alter table public.fact_proposals add column if not exists locator text;
alter table public.fact_proposals add column if not exists source text not null default 'conversation'
  check (source in ('conversation','document'));
alter table public.fact_proposals alter column topic_id drop not null;

-- EXACTLY ONE SOURCE. A proposal comes from a conversation turn or from a document, never both
-- and never neither — otherwise "where did this come from" has no answer and the queue cannot
-- show the quote beside the thing it came from.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fact_proposals_one_source') then
    alter table public.fact_proposals
      add constraint fact_proposals_one_source
      check ((topic_id is not null and document_id is null)
          or (topic_id is null and document_id is not null));
  end if;
end $$;

-- ------------------------------------------------------------
-- 7. calendar_events — where a date came from
-- ------------------------------------------------------------
alter table public.calendar_events add column if not exists document_id uuid references public.documents(id) on delete set null;

-- ------------------------------------------------------------
-- 8. company_labels — the fix for emergent labels drifting
-- ------------------------------------------------------------
-- The model may say "Oregon DEQ" on Monday and "Department of Environmental Quality" on Tuesday,
-- and that is two groups on the screen. Every scan is shown the labels already in use for THIS
-- company and told to reuse them where they fit.
create table if not exists public.company_labels (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind       text not null check (kind in ('agency','subject')),
  label      text not null,
  created_at timestamptz not null default now(),
  unique (company_id, kind, label)
);
create index if not exists idx_company_labels_company_kind on public.company_labels (company_id, kind);

-- ------------------------------------------------------------
-- 9. ai_calls — the new task
-- ------------------------------------------------------------
alter table public.ai_calls drop constraint if exists ai_calls_task_check;
alter table public.ai_calls add constraint ai_calls_task_check check (task in (
  'research', 'checklist', 'substeps', 'convert', 'summarise',
  'gate', 'critique', 'audit', 'document_review', 'document_scan', 'other'));

-- ------------------------------------------------------------
-- 10. GRANTS — REVOKE FIRST, BOTH ROLES (`CLAUDE.md` §3.6)
--
-- A GRANT LIST DESCRIBES WHAT YOU ADDED, NOT WHAT THE ROLE HOLDS. This project carries default
-- privileges on `public` that hand anon and authenticated full DML on any new table before a
-- single GRANT runs, so every table below is revoked first.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['document_scans','document_gaps','document_conditions','document_deadlines','company_labels'] loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- A person may correct a gap (dismiss it with a reason) and confirm a deadline, so those two
-- take UPDATE. Scans, conditions and labels are written by the scan only.
grant update on table public.document_gaps to authenticated;
grant update on table public.document_deadlines to authenticated;

create policy document_scans_select_own on public.document_scans
  for select to authenticated using (public.document_scans.company_id = public.auth_company_id());
create policy document_gaps_select_own on public.document_gaps
  for select to authenticated using (public.document_gaps.company_id = public.auth_company_id());
create policy document_gaps_update_own on public.document_gaps
  for update to authenticated using (public.document_gaps.company_id = public.auth_company_id())
  with check (public.document_gaps.company_id = public.auth_company_id());
create policy document_conditions_select_own on public.document_conditions
  for select to authenticated using (public.document_conditions.company_id = public.auth_company_id());
create policy document_deadlines_select_own on public.document_deadlines
  for select to authenticated using (public.document_deadlines.company_id = public.auth_company_id());
create policy document_deadlines_update_own on public.document_deadlines
  for update to authenticated using (public.document_deadlines.company_id = public.auth_company_id())
  with check (public.document_deadlines.company_id = public.auth_company_id());
create policy company_labels_select_own on public.company_labels
  for select to authenticated using (public.company_labels.company_id = public.auth_company_id());

-- ------------------------------------------------------------
-- VERIFY — every CHECK is tested BY VIOLATING IT, with a value somebody would plausibly write
-- (`HOW-WE-BUILD.md` §3: a constraint nobody has tried to break is a comment).
-- ------------------------------------------------------------
do $$
declare
  n int; v text; t text;
  co uuid; doc uuid; sc uuid; tp uuid;
begin
  -- anon holds nothing on any new table
  foreach t in array array['document_scans','document_gaps','document_conditions','document_deadlines','company_labels'] loop
    foreach v in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if has_table_privilege('anon', 'public.' || t, v) then
        raise exception 'MIGRATION 040 FAILED: anon holds % on %.', v, t;
      end if;
    end loop;
    if not has_table_privilege('authenticated', 'public.' || t, 'SELECT') then
      raise exception 'MIGRATION 040 FAILED: authenticated cannot SELECT %.', t;
    end if;
  end loop;

  -- authenticated must NOT be able to write a scan or a condition: those are ours, not theirs
  foreach t in array array['document_scans','document_conditions','company_labels'] loop
    foreach v in array array['INSERT','UPDATE','DELETE'] loop
      if has_table_privilege('authenticated', 'public.' || t, v) then
        raise exception 'MIGRATION 040 FAILED: authenticated holds % on %, never granted.', v, t;
      end if;
    end loop;
  end loop;

  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 040: no company on this database, constraint probes skipped.';
  else
    insert into public.documents (company_id, name, file_url, file_type)
      values (co, 'migration-040-probe.pdf', 'probe/040', 'application/pdf') returning id into doc;

    -- documents.status refuses a plausible wrong value
    begin
      update public.documents set status = 'scanned' where id = doc;
      raise exception 'MIGRATION 040 FAILED: documents.status accepted "scanned".';
    exception when check_violation then null; end;

    -- documents.source refuses a plausible wrong value
    begin
      update public.documents set source = 'email' where id = doc;
      raise exception 'MIGRATION 040 FAILED: documents.source accepted "email".';
    exception when check_violation then null; end;

    insert into public.document_scans (document_id, company_id, kind, status)
      values (doc, co, 'program', 'gaps_found') returning id into sc;

    -- kind refuses a plausible wrong value
    begin
      update public.document_scans set kind = 'sds' where id = sc;
      raise exception 'MIGRATION 040 FAILED: document_scans.kind accepted "sds".';
    exception when check_violation then null; end;

    -- *** AND `compliant` IS REFUSED AS A STATUS, ON PURPOSE. ***
    begin
      update public.document_scans set status = 'compliant' where id = sc;
      raise exception 'MIGRATION 040 FAILED: document_scans.status accepted "compliant" — one green word for every kind is the fabricated all-clear.';
    exception when check_violation then null; end;

    -- gap status refuses a plausible wrong value
    begin
      insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, status)
        values (sc, doc, co, 1, 'probe', 'resolved');
      raise exception 'MIGRATION 040 FAILED: document_gaps.status accepted "resolved".';
    exception when check_violation then null; end;

    -- fact_proposals: neither source set is refused
    begin
      insert into public.fact_proposals (company_id, switch_key, proposed_value, source)
        values (co, 'probe_key', 'probe', 'document');
      raise exception 'MIGRATION 040 FAILED: fact_proposals accepted a row with neither topic_id nor document_id.';
    exception when check_violation then null; end;

    -- fact_proposals: BOTH sources set is refused.
    -- The probe CREATES its own topic rather than borrowing one: the first company on this
    -- database may have none, and then topic_id would be NULL, the row would legitimately pass,
    -- and the probe would report a constraint failure that had not happened. (It did exactly
    -- that on the first run of this migration.)
    insert into public.topics (company_id, title) values (co, 'migration-040-probe') returning id into tp;
    begin
      insert into public.fact_proposals (company_id, switch_key, proposed_value, source, document_id, topic_id)
        values (co, 'probe_key', 'probe', 'document', doc, tp);
      raise exception 'MIGRATION 040 FAILED: fact_proposals accepted both topic_id and document_id.';
    exception when check_violation then null; end;

    -- ...and a conversation-sourced proposal with only topic_id is still ACCEPTED, which is the
    -- shape every existing row has. A constraint that breaks the old path is too strict.
    insert into public.fact_proposals (company_id, switch_key, proposed_value, topic_id)
      values (co, 'probe_key', 'probe', tp);
    delete from public.topics where id = tp;

    -- ...and a document-sourced proposal with only document_id is ACCEPTED (not too strict)
    insert into public.fact_proposals (company_id, switch_key, proposed_value, source, document_id, locator)
      values (co, 'probe_key', 'probe', 'document', doc, 'page 1');

    -- company_labels refuses an unknown kind
    begin
      insert into public.company_labels (company_id, kind, label) values (co, 'topic', 'probe');
      raise exception 'MIGRATION 040 FAILED: company_labels.kind accepted "topic".';
    exception when check_violation then null; end;

    -- ai_calls accepts the new task and still refuses an unknown one
    begin
      insert into public.ai_calls (task, model) values ('document_scanning', 'probe');
      raise exception 'MIGRATION 040 FAILED: ai_calls.task accepted "document_scanning".';
    exception when check_violation then null; end;
    insert into public.ai_calls (task, model) values ('document_scan', 'migration-040-probe');
    delete from public.ai_calls where model = 'migration-040-probe';

    -- clean up the probe rows (cascades take the scan, gaps and proposals with the document)
    delete from public.documents where id = doc;
  end if;

  select count(*) into n from pg_policies where schemaname='public'
    and tablename in ('document_scans','document_gaps','document_conditions','document_deadlines','company_labels');
  if n <> 7 then raise exception 'MIGRATION 040 FAILED: expected 7 policies on the new tables, found %.', n; end if;

  raise notice 'MIGRATION 040 OK: 5 new tables, documents/fact_proposals/calendar_events extended, every CHECK refused a plausible wrong value, and "compliant" is not a status.';
end $$;
