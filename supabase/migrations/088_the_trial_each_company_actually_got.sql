-- =================================================================================================
-- MIGRATION 088 — THE TRIAL EACH COMPANY ACTUALLY GOT.
--
-- *** 087's BACKFILL WAS A NO-OP, AND THIS IS THE REPAIR. ***
--
-- My Account step 17. Found at the step 17 read-back, not by review: the fixture company's trial
-- STARTED on 14 October and its `trial_ends_at` said 6 November. Fourteen days from 14 October is
-- 28 October. Every one of staging's eleven companies was out by the same shape — the six seeded on
-- 14 October by nine days, the five walk-test companies of 22 October by one — and every one of
-- them was out in the SAME direction, to the SAME date: 6 November, which is fourteen days from the
-- moment migration 087 ran.
--
-- ---- WHY, READ FROM THE CATALOG AND NOT GUESSED ------------------------------------------------
--
-- 087 §1 added the column WITH its default, and §2 then tried to backfill:
--
--     alter table public.companies add column if not exists trial_ends_at timestamptz
--       default (now() + interval '14 days');
--     ...
--     update public.companies
--        set trial_ends_at = coalesce(trial_started_at, created_at, now()) + interval '14 days'
--      where trial_ends_at is null;        -- <-- MATCHED ZERO ROWS
--
-- Since PostgreSQL 11, `ADD COLUMN` with a NON-VOLATILE default does not rewrite the table: it
-- stores ONE value and every pre-existing row reads it. `now()` is STABLE, not volatile, so it was
-- evaluated ONCE during the ALTER. Read out of `pg_attribute` on 23 October, after the fact:
--
--     attname        atthasmissing   attmissingval
--     trial_ends_at  true            {"2026-11-06 22:29:47.114886+00"}
--
-- A single constant, for all eleven rows. So by the time §2's UPDATE ran there was no row left with
-- a NULL `trial_ends_at`, its WHERE matched nothing, and `alter column ... set not null` then
-- succeeded for the wrong reason — the column was already total, filled with one timestamp.
--
-- ---- AND WHY 087's OWN SELF-TEST DID NOT CATCH IT ----------------------------------------------
--
-- Check 10 compared `trial_ends_at` against `trial_started_at + 14 days` and PASSED. It was right
-- about what it tested and blind to what broke: it tested a probe row it had just INSERTED, where
-- the default genuinely is correct because `trial_started_at` is also `now()`. *** NOTHING IN IT
-- LOOKED AT A ROW THAT EXISTED BEFORE THE MIGRATION. *** That is `CLAUDE.md` §9a's rule arriving
-- from a direction it is not usually quoted in: the check could see a presence, and proved one, and
-- the presence it proved was not the claim the migration was making. A backfill is only tested by
-- looking at a row that needed backfilling.
--
-- ---- THE ORDER THAT WOULD HAVE BEEN RIGHT, FOR THE NEXT PERSON ---------------------------------
--
--     add column (NO default)  ->  backfill per row  ->  set default  ->  set not null
--
-- The default itself is CORRECT and is left alone. `084:95` inserts a company naming
-- `trial_started_at = now()` and not `trial_ends_at`, so a NEW company wants exactly
-- `now() + 14 days`. Only the pre-existing rows were wrong.
--
-- ---- WHAT THIS MIGRATION WILL NOT TOUCH --------------------------------------------------------
--
-- *** A TRIAL END STRIPE OWNS. *** Once a card exists Stripe owns that date (087's header: the
-- 48-hour floor can move it later, and an extension typed in the Dashboard moves it again), and the
-- webhook mirrors it. A repair that recomputed it from `trial_started_at` would overwrite Stripe
-- with our arithmetic and point the mirror the wrong way. So the UPDATE is scoped to rows that have
-- never had a subscription, and §3's check 4 proves a Stripe-owned row survives it untouched.
-- Today on staging that scope excludes nothing — 11 companies, 0 with any subscription — which is
-- precisely why the guard goes in now rather than when it would be load-bearing.
-- =================================================================================================


-- =================================================================================================
-- 1. GIVE EACH COMPANY THE FOURTEEN DAYS FROM WHEN ITS OWN CLOCK STARTED.
--
-- `coalesce` two deep for the same reason 087 and 082:100 did it: `trial_started_at` is nullable
-- (082 backfilled it but did not close it). `now()` is NOT the third fallback here, deliberately —
-- a row with neither stamp would get today + 14 days, which is the very value this migration exists
-- to remove. Such a row does not exist (checked: 0 of 11), and if one ever did it should be found
-- rather than quietly given a fresh trial.
-- =================================================================================================

update public.companies
   set trial_ends_at = coalesce(trial_started_at, created_at) + interval '14 days'
 where stripe_subscription_id is null
   and subscription_status is null
   and coalesce(trial_started_at, created_at) is not null
   and trial_ends_at <> coalesce(trial_started_at, created_at) + interval '14 days';


