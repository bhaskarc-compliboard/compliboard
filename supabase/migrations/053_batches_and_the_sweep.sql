-- 053 — A BATCH, A WITHDRAWN PROPOSAL, AND A GAP THE LATEST READING DID NOT MENTION
--
-- Documents Run 7. Three things, all of them about the difference between a few files and many.
--
-- ---------------------------------------------------------------------------
-- 1. `document_batches` — WHY AN UPLOAD NEEDS AN IDENTITY OF ITS OWN
--
-- Until now an upload was a loop: files went in one at a time and nothing remembered that they
-- arrived together. That is fine for two files somebody watched go in, and it is useless for
-- thirty. The person who dropped a folder in at four o'clock wants one answer — "we've read your
-- 42 documents; 3 need work, 2 are expiring, 1 we couldn't read" — and there is nothing in the
-- schema that can be asked what "your 42 documents" means.
--
-- So: the upload is a row. `file_count` is what was promised, `done_count` what has landed,
-- `summary` the counts and the titles behind them computed once when the last one lands,
-- `notified_at` the proof the email went, `dismissed_at` the proof the person has seen the
-- banner. Both timestamps exist so that neither is re-sent: an email that arrives twice reads as
-- a broken product, and a banner that comes back after it is dismissed reads as worse.
--
-- *** `status` IS queued | reading | done, AND THERE IS NO `failed`. *** A batch where every
-- file could not be read is still a finished batch — the summary says so, one line per file,
-- with what would fix each. A batch marked failed would be the product declining to tell
-- somebody what happened to their files.
--
-- ---------------------------------------------------------------------------
-- 2. `fact_proposals.status = 'withdrawn'`
--
-- Run 6 made the To confirm queue one question per key and collapsed repeat readings of one
-- file. It did not answer the other half: a scan proposes "42 employees", the document is read
-- again after an edit, and the new reading does not mention employees at all. The old proposal
-- stays `proposed` for ever, and the person is asked to confirm something the current reading of
-- the file does not say.
--
-- Withdrawn is not rejected. Rejected is a person saying "that is wrong", and it is shown to the
-- next scan so the claim is not made again. Withdrawn is us saying "we no longer read this in
-- the file" — nobody was wrong, and the row stays because the drawer shows it: "no longer
-- proposed by the latest reading" is information, and deleting it would be the product quietly
-- changing its mind.
--
-- ---------------------------------------------------------------------------
-- 3. `document_gaps.not_seen_at`
--
-- The mirror of the same problem on the other table, and the rule is stricter. Run 6 taught the
-- scan to name the gap each of its findings replaces; the ones it names are superseded. The ones
-- it does NOT name are the interesting case, and they must not be closed: a reading that failed
-- to mention a missing evacuation procedure is not evidence that the procedure now exists.
--
-- So the gap stays open and carries the date a reading passed over it. The row says "not seen in
-- the latest reading" and waits for a person. `nothing closes a gap without a person` is the
-- whole rule; this column is what lets us say so out loud instead of silently.

begin;

-- ------------------------------------------------------------
-- 1. document_batches
-- ------------------------------------------------------------
create table if not exists public.document_batches (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  -- The person who dropped the files in, and the person the email goes to. `set null` rather
  -- than cascade: a batch outliving the colleague who uploaded it is a batch that still happened.
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  file_count    int  not null default 0 check (file_count >= 0),
  done_count    int  not null default 0 check (done_count >= 0),
  status        text not null default 'queued' check (status in ('queued', 'reading', 'done')),
  summary       jsonb,
  notified_at   timestamptz,
  dismissed_at  timestamptz
);

create index if not exists idx_document_batches_company_created
  on public.document_batches (company_id, created_at desc);
-- The sweep's own question: which batches are not finished yet.
create index if not exists idx_document_batches_open
  on public.document_batches (company_id, status) where status <> 'done';

comment on table public.document_batches is
  'One upload, however many files were in it. Exists so a folder drop can be answered once — '
  'an email and a banner — rather than file by file. notified_at and dismissed_at are proof, so '
  'neither the email nor the banner can arrive twice.';

-- REVOKE first, for both roles: default privileges on `public` hand anon and authenticated full
-- DML on a new table before a single GRANT runs (§3.6). A grant list describes what you added,
-- not what the role holds.
revoke all on table public.document_batches from anon;
revoke all on table public.document_batches from authenticated;
-- SELECT so the page can draw the banner; UPDATE so a person can dismiss it. No INSERT and no
-- DELETE: a batch is created by the server as part of an upload, and a batch nobody can point at
-- a set of documents is a claim about work that did not happen.
grant select, update on table public.document_batches to authenticated;
grant all on table public.document_batches to service_role;

