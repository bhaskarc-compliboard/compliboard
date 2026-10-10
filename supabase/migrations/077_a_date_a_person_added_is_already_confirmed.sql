-- ===========================================================================
-- 077 — A DATE A PERSON ADDED BY HAND IS ALREADY CONFIRMED
--
-- Calendar Job B (`docs/CALENDAR-PLAN.md` decisions 3 and 6, `DECISIONS.md` §185).
--
-- **WHY: a row on screen that the product cannot produce.** Job B's To confirm tab showed a group
-- headed *"Added by hand · 1"* under a sentence reading *"3 dates found in your documents"*. Both
-- cannot be true of the same row, and the owner caught it in the screenshot.
--
-- **Where it came from.** Not from the product. `app/api/calendar/dates/route.ts` sets the state from
-- the SOURCE — `source === 'document' ? 'not_confirmed' : 'confirmed'` — precisely because decision 3
-- says a reading's dates wait for a person while a date somebody pressed for is already agreed. The
-- row was written **straight to the table** by a proof script during A5b, which set `state` itself and
-- so produced a combination no route can make. It is deleted below.
--
-- **The rule, now in the database.** `source = 'hand'` means a person typed it, and typing it IS the
-- confirmation — there is nobody else to confirm it against, and no document line to check it by. So
-- a hand-added date may be `confirmed`, `done`, `rejected` or `withdrawn`, and may never be
-- `not_confirmed`.
--
-- *** A TEST FIXTURE IS NOT A REASON TO LEAVE A HOLE OPEN. *** The failure here was mine and it was
-- only in a script, but the same shape reaches a customer the first time any code writes a state
-- beside a source without thinking — and a To confirm tab that asks somebody to confirm their own
-- typing is exactly the kind of nonsense a person stops trusting a screen over. `CLAUDE.md` §3.7:
-- a CHECK nobody has tried to break is a comment, so the verify block below tries it.
--
-- **What this does NOT do.** It says nothing about `conversation`, `audit` or `handbook`. Those are
-- also confirmed on arrival today (the route), but each is a press on a screen that could, in a later
-- design, offer something else — a date proposed by a summary for later review, say. Narrowing those
-- would be deciding another section's future, which this migration has no business doing.
-- ===========================================================================

begin;

-- The row the proof script left behind, and any other of the same shape. Deleted rather than
-- corrected: it is test data, it belongs to no reading, and leaving it as `confirmed` would put a
-- date on a staging calendar that nobody chose to have.
delete from public.calendar_events
 where source = 'hand' and state = 'not_confirmed';

alter table public.calendar_events drop constraint if exists calendar_events_hand_is_confirmed;
alter table public.calendar_events add constraint calendar_events_hand_is_confirmed
  check (source <> 'hand' or state <> 'not_confirmed');

comment on constraint calendar_events_hand_is_confirmed on public.calendar_events is
  'Calendar decisions 3 and 6 (migration 077). A date somebody typed is confirmed by the typing: '
  'there is nothing to confirm it against. It may be confirmed, done, rejected or withdrawn, never '
  'not_confirmed — which would put "confirm your own typing" in the To confirm tab.';

-- ===========================================================================
-- VERIFY — §3.7: a CHECK nobody has tried to break is a comment.
-- ===========================================================================
do $$
declare co uuid; n int;
begin
  insert into public.companies (name) values ('077 probe') returning id into co;

  -- THE COMBINATION THAT MUST BE REFUSED, written the way the script wrote it.
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
         values (co, 'Monthly EHS self-check', '2027-01-05', 'hand', 'not_confirmed', 'hand:probe-1');
    raise exception 'MIGRATION 077 FAILED: a hand-added date was accepted as not_confirmed.';
  exception when check_violation then null; end;

  -- ...and the four states it MAY hold, or the constraint is simply refusing everything.
  insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
       values (co, 'Confirmed', '2027-01-05', 'hand', 'confirmed', 'hand:probe-ok1');
  insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
       values (co, 'Done', '2027-01-05', 'hand', 'done', 'hand:probe-ok2');
  insert into public.calendar_events (company_id, title, due_date, source, state, rejected_reason, date_key)
       values (co, 'Rejected', '2027-01-05', 'hand', 'rejected', 'I typed it by mistake.', 'hand:probe-ok3');
  insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
       values (co, 'Withdrawn', '2027-01-05', 'hand', 'withdrawn', 'hand:probe-ok4');
  select count(*) into n from public.calendar_events where company_id = co;
  if n <> 4 then raise exception 'MIGRATION 077 FAILED: a hand date was refused a state it may hold (% of 4).', n; end if;

  -- A DOCUMENT'S DATE IS STILL ALLOWED TO WAIT — the whole of decision 3 depends on it, so it is
  -- asserted here rather than assumed from the constraint's wording.
  insert into public.calendar_events (company_id, title, due_date, source, state, document_id, date_key)
       values (co, 'Permit expires', '2027-01-05', 'document', 'not_confirmed', null, 'document:probe');
  if (select state from public.calendar_events where date_key = 'document:probe') <> 'not_confirmed' then
    raise exception 'MIGRATION 077 FAILED: a document date can no longer wait to be confirmed.';
  end if;

  -- And no such row is left anywhere.
  select count(*) into n from public.calendar_events where source = 'hand' and state = 'not_confirmed';
  if n <> 0 then raise exception 'MIGRATION 077 FAILED: % hand date(s) are still not_confirmed.', n; end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 077 VERIFIED: a hand-added date cannot be not_confirmed; it may still be confirmed, done, rejected or withdrawn; a document''s date may still wait; and no row of the refused shape is left.';
end $$;

commit;
