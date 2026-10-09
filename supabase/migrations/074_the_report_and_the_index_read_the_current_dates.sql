-- ===========================================================================
-- 074 — THE REPORT AND THE INDEX READ THE CURRENT DATES
--
-- Calendar Step 4 (`docs/CALENDAR-PLAN.md` decision 4, `DECISIONS.md` §185). Migration 073 created
-- `document_dates_current_v` and nothing read it. This is the half that makes it true of Documents.
--
-- WHY. `docs/CALENDAR-MACHINERY.md` B3: a re-read keeps the old reading's `document_deadlines` rows,
-- nothing marks which reading is current, and THREE readers mix them:
--
--   1. the report (`app/api/documents/report/route.ts:43`) listed every reading's dates together, so
--      staging's one re-read document showed the same source line under two different titles — one
--      obligation, printed twice, with no way for a person to tell which was current;
--   2. `document_index_v`'s significant date (`049:156–171`) read every reading's deadlines, so
--      "Expired" and "Expiring" — the amber words on the Documents page — could come from a reading
--      we have replaced;
--   3. the Audits readers (`lib/audit.ts:175–177`, `app/api/audits/index/route.ts:72–78`) filter by
--      current SCAN but not by current VERSION. **Not changed here**: that is Audits' own work, and it
--      is recorded for them in `docs/HANDOFF-CODE.md` §7.
--
-- This migration fixes (2). (1) is a code change in the route, in the same commit.
--
-- WHAT CHANGES FOR A PERSON. A permit read twice, whose first reading found an expiry and whose second
-- did not, stops being called "Expired" on the strength of the reading we replaced. Nothing else: for
-- a document read once — every document on staging but one — the view and the old expression return
-- the same rows, which the verify block asserts rather than assumes.
--
-- WHAT IS NOT CHANGED. The three lateral reads keep their rules exactly: the expiry is still "a
-- non-recurring deadline whose TITLE says expiry, latest first", the fallback is still the latest
-- non-recurring dated deadline, and `record` still falls back to the latest dated deadline of any
-- kind. Only the SET of deadlines they read over is narrowed, from "every reading of this document" to
-- "the current one". The `significant_date` rule itself is `049`'s and is not being re-litigated.
-- ===========================================================================

begin;

