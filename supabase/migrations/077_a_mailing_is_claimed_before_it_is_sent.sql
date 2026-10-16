-- ===========================================================================
-- 077 — A MAILING IS CLAIMED BEFORE IT IS SENT
-- ===========================================================================
-- WHY.
--
-- Migration 073 built `calendar_mailings` as the stamp against sending the monthly email twice,
-- and said in its own comment that the shape was "the job's to settle in step 11". This is step
-- 11, and the job settles it: **the row is written BEFORE the send, not after.**
--
-- The order matters more than it looks. The job runs for every company on the 1st, and the thing
-- that must never happen is a second email about the same month. If the row were written after a
-- successful send, then a crash, a timeout or a retry between sending and writing leaves no
-- stamp — and the next run sends again. Claiming first makes the UNIQUE (company_id, month) index
-- the arbiter: the second attempt gets 23505 and stops, whatever happened to the first.
--
-- 073's columns cannot express that, and this migration is only what the order costs:
--
--   · `sent_at` is `not null default now()`, so a row written as a CLAIM would stamp itself as
--     sent at the moment nothing had been sent. It becomes nullable with no default, and the job
--     stamps it when Resend has accepted the message. **A row with sent_at null is a claim that
--     did not finish**, which is a thing an operator can find; a row stamped at claim time is a
--     lie that nobody can.
--   · `error` is new: when the send fails, the row says why, and the month stays claimed on
--     purpose. A failure that silently frees the claim is a failure that emails everybody twice
--     at the next cron. Clearing it is a human act, and the row is what they would clear.
--
-- NOTHING ELSE. `sent_to` already holds who it went to (073), `month` is already the text the job
-- writes, and the unique constraint is already there and is the whole mechanism.
--
-- READ FROM STAGING BEFORE WRITING THIS (16 October 2026): `calendar_mailings` holds ONE row —
-- `check:live`'s own probe for Test Gamma, month "2026-11" — so the backfill below touches one
-- row and the table is otherwise empty. `information_schema.columns` confirms the five columns
-- 073 created and no others.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. THE CLAIM CAN NOW BE TOLD FROM THE SEND.
--
-- Existing rows are stamped, and they were genuinely sent (nothing else has ever written this
-- table), so dropping the default and the NOT NULL leaves them exactly as they are.
-- ---------------------------------------------------------------------------
alter table public.calendar_mailings alter column sent_at drop default;
alter table public.calendar_mailings alter column sent_at drop not null;

-- ---------------------------------------------------------------------------
-- 2. WHY IT DID NOT GO, WHEN IT DID NOT GO.
-- ---------------------------------------------------------------------------
alter table public.calendar_mailings add column if not exists error text;

comment on table public.calendar_mailings is
  'One row per company per month, written by the monthly email job as a CLAIM before the send '
  '(Calendar step 11). UNIQUE (company_id, month) is what stops a second email about the same '
  'month: the second attempt is refused with 23505 and skips. sent_at null means the claim was '
  'taken and the send did not finish; `error` says why. Migrations 073 and 077.';
comment on column public.calendar_mailings.sent_at is
  'When Resend accepted the message. NULL while the month is claimed and nothing has been sent.';
comment on column public.calendar_mailings.error is
  'The send failure, as the provider gave it. The month stays claimed: freeing it automatically '
  'would email every person at the company twice at the next cron.';

-- ===========================================================================
-- 3. VERIFY — AND EVERY CHECK HERE TRIES TO BREAK SOMETHING.
--
-- `CLAUDE.md` §3.7: a constraint nobody has tried to break is a comment. The one that matters is
-- the unique index, and §4 below claims a month twice on purpose.
-- ===========================================================================
do $$
declare
  co   uuid;
  coB  uuid;
  n    int;
  got  text;
  r    record;
