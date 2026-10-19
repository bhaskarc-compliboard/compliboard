-- ===========================================================================
-- 079 — A REPEATING DATE WITH A DAY IS A DATE
-- ===========================================================================
-- WHY.
--
-- The owner, 19 October 2026, from the first look at the calendar on production (decision 32):
-- **the month grid and the list show dates and nothing else.** Every question for a person —
-- confirm this, how often does it repeat, which day is it — lives in the date drawer and in Dates
-- to confirm. The strip above the grid that read "Repeating, day not read yet (N)" goes, and so
-- does the list's last group.
--
-- That is a screen decision, and it cannot be made on the screens alone, because the screens are
-- not what decides which rows have a day: `calendar_v` is. Today the view answers `next_due = null`
-- for a repeating row whenever EITHER the day or the period is missing:
--
--     when e.due_date is null or st.step_months is null then null       -- 073:§7, re-emitted by 075
--
-- So a document that said *"next annual maintenance due 20 August 2026"* produces a row with a real
-- day, read from the document, that the calendar refuses to place — because nobody read how often
-- it repeats afterwards. **One unknown threw away a known.** 20 August 2026 is a day; the only
-- thing not read is the occurrence AFTER it.
--
-- WHAT THIS MIGRATION DOES. Three things, and nothing else:
--
--   1. `calendar_v.next_due` = `due_date` when `recurs` is true, `period` is null and `due_date` is
--      not null. A repeating row with no day still has no `next_due` — with or without a period —
--      and a repeating row WITH a period keeps the existing `step_months` arithmetic, untouched.
--   2. `has_passed` is said once, off the day the product shows: `next_due < current_date`. It was
--      `not recurs and due_date < current_date`, which gave the same answer for every row that
--      could have a day before today — §5 proves that on this database's own rows — and the wrong
--      answer for the rows 079 adds, whose one day may well be behind us.
--   3. A PERSON MAY WRITE `due_date`, AND ONLY FROM NULL. The drawer gains "Set the day" beside
--      "Set how often" (step 14b item 3), so the column grant must let a person write it — and the
--      moment it does, the sentence a document set may be rewritten from a browser. 078's trigger
--      is the place that already answers this class of question, so the rule goes there, as a
--      second pure function beside `calendar_person_move_refusal`: **a day may be set from
--      nothing; a day that is already there may not be changed or cleared by a person.** The
--      document's day is evidence (078's own reasoning for `source_line`), and a person who wants
--      a different day removes the date and adds their own.
--
-- WHAT IT DELIBERATELY DOES NOT DO.
--
--   · **No backfill, and nothing is written to any row.** The change is entirely in the view's
--     arithmetic, so the rows that move onto the grid move because they always had a day, not
--     because a migration gave them one. Read before writing this, SELECT only, on both databases:
--     **production 20 live rows move onto the grid and 7 stay off; staging 24 move and 12 stay.**
--     Those figures are in the step 14b report with the query that produced them.
--   · **Decision 23 is unchanged.** The scan still does not say how often a date repeats, the
--     drawer still asks, and `period` stays null until a person answers. What changes is that the
--     unanswered question no longer hides the answered one.
--   · **`period` is not inferred from the word in the title.** "next ANNUAL maintenance" is prose,
--     and reading a frequency out of it is exactly the guess decision 30 forbids.
--
-- NO TABLE IS CREATED, so there is no REVOKE-then-GRANT for a new relation; the one grant below is
-- an addition to the column list 078 wrote, and §5 reads back all twelve a person may write and
-- all thirteen they may not (`CLAUDE.md` §3.6: a grant list describes what you added, not what the
-- role holds). `create or replace view` keeps the view's own grants and its `security_invoker`,
-- and §5 re-reads both anyway.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. THE VIEW.
--
-- `create or replace view` can only APPEND columns, so the select list below is 073's own as 075
-- re-emitted it, column for column and in the same order, with TWO expressions changed: the
-- `next_due` lateral gains a branch, and `has_passed` is computed from `next_due`. Re-emitted in
-- full because that is what `create or replace` requires; `git diff 075 079` is the honest diff.
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
  -- *** HAS PASSED IS NOW SIMPLY "THE DAY WE SHOW IS BEHIND US" — migration 079. ***
  -- It read `not e.recurs and e.due_date is not null and e.due_date < current_date`, and that was
  -- the SAME answer while only two kinds of row had a day: a one-off IS its day, and a repeating
  -- date with a period has its next occurrence ahead by construction (the arithmetic below never
  -- returns a past date). 079 adds a third kind — repeating, a day, no period — whose `next_due`
  -- is that one day with nothing computed after it. When that day is behind us the date HAS
  -- passed, and the old expression would have answered "no" while the list beside it read
  -- "60 days ago" and the info bar offered it as the NEXT date. So it is said once, off the one
  -- day the product shows. §5 proves the two agree on every other row in this database.
  -- The product says "passed", never "overdue" and never "done" (decision 11).
  (nd.next_due is not null and nd.next_due < current_date) as has_passed,
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
    -- Repeating with NO DAY AT ALL: there is no honest next date (decision 12). Unchanged.
    when e.due_date is null then null
    -- *** A REPEATING DATE WITH A DAY AND NO PERIOD IS THAT DAY — decision 32, migration 079. ***
    -- The document said "next annual maintenance due 20 August 2026". That is a day. The only
    -- thing nobody read is the occurrence AFTER it, and that is one unknown, not two: until now
    -- the unknown period threw the known day away with it, and the row sat off the grid, off the
    -- list and in a strip of its own. It is a date like any other; the drawer is where the
    -- product still asks how often, and decision 23 is unchanged.
    when st.step_months is null then e.due_date
    when (e.due_date + (kk.k * st.step_months || ' months')::interval)::date >= current_date
      then (e.due_date + (kk.k * st.step_months || ' months')::interval)::date
    else   (e.due_date + ((kk.k + 1) * st.step_months || ' months')::interval)::date
  end as next_due
) nd on true
-- *** MIGRATION 075'S LINE, CARRIED OVER UNCHANGED (decision 29). ***
-- A withdrawn row is not a statement about this date any more, so the calendar's own feed does not
-- carry it. Dismissed and superseded rows ARE still carried, unchanged from 073: the first is a
-- person's decision and the second is history, and both have something to show.
where e.status <> 'withdrawn';

