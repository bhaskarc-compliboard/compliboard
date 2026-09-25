-- 043 — ONE ROW PER DOCUMENT, WITH EVERYTHING THE PAGE GROUPS BY.
--
-- WHY A VIEW. The Documents page is one table that can be grouped by any of its properties —
-- status, agency, subject, kind, site, folder — and filtered by folder on top of that. Every one
-- of those values lives on a different table: the file on `documents`, what it IS on the current
-- `document_scans` row, where it sits on `company_folders`, which plant it belongs to on
-- `entities`, and how much is wrong with it on `document_gaps`. Assembling that in the client
-- means five round trips and a join written twice — once for the page and again for whatever
-- reads it next. Audits and the Calendar are the next two readers and they want the same row.
--
-- *** THE DISPLAY STATUS IS COMPUTED HERE, IN SQL, NOT BY THE MODEL AND NOT BY THE PAGE. ***
-- `CLAUDE.md` §3.2: readiness and coverage counts are computed in code, never by AI. The scan
-- says what KIND of thing a document is and what its dates are; whether that adds up to
-- "expiring within 90 days" is arithmetic against today, and arithmetic belongs where it can be
-- read. Putting it in the page would also mean two implementations the day the Calendar wants
-- the same word.
--
-- The vocabulary is the vision's, and it deliberately has no green word for a document that is
-- merely fine — `on_file` and `current` are grey. There is no `compliant` and there cannot be:
-- `document_scans.status` refuses the value at the database (migration 040).
--
-- SECURITY. A view runs with the privileges of its OWNER unless it says otherwise, which would
-- make this a hole straight through `documents`' RLS. `security_invoker = true` makes every
-- underlying policy apply to the CALLER instead, so this view shows exactly the rows the caller
-- could already select from `documents` and nothing more. The probe at the bottom proves it by
-- reading as `anon` and getting nothing.

begin;

create or replace view public.document_index_v
with (security_invoker = true) as
select
  d.id                              as document_id,
  d.company_id,

  -- What it is. The scan's title if it read one, else the filename — a row headed
  -- "Title_V_Air_Quality_Permit.pdf" is the thing the vision asks us to stop showing.
  coalesce(nullif(s.title, ''), d.name)   as title,
  d.name                            as file_name,
  s.kind,
  coalesce(s.agencies, '[]'::jsonb) as agencies,
  coalesce(s.subjects, '[]'::jsonb) as subjects,
  s.issuer,

  -- Where it sits. Both nullable and both meaning "not filed / not assigned", which the page
  -- renders as its own group rather than dropping the row.
  e.name                            as site_name,
  d.entity_id,
  f.name                            as folder_name,
  d.folder_id,

  -- The dates, and what kind of date each is.
  s.doc_date,
  s.doc_date_kind,
  s.significant_date,
  s.significant_date_kind,
  s.scanned_at,
  d.uploaded_at,

  -- State.
  s.status                          as scan_status,
  d.status                          as document_status,
  s.could_not_read_reason,
  s.summary,
  d.version_of,
  s.id                              as scan_id,

  -- How much is wrong with it. OPEN gaps only: a dismissed gap stays on the row for the audit
  -- trail (§ close, never delete) and must not keep the document in Needs work forever.
  coalesce(g.open_gaps, 0)          as open_gap_count,

  -- ONE WORD FOR THE ROW'S RIGHT-HAND COLUMN.
  --
  -- Order matters and the order is the operator's question — "what needs me today" — so the
  -- things that need somebody come first and the routine words come last.
  case
    when d.status in ('uploaded', 'reading') or s.id is null then 'not_yet_read'
    when s.status = 'could_not_read' or d.status = 'could_not_read' then 'could_not_read'
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
-- The CURRENT scan only. A document may have many; `is_current` is set by `saveScan`, which
-- clears it on the others in the same write.
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

