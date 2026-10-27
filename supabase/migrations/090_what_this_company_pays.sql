-- =================================================================================================
-- MIGRATION 090 — WHAT THIS COMPANY ACTUALLY PAYS.
--
-- My Account step 20, the fourth finding from the owner's own card walk. `DECISIONS.md` §221.
--
-- *** THE PAGE STATED THE LIST PRICE AS FACT, AND A DISCOUNTED CUSTOMER MADE IT A LIE. ***
--
-- `FOUNDER100` (100% off, forever) went through Checkout correctly: $0 total, no card form, a live
-- subscription. The Billing tab then said, of that company:
--
--     Plan     $199 a month
--     Status   $199 a month, charged to the card below.
--     Card     No card yet                                    [Add a card]
--
-- Three false statements in one card. They will never be charged $199; there is no card below; and
-- nothing will ever be charged to one. §216 A had already flagged the $199 as this page's one
-- unguarded claim — a constant here, Stripe's truth elsewhere — and this is that claim meeting a
-- discount. For a PARTIALLY discounted customer it is worse, because the number is plausible.
--
-- ---- WHY THE AMOUNT IS A MIRRORED COLUMN AND NOT A CALCULATION ----------------------------------
--
-- The tempting fix is arithmetic: list price × (1 − percent_off/100). It is wrong the moment
-- anything else is true — tax, a credit balance on the customer, two discounts, an `amount_off`
-- coupon in another currency, a proration. Each of those is Stripe's to compute and ours to read.
--
-- So the amount comes from Stripe's own answer to "what is the next invoice": `invoices.createPreview
-- ({ subscription })`, whose `total`/`amount_due` IS what will be charged. Read from the sandbox on
-- 27 October 2026, on the real FOUNDER100 subscription:
--
--     subtotal 19900   total 0   amount_due 0 usd
--     total_discount_amounts [{"amount":19900,"discount":"di_1UVET1Dfr228eUmO4QqqdR8E"}]
--
-- *** AND IT IS A COLUMN AND NOT A PAGE-LOAD CALL, WHICH IS THE WHOLE POINT OF THE MIRROR (§213). ***
-- Calling Stripe to draw a page would put a network round trip, and a Stripe outage, in front of
-- every Billing tab. The preview is read ONCE PER EVENT, by the webhook and by the reconcile, through
-- the same mapping both already share (`columnsFromFacts`). The page reads columns, as it always has.
--
-- ---- WHAT STRIPE REALLY GIVES, READ OFF THE OBJECT RATHER THAN RECALLED --------------------------
--
-- Two shapes here would have been written wrong from memory of an older API, and both were confirmed
-- against the live subscription on 27 October 2026 (`stripe@23.0.0`, API `2026-09-30.endive`):
--
--   · THE SUBSCRIPTION HAS `discounts`, AN ARRAY — not `discount`. It needs `expand[]=discounts`,
--     or every element is an id string.
--   · *** A `Discount` HAS NO TOP-LEVEL `coupon`. *** It is `discount.source.coupon`, and
--     `expand: ['discounts']` alone leaves THAT an id string — checked, it came back as the bare
--     `"f4DDuTXd"`. The expand must be `discounts.source.coupon`. This is §217 D's defect exactly:
--     an expand path that is one level too shallow reads as a missing value, not as an error.
--   · The coupon carries the words: `name` ("FOUNDER100"), `percent_off` (100) or `amount_off`,
--     `duration` (`forever` | `once` | `repeating`) and `duration_in_months`.
--   · `discount.end` is a timestamp ONLY for `repeating`. **For `once` and `forever` it is null** —
--     so those two are told apart by `coupon.duration` and by nothing else. That matters: `once`
--     zeroes the first charge and nothing after it, which is the hole §217 named and left open.
--   · The Checkout promotion code landed on the SUBSCRIPTION (`customer.discount` was null). A
--     coupon applied to a customer in the Dashboard lands on the customer instead, so both are read,
--     subscription first — the same two-source shape as the card line.
--
-- ---- NO BACKFILL, NO DEFAULT --------------------------------------------------------------------
--
-- Nothing is known about any existing company's next charge or discount, and nothing may be invented.
-- NULL means "Stripe has not told us", which is true of every row today; the webhook or a reconcile
-- fills each company's on its next event. 087's no-op backfill (repaired by 088) is the standing
-- reason there is no DEFAULT on any of these: an `ADD COLUMN` with a non-volatile default stores one
-- folded value for every existing row, and check 2 below is what proves none was.
--
-- ⚠ AND NONE OF THESE DECIDES ANYTHING ABOUT ACCESS. `lib/billing.ts` `accessFor` does not read them
-- and must not. A company on a 100% discount has a live subscription, and THAT is what gives it
-- access, exactly as before (decision 11). These eight columns are for the words on the page.
-- =================================================================================================

-- ---- 1. THE COLUMNS. -----------------------------------------------------------------------------
-- Two about the money, six about the discount. Explicit columns rather than one jsonb blob, for the
-- reason the other nine are explicit: `scripts/check-schema-contracts.js` validates a column name
-- inside a query string against the generated types, and it cannot see into a jsonb path. "Which
-- companies are on a discount that ends next month" is also a query, not a scan.

alter table public.companies add column if not exists next_charge_amount_cents  integer;
alter table public.companies add column if not exists next_charge_currency      text;
alter table public.companies add column if not exists discount_name             text;
alter table public.companies add column if not exists discount_percent_off      numeric;
alter table public.companies add column if not exists discount_amount_off_cents integer;
alter table public.companies add column if not exists discount_duration         text;
alter table public.companies add column if not exists discount_months           integer;
alter table public.companies add column if not exists discount_ends_at          timestamptz;

comment on column public.companies.next_charge_amount_cents is
  'What Stripe says the NEXT invoice totals, in the smallest currency unit — mirrored from '
  '`invoices.createPreview({ subscription }).total`, which is Stripe''s own answer to "what will be '
  'charged" and therefore already includes every discount, tax, credit and proration. 0 is a real '
  'and common value (a 100%-off coupon). NULL means we could not establish it — a canceled '
  'subscription has no upcoming invoice at all (`invoice_upcoming_none`) — and NULL must never be '
  'drawn as a price. Written ONLY by the service role, from app/api/stripe/webhook and '
  '/api/billing/reconcile, through lib/stripeWebhook.ts columnsFromFacts. It decides NOTHING about '
  'access (lib/billing.ts accessFor does not read it). Migration 090.';

comment on column public.companies.next_charge_currency is
  'The three-letter ISO currency of `next_charge_amount_cents`, lower case, as Stripe sends it '
  '("usd"). Kept beside the amount because an amount without its currency cannot be formatted and '
  'must not be assumed. NULL whenever the amount is NULL. Migration 090.';

comment on column public.companies.discount_name is
  'The coupon''s own `name` as shown to customers ("FOUNDER100"), from '
  '`subscription.discounts[].source.coupon.name`, or the coupon id when it has no name. NULL means '
  'no discount applies — and that null is load-bearing: it is how removing a coupon in the Stripe '
  'portal reaches the page, so it is written even when null, exactly as cancel_at is (089). '
  'Migration 090.';

comment on column public.companies.discount_percent_off is
  'The coupon''s `percent_off` (100 for "100% off"), or NULL when the coupon takes off a fixed '
  'amount instead. A coupon has one or the other, never both — Stripe''s own rule. Migration 090.';

comment on column public.companies.discount_amount_off_cents is
  'The coupon''s `amount_off` in the smallest currency unit, or NULL when the coupon is a '
  'percentage. The currency it is denominated in is the coupon''s, which for this product is '
  'always the price''s; `next_charge_amount_cents` is the figure to trust either way. Migration 090.';

comment on column public.companies.discount_duration is
  'Stripe''s own word, verbatim and un-translated: `forever`, `once` or `repeating`. *** IT IS THE '
  'ONLY THING THAT TELLS `once` FROM `forever`, because discount.end is null for both. *** `once` '
  'zeroes one charge and nothing after it, which is the hole DECISIONS §217 named ("forever coupons '
  'only") and the reason this column exists rather than being inferred from a date. Text and not an '
  'enum, for the reason subscription_status is text (087): a word Stripe invents later must be '
  'recordable. Migration 090.';

comment on column public.companies.discount_months is
  'The coupon''s `duration_in_months` when `discount_duration` is `repeating` — the "for 6 months" '
  'in the sentence. NULL for `forever` and `once`. Migration 090.';

comment on column public.companies.discount_ends_at is
  'The date the discount stops, mirrored from the DISCOUNT''s own `end` (not the coupon''s). Set '
  'only for a `repeating` coupon; NULL for `forever` and `once`, which Stripe does not date. It is '
  'the date a full charge resumes, so it is what the Billing tab counts down to when it asks a '
  'discounted customer for a card. Migration 090.';

-- ---- 2. GRANTS: NONE ADDED, AND NONE NEEDED. -----------------------------------------------------
-- The same argument as 089's. `companies` carries its grants from 004/068 and 087: `authenticated`
-- holds a table-wide SELECT (which is what draws the Billing tab) and the service role holds the
-- writes. A column added to an existing table inherits the TABLE's privileges, so there is nothing
-- to grant and nothing to revoke — and `CLAUDE.md` §3.6's revoke-then-grant rule is about CREATING a
-- table, which this is not. Check 4 reads the grants back rather than asserting this from reasoning.

do $$
declare
  n    bigint;
  co   uuid;
  col  text;
  cols text[] := array['next_charge_amount_cents', 'next_charge_currency', 'discount_name',
                       'discount_percent_off', 'discount_amount_off_cents', 'discount_duration',
                       'discount_months', 'discount_ends_at'];
  ends timestamptz := now() + interval '6 months';
begin
  -- ---- 1. ALL EIGHT EXIST, NULLABLE, WITH NO DEFAULT, AND WITH THE TYPES THE CODE ASSUMES. ----
  foreach col in array cols loop
    select count(*) into n
      from information_schema.columns
     where table_schema = 'public' and table_name = 'companies' and column_name = col
       and is_nullable = 'YES' and column_default is null;
    if n <> 1 then
      raise exception 'MIGRATION 090 FAILED: companies.% is not a single nullable column with no default (found %).', col, n;
    end if;
  end loop;

  foreach col in array array['next_charge_amount_cents', 'discount_amount_off_cents', 'discount_months'] loop
    if (select data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'companies' and column_name = col) <> 'integer' then
      raise exception 'MIGRATION 090 FAILED: companies.% is not integer.', col;
    end if;
  end loop;

  foreach col in array array['next_charge_currency', 'discount_name', 'discount_duration'] loop
    if (select data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'companies' and column_name = col) <> 'text' then
      raise exception 'MIGRATION 090 FAILED: companies.% is not text.', col;
    end if;
  end loop;

  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'companies' and column_name = 'discount_percent_off') <> 'numeric' then
    raise exception 'MIGRATION 090 FAILED: companies.discount_percent_off is not numeric. A percentage can be 33.33.';
  end if;

  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'companies' and column_name = 'discount_ends_at') <> 'timestamp with time zone' then
    raise exception 'MIGRATION 090 FAILED: companies.discount_ends_at is not timestamptz.';
  end if;

  -- ---- 2. NOTHING WAS BACKFILLED. ----
  -- 087's lesson. There is no default on any of the eight, so `attmissingval` has nothing to fold in
  -- and no existing row may hold a value. Asserted, because that is the exact mistake 088 repairs.
  select count(*) into n from public.companies
   where next_charge_amount_cents is not null or next_charge_currency is not null
      or discount_name is not null or discount_percent_off is not null
      or discount_amount_off_cents is not null or discount_duration is not null
      or discount_months is not null or discount_ends_at is not null;
  if n <> 0 then
    raise exception 'MIGRATION 090 FAILED: % company(ies) already hold one of the eight. Nothing should have been backfilled.', n;
  end if;

  -- ---- 3. *** THEY ROUND-TRIP A REAL DISCOUNT, AND CHECK 2'S QUERY CAN SEE IT. *** ----
  -- Checks 1 and 2 are shape and absence. An absence proved by a query that cannot see a presence is
  -- worth nothing (`CLAUDE.md` §9a; it is how 087's backfill passed its own test). So: write the
  -- partial-discount case end to end, read every field back, confirm check 2 would have caught it,
  -- then clear to NULL — which is the "coupon removed in the portal" path.
  insert into public.companies (name, next_charge_amount_cents, next_charge_currency,
                                discount_name, discount_percent_off, discount_duration,
                                discount_months, discount_ends_at)
       values ('090 probe company', 9950, 'usd', 'HALFYEAR', 50, 'repeating', 6, ends)
    returning id into co;

  select count(*) into n from public.companies
   where id = co and next_charge_amount_cents = 9950 and next_charge_currency = 'usd'
     and discount_name = 'HALFYEAR' and discount_percent_off = 50
     and discount_duration = 'repeating' and discount_months = 6 and discount_ends_at = ends;
  if n <> 1 then
    raise exception 'MIGRATION 090 FAILED: a partial discount written to a probe row did not read back unchanged.';
  end if;

  -- ...and check 2's query would have SEEN it, which is what makes check 2 mean anything.
  select count(*) into n from public.companies
   where next_charge_amount_cents is not null or discount_name is not null;
  if n <> 1 then
    raise exception 'MIGRATION 090 FAILED: the probe row is invisible to check 2''s query, so check 2 proves nothing.';
  end if;

  -- ...and ZERO is storable and is not mistaken for absence. This is the FOUNDER100 case, and a
  -- column that could not tell 0 from NULL would make "nothing to pay" indistinguishable from
  -- "we do not know what you pay" — which is the whole distinction this migration is for.
  update public.companies set next_charge_amount_cents = 0 where id = co;
  select count(*) into n from public.companies where id = co and next_charge_amount_cents = 0;
  if n <> 1 then
    raise exception 'MIGRATION 090 FAILED: a next charge of 0 did not read back as 0.';
  end if;
  select count(*) into n from public.companies where id = co and next_charge_amount_cents is null;
  if n <> 0 then
    raise exception 'MIGRATION 090 FAILED: a next charge of 0 reads as NULL. Nothing to pay would be indistinguishable from not knowing.';
  end if;

  -- ...and they all clear back to NULL, which is the coupon-removed path.
  update public.companies
     set next_charge_amount_cents = null, next_charge_currency = null, discount_name = null,
         discount_percent_off = null, discount_amount_off_cents = null, discount_duration = null,
         discount_months = null, discount_ends_at = null
   where id = co;
  select count(*) into n from public.companies
   where id = co and next_charge_amount_cents is null and discount_name is null
     and discount_duration is null and discount_ends_at is null;
  if n <> 1 then
    raise exception 'MIGRATION 090 FAILED: the eight could not be cleared back to NULL.';
  end if;

  delete from public.companies where id = co;

  -- ---- 4. THE GRANTS ARE THE TABLE'S OWN — read, not reasoned. ----
  foreach col in array cols loop
    if not has_column_privilege('authenticated', 'public.companies', col, 'SELECT') then
      raise exception 'MIGRATION 090 FAILED: authenticated cannot SELECT %, so the Billing tab cannot read it.', col;
    end if;
    if has_column_privilege('authenticated', 'public.companies', col, 'UPDATE') then
      raise exception 'MIGRATION 090 FAILED: authenticated can UPDATE %. Only Stripe decides what a company pays.', col;
    end if;
    if not has_column_privilege('service_role', 'public.companies', col, 'UPDATE') then
      raise exception 'MIGRATION 090 FAILED: service_role cannot UPDATE %, so the webhook cannot mirror it.', col;
    end if;
    if has_column_privilege('anon', 'public.companies', col, 'SELECT') then
      raise exception 'MIGRATION 090 FAILED: anon can SELECT %.', col;
    end if;
  end loop;

  raise notice 'MIGRATION 090 OK: eight nullable columns with no default, no row backfilled, a partial discount round-trips, 0 is storable and is not NULL, all eight clear to NULL, and the grants are the table''s own.';
end $$;
