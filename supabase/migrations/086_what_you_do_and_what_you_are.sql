-- =================================================================================================
-- 086 — WHAT YOU DO, AND WHAT YOU ARE.
-- =================================================================================================
--
-- WHY.
--
-- The owner's own walk, 22 October, found that the card was asking a person to agree with a
-- six-digit number. `companies.naics_code` had been the walk's and the Company tab's second field
-- since step 6: a standard classification, picked from a list of 1,012 titles, shown as
-- "NAICS 325998" and then as "Closest standard category: …". Neither drawing worked, and the
-- reason is not the drawing:
--
--   · **nothing reads it.** `grep -rn naics_code app lib components prompts scripts` finds the two
--     writers, the control, and no reader at all. It is a claim with no consequence, which is the
--     shape §9a warns about;
--   · **the thing that WILL have a consequence is coarser.** When there is more than one
--     requirement table, what chooses one is "a chemical manufacturer" or "a food and beverage
--     distributor" — not 325998 against 325199. A six-digit code is a finer answer to a question
--     nobody asked;
--   · and a person cannot check it. "All Other Miscellaneous Chemical Product and Preparation
--     Manufacturing" is not a sentence anybody recognises as their own business.
--
-- So the two columns a person sees become two sentences they can read:
--
--   · `about` — NEW, this migration. One plain sentence about the business, in their own words:
--     *"We manufacture high purity specialty chemicals including mineral salts…"*
--   · `what_you_do` — which EXISTS (082) and changes meaning: it now holds the broad industry line,
--     *"Chemical manufacturing and distribution"*, chosen by the website read from a closed list
--     and editable to anything the person likes.
--
-- *** THE COLUMN THAT MATTERS TO THE ENGINE IS NEITHER OF THEM AND IS UNTOUCHED. ***
-- `companies.industry` is the JOIN KEY — `lib/agencyScope.ts:54` `.contains('industries', [slug])`
-- and `lib/resolve.ts:257` — defaulted to `chemical-manufacturing` by migration 084. Nothing here
-- changes it, writes it, or offers it to anybody. The industry LINE is what a person reads and
-- what a later step will map onto a table; the SLUG stays the engine's.
--
-- *** WHAT THIS MIGRATION DELIBERATELY DOES NOT DO. ***
--
--   · **It does not drop `naics_code`.** The column stays, with whatever two or three staging rows
--     already carry: dropping a column is not reversible and nothing is gained by it. What it DOES
--     do is take the person's right to write it (§2 below), on the owner's answer at the stop — a
--     grant with no writer is the same loose end as a grant with no reader, and "the column stays,
--     unwritten" is a thing the database can enforce rather than a thing we intend.
--   · **It does not touch `companies.industry`, `state`, `county`, `city` or `name`**, all of
--     which stay exactly as 082, 083 and 084 left them. §3 reads that back rather than saying it.
--   · **It creates no table and no index.** One column and one column grant.
-- =================================================================================================


-- =================================================================================================
-- 1. THE COLUMN.
--
-- `about` rather than `description` or `summary`: it is the answer to "what is this company
-- about?", it is one sentence, and the two other names are already overloaded in this schema
-- (`document_scans.summary`, `audit_findings.description`).
--
-- Nullable, with no default. A company that has not said yet says nothing — the card and the
-- Company tab both draw an empty line with a `write it` beside it, which is a state, not a gap.
-- =================================================================================================

alter table public.companies add column if not exists about text;

comment on column public.companies.about is
  'One plain sentence about the business, in the person''s own words — "We manufacture high purity '
  'specialty chemicals for pharmaceutical and food customers". Proposed by the website read '
  '(ACCOUNT-PLAN decision 9) and editable on the walk''s first screen and the Company tab; what '
  'the person leaves in the box is what is stored. Nothing reads it yet: it is what the product '
  'knows about a company in words, for the pages that will describe them and for a future read '
  'that needs context. My Account step 15.';

comment on column public.companies.what_you_do is
  'THE BROAD INDUSTRY LINE a person reads: "Chemical manufacturing and distribution". Proposed by '
  'the website read from a closed list of five industries and three roles, and editable to '
  'anything. *** IT CHANGED MEANING AT STEP 15. *** From 082 to then it held the free sentence '
  'about the business, which now lives in `about`. It is NOT the engine''s join key — that is '
  '`companies.industry`, a slug, untouched by any screen — and it is what a later step will map '
  'onto a requirement table when there is more than one.';


-- =================================================================================================
-- 2. WHO MAY WRITE IT.
--
-- Column grants are additive, so this adds `about` to the five `authenticated` already holds on
-- this table (083 narrowed them to industry, what_you_do, naics_code, website_url,
-- obligations_computed_at). The person edits it straight through their own client, exactly as the
-- Company tab has written `what_you_do` since step 6 — 082's grant is the boundary, not an `if`.
-- =================================================================================================

grant update (about) on table public.companies to authenticated;

-- *** AND NAICS LEAVES THE DOORS FOR GOOD. ***
--
-- The walk and the Company tab both wrote `naics_code` until today and neither does now. A column
-- a person may still write and nothing writes is a loose end: the next screen that wants a
-- classification can fill it without anybody deciding to, and `companies.naics_code` would quietly
-- become a second industry answer beside `industry` and `what_you_do`. So the right goes. The
-- column keeps what it has; `service_role` keeps everything, as it does on every column here.
revoke update (naics_code) on table public.companies from authenticated;


