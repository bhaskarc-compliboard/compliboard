-- 093 — NEEDS WORK ONLY ON A GAP READ FROM THE PAGE, AND THE REST BECOME NOTES.
--
-- The owner's decision 48 of 4 November 2026 (`docs/GAPS-PLAN.md` §3): a document's status turns
-- "Needs work" only on a gap READ FROM THE PAGE. A document whose gaps are all inferred — worked
-- out by the reading rather than quoted from the document — keeps the state it would otherwise
-- have, Current or Expiring or Recorded, with "n notes" beside it; the guesses are still there,
-- in the reader's own words, and they no longer turn a clean record red.
--
-- *** WHY THIS IS IN THE VIEW AND NOT IN CODE. *** The brief said "a rule in CODE, where
-- gaps_found is decided", and `gaps_found` is decided in two places, only one of which is code.
-- The MODEL decides the scan's word; `lib/documentScan.ts:400` holds it against `STATUSES` and
-- writes it through, and nothing computes it. SQL decides the CUSTOMER'S word, here, in the arm
-- 049 wrote as `when s.status = 'gaps_found' then 'needs_work'`. And decision 48's second half —
-- "otherwise the status the document would otherwise have" — is something only this CASE can
-- compute: it is the six arms underneath. In code the rule would have to invent a substitute
-- word and store it over the reading's own; `document_scans.status` stays the reading's record.
--
-- It also keeps the golden set measuring the MODEL. `scripts/run-golden-docs.js:810` judges the
-- object `runDocumentScan` returned, before `saveScan`, so a rule here cannot reach it. Put in
-- `normaliseScan`, a re-run where the model happened to hedge every gap would have FAILED golden
-- case 01 on our own rule rather than on its reading.
--
-- *** WHAT IT MOVES, MEASURED ON STAGING BEFORE IT WAS WRITTEN. *** 18 current scans carry
-- `status = 'gaps_found'`; 17 of them have at least one gap with `basis = 'read'`. ONE row moves:
-- Cascade's "Spill Response Procedure — Caustic Soda", 6 inferred gaps and 0 read, which stops
-- saying Needs work and says On file with 6 notes. On the Clackamas company nothing moves at all
-- — every gaps_found document there has a read gap — and that is the honest result: the rule is
-- here to stop a FUTURE false red, not to repaint today's list.
--
-- AND THE SECOND HALF OF THE DECISION IS A COUNT THE LIST CAN SHOW: `inferred_gap_count`,
-- appended as the last column because `calendar_v` depends on this view.
--
-- `document_gaps.basis` is unchanged and so is every row in it. Nothing is backfilled; nothing
-- is dropped. The one risk this migration carries is the one `create or replace view` carries:
-- the verify block at the bottom reads the column list, the two counts and three display
-- statuses back out of the live view, because a view that compiles is not a view that is right.

begin;

create or replace view public.document_index_v
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
    -- *** NEEDS WORK ONLY ON A GAP READ FROM THE PAGE — decision 48, 4 November 2026. ***
    -- There is no `else` arm for a gaps_found scan whose gaps are all inferred: it FALLS
    -- THROUGH to the arms below, which are literally "the status this document would
    -- otherwise have". That is why the rule is here and not in `lib/documentScan.ts` —
    -- code would have to invent a substitute word and store it over the reading's own.
    when s.status = 'gaps_found' and coalesce(g.read_gaps, 0) > 0 then 'needs_work'
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
  end                               as display_status,
  -- APPENDED LAST, AND THAT IS A CONSTRAINT, NOT A STYLE. `calendar_v` (073) depends on this
  -- view, so `create or replace` refuses a renamed, reordered or removed column while that
  -- view stands. display_status was column 29 of 29 on staging, read back before writing
  -- this; the new one lands at 30 and the replace is legal.
  coalesce(g.inferred_gaps, 0)      as inferred_gap_count

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
  -- OPEN GAPS, SPLIT BY WHERE THEY CAME FROM — decision 48. `read` is a gap whose words are
  -- in the document; `inferred` is one the reading worked out (prompts/document-scan.ts:259).
  -- `document_gaps_basis_check` allows only those two, so the three counts always agree.
  -- Dismissed and superseded gaps are out of all three: a gap a person has answered is not
  -- a reason to keep the row red, which is the same failure in the other direction.
  select count(*)::int                                    as open_gaps,
         count(*) filter (where dg.basis = 'read')::int     as read_gaps,
         count(*) filter (where dg.basis = 'inferred')::int as inferred_gaps
    from public.document_gaps dg
   where dg.document_id = d.id and dg.status = 'open'
) g on true;

comment on view public.document_index_v is
  'One row per document with the columns the Documents page groups and sorts by. A correction '
  'the person made outranks the scan, field by field, newest first. significant_date and its '
  'kind are COMPUTED HERE from the kind, the deadlines and the document date — never stored. '
  'display_status says needs_work only when an open gap was READ from the page (decision 48); '
  'inferred_gap_count is how many open gaps the reading worked out rather than quoted, which is '
  'what the list shows as "n notes". security_invoker: only rows the caller could select.';

-- §3.6: REVOKE then GRANT, every time, even when a replace keeps what was there. A grant list
-- describes what you added, not what the role holds.
revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;

