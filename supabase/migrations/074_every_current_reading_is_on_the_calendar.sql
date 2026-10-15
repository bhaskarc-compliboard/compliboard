-- ===========================================================================
-- 074 — EVERY CURRENT READING IS ON THE CALENDAR
-- ===========================================================================
-- WHY.
--
-- Migration 073 built the table and `lib/calendarDates.ts` built the one writer, and from step 6 a
-- document scan files its dates as it finds them. **Neither reaches backwards.** A customer who
-- dropped a folder of permits into Documents in September has 37 dates sitting in
-- `document_deadlines` on staging — and would open the calendar in November and see nothing. The
-- product's promise is to be a guard; an empty calendar over a full filing cabinet is the
-- omniscient-status-tracker anti-pattern with the sign flipped, and it is worse, because the person
-- has already done the work of uploading.
--
-- So this migration files what is already known, once, with the same rules the live writer uses.
--
-- WHICH ROWS. A `document_deadlines` row whose scan is the document's CURRENT one
-- (`document_scans.is_current`) and whose `calendar_event_id` is null. Not every deadline ever
-- written: those rows are **per scan** (map B2, `lib/documentScan.ts:893–898`), so a document read
-- three times holds three generations of the same dates, and filing all of them would put three
-- copies of one obligation on the calendar. The current reading is the one the product shows
-- everywhere else — `document_index_v` joins `is_current`, and so does the report drawer — so it is
-- the one the calendar inherits.
--
-- WHAT EACH ROW BECOMES. `source 'document'`, `status 'proposed'` — a machine read it, so a person
-- confirms it (decision 8: an unconfirmed date still shows and is still emailed) — the document, the
-- deadline, the title, `due_on`, `recurs`, `source_line`, and **`period` NULL**, because the scan
-- says only WHETHER a date repeats and never how often (decision 23). `entity_id` is left null on
-- purpose: decision 24 reads a document date's site LIVE from the document through `calendar_v`,
-- never copied, so a corrected site in Documents reaches the calendar with no code and no backfill.
--
-- WHAT IT REFUSES TO INVENT. A deadline with no `due_on` and `recurs` false cannot be a calendar row:
-- 073's `calendar_events_date_or_recurs` refuses it, which is migration 060's rule, and the honest
-- answer is to leave it out rather than give it a day nobody set. Those are **counted and asserted**,
-- not silently dropped. On staging today there are **zero** of them, which is exactly why §0 plants
-- one: a skip-and-count branch tested against no rows is a branch nobody has run.
--
-- ON CONFLICT, AGAINST 073'S OWN KEY. The target is the partial unique index
-- `idx_calendar_events_company_document_title_due` — `(company_id, document_id, lower(title),
-- coalesce(due_date, '0001-01-01'::date)) where source = 'document'`, read from `pg_indexes`, not
-- from the prior migration file. DO NOTHING, and then a second statement stamps any deadline whose
-- date was ALREADY on the calendar with that existing row's id, so the drawer shows a line for every
-- current deadline rather than only for the ones this migration happened to insert.
--
-- IT IS ONE FUNCTION, CALLED TWICE, THEN DROPPED. The statements exist once
-- (`public.file_current_deadlines_074`), so the real run and the idempotence proof cannot drift from
-- each other — two hand-copied statements would be two things to keep in step. The function is
-- created and dropped inside this transaction, so it never exists outside it; §4 asserts it is gone,
-- because `HANDOFF-CODE.md` §7 records that `anon` and `authenticated` may execute any new function
-- in `public` by default, and a helper left behind is that defect with a new name.
--
-- STAGING'S FIGURES, READ BEFORE THIS FILE WAS WRITTEN (15 October 2026):
--   37 deadlines in all · 37 on a current scan · 37 eligible · 37 fileable
--   0 undated one-offs to skip · 37 distinct keys · calendar_events 0 rows
-- So staging should end with 37 calendar rows and 37 stamps. **Production's figures are UNREAD** and
-- will be read at step 14's preflight — this file asserts relationships, never a number it was told.
-- ===========================================================================

begin;

