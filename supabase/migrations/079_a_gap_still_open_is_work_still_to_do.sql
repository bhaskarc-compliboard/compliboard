-- ===========================================================================
-- 079 — A GAP STILL OPEN IS WORK STILL TO DO
--
-- Fix list **D5** (`docs/FIX-LIST-FAILURES.md`), root R3, Job E3. **The owner's
-- decision of 10 October 2026, answering §5 question 2: "yes to all."**
--
-- **WHY: "Current" printed over a gap nobody closed.**
--
-- `document_index_v.display_status` took `needs_work` from the current reading's
-- own status and from nothing else (`when s.status = 'gaps_found'`). So a
-- document read twice — the first reading finding a gap, the second finding
-- none — showed **"Current"**, and the batch email listed it under *"On file and
-- nothing to do"* (`lib/documentBatch.ts`). The gap row was still there, still
-- `open`, still shown in the drawer, and still a thing the person had to do.
--
-- `open_gap_count` has been on this view since 049 and counts every open gap on
-- the document, from any reading. Only `display_status` ignored it. One branch.
--
-- **THE OWNER'S REASON, recorded with the decision (`DECISIONS.md` §189):** the
-- gap is still open, so the person still has work. A second reading finding
-- nothing is not somebody closing the first reading's finding — only a person
-- does that, and until they do, saying "nothing to do" is a statement about
-- their compliance that is not true.
--
-- **WHERE THE BRANCH SITS, AND WHY.**
--   · AFTER `expired` and `expiring`. An expiry is the more urgent fact and a
--     date nobody can argue with: a permit that has run out still says so.
--   · BEFORE every "nothing to do" branch — `current`, `recorded`, `on_file` —
--     which are the ones that were making the false statement.
--   · `gaps_found` is left exactly where it was, so **no document that says
--     "Needs work" today stops saying it.** This change can only ever add the
--     label, never remove it.
--
-- **WHAT IT DOES NOT CHANGE.** Not one other column. The view is recreated
-- because a view cannot be patched, and the body below is 076's, character for
-- character, with the one branch inserted — built by copying 076's own text
-- rather than retyping it (`CLAUDE.md` §9a: copy names from the artifact).
--
-- No grant line is needed beyond the ones at the bottom, which are 076's own:
-- a recreated view loses its grants, so they are restated, and `anon` is revoked
-- first (§3.6 — not granting is not denying).
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
    -- *** NEW (079, fix list D5): A GAP STILL OPEN IS WORK STILL TO DO, whichever reading raised it.
    -- `open_gap_count` above already counts every open gap on the document, from any reading. Only
    -- `display_status` ignored them, so a re-read that found none showed "Current" over a gap a
    -- person had never closed — and the batch email listed the document under "On file and nothing
    -- to do" (`lib/documentBatch.ts`). The owner's answer, 10 October 2026.
    --
    -- WHERE IT SITS, AND WHY. After `expired` and `expiring`: an expiry is the more urgent fact and
    -- a date nobody can argue with, so a permit that has run out still says so. Before every
    -- "nothing to do" branch — `current`, `recorded`, `on_file` — which are the ones that were
    -- making the false statement. `gaps_found` above is untouched, so no document that says
    -- "Needs work" today stops saying it.
    when coalesce(g.open_gaps, 0) > 0 then 'needs_work'
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
  'reading, failed or not (044, a conclusion beats an absence), EXCEPT that a gap still open from '
  'any reading shows needs_work (079, fix list D5, the owner 10 Oct 2026) — the gap is still open, '
  'so the person still has work. A correction the person made outranks both, field by field, newest '
  'first. `scan_id` is the CURRENT scan, because the drawer watches it to know a re-read has landed; '
  '`readable_scan_id` is where the identity came from, and `identity_from_an_earlier_reading` says '
  'when those differ. security_invoker: only rows the caller could select.';

revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;

-- ===========================================================================
-- VERIFY — §3.7: the rule is TRIED, not described. A document read twice, the
-- first reading finding a gap and the second finding none.
-- ===========================================================================
do $$
declare co uuid; doc uuid; s1 uuid; s2 uuid; st text; n int;
begin
  insert into public.companies (name) values ('079 probe') returning id into co;
  -- `status = 'read'` on the DOCUMENT, as `saveScan` sets it. Without it the first branch of the
  -- CASE — 'uploaded' or 'reading' means not_yet_read — fires before anything else and the check
  -- proves nothing. The verify block caught exactly that on its first run.
  insert into public.documents (company_id, name, file_url, file_type, status)
       values (co, 'probe.pdf', co || '/probe.pdf', 'application/pdf', 'read') returning id into doc;

  -- READING 1: gaps found, and one gap row left OPEN.
  insert into public.document_scans (document_id, company_id, status, kind, is_current, scanned_at)
       values (doc, co, 'gaps_found', 'policy', false, now() - interval '7 days') returning id into s1;
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, description, fix, status, basis)
       values (s1, doc, co, 1, 'No record of the annual review', 'The policy requires one.',
               'File the 2026 review.', 'open', 'read');

  -- READING 2: the same document, read again, NO gaps found. Current.
  insert into public.document_scans (document_id, company_id, status, kind, is_current, scanned_at)
       values (doc, co, 'no_gaps_found', 'policy', true, now()) returning id into s2;

  select display_status, open_gap_count into st, n
    from public.document_index_v where document_id = doc;
  if n <> 1 then
    raise exception 'MIGRATION 079 FAILED: the probe does not have the 1 open gap it needs (% found), so the check proves nothing.', n;
  end if;
  if st <> 'needs_work' then
    raise exception 'MIGRATION 079 FAILED: a document with an open gap shows "%" instead of needs_work.', st;
  end if;

  -- AND THE OTHER DIRECTION: close the gap, and it stops saying so. A branch that can only ever
  -- say "needs work" would pass the check above and be no better than a hardcoded label.
  update public.document_gaps set status = 'closed' where document_id = doc;
  select display_status into st from public.document_index_v where document_id = doc;
  if st = 'needs_work' then
    raise exception 'MIGRATION 079 FAILED: the document still says needs_work with no open gap left.';
  end if;

  -- AND AN EXPIRY STILL OUTRANKS IT: the more urgent fact, and a date nobody can argue with.
  update public.document_gaps set status = 'open' where document_id = doc;
  update public.document_scans set kind = 'permit' where document_id = doc;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs)
       values (s2, doc, co, 'Permit expires', current_date - 10, false);
  select display_status into st from public.document_index_v where document_id = doc;
  if st <> 'expired' then
    raise exception 'MIGRATION 079 FAILED: an expired permit with an open gap shows "%" instead of expired.', st;
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 079 VERIFIED: a document whose earlier reading left a gap open shows needs_work even when the latest reading found none; closing the gap stops it; and an expired permit still says expired.';
end $$;

commit;
