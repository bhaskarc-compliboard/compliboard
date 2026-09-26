-- 054 — THE DOCUMENTS THAT WERE ALREADY THERE ARE NOT PUT IN THE QUEUE
--
-- Documents rev 1 ships the sweep, and the sweep's queue is "every document whose status is
-- `uploaded`". On production that is not an empty set: 38 files were uploaded through the old
-- page over the months before any of this existed. Left alone, the first cron tick after the
-- deploy would start reading all of them — a bill the owner did not ask for, and an email about
-- work nobody requested, arriving before anyone has seen the new page.
--
-- *** SO THEY ARE SET ASIDE, NOT READ. *** `held` means "here, not queued, waiting to be asked
-- for". The sweep's queue is `status = 'uploaded'` and nothing else, so a held document is
-- skipped without the sweep needing to know this status exists. The page says
-- "Not read yet — press Add files or Read it again", which is true and tells them what to do;
-- `document_index_v` already reports such a row as `not_yet_read`, because it has no scan.
--
-- *** IT IS NOT A NEW KIND OF FAILURE AND IT IS NOT PERMANENT. *** "Read it again" in the
-- drawer sets the document to `reading` and scans it, one at a time, whenever a person decides
-- it is worth it. Anything uploaded after this migration goes through the new page and is
-- queued normally.
--
-- WHY A MIGRATION RATHER THAN A FLAG IN CODE. A cut-off date compared at read time would be a
-- rule every later query had to remember, and the first one to forget it would quietly queue
-- 38 documents. The state is written down once, on the rows it is true of.
--
-- THE UPDATE IS DELIBERATELY UNCONDITIONAL ON DATE. At the moment this runs there is no sweep
-- and no batch on production, so every `uploaded` row is by definition a legacy one. On staging
-- it may catch a document genuinely waiting, and that is the correct outcome there too: the
-- chain has to produce the same database from nothing, and "nothing" has no queue in it.

begin;

alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents add constraint documents_status_check
  check (status in ('uploaded', 'reading', 'read', 'could_not_read', 'held'));

update public.documents set status = 'held' where status = 'uploaded';

comment on column public.documents.status is
  'uploaded = waiting for the sweep · reading = a scan is in flight · read · could_not_read · '
  'held = it was here before the sweep existed and will not be read until somebody asks. '
  'The sweep queues on `uploaded` alone, so held is skipped by construction.';

do $$
declare co uuid; doc uuid; n int;
begin
  -- ==========================================================
  -- A. nothing is left queued by this migration
  -- ==========================================================
  select count(*) into n from public.documents where status = 'uploaded';
  if n <> 0 then
    raise exception 'MIGRATION 054 FAILED: % document(s) are still queued after the hold.', n;
  end if;

  -- ==========================================================
  -- B. THE CHECK IS TESTED BY TRYING TO BREAK IT (§3.7)
  -- ==========================================================
  insert into public.companies (name, industry, state)
       values ('Migration 054 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.documents (company_id, name, file_url, file_type, status)
       values (co, 'migration-054-probe.pdf', 'probe/054', 'application/pdf', 'held')
    returning id into doc;

  if (select status from public.documents where id = doc) <> 'held' then
    raise exception 'MIGRATION 054 FAILED: status would not take held.';
  end if;

  -- a value nobody defined is still refused: widening an enum is exactly where a CHECK quietly
  -- stops refusing anything, and a CHECK nobody has tried to break is a comment.
  begin
    update public.documents set status = 'paused' where id = doc;
    raise exception 'MIGRATION 054 FAILED: documents.status accepted "paused".';
  exception when check_violation then null; end;

  -- and the four that were already legal still are
  begin
    update public.documents set status = 'uploaded' where id = doc;
    update public.documents set status = 'reading' where id = doc;
    update public.documents set status = 'read' where id = doc;
    update public.documents set status = 'could_not_read' where id = doc;
    update public.documents set status = 'held' where id = doc;
  exception when check_violation then
    raise exception 'MIGRATION 054 FAILED: an existing document status stopped being accepted.';
  end;

  -- ==========================================================
  -- C. A HELD DOCUMENT IS INVISIBLE TO THE SWEEP'S OWN QUERY
  -- ==========================================================
  select count(*) into n from public.documents
   where status = 'uploaded' and reading_since is null and id = doc;
  if n <> 0 then
    raise exception 'MIGRATION 054 FAILED: a held document appears in the sweep''s queue.';
  end if;

  -- ==========================================================
  -- D. ...AND THE PAGE STILL SHOWS IT, AS not_yet_read
  -- A held document that vanished from the list would be worse than one that is read without
  -- being asked for: the customer would think we had lost their file.
  -- ==========================================================
  select count(*) into n from public.document_index_v
   where document_id = doc and display_status = 'not_yet_read';
  if n <> 1 then
    raise exception 'MIGRATION 054 FAILED: a held document is not shown as not_yet_read.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 054 OK: nothing left queued; held is accepted and "paused" is not; a held document is absent from the sweep''s queue and present on the page.';
end $$;

commit;