alter table public.document_batches enable row level security;
drop policy if exists document_batches_select on public.document_batches;
create policy document_batches_select on public.document_batches
  for select to authenticated
  using (company_id = public.auth_company_id());
drop policy if exists document_batches_update on public.document_batches;
create policy document_batches_update on public.document_batches
  for update to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());

alter table public.documents
  add column if not exists batch_id uuid references public.document_batches(id) on delete set null;
create index if not exists idx_documents_batch on public.documents (batch_id) where batch_id is not null;

comment on column public.documents.batch_id is
  'The upload this file arrived in. Null for anything uploaded before Run 7 or added any other '
  'way. on delete set null: losing the batch must never take the documents with it.';

-- THE SWEEP'S OWN INDEX. It asks one question on every run — which documents are still waiting,
-- oldest first — and at 288 runs a day that question must not be a sequential scan.
create index if not exists idx_documents_queued
  on public.documents (uploaded_at) where status = 'uploaded';

-- *** WHEN THE SWEEP CLAIMED THIS DOCUMENT, AND WHY A COLUMN IS NEEDED FOR IT. ***
--
-- The sweep claims a company's whole queue by compare-and-set — `status = 'reading' where
-- status = 'uploaded'` — so two overlapping runs cannot interleave one company's files. A
-- function killed mid-scan then leaves rows saying `reading` for ever, and a row that lies
-- about being in progress is worse than one that admits it is waiting: nothing will ever pick
-- it up again.
--
-- Recovery needs to know how long ago the claim was made, and `documents` has no `updated_at`
-- to borrow — it carries `uploaded_at` and nothing else that moves. So the claim writes its own
-- timestamp and clears it when the document settles. Null is the normal state.
alter table public.documents
  add column if not exists reading_since timestamptz;

comment on column public.documents.reading_since is
  'When the sweep claimed this document. Null unless a scan is in flight. Read at the top of '
  'every run to recover rows abandoned by a function that was killed mid-scan.';

-- ------------------------------------------------------------
-- 2. a proposal the latest reading no longer makes
-- ------------------------------------------------------------
alter table public.fact_proposals drop constraint if exists fact_proposals_status_check;
alter table public.fact_proposals add constraint fact_proposals_status_check
  check (status in ('proposed', 'accepted', 'rejected', 'withdrawn'));

-- ------------------------------------------------------------
-- 3. a gap the latest reading passed over
-- ------------------------------------------------------------
alter table public.document_gaps
  add column if not exists not_seen_at timestamptz;

comment on column public.document_gaps.not_seen_at is
  'When a later reading of this document neither raised this finding nor named it in '
  'same_as_gap_id. The gap STAYS OPEN: a reading that did not mention a missing procedure is not '
  'evidence the procedure exists. Cleared if a later reading does pair it.';

-- ------------------------------------------------------------
-- 4. the sweep is a job, and job_runs has to be able to name it
-- ------------------------------------------------------------
alter table public.job_runs drop constraint if exists job_runs_job_check;
alter table public.job_runs add constraint job_runs_job_check
  check (job = any (array['summarise', 'delete', 'account_delete', 'scan_documents']));

-- ===========================================================================
-- VERIFY. Every constraint is tested by trying to break it (§3.7) — a CHECK nobody has tried to
-- break is a comment — and every privilege is READ BACK rather than taken from the grant list.
-- ===========================================================================
do $$
declare
  co uuid; usr uuid; b uuid; doc uuid; sc uuid; g uuid; n int;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 053 probe', 'chemical manufacturing', 'OR') returning id into co;

  -- ---- the batch ----
  insert into public.document_batches (company_id, file_count) values (co, 8) returning id into b;
  if (select status from public.document_batches where id = b) <> 'queued' then
    raise exception 'MIGRATION 053 FAILED: a new batch did not default to queued.';
  end if;

  begin
    update public.document_batches set status = 'failed' where id = b;
    raise exception 'MIGRATION 053 FAILED: document_batches.status accepted "failed".';
  exception when check_violation then null; end;

  begin
    update public.document_batches set done_count = -1 where id = b;
    raise exception 'MIGRATION 053 FAILED: done_count accepted a negative number.';
  exception when check_violation then null; end;

  update public.document_batches set status = 'reading' where id = b;
  update public.document_batches set status = 'done',
         summary = '{"read": 7, "could_not_read": 1}'::jsonb,
         notified_at = now(), dismissed_at = now() where id = b;

  -- ---- a document belongs to it, and outlives it ----
  insert into public.documents (company_id, name, file_url, file_type, batch_id)
       values (co, 'migration-053-probe.pdf', 'probe/053', 'application/pdf', b) returning id into doc;
  delete from public.document_batches where id = b;
  select count(*) into n from public.documents where id = doc;
  if n <> 1 then
    raise exception 'MIGRATION 053 FAILED: deleting the batch deleted its documents.';
  end if;
  if (select batch_id from public.documents where id = doc) is not null then
    raise exception 'MIGRATION 053 FAILED: batch_id was not set null when the batch went.';
  end if;

  -- ---- a claim, and its recovery ----
  update public.documents set status = 'reading', reading_since = now() - interval '20 minutes'
   where id = doc;
  -- The recovery the sweep runs, written here so the column is proved to support it.
  update public.documents set status = 'uploaded', reading_since = null
   where id = doc and status = 'reading' and reading_since < now() - interval '15 minutes';
  if (select status from public.documents where id = doc) <> 'uploaded'
     or (select reading_since from public.documents where id = doc) is not null then
    raise exception 'MIGRATION 053 FAILED: an abandoned claim could not be recovered.';
  end if;

  -- ---- withdrawn ----
  insert into public.document_scans (document_id, company_id, kind, status)
       values (doc, co, 'program', 'gaps_found') returning id into sc;
  insert into public.fact_proposals (company_id, document_id, source, switch_key, proposed_value)
       values (co, doc, 'document', 'employee_count', '42');
  update public.fact_proposals set status = 'withdrawn' where document_id = doc;
  if (select status from public.fact_proposals where document_id = doc) <> 'withdrawn' then
    raise exception 'MIGRATION 053 FAILED: status would not take withdrawn.';
  end if;
  begin
    update public.fact_proposals set status = 'superseded' where document_id = doc;
    raise exception 'MIGRATION 053 FAILED: fact_proposals.status accepted "superseded".';
  exception when check_violation then null; end;
  -- and the three that were already legal still are
  begin
    update public.fact_proposals set status = 'proposed' where document_id = doc;
    update public.fact_proposals set status = 'accepted' where document_id = doc;
    update public.fact_proposals set status = 'rejected' where document_id = doc;
  exception when check_violation then
    raise exception 'MIGRATION 053 FAILED: an existing proposal status stopped being accepted.';
  end;

  -- ---- a gap the latest reading did not mention ----
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title)
       values (sc, doc, co, 1, 'no procedure for reporting a fire') returning id into g;
  update public.document_gaps set not_seen_at = now() where id = g;
  -- IT STAYS OPEN. That is the rule, and this is the line that proves the column does not
  -- quietly carry a closure with it.
  if (select status from public.document_gaps where id = g) <> 'open' then
    raise exception 'MIGRATION 053 FAILED: marking a gap not-seen changed its status.';
  end if;
  update public.document_gaps set not_seen_at = null where id = g;

  -- ---- job_runs can name the sweep ----
  insert into public.job_runs (job) values ('scan_documents');
  begin
    insert into public.job_runs (job) values ('scan_everything');
    raise exception 'MIGRATION 053 FAILED: job_runs.job accepted "scan_everything".';
  exception when check_violation then null; end;
  delete from public.job_runs where job = 'scan_documents';

  -- ---- privileges, READ BACK ----
  if has_table_privilege('anon', 'public.document_batches', 'SELECT')
     or has_table_privilege('anon', 'public.document_batches', 'INSERT')
     or has_table_privilege('anon', 'public.document_batches', 'UPDATE')
     or has_table_privilege('anon', 'public.document_batches', 'DELETE') then
    raise exception 'MIGRATION 053 FAILED: anon holds a privilege on document_batches.';
  end if;
  if not has_table_privilege('authenticated', 'public.document_batches', 'SELECT')
     or not has_table_privilege('authenticated', 'public.document_batches', 'UPDATE') then
    raise exception 'MIGRATION 053 FAILED: authenticated cannot read or dismiss a batch.';
  end if;
  if has_table_privilege('authenticated', 'public.document_batches', 'INSERT')
     or has_table_privilege('authenticated', 'public.document_batches', 'DELETE') then
    raise exception 'MIGRATION 053 FAILED: authenticated can create or delete a batch.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 053 OK: a batch defaults to queued and refuses "failed"; its documents outlive it; withdrawn is accepted and "superseded" is not; a not-seen gap stays open; job_runs can name scan_documents.';
end $$;

commit;
