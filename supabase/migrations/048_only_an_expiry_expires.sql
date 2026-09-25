-- 048 — AN ISSUE DATE IS NOT AN EXPIRY, AND THE VIEW WAS TREATING IT AS ONE.
--
-- `document_index_v` read expired/expiring off "this is a permit and its significant_date is in
-- the past". `chooseSignificantDate` (Run 4 preamble c) falls back to the document's own date
-- when a permit's scan recorded no expiry deadline — and a document's own date is its ISSUE date,
-- which is always in the past. So every permit whose scan missed the expiry read **Expired**.
--
-- Measured on the golden fixtures, uploaded through the page: 03-olcc-cannabis, a marijuana
-- producer licence whose term runs to 2 March 2027, read "Expired" beside an issue date of
-- 3 March 2026. That is the worst class of wrong this page can be — a confident amber word,
-- about a real obligation, that is the opposite of the truth.
--
-- The fix is the guard the design already had and the SQL did not use: `significant_date_kind`.
-- Only a date we actually believe is an expiry may expire. Everything else about the view is
-- unchanged; it is restated whole because a view must be.

begin;

drop view if exists public.document_index_v;
create view public.document_index_v
with (security_invoker = true) as
with newest as (
  -- `id desc` is a TIE-BREAK, not decoration. `created_at` defaults to now(), which is
  -- TRANSACTION time — two corrections written in one transaction carry the identical timestamp
  -- and `distinct on` then picks whichever row it happens to reach first. Found by this
  -- migration's own probe, which corrected `kind` twice and got the first answer back. In
  -- production the two would be separate requests, so this only bites where it was found; a
  -- non-deterministic view is still a view nobody can reason about.
  select distinct on (document_id, field)
         document_id, field, new_value
    from public.document_corrections
   order by document_id, field, created_at desc, id desc
)
select
  d.id                              as document_id,
  d.company_id,
  coalesce(
    nullif(c_title.new_value #>> '{}', ''),
    nullif(s.title, ''),
    d.name)                         as title,
  d.name                            as file_name,
  coalesce(c_kind.new_value #>> '{}', s.kind)          as kind,
  coalesce(c_ag.new_value, s.agencies, '[]'::jsonb)    as agencies,
  coalesce(c_sub.new_value, s.subjects, '[]'::jsonb)   as subjects,
  s.issuer,
  coalesce(c_site_e.name, e.name)   as site_name,
  coalesce((c_site.new_value #>> '{}')::uuid, d.entity_id) as entity_id,
  f.name                            as folder_name,
  d.folder_id,
  coalesce((c_date.new_value #>> '{}')::date, s.doc_date) as doc_date,
  s.doc_date_kind,
  s.significant_date,
  s.significant_date_kind,
  s.scanned_at,
  d.uploaded_at,
  d.latest_confirmed_at,
  s.status                          as scan_status,
  d.status                          as document_status,
  s.could_not_read_reason,
  s.summary,
  d.version_of,
  d.version_confirmed,
  s.id                              as scan_id,
  coalesce(g.open_gaps, 0)          as open_gap_count,
  (select count(*) from newest n where n.document_id = d.id)::int as correction_count,

  case
    -- A conclusion beats an absence (044).
    when d.status = 'could_not_read' or s.status = 'could_not_read' then 'could_not_read'
    when d.status in ('uploaded', 'reading') or s.id is null then 'not_yet_read'
    when s.status = 'gaps_found' then 'needs_work'
    -- *** THE CORRECTED KIND, NOT THE SCANNED ONE. *** If a person says this is a permit, the
    -- expiry arithmetic has to follow them, or the correction changes the label and not the
    -- meaning — which is worse than not offering it.
    -- *** THE DATE HAS TO BE AN EXPIRY, NOT MERELY A DATE. *** `significant_date_kind` is chosen
    -- in code by `chooseSignificantDate`, and when a permit's scan read no expiry at all the
    -- fallback is the document's ISSUE date — which is always in the past. Comparing that to
    -- today reported golden case 03, a licence valid until March 2027, as "Expired". The kind is
    -- the guard: only a date we actually believe is an expiry may expire.
    when coalesce(c_kind.new_value #>> '{}', s.kind) in ('permit', 'certificate')
         and s.significant_date_kind = 'expiry'
         and s.significant_date is not null and s.significant_date < current_date then 'expired'
    when coalesce(c_kind.new_value #>> '{}', s.kind) in ('permit', 'certificate')
         and s.significant_date_kind = 'expiry'
         and s.significant_date is not null and s.significant_date <= current_date + 90 then 'expiring'
    when coalesce(c_kind.new_value #>> '{}', s.kind) in ('permit', 'certificate') then 'current'
    when s.status = 'no_gaps_found' then 'current'
    when coalesce(c_kind.new_value #>> '{}', s.kind) = 'record' then 'recorded'
    else 'on_file'
  end                               as display_status

from public.documents d
left join public.document_scans s on s.document_id = d.id and s.is_current
left join public.company_folders f on f.id = d.folder_id
left join public.entities e        on e.id = d.entity_id
left join newest c_kind  on c_kind.document_id  = d.id and c_kind.field  = 'kind'
left join newest c_ag    on c_ag.document_id    = d.id and c_ag.field    = 'agencies'
left join newest c_sub   on c_sub.document_id   = d.id and c_sub.field   = 'subjects'
left join newest c_site  on c_site.document_id  = d.id and c_site.field  = 'site'
left join newest c_date  on c_date.document_id  = d.id and c_date.field  = 'doc_date'
left join newest c_title on c_title.document_id = d.id and c_title.field = 'title'
left join public.entities c_site_e on c_site_e.id = (c_site.new_value #>> '{}')::uuid
left join lateral (
  select count(*)::int as open_gaps
    from public.document_gaps dg
   where dg.document_id = d.id and dg.status = 'open'
) g on true;

comment on view public.document_index_v is
  'One row per document with the columns the Documents page groups and sorts by. A correction '
  'the person made outranks the scan, field by field, newest first. display_status is computed '
  'in SQL and follows the corrected kind. security_invoker: only rows the caller could select.';

revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFY: the case this migration exists for, and the two it must not have broken.
-- ---------------------------------------------------------------------------
do $$
declare
  co uuid; doc uuid; sc uuid; got text;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 048: no company on this database, probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-048-probe.pdf', 'probe/048', 'application/pdf', 1, 'upload', 'read')
    returning id into doc;

  -- *** THE CASE: a certificate whose significant date is its ISSUE date, two years ago. ***
  insert into public.document_scans
    (document_id, company_id, kind, status, significant_date, significant_date_kind, is_current)
    values (doc, co, 'certificate', 'current', current_date - 400, 'issued', true)
    returning id into sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'current' then
    raise exception 'MIGRATION 048 FAILED: a licence dated by its issue date reads %, wanted current.', got;
  end if;

  -- ...and a real expiry still expires.
  update public.document_scans
     set significant_date = current_date - 1, significant_date_kind = 'expiry' where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'expired' then
    raise exception 'MIGRATION 048 FAILED: a past expiry reads %, wanted expired.', got;
  end if;

  -- ...and a real expiry inside 90 days still warns.
  update public.document_scans
     set significant_date = current_date + 30, significant_date_kind = 'expiry' where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'expiring' then
    raise exception 'MIGRATION 048 FAILED: an expiry 30 days out reads %, wanted expiring.', got;
  end if;

  delete from public.documents where id = doc;
  raise notice 'MIGRATION 048: only a date whose kind is expiry may expire.';
end $$;

commit;
