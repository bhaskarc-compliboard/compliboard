-- ============================================================
-- COMPLIBOARD — MIGRATION 010: EVERY COMPANY HAS A PRIMARY SITE
-- ============================================================
--
-- WHY THIS EXISTS
--
-- TODO 1.6 promises a site row for EVERY company, "including for single-site customers, so
-- nothing is ever special-cased later: no `if (company has one site)` branch, no
-- nullable-everywhere, and adding a second site is an insert rather than a migration."
--
-- Nothing creates one. `grep "from('entities')"` across app/ and lib/ returns nothing at
-- all, and production has 10 companies and 0 entities. So the promise is currently false,
-- and every consumer of a site still has to handle its absence — which is the
-- special-casing the promise was meant to remove.
--
-- ------------------------------------------------------------
-- *** THIS REVERSES A CALL I MADE ON 10 SEPTEMBER, AND THE REASONING WAS WRONG. ***
--
-- Asked how to seed the site, I said: "A trigger is the wrong tool. A row-level trigger on
-- companies would create the site invisibly, and the site name needs to come from the
-- user. There are no triggers in public today."
--
-- Two of those three claims do not survive checking:
--
--   * "There are no triggers in public today" — false since migration 006, which put
--     set_updated_at on five tables and now six. It was true when I first read the schema
--     and I repeated it after it had stopped being true.
--
--   * "The site name needs to come from the user" — signup never asks for one. It collects
--     a company name and a city, and any name is derived from those whether the derivation
--     happens in a route or in a trigger. The user renames it later either way (M7).
--
-- What survives is "created invisibly", and that is a real cost — a row appears that the
-- caller did not insert. It is outweighed, because the alternative fails at the only thing
-- that matters here:
--
--   /api/signup performs THREE sequential inserts with NO TRANSACTION (companies, then
--   profiles, and a site would be the third). A failure at the last step leaves a company
--   with no site, silently, and the invariant is false again — so every downstream reader
--   still needs the null check, and the promise buys nothing. A trigger fires inside the
--   same statement as the insert it hangs off: either both rows exist or neither does.
--
-- It also covers every path that creates a company, not just the one route that exists
-- today.
-- ------------------------------------------------------------
--
-- WHAT THIS MIGRATION DOES
--   1. create_primary_site() and its trigger on companies
--   2. A backfill for every company that has no site — 10 of them in production
-- ============================================================


-- ------------------------------------------------------------
-- 1. THE TRIGGER
--
-- AFTER INSERT, because the site needs the company's id.
--
-- SECURITY INVOKER, deliberately: this runs as whoever inserted the company, and migration
-- 004 removed the `companies` INSERT policy entirely, so the only role that can reach this
-- is the service role. A SECURITY DEFINER here would grant nothing extra and would widen
-- the function's blast radius for no reason.
--
-- The name is the one TODO 1.6 asks for — "CompanyA-Hillsboro", not "Site 2" — because a
-- plant manager thinks "the Hillsboro plant" and making them translate that into an id
-- makes the product harder to use than the spreadsheet it replaces. Where the company has
-- no city the name is just the company name, which is honest rather than invented.
-- ------------------------------------------------------------

create or replace function public.create_primary_site()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.entities (company_id, entity_type, name, is_primary, state, county, city)
  values (
    new.id,
    'site',
    case
      when coalesce(new.city, '') <> '' then new.name || ' — ' || new.city
      else new.name
    end,
    true,
    new.state,
    nullif(new.county, ''),
    nullif(new.city, '')
  );
  return new;
end $$;

comment on function public.create_primary_site is
  'Gives every new company a primary site, in the same statement that creates the company. '
  'TODO 1.6: a default site for everyone, including single-site customers, so that nothing '
  'downstream ever has to ask whether a company has sites. A trigger rather than route code '
  'because /api/signup is three inserts with no transaction, and a site created by the '
  'third one is a site that can silently fail to exist.';

drop trigger if exists create_primary_site on public.companies;
create trigger create_primary_site
  after insert on public.companies
  for each row execute function public.create_primary_site();


-- ------------------------------------------------------------
-- 2. BACKFILL
--
-- Every company that has no site at all gets one, named and located from its own columns —
-- the same derivation the trigger uses, so a backfilled site and a new one are
-- indistinguishable.
--
-- `where not exists` rather than a blanket insert, so this is safe to re-run and safe on a
-- database where some companies already have sites. The partial unique index from 008
-- (one primary per company) would catch a mistake here anyway, loudly.
-- ------------------------------------------------------------

insert into public.entities (company_id, entity_type, name, is_primary, state, county, city)
select c.id,
       'site',
       case when coalesce(c.city, '') <> '' then c.name || ' — ' || c.city else c.name end,
       true,
       c.state,
       nullif(c.county, ''),
       nullif(c.city, '')
  from public.companies c
 where not exists (select 1 from public.entities e where e.company_id = c.id);


-- ------------------------------------------------------------
-- 3. VERIFY
-- ------------------------------------------------------------

do $$
declare orphans integer; extras integer;
begin
  select count(*) into orphans from public.companies c
   where not exists (select 1 from public.entities e where e.company_id = c.id and e.is_primary);
  if orphans > 0 then
    raise exception 'MIGRATION 010: % compan(y/ies) still have no primary site.', orphans;
  end if;

  -- The partial unique index should make this impossible; checked anyway, because the
  -- whole point of the invariant is that downstream code may rely on it.
  select count(*) into extras from (
    select company_id from public.entities where is_primary group by company_id having count(*) > 1
  ) x;
  if extras > 0 then
    raise exception 'MIGRATION 010: % compan(y/ies) have more than one primary site.', extras;
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'create_primary_site' and not tgisinternal) then
    raise exception 'MIGRATION 010: the create_primary_site trigger is not attached.';
  end if;

  raise notice 'MIGRATION 010 OK: every company has exactly one primary site, and new ones get theirs in the same statement.';
end $$;