begin
  insert into public.companies (name) values ('077 probe company A') returning id into co;
  insert into public.companies (name) values ('077 probe company B') returning id into coB;

  -- ---- 4. THE CLAIM, AND THE SECOND ONE THAT MUST FAIL. ----
  -- A row with NO sent_at is now legal: that is the claim.
  insert into public.calendar_mailings (company_id, month) values (co, '2026-11');
  select sent_at, error into r from public.calendar_mailings where company_id = co and month = '2026-11';
  if r.sent_at is not null then
    raise exception 'MIGRATION 077 FAILED: a claim stamped itself as sent (%); the default is still there.', r.sent_at;
  end if;

  got := null;
  begin
    insert into public.calendar_mailings (company_id, month) values (co, '2026-11');
    raise exception 'MIGRATION 077 FAILED: the same company and month were claimed twice — that is two emails.';
  exception when unique_violation then
    got := sqlstate;
  end;
  if got <> '23505' then
    raise exception 'MIGRATION 077 FAILED: the second claim was refused with %, not 23505.', coalesce(got, '<nothing>');
  end if;

  -- ---- 5. THE SAME COMPANY, THE NEXT MONTH, IS A DIFFERENT CLAIM. ----
  insert into public.calendar_mailings (company_id, month) values (co, '2026-12');
  -- And another company's November is its own.
  insert into public.calendar_mailings (company_id, month) values (coB, '2026-11');
  select count(*) into n from public.calendar_mailings where company_id in (co, coB);
  if n <> 3 then
    raise exception 'MIGRATION 077 FAILED: expected 3 claims across two companies and two months, found %.', n;
  end if;

  -- ---- 6. THE SEND STAMPS THE ROW IT CLAIMED. ----
  update public.calendar_mailings
     set sent_at = now(), sent_to = array['someone@example.com', 'other@example.com']
   where company_id = co and month = '2026-11';
  select sent_at, cardinality(sent_to) as to_count into r
    from public.calendar_mailings where company_id = co and month = '2026-11';
  if r.sent_at is null or r.to_count <> 2 then
    raise exception 'MIGRATION 077 FAILED: the send did not stamp its own row (sent_at %, recipients %).',
      coalesce(r.sent_at::text, '<null>'), r.to_count;
  end if;

  -- ---- 7. A FAILURE IS RECORDED AND THE MONTH STAYS CLAIMED. ----
  update public.calendar_mailings set error = 'Resend: 403 domain not verified'
   where company_id = coB and month = '2026-11';
  select sent_at, error into r from public.calendar_mailings where company_id = coB and month = '2026-11';
  if r.sent_at is not null or r.error is null then
    raise exception 'MIGRATION 077 FAILED: a failed send reads as sent_at=% error=%.',
      coalesce(r.sent_at::text, '<null>'), coalesce(r.error, '<null>');
  end if;
  -- And the claim still refuses a second attempt, which is the point of recording rather than deleting.
  got := null;
  begin
    insert into public.calendar_mailings (company_id, month) values (coB, '2026-11');
    raise exception 'MIGRATION 077 FAILED: a failed month could be claimed again — that is a double send.';
  exception when unique_violation then got := sqlstate; end;
  if got <> '23505' then
    raise exception 'MIGRATION 077 FAILED: re-claiming a failed month raised %, not 23505.', got;
  end if;

  -- ---- 8. THE COLUMNS READ BACK AS INTENDED. ----
  select is_nullable, column_default into r from information_schema.columns
   where table_schema = 'public' and table_name = 'calendar_mailings' and column_name = 'sent_at';
  if r.is_nullable <> 'YES' or r.column_default is not null then
    raise exception 'MIGRATION 077 FAILED: sent_at is nullable=%, default=%.', r.is_nullable, coalesce(r.column_default, '<none>');
  end if;
  select data_type, is_nullable into r from information_schema.columns
   where table_schema = 'public' and table_name = 'calendar_mailings' and column_name = 'error';
  if r.data_type <> 'text' or r.is_nullable <> 'YES' then
    raise exception 'MIGRATION 077 FAILED: error is % / nullable=%.', r.data_type, r.is_nullable;
  end if;

  -- ---- 9. GRANTS, READ BACK, ALL EIGHT RIGHTS, BOTH ROLES (`CLAUDE.md` §3.6). ----
  -- This migration grants nothing. The table is written by the job under the service role and a
  -- person may only READ their own company's history, which is 073's grant and must not move.
  declare v text;
  begin
    foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
      if has_table_privilege('anon', 'public.calendar_mailings', v) then
        raise exception 'MIGRATION 077 FAILED: anon holds % on calendar_mailings.', v;
      end if;
    end loop;
    if not has_table_privilege('authenticated', 'public.calendar_mailings', 'SELECT') then
      raise exception 'MIGRATION 077 FAILED: authenticated lost SELECT on calendar_mailings.';
    end if;
    foreach v in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
      if has_table_privilege('authenticated', 'public.calendar_mailings', v) then
        raise exception 'MIGRATION 077 FAILED: authenticated holds % on calendar_mailings.', v;
      end if;
    end loop;
  end;

  -- ---- 10. NO REAL ROW WAS CHANGED BY THIS MIGRATION. ----
  -- Every row that existed before it was sent, and must still read as sent.
  select count(*) into n from public.calendar_mailings
   where company_id not in (co, coB) and sent_at is null;
  if n <> 0 then
    raise exception 'MIGRATION 077 FAILED: % existing mailing row(s) now read as unsent.', n;
  end if;

  -- ---- CLEAN UP, BY ID. ----
  delete from public.calendar_mailings where company_id in (co, coB);
  delete from public.companies where id in (co, coB);

  raise notice 'MIGRATION 077 OK: a claim may be written unsent and the same company+month is '
               'refused with 23505; another month and another company are their own claims; a send '
               'stamps sent_at and its recipients; a failure records why and the month stays '
               'claimed; grants unmoved; no existing row reads as unsent.';
end $$;

commit;
