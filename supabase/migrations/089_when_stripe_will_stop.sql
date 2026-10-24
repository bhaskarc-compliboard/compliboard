-- =================================================================================================
-- MIGRATION 089 — WHEN STRIPE WILL STOP.
--
-- My Account step 20, the third finding from the owner's own card walk. `DECISIONS.md` §219.
--
-- *** CANCELLING DOES NOT CHANGE THE STATUS, AND WE WERE READING THE STATUS. ***
--
-- Cancelling through Stripe's billing portal sets `cancel_at_period_end` on the subscription.
-- Stripe then keeps `status` exactly as it was — `trialing`, or `active` — until the date arrives.
-- Read from the sandbox on 24 October rather than assumed:
--
--     1. created (trialing)      status=trialing  cancel_at_period_end=false  cancel_at=null
--     2. cancel at period end    status=trialing  cancel_at_period_end=true   cancel_at=1794028134
--     3. cleared again           status=trialing  cancel_at_period_end=false  cancel_at=null
--
-- The mirror held none of it, so the Billing tab went on telling somebody who had just cancelled
-- "Trial · 14 days left · Add a card before then and nothing changes on the day" — a page asserting
-- something false about money, which is the single thing this mirror exists to prevent (§6).
--
-- ---- ONE COLUMN, AND IT IS A DATE AND NOT A FLAG ------------------------------------------------
--
-- `cancel_at` carries Stripe's own scheduled end — the SDK's words are "a date in the future at
-- which the subscription will automatically get canceled". A boolean would have been enough to
-- change the wording and not enough to say WHEN, and "you keep everything until then" is the whole
-- of what the person needs to read.
--
-- NOT `canceled_at`, which the SDK warns is "the time of the most recent update request, not the
-- end of the subscription period" — the moment they pressed the button, which is of no use to them.
--
-- ⚠ AND IT DECIDES NOTHING ABOUT ACCESS. `lib/billing.ts` `accessFor` does not read this column and
-- must not: a company that has scheduled a cancellation keeps everything it was promised until the
-- date arrives, and what it may do until then is still decided by `trial_ends_at` and
-- `subscription_status` exactly as before (decision 11). When the date does arrive Stripe moves the
-- status to `canceled` and fires `customer.subscription.deleted`, and THAT is what ends access.
-- This column is for the words on the page, not for the gate.
--
-- ---- NO BACKFILL, AND THAT IS DELIBERATE ---------------------------------------------------------
--
-- Nothing is known about any existing company's scheduled cancellation, and nothing may be invented:
-- NULL means "Stripe has not told us of one", which is true of every row today. The webhook fills it
-- on the next `customer.subscription.created|updated|deleted` for each company — and because
-- `cancel_at` is null on a subscription that is not cancelling, the same mapping CLEARS it when
-- somebody presses "Don't cancel subscription" in the portal. One field, both directions.
--
-- 087's no-op backfill (repaired by 088) is the other reason: an `ADD COLUMN` with a non-volatile
-- default stores one folded value for every existing row. There is no default here at all.
-- =================================================================================================

-- ---- 1. THE COLUMN. ------------------------------------------------------------------------------
alter table public.companies add column if not exists cancel_at timestamptz;

comment on column public.companies.cancel_at is
  'Stripe''s scheduled end for the subscription: the date it will automatically cancel, mirrored '
  'from the subscription''s own `cancel_at`. NULL means no cancellation is scheduled. Written ONLY '
  'by the service role, from app/api/stripe/webhook. It decides NOTHING about access — a company '
  'keeps everything until the date arrives, and what it may do is still decided by trial_ends_at '
  'and subscription_status (lib/billing.ts accessFor, which does not read this). Migration 089.';

-- ---- 2. GRANTS: NONE ADDED, AND NONE NEEDED. -----------------------------------------------------
-- `companies` already carries its grants from 004/068 and 087: `authenticated` holds a table-wide
-- SELECT (which is what draws the Billing tab) and the service role holds the writes. A column added
-- to an existing table inherits the TABLE's privileges, so there is nothing to grant and nothing to
-- revoke — and `CLAUDE.md` §3.6's revoke-then-grant rule is about CREATING a table, which this is
-- not. Check 3 below reads the grants back rather than asserting this from reasoning.

