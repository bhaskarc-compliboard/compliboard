-- =================================================================================================
-- MIGRATION 087 — WHAT STRIPE TELLS US ABOUT A COMPANY'S MONEY.
--
-- My Account step 17 (`docs/ACCOUNT-PLAN.md` part C). ACCOUNT-PLAN decisions 11 and 12, and the
-- owner's decisions of 23 October: one plan for everyone at a company, $199 a month, monthly only;
-- coupons made in Stripe and typed by the customer on Stripe's page; a card may be added from day
-- one and is never required to start; with a card on file the subscription starts by itself on day
-- 15; without one, read-only after the trial; Stripe hosts the card page and the portal.
--
-- *** THIS TABLE IS A MIRROR, AND THE DIRECTION IS STRIPE → US, NEVER THE REVERSE. ***
--
-- That is the same shape as migration 083's main-site mirror, and for the same reason: there are two
-- places that could answer "is this company paying", and only one of them is ever told the truth
-- first. Stripe is where the card is charged, the retry is attempted and the coupon is applied. We
-- hold a copy so that a page can be drawn and an access rule can be evaluated without a network
-- call to Stripe on every request. When the two disagree, Stripe is right and the webhook is the bug.
--
-- Nothing here is ever written by a person, and nothing here is ever written by a route acting as a
-- person. Every one of these columns is written by `/api/stripe/webhook` as the service role, keyed
-- by the Stripe customer id. A person may READ them — that is what draws the Billing tab — and that
-- is all. `authenticated` holds table-wide SELECT on `companies` (083; `docs/SCHEMA.md`), so the
-- read needs no grant and gets none; the eight columns are simply left out of the UPDATE grant,
-- which is where this table has expressed "ours, not theirs" since 082's `library`.
--
-- ---- WHY `trial_ends_at` IS A COLUMN AND NOT `trial_started_at + 14 days` ------------------------
--
-- 082:65 wrote the other plan: "`trial_started_at` is when the clock started, and it is NOT
-- `created_at` … part C's billing has to be able to extend a trial without lying about when the
-- account was made." That reasoning is still right about `created_at` and is now wrong about the
-- trial end, for a reason that comes from Stripe rather than from us:
--
--   `subscription_data.trial_end` on a Checkout Session "Has to be at least 48 hours in the future"
--   (docs.stripe.com/api/checkout/sessions/create, read 23 October 2026).
--
-- So a person who adds a card with less than two days of trial left CANNOT be given their real
-- trial end — Stripe refuses the session. The route asks for `now() + 48 hours` instead, and that
-- person's trial genuinely ends up to two days later than ours said. Stripe then owns the number:
-- an extension typed into the Stripe Dashboard moves it again. A computed `trial_started_at + 14
-- days` cannot hold either value, and the only way to make it hold them would be to move
-- `trial_started_at` to a day the trial did not start — which is the exact lie 082 refused one
-- column over.
--
-- So: `trial_started_at` keeps saying when the clock started, truthfully and for ever.
-- `trial_ends_at` says when it stops, is seeded at 14 days, and is thereafter whatever Stripe says.
-- It is NOT NULL so that the access rule can never meet a null and have to guess.
--
-- ---- WHY `subscription_status` IS `text` AND NOT A POSTGRES ENUM --------------------------------
--
-- *** A DELIBERATE DEPARTURE FROM `CLAUDE.md` §3.7, FLAGGED RATHER THAN TAKEN QUIETLY. ***
-- That rule says enum-like columns use a Postgres ENUM, not TEXT, and it is right about OUR
-- vocabularies: an ENUM makes a wrong value a loud error. This column does not hold our vocabulary.
-- It holds Stripe's, verbatim — one of `incomplete`, `incomplete_expired`, `trialing`, `active`,
-- `past_due`, `canceled`, `unpaid`, `paused` (docs.stripe.com/api/subscriptions/object, read
-- 23 October 2026), and `paused` is itself a value Stripe added after the others. The day Stripe
-- adds a ninth, an ENUM would make the webhook's write FAIL — on a payment event, which is the
-- worst possible moment to drop a fact on the floor. TEXT records what we were told and leaves the
-- judgement to `lib/billing.ts`, where an unrecognised status reads as "not paying" and is visible.
-- NULL means this company has never had a subscription, which is the normal state of a new customer.
--
-- ---- AND THE ONE THING THIS SCHEMA REFUSES TO HOLD ----------------------------------------------
--
-- `card_last4` carries a CHECK of exactly four digits. Not for tidiness: it is decision 12 — "we
-- hold a customer id and a subscription status per company … and never a card number" — written
-- where it cannot be forgotten. A bug that handed this column a full card number would be refused
-- by the database. The CHECK passes on NULL by design (`CLAUDE.md` §3.7): no card is a state, and
-- it is the state every company is in today.
-- =================================================================================================