-- `document_index_v` is recreated whole, because `create or replace view` cannot change a view that
-- other views or policies depend on and because the lateral block is the thing being edited. Its
-- definition is 049's, with the three `document_deadlines` reads replaced by reads of the current
-- dates. Everything else below is 049 verbatim.
drop view if exists public.document_index_v;
create view public.document_index_v
with (security_invoker = true) as
with newest as (
  -- `id desc` is a TIE-BREAK, not decoration (049): `created_at` defaults to now(), which is
  -- TRANSACTION time, so two corrections written in one transaction carry the identical timestamp and
  -- `distinct on` would pick whichever row it reached first.
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
    -- The CORRECTED kind, not the scanned one (049), and the date has to be an EXPIRY and not merely a
    -- date: only a date we actually believe is an expiry may expire (048).
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
  -- THE DATE THAT MATTERS, COMPUTED AT READ TIME FROM THE KIND (049's rule, unchanged).
  --
  -- *** WHAT 074 CHANGES: the three reads below are over `document_dates_current_v`, not over
  -- *** `document_deadlines`. The rule is identical; the set of rows it runs over is the CURRENT
  -- reading of a document no confirmed newer version supersedes.
  --
  -- The defect this closes (B3): a permit read in September whose reading found "expires 18 July 2026",
  -- re-read in October with no expiry found, kept the July date and went on reading "Expired" — from a
  -- reading the product itself had replaced. A derived field is only as honest as the rows it derives
  -- from, and 049 made the derivation live without narrowing the rows.
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
  'person made outranks the scan, field by field, newest first. significant_date and its kind are '
  'COMPUTED HERE from the kind and THE CURRENT READING''S deadlines (migration 074, Calendar decision '
  '4) — never stored, and never from a reading that has been replaced. security_invoker: only rows the '
  'caller could select.';

revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;
grant select on public.document_index_v to service_role;

-- ===========================================================================
-- VERIFY. The standard is §3.7's, and the hard part here is proving a NARROWING: a view that returns
-- fewer rows than it should looks exactly like a correct one until you compare it against the case
-- where the extra rows mattered. So the block builds that case — a document read twice whose two
-- readings DISAGREE — and asserts the answer changes the way it should and in no other way.
-- ===========================================================================
do $$
declare
  co uuid; doc uuid; docOnce uuid; newer uuid;
  scanOld uuid; scanNew uuid; scanOnce uuid;
  got date; gotk text; n int;
begin
  insert into public.companies (name) values ('074 probe') returning id into co;

  -- A PERMIT READ TWICE. The first reading found an expiry in 2026; the second found none at all,
  -- which is the real case: a re-read of a renewed permit whose new wording the model read differently.
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'acdp.pdf', co || '/acdp.pdf', 'application/pdf') returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, doc_date, doc_date_kind, is_current)
       values (doc, co, 'permit', 'current', '2021-07-18', 'issued', false) returning id into scanOld;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs)
       values (scanOld, doc, co, 'Permit expires', '2026-07-18', 'This permit expires 18 July 2026.', false);

  -- With only the old reading, the old date is the answer — the view can SEE a presence.
  select significant_date, significant_date_kind into got, gotk
    from public.document_index_v where document_id = doc;
  if got <> '2026-07-18' or gotk <> 'expiry' then
    raise exception 'MIGRATION 074 FAILED: with one reading the view did not return its expiry (got %, %).', got, gotk;
  end if;

  -- Now the second reading, which finds NO deadline at all.
  insert into public.document_scans (document_id, company_id, kind, status, doc_date, doc_date_kind, is_current)
       values (doc, co, 'permit', 'current', '2026-08-01', 'issued', true) returning id into scanNew;
  update public.document_scans set is_current = false where id = scanOld;

  -- *** THE DEFECT, ASSERTED GONE. *** The replaced reading's July 2026 date must no longer be the
  -- document's significant date, and the document must no longer read "Expired" because of it.
  select significant_date, significant_date_kind into got, gotk
    from public.document_index_v where document_id = doc;
  if got = '2026-07-18' then
    raise exception 'MIGRATION 074 FAILED: the view still returns a REPLACED reading''s expiry (%).', got;
  end if;
  if got <> '2026-08-01' or gotk <> 'issued' then
    raise exception 'MIGRATION 074 FAILED: with no deadline in the current reading the document''s own date should stand (got %, %).', got, gotk;
  end if;
  if (select display_status from public.document_index_v where document_id = doc) = 'expired' then
    raise exception 'MIGRATION 074 FAILED: the document still reads "expired" from a replaced reading.';
  end if;

  -- ...and the current reading's OWN expiry is used when it has one.
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs)
       values (scanNew, doc, co, 'Permit expires', '2031-08-01', 'This permit expires 1 August 2031.', false);
  select significant_date, significant_date_kind into got, gotk
    from public.document_index_v where document_id = doc;
  if got <> '2031-08-01' or gotk <> 'expiry' then
    raise exception 'MIGRATION 074 FAILED: the current reading''s own expiry was not used (got %, %).', got, gotk;
  end if;

  -- A CONFIRMED NEWER VERSION hides the older document's dates, so its expiry falls back to its own
  -- date. An UNCONFIRMED one changes nothing.
  insert into public.documents (company_id, name, file_url, file_type, version_of, version_confirmed)
       values (co, 'acdp-2031.pdf', co || '/acdp-2031.pdf', 'application/pdf', doc, false) returning id into newer;
  select significant_date into got from public.document_index_v where document_id = doc;
  if got <> '2031-08-01' then
    raise exception 'MIGRATION 074 FAILED: an UNCONFIRMED newer version changed the older document''s date (%).', got;
  end if;
  update public.documents set version_confirmed = true where id = newer;
  select significant_date, significant_date_kind into got, gotk from public.document_index_v where document_id = doc;
  if got <> '2026-08-01' then
    raise exception 'MIGRATION 074 FAILED: a CONFIRMED newer version did not take the older document''s deadlines out (%).', got;
  end if;

  -- *** AND THE ORDINARY CASE IS UNCHANGED, which is what says this narrowing broke nothing. ***
  -- A document read ONCE — every document on staging but one — gets the same answer it always did.
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'cert.pdf', co || '/cert.pdf', 'application/pdf') returning id into docOnce;
  insert into public.document_scans (document_id, company_id, kind, status, doc_date, doc_date_kind, is_current)
       values (docOnce, co, 'certificate', 'current', '2026-01-01', 'issued', true) returning id into scanOnce;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs) values
       (scanOnce, docOnce, co, 'Certificate expires', '2027-03-01', 'Valid until 1 March 2027.', false),
       (scanOnce, docOnce, co, 'Monthly visual inspection', '2026-10-31', 'Monthly visual inspections remain the customer''s responsibility.', true);
  select significant_date, significant_date_kind into got, gotk from public.document_index_v where document_id = docOnce;
  if got <> '2027-03-01' or gotk <> 'expiry' then
    raise exception 'MIGRATION 074 FAILED: a document read once changed its answer (got %, %).', got, gotk;
  end if;
  -- The recurring one is correctly NOT the expiry, as 049's rule says.
  if got = '2026-10-31' then
    raise exception 'MIGRATION 074 FAILED: a recurring deadline became the expiry.';
  end if;

  -- The view's own grants, read back rather than trusted.
  if has_table_privilege('anon', 'public.document_index_v', 'SELECT') then
    raise exception 'MIGRATION 074 FAILED: anon can read document_index_v.';
  end if;
  if not has_table_privilege('authenticated', 'public.document_index_v', 'SELECT') then
    raise exception 'MIGRATION 074 FAILED: authenticated cannot read document_index_v.';
  end if;
  -- Every column the app asks for by name is still there. A recreated view that quietly dropped one
  -- would be a runtime 400 on the Documents page, which `tsc` cannot see into (§3.6).
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'document_index_v'
     and column_name in ('document_id','company_id','title','file_name','kind','agencies','subjects',
       'issuer','site_name','entity_id','folder_name','folder_id','doc_date','doc_date_kind',
       'significant_date','significant_date_kind','scanned_at','uploaded_at','latest_confirmed_at',
       'scan_status','document_status','could_not_read_reason','summary','version_of',
       'version_confirmed','scan_id','open_gap_count','correction_count','display_status');
  if n <> 29 then
    raise exception 'MIGRATION 074 FAILED: document_index_v is missing a column the app reads (found % of 29).', n;
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 074 VERIFIED: document_index_v reads the CURRENT reading''s deadlines only — a replaced reading''s expiry is no longer the document''s date and no longer makes it "expired"; the current reading''s own expiry is used; a confirmed newer version takes the older document''s deadlines out and an unconfirmed one does not; a document read once gives the same answer as before; all 29 columns are present; anon cannot read it.';
end $$;

commit;
