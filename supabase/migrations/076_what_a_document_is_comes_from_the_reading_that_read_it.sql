-- ===========================================================================
-- 076 — WHAT A DOCUMENT *IS* COMES FROM THE READING THAT COULD READ IT
--
-- Calendar Job A, A3d. The owner's decision of 9 October 2026, `DECISIONS.md` §185: **a rate limit
-- must never make a permit vanish from its agency's audit.**
--
-- Migration 075 settled this for a document's DATES. This is the same rule for everything else the
-- document is, and it is the half that matters more — proved on staging before a line was changed
-- (`scripts/calendar-a3b-failed-reread.mjs`):
--
--     a DEQ air permit, read well, then read again by a service that refused:
--        after a GOOD reading    kind=permit  agencies=["Oregon DEQ"]  significant=2026-11-15  status=expiring
--                                title="Standard Air Contaminant Discharge Permit No. 26-2841-ST-01"
--        after a FAILED re-read  kind=NULL    agencies=[]              significant=NULL        status=could_not_read
--                                title="acdp-permit-2.pdf"
--
--     by lib/audit.ts:148-153's own filter, an "Oregon DEQ" audit would read 0 document(s);
--     3 of this company's documents are UNPLACED (no agency at all).
--
-- *** THE WORST OF IT IS THE LAST LINE. *** `lib/audit.ts:148–153` keeps a document for an agency's
-- audit only when `agencies` contains that agency's label, and `app/api/audits/index/route.ts:65`
-- groups the page the same way. An empty list means the document is not in that agency's evidence at
-- all: it drops to the list of titles at the end, and the audit then reports "nothing on file" about
-- an obligation whose permit is sitting in the filing cabinet. A reading service refusing for a
-- minute would make an air permit disappear from the air audit, and the audit would say so
-- confidently.
--
-- THE CAUSE, in one line of the view: `left join document_scans s ... and s.is_current`, and then
-- `title`, `kind`, `agencies`, `subjects`, `issuer`, `summary`, `doc_date` and `doc_date_kind` all
-- read from `s`. A failed reading has none of them, so `title` falls back to the FILE NAME and
-- `agencies` to `[]`.
--
-- *** THE RULE, THE SAME ONE AS 075. ***
--   · A reading that could not read the document owns the document's STATUS and nothing else:
--     `display_status` says "Could not read", `scan_status` and `could_not_read_reason` are the
--     failure's own, and migration 044's "a conclusion beats an absence" still holds.
--   · What the document IS — its title, kind, agencies, subjects, issuer, summary and date — comes
--     from the latest reading that COULD read it.
--
-- WHAT THIS DOES NOT CHANGE, deliberately:
--   · `scan_id` stays the CURRENT scan's. `components/DocumentReport.tsx:275`, `:286` and `:431`
--     detect that a re-read has landed by watching `scan_id` change; pointing it at the readable
--     reading would leave the drawer spinning for ever on a re-read that failed. The readable
--     reading's id is a NEW column instead.
--   · The gap split in `app/api/documents/report/route.ts:80–83` still keys on `scan_id`, so after a
--     failed reading a document's gaps move to "From earlier readings". That is arguably the same
--     defect one step on, and it is NOT fixed here: it changes what Documents shows about findings
--     rather than about dates or agencies, and it is recorded in `docs/HANDOFF-CODE.md` §7 for
--     Documents rather than decided inside the Calendar's job.
--
-- `status` is nullable (read from `information_schema`), so the test is
-- `coalesce(status, '') <> 'could_not_read'`: a bare `<>` is NULL for a null status and would
-- silently drop that scan.
-- ===========================================================================

begin;

drop view if exists public.document_index_v;

