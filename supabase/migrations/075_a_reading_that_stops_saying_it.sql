-- ===========================================================================
-- 075 — A READING THAT STOPS SAYING IT
-- ===========================================================================
-- WHY.
--
-- Step 6 filed every date a reading finds. Step 6's paid walks then measured what that costs when
-- the reading is asked again: three Haiku readings of one fire-extinguisher certificate turned two
-- obligations into seven calendar rows, and three OPUS 5.5 readings of the same file turned three
-- obligations into NINE — `created 3, existing 0, replaced 0, revived 0`, three times out of three
-- (`DECISIONS.md` §187 and the owner's step 6 safety check, 15 October 2026). The drift is not a
-- cheap model's fault and a dearer model does not fix it: the production model also moved a DATE,
-- reading "schedule before November 2026" as 2026-11-01 once and 2026-10-31 twice.
--
-- The cause is not in `proposeDate`, which does exactly what §2.6 specifies and has 42 tests
-- proving every branch. It is that a document date's identity is its TITLE, the title is prose, and
-- `prompts/document-scan.ts` is never shown the dates already on file — it is shown the open gaps
-- with their ids so a new reading can say `same_as_gap_id` (`:104–108`), the labels in use, the
-- fact keys in use and the corrections made, but there is no list of dates and no
-- `same_as_deadline_id`. So the model cannot match its own earlier wording, because nobody tells it
-- what the earlier wording was.
--
-- Documents already solved this for FACTS, on 29 September, and wrote down the reasoning:
-- `lib/documentScan.ts:962–992` withdraws every pending proposal from a document's earlier readings
-- because *"only two different DOCUMENTS can disagree. A document does not disagree with itself;
-- its latest reading is what it says."* Gaps have the same protection under another name
-- (`document_gaps.not_seen_at`). Dates were the one of the three that kept every paraphrase.
--
-- The owner's decision (decision 29): the current reading wins. A reading of a document withdraws
-- every PROPOSED date from that document's earlier readings that this reading did not propose
-- again; a finished audit of an agency does the same for that agency's earlier runs. A person's
-- decision outranks a re-read — a confirmed date is never touched, and a date a person dismissed
-- stays dismissed and never comes back (rule b, step 5).
--
-- WHAT THIS MIGRATION DOES, AND WHY IT IS THIS SMALL.
--
-- A withdrawn row has to be told apart from a person-dismissed one IN THE DATA, because the two
-- behave differently: a withdrawn date comes BACK if a later reading proposes it again (the
-- `revived` outcome), and a dismissed one never does. Three shapes were considered:
--
--   · `status = 'dismissed'` with `dismissed_by` null, i.e. "dismissed by nobody". NO MIGRATION AT
--     ALL, and it was rejected on a fact read out of the catalog rather than on taste:
--     `calendar_events_dismissed_by_fkey` is `ON DELETE SET NULL`. Delete the person who dismissed
--     a date and their decision becomes an absence — the row turns into a withdrawn one and the
--     next reading quietly revives a date somebody removed on purpose. A rule that depends on a
--     nullable column staying non-null is a rule with an expiry date.
--   · A second boolean (`withdrawn`), which would make `status` and the boolean able to disagree —
--     two places to read, and a row can say both "proposed" and "withdrawn".
--   · A FOURTH STATUS WORD, which is what this is. One column answers "is this date current", the
--     CHECK enumerates every answer, and `confirmed_by`/`dismissed_by`/`withdrawn_at` stay what they
--     are: the record of WHO and WHEN, never the test for WHETHER.
--
-- So: the status CHECK gains one word, one nullable timestamp records when, and `calendar_v` stops
-- returning the rows. Nothing is backfilled — no row is withdrawn by this migration, because
-- deciding that a reading no longer says a date is the reading's job, not a migration's.
--
-- THE PARTIAL UNIQUE INDEX IS DELIBERATELY UNCHANGED, and that is what makes revival work rather
-- than duplication. `idx_calendar_events_company_document_title_due` covers every
-- `source = 'document'` row whatever its status, so a withdrawn row keeps its slot in the key: a
-- later reading proposing the identical title and day MEETS it and brings it back, instead of
-- inserting a second row beside it. §5 proves that by trying the insert.
--
-- WHAT `calendar_v` EXPOSES FOR A WITHDRAWN ROW: NOTHING. The row is not in the view, so no reader
-- of the view can forget to filter it — the calendar, the Dashboard (step 12) and the monthly email
-- (step 11) all inherit the rule rather than each restating it. The view keeps showing `dismissed`
-- and superseded rows, exactly as 073 built it: those are a person's decision and a date's history,
-- and the drawer is entitled to show both. A withdrawn row is neither — it is a sentence a reading
-- stopped saying — so it has nowhere to be shown and nothing to say. It stays fully readable in the
-- BASE table, which is what the report drawers embed (`app/api/documents/report/route.ts:66`) and
-- what `/api/account/export` copies, because it is still the customer's data and still the record of
-- what we once told them.
--
-- NO GRANTS ARE NEEDED: no table is created here, and `create or replace view` keeps the view's own.
-- §6 reads all eight rights for both roles anyway — `CLAUDE.md` §3.6, a grant list describes what
-- you added, not what the role holds.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. ONE MORE WORD IN THE STATUS CHECK.
--
-- 073 wrote `check (status in ('proposed', 'confirmed', 'dismissed'))` (073:287–289). Dropped and
-- re-added rather than altered, because a CHECK cannot be altered in place — and `drop ... if
-- exists` so this migration is safe to replay on a database where it already ran.
-- ---------------------------------------------------------------------------
alter table public.calendar_events drop constraint if exists calendar_events_status_is_known;
alter table public.calendar_events add constraint calendar_events_status_is_known
  check (status in ('proposed', 'confirmed', 'dismissed', 'withdrawn'));

-- ---------------------------------------------------------------------------
-- 2. WHEN A READING STOPPED SAYING IT.
--
-- Nullable, NO DEFAULT. A default of `now()` would stamp every row ever written with a withdrawal
-- date, which is the quiet way a column becomes a lie — the same reason `confirmed_at` and
-- `dismissed_at` have none (073:§1).
--
-- WHAT IT DELIBERATELY DOES NOT RECORD: which reading withdrew it. That would be a
-- `withdrawn_by_scan_id` and a `withdrawn_by_run_id`, two columns and a polymorphic pair, to answer
-- a question `withdrawn_at` already answers when read beside `document_scans.scanned_at` or
-- `audit_runs.finished_at`. Step 9 builds the screen where a person meets this; if it turns out to
-- need the link, that is a column then, with a reader to justify it (§9a: the acceptance condition
-- is a reader).
-- ---------------------------------------------------------------------------
alter table public.calendar_events add column if not exists withdrawn_at timestamptz;

comment on column public.calendar_events.status is
  'proposed | confirmed | dismissed | withdrawn. proposed: a machine read it and nobody has said '
  'yes yet — it still shows and is still emailed (decision 8). confirmed: a person said yes, or a '
  'person typed it. dismissed: a person removed it, with a reason, and it never comes back '
  '(rule b). withdrawn: the latest reading of its document, or the latest audit of its agency, no '
  'longer says it — nobody decided anything, so it comes BACK if a later reading says it again '
  '(decision 29, migration 075). calendar_v returns the first three and not the fourth.';

comment on column public.calendar_events.withdrawn_at is
  'When a later reading stopped saying this date. Set with status = withdrawn and cleared when the '
  'row is revived. NOT a person''s act — that is dismissed_by and dismissed_at. Migration 075.';

-- ---------------------------------------------------------------------------
-- 3. THE VIEW STOPS RETURNING THEM.
--
-- `create or replace view` can only APPEND columns, so the select list below is 073's own, column
-- for column and in the same order, with ONE line added at the end: the WHERE. Re-emitted in full
-- because that is what `create or replace` requires; `git diff 073 075` is the honest diff.
--
-- `e.status <> 'withdrawn'` and not `not (e.status = 'withdrawn')` or an `in` list: `status` is NOT
-- NULL with a default (073:§1), so there is no NULL for `<>` to drop a row on. If that column ever
-- becomes nullable this line silently starts hiding rows, which is why the CHECK above enumerates
-- every value and §5 below proves a fifth word is still refused.
-- ---------------------------------------------------------------------------
create or replace view public.calendar_v
with (security_invoker = true) as
select
  e.id,
  e.company_id,
  e.title,
  e.description,
  e.due_date,
  e.status,
  e.source,
  e.recurs,
  e.period,
  e.source_line,
  e.source_url,
  e.source_page,
  e.entity_id,
  e.document_id,
  e.handbook_id,
  e.audit_finding_id,
  e.deadline_id,
  e.added_by,
  e.confirmed_by,
  e.confirmed_at,
  e.dismissed_by,
  e.dismissed_at,
  e.dismissed_reason,
  e.replaced_by,
  e.created_at,
  s.site_id,
  ent.name as site_name,
  nd.next_due,
  (nd.next_due - current_date) as days_until,
  -- *** A REPEATING DATE HAS NOT "PASSED". *** Its occurrence has, and the next one is ahead:
  -- `next_due` says when. Only a ONE-OFF whose day is behind us has passed, and the product says
  -- "passed", never "overdue" and never "done" (decision 11).
  (not e.recurs and e.due_date is not null and e.due_date < current_date) as has_passed,
  case e.source
    when 'document' then d.title
    when 'handbook' then hb.name
    -- The agency and when the audit ran. `concat_ws` skips a null part rather than nulling the
    -- whole string; `nullif` turns "both parts missing" back into NULL instead of ''.
    when 'audit'    then nullif(concat_ws(' · ', ar.agency_label,
                                 to_char(coalesce(ar.finished_at, ar.created_at), 'DD Mon YYYY')), '')
    else null
  end as source_title
from public.calendar_events e
left join public.document_index_v d
       on d.document_id = e.document_id and d.company_id = e.company_id
left join public.handbooks hb
       on hb.id = e.handbook_id and hb.company_id = e.company_id
left join public.audit_findings af
       on af.id = e.audit_finding_id and af.company_id = e.company_id
left join public.audit_runs ar
       on ar.id = af.run_id and ar.company_id = e.company_id
-- The site: the document's current one for a document-sourced row, else the row's own.
left join lateral (
  select case when e.source = 'document' and d.document_id is not null
              then d.entity_id else e.entity_id end as site_id
) s on true
left join public.entities ent
       on ent.id = s.site_id and ent.company_id = e.company_id
-- How many months one step of the period is. NULL for "not known yet", which makes `next_due` NULL.
left join lateral (
  select case e.period
           when 'month'    then 1
           when 'quarter'  then 3
           when '6 months' then 6
           when 'year'     then 12
           when '2 years'  then 24
         end as step_months
) st on true
-- *** HOW MANY WHOLE STEPS FROM THE ANCHOR TO TODAY. ***
-- `age()` gives the elapsed interval; its year and month parts are the FLOOR of the months
-- elapsed, so `due_date + k steps` may still be one day short of today when the leftover days are
-- non-zero — which is why the next lateral checks and takes one more step. A future anchor gives a
-- negative age, `ceil` of a negative over a positive is <= 0, and `greatest(0, …)` makes k zero, so
-- the anchor itself is the answer. The WHERE makes this lateral produce no row when there is
-- nothing to compute, and the LEFT JOIN turns that into a null `k`.
left join lateral (
  select greatest(0, ceil(
           ( extract(year  from age(current_date, e.due_date)) * 12
           + extract(month from age(current_date, e.due_date)) )::numeric
           / st.step_months))::int as k
   where e.due_date is not null and st.step_months is not null
) kk on true
left join lateral (
  select case
    -- A one-off IS its date, passed or not.
    when not e.recurs then e.due_date
    -- Repeating with no day, or no period: there is no honest next date (decisions 12 and 23).
    when e.due_date is null or st.step_months is null then null
    when (e.due_date + (kk.k * st.step_months || ' months')::interval)::date >= current_date
      then (e.due_date + (kk.k * st.step_months || ' months')::interval)::date
    else   (e.due_date + ((kk.k + 1) * st.step_months || ' months')::interval)::date
  end as next_due
) nd on true
-- *** THE ONE LINE THIS MIGRATION ADDS (decision 29). ***
-- A withdrawn row is not a statement about this date any more, so the calendar's own feed does not
-- carry it. Dismissed and superseded rows ARE still carried, unchanged from 073: the first is a
-- person's decision and the second is history, and both have something to show.
where e.status <> 'withdrawn';

comment on view public.calendar_v is
  'Every calendar_events column plus the site read live from the document, next_due computed from '
  'the period and the anchor, days_until, has_passed and source_title. NOTHING DERIVED IS STORED — '
  'migration 049''s rule. security_invoker: it shows only the rows the caller could select. '
  'WITHDRAWN ROWS ARE NOT RETURNED (decision 29, migration 075); dismissed and superseded rows are. '
  'Migration 073.';

-- ===========================================================================
-- 4. VERIFY — AND EVERY CHECK HERE TRIES TO BREAK SOMETHING.
--
-- `CLAUDE.md` §3.7: a constraint nobody has tried to break is a comment. And §9a: before believing
-- an absence, prove the same check can see a presence — so every "the view hides it" test below is
-- paired with a row the view MUST show.
--
-- The probe company is created here and deleted at the end by id. `calendar_events.company_id` is
-- `ON DELETE CASCADE`, so deleting the company takes its rows with it; the ids are collected and
-- deleted explicitly anyway, so a future change to that FK cannot leave probe rows behind.
-- ===========================================================================
do $$
declare
  co       uuid;
  docu     uuid;
  r        record;
  n        int;
  ev_prop  uuid;
  ev_with  uuid;
  ev_dism  uuid;
  ev_conf  uuid;
  v        text;
  rel      text;
  cols     text[];
begin
  insert into public.companies (name) values ('075 probe company') returning id into co;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, '075 probe permit', co::text || '/075-probe.pdf', 'application/pdf')
    returning id into docu;

  -- ---- 1. 'withdrawn' IS NOW A LEGAL STATUS. Before this migration this insert raised 23514. ----
  insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source, status, withdrawn_at)
       values (co, docu, 'Permit expires', date '2027-03-01', false, 'document', 'withdrawn', now())
    returning id into ev_with;

  -- ---- 2. AND A FIFTH WORD IS STILL REFUSED. ----
  -- The whole value of a status-based rule is that the column cannot hold anything else. If this
  -- insert succeeds the CHECK above is decoration.
  begin
    insert into public.calendar_events (company_id, title, due_date, recurs, source, status)
         values (co, '075 probe bad status', date '2027-03-02', false, 'person', 'retired');
    raise exception 'MIGRATION 075 FAILED: status "retired" was accepted; the CHECK is not holding.';
  exception when check_violation then
    null;   -- 23514, which is the point
  end;

  -- ---- 3. THE PARTIAL UNIQUE INDEX STILL COVERS A WITHDRAWN ROW. ----
  -- This is what makes a withdrawal revivable rather than duplicable: the withdrawn row keeps its
  -- slot in (company, document, lower(title), day), so a later reading of the same date MEETS it.
  -- Mixed case on purpose — the index is on `lower(title)`.
  begin
    insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source, status)
         values (co, docu, 'PERMIT EXPIRES', date '2027-03-01', false, 'document', 'proposed');
    raise exception 'MIGRATION 075 FAILED: a second row for a WITHDRAWN date was accepted; '
                    'the index no longer covers it and a re-reading would duplicate instead of reviving.';
  exception when unique_violation then
    null;   -- 23505, which is the point
  end;

  -- ---- 4. THE VIEW HIDES THE WITHDRAWN ROW — AND CAN SEE THE OTHER THREE. ----
  -- Presence before absence (§9a). Four rows, one of each status, all for this company.
  insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source, status)
       values (co, docu, 'Annual fee', date '2027-04-01', false, 'document', 'proposed')
    returning id into ev_prop;
  insert into public.calendar_events (company_id, title, due_date, recurs, source, status, confirmed_at)
       values (co, '075 probe confirmed', date '2027-04-02', false, 'person', 'confirmed', now())
    returning id into ev_conf;
  insert into public.calendar_events (company_id, title, due_date, recurs, source, status, dismissed_at, dismissed_reason)
       values (co, '075 probe dismissed', date '2027-04-03', false, 'person', 'dismissed', now(), 'a person said no')
    returning id into ev_dism;

  select count(*) into n from public.calendar_events where company_id = co;
  if n <> 4 then
    raise exception 'MIGRATION 075 FAILED: the base table holds % probe rows, not 4 — the test below would prove nothing.', n;
  end if;

  select count(*) into n from public.calendar_v where company_id = co;
  if n <> 3 then
    raise exception 'MIGRATION 075 FAILED: calendar_v returns % of 4 probe rows, not 3.', n;
  end if;

  select count(*) into n from public.calendar_v where id = ev_with;
  if n <> 0 then
    raise exception 'MIGRATION 075 FAILED: calendar_v returned the withdrawn row.';
  end if;
  -- The three it MUST return, each by id, so "3 rows" cannot be three copies of one.
  foreach v in array array[ev_prop::text, ev_conf::text, ev_dism::text] loop
    select count(*) into n from public.calendar_v where id = v::uuid;
    if n <> 1 then
      raise exception 'MIGRATION 075 FAILED: calendar_v lost the row % (it returned % rows).', v, n;
    end if;
  end loop;

  -- A withdrawn row is still fully readable in the BASE table, which is what the report drawers
  -- embed and what the account export copies. Columns named, never `select *` over a join.
  select ce.status, ce.withdrawn_at, ce.title into r
    from public.calendar_events ce where ce.id = ev_with;
  if r.status <> 'withdrawn' or r.withdrawn_at is null then
    raise exception 'MIGRATION 075 FAILED: the withdrawn row reads back as status %, withdrawn_at %.',
      r.status, coalesce(r.withdrawn_at::text, '<null>');
  end if;

  -- ---- 5. THE VIEW'S COLUMN LIST DID NOT MOVE, AND withdrawn_at IS NOT IN IT. ----
  -- `create or replace view` can only append, so a change that reordered or dropped a column would
  -- have failed above — this proves the count rather than assuming the failure mode.
  select array_agg(column_name order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'calendar_v';
  if array_length(cols, 1) <> 31 then
    raise exception 'MIGRATION 075 FAILED: calendar_v has % columns, not the 31 migration 073 built.', array_length(cols, 1);
  end if;
  -- DELIBERATELY ABSENT: the view never returns a withdrawn row, so a column saying when it was
  -- withdrawn would be a column that is null on every row the view has.
  if 'withdrawn_at' = any(cols) then
    raise exception 'MIGRATION 075 FAILED: calendar_v exposes withdrawn_at, which is always null in it.';
  end if;

  -- ---- 6. withdrawn_at IS NULLABLE AND HAS NO DEFAULT. ----
  select c.is_nullable, c.column_default, c.data_type into r
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'calendar_events' and c.column_name = 'withdrawn_at';
  if r.is_nullable <> 'YES' or r.column_default is not null then
    raise exception 'MIGRATION 075 FAILED: withdrawn_at is nullable=%, default=% — a default would stamp every row.',
      r.is_nullable, coalesce(r.column_default, '<none>');
  end if;
  if r.data_type <> 'timestamp with time zone' then
    raise exception 'MIGRATION 075 FAILED: withdrawn_at is %, not timestamptz.', r.data_type;
  end if;

  -- ---- 7. THE VIEW IS STILL security_invoker. ----
  -- `create or replace view` keeps the option, but "keeps" is an assumption and this is the one
  -- thing standing between the view and a hole through this table's RLS (073:§8).
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'calendar_v'
     and c.reloptions @> array['security_invoker=true'];
  if n <> 1 then
    raise exception 'MIGRATION 075 FAILED: calendar_v is not security_invoker.';
  end if;

  -- ---- 8. GRANTS, READ BACK, ALL EIGHT RIGHTS, BOTH ROLES, THE TABLE AND THE VIEW. ----
  -- `CLAUDE.md` §3.6: a grant list describes what you added, not what the role holds. This
  -- migration grants nothing, which is exactly when a grant check matters — `create or replace
  -- view` is the statement that could quietly reset them.
  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    foreach rel in array array['calendar_events', 'calendar_v'] loop
      if has_table_privilege('anon', 'public.' || rel, v) then
        raise exception 'MIGRATION 075 FAILED: anon holds % on %.', v, rel;
      end if;
    end loop;
  end loop;
  foreach v in array array['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('authenticated', 'public.calendar_events', v) then
      raise exception 'MIGRATION 075 FAILED: authenticated holds % on calendar_events.', v;
    end if;
  end loop;
  foreach v in array array['SELECT', 'INSERT', 'UPDATE'] loop
    if not has_table_privilege('authenticated', 'public.calendar_events', v) then
      raise exception 'MIGRATION 075 FAILED: authenticated lost % on calendar_events.', v;
    end if;
  end loop;
  if not has_table_privilege('authenticated', 'public.calendar_v', 'SELECT') then
    raise exception 'MIGRATION 075 FAILED: authenticated lost SELECT on calendar_v.';
  end if;
  foreach v in array array['INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.calendar_v', v) then
      raise exception 'MIGRATION 075 FAILED: authenticated holds % on the view.', v;
    end if;
  end loop;

  -- ---- 9. NOTHING WAS WITHDRAWN BY THIS MIGRATION. ----
  -- Deciding that a reading no longer says a date is the reading's job. A row withdrawn here would
  -- be a date taken off a real customer's calendar by a schema change.
  select count(*) into n from public.calendar_events
   where status = 'withdrawn' and company_id <> co;
  if n <> 0 then
    raise exception 'MIGRATION 075 FAILED: % real row(s) are withdrawn; this migration backfills nothing.', n;
  end if;

  -- ---- CLEAN UP, BY ID. ----
  delete from public.calendar_events where id in (ev_prop, ev_with, ev_dism, ev_conf);
  delete from public.documents where id = docu;
  delete from public.companies where id = co;

  select count(*) into n from public.calendar_events where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 075 FAILED: % probe row(s) left behind.', n;
  end if;

  raise notice 'MIGRATION 075 OK: status gained "withdrawn", withdrawn_at added nullable with no '
               'default, calendar_v returns 3 of 4 statuses, the partial unique index still covers '
               'a withdrawn row, grants unmoved, 0 rows withdrawn by this migration.';
end $$;

commit;
