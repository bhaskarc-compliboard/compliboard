-- ===========================================================================
-- 078 — A PERSON MAY ONLY MAKE THE MOVES THE PRODUCT OFFERS
-- ===========================================================================
-- WHY.
--
-- `HANDOFF-CODE.md` §7 has carried this since Calendar step 6b: **`authenticated` holds a
-- column-blind UPDATE on `calendar_events`.** Migration 073 grants the table-wide right and the
-- policy checks one thing — that the row is this caller's company:
--
--     calendar_events_update  UPDATE  using (company_id = auth_company_id())
--                                     with check (company_id = auth_company_id())
--
-- Read back from the catalog on 16 October 2026, `authenticated` can UPDATE `title` (true),
-- `source_line` (true) and `withdrawn_at` (true) on any row of its own company. So a caller going
-- straight to PostgREST — not through `app/api/calendar/route.ts`, which is a UX affordance and
-- not the boundary (`CLAUDE.md` §3.6) — can:
--
--   · set `status` to 'withdrawn', which makes the date vanish from `calendar_v` and therefore
--     from the calendar, the queue, the Dashboard, the feed and the monthly email at once —
--     while the product tells everybody that only a READING withdraws a date (decision 29);
--   · stamp or clear `withdrawn_at`, so the row says it was withdrawn when nothing withdrew it;
--   · rewrite `source_line` — the sentence the product QUOTES as the document's own words. That
--     is the evidence chain the whole section rests on: §3.3's anchor, shown in the drawer, in
--     the queue, in the chat's source cards and in the email.
--
-- None of that is reachable from a screen. The point is that the screen is not what decides.
--
-- WHY THIS SHAPE, AND WHAT WAS REJECTED.
--
--   · **A column grant alone** cannot do it. `status` MUST stay writable — confirming and
--     removing a date are the two things this section exists for — and a grant cannot say which
--     WORDS a column may take.
--   · **Moving the PATCH writes to the service role** behind `requireCompany` would work and is
--     the biggest change of the three: `lib/calendarDates.ts` proves ownership today by reading
--     the row through the CALLER's client, so a row of another company is simply absent and the
--     answer is 404 (§3.6). Handing it `supabaseAdmin` replaces an RLS-enforced tenancy with a
--     tenancy enforced by code I would have to write — in the one place this product is
--     strongest. Rejected for that reason, not for size.
--   · **Both halves of what is left**, which is this migration: a column grant for the columns a
--     person has no business writing at all, and a trigger for the one thing a grant cannot
--     express — which status words a person may move between, and when `withdrawn_at` may be
--     cleared.
--
-- THE RULE IS A FUNCTION, NOT A BLOCK OF `IF`s INSIDE THE TRIGGER, so this migration can prove
-- every case of it in plain SQL with no login (§4 below). The trigger is then one line of gate:
-- the rule applies when the caller is `authenticated`, and the service role — the document scan,
-- the audit run, step 6b's withdrawal, the monthly job — is untouched.
--
-- READ FROM STAGING BEFORE WRITING THIS (16 October 2026): the three policies above are the only
-- ones on the table; `authenticated` holds SELECT, INSERT and UPDATE and not DELETE (073, and
-- 075 §8 re-reads it); `has_column_privilege` says UPDATE on every column.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. THE RULE, AS A FUNCTION OF WHAT CHANGED.
--
-- Returns NULL when the move is one the product offers, and the sentence to refuse with when it
-- is not. Every transition below is one a route actually makes (`lib/calendarDates.ts`):
--
--   proposed  → confirmed   Confirm, and Confirm all
--   proposed  → dismissed   Not right, and Remove
--   confirmed → dismissed   Remove, from the drawer
--   confirmed → confirmed   pressing Confirm twice, and `setPeriod` on a confirmed row
--   proposed  → proposed    `setPeriod`, which changes no status at all
--   withdrawn → confirmed   a stale page: the newest reading withdrew it and the person says it
--   withdrawn → dismissed   the same, removing it instead (step 6b: a person outranks a re-read)
--
-- And the two that are never a person's:
--
--   · anything → withdrawn. A reading withdraws a date, never a person (decision 29). A person
--     who wants it gone dismisses it, which is recorded with their name.
--   · dismissed → anything. Rule b: a dismissal is final and never comes back from the same
--     document. `confirmDate` already answers 409; this is the same rule where it cannot be
--     talked around.
-- ---------------------------------------------------------------------------
create or replace function public.calendar_person_move_refusal(
  old_status text, new_status text,
  old_withdrawn timestamptz, new_withdrawn timestamptz
) returns text
language sql
immutable
as $$
  select case
    when new_status = 'withdrawn' and old_status <> 'withdrawn'
      then 'A date is withdrawn by a new reading of its document, never by hand. Remove it instead.'
    when old_status = 'dismissed' and new_status <> 'dismissed'
      then 'That date was removed. Add it again if you need it back.'
    -- Setting the stamp is the withdrawal's own act; clearing it is what confirming or removing a
    -- withdrawn date does, and only that.
    when new_withdrawn is not null and old_withdrawn is distinct from new_withdrawn
      then 'Only a reading records that a date was withdrawn.'
    when old_withdrawn is not null and new_withdrawn is null
         and new_status not in ('confirmed', 'dismissed')
      then 'A withdrawn date comes back by being confirmed or removed, not by clearing the stamp.'
    else null
  end;