create view public.document_index_v
with (security_invoker = true) as
with newest as (
  -- `id desc` is a TIE-BREAK, not decoration (049): `created_at` defaults to now(), which is
  -- TRANSACTION time, so two corrections written in one transaction carry the identical timestamp.
  select distinct on (document_id, field)
         document_id, field, new_value
    from public.document_corrections
   order by document_id, field, created_at desc, id desc
),
readable as (
  -- One row per document: its latest reading that actually read it. The same definition
  -- `document_dates_current_v` uses (075), so the dates and the identity can never come from
  -- different readings.
  select distinct on (document_id)
         id, document_id, scanned_at, title, kind, agencies, subjects, issuer,
         doc_date, doc_date_kind, summary, status
    from public.document_scans
   where coalesce(status, '') <> 'could_not_read'
   order by document_id, scanned_at desc, id desc
)
select
  d.id                              as document_id,
  d.company_id,
  -- ---- WHAT THE DOCUMENT IS: from the reading that could read it ----
  coalesce(
    nullif(c_title.new_value #>> '{}', ''),
    nullif(rs.title, ''),
    d.name)                         as title,
  d.name                            as file_name,
  coalesce(c_kind.new_value #>> '{}', rs.kind)          as kind,
  coalesce(c_ag.new_value, rs.agencies, '[]'::jsonb)    as agencies,
  coalesce(c_sub.new_value, rs.subjects, '[]'::jsonb)   as subjects,
  rs.issuer,
  coalesce(c_site_e.name, e.name)   as site_name,
  coalesce((c_site.new_value #>> '{}')::uuid, d.entity_id) as entity_id,
  f.name                            as folder_name,
  d.folder_id,
  coalesce((c_date.new_value #>> '{}')::date, rs.doc_date) as doc_date,
  rs.doc_date_kind,
  sd.significant_date,
  sd.significant_date_kind,
  -- WHEN THIS DOCUMENT WAS LAST READ — the readable reading's date, because a reading that refused
  -- did not read it, and "read 9 October" beside "Could not read" is a sentence that contradicts
  -- itself. Null only when no reading has ever succeeded.
  rs.scanned_at,
  d.uploaded_at,
  d.latest_confirmed_at,
  rs.summary,
  -- ---- WHAT STATE THE DOCUMENT IS IN: from the CURRENT reading, failed or not (044) ----
  s.status                          as scan_status,
  d.status                          as document_status,
  s.could_not_read_reason,
  d.version_of,
  d.version_confirmed,
  -- The CURRENT scan, unchanged: the drawer watches this to know a re-read has landed, and a failed
  -- re-read has landed just as much as a good one.
  s.id                              as scan_id,
  -- NEW (076): the reading the identity above came from, and whether that is an earlier one than the
  -- current. The Documents row and the report drawer say so in one grey line when it is true, because
  -- a title and an agency shown beside "Could not read" would otherwise look freshly read.
  rs.id                             as readable_scan_id,
  (rs.id is not null and rs.id is distinct from s.id) as identity_from_an_earlier_reading,
  coalesce(g.open_gaps, 0)          as open_gap_count,
  (select count(*) from newest n where n.document_id = d.id)::int as correction_count,

  case
    -- A conclusion beats an absence (044): the failure is still what this document's state IS.
    when d.status = 'could_not_read' or s.status = 'could_not_read' then 'could_not_read'
    when d.status in ('uploaded', 'reading') or s.id is null then 'not_yet_read'
    when s.status = 'gaps_found' then 'needs_work'
    when coalesce(c_kind.new_value #>> '{}', rs.kind) in ('permit', 'certificate')
         and sd.significant_date_kind = 'expiry'
         and sd.significant_date is not null and sd.significant_date < current_date then 'expired'
    when coalesce(c_kind.new_value #>> '{}', rs.kind) in ('permit', 'certificate')
         and sd.significant_date_kind = 'expiry'
         and sd.significant_date is not null and sd.significant_date <= current_date + 90 then 'expiring'
    when coalesce(c_kind.new_value #>> '{}', rs.kind) in ('permit', 'certificate') then 'current'
    when s.status = 'no_gaps_found' then 'current'
    when coalesce(c_kind.new_value #>> '{}', rs.kind) = 'record' then 'recorded'
    else 'on_file'
  end                               as display_status

from public.documents d
left join public.document_scans s on s.document_id = d.id and s.is_current
left join readable rs              on rs.document_id = d.id
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
  -- 049's rule, over 075's rows and 076's kind. Both sides now come from the same reading.
  select
    case k.kind
      when 'permit' then coalesce(expiry.due_on, latest.due_on, rs.doc_date)
      when 'certificate' then coalesce(expiry.due_on, latest.due_on, rs.doc_date)
      when 'record' then coalesce(rs.doc_date, latest_any.due_on)
      else rs.doc_date
    end as significant_date,
    case
      when k.kind in ('permit', 'certificate') then
        case when coalesce(expiry.due_on, latest.due_on) is not null then 'expiry'
             when rs.doc_date is not null then coalesce(rs.doc_date_kind, 'issued')
             else null end
      when k.kind in ('program', 'policy') then
        case when rs.doc_date is null then null
             when rs.doc_date_kind ~* '(revis|effective)' then rs.doc_date_kind
             else 'revised' end
      when k.kind = 'record' then
        case when coalesce(rs.doc_date, latest_any.due_on) is not null then 'last_entry' else null end
      when k.kind = 'supplier_document' then
        case when rs.doc_date is not null then 'revised' else null end
      else case when rs.doc_date is not null then rs.doc_date_kind else null end
    end as significant_date_kind
  from (select coalesce(c_kind.new_value #>> '{}', rs.kind) as kind) k
  left join lateral (
    select dd.due_on from public.document_dates_current_v dd
     where dd.document_id = d.id and dd.due_on is not null and not dd.recurs
       and dd.title ~* 'expir'
     order by dd.due_on desc limit 1
  ) expiry on true
  left join lateral (
    select dd.due_on from public.document_dates_current_v dd
     where dd.document_id = d.id and dd.due_on is not null and not dd.recurs
     order by dd.due_on desc limit 1
  ) latest on true
  left join lateral (
    select dd.due_on from public.document_dates_current_v dd
     where dd.document_id = d.id and dd.due_on is not null
     order by dd.due_on desc limit 1
  ) latest_any on true
) sd on true
left join lateral (
  select count(*)::int as open_gaps
    from public.document_gaps dg
   where dg.document_id = d.id and dg.status = 'open'
) g on true;

comment on view public.document_index_v is
  'One row per document. WHAT THE DOCUMENT IS — title, kind, agencies, subjects, issuer, summary, '
  'date and significant date — comes from the latest reading that COULD READ it (migration 076). '
  'WHAT STATE IT IS IN — display_status, scan_status, could_not_read_reason — comes from the current '
  'reading, failed or not (044, a conclusion beats an absence). A correction the person made outranks '
  'both, field by field, newest first. `scan_id` is the CURRENT scan, because the drawer watches it '
  'to know a re-read has landed; `readable_scan_id` is where the identity came from, and '
  '`identity_from_an_earlier_reading` says when those differ. security_invoker: only rows the caller '
  'could select.';

revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;
grant select on public.document_index_v to service_role;

-- ===========================================================================
-- VERIFY. The claim is that a failed reading takes NOTHING but the status, so each field is asserted
-- across the failure — and the audit's own filter is run here, because "it is still in the agency's
-- audit" is the sentence the owner's decision is about.
-- ===========================================================================
do $$
declare
  co uuid; doc uuid; neverRead uuid; newer uuid;
  s1 uuid; s2 uuid; s3 uuid; sOnly uuid;
  r record; n int;
begin
  insert into public.companies (name) values ('076 probe') returning id into co;

  -- A DEQ AIR PERMIT, READ WELL.
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'acdp.pdf', co || '/acdp.pdf', 'application/pdf') returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, title, agencies, subjects,
                                     issuer, summary, doc_date, doc_date_kind, is_current, scanned_at)
       values (doc, co, 'permit', 'current', 'Standard Air Contaminant Discharge Permit 26-2841',
               '["Oregon DEQ"]'::jsonb, '["Air quality"]'::jsonb, 'Oregon DEQ',
               'An air permit for the Portland facility.', '2021-07-18', 'issued', true,
               now() - interval '2 days') returning id into s1;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs)
       values (s1, doc, co, 'Permit expires', '2026-11-15', 'This permit expires 15 November 2026.', false);

  select * into r from public.document_index_v where document_id = doc;
  if r.kind <> 'permit' or not (r.agencies ? 'Oregon DEQ') or r.significant_date <> '2026-11-15'
     or r.title <> 'Standard Air Contaminant Discharge Permit 26-2841' then
    raise exception 'MIGRATION 076 FAILED: the good reading is not reflected (% / % / % / %).',
      r.kind, r.agencies, r.significant_date, r.title;
  end if;
  if r.identity_from_an_earlier_reading then
    raise exception 'MIGRATION 076 FAILED: a document read once says its identity is from an earlier reading.';
  end if;

  -- THE READING SERVICE REFUSES.
  update public.document_scans set is_current = false where id = s1;
  insert into public.document_scans (document_id, company_id, status, is_current, scanned_at, could_not_read_reason)
       values (doc, co, 'could_not_read', true, now() - interval '1 day',
               'The reading service refused our request.') returning id into s2;

  select * into r from public.document_index_v where document_id = doc;
  -- ---- WHAT THE DOCUMENT IS: every field survives ----
  if r.kind <> 'permit' then raise exception 'MIGRATION 076 FAILED: the document lost its KIND (%).', r.kind; end if;
  if not (r.agencies ? 'Oregon DEQ') then
    raise exception 'MIGRATION 076 FAILED: the document lost its AGENCIES (%) — it is out of its own audit.', r.agencies;
  end if;
  if not (r.subjects ? 'Air quality') then
    raise exception 'MIGRATION 076 FAILED: the document lost its SUBJECTS (%).', r.subjects;
  end if;
  if r.title <> 'Standard Air Contaminant Discharge Permit 26-2841' then
    raise exception 'MIGRATION 076 FAILED: the title fell back to the file name (%).', r.title;
  end if;
  if r.issuer is distinct from 'Oregon DEQ' then raise exception 'MIGRATION 076 FAILED: the issuer is %.', r.issuer; end if;
  if r.summary is null then raise exception 'MIGRATION 076 FAILED: the summary is gone.'; end if;
  if r.doc_date <> '2021-07-18' then raise exception 'MIGRATION 076 FAILED: the document date is %.', r.doc_date; end if;
  if r.significant_date <> '2026-11-15' or r.significant_date_kind <> 'expiry' then
    raise exception 'MIGRATION 076 FAILED: the expiry is % (%).', r.significant_date, r.significant_date_kind;
  end if;
  if r.scanned_at >= now() - interval '1 day' + interval '1 second' then
    raise exception 'MIGRATION 076 FAILED: "read on" is the failed attempt''s date (%).', r.scanned_at;
  end if;

  -- ---- WHAT STATE IT IS IN: the failure is still the answer ----
  if r.display_status <> 'could_not_read' or r.scan_status <> 'could_not_read' then
    raise exception 'MIGRATION 076 FAILED: the document no longer says it could not be read (% / %).',
      r.display_status, r.scan_status;
  end if;
  if r.could_not_read_reason is null then
    raise exception 'MIGRATION 076 FAILED: the reason the reading failed is not on the row.';
  end if;
  -- ...and it SAYS the identity is an earlier reading's, so the row and the drawer can tell a person.
  if not r.identity_from_an_earlier_reading then
    raise exception 'MIGRATION 076 FAILED: the row does not say its identity is from an earlier reading.';
  end if;
  if r.readable_scan_id <> s1 or r.scan_id <> s2 then
    raise exception 'MIGRATION 076 FAILED: readable_scan_id is % (expected %) and scan_id is % (expected %).',
      r.readable_scan_id, s1, r.scan_id, s2;
  end if;

  -- *** THE AUDIT'S OWN FILTER (`lib/audit.ts:148–153`), run here. ***
  -- This is the sentence the owner's decision is about, so it is asserted rather than inferred from
  -- the agencies column above.
  select count(*) into n from public.document_index_v
   where company_id = co and agencies ? 'Oregon DEQ';
  if n <> 1 then
    raise exception 'MIGRATION 076 FAILED: an Oregon DEQ audit would read % document(s) after a failed reading.', n;
  end if;

  -- A LATER GOOD READING TAKES OVER, and the row stops saying "an earlier reading".
  update public.document_scans set is_current = false where document_id = doc;
  insert into public.document_scans (document_id, company_id, kind, status, title, agencies, is_current, scanned_at)
       values (doc, co, 'permit', 'current', 'Standard ACDP 26-2841, renewed', '["Oregon DEQ"]'::jsonb,
               true, now()) returning id into s3;
  select * into r from public.document_index_v where document_id = doc;
  if r.title <> 'Standard ACDP 26-2841, renewed' or r.identity_from_an_earlier_reading then
    raise exception 'MIGRATION 076 FAILED: a later good reading did not take over (% / %).',
      r.title, r.identity_from_an_earlier_reading;
  end if;

  -- A CORRECTION STILL OUTRANKS BOTH READINGS.
  insert into public.document_corrections (document_id, company_id, field, new_value)
       values (doc, co, 'kind', '"certificate"'::jsonb);
  select * into r from public.document_index_v where document_id = doc;
  if r.kind <> 'certificate' then
    raise exception 'MIGRATION 076 FAILED: a person''s correction no longer outranks the reading (%).', r.kind;
  end if;
  delete from public.document_corrections where document_id = doc;

  -- A DOCUMENT WHOSE ONLY READING FAILED has no identity to borrow, and must say so without
  -- pretending: no kind, no agencies, and still "could not read".
  insert into public.documents (company_id, name, file_url, file_type, status)
       values (co, 'unreadable.pdf', co || '/u.pdf', 'application/pdf', 'could_not_read') returning id into neverRead;
  insert into public.document_scans (document_id, company_id, status, is_current, could_not_read_reason)
       values (neverRead, co, 'could_not_read', true, 'HEIC is not a format we can read.') returning id into sOnly;
  select * into r from public.document_index_v where document_id = neverRead;
  if r.display_status <> 'could_not_read' then
    raise exception 'MIGRATION 076 FAILED: a never-read document is % rather than could_not_read.', r.display_status;
  end if;
  if r.identity_from_an_earlier_reading then
    raise exception 'MIGRATION 076 FAILED: a never-read document claims an earlier reading.';
  end if;
  if r.title <> 'unreadable.pdf' then
    raise exception 'MIGRATION 076 FAILED: a never-read document should fall back to its file name, got %.', r.title;
  end if;

  -- THE ORDINARY CASE IS UNCHANGED: a document read once, never failed, answers as before.
  select count(*) into n from public.document_index_v
   where company_id = co and identity_from_an_earlier_reading;
  if n <> 0 then
    raise exception 'MIGRATION 076 FAILED: % document(s) claim an earlier reading when none failed.', n;
  end if;

  -- Grants and columns, read back.
  if has_table_privilege('anon', 'public.document_index_v', 'SELECT') then
    raise exception 'MIGRATION 076 FAILED: anon can read document_index_v.';
  end if;
  if not has_table_privilege('authenticated', 'public.document_index_v', 'SELECT') then
    raise exception 'MIGRATION 076 FAILED: authenticated cannot read document_index_v.';
  end if;
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'document_index_v'
     and column_name in ('document_id','company_id','title','file_name','kind','agencies','subjects',
       'issuer','site_name','entity_id','folder_name','folder_id','doc_date','doc_date_kind',
       'significant_date','significant_date_kind','scanned_at','uploaded_at','latest_confirmed_at',
       'scan_status','document_status','could_not_read_reason','summary','version_of',
       'version_confirmed','scan_id','open_gap_count','correction_count','display_status',
       'readable_scan_id','identity_from_an_earlier_reading');
  if n <> 31 then
    raise exception 'MIGRATION 076 FAILED: document_index_v is missing a column (% of 31).', n;
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 076 VERIFIED: a reading that could not read a document takes NOTHING but the status — its kind, agencies, subjects, title, issuer, summary, date and expiry all survive, and an Oregon DEQ audit still reads it; the failure is still the document''s state, with its reason; the row says its identity is from an earlier reading and names that reading; a later good reading takes over; a person''s correction still outranks both; a document whose ONLY reading failed borrows nothing and falls back to its file name; no document that never failed claims an earlier reading.';
end $$;

commit;