-- =================================================================================================
-- 1. THE EIGHT COLUMNS.
-- =================================================================================================

alter table public.companies add column if not exists stripe_customer_id     text;
alter table public.companies add column if not exists stripe_subscription_id text;
alter table public.companies add column if not exists subscription_status    text;
alter table public.companies add column if not exists current_period_end     timestamptz;
alter table public.companies add column if not exists payment_failed_at      timestamptz;
alter table public.companies add column if not exists card_brand             text;
alter table public.companies add column if not exists card_last4             text;

-- `trial_ends_at` arrives with its default, because every row that exists and every row the signup
-- function makes must have one. 084:95 inserts `(name, website_url, trial_started_at)` and names
-- nothing else, so the default is what fills this for a new customer — the same way `library` (082)
-- and `industry` (084) are filled. The number 14 appears here AND in `lib/billing.ts`; check 10
-- below is what stops them drifting.
alter table public.companies add column if not exists trial_ends_at timestamptz
  default (now() + interval '14 days');

comment on column public.companies.stripe_customer_id is
  'The Stripe customer for this company (`cus_…`), created once by /api/billing/checkout and then '
  'remembered for ever. *** THIS IS THE JOIN KEY THE WEBHOOK USES. *** Every Stripe event carries '
  'a customer id and nothing else we recognise, so this column is how an event becomes a company. '
  'Unique where set. Written only by the service role. My Account step 17.';

comment on column public.companies.stripe_subscription_id is
  'The current subscription (`sub_…`), or NULL if this company has never subscribed. One plan for '
  'everyone at a company (the owner, 23 Oct), so there is one of these and not a list.';

comment on column public.companies.subscription_status is
  'STRIPE''S OWN WORD for the subscription, verbatim: incomplete, incomplete_expired, trialing, '
  'active, past_due, canceled, unpaid, paused. NULL means never subscribed, which is where every '
  'company starts. Deliberately `text` and not an ENUM, and deliberately without a CHECK: it is '
  'Stripe''s vocabulary, Stripe has added to it before, and a value we do not recognise must be '
  'recordable — an enum would make the webhook fail on a payment event. The judgement about what a '
  'status MEANS is in `lib/billing.ts`, not here. See this migration''s header.';

comment on column public.companies.current_period_end is
  'When the paid period runs out — what the Billing tab shows as the next payment date. *** READ '
  'FROM THE SUBSCRIPTION ITEM, NOT THE SUBSCRIPTION. *** The Stripe Subscription object has no '
  'top-level current_period_end; it lives at items.data[0].current_period_end '
  '(docs.stripe.com/api/subscriptions/object, read 23 Oct 2026). *** NOT READ BY THE ACCESS RULE. *** '
  'It is a date to display; whether a company may ask a question is decided from trial_ends_at, '
  'subscription_status and payment_failed_at. Step 18.';

