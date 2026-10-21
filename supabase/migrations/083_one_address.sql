-- =================================================================================================
-- 083 — ONE ADDRESS.
-- =================================================================================================
--
-- WHY.
--
-- After step 6 a company had TWO addresses and they were already drifting.
--
-- `ACCOUNT-PLAN.md` decision 4 says a company's address IS its main site's, and step 6 built that:
-- `/api/sites` geocodes a typed address and writes `entities.state`, `.county`, `.city` from the
-- Census Bureau's answer (`lib/geocode.ts`), and the Company tab shows the main site as the
-- company's address. What step 6 did NOT do — deliberately, because it changes resolution and
-- `CLAUDE.md` §3.1 says that is discussed first — is move the readers.
--
-- *** SO TODAY THE PRODUCT RESOLVES JURISDICTION FROM A COLUMN NOTHING KEEPS CURRENT. ***
-- Read from the code at step 6b, with line numbers:
--
--   `lib/obligationWriter.ts:98`   selects `id, name, state, county, city, industry` from companies
--   `lib/resolve.ts:283`           passes `{ state: company.state, county: company.county,
--                                   city: company.city }` into the jurisdiction test
--   `lib/jurisdiction.ts:93`       the STATE layer compares `requirement.state` to `company.state`
--   `lib/jurisdiction.ts:99`       the COUNTY layer compares `requirement.county` to `company.county`
--
-- (The CITY layer at `:105` and the LOCAL layer at `:113` already read the SITE, as does
-- `lib/agencyScope.ts:59-61,75` and the gate's jurisdiction block. It is the state and county
-- layers alone that read the company row.)
--
-- This was measured, not feared. During step 6's own walk on staging, the fixture company's main
-- site was re-geocoded from Portland, Oregon to Vancouver, Washington — `entities.state` became
-- 'Washington' and `entities.county` 'Clark' — while `companies.state` stayed 'Oregon' and
-- `companies.county` stayed 'Multnomah', because the page that moved the site does not write the
-- company. A company that moves across a state line would have kept resolving against the state it
-- left, which is `CLAUDE.md` §3.2's named failure: "Jurisdiction is always part of the match key.
-- Serving Oregon requirements to a Texas company is a silent, dangerous failure."
--
-- WHAT THIS MIGRATION DOES ABOUT IT, AND WHAT IT DELIBERATELY DOES NOT.
--
-- It does NOT move the readers. `lib/obligationWriter.ts`, `lib/resolve.ts` and `lib/jurisdiction.ts`
-- are untouched by this step. Instead it makes the column they read **a mirror of the main site**,
-- kept in step by the database itself:
--
--   1. A trigger on `entities`: when the MAIN site's state, county or city is written, the same
--      three are copied onto that company's row.
--   2. A one-time backfill, so every company that exists today already matches its main site.
--   3. `companies.state`, `.county` and `.city` leave the person's column grant. They are now
--      derived, and a derived column a person can type is two sources of truth wearing one name.
--   4. The two rights on `companies` that `authenticated` has always held and nothing has ever
--      used — INSERT and DELETE — are revoked.
--
-- *** WHY A TRIGGER RATHER THAN CHANGING THE FOUR READERS. ***
-- Changing them is the better end state and it is a change to RESOLUTION, which is §3.1's first
-- list ("requirements matching or resolution logic") and needs its own step with its own golden
-- run. A mirror is reversible, is provable in one DO block, and makes the wrong answer impossible
-- in the meantime. When the readers do move, this trigger and these three columns can go together;
-- until then nothing in the product has to know which of the two it is reading.
--
-- My Account step 6b, `ACCOUNT-PLAN.md` decision 17.
-- =================================================================================================