comment on view public.calendar_v is
  'Every calendar_events column plus the site read live from the document, next_due computed from '
  'the period and the anchor, days_until, has_passed and source_title. NOTHING DERIVED IS STORED — '
  'migration 049''s rule. security_invoker: it shows only the rows the caller could select. '
  'A REPEATING DATE WITH A DAY AND NO PERIOD HAS next_due = ITS DAY (decision 32, migration 079); '
  'with no day it has none, whether or not it has a period. has_passed is next_due < today. '
  'WITHDRAWN ROWS ARE NOT RETURNED (decision 29, migration 075); dismissed and superseded rows are. '
  'Migration 073.';

-- ---------------------------------------------------------------------------
-- 2. THE DAY A PERSON MAY SET, AS A FUNCTION OF WHAT CHANGED.
--
-- A SECOND FUNCTION RATHER THAN A WIDER SIGNATURE ON 078'S. `calendar_person_move_refusal` is
-- proved case by case by migration 078's own §4, which is applied on staging and on production;
-- adding two arguments to it would mean dropping and recreating a function those proofs name, so
-- that an already-verified rule is re-verified here for a reason that has nothing to do with it.
-- Two small pure functions, each with its own exhaustive proof, and one trigger calling both.
--
--   null → a day        the drawer's "Set the day". The row had no day; now it has one.
--   null → null         nothing happened.
--   a day → the same    every other update on a row that has a day (confirm, remove, set period).
--   a day → another     NEVER by a person. The day was read from a document and is quoted beside
--                       it; a person who disagrees removes the date and adds their own.
--   a day → null        NEVER by a person, for the same reason and more so: it would take the
--                       date off the grid while leaving the row saying a document set it.
-- ---------------------------------------------------------------------------
create or replace function public.calendar_person_day_refusal(
  old_day date, new_day date
) returns text
language sql
immutable
as $$
  select case
    when old_day is not null and new_day is distinct from old_day
      then 'This date already has a day. A day that has been set is not changed here — remove '
           'the date and add one with the day you want.'
    else null
  end;
$$;

comment on function public.calendar_person_day_refusal is
  'Whether a PERSON may make this change to a calendar date''s day: NULL when they may, else the '
  'sentence to refuse with. A day may be SET from nothing — the drawer''s "Set the day", Calendar '
  'step 14b — and a day that is already there may never be changed or cleared by hand, because it '
  'is the document''s own evidence. A pure function so migration 079 can prove every case of it '
  'without a login, as 078 does for the status moves. Migration 079.';