comment on column public.companies.payment_failed_at is
  'When a payment FIRST failed, starting the 7-day grace of ACCOUNT-PLAN decision 11. Set by '
  'invoice.payment_failed ONLY IF IT IS NULL, so Stripe''s retries do not keep pushing the deadline '
  'out and the grace is seven days from the first failure rather than from the last. Cleared to NULL '
  'by invoice.paid. NULL means nothing is wrong.';

comment on column public.companies.card_brand is
  'The card''s brand as Stripe reports it — "visa", "mastercard" — for the Billing tab''s one line. '
  'NULL means no card on file, which is a normal state from day one to day fourteen.';

comment on column public.companies.card_last4 is
  'The last four digits, for the Billing tab''s one line. *** AND THE CHECK BELOW IS DECISION 12 '
  'WRITTEN INTO THE SCHEMA: the database refuses to hold anything longer, so a bug cannot put a '
  'card number here. *** NULL is allowed and means no card; a CHECK passes on NULL (CLAUDE.md §3.7) '
  'and that is the intent, not an oversight.';

comment on column public.companies.trial_ends_at is
  'When the free trial stops. Seeded at `trial_started_at` + 14 days and NOT NULL, so the access '
  'rule can never meet a null. *** AFTER A CARD IS ADDED, STRIPE OWNS THIS NUMBER AND WE MIRROR IT. *** '
  'Stripe refuses a Checkout trial_end less than 48 hours out, so a card added on day 13 produces a '
  'real trial end up to two days later than ours, and an extension typed in the Stripe Dashboard '
  'moves it again. That is why this is a column and not `trial_started_at + 14 days`: '
  '`trial_started_at` must go on truthfully saying when the clock STARTED (082), and only a separate '
  'column can hold an end that something else decided. See this migration''s header.';


-- The database refuses to hold a card number. Four digits exactly, or nothing.
alter table public.companies drop constraint if exists companies_card_last4_check;
alter table public.companies
  add constraint companies_card_last4_check check (card_last4 ~ '^[0-9]{4}$');


-- =================================================================================================
-- 2. EVERY COMPANY GETS A TRIAL END, AND THEN THE COLUMN CAN BE NOT NULL.
--
-- `coalesce` three deep because `trial_started_at` is NULLABLE (082 backfilled it but did not close
-- it) and `created_at` is nullable too on this schema — 082:100 had the same problem and solved it
-- the same way. A row that somehow has neither gets fourteen days from now, which is the kind
-- reading and keeps the column total.
-- =================================================================================================

update public.companies
   set trial_ends_at = coalesce(trial_started_at, created_at, now()) + interval '14 days'
 where trial_ends_at is null;

alter table public.companies alter column trial_ends_at set not null;