-- -------------------------------------------------------------------------------------------------
-- 1. THE MIRROR.
--
-- *** SECURITY DEFINER, AND SECTION 3 IS THE REASON. ***
-- After this migration a person holds no UPDATE on `companies.state`, `.county` or `.city` at all.
-- The person editing their own main site is exactly who must cause those three to change, so the
-- function has to write them with rights the caller does not have. 080's counter functions are the
-- shape being copied: definer, an explicit `search_path`, and EXECUTE revoked from `public`, `anon`
-- and `authenticated` — a trigger function is invoked by the trigger machinery and needs no EXECUTE
-- grant on the calling role, so revoking it from everyone costs nothing and closes a door.
--
-- `search_path = ''` rather than 080's `public, pg_temp`: it is stricter, it is what 082's
-- `site_removal_refusal` already uses in this same chain, and every name below is schema-qualified
-- so neither setting changes what this resolves to.
--
-- *** IT CANNOT REACH ANOTHER COMPANY'S ROW, AND THAT IS NOT AN ASSUMPTION. ***
-- A definer function that updates by an id taken off the row is precisely where a cross-tenant
-- write would hide. `new.company_id` cannot be chosen by the person: `company_id` is in the INSERT
-- grant on `entities` but NOT in the UPDATE grant (082), and `entities_insert`'s WITH CHECK is
-- `company_id = public.auth_company_id()`. So the only `company_id` a person can put on a row is
-- their own, and the only row they can update is one that already carries it.
--
-- The update is conditional on a real difference, so signup — where `create_primary_site` has just
-- copied the company's own values ONTO the site — does not write the company row straight back for
-- no reason.
-- -------------------------------------------------------------------------------------------------
create or replace function public.mirror_main_site_place()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.companies c
     set state  = new.state,
         county = new.county,
         city   = new.city
   where c.id = new.company_id
     and (c.state  is distinct from new.state
       or c.county is distinct from new.county
       or c.city   is distinct from new.city);
  return null;   -- AFTER trigger: the return value is ignored.
end $$;

comment on function public.mirror_main_site_place is
  'Copies the MAIN site''s state, county and city onto its company''s row, so the one column '
  'lib/jurisdiction.ts:93 and :99 read is always the address the customer actually gave. '
  'SECURITY DEFINER because migration 083 takes those three columns out of the person''s column '
  'grant: the person editing their own site is who must cause them to change, and they may not '
  'write them directly. Cannot reach another company: entities.company_id is not in the person''s '
  'UPDATE grant and entities_insert checks it against auth_company_id(). My Account step 6b.';

revoke all on function public.mirror_main_site_place() from public;
revoke all on function public.mirror_main_site_place() from anon;
revoke all on function public.mirror_main_site_place() from authenticated;

-- The WHEN clause is on the trigger rather than inside the function, 080's reasoning unchanged: the
-- function is not called at all for a site that is not the main one, and `pg_trigger` itself records
-- the rule where section 5 can read it back. `is_primary` is NOT NULL (007:343), so the WHEN cannot
-- evaluate to null and silently decline to fire.
--
-- `update of state, county, city` — a rename is not one of these and does not fire it.
--
-- *** A KNOWN GAP, NAMED RATHER THAN QUIETLY CLOSED. *** PROMOTING a site to main (is_primary
-- false -> true) does not fire this, because `is_primary` is not in the column list above. No person
-- can do it: `is_primary` is in neither the INSERT nor the UPDATE grant on `entities` (082), and
-- `idx_entities_one_primary` (007:616) permits only one main site per company. The service role
-- could, and if a later step gives the product a "make this the main site" control, that step adds
-- `is_primary` to this list and backfills again.
drop trigger if exists entities_mirror_main_site on public.entities;
create trigger entities_mirror_main_site
  after insert or update of state, county, city on public.entities
  for each row
  when (new.is_primary)
  execute function public.mirror_main_site_place();


-- -------------------------------------------------------------------------------------------------
-- 2. THE BACKFILL, ONCE.
--
-- *** THE DIRECTION IS SITE -> COMPANY, AND THE REVERSE WOULD DESTROY THE BETTER FACT. ***
-- From here on the site is the source: it is the only one of the two that was ever read off a real
-- street address (`lib/geocode.ts`, step 6), and decision 4 says so. Copying company -> site would
-- overwrite a geocoded county with a typed one — and `app/signup/page.tsx:174` sends `county: ''`
-- for every account ever created, so for most companies the "company" value is not a worse answer
-- but no answer at all.
--
-- *** AND WHERE THE SITE HAS NOTHING, THE COMPANY KEEPS WHAT IT HAS. ***
-- `coalesce`, not a straight copy. Every company created before step 6 has a main site whose county
-- is NULL — `create_primary_site` (010:84) writes `nullif(new.county,'')` and signup sends the empty
-- string — and whose address is NULL, because nothing ever collected one. Blanking the company's
-- typed state and city to match would throw away the only words anyone has given us about where
-- these businesses are, in exchange for nothing. A null on the site today means "never asked", not
-- "asked and there is none".
--
-- The trigger in section 1 does NOT coalesce, and the difference is deliberate: it fires on a real
-- edit, where the site's address has just changed and the company's old value is now a claim about
-- a place the business has left. A backfill is reading history; a trigger is recording a decision.
--
-- `where ... is distinct from` so this updates only the rows that actually move, and
-- `updated_at` is not disturbed on the rest.
-- -------------------------------------------------------------------------------------------------
update public.companies c
   set state  = coalesce(m.state,  c.state),
       county = coalesce(m.county, c.county),
       city   = coalesce(m.city,   c.city)
  from public.entities m
 where m.company_id = c.id
   and m.is_primary
   and (coalesce(m.state,  c.state)  is distinct from c.state
     or coalesce(m.county, c.county) is distinct from c.county
     or coalesce(m.city,   c.city)   is distinct from c.city);


