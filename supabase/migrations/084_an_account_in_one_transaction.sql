-- =================================================================================================
-- 084 — AN ACCOUNT IN ONE TRANSACTION.
-- =================================================================================================
--
-- WHY.
--
-- `docs/ACCOUNT-MACHINERY.md` §B3 read signup out of the code. It is three writes with no
-- transaction and a single `catch` that returns a 500 (`app/api/signup/route.ts:63`-`:68`), and two
-- of the three failure points leave a person with an account they can sign into and nothing behind
-- it:
--
--   · FAILS AT `createUser` (`:34`) — nothing is left behind. The only clean outcome.
--   · FAILS AT THE `companies` INSERT (`:55`) — a login with no profile and no company. They can
--     sign in, every page 404s at `requireCompany` (`lib/auth.ts:106`-`:111`) because `profiles`
--     has no row, there is no route that repairs it, and they cannot even start again: the second
--     `createUser` with that address is refused as a duplicate.
--   · FAILS AT THE `profiles` INSERT (`:60`) — the same dead login, PLUS an orphaned company and
--     an orphaned primary site that no login reaches and no deletion path can ever find, because
--     `/api/account` DELETE is reachable only through `requireCompany`.
--
-- `docs/ACCOUNT-PLAN.md` decision 8 is the answer: *"The company and its main site are created with
-- the account, together or not at all."* "Together or not at all" is a transaction, and a route
-- cannot have one — the PostgREST client sends each `insert` as its own statement. So the two writes
-- move into one function, which is one statement, and Postgres makes it atomic for free.
--
-- WHAT IT DOES.
--
--   1. `create_company_for_login(p_user_id, p_company_name, p_website) returns uuid` —
--      SECURITY DEFINER, one transaction: the company, then (by migration 010's trigger) its main
--      site, then the profile that puts the login in the company. Any failure undoes all three.
--   2. EXECUTE for `service_role` and nobody else, because the only caller has no session yet.
--   3. A DEFAULT on `companies.industry`, because signup no longer asks for one and the column is a
--      join key rather than a label.
--   4. A self-test that proves the rights, the signature, the default and the rollback, and says
--      plainly what it cannot prove.
--
-- *** WHAT THIS MIGRATION DELIBERATELY DOES NOT DO. ***
--
--   · **It does not geocode.** The company is created with no state, county or city; the main site
--     is created with no address at all. The walk's screen 1 (board 7) asks for the main site's
--     address and `/api/sites` geocodes it (step 6, `lib/geocode.ts`), and 083's trigger mirrors the
--     result onto the company row. So the three jurisdiction columns are filled by the step that
--     has a street address, and never by a dropdown.
--   · **It does not take an email.** The step 12 brief's signature had a `p_email` and the owner
--     dropped it at the stop: there is nowhere for it to go. The address belongs to the login
--     system (`auth.users.email`), `profiles` has no email column, and holding a second copy here
--     would give one fact two homes — the mistake 082 refused for `website`/`website_url`. The
--     route knows the address; the company row does not need to.
--   · **It does not change the route or the page.** `app/api/signup/route.ts` and
--     `app/signup/page.tsx` are rewritten in the same commit, in TypeScript, and the four fields
--     and the undo live there. A function nothing calls is a grant with no reader (§9a) — the
--     reader lands in the same commit.
--   · **It does not touch the sidebar or `components/AppLayout.tsx`** (decision 14), and it creates
--     no table, so `/api/account` DELETE's two lists and `scripts/check-schema-contracts.js`
--     CHECK 2 are unaffected.
-- =================================================================================================


-- =================================================================================================
-- 1. THE FUNCTION.
--
-- SECURITY DEFINER, and not for convenience: `companies` holds no INSERT grant for `authenticated`
-- at all after 083 (`revoke insert, delete on table public.companies from authenticated`), and the
-- caller of this function has no role beyond `anon` anyway — they are signing up. Definer rights
-- are what let one statement write both tables; `service_role` is the only grantee, so the only way
-- to reach it is through a route holding the service key.
--
-- `set search_path = ''` is why every name below is schema-qualified. Without it, a definer-rights
-- function resolves names against the CALLER's search_path, which is how a definer function gets
-- tricked into writing somebody else's table.
--
-- THE MAIN SITE IS NOT WRITTEN HERE. `create_primary_site` (migration 010:69, its trigger at
-- :100) is an AFTER INSERT trigger on `companies` and makes the site in the same statement, named
-- from the company and its city — and with no city it is just the company name (010:80-83), which
-- is exactly right here: the site has no address yet. Migration 010's own comment says why it is a trigger rather than
-- route code, and this function is that reasoning carried to its end.
-- =================================================================================================

create or replace function public.create_company_for_login(
  p_user_id      uuid,
  p_company_name text,
  p_website      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  -- The company. Three columns named, and the rest left to the defaults on purpose: `library`
  -- ('chemical', 082) and now the vertical too (§2 below). The three jurisdiction columns stay
  -- empty until an address is geocoded — see the header.
  insert into public.companies (name, website_url, trial_started_at)
  values (
    p_company_name,
    nullif(btrim(coalesce(p_website, '')), ''),
    now()
  )
  returning id into v_company_id;

  -- The profile. This row IS the tenancy (`CLAUDE.md` §3.6) — until it exists the login belongs to
  -- nobody. `full_name` is null because signup does not ask for a name (board 6) and `welcomeFor`
  -- (`lib/dashboardView.ts:46`) reads a null as "no name" and greets without one; `welcomed_at` is
  -- null so the Dashboard's first visit says "Welcome" rather than "Welcome back"; `calendar_email`
  -- is stated rather than left to its default so the row says out loud that a new person is opted
  -- in to the monthly mail (decision 6).
  insert into public.profiles (id, company_id, full_name, welcomed_at, calendar_email)
  values (p_user_id, v_company_id, null, null, true);

  return v_company_id;
end $$;

comment on function public.create_company_for_login(uuid, text, text) is
  'Creates a company, its main site (through create_primary_site) and the profile that puts a login '
  'in it, in ONE transaction: together or not at all (ACCOUNT-PLAN decision 8). Called only by '
  '/api/signup, which holds the service key because no session exists yet. Any failure rolls back '
  'all three rows, so the address the person typed is still free to try again. It takes no email: '
  'the login system owns the address.';


-- =================================================================================================
-- 2. THE VERTICAL A NEW COMPANY STARTS WITH.
--
-- *** `companies.industry` IS A JOIN KEY, NOT A LABEL, AND SIGNUP NO LONGER ASKS FOR ONE. ***
--
-- The industry dropdown went with board 6 (decision 3): it was `distinct
-- requirement_templates.industries`, a list that can only offer verticals already built, shown to
-- somebody who has not yet seen the product. But the column it filled is joined on:
--
--   · `lib/agencyScope.ts:47` returns an EMPTY agency list when it is null, and the critic pass
--     then prints "(none known — do not treat this as 'no agency applies')" on every answer;
--   · `lib/resolve.ts:257` skips a requirement only `if (company.industry !== null && ...)`, so a
--     null removes the industry filter from resolution ALTOGETHER — a chemical maker could be
--     served cannabis rows, which is the same class of silent failure as the wrong jurisdiction
--     (`CLAUDE.md` §3.2).
--
-- So the column gets a DEFAULT rather than a question. `chemical-manufacturing` is the slug the
-- seeded data actually carries — `supabase/seed-data/agencies.json` and
-- `load-chemical-requirements.sql` hold `chemical-manufacturing` and `cannabis`, and the chemical
-- vertical is the one we sell (`CLAUDE.md` §1). It sits beside 082's `library not null default
-- 'chemical'` for the same reason: **a vertical is data, not an `if` branch** (§7), and one line of
-- DDL is how you say "this is what a new customer is today" without putting it in code.
--
-- The owner settled this at the step 12 stop. Two things follow, and both are deliberate:
--   · it is a DEFAULT, not NOT NULL — the six companies already on staging and the ten on
--     production keep whatever they chose, including null, and nothing is backfilled. This
--     migration changes no existing row;
--   · the step 13 website read may CORRECT it, with the person's confirmation, which is the only
--     way a second vertical ever reaches a new account. Until then every new company is served the
--     library we have actually verified.
-- =================================================================================================

alter table public.companies alter column industry set default 'chemical-manufacturing';

comment on column public.companies.industry is
  'The vertical slug joined on by agencies.industries and requirement_templates.industries — never '
  'a description. Signup stopped asking at step 12 (ACCOUNT-PLAN decision 3), so it DEFAULTS to '
  'chemical-manufacturing: a null here empties the agency list and switches off industry filtering '
  'in resolution. Existing rows were not touched; step 13 may correct it from the website read.';


-- =================================================================================================
-- 3. WHO MAY CALL THE FUNCTION.
--
-- Postgres grants EXECUTE on every new function to PUBLIC by default — the function-level half of
-- `CLAUDE.md` §3.6's "not granting is not denying", recorded in migration 019's header after
-- `substance_inventory` shipped open for five migrations. REVOKE then GRANT, and the self-test
-- reads the result back rather than trusting these four lines.
-- =================================================================================================

revoke all on function public.create_company_for_login(uuid, text, text) from public;
revoke all on function public.create_company_for_login(uuid, text, text) from anon;
revoke all on function public.create_company_for_login(uuid, text, text) from authenticated;
grant execute on function public.create_company_for_login(uuid, text, text) to service_role;


-- =================================================================================================
-- 4. THE SELF-TEST — 16 CHECKS.
--
-- *** WHAT IT CAN PROVE, AND THE ONE THING IT CANNOT. ***
--
-- `profiles.id` is a foreign key to `auth.users` (`000_baseline.sql:394`,
-- `profiles_id_fkey ... on delete cascade`), so a successful call needs a real login — and a
-- migration has no business inventing one in the auth schema. **So the happy path is not tested
-- here.** What is tested is everything around it:
--
--   · the signature, the return type, the definer flag and the pinned search_path, from the catalog;
--   · who holds EXECUTE, read back rather than assumed;
--   · that `create_primary_site` is still on `companies`, because this function depends on it for
--     the main site;
--   · that a company inserted directly gets exactly one main site, named from the company alone
--     when there is no city, and lands with `library = 'chemical'` and
--     `industry = 'chemical-manufacturing'` from the defaults alone — the PRESENCE that makes the
--     absences below mean something (§9a: a probe that can see nothing looks like a probe that
--     found nothing);
--   · and the whole point of the migration: a call that fails at the profile insert leaves NO
--     company and NO site behind.
--
-- The happy path — a real login, a profile row, `trial_started_at` stamped, the person signed in
-- and landing on the Dashboard — is proved by the route's own test and by the staging walk after
-- the go. Two of the columns the rollback hides are checked here against the function's STORED
-- SOURCE instead, which is a text check and is labelled as one, not a behavioural test.
-- =================================================================================================

do $$
declare
  n            bigint;
  co           uuid;
  returned     uuid;
  v_fixture    text := '084 probe company';
  v_src        text;
  v_constraint text;
  v_state      text;
  v_signature  text := 'p_user_id uuid, p_company_name text, p_website text';
begin
  -- ---- 1. ONE FUNCTION OF THAT NAME, AND IT IS THE ONE THE ROUTE CALLS. ----
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'create_company_for_login';
  if n <> 1 then
    raise exception 'MIGRATION 084 FAILED: % function(s) named create_company_for_login, expected exactly 1.', n;
  end if;

  -- ---- 2. THE SIGNATURE, CHARACTER FOR CHARACTER. ----
  -- A route calling `rpc('create_company_for_login', { p_company_name: … })` names these parameters
  -- by hand, and nothing type-checks that: the clients in this repository are built without the
  -- `Database` generic (`lib/auth.ts:36`, `lib/supabase.ts:4`), so a misspelled argument is a
  -- runtime 404 from PostgREST and not a compile error. This check is the only thing holding it.
  select pg_get_function_identity_arguments(p.oid) into v_src
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'create_company_for_login';
  if v_src <> v_signature then
    raise exception 'MIGRATION 084 FAILED: the signature is (%), expected (%).', v_src, v_signature;
  end if;

  -- ---- 3. IT RETURNS THE COMPANY ID. ----
  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = 'create_company_for_login'
       and p.prorettype = 'uuid'::regtype
  ) then
    raise exception 'MIGRATION 084 FAILED: create_company_for_login does not return uuid, so the route has no company id to use.';
  end if;

  -- ---- 4. IT IS SECURITY DEFINER. ----
  -- Without this it runs as the caller, and the caller is `service_role` — which would work today
  -- and would silently stop working the moment anybody else was granted EXECUTE.
  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = 'create_company_for_login' and p.prosecdef
  ) then
    raise exception 'MIGRATION 084 FAILED: create_company_for_login is not SECURITY DEFINER.';
  end if;

  -- ---- 5. ITS SEARCH PATH IS PINNED, AND PINNED EMPTY. ----
  -- Postgres stores `set search_path = ''` in `proconfig` as one element; the regex accepts the
  -- empty value with or without its quotes, because the quoting is the server's business and the
  -- EMPTINESS is ours. `search_path=public` would fail this, which is the case that matters.
  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral unnest(coalesce(p.proconfig, array[]::text[])) c
     where ns.nspname = 'public' and p.proname = 'create_company_for_login'
       and c ~ '^search_path=("")?$'
  ) then
    raise exception 'MIGRATION 084 FAILED: create_company_for_login has no empty search_path pinned: %',
      coalesce((select array_to_string(p.proconfig, ' ') from pg_proc p
                 join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'create_company_for_login'), '(none)');
  end if;

  -- ---- 6. PUBLIC HOLDS NO EXECUTE. ----
  -- 082:991's query shape, including the `proacl is null` arm: a function nobody has ever revoked
  -- has a NULL acl, `aclexplode(null)` returns no rows, and a check written without that arm
  -- passes vacuously on exactly the function that is wide open. `has_function_privilege('public',…)`
  -- is not available — PUBLIC is not a row in `pg_roles` — so `grantee = 0` is how PUBLIC is named.
  if exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    left join lateral aclexplode(p.proacl) a on true
     where ns.nspname = 'public' and p.proname = 'create_company_for_login'
       and (p.proacl is null or (a.privilege_type = 'EXECUTE' and a.grantee = 0))
  ) then
    raise exception 'MIGRATION 084 FAILED: PUBLIC holds EXECUTE on create_company_for_login, so anyone could make themselves a company.';
  end if;

  -- ---- 7 and 8. NOR anon, NOR authenticated. ----
  -- Asked affirmatively, because `has_function_privilege` answers for the role INCLUDING anything
  -- it inherits from PUBLIC. These two are therefore a stronger statement than check 6, not a
  -- restatement of it.
  if has_function_privilege('anon', 'public.create_company_for_login(uuid, text, text)', 'EXECUTE') then
    raise exception 'MIGRATION 084 FAILED: anon can execute create_company_for_login.';
  end if;
  if has_function_privilege('authenticated', 'public.create_company_for_login(uuid, text, text)', 'EXECUTE') then
    raise exception 'MIGRATION 084 FAILED: authenticated can execute create_company_for_login — a signed-in person could create a second company.';
  end if;

  -- ---- 9. AND service_role CAN. ----
  -- The presence that proves checks 7 and 8 are reading anything at all.
  if not has_function_privilege('service_role', 'public.create_company_for_login(uuid, text, text)', 'EXECUTE') then
    raise exception 'MIGRATION 084 FAILED: service_role cannot execute create_company_for_login, so /api/signup cannot create an account.';
  end if;

  -- ---- 10. THE TRIGGER THIS FUNCTION DEPENDS ON IS STILL THERE. ----
  select count(*) into n from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'companies' and t.tgname = 'create_primary_site';
  if n <> 1 then
    raise exception 'MIGRATION 084 FAILED: create_primary_site is not on companies, so a new account would have no main site.';
  end if;

  -- ---- 11. THE STORED SOURCE SAYS trial_started_at AND SAYS NOTHING ABOUT industry. ----
  -- *** A TEXT CHECK, NOT A BEHAVIOURAL ONE, AND IT IS HERE BECAUSE THE ROLLBACK HIDES BOTH. ***
  -- The trial clock and the four jurisdiction columns can only be observed on a row that survives,
  -- and no row survives a call in a migration (see the header to this section). The route's test
  -- and the staging walk are what prove the behaviour.
  select p.prosrc into v_src
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'create_company_for_login';
  if v_src not like '%trial_started_at%' then
    raise exception 'MIGRATION 084 FAILED: the function does not mention trial_started_at, so the 14-day clock would never start.';
  end if;
  if v_src like '%industry%' then
    raise exception 'MIGRATION 084 FAILED: the function writes companies.industry; signup asks four questions and industry is not one of them.';
  end if;

  -- ---- 12. THE DEFAULT ON companies.industry, READ OUT OF THE CATALOG. ----
  -- `pg_attrdef` holds the expression, which Postgres stores as `'chemical-manufacturing'::text`.
  -- The `like` is deliberate — the cast and the quoting are the server's business, the SLUG is
  -- ours — and check 14 then proves the behaviour exactly, by inserting a row and reading it back.
  select pg_get_expr(d.adbin, d.adrelid) into v_src
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
   where ns.nspname = 'public' and c.relname = 'companies' and a.attname = 'industry';
  if v_src is null then
    raise exception 'MIGRATION 084 FAILED: companies.industry has no default at all, so a new account joins to no agency and filters no requirement.';
  end if;
  if v_src not like '%chemical-manufacturing%' then
    raise exception 'MIGRATION 084 FAILED: companies.industry defaults to %, not to the chemical-manufacturing slug the seeded data carries.', v_src;
  end if;

  -- ---- 13. THE PRESENCE PROBE: A COMPANY, ITS ONE MAIN SITE, ITS LIBRARY AND ITS VERTICAL. ----
  -- *** THIS IS WHAT MAKES CHECK 16'S "NOTHING IS LEFT" MEAN SOMETHING (§9a). *** Without it, a
  -- database where companies could not be inserted at all would pass check 16 perfectly.
  insert into public.companies (name) values (v_fixture) returning id into co;

  select count(*) into n from public.entities where company_id = co and is_primary;
  if n <> 1 then
    raise exception 'MIGRATION 084 FAILED: create_primary_site made % main site(s) for a company with no city, expected 1.', n;
  end if;
  -- With no city the site's name is the company's, which is what a brand new account should see on
  -- board 1b before the walk gives it an address (migration 010:80-83).
  select count(*) into n from public.entities
   where company_id = co and is_primary and name = v_fixture;
  if n <> 1 then
    raise exception 'MIGRATION 084 FAILED: the main site of a city-less company is not named after the company: %',
      coalesce((select name from public.entities where company_id = co and is_primary), '(no site)');
  end if;
  -- 082 made `library` not null default 'chemical', which is why the function never names it.
  if (select library from public.companies where id = co) <> 'chemical' then
    raise exception 'MIGRATION 084 FAILED: a company created without naming library did not default to chemical: %',
      coalesce((select library from public.companies where id = co), 'NULL');
  end if;
  -- ---- 14. AND THE VERTICAL, FROM THE DEFAULT ALONE. ----
  -- The behavioural half of check 12: this insert names only `name`, exactly as the function does.
  if (select industry from public.companies where id = co) <> 'chemical-manufacturing' then
    raise exception 'MIGRATION 084 FAILED: a company created without naming industry came out as %, so a new account would join to no agency.',
      coalesce((select industry from public.companies where id = co), 'NULL');
  end if;
  -- The site has no address and no county: the walk fills those, from a street address, through
  -- the geocoder (step 6) and 083's mirror.
  if exists (select 1 from public.entities
              where company_id = co and is_primary
                and (address is not null or county is not null or state is not null)) then
    raise exception 'MIGRATION 084 FAILED: the main site arrived with a place on it; nothing here geocodes anything.';
  end if;

  delete from public.companies where id = co;
  select count(*) into n from public.companies where name = v_fixture;
  if n <> 0 then
    raise exception 'MIGRATION 084 FAILED: the probe company could not be cleaned up.';
  end if;

  -- ---- 15. A CALL FOR A LOGIN THAT DOES NOT EXIST FAILS, AND FAILS ON THE PROFILE. ----
  -- The company insert cannot fail here (it depends on nothing but the name), so the ONLY thing
  -- that can go wrong is `profiles.id` → `auth.users.id`. That makes this the exact shape of the
  -- third row in the header's table — the one that used to leave an orphaned company and site
  -- behind.
  begin
    returned := public.create_company_for_login(gen_random_uuid(), v_fixture, 'example.com');
    raise exception 'MIGRATION 084 FAILED: the function returned % for a login that does not exist in auth.users.', returned;
  exception
    when foreign_key_violation then
      get stacked diagnostics v_constraint = constraint_name, v_state = returned_sqlstate;
      if coalesce(v_constraint, '') <> 'profiles_id_fkey' then
        raise exception 'MIGRATION 084 FAILED: the call failed on constraint % (%), not on the profile''s login foreign key.',
          coalesce(v_constraint, '(none named)'), v_state;
      end if;
  end;

  -- ---- 16. AND NOTHING IS LEFT BEHIND. THE WHOLE MIGRATION IS THIS CHECK. ----
  select count(*) into n from public.companies where name = v_fixture;
  if n <> 0 then
    raise exception 'MIGRATION 084 FAILED: % company row(s) survived a call that failed, so signup can still orphan a company.', n;
  end if;
  select count(*) into n from public.entities where name = v_fixture;
  if n <> 0 then
    raise exception 'MIGRATION 084 FAILED: % site row(s) survived a call that failed.', n;
  end if;

  raise notice 'MIGRATION 084 OK: create_company_for_login is SECURITY DEFINER with an empty '
    'search_path, executable by service_role and by nobody else (PUBLIC, anon and authenticated '
    'all read back false); a company created without naming one lands with library chemical and '
    'industry chemical-manufacturing; and a call that fails at the profile leaves no company and '
    'no site behind. The HAPPY path needs a real login and is proved by the route''s test and the '
    'staging walk, not here.';
end $$;
