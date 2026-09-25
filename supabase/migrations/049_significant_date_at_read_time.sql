-- 049 — THE DATE THAT MATTERS IS COMPUTED WHEN IT IS READ, NOT FROZEN WHEN IT WAS WRITTEN.
--
-- Run 4 put the choice in code (`chooseSignificantDate`) and stored the answer on the scan row.
-- That was half right. The rule then got corrected twice in one afternoon — the expiry was being
-- matched on a deadline's source line, and an issue date was being read as an expiry — and
-- neither fix could reach a single document already scanned. 02-acdp-chemical went on showing
-- "Expires 18 July 2026", the renewal date, because the wrong answer was written down.
--
-- A DERIVED VALUE STORED IS A VALUE THAT GOES STALE THE FIRST TIME YOU LEARN SOMETHING. It is
-- also the one that cannot follow a correction: a person changes the kind from policy to permit
-- and the date that matters should change with it, which a column written weeks ago never will.
--
-- So the rule lives in the view. The columns stop being written by `saveScan` and are dropped
-- here, in the same migration, because nothing else reads them — every reader (the Documents
-- page, the report drawer) goes through `document_index_v`, and the only other mention is
-- `scripts/scan-document.js` printing the in-memory scan object, which is unaffected.
--
-- `chooseSignificantDate` and its eleven tests stay as the executable statement of the rule, and
-- the probe at the bottom of this file walks the SQL through the same cases so the two are pinned
-- against each other rather than left to drift.

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
  sd.significant_date,
  sd.significant_date_kind,
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
         and sd.significant_date_kind = 'expiry'
         and sd.significant_date is not null and sd.significant_date < current_date then 'expired'
    when coalesce(c_kind.new_value #>> '{}', s.kind) in ('permit', 'certificate')
         and sd.significant_date_kind = 'expiry'
         and sd.significant_date is not null and sd.significant_date <= current_date + 90 then 'expiring'
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
  -- ===========================================================================
  -- THE DATE THAT MATTERS, COMPUTED AT READ TIME FROM THE KIND.
  --
  -- The same rule `chooseSignificantDate()` implements in lib/documentScan.ts, moved here so it
  -- is applied to what the tables SAY NOW rather than frozen into the row when the scan was
  -- written. Run 4 stored it, and the moment the rule was corrected every existing scan kept its
  -- wrong answer: 02-acdp-chemical went on reading "Expires 18 July 2026" — the renewal date —
  -- because fixing the code could not reach a value already written down. A derived field stored
  -- is a field that goes stale the first time you learn something.
  --
  -- It also means a CORRECTION to kind or doc_date moves this date with it, which a stored
  -- column could never do.
  --
  --   permit, certificate  the expiry: a non-recurring deadline whose TITLE says expiry, latest
  --                        first; else the latest non-recurring dated deadline. Matching the
  --                        source line instead let a renewal deadline citing "…before the
  --                        expiration date" win over the expiry itself.
  --                        If there is no such deadline the document's own date stands, and it
  --                        keeps its own kind — an issue date is not an expiry (048).
  --   program, policy      its own date, so freshness is measurable
  --   record               the last entry
  --   supplier_document    the supplier's revision
  --   other                its own date
  -- ===========================================================================
  select
    case k.kind
      when 'permit' then coalesce(expiry.due_on, latest.due_on, s.doc_date)
      when 'certificate' then coalesce(expiry.due_on, latest.due_on, s.doc_date)
      when 'record' then coalesce(s.doc_date, latest_any.due_on)
      else s.doc_date
    end as significant_date,
    case
      when k.kind in ('permit', 'certificate') then
        case when coalesce(expiry.due_on, latest.due_on) is not null then 'expiry'
             when s.doc_date is not null then coalesce(s.doc_date_kind, 'issued')
             else null end
      when k.kind in ('program', 'policy') then
        case when s.doc_date is null then null
             when s.doc_date_kind ~* '(revis|effective)' then s.doc_date_kind
             else 'revised' end
      when k.kind = 'record' then
        case when coalesce(s.doc_date, latest_any.due_on) is not null then 'last_entry' else null end
      when k.kind = 'supplier_document' then
        case when s.doc_date is not null then 'revised' else null end
      else case when s.doc_date is not null then s.doc_date_kind else null end
    end as significant_date_kind
  from (select coalesce(c_kind.new_value #>> '{}', s.kind) as kind) k
  left join lateral (
    select dd.due_on from public.document_deadlines dd
     where dd.document_id = d.id and dd.due_on is not null and not dd.recurs
       and dd.title ~* 'expir'
     order by dd.due_on desc limit 1
  ) expiry on true
  left join lateral (
    select dd.due_on from public.document_deadlines dd
     where dd.document_id = d.id and dd.due_on is not null and not dd.recurs
     order by dd.due_on desc limit 1
  ) latest on true
  left join lateral (
    select dd.due_on from public.document_deadlines dd
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
  'One row per document with the columns the Documents page groups and sorts by. A correction '
  'the person made outranks the scan, field by field, newest first. significant_date and its '
  'kind are COMPUTED HERE from the kind, the deadlines and the document date — never stored. '
  'security_invoker: only rows the caller could select.';

revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;

-- The stored copies go, now that nothing reads them. Dropping rather than leaving them is the
-- point: two places holding the same answer is how one of them silently becomes the wrong one.
alter table public.document_scans drop column if exists significant_date;
alter table public.document_scans drop column if exists significant_date_kind;

-- ---------------------------------------------------------------------------
-- VERIFY: the SQL walks the same cases as chooseSignificantDate's unit tests, so the two
-- statements of one rule are pinned against each other rather than left to drift.
-- ---------------------------------------------------------------------------
do $$
declare
  co uuid; doc uuid; sc uuid; gotd date; gotk text; gots text;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 049: no company on this database, probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-049-probe.pdf', 'probe/049', 'application/pdf', 1, 'upload', 'read')
    returning id into doc;

  -- ---- a permit: the expiry wins over a renewal that MENTIONS the expiry, and over a
  --      recurring report date. This is golden case 02, which read 18 July until Run 4 fixed it.
  insert into public.document_scans (document_id, company_id, kind, status, doc_date, doc_date_kind, is_current)
    values (doc, co, 'permit', 'current', date '2021-09-01', 'issued', true) returning id into sc;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs) values
    (sc, doc, co, 'Renewal application submission deadline', date '2026-07-18',
     'no later than 120 days before the expiration date', false),
    (sc, doc, co, 'Permit expiration (CRITICAL)', date '2026-11-15', 'condition 1.2', false),
    (sc, doc, co, 'Annual report due date', date '2027-02-15', 'condition 4.1', true);
  select significant_date, significant_date_kind into gotd, gotk
    from public.document_index_v where document_id = doc;
  if gotd <> date '2026-11-15' or gotk <> 'expiry' then
    raise exception 'MIGRATION 049 FAILED: a permit reads % (%), wanted 2026-11-15 expiry.', gotd, gotk;
  end if;

  -- ---- a permit with NO expiry deadline: its own date, keeping its own kind, and NOT expired.
  --      Golden case 03, a licence valid until 2027 that read "Expired".
  delete from public.document_deadlines where document_id = doc;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs)
    values (sc, doc, co, 'Annual licence renewal application and fee', date '2027-02-10', true);
  update public.document_scans set kind = 'certificate', doc_date = date '2026-03-03', doc_date_kind = 'issued' where id = sc;
  select significant_date, significant_date_kind, display_status into gotd, gotk, gots
    from public.document_index_v where document_id = doc;
  if gotd <> date '2026-03-03' or gotk <> 'issued' then
    raise exception 'MIGRATION 049 FAILED: a certificate with no expiry reads % (%), wanted its issue date.', gotd, gotk;
  end if;
  if gots <> 'current' then
    raise exception 'MIGRATION 049 FAILED: a licence dated by its issue date reads %, wanted current.', gots;
  end if;

  -- ---- a program: its own revision date, never a deadline. Golden case 01, which read
  --      "Renewal 1 January 2026" on a plan revised in February 2021.
  delete from public.document_deadlines where document_id = doc;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs)
    values (sc, doc, co, 'Annual plan review in January', date '2026-01-01', true);
  update public.document_scans set kind = 'program', doc_date = date '2021-02-01', doc_date_kind = 'revised' where id = sc;
  select significant_date, significant_date_kind into gotd, gotk
    from public.document_index_v where document_id = doc;
  if gotd <> date '2021-02-01' or gotk <> 'revised' then
    raise exception 'MIGRATION 049 FAILED: a program reads % (%), wanted 2021-02-01 revised.', gotd, gotk;
  end if;

  -- ...and a policy dated "effective" keeps that word rather than being relabelled.
  update public.document_scans set kind = 'policy', doc_date = date '2025-05-12', doc_date_kind = 'effective' where id = sc;
  select significant_date_kind into gotk from public.document_index_v where document_id = doc;
  if gotk <> 'effective' then
    raise exception 'MIGRATION 049 FAILED: an effective date was relabelled %.', gotk;
  end if;

  -- ---- a record takes its last entry, not an operator evaluation two years out.
  delete from public.document_deadlines where document_id = doc;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs)
    values (sc, doc, co, 'M. Chen operator evaluation due', date '2027-03-11', false);
  update public.document_scans set kind = 'record', doc_date = date '2026-09-18', doc_date_kind = 'last_entry' where id = sc;
  select significant_date, significant_date_kind into gotd, gotk
    from public.document_index_v where document_id = doc;
  if gotd <> date '2026-09-18' or gotk <> 'last_entry' then
    raise exception 'MIGRATION 049 FAILED: a record reads % (%), wanted its last entry.', gotd, gotk;
  end if;

  -- ---- a supplier document takes the supplier's revision.
  update public.document_scans set kind = 'supplier_document', doc_date = date '2024-03-18', doc_date_kind = 'revised' where id = sc;
  select significant_date_kind into gotk from public.document_index_v where document_id = doc;
  if gotk <> 'revised' then
    raise exception 'MIGRATION 049 FAILED: a supplier document reads %, wanted revised.', gotk;
  end if;

  -- ---- nothing to go on gives null, not a guess.
  delete from public.document_deadlines where document_id = doc;
  update public.document_scans set kind = 'program', doc_date = null, doc_date_kind = null where id = sc;
  select significant_date, significant_date_kind into gotd, gotk
    from public.document_index_v where document_id = doc;
  if gotd is not null or gotk is not null then
    raise exception 'MIGRATION 049 FAILED: with no date at all it invented % (%).', gotd, gotk;
  end if;

  -- ---- AND THE THING A STORED COLUMN COULD NEVER DO: a correction moves the date with it.
  update public.document_scans set kind = 'program', doc_date = date '2021-02-01', doc_date_kind = 'revised' where id = sc;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs)
    values (sc, doc, co, 'Permit expiration', date '2027-11-15', false);
  insert into public.document_corrections (document_id, company_id, field, old_value, new_value, reason)
    values (doc, co, 'kind', '"program"'::jsonb, '"permit"'::jsonb, 'It is our air permit.');
  select significant_date, significant_date_kind into gotd, gotk
    from public.document_index_v where document_id = doc;
  if gotd <> date '2027-11-15' or gotk <> 'expiry' then
    raise exception 'MIGRATION 049 FAILED: correcting the kind did not move the date; got % (%).', gotd, gotk;
  end if;

  delete from public.documents where id = doc;
  raise notice 'MIGRATION 049: the date is computed from the kind at read time, and follows a correction.';
end $$;

commit;