-- =================================================================================================
-- 3. ONE CUSTOMER, ONE COMPANY — AND THE INDEX THE WEBHOOK NEEDS.
--
-- The webhook's only way in is `where stripe_customer_id = <the event's customer>`. Without an index
-- that is a sequential scan on every Stripe event; with a UNIQUE one it is also a promise, that two
-- companies can never be pointed at one Stripe customer. If that ever happened, one company's card
-- would pay for another's access and the webhook would write the wrong row — so it is refused here
-- rather than hoped for. Partial, because NULL is the normal state and many rows hold it.
-- =================================================================================================

create unique index if not exists idx_companies_stripe_customer_id
  on public.companies (stripe_customer_id)
  where stripe_customer_id is not null;


-- =================================================================================================
-- 4. WHO MAY WRITE ANY OF THIS: NOBODY BUT THE SERVICE ROLE.
--
-- There is no GRANT here, and that is the whole statement. 083 revoked table-wide UPDATE on
-- `companies` and granted it back column by column, so a column that is not named is a column a
-- person cannot write — no `if` in a route, no policy, just an absent grant. The eight columns above
-- are not named, so they are closed, and check 3 below proves it rather than assuming it
-- (`CLAUDE.md` §3.6: a grant list says what you added, not what a role holds).
--
-- The re-stated REVOKEs are `CLAUDE.md` §3.6's REVOKE-then-GRANT, which still applies: migration 068
-- fixed `postgres`'s default privileges, but `supabase_admin`'s defaults on `public` still grant both
-- roles everything for objects IT creates, `postgres` cannot change those, and a redundant REVOKE
-- costs nothing. These are ALTER TABLE ADD COLUMN rather than CREATE TABLE, so the defaults should
-- not apply at all — which is a reason to check, not a reason to skip the check.
-- =================================================================================================

revoke all on table public.companies from anon;


-- =================================================================================================
-- 5. WHAT STRIPE TOLD US, AND WHEN — `stripe_events`.
--
-- *** NOT ASKED FOR IN THE BRIEF. IT IS HERE TO BE STRUCK AT THE STOP IF THE OWNER WANTS IT GONE. ***
--
-- Two things make it worth proposing. The first is idempotency, which the brief does ask for: Stripe
-- retries a delivery it did not get a 2xx for, and an event can arrive twice or out of order. The
-- primary defence is in the route's shape rather than in a table — the webhook re-reads the
-- subscription from Stripe and writes its PRESENT state instead of trusting the payload, so a
-- duplicate or a late arrival converges on the same answer. This table is the second defence and the
-- cheap one: the event id is the primary key, so a replay is an insert conflict and a two-line exit.
--
-- The second is `CLAUDE.md` §5. When a customer says "I was charged and the product says I am not
-- paying", the only way to answer is to see what Stripe actually sent and what we did with it. Days
-- later. Without this table that conversation has no evidence in it, and `error` is where a webhook
-- that failed says so instead of failing silently.
--
-- `payload` is the event as received. It is a billing record, not a card: Stripe does not put a card
-- number in an event, and §3.5 is about keys in code — but it is worth saying out loud that this
-- column is readable by nobody but the service role.
--
-- `company_id` is NULLABLE on purpose. An event can arrive for a Stripe customer we cannot map to a
-- company — a customer made by hand in the Dashboard, or one whose company was deleted. That event
-- must still be recorded, with the reason, rather than dropped because it did not fit.
-- =================================================================================================

create table if not exists public.stripe_events (
  id            text primary key,
  type          text not null,
  company_id    uuid references public.companies(id) on delete cascade,
  stripe_customer_id text,
  payload       jsonb not null,
  handled       boolean not null default false,
  error         text,
  created_at    timestamptz not null default now()
);

comment on table public.stripe_events is
  'Every event /api/stripe/webhook accepted from Stripe, keyed by STRIPE''S OWN EVENT ID so a '
  'redelivery is a primary-key conflict rather than a second write. Two jobs: it makes the webhook '
  'idempotent, and it is the only record of what Stripe told us — the thing you need when a customer '
  'says they were charged and the product disagrees (CLAUDE.md §5). *** OURS, NOT THE CUSTOMER''S: '
  'no grant to anon or authenticated, and RLS on with no policy, so it is closed the way '
  'library_candidates is. *** `company_id` is nullable because an event for a customer we cannot map '
  'must still be recorded with its reason. My Account step 17.';

comment on column public.stripe_events.handled is
  'False until the columns on `companies` have been written. A row that stays false with an `error` '
  'is a payment fact we received and did not apply, which is exactly the kind of failure §5 refuses '
  'to let go silent.';

create index if not exists idx_stripe_events_company_id_created_at
  on public.stripe_events (company_id, created_at desc);

alter table public.stripe_events enable row level security;

-- Closed to people, both roles, explicitly — `CLAUDE.md` §3.6: not granting is not denying, and the
-- revoke is what denies. No policy is written either, so even a grant that arrived by some other
-- route would read nothing.
revoke all on table public.stripe_events from anon;
revoke all on table public.stripe_events from authenticated;
grant select, insert, update on table public.stripe_events to service_role;


-- =================================================================================================
-- 6. THE SELF-TEST — 14 CHECKS.
--
-- Two of them work by VIOLATING a constraint rather than by reading a catalog, because a CHECK
-- nobody has tried to break is a comment (`CLAUDE.md` §3.7) and a UNIQUE index nobody has tried to
-- duplicate is a hope.
-- =================================================================================================

do $$
declare
  n    bigint;
  ok   text;
  co   uuid;
  co2  uuid;
  tend timestamptz;
  tstart timestamptz;
  refused boolean;
  cols text[] := array['stripe_customer_id', 'stripe_subscription_id', 'subscription_status',
                       'current_period_end', 'payment_failed_at', 'card_brand', 'card_last4',
                       'trial_ends_at'];
begin
  -- ---- 1. THE EIGHT COLUMNS EXIST, WITH THE TYPES THE ROUTES WILL ASSUME. ----
  foreach ok in array cols loop
    select count(*) into n from information_schema.columns
     where table_schema = 'public' and table_name = 'companies' and column_name = ok;
    if n <> 1 then
      raise exception 'MIGRATION 087 FAILED: companies.% does not exist.', ok;
    end if;
  end loop;

  foreach ok in array array['stripe_customer_id', 'stripe_subscription_id', 'subscription_status',
                            'card_brand', 'card_last4'] loop
    if (select data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'companies' and column_name = ok) <> 'text' then
      raise exception 'MIGRATION 087 FAILED: companies.% is not text.', ok;
    end if;
  end loop;

  foreach ok in array array['current_period_end', 'payment_failed_at', 'trial_ends_at'] loop
    if (select data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'companies' and column_name = ok)
       <> 'timestamp with time zone' then
      raise exception 'MIGRATION 087 FAILED: companies.% is not timestamptz.', ok;
    end if;
  end loop;

  -- ---- 2. `trial_ends_at` IS NOT NULL, AND ITS DEFAULT IS FOURTEEN DAYS. ----
  -- NOT NULL is what lets step 18's rule read it without a fallback. The default is what fills it
  -- for a company 084's function makes, since that insert does not name it.
  if (select is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'companies' and column_name = 'trial_ends_at') <> 'NO' then
    raise exception 'MIGRATION 087 FAILED: companies.trial_ends_at is nullable, so the access rule could meet a null.';
  end if;
  if (select pg_get_expr(d.adbin, d.adrelid)
        from pg_attrdef d
        join pg_class c on c.oid = d.adrelid
        join pg_namespace ns on ns.oid = c.relnamespace
        join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
       where ns.nspname = 'public' and c.relname = 'companies' and a.attname = 'trial_ends_at')
     not like '%14 days%' then
    raise exception 'MIGRATION 087 FAILED: companies.trial_ends_at has no 14-day default, so a new company would have no trial.';
  end if;

  -- ---- 3. A PERSON MAY NOT WRITE ONE OF THE EIGHT. ----
  -- The point of the whole section 4. Read with has_column_privilege, never from the grant list.
  foreach ok in array cols loop
    if has_column_privilege('authenticated', 'public.companies', ok, 'UPDATE') then
      raise exception 'MIGRATION 087 FAILED: a person can write companies.%, which is billing state.', ok;
    end if;
  end loop;

  -- ---- 4. ...BUT A PERSON MAY STILL READ THEM, OR THE BILLING TAB IS BLANK. ----
  -- `authenticated` holds table-wide SELECT on companies (083), which is what /api/account's
  -- `select('*')` depends on. If this ever fails, the Billing tab cannot draw.
  if not has_table_privilege('authenticated', 'public.companies', 'SELECT') then
    raise exception 'MIGRATION 087 FAILED: a person cannot SELECT companies, so the Billing tab cannot read its own state.';
  end if;
  foreach ok in array cols loop
    if not has_column_privilege('authenticated', 'public.companies', ok, 'SELECT') then
      raise exception 'MIGRATION 087 FAILED: a person cannot read companies.%.', ok;
    end if;
  end loop;

  -- ---- 5. AND THE WEBHOOK'S OWN ROLE CAN WRITE ALL EIGHT. ----
  -- Check 3 would pass just as well on a table nobody can write at all.
  foreach ok in array cols loop
    if not has_column_privilege('service_role', 'public.companies', ok, 'UPDATE') then
      raise exception 'MIGRATION 087 FAILED: service_role cannot write companies.%, so the webhook cannot record it.', ok;
    end if;
  end loop;

  -- ---- 6. THE REST OF THE TABLE IS AS 083 AND 086 LEFT IT. ----
  -- 086's check 4, repeated: presence proves nothing without absence, and a migration that granted
  -- everything would sail through checks 3 and 5.
  foreach ok in array array['name', 'state', 'county', 'city', 'employee_count', 'library',
                            'trial_started_at', 'naics_code', 'id', 'created_at'] loop
    if has_column_privilege('authenticated', 'public.companies', ok, 'UPDATE') then
      raise exception 'MIGRATION 087 FAILED: a person can write companies.%, which 083 or 086 closed.', ok;
    end if;
  end loop;
  foreach ok in array array['about', 'industry', 'what_you_do', 'website_url', 'obligations_computed_at'] loop
    if not has_column_privilege('authenticated', 'public.companies', ok, 'UPDATE') then
      raise exception 'MIGRATION 087 FAILED: a person LOST companies.%, which the Company tab writes.', ok;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.companies', 'UPDATE') then
    raise exception 'MIGRATION 087 FAILED: authenticated holds table-wide UPDATE on companies again.';
  end if;

  -- ---- 7. anon HOLDS NONE OF THE EIGHT RIGHTS ON EITHER TABLE. ----
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('anon', 'public.companies', ok) then
      raise exception 'MIGRATION 087 FAILED: anon holds % on companies.', ok;
    end if;
    if has_table_privilege('anon', 'public.stripe_events', ok) then
      raise exception 'MIGRATION 087 FAILED: anon holds % on stripe_events.', ok;
    end if;
  end loop;

  -- ---- 8. `stripe_events` IS CLOSED TO A PERSON, RLS ON, AND HOLDS NO POLICY. ----
  -- All EIGHT rights, not the four `tests/unit/schemaGrants.test.ts` forbids: this table gives a
  -- person nothing at all, so the stricter loop is the right one and it covers those four over.
  --
  -- *** AND THERE IS NO service_role CLAUSE HERE, WHICH IS A CORRECTION. ***
  -- This check was first written to also refuse `service_role` holding TRUNCATE, TRIGGER,
  -- REFERENCES or MAINTAIN, on the strength of `CLAUDE.md` §3.6's line that "067 and 068 also took
  -- TRUNCATE, TRIGGER, REFERENCES and MAINTAIN off every existing table". The migration refused
  -- itself on that clause, which was the clause being wrong rather than the grant: read from
  -- `docs/SCHEMA.md`, which `scripts/schema-doc.js` regenerates from the live catalog,
  -- `service_role` on `companies` holds DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER,
  -- TRUNCATE, UPDATE — all eight — and so does every other table in this schema. 067 and 068 took
  -- the four off `anon` and `authenticated`; `supabase_admin`'s default privileges on `public` grant
  -- them to `service_role` for anything IT creates and `postgres` may not change those (§3.6).
  -- `tests/unit/schemaGrants.test.ts:46` goes further and ASSERTS a `service_role` TRUNCATE is
  -- visible in the document, so the parser can see the word it guards against.
  --
  -- So the clause would have made `stripe_events` the only table in the schema held to a rule
  -- nothing else is held to, and it buys nothing: `service_role` is the key that bypasses RLS
  -- altogether, and a role that can `delete from stripe_events` needs no TRUNCATE to empty it.
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('authenticated', 'public.stripe_events', ok) then
      raise exception 'MIGRATION 087 FAILED: a person holds % on stripe_events, which is ours.', ok;
    end if;
  end loop;
  -- ...and the webhook's own role can do the three things the webhook does, or none of this works.
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE'] loop
    if not has_table_privilege('service_role', 'public.stripe_events', ok) then
      raise exception 'MIGRATION 087 FAILED: service_role cannot % stripe_events, so the webhook cannot record an event.', ok;
    end if;
  end loop;
  if not (select relrowsecurity from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
           where ns.nspname = 'public' and c.relname = 'stripe_events') then
    raise exception 'MIGRATION 087 FAILED: RLS is not enabled on stripe_events.';
  end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'stripe_events';
  if n <> 0 then
    raise exception 'MIGRATION 087 FAILED: stripe_events has % policy(ies); it is meant to be closed entirely.', n;
  end if;

  -- ---- 9. THE UNIQUE INDEX EXISTS *AND REFUSES A DUPLICATE*. ----
  -- Tested by trying it. An index nobody has tried to duplicate is a hope.
  if not exists (select 1 from pg_indexes where schemaname = 'public'
                  and tablename = 'companies' and indexname = 'idx_companies_stripe_customer_id') then
    raise exception 'MIGRATION 087 FAILED: idx_companies_stripe_customer_id does not exist.';
  end if;

  -- The first probe names `trial_started_at` the way 084:95's function does, so check 10 below
  -- compares the two columns on a row shaped like a real new customer's rather than skipping.
  insert into public.companies (name, trial_started_at)
  values ('087 probe company', now()) returning id into co;
  insert into public.companies (name) values ('087 probe company two') returning id into co2;

  update public.companies set stripe_customer_id = 'cus_087probe' where id = co;
  refused := false;
  begin
    update public.companies set stripe_customer_id = 'cus_087probe' where id = co2;
  exception when unique_violation then
    refused := true;
  end;
  if not refused then
    raise exception 'MIGRATION 087 FAILED: two companies took the SAME Stripe customer, so one card could pay for another company.';
  end if;

  -- ...and NULL is not unique against NULL, which is what makes the index partial and usable.
  update public.companies set stripe_customer_id = null where id = co;
  update public.companies set stripe_customer_id = null where id = co2;

  -- ---- 10. A NEW COMPANY GETS A TRIAL END, FOURTEEN DAYS OUT, AGREEING WITH trial_started_at. ----
  -- This is the check that stops the SQL default and lib/billing.ts's TRIAL_DAYS drifting apart.
  select trial_ends_at, trial_started_at into tend, tstart from public.companies where id = co;
  if tend is null then
    raise exception 'MIGRATION 087 FAILED: a new company got no trial_ends_at.';
  end if;
  if tend < now() + interval '13 days' or tend > now() + interval '15 days' then
    raise exception 'MIGRATION 087 FAILED: a new company''s trial ends at %, which is not about fourteen days away.', tend;
  end if;
  -- 084's function sets trial_started_at = now() in the same insert, and the probe above is shaped
  -- the same way, so for this row the two MUST agree — within a minute, since they are two separate
  -- now() readings in one statement.
  if tstart is null then
    raise exception 'MIGRATION 087 FAILED: the probe lost trial_started_at, so this check proved nothing.';
  end if;
  if abs(extract(epoch from (tend - (tstart + interval '14 days')))) > 60 then
    raise exception 'MIGRATION 087 FAILED: trial_ends_at (%) is not trial_started_at + 14 days (%).',
      tend, tstart + interval '14 days';
  end if;

  -- ---- 11. THE CARD LINE GOES IN AND COMES BACK, AND CLEARS AGAIN. ----
  update public.companies set card_brand = 'visa', card_last4 = '4242' where id = co;
  if (select card_last4 from public.companies where id = co) <> '4242'
     or (select card_brand from public.companies where id = co) <> 'visa' then
    raise exception 'MIGRATION 087 FAILED: the card line did not come back as written.';
  end if;
  -- No card is a state, and it must be storable: a customer may remove their card in the portal.
  update public.companies set card_brand = null, card_last4 = null where id = co;
  if (select card_last4 from public.companies where id = co) is not null then
    raise exception 'MIGRATION 087 FAILED: the card line could not be cleared.';
  end if;

  -- ---- 12. *** AND THE DATABASE REFUSES A CARD NUMBER. *** ----
  -- Decision 12, tested by violating it. Three ways: a full PAN, too few digits, and non-digits.
  foreach ok in array array['4242424242424242', '424', 'visa 4242'] loop
    refused := false;
    begin
      update public.companies set card_last4 = ok where id = co;
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception 'MIGRATION 087 FAILED: companies.card_last4 accepted %, so it can hold more than four digits.', ok;
    end if;
  end loop;

  -- ---- 13. STRIPE'S STATUS WORDS ALL FIT, INCLUDING ONE WE DO NOT KNOW YET. ----
  -- The departure from §3.7 in one check: the ninth value Stripe invents must be recordable.
  foreach ok in array array['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due',
                            'canceled', 'unpaid', 'paused', 'something_stripe_adds_in_2027'] loop
    update public.companies set subscription_status = ok where id = co;
    if (select subscription_status from public.companies where id = co) <> ok then
      raise exception 'MIGRATION 087 FAILED: subscription_status would not hold %.', ok;
    end if;
  end loop;
  update public.companies set subscription_status = null where id = co;

  -- ---- 14. AN EVENT IS RECORDED ONCE, AND A REPLAY IS REFUSED. ----
  insert into public.stripe_events (id, type, company_id, stripe_customer_id, payload)
  values ('evt_087probe', 'customer.subscription.updated', co, 'cus_087probe', '{"probe": true}'::jsonb);
  refused := false;
  begin
    insert into public.stripe_events (id, type, company_id, stripe_customer_id, payload)
    values ('evt_087probe', 'customer.subscription.updated', co, 'cus_087probe', '{"probe": "again"}'::jsonb);
  exception when unique_violation then
    refused := true;
  end;
  if not refused then
    raise exception 'MIGRATION 087 FAILED: the same Stripe event was recorded twice, so the webhook is not idempotent.';
  end if;
  -- An event with no company must be recordable, or an event we cannot map would be dropped.
  insert into public.stripe_events (id, type, company_id, stripe_customer_id, payload, error)
  values ('evt_087orphan', 'invoice.paid', null, 'cus_nobody', '{}'::jsonb,
          'no company holds this Stripe customer');

  -- ---- CLEAN UP. The events go with the company by cascade; the orphan has none, so it is named. ----
  delete from public.stripe_events where id = 'evt_087orphan';
  delete from public.companies where id in (co, co2);
  select count(*) into n from public.companies where name like '087 probe company%';
  if n <> 0 then
    raise exception 'MIGRATION 087 FAILED: the probe companies could not be cleaned up.';
  end if;
  select count(*) into n from public.stripe_events where id like 'evt_087%';
  if n <> 0 then
    raise exception 'MIGRATION 087 FAILED: % probe event(s) survived — the cascade from companies did not fire.', n;
  end if;

  raise notice 'MIGRATION 087 OK: eight billing columns on companies, none of them writable by a '
    'person and all readable; trial_ends_at NOT NULL with a 14-day default that agrees with '
    'trial_started_at; one Stripe customer per company, proven by a refused duplicate; card_last4 '
    'refuses a card number, proven three ways; subscription_status holds Stripe''s eight words and a '
    'ninth it has not invented yet; stripe_events closed to every person with RLS on and no policy, '
    'and a replayed event refused. What any of it MEANS is lib/billing.ts, not the database: '
    'ACCOUNT-PLAN decisions 11 and 12, My Account step 17.';
end $$;