-- ===========================================================================
-- 0. THE WITNESSES — three deadlines whose outcomes are all three branches
-- ===========================================================================
-- A probe company with one document, one CURRENT scan, and three deadlines: dated, undated and
-- recurring, undated and one-off. Planted BEFORE the filing runs, so the real statement covers them
-- and §3 can read its decisions off rows it knows the answers for. §3 deletes the company.
--
-- *** THE THIRD WITNESS IS THE REASON THIS SECTION EXISTS. *** Staging holds no undated one-off, so
-- the skip-and-count branch would otherwise pass by having nothing to skip — `HOW-WE-BUILD.md` §3,
-- a check that cannot see a presence cannot report an absence.
do $$
declare co uuid; doc uuid; scn uuid;
begin
  insert into public.companies (name) values ('Migration 074 witness') returning id into co;
  insert into public.documents (company_id, name, file_url, file_type, status)
       values (co, 'probe-074-permit.pdf', 'probe/074', 'application/pdf', 'read') returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, is_current, title)
       values (doc, co, 'permit', 'current', true, '074 probe permit') returning id into scn;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs, source_line)
       values (scn, doc, co, '074 dated', '2027-05-01', false, 'Condition 4.1'),
              (scn, doc, co, '074 recurring no day', null, true, 'Condition 4.2, annual fee'),
              (scn, doc, co, '074 undated one-off', null, false, 'Condition 4.3');

  -- AND ONE THAT MUST BE LEFT ALONE: a deadline on a SUPERSEDED scan of the same document. Filing it
  -- would put a second generation of the same obligation on the calendar, which is the whole reason
  -- `is_current` is in the join.
  declare old_scn uuid;
  begin
    insert into public.document_scans (document_id, company_id, kind, status, is_current, title)
         values (doc, co, 'permit', 'current', false, '074 probe permit, earlier reading') returning id into old_scn;
    insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs)
         values (old_scn, doc, co, '074 from an older reading', '2026-12-01', false);
  end;
end $$;

-- ===========================================================================
-- 1. THE FILING, AS ONE FUNCTION SO IT CANNOT DRIFT FROM ITS OWN PROOF
-- ===========================================================================
-- Returns what it did, so the caller can assert rather than hope. `volatile` by default, which is
-- correct: it writes.
create or replace function public.file_current_deadlines_074()
  returns table (filed bigint, stamped_existing bigint)
  language plpgsql
as $fn$
declare ins bigint; stm bigint;
begin
  -- ONE STATEMENT: pick, insert, stamp. `distinct on` means the statement never offers two rows with
  -- the same key, so `ON CONFLICT` only ever has to deal with rows already in the table — a scan that
  -- read the same title and day twice cannot race itself. The newest deadline row wins, because that
  -- is the one the report drawer shows.
  with picked as (
    select distinct on (dd.company_id, dd.document_id, lower(dd.title), coalesce(dd.due_on, '0001-01-01'::date))
           dd.id as deadline_id, dd.company_id, dd.document_id, dd.title,
           dd.due_on, dd.recurs, dd.source_line
      from public.document_deadlines dd
      join public.document_scans ds on ds.id = dd.scan_id and ds.is_current
     where dd.calendar_event_id is null
       -- 073's `calendar_events_date_or_recurs`, stated here so the undated one-offs never reach
       -- the insert and the migration does not fail on a row it was always going to refuse.
       and (dd.due_on is not null or dd.recurs is true)
     order by dd.company_id, dd.document_id, lower(dd.title), coalesce(dd.due_on, '0001-01-01'::date),
              dd.created_at desc, dd.id
  ), filed_rows as (
    insert into public.calendar_events
      (company_id, source, status, document_id, deadline_id, title, due_date, recurs, source_line, period)
    select p.company_id, 'document', 'proposed', p.document_id, p.deadline_id, p.title,
           p.due_on, p.recurs, p.source_line, null
      from picked p
    -- 073's partial unique index, read from `pg_indexes` on 15 October rather than from 073's text.
    -- *** EACH EXPRESSION IN ITS OWN PARENTHESES, AS THE GRAMMAR WRITES IT. ***
    -- `conflict_target` is `( { index_column_name | ( index_expression ) } [, ...] ) [ WHERE
    -- index_predicate ]`. Postgres accepts a bare function call here in practice, but the extra
    -- parentheses are what the documented grammar asks for and the parser discards them, so
    -- inference still matches the index's own expression tree. This is the ONE piece of this file
    -- that could not be tested before it ran: the Supabase CLI connects read-only, so even
    -- `EXPLAIN` of this statement answers 42501 on `document_deadlines`.
    on conflict (company_id, document_id, (lower(title)), (coalesce(due_date, '0001-01-01'::date)))
      where source = 'document'
    do nothing
    returning id, deadline_id
  )
  update public.document_deadlines dd
     set calendar_event_id = f.id
    from filed_rows f
   where dd.id = f.deadline_id;
  get diagnostics ins = row_count;

  -- AND THE ONES THE CONFLICT SKIPPED. A current deadline whose date is already on the calendar —
  -- because an earlier run filed it, or because the live writer did — gets that row's id, so every
  -- current deadline can show its line. Without this the drawer would say nothing for a date that
  -- IS on the calendar, which is the worse of the two wrong answers.
  update public.document_deadlines dd
     set calendar_event_id = ce.id
    from public.calendar_events ce
   where dd.calendar_event_id is null
     and ce.source = 'document'
     and ce.company_id = dd.company_id
     and ce.document_id = dd.document_id
     and lower(ce.title) = lower(dd.title)
     and coalesce(ce.due_date, '0001-01-01'::date) = coalesce(dd.due_on, '0001-01-01'::date)
     and exists (select 1 from public.document_scans ds where ds.id = dd.scan_id and ds.is_current);
  get diagnostics stm = row_count;

  return query select ins, stm;
