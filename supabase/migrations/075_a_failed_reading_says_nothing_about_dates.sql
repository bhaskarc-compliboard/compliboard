-- ===========================================================================
-- 075 — A READING THAT COULD NOT READ THE DOCUMENT SAYS NOTHING ABOUT ITS DATES
--
-- Calendar Job A, A3c. This repairs a REGRESSION MIGRATION 074 INTRODUCED, found by the chat's
-- hypothesis and proved on staging before a line was changed
-- (`scripts/calendar-a3b-failed-reread.mjs`):
--
--     a second document, with a NON-RECURRING expiry — the case 049's rule actually reads:
--        after a GOOD reading     significant_date = 2026-11-15  (expiry)  status = expiring        view rows = 1
--        after a FAILED re-read   significant_date = NULL        (none)    status = could_not_read  view rows = 0
--
--     *** the current-dates view returns NOTHING while the document holds 4 dates. ***
--
-- WHAT A PERSON SAW. A permit whose expiry we hold, re-read on a day the reading service refused,
-- showed **"Could not read" with no expiry at all** — and its report drawer listed no dates. Before
-- 074 the index's three lateral reads went over `document_deadlines` with no scan filter, so the
-- expiry survived a failed re-read; 074 narrowed them to `document_dates_current_v`, which joins
-- `and s.is_current`, and a failed scan IS the current scan.
--
-- *** THE DISTINCTION THIS MIGRATION ENCODES. ***
--   · A failed reading still owns the document's STATUS. `display_status` must say "Could not read"
--     — migration 044's rule, "a conclusion beats an absence" — and this file does not touch that.
--   · A failed reading owns NOTHING about the document's DATES. It did not read the document, so it
--     has no opinion, and absence of evidence is not evidence of absence (`CLAUDE.md` §3.2's first
--     rule, which `lib/documentScan.ts`'s calendar step met in the same shape at A3b).
--
-- So for DATES, "current" stops meaning `is_current` and starts meaning **the latest reading that
-- could read the document**. On every document that has never failed a reading — all 13 on staging —
-- that is the same scan, and the verify block asserts the answers do not move.
--
-- ONE DEFINITION, FOUR READERS. The view is what the calendar's writer, the calendar's reader,
-- Documents' report and `document_index_v` all go through, so they cannot disagree about what this
-- document's dates are. `lib/documentScan.ts`'s guard — the calendar step returns early on a
-- `could_not_read` reading — STAYS as a second lock: the view now also returns the earlier reading's
-- dates, so without that guard a failed reading would re-add them all as new not-confirmed rows.
--
-- *** `status` IS NULLABLE, read from `information_schema` and not assumed. *** So the test is
-- `coalesce(status, '') <> 'could_not_read'` and not `status <> 'could_not_read'`, which is NULL for a
-- null status and would silently drop that scan — a CHECK-on-NULL mistake in a WHERE clause, the same
-- shape §3.7 warns about. Staging holds 4 scans with `not_judged` and none with a null status today;
-- the coalesce is there so a null one is INCLUDED rather than quietly lost.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The current dates — "current" now means the latest READABLE reading.
-- ---------------------------------------------------------------------------
-- `document_index_v` depends on this view, so it is dropped and rebuilt below.
drop view if exists public.document_index_v;
drop view if exists public.document_dates_current_v;

create view public.document_dates_current_v
with (security_invoker = true) as
with readable as (
  -- One row per document: its latest reading that actually read it.
  --
  -- `scanned_at desc, id desc` — the `id` is a TIE-BREAK and not decoration, the lesson migration 049
  -- recorded about `created_at`: two scans written in one transaction carry the identical timestamp and
  -- `distinct on` would then pick whichever row it reached first, which makes the view
  -- non-deterministic and so impossible to reason about.
  select distinct on (document_id) id, document_id, scanned_at, entity_id, is_current
    from public.document_scans
   where coalesce(status, '') <> 'could_not_read'
   order by document_id, scanned_at desc, id desc
)
select
  dd.id                as deadline_id,
  dd.company_id,
  dd.document_id,
  dd.scan_id,
  dd.title,
  dd.due_on,
  dd.source_line,
  dd.quote_verified,
  dd.recurs,
  dd.calendar_event_id,
  dd.created_at,
  r.scanned_at,
  r.entity_id,
  -- *** TRUE WHEN THESE DATES COME FROM AN EARLIER READING THAN THE CURRENT ONE. ***
  -- The report shows one grey line when it is: "These dates are from the last reading that could read
  -- this document, on <date>." Without it the drawer would show dates beside "Could not read" and say
  -- nothing about where they came from, which is a claim about a document presented without its basis
  -- (§5.1, and §6's rule that a verified row and a generated row must not look the same).
  not r.is_current     as from_an_earlier_reading
from public.document_deadlines dd
join readable r
  on r.id = dd.scan_id
where not exists (
  select 1 from public.documents newer
   where newer.version_of = dd.document_id
     and newer.version_confirmed
);

comment on view public.document_dates_current_v is
  'Calendar decision 4 (DECISIONS §185), repaired by migration 075. The dates a company actually has: '
  'the latest reading that COULD READ the document — not merely the latest reading — for a document no '
  'CONFIRMED newer version supersedes. A reading that could not read the document still owns the '
  'document''s STATUS (044) and says nothing about its dates, so a refusal by the reading service '
  'cannot erase a permit''s expiry. `from_an_earlier_reading` is true when that is what happened, and '
  'the report says so in words. security_invoker: only rows the caller could select.';

revoke all on public.document_dates_current_v from anon;
revoke all on public.document_dates_current_v from authenticated;
grant select on public.document_dates_current_v to authenticated;
grant select on public.document_dates_current_v to service_role;

-- ---------------------------------------------------------------------------
-- 2. document_index_v, rebuilt on it. 074's definition, unchanged but for the view it reads.
-- ---------------------------------------------------------------------------
create view public.document_index_v
with (security_invoker = true) as
with newest as (
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
    when d.status = 'could_not_read' or s.status = 'could_not_read' then 'could_not_read'
    when d.status in ('uploaded', 'reading') or s.id is null then 'not_yet_read'
    when s.status = 'gaps_found' then 'needs_work'
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
-- *** THE DOCUMENT'S OWN ROW STILL COMES FROM THE CURRENT SCAN, FAILED OR NOT. ***
-- `display_status`, `scan_status`, `could_not_read_reason` and the summary are the document's STATE,
-- and 044's rule is that a conclusion beats an absence: a document that could not be read must say so
-- rather than go on showing the reading before it. Only the DATES below come from the readable one.
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
  -- 049's rule, over 075's rows: the latest reading that COULD READ the document.
  --
  -- The fallback `s.doc_date` is still the CURRENT scan's own date, which is null on a failed reading —
  -- so a document whose only date was its issue date reads null while it cannot be read, and that is
  -- right: the issue date is a property of the reading, not of the deadlines.
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
  'One row per document with the columns the Documents page groups and sorts by. A correction the '
  'person made outranks the scan, field by field, newest first. The document''s STATE comes from the '
  'current scan, failed or not (044). significant_date and its kind are COMPUTED from the kind and the '
  'latest reading that COULD READ the document (migration 075) — never stored, never from a replaced '
  'reading, and never erased by a reading that failed. security_invoker: only rows the caller could '
  'select.';

revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;
grant select on public.document_index_v to service_role;

-- ===========================================================================
-- VERIFY. Three things have to hold at once, and only the third is obvious:
--   (a) a failed reading no longer erases a date;
--   (b) a failed reading STILL sets the document's status, or this fix has hidden a failure;
--   (c) nothing else moved — a replaced-but-readable reading is still superseded, and a document that
--       never failed a reading answers exactly as it did.
-- ===========================================================================
do $$
declare
  co uuid; doc uuid; docOnce uuid; newer uuid;
  s1 uuid; s2 uuid; s3 uuid; sOnce uuid;
  got date; gotk text; st text; n int; earlier boolean;
begin
  insert into public.companies (name) values ('075 probe') returning id into co;

  -- A PERMIT, READ WELL (an expiry found), THEN A READING THAT COULD NOT READ IT.
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'acdp.pdf', co || '/acdp.pdf', 'application/pdf') returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, doc_date, doc_date_kind, is_current, scanned_at)
       values (doc, co, 'permit', 'current', '2021-07-18', 'issued', true, now() - interval '2 days') returning id into s1;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs)
       values (s1, doc, co, 'Permit expires', '2026-11-15', 'This permit expires 15 November 2026.', false);

  select significant_date, significant_date_kind into got, gotk from public.document_index_v where document_id = doc;
  if got <> '2026-11-15' or gotk <> 'expiry' then
    raise exception 'MIGRATION 075 FAILED: the good reading''s expiry is not the document''s date (got %, %).', got, gotk;
  end if;

  -- The failed re-read.
  update public.document_scans set is_current = false where id = s1;
  insert into public.document_scans (document_id, company_id, kind, status, is_current, scanned_at, could_not_read_reason)
       values (doc, co, null, 'could_not_read', true, now() - interval '1 day',
               'The reading service refused our request.') returning id into s2;

  -- (a) THE DATE SURVIVES.
  select significant_date, significant_date_kind into got, gotk from public.document_index_v where document_id = doc;
  if got <> '2026-11-15' or gotk <> 'expiry' then
    raise exception 'MIGRATION 075 FAILED: a reading that could not read the document erased its expiry (got %, %).', got, gotk;
  end if;
  select count(*) into n from public.document_dates_current_v where document_id = doc;
  if n <> 1 then
    raise exception 'MIGRATION 075 FAILED: the current-dates view returned % rows after a failed reading; expected 1.', n;
  end if;
  -- ...and it SAYS it is from an earlier reading, so the report can tell the person.
  select from_an_earlier_reading into earlier from public.document_dates_current_v where document_id = doc;
  if earlier is not true then
    raise exception 'MIGRATION 075 FAILED: dates from an earlier reading do not say so.';
  end if;

  -- (b) THE FAILURE IS STILL THE DOCUMENT'S STATE. If this fix hid it, it would be worse than the bug.
  select display_status, scan_status into st, gotk from public.document_index_v where document_id = doc;
  if st <> 'could_not_read' or gotk <> 'could_not_read' then
    raise exception 'MIGRATION 075 FAILED: the document no longer says it could not be read (% / %).', st, gotk;
  end if;
  if (select could_not_read_reason from public.document_index_v where document_id = doc) is null then
    raise exception 'MIGRATION 075 FAILED: the reason the reading failed is not on the row.';
  end if;

  -- (c1) A GOOD READING AFTER THE FAILED ONE TAKES OVER AGAIN, and its dates say they are current.
  update public.document_scans set is_current = false where document_id = doc;
  insert into public.document_scans (document_id, company_id, kind, status, doc_date, doc_date_kind, is_current, scanned_at)
       values (doc, co, 'permit', 'current', '2026-08-01', 'issued', true, now()) returning id into s3;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs)
       values (s3, doc, co, 'Permit expires', '2031-08-01', 'This permit expires 1 August 2031.', false);
  select significant_date into got from public.document_index_v where document_id = doc;
  if got <> '2031-08-01' then
    raise exception 'MIGRATION 075 FAILED: a later GOOD reading did not take over (got %).', got;
  end if;
  select from_an_earlier_reading into earlier from public.document_dates_current_v where document_id = doc;
  if earlier is not false then
    raise exception 'MIGRATION 075 FAILED: the current reading''s dates claim to be from an earlier one.';
  end if;
  -- the superseded readable reading's date is gone from the view: 074's rule is unchanged
  select count(*) into n from public.document_dates_current_v where document_id = doc;
  if n <> 1 then
    raise exception 'MIGRATION 075 FAILED: a REPLACED readable reading''s dates are still current (% rows).', n;
  end if;

  -- (c2) A CONFIRMED NEWER VERSION still supersedes; an unconfirmed one still does not.
  insert into public.documents (company_id, name, file_url, file_type, version_of, version_confirmed)
       values (co, 'acdp-2031.pdf', co || '/a2.pdf', 'application/pdf', doc, false) returning id into newer;
  select count(*) into n from public.document_dates_current_v where document_id = doc;
  if n <> 1 then raise exception 'MIGRATION 075 FAILED: an unconfirmed newer version hid the dates (% rows).', n; end if;
  update public.documents set version_confirmed = true where id = newer;
  select count(*) into n from public.document_dates_current_v where document_id = doc;
  if n <> 0 then raise exception 'MIGRATION 075 FAILED: a confirmed newer version did not supersede (% rows).', n; end if;
  update public.documents set version_confirmed = false where id = newer;

  -- (c3) A DOCUMENT THAT NEVER FAILED A READING ANSWERS EXACTLY AS IT DID — the claim that says this
  -- narrowing broke nothing. Every document on staging but none is in this case.
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'cert.pdf', co || '/cert.pdf', 'application/pdf') returning id into docOnce;
  insert into public.document_scans (document_id, company_id, kind, status, doc_date, doc_date_kind, is_current)
       values (docOnce, co, 'certificate', 'current', '2026-01-01', 'issued', true) returning id into sOnce;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs) values
       (sOnce, docOnce, co, 'Certificate expires', '2027-03-01', 'Valid until 1 March 2027.', false),
       (sOnce, docOnce, co, 'Monthly visual inspection', '2026-10-31', 'Monthly inspections remain yours.', true);
  select significant_date, significant_date_kind into got, gotk from public.document_index_v where document_id = docOnce;
  if got <> '2027-03-01' or gotk <> 'expiry' then
    raise exception 'MIGRATION 075 FAILED: a document read once changed its answer (got %, %).', got, gotk;
  end if;

  -- (c4) A NULL STATUS IS INCLUDED, NOT LOST. `status` is nullable, and `status <> ''could_not_read''`
  -- would be NULL for such a row and drop it — the shape §3.7 warns about, in a WHERE clause.
  update public.document_scans set status = null where id = sOnce;
  select count(*) into n from public.document_dates_current_v where document_id = docOnce;
  if n <> 2 then
    raise exception 'MIGRATION 075 FAILED: a scan with a NULL status was dropped from the current dates (% rows).', n;
  end if;

  -- The grants, read back.
  foreach gotk in array array['document_dates_current_v', 'document_index_v'] loop
    if has_table_privilege('anon', 'public.' || gotk, 'SELECT') then
      raise exception 'MIGRATION 075 FAILED: anon can read %.', gotk;
    end if;
    if not has_table_privilege('authenticated', 'public.' || gotk, 'SELECT') then
      raise exception 'MIGRATION 075 FAILED: authenticated cannot read %.', gotk;
    end if;
  end loop;
  -- Every column the app reads by name, on both views.
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'document_index_v'
     and column_name in ('document_id','company_id','title','file_name','kind','agencies','subjects',
       'issuer','site_name','entity_id','folder_name','folder_id','doc_date','doc_date_kind',
       'significant_date','significant_date_kind','scanned_at','uploaded_at','latest_confirmed_at',
       'scan_status','document_status','could_not_read_reason','summary','version_of',
       'version_confirmed','scan_id','open_gap_count','correction_count','display_status');
  if n <> 29 then
    raise exception 'MIGRATION 075 FAILED: document_index_v is missing a column the app reads (% of 29).', n;
  end if;
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'document_dates_current_v'
     and column_name in ('deadline_id','company_id','document_id','scan_id','title','due_on','source_line',
       'quote_verified','recurs','calendar_event_id','created_at','scanned_at','entity_id','from_an_earlier_reading');
  if n <> 14 then
    raise exception 'MIGRATION 075 FAILED: document_dates_current_v is missing a column (% of 14).', n;
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 075 VERIFIED: a reading that could not read a document no longer erases its dates — the permit''s expiry survives the failure and the dates say they are from an earlier reading; the failure is STILL the document''s status, with its reason; a later good reading takes over and its dates say they are current; a replaced readable reading is still superseded; a confirmed newer version still supersedes and an unconfirmed one still does not; a document that never failed a reading answers exactly as before; a NULL status is included rather than dropped; both views are closed to anon and carry every column the app reads.';
end $$;

commit;