$$;

comment on function public.calendar_person_move_refusal is
  'The moves a PERSON may make on a calendar date, as a pure function of the old and new status '
  'and withdrawal stamp: NULL when the move is one the product offers, else the sentence to '
  'refuse with. A function rather than a block inside the trigger so migration 078 can prove '
  'every case of it without a login. Calendar step 12.';

-- ---------------------------------------------------------------------------
-- 2. THE GATE. The rule applies to `authenticated` and to nothing else.
--
-- `current_user` and not `auth.role()`: the JWT's claim is what the caller sent, and the role the
-- database is actually running as is what the database can be sure of. PostgREST does
-- `set local role authenticated` for a person's request and `service_role` for the server's.
-- SECURITY INVOKER (the default) so `current_user` is the caller's, not this function's owner's.
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
  if refusal is not null then
    raise exception using errcode = 'check_violation', message = refusal;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_events_person_update on public.calendar_events;
create trigger calendar_events_person_update
  before update on public.calendar_events
  for each row execute function public.calendar_events_guard_person_update();

-- ---------------------------------------------------------------------------
-- 3. AND THE COLUMNS A PERSON HAS NO BUSINESS WRITING AT ALL.
--
-- REVOKE then GRANT (`CLAUDE.md` §3.6): the table-wide UPDATE goes, and back comes a list. What
-- is NOT in it is the point — `title`, `due_date`, `recurs`, `source`, `source_line`,
-- `source_url`, `source_page`, `document_id`, `deadline_id`, `audit_finding_id`, `handbook_id`,
-- `company_id`, `added_by`, `created_at`. A person who wants a different date adds one (POST) or
-- removes this one; what they may never do is edit the sentence the product quotes as a
-- document's own words.
--
-- `replaced_by` IS in the list, and that is deliberate: `proposeDate` supersedes an earlier row
-- when a person types a date that moves one, and that call runs as the person. `entity_id` and
-- `description` are in it for the same reason — a person's own date, their own note and site.
-- ---------------------------------------------------------------------------
revoke update on table public.calendar_events from authenticated;
grant update (
  status, confirmed_by, confirmed_at, dismissed_by, dismissed_at, dismissed_reason,
  period, withdrawn_at, replaced_by, description, entity_id
) on table public.calendar_events to authenticated;

-- ===========================================================================
-- 4. VERIFY — AND EVERY CHECK HERE TRIES TO BREAK SOMETHING.
--
-- *** WHAT THIS BLOCK CAN AND CANNOT PROVE, SAID OUT LOUD. *** It proves the RULE exhaustively,
-- because the rule is a function of four values and needs no login. It cannot prove the GATE:
-- becoming `authenticated` here would also have to satisfy `auth_company_id()`, which reads a
-- `profiles` row whose id is a real login in `auth.users` — a migration has no session and must
-- not invent one. **The gate is proved by `check:live` as a real signed-in person**, which is
-- where "a person cannot do this" is a claim about a person. §9a: a check that cannot see a
-- presence is not a check, so the two halves are split rather than faked.
-- ===========================================================================
do $$
declare
  n   int;
  r   record;
  ok  text;