comment on column public.companies.trial_ends_at is
  'When the free trial stops. Seeded at `trial_started_at` + 14 days and NOT NULL, so the access '
  'rule can never meet a null. *** AFTER A CARD IS ADDED, STRIPE OWNS THIS NUMBER AND WE MIRROR IT. *** '
  'Stripe refuses a Checkout trial_end less than 48 hours out, so a card added on day 13 produces a '
  'real trial end up to two days later than ours, and an extension typed in the Stripe Dashboard '
  'moves it again. That is why this is a column and not `trial_started_at + 14 days`: '
  '`trial_started_at` must go on truthfully saying when the clock STARTED (082), and only a separate '
  'column can hold an end that something else decided. *** AND THE DEFAULT IS FOR A NEW ROW ONLY: *** '
  'migration 087 added this column WITH that default, which PostgreSQL applied to every existing row '
  'as ONE constant (`now()` is stable, so it was folded at DDL time) — so 087''s backfill matched no '
  'rows and eleven companies held a trial end fourteen days from the migration rather than from their '
  'own start. Migration 088 repaired them. See 088''s header.';


-- =================================================================================================
-- 2. AND THE SELF-TEST — 4 CHECKS, AND THE FIRST ONE IS PROVED ABLE TO FAIL.
-- =================================================================================================

do $$
declare
  n      bigint;
  co     uuid;
  co2    uuid;
  tend   timestamptz;
  tstart timestamptz;
  kept   timestamptz;
begin
  -- ---- 1. NO COMPANY'S TRIAL END DISAGREES WITH ITS OWN START ANY MORE. ----
  select count(*) into n
    from public.companies
   where stripe_subscription_id is null
     and subscription_status is null
     and coalesce(trial_started_at, created_at) is not null
     and trial_ends_at <> coalesce(trial_started_at, created_at) + interval '14 days';
  if n <> 0 then
    raise exception 'MIGRATION 088 FAILED: % company(ies) still hold a trial end that is not fourteen days from when their trial started.', n;
  end if;

  -- ---- 2. *** AND THAT CHECK CAN SEE A DISAGREEMENT — PROVED BY MAKING ONE. *** ----
  -- This is the check 087 did not have. Check 1 above is an ABSENCE, and an absence proved by a
  -- query that cannot see a presence is worth nothing (`CLAUDE.md` §9a) — which is exactly how
  -- 087's backfill passed its own test. So: write a wrong value, confirm check 1's query FINDS it,
  -- then put it back.
  insert into public.companies (name, trial_started_at)
  values ('088 probe company', now() - interval '30 days') returning id into co;

  -- The insert took the DEFAULT, so this row is now 14 days from NOW while its trial started 30
  -- days ago — the very shape this migration repaired. Check 1's query must see it.
  select count(*) into n
    from public.companies
   where stripe_subscription_id is null
     and subscription_status is null
     and coalesce(trial_started_at, created_at) is not null
     and trial_ends_at <> coalesce(trial_started_at, created_at) + interval '14 days';
  if n <> 1 then
    raise exception 'MIGRATION 088 FAILED: a deliberately wrong trial end was NOT found by check 1 (saw % row(s)) — so check 1 proves nothing.', n;
  end if;

  -- ---- 3. A NEW COMPANY IS STILL RIGHT, BECAUSE THE DEFAULT IS STILL RIGHT. ----
  -- 087's check 10, kept: 084:95 names `trial_started_at = now()` and not `trial_ends_at`, so the
  -- default must go on being fourteen days from now. This migration must not have broken that in
  -- the course of fixing the rows the default was wrong FOR.
  insert into public.companies (name, trial_started_at)
  values ('088 probe company two', now()) returning id into co2;
  select trial_ends_at, trial_started_at into tend, tstart from public.companies where id = co2;
  if tstart is null then
    raise exception 'MIGRATION 088 FAILED: the probe lost trial_started_at, so this check proved nothing.';
  end if;
  if abs(extract(epoch from (tend - (tstart + interval '14 days')))) > 60 then
    raise exception 'MIGRATION 088 FAILED: a NEW company''s trial_ends_at (%) is not trial_started_at + 14 days (%).',
      tend, tstart + interval '14 days';
  end if;

  -- ---- 4. *** A TRIAL END STRIPE OWNS IS NOT RECOMPUTED. *** ----
  -- The mirror's direction, enforced. Give the probe a subscription and a trial end that does NOT
  -- agree with its start — which is what the 48-hour floor or a Dashboard extension produces — and
  -- re-run §1's UPDATE. It must leave the row alone.
  update public.companies
     set stripe_subscription_id = 'sub_088probe',
         subscription_status    = 'trialing',
         trial_ends_at          = now() + interval '3 days'
   where id = co;
  select trial_ends_at into kept from public.companies where id = co;

  update public.companies
     set trial_ends_at = coalesce(trial_started_at, created_at) + interval '14 days'
   where stripe_subscription_id is null
     and subscription_status is null
     and coalesce(trial_started_at, created_at) is not null
     and trial_ends_at <> coalesce(trial_started_at, created_at) + interval '14 days';

  if (select trial_ends_at from public.companies where id = co) <> kept then
    raise exception 'MIGRATION 088 FAILED: a trial end Stripe owns was recomputed from trial_started_at — the mirror is pointing the wrong way.';
  end if;

  -- ---- CLEAN UP, and verify by counting rather than by trusting the delete. ----
  delete from public.companies where id in (co, co2);
  select count(*) into n from public.companies where name like '088 probe company%';
  if n <> 0 then
    raise exception 'MIGRATION 088 FAILED: the probe companies could not be cleaned up.';
  end if;

  raise notice 'MIGRATION 088 OK: every company whose trial end Stripe does not own now holds '
    'fourteen days from when its own clock started — and that check was proved able to fail, which '
    'is the check 087 did not have. A new company is still fourteen days from now (the default was '
    'never the bug). A trial end Stripe owns survives the repair untouched. My Account step 17.';
end $$;