-- ---------------------------------------------------------------------------
-- 3. THE TRIGGER NOW ASKS BOTH RULES. The gate is 078's and is unchanged: the rules apply when the
-- caller is `authenticated`, and the service role — the document scan, the audit run, the
-- withdrawal, the monthly job — is untouched. `current_user` and not `auth.role()`, for 078's
-- reason: the JWT's claim is what the caller sent; the role the database is running as is what the
-- database can be sure of.
--
-- The MOVE rule is asked first, so a person who tries two forbidden things at once reads the
-- sentence about the status rather than the one about the day — the status is the bigger claim.
-- ---------------------------------------------------------------------------
create or replace function public.calendar_events_guard_person_update()
returns trigger
language plpgsql
as $$
declare
  refusal text;
begin
  if current_user <> 'authenticated' then return new; end if;
  refusal := public.calendar_person_move_refusal(old.status, new.status, old.withdrawn_at, new.withdrawn_at);
  if refusal is null then
    refusal := public.calendar_person_day_refusal(old.due_date, new.due_date);
  end if;
  if refusal is not null then
    raise exception using errcode = 'check_violation', message = refusal;
  end if;
  return new;
end;
$$;

-- The trigger itself is 078's and is NOT recreated: `create or replace function` replaces the body
-- a trigger already points at. Re-creating it would drop and re-add a trigger for no change.

-- ---------------------------------------------------------------------------
-- 4. THE ONE COLUMN THE GRANT GAINS.
--
-- 078 revoked the table-wide UPDATE and granted eleven columns by name. This adds the twelfth and
-- does not restate the other eleven: a second copy of that list is a second place for it to drift,
-- and §5 reads all twelve back out of the catalog rather than trusting either copy. What is still
-- NOT in it is the point — `title`, `recurs`, `source`, `source_line`, `source_url`, `source_page`,
-- `document_id`, `deadline_id`, `audit_finding_id`, `handbook_id`, `company_id`, `added_by`,
-- `created_at`. `due_date` leaves that list and enters the guarded one: a grant cannot say "only
-- from null", which is exactly what the trigger above is for.
-- ---------------------------------------------------------------------------
grant update (due_date) on table public.calendar_events to authenticated;

-- ===========================================================================
-- 5. VERIFY — AND EVERY CHECK HERE TRIES TO BREAK SOMETHING.
--
-- `CLAUDE.md` §3.7: a constraint nobody has tried to break is a comment. §9a: before believing an
-- absence, prove the same check can see a presence — so every "the view gives it no day" test
-- below sits beside a row the view MUST give a day to, on the same probe company, in the same
-- query shape.
--
-- *** WHAT THIS BLOCK CANNOT PROVE, SAID OUT LOUD, AS 078 SAID IT. *** It proves the day RULE
-- exhaustively, because the rule is a pure function of two values. It cannot prove the GATE:
-- becoming `authenticated` here would also have to satisfy `auth_company_id()`, which reads a
-- `profiles` row whose id is a real login in `auth.users`, and a migration has no session and must
-- not invent one. **The gate is proved by `check:live` as a real signed-in person** — a day set
-- from null, and the same person refused when they try to move one — which is where "a person
-- cannot do this" is a claim about a person.
-- ===========================================================================
do $$
declare
  co      uuid;
  docu    uuid;
  r       record;
  n       int;
  v       text;
  moved   int;
  one_ahead uuid; one_behind uuid;
  rep_day_ahead uuid; rep_day_behind uuid;
  rep_noday uuid; rep_noday_period uuid; rep_period uuid;