do $$
declare
  n     bigint;
  co    uuid;
  stamp timestamptz := now() + interval '9 days';
begin
  -- ---- 1. THE COLUMN EXISTS, IS NULLABLE, IS timestamptz, AND HAS NO DEFAULT. ----
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'companies' and column_name = 'cancel_at'
     and data_type = 'timestamp with time zone'
     and is_nullable = 'YES'
     and column_default is null;
  if n <> 1 then
    raise exception 'MIGRATION 089 FAILED: companies.cancel_at is not a single nullable timestamptz with no default (found %).', n;
  end if;

  -- ---- 2. EVERY EXISTING ROW IS NULL — NOTHING WAS INVENTED. ----
  -- 087's lesson, inverted: there is no default, so there is nothing for `attmissingval` to fold in
  -- and no row may have acquired a value. Asserted rather than assumed, because that is the exact
  -- mistake 088 exists to repair.
  select count(*) into n from public.companies where cancel_at is not null;
  if n <> 0 then
    raise exception 'MIGRATION 089 FAILED: % company(ies) already hold a cancel_at. Nothing should have been backfilled.', n;
  end if;

  -- ---- 3. *** AND THE COLUMN CAN ACTUALLY HOLD A DATE AND GIVE IT BACK — PROVED BY DOING IT. ***
  -- Checks 1 and 2 are both about shape and absence. An absence proved by a query that cannot see a
  -- presence is worth nothing (`CLAUDE.md` §9a; it is how 087's backfill passed its own test). So:
  -- write a value, read it back, confirm it survived the round trip, and remove the row.
  insert into public.companies (name, cancel_at) values ('089 probe company', stamp) returning id into co;

  select count(*) into n from public.companies where id = co and cancel_at = stamp;
  if n <> 1 then
    raise exception 'MIGRATION 089 FAILED: a cancel_at written to a probe row did not read back as the same instant.';
  end if;

  -- ...and that check 2's query would have SEEN it, which is what makes check 2 meaningful.
  select count(*) into n from public.companies where cancel_at is not null;
  if n <> 1 then
    raise exception 'MIGRATION 089 FAILED: the probe row is not visible to check 2''s query, so check 2 proves nothing.';
  end if;

  -- ...and that it clears back to NULL, which is the "Don't cancel subscription" path.
  update public.companies set cancel_at = null where id = co;
  select count(*) into n from public.companies where id = co and cancel_at is null;
  if n <> 1 then
    raise exception 'MIGRATION 089 FAILED: cancel_at could not be cleared back to NULL.';
  end if;

  delete from public.companies where id = co;

  -- ---- 4. THE GRANTS ARE WHAT THE TABLE ALREADY HAD — read, not reasoned. ----
  -- `authenticated` may SELECT it (the Billing tab reads it through the caller's own client) and
  -- may NOT write it. The service role may write it, as it writes the other eight.
  if not has_column_privilege('authenticated', 'public.companies', 'cancel_at', 'SELECT') then
    raise exception 'MIGRATION 089 FAILED: authenticated cannot SELECT cancel_at, so the Billing tab cannot read it.';
  end if;
  if has_column_privilege('authenticated', 'public.companies', 'cancel_at', 'UPDATE') then
    raise exception 'MIGRATION 089 FAILED: authenticated can UPDATE cancel_at. Only Stripe decides when a subscription ends.';
  end if;
  if not has_column_privilege('service_role', 'public.companies', 'cancel_at', 'UPDATE') then
    raise exception 'MIGRATION 089 FAILED: service_role cannot UPDATE cancel_at, so the webhook cannot mirror it.';
  end if;
  if has_column_privilege('anon', 'public.companies', 'cancel_at', 'SELECT') then
    raise exception 'MIGRATION 089 FAILED: anon can SELECT cancel_at.';
  end if;

  raise notice 'MIGRATION 089 OK: companies.cancel_at is a nullable timestamptz, no row was backfilled, it round-trips a date and clears to NULL, and its grants are the table''s own.';
end $$;