-- -------------------------------------------------------------------------------------------------
-- 3. THE THREE COLUMNS LEAVE THE PERSON'S GRANT.
--
-- 082 granted eight: `industry, state, county, city, what_you_do, naics_code, website_url,
-- obligations_computed_at`. Five remain. `state`, `county` and `city` are derived from the main
-- site's address as of section 1, and a derived column a person can also type is two sources of
-- truth wearing one name — the exact condition this migration exists to end.
--
-- What each of the five that stay is still doing, so the next reader does not have to guess:
--
--   `industry`                 Company information's company block writes it (route :157) and step
--                              6 did not replace that page. Retiring it is on the owed list.
--   `what_you_do`, `naics_code`, `website_url`
--                              My Account's Company tab, decision 3. The point of them.
--   `obligations_computed_at`  NOT a person's field, and it has to be here anyway:
--                              `lib/obligationWriter.ts:164` stamps it with the CALLER's own client
--                              from `app/api/obligations/route.ts:45` and
--                              `app/api/switches/answer/route.ts:125`. Omitting it would make every
--                              signed-in person's first resolution fail with "permission denied for
--                              column". Moving that one statement to the service role as a named
--                              statement (§3.6) is owed.
-- -------------------------------------------------------------------------------------------------
revoke update on table public.companies from authenticated;
grant update (
  industry,
  what_you_do, naics_code, website_url,
  obligations_computed_at
) on table public.companies to authenticated;


-- -------------------------------------------------------------------------------------------------
-- 4. INSERT AND DELETE ON `companies`, WHICH `authenticated` HAS ALWAYS HELD AND NOTHING USES.
--
-- Read from the catalog at step 6b: `authenticated` holds DELETE, INSERT, SELECT on `companies`.
-- Neither right came from a GRANT anybody wrote — they are `pg_default_acl`'s, the surprise
-- `CLAUDE.md` §3.6 is about ("NOT granting is not denying").
--
-- Both are closed by RLS today and were proved so rather than assumed: `companies` carries exactly
-- two policies, `companies_select` and `companies_update`, so an INSERT has no policy permitting it
-- and a DELETE has none either. An insert attempted as the fixture login at step 5 came back
-- `42501 new row violates row-level security policy for table "companies"`.
--
-- So this changes no behaviour. It makes the grant say what the policies already enforce, which is
-- §3.6's rule that a table deliberately kept non-insertable depends on reading what the role HOLDS
-- rather than on what some migration once granted. Belt and braces, and the braces are the policies.
--
-- The service role is untouched and keeps both, which is what `/api/signup` (no session exists yet)
-- and `/api/account` DELETE (`app/api/account/route.ts:399`, `supabaseAdmin`) actually use. Section
-- 5 reads that back rather than asserting it.
-- -------------------------------------------------------------------------------------------------
revoke insert, delete on table public.companies from authenticated;

-- And `anon` still holds nothing here, restated for the reason 082 restated it: a REVOKE that turns
-- out to be redundant costs nothing, and `supabase_admin`'s default privileges still grant both
-- roles everything for objects IT creates (§3.6).
revoke all on table public.companies from anon;


-- -------------------------------------------------------------------------------------------------
-- 5. THE SELF-TEST.
--
-- Same shape as 080, 081 and 082: it tries to break every rule above, and raises if any of them
-- holds when it should not. It proves STRUCTURE, GRANTS and the TRIGGER. It cannot prove "a person
-- is refused", because becoming `authenticated` would also have to satisfy `auth_company_id()`,
-- which reads a `profiles` row whose id is a real login in `auth.users`, and a migration must not
-- invent a session (078:160). The person's half is `check:live`'s.
-- -------------------------------------------------------------------------------------------------
do $$
declare
  co        uuid;
  site_main uuid;
  site_2    uuid;
  n         int;
  txt       text;
  r         record;