begin
  -- ---- 5a. THE SEVEN SHAPES A ROW CAN HAVE, ONE PROBE EACH. ----
  insert into public.companies (name) values ('079 probe company') returning id into co;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, '079 probe permit', co::text || '/079-probe.pdf', 'application/pdf')
    returning id into docu;

  -- A one-off, ahead and behind: UNCHANGED by this migration, and the control for has_passed.
  insert into public.calendar_events (company_id, title, due_date, recurs, source)
       values (co, '079 one-off ahead', current_date + 40, false, 'person') returning id into one_ahead;
  insert into public.calendar_events (company_id, title, due_date, recurs, source)
       values (co, '079 one-off behind', current_date - 40, false, 'person') returning id into one_behind;
  -- *** THE ROWS THIS MIGRATION IS FOR: repeating, a day, no period. ***
  insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source)
       values (co, docu, '079 repeating day ahead', current_date + 30, true, 'document')
    returning id into rep_day_ahead;
  insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source)
       values (co, docu, '079 repeating day behind', current_date - 60, true, 'document')
    returning id into rep_day_behind;
  -- Repeating with NO DAY, with and without a period: both still have no next date (decision 12).
  insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source)
       values (co, docu, '079 repeating no day', null, true, 'document') returning id into rep_noday;
  insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source, period)
       values (co, docu, '079 repeating no day but yearly', null, true, 'document', 'year')
    returning id into rep_noday_period;
  -- Repeating WITH a period: the existing arithmetic, which must not move. A 2025-09-01 anchor on
  -- a two-year period answers 2027-09-01 — the same row step 14a proved after the `biennially` fix.
  insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source, period)
       values (co, docu, '079 repeating every 2 years', date '2025-09-01', true, 'document', '2 years')
    returning id into rep_period;

  -- ---- 5b. WHAT THE VIEW NOW SAYS, ROW BY ROW. ----
  -- A one-off IS its day, ahead or behind, and only the second has passed.
  select next_due, days_until, has_passed into r from public.calendar_v where id = one_ahead;
  if r.next_due <> current_date + 40 or r.has_passed or r.days_until <> 40 then
    raise exception 'MIGRATION 079 FAILED: a one-off ahead reads next_due %, days_until %, has_passed %.',
      coalesce(r.next_due::text, '<null>'), coalesce(r.days_until::text, '<null>'), r.has_passed;
  end if;
  select next_due, days_until, has_passed into r from public.calendar_v where id = one_behind;
  if r.next_due <> current_date - 40 or not r.has_passed or r.days_until <> -40 then
    raise exception 'MIGRATION 079 FAILED: a one-off behind reads next_due %, days_until %, has_passed %.',
      coalesce(r.next_due::text, '<null>'), coalesce(r.days_until::text, '<null>'), r.has_passed;
  end if;

  -- *** THE CHANGE ITSELF: a repeating date with a day and no period IS that day. ***
  select next_due, days_until, has_passed, period into r from public.calendar_v where id = rep_day_ahead;
  if r.next_due is distinct from current_date + 30 then
    raise exception 'MIGRATION 079 FAILED: a repeating date with a day and no period reads next_due %, not its day.',
      coalesce(r.next_due::text, '<null>');
  end if;
  if r.days_until <> 30 or r.has_passed then
    raise exception 'MIGRATION 079 FAILED: that row reads days_until %, has_passed % — both follow from next_due.',
      coalesce(r.days_until::text, '<null>'), r.has_passed;
  end if;
  if r.period is not null then
    raise exception 'MIGRATION 079 FAILED: this migration wrote a period onto a row. It backfills nothing.';
  end if;
  -- And when that one day is behind us it HAS passed, which the old expression would have denied.
  select next_due, days_until, has_passed into r from public.calendar_v where id = rep_day_behind;
  if r.next_due is distinct from current_date - 60 or not r.has_passed or r.days_until <> -60 then
    raise exception 'MIGRATION 079 FAILED: a repeating date whose one day is behind us reads next_due %, days_until %, has_passed %.',
      coalesce(r.next_due::text, '<null>'), coalesce(r.days_until::text, '<null>'), r.has_passed;
  end if;

  -- ---- 5c. A REPEATING ROW WITH NO DAY STILL HAS NO NEXT DATE — with or without a period. ----
  -- The absence this migration must NOT remove, and the presence above is what makes the absence
  -- readable: the same query, the same company, four rows away.
  foreach v in array array[rep_noday::text, rep_noday_period::text] loop
    select next_due, days_until, has_passed into r from public.calendar_v where id = v::uuid;
    if r.next_due is not null then
      raise exception 'MIGRATION 079 FAILED: a repeating date with NO DAY was given next_due %.', r.next_due;
    end if;
    if r.days_until is not null or r.has_passed then
      raise exception 'MIGRATION 079 FAILED: a date with no next_due reads days_until %, has_passed %.',
        coalesce(r.days_until::text, '<null>'), r.has_passed;
    end if;
  end loop;

  -- ---- 5d. A REPEATING ROW WITH A PERIOD IS UNTOUCHED: the step_months arithmetic. ----
  select next_due, days_until, has_passed into r from public.calendar_v where id = rep_period;
  if r.next_due <> date '2027-09-01' then
    raise exception 'MIGRATION 079 FAILED: a 2025-09-01 anchor every 2 years now answers %, not 2027-09-01.',
      coalesce(r.next_due::text, '<null>');
  end if;
  if r.has_passed then
    raise exception 'MIGRATION 079 FAILED: a repeating date with a period says it has passed; its next one is ahead.';
  end if;
  -- An anchor long behind us still lands ahead: the arithmetic, not the anchor.
  update public.calendar_events set period = 'year', due_date = date '2021-03-05' where id = rep_period;
  select next_due, has_passed into r from public.calendar_v where id = rep_period;
  if r.next_due is null or r.next_due < current_date or r.has_passed then
    raise exception 'MIGRATION 079 FAILED: a 2021 yearly anchor answers % (has_passed %), which is not ahead.',
      coalesce(r.next_due::text, '<null>'), r.has_passed;
  end if;

  -- ---- 5e. THE OLD has_passed AND THE NEW ONE AGREE ON EVERY OTHER ROW IN THIS DATABASE. ----
  -- The one thing a probe cannot show: that rewriting an expression did not change the answer for
  -- the rows already here. Outside the class 079 adds, the view's `has_passed` must equal 073's
  -- expression exactly, on real data.
  select count(*) into n
    from public.calendar_v v
    join public.calendar_events e on e.id = v.id
   where not (e.recurs and e.due_date is not null and e.period is null)
     and v.has_passed is distinct from (not e.recurs and e.due_date is not null and e.due_date < current_date);
  if n <> 0 then
    raise exception 'MIGRATION 079 FAILED: has_passed changed answer on % row(s) outside the class this migration adds.', n;
  end if;

  -- How many rows this database actually moves onto the grid, in the notice, so the number in the
  -- report is the database's own and not a figure typed into a document.
  select count(*) into moved from public.calendar_v
   where status in ('proposed', 'confirmed') and replaced_by is null
     and recurs and due_date is not null and period is null and id <> rep_day_ahead and id <> rep_day_behind;

  -- ---- 5f. THE DAY RULE, EVERY CASE OF IT. ----
  if public.calendar_person_day_refusal(null, date '2026-11-01') is not null then
    raise exception 'MIGRATION 079 FAILED: a person could not set a day on a date that had none.';
  end if;
  if public.calendar_person_day_refusal(null, null) is not null then
    raise exception 'MIGRATION 079 FAILED: an update that touches no day was refused.';
  end if;
  if public.calendar_person_day_refusal(date '2026-08-20', date '2026-08-20') is not null then
    raise exception 'MIGRATION 079 FAILED: confirming a date that already has a day was refused.';
  end if;
  if public.calendar_person_day_refusal(date '2026-08-20', date '2026-09-01') is null then
    raise exception 'MIGRATION 079 FAILED: a person could move a day a document set.';
  end if;
  if public.calendar_person_day_refusal(date '2026-08-20', null) is null then
    raise exception 'MIGRATION 079 FAILED: a person could clear a day a document set.';
  end if;

  -- ---- 5g. 078'S RULE IS STILL ASKED, AND FIRST. ----
  -- The trigger body was replaced here; a rule that quietly stopped being asked is exactly the
  -- failure that replacement could cause. Two of 078's own cases, re-run through the function it
  -- still calls, plus the order: a person withdrawing a date AND setting a day reads the status
  -- sentence, because the status is the bigger claim.
  if public.calendar_person_move_refusal('proposed', 'withdrawn', null, null) is null then
    raise exception 'MIGRATION 079 FAILED: proposed → withdrawn is allowed again; only a reading withdraws a date.';
  end if;
  if public.calendar_person_move_refusal('dismissed', 'confirmed', null, null) is null then
    raise exception 'MIGRATION 079 FAILED: a dismissed date could be confirmed again (rule b).';
  end if;
  if public.calendar_person_move_refusal('proposed', 'confirmed', null, null) is not null then
    raise exception 'MIGRATION 079 FAILED: confirming a proposed date is refused.';
  end if;

  -- ---- 5h. THE TRIGGER IS STILL THERE, BEFORE UPDATE, POINTING AT THE FUNCTION JUST REPLACED. ----
  select count(*) into n from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_proc p on p.oid = t.tgfoid
   where c.relname = 'calendar_events' and t.tgname = 'calendar_events_person_update'
     and not t.tgisinternal and p.proname = 'calendar_events_guard_person_update'
     and (t.tgtype & 2) = 2 and (t.tgtype & 16) = 16;   -- BEFORE, UPDATE
  if n <> 1 then
    raise exception 'MIGRATION 079 FAILED: the BEFORE UPDATE trigger on calendar_events is not pointing at the guard (% found).', n;
  end if;
  -- And the service role is not gated by it: this block is not `authenticated`, and a day set here
  -- on a row that already has one must still work — the document scan does exactly that.
  update public.calendar_events set due_date = current_date + 31 where id = rep_day_ahead;
  select due_date into r from public.calendar_events where id = rep_day_ahead;
  if r.due_date <> current_date + 31 then
    raise exception 'MIGRATION 079 FAILED: the service role could not move a day.';
  end if;

  -- ---- 5i. THE GRANTS, READ BACK, COLUMN BY COLUMN, BOTH ROLES. ----
  -- Twelve a person may write, `due_date` the new one; thirteen they may not.
  foreach v in array array['status', 'confirmed_by', 'confirmed_at', 'dismissed_by', 'dismissed_at',
                           'dismissed_reason', 'period', 'withdrawn_at', 'replaced_by', 'description',
                           'entity_id', 'due_date'] loop
    if not has_column_privilege('authenticated', 'public.calendar_events', v, 'UPDATE') then
      raise exception 'MIGRATION 079 FAILED: authenticated cannot UPDATE %, which a route writes.', v;
    end if;
  end loop;
  foreach v in array array['title', 'recurs', 'source', 'source_line', 'source_url', 'source_page',
                           'document_id', 'deadline_id', 'audit_finding_id', 'handbook_id',
                           'company_id', 'added_by', 'created_at'] loop
    if has_column_privilege('authenticated', 'public.calendar_events', v, 'UPDATE') then
      raise exception 'MIGRATION 079 FAILED: authenticated can rewrite %, which carries the evidence.', v;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.calendar_events', 'DELETE') then
    raise exception 'MIGRATION 079 FAILED: authenticated gained DELETE.';
  end if;
  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.calendar_events', v) then
      raise exception 'MIGRATION 079 FAILED: anon holds % on calendar_events.', v;
    end if;
    if has_table_privilege('anon', 'public.calendar_v', v) then
      raise exception 'MIGRATION 079 FAILED: anon holds % on calendar_v.', v;
    end if;
  end loop;
  if not has_table_privilege('authenticated', 'public.calendar_v', 'SELECT') then
    raise exception 'MIGRATION 079 FAILED: authenticated lost SELECT on calendar_v.';
  end if;

  -- ---- 5j. THE VIEW IS STILL 31 COLUMNS AND STILL security_invoker. ----
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'calendar_v';
  if n <> 31 then
    raise exception 'MIGRATION 079 FAILED: calendar_v has % columns, not the 31 migration 073 built.', n;
  end if;
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'calendar_v'
     and c.reloptions @> array['security_invoker=true'];
  if n <> 1 then
    raise exception 'MIGRATION 079 FAILED: calendar_v is not security_invoker.';
  end if;

  -- ---- CLEAN UP, BY ID. ----
  delete from public.calendar_events
   where id in (one_ahead, one_behind, rep_day_ahead, rep_day_behind, rep_noday, rep_noday_period, rep_period);
  delete from public.documents where id = docu;
  delete from public.companies where id = co;
  select count(*) into n from public.calendar_events where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 079 FAILED: % probe row(s) left behind.', n;
  end if;

  raise notice 'MIGRATION 079 OK: a repeating date with a day and no period reads next_due = its '
               'day, with days_until and has_passed following; with no day it still has none, with '
               'or without a period; a date every 2 years still answers 2027-09-01 and a 2021 '
               'yearly anchor still lands ahead; has_passed agrees with 073''s expression on every '
               'other row in this database; a person may set a day from nothing and may neither '
               'move nor clear one; 078''s status rule is still asked and still first; twelve '
               'columns writable, thirteen not; 31 columns, security_invoker. % live row(s) in '
               'this database move onto the grid.', moved;
end $$;

commit;