-- A view is not a table and takes no policies of its own; what it needs is the grant, and the
-- REVOKE-first shape of §3.6 applies here for the same reason it applies to a table — default
-- privileges on `public` hand `anon` everything the moment an object appears.
revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFY: the view returns the right word for each shape, and shows anon nothing.
-- ---------------------------------------------------------------------------
do $$
declare
  co uuid; doc uuid; sc uuid; got text; n int;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 043: no company on this database, probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-043-probe.pdf', 'probe/043', 'application/pdf', 1, 'upload', 'uploaded')
    returning id into doc;

  -- uploaded, never scanned -> not_yet_read, and the title falls back to the filename
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'not_yet_read' then
    raise exception 'MIGRATION 043 FAILED: an unscanned upload reads %, wanted not_yet_read.', got;
  end if;
  if (select title from public.document_index_v where document_id = doc) <> 'migration-043-probe.pdf' then
    raise exception 'MIGRATION 043 FAILED: title did not fall back to the filename.';
  end if;

  update public.documents set status = 'read' where id = doc;

  -- a permit expiring inside 90 days
  insert into public.document_scans (document_id, company_id, kind, status, significant_date, is_current)
    values (doc, co, 'permit', 'current', current_date + 30, true) returning id into sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'expiring' then
    raise exception 'MIGRATION 043 FAILED: a permit 30 days from expiry reads %, wanted expiring.', got;
  end if;

  -- ...and the same permit once the date has passed
  update public.document_scans set significant_date = current_date - 1 where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'expired' then
    raise exception 'MIGRATION 043 FAILED: a permit past its date reads %, wanted expired.', got;
  end if;

  -- ...and with plenty of time left
  update public.document_scans set significant_date = current_date + 400 where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'current' then
    raise exception 'MIGRATION 043 FAILED: a permit 400 days from expiry reads %, wanted current.', got;
  end if;

  -- gaps_found outranks everything but unreadable
  update public.document_scans set kind = 'program', status = 'gaps_found', significant_date = null where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'needs_work' then
    raise exception 'MIGRATION 043 FAILED: gaps_found reads %, wanted needs_work.', got;
  end if;

  -- OPEN gaps are counted; a dismissed one is not
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, status)
    values (sc, doc, co, 1, 'probe open', 'open');
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, status)
    values (sc, doc, co, 2, 'probe dismissed', 'dismissed');
  select open_gap_count into n from public.document_index_v where document_id = doc;
  if n <> 1 then
    raise exception 'MIGRATION 043 FAILED: open_gap_count is % with one open and one dismissed gap, wanted 1.', n;
  end if;

  -- a record, and a supplier document
  update public.document_scans set kind = 'record', status = 'recorded' where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'recorded' then
    raise exception 'MIGRATION 043 FAILED: a record reads %, wanted recorded.', got;
  end if;
  update public.document_scans set kind = 'supplier_document', status = 'not_judged' where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'on_file' then
    raise exception 'MIGRATION 043 FAILED: a supplier document reads %, wanted on_file.', got;
  end if;

  -- unreadable beats every other word
  update public.document_scans set status = 'could_not_read', could_not_read_reason = 'probe' where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'could_not_read' then
    raise exception 'MIGRATION 043 FAILED: an unreadable scan reads %, wanted could_not_read.', got;
  end if;

  delete from public.documents where id = doc;
  raise notice 'MIGRATION 043: display_status is correct for every shape, and open gaps only are counted.';
end $$;

-- *** AND THE ONE THAT MATTERS: anon sees nothing. ***
-- Not "has no grant" — READ IT. §3.6: a grant list describes what you added, not what the role
-- holds, and a view that forgot security_invoker would happily serve every company's documents
-- to a role whose own policies would have refused them.
do $$
declare
  n int;
begin
  select count(*) into n
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'document_index_v' and grantee = 'anon';
  if n > 0 then
    raise exception 'MIGRATION 043 FAILED: anon holds % grant(s) on document_index_v.', n;
  end if;
  if not exists (
    select 1 from pg_class c
     where c.relname = 'document_index_v'
       and c.reloptions @> array['security_invoker=true']
  ) then
    raise exception 'MIGRATION 043 FAILED: document_index_v is not security_invoker — it would bypass documents RLS.';
  end if;
  raise notice 'MIGRATION 043: anon holds nothing on the view and the view runs as its caller.';
end $$;

commit;