-- =================================================================================================
-- 3. THE SELF-TEST — 15 CHECKS.
-- =================================================================================================

do $$
declare
  n   bigint;
  ok  text;
  co  uuid;
begin
  -- ---- 1. THE COLUMN EXISTS, AND IT IS TEXT AND NULLABLE. ----
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'companies' and column_name = 'about'
     and data_type = 'text' and is_nullable = 'YES';
  if n <> 1 then
    raise exception 'MIGRATION 086 FAILED: companies.about is not a nullable text column.';
  end if;

  -- ---- 2. A PERSON MAY WRITE THE TWO LINES THE CARD SHOWS. ----
  foreach ok in array array['about', 'what_you_do'] loop
    if not has_column_privilege('authenticated', 'public.companies', ok, 'UPDATE') then
      raise exception 'MIGRATION 086 FAILED: a person cannot write companies.%, so the card cannot save it.', ok;
    end if;
  end loop;

  -- ---- 3. AND A PERSON MAY NO LONGER WRITE naics_code. ----
  -- The one right this migration TAKES. `service_role` keeps it, which is what makes this a
  -- statement about the doors rather than about the column.
  if has_column_privilege('authenticated', 'public.companies', 'naics_code', 'UPDATE') then
    raise exception 'MIGRATION 086 FAILED: a person can still write companies.naics_code.';
  end if;
  if not has_column_privilege('service_role', 'public.companies', 'naics_code', 'UPDATE') then
    raise exception 'MIGRATION 086 FAILED: service_role lost naics_code, which was not the point.';
  end if;
  -- The column itself is still there, holding whatever it held.
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'companies' and column_name = 'naics_code') then
    raise exception 'MIGRATION 086 FAILED: naics_code was dropped; it was only meant to be closed.';
  end if;

  -- ---- 4. AND THE REST OF THE TABLE IS AS 083 AND 084 LEFT IT. ----
  -- The presence above means nothing without these: a migration that granted everything would
  -- pass check 2 perfectly.
  foreach ok in array array['name', 'state', 'county', 'city', 'employee_count', 'library',
                            'trial_started_at', 'id', 'created_at'] loop
    if has_column_privilege('authenticated', 'public.companies', ok, 'UPDATE') then
      raise exception 'MIGRATION 086 FAILED: a person can write companies.%, which 083 closed.', ok;
    end if;
  end loop;

  -- ---- 5. THE ENGINE'S COLUMN IS UNTOUCHED, IN BOTH SENSES. ----
  -- Still defaulted (084), and still writable by a person: the slug is not what this migration
  -- is about and the Company tab has offered it since step 5.
  if (select pg_get_expr(d.adbin, d.adrelid)
        from pg_attrdef d
        join pg_class c on c.oid = d.adrelid
        join pg_namespace ns on ns.oid = c.relnamespace
        join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
       where ns.nspname = 'public' and c.relname = 'companies' and a.attname = 'industry')
     not like '%chemical-manufacturing%' then
    raise exception 'MIGRATION 086 FAILED: companies.industry lost 084''s default.';
  end if;

  -- ---- 6. THE TABLE STILL HOLDS NO TABLE-WIDE UPDATE, AND anon STILL HOLDS NOTHING. ----
  if has_table_privilege('authenticated', 'public.companies', 'UPDATE') then
    raise exception 'MIGRATION 086 FAILED: authenticated holds table-wide UPDATE on companies again.';
  end if;
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('anon', 'public.companies', ok) then
      raise exception 'MIGRATION 086 FAILED: anon holds % on companies.', ok;
    end if;
  end loop;

  -- ---- 7. A THROWAWAY COMPANY TAKES BOTH LINES AND GIVES THEM BACK. ----
  insert into public.companies (name) values ('086 probe company') returning id into co;
  update public.companies
     set about = 'We manufacture high purity specialty chemicals.',
         what_you_do = 'Chemical manufacturing and distribution'
   where id = co;
  if (select about from public.companies where id = co) is null
     or (select what_you_do from public.companies where id = co) <> 'Chemical manufacturing and distribution' then
    raise exception 'MIGRATION 086 FAILED: the two lines did not come back as written.';
  end if;

  -- An empty line is a state and must be storable: "not said yet" is not the same as a gap.
  update public.companies set about = null, what_you_do = null where id = co;
  if (select about from public.companies where id = co) is not null then
    raise exception 'MIGRATION 086 FAILED: about could not be cleared.';
  end if;

  -- …and the default still filled the engine's column on the way in.
  if (select industry from public.companies where id = co) <> 'chemical-manufacturing' then
    raise exception 'MIGRATION 086 FAILED: a new company did not get 084''s industry default.';
  end if;

  delete from public.companies where id = co;
  select count(*) into n from public.companies where name = '086 probe company';
  if n <> 0 then
    raise exception 'MIGRATION 086 FAILED: the probe company could not be cleaned up.';
  end if;

  raise notice 'MIGRATION 086 OK: companies.about exists, nullable text; a person may write it and '
    'what_you_do and nothing else that 083 closed; anon holds none of the eight rights; the '
    'engine''s industry column keeps 084''s default and is untouched; and naics_code is closed to '
    'a person while the column and service_role keep it. What the two lines MEAN is '
    'the product''s business, not the database''s: DECISIONS.md §212.';
end $$;