-- ===========================================================================
-- THE PROBE. A view that compiles is not a view that is right, and the whole
-- point of this migration is one CASE arm, so the arm is walked: a gap read
-- from the page, a gap only inferred, both, neither, and a dismissed one.
-- ===========================================================================
do $$
declare
  co uuid; doc uuid; sc uuid; got text; n int; m int;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 093: no company on this database, probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-093-probe.pdf', 'probe/093', 'application/pdf', 1, 'upload', 'read')
    returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, is_current)
    values (doc, co, 'program', 'gaps_found', true) returning id into sc;

  -- 1. gaps_found and NO gap rows at all: nothing was read, so it is not needs_work. A program
  --    falls through to the last arm.
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'on_file' then
    raise exception 'MIGRATION 093 FAILED: gaps_found with no gap rows reads %, wanted on_file.', got;
  end if;

  -- 2. one INFERRED gap: still not needs_work, and it is one note.
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, basis, status)
    values (sc, doc, co, 1, 'probe inferred', 'inferred', 'open');
  select display_status, inferred_gap_count, open_gap_count into got, n, m
    from public.document_index_v where document_id = doc;
  if got <> 'on_file' then
    raise exception 'MIGRATION 093 FAILED: a gap the reading worked out reads %, wanted on_file.', got;
  end if;
  if n <> 1 or m <> 1 then
    raise exception 'MIGRATION 093 FAILED: inferred_gap_count % and open_gap_count % with one inferred gap, wanted 1 and 1.', n, m;
  end if;

  -- 3. a READ gap beside it: needs_work, and the note count does not include it.
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, basis, status)
    values (sc, doc, co, 2, 'probe read', 'read', 'open');
  select display_status, inferred_gap_count, open_gap_count into got, n, m
    from public.document_index_v where document_id = doc;
  if got <> 'needs_work' then
    raise exception 'MIGRATION 093 FAILED: a gap read from the page reads %, wanted needs_work.', got;
  end if;
  if n <> 1 or m <> 2 then
    raise exception 'MIGRATION 093 FAILED: counts are % notes of % open, wanted 1 of 2.', n, m;
  end if;

  -- 4. the read gap DISMISSED: a gap a person has answered stops holding the row red.
  update public.document_gaps set status = 'dismissed', dismissed_reason = 'probe'
   where scan_id = sc and basis = 'read';
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'on_file' then
    raise exception 'MIGRATION 093 FAILED: a dismissed read gap still reads %, wanted on_file.', got;
  end if;

  -- 5. AND THE DIRECTION THAT MATTERS MOST: it can still SEE a presence. §9a — a check that
  --    cannot see anything looks exactly like a check that found nothing.
  update public.document_gaps set status = 'open' where scan_id = sc and basis = 'read';
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'needs_work' then
    raise exception 'MIGRATION 093 FAILED: the read gap reopened and the row reads %, wanted needs_work.', got;
  end if;

  -- 6. decision 60's own words: a RECORD with only inferred gaps falls to Recorded, not Current.
  update public.document_gaps set status = 'dismissed' where scan_id = sc and basis = 'read';
  update public.document_scans set kind = 'record' where id = sc;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'recorded' then
    raise exception 'MIGRATION 093 FAILED: a record with only inferred gaps reads %, wanted recorded.', got;
  end if;

  -- 7. and a permit's own arithmetic still outranks all of it (048). The expiry has to come
  --    from a DEADLINE whose title says expiry: `doc_date_kind` has only five words and
  --    'expiry' is not one of them (lib/documentScan.ts:197), which is 048's whole point —
  --    only a date we actually believe is an expiry may expire.
  update public.document_scans set kind = 'permit' where id = sc;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs)
    values (sc, doc, co, 'Permit expiry', current_date - 1, false);
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'expired' then
    raise exception 'MIGRATION 093 FAILED: an expired permit reads %, wanted expired.', got;
  end if;

  delete from public.documents where id = doc;
  raise notice 'MIGRATION 093: needs_work needs a gap read from the page, and the notes are counted apart.';
end $$;

-- The column list, read back rather than assumed: `calendar_v` depends on this view, so the one
-- thing that could have gone wrong silently is a column landing in the wrong place.
do $$
declare
  pos int;
begin
  select ordinal_position into pos from information_schema.columns
   where table_schema = 'public' and table_name = 'document_index_v'
     and column_name = 'inferred_gap_count';
  if pos is null then
    raise exception 'MIGRATION 093 FAILED: document_index_v has no inferred_gap_count column.';
  end if;
  if pos <> (select max(ordinal_position) from information_schema.columns
              where table_schema = 'public' and table_name = 'document_index_v') then
    raise exception 'MIGRATION 093 FAILED: inferred_gap_count is at % and is not the last column.', pos;
  end if;
  if not exists (select 1 from pg_class c where c.relname = 'document_index_v'
                   and c.reloptions @> array['security_invoker=true']) then
    raise exception 'MIGRATION 093 FAILED: document_index_v lost security_invoker.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'document_index_v' and grantee = 'anon') then
    raise exception 'MIGRATION 093 FAILED: anon holds a grant on document_index_v.';
  end if;
  -- And calendar_v, which depends on this view, still answers.
  perform 1 from public.calendar_v limit 1;
  raise notice 'MIGRATION 093: inferred_gap_count is the last column, the view runs as its caller, and calendar_v still reads.';
end $$;

commit;