begin
  -- ---- 4a. EVERY MOVE A ROUTE MAKES IS ALLOWED. ----
  for r in
    select * from (values
      ('proposed',  'confirmed'),
      ('proposed',  'dismissed'),
      ('confirmed', 'dismissed'),
      ('confirmed', 'confirmed'),
      ('proposed',  'proposed'),
      ('withdrawn', 'confirmed'),
      ('withdrawn', 'dismissed')
    ) as t(from_status, to_status)
  loop
    ok := public.calendar_person_move_refusal(r.from_status, r.to_status, null, null);
    if ok is not null then
      raise exception 'MIGRATION 078 FAILED: % → % is a move the product offers and the rule refused it: %',
        r.from_status, r.to_status, ok;
    end if;
  end loop;

  -- ---- 4b. NOBODY WITHDRAWS A DATE BY HAND. ----
  for r in select * from (values ('proposed'), ('confirmed'), ('dismissed')) as t(from_status) loop
    ok := public.calendar_person_move_refusal(r.from_status, 'withdrawn', null, null);
    if ok is null then
      raise exception 'MIGRATION 078 FAILED: % → withdrawn was allowed; only a reading withdraws a date.', r.from_status;
    end if;
  end loop;
  -- A row that is ALREADY withdrawn staying withdrawn is not a person withdrawing anything.
  if public.calendar_person_move_refusal('withdrawn', 'withdrawn', now(), now()) is not null then
    raise exception 'MIGRATION 078 FAILED: a withdrawn row could not be left as it is.';
  end if;

  -- ---- 4c. A DISMISSAL IS FINAL (rule b). ----
  for r in select * from (values ('proposed'), ('confirmed')) as t(to_status) loop
    ok := public.calendar_person_move_refusal('dismissed', r.to_status, null, null);
    if ok is null then
      raise exception 'MIGRATION 078 FAILED: dismissed → % was allowed; a removed date never comes back.', r.to_status;
    end if;
  end loop;
  if public.calendar_person_move_refusal('dismissed', 'dismissed', null, null) is not null then
    raise exception 'MIGRATION 078 FAILED: a dismissed row could not be left as it is (its reason may be edited).';
  end if;

  -- ---- 4d. THE WITHDRAWAL STAMP. ----
  -- Set by a person: never.
  if public.calendar_person_move_refusal('proposed', 'proposed', null, now()) is null then
    raise exception 'MIGRATION 078 FAILED: a person could stamp withdrawn_at.';
  end if;
  -- Cleared while confirming or removing: that is exactly what confirmDate and dismissDate do.
  if public.calendar_person_move_refusal('withdrawn', 'confirmed', now(), null) is not null then
    raise exception 'MIGRATION 078 FAILED: confirming a withdrawn date could not clear its stamp.';
  end if;
  if public.calendar_person_move_refusal('withdrawn', 'dismissed', now(), null) is not null then
    raise exception 'MIGRATION 078 FAILED: removing a withdrawn date could not clear its stamp.';
  end if;
  -- Cleared on its own, leaving the row live again as if no reading had ever withdrawn it: never.
  if public.calendar_person_move_refusal('withdrawn', 'proposed', now(), null) is null then
    raise exception 'MIGRATION 078 FAILED: a person could un-withdraw a date into "proposed".';
  end if;

  -- ---- 4e. THE TRIGGER EXISTS, BEFORE UPDATE, ON THIS TABLE. ----
  select count(*) into n from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   where c.relname = 'calendar_events' and t.tgname = 'calendar_events_person_update' and not t.tgisinternal;
  if n <> 1 then raise exception 'MIGRATION 078 FAILED: the trigger is not on calendar_events (% found).', n; end if;
  select count(*) into n from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'calendar_events' and t.tgname = 'calendar_events_person_update'
     and (t.tgtype & 2) = 2 and (t.tgtype & 16) = 16;   -- BEFORE, UPDATE
  if n <> 1 then raise exception 'MIGRATION 078 FAILED: the trigger is not BEFORE UPDATE.'; end if;

  -- ---- 4f. THE SERVICE ROLE IS UNTOUCHED, AND THE WRITES IT MAKES STILL WORK. ----
  -- This block runs as the migration's own role, not as `authenticated`, so the gate is open —
  -- which is the case this check is about. A withdrawal by a reading must still be possible.
  declare
    co uuid; docu uuid; ev uuid;
  begin
    insert into public.companies (name) values ('078 probe company') returning id into co;
    insert into public.documents (company_id, name, file_url, file_type)
         values (co, '078 probe permit', co::text || '/078.pdf', 'application/pdf') returning id into docu;
    insert into public.calendar_events (company_id, document_id, title, due_date, recurs, source, status)
         values (co, docu, 'Permit expires', date '2027-05-01', false, 'document', 'proposed') returning id into ev;
    -- The reading withdraws it: the move a person may never make.
    update public.calendar_events set status = 'withdrawn', withdrawn_at = now() where id = ev;
    select status, withdrawn_at is not null as stamped into r from public.calendar_events where id = ev;
    if r.status <> 'withdrawn' or not r.stamped then
      raise exception 'MIGRATION 078 FAILED: the service role could not withdraw a date.';
    end if;
    -- And a later reading revives it, as step 6b has it.
    update public.calendar_events set status = 'proposed', withdrawn_at = null where id = ev;
    select status into r from public.calendar_events where id = ev;
    if r.status <> 'proposed' then
      raise exception 'MIGRATION 078 FAILED: the service role could not revive a withdrawn date.';
    end if;
    delete from public.calendar_events where id = ev;
    delete from public.documents where id = docu;
    delete from public.companies where id = co;
  end;

  -- ---- 4g. THE GRANTS, READ BACK, COLUMN BY COLUMN. ----
  -- The ones a person needs:
  foreach ok in array array['status', 'confirmed_by', 'confirmed_at', 'dismissed_by', 'dismissed_at',
                            'dismissed_reason', 'period', 'withdrawn_at', 'replaced_by', 'description', 'entity_id'] loop
    if not has_column_privilege('authenticated', 'public.calendar_events', ok, 'UPDATE') then
      raise exception 'MIGRATION 078 FAILED: authenticated lost UPDATE on %, which a route writes.', ok;
    end if;
  end loop;
  -- The ones nobody may rewrite. `source_line` is the sentence the product quotes.
  foreach ok in array array['title', 'due_date', 'recurs', 'source', 'source_line', 'source_url',
                            'source_page', 'document_id', 'deadline_id', 'audit_finding_id',
                            'handbook_id', 'company_id', 'added_by', 'created_at'] loop
    if has_column_privilege('authenticated', 'public.calendar_events', ok, 'UPDATE') then
      raise exception 'MIGRATION 078 FAILED: authenticated can still rewrite %.', ok;
    end if;
  end loop;
  -- And nothing else moved: still SELECT and INSERT, still no DELETE, still nothing for anon.
  if not has_table_privilege('authenticated', 'public.calendar_events', 'SELECT')
     or not has_table_privilege('authenticated', 'public.calendar_events', 'INSERT') then
    raise exception 'MIGRATION 078 FAILED: authenticated lost SELECT or INSERT.';
  end if;
  if has_table_privilege('authenticated', 'public.calendar_events', 'DELETE') then
    raise exception 'MIGRATION 078 FAILED: authenticated gained DELETE.';
  end if;
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.calendar_events', ok) then
      raise exception 'MIGRATION 078 FAILED: anon holds % on calendar_events.', ok;
    end if;
  end loop;

  raise notice 'MIGRATION 078 OK: every move a route makes is allowed and every one it does not '
               'is refused by name; withdrawn is the service role''s word alone; a dismissal is '
               'final; the stamp may be cleared only by confirming or removing; the trigger is '
               'BEFORE UPDATE; the service role can still withdraw and revive; and a person may '
               'write eleven columns and not the fourteen that carry the evidence.';
end $$;

commit;
