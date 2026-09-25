-- 044 — A DOCUMENT CAN FAIL BEFORE IT HAS A SCAN ROW, AND THE VIEW SAID IT WAS QUEUED.
--
-- WHAT WENT WRONG. `document_index_v`'s first branch was
--
--     when d.status in ('uploaded', 'reading') or s.id is null then 'not_yet_read'
--
-- and `s.id is null` was doing more than it looked like. `/api/document-scan` sets
-- `documents.status = 'could_not_read'` when the model call itself fails — and in that case no
-- `document_scans` row was ever written, so `s.id` IS null and the branch fired first. Seven
-- documents uploaded through the page on 25 September every one of them read **Queued** on screen
-- while the database said `could_not_read`. The page was telling somebody to wait for a reading
-- that had already failed and would never arrive.
--
-- That is the §5.1 failure the status vocabulary exists to prevent, in the one direction that is
-- easy to miss: not asserting something false about a document's CONTENTS, but asserting
-- something false about our own state. A row that is stuck on Queued is a page that spins.
--
-- THE FIX IS THE ORDER. `documents.status = 'could_not_read'` is now read before the
-- "no scan row yet" case, because it is a conclusion and the other is an absence. `uploaded` and
-- `reading` still come first among themselves — those genuinely are "not yet read".
--
-- Nothing else about the view changes; it is restated whole because `create or replace view`
-- requires the full definition.

begin;

create or replace view public.document_index_v
with (security_invoker = true) as
select
  d.id                              as document_id,
  d.company_id,
  coalesce(nullif(s.title, ''), d.name)   as title,
  d.name                            as file_name,
  s.kind,
  coalesce(s.agencies, '[]'::jsonb) as agencies,
  coalesce(s.subjects, '[]'::jsonb) as subjects,
  s.issuer,
  e.name                            as site_name,
  d.entity_id,
  f.name                            as folder_name,
  d.folder_id,
  s.doc_date,
  s.doc_date_kind,
  s.significant_date,
  s.significant_date_kind,
  s.scanned_at,
  d.uploaded_at,
  s.status                          as scan_status,
  d.status                          as document_status,
  s.could_not_read_reason,
  s.summary,
  d.version_of,
  s.id                              as scan_id,
  coalesce(g.open_gaps, 0)          as open_gap_count,

  case
    -- A CONCLUSION BEATS AN ABSENCE. This has to come before the `s.id is null` case: a scan
    -- that failed before it could write a row leaves the document saying could_not_read and no
    -- scan behind it, and reading that as "not yet read" is a lie the page displays.
    when d.status = 'could_not_read' or s.status = 'could_not_read' then 'could_not_read'
    when d.status in ('uploaded', 'reading') or s.id is null then 'not_yet_read'
    when s.status = 'gaps_found' then 'needs_work'
    when s.kind in ('permit', 'certificate') and s.significant_date is not null
         and s.significant_date < current_date then 'expired'
    when s.kind in ('permit', 'certificate') and s.significant_date is not null
         and s.significant_date <= current_date + 90 then 'expiring'
    when s.kind in ('permit', 'certificate') then 'current'
    when s.status = 'no_gaps_found' then 'current'
    when s.kind = 'record' then 'recorded'
    when s.kind in ('supplier_document', 'other') then 'on_file'
    else 'on_file'
  end                               as display_status

from public.documents d
left join public.document_scans s
  on s.document_id = d.id and s.is_current
left join public.company_folders f on f.id = d.folder_id
left join public.entities e        on e.id = d.entity_id
left join lateral (
  select count(*)::int as open_gaps
    from public.document_gaps dg
   where dg.document_id = d.id and dg.status = 'open'
) g on true;

comment on view public.document_index_v is
  'One row per document with the columns the Documents page groups and sorts by, plus a '
  'display_status computed in SQL from the scan kind and its dates against today. '
  'security_invoker: it shows only the rows the caller could select from documents.';

revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFY: the case this migration exists for, plus the one it must not have broken.
-- ---------------------------------------------------------------------------
do $$
declare
  co uuid; doc uuid; got text;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 044: no company on this database, probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-044-probe.pdf', 'probe/044', 'application/pdf', 1, 'upload', 'uploaded')
    returning id into doc;

  -- Still genuinely not read: uploaded, no scan row.
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'not_yet_read' then
    raise exception 'MIGRATION 044 FAILED: an uploaded document reads %, wanted not_yet_read.', got;
  end if;

  -- ...and reading, which is also not yet read.
  update public.documents set status = 'reading' where id = doc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'not_yet_read' then
    raise exception 'MIGRATION 044 FAILED: a document being read reads %, wanted not_yet_read.', got;
  end if;

  -- *** THE CASE THIS MIGRATION IS FOR: failed with NO scan row at all. ***
  update public.documents set status = 'could_not_read' where id = doc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'could_not_read' then
    raise exception 'MIGRATION 044 FAILED: a document that failed before writing a scan reads %, wanted could_not_read.', got;
  end if;

  delete from public.documents where id = doc;
  raise notice 'MIGRATION 044: a failure with no scan row now reads could_not_read, and uploaded/reading still read not_yet_read.';
end $$;

commit;