end
$fn$;

-- Belt and braces while it exists: `HANDOFF-CODE.md` §7 — anon and authenticated may EXECUTE any new
-- function in public by default. It is dropped in §4 and never exists outside this transaction, and
-- this says so out loud rather than relying on that.
revoke all on function public.file_current_deadlines_074() from anon;
revoke all on function public.file_current_deadlines_074() from authenticated;

-- ===========================================================================
-- 2. THE REAL RUN
-- ===========================================================================
select * from public.file_current_deadlines_074();

-- ===========================================================================
-- 3. VERIFY — on the witnesses, then the idempotence, then the real rows
-- ===========================================================================
do $$
declare
  co uuid; doc uuid; n bigint; m bigint; r record; ev uuid; skipped bigint;
begin
  select id into co from public.companies where name = 'Migration 074 witness';
  if co is null then
    raise exception 'MIGRATION 074 FAILED: §0 left no witness company, so nothing below was tested.';
  end if;
  select id into doc from public.documents where company_id = co;

  -- ---- 1. THE COUNT FIRST. Four deadlines were planted; three on the current scan. ----
  select count(*) into n from public.document_deadlines where company_id = co;
  if n <> 4 then
    raise exception 'MIGRATION 074 FAILED: expected 4 witness deadlines to test against, found %.', n;
  end if;

  -- ---- 2. THE DATED ONE AND THE UNDATED RECURRING ONE ARE BOTH FILED AND BOTH STAMPED. ----
  select count(*) into n from public.calendar_events where company_id = co;
  if n <> 2 then
    raise exception 'MIGRATION 074 FAILED: expected 2 calendar rows for the witnesses, found %.', n;
  end if;

  -- *** THE COLUMNS ARE NAMED, NOT `select *`. ***
  -- Both tables carry `id`, `company_id`, `title`, `source_line` and `created_at`, so a `select *`
  -- over the join would leave `r.id` and `r.title` resolved by column ORDER — right today and
  -- silently wrong the first time either table gains a column. The join itself is the assertion
  -- that the stamp exists: with no stamp there is no row to read.
  select ce.id, ce.source, ce.status, ce.due_date, ce.period, ce.source_line,
         ce.entity_id, ce.document_id, ce.deadline_id
    into r
    from public.calendar_events ce
    join public.document_deadlines dd on dd.calendar_event_id = ce.id
   where ce.company_id = co and dd.title = '074 dated';
  if r.id is null then raise exception 'MIGRATION 074 FAILED: the dated witness was not filed and stamped.'; end if;
  if r.source <> 'document' then raise exception 'MIGRATION 074 FAILED: source is %, not document.', r.source; end if;
  if r.status <> 'proposed' then raise exception 'MIGRATION 074 FAILED: status is %, not proposed — a machine read it.', r.status; end if;
  if r.due_date <> '2027-05-01'::date then raise exception 'MIGRATION 074 FAILED: due_date is %.', r.due_date; end if;
  if r.period is not null then raise exception 'MIGRATION 074 FAILED: period is %, and the scan never says how often (decision 23).', r.period; end if;
  if r.source_line <> 'Condition 4.1' then raise exception 'MIGRATION 074 FAILED: source_line is %.', coalesce(r.source_line, '<null>'); end if;
  if r.entity_id is not null then raise exception 'MIGRATION 074 FAILED: entity_id was copied; decision 24 reads the site live through the view.'; end if;
  if r.document_id <> doc then raise exception 'MIGRATION 074 FAILED: the row does not name its document.'; end if;
  if r.deadline_id is null then raise exception 'MIGRATION 074 FAILED: the row does not name the deadline it was read from.'; end if;

  -- The undated RECURRING one is filed with a null day, which is 060's rule reaching the calendar.
  select ce.id into ev from public.calendar_events ce
    join public.document_deadlines dd on dd.calendar_event_id = ce.id
   where ce.company_id = co and dd.title = '074 recurring no day';
  if ev is null then
    raise exception 'MIGRATION 074 FAILED: the undated RECURRING witness was not filed — 060''s rule did not reach the calendar.';
  end if;
  if (select due_date from public.calendar_events where id = ev) is not null then
    raise exception 'MIGRATION 074 FAILED: the recurring witness was given a day nobody set.';
  end if;
  if (select recurs from public.calendar_events where id = ev) is not true then
    raise exception 'MIGRATION 074 FAILED: the recurring witness lost its recurrence.';
  end if;

  -- ---- 3. THE UNDATED ONE-OFF IS SKIPPED, LEFT UNSTAMPED, AND COUNTABLE. ----
  select count(*) into n from public.document_deadlines
   where company_id = co and title = '074 undated one-off' and calendar_event_id is null;
  if n <> 1 then
    raise exception 'MIGRATION 074 FAILED: the undated one-off was not left alone (% unstamped).', n;
  end if;
  select count(*) into n from public.calendar_events where company_id = co and title = '074 undated one-off';
  if n <> 0 then
    raise exception 'MIGRATION 074 FAILED: an undated one-off reached the calendar — a day nobody set.';
  end if;

  -- ---- 4. A DEADLINE ON A SUPERSEDED SCAN IS NOT FILED. ----
  select count(*) into n from public.document_deadlines
   where company_id = co and title = '074 from an older reading' and calendar_event_id is null;
  if n <> 1 then
    raise exception 'MIGRATION 074 FAILED: an older reading''s deadline was filed; is_current is in the join for this.';
  end if;
  select count(*) into n from public.calendar_events where company_id = co and title = '074 from an older reading';
  if n <> 0 then
    raise exception 'MIGRATION 074 FAILED: a superseded reading put a second generation of a date on the calendar.';
  end if;

  -- ---- 5. A SECOND RUN OF THE SAME FUNCTION DOES NOTHING. ----
  -- The same function, not a copy of its statements, so this cannot pass while the real run differs.
  select filed, stamped_existing into n, m from public.file_current_deadlines_074();
  if n <> 0 or m <> 0 then
    raise exception 'MIGRATION 074 FAILED: a second run filed % and stamped %; it must do nothing.', n, m;
  end if;
  select count(*) into n from public.calendar_events where company_id = co;
  if n <> 2 then
    raise exception 'MIGRATION 074 FAILED: the second run changed the witness count to %.', n;
  end if;

  -- ---- 6. AND THE CATCH-UP STAMP WORKS, WHICH THE RUNS ABOVE NEVER EXERCISED. ----
  -- Unstamp the dated witness, leaving its calendar row in place: the next run must find the row and
  -- stamp the deadline with it rather than insert a duplicate. This is the `ON CONFLICT DO NOTHING`
  -- path, and without this block nothing would ever have taken it.
  update public.document_deadlines set calendar_event_id = null
   where company_id = co and title = '074 dated';
  select filed, stamped_existing into n, m from public.file_current_deadlines_074();
  if n <> 0 then
    raise exception 'MIGRATION 074 FAILED: the catch-up run inserted % row(s); the date was already on the calendar.', n;
  end if;
  if m <> 1 then
    raise exception 'MIGRATION 074 FAILED: the catch-up run stamped % deadline(s), expected 1.', m;
  end if;
  select count(*) into n from public.calendar_events where company_id = co;
  if n <> 2 then
    raise exception 'MIGRATION 074 FAILED: the catch-up run changed the calendar count to %.', n;
  end if;

  delete from public.companies where id = co;

  -- ---- 7. THE REAL ROWS, AS A RELATIONSHIP AND NEVER AS A REMEMBERED NUMBER. ----
  -- Every current-scan deadline that COULD be filed now carries a stamp. The figures read before this
  -- file was written (37/37/0) are in the header as context; what is asserted is the property.
  select count(*) into n from public.document_deadlines dd
    join public.document_scans ds on ds.id = dd.scan_id and ds.is_current
   where dd.calendar_event_id is null and (dd.due_on is not null or dd.recurs is true);
  if n <> 0 then
    raise exception 'MIGRATION 074 FAILED: % fileable current deadline(s) are still unstamped.', n;
  end if;
  -- ...and every stamp points at a row that says what it came from.
  select count(*) into n from public.document_deadlines dd
    join public.calendar_events ce on ce.id = dd.calendar_event_id
   where ce.source <> 'document' or ce.document_id is distinct from dd.document_id;
  if n <> 0 then
    raise exception 'MIGRATION 074 FAILED: % stamp(s) point at a row that is not this document''s date.', n;
  end if;
  -- ...and the skipped ones are the undated one-offs and nothing else.
  select count(*) into skipped from public.document_deadlines dd
    join public.document_scans ds on ds.id = dd.scan_id and ds.is_current
   where dd.calendar_event_id is null;
  select count(*) into n from public.document_deadlines dd
    join public.document_scans ds on ds.id = dd.scan_id and ds.is_current
   where dd.calendar_event_id is null and dd.due_on is null and dd.recurs is not true;
  if skipped <> n then
    raise exception 'MIGRATION 074 FAILED: % current deadline(s) are unstamped but only % are undated one-offs.', skipped, n;
  end if;

  -- ...and 073's invariant still holds over everything filed: at most ONE live row per
  -- (company, document, lower(title)). The unique index guards the same date twice; this guards the
  -- thing no constraint can see.
  select count(*) into n from (
    select ce.company_id, ce.document_id, lower(ce.title) as t, count(*) as c
      from public.calendar_events ce
     where ce.source = 'document' and ce.replaced_by is null and ce.dismissed_by is null
     group by 1, 2, 3 having count(*) > 1) dupes;
  if n <> 0 then
    raise exception 'MIGRATION 074 FAILED: % (document, title) pair(s) have more than one LIVE calendar row.', n;
  end if;

  raise notice 'MIGRATION 074 VERIFIED: a dated deadline and an undated RECURRING one were filed as '
    'proposed document dates with a null period and no copied site; an undated one-off was skipped, '
    'left unstamped and counted; a superseded reading''s deadline was not filed; a second run of the '
    'same function filed and stamped nothing; unstamping a deadline whose row still exists took the '
    'catch-up path and stamped without inserting; every fileable current deadline now carries a '
    'stamp that points at its own document''s date; the only unstamped ones are undated one-offs; '
    'and no (document, title) pair has two live rows.';
end $$;

-- ===========================================================================
-- 4. THE HELPER GOES
-- ===========================================================================
drop function if exists public.file_current_deadlines_074();

do $$
declare n int;
begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'file_current_deadlines_074';
  if n <> 0 then
    raise exception 'MIGRATION 074 FAILED: the helper function is still in public; anon and authenticated may EXECUTE a new function by default (HANDOFF-CODE.md §7).';
  end if;
end $$;

commit;