begin
  -- ---- 5a. THE GRANT, READ FROM THE CATALOG AND NOT FROM SECTION 3. ----
  for r in
    select column_name,
           has_column_privilege('authenticated', 'public.companies', column_name, 'UPDATE') as may
      from information_schema.columns
     where table_schema = 'public' and table_name = 'companies'
  loop
    if r.column_name in ('industry', 'what_you_do', 'naics_code', 'website_url', 'obligations_computed_at') then
      if not r.may then
        raise exception 'MIGRATION 083 FAILED: a person should still be able to write companies.%', r.column_name;
      end if;
    else
      if r.may then
        raise exception 'MIGRATION 083 FAILED: a person can write companies.%, which is not in the grant.', r.column_name;
      end if;
    end if;
  end loop;

  -- The three this migration closed, named one by one, so a failure says which.
  foreach txt in array array['state', 'county', 'city'] loop
    if has_column_privilege('authenticated', 'public.companies', txt, 'UPDATE') then
      raise exception 'MIGRATION 083 FAILED: companies.% is still writable by a person.', txt;
    end if;
  end loop;

  -- ---- 5b. INSERT AND DELETE ARE GONE FOR A PERSON, AND THE SERVICE ROLE STILL HAS THEM. ----
  if has_table_privilege('authenticated', 'public.companies', 'INSERT') then
    raise exception 'MIGRATION 083 FAILED: authenticated can still INSERT a company.';
  end if;
  if has_table_privilege('authenticated', 'public.companies', 'DELETE') then
    raise exception 'MIGRATION 083 FAILED: authenticated can still DELETE a company.';
  end if;
  if not has_table_privilege('authenticated', 'public.companies', 'SELECT') then
    raise exception 'MIGRATION 083 FAILED: a person can no longer read their own company.';
  end if;
  -- Signup has no session and runs as the service role; account deletion removes the company row
  -- with it (app/api/account/route.ts:399). Both would break silently if these went.
  foreach txt in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not has_table_privilege('service_role', 'public.companies', txt) then
      raise exception 'MIGRATION 083 FAILED: the service role lost % on companies — signup or account deletion will break.', txt;
    end if;
  end loop;
  -- ...and anon still holds none of the eight.
  foreach txt in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('anon', 'public.companies', txt) then
      raise exception 'MIGRATION 083 FAILED: anon holds % on companies.', txt;
    end if;
  end loop;

  -- ---- 5c. THE FUNCTION AND THE TRIGGER, FROM THE CATALOG. ----
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mirror_main_site_place' and p.prosecdef;
  if n <> 1 then
    raise exception 'MIGRATION 083 FAILED: mirror_main_site_place is not a SECURITY DEFINER function (found %).', n;
  end if;
  -- PUBLIC must hold no EXECUTE on it. 080:664's idiom — `aclexplode`, grantee 0 is PUBLIC.
  --
  -- *** AND THE SAME QUESTION ASKED A SECOND WAY, BECAUSE THE FIRST ONE CAN PASS VACUOUSLY. ***
  -- `proacl` is NULL on a function nobody has granted or revoked anything on, `aclexplode(null)`
  -- returns no rows, and this count would be 0 — while PUBLIC holds EXECUTE by Postgres's own
  -- default, which is the opposite of what the 0 appears to say. §9a: a check that cannot see
  -- anything looks exactly like a check that found nothing. `has_function_privilege` answers what
  -- the role HOLDS, defaults included, so the second check cannot pass for the wrong reason.
  select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    left join lateral aclexplode(p.proacl) a on true
   where ns.nspname = 'public' and p.proname = 'mirror_main_site_place'
     and a.grantee = 0 and a.privilege_type = 'EXECUTE';
  if n > 0 then
    raise exception 'MIGRATION 083 FAILED: PUBLIC holds EXECUTE on mirror_main_site_place.';
  end if;

  foreach txt in array array['anon', 'authenticated'] loop
    if has_function_privilege(txt, 'public.mirror_main_site_place()', 'EXECUTE') then
      raise exception 'MIGRATION 083 FAILED: % can EXECUTE mirror_main_site_place — the revokes did not run.', txt;
    end if;
  end loop;

  select count(*) into n
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'entities'
     and t.tgname = 'entities_mirror_main_site'
     and not t.tgisinternal
     and (t.tgtype & 1) > 0      -- FOR EACH ROW
     and (t.tgtype & 2) = 0      -- AFTER, not BEFORE
     and (t.tgtype & 4) > 0      -- INSERT
     and (t.tgtype & 16) > 0;    -- UPDATE
  if n <> 1 then
    raise exception 'MIGRATION 083 FAILED: entities_mirror_main_site is not an AFTER INSERT OR UPDATE row trigger (found %).', n;
  end if;

  -- ---- 5d. THE BACKFILL LEFT NOTHING BEHIND. ----
  select count(*) into n
    from public.companies c join public.entities m on m.company_id = c.id and m.is_primary
   where (m.state  is not null and m.state  is distinct from c.state)
      or (m.county is not null and m.county is distinct from c.county)
      or (m.city   is not null and m.city   is distinct from c.city);
  if n > 0 then
    raise exception 'MIGRATION 083 FAILED: % company row(s) still differ from their main site.', n;
  end if;

  -- ---- 5e. THE MIRROR, ON A THROWAWAY COMPANY. ----
  insert into public.companies (name, city, state)
       values ('083 probe company', 'Probeville', 'Oregon') returning id into co;

  select id into site_main from public.entities where company_id = co and is_primary;
  if site_main is null then
    raise exception 'MIGRATION 083 FAILED: create_primary_site did not make a main site.';
  end if;

  -- THE PRESENCE FIRST (§9a): move the main site and the company must follow, all three columns.
  update public.entities
     set state = 'Washington', county = 'Clark', city = 'Vancouver'
   where id = site_main;

  select count(*) into n from public.companies
   where id = co and state = 'Washington' and county = 'Clark' and city = 'Vancouver';
  if n <> 1 then
    select format('state=%s county=%s city=%s', state, county, city) into txt
      from public.companies where id = co;
    raise exception 'MIGRATION 083 FAILED: the company did not follow its main site. It holds %.', txt;
  end if;

  -- A NULL propagates too, on a real edit: an address that no longer resolves must not leave the
  -- old county standing (section 1's comment, and §3.2's match key).
  update public.entities set county = null where id = site_main;
  if (select county from public.companies where id = co) is not null then
    raise exception 'MIGRATION 083 FAILED: a cleared county on the main site did not clear the company''s.';
  end if;
  update public.entities set county = 'Clark' where id = site_main;

  -- ---- 5f. AND A SITE THAT IS NOT THE MAIN ONE CHANGES NOTHING. ----
  insert into public.entities (company_id, entity_type, name, state, county, city)
       values (co, 'site', '083 probe second site', 'Texas', 'Harris', 'Houston')
    returning id into site_2;

  select count(*) into n from public.companies
   where id = co and state = 'Washington' and county = 'Clark' and city = 'Vancouver';
  if n <> 1 then
    raise exception 'MIGRATION 083 FAILED: adding a second site moved the company''s address.';
  end if;

  update public.entities set state = 'Texas', county = 'Travis', city = 'Austin' where id = site_2;
  select count(*) into n from public.companies
   where id = co and state = 'Washington' and county = 'Clark' and city = 'Vancouver';
  if n <> 1 then
    select format('state=%s county=%s city=%s', state, county, city) into txt
      from public.companies where id = co;
    raise exception 'MIGRATION 083 FAILED: editing a NON-main site moved the company''s address to %.', txt;
  end if;

  -- A rename of the main site must not fire it either — `update of state, county, city`.
  update public.entities set name = '083 probe renamed' where id = site_main;
  select count(*) into n from public.companies
   where id = co and state = 'Washington' and county = 'Clark' and city = 'Vancouver';
  if n <> 1 then
    raise exception 'MIGRATION 083 FAILED: renaming the main site changed the company''s address.';
  end if;

  -- ---- 5g. EVERYTHING THIS BLOCK MADE IS REMOVED, AND NOTHING OUTLIVES IT. ----
  delete from public.companies where id = co;

  select count(*) into n from public.companies where id = co;
  if n <> 0 then raise exception 'MIGRATION 083 FAILED: the probe company survived its own delete.'; end if;
  select count(*) into n from public.entities where company_id = co;
  if n <> 0 then raise exception 'MIGRATION 083 FAILED: % site(s) outlived the probe company.', n; end if;

  raise notice '083: ok — the company row mirrors its main site; state, county and city are closed to a person; INSERT and DELETE are too.';
end $$;
